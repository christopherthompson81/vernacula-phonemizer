/**
 * Chuvash (chv) phonemizer — a Cyrillic grapheme scan, canonical IPA. This file owns the two signature
 * rules as passes: ALLOPHONIC VOICING (voiceless obstruents voice between vowels / after a nasal+glide /
 * after a liquid before a FULL vowel, with geminates blocking) and REDUCED-VOWEL STRESS (stress on the
 * last FULL vowel; ⟨ӑ ӗ⟩ never stressed), plus the ⟨е⟩ [je]/[e] split and gemination. The letter tables
 * live in chuvash.jsonc.
 * Ported from src/languages/chuvash/chuvash.ts — see that file for the corpus evidence.
 */
using System.Text;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Chuvash;

public static class ChuvashPhonemizer
{
    private sealed class Seg
    {
        public string Ipa;
        public bool Vowel;
        public bool Reduced;
        public bool? Palatal;
        public Seg(string ipa, bool vowel, bool reduced = false)
        {
            Ipa = ipa;
            Vowel = vowel;
            Reduced = reduced;
        }
    }

    /**
     * Phonemize one Chuvash word → canonical IPA (Cyrillic scan + intervocalic/post-nasal voicing +
     * reduced-vowel stress).
     */
    public static string PhonemizeWord(string word)
    {
        // NFC-normalize + JS toLowerCase, then spread into CODE POINTS (astral pairs stay one element).
        var chars = Js.CodePoints(Js.ToLowerCase(word.Normalize(NormalizationForm.FormC)));
        var segs = new List<Seg>();
        for (var i = 0; i < chars.Count; i++)
        {
            var ch = chars[i];
            if (ch == "е")
            {
                // ⟨е⟩ → [je] word-initial / post-vowel, [e] otherwise — and AFTER ⟨ъ⟩/⟨ь⟩, the separating
                // sign's whole job is to keep the glide. ⟨я ю ё⟩ need no arm: their glide is unconditional.
                var prevV = i > 0 && (Manifest.CYR_VOWEL.Contains(chars[i - 1]) || chars[i - 1] == "ъ" || chars[i - 1] == "ь");
                if (i == 0 || prevV) segs.Add(new Seg("j", false));
                segs.Add(new Seg("e", true));
            }
            else if (Manifest.MANIFEST.Vowels.TryGetValue(ch, out var v))
            {
                segs.Add(new Seg(v, true, Manifest.REDUCED.Contains(v)));
            }
            else if (Manifest.MANIFEST.Iotated.TryGetValue(ch, out var io))
            {
                var cps = Js.CodePoints(io); // glide + vowel (ja ju jo)
                segs.Add(new Seg(cps[0], false));
                segs.Add(new Seg(cps[1], true));
            }
            else if (Manifest.MANIFEST.Onset.TryGetValue(ch, out var onset))
            {
                // Gemination: a doubled consonant is the "strong" segment — one long [Cː] that BLOCKS voicing.
                if (i + 1 < chars.Count && chars[i + 1] == ch)
                {
                    segs.Add(new Seg(onset + "ː", false));
                    i++; // consume the pair
                }
                else
                {
                    segs.Add(new Seg(onset, false));
                }
            }
            else if (ch == "ь")
            {
                // ⚠ THE SOFT SIGN IS NOT SILENT IN CHUVASH — it PALATALIZES the consonant it follows.
                // ⚠ RECORDED AS A FLAG, APPLIED AFTER THE VOICING PASS: appending [ʲ] here would change the
                // string the voicing table is keyed on (`t` → `tʲ` is not a row in `voiced`), silently
                // switching off the allophonic voicing of every ⟨ь⟩-bearing word.
                var prev = segs.Count > 0 ? segs[^1] : null;
                if (prev is not null && !prev.Vowel && prev.Ipa != "j") prev.Palatal = true;
            }
            // ъ and stray marks: dropped (⟨ъ⟩'s one job, the glide before ⟨е⟩, is in the ⟨е⟩ arm above)
        }

        // ⚠ VOICING pass: a voiceless obstruent voices when the previous seg is a vowel or a nasal+glide
        // (or a liquid before a FULL vowel). Geminates carry the length mark and are not in VOICE → untouched.
        for (var k = 0; k < segs.Count; k++)
        {
            if (!Manifest.MANIFEST.Voiced.TryGetValue(segs[k].Ipa, out var voiced)) continue;
            if (k - 1 < 0 || k + 1 >= segs.Count) continue;
            var prev = segs[k - 1];
            var next = segs[k + 1];
            if (!next.Vowel) continue; // must be prevocalic
            var trigger = prev.Vowel
                || Manifest.NASAL_GLIDE.Contains(prev.Ipa)
                || (Manifest.LIQUID.Contains(prev.Ipa) && !next.Reduced);
            if (trigger) segs[k].Ipa = voiced;
        }

        // PALATALIZATION, after the voicing table has read the bare segment.
        foreach (var s in segs) if (s.Palatal == true) s.Ipa += "ʲ";

        // ⚠ STRESS: the last FULL (non-reduced) vowel; if the word has only reduced vowels, the first one.
        // ˈ before the nucleus's onset consonant.
        var vIdx = new List<int>();
        for (var idx = 0; idx < segs.Count; idx++) if (segs[idx].Vowel) vIdx.Add(idx);
        if (vIdx.Count > 0)
        {
            var full = vIdx.Where(idx => !segs[idx].Reduced).ToList();
            var nucleus = full.Count > 0 ? full[^1] : vIdx[0];
            var at = nucleus > 0 && !segs[nucleus - 1].Vowel ? nucleus - 1 : nucleus;
            segs.Insert(at, new Seg("ˈ", false));
        }
        return string.Concat(segs.Select(s => s.Ipa)).Normalize(NormalizationForm.FormC);
    }

