// 网盘通 - Service Worker
// 负责数据存储管理、消息中转、跨设备数据同步
// 邮箱+密码登录体系，验证码注册，会话管理，备忘录同步

// 导入配置
try {
  importScripts('drives-config.js', 'crypto-utils.js');
} catch (e) {
  console.warn('模块加载失败:', e.message);
}

// ===== 存储键名 =====
const STORAGE_KEYS = {
  PROFILE: 'wpt_profile',
  ACCOUNTS: 'wpt_accounts',
  SETTINGS: 'wpt_settings',
  SYNC_META: 'wpt_sync_meta',
  MEMO: 'wpt_memo',
  SESSIONS: 'wpt_sessions',
  PENDING_VERIFY: 'wpt_pending_verify'
};

// ===== 默认设置 =====
const DEFAULT_SETTINGS = {
  autoFill: true,
  autoSubmit: false,
  openNewTab: true,
  theme: 'light',
  sortBy: 'name'
};

// ===== 默认用户资料 =====
const DEFAULT_PROFILE = {
  avatar: '',
  nickname: '',
  email: '',
  emailVerified: false,
  masterPasswordHash: '',
  passwordVersion: 1,
  createdAt: null,
  updatedAt: null
};

// ===== 安装/更新事件 =====
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('网盘通 插件已安装/更新:', details.reason);

  if (details.reason === 'install') {
    await chrome.storage.sync.set({
      [STORAGE_KEYS.SETTINGS]: DEFAULT_SETTINGS,
      [STORAGE_KEYS.MEMO]: ''
    });
    await chrome.storage.local.set({
      [STORAGE_KEYS.PROFILE]: DEFAULT_PROFILE,
      [STORAGE_KEYS.ACCOUNTS]: [],
      [STORAGE_KEYS.SESSIONS]: []
    });
    console.log('网盘通 初始化完成');
    chrome.tabs.create({ url: chrome.runtime.getURL('options.html') });
  }
});

// ===== 启动时注册当前会话 =====
(async function registerSession() {
  try {
    const profile = (await chrome.storage.local.get(STORAGE_KEYS.PROFILE))[STORAGE_KEYS.PROFILE];
    if (profile && profile.email && profile.emailVerified) {
      await recordSession(profile);
    }
  } catch (e) {
    console.warn('会话注册失败:', e.message);
  }
})();

// ===== 数据云同步监听 =====
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'sync') {
    const syncKeys = Object.keys(changes);
    console.log('云端数据变更:', syncKeys);

    // 检测密码版本变更 → 所有端需要重新登录
    if (syncKeys.includes(STORAGE_KEYS.SETTINGS)) {
      const newSettings = changes[STORAGE_KEYS.SETTINGS].newValue;
      const oldSettings = changes[STORAGE_KEYS.SETTINGS].oldValue;
      if (newSettings && oldSettings &&
          newSettings.passwordVersion !== oldSettings.passwordVersion) {
        console.log('检测到密码已修改，需要重新登录');
        // 清除本地会话
        chrome.storage.local.remove(STORAGE_KEYS.SESSIONS);
        // 通知所有页面
        notifyAllTabs('password_changed', {
          message: '主密码已在其他设备修改，请重新登录'
        });
      }
    }
  }
});

/**
 * 通知所有标签页
 */
function notifyAllTabs(action, data) {
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach(tab => {
      chrome.tabs.sendMessage(tab.id, { action, ...data }).catch(() => {});
    });
  });
  // 也通知 popup 和 options 页面
  chrome.runtime.sendMessage({ action, ...data }).catch(() => {});
}

// ===== 消息处理中心 =====
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  handleMessage(request, sender).then(sendResponse).catch(err => {
    sendResponse({ success: false, error: err.message });
  });
  return true;
});

