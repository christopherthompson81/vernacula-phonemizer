/**
 * Burmese (my) text normalization — the pre-tokenizer pass that rewrites everything the Burmese g2p cannot
 * already read into Burmese-script words the pipeline speaks.
 * Ported from src/languages/burmese/normalize.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

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

        t = ZERO_WIDTH.Replace(t, "");

        string prev;
        do
        {
            prev = t;
            t = JsRegex.Compile($"({Digit()})[,\u066c]({Digit(3)})(?!{Digit()})", "gu").Replace(t, "$1$2");
        } while (t != prev);

        foreach (var (nre, nword) in UNITS)
            foreach (var (dre, dword) in RATE_DENOMINATORS)
                t = JsRegex.Compile(
                        $"({Digit()}+(?:[.,]{Digit()}+)?(?:\\s*{DASH}\\s*{Digit()}+(?:[.,]{Digit()}+)?)?)"
                            + $"\\s*(?:{nre})\\s*/\\s*(?:{dre})(?![\\p{{L}}{D}])",
                        "giu")
                    .Replace(t, $"တစ်{dword}လျှင် $1 {nword}");

        t = JsRegex.Compile($"({Digit()}{{1,2}}):({Digit(2)})(?!{Digit()})", "gu").Replace(t, "$1 နာရီ $2 မိနစ်");

        t = JsRegex.Compile($"({Digit()}+)\\.({Digit()}+)", "gu").Replace(t, m =>
            $"{m.Groups[1].Value} ဒသမ {string.Join(" ", Js.CodePoints(m.Groups[2].Value))}");

        t = JsRegex.Compile($"({Digit()}+)\\s*[%\uff05]", "gu").Replace(t, "$1 ရာခိုင်နှုန်း");

        t = DEG_F_SIGN.Replace(DEG_C_SIGN.Replace(t, "\u00b0C"), "\u00b0F");
        t = JsRegex.Compile($"({Digit()})\\s*\u00b0\\s*C(?![\\p{{L}}])", "giu").Replace(t, "$1 ဒီဂရီ စင်တီဂရိတ်");
        t = JsRegex.Compile($"({Digit()})\\s*\u00b0\\s*F(?![\\p{{L}}])", "giu").Replace(t, "$1 ဒီဂရီ ဖာရင်ဟိုက်");
        t = JsRegex.Compile($"({Digit()})\\s*\u00b0", "gu").Replace(t, "$1 ဒီဂရီ");

        foreach (var (sign, word) in CURRENCY)
            t = JsRegex.Compile($"{ESCAPE.Replace(sign, "\\$&")}\\s*({Digit()}+)", "gu").Replace(t, $"$1 {word}");

        t = JsRegex.Compile($"(?<!{Digit()})({Digit()}+)\\s*/\\s*({Digit()}+)(?!{Digit()})", "gu")
            .Replace(t, "$2 ပုံ $1 ပုံ");

        t = JsRegex.Compile(
                $"(?<!{DASH}\\s*)(?<![{D}])(?<![\u00d7xX]\\s{{0,2}})"
                    + $"({Digit()}+)\\s*{DASH}\\s*({Digit()}+)(?!{Digit()})(?!\\s*(?:{DASH}|အထိ|ထိ))",
                "gu")
            .Replace(t, "$1 မှ $2 အထိ");

        foreach (var (sup, modifier) in EXP)
            foreach (var (re, word) in UNITS)
                t = JsRegex.Compile($"({Digit()})\\s*(?:{re})\\s*{sup}", "gu").Replace(t, $"$1 {modifier}{word}");

        foreach (var (re, word) in UNITS)
            t = JsRegex.Compile($"({Digit()})\\s*(?:{re})(?![\\p{{L}}])", "gu").Replace(t, $"$1 {word}");

        t = JsRegex.Compile($"({Digit()})\\s*\\+\\s*({Digit()})", "gu").Replace(t, "$1 အပေါင်း $2");
        t = JsRegex.Compile($"(?<![{D}])\\+\\s*(?={Digit()})", "gu").Replace(t, "အပေါင်း ");
        foreach (var (re, word) in RELATIONAL) t = re.Replace(t, word);
        t = RUNS.Replace(t, " ");

        t = AMPERSAND.Replace(t, " နှင့် ");

        t = DOTTED_INITIALISM.Replace(t, m => DOTS.Replace(m.Value, ""));

        return t;
    }
}
