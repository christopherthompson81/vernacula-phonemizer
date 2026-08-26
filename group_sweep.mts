import { readFileSync } from "node:fs";
import { phonemize } from "./src/index.ts";
const codes = readFileSync("/tmp/all_codes.txt", "utf8").split("\n").filter(Boolean);
const SEPS: Record<string, string> = { comma: ",", dot: ".", space: " " };
// If de-grouping works, a GROUPED number reads exactly like its ungrouped self — at ANY group count.
// ⚠ Requiring TWO and THREE groups to agree first is what keeps a comma-DECIMAL language out: for nb/sv,
// `783,562` is 783.562 and already disagrees, so the separator is not one they de-group.
const CASES = [
    { n: 2, bare: "783562", grouped: (s: string) => `783${s}562` },
    { n: 3, bare: "783562948", grouped: (s: string) => `783${s}562${s}948` },
    { n: 4, bare: "1234567890", grouped: (s: string) => `1${s}234${s}567${s}890` },
    { n: 5, bare: "123456789012", grouped: (s: string) => `123${s}456${s}789${s}012` },
];
const rows: string[] = [];
for (const c of codes) {
    for (const [name, sep] of Object.entries(SEPS)) {
        const ok: Record<number, boolean> = {};
        let usable = true;
        for (const k of CASES) {
            try { ok[k.n] = phonemize(k.grouped(sep), c) === phonemize(k.bare, c); }
            catch { usable = false; break; }
        }
        if (!usable) continue;
        if (ok[2] && ok[3] && !(ok[4] && ok[5])) rows.push(`${c}\t${name}\t4:${ok[4] ? "ok" : "BREAK"} 5:${ok[5] ? "ok" : "BREAK"}`);
    }
}
console.log(rows.join("\n"));
console.log(`\n${rows.length} language/separator pairs de-group 2 and 3 groups but fail at 4 or 5`);