async function handleMessage(request, sender) {
  switch (request.action) {
    // ===== 数据读取 =====
    case 'getProfile': {
      const result = await chrome.storage.local.get(STORAGE_KEYS.PROFILE);
      return { success: true, data: result[STORAGE_KEYS.PROFILE] || DEFAULT_PROFILE };
    }
    case 'getAccounts': {
      const result = await chrome.storage.local.get(STORAGE_KEYS.ACCOUNTS);
      return { success: true, data: result[STORAGE_KEYS.ACCOUNTS] || [] };
    }
    case 'getSettings': {
      const result = await chrome.storage.sync.get(STORAGE_KEYS.SETTINGS);
      return { success: true, data: result[STORAGE_KEYS.SETTINGS] || DEFAULT_SETTINGS };
    }
    case 'getMemo': {
      const result = await chrome.storage.sync.get(STORAGE_KEYS.MEMO);
      return { success: true, data: result[STORAGE_KEYS.MEMO] || '' };
    }
    case 'getSessions': {
      const result = await chrome.storage.local.get(STORAGE_KEYS.SESSIONS);
      return {
        success: true,
        sessions: result[STORAGE_KEYS.SESSIONS] || [],
        currentDeviceId: getDeviceId()
      };
    }
    case 'removeSession': {
      const { deviceId } = request;
      if (!deviceId) return { success: false, error: '设备ID不能为空' };
      await removeSession(deviceId);
      return { success: true };
    }
    case 'getAllData': {
      const local = await chrome.storage.local.get([STORAGE_KEYS.PROFILE, STORAGE_KEYS.ACCOUNTS, STORAGE_KEYS.SESSIONS]);
      const sync = await chrome.storage.sync.get([STORAGE_KEYS.SETTINGS, STORAGE_KEYS.SYNC_META, STORAGE_KEYS.MEMO]);
      return {
        success: true,
        data: {
          profile: local[STORAGE_KEYS.PROFILE] || DEFAULT_PROFILE,
          accounts: local[STORAGE_KEYS.ACCOUNTS] || [],
          sessions: local[STORAGE_KEYS.SESSIONS] || [],
          settings: sync[STORAGE_KEYS.SETTINGS] || DEFAULT_SETTINGS,
          memo: sync[STORAGE_KEYS.MEMO] || '',
          syncMeta: sync[STORAGE_KEYS.SYNC_META] || null
        }
      };
    }

    // ===== 邮箱验证 =====
    case 'sendVerificationCode':
      return await handleSendVerificationCode(request);

    case 'verifyEmailCode':
      return await handleVerifyEmailCode(request);

    // ===== 数据写入 =====
    case 'saveProfile':
      return await handleSaveProfile(request);

    case 'saveAccount':
      return await handleSaveAccount(request);

    case 'deleteAccount': {
      const allAccounts = (await chrome.storage.local.get(STORAGE_KEYS.ACCOUNTS))[STORAGE_KEYS.ACCOUNTS] || [];
      const filtered = allAccounts.filter(a => a.id !== request.accountId);
      await chrome.storage.local.set({ [STORAGE_KEYS.ACCOUNTS]: filtered });
      return { success: true };
    }

    case 'saveSettings':
      return await handleSaveSettings(request);

    case 'manualSync':
      return await handleManualSync();

    case 'saveMemo': {
      const memo = (request.data || '').substring(0, 2000);
      await chrome.storage.sync.set({ [STORAGE_KEYS.MEMO]: memo });
      return { success: true };
    }

    // ===== 加密/解密 =====
    case 'decryptPassword': {
      if (!request.email || !request.masterPassword || !request.encryptedPassword) {
        return { success: false, error: '缺少解密参数' };
      }
      try {
        const decrypted = await CryptoUtils.decrypt(request.encryptedPassword, request.email, request.masterPassword);
        return { success: true, data: decrypted };
      } catch (e) {
        return { success: false, error: '密码解密失败，主密码可能不正确' };
      }
    }
    case 'encryptPassword': {
      if (!request.email || !request.masterPassword || !request.plainPassword) {
        return { success: false, error: '缺少加密参数' };
      }
      try {
        const encrypted = await CryptoUtils.encrypt(request.plainPassword, request.email, request.masterPassword);
        return { success: true, data: encrypted };
      } catch (e) {
        return { success: false, error: '密码加密失败' };
      }
    }
    case 'verifyMasterPassword': {
      if (!request.email || !request.password) {
        return { success: false, error: '缺少验证参数' };
      }
      const hash = await CryptoUtils.hashPassword(request.password, request.email);
      const prof = (await chrome.storage.local.get(STORAGE_KEYS.PROFILE))[STORAGE_KEYS.PROFILE];
      const isValid = prof && prof.masterPasswordHash === hash;
      return { success: true, data: { valid: isValid, hash: hash } };
    }

    // ===== 一键登录 =====
    case 'loginWithAccount':
      return await handleLoginWithAccount(request);

    // ===== 全量同步 =====
    case 'fullSync':
      return await handleFullSync();

    // ===== 获取 IP/位置信息 =====
    case 'getDeviceInfo':
      return await getDeviceInfo();

    // ===== 刷新会话 =====
    case 'refreshSession':
      return await handleRefreshSession();

    default:
      return { success: false, error: '未知操作: ' + request.action };
  }
}

