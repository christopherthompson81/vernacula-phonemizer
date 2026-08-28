/**
 * Bengali (bn) text normalization — the pre-tokenizer pass that rewrites everything which is not already a
 * pronounceable word into words the pipeline speaks. Pure text→text; no IPA.
 *
 * ⚠ BENGALI TEXT MIXES DIGIT SYSTEMS — ASCII and Bengali ০-৯ both occur, including inside times (১১:২০),
 * decimals (২.৩) and fractions (১/৫). Step 0 folds Bengali digits to ASCII so there is ONE representation
 * downstream, which also repairs the shared symbol tier: its number pattern is ASCII-only, so without the fold
 * it drops the percent sign of "৮%".
 *
 * ⚠ EVERY BOUNDARY IS AN EXPLICIT LOOKAROUND, NEVER `\b`. `\b` is defined on ASCII word characters and finds no
 * boundary at all against Bengali script, so a rule written with it matches NOTHING and leaves output that is
 * wrong but plausible.
 *
 * ⚠ THE LARGEST BENGALI DEFECTS ARE NOT IN THIS LAYER, and looking for them here wastes a pass: the numbers data
 * needs its fused 21–99 forms, and `clausePunctuation` must not map a mark to ITSELF padded with spaces, or every
 * danda and comma reaches the output as a raw non-IPA character. Both live in bengali.jsonc. What belongs here is
 * ordinal suffixes, the clock, Bengali unit abbreviations, signs and fractions.
 */
import { MANIFEST as DEF } from "./manifest.ts";
import { BENGALI_DIGITS } from "../../core/unicode.ts";
import { indicNumberWords, type NumbersDef } from "../../core/numbers.ts";
import { postposedSign } from "../../core/postposedSign.ts";
import { rewrite } from "../../core/provenance.ts";

const BN_DIGIT = Object.keys(BENGALI_DIGITS).join("");
/** Either digit system. */
const D = `0-9${BN_DIGIT}`;

/** Fold Bengali digits to ASCII so a value can be computed from either script. */
function toAscii(s: string): string {
    return [...s].map((c) => BENGALI_DIGITS[c] ?? c).join("");
}

/**
 * DATE ordinal suffixes, which is what the corpus actually contains — শে ×10 (২৬শে নভেম্বর) and ই ×8
 * (৮ই জুলাই) — plus the general তম ×11 (১৭তম শতকের). Bengali writes the suffix attached to the numeral and
 * the suffix itself is what marks the form, so it is read off the text rather than inferred.
 *
 * 1–4 are suppletive in the DATE series (পহেলা, দোসরা, তেসরা, চৌঠা); everything else is the cardinal with
 * the suffix JOINED to its final word, exactly as in Hindi — emitting them apart is what made the suffix a
 * stray syllable ([aʈ i] for ৮ই instead of আটই).
 */
const DATE_SUPPLETIVE: Readonly<Record<number, string>> = {
    1: "পহেলা", 2: "দোসরা", 3: "তেসরা", 4: "চৌঠা",
};

/** The suppletive 1–10 series, from the manifest — see the jsonc for why it stops at ten. */
const ORDINAL_SUPPLETIVE: Readonly<Record<number, string>> = DEF.ordinals.suppletive;

/** Suffixes that mark the classical series rather than the date series. */
const CLASSICAL_SUFFIX = new Set(["ম", "য়", "র্থ", "ষ্ঠ", "তম"]);
const DATE_SUFFIX = new Set(["শে", "ই", "লা", "রা", "ঠা"]);
/** Read from the manifest — LONGEST FIRST, and the order is load-bearing (see the jsonc). */
const ORDINAL_SUFFIX = DEF.ordinals.suffixes;

/** Bengali unit abbreviations → the full word. The shared symbol tier is keyed on the Latin forms. */
const UNIT_WORD: Readonly<Record<string, string>> = {
    "কিমি": "কিলোমিটার", "কিমি/ঘন্টা": "কিলোমিটার প্রতি ঘন্টা", "সেমি": "সেন্টিমিটার",
    "মিমি": "মিলিমিটার", "কেজি": "কিলোগ্রাম", "গ্রা": "গ্রাম", "মি": "মিটার",
};
const UNIT_ALT = Object.keys(UNIT_WORD).sort((a, b) => b.length - a.length).join("|");

/** Abbreviations. Only a handful occur (ডঃ / ড. ×2, অধ্যাপক is already a word), but ডঃ was reading its
 *  visarga as a syllable ([ɖɔh]) and ড. was leaving a phrase break. */
const ABBREV: Readonly<Record<string, string>> = {
    "ড": "ডক্টর", "অধ্যা": "অধ্যায়", "পৃ": "পৃষ্ঠা", "সং": "সংখ্যা",
};
const ABBREV_ALT = Object.keys(ABBREV).sort((a, b) => b.length - a.length).join("|");

/** Build the Bengali normalizer. Takes the numbers definition so ordinals and fractions can compose the
 *  same cardinal words the engine's own number path uses. */
