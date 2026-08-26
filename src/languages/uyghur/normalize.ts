import { NOT_LETTER_AFTER, NOT_LETTER_BEFORE } from "../../core/boundaries.ts";
/**
 * Uyghur / ئۇيغۇرچە (ug) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not
 * already a pronounceable word into words the existing pipeline speaks. Pure text→text; no IPA.
 *
 * ⚠ THERE IS NO FLEURS FOR UYGHUR. The evidence is `tools/corpus/mined/ug.jsonc` — a ug.wikipedia dump of
 * 66,091 paragraphs, 429 mined segments (229 hard + 200 sample), `covered 32/35` — plus `attest.ts` against
 * ug.wikipedia and the wikipron `uig_arab_broad` HUMAN word list that referees the engine. espeak ships no
 * Uyghur at all, so those three are the whole haystack and every count below says which one it came from.
 * Full log: `docs/investigations/ug_normalization_investigation.md`.
 *
 * ⚠ THE DIGIT HAZARD RESOLVES THE OPPOSITE WAY FROM `ps`. Pashto needed an explicit `toAscii` because it
 * writes ۰-۹ four times more often than ASCII; Uyghur writes ASCII — **1,957 ASCII runs against ONE
 * Extended Arabic-Indic run** in the 429 segments, and the artifact's own note says `\d` would miss 13 of
 * 13,772 dump-wide. The class is still written out explicitly rather than as `\d`, because those 13 exist
 * and because `registry.ts` folds native digits for every language before this file runs — so an
 * ASCII-only pattern here would be correct today by accident rather than by construction.
 *
 * ── WHAT THE ENGINE DID BEFORE THIS LAYER, on real corpus shapes ──────────────────────────────────────
 *
 *     1949-يىلى        → miŋ … qiriq toqquz jili     THE HYPHEN IS THE ORDINAL MARKER  (×390)
 *     11.3℃            → ʔon bir . ʔyt͡ʃ sˈiː        the point is a PAUSE; ℃ reads the ENGLISH LETTER C
 *     - 28.7℃          → the minus is SILENT                                          (×8)
 *     9،700،000        → toqquz , jɛttɛ jyz , nøl    the grouping ، is a PAUSE, the tail reads "zero"
 *     كم² / km²        → km (raw) / ˈʊkm skwˈɛɹd     the unit LEAKS; ² read as English "squared"
 *     35%نى            → ʔottuz bɛʃ ni               the sign is SILENT, the suffix is its OWN word (×129)
 *     6.50￥ / 5₺ / $   → the currency sign is SILENT                                  (×16)
 *     29.58° / 113°53  → the degree sign is SILENT                                    (×46)
 *     م.ب. 55          → m b                         the era abbreviation as BARE CONSONANTS
 *     ﭼﻮﻟﭙﯩﻨﻰ          → ""                          EVERY LETTER DELETED (presentation forms)
 *     شەهرىنىڭ         → ʃɛɛriniŋ                    ه read as the VOWEL where it stands for ھ /h/
 *
 * ── WHAT IS DELIBERATELY NOT DONE, each with the check that refused it ────────────────────────────────
 *
 * ⚠ NO DECIMAL-POINT WORD, AND THIS IS THE LAYER'S HIGHEST-TRAFFIC REFUSAL — ~199 decimals in 429 segments,
 *   1,533 dump-wide. `sources.ts` reports `[NONE] decimal-point` (no espeak, no manifest word) and all three
 *   candidates fail on SENSE rather than on silence, which is the refusal the playbook says stands:
 *     · پۈتۈن   ×36 tokens / 15 articles — the ADJECTIVE "whole/entire" in every one (`پۈتۈن يەر شارىدىكى`
 *               "of the entire globe", `پۈتۈن شەھەر` "the whole city"). Never digit-adjacent. Trap 37, and it
 *               is the tempting one, because Uzbek's cognate *butun* IS that language's decimal word.
 *     · نۇقتا   ×11/9 — the geometric/geographic POINT (`ئەڭ ئېگىز نۇقتا` "the highest point", the midpoint
 *               of a circle). It is also the one candidate the wikipron HUMAN referee carries, which is
 *               exactly why the sense had to be read rather than the presence counted.
 *     · چېكىت   ×5/4 — the written DOT as a mark (`ئۈچ چېكىت (؞)`, `چېكىت ئۇرۇلغان`). That is the register
 *               hi's `धन` came from — what the mark is CALLED, not what a reader says between two operands.
 *   So the point is replaced by a SPACE and not by a word: the spurious clause PAUSE goes away, the two
 *   operands stay two numbers, and no word is invented. Stated as the partial fix it is. `sources.ts`'s own
 *   suggestion — read the fraction digit-by-digit — needs the separator named just as much.
 *
 * ⚠ NO `=` READING. The sign is ×39 and genuinely arithmetic (`72.647دىنار=بىر دوللار`, `IQ = …`), so this
 *   refusal is about the WORD. `تەڭ` is ×5 whole-word in the corpus and ×4 in the wikipron referee, and
 *   every corpus instance is the ADJECTIVE "equal" — `كۆلىمىگە تەڭ` ("equal to the area of"), `تەڭ ھوقۇقلۇق`
 *   ("equal rights"), `تەڭ پايدا` ("equal benefit"). Not one is digit-adjacent. Trap 37 with the count on the
 *   wrong side, and `ff hakkunde` is what happens when a real word is put in a slot it does not take.
 *
 * ⚠ NO `+` AND NO `×`. `+` is ×8 and none of it is arithmetic: `+86/27` dialling codes ×3, `451 + 389 pp.`
 *   (a page count), `180=120t+16t2` (a formula), `24+3`, and two lines of forum spam. `×` is ×3 and is a
 *   DIMENSION CROSS (`68 ×105 مېتىرلىق مەيدان`, a football pitch — that reads "by", not "times") plus
 *   scientific notation (`1015× Hz30`). Trap 48's finding, in a corpus small enough to read entire.
 *
 * ⚠ NO `&` READING. All 9 instances are markup or English: `&nbsp;` ×4 (removed as an entity below),
 *   `&amp;quot;` ×1, two lines of forum spam, `Heath, EG & Chiara` (an English citation) and `510 بەت &
 *   1013 بەت`. There is no Uyghur ampersand to source from that.
 *
 * ⚠ NO RANGE CONNECTIVE. `digit–digit` is ×47 and the reading is not an infix: Uyghur spans a range with the
 *   CIRCUMFIX `-دىن … -غىچە` ("from … until"), which needs case suffixes on BOTH operands and therefore both
 *   operands as words. That is trap 14's fix shape applied to a class whose connective is not attested as an
 *   infix anywhere — the `ff hakkunde` refusal, a preposition asked to be an infix. The corpus's own
 *   `1918-1941-يىلىدىكى` shows the convention: the ordinal lands on the SECOND operand, which step 7 does
 *   claim, and the pair is left as the juxtaposition it already was. `～` (×10, a fullwidth tilde used as a
 *   range mark under Chinese influence) is refused for the same reason.
 *
 * ⚠ NO CLOCK. `HH:MM` is ×3 in 429 segments and all three are wiki signature timestamps
 *   (`20:39, 30 دېكابىر 2006 (UTC)`). There is no clock class in this corpus to build a rule from — the
 *   artifact's `clock` cell is populated by `414.69دەرھەم = بىر دوللار` exchange-rate lines, not by times.
 *
 * ⚠ NO FRACTIONS. `D/D` is ×15 digit-adjacent and almost none of it is a fraction: `windows3. 1/95/98/2000/xp`,
 *   `dos2. 0`, dates, `120km/skt`, `مگ/دل`. The one real instance is `1/15 نى` ("one fifteenth of"). The
 *   reading is recoverable in principle — ug.wikipedia writes `«ئۈچتە 60 پىرسەنت»`, i.e. the LOCATIVE on the
 *   denominator — but composing it needs vowel harmony and consonant assimilation on every denominator word,
 *   which is a morphology this file would have to derive for one attested instance. Recorded for a later run.
 *
 * ⚠ NO INITIALISMS. `letter-name` is 678 dump-wide (`GNU`, `PLO`, `DSF`, `PPP`, `G7`, `ISBN`, `5A دەرىجىلىك`)
 *   and `core/initialisms.ts` is a NO-OP without a letter-name table. `sources.ts` reports
 *   `[NONE] letter-names — espeak does not ship this language at all`, and that is the true blocker rather
 *   than a scope judgement (trap 16 says measure it, so: measured). ⚠ ONE LEAD FOR THE NEXT RUN — the corpus
 *   writes `ئوچۇقۋ.ئەم.ئەس`, i.e. Latin letter names transliterated into Uyghur script, which is the shape
 *   ps's partial table came from. One gloss is not 26 letters, and ps records why a partial table is the
 *   wrong ship.
 *
 * ⚠ NO REGNAL ORDINAL, AND THE REASON IS AN ORDERING SEAM RATHER THAN A SOURCING ONE. All 8 roman numerals in
 *   the artifact's `roman` cell are regnal (`ئېدۋارد VIII`, `ئېلىزابېت II`, `فېلىپ VI`, `مۇستاپا III`, …),
 *   225 dump-wide, and every one currently reads as a CARDINAL (`ʔedwɑrt sɛkkiz`). `core/roman.ts` is applied
 *   in `registry.ts` WRAPPING `engine.text()`, so the numerals are already digits by the time this file runs —
 *   trap 39 at the registry level: the guard's evidence (the roman shape) has been spent upstream. What is
 *   left is `Uyghur-word + digit`, which is the commonest shape in the language (`ئاينىڭ 21`, `2007 نوپۇس`),
 *   so keying on it would be uz's regnal misfire generator (trap 9). This needs `ROMAN_POLICIES`, which is a
 *   shared-file change and therefore the reviewer's call, not a side effect of one language's rules.
 */
