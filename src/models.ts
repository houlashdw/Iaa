import * as FS from 'expo-file-system/legacy';
import { DEFAULT_SETTINGS, Settings } from './config';

export const MODELS_DIR = `${FS.documentDirectory}models/`;
const STATE_FILE = `${FS.documentDirectory}state.json`;

export type ModelFile = { name: string; uri: string; size: number };

export type SavedState = {
  modelFile: string | null;
  mmprojFile: string | null;
  settings: Settings;
};

export function fileNameFromUrl(url: string): string {
  const clean = url.split('?')[0].split('#')[0];
  const last = clean.split('/').pop() || 'model.gguf';
  return decodeURIComponent(last);
}

export function formatBytes(n: number): string {
  if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toFixed(2)} ГБ`;
  if (n >= 1024 ** 2) return `${(n / 1024 ** 2).toFixed(0)} МБ`;
  return `${Math.round(n / 1024)} КБ`;
}

async function ensureDir(): Promise<void> {
  const info = await FS.getInfoAsync(MODELS_DIR);
  if (!info.exists) await FS.makeDirectoryAsync(MODELS_DIR, { intermediates: true });
}

export async function listModelFiles(): Promise<ModelFile[]> {
  await ensureDir();
  const names = await FS.readDirectoryAsync(MODELS_DIR);
  const out: ModelFile[] = [];
  for (const name of names) {
    if (!name.toLowerCase().endsWith('.gguf')) continue;
    const uri = MODELS_DIR + name;
    const info = await FS.getInfoAsync(uri);
    if (info.exists && !info.isDirectory) out.push({ name, uri, size: info.size });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

export async function deleteModelFile(name: string): Promise<void> {
  await FS.deleteAsync(MODELS_DIR + name, { idempotent: true });
}

export async function freeSpace(): Promise<number> {
  return FS.getFreeDiskStorageAsync();
}

export type DownloadHandle = { cancel: () => Promise<void> };

async function remoteSize(url: string): Promise<number | null> {
  try {
    const r = await fetch(url, { method: 'HEAD' });
    const n = Number(r.headers.get('content-length'));
    return isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

async function partSize(path: string): Promise<number> {
  const i = await FS.getInfoAsync(path);
  return i.exists && !i.isDirectory ? i.size : 0;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Скачивает файл во временный .part и после успеха переименовывает.
 * Если файл уже есть, ничего не качает. Обрыв сети или «Отмена» не стирают
 * .part: повторный запуск продолжает с того же места (HTTP Range).
 */
export async function downloadModelFile(
  url: string,
  onProgress: (written: number, total: number) => void,
  onHandle: (h: DownloadHandle) => void,
): Promise<string> {
  await ensureDir();
  const name = fileNameFromUrl(url);
  const dest = MODELS_DIR + name;
  const existing = await FS.getInfoAsync(dest);
  if (existing.exists) return name;

  const tmp = `${dest}.part`;
  const total = await remoteSize(url);
  let have = await partSize(tmp);
  if (total) {
    if (have > total) {
      await FS.deleteAsync(tmp, { idempotent: true });
      have = 0;
    }
    const free = await FS.getFreeDiskStorageAsync();
    if (free < total - have + 200 * 1024 * 1024) {
      throw new Error(
        `Не хватает места: нужно ещё ${formatBytes(total - have)}, свободно ${formatBytes(free)}.`,
      );
    }
  }

  let cancelled = false;
  let current: FS.DownloadResumable | null = null;
  onHandle({
    cancel: async () => {
      cancelled = true;
      await current?.cancelAsync();
    },
  });

  const MAX_TRIES = 6;
  let lastError: unknown = null;
  for (let attempt = 0; attempt < MAX_TRIES && !cancelled; attempt++) {
    const offset = await partSize(tmp);
    if (total && offset === total) break; // уже докачано
    current = FS.createDownloadResumable(
      url,
      tmp,
      {},
      (p) => onProgress(p.totalBytesWritten, p.totalBytesExpectedToWrite),
      offset > 0 ? String(offset) : undefined,
    );
    try {
      const res = await current.downloadAsync();
      if (cancelled || !res) break;
      if (offset > 0 && res.status === 200) {
        // сервер проигнорировал Range и прислал файл целиком: начинаем заново
        await FS.deleteAsync(tmp, { idempotent: true });
        continue;
      }
      if (res.status < 200 || res.status >= 300) {
        await FS.deleteAsync(tmp, { idempotent: true });
        throw new Error(`Сервер ответил ${res.status}. Проверь ссылку.`);
      }
      lastError = null;
      break;
    } catch (e) {
      if (cancelled) break;
      lastError = e;
      await sleep(2000 * (attempt + 1));
    }
  }

  if (cancelled) {
    throw new Error('Загрузка приостановлена. Нажми «Скачать» ещё раз, чтобы продолжить.');
  }
  if (lastError) {
    throw new Error(
      `Загрузка прервалась (${String((lastError as any)?.message ?? lastError)}). ` +
        'Нажми «Скачать» ещё раз: докачка продолжится с того же места.',
    );
  }
  const done = await partSize(tmp);
  if (total && done !== total) {
    throw new Error('Файл скачался не полностью. Нажми «Скачать» ещё раз, чтобы докачать.');
  }
  await FS.moveAsync({ from: tmp, to: dest });
  return name;
}

/** Копирует выбранный через системный диалог файл в папку моделей. */
export async function importPickedFile(srcUri: string, name: string): Promise<string> {
  await ensureDir();
  const safe = name.toLowerCase().endsWith('.gguf') ? name : `${name}.gguf`;
  const dest = MODELS_DIR + safe;
  await FS.deleteAsync(dest, { idempotent: true });
  await FS.moveAsync({ from: srcUri, to: dest }).catch(async () => {
    await FS.copyAsync({ from: srcUri, to: dest });
  });
  return safe;
}

export async function loadState(): Promise<SavedState> {
  try {
    const raw = await FS.readAsStringAsync(STATE_FILE);
    const j = JSON.parse(raw) as Partial<SavedState>;
    return {
      modelFile: j.modelFile ?? null,
      mmprojFile: j.mmprojFile ?? null,
      settings: { ...DEFAULT_SETTINGS, ...(j.settings ?? {}) },
    };
  } catch {
    return { modelFile: null, mmprojFile: null, settings: DEFAULT_SETTINGS };
  }
}

export async function saveState(s: SavedState): Promise<void> {
  try {
    await FS.writeAsStringAsync(STATE_FILE, JSON.stringify(s));
  } catch {
    // не критично
  }
}
