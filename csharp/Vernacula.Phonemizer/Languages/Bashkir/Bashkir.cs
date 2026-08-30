/**
 * Bashkir (ba) phonemizer — a Cyrillic grapheme scan + word-final (oxytone) stress, canonical IPA.
 * This file owns the position rules: dark/clear ⟨л⟩ by harmony, the ⟨у ү⟩ glide-vs-vowel split, ⟨е⟩
 * iotation, and RUSSIAN-LOAN routing via vowel-harmony violation. The letter tables and the encyclopedic
 * record (phonology, alphabet, referee caveats) live in bashkir.jsonc.
 * Ported from src/languages/bashkir/bashkir.ts — see that file for the corpus evidence.
 */
using System.Text;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Bashkir;

public static class BashkirPhonemizer
{
    private static IReadOnlyDictionary<string, string> CONS => Manifest.MANIFEST.Consonants;
    private static IReadOnlyDictionary<string, string> VOWEL => Manifest.MANIFEST.Vowels;
    private static IReadOnlyDictionary<string, string> IOTATED => Manifest.MANIFEST.Iotated;
    private static readonly IReadOnlySet<string> CYR_VOWEL = Manifest.CYR_VOWEL;
    private static readonly IReadOnlySet<string> BACK = Manifest.BACK;   // back-harmony → the dark ⟨л⟩→[ɫ]

    // ⚠ RUSSIAN-LOAN DETECTION. Real Bashkir text is saturated with Russian loanwords, and Bashkir speakers
    // pronounce them RUSSIAN-STYLE (palatalization, akanye, Russian stress) — so a realistic phonemizer
    // routes them to the Russian g2p. The signal is VOWEL HARMONY: native Bashkir is strictly all-back or
    // all-front, so a word MIXING a back vowel (а о у ы) with a front one — and lacking any Bashkir-specific
    // letter (which are always harmonic) — is a Russian loan. The three lists are in bashkir.jsonc.
    private static readonly IReadOnlySet<string> BASHKIR_LETTER = Manifest.BASHKIR_LETTER;
    private static readonly IReadOnlySet<string> BACK_V = BACK;  // one set of back vowels exists, so one list
    private static readonly IReadOnlySet<string> FRONT_V = Manifest.FRONT_V;