/** ASCII + Extended Arabic-Indic + Arabic-Indic. Written out because `\p{Nd}` would also admit Devanagari
 *  and friends, and because the ENGINE's own number token is `\d+` — the two must agree or a rule can emit
 *  a digit the tokenizer will not read. See the header for why the eastern arms are near-dead here. */
const D = "0-9۰-۹٠-٩";
/** "not inside a word", the trap-1/23 form: `\p{M}` beside `\p{L}`, never `\b`. */
/** A number with an optional decimal tail — the operand every symbol rule takes. Anchored to END in a digit
 *  so the class cannot eat a trailing clause comma (trap 14's second hazard). */
const NUM = `[${D}]+(?:[.][${D}]+)?`;
/** Every dash the corpus writes between a numeral and its ordinal noun, including the TATWEEL. U+0640 is
 *  normally letter elongation, but elongation cannot follow a DIGIT, so the digit anchor makes it safe:
 *  `1912 ـ يىلىدىن` and `6 ـ نوپۇس` are ×7, and the only two in-word tatweels are `ـــ` rules. */
const DASH = "[-‐‑–—ـ]";

const EASTERN: Record<string, string> = {
    "۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4", "۵": "5", "۶": "6", "۷": "7", "۸": "8", "۹": "9",
    "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4", "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9",
};
const toAscii = (s: string): string => [...s].map((c) => EASTERN[c] ?? c).join("");

/**
 * ⚠ THE ERA ABBREVIATIONS, AND THE MULTI-PART ONES FIRST OR THE ERA READS AS ITS OWN OPPOSITE. This is
 * `ps`'s `م.ز`-before-`م` coupling in another language: `م.ب` is BEFORE the Common Era and `م.ك` is AFTER it,
 * and both begin with the `م` of the bare AD marker. Claiming `م` first would emit "AD" and strand the
 * second letter as a bare consonant — which is what the engine does today (`م.ب. 55` → `m b`).
 *
 * EVERY EXPANSION IS THE CORPUS'S OWN WORD, AND THE CORPUS GLOSSES ITSELF — the strongest attestation there
 * is, and the same one ps's era table rests on. Counted over the 429 mined segments:
 *
 *     م.ب / م ب   ×17   →  مىلادىدىن بۇرۇن   ×4, and once in the SAME SENTENCE as its own abbreviation:
 *                          `مىلادىدىن بۇرۇنقى 1100 – م. ب. 771 ئارىسى`
 *     م.ك         ×1    →  مىلادىدىن كېيىن   ×2  (`مىلادىدىن كېيىن گۇتلار`, `مىلادىدىن كېيىن بۇ يەر`)
 *     م.          ×3    →  مىلادى            ×2  (`ھىجرى 309 (مىلادى 922)` beside `ھ. 35 - يىلى / م. 656- يىلى`)
 *     ھ.          ×2    →  ھىجرىيە           ×5  (`ھىجرى 892 - 939 / مىلادى 1487`)
 */
