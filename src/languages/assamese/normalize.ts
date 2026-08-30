/**
 * Assamese (as) text normalization — the pre-tokenizer pass that rewrites everything which is not already a
 * pronounceable word into words the pipeline speaks. Pure text→text; no IPA.
 *
 * ⚠ THIS IS A PRE-PASS, NOT THE WHOLE LAYER. The Assamese engine reuses the Bengali engine
 * (`makeNativeBengali`), which internally runs `makeBengaliNormalizer` plus a Bengali-word symbol tier on the
 * Assamese manifest — so digit folding, `°C`, `%`, currency, clocks, dot decimals, comma-grouping and the
 * Bengali-style ordinals `7ম`/`13তম` are ALREADY HANDLED there. This pass owns only the Assamese-specific
 * gaps, and is composed BEFORE `makeNativeBengali(...).text()` in createAssamese.
 *
 * ⚠ THE `শ` ORDINAL IS THIS FILE'S REASON TO EXIST. Assamese writes the CLASSICAL 11–20 series as a numeral
 * plus `শ` — 11শ → একাদশ, 12শ → দ্বাদশ, 18শ → অষ্টাদশ — the same Sanskrit table as Bengali's শে date form but
 * written without the ে. Unhandled it reads as the cardinal plus a bare শ syllable.
 * ⚠ `1শ` IS NOT AN ORDINAL. It is একশ, "one hundred", so the rule must require a tens digit.
 *
 * ⚠ DIGIT FOLDING IS NOT DONE HERE. The Bengali normalize folds Bengali digits to ASCII in its own step 0,
 * and this pass runs BEFORE it — so every rule here must accept BOTH scripts, via the shared digit class.
 */
import { BENGALI_DIGITS } from "../../core/unicode.ts";
import { indicNumberWords, type NumbersDef } from "../../core/numbers.ts";
import { loadManifest } from "../../core/loadManifest.ts";
import type { BengaliDef } from "../bengali/bengali.ts";
import { renormalize, rewrite } from "../../core/provenance.ts";

const BN_DIGIT = Object.keys(BENGALI_DIGITS).join("");
/** Either digit system. */
const D = `0-9${BN_DIGIT}`;

/** Fold Bengali digits to ASCII so a value can be computed from either script. */
function toAscii(s: string): string {
    return [...s].map((c) => BENGALI_DIGITS[c] ?? c).join("");
}

/** Magnitude nouns that sit BETWEEN a number and its currency ("$১৪.৭ বিলিয়ন আমেৰিকান ডলাৰ" — Assamese's own
 *  word order). মিলিয়ন and বিলিয়ন are the attested pair; the Indic scale words are listed with them because the
 *  same rule has to survive them. */
const MAGNITUDE = "(?:মিলিয়ন|বিলিয়ন|ট্ৰিলিয়ন|হাজাৰ|লাখ|কোটি)";

/**
 * ⚠ THE CLASSICAL ORDINAL SERIES 11–20 IS SUPPLETIVE, not the cardinal plus a suffix: 11শ is একাদশ, not
 * *এঘাৰশ. (1–10 are the Bengali normalize's table — প্রথম…দশম; 21 up are cardinal+তম, also Bengali's.)
 */
const ORDINAL_11_20: Readonly<Record<number, string>> = {
    11: "একাদশ", 12: "দ্বাদশ", 13: "ত্রয়োদশ", 14: "চতুর্দশ", 15: "পঞ্চদশ",
    16: "ষোড়শ", 17: "সপ্তদশ", 18: "অষ্টাদশ", 19: "ঊনবিংশ", 20: "বিংশ",
};

/** Build the Assamese pre-pass normalizer. Takes the numbers definition so it can re-compose a cardinal
 *  (e.g. for `1,000তম` where the suffix must stay attached to the de-grouped number). */
