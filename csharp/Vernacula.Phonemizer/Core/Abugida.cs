/**
 * GENERIC abugida grapheme-to-phoneme engine.
 *
 * All language-specifics live in a plain, self-describing JSONC definition (see
 * `data/native/<lang>.jsonc`); this file is a thin, DECLARATIVE-DRIVEN interpreter of it. That's
 * deliberate for portability: to reimplement in C# (or any environment) you port this ~80-line
 * algorithm and load the SAME data file — no per-language logic to re-translate.
 *
 * Covers the systematic core of a Brahmic abugida: consonant + inherent vowel, dependent vowel
 * signs (matras), virama (vowel suppression / clusters), independent vowels, nukta composition, and
 * the combining signs (anusvara → nasalized vowel + homorganic nasal; chandrabindu → nasalization;
 * visarga → [h]). Schwa deletion (the one non-trivial rule) is applied separately via the shared
 * `deleteMedialSchwa`, parameterised by the definition. Stress and numbers are layered on top.
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
     *  restoration (Gurmukhi bindi, referee-derived 26:5); absent/other → pure nasalization (Devanagari). */
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

public sealed class AbugidaDef
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
    // Verbatim TS patterns (abugida.ts `out.replace(/ː$/, "")` and `/̃/.test(...)`).
    private static readonly JsRe LongMarkAtEnd = JsRegex.Compile("ː$");
    private static readonly JsRe NasalTilde = JsRegex.Compile("̃");

    /** Build a word→IPA function (inherent vowels intact; schwa deletion applied by the caller). */
    public static Func<string, string> MakeAbugidaG2P(AbugidaDef def, Phonology phon)
    {
        var C = def.Consonants;
        var IV = def.IndependentVowels;
        var VS = def.VowelSigns;
        // Longest-prefix place lookup: sort keys so t͡ʃ / t̪ win over any shorter prefix. `""` (no match) →
        // homorganicNasal[""] is undefined, so no nasal is inserted.
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
            var s = Js.CodePoints(word.Normalize(NormalizationForm.FormC));
            var outp = "";
            var i = 0;
            void Nasalize()
            {
                if (nasalShort) outp = LongMarkAtEnd.Replace(outp, "");
                if (!NasalTilde.IsMatch(outp[Math.Max(0, outp.Length - 2)..])) outp += "̃";
            }
            // ⚠ PER-LANGUAGE: does the chandrabindu-slot sign ALSO restore the homorganic nasal before a stop?
            // Devanagari's ँ is PURE vowel nasalization and must stay so (Hindi default). Gurmukhi's BINDI ਂ is
            // not: the pa referee writes the consonant in 26 of 31 bindi-before-stop words (ਆਂਡਾ aːɳɖaː,
            // ਗੋਂਗਲੂ ɡoːŋɡluː, ਆਂਦਰ aːnd̪ər) — population-derived, and the class was invisible to the folded
            // metric only because the fold strips the nasality diacritic the engine was emitting instead.
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
                            // anusvara also emits the homorganic nasal before a stop
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
