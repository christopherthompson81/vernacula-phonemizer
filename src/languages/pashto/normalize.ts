import { NOT_LETTER_AFTER, NOT_LETTER_BEFORE } from "../../core/boundaries.ts";
import { spacedBareExponent } from "../../core/normalizeSymbols.ts";
/**
 * Pashto / پښتو (ps) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not
 * already a pronounceable word into words the existing pipeline speaks. Pure text→text; no IPA.
 *
 * ⚠ THERE IS NO FLEURS FOR PASHTO. The evidence is `tools/corpus/mined/ps.jsonc` (dump-sourced, 178,645
 * segments, so its `sample` tier IS the real distribution) plus a fresh ps.wikipedia dump — 242,649 lines
 * after `wikidump-to-text.py` + `filter-markup.py` + a local category-residue drop. Every count below is
 * over that file. Full log: `docs/investigations/ps_normalization_investigation.md`.
 *
 * ⚠ AND EVERY PATTERN HERE USES AN EXPLICIT DIGIT CLASS, NEVER `\d`. Pashto writes Extended Arabic-Indic
 * ۰-۹ (U+06F0) mostly, Arabic-Indic ٠-٩ (U+0660) sometimes and ASCII sometimes — routinely all three in one
 * article. `\d` would miss 46,314 of the artifact's 54,969 digit runs. Word boundaries are
 * `(?<![\p{L}\p{M}])`, never `\b` (playbook trap 1), and `\p{M}` is beside `\p{L}` everywhere (trap 23).
 *
 * WHAT THE ENGINE DID BEFORE THIS LAYER, on real corpus shapes — the defect list, not an assumption:
 *
 *     ۲۰۱۸ز کال     → … z کال                  THE ERA MARKER AS A BARE CONSONANT (×38,810)
 *     ۱۹مه نېټه     → نولس  مه  نېټه            three tokens where the language has two (×12,779)
 *     ۳۲۱،۰۰۰       → درې سل او یوویشت , صفر    the grouping ، is a PAUSE and the tail reads "zero"
 *     ۷۸.۸          → اته اویا . اته            the decimal dot is a SENTENCE BREAK
 *     ۲۵٪ / 25%     → پنځه ویشت                 the sign is SILENT (×5,156)
 *     ۱۹۶۵-۱۹۷۵     → two cardinals, no connective                        (×10,181)
 *     ۱۰:۳۰         → لس , دېرش                 the colon is a PAUSE
 *     ۵ km          → پنځه ˈʊkm                 the unit reaches the IPA as a RAW CLUSTER
 *     $۱۰۰ / -۵ / ° → the sign is SILENT
 *
 * ── WHAT IS DELIBERATELY NOT DONE, each with the check that refused it ────────────────────────────────
 *
 * ⚠ NO `=` AND NO `+`, AND BOTH REFUSALS ARE ABOUT THE COUNT RATHER THAN THE WORD. `=` counts 7,734 and
 *   almost none of it is arithmetic: it is wiki HEADING markup that `wikidump-to-text.py` leaves in
 *   (`==خوي او عادتونه==`) plus chemistry (`P1=750mmHg`). `+` counts 2,001 and is CHEMICAL EQUATIONS
 *   (`2KMnO4+10FeSO4+8H2SO4`, `Cl2+2NaOH`). A reading built on a contaminated count is worse than silence.
 *
 * ⚠ NO `×`. Its 196 instances are four different things in one glyph — a cartridge dimension (`۳۹×۷،۶۲`),
 *   scientific notation (`1.60218 × 10 −13`), an engine count (`۲ × Lyulka AL-37FU`) and genuine
 *   arithmetic (`1×8 + 90×8`). No single reading is right for all four.
 *
 * ⚠ NO `&`. All 297 instances sit inside LATIN text — `AT&T`, `P&T`, `Sight & Sound`, `N4 & N405`, and URL
 *   query strings. Reading it as `او` would put a Pashto word inside an English name.
 *
 * ⚠ NO INITIALISMS — AND THIS REFUSAL HAS NOW BEEN WRONG TWICE BEFORE BEING MEASURED PROPERLY.
 *   v1 said "espeak ships no Pashto at all", which was a false negative from an unset `$ESPEAK_NG`.
 *   v2 said `ps_list`'s letter-name table is "exactly the data `core/initialisms.ts` needs". ⚠ IT IS NOT.
 *   That table names the ARABIC alphabet (ا alif, ب be:, پ pe:); the runs that actually break are LATIN —
 *   `DNA`, `RNA`, `GDP`, `CIA` — and what the seam needs is the Pashto reading of a LATIN letter name.
 *   espeak has nothing to say about that. Third over-claim from the same source, so here is the measurement.
 *
 *   (1) THE CLASS IS CONTAMINATED. Of 23,014 all-caps Latin runs, 2,122 are CHEMICAL symbols (CH x611,
 *       CO x359, OH x307, NH, PH, SO) and 1,336 are ROMAN NUMERALS (II x283, III x159). Reading `CO` as
 *       "see-oh" inside a formula is worse than leaving it, and the roman pass upstream already owns
 *       II/III. 19,654 remain as candidate acronyms — DNA x740, RNA x411, ISBN x212, GDP x150, CIA x127.
 *   (2) THE CORPUS DOES GLOSS ITSELF, which is the one good sign: `روسي آر اېن اې RNA`,
 *       `سره ډي اېن اې DNA`, `ايچ آی وي (HIV`, `اچ آی وي` x23. So Pashto writes Latin letter names in
 *       Arabic script, and 15 of 26 are recoverable — A اې · D ډي · F اېف x94 · H اچ/ايچ · I آی ·
 *       L اېل x127 · M اېم x77 · N اېن x292 · Q کيو x112 · R آر · S اېس x231 · V وي · W ډبليو x85 ·
 *       X اېکس x146 · Z زېډ x2.
 *   (3) ELEVEN ARE NOT: B C E G J K O P T U Y. Their short forms (بي، سي، ډي، جي، پي) are ordinary Pashto
 *       words — `کې` alone is x458,151 — so a substring count cannot attest them, and aligning the gloss
 *       pattern returns function words (د، په، چې) rather than letter names.
 *
 *   A PARTIAL TABLE IS THE WRONG SHIP. `GDP` needs G and P, `CIA` needs C, `ISBN` needs B — the
 *   highest-traffic acronyms here are exactly the ones the missing eleven block, so the table would spell
 *   out the rare acronyms and skip the common ones. That is worse than uniform silence, and it is the shape
 *   trap 13 warns about: coverage of the instances you happened to source is not coverage of the rule. The
 *   seam is wireable the day the other eleven are attested — `attest.ts` against a Pashto wiki is the next
 *   instrument — and this refusal is now re-runnable in one grep.
 *
 * ⚠ NO EXPONENT WORD. `sources.ts` reports the sign occurring with no reading anywhere, and the corpus
 *   writes area as the WORDS `متر مربع` ×446 rather than `m²`, so the symbol form is a Latin-text residue
 *   with no Pashto collocation to source a modifier from (trap 37 wants `<word> <unit-noun>`, and there is
 *   none). `km²` is read as the unit noun with the exponent dropped; that is a PARTIAL fix and is stated.
 *   ⚠ THE REFUSAL IS ABOUT THE WORD, NOT ABOUT THE DIGITS, and step 5a now draws that line. Declining to
 *   invent a Pashto modifier is right; deleting a magnitude the corpus DID write is not, and this corpus
 *   writes scientific notation ×5 — `2×10³⁰`, `3 x 10²⁶`, `10¹¹–10¹²`, `7.2 x 10¹³ jouls/kg`, `4×10¹³` —
 *   every one of which read as bare *lˈəs* ("ten"). Those five rows now keep their exponent as DIGITS.
 *   `km²` is unchanged, and so is the refusal above.
 */

