/**
 * Native Swahili / Kiswahili (sw) text phonemizer — canonical IPA.
 * Ported from src/languages/swahili/swahili.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Swahili;

public sealed class SwahiliNumbersDef
{
    public string[] Units { get; init; } = [];
    public string Ten { get; init; } = "";
    public IReadOnlyDictionary<string, string> Tens { get; init; } = new Dictionary<string, string>();
    public string Hundred { get; init; } = "";
    public string Thousand { get; init; } = "";
    public string Million { get; init; } = "";
    public string And { get; init; } = "";
}

public sealed class SwahiliDef
{
    public string VelarNasal { get; init; } = "";
    public IReadOnlyDictionary<string, string> Prenasal { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Digraphs { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Consonants { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Vowels { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> ClausePunctuation { get; init; } = new Dictionary<string, string>();
    public SwahiliNumbersDef Numbers { get; init; } = new();
}

public static class SwahiliPhonemizer
{
    public static readonly SwahiliDef DEF = LoadManifest.Load<SwahiliDef>("languages/swahili", "swahili.jsonc");
    private static IReadOnlyDictionary<string, string> CLAUSE_MARK => DEF.ClausePunctuation;
    private static SwahiliNumbersDef NUM => DEF.Numbers;
    private static readonly IReadOnlyDictionary<string, string> TWO = // all 2-letter graphemes
        DEF.Prenasal.Concat(DEF.Digraphs).ToDictionary(kv => kv.Key, kv => kv.Value, StringComparer.Ordinal);
    private const string VOWEL_LETTER = "aeiou";
    private static readonly JsRe ASCII_LOWER = JsRegex.Compile("[a-z]", "u");
    private static bool IsConsonantLetter(string c) =>
        ASCII_LOWER.IsMatch(c) && !VOWEL_LETTER.Contains(c, StringComparison.Ordinal);

    private sealed class Seg
    {
        public required string Ph { get; set; }
        public required bool Nucleus { get; init; } // a vowel or a syllabic nasal — bears stress
    }

    /** Scan a lowercased Swahili word into segments (ng' → prenasal digraphs → consonant digraphs → singles). */
    private static List<Seg> Scan(string w)
    {
        var s = Js.CodePoints(w);
        var n = s.Count;
        var segs = new List<Seg>();
        // ⚠ THE TS MIXES INDEX SPACES HERE: `w.startsWith(velarNasal, i)` takes a UTF-16 offset while `i`
        // walks the CODE-POINT array `s`. Swahili orthography is ASCII plus the apostrophe, so the two
        // coincide for every input this scan sees; mirrored rather than corrected so the shapes match.
        for (var i = 0; i < n;)
        {
            if (i <= w.Length - DEF.VelarNasal.Length &&
                string.CompareOrdinal(w, i, DEF.VelarNasal, 0, DEF.VelarNasal.Length) == 0)
            {
                segs.Add(new Seg { Ph = "ŋ", Nucleus = false });
                i += DEF.VelarNasal.Length;
                continue;
            }
            var two = s[i] + (i + 1 < n ? s[i + 1] : "");
            if (TWO.TryGetValue(two, out var twoPh) && twoPh != "")
            {
                segs.Add(new Seg { Ph = twoPh, Nucleus = false });
                i += 2;
                continue;
            }
            var c = s[i];
            if (VOWEL_LETTER.Contains(c, StringComparison.Ordinal))
            {
                var isLong = i + 1 < n && s[i + 1] == c;
                segs.Add(new Seg { Ph = DEF.Vowels[c] + (isLong ? "ː" : ""), Nucleus = true });
                i += isLong ? 2 : 1;
            }
            else if (c == "w" &&
                     segs.Count > 0 &&
                     !segs[^1].Nucleus &&
                     VOWEL_LETTER.Contains(i + 1 < n ? s[i + 1] : "", StringComparison.Ordinal))
            {
                // ⚠ NO `i + 1 < n` GUARD, AND THAT IS THE POINT. The TS tests
                // `VOWEL_LETTER.includes(s[i + 1] ?? "")`, and `"aeiou".includes("")` is TRUE — so a
                // word-FINAL ⟨w⟩ after a consonant onset labializes that consonant. .NET's `Contains("")`
                // is true as well, so the empty string reproduces it. Adding the bounds check here would
                // look defensive and silently drop the final-w case.
                segs[^1].Ph += "ʷ";
                i++;
            }
            else if (c == "m" || c == "n")
            {
                var nx = i + 1 < n ? s[i + 1] : null;
                var syllabic = nx is null || (IsConsonantLetter(nx) && nx != "w" && nx != "y");
                segs.Add(new Seg { Ph = syllabic ? c + "̩" : c, Nucleus = syllabic });
                i++;
            }
            else if (DEF.Consonants.TryGetValue(c, out var consPh))
            {
                segs.Add(new Seg { Ph = consPh, Nucleus = false });
                i++;
            }
            else i++; // unknown → skip
        }
        return segs;
    }

    /** One Swahili word → canonical IPA (penultimate stress). */
    public static string PhonemizeWord(string word)
    {
        var segs = Scan(word.ToLowerInvariant());
        if (segs.Count == 0) return "";
        var nuclei = segs.Select((sg, i) => sg.Nucleus ? i : -1).Where(i => i >= 0).ToList();
        var stress = nuclei.Count >= 2 ? nuclei[^2] : (nuclei.Count > 0 ? nuclei[0] : -1);
        var outp = "";
        for (var i = 0; i < segs.Count; i++)
        {
            if (i == stress) outp += "ˈ";
            outp += segs[i].Ph;
        }
        return outp.Normalize(System.Text.NormalizationForm.FormC);
    }

    private static string BelowHundred(double n)
    {
        if (n == 0) return "";
        if (n < 10) return NUM.Units[(int)n];
        if (n == 10) return NUM.Ten;
        if (n < 20) return $"{NUM.Ten} {NUM.And} {NUM.Units[(int)n - 10]}";
        double t = Math.Floor(n / 10), u = n % 10;
        return NUM.Tens[Js.NumberToString(t)] + (u != 0 ? $" {NUM.And} {NUM.Units[(int)u]}" : "");
    }

    private static string BelowThousand(double n)
    {
        double h = Math.Floor(n / 100), r = n % 100;
        if (h == 0) return BelowHundred(n);
        var hw = $"{NUM.Hundred} {(h == 1 ? NUM.Units[1] : NUM.Units[(int)h])}";
        return r != 0 ? $"{hw} {NUM.And} {BelowHundred(r)}" : hw;
    }

    /**
     * Non-negative integer → standard Swahili numeral spelling, or "" when the authored scale cannot express
     * it.
     *
     * ⚠ THE REFUSAL IS LOAD-BEARING: above 10⁹ the ladder's hundreds index runs off the end of the units
     * array. JS yields `undefined` there and spoke the word "undefined"; C# would THROW, so the composition
     * returns "" and the caller reads the numeral digit at a time.
     */
    private static string NumberToText(double n)
    {
        if (n == 0) return NUM.Units[0];
        var groups = new List<string>();
        var mil = Math.Floor(n / 1_000_000);
        if (mil >= 1000) return ""; // beyond `milioni` — see the note above
        if (mil != 0)
        {
            groups.Add($"{NUM.Million} {BelowThousand(mil)}");
            n %= 1_000_000;
        }
        var th = Math.Floor(n / 1000);
        if (th != 0)
        {
            groups.Add($"{NUM.Thousand} {BelowThousand(th)}");
            n %= 1000;
        }
        if (n != 0) groups.Add(BelowThousand(n));
        return string.Join($" {NUM.And} ", groups);
    }

    /** This language's OWN inventory — a token it rejects carries a letter the language does not use. */
    private const string NATIVE_CLASS = "[a-zA-Z']";
    /** NATIVISE a foreign name: fold an out-of-inventory accent to a base this g2p has a rule for. */
    private static readonly Func<string, string> Nat = HostWord.MakeNativiser(NATIVE_CLASS, "u");

    private static readonly JsRe TOKEN = JsRegex.Compile(
        $"({HostWord.HostWordRun(new[] { "Latin" }, "'")})|(\\d+)|([.?!,;:])", "gu");

    /** Shared symbol tier: ampersand, multiply, percent, currency, units and rates. */
    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        Ampersand = "na",
        Multiply = new MultiplyDef { Times = "mara" },
        Percent = new[] { "asilimia" },
        PercentPrefix = true,
        Currency = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["$"] = new[] { "dola" }, ["€"] = new[] { "euro" }, ["£"] = new[] { "pauni" }, ["¥"] = new[] { "yeni" },
            ["KSh"] = new[] { "shilingi" }, ["TSh"] = new[] { "shilingi" },
        },
        CurrencyPrefix = true,
        UnitPrefix = true,
        Units = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["km"] = new[] { "kilomita" }, ["m"] = new[] { "mita" }, ["cm"] = new[] { "sentimita" },
            ["kg"] = new[] { "kilogramu" },
        },
        UnitPer = "kwa",
        RateDenominators = new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["h"] = "saa", ["s"] = "sekunde",
        },
    });

    private sealed class Engine : ILanguage
    {
        public string Text(string input) =>
            // ⚠ ORDER: the symbol tier runs FIRST, then NormalizeSwahili — the tier matches a raw
            // `<number> %` adjacency, which the decimal rewrite (`1.5` → `1 nukta 5`) destroys.
            Clauses.AssembleClauses(Normalize.NormalizeSwahili(SYMBOLS(input)), TOKEN, (m, sink) =>
            {
                if (m.Groups[1].Success && m.Groups[1].Value.Length > 0) sink.Emit(PhonemizeWord(Nat(m.Groups[1].Value)));
                else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
                {
                    var num = Js.Number(m.Groups[2].Value);
                    var composed = double.IsInteger(num) && Math.Abs(num) <= 9007199254740991d ? NumberToText(num) : "";
                    if (composed != "")
                        foreach (var wd in composed.Split(' '))
                            sink.Emit(PhonemizeWord(wd));
                    else
                        foreach (var d in Js.CodePoints(m.Groups[2].Value))
                            foreach (var wd in NumberToText(Js.Number(d)).Split(' '))
                                sink.Emit(PhonemizeWord(wd));
                }
                else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
                {
                    var mk = CLAUSE_MARK.GetValueOrDefault(m.Groups[3].Value);
                    if (mk is not null) sink.Pause(mk);
                }
            });
    }

    /** Build the Swahili phonemizer (no data files beyond the manifest — the engine is rule-based). */
    public static ILanguage CreateSwahili() => new Engine();

    internal static void RegisterSelf() => Registry.Register("swahili", CreateSwahili);
}
