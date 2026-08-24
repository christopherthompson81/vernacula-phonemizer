/**
 * Aksara Jawa (Hanacaraka) scanner for Javanese (jv) — the native Brahmic abugida front-end.
 * Ported from src/languages/javanese/aksara.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Javanese;

public sealed class AksaraDef
{
    public IReadOnlyDictionary<string, string> Consonants { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Syllabic { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> IndependentVowels { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> VowelSigns { get; init; } = new Dictionary<string, string>();
    public string Tarung { get; init; } = "";
    public IReadOnlyDictionary<string, string> Medials { get; init; } = new Dictionary<string, string>();
    public string Keret { get; init; } = "";
    public IReadOnlyDictionary<string, string> Codas { get; init; } = new Dictionary<string, string>();
    public string Virama { get; init; } = "";
    public IReadOnlyDictionary<string, string> Digits { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Pada { get; init; } = new Dictionary<string, string>();
}

public static class Aksara
{
    private static readonly AksaraDef DEF = LoadManifest.Load<AksaraDef>("languages/javanese", "aksara.jsonc");

    /**
     * The vowel LETTER a sound maps to, for the phonology rules (laxing keys on i/u/o, a→ɔ on a; the rest are
     * inert).
     */
    private static string LetterOf(string ph) => "aiou".Contains(ph, StringComparison.Ordinal) ? ph : "e";

    /**
     * Any Aksara Jawa word letter (consonant, independent vowel, or syllabic) — for tokenising script runs.
     */
    public static readonly JsRe AKSARA_LETTER =
        JsRegex.Compile("[\\u{A984}-\\u{A9B2}\\u{A9BD}-\\u{A9C0}\\u{A981}-\\u{A983}\\u{A9B3}-\\u{A9BC}]", "u");
    public static bool IsAksaraDigit(string ch) => DEF.Digits.ContainsKey(ch);
    public static string AksaraDigit(string ch) => DEF.Digits.GetValueOrDefault(ch) ?? "";
    public static string? AksaraPada(string ch) => DEF.Pada.GetValueOrDefault(ch);

    /**
     * Scan one Aksara Jawa word into phoneme segments (consonant + inherent/sign vowel, medials, codas,
     * virama).
     */
    public static List<Seg> ScanAksara(string word)
    {
        var s = Js.CodePoints(word.Normalize(System.Text.NormalizationForm.FormC));
        var n = s.Count;
        var segs = new List<Seg>();
        void PushC(string ipa) => segs.Add(new Seg { Ph = ipa, V = "" });
        void PushV(string ph) => segs.Add(new Seg { Ph = ph, V = LetterOf(ph) });
        string At(int k) => k >= 0 && k < n ? s[k] : "";
        int Codas(int i)
        {
            while (i < n && DEF.Codas.ContainsKey(s[i])) PushC(DEF.Codas[s[i++]]);
            return i;
        }

        var i = 0;
        while (i < n)
        {
            var ch = s[i];
            if (DEF.Consonants.TryGetValue(ch, out var consPh))
            {
                // ꦲ "ha" is the zero-onset vowel carrier — its [h] is silent; a real /h/ coda is wignyan (ꦃ).
                if (ch != "ꦲ") PushC(consPh);
                i++;
                var keretVowel = false;
                while (i < n && (DEF.Medials.ContainsKey(s[i]) || s[i] == DEF.Keret))
                {
                    if (s[i] == DEF.Keret)
                    {
                        PushC("r");
                        keretVowel = true;
                    }
                    else PushC(DEF.Medials[s[i]]);
                    i++;
                }
                if (keretVowel) PushV("ə");
                else if (At(i) == DEF.Virama) i++;
                else if (DEF.VowelSigns.TryGetValue(At(i), out var signPh))
                {
                    var ph = signPh;
                    i++;
                    if (ph == "e" && At(i) == DEF.Tarung)
                    {
                        ph = "o"; // taling + tarung = /o/
                        i++;
                    }
                    else if (At(i) == DEF.Tarung) i++; // absorb a trailing tarung
                    PushV(ph);
                }
                else if (At(i) == DEF.Tarung)
                {
                    PushV("o");
                    i++;
                }
                else PushV("a"); // inherent vowel
                i = Codas(i);
            }
            else if (DEF.Syllabic.TryGetValue(ch, out var syllPh))
            {
                PushC(syllPh); // pa-cerek rə / nga-lelet lə
                PushV("ə");
                i++;
                i = Codas(i);
            }
            else if (DEF.IndependentVowels.TryGetValue(ch, out var ivPh))
            {
                PushV(ivPh);
                i++;
                i = Codas(i);
            }
            else i++; // unknown / stray sign → skip
        }
        return segs;
    }
}
