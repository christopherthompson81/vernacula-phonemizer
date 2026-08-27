/**
 * Xhosa (xh, isiXhosa) phonemizer — canonical IPA (authored). The Nguni sibling of Zulu: it REUSES the shared
 * Zulu g2p scan with the Xhosa rule table (⟨rh⟩→[x]) and the Nguni penultimate-stress-with-lengthening logic.
 * Tone is lexical and unwritten, so it is DEFERRED — words are left untoned.
 * Ported from src/languages/xhosa/xhosa.ts — see that file for the corpus evidence behind the three foreign
 * signals, the symbol tier's declarations, and why this language needs a foreign reader at all.
 */
using System.Text;
using Vernacula.Phonemizer.Core;
using Vernacula.Phonemizer.Languages.Zulu;

namespace Vernacula.Phonemizer.Languages.Xhosa;

public sealed class XhosaPhonemizer : ILanguage
{
    private static IReadOnlyDictionary<string, string> CLAUSE_MARK => Manifest.MANIFEST.ClausePunctuation;

    /** One Xhosa word → canonical IPA: shared Nguni segments + penultimate stress/length (tone deferred). */
    public static string PhonemizeWord(string word)
    {
        var segs = G2p.ToSegments(word, Manifest.RULES);
        var vowelIdx = new List<int>();
        for (var i = 0; i < segs.Count; i++) if (segs[i].V) vowelIdx.Add(i);
        if (vowelIdx.Count == 0) return string.Concat(segs.Select(s => s.Ph));
        // Nguni penultimate stress: ˈ + ː on the penult vowel (the only vowel if monosyllabic).
        var stressIdx = vowelIdx.Count >= 2 ? vowelIdx[^2] : vowelIdx[0];
        var sb = new StringBuilder();
        for (var i = 0; i < segs.Count; i++)
        {
            var s = segs[i];
            if (s.V && i == stressIdx) sb.Append('ˈ').Append(s.Ph).Append('ː');
            else sb.Append(s.Ph);
        }
        return sb.ToString();
    }

    /** This language's OWN inventory — a token it REJECTS carries a letter Xhosa does not use. */
    private const string NATIVE_CLASS = "[A-Za-z]";
    private static readonly Func<string, string> Nat = HostWord.MakeNativiser(NATIVE_CLASS, "u");

    // ⚠ ALL OF LATIN, not just this language's own letters — the narrow class ended the token at an
    // out-of-inventory diacritic and `São Paulo` fragmented into three pieces.
    private static readonly JsRe TOKEN = JsRegex.Compile($"({HostWord.LATIN_RUN})|(\\d+)|([.!?…,;:])", "gu");

    /** The shared SYMBOL tier — Xhosa's class-10 loan plurals. See the TS for the `US$` compound key, the
     *  `¥` composition it flags, and why the rate is NOT here (normalize.ts owns it). */
    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        Multiply = new MultiplyDef { Times = "phindaphinda" },
        Percent = new[] { "iipesenti" },
        Currency = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["US$"] = new[] { "iidola zaseMelika" }, ["AUD$"] = new[] { "iidola" },
            ["$"] = new[] { "iidola" }, ["£"] = new[] { "iiponti" }, ["¥"] = new[] { "iiyeni" },
        },
        Units = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["km"] = new[] { "iikhilomitha" }, ["m"] = new[] { "iimitha" }, ["cm"] = new[] { "iisentimitha" },
            ["mm"] = new[] { "iimilimitha" }, ["mi"] = new[] { "iimayile" }, ["kg"] = new[] { "iikhilogram" },
        },
        Magnitudes = Normalize.MAGNITUDES.ToList(),
        ExponentWords = new ExponentWordsDef { Squared = new[] { "isikwere", "izikwere" }, Position = ExponentPosition.After },
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

    /** Is this token foreign? THREE signals, all required — a click letter, an English-dictionary hit, and
     *  Nguni phonotactic impossibility. See the TS: each one alone corrupts real Nguni words. */
    public static bool IsForeignNguniWord(string word, Func<string, bool> isEnglishWord) =>
        CLICK_LETTER.IsMatch(word) && !IsNguniPossible(word) && isEnglishWord(word);

    private readonly Func<string, string>? _foreign;
    private readonly Func<string, bool>? _isEnglishWord;

    private XhosaPhonemizer(Func<string, string>? foreign, Func<string, bool>? isEnglishWord)
    {
        _foreign = foreign;
        _isEnglishWord = isEnglishWord;
    }

    public string Text(string input)
    {
        // normalize.ts runs BEFORE the shared tier, and leaves every operand as DIGITS precisely so the tier
        // can still see number–unit adjacency — the clock being the one exception.
        return Clauses.AssembleClauses(SYMBOLS(Normalize.NormalizeXhosa(input)), TOKEN, (m, sink) =>
        {
            if (m.Groups[1].Success && m.Groups[1].Value.Length > 0)
            {
                var w = m.Groups[1].Value;
                // ⚠ THE LOAN LEXICON RUNS BEFORE THE PHONOTACTIC TEST, because it exists precisely for the
                // words that test cannot decide — see NguniLoans.
                NguniLoans.NGUNI_LOANS.TryGetValue(Js.ToLowerCase(w), out var loan);
                if (loan == LoanReading.Foreign && _foreign is not null) sink.Emit(_foreign(w));
                else if (loan == LoanReading.Declick) sink.Emit(PhonemizeWord(Nat(NguniLoans.DeClick(Js.ToLowerCase(w)))));
                // Foreign FIRST: a click letter in an English word is not a click.
                else if (_foreign is not null && _isEnglishWord is not null &&
                         IsForeignNguniWord(Js.ToLowerCase(w), _isEnglishWord))
                    sink.Emit(_foreign(w));
                else sink.Emit(PhonemizeWord(Nat(w)));
            }
            // ⚠ THE TOKEN STRING GOES WITH THE DOUBLE (#1059): above 2^53 `Number(m[2])` has already lost
            // digits, and the match is the separator-stripped run (normalize de-groups the text).
            else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
            {
                var raw = m.Groups[2].Value;
                foreach (var wd in Numbers.NumberToWords(Js.Number(raw), raw).Split(' ')) sink.Emit(PhonemizeWord(wd));
            }
            else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
            {
                if (CLAUSE_MARK.TryGetValue(m.Groups[3].Value, out var mk) && mk.Length > 0) sink.Pause(mk);
            }
        });
    }

    /** Build the Xhosa phonemizer. `foreign` reads an embedded English word; `isEnglishWord` is the English
     *  dictionary predicate the registry threads in (`knownWord(w) !== undefined`). */
    public static ILanguage CreateXhosa(Func<string, string>? foreign = null, Func<string, bool>? isEnglishWord = null) =>
        new XhosaPhonemizer(foreign, isEnglishWord);

    internal static void RegisterSelf() =>
        Registry.Register("xhosa", () => CreateXhosa(Registry.ReadAsEnglish, w => Registry.EnglishKnownWord(w) is not null));
}
