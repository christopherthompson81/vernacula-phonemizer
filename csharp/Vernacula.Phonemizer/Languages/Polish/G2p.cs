/**
 * Polish (pl) grapheme→phoneme engine — West Slavic, Latin script, canonical IPA. Pipeline: scan (digraphs +
 * the ⟨i⟩ palatalizer) → nasal-vowel realization → nasal assimilation → voicing assimilation.
 * Ported from src/languages/polish/g2p.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Polish;

public sealed class Seg
{
    public required string Ph { get; set; }
    public required bool Nucleus { get; init; }
    public bool Nasal { get; init; } // an ą/ę nasal vowel, resolved by nasalRealization
    public bool Rz { get; init; }    // a ⟨rz⟩ [ʐ]: devoices progressively after a voiceless obstruent and does NOT trigger regressive voicing (cf. ż)
}

public static class G2p
{
    private static IReadOnlyDictionary<string, string> VOWEL => Manifest.MANIFEST.Vowels;
    private static IReadOnlyDictionary<string, string> NASAL => Manifest.MANIFEST.NasalVowels;
    private static IReadOnlyDictionary<string, string> CONS => Manifest.MANIFEST.Consonants;
    private static IReadOnlyDictionary<string, string> DIGRAPH => Manifest.MANIFEST.Digraphs;
    private static IReadOnlyDictionary<string, string> SOFT_I => Manifest.MANIFEST.SoftI; // c/s/z/n + i → the soft series
    private static IReadOnlyDictionary<string, string> TO_VOICELESS => Manifest.MANIFEST.Voicing.ToVoiceless;
    private static IReadOnlyDictionary<string, string> TO_VOICED => Manifest.MANIFEST.Voicing.ToVoiced;

    private static bool IsObstruent(string p) => TO_VOICELESS.ContainsKey(p) || TO_VOICED.ContainsKey(p);
    private static bool IsVoiced(string p) => TO_VOICELESS.ContainsKey(p);
    // ⚠ `ch.length === 1` IN THE TS IS A UTF-16 LENGTH; every letter this can receive is BMP, so the code-unit
    // count and the code-point count agree. Kept as a length test on the code point for that reason.
    private static bool IsVowelLetter(string ch) => ch.Length == 1 && "aeiouóyąę".Contains(ch, StringComparison.Ordinal);

    /** Scan Polish orthography → IPA segments (digraphs, the ⟨i⟩ palatalizer, nasal-vowel marking). */
    private static List<Seg> Scan(string word)
    {
        var w = Js.CodePoints(word.ToLowerInvariant());
        var segs = new List<Seg>();
        var n = w.Count;
        string At(int k) => k >= 0 && k < n ? w[k] : "";
        for (var i = 0; i < n;)
        {
            var ch = w[i];
            // ⚠ THE TRIGRAPH ⟨dzi⟩ IS CLAIMED BEFORE THE ⟨dz⟩ DIGRAPH BELOW, or the soft affricate is read as
            // a hard dz followed by an i. The ⟨i⟩ is silent before a vowel (ludzie), else it is the [i] vowel.
            if (ch == "d" && At(i + 1) == "z" && At(i + 2) == "i")
            {
                segs.Add(new Seg { Ph = "d͡ʑ", Nucleus = false });
                if (!IsVowelLetter(At(i + 3))) segs.Add(new Seg { Ph = "i", Nucleus = true });
                i += 3;
                continue;
            }
            var dg = ch + At(i + 1);
            if (DIGRAPH.TryGetValue(dg, out var dgPh) && dgPh != "")
            {
                segs.Add(new Seg { Ph = dgPh, Nucleus = false, Rz = dg == "rz" });
                i += 2;
                continue;
            }
            if (SOFT_I.TryGetValue(ch, out var softPh) && softPh != "" && At(i + 1) == "i")
            {
                segs.Add(new Seg { Ph = softPh, Nucleus = false });
                i = AdvanceSoft(w, segs, i);
                continue;
            }
            if (ch == "i")
            {
                if (IsVowelLetter(At(i + 1))) segs.Add(new Seg { Ph = "j", Nucleus = false });
                else segs.Add(new Seg { Ph = "i", Nucleus = true });
                i++;
                continue;
            }
            if (VOWEL.TryGetValue(ch, out var vPh) && vPh != "")
            {
                // ⟨au⟩ → the w-glide in loanwords (auto→awtɔ), but the na-/za- PREFIX plus a u-initial root is
                // HIATUS (nauka→na.u.ka), so the glide is skipped there. eu/ou stay hiatus, being loan-ambiguous.
                var auPrefix = i == 2 && (At(0) == "n" || At(0) == "z");
                if (ch == "u" && At(i - 1) == "a" && !auPrefix) segs.Add(new Seg { Ph = "w", Nucleus = false });
                else segs.Add(new Seg { Ph = vPh, Nucleus = true });
                i++;
                continue;
            }
            if (NASAL.TryGetValue(ch, out var nPh) && nPh != "")
            {
                segs.Add(new Seg { Ph = nPh, Nucleus = true, Nasal = true });
                i++;
                continue;
            }
            if (CONS.TryGetValue(ch, out var cPh) && cPh != "") segs.Add(new Seg { Ph = cPh, Nucleus = false });
            i++;
        }
        return segs;
    }

    /** After a soft/velar consonant + ⟨i⟩ at index i: consume "Ci"; the i is silent before a vowel, else it is
     *  the [i] vowel. */
    private static int AdvanceSoft(IReadOnlyList<string> w, List<Seg> segs, int i)
    {
        var after = i + 2 < w.Count ? w[i + 2] : "";
        if (!IsVowelLetter(after)) segs.Add(new Seg { Ph = "i", Nucleus = true });
        return i + 2;
    }

    /** Resolve ą/ę: oral + homorganic nasal before a stop/affricate; nasalized ɔ̃/ɛ̃ before a fricative or final ą; ę
     *  word-final denasalizes to ɛ. */
    private static void NasalRealization(List<Seg> segs)
    {
        for (var i = 0; i < segs.Count; i++)
        {
            var s = segs[i];
            if (!s.Nasal) continue;
            var nx = i + 1 < segs.Count ? segs[i + 1] : null;
            if (nx is null)
            {
                if (s.Ph == "ɛ") continue; // ę-final = ɛ
                s.Ph = "ɔw̃"; // ą-final = ɔw̃
                continue;
            }
            var homorganic = NasalBefore(nx.Ph);
            if (homorganic == "w̃") s.Ph += "w̃"; // before a palatal fricative ɕ/ʑ → a nasal w-glide (gęś→ɡɛw̃ɕ)
            else if (homorganic is not null) segs.Insert(i + 1, new Seg { Ph = homorganic, Nucleus = false });
            else s.Ph += "̃"; // before a sonorant → nasalized vowel
        }
    }

    /** ą/ę → oral vowel + a homorganic nasal element before a following consonant: [m]/[n]/[ŋ] before an
     *  obstruent, a [w̃] glide before a palatal fricative ɕ/ʑ, and pure vowel-nasalization before a sonorant.
     *  Returns the nasal consonant, "w̃" for the glide, or null → nasalize the vowel. */
    private static string? NasalBefore(string p)
    {
        if (p.Length == 1 && "pbfv".Contains(p, StringComparison.Ordinal)) return "m"; // labial
        if (p == "ɕ" || p == "ʑ") return "w̃"; // palatal fricative → nasal glide
        if (p == "t͡ɕ" || p == "d͡ʑ") return "ɲ"; // palatal affricate
        if (p == "k" || p == "ɡ" || p == "x") return "ŋ"; // velar
        if ((p.Length == 1 && "tdsz".Contains(p, StringComparison.Ordinal)) ||
            p == "t͡s" || p == "d͡z" || p == "t͡ʂ" || p == "d͡ʐ" || p == "ʂ" || p == "ʐ")
            return "n"; // dental / alveolar / retroflex obstruent
        return null; // sonorant (l, ł→w, r, j, nasals) → nasalized vowel
    }

    /**
     * Regressive voicing assimilation + word-final devoicing; progressive devoicing of v/ʐ after a voiceless
     * obstruent.
     */
    private static void ApplyVoicing(List<Seg> segs)
    {
        for (var i = segs.Count - 1; i >= 0; i--)
        {
            var p = segs[i].Ph;
            if (!IsObstruent(p)) continue;
            var nx = i + 1 < segs.Count ? segs[i + 1] : null;
            string? target = null;
            if (nx is null) target = "voiceless"; // final devoicing
            // ⚠ /v/ (from ⟨w⟩) and ⟨rz⟩ are TARGETS of assimilation but do NOT trigger it — they devoice
            // progressively in the second loop instead, which is what the `Rz` flag on the segment is for.
            else if (IsObstruent(nx.Ph) && nx.Ph != "v" && !nx.Rz)
                target = IsVoiced(nx.Ph) ? "voiced" : "voiceless";
            if (target == "voiceless" && TO_VOICELESS.TryGetValue(p, out var dev)) segs[i].Ph = dev;
            else if (target == "voiced" && TO_VOICED.TryGetValue(p, out var voi)) segs[i].Ph = voi;
        }
        // Progressive: v and ⟨rz⟩ [ʐ] devoice after a voiceless obstruent (świat→ɕfjat, przez→pʂɛs).
        for (var i = 1; i < segs.Count; i++)
        {
            var prev = segs[i - 1].Ph;
            if ((segs[i].Ph == "v" || (segs[i].Rz && segs[i].Ph == "ʐ")) && IsObstruent(prev) && !IsVoiced(prev))
                segs[i].Ph = segs[i].Ph == "v" ? "f" : "ʂ";
        }
    }

    /** n → ŋ before a velar k/ɡ/x (bank→baŋk, abdanch→abdaŋx). */
    private static void NasalAssim(List<Seg> segs)
    {
        for (var i = 0; i < segs.Count - 1; i++)
        {
            var nx = segs[i + 1].Ph;
            if (segs[i].Ph == "n" && (nx == "k" || nx == "ɡ" || nx == "x")) segs[i].Ph = "ŋ";
        }
    }

    /** Polish word → IPA phoneme segments. */
    public static List<Seg> ToSegments(string word)
    {
        // ORDER MATTERS: the nasal passes insert segments that voicing then has to see, and voicing runs LAST
        // so it assimilates across the segments the nasal realization introduced.
        var segs = Scan(word);
        NasalRealization(segs);
        NasalAssim(segs);
        ApplyVoicing(segs);
        return segs;
    }
}
