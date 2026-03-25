// Shared extraction utilities — used by both Douyin and XHS extractors

const BaseExtractors = {
  // Blacklist patterns for institutions, official accounts, and non-KOL entities
  INSTITUTION_PATTERNS: [
    /官方/, /官网/, /政府/, /公安/, /法院/, /检察/,
    /央视/, /CCTV/, /CETV/, /卫视/, /电视台/, /广播/,
    /新闻网/, /新闻/, /日报/, /晚报/, /时报/, /周刊/, /报社/,
    /教育局/, /教育厅/, /教育部/, /市委/, /省委/, /区委/,
    /公司$/, /集团$/, /有限$/, /股份/, /企业/,
    /银行/, /保险/, /证券/,
    /大学$/, /学院$/, /学校$/, /中学$/, /小学$/, /幼儿园$/,
    /医院/, /诊所/,
    /相关搜索/, /搜索发现/, /换一换/  // UI junk
  ],

  // Check if a name/bio looks like an institution rather than a KOL
  _isInstitution(nickname, bio) {
    const text = (nickname || '') + (bio || '');
    return this.INSTITUTION_PATTERNS.some(pattern => pattern.test(text));
  },

  // Filter out institutions and junk entries
  _filterInstitutions(prospects) {
    const before = prospects.length;
    const filtered = prospects.filter(p => !this._isInstitution(p.nickname, p.bio));
    const removed = before - filtered.length;
    if (removed > 0) {
      console.log(`[XingLian] Filtered out ${removed} institutional/junk accounts`);
    }
    return filtered;
  },

  // Parse Chinese follower counts like "423.0万粉丝" or "1.2亿"
  _parseFollowerCount(text) {
    if (!text) return 0;
    text = text.replace(/[,\s]/g, '');
    const wanMatch = text.match(/([\d.]+)\s*万/);
    if (wanMatch) return Math.round(parseFloat(wanMatch[1]) * 10000);
    const yiMatch = text.match(/([\d.]+)\s*亿/);
    if (yiMatch) return Math.round(parseFloat(yiMatch[1]) * 100000000);
    const num = parseInt(text.replace(/[^\d]/g, ''), 10);
    return isNaN(num) ? 0 : num;
  }
};
