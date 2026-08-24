/**
 * Native Ukrainian / українська (uk) text phonemizer — canonical IPA.
 * Ported from src/languages/ukrainian/ukrainian.ts — see that file for the corpus evidence.
 */
using System.Text;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Ukrainian;

public sealed class UkrainianPhonemizer : ILanguage
{
    private static UkrainianDef DEF => Manifest.DEF;
    private static IReadOnlyDictionary<string, string> CLAUSE_MARK => DEF.ClausePunctuation;

    private const string SOFT = "ь";
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
                if (c == "в")
                {
                    if (nxt == "о" || nxt == "у") ipa = "w";
                    else if (nxt == "а" || nxt == "е" || nxt == "и") ipa = "ʋ";
                    else if (nxt == "і" || nxt == SOFT || DEF.Iotated.ContainsKey(nxt)) ipa = "ʋʲ"; // palatalised before і/ь/iotated (свято→sʲʋʲatɔ)
                    else ipa = i > 0 && VOWEL_LETTERS.Contains(chars[i - 1]) ? "u̯" : "w"; // coda vs word-initial-before-C
                }
                else if (c == "й") ipa = PLAIN_VOWELS.Contains(nxt) ? "j" : "i̯"; // onset [j] before a plain vowel; else coda [i̯] (Майя→…i̯j…)
                else if (PALATALIZERS.Contains(nxt)) ipa = Palatalise(ipa);
                outp.Add(ipa);
                i++;
                if (nxt == SOFT) i++; // consume the soft sign (palatalisation already applied)
                continue;
            }
            if (DEF.Iotated.TryGetValue(c, out var iot))
            {
                var prev = i > 0 ? chars[i - 1] : "";
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
                var last = outp.Count > 0 ? outp[^1] : null;
                if (!string.IsNullOrEmpty(last) && !last.EndsWith("ʲ", StringComparison.Ordinal)) outp[^1] = Palatalise(last);
                i++;
                continue;
            }
            i++; // apostrophe (breaks C+iotated adjacency → [j]V) and unknowns → skip
        }
        var x = string.Concat(outp);
        x = DARK_L_BEFORE_PAL.Replace(x, "lʲ");
        x = CORONAL_BEFORE_PAL.Replace(x, "$1ʲ");
        x = GEM_PLAIN.Replace(GEM_PLAIN_PAL.Replace(GEM_PAL_PAIR.Replace(x, "$1ʲː"), "$1ʲː"), "$1ː");
        return x.Normalize(NormalizationForm.FormC);
    }

    private static string Number(string digits)
    {
        var n = Js.Number(digits);
        // The 2^53-1 bound reproduces JS `Number.isSafeInteger`: past it the double has lost the low digits,
        // so the numeral is spelled out digit-at-a-time rather than composed.
        if (!(double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d))
            return Core.Numbers.SpellDigits(digits, DEF.Numbers, PhonemizeWord);
        return Core.Numbers.RenderNumber(n, DEF.Numbers, PhonemizeWord, Numbers.eastSlavicNumberWords);
    }

    /**
     * symbol normalization — Ukrainian: CYRILLIC unit abbreviations (км, not km) and the three-way Slavic
     * agreement, which for uk IS Russian's selector (see normalize.ts's header for the evidence).
     */
    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        Multiply = new MultiplyDef { Times = "на" },
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
            ["м"] = new[] { "метр", "метри", "метрів", "метра" },
            ["m"] = new[] { "метр", "метри", "метрів", "метра" },
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
        ExponentWords = new ExponentWordsDef
        {
            Squared = new[] { "квадратний", "квадратні", "квадратних", "квадратного" },
            Cubed = new[] { "кубічний", "кубічні", "кубічних", "кубічного" },
            Position = ExponentPosition.Before,
        },
        Magnitudes = new[] { "тисячі", "тисяч", "мільйон", "мільйона", "мільйони", "мільйонів",
            "мільярд", "мільярда", "мільярди", "мільярдів" },
        CountForm = n => double.IsInteger(n) ? NormalizeSymbols.SlavicCountForm(n) : 3,
    });

    private const string CYRILLIC = "\\u0400-\\u04FF";
    private static readonly JsRe TOKEN = JsRegex.Compile($"([{CYRILLIC}'’ʼ]+)|(\\d+(?:,\\d+)?)|([.?!,;:…—])", "gu");

    public string Text(string input)
    {
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
