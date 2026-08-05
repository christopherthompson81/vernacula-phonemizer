/**
 * Khmer text normalization (#585) — symbols and marks the tokenizer cannot see, rewritten as Khmer words.
 *
 * WHY THESE DEFECTS EXIST, mechanically. `khmer.ts` tokenizes with
 * `TOKEN = /([ក-៓ៜ-៝]+)|([\d០-៩]+)|([។៕?!,.៖])/gu`, which is a deliberately minimal three-way split: a Khmer
 * run, a digit run, a clause mark. Everything else matches NO group and is therefore skipped in silence —
 * `%`, `$`, `°`, `&`, `+`, `/`, an en dash, and the iteration mark ៗ, whose code point U+17D7 falls in the gap
 * between `៓` (U+17D3) and `ៜ` (U+17DC). And two characters that DO match are in the wrong group: `,` and `.`
 * are clause punctuation, so a grouped number and a decimal are read as sentences with pauses in them.
 *
 * WHAT THE MINED CORPUS CONTAINS (112,905 segments; #585's artifact, no FLEURS corpus exists for Khmer):
 *   ៗ iteration        15,952 in the artifact · 24,413 in the full corpus  ← the largest single defect
 *   digit-run          27,223   year 26,030   ← both read CORRECTLY already; native digits are handled
 *   decimals            4,018   ranges 4,014   grouped 2,788
 *   percent             1,291   ampersand 1,331   arithmetic 864   fractions 326   degrees 160   currency 154
 *
 * ⚠ NATIVE DIGITS ARE 74% OF THE CORPUS — 390,251 Khmer digits ០-៩ against 140,156 ASCII. `\d` would miss 68%
 * of the digit-runs and 71% of the years, so every pattern here matches BOTH ranges explicitly. This is the
 * ASCII trap the toolchain documents at three other levels; Khmer is where it bites hardest.
 *
 * WHAT THE ENGINE PRODUCED BEFORE, probed form by form:
 *   ថ្មីៗ         → tʰməj                    the reduplication silently DROPPED
 *   ១,០០០,០០០     → muəj , soun , soun       "one, zero, zero" — the grouping comma is a CLAUSE PAUSE
 *   ៣.៥ គីឡូ      → ɓəj . pram kiːlou        decimal point read as a phrase break, splitting the number
 *   ៩៨%           → kawsəp pramɓəj           the % vanished
 *   ១៩៩០–២០០០     → … kawsəp piː poən        two numbers, nothing between them
 *   ៣៥°C          → saːmsəp pram sˈiː        ° vanished; C fell through to the English letter name
 *   $១០០          → muəj rɔːj                the sign vanished
 *   ១/៤           → muəj ɓuən                "one four"
 *
 * ── SOURCING. Every word below is corpus-attested with the SENSE checked, per the Fula lesson. Counts are
 * from the full mined corpus:
 *   ភាគរយ   percent   445, and 230 of those directly after a digit — so it is POSTPOSED
 *   ដុល្លារ dollar    712
 *   អង្សា   degree     74 after a digit · អង្សាសេ "degrees Celsius" 25 after a digit
 *   ដល់     to (range) very frequent; 81 phrase hits in the artifact alone
 *   និង     and        40,204 — the single commonest word in the language
 *   បូក     plus       corpus-attested, 6 phrase hits in the artifact
 *   ភាគ     part       `៥ភាគ៦` = 5/6 attested 74 times, so the fraction frame is NUM ភាគ NUM
 *
 * ⚠ THE DECIMAL POINT HAS NO SOURCEABLE READING, and the near-miss is worth recording. `sources.ts` reports
 * `[NONE] decimal-point`. Two candidates were probed against the full corpus and both LOOKED available —
 * ចុច ×157, ក្បៀស ×18 — and both fail on sense: neither occurs between digits even once, and ចុច's
 * collocations are `ដោយចុច` "by clicking", `ក្តារចុច` "keyboard", `ទៅចុចចំបេះដូង` "press on the heart". It is
 * the verb "to press". So the documented fallback applies: read the fraction digit-by-digit with no separator
 * word, which here means removing the point so the digits are not split by a clause pause.
 *
 * ⚠ AND NO CLOCK RULE, deliberately. The corpus writes the frame word ITSELF — `ម៉ោង ៨:៣០` (76 instances),
 * `ម៉ោង ១១:០០ នាទីព្រឹក` (29) — so inserting ម៉ោង would duplicate what the writer already typed, which is the
 * Arabic الساعة defect the playbook records. ASCII `:` is not in `clausePunctuation`, so it is dropped without
 * a pause and the two numbers read adjacently, which is defensible. Left alone on purpose.
 */
