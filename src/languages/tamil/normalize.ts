/**
 * Tamil (ta) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not already a
 * pronounceable word into words the existing pipeline speaks. Pure text→text; no IPA.
 *
 * Measured over the ta_in FLEURS corpus (1,886 unique utterances, column 3 — the cased one):
 *   660 numerals · 39 grouped (BOTH Western 5,000,000 and Indian 7,83,562) · 29 decimals · 21 clock-colons
 *   86 ordinal ஆம் · 10 ordinal ம் · 9 ordinal வது/ஆவது · 28 clitic இல் · 14 clitic ல்
 *   31 கிமீ/கி.மீ · 4 மிமீ/கிகி · 5 era கி.மு/கி.பி · ~12 dotted Tamil initialisms (யு.எஸ், எம்.ஆர்.ஐ …)
 *   8 currency signs · 4 percent · 4 ASCII rate units (km/h, m/s, mph) · 2 exponents (km², mm2) · 20 ZWSP
 *
 * THE LARGEST DEFECT WAS NOT IN THIS LAYER. As with bn/ur/id, the number data was the real bug: Tamil
 * numerals are sandhi-fused and the compositor concatenated, so every one of the 660 numerals was read in
 * a form no speaker uses (1995 → *ஒன்று ஆயிரம் ஒன்பது நூறு தொண்ணூறு ஐந்து). That is fixed where it lives,
 * in tamil.jsonc + numbers.ts, and this file composes on top of the corrected words.
 *
 * NO `\b` ANYWHERE. `\b` is defined on ASCII word characters and finds no boundary at all against Tamil
 * script, so a rule written with it silently matches nothing (or, worse, matches mid-word). Every boundary
 * here is an explicit `(?<![\p{L}\p{M}])` / `(?![\p{L}\p{M}])` lookaround.
 *
 * Tamil DIGITS (௦–௯) and the Tamil numeral signs (௰ ௱ ௲) do NOT occur in this corpus — checked, the digit
 * inventory is entirely ASCII — so there is no digit fold here. Same negative result as Persian.
 */
import { foldNativeDigits } from "../../core/unicode.ts";
import { MANIFEST } from "./manifest.ts";
import { NOT_LETTER_AFTER, NOT_LETTER_BEFORE } from "../../core/boundaries.ts";
import { postposedSign } from "../../core/postposedSign.ts";
import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";
import { numberToWords, ordinalStem } from "./numbers.ts";
import { tr } from "../../core/provenance.ts";

/** Tamil letter+mark boundary. Never `\b`. */
/**
 * The SHARED symbol tier (percent / currency / units / rate / exponent). Kept here rather than in
 * tamil.ts because its position in the ordering matters and the ordering is this file's job — see step 6.
 *
 * percent: சதவீதம், which the corpus also writes as சதவிகிதம்; both are current, சதவீதம் is the form
 * already used by the engine. currency: only the dollar sign occurs (×8), in the bare `$` and `US$`
 * spellings. Bhutan's `Nu` (×2) is left alone — no sourced Tamil form, and a wrong
 * currency word is worse than a dropped sign.
 *
 * EXPONENT uses position "before" with a SPACE: Tamil says சதுர கிலோமீட்டர், two words — and the corpus
 * itself writes exactly that, ×7, which is what sourced the choice.
 *
 * RATE is deliberately NOT declared here (`unitPer` is unset). Tamil's rate is a PREFIX in the dative,
 * like Korean's 시속: மணிக்கு 480 கிலோமீட்டர், வினாடிக்கு 1.5 கிலோமீட்டர் — both attested verbatim in
 * this corpus. The shared seam's "A per B" postposed idiom cannot express that, so the four ASCII rate
 * forms are handled locally in step 5.
 */
const SYMBOLS = makeSymbolNormalizer({
    percent: MANIFEST.symbolTier.percent,
    currency: MANIFEST.symbolTier.currency,
    units: MANIFEST.symbolTier.units,
    exponentWords: MANIFEST.symbolTier.exponentWords,
    magnitudes: MANIFEST.symbolTier.magnitudes,
    ampersand: MANIFEST.symbolTier.ampersand,
    multiply: MANIFEST.symbolTier.multiply,
});

