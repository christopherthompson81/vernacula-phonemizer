/**
 * Icelandic (is) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything the
 * Icelandic g2p cannot already read into Icelandic words the existing pipeline speaks. Pure text→text, no
 * IPA. Runs inside icelandic.ts's `text()`, before the tokenizer.
 *
 * MEASURED OVER THE FLEURS is_is CORPUS, column 3 (the ORIGINAL cased text; 1008 utterances):
 *   ordinal dot N.       46 before a lowercase word (5 before a capital)   ← the largest defect
 *   Latin units N km     57      period-grouped N.NNN  22      ranges N–N  12
 *   colon clock HH:MM    10      decimal comma N,N      8      percent N %  2      km²  2
 *
 * ⚠ ICELANDIC ORDINALS AGREE IN GENDER AND CASE, which is what makes this file different from the
 * Norwegian and Danish ones where a single ordinal form served. The weak adjective declension is:
 *
 *     -i   masculine NOMINATIVE only
 *     -a   masculine oblique · feminine nominative · neuter throughout
 *     -u   feminine oblique
 *
 * The corpus's 46 instances split accordingly: 22 before a MONTH NAME (masculine nominative → `-i`,
 * *sautjándi september*), 15 before `öld`/`aldar` ("century", FEMININE → `-a` nominative, `-u` genitive:
 * *átjánda öld* but *átjándu aldar*), and 9 others including `sæti` (neuter → `-a`) and `1. dag`
 * (masculine ACCUSATIVE → `-a`).
 *
 * So `-a` is the DEFAULT, not `-i`. A bare `N.` before an arbitrary noun is more likely oblique or
 * non-masculine than masculine-nominative, and `-i` is the one ending that is never right anywhere else.
 * Porting Norwegian's single-form table would have produced the masculine nominative everywhere and been
 * wrong for the 15 `öld` instances alone.
 *
 * ⚠ NO PERIOD-CLOCK RULE, and for a fifth distinct reason across this sweep. `HH.MM` appears to occur 24
 * times, but that count is an artefact: the pattern matches INSIDE the 22 period-grouped thousands
 * (`1.234` contains `1.23`). Exactly one standalone instance exists and it is a decimal — `6.34 tommum`,
 * inches. The 10 real clocks are all colon-form.
 *
 * ORDERING:
 *   · DE-GROUPING FIRST, before the ordinal rule, or `1.234` is read as an ordinal followed by a numeral.
 *   · THE ORDINAL RULE AFTER de-grouping and after the decimal rule, both of which own a period too.
 */
import { MANIFEST } from "./manifest.ts";

/**
 * Ordinals 1–31 in the three weak endings. `masc` is the masculine NOMINATIVE (`-i`); `common` covers
 * masculine oblique, feminine nominative and all neuter (`-a`); `femOblique` is the feminine oblique
 * (`-u`), which the corpus needs for the genitive `aldar`.
 */
interface OrdinalForms { masc: string; common: string; femOblique: string }
const ORD = (masc: string, common: string, femOblique: string): OrdinalForms => ({ masc, common, femOblique });

/** Read from the manifest — see the jsonc, where the evidence lives. */
const ORDINALS = MANIFEST.ordinals;

/** Month names select the MASCULINE NOMINATIVE — *sautjándi september*. 22 of the corpus's 46 ordinals. */
const MONTHS = /^(janúar|febrúar|mars|apríl|maí|júní|júlí|ágúst|september|október|nóvember|desember)/u;
/** `öld` is FEMININE; its oblique forms take the `-u` ordinal — *átjándu aldar*. 15 instances. */
const FEM_OBLIQUE = /^(aldar|öldinni|aldarinnar|aldir)/u;