export function makeBengaliNormalizer(numbers: NumbersDef): (text: string) => string {
    const cardinal = (n: number): string => indicNumberWords(n, numbers).map((w) => w ?? "").join(" ");

    const ordinal = (n: number, suffix: string): string | undefined => {
        if (DATE_SUFFIX.has(suffix) && DATE_SUPPLETIVE[n] !== undefined) return DATE_SUPPLETIVE[n];
        // The classical series is suppletive through ten; above that the regular তম form composes.
        if (CLASSICAL_SUFFIX.has(suffix) && ORDINAL_SUPPLETIVE[n] !== undefined) return ORDINAL_SUPPLETIVE[n];
        const words = cardinal(n).split(" ");
        if (words.some((w) => w === "")) return undefined;
        words[words.length - 1] = `${words[words.length - 1]}${suffix}`;
        return words.join(" ");
    };

    return (input: string): string => {
        // 0) FOLD Bengali digits to ASCII. The engine reads either script identically (৫ and 5 both give
        //    [pãt͡ʃ]), but the SHARED symbol tier's number pattern is ASCII-only, so "৮%" had its percent
        //    sign DROPPED and Bengali-digit amounts lost their currency and units. Folding here makes one
        //    uniform representation for every downstream rule, this file's included.
        let s = [...input].map((c) => BENGALI_DIGITS[c] ?? c).join("");

        // 1) ABBREVIATIONS. ডঃ uses a VISARGA rather than a dot, which is not punctuation and so was read
        //    as a syllable; the dotted form left a phrase break instead.
        s = rewrite(s, new RegExp(`(?<![\\p{L}\\p{M}])(${ABBREV_ALT})[ঃ.]\\s*(?=[\\p{L}])`, "gu"),
            (_m, ab: string) => `${ABBREV[ab]!} `);

        // 2) ORDINAL SUFFIXES, attached or with an intervening space (both occur).
        s = rewrite(s, new RegExp(`(?<![${D}.,])([${D}]+)\\s?(${ORDINAL_SUFFIX.join("|")})(?![\\p{L}\\p{M}])`, "gu"),
            (whole, digits: string, suffix: string) =>
                ordinal(Number(toAscii(digits)), suffix) ?? whole);

        // 3) BENGALI UNIT ABBREVIATIONS, after a number. Longest first so কিমি/ঘন্টা beats কিমি.
        s = rewrite(s, new RegExp(`([${D}])\\s?(${UNIT_ALT})(?![\\p{L}\\p{M}])`, "gu"),
            (_m, d: string, u: string) => `${d} ${UNIT_WORD[u]!}`);

        // 4) DEGREES, case-insensitively — the corpus lowercases, and a case-sensitive rule would leave the
        //    scale letter behind as a stray syllable.
        s = rewrite(s, new RegExp(`([${D}])\\s?°\\s?C(?![\\p{L}])`, "giu"), "$1 ডিগ্রি সেলসিয়াস");
        s = rewrite(s, new RegExp(`([${D}])\\s?°\\s?F(?![\\p{L}])`, "giu"), "$1 ডিগ্রি ফারেনহাইট");
        s = rewrite(s, new RegExp(`([${D}])\\s?°`, "gu"), "$1 ডিগ্রি");

        // 5) CLOCK. The colon was reaching the output RAW (padded, so it also produced a double space), and
        //    a :00 was read as শূন্য. Bengali says "দশটা ত্রিশ মিনিট"; at :00 the minutes drop out and a
        //    following টা is exactly right.
        s = rewrite(s, new RegExp(`(?<![${D}:])([${D}]{1,2}):([${D}]{2})(?![${D}:])(\\s*টা)?`, "gu"),
            (whole, h: string, min: string, ta?: string) => {
                const hv = Number(toAscii(h)), mv = Number(toAscii(min));
                if (hv > 23 || mv > 59) return whole;
                if (mv === 0) return `${cardinal(hv)}${ta ?? "টা"}`;
                return `${cardinal(hv)}টা ${cardinal(mv)} মিনিট`;
            });

        // 6) SIGNS. Both directions occur in this corpus (-1 ×3, +3/+1 ×4), unlike Hindi where the only
        //    hyphen-before-digit was a spacecraft name, so both are claimed here.
        s = rewrite(s, new RegExp(`(^|[\\s(])[-−–]([${D}])`, "gu"), "$1ঋণাত্মক $2");
        s = rewrite(s, new RegExp(`(\\S)\\+\\s?([${D}])`, "gu"), "$1 যোগ $2");
        s = rewrite(s, new RegExp(`(^|\\s)\\+\\s?([${D}])`, "gu"), "$1যোগ $2");

        // THE RELATIONAL AND DIVISION SIGNS, sourced ENTIRELY from bn_in:
        //
        //   `সমান`       ×14 token   "রেসিওর সমান বা কাছাকাছি" — EQUAL TO the ratio
        //   `থেকে কম`     ×2 phrase   ·  `থেকে বেশি` ×14 phrase — both postposed, with real operands
        //   `ভাগ`        ×12 token   the division word (cognate of hi's भाग, which hi cites from its own wiki)
        //
        // ⚠ `ভাগ` IS ALSO A SUBSTRING TRAP: ×12 token but ×202 SUBSTRING, most of them inside বেশিরভাগ ("most"),
        // which has no arithmetic sense. The token count is the evidence; the raw count is 17× larger and lying.
        //
        // The comparatives are POSTPOSITIONAL (থেকে follows the standard), so they use core/postposedSign.ts;
        // an infix rule would read the comparison backwards. This normalizer serves as/bpy as well as bn.
        s = postposedSign(s, "<", "থেকে কম");
        s = postposedSign(s, ">", "থেকে বেশি");
        s = rewrite(s, /\s?=\s?/gu, " সমান ");
        s = rewrite(s, /\s?÷\s?/gu, " ভাগ ");

        // 7) FRACTIONS. Bengali states them as "denominator ভাগের numerator", the spoken form; ½ is অর্ধেক.
        s = rewrite(s, new RegExp(`(?<![${D}.,/])([${D}]{1,3})/([${D}]{1,3})(?![${D}/])`, "gu"),
            (m0, a: string, b: string) => {
                const num = Number(toAscii(a)), den = Number(toAscii(b));
                if (num === 1 && den === 2) return "অর্ধেক";
                const nw = cardinal(num), dw = cardinal(den);
                return nw === "" || dw === "" ? m0 : `${dw} ভাগের ${nw}`;
            });

        return s;
    };
}
