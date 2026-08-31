/**
 * Papiamentu (pap) phonemizer — a greedy longest-match scan over the Curaçao/Bonaire phonemic
 * orthography, canonical IPA: word-final coda-⟨n⟩ → [ŋ] with vowel nasalization, degemination, the
 * ⟨ou⟩ diphthong, and stress (acute pin / penult default / ultimate for consonant-final).
 * Ported from src/languages/papiamento/papiamento.ts — see that file for the corpus evidence.
 */
using System.Text;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Papiamento;

public static class PapiamentoPhonemizer
{
    private static readonly PapiamentoDef DEF = Manifest.MANIFEST;
    private static IReadOnlyList<IReadOnlyList<string>> DIGRAPHS => DEF.Digraphs;
    private static IReadOnlyDictionary<string, string> LETTER => DEF.Letters;
    private static IReadOnlyDictionary<string, string> NASALIZE => DEF.Nasalized;

    /** The vowel letters counted to place an acute-marked stress. */
    private static readonly HashSet<string> VOWEL_G = new(DEF.VowelLetters, StringComparer.Ordinal);
    /** An acute vowel marks irregular stress. */
    private static readonly HashSet<string> ACUTE = new(StringComparer.Ordinal) { "á", "é", "í", "ó", "ú" };

    /** Degemination: Papiamentu has no geminate consonants (Willemstad → [wiləmstad]). A WORD, not the
     *  pipeline string, so it stays on JsRegex.Replace, off the seam. */
    private static readonly JsRe DEGEN = JsRegex.Compile("([bcdfghjklmnpqrstvwxz])\\1+", "gu");

    /**
     * This language's OWN inventory. The TOKEN class decides where the SCRIPT boundary falls (routing);
     * this one decides whether the g2p has rules for these letters (a foreign-name test).
     */
    private const string NATIVE_CLASS = "[a-zàáèéìíòóùúñA-ZÀÁÈÉÌÍÒÓÙÚÑ]";
    private static readonly Func<string, string> NAT = HostWord.MakeNativiser(NATIVE_CLASS, "u");

