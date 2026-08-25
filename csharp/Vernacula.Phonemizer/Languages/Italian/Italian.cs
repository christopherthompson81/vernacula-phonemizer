/**
 * Native Italian (it) text phonemizer — canonical IPA.
 * Ported from src/languages/italian/italian.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Italian;

public sealed class ItalianNumbersDef
{
    public string[] Units { get; init; } = [];
    public string[] Teens { get; init; } = [];
    public string[] Tens { get; init; } = [];
    public string Hundred { get; init; } = "";
    public string Thousand { get; init; } = "";
    public string Thousands { get; init; } = "";
    public string Million { get; init; } = "";
    public string Millions { get; init; } = "";
    public string And { get; init; } = "";
}

public sealed class ItalianDef
{
    public IReadOnlyDictionary<string, string> Consonants { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Vowels { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Accented { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> ClausePunctuation { get; init; } = new Dictionary<string, string>();
    public ItalianNumbersDef Numbers { get; init; } = new();
    /** Readable letter runs Italian nevertheless spells out; see italian.jsonc for what is absent and why. */
    public IReadOnlyList<string> AcronymLetters { get; init; } = Array.Empty<string>();
    public IReadOnlyDictionary<string, string> LetterNames { get; init; } = new Dictionary<string, string>();
    public ItalianPhonotactics Phonotactics { get; init; } = new();
    public IReadOnlyDictionary<string, string> DottedAbbrev { get; init; } = new Dictionary<string, string>();
    /** 1–10 only — everything above is COMPOSED from the cardinal, so there is no tens/hundreds row. */
    public IReadOnlyDictionary<string, string> Ordinals { get; init; } = new Dictionary<string, string>();
    public ItalianFractions Fractions { get; init; } = new();
    /** ⚠ ONE FACT, TWO CALLERS: *un quinto* (fraction) and *un grado* (degree) are the same apocope. */
    public string ApocopatedOne { get; init; } = "";
    public ItalianEraMarkers EraMarkers { get; init; } = new();
    public string NumberSign { get; init; } = "";
    /** Agrees with the count: exactly 1 → `Singular` + the apocopated numeral; otherwise `Plural`. */
    public ItalianDegree Degree { get; init; } = new();
    public IReadOnlyDictionary<string, string> Compass { get; init; } = new Dictionary<string, string>();
    public string DecimalWord { get; init; } = "";
    public SignWords SignWords { get; init; } = null!;
    public ItalianSymbols Symbols { get; init; } = new();
}

public sealed class ItalianPhonotactics
{
    public string Vowels { get; init; } = "";
    public IReadOnlyList<string> Onsets { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> Codas { get; init; } = Array.Empty<string>();
}

public sealed class ItalianFractions
{
    public IReadOnlyDictionary<string, string> Denominators { get; init; } = new Dictionary<string, string>();
}

public sealed class ItalianEraMarkers
{
    public string BeforeChrist { get; init; } = "";
    public string AfterChrist { get; init; } = "";
}

public sealed class ItalianDegree
{
    public string Singular { get; init; } = "";
    public string Plural { get; init; } = "";
    public string Celsius { get; init; } = "";
    public string Fahrenheit { get; init; } = "";
}

/** The shared symbol tier's data (Italian.cs). */
public sealed class ItalianSymbols
{
    public IReadOnlyList<string> Percent { get; init; } = Array.Empty<string>();
    public IReadOnlyDictionary<string, IReadOnlyList<string>> Currency { get; init; } =
        new Dictionary<string, IReadOnlyList<string>>();
    /** Nouns the PREPOSED currency rule treats as already spelled out; stems, matched case-insensitively. */
    public IReadOnlyList<string> CurrencyStems { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> Magnitudes { get; init; } = Array.Empty<string>();
    public string MagnitudeConnective { get; init; } = "";
    public IReadOnlyDictionary<string, IReadOnlyList<string>> Units { get; init; } =
        new Dictionary<string, IReadOnlyList<string>>();
    public ExponentWordsDef ExponentWords { get; init; } = new();
    public BareExponentDef BareExponent { get; init; } = new();
}

public static class ItalianPhonemizer
{
    public static readonly ItalianDef DEF = LoadManifest.Load<ItalianDef>("languages/italian", "italian.jsonc");
    private static IReadOnlyDictionary<string, string> CLAUSE_MARK => DEF.ClausePunctuation;
    private static ItalianNumbersDef NUM => DEF.Numbers;

