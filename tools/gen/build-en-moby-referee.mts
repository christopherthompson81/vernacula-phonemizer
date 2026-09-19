/**
 * Build an English referee corpus from the MOBY PRONUNCIATOR II word list.
 *
 * Upstream: Project Gutenberg eBook #3205, "Moby Pronunciation List", Grady Ward.
 *   ⚠ PUBLIC DOMAIN BY EXPLICIT GRANT — the file says so in its own header: "Public Domain material by
 *   grant from the author, January, 2001." That is what makes a DERIVED, COMMITTED artifact legal here,
 *   where the wikipron referees are CC-BY-SA imports kept intact. The PG boilerplate around the content
 *   carries a trademark licence on the *Project Gutenberg* name, not on the work; it is not read and not
 *   reproduced. See data/LICENSES/PROVENANCE.md §5.3.
 *
 *   MOBY=/path/to/mobypron.unc npx tsx tools/gen/build-en-moby-referee.mts
 *
 * ⚠ WHY THIS EXISTS. The wikipron eng_us referee is 4,558 rows and 64% of them sit outside the 50k
 * frequency list — it is short AND skewed to the hard tail, so it cannot say whether the BASICS are right,
 * and it has nothing at all to say about the OOV path. Moby supplies both: 36,860 headwords we carry in
 * the dictionary (22,934 of them inside the 40k frequency list) and 57,679 we do NOT, which is the first
 * referee this repo has ever had for the OOV tier.
 *
 * ⚠ AND IT IS ONLY HALF-INDEPENDENT, WHICH IS WHY IT SHIPS AS `secondary`. #1338 SELECTED ~500 dictionary
 * corrections on the rule "gold AND Moby agree against us", so for those rows scoring against Moby is
 * partly a mirror. The parts that are genuinely independent are #1334–#1336 (driven by wikipron + gold)
 * and the entire OOV half, which no correction has ever been derived from.
 *
 * WHAT IS TRANSFORMED, AND WHAT IS DELIBERATELY NOT:
 *
 *   ⚠ NOTATION — APPLIED, because it is provably meaning-preserving. Moby SPELLS OUT what this engine
 *   writes as one phone. `general` is `dʒ ɛ n ə r ə l` where we write `ɚ`; `download` is `d æ ʊ n …` where
 *   we write the single diphthong `aʊ`. Leaving these unfolded scored 1,619 words wrong for a
 *   transcription convention — 40% of the entire residual, and none of it a claim about pronunciation.
 *
 *   ⚠ FORCE→NORTH — APPLIED, and this one needs its own argument because folding a real MERGER normally
 *   destroys a referee's ability to catch a regression. It is safe HERE and only here: CMUdict has no
 *   FORCE/NORTH distinction at all (`more` and `nor` are both AO R), so this engine has no FORCE to
 *   regress into and the fold can hide nothing. 419 words.
 *
 *   ⚠ MARRY–MERRY — NOT APPLIED, for the exact reason the one above is. 402 dictionary rows moved on that
 *   axis in #1336 and the engine writes BOTH æɹ and ɛɹ, so folding Moby's unmerged reading would blind the
 *   referee to precisely the class most recently changed. Its 165 rows stay in the residual, visible.
 *
 *   ⚠ THE CONSERVATIVE YOD — NOT APPLIED, same reasoning: `tuition` and `duplication` lost a yod in #1338
 *   and en-GB adds it back from a word list, so the distinction is live in this engine and must stay
 *   scoreable.
 *
 *   ⚠ MOBY'S `-ness` — NORMALISED, and the case for it is MOBY'S OWN INCONSISTENCY, not our disagreement.
 *   Moby writes the unstressed `-ness` suffix with a FULL `/E/`: 1,622 rows against 146 with `/I/`. No
 *   other unstressed suffix in the file behaves that way — the phonologically identical `-less` is IH 209
 *   to EH 34, `-age` is IH 334, `-ous` is AH 1,693. So the suffix is reduced everywhere in Moby except
 *   here, and the rule maps it to `IH0`: MOBY'S OWN OTHER SPELLING OF THE SAME SUFFIX, not to our schwa.
 *   That keeps the claim minimal — it asserts nothing about English that Moby does not already assert
 *   about `-less` — and leaves the ə/ɪ weak-vowel axis to the `intentional` class that already declares it.
 *   ⚠ CONDITIONED ON THE SYLLABLE BEING UNSTRESSED, because `-ness` IS stressed in `dungeness`,
 *   `inverness` and `sultaness`, where `/E/` is correct and folding it would be a real loss.
 *   ⚠ AND IT COSTS US ROWS IN THE LEXICON FILE, DELIBERATELY. Our own dictionary writes `EH2` on this
 *   suffix for `carefulness`, `faithfulness`, `awesomeness` and five others — rows that PASSED only
 *   because Moby had the same full vowel. They now fail, which is the referee reporting our defect
 *   instead of agreeing with it.
 *
 *   ⚠ MOBY'S `-ing` — NORMALISED, on the same footing as `-ness` and found the same way. Moby writes the
 *   suffix `/I//N/` in 1,264 rows and `/i//N/` in 230 — 15% of its own `-ing` words disagree with the
 *   other 85%, and `king`, `sing`, `ring`, `thing`, `building`, `farming` and `running` are all in the
 *   majority. `alarming` is `/@/'l/A/rm/i//N/`. There is no GenAm reading `-iŋ`, and the minority is not
 *   an environment — it is scatter. Mapped to `IH0`, Moby's own majority spelling.
 *   ⚠ ONLY WHERE THE SYLLABLE IS UNSTRESSED and the headword actually ends `-ing`, so a monosyllable
 *   whose vowel IS the tonic keeps whatever Moby gave it.
 *
 *   ⚠ AN INITIAL `/dZ/` ON A VOWEL-SPELLED WORD — CORRECTED to the palatal glide. Five entries, and the
 *   only reason they were found is that the Moby/gold disagreements were READ rather than counted: a word
 *   spelled with an initial vowel cannot begin with /d͡ʒ/. See `fixInitialYod`.
 *
 *   ⚠ GEMINATE CONSONANTS — COLLAPSED, BUT IN THE OOV FILE ONLY, and the asymmetry is the whole point.
 *   Moby writes 1,031 rows with an identical adjacent consonant pair (`aboriginally` as `…n/-/ll/i/`,
 *   694 of them `LL`). The engine's OOV paths finish every reading through `collapseGeminates`, so they
 *   CANNOT emit one — scoring them against a geminate marks us wrong on a class we can neither get right
 *   nor regress on, which is the same argument FORCE→NORTH is applied under above.
 *   ⚠ THE DICTIONARY PATH DOES NOT COLLAPSE, which is why this stops at the OOV file: 144 `g2p-dict.tsv`
 *   rows carry a real geminate (`backcourt`, `barroom`, `blackcap` — compound seams), so in the LEXICON
 *   file the engine has freedom here and a blanket fold would hide a genuine difference.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { MOBY_DEFECTIVE, mobyToArpabet } from "../english/en_source_compare.mts";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const MOBY = process.env["MOBY"];
if (!MOBY) throw new Error("set MOBY to a mobypron.unc path (Project Gutenberg #3205)");

/** ARPABET → BROAD IPA. ⚠ DELIBERATELY NOT `makeArpabetToIpa`: that is the ENGINE's narrow notation
 *  (aspiration ʰ, dark ɫ, flapped t̬, superscript offglides), and a referee written in the notation of the
 *  thing it judges reads as a mirror even where the folds would make it score the same. This is the plain
 *  broad transcription a human referee file looks like — the same shape as the wikipron imports. */
