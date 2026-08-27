/**
 * Swedish (sv) phonemizer — Central Standard Swedish, canonical IPA: rule g2p plus the NST accent/stress
 * lexicon (pitch accent 1/2, non-initial stress, compound secondary stress) and a function-word exception map.
 * Ported from src/languages/swedish/swedish.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Swedish;

public sealed class SwedishPhonemizer : ILanguage
{
    private static IReadOnlyDictionary<string, string> EXCEPTIONS => Manifest.MANIFEST.Exceptions;
    private const string GRAVE = "̀"; // combining grave = the accent-2 mark, on the primary-stressed vowel

    private sealed class LexEntry
    {
        public string Accent = "";
        public double? Ord;
        public bool OLong;
        public double? SecOrd;
        public HashSet<double>? LongOrds;
        public bool SecVowelInitial;
    }

    private static readonly JsRe ORD_TOK = JsRegex.Compile("^\\d+$");
    private static readonly JsRe SEC_TOK = JsRegex.Compile("^s\\d+$");
    private static readonly JsRe LONG_TOK = JsRegex.Compile("^L[\\d,]+$");

    private static Dictionary<string, LexEntry>? LEXICON;
    private static Dictionary<string, LexEntry> Lexicon()
    {
        if (LEXICON is null)
            LEXICON = LoadTsv.LoadTsvMap<LexEntry>("languages/swedish", "accent-stress.tsv", (rest, _) =>
            {
                var fields = rest.Split('\t');
                var accent = fields[0];
                var tokens = fields.Skip(1).ToList();
                var ordTok = tokens.FirstOrDefault(t => ORD_TOK.IsMatch(t));
                var secTok = tokens.FirstOrDefault(t => SEC_TOK.IsMatch(t));
                var longTok = tokens.FirstOrDefault(t => LONG_TOK.IsMatch(t));
                return new LexEntry
                {
                    Accent = accent,
                    Ord = ordTok is not null ? Js.Number(ordTok) : null,
                    OLong = tokens.Contains("o"),
                    SecOrd = secTok is not null ? Js.Number(secTok[1..]) : null,
                    LongOrds = longTok is not null
                        ? new HashSet<double>(longTok[1..].Split(',').Select(Js.Number))
                        : null,
                    SecVowelInitial = tokens.Contains("vi"),
                };
            // ⚠ #1068: alias each key to its NATIVISED spelling, because Text() folds before it looks up.
            // 15 keys were unreachable — `münchen` (NST accent 1) read with the OOV rule's accent 2.
            }, optional: true, fold: Nat);
        return LEXICON;
    }

    /** Pitch accent for an OOV word from its shape: a monosyllable, or a polysyllable with non-initial stress,
     *  is accent 1; a polysyllable with initial stress is accent 2. */
    private static string OovAccent(int nuclei, double stressOrd) => nuclei > 1 && stressOrd == 0 ? "2" : "1";

    /** One Swedish word → canonical IPA. Monosyllables carry no ˈ / accent. */
    public static string PhonemizeWord(string word)
    {
        var w = word.ToLowerInvariant().Normalize(System.Text.NormalizationForm.FormC);
        if (EXCEPTIONS.TryGetValue(w, out var exc)) return exc;

        Lexicon().TryGetValue(w, out var lex);
        var rawOrd = lex?.Ord ?? 0;
        var oLong = lex?.OLong ?? false;
        var nucleiProbe = G2p.ToSegments(w, rawOrd, oLong).Count(s => s.Vowel);
        var compound = lex?.SecOrd is not null && lex.SecOrd != rawOrd && lex.SecOrd < nucleiProbe
            ? new Compound
            {
                SecOrd = (int)lex.SecOrd.Value,
                LongOrds = lex.LongOrds ?? new HashSet<double>(),
                SecVowelInitial = lex.SecVowelInitial,
            }
            : null;
        var segs = G2p.ToSegments(w, rawOrd, oLong, compound);
        var nuclei = segs.Count(s => s.Vowel);
        if (nuclei == 0) return string.Concat(segs.Select(s => s.Ph));

        var ord = Math.Min(rawOrd, nuclei - 1);
        if (ord != rawOrd) segs = G2p.ToSegments(w, ord, oLong, compound); // clamp: length must land on a real nucleus
        var accent = lex?.Accent ?? OovAccent(nuclei, ord);

        var outp = "";
        var seen = 0;
        foreach (var s in segs)
        {
            if (s.Vowel)
            {
                if (seen == ord && nuclei > 1)
                {
                    outp += "ˈ";
                    // `s.ph[0]` is one UTF-16 UNIT in JS; every vowel phone here is BMP, so this is the same slice.
                    outp += accent == "2" ? s.Ph[0] + GRAVE + s.Ph[1..] : s.Ph;
                }
                else if (compound is not null && seen == compound.SecOrd)
                {
                    outp += "ˌ"; // secondary stress (compound element)
                    outp += s.Ph;
                }
                else outp += s.Ph;
                seen++;
            }
            else outp += s.Ph;
        }
        return outp.Normalize(System.Text.NormalizationForm.FormC);
    }

    private static IReadOnlyDictionary<string, string> CLAUSE_MARK => Manifest.MANIFEST.ClausePunctuation;

    /** NFC fold, hoisted OUT of `Text()` on purpose — see swedish.ts (normalization/review.ts's trap-6 check). */
    private static string Nfc(string s) => s.Normalize(System.Text.NormalizationForm.FormC);

    private static readonly JsRe TOKEN =
        JsRegex.Compile($"({HostWord.LATIN_RUN})|(\\d+(?:[.,]\\d+)?)|([.!?…,;:])", "gu");
    private static readonly JsRe DECIMAL_SEP = JsRegex.Compile("[.,]");

    /** This language's OWN inventory — an INVENTORY question, distinct from the TOKEN class's routing one. */
    private const string NATIVE_CLASS = "[a-zåäöéA-ZÅÄÖÉ]";
    private static readonly Func<string, string> Nat = HostWord.MakeNativiser(NATIVE_CLASS, "u");

    // symbol normalization — Swedish (procent/kilometer/dollar are invariant plurals). See swedish.ts for the
    // measurement behind every key here.
    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        Multiply = new MultiplyDef { Times = "gånger" },
        Percent = new[] { "procent" },
        Currency = new Dictionary<string, IReadOnlyList<string>>
        {
            ["€"] = new[] { "euro" }, ["$"] = new[] { "dollar" }, ["£"] = new[] { "pund" },
        },
        Units = new Dictionary<string, IReadOnlyList<string>>
        {
            ["km"] = new[] { "kilometer" }, ["m"] = new[] { "meter" }, ["cm"] = new[] { "centimeter" },
            ["mm"] = new[] { "millimeter" }, ["kg"] = new[] { "kilogram" }, ["ghz"] = new[] { "gigahertz" },
            ["mbit"] = new[] { "megabit" },
        },
        RateDenominators = new Dictionary<string, string>
        {
            ["h"] = "timme", ["t"] = "timme", ["s"] = "sekund", ["min"] = "minut",
        },
        UnitPer = "per",
        // Swedish COMPOUNDS the measure word onto the unit: kvadratkilometer, one word.
        ExponentWords = new ExponentWordsDef
        {
            Squared = new[] { "kvadrat" }, Cubed = new[] { "kubik" }, Position = ExponentPosition.Compound,
        },
        Magnitudes = new[] { "miljoner", "miljon", "miljarder", "miljard" },
    });

    public string Text(string input)
    {
        var normalized = SYMBOLS(Normalize.NormalizeSwedishInitialisms(Normalize.NormalizeSwedish(input)));
        return Clauses.AssembleClauses(Nfc(normalized), TOKEN, (m, sink) =>
        {
            if (m.Groups[1].Success && m.Groups[1].Value.Length > 0) sink.Emit(PhonemizeWord(Nat(m.Groups[1].Value)));
            else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
            {
                var bits = DECIMAL_SEP.Re.Split(m.Groups[2].Value);
                var intPart = bits[0];
                string? frac = bits.Length > 1 ? bits[1] : null;
                foreach (var wd in Numbers.NumberToWords(Js.Number(intPart), intPart).Split(' ')) sink.Emit(PhonemizeWord(wd));
                if (frac is not null)
                {
                    sink.Emit(PhonemizeWord("komma"));
                    foreach (var d in frac)
                        foreach (var wd in Numbers.NumberToWords(Js.Number(d.ToString())).Split(' '))
                            sink.Emit(PhonemizeWord(wd));
                }
            }
            else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
            {
                if (CLAUSE_MARK.TryGetValue(m.Groups[3].Value, out var mk) && mk.Length > 0) sink.Pause(mk);
            }
        });
    }

    /** Build the Swedish phonemizer (rule g2p + NST accent/stress + a function-word exception map). */
    public static ILanguage CreateSwedish() => new SwedishPhonemizer();

    internal static void RegisterSelf() => Registry.Register("swedish", CreateSwedish);
}
