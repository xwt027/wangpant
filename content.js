// 网盘通 - 内容脚本
// 注入到网盘登录页面，自动填充登录表单
// 密码错误/需要扫码/验证码等情况 → 停留在验证页面，由用户自主处理

(function () {
  'use strict';

  // 避免重复注入
  if (window.__WangPanTong_Injected) return;
  window.__WangPanTong_Injected = true;

  console.log('[网盘通] 内容脚本已加载:', location.href);

  // ===== 防抖和重试机制 =====
  let fillAttempted = false;
  let retryCount = 0;
  const MAX_RETRIES = 5;
  const RETRY_INTERVAL = 800;

  /**
   * 通用的登录表单自动填充函数
   * @param {Object} credentials - { username, password }
   * @param {Object} selectors - { username, password, submit }
   * @param {boolean} autoSubmit - 是否自动提交
   */
  function autoFillLoginForm(credentials, selectors, autoSubmit = false) {
    if (!credentials || !selectors) return;

    const { username, password } = credentials;
    const selectorList = selectors;

    // 查找用户名输入框
    let usernameInput = null;
    if (selectorList.username) {
      const selectors = selectorList.username.split(',').map(s => s.trim());
      for (const sel of selectors) {
        try {
          usernameInput = document.querySelector(sel);
          if (usernameInput && usernameInput.offsetParent !== null) break;
        } catch (e) { /* 忽略无效选择器 */ }
      }
    }
    // 备选：查找页面中第一个可见的文本输入框
    if (!usernameInput) {
      const textInputs = document.querySelectorAll('input[type="text"], input[type="email"], input:not([type])');
      for (const input of textInputs) {
        if (input.offsetParent !== null) {
          usernameInput = input;
          break;
        }
      }
    }

    // 查找密码输入框
    let passwordInput = null;
    if (selectorList.password) {
      const selectors = selectorList.password.split(',').map(s => s.trim());
      for (const sel of selectors) {
        try {
          passwordInput = document.querySelector(sel);
          if (passwordInput && passwordInput.offsetParent !== null) break;
        } catch (e) { /* 忽略无效选择器 */ }
      }
    }
    // 备选：查找页面中第一个可见的密码输入框
    if (!passwordInput) {
      const passInputs = document.querySelectorAll('input[type="password"]');
      for (const input of passInputs) {
        if (input.offsetParent !== null) {
          passwordInput = input;
          break;
        }
      }
    }

    // 查找提交按钮
    let submitButton = null;
    if (selectorList.submit) {
      const selectors = selectorList.submit.split(',').map(s => s.trim());
      for (const sel of selectors) {
        try {
          submitButton = document.querySelector(sel);
          if (submitButton && submitButton.offsetParent !== null) break;
        } catch (e) { /* 忽略无效选择器 */ }
      }
    }
    // 备选：查找常见的提交按钮
    if (!submitButton) {
      const possibleButtons = document.querySelectorAll('button[type="submit"], input[type="submit"], .login-btn, .submit-btn, [class*="login"]');
      for (const btn of possibleButtons) {
        if (btn.offsetParent !== null) {
          submitButton = btn;
          break;
        }
      }
    }

    // 填充用户名
    if (usernameInput && username) {
      fillInput(usernameInput, username);
      console.log('[网盘通] 用户名已填充');
    }

    // 填充密码
    if (passwordInput && password) {
      fillInput(passwordInput, password);
      console.log('[网盘通] 密码已填充');
    }

    // 根据设置决定是否自动提交
    // 默认不自动提交，让用户确认验证码/扫码等
    if (autoSubmit && submitButton && usernameInput && passwordInput) {
      console.log('[网盘通] 自动提交登录');
      setTimeout(() => {
        submitButton.click();
      }, 500);
    } else {
      console.log('[网盘通] 表单已填充，请手动确认提交（支持验证码/扫码验证）');
    }

    fillAttempted = true;
  }

  /**
   * 模拟用户输入填充表单（触发 React/Angular 等框架的值变更事件）
   */
  function fillInput(input, value) {
    if (!input || !value) return;

    // 先聚焦
    input.focus();

    // 使用原生 setter 触发框架响应
    const nativeSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype, 'value'
    );
    if (nativeSetter && nativeSetter.set) {
      nativeSetter.set.call(input, value);
    } else {
      input.value = value;
    }

    // 触发各种事件以确保框架检测到变化
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
    // 兼容 React 16
    const tracker = input._valueTracker;
    if (tracker) {
      tracker.setValue(value);
    }

    // 失焦
    input.blur();
  }

  /**
   * 带重试的自动填充
   */
  function fillWithRetry(credentials, selectors, autoSubmit) {
    const tryFill = () => {
      // 检查页面是否已经有登录表单
      const hasForm = document.querySelector('input[type="password"], input[type="text"], input[type="email"]');
      if (hasForm && hasForm.offsetParent !== null) {
        autoFillLoginForm(credentials, selectors, autoSubmit);
      } else if (retryCount < MAX_RETRIES) {
        retryCount++;
        console.log(`[网盘通] 等待登录表单加载... (${retryCount}/${MAX_RETRIES})`);
        setTimeout(tryFill, RETRY_INTERVAL);
      } else {
        console.log('[网盘通] 未检测到登录表单，请手动登录');
      }
    };

    tryFill();
  }

  // ===== 监听来自 Background 的消息 =====
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'fillLoginForm') {
      const { username, password, loginSelectors, autoSubmit } = request;

      if (fillAttempted) {
        sendResponse({ success: false, error: '已经尝试填充过，不再重复操作' });
        return true;
      }

      fillWithRetry(
        { username, password },
        loginSelectors,
        autoSubmit || false
      );

      sendResponse({ success: true, message: '正在填充登录表单...' });
      return true;
    }

    if (request.action === 'checkPageReady') {
      const hasForm = !!document.querySelector('input[type="password"], input[type="text"]');
      sendResponse({ ready: hasForm, url: location.href });
      return true;
    }
  });

  console.log('[网盘通] 内容脚本初始化完成，等待登录指令...');
})();