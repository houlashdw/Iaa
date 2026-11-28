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

export type SdProfile = {
  steps: number;
  size: number;
  cfg: number;
  sampler: string;
  scheduler: string;
};

export type SdPreset = {
  id: string;
  title: string;
  note: string;
  url: string;
  profile: SdProfile;
};

export const SD_PRESETS: SdPreset[] = [
  {
    id: 'sd-turbo',
    title: 'SD-Turbo (Q8): самый быстрый',
    note: '~2 ГБ. 4 шага. Быстро, но возможны артефакты (руки, лица, детали).',
    url: 'https://huggingface.co/Green-Sky/SD-Turbo-GGUF/resolve/main/sd_turbo-f16-q8_0.gguf',
    profile: { steps: 4, size: 512, cfg: 1.0, sampler: 'euler', scheduler: 'discrete' },
  },
  {
    id: 'dreamshaper-lcm',
    title: 'DreamShaper-7 LCM: качественнее',
    note:
      '~2.1 ГБ. 6 шагов, чище детали и лица, лучше с аниме и иллюстрациями. ' +
      'Лицензия CreativeML OpenRAIL-M.',
    url: 'https://huggingface.co/darkmaniac7/TokForge-DreamShaper-LCM-GGUF/resolve/main/dreamshaper-7-lcm-f16.gguf',
    profile: { steps: 6, size: 512, cfg: 1.5, sampler: 'lcm', scheduler: 'lcm' },
  },
];

export type DrawStyle = {
  id: string;
  title: string;
  suffix: string;
  negative: string;
  filter?: 'pencil';
};

export const DRAW_STYLES: DrawStyle[] = [
  { id: 'none', title: 'Без стиля', suffix: '', negative: '' },
  {
    id: 'digital',
    title: 'Диджитал-арт (планшет)',
    suffix: 'digital painting, painterly soft shading, rim lighting, rich colors, concept art, detailed',
    negative: 'photo, 3d render, lowres, blurry, deformed, bad anatomy, bad hands, extra fingers, watermark',
  },
  {
    id: 'digital-anime',
    title: 'Диджитал аниме-арт',
    suffix: 'anime illustration, clean lineart, soft shading, vibrant colors, detailed eyes, sharp focus',
    negative: 'photo, realistic, 3d render, lowres, blurry, bad anatomy, bad hands, extra fingers, watermark',
  },
  {
    id: 'anime',
    title: 'Аниме',
    suffix: 'anime style, clean lineart, cel shading, vibrant colors, sharp focus',
    negative: 'photo, realistic, 3d, lowres, bad anatomy, bad hands, extra fingers',
  },
  {
    id: 'pencil',
    title: 'Карандаш + штриховка',
    suffix: 'graphite pencil drawing, hatching and cross-hatching, monochrome sketch on paper, fine linework',
    negative: 'color, photo, blurry, lowres, deformed',
    filter: 'pencil',
  },
  {
    id: 'ink',
    title: 'Тушь / манга',
    suffix: 'black ink illustration, bold linework, hatching, high contrast, manga style, monochrome',
    negative: 'color, photo, blurry, lowres, deformed',
  },
  {
    id: 'watercolor',
    title: 'Акварель',
    suffix: 'watercolor painting, soft washes, paper texture, delicate gradients',
    negative: 'photo, lowres, blurry, deformed',
  },
  {
    id: 'oil',
    title: 'Масло',
    suffix: 'oil painting, visible brush strokes, rich colors, dramatic lighting',
    negative: 'photo, lowres, blurry, deformed',
  },
  {
    id: 'real',
    title: 'Реализм',
    suffix: 'photorealistic, natural lighting, 85mm photo, sharp focus',
    negative: 'cartoon, anime, painting, lowres, blurry, deformed, bad anatomy',
  },
  {
    id: '3d',
    title: '3D',
    suffix: '3d render, soft studio lighting, smooth materials, octane render',
    negative: 'lowres, blurry, deformed, flat',
  },
];

export const PROMPT_ENHANCER_SYSTEM =
  'You are a prompt writer for Stable Diffusion 1.5 / 2.1 (CLIP text encoder, 77-token limit). ' +
  "Turn the user's request (any language) into ONE English image prompt of at most 45 words. " +
  'Structure: main subject with 2-3 concrete visual details (pose, clothing, expression, colors), ' +
  'then setting/background, then lighting and mood, then camera angle or composition. ' +
  'Rules: describe exactly ONE main subject unless the user asks for more; do not copy the user\'s ' +
  'wording, rephrase it with fresh, specific details; invent a distinct composition each time ' +
  '(vary angle, time of day, palette); no negations, no style or quality words like "masterpiece" ' +
  '(the style is added separately); no text in the image. ' +
  'Output ONLY the prompt as comma-separated phrases, no quotes, no explanations.\n\n' +
  'Examples:\n' +
  'User: кошка на подоконнике\n' +
  'Prompt: a fluffy ginger cat curled up on a wooden windowsill, rainy window behind it, ' +
  'warm lamp glow, cozy evening, low side-angle view\n' +
  'User: дракон над городом\n' +
  'Prompt: a huge green dragon with spread wings soaring above a medieval city at sunset, ' +
  'orange clouds, tiny rooftops below, dramatic wide aerial view\n' +
  'User: девушка-самурай\n' +
  'Prompt: a young female samurai in red and black armor holding a katana, standing in a bamboo ' +
  'forest, misty morning light, calm fierce expression, medium shot from slightly below';

/** Допустимая длина ответа улучшателя (иначе берём исходный запрос). */
export const ENHANCER_MAX_CHARS = 420;

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
  sdSampler: string;
  sdScheduler: string;
  sdStyle: string;
  sdSeed: string; // пусто = случайный
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
  sdSampler: 'euler',
  sdScheduler: 'discrete',
  sdStyle: 'digital',
  sdSeed: '',
};
