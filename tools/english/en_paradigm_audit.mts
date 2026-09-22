/**
 * PARADIGM-INTERNAL DISAGREEMENT IN `g2p-dict.tsv` (#1387): a lemma and its REGULAR INFLECTIONS given
 * incompatible readings, so one sentence says the word two ways.
 *
 * ⚠ `buoy` IS THE SPECIMEN AND IT WAS FOUND ONE WORD AT A TIME, as a by-product of building the en-GB
 * inflection rule. This sweep is the mechanical version of that accident.
 *
 *     buoy  B UW1 IY0   buoys  B UW1 IY0 Z   buoyed  B UW1 IY0 D   buoying  B OY1 IH0 NG   ←
 *
 * ⚠ INFLECTIONS ONLY, NEVER DERIVATIONS. English routinely shifts a vowel across a derivational suffix,
 * and `buoyant`/`buoyancy` are the proof: /ˈbɔɪənt/ beside /ˈbuːi/ is CORRECT and independently attested
 * (Moby has both, and `buoyage` on the /buːi/ side). A sweep that flagged those would be reporting
 * English, not defects. The suffix list is shared with the en-GB paradigm audit so the two cannot drift.
 *
 * ⚠ AND STRESS DIGITS ARE STRIPPED, because a suffix legitimately moves stress. What is compared is the
 * PHONE SKELETON: the inflection must begin with the lemma's phones.
 *
 *   npx tsx tools/english/en_paradigm_audit.mts [--limit N]
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { lemmaCandidates } from "../referee-eval/engb-paradigm-audit.mts";

const HERE = dirname(fileURLToPath(import.meta.url));
const DICT = join(HERE, "..", "..", "data", "languages", "english", "g2p-dict.tsv");

const dict = new Map<string, string[]>();
for (const l of readFileSync(DICT, "utf8").split("\n")) {
    if (l.startsWith("#") || !l.includes("\t")) continue;
    const [w, ph] = l.split("\t");
    if (/^[a-z]+$/u.test(w!)) dict.set(w!, ph!.split(" "));
}

/**
 * The phone skeleton: stress digits removed, because a suffix may legitimately move the stress, and the
 * two REDUCED vowels unified.
 * ⚠ `AH0` AND `IH0` ARE ONE SLOT HERE AND FOLDING THEM IS NOT OPTIONAL. CMUdict spells the same
 * unstressed vowel both ways WITHIN a paradigm — `abdicate AE1 B D AH0 K EY2 T` beside `abdicating
 * AE1 B D IH0 K EY2 T IH0 NG`, `accredited`, `adjudicated` — which is this repo's own weak-vowel
 * question (#1282) and a class of its own. Unfolded it drowns the signal this sweep is for.
 */
/** Stress digits off. A suffix may legitimately move the stress, so the skeleton is what is compared. */
const skeleton = (ph: string[]): string[] => ph.map((p) => p.replace(/\d$/u, ""));

/**
 * Are these two phones the same slot?
 *
 * ⚠ `AH` AND `IH` ARE ONE SLOT ONLY WHEN BOTH ARE UNSTRESSED, and this has to be a PAIRWISE test
 * rather than a canonical spelling. CMUdict writes the same reduced vowel both ways within a paradigm
 * (`abdicate AH0 K` beside `abdicating IH0 K`), which is this repo's own weak-vowel question (#1282) and
 * drowns the signal unfolded — but a canonical `IH → AH` map is wrong in both directions at once:
 * applied AFTER the digits come off it merges a STRESSED `IH1` with `AH1`, and applied BEFORE it makes
 * `IH0` and `IH1` different phones, which is worse. Only the pair knows.
 */
const sameSlot = (a: string, b: string): boolean => {
    if (a.replace(/\d$/u, "") === b.replace(/\d$/u, "")) return true;
    const reduced = /0$/u.test(a) && /0$/u.test(b);
    return reduced && ["AH", "IH"].includes(a.slice(0, -1)) && ["AH", "IH"].includes(b.slice(0, -1));
};

/**
 * ⚠ EVERY CANDIDATE LEMMA IS TRIED, AND ONE MATCH CLEARS THE WORD. Taking the FIRST dictionary-backed
 * candidate and stopping — which is what the en-GB audit does, where a set membership disambiguates —
 * reported `ach` as the lemma of `aching`, `abid` of `abided`, `abe` of `abed` and `adam` of `adames`.
 * All are real dictionary words and none is the lemma. Here nothing disambiguates but the phonology, so
 * the phonology has to: a word is flagged only when NO candidate lemma's skeleton is a prefix of it.
 */
