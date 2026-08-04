/**
 * Telugu (te) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not already
 * a pronounceable word into words the existing pipeline speaks. Pure text→text; no IPA.
 *
 * Measured over the te_in FLEURS corpus (1,757 unique utterances, column 3 — the cased one):
 *   627 numerals (160 one-digit · 195 two-digit · 69 three-digit · 148 in the 1000-2999 year band · 31 larger)
 *   426 ZWNJ + 53 ZWSP · 144 ౦-for-ం homoglyphs · 36 comma-grouped numbers · 28 ordinal వ · 24 decimals
 *   15 clock colons · 13 numeric ranges · 8 dotted కి.మీ + 1 కిమీ · 6 currency signs · 3 percent
 *   2 degree signs · 3 exponents (km² ×2, mm2 ×1) · 2 vulgar fractions · 2 ఉదా. · 2 abbreviated మై
 *   2 era markers (క్రీ.శ, క్రీ.పూ) · 5 dotted Telugu initialisms · ~45 Latin acronyms
 *
 * THE LARGEST DEFECT WAS NOT IN THIS LAYER — same shape as Tamil, bn, ur and id. Telugu magnitude nouns
 * AGREE (వంద / రెండు వందలు / రెండు వందల) and the shared `indicNumberWords` composer neither inflects them
 * nor orders 21-99 the Dravidian way, so all 627 numerals were read in a form no speaker uses: 100 as
 * *ఒకటి వంద, 2010 as *రెండు వెయ్యి పది, 93 as *మూడు తొంభై. Fixed where it lives, in telugu.jsonc +
 * numbers.ts; this file composes on top of the corrected words.
 *
 * NO `\b` ANYWHERE. `\b` is defined on ASCII word characters and finds no boundary at all against Telugu
 * script. Every boundary here is an explicit `(?<![\p{L}\p{M}])` / `(?![\p{L}\p{M}])` lookaround.
 *
 * TELUGU DIGITS ౦-౯: the corpus contains 144 instances of ౦ (U+0C66 TELUGU DIGIT ZERO) and ZERO instances
 * of ౧-౯. Every one of the 144 is a HOMOGLYPH TYPO for ం (U+0C02, the anusvara sunna) — checked by
 * printing the neighbours of all 144, which are Telugu letters or marks in every case and never another
 * digit (స౦వత్సర౦లో for సంవత్సరంలో). So the negative result the Persian and Tamil runs reported holds
 * here too — the digit inventory is entirely ASCII — but the codepoint still occurs, mis-typed, and
 * step 2 folds it. Before the fold the abugida G2P had no mapping for it and silently DROPPED it,
 * losing the nasal: స౦వత్సర౦లో → [saʋat̪saɾaloː] instead of [sãʋat̪saɾãloː].
 *
 * LATIN ACRONYMS ARE DELIBERATELY LEFT TO THE ENGLISH PHONEMIZER. Telugu written practice does nativize
 * them — this corpus writes యూ.ఎస్., ఏ.డి., పి.యం., 802.11ఎన్, జిఎంటి, యూటిసి — but that is only 6
 * instances against ~45 left in Latin script (US, FBI, GPS, UNESCO, …), and the English path already
 * spells them letter by letter. A Latin→Telugu letter-name table would be invented data covering the
 * minority case. What IS fixed here is the dotted Telugu spellings, whose interior dots were being read
 * as clause breaks (step 5).
 */
import { foldNativeDigits } from "../../core/unicode.ts";
import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";
import { numberToWords, ordinalToWords, yearToWords, isCenturyYear } from "./numbers.ts";

/** Telugu letter+mark boundary. Never `\b`. */
const NB = "(?<![\\p{L}\\p{M}])";
const NA = "(?![\\p{L}\\p{M}])";

/** Telugu letters and marks, EXCLUDING the digit block ౦-౯ (U+0C66-0C6F) — used by the ౦ fold. */
const TE_LETTER = "\\u0C00-\\u0C65\\u0C70-\\u0C7F";

