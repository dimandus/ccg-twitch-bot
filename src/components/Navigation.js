import React from 'react';
import '../styles/Navigation.css';
import { FiHome, FiFileText, FiSettings, FiGrid } from 'react-icons/fi';

function Navigation({ currentPage, onNavClick }) {
  return (
    <nav className="navigation">
      <div className="nav-brand">
        <span className="nav-logo">🎮</span>
        <span className="nav-title">CCG Twitch Bot</span>
      </div>
      
      <div className="nav-links">
        <button
          className={`nav-link ${currentPage === 'home' ? 'active' : ''}`}
          onClick={() => onNavClick('home')}
        >
          <FiHome size={18} />
          <span>Главная</span>
        </button>

        <button
          className={`nav-link ${currentPage === 'logs' ? 'active' : ''}`}
          onClick={() => onNavClick('logs')}
        >
          <FiFileText size={18} />
          <span>Логи</span>
        </button>

        <button
          className={`nav-link ${currentPage === 'settings' ? 'active' : ''}`}
          onClick={() => onNavClick('settings')}
        >
          <FiSettings size={18} />
          <span>Настройки</span>
        </button>

        <button
          className={`nav-link ${currentPage === 'cards' ? 'active' : ''}`}
          onClick={() => onNavClick('cards')}
        >
          <FiGrid size={18} />
          <span>База карт</span>
        </button>
      </div>

      <div className="nav-status">
        <span className="status-dot online"></span>
        <span>Готов</span>
      </div>
    </nav>
  );
}

export default Navigation;
