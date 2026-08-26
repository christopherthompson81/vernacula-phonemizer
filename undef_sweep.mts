import { readFileSync } from "node:fs";
import { phonemize } from "./src/index.ts";
const codes = readFileSync("/tmp/all_codes.txt", "utf8").split("\n").filter(Boolean);
// A compositor that indexes past its table stringifies `undefined` INTO the text, and the g2p then
// speaks it. Its reading is language-specific, so ask each language what it would sound like.
const NUMS = ["1000000000", "1234567890", "1000000000000", "999999999999", "12345678901"];
for (const c of codes) {
    let marker: string;
    try { marker = phonemize("undefined", c).trim(); } catch { continue; }
    if (!marker) continue;
    for (const n of NUMS) {
        let o: string; try { o = phonemize(n, c); } catch { continue; }
        if (o.includes(marker)) { console.log(`${c}\t${n}\t${o}`); break; }
    }
}