/**
 * Tamil unit abbreviations, written with or without the interior dot. The shared tier above is keyed on
 * the Latin spellings and cannot see these. Longest first so கி.மீ is not clipped to கி.
 *
 * Trap #2 (loose patterns over-count) applies hard here: `கி மி` spaced matched *சுருக்கி மிகவும்* until
 * the trailing `NOT_LETTER_AFTER` boundary was added, and `கிமு` would otherwise fire inside எஸ்கிமோ. Both boundaries
 * are asserted; the spaced variants additionally require a preceding digit, which is the only shape they
 * take in the corpus (12.8 கி மி).
 */
const TAMIL_UNIT: Readonly<Record<string, string>> = {
    "கிமீ": "கிலோமீட்டர்", "கிமி": "கிலோமீட்டர்",
    "மிமீ": "மில்லிமீட்டர்", "மிமி": "மில்லிமீட்டர்",
    "செமீ": "சென்டிமீட்டர்", "செமி": "சென்டிமீட்டர்",
    "கிகி": "கிலோகிராம்",
};

/**
 * ERA markers, which must be rewritten BEFORE the generic dotted-abbreviation rule below — otherwise
 * கி.மு. is read as a two-letter initialism [kɪ mʊ] and the era is lost. Both dotted and undotted
 * spellings occur (கிமு 10,000 / கி.மு. 356). Also எ.கா. = "for example", the Tamil e.g.
 */
const ERA: Readonly<Record<string, string>> = {
    "மு": "கிறிஸ்துவுக்கு முன்",
    // Written without the sandhi doubler (கிறிஸ்துவுக்குப் பின்) on purpose: the g2p voices a word-final
    // ப் to [b], so the doubled spelling came out [kiɾistuʋukːub pin].
    "பி": "கிறிஸ்துவுக்கு பின்",
};

const alt = (keys: readonly string[]): string =>
    [...keys].sort((a, b) => b.length - a.length).join("|");

const TAMIL_UNIT_RE = new RegExp(`${NOT_LETTER_BEFORE}(${alt(Object.keys(TAMIL_UNIT))})${NOT_LETTER_AFTER}`, "gu");
const TAMIL_UNIT_DOT_RE = new RegExp(
    `${NOT_LETTER_BEFORE}(கி|மி|செ)\\s*\\.\\s*(மீ|மி)${NOT_LETTER_AFTER}`,
    "gu",
);
const TAMIL_UNIT_SPACED_RE = new RegExp(`(?<=\\d\\s?)(கி|மி|செ)\\s(மீ|மி)${NOT_LETTER_AFTER}`, "gu");
// The trailing `\.?` deliberately has NO `\s*` in front of it: with one, the rule swallowed the space
// after the abbreviation and produced "கிறிஸ்துவுக்கு முன்10000" as a single token (caught by the corpus
// diff, ×2 — not by any probe).
const ERA_RE = new RegExp(`${NOT_LETTER_BEFORE}கி\\s*\\.?\\s*(மு|பி)\\.?${NOT_LETTER_AFTER}`, "gu");
const LETTER = `(?:${alt(MANIFEST.initialismLetterForms)})`;
// A run of ≥2 dot-separated letter names. The run's TRAILING dot is consumed only when the sentence
// visibly continues (whitespace + another letter); at a true sentence end it is left in place, so that
// "…1 யு.எஸ்." keeps its final pause. Zero sentence-final pauses are lost by this rule.
const INITIALISM_RE = new RegExp(
    `${NOT_LETTER_BEFORE}${LETTER}(?:\\s*\\.\\s*${LETTER})+(?:\\s*\\.(?=\\s+[\\p{L}]))?${NOT_LETTER_AFTER}`,
    "gu",
);

/** Read from the manifest — LONGEST FIRST, and the order is load-bearing (see the jsonc). */
const ORDINAL_SUFFIX = MANIFEST.ordinalSuffixes;

const ORDINAL_RE = new RegExp(
    `(?<![\\d.,])(\\d+)\\s*-?\\s*(${ORDINAL_SUFFIX.join("|")})${NOT_LETTER_AFTER}`,
    "gu",
);

/** Numeric fractions. Only the three attested shapes; Tamil lexicalises the halves and quarters. */
const FRACTION_WORD: Readonly<Record<string, string>> = {
    "1/2": "அரை", "1/4": "கால்", "3/4": "முக்கால்",
};