    private const string VOWEL_LETTERS = "aeiouàèéìíîòóùú";
    private const string FRONT = "eièéìí"; // c/g soften and ⟨sc⟩→ʃ before these
    private const string VOWEL_PH = "aeɛioɔu";
    // ⚠ NO `c != ""` GUARD, AND THE GOLDEN PROVES IT. The TS is `VOWEL_LETTERS.includes(c)`, and JS
    // `String.includes("")` is TRUE — so every caller that passes `next ?? ""` at end of word gets `true`.
    // That is load-bearing for the ⟨s⟩ voicing rule: word-final ⟨s⟩ after a vowel VOICES, so `james` is
    // *jˈamez*. .NET's `Contains("")` is true as well, so the bare call reproduces the JS exactly. Third
    // instance of this shape in the port (German, Swahili, here).
    private static bool IsVowelLetter(string c) => VOWEL_LETTERS.Contains(c, StringComparison.Ordinal);
    private static bool IsFront(string? c) => c is not null && FRONT.Contains(c, StringComparison.Ordinal);
    private static readonly JsRe ASCII_LOWER = JsRegex.Compile("[a-z]", "u");
    private static bool IsConsLetter(string c) => ASCII_LOWER.IsMatch(c) && !IsVowelLetter(c);

    private sealed class Seg
    {
        public required string Ph { get; init; }
        public required bool Accent { get; init; } // came from a written-accent vowel (à è é ì …) → bears stress
    }

    /** Resolve a vowel letter to its IPA, recording whether it was written with a stress accent. */
    private static Seg VowelSeg(string c)
    {
        if (DEF.Accented.TryGetValue(c, out var acc)) return new Seg { Ph = acc, Accent = true };
        return new Seg { Ph = DEF.Vowels.GetValueOrDefault(c) ?? c, Accent = false };
    }

    /**
     * Scan a lowercased Italian word into phoneme segments (contextual c/g/s/z, digraphs, gemination,
     * glides).
     */
    private static List<Seg> Scan(string word)
    {
        var s = Js.CodePoints(word);
        var n = s.Count;
        var segs = new List<Seg>();
        string? At(int k) => k >= 0 && k < n ? s[k] : null;
        bool PrevIsVowel() =>
            segs.Count > 0 && VOWEL_PH.Contains(Js.CodePoints(segs[^1].Ph) is var cp && cp.Count > 0 ? cp[0] : "", StringComparison.Ordinal);
        void Push(string ph) => segs.Add(new Seg { Ph = ph, Accent = false });
        /** Push a consonant that geminates (emits twice) when it sits between vowels. */
        void PushGem(string ph, bool nextVowel)
        {
            if (PrevIsVowel() && nextVowel)
            {
                Push(ph);
                Push(ph);
            }
            else Push(ph);
        }

        var i = 0;
        while (i < n)
        {
            var c = s[i];
            var nx = At(i + 1);
            var nn = At(i + 2);

            // ── digraphs / contextual clusters, LONGEST FIRST — the arms below fall through in order ──
            if (c == "g" && nx == "l" && nn == "i")
            {
                var after = At(i + 3);
                PushGem("ʎ", true);
                if (after is not null && IsVowelLetter(after)) i += 3; // i silent
                else i += 2; // leave the i as a nucleus
                continue;
            }
            if (c == "g" && nx == "n")
            {
                PushGem("ɲ", IsVowelLetter(nn ?? ""));
                i += 2;
                continue;
            }
            if (c == "s" && nx == "c" && IsFront(nn))
            {
                var iDot = nn == "i" || nn == "ì";
                var after = At(i + 3);
                PushGem("ʃ", true);
                if (iDot && after is not null && IsVowelLetter(after)) i += 3;
                else i += 2;
                continue;
            }
            if (c == "c")
            {
                var doubled = nx == "c";
                var follow = doubled ? nn : nx; // the letter that decides hard/soft
                var rest = doubled ? At(i + 3) : nn;
                if (follow == "h")
                {
                    if (doubled) Push("k");
                    Push("k");
                    i += doubled ? 3 : 2;
                    continue;
                }
                if (IsFront(follow))
                {
                    if (doubled) Push("t͡ʃ");
                    Push("t͡ʃ");
                    var iDot = follow == "i" || follow == "ì";
                    if (iDot && rest is not null && IsVowelLetter(rest))
                        i += doubled ? 3 : 2; // ⟨ci⟩+V: silent i (ciao, faccia) — leave the following vowel
                    else i += doubled ? 2 : 1; // else the triggering e/i is a pronounced nucleus — leave it
                    continue;
                }
                if (doubled) Push("k");
                Push("k");
                i += doubled ? 2 : 1;
                continue;
            }
            if (c == "g")
            {
                var doubled = nx == "g";
                var follow = doubled ? nn : nx;
                var rest = doubled ? At(i + 3) : nn;
                if (follow == "h")
                {
                    if (doubled) Push("ɡ");
                    Push("ɡ");
                    i += doubled ? 3 : 2;
                    continue;
                }
                if (IsFront(follow))
                {
                    if (doubled) Push("d͡ʒ");
                    Push("d͡ʒ");
                    var iDot = follow == "i" || follow == "ì";
                    if (iDot && rest is not null && IsVowelLetter(rest))
                        i += doubled ? 3 : 2; // ⟨gi⟩+V: silent i (giorno, oggi) — leave the following vowel
                    else i += doubled ? 2 : 1; // else the triggering e/i is a pronounced nucleus — leave it
                    continue;
                }
                if (doubled) Push("ɡ");
                Push("ɡ");
                i += doubled ? 2 : 1;
                continue;
            }
            if (c == "q")
            {
                Push("k");
                if (nx == "u" && IsVowelLetter(nn ?? ""))
                {
                    Push("w");
                    i += 2;
                }
                else i += 1;
                continue;
            }
            if (c == "s")
            {
                if (nx == "s")
                {
                    Push("s");
                    Push("s");
                    i += 2;
                    continue;
                }
                var nextVoiced = nx is not null && "bdglmnrvz".Contains(nx, StringComparison.Ordinal);
                var voiced = (PrevIsVowel() && IsVowelLetter(nx ?? "")) || nextVoiced;
                Push(voiced ? "z" : "s");
                i += 1;
                continue;
            }
            if (c == "z")
            {
                var doubled = nx == "z";
                Push("t͡s");
                if (doubled) Push("t͡s");
                i += doubled ? 2 : 1;
                continue;
            }

            if (IsConsLetter(c) && nx == c && DEF.Consonants.TryGetValue(c, out var dblPh) && dblPh != "")
            {
                Push(dblPh);
                Push(dblPh);
                i += 2;
                continue;
            }
            if (DEF.Consonants.TryGetValue(c, out var ph1))
            {
                if (ph1 != "") Push(ph1); // ⟨h⟩ maps to "" (silent)
                i += 1;
                continue;
            }

            if (IsVowelLetter(c))
            {
                var semivowel = (c == "i" || c == "u") &&
                                ((nx is not null && IsVowelLetter(nx)) || PrevIsVowel());
                if (semivowel)
                {
                    Push(c == "i" ? "j" : "w");
                    i += 1;
                    continue;
                }
                segs.Add(VowelSeg(c));
                i += 1;
                continue;
            }
            i += 1; // unknown → skip
        }
        return segs;
    }

