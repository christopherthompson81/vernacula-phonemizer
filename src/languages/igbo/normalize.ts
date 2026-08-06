/**
 * Igbo text normalization — the symbols a reader says aloud, before the tokenizer sees them.
 *
 * Every reading here is sourced from a 558,991-line ig.wikipedia dump and every count below is from it.
 * ⚠ IGBO HAS NO INDEPENDENT REFEREE — wikipron ibo_latn, epitran ibo-Latn and the kaikki extract are all 404 — so
 * the corpus IS the evidence. Nothing external can adjudicate a reading; the counts and the sense-checks are the
 * whole justification, which is why each is recorded beside the rule that uses it.
 *
 * ⚠ WHAT IS DELIBERATELY NOT HERE, because the corpus does not supply a word (the pre-flight `sources.ts` says
 * "[NONE]" for each and inventing one would be worse than silence):
 *   · DEGREES — ° occurs 41 times digit-flanked, and neither `dịgrii` nor `selsiọs` occurs ANYWHERE (0 hits).
 *   · MULTIPLICATION — × occurs 123 times digit-flanked, all of it relay distances (`4 × 100` metres). The
 *     candidate `mụba` is the VERB "to increase" (`na-amụba 6`, "increases 6"), not the arithmetic operator.
 *   · £ and € — the signs occur (147, 49) but `pound` has 45 hits and is ambiguous with the weight unit, `euro`
 *     19. Too thin to map a sign to.
 *
 * ⚠ THE DECIMAL POINT WAS ON THAT LIST AND SHOULD NOT HAVE BEEN. Every corpus probe for it came back 0 and the
 * layer declared "[NONE] — no word exists to voice it". A dictionary then gave `ǹtụ̀kpọ`, "decimal point", with a
 * definitional example. Absence from a 559k-line dump is not absence from the language, and a WRITTEN corpus is
 * the weakest possible evidence about how a symbol is SPOKEN — writers type `2.5`, they do not spell out how they
 * would say it. The refusals above stand on more than silence (a wrong sense for `mụba` and `ntụpọ`, ambiguity for
 * `pound`), but for anything resting on silence alone, a dictionary is the check that was missing. See rule 4.
 */
import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";
import { MANIFEST } from "./manifest.ts";

const SYMBOLS = makeSymbolNormalizer({
    /**
     * ⚠ THE SIGN FOLLOWS THE NUMBER AND THE WORD PRECEDES IT, which is the one thing here that assuming English
     * order would get wrong. Written Igbo puts the sign after — `9%`, `8.3%`, `60%`, 1,018 occurrences in a 26 MB
     * sample. Spoken Igbo puts the word FIRST: `pasent 60`, `pasent 50`, `pasent 22.8` — 1,161 occurrences against
     * 87 for the other order, and those 87 are comma boundaries (`2004, pasent`) rather than percentages.
     * Same shape as Turkish `yüzde 40`. `pasent` is 1,633 whole-word hits.
     */
    percent: ["pasent"],
    percentPrefix: true,
    /**
     * ₦ occurs 30 times and `naira` 280; $ occurs 898 and `dollar` 641. The word FOLLOWS the number — the corpus
     * writes `nde naira` (million naira) and `narị ise puku dollar` (five hundred thousand dollar) — which is the
     * tier's default, so no `currencyPrefix`.
     */
    currency: { "₦": ["naira"], $: ["dollar"] },
    /** `na` — the ordinary Igbo connective, and the same word the number compositor uses to join parts. */
    ampersand: "na",
});

/** The thousands separator is a COMMA and the decimal separator a PERIOD — the Nigerian/English convention. */
const GROUPED = /(\d),(\d{3})(?!\d)/gu;
/** A decimal period. Voiced as `ntụkpọ` — see rule 4 for the source, which is a dictionary and not the corpus. */
const DECIMAL = /(\d)\.(\d+)/gu;
/** A digit-flanked dash. See the range rule for why this is a RANGE and never a minus. */
const RANGE = /(\d)\s*[-–—]\s*(?=\d)/gu;

