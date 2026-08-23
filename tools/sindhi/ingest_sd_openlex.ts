/**
 * Sindhi Open Lexicon → cross-script GOLD, at 10× the kaikki scale.
 *
 * The Sindhi Open Lexicon Master Dataset (223,342 entries; SindhiLanguage.org, prepared and curated by
 * Amar Fayaz Buriro — attribution mandatory, see PROVENANCE.md) carries a Devanagari headword in the
 * `extra` field of its "Devanagari/Sindhi → English" section — 16,516 entries, 12,460 unique
 * Perso-Arabic words after cleaning. Devanagari is a FULL abugida: it writes every vowel, including the
 * grammatical final -u the abjad drops (اڪڻ ↔ अकणु əkəɳʊ).
 *
 * That makes this a strictly better signal than the same dataset's `word_with_airab_or_variant` harakat
 * field, which is only PARTIALLY marked — there, "unmarked" conflates "no vowel" with
 * "unwritten vowel". Devanagari has no such ambiguity.
 *
 * Reuses the reader + gate already calibrated on kaikki (`crossscript_sd.ts`, 84.6% vs attested IPA):
 * read the Devanagari as an abugida, then keep the pair ONLY if its consonant skeleton matches what the
 * Perso-Arabic rule g2p independently produces.
 *
 * Input:  sd_deva_pairs.json  {perso-arabic: [devanagari, ...]}  (extracted from the dataset JSONL)
 * Output: sd.openlex.tsv      word \t vocalized IPA
 *
 *   npx tsx tools/sindhi/ingest_sd_openlex.ts [--calibrate]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { phonemizeWordRules } from "../../src/languages/sindhi/sindhi.ts";
import { devaToIpa, skeleton, calFold } from "./crossscript_sd.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const PAIRS = join(HERE, "sd_deva_pairs.json");
const LEX = join(HERE, "..", "..", "data/languages/sindhi/sindhi-lexicon.tsv");
const OUT = join(HERE, "sd.openlex.tsv");
const OUT_MARKED = join(HERE, "sd.openlex.marked.tsv");

const pairs: Record<string, string[]> = JSON.parse(readFileSync(PAIRS, "utf8"));

// Our existing attested-IPA lexicon — an independent check on the Devanagari reading for the overlap.
const gold = new Map<string, string>();
for (const l of readFileSync(LEX, "utf8").split("\n")) {
    const [a, b] = l.split("\t");
    if (a && b && !gold.has(a)) gold.set(a, b);
}

let kept = 0, dropSkel = 0, dropRead = 0;
let calN = 0, calHit = 0;
const rows: string[] = [];
const marked: string[] = [];
const miss: string[] = [];

for (const [word, devas] of Object.entries(pairs)) {
    let picked: string | null = null;
    let anyRead = false;
    const arabIpa = phonemizeWordRules(word);
    for (const dv of devas) {
        const ipa = devaToIpa(dv);
        if (!ipa) continue;
        anyRead = true;
        if (skeleton(ipa) === skeleton(arabIpa)) { picked = ipa; break; }
    }
    if (!picked) { anyRead ? dropSkel++ : dropRead++; continue; }
    rows.push(`${word}\t${picked}`);
    // second file: same reading with the INHERENT vowel marked ᵊ, so the tagger can mask those slots
    for (const dv of devas) {
        const m = devaToIpa(dv, true);
        if (m && skeleton(m.replace(/ᵊ/g, "ə")) === skeleton(arabIpa)) { marked.push(`${word}\t${m}`); break; }
    }
    kept++;

    const g = gold.get(word);
    if (g) {
        calN++;
        if (calFold(picked) === calFold(g)) calHit++;
        else if (miss.length < 12) miss.push(`${word}\t${devas[0]}\t${picked}\t${g}`);
    }
}

console.log(`# open-lexicon pairs: ${Object.keys(pairs).length} unique Perso-Arabic words`);
console.log(`# kept ${kept}   dropped ${dropSkel} (skeleton mismatch)   ${dropRead} (unreadable Devanagari)`);
console.log(`# CALIBRATION vs our attested-IPA lexicon: ${calHit}/${calN} = ${(calHit / Math.max(1, calN) * 100).toFixed(1)}%`);
console.log("# sample misses (word / devanagari / ours / attested):");
for (const m of miss) console.log("   " + m.split("\t").join("  "));

const novel = rows.filter((r) => !gold.has(r.split("\t")[0]!)).length;
console.log(`# words NEW to the lexicon: ${novel}`);

if (!process.argv.includes("--calibrate")) {
    writeFileSync(OUT, rows.sort().join("\n") + "\n", "utf8");
    writeFileSync(OUT_MARKED, marked.sort().join("\n") + "\n", "utf8");
    console.log(`# wrote ${OUT} and ${OUT_MARKED} (${marked.length} marked)`);
}
