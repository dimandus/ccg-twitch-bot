# CCG Twitch Bot

Десктоп-приложение для Twitch: зрители вытягивают карты командой в чате, стример видит дроп на OBS-оверлее и ведёт коллекции зрителей.

**Версия:** 1.1.0 · **Платформа:** Windows (сборка Electron; исходники — кроссплатформенно)

![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)

## Скачать (релиз)

Готовые `.exe` без Node.js — в [Releases](https://github.com/dimandus/ccg-twitch-bot/releases/latest):

| Файл | Описание |
|------|----------|
| `CCG Twitch Bot Setup 1.1.0.exe` | Установщик |
| `CCG Twitch Bot 1.1.0.exe` | Portable |

После установки откройте приложение и пройдите короткий онбординг на первом запуске.

## Возможности

- Команды **`!карта`** (кулдаун, веса редкостей) и **`!коллекция`** (короткий ответ в чате; полный список — в GUI стримера)
- OBS Browser Source оверлей с анимацией карты
- Авторизация: **dimandus.ru** или резервный **прямой Twitch OAuth (PKCE)**
- База карт, локальные изображения, бэкап/импорт данных
- Авто-переподключение чата, обновление токена, лимит длины сообщений Twitch
- Опциональная модерация (сабы / моды / block list по user id)

## Быстрый старт для стримера

1. **Авторизация** — кнопка на панели или окно **OAuth**, если основной сервер недоступен.
2. **Карты** — «База карточек» (для теста из репозитория: `npm run seed:cards` в dev-режиме).
3. **OBS** — в настройках скопируйте URL оверлея, например `http://127.0.0.1:3001`.
4. **Старт бота** — проверьте `!карта` в чате.

Подробная установка: [INSTALL.md](INSTALL.md).

## Разработка

```bash
git clone https://github.com/dimandus/ccg-twitch-bot.git
cd ccg-twitch-bot
npm install
npm run electron-dev
```

| Команда | Назначение |
|---------|------------|
| `npm run electron-dev` | React + Electron (dev) |
| `npm run test:unit` | Юнит-тесты (card-draw, collections) |
| `npm run electron-build` | Production-сборка Windows |

**Требования:** Node.js 18+, npm.

## Данные на диске

Windows:

```
%AppData%\ccg-twitch-bot\ccg-bot\
  config.json
  cards.json
  collections.json
  cooldowns.json
  Cards\
```

Токены в `config.json` шифруются через Electron `safeStorage` (DPAPI на Windows). Бэкап из настроек **не включает** токены.

## OAuth (резерв)

1. [Twitch Developer Console](https://dev.twitch.tv/console/apps) — своё приложение.
2. Redirect URI: `http://localhost:43781`
3. Scopes: `chat:read`, `chat:edit`, `channel:bot` (и связанные для чата).
4. В приложении: окно **OAuth** → режим **direct** → Client ID (и Secret при необходимости).

## Документация

| Файл | Содержание |
|------|------------|
| [INSTALL.md](INSTALL.md) | Установка, smoke-чеклист |
| [CHANGELOG.md](CHANGELOG.md) | История версий |
| [TROUBLESHOOTING.md](TROUBLESHOOTING.md) | Типичные проблемы |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Архитектура |
| [QUICK_START_OVERLAY.md](QUICK_START_OVERLAY.md) | OBS и оверлей |

## Автор

Сделано [dimandus](https://github.com/dimandus). Связь и поддержка — кнопка **«об авторе»** в приложении или:

- [Boosty](https://boosty.to/dimandus)
- [DonationAlerts](https://www.donationalerts.com/r/dimandus)
- [Telegram](https://t.me/dimandus)
- [ВКонтакте](http://vk.com/dimandus)

## Лицензия

[MIT](LICENSE) — используйте и дорабатывайте свободно; багрепорты и PR приветствуются.