/** Normalize Igbo text: symbols the reader voices become words, before `igbo.ts`'s TOKEN ever sees them. */
export function normalizeIgbo(text: string): string {
    let s = text;

    // ── 1. de-group thousands ────────────────────────────────────────────────────────────────────────────
    // FIRST, and the playbook's standing coupling says why: a grouping comma left in place makes the number two
    // numbers with a pause between them. `1,500` read *otu , naɾɪ ise* — "one, five hundred". 16,847 lines carry a
    // comma-grouped number against 587 with a period-grouped one, so the convention is not in doubt.
    //
    // ⚠ EXACTLY THREE FOLLOWING DIGITS, so a decimal comma cannot be eaten. Igbo writes decimals with a PERIOD
    // (16,658 lines against 369 with a decimal comma), but the guard costs nothing and the 369 are real.
    // Applied repeatedly for numbers with several groups (1,234,567).
    while (GROUPED.test(s)) { GROUPED.lastIndex = 0; s = s.replace(GROUPED, "$1$2"); }

    // ── 2. ranges ────────────────────────────────────────────────────────────────────────────────────────
    // ⚠ A DIGIT-FLANKED DASH IN IGBO IS A RANGE, NOT A MINUS, and the corpus is emphatic. 4,993 digit-flanked
    // dashes in a 26 MB sample, of which 1,734 are year-year (`1967-1970`, `1979-1983`) and 1,741 are
    // small-small (`peeji 90-120`). A minus rule here would read every date range as arithmetic — the defect
    // nl, mr, ta and yue all record as the reason their minus is an ACCEPTED silence.
    //
    // `ruo` ("to, until") is the range word: 1,687 digit-flanked instances — `peeji 20 ruo 80`,
    // `Site na 1958 ruo 1966` — and 7,450 whole-word hits overall.
    s = s.replace(RANGE, "$1 ruo ");

    // ── 3. the shared symbol tier ────────────────────────────────────────────────────────────────────────
    s = SYMBOLS(s);

    // ── 4. the decimal separator ──────────────────────────────────────────────────────────────────────────
    // ⚠ LAST, AND THAT ORDER IS LOAD-BEARING. Run before the tier, this rule split `8.3%` into `8 3%` and the
    // percent word landed BETWEEN the halves — *asatɔ pasent atɔ*, "eight percent three". The tier's own number
    // pattern already spans `8.3`, so it must see the number whole; only afterwards is the separator dealt with.
    //
    // ⚠ AND LEAVING IT ALONE IS NOT NEUTRAL: `igbo.ts`'s TOKEN treats `.` as clause punctuation, so `2.5` read
    // *abʊɔ . ise* — a full sentence break inside a number. Silence about a symbol is acceptable; a spurious
    // pause is not.
    //
    // ⚠ THE SEPARATOR WORD IS `ntụkpọ`, AND THE CORPUS DOES NOT CONTAIN IT — a DICTIONARY settles it, which is the
    // whole reason this language's non-corpus tier exists. Every corpus probe came back empty: zero
    // digit-point-digit instances, zero for `ntụkpọ` and every variant, and the 89 whole-word `point` hits are all
    // English text inside the Igbo wiki. `ntụpọ` (552 hits) is a near-miss meaning a SPOT or blemish. On the corpus
    // alone the honest conclusion was "no word exists", and that conclusion was WRONG: absence from a 559k-line
    // dump is not absence from the language, and a written corpus is especially poor evidence about how a symbol is
    // SPOKEN. Same shape as Khmer's យូអាន, also unattested and also correct.
    //   ǹtụ̀kpọ, n. "decimal point; decimal number" — Nkọwa okwu (nkowaokwu.com), an Igbo dictionary published by
    //   a 501(c)(3) nonprofit. Its own definitional example is unambiguous about the function:
    //   "E ji ntụkpọ ekewapụ nọmba nnuzuroke na nọmba ọgwa" — "ntụkpọ is used to separate whole numbers from
    //   fractions". Cited as a single lexical fact; none of the site's text is reproduced here.
    // Shipped UNTONED, matching the dictionary's own running-text examples ("Ntụkpọ dị na ajụjụ ahụ...") and the
    // register of every other word this layer emits (pasent, naira, dollar) — Igbo standard orthography omits tone
    // and `igbo.ts` reads tone only when marked, so the toned headword would voice ˩ tones the corpus never writes.
    //
    // The FRACTION stays DIGIT BY DIGIT after the word: `3.14159` is "three point one four one five nine", not
    // "three point fourteen thousand...", which is what reading it as a cardinal would give.
    s = s.replace(DECIMAL, (_m, whole: string, frac: string) => `${whole} ${MANIFEST.numbers.decimalWord} ${[...frac].join(" ")}`);

    // A sentence-final period is untouched: DECIMAL requires a digit on BOTH sides.
    return s;
}
