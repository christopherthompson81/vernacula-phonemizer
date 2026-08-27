/**
 * Tibetan text normalization — the pre-tokenizer pass that rewrites symbols, spans, units and stray spaces
 * into Tibetan WORDS, which the engine's word arm then phonemizes for free. Everything emitted is text, so
 * nothing bypasses the g2p.
 *
 * Ported from src/languages/tibetan/normalize.ts, whose header and per-rule notes carry the corpus counts
 * behind every word and every refusal. Nothing is re-derived here.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Tibetan;

public static class Normalize
{
    private const string D = "0-9༠-༩";
    private const string DASH = "[-‐-―−~～]";
    private static readonly string NUM = $"[{D}]+(?:[.,][{D}]+)?(?:\\s*{DASH}\\s*[{D}]+(?:[.,][{D}]+)?)?";
    private const string TIB = "\\u0F0B\\u0F40-\\u0F6C\\u0F71-\\u0F84\\u0F90-\\u0FBC";
    private const string WORD_END = "(?![\\u0F40-\\u0F5F\\u0F61-\\u0F6C\\u0F71-\\u0F84\\u0F90-\\u0FBC])";
    private const string TSHEG = "་";

    /** Unit abbreviation → the Tibetan word. Longest key first, so `mm`/`cm` beat the bare `m`. */
    private static readonly (string Key, string Word)[] UNITS =
    [
        ("km", "སྤྱི་ལེ"), ("mm", "མི་ལི་མེ་ཏྲེར"), ("cm", "ལི་སྨིད"), ("kg", "སྟོང་ཁེའུ"), ("m", "སྨི"),
    ];
    private static readonly string UNIT_TAIL = $"(?![A-Za-z{D}²³/])";
    private const string SQUARED = "གྲུ་བཞི་མ";
    private static readonly (string Key, string Phrase)[] RATE_DENOMINATORS = [("h", "ཆུ་ཚོད་རེར")];

    private static readonly JsRe LIT = JsRegex.Compile(@"[.*+?^${}()|[\]\\]", "gu");
    /** Escape a literal for embedding in a pattern — the JS `lit()` helper. */
    private static string Lit(string s) => LIT.Replace(s, m => "\\" + m.Value);

    /**
     * Put `word` in front of a numeral that carries `lead`/`tail`, UNLESS the text already wrote the word
     * within `gap` characters before it.
     *
     * ⚠ TWO REPLACES, AND THE FIRST IS THE REDUNDANCY TEST. A corpus that spells the unit out and then gives
     * the figure would otherwise say it twice; the first pass consumes the lead/tail and leaves the numeral
     * alone, so only a figure with no word in front of it reaches the second.
     * ⚠ The gap window may contain no digit, no shad and no newline, so the word being tested belongs to
     * THIS figure rather than a previous clause's.
     */
    private static string Prepose(string t, string word, int gap, string lead = "", string tail = "")
    {
        var w = Lit(word);
        t = JsRegex.Compile($"({w}{WORD_END}[^{D}།༎\\n]{{0,{gap}}}){lead}({NUM}){tail}", "gu")
            .Replace(t, m => m.Groups[1].Value + m.Groups[2].Value);
        return JsRegex.Compile($"(?<![{D}.,]){lead}({NUM}){tail}", "gu")
            .Replace(t, m => $"{TSHEG}{word}་{m.Groups[1].Value}");
    }

    private static readonly JsRe TIB_DIGIT = JsRegex.Compile("[༠-༩]", "gu");
    /** The numeric value of a run that may be written in Tibetan digits. */
    private static double Value(string run) =>
        Js.Number(TIB_DIGIT.Replace(run, m => ((char.ConvertToUtf32(m.Value, 0) - 0x0F20)).ToString(
            System.Globalization.CultureInfo.InvariantCulture)));

    private static readonly JsRe SQUEEZE_A = JsRegex.Compile($"([{D}])[ \\t]+(?=[{TIB}])", "gu");
    private static readonly JsRe SQUEEZE_B = JsRegex.Compile($"([{TIB}])[ \\t]+(?=[{D}])", "gu");
    /** ⚠ RUN TWICE — once before the rules and once after, and it must be both: the rules themselves leave
     *  a numeral newly adjacent to a Tibetan word. */
    private static string SqueezeNumeralSpace(string t) =>
        SQUEEZE_B.Replace(SQUEEZE_A.Replace(t, m => m.Groups[1].Value), m => m.Groups[1].Value);

    // soft hyphen, ZWSP, RLM, word joiner, BOM
    private static readonly JsRe ZERO_WIDTH = JsRegex.Compile("[­​-‏⁠﻿]", "gu");
    private static readonly JsRe PCT_COMPAT = JsRegex.Compile("[％﹪٪]", "gu");
    private static readonly JsRe DEG_C = JsRegex.Compile("℃", "gu");
    private static readonly JsRe DEG_F = JsRegex.Compile("℉", "gu");
    private static readonly JsRe GROUP_COMMA =
        JsRegex.Compile($"(?<=[{D}])(?<!(?<![{D}\\.,])0),(?=[{D}]{{3}}(?![{D}]))", "gu");
    private static readonly JsRe CLOCK =
        JsRegex.Compile($"(?<![{D}:])([{D}]{{1,2}}):([{D}]{{2}})(?![{D}:])", "gu");
    private static readonly JsRe SPAN = JsRegex.Compile(
        $"(?<![*×xX]\\s{{0,2}})(?<!{DASH}\\s{{0,2}})(?<![{D}.,])"
        + $"([{D}]+)\\s*{DASH}\\s*([{D}]+)(?![{D}.,])(?!\\s*{DASH})", "gu");

    /** Normalize one Tibetan string. The steps are ORDER-DEPENDENT; the TS states each coupling. */
    public static string NormalizeTibetan(string input)
    {
        var t = input;

        // 1) ZERO-WIDTH MARKS, first. ⚠ This corpus writes ZWSP after EVERY TSHEG in places.
        t = ZERO_WIDTH.Replace(t, _ => "");

        // 2) COMPATIBILITY FORMS OF THE SIGNS THIS LAYER READS. ⚠ Only these — never blanket NFKC.
        t = PCT_COMPAT.Replace(t, _ => "%");
        t = DEG_C.Replace(t, _ => "°C");
        t = DEG_F.Replace(t, _ => "°F");

        // 2b) THE SPACE AROUND A NUMERAL, once here and again at step 12 — and it must be both.
        t = SqueezeNumeralSpace(t);

        // 3) COMMA-GROUPED THOUSANDS, BEFORE the comma can be read as a clause pause and cut a numeral in
        //    half. ⚠ Never after a lone `0` — no convention groups from zero, and joining would be a 1000×
        //    error rather than a reading of one.
        t = GROUP_COMMA.Replace(t, _ => "");

        // 4) RATES — `118-149km/h`. ⚠ HERE, ahead of the unit, span and clock rules, because this rule MOVES
        //    the numeral and a later rule would no longer find it adjacent to what it needs.
        foreach (var (dkey, dphrase) in RATE_DENOMINATORS)
            foreach (var (ukey, uword) in UNITS)
                t = Prepose(t, $"{dphrase}་{uword}", 3, tail: $"\\s*{ukey}\\s*/\\s*{dkey}(?![A-Za-z{D}])");

        // 5) SQUARED UNITS, ⚠ BEFORE the plain unit rule — otherwise `km²` has its `km` consumed first and
        //    the exponent is stranded.
        foreach (var (key, word) in UNITS)
            t = Prepose(t, $"{word}་{SQUARED}", 3, tail: $"\\s*{key}\\s*[²2](?![A-Za-z{D}])");

        // 6) PLAIN UNIT ABBREVIATIONS. A digit must be adjacent, so ordinary embedded English is left alone.
        foreach (var (key, word) in UNITS) t = Prepose(t, word, 3, tail: $"\\s*{key}{UNIT_TAIL}");

        // 7) PERCENT — བརྒྱ་ཆ ("hundred-part"), artifact ×16, wiki ×6, and the sense is read.
        t = Prepose(t, "བརྒྱ་ཆ", 3, tail: "\\s*%");

        // 8) CURRENCY — ཨ་སྒོར is the US dollar, artifact ×7, wiki ×6, always in an amount.
        t = Prepose(t, "ཨ་སྒོར", 12, lead: "\\$\\s*");

        // 9) DEGREES CELSIUS — སེ་དྲོད is definitional on bo.wikipedia and names the sign itself.
        t = Prepose(t, "སེ་དྲོད", 3, tail: "\\s*[°'′]\\s*[cC](?![A-Za-z])");

        // 10) CLOCK. ⚠ THE CHAIN GUARD IS THE WHOLE RULE — of the six colon shapes in the retained text,
        //     three are not clocks, and a chained colon is what tells them apart.
        t = CLOCK.Replace(t, m => $"{TSHEG}ཆུ་ཚོད་{m.Groups[1].Value}་སྐར་མ་{m.Groups[2].Value}");

        // 11) SPANS → the corpus's own `X ནས Y བར` circumfix. ⚠ Only when the second operand is LARGER; a
        //     non-ascending pair is a score, a date or a subtraction, not a span.
        t = SPAN.Replace(t, m =>
        {
            var a = m.Groups[1].Value;
            var b = m.Groups[2].Value;
            return Value(b) > Value(a) ? $"{a}ནས་{b}བར་" : m.Value;
        });

        // 12) THE SPACE AROUND A NUMERAL, last, so it also tidies what the rules above left behind.
        t = SqueezeNumeralSpace(t);
        return t;
    }
}