const IPA: Record<string, string> = {
    AA: "ɑ", AE: "æ", AH: "ʌ", AO: "ɔ", AW: "aʊ", AY: "aɪ", EH: "ɛ", ER: "ɚ", EY: "eɪ",
    IH: "ɪ", IY: "i", OW: "oʊ", OY: "ɔɪ", UH: "ʊ", UW: "u",
    B: "b", CH: "t͡ʃ", D: "d", DH: "ð", F: "f", G: "ɡ", HH: "h", JH: "d͡ʒ", K: "k", L: "l",
    M: "m", N: "n", NG: "ŋ", P: "p", R: "ɹ", S: "s", SH: "ʃ", T: "t", TH: "θ", V: "v",
    W: "w", Y: "j", Z: "z", ZH: "ʒ",
};
/** Two Moby symbols this engine writes as one. Applied on the ARPABET side, before IPA. */
const JOIN: [string, string, string][] = [
    ["AH", "R", "ER"], ["IH", "R", "ER"],          // ə/ɪ + r is our single ɚ (general, history, different)
    ["AE", "UH", "AW"], ["AA", "UH", "AW"],        // two-segment MOUTH
    ["AA", "IH", "AY"], ["AA", "AH", "AY"],        // two-segment PRICE
    ["EH", "IH", "EY"], ["AO", "IH", "OY"],        // two-segment FACE / CHOICE
];

