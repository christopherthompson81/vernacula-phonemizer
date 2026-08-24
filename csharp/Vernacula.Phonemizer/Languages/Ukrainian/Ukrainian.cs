/**
 * Native Ukrainian / українська (uk) text phonemizer — canonical IPA. East Slavic, Cyrillic.
 * Ukrainian has NO vowel reduction (akanye), so — unlike Russian — no stress dictionary is needed for vowel
 * quality: a left-to-right scan with fixed vowel values. The work is PALATALISATION (a consonant → Cʲ before ь,
 * і, or an iotated vowel я/ю/є/ї) + the iotated vowels ([j]+V word-initially / after a vowel / after an
 * apostrophe; the bare V after a consonant, which it palatalises) + в-vocalisation (ʋ before a vowel, [w] in the
 * coda) + г→ɦ / ґ→ɡ / dark л→ɫ. Stress is lexical and unmarked here (Ukrainian stress is unpredictable and does
 * not change vowel quality). Validated vs wikipron ukr_cyrl narrow + kaikki + epitran ukr-Cyrl.
 */
using System.Text;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Ukrainian;

public sealed class UkrainianPhonemizer : ILanguage
{
    private static UkrainianDef DEF => Manifest.DEF;
    private static IReadOnlyDictionary<string, string> CLAUSE_MARK => DEF.ClausePunctuation;

    private const string SOFT = "ь";
    // Letter environments (ukrainian.jsonc): the palatalizing letters, every vowel letter, and the NON-iotated
    // subset that decides whether ⟨й⟩ is an onset [j] or a coda [i̯].
    private static readonly IReadOnlySet<string> PALATALIZERS = new HashSet<string>(DEF.Palatalizers, StringComparer.Ordinal);
    private static readonly IReadOnlySet<string> VOWEL_LETTERS = new HashSet<string>(DEF.VowelLetters, StringComparer.Ordinal);
    private static readonly IReadOnlySet<string> PLAIN_VOWELS = new HashSet<string>(DEF.PlainVowels, StringComparer.Ordinal);
    private static bool IsCons(string c) => DEF.Consonants.ContainsKey(c);

    /** Palatalise a hard-consonant IPA: dark ɫ → lʲ (loses velarisation), everything else appends ʲ. */
    private static string Palatalise(string ipa) => ipa == "ɫ" ? "lʲ" : ipa + "ʲ";

    // REGRESSIVE PALATALISATION and the geminate folds, compiled once (the TS builds two of them from `PALC`
    // on every call).
    private const string PALC = "(?:t͡s|t͡ʃ|d͡z|d͡ʒ|[bpkɡtdszʃʒʋfxmnrlj])ʲ";
    private static readonly JsRe DARK_L_BEFORE_PAL = JsRegex.Compile($"ɫ(?={PALC})", "gu");
    private static readonly JsRe CORONAL_BEFORE_PAL = JsRegex.Compile($"(t͡s|[tdszn])(?={PALC})", "gu");
    private static readonly JsRe GEM_PAL_PAIR = JsRegex.Compile("([bʋɦɡdʒznɫlmnprstfxʃ])ʲ\\1ʲ", "gu");
    private static readonly JsRe GEM_PLAIN_PAL = JsRegex.Compile("([bʋɦɡdʒznɫlmnprstfxʃ])\\1ʲ", "gu");
    private static readonly JsRe GEM_PLAIN = JsRegex.Compile("([bʋɦɡdʒznɫlmprstfxʃ])\\1(?!ʲ)", "gu");

