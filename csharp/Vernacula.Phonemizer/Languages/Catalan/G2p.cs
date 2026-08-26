/**
 * Catalan (Central/Eastern) grapheme→phoneme scanner: left-to-right, small context rules, no lexicon.
 * Stress, reduction, spirantization, nasal assimilation and final devoicing run downstream (Catalan.cs).
 * Ported from src/languages/catalan/g2p.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Catalan;

public sealed class Seg
{
    public required string Ph { get; set; }     // consonant IPA, or the vowel's STRESSED IPA
    public required bool Nucleus { get; init; } // syllable nucleus (a vowel, not a glide)
    public required bool Accent { get; init; }  // bears a written accent → lexically stressed
    public string? Reduced { get; init; }       // the vowel's UNSTRESSED IPA; null for consonants/glides
}

public static class G2p
{
    private static IReadOnlyDictionary<string, VowelReal> V => Manifest.MANIFEST.Vowels;
    private static string ACCENTED => Manifest.MANIFEST.AccentedVowels;
    private static string FRONT => Manifest.MANIFEST.FrontVowels;
    private static readonly string VOWEL_CHARS = string.Concat(Manifest.MANIFEST.Vowels.Keys);
    private const string STRONG = "aeoàèéòó"; // each its own nucleus (two adjacent = hiatus)

    // ⚠ GUARD AGAINST "": .NET's `Contains("")` is true, as JS's `includes("")` is — at word end the
    // missing next character would otherwise read as a vowel.
    private static bool IsVowel(string c) => c != "" && VOWEL_CHARS.Contains(c, StringComparison.Ordinal);
    private static bool IsFront(string c) => c != "" && FRONT.Contains(c, StringComparison.Ordinal);
    private static bool IsAccented(string c) => c != "" && ACCENTED.Contains(c, StringComparison.Ordinal);

    /** Classify a maximal vowel run into nucleus vs glide. Strong + accented-weak are nuclei; a plain i/u is
     *  a glide only as an offglide or a word-initial onglide. */
    private static bool[] ClassifyRun(string run, bool atWordStart)
    {
        var chars = Js.CodePoints(run);
        var nucleus = new bool[chars.Count];
        for (var k = 0; k < chars.Count; k++)
            nucleus[k] = STRONG.Contains(chars[k], StringComparison.Ordinal) || IsAccented(chars[k]);
        for (var k = 0; k < chars.Count; k++)
        {
            if (nucleus[k]) continue;
            var precededByNucleus = false;
            for (var j = 0; j < k; j++) if (nucleus[j]) { precededByNucleus = true; break; }
            var wordInitialOnglide = atWordStart && k == 0 && chars.Count > 1;
            if (!precededByNucleus && !wordInitialOnglide) nucleus[k] = true; // onglide i/u → hiatus nucleus
        }
        if (!nucleus.Any(b => b) && nucleus.Length > 0) nucleus[^1] = true; // safety
        return nucleus;
    }

    /** Scan a lowercased Catalan word into segments. */
    public static List<Seg> ToSegments(string word)
    {
        var w = Js.ToLowerCase(word);
        var segs = new List<Seg>();
        var n = w.Length;
        var i = 0;
        void Cons(string ph) => segs.Add(new Seg { Ph = ph, Nucleus = false, Accent = false });
        string LastPh() => segs.Count > 0 ? segs[^1].Ph : "";
        string At(int k) => k >= 0 && k < n ? w[k].ToString() : "";

        while (i < n)
        {
            var c = w[i].ToString();
            var nx = At(i + 1);
            var nx2 = At(i + 2);

            // --- multi-letter units (longest first) ---
            if (c == "l" && nx == "·" && nx2 == "l") { Cons("ɫː"); i += 3; continue; }
            if (c == "n" && nx == "y") { Cons("ɲ"); i += 2; continue; }
            if (c == "l" && nx == "l") { Cons("ʎ"); i += 2; continue; }
            if (c == "r" && nx == "r") { Cons("r"); i += 2; continue; }
            if (c == "s" && nx == "s") { Cons("s"); i += 2; continue; }
            if (c == "t" && nx == "x") { Cons("t͡ʃ"); i += 2; continue; }
            if (c == "t" && nx == "j") { Cons("d͡ʒ"); i += 2; continue; }
            if (c == "t" && nx == "g" && IsFront(nx2)) { Cons("d͡ʒ"); i += 2; continue; }
            if (c == "t" && nx == "z") { Cons("d͡z"); i += 2; continue; }
            if (c == "i" && nx == "g" && i + 2 == n)
            {
                segs.Add(new Seg { Ph = V["i"].Stressed, Nucleus = true, Accent = false, Reduced = V["i"].Reduced });
                Cons("t͡ʃ");
                i += 2;
                continue;
            }
            if (c == "q" && nx == "u") { Cons("k"); if (nx2 == "a" || nx2 == "o" || nx2 == "ü") Cons("w"); i += 2; continue; }
            if (c == "g" && nx == "u" && IsFront(nx2)) { Cons("ɡ"); i += 2; continue; }
            if (c == "g" && nx == "u" && (nx2 == "a" || nx2 == "o")) { Cons("ɡ"); Cons("w"); i += 2; continue; }
            if (c == "g" && nx == "ü") { Cons("ɡ"); Cons("w"); i += 2; continue; }
            if (c == "q" && nx == "ü") { Cons("k"); Cons("w"); i += 2; continue; }

            // --- vowel run → nuclei + glides ---
            if (IsVowel(c))
            {
                var j = i;
                while (j < n && IsVowel(w[j].ToString())) j++;
                var runEnd = j;
                var ixDigraph = At(j) == "x" && At(j - 1) == "i" && j - 1 > i;
                var igFinal = At(j) == "g" && At(j - 1) == "i" && j + 1 == n && j - 1 > i;
                if (ixDigraph || igFinal) runEnd = j - 1; // the trailing plain ⟨i⟩ is a silent digraph marker
                var run = w[i..runEnd];
                var nuc = ClassifyRun(run, i == 0);
                var runChars = Js.CodePoints(run);
                for (var k = 0; k < runChars.Count; k++)
                {
                    var vc = runChars[k];
                    var real = V[vc];
                    if (nuc[k]) segs.Add(new Seg { Ph = real.Stressed, Nucleus = true, Accent = IsAccented(vc), Reduced = real.Reduced });
                    else Cons(vc == "i" || vc == "í" ? "j" : "w"); // glide (on- or off-): i→j, u→w
                }
                if (ixDigraph) { Cons("ʃ"); i = j + 1; continue; }
                if (igFinal) { Cons("t͡ʃ"); i = n; continue; }
                i = j;
                continue;
            }

            // --- single consonants ---
            switch (c)
            {
                case "b": case "v": Cons("b"); break; // betacism + spirantized downstream
                case "c": Cons(IsFront(nx) ? "s" : "k"); break;
                case "ç": Cons("s"); break;
                case "d": Cons("d"); break;
                case "f": Cons("f"); break;
                case "g": Cons(IsFront(nx) ? "ʒ" : "ɡ"); break;
                case "h": break; // silent
                case "j": Cons("ʒ"); break;
                case "k": Cons("k"); break;
                case "l": Cons("ɫ"); break;
                case "m": Cons("m"); break;
                case "n": Cons("n"); break;
                case "p": Cons("p"); break;
                case "r":
                {
                    var p = LastPh();
                    Cons(segs.Count == 0 || p == "n" || p == "ɫ" || p == "s" ? "r" : "ɾ");
                    break;
                }
                case "s":
                {
                    var prevSeg = segs.Count > 0 ? segs[^1] : null;
                    var prevVocalic = prevSeg is not null && (prevSeg.Nucleus || prevSeg.Ph == "j" || prevSeg.Ph == "w");
                    Cons(prevVocalic && IsVowel(nx) ? "z" : "s");
                    break;
                }
                case "t": Cons("t"); break;
                case "w": Cons("w"); break;
                case "x":
                {
                    var prevSeg = segs.Count > 0 ? segs[^1] : null;
                    var afterVowel = prevSeg is not null && (prevSeg.Nucleus || prevSeg.Ph == "j" || prevSeg.Ph == "w");
                    if (!afterVowel) Cons("ʃ");
                    else if (i == 1 && w[0] == 'e' && IsVowel(nx)) { Cons("ɡ"); Cons("z"); } // ex- prefix
                    else { Cons("k"); Cons("s"); }
                    break;
                }
                case "y": Cons("j"); break;
                case "z": Cons("z"); break;
                default:
                {
                    var p = LatinPhones.LatinPhone(c, new PhoneOpts { Initial = segs.Count == 0, IncludeH = false });
                    if (p is not null) Cons(p);
                    else if (AZ_CEDILLA.IsMatch(c)) Cons(c);
                    break;
                }
            }
            i++;
        }
        return segs;
    }

    private static readonly JsRe AZ_CEDILLA = JsRegex.Compile("[a-zç]");
}
