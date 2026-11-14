import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { DEFAULT_SETTINGS, Settings } from './src/config';
import { unloadModel } from './src/engine';
import { ModelFile, listModelFiles, loadState, saveState } from './src/models';
import SetupScreen from './src/SetupScreen';
import ChatScreen from './src/ChatScreen';
import { C } from './src/theme';

function Root() {
  const insets = useSafeAreaInsets();
  const [screen, setScreen] = useState<'boot' | 'setup' | 'chat'>('boot');
  const [files, setFiles] = useState<ModelFile[]>([]);
  const [modelFile, setModelFile] = useState<string | null>(null);
  const [mmprojFile, setMmprojFile] = useState<string | null>(null);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    setFiles(await listModelFiles());
  }, []);

  useEffect(() => {
    (async () => {
      const st = await loadState();
      setModelFile(st.modelFile);
      setMmprojFile(st.mmprojFile);
      setSettings(st.settings);
      await refresh();
      setLoaded(true);
      setScreen('setup');
    })();
  }, [refresh]);

  useEffect(() => {
    if (loaded) saveState({ modelFile, mmprojFile, settings });
  }, [loaded, modelFile, mmprojFile, settings]);

  const model = files.find((f) => f.name === modelFile);
  const proj = files.find((f) => f.name === mmprojFile);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: C.bg,
        paddingTop: insets.top,
        paddingBottom: insets.bottom,
      }}
    >
      <StatusBar style="light" />
      {screen === 'boot' ? (
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <ActivityIndicator color={C.accent} />
        </View>
      ) : screen === 'setup' ? (
        <SetupScreen
          files={files}
          modelFile={modelFile}
          mmprojFile={mmprojFile}
          setModelFile={setModelFile}
          setMmprojFile={setMmprojFile}
          refresh={refresh}
          onStart={() => setScreen('chat')}
        />
      ) : model && proj ? (
        <ChatScreen
          modelUri={model.uri}
          mmprojUri={proj.uri}
          modelName={model.name}
          settings={settings}
          onSettingsChange={setSettings}
          onBack={async () => {
            await unloadModel();
            setScreen('setup');
          }}
        />
      ) : null}
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <Root />
    </SafeAreaProvider>
  );
}
