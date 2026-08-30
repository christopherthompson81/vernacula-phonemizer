/**
 * Abkhaz (ab) phonemizer — canonical IPA. A longest-match scan over base+modifier Cyrillic: trigraph, then
 * base+modifier cluster, then base, with the ⟨у⟩/⟨и⟩ glide-vs-syllabic split handled here. Numbers are
 * VIGESIMAL and composed by Numbers.cs. The letter tables, the vowel-letter set and the encyclopedic record
 * (the NW-Caucasian consonant system, the modifier letters, the referee-circularity caveat) live in
 * abkhaz.jsonc.
 * Ported from src/languages/abkhaz/abkhaz.ts — see that file and the jsonc for the corpus evidence.
 */
using System.Text;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Abkhaz;

public static class AbkhazPhonemizer
{
    // Letter tables (abkhaz.jsonc): base+modifier clusters, base letters, and the generic modifier fallbacks.
    private static readonly IReadOnlyDictionary<string, string> CLUSTER = Manifest.MANIFEST.Clusters;
    private static readonly IReadOnlyDictionary<string, string> BASE = Manifest.MANIFEST.Base;
    private static readonly IReadOnlyDictionary<string, string> MODIFIER = Manifest.MANIFEST.Modifiers;
    // The vowel letters (abkhaz.jsonc) — the environment for the ⟨у⟩/⟨и⟩ glide-vs-syllabic rule below.
    private static readonly HashSet<string> VOWEL_LETTER =
        new(Manifest.MANIFEST.VowelLetters, StringComparer.Ordinal);

    /** The LEFT context of the glide rule: does the PREVIOUS EMITTED phone end in a vowel? A realized glide is
     *  a consonant, so a glide run alternates from its anchor (асууари→asuwari, ауу→awu, иаиууа→jajuwa). */
    private static readonly JsRe LEFT_VOWEL = JsRegex.Compile("[aeiouə]$", "u");

    /** One Abkhaz word → canonical IPA. */
    public static string PhonemizeWord(string word)
    {
        // Normalize the curly apostrophe ’ (U+2019) to ASCII ' — the pharyngealizer ⟨х'⟩ (TOKEN admits both, but the
        // CLUSTER/MODIFIER keys use only ASCII '); real typographic Abkhaz text uses the curly form.
        var s = Js.CodePoints(Js.ToLowerCase(Js.Normalize(word, NormalizationForm.FormC).Replace("\u2019", "'")));
        var outp = new List<string>();
        for (var i = 0; i < s.Count; i++)
        {
            var c3 = string.Concat(s.Skip(i).Take(3));
            var c2 = string.Concat(s.Skip(i).Take(2));
            if (CLUSTER.TryGetValue(c3, out var t3)) { outp.Add(t3); i += 2; continue; } // trigraph (х'ә)
            if (CLUSTER.TryGetValue(c2, out var t2)) { outp.Add(t2); i += 1; continue; } // base + modifier
            var c = s[i];
            // ⟨у⟩/⟨и⟩ are underlyingly the GLIDES /w j/: [w]/[j] next to a vowel, syllabic [u]/[i] between consonants /
            // word-finally (аи→aj, аԥсуа→apʰswa; but иҭабуп→itʰabup, амени→ameni).
            if (c == "у" || c == "и")
            {
                // ⚠ THE LEFT CONTEXT IS THE REALIZED PHONE, NOT THE LETTER — the previous EMITTED phone, and on the
                // RIGHT a vowel letter that is not itself ⟨у⟩/⟨и⟩: an undecided glide is no context.
                var leftV = LEFT_VOWEL.IsMatch(outp.Count > 0 ? outp[^1] : "");
                var nxt = i + 1 < s.Count ? s[i + 1] : null;
                var rightV = nxt is not null && nxt != "у" && nxt != "и" && VOWEL_LETTER.Contains(nxt);
                var adjV = leftV || rightV;
                outp.Add(c == "у" ? (adjV ? "w" : "u") : (adjV ? "j" : "i"));
                continue;
            }
            if (BASE.TryGetValue(c, out var basePh))
            {
                var ph = basePh;
                // A base not in the CLUSTER table + a modifier → append the generic modifier IPA.
                // ⚠ NOT TWICE: ⟨ҩ⟩ is [ɥˤ] with the pharyngealizer already in the base value, so ⟨ҩ'⟩ must
                // consume the apostrophe WITHOUT appending — ɥˤˤ is not IPA. The apostrophe is consumed either way.
                var next = i + 1 < s.Count ? s[i + 1] : "";
                if (MODIFIER.TryGetValue(next, out var mod))
                {
                    if (!ph.EndsWith(mod, StringComparison.Ordinal)) ph += mod;
                    i++;
                }
                outp.Add(ph);
                continue;
            }
            // ⟨ъ ь ә '⟩ standing alone / stray marks: skip
        }
        return string.Concat(outp);
    }

    // Abkhaz Cyrillic (base + extended letters) + the ⟨'⟩ pharyngealizer. Word / number / punctuation.
    private static readonly JsRe TOKEN =
        JsRegex.Compile("([Ѐ-ӿԀ-ԯꚀ-ꚟꙀ-ꙟ'’]+)|(\\d+)|([.?!,;:…])", "gu");

    private sealed class Engine : ILanguage
    {
        public string Text(string input)
        {
            // ⚠ NORMALIZE BEFORE TOKENIZING — the layer's whole job is to turn what is not a word into words
            // the scan below can read, so it must run while the digits, dashes and dots are still there.
            return Clauses.AssembleClauses(Normalize.NormalizeAbkhaz(Rewriter.Renormalize(input, NormalizationForm.FormC)), TOKEN, (m, sink) =>
            {
                if (m.Groups[1].Success && m.Groups[1].Value.Length > 0)
                {
                    sink.Emit(PhonemizeWord(m.Groups[1].Value));
                }
                else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
                {
                    foreach (var wd in Numbers.NumberToWords(Js.Number(m.Groups[2].Value), m.Groups[2].Value).Split(' '))
                        sink.Emit(PhonemizeWord(wd));
                }
                else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
                {
                    var p = m.Groups[3].Value;
                    sink.Pause(p == "." || p == "!" || p == "?" ? p : ",");
                }
            });
        }
    }

    /** Build the Abkhaz phonemizer (Cyrillic base+modifier scan; the NW-Caucasian consonant system). */
    public static ILanguage CreateAbkhaz() => new Engine();

    internal static void RegisterSelf()
    {
        Registry.Register("abkhaz", CreateAbkhaz);
    }
}
