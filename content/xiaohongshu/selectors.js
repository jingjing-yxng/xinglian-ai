// XHS (Xiaohongshu) DOM selectors
// Used as fallbacks — primary extraction is selector-agnostic

const XHS_SELECTORS = {
  search: {
    // User cards on 用户 tab search results
    userCards: '[class*="user-card"], [class*="user-item"], [class*="search-user"], .search-result-card',
    userNickname: '[class*="user-name"], [class*="nickname"], a[href*="/user/profile/"]',
    userAvatar: '[class*="user-avatar"] img, [class*="avatar"] img',
    userBio: '[class*="user-desc"], [class*="desc"], [class*="bio"]',
    userFollowers: '[class*="user-fans"], [class*="fans"], [class*="follower"]',
    userLink: 'a[href*="/user/profile/"]',
    // Note cards (legacy fallback)
    noteCards: '.note-item, [class*="note-card"], [class*="search-result"], .feeds-container section',
    profileLink: 'a[href*="/user/profile/"]'
  },

  profile: {
    nickname: '[class*="user-name"], [class*="nickname"], .user-info .name, h1',
    bio: '[class*="user-desc"], [class*="desc"], [class*="bio"], [class*="signature"]',
    followers: '[class*="fans"] [class*="count"], [class*="follower"] [class*="count"]',
    followersLabel: '[class*="fans"] [class*="label"], [class*="follower"] [class*="label"]',
    avatar: '[class*="user-avatar"] img, .user-info img, [class*="avatar"] img',
    noteItems: '[class*="note-item"], [class*="note-card"], .note-grid .note',
    followButton: '[class*="follow-btn"], button[class*="follow"]',
    followedButton: '[class*="followed"], button[class*="followed"]',
    messageButton: '[class*="message-btn"], [class*="chat-btn"]'
  },

  chat: {
    conversationItem: '[class*="conversation-item"], [class*="chat-item"], [class*="session-item"], [class*="im-item"]',
    conversationName: '[class*="conversation-name"], [class*="chat-name"], [class*="session-name"], [class*="name"]',
    conversationPreview: '[class*="preview"], [class*="last-msg"], [class*="summary"]',
    unreadBadge: '[class*="unread"], [class*="badge"], [class*="dot"]',
    messageItem: '[class*="message-item"], [class*="msg-item"], [class*="chat-msg"], [class*="im-message"]',
    messageContent: '[class*="message-content"], [class*="msg-content"], [class*="msg-text"]',
    messageSent: '[class*="self"], [class*="mine"], [class*="right"], [class*="message-self"]',
    messageReceived: '[class*="other"], [class*="left"], [class*="message-other"]',
    inputBox: '[class*="chat-input"] textarea, [class*="im-input"] textarea, [contenteditable="true"], [role="textbox"]',
    sendButton: '[class*="chat-send"], [class*="send-btn"], [class*="im-send"]'
  },

  general: {
    followBtnText: '关注',
    followedBtnText: '已关注',
    mutualFollowText: '互相关注',
    messageButtonText: '发消息',
    dmButtonText: '私信'
  }
};
