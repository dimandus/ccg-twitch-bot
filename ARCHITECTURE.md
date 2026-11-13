# Архитектура Electron CCG Bot

## Структура системы

```
┌─────────────────────────────────────────────────────────┐
│              Electron Main Process                       │
│              (public/main.js)                            │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌─────────────────────────────────────────────────┐   │
│  │ OAuth2 Handler                                   │   │
│  │ Twitch: dimandus.ru:5001                        │   │
│  │ Token Storage & Refresh                         │   │
│  └─────────────────────────────────────────────────┘   │
│                                                          │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Twitch Chat Integration (TMI.js)                │   │
│  │ Command Parsing & Card Drawing                 │   │
│  │ Per-user Cooldown System                        │   │
│  └─────────────────────────────────────────────────┘   │
│                                                          │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Overlay Integration                             │   │
│  │ Send Card Data → localhost:3001                 │   │
│  │ Image Base64 Conversion                         │   │
│  └─────────────────────────────────────────────────┘   │
│                                                          │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Config Management                               │   │
│  │ %AppData%\ccg-twitch-bot\ccg-bot\              │   │
│  │ - config.json (settings, sealed tokens)        │   │
│  │ - cards.json, collections.json, cooldowns.json│   │
│  │ - Cards/ (images)                              │   │
│  └─────────────────────────────────────────────────┘   │
│                                                          │
│  ┌─────────────────────────────────────────────────┐   │
│  │ IPC Channel (preload.js)                        │   │
│  │ Renderer ↔ Main Process Communication          │   │
│  └─────────────────────────────────────────────────┘   │
│                                                          │
└─────────────────────────────────────────────────────────┘
         ↓                              ↓
    ┌─────────────────┐      ┌──────────────────┐
    │  React App      │      │ Overlay Server   │
    │ (localhost:3000)│      │ (port 3001)      │
    │                 │      │                  │
    │ • ControlPanel  │      │ • Express HTTP   │
    │ • SettingsWindow│      │ • WebSocket      │
    │ • CardsManager  │      │ • Card Broadcast │
    │ • ActivityLog   │      │                  │
    │ • CardImage     │      │ Serves:          │
    │ • Toast         │      │ overlay-dist/    │
    └─────────────────┘      └──────────────────┘
                                      ↓
                            ┌──────────────────┐
                            │  OBS Browser     │
                            │  Source          │
                            │                  │
                            │ WebSocket Client │
                            │ Shows Cards      │
                            │ 6s Auto-hide     │
                            └──────────────────┘
```

## Поток данных при получении карточки

### Этап 1: Chat Command
```
User in Twitch Chat: !карта
         ↓
TMI.js Listener (main.js)
         ↓
Exact command match check
         ↓
Get username, user ID, channel
```

### Этап 2: Validation & Cooldown
```
Check user cooldown from userCooldowns
         ↓
If expired:
  - Generate random card (weighted by rarity)
  - Update userCooldowns[userId]
  - Save to config.json
         ↓
If active:
  - Calculate remaining time
  - Send to chat with time message
  - STOP HERE (no card drawn)
```

### Этап 3: Response Message
```
formatCardResponse() with substitutions:
  {username} → actual username
  {cardName} → card.name
  {rarity} → card.rarity
  {cardColor} → card.color
         ↓
Send formatted message to Twitch chat
```

### Этап 4: Overlay Broadcast
```
Read card image from: Cards/filename.ext
         ↓
Convert to base64 data URL:
  data:image/png;base64,iVBORw0KGgo...
         ↓
HTTP POST to localhost:3001/api/show-card
{
  username,
  cardName,
  cardColor,
  cardImage (base64),
  rarity
}
         ↓
Overlay Server broadcasts via WebSocket
         ↓
OBS Browser Source receives & displays
         ↓
Auto-hide after 6 seconds
```

### Этап 5: Logging
```
Add to activity log:
  ✓ [time] username получил cardName (rarity)
         ↓
Keep last 100 entries in memory
         ↓
Display in ActivityLog component
```

## OAuth2 Flow

