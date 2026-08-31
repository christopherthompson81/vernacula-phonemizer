/**
 * Nogai (nog) phonemizer — a near-deterministic digraph-aware Cyrillic grapheme scan + word-final
 * (oxytone) stress, canonical IPA. This file owns the position rules: coda ⟨в⟩→[w] vs onset [v], ⟨е⟩
 * iotation, stray ⟨ъ⟩→[ʔ], and the maximal-onset stress placement. The letter/digraph tables live in
 * nogai.jsonc (Manifest).
 * Ported from src/languages/nogai/nogai.ts — see that file for the corpus evidence.
 */
using System.Text;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Nogai;

public static class NogaiPhonemizer
{
    private static IReadOnlyDictionary<string, string> CONS => Manifest.DEF.Consonants;
    private static IReadOnlyDictionary<string, string> VOWEL => Manifest.DEF.Vowels;
    private static IReadOnlyDictionary<string, string> IOTATED => Manifest.DEF.Iotated;
    private static IReadOnlyDictionary<string, string> DIGRAPH => Manifest.DEF.Digraphs;
    private static readonly HashSet<string> STRESS_NASAL = new(StringComparer.Ordinal) { "m", "n", "ŋ" };

    /** Sonority for maximal-onset stress: vowel 6, glide 5, liquid 4, nasal 3, fricative 2, affricate 1, stop 0. */
    private static int Sonority(string seg)
    {
        if (Js.CodePoints(seg).Any(c => Ipa.IPA_VOWEL.Contains(c))) return 6;
        if (seg is "j" or "w") return 5;
        if (seg is "l" or "r") return 4;
        if (STRESS_NASAL.Contains(seg)) return 3;
        if (seg.Contains("͡")) return 1;
        if (seg is "f" or "v" or "s" or "z" or "ʃ" or "ʒ" or "x" or "χ" or "h" or "ʁ" or "ɣ") return 2;
        return 0;
    }

    /** Is an emitted IPA segment a vowel (or vowel-bearing)? Used for the coda-⟨в⟩, ⟨е⟩-iotation, and stress tests. */
    private static bool IsVowelSeg(string? s) =>
        s is not null && Js.CodePoints(s).Any(c => Ipa.IPA_VOWEL.Contains(c));

