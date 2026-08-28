/**
 * Portuguese (pt / pt-BR) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is
 * not already a pronounceable word into words the existing pipeline speaks. Pure text→text; no IPA.
 *
 * Eighth language, and structurally the closest to Spanish: same ordinal indicators, same dot-thousands /
 * comma-decimal conventions, same era markers. Shared with pt-BR, which is the same engine with
 * `dialect: "bp"` plus an open/close lexicon rather than a separate implementation — so there is one
 * normalization layer for both, and the few genuinely Brazilian choices are noted where they arise.
 *
 * Already correct and untouched: dot-thousands (1.000 → mil) and comma-decimals were already in the number
 * tokenizer, % and the metric units work through the shared symbol tier, dates take a plain cardinal day,
 * and Roman numerals are handled at the registry seam (pt is not in ROMAN_NATIVE), so `século XV` is right
 * and the roman-vs-initialism ordering hazard cannot arise here.
 *
 * Measured over the pt_br corpus (2,793 utterances): units ×69, dot-thousands ×65, dates ×56, percent ×29,
 * comma-decimals ×29, the `NhNN` clock ×28 and `h:mm` ×17, all-caps ×230 (EUA ×15, TV ×13, AOL ×7, OHA ×6),
 * Roman numerals ×25, ordinal indicators ×20, dotted abbreviations ×19, `a.C.` ×8.
 */
import { makeInitialismNormalizer, makeUnreadableTest } from "../../core/initialisms.ts";
import { MANIFEST } from "./manifest.ts";
import { numberToWords } from "./numbers.ts";
import { portugueseOrdinal } from "./romanOrdinals.ts";
import { rewrite } from "../../core/provenance.ts";

const DEG = MANIFEST.degree;

/**
 * The degree noun, agreeing with the count: *um grau*, *vinte graus*, *zero graus*.
 *
 * ⚠ THIS READS THE WHOLE NUMBER, NOT ITS LAST DIGIT. The three rules below used to capture `(\d)` — one
 * digit — which was invisible while the word was a hard-coded plural (`20 °C` → *vinte graus*, right by
 * luck: the leading digits pass through untouched) and wrong the moment the count is read off the capture,
 * since `21 °C` would have matched the `1` and said *grau*. The same trap is recorded in
 * ukrainian/normalize.ts, which hit it first.
 */
function degreeWord(n: string): string {
    return Number(rewrite(n, ",", ".")) === 1 ? DEG.singular : DEG.plural;
}

const GROUP_SPACE = "    ";  // NBSP, NNBSP, thin space
const MONTHS = MANIFEST.months.join("|");

/** Dotted abbreviations → the spoken words (portuguese.jsonc `dottedAbbrev`). `no.` is deliberately absent
 *  there and handled separately: bare "no" is the contraction em+o and is everywhere, so only `nº`/`n.º`/`no`
 *  before a DIGIT counts. */
const DOTTED_ABBREV = MANIFEST.dottedAbbrev;

// ⚠ ONE SOURCE with the symbol tier in portuguese.ts, which applies ⟨×⟩ and ⟨&⟩ in positions this file does
// not reach.
const SIGN = MANIFEST.signWords;

const ABBREV_ALT = Object.keys(DOTTED_ABBREV).sort((a, b) => b.length - a.length).join("|");

/** Portuguese phonotactics, for the OOV rule in core/initialisms.ts. */
export const isUnreadablePortuguese = makeUnreadableTest({
    vowels: new RegExp(`[${MANIFEST.phonotactics.vowels}]`, "u"),
    legalOnsets: new Set(MANIFEST.phonotactics.onsets),
    legalCodas: new Set(MANIFEST.phonotactics.codas),
});

/** LEXICAL: acronyms spelled out. Authored in portuguese.jsonc beside the other hand-authored facts. */
const ACRONYM_LETTERS: ReadonlySet<string> = new Set(MANIFEST.acronymLetters);

/** Portuguese has a pronunciation lexicon, but it is a CORRECTION table rather than a wordlist, so it
 *  cannot serve as the "is this recorded" test the way CMUdict or Lexique do. Acronyms are decided by the
 *  lexical list plus the OOV phonotactic rule alone. */
