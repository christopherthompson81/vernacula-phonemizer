/**
 * Somali grapheme→phoneme engine — a digraph-aware left-to-right scan over the 1972 Latin orthography
 * (long vowels, ⟨sh dh kh⟩, the Cushitic pharyngeals, gemination). No lexicon; tone is not emitted.
 * Ported from src/languages/somali/g2p.ts — see that file for the convention and its referees.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Somali;

public sealed record Seg(string Ph, bool Nucleus);

public static class G2p
{
    private static IReadOnlyDictionary<string, string> LONG => Manifest.MANIFEST.LongVowels;
    private static IReadOnlyDictionary<string, string> SHORT => Manifest.MANIFEST.ShortVowels;
    private static IReadOnlyDictionary<string, string> DIGRAPH => Manifest.MANIFEST.Digraphs;
    private static IReadOnlyDictionary<string, string> CONS => Manifest.MANIFEST.Consonants;

    private static readonly JsRe CURLY_APOSTROPHE = JsRegex.Compile("’", "g");

    /** Somali word → segment list. Indexing is by UTF-16 unit, as the TS `w[i]` / `w.slice` are. */
    public static List<Seg> ToSegments(string word)
    {
        var w = CURLY_APOSTROPHE.Replace(Js.ToLowerCase(word), "'");
        var n = w.Length;
        var segs = new List<Seg>();
        var i = 0;
        while (i < n)
        {
            var c = w[i].ToString();
            var two = w.Substring(i, Math.Min(2, n - i));

            if (LONG.TryGetValue(two, out var lv))
            {
                segs.Add(new Seg(lv, true));
                i += 2;
                continue;
            }
            if (DIGRAPH.TryGetValue(two, out var dg))
            {
                // A doubled digraph (⟨dhdh⟩) geminates the result.
                if (i + 2 <= n && w.Substring(i + 2, Math.Min(2, Math.Max(0, n - (i + 2)))) == two)
                {
                    segs.Add(new Seg(dg + "ː", false));
                    i += 4;
                }
                else
                {
                    segs.Add(new Seg(dg, false));
                    i += 2;
                }
                continue;
            }
            if (SHORT.TryGetValue(c, out var sv))
            {
                segs.Add(new Seg(sv, true));
                i++;
                continue;
            }
            if (CONS.TryGetValue(c, out var cp))
            {
                if (i + 1 < n && w[i + 1] == w[i])
                {
                    segs.Add(new Seg(cp + "ː", false));
                    i += 2;
                }
                else
                {
                    segs.Add(new Seg(cp, false));
                    i++;
                }
                continue;
            }
            i++; // unknown char (punctuation) → skip
        }
        return segs;
    }
}
