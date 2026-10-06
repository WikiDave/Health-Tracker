/* Back-up: je gegevens veilig buiten dit apparaat bewaren, terugzetten (vervangen of samenvoegen) en herstelpunten. */
(function (HT) {
  'use strict';
  const { store, ui, utils, form, backup: B, safety } = HT;
  const { escapeHtml: esc, todayISO, formatDateLong, formatDateShort } = utils;

  const EVERY = [[7, 'Elke week'], [14, 'Elke 2 weken'], [30, 'Elke maand']];

  function when(iso) {
    if (!iso) return 'nog nooit';
    const d = new Date(iso);
    const days = Math.floor((Date.now() - d.getTime()) / 86400000);
    const time = d.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
    if (days <= 0 && d.toDateString() === new Date().toDateString()) return `vandaag om ${time}`;
    if (days <= 1) return `gisteren om ${time}`;
    return `${days} dagen geleden (${d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long' })})`;
  }

  const size = (bytes) => (bytes == null ? '?' : bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} kB` : `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`);

  function status() {
    return B.status(store.data.settings, store.data, Date.now());
  }

  /** Maakt het bestand en deelt het (telefoon: kies Google Drive, iCloud, mail…) of downloadt het. */
  async function makeBackup(password) {
    const plain = store.exportJSON();
    const text = password ? await B.encrypt(plain, password) : plain;
    const name = `gezondheid-backup-${todayISO()}${password ? '-beveiligd' : ''}.json`;
    let shared = false;
    try {
      const file = new File([text], name, { type: 'application/json' });
      if (navigator.canShare && navigator.canShare({ files: [file] }) && /Android|iPhone|iPad/i.test(navigator.userAgent)) {
        await navigator.share({ files: [file], title: 'Back-up Gezondheidsapp' });
        shared = true;
      }
    } catch (e) {
      if (e && e.name === 'AbortError') return false; // delen geannuleerd: niet als back-up tellen
    }
    if (!shared) ui.download(name, text, 'application/json');
    store.saveSettings({ lastBackup: new Date().toISOString(), lastBackupEncrypted: Boolean(password) }, true);
    safety.requestPersist();
    ui.toast('💾 Back-up gemaakt');
    if (HT.app) HT.app.render();
    return true;
  }

  function openMake() {
    form.open({
      title: '💾 Back-up maken',
      fields: [
        { name: 'hInfo', type: 'heading', label: 'Bewaar het bestand buiten je telefoon: in Google Drive, iCloud Drive, OneDrive, je mail of op je computer.' },
        { name: 'protect', label: 'Beveiligen met een wachtwoord (aanbevolen als je het in de cloud of mail zet)', type: 'checkbox' },
        { name: 'password', label: 'Wachtwoord', type: 'password', half: true, help: 'Minstens 8 tekens. Vergeet je het, dan kan niemand de back-up nog openen – ook jij niet.' },
        { name: 'password2', label: 'Nog een keer', type: 'password', half: true },
      ],
      values: { protect: Boolean(store.data.settings.lastBackupEncrypted) },
      onSubmit(v) {
        if (v.protect) {
          if (!v.password || v.password.length < 8) return 'Kies een wachtwoord van minstens 8 tekens.';
          if (v.password !== v.password2) return 'De wachtwoorden zijn niet hetzelfde.';
        }
        // Na het sluiten van het formulier: delen/downloaden (delen moet direct na een tik, dus meteen starten).
        makeBackup(v.protect ? v.password : null).catch((e) => alert(`Back-up maken mislukt: ${e.message}`));
      },
    });
  }

  function askPassword() {
    return new Promise((resolve) => {
      form.open({
        title: '🔒 Beveiligde back-up',
        fields: [{ name: 'password', label: 'Wachtwoord van deze back-up', type: 'password', required: true }],
        values: {},
        onSubmit(v) { resolve(v.password); },
      });
      document.getElementById('form-dialog').addEventListener('close', () => resolve(null), { once: true });
    });
  }

  /** Terugzetten: bestand lezen, eventueel ontsleutelen, laten zien wat erin zit en kiezen: samenvoegen of vervangen. */
  async function restoreFile(file) {
    let text = await file.text();
    try {
      if (B.isEncrypted(text)) {
        const pw = await askPassword();
        if (!pw) return;
        text = await B.decrypt(text, pw);
      }
      const incoming = B.parse(text);
      const s = B.summarize(incoming);
      const cur = B.summarize(store.data);
      chooseRestore(incoming, s, cur);
    } catch (e) {
      alert(`Terugzetten lukt niet: ${e.message}`);
    }
  }

  function chooseRestore(incoming, s, cur) {
    const dialog = document.getElementById('form-dialog');
    dialog.innerHTML = `<div class="dialog-form">
      <header class="dialog-head"><h2>Back-up terugzetten</h2><button type="button" class="icon-btn" data-close aria-label="Sluiten">✕</button></header>
      <div class="dialog-body">
        <p><strong>In de back-up:</strong> ${esc(B.summaryText(s))}${s.from ? ` <span class="muted">(${esc(formatDateShort(s.from))} – ${esc(formatDateShort(s.to))})</span>` : ''}.</p>
        ${s.updatedAt ? `<p class="muted small">Laatst gewijzigd in de back-up: ${esc(new Date(s.updatedAt).toLocaleString('nl-NL'))}</p>` : ''}
        <p><strong>Nu in de app:</strong> ${esc(B.summaryText(cur))}.</p>
        <div class="type-choice">
          <button class="btn primary restore-btn" data-restore="merge"><span>➕ Samenvoegen</span><small>Alles uit de back-up erbij; wat al in de app staat blijft staan</small></button>
          <button class="btn ghost restore-btn" data-restore="replace"><span>♻️ Alles vervangen</span><small>De app wordt precies zoals de back-up</small></button>
        </div>
        <p class="muted small">Wat er nu in de app staat, wordt eerst bewaard als herstelpunt. Je kunt dit dus terugdraaien.</p>
      </div>
    </div>`;
    dialog.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => dialog.close()));
    dialog.querySelectorAll('[data-restore]').forEach((b) => b.addEventListener('click', async () => {
      const mode = b.dataset.restore;
      if (mode === 'replace' && cur.total > 0 && !confirm('Alles in de app wordt vervangen door de back-up. Doorgaan?')) return;
      try { await safety.snapshot('Voor het terugzetten van een back-up'); } catch (e) { /* geen herstelpunt mogelijk */ }
      if (mode === 'merge') {
        const { data, added } = B.merge(store.data, incoming);
        store.replace(data);
        const n = Object.values(added).reduce((a, x) => a + x, 0);
        ui.toast(n ? `➕ ${n} items toegevoegd` : 'Niets nieuws in deze back-up');
      } else {
        const keep = { lastBackup: store.data.settings.lastBackup };
        store.replace(incoming);
        store.saveSettings(keep, true);
        ui.toast('♻️ Back-up teruggezet');
      }
      dialog.close();
      safety.requestPersist();
    }));
    if (!dialog.open) dialog.showModal();
  }

  /** Kaart voor het startscherm: herinnering om een back-up te maken, of herstel als alles weg lijkt. */
  function cardHtml() {
    const rec = safety.recoverable;
    if (rec) {
      return `<section class="card backup-card bad">
        <h2>⚠️ Je gegevens lijken weg</h2>
        <p>Er is nog een herstelpunt van ${esc(when(rec.created))} met ${esc(B.summaryText(rec.summary))}.</p>
        <div class="button-row"><button class="btn primary" data-backup-recover="${esc(rec.id)}">Terugzetten</button><a class="btn ghost" href="#/backup">Meer opties</a></div>
      </section>`;
    }
    const st = status();
    if (st.level === 'ok' || st.level === 'empty') return '';
    if (st.level === 'never' && B.summarize(store.data).total < 5) return '';
    const text = st.level === 'never' ? 'Je hebt nog nooit een back-up gemaakt. Je gegevens staan alleen op dit apparaat – als je telefoon kapotgaat of de browser wordt gewist, ben je ze kwijt.'
      : `Je laatste back-up is van ${when(store.data.settings.lastBackup)}.${st.changedSince ? ' Sindsdien heb je nieuwe gegevens ingevuld.' : ''}`;
    return `<section class="card backup-card ${st.level === 'due' ? 'warn' : 'bad'}">
      <h2>💾 Tijd voor een back-up</h2>
      <p>${esc(text)}</p>
      <div class="button-row"><button class="btn primary" data-backup-make>Back-up maken</button><a class="btn ghost" href="#/backup">Waarom?</a></div>
    </section>`;
  }

  function bindCard(el) {
    el.querySelectorAll('[data-backup-make]').forEach((b) => b.addEventListener('click', openMake));
    el.querySelectorAll('[data-backup-recover]').forEach((b) => b.addEventListener('click', async () => {
      try { await safety.restore(b.dataset.backupRecover); await safety.checkRecovery(); ui.toast('Gegevens teruggezet'); } catch (e) { alert(e.message); }
    }));
  }

  async function render(el) {
    const st = status();
    const s = B.summarize(store.data);
    const set = store.data.settings;
    const installed = safety.installed();
    const levelText = {
      ok: ['good', `✓ Laatste back-up ${when(set.lastBackup)}`],
      due: ['warn', `Laatste back-up ${when(set.lastBackup)} – tijd voor een nieuwe`],
      overdue: ['bad', `Laatste back-up ${when(set.lastBackup)} – maak er nu een`],
      never: ['bad', 'Je hebt nog nooit een back-up gemaakt'],
      empty: ['', 'Nog geen gegevens om te bewaren'],
    }[st.level];

    el.innerHTML = `
      ${ui.pageHead('Back-up', '<button class="btn primary" data-make>💾 Back-up maken</button>')}
      <section class="card backup-status ${levelText[0]}">
        <p class="backup-big">${esc(levelText[1])}</p>
        ${set.lastBackup ? `<p class="muted small">${set.lastBackupEncrypted ? '🔒 Beveiligd met wachtwoord' : 'Niet beveiligd met wachtwoord'}${st.changedSince ? ' · sindsdien is er iets veranderd' : ' · sindsdien niets veranderd'}</p>` : ''}
        <p>In de app: ${esc(B.summaryText(s))}.</p>
        <div class="field half"><label for="backup-every">Herinner me</label>
          <select id="backup-every" data-every>${EVERY.map(([v, t]) => `<option value="${v}"${v === st.every ? ' selected' : ''}>${t}</option>`).join('')}</select></div>
      </section>

      <section class="card">
        <h2>Zo raak je niets kwijt</h2>
        <ol class="safety-steps">
          <li class="${set.lastBackup ? 'done' : ''}"><strong>Maak regelmatig een back-up en bewaar die buiten je telefoon</strong> – in Google Drive, iCloud Drive, OneDrive, je mail of op je computer. Op je telefoon kies je na <em>Back-up maken</em> waar het bestand heen moet. Dit is de enige bescherming als je telefoon kapotgaat, gestolen wordt of je een nieuwe krijgt.</li>
          <li class="${installed ? 'done' : ''}"><strong>Zet de app op je beginscherm</strong>${installed ? ' ✓' : ''}. Vooral op een iPhone belangrijk: Safari kan gegevens van websites wissen die je een week niet hebt geopend, maar niet van apps op je beginscherm. <span class="muted">(iPhone: Deel-knop → Zet op beginscherm. Android: menu ⋮ → App installeren.)</span></li>
          <li data-persist-step><strong>Blijvende opslag</strong> – de app vraagt je browser de gegevens niet op te ruimen. <span data-persist class="muted">Controleren…</span></li>
          <li><strong>Wis nooit de "websitegegevens", "cookies en sitegegevens" of "browsegeschiedenis inclusief sitegegevens"</strong> van je browser – daarmee wis je ook deze app. Gewone geschiedenis wissen is geen probleem.</li>
          <li><strong>Blijf dezelfde browser en hetzelfde adres gebruiken.</strong> Gegevens in Chrome zie je niet in Samsung Internet of Firefox, en ook niet op een ander webadres.</li>
          <li><strong>Nieuwe telefoon?</strong> Maak op je oude telefoon een back-up, open de app op je nieuwe telefoon en kies <em>Back-up terugzetten</em>.</li>
        </ol>
      </section>

      <section class="card">
        <h2>Back-up terugzetten</h2>
        <p>Kies een back-upbestand. Je ziet eerst wat erin zit, en kiest dan <strong>samenvoegen</strong> (bijvoorbeeld van een ander apparaat) of <strong>alles vervangen</strong>.</p>
        <label class="btn ghost">⬆ Back-upbestand kiezen<input type="file" accept="application/json,.json" data-import hidden></label>
        <p class="muted small">Let op: een Excel-export kun je niet terugzetten; gebruik daarvoor de back-up (.json).</p>
      </section>

      <section class="card">
        <h2>🛟 Herstelpunten op dit apparaat</h2>
        <p class="muted small">De app bewaart zelf elke dag een kopie (de laatste ${14} dagen) in een tweede opslag van de browser, en ook vlak voor je een back-up terugzet of alles wist. Handig bij een vergissing – maar het helpt niet als je telefoon kwijt is. Daarvoor is de back-up.</p>
        <div data-points><p class="muted">Laden…</p></div>
      </section>

      <p class="muted small" data-usage></p>`;

    el.querySelector('[data-make]').addEventListener('click', openMake);
    el.querySelector('[data-every]').addEventListener('change', (e) => { store.saveSettings({ backupEvery: Number(e.target.value) }, true); ui.toast('Opgeslagen'); });
    el.querySelector('[data-import]').addEventListener('change', (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) restoreFile(f); });

    // Asynchroon: opslagstatus en herstelpunten.
    safety.persistence().then(async (p) => {
      let persisted = p.persisted;
      if (!persisted && p.supported && safety.hasData(store.data)) persisted = await safety.requestPersist();
      const span = el.querySelector('[data-persist]');
      if (span) {
        span.textContent = persisted ? '✓ Aan: je browser ruimt deze gegevens niet zomaar op.'
          : p.supported ? 'Nog niet toegestaan door je browser. Zet de app op je beginscherm en gebruik hem regelmatig; dan staat de browser het meestal wel toe.'
            : 'Je browser ondersteunt dit niet – des te belangrijker om back-ups te maken.';
        el.querySelector('[data-persist-step]').classList.toggle('done', Boolean(persisted));
      }
      const usage = el.querySelector('[data-usage]');
      if (usage && p.usage != null) usage.textContent = `Gebruikte opslag: ${size(p.usage)}${p.quota ? ` van ${size(p.quota)} beschikbaar` : ''} · back-upbestand ± ${size(store.exportJSON().length)}`;
    });
    safety.list().then((points) => {
      const box = el.querySelector('[data-points]');
      if (!box) return;
      box.innerHTML = points.length ? `<ul class="list">${points.map((x) => `<li class="social-row"><span><strong>${esc(when(x.created))}</strong> <small class="muted">${esc(x.reason)}</small><br><small class="muted">${esc(B.summaryText(x.summary))}</small></span>
        <button class="btn small ghost" data-point="${esc(x.id)}">Terugzetten</button></li>`).join('')}</ul>` : '<p class="muted">Nog geen herstelpunten. Die verschijnen vanzelf zodra je iets invult.</p>';
      box.querySelectorAll('[data-point]').forEach((b) => b.addEventListener('click', async () => {
        if (!confirm('De app wordt teruggezet naar dit herstelpunt. De huidige stand wordt eerst zelf een herstelpunt. Doorgaan?')) return;
        try { await safety.restore(b.dataset.point); ui.toast('Herstelpunt teruggezet'); } catch (e) { alert(e.message); }
      }));
    }).catch(() => {
      const box = el.querySelector('[data-points]');
      if (box) box.innerHTML = '<p class="muted">Herstelpunten zijn in deze browser niet beschikbaar (bijvoorbeeld in privémodus).</p>';
    });
  }

  HT.views.backup = { title: 'Back-up', render, openMake, cardHtml, bindCard, restoreFile, when };
})(window.HT);
