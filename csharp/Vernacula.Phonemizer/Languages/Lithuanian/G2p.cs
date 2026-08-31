/**
 * Lithuanian rule-based g2p (the Czech pattern). Orthography → IPA phoneme segments:
 *   1. TOKENIZE into letter-units, greedily matching digraphs (⟨ch dz dž⟩ consonants, ⟨ie uo⟩ rising
 *      diphthongs) before single letters.
 *   2. PALATALIZATION — the load-bearing rule. A consonant is soft (Cʲ) when the next unit is a SINGLE front
 *      vowel (⟨e ę ė i į y⟩), the softening ⟨i⟩, ⟨j⟩, the rising diphthong ⟨ie⟩ (which opens on a front [i] —
 *      Dievas → dʲiɛʋɐs), or (spread) a soft consonant to its right. ⟨uo⟩ does NOT trigger (it opens on the
 *      back [u]). Velars ⟨k ɡ⟩ don't receive the leftward spread. Spread is regressive through the cluster.
 *   3. SOFTENING ⟨i⟩ — an ⟨i⟩ between a consonant and a BACK vowel (⟨Cia Cio Ciu Cią Cių Ciū⟩) is silent: it
 *      only marks the preceding consonant soft, so it is dropped after it triggers palatalization (and the
 *      ⟨a⟩ then fronts: čia → t͡ʃʲɛ).
 *   4. VOICING assimilation — regressive within obstruent clusters (dirbti → dʲɪrʲptʲɪ, b→p before t);
 *      sonorants + j/ʋ are transparent.
 *   5. n → ŋ before a velar k/ɡ.
 * Vowel LENGTH and the stressed ɑː/æː quality are stress-conditioned (stress is lexical) → we emit the
 * phonemic short quality; the referee's length and pitch accents are folded.
 */
using Vernacula.Phonemizer.Core;
using static Vernacula.Phonemizer.Core.LatinPhones;

namespace Vernacula.Phonemizer.Languages.Lithuanian;

public sealed class Seg
{
    public string Ph { get; set; } = "";
    public bool Nucleus { get; init; }
}

public static class G2p
{
    private static LithuanianManifest M => Manifest.MANIFEST;
    private static IReadOnlyDictionary<string, string> V => M.Vowels;
    private static IReadOnlyDictionary<string, string> VDI => M.VowelDigraphs;
    private static IReadOnlyDictionary<string, string> C => M.Consonants;
    private static IReadOnlyDictionary<string, string> CDI => M.ConsonantDigraphs;
    private static readonly IReadOnlySet<string> FRONT =
        new HashSet<string>(Js.CodePoints(Manifest.MANIFEST.FrontVowels), StringComparer.Ordinal);
    private static readonly IReadOnlySet<string> BACK =
        new HashSet<string>(Js.CodePoints(Manifest.MANIFEST.BackVowels), StringComparer.Ordinal);
    private static IReadOnlyDictionary<string, string> TO_VOICELESS => M.Voicing.ToVoiceless;
    private static IReadOnlyDictionary<string, string> TO_VOICED => M.Voicing.ToVoiced;

    private static bool IsObstruent(string p) => TO_VOICELESS.ContainsKey(p) || TO_VOICED.ContainsKey(p);
    /** Voiced obstruents key the devoicing map. */
    private static bool IsVoiced(string p) => TO_VOICELESS.ContainsKey(p);

    private enum Kind { V, C, SoftI }

    private sealed class Unit
    {
        public string Ch = "";      // the source letter(s), lowercased
        public Kind Kind;           // vowel (incl. digraph) / consonant / the silent softening ⟨i⟩
        public string Ph = "";
        public bool Soft;           // consonant palatalisation (set by the rule)
    }

