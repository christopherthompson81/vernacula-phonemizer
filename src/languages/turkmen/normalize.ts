/**
 * Turkmen (tk) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not already
 * a pronounceable word into words the existing pipeline speaks. Pure text→text; no IPA.
 *
 * EVIDENCE. `tools/corpus/mined/tk.jsonc` — tk.wikipedia dump, 28,836 paragraph segments. Corpus-wide
 * counts for the classes claimed here: `year` 8,912 · `digit-run` 8,968 · `initialism` 4,520 ·
 * `abbrev` 3,945 · `ranges` 2,340 · `roman` 1,695 · `dotted` 1,508 · `decimals` 1,126 · `signs` 836 ·
 * `ordinal-latin` 499 · `percent` 459 · `ampersand` 414 · `grouped` 365 · `units` 245 · `clock` 231 ·
 * `arithmetic` 202 · `fractions` 185 · `exponent` 107 · `era-marker` 89 · `signed-number` 74 ·
 * `degrees` 59 · `rate` 26 · `currency` 23.
 *
 * ⚠ THE SPANISH TILDE STANDS IN FOR THE CARON, AND THE FAILURE IS NOT A SPLIT WORD. This corpus writes
 * ⟨ñ⟩ U+00F1 where ⟨ň⟩ U+0148 belongs **157 times against 1,892**, and ⟨ÿ⟩ U+00FF for ⟨ý⟩ ×6 — 161 words
 * in 430 segments. Chuvash's twin defect put a LATIN letter inside a CYRILLIC token class, so the word
 * split and the stray went to the English reader; here both letters are Latin, nothing splits, and the
 * grapheme scan simply falls through to a plain [n]:
 *
 *     öñ    → ˈøn      vs   öň    → ˈøŋ        the velar nasal, silently gone
 *     biziñ → biˈðin   vs   biziň → biˈðiŋ
 *     ÿyly  → ɯɯˈlɯ    vs   ýyly  → jɯˈlɯ      the glide read as a vowel
 *
 * `-yň` is the GENITIVE, which is why `onuñ`, `biziñ`, `ýurduñ`, `Horasanyñ` dominate the list: the
 * substitution lands on one of the commonest suffixes in the language. ⚠ AND THIS FOLD STAYS LOCAL rather
 * than joining `core/unicode.ts`: that file's folds are CROSS-SCRIPT confusables, this is a diacritic
 * substitution within one script, and ⟨ñ⟩ is a real letter of Spanish, Basque and Galician — three
 * languages this fleet serves. Step 0 checks that the word is otherwise Turkmen before touching it.
 *
 * ⚠ THE CORPUS GLOSSES ITS OWN DEGREE SIGN by writing both: "ýylyň ortaça temperaturasy **+11° gradus**",
 * "**-5° gradusa** çenli", "**+28° gradusa** barabar". ⚠ And unlike Tatar (all angular) or Chuvash (all
 * thermal), Turkmen's 31 degree signs are BOTH — eleven temperatures (`40-47 ° C`, `50 ° C-e`) and a
 * coordinate pair (`39°31′0″N 54°22′0″E`) that also needs the prime and the double prime.
 *
 * ⚠ THE FRACTION IS WRITTEN DENOMINATOR-FIRST — SOMETIMES. "dünýä ilatynyň **10/1 bölegini** tutýar" is
 * *one tenth*, and "Gury ýeriň **5/1%**" a fifth, which is the Turkic *onda bir* order; but the same
 * corpus writes `3/4 bölegine`, `1/9` and `1/8` the ordinary way. Nothing distinguishes them except which
 * reading makes sense — EXCEPT that every reversed instance has numerator > denominator. Requiring
 * numerator < denominator ≤ 12 takes the three ordinary ones, refuses the two reversed ones, and also
 * refuses the four year spans that share the notation (`2011/2012`, `1606-1669/70`, `2015/16`, `1414/15`).
 *
 * ⚠ THERE IS NO CLOCK RULE. `clock` is 231 corpus-wide and the retained text's one colon-shaped instance
 * is a FOOTBALL SCORE — "«Merw» toparyny **4:1** hasabynda utup". A two-field rule would have read the
 * scoreline as half past four (trap 9).
 *
 * SOURCING — every word emitted here is a tk.wikipedia TOKEN attestation whose examples were read; see
 * `tools/corpus/attest/tk.jsonc`.
 */
