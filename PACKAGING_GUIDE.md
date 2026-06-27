# 念念日历 - 开发者打包指南
# 如何打包成 Android APK 和 iOS App

有两种主要方案，**推荐先用方案一快速出包**，方案二适合需要上架应用商店的场景。

---

## 方案一：PWABuilder（最快，5分钟出包）

> **推荐！** 不需要安装 Android Studio 或 Xcode，在线完成，免费。
> 适合：快速出包测试、分发给用户、上架 Google Play / Microsoft Store

### 步骤

#### 1. 把 PWA 部署到公网（必须，PWABuilder 需要可访问的 URL）

你已经有云端部署链接了：
```
https://772e2c5c13b4487d91faaa869468fee5.app.codebuddy.work
```

如果链接失效，用下面任意方式部署：

**方式 A：用 WorkBuddy 部署（已做）**
- 你的云端链接已就绪

**方式 B：用 Vercel（免费，推荐）**
```bash
npm install -g vercel
cd F:/3112321321321/memoday
vercel --prod
# 按提示操作，会得到 https://xxx.vercel.app
```

**方式 C：用 GitHub Pages（免费）**
```bash
# 创建 GitHub 仓库，push 代码，开启 Pages
# 地址会是 https://你的用户名.github.io/memoday/
```

#### 2. 打开 PWABuilder

访问：https://www.pwabuilder.com

#### 3. 输入你的 PWA 网址

在输入框粘贴你的网址，点 "Start" 或 "Build My PWA"

#### 4. 检查结果

PWABuilder 会分析你的 PWA，检查：
- ✅ Manifest 文件（已有 ✅）
- ✅ Service Worker（已有 ✅）
- ✅ HTTPS（部署后自动有 ✅）
- ✅ 图标（已有 ✅）

#### 5. 下载打包好的安装包

分析通过后，点 "Download my package"，选择：

**Android：**
- 格式：选择 "Android APK"
- 下载后得到 `.apk` 文件
- 直接安装到安卓手机（需开启"允许安装未知来源应用"）

**iOS：**
- 格式：选择 "iOS"
- 下载后得到 Xcode 项目
- 用 Mac + Xcode 打开，连接 iPhone，点 ▶️ 运行
- 或 Archive 打包成 `.ipa`（需 Apple 开发者账号 $99/年）

**Windows：**
- 格式：选择 "Windows MSIX"
- 下载后双击安装，上架 Microsoft Store

---

## 方案二：Capacitor + Android Studio（专业，可上架应用商店）

> 适合：需要上架 Google Play / 华为应用市场，或需要调用原生功能（推送、通讯录等）
> 需要：Android Studio（免费）

### 前提：安装 Android Studio

1. 下载：https://developer.android.com/studio
2. 安装时勾选：
   - ✅ Android SDK
   - ✅ Android SDK Platform
   - ✅ Android Virtual Device（模拟器，可选）
3. 安装完成后，打开 Android Studio → Settings → Android SDK → SDK Platforms
   - 勾选 **Android 13 (API 33)** 或更高
   - 点 Apply 安装

### 步骤

#### 1. 同步 Web 资源到 Android

```bash
cd F:/3112321321321/memoday
npx cap sync android
```

#### 2. 用 Android Studio 打开项目

```bash
npx cap open android
```
这会自动打开 Android Studio。

#### 3. 等待 Gradle 同步完成

Android Studio 底部会显示进度，第一次需要 5-10 分钟下载依赖。

#### 4. 修改应用配置（可选但推荐）

在 Android Studio 中打开：
`app/src/main/java/com/memoday/app/MainActivity.java`

确认内容类似：
```java
package com.memoday.app;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    // 无需修改
}
```

打开 `app/src/main/res/values/strings.xml` 修改应用名称：
```xml
<resources>
    <string name="app_name">念念日历</string>
</resources>
```

#### 5. 构建 APK

**方式 A：Android Studio 图形界面**
1. 菜单：Build → Generate Signed Bundle / APK
2. 选择 "APK" → Next
3. 首次需要创建签名密钥（Key Store）：
   - Key store path：选一个位置保存 `.jks` 文件
   - Password：设置密码（记住！）
   - Key alias：输入 `memoday`
   - Validity：25 年
4. 选择 "Release" → Finish
5. APK 生成在：`android/app/release/app-release.apk`

