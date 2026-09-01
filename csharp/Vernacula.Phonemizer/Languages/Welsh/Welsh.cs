/**
 * Welsh (cy) phonemizer — canonical IPA, Northern-leaning. Rule-based g2p (G2p.cs) + PENULTIMATE stress +
 * the Welsh vowel-length rule. A stressed monophthong in a long context — open, or before a single
 * voiced/fricative coda — takes full length (ː) in a monosyllable/final syllable (mis → miːs); in a penult
 * it stays SHORT and LAX (pobol → pɔbɔl, nesaf → nɛsav).
 *
 * Ported from src/languages/welsh/welsh.ts — see that file for the corpus evidence.
 */
using System.Text;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Welsh;

public sealed class WelshPhonemizer : ILanguage
{
    // LEXICON (lexicon.tsv, kaikki/Wiktionary NW-derived): pronunciations the rules mis-derive — per-word
    // ⟨ae⟩/⟨ai⟩ diphthong QUALITY (aeres→eɨ), lexical ⟨y⟩-obscure/clear irregularities, loan vowels,
    // monosyllable length. Lazily loaded so merely importing this module does not parse the TSV.
    private static IReadOnlyDictionary<string, string>? LEX;
    private static IReadOnlyDictionary<string, string> Lexicon() =>
        LEX ??= LoadTsv.LoadTsvMap("languages/welsh", "lexicon.tsv", optional: true);

    private static readonly IReadOnlyDictionary<string, string> LONG = Manifest.MANIFEST.LongVowel;
    private static readonly IReadOnlySet<string> LENGTHENS =
        new HashSet<string>(Manifest.MANIFEST.LengthenBefore.Select(c => c.ToString()), StringComparer.Ordinal);

    private static readonly IReadOnlyDictionary<string, string> EXCEPTIONS = Manifest.MANIFEST.Exceptions;
    private static readonly IReadOnlyDictionary<string, string> ENCLITICS = Manifest.MANIFEST.Enclitics;
    private static readonly IReadOnlyDictionary<string, string> CLAUSE_MARK = Manifest.MANIFEST.ClausePunctuation;

    private static readonly JsRe APOSTROPHE = JsRegex.Compile("['’]", "g");
    private static readonly JsRe CLITIC = JsRegex.Compile("^(.+)['’]([a-z]+)$", "gu");
    private static readonly JsRe TOKEN_COMMAS = JsRegex.Compile(",", "gu");

    /** Apply the vowel-length rule to the stressed nucleus. `stress` is its index; `isFinal` = no nucleus follows. */
    private static void ApplyLength(List<Seg> segs, int stress, bool isFinal)
    {
        var v = segs[stress];
        if (v.Long || v.Ph == "ə") return; // diphthong / circumflex / schwa: never length-adjusted
        // coda = the consonants between this nucleus and the next nucleus (or word end)
        var coda = 0;
        var single = "";
        for (var j = stress + 1; j < segs.Count && !segs[j].Nucleus; j++)
        {
            coda++;
            single = segs[j].Ph;
        }
        var longContext = coda == 0 || (coda == 1 && LENGTHENS.Contains(single));
        if (!longContext) return; // lax + short (voiceless stop, m, ŋ, ɬ, cluster, or the deferred n/r/l)
        // Full length ː only in a monosyllable / final syllable; a PENULT keeps its short LAX quality.
        if (isFinal) v.Ph = LONG.TryGetValue(v.Ph, out var l) ? l : v.Ph;
    }

    /** One Welsh word → canonical IPA: scan, penultimate stress, vowel length. */
    public static string PhonemizeWord(string word)
    {
        var lw = Js.ToLowerCase(word);
        if (EXCEPTIONS.TryGetValue(APOSTROPHE.Replace(lw, ""), out var exc)) return exc;
        var lex = Lexicon().TryGetValue(word, out var l1) ? l1
            : Lexicon().TryGetValue(lw, out var l2) ? l2 : null;
        if (lex is not null) return lex;
        // Apostrophe enclitic (o'r → oːr, hi'n → hiːn): phonemize the STEM as its own word so its length rule
        // sees the real (open) syllable, then append the enclitic.
        var clitic = CLITIC.Match(lw);
        if (clitic.Success && ENCLITICS.TryGetValue(clitic.Groups[2].Value, out var encl))
            return PhonemizeWord(clitic.Groups[1].Value) + encl;
        var segs = G2p.ToSegments(APOSTROPHE.Replace(word, "")); // strip clitic apostrophes (mae'r, cymru'n)
        if (segs.Count == 0) return "";
        var nucleiIdx = new List<int>();
        for (var i = 0; i < segs.Count; i++) if (segs[i].Nucleus) nucleiIdx.Add(i);
        if (nucleiIdx.Count == 0) return string.Concat(segs.Select(s => s.Ph));
        // PENULTIMATE stress (the second-to-last nucleus; the only nucleus in a monosyllable).
        var stressN = nucleiIdx.Count >= 2 ? nucleiIdx.Count - 2 : 0;
        var stress = nucleiIdx[stressN];
        ApplyLength(segs, stress, stressN == nucleiIdx.Count - 1);
        // NB: the letter ⟨i⟩ stays FRONT (i/ɪ/iː) everywhere — Northern Welsh centralizes only ⟨u⟩ and clear
        // ⟨y⟩ to ɨ, keeping the i/ɨ contrast (melin → mɛlɪn, gwin → ɡwiːn).
        var secondary = stressN >= 2 ? nucleiIdx[0] : -1;
        var outp = new StringBuilder();
        for (var i = 0; i < segs.Count; i++)
        {
            if (i == stress) outp.Append('ˈ');
            else if (i == secondary) outp.Append('ˌ');
            // Degeminate: a written double consonant (nn, rr, …) is pronounced SINGLE. It marks the preceding
            // vowel short — ApplyLength already saw the doubled coda, so only the OUTPUT collapses.
            // (ll/dd/ff/… are single digraph phonemes, not identical-adjacent, so untouched.)
            var s = segs[i];
            var prev = i > 0 ? segs[i - 1] : null;
            if (i > 0 && !s.Nucleus && prev is not null && !prev.Nucleus && s.Ph == prev.Ph)
                continue;
            outp.Append(s.Ph);
        }
        return outp.ToString();
    }

