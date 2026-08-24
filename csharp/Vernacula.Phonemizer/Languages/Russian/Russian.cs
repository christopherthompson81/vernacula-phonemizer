/**
 * Russian (ru) phonemizer — standard Moscow Russian, canonical IPA.
 * Ported from src/languages/russian/russian.ts — see that file for the corpus evidence.
 */
using System.Text.RegularExpressions;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Russian;

public sealed class RussianPhonemizer : ILanguage
{
    private const string Dir = "languages/russian";

    private static Dictionary<string, double>? STRESS;
    private static Dictionary<string, double> StressDict() =>
        STRESS ??= LoadTsv.LoadTsvMapV<double>(Dir, "stress.tsv", (v, _) => Js.Number(v));

    private static Dictionary<string, List<int>>? HARD;
    private static Dictionary<string, List<int>> HardDict() =>
        HARD ??= LoadTsv.LoadTsvMap<List<int>>(Dir, "hard-e.tsv",
            (v, _) => v.Split(',').Select(x => (int)Js.Number(x)).ToList(), optional: true);

    private static readonly JsRe VOWEL_RE = JsRegex.Compile($"[{Manifest.MANIFEST.VowelLetters}]", "gi");

    private static IReadOnlyDictionary<string, string> IRREGULARS => Manifest.MANIFEST.Irregulars;

    /** One Russian word → canonical IPA. Stress from the dictionary; ё is inherently stressed; else first. */
    public static string PhonemizeWord(string word)
    {
        var w = word.ToLowerInvariant();
        if (IRREGULARS.TryGetValue(w, out var irr)) return irr;
        double? ord = StressDict().TryGetValue(w, out var d) ? d : null;
        if (ord is null && w.Contains('е'))
        {
            for (var i = 0; i < w.Length; i++)
            {
                if (w[i] != 'е') continue;
                var cand = w[..i] + "ё" + w[(i + 1)..];
                if (StressDict().ContainsKey(cand)) return PhonemizeWord(cand);
            }
        }
        ord ??= AdjectiveStress(w); // inflected adjective/pronoun → stress from its masc. lemma
        if (ord is null)
        {
            var vowels = VOWEL_RE.Matches(w).Select(m => m.Value).ToList();
            var eIdx = vowels.FindIndex(v => v == "ё");
            ord = eIdx >= 0 ? eIdx : 0; // ё is always stressed; otherwise default to the first vowel
        }
        // ⚠ A NON-NUMERIC ORDINAL FALLS BACK TO THE LAST VOWEL, NOT THE FIRST. `Number("x")` is NaN in the TS
        // and `vowelIdx[NaN]` is undefined, so g2p takes its last-vowel fallback; `(int)double.NaN` in C# is 0,
        // which would silently stress the FIRST vowel instead. Unreachable from today's stress.tsv, and
        // closed here because the next dictionary regeneration need not keep it so.
        var ordinal = double.IsNaN(ord.Value) ? -1 : (int)ord.Value;
        return G2p.ToIpa(w, ordinal, HardDict().TryGetValue(w, out var h) ? h : null);
    }

    private static readonly List<(string End, IReadOnlyList<string> LemEnds)> ADJ_ENDINGS =
        Manifest.MANIFEST.AdjectiveStress.Endings
            .Select(e => (e.End, e.Type == "hard"
                ? Manifest.MANIFEST.AdjectiveStress.HardLemmas
                : Manifest.MANIFEST.AdjectiveStress.SoftLemmas))
            .ToList();

    private static int CountVowels(string w) =>
        Js.CodePoints(w).Count(c => Manifest.MANIFEST.VowelLetters.Contains(c, StringComparison.Ordinal));

    /** Stress ordinal for an OOV inflected adjective/pronoun form, inferred from its masculine lemma (большое →
     *  большой, которые → который). Returns null if no lemma is in the dictionary. */
    private static double? AdjectiveStress(string w)
    {
        foreach (var (end, lemEnds) in ADJ_ENDINGS)
        {
            if (!w.EndsWith(end, StringComparison.Ordinal) || w.Length - end.Length < 2) continue;
            var stem = w[..^end.Length];
            foreach (var lemEnd in lemEnds)
            {
                if (StressDict().TryGetValue(stem + lemEnd, out var ord) && ord < CountVowels(w)) return ord;
            }
        }
        return null;
    }

