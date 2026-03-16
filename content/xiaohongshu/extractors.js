// XHS (Xiaohongshu) data extractors
// Strategy: selector-agnostic — extract user cards from "用户" tab search results
// Mirrors Douyin approach: find anchors (关注 buttons, "粉丝" text) and walk up to card containers

const XhsExtractors = {
  ...BaseExtractors,

  // ============ Search Results (用户 tab) ============

  // Extract the "用户" tab URL from the search page
  getUserTabUrl() {
    const links = document.querySelectorAll('a');
    for (const a of links) {
      if (a.textContent.trim() === '用户' && a.offsetWidth > 0) {
        const rect = a.getBoundingClientRect();
        if (rect.top < 200 && rect.top > 20) {
          const href = a.href || a.getAttribute('href') || '';
          if (href) {
            console.log('[XHS] Found 用户 tab URL:', href);
            return href.startsWith('http') ? href : `https://www.xiaohongshu.com${href}`;
          }
        }
      }
    }
    console.log('[XHS] 用户 tab URL not found');
    return null;
  },

  extractSearchResults() {
    console.log('[XHS] Scanning search results for user cards...');

    // Strategy 1: Find all 关注 buttons, walk up to user card container
    const results = this._extractViaFollowButtons();
    if (results.length > 0) return this._filterSelf(this._filterInstitutions(results));

    // Strategy 2: Find elements containing "粉丝" text pattern
    const results2 = this._extractViaFansText();
    if (results2.length > 0) return this._filterSelf(this._filterInstitutions(results2));

    // Strategy 3: Profile link anchors — walk up to card
    const results3 = this._extractViaProfileLinks();
    if (results3.length > 0) return this._filterSelf(this._filterInstitutions(results3));

    // Strategy 4: CSS selector fallback
    const cards = queryAll(document, XHS_SELECTORS.search.userCards);
    console.log('[XHS] Selector fallback cards:', cards.length);
    return this._filterSelf(this._filterInstitutions(cards.map(card => this._extractFromContainer(card)).filter(Boolean)));
  },

  // Filter out the logged-in user (appears as "我" or via sidebar/header profile link)
  _filterSelf(prospects) {
    // Collect all possible self user IDs
    const selfIds = new Set();

    // Check sidebar "我" link and any profile links in the left nav / header
    const allProfileLinks = document.querySelectorAll('a[href*="/user/profile/"]');
    for (const a of allProfileLinks) {
      const text = a.textContent.trim();
      // The "我" link in the sidebar
      if (text === '我' || text.includes('我的')) {
        const match = (a.href || '').match(/\/user\/profile\/([A-Za-z0-9]+)/);
        if (match) selfIds.add(match[1]);
      }
      // Links in the left sidebar area (narrow left column)
      const rect = a.getBoundingClientRect();
      if (rect.left < 120 && rect.width < 200) {
        const match = (a.href || '').match(/\/user\/profile\/([A-Za-z0-9]+)/);
        if (match) selfIds.add(match[1]);
      }
    }

    const before = prospects.length;
    const filtered = prospects.filter(p => {
      if (p.nickname === '我') return false;
      if (selfIds.has(p.sec_user_id)) return false;
      // Also filter out any result with no bio and nickname "我" variants
      if (p.nickname.length <= 1) return false;
      return true;
    });
    if (filtered.length < before) {
      console.log(`[XHS] Filtered out ${before - filtered.length} self/invalid results`);
    }
    return filtered;
  },

  // Strategy 1: Find 关注 buttons and walk up to find user card containers
  _extractViaFollowButtons() {
    const allElements = document.querySelectorAll('button, [role="button"], a, div[class], span[class]');
    const followBtns = [];
    for (const el of allElements) {
      const text = el.textContent.trim();
      if (text === '关注' && el.offsetParent !== null) {
        if (el.textContent.length < 10) {
          followBtns.push(el);
        }
      }
    }

    console.log('[XHS] Found 关注 buttons:', followBtns.length);

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

    console.log('[XHS] Extracted via follow buttons:', cards.length);
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

    console.log('[XHS] Extracted via fans text:', cards.length);
    return cards;
  },

  // Strategy 3: Find profile link anchors, walk up to card
  _extractViaProfileLinks() {
    const profileLinks = document.querySelectorAll('a[href*="/user/profile/"]');
    console.log('[XHS] Found profile links:', profileLinks.length);

    const cards = [];
    const seen = new Set();

    for (const link of profileLinks) {
      const href = link.href || link.getAttribute('href') || '';
      const match = href.match(/\/user\/profile\/([A-Za-z0-9]+)/);
      if (!match) continue;

      const userId = match[1];
      if (seen.has(userId)) continue;
      seen.add(userId);

      // Walk up to find a card container
      let container = link.parentElement;
      let attempts = 0;
      while (container && attempts < 12) {
        const rect = container.getBoundingClientRect();
        const hasLayout = rect.width > 200 && rect.height > 80;
        const hasStructure = container.querySelector('img') && container.querySelectorAll('a, span, p').length >= 3;
        if ((hasLayout || hasStructure) && container.querySelector('img')) {
          break;
        }
        container = container.parentElement;
        attempts++;
      }

      if (!container || attempts >= 12) {
        // Minimal extraction from the link itself
        const nickname = link.textContent.trim();
        if (nickname && nickname.length > 0 && nickname.length < 30 && !this._isNumericText(nickname)) {
          const profileUrl = href.startsWith('http') ? href : `https://www.xiaohongshu.com${href}`;
          cards.push({
            sec_user_id: userId,
            nickname,
            bio: '',
            followers: 0,
            followers_text: '',
            avatar: '',
            profile_url: profileUrl,
            source: 'search'
          });
        }
        continue;
      }

      const extracted = this._extractFromContainer(container);
      if (extracted) cards.push(extracted);
    }

    console.log('[XHS] Extracted via profile links:', cards.length);
    return cards;
  },

  _isNumericText(text) {
    const cleaned = text.replace(/[\s,]/g, '');
    return /^[\d.:]+[万亿]?$/.test(cleaned) || /^\d{2}:\d{2}$/.test(cleaned);
  },

  // Extract user info from a user card container (用户 tab results)
  _extractFromContainer(container) {
    try {
      const text = container.textContent || '';

      // Find profile link and userId
      const links = container.querySelectorAll('a[href]');
      let profileLink = '';
      let sec_user_id = '';
      let nicknameFromLink = '';

      // Also check ancestor links
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
        const match = href.match(/\/user\/profile\/([A-Za-z0-9]+)/);
        if (match) {
          profileLink = href.startsWith('http') ? href : `https://www.xiaohongshu.com${href}`;
          sec_user_id = match[1];
          const linkText = a.textContent.trim();
          if (linkText.length > 0 && linkText.length < 30 && !this._isNumericText(linkText)) {
            nicknameFromLink = linkText;
          }
          break;
        }
      }

      if (!sec_user_id) {
        const allEls = container.querySelectorAll('[data-id], [data-user-id], [data-author-id]');
        for (const el of allEls) {
          const uid = el.dataset.id || el.dataset.userId || el.dataset.authorId || '';
          if (uid && uid.length > 5) {
            sec_user_id = uid;
            profileLink = `https://www.xiaohongshu.com/user/profile/${uid}`;
            break;
          }
        }
      }

      if (!sec_user_id) {
        // Try any XHS link
        for (const a of allLinks) {
          const href = a.href || '';
          if (href.includes('xiaohongshu.com') && !href.includes('/search_result') && !href.includes('/explore')) {
            const pathMatch = href.match(/xiaohongshu\.com\/(?:user\/profile\/)?([A-Za-z0-9]{10,})/);
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

      // Extract nickname
      let nickname = nicknameFromLink;

      if (!nickname) {
        // Try profile links specifically
        for (const a of links) {
          const href = a.href || '';
          if (href.includes('/user/profile/')) {
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
              !t.includes('互相关注') &&
              !t.includes('#') && !t.includes('万') &&
              !t.match(/^\d/) &&
              !t.includes('·') &&
              !t.includes('小红书号') &&
              el.children.length === 0) {
            nickname = t;
            break;
          }
        }
      }

      if (!nickname) return null;

      nickname = nickname.replace(/^@\s*/, '');

      // Extract followers text
      let followersText = '';
      const fansMatch = text.match(/([\d,.]+\.?\d*)\s*万?\s*粉丝/);
      if (fansMatch) {
        followersText = fansMatch[0];
      }

      // Extract bio / description
      let bio = '';
      const allText = [];
      const textEls = container.querySelectorAll('p, span, div');
      for (const el of textEls) {
        const t = el.textContent.trim();
        if (t.length > 5 && t.length < 500 &&
            t !== nickname && !t.startsWith(nickname) &&
            el.children.length < 5 &&
            el.offsetParent !== null &&
            !t.match(/^\d+\.?\d*万?\s*粉丝/) &&
            !t.match(/^(关注|已关注|互相关注)$/)) {
          allText.push(t);
        }
      }
      for (const t of allText) {
        if ((t.includes('#') || t.length > 15) && t.length > bio.length) {
          bio = t;
        }
      }
      if (!bio && allText.length > 0) bio = allText[0];

      // Extract avatar
      let avatar = '';
      const imgs = container.querySelectorAll('img');
      for (const img of imgs) {
        const src = img.src || '';
        if (src && (img.width >= 30 || img.naturalWidth >= 30 || src.includes('avatar') || src.includes('sns-avatar'))) {
          avatar = src;
          break;
        }
      }

      if (!profileLink && sec_user_id && !sec_user_id.startsWith('scan_')) {
        profileLink = `https://www.xiaohongshu.com/user/profile/${sec_user_id}`;
      }

      console.log('[XHS] Extracted:', { nickname, followersText, profileLink, bio: bio.substring(0, 50) });

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
      console.error('[XHS] Error extracting from container:', e);
      return null;
    }
  },

  // ============ Profile Page ============

  extractProfileData() {
    try {
      let nickname = queryFirst(document, XHS_SELECTORS.profile.nickname)?.textContent?.trim();

      if (!nickname) {
        const candidates = document.querySelectorAll('h1, h2, [class*="nickname"], [class*="user-name"], [class*="name"]');
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

      let bio = queryFirst(document, XHS_SELECTORS.profile.bio)?.textContent?.trim() || '';
      if (!bio) {
        const bioPatterns = document.querySelectorAll('[class*="desc"], [class*="bio"], [class*="signature"], [class*="intro"]');
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

      const urlMatch = window.location.pathname.match(/user\/profile\/([A-Za-z0-9]+)/);
      const sec_user_id = urlMatch ? urlMatch[1] : '';

      let avatar = queryFirst(document, XHS_SELECTORS.profile.avatar)?.src || '';
      if (!avatar) {
        const headerImgs = document.querySelectorAll('img[src*="avatar"], img[src*="dyn"], .user-info img, header img');
        for (const img of headerImgs) {
          if (img.src) { avatar = img.src; break; }
        }
      }

      const noteItems = queryAll(document, XHS_SELECTORS.profile.noteItems);
      const noteTitles = [];
      if (noteItems.length > 0) {
        for (const item of noteItems.slice(0, 10)) {
          const title = item.textContent?.trim();
          if (title && title.length > 2 && title.length < 200) {
            noteTitles.push(title);
          }
        }
      }
      if (noteTitles.length === 0) {
        const titleEls = document.querySelectorAll('[class*="note-title"], [class*="title"], .note-item .title');
        for (const el of titleEls) {
          const t = el.textContent.trim();
          if (t.length > 2 && t.length < 200) noteTitles.push(t);
          if (noteTitles.length >= 10) break;
        }
      }

      return {
        sec_user_id,
        nickname,
        bio,
        followers: this._parseFollowerCount(followersText),
        followers_text: followersText,
        likes: this._parseFollowerCount(likesText),
        avatar,
        profile_url: window.location.href,
        recent_topics: noteTitles,
        source: 'profile'
      };
    } catch (e) {
      console.error('[XHS] Error extracting profile:', e);
      return null;
    }
  },

  // ============ Chat / Conversations ============

  extractConversations() {
    let items = queryAll(document, XHS_SELECTORS.chat.conversationItem);

    if (items.length === 0) {
      const candidates = document.querySelectorAll('[class*="conversation"], [class*="chat-item"], [class*="session"], [class*="im-item"]');
      items = Array.from(candidates).filter(el => {
        const rect = el.getBoundingClientRect();
        return rect.width > 100 && rect.height > 30;
      });
    }

    return items.map(item => {
      let name = queryFirst(item, XHS_SELECTORS.chat.conversationName)?.textContent?.trim() || '';
      if (!name) {
        const spans = item.querySelectorAll('span, p, div, a');
        for (const el of spans) {
          const t = el.textContent.trim();
          if (t.length >= 2 && t.length < 25 && el.children.length === 0) {
            name = t;
            break;
          }
        }
      }

      let preview = '';
      const previewEl = item.querySelector('[class*="preview"], [class*="last-msg"], [class*="content"], [class*="desc"], [class*="summary"]');
      if (previewEl && previewEl.textContent.trim() !== name) {
        preview = previewEl.textContent.trim();
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

  extractMessages() {
    let items = queryAll(document, XHS_SELECTORS.chat.messageItem);

    if (items.length === 0) {
      const candidates = document.querySelectorAll('[class*="message"], [class*="msg-item"], [class*="chat-msg"]');
      items = Array.from(candidates).filter(el => {
        const rect = el.getBoundingClientRect();
        return rect.width > 50 && rect.height > 20;
      });
    }

    return items.map(item => {
      const content = queryFirst(item, XHS_SELECTORS.chat.messageContent)?.textContent?.trim() ||
                      item.textContent?.trim() || '';

      const isMine = item.matches?.(XHS_SELECTORS.chat.messageSent) ||
                     item.querySelector?.(XHS_SELECTORS.chat.messageSent) !== null ||
                     (item.className || '').includes('self') ||
                     (item.className || '').includes('right') ||
                     (item.className || '').includes('mine');

      return {
        content,
        direction: isMine ? 'sent' : 'received',
        element: item
      };
    }).filter(m => m.content);
  }
};
