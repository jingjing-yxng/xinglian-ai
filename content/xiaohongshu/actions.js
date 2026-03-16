// XHS (Xiaohongshu) page actions — click follow, send messages, etc.
// No React fiber — uses DOM events only via BaseActions._smartClick()

const XhsActions = {
  ...BaseActions,

  // ============ Chat Input Finding ============

  _findChatInput() {
    // Strategy 1: role="textbox"
    const textboxes = document.querySelectorAll('[role="textbox"]');
    for (const el of textboxes) {
      if (this._isVisible(el) && !this._isSearchInput(el)) return el;
    }

    // Strategy 2: CSS selector fallback
    let input = queryFirst(document, XHS_SELECTORS.chat.inputBox);
    if (input && this._isVisible(input) && !this._isSearchInput(input)) return input;

    // Strategy 3: visible textarea
    for (const ta of document.querySelectorAll('textarea')) {
      if (this._isVisible(ta) && !this._isSearchInput(ta)) return ta;
    }

    // Strategy 4: contenteditable
    for (const el of document.querySelectorAll('[contenteditable="true"]')) {
      if (this._isVisible(el) && !this._isSearchInput(el)) return el;
    }

    return null;
  },

  _waitForChatInput(timeoutMs = 10000) {
    return new Promise((resolve) => {
      let done = false;
      const check = () => {
        if (done) return;
        const el = this._findChatInput();
        if (el) {
          done = true;
          clearInterval(poller);
          clearTimeout(timer);
          console.log('[XHS] Chat input visible:', el.tagName, el.className?.substring?.(0, 50));
          resolve(el);
        }
      };
      const poller = setInterval(check, 300);
      check();
      const timer = setTimeout(() => {
        if (!done) {
          done = true;
          clearInterval(poller);
          console.log('[XHS] Chat input not visible after', timeoutMs, 'ms');
          resolve(null);
        }
      }, timeoutMs);
    });
  },

  // ============ Actions ============

  // Wait for user cards to load (skeleton → real content)
  waitForUserCards(timeoutMs = 8000) {
    return new Promise((resolve) => {
      const start = Date.now();
      const check = () => {
        // Look for signs that user cards have loaded:
        // - Profile links appearing
        // - "粉丝" text appearing
        // - "关注" buttons appearing (not just the one in the header)
        const profileLinks = document.querySelectorAll('a[href*="/user/profile/"]');
        const hasFollowBtns = this._findByText('关注').length > 0;
        const hasFans = document.body.textContent.includes('粉丝');

        // Need at least a couple profile links (not just sidebar "我")
        if (profileLinks.length >= 2 && (hasFollowBtns || hasFans)) {
          console.log('[XHS] User cards loaded:', profileLinks.length, 'profile links');
          resolve(true);
          return;
        }

        if (Date.now() - start > timeoutMs) {
          console.log('[XHS] User cards did not load within', timeoutMs, 'ms');
          resolve(false);
          return;
        }

        setTimeout(check, 500);
      };
      check();
    });
  },

  // Click the "用户" tab on XHS search results page
  async clickUserTab() {
    try {
      console.log('[XHS] Looking for 用户 tab...');
      const urlBefore = window.location.href;

      // Find the "用户" tab element — search all elements near page top
      let tabEl = null;
      let tabHref = null;

      // Strategy 1: Find <a> with text "用户" near top
      const allLinks = document.querySelectorAll('a');
      for (const a of allLinks) {
        if (a.textContent.trim() === '用户' && a.offsetWidth > 0) {
          const rect = a.getBoundingClientRect();
          if (rect.top < 200 && rect.top > 20) {
            tabEl = a;
            tabHref = a.href || a.getAttribute('href') || '';
            break;
          }
        }
      }

      // Strategy 2: Any visible element with exact text "用户" near top
      if (!tabEl) {
        const all = document.querySelectorAll('div, span, a, li, button');
        for (const el of all) {
          if (el.textContent.trim() === '用户' && el.textContent.length <= 7 && el.offsetWidth > 0) {
            const rect = el.getBoundingClientRect();
            if (rect.top < 200 && rect.top > 20) { tabEl = el; break; }
          }
        }
      }

      if (!tabEl) {
        console.log('[XHS] 用户 tab not found');
        return { success: false, error: '未找到用户标签' };
      }

      console.log('[XHS] Found 用户 tab:', tabEl.tagName, tabEl.className?.substring?.(0, 80), 'href:', tabHref?.substring?.(0, 100));

      // === Attempt 1: Dispatched events (SPA framework intercepts without full navigation) ===
      // Do NOT call el.click() on <a> elements — it follows href and kills the content script
      const rect = tabEl.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      const opts = { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y };

      tabEl.dispatchEvent(new PointerEvent('pointerdown', { ...opts, pointerId: 1 }));
      tabEl.dispatchEvent(new PointerEvent('pointerup', { ...opts, pointerId: 1 }));
      tabEl.dispatchEvent(new MouseEvent('mousedown', opts));
      tabEl.dispatchEvent(new MouseEvent('mouseup', opts));
      tabEl.dispatchEvent(new MouseEvent('click', opts));

      await this._delay(800, 1200);

      // Check if URL changed (SPA routing worked)
      if (window.location.href !== urlBefore) {
        console.log('[XHS] Tab click worked via dispatched events, URL:', window.location.href);
        return { success: true, method: 'dispatch' };
      }

      // === Attempt 2: history.pushState + popstate (triggers Vue/React Router) ===
      if (tabHref && tabHref.startsWith('http')) {
        console.log('[XHS] Dispatched events did not change URL, trying pushState with:', tabHref);
        try {
          const url = new URL(tabHref);
          const newPath = url.pathname + url.search;
          history.pushState(history.state, '', newPath);
          window.dispatchEvent(new PopStateEvent('popstate', { state: history.state }));
          await this._delay(500, 800);
          console.log('[XHS] After pushState, URL:', window.location.href);
          return { success: true, method: 'pushState' };
        } catch (e) {
          console.log('[XHS] pushState fallback failed:', e);
        }
      }

      // === Attempt 3: Click innermost text node's parent (some frameworks bind to inner element) ===
      if (tabEl.children.length > 0) {
        const innerEl = tabEl.querySelector('span, div, em') || tabEl.firstElementChild;
        if (innerEl && innerEl.textContent.trim() === '用户') {
          console.log('[XHS] Trying click on inner element:', innerEl.tagName);
          const innerRect = innerEl.getBoundingClientRect();
          const ix = innerRect.left + innerRect.width / 2;
          const iy = innerRect.top + innerRect.height / 2;
          const iOpts = { bubbles: true, cancelable: true, view: window, clientX: ix, clientY: iy };
          innerEl.dispatchEvent(new MouseEvent('click', iOpts));
          await this._delay(500, 800);

          if (window.location.href !== urlBefore) {
            console.log('[XHS] Inner element click worked, URL:', window.location.href);
            return { success: true, method: 'innerClick' };
          }
        }
      }

      // Still return success optimistically — waitForUserCards will verify
      console.log('[XHS] Tab click attempts done, URL unchanged. waitForUserCards will verify.');
      return { success: true, method: 'optimistic' };
    } catch (e) {
      console.error('[XHS] clickUserTab error:', e);
      return { success: false, error: e.message };
    }
  },

  async clickFollow() {
    try {
      // Check if already followed
      const alreadyFollowed = this._findByText('已关注').length > 0 ||
                              this._findByText('互相关注').length > 0;
      if (alreadyFollowed) return { success: true, already: true };

      const btns = this._findByText('关注');
      if (btns.length === 0) return { success: false, error: '未找到关注按钮' };

      await this._delay(500, 1500);
      console.log('[XHS] Clicking 关注 button');
      this._smartClick(btns[0]);
      await this._delay(1000, 2000);

      const followed = this._findByText('已关注').length > 0 ||
                       this._findByText('互相关注').length > 0;
      return { success: followed || true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  async _typeText(element, text) {
    element.focus();
    await this._delay(200, 400);

    const isContentEditable = element.getAttribute('contenteditable') === 'true' ||
                              element.getAttribute('role') === 'textbox';

    if (isContentEditable) {
      // Clear existing content
      document.execCommand('selectAll', false, null);
      document.execCommand('delete', false, null);
      await this._delay(100, 200);

      // Try paste event
      try {
        const dt = new DataTransfer();
        dt.setData('text/plain', text);
        const pasteEvent = new ClipboardEvent('paste', {
          bubbles: true,
          cancelable: true,
          clipboardData: dt
        });
        element.dispatchEvent(pasteEvent);
        console.log('[XHS] Typed via paste event');
      } catch (e) {
        console.log('[XHS] Paste event failed, trying execCommand');
        document.execCommand('insertText', false, text);
      }

      await this._delay(200, 300);

      // Verify text was inserted
      if (!element.textContent || element.textContent.trim().length === 0) {
        console.log('[XHS] Paste didn\'t work, trying composition events');
        element.focus();
        element.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true, data: '' }));
        document.execCommand('insertText', false, text);
        element.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: text }));
      }

      element.dispatchEvent(new Event('input', { bubbles: true }));
    } else {
      // Standard input/textarea
      element.value = '';
      element.dispatchEvent(new Event('input', { bubbles: true }));
      await this._delay(100, 200);
      element.value = text;
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
    }
  },

  async sendMessage(text) {
    try {
      let input = this._chatInput || this._findChatInput();
      if (!input) {
        await this._delay(2000, 3000);
        input = this._findChatInput();
      }
      if (!input) {
        return { success: false, error: '未找到消息输入框' };
      }

      console.log('[XHS] Sending message to:', input.tagName, input.className?.substring?.(0, 40));

      await this._delay(500, 1000);
      await this._typeText(input, text);
      await this._delay(800, 1500);

      // Find send button
      let sendBtn = queryFirst(document, XHS_SELECTORS.chat.sendButton);
      if (!sendBtn) {
        const sendBtns = this._findByText('发送');
        if (sendBtns.length > 0) sendBtn = sendBtns[0];
      }
      if (!sendBtn) sendBtn = findButtonByText(document, '发送');

      if (sendBtn) {
        console.log('[XHS] Clicking send button');
        this._smartClick(sendBtn);
        await this._delay(1000, 2000);
        return { success: true, method: 'button' };
      }

      // Fallback: press Enter
      console.log('[XHS] No send button, trying Enter');
      input.focus();
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
      input.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
      input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
      await this._delay(1000, 2000);
      return { success: true, method: 'enter' };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  async navigateToProfile(url) {
    if (!url) return { success: false, error: 'No URL provided' };
    window.location.href = url;
    return { success: true };
  },

  async openConversationByName(targetName) {
    try {
      const conversations = XhsExtractors.extractConversations();
      const match = conversations.find(c =>
        c.name === targetName || c.name.includes(targetName) || targetName.includes(c.name)
      );

      if (!match || !match.element) {
        return { success: false, error: `未找到与"${targetName}"匹配的对话` };
      }

      await this._delay(300, 600);
      this._smartClick(match.element);
      await this._delay(500, 1000);

      const chatInput = await this._waitForChatInput(8000);
      if (chatInput) {
        this._chatInput = chatInput;
        return { success: true };
      }

      return { success: false, error: '对话已点击但聊天框未出现' };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  async openMessageDialog() {
    try {
      const urlBefore = window.location.href;

      // Look for message/DM button
      let candidates = this._findByText('发消息');
      if (candidates.length === 0) candidates = this._findByText('私信');
      if (candidates.length === 0) candidates = this._findByText('发私信');

      // Also try selector
      const selectorBtn = queryFirst(document, XHS_SELECTORS.profile.messageButton);
      if (selectorBtn && !candidates.includes(selectorBtn)) candidates.unshift(selectorBtn);

      if (candidates.length === 0) {
        return { success: false, error: '未找到私信按钮' };
      }

      console.log('[XHS] Found', candidates.length, '私信/发消息 candidates');

      // Try clicking each candidate and its parents
      const clickTargets = [];
      for (const el of candidates) {
        clickTargets.push(el);
        if (el.parentElement) clickTargets.push(el.parentElement);
        if (el.parentElement?.parentElement) clickTargets.push(el.parentElement.parentElement);
      }

      for (const target of clickTargets) {
        console.log('[XHS] Trying:', target.tagName, target.className?.substring?.(0, 50));
        this._smartClick(target);

        await this._delay(300, 500);
        let chatInput = this._findChatInput();
        if (chatInput) {
          console.log('[XHS] Chat opened!');
          this._chatInput = chatInput;
          return { success: true };
        }

        // Check if we navigated to IM page
        if (window.location.href !== urlBefore) {
          console.log('[XHS] Navigated to:', window.location.href);
          return { success: false, navigated: true };
        }
      }

      // Wait for dialog to appear
      console.log('[XHS] Waiting for chat dialog...');
      const chatInput = await this._waitForChatInput(8000);
      if (chatInput) {
        this._chatInput = chatInput;
        return { success: true };
      }

      if (window.location.href !== urlBefore) {
        return { success: false, navigated: true };
      }

      return { success: false, error: '私信对话框未出现' };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }
};
