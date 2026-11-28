import { initLlama, LlamaContext } from 'llama.rn';
import type { Settings } from './config';

export type ChatMsg = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  images: string[];
  stats?: string;
  generated?: boolean;
  drawPrompt?: string;
};

let ctx: LlamaContext | null = null;
let mmReady = false;
let lastLoad: { modelUri: string; mmprojUri: string; settings: Settings } | null = null;

export function isLoaded(): boolean {
  return ctx !== null;
}

/** Перезагружает последнюю модель, если её выгрузили (например, ради рисования). */
export async function ensureLoaded(): Promise<void> {
  if (ctx || !lastLoad) return;
  await loadModel(lastLoad.modelUri, lastLoad.mmprojUri, lastLoad.settings);
}

export async function unloadModel(): Promise<void> {
  const c = ctx;
  ctx = null;
  mmReady = false;
  if (c) {
    try {
      await c.release();
    } catch {
      // уже освобождён
    }
  }
}

export async function loadModel(
  modelUri: string,
  mmprojUri: string,
  s: Settings,
): Promise<{ vision: boolean }> {
  await unloadModel();
  lastLoad = { modelUri, mmprojUri, settings: s };
  // GPU-ускорение llama.rn на Android есть только для Qualcomm Adreno/Hexagon.
  // На Dimensity (Mali) работаем на CPU, поэтому n_gpu_layers = 0.
  const c = await initLlama({
    model: modelUri,
    n_ctx: s.nCtx,
    n_threads: s.nThreads,
    n_gpu_layers: 0,
    // Батч обработки промпта (llama.cpp по умолчанию так и есть; задаём явно).
    // n_batch должен вмещать всю картинку целиком (токены картинки декодируются одним куском).
    n_batch: 2048,
    n_ubatch: s.nUbatch,
    flash_attn_type: s.flashAttn ? 'auto' : 'off',
    ctx_shift: false, // обязательно для мультимодальных моделей
    use_mlock: false,
  });
  ctx = c;
  if (s.lazyVision) return { vision: true }; // mmproj подгрузим при первой картинке
  await initVision();
  return { vision: true };
}

async function initVision(): Promise<void> {
  if (!ctx || !lastLoad || mmReady) return;
  const ok = await ctx.initMultimodal({
    path: lastLoad.mmprojUri,
    use_gpu: false,
    image_max_tokens: lastLoad.settings.imageMaxTokens,
  });
  if (!ok) {
    await unloadModel();
    throw new Error(
      'Не удалось загрузить mmproj. Проверь, что файл mmproj подходит именно к этой модели.',
    );
  }
  const sup = await ctx.getMultimodalSupport();
  if (!sup.vision) {
    throw new Error('Зрение не активно: проверь, что mmproj подходит к этой модели.');
  }
  mmReady = true;
}

function buildMessages(history: ChatMsg[], system: string) {
  const msgs: { role: string; content: any }[] = [];
  if (system.trim()) msgs.push({ role: 'system', content: system.trim() });
  for (const m of history) {
    if (m.role === 'user' && m.images.length > 0) {
      msgs.push({
        role: 'user',
        content: [
          ...m.images.map((url) => ({ type: 'image_url', image_url: { url } })),
          { type: 'text', text: m.text.trim() || 'Опиши, что на изображении.' },
        ],
      });
    } else {
      msgs.push({ role: m.role, content: m.text });
    }
  }
  return msgs;
}

export async function generate(
  history: ChatMsg[],
  s: Settings,
  onToken: (accumulated: string, count: number) => void,
  topP = 0.9,
  onPhase?: (text: string) => void,
): Promise<{ text: string; stats: string }> {
  if (!ctx) throw new Error('Модель не загружена');
  if (!mmReady && history.some((m) => m.images.length > 0)) {
    onPhase?.('Загружаю модуль зрения (один раз)…');
    await initVision();
  }
  if (!ctx) throw new Error('Модель не загружена');
  let acc = '';
  let count = 0;
  const t0 = Date.now();
  let tFirst = 0;
  const res = await ctx.completion(
    {
      messages: buildMessages(history, s.systemPrompt),
      n_predict: s.maxNewTokens,
      temperature: s.temperature,
      top_p: topP,
      stop: ['<|im_end|>', '<|endoftext|>'],
    },
    (data) => {
      acc += data.token;
      count += 1;
      if (count === 1) tFirst = Date.now();
      onToken(acc, count);
    },
  );
  const t = res.timings;
  const parts: string[] = [];
  if (t) {
    parts.push(`${t.predicted_per_second.toFixed(1)} ток/с · ${t.predicted_n} ток.`);
    let pp = `промпт: ${t.prompt_n} ток. за ${(t.prompt_ms / 1000).toFixed(1)} с`;
    if (t.prompt_per_second > 0) pp += ` (${t.prompt_per_second.toFixed(0)} ток/с)`;
    if (t.cache_n > 0) pp += `, из кэша ${t.cache_n}`;
    parts.push(pp);
  }
  if (tFirst > 0) parts.push(`до 1-го токена ${((tFirst - t0) / 1000).toFixed(1)} с`);
  const stats = parts.join(' · ');
  return { text: (res.text || acc).trim(), stats };
}

export async function stopGeneration(): Promise<void> {
  if (ctx) {
    try {
      await ctx.stopCompletion();
    } catch {
      // игнорируем
    }
  }
}
