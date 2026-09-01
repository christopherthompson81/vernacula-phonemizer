/**
 * Slovak (sk) grapheme→phoneme engine — West Slavic, Latin script, canonical IPA: palatalisation of d/t/n/l
 * before the soft vowels, the rising diphthongs, syllabic r̩/l̩ (long ĺ/ŕ), gemination, and regressive voicing
 * assimilation with word-final devoicing. ⟨v⟩ is a limited target; ⟨h⟩=ɦ pairs with ⟨ch⟩=x. Stress is applied
 * in Slovak.cs.
 * Ported from src/languages/slovak/g2p.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Slovak;

public sealed class Seg
{
    public required string Ph { get; set; }
    public required bool Nucleus { get; set; }
}

public static class G2p
{
    private static IReadOnlyDictionary<string, string> VOWEL => Manifest.MANIFEST.Vowels;
    private static IReadOnlyDictionary<string, string> PALAT => Manifest.MANIFEST.Palatalisation.Map;
    private static readonly IReadOnlySet<string> PALAT_TRIGGER =
        new HashSet<string>(Manifest.MANIFEST.Palatalisation.Triggers, StringComparer.Ordinal);
    private static IReadOnlyDictionary<string, string> CONS => Manifest.MANIFEST.Consonants;
    private static IReadOnlyDictionary<string, string> TO_VOICELESS => Manifest.MANIFEST.Voicing.ToVoiceless;
    private static IReadOnlyDictionary<string, string> TO_VOICED => Manifest.MANIFEST.Voicing.ToVoiced;

    private static bool IsObstruent(string p) => TO_VOICELESS.ContainsKey(p) || TO_VOICED.ContainsKey(p);
    private static bool IsVoiced(string p) => TO_VOICELESS.ContainsKey(p); // voiced obstruents are the keys of the devoicing map

    /** Scan Slovak orthography into IPA phoneme segments (digraphs + diphthongs + palatalisation), before voicing. */
    private static List<Seg> Scan(string word)
    {
        var c = Js.CodePoints(Js.ToLowerCase(word));
        var segs = new List<Seg>();
        for (var i = 0; i < c.Count; i++)
        {
            var ch = c[i];
            var next = i + 1 < c.Count ? c[i + 1] : "";
            // digraphs: ch → x, dz → d͡z, dž → d͡ʒ (before the d/z/c singles)
            if (ch == "c" && next == "h") { segs.Add(new Seg { Ph = "x", Nucleus = false }); i++; continue; }
            if (ch == "d" && next == "z") { segs.Add(new Seg { Ph = "d\u0361z", Nucleus = false }); i++; continue; }
            if (ch == "d" && next == "ž") { segs.Add(new Seg { Ph = "d\u0361\u0292", Nucleus = false }); i++; continue; }
            // ⟨x⟩ → k s
            if (ch == "x")
            {
                segs.Add(new Seg { Ph = "k", Nucleus = false });
                segs.Add(new Seg { Ph = "s", Nucleus = false });
                continue;
            }
            // rising diphthongs ⟨ia ie iu⟩ → ɪ̯a/ɪ̯e/ɪ̯u, ⟨ô⟩ → u̯ɔ
            if (ch == "i" && (next == "a" || next == "e" || next == "u"))
            {
                segs.Add(new Seg { Ph = next == "a" ? "\u026a\u032fa" : next == "e" ? "\u026a\u032fe" : "\u026a\u032fu", Nucleus = true });
                i++;
                continue;
            }
            if (ch == "ô") { segs.Add(new Seg { Ph = "u\u032f\u0254", Nucleus = true }); continue; }
            // long syllabic liquids ⟨ĺ ŕ⟩
            if (ch == "ĺ") { segs.Add(new Seg { Ph = "l\u0329\u02d0", Nucleus = true }); continue; }
            if (ch == "ŕ") { segs.Add(new Seg { Ph = "r\u0329\u02d0", Nucleus = true }); continue; }
            // plain vowel (incl. ä)
            if (VOWEL.TryGetValue(ch, out var v)) { segs.Add(new Seg { Ph = v, Nucleus = true }); continue; }
            // d/t/n/l palatalise before a trigger (i/í/e); an i-diphthong is covered because its leading "i" is a trigger.
            if (PALAT.TryGetValue(ch, out var pal) && PALAT_TRIGGER.Contains(next)) { segs.Add(new Seg { Ph = pal, Nucleus = false }); continue; }
            if (CONS.TryGetValue(ch, out var cons)) segs.Add(new Seg { Ph = cons, Nucleus = false });
            // else: unknown char (skip)
        }
        return segs;
    }

    /** Mark r/l as syllabic (r̩/l̩, a nucleus) when neither neighbour is a vowel nucleus. */
    private static void MarkSyllabic(List<Seg> segs)
    {
        for (var i = 0; i < segs.Count; i++)
        {
            var s = segs[i];
            if (s.Ph != "r" && s.Ph != "l") continue;
            var leftV = i - 1 >= 0 && segs[i - 1].Nucleus;
            var rightV = i + 1 < segs.Count && segs[i + 1].Nucleus;
            if (!leftV && !rightV)
            {
                s.Ph = s.Ph == "r" ? "r\u0329" : "l\u0329";
                s.Nucleus = true;
            }
        }
    }

    /** Regressive voicing assimilation + word-final devoicing, right-to-left over obstruent clusters.
     *  ⟨v⟩ is a limited target: it devoices to [f] only before an ONSET voiceless obstruent, and never triggers. */
    private static void ApplyVoicing(List<Seg> segs)
    {
        for (var i = segs.Count - 1; i >= 0; i--)
        {
            var p = segs[i].Ph;
            if (p == "v")
            {
                var nx2 = i + 1 < segs.Count ? segs[i + 1] : null;
                var codaV = i - 1 >= 0 && segs[i - 1].Nucleus;
                if (!codaV && nx2 is not null && IsObstruent(nx2.Ph) && nx2.Ph != "v" && !IsVoiced(nx2.Ph)) segs[i].Ph = "f";
                continue; // otherwise v is inert; and it never triggers voicing on a preceding obstruent
            }
            if (!IsObstruent(p)) continue;
            var nx = i + 1 < segs.Count ? segs[i + 1] : null;
            string? target = null;
            if (nx is null) target = "voiceless"; // word-final devoicing
            else if (IsObstruent(nx.Ph) && nx.Ph != "v")
                target = IsVoiced(nx.Ph) ? "voiced" : "voiceless"; // before a sonorant/vowel/v: keep base voicing
            if (target == "voiceless" && TO_VOICELESS.TryGetValue(p, out var dv)) segs[i].Ph = dv;
            else if (target == "voiced" && TO_VOICED.TryGetValue(p, out var vd)) segs[i].Ph = vd;
        }
    }

    /** Merge a doubled consonant into a geminate [Cː] (mäkký→mækːiː, vyšší→viʃːiː). */
    private static void Geminate(List<Seg> segs)
    {
        for (var i = segs.Count - 1; i > 0; i--)
        {
            var a = segs[i - 1];
            var b = segs[i];
            if (!a.Nucleus && !b.Nucleus && a.Ph == b.Ph)
            {
                a.Ph = a.Ph + "\u02d0";
                segs.RemoveAt(i);
            }
        }
    }

    /** Slovak word → IPA phoneme segments (scan + syllabic + gemination + voicing). n→ŋ velar assimilation is
     *  deliberately NOT applied — the broad referee keeps [n] before k/ɡ. */
    public static List<Seg> ToSegments(string word)
    {
        var segs = Scan(word);
        MarkSyllabic(segs);
        Geminate(segs);
        ApplyVoicing(segs);
        return segs;
    }
}
