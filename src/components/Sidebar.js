import React from 'react';
import '../styles/Sidebar.css';
import { FiHome, FiFileText, FiSettings, FiGrid } from 'react-icons/fi';

function Sidebar({ currentPage, onNavClick }) {
  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <div className="logo">🎮</div>
        <div className="logo-text">CCG Bot</div>
      </div>

      <nav className="sidebar-nav">
        <div
          className={`nav-item ${currentPage === 'home' ? 'active' : ''}`}
          onClick={() => onNavClick('home')}
        >
          <FiHome className="nav-icon" />
          <span>Главная</span>
        </div>

        <div
          className={`nav-item ${currentPage === 'logs' ? 'active' : ''}`}
          onClick={() => onNavClick('logs')}
        >
          <FiFileText className="nav-icon" />
          <span>Логи</span>
        </div>

        <div
          className={`nav-item ${currentPage === 'settings' ? 'active' : ''}`}
          onClick={() => onNavClick('settings')}
        >
          <FiSettings className="nav-icon" />
          <span>Настройки</span>
        </div>

        <div
          className={`nav-item ${currentPage === 'cards' ? 'active' : ''}`}
          onClick={() => onNavClick('cards')}
        >
          <FiGrid className="nav-icon" />
          <span>База карт</span>
        </div>
      </nav>

      <div className="sidebar-footer">
        <div className="status-indicator">
          <span className="status-dot online"></span>
          <span className="status-text">Статус: РАБОТАЕТ</span>
        </div>
      </div>
    </div>
  );
}

export default Sidebar;
