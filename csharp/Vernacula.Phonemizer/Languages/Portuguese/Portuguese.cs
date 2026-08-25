/**
 * European Portuguese (pt-PT) phonemizer — canonical IPA.
 * Ported from src/languages/portuguese/portuguese.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Portuguese;

public sealed class Corr
{
    public string? Open;
    public string? X;
    public string? InitE;
}

public static class PortuguesePhonemizer
{
    private static Dictionary<string, Corr>? LEXICON;

    /** Parse a correction code cell (e.g. "ɛ|x:s") into a Corr. */
    private static Corr ParseCorr(string cell)
    {
        var corr = new Corr();
        foreach (var code in cell.Split('|'))
        {
            if (code == "ɛ" || code == "ɔ") corr.Open = code;
            else if (code.StartsWith("x:", StringComparison.Ordinal)) corr.X = code[2..];
            else if (code.StartsWith("e:", StringComparison.Ordinal)) corr.InitE = code[2..]; // word-initial e is e/ɛ (not the i default)
        }
        return corr;
    }

    private static Dictionary<string, Corr> Lexicon()
    {
        if (LEXICON is null)
        {
            // Generated table first, then the hand-curated supplement, which OVERRIDES it.
            LEXICON = LoadTsv.LoadTsvMap<Corr>("languages/portuguese", "lexicon.tsv", (v, _) => ParseCorr(v), optional: true);
            foreach (var (k, v) in LoadTsv.LoadTsvMap<Corr>("languages/portuguese", "lexicon-manual.tsv", (v, _) => ParseCorr(v), optional: true))
                LEXICON[k] = v;
        }
        return LEXICON;
    }

    private static IReadOnlyDictionary<string, string> REDUCE => Manifest.MANIFEST.Reduce;
    private static IReadOnlyDictionary<string, string> NASAL => Manifest.MANIFEST.Nasal;

    private static readonly JsRe FINAL_S = JsRegex.Compile("s$", "");
    private static readonly JsRe FINAL_TILDE_VOWEL = JsRegex.Compile("[ãõ]$", "");
    private static readonly JsRe FINAL_NASAL_DIPHTHONG = JsRegex.Compile("(ão|ãe|õe)$", "");
    private static readonly JsRe FINAL_IM_UM = JsRegex.Compile("[iu][mn]$", "");

    /** Index of the stressed nucleus. Written accent wins; else oxytone (final nucleus) when the word — ignoring a
     *  final -s — ends in r/l/z/x, i/u, a nasal tilde vowel / diphthong, or -im/-um; else paroxytone (penult). */
    private static int StressedNucleus(string word, List<Seg> segs)
    {
        var nuclei = segs.Select((s, i) => s.Nucleus ? i : -1).Where(i => i >= 0).ToList();
        if (nuclei.Count == 0) return -1;
        foreach (var i in nuclei)
            if (segs[i].Accent)
                return i;
        if (nuclei.Count == 1) return nuclei[0];
        var w = FINAL_S.Replace(word.ToLowerInvariant(), "");
        var wcs = Js.CodePoints(w);
        var last = wcs.Count > 0 ? wcs[^1] : "";
        var oxytone =
            "lrzx".Contains(last, StringComparison.Ordinal) ||
            last == "i" ||
            last == "u" ||
            last == "í" ||
            last == "ú" ||
            FINAL_TILDE_VOWEL.IsMatch(w) ||
            FINAL_NASAL_DIPHTHONG.IsMatch(w) ||
            FINAL_IM_UM.IsMatch(w); // -im/-um and their -ins/-uns plurals (s already stripped)
        return oxytone ? nuclei[^1] : nuclei[^2];
    }

    private static bool IsGlidePh(string ph) => ph == "j" || ph == "w" || ph == "j̃" || ph == "w̃";

    private static readonly IReadOnlySet<string> LIQUID =
        new HashSet<string>(Manifest.MANIFEST.Liquids, StringComparer.Ordinal);

    /** Post-stress onglide demotion: an UNSTRESSED i/u/e before another nucleus is a rising glide. ⚠ ⟨e⟩ IS
     *  DEMOTED — the docstring here and in the TS claimed it was not, and sat on `LIQUID` besides; corrected
     *  in src/languages/portuguese/portuguese.ts, which carries the finding. */
    private static void Onglides(List<Seg> segs, int stress)
    {
        for (var i = 0; i < segs.Count; i++)
        {
            var s = segs[i];
            if (!s.Nucleus || i == stress || (s.Raw != "i" && s.Raw != "u" && s.Raw != "e")) continue;
            var next = i + 1 < segs.Count ? segs[i + 1] : null;
            if (next is null || !next.Nucleus) continue;
            if (i + 1 == stress && (next.Raw == "i" || next.Raw == "u")) continue;
            var p1 = i - 1 >= 0 ? segs[i - 1] : null;
            var p2 = i - 2 >= 0 ? segs[i - 2] : null;
            if (p1 is not null && p2 is not null && LIQUID.Contains(p1.Ph) && !p2.Nucleus) continue;
            s.Nucleus = false;
            s.Ph = s.Raw == "u" ? "w" : "j"; // i/e → j, u → w
        }
    }

    private static readonly IReadOnlyDictionary<string, string> REDUCE_BP_FINAL =
        new Dictionary<string, string>(StringComparer.Ordinal) { ["a"] = "ɐ", ["e"] = "i", ["o"] = "u" };
    // REDUCE_BP_MID is identity ON PURPOSE: BP raises only the FINAL atonic vowel, so pretonic/postonic-medial
    // vowels keep their mid quality. Do not collapse it into "no reduction" — the two positions are split here.
    private static readonly IReadOnlyDictionary<string, string> REDUCE_BP_MID =
        new Dictionary<string, string>(StringComparer.Ordinal) { ["a"] = "a", ["e"] = "e", ["o"] = "o" };

    /**
     * Realize vowels: reduce unstressed oral vowels, nasalize nasal ones, mark the stressed nucleus with ˈ.
     */
    private static string Realize(List<Seg> segs, int stress, string dialect = "ep")
    {
        var @out = "";
        for (var i = 0; i < segs.Count; i++)
        {
            var s = segs[i];
            var ph = s.Ph;
            var nextSeg = i + 1 < segs.Count ? segs[i + 1] : null;
            var diphthong = nextSeg is not null && !nextSeg.Nucleus && IsGlidePh(nextSeg.Ph); // nucleus + offglide
            if (s.Nucleus && i != stress && !s.Nasal && !diphthong && s.Raw != "")
            {
                var beforeDarkL = nextSeg?.Ph == "ɫ";
                if (dialect == "bp")
                {
                    var isFinal = !segs.Skip(i + 1).Any(x => x.Nucleus); // last atonic nucleus = raises
                    ph = beforeDarkL
                        ? s.Raw == "a"
                            ? "a"
                            : s.Raw == "e"
                              ? "e" // BP keeps unstressed ⟨e⟩ CLOSE before coda-l (the -ável/-ível suffix → [avew], not
                              :     // the EP [avɛw]); the l→w step then gives [ew]. (EP opens it to [ɛ].)
                                s.Raw == "o"
                                ? "o" // ⟨o⟩ keeps mid quality before coda-l → the l→w step gives [ow] (soldado → sowdadu)
                                : ph // ⟨i⟩/⟨u⟩ before coda-l keep their quality (fácil → fasiw, útil → ut͡ʃiw)
                        : ((isFinal ? REDUCE_BP_FINAL : REDUCE_BP_MID).GetValueOrDefault(s.Raw) ?? ph);
                }
                else
                {
                    ph =
                        beforeDarkL && s.Raw == "a"
                            ? "a"
                            : beforeDarkL && s.Raw == "e"
                              ? "ɛ"
                              : i == 0 && s.Raw == "e"
                                ? "i"
                                : (REDUCE.GetValueOrDefault(s.Raw) ?? ph);
                }
            }
            if (dialect == "bp" && i == stress && !s.Accent && !s.Nasal && (ph == "ɔ" || ph == "ɛ"))
            {
                var nx = nextSeg;
                if (nx is not null && !nx.Nucleus && (nx.Ph == "m" || nx.Ph == "n" || nx.Ph == "ɲ"))
                    ph = ph == "ɔ" ? "o" : "e";
            }
            if (s.Nasal && s.Nucleus) ph = NASAL.GetValueOrDefault(ph) ?? ph;
            if (i == stress) @out += "ˈ";
            @out += ph;
        }
        return @out;
    }

    /** Apply a lexical correction: open the stressed mid vowel (e→ɛ / o→ɔ) and/or override grapheme x. */
    private static void Correct(List<Seg> segs, int stress, Corr corr)
    {
        if (corr.Open is not null && stress >= 0 && stress < segs.Count)
        {
            var close = corr.Open == "ɛ" ? "e" : "o";
            if (segs[stress].Ph == close) segs[stress].Ph = corr.Open;
        }
        if (corr.X is not null)
            foreach (var s in segs)
                if (s.Raw == "x")
                    s.Ph = corr.X;
        // raw="" so Realize leaves ph untouched: the word-initial e keeps this quality instead of i-raising.
        if (corr.InitE is not null && segs.Count > 0 && segs[0].Nucleus && segs[0].Raw == "e")
        {
            segs[0].Ph = corr.InitE;
            segs[0].Raw = "";
        }
    }

    /**
     * Core: EP word → canonical IPA, applying an explicit correction (used by the lexicon and its generator).
     */
    public static string RenderWord(string word, Corr? corr = null, string dialect = "ep")
    {
        var segs = G2p.ToSegments(word, dialect);
        if (segs.Count == 0) return "";
        G2p.Sibilants(segs, dialect);
        var stress = StressedNucleus(word, segs);
        Onglides(segs, stress);
        if (corr is not null) Correct(segs, stress, corr);
        var ipa = Realize(segs, stress, dialect);
        return dialect == "bp" ? BpConsonants(ipa) : ipa;
    }

    private static readonly JsRe BP_T_AFFRICATE = JsRegex.Compile("t([ˈˌ]?[iĩj])", "gu");
    private static readonly JsRe BP_D_AFFRICATE = JsRegex.Compile("d([ˈˌ]?[iĩj])", "gu");
    private static readonly JsRe BP_DARK_L = JsRegex.Compile("ɫ", "gu");

    /**
     * BP consonant surface rules on the realized string: /t d/ affricate before [i]/[ĩ]/[j], and coda [ɫ]
     * vocalizes to [w]. Runs after realization, where those triggers are unambiguous.
     */
    private static string BpConsonants(string ipa) =>
        BP_DARK_L.Replace(BP_D_AFFRICATE.Replace(BP_T_AFFRICATE.Replace(ipa, "t͡ʃ$1"), "d͡ʒ$1"), "w");

    /** One word → canonical IPA: rule engine + the lexical correction table (open/close vowels, x). `dialect` selects
     *  European (default) or Brazilian realization; the open/close correction lexicon is shared (EP-derived,
     *  mostly valid for BP — a small lexical tail where the dialects differ on a stressed mid vowel). */
    public static string PhonemizeWord(string word, string dialect = "ep") =>
        RenderWord(word, Lexicon().GetValueOrDefault(word.ToLowerInvariant()), dialect);

    private static IReadOnlyDictionary<string, string> CLAUSE_MARK => Manifest.MANIFEST.ClausePunctuation;
    private static readonly JsRe TOKEN = JsRegex.Compile("([a-zà-ÿ]+)|(\\d+(?:\\.\\d+)*(?:,\\d+)?)|([.!?…,;:])", "giu");

    private static readonly JsRe DOT_G = JsRegex.Compile("\\.", "g");

    /** A number token (thousands-dots / decimal-comma) → spoken words. `dialect` selects the BP teen forms (16/17/19
     *  dez-e- vs the EP dez-a-). */
    private static string NumberTokenToWords(string tok, string dialect)
    {
        var split = tok.Split(',');
        var intRaw = split[0];
        var frac = split.Length > 1 ? split[1] : null;
        var words = Numbers.NumberToWords(Js.Number(DOT_G.Replace(intRaw, "")), dialect);
        if (frac is not null)
            words +=
                $" {Manifest.MANIFEST.Numbers.DecimalConnector} " +
                string.Join(" ", frac.Select(d => Numbers.NumberToWords(Js.Number(d.ToString()), dialect)));
        return words;
    }

    private static readonly IReadOnlySet<string> FUNCTION_WORDS =
        new HashSet<string>(Manifest.MANIFEST.FunctionWords, StringComparer.Ordinal);

    /** `postWord`, if given, refines a resolved word's IPA with its (lowercased) source word — the hook the pt-BR
     *  variant uses to apply its BP open/close override lexicon while reusing this engine's number/clause
     *  context. */
    private static string WordIpa(string word, string dialect, Func<string, string, string>? postWord)
    {
        var ipa = PhonemizeWord(word, dialect);
        if (postWord is not null) ipa = postWord(ipa, word.ToLowerInvariant());
        return FUNCTION_WORDS.Contains(word.ToLowerInvariant()) ? Js.ReplaceFirst(ipa, "ˈ", "") : ipa;
    }

    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        // ⚠ ONE SOURCE with Normalize.cs, which applies the other seven signs in positions this tier does not
        // reach. See portuguese.jsonc `signWords` for the register argument behind `vezes` and the corpus
        // count behind `e` (×1118).
        Multiply = new MultiplyDef { Times = Manifest.MANIFEST.SignWords.Times },
        Ampersand = Manifest.MANIFEST.SignWords.Ampersand,
        Percent = Manifest.MANIFEST.Symbols.Percent,
        Currency = Manifest.MANIFEST.Symbols.Currency,
        Units = Manifest.MANIFEST.Symbols.Units,
        ExponentWords = Manifest.MANIFEST.Symbols.ExponentWords,
        BareExponent = Manifest.MANIFEST.Symbols.BareExponent,
        Magnitudes = Manifest.MANIFEST.Symbols.Magnitudes,
        MagnitudeConnective = Manifest.MANIFEST.Symbols.MagnitudeConnective, // cinco milhões DE dólares
    });

    private sealed class PortugueseEngine : ILanguage
    {
        private readonly string _dialect;
        private readonly Func<string, string, string>? _postWord;

        public PortugueseEngine(string dialect = "ep", Func<string, string, string>? postWord = null)
        {
            _dialect = dialect;
            _postWord = postWord;
        }

        public string Text(string input)
        {
            var d = _dialect;
            var pw = _postWord;
            // Order: Portuguese rewrites (abbreviations, era markers, ordinal indicators, clock, R$) →
            // initialisms → the shared symbol tier LAST, since the clock rule has already claimed the hour.
            var normalized = SYMBOLS(Normalize.NormalizePortugueseInitialisms(
                Normalize.NormalizePortuguese(input, _dialect == "bp")));
            return Clauses.AssembleClauses(normalized, TOKEN, (m, sink) =>
            {
                if (m.Groups[1].Success && m.Groups[1].Value.Length > 0) sink.Emit(WordIpa(m.Groups[1].Value, d, pw));
                else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
                    sink.Emit(string.Join(" ", NumberTokenToWords(m.Groups[2].Value, d)
                        .Split(' ')
                        .Select(w => WordIpa(w, d, pw))));
                else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
                {
                    var mk = CLAUSE_MARK.GetValueOrDefault(m.Groups[3].Value);
                    if (mk is not null) sink.Pause(mk);
                }
            });
        }
    }

    /** Build the Portuguese phonemizer (no data files — fully rule-based). `dialect` selects European (default) or
     *  Brazilian ("bp") realization; `postWord` is an optional per-word IPA refinement (the BP open/close
     *  lexicon). See src/languages/portuguese-br for the BP accent-variant entry points. */
    public static ILanguage CreatePortuguese(string dialect = "ep", Func<string, string, string>? postWord = null) =>
        new PortugueseEngine(dialect, postWord);

    internal static void RegisterSelf()
    {
        Registry.Register("portuguese", () => CreatePortuguese());
        Registry.RegisterRomanPolicy("pt", RomanOrdinals.ROMAN_POLICY);
    }
}
