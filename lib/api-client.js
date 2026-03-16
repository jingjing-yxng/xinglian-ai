// API Client — Authenticated fetch wrapper for Outreach Hub server communication

const API_BASE = 'https://outreach-hub-lac.vercel.app/api/extension';

const ApiClient = {
  _token: null,

  async _getToken() {
    if (this._token) return this._token;
    const data = await new Promise(r => chrome.storage.local.get('auth', r));
    this._token = data.auth?.access_token || null;
    return this._token;
  },

  setToken(token) {
    this._token = token;
  },

  clearToken() {
    this._token = null;
  },

  async _fetch(path, options = {}) {
    const token = await this._getToken();
    if (!token) throw new Error('Not authenticated');

    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options.headers,
      },
    });

    if (res.status === 401) {
      // Token expired — try refresh
      const refreshed = await Auth.refreshSession();
      if (refreshed) {
        return this._fetch(path, options);
      }
      throw new Error('Session expired');
    }

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `API error ${res.status}`);
    return data;
  },

  // ========== Prospects ==========

  async getProspects(params = {}) {
    const qs = new URLSearchParams();
    if (params.platform) qs.set('platform', params.platform);
    if (params.status) qs.set('status', params.status);
    if (params.limit) qs.set('limit', String(params.limit));
    return this._fetch(`/prospects?${qs}`);
  },

  async upsertProspects(prospects) {
    return this._fetch('/prospects', {
      method: 'POST',
      body: JSON.stringify({ prospects }),
    });
  },

  async updateProspect(id, changes) {
    return this._fetch(`/prospects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(changes),
    });
  },

  async deleteProspect(id) {
    return this._fetch(`/prospects/${id}`, { method: 'DELETE' });
  },

  // ========== Messages ==========

  async getMessages(prospectId) {
    return this._fetch(`/messages?prospect_id=${prospectId}`);
  },

  async addMessages(messages) {
    return this._fetch('/messages', {
      method: 'POST',
      body: JSON.stringify({ messages }),
    });
  },

  // ========== Actions ==========

  async getPendingActions(platform) {
    const qs = platform ? `?platform=${platform}` : '';
    return this._fetch(`/actions${qs}`);
  },

  async claimAction(id) {
    return this._fetch(`/actions/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ status: 'claimed' }),
    });
  },

  async completeAction(id, result = {}) {
    return this._fetch(`/actions/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ status: 'completed', result }),
    });
  },

  async failAction(id, errorMessage, retryCount = 0) {
    return this._fetch(`/actions/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ status: 'failed', error_message: errorMessage, retry_count: retryCount }),
    });
  },

  // ========== AI ==========

  async scoreProspects(prospects, platform) {
    return this._fetch('/ai/score', {
      method: 'POST',
      body: JSON.stringify({ prospects, platform }),
    });
  },

  async draftMessage(prospect, platform) {
    return this._fetch('/ai/draft', {
      method: 'POST',
      body: JSON.stringify({ prospect, platform }),
    });
  },

  async draftNegotiationReply(prospect, conversation, platform) {
    return this._fetch('/ai/negotiate', {
      method: 'POST',
      body: JSON.stringify({ prospect, conversation, platform }),
    });
  },

  // ========== Settings ==========

  async getSettings(platform) {
    const qs = platform ? `?platform=${platform}` : '';
    return this._fetch(`/settings${qs}`);
  },

  async updateSettings(data) {
    return this._fetch('/settings', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // ========== Quotas ==========

  async getQuotas(platform) {
    const qs = platform ? `?platform=${platform}` : '';
    return this._fetch(`/quotas${qs}`);
  },

  async incrementQuota(platform, field, amount = 1) {
    return this._fetch('/quotas', {
      method: 'POST',
      body: JSON.stringify({ platform, field, amount }),
    });
  },

  // ========== Heartbeat ==========

  async sendHeartbeat(platform) {
    return this._fetch('/heartbeat', {
      method: 'POST',
      body: JSON.stringify({ version: chrome.runtime.getManifest().version, platform }),
    });
  },

  // ========== Activity ==========

  async logActivity(entries) {
    const arr = Array.isArray(entries) ? entries : [entries];
    return this._fetch('/activity', {
      method: 'POST',
      body: JSON.stringify({ entries: arr }),
    });
  },

  async getActivity(limit = 50) {
    return this._fetch(`/activity?limit=${limit}`);
  },

  // ========== Automation ==========

  async automationTick() {
    return this._fetch('/automation/tick', { method: 'POST' });
  },

  // ========== Auth check ==========

  async getAuthInfo() {
    return this._fetch('/auth');
  },
};
