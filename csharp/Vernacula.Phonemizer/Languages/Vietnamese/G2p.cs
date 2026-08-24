/**
 * Vietnamese grapheme→phoneme engine (Northern / Hanoi).
 * Ported from src/languages/vietnamese/g2p.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Vietnamese;

public static class G2p
{
    private static IReadOnlyDictionary<string, string> TONE => Manifest.MANIFEST.Tones.Diacritics;
    private static string NGANG => Manifest.MANIFEST.Tones.Ngang;
    private static IReadOnlyList<(string Orth, string Ipa)> ONSETS => Manifest.ONSETS;
    private static readonly IReadOnlySet<string> VOWEL_LETTER =
        new HashSet<string>(Js.CodePoints(Manifest.MANIFEST.VowelLetters), StringComparer.Ordinal);
    private static readonly IReadOnlySet<string> VOWEL_IPA =
        new HashSet<string>(Js.CodePoints(Manifest.MANIFEST.VowelIpa), StringComparer.Ordinal);
    private static readonly JsRe CODA_RE = JsRegex.Compile("(t̪|[ptkmnŋɲwj])$", "u");

    private static Dictionary<string, string>? RHYMES;
    private static readonly object GATE = new();
    private static Dictionary<string, string> Rhymes()
    {
        lock (GATE) return RHYMES ??= LoadTsv.LoadTsvMap("languages/vietnamese", "rhymes.tsv");
    }

    private sealed class ToneSplit
    {
        public required string Base { get; init; }
        public required string Tone { get; init; }
    }

    /** Split a syllable into its toneless base (NFC, keeping â/ê/ô/ă/ơ/ư) and its Chao tone contour. */
    private static ToneSplit SplitTone(string syl)
    {
        var tone = NGANG;
        var outp = "";
        foreach (var ch in Js.CodePoints(syl.Normalize(System.Text.NormalizationForm.FormD)))
        {
            if (TONE.TryGetValue(ch, out var t)) tone = t;
            else outp += ch;
        }
        return new ToneSplit
        {
            Base = outp.Normalize(System.Text.NormalizationForm.FormC).ToLowerInvariant(),
            Tone = tone,
        };
    }

    private sealed class OnsetSplit
    {
        public required string Onset { get; init; }
        public required string Rest { get; init; }
    }

    /** Parse the onset: longest orthographic match → IPA + the remaining rhyme orthography. */
    private static OnsetSplit ParseOnset(string @base)
    {
        var cps = Js.CodePoints(@base);
        foreach (var (o, ipa) in ONSETS)
        {
            if (!@base.StartsWith(o, StringComparison.Ordinal)) continue;
            var rest = @base[o.Length..];
            if (o == "gi")
            {
                var head = Js.CodePoints(rest);
                if (rest == "" || !VOWEL_LETTER.Contains(head[0]))
                    rest = "i" + rest;
                else if (head[0] == "ê") rest = "i" + rest;
            }
            else if (o == "qu")
            {
                // ⚠ `base[2]` IS A UTF-16 UNIT IN THE TS while `slice(2)` is also UTF-16 — both agree here
                // because `qu` is two ASCII units, so index 2 is the third unit and the third code point alike.
                var third = cps.Count > 2 ? cps[2] : "";
                if (third == "ô" || third == "ơ")
                    return new OnsetSplit { Onset = "k", Rest = "u" + @base[2..] };
                rest = @base[2..];
            }
            return new OnsetSplit { Onset = ipa, Rest = rest };
        }
        if (@base != "" && VOWEL_LETTER.Contains(cps[0]))
            return new OnsetSplit { Onset = "ʔ", Rest = @base }; // vowel-initial → glottal
        return new OnsetSplit { Onset = "", Rest = @base };
    }

    /**
     * One Vietnamese syllable → canonical IPA (with tone + a stress mark), or "" if not a parseable syllable.
     */
    public static string PhonemizeSyllable(string syl)
    {
        var split = SplitTone(syl);
        var @base = split.Base;
        var tone = split.Tone;
        if (@base == "") return "";
        var parsed = ParseOnset(@base);
        if (!Rhymes().TryGetValue(parsed.Rest, out var rhyme)) return ""; // not a known Vietnamese rhyme (foreign word / acronym)
        var r = rhyme;
        var glide = "";
        if (r.StartsWith("w", StringComparison.Ordinal) && r.Length > 1 &&
            VOWEL_IPA.Contains(Js.CodePoints(r)[1]))
        {
            glide = "w";
            r = r[1..];
        }
        var codaM = CODA_RE.Match(r);
        var coda = codaM.Success ? codaM.Value : "";
        var nucleus = coda != "" ? r[..(r.Length - coda.Length)] : r;
        return parsed.Onset + glide + "ˈ" + nucleus + tone + coda;
    }
}
