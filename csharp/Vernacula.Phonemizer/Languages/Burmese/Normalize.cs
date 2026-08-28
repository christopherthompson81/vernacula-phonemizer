/**
 * Burmese (my) text normalization — the pre-tokenizer pass that rewrites everything the Burmese g2p cannot
 * already read into Burmese-script words the pipeline speaks.
 * Ported from src/languages/burmese/normalize.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;
using static Vernacula.Phonemizer.Core.Rewriter;

namespace Vernacula.Phonemizer.Languages.Burmese;

public static class Normalize
{
    /** Burmese digits ၀-၉ plus ASCII; the corpus mixes both, and every rule must accept either. */
    private const string D = "0-9\u1040-\u1049";
    /**
     * One digit, optionally quantified. `d()` is a bare class so the caller can append its own quantifier.
     */
    private static string Digit(int? n = null) => $"[{D}]{(n is null ? "" : $"{{{n}}}")}";

    /** Unit abbreviations → their Burmese words. */
    private static readonly (string Source, string Word)[] UNITS =
    {
        ("km", "ကီလိုမီတာ"),
        ("kg", "ကီလိုဂရမ်"),
        ("cm", "စင်တီမီတာ"),
        ("mm", "မီလီမီတာ"),
        ("mg", "မီလီဂရမ်"),
        ("[u\u00b5\u03bc]g", "မိုက်ခရိုဂရမ်"),
        ("\\bm\\b", "မီတာ"),
        ("\\bg\\b", "ဂရမ်"),
    };

    /** A RATE — `၃၀ mg/kg`, a mass-per-mass drug dose. */
    private static readonly (string Source, string Word)[] RATE_DENOMINATORS =
    {
        ("kg", "ကီလိုဂရမ်"),
        ("h(?:rs?)?", "နာရီ"),
        ("d(?:ay)?", "ရက်"),
    };

    /** Currency signs → the Burmese word, postposed like the percent word. */
    private static readonly IReadOnlyDictionary<string, string> CURRENCY = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["$"] = "ဒေါ်လာ",
        ["€"] = "ယူရို",
        ["£"] = "ပေါင်",
        ["¥"] = "ယန်း",
        ["₹"] = "ရူပီး",
    };

    private static readonly JsRe ZERO_WIDTH = JsRegex.Compile("[\\u200b-\\u200d\\u2060\\ufeff]", "gu");
    private static readonly JsRe DEG_C_SIGN = JsRegex.Compile("\u2103", "gu");
    private static readonly JsRe DEG_F_SIGN = JsRegex.Compile("\u2109", "gu");
    private static readonly JsRe ESCAPE = JsRegex.Compile("[.*+?^${}()|[\\]\\\\]", "gu");
    private static readonly JsRe AMPERSAND = JsRegex.Compile("\\s*[&\uff06]\\s*", "gu");
    private static readonly JsRe DOTTED_INITIALISM = JsRegex.Compile("(?<![\\p{L}\\p{M}])(?:\\p{L}\\.){2,}", "gu");
    private static readonly JsRe DOTS = JsRegex.Compile("\\.", "gu");
    private static readonly JsRe RUNS = JsRegex.Compile("[ \\t]{2,}", "gu");
    private const string DASH = "[-\u2010-\u2015\u2212]";

    /** Relational and arithmetic signs — see step 12. */
    private static readonly (JsRe Re, string Word)[] RELATIONAL =
    {
        (JsRegex.Compile("[=\u2248]", "gu"), " ညီမျှ "),
        (JsRegex.Compile("<", "gu"), " ထက်ငယ် "),
        (JsRegex.Compile(">", "gu"), " ထက်ကြီး "),
        (JsRegex.Compile("\u00d7|(?<=\\p{Nd})[ \\t]?x[ \\t]?(?=\\p{Nd})", "gu"), " မြှောက် "),
        (JsRegex.Compile("\u00f7", "gu"), " စား "),
    };

    /** Squared / cubed modifiers, applied before the plain unit rule — see step 10. */
    private static readonly (string Sup, string Modifier)[] EXP = { ("\u00b2", "စတုရန်း"), ("\u00b3", "ကုဗ") };

    public static string NormalizeBurmese(string input)
    {
        var t = input;

        t = Rewrite(t, ZERO_WIDTH, "");

        // ⚠ ZERO-WIDTH, so every separator in the run is claimed in ONE pass. The consuming form ate the
        // trailing group, the scan resumed inside the remainder, and alternate commas survived into a
        // six-digit block the three-digit rule could never claim again — see test/thousands-degrouping.
        t = Rewrite(t, JsRegex.Compile($"(?<={Digit()})(?<!(?<!{Digit()})0)[,\u066c](?={Digit(3)}(?!{Digit()}))", "gu"), "");

        foreach (var (nre, nword) in UNITS)
            foreach (var (dre, dword) in RATE_DENOMINATORS)
                t = Rewrite(t, JsRegex.Compile(
                        $"({Digit()}+(?:[.,]{Digit()}+)?(?:\\s*{DASH}\\s*{Digit()}+(?:[.,]{Digit()}+)?)?)"
                            + $"\\s*(?:{nre})\\s*/\\s*(?:{dre})(?![\\p{{L}}{D}])",
                        "giu")
                    , $"တစ်{dword}လျှင် $1 {nword}");

        t = Rewrite(t, JsRegex.Compile($"({Digit()}{{1,2}}):({Digit(2)})(?!{Digit()})", "gu"), "$1 နာရီ $2 မိနစ်");

        t = Rewrite(t, JsRegex.Compile($"({Digit()}+)\\.({Digit()}+)", "gu"), m =>
            $"{m.Groups[1].Value} ဒသမ {string.Join(" ", Js.CodePoints(m.Groups[2].Value))}");

        t = Rewrite(t, JsRegex.Compile($"({Digit()}+)\\s*[%\uff05]", "gu"), "$1 ရာခိုင်နှုန်း");

        t = Rewrite(Rewrite(t, DEG_C_SIGN, "\u00b0C"), DEG_F_SIGN, "\u00b0F");
        t = Rewrite(t, JsRegex.Compile($"({Digit()})\\s*\u00b0\\s*C(?![\\p{{L}}])", "giu"), "$1 ဒီဂရီ စင်တီဂရိတ်");
        t = Rewrite(t, JsRegex.Compile($"({Digit()})\\s*\u00b0\\s*F(?![\\p{{L}}])", "giu"), "$1 ဒီဂရီ ဖာရင်ဟိုက်");
        t = Rewrite(t, JsRegex.Compile($"({Digit()})\\s*\u00b0", "gu"), "$1 ဒီဂရီ");

        foreach (var (sign, word) in CURRENCY)
            t = Rewrite(t, JsRegex.Compile($"{ESCAPE.Replace(sign, "\\$&")}\\s*({Digit()}+)", "gu"), $"$1 {word}");

        t = Rewrite(t, JsRegex.Compile($"(?<!{Digit()})({Digit()}+)\\s*/\\s*({Digit()}+)(?!{Digit()})", "gu")
            , "$2 ပုံ $1 ပုံ");

        t = Rewrite(t, JsRegex.Compile(
                $"(?<!{DASH}\\s*)(?<![{D}])(?<![\u00d7xX]\\s{{0,2}})"
                    + $"({Digit()}+)\\s*{DASH}\\s*({Digit()}+)(?!{Digit()})(?!\\s*(?:{DASH}|အထိ|ထိ))",
                "gu")
            , "$1 မှ $2 အထိ");

        foreach (var (sup, modifier) in EXP)
            foreach (var (re, word) in UNITS)
                t = Rewrite(t, JsRegex.Compile($"({Digit()})\\s*(?:{re})\\s*{sup}", "gu"), $"$1 {modifier}{word}");

        foreach (var (re, word) in UNITS)
            t = Rewrite(t, JsRegex.Compile($"({Digit()})\\s*(?:{re})(?![\\p{{L}}])", "gu"), $"$1 {word}");

        t = Rewrite(t, JsRegex.Compile($"({Digit()})\\s*\\+\\s*({Digit()})", "gu"), "$1 အပေါင်း $2");
        t = Rewrite(t, JsRegex.Compile($"(?<![{D}])\\+\\s*(?={Digit()})", "gu"), "အပေါင်း ");
        foreach (var (re, word) in RELATIONAL) t = Rewrite(t, re, word);
        t = Rewrite(t, RUNS, " ");

        t = Rewrite(t, AMPERSAND, " နှင့် ");

        t = Rewrite(t, DOTTED_INITIALISM, m => DOTS.Replace(m.Value, ""));

        return t;
    }
}
