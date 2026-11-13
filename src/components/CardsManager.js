import React, { useState, useEffect } from 'react';
import '../styles/CardsManager.css';
import { FiX, FiEdit2, FiTrash2, FiPlus } from 'react-icons/fi';
import Toast from './Toast';
import CardImage from './CardImage';

function CardsManager({ isOpen, onClose }) {
  const [cards, setCards] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRarity, setSelectedRarity] = useState('');
  const [editingCard, setEditingCard] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [rarities, setRarities] = useState([]);
  const [cardsDir, setCardsDir] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [visibleCount, setVisibleCount] = useState(48);

  const [formData, setFormData] = useState({
    id: null,
    name: '',
    color: '#FF6B35',
    image: '',
    rarity: '',
  });

  // Загружаем карточки при открытии
  useEffect(() => {
    if (isOpen) {
      loadCardsDir();
      loadCards();
      loadRarities();
    }
  }, [isOpen]);

  useEffect(() => {
    setVisibleCount(48);
  }, [searchTerm, selectedRarity, sortBy, cards.length]);

  const loadCardsDir = async () => {
    try {
      const dir = await window.electronAPI.getCardsDir();
      setCardsDir(dir);
    } catch (e) {
      console.error('Ошибка получения пути Cards:', e);
    }
  };

  const loadCards = async () => {
    try {
      const cardsList = await window.electronAPI.getCardsList();
      setCards(cardsList || []);
    } catch (e) {
      setToast({ message: 'Ошибка загрузки карточек: ' + e.message, type: 'error' });
    }
  };

  const loadRarities = async () => {
    try {
      const config = await window.electronAPI.getConfig?.();
      const rarityList = config?.settings?.game?.rarities || [];
      setRarities(rarityList.map(r => r.name));
    } catch (e) {
      console.error('Ошибка загрузки редкостей:', e);
    }
  };

  const getImageUrl = async (imagePath) => {
    if (!imagePath) return null;
    
    // Если это уже file:// URL, возвращаем как есть
    if (imagePath.startsWith('file://')) return imagePath;
    
    // Если это внешний URL, возвращаем как есть
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) return imagePath;
    
    // Если это относительный путь (Cards/...), конвертируем в абсолютный
    if (imagePath.startsWith('Cards/')) {
      try {
        const cardsDir = await window.electronAPI.getCardsDir();
        const fileName = imagePath.replace('Cards/', '');
        const absolutePath = cardsDir + '\\' + fileName;
        return 'file:///' + absolutePath.replace(/\\/g, '/');
      } catch (e) {
        console.error('Ошибка получения пути:', e);
        return null;
      }
    }
    
    return imagePath;
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64Data = event.target?.result;
        const timestamp = Date.now();
        const ext = file.name.split('.').pop() || 'png';
        const filename = `card_${timestamp}.${ext}`;

        const result = await window.electronAPI.saveCardImage(filename, base64Data);
        if (result.success) {
          setFormData({ ...formData, image: result.relativePath });
          setToast({ message: 'Изображение загружено', type: 'success' });
        } else {
          setToast({ message: 'Ошибка загрузки: ' + result.error, type: 'error' });
        }
      };
      reader.readAsDataURL(file);
    } catch (e) {
      setToast({ message: 'Ошибка: ' + e.message, type: 'error' });
    }
  };

  const handleSelectImageFile = async () => {
    try {
      const result = await window.electronAPI.openFileDialog();
      if (!result.canceled && result.filePaths && result.filePaths.length > 0) {
        const filePath = result.filePaths[0];
        const cardsDir = await window.electronAPI.getCardsDir();
        
        // Проверяем, находится ли файл уже в папке Cards
        const isInCardsDir = filePath.toLowerCase().startsWith(cardsDir.toLowerCase());
        
        const timestamp = Date.now();
        const ext = filePath.split('.').pop() || 'png';
        const newFilename = `card_${timestamp}.${ext}`;
        
        if (isInCardsDir) {
          // Файл уже в папке Cards - просто переименовываем
          const moveResult = await window.electronAPI.moveImageFile(filePath, newFilename);
          if (moveResult.success) {
            setFormData({ ...formData, image: moveResult.relativePath });
            setToast({ message: 'Изображение переименовано', type: 'success' });
          } else {
            setToast({ message: 'Ошибка переименования: ' + moveResult.error, type: 'error' });
          }
        } else {
          // Файл из другой папки - копируем с новым именем
          const readResult = await window.electronAPI.readImageFile(filePath);
          if (!readResult.success) {
            setToast({ message: 'Ошибка чтения файла: ' + readResult.error, type: 'error' });
            return;
          }

          const saveResult = await window.electronAPI.saveCardImage(newFilename, readResult.base64Data);
          if (saveResult.success) {
            setFormData({ ...formData, image: saveResult.relativePath });
            setToast({ message: 'Изображение загружено', type: 'success' });
          } else {
            setToast({ message: 'Ошибка загрузки: ' + saveResult.error, type: 'error' });
          }
        }
      }
    } catch (e) {
      setToast({ message: 'Ошибка: ' + e.message, type: 'error' });
    }
  };

  const filteredCards = cards.filter(card => {
    const matchesSearch = card.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (card.id && card.id.toString().includes(searchTerm));
    const matchesRarity = !selectedRarity || card.rarity === selectedRarity;
    return matchesSearch && matchesRarity;
  });

  const sortedCards = [...filteredCards].sort((a, b) => {
    if (sortBy === 'id') return (a.id || 0) - (b.id || 0);
    if (sortBy === 'rarity') return (a.rarity || '').localeCompare(b.rarity || '', 'ru');
    return (a.name || '').localeCompare(b.name || '', 'ru');
  });

  const visibleCards = sortedCards.slice(0, visibleCount);

  const handleAddCard = () => {
    setFormData({
      id: cards.length > 0 ? Math.max(...cards.map(c => c.id || 0)) + 1 : 1,
      name: '',
      color: '#FF6B35',
      image: '',
      rarity: rarities[0] || '',
    });
    setEditingCard(null);
    setShowForm(true);
  };

  const handleEditCard = (card) => {
    setFormData({ ...card });
    setEditingCard(card.id);
    setShowForm(true);
  };

  const handleDeleteCard = async (cardId) => {
    if (!window.confirm('Удалить эту карточку?')) return;

    const newCards = cards.filter(c => c.id !== cardId);
    setSaving(true);
    try {
      await window.electronAPI.saveCardsList(newCards);
      setCards(newCards);
      setToast({ message: 'Карточка удалена', type: 'success' });
    } catch (e) {
      setToast({ message: 'Ошибка удаления: ' + e.message, type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveCard = async () => {
    if (!formData.name.trim()) {
      setToast({ message: 'Введите имя карточки', type: 'error' });
      return;
    }
    if (!formData.rarity) {
      setToast({ message: 'Выберите редкость', type: 'error' });
      return;
    }

    setSaving(true);
    try {
      let imagePath = formData.image;
      if (typeof imagePath === 'string' && imagePath.startsWith('https://')) {
        const filename = `card_${formData.id || Date.now()}_${Date.now()}.png`;
        const cached = await window.electronAPI.saveCardImage(filename, imagePath);
        if (!cached.success) {
          setToast({ message: 'Не удалось скачать картинку: ' + cached.error, type: 'error' });
          setSaving(false);
          return;
        }
        imagePath = cached.relativePath;
      }

      const payload = { ...formData, image: imagePath };
      let newCards;
      if (editingCard) {
        newCards = cards.map(c => c.id === editingCard ? payload : c);
      } else {
        newCards = [...cards, payload];
      }

      const result = await window.electronAPI.saveCardsList(newCards);
      setCards(newCards);
      setShowForm(false);
      if (result?.warnings?.length) {
        setToast({ message: result.warnings.join('; '), type: 'error' });
      } else {
        setToast({
          message: editingCard ? 'Карточка обновлена' : 'Карточка добавлена',
          type: 'success',
        });
      }
    } catch (e) {
      setToast({ message: 'Ошибка сохранения: ' + e.message, type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="cards-manager-overlay" onClick={handleCancel}>
      <div className="cards-manager-window" onClick={(e) => e.stopPropagation()}>
        <div className="cards-manager-header">
          <h2>🎴 БАЗА КАРТОЧЕК</h2>
          <button className="close-btn" onClick={handleCancel}>
            <FiX size={24} />
          </button>
        </div>

        {!showForm ? (
          <div className="cards-manager-body">
            <div className="cards-manager-toolbar">
              <input
                type="text"
                className="search-input"
                placeholder="🔍 Поиск по названию или ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />

              <select
                className="rarity-filter"
                value={selectedRarity}
                onChange={(e) => setSelectedRarity(e.target.value)}
              >
                <option value="">Все редкости</option>
                {rarities.map(rarity => (
                  <option key={rarity} value={rarity}>{rarity}</option>
                ))}
              </select>

              <select
                className="rarity-filter"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                title="Сортировка"
              >
                <option value="name">По имени</option>
                <option value="id">По ID</option>
                <option value="rarity">По редкости</option>
              </select>

              <button className="btn-add-card" onClick={handleAddCard}>
                <FiPlus size={18} /> Добавить карточку
              </button>
            </div>

            <div
              className="cards-list"
              onScroll={(e) => {
                const el = e.currentTarget;
                if (el.scrollTop + el.clientHeight >= el.scrollHeight - 80) {
                  setVisibleCount((n) => Math.min(sortedCards.length, n + 48));
                }
              }}
            >
              {sortedCards.length > 0 ? (
                visibleCards.map(card => (
                  <div key={card.id} className="card-item">
                    <div className="card-preview" style={{ backgroundColor: card.color }}>
                      {card.image ? (
                        <CardImage imagePath={card.image} alt={card.name} className="card-preview-media" />
                      ) : (
                        <div className="no-image">Нет изображения</div>
                      )}
                    </div>
                    
                    <div className="card-info">
                      <div className="card-id-name">
                        <span className="card-id">#{card.id}</span>
                        <h3>{card.name}</h3>
                      </div>
                      <div className="card-meta">
                        <span className="rarity-badge">{card.rarity}</span>
                      </div>
                    </div>

                    <div className="card-actions">
                      <button
                        className="btn-action btn-edit"
                        onClick={() => handleEditCard(card)}
                        title="Редактировать"
                      >
                        <FiEdit2 size={18} />
                      </button>
                      <button
                        className="btn-action btn-delete"
                        onClick={() => handleDeleteCard(card.id)}
                        title="Удалить"
                      >
                        <FiTrash2 size={18} />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="empty-state">
                  {cards.length === 0 ? '📭 Карточек нет' : '🔍 Карточек не найдено'}
                </div>
              )}
            </div>

            <div className="cards-manager-footer">
              <span className="cards-count">
                Показано: {visibleCards.length} / {sortedCards.length} (всего {cards.length})
              </span>
            </div>
          </div>
        ) : (
          <div className="card-form-container">
            <h3>{editingCard ? 'Редактирование карточки' : 'Новая карточка'}</h3>

            <div className="form-group">
              <label htmlFor="card-name">Имя карточки:</label>
              <input
                id="card-name"
                type="text"
                className="form-input"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Например: Чаризард"
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="card-rarity">Редкость:</label>
                <select
                  id="card-rarity"
                  className="form-input"
                  value={formData.rarity}
                  onChange={(e) => setFormData({ ...formData, rarity: e.target.value })}
                >
                  <option value="">-- Выбери редкость --</option>
                  {rarities.map(rarity => (
                    <option key={rarity} value={rarity}>{rarity}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="card-color">Цвет:</label>
                <div className="color-picker-group">
                  <input
                    id="card-color"
                    type="color"
                    className="form-color"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  />
                  <input
                    type="text"
                    className="form-input"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    placeholder="#FF6B35"
                  />
                </div>
              </div>
            </div>

            <div className="form-group">
              <label>Изображение карточки:</label>
              <button
                type="button"
                className="btn-select-image"
                onClick={handleSelectImageFile}
              >
                📁 Выбрать изображение
              </button>
              <div className="file-info">
                ℹ️ Диалог откроется в папке с картинками
              </div>
              {formData.image && (
                <div className="image-preview">
                  <CardImage imagePath={formData.image} alt="Preview" />
                  <span className="image-path">{formData.image}</span>
                </div>
              )}
            </div>

            <div className="form-actions">
              <button
                className="btn btn-cancel"
                onClick={() => setShowForm(false)}
                disabled={saving}
              >
                ОТМЕНА
              </button>
              <button
                className="btn btn-save"
                onClick={handleSaveCard}
                disabled={saving}
              >
                {saving ? 'СОХРАНЕНИЕ...' : 'СОХРАНИТЬ'}
              </button>
            </div>
          </div>
        )}

        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
            autoClose={toast.type === 'success' ? 2000 : 3000}
          />
        )}
      </div>
    </div>
  );
}

export default CardsManager;