import { makeInitialismNormalizer, makeUnreadableTest } from "../../core/initialisms.ts";
import { numberToWords } from "./numbers.ts";

/** The cardinal as words — the same composer the engine's number path uses. */
const cardinal = (n: number): string => numberToWords(n).join(" ");

const FRONT = "äeiöü";
const ROUNDED = "oöuü";
// ⚠ ⟨ý⟩ IS NOT IN THIS SET, AND THAT IS THE POINT. It is the GLIDE [j], not a vowel — counting it as one
// made `ýüz` look disyllabic, suppressed the labial harmony and produced *ýüzinji* for *ýüzünji*, the
// hundredth. ⟨y⟩ (close back unrounded) IS a vowel and ⟨ý⟩ is not, and they differ by one accent.
const VOWELS = "aäeioöuüy";

/**
 * The Turkmen ORDINAL. The writer types `-njy` or `-nji` and has therefore ALREADY CHOSEN the backness
 * (the Basque finding, c1571ec); what the rule has to supply is the LINKING VOWEL that a consonant-final
 * stem needs, and that is where Turkmen differs from both its Kipchak cousins:
 *
 *     vowel-final stem      → no linking vowel        alty + njy → altynjy · ýedi + nji → ýedinji
 *     consonant, back       → -y-  / -u- if rounded   kyrk → kyrkynjy · on → onunjy · otuz → otuzynjy
 *     consonant, front      → -i-  / -ü- if rounded   bäş → bäşinji · üç → üçünji · ýüz → ýüzünji
 *
 * ⚠ LABIAL HARMONY REACHES ONLY THE SECOND SYLLABLE, and getting that wrong is the one way this rule can
 * misfire on a common numeral. `on` is *onunjy* and `ýüz` is *ýüzünji* — both monosyllables, so the
 * suffix vowel IS the second syllable and rounds. `otuz` and `dokuz` are disyllables whose suffix is the
 * THIRD syllable, and they unround: *otuzynjy*, *dokuzynjy*, never *otuzunjy*. Bashkir rounds by the
 * vowel alone and Tatar does not round at all; Turkmen rounds by the vowel AND the syllable count.
 *
 * ⚠ AND ONE STEM VOICES ITS FINAL STOP: `dört` → *dördünji*. Turkmen devoices a final stop and restores
 * the voice before a vowel-initial suffix, but among the numerals only `dört` reaches it — `kyrk` stays
 * *kyrkynjy*, not *kyrgynjy* — so it is written as the single exception it is rather than as a rule.
 */
export function ordinalOf(n: number, front: boolean): string | undefined {
    if (!Number.isInteger(n) || n < 0) return undefined;
    const words = cardinal(n).split(" ");
    let last = words[words.length - 1];
    if (last === undefined || last === "") return undefined;
    const suffix = front ? "nji" : "njy";
    if (VOWELS.includes(last.at(-1)!)) {
        words[words.length - 1] = last + suffix;
        return words.join(" ");
    }
    if (last === "dört") last = "dörd";
    const vowels = [...last].filter((c) => VOWELS.includes(c));
    const v = vowels[vowels.length - 1];
    if (v === undefined) return undefined;
    const round = ROUNDED.includes(v) && vowels.length === 1;
    const link = FRONT.includes(v) ? (round ? "ü" : "i") : round ? "u" : "y";
    words[words.length - 1] = `${last}${link}${suffix}`;
    return words.join(" ");
}

// ---------------------------------------------------------------------------------------------------
// INITIALISMS
// ---------------------------------------------------------------------------------------------------

/**
 * Turkmen letter NAMES. The alphabet is the 1993 Latin one — the Turkish set plus ⟨ä ň ý ž⟩ and without
 * ⟨ı ğ⟩ — and its letters are named by their own sound plus a vowel, the Turkic convention. The corpus's
 * caps runs are TDNG, MSZ (the Awaza tourism zone), GAR, SSSR, ABŞ (the USA), BMG (the UN), TMG.
 */
const LETTER_NAME: Readonly<Record<string, string>> = {
    a: "a", b: "be", ç: "çe", d: "de", e: "e", ä: "ä", f: "fe", g: "ge", h: "he", i: "i",
    j: "je", ž: "že", k: "ka", l: "el", m: "em", n: "en", ň: "eň", o: "o", ö: "ö", p: "pe",
    r: "er", s: "es", ş: "şe", t: "te", u: "u", ü: "ü", w: "we", y: "y", ý: "ýe", z: "ze",
};

