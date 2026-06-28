@echo off
chcp 65001 >nul 2>&1
echo ============================================
echo   Memoday APK Builder
echo ============================================
echo.

set "SDK_DIR=%USERPROFILE%\android-sdk"
set "JAVA_VER=17"

:: Check Java
java -version >nul 2>&1
if errorlevel 1 (
    echo [!] Java not found!
    echo     Please install JDK %JAVA_VER% first:
    echo     https://adoptium.net/temurin/releases/?version=%JAVA_VER%&jdk=hotspot&os=windows&arch=x64
    pause
    exit /b 1
)
for /f "tokens=3" %%v in ('java -version 2^>^1 ^| findstr /i version') do set JAVA_VERS=%%v
echo [OK] Java found: %JAVA_VERS%
echo.

:: Setup Android SDK
if not exist "%SDK_DIR%" (
    echo [1/4] Downloading Android SDK tools...
    mkdir "%SDK_DIR%\cmdline-tools" >nul 2>nul
    
    :: Download command-line tools
    curl -sL -o "%TEMP%\cmdtools.zip" "https://dl.google.com/android/repository/commandlinetools-windows-11076708_latest.zip"
    if errorlevel 1 (
        echo [ERROR] Download failed! Check internet connection.
        pause
        exit /b 1
    )
    
    cd /d "%SDK_DIR%\cmdline-tools"
    powershell -command "Expand-Archive -Path '%TEMP%\cmdtools.zip' -DestinationPath . -Force"
    rename cmdline-tools latest >nul 2>nul
    del "%TEMP%\cmdtools.zip" >nul 2>nul
    echo [OK] Tools downloaded.
) else (
    echo [SKIP] SDK already exists at %SDK_DIR%
)

set "ANDROID_HOME=%SDK_DIR%"
set "PATH=%SDK_DIR%\cmdline-tools\latest\bin;%PATH%"
echo.
echo [2/4] Accepting licenses...
yes | sdkmanager --licenses >nul 2>&1 || true

echo [3/4] Installing platform & build-tools...
sdkmanager "platforms;android-34" "build-tools;34.0.0" 2>&1 | findstr /V "="
echo.
echo [4/4] Building APK...
echo -------------------------------------------
cd /d "%~dp0"
call gradlew.bat assembleRelease --no-daemon
if errorlevel 1 (
    echo.
    echo [ERROR] Build failed!
    pause
    exit /b 1
)

echo.
echo ============================================
echo   BUILD SUCCESS!
echo ============================================
for /r app\build %%f in (*.apk) do (
    if exist "%%f" (
        echo APK Location: %%f
        explorer /select,"%%f"
    )
)
echo.
pause
