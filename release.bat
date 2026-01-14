@echo off
chcp 65001 >nul
echo ====================================
echo 溜溜网盘 - 发布脚本
echo ====================================
echo.

set /p version="请输入版本号 (例如: 1.0.0): "

if "%version%"=="" (
    echo 错误: 版本号不能为空
    pause
    exit /b 1
)

echo.
echo 准备发布版本: v%version%
echo.

git tag v%version%
if errorlevel 1 (
    echo 错误: 创建 Git Tag 失败
    pause
    exit /b 1
)

echo Git Tag v%version% 创建成功
echo.

git push origin v%version%
if errorlevel 1 (
    echo 错误: 推送 Tag 到远程仓库失败
    pause
    exit /b 1
)

echo.
echo ====================================
echo 发布成功! 版本 v%version% 已推送到远程仓库
echo GitHub Actions 将自动构建并发布到 Releases
echo ====================================
pause
