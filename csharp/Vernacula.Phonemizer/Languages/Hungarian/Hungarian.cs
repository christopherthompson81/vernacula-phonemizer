/**
 * Hungarian (hu, magyar) phonemizer — Uralic, Latin, canonical IPA.
 * Ported from src/languages/hungarian/hungarian.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Hungarian;

public sealed class HungarianPhonemizer : ILanguage
{
    private static IReadOnlyList<HungarianRule> RULES => Manifest.RULES;
    private static IReadOnlyDictionary<string, string> CLAUSE_MARK => Manifest.MANIFEST.ClausePunctuation;

    private sealed class Seg
    {
        public string Ph = "";
        public bool V;
    }

    private static readonly JsRe CSZ_HARMINC_KILENC = JsRegex.Compile("(?:harmin|kilen)c$", "u");
    private static readonly JsRe CH_ALLATIVE = JsRegex.Compile("^ch(?:oz|ez|öz)$", "u");
    private static readonly JsRe LONG_MARK = JsRegex.Compile("ː$", "u");
    private static readonly JsRe LONG_MARK_END = JsRegex.Compile("ː$");

    /** Scan a lowercased Hungarian word into IPA segments (longest-match), then collapse a doubled single consonant
     *  to length (ll→lː, jj→jː, ss→ʃː) — the geminate DIGRAPHS (ssz→sː) are already single Cː segments from
     * the scan. */
    private static List<Seg> ToSegments(string word)
    {
        var w = word.ToLowerInvariant();
        var segs = new List<Seg>();
        var i = 0;
        while (i < w.Length)
        {
            var matched = false;
            foreach (var rule in RULES)
            {
                var orth = rule.Orth;
                // ⟨csz⟩ is c + sz across a morpheme boundary, never cs + z; longest-match would otherwise take
                // ⟨cs⟩ and leave a bare ⟨z⟩ that regressive voicing turns into [d͡ʒz]. Skipping the digraph here
                // lets ⟨c⟩ then ⟨sz⟩ match.
                if (orth == "cs" && w.AsSpan(i).StartsWith("csz", StringComparison.Ordinal)) continue;
                // Same shape for ⟨ch⟩: c + h across a morpheme boundary (harminc+hat, arc+hoz) must beat the
                // ⟨ch⟩ digraph, which exists only for foreign names.
                if (orth == "ch"
                    && (CSZ_HARMINC_KILENC.IsMatch(w[..Math.Min(i + 1, w.Length)]) || CH_ALLATIVE.IsMatch(w[i..])))
                    continue;

                if (w.AsSpan(i).StartsWith(orth, StringComparison.Ordinal))
                {
                    segs.Add(new Seg { Ph = rule.Ipa, V = rule.V });
                    i += orth.Length;
                    matched = true;
                    break;
                }
            }
            if (!matched) i++; // unknown char (punctuation) → skip
        }
        var outp = new List<Seg>();
        foreach (var s in segs)
        {
            var prev = outp.Count > 0 ? outp[^1] : null;
            if (prev is not null && !prev.V && !s.V && prev.Ph == s.Ph && !LONG_MARK_END.IsMatch(s.Ph))
            {
                prev.Ph += "ː";
                continue;
            }
            outp.Add(new Seg { Ph = s.Ph, V = s.V });
        }
        var PAL = new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["d"] = "ɟ", ["t"] = "c", ["n"] = "ɲ", ["l"] = "j", ["ɟ"] = "ɟ", ["c"] = "c",
        };
        for (var k = 0; k < outp.Count - 1; k++)
        {
            if (outp[k + 1].Ph == "j" && PAL.TryGetValue(Base(outp[k].Ph), out var pal))
            {
                outp[k].Ph = pal + "ː";
                outp.RemoveAt(k + 1);
            }
        }
        for (var k = 0; k < outp.Count - 1; k++)
        {
            if (outp[k].Ph != "n") continue;
            var nb = Base(outp[k + 1].Ph);
            if (nb == "k" || nb == "ɡ") outp[k].Ph = "ŋ";
            else if (nb == "ɟ" || nb == "c") outp[k].Ph = "ɲ";
            else if (nb == "p" || nb == "b") outp[k].Ph = "m";
        }
        VoicingAssimilation(outp);
        MergeGeminates(outp); // devoicing can create an identical-consonant pair across a boundary (feddte→fɛtːɛ)
        return outp;
    }

    /**
     * Merge two adjacent consonants with the same BASE phoneme into one long consonant (t+t / tː+t / t+tː →
     * tː).
     */
    private static void MergeGeminates(List<Seg> segs)
    {
        for (var k = segs.Count - 2; k >= 0; k--)
        {
            Seg a = segs[k], b = segs[k + 1];
            if (!a.V && !b.V && Base(a.Ph) == Base(b.Ph))
            {
                a.Ph = Base(a.Ph) + "ː";
                segs.RemoveAt(k + 1);
            }
        }
    }

    private static readonly IReadOnlyDictionary<string, string> DEVOICE = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["b"] = "p", ["d"] = "t", ["ɡ"] = "k", ["v"] = "f", ["z"] = "s", ["ʒ"] = "ʃ",
        ["d͡z"] = "t͡s", ["d͡ʒ"] = "t͡ʃ", ["ɟ"] = "c",
    };
    private static readonly IReadOnlyDictionary<string, string> VOICE = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["p"] = "b", ["t"] = "d", ["k"] = "ɡ", ["f"] = "v", ["s"] = "z", ["ʃ"] = "ʒ",
        ["t͡s"] = "d͡z", ["t͡ʃ"] = "d͡ʒ", ["c"] = "ɟ",
    };
    private static readonly IReadOnlySet<string> VOICELESS_TRIGGER =
        new HashSet<string>(Manifest.MANIFEST.VoicelessTriggers, StringComparer.Ordinal);
    private static readonly IReadOnlySet<string> VOICED_TRIGGER =
        new HashSet<string>(Manifest.MANIFEST.VoicedTriggers, StringComparer.Ordinal);
    private static string Base(string ph) => LONG_MARK.Replace(ph, "");

    /**
     * Regressive obstruent voicing assimilation (right-to-left so a cluster propagates). Preserves length.
     */
    private static void VoicingAssimilation(List<Seg> segs)
    {
        for (var k = segs.Count - 2; k >= 0; k--)
        {
            string b = Base(segs[k].Ph), nb = Base(segs[k + 1].Ph);
            var lng = segs[k].Ph.EndsWith("ː", StringComparison.Ordinal);
            if (VOICELESS_TRIGGER.Contains(nb) && DEVOICE.TryGetValue(b, out var dv)) segs[k].Ph = dv + (lng ? "ː" : "");
            else if (VOICED_TRIGGER.Contains(nb) && VOICE.TryGetValue(b, out var vc)) segs[k].Ph = vc + (lng ? "ː" : "");
        }
    }

    /** One Hungarian word → canonical IPA with FIXED first-syllable stress. Hungarian primary stress is always
     *  word-initial, so the ˈ precedes the first syllable's onset — i.e. the very start of the word. */
    public static string PhonemizeWord(string word)
    {
        var segs = ToSegments(word);
        if (segs.Count == 0) return "";
        return "ˈ" + string.Concat(segs.Select(s => s.Ph));
    }

    private static readonly JsRe TOKEN = JsRegex.Compile($"({HostWord.LATIN_RUN})|(\\d+)|([.!?…,;:])", "giu");

    /** This language's OWN inventory. */
    private const string NATIVE_CLASS = "[a-záéíóöőúüű]";
    private static readonly Func<string, string> Nat = HostWord.MakeNativiser(NATIVE_CLASS, "iu");

    public string Text(string input)
    {
        return Clauses.AssembleClauses(Normalize.NormalizeHungarian(input), TOKEN, (m, sink) =>
        {
            if (m.Groups[1].Success && m.Groups[1].Value.Length > 0) sink.Emit(PhonemizeWord(Nat(m.Groups[1].Value)));
            else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
            {
                foreach (var wd in Numbers.NumberToWords(Js.Number(m.Groups[2].Value)).Split(' '))
                    sink.Emit(PhonemizeWord(wd));
            }
            else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
            {
                if (CLAUSE_MARK.TryGetValue(m.Groups[3].Value, out var mk) && mk.Length > 0) sink.Pause(mk);
            }
        });
    }

    /** Build the Hungarian phonemizer (longest-match g2p + gemination + fixed first-syllable stress). */
    public static ILanguage CreateHungarian() => new HungarianPhonemizer();

    internal static void RegisterSelf()
    {
        Registry.Register("hungarian", CreateHungarian);
        Registry.RegisterRomanPolicy("hu", RomanOrdinals.ROMAN_POLICY);
    }
}