    /**
     * ⟨ѳ⟩ U+0473 IS ⟨ө⟩ AND ⟨ӊ⟩ U+04CA IS ⟨ң⟩ — legacy-codepage artefacts, not letters of any alphabet in
     * use. Pre-Unicode Bashkir/Tatar fonts had no slots for ⟨ө⟩ and ⟨ң⟩ and borrowed the Church-Slavonic
     * FITA and the Khanty EN-WITH-TAIL; text typed that way keeps the wrong codepoint when pasted into the
     * wiki. The corpus decides it: ⟨ѳ⟩ ×7 against ⟨ө⟩ ×1,323 and ⟨ӊ⟩ ×11 against ⟨ң⟩ ×921.
     *
     * ⚠ AND THE DAMAGE WAS NOT ONLY THE DELETED LETTER. Both are outside the letter tables, so `кѳньяғында`
     * read `knjɑʁɯnˈdɑ` with the vowel simply gone — AND the loan router saw a word with no front vowel in
     * it, so a front-harmony Bashkir word was one ⟨ѳ⟩ away from being read as Russian. The fold therefore
     * runs BEFORE the loan test, not inside the native scan.
     */
    private static readonly IReadOnlyDictionary<string, string> LEGACY_CODEPAGE = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["ѳ"] = "ө", ["Ѳ"] = "Ө", ["ӊ"] = "ң", ["Ӊ"] = "Ң",
    };
    /** JS builds the class from the table's own keys, in insertion order: `[ѳѲӊӉ]`. */
    private static readonly JsRe LEGACY_RE =
        JsRegex.Compile("[ѳѲӊӉ]", "gu");

    public static string FoldLegacyCodepage(string w) =>
        LEGACY_RE.Replace(w, m => LEGACY_CODEPAGE[m.Value]);

    public static bool IsRussianLoan(string word)
    {
        var w = Js.ToLowerCase(Js.Normalize(word, NormalizationForm.FormC));
        var cps = Js.CodePoints(w);
        if (cps.Any(BASHKIR_LETTER.Contains)) return false; // a native Bashkir letter → native word
        return cps.Any(BACK_V.Contains) && cps.Any(FRONT_V.Contains); // harmony violation → loan
    }

    /** Phonemize one Bashkir word → canonical IPA. A detected RUSSIAN LOAN is routed to the Russian g2p
     *  (Bashkir speakers read loans Russian-style); otherwise the native scan runs. */
    public static string PhonemizeWord(string word)
    {
        var w = FoldLegacyCodepage(word);
        return IsRussianLoan(w) ? Russian.RussianPhonemizer.PhonemizeWord(w) : PhonemizeWordNative(w);
    }

    /** The NATIVE Bashkir g2p (Cyrillic grapheme scan + word-final stress), WITHOUT Russian-loan routing. */
    public static string PhonemizeWordNative(string word)
    {
        // Folded here too: this entry is exported and referee-eval calls it directly, bypassing the router.
        var w = FoldLegacyCodepage(Js.ToLowerCase(Js.Normalize(word, NormalizationForm.FormC)));
        var chars = Js.CodePoints(w);
        // ⟨л⟩ is dark [ɫ] in a back-harmony word, clear [l] in a front one
        var backWord = chars.Any(BACK.Contains);
        var segs = new List<string>();
        for (var i = 0; i < chars.Count; i++)
        {
            var ch = chars[i];
            var prevVowel = i > 0 && CYR_VOWEL.Contains(chars[i - 1]);
            if (ch == "л") segs.Add(backWord ? "ɫ" : "l");
            else if (ch == "у") segs.Add(prevVowel ? "w" : "u"); // vowel [u] in onset, glide [w] after a vowel
            else if (ch == "ү") segs.Add(prevVowel ? "w" : "y"); // [y] in onset, glide [w] after a vowel
            else if (ch == "е") segs.Add(i == 0 || prevVowel ? "jɪ" : "ɪ"); // [jɪ] initial/post-vowel, else [ɪ]
            else if (CONS.TryGetValue(ch, out var c)) segs.Add(c);
            else if (IOTATED.TryGetValue(ch, out var io)) segs.Add(io);
            else if (VOWEL.TryGetValue(ch, out var v)) segs.Add(v);
            // ъ ь and other marks: dropped
        }
        // Word-final (oxytone) stress — the Turkic default: ˈ before the last vowel's onset consonant.
        static bool IsV(string s) => Js.CodePoints(s).Any(Ipa.IPA_VOWEL.Contains);
        var vidx = new List<int>();
        for (var k = 0; k < segs.Count; k++)
            if (IsV(segs[k])) vidx.Add(k);
        if (vidx.Count > 0)
        {
            var nucleus = vidx[^1];
            var at = nucleus > 0 && !IsV(segs[nucleus - 1]) ? nucleus - 1 : nucleus;
            segs.Insert(at, "ˈ");
        }
        return string.Concat(segs).Normalize(NormalizationForm.FormC);
    }

    /**
     * A digit run → spoken Bashkir, phonemized through the same g2p. The number words go through the public
     * PhonemizeWord, so миллион/миллиард get the same loan treatment they would in running text.
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

    // A Bashkir Cyrillic word / number / punctuation.
    // ⚠ THE NUMBER TOKEN SPANS THE DECIMAL COMMA. Without it the comma is clause punctuation and `5,3 %`
    // read as *биш , өс* — a phrase break inside a quantity, on 24,214 corpus instances. The DOT is
    // deliberately not spanned: this corpus's 98 dot-decimals are percent-encoded wiki anchors, a lens
    // aperture and a page range, and not one is a number (see Normalize.cs's header).
    private static readonly JsRe TOKEN =
        JsRegex.Compile("([Ѐ-ӿ]+)|(\\d+(?:,\\d+)?)|([.!?…,;:])", "gu");

    /**
     * SYMBOL NORMALIZATION — every word is a ba.wikipedia TOKEN attestation whose examples were read:
     * `процент` ×206 · `километр` ×69 · `килограмм` ×65 · `доллар` ×221 · `евро` ×87 · `һум` ×142 ·
     * `квадрат` ×165 · `куб` ×35 · `тапҡыр` ×103. The corpus's own text supplies the exponent slot verbatim
     * — "майҙаны 130 395 квадрат километр" — which also fixes the WORD ORDER: Bashkir puts the measure
     * adjective BEFORE the noun.
     *
     * ⚠ TURKIC AGREEMENT IS NOT SLAVIC AGREEMENT, and this is the one place a Slavic template would
     * mislead: a Turkic counted noun stays SINGULAR after a numeral (`5 километр`, never *5 километрҙар*),
     * so every entry here is a ONE-element CountForms array and the tier's default CountForm always picks
     * it.
     *
     * ⚠ THREE KEYS ARE DELIBERATELY NOT DECLARED, each on a counted corpus fact: `г` (the gram is claimed
     * in Normalize.cs step 7, because `1938 г.` is Russian *года* and only the DOT separates them), `с`
     * (every standalone `с.` is Russian *страниц* in a bibliography — it survives only as a rate
     * denominator), and `т` (*том* in the same bibliographies, not the tonne).
     */
    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        Percent = new[] { "процент" },
        Currency = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["$"] = new[] { "доллар" },
            ["€"] = new[] { "евро" },
            ["₽"] = new[] { "һум" },
            ["£"] = new[] { "фунт" },
        },
        Units = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["км"] = new[] { "километр" }, ["см"] = new[] { "сантиметр" }, ["мм"] = new[] { "миллиметр" },
            ["кг"] = new[] { "килограмм" }, ["мг"] = new[] { "миллиграмм" }, ["га"] = new[] { "гектар" },
            ["м"] = new[] { "метр" },
            // LATIN aliases. ba.wikipedia writes the Cyrillic abbreviation, but the engine's TOKEN matches
            // Cyrillic only, so a foreign-sourced `120 km` loses the unit entirely rather than merely
            // mispronouncing it — the same reasoning as Russian's and Ukrainian's aliases.
            ["km"] = new[] { "километр" }, ["cm"] = new[] { "сантиметр" }, ["mm"] = new[] { "миллиметр" },
            ["kg"] = new[] { "килограмм" }, ["m"] = new[] { "метр" },
        },
        UnitPer = "бер", // м³/с → куб метр БЕР секунд
        RateDenominators = new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["с"] = "секунд", ["сәғ"] = "сәғәт", ["s"] = "секунд", ["h"] = "сәғәт",
        },
        ExponentWords = new ExponentWordsDef
        {
            Squared = new[] { "квадрат" },
            Cubed = new[] { "куб" },
            Position = ExponentPosition.Before,
        },
        Multiply = new MultiplyDef { Times = "тапҡыр" },
        Ampersand = "һәм",
        // Bashkir writes the magnitude word after the figure and often after a DECIMAL (`1 042,4 мең кеше`),
        // so the tier must hop it to reach a unit on the far side. Turkic magnitudes do not inflect.
        Magnitudes = new[] { "мең", "миллион", "миллиард", "триллион" },
    });

    private sealed class Engine : ILanguage
    {
        public string Text(string input)
        {
            // Normalize FIRST — its ordinal, clock, degree and suffix steps need the figure and its written
            // suffix still adjacent, which the tier would break — then the INITIALISM pass, then the shared
            // symbol tier, which matches a unit only when a NUMBER is adjacent.
            var prepared = SYMBOLS(Normalize.NormalizeBashkirInitialisms(Normalize.NormalizeBashkir(input)));
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
                        // The decimal separator's own NAME, from ba.wikipedia's article on it: "Өтөр —
                        // тыныш билдәһе", ×27 in 17 articles.
                        // ⚠ THE FULL SPOKEN READING IS DECLINED, deliberately: Bashkir says *биш бөтөн өс
                        // ундан* — `бөтөн` plus a tail that NAMES THE DECIMAL PLACE (ундан / йөҙҙән /
                        // меңдән). The place name cannot be composed here, and half of a two-part reading
                        // is worse than the sign's name. Same call uk, pl and be made.
                        sink.Emit(PhonemizeWord("өтөр"));
                        foreach (var dg in bits[1]) sink.Emit(Number(dg.ToString()));
                    }
                }
                else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
                    sink.Pause(m.Groups[3].Value is "." or "!" or "?" ? m.Groups[3].Value : ",");
            });
        }
    }

    /** Build the Bashkir phonemizer (Cyrillic scan + interdentals + Bashkir vowel shift + final stress). */
    public static ILanguage CreateBashkir() => new Engine();

    internal static void RegisterSelf()
    {
        Registry.Register("bashkir", CreateBashkir);
        Registry.RegisterRomanPolicy("ba", RomanOrdinals.ROMAN_POLICY);
    }
}
