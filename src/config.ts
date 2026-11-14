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
    id: 'qwen3vl-8b',
    title: 'Qwen3-VL 8B abliterated (Q4_K_M)',
    note: 'Умнее, но медленнее. Скачать ~5.8 ГБ. Нужно ~8 ГБ свободной RAM.',
    modelUrl: `${HF_8B}/Qwen3-VL-8B-Instruct-abliterated-v2.Q4_K_M.gguf`,
    mmprojUrl: `${HF_8B}/Qwen3-VL-8B-Instruct-abliterated-v2.mmproj-Q8_0.gguf`,
  },
  {
    id: 'qwen3vl-4b',
    title: 'Huihui Qwen3-VL 4B abliterated (Q4_K_M)',
    note: 'Заметно быстрее, качество ниже. Скачать ~3.3 ГБ.',
    modelUrl: `${HF_4B}/Huihui-Qwen3-VL-4B-Instruct-abliterated-Q4_K_M.gguf`,
    mmprojUrl: `${HF_4B}/mmproj-F16.gguf`,
  },
];

export const DEFAULT_SYSTEM_PROMPT =
  'Ты полезный ассистент. Отвечай на языке пользователя. Если есть изображение, внимательно его опиши и ответь на вопрос.';

export type Settings = {
  systemPrompt: string;
  nCtx: number;
  nThreads: number;
  imageMaxTokens: number;
  temperature: number;
  maxNewTokens: number;
};

export const DEFAULT_SETTINGS: Settings = {
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  nCtx: 4096,
  nThreads: 6,
  imageMaxTokens: 512,
  temperature: 0.7,
  maxNewTokens: 1024,
};
