// 网盘通 - Popup 弹窗脚本
// 管理网盘列表展示、搜索、分类、一键登录

(function () {
  'use strict';

  // ===== DOM 元素 =====
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const avatarImg = $('#avatarImg');
  const avatarWrapper = $('#avatarWrapper');
  const nicknameDisplay = $('#nicknameDisplay');
  const emailDisplay = $('#emailDisplay');
  const settingsBtn = $('#settingsBtn');
  const searchInput = $('#searchInput');
  const clearSearch = $('#clearSearch');
  const categoryTabs = $('#categoryTabs');
  const driveList = $('#driveList');
  const loading = $('#loading');
  const emptyState = $('#emptyState');
  const emptyText = $('#emptyText');
  const addDriveBtn = $('#addDriveBtn');
  const syncStatus = $('#syncStatus');

  // ===== 状态 =====
  let profile = null;
  let accounts = [];
  let settings = {};
  let currentCategory = 'my';
  let searchQuery = '';
  let expandedDrive = null;

  // ===== 初始化 =====
  async function init() {
    await loadData();
    renderProfile();
    renderDriveList();
    bindEvents();
  }

  // ===== 加载数据 =====
  async function loadData() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getAllData' });
      if (response.success) {
        profile = response.data.profile;
        accounts = response.data.accounts;
        settings = response.data.settings;
        updateSyncStatus(response.data.syncMeta);
      }
    } catch (err) {
      console.error('数据加载失败:', err);
      showToast('数据加载失败', 'error');
    }
  }

  // ===== 渲染用户信息 =====
  function renderProfile() {
    if (profile && profile.nickname) {
      nicknameDisplay.textContent = profile.nickname;
      emailDisplay.textContent = profile.email ? maskEmail(profile.email) : '';
      if (profile.avatar) {
        avatarImg.src = profile.avatar;
      }
    } else {
      nicknameDisplay.textContent = '未设置';
      emailDisplay.textContent = '';
      avatarImg.src = 'icons/avatar-default.svg';
    }
  }

  // ===== 邮箱脱敏 =====
  function maskEmail(email) {
    if (!email || !email.includes('@')) return email;
    const [name, domain] = email.split('@');
    if (name.length <= 2) return name.charAt(0) + '***@' + domain;
    return name.substring(0, 2) + '***' + name.charAt(name.length - 1) + '@' + domain;
  }

  // ===== 渲染网盘列表 =====
  function renderDriveList() {
    loading.style.display = 'none';

    let drivesToShow = [];

    if (currentCategory === 'my') {
      // 显示已添加账号的网盘
      const accountDriveIds = [...new Set(accounts.map(a => a.driveId))];
      drivesToShow = DRIVES_CONFIG.filter(d => accountDriveIds.includes(d.id));
    } else {
      drivesToShow = [...DRIVES_CONFIG];
    }

    // 搜索过滤
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      drivesToShow = drivesToShow.filter(d =>
        d.name.toLowerCase().includes(q) ||
        (d.id.toLowerCase().includes(q))
      );
    }

    if (drivesToShow.length === 0) {
      driveList.innerHTML = '';
      emptyState.style.display = 'flex';

      if (currentCategory === 'my' && !searchQuery && accounts.length === 0) {
        emptyText.textContent = '还没有添加任何网盘账号';
        addDriveBtn.style.display = 'inline-block';
      } else if (currentCategory === 'my' && !searchQuery) {
        emptyText.textContent = '暂无已添加的网盘';
        addDriveBtn.style.display = 'none';
      } else {
        emptyText.textContent = searchQuery ? '未找到匹配的网盘' : '暂无网盘';
        addDriveBtn.style.display = 'none';
      }
      return;
    }

    emptyState.style.display = 'none';

    let html = drivesToShow.map(d => renderDriveItem(d)).join('');
    driveList.innerHTML = html;

    // 重新绑定事件
    bindDriveEvents();
  }

  // ===== 渲染单个网盘项 =====
  function renderDriveItem(drive) {
    const driveAccounts = accounts.filter(a => a.driveId === drive.id);
    const hasAccounts = driveAccounts.length > 0;
    const isExpanded = expandedDrive === drive.id;

    return `
      <div class="drive-item ${hasAccounts ? 'has-accounts' : ''} ${isExpanded ? 'expanded' : ''}"
           data-drive-id="${drive.id}"
           title="${hasAccounts ? '已关联 ' + driveAccounts.length + ' 个账号' : '点击登录 ' + drive.name}">
        <div class="drive-icon-wrap">
          <img src="${drive.icon}" alt="${drive.name}" class="drive-icon-svg"
               onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
          <span class="drive-icon-svg" style="display:none;width:22px;height:22px;align-items:center;justify-content:center;
            background:${drive.color};color:#fff;border-radius:4px;font-size:12px;font-weight:bold;">
            ${drive.name.charAt(0)}
          </span>
        </div>
        <div class="drive-info">
          <div class="drive-name">${drive.name}</div>
          <div class="drive-accounts">${hasAccounts ? driveAccounts.length + ' 个账号' : '未添加账号'}</div>
        </div>
        <div class="drive-arrow">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </div>
      </div>
      <div class="account-sublist ${isExpanded ? 'expanded' : ''}" data-drive-id="${drive.id}">
        ${driveAccounts.map(acc => renderAccountItem(acc, drive)).join('')}
      </div>
    `;
  }

  // ===== 渲染单个账号项 =====
  function renderAccountItem(account, drive) {
    return `
      <div class="account-item" data-account-id="${account.id}" data-drive-id="${drive.id}"
           title="点击登录: ${account.nickname || account.username}">
        <span class="account-dot" style="background:${drive.color}"></span>
        <span class="account-nickname">${account.nickname || '默认账号'}</span>
        <span class="account-username">${account.username}</span>
        <span class="login-icon">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
            <polyline points="10 17 15 12 10 7"/>
            <line x1="15" y1="12" x2="3" y2="12"/>
          </svg>
        </span>
      </div>
    `;
  }

  // ===== 绑定列表事件 =====
  function bindDriveEvents() {
    // 网盘项点击（展开/收起或直接登录）
    $$('.drive-item').forEach(item => {
      item.addEventListener('click', async (e) => {
        e.stopPropagation();
        const driveId = item.dataset.driveId;
        const drive = DRIVES_CONFIG.find(d => d.id === driveId);
        const driveAccounts = accounts.filter(a => a.driveId === driveId);

        if (driveAccounts.length === 0) {
          // 没有关联账号，直接打开网盘登录页
          openDriveLoginPage(drive, null);
        } else if (driveAccounts.length === 1) {
          // 只有一个账号，直接登录
          await loginWithAccount(drive, driveAccounts[0]);
        } else {
          // 多个账号，展开/收起子列表
          if (expandedDrive === driveId) {
            expandedDrive = null;
          } else {
            expandedDrive = driveId;
          }
          renderDriveList();
        }
      });
    });

    // 账号项点击（登录）
    $$('.account-item').forEach(item => {
      item.addEventListener('click', async (e) => {
        e.stopPropagation();
        const accountId = item.dataset.accountId;
        const driveId = item.dataset.driveId;
        const drive = DRIVES_CONFIG.find(d => d.id === driveId);
        const account = accounts.find(a => a.id === accountId);

        if (drive && account) {
          await loginWithAccount(drive, account);
        }
      });
    });
  }

  // ===== 事件绑定 =====
  function bindEvents() {
    // 头像点击 -> 打开设置
    avatarWrapper.addEventListener('click', () => {
      chrome.runtime.openOptionsPage();
    });

    // 设置按钮
    settingsBtn.addEventListener('click', () => {
      chrome.runtime.openOptionsPage();
    });

    // 添加网盘账号按钮（空状态引导）
    addDriveBtn.addEventListener('click', () => {
      chrome.runtime.openOptionsPage();
    });

    // 搜索
    searchInput.addEventListener('input', () => {
      searchQuery = searchInput.value.trim();
      clearSearch.style.display = searchQuery ? 'flex' : 'none';
      renderDriveList();
    });

    clearSearch.addEventListener('click', () => {
      searchInput.value = '';
      searchQuery = '';
      clearSearch.style.display = 'none';
      renderDriveList();
      searchInput.focus();
    });

    // 分类标签
    $$('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        $$('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentCategory = btn.dataset.category;
        expandedDrive = null;
        renderDriveList();
      });
    });

    // 点击空白处收起展开
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.drive-item') && !e.target.closest('.account-sublist')) {
        if (expandedDrive) {
          expandedDrive = null;
          renderDriveList();
        }
      }
    });
  }

  // ===== 打开网盘登录页（无账号，直接打开） =====
  function openDriveLoginPage(drive, account) {
    if (drive.loginUrl) {
      chrome.tabs.create({ url: drive.loginUrl });
      window.close();
    }
  }

  // ===== 使用账号登录 =====
  async function loginWithAccount(drive, account) {
    // 检查是否设置了解密所需的凭据
    if (!profile || !profile.email || !profile.emailVerified) {
      showToast('请先在设置中完成邮箱注册和验证', 'warning');
      chrome.runtime.openOptionsPage();
      return;
    }

    // 请求用户输入主密码解密
    const masterPassword = await promptMasterPassword();
    if (!masterPassword) return;

    // 将登录请求发送到 background.js，由它处理（因为 popup 即将关闭）
    try {
      const result = await chrome.runtime.sendMessage({
        action: 'loginWithAccount',
        email: profile.email,
        masterPassword: masterPassword,
        accountId: account.id,
        driveId: drive.id
      });

      if (result.success) {
        showToast(`正在登录 ${drive.name}...`, 'success');
        // 延迟关闭 popup，让 toast 显示
        setTimeout(() => window.close(), 800);
      } else {
        showToast('登录失败: ' + (result.error || '未知错误'), 'error');
      }
    } catch (err) {
      showToast('登录失败: ' + err.message, 'error');
    }
  }

  // ===== 弹出主密码输入框 =====
  function promptMasterPassword() {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'password-overlay';
      overlay.style.cssText = `
        position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 1000;
        display: flex; align-items: center; justify-content: center;
      `;

      const dialog = document.createElement('div');
      dialog.style.cssText = `
        background: #fff; border-radius: 12px; padding: 24px; width: 280px;
        box-shadow: 0 20px 60px rgba(0,0,0,0.3); color: #1a1a2e;
      `;
      dialog.innerHTML = `
        <h3 style="margin:0 0 6px;font-size:16px;">验证主密码</h3>
        <p style="margin:0 0 16px;font-size:12px;color:#6b7280;">请输入您设置的主密码以解密网盘密码</p>
        <input type="password" id="masterPwdInput" placeholder="请输入主密码"
               style="width:100%;padding:10px;border:1px solid #e5e7eb;border-radius:8px;font-size:14px;
               outline:none;box-sizing:border-box;"
               autofocus>
        <div style="display:flex;gap:8px;margin-top:14px;justify-content:flex-end;">
          <button id="pwdCancel" style="padding:8px 16px;border:1px solid #e5e7eb;border-radius:8px;
            background:#fff;cursor:pointer;font-size:13px;">取消</button>
          <button id="pwdConfirm" style="padding:8px 16px;border:none;border-radius:8px;
            background:#4f46e5;color:#fff;cursor:pointer;font-size:13px;">确认</button>
        </div>
        <p id="pwdError" style="margin:8px 0 0;font-size:12px;color:#ef4444;display:none;"></p>
      `;

      overlay.appendChild(dialog);
      document.body.appendChild(overlay);

      const input = dialog.querySelector('#masterPwdInput');
      const error = dialog.querySelector('#pwdError');

      dialog.querySelector('#pwdCancel').onclick = () => {
        document.body.removeChild(overlay);
        resolve(null);
      };

      dialog.querySelector('#pwdConfirm').onclick = () => {
        const pwd = input.value.trim();
        if (!pwd) {
          error.textContent = '请输入主密码';
          error.style.display = 'block';
          return;
        }
        document.body.removeChild(overlay);
        resolve(pwd);
      };

      input.onkeydown = (e) => {
        if (e.key === 'Enter') {
          dialog.querySelector('#pwdConfirm').click();
        }
      };

      overlay.onclick = (e) => {
        if (e.target === overlay) {
          document.body.removeChild(overlay);
          resolve(null);
        }
      };

      input.focus();
    });
  }

  // ===== 更新同步状态 =====
  function updateSyncStatus(syncMeta) {
    if (syncMeta && syncMeta.lastSync) {
      syncStatus.innerHTML = `
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="23 4 23 10 17 10"/>
          <polyline points="1 20 1 14 7 14"/>
          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
        </svg>
        已同步
      `;
      syncStatus.className = 'sync-status';
    } else {
      syncStatus.innerHTML = `
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        未同步
      `;
      syncStatus.className = 'sync-status error';
    }
  }

  // ===== Toast 提示 =====
  function showToast(message, type = '') {
    // 移除已有 toast
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    requestAnimationFrame(() => {
      toast.classList.add('show');
    });

    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 2500);
  }

  // ===== 启动 =====
  init();
})();