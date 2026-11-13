import React from 'react';
import '../styles/AuthorWindow.css';
import { FiX } from 'react-icons/fi';

const LINKS = [
  { label: 'Boosty', url: 'https://boosty.to/dimandus' },
  { label: 'DonationAlerts', url: 'https://www.donationalerts.com/r/dimandus' },
  { label: 'Telegram', url: 'https://t.me/dimandus' },
  { label: 'ВКонтакте', url: 'http://vk.com/dimandus' },
];

function AuthorWindow({ isOpen, onClose }) {
  if (!isOpen) return null;

  const openLink = async (url) => {
    const result = await window.electronAPI.openExternalUrl(url);
    if (result?.success === false && result?.error) {
      console.warn(result.error);
    }
  };

  return (
    <div className="author-overlay" onClick={onClose}>
      <div className="author-window" onClick={(e) => e.stopPropagation()}>
        <div className="author-header">
          <h2>Dimandus</h2>
          <button type="button" className="close-btn" onClick={onClose} aria-label="Закрыть">
            <FiX size={20} />
          </button>
        </div>
        <div className="author-body">
          <p>
            Рад, что вы пользуетесь ботом. Пользуйтесь на здоровье — ничего не жалко. Если захотите
            написать, предложить идею или просто поддержать — буду рад.
          </p>
          <ul className="author-links">
            {LINKS.map((item) => (
              <li key={item.url}>
                <button type="button" className="author-link" onClick={() => openLink(item.url)}>
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export default AuthorWindow;
