// Service Worker — message routing, alarms, side panel management, action queue polling

// Import libs for action execution
importScripts('../lib/auth.js', '../lib/api-client.js', '../lib/action-executor.js');

// Enable side panel globally (don't restrict by tab)
chrome.sidePanel.setOptions({ enabled: true });

// Open side panel on toolbar icon click
chrome.action.onClicked.addListener(async (tab) => {
  try {
    await chrome.sidePanel.open({ tabId: tab.id });
  } catch (e) {
    console.warn('[Service Worker] Could not open side panel:', e.message);
  }
});

// Port-based messaging between content scripts and side panel
const ports = new Map(); // name -> port

chrome.runtime.onConnect.addListener((port) => {
  ports.set(port.name, port);

  port.onDisconnect.addListener(() => {
    ports.delete(port.name);
  });

  port.onMessage.addListener((msg) => {
    if (port.name === 'content-script-douyin' || port.name === 'content-script-xiaohongshu') {
      // Content script → side panel: forward as-is
      const sidePanelPort = ports.get('side-panel');
      if (sidePanelPort) {
        sidePanelPort.postMessage(msg);
      }
    } else if (port.name === 'side-panel') {
      // Side panel → content script: route by _targetPlatform tag
      const targetPlatform = msg._targetPlatform;
      const targetPort = targetPlatform
        ? ports.get(`content-script-${targetPlatform}`)
        : (ports.get('content-script-douyin') || ports.get('content-script-xiaohongshu'));
      if (targetPort) {
        targetPort.postMessage(msg);
      }
    }
  });
});

// Also handle one-off messages for simple request/response
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'GET_TAB_INFO') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      sendResponse({ url: tabs[0]?.url || '', tabId: tabs[0]?.id });
    });
    return true;
  }

  // Forward message to content script in active tab
  if (msg.target === 'content-script') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, msg, (response) => {
          sendResponse(response);
        });
      }
    });
    return true;
  }

  // Forward message to side panel
  if (msg.target === 'side-panel') {
    const sidePanelPort = ports.get('side-panel');
    if (sidePanelPort) {
      sidePanelPort.postMessage(msg);
    }
  }
});

// ============ Tab-change detection ============

function detectPlatformFromUrl(url) {
  if (!url) return null;
  if (url.includes('douyin.com')) return 'douyin';
  if (url.includes('xiaohongshu.com')) return 'xiaohongshu';
  return null;
}

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    const platform = detectPlatformFromUrl(tab.url);
    if (platform) {
      const sidePanelPort = ports.get('side-panel');
      if (sidePanelPort) {
        sidePanelPort.postMessage({ type: 'PLATFORM_DETECTED', data: { platform } });
      }
    }
  } catch (e) { /* tab may not be accessible */ }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url && tab.active) {
    const platform = detectPlatformFromUrl(changeInfo.url);
    if (platform) {
      const sidePanelPort = ports.get('side-panel');
      if (sidePanelPort) {
        sidePanelPort.postMessage({ type: 'PLATFORM_DETECTED', data: { platform } });
      }
    }
  }
});

// ============ Alarms ============

// Set up all alarms on install/startup
chrome.runtime.onInstalled.addListener(() => _setupAlarms());
chrome.runtime.onStartup.addListener(() => _setupAlarms());

function _setupAlarms() {
  // Action queue polling every 30 seconds
  chrome.alarms.create('poll-action-queue', {
    delayInMinutes: 0.5,
    periodInMinutes: 0.5
  });

  // Heartbeat every 30 seconds
  chrome.alarms.create('heartbeat', {
    delayInMinutes: 0.5,
    periodInMinutes: 0.5
  });

  // Automation tick every 5 minutes — checks if scheduled scans/scoring are needed
  chrome.alarms.create('automation-tick', {
    delayInMinutes: 1,
    periodInMinutes: 5
  });
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'poll-action-queue') {
    const loggedIn = await Auth.isLoggedIn();
    if (!loggedIn) return;

    // Poll ALL platforms — automation can queue actions for any platform,
    // not just the one currently selected in the side panel
    await ActionExecutor.pollAndExecute();
  }

  if (alarm.name === 'automation-tick') {
    const loggedIn = await Auth.isLoggedIn();
    if (!loggedIn) return;

    try {
      await ApiClient.automationTick();
    } catch (e) {
      // Silent fail — automation tick is best-effort
    }
  }

  if (alarm.name === 'heartbeat') {
    const loggedIn = await Auth.isLoggedIn();
    if (!loggedIn) return;

    const stored = await new Promise(r => chrome.storage.local.get('currentPlatform', r));
    const platform = stored.currentPlatform || 'douyin';
    try {
      await ApiClient.sendHeartbeat(platform);
    } catch (e) {
      // Silent fail — heartbeat is best-effort
    }
  }
});

