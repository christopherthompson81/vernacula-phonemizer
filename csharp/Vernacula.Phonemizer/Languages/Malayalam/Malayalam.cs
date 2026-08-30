/**
 * Native Malayalam (ml) text phonemizer — canonical IPA. A Dravidian Brahmic abugida read by the generic
 * engine (Core/Abugida.cs) with NO inherent-vowel deletion, plus the Malayalam-specific handling: chillu
 * letters, samvritokaram, word-final anusvara, gemination, intervocalic voicing and first-syllable stress.
 * Ported from src/languages/malayalam/malayalam.ts — see that file for the corpus evidence.
 */
using System.Text;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Malayalam;

/** Read a Latin run with another language's engine — injected from the registry. */
public delegate string ForeignPhonemizer(string latin);

public sealed class MalayalamPhonemizer : ILanguage
{
    private static MalayalamManifest DEF => Manifest.MANIFEST;
    private static IReadOnlyDictionary<string, string> CLAUSE_MARK => DEF.ClausePunctuation;
    private const string MALAYALAM_WORD = "ഀ-ൿ"; // Malayalam block (digits handled separately)
    private static readonly IReadOnlyDictionary<string, string> MALAYALAM_DIGITS = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["൦"] = "0", ["൧"] = "1", ["൨"] = "2", ["൩"] = "3", ["൪"] = "4",
        ["൫"] = "5", ["൬"] = "6", ["൭"] = "7", ["൮"] = "8", ["൯"] = "9",
    };
    private static readonly string DIGIT_CLASS = "0-9" + string.Concat(MALAYALAM_DIGITS.Keys);
    private const string VOWEL = "aeiouɨ"; // NOT ɾ — a word-onset ര is not a nucleus
    private const string VIRAMA = "്"; // chandrakkala

    /** Chillu (pure-consonant) letters → base consonant + virama, so the engine reads them as bare codas. */
    private static readonly IReadOnlyDictionary<string, string> CHILLU = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["ൺ"] = "ണ" + VIRAMA,
        ["ൻ"] = "ന" + VIRAMA,
        ["ർ"] = "ര" + VIRAMA,
        ["ൽ"] = "ല" + VIRAMA,
        ["ൾ"] = "ള" + VIRAMA,
        ["ൿ"] = "ക" + VIRAMA,
        ["ൔ"] = "ന" + VIRAMA, ["ൕ"] = "ല" + VIRAMA, ["ൖ"] = "ന" + VIRAMA, // rare historic chillus
    };
    private static readonly JsRe CHILLU_RE = JsRegex.Compile($"[{string.Concat(CHILLU.Keys)}]", "gu");

    private static Func<string, string>? G2P;
    private static string G2p(string w) => (G2P ??= Abugida.MakeAbugidaG2P(DEF, PhonologyLoader.LoadSharedPhonology()))(w);

    /** Voiceless plosive/affricate → its voiced counterpart (the intervocalic/post-nasal sonorization rule). */
    private static readonly IReadOnlyDictionary<string, string> VOICE = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["k"] = "ɡ", ["t̪"] = "d̪", ["ʈ"] = "ɖ", ["t͡ʃ"] = "d͡ʒ", ["p"] = "b",
    };

    private static readonly JsRe GEMINATE = JsRegex.Compile(
        "(t͡ʃʰ|d͡ʒʱ|t͡ʃ|d͡ʒ|t̪ʰ|d̪ʱ|ʈʰ|ɖʱ|ɡʱ|kʰ|t̪|d̪|[kɡpbmnlʃʂsʈɖɳɭɲŋjɦhʋɾr])\\1(?!͡)", "gu");
    private static readonly JsRe LENGTH_ASPIRATE = JsRegex.Compile("ː([ʰʱ])", "gu");
    private static readonly JsRe RETROFLEX_GEM = JsRegex.Compile("ɭl", "gu");
    private static readonly JsRe ANUSVARA_M = JsRegex.Compile("ം(?=[ശഷസഹയരറലവഴള]|$)", "gu");
    private static readonly JsRe INTERVOCALIC = JsRegex.Compile("(?<=[aeiouɨɐ̃ː])(k|t̪|ʈ|t͡ʃ|p)(?=[aeiouɨɐ])", "gu");
    private static readonly JsRe RETROFLEX_POSTNASAL = JsRegex.Compile("ɳʈ(?![ʰː])", "gu");
    private static readonly JsRe FIRST_VOWEL = JsRegex.Compile($"[{VOWEL}]", "u");

    /** One Malayalam word → canonical IPA. */
    public static string PhonemizeWord(string word)
    {
        var norm = Js.Normalize(word, NormalizationForm.FormC);
        // SAMVRITOKARAM detected BEFORE chillu expansion — a chillu-final word ends in the chillu char, not
        // in ്, so it correctly does NOT take the [ɨ].
        var samvrit = norm.EndsWith(VIRAMA, StringComparison.Ordinal);
        norm = JsRegex.Replace(norm, CHILLU_RE, m => CHILLU[m.Value]);
        norm = JsRegex.Replace(norm, ANUSVARA_M, _ => "മ" + VIRAMA);
        var x = G2p(norm);
        x = LENGTH_ASPIRATE.Replace(GEMINATE.Replace(x, "$1ː"), "$1ː");
        x = RETROFLEX_GEM.Replace(x, "ɭː"); // ള്ള → geminate retroflex [ɭː]
        // Applied BEFORE the samvritokaram [ɨ] is appended, so a word-final stop stays voiceless.
        x = JsRegex.Replace(x, INTERVOCALIC, m => VOICE[m.Groups[1].Value]);
        x = RETROFLEX_POSTNASAL.Replace(x, "ɳɖ");
        if (samvrit) x += "ɨ";
        var m2 = FIRST_VOWEL.Match(x);
        if (m2.Success) x = x[..m2.Index] + "ˈ" + x[m2.Index..];
        return x.Normalize(NormalizationForm.FormC);
    }

    private static string ToAscii(string d) =>
        string.Concat(Js.CodePoints(d).Select(c => MALAYALAM_DIGITS.TryGetValue(c, out var a) ? a : c));

    private static string Number(string digits)
    {
        var n = Js.Number(ToAscii(digits));
        // Past 2^53 the low digits are gone, so the composed numeral would be wrong. Read digit-at-a-time
        // THROUGH THE SAME COMPOSER — the raw ASCII digits must never leak into the IPA.
        if (!(double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d))
            return string.Join(" ", Js.CodePoints(ToAscii(digits))
                .SelectMany(d => NumbersMl.NumberToWords(Js.Number(d)).Split(' '))
                .Select(PhonemizeWord));
        return string.Join(" ", NumbersMl.NumberToWords(n).Split(' ').Select(PhonemizeWord));
    }

    // The foreign arm is LATIN_RUN — ALL of Latin plus marks, not `[A-Za-z]+`, which ended the token at a
    // diacritic and left that letter to be read as an English letter name.
    private static readonly JsRe TOKEN = JsRegex.Compile(
        $"([{MALAYALAM_WORD}]+)|({HostWord.LATIN_RUN})|([{DIGIT_CLASS}]+)|([।॥.?!,;:])", "gu");

    private readonly ForeignPhonemizer? _foreign;

    public MalayalamPhonemizer(ForeignPhonemizer? foreign = null) => _foreign = foreign;

    public string Text(string input)
    {
        // Normalize.cs runs FIRST, then the native-digit fold: the number token is `\d+`, ASCII-only in JS,
        // so a numeral in native digits matched no token at all and was dropped.
        return Clauses.AssembleClauses(Unicode.FoldNativeDigits(Normalize.NormalizeMalayalam(input)), TOKEN, (m, sink) =>
        {
            if (m.Groups[1].Success && m.Groups[1].Value.Length > 0) sink.Emit(PhonemizeWord(m.Groups[1].Value));
            else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0) sink.Emit(_foreign is not null ? _foreign(m.Groups[2].Value) : "");
            else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0) sink.Emit(Number(m.Groups[3].Value));
            else if (m.Groups[4].Success && m.Groups[4].Value.Length > 0)
            {
                if (CLAUSE_MARK.TryGetValue(m.Groups[4].Value, out var mk) && mk.Length > 0) sink.Pause(mk);
            }
        });
    }

    /** Build the Malayalam phonemizer. `foreign` handles embedded Latin runs. */
    public static ILanguage CreateMalayalam(ForeignPhonemizer? foreign = null) => new MalayalamPhonemizer(foreign);

    internal static void RegisterSelf() =>
        Registry.Register("malayalam", () => CreateMalayalam(latin => Registry.ReadAsEnglish(latin)));
}