const ERA: readonly (readonly [string, string])[] = [
    [`م\\s?\\.?\\s?ب`, "مىلادىدىن بۇرۇن"],
    [`م\\s?\\.?\\s?ك`, "مىلادىدىن كېيىن"],
    [`م`, "مىلادى"],
    [`ھ`, "ھىجرىيە"],
];
/** ⚠ THE ABBREVIATION'S OWN TRAILING DOT, WHICH THE FIRST VERSION OF THIS RULE FORGOT AND WHICH SILENTLY
 *  DISARMED THE TWO-LETTER ARMS. The corpus writes `م.ب. 55` — a dot after EACH letter — so a body pattern
 *  ending at `ب` followed by `\s*(?=digit)` never reached the year at all, and `م.ب. 55 - م.ك. 410` still
 *  read `m . p . … m . k .`: the rule typechecked, ran, and did nothing. Caught only by probing the
 *  corpus's own line rather than the shape I had in mind. */
const ERA_TAIL = `\\s?\\.?\\s*`;
/** The first word of every ERA expansion, for the ordinal rule's guard — see step 7. */
const ERA_HEADS = "مىلادى|ھىجرىيە";

/**
 * ⚠ THE UNIT TABLE IS LOCAL RATHER THAN `makeSymbolNormalizer`, and the reason is trap 47's third: the
 * shared tier runs AFTER this file, and this file spends the decimal point at step 13. A tier rule
 * downstream of that has no number-unit adjacency left to match on, and its `NOT_VERSION` guard — which
 * works by SEEING THE DOT — would have nothing to reject. Same position ps, fa and ckb are in.
 *
 * ⚠ ONLY MULTI-LETTER KEYS (traps 28/46). A bare `m` key would claim the corpus's heavy Latin residue and
 * any `802.11m`-shaped designation; `version-dot` is 92 dump-wide here, so the exposure is real.
 *
 * SOURCING. `كىلومېتىر` ×53 in the corpus and a wikipron referee headword (/k i l o m e t i r/); `مېتىر` ×15
 * and likewise a referee headword; `كىلوگرام` ×1. The SQUARED word is `كۋادرات` and it is PREPOSED — ×27 in
 * the corpus as `كۋادرات كىلومېتىر` and ×54 tokens / 14 articles on ug.wikipedia in the same collocation
 * (`960 مىڭ كۋادرات كىلومېتىر`, `41260 كۋادرات كىلومېتىر`). That is trap 37's test done properly: the
 * evidence is the collocation, never the bare modifier. The corpus writes `كم²`/`km²` ×20 AND the words ×27,
 * i.e. it glosses its own symbol.
 */
const UNITS: readonly (readonly [string, string])[] = [
    // longest key first — `km²` before `km`, or the exponent is orphaned and read as an English word.
    ["km²", "كۋادرات كىلومېتىر"], ["km2", "كۋادرات كىلومېتىر"],
    ["كم²", "كۋادرات كىلومېتىر"], ["كم2", "كۋادرات كىلومېتىر"],
    ["km", "كىلومېتىر"], ["كم", "كىلومېتىر"],
    ["kg", "كىلوگرام"],
];

/**
 * ⚠ THE BOUND CASE SUFFIX ON A PERCENT IS RE-DERIVED, NEVER COPIED — trap 14, and kmr's written-glide
 * lesson in another shape. Uyghur writes the suffix after the SIGN or after the NUMBER, and it has to agree
 * with the WORD that replaces them, which does not exist until this rule has run:
 *
 *     35%نى   ×27 (19 glued + 8 spaced)      %60تىن  ×11 on the prefix side
 *     4%ى     ×3                             %1كە
 *     99% دىن ×4
 *
 * The written form is chosen from the DIGITS and is wrong for `پىرسەنت`, which ends in a voiceless ت: the
 * ablative after it is `تىن`, not `دىن`; the dative `كە`, not `غا`; the locative `تا`, not `دا`. So the map
 * below normalises to the ت-stem form rather than gluing what the writer typed, and `44 پېرسەنتىنى` — the
 * corpus's own fully spelled-out instance — is exactly what `4%ىنى` comes out as.
 *
 * ⚠ AND THE LIST IS CLOSED, BECAUSE MOST WORDS AFTER A `%` ARE NOT SUFFIXES. Of the 28 glued `%WORD`
 * instances, 25 are case suffixes and 3 are ordinary words (`%پورتۇگال`, `%ئىسلام`, `%زىمىننى`); of the 31
 * spaced ones, 14 are suffixes and 17 are ordinary words (`% ئورمانلىق`, `% تېرىلغۇ`, `% كاتولىك`). An open
 * "digits + short token" arm would read every one of those 20 as morphology — trap 15's own warning.
 */
const PCT_SUFFIX: readonly (readonly [string, string])[] = [
    // longest first, so `تىنى` is not truncated to `تىن`.
    ["تىنى", "ىنى"], ["ىنى", "ىنى"], ["نىڭ", "نىڭ"], ["ىنىڭ", "ىنىڭ"],
    ["دىن", "تىن"], ["تىن", "تىن"], ["نى", "نى"], ["كە", "كە"], ["گە", "كە"],
    ["غا", "كە"], ["قا", "كە"], ["دا", "تا"], ["تا", "تا"], ["ى", "ى"],
];
const PCT_ALT = [...PCT_SUFFIX].sort((a, b) => b[0].length - a[0].length).map(([w]) => w).join("|");
const PCT_MAP = new Map(PCT_SUFFIX);
/** ⚠ RE-SPACED, NEVER RE-EMITTED VERBATIM: the corpus writes `35%نى` with no space anywhere, so returning
 *  the capture would weld the number onto the word (trap 26 — a rewrite must not change how its neighbours
 *  tokenize). And the word is not emitted twice when the corpus already wrote it (trap 12). */
const percent = (n: string, suf: string | undefined): string =>
    `${n} پىرسەنت${suf === undefined ? "" : (PCT_MAP.get(suf.trim()) ?? "")} `;

export interface UyghurNormalizerDeps {
    /** Non-negative integer → its Uyghur numeral SPELLING (not IPA). Supplied by the engine so this file
     *  needs no import from `uyghur.ts` — which would be a cycle, since the engine calls the normalizer.
     *  The `make…Normalizer(deps)` shape is the playbook's documented convention for exactly this. */
    numeralWords: (n: number) => string;
}