    /**
     * The shared SYMBOL tier. Every word is a pap.wikipedia TOKEN attestation; ⚠ EVERY ONE OF THEM IS
     * CURAÇAOAN — the Aruban spellings score zero on the same wiki.
     */
    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        Percent = new[] { "porshento" },
        // ⚠ The ordering that matters is the TIER's, not this Dictionary's — `NormalizeSymbols`
        // sorts the keys longest-first itself, which is what keeps `km`/`cm`/`mm` from losing to `m`.
        // `Dictionary<string, …>` guarantees no enumeration order and none is relied on here.
        Currency = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["$"] = new[] { "dollar", "dollarnan" },
            ["€"] = new[] { "euro", "euronan" },
            ["ƒ"] = new[] { "florin", "florinnan" },
        },
        Units = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["km"] = new[] { "kilometer", "kilometernan" },
            ["m"] = new[] { "meter", "meternan" },
            ["cm"] = new[] { "sentimeter", "sentimeternan" },
            ["mm"] = new[] { "milimeter", "milimeternan" },
            ["kg"] = new[] { "kilo", "kilonan" },
        },
        ExponentWords = new ExponentWordsDef
        {
            Squared = new[] { "kuadrá" }, Cubed = new[] { "kubiko" }, Position = ExponentPosition.After,
        },
        Ampersand = "i",
        Magnitudes = new[] { "mil", "mion", "miyon", "biyon" },
    });

    /**
     * Papiamentu Latin / number / punctuation. ⚠ THE DECIMAL COMMA IS SPANNED BY THE NUMBER BRANCH, or
     * the tokenizer's own `,` claims it as a clause pause and `24,6%` reads as a phrase break inside a
     * quantity; normalize has already folded the dot decimals onto the comma.
     */
    private static readonly JsRe TOKEN = JsRegex.Compile(
        $"({HostWord.LATIN_RUN})|(\\d+(?:,\\d+)?)|([.?!,;:\u2026])", "gu");

    /** One Papiamentu word → canonical IPA. */
    public static string PhonemizeWord(string word)
    {
        var w = JsRegex.Replace(Js.ToLowerCase(Js.Normalize(word, NormalizationForm.FormC)), DEGEN, "$1");
        var chars = Js.CodePoints(w);
        var segs = new List<string>();
        var stressAcute = chars.FindIndex(c => ACUTE.Contains(c));
        for (var i = 0; i < chars.Count; i++)
        {
            var c = chars[i];
            // ⚠ THE TS DESTRUCTURES THE KEY STRING: `([k]) => chars[i] === k[0]` compares against the
            // key's first/second code unit, not the whole key — `p[0]` here is the key, `dg[1]` the value.
            // ⚠ `p.Count > 1 && p[0].Length == 2` IS NOT DEFENSIVE NOISE, it is the shape the slices
            // below assume: `p[0][..1]` throws on an empty key and `dg[1]` on a one-element row, where
            // the TS reads `undefined` and simply fails to match. Both are unreachable on today's
            // jsonc — every digraph row is a 2-char key and a value — so this states the invariant the
            // scan depends on rather than letting a data-only edit turn a non-match into a crash.
            var dg = DIGRAPHS.FirstOrDefault(p =>
                p.Count > 1 && p[0].Length == 2
                && chars[i] == p[0][..1] && i + 1 < chars.Count && chars[i + 1] == p[0][1..]);
            if (dg is not null) { segs.Add(dg[1]); i++; continue; }
            if (c == "o" && i + 1 < chars.Count && chars[i + 1] == "u") { segs.Add("ɔ"); continue; } // the ⟨ou⟩ diphthong → [ɔu]
            // CODA ⟨n⟩ is RETAINED: WORD-FINAL ⟨n⟩ → the velar nasal [ŋ], also NASALIZING the preceding
            // vowel. A ⟨n⟩ before a consonant or a vowel stays [n].
            // ⚠ `segs[^1].Length > 0` guards the SAME asymmetry: the TS `"".slice(-1)` is `""` and
            // `IPA_VOWEL.has("")` is false, while `""[^1..]` throws. No `letters`/`digraphs` value in
            // the jsonc is empty, so this cannot fire today — it keeps a later empty grapheme a
            // non-match here instead of an ArgumentOutOfRangeException.
            if (c == "n" && i + 1 >= chars.Count && segs.Count > 0 && segs[^1].Length > 0
                && Ipa.IPA_VOWEL.Contains(segs[^1][^1..]))
            {
                // ⚠ `[^1..]` IS THE TS `slice(-1)`: the LAST UTF-16 CODE UNIT, so a precomposed nasal
                // vowel (one unit) nasalizes while a decomposed one (base + combining tilde, two units)
                // does not — the two engines must keep agreeing on that.
                var prev = segs[^1];
                var last = prev[^1..];
                segs[^1] = prev[..^1] + (NASALIZE.TryGetValue(last, out var nz) ? nz : last);
                segs.Add("ŋ");
                continue;
            }
            // ⚠ A LETTER WITH NO GRAPHEME IS DROPPED, as in the TS.
            if (LETTER.TryGetValue(c, out var ph)) segs.Add(ph);
        }
        // STRESS: an acute-accented vowel pins it; otherwise the penultimate vowel (Iberian default),
        // ULTIMATE for a consonant-final word or one ending in a NASALIZED vowel. A falling-diphthong
        // OFFGLIDE — [i]/[u] right after another vowel — is NOT a separate nucleus.
        static bool IsVowelSeg(string s) =>
            Js.CodePoints(Js.Normalize(s, NormalizationForm.FormD)).Any(x => Ipa.IPA_VOWEL.Contains(x));
        var vIdx = new List<int>();
        for (var idx = 0; idx < segs.Count; idx++)
        {
            if (!IsVowelSeg(segs[idx])) continue;
            if ((segs[idx] == "i" || segs[idx] == "u") && idx > 0 && IsVowelSeg(segs[idx - 1])) continue;
            vIdx.Add(idx);
        }
        if (vIdx.Count > 0)
        {
            var nucleus = 0;
            if (stressAcute >= 0)
            {
                // map the acute grapheme position to its vowel seg (count vowels up to it)
                var vowelsBefore = chars.Take(stressAcute).Count(x => VOWEL_G.Contains(x));
                nucleus = vIdx[Math.Min(vowelsBefore, vIdx.Count - 1)];
            }
            else
            {
                var last = segs[^1];
                var lastVowel = IsVowelSeg(last);
                var lastNasal = Js.Normalize(last, NormalizationForm.FormD).Contains("\u0303", StringComparison.Ordinal);
                nucleus = (!lastVowel || lastNasal || vIdx.Count < 2) ? vIdx[^1] : vIdx[^2];
            }
            var at = nucleus > 0 && !IsVowelSeg(segs[nucleus - 1]) ? nucleus - 1 : nucleus;
            segs.Insert(at, "ˈ");
        }
        return string.Concat(segs);
    }

    private sealed class Engine : ILanguage
    {
        public string Text(string input) =>
            // normalize FIRST — its separator, era, sign and degree steps need the figure and its mark
            // still adjacent, which the tier would break — then the shared symbol tier.
            Clauses.AssembleClauses(
                SYMBOLS(Normalize.NormalizePapiamento(Rewriter.Renormalize(input, NormalizationForm.FormC))),
                TOKEN,
                (m, sink) =>
                {
                    if (m.Groups[1].Success)
                        sink.Emit(PhonemizeWord(NAT(m.Groups[1].Value)));
                    // A digit run reads as Papiamentu number WORDS, each phonemized like any other word.
                    else if (m.Groups[2].Success)
                    {
                        var parts = m.Groups[2].Value.Split(',');
                        var intPart = parts[0];
                        var frac = parts.Length > 1 ? parts[1] : null;
                        foreach (var wd in Numbers.NumberToWords(Js.Number(intPart), intPart).Split(' '))
                            sink.Emit(PhonemizeWord(wd));
                        if (frac is not null)
                        {
                            // `koma` — the separator's own name. The fractional part reads digit by digit.
                            sink.Emit(PhonemizeWord("koma"));
                            foreach (var dg in Js.CodePoints(frac))
                                foreach (var wd in Numbers.NumberToWords(Js.Number(dg), dg).Split(' '))
                                    sink.Emit(PhonemizeWord(wd));
                        }
                    }
                    else if (m.Groups[3].Success)
                    {
                        var p = m.Groups[3].Value;
                        sink.Pause(p is "." or "!" or "?" ? p : ",");
                    }
                });
    }

    /** Build the Papiamentu phonemizer (Curaçao-orthography scan + coda-n nasalization + stress). */
    public static ILanguage CreatePapiamento() => new Engine();

    internal static void RegisterSelf() => Registry.Register("papiamento", () => CreatePapiamento());
}
