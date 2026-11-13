@echo off
cd /d "%~dp0"
echo ============================================
echo CCG Twitch Bot - Сборка приложения
echo ============================================
echo.

if not exist "node_modules" (
    echo Устанавливаю зависимости...
    call npm install
    echo.
)

echo Собираю приложение...
call npm run electron-build
echo.
echo Сборка завершена! Результат в папке dist/
pause
