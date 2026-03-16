// Storage layer — chrome.storage.local wrapper for settings

const Settings = {
  defaults: {
    currentPlatform: 'douyin'
  },

  async get(key) {
    return new Promise((resolve) => {
      chrome.storage.local.get(key, (data) => {
        if (key && typeof key === 'string') {
          resolve(data[key] ?? this.defaults[key]);
        } else {
          resolve({ ...this.defaults, ...data });
        }
      });
    });
  },

  async set(obj) {
    return new Promise((resolve) => {
      chrome.storage.local.set(obj, resolve);
    });
  }
};
