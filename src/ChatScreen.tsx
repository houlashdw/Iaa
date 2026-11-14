import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { SaveFormat, manipulateAsync } from 'expo-image-manipulator';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import * as FS from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { PROMPT_ENHANCER_SYSTEM, Settings } from './config';
import {
  ChatMsg,
  ensureLoaded,
  generate,
  loadModel,
  stopGeneration,
  unloadModel,
} from './engine';
import { cancelDrawing, drawImage, releaseDrawer } from './sd';
import SettingsModal from './SettingsModal';
import { C, S } from './theme';

type Props = {
  modelUri: string;
  mmprojUri: string;
  sdUri: string | null;
  modelName: string;
  settings: Settings;
  onSettingsChange: (s: Settings) => void;
  onBack: () => void;
};

const MAX_SIDE = 1024;
const MAX_IMAGES = 4;
let counter = 0;
const uid = () => `${Date.now()}-${counter++}`;

async function prepareImage(asset: ImagePicker.ImagePickerAsset): Promise<string> {
  const { width, height } = asset;
  const big = Math.max(width, height) > MAX_SIDE;
  const actions = big
    ? [{ resize: width >= height ? { width: MAX_SIDE } : { height: MAX_SIDE } }]
    : [];
  const r = await manipulateAsync(asset.uri, actions, {
    compress: 0.85,
    format: SaveFormat.JPEG,
  });
  return r.uri;
}

