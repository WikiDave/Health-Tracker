/* Gestandaardiseerde vragenlijsten voor mentale gezondheid (zelftest, geen diagnose).
 * PHQ-9 (somberheid/depressieve klachten) en GAD-7 (angst/piekeren), beide over de afgelopen 2 weken. */
(function (root) {
  'use strict';

  const ANSWERS = [[0, 'Helemaal niet'], [1, 'Meerdere dagen'], [2, 'Meer dan de helft van de dagen'], [3, 'Bijna elke dag']];

  const QUESTIONNAIRES = {
    phq9: {
      id: 'phq9',
      name: 'PHQ-9 – somberheid',
      short: 'Somberheid (PHQ-9)',
      intro: 'Hoe vaak had je in de afgelopen 2 weken last van de volgende problemen?',
      questions: [
        'Weinig interesse in of plezier aan dingen doen',
        'Je neerslachtig, depressief of hopeloos voelen',
        'Moeite met inslapen of doorslapen, of juist te veel slapen',
        'Je moe voelen of weinig energie hebben',
        'Weinig eetlust of juist te veel eten',
        'Een slecht gevoel over jezelf, of het gevoel dat je een mislukking bent of jezelf of je naasten tekort hebt gedaan',
        'Moeite met concentreren, bijvoorbeeld bij het lezen of tv-kijken',
        'Zo traag bewegen of praten dat anderen het konden merken, of juist zo onrustig dat je veel meer bewoog dan normaal',
        'Gedachten dat je beter dood zou kunnen zijn, of gedachten om jezelf iets aan te doen',
      ],
      max: 27,
      levels: [[0, 'Minimaal', 'good'], [5, 'Licht', 'good'], [10, 'Matig', 'warn'], [15, 'Matig ernstig', 'bad'], [20, 'Ernstig', 'bad']],
    },
    gad7: {
      id: 'gad7',
      name: 'GAD-7 – angst en piekeren',
      short: 'Angst (GAD-7)',
      intro: 'Hoe vaak had je in de afgelopen 2 weken last van de volgende problemen?',
      questions: [
        'Je nerveus, angstig of gespannen voelen',
        'Niet kunnen stoppen met piekeren of het piekeren niet onder controle hebben',
        'Je te veel zorgen maken over allerlei dingen',
        'Moeite hebben om te ontspannen',
        'Zo rusteloos zijn dat stilzitten moeilijk is',
        'Snel geïrriteerd of prikkelbaar zijn',
        'Bang zijn dat er iets vreselijks gaat gebeuren',
      ],
      max: 21,
      levels: [[0, 'Minimaal', 'good'], [5, 'Licht', 'good'], [10, 'Matig', 'warn'], [15, 'Ernstig', 'bad']],
    },
  };

  /** Berekent score en niveau. Geeft null als niet alle vragen beantwoord zijn. */
  function scoreQuestionnaire(type, answers) {
    const q = QUESTIONNAIRES[type];
    if (!q || !Array.isArray(answers) || answers.length !== q.questions.length) return null;
    if (answers.some((a) => a == null || a < 0 || a > 3)) return null;
    const score = answers.reduce((s, a) => s + Number(a), 0);
    let level = q.levels[0];
    for (const l of q.levels) if (score >= l[0]) level = l;
    // PHQ-9 vraag 9 gaat over gedachten aan de dood/zelfbeschadiging: altijd serieus nemen, ook bij een lage totaalscore.
    const selfHarm = type === 'phq9' && answers[8] > 0;
    return {
      score,
      max: q.max,
      level: level[1],
      kind: selfHarm ? 'bad' : level[2],
      selfHarm,
      adviseDoctor: score >= 10 || selfHarm,
    };
  }

  const api = { QUESTIONNAIRES, ANSWERS, scoreQuestionnaire };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else (root.HT = root.HT || {}).questionnaires = api;
})(typeof window !== 'undefined' ? window : globalThis);
