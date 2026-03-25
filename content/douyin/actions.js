// Douyin-specific actions — click follow, send messages, etc.
// Uses React fiber internals to trigger handlers (Douyin is a React app)

const DouyinActions = {
  // Inherit shared utilities
  ...BaseActions,

  // ============ React Internals ============

  _getReactFiber(el) {
    if (!el) return null;
    const key = Object.keys(el).find(k =>
      k.startsWith('__reactFiber$') ||
      k.startsWith('__reactInternalInstance$')
    );
    return key ? el[key] : null;
  },

  _getReactProps(el) {
    if (!el) return null;
    const key = Object.keys(el).find(k => k.startsWith('__reactProps$'));
    return key ? el[key] : null;
  },

  _triggerReactClick(el) {
    const props = this._getReactProps(el);
    if (props?.onClick) {
      console.log('[XingLian:Douyin] Found onClick via __reactProps$');
      props.onClick({ preventDefault: () => {}, stopPropagation: () => {}, nativeEvent: {}, type: 'click', target: el, currentTarget: el });
      return true;
    }
    if (props?.onClickCapture) {
      props.onClickCapture({ preventDefault: () => {}, stopPropagation: () => {}, nativeEvent: {}, type: 'click', target: el, currentTarget: el });
      return true;
    }

    let fiber = this._getReactFiber(el);
    let depth = 0;
    while (fiber && depth < 30) {
      const fp = fiber.memoizedProps || fiber.pendingProps;
      if (fp?.onClick) {
        console.log('[XingLian:Douyin] Found onClick on fiber at depth', depth);
        fp.onClick({ preventDefault: () => {}, stopPropagation: () => {}, nativeEvent: {}, type: 'click', target: el, currentTarget: el });
        return true;
      }
      fiber = fiber.return;
      depth++;
    }

    return false;
  },

  // Override: React fiber first, then DOM events as fallback
  _smartClick(el) {
    if (this._triggerReactClick(el)) return true;

    let parent = el.parentElement;
    for (let i = 0; i < 5 && parent; i++) {
      if (this._triggerReactClick(parent)) return true;
      parent = parent.parentElement;
    }

    // Fallback: DOM events
    console.log('[XingLian:Douyin] No React handler found, using DOM events');
    return BaseActions._smartClick(el);
  },

  // ============ Chat Input Finding ============

  _findChatInput() {
    // Strategy 1: Draft.js editor
    const draftEditors = document.querySelectorAll('.public-DraftEditor-content');
    for (const ed of draftEditors) {
      if (this._isVisible(ed) && !this._isSearchInput(ed)) return ed;
    }

    // Strategy 2: role="textbox"
    const textboxes = document.querySelectorAll('[role="textbox"]');
    for (const el of textboxes) {
      if (this._isVisible(el) && !this._isSearchInput(el)) return el;
    }

    // Strategy 3: data-e2e chat selectors
    let input = queryFirst(document, DOUYIN_SELECTORS.chat.messageInput);
    if (input && this._isVisible(input) && !this._isSearchInput(input)) return input;

    // Strategy 4: visible textarea
    for (const ta of document.querySelectorAll('textarea')) {
      if (this._isVisible(ta) && !this._isSearchInput(ta)) return ta;
    }

    // Strategy 5: contenteditable
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
          console.log('[XingLian:Douyin] Chat input visible:', el.tagName, el.className?.substring?.(0, 50));
          resolve(el);
        }
      };
      const poller = setInterval(check, 300);
      check();
      const timer = setTimeout(() => {
        if (!done) {
          done = true;
          clearInterval(poller);
          console.log('[XingLian:Douyin] Chat input not visible after', timeoutMs, 'ms');
          resolve(null);
        }
      }, timeoutMs);
    });
  },

  // ============ Actions ============

  async clickFollow() {
    try {
      const already = this._findByText('已关注').length > 0 ||
                      this._findByText('互关').length > 0 ||
                      this._findByText('相互关注').length > 0;
      if (already) return { success: true, already: true };

      const btns = this._findByText('关注');
      if (btns.length === 0) return { success: false, error: '未找到关注按钮' };

      await this._delay(500, 1500);
      console.log('[XingLian:Douyin] Clicking 关注 button');
      this._smartClick(btns[0]);
      await this._delay(1000, 2000);

      const followed = this._findByText('已关注').length > 0 || this._findByText('互关').length > 0;
      return { success: followed || true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  async _typeText(element, text) {
    element.focus();
    await this._delay(200, 400);

    const isDraftOrCE = element.getAttribute('contenteditable') === 'true' ||
                        element.classList?.contains('public-DraftEditor-content') ||
                        element.getAttribute('role') === 'textbox';

    if (isDraftOrCE) {
      document.execCommand('selectAll', false, null);
      document.execCommand('delete', false, null);
      await this._delay(100, 200);

      try {
        const dt = new DataTransfer();
        dt.setData('text/plain', text);
        const pasteEvent = new ClipboardEvent('paste', {
          bubbles: true,
          cancelable: true,
          clipboardData: dt
        });
        element.dispatchEvent(pasteEvent);
        console.log('[XingLian:Douyin] Typed via paste event');
      } catch (e) {
        console.log('[XingLian:Douyin] Paste event failed, trying execCommand');
        document.execCommand('insertText', false, text);
      }

      await this._delay(200, 300);

      if (!element.textContent || element.textContent.trim().length === 0) {
        console.log('[XingLian:Douyin] Paste didn\'t work, trying composition events');
        element.focus();
        element.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true, data: '' }));
        document.execCommand('insertText', false, text);
        element.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: text }));
      }

      element.dispatchEvent(new Event('input', { bubbles: true }));
    } else {
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

      console.log('[XingLian:Douyin] Sending message to:', input.tagName, input.className?.substring?.(0, 40));

      await this._delay(500, 1000);
      await this._typeText(input, text);
      await this._delay(800, 1500);

      let sendBtn = null;
      sendBtn = queryFirst(document, DOUYIN_SELECTORS.chat.sendBtn);
      if (!sendBtn) {
        const sendBtns = this._findByText('发送');
        if (sendBtns.length > 0) sendBtn = sendBtns[0];
      }
      if (!sendBtn) sendBtn = findButtonByText(document, '发送');

      if (sendBtn) {
        console.log('[XingLian:Douyin] Clicking send button');
        this._smartClick(sendBtn);
        await this._delay(1000, 2000);
        return { success: true, method: 'button' };
      }

      console.log('[XingLian:Douyin] No send button, trying Enter');
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
    try {
      window.location.href = url;
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  async openConversationByName(targetName) {
    try {
      const conversations = DouyinExtractors.extractConversations();
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

      let candidates = this._findByText('私信');
      if (candidates.length === 0) candidates = this._findByText('发私信');

      const e2eBtn = queryFirst(document, DOUYIN_SELECTORS.profile.messageBtn);
      if (e2eBtn && !candidates.includes(e2eBtn)) candidates.unshift(e2eBtn);

      if (candidates.length === 0) {
        return { success: false, error: '未找到私信按钮' };
      }

      console.log('[XingLian:Douyin] Found', candidates.length, '私信 candidates');

      const clickTargets = [];
      for (const el of candidates) {
        clickTargets.push(el);
        if (el.parentElement) clickTargets.push(el.parentElement);
        if (el.parentElement?.parentElement) clickTargets.push(el.parentElement.parentElement);
      }

      for (const target of clickTargets) {
        console.log('[XingLian:Douyin] Trying:', target.tagName, target.className?.substring?.(0, 50));
        this._smartClick(target);

        await this._delay(300, 500);
        let chatInput = this._findChatInput();
        if (chatInput) {
          console.log('[XingLian:Douyin] Chat opened!');
          this._chatInput = chatInput;
          return { success: true };
        }

        if (window.location.href !== urlBefore) {
          console.log('[XingLian:Douyin] Navigated to:', window.location.href);
          return { success: false, navigated: true };
        }
      }

      console.log('[XingLian:Douyin] Waiting for chat dialog...');
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
