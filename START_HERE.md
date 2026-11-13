# 📌 START HERE - С Чего Начать

Добро пожаловать в **🎴 Electron CCG Bot для Twitch**!

Выбери куда ты хочешь перейти:

---

## 🚀 Я хочу сразу начать (5 минут)

**👉 Читай:** [QUICK_START_OVERLAY.md](QUICK_START_OVERLAY.md)

Пошаговый гайд за 5 минут:
1. Установка зависимостей
2. Запуск приложения
3. Авторизация
4. Добавление карточки
5. Настройка OBS
6. Первый тест

---

## 📖 Я хочу понять всё подробно

**👉 Читай:** [OVERLAY_README.md](OVERLAY_README.md)

Полное руководство с:
- Все возможности
- Установка и конфигурация
- OBS Browser Source setup
- Структура файлов
- Переменные и форматы

---

## 🏗️ Я разработчик и хочу понять как это работает

**👉 Читай:** [ARCHITECTURE.md](ARCHITECTURE.md)

Техническая архитектура:
- Диаграмма системы
- Поток данных
- OAuth2 flow
- Token refresh логика
- IPC методы (таблица)
- Структура конфига
- Security details

---

## 🔧 Что-то не работает и мне нужна помощь

**👉 Читай:** [TROUBLESHOOTING.md](TROUBLESHOOTING.md)

Решение проблем:
- Как открыть DevTools
- Частые ошибки и решения
- Проблемы с оверлеем
- Проблемы с ботом
- Проблемы с картинками
- Чек-лист перед стримом

---

## 📁 Я ищу конкретный файл

**👉 Читай:** [FILE_REFERENCE.md](FILE_REFERENCE.md)

Справочник всех файлов:
- Описание каждого файла
- Назначение и функции
- Размер и сложность
- Как найти нужный файл
- Места сохранения данных

---

## 📋 Я хочу узнать что было добавлено

**👉 Читай:** [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md)

Резюме добавленного:
- Что было создано
- Как это работает
- Жизненный цикл карточки
- Компоненты системы
- Customization

---

## ✅ Я хочу проверить что всё работает

**👉 Читай:** [FINAL_CHECKLIST.md](FINAL_CHECKLIST.md)

Контрольный список:
- Все файлы на месте?
- Функциональность работает?
- Документация полная?
- Команды npm готовы?
- Быстрая проверка

---

## 🎮 Я хочу просто начать пользоваться

### Шаг 1: Установи

```bash
cd Electron-Bot
npm install
```

### Шаг 2: Запусти

```bash
npm run electron-dev
```

### Шаг 3: Авторизуйся

Нажми "АВТОРИЗАЦИЯ" в приложении

### Шаг 4: Добавь карточку

"БАЗА КАРТОЧЕК" → "+ ДОБАВИТЬ КАРТОЧКУ"

### Шаг 5: Добавь оверлей в OBS

URL: `http://localhost:3001` (скопировать можно в НАСТРОЙКИ)

### Шаг 6: Тестируй

В Twitch чате: `!карта`

Карточка появится на оверлее! 🎉

---

## 🎓 Популярные вопросы

### Q: Какая версия Node.js нужна?
**A:** Node.js 14+ и npm 6+

### Q: Где сохраняются мои карточки?
**A:** `C:\Users\{username}\AppData\Local\ccg-bot\`

### Q: Как добавить оверлей в OBS?
**A:** Sources → Browser → URL: `http://localhost:3001` → Width: 400, Height: 550

### Q: Что делать если оверлей чёрный?
**A:** В OBS правой кнопкой на источник → Refresh Cache

### Q: Могу ли я изменить команду?
**A:** Да! В НАСТРОЙКИ → Игра → Команда

### Q: Как изменить редкости?
**A:** В НАСТРОЙКИ → Игра → Редкости (add/delete/edit)

### Q: Может ли играть несколько людей?
**A:** Да! Каждый пользователь имеет свой кулдаун

### Q: Как изменить время показа карточки?
**A:** Редактируй `overlay-dist/index.html` (смотри setTimeout)

---

## 📞 Нужна помощь?

1. **Прочитай документацию** - ответ вероятно там
2. **Проверь TROUBLESHOOTING.md** - типичные проблемы решены там
3. **Открой DevTools** (Ctrl+Shift+I) - смотри ошибки в Console
4. **Запусти тест** - `npm run test-overlay`
5. **Перезагрузись** - `npm run electron-dev`

---

## 🗺️ Roadmap документации

```
START HERE (ты здесь)
    ↓
QUICK_START_OVERLAY (5 минут)
    ↓
OVERLAY_README (подробно)
    ↓
ARCHITECTURE (как это работает)
    ├─→ FILE_REFERENCE (конкретные файлы)
    ├─→ TROUBLESHOOTING (проблемы)
    └─→ IMPLEMENTATION_SUMMARY (что было)
    ↓
FINAL_CHECKLIST (всё готово?)
```

---

## 📊 Структура папки

```
Electron-Bot/
├── 📖 START_HERE.md         ← ТЫ ЗДЕСЬ
├── ⚡ QUICK_START_OVERLAY.md  ← НАЧНИ ОТСЮДА
├── 📚 Остальная документация
├── 🔴 Исходный код
├── 📦 package.json
└── 🎨 overlay-dist/
```

---

## ✨ Готовые примеры

### Пример 1: Добавить новую кнопку

Отредактируй `src/components/ControlPanel.js`:
```jsx
<button onClick={handleNewFeature}>
  ✨ НОВАЯ КНОПКА
</button>
```

### Пример 2: Изменить цвет оверлея

Отредактируй `overlay-dist/index.html`:
```css
.card {
  border: 3px solid #FF6B35;  /* Измени цвет */
}
```

### Пример 3: Изменить время показа

Отредактируй `overlay-dist/index.html`:
```javascript
setTimeout(() => hideCard(), 3000);  // 3 секунды вместо 6
```

---

## 🚀 Команды быстрого доступа

```bash
# Главная команда (используй её!)
npm run electron-dev

# Тестирование оверлея
npm run test-overlay

# Сборка для production
npm run electron-build

# Только React dev server
npm start

# Только оверлей-сервер
npm run overlay
```

---

## 📚 Читай в этом порядке (рекомендуется)

1. **Этот файл** (START_HERE.md) ← Ты здесь! ✅
2. **Быстрый старт** → [QUICK_START_OVERLAY.md](QUICK_START_OVERLAY.md) (5 минут)
3. **Полное руководство** → [OVERLAY_README.md](OVERLAY_README.md) (детали)
4. **Если что-то не работает** → [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
5. **Для разработчиков** → [ARCHITECTURE.md](ARCHITECTURE.md)

---

## 🎉 Готовы?

### ➡️ Начинающий: [QUICK_START_OVERLAY.md](QUICK_START_OVERLAY.md)

### ➡️ Опытный: [OVERLAY_README.md](OVERLAY_README.md)

### ➡️ Разработчик: [ARCHITECTURE.md](ARCHITECTURE.md)

### ➡️ Нужна помощь: [TROUBLESHOOTING.md](TROUBLESHOOTING.md)

---

**Версия:** 1.0.0
**Обновлено:** 2024

Удачи! 🚀
