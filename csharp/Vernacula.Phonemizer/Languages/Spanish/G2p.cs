/**
 * Spanish grapheme→phoneme engine (broad Castilian). Spanish orthography is shallow and near-deterministic,
 * so this is a left-to-right scan with small context rules — no lexicon. Produces a segment list (phoneme +
 * whether it's a syllable nucleus + whether it bears a written accent); stress and spirantization are
 * applied downstream. for the convention.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Spanish;

public sealed class Seg
{
    public required string Ph { get; set; }     // IPA phoneme(s)
    public required bool Nucleus { get; init; } // is a syllable nucleus (vowel, not a glide)
    public required bool Accent { get; init; }  // bears a written accent (á é í ó ú) → lexically stressed
}

public static class G2p
{
    // Vowel classes + the accented→base map are DATA (spanish.jsonc).
    private static string STRONG => Manifest.MANIFEST.Vowels.Strong; // strong vowels (two adjacent = hiatus)
    private static string WEAK_UNACC => Manifest.MANIFEST.Vowels.WeakUnaccented; // glide beside another vowel
    private static string WEAK_ACC => Manifest.MANIFEST.Vowels.WeakAccented; // always a nucleus; breaks a diphthong
    private static IReadOnlyDictionary<string, string> ACCENTED => Manifest.MANIFEST.Accents;
    private static string FRONT => Manifest.MANIFEST.Vowels.Front; // front vowels that soften c and g

    // NB: guard against "" — "abc".includes("") is true, which at word end would misread the missing next char.
    private static bool IsVowel(string c) =>
        c != "" && (STRONG.Contains(c, StringComparison.Ordinal)
                    || WEAK_UNACC.Contains(c, StringComparison.Ordinal)
                    || WEAK_ACC.Contains(c, StringComparison.Ordinal));
    private static bool IsStrong(string c) => c != "" && STRONG.Contains(c, StringComparison.Ordinal);
    private static bool IsFront(string c) => c != "" && FRONT.Contains(c, StringComparison.Ordinal);

    /** Classify a maximal run of vowel characters into nucleus vs glide roles. */
    private static List<(bool Nucleus, bool Accent)> ClassifyRun(string run)
    {
        var chars = Js.CodePoints(run);
        var roles = new bool[chars.Count]; // true = nucleus
        var hasNucleus = chars.Any(c => IsStrong(c) || WEAK_ACC.Contains(c, StringComparison.Ordinal));
        for (var k = 0; k < chars.Count; k++)
            if (IsStrong(chars[k]) || WEAK_ACC.Contains(chars[k], StringComparison.Ordinal)) roles[k] = true; // strong / accented-weak = nucleus
        if (!hasNucleus) roles[^1] = true; // all-weak run (iu, ui, i) → last is nucleus
        return chars.Select((c, k) => (roles[k],
            WEAK_ACC.Contains(c, StringComparison.Ordinal) || "áéó".Contains(c, StringComparison.Ordinal))).ToList();
    }

    /** A weak vowel that is a glide: an ONglide (before the nucleus) is consonantal j/w (cielo → θjelo); an
     *  OFFglide (after the nucleus) is the non-syllabic vowel ᶦ/ᶷ (aire → aᶦɾe, auto → aᶷto). */
    private static string GlideOf(string c, bool offglide) =>
        c == "i" || c == "í" ? (offglide ? "ᶦ" : "j") : offglide ? "ᶷ" : "w";

    /** Scan a lowercased Spanish word into segments. */
    public static List<Seg> ToSegments(string word)
    {
        var w = word.ToLowerInvariant();
        var segs = new List<Seg>();
        var n = w.Length;
        var i = 0;
        void Cons(string ph) => segs.Add(new Seg { Ph = ph, Nucleus = false, Accent = false });
        string At(int k) => k >= 0 && k < n ? w[k].ToString() : "";

        while (i < n)
        {
            var c = w[i].ToString();
            var nx = At(i + 1);
            var nx2 = At(i + 2);

            // Digraphs / multi-letter units.
            if (c == "c" && nx == "h") { Cons("t͡ʃ"); i += 2; continue; }
            if (c == "l" && nx == "l") { Cons("ʎ"); i += 2; continue; }
            if (c == "r" && nx == "r") { Cons("r"); i += 2; continue; }
            if (c == "q" && nx == "u")
            {
                Cons("k");
                if (!IsFront(nx2)) Cons("w");
                i += 2;
                continue;
            } // que/qui → k (u silent); qua/quo → kw
            if (c == "g" && nx == "u" && IsFront(nx2)) { Cons("ɡ"); i += 2; continue; } // gue/gui → ɡ (u silent)
            if (c == "g" && nx == "ü" && (nx2 == "e" || nx2 == "i")) { Cons("ɡ"); Cons("w"); i += 2; continue; } // güe/güi → ɡw

            // y: a consonant (ʝ) before a vowel; otherwise the vowel i — an offglide after a nucleus (muy →
            // muj) or a standalone nucleus (y "and" → i).
            if (c == "y")
            {
                if (IsVowel(nx)) { Cons("ʝ"); i++; continue; }
                var prev = segs.Count > 0 ? segs[^1] : null;
                if (prev is not null && prev.Nucleus) Cons("ᶦ"); // offglide after a nucleus (muy → muᶦ)
                else segs.Add(new Seg { Ph = "i", Nucleus = true, Accent = false });
                i++;
                continue;
            }

            // Vowel run → nuclei + glides.
            if (IsVowel(c))
            {
                var j = i;
                while (j < n && IsVowel(At(j))) j++;
                var run = w[i..j];
                var roles = ClassifyRun(run);
                var runChars = Js.CodePoints(run);
                for (var k = 0; k < runChars.Count; k++)
                {
                    var vc = runChars[k];
                    var bas = ACCENTED.TryGetValue(vc, out var b) ? b : vc;
                    if (roles[k].Nucleus)
                        segs.Add(new Seg { Ph = bas, Nucleus = true, Accent = roles[k].Accent });
                    else
                        Cons(GlideOf(vc, roles.Take(k).Any(r => r.Nucleus))); // offglide if a nucleus precedes it
                }
                i = j;
                continue;
            }

            // Single consonants.
            switch (c)
            {
                case "b":
                case "v": Cons("b"); break; // spirantized downstream
                case "c": Cons(IsFront(nx) ? "θ" : "k"); break;
                case "z": Cons("θ"); break;
                case "d": Cons("d"); break;
                case "f": Cons("f"); break;
                case "g": Cons(IsFront(nx) ? "x" : "ɡ"); break;
                case "h": break; // silent
                case "j": Cons("x"); break;
                case "k": Cons("k"); break;
                case "l": Cons("l"); break;
                case "m": Cons("m"); break;
                case "n": Cons("n"); break;
                case "ñ": Cons("ɲ"); break;
                case "p": Cons("p"); break;
                case "r":
                    Cons(segs.Count == 0 || "nls".Contains(LastPhoneme(segs), StringComparison.Ordinal) ? "r" : "ɾ");
                    break;
                case "s": Cons("s"); break;
                case "t": Cons("t"); break;
                case "w": Cons("w"); break;
                case "x":
                    if (segs.Count == 0) Cons("s");
                    else { Cons("k"); Cons("s"); }
                    break; // word-initial x → s (xenón); else ks
                default:
                {
                    // ⚠ This used to push the RAW ORTHOGRAPHIC CHARACTER into the phone stream — a ⟨q⟩
                    // survived as the IPA /q/, a uvular stop Spanish does not have.
                    var p = LatinPhones.LatinPhone(c, new PhoneOpts { Initial = segs.Count == 0, IncludeH = false });
                    if (p is not null) Cons(p);
                    else if (JsRegex.Compile("[a-zñ]").IsMatch(c)) Cons(c);
                    break; // still pass through if even the shared reading declines: a typed letter is content
                }
            }
            i++;
        }
        return segs;
    }

    /** The last emitted consonant phoneme (for the r-trill onset test). */
    private static string LastPhoneme(IReadOnlyList<Seg> segs) => segs.Count > 0 ? segs[^1].Ph : "";
}