    // Welsh groups thousands with COMMAS (1,400 — the TOKEN swallows the comma so the tier can still see the
    // number); the dot is a DECIMAL or a version, claimed by Normalize.
    private static readonly JsRe TOKEN = JsRegex.Compile(
        "(" + HostWord.HostWordRun(new[] { "Latin" }, "", "'’-") + ")|([1-9]\\d{0,2}(?:,\\d{3})+(?:\\.\\d+)?|\\d+\\.\\d+|\\d+)|([.!?…,;:])", "gu");

    /**
     * This language's OWN inventory. ⚠ TWO DIFFERENT QUESTIONS, KEPT APART: the TOKEN class above decides
     * where the SCRIPT boundary falls (routing), while this one decides whether the g2p has rules for these
     * letters. A token this class REJECTS carries a letter the language does not use — i.e. a foreign name.
     */
    private const string NATIVE_CLASS = "[a-zâêîôûŵŷàèìòùïëöäüA-ZÂÊÎÔÛŴŶÀÈÌÒÙÏËÖÄÜ]";
    /** ⚠ Mirrors the TS's exported `nat`, which test/lexicon-reachability.test.ts uses to assert that every
     *  key in this engine's lexicons survives its own fold. */
    public static readonly Func<string, string> Nat = HostWord.MakeNativiser(NATIVE_CLASS, "u");

    // symbol normalization — Welsh: "y cant" after the number (40 y cant, the BBC Cymru convention); nouns
    // stay SINGULAR after numerals in Welsh, so one form suffices (deg doler, not *doleri*).
    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        // `multiply` — the word is this language's OWN, harvested from its existing `×` rule. Declaring it
        // HERE is what makes ASCII `x` read like `×`. One word, so `by` is omitted and defaults to it — this
        // language does not split dimension from product.
        Multiply = new MultiplyDef { Times = "gwaith" },
        Percent = new[] { "y cant" },
        Currency = new Dictionary<string, IReadOnlyList<string>>
        {
            ["$"] = new[] { "doler" }, ["£"] = new[] { "punt" }, ["¥"] = new[] { "yen" },
        },
        Units = new Dictionary<string, IReadOnlyList<string>>
        {
            ["km"] = new[] { "cilomedr" }, ["kg"] = new[] { "cilogram" }, ["mm"] = new[] { "milimetr" },
            ["cm"] = new[] { "centimetr" }, ["m"] = new[] { "metr" },
        },
        // `cilomedr`, NOT `cilometr` — the corpus's own squared reading is `cilomedr sgwâr`, so the head
        // noun has to be that word or the tier composes half an attested collocation.
        ExponentWords = new ExponentWordsDef
        {
            Squared = new[] { "sgwâr" },
            Cubed = new[] { "ciwbig" },
            Position = ExponentPosition.After,
        },
    });

    public string Text(string input) =>
        // Normalize.cs FIRST, then the shared symbol tier — Normalize's ordinal/era/version steps need the
        // number and its suffix still adjacent, which the tier would break.
        Clauses.AssembleClauses(SYMBOLS(Normalize.NormalizeWelsh(input)), TOKEN, (m, sink) =>
        {
            if (m.Groups[1].Success && m.Groups[1].Value.Length > 0)
                sink.Emit(PhonemizeWord(Nat(m.Groups[1].Value)));
            else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
            {
                // ⚠ THE STRIPPED STRING IS PASSED AS `raw` (#1095) — the fallback exists precisely because
                // the double cannot carry the digits, so it must not re-derive them from one.
                var digits = TOKEN_COMMAS.Replace(m.Groups[2].Value, "");
                foreach (var wd in Numbers.NumberToWords(Js.Number(digits), digits).Split(' '))
                    sink.Emit(PhonemizeWord(wd));
            }
            else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
            {
                if (CLAUSE_MARK.TryGetValue(m.Groups[3].Value, out var mk) && mk.Length > 0) sink.Pause(mk);
            }
        });

    /** Build the Welsh phonemizer (rule-based; penultimate stress + vowel length). */
    public static ILanguage CreateWelsh() => new WelshPhonemizer();

    internal static void RegisterSelf() => Registry.Register("welsh", CreateWelsh);
}