/** ASCII + Arabic-Indic + Extended Arabic-Indic. Written out because `\p{Nd}` would also admit Devanagari
 *  and friends, and because the ENGINE's own `DIGIT_CLASS` is exactly this set — the two must agree or a
 *  rule can emit a digit the tokenizer will not read. */
const D = "0-9۰-۹٠-٩";
/** "not inside a word", the trap-1/23 form: `\p{M}` beside `\p{L}`, never `\b`. */
const EASTERN: Record<string, string> = {
    "۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4", "۵": "5", "۶": "6", "۷": "7", "۸": "8", "۹": "9",
    "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4", "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9",
};
const toAscii = (s: string): string => [...s].map((c) => EASTERN[c] ?? c).join("");

/** ⚠ ERA MARKERS ARE THIS LANGUAGE'S DEFINING CLASS — 48,286 instances across four abbreviations, more
 *  than every other normalization class in Pashto put together, and every one of them currently reaches the
 *  IPA as a BARE CONSONANT (`۲۰۱۸ز` → "…z"). Each expansion is the corpus's own word, counted:
 *
 *      ز  →  زېږديز  ×1,717   (زېږديز 1,210 / زېږدیز 507)   CE            ×38,810
 *      م  →  میلادي  ×1,167   (میلادي 741 / ميلادي 426)     AD            ×5,321 (see the digit guard)
 *      ل  →  لمريز   ×2,655   (لمريز 1,572 / لمریز 1,083)   solar Hijri   ×1,848
 *      هـ →  هجري    ×1,431                                 Hijri         ×1,283
 *
 *  The corroboration is that each abbreviation and its expansion occupy the SAME SLOT: `زېږديز کال` ×372,
 *  `لمريز کال` ×727, `ميلادي کال` ×244, beside `Nز کال` ×30,549. The wiki writes both forms of the same
 *  phrase, which is the strongest attestation there is — the source document glosses itself. */
const ERA: readonly (readonly [string, string])[] = [
    // longest body first, and the qualified Hijri forms before bare هـ — `۶۳هـ ق` is Hijri LUNAR (هجري
    // قمري ×199) and `۱۴۰۰ هـ ش` Hijri SOLAR (هجري شمسي ×26), so claiming bare هـ first would strand the
    // qualifier as a one-letter token. Same multi-part-before-single-part coupling the dotted rules use.
    ["هـ\\s?ق", "هجري قمري"],  // tatweel
    ["هـ\\s?[شس]", "هجري شمسي"],  // tatweel
    ["هـ\\s?ل", "هجري لمريز"],  // tatweel
    ["هـ\\.?", "هجري"],  // tatweel
    // ⚠ `م.ز` IS BC AND MUST BE CLAIMED BEFORE THE BARE `م`, or the era is read as its own OPPOSITE. It is
    // written four ways — `م.ز` ×128, `م ز` ×382, `م‌ز` (ZWNJ-joined) ×21, `مز` ×4 — and every instance read
    // is a pre-Common-Era date: `افلاطون (۴۲۹ تر ۳۴۷ م‌ز)` is Plato, `۱۳۳۶ م.ز.` is Akhenaten. The bare `م`
    // arm below would take the `م`, emit میلادي (AD) and leave the `ز` stranded as a consonant — which is
    // exactly what the corpus diff caught. The expansion is the corpus's own word: `مخزېږديز` ×641.
    [`م\\s?[.‌ ]?\\s?ز`, "مخزېږديز"],  // ZWNJ
    // `ز.ک` ×53 — the era letter plus an abbreviated کال. Claimed whole so the `ک.` is not left behind.
    ["ز\\s?\\.\\s?ک\\.?", "زېږديز کال"],
    // `ل ل` ×629 and `ل.ل` ×30 are the doubled form (لمريز + a second ل), always the same year slot as the
    // single one; both read as the one word rather than inventing a reading for the repetition.
    ["ل\\s?\\.?\\s?ل", "لمريز"],
    ["ل\\.?", "لمريز"],
    ["ز\\.?", "زېږديز"],
    // ⚠ `م` IS SAFE HERE ONLY BECAUSE STEP 2 HAS ALREADY RUN. It is the same letter as the ordinal suffix,
    // and what disambiguates them is the operand's size (see ORD_SUFFIX) — so the ordinal rule claims every
    // `Nم` below 100 first, and whatever bare `م` still stands against a digit at this point is a year.
    // Reversing these two steps would read `۲۰م پېړۍ` (the 20th century) as "20 AD".
    ["م\\.?", "میلادي"],
];

