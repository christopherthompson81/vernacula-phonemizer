/**
 * Slovenian (sl) grapheme→phoneme scan: digraphs + lj/nj + syllabic-r + regressive voicing/final devoicing.
 * Ported from src/languages/slovenian/g2p.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Slovenian;

public sealed class Seg
{
    public string Ph = "";
    public bool Nucleus;
}

public static class G2p
{
    private static IReadOnlyDictionary<string, string> VOWEL => Manifest.MANIFEST.Vowels;
    private static IReadOnlyDictionary<string, string> CONS => Manifest.MANIFEST.Consonants;
    private static IReadOnlyDictionary<string, string> TO_VOICELESS => Manifest.MANIFEST.Voicing.ToVoiceless;
    private static IReadOnlyDictionary<string, string> TO_VOICED => Manifest.MANIFEST.Voicing.ToVoiced;

    private static bool IsObstruent(string p) => TO_VOICELESS.ContainsKey(p) || TO_VOICED.ContainsKey(p);
    private static bool IsVoiced(string p) => TO_VOICELESS.ContainsKey(p);
    private static bool IsVowelLetter(string ch) => VOWEL.ContainsKey(ch);

    /** Scan Slovene orthography into IPA segments, before syllabic-r and voicing. */
    private static List<Seg> Scan(string word)
    {
        var c = Js.CodePoints(word.ToLowerInvariant());
        var segs = new List<Seg>();
        for (var i = 0; i < c.Count; i++)
        {
            var ch = c[i];
            var next = i + 1 < c.Count ? c[i + 1] : "";
            var next2 = i + 2 < c.Count ? c[i + 2] : "";

            if (ch == "d" && next == "ž") { segs.Add(new Seg { Ph = "d͡ʒ" }); i++; continue; }
            if (ch == "l" && next == "j")
            {
                segs.Add(new Seg { Ph = "l" });
                if (IsVowelLetter(next2)) segs.Add(new Seg { Ph = "j" });
                i++;
                continue;
            }
            if (ch == "n" && next == "j")
            {
                segs.Add(new Seg { Ph = "n" });
                if (IsVowelLetter(next2)) segs.Add(new Seg { Ph = "j" });
                i++;
                continue;
            }
            if (ch == "l") { segs.Add(new Seg { Ph = "l" }); continue; }
            if (ch == "x") { segs.Add(new Seg { Ph = "k" }); segs.Add(new Seg { Ph = "s" }); continue; }
            if (VOWEL.TryGetValue(ch, out var v)) { segs.Add(new Seg { Ph = v, Nucleus = true }); continue; }
            if (CONS.TryGetValue(ch, out var cons)) segs.Add(new Seg { Ph = cons });
            // else: unknown char (skip)
        }
        return segs;
    }

    /** A syllabic ⟨r⟩ (an r with no vowel-nucleus neighbour) takes a preceding schwa. */
    private static void SyllabicR(List<Seg> segs)
    {
        for (var i = segs.Count - 1; i >= 0; i--)
        {
            if (segs[i].Ph != "r") continue;
            var leftV = i - 1 >= 0 && segs[i - 1].Nucleus;
            var rightV = i + 1 < segs.Count && segs[i + 1].Nucleus;
            if (!leftV && !rightV) segs.Insert(i, new Seg { Ph = "ə", Nucleus = true });
        }
    }

    /** Regressive voicing assimilation + word-final devoicing, right-to-left over obstruent clusters. */
    private static void ApplyVoicing(List<Seg> segs)
    {
        for (var i = segs.Count - 1; i >= 0; i--)
        {
            var p = segs[i].Ph;
            if (!IsObstruent(p)) continue;
            var nx = i + 1 < segs.Count ? segs[i + 1] : null;
            string? target = null;
            if (nx is null) target = "voiceless";
            else if (IsObstruent(nx.Ph) && nx.Ph != "x" && nx.Ph != "ɣ")
                target = IsVoiced(nx.Ph) ? "voiced" : "voiceless";
            if (target == "voiceless" && TO_VOICELESS.TryGetValue(p, out var dv)) segs[i].Ph = dv;
            else if (target == "voiced" && TO_VOICED.TryGetValue(p, out var vv)) segs[i].Ph = vv;
        }
    }

    /** Slovene word → IPA phoneme segments (scan + syllabic-r + voicing). */
    public static List<Seg> ToSegments(string word)
    {
        var segs = Scan(word);
        SyllabicR(segs);
        ApplyVoicing(segs);
        return segs;
    }
}
