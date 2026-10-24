import fs from 'node:fs';import assert from 'node:assert/strict';
const html=fs.readFileSync(new URL('../fifa11plus.html',import.meta.url),'utf8'),menu=fs.readFileSync(new URL('../coach_menu.html',import.meta.url),'utf8');
assert.ok(html.includes('7〜13歳'));assert.ok(html.includes('14歳以上'));assert.ok(html.includes('年長児・7歳未満'));assert.ok(html.includes('5段階'));assert.equal((html.match(/data-exercise="kids-/g)||[]).length,7);assert.equal((html.match(/data-exercise="standard-/g)||[]).length,15);
const kids='https://nepeanfootball.com.au/wp-content/uploads/2020/04/11__kids_manual.pdf';for(const p of [14,22,30,38,46,54,62]){for(let level=0;level<5;level++)assert.ok(html.includes(kids+'#page='+(p+level)),`Kids PDF p${p+level}`);}
for(const p of [4,6,8,10,12,14,16,18,20])assert.ok(html.includes('https://www.jfa.jp/medical/pdf/11plus_a4.pdf#page='+p));
assert.ok(html.includes('初級は3〜5回'));assert.ok(html.includes('週2回以上'));assert.ok(!/firebase|dbSave|localStorage|autoplay|<iframe/i.test(html));assert.ok(menu.includes('id="fifa11plus"'));assert.ok(menu.includes('href="fifa11plus.html"'));assert.ok(menu.includes('dbListen("practice_menu"'));assert.ok(menu.includes('dbSave("practice_menu"'));
console.log('FIFA 11+ content/age/reference regression checks passed');

assert.ok(html.includes('href="#kids-1">日本語で7種目を見る'));assert.equal((html.match(/class="warm-original"/g)||[]).length,7);assert.ok(!html.includes('Kids公式マニュアルを開く'));assert.ok(html.includes('日本語PDFで手順を見る'));