/**
 * The SHARED symbol tier (percent / currency / units / exponent). Kept in this file rather than in
 * telugu.ts because its position in the ordering matters and the ordering is this file's job.
 *
 * percent: శాతం, which this corpus itself writes 15 times in words. Telugu శాతం does not inflect for
 * count, so one form.
 *
 * currency: only the dollar occurs (×6, as `$` and `US$`). డాలరు / డాలర్లు; the corpus writes డాలర్ల,
 * డాలర్లను and డాలర్ in running text. `Nu` (Bhutan, ×2) is left alone — no sourced Telugu form, and a
 * wrong currency word is worse than a dropped sign.
 *
 * exponent uses position "before" with a SPACE: Telugu చదరపు కిలోమీటర్లు is an invariant prefixed
 * adjective plus the noun, two words. `cubed` is deliberately NOT declared — the corpus writes the
 * borrowed క్యూబిక్ for cubic and no ³ occurs, so there is nothing to source it from; the seam leaves an
 * undeclared exponent untouched.
 *
 * RATE is deliberately NOT declared (`unitPer` unset). Telugu's rate is a PREFIX in the dative, like
 * Tamil's and Korean's: this corpus writes "గంటకు 105 మైళ్ల" and "గాలులు గంటకు 83కి.మీ/గం." — the
 * shared "A per B" postposed idiom cannot express it. Handled locally in step 7.
 */
const SYMBOLS = makeSymbolNormalizer({
    percent: ["శాతం"],
    currency: { "US$": ["డాలరు", "డాలర్లు"], "$": ["డాలరు", "డాలర్లు"] },
    magnitudes: ["మిలియన్", "బిలియన్", "ట్రిలియన్", "లక్ష", "కోటి"],
    units: {
        km: ["కిలోమీటరు", "కిలోమీటర్లు"],
        cm: ["సెంటీమీటరు", "సెంటీమీటర్లు"],
        mm: ["మిల్లీమీటరు", "మిల్లీమీటర్లు"],
        kg: ["కిలోగ్రాము", "కిలోగ్రాములు"],
        mi: ["మైలు", "మైళ్లు"],
        m: ["మీటరు", "మీటర్లు"],
        // The corpus writes two units out in English words rather than abbreviated (8 miles, 24½ inches);
        // the tier's keys are plain strings, so they cost nothing to declare.
        miles: ["మైలు", "మైళ్లు"],
        inches: ["అంగుళం", "అంగుళాలు"],
    },
    // `120–160 క్యూబిక్ మీటర్ల ఇంధనాన్ని` — the loan, word-first. ఘన ×2 in this corpus is "solid/volume"
    // (`నీటి ఘన పరిమాణం`, the volume of water) and not the measure word, so the sentence decides it.
    exponentWords: { squared: ["చదరపు"], cubed: ["క్యూబిక్"], position: "before" },
});

/**
 * Telugu unit abbreviations, dotted and undotted. The shared tier above is keyed on the Latin spellings
 * and cannot see these.
 *
 * TRAP #2 (loose patterns over-count) bit here and the rule is narrower because of it. The SPACED form
 * `కి మీ` appears to occur 5 times; printing the context showed all 5 are ordinary prose crossing a word
 * boundary — …కి మీకు, …కి మీ ప్రవర్తన, …వైపుకి మీటినప్పుడు (కి is the commonest Telugu dative clitic and
 * మీ is the 2nd-person possessive). There is NO spaced variant in this corpus, so there is no spaced
 * rule. Only కి.మీ (×7, with and without a trailing dot) and కిమీ (×1) are real.
 */
const KM_RE = new RegExp(`${NB}కి\\s*\\.\\s*మీ\\.?${NA}|${NB}కిమీ${NA}`, "gu");
/** మై for మైళ్ళు, ×2, only ever after a digit — the digit guard is what keeps it off the many real words
 *  beginning మై (మైదానం, మైనస్…). */
const MI_RE = new RegExp(`(?<=\\d\\s?)మై${NA}`, "gu");

