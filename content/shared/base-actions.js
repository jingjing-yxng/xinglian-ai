// Shared action utilities — used by both Douyin and XHS action modules

const BaseActions = {
  // Random delay between actions (human-like)
  _delay(minMs = 1000, maxMs = 3000) {
    const ms = minMs + Math.random() * (maxMs - minMs);
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  // Find visible element with exact text match
  _findByText(text) {
    const all = document.querySelectorAll('button, [role="button"], a, div, span, p, li');
    const results = [];
    for (const el of all) {
      const t = el.textContent.trim();
      if (t === text && el.offsetWidth > 0 && el.offsetHeight > 0 && el.textContent.length <= text.length + 5) {
        results.push(el);
      }
    }
    return results;
  },

  // Check if an element is the main search bar
  _isSearchInput(el) {
    const placeholder = (el.placeholder || el.getAttribute('placeholder') || '');
    if (placeholder.includes('搜索') || placeholder.toLowerCase().includes('search')) return true;
    const e2e = el.getAttribute('data-e2e') || '';
    if (e2e.includes('search')) return true;
    let parent = el.parentElement;
    for (let i = 0; i < 3 && parent; i++) {
      if ((parent.getAttribute('data-e2e') || '').includes('search')) return true;
      if ((parent.getAttribute('role') || '') === 'search') return true;
      parent = parent.parentElement;
    }
    return false;
  },

  // Check if element is truly visible
  _isVisible(el) {
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return false;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
    let parent = el.parentElement;
    for (let i = 0; i < 5 && parent && parent !== document.body; i++) {
      const ps = window.getComputedStyle(parent);
      if (ps.display === 'none' || ps.visibility === 'hidden') return false;
      parent = parent.parentElement;
    }
    return true;
  },

  // Smart click: DOM events fallback (no React fiber — platform-specific modules add that)
  _smartClick(el) {
    const rect = el.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const opts = { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y };

    el.dispatchEvent(new PointerEvent('pointerdown', { ...opts, pointerId: 1 }));
    el.dispatchEvent(new PointerEvent('pointerup', { ...opts, pointerId: 1 }));
    el.dispatchEvent(new MouseEvent('mousedown', opts));
    el.dispatchEvent(new MouseEvent('mouseup', opts));
    el.dispatchEvent(new MouseEvent('click', opts));
    el.click();

    return false;
  }
};
