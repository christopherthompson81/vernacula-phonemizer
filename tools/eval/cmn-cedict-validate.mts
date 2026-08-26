/**
 * Independent word-level validation of the Mandarin Hanzi front-end (segment.ts: phrase dict + char readings)
 * against CC-CEDICT — a dictionary INDEPENDENT of our pypinyin-derived chars.tsv/phrases.tsv, so it is not
 * circular. Compares our segment(word) base pinyin to CC-CEDICT's citation pinyin, per syllable:
 *   - READING match (ignore tone) = polyphone / segmentation correctness.
 *   - FULL match (reading+tone).
 * The tone gap is dominated by CONVENTION, not error: neutral-tone (5) is optional/variable, and our phrase dict
 * bakes 一/不 sandhi (一个 → yi2 ge4, the spoken form) where CC-CEDICT gives citation (yi1 ge5). The residual
 * "genuine" tone tail (non-neutral, non-一/不) is ~2% — specific tone-polyphones (趟 tàng/tāng, 打 dá/dǎ).
 *
 * SOURCE (regenerate): CC-CEDICT (CC-BY-SA 4.0):
 *   curl -sL https://www.mdbg.net/chinese/export/cedict/cedict_1_0_ts_utf-8_mdbg.txt.gz | gunzip > cedict.txt
 * Usage: npx tsx tools/eval/cmn-cedict-validate.mts --cedict <cedict.txt>
 */
import { readFileSync } from "node:fs";

import { segment, type PinyinTables } from "../../src/languages/mandarin/segment.ts";

function arg(name: string, fb: string): string {
    const i = process.argv.indexOf(`--${name}`);
    return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : fb;
}
const CEDICT = arg("cedict", "");
if (!CEDICT) throw new Error("pass --cedict <cedict.txt> (see header to download it)");

const DIR = new URL("../../data/languages/mandarin/", import.meta.url).pathname;
const chars = new Map<string, string[]>();
for (const l of readFileSync(DIR + "chars.tsv", "utf8").split("\n")) {
    const [c, v] = l.split("\t");
    if (c && v) chars.set(c, v.split(","));
}
const phrases = new Map<string, string>();
for (const l of readFileSync(DIR + "phrases.tsv", "utf8").split("\n")) {
    const [c, v] = l.split("\t");
    if (c && v) phrases.set(c, v);
}
const T: PinyinTables = {
    chars,
    phrases,
    maxPhrase: [...phrases.keys()].reduce((m, k) => Math.max(m, [...k].length), 2),
};

const HAN = /\p{Script=Han}/u;
const norm = (s: string): string => s.toLowerCase().replace(/u:/g, "v").replace(/ü/g, "v").replace(/ê/g, "e");
const baseOf = (s: string): string => norm(s).replace(/[1-5]$/, "");
const toneOf = (s: string): string => norm(s).match(/([1-5])$/)?.[1] ?? "0";

let n = 0, readOk = 0, toneOk = 0, genuineTone = 0;
for (const line of readFileSync(CEDICT, "utf8").split("\n")) {
    if (line.startsWith("#") || !line.trim()) continue;
    const m = line.match(/^(\S+)\s+(\S+)\s+\[([^\]]+)\]/);
    if (!m) continue;
    const simp = m[2]!, py = m[3]!.trim().split(/\s+/), cp = [...simp];
    if (!cp.every((c) => HAN.test(c)) || cp.length !== py.length || py.some((p) => /[A-Z]/.test(p))) continue; // Han-only, 1 syll/char, no proper nouns
    const ours = segment(cp, T).map((t) => t.py);
    if (ours.length !== py.length) continue;
    n++;
    const rMatch = ours.every((o, i) => baseOf(o) === baseOf(py[i]!));
    if (rMatch) {
        readOk++;
        if (ours.every((o, i) => toneOf(o) === toneOf(py[i]!))) toneOk++;
        else if (
            ours.some(
                (o, i) =>
                    toneOf(o) !== toneOf(py[i]!) &&
                    toneOf(o) !== "5" &&
                    toneOf(py[i]!) !== "5" &&
                    !/[一不]/.test(cp[i]!),
            )
        )
            genuineTone++;
    }
}
console.log(`CC-CEDICT Han words compared: ${n}`);
console.log(`  READING (polyphone/segmentation): ${readOk} (${((100 * readOk) / n).toFixed(1)}%)`);
console.log(`  FULL (reading + tone):            ${toneOk} (${((100 * toneOk) / n).toFixed(1)}%)`);
console.log(`  genuine tone tail (non-neutral, non-一/不): ${genuineTone} (${((100 * genuineTone) / readOk).toFixed(2)}% of reading-OK)`);