/** Era markers. Both are written without a trailing dot in this corpus (క్రీ.శ 1000, క్రీ.పూ 5000). */
const ERA: Readonly<Record<string, string>> = {
    "శ": "క్రీస్తు శకం",
    "పూ": "క్రీస్తు పూర్వం",
};
const ERA_RE = new RegExp(`${NB}క్రీ\\s*\\.\\s*(శ|పూ)\\.?${NA}`, "gu");

/**
 * Telugu renderings of the LATIN letter names, which is what a dotted Telugu initialism is made of
 * (యూ.ఎస్. = U.S., ఏ.డి. = A.D., పి.యం. = p.m.). A CLOSED LIST, for the reason the Tamil run recorded:
 * a generic "short token, dot, short token" rule cannot be written safely against a script with no case
 * distinction, because it matches sentence boundaries.
 */
const LETTER_NAME = [
    "ఏ", "బి", "బీ", "సి", "సీ", "డి", "డీ", "ఇ", "ఈ", "ఎఫ్", "జి", "జీ", "హెచ్", "ఐ", "జే",
    "కే", "ఎల్", "ఎం", "యం", "ఎన్", "ఓ", "పి", "పీ", "క్యూ", "ఆర్", "ఎస్", "టి", "టీ",
    "యు", "యూ", "వి", "వీ", "డబ్ల్యూ", "ఎక్స్", "వై", "జెడ్",
];
const LETTER = `(?:${[...LETTER_NAME].sort((a, b) => b.length - a.length).join("|")})`;
/** A run of ≥2 dot-separated letter names. The run's TRAILING dot is consumed only when the sentence
 *  visibly continues, so a true sentence-final pause is never lost. */
const INITIALISM_RE = new RegExp(
    `${NB}${LETTER}(?:\\s*\\.\\s*${LETTER})+(?:\\s*\\.(?=\\s*[\\p{L}]))?${NA}`,
    "gu",
);

/** ASCII rate numerators/denominators. Telugu puts the denominator FIRST, in the dative. */
const RATE_NUM: Readonly<Record<string, string>> = {
    km: "కిలోమీటర్లు", m: "మీటర్లు", mi: "మైళ్లు", ft: "అడుగులు",
};
const RATE_DENOM: Readonly<Record<string, string>> = { h: "గంటకు", s: "సెకనుకు" };

/**
 * The rate prefix, UNLESS the text already carries it. This corpus writes "గాలులు గంటకు 83కి.మీ/గం." —
 * the dative is already there in words and only the ASCII rate needs unpacking, so emitting the prefix
 * unconditionally would produce "గంటకు గంటకు 83 కిలోమీటర్లు". Same shape as the duplicated الساعة the
 * Arabic run hit.
 */
function dative(word: string, full: string, offset: number): string {
    return new RegExp(`${word}\\s*$`, "u").test(full.slice(0, offset)) ? "" : `${word} `;
}

/**
 * The Telugu normalizer. A numbered, ORDER-DEPENDENT sequence; the coupling is stated at each step
 * because a future reader cannot recover it from the code.
 */