import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";
import { lastKhmerWord } from "./segment.ts";

/**
 * THE SHARED SYMBOL TIER, not local regexes — playbook trap 16: before declaring a class out of scope, check
 * whether the seam already exists. It did, for five of the classes this file first solved by hand, and it
 * carries two Khmer needs that hand-written rules had missed entirely.
 *
 * `unspacedScript` is the load-bearing flag, and the tier's own header documents Khmer's exact symptoms against
 * Chinese: the boundary guards assume spaces between words, so in an unspaced script the ORDINARY case is the one
 * they reject — `20°C` read its C as English *sˈiː*, and `km²` dropped the `²`. Khmer separates words with
 * U+200B rather than a space, so it belongs in the same class as cmn and yue.
 *
 * Sourcing, all corpus-attested with the sense checked against digit or unit adjacency:
 *   percent      ភាគរយ    445, of which 230 directly after a digit
 *   currency     ដុល្លារ  712
 *   °C / °       អង្សាសេ 25 after a digit · អង្សា 74 — declared as UNITS, which is how the tier reads a scale
 *   exponent     ការេ     ⚠ THIS WAS WRONGLY REFUSED FIRST TIME. It is 0/0 DIGIT-adjacent, and I concluded from
 *                         that it was unsourceable — but `²` attaches to a UNIT, not a digit, and ការេ is
 *                         exactly the square-metre word: ម៉ែត្រការេ ×17, គីឡូម៉ែត្រការេ ×10, ម៉ែតការេ ×20.
 *                         `position: "compound"` because it FUSES, like Swedish kvadratkilometer.
 *   multiply     គុណ      3,338, written out between numerals: `៣គុណ៥`, `១៤០០ គុណ ២០០០`
 *   ampersand    និង      40,204 — the commonest word in the language
 */
