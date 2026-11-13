import React, { useState } from 'react';
import '../styles/SettingsWindow.css';
import Toast from './Toast';

const STEPS = [
  {
    title: 'Авторизация Twitch',
    body:
      'Нажмите «Авторизация» на главном экране. Если сервер dimandus недоступен — откройте окно OAuth и войдите через прямой Twitch PKCE.',
  },
  {
    title: 'База карточек',
    body:
      'Добавьте карты в «База карточек» или выполните npm run seed:cards для тестового набора. Без карт команда !карта не сработает.',
  },
  {
    title: 'OBS оверлей',
    body:
      'В настройках скопируйте URL Browser Source (http://127.0.0.1:порт). При смене порта оверлей перезапускается автоматически.',
  },
  {
    title: 'Старт в эфире',
    body:
      'Запустите бота, включите игру в настройках при необходимости и проверьте !карта в чате. Статус чата виден на панели управления.',
  },
];

function OnboardingWizard({ onDone }) {
  const [step, setStep] = useState(0);
  const [toast, setToast] = useState(null);
  const [finishing, setFinishing] = useState(false);

  const finish = async () => {
    setFinishing(true);
    try {
      const result = await window.electronAPI.completeOnboarding();
      if (!result?.success) throw new Error(result?.error || 'Не удалось сохранить');
      onDone?.();
    } catch (e) {
      setToast({ message: e.message, type: 'error' });
    } finally {
      setFinishing(false);
    }
  };

  const current = STEPS[step];

  return (
    <div className="onboarding-overlay">
      <div className="onboarding-card settings-window">
        <div className="settings-header">
          <h2>🚀 Первый запуск ({step + 1}/{STEPS.length})</h2>
        </div>
        <div className="settings-content">
          <h3>{current.title}</h3>
          <p className="settings-note">{current.body}</p>
        </div>
        <div className="onboarding-actions">
          {step > 0 && (
            <button type="button" className="btn btn-cancel" onClick={() => setStep(step - 1)}>
              Назад
            </button>
          )}
          {step < STEPS.length - 1 ? (
            <button type="button" className="btn btn-save" onClick={() => setStep(step + 1)}>
              Далее
            </button>
          ) : (
            <button type="button" className="btn btn-save" disabled={finishing} onClick={finish}>
              Готово
            </button>
          )}
          <button type="button" className="btn btn-utility" onClick={finish} disabled={finishing}>
            Пропустить
          </button>
        </div>
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </div>
    </div>
  );
}

export default OnboardingWizard;
