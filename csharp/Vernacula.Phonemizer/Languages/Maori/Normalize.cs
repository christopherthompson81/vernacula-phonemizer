/**
 * Māori (mi) text normalization — the shared symbol tier, plus the local sign, relational and degree rules.
 * Ported from src/languages/maori/normalize.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;
using static Vernacula.Phonemizer.Core.Rewriter;

namespace Vernacula.Phonemizer.Languages.Maori;

public static class Normalize
{
    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        Percent = MaoriPhonemizer.DEF.SymbolTier.Percent,
        Currency = MaoriPhonemizer.DEF.SymbolTier.Currency,
        Units = MaoriPhonemizer.DEF.SymbolTier.Units,
        RateDenominators = MaoriPhonemizer.DEF.SymbolTier.RateDenominators,
        UnitPer = MaoriPhonemizer.DEF.SymbolTier.UnitPer,
        ExponentWords = MaoriPhonemizer.DEF.SymbolTier.ExponentWords,
        Magnitudes = MaoriPhonemizer.DEF.SymbolTier.Magnitudes,
        Multiply = MaoriPhonemizer.DEF.SymbolTier.Multiply,
    });

    private static readonly JsRe AMP_ENTITY = JsRegex.Compile("&amp;", "giu");
    private static readonly JsRe AMP = JsRegex.Compile("&", "gu");
    private static readonly JsRe LEADING_MINUS = JsRegex.Compile("(?<![\\p{L}\\p{M}\\p{Nd}])[-−–](?=\\d)", "gu");
    private static readonly JsRe DIGIT_BEFORE = JsRegex.Compile("\\d\\s*$", "u");
    private static readonly JsRe PLUS_OPERATOR = JsRegex.Compile("(\\d)\\s?\\+\\s?(?=\\d)", "gu");
    private static readonly JsRe PLUS_MINUS = JsRegex.Compile("±", "gu");
    private static readonly JsRe PLUS_ATTACHED = JsRegex.Compile("(\\S)\\+\\s?(?=\\d)", "gu");
    private static readonly JsRe PLUS_LEADING = JsRegex.Compile("(^|[\\s(])\\+\\s?(?=\\d)", "gu");
    private static readonly JsRe EQUALS = JsRegex.Compile("\\s?=\\s?", "gu");
    private static readonly JsRe LESS_THAN = JsRegex.Compile("\\s?<\\s?", "gu");
    private static readonly JsRe GREATER_THAN = JsRegex.Compile("\\s?>\\s?", "gu");
    private static readonly JsRe DIVIDE = JsRegex.Compile("\\s?÷\\s?", "gu");
    private static readonly JsRe DEG_C = JsRegex.Compile("(\\d)\\s?°\\s?C(?![\\p{L}\\p{M}])", "gui");
    private static readonly JsRe DEG = JsRegex.Compile("(\\d)\\s?°", "gu");

    /** The Māori normalization pass — the shared symbol tier plus the local sign rules below. */
    public static string NormalizeMaori(string input)
    {
        // ⚠ ORDER: the entity must go before the bare sign, or `&amp;` becomes "me amp ;". Spaced on both
        // sides so `B&B` stays two initialisms rather than fusing into one token.
        var s = Rewrite(Rewrite(input, AMP_ENTITY, "&"), AMP, " me ");
        // `plus`/`minus` are English loans: Māori has no /l/ or /s/, so the engine's routing sends them to
        // the English reader. Guarded against a spaced range, which would otherwise read as a sign.
        var before = s;
        s = Rewrite(s, LEADING_MINUS, m => DIGIT_BEFORE.IsMatch(before[..m.Index]) ? m.Value : "minus ");
        // `tāpiri` is the arithmetic verb, so it reads the OPERATOR only — as a polarity sign it would say
        // "thirty degrees APPEND". Digits on BOTH sides keep a UTC offset or signed temperature away from it.
        s = Rewrite(s, PLUS_OPERATOR, "$1 tāpiri ");

        // ⚠ ORDER IS LOAD-BEARING: the operator arm above must claim `3 + 4` first, or the leading-sign arms
        // here match its space and read *toru plus whā*.
        s = Rewrite(s, PLUS_MINUS, " plus minus ");
        s = Rewrite(s, PLUS_ATTACHED, "$1 plus ");
        s = Rewrite(s, PLUS_LEADING, "$1plus ");

        // ⚠ All four are INFIX despite Māori being VSO: each construction puts its preposition before the
        // second operand (`A < B` → "A iti iho i B"), so the operands keep written order.
        s = Rewrite(s, EQUALS, " rite ki ");
        s = Rewrite(s, LESS_THAN, " iti iho i ");
        s = Rewrite(s, GREATER_THAN, " nui ake i ");
        s = Rewrite(s, DIVIDE, " whakawehe ki ");

        // ⚠ `putu` (degree) and `pūtu` (boots) differ only by vowel length — the macron is the distinction.
        s = Rewrite(s, DEG_C, "$1 putu Herehiūhu");
        s = Rewrite(s, DEG, "$1 putu");

        return SYMBOLS(s);
    }
}