    /**
     * A digit run → spoken Chuvash, phonemized through the same Cyrillic g2p.
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

    // A Chuvash Cyrillic word / number / punctuation.
    // ⚠ THE DECIMAL COMMA IS SPANNED BY THE NUMBER BRANCH, or the tokenizer's own `,` claims it as a clause
    // pause and `+18,7°С` reads as a phrase break inside a temperature.
    private static readonly JsRe TOKEN =
        JsRegex.Compile("([Ѐ-ӿ]+)|(\\d+(?:,\\d+)?)|([.!?…,;:])", "gu");

    /**
     * SYMBOL NORMALIZATION — every word is a cv.wikipedia TOKEN attestation whose examples were read.
     *
     * ⚠ NO BARE `г` OR `т` AND NO `с`: this corpus carries Russian bibliography where `с.` is страница and
     * `г.` is года, and the tier's trailing guard does not reject a dot, so declaring either key would read
     * every Russian page count as a second and every Russian year as a gram. Same call ba and tt made.
     * `ҫ` IS declared as a rate denominator, because the slash position rules the other reading out.
     * Chuvash does not say "A per B": the denominator takes the possessive-locative and stands alone, so
     * `unitPer` is the empty string.
     */
    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        Percent = new[] { "процент" },
        Currency = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["$"] = new[] { "доллар" }, ["€"] = new[] { "евро" }, ["₽"] = new[] { "тенкӗ" },
        },
        Units = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["км"] = new[] { "километр" }, ["см"] = new[] { "сантиметр" }, ["мм"] = new[] { "миллиметр" },
            ["кг"] = new[] { "килограмм" }, ["га"] = new[] { "гектар" }, ["м"] = new[] { "метр" },
            // LATIN aliases. cv.wikipedia writes the Cyrillic abbreviation in most articles, but its Turkish
            // province stubs write `8 413 km²` in otherwise-Chuvash prose, and the engine's TOKEN matches
            // Cyrillic only — so those lose the unit entirely.
            ["km"] = new[] { "километр" }, ["cm"] = new[] { "сантиметр" }, ["mm"] = new[] { "миллиметр" },
            ["m"] = new[] { "метр" },
        },
        UnitPer = "",
        RateDenominators = new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["ҫ"] = "ҫеккунтра", ["ç"] = "ҫеккунтра", ["s"] = "ҫеккунтра", ["h"] = "сехетре",
        },
        ExponentWords = new ExponentWordsDef
        {
            Squared = new[] { "тӑваткал" },
            Cubed = new[] { "куб" },
            Position = ExponentPosition.Before,
        },
        Ampersand = "тата",
        // ⚠ NO `multiply`: the candidate `хут` is PAPER in every attestation, and the corpus's `×` is ×0.
        // Chuvash writes the magnitude word after the figure and often after a DECIMAL, so the tier must hop
        // it to reach a unit on the far side. Turkic magnitudes do not inflect.
        Magnitudes = new[] { "пин", "миллион", "миллиард", "триллион" },
    });

    private sealed class Engine : ILanguage
    {
        public string Text(string input)
        {
            // NFC-normalize BEFORE tokenizing: Chuvash ⟨ӑ ӗ ӳ⟩ decompose under NFD to base+combining, and those
            // combining marks fall OUTSIDE the [Ѐ-ӿ] token class — NFD input would shatter words mid-token.
            // normalize.ts FIRST — its clock, ordinal, degree and sign steps need the figure and its written
            // suffix still adjacent, which the tier would break — then the INITIALISM pass, then the shared
            // symbol tier. And `spellAttributive` LAST, because the question it answers (is a noun coming?)
            // has no answer until the tier has turned `км` into `километр`.
            var prepared = Normalize.SpellAttributive(SYMBOLS(
                Normalize.NormalizeChuvashInitialisms(Normalize.NormalizeChuvash(input.Normalize(NormalizationForm.FormC)))));
            return Clauses.AssembleClauses(prepared, TOKEN, (m, sink) =>
            {
                if (m.Groups[1].Success && m.Groups[1].Value.Length > 0)
                    sink.Emit(PhonemizeWord(m.Groups[1].Value));
                else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
                {
                    var bits = m.Groups[2].Value.Split(',');
                    sink.Emit(Number(bits[0]));
                    if (bits.Length > 1)
                    {
                        // The decimal separator's own NAME. ⚠ THE FULL SPOKEN READING IS DECLINED, deliberately:
                        // Chuvash says the whole-part word plus a tail that NAMES THE DECIMAL PLACE, and the
                        // place name cannot be composed here — half of a two-part reading is worse than the
                        // sign's name. Same call ba made (өтөр), tt made (өтер).
                        sink.Emit(PhonemizeWord("хӳрешке"));
                        foreach (var dg in Js.CodePoints(bits[1])) sink.Emit(Number(dg));
                    }
                }
                else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
                    sink.Pause(m.Groups[3].Value is "." or "!" or "?" ? m.Groups[3].Value : ",");
            });
        }
    }

    /** Build the Chuvash phonemizer (Cyrillic scan + allophonic voicing + geminate-blocking + reduced-vowel stress). */
    public static ILanguage CreateChuvash() => new Engine();

    internal static void RegisterSelf()
    {
        Registry.Register("chuvash", CreateChuvash);
        Registry.RegisterRomanPolicy("chv", RomanOrdinals.ROMAN_POLICY);
    }
}
