/**
 * German (Standard/Hochdeutsch) grapheme→phoneme engine.
 * Ported from src/languages/german/g2p.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.German;

public sealed class Seg
{
    public required string Ph;
    public required int S;
    public required bool Vowel;
}

public static class G2p
{
    private const string VOWELS = "aeiouäöüy";
    private static bool IsV(string c) => c != "" && VOWELS.Contains(c, StringComparison.Ordinal);

    private static IReadOnlyDictionary<string, string> LONG => Manifest.MANIFEST.Vowels.Long;
    private static IReadOnlyDictionary<string, string> SHORT => Manifest.MANIFEST.Vowels.Short;
    private static IReadOnlyDictionary<string, string> CONS => Manifest.MANIFEST.Consonants;
    private static IReadOnlyDictionary<string, string> VOICED_FINAL => Manifest.MANIFEST.VoicedFinal;

    private static string At(string w, int k) => k >= 0 && k < w.Length ? w[k].ToString() : "";

    /** Number of consonant letters from index j up to the next vowel or word end. */
    private static int ConsRun(string w, int j)
    {
        var n = 0;
        while (j < w.Length && !IsV(w[j].ToString()))
        {
            n++;
            j++;
        }
        return n;
    }

    private static readonly IReadOnlySet<string> SHORT_MONO =
        new HashSet<string>(Manifest.MANIFEST.ShortMonosyllables, StringComparer.Ordinal);

    /**
     * The vowels that are always FULL in German orthography — ⟨e⟩ and ⟨i⟩ are excluded because they are the
     * two that reduce (schwa in -en/-e, [ɪ] in -ig).
     */
    private const string FULL_VOWEL = "aouäöü";

    private static IReadOnlyList<string> LONG_CH => Manifest.MANIFEST.LongCh;
    private static readonly IReadOnlySet<string> ST_KEEP =
        new HashSet<string>(Manifest.MANIFEST.Morphology.StKeepWords, StringComparer.Ordinal);

    private static readonly JsRe PREFIX_ST = JsRegex.Compile("^(be|ge|ver|zer|ent|emp|er)$", "");
    private static readonly JsRe ANY_VOWEL = JsRegex.Compile("[aeiouäöüy]", "");
    private static readonly JsRe H_PREFIX = JsRegex.Compile("(be|ge|ver|zer|er|vor|zu|un|emp|ent|miss)$", "");

    /** Is the vowel at index i long? V+h, doubled vowel and ie → long; V+double-C / ck / tz / ≥2 C → short;
     *  V+single-C(+vowel|end) → long (open syllable). */
    private static bool IsLong(string w, int i)
    {
        string c = At(w, i), nx = At(w, i + 1), nx2 = At(w, i + 2);
        if (SHORT_MONO.Contains(w)) return false; // das, in, mit … (function words)
        if (nx == "h") return true; // Uhr, sehen (h silent, lengthens)
        if (nx == c && "aeou".Contains(c, StringComparison.Ordinal)) return true; // Saat, See, Boot
        if (nx == "ß") return true; // Straße, Fuß
        if (nx == "c" && nx2 == "h") return LONG_CH.Any(s => w.StartsWith(s, StringComparison.Ordinal)); // nach/Buch/suchen long; ach/Bach short
        var run = ConsRun(w, i + 1);
        if (run >= 2) return false; // Wasser, kommen, Angst, ck, tz, sch → short
        return true; // Vater, gut, Tag, Hof (single C → long)
    }

    /** ch after a back vowel a/o/u (incl. au) → ach-laut x; otherwise ich-laut ç (ich, Milch, Bücher). */
    // ⚠ NO EMPTY GUARD, DELIBERATELY. `prevVowel` is "" until the scan has seen a vowel, and JS
    // `"aou".includes("")` is TRUE — so a ⟨ch⟩ with no preceding vowel takes the ach-laut. .NET's
    // `Contains("")` is true as well, so the plain call reproduces it; adding a `!= ""` guard would silently
    // flip those words to ç.
    private static string ChSound(string prevVowel) =>
        "aou".Contains(prevVowel, StringComparison.Ordinal) ? "x" : "ç";

    /**
     * Scan a lowercased German word into IPA segments (no stress; devoicing + r-vocalization applied here).
     */
    public static List<Seg> ToSegments(string word)
    {
        var w = word.ToLowerInvariant();
        var n = w.Length;
        var segs = new List<Seg>();
        var i = 0;
        void Push(string ph, int s, bool vowel = false) => segs.Add(new Seg { Ph = ph, S = s, Vowel = vowel });
        var lastVowelLetter = "";

        while (i < n)
        {
            string c = At(w, i), nx = At(w, i + 1), nx2 = At(w, i + 2), nx3 = At(w, i + 3);
            var initial = i == 0;

            if ((c == "e" || c == "a") && nx == "i") { Push("aɪ̯", i, true); lastVowelLetter = "i"; i += 2; continue; }
            if (c == "a" && nx == "u") { Push("aʊ̯", i, true); lastVowelLetter = "u"; i += 2; continue; }
            if (c == "e" && nx == "u" && nx2 == "r" && i + 3 == n)
            {
                Push("øː", i, true);
                Push("ɐ̯", i);
                lastVowelLetter = "u";
                i += 3;
                continue;
            }
            if ((c == "e" && nx == "u") || (c == "ä" && nx == "u")) { Push("ɔʏ̯", i, true); lastVowelLetter = "u"; i += 2; continue; }

            if (c == "t" && nx == "i" && (nx2 == "o" || (nx2 == "a" && nx3 == "l")))
            {
                Push("t͡s", i);
                Push("i̯", i);
                lastVowelLetter = "i";
                i += 2;
                continue;
            }

            if (c == "s" && nx == "c" && nx2 == "h") { Push("ʃ", i); i += 3; continue; } // sch → ʃ
            if (c == "s" && nx == "s") { Push("s", i); i += 2; continue; } // ss → s
            if (c == "ß") { Push("s", i); i++; continue; }
            if (c == "s" && (nx == "p" || nx == "t")
                && (initial || (!ST_KEEP.Contains(w) && PREFIX_ST.IsMatch(w[..i]))))
            {
                Push("ʃ", i);
                i++;
                continue;
            }
            if (c == "c" && nx == "h")
            {
                if (initial) Push("eiäöüy".Contains(nx2, StringComparison.Ordinal) ? "ç" : "k", i); // empty nx2 → true, as in JS
                else Push(ChSound(lastVowelLetter), i);
                i += 2;
                continue;
            } // ch → x/ç/k
            if (c == "c" && nx == "k") { Push("k", i); i += 2; continue; } // ck → k
            if (c == "g" && At(w, i - 1) == "i" && nx == "k") { Push("ç", i); i++; continue; }
            if (c == "t" && nx == "s" && nx2 == "c" && nx3 == "h") { Push("t͡ʃ", i); i += 4; continue; } // tsch → t͡ʃ
            if (c == "t" && nx == "z") { Push("t͡s", i); i += 2; continue; } // tz → t͡s
            if (c == "d" && nx == "t") { Push("t", i); i += 2; continue; } // dt → t (Stadt)
            if (c == "p" && nx == "h") { Push("f", i); i += 2; continue; } // ph → f
            if (c == "q" && nx == "u") { Push("k", i); Push("v", i); i += 2; continue; } // qu → kv
            if (c == "n" && nx == "g") { Push("ŋ", i); i += 2; continue; } // ng → ŋ
            if (c == "n" && nx == "k") { Push("ŋ", i); Push("k", i); i += 2; continue; } // nk → ŋk
            if (c == "p" && nx == "f") { Push("p", i); Push("f", i); i += 2; continue; } // pf → pf
            if (c == "i" && nx == "g" && nx2 == "") { Push("ɪ", i, true); Push("ç", i); i += 2; continue; } // final -ig → ɪç

            if (IsV(c))
            {
                lastVowelLetter = c;
                var seenVowel = segs.Any(s => s.Vowel);
                if (c == "ä" && !IsLong(w, i)) { Push("Ɛ", i, true); i++; continue; }
                var noVowelAfter = !ANY_VOWEL.IsMatch(w[(i + 1)..]);
                if (c == "e" && nx == "r" && !IsV(nx2) && seenVowel) { Push("ɐ", i, true); i += 2; continue; }
                if (c == "i" && nx == "e")
                {
                    var ieEnd = i + 2 == n; // …ie#
                    var ienEnd = nx2 == "n" && i + 3 == n; // …ien#
                    if ((ieEnd || ienEnd) && segs.Any(s => s.Vowel))
                    {
                        Push("i̯", i);
                        Push("ə", i, true);
                        if (ienEnd) Push("n", i);
                        i += ienEnd ? 3 : 2;
                        continue;
                    }
                    Push("iː", i, true);
                    i += 2;
                    continue;
                }
                if (c == "i" && FULL_VOWEL.Contains(nx, StringComparison.Ordinal) && seenVowel && i + 2 < n)
                {
                    Push("i̯", i);
                    i++;
                    continue;
                }
                if (nx == c && "aeo".Contains(c, StringComparison.Ordinal)) { Push(LONG[c], i, true); i += 2; continue; }
                if (c == "e" && seenVowel && noVowelAfter) { Push("ə", i, true); i++; continue; }
                Push(IsLong(w, i) ? LONG[c] : SHORT[c], i, true); // silent lengthening/hiatus h is dropped in the switch
                i++;
                continue;
            }

            if (c == "r")
            {
                var prev = segs.Count > 0 ? segs[^1] : null;
                if (nx == "r") i++; // rr → single r (Herr, irre)
                var after = At(w, i + 1);
                var coda = after == "" || !IsV(after);
                if (coda && prev is not null && prev.Vowel) Push("ɐ̯", i); // coda r after a vowel → vocalized (Uhr, hart, Hamburg, scherz)
                else Push("ʁ", i); // onset r (rot, drei, Straße)
                i++;
                continue;
            }

            if (c == "h")
            {
                if (At(w, i - 1) == "t" && (i == 1 || i == w.Length - 1))
                {
                    /* word-edge ⟨th⟩: silent */
                }
                else if (!IsV(At(w, i - 1))
                         || (FULL_VOWEL.Contains(nx, StringComparison.Ordinal) && H_PREFIX.IsMatch(w[..i])))
                    Push("h", i);
            } // onset h pronounced; silent after a vowel (sehen, Uhr)
            else if (c == "s")
            {
                Push(IsV(nx) ? "z" : "s", i);
            } // s → z before a vowel (sehen, lesen); else s
            else if (c == "x")
            {
                Push("k", i);
                Push("s", i);
            } // x → ks
            else
            {
                if (CONS.TryGetValue(c, out var cp)) Push(cp, i);
            } // context-free consonant letter
            i++;
        }

        var @out = new List<Seg>();
        foreach (var s in segs)
        {
            var prev = @out.Count > 0 ? @out[^1] : null;
            if (prev is not null && !prev.Vowel && !s.Vowel && prev.Ph == s.Ph && s.Ph.Length == 1) continue;
            @out.Add(s);
        }
        FinalDevoice(@out, w);
        return @out;
    }

    /** Auslautverhärtung: a voiced obstruent that is word-final or before a voiceless consonant devoices. */
    private static void FinalDevoice(List<Seg> segs, string w)
    {
        for (var k = 0; k < segs.Count; k++)
        {
            var s = segs[k];
            if (!VOICED_FINAL.TryGetValue(s.Ph, out var dev) || string.IsNullOrEmpty(dev)) continue;
            var next = k + 1 < segs.Count ? segs[k + 1] : null;
            if (next is null
                || (!next.Vowel
                    && ("ptksfçxʃ".Contains(next.Ph.Length > 0 ? next.Ph[0].ToString() : "", StringComparison.Ordinal)
                        || VOICED_FINAL.ContainsKey(next.Ph))))
                s.Ph = dev;
        }
        _ = w;
    }
}
