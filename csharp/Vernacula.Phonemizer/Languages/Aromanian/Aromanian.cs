/**
 * Aromanian (rup) phonemizer — a greedy left-to-right scan over the Cunia/DIARO orthography with the
 * shared Romance contextual phonology, canonical IPA. This file owns the context rules: the ⟨dz⟩/⟨ndz⟩
 * soft-g reflex, ⟨c/g⟩ softening with the silent softener i, the rising diphthongs ⟨ea oa⟩, the ⟨i u⟩
 * glides, and the word-final ⟨-u⟩ desyllabification. The digraph/letter tables and the encyclopedic
 * record live in aromanian.jsonc.
 * Ported from src/languages/aromanian/aromanian.ts — see that file for the corpus evidence.
 */
using System.Text;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Aromanian;

public static class AromanianPhonemizer
{
    private static IReadOnlyDictionary<string, string> LETTER => Manifest.MANIFEST.Letters;
    private static readonly HashSet<string> VOWEL_L = Manifest.VOWEL_L;
    private const string VOWEL_PH = "aeiouəɨ";

    /** JS `isFront` / `isHigh` — null-safe, as the TS is with `undefined`. */
    private static bool IsFront(string? x) => x is "e" or "i";
    private static bool IsHigh(string? x) => x is "i" or "u";

    /** JS `p.slice(-1)` — the last code unit, which is what the vowel tests compare. */
    private static string Last1(string p) => p.Length == 0 ? "" : p[^1..];
    private static bool IsVowelPh(string? p) => p is not null && VOWEL_PH.Contains(Last1(p), StringComparison.Ordinal);

    /** One Aromanian word → canonical IPA. */
    public static string PhonemizeWord(string word)
    {
        var s = Js.CodePoints(Js.ToLowerCase(word.Normalize(NormalizationForm.FormC)));
        var n = s.Count;
        var outp = new List<string>();
        bool PrevVowel() => outp.Count > 0 && IsVowelPh(outp[^1]);
        for (var i = 0; i < n; i++)
        {
            var c = s[i];
            var nx = i + 1 < n ? s[i + 1] : null;
            var nn = i + 2 < n ? s[i + 2] : null;
            // ⟨dz⟩: [d͡ʒ] in the ⟨ndz⟩ + front-vowel soft-g reflex; else [d͡z].
            if (c == "d" && nx == "z")
            {
                var after = i + 2 < n ? s[i + 2] : null;
                outp.Add(outp.Count > 0 && outp[^1] == "n" && (after == "e" || after == "i") ? "d͡ʒ" : "d͡z");
                i++; continue;
            }
            // Digraphs (ts sh nj lj ll dh th gh ch).
            if (nx is not null && Manifest.DIGRAPHS.TryGetValue(c + nx, out var dg)) { outp.Add(dg); i++; continue; }
            // ⟨c⟩: soften before ⟨e i⟩ → t͡ʃ (⟨ci⟩+V drops the silent i); else [k].
            if (c == "c")
            {
                if (IsFront(nx))
                {
                    outp.Add("t͡ʃ");
                    if (nx == "i" && nn is not null && VOWEL_L.Contains(nn)) i++; // ⟨ci⟩+V: silent softener i
                }
                else outp.Add("k");
                continue;
            }
            // ⟨g⟩: soften before ⟨e i⟩ → d͡ʒ; else [ɡ]. (⟨gh⟩ handled by the digraph table above.)
            if (c == "g")
            {
                if (IsFront(nx))
                {
                    outp.Add("d͡ʒ");
                    if (nx == "i" && nn is not null && VOWEL_L.Contains(nn)) i++;
                }
                else outp.Add("ɡ");
                continue;
            }
            // Vowels: rising diphthongs, final -u desyllabification, i/u glides, then the plain vowel.
            if (VOWEL_L.Contains(c))
            {
                if ((c == "e" || c == "o") && nx == "a") { outp.Add(c == "e" ? "e̯" : "o̯"); continue; } // ea→e̯a, oa→o̯a
                // WORD-FINAL ⟨-u⟩ (the Latin short -us) DESYLLABIFIES after a single consonant; after a
                // cluster it stays syllabic.
                if (c == "u" && i == n - 1 && outp.Count >= 2 &&
                    !IsVowelPh(outp[^1]) && IsVowelPh(outp[^2]))
                {
                    continue; // drop the desyllabified final -u
                }
                // Word-final ⟨ie⟩ after a consonant is a hiatus [i.e] — keep the ⟨i⟩ syllabic.
                if (c == "i" && nx == "e" && i + 2 == n && !PrevVowel()) { outp.Add("i"); continue; }
                // ⟨i u⟩ glide next to another vowel: OFF-glide after a nucleus, ON-glide before a non-high
                // FULL vowel; NOT before ⟨ã⟩→[ə].
                var onglide = nx is not null && VOWEL_L.Contains(nx) && !IsHigh(nx) && nx != "ã";
                if (IsHigh(c) && (PrevVowel() || onglide)) { outp.Add(c == "i" ? "j" : "w"); continue; }
                outp.Add(LETTER.TryGetValue(c, out var lv) ? lv : c);
                continue;
            }
            var ph = LETTER.TryGetValue(c, out var consonant) ? consonant : null;
            if (ph is not null) outp.Add(ph);
            // else (apostrophe, hyphen, stray marks): skip
        }
        return string.Concat(outp);
    }

    // Aromanian Latin + ⟨ã â î ñ ç⟩. Word / number / punctuation.
    private static readonly JsRe TOKEN = JsRegex.Compile($"({HostWord.LATIN_RUN})|(\\d+)|([.?!,;:…])", "gu");

    /**
     * This language's OWN inventory — the TOKEN word class as it stood before the widening above, lifted
     * verbatim, so nothing about the orthography is invented here. A token this REJECTS carries a letter
     * the language does not use, i.e. a foreign name.
     *
     * ⚠ ä Ä ARE DELIBERATELY ABSENT: the g2p has no rule for them and drops them outright, so listing them
     * here would promise a reading that does not exist.
     */
    private const string NATIVE_CLASS = "[a-zãâîñçA-ZÃÂÎÑÇ]";
    private static readonly Func<string, string> Nat = HostWord.MakeNativiser(NATIVE_CLASS, "u");

    private sealed class Engine : ILanguage
    {
        public string Text(string input)
        {
            var normalized = Normalize.NormalizeAromanian(Rewriter.Renormalize(input, NormalizationForm.FormC));
            return Clauses.AssembleClauses(normalized, TOKEN, (m, sink) =>
            {
                if (m.Groups[1].Success && m.Groups[1].Value.Length > 0)
                    sink.Emit(PhonemizeWord(Nat(m.Groups[1].Value)));
                // A digit run reads as Aromanian number words, each phonemized like any other word.
                else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
                    foreach (var wd in Numbers.NumberToWords(Js.Number(m.Groups[2].Value), m.Groups[2].Value).Split(' '))
                        sink.Emit(PhonemizeWord(wd));
                else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
                    sink.Pause(m.Groups[3].Value is "." or "!" or "?" ? m.Groups[3].Value : ",");
            });
        }
    }

    /** Build the Aromanian phonemizer (Cunia-orthography scan + Romance c/g softening, diphthongs, glides). */
    public static ILanguage CreateAromanian() => new Engine();

    internal static void RegisterSelf() => Registry.Register("aromanian", CreateAromanian);
}