export function makeAssameseNormalizer(numbers: NumbersDef): (text: string) => string {
    const cardinal = (n: number): string => indicNumberWords(n, numbers).map((w) => w ?? "").join(" ");

    return (input: string): string => {
        // NFC FIRST — every rule below matches Bengali-script LITERALS, and this script encodes য়/ড়/ঢ়
        // two ways: precomposed (U+09DF) or base + nukta (U+09AF U+09BC). The corpus uses BOTH, sometimes
        // in the same word — `বিলিয়ন` is precomposed while one `মিলিয়ন` is not — so a literal written one
        // way silently matched half the instances: the currency rule left `$১৪.৭ বিলিয়ন আমেৰিকান ডলাৰ`
        // reading *14.7 dollar billion American dollar*. NFC is the right fold because these letters are
        // Unicode composition EXCLUSIONS, so it yields the decomposed form the literals here use, and it is
        // what the Bengali g2p already applies downstream (both forms give byte-identical IPA).
        let s = renormalize(input, "NFC");

        // 1) DOTTED LATIN RUNS → a bare run, before anything else. `U.S.` was *jˈuː . ˈɛs .* — the interior
        //    dot survives as a phrase break. Also `George W. Bush` — the W. suffix dot is a break. A dotted
        //    Bengali run (ইউ.এছ.অ.চি, USOC) is the same shape and loses its dots so the letters read as one
        //    run (the spaces keep them distinct aksharas).
        s = rewrite(s, /(?<![\p{L}\p{M}])[A-Za-z]\.(?:[ \u00a0]?[A-Za-z]\.)+/gu, (m0) => m0.replace(/[.\s]/gu, ""));  // space, NBSP
        // A LONE capital + dot is an initial (`George W. Bush`, the corpus's only instance). Keying on any
        // capital before the dot also stripped the SENTENCE period after an acronym — `NASA. Bush` and
        // `the U.S. The next` lost their pause — so the initial must be a single letter.
        s = rewrite(s, /(?<![\p{L}\p{M}])([A-Z])\.(?=\s+[A-Z])/gu, "$1");
        s = rewrite(s, /(?<![\p{L}\p{M}])[\p{Script=Bengali}\p{M}]+\.(?:[ \u00a0]?[\p{Script=Bengali}\p{M}]+\.)+/gu, (m0) => m0.replace(/\./gu, " ").replace(/\s+/gu, " "));  // space, NBSP

        // 2) THE `Nশ` CLASSICAL ORDINALS (11–20) and `1শ` = একশ. The শ suffix is the ordinal for a
        //    two-digit 11–20 (century ordinals — the corpus's dominant use), but `1শ` is "one hundred".
        //    BEFORE the Bengali normalize's ordinal rule (which does not know শ) so the suffix cannot reach
        //    the tokenizer as a bare syllable.
        //    The guard `(?!ত)` keeps the WORD শত ("hundred") out: the corpus writes `৯০শত` (nine thousand),
        //    and without it a `11শত` would read as the ordinal একাদশ with a stray ত.
        s = rewrite(s, new RegExp(`(?<![${D}])([${D}]{2})(শ)(?![${D}ত])`, "gu"), (m0, d: string) => {
            const n = Number(toAscii(d));
            return ORDINAL_11_20[n] ?? (n === 10 ? "দশম" : m0);
        });
        s = rewrite(s, new RegExp(`(?<![${D}])([${D}])শ(?![${D}])`, "gu"), (m0, d: string) =>
            Number(toAscii(d)) === 1 ? "একশ" : m0);

        // 3) THE `নং` NUMBER MARKER — "number N" (190 নং স্থান → position number 190). Not an ordinal; the
        //    marker reads নম্বৰ (number), like the Latin "no.".
        s = rewrite(s, new RegExp(`(?<![${D}])([${D}]+)\\s?নং(?![\\p{L}\\p{M}])`, "gu"),
            (_m, d: string) => `${cardinal(Number(toAscii(d)))} নম্বৰ`);

        // 4) COMMA-GROUPED ORDINALS — `1,000তম`. The Bengali normalize's ordinal rule keys on a plain digit
        //    run, and the grouping comma detaches the suffix. De-group the comma when an ordinal suffix
        //    follows, so the suffix stays attached. Two passes for overlapping groups (1,234,567তম).
        for (let i = 0; i < 2; i++)
            s = rewrite(s, new RegExp(`([${D}]),([${D}]{3})(?=(?:তম|শে|ই|ম|য়|র্থ|ষ্ঠ|লা|রা|ঠা))`, "gu"), "$1$2");

        // 5) VERSION DOTS — `802.11এন`, `802.11a/b/g`. The tokenizer reads `802.11` as a DECIMAL
        //    (দশমিক); a dot-decimal followed by the Wi-Fi VERSION SUFFIX (ASCII a/b/g/n, or the Assamese
        //    এন) is a version. `6.5তকৈ` ("6.5 than") has a full Assamese word after and must stay a
        //    decimal. Read "বিন্দু" (point). AFTER the clock (the dot-clock 8:30 has a two-digit minute
        //    and no letter after).
        //    BOUNDED TO THAT SHAPE: three or more integer digits (802) plus a SINGLE trailing letter. A
        //    looser `\d+.\d+[a-z]` reads a decimal glued to its unit as a version — `6.5km` came out
        //    *6 বিন্দু 5 kilometre*. All four corpus instances (802.11a/b/g/n, ৮০২.১১a) fit the bound.
        s = rewrite(s, new RegExp(`(?<![${D},.:])([${D}]{3,})\\.([${D}]+)(?=(?:[a-zA-Z](?![a-zA-Z])|এন))`, "gu"),
            "$1 বিন্দু $2");

        // 6) CURRENCY CODES — `AUD$৪৫` and `US$30`. The bare `$` is handled by the Bengali symbol tier;
        //    the LETTER CODE before it is not, so "AUD" read as an English word and the $ vanished.
        //    Expand the code + $ to the full currency noun, AFTER the number: Assamese postposes it
        //    (৩০ ডলাৰ), which is also what the Bengali symbol tier does with a bare `$30` — emitting the
        //    noun first read *dollar thirty* and disagreed with the engine's own convention two rules away.
        //    A MAGNITUDE travels between the number and the noun — the corpus's own prose is
        //    "$১৪.৭ বিলিয়ন আমেৰিকান ডলাৰ", never *45 dollars million*, which is what leaving the magnitude
        //    where it fell produced for `AUD$৪৫ মিলিয়ন`.
        const num = `[${D}]+(?:[.,][${D}]+)*`;
        const CODE: Readonly<Record<string, string>> = { US: "আমেৰিকান", AUD: "অস্ট্রেলিয়ান" };
        s = rewrite(s, new RegExp(`(?<![\\p{L}\\p{M}])(US|AUD)\\$[ ]?(${num})(\\s+${MAGNITUDE})?`, "gu"),
            (_m, code: string, n: string, mag?: string) => `${n}${mag ?? ""} ${CODE[code]} ডলাৰ`);
        // A BARE `$` whose sentence ALREADY spells the currency out: `$১৪.৭ বিলিয়ন আমেৰিকান ডলাৰ` and
        // `$2.3 বিলিয়ন ডলাৰৰ` both had the Bengali tier insert a SECOND ডলাৰ, so the reading was
        // *14.7 dollar billion American dollar*. Here the sign is redundant — drop it and keep the words.
        s = rewrite(s, new RegExp(`\\$[ ]?(${num})(\\s+${MAGNITUDE})?(?=\\s+(?:আমেৰিকান\\s+)?ডলা[ৰর])`, "gu"), "$1$2");
        // …and where no noun follows, the magnitude still has to precede it: `$45 মিলিয়ন` → 45 মিলিয়ন ডলাৰ.
        s = rewrite(s, new RegExp(`\\$[ ]?(${num})(\\s+${MAGNITUDE})`, "gu"), "$1$2 ডলাৰ");

        // 7) `&` → en (আৰু). The corpus's `B&B য়ে` dropped the ampersand; `&` reads আৰু (and). The tight
        //    `X&Y` form (B&B) is kept as letters + আৰু so the foreign path letter-names the sides.
        s = rewrite(s, /\s&\s/gu, " আৰু ");
        s = rewrite(s, /(?<![A-Za-z])&(?![A-Za-z])/gu, " আৰু ");
        s = rewrite(s, /([A-Za-z])&([A-Za-z])/gu, "$1 আৰু $2");

        // 8) REGNAL `II` — `II বিশ্ব যুদ্ধ` (World War II). The shared Roman pass converts II → 2 before
        //    the engine; the digit before বিশ্ব যুদ্ধ reads as an ORDINAL (দ্বিতীয়), matching the
        //    Assamese name for the war. Targeted at this phrase: a generic digit+noun rule would misfire
        //    on the corpus's scores and ranges.
        //     THE NOUN MUST BE PUT BACK. The pattern CONSUMES `বিশ্ব যুদ্ধ`, so returning the ordinal alone
        //     deleted "World War" outright: the corpus's one instance, `II বিশ্ব যুদ্ধৰ`, read *ditijɔɹ* —
        //     "of the second", with the thing itself gone. The case suffix (ৰ) is outside the match and
        //     re-attaches to the noun, which is where it belongs.
        s = rewrite(s, new RegExp(`([${D}]{1,2})\\s+বিশ্ব যুদ্ধ`, "gu"), (m0, d: string) => {
            const n = Number(toAscii(d));
            if (n < 1 || n > 20) return m0;
            const ord = n <= 10
                ? ["প্রথম", "দ্বিতীয়", "তৃতীয়", "চতুর্থ", "পঞ্চম", "ষষ্ঠ", "সপ্তম", "অষ্টম", "নবম", "দশম"][n - 1]!
                : ORDINAL_11_20[n]!;
            return `${ord} বিশ্ব যুদ্ধ`;
        });

        // 9) SIGNS the Bengali normalize does not own. It handles `-` (ঋণাত্মক) and `+` (যোগ); `=`, `<`,
        //    `>`, `×` do not occur in as_in but are read for completeness: সমান (equal), তকৈ সৰু (less),
        //    তকৈ ডাঙৰ (greater), গুণ (times). AFTER the regnal rule (which uses digits too).
        s = rewrite(s, /(\S)\s*=\s*(\S)/gu, "$1 সমান $2");
        s = rewrite(s, /(\d)\s*<\s*(\d)/gu, "$1 তকৈ সৰু $2");
        s = rewrite(s, /(\d)\s*>\s*(\d)/gu, "$1 তকৈ ডাঙৰ $2");
        s = rewrite(s, /(\d)\s*×\s*(\d)/gu, "$1 গুণ $2");

        return s;
    };
}

/** The Assamese pre-pass, self-contained (loads the Assamese numbers itself) so the engine and the tests
 *  call the same entry the review tool can see. */
export function normalizeAssamese(input: string): string {
    return makeAssameseNormalizer(loadManifest<BengaliDef>(import.meta.url, "assamese.jsonc").numbers)(input);
}
