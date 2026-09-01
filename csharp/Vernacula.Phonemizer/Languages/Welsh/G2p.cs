/**
 * Welsh grapheme→phoneme scanner. Welsh spelling is highly phonemic: resolve the digraphs (ch dd ff ng ll ph
 * rh th) and the vowel clusters (diphthongs, which carry a superscript offglide) by longest-match, with a few
 * context rules — ⟨si⟩+V → ʃ, ⟨w⟩/⟨i⟩ are consonants (/w/, /j/) before a vowel but vowels otherwise, and ⟨y⟩ is
 * obscure ə (non-final syllable or a function-word clitic) vs clear ɨ (final syllable). Stress + vowel length:
 * Welsh.cs.
 *
 * Ported from src/languages/welsh/g2p.ts.
 *
 * ⚠ THE SCAN INDEXES UTF-16 CODE UNITS, deliberately. The TS walks `w[i]` / `w.slice(i, i + 2)` on a JS
 * string, which is code units, so an astral character arrives here one surrogate half at a time and falls
 * through the same branches on both sides. Spreading to code points here would be a divergence, not a fix.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Welsh;

/** One scanned segment. Mutable: the length pass in Welsh.cs rewrites `Ph` in place. */
public sealed class Seg
{
    public required string Ph { get; set; }
    /** Is a vowel nucleus (for stress placement). */
    public required bool Nucleus { get; set; }
    /** Already long (circumflex / diphthong) → the length pass leaves it alone. */
    public bool Long { get; set; }
}

public static class G2p
{
    private static readonly WelshDef DEF = Manifest.MANIFEST;
    private static readonly IReadOnlyDictionary<string, string> DIGRAPHS = DEF.Digraphs;
    private static readonly IReadOnlyDictionary<string, string> NASAL_MUTATION = DEF.NasalMutation;
    private static readonly IReadOnlyDictionary<string, string> CONSONANTS = DEF.Consonants;

    /** Longest-first. ⚠ `OrderByDescending` is a STABLE sort, matching JS's `Array.prototype.sort` — equal
     *  lengths keep the manifest's insertion order, which is what decides the 2-char clusters against each
     *  other. */
    private static readonly IReadOnlyList<string> VOWEL_CLUSTERS =
        DEF.Vowels.Keys.OrderByDescending(k => k.Length).ToList();

    private static readonly IReadOnlySet<string> OBSCURE_Y =
        new HashSet<string>(DEF.ObscureY, StringComparer.Ordinal);

    /** Vowel LETTERS, derived from the manifest's single-char vowel keys (+ ⟨y⟩, which the code resolves
     *  separately) so the accented inventory lives in ONE place. */
    private static readonly IReadOnlySet<string> VOWEL_LETTERS =
        new HashSet<string>(DEF.Vowels.Keys.Where(k => k.Length == 1).Concat(new[] { "y" }), StringComparer.Ordinal);

    private static readonly JsRe OFFGLIDE = JsRegex.Compile("[ᶤᶦᶷᵘ]", "");
    private static readonly JsRe ASCII_LETTER = JsRegex.Compile("[a-z]", "");
    private static readonly JsRe APOSTROPHE = JsRegex.Compile("['’]", "g");

    private static bool IsVowelLetter(string c) => c.Length != 0 && VOWEL_LETTERS.Contains(c);

    /** `w[i]` with JS's out-of-range answer: `undefined`, which every use here compares as `""`. */
    private static string At(string w, int i) => i >= 0 && i < w.Length ? w[i].ToString() : "";

    /** `w.slice(i, i + len)` — JS clamps; `Substring` throws, so clamp here. */
    private static string Slice(string w, int i, int len) =>
        i >= w.Length ? "" : w.Substring(i, Math.Min(len, w.Length - i));

    /** Does a vowel LETTER occur in `w` at or after index i? (⟨y⟩ is clear ɨ only when nothing follows in the word.) */
    private static bool VowelAfter(string w, int i)
    {
        for (var j = i; j < w.Length; j++)
            if (IsVowelLetter(At(w, j))) return true;
        return false;
    }

