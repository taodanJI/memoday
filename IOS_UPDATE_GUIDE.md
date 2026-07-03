# 📱 念念日历 - iOS 更新指南

## 更新流程（从修改代码到装到 iPhone）

> 你是 Windows 用户，没有 Mac，所以用 GitHub 云端 Mac 构建 IPA，再用 Sideloadly 装到 iPhone

---

### 第一步：推代码到 GitHub（已完成 ✅）

代码已经推送到 `https://github.com/taodanJI/memoday`

每次修改代码后，在项目目录执行：
```bash
cd F:\3112321321321\memoday
git add .
git commit -m "更新说明"
git push origin main
```

---

### 第二步：触发 iOS IPA 构建（需手动操作）

1. 打开浏览器，访问：**https://github.com/taodanJI/memoday/actions**
2. 左边列表选 **Build iOS IPA**
3. 点右边 **Run workflow** 按钮
4. 确认 Branch 选的是 **main**，点绿色 **Run workflow**
5. 等待 10-15 分钟（黄色圆圈→绿色对勾=成功）
6. 点进去构建记录，拉到最下面 **Artifacts**
7. 点 **Memoday-iOS-IPA** 下载 ZIP 文件
8. 解压得到 `Memoday.ipa`

> ⚠️ push 到 main 分支也会自动触发构建，不用手动点 Run workflow

---

### 第三步：用 Sideloadly 安装/更新到 iPhone

1. 电脑打开 **Sideloadly**（如果没安装，去 https://sideloadly.io 下载 Windows 版）
2. iPhone 用 **USB 线**连电脑
3. Sideloadly 左边选你的 iPhone
4. 点 **IPA** 按钮，选择刚下载的 `Memoday.ipa`
5. 输入你的 **Apple ID**（免费账号就行，不需要 $99）
6. 点 **Start**
7. 等几分钟，iPhone 上出现「念念日历」→ 更新完成 ✅

> 📌 如果是更新（之前已安装过），Sideloadly 会自动替换旧版本，**数据不会丢失**
> （数据存手机本地 localStorage，重新安装也保留）

---

### 第四步：iPhone 信任开发者证书（首次需要）

如果是第一次安装，需要在 iPhone 上：
1. **设置 → 通用 → VPN与设备管理**
2. 找到你的开发者账号，点 **信任**

> 以后每次更新重新安装，如果证书变了需要再信任一次

---

## ⚠️ 免费 Apple ID 限制

免费 Apple ID 签名的 App **每 7 天需要重签**，否则会闪退无法打开。

**解决方法：**
- Sideloadly 支持 **无线刷新**（Anisette），电脑和 iPhone 在同一 WiFi 下可以自动续期
- 设置好后基本不用手动操作，7天自动续期

---

## 🔧 本次更新内容（2026-06-28）

- ✅ **修复通知权限弹窗**：iOS 不再每次打开App都弹权限请求，改为只在保存事件时请求（跟Android一致）
- ✅ **已有功能**：分享链接、通知提醒、日历显示等

---

## 📋 以后每次更新的简化流程

```
改代码 → git push → 等 GitHub Actions 构建完 → 下载 IPA → Sideloadly 安装
```

大概需要 15-20 分钟（主要等云端构建）。

---

## 💡 最省事的替代方案：PWA

如果你不想每次都折腾 IPA 安装：

1. iPhone Safari 打开：`https://772e2c5c13b4487d91faaa869468fee5.app.codebuddy.work`
2. 点分享按钮 → 添加到主屏幕
3. 体验跟原生 App 差不多，而且更新只要改代码推到服务器就行，**不需要重新安装**

> PWA 的唯一缺点：图标有个小小的 Safari 角标

---

## ❓ 常见问题

**Q：更新后数据会丢吗？**
A：不会。数据存 localStorage，重新安装也会保留（除非你卸载App）

**Q：Sideloadly 提示"Already installed"怎么办？**
A：直接覆盖安装就行，选同一个 IPA，Sideloadly 会自动替换

**Q：7 天后 App 闪退怎么办？**
A：重新用 Sideloadly 安装一次（1分钟搞定），或者设置无线刷新自动续期

**Q：GitHub Actions 构建失败怎么办？**
A：把报错截图发给我，我帮你修 workflow 配置
