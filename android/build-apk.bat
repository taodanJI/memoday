@echo off
chcp 65001 >nul 2>&1
setlocal enabledelayedexpansion

echo ============================================
echo   Memoday APK Builder (一键构建)
echo ============================================
echo.

:: ===== Step 1: Setup JAVA_HOME =====
if not defined JAVA_HOME (
    echo [1/5] Checking for JDK...
    set "JDK_DIR=C:\jdk-17"
    
    if not exist "%JDK_DIR%\bin\java.exe" (
        echo     Downloading JDK 17...
        curl -sL -o "%TEMP%\jdk17.zip" "https://api.adoptium.net/v3/binary/latest/17/ga/windows/x64/jdk/hotspot/normal/eclipse?project=jdk"
        if errorlevel 1 (
            echo [ERROR] JDK download failed!
            pause
            exit /b 1
        )
        
        powershell -command "Expand-Archive -Path '%TEMP%\jdk17.zip' -DestinationPath 'C:\' -Force"
        move /y C:\jdk-* "%JDK_DIR%" >nul 2>nul
        del "%TEMP%\jdk17.zip" >nul 2>nul
        echo [OK] JDK 17 installed.
    ) else (
        echo [OK] JDK already installed.
    )
    
    set "JAVA_HOME=%JDK_DIR%"
    set "PATH=%JAVA_HOME%\bin;%PATH%"
)

for /f "tokens=3" %%v in ('"%JAVA_HOME%\bin\java.exe" -version 2^>^1 ^| findstr /i version') do set JV=%%v
echo     Java: %JV%
echo.

:: ===== Step 2: Setup Android SDK =====
set "SDK_DIR=%USERPROFILE%\android-sdk"

if not exist "%SDK_DIR%\cmdline-tools\latest" (
    echo [2/5] Downloading Android SDK tools...
    mkdir "%SDK_DIR%\cmdline-tools" >nul 2>nul
    
    curl -sL -o "%TEMP%\cmdtools.zip" "https://dl.google.com/android/repository/commandlinetools-windows-11076708_latest.zip"
    if errorlevel 1 (
        echo [ERROR] SDK download failed!
        pause
        exit /b 1
    )
    
    cd /d "%SDK_DIR%\cmdline-tools"
    powershell -command "Expand-Archive -Path '%TEMP%\cmdtools.zip' -DestinationPath . -Force"
    rename cmdline-tools latest >nul 2>nul
    del "%TEMP%\cmdtools.zip" >nul 2>nul
    echo [OK] SDK tools ready.
) else (
    echo [2/5] SDK already exists.
)

set "ANDROID_HOME=%SDK_DIR%"
set "PATH=%SDK_DIR%\cmdline-tools\latest\bin;%PATH%"

:: ===== Step 3: Accept licenses & install components =====
echo [3/5] Installing Android platform & build-tools...
yes | sdkmanager --licenses >nul 2>&1 || true
sdkmanager "platforms;android-34" "build-tools;34.0.0" >nul 2>&1 || true
echo [OK] Components installed.
echo.

:: ===== Step 4: Build APK =====
echo [4/5] Building release APK...
echo -------------------------------------------
cd /d "%~dp0"
call gradlew.bat assembleRelease --no-daemon
if errorlevel 1 (
    echo.
    echo [ERROR] Build failed! Check errors above.
    pause
    exit /b 1
)
echo.
echo [OK] Build successful!
echo.

:: ===== Step 5: Show result =====
echo [5/5] Finding APK file...
echo --------------------------------===========
for /r app %%f in (*.apk) do (
    if /i not "%%~xf"==".apk" (
    ) else (
        set "APK_FILE=%%f"
    )
)

if defined APK_FILE (
    echo   APK Location: %APK_FILE%
    echo ============================================
    explorer /select,"%APK_FILE%"
) else (
    echo   Searching for APK in all subdirectories...
    for /r . %%f in (*release*.apk) do (
        if exist "%%f" (
            echo   Found: %%f
            explorer /select,"%%f"
        )
    )
    for /r . %%f in (*.apk) do (
        if exist "%%f" (
            echo   Found: %%f
            explorer /select,"%%f"
        )
    )
)

echo.
echo Done! You can close this window.
pause
