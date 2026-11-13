import React, { useState, useEffect } from 'react';
import '../styles/ControlPanel.css';
import { FiPlay, FiSquare, FiLogIn, FiSettings, FiGrid, FiKey, FiBookOpen } from 'react-icons/fi';
import Toast from './Toast';

function ControlPanel({
  botStatus,
  config = {},
  onSettingsClick,
  onCardsClick,
  onAuthSettingsClick,
  onCollectionsClick,
  onHelpClick,
  onAuthorClick,
}) {
  const [loading, setLoading] = useState({});
  const [toast, setToast] = useState(null);
  const [appInfo, setAppInfo] = useState({ version: botStatus.appVersion || '—' });

  useEffect(() => {
    window.electronAPI.getAppInfo?.().then((info) => {
      if (info?.version) setAppInfo(info);
    });
  }, []);

  const run = async (key, action, onSuccess) => {
    setLoading((prev) => ({ ...prev, [key]: true }));
    try {
      const result = await action();
      if (result && result.success === false) {
        setToast({ message: result.error || 'Операция не удалась', type: 'error' });
        return result;
      }
      if (result?.chatError) {
        setToast({ message: 'Бот запущен, но чат: ' + result.chatError, type: 'error' });
      }
      if (result?.warnings?.length) {
        setToast({ message: result.warnings.join('; '), type: 'error' });
      }
      onSuccess?.(result);
      return result;
    } catch (e) {
      setToast({ message: e.message || 'Ошибка', type: 'error' });
      return { success: false };
    } finally {
      setLoading((prev) => ({ ...prev, [key]: false }));
    }
  };

  const channelDisplay = config?.channel ? `Канал: ${config.channel}` : 'Канал: не подключен';
  const gameCommand = config?.settings?.game?.commandName || '!карта';
  const gameOn = botStatus.gameEnabled ?? config?.settings?.game?.enabled;
  const gameLine = gameOn
    ? `Игра: ВКЛ (${gameCommand})`
    : 'Игра: ВЫКЛ (чат может быть подключён)';

  let chatLine = 'Чат: —';
  if (botStatus.chatReconnecting) {
    chatLine = 'Чат: переподключение…';
  } else if (botStatus.chatConnected) {
    chatLine = 'Чат: подключён';
  } else if (botStatus.isRunning) {
    chatLine = 'Чат: нет соединения';
  }

  return (
    <div className="control-panel">
      <div className="control-section">
        <h3 className="control-section-title">Бот</h3>
        <div className="controls-grid controls-grid--bot">
          <button
            className={`control-btn start-btn ${botStatus.isRunning ? 'active' : ''}`}
            onClick={() => run('start', () => window.electronAPI.startBot())}
            disabled={loading.start || botStatus.isRunning || !botStatus.isAuthorized}
            title={!botStatus.isAuthorized ? 'Авторизуйтесь для запуска бота' : ''}
          >
            <FiPlay size={32} />
            <span>СТАРТ</span>
          </button>

          <button
            className={`control-btn stop-btn ${!botStatus.isRunning ? 'disabled' : ''}`}
            onClick={() => run('stop', () => window.electronAPI.stopBot())}
            disabled={loading.stop || !botStatus.isRunning}
          >
            <FiSquare size={32} />
            <span>СТОП</span>
          </button>

          <button
            className={`control-btn auth-btn ${botStatus.isAuthorized ? 'connected' : ''}`}
            onClick={() => run('auth', () => window.electronAPI.authorizeTwitch(), (r) => {
              if (r?.success) setToast({ message: 'Авторизация успешна', type: 'success' });
            })}
            disabled={loading.auth}
          >
            <FiLogIn size={32} />
            <span>АВТОРИЗАЦИЯ</span>
            <span className="status-badge">
              {botStatus.isAuthorized ? 'подключено' : 'нет'}
            </span>
          </button>
        </div>
      </div>

      <div className="control-section">
        <h3 className="control-section-title">Контент</h3>
        <div className="controls-grid controls-grid--content">
          <button className="control-btn settings-btn" onClick={onSettingsClick}>
            <FiSettings size={28} />
            <span>НАСТРОЙКИ</span>
          </button>

          <button className="control-btn cards-btn" onClick={onCardsClick}>
            <FiGrid size={28} />
            <span>КАРТЫ</span>
          </button>

          <button className="control-btn cards-btn" onClick={onCollectionsClick}>
            <FiBookOpen size={28} />
            <span>КОЛЛЕКЦИИ</span>
          </button>

          <button className="control-btn settings-btn" onClick={onAuthSettingsClick}>
            <FiKey size={28} />
            <span>OAuth</span>
          </button>
        </div>
      </div>

      <div className="control-section control-section--inline">
        <button className="control-btn help-btn control-btn--compact" onClick={onHelpClick}>
          <span className="help-icon">?</span>
          <span>ПОМОЩЬ</span>
        </button>
      </div>

      <div className="status-bar">
        <span className={`status ${botStatus.isRunning ? 'running' : 'stopped'}`}>
          {botStatus.isRunning ? 'РАБОТАЕТ 🟢' : 'ОСТАНОВЛЕН 🔴'}
        </span>
        <span className="channel">{channelDisplay}</span>
        <span className="game">{gameLine}</span>
        <span className="game">{chatLine}</span>
        <span className="status-bar-end">
          <button type="button" className="author-teaser" onClick={onAuthorClick}>
            об авторе
          </button>
          <span className="app-version">v{appInfo.version}</span>
        </span>
      </div>

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  );
}

export default ControlPanel;
