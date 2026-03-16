// Shared selector helper functions — used by both Douyin and XHS content scripts

// Try multiple selectors until one matches
function queryFirst(parent, selectorString) {
  const selectors = selectorString.split(',').map(s => s.trim());
  for (const sel of selectors) {
    try {
      const el = parent.querySelector(sel);
      if (el) return el;
    } catch (e) { /* invalid selector, skip */ }
  }
  return null;
}

function queryAll(parent, selectorString) {
  const selectors = selectorString.split(',').map(s => s.trim());
  for (const sel of selectors) {
    try {
      const els = parent.querySelectorAll(sel);
      if (els.length > 0) return Array.from(els);
    } catch (e) { /* invalid selector, skip */ }
  }
  return [];
}

// Find button by text content (fallback strategy)
function findButtonByText(parent, text) {
  const buttons = parent.querySelectorAll('button, [role="button"], a');
  for (const btn of buttons) {
    if (btn.textContent.trim().includes(text)) return btn;
  }
  return null;
}