/** ⚠ THE ORDINAL SUFFIX AND THE `م` ERA MARKER ARE THE SAME LETTER, and that collision is the central
 *  design problem of this layer. Tabulating what FOLLOWS each shape separates them cleanly (trap 4):
 *
 *      Nمه  ×8,863   نېټه 1,089 · پېړۍ 398 · لسیزه 314 · ماده 104     → ORDINAL
 *      Nمې  ×3,916   پېړۍ 828 · لسیزې 641 · نېټې 334                  → ORDINAL
 *      Nم   ×6,151   کال 3,409 · زېږدي 184 · زېږيز 56                 → ERA, mostly
 *
 *  So `مه`/`مې` are unambiguously the ordinal and are claimed first (longest form first). Bare `م` is the
 *  one genuine ambiguity, and the DIGIT COUNT settles it: of its 6,151 instances 5,005 are 4-digit — years — and
 *  830 are under 100, which is the ordinal's range (`۲۰م پېړۍ`, the 20th century). The rule therefore reads
 *  `م` as an ordinal below 100 and as the era at 100 and above. Cost stated: a 3-digit AD year like the
 *  corpus's `۹۹۸ م کلونو` lands on the era arm, which is right, and a hypothetical `۱۰۰م` ordinal would not
 *  — zero such instances exist. */
const ORD_SUFFIX = ["مه", "مې", "م"] as const;

/**
 * The Pashto ordinal, COMPOSED from the cardinal rather than tabulated (trap 8: a table is correct exactly
 * where you looked and silent everywhere else; trap 13: pin the branches, not the corpus's instances).
 *
 * The formation was read off the corpus's own ordinal words, and it has exactly three irregular cells:
 *
 *      regular      cardinal + م            څلورم 1,166 · شپږم 619 · لسم 286 · شلم 30 · دېرشم 51
 *      ه-final      drop the ه, then + م    پنځم 607 · اووم 324 · اتم 381 · نهم 248 · شپېتم 12
 *      ا-final      add ه, then + م         اویاهم 44        (اویام is ×0 — the ه is not optional)
 *      1  SUPPLETIVE   لومړی ×8,275 / لومړۍ ×5,873 — NOT یوم, which is ×22
 *      2  irregular    دویم ×2,473 (+ دوهم 1,556, دويم 1,235) — NOT دوم, which is ×54
 *      3  irregular    درېیم ×794 (+ درېيم 430) — درېم is only ×134
 *
 * ⚠ THE SUFFIX IS WHATEVER THE TEXT WROTE. Pashto marks gender and case on the ordinal (م / مه / مې) and
 * the corpus supplies it, so this function never has to guess agreement — it appends the written form to
 * the stem it computed. That is what keeps the rule composable: `۱۹۸۰مې` reaches the compositional branch
 * (last cardinal word اتیا → اتیاه + مې), which no table of attested ordinals would have covered.
 */
function ordinalWords(n: number, suffix: string, cardinal: (v: number) => string): string {
    const tail = suffix.slice(1); // "" | "ه" | "ې" — the gender/case vowel the text chose
    if (n === 1) return suffix === "م" ? "لومړی" : "لومړۍ";
    if (n === 2) return `دویم${tail}`;
    if (n === 3) return `درېیم${tail}`;
    const words = cardinal(n).trim().split(/\s+/u);
    if (words.length === 0 || words[0] === "") return "";
    const last = words[words.length - 1]!;
    // The stem alternation. `ه` is the cardinal's own final vowel and the ordinal replaces it; `ا` cannot
    // carry the suffix directly and takes a linking ه first.
    const stem = last.endsWith("ه") ? last.slice(0, -1) : last.endsWith("ا") ? `${last}ه` : last;
    words[words.length - 1] = `${stem}${suffix}`;
    return words.join(" ");
}

/** ⚠ THE UNIT NOUN FOLLOWS THE NUMBER IN PASHTO, which is what the shared tier can express — but the tier
 *  runs AFTER this file and this file rewrites the decimal point into a WORD, so a unit rule downstream of
 *  that has no number-unit adjacency left to match (traps 39/46/47 reason 3). Handled locally, above the
 *  decimal step, for exactly that reason.
 *
 *  THE SPELLINGS ARE THE CORPUS'S OWN, and the corpus overwhelmingly writes these units as WORDS rather
 *  than symbols — کیلومتره ×1,007, متر ×1,345, سانتي ×653, کيلو ×531, متر مربع ×446 — against Latin `km`
 *  ×67. So this table is not the main way Pashto says a measurement; it exists because the Latin residue
 *  that DOES occur reaches the IPA as a raw consonant cluster (`۵ km` → `پنځه ˈʊkm`), which is the defect.
 *
 *  ⚠ ONLY MULTI-LETTER KEYS (traps 28/46). A bare `m` key would claim `802.11m`-shaped designations and,
 *  worse here, ordinary Latin fragments inside the corpus's heavy English-language residue. */
