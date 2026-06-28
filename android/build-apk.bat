@echo off
chcp 65001 >nul 2>&1
setlocal enabledelayedexpansion

echo ============================================
echo   Memoday APK Builder (一键构建)
echo ============================================
echo.

:: ===== Step 1: Setup JAVA_HOME =====
set "JAVA_EXE="
set "JAVA_HOME="

:: Try common locations first
if exist "C:\Program Files\Java\jdk-17\bin\java.exe" (
    set "JAVA_HOME=C:\Program Files\Java\jdk-17"
)
if exist "C:\Program Files\Eclipse Adoptium\jdk-*\bin\java.exe" (
    for /d %%d in ("C:\Program Files\Eclipse Adoptium\jdk-*") do set "JAVA_HOME=%%d"
)

:: If not found, use winget to install
if not defined JAVA_HOME (
    if not exist "C:\jdk-17\bin\java.exe" (
        echo [1/5] Installing JDK 17 via winget...
        echo     This may take a minute...
        winget install EclipseAdoptium.Temurin.17.JDK --accept-source-agreements --accept-package-agreements --silent >nul 2>&1
        
        :: Check if winget installed it somewhere
        for /d %%d in ("C:\Program Files\Eclipse Adoptium\jdk-*") do set "JAVA_HOME=%%d"
        for /d %%d in ("C:\Program Files\Java\jdk*") do set "JAVA_HOME=%%d"
        
        if not defined JAVA_HOME (
            echo [!] Winget may need admin. Trying alternative download...
            curl -sL -o "%TEMP%\jdk17.msi" "https://github.com/adoptium/temurin17-binaries/releases/download/jdk-17.0.12%%2B7/OpenJDK17U-jdk_x64_windows_hotspot_17.0.12_7.msi"
            if exist "%TEMP%\jdk17.msi" (
                msiexec /i "%TEMP%\jdk17.msi" /quiet INSTALLDIR=C:\jdk-17 >nul 2>&1
                set "JAVA_HOME=C:\jdk-17"
                del "%TEMP%\jdk17.msi" >nul 2>nul
            )
        )
    ) else (
        set "JAVA_HOME=C:\jdk-17"
    )
)

if defined JAVA_HOME (
    if exist "%JAVA_HOME%\bin\java.exe" (
        set "PATH=%JAVA_HOME%\bin;%PATH%"
        for /f "tokens=3" %%v in ('"%JAVA_HOME%\bin\java.exe" -version 2^>^1 ^| findstr /i version') do set JV=%%v
        echo [OK] Java found: %JV%
    ) else (
        echo [ERROR] Java not installed properly!
        echo Please download JDK 17 manually:
        echo https://adoptium.net/temurin/releases/?version=17^&os=windows
        pause
        exit /b 1
    )
) else (
    echo [ERROR] Could not find or install JDK!
    echo Please download and install JDK 17 manually:
    echo https://adoptium.net/temurin/releases/?version=17^&os=windows
    pause
    exit /b 1
)
echo.

:: ===== Step 2: Setup Android SDK =====
set "SDK_DIR=%USERPROFILE%\android-sdk"

if not exist "%SDK_DIR%\cmdline-tools\latest" (
    echo [2/5] Downloading Android SDK tools (~150MB)...
    mkdir "%SDK_DIR%\cmdline-tools" >nul 2>nul
    
    curl -sLo "%TEMP%\cmdtools.zip" "https://dl.google.com/android/repository/commandlinetools-windows-11076708_latest.zip"
    if errorlevel 1 (
        echo [ERROR] SDK download failed! Check internet.
        pause
        exit /b 1
    )
    
    cd /d "%SDK_DIR%\cmdline-tools"
    powershell -NoProfile -Command "Expand-Archive -LiteralPath '%TEMP%\cmdtools.zip' -DestinationPath . -Force"
    rename cmdline-tools latest >nul 2>nul
    del "%TEMP%\cmdtools.zip" >nul 2>nul
    echo [OK] SDK tools ready.
) else (
    echo [2/5] SDK already exists.
)

set "ANDROID_HOME=%SDK_DIR%"
set "PATH=%SDK_DIR%\cmdline-tools\latest\bin;%PATH%"

:: ===== Step 3: Accept licenses & install components =====
echo [3/5] Installing platform & build-tools...
yes | sdkmanager --licenses >nul 2>&1 || true
sdkmanager "platforms;android-34" "build-tools;34.0.0" >nul 2>&1 || true
echo [OK] Done.
echo.

:: ===== Step 4: Build APK =====
echo [4/5] Building release APK...
echo -------------------------------------------
cd /d "%~dp0"
call gradlew.bat assembleRelease --no-daemon 2>&1 | findstr /V "^\[" 
if errorlevel 1 (
    echo.
    echo [ERROR] Build failed!
    pause
    exit /b 1
)
echo.
echo [OK] Build successful!
echo.

:: ===== Step 5: Show result =====
echo [5/5] Finding APK...
echo --------------------------------===========
for /r . %%f in (*release*.apk) do (
    if exist "%%f" (
        echo   APK Location: %%f
        explorer /select,"%%f"
    )
)
for /r . %%f in (*.apk) do (
    if exist "%%f" (
        echo   Also found: %%f
    )
)
echo.
echo Done!
pause