/**
 * THE UYGHUR ORDINAL, COMPOSED from the cardinal rather than tabulated (trap 8: a table is correct exactly
 * where you looked; trap 13: pin the branches, not the corpus's instances).
 *
 * The formation was read off the corpus's OWN spelled-out ordinals — 23 of them in the 429 segments — and it
 * has exactly three branches, each of which the corpus exercises:
 *
 *     consonant-final   + ىنچى     بىرىنچى · ئۈچىنچى · بەشىنچى · توققۇزىنچى
 *     ى-final           + نچى      ئىككىنچى                       (ئىككى + نچى)
 *     ە-final           drop ە, + ىنچى   يەتتىنچى · يىگىرمىنچى     (يەتتە → يەتت, يىگىرمە → يىگىرم)
 *
 * and one structural fact the corpus also supplies: in a MULTI-WORD numeral the suffix lands on the LAST
 * word only — `ئون بەشىنچى ئەسىرىدىن` ("from the fifteenth century"), against the same corpus's `15-ئەسىردىن`.
 * That is the pair that makes this rule attested rather than inferred; there are three more like it
 * (`بەشىنچى ئەسىردە`/`5- ئەسردە`, `يەتتىنچى ئاسىردىن`/`7-ئەسىردىن`, `توققۇزىنچى ئورۇندا`/`12 -ئورۇندا`).
 *
 * Composing rather than tabulating is what reaches the values the corpus is silent about — 6 (`ئالتە`) takes
 * the ە-branch it never writes, 40/50/60 (`قىرىق`/`ئەللىك`/`ئاتمىش`) the consonant branch, 100 and 1000
 * (`يۈز`/`مىڭ`) likewise. Diffing the rule against itself over 1–30 plus the round tens, 100 and 1000 is
 * what checked those, and the enumeration is pinned in `test/uyghur.test.ts`.
 */
function ordinalWord(n: number, cardinal: (v: number) => string): string {
    const words = cardinal(n).trim().split(/\s+/u);
    const last = words[words.length - 1];
    if (words.length === 0 || last === undefined || last === "") return "";
    const stem = last.endsWith("ە") ? last.slice(0, -1) : last;
    words[words.length - 1] = stem.endsWith("ى") ? `${stem}نچى` : `${stem}ىنچى`;
    return words.join(" ");
}

