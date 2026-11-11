@echo off
chcp 65001 >nul
cd /d "%~dp0"
title 通用标注工具

where node >nul 2>nul
if errorlevel 1 (
  echo [错误] 未检测到 Node.js，请先安装：https://nodejs.org/
  pause
  exit /b 1
)

if not exist node_modules (
  echo 首次运行：正在安装依赖，约需 1-2 分钟，请稍候...
  call npm install --registry=https://registry.npmmirror.com --no-audit --no-fund
  if errorlevel 1 (
    echo [错误] 依赖安装失败，请检查网络后重新运行
    pause
    exit /b 1
  )
)

if not exist dist\index.html (
  echo 正在构建页面...
  set "NODE_OPTIONS=--openssl-legacy-provider"
  call npm run build
  if errorlevel 1 (
    echo [错误] 构建失败，请将上方报错信息反馈给维护人员
    pause
    exit /b 1
  )
)

echo 正在启动本地服务...
node server.js
echo 服务已停止。
pause
