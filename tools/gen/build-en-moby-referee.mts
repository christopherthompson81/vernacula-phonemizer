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
 *   ⚠ THE DICTIONARY PATH DOES NOT COLLAPSE, which is why this stops at the OOV file: 150 `g2p-dict.tsv`
 *   rows carry a real geminate (`backcourt`, `barroom`, `blackcap` — compound seams), so in the LEXICON
 *   file the engine has freedom here and a blanket fold would hide a genuine difference.
 *   ⚠ WITH ONE CARVE-OUT, `collapseSuffixL` BELOW, which does reach the lexicon file. It is not a
 *   blanket fold: it removes an `L` after an `L` and only where the headword is spelled `-lly`, where
 *   the geminate is Moby transcribing the ⟨ll⟩ rather than recording a seam. Read that block before
 *   treating this paragraph as absolute.
 *   ⚠ AND THE COUNT WAS 144 HERE AND 155 IN THE BLOCK BELOW, two figures for one class written at
 *   different times. It is 150 after this branch corrects five `-lly` rows that were themselves the
 *   defect — so the older number counted part of what it was protecting against.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
// ⚠ `VOWELS` IS IMPORTED, NOT REDECLARED. A local `VOWEL_SET` with the same 15 members lived here
// briefly — added while fixing a bug caused by exactly this kind of duplication. Two copies of one
// fact is how the rhotic JOIN and the coda rule each drifted from their siblings.
import { MOBY_DEFECTIVE, MOBY_DEFECTIVE_READING, mobyToArpabet, VOWELS } from "../english/en_source_compare.mts";

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
function fold(w: string, a: string[]): [string, string][] {
    const t = a.map((p) => [p.replace(/[0-2]$/u, ""), /[0-2]$/u.test(p) ? p.slice(-1) : ""] as [string, string]);
    const out: [string, string][] = [];
    for (let i = 0; i < t.length; i++) {
        // ⚠ THE RHOTIC JOIN NEEDS A GUARD AND DID NOT HAVE ONE. `AH R` / `IH R` before the STRESSED
        // vowel of the next syllable is that syllable's ONSET `r`, not this one's coda — Moby writes
        // `around /@/'r/AU/nd`, one schwa syllable then a stressed `raʊnd` — and joining it wrote
        // `ɚaʊnd`, `ɚeɪbiə`, `ɚaɪz`, `ɚoʊmə` into the artifact across 317 rows.
        // ⚠ THE DISCRIMINATOR IS THE FOLLOWING VOWEL'S STRESS, NOT MERELY THAT IT IS A VOWEL, and the
        // first version of this guard used the latter and broke the rule's own headline cases: in
        // `general '/dZ//E/n/@/r/@/l` and `history 'h/I/st/@/r/i/` the `/@/r` is followed by a vowel
        // too, and there it IS our ɚ. Moby marks the difference with its stress mark — `/@/'r` when the
        // `r` opens a stressed syllable, `/@/r` when it closes an unstressed one.
        // ⚠ THIS IS NOT THE SAME GUARD `modernise` USES, although it guards the same fold. That one
        // takes CMUdict-shaped input where `ER` is already a single phone, so a bare consonant
        // lookahead suffices; here the input is Moby's two symbols and the lookahead has to read stress.
        // ⚠ SCORE-NEUTRAL, AND THAT IS WHY IT SURVIVED — the eval folds `ɚ` to `əɹ` on both sides, so
        // the rows still matched. What it corrupts is any measurement taken by reading the TSV
        // directly, which is how the rhotic environment was counted in Run 60 of the investigation.
        const onsetOfStressed = t[i + 2] !== undefined && VOWELS.has(t[i + 2]![0])
            && t[i + 2]![1] !== "" && t[i + 2]![1] !== "0";
        const j = JOIN.find(([x, y]) => t[i]![0] === x && t[i + 1]?.[0] === y
            && !(y === "R" && onsetOfStressed));
        if (j) { out.push([j[2], t[i]![1]]); i++; continue; }   // the joined nucleus keeps the FIRST stress
        // FORCE → NORTH: Moby keeps oʊɹ where GenAm merged to ɔɹ. Safe — CMUdict has no such distinction.
        // ⚠ SPELLED `owr` IS EXEMPT, because there the `r` is the NEXT syllable's ONSET, not this one's
        // coda: `show·room`, `tow·rope`, `arrow·root`, `elbow·room` are compound seams whose GOAT vowel
        // never merged with anything. Folding them wrote `ʃɔɹum`/`tɔɹoʊp` and scored our correct
        // `ʃoᶷɹuːm`/`toᶷɹoᶷp` wrong — damage baked into the TSV that no config fold could reach. The
        // phone shape cannot tell the two apart (`chorus` is also `AO R` + vowel and DOES merge), so the
        // discriminator has to be the spelling.
        if (t[i]![0] === "OW" && t[i + 1]?.[0] === "R" && !w.includes("owr")) { out.push(["AO", t[i]![1]]); continue; }
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

/**
 * The `-lly` geminate, collapsed on BOTH files.
 *
 * ⚠ THIS IS THE ONE CARVE-OUT FROM THE OOV-ONLY RULE, and it is safe for a reason the blanket collapse
 * is not: the geminate here is Moby transcribing the ⟨ll⟩ SPELLING of the adverbial suffix, not a claim
 * about a compound seam. `abnormally` is `æbnɔɹməlli`, `annually` `ænjuəlli`, `bally` `bælli` — 102 rows
 * of the in-dictionary residual, every one stem-final ⟨l⟩ plus `-ly`.
 * ⚠ AND OUR OWN DICTIONARY AGREES, WHICH IS THE ARGUMENT — not the referee. Stem-l + `-ly` degeminates
 * in GenAm (`fully` is /ˈfʊli/) and 708 `-lly` rows said so against 5; restricted to the words whose
 * STEM is itself in the dictionary and ends in /L/, which is the like-for-like comparison, it was 551
 * to 3, with `fully`, `coolly`, `cruelly`, `wholly`, `solely` and `civilly` all single. The five
 * exceptions were CMUdict's own inconsistency and are corrected in `g2p-curated.tsv`.
 * ⚠ THE en-GB REFEREE IS NOT A CLEAN WITNESS HERE AND WAS FIRST CITED AS IF IT WERE. It reads `evilly`
 * as `iːvli` (single, both variants) but `foully` as BOTH `faʊli` and `faʊlli`, and `drolly` — the
 * headline example — as `dɹəʊlli`, geminate, its only variant. Quoting the two that agreed and not the
 * one that did not is how a weak witness gets mistaken for a strong one; the internal 551-to-3 needs
 * no witness at all.
 * ⚠ THE PHONE FILTER IS THE REAL PROTECTION, not the spelling gate: this removes only an `L` preceded
 * by an `L`. `unnaturally` is the one dictionary word that both ends `-lly` and carries a real
 * geminate, and its geminate is `N N` — invisible here. Of the 150 real geminates left in
 * `g2p-dict.tsv` after this change, no other ends `-lly`, and `earring`, `bookkeeper`, `coattail` and
 * `backcourt` are untouched.
 * ⚠ A BOUNDARY-TABLE GATE WAS TRIED FIRST AND REJECTED — only 88 of those geminates have a row in
 * `tools/gen/en-morph-boundary.tsv`, and the uncovered ones are exactly the inflections (`earrings`,
 * `bookkeepers`, `coattails`), so gating on it would collapse what the OOV-only rule protects.
 * ⚠ AND IT BUYS ONE BLIND SPOT, which is the honest cost: `coolly` and `cruelly` are now collapsed on
 * the referee side too, and some GenAm sources do give `coolly` a long /l/. Nothing regressed — our
 * dictionary already commits to the single — but the referee can no longer disagree with it.
 * ⚠ "STEM-FINAL ⟨l⟩ PLUS `-ly`" IS THE MAJORITY, NOT THE RULE: `bally`, `bully`, `colly`, `gilly` and
 * `hally` are simplex and `gravelly` is stem + `-y`. Collapsing them is still right; the class this
 * gate actually names is "headword spelled `-lly`".
 */
const collapseSuffixL = (w: string, a: string[]): string[] =>
    w.endsWith("lly") ? a.filter((p, i) => !(i > 0 && p === "L" && a[i - 1] === "L")) : a;

/** Collapse an identical adjacent CONSONANT pair — see the header. OOV rows only; the `-lly` carve-out
 *  above is the one exception, and it reaches the lexicon file too. */
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
/** Our own ARPABET for the word, where we have one — the discriminator the non-rhotic rule needs. */
const ourArpabet = new Map<string, string>();
for (const l of readFileSync(join(REPO, "data/languages/english/g2p-dict.tsv"), "utf8").split("\n")) {
    if (!l.includes("\t") || l.startsWith("#")) continue;
    const [w, a] = l.split("\t");
    const k = w!.toLowerCase();
    dict.add(k);
    if (!ourArpabet.has(k)) ourArpabet.set(k, a!);
}

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
let rows = 0, declined = 0, unmapped = 0, defective = 0, defectiveReading = 0;

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
/**
 * NON-RHOTIC ROWS — Moby transcribing RP, which cannot arbitrate a GenAm reading.
 *
 * ⚠ RP IS NOT THE SAME THING AS A LOANWORD, and conflating them was the first draft's mistake. Moby
 * writes `afterwards` as `æftəwədz` and `backwards` as `bækwədz` because the transcription is BRITISH:
 * we say the /r/, Moby does not, and scoring us against that marks us wrong for being right. But it
 * also writes `dossier` as `dɑsieɪ` and `metier` as `meɪtjeɪ`, where the ⟨r⟩ is silent IN GenAm TOO —
 * a fact about how English borrowed the word. Those rows are correct, we read them r-less as well, and
 * they PASS today. Excluding them would throw away credit we are earning.
 *
 * ⚠ THE FRENCH EXEMPTION IS `-ier`, NOT `-er`/`-et`, AND THAT WAS MEASURED. `et$` looked reasonable and
 * exempts `hairnet` hɛnɛt, `overset` oʊvəsɛt and `superhet` supəhɛt — all plainly RP. `-ier` and its
 * plural are the ending that is reliably French (`dossier`, `bustier`, `chansonnier`, `menuisier`,
 * `cuvier`, `tablier`, 30 of them); the handful that do not fit it are named individually.
 */
const RHOTIC = /[ɹɚɝɻr]/u;
/** Our reading carries a rhotic. `R` and `ER` are the only ARPABET symbols that do. */
const WE_ARE_RHOTIC = /(?:^|\s)(?:R|ER[0-2]?)(?:\s|$)/u;
/**
 * ALL THREE of the wikipron config's non-rhotic rules, because each earlier one leaves a class behind.
 *
 * ⚠ THE SECOND RULE IS NOT OPTIONAL, AND ITS ABSENCE WAS THE BUG. `[aeiouy]r(?![aeiouy])` rejects every
 * `-ered`/`-ored`/`-ured`/`-ared` word, because the ⟨e⟩ after the ⟨r⟩ is a vowel LETTER even though it
 * is silent — so `battered bætəd`, `coloured kʌləd`, `unanswered ənɑnsəd`, `unpaired ənpɛd` all
 * survived, 45 of them, which is the biggest RP class in the corpus. en.jsonc:31 already carries the
 * second rule for exactly this, naming `featured fiːt͡ʃəd`.
 * ⚠ AND THE SECOND RULE LOOKS ONLY AT THE TAIL, because an ONSET /ɹ/ shields a non-rhotic coda: a
 * whole-string test keeps `particolored pɑɹtɪkʌləd` and `pilastered pɪləstɹeɪd`.
 */
/**
 * ⚠ AND THE THIRD RULE, MISSING UNTIL #1370, WHICH IS WHY RP KEPT LEAKING THROUGH. Rules 1 and 2 ask
 * whether the string holds a rhotic AT ALL, or holds one in its last three symbols. Neither reaches a
 * word whose only rhotic is some other syllable's ONSET: `crackers kɹækəz`, `overdrive oʊvədɹaɪv`,
 * `adversarial ædvəsɛɹiəl`, `weatherproof wɛðəpɹuf`, `superscript supəskɹipt` are all spelled with a
 * post-vocalic ⟨r⟩, transcribed without one, and survive because a `ɹ` sits elsewhere before a vowel.
 * 50 marginal rows, every one a permanent false disagreement where the REFEREE was wrong.
 * ⚠ `undercover` AND `northern` ARE NOT IN THIS CLASS and an earlier draft of this comment listed
 * them first. They have a MIXED profile — `ʌndəkʌvɚ` keeps its final ɚ, `nɔɹðən` its first ɹ — so no
 * rule HERE reaches them. ⚠ RULE 4 BELOW NOW DOES, and this note used to end "the test asserts they
 * survive", which stopped being true when that rule landed. Kept because the point stands for rules
 * 1–3: none of them can see a profile that is partly rhotic.
 * ⚠ IT IS A PORT, NOT A NEW RULE. en.jsonc's third `excludeRows` entry has done this for the wikipron
 * referee since the audit that found `perchlorate` and `weatherproof`; the Moby builder reimplemented
 * the first two and stopped. The same divergence as the rhotic JOIN: two copies of one idea, one of
 * them updated.
 * ⚠ AND A SILENT ⟨w⟩ AFTER THE ⟨r⟩ MAKES IT AN ONSET, NOT A CODA. `Berwick 'b/E/r/I/k` and
 * `Norwich 'n/O/r/I//tS/` are spelled ⟨rw⟩ but the ⟨w⟩ is silent, so the ⟨r⟩ is the next syllable's
 * onset and the readings `bɛɹɪk`/`nɔɹɪt͡ʃ` are ordinary GenAm. `bladderwrack 'bl/&/d/@/,r/&/k` is the
 * same with ⟨wr⟩. All three were dropped by the first version of this rule.
 * ⚠ THE CARVE-OUT TESTS THE READING, AND A SPELLING TEST WOULD BE EQUIVALENT TODAY — measured, and
 * an earlier draft of this comment claimed the opposite. Replacing this clause with a bare
 * `!SILENT_W.test(w)` produces BYTE-IDENTICAL corpora: the ⟨rw⟩ words one would worry about
 * (`afterwards`, `clearway`, `underwhelm`, `washerwoman`) are already dropped by RULE 1, so rule 3's
 * carve-out never sees them. The earlier claim that a spelling test "readmits the largest RP class"
 * counted the 205 headwords MATCHING ⟨rw⟩, not the rows this rule drops — a population the argument
 * was never about.
 * ⚠ IT IS KEPT AS A READING TEST ANYWAY, on the narrower ground that it encodes the REASON rather
 * than the symptom: the ⟨w⟩ being silent is a fact about the pronunciation, and a spelling test that
 * happens to agree today would stop agreeing the moment rule 1 changed.
 * ⚠ THE SPELLING SIDE ALSO EXCLUDES A FOLLOWING ⟨r⟩ OR ⟨h⟩ and both carve-outs are load-bearing here.
 * `r+` backtracks, so a geminate matches its own first half — without the ⟨r⟩ exclusion this drops
 * `arrange əɹeɪnd͡ʒ`, `narrow næɹoʊ`, `Barrett bæɹɪt` and `terracotta tɛɹəkɑtə`, ordinary GenAm rows
 * flagged for having an onset ɹ where no coda ⟨r⟩ exists at all. The ⟨h⟩ exclusion spares `gonorrhea
 * ɡɑnəɹiə`, where the ɹ legitimately serves the spelled ⟨r⟩. ⚠ THESE ARE en.jsonc'S OWN EXAMPLES AND
 * AN EARLIER DRAFT SWAPPED TWO OF THEM FOR WRONG ONES: `greensboro` and `colouring` have their ⟨r⟩
 * followed by a vowel LETTER, so the base lookahead already rejects them and the ⟨r⟩ exclusion never
 * runs. Only `underrate` of that trio actually exercises it.
 */
const SPELLED_R = /[aeiouy]r(?![aeiouy])/u;
const FINAL_R = /[aeiouy]r(?:e|ed)?$/u;
const CODA_R = /[aeiouy]r+(?![aeiouyrh])/u;
/** ⟨rw⟩ in the spelling — a coda only if some reading actually has the /w/. See above. */
const SILENT_W = /[aeiouy]r+w/u;
/** A rhotic in CODA position: ɚ/ɝ, or ɹ/ɻ/r not followed by a vowel. */
/**
 * ⚠ ONE SOURCE FOR THE VOWEL CLASS, BECAUSE HAND-COPYING IT DIVERGED. Rule 4's `/g` twin was written
 * out a second time and silently lost `æ` and corrupted `ɞ` to a Latin capital `Ȟ` — so an `ɹ` before
 * `æ` counted as a CODA rhotic, inflating the referee's count and keeping a genuinely RP row. Latent on
 * today's data (zero rows move either way) and exactly the two-copies-of-one-fact defect this file's
 * header warns about for the rhotic JOIN and the coda rule.
 */
const NOT_A_VOWEL = "(?![aeiouɑɒɔəɛɜɪʊʌæyøœɐɨʉɯɤʏɘɵɞɶːˑ])";
const CODA_RHOTIC = new RegExp(`[ɚɝ]|[ɹɻr]${NOT_A_VOWEL}`, "u");
/**
 * ⚠ A FOURTH RULE, FOR THE MIXED PROFILE THE OTHER THREE CANNOT REACH. `undercover ʌndəkʌvɚ` drops the
 * ⟨r⟩ of `under-` and keeps the final one; `northern nɔɹðən` the reverse; `hindquarters
 * haɪndkwɔɹtəz` likewise. All three rules above ask whether a rhotic is PRESENT — anywhere, in the tail,
 * or in a coda — so any surviving rhotic saves the row, and these stayed as permanent false disagreements.
 *
 * ⚠ THE LOG RECORDED THIS AS NEEDING "A POSITIONAL TEST, WHICH NOTHING HERE CAN DO BECAUSE NO ALIGNMENT
 * EXISTS BETWEEN THE SPELLING'S ⟨r⟩ AND THE READING'S PHONES." It needs no alignment. It needs a COUNT:
 * a spelling with two coda-eligible ⟨r⟩ whose reading carries one coda rhotic has dropped one, and
 * which one does not matter.
 *
 * ⚠ AND THE COUNT ALONE OVER-FIRES, so it is gated on OUR OWN READING — the discriminator this file's
 * French note already names. `Worcester` is "Wooster": its first ⟨r⟩ is silent in GenAm too, our
 * `W UH1 S T ER0` carries one coda rhotic for two spelled ⟨r⟩, and Moby agreeing with us is not RP.
 * Same for `catercorner`, which is "cati-corner". Where we are short too, the row stays.
 * ⚠ IT THEREFORE DOES NOT RUN ON THE OOV CORPUS AT ALL, where there is no second opinion: 34 rows
 * match the count there and none is dropped. Under-firing is the documented safe direction.
 */
const CODA_R_ALL = /[aeiouy]r+(?![aeiouyrh])/gu;
const CODA_RHOTIC_ALL = new RegExp(`[ɚɝ]|[ɹɻr]${NOT_A_VOWEL}`, "gu");
const countOf = (s: string, re: RegExp): number => (s.match(re) ?? []).length;
/** Our coda rhotics in ARPABET: every `ER`, plus an `R` not followed by a vowel. */
function ourCodaRhotics(arpabet: string): number {
    const p = arpabet.split(" ");
    let n = 0;
    for (let i = 0; i < p.length; i++) {
        const b = p[i]!.replace(/[0-2]$/u, "");
        if (b === "ER") { n++; continue; }
        if (b === "R" && !VOWELS.has((p[i + 1] ?? "").replace(/[0-2]$/u, ""))) n++;
    }
    return n;
}
function refereeDropsSomeRhotics(w: string, reads: string[]): boolean {
    const want = countOf(w, CODA_R_ALL);
    if (want < 2) return false;                       // one coda ⟨r⟩ is what rules 1–3 already cover
    if (!reads.every((r) => countOf(r, CODA_RHOTIC_ALL) < want)) return false;
    const mine = ourArpabet.get(w);
    return mine !== undefined && ourCodaRhotics(mine) >= want;
}
const refereeIsNonRhotic = (w: string, reads: string[]): boolean =>
    (SPELLED_R.test(w) && reads.every((r) => !RHOTIC.test(r)))
    || (FINAL_R.test(w) && reads.every((r) => !RHOTIC.test([...r].slice(-3).join(""))))
    || (CODA_R.test(w) && !(SILENT_W.test(w) && reads.every((r) => !/w/u.test(r)))
        && reads.every((r) => !CODA_RHOTIC.test(r)))
    || refereeDropsSomeRhotics(w, reads);
/**
 * ⚠ A SPELLING TEST CANNOT TELL RP FROM A LOANWORD, WHICH THE FIRST DRAFT ASSUMED IT COULD. `-ier`
 * looked reliably French and admits `pliers` (ours `P L AY1 ER0 Z`, rhotic) and `messier` — where Moby
 * has the ASTRONOMER and our headword is the comparative of *messy*. 8 of the 12 rows it exempted have
 * a rhotic dictionary reading, i.e. they are RP rows readmitted by hand.
 * ⚠ THE REAL DISCRIMINATOR IS OUR OWN READING: on a loanword we are r-less TOO and the row passes; on
 * an RP row we have the rhotic and it never can. Where the dictionary has the word, that is exact.
 * ⚠ WHERE IT DOES NOT — the OOV corpus — there is no second opinion, so the `-ier` ending is used as a
 * proxy and nothing else. `-eur`/`-oir` were in the first draft and are NOT here: the ⟨r⟩ of
 * `chauffeur`, `connoisseur`, `liqueur`, `memoir`, `choir` is PRONOUNCED in GenAm, and Moby writes it —
 * an exemption that fires on zero rows today and would retain RP if it ever fired.
 */
const FRENCH_IER = /iers?$/u;

const readings = new Map<string, { lower: string[]; upper: string[] }>();
for (const line of readFileSync(MOBY, "latin1").split(/\r\n|\r|\n/u)) {
    const sp = line.indexOf(" ");
    if (sp < 0) continue;
    rows++;
    const cased = line.slice(0, sp), w = cased.toLowerCase();
    if (imported.has(w)) continue;
    // ⚠ A ROW WHOSE BODY IS A DIFFERENT WORD CANNOT ARBITRATE ANYTHING. See MOBY_DEFECTIVE.
    if (MOBY_DEFECTIVE.has(w)) { defective++; continue; }
    // ⚠ AND A SINGLE CORRUPT READING ON AN OTHERWISE SOUND HEADWORD. Matched on the RAW BODY, before
    // any conversion — the IPA these produce moves whenever a converter rule changes, so keying on it
    // would let a declaration silently stop matching. See MOBY_DEFECTIVE_READING.
    if (MOBY_DEFECTIVE_READING.get(w)?.has(line.slice(sp + 1))) { defectiveReading++; continue; }
    if (!/^[a-z]{2,20}$/u.test(w)) continue;          // no multi-word, no digits, no punctuation headwords
    const a0 = mobyToArpabet(line.slice(sp + 1), w);
    if (!a0) { declined++; continue; }                 // multi-word body / Moby's French sub-scheme
    const inLexicon = dict.has(w);
    // ⚠ THE GEMINATE COLLAPSE IS OOV-ONLY — see the header. `normaliseSuffix` applies to both.
    const fixed = collapseSuffixL(w, fixInitialYod(w, normaliseSuffix(w, a0)));
    const a = inLexicon ? fixed : degeminate(fixed);
    const folded = fold(w, a);
    const ipa = folded.map(sym).join("");
    if (ipa === "" || folded.some((p) => sym(p) === "")) { unmapped++; continue; }
    let e = readings.get(w);
    if (!e) readings.set(w, e = { lower: [], upper: [] });
    const bucket = /^[A-Z]/u.test(cased) ? e.upper : e.lower;
    if (!bucket.includes(ipa)) bucket.push(ipa);
}
let multiReading = 0, nonRhotic = 0;
for (const [w, { lower, upper }] of readings) {
    const all = [...lower, ...upper.filter((r) => !lower.includes(r))];
    // ⚠ EVERY reading must lack the rhotic — a row that carries a rhotic variant can still arbitrate.
    if (refereeIsNonRhotic(w, all)) {
        const ours = ourArpabet.get(w);
        const drop = ours !== undefined ? WE_ARE_RHOTIC.test(ours) : !FRENCH_IER.test(w);
        if (drop) { nonRhotic++; continue; }
    }
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

// ⚠ A DECLARATION THAT NO LONGER MATCHES IS SILENT, and silence here reads exactly like success — the
// row simply comes back. Every declared (headword, body) pair must fire exactly once.
// ⚠ THIS RUNS BEFORE THE WRITES, AND THE FIRST VERSION DID NOT. Throwing after `writeFileSync` leaves
// the corpus ON DISK with the defect restored — the build fails AND the bad row ships, which is the
// worst of both. Nothing may be written until the table is known to have applied.
// ⚠ `imported.has(w)` SHORT-CIRCUITS ABOVE THIS COUNT, so a declared word that later enters
// `moby-import.tsv` stops being seen here and trips the check with a misleading message. That is
// reachable: this table makes exactly these words newly importable, because the corrupt body no
// longer consumes their `seen` slot. `declaredReachable` excludes them so the count stays honest.
const declaredPairs = [...MOBY_DEFECTIVE_READING.values()].reduce((n, b) => n + b.size, 0);
const declaredReachable = [...MOBY_DEFECTIVE_READING.entries()]
    .filter(([w]) => !imported.has(w)).reduce((n, [, b]) => n + b.size, 0);
if (defectiveReading !== declaredReachable)
    throw new Error(`MOBY_DEFECTIVE_READING: ${declaredReachable} declared and reachable (${declaredPairs} total), ` +
        `${defectiveReading} matched — a declaration no longer matches its Moby body`);

const dir = join(REPO, "tools/referee-eval/referees");
writeFileSync(join(dir, "en.moby-lexicon.tsv"), header("words this dictionary carries", lex.length) + lex.join("\n") + "\n");
writeFileSync(join(dir, "en.moby-oov.tsv"), header("words this dictionary does NOT carry — the OOV tier", oov.length) + oov.join("\n") + "\n");
console.log(`moby rows ${rows}, declined ${declined}, unmapped ${unmapped}, defective ${defective}, defective-reading ${defectiveReading}/${declaredPairs}, excluded-as-imported ${imported.size}`);
console.log(`  headwords emitting more than one reading: ${multiReading}`);
console.log(`  dropped as NON-RHOTIC (Moby transcribing RP): ${nonRhotic}`);
console.log(`  en.moby-lexicon.tsv  ${lex.length}`);
console.log(`  en.moby-oov.tsv      ${oov.length}`);
