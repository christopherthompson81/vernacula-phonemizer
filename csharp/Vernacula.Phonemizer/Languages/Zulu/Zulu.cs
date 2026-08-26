/**
 * Zulu (zu) phonemizer — canonical IPA (authored). Rule g2p + Nguni penultimate stress with vowel
 * LENGTHENING + a lexical TONE overlay from tone.tsv, plus the foreign/loan routing for embedded English.
 * Ported from src/languages/zulu/zulu.ts — see that file for the corpus evidence behind the three foreign
 * signals and the symbol tier's postposed order.
 */
using System.Text;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Zulu;

public sealed class ZuluPhonemizer : ILanguage
{
    private static IReadOnlyDictionary<string, string> TONE_CHAO => Manifest.MANIFEST.ToneChao;
    private static IReadOnlyDictionary<string, string> CLAUSE_MARK => Manifest.MANIFEST.ClausePunctuation;

    // Tone lexicon: word → per-vowel tone codes (H/L/F/R). Out-of-lexicon words are left untoned.
    private static Dictionary<string, string>? _tone;
    private static Dictionary<string, string> ToneLexicon() =>
        _tone ??= LoadTsv.LoadTsvMap("languages/zulu", "tone.tsv", (v, _) => v.Trim(), optional: true);

    private static readonly JsRe SPLIT = JsRegex.Compile("(?<=.)(?=[A-Z][a-z])", "u"); // compound boundary

    /** JS `String.prototype.slice` — clamping, never throwing, where .NET's range operator would. */
    private static string Slice(string s, int start, int end)
    {
        var a = Math.Clamp(start, 0, s.Length);
        var b = Math.Clamp(end, a, s.Length);
        return s[a..b];
    }

    /** Phonemize a (possibly camelCase-compound) Zulu word to an array of IPA words. */
    public static List<string> PhonemizeCompound(string word)
    {
        var parts = SPLIT.Re.Split(word);
        if (parts.Length == 1) return new List<string> { PhonemizeWord(word) };
        if (!ToneLexicon().TryGetValue(Js.ToLowerCase(word), out var codes))
            return parts.Select(p => PhonemizeWord(p, "")).ToList();
        var outp = new List<string>();
        var ci = 0;
        foreach (var p in parts)
        {
            var nv = G2p.ToSegments(p).Count(sg => sg.V);
            outp.Add(PhonemizeWord(p, Slice(codes, ci, ci + nv)));
            ci += nv;
        }
        return outp;
    }

    /** One Zulu word → canonical IPA: segments + penultimate stress/length + lexical tone overlay. */
    public static string PhonemizeWord(string word, string? toneCodes = null)
    {
        var segs = G2p.ToSegments(word);
        var vowelIdx = new List<int>();
        for (var i = 0; i < segs.Count; i++) if (segs[i].V) vowelIdx.Add(i);
        if (vowelIdx.Count == 0) return string.Concat(segs.Select(sg => sg.Ph));
        // Nguni penultimate stress: ˈ + ː on the penult vowel (the only vowel if monosyllabic).
        var stressIdx = vowelIdx.Count >= 2 ? vowelIdx[^2] : vowelIdx[0];
        var codes = toneCodes ?? (ToneLexicon().TryGetValue(Js.ToLowerCase(word), out var lex) ? lex : "");
        var sb = new StringBuilder();
        var vi = 0;
        for (var i = 0; i < segs.Count; i++)
        {
            var s = segs[i];
            if (s.V)
            {
                if (i == stressIdx) sb.Append('ˈ').Append(s.Ph).Append('ː');
                else sb.Append(s.Ph);
                // `codes[vi] ?? ""` — a JS string index past the end is undefined, which the lookup then misses.
                var key = vi < codes.Length ? codes[vi].ToString() : "";
                if (TONE_CHAO.TryGetValue(key, out var chao)) sb.Append(chao); // tone after the vowel (and its length)
                vi++;
            }
            else sb.Append(s.Ph);
        }
        return sb.ToString();
    }

    /** This language's OWN inventory — a token it REJECTS carries a letter Zulu does not use. */
    private const string NATIVE_CLASS = "[A-Za-z]";
    private static readonly Func<string, string> Nat = HostWord.MakeNativiser(NATIVE_CLASS, "u");

    // ⚠ ALL OF LATIN, not just this language's own letters — the narrow class ended the token at an
    // out-of-inventory diacritic and `São Paulo` fragmented into three pieces.
    private static readonly JsRe TOKEN = JsRegex.Compile($"({HostWord.LATIN_RUN})|(\\d+)|([.!?…,;:])", "gu");