export function normalizePortugueseInitialisms(text: string): string {
    return makeInitialismNormalizer({
        letterName: (l) => MANIFEST.letterNames[l],
        acronymLetters: ACRONYM_LETTERS,
        isRecorded: () => false,
        isUnreadable: isUnreadablePortuguese,
    })(text);
}

/** Feminine ordinal: every element of a compound inflects (trigésimo sétimo → trigésima sétima). */
function feminineOrdinal(masc: string): string {
    return masc.split(" ").map((w) => rewrite(w, /o$/u, "a")).join(" ");
}

/** Non-negative integer → words with the final *um* feminized (hora and minuto agreement: uma hora). */
function feminineCardinal(n: number): string {
    return numberToWords(n).replace(new RegExp(`${MANIFEST.numbers.small[1]!}$`, "u"), MANIFEST.feminineOne);
}

/** Suppletive fraction denominators (portuguese.jsonc `fractions`); the rest take the ordinal. */
const DENOMINATOR = MANIFEST.fractions.denominators;

function fractionWords(num: number, den: number): string | undefined {
    if (den < 2 || num < 1) return undefined;
    const base = DENOMINATOR[String(den)] ?? portugueseOrdinal(den);
    if (base === undefined) return undefined;
    return `${numberToWords(num)} ${num > 1 ? `${base}s` : base}`;
}

/**
 * Normalize one Portuguese input string. Pure text→text.
 *
 * `brazilian` selects the one place the varieties genuinely differ in this layer: the first of the month.
 */
