@echo off
cd /d "%~dp0"
echo ============================================
echo CCG Twitch Bot - Очистка и переустановка
echo ============================================
echo.

echo Удаляю node_modules и package-lock.json...
if exist node_modules rmdir /s /q node_modules
if exist package-lock.json del /q package-lock.json
echo Удалено!
echo.

echo Устанавливаю зависимости заново...
call npm install
echo.

echo Все готово! Теперь запустите START.bat
pause
