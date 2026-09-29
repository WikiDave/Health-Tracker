/* Recepten en weekmenu: gezonde basisrecepten (Schijf van Vijf), allergie-controle (14 EU-allergenen),
 * een weekmenu-generator die rekening houdt met kookdagen en restjes, en een boodschappenlijst.
 * Werkt in de browser (HT.recipes) en in Node (tests). */
(function (root) {
  'use strict';

  // De 14 allergenen die in de EU op het etiket moeten staan, met woorden om ze in tekst te herkennen.
  const ALLERGENS = {
    gluten: { label: 'gluten', words: ['gluten', 'tarwe', 'spelt', 'rogge', 'gerst', 'coeliakie', 'glutenintolerantie'] },
    schaaldieren: { label: 'schaaldieren', words: ['schaaldier', 'garnaal', 'garnalen', 'kreeft', 'krab', 'langoustine'] },
    ei: { label: 'ei', words: ['ei', 'eieren', 'eiwit', 'eigeel', 'kippenei'] },
    vis: { label: 'vis', words: ['vis', 'zalm', 'tonijn', 'kabeljauw', 'makreel', 'haring'] },
    pinda: { label: 'pinda', words: ['pinda', "pinda's", 'pindas', 'pindakaas', 'aardnoot'] },
    soja: { label: 'soja', words: ['soja', 'sojabonen', 'tofu', 'tempeh', 'edamame'] },
    melk: { label: 'melk', words: ['melk', 'lactose', 'zuivel', 'koemelk', 'koemelkeiwit', 'kaas', 'yoghurt', 'kwark', 'boter', 'room'] },
    noten: { label: 'noten', words: ['noot', 'noten', 'hazelnoot', 'walnoot', 'amandel', 'cashew', 'pecannoot', 'pistache', 'macadamia', 'paranoot'] },
    selderij: { label: 'selderij', words: ['selderij', 'bleekselderij', 'knolselderij'] },
    mosterd: { label: 'mosterd', words: ['mosterd'] },
    sesam: { label: 'sesam', words: ['sesam', 'tahin', 'tahini'] },
    sulfiet: { label: 'sulfiet', words: ['sulfiet', 'sulfieten', 'zwaveldioxide'] },
    lupine: { label: 'lupine', words: ['lupine'] },
    weekdieren: { label: 'weekdieren', words: ['weekdier', 'mossel', 'mosselen', 'oester', 'inktvis', 'octopus', 'slak'] },
  };

  // Hulpje: ingrediënt [naam, hoeveelheid per portie, eenheid, categorie]
  const I = (name, qty, unit, cat) => ({ name, qty, unit, cat });
  const G = 'Groente & fruit';
  const Z = 'Zuivel & eieren';
  const V = 'Vlees, vis & vega';
  const B = 'Brood, pasta & granen';
  const H = 'Houdbaar & blik';
  const K = 'Kruiden & overig';

  /** Basisrecepten, hoeveelheden per portie. tags: vegetarisch, vegan, vis, vlees, peulvruchten, snel, meal-prep.
   *  keeps: hoeveel dagen restjes goed blijven in de koelkast. veg: gram groente per portie. */
  const RECIPES = [
    // Ontbijt
    { id: 'havermout-appel', name: 'Havermout met appel en kaneel', meal: 'ontbijt', minutes: 10, veg: 0, tags: ['vegetarisch', 'snel'], allergens: ['gluten', 'melk', 'noten'],
      ingredients: [I('Havermout', 50, 'g', B), I('Halfvolle melk', 250, 'ml', Z), I('Appel', 1, 'stuk', G), I('Walnoten', 10, 'g', H), I('Kaneel', 1, 'snufje', K)],
      steps: 'Kook de havermout 3–5 minuten in de melk. Rasp of snijd de appel erdoor. Bestrooi met kaneel en gehakte walnoten.' },
    { id: 'brood-kaas-tomaat', name: 'Volkoren boterhammen met kaas en tomaat', meal: 'ontbijt', minutes: 5, veg: 60, tags: ['vegetarisch', 'snel'], allergens: ['gluten', 'melk'],
      ingredients: [I('Volkorenbrood', 2, 'sneetje', B), I('30+ kaas', 1, 'plak', Z), I('Tomaat', 1, 'stuk', G), I('Zachte halvarine', 5, 'g', Z)],
      steps: 'Besmeer het brood dun, beleg met kaas en plakjes tomaat.' },
    { id: 'kwark-fruit', name: 'Magere kwark met fruit en muesli', meal: 'ontbijt', minutes: 5, veg: 0, tags: ['vegetarisch', 'snel'], allergens: ['melk', 'gluten'],
      ingredients: [I('Magere kwark', 150, 'g', Z), I('Blauwe bessen', 75, 'g', G), I('Ongezoete muesli', 30, 'g', B)],
      steps: 'Schep de kwark in een kom en bestrooi met bessen en muesli.' },
    { id: 'brood-pindakaas', name: 'Volkoren boterhammen met pindakaas en banaan', meal: 'ontbijt', minutes: 5, veg: 0, tags: ['vegetarisch', 'vegan', 'snel'], allergens: ['gluten', 'pinda'],
      ingredients: [I('Volkorenbrood', 2, 'sneetje', B), I('Pindakaas (100% pinda)', 15, 'g', H), I('Banaan', 1, 'stuk', G)],
      steps: 'Besmeer het brood met pindakaas en beleg met plakjes banaan.' },
    { id: 'omelet-spinazie', name: 'Omelet met spinazie en een volkoren boterham', meal: 'ontbijt', minutes: 10, veg: 75, tags: ['vegetarisch', 'snel'], allergens: ['ei', 'gluten'],
      ingredients: [I('Eieren', 2, 'stuk', Z), I('Spinazie', 75, 'g', G), I('Volkorenbrood', 1, 'sneetje', B), I('Olijfolie', 1, 'tl', K)],
      steps: 'Laat de spinazie slinken in een pan met wat olie. Klop de eieren los, giet erover en bak tot de omelet gestold is.' },
    { id: 'soja-yoghurt', name: 'Sojayoghurt met havermout en peer', meal: 'ontbijt', minutes: 5, veg: 0, tags: ['vegetarisch', 'vegan', 'snel'], allergens: ['soja', 'gluten'],
      ingredients: [I('Ongezoete sojayoghurt', 150, 'g', Z), I('Havermout', 30, 'g', B), I('Peer', 1, 'stuk', G)],
      steps: 'Meng de yoghurt met de havermout en de stukjes peer.' },
    // Lunch
    { id: 'wrap-hummus', name: 'Volkoren wrap met hummus en rauwkost', meal: 'lunch', minutes: 10, veg: 125, tags: ['vegetarisch', 'vegan', 'snel'], allergens: ['gluten', 'sesam'],
      ingredients: [I('Volkoren wrap', 1, 'stuk', B), I('Hummus', 40, 'g', H), I('Wortel', 1, 'stuk', G), I('Komkommer', 0.25, 'stuk', G), I('Sla', 1, 'handje', G)],
      steps: 'Besmeer de wrap met hummus, beleg met geraspte wortel, reepjes komkommer en sla. Oprollen.' },
    { id: 'linzensoep', name: 'Rode linzensoep', meal: 'lunch', minutes: 30, veg: 150, keeps: 3, tags: ['vegetarisch', 'vegan', 'peulvruchten', 'meal-prep'], allergens: ['selderij'],
      ingredients: [I('Rode linzen', 60, 'g', H), I('Ui', 0.5, 'stuk', G), I('Wortel', 1, 'stuk', G), I('Bleekselderij', 1, 'stengel', G), I('Tomatenblokjes (blik)', 100, 'g', H), I('Groentebouillon (zoutarm)', 300, 'ml', H), I('Komijn', 1, 'tl', K)],
      steps: 'Fruit ui en groente, voeg linzen, tomaat, komijn en bouillon toe. 20 minuten zachtjes koken en pureren. Blijft 3 dagen goed in de koelkast.' },
    { id: 'brood-ei', name: 'Volkoren boterhammen met ei en tuinkers', meal: 'lunch', minutes: 10, veg: 60, tags: ['vegetarisch', 'snel'], allergens: ['ei', 'gluten'],
      ingredients: [I('Volkorenbrood', 2, 'sneetje', B), I('Eieren', 1, 'stuk', Z), I('Tomaat', 1, 'stuk', G), I('Tuinkers', 1, 'handje', G)],
      steps: 'Kook het ei 8 minuten, pel en snijd in plakjes. Beleg het brood met ei, tomaat en tuinkers.' },
    { id: 'salade-kikkererwt', name: 'Salade met kikkererwten en feta', meal: 'lunch', minutes: 10, veg: 175, keeps: 1, tags: ['vegetarisch', 'peulvruchten', 'snel'], allergens: ['melk'],
      ingredients: [I('Kikkererwten (blik)', 100, 'g', H), I('Komkommer', 0.5, 'stuk', G), I('Cherrytomaten', 100, 'g', G), I('Rode ui', 0.25, 'stuk', G), I('Feta', 30, 'g', Z), I('Olijfolie', 1, 'el', K)],
      steps: 'Spoel de kikkererwten af. Meng met de gesneden groente, verkruimelde feta en olijfolie.' },
    { id: 'brood-zalm', name: 'Volkoren boterhammen met zalm en komkommer', meal: 'lunch', minutes: 5, veg: 50, tags: ['vis', 'snel'], allergens: ['vis', 'gluten', 'melk'],
      ingredients: [I('Volkorenbrood', 2, 'sneetje', B), I('Gerookte zalm', 40, 'g', V), I('Light roomkaas', 15, 'g', Z), I('Komkommer', 0.25, 'stuk', G)],
      steps: 'Besmeer het brood met roomkaas en beleg met zalm en plakjes komkommer.' },
    { id: 'tomatensoep', name: 'Tomatensoep met een volkoren boterham', meal: 'lunch', minutes: 25, veg: 200, keeps: 3, tags: ['vegetarisch', 'vegan', 'meal-prep'], allergens: ['gluten', 'selderij'],
      ingredients: [I('Tomaten', 250, 'g', G), I('Ui', 0.5, 'stuk', G), I('Knoflook', 1, 'teen', G), I('Groentebouillon (zoutarm)', 250, 'ml', H), I('Volkorenbrood', 1, 'sneetje', B)],
      steps: 'Fruit ui en knoflook, voeg tomaten en bouillon toe, 15 minuten koken en pureren.' },
    // Avondeten
    { id: 'zalm-broccoli', name: 'Zalm met broccoli en zilvervliesrijst', meal: 'avond', minutes: 25, veg: 200, keeps: 1, tags: ['vis'], allergens: ['vis'],
      ingredients: [I('Zalmfilet', 125, 'g', V), I('Broccoli', 200, 'g', G), I('Zilvervliesrijst', 70, 'g', B), I('Citroen', 0.5, 'stuk', G)],
      steps: 'Kook de rijst. Stoom de broccoli 5–6 minuten. Bak de zalm 3–4 minuten per kant en besprenkel met citroen.' },
    { id: 'linzen-bolognese', name: 'Volkorenpasta met linzen-bolognese', meal: 'avond', minutes: 30, veg: 250, keeps: 3, tags: ['vegetarisch', 'vegan', 'peulvruchten', 'meal-prep'], allergens: ['gluten'],
      ingredients: [I('Volkoren pasta', 80, 'g', B), I('Rode linzen', 40, 'g', H), I('Tomatenblokjes (blik)', 200, 'g', H), I('Ui', 0.5, 'stuk', G), I('Wortel', 1, 'stuk', G), I('Courgette', 100, 'g', G), I('Italiaanse kruiden', 1, 'tl', K)],
      steps: 'Fruit ui, voeg wortel en courgette toe. Linzen, tomaat en kruiden erbij, 20 minuten sudderen. Serveer met pasta. Saus is prima in te vriezen.' },
    { id: 'kip-ovengroente', name: 'Kip met ovengroente en krieltjes', meal: 'avond', minutes: 40, veg: 250, keeps: 2, tags: ['vlees'], allergens: [],
      ingredients: [I('Kipfilet', 100, 'g', V), I('Krieltjes', 200, 'g', G), I('Paprika', 1, 'stuk', G), I('Courgette', 100, 'g', G), I('Rode ui', 0.5, 'stuk', G), I('Olijfolie', 1, 'el', K)],
      steps: 'Snijd alles in stukjes, meng met olie en kruiden en rooster 30 minuten op 200 °C. Actief bezig: 10 minuten.' },
    { id: 'chili-sin-carne', name: 'Chili sin carne met zilvervliesrijst', meal: 'avond', minutes: 30, veg: 200, keeps: 3, tags: ['vegetarisch', 'vegan', 'peulvruchten', 'meal-prep'], allergens: [],
      ingredients: [I('Kidneybonen (blik)', 100, 'g', H), I('Maïs (blik)', 50, 'g', H), I('Paprika', 1, 'stuk', G), I('Ui', 0.5, 'stuk', G), I('Tomatenblokjes (blik)', 150, 'g', H), I('Zilvervliesrijst', 70, 'g', B), I('Chilipoeder en komijn', 1, 'tl', K)],
      steps: 'Fruit ui en paprika, voeg kruiden, bonen, maïs en tomaat toe en laat 15 minuten sudderen. Serveer met rijst.' },
    { id: 'wok-tofu', name: 'Wokschotel met tofu en groente', meal: 'avond', minutes: 20, veg: 250, keeps: 1, tags: ['vegetarisch', 'vegan', 'snel'], allergens: ['soja', 'gluten', 'sesam'],
      ingredients: [I('Tofu', 100, 'g', V), I('Wokgroente', 250, 'g', G), I('Zilvervliesrijst', 70, 'g', B), I('Sojasaus (minder zout)', 1, 'el', K), I('Sesamzaad', 1, 'tl', K)],
      steps: 'Kook de rijst. Bak de tofu goudbruin, roerbak de groente 4 minuten, breng op smaak met sojasaus en sesam.' },
    { id: 'andijvie-stamppot', name: 'Andijviestamppot met kikkererwten', meal: 'avond', minutes: 30, veg: 200, keeps: 2, tags: ['vegetarisch', 'peulvruchten'], allergens: ['melk'],
      ingredients: [I('Aardappelen', 250, 'g', G), I('Andijvie', 200, 'g', G), I('Kikkererwten (blik)', 80, 'g', H), I('Halfvolle melk', 50, 'ml', Z), I('Nootmuskaat', 1, 'snufje', K)],
      steps: 'Kook de aardappelen, stamp met warme melk. Roer de fijngesneden andijvie en de gebakken kikkererwten erdoor.' },
    { id: 'kabeljauw-spinazie', name: 'Kabeljauw met spinazie en aardappelen', meal: 'avond', minutes: 25, veg: 250, keeps: 1, tags: ['vis'], allergens: ['vis'],
      ingredients: [I('Kabeljauwfilet', 125, 'g', V), I('Spinazie', 250, 'g', G), I('Aardappelen', 200, 'g', G), I('Citroen', 0.5, 'stuk', G)],
      steps: 'Kook de aardappelen. Laat de spinazie slinken. Bak of stoom de vis 6–8 minuten.' },
    { id: 'pasta-pesto-kip', name: 'Volkorenpasta pesto met kip en sperziebonen', meal: 'avond', minutes: 20, veg: 150, keeps: 1, tags: ['vlees', 'snel'], allergens: ['gluten', 'melk', 'noten'],
      ingredients: [I('Volkoren pasta', 80, 'g', B), I('Kipfilet', 100, 'g', V), I('Sperziebonen', 150, 'g', G), I('Groene pesto', 20, 'g', H)],
      steps: 'Kook pasta en sperziebonen. Bak de kip in reepjes. Meng alles met de pesto.' },
    { id: 'groentecurry', name: 'Groentecurry met kikkererwten en rijst', meal: 'avond', minutes: 30, veg: 250, keeps: 3, tags: ['vegetarisch', 'vegan', 'peulvruchten', 'meal-prep'], allergens: [],
      ingredients: [I('Kikkererwten (blik)', 100, 'g', H), I('Bloemkool', 150, 'g', G), I('Spinazie', 100, 'g', G), I('Currypasta', 1, 'el', K), I('Kokosmelk (light)', 100, 'ml', H), I('Zilvervliesrijst', 70, 'g', B)],
      steps: 'Bak de currypasta kort, voeg bloemkool, kikkererwten en kokosmelk toe en laat 15 minuten garen. Spinazie erdoor. Serveer met rijst.' },
    { id: 'omelet-groente', name: 'Groenteomelet met volkorenbrood', meal: 'avond', minutes: 15, veg: 175, keeps: 0, tags: ['vegetarisch', 'snel'], allergens: ['ei', 'gluten'],
      ingredients: [I('Eieren', 2, 'stuk', Z), I('Paprika', 0.5, 'stuk', G), I('Champignons', 100, 'g', G), I('Lente-ui', 1, 'stuk', G), I('Volkorenbrood', 1, 'sneetje', B)],
      steps: 'Bak de groente 5 minuten, giet de losgeklopte eieren erover en laat stollen.' },
    { id: 'gehakt-sperziebonen', name: 'Mager rundergehakt met sperziebonen en aardappelen', meal: 'avond', minutes: 30, veg: 200, keeps: 2, tags: ['vlees'], allergens: [],
      ingredients: [I('Mager rundergehakt', 100, 'g', V), I('Sperziebonen', 200, 'g', G), I('Aardappelen', 200, 'g', G)],
      steps: 'Kook aardappelen en sperziebonen. Bak het gehakt rul of draai er balletjes van.' },
    { id: 'garnalen-noedels', name: 'Roerbak met garnalen en noedels', meal: 'avond', minutes: 20, veg: 225, keeps: 1, tags: ['vis', 'snel'], allergens: ['schaaldieren', 'gluten', 'soja'],
      ingredients: [I('Garnalen', 100, 'g', V), I('Volkoren noedels', 70, 'g', B), I('Paksoi', 150, 'g', G), I('Paprika', 0.5, 'stuk', G), I('Sojasaus (minder zout)', 1, 'el', K)],
      steps: 'Kook de noedels. Roerbak garnalen en groente 4 minuten, meng met noedels en sojasaus.' },
    { id: 'zoete-aardappel-traybake', name: 'Zoete aardappel uit de oven met witte bonen en feta', meal: 'avond', minutes: 35, veg: 150, keeps: 2, tags: ['vegetarisch', 'peulvruchten'], allergens: ['melk'],
      ingredients: [I('Zoete aardappel', 200, 'g', G), I('Witte bonen (blik)', 100, 'g', H), I('Rode ui', 0.5, 'stuk', G), I('Spinazie', 75, 'g', G), I('Feta', 30, 'g', Z), I('Olijfolie', 1, 'el', K)],
      steps: 'Rooster zoete aardappel en ui 25 minuten op 200 °C, voeg bonen toe voor de laatste 5 minuten. Serveer op spinazie met feta.' },
    { id: 'kip-groentesoep', name: 'Maaltijdsoep met kip en groente', meal: 'avond', minutes: 40, veg: 200, keeps: 3, tags: ['vlees', 'meal-prep'], allergens: ['selderij', 'gluten'],
      ingredients: [I('Kipfilet', 75, 'g', V), I('Prei', 0.5, 'stuk', G), I('Wortel', 1, 'stuk', G), I('Bleekselderij', 1, 'stengel', G), I('Volkoren vermicelli', 20, 'g', B), I('Kippenbouillon (zoutarm)', 400, 'ml', H), I('Volkorenbrood', 1, 'sneetje', B)],
      steps: 'Trek bouillon met de kip, haal de kip eruit en pluk fijn. Kook groente en vermicelli 10 minuten mee. Kip terug in de soep.' },
  ];

  const MEALS = ['ontbijt', 'lunch', 'avond'];
  const MEAL_LABEL = { ontbijt: 'Ontbijt', lunch: 'Lunch', avond: 'Avondeten' };
  const DAY_NAMES = ['Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag', 'Zondag'];

  const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const wordRe = (w) => new RegExp(`(^|[^a-z])${norm(w).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^a-z])`);

  // Samengestelde woorden die op een allergeen lijken maar het niet zijn.
  const NOT_ALLERGEN = {
    melk: ['kokosmelk', 'sojamelk', 'havermelk', 'rijstmelk', 'amandelmelk', 'pindakaas', 'notenkaas', 'notenboter', 'pindaboter', 'kokosroom',
      'boterham', 'boterhammen', 'sojayoghurt', 'kokosyoghurt', 'haveryoghurt', 'sojakwark', 'plantaardige'],
    noten: ['nootmuskaat', 'kokosnoot', 'kokosnoten'],
  };

  /**
   * Komt een allergeenwoord voor in de tekst? Ook in samenstellingen (walnoten, zalmfilet),
   * maar korte woorden (ei, vis) alleen als heel woord, en met uitzonderingen (nootmuskaat, kokosmelk).
   */
  function containsWord(text, w, key) {
    const tokens = norm(text).split(/[^a-z]+/).filter(Boolean);
    const word = norm(w);
    const skip = NOT_ALLERGEN[key] || [];
    return tokens.some((t) => {
      if (skip.includes(t)) return false;
      if (t === word) return true;
      if (word.length < 4) return false;
      return t.startsWith(word) || t.endsWith(word);
    });
  }

  /**
   * Leest allergieën en dingen die je niet eet uit vrije tekst (profiel en voorkeuren).
   * @returns {{allergens:string[], words:string[]}} allergeen-sleutels en overige woorden (bv. "kiwi", "aardbei").
   */
  function parseAllergies(...texts) {
    const allergens = new Set();
    const words = new Set();
    for (const text of texts) {
      for (const part of String(text || '').split(/[,;\n/]+| en /)) {
        const p = norm(part).replace(/allergie|allergisch|voor|intolerantie|overgevoelig/g, '').trim();
        if (!p) continue;
        let hit = false;
        for (const [key, a] of Object.entries(ALLERGENS)) {
          if (a.words.some((w) => wordRe(w).test(p))) { allergens.add(key); hit = true; }
        }
        if (!hit && p.length >= 3 && !/penicilline|antibiotica|medicijn|pleister|latex|pollen|huisstof|gras|hooikoorts|wesp|bij\b/.test(p)) words.add(p);
      }
    }
    return { allergens: [...allergens], words: [...words] };
  }

  /** Controleert een recept tegen je allergieën. */
  function checkRecipe(recipe, profile) {
    const found = (recipe.allergens || []).filter((a) => profile.allergens.includes(a)).map((a) => ALLERGENS[a].label);
    const text = norm((recipe.ingredients || []).map((i) => i.name).join(' ') + ' ' + recipe.name);
    // Allergenen die niet getagd zijn maar wel in de ingrediënten staan (bv. bij eigen recepten)
    for (const key of profile.allergens) {
      if (found.includes(ALLERGENS[key].label)) continue;
      if (ALLERGENS[key].words.some((w) => containsWord(text, w, key))) found.push(ALLERGENS[key].label);
    }
    const words = profile.words.filter((w) => containsWord(text, w, null));
    return { ok: !found.length && !words.length, allergens: found, words };
  }

  function fitsDiet(recipe, diet) {
    const t = recipe.tags || [];
    if (diet === 'veganistisch') return t.includes('vegan');
    if (diet === 'vegetarisch') return t.includes('vegetarisch') || t.includes('vegan');
    if (diet === 'pescotarisch') return !t.includes('vlees');
    return true;
  }

  /** Recepten die passen bij je dieet, allergieën en (optioneel) tijd. */
  function allowed(recipes, meal, prefs, profile) {
    return recipes.filter((r) => r.meal === meal && fitsDiet(r, prefs.diet) && !(prefs.noPork && (r.tags || []).includes('varkensvlees')) && checkRecipe(r, profile).ok);
  }

  /** Voorspelbare 'willekeur' zodat 'opnieuw' een ander maar reproduceerbaar schema geeft. */
  function rng(seed) {
    let s = (seed >>> 0) || 1;
    return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }
  function shuffle(arr, rand) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }

  /**
   * Maakt een weekmenu.
   * @param {object} o
   * @param {Array} o.recipes          alle recepten
   * @param {string[]} o.dates         7 datums (ma t/m zo)
   * @param {object} o.prefs           { diet, noPork, cookDays:[0..6], workdays:[0..6], maxMinutes }
   * @param {object} o.profile         uit parseAllergies
   * @param {number} [o.seed]
   */
  function generatePlan({ recipes, dates, prefs, profile, seed = 1 }) {
    const rand = rng(seed);
    const cookDays = new Set(prefs.cookDays && prefs.cookDays.length ? prefs.cookDays : [0, 1, 2, 3, 4, 5, 6]);
    const workdays = new Set(prefs.workdays || [0, 1, 2, 3, 4]);
    const maxMin = prefs.maxMinutes || 999;
    const days = dates.map((date) => ({ date }));

    // Ontbijt en lunch: afwisselen, niet twee dagen achter elkaar hetzelfde
    for (const meal of ['ontbijt', 'lunch']) {
      const pool = shuffle(allowed(recipes, meal, prefs, profile), rand);
      days.forEach((d, i) => {
        if (!pool.length) return;
        let pick = pool[i % pool.length];
        const prev = i ? days[i - 1][meal] : null;
        if (prev && prev.recipe === pick.id && pool.length > 1) pick = pool[(i + 1) % pool.length];
        const quick = workdays.has(i) ? pool.filter((r) => r.minutes <= 10) : [];
        if (workdays.has(i) && pick.minutes > 10 && quick.length) pick = quick[i % quick.length];
        d[meal] = { recipe: pick.id };
      });
    }

    // Avondeten: koken op kookdagen, restjes op de dagen ertussen
    const dinners = allowed(recipes, 'avond', prefs, profile);
    const used = new Set();
    const counts = { vis: 0, peulvruchten: 0, vega: 0 };
    const wantFish = prefs.diet !== 'vegetarisch' && prefs.diet !== 'veganistisch' && dinners.some((r) => r.tags.includes('vis'));
    for (let i = 0; i < 7; i++) {
      if (days[i].avond) continue;
      // Hoeveel dagen tot de volgende kookdag? Die vullen we met restjes.
      let span = 1;
      while (i + span < 7 && !cookDays.has(i + span)) span++;
      const cookNow = cookDays.has(i) || !days[i].avond;
      if (!cookNow) continue;
      const limit = workdays.has(i) ? maxMin : 999;
      const score = (r) => {
        let s = rand();
        if (used.has(r.id)) s -= 5;
        if (r.minutes > limit) s -= 3;
        if (span > 1 && (r.keeps || 0) >= span - 1) s += 2;
        if (span > 1 && (r.keeps || 0) < span - 1) s -= 1;
        if (wantFish && counts.vis === 0 && r.tags.includes('vis')) s += 1.5;
        if (counts.vis >= 2 && r.tags.includes('vis')) s -= 2;
        if (counts.peulvruchten === 0 && r.tags.includes('peulvruchten')) s += 1.2;
        if (counts.vega < 2 && (r.tags.includes('vegetarisch') || r.tags.includes('vegan'))) s += 0.6;
        if (r.tags.includes('vlees') && counts.vega < 1) s -= 0.3;
        return s;
      };
      const pick = [...dinners].sort((a, b) => score(b) - score(a))[0];
      if (!pick) break;
      used.add(pick.id);
      if (pick.tags.includes('vis')) counts.vis++;
      if (pick.tags.includes('peulvruchten')) counts.peulvruchten++;
      if (pick.tags.includes('vegetarisch') || pick.tags.includes('vegan')) counts.vega++;
      const leftoverDays = Math.min(span - 1, pick.keeps || 0);
      days[i].avond = { recipe: pick.id, cook: true, portions: 1 + leftoverDays };
      for (let k = 1; k <= leftoverDays; k++) days[i + k].avond = { recipe: pick.id, leftoverOf: days[i].date };
    }
    return { days, seed };
  }

  /** Boodschappenlijst: ingrediënten van alle gerechten die gekookt/gemaakt worden, maal personen en porties. */
  function shoppingList(plan, recipes, persons = 1) {
    const byId = Object.fromEntries(recipes.map((r) => [r.id, r]));
    const items = {};
    for (const d of plan.days) {
      for (const meal of MEALS) {
        const m = d[meal];
        if (!m || !m.recipe || m.leftoverOf) continue;
        const r = byId[m.recipe];
        if (!r) continue;
        const factor = persons * (m.portions || 1);
        for (const ing of r.ingredients || []) {
          const key = `${norm(ing.name)}|${ing.unit}`;
          items[key] = items[key] || { name: ing.name, unit: ing.unit, qty: 0, cat: ing.cat || K };
          items[key].qty += (Number(ing.qty) || 0) * factor;
        }
      }
    }
    const list = Object.values(items).map((x) => Object.assign(x, { qty: Math.round(x.qty * 100) / 100 }));
    const order = [G, V, Z, B, H, K];
    return list.sort((a, b) => order.indexOf(a.cat) - order.indexOf(b.cat) || a.name.localeCompare(b.name, 'nl'));
  }

  /** Samenvatting van de week volgens de Schijf van Vijf. */
  function weekSummary(plan, recipes) {
    const byId = Object.fromEntries(recipes.map((r) => [r.id, r]));
    let vis = 0; let peul = 0; let vega = 0; let veg = 0; let cookDays = 0;
    for (const d of plan.days) {
      for (const meal of MEALS) {
        const r = d[meal] && byId[d[meal].recipe];
        if (!r) continue;
        veg += r.veg || 0;
        if (meal === 'avond') {
          if (r.tags.includes('vis')) vis++;
          if (r.tags.includes('peulvruchten')) peul++;
          if (r.tags.includes('vegetarisch') || r.tags.includes('vegan')) vega++;
          if (d.avond.cook) cookDays++;
        }
      }
    }
    return { vis, peulvruchten: peul, vegetarisch: vega, vegPerDay: Math.round(veg / 7), cookDays };
  }

  /** Welke van jouw allergieën komen voor in vrije tekst (bv. een maaltijd in je eetdagboek)? */
  function allergensInText(text, profile) {
    const hits = profile.allergens.filter((key) => ALLERGENS[key].words.some((w) => containsWord(text, w, key))).map((k) => ALLERGENS[k].label);
    return hits.concat(profile.words.filter((w) => containsWord(text, w, null)));
  }

  const api = { ALLERGENS, RECIPES, allergensInText, containsWord, MEALS, MEAL_LABEL, DAY_NAMES, CATEGORIES: [G, V, Z, B, H, K], parseAllergies, checkRecipe, fitsDiet, allowed, generatePlan, shoppingList, weekSummary };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else (root.HT = root.HT || {}).recipes = api;
})(typeof window !== 'undefined' ? window : globalThis);
