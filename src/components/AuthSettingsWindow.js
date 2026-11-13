import React, { useEffect, useState } from 'react';
import '../styles/SettingsWindow.css';
import { FiX } from 'react-icons/fi';
import Toast from './Toast';

function AuthSettingsWindow({ isOpen, onClose, initialConfig }) {
  const [authMode, setAuthMode] = useState('dimandus');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [saving, setSaving] = useState(false);
  const [authorizing, setAuthorizing] = useState(false);
  const [toast, setToast] = useState(null);
  const redirectPort = initialConfig?.twitch?.redirectPort || 43781;

  useEffect(() => {
    if (!isOpen) return;
    setAuthMode(initialConfig?.twitch?.authMode || 'dimandus');
    setClientId(initialConfig?.twitch?.clientId || '');
    setClientSecret('');
  }, [initialConfig, isOpen]);

  if (!isOpen) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      const result = await window.electronAPI.saveAuthSettings({
        authMode,
        clientId,
        clientSecret,
      });
      if (!result.success) throw new Error(result.error || 'Ошибка сохранения');
      setToast({ message: 'Настройки авторизации сохранены', type: 'success' });
    } catch (e) {
      setToast({ message: e.message, type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleAuthorize = async () => {
    setAuthorizing(true);
    try {
      const saved = await window.electronAPI.saveAuthSettings({
        authMode,
        clientId,
        clientSecret,
      });
      if (!saved.success) throw new Error(saved.error || 'Не удалось сохранить настройки');
      const result =
        authMode === 'direct'
          ? await window.electronAPI.authorizeTwitchDirect()
          : await window.electronAPI.authorizeTwitch();
      if (!result.success) throw new Error(result.error || 'Авторизация не удалась');
      setToast({
        message: `Авторизован: ${result.username || 'канал подключён'}`,
        type: 'success',
      });
      setTimeout(onClose, 800);
    } catch (e) {
      setToast({ message: e.message, type: 'error' });
    } finally {
      setAuthorizing(false);
    }
  };

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-window" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h2>🔑 Резервная авторизация Twitch</h2>
          <button className="close-btn" onClick={onClose}>
            <FiX size={24} />
          </button>
        </div>

        <div className="settings-content">
          <div className="settings-section">
            <h3>Способ авторизации</h3>
            <label className="checkbox-label">
              <input
                type="radio"
                checked={authMode === 'dimandus'}
                onChange={() => setAuthMode('dimandus')}
              />
              <span>Через dimandus.ru (по умолчанию)</span>
            </label>
            <label className="checkbox-label">
              <input
                type="radio"
                checked={authMode === 'direct'}
                onChange={() => setAuthMode('direct')}
              />
              <span>Напрямую через Twitch (PKCE + свой Client ID)</span>
            </label>
          </div>

          <div className="settings-section">
            <h3>Twitch Application</h3>
            <div className="setting-item">
              <label htmlFor="auth-client-id">Client ID</label>
              <input
                id="auth-client-id"
                className="input-field"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="из dev.twitch.tv/console/apps"
              />
            </div>
            <div className="setting-item">
              <label htmlFor="auth-client-secret">Client Secret (необязательно для Public App)</label>
              <input
                id="auth-client-secret"
                type="password"
                className="input-field"
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                placeholder="оставьте пустым для PKCE public"
              />
            </div>
            <div className="settings-note">
              Для direct OAuth добавьте Redirect URI в Twitch Console:
              <br />
              <code>{`http://localhost:${redirectPort}`}</code>
              <br />
              Scopes: chat:read, chat:edit, channel:bot, user:write:chat
            </div>
          </div>
        </div>

        <div className="settings-footer">
          <button className="btn btn-cancel" onClick={onClose} disabled={saving || authorizing}>
            Закрыть
          </button>
          <button className="btn btn-save" onClick={handleSave} disabled={saving || authorizing}>
            {saving ? 'Сохранение...' : 'Сохранить'}
          </button>
          <button
            className="btn btn-save"
            onClick={handleAuthorize}
            disabled={saving || authorizing}
            style={{ background: '#9146ff' }}
          >
            {authorizing ? 'Авторизация...' : 'Авторизоваться'}
          </button>
        </div>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

export default AuthSettingsWindow;
