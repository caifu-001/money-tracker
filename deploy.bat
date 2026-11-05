@echo off
taskkill /f /im node.exe >nul 2>&1
timeout /t 2 >nul
cd C:\Users\yinsu\.qclaw\workspace\money-tracker
set VITE_SUPABASE_URL=https://abkscyijuvkfeazhlquz.supabase.co
set VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFia3NjeWlqdXZrZmVhemhscXV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0MTI1NDIsImV4cCI6MjA4OTk4ODU0Mn0.eoAm3WjrCYPyuw2JB6M2QUe5QSyP4GkMGg2Buj57fb4
call node_modules\.bin\vite.cmd build
if errorlevel 1 echo BUILD FAILED && exit /b 1
call node_modules\.bin\gh-pages.cmd -d dist --dotfiles
if errorlevel 1 echo DEPLOY FAILED && exit /b 1
echo DONE