    /** The shared SYMBOL tier — Zulu's loan plurals, ALL POSTPOSED. See the TS for why, and for why the
     *  rate is NOT here (`ngehora` is one agglutinated word; normalize.ts owns it). */
    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        Multiply = new MultiplyDef { Times = "kuphindwe ngo-" },
        Percent = new[] { "amaphesenti" },
        Currency = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["US$"] = new[] { "amadola" },
            ["AUD$"] = new[] { "amadola" },
            ["$"] = new[] { "amadola" },
            ["£"] = new[] { "amaphawundi" },
        },
        Units = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["km"] = new[] { "amakhilomitha" }, ["m"] = new[] { "amamitha" },
            ["mm"] = new[] { "amamilimitha" }, ["cm"] = new[] { "amasentimitha" },
            ["kg"] = new[] { "amakhilogremu" }, ["mi"] = new[] { "amamayela" },
            ["ft"] = new[] { "amafidi" },
        },
        ExponentWords = new ExponentWordsDef { Squared = new[] { "skwele" }, Position = ExponentPosition.After },
    });

    /** Nguni onsets — singles, digraphs and trigraphs. Used only by `IsNguniPossible`. */
    private static readonly IReadOnlySet<string> NGUNI_ONSET = new HashSet<string>(
        "bcdfghjklmnpqrstvwxyz".Select(c => c.ToString()).Concat(new[]
        {
            "bh", "ch", "dl", "dy", "fy", "gc", "gq", "gx", "hl", "kh", "kw", "gw", "hw", "mb", "mf", "mp",
            "mv", "nc", "nd", "ng", "nj", "nk", "nq", "nt", "nx", "ny", "nz", "ph", "qh", "sh", "th", "ts",
            "tsh", "tj", "ty", "xh", "zw", "sw", "shw", "bw", "ngc", "ngq", "ngx", "ntsh", "nkw", "ngw",
            "mbw", "ndw", "njw", "nyw", "hh", "dw", "tw", "kl", "pl", "qw", "cw", "xw",
        }), StringComparer.Ordinal);

    private static readonly JsRe VOWEL_FINAL = JsRegex.Compile("[aeiou]$", "u");
    private static readonly JsRe VOWEL_RUN = JsRegex.Compile("[aeiou]+", "u");
    private static readonly JsRe CLICK_LETTER = JsRegex.Compile("[cqx]", "u");

    /** Could this be a Nguni word at all? Vowel-final, and every consonant run a legal onset. */
    private static bool IsNguniPossible(string word)
    {
        if (!VOWEL_FINAL.IsMatch(word)) return false;
        return VOWEL_RUN.Re.Split(word).Where(r => r.Length > 0).All(NGUNI_ONSET.Contains);
    }

    /** Is this token foreign? THREE signals, all required — the click letter, an English-dictionary hit, and
     *  Nguni phonotactic impossibility. See the TS: each one alone corrupts real Nguni words. */
    public static bool IsForeignNguniWord(string word, Func<string, bool> isEnglishWord) =>
        CLICK_LETTER.IsMatch(word) && !IsNguniPossible(word) && isEnglishWord(word);

    private readonly Func<string, string>? _foreign;
    private readonly Func<string, bool>? _isEnglishWord;

    private ZuluPhonemizer(Func<string, string>? foreign, Func<string, bool>? isEnglishWord)
    {
        _foreign = foreign;
        _isEnglishWord = isEnglishWord;
    }

    public string Text(string input)
    {
        // normalize.ts FIRST, then the shared symbol tier — the era, clock, range, rate and degree steps all
        // need the number and its neighbour still adjacent, which the tier would break.
        return Clauses.AssembleClauses(SYMBOLS(Normalize.NormalizeZulu(input)), TOKEN, (m, sink) =>
        {
            if (m.Groups[1].Success && m.Groups[1].Value.Length > 0)
            {
                var w = m.Groups[1].Value;
                // ⚠ THE LOAN LEXICON RUNS BEFORE THE PHONOTACTIC TEST, because it exists precisely for the
                // words that test cannot decide — see NguniLoans.
                NguniLoans.NGUNI_LOANS.TryGetValue(Js.ToLowerCase(w), out var loan);
                if (loan == LoanReading.Foreign && _foreign is not null) sink.Emit(_foreign(w));
                else if (loan == LoanReading.Declick)
                    foreach (var part in PhonemizeCompound(Nat(NguniLoans.DeClick(Js.ToLowerCase(w))))) sink.Emit(part);
                // Foreign FIRST: a click letter inside an English word is not a click.
                else if (_foreign is not null && _isEnglishWord is not null &&
                         IsForeignNguniWord(Js.ToLowerCase(w), _isEnglishWord))
                    sink.Emit(_foreign(w));
                else foreach (var part in PhonemizeCompound(Nat(w))) sink.Emit(part);
            }
            // Numbers are ordinary Zulu nouns: tone them via the lexicon like any other word.
            else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
            {
                foreach (var wd in Numbers.NumberToWords(Js.Number(m.Groups[2].Value)).Split(' '))
                    sink.Emit(PhonemizeWord(wd));
            }
            else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
            {
                if (CLAUSE_MARK.TryGetValue(m.Groups[3].Value, out var mk) && mk.Length > 0) sink.Pause(mk);
            }
        });
    }

    /** Build the Zulu phonemizer. `foreign` reads an embedded English word; `isEnglishWord` is the English
     *  dictionary predicate the registry threads in (`knownWord(w) !== undefined`). */
    public static ILanguage CreateZulu(Func<string, string>? foreign = null, Func<string, bool>? isEnglishWord = null) =>
        new ZuluPhonemizer(foreign, isEnglishWord);

    internal static void RegisterSelf() =>
        Registry.Register("zulu", () => CreateZulu(Registry.ReadAsEnglish, w => Registry.EnglishKnownWord(w) is not null));
}
