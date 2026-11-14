export type Preset = {
  id: string;
  title: string;
  note: string;
  modelUrl: string;
  mmprojUrl: string;
};

const HF_8B =
  'https://huggingface.co/prithivMLmods/Qwen3-VL-8B-Instruct-abliterated-v2-GGUF/resolve/main';
const HF_4B =
  'https://huggingface.co/noctrex/Huihui-Qwen3-VL-4B-Instruct-abliterated-GGUF/resolve/main';

// Названия файлов проверены по страницам репозиториев на Hugging Face.
export const PRESETS: Preset[] = [
  {
    id: 'qwen3vl-4b',
    title: 'Huihui Qwen3-VL 4B abliterated (Q4_K_M) — рекомендуется',
    note: 'Быстрее и надёжно помещается в память. Скачать ~3.3 ГБ.',
    modelUrl: `${HF_4B}/Huihui-Qwen3-VL-4B-Instruct-abliterated-Q4_K_M.gguf`,
    mmprojUrl: `${HF_4B}/mmproj-F16.gguf`,
  },
  {
    id: 'qwen3vl-8b',
    title: 'Qwen3-VL 8B abliterated (Q4_K_M)',
    note:
      'Умнее, но тяжёлая: нужно ~8 ГБ СВОБОДНОЙ памяти (закрой всё остальное). ' +
      'Если ответы идут медленнее 1 токена в секунду, бери 4B. Скачать ~5.8 ГБ.',
    modelUrl: `${HF_8B}/Qwen3-VL-8B-Instruct-abliterated-v2.Q4_K_M.gguf`,
    mmprojUrl: `${HF_8B}/Qwen3-VL-8B-Instruct-abliterated-v2.mmproj-Q8_0.gguf`,
  },
];

export const SD_PRESET = {
  title: 'SD-Turbo (Q8): рисует за 4 шага',
  note: 'Отдельная модель-художник, ~2 ГБ. 512×512 на процессоре примерно 30–90 секунд.',
  url: 'https://huggingface.co/Green-Sky/SD-Turbo-GGUF/resolve/main/sd_turbo-f16-q8_0.gguf',
};

export const PROMPT_ENHANCER_SYSTEM =
  'You write prompts for a text-to-image model (Stable Diffusion). ' +
  "Convert the user's request (any language) into ONE detailed English prompt: subject, setting, " +
  'style, lighting, camera, quality keywords. Output ONLY the prompt text, no quotes, no explanations.';

export const DEFAULT_SYSTEM_PROMPT =
  'Ты полезный ассистент. Отвечай на языке пользователя. Если есть изображение, внимательно его опиши и ответь на вопрос.';

export type Settings = {
  systemPrompt: string;
  nCtx: number;
  nThreads: number;
  imageMaxTokens: number;
  temperature: number;
  maxNewTokens: number;
  sdSteps: number;
  sdSize: number;
  sdCfg: number;
  sdNegative: string;
};

export const DEFAULT_SETTINGS: Settings = {
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  nCtx: 4096,
  nThreads: 4,
  imageMaxTokens: 512,
  temperature: 0.7,
  maxNewTokens: 1024,
  sdSteps: 4,
  sdSize: 512,
  sdCfg: 1.0,
  sdNegative: 'blurry, low quality, deformed, watermark, text',
};