const SYMBOLS = makeSymbolNormalizer({
    percent: ["ភាគរយ"],
    // ៛ is the riel, 97 occurrences — the country's own currency, and declaring only the dollar left it unread.
    // ⚠ FOUR CURRENCIES, NOT ONE — and the three additions were pure omission rather than a judgement.
    // The artifact's remaining `currency` drops were mostly £ and €, which the corpus writes with Khmer digits
    // (`£៥ លាន`, `២,៣ €`) and which no rule could reach because they were not in this map. Both words are
    // corpus-attested: អឺរ៉ូ ×84, ផោន ×39, រៀល ×451, ដុល្លារ ×435.
    //
    // ⚠ `US$` IS DECLARED AS ITS OWN KEY, and the first version of this comment got the reason wrong. I recorded
    // it as "the guard working — every US$ instance sits in an English sentence the wiki quotes verbatim", which
    // was true only of the artifact's ENGLISH cells. Once those were filtered out of the corpus (see
    // scripts.ts's isNativeSegment) the surviving `US$` instances were ordinary Khmer prose — `ប្រហែល US$3,236`,
    // `តិចជាង US$ ១,០២៥` — so it was a real reading gap that foreign-line noise had been hiding. The bare `$`
    // key cannot reach it because the tier refuses a sign preceded by a Latin letter, which is the guard that
    // stops a sign being read out of the middle of a Latin word; a multi-character key is matched as a unit and
    // sidesteps it. ដុល្លារអាមេរិក is attested ×116.
    //
    // ⚠ AND `¥` IS DELIBERATELY NOT DECLARED. Its single corpus instance is `CN¥117,500` — Chinese yuan, not
    // yen — so the obvious word យ៉េន (×38, and genuinely the yen: `២,៨ពាន់លានយ៉េន`) would be the WRONG reading.
    // The yuan word is not attested at all: យ័ន looks frequent at ×436 until the hits are read, and every one is
    // a substring of បាយ័ន (the Bayon temple), អារ្យ័ន (Aryan) or យ័ន្ត — the spaceless-script inflation
    // `corpus-words.ts` warns about in its own banner, checked here rather than trusted. So this is one
    // ambiguous instance whose correct reading has no source, and it stays silent as a KNOWN GAP: the remaining
    // `artifact scan` DROP is this, and it is not claimed to be correct the way an ACCEPTED_SILENT entry is.
    currency: {
        $: ["ដុល្លារ"], "៛": ["រៀល"], "€": ["អឺរ៉ូ"], "£": ["ផោន"], "US$": ["ដុល្លារអាមេរិក"],
    },
    // A scale is a UNIT to this tier. `℃` is listed beside `°C` because the corpus carries both spellings, and
    // the bare `°` last so the longer keys win — the tier sorts by length, but declaring the order makes it read.
    // ⚠ THE KEYS MUST BE LOWERCASE. The tier looks a matched unit up as `d.units[u.toLowerCase()]` with a
    // non-null assertion, so a capitalised key is not a missed match — it is a TypeError at runtime
    // ("Cannot read properties of undefined") the first time that unit appears in real text. Declaring `°C`
    // crashed on `៣៥°C`; `°c` matches the same input because the alternation is case-insensitive.
    // Both spellings of the kilometre abbreviation: the corpus writes គម 212 times after a digit and the
    // Latin `km` 95 times, so declaring only one leaves the other reading as a foreign-fallback mangle
    // (`1 km` came out as *muəj ˈʊkm*).
    units: { "គម": ["គីឡូម៉ែត្រ"], km: ["គីឡូម៉ែត្រ"], "°c": ["អង្សាសេ"], "℃": ["អង្សាសេ"], "°": ["អង្សា"] },
    // ⚠ MAGNITUDES ARE WHAT LET A POSTPOSED SIGN COMPOSE. Khmer writes the sign AFTER the amount — `២៤៧០$`,
    // `រយកោដិ$ស.រ.` — and the tier's postposed currency pattern needs a NUMBER before it. Where a magnitude
    // word intervenes (`១ កោដិ$`, one koti dollars) the pattern found no number and the sign was DROPPED, which
    // is 9 of the artifact's remaining drops. All four are corpus-attested after a digit: លាន 1,324,
    // ពាន់ 558, ម៉ឺន 274, កោដិ 53.
    magnitudes: ["លាន", "ពាន់", "ម៉ឺន", "កោដិ"],
    exponentWords: { squared: ["ការេ"], position: "suffix" },
    multiply: { times: "គុណ" },
    ampersand: "និង",
    unspacedScript: true,
});

/** Khmer letters, marks and signs — the run the tokenizer treats as one unit. Excludes ៗ by construction. */
const KH = "ក-៓ៜ៝";
/** Both digit ranges, always together. See the header: native digits are 74% of this corpus. */
const D = "\\d០-៩";
/**
 * ⚠ A SEPARATOR IN KHMER INCLUDES ZERO-WIDTH SPACE, AND `\s` DOES NOT MATCH IT. U+200B is not whitespace to a
 * JavaScript regex, and Khmer writers use it as their word separator — 33,285 occurrences in the mined corpus,
 * the single most frequent pattern cell in the language. Every rule below that allows optional space between a
 * number and its symbol must therefore use THIS class, or it silently fails on the commonest way Khmer is typed:
 * `៣០​%` (digit, ZWSP, percent) was left unread, and a ៗ whose antecedent ended in ZWSP kept its mark.
 *
 * Found by reading the artifact scan after the corpus diff was already clean on counts — the residual 43 drops were
 * not a different defect class, they were these rules missing their own trigger.
 */
