/**
 * Expand the Thai dictionary (dictionary.tsv) from the kaikki.org Wiktionary Thai gold — the authoritative source
 * for Thai pronunciation — following espeak-ng-portable's methodology: dictionary ONLY the words the rule engine
 * cannot derive (the lexical tail: Sanskrit/Pali inserted-vowel + coda-sonorant doubling + length/onset irregulars).
 *
 * CIRCULARITY (accepted, documented): kaikki and the wikipron referee are BOTH Wiktionary, so dictionaried words
 * trivially match wikipron — the wikipron number is no longer independent for covered words. This is the deliberate
 * trade-off (kaikki is the only path to correct Thai lexical output). The honest signal is the RULE-ENGINE accuracy
 * on OOV words (reported by --validate) + running-text coverage, not the dict-inflated referee.
 *
 * kaikki IPA → our convention: strip syllable dots, unreleased ̚ and offglide ̯; move the tone from after the coda
 * to after the nucleus; add our stress marks (ˈ first syllable, ˌ even nuclei ≥2). The converter is VALIDATED by
 * --validate: on words our rules already get right, converted-kaikki must reproduce our exact output.
 *
 *   npx tsx tools/gen/build-th-kaikki-dict.mts --validate   # check the converter fidelity, don't write
 *   npx tsx tools/gen/build-th-kaikki-dict.mts              # write the expanded dictionary.tsv
 */
import { readFileSync, writeFileSync } from "node:fs";
import { phonemizeWord } from "../../src/languages/thai/g2p.ts";

const EP = process.env.HOME + "/Programming/espeak-ng-portable";
const KAIKKI = `${EP}/tools/thai-gold/th_kaikki_gold.tsv`;
const DICT = new URL("../../src/languages/thai/dictionary.tsv", import.meta.url)
    .pathname;

const VOWEL = "aeiouɛɔɤɯəæ"; // nucleus vowels (tone lands after the last of these; length ː extends it)
const TONE = /[˥˦˧˨˩]+$/;
const FIRST_VOWEL = /[aeiouɛɔɤɯəæ]/u;

/** kaikki syllable (onset·nucleus·coda·TONE, with ̚/̯) → our syllable (onset·nucleus·TONE·coda, stress-less). */
function convertSyllable(syl: string): string {
    const t = syl.match(TONE)?.[0] ?? "";
    const body = syl.slice(0, syl.length - t.length).replace(/[̯̚]/gu, ""); // strip ̚ (U+031A) + ̯ (U+032F)
    let lastV = -1;
    for (let k = 0; k < body.length; k++)
        if (VOWEL.includes(body[k]!) || body[k] === "ː") lastV = k;
    if (lastV < 0) return body + t; // no vowel (rare / syllabic)
    return body.slice(0, lastV + 1) + t + body.slice(lastV + 1);
}

/** kaikki word IPA → our dictionary IPA (per-syllable convert + stress marks ˈ first, ˌ even nuclei ≥2). */
function convert(kaikkiIpa: string): string {
    const syls = kaikkiIpa.split(".").map(convertSyllable);
    return syls
        .map((syl, i) => {
            const mark = i === 0 ? "ˈ" : i >= 2 && i % 2 === 0 ? "ˌ" : "";
            if (!mark) return syl;
            const m = syl.match(FIRST_VOWEL);
            return m && m.index !== undefined
                ? syl.slice(0, m.index) + mark + syl.slice(m.index)
                : mark + syl;
        })
        .join("");
}

const kaikki = new Map<string, string>();
for (const l of readFileSync(KAIKKI, "utf8").split("\n")) {
    if (l.startsWith("#") || !l.trim()) continue;
    const [w, ipa] = l.split("\t");
    if (w && ipa) kaikki.set(w, ipa);
}

// Rule-engine (dict-free) output per word: read the current dict to know which words are dict-driven now.
const existing = new Map<string, string>();
for (const l of readFileSync(DICT, "utf8").split("\n")) {
    if (l.startsWith("#") || !l.trim()) continue;
    const [w, ph] = l.split("\t");
    if (w && ph) existing.set(w, ph);
}

if (process.argv.includes("--validate")) {
    // Fidelity: on words NOT already dictionaried and where our rule output already matches kaikki (folded),
    // does the CONVERTED kaikki reproduce our EXACT output? If yes, the converter is faithful.
    const fold = (s: string) =>
        s.normalize("NFD").replace(/[ˈˌ]/gu, "").normalize("NFC");
    let checked = 0,
        exact = 0;
    const bad: string[] = [];
    for (const [w, ipa] of kaikki) {
        if (existing.has(w)) continue;
        const ours = phonemizeWord(w);
        const conv = convert(ipa);
        if (fold(ours) !== fold(conv)) continue; // only where they semantically agree
        checked++;
        if (ours === conv) exact++;
        else if (bad.length < 20) bad.push(`${w}: ours=${ours} conv=${conv}`);
    }
    console.log(
        `converter fidelity on agreeing words: ${exact}/${checked} exact (${((100 * exact) / checked).toFixed(1)}%)`,
    );
    for (const b of bad) console.log("  " + b);
} else {
    // Self-maintaining rebuild: the dict must hold ONLY entries the rules can't derive. Read everything (above),
    // then EMPTY the dict file so phonemizeWord runs RULES-ONLY, then keep/prune existing + add kaikki against the
    // rule output. (Our port's rule gaps differ from espeak's — e.g. the Run-5 cluster fix — so imported espeak
    // entries the rules now reproduce are dead weight and get pruned.)
    const header = readFileSync(DICT, "utf8")
        .split("\n")
        .filter((l) => l.startsWith("#"));
    writeFileSync(DICT, [...header, ""].join("\n")); // first phonemizeWord() below loads this empty dict → rules-only
    const final = new Map<string, string>();
    let kept = 0,
        pruned = 0,
        added = 0;
    // 1. Existing entries: keep only where the rules do NOT reproduce them (prune redundant).
    for (const [w, v] of existing) {
        if (phonemizeWord(w) !== v) {
            final.set(w, v);
            kept++;
        } else pruned++;
    }
    // 2. kaikki MULTI-SYLLABLE content words the rules mis-derive. Single letters (ก→kɔː name) + monosyllabic
    //    function words (ก็, ณ) are where kaikki's colloquial/letter-name noise lives — and the rules handle real
    //    monosyllables ~98% — so restrict to ≥2 syllables (a dot) + ≥2 Thai chars.
    for (const [w, ipa] of kaikki) {
        if (existing.has(w) || !ipa.includes(".") || [...w].length < 2) continue;
        const conv = convert(ipa);
        if (phonemizeWord(w) !== conv) {
            final.set(w, conv);
            added++;
        }
    }
    const rows = [...final].sort((a, b) => (a[0] < b[0] ? -1 : 1));
    writeFileSync(
        DICT,
        [...header, ...rows.map(([w, p]) => `${w}\t${p}`), ""].join("\n"),
    );
    console.log(`dictionary.tsv: ${existing.size} → ${final.size} (kept ${kept}, pruned ${pruned} redundant, +${added} kaikki)`);
}
