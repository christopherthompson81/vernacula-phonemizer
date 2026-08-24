/**
 * Kannada (kn) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not already
 * a pronounceable word into words the existing pipeline speaks. Pure text→text; no IPA.
 *
 * Measured over the kn_in FLEURS corpus (1,811 unique utterances, column 3 — the cased one):
 *   922 ZWNJ + 139 ZWJ + 6 ZWSP · 561 bare numerals (132 one-digit · 82 teens · 47 round tens ·
 *   73 two-digit non-round · 75 three-digit · 146 in the 1000-2999 band · 6 larger)
 *   42 comma-grouped numbers · 39 ordinal ನೇ/ನೆಯ · 29 decimals · 18 numeric ranges · 15 clock colons
 *   14 dotted Kannada abbreviations (ಕಿ.ಮೀ ×6 · ಯು.ಎಸ್ ×5 · ಮಿ.ಮೀ ×1 · ಡಿ.ಕೆ ×1) + 13 undotted ಕಿಮೀ/ಕಿಮಿ
 *   6 era markers (ಕ್ರಿ.ಪೂ ×5, ಕ್ರಿ.ಶ ×1) · 7 currency signs · 4 percent · 4 Kannada-script rate units
 *   2 vulgar fractions · 1 exponent (km²) · 1 degree · 1 Kannada digit · ~170 Latin tokens
 *
 * THE LARGEST DEFECT WAS NOT IN THIS LAYER — the same shape the Tamil and Telugu runs found, and for
 * overlapping reasons. Kannada fuses 21-99 into one word, has suppletive round hundreds (ಇನ್ನೂರು,
 * ಮುನ್ನೂರು, ಐನೂರು, ಒಂಬೈನೂರು) and takes combining magnitude forms before a remainder (ನೂರಾ, ಸಾವಿರದ,
 * ಲಕ್ಷದ). The shared `indicNumberWords` composer expresses none of the last two, so 1976 read as
 * ಸಾವಿರ ಒಂಬತ್ತು ನೂರು ಎಪ್ಪತ್ತು ಆರು where Kannada says ಸಾವಿರದ ಒಂಬೈನೂರಾ ಎಪ್ಪತ್ತಾರು. Fixed where it lives,
 * in kannada.jsonc + numbers.ts; this file composes on top of the corrected words.
 *
 * NO `\b` ANYWHERE. `\b` is defined on ASCII word characters and finds no boundary at all against
 * Kannada script. Every boundary here is an explicit `(?<![\p{L}\p{M}])` / `(?![\p{L}\p{M}])` lookaround.
 *
 * KANNADA DIGITS ೦-೯: the corpus contains exactly ONE (a ೪ in "೪ ಶೂಟರ್ಗಳಿಗೆ"), and it is a genuine
 * numeral, not a homoglyph typo. So the Persian/Tamil/Telugu negative result essentially holds — the
 * digit inventory is ASCII — while the Marathi positive result (×597) does not. kannada.ts already
 * folded the block in its own `number()`, but only for a token the tokenizer had already classed as a
 * digit run; step 2 folds it before any rule here so that a native-digit numeral can also carry a
 * percent sign, a unit or an ordinal suffix.
 *
 * LATIN RUNS ARE DELIBERATELY LEFT TO THE EMBEDDED FOREIGN PHONEMIZER. ~170 Latin tokens occur (US, UN,
 * NBA, DNA, UTC, GMT, MRI…) and the English path already spells the unpronounceable ones letter by
 * letter. A Latin→Kannada letter-name table would be invented data. What IS fixed here is the DOTTED
 * KANNADA spellings, whose interior dots were being read as clause breaks (step 6).
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Kannada;

public static class Normalize
{
    /** Kannada letter+mark boundary. Never `\b`. */
    private const string NB = "(?<![\\p{L}\\p{M}])";
    private const string NA = "(?![\\p{L}\\p{M}])";

    /**
     * The SHARED symbol tier (percent / currency / units / exponent). Kept in this file rather than in
     * kannada.ts because its position in the ordering matters and the ordering is this file's job.
     */
    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        // ⚠ THE AMPERSAND WAS A MISSING CELL, NOT A SOURCING PROBLEM — ಮತ್ತು is ×1683 TOKEN in this corpus.
        Ampersand = "ಮತ್ತು",
        // `multiply` — STANDARD MATHEMATICAL REGISTER, not a corpus attestation.
        Multiply = new MultiplyDef { Times = "ಗುಣಿಸಿ" },
        Percent = new[] { "ಪ್ರತಿಶತ" },
        Currency = new Dictionary<string, IReadOnlyList<string>>
        {
            ["US$"] = new[] { "ಡಾಲರ್" }, ["$"] = new[] { "ಡಾಲರ್" },
        },
        Magnitudes = new[] { "ಮಿಲಿಯನ್", "ಬಿಲಿಯನ್", "ದಶಲಕ್ಷ", "ಶತಕೋಟಿ", "ಲಕ್ಷ", "ಕೋಟಿ" },
        // `m` ADDED so the cube word below has a head noun at all — the exponent branch resolves the unit
        // from `units` first. ಮೀಟರ್ ×10, and digit-adjacent bare `m` is ×0 in this corpus, so the
        // one-letter-key hazard is checked rather than assumed.
        Units = new Dictionary<string, IReadOnlyList<string>>
        {
            ["km"] = new[] { "ಕಿಲೋಮೀಟರ್" }, ["m"] = new[] { "ಮೀಟರ್" },
        },
        // `120-160 ಘನ ಮೀಟರ್‍‌ನಷ್ಟು ಇಂಧನ` — word-first, beside ಚದರ.
        ExponentWords = new ExponentWordsDef
        {
            Squared = new[] { "ಚದರ" },
            Cubed = new[] { "ಘನ" },
            Position = ExponentPosition.Before,
        },
    });

    /**
     * Kannada unit abbreviations. The shared tier above is keyed on Latin spellings and cannot see these.
     * Both the dotted (ಕಿ.ಮೀ ×6) and undotted (ಕಿಮೀ ×9, ಕಿಮಿ ×4) forms occur, and both ಮೀ and ಮಿ appear as
     * the second element. A SPACED variant is deliberately not matched: `ಕಿ ಮೀ` occurs zero times here, and
     * ಕಿ is a common Kannada dative clitic — trap #2, checked, not assumed.
     */
    private static readonly JsRe KM_RE = JsRegex.Compile($"{NB}(?:ಕಿ\\s*\\.\\s*ಮ[ೀಿ]|ಕಿಮ[ೀಿ])", "gu");

    /** ಮೈ for ಮೈಲಿ — ONLY as a rate numerator (40 ಮೈ/ಗಂ, ×1). The `/ಗಂ` guard is what keeps this off the
     *  many real Kannada words beginning ಮೈ — trap #2. */
    private static readonly JsRe MI_RATE_RE = JsRegex.Compile("(\\d[\\d.]*)\\s?ಮೈ\\s*\\/\\s*ಗಂ\\.?", "gu");

    /** Era markers. ಕ್ರಿ.ಪೂ ×5, ಕ್ರಿ.ಶ ×1. */
    private static readonly IReadOnlyDictionary<string, string> ERA = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["ಪೂ"] = "ಕ್ರಿಸ್ತ ಪೂರ್ವ",
        ["ಶ"] = "ಕ್ರಿಸ್ತ ಶಕ",
    };

    /**
     * Kannada renderings of the LATIN letter names this corpus actually uses in a dotted initialism:
     * ಯು.ಎಸ್ (U.S., ×5) and ಡಿ.ಕೆ (D.K., ×1). A CLOSED list, closed to what is ATTESTED: a generic
     * "short token, dot, short token" rule cannot be written safely against a script with no case
     * distinction, because it matches sentence boundaries. The rule only deletes the interior dots.
     */
    private static readonly string[] LETTER_NAME = { "ಯು", "ಎಸ್", "ಡಿ", "ಕೆ" };
    private static readonly string LETTER =
        $"(?:{string.Join("|", LETTER_NAME.OrderByDescending(x => x.Length))})";

    /** A run of ≥2 dot-separated letter names. The run's TRAILING dot is consumed only when the sentence
     *  visibly continues, so a true sentence-final pause is never lost. */
    private static readonly JsRe INITIALISM_RE = JsRegex.Compile(
        $"{NB}{LETTER}(?:\\s*\\.\\s*{LETTER})+(?:\\s*\\.(?=\\s*[\\p{{L}}]))?{NA}", "gu");

    /** Kannada rate denominators, in the dative — both attested verbatim in this corpus. */
    private static readonly IReadOnlyDictionary<string, string> RATE_DENOM = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["ಗಂ"] = "ಗಂಟೆಗೆ", ["ಸೆ"] = "ಸೆಕೆಂಡಿಗೆ",
    };

    /**
     * The dative rate prefix, UNLESS the text already carries it. Emitting the prefix unconditionally on
     * an occurrence that already has one gives "ಗಂಟೆಗೆ ಗಂಟೆಗೆ …", the duplicated-الساعة shape the Arabic
     * run hit.
     */
    private static string Dative(string word, string full, int offset) =>
        JsRegex.Compile($"{word}\\s*$", "u").IsMatch(full[..offset]) ? "" : $"{word} ";

    // Vulgar fractions
    private static readonly IReadOnlyDictionary<string, string> VULGAR = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["¼"] = "ಕಾಲು", ["½"] = "ಅರ್ಧ", ["¾"] = "ಮುಕ್ಕಾಲು",
    };

    private static readonly JsRe ZERO_WIDTH = JsRegex.Compile("[​‌‍﻿]", "gu");
    private static readonly JsRe GROUPING = JsRegex.Compile("(?<=\\d),(?=\\d{3}(?:,\\d|[^\\d]|$))", "gu");
    private static readonly JsRe ORDINAL_RE = JsRegex.Compile($"(?<![\\d.,])(\\d+)\\s*-?\\s*(ನೇ|ನೆಯ)(ದು)?{NA}", "gu");
    private static readonly JsRe ERA_RE = JsRegex.Compile($"{NB}ಕ್ರಿ\\s*\\.\\s*(ಪೂ|ಶ)(?:\\s*\\.(?=\\s*[\\p{{L}}\\d]))?", "gu");
    private static readonly JsRe DOTTED = JsRegex.Compile("\\s*\\.\\s*", "gu");
    private static readonly JsRe LETTER_START = JsRegex.Compile("^[\\p{L}\\p{M}]", "u");
    private static readonly JsRe MM_RE = JsRegex.Compile($"{NB}ಮಿ\\s*\\.\\s*ಮೀ", "gu");
    private static readonly JsRe KM_RATE_RE = JsRegex.Compile(
        $"(\\d[\\d.]*)\\s?ಕಿಲೋಮೀಟರ್\\s*\\/\\s*(ಗಂ|ಸೆ)\\.?{NA}", "gu");
    private static readonly JsRe VULGAR_RE = JsRegex.Compile("(?<=\\d)\\s?([¼½¾])", "gu");
    private static readonly JsRe CLOCK_00 = JsRegex.Compile("(?<![\\d:])([01]?\\d|2[0-3]):\\s?00(?![\\d:.])", "gu");
    private static readonly JsRe CLOCK_COLON = JsRegex.Compile("(?<=\\d):\\s?(?=\\d)", "gu");
    private static readonly JsRe DECIMAL = JsRegex.Compile("(?<![\\d.])(\\d+)\\.(\\d+)(?![\\d.])", "gu");
    private static readonly JsRe PLUS_ATTACHED = JsRegex.Compile("(\\S)\\+\\s?(?=\\d)", "gu");
    private static readonly JsRe PLUS_LEADING = JsRegex.Compile("(^|\\s)\\+\\s?(?=\\d)", "gu");
    private static readonly JsRe DEGREE = JsRegex.Compile("(\\d)\\s?°\\s?", "gu");
    private static readonly JsRe EQUALS = JsRegex.Compile("\\s?=\\s?", "gu");
    private static readonly JsRe DIVIDE = JsRegex.Compile("\\s?÷\\s?", "gu");

    /**
     * The Kannada normalizer. A numbered, ORDER-DEPENDENT sequence; the coupling is stated at each step.
     */
    public static string NormalizeKannada(string input)
    {
        // 1) ZERO-WIDTH characters (ZWNJ ×922, ZWJ ×139, ZWSP ×6 — the largest raw count in the corpus).
        //    Removed FIRST: every later rule asserts letter/digit adjacency, and an invisible character
        //    defeats all of them. It also fixes a defect of its own — the engine's word class is the
        //    Kannada block, which excludes U+200C/U+200D, so ಪಾಯಿಂಟ್‌ಗಳಿಂದ tokenized as TWO words and came
        //    out [pˈaːjĩɳʈ ɡˈaɭĩn̪d̪a], two primary stresses where the word has one. Every one of the 1,067
        //    instances sits immediately after a virama ್ (checked by printing the neighbours), so deleting
        //    the joiner leaves the identical akshara sequence and no phoneme changes.
        var s = ZERO_WIDTH.Replace(input, "");

        // 2) KANNADA DIGITS ೦-೯ → ASCII (×1). Before every numeric rule below, so that a native-digit
        //    numeral is eligible for the same de-grouping, ordinal, percent and unit handling as an ASCII
        //    one. kannada.ts also folds them, but only inside a token the tokenizer already classed as a
        s = Unicode.FoldNativeDigits(s);

        // 3) DIGIT DE-GROUPING, before anything that reads punctuation. 1,000 was reading as
        //    "ಒಂದು <pause> ಸೊನ್ನೆ". ×42, all Western 3-digit blocks.
        s = GROUPING.Replace(s, "");

        // 4) ORDINALS ನೇ / ನೆಯ (×39), AFTER de-grouping — this corpus writes an ordinal on a grouped numeral
        //    ("ಅವರ 1,000 ನೇ ಅಂಚೆ ಚೀಟಿ"). Kannada fuses the suffix onto the LAST cardinal word; emitted apart,
        //    ನೇ reached the g2p as a stray stressed [nˈeː]. Both welded (16ನೇ) and spaced (15 ನೇ) occur, and
        //    the nominaliser ದು (60ನೆಯದು) rides along.
        s = ORDINAL_RE.Replace(s, m =>
        {
            var n = Js.Number(m.Groups[1].Value);
            if (!(double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d) || n == 0) return m.Value;
            var w = Numbers.OrdinalToWords(n, $"{m.Groups[2].Value}{(m.Groups[3].Success ? m.Groups[3].Value : "")}");
            return w == "" ? m.Value : w;
        });

        // 5) ERA markers, BEFORE the dotted-abbreviation rules — ಕ್ರಿ.ಪೂ is a dotted pair by shape and would
        //    otherwise survive as two letters with the era lost. The trailing dot is consumed only when a
        //    letter or digit follows. A welded case clitic (ಕ್ರಿ.ಪೂದಲ್ಲಿ) is left attached, which is
        //    grammatical on the expansion too.
        s = ERA_RE.Replace(s, m => ERA[m.Groups[1].Value]);

        // 6) MULTI-DOT ABBREVIATIONS before single-dot ones, else the interior dot survives as a phrase
        //    break. The unit is expanded to ಕಿಲೋಮೀಟರ್ only when nothing is welded onto it: gluing a case
        //    clitic to the expansion would produce a form Kannada does not build. Losing the dot is the
        //    whole defect; the expansion is a bonus taken only where safe.
        var frozen = s;
        s = KM_RE.Replace(s, m =>
            LETTER_START.IsMatch(frozen[(m.Index + m.Value.Length)..])
                ? DOTTED.Replace(m.Value, "")
                : "ಕಿಲೋಮೀಟರ್");
        s = MM_RE.Replace(s, "ಮಿಮೀ");
        s = INITIALISM_RE.Replace(s, m => DOTTED.Replace(m.Value, " ").Trim());

        // 7) RATE units, BEFORE the shared symbol tier can claim the numerator and strand the denominator.
        //    Kannada's rate is a dative PREFIX, attested verbatim ("ಗಂಟೆಗೆ 83 ಕಿಮೀ"), which is why `unitPer`
        //    is not declared on the shared tier.
        var frozen2 = s;
        s = KM_RATE_RE.Replace(s, m =>
            $"{Dative(RATE_DENOM[m.Groups[2].Value], frozen2, m.Index)}{m.Groups[1].Value} ಕಿಲೋಮೀಟರ್");
        var frozen3 = s;
        s = MI_RATE_RE.Replace(s, m => $"{Dative("ಗಂಟೆಗೆ", frozen3, m.Index)}{m.Groups[1].Value} ಮೈಲಿ");

        // 8) VULGAR FRACTIONS
        s = VULGAR_RE.Replace(s, m => $" {VULGAR[m.Groups[1].Value]}");

        // 9) The SHARED symbol tier: percent, currency, units, exponent. UNITS BEFORE DECIMALS — the tier
        //    matches a unit only when a NUMBER is adjacent. AFTER de-grouping and after the rate rule.
        s = SYMBOLS(s);

        // 10) TIMES BEFORE the decimal step: a bare-number rule must not claim 11:30.
        //     (a) :00 minutes are DROPPED, not read. (b) every remaining digit-colon-digit becomes a SPACE.
        //     NO ಗಂಟೆ is added — the noun is already in the text where it belongs.
        s = CLOCK_00.Replace(s, "$1");
        s = CLOCK_COLON.Replace(s, " ");

        // 11) DECIMALS
        s = DECIMAL.Replace(s, m =>
            $"{m.Groups[1].Value} {Numbers.DECIMAL_WORD} {string.Join(" ", Js.CodePoints(m.Groups[2].Value))}");

        // 12) DEGREES
        s = PLUS_ATTACHED.Replace(s, "$1 ಪ್ಲಸ್ ");
        s = PLUS_LEADING.Replace(s, "$1ಪ್ಲಸ್ ");

        s = DEGREE.Replace(s, "$1 ಡಿಗ್ರಿ ");

        // THE RELATIONAL AND DIVISION SIGNS
        s = PostposedSignPass.PostposedSign(s, "<", "ಗಿಂತ ಕಡಿಮೆ");
        s = PostposedSignPass.PostposedSign(s, ">", "ಗಿಂತ ಹೆಚ್ಚು");
        s = EQUALS.Replace(s, " ಸಮ ");
        s = DIVIDE.Replace(s, " ಭಾಗಾಕಾರ ");

        return s;
    }
}