// ===== 发送验证码 =====
async function handleSendVerificationCode(request) {
  const { email } = request;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { success: false, error: '请输入有效的邮箱地址' };
  }

  const code = CryptoUtils.generateVerificationCode(6);
  const pending = {
    email: email,
    code: code,
    expiresAt: Date.now() + 10 * 60 * 1000 // 10分钟有效期
  };

  await chrome.storage.local.set({ [STORAGE_KEYS.PENDING_VERIFY]: pending });

  console.log(`[网盘通] 验证码已生成: ${code} (发送至 ${email})`);

  // 实际部署时，此处应调用后端 API 发送邮件
  // 开发模式下，通过通知展示验证码
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon128.svg',
    title: '网盘通 - 邮箱验证码',
    message: `验证码: ${code}\n有效期: 10分钟\n接收邮箱: ${email}`,
    priority: 2
  });

  return { success: true, message: '验证码已发送（开发模式通过通知显示）', code: code };
}

// ===== 验证邮箱验证码 =====
async function handleVerifyEmailCode(request) {
  const { email, code } = request;
  const pending = (await chrome.storage.local.get(STORAGE_KEYS.PENDING_VERIFY))[STORAGE_KEYS.PENDING_VERIFY];

  if (!pending) {
    return { success: false, error: '请先发送验证码' };
  }
  if (pending.email !== email) {
    return { success: false, error: '邮箱不匹配' };
  }
  if (Date.now() > pending.expiresAt) {
    await chrome.storage.local.remove(STORAGE_KEYS.PENDING_VERIFY);
    return { success: false, error: '验证码已过期，请重新发送' };
  }
  if (pending.code !== code) {
    return { success: false, error: '验证码错误' };
  }

  // 验证成功，清除 pending
  await chrome.storage.local.remove(STORAGE_KEYS.PENDING_VERIFY);
  return { success: true, message: '邮箱验证成功' };
}

