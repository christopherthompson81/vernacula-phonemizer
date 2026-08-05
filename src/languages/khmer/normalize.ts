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
import { lastKhmerWord } from "./segment.ts";

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

    // ── 3. decimal point ─────────────────────────────────────────────────────────────────────────────
    // AFTER de-grouping, which would otherwise see `៣.៥` as a group boundary. The point becomes a SPACE, not
    // a word: there is no sourceable Khmer reading for it (see the header — both candidates fail on sense), so
    // the digits are read individually and the only fix available is removing the clause pause that currently
    // splits the number in half. Requires a digit on both sides, so an abbreviation dot (គ.ស) and a
    // sentence-final period are untouched. 4,018 in the corpus.
    s = s.replace(new RegExp(`(?<=[${D}])\\.(?=[${D}])`, "gu"), " ");

    // ── 4. percent ───────────────────────────────────────────────────────────────────────────────────
    // POSTPOSED, which the corpus settles: of 445 ភាគរយ, 230 sit directly after a digit. 1,291 in the corpus.
    s = s.replace(new RegExp(`(?<=[${D}])${SEP}%`, "gu"), " ភាគរយ");

    // ── 5. degrees ───────────────────────────────────────────────────────────────────────────────────
    // BEFORE any rule that could claim the trailing letter: `៣៥°C` left alone reads the C as an English letter
    // name (sˈiː), so the scale letter must be consumed together with the sign. អង្សាសេ is "degrees Celsius"
    // (25 after a digit); bare ° takes អង្សា (74 after a digit). F is not attested in this corpus and is not
    // invented here — it falls through to the bare form.
    s = s.replace(new RegExp(`(?<=[${D}])${SEP}°${SEP}[Cc]`, "gu"), " អង្សាសេ");
    s = s.replace(new RegExp(`(?<=[${D}])${SEP}°`, "gu"), " អង្សា");

    // ── 6. currency ──────────────────────────────────────────────────────────────────────────────────
    // The sign PRECEDES the amount in writing and the word FOLLOWS it in speech, so this is a reorder rather
    // than a substitution. 154 in the corpus; ដុល្លារ attested 712 times.
    s = s.replace(new RegExp(`\\$\\s*([${D}][${D},. ]*)`, "gu"), (_m, num: string) => `${num.trim()} ដុល្លារ`);

    // ── 7. ranges ────────────────────────────────────────────────────────────────────────────────────
    // BEFORE the arithmetic rule, because both compete for a hyphen. In this corpus a dash between two numbers
    // is overwhelmingly a range — 4,014 ranges against 399 signed numbers — so the range reading wins, and a
    // signed number is left to the deeper number path rather than guessed at here.
    s = s.replace(new RegExp(`(?<=[${D}])${SEP}[–—-]${SEP}(?=[${D}])`, "gu"), " ដល់ ");

    // ── 8. arithmetic ────────────────────────────────────────────────────────────────────────────────
    // AFTER ranges. Only `+` is treated: it is the one arithmetic sign this corpus attests between numbers
    // with a sourced reading (បូក). ×, ÷ and = have no corpus-attested Khmer reading here and are NOT invented
    // — they stay dropped, which is a recorded gap rather than a silent one. 864 in the arithmetic cell.
    s = s.replace(new RegExp(`(?<=[${D}])${SEP}\\+${SEP}(?=[${D}])`, "gu"), " បូក ");

    // ── 9. fractions ─────────────────────────────────────────────────────────────────────────────────
    // The frame is NUM ភាគ NUM, which the corpus writes out 74 times as `៥ភាគ៦` — so this is the language's
    // own construction rather than a calque. 326 in the corpus.
    s = s.replace(new RegExp(`(?<=[${D}])${SEP}/${SEP}(?=[${D}])`, "gu"), " ភាគ ");

    // ── 10. ampersand ────────────────────────────────────────────────────────────────────────────────
    // LAST, because it is the only rule not anchored to a digit and would otherwise fire inside a form another
    // rule was still shaping. និង is the commonest word in Khmer (40,204), so the reading is not in doubt.
    // 1,331 in the corpus.
    // The negative lookahead is the entity guard described at step 0: `&nbsp;`, `&amp;`, `&#10084;` keep their
    // ampersand rather than acquiring a spurious "and".
    s = s.replace(new RegExp(`${SEP}&(?![a-zA-Z]{2,8};|#\\d{1,6};|#x[0-9a-fA-F]{1,5};)${SEP}`, "gu"), " និង ");

    return s;
}
