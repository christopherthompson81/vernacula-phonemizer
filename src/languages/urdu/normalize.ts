/**
 * Urdu (ur) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not already a
 * pronounceable word into words the existing pipeline speaks. Pure text→text; no IPA.
 *
 * Tenth language. As with Bengali, the two biggest defects were NOT in this layer and are fixed in the
 * manifest and the engine: the numbers data had no fused 21–99 forms (so 21 read as "ایک بیس", one-twenty),
 * `clausePunctuation` mapped every mark to a PADDED copy of itself (producing double-space slot-gaps on the
 * ۔ that ends almost every one of the 2,109 utterances), the number function LEAKED ASCII DIGITS for any
 * decimal, and the manifest had no decimal word at all.
 *
 * Boundaries here are explicit lookarounds, never `\b` — the ASCII-only definition finds none against the
 * Arabic script, the trap that has now appeared in six languages including core/initialisms.ts itself.
 *
 * Measured over the ur_pk corpus (2,109 utterances): the ۔ full stop ×2095, the Arabic comma ×1481, dates
 * ×42, units ×38, ordinal suffixes ×27, decimals ×24, centuries ×19, times ×17, comma-grouping ×14, بجے
 * ×12, فیصد ×9. ASCII digits throughout — no Arabic-Indic digits occur.
 */
import { indicNumberWords, type NumbersDef } from "../../core/numbers.ts";
import { postposedSign } from "../../core/postposedSign.ts";

/** Arabic-Indic digits, both ranges, folded to ASCII so one representation reaches every rule. */
const ARABIC_DIGIT = /[٠-٩۰-۹]/gu;
function foldDigit(c: string): string {
    const cp = c.codePointAt(0)!;
    if (cp >= 0x0660 && cp <= 0x0669) return String(cp - 0x0660);
    if (cp >= 0x06f0 && cp <= 0x06f9) return String(cp - 0x06f0);
    return c;
}

/**
 * Ordinal suffixes. Urdu writes the ordinal as the numeral plus واں (masculine) or ویں (feminine/oblique),
 * with or without a space — the corpus has both (`15 ویں صدی` ×7, `17ویں` ×2, `60واں` ×2). The suffix
 * carries the agreement, so it is read off the text; previously it was tokenized apart and spoken as its
 * own syllable.
 *
 * 1–4 and 6 are suppletive; 5 and everything from 7 up are the cardinal with the suffix JOINED.
 */
const SUFFIX_FORM: Readonly<Record<string, 0 | 1>> = { "واں": 0, "وان": 0, "ویں": 1, "وین": 1 };
const IRREGULAR: Readonly<Record<number, readonly [string, string]>> = {
    1: ["پہلا", "پہلی"],
    2: ["دوسرا", "دوسری"],
    3: ["تیسرا", "تیسری"],
    4: ["چوتھا", "چوتھی"],
    6: ["چھٹا", "چھٹی"],
};

/** Unit abbreviations and the SPACED spelling `کلو میٹر`, which read as two words ([kˈəlluː mˈiːʈəɾ]). */
const UNIT_WORD: Readonly<Record<string, string>> = {
    "کلو میٹر": "کلومیٹر", "کلو گرام": "کلوگرام", "سینٹی میٹر": "سینٹیمیٹر", "ملی میٹر": "ملیمیٹر",
    "کلومیٹر/گھنٹہ": "کلومیٹر فی گھنٹہ",
};
const UNIT_ALT = Object.keys(UNIT_WORD).sort((a, b) => b.length - a.length).join("|");

/** Build the Urdu normalizer. Takes the numbers definition so ordinals compose the same cardinal words the
 *  engine's own number path uses. */