// ===== 保存个人资料 =====
async function handleSaveProfile(request) {
  const profile = { ...DEFAULT_PROFILE, ...request.data, updatedAt: Date.now() };
  if (!profile.createdAt) profile.createdAt = Date.now();

  // 检测密码是否变更
  const oldProfile = (await chrome.storage.local.get(STORAGE_KEYS.PROFILE))[STORAGE_KEYS.PROFILE];
  const passwordChanged = oldProfile && profile.masterPasswordHash &&
    oldProfile.masterPasswordHash !== profile.masterPasswordHash;

  if (passwordChanged) {
    profile.passwordVersion = (oldProfile.passwordVersion || 1) + 1;

    // 更新 settings 中的密码版本（触发其他端重新登录）
    const settings = (await chrome.storage.sync.get(STORAGE_KEYS.SETTINGS))[STORAGE_KEYS.SETTINGS] || DEFAULT_SETTINGS;
    settings.passwordVersion = profile.passwordVersion;
    await chrome.storage.sync.set({ [STORAGE_KEYS.SETTINGS]: settings });
    console.log('密码已修改，版本号:', profile.passwordVersion);
  }

  await chrome.storage.local.set({ [STORAGE_KEYS.PROFILE]: profile });

  // 注册会话
  if (profile.email && profile.emailVerified) {
    try {
      await recordSession(profile);
    } catch (e) {
      console.warn('会话注册失败（可能是设备上限）:', e.message);
      // 不阻塞保存流程
    }
  }

  return { success: true, passwordChanged };
}

// ===== 保存账号 =====
async function handleSaveAccount(request) {
  const accounts = (await chrome.storage.local.get(STORAGE_KEYS.ACCOUNTS))[STORAGE_KEYS.ACCOUNTS] || [];
  const account = { ...request.data, updatedAt: Date.now() };

  // 设置 accountId（编辑模式）
  if (request.accountId) {
    account.id = request.accountId;
  }

  // 如果提供了密码和主密码，加密后存储
  if (account.password && request.masterPassword) {
    const profile = (await chrome.storage.local.get(STORAGE_KEYS.PROFILE))[STORAGE_KEYS.PROFILE];
    const email = profile ? profile.email : '';
    if (email) {
      try {
        account.encryptedPassword = await CryptoUtils.encrypt(account.password, email, request.masterPassword);
        delete account.password;
      } catch (e) {
        return { success: false, error: '加密密码失败: ' + e.message };
      }
    } else {
      return { success: false, error: '未设置邮箱，无法加密密码' };
    }
  } else if (!account.password && !account.encryptedPassword) {
    // 编辑时没提供新密码，保留原有加密密码
    if (account.id) {
      const existing = accounts.find(a => a.id === account.id);
      if (existing) {
        account.encryptedPassword = existing.encryptedPassword;
      }
    }
  }

  if (account.id) {
    const index = accounts.findIndex(a => a.id === account.id);
    if (index >= 0) {
      accounts[index] = { ...accounts[index], ...account };
    } else {
      accounts.push(account);
    }
  } else {
    account.id = 'acc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    account.createdAt = Date.now();
    accounts.push(account);
  }

  await chrome.storage.local.set({ [STORAGE_KEYS.ACCOUNTS]: accounts });
  return { success: true, data: account };
}

// ===== 保存设置 =====
async function handleSaveSettings(request) {
  const settings = { ...DEFAULT_SETTINGS, ...request.data };
  await chrome.storage.sync.set({ [STORAGE_KEYS.SETTINGS]: settings });
  return { success: true };
}

// ===== 手动同步 =====
async function handleManualSync() {
  try {
    // 更新同步时间戳
    const syncMeta = (await chrome.storage.sync.get(STORAGE_KEYS.SYNC_META))[STORAGE_KEYS.SYNC_META] || {};
    syncMeta.lastSync = Date.now();
    await chrome.storage.sync.set({ [STORAGE_KEYS.SYNC_META]: syncMeta });
    return { success: true, meta: syncMeta };
  } catch (e) {
    return { success: false, error: '同步失败: ' + e.message };
  }
}

