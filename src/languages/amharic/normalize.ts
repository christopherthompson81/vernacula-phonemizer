/**
 * Amharic (am) text normalization — pure text→text, run inside `text()` before tokenization.
 *
 * ⚠ `\b` IS ASCII-DEFINED AND MATCHES NOTHING AGAINST ETHIOPIC — every boundary here is an explicit
 * `(?<![\p{L}\p{M}])` / `[ሀ-ፚ]` lookaround.
 *
 * Deliberately not done:
 *   · ETHIOPIC NUMERALS ፩፪፫…፻፼ (U+1369–U+137C) have no reader. They fall outside TOKEN's letter class and
 *     phonemize to the empty string — a real defect if they appear, but the system is ADDITIVE with no zero,
 *     so `foldNativeDigits` cannot help and a reader has to be written from scratch.
 *   · THE ETHIOPIAN CALENDAR AND THE 6-HOUR CLOCK OFFSET are not applied. Amharic text writes European digits
 *     with ኤ.ኤም / ፒ.ኤም / GMT markers, i.e. already in the European frame, and nothing in the text settles
 *     which frame a bare time is in — converting would be guessing. ዓ.ም / እ.ኤ.አ. are likewise left as
 *     letter-runs rather than resolved to a calendar.
 *   · ሚሜ (millimetre) is left alone. ኪ.ሜ is expanded because Amharic also writes ኪሎ ሜትር out in full; ሚሜ has
 *     no such attestation, and a wrong expansion is worse than the written abbreviation.
 *   · NO BIRR RULE. ብር is almost entirely a false positive — ብርሃን "light", መቃብር "grave", ክብር "honour".
 */
import { MANIFEST as DEF } from "./manifest.ts";

/** Ethiopic syllabary letters, EXCLUDING the punctuation and numeral sub-blocks (U+135F and up). */
const FID = "[\\u1200-\\u135A]";


/**
 * ORDINALS, THE DECIMAL POINT AND THE RANGE FRAME — all four read from the manifest now. The cardinal→
 * ordinal pairing, the point word and both halves of `ከ … እስከ …` are Amharic VOCABULARY; which word of a
 * composed numeral takes the suffix, and the ኛው definite re-attachment, are the algorithm and stay here.
 * ⚠ `rangeFrom` IS THE ONE THAT WAS INVISIBLE: `እስከ` had a named constant while the `ከ` that opens the same
 * frame was typed straight into the replacement template, so a grep for the range words found one of two.
 */
const ORDINAL = DEF.ordinals;
const POINT = DEF.words.decimalPoint;
const FROM = DEF.words.rangeFrom;
const UNTIL = DEF.words.rangeUntil;

/**
 * Build the Amharic normalizer.
 *
 * `numberToText` is injected rather than imported so that normalize.ts and amharic.ts do not form an
 * import cycle: amharic.ts owns the number composer and hands it over here.
 *
 * `symbols` is the shared `makeSymbolNormalizer` pass (%, currency). It is threaded THROUGH this function
 * instead of wrapping it, because the ordering is load-bearing in both directions — see step 9.
 */
