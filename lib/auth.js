// Auth — Login, token storage, refresh logic for Outreach Hub

const SUPABASE_URL = 'https://kcdaaavcnvbzzzvceenb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtjZGFhYXZjbnZienp6dmNlZW5iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxMTQxNzMsImV4cCI6MjA4ODY5MDE3M30.aOk7Ck3kXj6j0_uexLUc6-ZSPX1tXtqFnCldlVMbGX4';

const Auth = {
  async login(email, password) {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error_description || data.msg || 'Login failed');

    await this._saveSession(data);
    ApiClient.setToken(data.access_token);
    return data;
  },

  async refreshSession() {
    const stored = await new Promise(r => chrome.storage.local.get('auth', r));
    const refreshToken = stored.auth?.refresh_token;
    if (!refreshToken) return false;

    try {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      if (!res.ok) {
        await this.logout();
        return false;
      }

      const data = await res.json();
      await this._saveSession(data);
      ApiClient.setToken(data.access_token);
      return true;
    } catch {
      return false;
    }
  },

  async logout() {
    ApiClient.clearToken();
    await new Promise(r => chrome.storage.local.remove('auth', r));
  },

  async getSession() {
    const stored = await new Promise(r => chrome.storage.local.get('auth', r));
    if (!stored.auth?.access_token) return null;

    // Check if token is expired
    const exp = stored.auth.expires_at;
    if (exp && Date.now() / 1000 > exp - 60) {
      // Expired or about to expire — try refresh
      const refreshed = await this.refreshSession();
      if (!refreshed) return null;
      const updated = await new Promise(r => chrome.storage.local.get('auth', r));
      return updated.auth;
    }

    ApiClient.setToken(stored.auth.access_token);
    return stored.auth;
  },

  async isLoggedIn() {
    const session = await this.getSession();
    return !!session;
  },

  async _saveSession(data) {
    await new Promise(r => chrome.storage.local.set({
      auth: {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: data.expires_at,
        user: data.user,
      }
    }, r));
  },
};
