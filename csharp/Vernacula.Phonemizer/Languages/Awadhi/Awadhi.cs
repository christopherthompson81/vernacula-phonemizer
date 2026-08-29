/**
 * Native Awadhi (awa) text phonemizer — canonical IPA. Reuses the generic Hindi engine (MakeNativeHindi)
 * with an Awadhi manifest, plus the Saksena intervocalic ɖ/ɖʱ → ɽ/ɽʱ flap applied to the engine's output.
 * Ported from src/languages/awadhi/awadhi.ts — see that file for the source and the divergences.
 */
using Vernacula.Phonemizer.Core;
using Vernacula.Phonemizer.Languages.Hindi;

namespace Vernacula.Phonemizer.Languages.Awadhi;

public static class AwadhiPhonemizer
{
    public static readonly HindiDef DEF = LoadManifest.Load<HindiDef>("languages/awadhi", "awadhi.jsonc");

    private const string V = "aəʌɪiʊueɛoɔɐ";
    private static readonly JsRe FLAP = JsRegex.Compile($"(?<=[{V}]ː?)ɖ(ʱ?)(?=[ˈˌ]?[{V}])", "gu");
    private static string Awadhify(string s) => FLAP.Replace(s, "ɽ$1");

    private static NativeHindiEngine? AWA;

    private static NativeHindiEngine Engine(ForeignPhonemizer? foreign = null)
    {
        var b = Hindi.Hindi.MakeNativeHindi(DEF, PhonologyLoader.LoadSharedPhonology(), foreign);
        return new NativeHindiEngine
        {
            Word = w => Awadhify(b.Word(w)),
            WordRules = w => Awadhify(b.WordRules(w)),
            Number = d => Awadhify(b.Number(d)),
            // ⚠ Text() only: a whole-string post-pass, reported to the trace (#1150).
            Text = i => { var pre = b.Text(i); var o = Awadhify(pre); Core.Trace.// ⚠ POSITIONAL (#1150 stage 3): one character for one, so the output spans survive it.
            NoteRewrite("awadhi-flap", pre, o, true); return o; },
        };
    }

    /** Build the Awadhi phonemizer. `foreign` handles embedded Latin runs. */
    public static NativeHindiEngine CreateAwadhi(ForeignPhonemizer? foreign = null) => Engine(foreign);

    /** Bare word→IPA (tests). */
    public static string PhonemizeWord(string w) => (AWA ??= Engine()).Word(w);

    internal static void RegisterSelf() =>
        Registry.Register("awadhi", () => new NativeHindiLanguage(CreateAwadhi(latin => Registry.ReadAsEnglish(latin))));
}
