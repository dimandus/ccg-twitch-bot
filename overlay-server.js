const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();

// Port must be known early because error handler uses it
const PORT = process.env.OVERLAY_PORT || 3001;

// body size large because images are sent as base64
app.use(express.json({ limit: '50mb' }));
// Minimal CORS for dev: allow requests from React dev server and localhost
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && (origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1'))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Serve static overlay files
app.use(express.static(path.join(__dirname, 'overlay-dist')));

// Simple API to show/hide cards from other processes
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

wss.broadcast = function broadcast(data) {
  const str = typeof data === 'string' ? data : JSON.stringify(data);
  for (const client of this.clients) {
    if (client.readyState === WebSocket.OPEN) client.send(str);
  }
};

app.post('/api/show-card', (req, res) => {
  const payload = req.body;
  if (!payload) return res.status(400).json({ success: false, error: 'No payload' });
  wss.broadcast({ type: 'show-card', data: payload });
  res.json({ success: true });
});

app.post('/api/hide-card', (req, res) => {
  wss.broadcast({ type: 'hide-card' });
  res.json({ success: true });
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'overlay-dist', 'index.html'));
});

server.on('error', (err) => {
  if (err && err.code === 'EADDRINUSE') {
    console.error(`❌ Порт ${PORT} уже занят. Оверлей не запущен. Освободите порт и перезапустите приложение.`);
    return;
  }
  console.error('❌ Ошибка сервера оверлея:', err && err.stack ? err.stack : err);
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`🎨 Оверлей сервер запущен на http://127.0.0.1:${PORT}`);
  console.log(`🎨 WebSocket слушает подключения`);
});

// Expose stop() for consumers that `require()` this file so the host can shut the server down.
module.exports = {
  stop: () => {
    return new Promise((resolve) => {
      try {
        if (wss) {
          try {
            for (const c of wss.clients) {
              try { c.terminate(); } catch (e) {}
            }
          } catch (e) {}
          try { wss.close(); } catch (e) {}
        }
        if (server) {
          try {
            server.close(() => resolve(true));
            // fallback resolve in 1s
            setTimeout(() => resolve(true), 1000);
            return;
          } catch (e) {
            // ignore
          }
        }
      } catch (e) {}
      resolve(false);
    });
  }
};

// Also attach to global for other import styles
global.__overlayServer = module.exports;
