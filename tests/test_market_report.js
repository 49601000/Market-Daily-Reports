'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const root = path.resolve(__dirname, '..');
const context = vm.createContext({ console, Set, Date, JSON, Object, Array, SyntaxError });
['Config.gs', 'MarketReportService.gs'].forEach(file => vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename:file }));

const service = vm.runInContext('MarketReportService', context);
const base = overrides => Object.assign({
  schema_version:'1.0.0', market:'US', market_date:'2026-10-24',
  generated_at_jst:'2026-10-25T07:15:00+09:00', session_status:'open', report_text:'本文'
}, overrides || {});
const tests = [];
function test(name, fn) { tests.push({name, fn}); }

test('US report is valid', () => assert.equal(service.validate(base()).valid, true));
test('JP report is valid', () => assert.equal(service.validate(base({market:'JP'})).valid, true));
test('schema 1.0.0 is required', () => assert.equal(service.validate(base({schema_version:'2.0.0'})).code, 'UNSUPPORTED_SCHEMA'));
test('missing required field is rejected', () => { const r=base(); delete r.market_date; assert.equal(service.validate(r).code,'MISSING_REQUIRED_FIELD'); });
test('optional fields may be absent', () => assert.equal(service.validate(base()).valid, true));
test('invalid report_text type is rejected', () => assert.equal(service.validate(base({report_text:{}})).code,'INVALID_REPORT_TEXT'));
test('invalid market is rejected', () => assert.equal(service.validate(base({market:'JA'})).code,'INVALID_MARKET'));
test('invalid calendar date is rejected', () => assert.equal(service.validate(base({market_date:'2026-02-30'})).code,'INVALID_MARKET_DATE'));
test('non-JST generated time is rejected', () => assert.equal(service.validate(base({generated_at_jst:'2026-10-25T07:15:00Z'})).code,'INVALID_GENERATED_AT'));
test('closed session is accepted', () => assert.equal(service.validate(base({session_status:'closed'})).valid,true));
test('invalid session is rejected', () => assert.equal(service.validate(base({session_status:'holiday'})).code,'INVALID_SESSION_STATUS'));
test('months are unique and descending', () => assert.deepStrictEqual(Array.from(service.buildMonths([{month:'2026-09'},{month:'2026-10'},{month:'2026-10'}])),['2026-10','2026-09']));
test('sort uses market date first', () => { const a=[{marketDate:'2026-10-23',generatedAtJst:'2026-10-30',id:'a'},{marketDate:'2026-10-24',generatedAtJst:'2026-10-20',id:'b'}]; service.sortRecords(a); assert.equal(a[0].id,'b'); });
test('sort uses generated time within date', () => { const a=[{marketDate:'2026-10-24',generatedAtJst:'2026-10-24T07:00:00+09:00',id:'a'},{marketDate:'2026-10-24',generatedAtJst:'2026-10-24T16:00:00+09:00',id:'b'}]; service.sortRecords(a); assert.equal(a[0].id,'b'); });
test('sort has stable file-id tiebreaker', () => { const a=[{marketDate:'2026-10-24',generatedAtJst:'x',id:'z'},{marketDate:'2026-10-24',generatedAtJst:'x',id:'a'}]; service.sortRecords(a); assert.equal(a[0].id,'a'); });
test('duplicate market/date is reported and retained', () => { const d=service.findDuplicates([{market:'US',marketDate:'2026-10-24'},{market:'US',marketDate:'2026-10-24'}]); assert.equal(d[0].count,2); });
test('different markets on same date are not duplicates', () => assert.equal(service.findDuplicates([{market:'US',marketDate:'2026-10-24'},{market:'JP',marketDate:'2026-10-24'}]).length,0));

let failed = 0;
tests.forEach(t => { try { t.fn(); console.log('PASS', t.name); } catch (e) { failed++; console.error('FAIL', t.name, e.message); } });
console.log(`\n${tests.length - failed}/${tests.length} tests passed`);
if (failed) process.exit(1);