    /**
     * Stressed nucleus index: the written accent if any, else penultimate vowel (or the only/last nucleus).
     */
    private static int StressIndex(IReadOnlyList<Seg> segs)
    {
        var nuclei = segs
            .Select((sg, i) => VOWEL_PH.Contains(Js.CodePoints(sg.Ph) is var cp && cp.Count > 0 ? cp[0] : "", StringComparison.Ordinal) ? i : -1)
            .Where(i => i >= 0).ToList();
        if (nuclei.Count == 0) return -1;
        foreach (var i in nuclei) if (segs[i].Accent) return i;
        if (nuclei.Count == 1) return nuclei[0];
        return nuclei[^2]; // default penultimate (antepenult is lexical/unmarked)
    }

    /** One Italian word → canonical IPA. */
    public static string PhonemizeWord(string word)
    {
        var segs = Scan(word.ToLowerInvariant());
        if (segs.Count == 0) return "";
        var stress = StressIndex(segs);
        var outp = "";
        for (var i = 0; i < segs.Count; i++)
        {
            if (i == stress) outp += "ˈ";
            outp += segs[i].Ph;
        }
        return outp.Normalize(System.Text.NormalizationForm.FormC);
    }

    /** Build the fused Italian word for 0 ≤ n < 1000 (ventuno, duecentotrentaquattro). */
    private static string Under1000(double n)
    {
        if (n < 10) return NUM.Units[(int)n];
        if (n < 20) return NUM.Teens[(int)n - 10];
        if (n < 100)
        {
            double t = Math.Floor(n / 10), u = n % 10;
            var tens = NUM.Tens[(int)t];
            if (u == 1 || u == 8) tens = tens[..^1]; // ventuno, ventotto (drop final vowel)
            var unit = u == 3 ? "tré" : u != 0 ? NUM.Units[(int)u] : ""; // ventitré carries the accent
            return tens + unit;
        }
        double h = Math.Floor(n / 100), r = n % 100;
        var hundreds = (h > 1 ? NUM.Units[(int)h] : "") + NUM.Hundred;
        return hundreds + (r != 0 ? Under1000(r) : "");
    }