    private static IReadOnlyDictionary<string, string> CLAUSE_MARK => Manifest.MANIFEST.ClausePunctuation;
    private static readonly JsRe TOKEN = JsRegex.Compile("([а-яёА-ЯЁ]+)|(\\d+(?:[.,]\\d+)?)|([.!?…,;:])", "gu");
    private static readonly JsRe DECIMAL_SEP = JsRegex.Compile("[.,]");

    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        Multiply = new MultiplyDef { Times = "умножить на" },
        Ampersand = "и",
        Percent = new[] { "процент", "процента", "процентов" },
        Currency = new Dictionary<string, IReadOnlyList<string>>
        {
            ["€"] = new[] { "евро" },
            ["$"] = new[] { "доллар", "доллара", "долларов" },
            ["£"] = new[] { "фунт", "фунта", "фунтов" },
        },
        Units = new Dictionary<string, IReadOnlyList<string>>
        {
            ["км"] = new[] { "километр", "километра", "километров" },
            ["см"] = new[] { "сантиметр", "сантиметра", "сантиметров" },
            ["мм"] = new[] { "миллиметр", "миллиметра", "миллиметров" },
            ["кг"] = new[] { "килограмм", "килограмма", "килограммов" },
            ["km"] = new[] { "километр", "километра", "километров" },
            ["cm"] = new[] { "сантиметр", "сантиметра", "сантиметров" },
            ["mm"] = new[] { "миллиметр", "миллиметра", "миллиметров" },
            ["kg"] = new[] { "килограмм", "килограмма", "килограммов" },
            ["ч"] = new[] { "час", "часа", "часов" },
            ["h"] = new[] { "час", "часа", "часов" },
            ["м"] = new[] { "метр", "метра", "метров" },
            ["m"] = new[] { "метр", "метра", "метров" },
        },
        UnitPer = "в",
        ExponentWords = new ExponentWordsDef
        {
            Squared = new[] { "квадратный", "квадратных" },
            Cubed = new[] { "кубический", "кубических" },
            Position = ExponentPosition.Before,
        },
        BareExponent = new BareExponentDef
        {
            Squared = "{n} в квадрате",
            Cubed = "{n} в кубе",
            Power = "{n} в степени {e}",
            Negative = "минус",
        },
        Magnitudes = new[] { "тысячи", "тысяч", "миллион", "миллиона", "миллионов", "миллиард", "миллиарда", "миллиардов" },
        CountForm = NormalizeSymbols.SlavicCountForm,
    });

    public string Text(string input)
    {
        // ⚠ ORDER: the Russian rewrites (abbreviations, ordinal notation, clock, units) run first, then the
        // initialisms, then the shared symbol tier LAST.
        var normalized = SYMBOLS(Normalize.NormalizeRussianInitialisms(Normalize.NormalizeRussian(input)));
        return Clauses.AssembleClauses(normalized, TOKEN, (m, sink) =>
        {
            if (m.Groups[1].Success && m.Groups[1].Value.Length > 0) sink.Emit(PhonemizeWord(m.Groups[1].Value));
            else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
            {
                var bits = DECIMAL_SEP.Re.Split(m.Groups[2].Value);
                var intPart = bits[0];
                string? frac = bits.Length > 1 ? bits[1] : null;
                foreach (var wd in Numbers.NumberToWords(Js.Number(intPart)).Split(' ')) sink.Emit(PhonemizeWord(wd));
                if (frac is not null)
                {
                    sink.Emit(PhonemizeWord(Manifest.MANIFEST.Numbers.DecimalConnector));
                    foreach (var dch in frac)
                        foreach (var wd in Numbers.NumberToWords(Js.Number(dch.ToString())).Split(' '))
                            sink.Emit(PhonemizeWord(wd));
                }
            }
            else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
            {
                if (CLAUSE_MARK.TryGetValue(m.Groups[3].Value, out var mk) && mk.Length > 0) sink.Pause(mk);
            }
        });
    }

    /** Build the Russian phonemizer (stress dictionary + rule g2p). */
    public static ILanguage CreateRussian() => new RussianPhonemizer();

    internal static void RegisterSelf()
    {
        Registry.Register("russian", CreateRussian);
        Registry.RegisterRomanPolicy("ru", RomanOrdinals.ROMAN_POLICY);
    }
}
