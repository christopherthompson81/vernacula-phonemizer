/**
 * Irish Gaelic grapheme→phoneme scanner. The core is the BROAD/SLENDER axis: each consonant's quality is set by
 * its flanking vowel LETTERS (slender next to e/i, broad next to a/o/u — "caol le caol"), and the matching
 * velarized/palatalized form is emitted. Vowel clusters are a longest-match lookup (the pronounced nucleus).
 * Lenition digraphs (bh/ch/dh/fh/gh/mh/ph/sh/th) are resolved first. Stress + assembly: Irish.cs.
 *
 * Ported from src/languages/irish/g2p.ts.
 *
 * ⚠ THE SCAN INDEXES UTF-16 CODE UNITS, deliberately. The TS walks `w[i]` / `w.slice(i, i + 2)` on a JS
 * string, which is code units, so an astral character arrives here one surrogate half at a time and falls
 * through the same branches on both sides. Spreading to code points here would be a divergence, not a fix.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Irish;

/** One scanned segment. Mutable: the unstressed-reduction pass in Irish.cs rewrites `Ph` in place. */
public sealed class Seg
{
    public required string Ph { get; set; }
    /** Is a vowel nucleus (for stress placement). */
    public required bool Nucleus { get; set; }
    /** Long oː spelled ⟨eo⟩ already carries its on-glide → suppresses the i-offglide (ceoil). */
    public bool NoGlide { get; set; }
}

public static class G2p
{
    private static readonly IrishDef DEF = Manifest.MANIFEST;
    private static readonly string SLENDER_V = DEF.SlenderVowels;
    private static readonly string VOWELS = DEF.SlenderVowels + DEF.BroadVowels;
    private static readonly IReadOnlyDictionary<string, string> BROAD = DEF.Broad;
    private static readonly IReadOnlyDictionary<string, string> SLENDER = DEF.Slender;
    private static readonly IReadOnlyDictionary<string, IReadOnlyList<string>> LENITION = DEF.Lenition;

    /** Longest-first. ⚠ `OrderByDescending` is a STABLE sort, matching JS's `Array.prototype.sort` — equal
     *  lengths keep the manifest's insertion order, which is what decides ⟨ai⟩ before ⟨ea⟩ and so on. */
    private static readonly IReadOnlyList<string> VOWEL_CLUSTERS =
        DEF.Vowels.Keys.OrderByDescending(k => k.Length).ToList();

    /** `w[i]` with JS's out-of-range answer: `undefined`, which every use here compares as `""`. */
    private static string At(string w, int i) => i >= 0 && i < w.Length ? w[i].ToString() : "";

    private static bool IsVowel(string c) => c.Length != 0 && VOWELS.Contains(c, StringComparison.Ordinal);
    private static bool IsSlenderV(string c) => c.Length != 0 && SLENDER_V.Contains(c, StringComparison.Ordinal);

