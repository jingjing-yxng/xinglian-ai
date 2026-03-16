// Main app logic — auth flow, remote control UI, platform switching

const PLATFORM_NAMES = { douyin: '抖音', xiaohongshu: '小红书' };

const PLATFORM_COLORS = {
  douyin: { accent: '#5CE0F2', accentHover: '#4A47D6' },
  xiaohongshu: { accent: '#E03E52', accentHover: '#C23074' }
};

const App = {
  currentPlatform: 'douyin',
  port: null,
  _refreshInterval: null,

  async init() {
    // Load persisted platform
    const saved = await Settings.get('currentPlatform');
    if (saved === 'douyin' || saved === 'xiaohongshu') {
      this.currentPlatform = saved;
    }

    // Check auth state
    const session = await Auth.getSession();
    if (session) {
      this._showMainScreen(session);
    } else {
      this._showLoginScreen();
    }

    this._setupLoginForm();
  },

  // ============ Auth Screens ============

  _showLoginScreen() {
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('mainScreen').style.display = 'none';
    if (this._refreshInterval) {
      clearInterval(this._refreshInterval);
      this._refreshInterval = null;
    }
  },

  _showMainScreen(session) {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('mainScreen').style.display = 'block';

    // Set user info
    const email = session.user?.email || '';
    document.getElementById('hubUser').textContent = email;
    document.getElementById('footerEmail').textContent = email;

    this._setupPlatformToggle();
    this._applyPlatformColors();
    this._setupQuickActions();
    this._setupLogout();
    this._connectPort();
    this._listenForPageChanges();
    this._updateHubStatus();
    this._refreshStats();

    // Periodic refresh
    this._refreshInterval = setInterval(() => {
      this._refreshStats();
      this._refreshQueue();
    }, 15000);
  },

  _setupLoginForm() {
    const form = document.getElementById('loginForm');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('loginEmail').value;
      const password = document.getElementById('loginPassword').value;
      const errorEl = document.getElementById('loginError');
      const btn = document.getElementById('loginBtn');

      errorEl.style.display = 'none';
      btn.disabled = true;
      btn.textContent = '登录中...';

      try {
        const data = await Auth.login(email, password);
        this._showMainScreen({ user: data.user });
        this.toast('登录成功', 'success');
      } catch (err) {
        errorEl.textContent = err.message;
        errorEl.style.display = 'block';
      } finally {
        btn.disabled = false;
        btn.textContent = '登录';
      }
    });
  },

  _setupLogout() {
    document.getElementById('logoutBtn').addEventListener('click', async () => {
      await Auth.logout();
      this._showLoginScreen();
      this.toast('已退出', 'info');
    });
  },

  // ============ Hub Status ============

  async _updateHubStatus() {
    const hubDot = document.querySelector('.hub-dot');
    const hubText = document.getElementById('hubStatusText');

    try {
      await ApiClient.getAuthInfo();
      hubDot.classList.add('online');
      hubText.textContent = '云端已连接';
    } catch (err) {
      hubDot.classList.remove('online');
      if (err?.message?.includes('401') || err?.message?.includes('Unauthorized')) {
        hubText.textContent = '登录已过期 — 请重新登录';
      } else if (err?.message?.includes('Failed to fetch') || err?.message?.includes('NetworkError')) {
        hubText.textContent = '云端未连接 — 检查网络';
      } else {
        hubText.textContent = '云端未连接';
      }
    }
  },

  // ============ Stats ============

  async _refreshStats() {
    try {
      const { quotas } = await ApiClient.getQuotas(this.currentPlatform);
      const today = quotas?.[0];

      document.getElementById('statFR').textContent = today?.friend_requests_used ?? 0;
      document.getElementById('statMsg').textContent = today?.messages_used ?? 0;
      document.getElementById('statNeg').textContent = today?.negotiation_replies_used ?? 0;

      const { prospects } = await ApiClient.getProspects({ platform: this.currentPlatform, limit: 9999 });
      document.getElementById('statProspects').textContent = prospects?.length ?? 0;
    } catch {
      // Silent — stats are best-effort
    }
  },

  // ============ Queue ============

  async _refreshQueue() {
    try {
      const { actions } = await ApiClient.getPendingActions(this.currentPlatform);
      const count = actions?.length ?? 0;
      document.getElementById('queueCount').textContent = `${count} 待执行`;

      const list = document.getElementById('queueList');
      if (!actions || actions.length === 0) {
        list.innerHTML = '<div class="empty-state" style="padding:10px;"><span class="empty-state-text">无待执行任务</span></div>';
        return;
      }

      list.innerHTML = actions.slice(0, 5).map(a => `
        <div class="queue-item">
          <span class="queue-type">${this._actionLabel(a.action_type)}</span>
          <span class="queue-meta">${a.payload?.nickname || ''}</span>
        </div>
      `).join('');
    } catch {
      // Silent
    }
  },

  _actionLabel(type) {
    const labels = {
      follow: '关注',
      send_dm: '发私信',
      scan_search: '扫描搜索',
      scan_profile: '扫描主页',
      scan_conversations: '扫描对话',
      navigate: '导航',
    };
    return labels[type] || type;
  },

  // ============ Quick Actions ============

  _setupQuickActions() {
    document.getElementById('btnScan').addEventListener('click', () => {
      this.sendToContent({ type: 'SCAN_SEARCH' }).then(r => {
        if (r?.data?.prospects) {
          // Sync scanned prospects to server
          ApiClient.upsertProspects(r.data.prospects.map(p => ({
            ...p,
            platform: this.currentPlatform,
          }))).then(() => {
            this.toast(`已同步 ${r.data.prospects.length} 位达人`, 'success');
            this._refreshStats();
          });
        }
      }).catch(err => this.toast(`扫描失败: ${err.message}`, 'error'));
    });

    document.getElementById('btnFollow').addEventListener('click', () => {
      this.sendToContent({ type: 'ACTION_FOLLOW' }).then(() => {
        ApiClient.incrementQuota(this.currentPlatform, 'friend_requests_used');
        this.toast('已发送关注', 'success');
        this._refreshStats();
      }).catch(err => this.toast(`关注失败: ${err.message}`, 'error'));
    });

    document.getElementById('btnDM').addEventListener('click', () => {
      this.sendToContent({ type: 'ACTION_SEND_DM' }).then(() => {
        ApiClient.incrementQuota(this.currentPlatform, 'messages_used');
        this.toast('已发送私信', 'success');
        this._refreshStats();
      }).catch(err => this.toast(`私信失败: ${err.message}`, 'error'));
    });
  },

  // ============ Platform Toggle ============

  _setupPlatformToggle() {
    document.querySelectorAll('.platform-toggle-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.switchPlatform(btn.dataset.platform);
      });
    });
    this._updatePlatformToggleUI();
  },

  async switchPlatform(platform) {
    if (platform === this.currentPlatform) return;
    this.currentPlatform = platform;
    await Settings.set({ currentPlatform: platform });
    this._updatePlatformToggleUI();
    this._applyPlatformColors();
    this._updateConnectionStatus(null);
    this._listenForPageChanges();
    this._refreshStats();
    this._refreshQueue();
  },

  _updatePlatformToggleUI() {
    document.querySelectorAll('.platform-toggle-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.platform === this.currentPlatform);
    });
  },

  _applyPlatformColors() {
    const colors = PLATFORM_COLORS[this.currentPlatform] || PLATFORM_COLORS.douyin;
    document.documentElement.style.setProperty('--primary', colors.accent);
    document.documentElement.style.setProperty('--primary-hover', colors.accentHover);
  },

  // ============ Content Script Connection ============

  _connectPort() {
    this.port = chrome.runtime.connect({ name: 'side-panel' });
    this.port.onMessage.addListener((msg) => this._handleMessage(msg));
    this.port.onDisconnect.addListener(() => {
      setTimeout(() => this._connectPort(), 1000);
    });
  },

  _handleMessage(msg) {
    if (msg.type === 'PAGE_CHANGED' || msg.type === 'PLATFORM_DETECTED') {
      const platform = msg.data?.platform;
      if (platform === this.currentPlatform) {
        this._updateConnectionStatus(msg.data?.pageType || 'connected');
        this._enableQuickActions(msg.data?.pageType);
      }
    }
  },

  _listenForPageChanges() {
    this.sendToContent({ type: 'PING' }).then(response => {
      if (response?.type === 'PONG') {
        this._updateConnectionStatus('connected');
        this.sendToContent({ type: 'GET_PAGE_TYPE' }).then(r => {
          if (r?.data) {
            this._updateConnectionStatus(r.data);
            this._enableQuickActions(r.data);
          }
        });
      }
    }).catch(() => {
      this._updateConnectionStatus(null);
      this._disableQuickActions();
    });
  },

  _updateConnectionStatus(pageType) {
    const el = document.getElementById('connectionStatus');
    const name = PLATFORM_NAMES[this.currentPlatform] || this.currentPlatform;
    if (!pageType) {
      el.textContent = `${name} · 未连接`;
      el.className = 'header-status';
    } else {
      const labels = {
        search: '搜索页', profile: '个人页', chat: '消息页',
        discover: '发现页', other: '已连接', connected: '已连接'
      };
      el.textContent = `${name} · ${labels[pageType] || '已连接'}`;
      el.className = 'header-status connected';
    }
  },

  _enableQuickActions(pageType) {
    document.getElementById('btnScan').disabled = !['search', 'discover'].includes(pageType);
    document.getElementById('btnFollow').disabled = pageType !== 'profile';
    document.getElementById('btnDM').disabled = !['profile', 'chat'].includes(pageType);
  },

  _disableQuickActions() {
    document.getElementById('btnScan').disabled = true;
    document.getElementById('btnFollow').disabled = true;
    document.getElementById('btnDM').disabled = true;
  },

  // ============ Messaging ============

  async sendToContent(msg) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('超时')), 15000);
      chrome.runtime.sendMessage(
        { ...msg, target: 'content-script', _targetPlatform: this.currentPlatform },
        (response) => {
          clearTimeout(timeout);
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(response);
          }
        }
      );
    });
  },

  // ============ Toast ============

  toast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  },

  platformBadge(platform) {
    const labels = { douyin: '抖', xiaohongshu: '红' };
    const p = platform || 'douyin';
    return `<span class="platform-badge platform-badge-${p}">${labels[p] || p}</span>`;
  }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => App.init());