    /**
     * Spoken Italian for a non-negative integer → space-separated magnitude words (thousands fused, millions
     * split).
     */
    public static string NumberWords(double n)
    {
        if (n == 0) return NUM.Units[0];
        var parts = new List<string>();
        var millions = Math.Floor(n / 1000000);
        var rest = n % 1000000;
        if (millions != 0)
        {
            parts.Add(millions == 1
                ? $"un {NUM.Million}" // un milione (uno apocopates before milione)
                : $"{NumberWords(millions)} {NUM.Millions}");
        }
        if (rest != 0 || millions == 0)
        {
            var thousands = Math.Floor(rest / 1000);
            var under = rest % 1000;
            var group = "";
            if (thousands == 1) group += NUM.Thousand; // mille
            else if (thousands > 1) group += Under1000(thousands) + NUM.Thousands; // duemila
            if (under != 0 || thousands == 0) group += Under1000(under);
            if (group != "") parts.Add(group);
        }
        return string.Join(" ", parts);
    }

    /** This language's OWN inventory. */
    private const string NATIVE_CLASS = "[a-zA-ZàèéìíîòóùúÀÈÉÌÍÎÒÓÙÚ]";
    /** NATIVISE a foreign name: fold an out-of-inventory accent to a base this g2p has a rule for. */
    private static readonly Func<string, string> Nat = HostWord.MakeNativiser(NATIVE_CLASS, "u");

    private static readonly JsRe TOKEN = JsRegex.Compile($"({HostWord.LATIN_RUN})|(\\d+)|([.?!,;:])", "gu");

    /** symbol normalization — Italian. */
    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        // ⚠ ONE SOURCE with Normalize.cs, which applies the other seven signs in positions this tier does not
        // reach. See italian.jsonc `signWords` for the register argument behind `per` and the corpus count
        // behind `e` (×1067).
        Multiply = new MultiplyDef { Times = DEF.SignWords.Times },
        Ampersand = DEF.SignWords.Ampersand,
        Percent = DEF.Symbols.Percent,
        // Only the POSTPOSED sign reaches here — Normalize.cs has already claimed the preposed form, which
        // needs the partitive *di* the shared magnitude hop cannot insert.
        Currency = DEF.Symbols.Currency,
        Magnitudes = DEF.Symbols.Magnitudes,
        MagnitudeConnective = DEF.Symbols.MagnitudeConnective,
        Units = DEF.Symbols.Units,
        ExponentWords = DEF.Symbols.ExponentWords,
        BareExponent = DEF.Symbols.BareExponent,
    });

    private sealed class Engine : ILanguage
    {
        public string Text(string input)
        {
            // NORMALIZATION ORDER: general text normalization → INITIALISMS (after abbreviation expansion,
            // so `a.C.` is already words) → SYMBOLS → the DECIMAL COMMA last of all, because the symbol tier
            // matches a unit only against an ADJACENT number and "1,5 km/s" must reach it intact.
            var normalized = Normalize.NormalizeItalianDecimals(
                SYMBOLS(Normalize.NormalizeItalianInitialisms(Normalize.NormalizeItalian(input))));
            return Clauses.AssembleClauses(normalized, TOKEN, (m, sink) =>
            {
                if (m.Groups[1].Success && m.Groups[1].Value.Length > 0) sink.Emit(PhonemizeWord(Nat(m.Groups[1].Value)));
                else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
                {
                    // JS `Number` semantics: above 2^53 the float has already lost its low digits, so we
                    // decline to compose and spell digit-at-a-time rather than emitting the raw ASCII token.
                    var num = Js.Number(m.Groups[2].Value);
                    if (double.IsInteger(num) && Math.Abs(num) <= 9007199254740991d)
                        foreach (var wd in NumberWords(num).Split(' '))
                            sink.Emit(PhonemizeWord(wd));
                    else
                        foreach (var d in Js.CodePoints(m.Groups[2].Value))
                            foreach (var wd in NumberWords(Js.Number(d)).Split(' '))
                                sink.Emit(PhonemizeWord(wd));
                }
                else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
                {
                    var mk = CLAUSE_MARK.GetValueOrDefault(m.Groups[3].Value);
                    if (mk is not null) sink.Pause(mk);
                }
            });
        }
    }

    /** Build the Italian phonemizer (no data files beyond the manifest — the engine is rule-based). */
    public static ILanguage CreateItalian() => new Engine();

    internal static void RegisterSelf()
    {
        Registry.Register("italian", CreateItalian);
        Registry.RegisterRomanPolicy("it", RomanOrdinals.ROMAN_POLICY);
    }
}
