// Douyin-specific creator data extraction
// Strategy: selector-agnostic — find anchors (关注 buttons, "粉丝" text) and walk up to card containers

const DouyinExtractors = {
  // Inherit shared utilities
  ...BaseExtractors,

  // Extract all creator cards from search results page
  extractSearchResults() {
    console.log('[Douyin Outreach] Scanning search results...');

    // Strategy 1: Find all 关注 buttons, walk up to card container
    const results = this._extractViaFollowButtons();
    if (results.length > 0) return this._filterInstitutions(results);

    // Strategy 2: Find elements containing "粉丝" text pattern
    const results2 = this._extractViaFansText();
    if (results2.length > 0) return this._filterInstitutions(results2);

    // Strategy 3: data-e2e selectors (may work on some versions)
    const cards = queryAll(document, DOUYIN_SELECTORS.search.userCards);
    console.log('[Douyin Outreach] data-e2e cards found:', cards.length);
    return this._filterInstitutions(cards.map(card => this._extractSearchCard(card)).filter(Boolean));
  },

  // Strategy 1: Find 关注 buttons and walk up to find card containers
  _extractViaFollowButtons() {
    const allElements = document.querySelectorAll('button, [role="button"], a, div[class]');
    const followBtns = [];
    for (const el of allElements) {
      const text = el.textContent.trim();
      if (text === '关注' && el.offsetParent !== null) {
        if (el.textContent.length < 10) {
          followBtns.push(el);
        }
      }
    }

    console.log('[Douyin Outreach] Found 关注 buttons:', followBtns.length);

    const cards = [];
    const seen = new Set();

    for (const btn of followBtns) {
      let container = btn.parentElement;
      let attempts = 0;
      while (container && attempts < 15) {
        const text = container.textContent || '';
        if (text.includes('粉丝') && container.querySelector('img')) {
          break;
        }
        container = container.parentElement;
        attempts++;
      }

      if (!container || attempts >= 15) continue;

      const key = container.textContent.substring(0, 100);
      if (seen.has(key)) continue;
      seen.add(key);

      const extracted = this._extractFromContainer(container);
      if (extracted) cards.push(extracted);
    }

    console.log('[Douyin Outreach] Extracted via follow buttons:', cards.length);
    return cards;
  },

  // Strategy 2: Find elements that contain "粉丝" pattern
  _extractViaFansText() {
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      { acceptNode: (node) => node.textContent.includes('粉丝') ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT }
    );

    const cards = [];
    const seen = new Set();
    let node;

    while (node = walker.nextNode()) {
      let container = node.parentElement;
      let attempts = 0;
      while (container && attempts < 10) {
        // Use getBoundingClientRect when available, but fall back to DOM structure
        // for background tabs where layout may not be computed
        const rect = container.getBoundingClientRect();
        const hasLayout = rect.width > 200 && rect.height > 80 && rect.height < 500;
        const hasStructure = container.querySelector('img') && container.querySelectorAll('a, span, p').length >= 3;
        if ((hasLayout || hasStructure) && container.querySelector('img')) {
          break;
        }
        container = container.parentElement;
        attempts++;
      }

      if (!container || attempts >= 10) continue;

      const key = container.textContent.substring(0, 100);
      if (seen.has(key)) continue;
      seen.add(key);

      const extracted = this._extractFromContainer(container);
      if (extracted) cards.push(extracted);
    }

    console.log('[Douyin Outreach] Extracted via fans text:', cards.length);
    return cards;
  },

  _isNumericText(text) {
    const cleaned = text.replace(/[\s,]/g, '');
    return /^[\d.:]+[万亿]?$/.test(cleaned) || /^\d{2}:\d{2}$/.test(cleaned);
  },

  _extractFromContainer(container) {
    try {
      const text = container.textContent || '';

      const links = container.querySelectorAll('a[href]');
      let profileLink = '';
      let sec_user_id = '';
      let nicknameFromLink = '';

      const allLinks = [...links];
      let ancestor = container.parentElement;
      for (let i = 0; i < 3 && ancestor; i++) {
        if (ancestor.tagName === 'A' && ancestor.href) {
          allLinks.unshift(ancestor);
        }
        ancestor.querySelectorAll(':scope > a[href]').forEach(a => allLinks.push(a));
        ancestor = ancestor.parentElement;
      }

      for (const a of allLinks) {
        const href = a.href || a.getAttribute('href') || '';
        const match = href.match(/\/user\/([A-Za-z0-9_.-]+)/);
        if (match) {
          profileLink = href.startsWith('http') ? href : `https://www.douyin.com${href.startsWith('/') ? '' : '/'}${href}`;
          sec_user_id = match[1];
          const linkText = a.textContent.trim();
          if (linkText.length > 0 && linkText.length < 30 && !this._isNumericText(linkText)) {
            nicknameFromLink = linkText;
          }
          break;
        }
      }

      if (!sec_user_id) {
        const allEls = container.querySelectorAll('[data-id], [data-user-id], [data-sec-uid]');
        for (const el of allEls) {
          const uid = el.dataset.id || el.dataset.userId || el.dataset.secUid || '';
          if (uid && uid.length > 5) {
            sec_user_id = uid;
            profileLink = `https://www.douyin.com/user/${uid}`;
            break;
          }
        }
      }

      if (!sec_user_id) {
        for (const a of allLinks) {
          const href = a.href || '';
          if (href.includes('douyin.com') && !href.includes('/search/') && !href.includes('/hashtag/') && !href.includes('/video/')) {
            const pathMatch = href.match(/douyin\.com\/([A-Za-z0-9_.-]{10,})/);
            if (pathMatch) {
              sec_user_id = pathMatch[1];
              profileLink = href;
              break;
            }
          }
        }
      }

      if (!sec_user_id) {
        sec_user_id = `scan_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      }

      let nickname = nicknameFromLink;

      if (!nickname) {
        const atMatch = text.match(/@\s*([^\s·,，@]{2,20})/);
        if (atMatch) {
          nickname = atMatch[1].trim();
        }
      }

      if (!nickname) {
        for (const a of links) {
          const href = a.href || '';
          if (href.includes('/user/')) {
            const t = a.textContent.trim().replace(/^@/, '');
            if (t.length > 0 && t.length < 30 && !this._isNumericText(t)) {
              nickname = t;
              break;
            }
          }
        }
      }

      if (!nickname) {
        const candidates = container.querySelectorAll('span, p, a, div');
        for (const el of candidates) {
          const t = el.textContent.trim();
          if (t.length >= 2 && t.length < 25 &&
              !this._isNumericText(t) &&
              !t.includes('粉丝') && !t.includes('获赞') &&
              !t.includes('关注') && !t.includes('已关注') &&
              !t.includes('#') && !t.includes('万') &&
              !t.match(/^\d/) &&
              !t.includes('·') &&
              el.children.length === 0) {
            nickname = t;
            break;
          }
        }
      }

      if (!nickname) return null;

      nickname = nickname.replace(/^@\s*/, '');

      let followersText = '';
      const fansMatch = text.match(/([\d,.]+\.?\d*)\s*万?\s*粉丝/);
      if (fansMatch) {
        followersText = fansMatch[0];
      }

      let bio = '';
      const allText = [];
      const textEls = container.querySelectorAll('p, span, div');
      for (const el of textEls) {
        const t = el.textContent.trim();
        if (t.length > 10 && t.length < 500 &&
            t !== nickname && !t.startsWith(nickname) &&
            el.children.length < 5) {
          allText.push(t);
        }
      }
      for (const t of allText) {
        if ((t.includes('#') || t.length > 20) && t.length > bio.length) {
          bio = t;
        }
      }
      if (!bio && allText.length > 0) bio = allText[0];

      let avatar = '';
      const imgs = container.querySelectorAll('img');
      for (const img of imgs) {
        const src = img.src || '';
        if (src && (img.width >= 30 || img.naturalWidth >= 30 || src.includes('avatar') || src.includes('aweme'))) {
          avatar = src;
          break;
        }
      }

      if (!profileLink && sec_user_id && !sec_user_id.startsWith('scan_')) {
        profileLink = `https://www.douyin.com/user/${sec_user_id}`;
      }

      console.log('[Douyin Outreach] Extracted:', { nickname, followersText, profileLink, bio: bio.substring(0, 50) });

      return {
        sec_user_id,
        nickname,
        bio,
        followers: this._parseFollowerCount(followersText),
        followers_text: followersText,
        avatar,
        profile_url: profileLink,
        source: 'search'
      };
    } catch (e) {
      console.error('[Douyin Outreach] Error extracting from container:', e);
      return null;
    }
  },

  _extractSearchCard(card) {
    return this._extractFromContainer(card);
  },

  // Extract profile data from current profile page
  extractProfileData() {
    try {
      let nickname = queryFirst(document, DOUYIN_SELECTORS.profile.nickname)?.textContent?.trim();

      if (!nickname) {
        const candidates = document.querySelectorAll('h1, h2, [data-e2e*="user"], [class*="nickname"], [class*="userName"]');
        for (const el of candidates) {
          const t = el.textContent.trim();
          if (t.length > 0 && t.length < 30) {
            nickname = t;
            break;
          }
        }
      }

      if (!nickname) {
        const spans = document.querySelectorAll('span, p, div');
        for (const el of spans) {
          const rect = el.getBoundingClientRect();
          if (rect.top < 400 && rect.top > 50) {
            const t = el.textContent.trim();
            const style = window.getComputedStyle(el);
            const fontSize = parseFloat(style.fontSize);
            if (t.length > 0 && t.length < 30 && fontSize >= 18) {
              nickname = t;
              break;
            }
          }
        }
      }

      if (!nickname) return null;

      const bioEl = queryFirst(document, DOUYIN_SELECTORS.profile.bio);
      let bio = bioEl?.textContent?.trim() || '';
      if (!bio) {
        const bioPatterns = document.querySelectorAll('[class*="desc"], [class*="bio"], [class*="signature"]');
        for (const el of bioPatterns) {
          const t = el.textContent.trim();
          if (t.length > 5 && t.length < 300) { bio = t; break; }
        }
      }

      const pageText = document.body.textContent;
      const followersMatch = pageText.match(/([\d,.]+\.?\d*)\s*万?\s*粉丝/);
      const followersText = followersMatch ? followersMatch[0] : '';
      const likesMatch = pageText.match(/([\d,.]+\.?\d*)\s*万?\s*获赞/);
      const likesText = likesMatch ? likesMatch[0] : '';

      const urlMatch = window.location.pathname.match(/user\/([A-Za-z0-9_-]+)/);
      const sec_user_id = urlMatch ? urlMatch[1] : '';

      const videoTitles = queryAll(document, DOUYIN_SELECTORS.profile.videoTitle)
        .slice(0, 10)
        .map(el => el.textContent?.trim())
        .filter(Boolean);

      const avatar = queryFirst(document, DOUYIN_SELECTORS.profile.avatar)?.src || '';

      return {
        sec_user_id,
        nickname,
        bio,
        followers: this._parseFollowerCount(followersText),
        followers_text: followersText,
        likes: this._parseFollowerCount(likesText),
        avatar,
        profile_url: window.location.href,
        recent_topics: videoTitles,
        source: 'profile'
      };
    } catch (e) {
      console.error('[Douyin Outreach] Error extracting profile:', e);
      return null;
    }
  },

  // Extract conversations from chat/message page
  extractConversations() {
    const items = queryAll(document, DOUYIN_SELECTORS.chat.conversationItem);
    return items.map(item => {
      const name = queryFirst(item, DOUYIN_SELECTORS.chat.conversationName)?.textContent?.trim() || '';

      let preview = '';
      const previewEl = item.querySelector('[class*="preview"], [class*="last-msg"], [class*="content"], [class*="desc"]');
      if (previewEl && previewEl !== queryFirst(item, DOUYIN_SELECTORS.chat.conversationName)) {
        preview = previewEl.textContent?.trim() || '';
      }
      if (!preview) {
        const spans = item.querySelectorAll('span, p, div');
        for (const el of spans) {
          const t = el.textContent.trim();
          if (t && t !== name && t.length > 1 && t.length < 100 && el.children.length === 0) {
            preview = t;
            break;
          }
        }
      }

      const hasUnread = !!(
        item.querySelector('[class*="unread"], [class*="badge"], [class*="dot"], [class*="red"]') ||
        item.querySelector('.unread-dot, .msg-badge')
      );

      return { name, preview, hasUnread, element: item };
    }).filter(c => c.name);
  },

  // Extract messages from active conversation
  extractMessages() {
    const items = queryAll(document, DOUYIN_SELECTORS.chat.messageItem);
    return items.map(item => {
      const content = queryFirst(item, DOUYIN_SELECTORS.chat.messageContent)?.textContent?.trim() || '';
      const isMine = item.matches?.(DOUYIN_SELECTORS.chat.myMessage) ||
                     item.querySelector?.(DOUYIN_SELECTORS.chat.myMessage) !== null ||
                     (item.className || '').includes('self');
      return {
        content,
        direction: isMine ? 'sent' : 'received',
        element: item
      };
    }).filter(m => m.content);
  }
};
