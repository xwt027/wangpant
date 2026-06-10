// 网盘通 - 网盘配置文件
// 包含所有支持的网盘信息、登录URL、表单选择器等

const DRIVES_CONFIG = [
  // ===== 国内网盘 =====
  {
    id: 'baidu',
    name: '百度网盘',
    icon: 'icons/drives/baidu.svg',
    color: '#3388FF',
    loginUrl: 'https://pan.baidu.com/',
    category: 'domestic',
    loginSelectors: {
      username: '#TANGRAM__PSP_4__userName, input[name="userName"], input[placeholder*="手机"], input[placeholder*="账号"], input[type="text"]',
      password: '#TANGRAM__PSP_4__password, input[name="password"], input[type="password"]',
      submit: '#TANGRAM__PSP_4__submit, a[title="登录"], .pass-button-submit, button[type="submit"]'
    }
  },
  {
    id: 'aliyun',
    name: '阿里云盘',
    icon: 'icons/drives/aliyun.svg',
    color: '#FF6A00',
    loginUrl: 'https://www.aliyundrive.com/drive/',
    category: 'domestic',
    loginSelectors: {
      username: 'input[placeholder*="手机号"], input[type="text"]',
      password: 'input[type="password"]',
      submit: 'button[type="submit"], .login-button'
    }
  },
  {
    id: 'quark',
    name: '夸克网盘',
    icon: 'icons/drives/quark.svg',
    color: '#FF4400',
    loginUrl: 'https://pan.quark.cn/',
    category: 'domestic',
    loginSelectors: {
      username: 'input[placeholder*="手机号"], input[type="text"]',
      password: 'input[type="password"]',
      submit: 'button[type="submit"]'
    }
  },
  {
    id: 'xunlei',
    name: '迅雷云盘',
    icon: 'icons/drives/xunlei.svg',
    color: '#00BFFF',
    loginUrl: 'https://pan.xunlei.com/',
    category: 'domestic',
    loginSelectors: {
      username: 'input[placeholder*="手机号"], input[type="text"]',
      password: 'input[type="password"]',
      submit: 'button[type="submit"]'
    }
  },
  {
    id: '115',
    name: '115网盘',
    icon: 'icons/drives/115.svg',
    color: '#FF6600',
    loginUrl: 'https://115.com/',
    category: 'domestic',
    loginSelectors: {
      username: 'input[name="account"], input[placeholder*="账号"], input[type="text"]',
      password: 'input[name="passwd"], input[type="password"]',
      submit: 'a[href="javascript:void(0);"], button[type="submit"], .login-btn'
    }
  },
  {
    id: 'weiyun',
    name: '腾讯微云',
    icon: 'icons/drives/weiyun.svg',
    color: '#12B7F5',
    loginUrl: 'https://www.weiyun.com/',
    category: 'domestic',
    loginSelectors: {
      username: 'input[placeholder*="QQ号"], input[placeholder*="账号"], input[type="text"]',
      password: 'input[type="password"]',
      submit: 'button[type="submit"], .login-btn'
    }
  },
  {
    id: 'lanzou',
    name: '蓝奏云',
    icon: 'icons/drives/lanzou.svg',
    color: '#00A0E9',
    loginUrl: 'https://pc.woozooo.com/account.php?action=login',
    category: 'domestic',
    loginSelectors: {
      username: 'input[name="username"], input[type="text"]',
      password: 'input[name="password"], input[type="password"]',
      submit: 'input[type="submit"], button[type="submit"]'
    }
  },
  {
    id: 'tianyi',
    name: '天翼云盘',
    icon: 'icons/drives/tianyi.svg',
    color: '#0099FF',
    loginUrl: 'https://cloud.189.cn/',
    category: 'domestic',
    loginSelectors: {
      username: 'input[placeholder*="手机号"], input[type="text"]',
      password: 'input[type="password"]',
      submit: 'button[type="submit"]'
    }
  },
  {
    id: 'uc',
    name: 'UC网盘',
    icon: 'icons/drives/uc.svg',
    color: '#FF6600',
    loginUrl: 'https://drive.uc.cn/',
    category: 'domestic',
    loginSelectors: {
      username: 'input[placeholder*="手机号"], input[type="text"]',
      password: 'input[type="password"]',
      submit: 'button[type="submit"]'
    }
  },
  {
    id: 'caiyun',
    name: '移动彩云',
    icon: 'icons/drives/caiyun.svg',
    color: '#00C853',
    loginUrl: 'https://caiyun.feixin.10086.cn/',
    category: 'domestic',
    loginSelectors: {
      username: 'input[placeholder*="手机号"], input[type="text"]',
      password: 'input[type="password"]',
      submit: 'button[type="submit"]'
    }
  },

  // ===== 国际网盘 =====
  {
    id: 'google',
    name: 'Google Drive',
    icon: 'icons/drives/google.svg',
    color: '#4285F4',
    loginUrl: 'https://drive.google.com/',
    category: 'international',
    loginSelectors: {
      username: 'input[type="email"], input[name="identifier"]',
      password: 'input[type="password"], input[name="Passwd"]',
      submit: 'button[type="submit"], #identifierNext, #passwordNext'
    }
  },
  {
    id: 'onedrive',
    name: 'OneDrive',
    icon: 'icons/drives/onedrive.svg',
    color: '#0078D4',
    loginUrl: 'https://onedrive.live.com/',
    category: 'international',
    loginSelectors: {
      username: 'input[type="email"], input[name="loginfmt"]',
      password: 'input[type="password"], input[name="passwd"]',
      submit: 'input[type="submit"], #idSIButton9'
    }
  },
  {
    id: 'dropbox',
    name: 'Dropbox',
    icon: 'icons/drives/dropbox.svg',
    color: '#0061FF',
    loginUrl: 'https://www.dropbox.com/login',
    category: 'international',
    loginSelectors: {
      username: 'input[type="email"], input[name="login_email"]',
      password: 'input[type="password"], input[name="login_password"]',
      submit: 'button[type="submit"], .login-button'
    }
  },
  {
    id: 'mega',
    name: 'MEGA',
    icon: 'icons/drives/mega.svg',
    color: '#D90007',
    loginUrl: 'https://mega.nz/login',
    category: 'international',
    loginSelectors: {
      username: 'input[name="login-name2"], input[type="email"]',
      password: 'input[name="login-password2"], input[type="password"]',
      submit: 'button[type="submit"], .login-button'
    }
  },
  {
    id: 'box',
    name: 'Box',
    icon: 'icons/drives/box.svg',
    color: '#0061D5',
    loginUrl: 'https://account.box.com/login',
    category: 'international',
    loginSelectors: {
      username: 'input[type="email"], input[name="login"]',
      password: 'input[type="password"], input[name="password"]',
      submit: 'button[type="submit"]'
    }
  },
  {
    id: 'pcloud',
    name: 'pCloud',
    icon: 'icons/drives/pcloud.svg',
    color: '#0A5B9E',
    loginUrl: 'https://u.pcloud.com/',
    category: 'international',
    loginSelectors: {
      username: 'input[name="username"], input[type="email"]',
      password: 'input[name="password"], input[type="password"]',
      submit: 'button[type="submit"]'
    }
  },
  {
    id: 'icloud',
    name: 'iCloud',
    icon: 'icons/drives/icloud.svg',
    color: '#3693E6',
    loginUrl: 'https://www.icloud.com/',
    category: 'international',
    loginSelectors: {
      username: 'input[type="text"], input[type="email"]',
      password: 'input[type="password"]',
      submit: 'button[type="submit"]'
    }
  }
];

// 按分类获取网盘
const getDrivesByCategory = (category) => {
  if (!category) return DRIVES_CONFIG;
  return DRIVES_CONFIG.filter(d => d.category === category);
};

// 获取国内网盘
const getDomesticDrives = () => getDrivesByCategory('domestic');

// 获取国际网盘
const getInternationalDrives = () => getDrivesByCategory('international');

// 根据ID获取网盘配置
const getDriveById = (id) => DRIVES_CONFIG.find(d => d.id === id);

// 导出（用于模块化引用）
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { DRIVES_CONFIG, getDrivesByCategory, getDomesticDrives, getInternationalDrives, getDriveById };
}