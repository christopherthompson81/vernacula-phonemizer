/**
 * Native Indonesian (id) text phonemizer — canonical IPA.
 * Ported from src/languages/indonesian/indonesian.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Indonesian;

public sealed class IndonesianNumbersDef
{
    public IReadOnlyList<string> Units { get; init; } = Array.Empty<string>();
    public string Belas { get; init; } = "";
    public string Puluh { get; init; } = "";
    public string Ratus { get; init; } = "";
    public string Ribu { get; init; } = "";
    public string Juta { get; init; } = "";
    public string Seprefix { get; init; } = "";
    /** The word for the decimal comma ("koma"). */
    public string? DecimalWord { get; init; }
}

public sealed class IndonesianDef
{
    public IReadOnlyDictionary<string, string> Digraphs { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Consonants { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Vowels { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> LaxVowels { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Diphthongs { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> LetterNames { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> ClausePunctuation { get; init; } = new Dictionary<string, string>();
    public IndonesianNumbersDef Numbers { get; init; } = new();
    public IndonesianPhonotactics Phonotactics { get; init; } = new();
    /** The shared symbol tier's data — see the jsonc, where the evidence lives. */
    public IndonesianSymbolTier SymbolTier { get; init; } = new();
}

public sealed class IndonesianPhonotactics
{
    public string Vowels { get; init; } = "";
    public IReadOnlyList<string> Onsets { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> Codas { get; init; } = Array.Empty<string>();
    public IReadOnlyList<string> Digraphs { get; init; } = Array.Empty<string>();
}

public static class IndonesianPhonemizer
{
    public static readonly IndonesianDef DEF =
        LoadManifest.Load<IndonesianDef>("languages/indonesian", "indonesian.jsonc");
    private static IReadOnlyDictionary<string, string> CLAUSE_MARK => DEF.ClausePunctuation;
    private static IndonesianNumbersDef NUM => DEF.Numbers;

    private static bool IsVowelLetter(string c) => "aeiou".Contains(c, StringComparison.Ordinal) && c != "";
    private const string VOWEL_PH = "aeiouəɛɔɪʊ";

    private sealed class Seg
    {
        public required string Ph;
        public required string VowelLetter; // the source vowel letter (for lax resolution); "" for consonants
    }

    /** Scan a lowercased Indonesian word into segments (consonants + tense-default vowels). */
    private static List<Seg> Scan(string w)
    {
        var s = Js.CodePoints(w);
        var segs = new List<Seg>();
        string At(int k) => k >= 0 && k < s.Count ? s[k] : "";
        for (var i = 0; i < s.Count;)
        {
            var di = s[i] + At(i + 1);
            if (DEF.Diphthongs.TryGetValue(di, out var dph) && dph.Length > 0 && i + 2 == s.Count)
            {
                segs.Add(new Seg { Ph = dph, VowelLetter = "" });
                i += 2;
                continue;
            }
            var dg = s[i] + At(i + 1);
            if (DEF.Digraphs.TryGetValue(dg, out var dgh) && dgh.Length > 0)
            {
                segs.Add(new Seg { Ph = dgh, VowelLetter = "" });
                i += 2;
                continue;
            }
            var c = s[i];
            if (IsVowelLetter(c))
            {
                segs.Add(new Seg { Ph = DEF.Vowels[c], VowelLetter = c });
                i++;
            }
            else if (DEF.Consonants.TryGetValue(c, out var cph) && cph.Length > 0)
            {
                segs.Add(new Seg { Ph = cph, VowelLetter = "" });
                i++;
            }
            else i++; // unknown → skip
        }
        return segs;
    }

    private static string Head(string ph) => ph.Length > 0 ? Js.CodePoints(ph)[0] : "";

    /** Penultimate stress on the second-to-last vowel; if that nucleus is a schwa, shift to the final. */
    private static int StressIndex(List<Seg> segs)
    {
        var nuclei = segs.Select((s, i) => VOWEL_PH.Contains(Head(s.Ph), StringComparison.Ordinal) ? i : -1)
            .Where(i => i >= 0).ToList();
        if (nuclei.Count == 0) return -1;
        if (nuclei.Count == 1) return nuclei[0];
        var penult = nuclei[^2];
        if (segs[penult].Ph == "ə") return nuclei[^1]; // schwa can't bear stress
        return penult;
    }

    /** Can this letter run be an Indonesian word at all? */
    private static readonly Func<string, bool> IsUnreadableIndonesian = Initialisms.MakeUnreadableTest(new PhonotacticsData
    {
        Vowels = JsRegex.Compile($"[{DEF.Phonotactics.Vowels}]", "u"),
        LegalOnsets = new HashSet<string>(DEF.Phonotactics.Onsets, StringComparer.Ordinal),
        LegalCodas = new HashSet<string>(DEF.Phonotactics.Codas, StringComparer.Ordinal),
        Digraphs = new HashSet<string>(DEF.Phonotactics.Digraphs, StringComparer.Ordinal),
    });

    /** READABLE AND STILL SPELLED OUT — the cases the phonotactic test gets wrong in the other direction. */
    private static readonly IReadOnlySet<string> SPELLED_ANYWAY =
        new HashSet<string>(new[] { "as", "rem", "oha", "aol" }, StringComparer.Ordinal);

    /**
     * ACRONYM LEXICON — the word-pronounced borrowings whose reading is NOT derivable from Indonesian
     * orthography, and so has to be listed rather than computed.
     */
    private static readonly IReadOnlyDictionary<string, string> ACRONYM_LEXICON = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["unesco"] = "unˈɛsko",
        ["covid"] = "kˈovid",
        ["acta"] = "ˈakta",
    };

    private static readonly JsRe ALL_CAPS = JsRegex.Compile("^[A-Z]{2,}$", "");

    /**
     * One Indonesian word → canonical IPA, RULE-ENGINE ONLY (no ⟨e⟩ lexicon). The non-circular engine signal
     * used by the referee eval; the shipped PhonemizeWord layers the consensus ⟨e⟩ lexicon on top.
     */
    public static string PhonemizeWordRules(string word)
    {
        if (ALL_CAPS.IsMatch(word))
        {
            var low = word.ToLowerInvariant();
            if (ACRONYM_LEXICON.TryGetValue(low, out var lex)) return lex; // listed borrowing: its own attested reading
            if (SPELLED_ANYWAY.Contains(low) || IsUnreadableIndonesian(low))
                return string.Concat(Js.CodePoints(low).Select(c => DEF.LetterNames.GetValueOrDefault(c) ?? ""));
        }
        var segs = Scan(word.ToLowerInvariant());
        if (segs.Count == 0) return "";
        for (var i = 0; i < segs.Count; i++)
        {
            if (segs[i].Ph != "k") continue;
            var next = i + 1 < segs.Count ? segs[i + 1] : null;
            if (next is null || (!VOWEL_PH.Contains(Head(next.Ph), StringComparison.Ordinal) && next.Ph != ""))
                segs[i].Ph = "ʔ";
        }
        var stress = StressIndex(segs);
        var @out = "";
        for (var i = 0; i < segs.Count; i++)
        {
            if (i == stress) @out += "ˈ";
            @out += segs[i].Ph;
        }
        return @out.Normalize(System.Text.NormalizationForm.FormC);
    }

    private static Dictionary<string, string>? LEXICON;
    private static Dictionary<string, string> Lexicon() =>
        LEXICON ??= LoadTsv.LoadTsvMap("languages/indonesian", "indonesian-e-lexicon.tsv", optional: true);

    /**
     * SHIPPED Indonesian word → canonical IPA. A consensus ⟨e⟩ lexicon override resolves the pepet/taling
     * ambiguity for known words; everything else falls through to the rule engine (which defaults pepet).
     */
    public static string PhonemizeWord(string word)
    {
        if (!ALL_CAPS.IsMatch(word))
        {
            if (Lexicon().TryGetValue(word.ToLowerInvariant(), out var hit)) return hit;
        }
        return PhonemizeWordRules(word);
    }

    private static string NumberWords(double n)
    {
        if (n < 0) return "";
        if (n < 10) return NUM.Units[(int)n];
        if (n < 12) return n == 10 ? NUM.Seprefix + NUM.Puluh : NUM.Seprefix + NUM.Belas;
        if (n < 20) return $"{NUM.Units[(int)n - 10]} {NUM.Belas}";
        if (n < 100)
        {
            int t = (int)(n / 10), r = (int)(n % 10);
            return $"{NUM.Units[t]} {NUM.Puluh}{(r != 0 ? " " + NumberWords(r) : "")}";
        }
        if (n < 200) return $"{NUM.Seprefix}{NUM.Ratus}{(n % 100 != 0 ? " " + NumberWords(n % 100) : "")}";
        if (n < 1000)
        {
            int h = (int)(n / 100), r = (int)(n % 100);
            return $"{NUM.Units[h]} {NUM.Ratus}{(r != 0 ? " " + NumberWords(r) : "")}";
        }
        if (n < 2000) return $"{NUM.Seprefix}{NUM.Ribu}{(n % 1000 != 0 ? " " + NumberWords(n % 1000) : "")}";
        if (n < 1000000)
        {
            double th = Math.Floor(n / 1000), r = n % 1000;
            return $"{NumberWords(th)} {NUM.Ribu}{(r != 0 ? " " + NumberWords(r) : "")}";
        }
        double m = Math.Floor(n / 1000000), rr = n % 1000000;
        return $"{NumberWords(m)} {NUM.Juta}{(rr != 0 ? " " + NumberWords(rr) : "")}";
    }

    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        Percent = DEF.SymbolTier.Percent,
        Currency = DEF.SymbolTier.Currency,
        Units = DEF.SymbolTier.Units,
        ExponentWords = DEF.SymbolTier.ExponentWords,
        Magnitudes = DEF.SymbolTier.Magnitudes,
        Ampersand = DEF.SymbolTier.Ampersand,
        Multiply = DEF.SymbolTier.Multiply,
    });

    // The word group spans ALL of Latin, not just ASCII: with `[a-zA-Z]+` a diacritic ended the token and the
    // rest of the word restarted, so one name became three. `\p{M}` keeps a DECOMPOSED accent with its base.
    // The number group accepts Indonesian's DOT thousands grouping and COMMA decimal.
    private static readonly JsRe TOKEN =
        JsRegex.Compile("(\\p{Script=Latin}[\\p{Script=Latin}\\p{M}]*)|(\\d{1,3}(?:\\.\\d{3})+|\\d+(?:,\\d+)?)|([.?!,;:])", "gu");
    /**
     * An ordinary Indonesian word is plain ASCII letters. A diacritic means a FOREIGN name — Indonesian
     * orthography has none — so such a token goes to the injected foreign reader instead of the native g2p,
     * which has no rule for `ñ`/`ö`/`ó` and would mangle what it cannot spell.
     */
    private static readonly JsRe NATIVE_WORD = JsRegex.Compile("^[a-zA-Z]+$", "u");

    private static readonly JsRe GROUPING_DOT = JsRegex.Compile("\\.", "gu");

    private sealed class Engine : ILanguage
    {
        private readonly Func<string, string>? _foreign;
        internal Engine(Func<string, string>? foreign = null) => _foreign = foreign;

        public string Text(string input)
        {
            // Order: the Indonesian rewrites (clock, rupiah, abbreviations, slash units) run BEFORE the shared
            // symbol tier, and the clock must precede the number tokenizer so a dot-time is never read as
            // thousands grouping.
            return Clauses.AssembleClauses(SYMBOLS(Normalize.NormalizeIndonesian(input)), TOKEN, (m, sink) =>
            {
                if (m.Groups[1].Success && m.Groups[1].Value.Length > 0)
                    sink.Emit(NATIVE_WORD.IsMatch(m.Groups[1].Value) || _foreign is null
                        ? PhonemizeWord(m.Groups[1].Value)
                        : _foreign(m.Groups[1].Value));
                else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
                {
                    // Strip the dot grouping, then split on the decimal comma. Number words deliberately
                    // bypass the ⟨e⟩ lexicon (PhonemizeWordRules): their ⟨e⟩ is pepet, and a taling homograph
                    // would win otherwise.
                    var split = GROUPING_DOT.Replace(m.Groups[2].Value, "").Split(',');
                    var intPart = split[0];
                    var frac = split.Length > 1 ? split[1] : null;
                    var n = Js.Number(intPart);
                    // `n` is a JS `number` here as in the TS: past 2^53 the low digits are already gone, so
                    // composing a numeral would be confidently wrong. Digit-at-a-time instead — never a bare
                    // `return`, which used to make the whole number vanish from the reading.
                    if (double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d)
                        foreach (var wd in NumberWords(n).Split(' ')) sink.Emit(PhonemizeWordRules(wd));
                    else
                        foreach (var dch in intPart)
                            foreach (var wd in NumberWords(Js.Number(dch.ToString())).Split(' ')) sink.Emit(PhonemizeWordRules(wd));
                    if (frac is not null && frac != "")
                    {
                        var dot = DEF.Numbers.DecimalWord;
                        if (!string.IsNullOrEmpty(dot)) sink.Emit(PhonemizeWordRules(dot));
                        foreach (var d in frac)
                            foreach (var wd in NumberWords(Js.Number(d.ToString())).Split(' ')) sink.Emit(PhonemizeWordRules(wd));
                    }
                }
                else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
                {
                    var mk = CLAUSE_MARK.GetValueOrDefault(m.Groups[3].Value);
                    if (mk is not null) sink.Pause(mk);
                }
            });
        }
    }

    /**
     * Build the Indonesian phonemizer. `foreign` reads a token carrying a DIACRITIC — a foreign name, since
     * Indonesian orthography has none; the registry injects English. Without it the native g2p silently drops
     * the letter it cannot spell.
     */
    public static ILanguage CreateIndonesian(Func<string, string>? foreign = null) => new Engine(foreign);

    internal static void RegisterSelf() =>
        Registry.Register("indonesian", () => CreateIndonesian(Registry.ReadAsEnglish));
}

public sealed class IndonesianSymbolTier
{
    public IReadOnlyList<string> Percent { get; init; } = Array.Empty<string>();
    public IReadOnlyDictionary<string, IReadOnlyList<string>> Currency { get; init; } = new Dictionary<string, IReadOnlyList<string>>();
    public IReadOnlyDictionary<string, IReadOnlyList<string>> Units { get; init; } = new Dictionary<string, IReadOnlyList<string>>();
    public ExponentWordsDef ExponentWords { get; init; } = new();
    public IReadOnlyList<string> Magnitudes { get; init; } = Array.Empty<string>();
    public string Ampersand { get; init; } = "";
    public MultiplyDef Multiply { get; init; } = null!;
}
