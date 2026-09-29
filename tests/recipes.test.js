const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../js/recipes.js');

const DATES = ['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04'];
const byId = Object.fromEntries(R.RECIPES.map((r) => [r.id, r]));

test('recepten zijn compleet en allergenen bestaan', () => {
  for (const r of R.RECIPES) {
    assert.ok(r.id && r.name && R.MEALS.includes(r.meal) && r.minutes > 0 && r.ingredients.length && r.steps, r.id);
    for (const a of r.allergens) assert.ok(R.ALLERGENS[a], `${r.id}: onbekend allergeen ${a}`);
  }
  assert.equal(new Set(R.RECIPES.map((r) => r.id)).size, R.RECIPES.length, 'unieke ids');
});

test('allergieën uit vrije tekst', () => {
  const p = R.parseAllergies('Penicilline, noten, lactose-intolerant', 'kiwi; garnalen');
  assert.deepEqual(p.allergens.sort(), ['melk', 'noten', 'schaaldieren']);
  assert.deepEqual(p.words, ['kiwi']);
  assert.deepEqual(R.parseAllergies('').allergens, []);
  assert.deepEqual(R.parseAllergies('Pinda').allergens, ['pinda']);
  assert.deepEqual(R.parseAllergies('hooikoorts, huisstofmijt').words, []);
});

test('receptcontrole: getagde allergenen, ingrediënten en eigen woorden', () => {
  const prof = R.parseAllergies('noten, kiwi');
  assert.deepEqual(R.checkRecipe(byId['havermout-appel'], prof).allergens, ['noten']);
  assert.equal(R.checkRecipe(byId['zalm-broccoli'], prof).ok, true);
  const own = { name: 'Fruitsalade', allergens: [], ingredients: [{ name: 'Kiwi' }, { name: 'Walnoten' }] };
  const c = R.checkRecipe(own, prof);
  assert.deepEqual(c.allergens, ['noten']);
  assert.deepEqual(c.words, ['kiwi']);
  // 'noot' mag niet matchen op nootmuskaat
  assert.equal(R.checkRecipe({ name: 'x', allergens: [], ingredients: [{ name: 'Nootmuskaat' }] }, R.parseAllergies('noot')).ok, true);
});

test('weekmenu: kookdagen, restjes, geen allergenen, dieet', () => {
  const profile = R.parseAllergies('noten, melk');
  const prefs = { diet: 'alles', cookDays: [0, 2, 4, 5], workdays: [0, 1, 2, 3, 4], maxMinutes: 30 };
  const plan = R.generatePlan({ recipes: R.RECIPES, dates: DATES, prefs, profile, seed: 7 });
  assert.equal(plan.days.length, 7);
  for (const d of plan.days) {
    for (const meal of R.MEALS) {
      assert.ok(d[meal], `${d.date} ${meal} leeg`);
      assert.ok(R.checkRecipe(byId[d[meal].recipe], profile).ok, `${d[meal].recipe} bevat allergeen`);
    }
  }
  // kookdagen ma, wo, vr, za → di en do zijn restjes (als het recept houdbaar is) of snel koken
  assert.ok(plan.days[0].avond.cook);
  assert.ok(plan.days[2].avond.cook);
  const leftovers = plan.days.filter((d) => d.avond.leftoverOf);
  for (const l of leftovers) {
    const src = plan.days.find((d) => d.date === l.avond.leftoverOf);
    assert.equal(src.avond.recipe, l.avond.recipe);
    assert.ok(src.avond.portions >= 2);
  }
  // doordeweeks niet langer dan 30 min koken als dat kan
  for (const i of [0, 1, 2, 3, 4]) {
    const a = plan.days[i].avond;
    if (a.cook) assert.ok(byId[a.recipe].minutes <= 30, `${a.recipe} te lang op werkdag`);
  }
  const s = R.weekSummary(plan, R.RECIPES);
  assert.ok(s.vis >= 1, 'minstens 1× vis');
  assert.ok(s.peulvruchten >= 1, 'minstens 1× peulvruchten');
});

test('vegetarisch en veganistisch menu', () => {
  const profile = R.parseAllergies('');
  for (const diet of ['vegetarisch', 'veganistisch']) {
    const plan = R.generatePlan({ recipes: R.RECIPES, dates: DATES, prefs: { diet, cookDays: [0, 1, 2, 3, 4, 5, 6] }, profile, seed: 3 });
    for (const d of plan.days) for (const meal of R.MEALS) assert.ok(R.fitsDiet(byId[d[meal].recipe], diet), `${diet}: ${d[meal].recipe}`);
  }
});

test('ander zaadje geeft een ander menu', () => {
  const args = { recipes: R.RECIPES, dates: DATES, prefs: { diet: 'alles', cookDays: [0, 1, 2, 3, 4, 5, 6] }, profile: R.parseAllergies('') };
  const a = R.generatePlan({ ...args, seed: 1 }).days.map((d) => d.avond.recipe).join();
  const b = R.generatePlan({ ...args, seed: 2 }).days.map((d) => d.avond.recipe).join();
  assert.notEqual(a, b);
  assert.equal(a, R.generatePlan({ ...args, seed: 1 }).days.map((d) => d.avond.recipe).join(), 'reproduceerbaar');
});

test('boodschappenlijst telt porties en personen, restjes niet dubbel', () => {
  const plan = { days: [
    { date: DATES[0], avond: { recipe: 'linzen-bolognese', cook: true, portions: 2 } },
    { date: DATES[1], avond: { recipe: 'linzen-bolognese', leftoverOf: DATES[0] } },
    { date: DATES[2], ontbijt: { recipe: 'brood-pindakaas' }, lunch: { recipe: 'brood-ei' } },
  ] };
  const list = R.shoppingList(plan, R.RECIPES, 2);
  const get = (n) => list.find((x) => x.name === n);
  assert.equal(get('Volkoren pasta').qty, 80 * 2 * 2);
  assert.equal(get('Volkorenbrood').qty, 4 + 4);
  assert.equal(get('Volkorenbrood').unit, 'sneetje');
  assert.equal(list[0].cat, 'Groente & fruit');
});

test('samenstellingen en uitzonderingen', () => {
  const p = R.parseAllergies('noten, melk, vis, ei');
  assert.deepEqual(R.allergensInText('Walnoten en hazelnootpasta', p), ['noten']);
  assert.deepEqual(R.allergensInText('Curry met kokosmelk en nootmuskaat', p), []);
  assert.deepEqual(R.allergensInText('Brood met pindakaas', p), []);
  assert.deepEqual(R.allergensInText('Halfvolle melk', p), ['melk']);
  assert.deepEqual(R.allergensInText('Zalmfilet met prei', p), ['vis']);
  assert.deepEqual(R.allergensInText('Gebakken ei', p), ['ei']);
});

test('boterham en sojayoghurt zijn geen melk', () => {
  const p = R.parseAllergies('melk');
  assert.deepEqual(R.allergensInText('Volkoren boterham met sojayoghurt', p), []);
  const ok = R.RECIPES.filter((r) => R.checkRecipe(r, p).ok).map((r) => r.id);
  for (const id of ['brood-pindakaas', 'omelet-spinazie', 'soja-yoghurt', 'tomatensoep', 'brood-ei']) assert.ok(ok.includes(id), id);
});