export function makeUrduNormalizer(numbers: NumbersDef): (text: string) => string {
    const cardinal = (n: number): string[] => indicNumberWords(n, numbers).map((w) => w ?? "");

    const ordinal = (n: number, form: 0 | 1, suffix: string): string | undefined => {
        const irr = IRREGULAR[n];
        if (irr !== undefined) return irr[form];
        const words = cardinal(n);
        if (words.length === 0 || words.some((w) => w === "")) return undefined;
        words[words.length - 1] = `${words[words.length - 1]}${suffix}`;
        return words.join(" ");
    };

    return (input: string): string => {
        let s = input.replace(ARABIC_DIGIT, foldDigit);

        // 1) ARABIC SYMBOL CHARACTERS → ASCII, so the shared symbol tier (ASCII-keyed) applies. ٪ occurs
        //    once in this corpus and was dropped outright, exactly as in Arabic.
        s = s.replace(/٪/gu, "%").replace(/٫/gu, ".").replace(/٬/gu, ",");
        //    The ARABIC COMMA is also used as a THOUSANDS SEPARATOR here (11،000). Between digits it is a
        //    grouping mark, not punctuation — left alone it was a clause break, so "11،000" read as
        //    "eleven … zero". Only the digit-flanked case is folded; ، as real punctuation is untouched.
        s = s.replace(/(\d)،(\d{3})(?!\d)/gu, "$1,$2");

        // 2) ORDINAL SUFFIXES, attached or spaced.
        s = s.replace(new RegExp(`(?<![\\d.,])(\\d+)\\s?(${Object.keys(SUFFIX_FORM).join("|")})(?![\\p{L}\\p{M}])`, "gu"),
            (whole, digits: string, suffix: string) =>
                ordinal(Number(digits), SUFFIX_FORM[suffix]!, suffix) ?? whole);

        // 3) SPACED / ABBREVIATED UNITS. Longest first.
        s = s.replace(new RegExp(`(\\d)\\s?(${UNIT_ALT})(?![\\p{L}\\p{M}])`, "gu"),
            (_m, d: string, u: string) => `${d} ${UNIT_WORD[u]!}`);

        // 4) DEGREES. Case-insensitive on the scale letter, and the bare sign too.
        s = s.replace(/(\d)\s?°\s?C(?![\p{L}])/giu, "$1 ڈگری سینٹی گریڈ");
        s = s.replace(/(\d)\s?°\s?F(?![\p{L}])/giu, "$1 ڈگری فارن ہائیٹ");
        s = s.replace(/(\d)\s?°/gu, "$1 ڈگری");

        // 5) CLOCK. The colon reached the output RAW (and padded, so also a double space), and :00 read as
        //    صفر. Urdu says "گیارہ بج کر بیس منٹ"; at :00 the minutes drop and a following بجے is right.
        s = s.replace(/(?<![\d:])([01]?\d|2[0-3])\s?:\s?([0-5]\d)(?![\d:])(?!,\d)(\s*بجے)?/gu,
            (whole, h: string, min: string, baje?: string) => {
                const hv = Number(h), mv = Number(min);
                const hw = cardinal(hv).join(" ");
                if (hw === "") return whole;
                if (mv === 0) return `${hw}${baje ?? " بجے"}`;
                return `${hw} بج کر ${cardinal(mv).join(" ")} منٹ`;
            });

        // 6) SIGNS. Neither occurs in this corpus, but a dropped sign is silent content loss wherever it does.
        s = s.replace(/(^|[\s(])[-−–](\d)/gu, "$1منفی $2");
        s = s.replace(/(\S)\+\s?(\d)/gu, "$1 جمع $2");
        s = s.replace(/(^|\s)\+\s?(\d)/gu, "$1جمع $2");

        // THE RELATIONAL AND DIVISION SIGNS, sourced ENTIRELY from ur_pk — no Wikipedia needed, which
        // makes Urdu one of the few languages in this issue where tier 2 settled all four readings:
        //
        //   `برابر`      ×4 token   "اس تناسبِ نظر کے برابر" — EQUAL TO this aspect ratio
        //   `سے کم`      ×26 phrase  ·  `سے زیادہ` ×78 phrase   — both postposed, both with real operands
        //   `سے تقسیم`   ×1          "بارہ سے تقسیم دے کر" — FLEURS's parallel division sentence
        //   `تقسیم`      ×8 token    the division word on its own
        //
        // ⚠ THE COMPARATIVES ARE POSTPOSITIONAL, like Hindi's, so they use core/postposedSign.ts: سے follows
        // the standard of comparison, so `A < B` is "A B سے کم". An infix rule would read it backwards.
        //
        // The equality and the division read INFIX, matching the cognate pair `hi` already ships (बराबर / भाग)
        // — but sourced here from Urdu's own corpus rather than carried across, since the two languages are
        // separately attested and only the script differs for these words.
        s = postposedSign(s, "<", "سے کم");
        s = postposedSign(s, ">", "سے زیادہ");
        s = s.replace(/\s?=\s?/gu, " برابر ");
        s = s.replace(/\s?÷\s?/gu, " تقسیم ");

        // 7) FRACTIONS, as "denominator بٹا numerator" — the ordinary spoken form; ½ is آدھا.
        s = s.replace(/(?<![\d.,/])(\d{1,3})\/(\d{1,3})(?![\d/])/gu, (m0, a: string, b: string) => {
            const num = Number(a), den = Number(b);
            if (num === 1 && den === 2) return "آدھا";
            const nw = cardinal(num).join(" "), dw = cardinal(den).join(" ");
            return nw === "" || dw === "" ? m0 : `${nw} بٹا ${dw}`;
        });

        return s;
    };
}
