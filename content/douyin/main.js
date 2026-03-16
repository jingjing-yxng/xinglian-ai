// Main content script — injected on douyin.com
// Handles messages from service worker and MutationObserver for SPA navigation

(function() {
  'use strict';

  console.log('[Douyin Outreach] Content script loaded');

  // Connect to service worker via port
  let port = null;
  function connectPort() {
    port = chrome.runtime.connect({ name: 'content-script-douyin' });
    port.onMessage.addListener(handlePortMessage);
    port.onDisconnect.addListener(() => {
      console.log('[Douyin Outreach] Port disconnected, reconnecting...');
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
      case 'SCAN_SEARCH':
        return { type: 'SCAN_RESULT', data: DouyinExtractors.extractSearchResults() };

      case 'SCROLL_AND_SCAN': {
        // Wait for search results to render (page may have just navigated)
        await new Promise(r => setTimeout(r, 3000));

        // Verify content loaded — look for common search result indicators
        const hasContent = document.querySelector('[class*="card"], [class*="user"], [class*="result"]')
          || document.querySelectorAll('img').length > 3;
        if (!hasContent) {
          // Extra wait if page seems empty
          await new Promise(r => setTimeout(r, 3000));
        }

        const scrollCount = msg.data?.scroll_count || 3;
        for (let i = 0; i < scrollCount; i++) {
          window.scrollBy(0, window.innerHeight);
          await new Promise(r => setTimeout(r, 1200 + Math.random() * 600));
        }
        window.scrollTo(0, 0);
        await new Promise(r => setTimeout(r, 800));
        return { type: 'SCAN_RESULT', data: DouyinExtractors.extractSearchResults() };
      }

      case 'SCAN_PROFILE':
        return { type: 'PROFILE_RESULT', data: DouyinExtractors.extractProfileData() };

      case 'EXTRACT_CONVERSATIONS':
        return { type: 'CONVERSATIONS_RESULT', data: DouyinExtractors.extractConversations().map(c => ({ name: c.name })) };

      case 'EXTRACT_CONVERSATIONS_FULL':
        return { type: 'CONVERSATIONS_FULL_RESULT', data: DouyinExtractors.extractConversations().map(c => ({ name: c.name, preview: c.preview, hasUnread: c.hasUnread })) };

      case 'EXTRACT_MESSAGES':
        return { type: 'MESSAGES_RESULT', data: DouyinExtractors.extractMessages().map(m => ({ content: m.content, direction: m.direction })) };

      case 'CLICK_CONVERSATION':
        return { type: 'CLICK_CONVERSATION_RESULT', data: await DouyinActions.openConversationByName(msg.name) };

      case 'CLICK_FOLLOW':
        return { type: 'FOLLOW_RESULT', data: await DouyinActions.clickFollow() };

      case 'SEND_MESSAGE':
        return { type: 'MESSAGE_SENT', data: await DouyinActions.sendMessage(msg.text) };

      case 'NAVIGATE_PROFILE':
        return { type: 'NAVIGATE_RESULT', data: await DouyinActions.navigateToProfile(msg.url) };

      case 'OPEN_MESSAGE_DIALOG':
        return { type: 'DIALOG_RESULT', data: await DouyinActions.openMessageDialog() };

      case 'GET_PAGE_TYPE':
        return { type: 'PAGE_TYPE', data: getPageType() };

      case 'PING':
        return { type: 'PONG' };

      default:
        return null;
    }
  }

  // Detect current page type
  function getPageType() {
    const url = window.location.href;
    if (url.includes('/search/')) return 'search';
    if (url.match(/\/user\/[A-Za-z0-9_-]+/)) return 'profile';
    if (url.includes('/im') || url.includes('/message')) return 'chat';
    if (url.includes('/discover')) return 'discover';
    return 'other';
  }

  // Monitor SPA navigation changes
  let lastUrl = window.location.href;
  const urlObserver = new MutationObserver(() => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      console.log('[Douyin Outreach] SPA navigation:', lastUrl);
      chrome.runtime.sendMessage({
        target: 'side-panel',
        type: 'PAGE_CHANGED',
        data: { url: lastUrl, pageType: getPageType(), platform: 'douyin' }
      }, () => { void chrome.runtime.lastError; });
    }
  });

  urlObserver.observe(document.body, { childList: true, subtree: true });
})();
