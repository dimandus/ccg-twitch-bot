import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import ActivityLog from './components/ActivityLog';
import ControlPanel from './components/ControlPanel';
import SettingsWindow from './components/SettingsWindow';
import CardsManager from './components/CardsManager';
import AuthSettingsWindow from './components/AuthSettingsWindow';
import CollectionsWindow from './components/CollectionsWindow';
import HelpWindow from './components/HelpWindow';
import AuthorWindow from './components/AuthorWindow';
import OnboardingWizard from './components/OnboardingWizard';

function App() {
  const [botStatus, setBotStatus] = useState({
    isRunning: false,
    isAuthorized: false,
    chatConnected: false,
    gameEnabled: false,
  });
  const [logs, setLogs] = useState([]);
  const [config, setConfig] = useState({ channel: null });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [cardsManagerOpen, setCardsManagerOpen] = useState(false);
  const [authSettingsOpen, setAuthSettingsOpen] = useState(false);
  const [collectionsOpen, setCollectionsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [authorOpen, setAuthorOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const hasInitialized = useRef(false);

  useEffect(() => {
    // Выполнить инициализацию только один раз
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    // Initialize
    window.electronAPI.getBotStatus().then((status) => {
      setBotStatus(status);
    });
    
    window.electronAPI.getLogs().then(setLogs);

    // Загрузить конфиг
    window.electronAPI.getConfig?.().then((cfg) => {
      setConfig(cfg);
      if (cfg?.onboarding?.completed === false) {
        setShowOnboarding(true);
      }
    });

    // Listen for updates
    window.electronAPI.onBotStatusChanged((status) => {
      setBotStatus(status);
      // Перезагружаем конфиг при изменении статуса (авторизация)
      window.electronAPI.getConfig?.().then((cfg) => {
        setConfig(cfg);
      });
    });
    
    window.electronAPI.onNewLog((message) => {
      setLogs((prev) => [...prev, message].slice(-100));
    });
    window.electronAPI.onLogsUpdated(setLogs);

    return () => {
      // Cleanup
    };
  }, []);

  return (
    <div className="app">
      <div className="main-content">
        <div className="home-page">
          <ActivityLog logs={logs} />
          <ControlPanel 
            botStatus={botStatus} 
            config={config}
            onSettingsClick={() => setSettingsOpen(true)}
            onCardsClick={() => setCardsManagerOpen(true)}
            onAuthSettingsClick={() => setAuthSettingsOpen(true)}
            onCollectionsClick={() => setCollectionsOpen(true)}
            onHelpClick={() => setHelpOpen(true)}
            onAuthorClick={() => setAuthorOpen(true)}
          />
        </div>
      </div>

      <SettingsWindow
        isOpen={settingsOpen}
        onClose={() => {
          setSettingsOpen(false);
          // Перезагружаем конфиг после закрытия окна
          window.electronAPI.getConfig?.().then((cfg) => {
            setConfig(cfg);
          });
        }}
        initialConfig={config}
      />

      <CardsManager
        isOpen={cardsManagerOpen}
        onClose={() => setCardsManagerOpen(false)}
      />

      <AuthSettingsWindow
        isOpen={authSettingsOpen}
        onClose={() => {
          setAuthSettingsOpen(false);
          window.electronAPI.getConfig?.().then(setConfig);
        }}
        initialConfig={config}
      />

      <CollectionsWindow isOpen={collectionsOpen} onClose={() => setCollectionsOpen(false)} />

      <HelpWindow isOpen={helpOpen} onClose={() => setHelpOpen(false)} />

      <AuthorWindow isOpen={authorOpen} onClose={() => setAuthorOpen(false)} />

      {showOnboarding && (
        <OnboardingWizard
          onDone={() => {
            setShowOnboarding(false);
            window.electronAPI.getConfig?.().then(setConfig);
          }}
        />
      )}
    </div>
  );
}

export default App;
