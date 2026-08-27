/**
 * Swedish (Central Standard) grapheme→phoneme engine — sje/tje, softening, retroflex assimilation,
 * geminates, and the complementary vowel-length rule (with NST compound length/stress).
 * Ported from src/languages/swedish/g2p.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Swedish;

public sealed class Seg
{
    public string Ph = "";
    public bool Vowel;
}

/** NST compound prosody: the secondary-stressed nucleus and the NST-long vowel ordinals. */
public sealed class Compound
{
    public int SecOrd;
    public HashSet<double> LongOrds = new();
    public bool? SecVowelInitial;
}

public static class G2p
{
    private const string VOWELS = "aeiouyåäöé"; // é (idé, armé, kafé) is an always-long /eː/ loanword vowel
    // ⚠ `c != ""` is the whole guard: JS `"…".includes("")` is TRUE and so is .NET `Contains("")`, and the
    // scanner reads past the end of the word constantly (`w[i+1] ?? ""`).
    private static bool IsV(string c) => c != "" && VOWELS.Contains(c, StringComparison.Ordinal);
    private static readonly string FRONT = Manifest.MANIFEST.FrontVowels.ToLowerInvariant();
    private static bool IsFront(string c) => c != "" && FRONT.Contains(c, StringComparison.Ordinal);

    private static IReadOnlyDictionary<string, string> LONG => Manifest.MANIFEST.Vowels.Long;
    private static IReadOnlyDictionary<string, string> SHORT => Manifest.MANIFEST.Vowels.Short;
    private static IReadOnlyDictionary<string, string> LBR => Manifest.MANIFEST.Vowels.LongBeforeR;
    private static IReadOnlyDictionary<string, string> SBR => Manifest.MANIFEST.Vowels.ShortBeforeR;
    private static IReadOnlyDictionary<string, string> DIG => Manifest.MANIFEST.Digraphs;
    private static IReadOnlyDictionary<string, string> CONS => Manifest.MANIFEST.Consonants;
    private static IReadOnlyDictionary<string, string> RETRO => Manifest.MANIFEST.Retroflex;
    private const string RETRO_2ND = "tdnsl"; // r + one of these → a single retroflex consonant

    /** JS `w[i] ?? ""` — an out-of-range index reads as the empty string, which every guard above tests for. */
    private static string CharAt(string w, int i) => i >= 0 && i < w.Length ? w[i].ToString() : "";
    /** JS `String.prototype.slice` clamps; `Substring` throws. */
    private static string Slice(string w, int a, int b) =>
        a >= w.Length ? "" : w[a..Math.Min(b, w.Length)];

    private static string? Get(IReadOnlyDictionary<string, string> d, string k) =>
        d.TryGetValue(k, out var v) && v.Length > 0 ? v : null;

    private static readonly JsRe LIQUID_TAIL = JsRegex.Compile("[rlɭ]$");

    /** Is the stressed vowel at index i LONG? 0–1 coda consonant letters → long; ≥2 → short. */
    private static bool StressedLong(string w, int i)
    {
        int j = i + 1, count = 0;
        while (j < w.Length && !IsV(CharAt(w, j)))
        {
            // ⚠ `RETRO_2ND.Contains("")` is TRUE (as in JS), so a word-final ⟨r⟩ takes this arm. Same count,
            // same exit — do not "fix" it into an out-of-range guard that changes the arm.
            if (CharAt(w, j) == "r" && RETRO_2ND.Contains(CharAt(w, j + 1), StringComparison.Ordinal))
            {
                count++; // retroflex r+dental = one consonant
                j += 2;
            }
            else if (CharAt(w, j) == "x")
            {
                count += 2; // ⟨x⟩ = the cluster /ks/ → closes the syllable
                j++;
            }
            else
            {
                count++;
                j++;
            }
        }
        return count <= 1;
    }