/** Turkmen phonotactics, for the OOV rule in core/initialisms.ts. */
export const isUnreadableTurkmen = makeUnreadableTest({
    vowels: /[aäeiouöüyý]/u,
    legalOnsets: new Set(["br", "bl", "gr", "gl", "dr", "kr", "kl", "pl", "pr", "st", "sp", "sk", "tr"]),
    legalCodas: new Set(["rk", "rt", "rd", "lt", "ld", "st", "şt", "nt", "nd", "ňk", "rs", "lk", "çt"]),
});

export function normalizeTurkmenInitialisms(text: string): string {
    return makeInitialismNormalizer({
        letterName: (l) => LETTER_NAME[l],
        // Spelled out despite being pronounceable — the corpus's own runs.
        acronymLetters: new Set(["abş", "bmg", "sssr", "tdng", "msz", "gar", "tmg", "htu", "httu"]),
        isRecorded: () => false,
        isUnreadable: isUnreadableTurkmen,
    })(text);
}

// ---------------------------------------------------------------------------------------------------
// The rules
// ---------------------------------------------------------------------------------------------------

/** ⚠ EVERY BOUNDARY IN THIS FILE IS AN EXPLICIT LOOKAROUND, NEVER `\b` — `\b` is ASCII-defined and does
 *  not see ⟨ň ý ş ž ä ö ü⟩ as word characters, so it would cut Turkmen words in half (trap 1). */
const NOT_LETTER = "(?![\\p{L}\\p{M}])";
const NOT_BEFORE = "(?<![\\p{L}\\p{M}])";
/** The Turkmen letters a written suffix can be spelt with. */
const SFX = "[a-zäçžňöşüý]";

/**
 * THE ⟨ñ⟩→⟨ň⟩ AND ⟨ÿ⟩→⟨ý⟩ FOLD, gated on the word being otherwise Turkmen.
 *
 * ⚠ THE GUARD IS THE WHOLE OF IT. ⟨ñ⟩ is a real letter of Spanish, Basque and Galician and ⟨ÿ⟩ of French
 * and Dutch, so an unconditional fold would rewrite `España` and `L'Haÿ-les-Roses` inside a Turkmen
 * sentence. A word qualifies only if every other letter in it is one Turkmen uses — which is exactly the
 * test `NATIVE_CLASS` in turkmen.ts already applies for routing, restated here over the pre-fold text.
 * All 161 affected words in the corpus pass it (`onuñ`, `öñ`, `biziñ`, `Horasanyñ`, `Koreÿa`), and a
 * foreign word carrying a letter the alphabet lacks fails it — ⟨c⟩ is not Turkmen, so `München` and
 * `Cañón` are safe.
 *
 * ⚠ AND THE GUARD REACHES EXACTLY THAT FAR, WHICH IS SAID HERE RATHER THAN IMPLIED AWAY. A Spanish or
 * French word spelled only with letters Turkmen also uses — `señor`, the `Haÿ` of `L'Haÿ-les-Roses` —
 * IS rewritten. Measured over this corpus the cost is zero: all 161 words carrying ⟨ñ⟩ or ⟨ÿ⟩ are
 * Turkmen. The alternative is deleting a phoneme from 8% of the language's genitives.
 */
const TK_LETTER = /^[a-zäçžňöşüýñÿ]+$/iu;
export function foldTurkmenTildes(input: string): string {
    if (!/[ñÿÑŸ]/u.test(input)) return input;
    return input.replace(/[\p{L}\p{M}]+/gu, (w) =>
        TK_LETTER.test(w) ? w.replace(/ñ/gu, "ň").replace(/Ñ/gu, "Ň").replace(/ÿ/gu, "ý").replace(/Ÿ/gu, "Ý") : w);
}

/**
 * Attach a written ordinal suffix to a figure. The suffix the writer typed may carry a case ending past
 * the ordinal's own tail (`1-nji ýarymy` is bare, but `2011/2012-nji okuw ýylynda` and `60%-ini` show the
 * shape), so the rule derives the ordinal and splices on the OVERLAP rather than testing `endsWith`.
 */