/**
 * DOTTED ICELANDIC ABBREVIATIONS — the ⟨o.s.frv.⟩ / ⟨o.fl.⟩ family, and the reason they are a normalization
 * problem rather than a spelling one. Each is a chain of one- to three-letter pieces separated by periods, so
 * the tokenizer sees a CLAUSE BREAK after every piece and the g2p is handed `frv` and `fl` — consonant runs
 * with no nucleus, which reach the phoneme stream as raw ASCII. They are the whole of this corpus's raw-Latin
 * residual apart from `mph`: `o.s.frv.` ×3, `o.fl.` ×1.
 *
 * ⚠ THE EXPANSION IS is.wikipedia's OWN, from its article on abbreviations, which spells the pair out in the
 * definitional frame: *„og fleira“ sem er skammstafað sem „o.fl.“* and *og fleira → o.fl.* The phrase behind
 * the other is `og svo framvegis` (attest.ts: `framvegis` 24 tokens / 17 articles, every example the
 * sentence-final *og svo framvegis* = "and so forth"; `fleira` 27 / 20). So the words are the language's, in
 * the slot, and named beside the abbreviation itself.
 *
 * ⚠ ONLY THE TWO THE CORPUS WRITES. `t.d.`, `m.a.`, `þ.e.`, `a.m.k.` are the same shape and are NOT listed:
 * this table would grow to the whole of an abbreviation dictionary, and each entry is a claim the corpus here
 * cannot check. `t.d.` in particular is already spelled out in running text in this corpus (*Til dæmis er
 * bent á…*), i.e. the writer, not the layer, resolved it.
 *
 * ⚠ THE TRAILING DOT IS CONSUMED. Leaving it turned the expansion into a sentence break of its own — the same
 * `\.?(?![\p{L}])` reasoning naija's ⟨Dr⟩ rule records. A following capital is not a reason to keep it: these
 * abbreviations are clause-medial or clause-final list-closers and the corpus never starts a sentence after
 * one without other punctuation.
 */
const ABBREV: [RegExp, string][] = [
    [/(?<![\p{L}\p{M}])o\.\s?s\.\s?frv\.?(?![\p{L}])/giu, "og svo framvegis"],
    [/(?<![\p{L}\p{M}])o\.\s?fl\.?(?![\p{L}])/giu, "og fleira"],
];

/** Latin unit abbreviations → Icelandic words (57 instances). */
const UNITS: [RegExp, string][] = [
    // ⚠ ⟨mph⟩ IS A RATE WRITTEN AS ONE TOKEN, which is why it sits in this table and not beside the `km/klst`
    // rule below: there is no slash for that rule to key on. ×2 here (`300 mph`, `40 mph (64 km/klst)`), both
    // in foreign-sourced weather copy, which is exactly where an Icelandic text meets the imperial unit.
    // ⚠ is.wikipedia GLOSSES THE ABBREVIATION ITSELF, in its units-of-speed list: *„kílómetrar á
    // klukkustund, (tákn km/h) MÍLUR Á KLUKKUSTUND, (TÁKN MPH) hnútar (sjómílur á klukkustund, merki kt)"* —
    // the word, the symbol and the frame in one sentence. `mílur` is independently attested 20 articles deep
    // in exactly the measure slot (*68 kílómetra (42 mílur) suður af*), and `klukkustund` is the same noun
    // the `km/klst` rule two steps down already spends.
    // Placed FIRST so no later two-letter key can bite into it; `mm`/`km` cannot in any case, since every
    // entry is anchored to a preceding digit.
    [/mph/giu, "mílur á klukkustund"],
    [/km/giu, "kílómetrar"],
    [/kg/giu, "kílógrömm"],
    [/cm/giu, "sentímetrar"],
    [/mm/giu, "millímetrar"],
    // ⚠ NO BARE `m`, though metra ×4 / metrar ×2 and every digit-adjacent bare `m` in the corpus IS a metre
    // (`100 m og 200 m skriðsund`, `133 m/s`, `100 fet (30 m)`). It was added and withdrawn on measurement:
    // `802.11m` then read as "…ellefu METRAR". The shared tier has a `NOT_VERSION` guard for exactly that —
    // it exists because `802.11g` once read as "802.11 GRAMS" in ten languages — but the guard works by
    // seeing the DOT, and step 4 above has already turned it into a separate token by then. Trap 39: a
    // guard's evidence has a lifetime, and this file spends the dot before the tier can use it.
    // Nothing is lost by leaving it out: the squared and cubed rules below are LOCAL and never consult this
    // table, so `5 m³` reads regardless.
];