    /**
     * Tokenize a lowercased word into letter-units (digraphs first). Unknown chars are dropped.
     *
     * ⚠ CODE UNITS, NOT CODE POINTS. The TS indexes with `w[i]` and slices with `w.slice(i, i + 2)`, both of
     * which are code-unit operations, so an astral character arrives here as its two surrogate halves and
     * each half is offered to the tables separately. Iterating code points would be a divergence, not a fix.
     */
    private static List<Unit> Tokenize(string w)
    {
        var u = new List<Unit>();
        var i = 0;
        while (i < w.Length)
        {
            var two = w.Substring(i, Math.Min(2, w.Length - i));
            if (two.Length == 2 && CDI.TryGetValue(two, out var cd)) { u.Add(new Unit { Ch = two, Kind = Kind.C, Ph = cd }); i += 2; continue; }
            if (two.Length == 2 && VDI.TryGetValue(two, out var vd)) { u.Add(new Unit { Ch = two, Kind = Kind.V, Ph = vd }); i += 2; continue; }
            var c = w[i].ToString();
            if (V.TryGetValue(c, out var vp)) { u.Add(new Unit { Ch = c, Kind = Kind.V, Ph = vp }); i += 1; continue; }
            if (C.TryGetValue(c, out var cp)) { u.Add(new Unit { Ch = c, Kind = Kind.C, Ph = cp }); i += 1; continue; }
            // ⚠ A letter with no rule here still denotes a sound; dropping it deletes what the writer typed.
            // Only reached when every grapheme (digraphs included) has declined, so the language's own
            // reading wins.
            {
                var p = LatinPhone(c, new PhoneOpts { Initial = i == 0, IncludeH = true });
                if (p is not null) u.Add(new Unit { Ch = c, Kind = Kind.C, Ph = p });
            }
            i += 1;
        }
        return u;
    }

    /** A unit that TRIGGERS palatalisation of a preceding consonant: a single front vowel, the softening
     *  ⟨i⟩, or ⟨j⟩. ⟨ie⟩ triggers (front-opening); ⟨uo⟩ (back-opening) does not. */
    private static bool Triggers(Unit? unit)
    {
        if (unit is null) return false;
        if (unit.Kind == Kind.SoftI) return true;
        if (unit.Ch == "j") return true;
        if (unit.Ch == "ie") return true; // ⟨ie⟩ opens on a front [i] → palatalises (Dievas → dʲiɛ…)
        return unit.Kind == Kind.V && unit.Ch.Length == 1 && FRONT.Contains(unit.Ch);
    }

    // Velars ⟨k ɡ⟩ do NOT receive leftward palatalisation spread (they soften only DIRECTLY before a front
    // vowel): knyga → knʲiːɡɐ (k hard before soft nʲ), Eglynas → ɛɡlʲiːnɐs (ɡ hard before soft lʲ).
    private static readonly IReadOnlySet<string> NO_SPREAD =
        new HashSet<string>(new[] { "k", "g" }, StringComparer.Ordinal);

