@echo off
rem ============================================================
rem  公司内部沟通工具 - 生产启动脚本（Windows）
rem  一键：构建前后端 -> 以生产模式启动（单端口 3000 访问全部功能）
rem  用法：双击运行，或命令行 start-prod.bat
rem  停止：关闭本窗口 / Ctrl+C（若用 PM2 启动则 pm2 stop inner-tool）
rem ============================================================
setlocal
cd /d "%~dp0"

echo [1/4] 构建后端...
cd backend
call npm run build
if errorlevel 1 ( echo 后端构建失败 & exit /b 1 )

echo [2/4] 构建前端...
cd ..\frontend
call npm run build
if errorlevel 1 ( echo 前端构建失败 & exit /b 1 )

echo [3/4] 启动生产服务（http://localhost:3000）...
cd ..\backend
set NODE_ENV=production
node dist/index.js

echo [4/4] 服务已停止
endlocal
