import React, { useState, useEffect } from 'react';
import '../styles/SettingsWindow.css';
import { FiX } from 'react-icons/fi';
import Toast from './Toast';

function RarityRenameTool({ rarities, setToast }) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const apply = async () => {
    const result = await window.electronAPI.applyRarityRename(from, to);
    if (result?.success) {
      setToast({
        message: result.updated ? `Обновлено карт: ${result.updated}` : 'Совпадений не найдено',
        type: result.updated ? 'success' : 'error',
      });
    } else {
      setToast({ message: result?.error || 'Ошибка', type: 'error' });
    }
  };

  return (
    <div className="setting-item">
      <label>Переименовать редкость на всех картах:</label>
      <div className="rarity-rename-row">
        <select className="input-field" value={from} onChange={(e) => setFrom(e.target.value)}>
          <option value="">Было…</option>
          {rarities.map((r) => (
            <option key={r.name} value={r.name}>
              {r.name}
            </option>
          ))}
        </select>
        <input
          type="text"
          className="input-field"
          placeholder="Стало…"
          value={to}
          onChange={(e) => setTo(e.target.value)}
        />
        <button type="button" className="btn btn-utility" onClick={apply} disabled={!from || !to.trim()}>
          Применить
        </button>
      </div>
    </div>
  );
}

