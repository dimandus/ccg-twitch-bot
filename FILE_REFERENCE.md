# 📁 Полный список файлов проекта

## Структура папок

```
Electron-Bot/
├── public/
│   ├── main.js                 # Главный Electron процесс
│   ├── preload.js             # IPC мост для безопасности
│   └── lib/                   # cardDraw, collections, backup, twitchDirectAuth, …
│
├── src/
│   ├── App.js                  # React корневой компонент
│   ├── index.js               # React DOM render
│   ├── components/
│   │   ├── ControlPanel.js    # Кнопки управления ботом
│   │   ├── SettingsWindow.js  # Окно настроек
│   │   ├── CardsManager.js    # Управление карточками
│   │   ├── ActivityLog.js     # Логи активности
│   │   ├── CardImage.js       # Загрузка изображений
│   │   ├── CollectionsWindow.js
│   │   ├── OnboardingWizard.js
│   │   ├── AuthSettingsWindow.js
│   │   └── Toast.js           # Всплывающие уведомления
│   ├── styles/
│   │   ├── App.css            # Основные стили
│   │   ├── ControlPanel.css   # Стили кнопок
│   │   ├── SettingsWindow.css # Стили настроек
│   │   ├── CardsManager.css   # Стили менеджера карточек
│   │   ├── ActivityLog.css    # Стили логов
│   │   └── Toast.css          # Стили уведомлений
│   └── index.css              # Глобальные стили
│
├── overlay-dist/
│   └── index.html             # HTML оверлея для OBS
│
├── overlay-server.js          # Express сервер для оверлея
├── test-overlay.js            # Скрипт для тестирования оверлея
├── package.json               # Конфигурация npm
├── public/favicon.ico         # Иконка приложения
├── public/index.html          # React HTML template
│
├── OVERLAY_README.md          # 📖 Основное руководство
├── QUICK_START_OVERLAY.md     # ⚡ Быстрый старт (5 минут)
├── ARCHITECTURE.md            # 🏗️ Архитектура системы
├── TROUBLESHOOTING.md         # 🔧 Помощь и отладка
└── FILE_REFERENCE.md          # 📁 Этот файл
```

## Описание ключевых файлов

### 🔴 Главные файлы системы

#### `public/main.js` (500+ строк)
**Назначение:** Основной процесс Electron, оркестрирует всю логику

**Ключевые функции:**
- `ensureConfigDir()` - Создаёт папку AppData с подпапками
- `loadConfig()` / `saveConfig()` - Работа с конфигом
- `getRandomCard()` - Взвешенный выбор карточки
- `isTokenExpiredOrExpiring()` - Проверка срока токена
- `refreshAccessToken()` - Обновление OAuth токена
- `connectTwitchChat()` - Подключение к чату
- `sendCardToOverlay()` - Отправка карточки на оверлей
- `handleGetCard()` - Логика получения карточки (кулдаун, выбор)
- `ipc.handle()` - Обработчики IPC запросов

**Зависимости:**
- `http`, `https` (Node.js встроенные)
- `tmi.js` - Twitch Chat
- `electron` - Основной фреймворк

#### `public/preload.js` (20+ строк)
**Назначение:** Безопасный мост между React (renderer) и main процессом

**Экспортирует методы:**
- `startBot`, `stopBot`, `authorizeTwitch`, `getBotStatus`
- `getConfig`, `saveConfig`, `getLogs`
- `getCardsList`, `saveCardsList`, `saveCardImage`
- `getImageAsBase64`, `moveImageFile`, `readImageFile`
- `openFileDialog`, `getCardsDir`, `openCardsDir`

**Структура:**
- `contextBridge.exposeInMainWorld()` - Безопасное API
- Whitelist конкретных IPC каналов

#### `src/App.js` (150+ строк)
**Назначение:** React корневой компонент, управление состоянием приложения

**State:**
- `botStatus` - Статус бота {isRunning, isAuthorized, channel}
- `logs` - Array логов
- `config` - Конфигурация
- `settingsOpen` - Видно ли окно настроек
- `cardsManagerOpen` - Видно ли управление карточками

**Инициализация:**
- `useRef` - Защита от двойной инициализации React StrictMode
- `useEffect` - Загрузка конфига при старте

### 🎨 Компоненты UI

#### `src/components/ControlPanel.js` (100+ строк)
**Назначение:** Основная панель управления с 6 кнопками

