# 念念日历 - Supabase 云端同步配置指南

## 为什么用 Supabase？

- **免费**：两个人用完全够，0 成本
- **不用自己买服务器**
- **不用域名备案**
- **前端直接调 API**，不用写后端代码
- **自带实时推送**，一方改了另一方自动收到

---

## 配置步骤（5 分钟搞定）

### 第 1 步：注册 Supabase

1. 打开 https://supabase.com
2. 点右上角 **Sign Up**
3. 用 GitHub 账号注册（最快）或邮箱注册
4. 注册后会跳到 Dashboard

### 第 2 步：创建项目

1. 点 **New Project**
2. 填写：
   - **Name**：`memoday`（随便起）
   - **Database Password**：设一个密码，记住
   - **Region**：选 `Southeast Asia (Singapore)` 或 `Northeast Asia (Tokyo)`（离中国最近的免费区域）
3. 点 **Create new project**
4. 等 1-2 分钟，项目创建完成

### 第 3 步：运行数据库 SQL

1. 左边菜单点 **SQL Editor**
2. 点 **New query**
3. 把 `supabase_schema.sql` 文件的内容全部复制粘贴进去
4. 点 **Run**（绿色按钮）
5. 看到成功提示就完成了

### 第 4 步：拿到 API 地址和密钥

1. 左边菜单点 **Project Settings**（齿轮图标）
2. 点 **API**
3. 找到两个值：
   - **Project URL**：类似 `https://xxxxxxx.supabase.co`
   - **anon public key**：一长串 `eyJhbGci...` 开头的字符串

### 第 5 步：填到代码里

打开 `ios-project/MemodayApp/standalone.html`，找到这两行：

```javascript
var SUPABASE_URL = '';   // 填入 Project URL
var SUPABASE_KEY = '';   // 填入 anon public key
```

替换成你的值，例如：

```javascript
var SUPABASE_URL = 'https://xxxxxxx.supabase.co';
var SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6...';
```

### 第 6 步：构建安装

跟之前一样：
1. 推送到 GitHub → 触发 Actions 构建 IPA
2. Sideloadly 安装到 iPhone

---

## 怎么用

### 你（创建者）

1. 打开念念日历 → **我的** 页面
2. 看到新出现的 **「云端同步」** 区域
3. 点 **「创建配对房间」**
4. 生成一个 6 位配对码（如 `AB3K9X`）
5. 把配对码发给女友

### 女友（加入者）

1. 打开念念日历 → **我的** 页面
2. 点 **「输入配对码加入」**
3. 输入配对码 → 确认
4. 配对成功！

### 配对后

- 你创建的**共享纪念日** → 自动同步到云端 → 30秒内推送到对方手机
- 对方改了时间 → 你的手机也自动更新
- 不用再手动发链接了！

---

## 注意事项

- **个人事件（非共享）不会被同步**，只同步共享纪念日
- **断网时**可以正常使用，联网后自动同步
- **配对码可以反复使用**，不用每次生成新的
- **断开同步**：在设置里点已连接的状态 → 确认断开
