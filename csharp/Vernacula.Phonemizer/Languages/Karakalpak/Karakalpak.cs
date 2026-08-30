/**
 * Karakalpak (kaa) phonemizer — a left-to-right greedy scan over a digraph + letter table + word-final
 * (oxytone) stress, canonical IPA. This file owns the Turkish-style dotless-I casing and the stress
 * placement (backs up over one onset consonant: basqa→[bɑsˈqɑ]). The letter tables live in
 * karakalpak.jsonc.
 * Ported from src/languages/karakalpak/karakalpak.ts — see that file for the corpus evidence.
 */
using System.Text;
using Vernacula.Phonemizer.Core;
using static Vernacula.Phonemizer.Core.Rewriter;

namespace Vernacula.Phonemizer.Languages.Karakalpak;

public static class KarakalpakPhonemizer
{
    /** The dotted capital ⟨İ⟩→⟨i⟩ and the dotless capital ⟨I⟩→⟨ı⟩, in the TS order. */
    private static readonly JsRe I_DOTTED = JsRegex.Compile("İ", "gu");
    private static readonly JsRe I_DOTLESS = JsRegex.Compile("I", "gu");

    /** One Karakalpak word → canonical IPA. */
    public static string PhonemizeWord(string word)
    {
        // Turkish-style casing FIRST: the dotless capital ⟨I⟩→[ɯ] must lowercase to ⟨ı⟩ (JS toLowerCase
        // would give dotted ⟨i⟩=[i]), and the dotted capital ⟨İ⟩→⟨i⟩. Before the generic lowercase, so
        // capitalized back-vowel words (proper nouns) keep [ɯ]. ⚠ `Js.Normalize`, not `string.Normalize` —
        // JS `normalize` never throws, and .NET's refuses a lone surrogate the tokenizer can hand over (#1199).
        var cased = I_DOTLESS.Replace(I_DOTTED.Replace(Js.Normalize(word, NormalizationForm.FormC), "i"), "ı");
        var chars = Js.CodePoints(Js.ToLowerCase(cased));
        var segs = new List<string>();
        for (var i = 0; i < chars.Count; i++)
        {
            var c = chars[i];
            var nx = i + 1 < chars.Count ? chars[i + 1] : null;
            if (nx is not null && Manifest.DIGRAPHS.TryGetValue(c + nx, out var dg)) { segs.Add(dg); i++; continue; }
            // ⚠ A letter with no rule here still denotes a sound; dropping it deletes what the writer
            // typed. Reached only when every rule above has declined, so the language's own reading
            // always wins.
            var ph = Manifest.MANIFEST.Letters.TryGetValue(chars[i], out var letter)
                ? letter
                : LatinPhones.LatinPhone(chars[i], new PhoneOpts { Initial = i == 0, IncludeH = true });
            if (ph != null) segs.Add(ph);
        }
        // Word-final (oxytone) stress — ˈ before the last vowel's onset consonant (Turkic default).
        var vIdx = new List<int>();
        for (var idx = 0; idx < segs.Count; idx++) if (Ipa.IPA_VOWEL.Contains(segs[idx])) vIdx.Add(idx);
        if (vIdx.Count > 0)
        {
            var nucleus = vIdx[^1];
            var at = nucleus > 0 && !Ipa.IPA_VOWEL.Contains(segs[nucleus - 1]) ? nucleus - 1 : nucleus;
            segs.Insert(at, "ˈ");
        }
        return string.Concat(segs);
    }

    /**
     * A digit run → spoken Karakalpak, phonemized through the same g2p.
     *
     * ⚠ ABOVE 2^53 THE RAW ASCII DIGITS USED TO LEAK STRAIGHT INTO THE IPA. `isSafeInteger` is right to
     * refuse to COMPOSE — the float has already lost the low digits — but the refusal returned the digit
     * string, which no g2p in this fleet reads. Read it out digit-at-a-time instead, THROUGH THE SAME
     * COMPOSER: a one-digit number is a call this engine already answers, so the fallback cannot invent a
     * word. Above 2^53 the reading is a digit string, not a quantity.
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

    /**
     * This language's OWN inventory. ⚠ TWO DIFFERENT QUESTIONS, KEPT APART: the TOKEN class above decides
     * where the SCRIPT boundary falls (routing), while this one decides whether the g2p has rules for
     * these letters. Both capital ⟨I⟩ (dotless) and ⟨İ⟩ (dotted) are in the class; omitting the latter
     * drops the letter and splits the word.
     */
    private const string NATIVE_CLASS = "[a-záóúíńǵıA-ZÁÓÚÍŃǴIİ]";
    public static readonly Func<string, string> Nat = HostWord.MakeNativiser(NATIVE_CLASS, "u");

    /** Karakalpak Latin (2016) — a-z + the acute/dotless letters. Word / number / punctuation. */
    private static readonly JsRe TOKEN =
        JsRegex.Compile($"({HostWord.LATIN_RUN})|(\\d+)|([.?!,;:…])", "gu");

    private sealed class Engine : ILanguage
    {
        public string Text(string input)
        {
            // normalize FIRST — its percent-suffix, separator, era, abbreviation, clock, degree and sign
            // steps need the figure and its mark still adjacent, which the shared tier would break; the
            // tier itself runs inside that pass, between the percent step and the de-grouping.
            return Clauses.AssembleClauses(
                Normalize.NormalizeKarakalpak(Renormalize(input, NormalizationForm.FormC)), TOKEN, (m, sink) =>
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

    /** Build the Karakalpak phonemizer (Latin 2016 greedy scan + final stress). */
    public static ILanguage CreateKarakalpak() => new Engine();

    internal static void RegisterSelf()
    {
        Registry.Register("karakalpak", CreateKarakalpak);
    }
}
