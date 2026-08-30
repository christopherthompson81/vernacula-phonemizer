/**
 * Basque (eu) phonemizer — a left-to-right greedy scan over a digraph + letter table, canonical IPA.
 * This file owns the two context rules: the ⟨r⟩ tap/trill split (tap only between vowels) and the ⟨h⟩
 * choice, plus the vigesimal number composition. The grapheme tables (incl. the three-way sibilant
 * hallmark), the number words and the encyclopedic record live in basque.jsonc.
 * Ported from src/languages/basque/basque.ts — see that file for the corpus evidence.
 */
using System.Text;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Basque;

public static class BasquePhonemizer
{
    private static IReadOnlyDictionary<string, string> LETTER => Manifest.MANIFEST.Letters;
    private static readonly IReadOnlySet<string> VOWELS = Manifest.VOWELS;

    /** One Basque word → canonical IPA. */
    public static string PhonemizeWord(string word)
    {
        // NFC so ⟨ñ ç⟩ stay single codepoints (NFD would drop the mark)
        var chars = Js.CodePoints(Js.ToLowerCase(Js.Normalize(word, NormalizationForm.FormC)));
        var outp = new List<string>();
        for (var i = 0; i < chars.Count; i++)
        {
            var c = chars[i];
            // Digraphs first (tx tz ts dd tt ll rr).
            var nx = i + 1 < chars.Count ? chars[i + 1] : null;
            if (nx is not null && Manifest.DIGRAPHS.TryGetValue(c + nx, out var dg)) { outp.Add(dg); i++; continue; }
            // ⟨h⟩→[h] (northern/careful standard, faithful to the spelling; the southern majority drops it —
            // the referee lists both, and the h-form scores higher)
            if (c == "h") { outp.Add("h"); continue; }
            if (c == "r")
            {
                // TAP [ɾ] only between vowels; TRILL [r] word-initially, word-finally, or next to a consonant.
                var prevV = i > 0 && VOWELS.Contains(chars[i - 1]);
                var nextV = i + 1 < chars.Count && VOWELS.Contains(chars[i + 1]);
                outp.Add(prevV && nextV ? "ɾ" : "r");
                continue;
            }
            if (LETTER.TryGetValue(c, out var ph)) outp.Add(ph);
            // else: unknown char (apostrophe, hyphen) — skip
        }
        return string.Concat(outp);
    }

    // ── NUMBERS (the Basque VIGESIMAL / base-20 system; data + provenance in basque.jsonc) ──────────────
    private static BasqueNumbersDef NUM => Manifest.MANIFEST.Numbers;
    private static IReadOnlyList<string> ONES => NUM.Ones;
    private static IReadOnlyList<string> SCORES => NUM.Scores;
    private static IReadOnlyList<string> HUNDREDS => NUM.Hundreds;

    /** Basque cardinal 0 ≤ n < 10¹² → the spelled-out words (space-separated). */
    public static string CardinalWords(double n)
    {
        if (n < 20) return ONES[(int)n];
        if (n < 100)
        {
            var score = (int)Math.Floor(n / 20);
            var rem = (int)(n % 20);
            return rem == 0 ? SCORES[score] : $"{SCORES[score]}ta {ONES[rem]}"; // hogeita hamar
        }
        if (n < 1000)
        {
            var h = (int)Math.Floor(n / 100);
            var rem = n % 100;
            return rem == 0 ? HUNDREDS[h] : $"{HUNDREDS[h]} {NUM.And} {CardinalWords(rem)}"; // ehun eta bat
        }
        if (n < 1_000_000)
        {
            var th = Math.Floor(n / 1000);
            var rem = n % 1000;
            var thWord = th == 1 ? NUM.Thousand : $"{CardinalWords(th)} {NUM.Thousand}";
            return rem == 0 ? thWord : $"{thWord}{(rem < 100 ? $" {NUM.And} " : " ")}{CardinalWords(rem)}";
        }
        if (n < 1_000_000_000)
        {
            var mil = Math.Floor(n / 1_000_000);
            var rem = n % 1_000_000;
            var milWord = mil == 1 ? $"{NUM.Million} bat" : $"{CardinalWords(mil)} {NUM.Million}";
            return rem == 0 ? milWord : $"{milWord}{(rem < 100 ? $" {NUM.And} " : " ")}{CardinalWords(rem)}";
        }
        // 10⁹ is NOT ⟨bilioi⟩ in Basque — the long scale puts bilioi at 10¹², and 10⁹ is said ⟨mila milioi⟩
        // "a thousand million" (Berria Estilo Liburua, the Euskaltzaindia-aligned style manual). Before this,
        // ≥ 10⁹ fell out of range and leaked the raw digits.
        var bil = Math.Floor(n / 1_000_000_000);
        var brem = n % 1_000_000_000;
        var bilWord = bil == 1
            ? $"{NUM.Thousand} {NUM.Million}"
            : $"{CardinalWords(bil)} {NUM.Thousand} {NUM.Million}";
        return brem == 0 ? bilWord : $"{bilWord}{(brem < 100 ? $" {NUM.And} " : " ")}{CardinalWords(brem)}";
    }

