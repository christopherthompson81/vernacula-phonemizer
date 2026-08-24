/**
 * Native Assamese (as) text phonemizer — canonical IPA. Eastern Indo-Aryan, Bengali-Assamese
 * script. Reuses the Bengali engine (makeNativeBengali — the generic abugida scan + ɔ→o height harmony +
 * inherent-vowel deletion + geminate→length, all shared Eastern-Indic phonology) with an Assamese manifest whose
 * phoneme values carry the divergences from Bengali: the three sibilants শ/ষ/স → [x] (velar fricative — the
 * signature), deaffrication চ/ছ→[s] জ/ঝ→[z], the alveolar merger (no retroflex/dental split → plain t/tʰ/d/dʱ),
 * and the extra letters ৰ→[ɹ], ৱ→[w]. The Assamese geminate consonants (t/d/s/z/x) that the Bengali engine's
 * geminate set does not cover are collapsed to length here.
 */
using Vernacula.Phonemizer.Core;
using Vernacula.Phonemizer.Languages.Bengali;

namespace Vernacula.Phonemizer.Languages.Assamese;

public static class Assamese
{
    // Assamese-specific geminate → length: the Bengali engine collapses only its own phoneme set (t͡ʃ, d̪, ʃ, …); the
    // Assamese consonants that result from deaffrication + the alveolar merger (t tʰ d dʱ s z x) need their own pass.
    // A doubled base (optionally aspirated) → single + length ː; guard against a tie bar (there are none here, but
    // keep it parallel to the fleet convention).
    private static readonly JsRe AS_GEMINATE = JsRegex.Compile("(tʰ|dʱ|[tdszxpbkɡmnlŋ])\\1", "gu");
    private static readonly JsRe LENGTH_AFTER_ASPIRATION = JsRegex.Compile("ː([ʰʱ])", "gu");

    // Collapse, then reorder length AFTER a trailing breathy/aspiration mark so an aspirated geminate is Cʰː/Cʱː,
    // NOT the stranded Cːʰ (যুদ্ধ d+dʱ → dʱː, not dːʱ) — the same reorder the Bengali engine pairs with its own set.
    private static string CollapseGeminates(string ipa) =>
        LENGTH_AFTER_ASPIRATION.Replace(AS_GEMINATE.Replace(ipa, "$1ː"), "$1ː");

    private static NativeBengaliEngine Wrap(NativeBengaliEngine b) => new()
    {
        Word = (w, oov) => CollapseGeminates(b.Word(w, oov)),
        WordRules = w => CollapseGeminates(b.WordRules(w)),
        Number = (d, oov) => CollapseGeminates(b.Number(d, oov)),
        Text = (i, oov) => CollapseGeminates(b.Text(i, oov)),
    };

    /** Load assamese.jsonc (beside this file) and build the Assamese phonemizer. `foreign` handles embedded Latin. */
    public static NativeBengaliEngine CreateAssamese(Func<string, string>? foreign = null)
    {
        var b = Bengali.Bengali.MakeNativeBengali(
            LoadManifest.Load<BengaliDef>("languages/assamese", "assamese.jsonc"),
            PhonologyLoader.LoadSharedPhonology(),
            foreign);
        // the Assamese PRE-PASS runs BEFORE makeNativeBengali's text(), which internally runs the
        // Bengali normalize + symbol tier. This pass handles only the Assamese-specific classes (শ ordinals,
        // নং, dotted runs, version dots, currency codes, &, regnal II); the Bengali layer below it owns the
        // shared digit-folding / ordinal / clock / decimal machinery.
        var baseText = b.Text;
        return Wrap(new NativeBengaliEngine
        {
            Word = b.Word,
            WordRules = b.WordRules,
            Number = b.Number,
            Text = (i, oov) => baseText(Normalize.NormalizeAssamese(i), oov),
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