const SEP = "[\\s\u200b\u200c]*";

export function normalizeKhmer(text: string): string {
    let s = text;

    // ── 0. entities are NOT decoded here ─────────────────────────────────────────────────────────────
    // ⚠ AND THE FIRST VERSION OF THIS FILE DID DECODE THEM, WHICH WAS THE WRONG LAYER. Wikitext carries
    // `&nbsp;`, `&amp;` and numeric character references, and stripping tags does not touch them, so they reach
    // the mined artifacts of 94 of 154 languages — 2,653 occurrences. Solving that here would mean solving it 94
    // times. It now happens once, during extraction, in `tools/normalization/wikidump-to-text.py`.
    //
    // What remains local is one guard, because a caller can pass anything: step 10 turns `&` into និង, and the
    // `&` of an undecoded `&nbsp;` would become "and nbsp" — confident nonsense, read aloud. So that rule
    // declines an `&` that opens an entity rather than re-implementing a decoder.

    // ── 1. ៗ (លេខទោ) = repeat the preceding WORD ──────────────────────────────────────────────────────
    // FIRST, because it is the only rule that reads a Khmer run as a unit; every later rule works on digits
    // and symbols and cannot disturb it. The antecedent is a WORD, not the whole run: Khmer writes no word
    // space, so `អារម្មណ៍នោះៗ` must repeat នោះ ("that") and not អារម្មណ៍នោះ ("that feeling"). `segment.ts`
    // supplies the boundary from writer-typed ZWSP frequencies — see its header for why the shipped
    // pronunciation lexicon cannot (12% of top antecedents are entries; none has a lexicon word as a suffix).
    //
    // Measured over all 24,413 antecedents: 24.3% are already a single vocabulary word, and repeating the whole
    // run — the only option without a segmenter — would therefore be wrong three times in four.
    //
    // An empty antecedent drops the mark rather than inventing a word, matching Thai's ๆ rule.
    s = s.replace(new RegExp(`([${KH}]+)${SEP}ៗ`, "gu"), (_m, run: string) =>
        run === "" ? "" : `${run} ${lastKhmerWord(run)}`);

    // ── 2. de-group thousands ─────────────────────────────────────────────────────────────────────────
    // FIRST among the numeric rules, and the playbook's standing coupling: the grouping comma is otherwise
    // clause punctuation, so `១,០០០,០០០` reads as three sentences — "one", "zero", "zero" — instead of one
    // million. Exactly-three-digit blocks only, so a genuine list `៣,៤,៥` is untouched. 2,788 in the corpus.
    // Applied repeatedly because the lookbehind cannot span a group it has already consumed.
    const degroup = new RegExp(`(?<=[${D}]),(?=[${D}]{3}(?![${D}]))`, "gu");
    for (let i = 0; i < 4 && degroup.test(s); i++) s = s.replace(degroup, "");
    // ⚠ AND THE SPACE-GROUPED FORM, which this rule missed and `review.ts` surfaced: it printed `5 000` reading
    // as "pram soun" — "five zero". Khmer groups with a space or a ZWSP as well as a comma, 567 times in the
    // corpus (`៣០ ០០០`, `១១៨ ១៨៣`), and the artifact's own exponent example is `១៨១ ០៣៥ គម²`, which without this
    // is two numbers and a stranded unit. Same three-digit-block guard, so a genuine list of numbers survives.
    const degroupSpace = new RegExp(`(?<=[${D}])[ \u200b](?=[${D}]{3}(?![${D}]))`, "gu");
    for (let i = 0; i < 4 && degroupSpace.test(s); i++) s = s.replace(degroupSpace, "");

    // ── 3. decimal point ─────────────────────────────────────────────────────────────────────────────
    // AFTER de-grouping, which would otherwise see `៣.៥` as a group boundary. The point becomes a SPACE, not
    // a word: there is no sourceable Khmer reading for it (see the header — both candidates fail on sense), so
    // the digits are read individually and the only fix available is removing the clause pause that currently
    // splits the number in half. Requires a digit on both sides, so an abbreviation dot (គ.ស) and a
    // sentence-final period are untouched. 4,018 in the corpus.
    s = s.replace(new RegExp(`(?<=[${D}])\\.(?=[${D}])`, "gu"), " ");
    // ⚠ THE COMMA IS ALSO A DECIMAL SEPARATOR HERE, which `review.ts` caught: it printed `12,5` reading as
    // "ɗɑp piː , pram" — twelve, pause, five. Khmer writes both forms (`៦,០%`, `០,៣៥`, `៥,៧`), and de-grouping
    // above has already consumed every comma that introduces a three-digit block, so whatever survives to this
    // point is a decimal rather than a group boundary. That ordering is the entire discrimination.
    s = s.replace(new RegExp(`(?<=[${D}]),(?=[${D}])`, "gu"), " ");

    // ── 4. ranges ────────────────────────────────────────────────────────────────────────────────────
    // BEFORE the arithmetic rule, because both compete for a hyphen. In this corpus a dash between two numbers
    // is overwhelmingly a range — 4,014 ranges against 399 signed numbers — so the range reading wins, and a
    // signed number is left to the deeper number path rather than guessed at here.
    s = s.replace(new RegExp(`(?<=[${D}])${SEP}[–—-]${SEP}(?=[${D}])`, "gu"), " ដល់ ");

    // ── 5. equals ────────────────────────────────────────────────────────────────────────────────────
    // ⚠ THIS CLASS WAS REFUSED IN THE FIRST VERSION OF THIS FILE, on an assumption rather than a check —
    // "× ÷ and = have no corpus-attested Khmer reading" — because `sources.ts` had no row for the sign classes
    // and its silence read as absence. ស្មើ is attested 2,077 times, 24 before a digit and 33 after, and the
    // corpus writes the arithmetic out: `៤ = ២៤`, `២=៣៥ តួ`. 5,844 `=` in the corpus.
    // ⚠ DIGIT-FLANKED ONLY, and `review.ts` will report `equals` as DROPPED because its probe is `x = y` —
    // letters, not digits. That divergence is deliberate and the corpus decides it. Of 5,844 `=`:
    //     1,348  Khmer = word     a gloss (`ចក្រវាឡរណប=satellite`)
    //     1,057  code-shaped      `==`, an assignment, a quoted value
    //       109  digit = digit    arithmetic — this rule
    //         9  URL query strings
    // Widening to the probe's shape would fire on the code and the query strings, getting it wrong nearly as
    // often as right, which is trap 9 (a guard alternative with no attested…)'s misfire generator seen from the other side. The arithmetic reading is
    // the only one the evidence supports.
    s = s.replace(new RegExp(`(?<=[${D}])${SEP}=${SEP}(?=[${D}])`, "gu"), " ស្មើ ");

    // ── 5b. plus, and plus-minus ─────────────────────────────────────────────────────────────────────
    // ⚠ THE PLUS RULE EXISTED AND I DELETED IT while restructuring for the shared tier — the tier carries
    // `multiply` but has no plus, so migrating silently dropped a class with 74 digit-flanked instances. Caught
    // by `review.ts` reporting `plus` among the DROPPED sign classes. បូក is corpus-attested (3,338).
    s = s.replace(new RegExp(`(?<=[${D}])${SEP}\\+${SEP}(?=[${D}])`, "gu"), " បូក ");
    // ± is 19 digit-flanked instances, every one a scientific tolerance — `១៨៣០ ±៤០ km`, `25,559 ± 4 គីឡូម៉ែត្រ`.
    // I had recorded it as "the sign does not occur in the evidence", which was an artifact of testing with a
    // grep whose `\$sg` escaped to a word boundary rather than a literal. បូកដក is attested ×4 and is the
    // compositional form of two words that are individually very frequent.
    s = s.replace(new RegExp(`(?<=[${D}])${SEP}±${SEP}(?=[${D}])`, "gu"), " បូកដក ");
    // AND THE LEADING FORM, which is what `review.ts`'s `±5` probe tests. Measured before adding rather than
    // after: stripping whitespace properly, exactly 4 sites in the corpus have a ± with no number before it, and
    // all 4 are genuine — the latitude bands `±20°`, `±60°`, `± 50°` and the tolerance `± 0.1 ឆ្នាំ`. No misfires
    // available, so this is safe in a way the leading PLUS is not (see ACCEPTED_SIGN_SILENCE in defects.ts).
    s = s.replace(new RegExp(`(?<![${D}])±${SEP}(?=[${D}])`, "gu"), "បូកដក ");

    // ── 6. minus ─────────────────────────────────────────────────────────────────────────────────────
    // AFTER step 4, which has already claimed every dash BETWEEN two numbers — so what reaches here is
    // a dash with no number before it, which is the negative/subtract reading. ដក is attested 3,808 times with
    // `២៨ ដក៥` written out. The ordering is the whole guard: this corpus has 4,014 ranges against 399 signed
    // numbers, so a digit-flanked dash belongs to the range and only a leading one is a minus.
    s = s.replace(new RegExp(`(?<![${D}${KH}])[-−–](?=[${D}])`, "gu"), "ដក ");

    // ── 6b. divide, less-than, greater-than — ROBUSTNESS, not repair ─────────────────────────────────
    // ⚠ THESE SIGNS DO NOT OCCUR DIGIT-FLANKED IN THIS CORPUS: `÷` 0, `<` 0, `>` 2. Khmer writes the WORD
    // instead — ចែក 3,285, and the same is true of `×` (0 signs, គុណ 3,338), which is #654's central finding
    // restated: the signs are absent while the readings are ordinary prose.
    //
    // They are added anyway because the words are SOURCED and the rules are digit-flanked, so on this corpus
    // they cannot misfire — the risk trap 9 (a guard alternative with no attested…) warns about is a guard
    // that fires on something else, and with zero instances there is nothing here to fire on. This is the
    // "pure robustness rather than a repair" #654 argues for, and it closes the same class for arbitrary input.
    s = s.replace(new RegExp(`(?<=[${D}])${SEP}÷${SEP}(?=[${D}])`, "gu"), " ចែក ");
    s = s.replace(new RegExp(`(?<=[${D}])${SEP}<${SEP}(?=[${D}])`, "gu"), " តិចជាង ");
    s = s.replace(new RegExp(`(?<=[${D}])${SEP}>${SEP}(?=[${D}])`, "gu"), " ច្រើនជាង ");

    // ── 7. fractions ─────────────────────────────────────────────────────────────────────────────────
    // The frame is NUM ភាគ NUM, which the corpus writes out 74 times as `៥ភាគ៦` — the language's own
    // construction rather than a calque. 326 in the corpus.
    s = s.replace(new RegExp(`(?<=[${D}])${SEP}/${SEP}(?=[${D}])`, "gu"), " ភាគ ");

    // ── 8. the shared symbol tier ────────────────────────────────────────────────────────────────────
    // LAST, because it works on numbers and units that the rules above have finished shaping: de-grouping has
    // joined `១៨១ ០៣៥` so the exponent rule can see one number, and the decimal rules have removed the marks
    // that would have split it. See the SYMBOLS declaration for what it owns and where each word came from.
    s = SYMBOLS(s);

    return s;
}
