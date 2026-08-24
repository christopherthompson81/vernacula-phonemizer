/**
 * Tokenizer word-matching derived from Unicode script properties rather than a hand-listed alphabet.
 * Ported from src/core/hostWord.ts — see that file for the corpus evidence.
 */
using System.Text;

namespace Vernacula.Phonemizer.Core;

public static class HostWord
{
    /**
     * Word arm for an engine writing in `scripts`, as a STRING (engines assemble `TOKEN` by template from
     * word, number and punctuation arms).
     *
     * `extra` is lead-legal; `medialOnly` may only join two letters, a distinction that is phonemic (Hausa
     * `'yan` opens on an apostrophe). Both are spliced into character classes, so put a literal `-` LAST.
     */
    // C# PORT NOTE: the returned string is a VERBATIM JS pattern fragment (it still contains
    // `\p{Script=X}`); consumers pass their assembled TOKEN template through JsRegex.Compile, which
    // expands the script properties. The validation below therefore also compiles via JsRegex.
    public static string HostWordRun(IReadOnlyList<string> scripts, string extra = "", string medialOnly = "")
    {
        var letters = string.Concat(scripts.Select(s => $"\\p{{Script={s}}}"));
        // `\p{Script=X}` includes X's DIGITS (N'Ko ߀–߉, Adlam 𞥐–𞥙), and the word arm runs before the number
        // arm, so without this the word arm would swallow every native-digit numeral. `--\p{Nd}` would need
        // the `v` flag, which these tokenizers do not use.
        const string nd = "(?!\\p{Nd})";
        var run = $"{nd}[{letters}{extra}](?:{nd}[{letters}\\p{{M}}{extra}{medialOnly}])*";
        // Compile now so a malformed class fails here, named, rather than at first use: a misplaced `-`
        // becomes a RANGE. ⚠ VALIDATE BUT NEVER REWRITE — relocating hyphens would collapse the legitimate
        // ranges Serbian and Bosnian pass, silently dropping twenty-two letters.
        try
        {
            JsRegex.Compile(run, "u");
        }
        catch (Exception e)
        {
            throw new InvalidOperationException(
                $"hostWordRun: extra=\"{extra}\" medialOnly=\"{medialOnly}\" does not form a " +
                $"valid character class (put a literal \"-\" LAST; a range like \"а-ш\" is fine as written): {e}");
        }
        return run;
    }

    /**
     * The Latin word arm — the overwhelmingly common case, spelled once so call sites do not repeat the
     * array.
     */
    public static readonly string LATIN_RUN = HostWordRun(new[] { "Latin" });

    /** Letters NFD cannot reach, mapped to the nearest base every Latin g2p has a rule for. */
    private static readonly IReadOnlyDictionary<string, string> UNDECOMPOSABLE = new Dictionary<string, string>
    {
        ["æ"] = "a", ["Æ"] = "A", ["œ"] = "o", ["Œ"] = "O", ["ø"] = "o", ["Ø"] = "O", ["ð"] = "d", ["Ð"] = "D", ["þ"] = "t", ["Þ"] = "T",
        ["ß"] = "ss", ["ł"] = "l", ["Ł"] = "L", ["đ"] = "d", ["Đ"] = "D", ["ħ"] = "h", ["Ħ"] = "H", ["ŋ"] = "n", ["Ŋ"] = "N",
        ["ɛ"] = "e", ["Ɛ"] = "E", ["ɔ"] = "o", ["Ɔ"] = "O", ["ə"] = "e", ["Ə"] = "E", ["ɓ"] = "b", ["Ɓ"] = "B", ["ɗ"] = "d", ["Ɗ"] = "D",
        ["ƙ"] = "k", ["Ƙ"] = "K", ["ƴ"] = "y", ["Ƴ"] = "Y", ["ı"] = "i", ["ʉ"] = "u", ["ɨ"] = "i", ["ƀ"] = "b", ["ŧ"] = "t", ["ſ"] = "s",
        ["ƒ"] = "f", ["Ƒ"] = "F", // f with hook — /f/ in the African orthographies that use it (and the florin sign)
    };

    private static readonly JsRe UNDECOMPOSABLE_RE =
        JsRegex.Compile("[" + string.Concat(UNDECOMPOSABLE.Keys) + "]", "gu");

    private static readonly JsRe MarksRun = JsRegex.Compile("\\p{M}+", "gu");

    /**
     * Drop combining marks so precomposed and decomposed accents behave alike, then map what NFD cannot
     * reach.
     */
    public static string FoldLatinToBase(string w) =>
        UNDECOMPOSABLE_RE.Replace(
            MarksRun.Replace(w.Normalize(NormalizationForm.FormD), "")
                .Normalize(NormalizationForm.FormC),
            c => UNDECOMPOSABLE.TryGetValue(c.Value, out var v) ? v : c.Value);

    /**
     * One base character with any combining marks that belong to it — the unit a fold decision is made about.
     */
    private static readonly JsRe CLUSTER = JsRegex.Compile("\\P{M}\\p{M}*", "gu");

    /** Conditional fold for a nativising engine, judged PER CLUSTER and never per word: a word-level test
     *  fails on one foreign letter and then flattens the native ones too. */
    public static Func<string, string> MakeNativiser(string nativeClass, string flags = "u")
    {
        var inClass = JsRegex.Compile($"^(?:{nativeClass})+$", flags);
        /** NFC then `+`, so the test is "every character is in the inventory". ⚠ `+` rather than one
         *  occurrence, because a cluster is base plus marks and not every mark composes; and NFC only,
         *  never also NFD, or a decomposed `ñ` would be judged native and emitted raw. */
        bool Known(string s) => inClass.IsMatch(s.Normalize(NormalizationForm.FormC));
        return w =>
        {
            if (Known(w)) return w;
            var sb = new StringBuilder();
            foreach (System.Text.RegularExpressions.Match m in CLUSTER.Matches(w))
                sb.Append(Known(m.Value) ? m.Value : FoldLatinToBase(m.Value));
            return sb.ToString();
        };
    }
}
