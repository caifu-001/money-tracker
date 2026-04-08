@echo off
cd /d D:\1kaifa\money-tracker\money-tracker
if exist dist rmdir /s /q dist
call node_modules\.bin\vite.cmd build
