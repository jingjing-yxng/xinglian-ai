// Douyin-specific DOM selectors
// Uses data-e2e attributes where available, falls back to text/class selectors

const DOUYIN_SELECTORS = {
  // Search results page
  search: {
    userCards: '[data-e2e="search-user-card"], .search-result-card',
    userNickname: '[data-e2e="search-user-name"], .user-card-nickname',
    userAvatar: '[data-e2e="search-user-avatar"] img, .user-card-avatar img',
    userBio: '[data-e2e="search-user-desc"], .user-card-desc',
    userFollowers: '[data-e2e="search-user-fans"], .user-card-fans',
    userLink: '[data-e2e="search-user-card"] a, .user-card-nickname a',
    loadMore: '[data-e2e="load-more"], .load-more-btn'
  },

  // Profile page
  profile: {
    nickname: '[data-e2e="user-info"] [data-e2e="user-title"], .user-info .nickname, h1.name',
    bio: '[data-e2e="user-info"] [data-e2e="user-desc"], .user-info .desc, .user-desc',
    avatar: '[data-e2e="user-info"] img.avatar, .user-info .avatar img',
    followers: '[data-e2e="user-info"] [data-e2e="user-fans"], .user-info .fans .count',
    following: '[data-e2e="user-info"] [data-e2e="user-following"], .user-info .following .count',
    likes: '[data-e2e="user-info"] [data-e2e="user-likes"], .user-info .likes .count',
    videoCount: '[data-e2e="user-info"] [data-e2e="user-works"], .user-info .works .count',
    followBtn: '[data-e2e="user-info"] [data-e2e="follow-btn"], .user-info .follow-btn, button.follow-button',
    messageBtn: '[data-e2e="user-info"] [data-e2e="message-btn"], .user-info .message-btn',
    videoList: '[data-e2e="user-post-list"], .user-post-list',
    videoItems: '[data-e2e="user-post-item"], .user-post-item, .video-card',
    videoTitle: '[data-e2e="video-title"], .video-card .title, .video-desc'
  },

  // Message/chat page
  chat: {
    conversationList: '[data-e2e="chat-list"], .chat-list, .im-list',
    conversationItem: '[data-e2e="chat-item"], .chat-item, .im-item',
    conversationName: '[data-e2e="chat-name"], .chat-item .name, .im-item .name',
    messageList: '[data-e2e="chat-messages"], .message-list, .im-message-list',
    messageItem: '[data-e2e="chat-message"], .message-item, .im-message',
    messageContent: '[data-e2e="chat-message-text"], .message-content, .im-message-text',
    messageInput: '[data-e2e="chat-input"], .chat-input textarea, .im-input textarea, [contenteditable]',
    sendBtn: '[data-e2e="chat-send"], .chat-send-btn, .im-send-btn',
    myMessage: '.message-self, .im-message-self, [class*="self"]',
    theirMessage: '.message-other, .im-message-other, [class*="other"]'
  },

  // General
  general: {
    followBtnText: '关注',
    followedBtnText: '已关注',
    mutualFollowText: '互关',
    sendMessageText: '发送',
    searchInput: '[data-e2e="search-input"], #search-input, input[type="search"]'
  }
};