/** Relational and operator signs, read in every position — a dropped sign is inaudible. */
const RELATIONAL: [RegExp, string][] = [
    [/±/gu, " plús mínus "],
    [/[=≈]/gu, " jafnt og "],
    [/</gu, " minna en "],
    [/>/gu, " meira en "],
    // ⚠ ASCII `x` TOO, not only `×`: `NxN` forms outnumber `×` roughly 85 to 20 across the corpora, and the
    // bare `x` was reaching the phoneme stream as its own LETTER NAME. Digit-bounded, so it cannot claim a letter.
    [/×|(?<=\p{Nd})[ \t]?x[ \t]?(?=\p{Nd})/gu, " sinnum "],
    [/÷/gu, " deilt með "],
];

/** Currency sign → the Icelandic word. */
const CURRENCY: Readonly<Record<string, string>> = {
    "$": "dalir", "€": "evrur", "£": "pund", "¥": "jen",
};

export function normalizeIcelandic(input: string): string {
    let t = input;

    // 0) DOTTED ABBREVIATIONS, BEFORE every rule that reasons about a period. They carry no digit, so no
    //    numeric rule below could claim one — but the ordering is stated rather than relied on, because the
    //    period is contested by three separate rules in this file and an abbreviation that survives into any
    //    of them arrives as a clause break plus a vowelless ASCII run.
    for (const [re, word] of ABBREV) t = t.replace(re, word);

    // 1) PERIOD-GROUPED THOUSANDS (22), FIRST — before the ordinal rule, which would otherwise claim the
    //    `1.` of `1.234`. The period is clause punctuation, so the numeral read as "one" + a SENTENCE
    //    BREAK + "two hundred and thirty four".
    let prev: string;
    do {
        prev = t;
        t = t.replace(/(\d)\.(\d{3})(?!\d)/gu, "$1$2");
    } while (t !== prev);

    // 2) DECIMAL COMMA (8). The comma is clause punctuation too, so `12,5` read as a PAUSE inside a
    //    number. Fractional part spoken digit by digit.
    t = t.replace(/(\d+),(\d+)/gu, (_m, whole: string, frac: string) =>
        `${whole} komma ${[...frac].join(" ")}`);

    // 3) CLOCK, COLON FORM ONLY (10). The period form is a decimal here — see the header.
    t = t.replace(/(\d{1,2}):(\d{2})(?!\d)/gu, "$1 $2");

    // 4) PERCENT (2) and DEGREES. Postposed.
    t = t.replace(/(\d+)\s*%/gu, "$1 prósent");
    t = t.replace(/℃/gu, "°C").replace(/℉/gu, "°F");
    t = t.replace(/(\d)\s*°\s*C(?!\p{L})/giu, "$1 gráður á Celsíus");
    t = t.replace(/(\d)\s*°\s*F(?!\p{L})/giu, "$1 gráður á Fahrenheit");
    t = t.replace(/(\d)\s*°/gu, "$1 gráður");

    // 5) SQUARED UNITS (2), before the plain unit rule or the `km` is consumed and the exponent stranded.
    t = t.replace(/(?<!\p{L})km\s*[²2](?!\d)/giu, "ferkílómetrar");
    t = t.replace(/(?<!\p{L})m\s*[²2](?!\d)/giu, "fermetrar");
    //    …and CUBED, the same shape. `rúmmetra` is the corpus's own word: "Luno var með 120–160 rúmmetra af
    //    eldsneyti um borð". Icelandic fuses the measure word on like `fer-`, so this is a prefix and not a
    //    separate word — `ferkílómetrar` above is the pattern. The nominative plural is emitted to match the
    //    rest of this file's unit table; the corpus's `rúmmetra` is that noun in the accusative, which the
    //    numeral governs and which no rule here inflects for (a standing limitation of the whole table).
    t = t.replace(/(?<!\p{L})km\s*[³3](?!\d)/giu, "rúmkílómetrar");
    t = t.replace(/(?<!\p{L})m\s*[³3](?!\d)/giu, "rúmmetrar");

    // 6) LATIN UNIT ABBREVIATIONS after a number (57).
    // 6a) RATES, BEFORE the plain unit loop — that loop's guard is `(?!\p{L})`, which a slash satisfies, so it
    //     ate the numerator and left the denominator to read as a letter: `83 km/klst` came out
    //     *…kílómetrar HKLST* and `120 km/h` as *…kílómetrar H*. `á klukkustund` ×3 in this corpus
    //     ("17.500 mílna hraða á klukkustund"); the abbreviation it writes is `km/klst.`, Icelandic
    //     *klukkustund*, not `km/h`, and both are claimed because foreign-sourced text hands over the latter.
    //     NO SECOND: `á sekúndu` and `sekúndu` are both ×0 here, so `m/s` is left alone rather than invented.
    t = t.replace(/(?<!\p{L})km\s*\/\s*(?:klst\.?|h)(?![\p{L}])/giu, "kílómetrar á klukkustund");
    for (const [re, word] of UNITS)
        t = t.replace(new RegExp(`(\\d)\\s*(?:${re.source})(?!\\p{L})`, "gu"), `$1 ${word}`);

    // 7) ORDINAL DOT (46) — the largest defect. `3. maí` read as "þrír" + a SENTENCE BREAK + "maí".
    //    THE FORM IS SELECTED BY WHAT FOLLOWS, which is the Icelandic-specific part: a month name takes
    //    the masculine nominative `-i`, the oblique forms of `öld` take `-u`, and everything else takes
    //    `-a` — see the declension table in the header for why `-a` is the default rather than `-i`.
    t = t.replace(/(?<!\d)(\d{1,2})\.(?=\s+\p{Ll})\s+(\p{Ll}+)/gu, (m, n: string, next: string) => {
        const forms = ORDINALS[n];
        if (forms === undefined) return m;
        const word = MONTHS.test(next) ? forms.masc : FEM_OBLIQUE.test(next) ? forms.femOblique : forms.common;
        return `${word} ${next}`;
    });

    // 8) RANGES (12). Spoken `til`.
    t = t.replace(/(?<![-–—])(\d+)\s*[-–—]\s*(\d+)(?!\d)(?!\s*[-–—]\s*\d)/gu, "$1 til $2");

    // 9) CURRENCY, both placements.
    for (const [sign, word] of Object.entries(CURRENCY)) {
        const esc = sign.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
        t = t.replace(new RegExp(`${esc}\\s*(\\d+)`, "gu"), `$1 ${word}`);
        t = t.replace(new RegExp(`(\\d+)\\s*${esc}`, "gu"), `$1 ${word}`);
    }

    // 10) SIGNED NUMBERS — a sign PREFIXED to a number, after ranges so a range's dash is already gone.
    t = t.replace(/(?<![\p{L}\d])([-−+])(\d+)/gu, (_m, sign: string, n: string) =>
        `${sign === "+" ? "plús" : "mínus"} ${n}`);

    // 11) ARITHMETIC AND RELATIONAL SIGNS — infix between digits is where arithmetic lives; the
    //     relational signs are read in every position.
    t = t.replace(/(\d)\s*\+\s*(\d)/gu, "$1 plús $2");
    for (const [re, word] of RELATIONAL) t = t.replace(re, word);

    // 12) AMPERSAND → og.
    t = t.replace(/\s*[&＆]\s*/gu, " og ");

    // The insertions above pad with spaces so a sign never fuses with its neighbours; collapse the runs.
    return t.replace(/[ \t]{2,}/gu, " ");
}
