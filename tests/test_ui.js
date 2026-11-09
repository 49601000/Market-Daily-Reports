'use strict';
const fs = require('fs');
const assert = require('assert');
const html = fs.readFileSync(require('path').resolve(__dirname, '..', 'Index.html'), 'utf8');
const tests = [
  ['two-column desktop layout', /grid-template-columns:minmax\(320px, 410px\) 1fr/],
  ['single-column mobile breakpoint', /@media \(max-width:700px\)/],
  ['mobile list/detail switch', /body\.show-detail \.master/],
  ['back navigation', /id="backButton"/],
  ['hamburger accessibility', /aria-controls="drawer" aria-expanded="false"/],
  ['outside-click close', /els\.overlay\.addEventListener\('click',closeMenu\)/],
  ['Escape close', /event\.key==='Escape'/],
  ['reload action loads monthly index', /getMonthlyReportMonths/],
  ['selected month loads one archive', /getMonthlyReportArchive/],
  ['detail uses loaded monthly record', /state\.records\.find\(r=>r\.id===id\)/],
  ['no daily detail RPC', source => !/callServer\('getMarketReportDetail'/.test(source)],
  ['monthly updated timestamp', /月次DB最終更新/],
  ['safe text rendering', /report\.textContent=hasText\(r\.reportText\)\?r\.reportText/],
  ['no report HTML injection', source => !/report\.innerHTML\s*=\s*r\.reportText/.test(source)],
  ['ALL US JP tabs', /data-market="ALL"[\s\S]*data-market="US"[\s\S]*data-market="JP"/],
  ['empty state', /この条件のレポートはありません/],
  ['structured report is the default view', /viewMode: 'structured'/],
  ['small structured and raw view switch', /\[\['structured','構造化'\],\['raw','原文'\]\]/],
  ['view switch reuses the selected monthly record', /state\.records\.find\(x=>x\.id===state\.selectedId\)/],
  ['indices are rendered from object entries', /Object\.entries\(indices\)/],
  ['null metric values render as missing rather than zero', /value===null\|\|value===undefined\)return '—'/],
  ['metric market date and as-of remain separate', /reference_market_date[\s\S]*item\.as_of/],
  ['unverified metrics receive an explicit badge', /item\.unverified===true[\s\S]*未確認/],
  ['driver facts and interpretation are separated', /確認された事実[\s\S]*解釈・影響/],
  ['events and outlook have structured sections', /今後の注目イベント[\s\S]*市場見通し/],
  ['bull base bear scenarios are distinct', /\[\['bull','強気'\],\['base','基本'\],\['bear','弱気'\]\]/],
  ['sources and quality notes are collapsible', /makeDetails\('取得元・品質注記'\)/],
  ['futures and crypto are kept in data details', /makeDetails\('データ詳細'\)[\s\S]*futures_price[\s\S]*crypto_weekend_snapshot/],
  ['VIX is not rendered as a second standalone section', source => !/renderVix\s*\(/.test(source)],
  ['links are restricted to HTTP and HTTPS', /url\.protocol==='http:'\|\|url\.protocol==='https:'/],
  ['external links use noopener and noreferrer', /link\.rel='noopener noreferrer'/],
  ['mobile metric cards collapse to one column', /@media \(max-width:390px\)[^{]*\{[^}]*\.metric-grid \{ grid-template-columns:1fr/],
];
let failed = 0;
tests.forEach(([name, expected]) => {
  const passed = expected instanceof RegExp ? expected.test(html) : expected(html);
  if (passed) console.log('PASS', name); else { failed++; console.error('FAIL', name); }
});
console.log(`\n${tests.length - failed}/${tests.length} UI checks passed`);
if (failed) process.exit(1);