export function makeAmharicNormalizer(
    numberToText: (n: number) => string,
    symbols: (text: string) => string,
): (text: string) => string {
    /** Spell one integer string; falls back to the digits when out of the composer's range. */
    const words = (digits: string): string => {
        const n = Number(digits);
        return Number.isSafeInteger(n) && n >= 0 && n < 1e12 ? numberToText(n) : digits;
    };
    /** Digits read one at a time — the fractional tail of a decimal. */
    const eachDigit = (digits: string): string =>
        [...digits].map((d) => numberToText(Number(d))).join(" ");
    /** Ordinal: compose the cardinal, then inflect only its FINAL word. */
    const ordinal = (digits: string): string => {
        const w = words(digits).split(" ");
        const last = w[w.length - 1]!;
        const o = ORDINAL[last];
        if (o === undefined) return "";
        w[w.length - 1] = o;
        return w.join(" ");
    };

    return (input: string): string => {
        let s = input;

        // 1. ፡፡ → ። . ⚠ TWO U+1361 ETHIOPIC WORDSPACE is the typewriter/keyboard substitute for ። (አራት ነጥብ),
        //    and it is routinely a text's ONLY sentence terminator. It is in no `clausePunctuation` and
        //    reaches no branch of TOKEN, so every such sentence boundary produces no pause at all.
        //    FIRST, so step 4 sees only lone ፡.
        s = s.replace(/፡፡/gu, "።");

        // 2. ፡ used as a TIME separator (11፡00, 9፡30, 11፡29). Folded to ASCII ':' so the single clock rule
        //    in step 5 covers both spellings. BEFORE step 4, which claims every remaining lone ፡.
        s = s.replace(/(\d)፡(\d)/gu, "$1:$2");

        // 3. DOTTED ABBREVIATIONS. Amharic writes initialisms and unit abbreviations with ASCII dots between
        //    Ethiopic letters (ኤ.ኦ.ኤል, ኤፍ.ቢ.አይ., እ.ኤ.አ., ፒ.ኤም, ኪ.ሜ). Each interior dot is mapped by
        //    `clausePunctuation` to a full STOP, shattering one initialism into up to six phrases. Removing
        //    the dots leaves a fidel run, which IS the spelled reading — ኤ.ኦ.ኤል is already A-O-L in Ethiopic.
        //
        //    MULTI-DOT FIRST, and the multi-dot form also loses its TRAILING dot. ⚠ That is safe only because
        //    Amharic terminates sentences with ። rather than with an ASCII dot, so no sentence-final pause is
        //    at risk.
        s = s.replace(new RegExp(`(?:${FID}{1,5}\\.){2,}${FID}{0,5}\\.?`, "gu"), (m) => m.replace(/\./gu, ""));
        //    Then the single INTERIOR dot (ኪ.ሜ, ዓ.ም, ፒ.ኤም). Bounded by a fidel on BOTH sides, so it cannot
        //    touch 1.5, 802.11a, or a genuine trailing period after a word.
        s = s.replace(new RegExp(`(?<=${FID})\\.(?=${FID})`, "gu"), "");
        //    ⚠ A trailing dot on a SINGLE-dot abbreviation (ወዘተ., ቁ., ሰዓ.) is deliberately LEFT: that shape is
        //    indistinguishable from a word plus a sentence period.

        // 4. Any remaining lone ፡ is a clause colon introducing a list. Mapped to ASCII ',', which
        //    `clausePunctuation` already carries, so TOKEN needs no change. AFTER step 2, which took the
        //    time separators.
        s = s.replace(/፡-?/gu, ",");

        // 5. DIGIT DE-GROUPING, before anything reads a comma as punctuation. "5,000" reads as "አምስት , ዜሮ" —
        //    a phrase break plus the word for zero. Amharic groups with commas only, never the period.
        s = s.replace(/(\d),(?=\d{3}(?!\d))/gu, "$1");
        s = s.replace(/(\d),(?=\d{3}(?!\d))/gu, "$1"); // second pass for 5,000,000

        // 6. CLOCK, before any rule that could claim a bare number, and before decimals — the corpus's
        //    sports splits are "4:41.30", where the clock must take 4:41 and leave .30 to step 10.
        //    The colon was becoming a COMMA, so "10:08" read as "አስር , ስምንት".
        //
        //    ⚠ ONLY THE SEPARATOR IS RESOLVED. No ሰዓት/ደቂቃ is inserted: the text already supplies the frame
        //    ("ከቀኑ 10:00 ሰዓት"), and adding the word would double it.
        //    ⚠ THE OPTIONAL `.SS` TAIL IS CONSUMED HERE rather than left to step 10, because step 10's decimal
        //    pattern needs digits on BOTH sides of the dot and the clock rewrite has just removed them —
        //    "4:41.30" would strand ".30" and the bare dot becomes a sentence STOP.
        s = s.replace(/(?<!\d)(\d{1,2}):([0-5]\d)(?:\.(\d+))?(?!\d)/gu,
            (_m, h: string, mi: string, frac: string | undefined) => {
                // :00 is the whole hour and is read as the bare hour, not as "…zero".
                const hm = Number(mi) === 0 && frac === undefined ? words(h) : `${words(h)} ${words(mi)}`;
                return frac === undefined ? ` ${hm} ` : ` ${hm} ${POINT} ${eachDigit(frac)} `;
            });

        // 7. A clock written with a DOT and an explicit timezone ("ከቀኑ 12.00 GMT"). Without this the decimal
        //    rule in step 10 reads it as "twelve point zero zero". Guarded by the timezone token, so it
        //    cannot claim an ordinary decimal.
        s = s.replace(/(?<!\d)(\d{1,2})\.00(?=\s*(?:GMT|UTC|ዩቲሲ|ጂኤምቲ))/gu, (_m, h: string) => ` ${words(h)} `);

        // 8. RANGES, restricted to the ከ ("from") frame — "ከ120-160 ሜትር" → "ከ 120 እስከ 160 ሜትር".
        //    ⚠ THE RESTRICTION IS THE RULE. Most hyphenated number pairs are SPORTS SCORES or bracketed year
        //    spans ("7-2", "26 – 00", "(1644-1912)"), which must NOT become "from…to". They are left as two
        //    adjacent numbers, which is what they already were: TOKEN drops the hyphen and emits no pause.
        s = s.replace(/(?<![\p{L}\p{M}])ከ\s?(\d[\d.]*)\s?[-–—]\s?(\d[\d.]*)/gu,
            (_m, a: string, b: string) => `${FROM} ${a} ${UNTIL} ${b}`);

        // 8b. TWO LOCAL WORKAROUNDS for the shared currency tier, reported as core limitations rather than
        //     fixed there — a `core/` change would touch every language.
        //
        //     ⚠ (i) The tier's `CUR` key is guarded by `(?<![\p{L}\p{M}])`, so a LETTER-CODE PREFIX blocks it:
        //     "US$14.7", "ዩኤስ$30", "AUD$45" match nothing and the sign is dropped outright. Detaching the sign
        //     lets the tier see it; the code itself is left where it was.
        s = s.replace(/(?<=[A-Za-zሀ-ፚ])(?=\$\s?\d)/gu, " ");
        //     ⚠ (ii) The tier's "the text already says it" guard is a PREFIX test against the declared noun,
        //     which does not survive Amharic plural morphology: ዶላሮች is not a prefix of ዶላር, because the plural
        //     shifts the final 6th-order ር to the 7th-order ሮ before ች. "$100 ዶላሮች" therefore reads "መቶ ዶላር
        //     ዶላሮች". Dropping the now-redundant sign here is equivalent and keeps it local.
        s = s.replace(/\$\s?(\d[\d.,]*)(\s+(?:ሚሊዮን|ቢሊዮን|ቢልየን|ትሪሊዮን))?(?=\s*ዶላ[ርሮ])/gu,
            (_m, n: string, mag: string | undefined) => `${n}${mag ?? ""}`);

        // 9. SHARED SYMBOL TIER (%, $, ¥, £) runs HERE, in the middle: after de-grouping and the clock (so
        //    "$11,000" and "10:08" are already settled) but BEFORE decimals, because the tier's own NUM
        //    pattern matches "14.7" as one number and a decimal rewrite would destroy the currency
        //    adjacency — "US$14.7 ቢሊዮን" must reach it intact to come out "14.7 ቢሊዮን ዶላር".
        s = symbols(s);

        // 10. DECIMALS. Integer part as a number, ነጥብ, then the fraction ONE DIGIT AT A TIME. After the
        //     clock (step 6/7) and after the symbol tier (step 9); the abbreviation dots are long gone.
        s = s.replace(/(?<![\d.])(\d+)\.(\d+)(?![\d.])/gu,
            (_m, i: string, f: string) => ` ${words(i)} ${POINT} ${eachDigit(f)} `);

        // 11. ORDINALS. "19ኛ" / "15 ኛ" / "11ኛው" — the ኛ was a separate token and the cardinal kept its
        //     un-inflected final syllable. Any definite/feminine tail (ው/ዋ) is preserved. After de-grouping
        //     (step 5) so "1000ኛ" is a single numeral.
        s = s.replace(/(?<![\d.])(\d+)\s*ኛ([ውዋ]?)(?![ሀ-ፚ])/gu, (m, d: string, tail: string) => {
            const o = ordinal(d);
            return o === "" ? m : ` ${o}${tail} `;
        });

        // 12. SQUARED AREA, ⚠ BEFORE the plain ኪ.ሜ expansion in step 13, which would otherwise strand the
        //     exponent and drop it. ካሬ PRECEDES the unit, which is Amharic's own convention ("300,948 ካሬ ኪ.ሜ.").
        //     The dots are already stripped by step 3, so the key here is the bare ኪሜ.
        s = s.replace(/(?<![ሀ-ፚ])ኪሜ\s?[²2](?![\d\p{L}])/gu, "ካሬ ኪሎ ሜትር");

        // 13. ኪ.ሜ / ኪሜ → ኪሎ ሜትር. Amharic writes "ሰባ ኪሎ ሜትር" out in full, so the expansion is the spoken
        //     form, not the letter-run "kime" the fidel g2p produces. ⚠ Unconditional rather than routed
        //     through the shared unit tier, because it also occurs with no adjacent number ("ኪ.ሜ በ ሰዓት").
        s = s.replace(/(?<![ሀ-ፚ])ኪሜ(?![ሀ-ፚ])/gu, "ኪሎ ሜትር");

        // 14. ° → ዲግሪ. ⚠ Only the SIGN is resolved: the Latin scale letter after it (C, W) is outside TOKEN's
        //     alphabet and stays dropped, and no Amharic spelling of "Celsius" is sourceable.
        s = s.replace(/°/gu, " ዲግሪ ");

        // 15. THE PLUS SIGN → ፕላስ. Two arms, so the sign is read whether glued to a label (`UTC+1`) or opening
        //     the quantity. ⚠ The MEASUREMENT position is voiced too, although readers commonly omit it there:
        //     for a TTS target a reader skipping a character the author typed is evidence about reading habit,
        //     not licence to delete content — and omitting a plus is lossless where omitting a minus inverts.
        s = s.replace(/(\S)\+[ \u00a0]?(?=\d)/gu, "$1 ፕላስ ");  // space, NBSP
        s = s.replace(/(^|[ \u00a0])\+[ \u00a0]?(?=\d)/gu, "$1ፕላስ ");  // space, NBSP

        // 16. THE RELATIONAL AND DIVISION SIGNS, which need a rule shape none of the other languages use.
        //
        //     ⚠ THE STANDARD OF COMPARISON TAKES A PREFIX, NOT A POSTPOSITION. Amharic marks it with ከ- on the
        //     FRONT of the operand and puts the comparative after it, so `A < B` is "A ከB ያነሰ" — attested on a
        //     numeric operand directly ("ለትንሽ ከ40,000 ያነሰ የህዝብ ቁጥር", a population of FEWER THAN 40,000).
        //     core/postposedSign.ts cannot express that: it appends words after the operand and never modifies
        //     it. Division is the same shape with በ-: በ + operand + በመክፈል. `እኩል` alone reads infix.
        //
        //     ⚠ THE PREFIX IS WRITTEN FUSED TO THE DIGIT AND ENDS UP AS ITS OWN TOKEN — a known limitation. `ከ6`
        //     is emitted fused, the orthographic form, but the number path then replaces the digit with its
        //     word, leaving ከ as a separate token: `6 > 5` reads *kə sɨdɨst* where ከስድስት would be one word. The
        //     PHONES are identical either way, so it is a prosodic imperfection; fusing properly needs the
        //     numeral spelled inside this rule.
        s = s.replace(/(\S+)\s*<\s*(\S+)/gu, "$1 ከ$2 ያነሰ");
        s = s.replace(/(\S+)\s*>\s*(\S+)/gu, "$1 ከ$2 የበለጠ");
        s = s.replace(/(\S+)\s*÷\s*(\S+)/gu, "$1 በ$2 በመክፈል");
        s = s.replace(/\s?=\s?/gu, " እኩል ");

        return s.replace(/[ \u00a0]{2,}/gu, " ");  // space, NBSP
    };
}