// ===== 一键登录网盘 =====
async function handleLoginWithAccount(request) {
  const { email, masterPassword, accountId, driveId } = request;

  if (!email || !masterPassword || !accountId || !driveId) {
    return { success: false, error: '缺少登录参数' };
  }

  const accounts = (await chrome.storage.local.get(STORAGE_KEYS.ACCOUNTS))[STORAGE_KEYS.ACCOUNTS] || [];
  const account = accounts.find(a => a.id === accountId);
  if (!account) {
    return { success: false, error: '账号不存在' };
  }

  const drive = getDriveById(driveId);
  if (!drive) {
    return { success: false, error: '网盘配置不存在' };
  }

  const settingsResult = await chrome.storage.sync.get(STORAGE_KEYS.SETTINGS);
  const settings = settingsResult[STORAGE_KEYS.SETTINGS] || {};

  let plainPassword;
  try {
    plainPassword = await CryptoUtils.decrypt(account.encryptedPassword, email, masterPassword);
  } catch (e) {
    return { success: false, error: '密码解密失败，主密码可能不正确' };
  }

  try {
    const tab = await chrome.tabs.create({ url: drive.loginUrl, active: false });

    chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
      if (tabId === tab.id && info.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);
        setTimeout(() => {
          chrome.tabs.sendMessage(tab.id, {
            action: 'fillLoginForm',
            username: account.username,
            password: plainPassword,
            loginSelectors: drive.loginSelectors,
            autoSubmit: settings.autoSubmit || false
          }).catch(() => {
            console.log('[网盘通] 内容脚本注入失败，请手动登录');
          });
        }, 500);
        chrome.tabs.update(tab.id, { active: true });
      }
    });

    // 记录会话
    const profile = (await chrome.storage.local.get(STORAGE_KEYS.PROFILE))[STORAGE_KEYS.PROFILE];
    recordSession(profile);

    return { success: true, message: '正在打开登录页面...' };
  } catch (e) {
    return { success: false, error: '打开登录页面失败: ' + e.message };
  }
}

// ===== 全量同步 =====
async function handleFullSync() {
  const profile = (await chrome.storage.local.get(STORAGE_KEYS.PROFILE))[STORAGE_KEYS.PROFILE];
  const accounts = (await chrome.storage.local.get(STORAGE_KEYS.ACCOUNTS))[STORAGE_KEYS.ACCOUNTS] || [];
  const syncAccounts = accounts.map(acc => ({
    id: acc.id, driveId: acc.driveId, nickname: acc.nickname,
    username: acc.username, createdAt: acc.createdAt, updatedAt: acc.updatedAt
  }));

  await chrome.storage.sync.set({
    [STORAGE_KEYS.SYNC_META]: {
      lastSync: Date.now(),
      deviceInfo: navigator.userAgent
    }
  });

  return { success: true, message: '数据已同步' };
}

// ===== 记录设备会话 =====
async function recordSession(profile) {
  try {
    const deviceInfo = await fetchDeviceInfo();
    const sessions = (await chrome.storage.local.get(STORAGE_KEYS.SESSIONS))[STORAGE_KEYS.SESSIONS] || [];

    // 更新当前设备的会话（按设备唯一标识匹配）
    const deviceId = getDeviceId();
    const existingIdx = sessions.findIndex(s => s.deviceId === deviceId);

    // 如果不是已有设备，检查设备数量上限（最多5个）
    if (existingIdx < 0 && sessions.length >= 5) {
      console.warn('设备数量已达上限（5个），新设备无法登录');
      throw new Error('登录设备已达上限（5个），请在已登录设备中移除一个后再试');
    }

    const sessionEntry = {
      deviceId: deviceId,
      email: profile.email,
      browser: deviceInfo.browser,
      deviceName: deviceInfo.deviceName,
      ip: deviceInfo.ip,
      location: deviceInfo.location,
      loginTime: Date.now(),
      lastActive: Date.now(),
      isCurrent: true
    };

    if (existingIdx >= 0) {
      sessions[existingIdx] = { ...sessions[existingIdx], ...sessionEntry };
    } else {
      sessions.push(sessionEntry);
    }

    // 标记其他设备为非当前
    sessions.forEach(s => {
      if (s.deviceId !== deviceId) s.isCurrent = false;
    });

    // 清理超过30天未活动的会话
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const activeSessions = sessions.filter(s => s.lastActive > cutoff);

    await chrome.storage.local.set({ [STORAGE_KEYS.SESSIONS]: activeSessions });
    console.log('会话已记录:', sessionEntry);
  } catch (e) {
    console.warn('记录会话失败:', e.message);
  }
}

