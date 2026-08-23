
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Maori;

public static class Normalize
{
    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        Multiply = new MultiplyDef { Times = "whakarea" },
        Percent = new[] { "ōrau" },
        // Prefixed forms are their own keys, longest-first: with only a bare `$`, `AUD$45` read its letters as a word
        // and dropped the sign. `NZ$` is declared because it is this language's own currency, not on frequency.
        Currency = new Dictionary<string, IReadOnlyList<string>>
        {
            ["US$"] = new[] { "tāra" }, ["AUD$"] = new[] { "tāra" }, ["NZ$"] = new[] { "tāra" },
            ["$"] = new[] { "tāra" }, ["£"] = new[] { "pauna" },
        },
        // ⚠ A magnitude must be declared or the currency word lands INSIDE the number: without these, `$2.3 piriona`
        // read "rua . toru TĀRA piriona" — the sign is adjacent to the digits, so the word is emitted there and the
        // magnitude stranded behind it. Māori writes the magnitude first and takes no connective.
        Magnitudes = new[] { "miriona", "piriona", "mano" },
        Units = new Dictionary<string, IReadOnlyList<string>>
        {
            ["km"] = new[] { "kiromita" }, ["m"] = new[] { "mita" }, ["m/h"] = new[] { "maero ia hāora" },
            ["mm"] = new[] { "mirimita" }, ["ha"] = new[] { "heketea" }, ["l"] = new[] { "rita" }, ["L"] = new[] { "rita" },
        },
        UnitPer = "ia",
        RateDenominators = new Dictionary<string, string> { ["h"] = "hāora", ["s"] = "hēkona" },
        ExponentWords = new ExponentWordsDef
        {
            Squared = new[] { "pūrua" },
            Cubed = new[] { "pūtoru" },
            Position = ExponentPosition.After,
        },
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
        // The entity must go before the bare sign, or `&amp;` becomes "me amp ;". Spaced both sides so `B&B` stays
        // two initialisms rather than fusing into one token.
        var s = AMP.Replace(AMP_ENTITY.Replace(input, "&"), " me ");
        // Māori has no /l/ or /s/, so `plus` and `minus` are unsayable natively; they reach the English reader by the
        // engine's routing path (`isNativeWord` walks the word as the g2p does, and both fail at the `l`). Guarded
        // against a spaced range, which would otherwise read as a sign.
        var before = s;
        s = LEADING_MINUS.Replace(s, m => DIGIT_BEFORE.IsMatch(before[..m.Index]) ? m.Value : "minus ");
        // `tāpiri` is the arithmetic verb (append / sum), so it reads the OPERATOR only — as a polarity sign it would
        // say "thirty degrees APPEND". Digits on BOTH sides keep a UTC offset or signed temperature away from it.
        s = PLUS_OPERATOR.Replace(s, "$1 tāpiri ");

        // ⚠ ORDER IS LOAD-BEARING: the operator arm above must claim `3 + 4` first, or the leading-sign arm below
        // matches its space and reads *toru plus whā*. Two sign arms are needed — `(\S)\+` for a glued `UTC+1`, the
        // boundary arm for `+5` / `+30°C`.
        s = PLUS_MINUS.Replace(s, " plus minus ");
        s = PLUS_ATTACHED.Replace(s, "$1 plus ");
        s = PLUS_LEADING.Replace(s, "$1plus ");

        // Relational and division signs have native words, so unlike the loans above they stay on the native branch.
        // ⚠ All four are INFIX despite Māori being VSO: each construction puts its preposition before the second
        // operand (`A < B` → "A iti iho i B"), so the operands keep written order and need no reordering.
        s = EQUALS.Replace(s, " rite ki ");
        s = LESS_THAN.Replace(s, " iti iho i ");
        s = GREATER_THAN.Replace(s, " nui ake i ");
        s = DIVIDE.Replace(s, " whakawehe ki ");

        // ⚠ `putu` (degree) and `pūtu` (boots) differ only by vowel length — the macron is the whole distinction.
        // °F is not declared: no Māori form for Fahrenheit, and this file does not invent one (cf. `mm` above).
        s = DEG_C.Replace(s, "$1 putu Herehiūhu");
        s = DEG.Replace(s, "$1 putu");

        // Everything else this language needs is declared data, not a local rule.
        return SYMBOLS(s);
    }
}