**Кнопки:**
1. 🟢 ЗАПУСТИТЬ БОТ (green, включает бот)
2. 🔴 ОСТАНОВИТЬ БОТ (red, выключает бот)
3. 🟣 АВТОРИЗАЦИЯ (purple, OAuth2)
4. 🔵 НАСТРОЙКИ (blue, открывает SettingsWindow)
5. 🟠 БАЗА КАРТОЧЕК (orange, открывает CardsManager)
6. ⚪ ПОМОЩЬ (gray, placeholder)

**Статус-бар:**
- Показывает 🟢/🔴 индикатор
- Имя канала
- Статус игры

#### `src/components/SettingsWindow.js` (400+ строк)
**Назначение:** Полная конфигурация всех параметров

**Секции:**
1. **💬 Приветствие** - Сообщение при старте бота
2. **🎴 Игра** - Команда, кулдаун, редкости, формат ответа
3. **📁 Утилиты** - Кнопка открыть папку карточек
4. **🎨 Оверлей** - Включение, URL для OBS

**Редкости:**
- Динамический список с add/delete
- Автоматический расчёт процентов
- Дефолт: Common (50), Uncommon (30), Rare (15), Epic (4), Legendary (1)

#### `src/components/CardsManager.js` (500+ строк)
**Назначение:** Полный CRUD для карточек и изображений

**Функции:**
- Grid-layout 200px карточек
- Поиск по имени/ID
- Фильтр по редкости
- Add/Edit/Delete карточки
- Загрузка изображений с автодетектом папки
- Сохранение в cards.json

**Modal форма:**
- Имя (текст)
- Редкость (select)
- Цвет (color picker + hex input)
- Изображение (file upload)

#### `src/components/ActivityLog.js` (80+ строк)
**Назначение:** Отображение логов в реальном времени

**Функции:**
- Автоскролл к последнему
- Fade-in анимация
- Green monospace текст
- Макс 100 записей
- Timestamps для каждой записи

#### `src/components/CardImage.js` (100+ строк)
**Назначение:** Безопасная загрузка изображений карточек

