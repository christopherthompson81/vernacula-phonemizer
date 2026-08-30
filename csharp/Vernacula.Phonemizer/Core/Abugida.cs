/**
 * GENERIC abugida grapheme-to-phoneme engine.
 * Ported from src/core/abugida.ts — see that file for the corpus evidence.
 */
using System.Text;

namespace Vernacula.Phonemizer.Core;

public sealed class AbugidaPhone
{
    public string Ipa { get; set; } = "";
}

public sealed class AbugidaSign
{
    public string Char { get; set; } = "";

    /** `effect: "nasalizeVowelHomorganic"` opts this sign into the anusvara's homorganic-nasal
     *  restoration (Gurmukhi bindi); absent or other → pure nasalization (Devanagari). */
    public string? Effect { get; set; }
}

public sealed class AbugidaSigns
{
    public AbugidaSign Virama { get; set; } = new();
    public AbugidaSign Anusvara { get; set; } = new();
    public AbugidaSign Chandrabindu { get; set; } = new();
    public AbugidaSign Visarga { get; set; } = new();
    public AbugidaSign Nukta { get; set; } = new();
}

// ⚠ NOT SEALED: language defs (Odia, Assamese, …) extend it with their own numbers/punctuation blocks,
// exactly as the TS interfaces do (`interface OdiaDef extends AbugidaDef`).
public class AbugidaDef
{
    public string Language { get; set; } = "";
    public string InherentVowel { get; set; } = "";
    public Dictionary<string, AbugidaPhone> Consonants { get; set; } = new();
    public Dictionary<string, AbugidaPhone> IndependentVowels { get; set; } = new();
    public Dictionary<string, AbugidaPhone> VowelSigns { get; set; } = new();
    public AbugidaSigns Signs { get; set; } = new();
    public bool? NasalVowelsAreShort { get; set; }
}

public static class Abugida
{
    private static readonly JsRe LongMarkAtEnd = JsRegex.Compile("ː$");
    private static readonly JsRe NasalTilde = JsRegex.Compile("̃");

    /** Build a word→IPA function (inherent vowels intact; schwa deletion applied by the caller). */
    public static Func<string, string> MakeAbugidaG2P(AbugidaDef def, Phonology phon)
    {
        var C = def.Consonants;
        var IV = def.IndependentVowels;
        var VS = def.VowelSigns;
        // Longest-prefix place lookup: sort keys so t͡ʃ / t̪ win over any shorter prefix. A miss yields "",
        // whose homorganic-nasal entry is absent, so no nasal is inserted.
        var placeKeys = phon.PlaceOfArticulation.Keys.ToList();
        // JS `sort((a, b) => b.length - a.length)` — a STABLE length-descending sort (V8 sort is stable).
        placeKeys = placeKeys.OrderByDescending(k => k.Length).ToList(); // OrderByDescending is stable too.
        string Place(string ipa)
        {
            foreach (var k in placeKeys)
                if (ipa.StartsWith(k, StringComparison.Ordinal))
                    return phon.PlaceOfArticulation[k];
            return "";
        }
        var VIR = def.Signs.Virama.Char;
        var AN = def.Signs.Anusvara.Char;
        var CH = def.Signs.Chandrabindu.Char;
        var VIS = def.Signs.Visarga.Char;
        var NK = def.Signs.Nukta.Char;
        var inh = def.InherentVowel;
        var nasalShort = def.NasalVowelsAreShort ?? true;

        return word =>
        {
            var s = Js.CodePoints(Js.Normalize(word, NormalizationForm.FormC));
            var outp = "";
            var i = 0;
            void Nasalize()
            {
                if (nasalShort) outp = LongMarkAtEnd.Replace(outp, "");
                if (!NasalTilde.IsMatch(outp[Math.Max(0, outp.Length - 2)..])) outp += "̃";
            }
            var chHomorganic = def.Signs.Chandrabindu?.Effect == "nasalizeVowelHomorganic";
            void SignsRun()
            {
                while (i < s.Count && (s[i] == AN || s[i] == CH || s[i] == VIS))
                {
                    if (s[i] == VIS) outp += "h";
                    else
                    {
                        Nasalize();
                        if (s[i] == AN || (s[i] == CH && chHomorganic))
                        {
                            var nx = i + 1 < s.Count ? s[i + 1] : null;
                            var nc = nx is not null
                                ? (C.TryGetValue(nx, out var cPh)
                                    ? cPh.Ipa
                                    : C.TryGetValue(nx + NK, out var cnPh)
                                        ? cnPh.Ipa
                                        : "")
                                : null;
                            var hn = !string.IsNullOrEmpty(nc)
                                ? (phon.HomorganicNasal.TryGetValue(Place(nc!), out var h) ? h : "")
                                : "";
                            if (!string.IsNullOrEmpty(hn)) outp += hn;
                        }
                    }
                    i++;
                }
            }
            while (i < s.Count)
            {
                var ch = s[i];
                if (i + 1 < s.Count && s[i + 1] == NK && C.ContainsKey(ch + NK))
                {
                    ch += NK;
                    i++;
                }
                if (C.TryGetValue(ch, out var cons))
                {
                    outp += cons.Ipa;
                    i++;
                    if (i < s.Count && s[i] == VIR) i++;
                    else if (i < s.Count && VS.TryGetValue(s[i], out var vs))
                    {
                        outp += vs.Ipa;
                        i++;
                        SignsRun();
                    }
                    else
                    {
                        outp += inh;
                        SignsRun();
                    }
                }
                else if (IV.TryGetValue(ch, out var iv))
                {
                    outp += iv.Ipa;
                    i++;
                    SignsRun();
                }
                else i++;
            }
            return outp;
        };
    }
}