    /** Phonemize one Nogai (Cyrillic) word → canonical IPA: digraph-aware grapheme scan + word-final stress. */
    public static string PhonemizeWord(string word)
    {
        var chars = Js.CodePoints(Js.ToLowerCase(Js.Normalize(word, NormalizationForm.FormC)));
        var segs = new List<string>();
        for (var i = 0; i < chars.Count; i++)
        {
            var ch = chars[i];
            var pair = ch + (i + 1 < chars.Count ? chars[i + 1] : "");
            if (DIGRAPH.TryGetValue(pair, out var dig))
            {
                segs.Add(dig);
                i++; // consumed the second character
                continue;
            }
            // ⟨в⟩ → [w] in a post-vocalic coda (before a consonant or word-final), else [v] (onset/loan).
            // The "previous vowel" test reads the last EMITTED segment, so a front-vowel digraph ⟨аь оь уь⟩ —
            // whose second char is the soft sign ь — still counts as the preceding vowel.
            if (ch == "в")
            {
                var nx = i + 1 < chars.Count ? chars[i + 1] : null;
                var coda = nx is null || !Manifest.CYR_VOWEL.Contains(nx);
                // ⚠ `segs.Count > 0` FIRST, and it is not defensive padding — it is the port. The TS reads
                // `segs[segs.length - 1]`, which is `undefined` on an empty list and makes `isVowelSeg`
                // return false, so a WORD-INITIAL ⟨в⟩ yields [v]. `segs[^1]` throws instead, so every word
                // beginning with ⟨в⟩ — вагон, восток, влак, and the bare letter — crashed with
                // ArgumentOutOfRangeException where the TS reads `vaˈɡon`. The ⟨е⟩ branch below already had
                // this guard; this branch did not, and neither the golden nor the tests contain a
                // word-initial ⟨в⟩, so every gate passed.
                segs.Add(segs.Count > 0 && IsVowelSeg(segs[^1]) && coda ? "w" : "v");
                continue;
            }
            // word-initial / post-vocalic ⟨е⟩ → [je]; after a consonant → [e].
            if (ch == "е")
            {
                segs.Add(segs.Count == 0 || IsVowelSeg(segs[^1]) ? "je" : "e");
                continue;
            }
            if (CONS.TryGetValue(ch, out var c)) segs.Add(c);
            else if (IOTATED.TryGetValue(ch, out var io)) segs.Add(io);
            else if (VOWEL.TryGetValue(ch, out var v)) segs.Add(v);
            else if (ch == "ъ") segs.Add("ʔ"); // a stray hard sign (not part of гъ/къ/нъ)
            // ь (a stray soft sign, not part of аь/оь/уь): loan palatalization — dropped
        }
        // Word-final (oxytone) stress: ˈ before the maximal onset of the last vowel's syllable.
        var vidx = new List<int>();
        for (var idx = 0; idx < segs.Count; idx++) if (IsVowelSeg(segs[idx])) vidx.Add(idx);
        if (vidx.Count > 0)
        {
            var at = vidx[^1];
            if (at > 0 && !IsVowelSeg(segs[at - 1])) at--; // the immediate onset consonant
            while (at > 0 && !IsVowelSeg(segs[at - 1]))
            {
                var p = segs[at - 1];
                var l = segs[at];
                var obstruentLiquid = Sonority(p) <= 2 && Sonority(l) >= 4;
                var sibilantStop = (p == "s" || p == "ʃ") && Sonority(l) <= 1;
                if (!(obstruentLiquid || sibilantStop)) break;
                at--;
            }
            segs.Insert(at, "ˈ");
        }
        return string.Concat(segs).Normalize(NormalizationForm.FormC);
    }

    private static bool IsSafeInteger(double n) => double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d;

    /**
     * A digit run → spoken Nogai, phonemized through the same Cyrillic g2p. ⚠ ABOVE 2^53 THE RAW ASCII
     * DIGITS READ DIGIT-AT-A-TIME THROUGH THE SAME COMPOSER (a one-digit number is a call this engine
     * already answers), not from the float, which has lost the low digits.
     */
    private static string Number(string digits)
    {
        var n = Js.Number(digits);
        if (!IsSafeInteger(n))
        {
            var words = new List<string>();
            foreach (var d in Js.CodePoints(digits)) words.AddRange(Numbers.NumberToWords(Js.Number(d)));
            return string.Join(" ", words.Select(PhonemizeWord));
        }
        return string.Join(" ", Numbers.NumberToWords(n).Select(PhonemizeWord));
    }

    // A word (Cyrillic letters) / number / punctuation token.
    private static readonly JsRe TOKEN = JsRegex.Compile("([Ѐ-ӿ]+)|(\\d+)|([.!?…,;:])", "gu");

    private sealed class Engine : ILanguage
    {
        public string Text(string input)
        {
            return Clauses.AssembleClauses(Normalize.NormalizeNogai(input), TOKEN, (m, sink) =>
            {
                if (m.Groups[1].Success && m.Groups[1].Value.Length > 0)
                    sink.Emit(PhonemizeWord(m.Groups[1].Value));
                else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
                    sink.Emit(Number(m.Groups[2].Value));
                else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
                    sink.Pause(m.Groups[3].Value is "." or "!" or "?" ? m.Groups[3].Value : ",");
            });
        }
    }

    /** Build the Nogai phonemizer (digraph-aware Cyrillic g2p + final stress). */
    public static ILanguage CreateNogai() => new Engine();

    internal static void RegisterSelf() => Registry.Register("nogai", CreateNogai);
}
