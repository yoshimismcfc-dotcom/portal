import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const html = fs.readFileSync(path.join(root, "tournament.html"), "utf8");
const map = fs.readFileSync(path.join(root, "assets", "yoshimi-fureai-venue-guide.svg"), "utf8");

assert.match(html, /id="include-venue-map"/);
assert.match(html, /YOUKOU_FIELDS\s*=\s*\["y-title","include-venue-map"\]/);
assert.match(html, /async function addVenueMapPage\(pdf\)/);
assert.match(html, /pdf\.addPage\("a4","portrait"\)/);
assert.match(html, /大会要項・会場案内_A4縦\.pdf/);
assert.match(map, />B面<\/text>/);
assert.match(map, />A面<\/text>/);
assert.match(map, /アップエリアのみ/);
assert.match(map, /マット通路（3か所）/);
assert.doesNotMatch(map, /<line x1="985" y1="470" x2="1435" y2="470"/);
assert.doesNotMatch(map, /<circle cx="1210" cy="470"/);

console.log("tournament venue map tests passed");