**Поддерживает:**
- Data URLs (base64)
- HTTP(S) URLs
- Локальные пути Cards/*

**Функции:**
- Асинхронная загрузка
- Кэширование base64
- Spinner во время загрузки
- Graceful fallback на ошибку

#### `src/components/Toast.js` (80+ строк)
**Назначение:** Система уведомлений

**Типы:**
- ✅ success (зелёный, 2s)
- ❌ error (красный, 3s)
- ℹ️ info (синий, 3s)

**Стек:**
- Автоматический dismiss
- Стакирование нескольких тостов
- Slide animation от bottom-center

### 🌐 Оверлей

#### `overlay-server.js` (100+ строк)
**Назначение:** Express сервер для OBS Browser Source интеграции

**Endpoints:**
- `GET /` - Serve SPA (overlay-dist/index.html)
- `POST /api/show-card` - Получить карточку, broadcast via WebSocket
- `POST /api/hide-card` - Скрыть карточку

**WebSocket:**
- Broadcast сообщения: {type: 'card', data: {...}}
- Отправка текущей карточки новым клиентам

**Порт:** 3001 (по умолчанию)

#### `overlay-dist/index.html` (300+ строк)
**Назначение:** UI для OBS Browser Source

**Компоненты:**
- Контейнер карточки (400x550)
- Изображение на всю высоту
- Имя карточки в bottom overlay
- Rarity badge в top-right
- Message: "Username получил CardName"
- Цветной accent border

**Анимации:**
- Entry: cubic-bezier 0.5s
- Exit: 0.3s fade out
- Auto-hide: 6s timeout

**WebSocket:**
- Подключение к localhost:3001
- Слушает: {type: 'card', data: {...}}
- Слушает: {type: 'hide'}

#### `test-overlay.js` (80+ строк)
**Назначение:** Скрипт для тестирования оверлея

**Что делает:**
1. Проверяет что оверлей-сервер запущен
2. Отправляет тестовую карточку на /api/show-card
3. Дает инструкцию открыть http://localhost:3001

**Запуск:**
```bash
npm run test-overlay
```

### 📦 Конфигурация

#### `package.json` (60+ строк)
**Назначение:** npm конфигурация и скрипты

**Скрипты:**
- `npm start` - React dev server
- `npm run overlay` - Только оверлей-сервер
- `npm run electron-dev` - Всё вместе (рекомендуется)
- `npm run build` - Build React
- `npm run electron-build` - Full production build
- `npm run test-overlay` - Тестирование оверлея

**Зависимости:**
- react 18.2.0
- electron 27.0.0
- tmi.js 1.8.5
- express 4.18.2
- ws 8.14.2
- axios 1.6.0

### 📚 Документация

#### `OVERLAY_README.md` (200+ строк)
**Назначение:** Основное руководство по оверлею и настройке

**Содержит:**
- Требования и установка
- Запуск приложения
- OBS Browser Source Setup
- Файловая структура
- Структура Config и Cards DB
- Troubleshooting

#### `QUICK_START_OVERLAY.md` (250+ строк)
**Назначение:** Быстрый старт за 5 минут

**Разделы:**
- 6 пошаговых шагов
- Быстрая проверка
- Типичные ошибки с решениями
- Чек-лист перед стримом

#### `ARCHITECTURE.md` (400+ строк)
**Назначение:** Детальная архитектура системы

**Содержит:**
- Диаграмма системы
- Поток данных при получении карточки
- OAuth2 flow
- Token refresh логика
- Структура конфига
- IPC методы (таблица)
- Error handling
- Performance considerations
- Security details

#### `TROUBLESHOOTING.md` (300+ строк)
**Назначение:** Решение проблем и отладка

**Разделы:**
- Как открыть DevTools
- 5 категорий проблем с решениями
- Типичные ошибки из Console
- Чек-лист перед стримом
- Как собрать информацию для помощи

#### `FILE_REFERENCE.md` (этот файл)
**Назначение:** Полный справочник всех файлов

## Размеры файлов

| Файл | Строк | Назначение |
|------|-------|-----------|
| public/main.js | 550 | Основная логика |
| src/components/SettingsWindow.js | 400 | Настройки |
| src/components/CardsManager.js | 500 | Менеджер карточек |
| overlay-server.js | 100 | Оверлей сервер |
| overlay-dist/index.html | 300 | Оверлей UI |
| ARCHITECTURE.md | 400 | Архитектура |
| TROUBLESHOOTING.md | 300 | Помощь |

## Места сохранения данных

### На диске (Windows)
```
C:\Users\{username}\AppData\Local\ccg-bot\
├── config.json                  (settings, tokens)
├── cards.json                   (card database)
└── Cards/                       (images)
    ├── card_1234567.png
    ├── card_2345678.jpg
    └── ...
```

### В памяти приложения
```
React State:
  - botStatus
  - logs (max 100)
  - config
  - settingsOpen
  - cardsManagerOpen

Main Process:
  - currentClient (TMI connection)
  - logs array
  - userCooldowns (копия из config)
```

### На оверлей-сервере
```
Memory:
  - currentCard (последняя отправленная)
  - WebSocket clients (список подключённых)
```

## Как навигировать

### Если нужно... найди файл:

**Добавить новую кнопку в приложение**
→ `src/components/ControlPanel.js`

**Изменить настройки**
→ `src/components/SettingsWindow.js`

**Добавить новую карточку фичу**
→ `src/components/CardsManager.js`

**Изменить дизайн оверлея**
→ `overlay-dist/index.html` (CSS секция)

**Добавить новый endpoint оверлея**
→ `overlay-server.js`

**Изменить логику получения карточки**
→ `public/main.js`, функция `handleGetCard()`

**Добавить новый IPC метод**
→ `public/main.js` (ipc.handle) + `public/preload.js` (contextBridge)

**Исправить баг в оверлее**
→ `overlay-dist/index.html` (JS секция) или `overlay-server.js`

## Зависимости и версии

```
Runtime:
  - Node.js 14+
  - npm 6+

Production:
  - electron 27.0.0
  - react 18.2.0
  - react-dom 18.2.0
  - react-scripts 5.0.1
  - react-icons 4.11.0
  - tmi.js 1.8.5
  - express 4.18.2
  - ws 8.14.2
  - axios 1.6.0

Development:
  - concurrently 8.2.1
  - cross-env 7.0.3
  - electron-builder 24.6.4
  - wait-on 7.0.1
```

## Ссылки на ключевые сервисы

| Сервис | URL | Назначение |
|--------|-----|-----------|
| Dimandus OAuth | https://dimandus.ru:5001 | OAuth2 сервер для Twitch |
| Twitch API | https://api.twitch.tv | Получение info о пользователе |
| Twitch Chat | irc-ws.chat.twitch.tv | WebSocket чата (TMI.js) |
| Localhost Dev | http://localhost:3000 | React dev server |
| Localhost Overlay | http://localhost:3001 | Оверлей сервер |

---

**Обновлено:** 2024
**Версия:** 1.0.0
**Язык:** Русский