export function normalizeTelugu(input: string): string {
    // 1) ZERO-WIDTH characters (ZWNJ ×426, ZWSP ×53 — the largest raw count in the corpus). Removed
    //    FIRST: every later rule asserts letter/digit adjacency, and an invisible character defeats all
    //    of them. It also fixes a defect of its own — the engine's word class excludes U+200C, so
    //    వైట్‌హాల్ tokenized as TWO words and came out [ʋˈaiʈ hˈaːl], two primary stresses where the
    //    word has one. Deleting the joiner leaves the same akshara sequence, so no phoneme changes.
    let s = input.replace(/[​-‍﻿]/gu, "");

    // 2) The ౦-for-ం HOMOGLYPH (×144). Before the digit rules, because ౦ is in the engine's digit class
    //    and any numeric rule below would otherwise be free to read it as a zero. Guarded on BOTH sides
    //    against a real Telugu digit run, and required to touch a Telugu letter or mark, so a genuine
    //    ౧౦ or a standalone ౦ is untouched. See the file header for why all 144 here are typos.
    s = s.replace(
        new RegExp(`(?<![౦-౯])౦(?![౦-౯])`, "gu"),
        (m, off: number, full: string) => {
            const near = new RegExp(`[${TE_LETTER}]`, "u");
            const prev = full[off - 1], next = full[off + 1];
            return (prev !== undefined && near.test(prev)) || (next !== undefined && near.test(next))
                ? "ం"
                : m;
        },
    );

    // 2b) GENUINE Telugu digits → ASCII. Step 2 has already claimed every ౦ that was a sunna typo,
    //     so whatever digits remain are real. Without this the engine returned an EMPTY STRING for a
    //     numeral written in Telugu digits — `\d+` is ASCII-only, so it matched no token at all and
    //     assembleClauses dropped it. The corpus has none, but silent total loss is not acceptable.
    s = foldNativeDigits(s);

    // 3) ORDINALS, before the year rule (step 4) and before de-grouping. Before the YEAR rule because
    //    that rule permits a trailing Telugu clitic (2005లో) and would otherwise swallow 1970వ and
    //    strand the వ. Before de-grouping is safe: no ordinal in this corpus is written on a grouped
    //    numeral. Telugu fuses వ onto the LAST cardinal word (18వ → పద్దెనిమిదవ, 20వ → ఇరవయ్యవ, which
    //    this corpus itself writes); emitted apart, వ reached the g2p as a stray stressed [ʋˈa].
    //    All 28 digit-adjacent వ are ordinals — checked by tabulating what follows, which is
    //    శతాబ్దం / సంవత్సరం / స్థానం every time. `వది` (60వది) is the same suffix plus the nominaliser.
    s = s.replace(
        new RegExp(`(?<![\\d.,])(\\d+)\\s*-?\\s*వ(ది)?${NA}`, "gu"),
        (whole, digits: string, di: string | undefined) => {
            const n = Number(digits);
            if (!Number.isSafeInteger(n) || n === 0) return whole;
            const w = ordinalToWords(n, di === undefined ? "వ" : "వది");
            return w === "" ? whole : w;
        },
    );

    // 4) YEARS in the 1100-1999 band, read as CENTURIES (1976 → పంతొమ్మిది వందల డెబ్బై ఆరు). Arbitrated
    //    on the FLEURS audio — four recordings, three sentences, unanimous; see numbers.ts. Runs BEFORE
    //    de-grouping (step 5) on purpose: a grouped 1,400 must NOT become a "fourteen hundred" year, and
    //    the `(?<![\d.,])` / `(?![\d.,])` guards reject it only while the comma is still there. Every
    //    bare 1100-1999 numeral in this corpus is a year (checked, 25 of them: 1469, 1644, 1912, 1966…);
    //    the 2000s already read correctly as cardinals (రెండు వేల పదకొండు), also audio-confirmed.
    s = s.replace(/(?<![\d.,])(1[1-9]\d{2})(?![\d.,])/gu, (_m, y: string) => yearToWords(Number(y)));

    // 5) DIGIT DE-GROUPING, before anything that reads punctuation. A grouping comma is otherwise clause
    //    punctuation: 17,000 was reading as "పదిహేడు <pause> సున్నా" — the pause plus a single zero,
    //    because the trailing 000 collapsed to one numeral. Western 3-digit blocks are the only grouping
    //    in this corpus (no Indian 2-then-3 form occurs).
    s = s.replace(/(?<=\d),(?=\d{3}(?:,\d|[^\d]|$))/gu, "");

    // 6) ERA markers BEFORE the initialism rule (step 7) — క్రీ.శ is a dotted pair by shape and would
    //    otherwise survive as two letters with the era lost. Also ఉదా. (= e.g., ×2), whose single dot
    //    was a mid-sentence phrase break.
    s = s.replace(ERA_RE, (_m, k: string) => ERA[k]!);
    s = s.replace(new RegExp(`${NB}ఉదా\\s*\\.\\s*(?=[\\p{L}])`, "gu"), "ఉదాహరణకు ");

    // 7) MULTI-DOT ABBREVIATIONS before single-dot ones, else the interior dot survives as a phrase
    //    break: కి.మీ was reading as [kˈi . mˈiː], two clauses, and యూ.ఎస్. as three. The Telugu unit
    //    abbreviations go first because కి/మీ are not letter names and the initialism rule cannot see
    //    them. Both run before the rate rule below, which needs కి.మీ already folded to a word.
    s = s.replace(KM_RE, "కిలోమీటర్లు");
    s = s.replace(MI_RE, "మైళ్లు");
    s = s.replace(INITIALISM_RE, (m) => m.replace(/\s*\.\s*/gu, " ").trim());

    // 8) RATE units, before the shared unit tier (step 9) claims the numerator and strands the `/x` —
    //    which is what happened: 160km/h read as [ˈʊkm ˈeᶦt͡ʃ], the denominator surviving as the English
    //    letter H. Prefix + dative, the Telugu idiom, attested verbatim in this corpus (గంటకు 105 మైళ్ల).
    //    The trailing guard is `(?![A-Za-z])`, not the general letter class, because the corpus writes
    //    160km/hకు with a Telugu clitic welded to the denominator.
    s = s.replace(
        /(?<![\p{L}\d])(\d[\d.]*)\s?(km|mi|ft|m)\s?\/\s?(h|s)(?![A-Za-z])/giu,
        (whole, n: string, u: string, den: string, off: number, full: string) => {
            const num = RATE_NUM[u.toLowerCase()], d = RATE_DENOM[den.toLowerCase()];
            if (num === undefined || d === undefined) return whole;
            return `${dative(d, full, off)}${n} ${num}`;
        },
    );
    //    The Telugu-script rate, whose numerator step 7 has already folded to a word (83కి.మీ/గం. →
    //    83కిలోమీటర్లు/గం.). Same dative guard: "గాలులు గంటకు 83కి.మీ/గం." already says గంటకు and must
    //    not say it twice, while "(165 కి.మీ./గం)" stands alone in its parenthesis and needs it.
    s = s.replace(
        new RegExp(`(\\d[\\d.]*)\\s?కిలోమీటర్లు\\s*\\/\\s*గం\\.?${NA}`, "gu"),
        (_m, n: string, off: number, full: string) => `${dative("గంటకు", full, off)}${n} కిలోమీటర్లు`,
    );

    // 9) VULGAR FRACTIONS → decimals, so they reach the (audio-confirmed) పాయింట్ path in step 11
    //    rather than being silently dropped, which is what happened before: 24½ came out ఇరవై నాలుగు.
    //    Rewriting to 24.5 avoids inventing the fused Telugu form (ఇరవై నాలుగున్నర) — the reading
    //    "ఇరవై నాలుగు పాయింట్ ఐదు" is sourced from the same audio as the rest of step 11. ×2.
    s = s.replace(/(?<=\d)\s?½/gu, ".5").replace(/(?<=\d)\s?¾/gu, ".75");

    // 10) The SHARED symbol tier: percent, currency, units, exponents. UNITS BEFORE DECIMALS (step 11) —
    //     the tier matches a unit only when a NUMBER is adjacent, and rewriting 12.8 km to
    //     "12 పాయింట్ 8 km" first would destroy that adjacency. AFTER de-grouping so that 19,500 km² and
    //     US$22,500 are each one number, and after the rate rule so km/h is already gone.
    s = SYMBOLS(s);

    // 11) TIMES BEFORE the decimal step: a bare-number rule must not claim 11:30, and the corpus writes
    //     the spaced form "10: 00-11: 00 pm" as well as 8:30, so the colon may carry a space.
    //     (a) :00 minutes are DROPPED, not read — the corpus writes "11:00 తరువాత" and reading the zeros
    //         gave "పదకొండు సున్నా". (b) every remaining digit-colon-digit becomes a SPACE: `:` is clause
    //         punctuation in this engine, so it was inserting a pause inside 10:08 and 8:46.
    //     NO గంటలు is added. Both readers of "రాత్రి 11:35 గంటల సమయంలో" in the audio said the hour and
    //     the minutes as bare numerals — the noun is already in the text in 13 of the 15 instances, so
    //     adding one would duplicate it (the Arabic الساعة shape again).
    s = s.replace(/(?<![\d:])([01]?\d|2[0-3]):\s?00(?![\d:.])/gu, "$1");
    s = s.replace(/(?<=\d):\s?(?=\d)/gu, " ");

    // 12) DECIMALS, after units and times have taken their share. The separator word and the digit-wise
    //     reading of the fraction are BOTH audio-arbitrated (te_in/test, two independent recordings):
    //     802.11 → "ఎనిమిది వందల రెండు పాయింట్ ఒకటి ఒకటి", 2.4 → "రెండు పాయింట్ నాలుగు",
    //     5.0 → "ఐదు పాయింట్ సున్నా", 6.5 → "ఆరు పాయింట్ ఐదు". The borrowed పాయింట్, not the Sanskritic
    //     దశాంశం, and the fractional digits one at a time.
    s = s.replace(
        /(?<![\d.])(\d+)\.(\d+)(?![\d.])/gu,
        (_m, int: string, frac: string) => `${int} పాయింట్ ${[...frac].join(" ")}`,
    );

    // 12b) THE PLUS SIGN → ప్లస్, SOURCED FROM THE CORPUS'S OWN AUDIO. The sign was DROPPED, so `+30°C`
    //      read *ముప్పై డిగ్రీల సెల్సియస్* — thirty degrees, with nothing where the sign was.
    //
    //      No text tier could supply the word: `concept.ts` returns the BARE CHARACTER `+` as Telugu's own
    //      label for "plus sign", and prose writes the glyph, so there is nothing to probe for. te's audio was
    //      not in this corpus until #586's FLEURS fetch; with it, decoded by
    //      facebook/wav2vec2-xlsr-53-espeak-cv-ft (a PHONEME recognizer — 392 tokens, no `+` and no digits in
    //      its vocabulary, so it cannot echo the orthography back):
    //        UTC+1   →  `… j u t i s i  p l a s  o n i …`      1 of 2 speakers; the other skips the
    //                                                          parenthetical, as in ta, en, am and zu
    //        +30°C   →  `… m u p aɪ d i ɡ ɾ i s e l s i s …`   ముప్పై = thirty, NO plus phones, 2 of 2
    //      ప్లస్ reads plˈas, which is the decoded string exactly, so no new lexical data is needed.
    //
    //      BEFORE the degree rule — the ordering coupling zu's `[+]?` taught: a rule that consumes the sign's
    //      operand must not get there first. Both arms, so the sign is read glued to a label or opening the
    //      quantity; the measurement position is voiced too because for a TTS target an explicitly typed
    //      character is content, not a reader's habit to copy.
    s = s.replace(/(\S)\+\s?(?=\d)/gu, "$1 ప్లస్ ");
    s = s.replace(/(^|\s)\+\s?(?=\d)/gu, "$1ప్లస్ ");

    // 13) DEGREES, after the decimal step so a temperature like 1.5°C keeps its point. ×2.
    s = s.replace(/(\d)\s?°\s?C(?![\p{L}])/giu, "$1 డిగ్రీల సెల్సియస్");
    s = s.replace(/(\d)\s?°\s?F(?![\p{L}])/giu, "$1 డిగ్రీల ఫారెన్‌హీట్");
    s = s.replace(/(\d)\s?°/gu, "$1 డిగ్రీలు");

    return s;
}

/** Exposed for tests: the corrected cardinal/century readings the engine now composes. */
export { numberToWords, yearToWords, isCenturyYear };
