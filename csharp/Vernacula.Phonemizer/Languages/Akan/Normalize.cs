/**
 * Akan text normalization — the pre-tokenizer pass that rewrites what is not already a pronounceable word.
 * Ported from src/languages/akan/normalize.ts, whose header and per-rule notes carry the corpus counts
 * behind every word chosen and every class deliberately declined. Nothing is re-derived here.
 *
 * ⚠ THE WORDS ARE ATTESTED, NOT COMPOSED. Each one was read in the corpus before it was written, and the TS
 * records where the first pass got it wrong (the Twi form is `sɛntimita` ×91, not the `sentimita` an
 * outsider would compose ×2; the cedi is `sidi`, not `cedi`, because ⟨c⟩ is not an Akan letter and
 * `PhonemizeWord("cedi")` falls through to `LatinPhone` as *[kedi]*).
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Akan;

public static class Normalize
{
    /** The decimal point — Twi-sourced; `akyiri pɔ` ×1,137 in tw. See the TS for the spelling census. */
    private const string POINT = "akyiri pɔ";

    /** PERCENT, and it is PREPOSED — every read instance puts the word before the figure. */
    private const string PERCENT = "ɔha mu nkyekyɛmu";

    /** The percent word AS THE CORPUS ALREADY WRITES IT, for the redundancy test — every spelling of the
     *  family folded into one pattern. */
    private const string PERCENT_WRITTEN = @"[ɔoO][hH]a\s?(?:mu\s?)?nkyeky[ɛeɔ][ɛem]?u?";

    /**
     * A REDUNDANT SIGN IS A PERMISSIBLE DROP — say it once, in the position the language puts it.
     * This corpus writes the percent word AND the sign in the same breath: **893 of the 5,154 percent signs
     * (17.3%) already have the word in front of them**. Without this the reading says it twice.
     * ⚠ The window is 60 characters and may contain no other `%` and no sentence break, so the word tested
     * is the one belonging to THIS figure rather than a previous sentence's.
     */
    private static readonly JsRe ALREADY_PERCENTED =
        JsRegex.Compile($"{PERCENT_WRITTEN}[^%.!?]{{0,60}}$", "u");
    private static bool AlreadyPercented(string before) => ALREADY_PERCENTED.IsMatch(before);

    /** RANGE CONNECTIVE, used as an INFIX between the operands; `kosi` is the form both varieties share. */
    private const string TO = "kosi";

    /** UNITS — longest key first, so `mm`/`cm` are tried before the bare `m`.
     *  ⚠ NO `s`, `g`, `h`, `t`: not attested after a numeral here, and a bare `s` would make every English
     *  plural after a number a measurement. */
    private static readonly (string Sym, string Word)[] UNITS =
    [
        ("km", "kilomita"), ("cm", "sɛntimita"), ("mm", "milimita"), ("kg", "kilogram"), ("m", "mita"),
    ];

    /** THE SQUARE-MEASURE WORD, glossed against the symbol by tw.wikipedia's own km² article.
     *  ⚠ NO CUBE WORD: `km³`/`m³` is ×0 in the artifact, so step 4 keeps refusing `3`/`³`. */
    private const string SQUARED = "ahinanan";

    /** The same symbols STANDING ALONE — a caption or a table header whose numeral is out of reach. Shared
     *  guards: multi-letter vowel-free keys only, so `m` is untouched. */
    private static readonly Func<string, string> BARE_UNITS = NormalizeSymbols.MakeBareUnitNormalizer(
        UNITS.Select(u => new KeyValuePair<string, string>(u.Sym, u.Word)));

    /** CURRENCY, PREPOSED. ⚠ `GH₵`/`GHC`/`GHS` must be tried BEFORE the bare `₵`, or the `GH` is stranded. */
    private static readonly (string Sym, string Word)[] CURRENCY =
    [
        ("GH₵", "sidi"), ("GHC", "sidi"), ("GHc", "sidi"), ("GHS", "sidi"), ("₵", "sidi"),
        ("US\\$", "dɔla"), ("\\$", "dɔla"),
    ];

    /** A NUMBER OPERAND that ends in a digit. ⚠ The trailing `\d` is not decoration: a class like `[\d.,]*`
     *  also swallows a following CLAUSE comma, which is silent data loss once a rule writes words around it. */
    private const string NUM = @"\d+(?:[.,]\d+)*";
    private const string NLB = @"(?<![\p{L}\p{M}])";

    /** ⟨ε⟩ (Greek epsilon) and ⟨כ⟩ (Hebrew kaf) for ⟨ɛ ɔ⟩ — folded immediately after NFC, before any rule
     *  that reads an Akan letter. */
    private static readonly IReadOnlyDictionary<string, string> HOMOGLYPH =
        new Dictionary<string, string>(StringComparer.Ordinal) { ["ε"] = "ɛ", ["כ"] = "ɔ" };
    private static readonly JsRe HOMOGLYPH_RE = JsRegex.Compile($"[{string.Concat(HOMOGLYPH.Keys)}]", "gu");

    /** A short fractional tail reads as a number; a long one, or one with a leading zero, digit-at-a-time. */
    private static string Fraction(string tail) =>
        tail.Length <= 2 && !tail.StartsWith('0') ? tail : string.Join(" ", Js.CodePoints(tail));

    private static readonly JsRe ENTITIES = JsRegex.Compile(@"&nbsp;|&#(?:x[0-9a-f]+|\d+);", "giu");
    private static readonly JsRe ZERO_WIDTH = JsRegex.Compile("[​‌‍﻿]", "gu");
    private static readonly JsRe PIPE_AFTER_DIGIT = JsRegex.Compile(@"(?<=\d)\|(?=\p{L})", "gu");
    private static readonly JsRe ELISION = JsRegex.Compile($"{NLB}([nwmNWM])['’ʼ]([aeɛioɔuAEIƐOƆU])", "gu");
    private static readonly JsRe GROUP_COMMA = JsRegex.Compile(@"(?<![\d.,])([1-9]\d{0,2})((?:,\d{3})+)(?![\d]|,\d)", "gu");
    private static readonly JsRe GROUP_DOT = JsRegex.Compile(@"(?<![\d.,])([1-9]\d{0,2})((?:\.\d{3}){2,})(?![\d]|\.\d)", "gu");
    // separators: space, NBSP, NNBSP, thin space
    private static readonly JsRe GROUP_SPACE = JsRegex.Compile(
        @"(?<![\d.,])([1-9]\d{0,2})((?:[    ]\d{3})+)(?![\d]| \d)", "gu");
    private static readonly JsRe COMMA_ALL = JsRegex.Compile(",", "gu");
    private static readonly JsRe DOT_ALL = JsRegex.Compile(@"\.", "gu");
    private static readonly JsRe SPACE_ALL = JsRegex.Compile("[    ]", "gu");
    private static readonly JsRe INTERIOR_DOT = JsRegex.Compile(@"(?<=[\p{L}\p{M}])\.(?=\p{L}\p{M}*\.)", "gu");
    private static readonly JsRe RANGE = JsRegex.Compile(
        @"(?<![\d.,:\p{L}\p{M}\-–—])(\d+)\s?[-–—]\s?(\d+)(?![\d\p{L}\p{M}\-–—]|,\d)", "gu");
    private static readonly JsRe DECIMAL_DOT = JsRegex.Compile(@"(?<![\d.,])(\d+)\.(\d+)(?![\d.])", "gu");
    private static readonly JsRe DECIMAL_COMMA = JsRegex.Compile(@"(?<![\d.,])(\d+),(\d{1,2})(?![\d.,])", "gu");
    private static readonly JsRe ENGLISH_ORDINAL = JsRegex.Compile(@"(?<=\d)(?:st|nd|rd|th)(?![\p{L}\p{M}])", "gu");
    private static readonly JsRe AMPERSAND = JsRegex.Compile(@"\s?&\s?", "gu");
    private static readonly JsRe PERCENT_RANGE = JsRegex.Compile(
        $@"(?<![\d.,:\-–—])({NUM})\s?%?\s?[-–—]\s?({NUM})\s?%", "gu");
    private static readonly JsRe PERCENT_ONE = JsRegex.Compile($@"(?<![\d.,])({NUM})\s?%", "gu");

    private static readonly JsRe[] UNIT_SQUARED = UNITS.Select(u => JsRegex.Compile(
        $@"(?<![$€£₵][^\d]{{0,3}}[\d.,]{{0,12}})(?<![\d.,\p{{L}}\p{{M}}])({NUM})\s?{u.Sym}(?:²|2)(?![\p{{L}}\p{{M}}\d²³])", "gu")).ToArray();
    private static readonly JsRe[] UNIT_PLAIN = UNITS.Select(u => JsRegex.Compile(
        $@"(?<![$€£₵][^\d]{{0,3}}[\d.,]{{0,12}})(?<![\d.,\p{{L}}\p{{M}}])({NUM})\s?{u.Sym}(?![\p{{L}}\p{{M}}\d²³])", "gu")).ToArray();
    private static readonly JsRe[] CURRENCY_RE = CURRENCY.Select(c => JsRegex.Compile(
        $@"{NLB}{c.Sym}\s?({NUM})", "gu")).ToArray();

    /** Normalize one Akan string. The steps are ORDER-DEPENDENT; the TS states each coupling. */
    public static string NormalizeAkan(string input)
    {
        // 0) NFC at the entry, so a literal here matches whichever normalization the corpus used.
        var s = input.Normalize(System.Text.NormalizationForm.FormC);

        // 1) HTML ENTITIES AND ZERO-WIDTH MARKS, first.
        s = ENTITIES.Replace(s, _ => " ");
        s = ZERO_WIDTH.Replace(s, _ => "");
        s = PIPE_AFTER_DIGIT.Replace(s, _ => " ");

        // 1b) HOMOGLYPHS FOR ⟨ɛ ɔ⟩ — before ANY rule that reads an Akan letter.
        s = HOMOGLYPH_RE.Replace(s, m => HOMOGLYPH[m.Value]);

        // 2) THE ELISION APOSTROPHE — the largest class in the language, ×4,930 tw + ×2,664 fat.
        s = ELISION.Replace(s, m => m.Groups[1].Value + m.Groups[2].Value);

        // 3) DIGIT DE-GROUPING, before every other numeric rule.
        s = GROUP_COMMA.Replace(s, m => COMMA_ALL.Replace(m.Value, ""));
        s = GROUP_DOT.Replace(s, m => DOT_ALL.Replace(m.Value, ""));
        s = GROUP_SPACE.Replace(s, m => SPACE_ALL.Replace(m.Value, ""));

        // 4) UNITS, BEFORE DECIMALS — the number-unit adjacency dies the moment a decimal becomes words.
        //    ⚠ The squared arm runs first for every key, then the plain arm for every key: a `km²` must not
        //    be claimed by the plain `km` rule and left with a stranded exponent.
        for (var i = 0; i < UNITS.Length; i++)
            s = UNIT_SQUARED[i].Replace(s, m => $"{m.Groups[1].Value} {UNITS[i].Word} {SQUARED}");
        for (var i = 0; i < UNITS.Length; i++)
            s = UNIT_PLAIN[i].Replace(s, m => $"{m.Groups[1].Value} {UNITS[i].Word}");
        s = BARE_UNITS(s);

        // 5) PERCENT, before the range rule and before decimals. The word is PREPOSED.
        var pctSrc = s;
        s = PERCENT_RANGE.Replace(pctSrc, m =>
        {
            var a = m.Groups[1].Value;
            var b = m.Groups[2].Value;
            if (Js.Number(COMMA_ALL.Replace(a, "")) >= Js.Number(COMMA_ALL.Replace(b, ""))) return m.Value;
            var word = AlreadyPercented(pctSrc[..m.Index]) ? "" : $"{PERCENT} ";
            return $"{word}{a} {TO} {b}";
        });
        var pctSrc2 = s;
        s = PERCENT_ONE.Replace(pctSrc2, m =>
            AlreadyPercented(pctSrc2[..m.Index]) ? m.Groups[1].Value : $"{PERCENT} {m.Groups[1].Value}");

        // 6) CURRENCY, also PREPOSED, and before decimals for the same reason. Longest key first.
        for (var i = 0; i < CURRENCY.Length; i++)
            s = CURRENCY_RE[i].Replace(s, m => $"{CURRENCY[i].Word} {m.Groups[1].Value}");

        // 7) DOTTED ABBREVIATIONS — the INTERIOR dots only (×940 tw + 222 fat).
        s = INTERIOR_DOT.Replace(s, _ => "");

        // 8) RANGES — ×1,125 bare pairs in tw and ×264 in fat, read today as two juxtaposed cardinals.
        s = RANGE.Replace(s, m =>
        {
            var a = m.Groups[1].Value;
            var b = m.Groups[2].Value;
            return Js.Number(a) < Js.Number(b) ? $"{a} {TO} {b}" : m.Value;
        });

        // 9) THE DECIMAL POINT, after every rule that needed to see a dot (steps 3, 4 and 7).
        s = DECIMAL_DOT.Replace(s, m => $"{m.Groups[1].Value} {POINT} {Fraction(m.Groups[2].Value)}");
        s = DECIMAL_COMMA.Replace(s, m => $"{m.Groups[1].Value} {POINT} {Fraction(m.Groups[2].Value)}");

        // 10) THE ENGLISH ORDINAL SUFFIX — ×528 tw + 254 fat, all inside English text these wikis carry.
        s = ENGLISH_ORDINAL.Replace(s, _ => "");

        // 11) THE AMPERSAND — ×230 tw + 91 fat, silent today.
        s = AMPERSAND.Replace(s, _ => " ne ");

        return s;
    }
}
