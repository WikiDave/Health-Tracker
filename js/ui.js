/* Kleine gedeelde bouwstenen voor de schermen. */
(function (HT) {
  'use strict';
  const { escapeHtml: esc } = HT.utils;

  const ui = {
    pageHead(title, actionsHtml = '') {
      return `<div class="page-head"><h1>${esc(title)}</h1><div class="actions">${actionsHtml}</div></div>`;
    },

    empty(text, buttonHtml = '') {
      return `<div class="empty"><p>${esc(text)}</p>${buttonHtml}</div>`;
    },

    badge(text, kind = '') {
      return `<span class="badge ${kind}">${esc(text)}</span>`;
    },

    /** Status-badge met icoon + tekst (nooit alleen kleur). */
    statusBadge(status) {
      const map = {
        low: ['↓ Laag', 'warn'],
        high: ['↑ Hoog', 'warn'],
        normal: ['✓ Normaal', 'good'],
        expired: ['✕ Verlopen', 'bad'],
        expiring: ['! Verloopt binnenkort', 'warn'],
        valid: ['✓ Geldig', 'good'],
      };
      const m = map[status];
      return m ? ui.badge(m[0], m[1]) : '';
    },

    kv(label, value) {
      if (value == null || value === '') return '';
      return `<div class="kv"><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`;
    },

    /** Biedt tekst of bytes (Uint8Array) aan als download. */
    download(filename, content, type = 'application/json') {
      const blob = new Blob([content], { type });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },

    toast(text) {
      const t = document.getElementById('toast');
      t.textContent = text;
      t.hidden = false;
      clearTimeout(ui._toastTimer);
      ui._toastTimer = setTimeout(() => { t.hidden = true; }, 2500);
    },
  };

  HT.ui = ui;
  HT.views = {};
})(window.HT);