function attachOrdinal(whole: string, digits: string, rawSuffix: string): string {
    const n = Number(digits);
    if (!Number.isSafeInteger(n)) return whole;
    const suffix = rawSuffix.toLowerCase();
    const front = suffix.startsWith("nji") || suffix.startsWith("inji") || suffix.startsWith("ünji");
    const ord = ordinalOf(n, front);
    if (ord === undefined) return whole;
    for (let k = Math.min(ord.length, suffix.length); k >= 3; k--)
        if (ord.endsWith(suffix.slice(0, k))) return ord + suffix.slice(k);
    return whole;
}

/** Normalize one Turkmen input string. Pure text→text. Steps are ORDER-DEPENDENT. */
export function normalizeTurkmen(input: string): string {
    // 0) THE TILDE FOLD, FIRST — every later rule that names a Turkmen word (the era marker's `öň`, the
    //    ordinal's own output) has to see the letters the language actually uses. See above.
    let s = foldTurkmenTildes(input);

    // 1) DIGIT DE-GROUPING — a grouping space is otherwise read as a separate number and every later rule
    //    needs the figure whole. This corpus groups with a space or a no-break space: `75 400 km²`,
    //    `25 müň adam`. TWO passes, because adjacent groups share the digit the first consumes.
    //    ⚠ THE WHOLE NUMBER IS MATCHED AT ONCE, NOT ONE JOIN PER PASS — playbook trap 63. The repeated
    //    two-digit join this sweep used at first is correct to THREE groups and silently wrong at four:
    //    the global scan resumes INSIDE the remainder and anchors on the last digit of the next group,
    //    so `80 239 800 000` became `80239 800000` — a well-formed numeral for a different quantity, and
    //    invisible to DIGIT, RAWMARK, DROP and the referee alike. ⚠ THE TRAILING GUARD REJECTS A DIGIT
    //    AND NOTHING ELSE: `(?![.,]\d)` looks right and costs `3 779,8` — a space-grouped integer with a
    //    decimal tail, which this corpus writes — while a bare `(?![\d.,])` declines every clause-final
    //    figure (trap 58). The separator here is a SPACE, and a decimal never has one before its
    //    fraction, so `(?!\d)` is the whole guard.
    s = s.replace(/(?<!\d)(?<![\d][.,])(\d{1,3})((?:[    ]\d{3})+)(?!\d)/gu,
        (_m, head: string, rest: string) => head + rest.replace(/[    ]/gu, ""));
    s = s.replace(/[   ]/gu, " ");

    // 2) THE MAGNITUDE ABBREVIATIONS, before any single-dot rule. `30,3 mln km²`, `2 mln. 361,8 müň`,
    //    `16 mln adamdy` — `mln` was reaching the g2p as a raw consonant cluster and the leak gate saw it
    //    (LEAK RAW-LATIN mln ×15). The dot is optional because the corpus writes both.
    s = s.replace(new RegExp(`${NOT_BEFORE}mlrd\\.?${NOT_LETTER}`, "giu"), "milliard");
    s = s.replace(new RegExp(`${NOT_BEFORE}mln\\.?${NOT_LETTER}`, "giu"), "million");

    // 3) THE ERA MARKER. `b.e. öň` = *biziň eramyzdan öň* (BCE) and `b.e.` = *biziň eramyz*, written five
    //    ways in the retained text — `b.e. öñ`, `B.e. öñ`, `B.e. öňki`, `B.e.ö.`, `b.e.sepgidinde` — with
    //    the tilde substitution cutting across them, which is why step 0 runs first. ⚠ THE `öň` FORM MUST
    //    BE TRIED BEFORE THE BARE `b.e.`, or the bare rule consumes the prefix and strands the "öň".
    //    The FINAL dot is kept at a sentence end, or the pause is lost outright (trap 10).
    const multi: readonly (readonly [RegExp, string])[] = [
        [new RegExp(`${NOT_BEFORE}b\\.\\s?e\\.\\s?ö\\.()`, "giu"), "biziň eramyzdan öň"],
        [new RegExp(`${NOT_BEFORE}b\\.\\s?e\\.\\s?öň(ki)?${NOT_LETTER}`, "giu"), "biziň eramyzdan öň"],
        [new RegExp(`${NOT_BEFORE}b\\.\\s?e\\.()(?=\\s|$)`, "giu"), "biziň eramyz"],
    ];
    for (const [re, word] of multi)
        s = s.replace(re, (m0: string, g1: string | undefined, offset: number, full: string) => {
            const out = `${word}${g1 ?? ""}`;
            const rest = full.slice(offset + m0.length);
            return /^\s*["»)']?\s*$/u.test(rest) ? `${out}.` : out;
        });

    // 3b) PERCENT WITH A WRITTEN SUFFIX — `önümleriniň 60%-ini berýär` ("gives 60% of its output"). The
    //     shared tier reads the sign but cannot see the `-ini` hanging off it, so the suffix was stranded
    //     as its own word (*altmyş göterim ini*). Claimed here, before the tier, which is the only place
    //     the figure and the suffix are still adjacent. The word is the tier's own `göterim`, repeated
    //     deliberately rather than left to a rule that cannot reach.
    s = s.replace(new RegExp(`(\\d+)\\s?%\\s?-\\s?(${SFX}{1,5})${NOT_LETTER}`, "gu"), "$1 göterim$2");

    // 3c) THE YEAR ABBREVIATION `ý.` — written after a figure inside the era prose the attestation probe
    //     surfaced: "Biziň eramyzdan öň 500-494**ý.**", "480-479**ý** – Kserksiň Gresiýa ýörişi". It was
    //     reaching the g2p as the bare glide [j]. ⚠ Anchored on a preceding DIGIT, because a bare `ý` is
    //     also the commonest letter in the language.
    s = s.replace(new RegExp(`(\\d)\\s?ý\\.?${NOT_LETTER}`, "gu"), "$1 ýyl");

    // 4) НОМЕР / NUMBER SIGN. The sign was dropped outright.
    s = s.replace(/№\s?(?=\d)/gu, "belgi ");

    // 5) NUMERAL + THE ORDINAL SUFFIX — the class this language is defined by, ×279 in the retained text
    //    and the reason `-njy`/`-nji` was reaching the g2p as the bare word *[nd͡ʒɯ]*: `1989-njy ýylda`,
    //    `24-nji gün`, `762-nji ýylda`, `1-nji ýarymy`, `2011/2012-nji okuw ýylynda`.
    //    ⚠ THE SUFFIX ALTERNATION IS ANCHORED ON `nj`, not opened to any letter run: this corpus writes no
    //    bare case suffix on a figure (the writer types the ordinal and declines that), so an open
    //    alternation would have nothing to gain and every space-separated noun to lose.
    //    MUST run before the range rule (step 9), which would otherwise eat the hyphen.
    s = s.replace(new RegExp(`(?<![\\d.,])(\\d+)\\s?-\\s?((?:[yiuü])?nj[yi]${SFX}{0,6})${NOT_LETTER}`, "giu"),
        (whole, digits: string, sfx: string) => attachOrdinal(whole, digits, sfx));

    // 6) THE FRACTION, and ⚠ ONLY WHERE THE READING IS UNAMBIGUOUS. See the header: this corpus writes the
    //    Turkic denominator-first order (`10/1 bölegini` = one tenth) and the ordinary order (`3/4
    //    bölegine`, `1/9`, `1/8`) in the same 430 segments, and the only thing separating them is that
    //    every reversed instance has numerator > denominator. Turkmen reads a fraction as
    //    *<denominator-locative> <numerator>* — "üçden bir" — so the denominator takes `-dan/-den`, chosen
    //    by the same harmony the ordinal uses.
    s = s.replace(/(?<![\d.,/])(\d{1,2})\s?\/\s?(\d{1,2})(?![\d.,/])/gu, (whole, num: string, den: string) => {
        const nv = Number(num), dv = Number(den);
        if (!(nv >= 1 && nv < dv && dv <= 12)) return whole;
        const dw = cardinal(dv);
        const vowels = [...dw].filter((c) => VOWELS.includes(c));
        const v = vowels[vowels.length - 1];
        if (v === undefined) return whole;
        return `${dw}${FRONT.includes(v) ? "den" : "dan"} ${cardinal(nv)}`;
    });

    // 7) SIGNS. This corpus's climate prose writes `+11°`, `-5°`, `+28°`, `- 31°` (spaced) and the true
    //    MINUS as well as the hyphen.
    s = s.replace(/(^|(?<!\d)[\s(])[-−–]\s?(\d)/gu, "$1minus $2");
    // ⚠ ± IS A SINGLE CHARACTER (U+00B1), NOT A `+`, so no `+` rule can ever match inside it.
    s = s.replace(/±/gu, " plýus minus ");
    s = s.replace(/(^|[\s(])\+\s?(\d)/gu, "$1plýus $2");

    // 8) DEGREES — and here the class is BOTH thermal and angular, which is why the coordinate pair is
    //    claimed first: `39°31′0″N 54°22′0″E`. ⚠ The corpus GLOSSES the sign by writing the word beside it
    //    ("+11° gradus", "-5° gradusa"), so `gradus` is not an inference.
    s = s.replace(/(\d)\s?°\s?(\d+)\s?[′']\s?(\d+)\s?[″"]/gu, "$1 gradus $2 minut $3 sekunt ");
    s = s.replace(/(\d)\s?°\s?(\d+)\s?[′']/gu, "$1 gradus $2 minut ");
    //    ⚠ AND THE SCALE NAME IS THE CORPUS'S OWN, from the sentence that also names the sign: "0 K
    //    (Kelwin)= -273,15°C **(gradus Selsi)** -dir". One instance, and it supplies the word, the
    //    compound order and the notation together — which is why `Selsiý`, the form I first wrote, is not
    //    what ships: it scores 0 and `Selsi` is what the language actually writes.
    //    ⚠ AND THE CASE SUFFIX SITS ON THE SCALE LETTER — `50 ° C-e ýetýär` ("reaches 50 °C"). Without
    //    this branch the ⟨C⟩ was read as [k] and the suffix stranded as its own word.
    s = s.replace(new RegExp(`(\\d)\\s?°\\s?C\\s?-\\s?(${SFX}{1,4})${NOT_LETTER}`, "gui"), "$1 gradus Selsi$2");
    s = s.replace(/(\d)\s?°\s?C(?![\p{L}\p{M}])/gui, "$1 gradus Selsi");
    s = s.replace(/(\d)\s?°\s?F(?![\p{L}\p{M}])/gui, "$1 gradus Farengeýt");
    //    ⚠ AND THE ABLATIVE SITS ON THE SIGN — `+10° dan demirgazyga` ("from +10° northward"). Glued, or
    //    the bare `dan` stands as its own word.
    s = s.replace(/(\d)\s?°\s?(dan|den)(?![\p{L}\p{M}])/gu, "$1 gradus$2");
    //    ⚠ AND THE BARE SIGN MUST NOT DOUBLE THE WORD THE CORPUS ALREADY WROTE. This corpus's own gloss
    //    is `+11° gradus` / `-5° gradusa` — sign AND word — so an unguarded fallback produced *gradus
    //    gradus*. The lookahead is what makes the gloss usable as evidence AND harmless as input.
    s = s.replace(/(\d)\s?°(?!\s*gradus)/gu, "$1 gradus ");
    s = s.replace(/(\d)\s?°(?=\s*gradus)/gu, "$1 ");

    // 9) NUMERIC RANGES. The dash was dropped outright and the endpoints fused — `1606-1669` read as one
    //    eleven-word number, `40-47 ° C` as *kyrk kyrk ýedi*. ⚠ THE DASH IS SPENT ON A PAUSE RATHER THAN A
    //    CONNECTIVE, the same measured refusal ba, kk, tt and chv make: Turkmen marks a span with case
    //    endings on BOTH operands (*kyrkdan kyrk ýedä çenli*), which needs an ablative and a dative this
    //    layer would have to derive unaided.
    //    ⚠ NOTHING MAY BE REQUIRED AFTER THE SECOND NUMBER (trap 58). Runs AFTER the ordinal and sign
    //    rules, which have already spent every hyphen that belongs to a suffix or opens a negative.
    //    The SLASH gets the same treatment once the fraction rule has had its chance at it: what is left
    //    is a year span (`2011/2012-nji okuw ýylynda`, `1414/15 ýyllarynda`) or a reversed fraction this
    //    layer declines to read, and in both a pause beats fusing the two figures into one number.
    s = s.replace(/(?<![\d.,])(\d+)\s?\/\s?(?=\d)/gu, "$1, ");
    s = s.replace(/(\d)\s?[–—]\s?(?=\d)/gu, "$1, ");
    s = s.replace(/(?<![\d.,])(\d+)\s?-\s?(?=\d)/gu, "$1, ");

    // A padded replacement (` plýus minus `) doubles a space that was already there. Harmless downstream
    // because assembleClauses collapses runs, but SLOT-GAP is a defect class and this pass should not be
    // the one producing candidates for it.
    return s.replace(/[^\S\n]{2,}/gu, " ");
}
