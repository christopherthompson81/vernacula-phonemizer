/**
 * Tatar (tt) phonemizer — a Cyrillic grapheme scan + word-final (oxytone) stress, canonical IPA. This
 * file owns the harmony logic: ⟨к г⟩ back to [q ʁ] next to a BACK vowel (nearest-vowel scan), ⟨а⟩ fronts
 * to [a] in a front-vowel word, ⟨е⟩ iotates word-initially/post-vocalically, and the maximal-onset
 * stress placement. The letter tables live in tatar.jsonc.
 * Ported from src/languages/tatar/tatar.ts — see that file for the corpus evidence.
 */
using System.Text;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Tatar;

public static class TatarPhonemizer
{
    private static IReadOnlyDictionary<string, string> CONS => Manifest.MANIFEST.Consonants;
    private static IReadOnlyDictionary<string, string> VOWEL => Manifest.MANIFEST.Vowels;
    private static IReadOnlyDictionary<string, string> IOTATED => Manifest.MANIFEST.Iotated;
    private static readonly IReadOnlySet<string> CYR_VOWEL = Manifest.CYR_VOWEL;
    private static readonly IReadOnlySet<string> BACK = Manifest.BACK;
    private static readonly IReadOnlySet<string> FRONT = Manifest.FRONT;

    /** The vowel letters a separating ⟨ъ⟩ precedes: each begins with /j/ (#1576). */
    private static readonly IReadOnlySet<string> IOTATED_AFTER_SIGN =
        new HashSet<string>(["е", "ё", "ю", "я"], StringComparer.Ordinal);

    /** Is the nearest vowel to position `i` (scanning outward) a BACK vowel? Defaults to back (Turkic
     *  default). ⚠ ⟨а⟩ is SKIPPED rather than answering — it is harmony-neutral for the к/г backing and
     *  its own quality is decided by the whole-word test instead. */
    private static bool NearBack(IReadOnlyList<string> chars, int i)
    {
        for (var d = 1; d < chars.Count; d++)
        {
            foreach (var j in new[] { i - d, i + d })
            {
                var c = j >= 0 && j < chars.Count ? chars[j] : null; // JS `chars[j]` — undefined past either end
                if (c == "а") continue;
                if (c != null && BACK.Contains(c)) return true;
                if (c != null && FRONT.Contains(c)) return false;
            }
        }
        return true;
    }

    private static readonly JsRe FRONT_WORD = JsRegex.Compile("[әөүеиэ]", "u");

    /** Phonemize one Tatar (Cyrillic) word → canonical IPA: harmony-aware grapheme scan + word-final stress. */
    public static string PhonemizeWord(string word)
    {
        var w = Js.ToLowerCase(Js.Normalize(word, NormalizationForm.FormC));
        var chars = Js.CodePoints(w);
        // Vowel harmony: a word with any FRONT vowel ⟨ә ө ү е и э⟩ fronts its ⟨а⟩ → [a] (else the back [ɑ]).
        var frontWord = FRONT_WORD.IsMatch(w);
        var segs = new List<string>();
        for (var i = 0; i < chars.Count; i++)
        {
            var ch = chars[i];
            if (ch == "к") segs.Add(NearBack(chars, i) ? "q" : "k");
            else if (ch == "г") segs.Add(NearBack(chars, i) ? "ʁ" : "ɡ");
            else if (ch == "а") segs.Add(frontWord ? "a" : "ɑ");
            // word-initial / post-vocalic ⟨е⟩ → [je], and after the separating ⟨ъ⟩ (съезд, йөзъеллык)
            else if (ch == "е") segs.Add(i == 0 || CYR_VOWEL.Contains(chars[i - 1]) || chars[i - 1] == "ъ" ? "je" : "e");
            else if (CONS.TryGetValue(ch, out var c)) segs.Add(c);
            else if (IOTATED.TryGetValue(ch, out var io)) segs.Add(io);
            else if (VOWEL.TryGetValue(ch, out var v)) segs.Add(v);
            // ⟨ъ⟩: the glottal stop natively (мәсъәлә), the UVULAR marker after ⟨к г⟩ (мәкъалә, мәгънә), the /j/
            // separator before an iotated vowel (съезд, йөзъеллык). See tatar.ts (#1576).
            else if (ch == "ъ")
            {
                var prev = i > 0 ? chars[i - 1] : "";
                if (prev == "к" || prev == "г") segs[^1] = prev == "к" ? "q" : "ʁ";
                else if (!(i + 1 < chars.Count && IOTATED_AFTER_SIGN.Contains(chars[i + 1]))) segs.Add("ʔ");
            }
            // ь (soft sign) and other marks: dropped
        }
        // Word-final (oxytone) stress — the Turkic default: ˈ before the onset of the last vowel's syllable.
        // ⚠ ONE ONSET CONSONANT word-internally (китап.лар); only a word-INITIAL cluster, with no vowel before it,
        // is the whole onset (спорт→ˈsport). See tatar.ts (#1576).
        static bool IsV(string s) => Js.CodePoints(s).Any(Ipa.IPA_VOWEL.Contains);
        var nucleus = segs.FindLastIndex(IsV);
        if (nucleus >= 0)
        {
            var at = nucleus;
            if (at > 0 && !IsV(segs[at - 1])) at--; // the immediate onset consonant
            if (!segs.Take(at).Any(IsV)) at = 0; // a word-initial cluster is the whole onset
            segs.Insert(at, "ˈ");
        }
        return string.Concat(segs).Normalize(NormalizationForm.FormC);
    }