    /** Scan a lowercased Welsh word into segments. */
    public static List<Seg> ToSegments(string word)
    {
        var w = Js.ToLowerCase(word);
        var n = w.Length;
        var obscureWord = OBSCURE_Y.Contains(APOSTROPHE.Replace(w, ""));
        var segs = new List<Seg>();
        var i = 0;

        while (i < n)
        {
            var c = At(w, i);
            var three = Slice(w, i, 3);
            var two = Slice(w, i, 2);

            // --- word-initial nasal mutation (ngh → ŋ̥, mh → m̥, nh → n̥); medial ⟨ngh⟩ etc. fall through to ŋ+h ---
            if (i == 0)
            {
                if (NASAL_MUTATION.TryGetValue(three, out var nm3)) { segs.Add(new Seg { Ph = nm3, Nucleus = false }); i += 3; continue; }
                if (NASAL_MUTATION.TryGetValue(two, out var nm2)) { segs.Add(new Seg { Ph = nm2, Nucleus = false }); i += 2; continue; }
            }

            // --- digraphs (2-char: ch dd ff ng ll ph rh th) ---
            if (DIGRAPHS.TryGetValue(two, out var dig)) { segs.Add(new Seg { Ph = dig, Nucleus = false }); i += 2; continue; }

            // --- ⟨si⟩ + vowel → ʃ (siarad → ʃarad); ⟨si⟩ + consonant stays s+i (sir → siːr) ---
            if (c == "s" && At(w, i + 1) == "i" && IsVowelLetter(At(w, i + 2)))
            {
                segs.Add(new Seg { Ph = "ʃ", Nucleus = false });
                i += 2;
                continue;
            }

            // --- vowels: multi-char clusters (diphthongs incl. wy/yw) win first, then w/i-as-consonant, then y ---
            if (IsVowelLetter(c))
            {
                var key = VOWEL_CLUSTERS.FirstOrDefault(k => k.Length >= 2 && StartsWithAt(w, k, i));
                // In a ⟨gw⟩/⟨chw⟩ onset cluster, ⟨wy⟩ is NOT the diphthong — w is the /w/ consonant + y the vowel
                // (gwyn→ɡwɨn, gwybod→ɡwɨbɔd). Skip the cluster so the w-as-consonant rule below fires.
                var pph = segs.Count > 0 ? segs[^1].Ph : null;
                if (key == "wy" && (pph == "ɡ" || pph == "χ")) key = null;
                if (key is not null)
                {
                    var ph = DEF.Vowels[key];
                    // North Welsh: UNSTRESSED word-final ⟨au⟩ (the plural/verb suffix) reduces to [a].
                    // Only in polysyllables (a nucleus precedes); a stressed monosyllable keeps [aɨ] (cau).
                    if (key == "au" && i + 2 == w.Length && segs.Any(s => s.Nucleus))
                        ph = DEF.Vowels["a"];
                    segs.Add(new Seg
                    {
                        Ph = ph,
                        Nucleus = true,
                        Long = ph.Contains("ː", StringComparison.Ordinal) || OFFGLIDE.IsMatch(ph),
                    });
                    i += key.Length;
                    continue;
                }
                // ⟨w⟩ and ⟨i⟩ are CONSONANTS (/w/, /j/) before a vowel letter. ⟨w⟩ also stays a consonant in the
                // ⟨gw⟩ onset — keyed on the previous SEGMENT being ɡ, NOT the raw ⟨g⟩, which would also match the
                // ɡ of a ⟨ng⟩→ŋ digraph.
                var prevSeg = segs.Count > 0 ? segs[^1] : null;
                if (c == "w" && (IsVowelLetter(At(w, i + 1)) || prevSeg?.Ph == "ɡ"))
                {
                    segs.Add(new Seg { Ph = "w", Nucleus = false });
                    i += 1;
                    continue;
                }
                if (c == "i" && IsVowelLetter(At(w, i + 1)))
                {
                    segs.Add(new Seg { Ph = "j", Nucleus = false });
                    i += 1;
                    continue;
                }
                if (c == "y")
                {
                    // obscure ə (a clitic word, or a later vowel exists → non-final) vs clear ɨ (final syllable).
                    // EXCEPTION: ⟨y⟩ in the ⟨gwy⟩ onset stays clear ɨ even non-finally — the preceding segment
                    // is the /w/ of gw (the wy-cluster was skipped for the gw onset above).
                    var clear = !obscureWord && (!VowelAfter(w, i + 1) || prevSeg?.Ph == "w");
                    segs.Add(new Seg { Ph = clear ? "ɨ" : "ə", Nucleus = true });
                    i += 1;
                    continue;
                }
                var sph = DEF.Vowels.TryGetValue(c, out var sv) ? sv : c; // single vowel (incl. circumflex/diaeresis)
                segs.Add(new Seg { Ph = sph, Nucleus = true, Long = sph.Contains("ː", StringComparison.Ordinal) });
                i += 1;
                continue;
            }

            // --- single consonants ---
            if (CONSONANTS.TryGetValue(c, out var cons)) segs.Add(new Seg { Ph = cons, Nucleus = false });
            else
            {
                // ⚠ This used to push the RAW ORTHOGRAPHIC CHARACTER into the phone stream, which is what
                // core/latinPhones.ts exists to prevent.
                var p = LatinPhones.LatinPhone(c, new PhoneOpts { Initial = segs.Count == 0, IncludeH = false });
                if (p is not null) segs.Add(new Seg { Ph = p, Nucleus = false });
                else if (ASCII_LETTER.IsMatch(c)) segs.Add(new Seg { Ph = c, Nucleus = false }); // shared reading declined
            }
            // apostrophe / hyphen / punctuation: skip
            i += 1;
        }
        return segs;
    }

    /** `w.startsWith(k, i)`. */
    private static bool StartsWithAt(string w, string k, int i) =>
        i + k.Length <= w.Length && string.CompareOrdinal(w, i, k, 0, k.Length) == 0;
}