export function normalizePortuguese(input: string, brazilian = false): string {
    let s = input;

    // 0) DIGIT GROUPING with a space. The dot form (1.000) is already in the number tokenizer; the SI space
    //    form is not, and the number token cannot span a space.
    s = rewrite(s, new RegExp(`(?<=\\d)(?<!(?<![\\d\\.,])0)[${GROUP_SPACE}](?=\\d{3}(?!\\d))`, "gu"), "");
    s = rewrite(s, new RegExp(`(?<=\\d)(?<!(?<![\\d\\.,])0)[${GROUP_SPACE}](?=\\d{3}(?!\\d))`, "gu"), "");
    s = rewrite(s, /[ \u00a0\u202f\u2009]/gu, " ");  // space, NBSP, NNBSP, thin space

    // 1) ERA MARKERS, before the generic abbreviation rule so the bare `a.` is not claimed first — `a.` is
    //    8 of the 19 dotted abbreviations in the corpus and every one is `a.C.`.
    s = rewrite(s, /\ba\.\s?C\./giu, MANIFEST.eraMarkers.beforeChrist);
    s = rewrite(s, /\bd\.\s?C\./giu, MANIFEST.eraMarkers.afterChrist);

    // 2) NÚMERO, only before a digit: bare "no" is the contraction em+o and is everywhere.
    s = rewrite(s, /\b(?:n\.º|nº|n°|no|núm\.)\s?(?=\d)/giu, `${MANIFEST.numberSign} `);

    // 3) DOTTED ABBREVIATIONS. The dot is CONSUMED when the sentence continues so it cannot become a
    //    phrase break; at a phrase end it stays, because there it really is the sentence end.
    s = rewrite(s, new RegExp(`\\b(${ABBREV_ALT})\\.(\\s+)(?=\\p{L})`, "giu"),
        (m0, ab: string, sp: string) => {
            // ⚠ THE MISS BRANCH IS REACHABLE (#1122): the pattern is built from this table's own
            // keys but carries `i`+`u`, so JS's fold widens it and a near-miss matches while its
            // key is absent. The `!` here made `String.replace` stringify `undefined`.
            const w = DOTTED_ABBREV[ab.toLowerCase()];
            return w === undefined ? m0 : `${w}${sp}`;
        });
    s = rewrite(s, new RegExp(`\\b(${ABBREV_ALT})\\.(?=\\s*(?:[.,;:!?»)]|$))`, "giu"),
        (m0, ab: string) => {
            // ⚠ THE MISS BRANCH IS REACHABLE (#1122): the pattern is built from this table's own
            // keys but carries `i`+`u`, so JS's fold widens it and a near-miss matches while its
            // key is absent. The `!` here made `String.replace` stringify `undefined`.
            const w = DOTTED_ABBREV[ab.toLowerCase()];
            return w === undefined ? m0 : `${w}.`;
        });

    // 4) ORDINAL INDICATORS. º and ª were reaching the phoneme string RAW — a non-IPA character in the
    //    output. ° (U+00B0 DEGREE SIGN) is deliberately NOT one of them: "35°" and "32 °" occur in this
    //    corpus and are temperatures, and treating ° as ordinal would read them as ordinals.
    //    ⚠ THE DIGIT RUN MUST SPAN THE GROUPING DOTS — a bare `\d+` cannot cross the `.`
    //    in `1.000º`, and the consequences were two different failures on the same shape:
    //      `1.000º`  the pattern matched the TAIL, `000º`, so n was 0, portugueseOrdinal(0) is undefined, the
    //                match was returned unchanged and the º REACHED THE IPA RAW — the leak this rule exists to
    //                prevent, on the one form it could not see. (`Seu 1.000º selo` read *mˈiɫ º*.)
    //      `2.500º`  worse, because the tail IS an ordinal: it matched `500º` → *quingentésimo* and stranded
    //                `2.`, so the reading was *dois PONTO quingentésimo* — two point five-hundredth.
    //    Step 0 deliberately leaves dot-grouping to the number tokenizer, so this rule has to accept it
    //    itself. The grouped alternative comes FIRST so it wins over the bare `\d+` on `1.000º`, and the dots
    //    are stripped before Number() rather than by a separate pass, which would change what step 0 hands on.
    //    ⚠ WHEN NO ORDINAL WORD IS AVAILABLE THE INDICATOR IS STRIPPED, NOT KEPT. `portugueseOrdinal` is
    //    bounded to 1–1000, so `2.500º` and `1.000.000º` have no word — and returning the match unchanged put
    //    a raw `º` in the phoneme string, which is the very thing this rule exists to prevent and the worst of
    //    the three outcomes. Dropping the indicator reads `2.500º` as the cardinal *dois mil e
    //    quinhentos*: it loses the ordinality, which is honest lossiness, and invents no morphology. Same
    //    decision Xhosa's ordinal rule records for the English `-st/-nd/-th` suffixes.
    //    Every ordinal in this corpus is within range (`1º` ×5, `37º` ×3, `1.000º` ×3, `60º`, `11º`, `16º`,
    //    `7ª` ×3, `5ª` ×2), so this arm is for arbitrary text rather than for a corpus instance.
    s = rewrite(s, /\b([1-9]\d{0,2}(?:\.\d{3})+|\d+)\.?(?:º|ª)/gu, (whole, digits: string) => {
        const n = Number(rewrite(digits, /\./gu, ""));
        const masc = portugueseOrdinal(n);
        if (masc === undefined) return digits;
        return /ª/u.test(whole) ? feminineOrdinal(masc) : masc;
    });

    // 5) CURRENCY. R$ is the Brazilian real and was read as a stray [ʁ] followed by "dólares" — the shared
    //    tier saw only the $ and had no entry for the R.
    s = rewrite(s, /R\$\s?(\d[\d.,]*)/gu, `$1 ${MANIFEST.realWord}`);

    // 5b) THE DOLLAR CODES → the bare sign, WHICH IS WHAT MAKES THE DECLARED KEY REACHABLE. `US$` was
    //     declared in portuguese.ts's currency table and the corpus's `DROP currency ×1` stood anyway, with a
    //     note saying the difference "is not yet explained". It is explained, and the explanation indicts the
    //     verification: the INITIALISM pass runs before the symbol tier (portuguese.ts composes
    //     `SYMBOLS(initialisms(normalize(x)))`), and it splits the all-caps run — `por US$ 11.000 a` became
    //     `por u esse$ 11.000 a`, after which the `$` is preceded by a LETTER and the tier's guard, the one
    //     that stops a key biting into a word, correctly refuses it. The sign then vanishes.
    //
    //     ⚠ WHY THE ORIGINAL CHECK PASSED, and it is worth knowing: core/initialisms.ts opens with an
    //     all-caps-DOCUMENT guard — `if (!/\p{Ll}/.test(text) && /\s/.test(text.trim())) return text` — so a
    //     probe string of `US$ 11.000`, which contains no lowercase at all, tripped that guard and skipped the
    //     pass entirely. The one context tested was the one context where the interfering rule is inactive.
    //     A single-expression probe can trip a document-level heuristic; test the sign inside a sentence.
    //
    //     The fold is the attested reading, not a convenience: both pt_br speakers of this sentence say the
    //     currency word and NEVER the code — "vendidas por 11 mil dólares a 22 mil e quinhentos dólares a
    //     onça" (Parakeet over pt_br/train, 2 of 2). So `US` is not voiced, and folding to `$` loses nothing a
    //     reader says. Folding rather than emitting the word directly (the shape R$ uses above) keeps the
    //     tier's count agreement, so `US$ 1` still reads *dólar* and not *dólares*.
    //
    //     ⚠ NOT FIXED IN core/initialisms.ts, deliberately. Excluding `\p{Sc}` from that pass's trailing
    //     guard would fix pt and REGRESS the 18 other languages that carry `US$`/`AUD$` without declaring a
    //     compound key (measured across all 66 artifacts: 20 languages, every instance `US$` or `AUD$`, no
    //     counterexample). They would stop spelling the letters and start reading `US` as a WORD, with the
    //     sign still dropped — worse, for a fix they do not benefit from. The general repair is to let the
    //     currency tier claim a sign before the initialism pass sees the letters; that is a reordering, and
    //     it belongs to its own change.
    //     ⚠ ONLY WHERE A NUMBER FOLLOWS, and that guard is not cosmetic. The tier's `$` key needs an adjacent
    //     quantity; folding a bare `US$` with nothing after it would leave a lone `$` that the tier cannot
    //     claim and the tokenizer then drops, so `preços em US$` would go from spelling the letters to saying
    //     NOTHING. Neither reading is right — *dólares* is — but silence is strictly worse than the letters,
    //     so an unquantified code keeps its existing behaviour and only the useful case is folded.
    s = rewrite(s, new RegExp(`(?<![\\p{L}\\p{M}])(?:${MANIFEST.dollarCodes.join("|")})\\$(?=[ \u00a0]?\\d)`, "gu"), "$");  // space, NBSP

    // 6) DEGREES, before the unit tier so the bare sign is not left behind.
    // ⚠ THE GUARD IS `(?![\\p{L}\\p{M}])`, NOT `\\b`. JS defines `\\b` on ASCII `\\w`, so a following
    // NON-ASCII letter counts as a boundary and this rule fired when it must not: `25°Cölner` ate the ⟨C⟩
    // as Celsius and left "ölner" behind. Invisible to any ASCII fixture, and this language's own
    // orthography is what supplies the accented letter. 71 other engines already guard it this way.
    s = rewrite(s, /(\d+(?:[.,]\d+)?)\s?°\s?C(?![\p{L}\p{M}])/giu,
        (_m, n: string) => `${n} ${degreeWord(n)} ${DEG.celsius}`);
    s = rewrite(s, /(\d+(?:[.,]\d+)?)\s?°\s?F(?![\p{L}\p{M}])/giu,
        (_m, n: string) => `${n} ${degreeWord(n)} ${DEG.fahrenheit}`);
    s = rewrite(s, /(\d+(?:[.,]\d+)?)\s?°/gu, (_m, n: string) => `${n} ${degreeWord(n)}`);

    // 7) CLOCK. Two forms occur and BOTH were broken: the `h` form (×28) dropped its marker entirely
    //    ("07h19" → "sete dezenove") and the colon form (×17) turned the colon into a PAUSE with a
    //    spurious "zero" at :00. `hora` is feminine, so 1 takes *uma*.
    s = rewrite(s, /\b([01]?\d|2[0-3])\s?h\s?([0-5]\d)?(?![\p{L}\p{M}\d])/gu,
        (_m, h: string, min?: string) => clockWords(Number(h), min === undefined ? undefined : Number(min)));
    s = rewrite(s, /\b([01]?\d|2[0-3]):([0-5]\d)(?![\d:])/gu,
        (_m, h: string, min: string) => clockWords(Number(h), Number(min)));

    // 8) SIGNS. Neither occurs in this corpus, but a dropped sign is silent content loss wherever it does.
    s = rewrite(s, /(^|[\s(])[-−–](\d)/gu, `$1${SIGN.minus} $2`);
    // ⚠ ± IS A SINGLE CHARACTER (U+00B1), NOT A `+`, so no `+` rule can ever match inside it. It needs
    //    its own rule or the sign is dropped in silence; ordering against the `+` rule is free. The
    //    reading is this language's own two words juxtaposed, both taken from the plus and minus rules
    //    already in this file.
    s = rewrite(s, /±/gu, ` ${SIGN.plusMinus} `);
    s = rewrite(s, /(\S)\+\s?(\d)/gu, `$1 ${SIGN.plus} $2`);
    s = rewrite(s, /(^|\s)\+\s?(\d)/gu, `$1${SIGN.plus} $2`);

    // 8b) RELATIONAL AND DIVISION SIGNS. ⚠ SEARCH FOR THE WORDS, NEVER FOR THE SIGN. The notation is
    //     absent from pt_br; the vocabulary is ordinary comparative prose and is present:
    //
    //       `maior`     ×100 TOKEN  (`maior que` ×1 phrase — "o território da turquia é maior que 1.600 km")
    //       `menor`     ×29 TOKEN
    //       `dividido`  ×3 TOKEN
    //       `igual`     ×0 token / ×0 substring   ⚠ ABSENT ENTIRELY — the corpus cannot source the equals word
    //
    //     ⚠ SO THE EQUALS WORD CAME FROM THE REGISTER TIER, and Portuguese produced the best evidence in this
    //     whole issue: pt.wikipedia's Divisão article does not merely use the words, it NAMES THE SIGNS and then
    //     reads the notation back —
    //
    //       "o sinal de menor que ( < ), o sinal de maior que ( > ) e o sinal de desigualdade ( ≠ )"
    //       "a ÷ b = c   (a dividido por b é igual a c)"
    //
    //     — the sign and its reading in the same sentence, with the operands in place. That is the tier-4
    //     source the German pilot argued was required: a general existence check cannot distinguish a sense,
    //     and here the article states the mapping outright.
    //
    //     The copula is dropped because these strings are what the source calls the SIGNS themselves ("o sinal
    //     de menor que"), so the bare form is the sourced form — the same call `es` and `en` make.
    s = rewrite(s, /\s?=\s?/gu, ` ${SIGN.equals} `);
    s = rewrite(s, /\s?<\s?/gu, ` ${SIGN.lessThan} `);
    s = rewrite(s, /\s?>\s?/gu, ` ${SIGN.greaterThan} `);
    s = rewrite(s, /\s?÷\s?/gu, ` ${SIGN.dividedBy} `);

    // 9) FRACTIONS, guarded against a date and a unit ratio by requiring digits on both sides.
    s = rewrite(s, /\b(\d{1,3})\/(\d{1,3})\b(?!\s*[/\d])/gu, (m0, a: string, b: string) =>
        fractionWords(Number(a), Number(b)) ?? m0);

    // 10) DATES. The day is a plain cardinal, except the first of the month — and the varieties DIFFER, so
    //     this is dialect-gated like the Spanish equivalent: Brazil says *primeiro de julho*, Portugal
    //     normally *um de julho*. An EXPLICIT `1º` is honoured in both, because there the writer marked it.
    if (brazilian)
        s = rewrite(s, new RegExp(`\\b1\\s+de\\s+(${MONTHS})\\b`, "giu"), (_m, mon: string) => `${MANIFEST.ordinals.units[1]!} de ${mon}`);

    return s;
}

/** An hour/minute pair → "sete horas e dezenove" / "uma hora". */
function clockWords(h: number, min: number | undefined): string {
    const head = `${feminineCardinal(h)} ${h === 1 ? MANIFEST.clock.hour : MANIFEST.clock.hours}`;
    return min === undefined || min === 0
        ? head
        : `${head} ${MANIFEST.clock.connector} ${feminineCardinal(min)}`;
}
