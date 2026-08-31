/**
 * Native Kyrgyz / кыргызча (ky) text phonemizer — canonical IPA. Turkic (Kipchak), Cyrillic.
 * Kyrgyz Cyrillic is a shallow near-1:1 orthography with STRICT, SPELLED vowel harmony, so this is a
 * left-to-right scan (kyrgyz.jsonc = the letter tables) with three code rules: (1) VELAR/UVULAR harmony —
 * ⟨к⟩→[q]/⟨г⟩→[ʁ] next to a BACK vowel, [k]/[ɡ] next to a FRONT vowel (Kyrgyz does not spell this, unlike
 * Kazakh қ/ғ); (2) dark ⟨л⟩→[ɫ] by the same back-harmony, clear [l] by front; (3) LONG vowels — a doubled
 * vowel is [Vː]. ⟨б⟩ lenites to the bilabial fricative [β] between two vowels.
 * Ported from src/languages/kyrgyz/kyrgyz.ts — see that file for the corpus evidence.
 */
using System.Text;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Kyrgyz;

public static class KyrgyzPhonemizer
{
    private static IReadOnlyDictionary<string, string> V => Manifest.DEF.Vowels;
    private static IReadOnlyDictionary<string, string> IOTATED => Manifest.DEF.Iotated;
    private static IReadOnlyDictionary<string, string> CONS => Manifest.DEF.Consonants;
    private static IReadOnlyDictionary<string, string> CLAUSE_MARK => Manifest.DEF.ClausePunctuation;
    private static IReadOnlySet<string> BACK => Manifest.BACK;

    private static bool IsVowelLetter(string c) => V.ContainsKey(c);

    /**
     * The backness of the vowel GOVERNING a к/г/л at index i. A CODA (a vowel directly before, none directly
     * after) is governed by that PRECEDING vowel (ак→aq); otherwise by the nearest FOLLOWING vowel, else the
     * nearest preceding (Баткен→batken). Returns true = back (uvular/dark), false = front (velar/clear);
     * defaults to front if the word has no vowel.
     */
    private static bool BackHarmony(List<string> chars, int i)
    {
        if (i > 0 && IsVowelLetter(chars[i - 1]) && !(i + 1 < chars.Count && IsVowelLetter(chars[i + 1])))
            return BACK.Contains(chars[i - 1]); // coda
        for (var k = i + 1; k < chars.Count; k++) if (IsVowelLetter(chars[k])) return BACK.Contains(chars[k]);
        for (var k = i - 1; k >= 0; k--) if (IsVowelLetter(chars[k])) return BACK.Contains(chars[k]);
        return false;
    }

    /** One Kyrgyz word → canonical IPA. */
    public static string PhonemizeWord(string word)
    {
        var chars = Js.CodePoints(Js.ToLowerCase(word));
        var outp = new List<string>();
        for (var i = 0; i < chars.Count; i++)
        {
            var c = chars[i];
            // LONG vowel: a doubled vowel letter → [Vː]
            if (IsVowelLetter(c) && i + 1 < chars.Count && chars[i + 1] == c) { outp.Add(V[c] + "ː"); i++; continue; }
            if (IsVowelLetter(c)) { outp.Add(V[c]); continue; }
            // velar/uvular harmony: ⟨к⟩→q/⟨г⟩→ʁ (back) vs k/ɡ (front)
            if (c == "к") { outp.Add(BackHarmony(chars, i) ? "q" : "k"); continue; }
            if (c == "г") { outp.Add(BackHarmony(chars, i) ? "ʁ" : "ɡ"); continue; }
            // dark-l harmony: ⟨л⟩→ɫ (back) vs l (front)
            if (c == "л") { outp.Add(BackHarmony(chars, i) ? "ɫ" : "l"); continue; }
            // ⟨б⟩ lenites to the bilabial fricative [β] between two vowels
            if (c == "б" && i > 0 && IsVowelLetter(chars[i - 1]) && i + 1 < chars.Count && IsVowelLetter(chars[i + 1])) { outp.Add("β"); continue; }
            if (IOTATED.TryGetValue(c, out var io)) { outp.Add(io); continue; }
            if (CONS.TryGetValue(c, out var cons)) outp.Add(cons);
            // else: ъ/ь and unknown chars → skip
        }
        return string.Concat(outp);
    }

    private static bool IsSafeInteger(double n) => double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d;

    /**
     * A digit run → spoken Kyrgyz. ⚠ ABOVE 2^53 THE RAW ASCII DIGITS USED TO LEAK STRAIGHT INTO THE IPA —
     * read them digit-at-a-time through this engine's own number words instead (a digit string, not a
     * quantity).
     */
    private static string Number(string digits)
    {
        var n = Js.Number(digits);
        if (!IsSafeInteger(n)) return Core.Numbers.SpellDigits(digits, Manifest.DEF.Numbers, PhonemizeWord);
        return Core.Numbers.RenderNumber(n, Manifest.DEF.Numbers, PhonemizeWord, Numbers.Compose);
    }

    private static readonly JsRe TOKEN = JsRegex.Compile("([Ѐ-ӿ]+)|(\\d+)|([.?!,;:…—])", "gu");

    private sealed class Engine : ILanguage
    {
        public string Text(string input)
        {
            // TEXT NORMALIZATION runs first and is pure text→text — see Normalize.cs for the rules and
            // their order. Everything below it sees only Cyrillic words, digits and clause marks.
            return Clauses.AssembleClauses(Normalize.NormalizeKyrgyz(input), TOKEN, (m, sink) =>
            {
                if (m.Groups[1].Success && m.Groups[1].Value.Length > 0) sink.Emit(PhonemizeWord(m.Groups[1].Value));
                else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0) sink.Emit(Number(m.Groups[2].Value));
                else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
                {
                    if (CLAUSE_MARK.TryGetValue(m.Groups[3].Value, out var mk) && mk.Length > 0) sink.Pause(mk);
                }
            });
        }
    }

    /** Build the Kyrgyz phonemizer. */
    public static ILanguage CreateKyrgyz() => new Engine();

    internal static void RegisterSelf()
    {
        Registry.Register("kyrgyz", CreateKyrgyz);
    }
}
