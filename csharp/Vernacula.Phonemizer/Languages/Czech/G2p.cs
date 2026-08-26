/**
 * Czech (cs) grapheme→phoneme engine — West Slavic, Latin script, canonical IPA: palatalisation, the ⟨ě⟩
 * realisations, voicing assimilation, syllabic r̩/l̩ and nasal assimilation. Stress is applied in Czech.cs.
 * Ported from src/languages/czech/g2p.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Czech;

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
    private static bool IsVoiced(string p) => TO_VOICELESS.ContainsKey(p);

    /** Scan Czech orthography into IPA phoneme segments (palatalisation + ě + digraphs), before voicing. */
    private static List<Seg> Scan(string word)
    {
        var c = Js.CodePoints(Js.ToLowerCase(word));
        var segs = new List<Seg>();
        for (var i = 0; i < c.Count; i++)
        {
            var ch = c[i];
            var next = i + 1 < c.Count ? c[i + 1] : "";
            var prev = i - 1 >= 0 ? c[i - 1] : "";
            if (ch == "c" && next == "h")
            {
                segs.Add(new Seg { Ph = "x", Nucleus = false });
                i++;
                continue;
            }
            if (next == "u" && (ch == "o" || ch == "a" || ch == "e"))
            {
                segs.Add(new Seg { Ph = ch == "o" ? "oᶷ" : ch == "a" ? "aᶷ" : "ɛᶷ", Nucleus = true });
                i++;
                continue;
            }
            if (VOWEL.TryGetValue(ch, out var v))
            {
                segs.Add(new Seg { Ph = v, Nucleus = true });
                if ("iíyý".Contains(ch, StringComparison.Ordinal) && (VOWEL.ContainsKey(next) || next == "ě"))
                    segs.Add(new Seg { Ph = "j", Nucleus = false });
                continue;
            }
            if (ch == "ě")
            {
                if (prev == "m")
                {
                    segs.Add(new Seg { Ph = "ɲ", Nucleus = false });
                    segs.Add(new Seg { Ph = "ɛ", Nucleus = true });
                }
                // ⚠ A WORD-INITIAL ⟨ě⟩ TAKES THIS BRANCH ON PURPOSE: `prev` is then "" and both JS
                // `includes("")` and .NET `Contains("")` are TRUE, so the reading is jɛ. Do not "fix".
                else if ("bpvf".Contains(prev, StringComparison.Ordinal))
                {
                    segs.Add(new Seg { Ph = "j", Nucleus = false });
                    segs.Add(new Seg { Ph = "ɛ", Nucleus = true });
                }
                else segs.Add(new Seg { Ph = "ɛ", Nucleus = true });
                continue;
            }
            if (PALAT.TryGetValue(ch, out var pal) && PALAT_TRIGGER.Contains(next))
            {
                segs.Add(new Seg { Ph = pal, Nucleus = false });
                continue;
            }
            if (ch == "x")
            {
                segs.Add(new Seg { Ph = "k", Nucleus = false });
                segs.Add(new Seg { Ph = "s", Nucleus = false });
                continue;
            }
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
                s.Ph = s.Ph == "r" ? "r̩" : "l̩";
                s.Nucleus = true;
            }
        }
    }

    /** Regressive voicing assimilation + word-final devoicing, right-to-left over the obstruent clusters. */
    private static void ApplyVoicing(List<Seg> segs)
    {
        for (var i = segs.Count - 1; i >= 0; i--)
        {
            var p = segs[i].Ph;
            if (!IsObstruent(p)) continue;
            var nx = i + 1 < segs.Count ? segs[i + 1] : null;
            string? target = null;
            if (nx is null) target = "voiceless";
            else if (nx.Ph == "ɦ") target = "voiceless";
            else if (IsObstruent(nx.Ph) && nx.Ph != "v" && nx.Ph != "r̝" && nx.Ph != "r̝̊")
                target = IsVoiced(nx.Ph) ? "voiced" : "voiceless";
            if (target == "voiceless" && TO_VOICELESS.TryGetValue(p, out var dv)) segs[i].Ph = dv;
            else if (target == "voiced" && TO_VOICED.TryGetValue(p, out var vd)) segs[i].Ph = vd;
        }
        // ř additionally devoices PROGRESSIVELY after a voiceless consonant — the keys of TO_VOICED are the
        // voiceless obstruents, which is what makes this membership test the "after a voiceless" test.
        for (var i = 1; i < segs.Count; i++)
            if (segs[i].Ph == "r̝" && TO_VOICED.ContainsKey(segs[i - 1].Ph)) segs[i].Ph = "r̝̊";
    }

    /** n → ŋ before a velar k/ɡ. */
    private static void NasalAssim(List<Seg> segs)
    {
        for (var i = 0; i < segs.Count - 1; i++)
            if (segs[i].Ph == "n" && (segs[i + 1].Ph == "k" || segs[i + 1].Ph == "ɡ")) segs[i].Ph = "ŋ";
    }

    /** Degeminate doubled n → n and n+ɲ → ɲ. Other geminates are kept. */
    private static void Degeminate(List<Seg> segs)
    {
        for (var i = segs.Count - 1; i > 0; i--)
        {
            var a = segs[i - 1];
            var b = segs[i];
            if (a.Ph == "n" && (b.Ph == "n" || b.Ph == "ɲ")) segs.RemoveAt(i - 1);
        }
    }

    /** Czech word → IPA phoneme segments (scan + syllabic + degemination + voicing + nasal assimilation). */
    public static List<Seg> ToSegments(string word)
    {
        var segs = Scan(word);
        MarkSyllabic(segs);
        Degeminate(segs);
        ApplyVoicing(segs);
        NasalAssim(segs);
        return segs;
    }
}
