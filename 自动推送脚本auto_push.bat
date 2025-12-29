@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion

echo ==========================================
echo      智能 Git 备份脚本 (稳定版)
echo ==========================================

:: 设置你的用户名关键词
set "MY_USERNAME=Asmallhamis"

:: 1. 检查 Git 初始化
if not exist ".git" (
    echo [INFO] 未检测到 Git 仓库，正在初始化...
    git init
)

:: 2. 获取远程地址
set "CURRENT_URL="
git remote get-url origin >nul 2>&1
if not errorlevel 1 (
    for /f "delims=" %%i in ('git remote get-url origin') do set "CURRENT_URL=%%i"
)

:: --- 核心判断逻辑 (使用 GOTO 避免语法错误) ---

:: 如果地址为空，直接去设置新地址
if "!CURRENT_URL!"=="" goto SET_NEW_REMOTE

:: 显示当前地址
echo [INFO] 当前关联仓库: !CURRENT_URL!

:: 检测是否包含你的用户名
echo "!CURRENT_URL!" | findstr /i "%MY_USERNAME%" >nul
if !errorlevel! equ 0 goto IS_MY_REPO

:: 如果代码跑到这里，说明有关联仓库，但不是你的 (是原作者的)
goto SET_NEW_REMOTE

:IS_MY_REPO
echo [CHECK] 检测到是你的仓库，准备推送...
goto START_BACKUP

:SET_NEW_REMOTE
echo.
echo -----------------------------------------------------
echo [WARN] 未检测到你的私有库 (或是别人的库)
echo 请输入你的 GitHub 仓库地址用于备份 (Private库)
echo 例如: https://github.com/Asmallhamis/bingreward.git
echo -----------------------------------------------------
set /p USER_REPO_URL="请输入 URL: "

if "!USER_REPO_URL!"=="" (
    echo [ERROR] 未输入地址，脚本退出。
    pause
    exit /b
)

:: 如果当前没地址，就 add；如果有地址，就 set-url
if "!CURRENT_URL!"=="" (
    git remote add origin !USER_REPO_URL!
) else (
    echo [INFO] 正在修改远程地址...
    git remote set-url origin !USER_REPO_URL!
)
echo [SUCCESS] 仓库地址已更新。

:START_BACKUP
:: --- 备份流程 ---
echo.
echo [INFO] 正在添加文件 (git add)...
git add .

:: 设置提交信息
set "COMMIT_MSG="
set /p COMMIT_MSG="请输入提交注释 (留空则默认): "

if "!COMMIT_MSG!"=="" (
    set "COMMIT_MSG=Auto backup %date% %time%"
)

echo [INFO] 提交信息: "!COMMIT_MSG!"
git commit -m "!COMMIT_MSG!"

echo [INFO] 正在推送到远程仓库...

:: 获取分支名
set "CURRENT_BRANCH=main"
for /f "tokens=*" %%a in ('git branch --show-current') do set CURRENT_BRANCH=%%a

:: 推送
git push -u origin !CURRENT_BRANCH!

if errorlevel 1 (
    echo.
    echo [ERROR] 推送被拒绝。
    echo ----------------------------------------
    echo 这种情况通常发生在：
    echo 1. 这是一个新关联的仓库，本地和远程历史不符。
    echo 2. 网络问题。
    echo ----------------------------------------
    choice /M "是否尝试【强制推送】(覆盖远程仓库)?"
    if !errorlevel! equ 1 (
        git push -u origin !CURRENT_BRANCH! --force
        if not errorlevel 1 echo [SUCCESS] 强制推送成功!
    )
) else (
    echo.
    echo [SUCCESS] 备份成功完成!
)

pause
