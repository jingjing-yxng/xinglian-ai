// Action Executor — Receives actions from queue, dispatches to content scripts, reports results

const PLATFORM_DOMAINS = {
  douyin: 'douyin.com',
  xiaohongshu: 'xiaohongshu.com',
};

const ActionExecutor = {
  _processing: false,

  async pollAndExecute(platform = null) {
    if (this._processing) return;
    this._processing = true;

    try {
      const { actions } = await ApiClient.getPendingActions(platform);
      if (!actions || actions.length === 0) return;

      for (const action of actions) {
        try {
          await ApiClient.claimAction(action.id);
          const result = await this._execute(action);
          await ApiClient.completeAction(action.id, result);

          await ApiClient.logActivity({
            platform: action.platform,
            prospect_id: action.prospect_id,
            action: `执行: ${action.action_type}`,
            detail: JSON.stringify(result).substring(0, 200),
            source: 'extension',
          });
        } catch (err) {
          console.error(`[ActionExecutor] Failed action ${action.id}:`, err);
          try {
            await ApiClient.failAction(action.id, err.message, (action.retry_count || 0) + 1);
          } catch (reportErr) {
            console.error('[ActionExecutor] Failed to report failure:', reportErr);
          }
        }
      }
    } catch (err) {
      console.error('[ActionExecutor] Poll error:', err);
    } finally {
      this._processing = false;
    }
  },

  async _execute(action) {
    const { action_type, payload } = action;

    switch (action_type) {
      case 'follow':
        return this._sendToActiveTab({ type: 'ACTION_FOLLOW', data: payload });

      case 'send_dm':
        return this._sendToActiveTab({ type: 'ACTION_SEND_DM', data: payload });

      case 'scan_search': {
        let tabId = null;

        // Auto-scan: navigate a background tab, don't hijack the user's active tab
        if (payload.url) {
          tabId = await this._getOrCreatePlatformTab(payload.url, action.platform);
          const ready = await this._waitForContentScript(action.platform, 15000, tabId);
          if (!ready) throw new Error('Content script not ready after navigation');
        }

        const msgType = payload.url ? 'SCROLL_AND_SCAN' : 'SCAN_SEARCH';
        const scanResult = tabId
          ? await this._sendToTab(tabId, { type: msgType, data: { ...payload, platform: action.platform } })
          : await this._sendToActiveTab({ type: msgType, data: { ...payload, platform: action.platform } });

        // Auto-upsert prospects to server
        const prospects = Array.isArray(scanResult) ? scanResult : (scanResult?.prospects || []);
        if (prospects.length > 0) {
          try {
            await ApiClient.upsertProspects(prospects.map(p => ({
              ...p,
              platform: action.platform,
            })));
            console.log(`[ActionExecutor] Upserted ${prospects.length} prospects`);
          } catch (e) {
            console.error('[ActionExecutor] Failed to upsert prospects:', e);
          }
        }

        return { prospects_found: prospects.length, keyword: payload.keyword || null };
      }

      case 'scan_profile':
        return this._sendToActiveTab({ type: 'SCAN_PROFILE', data: payload });

      case 'scan_conversations':
        return this._sendToActiveTab({ type: 'SCAN_CONVERSATIONS', data: payload });

      case 'navigate':
        if (payload.url) {
          const tabs = await this._queryTabs({ active: true, currentWindow: true });
          if (tabs[0]) {
            await this._updateTab(tabs[0].id, { url: payload.url });
          }
          await new Promise(r => setTimeout(r, 3000));
          return { navigated: payload.url };
        }
        return { error: 'No URL provided' };

      default:
        throw new Error(`Unknown action type: ${action_type}`);
    }
  },

  // ============ Tab Management ============

  // Find an existing tab for this platform, or create a new background tab
  async _getOrCreatePlatformTab(url, platform) {
    const domain = PLATFORM_DOMAINS[platform];
    if (!domain) throw new Error(`Unknown platform: ${platform}`);

    // Look for an existing tab on this platform
    const tabs = await this._queryTabs({ url: `*://*.${domain}/*` });
    if (tabs.length > 0) {
      // Reuse the first matching tab — navigate it to the search URL
      const tab = tabs[0];
      await this._updateTab(tab.id, { url });
      console.log(`[ActionExecutor] Reusing existing ${platform} tab ${tab.id}`);
      return tab.id;
    }

    // No existing tab — create a new one in the background (not active)
    const newTab = await new Promise((resolve) => {
      chrome.tabs.create({ url, active: false }, resolve);
    });
    console.log(`[ActionExecutor] Created new background ${platform} tab ${newTab.id}`);
    return newTab.id;
  },

  // ============ Messaging ============

  // Send to the user's active tab (for manual actions like follow, DM)
  async _sendToActiveTab(message) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Content script timeout')), 30000);
      chrome.runtime.sendMessage(
        { ...message, target: 'content-script', _targetPlatform: message.data?.platform },
        (response) => {
          clearTimeout(timeout);
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else if (response?.error) {
            reject(new Error(response.error));
          } else {
            resolve(response?.data || response || {});
          }
        }
      );
    });
  },

  // Send directly to a specific tab (for auto-scan background tabs)
  async _sendToTab(tabId, message) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Content script timeout')), 30000);
      chrome.tabs.sendMessage(tabId, message, (response) => {
        clearTimeout(timeout);
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (response?.error) {
          reject(new Error(response.error));
        } else {
          resolve(response?.data || response || {});
        }
      });
    });
  },

  // Ping a specific tab's content script until it responds
  async _waitForContentScript(platform, maxWait = 15000, tabId = null) {
    const start = Date.now();
    while (Date.now() - start < maxWait) {
      try {
        const result = await new Promise((resolve, reject) => {
          const t = setTimeout(() => reject(new Error('ping timeout')), 3000);
          const msg = { type: 'PING' };
          const cb = (response) => {
            clearTimeout(t);
            if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
            else resolve(response);
          };

          if (tabId) {
            chrome.tabs.sendMessage(tabId, msg, cb);
          } else {
            chrome.runtime.sendMessage({ ...msg, target: 'content-script', _targetPlatform: platform }, cb);
          }
        });
        if (result?.type === 'PONG') return true;
      } catch (e) {
        // Content script not ready yet
      }
      await new Promise(r => setTimeout(r, 2000));
    }
    return false;
  },

  // ============ Chrome API Helpers ============

  _queryTabs(query) {
    return new Promise((resolve) => chrome.tabs.query(query, resolve));
  },

  _updateTab(tabId, props) {
    return new Promise((resolve) => chrome.tabs.update(tabId, props, resolve));
  },
};