```
1. User clicks АВТОРИЗАЦИЯ
        ↓
2. Main process POSTs to dimandus.ru:5001/api/auth/twitch/init
   Returns: auth_url, session_id
        ↓
3. Open browser → Twitch OAuth page
        ↓
4. User authorizes → Twitch redirects to dimandus.ru/callback
        ↓
5. Dimandus stores: access_token, refresh_token in session
        ↓
6. Main process polls dimandus.ru:5001/api/auth/twitch/status/{session_id}
   Every 2 seconds, max 60 attempts (120s total)
        ↓
7. When ready, dimandus returns tokens
        ↓
8. Save to config.json:
   {
     "twitch": {
       "accessToken": "oauth:...",
       "refreshToken": "...",
       "expiresAt": 1234567890123,  // absolute timestamp ms
       "issuedAt": 1234567800000
     }
   }
        ↓
9. botStatus.isAuthorized = true
        ↓
10. Enable START BOT button in UI
```

## Token Refresh Logic

```
When bot starts:
  ↓
1. Check if token expired or expiring soon (<10 min)
   isTokenExpiredOrExpiring() returns boolean
        ↓
2. If true:
   POST refresh_token to dimandus.ru:5001/api/auth/twitch/refresh
   Returns new access_token, expires_in
        ↓
3. Update config:
   expiresAt = now_ms + (expires_in * 1000)
   issuedAt = now_ms
        ↓
4. Save to config.json

Before connecting to Twitch Chat:
  ↓
1. Check token again
  ↓
2. If expired, refresh (same as above)
  ↓
3. Use fresh token in TMI client initialization
```

## Config Directory Structure

```
C:\Users\{username}\AppData\Local\ccg-bot\
│
├── config.json          ← All settings, tokens, cooldowns
├── cards.json          ← Array of card objects
│
└── Cards/              ← All card images
    ├── card_1234567.png
    ├── card_2345678.jpg
    ├── card_3456789.gif
    └── card_4567890.webp
```

### config.json Structure

```javascript
{
  // OAuth2 tokens
  "twitch": {
    "accessToken": "oauth:abcd1234...",
    "refreshToken": "refresh_abcd1234...",
    "expiresAt": 1704067200000,  // ms timestamp when token expires
    "issuedAt": 1704066000000,   // ms timestamp when token was issued
    "clientId": "2sk3t84wmxpeulajhrnrf7ztlid1xp"
  },

  // Channel info after OAuth
  "channel": "channelname",
  "channelId": "123456789",

  // Game settings
  "settings": {
    "greeting": {
      "enabled": true/false,
      "message": "Привет всем! Бот готов!"
    },
    
    "game": {
      "enabled": true/false,
      "commandName": "!карта",
      "cooldownSeconds": 60,
      "responseFormat": "@{username} 🎴 {cardName} ({rarity})",
      "rarities": [
        { "name": "Common", "weight": 50 },
        { "name": "Uncommon", "weight": 30 },
        { "name": "Rare", "weight": 15 },
        { "name": "Epic", "weight": 4 },
        { "name": "Legendary", "weight": 1 }
      ]
    },
    
    "overlay": {
      "enabled": true/false
    }
  },

  // Per-user cooldowns (userId → timestamp ms when cooldown expires)
  "userCooldowns": {
    "123456789": 1704067200000,
    "987654321": 1704067350000
  }
}
```

### cards.json Structure

```javascript
[
  {
    "id": 1,
    "name": "Чаризард",
    "color": "#FF6B35",
    "image": "Cards/card_1234567.png",  // Relative path!
    "rarity": "Rare"
  },
  {
    "id": 2,
    "name": "Пикачу",
    "color": "#FFEB3B",
    "image": "Cards/card_2345678.jpg",
    "rarity": "Common"
  }
]
```

## Component Communication

### React IPC Methods (preload.js → main.js)