/** ⚠ STRESS IS CARRIED THROUGH THE JOIN AND CONSULTED FOR `AH`, because Moby writes ONE symbol `/@/` for
 *  both the STRUT vowel and schwa and separates them by stress alone — the same convention CMUdict uses
 *  (AH1 = ʌ, AH0 = ə). Stripping stress before the IPA map wrote `general` as `dʒɛnɚʌl` and `carolina` as
 *  `kæɹʌlaɪnʌ`, turning every unstressed schwa in the corpus into STRUT. */
function fold(a: string[]): [string, string][] {
    const t = a.map((p) => [p.replace(/[0-2]$/u, ""), /[0-2]$/u.test(p) ? p.slice(-1) : ""] as [string, string]);
    const out: [string, string][] = [];
    for (let i = 0; i < t.length; i++) {
        const j = JOIN.find(([x, y]) => t[i]![0] === x && t[i + 1]?.[0] === y);
        if (j) { out.push([j[2], t[i]![1]]); i++; continue; }   // the joined nucleus keeps the FIRST stress
        // FORCE → NORTH: Moby keeps oʊɹ where GenAm merged to ɔɹ. Safe — CMUdict has no such distinction.
        if (t[i]![0] === "OW" && t[i + 1]?.[0] === "R") { out.push(["AO", t[i]![1]]); continue; }
        out.push(t[i]!);
    }
    return out;
}
const sym = ([base, stress]: [string, string]): string =>
    base === "AH" && stress === "0" ? "ə" : (IPA[base] ?? "");

/** Consonants, for the geminate collapse. Mirrors the engine's `collapseGeminates`, which exempts vowels
 *  because an identical adjacent VOWEL pair is a nucleus, not a doubled segment. */
const CONSONANT = new Set(
    "B CH D DH F G HH JH K L M N NG P R S SH T TH V W Y Z ZH".split(" "),
);

/**
 * `JH` where the palatal glide belongs. ⚠ FIVE ENTRIES, FOUND BY READING THE MOBY/GOLD DISAGREEMENTS
 * RATHER THAN COUNTING THEM: a word spelled with an initial vowel cannot begin with /d͡ʒ/, and Moby writes
 * `/dZ/` for `/j/` in `Eurocommunism`, `unilocular`, `uninucleate`, `usucaption` and `Egan` — in four of
 * the five directly before /u/ or /ʊ/, which is where the yod belongs. The converter is not at fault: it
 * renders `/j/` as Y correctly everywhere else (`euro`, `yes`, `beauty`).
 * ⚠ GATED ON THE FOLLOWING VOWEL, because the fifth entry is not a yod row at all: `Egan /dZ//oU/gz` is
 * a MISALIGNED row whose body belongs to another headword, and rewriting its `/dZ/` would launder
 * obvious garbage into a plausible-looking wrong reading. The four real ones are all before /u/ or /ʊ/.
 */
function fixInitialYod(word: string, a: string[]): string[] {
    if (a[0] !== "JH" || !/^[aeiou]/u.test(word)) return a;
    if (!/^(UW|UH)/u.test(a[1] ?? "")) return a;
    const out = [...a];
    out[0] = "Y";
    return out;
}

