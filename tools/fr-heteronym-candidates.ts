/**
 * Generate FRENCH -ENT HETERONYM candidates from Lexique, for `heteronyms` in french.jsonc.
 *
 * WHY GENERATE. The 3rd-person-plural ⟨-ent⟩ ending is silent, so every -ent noun/adjective that is also a
 * verb form is a homograph: content [kɔ̃tɑ̃] vs "ils content" [kɔ̃t]. Lexique records exactly one reading
 * per spelling, so the other has to be supplied — and the class is open-ended, which makes hand-listing
 * both incomplete and error-prone. It was error-prone in practice: the hand-written `excellent` entry had
 * the wrong first vowel, which this script's cross-check caught (see below).
 *
 * Usage:  npx tsx tools/fr-heteronym-candidates.ts
 *
 * THE TWO TESTS, and why both are needed:
 *
 *  1. PHONOLOGICAL. French 3sg and 3pl are homophonous (both endings silent), so the 3sg entry
 *     `stem + "e"` should read exactly like the 3pl. This rules out stem-changing verbs: `différent`
 *     [difeʁɑ̃] looks like a candidate, but the 3pl of *différer* is spelled *diffèrent*, and the 3sg is
 *     *diffère* — so `différe` is absent and the pair is rejected.
 *
 *  2. MORPHOLOGICAL. The phonological test alone is not enough, because French orthography is regular
 *     enough that an UNRELATED `stem + e` word is homophonous with the stripped -ent form by coincidence.
 *     Measured here, that is 13 of 26 candidates — `ciment`/`cime`, `serpent`/`serpe`, `prudent`/`prude`,
 *     `comment`/`comme`, `régiment`/`régime`, `sergent`/`serge`, `décadent`/`décade`, `indolent`/`indole`,
 *     `féculent`/`fécule`, plus permanent, proéminent, grandiloquent, urgent. So the stem must carry a real
 *     verb paradigm: the infinitive `stem + "er"` AND at least one other inflected form. There is no
 *     *cimer, so ciment goes.
 *
 * THE VERB READING COMES FROM THE 3SG, not from stripping the nasal off the noun. Where the two disagree
 * Lexique is internally inconsistent, and the 3sg is authoritative because it IS a verb form: `excelle` is
 * [ɛksɛl] while `excellent` is [eksɛlɑ̃], differing in the first vowel. Such rows are flagged for review
 * rather than dropped.
 *
 * NOT COVERED, deliberately: words where Lexique happens to record the VERB reading instead, so the
 * MISSING reading is the noun's — `ferment` [fɛʁm], `affluent` [afly]. They cannot be detected this way
 * (their entry does not end in the nasal) and there is no mechanical way to tell that they are also nouns,
 * so they stay hand-listed. Their existence is the reason this script reads Lexique's actual entry rather
 * than assuming the noun reading is the one recorded.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const LEXICON = join(dirname(fileURLToPath(import.meta.url)), "../src/languages/french/lexicon.tsv");

const lex = new Map<string, string>();
for (const line of readFileSync(LEXICON, "utf8").split("\n")) {
    const [w, ipa] = line.split("\t");
    if (w !== undefined && ipa !== undefined && w !== "") lex.set(w, ipa);
}

const NASAL = "ɑ̃";
/** Inflected forms beyond the infinitive; any one of them confirms a real paradigm. */
const INFLECTIONS = ["ons", "ez", "ait", "aient", "ais"];

interface Row { word: string; noun: string; verb: string; flagged: boolean }
const rows: Row[] = [];
let coincidences = 0;

for (const [word, noun] of [...lex].sort()) {
    if (!word.endsWith("ent") || word.length < 6 || !noun.endsWith(NASAL)) continue;
    const stem = word.slice(0, -3);
    const threeSg = lex.get(`${stem}e`);
    if (threeSg === undefined) continue; // no 3sg → not a same-stem verb form (test 1)
    const hasParadigm = lex.has(`${stem}er`) && INFLECTIONS.some((sfx) => lex.has(stem + sfx));
    if (!hasParadigm) { coincidences++; continue; } // test 2
    rows.push({ word, noun, verb: threeSg, flagged: threeSg !== noun.slice(0, -NASAL.length) });
}

console.log(`${rows.length} candidates (${coincidences} rejected as coincidental stem+e words)\n`);
for (const r of rows) {
    const note = r.flagged ? `  ⚠ Lexique disagrees with ${r.noun.slice(0, -NASAL.length)} (3sg wins)` : "";
    console.log(`  "${r.word}": { "default": "${r.noun}", "cases": [{ "ipa": "${r.verb}", "prev": ["ils", "elles"] }] },${note}`);
}