    /** Word-initial ECLIPSIS (urú): the eclipsing consonant is pronounced, the radical letter is silent. */
    private static readonly IReadOnlyDictionary<string, string> ECLIPSIS = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["mb"] = "m", ["gc"] = "g", ["nd"] = "n", ["bp"] = "b", ["dt"] = "d", ["ts"] = "t",
    };

    /** Is the consonant at index i SLENDER? Its quality comes from the IMMEDIATELY adjacent vowel letter — the
     *  one right after (onset) else right before (coda). Word-initial ⟨r⟩ is always broad. A cluster-internal
     *  consonant (no adjacent vowel) agrees with the following vowel (bl → both slender), EXCEPT ⟨s⟩ which is
     *  broad before a consonant (spéir → sˠpʲeːɾʲ); a coda cluster with no following vowel is broad (ainm → …mˠ). */
    private static bool ConsonantSlender(string w, int i)
    {
        if (At(w, i) == "r" && i == 0) return false; // word-initial r → always broad
        string nx = At(w, i + 1), pv = At(w, i - 1);
        if (IsVowel(nx)) return IsSlenderV(nx);      // onset: immediate following vowel
        if (IsVowel(pv)) return IsSlenderV(pv);      // coda: immediate preceding vowel
        if (At(w, i) == "s") return false;           // s before a consonant (sp/st/sc/sm/sn) is broad
        for (var j = i + 1; j < w.Length; j++)
            if (IsVowel(At(w, j))) return IsSlenderV(At(w, j)); // onset cluster (bl/br…)
        return false;                                // coda cluster with no following vowel → broad
    }

    private static readonly JsRe EO_KEY = JsRegex.Compile("^e[oó]", "");
    private static readonly JsRe ASCII_LETTER = JsRegex.Compile("[a-z]", "");

    /** `w.slice(i, i + len)` — JS clamps; `Substring` throws, so clamp here. */
    private static string Slice(string w, int i, int len) =>
        i >= w.Length ? "" : w.Substring(i, Math.Min(len, w.Length - i));

    /** Scan a lowercased Irish word into segments. */
    public static List<Seg> ToSegments(string word)
    {
        var w = Js.ToLowerCase(word);
        var n = w.Length;
        var segs = new List<Seg>();
        var i = 0;
        void Cons(string ph) { if (ph.Length != 0) segs.Add(new Seg { Ph = ph, Nucleus = false }); }

        while (i < n)
        {
            var c = At(w, i);
            var two = Slice(w, i, 2);

            // --- word-initial ECLIPSIS (urú): eclipsing consonant wins, radical letter silent (mbád → mˠɑːd̪ˠ) ---
            if (i == 0)
            {
                var initSlender = ConsonantSlender(w, 0);
                if (Slice(w, 0, 3) == "bhf") { Cons(initSlender ? "vʲ" : "w"); i += 3; continue; } // bhf → w/vʲ (f silent)
                if (two == "ng") { Cons(initSlender ? "ɲ" : "ŋ"); i += 2; continue; }               // ng → ŋ (g silent)
                if (ECLIPSIS.TryGetValue(two, out var radical))
                {
                    Cons((initSlender ? SLENDER : BROAD)[radical]); i += 2; continue;
                }
            }

            // --- word-final ⟨dh⟩/⟨gh⟩ → silent (the -aigh/-idh verbal endings: chéadaigh → çeːd̪ˠə); the exposed
            // short nucleus then reduces to the ending schwa (airigh → aɾʲə) via the unstressed reduction. ---
            if ((two == "dh" || two == "gh") && i + 2 == n && segs.Count > 0) { i += 2; continue; }

            // --- lenition digraphs (séimhiú): bh ch dh fh gh mh ph sh th ---
            if (LENITION.TryGetValue(two, out var pair))
            {
                var lenSlender = ConsonantSlender(w, i);
                var ph = pair[lenSlender ? 1 : 0];
                // broad bh/mh add a labial-velar glide before a back vowel (bhuail → wuəlʲ); keep w/vʲ otherwise.
                Cons(ph);
                i += 2;
                continue;
            }

            // --- doubled consonant (rr/ll/nn/…) → a single quality-determined consonant (carr → kaɾˠ) ---
            if (c == At(w, i + 1) && !IsVowel(c) && !LENITION.ContainsKey(two))
            {
                var map = ConsonantSlender(w, i) ? SLENDER : BROAD;
                if (map.TryGetValue(c, out var dbl)) Cons(dbl);
                i += 2;
                continue;
            }

            // --- vowel clusters (longest-match) → the pronounced nucleus ---
            if (IsVowel(c))
            {
                var key = VOWEL_CLUSTERS.FirstOrDefault(k => StartsWithAt(w, k, i));
                if (key is not null)
                {
                    // ⟨eo⟩/⟨eó⟩/⟨eoi⟩ → oː but with a built-in on-glide → no separate i-offglide (ceoil → koːlʲ).
                    var seg = new Seg { Ph = DEF.Vowels[key], Nucleus = true };
                    if (EO_KEY.IsMatch(key)) seg.NoGlide = true;
                    segs.Add(seg);
                    i += key.Length;
                    continue;
                }
                segs.Add(new Seg { Ph = c, Nucleus = true }); // unknown vowel char: pass through
                i++;
                continue;
            }

            // --- single consonants: broad or slender ---
            var cmap = ConsonantSlender(w, i) ? SLENDER : BROAD;
            if (cmap.TryGetValue(c, out var single)) Cons(single);
            else
            {
                // ⚠ This used to push the RAW ORTHOGRAPHIC CHARACTER into the phone stream, which is what
                // core/latinPhones.ts exists to prevent. Irish leaked THREE letters, more than any other
                // engine with this branch: ⟨q⟩ as the IPA uvular stop /q/ (piquet, Albuquerque), ⟨x⟩, and
                // ⟨y⟩ — and ⟨y⟩ is the nastiest of the three, because it is a perfectly good IPA symbol for
                // a close front ROUNDED VOWEL, so an orthographic y silently became a vowel.
                var p = LatinPhones.LatinPhone(c, new PhoneOpts { Initial = segs.Count == 0, IncludeH = false });
                if (p is not null) Cons(p);
                else if (ASCII_LETTER.IsMatch(c)) Cons(c); // shared reading declined; apostrophe/hyphen/punct → skip
            }
            i++;
        }
        return segs;
    }

    /** `w.startsWith(k, i)`. */
    private static bool StartsWithAt(string w, string k, int i) =>
        i + k.Length <= w.Length && string.CompareOrdinal(w, i, k, 0, k.Length) == 0;
}
