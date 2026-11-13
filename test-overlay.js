#!/usr/bin/env node

/**
 * Тестовый скрипт для проверки оверлея
 * Использование: npm run test-overlay
 */

const http = require('http');

const testCard = {
  username: 'TestUser',
  cardName: 'Тестовая Карточка',
  cardColor: '#FF6B35',
  cardImage: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  rarity: 'Rare'
};

function testOverlayAPI() {
  console.log('🧪 Тестирование оверлей-сервера...\n');
  
  // Проверяем что сервер запущен
  http.get('http://localhost:3001/', (res) => {
    if (res.statusCode === 404 || res.statusCode === 200) {
      console.log('✅ Оверлей-сервер доступен на http://localhost:3001/\n');
    } else {
      console.log('⚠️  Сервер ответил кодом:', res.statusCode);
    }
  }).on('error', (err) => {
    console.error('❌ Оверлей-сервер не запущен!');
    console.error('   Запустите: npm run overlay\n');
    process.exit(1);
  });

  // Пытаемся отправить тестовую карточку
  console.log('📤 Отправляю тестовую карточку на оверлей...');
  
  const postData = JSON.stringify(testCard);
  
  const options = {
    hostname: 'localhost',
    port: 3001,
    path: '/api/show-card',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  const req = http.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
      if (res.statusCode === 200) {
        console.log('✅ Карточка отправлена успешно!\n');
        console.log('📋 Данные карточки:');
        console.log(JSON.stringify(testCard, null, 2));
        console.log('\n🌐 Открой в браузере: http://localhost:3001');
        console.log('   Карточка должна появиться с анимацией входа!');
        console.log('\n⏰ Карточка автоматически скроется через 6 секунд.');
      } else {
        console.error('❌ Ошибка при отправке карточки:', res.statusCode);
        console.error('   Ответ:', data);
      }
    });
  });

  req.on('error', (e) => {
    console.error('❌ Ошибка отправки:', e.message);
    process.exit(1);
  });

  req.write(postData);
  req.end();
}

// Запускаем тест
setTimeout(testOverlayAPI, 1000);
