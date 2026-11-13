@echo off
cd /d "%~dp0"
echo ============================================
echo CCG Twitch Bot - Быстрый запуск
echo ============================================
echo.

if not exist "node_modules" (
    echo ОШИБКА: Зависимости не установлены!
    echo Пожалуйста, запустите START.bat первый раз
    pause
    exit /b 1
)

echo Запускаю приложение...
call npm run electron-dev
pause
