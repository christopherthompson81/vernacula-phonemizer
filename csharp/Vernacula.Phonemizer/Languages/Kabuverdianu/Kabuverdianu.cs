/**
 * Kabuverdianu / kriolu (kea) phonemizer — Cape Verdean Creole (Portuguese-lexified), canonical IPA,
 * written in the ALUPEC/AK unified orthography (a standardized PHONEMIC alphabet). A greedy grapheme
 * scan (digraphs ⟨dj tx nh lh rr⟩ first) + Portuguese-creole NASALIZATION (a coda ⟨n/m⟩ nasalizes the
 * preceding vowel; the nasal is [ŋ] before a velar, else absorbed) + STRESS (a written accent marks the
 * stressed syllable, else penultimate). Targets the Santiago (Sotavento/Badiu) variety.
 * Ported from src/languages/kabuverdianu/kabuverdianu.ts — see that file for the corpus evidence.
 */
using System.Text;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Kabuverdianu;

public static class KabuverdianuPhonemizer
{
    /** One scanned segment: the IPA phones + the flags the nasalization and stress passes read. */
    private sealed class Seg
    {
        public string Ph { get; set; } = "";
        public bool Vowel { get; init; }    // the phoneme is a vowel (for nasalization adjacency)
        public bool Accented { get; init; } // carries a written accent → lexically stressed
        public bool Offglide { get; init; } // a falling-diphthong ⟨i/u⟩ after a nucleus — not a stress-bearing nucleus
    }

    private static IReadOnlyDictionary<string, string> DIGRAPHS => Manifest.MANIFEST.Digraphs;
    private static IReadOnlyDictionary<string, string> GRAPHMES => Manifest.MANIFEST.Graphemes;
    private static IReadOnlyDictionary<string, string> CLAUSE_MARK => Manifest.MANIFEST.ClausePunctuation;
    private static readonly IReadOnlySet<string> ACCENTED =
        new HashSet<string>(Manifest.MANIFEST.AccentedVowels, StringComparer.Ordinal);
    private static readonly IReadOnlySet<string> VOWEL_LETTERS =
        new HashSet<string>(Manifest.MANIFEST.VowelLetters, StringComparer.Ordinal);

    /** Scan a lowercased Kabuverdianu word into IPA segments (digraphs first, then single graphemes). */
    private static List<Seg> Scan(string word)
    {
        var w = Js.CodePoints(Js.ToLowerCase(word));
        var segs = new List<Seg>();
        for (var i = 0; i < w.Count; i++)
        {
            var two = (i < w.Count ? w[i] : "") + (i + 1 < w.Count ? w[i + 1] : "");
            if (DIGRAPHS.TryGetValue(two, out var diph))
            { segs.Add(new Seg { Ph = diph, Vowel = false, Accented = false, Offglide = false }); i += 1; continue; }
            var c = w[i];
            if (!GRAPHMES.TryGetValue(c, out var ph) || ph == "") continue; // unknown or silent ⟨h⟩
            var vowel = Ipa.IPA_VOWEL.Contains(ph);
            // a falling-diphthong offglide: an unaccented ⟨i/u⟩ right after a vowel nucleus — not a nucleus.
            var prev = segs.Count > 0 ? segs[^1] : null;
            var offglide = vowel && (ph == "i" || ph == "u") && !ACCENTED.Contains(c)
                && prev is not null && prev.Vowel && !prev.Offglide;
            segs.Add(new Seg { Ph = ph, Vowel = vowel, Accented = ACCENTED.Contains(c), Offglide = offglide });
        }
        return segs;
    }

    /** Portuguese-creole nasalization: a coda ⟨n/m⟩ (preceded by a vowel, not before another vowel) nasalizes
     *  that vowel; the nasal surfaces as [ŋ] before a velar and is otherwise absorbed. */
    private static List<Seg> Nasalize(List<Seg> segs)
    {
        var outp = new List<Seg>();
        for (var i = 0; i < segs.Count; i++)
        {
            var s = segs[i];
            var prev = outp.Count > 0 ? outp[^1] : null;
            var next = i + 1 < segs.Count ? segs[i + 1] : null;
            if ((s.Ph == "n" || s.Ph == "m") && prev is not null && prev.Vowel && (next is null || !next.Vowel))
            {
                prev.Ph = prev.Ph == "ɐ" ? "ã" : prev.Ph + "\u0303"; // nasalize (nasal /a/ opens to [ã], not [ɐ̃])
                if (next is not null && (next.Ph == "k" || next.Ph == "ɡ"))
                    outp.Add(new Seg { Ph = "ŋ", Vowel = false, Accented = false, Offglide = false });
                continue; // else: the nasal consonant is absorbed into the nasal vowel
            }
            outp.Add(s);
        }
        return outp;
    }

