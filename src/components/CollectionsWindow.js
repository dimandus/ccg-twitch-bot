import React, { useEffect, useState } from 'react';
import '../styles/SettingsWindow.css';
import { FiX } from 'react-icons/fi';
import Toast from './Toast';

function CollectionsWindow({ isOpen, onClose }) {
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  const loadRows = async (query = search) => {
    setLoading(true);
    try {
      const data = await window.electronAPI.getCollections(query);
      setRows(data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    loadRows('');
  }, [isOpen]);

  const openUser = async (userId) => {
    const detail = await window.electronAPI.getUserCollection(userId);
    if (detail.success) setSelected(detail);
  };

  if (!isOpen) return null;

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-window collections-window" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h2>📚 Коллекции зрителей</h2>
          <button className="close-btn" onClick={onClose}>
            <FiX size={24} />
          </button>
        </div>

        <div className="settings-content">
          <div className="setting-item">
            <input
              className="input-field"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск по нику"
            />
            <button className="btn btn-utility" onClick={() => loadRows(search)} style={{ marginTop: 8 }}>
              Найти
            </button>
          </div>

          {loading ? (
            <div className="settings-note">Загрузка...</div>
          ) : rows.length === 0 ? (
            <div className="settings-note">
              Данные появятся после дропов в чате. Показаны всего карт и сумма рангов (порядок редкостей из настроек).
            </div>
          ) : (
            <div className="collections-table">
              {rows.map((row) => (
                <button
                  key={row.userId}
                  className="collection-row"
                  onClick={() => openUser(row.userId)}
                >
                  <strong>{row.username}</strong>
                  <span>
                    карт: {row.totalCount} · сумма рангов: {row.rankSum}
                  </span>
                </button>
              ))}
            </div>
          )}

          <div className="setting-item" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-utility"
              disabled={!selected}
              onClick={async () => {
                if (!selected || !window.confirm(`Сбросить коллекцию ${selected.username}?`)) return;
                const result = await window.electronAPI.resetCollections({ userId: selected.userId });
                if (result?.success) {
                  setSelected(null);
                  loadRows(search);
                  setToast({ message: 'Коллекция зрителя сброшена', type: 'success' });
                } else {
                  setToast({ message: result?.error || 'Ошибка', type: 'error' });
                }
              }}
            >
              Сбросить зрителя
            </button>
            <button
              type="button"
              className="btn btn-utility"
              onClick={async () => {
                if (!window.confirm('Сбросить ВСЕ коллекции? Это необратимо.')) return;
                const result = await window.electronAPI.resetCollections({});
                if (result?.success) {
                  setSelected(null);
                  loadRows(search);
                  setToast({ message: 'Все коллекции сброшены', type: 'success' });
                } else {
                  setToast({ message: result?.error || 'Ошибка', type: 'error' });
                }
              }}
            >
              Сбросить всё
            </button>
          </div>

          {selected && (
            <div className="settings-section">
              <h3>{selected.username}</h3>
              <p className="settings-note">
                Всего карт: <strong>{selected.totalCount}</strong> (уникальных: {selected.uniqueCount}, дублей:{' '}
                {selected.duplicateCount})
              </p>
              <p className="settings-note">
                Сумма рангов: <strong>{selected.rankSum}</strong>
              </p>
              {selected.byRarity && Object.keys(selected.byRarity).length > 0 && (
                <>
                  <p className="settings-note">По редкостям:</p>
                  <ul className="collection-cards-list">
                    {Object.entries(selected.byRarity)
                      .sort((a, b) => b[1] - a[1])
                      .map(([rarity, count]) => (
                        <li key={rarity}>
                          {rarity}: {count}
                        </li>
                      ))}
                  </ul>
                </>
              )}
              {selected.cards?.length > 0 && (
                <>
                  <p className="settings-note">Все карты:</p>
                  <ul className="collection-cards-list collection-cards-list--scroll">
                    {selected.cards.map((card) => (
                      <li key={card.cardId}>
                        {card.name} ({card.rarity}){card.count > 1 ? ` ×${card.count}` : ''}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
        </div>
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </div>
    </div>
  );
}

export default CollectionsWindow;
