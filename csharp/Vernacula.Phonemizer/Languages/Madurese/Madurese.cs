/**
 * Madurese / Bhâsa Madhurâ (mad) phonemizer — Austronesian, the 2008-revision Latin orthography, canonical
 * IPA. Not a grapheme map: vowel-register harmony, glide/glottal epenthesis, final devoicing, geminates.
 * Ported from src/languages/madurese/madurese.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Madurese;

/** A tokenized segment: a consonant with its register class, or a vowel with its low/high realisations. */
public sealed class Seg
{
    public required bool IsVowel { get; init; }
    public string Ipa { get; set; } = "";
    public string RegClass { get; init; } = "";
    public string Low { get; init; } = "";
    public string High { get; init; } = "";
}

public static class MaduresePhonemizer
{
    private static IReadOnlyDictionary<string, string[]> VSPEC => Manifest.MANIFEST.VowelSpec;
    private static IReadOnlyDictionary<string, string> DEVOICE => Manifest.MANIFEST.FinalDevoice;
    private static IReadOnlyDictionary<string, string> CLAUSE_MARK => Manifest.MANIFEST.ClausePunctuation;

    /** TS `w.startsWith(key, i)`. */
    private static bool StartsWithAt(string w, string search, int i) =>
        i <= w.Length - search.Length && string.CompareOrdinal(w, i, search, 0, search.Length) == 0;

    private static bool IsConsLetter(string ch) => Manifest.CONS.ContainsKey(ch) || ch == "h";

    private static readonly IReadOnlyDictionary<string, double> HEIGHT = new Dictionary<string, double>(StringComparer.Ordinal)
    {
        ["a"] = 0, ["ɛ"] = 1, ["ə"] = 1, ["ɔ"] = 1, ["e"] = 1, ["i"] = 2, ["u"] = 2,
    };

    private static bool IsFront(string u) => u == "i" || u == "ɛ" || u == "e";

    private static double Height(string v) => HEIGHT.TryGetValue(v, out var h) ? h : 0;

    /** Tokenize a word into consonant/vowel segments, expanding geminates to a length-marked consonant. */
    private static List<Seg> Tokenize(string w)
    {
        var segs = new List<Seg>();
        var i = 0;
        var geminate = false;
        while (i < w.Length)
        {
            // TS indexes UTF-16 units (`w[i]`), and `w[i + 1]` past the end is `undefined` — never equal.
            var here = w[i].ToString();
            if (i + 1 < w.Length && w[i] == w[i + 1] && IsConsLetter(here))
            {
                geminate = true;
                i += 1;
                continue;
            }
            var matched = false;
            foreach (var key in Manifest.CONS_KEYS)
            {
                if (!StartsWithAt(w, key, i)) continue;
                var c = Manifest.CONS[key];
                var ipa = c.Ipa;
                if (geminate)
                {
                    if (c.Ipa != "l" && c.Ipa != "ɾ") ipa += "ː"; // liquids degeminate
                    geminate = false;
                }
                segs.Add(new Seg { IsVowel = false, Ipa = ipa, RegClass = c.RegClass });
                i += key.Length;
                matched = true;
                break;
            }
            if (matched) continue;
            foreach (var key in Manifest.VOWEL_KEYS)
            {
                if (!StartsWithAt(w, key, i)) continue;
                var spec = VSPEC[key];
                segs.Add(new Seg { IsVowel = true, Low = spec[0], High = spec[1] });
                i += key.Length;
                matched = true;
                break;
            }
            if (!matched)
            {
                geminate = false;
                var ph = LatinPhones.LatinPhone(here, new PhoneOpts { Initial = i == 0, IncludeH = true });
                if (ph is not null) segs.Add(new Seg { IsVowel = false, Ipa = ph, RegClass = Reg.Low });
                i += 1;
            }
        }
        return segs;
    }