    /** Assemble with stress: ˈ before the accented nucleus if there is one; else the Ibero default —
     *  PENULTIMATE when the word ends in an oral vowel or ⟨s⟩ (plural), OXYTONE when it ends in any other
     *  consonant. A falling-diphthong offglide is not a nucleus. */
    private static string WithStress(List<Seg> segs, string word)
    {
        var nuclei = new List<int>();
        for (var i = 0; i < segs.Count; i++)
            if (segs[i].Vowel && !segs[i].Offglide) nuclei.Add(i);
        if (nuclei.Count == 0) return string.Concat(segs.Select(s => s.Ph));
        var accented = -1;
        foreach (var i in nuclei) if (segs[i].Accented) { accented = i; break; }
        var stressIdx = accented;
        if (accented < 0)
        {
            var w = Js.ToLowerCase(word);
            var last = w.Length > 0 ? w[^1].ToString() : "";
            var penult = VOWEL_LETTERS.Contains(last) || last == "s";
            stressIdx = penult && nuclei.Count >= 2 ? nuclei[^2] : nuclei[^1];
        }
        var sb = new StringBuilder();
        for (var i = 0; i < segs.Count; i++)
        {
            if (i == stressIdx) sb.Append('ˈ');
            sb.Append(segs[i].Ph);
        }
        return sb.ToString();
    }

    /** Phonemize a single Kabuverdianu word to canonical IPA (ALUPEC scan + nasalization + accent/penult-or-oxytone
     *  stress). NFC so the nasal vowels precompose consistently (õ ĩ ũ ẽ ã). */
    public static string PhonemizeWord(string word) =>
        WithStress(Nasalize(Scan(word)), word).Normalize(NormalizationForm.FormC);

    // A word (Latin incl. the ALUPEC accented vowels; ' ’ - keep clitic clusters together) / number /
    // punctuation token. Numbers are deferred (passed through).
    private static readonly JsRe TOKEN =
        JsRegex.Compile($"({HostWord.HostWordRun(new[] { "Latin" }, "'’-")})|(\\d+)|([.!?…,;:])", "gu");

    /** This language's OWN inventory. ⚠ TWO DIFFERENT QUESTIONS, KEPT APART: the TOKEN class decides where the
     *  SCRIPT boundary falls (routing), while this one decides whether the g2p has rules for these letters.
     *  ⚠ ì ù Ì Ù ARE DELIBERATELY ABSENT: the g2p has no rule for them, and drops them outright. */
    private const string NATIVE_CLASS = "[a-záàâéèêíîóòôúûA-ZÁÀÂÉÈÊÍÎÓÒÔÚÛ'’-]";
    private static readonly Func<string, string> Nat = HostWord.MakeNativiser(NATIVE_CLASS, "u");

    private sealed class Engine : ILanguage
    {
        public string Text(string input)
        {
            // TEXT NORMALIZATION runs BEFORE tokenization. Its flagship job is the grouping dot and the clock
            // colon, which this tokenizer would otherwise read as a full stop and a mid-quantity pause.
            return Clauses.AssembleClauses(Normalize.NormalizeKabuverdianu(input), TOKEN, (m, sink) =>
            {
                if (m.Groups[1].Success && m.Groups[1].Value.Length > 0)
                    sink.Emit(PhonemizeWord(Nat(m.Groups[1].Value)));
                // A digit run reads as Kabuverdianu number WORDS, each phonemized like any other word.
                else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
                    foreach (var wd in Numbers.NumberToWords(Js.Number(m.Groups[2].Value), m.Groups[2].Value).Split(' '))
                        sink.Emit(PhonemizeWord(wd));
                else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0
                    && CLAUSE_MARK.TryGetValue(m.Groups[3].Value, out var mk) && mk != "")
                    sink.Pause(mk);
            });
        }
    }

    /** Build the Kabuverdianu phonemizer (ALUPEC greedy g2p + nasalization + stress; numbers deferred). */
    public static ILanguage CreateKabuverdianu() => new Engine();

    internal static void RegisterSelf() => Registry.Register("kabuverdianu", CreateKabuverdianu);
}
