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

    /** Toont een melding in de dialoog (html wordt niet ge-escaped: alleen eigen, veilige inhoud meegeven). */
    message(title, html) {
      const dialog = document.getElementById('form-dialog');
      dialog.innerHTML = `<div class="dialog-form">
        <header class="dialog-head"><h2>${esc(title)}</h2><button type="button" class="icon-btn" data-close aria-label="Sluiten">✕</button></header>
        <div class="dialog-body">${html}</div>
        <footer class="dialog-foot"><span class="spacer"></span><button type="button" class="btn primary" data-close>Oké</button></footer>
      </div>`;
      dialog.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => dialog.close()));
      dialog.showModal();
    },

    /** Vaste hulp-informatie bij mentale nood (Nederland). */
    crisisHtml() {
      return `<div class="crisis" role="note">
        <strong>Gaat het echt niet goed, of denk je aan zelfdoding?</strong> Je hoeft het niet alleen te doen.
        Praat erover met <a href="https://www.113.nl" target="_blank" rel="noopener">113 Zelfmoordpreventie</a>: bel <a href="tel:113">113</a>
        of gratis <a href="tel:08000113">0800-0113</a>, of chat via 113.nl – dag en nacht bereikbaar.
        Je huisarts (of 's avonds en in het weekend de huisartsenpost) kan ook helpen. Bij direct gevaar: bel <a href="tel:112">112</a>.
      </div>`;
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