/** ASCII rate units. Tamil puts the denominator FIRST, in the dative — see the SYMBOLS comment. */
const RATE_DENOM: Readonly<Record<string, string>> = { h: "மணிக்கு", s: "வினாடிக்கு" };
const RATE_NUM: Readonly<Record<string, string>> = {
    km: "கிலோமீட்டர்", m: "மீட்டர்", mi: "மைல்", ft: "அடி",
};

const cardinal = (n: number): string => numberToWords(n);

/**
 * The rate prefix, UNLESS the text already carries it. The corpus writes "மணிக்கு 480 km/h" — the Tamil
 * dative is already there in words and only the ASCII rate needs unpacking, so emitting the prefix
 * unconditionally produced "மணிக்கு மணிக்கு 480 கிலோமீட்டர்". Same shape as the duplicated الساعة the
 * Arabic run hit; found here by the corpus diff, invisible to the unit probes.
 */
function dative(word: string, full: string, offset: number): string {
    return new RegExp(`${word}\\s*$`, "u").test(full.slice(0, offset)) ? "" : `${word} `;
}

/** cardinal + ordinal suffix, fused onto the LAST word (15ஆம் → பதினைந்தாம், not *பதினைந்து ஆம்). */
function ordinal(n: number, suffix: string): string | undefined {
    const words = cardinal(n).split(" ");
    const last = words[words.length - 1];
    if (last === undefined || last === "") return undefined;
    const stem = ordinalStem(last);
    if (stem === undefined) return undefined;
    words[words.length - 1] = `${stem}${suffix === "ஆவது" || suffix === "வது" ? "ாவது" : "ாம்"}`;
    return words.join(" ");
}

/**
 * The Tamil normalizer. A numbered, ORDER-DEPENDENT sequence; the coupling is stated at each step because
 * a future reader cannot recover it from the code.
 */