/** Build the Uyghur normalizer. See `UyghurNormalizerDeps` for why this is a factory. */
export function makeUyghurNormalizer({ numeralWords }: UyghurNormalizerDeps) {
    return function normalizeUyghur(input: string): string {
        // 1) NFC at the entry. Arabic-script text mixes precomposed and decomposed forms, so a rule keyed
        //    on a literal would otherwise match a fraction of its instances (trap 11). The engine NFCs
        //    again downstream, so this costs nothing.
        let s = input.normalize("NFC");

        // 2) HTML ENTITIES, before anything can read one as letters. `&nbsp;` ×4 in the mined segments.
        s = s.replace(/&nbsp;|&#(?:x[0-9a-f]+|\d+);/giu, " ").replace(/﻿/gu, "");

        // 3) ⚠ ARABIC PRESENTATION FORMS — 2,367 characters across 8 of the 429 mined segments, and those 8
        //    segments read as the EMPTY STRING today: the engine's TOKEN class is U+0620–U+06FF, so
        //    U+FB50–U+FDFF and U+FE70–U+FEFF match nothing at all and every letter is deleted
        //    (`ﭼﻮﻟﭙﯩﻨﻰ ﺷﺎﻛﻮﺋﯩﻞ` → ""). This is the largest single reading defect in the corpus and it is
        //    invisible to every DROP class, which hunt a symbol that SURVIVES.
        //    ⚠ NFKC PER CHARACTER, OVER A CURATED RANGE — never `s.normalize("NFKC")` (trap 36). Blanket
        //    NFKC would fold `²` to `2` and erase step 8's exponent, fold `…` into three clause breaks, and
        //    fold `￥` into `¥` under step 12's feet. Restricted to the two presentation blocks the fold is
        //    exact: 83 of the 86 distinct forms in the corpus map to their correct Uyghur letter (ﯞ→ۋ, ﮬ→ھ,
        //    ﯔ→ڭ, ﯧ→ې, ﻼ→لا), which was checked by enumerating them rather than assumed.
        //    ⚠ AND THE OTHER THREE ARE THE HEH, WHICH NFKC GETS WRONG FOR UYGHUR — caught by the corpus
        //    diff's SAMPLE tier and by nothing else, which is exactly what that tier is for. The legacy
        //    presentation encoding uses the PLAIN heh forms U+FEE9-U+FEEC for BOTH the vowel ە U+06D5 and
        //    the consonant ھ U+06BE, and NFKC flattens all four onto ه U+0647 — so step 4 below then read
        //    every one as /h/ and `ﺧﻪﻟﻖ` (خەلق, "people") came out *χhlq* for *χɛlq*.
        //    The split is decidable from the FORM: ە has no initial or medial shape in Uyghur, so an
        //    ISOLATED or FINAL plain heh is the vowel and an INITIAL or MEDIAL one is the consonant.
        //    `ﻫﻪﺳﻪﻥ` — ھەسەن, the name Hesen — carries both in one word and settles it.
        //    ⚠ THE DOACHASHMEE FORMS NEED NO ARM AND THE HEH-GOAL ONES ARE UNREACHABLE, both measured
        //    rather than assumed: ﮪ-ﮭ U+FBAA-U+FBAD already NFKC to ھ U+06BE itself, and ﮦ-ﮩ U+FBA6-U+FBA9
        //    fold to the Urdu heh-goal ہ U+06C1, which the grapheme table does not carry and would
        //    therefore DROP — ×0 in the 429 mined segments and ×0 in the golden, so it is recorded here
        //    rather than keyed.
        s = s.replace(/[ﭐ-﷿ﹰ-﻿]/gu, (c) => (c === "ﻩ" || c === "ﻪ" ? "ە" : c.normalize("NFKC")));  // BOM

        // 4) ⚠ ه U+0647 → ھ U+06BE. The Arabic heh is NOT a letter of the Uyghur alphabet — Uyghur writes /h/
        //    as ھ (×1,099 here) and the vowel /ɛ/ as ە U+06D5 — but writers type it anyway (×40), and the
        //    manifest maps it to the VOWEL, so `شەهرىنىڭ` read *ʃɛɛriniŋ* for *ʃɛhriniŋ* and `مۇهىم` lost its
        //    /h/ too. Folded here rather than in `uyghur.jsonc` because this is an orthographic-variant
        //    question — the same class as step 3 — and because the manifest value is still the right
        //    fallback for any path that reaches the g2p without passing through this file.
        //    ⚠ IT IS ALSO RIGHT FOR THE EMBEDDED FOREIGN TEXT the corpus carries: most of these 40 sit in a
        //    quoted Persian paragraph and an Arabic hadith, where ه is /h/ as well. The fold is a strict
        //    improvement in both, which is why it is unconditional.
        s = s.replace(/ه/gu, "ھ");

        // 4b) ⚠ TWO MORE LETTERS OF THE SAME FAMILY, both found by `silentCharsIn` producing NOTHING.
        //    ک U+06A9 KEHEH ×5 — the Persian/Urdu shape of the kāf Uyghur writes ك U+0643 (×2,891 here).
        //    Same letter, other keyboard: `کربلا → rblɑ`, `کار → ɑr`, the /k/ gone.
        //    ڧ U+06A7 ×19 — QAF WITH DOT ABOVE standing in for ف. This one is decided by its own word list
        //    rather than by the glyph, and the list is unanimous: ڧىنلاندىيە (Finland ×3 + 5 inflections),
        //    ڧېۋرال (February), ئاڧرىقا (Africa), تەرەڧلەر, تەڧسىر — 15 of 15 words are ordinary Uyghur words
        //    whose standard spelling has ف, and NOT ONE is a /q/ word, so the Maghrebi reading of the glyph
        //    (where ڧ IS the qāf) would be wrong in every instance. Uyghur has no /f/ and the manifest reads
        //    ف as [p], so `ڧىنلاندىيە` now gives pinlandije — the actual Uyghur pronunciation.
        //    ⚠ ی U+06CC ×35 IS NOT FOLDED WITH THEM, deliberately. Every one of its 24 words is PERSIAN
        //    (برای, تاریخ, قمری, شیعه, شیرازی) — a Persian span inside a Uyghur article, which the detector's
        //    same-script filter cannot separate — and Uyghur, unlike Persian, keeps ي /j/ and ى /i/ APART, so
        //    the unified Farsi yeh has no single Uyghur value to fold to. Left reported rather than guessed.
        //    ⚠ AND THE HAMZA-CARRIER ALIFS ARE THE SAME REFUSAL, FOUND BY THE C# PORT'S CENSUS AND RECORDED
        //    HERE SO THE NEXT RUN DOES NOT HAVE TO RE-MEASURE IT. أ إ آ ء (U+0623/0625/0622/0621) are absent
        //    from `uyghur.jsonc`, so the g2p DELETES them: ×19 tokens in the 429 mined segments and ×7 in
        //    the 200 golden rows, and every one sits inside an embedded ARABIC quotation — a duʿā and the
        //    sūra title `سورة الإسراء` in the golden, the hadith paragraph in the corpus. Uyghur itself
        //    never writes them (the hamza is always the carrier ئ, ×0 counter-examples), so the value they
        //    would take is an ARABIC one this engine has no referee for — wikipron `uig_arab_broad` carries
        //    no headword with any of them. Same shape as ی above: measured, reported, not guessed.
        s = s.replace(/ک/gu, "ك").replace(/ڧ/gu, "ف");

        // 5) ERA MARKERS, digit-anchored, and ABOVE the ordinal rule at step 7 for two separate reasons.
        //    (a) The abbreviation's anchor is the YEAR'S DIGITS, and step 7 turns those into words — running
        //        after it would leave `م. 656- يىلى` with no digit for `م\.` to attach to (trap 39).
        //    (b) Step 7's own two-letter guard is what rejects these abbreviations in the first place; see
        //        the ERA_HEADS note there for the false positive this ordering CREATES and how it is closed.
        //    ⚠ THE DIGIT MAY BE ON EITHER SIDE. `م.ب. 55` and `1100 – م. ب. 771` are both attested, and so is
        //    the free-standing `م.ب. بىرنىچى مىڭ يىلنىڭ` — but a marker with no digit anywhere near it is not
        //    claimed, because bare `م:` in this corpus is `مەسىلەن` ("for example"), a different word.
        //    ⚠ THE BARE ARMS REQUIRE THEIR DOT, THE TWO-LETTER ARMS DO NOT. `م` and `ھ` are ordinary Uyghur
        //    letters and a word may end in either, so `م` alone against a digit would claim the last letter
        //    of any word before a numeral; the abbreviating DOT is what makes them abbreviations. `م.ب` and
        //    `م.ك` are already unambiguous as pairs and the corpus writes both `م.ب 130` and `م. ب 1250`.
        for (const [body, word] of ERA) {
            const dot = body === "م" || body === "ھ" ? "\\s?\\." : "";
            s = s.replace(new RegExp(`${NOT_LETTER_BEFORE}${body}${dot}${ERA_TAIL}(?=[${D}])`, "gu"), `${word} `);
        }

        // 6) DIGIT DE-GROUPING, before the ordinal so a grouped operand is one number, and before every
        //    other numeric rule. A grouping mark is otherwise read as CLAUSE PUNCTUATION and the tail as a
        //    number in its own right — `9،700،000` read as "nine, seven hundred, ZERO".
        //    ⚠ THE TWO MARKS AND THE DOT DO NOT OVERLAP AT ALL HERE, which is a cleaner split than any of
        //    the Perso-Arabic precedents had. Measured over the 429 segments:
        //        ،  with 3-digit groups  ×21      ،  with a 1–2 digit tail  ×0
        //        ,  with 3-digit groups  ×11      ,  with a 1–2 digit tail  ×0
        //        .  as a decimal        ×199      .  as a thousands mark    ×0
        //    Every `D.DDD` instance read (`72.647دىنار=بىر دوللار`, `1.575`, `83.541`) is an exchange RATE,
        //    i.e. a decimal — so unlike Pashto there is no dot arm here, and unlike Kurmanji there is no
        //    group-size discriminator to write. The mark decides, and it decides cleanly.
        //    ⚠ THE TRAILING GUARD EXCLUDES A FOLLOWING SEPARATOR+DIGIT, not a clause mark, or a number
        //    followed by its own sentence comma would lose its last group and speak it as zero.
        for (const mark of ["،", ","]) {
            s = s.replace(
                new RegExp(`(?<![${D}.,،])[${D}]{1,3}(?:(?<!(?<![${D}])0)${mark}[${D}]{3})+(?![${D}]|${mark}[${D}])`, "gu"),
                (w) => w.replace(new RegExp(mark, "gu"), ""),
            );
        }

        // 7) ⚠ THE HYPHENATED ORDINAL — THIS LANGUAGE'S DEFINING RULE, 390 instances in 429 segments, more
        //    than every other class in this file put together. Uyghur marks an ordinal by writing the
        //    numeral, a hyphen, and the noun: `1949-يىلى` ×132, `9-ئاينىڭ` ×36, `21-كۈنى` ×26, `5-ئەسىردە`,
        //    `306-ماددا`, `11-مارت`, `12-ئورۇندا`. The engine drops the hyphen and reads a bare CARDINAL.
        //
        //    ⚠ THIS IS TRAP 14, AND IT IS WHY THIS RULE EMITS WORDS WHERE EVERY OTHER RULE HERE EMITS DIGITS.
        //    The ordinal suffix attaches to the LAST WORD of the spoken numeral, and at digit time there is
        //    no word to attach it to. See `ordinalWord` for the three-branch formation and its attestation.
        //
        //    ⚠ THE NOUN IS RE-EMITTED (trap 10) — it carries its own case and possessive (`يىلى`,
        //    `يىلىدىن`, `كۈنىگىچە`), none of which this rule touches.
        //
        //    ⚠ THE FOLLOWING WORD MUST BE AT LEAST TWO LETTERS, AND THAT GUARD IS THE WHOLE FALSE-POSITIVE
        //    STORY. Tabulating all 390: 384 have a 2+-letter noun and every one of those is a real ordinal;
        //    the 6 one-letter cases are ALL an era abbreviation on the far side of a range dash —
        //    `م.ب. 55 - م.ك. 410`, `1100 – م. ب. 771`, `207 — م. 220`. Without the guard the first date of
        //    every BC range would read as an ordinal.
        //    ⚠ AND STEP 5 RE-CREATES THAT FALSE POSITIVE, WHICH IS WHY ERA_HEADS EXISTS. The era rule has
        //    just turned those one-letter abbreviations into multi-letter WORDS, so `55 - مىلادىدىن كېيىن`
        //    now passes a guard written against `55 - م`. The lookahead rejects exactly the words step 5
        //    writes — an ordering coupling that only exists because of the order, and that is invisible in
        //    either rule read alone (trap 39's general form: a guard's evidence has a lifetime).
        //
        //    ⚠ TWO COSTS, BOTH COUNTED AND BOTH ACCEPTED. `50-گرادۇسقا` (×1) is "50 degrees" and comes out as
        //    an ordinal; and inside `70 -90-بەتلەر` (a page RANGE, ×3 for `بەت`) the second operand takes the
        //    ordinal. 4 of 390. The alternative — a closed noun list — is trap 8's table, correct exactly
        //    where I looked: the tail of that tally is 76 distinct nouns and 40 of them occur once.
        s = s.replace(
            new RegExp(`${NOT_LETTER_BEFORE}([${D}]+)\\s*${DASH}\\s*(?=(?!${ERA_HEADS})[\\u0620-\\u06FF]{2,})`, "gu"),
            (whole: string, num: string) => {
                const n = Number(toAscii(num));
                if (!Number.isSafeInteger(n) || n < 1) return whole;
                const w = ordinalWord(n, numeralWords);
                return w === "" ? whole : `${w} `;
            },
        );

        // 8) UNITS, before decimals — the number-unit adjacency a unit rule matches on is destroyed the
        //    moment step 13 rewrites the decimal point (the playbook's standing coupling) — and after
        //    de-grouping, so a grouped operand is already one token. See UNITS for the sourcing and for why
        //    the shared tier cannot own this. `450,295 km²` read as `ˈʊkm skwˈɛɹd`, English through the
        //    Latin fallback, and `1،145.6 كم²` leaked a raw `km`.
        //    ⚠ A MAGNITUDE WORD MAY SIT BETWEEN THE NUMBER AND ITS UNIT, and without an arm for it the unit
        //    is not adjacent to anything. `10 مىڭ كم²` ("ten thousand km²") and `36.6 مىلىيون كىلومېتر²`
        //    are 2 of the corpus's 20 exponents, and the playbook records this as a real fleet-wide tier gap
        //    (7 utterances in 7 languages) that a language may close LOCALLY. The magnitude is re-emitted
        //    where it stands — it belongs inside the quantity, not after the unit noun.
        const MAG = `(?:\\s(?:مىڭ|مىليون|مېليون|مىلىيون|مىليۇن|مېليۇن|مىليارد|مىليارت|مېليارت|تۈمەن))?`;
        for (const [sym, word] of UNITS) {
            const key = sym.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
            /**
             * ⚠ A BOUND CASE SUFFIX MAY BE GLUED STRAIGHT ONTO A LATIN UNIT KEY, and the flat `\p{L}` guard
             * declines the whole match when it is. Measured, and it is this artifact's only unit leak:
             * `1-1.5kgغىچە` ("up to 1–1.5 kg") read as `… kɡ ʁit͡ʃɛ` — `kg` IS declared and `1.5 kg` reads
             * `kiloɡrɑm` correctly; the only difference is the suffix. Same family as the `%`+suffix shape
             * this file already handles above, arriving on the unit instead of the sign.
             *
             * ⚠ THE RELAXATION IS FOR LATIN KEYS ONLY, and that restriction is the whole safety argument. A
             * Latin `km`/`kg` cannot CONTINUE into an Arabic-script letter — the script change IS the word
             * boundary — so widening the guard there can only ever admit a suffix. Doing the same for the
             * Arabic keys would be a different and much worse bet: `كم` relaxed to allow any following
             * letter would start biting into ordinary Uyghur words that happen to open with those two
             * characters, which is the exact hazard the `%` docblock records for an open suffix arm.
             *
             * ⚠ AND THE SUFFIX IS RE-EMITTED AS WRITTEN, NOT RE-DERIVED — the deliberate opposite of the
             * percent rule two blocks up, and the reason is stated because the asymmetry looks like an
             * oversight. There the written suffix is chosen for the DIGITS and is systematically wrong for
             * `پىرسەنت` (a voiceless-ت stem), so 27+11 instances gave the evidence to rebuild it. Here there
             * is ONE instance in the whole corpus, and its `غىچە` already agrees with `كىلوگرام` (back
             * vowel), so there is nothing to correct and no sample to build a harmony table from. Leaving
             * the author's own morphology in place is the conservative reading; inventing agreement rules
             * from a single token is trap 22.
             *
             * ⚠ A GLUED NEXT WORD IS NOT A SUFFIX, AND ⟨ئ⟩ IS WHAT TELLS THEM APART. The relaxation above
             * also reaches `180kmئېگىزلىكتە` ("at a height of 180 km"), where the corpus has simply left
             * the space out between the unit and the NEXT WORD; gluing there would emit one fused token.
             * ⟨ئ⟩ U+0626 is Uyghur's word-initial vowel carrier: every vowel-initial WORD opens with it and
             * no suffix ever does (`-غا -نى -دىن -لىق -تىن -گە -چە -دا` are the whole shape), so it is an
             * orthographic word boundary rather than a lexical guess. A space is restored before it and
             * nowhere else. Measured on that sentence: `ˈʊkm ʔeɡizliktɛ` → `kilometir ʔeɡizliktɛ` — a
             * SECOND leak closed, and one the raw-Latin scan could not see, since `km` was reaching the
             * English fallback rather than being echoed byte-for-byte.
             */
            const tail = /^[A-Za-z]/u.test(sym) ? "A-Za-z" : "\\p{L}";
            s = s.replace(
                new RegExp(`(?<![\\p{L}\\p{M}${D}.,،])(${NUM}${MAG})\\s?${key}(?![${tail}\\p{M}${D}²])(ئ?)`, "gu"),
                (_m, q: string, hamza: string) => `${q} ${word}${hamza === "" ? "" : ` ${hamza}`}`,
            );
        }
        //    ⚠ AND THE UNIT NOUN IS OFTEN ALREADY SPELLED OUT WITH A BARE `²` HANGING OFF IT
        //    (`36.6 مىلىيون كىلومېتر² لىق`). No symbol key can reach that, because there is no symbol — the
        //    exponent has to be lifted onto the WORD, in the preposed position `كۋادرات` takes.
        s = s.replace(
            new RegExp(`${NOT_LETTER_BEFORE}(كىلومېت[ىې]?ر|مېت[ىې]?ر|مىتىر)\\s?²`, "gu"),
            "كۋادرات $1",
        );

        // 9) ⚠ THE MINUS, AND `ps`'s GUARD IS EXACTLY INVERTED HERE. Pashto reads a sign GLUED to its digit
        //    and rejects the spaced form; in this corpus it is the other way round, and the measurement is
        //    what says so. Reading all 36 `[space or bracket] - digit` instances:
        //
        //        ×8   a REAL negative, spaced   `ئەڭ تۆۋەن تېمپېراتۇرىسى - 28.7℃`   (the lowest temperature)
        //        ×19  a RANGE dash              `1066 - 1154` · `892 - 939` · `90 −120 مېتىر` · `8 - 9 مىليون`
        //        ×9   a stray LEADING dash, GLUED, opening a clause   `. -2006يىلى مۇقىم تېلپون`
        //
        //    So the glued form is the one that is never a minus, and neither the left context nor the space
        //    separates the other two. THE RIGHT CONTEXT DOES (trap 24, and hi reached the same shape from
        //    the opposite direction): every one of the 8 is followed by a TEMPERATURE, and not one of the 19
        //    ranges is. Zero counter-examples on both arms.
        //    ⚠ AND IT MUST RUN ABOVE STEP 10, which spends the `°C` this guard reads (trap 39).
        //    ⚠ THE WORD IS `مىنۇس` and it is sourced twice over: a wikipron HUMAN referee headword
        //    (/m i n u s/) and ×7 tokens / 5 articles on ug.wikipedia — in BOTH registers, as the sign's
        //    name (`مىنۇس بەلگىسى`, "the minus sign") and, which is the one that matters, as a reading in
        //    front of a quantity: `يىللىق خاتالىق مىنۇس 0.9 دەقىقە` ("the annual error is minus 0.9
        //    minutes"). PREPOSED in every instance.
        s = s.replace(new RegExp(`(^|[\\s(\\[])[-−–]\\s?(${NUM})(?=\\s?°\\s?[CF])`, "gui"), "$1مىنۇس $2");

        // 10) DEGREES. `°C` BEFORE the bare `°`, or the scale letter is stranded and read as the ENGLISH
        //     letter name — which is what happens today: `11.3℃` → `ʔon bir . ʔyt͡ʃ sˈiː`. (`℃` itself is
        //     already `°C` by now: `registry.ts` folds it for every language before `text()` runs.)
        //     ⚠ THE WORD IS `گرادۇس`, ATTESTED IN BOTH SLOTS AND IN NEITHER'S BARE FORM. ×33 tokens / 14
        //     articles on ug.wikipedia and every one is the DEGREE OF ARC — `45 گرادۇس`, `0 گرادۇس پارالېلى`
        //     ("the 0-degree parallel"), `90 گرادۇس شىمال پارالېلى` — which is exactly the slot the corpus's
        //     40 coordinate degrees need; and ×1 in the corpus itself in the TEMPERATURE slot
        //     (`ئەڭ تۆۋەن تېمپىراتۇراسى 50-گرادۇسقا يېتىدۇ`). Both positions are POSTPOSED.
        //     ⚠ THE SCALE NAME IS DROPPED, AND THAT IS A PARTIAL FIX, STATED. `سېلسىي` is ×0 on
        //     ug.wikipedia — `sources.ts` reports `[NONE] scale-names` and the wiki confirms it — so `20°C`
        //     reads "20 degrees" rather than "20 degrees Celsius". That is a real loss and it replaces a
        //     confidently wrong English letter, which is the trade ps made for the same class.
        //     ⚠ AND THE ARC-MINUTE IS LEFT UNREAD. `113°53` is 113°53′; the minutes get no word, because
        //     none is attested. Same partial as ps's bare `°`, in the other half of the class.
        s = s.replace(new RegExp(`(?<![${D}.,،])(${NUM})\\s?°\\s?[CF]${NOT_LETTER_AFTER}`, "gui"), "$1 گرادۇس");
        s = s.replace(new RegExp(`(?<![${D}.,،])(${NUM})\\s?°`, "gu"), "$1 گرادۇس ");

        // 11) PERCENT — ×129 signs in 429 segments and every one of them is silent today.
        //     ⚠ BOTH ORDERS OF THE SIGN, AND BOTH EMIT THE POSTPOSED WORD. Uyghur writes it after the number
        //     (`35%` ×72) and also before it, Arabic-style (`%60` ×56) — a postfix-only rule would miss 43%
        //     of the class. The word's POSITION is settled by the corpus and the wiki rather than assumed:
        //     `44 پېرسەنتىنى`, `90 پېرسەنت تاشقى سودىسى` in the corpus; `12.06 پىرسەنت بولغان`,
        //     `6.83 پىرسەنت ئاشقان`, `92 پېرسەنت` on the wiki. POSTPOSED in all five.
        //     ⚠ THE SPELLING IS THE MAJORITY ONE, AND BOTH ARE REAL. `پىرسەنت` ×31 tokens / 9 articles
        //     against `پېرسەنت` ×3 / 2 — so the wiki picks the first and the mined corpus's own two
        //     instances are the second. One spelling had to be chosen; the loser is recorded here rather
        //     than dropped, because it is not an error.
        //     See PCT_SUFFIX for the bound-suffix half, which is the trap-14 part of this rule.
        //     ⚠ THE SUFFIX GROUP CARRIES ITS OWN TRAILING GUARD, INSIDE THE OPTIONAL BRACKET. Written as
        //     `(SUF)?(?![\p{L}\p{M}])` the guard applies to the whole match, so `%پورتۇگال` — an ordinary
        //     word after the sign, ×20 of these — matched nothing at all and left the `%` in the text as a
        //     RAWMARK: the rule failed exactly where it most needed to fall back. Inside the bracket the
        //     alternation backtracks to "no suffix" instead, so `%نىسبەت` reads as the sign plus its own
        //     word while `%نى` still reads as the sign plus its case.
        const PCT_TAIL = `(?:(${PCT_ALT})${NOT_LETTER_AFTER})?`;
        //     ⚠ AND THE WORD MAY ALREADY BE THERE (trap 12) — the reading must say it ONCE. ×0 in this
        //     corpus, so this arm is robustness rather than a measured repair, and it says so.
        const NAMED = `(\\s*پ[ېى]رسەنت)?`;
        //     ⚠ TWO PERCENT SIGNS, AND THE ARABIC ONE WAS MISSED BY THE FIRST VERSION OF THIS RULE. `%` is
        //     ×129 and `٪` U+066A is ×4 (`٪12.9نى ئىگىلەيدۇ`, `٪56.08نى`) — small, but they are exactly the
        //     instances the artifact scan still reported as `DROP percent` after the ASCII arm landed, which
        //     is what a differential gate is for. `﹪` U+FE6A and `％` U+FF05 are both ×0 and are not keyed.
        s = s.replace(
            new RegExp(`(${NUM})\\s?[%٪]\\s?${NAMED}${PCT_TAIL}`, "gu"),
            (_m: string, n: string, named: string | undefined, suf: string | undefined) =>
                named === undefined ? percent(n, suf) : `${n} ${named.trim()}${suf ?? ""} `,
        );
        s = s.replace(
            new RegExp(`[%٪]\\s?(${NUM})\\s?${NAMED}${PCT_TAIL}`, "gu"),
            (_m: string, n: string, named: string | undefined, suf: string | undefined) =>
                named === undefined ? percent(n, suf) : `${n} ${named.trim()}${suf ?? ""} `,
        );

        // 12) CURRENCY. Three signs occur and all three have a corpus- or wiki-attested name in slot:
        //     ￥ ×8   يۈەن   — every instance is the price of a book published in Ürümqi (`47.00￥`), i.e.
        //                     Chinese yuan. `يۈەن` is ×8 digit-adjacent in the corpus (`10 مىڭ يۈەندىن`,
        //                     `297 مېليون يۈەن`, `5000 يۈەنگە`) and ×86/19 on the wiki. ⚠ The bare token is
        //                     a trap: `يۈەن سۇلالىسى` is the Yuan DYNASTY and `جۇيۈەن` a place — trap 37,
        //                     which is why the monetary instances were counted separately.
        //     ₺ ×6   لىرا   — self-glossed in the very sentence that carries the sign
        //                     (`تۈرك لىراسى … (5₺, 10₺, …)`), and the wiki does it again: `₺10 (لىرا)`.
        //     $ ×2   دوللار — ×56 in the corpus, a wikipron referee headword, everywhere digit-adjacent.
        //     ⚠ `￥` IS U+FFE5 AND IS NOT FOLDED UPSTREAM — `foldFullwidthLatin` stops at letters and digits
        //     (deliberately, see its header), so the fullwidth sign has to be a key here. `¥` U+00A5 is ×0 in
        //     this corpus and rides along with it because it is the same sign, not a second currency.
        //     ⚠ `US$` BEFORE `$`, or the `US` is left to the Latin fallback as two English letter names.
        for (const [sign, word] of [["US\\$", "ئامېرىكا دوللىرى"], ["\\$", "دوللار"], ["[￥¥]", "يۈەن"], ["₺", "لىرا"]] as const) {
            s = s.replace(new RegExp(`${sign}\\s?(${NUM})`, "gu"), `$1 ${word} `);
            s = s.replace(new RegExp(`(${NUM})\\s?${sign}`, "gu"), `$1 ${word} `);
        }

        // 13) DECIMALS, LAST, because every rule above needs the number intact — and the separator is
        //     replaced by a SPACE rather than by a word. See the header for the three candidates and why
        //     each was refused on SENSE; this is the honest half of that refusal, since leaving the mark
        //     alone means leaving a spurious CLAUSE PAUSE in the middle of 1,533 quantities.
        //     ⚠ SUBSTITUTE, NEVER DELETE (trap 26). Deleting the point would turn `11.3` into `113` — a
        //     different quantity, i.e. confidently wrong, which is the one outcome worse than the pause.
        //     ⚠ AND THE TRAILING GUARD MUST REJECT A FOLLOWING `.`+DIGIT, which is what keeps an IP address
        //     out. `203.173.138.159` is a designation; without the guard the engine matches `203.173`, is
        //     happy because the next character is a dot rather than a digit, and splits the address up.
        //     Written as `\.[D]` rather than a bare `.` deliberately: a decimal that ENDS a sentence
        //     (`11.3.`) is followed by a dot too, and must still be read.
        //     ⚠ AND THE GUARD DOES NOT REJECT A FOLLOWING LETTER, which is where `ps`'s pattern had to be
        //     changed rather than copied. Pashto excludes one so a decimal cannot bite into a unit; here
        //     step 8 has already claimed every unit, and what is left glued to a decimal is the corpus's
        //     ordinary typography — `414.69دەرھەم`, `72.647دىنار=بىر دوللار`, `1.575لېۋ` — 18 exchange-rate
        //     lines that a letter guard silently left with the pause still in them.
        s = s.replace(
            new RegExp(`(?<![${D}.])([${D}]+)\\.([${D}]+)(?![${D}]|\\.[${D}])`, "gu"),
            "$1 $2",
        );

        return s;
    };
}