**方式 B：命令行构建（需先创建签名）**
```bash
cd F:/3112321321321/memoday/android
./gradlew assembleRelease
# APK 在：android/app/build/outputs/apk/release/app-release.apk
```

#### 6. 安装到手机

- 把 `app-release.apk` 传到安卓手机
- 开启"设置 → 安全 → 允许安装未知来源应用"
- 点击 APK 文件安装

---

## 方案三：Capacitor + Xcode（iOS 打包，需要 Mac）

> ⚠️ **iOS 打包必须在 Mac 电脑上完成**，Windows 无法构建 iOS App
> 需要：Mac + Xcode + Apple 开发者账号（$99/年，测试可以免费用 7 天）

### 步骤

#### 1. 在 Mac 上安装依赖

```bash
# 安装 Node.js
brew install node

# 安装 CocoaPods（iOS 依赖管理）
sudo gem install cocoapods

# 复制项目到 Mac（或用 Git 同步）
```

#### 2. 添加 iOS 平台

```bash
cd memoday
npm install @capacitor/ios
npx cap add ios
npx cap sync ios
```

#### 3. 用 Xcode 打开

```bash
npx cap open ios
```

#### 4. 配置签名

在 Xcode 中：
1. 选中左侧 "App" 项目
2. Signing & Capabilities 标签页
3. Team：选择你的 Apple 开发者账号
4. Bundle Identifier：确认是 `com.memoday.app`

#### 5. 构建并安装到 iPhone

**方式 A：直接运行到手机**
1. iPhone 连 Mac（USB）
2. iPhone：设置 → 通用 → VPN与设备管理 → 信任你的开发者证书
3. Xcode：选择你的 iPhone → 点 ▶️ 运行
4. App 安装到 iPhone

**方式 B：打包 IPA（上架 App Store）**
1. Xcode：菜单 Product → Archive
2. 完成后点 "Distribute App"
3. 选择 "App Store Connect" → 上传
4. 在 App Store Connect 网站填写应用信息、截图
5. 提交审核（通常 1-3 天）

**方式 C：用 PWABuilder 生成的 iOS 项目**
- 解压 PWABuilder 下载的 iOS 包
- 用 Xcode 打开 `.xcodeproj` 文件
- 后续步骤同上

---

## 方案四：Java .jar（PC 端运行，非手机）

如果你只是想在电脑上运行，不需要手机 App：

```bash
# 用 WorkBuddy 内置的 Python HTTP 服务器
cd F:/3112321321321/memoday
python -m http.server 8080
# 浏览器打开 http://localhost:8080
```

---

## 推荐决策表

| 需求 | 推荐方案 | 时间 |
|------|----------|------|
| 快速出 APK 测试 | PWABuilder | 5 分钟 |
| 上架 Google Play | Capacitor + Android Studio | 1 天 |
| 上架华为应用市场 | Capacitor + Android Studio | 1 天 |
| 出 iOS IPA（有 Mac） | Capacitor + Xcode | 1 天 |
| 出 iOS IPA（无 Mac） | PWABuilder → 找朋友用 Mac 打开项目 | 1 小时 |
| 企业内部分发 | PWABuilder APK | 5 分钟 |

---

## 常见问题

### Q：PWABuilder 生成的 APK 能上架 Google Play 吗？
**A：** 可以！PWABuilder 生成的 APK 是标准的 Android App Bundle，符合 Google Play 要求。

### Q：iOS 一定要花 $99 吗？
**A：** 测试可以免费（Xcode 免费账号，限制 7 天，每次重签）。上架 App Store 必须 $99/年。

### Q：Windows 上能打包 iOS 吗？
**A：** 不能。iOS 打包必须在 Mac 上用 Xcode 完成。如果只有 Windows，用 PWABuilder 生成 iOS 项目，然后找朋友用 Mac 帮打包。

### Q：APK 安装后通知不工作？
**A：** 安卓 13+ 需要手动开启通知权限。在 App 第一次启动时弹窗请求权限，或引导用户到系统设置开启。

### Q：能让 App 在应用商店搜索到吗？
**A：** 需要上架。Google Play（免费上架，一次性 $25 注册费），App Store（$99/年），华为应用市场（免费）。

---

## 下一步

1. **先用 PWABuilder 快速出包** → https://www.pwabuilder.com
2. 测试没问题后，**用 Android Studio 重新打包**（如需上架）
3. iOS 找一台 Mac，**用 Xcode 打包**

如需帮助，把报错截图发给我。
