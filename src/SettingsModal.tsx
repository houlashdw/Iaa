import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { DEFAULT_SETTINGS, Settings } from './config';
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

export default function SettingsModal({ visible, settings, onClose, onSave }: Props) {
  const [sys, setSys] = useState(settings.systemPrompt);
  const [ctx, setCtx] = useState(String(settings.nCtx));
  const [thr, setThr] = useState(String(settings.nThreads));
  const [img, setImg] = useState(String(settings.imageMaxTokens));
  const [temp, setTemp] = useState(String(settings.temperature));
  const [maxNew, setMaxNew] = useState(String(settings.maxNewTokens));
  const [sdSteps, setSdSteps] = useState(String(settings.sdSteps));
  const [sdSize, setSdSize] = useState(String(settings.sdSize));
  const [sdCfg, setSdCfg] = useState(String(settings.sdCfg));
  const [sdNeg, setSdNeg] = useState(settings.sdNegative);

  const field = (label: string, hint: string, v: string, set: (s: string) => void) => (
    <View style={{ marginTop: 12 }}>
      <Text style={S.text}>{label}</Text>
      <Text style={S.dim}>{hint}</Text>
      <TextInput
        style={[S.input, { marginTop: 4 }]}
        value={v}
        onChangeText={set}
        keyboardType="decimal-pad"
      />
    </View>
  );

  const save = () => {
    onSave({
      systemPrompt: sys,
      nCtx: Math.round(num(ctx, DEFAULT_SETTINGS.nCtx, 1024, 16384)),
      nThreads: Math.round(num(thr, DEFAULT_SETTINGS.nThreads, 1, 8)),
      imageMaxTokens: Math.round(num(img, DEFAULT_SETTINGS.imageMaxTokens, 64, 2048)),
      temperature: num(temp, DEFAULT_SETTINGS.temperature, 0, 2),
      maxNewTokens: Math.round(num(maxNew, DEFAULT_SETTINGS.maxNewTokens, 16, 8192)),
      sdSteps: Math.round(num(sdSteps, DEFAULT_SETTINGS.sdSteps, 1, 50)),
      sdSize: Math.round(num(sdSize, DEFAULT_SETTINGS.sdSize, 256, 1024) / 64) * 64,
      sdCfg: num(sdCfg, DEFAULT_SETTINGS.sdCfg, 0, 15),
      sdNegative: sdNeg,
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
          'Для Dimensity 9400 лучше 4–6. Перезагрузка модели',
          thr,
          setThr,
        )}
        {field(
          'Макс. токенов на картинку',
          'Меньше = быстрее, но грубее детали (256–1024). Перезагрузка модели',
          img,
          setImg,
        )}
        <Text style={[S.h2, { marginTop: 24 }]}>Рисование</Text>
        {field('Размер картинки (px)', '256–1024, кратно 64. 512 = быстро, 768+ = очень долго', sdSize, setSdSize)}
        {field('Шаги', 'Для SD-Turbo 1–4. Больше шагов = дольше', sdSteps, setSdSteps)}
        {field('CFG (следование описанию)', 'Для SD-Turbo 1.0. Для обычных SD 1.5 — 6–8', sdCfg, setSdCfg)}
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
