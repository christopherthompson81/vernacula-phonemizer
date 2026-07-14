/**
 * Cross-word CONTEXT polyphone validation of the Mandarin front-end against the g2pM CPP benchmark (Chinese
 * Polyphones in context) — the standard published benchmark. Each sentence marks one target polyphone ▁X▁ with a
 * gold pinyin; we run segment() on the sentence and compare the target's reading.
 *
 * The benchmark is BALANCED per polyphone (it samples each reading ~evenly), so it OVER-weights the hard,
 * non-dominant readings — adversarial for a dominant+phrase-dict system, the same shape as the Arabic isolated-lemma
 * referee. So it reports BOTH:
 *   - plain accuracy (balanced) — comparable to published numbers (pypinyin ~85%, g2pM neural ~97.5%).
 *   - NATURAL-frequency-weighted accuracy — each example weighted by Unihan kHanyuPinlu's real corpus count for its
 *     (char, gold-reading), i.e. how often it actually occurs in running text. This estimates real-text quality.
 *
 * SOURCES (regenerate):
 *   g2pM CPP (test.sent/test.lb): https://github.com/kakaobrain/g2pM/raw/master/data/{test.sent,test.lb}
 *   Unihan kHanyuPinlu: https://www.unicode.org/Public/UCD/latest/ucd/Unihan.zip → Unihan_Readings.txt
 * Usage: npx tsx tools/cmn-g2pm-context.mts --sent <test.sent> --lb <test.lb> --unihan <Unihan_Readings.txt>
 */
import { readFileSync } from "node:fs";

function arg(name: string): string {
    const i = process.argv.indexOf(`--${name}`);
    if (i < 0 || !process.argv[i + 1]) throw new Error(`pass --${name} <path> (see header)`);
    return process.argv[i + 1]!;
}

const DIR = new URL("../src/languages/mandarin/", import.meta.url).pathname;
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
const maxPhrase = [...phrases.keys()].reduce((m, k) => Math.max(m, [...k].length), 2);
const HAN = /\p{Script=Han}/u;

/** Aligned greedy segmentation: one pinyin per input code point (Han → syllable, else ""). Mirrors segment.ts. */
function aligned(cp: string[]): string[] {
    const out: string[] = [];
    let i = 0;
    while (i < cp.length) {
        if (!HAN.test(cp[i]!)) {
            out.push("");
            i++;
            continue;
        }
        let matched = false;
        for (let len = Math.min(maxPhrase, cp.length - i); len >= 2; len--) {
            const py = phrases.get(cp.slice(i, i + len).join(""));
            if (py !== undefined) {
                const s = py.split(" ");
                for (let k = 0; k < len; k++) out.push(s[k] ?? "");
                i += len;
                matched = true;
                break;
            }
        }
        if (matched) continue;
        const r = chars.get(cp[i]!);
        out.push(r ? r[0]! : "");
        i++;
    }
    return out;
}

const TONE: Record<string, [string, number]> = { "ā": ["a", 1], "á": ["a", 2], "ǎ": ["a", 3], "à": ["a", 4], "ē": ["e", 1], "é": ["e", 2], "ě": ["e", 3], "è": ["e", 4], "ê": ["e", 5], "ī": ["i", 1], "í": ["i", 2], "ǐ": ["i", 3], "ì": ["i", 4], "ō": ["o", 1], "ó": ["o", 2], "ǒ": ["o", 3], "ò": ["o", 4], "ū": ["u", 1], "ú": ["u", 2], "ǔ": ["u", 3], "ù": ["u", 4], "ǖ": ["ü", 1], "ǘ": ["ü", 2], "ǚ": ["ü", 3], "ǜ": ["ü", 4] };
const toNum = (s: string): string => {
    let b = "", t = 5;
    for (const ch of s) {
        if (TONE[ch]) {
            b += TONE[ch]![0];
            if (TONE[ch]![1] !== 5) t = TONE[ch]![1];
        } else b += ch;
    }
    return b + t;
};
// Unihan kHanyuPinlu: char → Map(numbered-reading → natural corpus count)
const freq = new Map<string, Map<string, number>>();
for (const l of readFileSync(arg("unihan"), "utf8").split("\n")) {
    const m = l.match(/^U\+([0-9A-F]+)\tkHanyuPinlu\t(.+)/);
    if (!m) continue;
    const mp = new Map<string, number>();
    for (const part of m[2]!.split(" ")) {
        const pm = part.match(/^(.+?)\((\d+)\)$/);
        if (pm) mp.set(toNum(pm[1]!), Number(pm[2]));
    }
    freq.set(String.fromCodePoint(parseInt(m[1]!, 16)), mp);
}

const norm = (s: string): string => s.toLowerCase().replace(/u:/g, "v").replace(/ü/g, "v").replace(/ê/g, "e");
const sent = readFileSync(arg("sent"), "utf8").split("\n");
const lb = readFileSync(arg("lb"), "utf8").split("\n");
let plain = 0, plainN = 0, wsum = 0, wok = 0;
for (let li = 0; li < sent.length; li++) {
    const s = sent[li], gold = lb[li]?.trim();
    if (!s || !gold) continue;
    const mi = s.indexOf("▁");
    if (mi < 0) continue;
    const before = [...s.slice(0, mi)].filter((c) => c !== "▁").length;
    const clean = [...s].filter((c) => c !== "▁");
    const target = clean[before];
    if (!target || !HAN.test(target)) continue;
    const py = aligned(clean)[before];
    const correct = norm(py!) === norm(gold);
    plainN++;
    if (correct) plain++;
    const w = freq.get(target)?.get(norm(gold)) ?? 0;
    if (w > 0) {
        wsum += w;
        if (correct) wok += w;
    }
}
console.log(`g2pM CPP context-polyphone benchmark:`);
console.log(`  plain (BALANCED — over-samples non-dominant readings): ${plain}/${plainN} = ${((100 * plain) / plainN).toFixed(1)}%`);
console.log(`  NATURAL-frequency-weighted (kHanyuPinlu):              ${((100 * wok) / wsum).toFixed(1)}%`);