    /** One Ukrainian word → canonical IPA. */
    public static string PhonemizeWord(string word)
    {
        var s = word.ToLowerInvariant();
        var chars = Js.CodePoints(s);
        var outp = new List<string>();
        for (var i = 0; i < chars.Count;)
        {
            var c = chars[i];
            var nxt = i + 1 < chars.Count ? chars[i + 1] : "";
            if (IsCons(c))
            {
                var ipa = DEF.Consonants[c];
                // в is /w/ with the standard Ukrainian allophony: [w] before a ROUNDED vowel о/у (слово→sɫɔwɔ,
                // вода→wɔda) and in the CODA / word-initial-before-a-consonant (Влад→wɫad; true post-vocalic coda is
                // the non-syllabic [u̯]: Європа→…u̯r…); [ʋ] before а/е/и (мова→mɔʋa); [ʋʲ] before і (вікно→ʋʲiknɔ).
                if (c == "в")
                {
                    if (nxt == "о" || nxt == "у") ipa = "w";
                    else if (nxt == "а" || nxt == "е" || nxt == "и") ipa = "ʋ";
                    else if (nxt == "і" || nxt == SOFT || DEF.Iotated.ContainsKey(nxt)) ipa = "ʋʲ"; // palatalised before і/ь/iotated (свято→sʲʋʲatɔ)
                    else ipa = i > 0 && VOWEL_LETTERS.Contains(chars[i - 1]) ? "u̯" : "w"; // coda vs word-initial-before-C
                }
                else if (c == "й") ipa = PLAIN_VOWELS.Contains(nxt) ? "j" : "i̯"; // onset [j] before a plain vowel; else coda [i̯] (Майя→…i̯j…)
                // Palatalise before ь / і / an iotated vowel (unless an apostrophe intervenes — handled by adjacency).
                else if (PALATALIZERS.Contains(nxt)) ipa = Palatalise(ipa);
                outp.Add(ipa);
                i++;
                if (nxt == SOFT) i++; // consume the soft sign (palatalisation already applied)
                continue;
            }
            if (DEF.Iotated.TryGetValue(c, out var iot))
            {
                var prev = i > 0 ? chars[i - 1] : "";
                // ї is always [ji]; the others are the bare vowel ONLY when they directly follow a PALATALISABLE
                // consonant (which they palatalised) — otherwise (initial / after a vowel / apostrophe / the glide й)
                // they are [j]+V. й is a glide, not a palatalising consonant (Майя→mai̯ja).
                if (c == "ї" || !IsCons(prev) || prev == "й")
                {
                    outp.Add("j");
                    outp.Add(iot);
                }
                else outp.Add(iot);
                i++;
                continue;
            }
            if (DEF.Vowels.TryGetValue(c, out var v))
            {
                outp.Add(v);
                i++;
                continue;
            }
            if (c == SOFT)
            {
                // A soft sign not consumed by a preceding consonant (rare) — palatalise the last emitted consonant.
                var last = outp.Count > 0 ? outp[^1] : null;
                if (!string.IsNullOrEmpty(last) && !last.EndsWith("ʲ", StringComparison.Ordinal)) outp[^1] = Palatalise(last);
                i++;
                continue;
            }
            i++; // apostrophe (breaks C+iotated adjacency → [j]V) and unknowns → skip
        }
        var x = string.Concat(outp);
        // REGRESSIVE PALATALISATION: a coronal (т д з с ц н л) directly before a palatalised consonant assimilates and
        // is itself palatalised (Близнюк→bɫɪzʲnʲuk, Дніпряни→dʲnʲiprʲanɪ). Dark ɫ → lʲ; the rest append ʲ.
        x = DARK_L_BEFORE_PAL.Replace(x, "lʲ");
        x = CORONAL_BEFORE_PAL.Replace(x, "$1ʲ");
        // Doubled consonant → a single geminate Cː: the palatalised-pair case CʲCʲ→Cʲː (Буття→butʲːa, after the
        // regressive rule doubled both), then the plain-before-ʲ case CCʲ→Cʲː (ння→nʲː, Євробачення), then plain CC→Cː.
        x = GEM_PLAIN.Replace(GEM_PLAIN_PAL.Replace(GEM_PAL_PAIR.Replace(x, "$1ʲː"), "$1ʲː"), "$1ː");
        return x.Normalize(NormalizationForm.FormC);
    }

    private static string Number(string digits)
    {
        var n = Js.Number(digits);
        // ⚠ ABOVE 2^53 THE RAW ASCII DIGITS USED TO LEAK STRAIGHT INTO THE IPA. `isSafeInteger` is right to
        // refuse to COMPOSE — the float has already lost the low digits, so the numeral would be confidently
        // wrong — but the refusal returned the digit string, which no g2p in this fleet reads. Read it out
        // digit-at-a-time through this engine's own number words instead; see core/numbers.ts `spellDigits`
        // for the full account and the cost (above 2^53 the reading is a digit string, not a quantity).
        if (!(double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d))
            return Core.Numbers.SpellDigits(digits, DEF.Numbers, PhonemizeWord);
        // East-Slavic composer: the magnitude nouns AGREE with their multiplier (дві тисячі, п'ять тисяч) — see numbers.ts
        return Core.Numbers.RenderNumber(n, DEF.Numbers, PhonemizeWord, Numbers.eastSlavicNumberWords);
    }

