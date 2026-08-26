/**
 * Kazakh (kk) grapheme→phoneme engine — a shallow left-to-right Cyrillic scan: word-initial е→je, л→dark ɫ,
 * glide expansion, ь palatalising and ъ separating, with nucleus flags for the downstream stress rule.
 * Ported from src/languages/kazakh/g2p.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Kazakh;

public sealed class Seg
{
    public required string Ph { get; set; }
    public required bool Nucleus { get; init; }
}

public static class G2p
{
    private static IReadOnlyDictionary<string, string> VOWEL_IPA => Manifest.MANIFEST.Vowels;
    private static IReadOnlyDictionary<string, string> GLIDE_IPA => Manifest.MANIFEST.Glides;
    private static IReadOnlyDictionary<string, string> CONS_IPA => Manifest.MANIFEST.Consonants;

    private static readonly JsRe GLIDE_NUCLEUS = JsRegex.Compile("[əauo]", "u");

    /** Kazakh word → IPA segment list (nucleus flags drive stress). */
    public static List<Seg> ToSegments(string word)
    {
        var chars = Js.CodePoints(Js.ToLowerCase(word));
        var segs = new List<Seg>();
        for (var i = 0; i < chars.Count; i++)
        {
            var c = chars[i];
            var next = i + 1 < chars.Count ? chars[i + 1] : "";
            if (VOWEL_IPA.TryGetValue(c, out var vIpa))
            {
                if (c == "е" && i == 0) segs.Add(new Seg { Ph = "j", Nucleus = false });
                segs.Add(new Seg { Ph = vIpa, Nucleus = true });
                continue;
            }
            if (GLIDE_IPA.TryGetValue(c, out var gIpa))
            {
                if (c == "у") segs.Add(new Seg { Ph = gIpa, Nucleus = false });
                else
                    foreach (var p in Js.CodePoints(gIpa))
                        segs.Add(new Seg { Ph = p, Nucleus = GLIDE_NUCLEUS.IsMatch(p) });
                continue;
            }
            if (c == "л")
            {
                segs.Add(new Seg { Ph = "ɫ", Nucleus = false });
                continue;
            }
            if (c == "ь")
            {
                var prev = segs.Count > 0 ? segs[^1] : null;
                if (prev is not null && !prev.Nucleus && !prev.Ph.EndsWith("ʲ", StringComparison.Ordinal))
                {
                    if (prev.Ph == "ɫ") prev.Ph = "l";
                    prev.Ph += "ʲ";
                }
                continue;
            }
            if (c == "ъ")
            {
                if (VOWEL_IPA.ContainsKey(next) || GLIDE_IPA.ContainsKey(next))
                    segs.Add(new Seg { Ph = "j", Nucleus = false });
                continue;
            }
            if (CONS_IPA.TryGetValue(c, out var cons)) segs.Add(new Seg { Ph = cons, Nucleus = false });
            // else: unknown char (punctuation) → skip
        }
        return segs;
    }
}