    /** Scan a lowercased Swedish word into IPA segments (no stress mark). */
    public static List<Seg> ToSegments(string word, double stressOrd = 0, bool oLong = false, Compound? compound = null)
    {
        var w = Js.ToLowerCase(word);
        var n = w.Length;
        var segs = new List<Seg>();
        var i = 0;
        var vowelOrd = 0;
        void Push(string ph, bool vowel = false) => segs.Add(new Seg { Ph = ph, Vowel = vowel });

        while (i < n)
        {
            string c = CharAt(w, i), nx = CharAt(w, i + 1), nx2 = CharAt(w, i + 2);
            // ⚠ THE APOSTROPHE IS ORTHOGRAPHY, NOT A PHONE. Dropped HERE rather than stripped from the word:
            // the NST lexicon spells its five headwords WITH it, so the lookup upstream needs the original
            // string and only the segmental pass needs it gone. Left to fall through it reached the bottom of
            // the loop, where an unread character is PASSED THROUGH, and leaked into the IPA — *ɔ'brˈiːɛn*.
            // ⚠ NOT in Core/LatinPhones: that net is already wired at this g2p's fall-through and is right for
            // a LETTER the language cannot read, but an apostrophe is not a letter and it correctly declines.
            // Nor could a central rule drop it — Hausa writes `'yan` with a phonemic glottalised /ʲ/ on it.
            if (c == "'" || c == "\u2019") { i++; continue; }
            var three = Slice(w, i, i + 3);
            var two = Slice(w, i, i + 2);
            var softenOnset =
                vowelOrd == 0 ||
                (compound is not null && vowelOrd == compound.SecOrd && !(compound.SecVowelInitial ?? false));

            // -tion / -sion → ɧuːn, gated to i>0 so a word-initial stem (tionde) is not swallowed.
            if (i > 0 && (two == "ti" || two == "si") && Slice(w, i, i + 4) == c + "ion")
            {
                Push("ɧ");
                Push("uː", true);
                Push("n");
                vowelOrd++;
                i += 4;
                continue;
            }

            if (IsV(c))
            {
                var isPrimary = vowelOrd == stressOrd;
                var isLong = compound is not null
                    ? compound.LongOrds.Contains(vowelOrd)
                    : isPrimary && StressedLong(w, i);
                var beforeR = nx == "r";
                string ph;
                if (isLong && oLong && c == "o") ph = "oː"; // lexical: stressed ⟨o⟩ is [oː], not the default [uː]
                else if (isLong) ph = (beforeR ? Get(LBR, c) : null) ?? Get(LONG, c) ?? c;
                else ph = (beforeR ? Get(SBR, c) : null) ?? Get(SHORT, c) ?? c;
                Push(ph, true);
                vowelOrd++;
                i++;
                continue;
            }

            // word-initial silent digraphs hj/lj/dj/gj → j
            if (i == 0 && nx == "j" && "hldg".Contains(c, StringComparison.Ordinal))
            {
                Push("j");
                i += 2;
                continue;
            }

            // word-initial ⟨gn⟩ → ɡn; only medial/coda ⟨gn⟩ velarises to ŋn
            if (i == 0 && two == "gn")
            {
                Push("ɡ");
                Push("n");
                i += 2;
                continue;
            }

            if (Get(DIG, three) is { } d3)
            {
                Push(d3);
                i += 3;
                continue;
            }

            if (two == "sk" && softenOnset && IsFront(nx2))
            {
                Push("ɧ");
                i += 2;
                continue;
            }

            if (c == "r" && Get(RETRO, two) is { } retro)
            {
                Push(retro);
                i += 2;
                continue;
            }

            if (Get(DIG, two) is { } d2)
            {
                foreach (var ch in Js.CodePoints(d2)) Push(ch);
                i += 2;
                continue;
            }

            // geminate consonant: doubled letter → single C + ː
            if (c == nx && !IsV(c))
            {
                if (c == "g") Push("ɡː");
                else if (c == "k") Push("kː");
                else if (c == "c")
                {
                    var after = CharAt(w, i + 2);
                    if (IsFront(after) || after == "é") { Push("k"); Push("s"); } else Push("k");
                }
                else if (Get(CONS, c) is { } cons) Push(cons + "ː");
                else
                {
                    var p = LatinPhones.LatinPhone(c, new PhoneOpts { Initial = i == 0, IncludeH = false });
                    Push(p is not null ? p + "ː" : c);
                }
                i += 2;
                continue;
            }

            if (c == "k")
            {
                Push(softenOnset && IsFront(nx) ? "ɕ" : "k");
                i++;
                continue;
            }
            if (c == "g")
            {
                var prev = segs.Count > 0 ? segs[^1].Ph : "";
                if (softenOnset && IsFront(nx)) Push("j");
                else if (!IsV(nx) && LIQUID_TAIL.IsMatch(prev)) Push("j"); // berg/älg: r/l + g → j
                else Push("ɡ");
                i++;
                continue;
            }
            if (c == "c")
            {
                Push(softenOnset && IsFront(nx) ? "s" : "k");
                i++;
                continue;
            }

            if (Get(CONS, c) is { } plain)
            {
                Push(plain);
                i++;
                continue;
            }

            var fallback = LatinPhones.LatinPhone(c, new PhoneOpts { Initial = segs.Count == 0, IncludeH = false });
            Push(fallback ?? c);
            i++;
        }

        return segs;
    }
}
