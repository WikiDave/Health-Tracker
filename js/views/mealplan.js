/* Weekmenu: welke dag je wat eet, wanneer je kookt (met restjes), allergiecontrole, eigen recepten en boodschappenlijst. */
(function (HT) {
  'use strict';
  const { store, ui, utils, form, recipes: R } = HT;
  const { escapeHtml: esc, todayISO, nowTime, addDays, formatNum, formatDateShort, weekStart, minutesOf, uid, sortBy } = utils;

  const DEFAULTS = { diet: 'alles', noPork: false, avoid: '', cookDays: ['Ma', 'Wo', 'Vr', 'Za'], workdays: ['Ma', 'Di', 'Wo', 'Do', 'Vr'], maxMinutes: 30, persons: 1, dinnerTime: '18:00', cookReminder: false };
  const SHORT = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'];
  const TAGS = ['vegetarisch', 'vegan', 'vis', 'vlees', 'varkensvlees', 'peulvruchten', 'snel', 'meal-prep'];
  const TAG_ICON = { vegetarisch: '🌱', vegan: '🌿', vis: '🐟', vlees: '🍗', peulvruchten: '🫘', 'meal-prep': '📦', snel: '⚡' };

  let offset = 0;

  const prefs = () => Object.assign({}, DEFAULTS, store.data.settings.meal || {});
  const allRecipes = () => [...R.RECIPES, ...store.list('recipes')];
  const recipeById = (id) => allRecipes().find((r) => r.id === id);
  const profile = () => R.parseAllergies(store.data.profile.allergies, prefs().avoid);
  const dayIdx = (names) => (names || []).map((n) => SHORT.indexOf(n)).filter((i) => i >= 0);
  const weekDates = (ws) => Array.from({ length: 7 }, (_, i) => addDays(ws, i));
  const currentWeek = () => addDays(weekStart(todayISO()), offset * 7);

  function planFor(ws) {
    return store.data.mealPlans[ws] || null;
  }

  function generate(ws, seed) {
    const p = prefs();
    const plan = R.generatePlan({
      recipes: allRecipes(),
      dates: weekDates(ws),
      prefs: { diet: p.diet, noPork: p.noPork, cookDays: dayIdx(p.cookDays), workdays: dayIdx(p.workdays), maxMinutes: Number(p.maxMinutes) || 999 },
      profile: profile(),
      seed: seed || Math.floor(Math.random() * 1e6) + 1,
    });
    plan.generatedAt = new Date().toISOString();
    store.saveMealPlan(ws, plan);
    ui.toast('Weekmenu gemaakt');
  }

  /** Wanneer beginnen met koken om op tijd te eten. */
  function cookStart(recipe) {
    const p = prefs();
    const start = minutesOf(p.dinnerTime || '18:00') - (recipe.minutes || 30);
    return `${String(Math.floor(start / 60)).padStart(2, '0')}:${String(((start % 60) + 60) % 60).padStart(2, '0')}`;
  }

  function badges(r, check) {
    const out = [`<span class="badge">⏱ ${r.minutes} min</span>`];
    for (const t of r.tags || []) if (TAG_ICON[t] && t !== 'snel') out.push(`<span class="badge">${TAG_ICON[t]} ${esc(t)}</span>`);
    if (check && !check.ok) out.push(ui.badge(`⚠️ bevat ${[...check.allergens, ...check.words].join(', ')}`, 'bad'));
    return out.join(' ');
  }

  function mealHtml(d, meal, isToday) {
    const m = d[meal];
    const label = R.MEAL_LABEL[meal];
    const change = `<button class="btn small ghost" data-change="${d.date}|${meal}">Wijzig</button>`;
    if (!m) return `<div class="meal-row"><span class="meal-label">${label}</span><span class="muted">–</span>${change}</div>`;
    if (m.text) return `<div class="meal-row"><span class="meal-label">${label}</span><span>${esc(m.text)}</span>${change}</div>`;
    const r = recipeById(m.recipe);
    if (!r) return `<div class="meal-row"><span class="meal-label">${label}</span><span class="muted">Recept niet gevonden</span>${change}</div>`;
    const check = R.checkRecipe(r, profile());
    let extra = '';
    if (m.leftoverOf) extra = `<small class="meal-note">♻️ Restje van ${esc(R.DAY_NAMES[(utils.parseISO(m.leftoverOf).getDay() + 6) % 7].toLowerCase())} – alleen opwarmen</small>`;
    else if (meal === 'avond' && m.cook) extra = `<small class="meal-note">🍳 Koken: begin om <strong>${cookStart(r)}</strong>${m.portions > 1 ? ` · maak <strong>${m.portions} porties</strong> (${m.portions - 1}× restje)` : ''}</small>`;
    return `<div class="meal-row">
      <span class="meal-label">${label}</span>
      <span class="meal-main"><a href="#" data-recipe="${esc(r.id)}" data-portions="${m.portions || 1}">${esc(r.name)}</a> ${!check.ok ? ui.badge('⚠️', 'bad') : ''}${extra}</span>
      <span class="meal-actions">${isToday ? `<button class="btn small ghost" data-eaten="${d.date}|${meal}" title="In je eetdagboek zetten">✓ Gegeten</button>` : ''}${change}</span>
    </div>`;
  }

  function showRecipe(id, portions = 1) {
    const r = recipeById(id);
    if (!r) return;
    const p = prefs();
    const factor = (Number(p.persons) || 1) * portions;
    const check = R.checkRecipe(r, profile());
    const allergens = (r.allergens || []).map((a) => R.ALLERGENS[a].label);
    ui.message(r.name, `
      <p>${badges(r, check)}</p>
      ${!check.ok ? `<p class="form-error">⚠️ Dit recept bevat <strong>${esc([...check.allergens, ...check.words].join(', '))}</strong>, waar je volgens je profiel of voorkeuren allergisch voor bent of wat je niet eet.</p>` : ''}
      <h3>Ingrediënten <small class="muted">(${factor} portie${factor === 1 ? '' : 's'})</small></h3>
      <ul class="list">${(r.ingredients || []).map((i) => `<li>${esc(formatNum(Math.round(i.qty * factor * 100) / 100))} ${esc(i.unit || '')} ${esc(i.name)}</li>`).join('')}</ul>
      <h3>Bereiding</h3><p>${esc(r.steps || '')}</p>
      <p class="muted small">Allergenen: ${allergens.length ? esc(allergens.join(', ')) : 'geen van de 14 wettelijke allergenen'}${r.veg ? ` · ${r.veg} g groente per portie` : ''}${r.keeps ? ` · blijft ${r.keeps} dag${r.keeps === 1 ? '' : 'en'} goed in de koelkast` : ''}.
        Controleer altijd het etiket van wat je koopt: producten kunnen sporen van allergenen bevatten.</p>`);
  }

  function changeMeal(ws, date, meal) {
    const plan = planFor(ws) || { days: weekDates(ws).map((d) => ({ date: d })) };
    const day = plan.days.find((d) => d.date === date);
    const current = day[meal] || {};
    const prof = profile();
    const options = sortBy(allRecipes().filter((r) => r.meal === meal), (r) => (R.checkRecipe(r, prof).ok ? '0' : '1') + r.name);
    form.open({
      title: `${R.MEAL_LABEL[meal]} – ${formatDateShort(date)}`,
      fields: [
        { name: 'recipe', label: 'Kies een recept', type: 'select', options: [['', '— geen recept —'], ...options.map((r) => {
          const c = R.checkRecipe(r, prof);
          return [r.id, `${c.ok ? '' : '⚠️ '}${r.name} (${r.minutes} min)${c.ok ? '' : ` – bevat ${[...c.allergens, ...c.words].join(', ')}`}`];
        })] },
        { name: 'text', label: 'Of vul zelf iets in', placeholder: 'bv. uit eten, bij familie, restjes' },
        ...(meal === 'avond' ? [{ name: 'portions', label: 'Aantal porties koken (voor restjes)', type: 'number', half: true }] : []),
      ],
      values: { recipe: current.recipe || '', text: current.text || '', portions: current.portions || 1 },
      onSubmit(v) {
        const next = v.text ? { text: v.text } : v.recipe ? { recipe: v.recipe } : null;
        if (next && next.recipe && meal === 'avond') Object.assign(next, { cook: true, portions: Math.max(1, Math.round(v.portions || 1)) });
        day[meal] = next;
        // Restjes die naar dit gerecht verwezen, volgen de wijziging
        if (meal === 'avond') for (const d of plan.days) if (d.avond && d.avond.leftoverOf === date) d.avond = next && next.recipe ? { recipe: next.recipe, leftoverOf: date } : null;
        store.saveMealPlan(ws, plan);
      },
    });
  }

  function openPrefs() {
    const p = prefs();
    form.open({
      title: 'Voorkeuren weekmenu',
      fields: [
        { name: 'diet', label: 'Eetpatroon', type: 'select', half: true, options: [['alles', 'Alles'], ['pescotarisch', 'Pescotarisch (wel vis, geen vlees)'], ['vegetarisch', 'Vegetarisch'], ['veganistisch', 'Veganistisch']] },
        { name: 'persons', label: 'Aantal personen', type: 'number', half: true },
        { name: 'noPork', label: 'Geen varkensvlees', type: 'checkbox' },
        { name: 'avoid', label: 'Allergieën of dingen die je niet eet (naast je profiel)', placeholder: 'bv. kiwi, champignons, pinda', help: `Uit je profiel: ${store.data.profile.allergies || 'geen allergieën ingevuld'}` },
        { name: 'cookDays', label: 'Op welke dagen kook je?', type: 'multi', options: SHORT, help: 'Op de andere dagen eet je restjes (als het gerecht dat toelaat).' },
        { name: 'workdays', label: 'Drukke dagen (werk/school)', type: 'multi', options: SHORT },
        { name: 'maxMinutes', label: 'Max. kooktijd op drukke dagen (min)', type: 'number', half: true },
        { name: 'dinnerTime', label: 'Hoe laat eet je?', type: 'time', half: true },
        { name: 'cookReminder', label: 'Herinner me wanneer ik moet beginnen met koken', type: 'checkbox' },
      ],
      values: p,
      onSubmit(v) {
        store.saveSettings({ meal: v });
        if (v.cookReminder && !(store.data.settings.notify && HT.reminders.permission() === 'granted')) setTimeout(() => HT.reminders.enable());
        ui.toast('Voorkeuren opgeslagen – maak een nieuw schema om ze te gebruiken');
      },
    });
  }

  function openOwnRecipe(r) {
    const labels = Object.entries(R.ALLERGENS).map(([k, a]) => [k, a.label]);
    form.open({
      title: r ? 'Eigen recept bewerken' : 'Eigen recept toevoegen',
      fields: [
        { name: 'name', label: 'Naam', required: true },
        { name: 'meal', label: 'Maaltijd', type: 'select', half: true, options: [['avond', 'Avondeten'], ['lunch', 'Lunch'], ['ontbijt', 'Ontbijt']] },
        { name: 'minutes', label: 'Bereidingstijd (min)', type: 'number', half: true, required: true },
        { name: 'ingredients', label: 'Ingrediënten per portie', type: 'results', emptyRows: 4,
          columns: [{ k: 'name', label: 'Ingrediënt', placeholder: 'bv. Broccoli' }, { k: 'qty', label: 'Hoeveel', num: true }, { k: 'unit', label: 'Eenheid', placeholder: 'g / ml / stuk' }] },
        { name: 'steps', label: 'Bereiding', type: 'textarea' },
        { name: 'tags', label: 'Kenmerken', type: 'multi', options: TAGS },
        { name: 'allergens', label: 'Bevat allergenen', type: 'multi', options: labels.map((x) => x[1]), help: 'De app herkent ook zelf veel allergenen in de ingrediënten.' },
        { name: 'veg', label: 'Groente per portie (gram)', type: 'number', half: true },
        { name: 'keeps', label: 'Dagen houdbaar in koelkast', type: 'number', half: true },
      ],
      values: r ? Object.assign({}, r, { allergens: (r.allergens || []).map((a) => R.ALLERGENS[a].label) }) : { meal: 'avond', minutes: 30, keeps: 1 },
      onSubmit(v) {
        v.allergens = (v.allergens || []).map((label) => labels.find((x) => x[1] === label)[0]);
        v.ingredients = (v.ingredients || []).map((i) => ({ name: i.name, qty: i.qty || 1, unit: i.unit || 'stuk', cat: 'Overig' }));
        if (!v.ingredients.length) return 'Vul minstens één ingrediënt in.';
        store.upsert('recipes', Object.assign({ id: r ? r.id : `eigen-${uid()}`, own: true }, v));
        ui.toast('Recept opgeslagen');
      },
      onDelete: r ? () => store.remove('recipes', r.id) : null,
    });
  }

  function shoppingHtml(ws, plan) {
    const list = R.shoppingList(plan, allRecipes(), Number(prefs().persons) || 1);
    const checked = new Set((store.data.settings.shopping || {})[ws] || []);
    const groups = {};
    for (const i of list) (groups[i.cat] = groups[i.cat] || []).push(i);
    return { list, html: Object.entries(groups).map(([cat, items]) => `<h3>${esc(cat)}</h3><ul class="shop-list">${items.map((i) => {
      const key = `${i.name}|${i.unit}`;
      return `<li><label><input type="checkbox" data-shop="${esc(key)}"${checked.has(key) ? ' checked' : ''}> ${esc(formatNum(i.qty))} ${esc(i.unit)} ${esc(i.name)}</label></li>`;
    }).join('')}</ul>`).join('') };
  }

  function showShopping(ws, plan) {
    const { list, html } = shoppingHtml(ws, plan);
    ui.message('🛒 Boodschappenlijst', `${list.length ? html : '<p class="muted">Nog niets – maak eerst een weekmenu.</p>'}
      <div class="button-row"><button class="btn ghost" data-copy>📋 Kopiëren</button>${navigator.share ? '<button class="btn ghost" data-share>📤 Delen</button>' : ''}</div>
      <p class="muted small">Voor ${prefs().persons} persoon/personen, inclusief porties voor restjes. Kijk ook wat je al in huis hebt.</p>`);
    const dialog = document.getElementById('form-dialog');
    const text = list.map((i) => `☐ ${formatNum(i.qty)} ${i.unit} ${i.name}`).join('\n');
    dialog.querySelectorAll('[data-shop]').forEach((c) => c.addEventListener('change', () => {
      const all = Object.assign({}, store.data.settings.shopping || {});
      const set = new Set(all[ws] || []);
      if (c.checked) set.add(c.dataset.shop); else set.delete(c.dataset.shop);
      all[ws] = [...set];
      store.saveSettings({ shopping: all }, true); // stil opslaan: de lijst blijft open
    }));
    const copy = dialog.querySelector('[data-copy]');
    if (copy) copy.addEventListener('click', () => { navigator.clipboard && navigator.clipboard.writeText(text).then(() => ui.toast('Gekopieerd')); });
    const share = dialog.querySelector('[data-share]');
    if (share) share.addEventListener('click', () => navigator.share({ title: 'Boodschappenlijst', text }).catch(() => {}));
  }

  function markEaten(date, meal) {
    const plan = planFor(weekStart(date));
    const m = plan && plan.days.find((d) => d.date === date)[meal];
    if (!m) return;
    const r = m.recipe && recipeById(m.recipe);
    const mealName = { ontbijt: 'Ontbijt', lunch: 'Lunch', avond: 'Avondeten' }[meal];
    store.upsert('food', { date, time: nowTime(), meal: mealName, what: r ? r.name : m.text, amount: 'Normaal', fromPlan: true });
    ui.toast('In je eetdagboek gezet');
  }

  /** Kaart voor het startscherm: wat eet je vandaag, en moet je koken? */
  function cardHtml(today) {
    const plan = planFor(weekStart(today));
    if (!plan) return '';
    const d = plan.days.find((x) => x.date === today);
    if (!d) return '';
    return `<section class="card">
      <div class="card-head"><h2>🍽️ Vandaag eten</h2><a href="#/weekmenu">Weekmenu</a></div>
      ${R.MEALS.map((meal) => mealHtml(d, meal, true)).join('')}
    </section>`;
  }

  function bind(el, ws) {
    el.querySelectorAll('[data-recipe]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); showRecipe(a.dataset.recipe, Number(a.dataset.portions) || 1); }));
    el.querySelectorAll('[data-change]').forEach((b) => b.addEventListener('click', () => {
      const [date, meal] = b.dataset.change.split('|');
      changeMeal(ws || weekStart(date), date, meal);
    }));
    el.querySelectorAll('[data-eaten]').forEach((b) => b.addEventListener('click', () => { const [date, meal] = b.dataset.eaten.split('|'); markEaten(date, meal); }));
  }

  function render(el) {
    const today = todayISO();
    const ws = currentWeek();
    const plan = planFor(ws);
    const p = prefs();
    const prof = profile();
    const allergyText = [...prof.allergens.map((a) => R.ALLERGENS[a].label), ...prof.words];
    const summary = plan ? R.weekSummary(plan, allRecipes()) : null;
    const own = store.list('recipes');

    el.innerHTML = `
      ${ui.pageHead('Weekmenu')}
      <div class="week-nav">
        <button class="btn small ghost" data-week="-1" aria-label="Vorige week">◀</button>
        <strong>Week van ${esc(formatDateShort(ws))}${offset === 0 ? ' (deze week)' : offset === 1 ? ' (volgende week)' : ''}</strong>
        <button class="btn small ghost" data-week="1" aria-label="Volgende week">▶</button>
      </div>
      <div class="button-row sport-add">
        <button class="btn primary" data-generate>${plan ? '🔄 Ander schema' : '✨ Maak een schema voor mij'}</button>
        <button class="btn ghost" data-prefs>⚙️ Voorkeuren</button>
        ${plan ? '<button class="btn ghost" data-shopping>🛒 Boodschappen</button>' : ''}
      </div>

      <section class="card allergy-card">
        ${allergyText.length ? `<p>⚠️ Rekening gehouden met: <strong>${esc(allergyText.join(', '))}</strong></p>` : '<p>Geen allergieën ingevuld. Vul ze in bij je <a href="#/profiel">profiel</a> of bij ⚙️ Voorkeuren, dan houdt het schema er rekening mee.</p>'}
        <p class="muted small">${esc({ alles: 'Eet alles', pescotarisch: 'Pescotarisch', vegetarisch: 'Vegetarisch', veganistisch: 'Veganistisch' }[p.diet])} · koken op ${esc((p.cookDays || []).join(', ') || 'elke dag')} · ${p.persons} pers. · eten om ${esc(p.dinnerTime)}</p>
      </section>

      ${plan ? `
        <section class="card">
          <h2>Deze week volgens de Schijf van Vijf</h2>
          <ul class="pills">
            <li>🐟 ${summary.vis}× vis</li><li>🫘 ${summary.peulvruchten}× peulvruchten</li><li>🌱 ${summary.vegetarisch}× vegetarisch</li>
            <li>🥦 ± ${summary.vegPerDay} g groente/dag</li><li>🍳 ${summary.cookDays}× koken</li>
          </ul>
          <p class="muted small">Advies: 1× per week vis (liefst vette vis), wekelijks peulvruchten, 250 g groente per dag en af en toe vegetarisch.${p.diet === 'vegetarisch' || p.diet === 'veganistisch' ? '' : summary.vis ? '' : ' Deze week zit er geen vis in.'}</p>
        </section>
        ${plan.days.map((d, i) => {
          const isToday = d.date === today;
          return `<article class="card item day-plan${isToday ? ' upcoming' : ''}">
            <div class="item-head"><h3>${R.DAY_NAMES[i]} ${esc(formatDateShort(d.date))}</h3>${isToday ? ui.badge('Vandaag', 'info') : ''}${d.avond && d.avond.cook ? '<span class="badge">🍳 kookdag</span>' : ''}</div>
            ${R.MEALS.map((meal) => mealHtml(d, meal, isToday)).join('')}
          </article>`;
        }).join('')}`
      : ui.empty('Nog geen weekmenu voor deze week. Stel je voorkeuren in en laat de app een gezond schema maken – met restjes op de dagen dat je niet kookt.')}

      <section class="card">
        <details>
          <summary><strong>📖 Recepten (${allRecipes().length})</strong></summary>
          <div class="button-row" style="margin:10px 0"><button class="btn small ghost" data-own>+ Eigen recept</button></div>
          ${R.MEALS.map((meal) => `<h3>${R.MEAL_LABEL[meal]}</h3><ul class="recipe-list">${allRecipes().filter((r) => r.meal === meal).map((r) => {
            const c = R.checkRecipe(r, prof);
            return `<li><a href="#" data-recipe="${esc(r.id)}">${esc(r.name)}</a> <small class="muted">⏱ ${r.minutes} min</small> ${!c.ok ? ui.badge(`⚠️ ${[...c.allergens, ...c.words].join(', ')}`, 'bad') : ''}${r.own ? ` <button class="btn small ghost" data-own-edit="${esc(r.id)}">Bewerken</button>` : ''}</li>`;
          }).join('')}</ul>`).join('')}
        </details>
      </section>
      <p class="muted small">Het schema is een hulpmiddel. Heb je een ernstige voedselallergie, een dieet of een aandoening? Volg het advies van je arts of diëtist, en controleer altijd de etiketten.</p>`;

    el.querySelectorAll('[data-week]').forEach((b) => b.addEventListener('click', () => { offset += Number(b.dataset.week); render(el); }));
    el.querySelector('[data-generate]').addEventListener('click', () => {
      if (plan && !confirm('Het huidige schema van deze week vervangen door een nieuw schema?')) return;
      generate(ws);
    });
    el.querySelector('[data-prefs]').addEventListener('click', openPrefs);
    const shop = el.querySelector('[data-shopping]');
    if (shop) shop.addEventListener('click', () => showShopping(ws, plan));
    el.querySelector('[data-own]').addEventListener('click', () => openOwnRecipe());
    el.querySelectorAll('[data-own-edit]').forEach((b) => b.addEventListener('click', () => openOwnRecipe(store.get('recipes', b.dataset.ownEdit))));
    bind(el, ws);
  }

  /** Voor de kookherinnering: moet er vandaag gekookt worden, en vanaf hoe laat? */
  function cookToday(today) {
    const plan = planFor(weekStart(today));
    const d = plan && plan.days.find((x) => x.date === today);
    if (!d || !d.avond || !d.avond.cook) return null;
    const r = recipeById(d.avond.recipe);
    return r ? { recipe: r, start: cookStart(r), dinner: prefs().dinnerTime } : null;
  }

  HT.views.mealplan = { title: 'Weekmenu', render, cardHtml, bind, cookToday, profile, prefs };
})(window.HT);
