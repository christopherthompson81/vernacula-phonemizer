/**
 * Tokenizer word-matching derived from Unicode script properties rather than a hand-listed alphabet.
 *
 * A word arm answers two questions with different scopes, and this module keeps them apart:
 *
 *   1. `hostWordRun` — is this run in a script the engine writes? A ROUTING question, a property of the script.
 *   2. `makeNativiser` — does the g2p have rules for these letters? An INVENTORY question, per-language.
 *
 * Answering (1) with a letter list (`/[a-zäöüßA-ZÄÖÜ]+/`) cuts any word containing an omitted letter: the orphan
 * reaches the shared router, which reads it as an English letter name (`Cañitas` → `kaː ˈɛn ˈiːtaːs`). Nothing
 * vanishes and no raw mark survives, so neither the leak classes nor the differential DROP test catches it.
 *
 * Routing only fires ACROSS scripts, so it cannot help a Latin word inside a Latin language — there the g2p simply
 * has no rule for `ã` and drops it (`Klöcker` → *klkkeɾ*). That is what (2) folds.
 *
 * Which does an engine need? Phonemize an English loan (`computer`): output matching English means it ROUTES and
 * `hostWordRun` suffices; its own output means it NATIVISES and also needs `makeNativiser`. Engines vary too much
 * structurally to identify by source pattern — `test/latin-tokenizers.test.ts` is the measurement.
 */
using System.Text;

namespace Vernacula.Phonemizer.Core;

public static class HostWord
{
    /**
     * Word arm for an engine writing in `scripts`, as a STRING (engines assemble `TOKEN` by template from word,
     * number and punctuation arms).
     *
     * `extra` is lead-legal; `medialOnly` may only join two letters. The distinction is phonemic: Hausa `'yan` opens
     * on an apostrophe for glottalised /ʲ/, and requiring a letter first drops it (`ʔʲan` → *jan*). Both are spliced
     * into character classes, so put a literal `-` LAST.
     */
    // C# PORT NOTE: the returned string is a VERBATIM JS pattern fragment (it still contains
    // `\p{Script=X}`); consumers pass their assembled TOKEN template through JsRegex.Compile, which
    // expands the script properties. The validation below therefore also compiles via JsRegex.
    public static string HostWordRun(IReadOnlyList<string> scripts, string extra = "", string medialOnly = "")
    {
        var letters = string.Concat(scripts.Select(s => $"\\p{{Script={s}}}"));
        // `\p{Script=X}` includes X's DIGITS (N'Ko ߀–߉, Adlam 𞥐–𞥙), and the word arm runs before the number arm, so
        // without this the word arm would swallow every native-digit numeral. `--\p{Nd}` needs the `v` flag, which
        // these tokenizers do not use.
        const string nd = "(?!\\p{Nd})";
        var run = $"{nd}[{letters}{extra}](?:{nd}[{letters}\\p{{M}}{extra}{medialOnly}])*";
        // Compile now so a malformed class fails here, named, rather than at first use: a misplaced `-` becomes a
        // RANGE (`"-·"` → `[\p{M}-·]`, a SyntaxError). Validate but never rewrite — relocating hyphens would collapse
        // the legitimate ranges Serbian and Bosnian pass (`"а-шђјљњћџ"`), silently dropping twenty-two letters.
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

    /** The Latin word arm — the overwhelmingly common case, spelled once so call sites do not repeat the array. */
    public static readonly string LATIN_RUN = HostWordRun(new[] { "Latin" });

    /**
     * Letters NFD cannot reach, mapped to the nearest base every Latin g2p has a rule for. `ö` decomposes and folds
     * itself; these have no decomposition, so without the map they are dropped outright (`Æthelred` → *thˈɛlʁət*).
     *
     * Single letters, not the conventional digraphs (`æ`→ae, `þ`→th): a g2p reading `ae` as two vowels turns one sound
     * into two, worse than an imprecise vowel. `ß`→`ss` is the exception — that is the German orthographic identity.
     * A language for which one of these is NATIVE never reaches here; the fold is conditional, so Akan keeps `ɛ`.
     */
    // prettier-ignore
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

    /** Drop combining marks so precomposed and decomposed accents behave alike, then map what NFD cannot reach. */
    public static string FoldLatinToBase(string w) =>
        UNDECOMPOSABLE_RE.Replace(
            MarksRun.Replace(w.Normalize(NormalizationForm.FormD), "")
                .Normalize(NormalizationForm.FormC),
            c => UNDECOMPOSABLE.TryGetValue(c.Value, out var v) ? v : c.Value);

    /** One base character with any combining marks that belong to it — the unit a fold decision is made about. */
    private static readonly JsRe CLUSTER = JsRegex.Compile("\\P{M}\\p{M}*", "gu");

    /**
     * Conditional fold for a nativising engine. `nativeClass` matches exactly the letters this g2p has rules for.
     *
     * Judged PER CLUSTER, never per word: Turkish `İsveç` fails a word-level test on `İ`, and folding the whole word
     * would also flatten `ç`→`c`, which Turkish reads /d͡ʒ/ (*ɯsvˈed͡ʒ*).
     */
    public static Func<string, string> MakeNativiser(string nativeClass, string flags = "u")
    {
        var inClass = JsRegex.Compile($"^(?:{nativeClass})+$", flags);
        /**
         * NFC then `+`, so the test is "every character is in the inventory".
         *
         * `+` rather than one occurrence: a cluster is base plus marks, and not every mark composes — Tâi-lô tone 8
         * (base + U+030D) has no precomposed form, so requiring a single match strips the tone it should protect
         * (`ta̍k` → *tak*). NFC only, never also NFD: `ñ` decomposes to `n` + U+0303, which falls inside Tâi-lô's
         * `̀-̍`, so testing the decomposed form would judge `ñ` native and emit it raw (`Cañitas` → *cañitas˥*).
         */
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
