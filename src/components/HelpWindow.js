import React from 'react';
import '../styles/SettingsWindow.css';
import { FiX } from 'react-icons/fi';

function HelpWindow({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-window" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h2>❓ Быстрая помощь</h2>
          <button className="close-btn" onClick={onClose}>
            <FiX size={24} />
          </button>
        </div>
        <div className="settings-content">
          <div className="settings-section">
            <ol>
              <li>Авторизуйтесь (кнопка на панели или резервное OAuth-окно).</li>
              <li>Добавьте карты и проверьте, что редкости совпадают с настройками.</li>
              <li>В OBS: Browser Source → URL из настроек оверлея.</li>
              <li>Нажмите «Старт бота». Чат подключается даже если игра выключена.</li>
              <li>
                Зрители: <code>!карта</code> — дроп; <code>!коллекция</code> — в чате только число карт и сумма рангов.
                Полная коллекция — в «КОЛЛЕКЦИИ» у стримера.
              </li>
            </ol>
            <p className="settings-note">
              Подробнее: README.md, QUICK_START_OVERLAY.md, TROUBLESHOOTING.md
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default HelpWindow;
