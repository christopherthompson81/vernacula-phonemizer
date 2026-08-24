/**
 * Kalaallisut / West Greenlandic (kl) phonemizer — a near-1:1 phonemic scan.
 * Ported from src/languages/kalaallisut/kalaallisut.ts — see that file for the corpus evidence.
 */
using System.Text;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Kalaallisut;

public sealed class KalaallisutDef
{
    public IReadOnlyDictionary<string, string> Vowels { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Consonants { get; init; } = new Dictionary<string, string>();
}

public sealed class KalaallisutPhonemizer : ILanguage
{
    private static readonly KalaallisutDef DEF =
        LoadManifest.Load<KalaallisutDef>("languages/kalaallisut", "kalaallisut.jsonc");

    private static IReadOnlyDictionary<string, string> VOWEL => DEF.Vowels;
    private static IReadOnlyDictionary<string, string> CONS => DEF.Consonants;
    private static bool IsVowelChar(string c) => VOWEL.ContainsKey(c);

    /**
     * Phonemize one Kalaallisut word → canonical IPA (near-1:1 scan; doubled letter → length; ng/nng → ŋ/ŋː).
     */
    public static string PhonemizeWord(string word)
    {
        var w = word.Normalize(NormalizationForm.FormC).ToLowerInvariant();
        var chars = Js.CodePoints(w);
        var outp = new List<string>();
        for (var i = 0; i < chars.Count; i++)
        {
            string c = chars[i],
                nx = i + 1 < chars.Count ? chars[i + 1] : "",
                nx2 = i + 2 < chars.Count ? chars[i + 2] : "";
            // Longest-match: ⟨nng⟩ → [ŋː] must be tried before ⟨ng⟩ → [ŋ], or the first ⟨n⟩ is read alone.
            if (c == "n" && nx == "n" && nx2 == "g") { outp.Add("ŋː"); i += 2; continue; }
            if (c == "n" && nx == "g") { outp.Add("ŋ"); i += 1; continue; }
            // Keyed on the same GRAPHEME (c == nx), not on the same phone: heterographic ⟨ei⟩/⟨ou⟩ both map
            // to /i u/ and must NOT collapse to one long vowel.
            if (IsVowelChar(c) && c == nx) { outp.Add(VOWEL[c] + "ː"); i += 1; continue; }
            if (IsVowelChar(c)) { outp.Add(VOWEL[c]); continue; }
            if (CONS.ContainsKey(c) && c == nx) { outp.Add(CONS[c] + "ː"); i += 1; continue; }
            if (CONS.TryGetValue(c, out var cp)) { outp.Add(cp); continue; }
            // Fall-through, reached only when every rule above has declined: a letter with no rule still
            // denotes a sound, so read it generically rather than dropping it.
            var p = LatinPhones.LatinPhone(c, new PhoneOpts { Initial = i == 0, IncludeH = true });
            if (p is not null) outp.Add(p);
        }
        return string.Concat(outp);
    }

    private static readonly JsRe TOKEN = JsRegex.Compile(
        $"({HostWord.HostWordRun(new[] { "Latin" }, "'’-")})|(\\d+)|([.!?…,;:])", "gu");

    /** This language's OWN inventory. */
    private const string NATIVE_CLASS = "[a-zæøåA-ZÆØÅ'’-]";
    private static readonly Func<string, string> Nat = HostWord.MakeNativiser(NATIVE_CLASS, "u");

    public string Text(string input)
    {
        return Clauses.AssembleClauses(Normalize.NormalizeKalaallisut(input), TOKEN, (m, sink) =>
        {
            if (m.Groups[1].Success && m.Groups[1].Value.Length > 0) sink.Emit(PhonemizeWord(Nat(m.Groups[1].Value)));
            else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
            {
                // ≤12 digits stays inside the attested range (< 10¹²); longer reads the raw digit string, so
                // the JS-`Number` conversion (Js.Number) can't lose precision.
                var digits = m.Groups[2].Value;
                var words = digits.Length <= 12 ? Numbers.NumberToWords(Js.Number(digits)) : Numbers.ReadDigits(digits);
                foreach (var wd in words.Split(' ')) sink.Emit(PhonemizeWord(wd));
            }
            else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
            {
                var mk = m.Groups[3].Value;
                sink.Pause(mk == "." || mk == "!" || mk == "?" ? mk : ",");
            }
        });
    }

    /** Build the Kalaallisut phonemizer (near-1:1 phonemic scan). */
    public static ILanguage CreateKalaallisut() => new KalaallisutPhonemizer();

    internal static void RegisterSelf() => Registry.Register("kalaallisut", CreateKalaallisut);
}
