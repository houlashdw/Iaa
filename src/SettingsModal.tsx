import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { DEFAULT_SETTINGS, SD_PRESETS, Settings } from './config';
import { C, S } from './theme';

type Props = {
  visible: boolean;
  settings: Settings;
  onClose: () => void;
  onSave: (s: Settings) => void;
};

function num(v: string, fallback: number, min: number, max: number): number {
  const n = Number(v.replace(',', '.'));
  if (!isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function Toggle(p: { label: string; hint: string; on: boolean; set: (v: boolean) => void }) {
  return (
    <View style={{ marginTop: 12 }}>
      <Text style={S.text}>{p.label}</Text>
      <Text style={S.dim}>{p.hint}</Text>
      <Pressable
        style={[S.btn2, { marginTop: 4, alignSelf: 'flex-start' }, p.on ? { borderColor: C.accent } : null]}
        onPress={() => p.set(!p.on)}
      >
        <Text style={[S.btn2Text, p.on ? { color: C.accent } : null]}>{p.on ? 'Включено' : 'Выключено'}</Text>
      </Pressable>
    </View>
  );
}

export default function SettingsModal({ visible, settings, onClose, onSave }: Props) {
  const [sys, setSys] = useState(settings.systemPrompt);
  const [ctx, setCtx] = useState(String(settings.nCtx));
  const [thr, setThr] = useState(String(settings.nThreads));
  const [img, setImg] = useState(String(settings.imageMaxTokens));
  const [ubatch, setUbatch] = useState(String(settings.nUbatch));
  const [flash, setFlash] = useState(settings.flashAttn);
  const [lazy, setLazy] = useState(settings.lazyVision);
  const [keepLlm, setKeepLlm] = useState<Settings['keepLlmDrawing']>(settings.keepLlmDrawing);
  const [temp, setTemp] = useState(String(settings.temperature));
  const [maxNew, setMaxNew] = useState(String(settings.maxNewTokens));
  const [sdSteps, setSdSteps] = useState(String(settings.sdSteps));
  const [sdSize, setSdSize] = useState(String(settings.sdSize));
  const [sdCfg, setSdCfg] = useState(String(settings.sdCfg));
  const [sdNeg, setSdNeg] = useState(settings.sdNegative);
  const [sdSampler, setSdSampler] = useState(settings.sdSampler);
  const [sdSched, setSdSched] = useState(settings.sdScheduler);
  const [sdSeed, setSdSeed] = useState(settings.sdSeed ?? '');

  const field = (
    label: string,
    hint: string,
    v: string,
    set: (s: string) => void,
    textual = false,
  ) => (
    <View style={{ marginTop: 12 }}>
      <Text style={S.text}>{label}</Text>
      <Text style={S.dim}>{hint}</Text>
      <TextInput
        style={[S.input, { marginTop: 4 }]}
        value={v}
        onChangeText={set}
        keyboardType={textual ? 'default' : 'decimal-pad'}
        autoCapitalize="none"
      />
    </View>
  );

  const save = () => {
    onSave({
      systemPrompt: sys,
      nCtx: Math.round(num(ctx, DEFAULT_SETTINGS.nCtx, 1024, 16384)),
      nThreads: Math.round(num(thr, DEFAULT_SETTINGS.nThreads, 1, 8)),
      imageMaxTokens: Math.round(num(img, DEFAULT_SETTINGS.imageMaxTokens, 64, 2048)),
      nUbatch: Math.round(num(ubatch, DEFAULT_SETTINGS.nUbatch, 64, 2048) / 64) * 64,
      flashAttn: flash,
      lazyVision: lazy,
      keepLlmDrawing: keepLlm,
      temperature: num(temp, DEFAULT_SETTINGS.temperature, 0, 2),
      maxNewTokens: Math.round(num(maxNew, DEFAULT_SETTINGS.maxNewTokens, 16, 8192)),
      sdSteps: Math.round(num(sdSteps, DEFAULT_SETTINGS.sdSteps, 1, 50)),
      sdSize: Math.round(num(sdSize, DEFAULT_SETTINGS.sdSize, 256, 1024) / 64) * 64,
      sdCfg: num(sdCfg, DEFAULT_SETTINGS.sdCfg, 0, 15),
      sdNegative: sdNeg,
      sdSampler: sdSampler.trim() || 'auto',
      sdScheduler: sdSched.trim() || 'auto',
      sdStyle: settings.sdStyle,
      sdSeed: /^\d+$/.test(sdSeed.trim()) ? sdSeed.trim() : '',
    });
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <ScrollView
        style={{ flex: 1, backgroundColor: C.bg }}
        contentContainerStyle={{ padding: 16, paddingTop: 48, paddingBottom: 48 }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={S.h1}>Настройки</Text>
        <Text style={[S.text, { marginTop: 14 }]}>Системный промпт</Text>
        <TextInput
          style={[S.input, { marginTop: 4, minHeight: 90, textAlignVertical: 'top' }]}
          value={sys}
          onChangeText={setSys}
          multiline
        />
        {field('Температура', '0 = строго, 1 = творчески', temp, setTemp)}
        {field('Макс. длина ответа (токены)', 'Чем больше, тем дольше ждать', maxNew, setMaxNew)}
        {field(
          'Размер контекста',
          'Память чата. Применится с перезагрузкой модели (1024–16384)',
          ctx,
          setCtx,
        )}
        {field(
          'Потоки процессора',
          'Для Dimensity 9400 оптимально 4 (X925 + 3×X4); больше 4 подключает медленные ядра A720. Перезагрузка модели',
          thr,
          setThr,
        )}
        {field(
          'Макс. токенов на картинку',
          'Меньше = быстрее читает картинку, но грубее детали. 256–384 быстро, 512+ медленно (64–2048). Перезагрузка модели',
          img,
          setImg,
        )}
        {field(
          'Батч обработки промпта (n_ubatch)',
          'Токенов за один проход при чтении промпта. 512 — стандарт; 256–1024 можно пробовать. Перезагрузка модели',
          ubatch,
          setUbatch,
        )}
        <Toggle
          label="Flash attention"
          hint="Обычно ускоряет чтение длинного промпта и экономит память. Если ответы стали медленнее, выключи. Перезагрузка модели"
          on={flash}
          set={setFlash}
        />
        <Toggle
          label="Грузить зрение только при первой картинке"
          hint="Текстовый чат стартует быстрее и занимает меньше памяти. Перезагрузка модели"
          on={lazy}
          set={setLazy}
        />
        <Text style={[S.h2, { marginTop: 24 }]}>Рисование</Text>
        <Text style={[S.text, { marginTop: 12 }]}>Держать модель в памяти при рисовании</Text>
        <Text style={S.dim}>
          Быстрее: не нужно выгружать и заново читать модель. Авто = только для 1–4B; 8B лучше
          выгружать, иначе не хватит памяти.
        </Text>
        <View style={{ flexDirection: 'row', marginTop: 6 }}>
          {(['auto', 'on', 'off'] as const).map((k) => (
            <Pressable
              key={k}
              style={[S.btn2, { marginRight: 8 }, keepLlm === k ? { borderColor: C.accent } : null]}
              onPress={() => setKeepLlm(k)}
            >
              <Text style={[S.btn2Text, keepLlm === k ? { color: C.accent } : null]}>
                {k === 'auto' ? 'Авто' : k === 'on' ? 'Да' : 'Нет'}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text style={S.dim}>Быстрая настройка под модель-художник:</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 6 }}>
          {SD_PRESETS.map((pr) => (
            <Pressable
              key={pr.id}
              style={[S.btn2, { marginRight: 8, marginBottom: 8 }]}
              onPress={() => {
                setSdSteps(String(pr.profile.steps));
                setSdSize(String(pr.profile.size));
                setSdCfg(String(pr.profile.cfg));
                setSdSampler(pr.profile.sampler);
                setSdSched(pr.profile.scheduler);
              }}
            >
              <Text style={S.btn2Text}>{pr.title.split(':')[0]}</Text>
            </Pressable>
          ))}
        </View>
        {field('Сэмплер', 'auto, lcm, euler_a, euler, dpm++2m. Для LCM-модели ставь lcm', sdSampler, setSdSampler, true)}
        {field('Планировщик', 'auto или lcm, karras, discrete…', sdSched, setSdSched, true)}
        {field('Размер картинки (px)', 'Качество: рекомендуется 512 (384–640). Кратно 64; больше = дольше и хуже композиция', sdSize, setSdSize)}
        {Number(sdSize.replace(',', '.')) > 640 ? (
          <Text style={{ color: C.accent, marginTop: 6 }}>
            Внимание: SD 1.5 обучена на 512px. На больших размерах композиция ломается
            (двойные объекты, повторы). Лучше 512, максимум 576–640.
          </Text>
        ) : null}
        {field('Шаги', 'Для SD-Turbo 1–4. Больше шагов = дольше', sdSteps, setSdSteps)}
        {field('CFG (следование описанию)', 'Для SD-Turbo 1.0. Для обычных SD 1.5 — 6–8', sdCfg, setSdCfg)}
        {field('Seed (пусто = случайный)', 'Число для повторяемости. «Ещё вариант» всегда берёт новый случайный', sdSeed, setSdSeed)}
        <Text style={[S.text, { marginTop: 12 }]}>Негативный промпт</Text>
        <TextInput
          style={[S.input, { marginTop: 4, minHeight: 60, textAlignVertical: 'top' }]}
          value={sdNeg}
          onChangeText={setSdNeg}
          multiline
        />
        <Pressable style={[S.btn, { marginTop: 20 }]} onPress={save}>
          <Text style={S.btnText}>Сохранить</Text>
        </Pressable>
        <Pressable style={[S.btn2, { marginTop: 10 }]} onPress={onClose}>
          <Text style={S.btn2Text}>Закрыть без сохранения</Text>
        </Pressable>
      </ScrollView>
    </Modal>
  );
}
