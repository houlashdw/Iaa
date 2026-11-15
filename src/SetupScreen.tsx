import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { PRESETS, SD_PRESETS, SdProfile } from './config';
import {
  DownloadHandle,
  ModelFile,
  deleteModelFile,
  downloadModelFile,
  fileNameFromUrl,
  formatBytes,
  freeSpace,
  importPickedFile,
} from './models';
import { C, S } from './theme';

type Props = {
  files: ModelFile[];
  modelFile: string | null;
  mmprojFile: string | null;
  sdFile: string | null;
  setModelFile: (n: string | null) => void;
  setMmprojFile: (n: string | null) => void;
  setSdFile: (n: string | null) => void;
  refresh: () => Promise<void>;
  applySdProfile: (p: SdProfile) => void;
  onStart: () => void;
};

type Job = { kind: 'model' | 'mmproj' | 'sd'; url: string; profile?: SdProfile };

const looksLikeSd = (n: string) => /(^|[-_.])(sd|sdxl|sdxs|stable|turbo|diffusion|flux)/i.test(n);

export default function SetupScreen(p: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ w: number; t: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [customModel, setCustomModel] = useState('');
  const [customMmproj, setCustomMmproj] = useState('');
  const [free, setFree] = useState<number | null>(null);
  const handle = useRef<DownloadHandle | null>(null);
  const lastTick = useRef(0);

  React.useEffect(() => {
    freeSpace().then(setFree).catch(() => setFree(null));
  }, [p.files, busy]);

  const runJobs = useCallback(
    async (jobs: Job[]) => {
      setError(null);
      await activateKeepAwakeAsync('dl');
      try {
        for (let i = 0; i < jobs.length; i++) {
          const j = jobs[i];
          setBusy(`Скачиваю ${i + 1}/${jobs.length}: ${fileNameFromUrl(j.url)}`);
          setProgress({ w: 0, t: 0 });
          const name = await downloadModelFile(
            j.url,
            (w, t) => {
              const now = Date.now();
              if (now - lastTick.current > 500) {
                lastTick.current = now;
                setProgress({ w, t });
              }
            },
            (h) => {
              handle.current = h;
            },
          );
          if (j.kind === 'model') p.setModelFile(name);
          else if (j.kind === 'sd') {
            p.setSdFile(name);
            if (j.profile) p.applySdProfile(j.profile);
          }
          else p.setMmprojFile(name);
        }
        await p.refresh();
      } catch (e: any) {
        setError(String(e?.message ?? e));
      } finally {
        handle.current = null;
        setBusy(null);
        setProgress(null);
        deactivateKeepAwake('dl');
      }
    },
    [p],
  );

  const pickFile = async () => {
    setError(null);
    try {
      const r = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });
      if (r.canceled || !r.assets?.[0]) return;
      const a = r.assets[0];
      setBusy(`Копирую файл: ${a.name}`);
      const name = await importPickedFile(a.uri, a.name);
      if (name.toLowerCase().includes('mmproj')) p.setMmprojFile(name);
      else if (looksLikeSd(name)) p.setSdFile(name);
      else p.setModelFile(name);
      await p.refresh();
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setBusy(null);
    }
  };

  const remove = (f: ModelFile) =>
    Alert.alert('Удалить файл?', f.name, [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: async () => {
          await deleteModelFile(f.name);
          if (p.modelFile === f.name) p.setModelFile(null);
          if (p.mmprojFile === f.name) p.setMmprojFile(null);
          if (p.sdFile === f.name) p.setSdFile(null);
          await p.refresh();
        },
      },
    ]);

  const have = (n: string | null) => !!n && p.files.some((f) => f.name === n);
  const ready = have(p.modelFile) && have(p.mmprojFile);
  const pct = progress && progress.t > 0 ? progress.w / progress.t : 0;

  return (
    <ScrollView
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={S.h1}>Vision Chat</Text>
      <Text style={[S.dim, { marginTop: 4 }]}>
        Локальная модель с поддержкой изображений. Всё работает на телефоне, без интернета
        (интернет нужен только чтобы скачать модель).
        {free != null ? ` Свободно: ${formatBytes(free)}.` : ''}
      </Text>

      <View style={S.card}>
        <Text style={S.h2}>1. Скачать модель</Text>
        {PRESETS.map((pr) => (
          <View key={pr.id} style={{ marginBottom: 12 }}>
            <Text style={S.text}>{pr.title}</Text>
            <Text style={S.dim}>{pr.note}</Text>
            <Pressable
              disabled={!!busy}
              onPress={() =>
                runJobs([
                  { kind: 'model', url: pr.modelUrl },
                  { kind: 'mmproj', url: pr.mmprojUrl },
                ])
              }
              style={[S.btn2, { marginTop: 8 }, busy ? S.disabled : null]}
            >
              <Text style={S.btn2Text}>Скачать (модель + зрение)</Text>
            </Pressable>
          </View>
        ))}

        {SD_PRESETS.map((sp) => (
          <View key={sp.id} style={{ marginBottom: 12 }}>
            <Text style={S.text}>🎨 {sp.title}</Text>
            <Text style={S.dim}>{sp.note}</Text>
            <Pressable
              disabled={!!busy}
              onPress={() => runJobs([{ kind: 'sd', url: sp.url, profile: sp.profile }])}
              style={[S.btn2, { marginTop: 8 }, busy ? S.disabled : null]}
            >
              <Text style={S.btn2Text}>Скачать художника (необязательно)</Text>
            </Pressable>
          </View>
        ))}

        <Text style={[S.dim, { marginTop: 4 }]}>Или свои ссылки на .gguf (Hugging Face):</Text>
        <TextInput
          style={[S.input, { marginTop: 6 }]}
          placeholder="Ссылка на файл модели .gguf"
          placeholderTextColor={C.dim}
          value={customModel}
          onChangeText={setCustomModel}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TextInput
          style={[S.input, { marginTop: 6 }]}
          placeholder="Ссылка на mmproj .gguf"
          placeholderTextColor={C.dim}
          value={customMmproj}
          onChangeText={setCustomMmproj}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Pressable
          disabled={!!busy || (!customModel.trim() && !customMmproj.trim())}
          onPress={() => {
            const jobs: Job[] = [];
            if (customModel.trim()) jobs.push({ kind: 'model', url: customModel.trim() });
            if (customMmproj.trim()) jobs.push({ kind: 'mmproj', url: customMmproj.trim() });
            runJobs(jobs);
          }}
          style={[
            S.btn2,
            { marginTop: 8 },
            busy || (!customModel.trim() && !customMmproj.trim()) ? S.disabled : null,
          ]}
        >
          <Text style={S.btn2Text}>Скачать по ссылкам</Text>
        </Pressable>

        <Pressable
          disabled={!!busy}
          onPress={pickFile}
          style={[S.btn2, { marginTop: 8 }, busy ? S.disabled : null]}
        >
          <Text style={S.btn2Text}>Выбрать .gguf из памяти телефона</Text>
        </Pressable>

        {busy ? (
          <View style={{ marginTop: 14 }}>
            <View style={S.row}>
              <ActivityIndicator color={C.accent} />
              <Text style={[S.dim, { marginLeft: 10, flex: 1 }]}>{busy}</Text>
            </View>
            {progress && progress.t > 0 ? (
              <>
                <View
                  style={{
                    height: 8,
                    backgroundColor: C.card2,
                    borderRadius: 4,
                    marginTop: 8,
                    overflow: 'hidden',
                  }}
                >
                  <View
                    style={{ height: 8, width: `${Math.round(pct * 100)}%`, backgroundColor: C.accent }}
                  />
                </View>
                <Text style={[S.dim, { marginTop: 4 }]}>
                  {formatBytes(progress.w)} из {formatBytes(progress.t)} ({Math.round(pct * 100)}%).
                  Не закрывай приложение.
                </Text>
              </>
            ) : null}
            {handle.current ? (
              <Pressable
                onPress={() => handle.current?.cancel()}
                style={[S.btn2, { marginTop: 8 }]}
              >
                <Text style={[S.btn2Text, { color: C.danger }]}>Пауза (продолжить можно позже)</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
        {error ? <Text style={[S.text, { color: C.danger, marginTop: 10 }]}>{error}</Text> : null}
      </View>

      <View style={S.card}>
        <Text style={S.h2}>2. Файлы на телефоне</Text>
        {p.files.length === 0 ? (
          <Text style={S.dim}>Пока пусто. Скачай модель выше.</Text>
        ) : (
          p.files.map((f) => {
            const isModel = p.modelFile === f.name;
            const isProj = p.mmprojFile === f.name;
            const isSd = p.sdFile === f.name;
            return (
              <View key={f.name} style={{ marginBottom: 12 }}>
                <Text style={S.text} numberOfLines={2}>
                  {f.name}
                </Text>
                <Text style={S.dim}>{formatBytes(f.size)}</Text>
                <View style={[S.row, { marginTop: 6, flexWrap: 'wrap' }]}>
                  <Pressable
                    onPress={() => p.setModelFile(f.name)}
                    style={[S.btn2, { marginRight: 8 }, isModel ? { borderColor: C.accent } : null]}
                  >
                    <Text style={[S.btn2Text, isModel ? { color: C.accent } : null]}>
                      {isModel ? '✓ Модель' : 'Это модель'}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => p.setMmprojFile(f.name)}
                    style={[S.btn2, { marginRight: 8 }, isProj ? { borderColor: C.accent } : null]}
                  >
                    <Text style={[S.btn2Text, isProj ? { color: C.accent } : null]}>
                      {isProj ? '✓ mmproj' : 'Это mmproj'}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => p.setSdFile(f.name)}
                    style={[S.btn2, { marginRight: 8 }, isSd ? { borderColor: C.accent } : null]}
                  >
                    <Text style={[S.btn2Text, isSd ? { color: C.accent } : null]}>
                      {isSd ? '✓ Рисует' : 'Это художник'}
                    </Text>
                  </Pressable>
                  <Pressable onPress={() => remove(f)} style={S.btn2}>
                    <Text style={[S.btn2Text, { color: C.danger }]}>Удалить</Text>
                  </Pressable>
                </View>
              </View>
            );
          })
        )}
      </View>

      <Pressable
        disabled={!ready || !!busy}
        onPress={p.onStart}
        style={[S.btn, { marginTop: 16 }, !ready || busy ? S.disabled : null]}
      >
        <Text style={S.btnText}>Запустить чат</Text>
      </Pressable>
      {!ready ? (
        <Text style={[S.dim, { marginTop: 8 }]}>
          Нужны оба файла: модель и mmproj (он отвечает за зрение). Художник (рисование) необязателен.
        </Text>
      ) : null}
    </ScrollView>
  );
}