    /**
     * A digit string → canonical IPA of its Basque cardinal (each word phonemized, space-joined).
     *
     * ⚠ 10¹² (bilioi) IS NOT AUTHORED — but that is a gap in the WORDS, not a licence to leak ASCII digits
     * into the IPA. Read them one at a time instead, the fleet's fallback at the 2^53 cliff one magnitude
     * down.
     */
    private static string Number(string digits)
    {
        var n = Js.Number(digits);
        // JS `Number.isSafeInteger(n)`: an integral double inside ±2^53 − 1.
        if (!(double.IsInteger(n) && Math.Abs(n) <= 9007199254740991.0) || n < 0 || n >= 1_000_000_000_000)
            return string.Join(" ", Js.CodePoints(digits).Select(c => PhonemizeWord(CardinalWords(Js.Number(c)))));
        return string.Join(" ", CardinalWords(n).Split(' ').Select(PhonemizeWord));
    }

    // Basque uses the basic Latin alphabet + ⟨ñ ç⟩. Word / number / punctuation.
    private static readonly JsRe TOKEN =
        JsRegex.Compile($"({HostWord.LATIN_RUN})|(\\d+)|([.?!,;:…])", "gu");

    /**
     * This language's OWN inventory. ⚠ TWO DIFFERENT QUESTIONS, KEPT APART: the TOKEN class above decides
     * where the SCRIPT boundary falls (routing), while this one decides whether the g2p has rules for these
     * letters. A token this class REJECTS carries a letter the language does not use — i.e. a foreign name.
     */
    private const string NATIVE_CLASS = "[a-zñçA-ZÑÇ]";
    private static readonly Func<string, string> Nat = HostWord.MakeNativiser(NATIVE_CLASS, "u");

    private sealed class Engine : ILanguage
    {
        public string Text(string input)
        {
            // NFC-normalize before tokenizing: Basque ⟨ñ ç⟩ decompose under NFD to base+combining, which fall
            // outside the [a-zñçA-ZÑÇ] token class → NFD input would shatter words and drop the letter.
            // NORMALIZATION FIRST — see Normalize.cs. The shared symbol tier is declared THERE rather than
            // here, because this language's decimal comma and its glued case endings both have to be
            // sequenced around it: the tier needs the figure intact, and both of those rules consume it.
            var prepared = Normalize.NormalizeBasque(Rewriter.Renormalize(input, NormalizationForm.FormC));
            return Clauses.AssembleClauses(prepared, TOKEN, (m, sink) =>
            {
                if (m.Groups[1].Success && m.Groups[1].Value.Length > 0)
                    sink.Emit(PhonemizeWord(Nat(m.Groups[1].Value)));
                else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
                    sink.Emit(Number(m.Groups[2].Value)); // Basque vigesimal cardinals
                else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
                    sink.Pause(m.Groups[3].Value is "." or "!" or "?" ? m.Groups[3].Value : ",");
            });
        }
    }

    /** Build the Basque phonemizer (greedy digraph+letter scan; three-way sibilants; r tap/trill). */
    public static ILanguage CreateBasque() => new Engine();

    internal static void RegisterSelf() => Registry.Register("basque", CreateBasque);
}