/** Collapse an identical adjacent CONSONANT pair — see the header. OOV rows only. */
function degeminate(a: string[]): string[] {
    const out: string[] = [];
    for (const p of a) {
        const prev = out[out.length - 1];
        if (prev !== undefined && prev === p && CONSONANT.has(p.replace(/[0-2]$/u, ""))) continue;
        out.push(p);
    }
    return out;
}

/**
 * Moby's minority spelling of an unstressed suffix vowel → its own MAJORITY spelling. Two suffixes, both
 * found by ranking the OOV residual by grapheme and both argued from Moby's own inconsistency:
 *   `-ness`  EH 1622 / IH 146  — every other unstressed suffix in the file is reduced (`-less` IH 209)
 *   `-ing`   IH 1264 / i   230 — and `king`/`sing`/`ring`/`thing` are all in the majority
 * ⚠ THE STRESSED CASES ARE EXEMPT: `-ness` is the tonic in `dungeness`/`inverness`/`sultaness`, and a
 * monosyllable in `-ing` carries its own stress. Both keep whatever Moby gave them.
 */
const SUFFIX_FIX: [RegExp, string, string][] = [
    [/^[a-z]{3,}ness$/u, "EH", "IH0"],
    [/^[a-z]{3,}ing$/u, "IY", "IH0"],
];
function normaliseSuffix(word: string, a: string[]): string[] {
    if (a.length < 3) return a;
    const i = a.length - 2;
    for (const [re, from, to] of SUFFIX_FIX) {
        if (!re.test(word)) continue;
        if (a[i] !== from && a[i] !== `${from}0`) continue;  // stressed → leave it
        const out = [...a];
        out[i] = to;
        return out;
    }
    return a;
}

const dict = new Set<string>();
for (const l of readFileSync(join(REPO, "data/languages/english/g2p-dict.tsv"), "utf8").split("\n"))
    if (l.includes("\t") && !l.startsWith("#")) dict.add(l.split("\t")[0]!.toLowerCase());

/**
 * ⚠ EVERY IMPORTED WORD IS DROPPED FROM BOTH CORPORA, and this is the line that keeps the referee a
 * referee. `tools/english/en_import_moby.mts` adds Moby headwords to the dictionary where gold concurs;
 * scoring ourselves against Moby on a word whose reading we TOOK FROM MOBY is a mirror, and it would
 * read as a free jump in the lexicon score. Without this the import would have moved 16,393 guaranteed
 * matches out of the OOV file and into the lexicon file.
 */
const imported = new Set<string>();
try {
    for (const l of readFileSync(join(REPO, "data/languages/english/moby-import.tsv"), "utf8").split("\n"))
        if (l.includes("\t") && !l.startsWith("#")) imported.add(l.split("\t")[0]!.toLowerCase());
} catch { /* no import layer yet — every Moby headword is then fair game */ }

const lex: string[] = [], oov: string[] = [];
let rows = 0, declined = 0, unmapped = 0, defective = 0;

/**
 * Every reading Moby gives a headword, grouped by the LOWER-CASED key the dictionary uses.
 *
 * ⚠ FIRST-WINS WAS SCORING COMMON WORDS AGAINST PROPER NOUNS. Moby lists `City 'b/oU//Z//[@]/r` (a
 * surname) immediately before `city 's/I/t/i/`, and case-folding the key made the surname win — so the
 * referee asked what `city` sounds like and answered "Bougère". 565 headwords carry more than one
 * distinct reading once folded, and in 273 of them a CAPITALISED entry displaced a lower-case one:
 * `air`, `acre`, `airy`, `abbe`, `alba`. Every one was scoring the wrong word.
 * ⚠ EVERY READING IS EMITTED, TAB-SEPARATED; NOTHING IS PICKED. The eval credits ANY reading on a row,
 * so the fix for `city` is to stop DISCARDING readings, not to choose a better one.
 * ⚠ PREFERRING THE LOWER-CASE ENTRY WAS TRIED AND MEASURED WORSE: 63 lexicon rows went pass→fail against
 * 75 the other way, because roughly half our headwords ARE the capitalised lexeme and several lower-case
 * Moby rows are typos — `cook k/u/k` against the correct `Cook k/U/k`, `charlie` writing the affricate as
 * two symbols, `dalmatian` with a literal ASCII `sh`, `canada` giving Cañada, `august` the adjective
 * rather than the month. Case does not predict which row is right; emitting both costs nothing and
 * presumes nothing.
 * ⚠ THE RESIDUAL RISK IS ACCEPTED AND NAMED: where a surname and a common noun genuinely differ, the row
 * now credits either, so a real error on one of them can hide. That is a far narrower loss than the 63,
 * and it is the same latitude every multi-variant referee row in this repo already carries.
 */