export default function ChatScreen(p: Props) {
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading');
  const [loadError, setLoadError] = useState('');
  const [visionOk, setVisionOk] = useState(true);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [drawMode, setDrawMode] = useState(false);
  const [enhance, setEnhance] = useState(true);
  const [drawing, setDrawing] = useState(false);
  const [status, setStatus] = useState('Думаю… (с картинкой первый ответ может идти до минуты)');
  const [slow, setSlow] = useState<string | null>(null);
  const listRef = useRef<FlatList<ChatMsg>>(null);

  const load = useCallback(
    async (s: Settings) => {
      setPhase('loading');
      setLoadError('');
      try {
        const r = await loadModel(p.modelUri, p.mmprojUri, s);
        setVisionOk(r.vision);
        setPhase('ready');
      } catch (e: any) {
        setLoadError(String(e?.message ?? e));
        setPhase('error');
      }
    },
    [p.modelUri, p.mmprojUri],
  );

  useEffect(() => {
    load(p.settings);
    // загружаем один раз при открытии экрана
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addImages = async (assets: ImagePicker.ImagePickerAsset[]) => {
    try {
      const room = MAX_IMAGES - pending.length;
      const uris: string[] = [];
      for (const a of assets.slice(0, Math.max(room, 0))) uris.push(await prepareImage(a));
      setPending((cur) => [...cur, ...uris]);
    } catch (e: any) {
      Alert.alert('Не удалось обработать картинку', String(e?.message ?? e));
    }
  };

  const pickGallery = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: MAX_IMAGES,
      quality: 1,
    });
    if (!r.canceled) await addImages(r.assets);
  };

  const pickCamera = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Нет доступа к камере', 'Разреши камеру в настройках приложения.');
      return;
    }
    const r = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 });
    if (!r.canceled) await addImages(r.assets);
  };

  const patchFor = (id: string) => (fn: (m: ChatMsg) => ChatMsg) =>
    setMessages((cur) => cur.map((m) => (m.id === id ? fn(m) : m)));

  const send = async () => {
    const text = input.trim();
    if (generating || phase !== 'ready') return;
    if (drawMode) {
      if (text) await draw(text);
      return;
    }
    if (!text && pending.length === 0) return;
    const userMsg: ChatMsg = { id: uid(), role: 'user', text, images: pending };
    const asst: ChatMsg = { id: uid(), role: 'assistant', text: '', images: [] };
    const history = [...messages, userMsg];
    setMessages([...history, asst]);
    setInput('');
    setPending([]);
    setGenerating(true);
    setSlow(null);
    setStatus('Думаю… (с картинкой первый ответ может идти до минуты)');
    await activateKeepAwakeAsync('gen');
    const patch = patchFor(asst.id);
    try {
      setStatus('Загружаю модель…');
      await ensureLoaded();
      setStatus('Думаю… (с картинкой первый ответ может идти до минуты)');
      let tFirst = 0;
      const r = await generate(history, p.settings, (acc, count) => {
        const now = Date.now();
        if (count === 1) tFirst = now;
        let stats: string | undefined;
        if (count >= 4 && now > tFirst) {
          const rate = (count - 1) / ((now - tFirst) / 1000);
          stats = `${rate.toFixed(1)} ток/с…`;
          if (count >= 10 && rate < 1) {
            setSlow(
              `Очень медленно (${rate.toFixed(1)} ток/с). Скорее всего, модели не хватает свободной памяти. ` +
                'Закрой другие приложения или выбери модель 4B.',
            );
          } else if (rate >= 1) {
            setSlow(null);
          }
        }
        patch((m) => ({ ...m, text: acc, stats }));
      });
      patch((m) => ({ ...m, text: r.text || m.text, stats: r.stats }));
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      const hint = /context|ctx|n_ctx|kv/i.test(msg)
        ? '\nКонтекст заполнен. Начни новый чат или увеличь размер контекста в настройках.'
        : '';
      patch((m) => ({ ...m, text: `⚠️ ${msg}${hint}` }));
    } finally {
      setGenerating(false);
      deactivateKeepAwake('gen');
    }
  };

  const draw = async (request: string) => {
    const userMsg: ChatMsg = { id: uid(), role: 'user', text: request, images: [] };
    const asst: ChatMsg = { id: uid(), role: 'assistant', text: '', images: [] };
    setMessages((cur) => [...cur, userMsg, asst]);
    setInput('');
    setGenerating(true);
    setDrawing(true);
    setSlow(null);
    await activateKeepAwakeAsync('gen');
    const patch = patchFor(asst.id);
    try {
      let prompt = request;
      if (enhance) {
        setStatus('Модель пишет промпт для художника…');
        await ensureLoaded();
        const r = await generate(
          [{ id: 'enh', role: 'user', text: request, images: [] }],
          {
            ...p.settings,
            systemPrompt: PROMPT_ENHANCER_SYSTEM,
            maxNewTokens: 160,
            temperature: 0.8,
          },
          () => {},
        );
        const cleaned = r.text.replace(/^["'\s]+|["'\s]+$/g, '');
        if (cleaned) prompt = cleaned;
      }
      patch((m) => ({ ...m, text: `🎨 ${prompt}` }));
      setStatus('Освобождаю память…');
      await unloadModel();
      setStatus('Загружаю художника…');
      const out = `${FS.cacheDirectory}gen-${Date.now()}.png`;
      await drawImage({
        modelUri: p.sdUri as string,
        prompt,
        negative: p.settings.sdNegative,
        size: p.settings.sdSize,
        steps: p.settings.sdSteps,
        cfg: p.settings.sdCfg,
        threads: p.settings.nThreads,
        outUri: out,
        onProgress: (step, steps) => setStatus(`Рисую: шаг ${step} из ${steps}…`),
      });
      patch((m) => ({ ...m, text: `🎨 ${prompt}`, images: [out], generated: true }));
    } catch (e: any) {
      patch((m) => ({ ...m, text: `⚠️ ${String(e?.message ?? e)}` }));
    } finally {
      await releaseDrawer(); // отдаём память обратно под чат
      setDrawing(false);
      setGenerating(false);
      deactivateKeepAwake('gen');
    }
  };

  const toggleDraw = () => {
    if (!p.sdUri) {
      Alert.alert(
        'Нет модели-художника',
        'Вернись на экран «Модели», скачай художника (SD-Turbo) и отметь его.',
      );
      return;
    }
    setDrawMode((v) => !v);
  };

  const shareImage = async (uri: string) => {
    try {
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'image/png' });
      }
    } catch (e: any) {
      Alert.alert('Не удалось поделиться', String(e?.message ?? e));
    }
  };

  const newChat = () => {
    if (generating) return;
    setMessages([]);
    setPending([]);
  };

  const renderItem = ({ item }: { item: ChatMsg }) => {
    const mine = item.role === 'user';
    const waiting = !mine && generating && (!item.text || (drawing && item.images.length === 0));
    return (
      <View
        style={{
          alignSelf: mine ? 'flex-end' : 'flex-start',
          maxWidth: '88%',
          backgroundColor: mine ? C.user : C.card,
          borderRadius: 14,
          padding: 10,
          marginVertical: 5,
          borderWidth: 1,
          borderColor: C.border,
        }}
      >
        {item.images.length > 0 ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 6 }}>
            {item.images.map((u) => (
              <Pressable key={u} onPress={() => item.generated && shareImage(u)}>
                <Image
                  source={{ uri: u }}
                  style={
                    item.generated
                      ? { width: 260, height: 260, borderRadius: 10, marginBottom: 6 }
                      : { width: 110, height: 110, borderRadius: 8, marginRight: 6, marginBottom: 6 }
                  }
                />
              </Pressable>
            ))}
          </View>
        ) : null}
        {waiting && item.text ? <Text style={[S.text, { marginBottom: 6 }]} selectable>{item.text}</Text> : null}
        {waiting ? (
          <View style={S.row}>
            <ActivityIndicator color={C.accent} />
            <Text style={[S.dim, { marginLeft: 8, flexShrink: 1 }]}>{status}</Text>
          </View>
        ) : (
          <Text style={S.text} selectable>
            {item.text}
          </Text>
        )}
        {item.generated ? (
          <Text style={[S.dim, { fontSize: 11 }]}>Нажми на картинку, чтобы сохранить или поделиться</Text>
        ) : null}
        {item.stats ? <Text style={[S.dim, { marginTop: 4, fontSize: 11 }]}>{item.stats}</Text> : null}
      </View>
    );
  };

  return (
    <KeyboardAvoidingView style={S.fill} behavior="padding">
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          padding: 10,
          borderBottomWidth: 1,
          borderBottomColor: C.border,
        }}
      >
        <Pressable onPress={p.onBack} style={[S.btn2, { paddingVertical: 6 }]}>
          <Text style={S.btn2Text}>‹ Модели</Text>
        </Pressable>
        <Text style={[S.dim, { flex: 1, marginHorizontal: 10 }]} numberOfLines={1}>
          {p.modelName}
        </Text>
        <Pressable onPress={newChat} style={[S.btn2, { paddingVertical: 6, marginRight: 6 }]}>
          <Text style={S.btn2Text}>Новый</Text>
        </Pressable>
        <Pressable
          onPress={() => setShowSettings(true)}
          style={[S.btn2, { paddingVertical: 6 }]}
        >
          <Text style={S.btn2Text}>⚙</Text>
        </Pressable>
      </View>

      {phase === 'loading' ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <ActivityIndicator size="large" color={C.accent} />
          <Text style={[S.text, { marginTop: 14, textAlign: 'center' }]}>Загружаю модель…</Text>
          <Text style={[S.dim, { marginTop: 6, textAlign: 'center' }]}>
            Первый запуск может занять до минуты.
          </Text>
        </View>
      ) : phase === 'error' ? (
        <View style={{ flex: 1, padding: 24, justifyContent: 'center' }}>
          <Text style={[S.text, { color: C.danger }]}>Не удалось запустить модель</Text>
          <Text style={[S.dim, { marginTop: 8 }]}>{loadError}</Text>
          <Pressable style={[S.btn, { marginTop: 16 }]} onPress={() => load(p.settings)}>
            <Text style={S.btnText}>Попробовать снова</Text>
          </Pressable>
          <Text style={[S.dim, { marginTop: 12 }]}>
            Если не хватает памяти: закрой другие приложения, выбери модель 4B или уменьши размер
            контекста в настройках.
          </Text>
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 12, flexGrow: 1 }}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
              <Text style={[S.dim, { textAlign: 'center' }]}>
                Напиши сообщение или прикрепи картинку.
                {visionOk ? '' : '\n⚠️ Зрение не активно: проверь mmproj.'}
              </Text>
            </View>
          }
        />
      )}

      {phase === 'ready' ? (
        <View style={{ borderTopWidth: 1, borderTopColor: C.border, padding: 8 }}>
          {slow ? <Text style={[S.dim, { color: C.danger, marginBottom: 6 }]}>{slow}</Text> : null}
          {drawMode ? (
            <Pressable onPress={() => setEnhance((v) => !v)} style={{ marginBottom: 6 }}>
              <Text style={S.dim}>
                🎨 Режим рисования ({p.settings.sdSize}px, {p.settings.sdSteps} шагов). Модель
                пишет промпт за тебя: {enhance ? 'ВКЛ' : 'ВЫКЛ'} (нажми, чтобы переключить).
                Если выключено, пиши описание по-английски.
              </Text>
            </Pressable>
          ) : null}
          {pending.length > 0 ? (
            <View style={{ flexDirection: 'row', marginBottom: 6 }}>
              {pending.map((u) => (
                <Pressable
                  key={u}
                  onPress={() => setPending((cur) => cur.filter((x) => x !== u))}
                  style={{ marginRight: 6 }}
                >
                  <Image source={{ uri: u }} style={{ width: 56, height: 56, borderRadius: 8 }} />
                  <Text
                    style={{
                      position: 'absolute',
                      right: 2,
                      top: 0,
                      color: '#fff',
                      fontWeight: '700',
                    }}
                  >
                    ✕
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
            <Pressable
              onPress={pickCamera}
              disabled={generating || drawMode}
              style={[S.btn2, { marginRight: 6 }, generating || drawMode ? S.disabled : null]}
            >
              <Text style={S.btn2Text}>📷</Text>
            </Pressable>
            <Pressable
              onPress={pickGallery}
              disabled={generating || drawMode}
              style={[S.btn2, { marginRight: 6 }, generating || drawMode ? S.disabled : null]}
            >
              <Text style={S.btn2Text}>🖼</Text>
            </Pressable>
            <Pressable
              onPress={toggleDraw}
              disabled={generating}
              style={[
                S.btn2,
                { marginRight: 6 },
                drawMode ? { borderColor: C.accent } : null,
                generating ? S.disabled : null,
              ]}
            >
              <Text style={S.btn2Text}>🎨</Text>
            </Pressable>
            <TextInput
              style={[S.input, { flex: 1, maxHeight: 120 }]}
              value={input}
              onChangeText={setInput}
              placeholder={drawMode ? 'Опиши картинку' : 'Сообщение'}
              placeholderTextColor={C.dim}
              multiline
            />
            {generating ? (
              <Pressable
                onPress={() => (drawing ? cancelDrawing() : stopGeneration())}
                style={[S.btn, { marginLeft: 6 }]}
              >
                <Text style={S.btnText}>■</Text>
              </Pressable>
            ) : (
              <Pressable onPress={send} style={[S.btn, { marginLeft: 6 }]}>
                <Text style={S.btnText}>➤</Text>
              </Pressable>
            )}
          </View>
        </View>
      ) : null}

      <SettingsModal
        key={showSettings ? 'open' : 'closed'}
        visible={showSettings}
        settings={p.settings}
        onClose={() => setShowSettings(false)}
        onSave={(ns) => {
          const reload =
            ns.nCtx !== p.settings.nCtx ||
            ns.nThreads !== p.settings.nThreads ||
            ns.imageMaxTokens !== p.settings.imageMaxTokens;
          p.onSettingsChange(ns);
          setShowSettings(false);
          if (reload) {
            setMessages([]);
            load(ns);
          }
        }}
      />
    </KeyboardAvoidingView>
  );
}
