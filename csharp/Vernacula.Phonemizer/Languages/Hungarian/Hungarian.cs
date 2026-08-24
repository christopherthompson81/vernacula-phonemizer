/**
 * Hungarian (hu, magyar) phonemizer — Uralic, Latin, canonical IPA. A longest-match scan
 * (g2p reads the rule table in hungarian.jsonc): trigraphs / geminate-digraphs / digraphs before single letters,
 * then a doubled-single-consonant → Cː gemination pass, then FIXED first-syllable stress (Hungarian). Signature:
 * ⟨s⟩→[ʃ] / ⟨sz⟩→[s], ⟨gy⟩→[ɟ] / ⟨ty⟩→[c], ⟨a⟩→[ɒ], the full long/short vowel system. text() tokenizes words /
 * numbers / punctuation.
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
     *  to length (ll→lː, jj→jː, ss→ʃː) — the geminate DIGRAPHS (ssz→sː) are already single Cː segments from the scan. */
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
                // ⟨csz⟩ is c + sz across a MORPHEME BOUNDARY, never cs + z. Longest-match otherwise took the
                // ⟨cs⟩ digraph and left a bare ⟨z⟩, which regressive voicing then turned into [d͡ʒz] — so
                // *nyolcszáz* and *kilencszáz* came out ˈɲold͡ʒzaːz / ˈkilɛnd͡ʒzaːz, i.e. every numeral with 8
                // or 9 in a hundreds group (91 of them in the hu_hu corpus, the whole 18xx/19xx year range
                // among them). The productive `-szor/-szer` and compound cases (kilencszer, táncszám) take
                // the same boundary; cs+z needs a cs-final stem before a z-initial one and is vanishingly
                // rare. Skipping the digraph here lets ⟨c⟩ then ⟨sz⟩ match from the manifest table.
                if (orth == "cs" && w.AsSpan(i).StartsWith("csz", StringComparison.Ordinal)) continue;
                // ⚠ ⟨ch⟩ IS c + h ACROSS A MORPHEME BOUNDARY in two native shapes, and the digraph added for
                // foreign names (see hungarian.jsonc) would swallow both. Same failure as ⟨csz⟩ above, found
                // the same way — by measuring: 12 rows regressed on *harminchat* / *harmincharom* before this
                // guard existed, and every one of them came from OUR OWN numeral compositor rather than the
                // corpus text, which contains no native c+h word at all.
                //   · a c-final numeral stem before an h-initial one — harminc+hat, harminc+harom, kilenc+het
                //   · the productive allative -hoz/-hez/-hoz on any c-final noun — arc+hoz, tanc+hoz, perc+hez.
                //     Not attested in this corpus; guarded anyway, because a silent regression on ordinary
                //     inflection would cost more than the foreign names gain.
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
        // Gemination: two adjacent identical single-consonant segments → one long consonant (Cː).
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
        // j-palatalization: a coronal d/t/n/l (or ɟ/c) + ⟨j⟩ → a long palatal (feddj→[fɛɟː], adj→[ɒɟː], bánja→
        // [baːɲːɒ], hallja→[hɒjːɒ]) — the productive Hungarian imperative/3sg assimilation. Consumes the ⟨j⟩.
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
        // Nasal PLACE assimilation: /n/ takes the place of a following stop — [ŋ] before velar k/ɡ (hang→hɒŋɡ),
        // [ɲ] before palatal ɟ/c (angyal→ɒɲɟɒl, Lengyel→lɛɲɟɛl), [m] before labial p/b (színpad→siːmpɒd).
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

    /** Merge two adjacent consonants with the same BASE phoneme into one long consonant (t+t / tː+t / t+tː → tː). */
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

    // Obstruent voicing pairs (base phoneme, no length). Hungarian has REGRESSIVE voicing assimilation: an obstruent
    // takes the voicing of a following obstruent (biztat→[bistɒt] z→s; lég·szivattyú→[leːk…] ɡ→k; vasgolyó→[vaʒɡ…]).
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
    // Voiced obstruents that TRIGGER voicing of a preceding one — /v/ and /h/ are excluded (v devoices but does not
    // voice a preceding obstruent; h is not a trigger).
    private static readonly IReadOnlySet<string> VOICED_TRIGGER =
        new HashSet<string>(Manifest.MANIFEST.VoicedTriggers, StringComparer.Ordinal);
    private static string Base(string ph) => LONG_MARK.Replace(ph, "");

    /** Regressive obstruent voicing assimilation (right-to-left so a cluster propagates). Preserves length. */
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

    // A word (Hungarian letters incl. accented vowels) / number / punctuation token.
    private static readonly JsRe TOKEN = JsRegex.Compile($"({HostWord.LATIN_RUN})|(\\d+)|([.!?…,;:])", "giu");

    /**
     * This language's OWN inventory. ⚠ TWO DIFFERENT QUESTIONS, KEPT APART: the TOKEN class above decides where
     * the SCRIPT boundary falls (routing), while this one decides whether the g2p has rules for these letters. A
     * token this class REJECTS carries a letter the language does not use — i.e. a foreign name. See
     * core/hostWord.ts.
     */
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
