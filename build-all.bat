@echo off
rem ============================================================
rem  公司内部沟通工具 - 生产构建脚本
rem  构建后端(tsc) + 前端(vite)，产物分别输出到
rem  backend/dist 与 frontend/dist
rem ============================================================
setlocal
cd /d "%~dp0"

echo [1/3] 构建后端...
cd backend
call npm run build
if errorlevel 1 ( echo 后端构建失败 & exit /b 1 )

echo [2/3] 构建前端...
cd ..\frontend
call npm run build
if errorlevel 1 ( echo 前端构建失败 & exit /b 1 )

echo [3/3] 构建完成
cd ..
echo 产物: backend\dist\ 与 frontend\dist\
endlocal