export function normalizeTamil(input: string): string {
    // 1) ZERO-WIDTH characters (×20 in the corpus, mostly a doubled ZWSP after a comma). Removed FIRST:
    //    every later rule asserts letter/digit adjacency, and an invisible character sitting inside a
    //    numeral or between a number and its unit defeats all of them.
    let s = input.replace(/[​-‍﻿]/gu, "");  // ZWSP, ZWJ, BOM

    // 1b) TAMIL DIGITS ௦-௯ → ASCII. None occur in the corpus (a negative result the file header records),
    //     but without the fold the engine returned an EMPTY STRING for them: `\d+` is ASCII-only, so a
    //     native numeral matched no token and assembleClauses dropped it entirely.
    s = foldNativeDigits(s);

    // 2) DIGIT DE-GROUPING, before anything that reads punctuation. A grouping comma is otherwise clause
    //    punctuation and 2,243 became "இரண்டு <pause> இருநூற்றி நாற்பத்தி மூன்று" — and 5,000,000 became
    //    "ஐந்து <pause> பூஜ்ஜியம் <pause> பூஜ்ஜியம்". BOTH grouping systems occur: Western 3-digit blocks
    //    (100,000) and Indian 2-then-3 (7,83,562), so the block is 2 OR 3 digits. Requiring ≥2 digits
    //    after the comma is what keeps a genuine list ("11, 12 வது" — always spaced) out of the rule.
    s = tr(s, /(?<=\d)(?<!(?<![\d])0),(?=\d{2,3}(?:,\d|[^\d]|$))/gu, "");

    // 3) ERA markers, BEFORE the initialism rule (step 4) — கி.மு. is a letter pair by shape and would
    //    otherwise be spelled out as [kɪ mʊ] with the era lost.
    s = tr(s, ERA_RE, (_m, k: string) => ERA[k]!);
    s = tr(s, new RegExp(`${NOT_LETTER_BEFORE}எ\\s*\\.\\s*கா\\s*\\.?${NOT_LETTER_AFTER}`, "gu"), "எடுத்துக்காட்டாக");

    // 4) MULTI-DOT ABBREVIATIONS before single-dot ones, else the interior dot survives as a phrase break:
    //    எம்.ஆர்.ஐ was reading as [ˈem . ˈaːr . ˈaᶦ], three clauses. Dotted Tamil unit abbreviations
    //    (கி.மீ ×6, மி.மி ×2) are folded to their full word here too, before the letter-name rule, since
    //    கி/மீ are not letter names and would otherwise keep their dot.
    s = tr(s, TAMIL_UNIT_DOT_RE, (_m, a: string, b: string) =>
        TAMIL_UNIT[`${a}${b}`] ?? TAMIL_UNIT[`${a}மீ`] ?? `${a}${b}`);
    s = tr(s, TAMIL_UNIT_SPACED_RE, (_m, a: string, b: string) =>
        TAMIL_UNIT[`${a}${b}`] ?? TAMIL_UNIT[`${a}மீ`] ?? `${a} ${b}`);
    s = tr(s, TAMIL_UNIT_RE, (_m, u: string) => TAMIL_UNIT[u]!);
    s = tr(s, INITIALISM_RE, (m) => m.replace(/\s*\.\s*/gu, " ").trim());
    //    திரு. (Mr.) — a single-dot abbreviation, ×3; its dot was a phrase break mid-sentence.
    s = tr(s, new RegExp(`${NOT_LETTER_BEFORE}திரு\\s*\\.\\s*(?=[\\p{L}])`, "gu"), "திரு ");

    // 5) RATE units, before the shared unit tier (step 6) claims the numerator and strands the `/x`.
    //    Prefix + dative, which is the Tamil idiom and is attested verbatim in this corpus
    //    ("மணிக்கு 64 கி.மீ", "வினாடிக்கு 1.5 கிலோமீட்டர்"). mph is the same shape spelled as one token.
    s = tr(s, 
        // The closing boundary is `(?![A-Za-z])`, NOT the general letter class: the corpus writes
        // "160km/hக்கு" with a Tamil case clitic welded to the denominator, and a `\p{L}` guard rejected
        // it — after which the shared tier claimed "160km" and left "/h" stranded as the letter H.
        new RegExp(`(?<![\\p{L}\\d])(\\d[\\d.]*)\\s?(km|mi|ft|m)\\s?/\\s?(h|s)(?![A-Za-z])`, "giu"),
        (whole, n: string, u: string, den: string, off: number, full: string) => {
            const num = RATE_NUM[u.toLowerCase()], d = RATE_DENOM[den.toLowerCase()];
            if (num === undefined || d === undefined) return whole;
            return `${dative(d, full, off)}${n} ${num}`;
        },
    );
    s = tr(s, new RegExp(`(\\d[\\d.]*)\\s?mph${NOT_LETTER_AFTER}`, "giu"),
        (_m, n: string, off: number, full: string) => `${dative("மணிக்கு", full, off)}${n} மைல்`);

    // 6) The SHARED symbol tier: percent, currency, units, exponents. UNITS BEFORE DECIMALS (step 8) —
    //    the tier matches a unit only when a NUMBER is adjacent, and rewriting "3.50 மீ" to
    //    "3 புள்ளி 5 0 மீ" first would destroy that adjacency. It also runs AFTER de-grouping so that
    //    "US$22,500" is one number, and after the rate rule so `km/h` is already gone.
    s = SYMBOLS(s);

    // 7) TIMES BEFORE the decimal and sign steps: a bare-number rule must not claim 11:30, and 15.00 UTC
    //    is a clock, not a decimal.
    //    (a) the dotted clock, which only appears with an explicit zone (15.00 UTC, 12.00 GMT ×2).
    s = tr(s, 
        /(?<![\d.:])([01]?\d|2[0-3])\.([0-5]\d)(?=\s*(?:UTC|GMT))/gu,
        (_m, h: string, min: string) => (Number(min) === 0 ? h : `${h} ${min}`),
    );
    //    (b) :00 minutes are DROPPED, not read: "11:00 மணிக்கு" is பதினொன்று மணிக்கு, and reading the
    //    zeros gave "பதினொன்று பூஜ்ஜியம் பூஜ்ஜியம் மணிக்கு".
    s = tr(s, /(?<![\d:])([01]?\d|2[0-3]):00(?![\d:.])/gu, "$1");
    //    (c) every remaining digit-colon-digit becomes a SPACE. The colon is clause punctuation in this
    //    engine, so it was inserting a pause inside 10:08, 06:30 and the sports times 4:41.30 / 2:11.60 /
    //    1:09.02. A fuller "H மணி M நிமிடம்" rendering was REJECTED after reading the corpus: 13 of the 15
    //    wall-clock instances already carry மணிக்கு/மணியளவில் in the text, so it would duplicate the noun.
    s = tr(s, /(?<=\d):(?=\d)/gu, " ");

    // 8) DECIMALS, after units and times have taken their share. Tamil reads the fractional part digit by
    //    digit after புள்ளி ("point"), so they are separated — 3.50 → மூன்று புள்ளி ஐந்து பூஜ்ஜியம்.
    s = tr(s, 
        /(?<![\d.])(\d+)\.(\d+)(?![\d.])/gu,
        (_m, int: string, frac: string) => `${int} புள்ளி ${[...frac].join(" ")}`,
    );

    // 8b) PLUS — SOURCED FROM THE CORPUS'S OWN AUDIO
    s = tr(s, /±/gu, " கூட்டல் கழித்தல் ");
    s = tr(s, /(\S)\+\s?(\d)/gu, "$1 பிளஸ் $2");
    s = tr(s, /(^|\s)\+\s?(\d)/gu, "$1பிளஸ் $2");

    // 8c) THE RELATIONAL AND DIVISION SIGNS
    s = postposedSign(s, "<", "ஐ விட குறைவாக");
    s = postposedSign(s, ">", "ஐ விட அதிகமாக");
    s = tr(s, /\s?=\s?/gu, " சமம் ");
    s = tr(s, /\s?÷\s?/gu, " வகுத்தல் ");

    // 9) DEGREES. One bare `35 ° W` plus the spelled-out டிகிரி elsewhere; the scale letter is matched
    //    case-insensitively because the corpus writes both C and c.
    s = tr(s, /(\d)\s?°\s?C(?![\p{L}])/giu, "$1 டிகிரி செல்சியஸ்");
    s = tr(s, /(\d)\s?°\s?F(?![\p{L}])/giu, "$1 டிகிரி பாரன்ஹீட்");
    s = tr(s, /(\d)\s?°/gu, "$1 டிகிரி");

    // 10) FRACTIONS. Only after the rate rule, which also owns `/`. Tamil lexicalises ½/¼/¾; anything
    //     else takes the "N-இல் M பங்கு" frame (1/5 → ஐந்தில் ஒரு பங்கு).
    s = tr(s, 
        /(?<![\d./])(\d{1,3})\/(\d{1,3})(?![\d/])/gu,
        (whole, a: string, b: string) => {
            const lex = FRACTION_WORD[`${a}/${b}`];
            if (lex !== undefined) return lex;
            const den = ordinalStem(cardinal(Number(b)).split(" ").pop() ?? "");
            if (den === undefined || Number(b) === 0) return whole;
            const dw = cardinal(Number(b)).split(" ");
            dw[dw.length - 1] = `${den}ில்`;
            return `${dw.join(" ")} ${Number(a) === 1 ? "ஒரு" : cardinal(Number(a))} பங்கு`;
        },
    );

    // 11) ORDINALS, last of the digit rules — it must see a de-grouped, de-colonised numeral, and it
    //     consumes the hyphen that the range/clitic forms also use. Tamil fuses the suffix onto the final
    //     cardinal word (2019-ஆம் → இரண்டாயிரத்து பத்தொன்பதாம்); emitted apart, ஆம் reached the g2p as a
    //     stray [aːm]. All 105 digit-adjacent ஆம்/ம்/வது in the corpus are ordinals — checked by
    //     tabulating what follows, which is ஆண்டு / நூற்றாண்டு / தேதி / பிரிவு every time.
    s = tr(s, ORDINAL_RE, (whole, digits: string, suffix: string) =>
        ordinal(Number(digits), suffix) ?? whole);

    // 12) The LOCATIVE clitic written as bare ல் (×14, "1444-ல்"). Alone it is a single consonant and
    //     reached the output as [l]; இல் is the full form of the same case marker and is what the corpus
    //     writes in the other 28 instances. Attaching the case to the numeral's oblique properly
    //     (ஆயிரத்து நானூற்று நாற்பத்து நான்கில்) is left undone — see the header of the commit.
    s = tr(s, /(\d)\s*-?\s*ல்(?![\p{L}\p{M}])/gu, "$1 இல்");

    return s;
}
