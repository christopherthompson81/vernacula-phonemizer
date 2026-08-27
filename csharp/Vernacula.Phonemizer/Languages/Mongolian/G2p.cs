/**
 * Mongolian (mn) grapheme→phoneme engine — Cyrillic, canonical IPA. A greedy longest-match scan emitting IPA
 * segments tagged nucleus/short, plus the context rules the tables cannot express: back-harmony on ⟨г х⟩, the
 * iotated letters, and the soft sign that FRONTS the preceding vowel and drops.
 * Ported from src/languages/mongolian/g2p.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Mongolian;

/** ⚠ A CLASS, NOT A STRUCT: `mongolian.ts` MUTATES segments in place (final н→ŋ, the soft-sign fronting,
 *  final devoicing) through the array it holds, and a value type would silently drop those writes. */
public sealed class Seg
{
    public required string Ph { get; set; }
    public required bool Nucleus { get; init; }
    /** A single (short) vowel — eligible for reduction/deletion; long vowels and diphthongs are false. */
    public required bool Short { get; init; }
}

public static class G2p
{
    private static MongolianManifest M => Manifest.MANIFEST;
    private static IReadOnlyDictionary<string, string> V => M.Vowels;
    private static IReadOnlyDictionary<string, string> LONG => M.LongVowels;
    private static IReadOnlyDictionary<string, string> DIPH => M.Diphthongs;
    private static IReadOnlyDictionary<string, string> CONS => M.Consonants;
    private static readonly HashSet<string> BACK = new(Js.CodePoints(M.BackVowels));

    /** Iotated single vowel letters → their bare vowel IPA (the glide is added by context). */
    private static readonly Dictionary<string, string> IOTATED =
        new() { ["я"] = "a", ["ё"] = "ɔ", ["ю"] = "ʊ", ["е"] = "e" };

    /** ь fronts the preceding vowel (palatal + front-rounding): back → front counterpart. */
    private static readonly Dictionary<string, string> FRONT = new()
    {
        ["a"] = "æ", ["ɔ"] = "œ", ["ʊ"] = "u", ["aː"] = "æː", ["ɔː"] = "œː", ["ʊː"] = "uː",
    };

    /** Mongolian word → IPA segment list (nucleus/short drive reduction + deletion in Mongolian.cs). */
    public static List<Seg> ToSegments(string word)
    {
        var chars = Js.CodePoints(Js.ToLowerCase(word));
        string? At(int k) => k >= 0 && k < chars.Count ? chars[k] : null;

        // Harmony is LOCAL (the nearest vowel), so a loanword that breaks word-harmony still gets the right
        // ⟨г х⟩ place.
        bool NearestBack(int i)
        {
            for (var d = 1; d < chars.Count; d++)
            {
                var r = At(i + d);
                var l = At(i - d);
                if (r is not null && (V.ContainsKey(r) || "яёею".Contains(r, StringComparison.Ordinal)))
                    return BACK.Contains(r) || "яёю".Contains(r, StringComparison.Ordinal);
                if (l is not null && (V.ContainsKey(l) || "яёею".Contains(l, StringComparison.Ordinal)))
                    return BACK.Contains(l) || "яёю".Contains(l, StringComparison.Ordinal);
            }
            return chars.Any(BACK.Contains);
        }

        string ConsIpa(string c, int i)
        {
            if (c == "г") return NearestBack(i) ? "ɢ" : "ɡ";
            if (c == "х") return NearestBack(i) ? "χ" : "x";
            return CONS[c];
        }

        var segs = new List<Seg>();
        var i = 0;
        while (i < chars.Count)
        {
            var c = chars[i];
            var pair = c + (At(i + 1) ?? "");
            // 2-char nuclei first (greedy): diphthongs then doubled long vowels.
            if (DIPH.TryGetValue(pair, out var dp)) { segs.Add(new Seg { Ph = dp, Nucleus = true, Short = false }); i += 2; continue; }
            if (LONG.TryGetValue(pair, out var lg)) { segs.Add(new Seg { Ph = lg, Nucleus = true, Short = false }); i += 2; continue; }
            // Iotated vowel letter → optional glide + short vowel nucleus.
            if (IOTATED.TryGetValue(c, out var io))
            {
                var last = segs.Count > 0 ? segs[^1] : null;
                // ⚠ AND AFTER ⟨ъ⟩, which is the only reason the hard sign is written.
                if (segs.Count == 0 || last?.Nucleus == true || At(i - 1) == "ъ")
                    segs.Add(new Seg { Ph = "j", Nucleus = false, Short = false });
                segs.Add(new Seg { Ph = io, Nucleus = true, Short = true });
                i += 1;
                continue;
            }
            // Single short vowel.
            if (V.TryGetValue(c, out var vw)) { segs.Add(new Seg { Ph = vw, Nucleus = true, Short = true }); i += 1; continue; }
            // Soft sign: front the last vowel nucleus, then drop.
            if (c == "ь")
            {
                for (var k = segs.Count - 1; k >= 0; k--)
                {
                    if (segs[k].Nucleus) { segs[k].Ph = FRONT.GetValueOrDefault(segs[k].Ph, segs[k].Ph); break; }
                }
                i += 1;
                continue;
            }
            if (c == "ъ") { i += 1; continue; } // hard sign: separator, no phoneme
            if (CONS.ContainsKey(c)) { segs.Add(new Seg { Ph = ConsIpa(c, i), Nucleus = false, Short = false }); i += 1; continue; }
            i += 1; // unknown char (punctuation) → skip
        }
        return segs;
    }
}