// ===== 刷新会话 =====
async function handleRefreshSession() {
  const profile = (await chrome.storage.local.get(STORAGE_KEYS.PROFILE))[STORAGE_KEYS.PROFILE];
  if (profile && profile.email && profile.emailVerified) {
    await recordSession(profile);
    return { success: true };
  }
  return { success: false, error: '未登录' };
}

// ===== 移除设备会话 =====
async function removeSession(deviceId) {
  const sessions = (await chrome.storage.local.get(STORAGE_KEYS.SESSIONS))[STORAGE_KEYS.SESSIONS] || [];
  const updated = sessions.filter(s => s.deviceId !== deviceId);
  await chrome.storage.local.set({ [STORAGE_KEYS.SESSIONS]: updated });
  console.log('设备已移除:', deviceId);
}

// ===== 获取设备信息 =====
async function getDeviceInfo() {
  const info = await fetchDeviceInfo();
  return { success: true, data: info };
}

async function fetchDeviceInfo() {
  const ua = navigator.userAgent;
  let browser = 'Unknown';
  let deviceName = 'Unknown';

  // 解析浏览器
  if (ua.includes('Edg/')) {
    browser = 'Microsoft Edge';
  } else if (ua.includes('Chrome/')) {
    browser = 'Google Chrome';
  } else if (ua.includes('Firefox/')) {
    browser = 'Firefox';
  } else if (ua.includes('Safari/') && !ua.includes('Chrome')) {
    browser = 'Safari';
  } else if (ua.includes('OPR/') || ua.includes('Opera/')) {
    browser = 'Opera';
  } else if (ua.includes('360')) {
    browser = '360浏览器';
  } else if (ua.includes('QQBrowser')) {
    browser = 'QQ浏览器';
  }

  // 解析操作系统
  if (ua.includes('Windows NT 10')) {
    deviceName = 'Windows 10/11';
  } else if (ua.includes('Windows NT 6')) {
    deviceName = 'Windows 7/8';
  } else if (ua.includes('Mac OS X')) {
    deviceName = 'macOS';
  } else if (ua.includes('Linux')) {
    deviceName = 'Linux';
  } else if (ua.includes('Android')) {
    deviceName = 'Android';
  }

  // 获取 IP 和地理位置
  let ip = '未知';
  let location = '未知';

  try {
    const ipResponse = await fetch('https://api.ipify.org?format=json');
    const ipData = await ipResponse.json();
    ip = ipData.ip || '未知';

    // 获取地理位置
    const geoResponse = await fetch(`https://ipapi.co/${ip}/json/`);
    const geoData = await geoResponse.json();
    if (geoData && !geoData.error) {
      location = [geoData.country_name, geoData.region, geoData.city]
        .filter(Boolean)
        .join(', ') || '未知';
    }
  } catch (e) {
    console.warn('获取IP/位置信息失败:', e.message);
  }

  return { browser, deviceName, ip, location };
}

// ===== 生成设备唯一标识 =====
function getDeviceId() {
  const ua = navigator.userAgent;
  const screenInfo = `${screen.width}x${screen.height}`;
  const raw = `${ua}_${screenInfo}_${navigator.language}`;
  // 简单哈希
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    const chr = raw.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return 'dev_' + Math.abs(hash).toString(36);
}

// ===== 点击插件图标 =====
chrome.action.onClicked.addListener((tab) => {
  // Manifest V3 中 default_popup 已处理此行为
});

console.log('网盘通 Service Worker 已启动');