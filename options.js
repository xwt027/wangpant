// 网盘通 - 设置页脚本
// 管理个人资料、账号、备忘录、登录设备、插件设置

(function () {
  'use strict';

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  // ===== 状态 =====
  let profile = null;
  let accounts = [];
  let editAccountId = null;
  let codeSent = false;
  let codeTimer = null;
  // 头像裁剪状态
  let cropImage = null;
  let cropData = { x: 0, y: 0, zoom: 1, dragging: false, startX: 0, startY: 0, imgX: 0, imgY: 0 };

  // ===== 初始化 =====
  async function init() {
    await loadData();
    bindNavigation();
    bindEvents();
    renderProfile();
    renderAccounts();
    renderMemo();
    renderSessions();
    renderSettings();
    renderSync();
  }

  // ===== 加载数据 =====
  async function loadData() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getAllData' });
      if (response.success) {
        profile = response.data.profile;
        accounts = response.data.accounts;
      }
    } catch (err) {
      console.error('数据加载失败:', err);
    }
  }

  // ===== 导航切换 =====
  function bindNavigation() {
    $$('.nav-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        $$('.nav-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        $$('.section').forEach(s => s.classList.remove('active'));
        const sectionId = 'section-' + item.dataset.section;
        const section = $('#' + sectionId);
        if (section) section.classList.add('active');

        // 切换到对应页面时刷新数据
        if (item.dataset.section === 'sessions') renderSessions();
        if (item.dataset.section === 'sync') renderSync();
      });
    });
  }

  // ===== 事件绑定 =====
  function bindEvents() {
    // ---- 个人资料 ----
    // 点击头像框 == 点击上传按钮
    $('#avatarPreview').addEventListener('click', () => $('#avatarFileInput').click());
    $('#uploadAvatarBtn').addEventListener('click', () => $('#avatarFileInput').click());
    $('#avatarFileInput').addEventListener('change', handleAvatarUpload);
    $('#removeAvatarBtn').addEventListener('click', removeAvatar);
    $('#sendCodeBtn').addEventListener('click', sendVerificationCode);
    $('#verifyCodeBtn').addEventListener('click', verifyEmailCode);
    $('#saveProfileBtn').addEventListener('click', saveProfile);

    // ---- 头像裁剪弹窗 ----
    $('#cropModalClose').addEventListener('click', closeCropModal);
    $('#cropCancel').addEventListener('click', closeCropModal);
    $('#cropConfirm').addEventListener('click', confirmCrop);
    $('#cropZoom').addEventListener('input', updateCropZoom);
    // 点击遮罩关闭
    $('#cropModal').addEventListener('click', (e) => {
      if (e.target === $('#cropModal')) closeCropModal();
    });
    // 拖拽移动
    $('#cropContainer').addEventListener('mousedown', startCropDrag);
    document.addEventListener('mousemove', onCropDrag);
    document.addEventListener('mouseup', endCropDrag);
    // 滚轮缩放
    $('#cropContainer').addEventListener('wheel', onCropWheel, { passive: false });

    // ---- 账号管理 ----
    $('#addAccountBtn').addEventListener('click', () => openAccountModal());
    $('#addAccountBtnBottom').addEventListener('click', () => openAccountModal());
    $('#modalClose').addEventListener('click', closeAccountModal);
    $('#modalCancel').addEventListener('click', closeAccountModal);
    $('#modalSave').addEventListener('click', saveAccount);
    $('#accountModal').addEventListener('click', (e) => {
      if (e.target === $('#accountModal')) closeAccountModal();
    });

    // ---- 备忘录 ----
    $('#memoTextarea').addEventListener('input', updateMemoCharCount);
    $('#clearMemoBtn').addEventListener('click', clearMemo);
    $('#saveMemoBtn').addEventListener('click', saveMemo);

    // ---- 登录设备 ----
    $('#refreshSessionsBtn').addEventListener('click', renderSessions);

    // ---- 插件设置 ----
    $('#saveSettingsBtn').addEventListener('click', saveSettings);

    // ---- 数据同步 ----
    $('#manualSyncBtn').addEventListener('click', manualSync);
  }

  // ===== 渲染个人资料 =====
  function renderProfile() {
    if (profile) {
      $('#nicknameInput').value = profile.nickname || '';
      $('#emailInput').value = profile.email || '';
      $('#masterPasswordInput').value = '';
      $('#confirmPasswordInput').value = '';

      if (profile.avatar) {
        $('#avatarPreviewImg').src = profile.avatar;
      }

      // 邮箱验证状态
      if (profile.email) {
        if (profile.emailVerified) {
          $('#emailStatus').innerHTML = '<span class="email-verified">邮箱已验证</span>';
          $('#emailInput').disabled = true;
          $('#sendCodeBtn').style.display = 'none';
        } else {
          $('#emailStatus').textContent = '邮箱未验证，请发送验证码完成验证';
          $('#emailInput').disabled = false;
          $('#sendCodeBtn').style.display = '';
        }
      } else {
        $('#emailStatus').textContent = '邮箱验证通过后将作为登录凭证，用于加密数据';
        $('#emailInput').disabled = false;
        $('#sendCodeBtn').style.display = '';
      }
    }
  }

  // ===== 头像上传（打开裁剪弹窗） =====
  function handleAvatarUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      showToast('图片大小不能超过2MB', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        cropImage = img;
        openCropModal();
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  // ===== 裁剪弹窗 =====
  function openCropModal() {
    if (!cropImage) return;
    $('#cropModal').style.display = 'flex';
    const container = $('#cropContainer');
    const cw = container.clientWidth, ch = container.clientHeight;
    const ratio = Math.min(cw / cropImage.naturalWidth, ch / cropImage.naturalHeight, 1);
    cropData.zoom = ratio;
    cropData.imgX = (cw - cropImage.naturalWidth * ratio) / 2;
    cropData.imgY = (ch - cropImage.naturalHeight * ratio) / 2;
    $('#cropZoom').value = 1;
    applyCropTransform();
  }

  function closeCropModal() {
    $('#cropModal').style.display = 'none';
    cropImage = null;
  }

  function applyCropTransform() {
    const imgEl = $('#cropImage');
    if (!cropImage) return;
    imgEl.src = cropImage.src;
    imgEl.style.display = 'block';
    imgEl.style.width = cropImage.naturalWidth * cropData.zoom + 'px';
    imgEl.style.height = cropImage.naturalHeight * cropData.zoom + 'px';
    imgEl.style.left = cropData.imgX + 'px';
    imgEl.style.top = cropData.imgY + 'px';
  }

  function updateCropZoom() {
    const container = $('#cropContainer');
    const cw = container.clientWidth, ch = container.clientHeight;
    const baseRatio = Math.min(cw / cropImage.naturalWidth, ch / cropImage.naturalHeight, 1);
    const oldZoom = cropData.zoom;
    cropData.zoom = parseFloat($('#cropZoom').value) * baseRatio;
    const cx = cw / 2, cy = ch / 2;
    cropData.imgX = cx - (cx - cropData.imgX) * (cropData.zoom / oldZoom);
    cropData.imgY = cy - (cy - cropData.imgY) * (cropData.zoom / oldZoom);
    clampImagePosition();
    applyCropTransform();
  }

  function clampImagePosition() {
    const container = $('#cropContainer');
    const cw = container.clientWidth, ch = container.clientHeight;
    const iw = cropImage.naturalWidth * cropData.zoom;
    const ih = cropImage.naturalHeight * cropData.zoom;
    const frameSize = 200;
    const frameX = (cw - frameSize) / 2, frameY = (ch - frameSize) / 2;
    if (cropData.imgX > frameX) cropData.imgX = frameX;
    if (cropData.imgY > frameY) cropData.imgY = frameY;
    if (cropData.imgX + iw < frameX + frameSize) cropData.imgX = frameX + frameSize - iw;
    if (cropData.imgY + ih < frameY + frameSize) cropData.imgY = frameY + frameSize - ih;
  }

  function startCropDrag(e) {
    e.preventDefault();
    cropData.dragging = true;
    cropData.startX = e.clientX;
    cropData.startY = e.clientY;
  }

  function onCropDrag(e) {
    if (!cropData.dragging) return;
    cropData.imgX += e.clientX - cropData.startX;
    cropData.imgY += e.clientY - cropData.startY;
    cropData.startX = e.clientX;
    cropData.startY = e.clientY;
    clampImagePosition();
    applyCropTransform();
  }

  function endCropDrag() {
    cropData.dragging = false;
  }

  function onCropWheel(e) {
    e.preventDefault();
    const container = $('#cropContainer');
    const cw = container.clientWidth, ch = container.clientHeight;
    const baseRatio = Math.min(cw / cropImage.naturalWidth, ch / cropImage.naturalHeight, 1);
    const oldZoom = cropData.zoom;
    const delta = e.deltaY > 0 ? -0.05 : 0.05;
    cropData.zoom = Math.max(baseRatio * 0.5, Math.min(baseRatio * 3, cropData.zoom + delta * cropData.zoom));
    const rect = container.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    cropData.imgX = mx - (mx - cropData.imgX) * (cropData.zoom / oldZoom);
    cropData.imgY = my - (my - cropData.imgY) * (cropData.zoom / oldZoom);
    clampImagePosition();
    applyCropTransform();
    $('#cropZoom').value = cropData.zoom / baseRatio;
  }

  function confirmCrop() {
    if (!cropImage) return;
    const container = $('#cropContainer');
    const cw = container.clientWidth, ch = container.clientHeight;
    const frameSize = 200;
    const sx = ((cw - frameSize) / 2 - cropData.imgX) / cropData.zoom;
    const sy = ((ch - frameSize) / 2 - cropData.imgY) / cropData.zoom;
    const ss = frameSize / cropData.zoom;

    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 200;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(cropImage, sx, sy, ss, ss, 0, 0, 200, 200);
    const croppedDataUrl = canvas.toDataURL('image/jpeg', 0.9);

    $('#avatarPreviewImg').src = croppedDataUrl;
    showToast('头像已裁剪，保存后生效', 'success');
    closeCropModal();
  }

  function removeAvatar() {
    $('#avatarPreviewImg').src = 'icons/avatar-default.svg';
    showToast('头像已移除，保存后生效', 'success');
  }

  // ===== 发送验证码 =====
  async function sendVerificationCode() {
    const email = $('#emailInput').value.trim();
    if (!email) {
      showToast('请先输入邮箱地址', 'warning');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showToast('请输入有效的邮箱地址', 'warning');
      return;
    }

    try {
      const result = await chrome.runtime.sendMessage({
        action: 'sendVerificationCode',
        email: email
      });

      if (result.success) {
        codeSent = true;
        $('#verifyCodeGroup').style.display = 'block';
        $('#sendCodeBtn').disabled = true;
        $('#sendCodeBtn').textContent = '已发送';

        // 开发模式提示
        if (result.code) {
          showToast(`验证码: ${result.code}（开发模式，请查看浏览器通知）`, 'success');
        } else {
          showToast('验证码已发送至您的邮箱（开发模式下通过浏览器通知显示）', 'success');
        }

        // 60秒后重新允许发送
        let countdown = 60;
        codeTimer = setInterval(() => {
          countdown--;
          if (countdown <= 0) {
            clearInterval(codeTimer);
            $('#sendCodeBtn').disabled = false;
            $('#sendCodeBtn').textContent = '发送验证码';
          } else {
            $('#sendCodeBtn').textContent = `${countdown}s后重发`;
          }
        }, 1000);
      } else {
        showToast(result.error || '发送失败', 'error');
      }
    } catch (err) {
      showToast('发送失败: ' + err.message, 'error');
    }
  }

  // ===== 验证邮箱验证码 =====
  async function verifyEmailCode() {
    const email = $('#emailInput').value.trim();
    const code = $('#verifyCodeInput').value.trim();

    if (!code || code.length !== 6) {
      showToast('请输入6位验证码', 'warning');
      return;
    }

    try {
      const result = await chrome.runtime.sendMessage({
        action: 'verifyEmailCode',
        email: email,
        code: code
      });

      if (result.success) {
        showToast('邮箱验证成功', 'success');
        $('#verifyCodeGroup').style.display = 'none';
        $('#verifyCodeInput').value = '';
        if (codeTimer) clearInterval(codeTimer);
        // 更新本地状态
        if (!profile) profile = {};
        profile.emailVerified = true;
        profile.email = email;
        renderProfile();
      } else {
        showToast(result.error || '验证失败', 'error');
      }
    } catch (err) {
      showToast('验证失败: ' + err.message, 'error');
    }
  }

  // ===== 保存个人资料 =====
  async function saveProfile() {
    const nickname = $('#nicknameInput').value.trim();
    const email = $('#emailInput').value.trim();
    const masterPassword = $('#masterPasswordInput').value;
    const confirmPassword = $('#confirmPasswordInput').value;
    const avatar = $('#avatarPreviewImg').src;

    // 验证：如果是新邮箱，需要先验证
    if (email && (!profile || !profile.emailVerified)) {
      showToast('请先验证邮箱地址', 'warning');
      return;
    }

    // 如果密码已修改，需要确认
    if (masterPassword || confirmPassword) {
      if (masterPassword !== confirmPassword) {
        showToast('两次输入的密码不一致', 'warning');
        return;
      }
      if (masterPassword.length < 6) {
        showToast('主密码至少需要6个字符', 'warning');
        return;
      }
    }

    if (!nickname) {
      showToast('请输入昵称', 'warning');
      return;
    }

    const statusEl = $('#profileSaveStatus');
    statusEl.textContent = '保存中...';

    try {
      const result = await chrome.runtime.sendMessage({
        action: 'saveProfile',
        profile: {
          nickname: nickname,
          avatar: avatar,
          email: email,
          emailVerified: profile ? profile.emailVerified : false
        },
        masterPassword: masterPassword || undefined
      });

      if (result.success) {
        profile = result.profile;
        showToast('资料保存成功', 'success');
        statusEl.textContent = '已保存';
        setTimeout(() => { statusEl.textContent = ''; }, 2000);
        $('#masterPasswordInput').value = '';
        $('#confirmPasswordInput').value = '';
      } else {
        showToast(result.error || '保存失败', 'error');
        statusEl.textContent = '';
      }
    } catch (err) {
      showToast('保存失败: ' + err.message, 'error');
      statusEl.textContent = '';
    }
  }

  // ===== 渲染账号列表 =====
  function renderAccounts() {
    const list = $('#accountList');
    const empty = $('#emptyAccounts');
    const bottomBar = $('#addAccountBottom');
    const limitEl = $('#accountLimit');
    const limitHint = $('#accountLimitHint');
    const MAX_ACCOUNTS = 20;

    // 更新数量显示
    const count = accounts ? accounts.length : 0;
    if (limitEl) {
      limitEl.textContent = count + '/' + MAX_ACCOUNTS;
      limitEl.classList.toggle('limit-reached', count >= MAX_ACCOUNTS);
    }

    if (!accounts || accounts.length === 0) {
      list.innerHTML = '';
      if (empty) {
        empty.style.display = 'flex';
        list.appendChild(empty);
      }
      if (bottomBar) bottomBar.style.display = 'none';
      if (limitHint) limitHint.textContent = '';
      return;
    }

    if (empty) empty.style.display = 'none';

    let html = '';
    accounts.forEach(acc => {
      const drive = (typeof DRIVES_CONFIG !== 'undefined' && DRIVES_CONFIG)
        ? DRIVES_CONFIG.find(d => d.id === acc.driveId)
        : null;
      const driveName = drive ? drive.name : acc.driveId;
      const driveIcon = drive ? drive.icon : 'icons/cloud.svg';
      const nickname = acc.nickname || '未命名';

      html += `
        <div class="account-item" data-id="${acc.id}">
          <div class="account-item-left">
            <img src="${driveIcon}" class="account-icon" alt="${driveName}" onerror="this.src='icons/cloud.svg'">
            <div class="account-item-info">
              <div class="account-item-name">${driveName}</div>
              <div class="account-item-detail">
                <span>${acc.username}</span>
                ${nickname !== '未命名' ? `<span class="account-tag">${nickname}</span>` : ''}
              </div>
            </div>
          </div>
          <div class="account-item-right">
            <span class="account-time">${formatTime(acc.createdAt)}</span>
            <div class="account-item-actions">
              <button class="icon-btn-sm edit-account" data-id="${acc.id}" title="编辑">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              </button>
              <button class="icon-btn-sm delete-account" data-id="${acc.id}" title="删除">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      `;
    });

    list.innerHTML = html;

    // 底部添加按钮
    if (bottomBar) {
      if (count >= MAX_ACCOUNTS) {
        bottomBar.style.display = 'flex';
        bottomBar.querySelector('button').style.display = 'none';
        if (limitHint) limitHint.textContent = '已达到上限，升级后可添加更多账号';
      } else {
        bottomBar.style.display = 'flex';
        bottomBar.querySelector('button').style.display = '';
        if (limitHint) limitHint.textContent = '';
      }
    }

    // 绑定编辑和删除事件
    list.querySelectorAll('.edit-account').forEach(btn => {
      btn.addEventListener('click', () => openAccountModal(btn.dataset.id));
    });
    list.querySelectorAll('.delete-account').forEach(btn => {
      btn.addEventListener('click', () => deleteAccount(btn.dataset.id));
    });
  }

  // ===== 打开账号弹窗 =====
  function openAccountModal(accountId) {
    const MAX_ACCOUNTS = 20;
    if (!accountId && accounts && accounts.length >= MAX_ACCOUNTS) {
      showToast('已达到账号上限（' + MAX_ACCOUNTS + '个），升级后可添加更多', 'error');
      return;
    }
    editAccountId = accountId || null;

    // 填充网盘列表
    const select = $('#driveSelect');
    select.innerHTML = '<option value="">请选择网盘</option>';
    if (typeof DRIVES_CONFIG !== 'undefined' && DRIVES_CONFIG) {
      DRIVES_CONFIG.forEach(d => {
        select.innerHTML += `<option value="${d.id}">${d.name}</option>`;
      });
    }

    if (accountId) {
      const acc = accounts.find(a => a.id === accountId);
      if (acc) {
        $('#modalTitle').textContent = '编辑网盘账号';
        $('#driveSelect').value = acc.driveId;
        $('#accountNickname').value = acc.nickname || '';
        $('#accountUsername').value = acc.username;
        $('#accountPassword').value = '';
        $('#modalMasterPassword').value = '';
      }
    } else {
      $('#modalTitle').textContent = '添加网盘账号';
      $('#driveSelect').value = '';
      $('#accountNickname').value = '';
      $('#accountUsername').value = '';
      $('#accountPassword').value = '';
      $('#modalMasterPassword').value = '';
    }

    $('#accountModal').style.display = 'flex';
  }

  function closeAccountModal() {
    $('#accountModal').style.display = 'none';
    editAccountId = null;
  }

  // ===== 保存账号 =====
  async function saveAccount() {
    const driveId = $('#driveSelect').value;
    const nickname = $('#accountNickname').value.trim();
    const username = $('#accountUsername').value.trim();
    const password = $('#accountPassword').value;
    const masterPassword = $('#modalMasterPassword').value;

    if (!driveId) { showToast('请选择网盘', 'warning'); return; }
    if (!username) { showToast('请输入登录账号', 'warning'); return; }
    if (!editAccountId && !password) { showToast('请输入网盘密码', 'warning'); return; }
    if (!masterPassword) { showToast('请输入主密码', 'warning'); return; }

    try {
      const result = await chrome.runtime.sendMessage({
        action: 'saveAccount',
        accountId: editAccountId,
        data: {
          driveId: driveId,
          nickname: nickname,
          username: username,
          password: password || undefined
        },
        masterPassword: masterPassword
      });

      if (result.success) {
        showToast(editAccountId ? '账号已更新' : '账号已添加', 'success');
        closeAccountModal();
        await loadData();
        renderAccounts();
      } else {
        showToast(result.error || '保存失败', 'error');
      }
    } catch (err) {
      showToast('保存失败: ' + err.message, 'error');
    }
  }

  // ===== 删除账号 =====
  async function deleteAccount(accountId) {
    if (!confirm('确定要删除此账号吗？此操作不可恢复。')) return;

    try {
      const result = await chrome.runtime.sendMessage({
        action: 'deleteAccount',
        accountId: accountId
      });

      if (result.success) {
        showToast('账号已删除', 'success');
        await loadData();
        renderAccounts();
      } else {
        showToast(result.error || '删除失败', 'error');
      }
    } catch (err) {
      showToast('删除失败: ' + err.message, 'error');
    }
  }

  // ===== 备忘录 =====
  function renderMemo() {
    const memo = $('#memoTextarea');
    // 从 storage 加载备忘录
    chrome.storage.sync.get('memo', (data) => {
      memo.value = data.memo || '';
      updateMemoCharCount();
    });
  }

  function updateMemoCharCount() {
    const count = $('#memoTextarea').value.length;
    $('#memoCharCount').textContent = `${count} / 2000`;
    if (count > 1900) {
      $('#memoCharCount').style.color = 'var(--danger)';
    } else {
      $('#memoCharCount').style.color = 'var(--text-muted)';
    }
  }

  function clearMemo() {
    if (confirm('确定要清空备忘录内容吗？')) {
      $('#memoTextarea').value = '';
      updateMemoCharCount();
      saveMemo();
    }
  }

  function saveMemo() {
    const content = $('#memoTextarea').value;
    chrome.storage.sync.set({ memo: content }, () => {
      if (chrome.runtime.lastError) {
        // 如果内容太大，sync 可能失败，回退到 local
        chrome.storage.local.set({ memo: content }, () => {
          showToast('部分内容已保存到本地存储', 'warning');
        });
      }
      const syncStatus = $('#memoSyncStatus');
      syncStatus.style.color = 'var(--success)';
      syncStatus.innerHTML = `
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="23 4 23 10 17 10"/>
          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10"/>
        </svg>
        已同步
      `;
    });
  }

  // 监听备忘录的同步变更
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (changes.memo && areaName === 'sync') {
      const newMemo = changes.memo.newValue;
      if (newMemo !== undefined && $('#memoTextarea').value !== newMemo) {
        $('#memoTextarea').value = newMemo;
        updateMemoCharCount();
      }
    }
  });

  // ===== 登录设备列表 =====
  async function renderSessions() {
    const list = $('#sessionsList');
    const loading = $('#loadingSessions');
    const countEl = $('#sessionsCount');
    const MAX_DEVICES = 5;

    if (loading) loading.style.display = 'flex';

    try {
      const result = await chrome.runtime.sendMessage({ action: 'getSessions' });
      loading.style.display = 'none';

      const sessions = result.success && result.sessions ? result.sessions : [];
      if (countEl) countEl.textContent = sessions.length + '/' + MAX_DEVICES;

      if (sessions.length > 0) {
        const currentDeviceId = result.currentDeviceId;
        let html = '';

        sessions.forEach(session => {
          const isCurrent = session.deviceId === currentDeviceId;
          const location = session.location || '未知';
          const ip = session.ip || '未知';
          const browser = session.browser || '未知浏览器';
          const deviceName = session.deviceName || '未知设备';
          const loginTime = session.loginTime ? formatTime(session.loginTime) : '未知';
          const lastActive = session.lastActive ? formatTime(session.lastActive) : '未知';

          html += `
            <div class="session-card${isCurrent ? ' current' : ''}">
              <div class="session-icon">
                <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                  <line x1="8" y1="21" x2="16" y2="21"/>
                  <line x1="12" y1="17" x2="12" y2="21"/>
                </svg>
              </div>
              <div class="session-info">
                <div class="session-device">${deviceName} ${isCurrent ? '<span class="session-badge current-badge">当前设备</span>' : ''}</div>
                <div class="session-meta">
                  <span class="session-badge">
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="10" r="3"/><path d="M12 2a8 8 0 0 0-8 8c0 5.4 8 12 8 12s8-6.6 8-12a8 8 0 0 0-8-8z"/></svg>
                    ${browser}
                  </span>
                  <span class="session-badge">
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
                    ${location}
                  </span>
                  <span class="session-badge">IP: ${ip}</span>
                </div>
                <div class="session-meta" style="margin-top:4px;">
                  <span>登录: ${loginTime}</span>
                  <span>活跃: ${lastActive}</span>
                </div>
              </div>
              ${!isCurrent ? `
              <button class="session-delete-btn" data-device-id="${session.deviceId}" title="移除设备">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
              </button>
              ` : ''}
            </div>
          `;
        });

        list.innerHTML = html;

        // 绑定删除事件
        list.querySelectorAll('.session-delete-btn').forEach(btn => {
          btn.addEventListener('click', () => deleteSession(btn.dataset.deviceId));
        });
      } else {
        list.innerHTML = '<div class="loading-sessions" style="display:flex;"><span>暂无其他设备登录记录</span></div>';
      }
    } catch (err) {
      loading.style.display = 'none';
      list.innerHTML = '<div class="loading-sessions" style="display:flex;"><span>加载失败: ' + err.message + '</span></div>';
    }
  }

  // ===== 渲染插件设置 =====
  function renderSettings() {
    chrome.storage.sync.get('settings', (data) => {
      const settings = data.settings || {};
      $('#autoFillToggle').checked = settings.autoFill !== false;
      $('#autoSubmitToggle').checked = settings.autoSubmit === true;
      $('#newTabToggle').checked = settings.newTab !== false;
    });
  }

  async function saveSettings() {
    const settings = {
      autoFill: $('#autoFillToggle').checked,
      autoSubmit: $('#autoSubmitToggle').checked,
      newTab: $('#newTabToggle').checked
    };

    const statusEl = $('#settingsSaveStatus');
    statusEl.textContent = '保存中...';

    try {
      await chrome.runtime.sendMessage({
        action: 'saveSettings',
        settings: settings
      });

      showToast('设置已保存', 'success');
      statusEl.textContent = '已保存';
      setTimeout(() => { statusEl.textContent = ''; }, 2000);
    } catch (err) {
      showToast('保存失败: ' + err.message, 'error');
      statusEl.textContent = '';
    }
  }

  // ===== 删除设备 =====
  async function deleteSession(deviceId) {
    if (!confirm('确定要移除此设备吗？移除后该设备将需要重新登录。')) return;

    try {
      const result = await chrome.runtime.sendMessage({ action: 'removeSession', deviceId });
      if (result.success) {
        showToast('设备已移除', 'success');
        renderSessions();
      } else {
        showToast(result.error || '移除失败', 'error');
      }
    } catch (err) {
      showToast('移除失败: ' + err.message, 'error');
    }
  }

  // ===== 数据同步 =====
  function renderSync() {
    chrome.storage.sync.get('syncMeta', (data) => {
      const meta = data.syncMeta || {};
      if (meta.lastSync) {
        $('#lastSyncTime').textContent = formatTime(meta.lastSync);
      } else {
        $('#lastSyncTime').textContent = '尚未同步';
      }
      $('#syncAccountCount').textContent = accounts ? accounts.length : 0;
      $('#passwordVersion').textContent = meta.passwordVersion || '-';
    });

    // 检查同步状态
    if (chrome.storage.sync) {
      const lastError = chrome.runtime.lastError;
      if (lastError) {
        updateSyncStatus('error', '同步不可用');
      } else {
        updateSyncStatus('online', '已连接');
      }
    } else {
      updateSyncStatus('offline', '未登录Chrome账号');
    }
  }

  function updateSyncStatus(status, text) {
    const badge = $('#syncStatusBadge');
    const dot = badge.querySelector('.sync-dot');
    const textEl = $('#syncStatusText');

    if (dot) {
      dot.style.background = status === 'online' ? 'var(--success)' :
                             status === 'error' ? 'var(--danger)' :
                             'var(--text-muted)';
    }
    textEl.textContent = text;
  }

  async function manualSync() {
    const btn = $('#manualSyncBtn');
    btn.disabled = true;
    btn.textContent = '同步中...';

    try {
      const result = await chrome.runtime.sendMessage({ action: 'manualSync' });
      if (result.success) {
        showToast('数据同步完成', 'success');
        renderSync();
        await loadData();
        renderAccounts();
      } else {
        showToast(result.error || '同步失败', 'error');
      }
    } catch (err) {
      showToast('同步失败: ' + err.message, 'error');
    }

    btn.disabled = false;
    btn.textContent = '立即同步';
  }

  // ===== 工具函数 =====
  function formatTime(timestamp) {
    if (!timestamp) return '';
    const d = new Date(timestamp);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function showToast(message, type = 'success') {
    const container = $('#toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  // ===== 启动 =====
  init();
})();