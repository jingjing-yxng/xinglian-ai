// Main content script — injected on xiaohongshu.com
// Handles messages from service worker and MutationObserver for SPA navigation

(function() {
  'use strict';

  console.log('[XHS Outreach] Content script loaded');

  // Connect to service worker via port
  let port = null;
  function connectPort() {
    port = chrome.runtime.connect({ name: 'content-script-xiaohongshu' });
    port.onMessage.addListener(handlePortMessage);
    port.onDisconnect.addListener(() => {
      console.log('[XHS Outreach] Port disconnected, reconnecting...');
      setTimeout(connectPort, 1000);
    });
  }
  connectPort();

  // Handle port messages from side panel (via service worker)
  function handlePortMessage(msg) {
    handleMessage(msg).then(response => {
      if (response && port) {
        port.postMessage({ ...response, _replyTo: msg._id });
      }
    });
  }

  // Handle one-off messages
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    handleMessage(msg).then(sendResponse);
    return true; // async response
  });

  // Central message handler
  async function handleMessage(msg) {
    switch (msg.type) {
      case 'GET_USER_TAB_URL': {
        // Extract the href from the "用户" tab <a> element
        const url = XhsExtractors.getUserTabUrl();
        return { type: 'USER_TAB_URL', data: url };
      }

      case 'SCAN_SEARCH': {
        // On XHS search page, click "用户" tab first, then wait for user cards to load
        if (window.location.href.includes('/search_result')) {
          try {
            const tabResult = await XhsActions.clickUserTab();
            console.log('[XHS] clickUserTab result:', JSON.stringify(tabResult));

            const cardsLoaded = await XhsActions.waitForUserCards(8000);
            console.log('[XHS] waitForUserCards result:', cardsLoaded);

            if (!cardsLoaded) {
              console.log('[XHS] User cards not loaded — may still be on notes view');
            }
          } catch (e) {
            console.log('[XHS] User tab switch failed, extracting from current view:', e);
          }
        }
        const results = XhsExtractors.extractSearchResults();
        console.log('[XHS] extractSearchResults returned', results.length, 'results');
        return { type: 'SCAN_RESULT', data: results };
      }

      case 'SCROLL_AND_SCAN': {
        // Wait for page to render (may have just navigated)
        await new Promise(r => setTimeout(r, 3000));

        // Click user tab first on search pages
        if (window.location.href.includes('/search_result')) {
          try {
            await XhsActions.clickUserTab();
            await XhsActions.waitForUserCards(8000);
          } catch (e) {}
        }
        const scrollCount = msg.data?.scroll_count || 3;
        for (let i = 0; i < scrollCount; i++) {
          window.scrollBy(0, window.innerHeight);
          await new Promise(r => setTimeout(r, 1200 + Math.random() * 600));
        }
        window.scrollTo(0, 0);
        await new Promise(r => setTimeout(r, 800));
        return { type: 'SCAN_RESULT', data: XhsExtractors.extractSearchResults() };
      }

      case 'SCAN_PROFILE':
        return { type: 'PROFILE_RESULT', data: XhsExtractors.extractProfileData() };

      case 'EXTRACT_CONVERSATIONS':
        return { type: 'CONVERSATIONS_RESULT', data: XhsExtractors.extractConversations().map(c => ({ name: c.name })) };

      case 'EXTRACT_CONVERSATIONS_FULL':
        return { type: 'CONVERSATIONS_FULL_RESULT', data: XhsExtractors.extractConversations().map(c => ({ name: c.name, preview: c.preview, hasUnread: c.hasUnread })) };

      case 'EXTRACT_MESSAGES':
        return { type: 'MESSAGES_RESULT', data: XhsExtractors.extractMessages().map(m => ({ content: m.content, direction: m.direction })) };

      case 'CLICK_CONVERSATION':
        return { type: 'CLICK_CONVERSATION_RESULT', data: await XhsActions.openConversationByName(msg.name) };

      case 'CLICK_FOLLOW':
        return { type: 'FOLLOW_RESULT', data: await XhsActions.clickFollow() };

      case 'SEND_MESSAGE':
        return { type: 'MESSAGE_SENT', data: await XhsActions.sendMessage(msg.text) };

      case 'NAVIGATE_PROFILE':
        return { type: 'NAVIGATE_RESULT', data: await XhsActions.navigateToProfile(msg.url) };

      case 'OPEN_MESSAGE_DIALOG':
        return { type: 'DIALOG_RESULT', data: await XhsActions.openMessageDialog() };

      case 'GET_PAGE_TYPE':
        return { type: 'PAGE_TYPE', data: getPageType() };

      case 'PING':
        return { type: 'PONG' };

      default:
        return null;
    }
  }

  // Detect current page type based on XHS URL patterns
  function getPageType() {
    const url = window.location.href;
    if (url.includes('/search_result')) return 'search';
    if (url.match(/\/user\/profile\//)) return 'profile';
    if (url.includes('/im') || url.includes('/chat')) return 'chat';
    if (url.includes('/explore')) return 'discover';
    return 'other';
  }

  // Monitor SPA navigation changes
  let lastUrl = window.location.href;
  const urlObserver = new MutationObserver(() => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      console.log('[XHS Outreach] SPA navigation:', lastUrl);
      chrome.runtime.sendMessage({
        target: 'side-panel',
        type: 'PAGE_CHANGED',
        data: { url: lastUrl, pageType: getPageType(), platform: 'xiaohongshu' }
      }, () => { void chrome.runtime.lastError; });
    }
  });

  urlObserver.observe(document.body, { childList: true, subtree: true });
})();