    public static List<Seg> Scan(string word)
    {
        var u = Tokenize(Js.ToLowerCase(word));

        // Mark the SILENT softening ⟨i⟩: a single ⟨i⟩ between a consonant and a back vowel (Cia/Cio/Ciu…).
        for (var i = 1; i < u.Count - 1; i++)
        {
            if (u[i].Ch == "i" && u[i - 1].Kind == Kind.C && u[i + 1].Kind == Kind.V)
            {
                var nx = u[i + 1].Ch;
                // ⚠ `nx[0]` is the TS's own code-unit index into the unit's spelling.
                if (BACK.Contains(nx[0].ToString())) u[i].Kind = Kind.SoftI;
            }
        }

        // PALATALISATION: a consonant is soft if the next unit triggers; then spread leftward (a consonant
        // before a soft consonant is soft). ⟨j⟩ is inherently palatal so it doesn't take a separate ʲ but
        // does propagate softness.
        for (var i = 0; i < u.Count; i++)
            if (u[i].Kind == Kind.C && Triggers(i + 1 < u.Count ? u[i + 1] : null)) u[i].Soft = true;
        for (var i = u.Count - 2; i >= 0; i--)
        {
            if (u[i].Kind == Kind.C && !NO_SPREAD.Contains(u[i].Ch) && u[i + 1].Kind == Kind.C
                && (u[i + 1].Soft || u[i + 1].Ch == "j"))
                u[i].Soft = true;
        }

        // ⟨a ą⟩ FRONT to [ɛ]/[ɛː] after the softening ⟨i⟩ (⟨Cia⟩ → Cʲɛ, čia → t͡ʃʲɛ) or ⟨j⟩ (-ija → …jɛ,
        // koja → koːjɛ, Mažeikiai → …kʲɛɪ). Determined on the UNIT stream (the softening ⟨i⟩ still present)
        // before it is dropped. This fires in the ⟨jau/jai⟩ diphthong too (Andrejauskas → …jɛʊ) — where it's
        // really stress-conditioned (unstressed jaunuolis stays jɐ), but the referee majority fronts, so the
        // always-front rule scores best. (A soft plain consonant can never sit before ⟨a⟩ — orthographic Cʲa
        // is spelled ⟨Cia⟩, the soft-⟨i⟩ path — so that case is out.)
        for (var i = 1; i < u.Count; i++)
        {
            if (u[i].Kind != Kind.V || (u[i].Ch != "a" && u[i].Ch != "ą")) continue;
            var prev = u[i - 1];
            if (prev.Ch == "j" || prev.Kind == Kind.SoftI) u[i].Ph = u[i].Ch == "a" ? "ɛ" : "ɛː";
        }

        var segs = new List<Seg>();
        foreach (var unit in u)
        {
            if (unit.Kind == Kind.SoftI) continue; // silent
            if (unit.Kind == Kind.V) { segs.Add(new Seg { Ph = unit.Ph, Nucleus = true }); continue; }
            // ⟨j⟩ is already palatal (no ʲ); other consonants get ʲ when soft.
            var ph = unit.Ch == "j" ? unit.Ph : unit.Soft ? unit.Ph + "ʲ" : unit.Ph;
            segs.Add(new Seg { Ph = ph, Nucleus = false });
        }
        return segs;
    }

    private static readonly JsRe VELAR = JsRegex.Compile("^[kɡ]", "");

    /** n → ŋ before a velar k/ɡ (keeping any ʲ). */
    private static void NasalAssim(List<Seg> segs)
    {
        for (var i = 0; i < segs.Count - 1; i++)
        {
            var p = segs[i].Ph;
            if ((p == "n" || p == "nʲ") && VELAR.IsMatch(segs[i + 1].Ph)) segs[i].Ph = p == "nʲ" ? "ŋʲ" : "ŋ";
        }
    }

    private static readonly JsRe PALATAL_TAIL = JsRegex.Compile("ʲ$", "u");

    /** Regressive voicing assimilation over obstruent clusters (the last obstruent sets the voicing of the
     *  run). The ʲ is preserved (b→p keeps softness: bʲ→pʲ). Sonorants + j/ʋ are transparent. */
    private static void ApplyVoicing(List<Seg> segs)
    {
        string Base(string p) => JsRegex.Replace(p, PALATAL_TAIL, "");
        static bool IsSoft(string p) => p.EndsWith("ʲ", StringComparison.Ordinal);
        for (var i = segs.Count - 2; i >= 0; i--)
        {
            var p = Base(segs[i].Ph);
            if (!IsObstruent(p)) continue;
            var nb = Base(segs[i + 1].Ph);
            if (!IsObstruent(nb)) continue; // before a sonorant/vowel/pause: keep base voicing
            var map = IsVoiced(nb) ? TO_VOICED : TO_VOICELESS;
            if (map.TryGetValue(p, out var swapped))
                segs[i].Ph = swapped + (IsSoft(segs[i].Ph) ? "ʲ" : "");
        }
    }

    /** Lithuanian word → IPA phoneme segments (scan + ŋ-assimilation + voicing). Stress is lexical → not
     *  marked. */
    public static List<Seg> ToSegments(string word)
    {
        var segs = Scan(word);
        NasalAssim(segs);
        ApplyVoicing(segs);
        return segs;
    }
}
