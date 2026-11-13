const crypto = require('crypto');
const https = require('https');
const http = require('http');
const { URL } = require('url');

const DEFAULT_REDIRECT_PORT = 43781;
const TWITCH_AUTHORIZE = 'https://id.twitch.tv/oauth2/authorize';
const TWITCH_TOKEN = 'https://id.twitch.tv/oauth2/token';
const TWITCH_VALIDATE = 'https://id.twitch.tv/oauth2/validate';

function base64Url(buffer) {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function createPkcePair() {
  const verifier = base64Url(crypto.randomBytes(32));
  const challenge = base64Url(crypto.createHash('sha256').update(verifier).digest());
  return { verifier, challenge };
}

function httpsFormRequest(url, formBody) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const payload = new URLSearchParams(formBody).toString();
    const req = https.request(
      {
        hostname: urlObj.hostname,
        port: urlObj.port || 443,
        path: urlObj.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(payload),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            resolve({ statusCode: res.statusCode, data: JSON.parse(data || '{}') });
          } catch (e) {
            resolve({ statusCode: res.statusCode, data: { raw: data } });
          }
        });
      }
    );
    req.on('error', reject);
    req.setTimeout(15000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    req.write(payload);
    req.end();
  });
}

function httpsGetJson(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const req = https.request(
      {
        hostname: urlObj.hostname,
        port: urlObj.port || 443,
        path: urlObj.pathname + urlObj.search,
        method: 'GET',
        headers,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            resolve({ statusCode: res.statusCode, data: JSON.parse(data || '{}') });
          } catch (e) {
            resolve({ statusCode: res.statusCode, data: { raw: data } });
          }
        });
      }
    );
    req.on('error', reject);
    req.setTimeout(15000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    req.end();
  });
}

function waitForAuthCode(port, timeoutMs = 180000) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        const requestUrl = new URL(req.url, `http://127.0.0.1:${port}`);
        if (requestUrl.pathname !== '/') {
          res.writeHead(404);
          res.end('Not found');
          return;
        }
        const error = requestUrl.searchParams.get('error');
        const code = requestUrl.searchParams.get('code');
        if (error) {
          res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end('<h3>Ошибка авторизации Twitch</h3><p>Можно закрыть окно.</p>');
          cleanup();
          reject(new Error(error));
          return;
        }
        if (!code) {
          res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end('<h3>Код не получен</h3>');
          return;
        }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<h3>Авторизация успешна</h3><p>Можно закрыть это окно и вернуться в приложение.</p>');
        cleanup();
        resolve(code);
      } catch (e) {
        cleanup();
        reject(e);
      }
    });

    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('Таймаут ожидания Twitch OAuth'));
    }, timeoutMs);

    function cleanup() {
      clearTimeout(timer);
      try {
        server.close();
      } catch (e) {}
    }

    server.on('error', (err) => {
      cleanup();
      reject(err);
    });

    server.listen(port, '127.0.0.1');
  });
}

async function authorizeWithPkce({ clientId, clientSecret, scopes, redirectPort = DEFAULT_REDIRECT_PORT, openUrl }) {
  if (!clientId) throw new Error('Client ID обязателен для прямой авторизации Twitch');

  const redirectUri = `http://localhost:${redirectPort}`;
  const scopeValue = (scopes || []).join(' ');
  const { verifier, challenge } = createPkcePair();

  const authUrl = `${TWITCH_AUTHORIZE}?${new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: scopeValue,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  }).toString()}`;

  const codePromise = waitForAuthCode(redirectPort);
  await openUrl(authUrl);
  const code = await codePromise;

  const tokenBody = {
    client_id: clientId,
    code,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
    code_verifier: verifier,
  };
  if (clientSecret) tokenBody.client_secret = clientSecret;

  const tokenResponse = await httpsFormRequest(TWITCH_TOKEN, tokenBody);
  if (tokenResponse.statusCode !== 200) {
    throw new Error(tokenResponse.data?.message || 'Не удалось обменять код Twitch OAuth');
  }

  return tokenResponse.data;
}

async function refreshDirectToken({ clientId, clientSecret, refreshToken }) {
  if (!clientId || !refreshToken) return null;
  const body = {
    client_id: clientId,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  };
  if (clientSecret) body.client_secret = clientSecret;

  const tokenResponse = await httpsFormRequest(TWITCH_TOKEN, body);
  if (tokenResponse.statusCode !== 200) return null;
  return tokenResponse.data;
}

async function getValidatedUser(accessToken) {
  const validation = await httpsGetJson(TWITCH_VALIDATE, {
    Authorization: `OAuth ${accessToken}`,
  });
  if (validation.statusCode !== 200) return null;
  return validation.data;
}

module.exports = {
  DEFAULT_REDIRECT_PORT,
  authorizeWithPkce,
  refreshDirectToken,
  getValidatedUser,
};
