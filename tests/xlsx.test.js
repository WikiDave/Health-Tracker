const test = require('node:test');
const assert = require('node:assert/strict');
const x = require('../js/xlsx.js');

test('crc32 klopt met de standaard testwaarde', () => {
  assert.equal(x.crc32(new TextEncoder().encode('123456789')), 0xcbf43926);
});

test('kolomnamen en datumserienummers', () => {
  assert.deepEqual([0, 25, 26, 27, 701].map(x.colName), ['A', 'Z', 'AA', 'AB', 'ZZ']);
  assert.equal(x.dateSerial('1900-03-01'), 61);
  assert.equal(x.dateSerial('2026-09-28'), 46293);
});

test('workbook maakt een ZIP met alle onderdelen en ontsnapte tekst', () => {
  const bytes = x.workbook([{ name: 'Test/1', columns: ['Naam', 'Datum', 'Waarde'], rows: [['A & <B>', { date: '2026-01-02' }, 5.5]] }]);
  assert.equal(bytes[0], 0x50); // 'PK'
  assert.equal(bytes[1], 0x4b);
  const text = new TextDecoder().decode(bytes);
  for (const part of ['[Content_Types].xml', 'xl/workbook.xml', 'xl/styles.xml', 'xl/worksheets/sheet1.xml']) assert.ok(text.includes(part), part);
  assert.ok(text.includes('A &amp; &lt;B&gt;'));
  assert.ok(text.includes('<sheet name="Test1"'));
  assert.ok(text.includes(`<v>${x.dateSerial('2026-01-02')}</v>`));
});
