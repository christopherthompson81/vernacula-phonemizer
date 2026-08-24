/**
 * Native Assamese (as) text phonemizer — canonical IPA.
 * Ported from src/languages/assamese/assamese.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;
using Vernacula.Phonemizer.Languages.Bengali;

namespace Vernacula.Phonemizer.Languages.Assamese;

public static class Assamese
{
    private static readonly JsRe AS_GEMINATE = JsRegex.Compile("(tʰ|dʱ|[tdszxpbkɡmnlŋ])\\1", "gu");
    private static readonly JsRe LENGTH_AFTER_ASPIRATION = JsRegex.Compile("ː([ʰʱ])", "gu");

    private static string CollapseGeminates(string ipa) =>
        LENGTH_AFTER_ASPIRATION.Replace(AS_GEMINATE.Replace(ipa, "$1ː"), "$1ː");

    // ⚠ THE OOV RESOLVER IS DROPPED ON EVERY ARM, as in the TS, whose `wrap` members are arity-1 arrows —
    // the Assamese surface is oov-blind by construction. Forwarding it would change the ported contract.
    private static NativeBengaliEngine Wrap(NativeBengaliEngine b) => new()
    {
        Word = (w, _) => CollapseGeminates(b.Word(w, null)),
        WordRules = w => CollapseGeminates(b.WordRules(w)),
        Number = (d, _) => CollapseGeminates(b.Number(d, null)),
        Text = (i, _) => CollapseGeminates(b.Text(i, null)),
    };

    /**
     * Load assamese.jsonc (beside this file) and build the Assamese phonemizer. `foreign` handles embedded
     * Latin.
     */
    public static NativeBengaliEngine CreateAssamese(Func<string, string>? foreign = null)
    {
        var b = Bengali.Bengali.MakeNativeBengali(
            LoadManifest.Load<BengaliDef>("languages/assamese", "assamese.jsonc"),
            PhonologyLoader.LoadSharedPhonology(),
            foreign);
        var baseText = b.Text;
        return Wrap(new NativeBengaliEngine
        {
            Word = b.Word,
            WordRules = b.WordRules,
            Number = b.Number,
            Text = (i, _) => baseText(Normalize.NormalizeAssamese(i), null),
        });
    }

    private static NativeBengaliEngine? AS;

    /** Bare word→IPA (tests / eval). */
    public static string PhonemizeWord(string w) =>
        (AS ??= Wrap(Bengali.Bengali.MakeNativeBengali(
            LoadManifest.Load<BengaliDef>("languages/assamese", "assamese.jsonc")))).Word(w, null);

    private sealed class AssameseLanguage : ILanguage
    {
        private readonly NativeBengaliEngine _engine;
        internal AssameseLanguage(NativeBengaliEngine engine) => _engine = engine;
        public string Text(string input) => _engine.Text(input, null);
    }

    internal static void RegisterSelf() =>
        Registry.Register("assamese", () => new AssameseLanguage(CreateAssamese(Registry.ReadAsEnglish)));
}
