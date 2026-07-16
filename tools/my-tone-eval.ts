/**
 * Burmese TONE eval — the segmental referee-eval FOLDS tone away, so this measures the (orthographic, rule-based)
 * tone system separately. For each referee word it extracts the ordered tone-category sequence from OUR Chao output
 * (˨ low / ˥˩ high / ˥ˀ creaky / ʔ checked) and from the referee's diacritics (à U+0300 low / á U+0301 high / a̰
 * U+0330 creaky / ʔ checked), and scores per-syllable agreement — reported for MONOSYLLABLES (one clean tone each)
 * and for the whole sequence (multi-syllable, minor ə syllables carry no tone on either side so they drop out).
 *
 *   npx tsx tools/my-tone-eval.ts [wikipron|kaikki]
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { phonemizeWord as my } from "../src/languages/burmese/burmese.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const which = process.argv[2] === "kaikki" ? "kaikki" : "wikipron";
const file = which === "kaikki" ? "my.kaikki-mya.tsv" : "my.wikipron-mya-broad.tsv";

/** Ordered tone-category sequence from OUR Chao output. */
function oursSeq(ipa: string): string[] {
    const out: string[] = [];
    for (const m of ipa.matchAll(/˥˩|˥ˀ|˨|ʔ/gu)) {
        out.push(m[0] === "˥˩" ? "H" : m[0] === "˥ˀ" ? "C" : m[0] === "˨" ? "L" : "K");
    }
    return out;
}
/** Ordered tone-category sequence from the referee's combining tone diacritics + checked ʔ. */
function refSeq(ipa: string): string[] {
    const out: string[] = [];
    for (const m of ipa.normalize("NFD").matchAll(/̀|́|̰|ʔ/gu)) {
        out.push(m[0] === "̀" ? "L" : m[0] === "́" ? "H" : m[0] === "̰" ? "C" : "K");
    }
    return out;
}

// One reference IPA per headword (first pronunciation); wikipron is space-separated, kaikki is joined.
const ref = new Map<string, string>();
for (const line of readFileSync(join(HERE, "referee-eval/referees", file), "utf8").split("\n")) {
    const [w, ipa] = line.split("\t");
    if (w && ipa && !ref.has(w)) ref.set(w, ipa.replace(/ /gu, ""));
}

let monoTot = 0, monoOk = 0, sylTot = 0, sylOk = 0, seqTot = 0, seqOk = 0;
const confusion = new Map<string, number>();
for (const [w, ipa] of ref) {
    const r = refSeq(ipa), o = oursSeq(my(w));
    if (r.length === 0) continue;
    // whole-sequence exact
    seqTot++;
    if (r.length === o.length && r.every((t, k) => t === o[k])) seqOk++;
    // monosyllable
    if (r.length === 1 && o.length === 1) {
        monoTot++;
        if (r[0] === o[0]) monoOk++;
        else confusion.set(`ours ${o[0]} ≠ ref ${r[0]}`, (confusion.get(`ours ${o[0]} ≠ ref ${r[0]}`) ?? 0) + 1);
    }
    // per-syllable (only when the syllable counts agree, else unalignable)
    if (r.length === o.length) {
        for (let k = 0; k < r.length; k++) { sylTot++; if (r[k] === o[k]) sylOk++; }
    }
}

const pct = (a: number, b: number): string => `${a}/${b} (${((100 * a) / b).toFixed(1)}%)`;
console.log(`\nBurmese TONE eval vs ${which} (${ref.size} words)\n`);
console.log(`  monosyllables:     ${pct(monoOk, monoTot)}`);
console.log(`  per-syllable (aligned): ${pct(sylOk, sylTot)}`);
console.log(`  whole-word sequence:    ${pct(seqOk, seqTot)}`);
console.log(`\n  top monosyllable confusions (ours ≠ ref):`);
for (const [k, v] of [...confusion.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)) console.log(`    ${v}×  ${k}`);
