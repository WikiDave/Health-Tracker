/* Algemene formulier-dialoog. Een formulier wordt beschreven met een lijst velden:
 *   { name, label, type, options, placeholder, required, half, help, list, min, max, step }
 * Types: text, number, date, time, textarea, select, checkbox, scale, choice, multi, times, results, heading.
 * 'results' is een lijst regels; standaard labuitslagen, of eigen kolommen via f.columns = [{k, label, placeholder, list, num}]. */
(function (HT) {
  'use strict';
  const { escapeHtml: esc, parseNum, parseTimes, formatNum, uid } = HT.utils;

  const dialog = document.getElementById('form-dialog');

  function attrs(f) {
    let a = '';
    if (f.placeholder) a += ` placeholder="${esc(f.placeholder)}"`;
    if (f.required) a += ' required';
    if (f.list) a += ` list="${esc(f.list)}"`;
    if (f.min != null) a += ` min="${esc(f.min)}"`;
    if (f.max != null) a += ` max="${esc(f.max)}"`;
    return a;
  }

  const LAB_COLUMNS = [
    { k: 'name', label: 'Bepaling', placeholder: 'Bepaling (bv. Hemoglobine)', list: 'lab-names' },
    { k: 'value', label: 'Uitslag', placeholder: 'Uitslag', num: true },
    { k: 'unit', label: 'Eenheid', placeholder: 'Eenheid' },
    { k: 'low', label: 'Min', placeholder: 'Min', num: true },
    { k: 'high', label: 'Max', placeholder: 'Max', num: true },
  ];

  const columnsOf = (f) => f.columns || LAB_COLUMNS;

  function resultRow(f, r) {
    r = r || {};
    const cols = columnsOf(f);
    return `<div class="result-row${f.columns ? ' custom' : ''}" data-row style="${f.columns ? `grid-template-columns: 2fr repeat(${cols.length - 1}, 1fr) 36px` : ''}">
      ${cols.map((c) => `<input data-k="${c.k}"${c.num ? ' inputmode="decimal"' : ''}${c.list ? ` list="${esc(c.list)}"` : ''} placeholder="${esc(c.placeholder || c.label)}"
        value="${esc(c.num ? formatNum(r[c.k]) : r[c.k])}" aria-label="${esc(c.label)}">`).join('')}
      <button type="button" class="icon-btn" data-remove-row aria-label="Regel verwijderen">✕</button>
    </div>`;
  }

  function fieldHtml(f, value) {
    const id = `f-${f.name}`;
    const v = value == null ? '' : value;
    const help = f.help ? `<small class="help">${esc(f.help)}</small>` : '';
    const label = `<label for="${id}">${esc(f.label)}${f.required ? ' *' : ''}</label>`;
    const cls = `field${f.half ? ' half' : ''}`;

    switch (f.type) {
      case 'heading':
        return `<div class="field full form-section"><h3>${esc(f.label)}</h3>${help}</div>`;
      case 'choice':
        return `<fieldset class="field full choice"><legend>${esc(f.label)}</legend><div class="choice-options">
          ${f.options.map(([val, text]) => `<label class="choice-opt"><input type="radio" name="${f.name}" value="${esc(val)}"${String(v) === String(val) ? ' checked' : ''}><span>${esc(text)}</span></label>`).join('')}
          </div>${help}</fieldset>`;
      case 'multi': {
        const chosen = new Set(Array.isArray(v) ? v : []);
        return `<fieldset class="field full choice"><legend>${esc(f.label)}</legend><div class="multi-options">
          ${f.options.map((o) => `<label class="chip multi"><input type="checkbox" name="${f.name}" value="${esc(o)}"${chosen.has(o) ? ' checked' : ''}><span>${esc(o)}</span></label>`).join('')}
          </div>${help}</fieldset>`;
      }
      case 'textarea':
        return `<div class="${cls} full">${label}<textarea id="${id}" name="${f.name}" rows="3"${attrs(f)}>${esc(v)}</textarea>${help}</div>`;
      case 'select':
        return `<div class="${cls}">${label}<select id="${id}" name="${f.name}"${attrs(f)}>
          ${f.options.map((o) => {
            const [val, text] = Array.isArray(o) ? o : [o, o];
            return `<option value="${esc(val)}"${String(val) === String(v) ? ' selected' : ''}>${esc(text)}</option>`;
          }).join('')}</select>${help}</div>`;
      case 'checkbox':
        return `<div class="${cls} check"><label><input type="checkbox" id="${id}" name="${f.name}"${v ? ' checked' : ''}> ${esc(f.label)}</label>${help}</div>`;
      case 'scale': {
        const opts = [];
        for (let i = f.min; i <= f.max; i++) {
          const title = f.labels && f.labels[i] ? ` title="${esc(f.labels[i])}"` : '';
          opts.push(`<label class="chip"${title}><input type="radio" name="${f.name}" value="${i}"${String(v) === String(i) ? ' checked' : ''}><span>${f.emoji ? f.emoji[i - f.min] : i}</span></label>`);
        }
        return `<div class="field full"><span class="label">${esc(f.label)}</span><div class="scale" role="radiogroup" aria-label="${esc(f.label)}">${opts.join('')}</div>${help}</div>`;
      }
      case 'times':
        return `<div class="${cls}">${label}<input id="${id}" name="${f.name}" value="${esc(Array.isArray(v) ? v.join(', ') : v)}"${attrs(f)}>${help}</div>`;
      case 'results': {
        const cols = columnsOf(f);
        const empty = Array(f.emptyRows || 3).fill(null);
        const rows = (Array.isArray(v) && v.length ? v : empty).map((r) => resultRow(f, r)).join('');
        return `<div class="field full"><span class="label">${esc(f.label)}</span>
          <div class="results-head" style="${f.columns ? `grid-template-columns: 2fr repeat(${cols.length - 1}, 1fr) 36px` : ''}">${cols.map((c) => `<span>${esc(c.label)}</span>`).join('')}<span></span></div>
          <div class="results" data-results="${esc(f.name)}">${rows}</div>
          <button type="button" class="btn small ghost" data-add-row="${esc(f.name)}">+ Regel toevoegen</button>${help}</div>`;
      }
      case 'number':
        return `<div class="${cls}">${label}<input id="${id}" name="${f.name}" inputmode="decimal" value="${esc(formatNum(v))}"${attrs(f)}>${help}</div>`;
      default:
        return `<div class="${cls}">${label}<input id="${id}" type="${f.type || 'text'}" name="${f.name}" value="${esc(v)}"${attrs(f)}>${help}</div>`;
    }
  }

  function readValues(form, fields) {
    const out = {};
    const errors = [];
    for (const f of fields) {
      if (f.type === 'heading') continue;
      if (f.type === 'multi') {
        out[f.name] = [...form.querySelectorAll(`input[name="${f.name}"]:checked`)].map((x) => x.value);
        continue;
      }
      if (f.type === 'scale' || f.type === 'choice') {
        const checked = form.querySelector(`input[name="${f.name}"]:checked`);
        out[f.name] = checked ? Number(checked.value) : null;
        continue;
      }
      if (f.type === 'results') {
        const cols = columnsOf(f);
        const numeric = new Set(cols.filter((c) => c.num).map((c) => c.k));
        out[f.name] = [...form.querySelectorAll(`[data-results="${f.name}"] [data-row]`)]
          .map((row) => {
            const r = { id: uid() };
            row.querySelectorAll('[data-k]').forEach((inp) => {
              const k = inp.dataset.k;
              r[k] = numeric.has(k) ? parseNum(inp.value) : inp.value.trim();
            });
            return r;
          })
          // Labuitslagen: naam + waarde verplicht; eigen kolommen: eerste kolom ingevuld.
          .filter((r) => (f.columns ? r[cols[0].k] : r.name && r.value != null));
        continue;
      }
      const el = form.elements[f.name];
      if (!el) continue;
      if (f.type === 'checkbox') out[f.name] = el.checked;
      else if (f.type === 'number') {
        const n = parseNum(el.value);
        if (el.value.trim() && n == null) errors.push(`"${f.label}" moet een getal zijn.`);
        out[f.name] = n;
      } else if (f.type === 'times') {
        const t = parseTimes(el.value);
        if (t == null) errors.push(`"${f.label}": gebruik tijden als 08:00, 20:00.`);
        out[f.name] = t || [];
      } else out[f.name] = el.value.trim();
    }
    return { values: out, errors };
  }

  /**
   * Opent een formulier.
   * @param {{title:string, fields:Array, values?:object, submitLabel?:string,
   *          onSubmit:(values:object)=>(void|string), onDelete?:()=>void}} opts
   */
  function open(opts) {
    const values = opts.values || {};
    dialog.innerHTML = `
      <form method="dialog" class="dialog-form" novalidate>
        <header class="dialog-head">
          <h2>${esc(opts.title)}</h2>
          <button type="button" class="icon-btn" data-close aria-label="Sluiten">✕</button>
        </header>
        <div class="dialog-body">
          <div class="form-grid">${opts.fields.map((f) => fieldHtml(f, values[f.name])).join('')}</div>
          <p class="form-error" role="alert" hidden></p>
        </div>
        <footer class="dialog-foot">
          ${opts.onDelete ? '<button type="button" class="btn danger ghost" data-delete>Verwijderen</button>' : ''}
          <span class="spacer"></span>
          <button type="button" class="btn ghost" data-close>Annuleren</button>
          <button type="submit" class="btn primary">${esc(opts.submitLabel || 'Opslaan')}</button>
        </footer>
      </form>`;

    const form = dialog.querySelector('form');
    const errorEl = form.querySelector('.form-error');

    form.addEventListener('click', (e) => {
      if (e.target.closest('[data-close]')) dialog.close();
      const add = e.target.closest('[data-add-row]');
      if (add) {
        const f = opts.fields.find((x) => x.name === add.dataset.addRow);
        const box = form.querySelector(`[data-results="${f.name}"]`);
        box.insertAdjacentHTML('beforeend', resultRow(f));
        const rows = box.querySelectorAll('[data-row]');
        rows[rows.length - 1].querySelector('input').focus();
      }
      const rm = e.target.closest('[data-remove-row]');
      if (rm) rm.closest('[data-row]').remove();
      if (e.target.closest('[data-delete]') && confirm('Weet je zeker dat je dit wilt verwijderen?')) {
        opts.onDelete();
        dialog.close();
      }
    });

    // Een keuze in een schaal nogmaals aanklikken maakt hem leeg.
    form.querySelectorAll('.scale input').forEach((inp) => {
      inp.addEventListener('mousedown', () => { inp.dataset.was = inp.checked ? '1' : ''; });
      inp.addEventListener('click', () => { if (inp.dataset.was) { inp.checked = false; inp.dataset.was = ''; } });
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const missing = opts.fields.filter((f) => f.required && !String((form.elements[f.name] || {}).value || '').trim());
      const { values: out, errors } = readValues(form, opts.fields);
      missing.forEach((f) => errors.unshift(`"${f.label}" is verplicht.`));
      const custom = !errors.length && opts.onSubmit(out);
      if (errors.length || typeof custom === 'string') {
        errorEl.textContent = errors.length ? errors.join(' ') : custom;
        errorEl.hidden = false;
        return;
      }
      dialog.close();
    });

    dialog.showModal();
    const first = form.querySelector('.dialog-body input:not([type=radio]):not([type=checkbox]), .dialog-body textarea, .dialog-body select');
    if (first && window.matchMedia('(pointer: fine)').matches) first.focus();
  }

  HT.form = { open };
})(window.HT);