| Method | Purpose | Params | Returns |
|--------|---------|--------|---------|
| `getBotStatus()` | Get current bot state | - | `{isRunning, isAuthorized, channel}` |
| `authorizeTwitch()` | Start OAuth2 flow | - | `{success, error}` |
| `startBot()` | Connect to Twitch chat | - | `{success, error}` |
| `stopBot()` | Disconnect from chat | - | `{success}` |
| `getLogs()` | Get activity log | - | `[log1, log2, ...]` |
| `getConfig()` | Load config | - | `configObject` |
| `saveConfig()` | Save config | `configObject` | `{success, error}` |
| `getCardsList()` | Load cards database | - | `[card1, card2, ...]` |
| `saveCardsList()` | Save cards database | `cardsArray` | `{success, error}` |
| `saveCardImage()` | Save image to Cards/ | `filePath` | `{relativePath}` |
| `getImageAsBase64()` | Convert image to data URL | `relativePath` | `"data:image/..."` |
| `moveImageFile()` | Move existing file | `{src, dst}` | `{success}` |
| `openFileDialog()` | File picker | `{defaultPath}` | `{filePaths}` |
| `getCardsDir()` | Get Cards folder path | - | `"C:\...\AppData\...\Cards"` |
| `openCardsDir()` | Open folder in explorer | - | - |

## Error Handling

### Token Expiration
```
Before any Twitch API call:
  1. Check if expired or expiring
  2. If yes: refresh automatically
  3. If refresh fails: show error, disable bot
  4. Update UI to "Авторизуйся снова"
```

### Chat Connection Failures
```
On connection error:
  1. Log error to activity log
  2. Disable START/STOP buttons
  3. Show toast notification
  4. Allow user to retry
```

### Image Loading Failures
```
In CardImage component:
  1. Try to load image
  2. If fails: show placeholder
  3. Log error to console
```

### Overlay Connection
```
If overlay server down:
  1. Card still drawn in chat
  2. No error shown to user (graceful fail)
  3. Logs "Failed to connect to overlay"
  4. User can see card in chat response
```

## File Paths (Cross-Platform Safe)

### Windows Example
```
C:\Users\John\AppData\Local\ccg-bot\
  config.json
  cards.json
  Cards\
    card_1234567.png
```

### Linux Example
```
/home/john/.config/ccg-bot/
  config.json
  cards.json
  Cards/
    card_1234567.png
```

### macOS Example
```
/Users/john/Library/Application Support/ccg-bot/
  config.json
  cards.json
  Cards/
    card_1234567.png
```

Used via Electron:
```javascript
const CONFIG_DIR = path.join(
  app.getPath('userData'),
  'ccg-bot'
);
// Automatically resolves to correct platform
```

## Overlay Server Architecture

### Express Routes

```
GET /                    → Serve overlay-dist/index.html
                          (root SPA handler)

POST /api/show-card      → Receive card data
                          {username, cardName, cardColor, cardImage, rarity}
                          → Broadcast via WebSocket to all clients
                          → Store currentCard in memory

POST /api/hide-card      → Send {type: 'hide'} to all clients
                          → Clear currentCard
```

### WebSocket Events

```
Client → Server:
  CONNECTION: Browser opens WebSocket
  → Server sends current card if exists

Server → Client:
  {type: 'card', data: {...}} → Display card
  {type: 'hide'}               → Hide card
```

### Overlay HTML Client

```javascript
// WebSocket listener in overlay-dist/index.html
ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  
  if (message.type === 'card') {
    displayCard(message.data);
    // Auto-hide after 6 seconds
    setTimeout(() => hideCard(), 6000);
  } else if (message.type === 'hide') {
    hideCard();
  }
};
```

## Performance Considerations

1. **Image Caching**: CardImage.js caches base64 conversions to avoid redundant IPC calls
2. **Logs**: ActivityLog keeps max 100 entries
3. **Polling**: OAuth2 polling max 60 attempts with 2s interval
4. **Cooldowns**: In-memory map, persisted to config.json
5. **Cards**: Loaded once on start, cached in React state

## Security

1. **Context Isolation**: Electron preload.js whitelist only safe APIs
2. **Image Validation**: Convert local files to data URLs (no file:// URLs)
3. **OAuth Tokens**: Stored encrypted in AppData (OS handles encryption)
4. **Token Refresh**: Happens automatically before expiration
5. **WebSocket**: Only localhost connections (local machine only)
