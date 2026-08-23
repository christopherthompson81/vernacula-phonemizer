/**
 * Russian (ru) phonemizer — standard Moscow Russian, canonical IPA. Stress is lexical
 * (not derivable from spelling), so a stress dictionary (stress.tsv, word → stressed-vowel ordinal) feeds the
 * rule g2p (g2p.ts). Words not in the dictionary fall back to a default (first-vowel) stress. text()
 * tokenizes words / numbers / punctuation.
 */
using System.Text.RegularExpressions;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Russian;

public sealed class RussianPhonemizer : ILanguage
{
    private const string Dir = "languages/russian";

    // Stress dictionary: word → 0-based ordinal of the stressed vowel. Loaded once, lazily.
    private static Dictionary<string, double>? STRESS;
    private static Dictionary<string, double> StressDict() =>
        STRESS ??= LoadTsv.LoadTsvMapV<double>(Dir, "stress.tsv", (v, _) => Js.Number(v));

    // Loanword hard-consonant-before-е/и lexicon: word → vowel ordinals whose preceding C is hard (тест → tɛst).
    private static Dictionary<string, List<int>>? HARD;
    private static Dictionary<string, List<int>> HardDict() =>
        HARD ??= LoadTsv.LoadTsvMap<List<int>>(Dir, "hard-e.tsv",
            (v, _) => v.Split(',').Select(x => (int)Js.Number(x)).ToList(), optional: true);

    private static readonly JsRe VOWEL_RE = JsRegex.Compile($"[{Manifest.MANIFEST.VowelLetters}]", "gi");

    // Closed-class irregulars the rules can't predict (чт→ʂt / чн→ʃn, genitive -ого/-его → g→v, silent letters) —
    // DATA (russian.jsonc).
    private static IReadOnlyDictionary<string, string> IRREGULARS => Manifest.MANIFEST.Irregulars;

    /** One Russian word → canonical IPA. Stress from the dictionary; ё is inherently stressed; else first vowel. */
    public static string PhonemizeWord(string word)
    {
        var w = word.ToLowerInvariant();
        if (IRREGULARS.TryGetValue(w, out var irr)) return irr;
        double? ord = StressDict().TryGetValue(w, out var d) ? d : null;
        if (ord is null && w.Contains('е'))
        {
            // Russian text usually writes ё as е. If the word is unknown, try restoring a ё that IS in the dictionary
            // (ещё, моё, пришёл…) — the ё is inherently stressed, so this fixes both the segment and the stress.
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
        return G2p.ToIpa(w, (int)ord.Value, HardDict().TryGetValue(w, out var h) ? h : null);
    }

    // Adjective / participle / adjectival-pronoun case endings (longest first), each paired with the masculine
    // nominative endings used to reconstruct the lemma. HARD endings (-ое/-ая/-ые…) → -ый/-ой; SOFT (-ее/-яя/-ие…)
    // → -ий — so большое → большой (not the comparative больший). Stress is stem-relative → the lemma ordinal transfers.
    // -ий is a last-resort fallback on HARD endings for velar/hushing stems whose lemma is -ий but whose feminine
    // is spelled -ая (маленький → маленькая), while большое still resolves to большой before reaching -ий.
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

    // symbol normalization — Russian: CYRILLIC unit abbreviations (км, not km) and three-way agreement.
    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        // `multiply` — this language had NO word for the sign at all. ⚠ STANDARD MATHEMATICAL REGISTER, not a
        // corpus attestation: the sweep's plausible hits were homographs of PREPOSITIONS (es `por` ×23, it `per` ×25,
        // ru `на` ×31 are all the preposition), the same trap that defeated the exponent sourcing. One word, so `by`
        // defaults to it — this language does not split dimension from product.
        Multiply = new MultiplyDef { Times = "умножить на" },
        // `&` was DROPPED outright: the corpus's `B&B` and `Arts & Sciences` lost the sign.
        // `и` ×1129 in this corpus. The tier spaces it on both sides, because `B&B` is two
        // initialisms and joining them would make one token.
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
            // LATIN aliases. The corpus writes Cyrillic км, but Latin `km` occurs in foreign-sourced text and
            // reached the g2p raw — "120 km/h" came out as the cluster [ˈʊkm] plus the ENGLISH letter H.
            ["km"] = new[] { "километр", "километра", "километров" },
            ["cm"] = new[] { "сантиметр", "сантиметра", "сантиметров" },
            ["mm"] = new[] { "миллиметр", "миллиметра", "миллиметров" },
            ["kg"] = new[] { "килограмм", "килограмма", "килограммов" },
            ["ч"] = new[] { "час", "часа", "часов" },
            ["h"] = new[] { "час", "часа", "часов" },
            // THE BARE METRE, both spellings. метров ×6 / метра ×2, and digit-adjacent bare Latin `m` is ×0 in
            // this corpus. `кубический` was already declared below but unreachable without a head noun, so
            // `120 m³` read as the letter name while `120 km³` read correctly. The apostrophe hazard that kept
            // Ukrainian's `м` out is guarded by the tier itself (`'’ʼ` are rejected after a unit key).
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
        // BARE EXPONENT — the reading for a power with NO unit to modify (`20²`, `mc²`), which every language
        // in the fleet was dropping silently. See `bareExponent` in core/normalizeSymbols.ts for why this cannot
        // reuse `exponentWords` above: that is the unit MODIFIER and this is the PREDICATE, and in most languages
        // they are different words (квадратных километров but двадцать в квадрате).
        // ⚠ PROVENANCE, stated because it is weaker than most data in this repo: these are STANDARD MATHEMATICAL
        // REGISTER, not corpus attestations. The power words are ×0 in this language's artifact.
        BareExponent = new BareExponentDef
        {
            Squared = "{n} в квадрате",
            Cubed = "{n} в кубе",
            Power = "{n} в степени {e}",
            Negative = "минус",
        },
        // Without these the magnitude never matched, so "$5 миллионов" hopped the currency word to the WRONG
        // side and read *пять долларов миллионов*. The inflected forms are listed because running text writes
        // the one its numeral governs (5 миллионов, 2 миллиона).
        Magnitudes = new[] { "тысячи", "тысяч", "миллион", "миллиона", "миллионов", "миллиард", "миллиарда", "миллиардов" },
        CountForm = NormalizeSymbols.SlavicCountForm,
    });

    public string Text(string input)
    {
        // order: Russian rewrites (abbreviations, ordinal notation, clock, units) → INITIALISMS →
        // the shared symbol tier last. Roman numerals arrive already converted from the registry seam,
        // with romanOrdinals.ts supplying the ordinal a century wants, so no ordering hazard here.
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
