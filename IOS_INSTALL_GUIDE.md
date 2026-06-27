# 🍎 念念日历 iOS 安装完整指南
# 从 Windows 把 App 装到 iPhone（免费，无需 $99）

## ⚡ 最快方案：直接装 PWA（推荐，2 分钟）

> iPhone 上用 Safari 打开，装到桌面，和原生 App 体验一样
> 通知、离线、全屏都支持

### 步骤
1. iPhone 打开 Safari（**必须用 Safari**，Chrome 不行）
2. 访问：`https://772e2c5c13b4487d91faaa869468fee5.app.codebuddy.work`
3. 点底下的 **↑ 分享按钮**
4. 滑到下面，点 **"添加到主屏幕"**
5. 点右上角 **"添加"**
6. 桌面出现「念念日历」图标 → 完成 ✅

---

## 🔧 方案二：Sideloadly + 云 Mac 构建（免费，需要 1 小时）

> 如果你真的想要原生 App（图标没有 Safari 角标），用这个方案

### 整体流程
```
你的 Windows 电脑
    ↓ 推代码到 GitHub
GitHub Actions（免费云 Mac）
    ↓ 自动构建
下载 IPA 文件
    ↓
Sideloadly（Windows 软件）
    ↓ USB 连接 iPhone
安装到手机 ✅
```

### 第一步：创建 GitHub 仓库（5 分钟）

1. 打开 https://github.com
2. 点右上角 **+** → **New repository**
3. 仓库名填：`memoday`
4. 选 **Public**（私有仓库 GitHub Actions 不免费）
5. 点 **Create repository**
6. 复制仓库地址，比如：`https://github.com/你的用户名/memoday.git`

### 第二步：推代码到 GitHub

在你电脑上（`F:\3112321321321\memoday` 目录）运行：

```bash
# 设置 git 用户信息（第一次用 git 需要）
git config --global user.email "你的邮箱@qq.com"
git config --global user.name "你的名字"

# 提交代码
git add .
git commit -m "初始提交"

# 关联 GitHub 仓库（把下面的地址换成你自己的）
git remote add origin https://github.com/你的用户名/memoday.git

# 推送到 GitHub
git push -u origin master
```

### 第三步：触发自动构建

1. 打开你的 GitHub 仓库页面
2. 点上方 **Actions** 标签
3. 左边选 **Build iOS IPA**
4. 点右边 **Run workflow** → **Run workflow**
5. 等 10-15 分钟
6. 构建完成后，在 Artifacts 里下载 `Memoday-iOS-IPA.zip`

### 第四步：用 Sideloadly 装到 iPhone

1. 电脑下载 Sideloadly：https://sideloadly.io（选 Windows 版）
2. iPhone 用 USB 连电脑
3. 打开 Sideloadly
4. 输入你的 Apple ID（普通免费账号就行）
5. 点 **IPA** 按钮，选择下载的 IPA 文件
6. 点 **Start**
7. iPhone 上出现「念念日历」→ 完成 ✅

> ⚠️ 免费 Apple ID 限制：每 7 天需要重新装一次
> 解决：Sideloadly 支持 WiFi 无线刷新，装好后再也不用手动重装

---

## 💡 方案三：找朋友帮忙（最快出原生 App）

如果你有朋友用 Mac：
1. 把 `F:\3112321321321\memoday` 整个文件夹发给他
2. 让他用 Xcode 打开 `ios/App/App.xcworkspace`
3. 连上他的 iPhone
4. 点 ▶️ 运行
5. App 装到他 iPhone 上
6. 让他用 **Ad Hoc** 方式帮你导出 IPA
7. 你用 Sideloadly 装到自己的 iPhone

---

## 🏆 我的建议

| 需求 | 方案 | 时间 | 成本 |
|------|------|------|------|
| 只要自己用 | **方案一：PWA** | 2 分钟 | 免费 |
| 想要原生图标 | **方案二：GitHub Actions** | 30 分钟 | 免费 |
| 有朋友有 Mac | **方案三：朋友帮忙** | 10 分钟 | 一顿饭 |

**PWA 其实是最省事的：**
- ✅ 你 iPhone 装好
- ✅ 女朋友安卓装好
- ✅ 通知正常
- ✅ 不用折腾打包
- ✅ 数据自动同步（都是存在手机本地）

---

## ❓ 常见问题

**Q：PWA 装到 iPhone 后图标有 Safari 角标？**
A：这是 iOS 的限制，目前无法去除。iOS 17+ 有所改善，角标变小了。

**Q：Sideloadly 安全吗？**
A：安全，它是开源工具，只做签名和安装，不会上传你的 Apple ID。

**Q：7 天后真的要重装吗？**
A：是的，免费 Apple ID 的限制。但 Sideloadly 支持**无线刷新**——只要电脑和 iPhone 在同一 WiFi，可以自动续期，不用重装。

**Q：GitHub Actions 构建失败怎么办？**
A：把报错截图发给我，我帮你改 workflow 配置。

---

## 🚀 现在就开始

**推荐先用方案一（PWA）：**
1. 拿出 iPhone
2. Safari 打开云端链接
3. 分享 → 添加到主屏幕
4. 2 分钟搞定，马上就能用！

试完如果觉得 PWA 不够"原生"，再试方案二。