    /**
     * A digit run → spoken Tatar, phonemized through the same Cyrillic g2p.
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
     * The shared SYMBOL tier — every word is a tt.wikipedia TOKEN attestation whose examples were read,
     * and three are glossed by the corpus's own notation (`градус` by its own article, which names the
     * sign as ANGULAR; `квадрат`, which fixes the word, its POSITION and all three notations; `доллар`,
     * whose article names the sign).
     *
     * ⚠ NO `unitPer`, AND NO BARE `г` OR `т`. Tatar does not say "A per B": the denominator takes the
     * possessive-dative and stands alone (*метр секундына*), which is Basque's shape — `UnitPer` is the
     * empty string and `RateDenominators` carries the inflected form. And `г`/`т` are declined outright:
     * `В 3 т.` and `1938 г.` are Russian *том* and *года*, this corpus carries Russian bibliography in
     * quantity, and the tier's trailing guard does not reject a dot.
     */
    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        Percent = new[] { "процент" },
        Currency = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["$"] = new[] { "доллар" },
            ["€"] = new[] { "евро" },
            ["£"] = new[] { "фунт" },
            ["₽"] = new[] { "сум" },
        },
        Units = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["км"] = new[] { "километр" }, ["см"] = new[] { "сантиметр" }, ["мм"] = new[] { "миллиметр" },
            ["кг"] = new[] { "килограмм" }, ["мг"] = new[] { "миллиграмм" }, ["га"] = new[] { "гектар" },
            ["м"] = new[] { "метр" },
            // LATIN aliases. tt.wikipedia writes the Cyrillic abbreviation in its Cyrillic articles, but
            // the engine's TOKEN matches Cyrillic only, so the corpus's own `4360 km²` and `9,44 m³/c` —
            // written in Cyrillic prose, not Zamanälif — lose the unit entirely.
            ["km"] = new[] { "километр" }, ["cm"] = new[] { "сантиметр" }, ["mm"] = new[] { "миллиметр" },
            ["kg"] = new[] { "килограмм" }, ["m"] = new[] { "метр" },
        },
        UnitPer = "",
        RateDenominators = new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["с"] = "секундына", ["сәг"] = "сәгатенә", ["л"] = "литрына",
            ["s"] = "секундына", ["h"] = "сәгатенә", ["c"] = "секундына",
        },
        ExponentWords = new ExponentWordsDef
        {
            Squared = new[] { "квадрат" },
            Cubed = new[] { "куб" },
            Position = ExponentPosition.Before,
        },
        Multiply = new MultiplyDef { Times = "тапкыр" },
        Ampersand = "һәм",
        // Tatar writes the magnitude word after the figure and often after a DECIMAL (`17 752 мең км²`,
        // `$5,7 миллиард`), so the tier must hop it to reach a unit on the far side. Turkic magnitudes do
        // not inflect.
        Magnitudes = new[] { "мең", "миллион", "миллиард", "триллион" },
    });

    // A word (Tatar Cyrillic letters) / number / punctuation token.
    // ⚠ THE DECIMAL COMMA IS SPANNED BY THE NUMBER BRANCH, or the tokenizer's own `,` claims it as a
    // clause pause and `9,44 м³/с` reads as *тугыз , кырык дүрт* — a phrase break inside a quantity.
    private static readonly JsRe TOKEN =
        JsRegex.Compile("([Ѐ-ӿ]+)|(\\d+(?:,\\d+)?)|([.!?…,;:])", "gu");

    private sealed class Engine : ILanguage
    {
        public string Text(string input)
        {
            // Normalize FIRST — its clock, suffix, degree and sign steps need the figure and its written
            // suffix still adjacent, which the tier would break — then the INITIALISM pass, then the
            // shared symbol tier, which matches a unit only when a NUMBER is adjacent.
            var prepared = SYMBOLS(Normalize.NormalizeTatarInitialisms(Normalize.NormalizeTatar(input)));
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
                        // The decimal separator's own NAME, from tt.wikipedia's own punctuation article.
                        // ⚠ THE FULL SPOKEN READING IS DECLINED, deliberately: Tatar says *биш бөтен өчдән
                        // ун* — a "whole" word plus a tail that NAMES THE DECIMAL PLACE. The place name
                        // cannot be composed here, and half of a two-part reading is worse than the sign's
                        // name. Same call ba, uk, pl and be made.
                        sink.Emit(PhonemizeWord("өтер"));
                        foreach (var dg in bits[1]) sink.Emit(Number(dg.ToString()));
                    }
                }
                else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
                    sink.Pause(m.Groups[3].Value is "." or "!" or "?" ? m.Groups[3].Value : ",");
            });
        }
    }

    /** Build the Tatar phonemizer (Cyrillic g2p + harmony-driven к/г backing + final stress). */
    public static ILanguage CreateTatar() => new Engine();

    internal static void RegisterSelf()
    {
        Registry.Register("tatar", CreateTatar);
        Registry.RegisterRomanPolicy("tt", RomanOrdinals.ROMAN_POLICY);
    }
}
