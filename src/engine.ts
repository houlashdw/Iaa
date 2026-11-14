import { initLlama, LlamaContext } from 'llama.rn';
import type { Settings } from './config';

export type ChatMsg = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  images: string[];
  stats?: string;
  generated?: boolean;
};

let ctx: LlamaContext | null = null;
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
    ctx_shift: false, // обязательно для мультимодальных моделей
    use_mlock: false,
  });
  ctx = c;
  const ok = await c.initMultimodal({
    path: mmprojUri,
    use_gpu: false,
    image_max_tokens: s.imageMaxTokens,
  });
  if (!ok) {
    await unloadModel();
    throw new Error(
      'Не удалось загрузить mmproj. Проверь, что файл mmproj подходит именно к этой модели.',
    );
  }
  const sup = await c.getMultimodalSupport();
  return { vision: !!sup.vision };
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
): Promise<{ text: string; stats: string }> {
  if (!ctx) throw new Error('Модель не загружена');
  let acc = '';
  let count = 0;
  const res = await ctx.completion(
    {
      messages: buildMessages(history, s.systemPrompt),
      n_predict: s.maxNewTokens,
      temperature: s.temperature,
      top_p: 0.9,
      stop: ['<|im_end|>', '<|endoftext|>'],
    },
    (data) => {
      acc += data.token;
      count += 1;
      onToken(acc, count);
    },
  );
  const t = res.timings;
  const stats = t
    ? `${t.predicted_per_second.toFixed(1)} ток/с · ${t.predicted_n} ток.`
    : '';
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