function SettingsWindow({ isOpen, onClose, initialConfig }) {
  const [config, setConfig] = useState(initialConfig?.settings || {});
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (initialConfig?.settings) {
      let settings = { ...initialConfig.settings };
      
      // Инициализируем rarities если их нет
      if (!settings.game?.rarities || settings.game.rarities.length === 0) {
        settings = {
          ...settings,
          game: {
            ...settings.game,
            rarities: [
              { name: 'Common', weight: 50 },
              { name: 'Uncommon', weight: 30 },
              { name: 'Rare', weight: 15 },
              { name: 'Epic', weight: 4 },
              { name: 'Legendary', weight: 1 },
            ],
          },
        };
      }
      
      setConfig(settings);
    }
  }, [initialConfig, isOpen]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updatedConfig = {
        ...initialConfig,
        settings: config,
      };
      const result = await window.electronAPI.saveConfig(updatedConfig);
      if (!result?.success) {
        throw new Error(result?.error || 'Не удалось сохранить');
      }
      if (result.warnings?.length) {
        setToast({ message: result.warnings.join('; '), type: 'error' });
      } else {
        setToast({ message: 'Настройки сохранены!', type: 'success' });
      }
      setTimeout(() => {
        onClose();
      }, 800);
    } catch (e) {
      setToast({ message: 'Ошибка при сохранении: ' + e.message, type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    onClose();
  };

  const handleTestCard = async () => {
    try {
      // Получаем список карточек
      const cards = await window.electronAPI.getCardsList();
      if (!cards || cards.length === 0) {
        setToast({ message: '❌ Нет карточек в базе', type: 'error' });
        return;
      }

      // Выбираем случайную карточку
      const randomCard = cards[Math.floor(Math.random() * cards.length)];

      // Получаем base64 изображение
      let cardImage = '';
      if (randomCard.image) {
        try {
          // Нормализуем путь (заменяем обратные слэши на прямые)
          const normalizedPath = randomCard.image.replace(/\\/g, '/');
          console.log('📝 Пытаюсь загрузить изображение:', normalizedPath);
          const result = await window.electronAPI.getImageAsBase64(normalizedPath);
          
          if (result.success) {
            cardImage = result.dataUrl;
            console.log('✅ Изображение загружено, размер:', cardImage.length);
          } else {
            throw new Error(result.error);
          }
        } catch (e) {
          console.warn('⚠️ Ошибка загрузки изображения:', e);
          setToast({ message: `⚠️ Изображение не найдено: ${randomCard.image}. ${e.message}`, type: 'error' });
          return;
        }
      }

      // Отправляем карточку на оверлей
      const testCard = {
        username: 'TestUser',
        cardName: randomCard.name,
        cardColor: randomCard.color || '#667eea',
        cardImage: cardImage,
        rarity: randomCard.rarity
      };

      const overlayPort = config?.overlay?.port || 3001;
      const response = await fetch(`http://127.0.0.1:${overlayPort}/api/show-card`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testCard),
      });

      if (response.ok) {
        setToast({ message: `✅ Карточка "${randomCard.name}" отправлена на оверлей!`, type: 'success' });
      } else {
        setToast({ message: `❌ Ошибка: ${response.status} ${response.statusText}`, type: 'error' });
      }
    } catch (e) {
      console.error('❌ Ошибка:', e);
      setToast({ message: 'Ошибка при отправке тестовой карточки: ' + e.message, type: 'error' });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="settings-overlay" onClick={handleCancel}>
      <div className="settings-window" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h2>⚙️ НАСТРОЙКИ БОТА</h2>
          <button className="close-btn" onClick={handleCancel}>
            <FiX size={24} />
          </button>
        </div>

        <div className="settings-content">
          {/* Секция 1: Приветственное сообщение */}
          <div className="settings-section">
            <h3>📢 Приветственное сообщение</h3>
            <div className="setting-item">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={config.greeting?.enabled || false}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      greeting: {
                        ...config.greeting,
                        enabled: e.target.checked,
                      },
                    })
                  }
                />
                <span>Отправлять приветствие при старте бота</span>
              </label>
            </div>

            <div className="setting-item">
              <label htmlFor="greeting-message">Текст приветствия:</label>
              <textarea
                id="greeting-message"
                className="input-field textarea-field"
                value={config.greeting?.message || ''}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    greeting: {
                      ...config.greeting,
                      message: e.target.value,
                    },
                  })
                }
                disabled={!config.greeting?.enabled}
                placeholder="Введите приветственное сообщение..."
              />
            </div>
          </div>

          {/* Секция 2: Игра */}
          <div className="settings-section">
            <h3>🎴 Настройки игры (Карточки)</h3>

            <div className="setting-item">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={config.game?.enabled || false}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      game: {
                        ...config.game,
                        enabled: e.target.checked,
                      },
                    })
                  }
                />
                <span>Включить игру карточек</span>
              </label>
            </div>

            <div className="setting-item">
              <label htmlFor="game-command-name">Имя команды для вызова карточки:</label>
              <input
                id="game-command-name"
                type="text"
                className="input-field"
                value={config.game?.commandName || 'карта'}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    game: {
                      ...config.game,
                      commandName: e.target.value,
                    },
                  })
                }
                disabled={!config.game?.enabled}
                placeholder="Например: карта, draw и т.д."
              />
            </div>

            <div className="setting-item">
              <label htmlFor="game-cooldown">Кулдаун между карточками (секунды):</label>
              <input
                id="game-cooldown"
                type="number"
                className="input-field"
                value={config.game?.cooldownSeconds || 60}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    game: {
                      ...config.game,
                      cooldownSeconds: parseInt(e.target.value) || 60,
                    },
                  })
                }
                disabled={!config.game?.enabled}
                min="1"
                max="3600"
              />
            </div>

            <div className="setting-item">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={config.game?.collectionEnabled !== false}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      game: {
                        ...config.game,
                        collectionEnabled: e.target.checked,
                      },
                    })
                  }
                />
                <span>Включить команду коллекции для зрителей</span>
              </label>
            </div>

            <div className="setting-item">
              <label htmlFor="collection-command-name">Команда коллекции:</label>
              <input
                id="collection-command-name"
                type="text"
                className="input-field"
                value={config.game?.collectionCommandName || '!коллекция'}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    game: {
                      ...config.game,
                      collectionCommandName: e.target.value,
                    },
                  })
                }
              />
            </div>

            <div className="setting-item">
              <label htmlFor="collection-response-format">Формат ответа коллекции:</label>
              <textarea
                id="collection-response-format"
                className="input-field textarea-field"
                value={
                  config.game?.collectionResponseFormat ||
                  '@{username}, у вас {totalCount} карт, сумма рангов: {rankSum}'
                }
                onChange={(e) =>
                  setConfig({
                    ...config,
                    game: {
                      ...config.game,
                      collectionResponseFormat: e.target.value,
                    },
                  })
                }
              />
              <div className="settings-note">
                Короткий ответ в чат. Переменные: {'{username}'}, {'{totalCount}'}, {'{rankSum}'}, {'{uniqueCount}'}
              </div>
              <button
                type="button"
                className="btn btn-utility"
                style={{ marginTop: 8 }}
                onClick={() =>
                  setConfig({
                    ...config,
                    game: {
                      ...config.game,
                      collectionResponseFormat: '@{username}, у вас {totalCount} карт',
                    },
                  })
                }
              >
                Пресет: только число карт
              </button>
            </div>

            <div className="setting-item">
              <label htmlFor="game-response-format">Формат ответа на команду:</label>
              <textarea
                id="game-response-format"
                className="input-field textarea-field"
                value={config.game?.responseFormat || '@{username} 🎴 {cardName} ({rarity})'}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    game: {
                      ...config.game,
                      responseFormat: e.target.value,
                    },
                  })
                }
                disabled={!config.game?.enabled}
                placeholder="Пример: @{username} получил {cardName} ({rarity})"
              />
              <div className="settings-note">
                ℹ️ Доступные переменные: {'{username}'} - ник игрока, {'{cardName}'} - имя карты, {'{rarity}'} - редкость
              </div>
            </div>

            <div className="setting-item">
              <label>Редкости и их веса:</label>
              <div className="rarities-container">
                {Array.isArray(config.game?.rarities) && config.game.rarities.length > 0 && (
                  <>
                    {config.game.rarities.map((rarity, index) => {
                      const totalWeight = config.game.rarities.reduce((sum, r) => sum + (r.weight || 0), 0);
                      const percentage = totalWeight > 0 ? Math.round((rarity.weight / totalWeight) * 100 * 100) / 100 : 0;
                      
                      return (
                        <div key={index} className="rarity-item">
                          <input
                            type="text"
                            className="input-field rarity-name"
                            value={rarity.name || ''}
                            onChange={(e) => {
                              const newRarities = [...config.game.rarities];
                              newRarities[index].name = e.target.value;
                              setConfig({
                                ...config,
                                game: {
                                  ...config.game,
                                  rarities: newRarities,
                                },
                              });
                            }}
                            disabled={!config.game?.enabled}
                            placeholder="Название редкости"
                          />
                          
                          <input
                            type="number"
                            className="input-field rarity-weight"
                            value={rarity.weight || 0}
                            onChange={(e) => {
                              const newRarities = [...config.game.rarities];
                              newRarities[index].weight = Math.max(0, parseInt(e.target.value) || 0);
                              setConfig({
                                ...config,
                                game: {
                                  ...config.game,
                                  rarities: newRarities,
                                },
                              });
                            }}
                            disabled={!config.game?.enabled}
                            min="0"
                            placeholder="Вес"
                          />
                          
                          <div className="rarity-percent">
                            {percentage}%
                          </div>
                          
                          <button
                            className="btn-delete-rarity"
                            onClick={() => {
                              const newRarities = config.game.rarities.filter((_, i) => i !== index);
                              setConfig({
                                ...config,
                                game: {
                                  ...config.game,
                                  rarities: newRarities,
                                },
                              });
                            }}
                            disabled={!config.game?.enabled}
                            title="Удалить редкость"
                          >
                            ✕
                          </button>
                        </div>
                      );
                    })}
                  </>
                )}
                
                {(!Array.isArray(config.game?.rarities) || config.game.rarities.length === 0) && (
                  <div className="settings-note">
                    ℹ️ Нет редкостей. Добавьте первую редкость используя кнопку ниже.
                  </div>
                )}
                
                <button
                  className="btn-add-rarity"
                  onClick={() => {
                    const newRarities = [
                      ...(config.game?.rarities || []),
                      { name: 'Новая редкость', weight: 10 },
                    ];
                    setConfig({
                      ...config,
                      game: {
                        ...config.game,
                        rarities: newRarities,
                      },
                    });
                  }}
                  disabled={!config.game?.enabled}
                >
                  + Добавить редкость
                </button>
              </div>
            </div>
          </div>

          {/* Модерация */}
          <div className="settings-section">
            <h3>🛡️ Модерация (опционально)</h3>
            <div className="setting-item">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={config.moderation?.subsOnly || false}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      moderation: { ...config.moderation, subsOnly: e.target.checked },
                    })
                  }
                />
                <span>Только подписчики (сабы)</span>
              </label>
            </div>
            <div className="setting-item">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={config.moderation?.modsOnly || false}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      moderation: { ...config.moderation, modsOnly: e.target.checked },
                    })
                  }
                />
                <span>Только модераторы и стример</span>
              </label>
            </div>
            <div className="setting-item">
              <label htmlFor="blocked-ids">Игнор user id (через запятую):</label>
              <input
                id="blocked-ids"
                type="text"
                className="input-field"
                value={(config.moderation?.blockedUserIds || []).join(', ')}
                onChange={(e) => {
                  const ids = e.target.value
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean);
                  setConfig({
                    ...config,
                    moderation: { ...config.moderation, blockedUserIds: ids },
                  });
                }}
                placeholder="123456, 789012"
              />
            </div>
          </div>

          {/* Секция 3: Утилиты */}
          <div className="settings-section">
            <h3>🔧 Данные и бэкап</h3>

            <div className="setting-item">
              <button
                type="button"
                className="btn btn-utility"
                onClick={async () => {
                  try {
                    const result = await window.electronAPI.openDataDir();
                    if (result?.success) {
                      setToast({ message: 'Папка данных открыта', type: 'success' });
                    } else {
                      throw new Error(result?.error || 'Не удалось открыть');
                    }
                  } catch (e) {
                    setToast({ message: e.message, type: 'error' });
                  }
                }}
              >
                📂 Открыть папку данных
              </button>
            </div>

            <div className="setting-item">
              <button
                className="btn btn-utility"
                onClick={async () => {
                  try {
                    await window.electronAPI.openCardsDir();
                    setToast({ message: 'Папка открыта в проводнике', type: 'success' });
                  } catch (e) {
                    setToast({ message: 'Ошибка при открытии папки: ' + e.message, type: 'error' });
                  }
                }}
              >
                📁 Открыть папку с картинками
              </button>
            </div>

            <div className="setting-item" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-utility"
                onClick={async () => {
                  const result = await window.electronAPI.exportUserBackup();
                  if (result?.canceled) return;
                  if (result?.success) {
                    setToast({ message: 'Бэкап сохранён', type: 'success' });
                  } else {
                    setToast({ message: result?.error || 'Ошибка экспорта', type: 'error' });
                  }
                }}
              >
                💾 Экспорт бэкапа
              </button>
              <button
                type="button"
                className="btn btn-utility"
                onClick={async () => {
                  if (!window.confirm('Восстановить данные из файла? Токены не перезаписываются из бэкапа.')) return;
                  const result = await window.electronAPI.importUserBackup();
                  if (result?.canceled) return;
                  if (result?.success) {
                    setToast({ message: 'Данные восстановлены. Перезапустите бота при необходимости.', type: 'success' });
                  } else {
                    setToast({ message: result?.error || 'Ошибка импорта', type: 'error' });
                  }
                }}
              >
                📥 Импорт бэкапа
              </button>
            </div>

            <RarityRenameTool setToast={setToast} rarities={config.game?.rarities || []} />
          </div>

          {/* Секция 4: Оверлей */}
          <div className="settings-section">
            <h3>🎨 Настройки оверлея</h3>

            <div className="setting-item">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={config.overlay?.enabled || false}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      overlay: {
                        ...config.overlay,
                        enabled: e.target.checked,
                      },
                    })
                  }
                />
                <span>Включить оверлей</span>
              </label>
            </div>

            <div className="settings-note">
              ℹ️ Оверлей показывает карточку при выдаче в чате
            </div>

            <div className="setting-item">
              <label htmlFor="overlay-port">Порт оверлея</label>
              <input
                id="overlay-port"
                type="number"
                className="input-field"
                value={config.overlay?.port || 3001}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    overlay: {
                      ...config.overlay,
                      port: parseInt(e.target.value, 10) || 3001,
                      host: config.overlay?.host || '127.0.0.1',
                    },
                  })
                }
                min="1024"
                max="65535"
              />
              <div className="settings-note">После сохранения оверлей перезапустится на новом порту — обновите URL в OBS.</div>
            </div>

            <div className="setting-item">
              <label>URL для OBS Browser Source:</label>
              <div className="overlay-url-box">
                <code>{`http://127.0.0.1:${config.overlay?.port || 3001}`}</code>
                <button 
                  className="btn-copy-url"
                  onClick={() => {
                    const url = `http://127.0.0.1:${config.overlay?.port || 3001}`;
                    navigator.clipboard.writeText(url);
                    setToast({ message: 'URL скопирован в буфер обмена', type: 'success' });
                  }}
                  title="Скопировать в буфер обмена"
                >
                  📋 Копировать
                </button>
              </div>
            </div>

            <div className="setting-item">
              <button
                className="btn btn-utility"
                onClick={handleTestCard}
                style={{ background: '#667eea' }}
              >
                🧪 Показать тестовую карточку
              </button>
            </div>

            <div className="settings-note">
              📌 Инструкция:<br/>
              1. В OBS добавь новый источник: Sources → Browser<br/>
              2. Вставь URL выше<br/>
              3. Установи размер: 700x1080 пикселей (aspect ratio 225:350)<br/>
              4. Оверлей автоматически масштабируется при изменении размера источника<br/>
              5. Когда в чате используется команда для получения карточки, оверлей автоматически ее покажет!
            </div>
          </div>
        </div>

        <div className="settings-footer">
          <button
            className="btn btn-cancel"
            onClick={handleCancel}
            disabled={saving}
          >
            ОТМЕНА
          </button>
          <button
            className="btn btn-save"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'СОХРАНЕНИЕ...' : 'СОХРАНИТЬ'}
          </button>
        </div>
      </div>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
          autoClose={toast.type === 'success' ? 2000 : 3000}
        />
      )}
    </div>
  );
}

export default SettingsWindow;
