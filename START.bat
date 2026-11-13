@echo off
cd /d "%~dp0"
echo ============================================
echo CCG Twitch Bot - Запуск приложения
echo ============================================
echo.

REM Проверяем наличие node_modules
if not exist "node_modules" (
    echo Устанавливаю зависимости...
    call npm install
    echo.
)

echo Запускаю приложение...
call npm run electron-dev
pause
