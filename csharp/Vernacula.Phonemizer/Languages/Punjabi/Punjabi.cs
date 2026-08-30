/**
 * Native Punjabi (pa) text phonemizer — canonical IPA.
 * Ported from src/languages/punjabi/punjabi.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Punjabi;

public class PunjabiDef : AbugidaDef
{
    public NumbersDef Numbers { get; set; } = new();
    public Dictionary<string, string> ClausePunctuation { get; set; } = new();
    /** The shared symbol tier's data — see the jsonc, where the evidence lives. */
    public PunjabiSymbolTier SymbolTier { get; init; } = new();
    /** Ordinal suffixes, LONGEST FIRST — order is load-bearing. See the jsonc. */
    public IReadOnlyList<string> OrdinalSuffixes { get; init; } = Array.Empty<string>();
}

/** Variety options. Saraiki (skr) is the NON-tonal Lahnda sibling: it never underwent Punjabi's tonogenesis
 *  (it kept the voiced aspirates AND its aspirated sonorants — لھ→lʰ), and it writes retroflex ɳ explicitly
 *  (ݨ), so the plain-ن→ɳ infinitive heuristic must not fire. One flag toggles all three. */
public sealed class PunjabiOpts
{
    public bool Saraiki { get; init; }
    /** The variety's OWN short-vowel coverage lexicon, consulted by ShippedWord when Saraiki is set.
     *  Null for pa/pnb, which use the Punjabi lexicons. A thunk, so the file is read lazily. */
    public Func<IReadOnlyDictionary<string, string>>? WordLexicon { get; init; }
    /** The variety's OWN pre-tokenizer pass, replacing the Punjabi one. Saraiki supplies
     *  `normalizeSaraiki`; without it the `saraiki` flag leaves the text unnormalized (which is what it did
     *  before that layer existed — see the comment on `normalize` below). */
    public Func<string, string>? Normalize { get; init; }
}

/** The four entry points `makeNativePunjabi` returns. */
public sealed class NativePunjabiEngine
{
    public required Func<string, string> Word;
    public required Func<string, string> ShippedWord;
    public required Func<string, string> Number;
    public required Func<string, string> Text;
}

public static class PunjabiPhonemizer
{
    /** ⚠ ONE LOAD, MODULE-LEVEL. `LoadPunjabiManifest()` loaded the file per call; the symbol tier in
     *  Normalize.cs needs it too, so the load lands here and both read the same object — matching
     *  punjabi/manifest.ts on the TS side. */
    internal static readonly PunjabiDef DEF = LoadManifest.Load<PunjabiDef>("languages/punjabi", "punjabi.jsonc");