const readings = new Map<string, { lower: string[]; upper: string[] }>();
for (const line of readFileSync(MOBY, "latin1").split(/\r\n|\r|\n/u)) {
    const sp = line.indexOf(" ");
    if (sp < 0) continue;
    rows++;
    const cased = line.slice(0, sp), w = cased.toLowerCase();
    if (imported.has(w)) continue;
    // ⚠ A ROW WHOSE BODY IS A DIFFERENT WORD CANNOT ARBITRATE ANYTHING. See MOBY_DEFECTIVE.
    if (MOBY_DEFECTIVE.has(w)) { defective++; continue; }
    if (!/^[a-z]{2,20}$/u.test(w)) continue;          // no multi-word, no digits, no punctuation headwords
    const a0 = mobyToArpabet(line.slice(sp + 1));
    if (!a0) { declined++; continue; }                 // multi-word body / Moby's French sub-scheme
    const inLexicon = dict.has(w);
    // ⚠ THE GEMINATE COLLAPSE IS OOV-ONLY — see the header. `normaliseSuffix` applies to both.
    const fixed = fixInitialYod(w, normaliseSuffix(w, a0));
    const a = inLexicon ? fixed : degeminate(fixed);
    const ipa = fold(a).map(sym).join("");
    if (ipa === "" || fold(a).some((p) => sym(p) === "")) { unmapped++; continue; }
    let e = readings.get(w);
    if (!e) readings.set(w, e = { lower: [], upper: [] });
    const bucket = /^[A-Z]/u.test(cased) ? e.upper : e.lower;
    if (!bucket.includes(ipa)) bucket.push(ipa);
}
let multiReading = 0;
for (const [w, { lower, upper }] of readings) {
    const all = [...lower, ...upper.filter((r) => !lower.includes(r))];
    // ⚠ COUNTS ROWS THAT ACTUALLY CARRY MORE THAN ONE READING, not headwords that merely appear in both
    // cases: an earlier version counted the latter and reported 1,759 where the real figure is ~230.
    if (all.length > 1) multiReading++;
    (dict.has(w) ? lex : oov).push(`${w}\t${all.join("\t")}`);
}

const header = (what: string, n: number): string =>
    `# en — MOBY PRONUNCIATOR II, ${what} (${n} rows)\n` +
    `# Derived from Project Gutenberg #3205 (Grady Ward), PUBLIC DOMAIN by grant from the author, Jan 2001.\n` +
    `# Built by tools/gen/build-en-moby-referee.mts — see that file for what is folded and what is not,\n` +
    `# and data/LICENSES/PROVENANCE.md §5.3 for provenance. Broad IPA; a row may carry SEVERAL readings,\n` +
    `# tab-separated, and the eval credits any of them.\n`;

const dir = join(REPO, "tools/referee-eval/referees");
writeFileSync(join(dir, "en.moby-lexicon.tsv"), header("words this dictionary carries", lex.length) + lex.join("\n") + "\n");
writeFileSync(join(dir, "en.moby-oov.tsv"), header("words this dictionary does NOT carry — the OOV tier", oov.length) + oov.join("\n") + "\n");
console.log(`moby rows ${rows}, declined ${declined}, unmapped ${unmapped}, defective ${defective}, excluded-as-imported ${imported.size}`);
console.log(`  headwords emitting more than one reading: ${multiReading}`);
console.log(`  en.moby-lexicon.tsv  ${lex.length}`);
console.log(`  en.moby-oov.tsv      ${oov.length}`);