const split: { lemma: string; infl: string; l: string; i: string }[] = [];
for (const [w, ph] of dict) {
    const cands = lemmaCandidates(w).map((l) => [l, dict.get(l)] as const).filter(([, p]) => p !== undefined);
    if (cands.length === 0) continue;
    // ⚠ PHONE-WISE, NOT A JOINED-STRING `startsWith`. `N` is a string prefix of `NG`, `S` of `SH`, `T`
    // of `TH`, `D` of `DH`, `Z` of `ZH` — so a joined comparison clears `S AH N` against `S AH NG …` as
    // a match and the row silently never gets flagged. No such row exists in the dict today; it is a
    // false NEGATIVE waiting on a dict edit, which is the kind this sweep would never report.
    const isPrefix = (a: string[], b: string[]): boolean =>
        a.length <= b.length && a.every((p, k) => sameSlot(p, b[k]!));
    if (cands.some(([, lp]) => isPrefix(lp!, ph))) continue;
    const [l, lp] = cands[0]!;
    split.push({ lemma: l, infl: w, l: lp!.join(" "), i: ph.join(" ") });
}
/**
 * ⚠ THE RAW COUNT IS NOT THE DEFECT COUNT, AND MOST OF IT IS SOMEONE ELSE'S ISSUE. The classes:
 *   PREFIX   the disagreement is confined to UNSTRESSED vowels — `abhor AE0` beside `abhorred AH0`.
 *            That is #1397's de-/re-/pre- class, wider than that issue's 57 families.
 *   LOT/THOUGHT  AA~AO only — `accost AO1` beside `accosted AA1`. The curated layer's own class.
 *   VOICING  S~Z, F~V, TH~DH only — `abuse`/`abused`, correct noun/verb pairs.
 *   SHORTER  the inflection's skeleton is SHORTER than the lemma's, so the difference is past the
 *            overlap — `corp K AO1 R P` against `corps K AO1 R`. Not a vowel question at all.
 *   ⚠ OTHER  a consonant or a STRESSED vowel differs, and nothing above explains it. `buoy` lived here.
 *
 * ⚠ THERE IS NO `STRESS` CLASS AND THERE CANNOT BE ONE. An earlier version had one, and it was wrong in
 * both directions at once: `skeleton()` strips stress digits BEFORE the prefix test, so a row differing
 * only in stress is cleared and never reaches this function — the bucket was empty by construction —
 * while the `stressDiffers ? "STRESS" : "OTHER"` it ended with could only be reached once a REAL segment
 * difference had been found, so it captured 182 rows that belong in OTHER and hid them from the listing.
 * `antipode OW2` against `antipodes AH0`, `ambon AA0` against `ambones OW1`. **That is exactly the
 * "a defect gets filed under a heading and stops being looked at" failure the rule below warns about,
 * committed in the function that states the rule.** Stress-only splits are invisible to this instrument;
 * finding them needs a comparison that keeps the digits, and that is a different sweep.
 */
const VOWEL = /^(?:AA|AE|AH|AO|AW|AY|EH|ER|EY|IH|IY|OW|OY|UH|UW)/u;
/** The two classes this repo already tracks by name, so they are counted rather than left in the residue. */
const LOT_THOUGHT = new Set(["AA AO", "AO AA"]);
const VOICED_SEAM = new Set(["S Z", "Z S", "F V", "V F", "TH DH", "DH TH"]);
type Cls = "PREFIX" | "LOT/THOUGHT" | "VOICING" | "SHORTER" | "OTHER";
const classify = (lRaw: string[], iRaw: string[]): Cls => {
    const [l, i] = [skeleton(lRaw), skeleton(iRaw)];
    // ⚠ A SHORTER INFLECTION IS ITS OWN ANSWER. Otherwise the overlap shows no difference at all and the
    // row lands in PREFIX, where nothing unstressed differs — `corp`/`corps` was reported that way.
    if (i.length < l.length) return "SHORTER";
    let onlyUnstressedVowels = true, sawLot = false, sawVoice = false, sawElse = false;
    for (let k = 0; k < l.length; k++) {
        const [a, b] = [lRaw[k]!, iRaw[k]!];
        const [ab, bb] = [l[k]!, i[k]!];
        if (sameSlot(a, b)) continue;                              // same slot (stress may differ)
        const unstressed = /0$/u.test(a) && /0$/u.test(b);
        if (VOWEL.test(ab) && VOWEL.test(bb) && unstressed) continue;
        onlyUnstressedVowels = false;
        const pair = `${ab} ${bb}`;
        if (LOT_THOUGHT.has(pair)) sawLot = true;
        else if (VOICED_SEAM.has(pair)) sawVoice = true;
        else sawElse = true;
    }
    if (onlyUnstressedVowels) return "PREFIX";
    // ⚠ THE NAMED CLASSES ONLY CLAIM A ROW WHEN THEY EXPLAIN ALL OF IT. A row with an AA/AO swap AND
    // something else is still OTHER — a partial explanation is how a defect gets filed under a heading
    // and stops being looked at.
    if (!sawElse && sawLot && !sawVoice) return "LOT/THOUGHT";
    if (!sawElse && sawVoice && !sawLot) return "VOICING";
    return "OTHER";
};
const counts: Record<Cls, number> = { PREFIX: 0, "LOT/THOUGHT": 0, VOICING: 0, SHORTER: 0, OTHER: 0 };
const other: typeof split = [];
for (const s of split) {
    const c = classify(s.l.split(" "), s.i.split(" "));
    counts[c]++;
    if (c === "OTHER") other.push(s);
}
console.log(`dictionary words ${dict.size}`);
console.log(`\u26a0 INFLECTIONS WHOSE PHONE SKELETON IS NOT THE LEMMA'S PLUS A SUFFIX: ${split.length}`);
console.log(`   PREFIX (unstressed vowels only \u2014 #1397's class, wider)  ${counts.PREFIX}`);
console.log(`   LOT/THOUGHT (AA~AO only \u2014 the curated layer's class)     ${counts["LOT/THOUGHT"]}`);
console.log(`   VOICING (S~Z, F~V, TH~DH only \u2014 noun/verb pairs)         ${counts.VOICING}`);
console.log(`   SHORTER (the inflection is shorter than the lemma)      ${counts.SHORTER}`);
console.log(`   \u26a0 OTHER (a consonant or a STRESSED vowel differs)       ${counts.OTHER}`);
const limIdx = process.argv.indexOf("--limit");
const limit = limIdx >= 0 ? Number(process.argv[limIdx + 1]) : 60;
for (const s of other.slice(0, limit)) console.log(`   ${s.lemma.padEnd(15)} ${s.l.padEnd(26)} ${s.infl.padEnd(17)} ${s.i}`);