const UNITS: readonly (readonly [string, string])[] = [
    // longest key first — `km²`/`km2` before `km`, or the exponent is orphaned and read as a number.
    ["km²", "کیلو متر مربع"], ["km2", "کیلو متر مربع"],
    ["m²", "متر مربع"], ["m2", "متر مربع"],
    ["km", "کیلومتره"], ["cm", "سانتي متره"], ["mm", "ملي متره"], ["kg", "کیلوګرامه"],
];

export interface PashtoNormalizerDeps {
    /** Non-negative integer → its Pashto numeral spelling. Supplied by the engine so this file needs no
     *  import from `pashto.ts` — which would be a cycle, since the engine calls the normalizer. The
     *  `make…Normalizer(deps)` shape is the playbook's documented convention for exactly this. */
    numeralWords: (n: number) => string;
}

/** Build the Pashto normalizer. See `PashtoNormalizerDeps` for why this is a factory. */
export function makePashtoNormalizer({ numeralWords }: PashtoNormalizerDeps) {
    /** Every rule that touches a number emits DIGITS wherever the value itself is spoken, so the engine's
     *  own numeral path stays the single place a number becomes words. The ORDINAL rule is the one
     *  exception, and it has to be: a suffix cannot be applied to a digit run (trap 14). */
    return function normalizePashto(input: string): string {
        // 0) NFC at the entry. Arabic-script text mixes precomposed and decomposed forms and carries
        //    presentation-form variants, so a rule keyed on a literal would otherwise match a fraction of
        //    its instances (trap 11). The engine NFCs again downstream, so this costs nothing.
        let s = input.normalize("NFC");

        // 1) HTML ENTITIES, before anything can read one as letters.
        //    ⚠ THE ZERO-WIDTH NON-JOINER IS DELIBERATELY LEFT ALONE. It occurs ×22,590 and it is not
        //    debris in this script: it marks a morpheme seam inside a word (`سون‌توکو`). The engine's TOKEN
        //    class already excludes U+200C, so it is ALREADY a token boundary and the reading is correct;
        //    deleting it would FUSE two words into one, which is the trap-18/26 failure in reverse.
        s = s.replace(/&nbsp;|&#(?:x[0-9a-f]+|\d+);/giu, " ").replace(/[﻿]/gu, "");

        // 2) ORDINALS — before the era rule, because `مه`/`مې` are longer than the era's bare `م` and the
        //    two are the same letter (see ORD_SUFFIX for the tabulation that separates them).
        //    ⚠ THIS IS TRAP 14, AND IT IS WHY THIS RULE EMITS WORDS WHERE EVERY OTHER RULE EMITS DIGITS.
        //    A gender/case suffix written after the DIGITS has to agree with the WORDS, and at digit time
        //    there is no word to agree with: `۱۹مه نېټه` read as `نولس مə نېټه` — three tokens where
        //    Pashto has two, the suffix stranded as its own word. The fix shape is the documented one —
        //    convert the operand to words inside the rule and apply the morphology there.
        for (const suffix of ORD_SUFFIX) {
            const cutoff = suffix === "م" ? 100 : Infinity; // the bare-`م` era/ordinal split, see ORD_SUFFIX
            s = s.replace(
                new RegExp(`${NOT_LETTER_BEFORE}([${D}]+)\\s?${suffix}${NOT_LETTER_AFTER}`, "gu"),
                (whole: string, num: string) => {
                    const n = Number(toAscii(num));
                    if (!Number.isSafeInteger(n) || n < 1 || n >= cutoff) return whole;
                    const w = ordinalWords(n, suffix, numeralWords);
                    return w === "" ? whole : w;
                },
            );
        }

        // 3) ERA MARKERS. After the ordinal rule (see above) and BEFORE de-grouping, because a marker can
        //    sit against the year's last digit and the de-grouping patterns look at digit runs.
        //    ⚠ `ق.م` IS DIGIT-ANCHORED, AND THAT GUARD IS THE WHOLE RULE. A bare `ق\.?\s?م` counts 2,695 in
        //    this corpus and 2,499 of those are `قم` INSIDE ORDINARY WORDS — قمچينونه, قمر, and the Iranian
        //    city قم. Anchored to a digit it is 196, every one a real BC year (`۱۸۹۴ ق.م. کال`,
        //    `د ۳۰۵ ق م نه واخلې تر ۱۸۰ ق م پورې`). This is the playbook's own Urdu قم/قمری example
        //    reproduced in another language, which is why the count was read before it was used (trap 2).
        //    The expansion is the corpus's dominant phrase: `له ميلاد څخه مخکې` ×526.
        s = s.replace(
            new RegExp(`([${D}])\\s*ق\\s*\\.?\\s*م\\s*\\.?${NOT_LETTER_AFTER}`, "gu"),
            "$1 له ميلاد څخه مخکې",
        );
        //    ⚠ THE TRAILING GUARD MUST REJECT A ZWNJ AS WELL AS A LETTER. U+200C is category `Cf`, so
        //    `(?![\p{L}\p{M}])` treats it as a word END — and Pashto joins abbreviations with it, so `م‌ز`
        //    passed the guard, the `م` arm fired, and a BC date read as `میلادي‌ز`: the right era's opposite
        //    plus an orphaned consonant. A guard meaning "not inside a word" has to know what this script
        //    uses to stay inside one.
        for (const [body, word] of ERA) {
            s = s.replace(new RegExp(`([${D}])\\s?${body}(?![\\p{L}\\p{M}‌])`, "gu"), `$1 ${word}`);  // ZWNJ
        }

        // 4) DIGIT DE-GROUPING. A grouping mark is otherwise read as CLAUSE PUNCTUATION and the tail as a
        //    separate number — `۳۲۱،۰۰۰` read as "three hundred twenty-one, ZERO", because `،` is in the
        //    engine's `clausePunctuation` and `۰۰۰` is a number in its own right.
        //
        //    ⚠ THE TWO MARKS DO NOT BEHAVE ALIKE, AND THAT IS THE MEASUREMENT THIS RULE RESTS ON. Pashto
        //    writes both as separators, but not for the same job:
        //
        //        ،  D{1,3}(،D{3})+   1,468   multi-group 168   followed by a magnitude word  12
        //        .  D{1,3}(.D{3})+     527   multi-group  35   followed by a magnitude word  42
        //
        //    Every `،`-with-3-digits instance read is a grouping (`۵۱،۰۰۰ هکټاره`, `۴۱۹،۲۶۴،۰۰۰ اتباعو`).
        //    The `.` ones are mostly NOT — `15.744 ميلیونه ټنه`, `3.180 کیلوګرامه`, `۱۰.۵۳۹ میلیونه نفوس`,
        //    `4.0026 u` are DECIMALS, and `192.168.2.10` is an IP address. So the discriminator here is the
        //    MARK, not the group size — the opposite of the structural rule other languages needed — and
        //    only the unambiguous MULTI-group dot form is de-grouped.
        //
        //    ⚠ THE TRAILING GUARD EXCLUDES A FOLLOWING SEPARATOR+DIGIT, NOT A CLAUSE MARK, or a number
        //    followed by its own sentence comma would have its last group split off and spoken as zero.
        s = s.replace(new RegExp(`(?<![${D}.,،])([${D}]{1,3})((?:(?<!(?<![${D}])0)،[${D}]{3})+)(?![${D}]|،[${D}])`, "gu"),
            (w) => w.replace(/،/gu, ""));
        s = s.replace(new RegExp(`(?<![${D}.,،])([${D}]{1,3})((?:(?<!(?<![${D}])0),[${D}]{3})+)(?![${D}]|,[${D}])`, "gu"),
            (w) => w.replace(/,/gu, ""));
        //    The DOT form only in its multi-group shape (×35), where a decimal reading is impossible.
        s = s.replace(new RegExp(`(?<![${D}.,،])([${D}]{1,3})((?:(?<!(?<![${D}])0)\\.[${D}]{3}){2,})(?![${D}]|\\.[${D}])`, "gu"),
            (w) => w.replace(/\./gu, ""));
        //    ⚠ THERE IS NO SPACE ARM, AND THAT IS A MEASUREMENT RATHER THAN AN OMISSION. `D{1,3}( D{3})+`
        //    matches 115 times and NOT ONE of them is a Western-style space grouping. They are phone
        //    numbers (`90 510`, `+1 613 745-1576`, `059 133`), data-table columns
        //    (`22 1 6 266 6 انگور 17 4 13 504 28 كيله`), page references (`مخ. 8 148`) and a netmask
        //    (`192.168.2.10 255.255.255.0`). The corpus diff caught the cost of having one: a pesticide
        //    dose `30 130-140ml/ha` — a quantity followed by a RANGE — was merged into `30130`. Pashto
        //    groups with `،` (×1,517) and `,` (×1,959); it does not group with a space, so the arm would be
        //    pure exposure. ⚠ Note the RTL shapes like `۰۰۰ ۱۰ ۴۵۲ کیلومتر مربع` (10,452,000) are already
        //    out of reach — the middle group is two digits — which is lucky rather than guarded, and is the
        //    other reason not to widen this.

        // 5) UNITS, before decimals — the number-unit adjacency a unit rule matches on is destroyed the
        //    moment a decimal is rewritten (the playbook's standing coupling) — and after de-grouping, so a
        //    grouped operand is already one token. The operand carries its own decimal tail for the same
        //    reason. See UNITS for the sourcing and for why one-letter keys are excluded.
        for (const [sym, word] of UNITS) {
            const key = sym.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
            s = s.replace(
                new RegExp(`(?<![\\p{L}\\p{M}${D}.,،])([${D}]+(?:[.,،][${D}]+)?)\\s?${key}(?![\\p{L}\\p{M}${D}])`, "gu"),
                `$1 ${word}`,
            );
        }

        // 5a) A BARE EXPONENT'S DIGITS, after the unit rule above and never before it — `km²` is the unit's
        //     and step 5 must have first claim, exactly as the shared tier orders the same pair.
        //     ⚠ THE HEADER'S EXPONENT REFUSAL STANDS AND THIS DOES NOT WEAKEN IT. There is still no Pashto
        //     modifier word to source (`متر مربع` ×446 is the WORDS, not a reading for the symbol), so `km²`
        //     keeps reading as the unit noun with the power dropped. What changes is the case that has no
        //     unit at all: this corpus writes SCIENTIFIC NOTATION ×8 — `2×10³⁰ باکتریاوې`, `3 x 10²⁶
        //     باکتریاوې`, `10¹¹–10¹²`, `4.1×10¹⁰ m³` — and every one of them read as bare *lˈəs* ("ten"),
        //     the magnitude gone. `sources.ts` reports the sign with no reading, which is a refusal to
        //     INVENT a word; it is not a reason to delete the digits the corpus did write.
        //     A letter base, a negative and a lone ⁰/¹ are all declined by the shared pass — see it for why.
        s = spacedBareExponent(s);

        // 6) DEGREES — the scale word is `سانتيګراد` ×100, of which ×56 sit directly after a number, so both
        //    the word and its POSITION are attested. `۲۴ سانتيګراد` is the corpus's own phrasing.
        //    ⚠ THE BARE `°` IS LEFT ALONE. Of its 288 instances the majority are COORDINATES
        //    (`3°22'30"W`, `40°N`, `45°17.460′N`) and there is no attested Pashto reading for the degree of
        //    arc or for the primes. Reading the scale but not the bare sign is a PARTIAL fix, and the
        //    alternative it replaces was `°C` → a bare English letter name [siː].
        s = s.replace(
            new RegExp(`(?<![${D}.,،])([${D}]+(?:[.,،][${D}]+)?)\\s?°\\s?[CcسS]${NOT_LETTER_AFTER}`, "gu"),
            "$1 سانتيګراد",
        );
        s = s.replace(new RegExp(`(?<![${D}.,،])([${D}]+(?:[.,،][${D}]+)?)\\s?℃`, "gu"), "$1 سانتيګراد");

        // 7) THE CLOCK, before the range rule — a colon must not be left for a rule looking at bare numbers,
        //    and `sources.ts` had no clock tier at all. The idiom is the corpus's, written out in full:
        //    **`۷ بجې او ۲۰ دقیقې`**. `بجې`/`بجو` ×434 (×252 directly after a number), `دقیقې` ×289, and the
        //    connective `او` is the ordinary conjunction the same sentence uses.
        //    ⚠ THE MINUTE FIELD IS DROPPED WHEN IT IS ZERO, because `۷:۰۰ بجو` is `اووه بجې` and appending
        //    "and zero minutes" would be a reading no speaker produces — the corpus writes `۷:۰۰ بجو` and
        //    `۸:۰۰ بجو` in the same sentence as bare hours.
        //    ⚠ AND A THIRD FIELD IS NOT A CLOCK (the sports-time cell): `4:41.30` is a pace, so the rule
        //    requires the minutes to END the numeral.
        s = s.replace(
            new RegExp(`(?<![${D}:.])([${D}]{1,2}):([${D}]{2})(?![${D}:.])`, "gu"),
            (whole: string, h: string, m: string) => {
                const mm = Number(toAscii(m));
                if (!Number.isSafeInteger(mm) || mm > 59) return whole;
                return mm === 0 ? `${h} بجې` : `${h} بجې او ${m} دقیقې`;
            },
        );

        // 8) RANGES, before percent — `۹۰-۹۵٪` is a range OF percents, so the pair must be claimed while
        //    both operands are still bare digits. The connective is `تر` ×1,221 between two bare numerals,
        //    and every instance read is a genuine span, grammatical without the `له …څخه …پورې` frame:
        //    `٣ تر ١٠ سانتي مترو`, `۱۵۱۵ تر ۱۵۴۷`, `۴۶۰ تر ۳۷۰`, `۰،۵۵ تر ۰،۷۵`.
        //
        //    ⚠ `\d+ ?[-–] ?\d+` MATCHES 10,181 TIMES AND THE GUARDS ARE WHAT MAKE THE RULE SURVIVABLE.
        //    Reading the instances, the false positives are four distinct classes:
        //      · LIST ENUMERATION — `٢١-سلطان غياث الدين` — "21- Sultan …", a numbered list item. Rejected
        //        by requiring a DIGIT on the right, which is the commonest of the four.
        //      · PHONE NUMBERS — `745-1576`, `+1 613 745-9426`. Rejected by the hyphen-chain guard.
        //      · EQUATION NUMBERS — `(1-3) او (1-4) معادلاتو`, a cross-reference, not a span.
        //      · BIRTH–DEATH with an abbreviated second year — `(۱۷۲۱-۹۴)`. Descending, so the
        //        ascending-only test rejects it for free.
        //    NON-ASCENDING is left as the bare juxtaposition it already was: a score or a birth–death pair
        //    reads with a different connective, so claiming it would be confidently wrong.
        //
        //    ⚠ THE TRAILING GUARD REJECTS THE TWO COMMAS AND NOT THE DOT, AND THE SPLIT IS MEASURED. All three
        //    of this language's decimal separators are live (step 12: `.` ×6,387, `،` ×1,122, `٫` ×186), so a
        //    trailing separator can genuinely open the right operand's fractional part — but a bare `.` is a
        //    SENTENCE END far more often, and rejecting it declined every span that ends a clause. `166-200.`,
        //    this corpus's one clause-final span, came back untouched and read as two juxtaposed cardinals with
        //    `تر` gone at exactly a sentence end (playbook trap 58, reported by `review.ts`'s `clause-final`
        //    check). Dropping the dot costs nothing even when it IS a decimal, because step 12 runs after this
        //    one: `۹۰-۹۵.۵` is claimed as `۹۰ تر ۹۵` and `۹۵.۵` still reaches the decimal rule whole. The two
        //    commas are kept because each is ALSO a grouping separator here (step 4) — evidence this rule reads
        //    — and because the dot is the one character with nothing left to defend it.
        s = s.replace(
            new RegExp(
                `(?<![${D}.,،:\\p{L}\\p{M}-])([${D}]+)\\s?[-–—]\\s?([${D}]+)(?![${D}\\p{L}\\p{M}-]|[,،][${D}])`,
                "gu",
            ),
            (whole: string, a: string, b: string) => {
                const x = Number(toAscii(a)), y = Number(toAscii(b));
                if (!Number.isSafeInteger(x) || !Number.isSafeInteger(y) || x >= y) return whole;
                return `${a} تر ${b}`;
            },
        );

        // 9) PERCENT — ×5,156 signs (٪ 3,574 + % 1,582) and currently every one of them is silent.
        //    `سلنه` ×3,327 is the word, and its POSITION is settled by the corpus rather than assumed:
        //    `N سلنه` ×2,657 against `سلنه N` ×29 — decisively POSTPOSED.
        //    ⚠ BOTH ORDERS OF THE SIGN MUST BE CLAIMED, AND BOTH EMIT THE POSTPOSED WORD. Pashto writes the
        //    sign after the number (`N٪` ×3,024, `N%` ×1,259) and also before it, Arabic-style
        //    (`٪N` ×564, `%N` ×502) — 1,066 instances that a postfix-only rule would have missed.
        //     ⚠ AND THE WORD MAY ALREADY BE THERE — `N٪ سلنه` ×77, the corpus writing both the sign and its
        //     reading (trap 12). The correct reading says it ONCE, so the sign is dropped and the word kept;
        //     without the guard `۹۹% سلنه وگړي` came back as `۹۹ سلنه سلنه`.
        s = s.replace(new RegExp(`([${D}]+(?:[.,،][${D}]+)?)\\s?[٪%](\\s*سلنه)?`, "gu"),
            // ⚠ RE-SPACED even when the word was already there: the corpus writes `۱۰%سلنه` with the sign
            // between them and no space, so re-emitting the capture verbatim gave `۱۰سلنه` — one token
            // where there were two (trap 26). Dropping a sign must not also drop a boundary.
            (_m: string, n: string, named: string | undefined) => `${n} ${named?.trim() ?? "سلنه"}`);
        s = s.replace(new RegExp(`[٪%]\\s?([${D}]+(?:[.,،][${D}]+)?)(\\s*سلنه)?`, "gu"),
            // ⚠ RE-SPACED even when the word was already there: the corpus writes `۱۰%سلنه` with the sign
            // between them and no space, so re-emitting the capture verbatim gave `۱۰سلنه` — one token
            // where there were two (trap 26). Dropping a sign must not also drop a boundary.
            (_m: string, n: string, named: string | undefined) => `${n} ${named?.trim() ?? "سلنه"}`);

        // 10) CURRENCY. `ډالر` ×2,520, of which ×374 sit directly after a number, so word and position are
        //     both attested. Only the dollar is declared: `؋` occurs ONCE in 242,649 lines and `€`/`£` ×16,
        //     which is not enough to name a currency on.
        //     ⚠ THE SIGN IS DROPPED, NOT READ, WHEN THE CURRENCY IS ALREADY NAMED (trap 12) — the corpus
        //     writes `د ۲۵۰۰۰ ډالرو هرم`, so a rule that always emits the word would say it twice.
        //     ⚠ THE NAME MAY BE ON EITHER SIDE, and the corpus diff had to teach me the right-hand one.
        //     Looking only left, `۳۲۱،۰۰۰ $ USDوه` became "…ډالر USD" (the ISO code says it again — trap 12's
        //     second bullet) and `100 $ میلیارده امریکایي ډالرو` became "100 ډالر میلیارده امریکایي ډالرو",
        //     which states the currency twice AND puts the first one in the wrong slot.
        //     ⚠ AND A MAGNITUDE WORD BELONGS INSIDE THE QUANTITY. `$۱۴.۷ میلیارد` is "14.7 BILLION dollars",
        //     not "14.7 dollars billion" — the same wrong-slot defect the playbook records for Indonesian's
        //     `US$` fold. The magnitude is carried over the top of the currency word (×15).
        const NAMED_L = /(?:ډالر[وه]?|dollars?|USD)\s*$/iu;
        const NAMED_R = /^[^\n]{0,30}?(?:ډالر|USD|امریکایي|امريکايي)/u;
        const MAG = `(\\s*(?:میلیارد|ميليارد|میلیون|ميليون|ملیون|بیلیون|بيليون|ټریلیون|زره|زر)[هو]?)?`;
        const money = (n: string, mag: string | undefined, off: number, all: string, len: number): string => {
            const named = NAMED_L.test(all.slice(0, off)) || NAMED_R.test(all.slice(off + len));
            // ⚠ A TRAILING SPACE, ALWAYS. The corpus writes `د$۲۴۰بيلون` with no spaces at all, so emitting
            // the word bare welded it onto the next word (`ډالربيلون`) — one token where there were two,
            // which is trap 26 in a rule that was otherwise correct.
            return named ? `${n}${mag ?? ""} ` : `${n}${mag ?? ""} ډالر `;
        };
        s = s.replace(new RegExp(`\\$\\s?([${D}]+(?:[.,،][${D}]+)?)${MAG}`, "gu"),
            (whole: string, n: string, mag: string | undefined, off: number, all: string) =>
                money(n, mag, off, all, whole.length));
        s = s.replace(new RegExp(`([${D}]+(?:[.,،][${D}]+)?)\\s?\\$${MAG}`, "gu"),
            (whole: string, n: string, mag: string | undefined, off: number, all: string) =>
                money(n, mag, off, all, whole.length));

        // 11) THE MINUS. ⚠ THIS WAS MEANT TO BE A REFUSAL AND THE CORPUS OVERTURNED IT. `منفي` counts 1,151
        //     but the bare count measures the wrong thing — most of it is the ADJECTIVE ("negative votes",
        //     "a negative result"), which is trap 37 exactly. The COLLOCATION is the evidence: digit-adjacent
        //     `منفي` is ×52 and PREPOSED every time — `منفي ۱۸۰ درجو`,
        //     `د منفي ٤ څخه تر منفي ٤٥ سانتي گراد`, `دسانتيګراد منفي ۱۶ درجو`.
        //     ⚠ TWO GUARDS, AND THE SECOND ONE THE CORPUS DIFF HAD TO TEACH ME. The sign must OPEN a clause
        //     or bracket — a hyphen between two digits belongs to the range rule, which has already run at
        //     step 8 — and it must be GLUED to its digit. Measured: `-[digit]` ×2,538 against `- [digit]`
        //     ×4,296, and the spaced form is overwhelmingly a DASH between two date phrases, not a sign.
        //     The diff caught exactly that: `… د اګسټ لمړۍ نېټه - ۱۹۷۹ د ډسمبر ۲۷` is a birth–death pair
        //     whose operands are full dates, so the range rule cannot claim it and the minus rule read a
        //     death year as "minus 1979". The corpus writes its true negatives glued — `-7 °C`, `-18 °C`,
        //     `−26.3 °C` — so requiring adjacency keeps every one of them and drops the dashes.
        s = s.replace(new RegExp(`(^|[\\s(（\\[])[-−–]([${D}])`, "gu"), "$1منفي $2");

        // 12) DECIMALS, after every rule that needs the number intact. ⚠ THE POINT WORD IS `اعشاريه`, AND
        //     THIS IS THE TIER `sources.ts` REPORTED AS `[NONE]`. ⚠ That report was wrong for the reason
        //     given in the header — an unset $ESPEAK_NG — but the CONCLUSION survives it: espeak is
        //     phonetic and cannot hand you an orthography, so it could not have supplied this word. The
        //     language's own prose carries it ×184 and GLOSSES ITSELF with it:
        //
        //         ۵.۰ (صفر اعشاريه پنځه)          "zero point five", the digit form and the word form together
        //         دوه اعشاريه درې ميليونه          2.3 million
        //         اته اويا اعشاريه صفر اته سلنه    78.08 percent
        //
        //     That last one also settles the READING, which no word list could: the integer, then اعشاريه,
        //     then the fractional digits ONE AT A TIME (`صفر اته`, not "eight"). So the digits are spaced
        //     apart here and the engine's numeral path speaks each on its own.
        //     ⚠ ALL THREE SEPARATORS. `.` ×6,387, `،` ×1,122 and `٫` (U+066B) ×186 all carry decimals in
        //     this corpus, and the `،` arm is the one that also fixes a spurious PAUSE.
        //     ⚠ AND THE TRAILING GUARD MUST REJECT A FOLLOWING `.`+DIGIT, WHICH IS WHAT KEEPS AN IP ADDRESS
        //     OUT. `192.168.2.10` and the netmask `255.255.255.0` (×29 between them) are DESIGNATIONS, and
        //     a lookahead of `(?![\d\p{L}\p{M}])` alone admits them: the engine matches `192.168`, is happy
        //     because the next character is a dot rather than a digit, and emits "192 point 1 6 8" with the
        //     rest of the address trailing behind. Rejecting `\.[digit]` blocks the first pair, and the
        //     existing lookbehind then blocks every later pair from starting mid-chain — so the whole
        //     address survives. Written as `\.[D]` rather than a bare `.` in the class deliberately: a
        //     decimal that ENDS a sentence (`۷۸.۸.`) is followed by a dot too, and must still be read.
        s = s.replace(
            new RegExp(`(?<![${D}.,،٫])([${D}]+)[.,،٫]([${D}]+)(?![${D}\\p{L}\\p{M}]|[.,،٫][${D}])`, "gu"),
            (_m: string, int: string, frac: string) => `${int} اعشاريه ${[...frac].join(" ")}`,
        );

        // 13) FRACTIONS. `D/D` ×1,060, and the reading composes from the ordinal this file already builds:
        //     Pashto says the denominator as an ordinal plus `برخه` ("part") — `برخه` ×18,916 and ×206
        //     directly after a numeral. `۲/۳` → `دوه درېیمه برخه`.
        //     ⚠ THE DENOMINATOR IS CAPPED AT TEN AND THE NUMERATOR MUST BE SMALLER, AND THAT CAP IS THE
        //     WHOLE RULE. Reading the 1,060 slash pairs, the overwhelming majority are not fractions at
        //     all, and one class dominates: VOLUME/PAGE CITATIONS in the religious-text articles —
        //     `جواهرالبحار ١/٣٦١`, `مستدرک ٣/١٤٩`, `سنن البيهقي الكبرى: 9/234`, `1/78`. The rest are dates
        //     (`۱۴۳۴/۸/۲ هـ ق`, `2008 /3/2`), dual-calendar years (`۱۸۲/۷۹۸ زیږدیز`, `۹۶/۹۷ ق م`) and
        //     arithmetic (`0.25/500=25/50000=1/2000`). Numerator < denominator ≤ 10 rejects every one of
        //     them; a third `/digit` field rejects the dates before the cap has to.
        //     ⚠ AND THE NOUN MAY ALREADY BE THERE (trap 12): the corpus writes `۱/۳برخه` with the word
        //     glued straight onto the figure, so emitting it unconditionally would say `برخه` twice.
        s = s.replace(
            new RegExp(`(?<![${D}\\p{L}\\p{M}/])([${D}]{1,3})/([${D}]{1,3})(?![${D}/])(\\s*برخ[ېه])?`, "gu"),
            (whole: string, a: string, b: string, noun: string | undefined) => {
                const x = Number(toAscii(a)), y = Number(toAscii(b));
                if (!Number.isSafeInteger(x) || !Number.isSafeInteger(y)) return whole;
                if (!(x < y && y <= 10)) return whole;
                const den = ordinalWords(y, "مه", numeralWords);
                // ⚠ RE-SPACED, NOT RE-EMITTED VERBATIM. The corpus's glued `۱/۳برخه` would otherwise come
                // back as `درېیمهبرخه` — ONE token where the language has two, which is the trap-18/26
                // failure: a rewrite must not change how its neighbours tokenize.
                return den === "" ? whole : `${a} ${den} ${(noun ?? "برخه").trim()}`;
            },
        );

        return s;
    };
}
