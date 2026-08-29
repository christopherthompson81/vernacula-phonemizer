/**
 * Crimean Tatar (crh) phonemizer — a left-to-right Latin grapheme scan (no digraphs) + gemination +
 * word-final (oxytone) stress, canonical IPA. This file owns the position rules: the ⟨v⟩→[w] post-vocalic
 * coda, the Turkish-style dotless-I casing, and the stress placement. The letter table and the
 * encyclopedic record live in crimeantatar.jsonc.
 * Ported from src/languages/crimeantatar/crimeantatar.ts — see that file for the referee evidence.
 */
using System.Text;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.CrimeanTatar;

public static class CrimeanTatarPhonemizer
{
    private static IReadOnlyDictionary<string, string> LETTER => Manifest.MANIFEST.Letters;
    private static readonly IReadOnlySet<string> VOWEL = Manifest.VOWEL;

    /** ⚠ TURKISH-STYLE CASING, and it must run BEFORE the generic lowercase: the dotless capital ⟨I⟩→[ɯ]
     *  has to become ⟨ı⟩ (a plain lowercase gives dotted ⟨i⟩=[i], the wrong vowel), and dotted ⟨İ⟩→⟨i⟩. So
     *  a capitalised back-vowel word (Qırım) keeps [ɯ]. Verified against JS across the alphabet in both
     *  cases before this was written. */
    private static readonly JsRe DOTTED_I = JsRegex.Compile("İ", "gu");
    private static readonly JsRe DOTLESS_I = JsRegex.Compile("I", "gu");

    private static bool IsVowelPh(string s) => Js.CodePoints(s).Any(Ipa.IPA_VOWEL.Contains);

    /** One Crimean Tatar word → canonical IPA. */
    public static string PhonemizeWord(string word)
    {
        var cased = DOTLESS_I.Replace(DOTTED_I.Replace(word.Normalize(NormalizationForm.FormC), "i"), "ı");
        var chars = Js.CodePoints(Js.ToLowerCase(cased));
        var segs = new List<string>();
        for (var i = 0; i < chars.Count; i++)
        {
            var c = chars[i];
            // ⚠ A letter with no rule here still denotes a sound; dropping it deletes what the writer typed.
            // Reached only when every rule above has declined, so the language's own reading always wins.
            var ph = LETTER.TryGetValue(c, out var lv)
                ? lv
                : LatinPhones.LatinPhone(c, new PhoneOpts { Initial = i == 0, IncludeH = true });
            if (ph is null) continue; // not a letter at all (stray mark) — skip
            // ⟨v⟩ → [w] in a POST-VOCALIC CODA (after a vowel, not before one): the Kipchak offglide
            // (av→ɑw, suv→suw). Intervocalic / onset ⟨v⟩ stays [v] (quvet→quvet, vatan→vɑtɑn).
            if (c == "v" && i > 0 && VOWEL.Contains(chars[i - 1])
                && !(i + 1 < chars.Count && VOWEL.Contains(chars[i + 1])))
                ph = "w";
            // Gemination: a doubled letter → the phoneme + length (yollamaq → jolːɑmɑq, şeer → ʃeːr).
            if (i + 1 < chars.Count && chars[i + 1] == c) { segs.Add(ph + "ː"); i++; }
            else segs.Add(ph);
        }
        // Word-final (oxytone) stress — ˈ before the last vowel's onset consonant (the Turkic default).
        var vIdx = new List<int>();
        for (var k = 0; k < segs.Count; k++)
            if (IsVowelPh(segs[k])) vIdx.Add(k);
        if (vIdx.Count > 0)
        {
            var nucleus = vIdx[^1];
            var at = nucleus > 0 && !IsVowelPh(segs[nucleus - 1]) ? nucleus - 1 : nucleus;
            segs.Insert(at, "ˈ");
        }
        return string.Concat(segs);
    }

    /**
     * A digit run → spoken Crimean Tatar, phonemized through the same g2p.
     *
     * ⚠ ABOVE 2^53 THE RAW ASCII DIGITS USED TO LEAK STRAIGHT INTO THE IPA. `isSafeInteger` is right to
     * refuse to COMPOSE — the float has already lost the low digits — but the refusal returned the digit
     * string, which no g2p in this fleet reads. Read it out digit-at-a-time instead, THROUGH THE SAME
     * COMPOSER, so the fallback cannot invent a word.
     */
    private static string Number(string digits)
    {
        var n = Js.Number(digits);
        if (!(double.IsInteger(n) && Math.Abs(n) <= 9007199254740991.0))
            return string.Join(" ", Js.CodePoints(digits)
                .SelectMany(d => Numbers.NumberToWords(Js.Number(d)))
                .Select(PhonemizeWord));
        return string.Join(" ", Numbers.NumberToWords(n).Select(PhonemizeWord));
    }

    // Crimean Tatar Latin — a-z + the Turkish-style letters. Word / number / punctuation.
    private static readonly JsRe TOKEN =
        JsRegex.Compile($"({HostWord.LATIN_RUN})|(\\d+)|([.?!,;:…])", "gu");

    /**
     * This language's OWN inventory. ⚠ TWO DIFFERENT QUESTIONS, KEPT APART: the TOKEN class above decides
     * where the SCRIPT boundary falls (routing), while this one decides whether the g2p has rules for these
     * letters. A token this class REJECTS carries a letter the language does not use — a foreign name.
     */
    private const string NATIVE_CLASS = "[a-zâçğıiñöşüA-ZÂÇĞIİÑÖŞÜ]";
    private static readonly Func<string, string> Nat = HostWord.MakeNativiser(NATIVE_CLASS, "u");

    private sealed class Engine : ILanguage
    {
        public string Text(string input)
        {
            // Normalize FIRST — its percent-suffix, separator, era, coordinate, range, sign and degree
            // steps need the figure and its mark still adjacent, which the shared tier would break; the
            // tier itself runs inside that pass, between the percent step and the de-grouping.
            var prepared = Normalize.NormalizeCrimeanTatar(Rewriter.Renormalize(input, NormalizationForm.FormC));
            return Clauses.AssembleClauses(prepared, TOKEN, (m, sink) =>
            {
                if (m.Groups[1].Success && m.Groups[1].Value.Length > 0)
                    sink.Emit(PhonemizeWord(Nat(m.Groups[1].Value)));
                else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
                    sink.Emit(Number(m.Groups[2].Value));
                else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
                    sink.Pause(m.Groups[3].Value is "." or "!" or "?" ? m.Groups[3].Value : ",");
            });
        }
    }

    /** Build the Crimean Tatar phonemizer (Latin grapheme scan + gemination + final stress). */
    public static ILanguage CreateCrimeanTatar() => new Engine();

    internal static void RegisterSelf() => Registry.Register("crimeantatar", CreateCrimeanTatar);
}
