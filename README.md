# 网盘通 (NetDiskHub)

一个 Chrome 浏览器插件，将各家网盘账号集中管理，一键自动登录。

## 功能

- **网盘账号集中管理**：支持百度网盘、阿里云盘、夸克网盘、天翼云盘、115网盘、蓝奏云等
- **一键自动登录**：点击网盘图标，自动打开页面并填充账号密码登录
- **加密存储**：密码采用 AES-GCM 加密 + PBKDF2 密钥派生，安全存储在本地
- **多端同步**：通过 Chrome Sync 实现跨设备数据同步
- **备忘录**：2000 字符简易备注，自动同步
- **登录设备管理**：查看所有登录设备，支持移除（最多 5 台）
- **头像自定义**：支持上传并裁剪头像

## 安装方法

### 开发者模式加载

1. 下载本项目代码
2. 打开 Chrome 浏览器，访问 `chrome://extensions`
3. 开启右上角**开发者模式**
4. 点击**加载已解压的扩展程序**
5. 选择本项目文件夹，点击确定

### 打包 CRX

在 `chrome://extensions` 页面点击**打包扩展程序**，选择本项目文件夹即可生成 `.crx` 文件。

## 技术栈

- Manifest V3
- Service Worker (background.js)
- AES-GCM 加密
- chrome.storage API

## 项目结构

```
├── manifest.json       # 插件配置
├── background.js       # 核心后台逻辑
├── content.js          # 登录表单自动填充
├── crypto-utils.js     # 加密工具模块
├── drives-config.js    # 网盘配置
├── popup.html/css/js   # 弹出菜单
├── options.html/css/js # 设置页面
└── icons/              # 图标资源
```

## 许可证

MIT