    /**
     * symbol normalization — Ukrainian: CYRILLIC unit abbreviations (км, not km) and the three-way Slavic
     * agreement, which for uk IS Russian's selector (see normalize.ts's header for the evidence).
     *
     * `м` is NOT declared here on purpose: the shared tier's trailing guard is `(?![\p{L}\p{M}])`, and the
     * Ukrainian apostrophe is neither a letter nor a mark, so `41 м'яч` would become *сорок один метр'яч*.
     * It is handled in normalize.ts with an apostrophe-aware guard instead.
     *
     * Currency: NOT attested in uk_ua (the corpus spells доларів / фунтів / євро out), but the signs were
     * being dropped outright, so the three that occur in Ukrainian text at all are declared. The forms are
     * standard dictionary paradigms, not invented.
     */
    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        // `multiply` — this language had NO word for the sign at all. ⚠ STANDARD MATHEMATICAL REGISTER, not a
        // corpus attestation: the sweep's plausible hits were homographs of PREPOSITIONS (es `por` ×23, it `per` ×25,
        // ru `на` ×31 are all the preposition), the same trap that defeated the exponent sourcing. One word, so `by`
        // defaults to it — this language does not split dimension from product.
        Multiply = new MultiplyDef { Times = "на" },
        // ⚠ CORRECTED FROM `помножити на` BY THE AUDIO. The register guess was too long: the uk_ua speaker of the
        // universal `4x4` sentence says just **на** — wav2vec2 over uk_ua/train gives
        // `… tʃ o t e r i  t aɪ … tʃ u t r i  n a  tʃ e t e r e …`, "chotyry NA chetery". `помножити на` is the full
        // verbal form a textbook uses; a reader saying a dimension uses the bare preposition.
        // `&` was DROPPED outright, losing the sign from `готелі типу B&B`. `та` is the conjunction used
        // to join two nouns, and it is the shape every other treated language took here (de *und*, pt *e*,
        // ru *и*, mi *me*): the plain conjunction, not a transliteration. `і` is the other Ukrainian "and" and
        // is equally correct as a word; `та` is preferred between two coordinate nouns, which is what an
        // ampersand always joins. ⚠ Both were checked at TOKEN level rather than by substring — a substring
        // count is meaningless for these two, since `і` and `та` occur inside hundreds of ordinary words
        // (3853 and 2290 raw substring hits against 51 and 14 real tokens).
        // ⚠ THE STRONGEST EVIDENCE IS IN THE SENTENCE ITSELF: the corpus GLOSSES the abbreviation using this very
        // word — `готелі типу B&B … змагаються у двох основних речах: ліжко та сніданок` ("bed AND breakfast").
        // That settles the `і` vs `та` question on the corpus's own usage rather than on a preference.
        Ampersand = "та",
        Percent = new[] { "відсоток", "відсотки", "відсотків", "відсотка" },
        Currency = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["€"] = new[] { "євро" }, // indeclinable
            ["$"] = new[] { "долар", "долари", "доларів", "долара" },
            ["£"] = new[] { "фунт", "фунти", "фунтів", "фунта" },
        },
        Units = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["км"] = new[] { "кілометр", "кілометри", "кілометрів", "кілометра" },
            ["см"] = new[] { "сантиметр", "сантиметри", "сантиметрів", "сантиметра" },
            ["мм"] = new[] { "міліметр", "міліметри", "міліметрів", "міліметра" },
            ["кг"] = new[] { "кілограм", "кілограми", "кілограмів", "кілограма" },
            ["ггц"] = new[] { "гігагерц", "гігагерци", "гігагерців", "гігагерца" },
            ["мбіт"] = new[] { "мегабіт", "мегабіти", "мегабіт" },
            // THE BARE METRE, BOTH SPELLINGS. This was excluded, and the stated reason — the apostrophe in
            // `41 м\u2019яч` ("41 balls"), where a short key would bite into the following word — is no longer a
            // reason: the tier's trailing guard rejects `\u0027\u2019\u02bc` explicitly, so `м\u2019яч` cannot
            // be entered. Verified against that exact corpus string. метрів ×6, and the cube word declared below
            // could not reach a bare metre without this, so `120 m³` read as the letter name while
            // `120 km³` read correctly.
            ["м"] = new[] { "метр", "метри", "метрів", "метра" },
            ["m"] = new[] { "метр", "метри", "метрів", "метра" },
            // LATIN aliases. uk_ua writes the Cyrillic abbreviation throughout, but the engine's TOKEN drops
            // Latin runs outright, so a foreign-sourced `120 km` loses the unit entirely rather than merely
            // mispronouncing it. Same reasoning as Russian's aliases.
            ["km"] = new[] { "кілометр", "кілометри", "кілометрів", "кілометра" },
            ["cm"] = new[] { "сантиметр", "сантиметри", "сантиметрів", "сантиметра" },
            ["mm"] = new[] { "міліметр", "міліметри", "міліметрів", "міліметра" },
            ["kg"] = new[] { "кілограм", "кілограми", "кілограмів", "кілограма" },
        },
        UnitPer = "на", // км/год → кілометрів НА годину; the denominator is accusative
        RateDenominators = new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["год"] = "годину", ["ч"] = "годину", ["h"] = "годину", ["с"] = "секунду", ["s"] = "секунду",
        },
        // Ukrainian puts the measure adjective BEFORE the noun as a separate agreeing word — квадратних
        // кілометрів — the same shape as Russian, not Swedish's fused compound.
        ExponentWords = new ExponentWordsDef
        {
            Squared = new[] { "квадратний", "квадратні", "квадратних", "квадратного" },
            Cubed = new[] { "кубічний", "кубічні", "кубічних", "кубічного" },
            Position = ExponentPosition.Before,
        },
        // Inflected forms too, because running text writes the one its numeral governs (2 мільйони, 5 мільйонів).
        Magnitudes = new[] { "тисячі", "тисяч", "мільйон", "мільйона", "мільйони", "мільйонів",
            "мільярд", "мільярда", "мільярди", "мільярдів" },
        // A DECIMAL governs the GENITIVE SINGULAR in Ukrainian — 2,4 відсотка — which is a fourth form,
        // because unlike Russian the 2–4 slot here is the NOMINATIVE PLURAL (два відсотки) and so cannot
        // serve. `CountForms` is a plain string[] and `pick` clamps to the array length, so the extra entry
        // is local data, not a schema change; the three-form languages are untouched.
        CountForm = n => double.IsInteger(n) ? NormalizeSymbols.SlavicCountForm(n) : 3,
    });

    private const string CYRILLIC = "\\u0400-\\u04FF";
    // The number token carries its DECIMAL COMMA (Ukrainian's decimal mark) so the comma is not read as clause
    // punctuation — `1,5 кілометра` was coming out as a phrase break between "один" and "п'ять".
    private static readonly JsRe TOKEN = JsRegex.Compile($"([{CYRILLIC}'’ʼ]+)|(\\d+(?:,\\d+)?)|([.?!,;:…—])", "gu");

    public string Text(string input)
    {
        // order: Ukrainian rewrites (de-grouping, abbreviations, ordinal notation, clock, ranges,
        // signs) → INITIALISMS (after the abbreviations, so a dotted abbreviation is never spelled out)
        // → the shared symbol tier LAST, because it needs the number still adjacent to its unit or sign.
        // Roman numerals arrive already converted at the registry seam (uk is not in ROMAN_NATIVE), with
        // romanOrdinals.ts supplying the ordinal a century wants, so the roman-vs-initialism ordering
        // hazard cannot arise here.
        var normalized = SYMBOLS(Normalize.NormalizeUkrainianInitialisms(Normalize.NormalizeUkrainian(input)));
        return Clauses.AssembleClauses(normalized, TOKEN, (m, sink) =>
        {
            if (m.Groups[1].Success && m.Groups[1].Value.Length > 0) sink.Emit(PhonemizeWord(m.Groups[1].Value));
            else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
            {
                var bits = m.Groups[2].Value.Split(',');
                var intPart = bits[0];
                string? frac = bits.Length > 1 ? bits[1] : null;
                sink.Emit(Number(intPart));
                if (frac is not null)
                {
                    sink.Emit(PhonemizeWord(DEF.Numbers.DecimalConnector));
                    foreach (var dg in frac) sink.Emit(Number(dg.ToString()));
                }
            }
            else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
            {
                if (CLAUSE_MARK.TryGetValue(m.Groups[3].Value, out var mk) && mk.Length > 0) sink.Pause(mk);
            }
        });
    }

    /** Build the Ukrainian phonemizer. */
    public static ILanguage CreateUkrainian() => new UkrainianPhonemizer();

    internal static void RegisterSelf()
    {
        Registry.Register("ukrainian", CreateUkrainian);
        Registry.RegisterRomanPolicy("uk", RomanOrdinals.ROMAN_POLICY);
    }
}