    private const string VOWEL = "əaɪiʊueɛoɔ";
    private static readonly JsRe VOWEL_G = JsRegex.Compile($"[{VOWEL}]", "g");
    private const string GURMUKHI_WORD = "਀-੿";
    private static readonly IReadOnlyDictionary<string, string> GURMUKHI_DIGITS = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["੦"] = "0", ["੧"] = "1", ["੨"] = "2", ["੩"] = "3", ["੪"] = "4",
        ["੫"] = "5", ["੬"] = "6", ["੭"] = "7", ["੮"] = "8", ["੯"] = "9",
    };
    private static readonly string DIGIT_CLASS = "0-9\\u0660-\\u0669\\u06F0-\\u06F9" + string.Concat(GURMUKHI_DIGITS.Keys);
    private const string ADDAK = "ੱ";
    private const string CONS_CLASS = "ਕ-ਹਖ਼-ੜ"; // Gurmukhi consonant range (for addak gemination)

    private static readonly IReadOnlyDictionary<string, string[]> BREATHY = new Dictionary<string, string[]>(StringComparer.Ordinal)
    {
        ["d͡ʒʱ"] = new[] { "t͡ʃ", "d͡ʒ" },
        ["ɡʱ"] = new[] { "k", "ɡ" },
        ["ɖʱ"] = new[] { "ʈ", "ɖ" },
        ["d̪ʱ"] = new[] { "t̪", "d̪" },
        ["bʱ"] = new[] { "p", "b" },
    };
    private static readonly string[] BREATHY_KEYS = BREATHY.Keys.OrderByDescending(k => k.Length).ToArray();
    private const string HIGH = "˥˩"; // high-falling tone (post-vocalic source)
    private const string LOW = "˨˩";  // low(-rising) tone (word-initial source)

    private static readonly JsRe VOWEL_RUN = JsRegex.Compile($"[{VOWEL}]ː?̃?", "gu");
    private static readonly JsRe VOWEL_HEAD = JsRegex.Compile($"^[{VOWEL}]ː?̃?", "u");

    /** Append a tone letter after the LAST vowel (+ length) already in `s`. */
    private static string ToneOnLastVowel(string s, string tone)
    {
        var ms = VOWEL_RUN.Matches(s);
        if (ms.Count == 0) return s;
        var m = ms[^1];
        var end = m.Index + m.Length;
        return s[..end] + tone + s[end..];
    }

    /** Punjabi tonogenesis: rewrite each breathy voiced-aspirate marker to its de-aspirated, TONED realization —
     *  voiceless + low tone in a word-initial onset, voiced + high tone post-vocalically. */
    private static string Tonogenesis(string ipa)
    {
        var @out = "";
        var i = 0;
        var seenVowel = false;
        while (i < ipa.Length)
        {
            var key = BREATHY_KEYS.FirstOrDefault(k => string.CompareOrdinal(ipa, i, k, 0, k.Length) == 0 && i + k.Length <= ipa.Length);
            if (key is not null)
            {
                var pair = BREATHY[key];
                if (!seenVowel)
                {
                    @out += pair[0];
                    i += key.Length;
                    var vm = VOWEL_HEAD.Match(ipa[i..]);
                    if (vm.Success)
                    {
                        @out += vm.Value + LOW;
                        i += vm.Value.Length;
                        seenVowel = true;
                    }
                }
                else
                {
                    @out = ToneOnLastVowel(@out, HIGH);
                    @out += pair[1];
                    i += key.Length;
                }
                continue;
            }
            var ch = ipa[i].ToString();
            if (VOWEL.Contains(ch, StringComparison.Ordinal)) seenVowel = true;
            @out += ch;
            i++;
        }
        return @out;
    }

    private static readonly JsRe GEMINATE = JsRegex.Compile(
        "(t͡ʃʰ|d͡ʒʱ|t͡ʃ|d͡ʒ|t̪ʰ|d̪ʱ|ɖʱ|ʈʰ|ɡʱ|kʰ|t̪|d̪|[kɡpbmnlsʃɾɽŋɳɭjɦʋʈɖqxzɣf])\\1(?!͡)", "gu");
    private static readonly JsRe ASP_AFTER_LENGTH = JsRegex.Compile("ː([ʰʱ])", "gu");
    private static readonly JsRe FINAL_SCHWA = JsRegex.Compile("ə$", "u");
    private static readonly JsRe N_PALATAL = JsRegex.Compile("n(?=t͡ʃ|d͡ʒ)", "gu");
    private static readonly JsRe N_RETROFLEX = JsRegex.Compile("n(?=ʈʰ|ɖʱ|[ʈɖɽ])", "gu");
    private static readonly JsRe N_VELAR = JsRegex.Compile("n(?=kʰ|ɡʱ|[kɡxɣq])", "gu");
    private static readonly JsRe INFINITIVE_NA = JsRegex.Compile("(?<![ɾɽ])n(aː)$", "u");
    private static readonly JsRe ASP_SONORANT = JsRegex.Compile("([nlmɳɭɽ])ʱ", "gu");
    private static readonly JsRe GLOTTAL = JsRegex.Compile("ʔ", "gu");

    public static NativePunjabiEngine MakeNativePunjabi(
        PunjabiDef def,
        Phonology? phon = null,
        Func<string, string>? foreign = null,
        PunjabiOpts? opts = null)
    {
        phon ??= PhonologyLoader.LoadSharedPhonology();
        opts ??= new PunjabiOpts();
        var g2p = Abugida.MakeAbugidaG2P(def, phon);
        var CLAUSE_MARK = def.ClausePunctuation;
        var addakRe = JsRegex.Compile($"{ADDAK}([{CONS_CLASS}]਼?)", "gu");
        // ⚠ THE FOREIGN ARM IS ALL OF LATIN plus marks, deliberately not `[A-Za-z]+`: an ASCII class ends the
        // token at a diacritic, and the letter carrying it is then read as an English LETTER NAME.
        var tokenRe = JsRegex.Compile(
            $"([{GURMUKHI_WORD}{Shahmukhi.SHAHMUKHI_CLASS}]+)|(\\p{{Script=Latin}}[\\p{{Script=Latin}}\\p{{M}}]*)|([{DIGIT_CLASS}]+)|([।॥.?!,;:۔؟،؛])",
            "gu");

        string Word(string w)
        {
            var isShah = Shahmukhi.SHAHMUKHI_WORD.IsMatch(w);
            var x = isShah
                ? Shahmukhi.ScanShahmukhi(w)
                : g2p(addakRe.Replace(Js.Normalize(w, System.Text.NormalizationForm.FormC), "$1੍$1"));
            x = ASP_AFTER_LENGTH.Replace(GEMINATE.Replace(x, "$1ː"), "$1ː");
            var syls = VOWEL_G.Matches(x).Count;
            if (syls >= 2) x = FINAL_SCHWA.Replace(x, "");
            x = Schwa.DeleteMedialSchwa(x);
            x = N_VELAR.Replace(N_RETROFLEX.Replace(N_PALATAL.Replace(x, "ɲ"), "ɳ"), "ŋ");
            // SHAHMUKHI-ONLY: the infinitive/causative ending is retroflex -ɳaː except after a rhotic, a split
            // Gurmukhi spells orthographically (ਣ vs ਨ) and Shahmukhi writes with an ambiguous plain ن. Saraiki
            // writes retroflex ɳ explicitly, so a plain ن there is unambiguously [n] — hence the gate.
            if (isShah && !opts.Saraiki) x = INFINITIVE_NA.Replace(x, "ɳ$1");
            if (!opts.Saraiki) x = Tonogenesis(x);
            // Punjabi has no aspirated SONORANTS and no phonemic /ʔ/ (the loan letters ع/ء are silent). Both
            // are no-ops for Gurmukhi input, whose scanner produces neither. Saraiki KEEPS aspirated sonorants.
            if (!opts.Saraiki) x = ASP_SONORANT.Replace(x, "$1");
            x = GLOTTAL.Replace(x, "");
            return WeightStress.ApplyWeightStress(x).Normalize(System.Text.NormalizationForm.FormC);
        }

        /**
         * The SHIPPED word path: the lexicon tiers in front of the rule engine, in precedence order — mined
         * Gurmukhi exceptions → cross-script gold → harakat restore → `Word`. `Word` itself stays lexicon-free
         * on purpose, because `PhonemizeWordCore` and the mining tool depend on that. Saraiki is gated off:
         * these are Punjabi lexicons, and skr shares only the factory.
         */
        string ShippedWord(string w)
        {
            // The variety supplies its own coverage tier via WordLexicon; the Punjabi lexicons stay gated
            // off (Gurmukhi keys, pa cross-script pairs). Without the hook skr's documented word path was
            // unreachable from Text() — see the TS for the account.
            if (opts.Saraiki)
                return Word(opts.WordLexicon is null ? w : HarakatLexicon.RestoreHarakat(w, opts.WordLexicon()));
            if (GuruLexicon().TryGetValue(w, out var g)) return g;
            if (CrossScriptLexicon().TryGetValue(w, out var c)) return c;
            return Word(HarakatLexicon.RestoreHarakat(w, HarakatLex()));
        }

        string ToAscii(string d) =>
            string.Concat(Js.CodePoints(d).Select(c => GURMUKHI_DIGITS.GetValueOrDefault(c) ?? Shahmukhi.ShahmukhiDigit(c) ?? c));

        string Number(string digits)
        {
            var n = Js.Number(ToAscii(digits));
            // ⚠ ABOVE 2^53 THE DIGITS MUST STILL BE READ OUT, not returned raw — the `double` has already lost
            // the low digits, so composing a numeral would be confidently wrong, but a bare digit string is
            // something no g2p in this fleet reads. Spell it digit-at-a-time instead.
            if (!(double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d))
                return Core.Numbers.SpellDigits(ToAscii(digits), def.Numbers, Word);
            return Core.Numbers.RenderNumber(n, def.Numbers, Word);
        }

        // GATED OFF FOR SARAIKI: the Punjabi pass EMITS PUNJABI WORDS, and skr builds on this same factory.
        // The variety may supply its own via `opts.Normalize`; the identity fallback is the behaviour that
        // shipped while no such layer existed.
        var normalize = opts.Normalize ?? (opts.Saraiki ? new Func<string, string>(s => s) : Normalize.MakePunjabiNormalizer(def.Numbers));

        string Text(string input)
        {
            // Fold this script's own digits to ASCII first: the number token is digit-class-based and the TS
            // `\d` is ASCII-only, so a numeral written in native digits matched NO token and was dropped
            // entirely. Runs BEFORE `normalize`, whose patterns are all written against ASCII digits.
            return Clauses.AssembleClauses(normalize(Unicode.FoldNativeDigits(input)), tokenRe, (m, sink) =>
            {
                if (m.Groups[1].Success && m.Groups[1].Value.Length > 0) sink.Emit(ShippedWord(m.Groups[1].Value));
                else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0) sink.Emit(foreign is not null ? foreign(m.Groups[2].Value) : "");
                else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0) sink.Emit(Number(m.Groups[3].Value));
                else if (m.Groups[4].Success && m.Groups[4].Value.Length > 0)
                {
                    var mk = CLAUSE_MARK.GetValueOrDefault(m.Groups[4].Value) ?? Shahmukhi.ShahmukhiPause(m.Groups[4].Value);
                    if (mk is not null) sink.Pause(mk);
                }
            });
        }

        return new NativePunjabiEngine { Word = Word, ShippedWord = ShippedWord, Number = Number, Text = Text };
    }

    // COVERAGE layer: mined Shahmukhi skeletons are vocalized before g2p; Gurmukhi input has no harakat keys
    // and passes through unchanged. Loaded LAZILY on purpose — the registry constructs every language eagerly,
    // so an eager load would read this TSV on every startup.
    private static Dictionary<string, string>? LEXICON;
    public static IReadOnlyDictionary<string, string> HarakatLex() =>
        LEXICON ??= HarakatLexicon.LoadHarakatLexicon("languages/punjabi");

    private static NativePunjabiEngine? PA;

    /** Lexicon-FREE core: bare word→IPA. Used by the mining tool, which must NOT consult the content lexicon
     *  (mining candidates would collide with content homographs). The number path reaches it via the `Word`
     *  closure. */
    public static string PhonemizeWordCore(string w) =>
        (PA ??= MakeNativePunjabi(LoadPunjabiManifest())).Word(w);

    /** The Punjabi manifest — reused by the Saraiki (skr) module, which shares the Shahmukhi front-end and Lahnda
     *  phonology (Gurmukhi g2p unused; numbers deferred to a skr manifest). */
    public static PunjabiDef LoadPunjabiManifest() =>
        LoadManifest.Load<PunjabiDef>("languages/punjabi", "punjabi.jsonc");

    private static Dictionary<string, string>? CROSS;
    public static IReadOnlyDictionary<string, string> CrossScriptLexicon() =>
        CROSS ??= LoadTsv.LoadTsvMap("languages/punjabi", "crossscript.tsv", optional: true);

    /**
     * Bare word→IPA for the REFEREE EVAL: cross-script gold → coverage-lexicon restore → the lexicon-free core.
     * ⚠ THIS MUST NEVER CONSULT `GuruLexicon` — that lexicon is MINED FROM the referee it is scored against.
     * The cross-script layer stays: its readings come from our own g2p over the voweled sister-spelling.
     */
    public static string PhonemizeWordEval(string w) =>
        CrossScriptLexicon().TryGetValue(w, out var c)
            ? c
            : PhonemizeWordCore(HarakatLexicon.RestoreHarakat(w, HarakatLex()));

    private static Dictionary<string, string>? GURU;
    public static IReadOnlyDictionary<string, string> GuruLexicon() =>
        GURU ??= LoadTsv.LoadTsvMap("languages/punjabi", "gurmukhi-lexicon.tsv", optional: true);

    /** Bare word→IPA, SHIPPED: the mined Gurmukhi exceptions lexicon first (keys are Gurmukhi script, so
     *  Shahmukhi input never matches), then the eval path. */
    public static string PhonemizeWord(string w) =>
        GuruLexicon().TryGetValue(w, out var g) ? g : PhonemizeWordEval(w);

    private sealed class Engine : ILanguage
    {
        private readonly NativePunjabiEngine _engine;
        internal Engine(NativePunjabiEngine engine) => _engine = engine;
        public string Text(string input) => _engine.Text(input);
    }

    /** Build the Punjabi phonemizer. `foreign` handles embedded Latin. */
    public static ILanguage CreatePunjabi(Func<string, string>? foreign = null) =>
        new Engine(MakeNativePunjabi(LoadPunjabiManifest(), PhonologyLoader.LoadSharedPhonology(), foreign));

    internal static void RegisterSelf()
    {
        Registry.Register("punjabi", () => CreatePunjabi(Registry.ReadAsEnglish));
        RiderNeural.RegisterRider("pa", HarakatLex);
    }
}

public sealed class PunjabiSymbolTier
{
    public IReadOnlyList<string> Percent { get; init; } = Array.Empty<string>();
    public IReadOnlyDictionary<string, IReadOnlyList<string>> Currency { get; init; } = new Dictionary<string, IReadOnlyList<string>>();
    public IReadOnlyDictionary<string, IReadOnlyList<string>> Units { get; init; } = new Dictionary<string, IReadOnlyList<string>>();
    public ExponentWordsDef ExponentWords { get; init; } = new();
    public IReadOnlyList<string> Magnitudes { get; init; } = Array.Empty<string>();
    public string Ampersand { get; init; } = "";
    public MultiplyDef Multiply { get; init; } = null!;
}
