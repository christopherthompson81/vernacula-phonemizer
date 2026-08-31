/**
 * Latvian (lv) grapheme→phoneme engine — Baltic, Latin script, canonical IPA. Latvian writes what Lithuanian
 * leaves implicit, so the scan is largely direct: written palatals (ģ ķ ļ ņ → ɟ c ʎ ɲ) and written length
 * (macron ā ē ī ū → aː eː iː uː). The context systems:
 *   · native ⟨o⟩ → the falling diphthong [uɔ̯] (loks→luɔ̯ks);
 *   · falling DIPHTHONGS — a short vowel immediately followed by ⟨i⟩/⟨u⟩ takes it as a non-syllabic offglide,
 *     but ONLY for the real Latvian pairs (ai ei ui / au iu); ⟨ie⟩ → [iɛ], with ⟨i⟩ the nucleus;
 *   · ⟨v⟩ vocalizes to [w] in the coda, stays [v] before a vowel;
 *   · VOICING — regressive assimilation within obstruent clusters; n → ŋ before a velar.
 * Stress (fixed first-syllable) is applied in Latvian.cs. Ported from src/languages/latvian/g2p.ts.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Latvian;

/** One scanned segment. Mutable: the assimilation passes rewrite `Ph`. */
public sealed class Seg
{
    public required string Ph { get; set; }
    public required bool Nucleus { get; init; }
}

public static class G2p
{
    private static LatvianManifest M => Manifest.MANIFEST;
    private static IReadOnlyDictionary<string, string> V => M.Vowels;
    private static IReadOnlyDictionary<string, string> LV => M.LongVowels;
    private static IReadOnlyDictionary<string, string> C => M.Consonants;
    private static IReadOnlyDictionary<string, string> CDI => M.ConsonantDigraphs;
    private static IReadOnlyDictionary<string, string> TO_VOICELESS => M.Voicing.ToVoiceless;

    /** Voiced obstruents key the devoicing map; voiceless ones key the voicing map. */
    private static bool IsVoiced(string p) => TO_VOICELESS.ContainsKey(p);
    private static bool IsVoiceless(string p) => M.Voicing.ToVoiced.ContainsKey(p);
    /** ⟨o⟩ is special-cased in the scan and so is NOT in the vowel table. */
    private static bool IsVowelChar(string c) =>
        c.Length != 0 && (V.ContainsKey(c) || LV.ContainsKey(c) || c == "o");

    // The Latvian falling diphthongs — the only (short-vowel nucleus, ⟨i⟩/⟨u⟩ offglide) pairs. A LONG vowel
    // or any other pair (eu, ou, ii) is HIATUS, not a diphthong.
    private static readonly IReadOnlySet<string> I_OFFGLIDE =
        new HashSet<string>(new[] { "a", "ɛ", "u" }, StringComparer.Ordinal); // ai ei ui
    private static readonly IReadOnlySet<string> U_OFFGLIDE =
        new HashSet<string>(new[] { "a", "i" }, StringComparer.Ordinal);      // au iu

    private static readonly JsRe VELAR = JsRegex.Compile("^[kɡ]", "");

    /** Scan Latvian orthography into IPA segments (digraphs + native-⟨o⟩ + diphthong offglides), pre-voicing. */
    private static List<Seg> Scan(string word)
    {
        var w = Js.CodePoints(Js.ToLowerCase(word));
        var segs = new List<Seg>();
        var n = w.Count;
        var i = 0;

        // Emit a SHORT vowel nucleus, then take a following ⟨i⟩/⟨u⟩ as a non-syllabic offglide ONLY when the
        // pair is a real Latvian diphthong. The offglide is the plain vowel [i]/[u].
        void Vowel(string ph)
        {
            segs.Add(new Seg { Ph = ph, Nucleus = true });
            var nx = i + 1 < n ? w[i + 1] : null;
            if ((nx == "i" && I_OFFGLIDE.Contains(ph)) || (nx == "u" && U_OFFGLIDE.Contains(ph)))
            {
                segs.Add(new Seg { Ph = V[nx], Nucleus = false });
                i += 1;
            }
        }

        while (i < n)
        {
            var c = w[i];
            var two = c + (i + 1 < n ? w[i + 1] : "");
            if (CDI.TryGetValue(two, out var dg)) { segs.Add(new Seg { Ph = dg, Nucleus = false }); i += 2; continue; }
            if (two == "ie")
            {
                segs.Add(new Seg { Ph = "i", Nucleus = true });
                segs.Add(new Seg { Ph = "ɛ", Nucleus = false });
                i += 2;
                continue;
            }
            if (LV.TryGetValue(c, out var lv)) { Vowel(lv); i += 1; continue; }
            if (c == "o")
            {
                segs.Add(new Seg { Ph = "u", Nucleus = true });
                segs.Add(new Seg { Ph = "ɔ̯", Nucleus = false });
                i += 1;
                continue;
            }
            if (V.TryGetValue(c, out var v)) { Vowel(v); i += 1; continue; }
            // ⟨v⟩ vocalizes to [w] in the coda (before a consonant / word-final: dievs→diɛws) but is [v]
            // before a vowel.
            if (c == "v")
            {
                segs.Add(new Seg { Ph = IsVowelChar(i + 1 < n ? w[i + 1] : "") ? "v" : "w", Nucleus = false });
                i += 1;
                continue;
            }
            if (C.TryGetValue(c, out var cn)) { segs.Add(new Seg { Ph = cn, Nucleus = false }); i += 1; continue; }
            // ⚠ A letter with no rule here still denotes a sound; dropping it deletes what the writer typed.
            // Only reached when every grapheme (digraphs included) has declined.
            var p = LatinPhones.LatinPhone(c, new PhoneOpts { Initial = i == 0, IncludeH = true });
            if (p is not null) segs.Add(new Seg { Ph = p, Nucleus = false });
            i += 1;
        }
        return segs;
    }

    /** n → ŋ before a velar k/ɡ. */
    private static void NasalAssim(List<Seg> segs)
    {
        for (var i = 0; i < segs.Count - 1; i++)
            if (segs[i].Ph == "n" && VELAR.IsMatch(segs[i + 1].Ph)) segs[i].Ph = "ŋ";
    }

    /** Regressive DEVOICING over obstruent clusters. ⚠ Latvian does NOT apply the reverse direction across a
     *  boundary (atgriezt keeps [atɡ], not [adɡ]), so only devoicing fires; and there is no word-final
     *  devoicing — draugs→drau̯ks is the regressive rule before the final -s. */
    private static void ApplyVoicing(List<Seg> segs)
    {
        for (var i = segs.Count - 2; i >= 0; i--)
        {
            var p = segs[i].Ph;
            if (IsVoiced(p) && IsVoiceless(segs[i + 1].Ph)) segs[i].Ph = TO_VOICELESS[p];
        }
    }

    /** Latvian word → IPA segments (scan + ŋ-assimilation + regressive voicing). Stress is added in Latvian.cs. */
    public static List<Seg> ToSegments(string word)
    {
        var segs = Scan(word);
        NasalAssim(segs);
        ApplyVoicing(segs);
        return segs;
    }
}
