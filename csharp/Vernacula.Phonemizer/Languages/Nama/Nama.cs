/**
 * Nama / Khoekhoe (naq) phonemizer — a greedy scan over the Khoekhoegowab click orthography, canonical IPA.
 * Owns the click composition (place × efflux is a rule, not a table), the ⟨kh⟩ digraph, doubled-vowel
 * length, and the word-final gender-⟨-b⟩ devoicing.
 * Ported from src/languages/nama/nama.ts — see that file for the corpus evidence.
 */
using System.Text;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Nama;

public sealed class NamaPhonemizer : ILanguage
{
    private static readonly IReadOnlyDictionary<string, string> LETTER = Manifest.DEF.Letters;

    /** A click letter + its accompaniment (the following g/kh/h/n, longest-first) → the IPA click cluster. */
    private static string ClickIPA(string click, string accomp) => accomp switch
    {
        "g" => "ᵏ" + click, // tenuis (voiceless unaspirated)
        "kh" => "ᵏ" + click + "ʰ", // aspirated
        "h" => "ᵑ̊" + click + "ʰ", // aspirated (voiceless) nasal
        "n" => "ᵑ" + click, // voiced nasal
        _ => "ᵑ̊" + click + "ˀ", // BARE click → the glottalised nasal click
    };

    /** One Nama word → canonical IPA. */
    public static string PhonemizeWord(string word)
    {
        var chars = Js.CodePoints(Js.Normalize(word, NormalizationForm.FormC));
        // Lowercase PER-INDEX (not a separate list) so a char that lowercases to a different code-point
        // count (İ→i̇, ß→ss) can never desync the index from `chars`.
        static string Lc(List<string> cs, int idx) => idx < cs.Count ? Js.ToLowerCase(cs[idx]) : "";
        var segs = new List<string>();
        for (var i = 0; i < chars.Count; i++)
        {
            var c = chars[i];
            if (Manifest.CLICK.Contains(c))
            {
                // Accompaniment: longest-first — ⟨kh⟩ (2 letters) before ⟨g h n⟩. Case-insensitive (ǀKh, ǀG in citations).
                var next2 = Lc(chars, i + 1) + Lc(chars, i + 2);
                var next1 = Lc(chars, i + 1);
                if (next2 == "kh") { segs.Add(ClickIPA(c, "kh")); i += 2; }
                else if (next1 is "g" or "h" or "n") { segs.Add(ClickIPA(c, next1)); i += 1; }
                else segs.Add(ClickIPA(c, ""));
                continue;
            }
            var cur = Lc(chars, i);
            if (cur == "k" && Lc(chars, i + 1) == "h") { segs.Add("kʰ"); i++; continue; } // ⟨kh⟩ digraph
            // A DOUBLED identical vowel → a long vowel [Vː] (the standard Khoekhoegowab length convention).
            if (Manifest.PLAIN_VOWEL.Contains(cur) && Lc(chars, i + 1) == cur) { segs.Add(LETTER[cur] + "ː"); i++; continue; }
            // WORD-FINAL gender suffix ⟨-b⟩ → [p] (devoicing).
            if (cur == "b" && i == chars.Count - 1) { segs.Add("p"); continue; }
            // A letter with no rule here still denotes a sound; dropping it deletes what the writer typed.
            var ph = LETTER.TryGetValue(cur, out var l) ? l : LatinPhones.LatinPhone(cur, new PhoneOpts { Initial = i == 0, IncludeH = true });
            if (ph != null) segs.Add(ph);
            // tone diacritics on vowels, ʼ, etc.: dropped (tone not emitted; it folds)
        }
        return Js.Normalize(string.Join("", segs), NormalizationForm.FormC);
    }

    /**
     * This language's OWN inventory — the macron and circumflex vowels ARE in the class (leaving them out
     * folded both diacritic contrasts to their bare bases before the g2p ran).
     */
    private static readonly Func<string, string> NAT =
        HostWord.MakeNativiser("[a-zA-ZāēīōūâêîôûĀĒĪŌŪÂÊÎÔÛǀǁǂǃ]", "u");

    // Nama Latin + the click letters ǀ ǁ ǂ ǃ. Word / number / punctuation.
    // ⚠ ALL OF LATIN in the word arm, not just this language's own letters.
    private static readonly JsRe TOKEN =
        JsRegex.Compile($"({HostWord.LATIN_RUN})|(\\d+)|([.?!,;:…])", "gu");

    public string Text(string input)
    {
        return Clauses.AssembleClauses(Normalize.NormalizeNama(Rewriter.Renormalize(input, NormalizationForm.FormC)), TOKEN, (m, sink) =>
        {
            if (m.Groups[1].Success) sink.Emit(PhonemizeWord(NAT(m.Groups[1].Value)));
            else if (m.Groups[2].Success)
            {
                // Cardinals 1 … 10¹²−1 compose natively; 0 emits the flagged Afrikaans stopgap `nul` and
                // anything above the ceiling reads digit-by-digit. Never silently dropped.
                var v = m.Groups[2].Value;
                var words = v.Length <= 12 ? Numbers.NumberToWords(Js.Number(v), v) : Numbers.ReadDigits(v);
                foreach (var wd in words.Split(' ')) sink.Emit(PhonemizeWord(wd));
            }
            else if (m.Groups[3].Success)
            {
                var p = m.Groups[3].Value;
                sink.Pause(p is "." or "!" or "?" ? p : ",");
            }
        });
    }

    /** Build the Nama (Khoekhoe) phonemizer (click-aware Khoekhoegowab scan). */
    public static ILanguage CreateNama() => new NamaPhonemizer();

    internal static void RegisterSelf() => Registry.Register("nama", CreateNama);
}
