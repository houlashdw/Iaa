import { requireNativeModule } from 'expo';

type ProgressEvent = { step: number; steps: number };

type SdNativeType = {
  generate(opts: {
    model: string;
    prompt: string;
    negative: string;
    width: number;
    height: number;
    steps: number;
    cfg: number;
    seed: number;
    threads: number;
    out: string;
  }): Promise<string>;
  cancel(): void;
  release(): Promise<void>;
  addListener(
    name: 'onProgress',
    cb: (e: ProgressEvent) => void,
  ): { remove: () => void };
};

let native: SdNativeType | null = null;
function mod(): SdNativeType {
  if (!native) native = requireNativeModule<SdNativeType>('SdNative');
  return native;
}

export type DrawOptions = {
  modelUri: string;
  prompt: string;
  negative: string;
  size: number;
  steps: number;
  cfg: number;
  threads: number;
  outUri: string;
  onProgress?: (step: number, steps: number) => void;
};

const strip = (uri: string) => uri.replace(/^file:\/\//, '');

/** Рисует картинку и сохраняет PNG. Возвращает путь к файлу или бросает ошибку. */
export async function drawImage(o: DrawOptions): Promise<string> {
  const m = mod();
  const sub = o.onProgress
    ? m.addListener('onProgress', (e) => o.onProgress?.(e.step, e.steps))
    : null;
  try {
    const err = await m.generate({
      model: strip(o.modelUri),
      prompt: o.prompt,
      negative: o.negative,
      width: o.size,
      height: o.size,
      steps: o.steps,
      cfg: o.cfg,
      seed: -1,
      threads: o.threads,
      out: strip(o.outUri),
    });
    if (err) throw new Error(err);
    return o.outUri;
  } finally {
    sub?.remove();
  }
}

export function cancelDrawing(): void {
  try {
    mod().cancel();
  } catch {
    // игнорируем
  }
}

export async function releaseDrawer(): Promise<void> {
  try {
    await mod().release();
  } catch {
    // игнорируем
  }
}
