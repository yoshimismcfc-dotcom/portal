import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const html = fs.readFileSync(path.join(root, "tournament.html"), "utf8");
const map = fs.readFileSync(path.join(root, "assets", "yoshimi-fureai-venue-guide.svg"), "utf8");
const printMap = fs.readFileSync(path.join(root, "assets", "yoshimi-fureai-venue-guide.png"));

assert.match(html, /id="include-venue-map"/);
assert.match(html, /PDFに会場案内図を付けますか？/);
assert.match(html, /1ページ目：大会要項/);
assert.match(html, /2ページ目：会場案内図/);
assert.match(html, /id="venue-map-choice-state"/);
assert.match(html, /選択中：会場案内図つき（2ページ）/);
assert.match(html, /classList\.toggle\("selected",enabled\)/);
assert.match(html, /YOUKOU_FIELDS\s*=\s*\["y-title","include-venue-map"\]/);
assert.match(html, /async function addVenueMapPage\(pdf\)/);
assert.match(html, /pdf\.addPage\("a4","portrait"\)/);
assert.match(html, /yoshimi-fureai-venue-guide\.png\?v=20260810-20/);
assert.match(html, /canvas\.width=2480;canvas\.height=3508/);
assert.match(html, /getContext\("2d",\{alpha:false\}\)/);
assert.match(html, /pdf\.setFillColor\(255,255,255\);pdf\.rect\(0,0,210,297,"F"\)/);
assert.doesNotMatch(html, /image\.src="assets\/yoshimi-fureai-venue-guide\.svg/);
assert.match(html, /大会要項・会場案内_A4縦\.pdf/);
assert.deepEqual([...printMap.subarray(0,8)],[137,80,78,71,13,10,26,10]);
assert.equal(printMap.readUInt32BE(16),2480);
assert.equal(printMap.readUInt32BE(20),3508);
assert.match(map, />B面<\/text>/);
assert.match(map, />A面<\/text>/);
assert.match(map, /アップエリアのみ/);
assert.match(map, /マット通路（3か所）/);
assert.doesNotMatch(map, /<line x1="985" y1="470" x2="1435" y2="470"/);
assert.doesNotMatch(map, /<circle cx="1210" cy="470"/);

console.log("tournament venue map tests passed");
