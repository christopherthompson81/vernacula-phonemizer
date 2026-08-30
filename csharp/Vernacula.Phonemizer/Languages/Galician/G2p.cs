/**
 * Galician grapheme→phoneme engine.
 * Ported from src/languages/galician/g2p.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Galician;

public sealed class Seg
{
    public string Ph { get; set; } = "";   // IPA phoneme(s)
    public required bool Nucleus { get; init; } // is a syllable nucleus (vowel, not a glide)
    public required bool Accent { get; init; }  // bears a written accent (á é í ó ú) → lexically stressed
}

public static class G2p
{
    private static string STRONG => Manifest.MANIFEST.Vowels.Strong;
    private static string WEAK_UNACC => Manifest.MANIFEST.Vowels.WeakUnaccented;
    private static string WEAK_ACC => Manifest.MANIFEST.Vowels.WeakAccented;
    private static IReadOnlyDictionary<string, string> ACCENTED => Manifest.MANIFEST.Accents;
    private static string FRONT => Manifest.MANIFEST.Vowels.Front;

    // ⚠ GUARD AGAINST "": .NET's `Contains("")` is true, as `"abc".includes("")` is in JS, which at word
    // end would misread the missing next character as a vowel.
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
        for (var k = 0; k < chars.Count; k++)
        {
            var nextC = k + 1 < chars.Count ? chars[k + 1] : "";
            if (!roles[k] && WEAK_UNACC.Contains(chars[k], StringComparison.Ordinal) && nextC != ""
                && WEAK_ACC.Contains(nextC, StringComparison.Ordinal))
                roles[k] = true; // an accented weak breaks the diphthong with a PRECEDING weak → hiatus
        }
        if (!hasNucleus) roles[^1] = true; // all-weak run (iu, ui, i) → last is nucleus
        return chars.Select((c, k) => (roles[k],
            WEAK_ACC.Contains(c, StringComparison.Ordinal) || "áéó".Contains(c, StringComparison.Ordinal))).ToList();
    }

    /** A weak vowel that is a glide: an ONglide (before the nucleus) is consonantal j/w; an OFFglide (after
     *  the nucleus) is the non-syllabic vowel ᶦ/ᶷ (peixe → peᶦʃe, cousa → coᶷsa). */
    private static string GlideOf(string c, bool offglide) =>
        c == "i" || c == "í" ? (offglide ? "ᶦ" : "j") : offglide ? "ᶷ" : "w";

    private static readonly JsRe FALLBACK = JsRegex.Compile("[a-zñ]");

    /** Scan a lowercased Galician word into segments. */
    public static List<Seg> ToSegments(string word)
    {
        var w = Js.ToLowerCase(word);
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

            if (c == "c" && nx == "h") { Cons("t͡ʃ"); i += 2; continue; }
            if (c == "l" && nx == "l") { Cons("ʎ"); i += 2; continue; }
            if (c == "n" && nx == "h") { Cons("ŋ"); i += 2; continue; } // ⟨nh⟩ → velar nasal (unha → uŋa)
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

            if (c == "y")
            {
                if (IsVowel(nx)) { Cons("ʝ"); i++; continue; }
                var prev = segs.Count > 0 ? segs[^1] : null;
                if (prev is not null && prev.Nucleus) Cons("ᶦ");
                else segs.Add(new Seg { Ph = "i", Nucleus = true, Accent = false });
                i++;
                continue;
            }

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

            switch (c)
            {
                case "b":
                case "v": Cons("b"); break; // spirantized downstream (b/v merged)
                case "c": Cons(IsFront(nx) ? "θ" : "k"); break;
                case "z": Cons("θ"); break;
                case "d": Cons("d"); break;
                case "f": Cons("f"); break;
                case "g": Cons("ɡ"); break; // always the velar stop (spirantized ɣ downstream) — no Castilian jota
                case "h": break; // silent
                case "j": Cons("ʃ"); break;
                case "k": Cons("k"); break;
                case "l": Cons("l"); break;
                case "m": Cons("m"); break;
                case "n": Cons("n"); break; // velarized (→ŋ) downstream in coda / before a velar
                case "ñ": Cons("ɲ"); break;
                case "p": Cons("p"); break;
                case "r":
                    Cons(segs.Count == 0 || "nls".Contains(LastPhoneme(segs), StringComparison.Ordinal) ? "r" : "ɾ");
                    break;
                case "s": Cons("s"); break;
                case "t": Cons("t"); break;
                case "w": Cons("w"); break;
                case "x":
                    if (IsVowel(nx) || nx == "") Cons("ʃ");
                    else { Cons("k"); Cons("s"); }
                    break;
                default:
                {
                    var p = LatinPhones.LatinPhone(c, new PhoneOpts { Initial = segs.Count == 0, IncludeH = false });
                    if (p is not null) Cons(p);
                    else if (FALLBACK.IsMatch(c)) Cons(c);
                    break; // still pass through if even the shared reading declines
                }
            }
            i++;
        }
        return segs;
    }

    /** The last emitted consonant phoneme (for the r-trill onset test). */
    private static string LastPhoneme(IReadOnlyList<Seg> segs) => segs.Count > 0 ? segs[^1].Ph : "";
}
