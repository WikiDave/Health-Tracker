const test = require('node:test');
const assert = require('node:assert/strict');
const { scoreQuestionnaire, QUESTIONNAIRES } = require('../js/questionnaires.js');

test('vragenlijsten hebben het juiste aantal vragen', () => {
  assert.equal(QUESTIONNAIRES.phq9.questions.length, 9);
  assert.equal(QUESTIONNAIRES.gad7.questions.length, 7);
});

test('PHQ-9 scores en niveaus', () => {
  assert.equal(scoreQuestionnaire('phq9', [0, 0, 0, 0, 0, 0, 0, 0, 0]).level, 'Minimaal');
  const r = scoreQuestionnaire('phq9', [1, 1, 1, 1, 1, 1, 1, 1, 0]);
  assert.equal(r.score, 8);
  assert.equal(r.level, 'Licht');
  assert.equal(r.adviseDoctor, false);
  assert.equal(scoreQuestionnaire('phq9', [2, 2, 2, 2, 2, 0, 0, 0, 0]).level, 'Matig');
  assert.equal(scoreQuestionnaire('phq9', [3, 3, 3, 3, 3, 3, 3, 3, 3]).level, 'Ernstig');
});

test('PHQ-9 vraag 9 geeft altijd een signaal, ook bij lage totaalscore', () => {
  const r = scoreQuestionnaire('phq9', [0, 0, 0, 0, 0, 0, 0, 0, 1]);
  assert.equal(r.selfHarm, true);
  assert.equal(r.adviseDoctor, true);
  assert.equal(r.kind, 'bad');
});

test('GAD-7 scores en onvolledige invoer', () => {
  assert.equal(scoreQuestionnaire('gad7', [3, 3, 3, 3, 3, 0, 0]).level, 'Ernstig');
  assert.equal(scoreQuestionnaire('gad7', [2, 2, 2, 2, 2, 0, 0]).level, 'Matig');
  assert.equal(scoreQuestionnaire('gad7', [1, 1, 1]), null);
  assert.equal(scoreQuestionnaire('gad7', [1, 1, 1, 1, 1, 1, null]), null);
  assert.equal(scoreQuestionnaire('onbekend', []), null);
});
