/**
 * Native Sylheti / ꠍꠤꠟꠐꠤ ꠘꠣꠉꠞꠤ (syl) text phonemizer — canonical IPA. The Syloti Nagri abugida is read by the
 * generic engine (Core/Abugida.cs); this file adds geminate → length, the Bengali-style inherent-vowel
 * deletion, and the Indic cardinal composer. Tone (H/L) is unwritten → deferred.
 * Ported from src/languages/sylheti/sylheti.ts — see that file for the corpus evidence.
 */
using System.Text;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Sylheti;

public sealed class SylhetiDef : AbugidaDef
{
    public NumbersDef Numbers { get; set; } = new();
    public Dictionary<string, string> ClausePunctuation { get; set; } = new();
}

public sealed class SylhetiPhonemizer : ILanguage
{
    public static readonly SylhetiDef DEF = LoadManifest.Load<SylhetiDef>("languages/sylheti", "sylheti.jsonc");
    private static IReadOnlyDictionary<string, string> CLAUSE_MARK => DEF.ClausePunctuation;

    private static readonly JsRe VOWEL_G = JsRegex.Compile("[aeiouɔ]", "gu");
    /** Geminate consonant (doubled base, possibly aspirated) → single + length ː. */
    private static readonly JsRe GEMINATE = JsRegex.Compile("(t̪|d̪|ʈ|ɖ|[xszʃɸfbɡmnlɾɽjɦ])\\1(?!͡)", "gu");
    private static readonly JsRe LENGTH_ASPIRATE = JsRegex.Compile("ː([ʰʱ])", "gu");
    private static readonly JsRe CODA_STRIP = JsRegex.Compile("[ʰʱ̪͡ː̃]", "gu");

    private static Func<string, string>? G2P;
    private static string G2p(string w) => (G2P ??= Abugida.MakeAbugidaG2P(DEF, PhonologyLoader.LoadSharedPhonology()))(w);

    /** Word-final inherent /ɔ/: drop after a single light coda (…VCɔ → …VC), retain as [o] after a heavy coda. */
    private static string DeleteFinalInherent(string ipa)
    {
        if (!ipa.EndsWith("ɔ", StringComparison.Ordinal)) return ipa;
        var body = ipa[..^1];
        var vs = JsRegex.MatchAll(VOWEL_G, body);
        if (vs.Count == 0) return body;
        var tail = body[(vs[^1].Index + 1)..];
        var coda = CODA_STRIP.Replace(tail, "");
        return tail.Contains('ː') || coda.Length >= 2 ? body + "o" : body;
    }

    /** One Sylheti word → canonical IPA (rules only; tone deferred). */
    public static string PhonemizeWord(string word)
    {
        var x = G2p(Js.Normalize(word, NormalizationForm.FormC));
        x = LENGTH_ASPIRATE.Replace(GEMINATE.Replace(x, "$1ː"), "$1ː");
        var syls = JsRegex.MatchAll(VOWEL_G, x).Count;
        if (syls >= 2) x = DeleteFinalInherent(x);
        x = Schwa.DeleteMedialSchwa(x, "ɔ");
        return x.Normalize(NormalizationForm.FormC);
    }

    /** A run of ASCII digits → the spoken Sylheti cardinal in canonical IPA (Indic 2-2-3 lakh/crore grouping). */
    private static string Number(string digits)
    {
        var n = Js.Number(digits);
        // ⚠ Above 2^53 the double has lost its low digits, so the composer must refuse — but the refusal
        // reads the run digit-at-a-time rather than returning the raw ASCII, which no g2p in this fleet reads.
        if (!(double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d))
            return Numbers.SpellDigits(digits, DEF.Numbers, PhonemizeWord);
        return Numbers.RenderNumber(n, DEF.Numbers, PhonemizeWord, Numbers.indicNumberWords);
    }

    // ⚠ THE WORD CLASS IS U+A800–A827 PLUS U+A82C, NOT THE WHOLE BLOCK: ꠨ ꠩ ꠪ ꠫ (U+A828–A82B) are the
    // poetry marks, and the word alternative is FIRST, so widening this class makes the punctuation arm
    // unreachable for them. See sylheti.ts for the defect this encodes.
    private static readonly JsRe TOKEN = JsRegex.Compile("([ꠀ-ꠧ꠬]+)|(\\d+)|([꠨꠩꠪꠫।॥৷⁕.?!,])", "gu");

    public string Text(string input)
    {
        return Clauses.AssembleClauses(Normalize.NormalizeSylheti(input), TOKEN, (m, sink) =>
        {
            if (m.Groups[1].Success && m.Groups[1].Value.Length > 0) sink.Emit(PhonemizeWord(m.Groups[1].Value));
            else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0) sink.Emit(Number(m.Groups[2].Value));
            else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
            {
                if (CLAUSE_MARK.TryGetValue(m.Groups[3].Value, out var mk) && mk.Length > 0) sink.Pause(mk);
            }
        });
    }

    /** Build the Sylheti phonemizer (Syloti Nagri abugida + Indic cardinals; tone deferred). */
    public static ILanguage CreateSylheti() => new SylhetiPhonemizer();

    internal static void RegisterSelf() => Registry.Register("sylheti", () => CreateSylheti());
}