    /** Insert epenthetic glides/glottal between adjacent vowels (Madurese vowel hiatus). */
    private static List<Seg> Epenthesize(List<Seg> segs)
    {
        var outp = new List<Seg>();
        for (var k = 0; k < segs.Count; k++)
        {
            outp.Add(segs[k]);
            var a = segs[k];
            var b = k + 1 < segs.Count ? segs[k + 1] : null;
            // Decisions use the LOW (underlying) vowel quality — hiatus resolves before harmony sets height.
            if (!a.IsVowel || b is null || !b.IsVowel) continue;
            if (a.Low == b.Low)
                outp.Add(new Seg { IsVowel = false, Ipa = "ʔ", RegClass = Reg.Low });
            else if (Height(b.Low) <= Height(a.Low))
                outp.Add(new Seg { IsVowel = false, Ipa = IsFront(a.Low) ? "j" : "w", RegClass = Reg.Transp });
            // rising in height → true hiatus, no insertion
        }
        return outp;
    }

    /** One Madurese word → canonical IPA (register harmony + epenthesis + devoicing + gemination). */
    public static string PhonemizeWord(string word)
    {
        var segs = Epenthesize(Tokenize(Js.ToLowerCase(word)));
        var prevRaise = false; // word-initial = low
        var prevKind = "start"; // "start" | "C" | "V"
        var ipa = new List<string>();
        var lastC = -1;
        foreach (var s in segs)
        {
            if (!s.IsVowel)
            {
                if (s.RegClass == Reg.Raise) prevRaise = true;
                else if (s.RegClass == Reg.Low) prevRaise = false;
                else if (prevKind != "C") prevRaise = false; // transparent liquid after a vowel → fresh onset
                ipa.Add(s.Ipa);
                lastC = ipa.Count - 1;
                prevKind = "C";
            }
            else
            {
                ipa.Add(prevRaise ? s.High : s.Low);
                lastC = -1; // a vowel is last, so no final-consonant devoicing
                prevKind = "V";
            }
        }
        if (lastC == ipa.Count - 1 && lastC >= 0)
        {
            var seg = ipa[lastC];
            var lng = seg.EndsWith("ː", StringComparison.Ordinal);
            // TS `if (d)`: an absent key AND an empty-string mapping both leave the segment alone.
            if (DEVOICE.TryGetValue(lng ? seg[..^1] : seg, out var d) && d != "")
                ipa[lastC] = lng ? d + "ː" : d;
        }
        return string.Concat(ipa);
    }

    // A word (Madurese letters incl. â è é ò ḍ ṭ and the ' glottal) / number / punctuation token.
    private static readonly JsRe TOKEN =
        JsRegex.Compile($"({HostWord.HostWordRun(new[] { "Latin" }, "'")})|(\\d+)|([.!?…,;:])", "giu");

    /** This language's OWN inventory — a token this class rejects carries a letter Madurese does not use. */
    private const string NATIVE_CLASS = "[a-zâèéòḍṭ']";
    private static readonly Func<string, string> Nat = HostWord.MakeNativiser(NATIVE_CLASS, "iu");

    private sealed class Engine : ILanguage
    {
        public string Text(string input)
        {
            // ⚠ NORMALIZATION RUNS FIRST: the tokenizer splits on a bare `\d+` and treats `.`/`,` as clause
            // punctuation, so a grouping separator or a decimal comma would become a PHRASE BREAK.
            return Clauses.AssembleClauses(Normalize.NormalizeMadurese(input), TOKEN, (m, sink) =>
            {
                if (m.Groups[1].Success && m.Groups[1].Value.Length > 0)
                    sink.Emit(PhonemizeWord(Nat(m.Groups[1].Value)));
                else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
                {
                    var digits = m.Groups[2].Value;
                    foreach (var wd in Numbers.NumberToWords(Js.Number(digits), digits).Split(' '))
                        sink.Emit(PhonemizeWord(wd));
                }
                else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
                {
                    var mk = CLAUSE_MARK.GetValueOrDefault(m.Groups[3].Value);
                    if (mk is not null) sink.Pause(mk);
                }
            });
        }
    }

    /** Build the Madurese phonemizer (register-harmony rule g2p; tone/stress not salient). */
    public static ILanguage CreateMadurese() => new Engine();

    internal static void RegisterSelf() => Registry.Register("madurese", CreateMadurese);
}
