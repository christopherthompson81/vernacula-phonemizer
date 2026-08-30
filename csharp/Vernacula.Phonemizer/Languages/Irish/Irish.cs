/**
 * Irish Gaelic (ga) phonemizer — Standard/Connacht-leaning, canonical IPA. Rule-based g2p (G2p.cs, the
 * broad/slender axis) + first-syllable stress (the native default) + i-offglide and svarabhakti passes, with a
 * Connacht pronunciation lexicon (lexicon.tsv) pinning the semi-lexical vowel detail the rules defer (io/oi/eo
 * splits). Lexicon first, g2p for OOV. Ported from src/languages/irish/irish.ts.
 */
using System.Text;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Irish;

public sealed class IrishPhonemizer : ILanguage
{
    // Connacht pronunciation lexicon: oracle-distilled, consonant+glide-skeleton-verified overrides that pin
    // the semi-lexical vowel-QUALITY detail the rules defer (io/oi/eo splits). Consulted before the g2p; OOV
    // words fall through to the rules. Lazily loaded (like French/Swedish) so merely importing this module —
    // e.g. from the referee eval to score another language — does not parse the whole TSV.
    private static IReadOnlyDictionary<string, string>? LEXICON;
    private static IReadOnlyDictionary<string, string> Lexicon() =>
        LEXICON ??= LoadTsv.LoadTsvMap("languages/irish", "lexicon.tsv");

    // Short vowels reduce to ə when unstressed; long vowels + diphthongs (with ː) keep their quality. ɪ IS
    // reduced: the independent wikipron referee transcribes unstressed short i as ə (féidir → fʲeːdʲəɾʲ,
    // milis → mʲɪlʲəʃ), NOT the oracle's ɪ — real Connacht centralizes it like a/o/u.
    private static readonly IReadOnlySet<string> SHORT =
        new HashSet<string>(new[] { "a", "ɛ", "ɪ", "ɔ", "ʊ" }, StringComparer.Ordinal);

    /** A slender consonant (palatalized, or a palatal). A back vowel before a slender CODA gets an i-offglide. */
    private static bool IsSlenderC(string ph) =>
        ph.EndsWith("ʲ", StringComparison.Ordinal) || ph == "c" || ph == "ɟ" || ph == "ʃ" || ph == "ç";

    // LONG back vowels only (áit, cóir); short a is inconsistent (gairm has none).
    private static readonly IReadOnlySet<string> BACK_V =
        new HashSet<string>(new[] { "ɑː", "oː" }, StringComparer.Ordinal);

    // /r/ or /l/ (broad or slender) triggers svarabhakti before a labial/velar/palatal consonant.
    private static readonly IReadOnlySet<string> LIQUID =
        new HashSet<string>(Manifest.MANIFEST.Liquids, StringComparer.Ordinal);
    private static readonly IReadOnlySet<string> SVARABHAKTI_NEXT =
        new HashSet<string>(Manifest.MANIFEST.SvarabhaktiNext, StringComparer.Ordinal);

    /** Long back vowel + a following slender consonant → insert an i-offglide ⁱ, whether that consonant is a
     *  coda (áit → ɑːⁱtʲ, cóir → oːⁱɾʲ) or an onset of the next syllable (óige → oːⁱɟə). A short back vowel
     *  (baile → balʲə), an ⟨eo⟩-derived oː (ceoil), or uː/iː/eː gets none. */
    private static void Offglide(List<Seg> segs)
    {
        for (var i = segs.Count - 1; i >= 1; i--)
        {
            Seg c = segs[i], prev = segs[i - 1];
            if (c.Nucleus || !prev.Nucleus) continue;
            if (IsSlenderC(c.Ph) && BACK_V.Contains(prev.Ph) && !prev.NoGlide)
                segs.Insert(i, new Seg { Ph = "ⁱ", Nucleus = false });
        }
    }

    /** Svarabhakti (epenthesis): a schwa between /r l/ and a following labial/velar/palatal (gorm → ɡɔɾˠəmˠ,
     *  bolg → bˠɔl̪ˠəɡ). /n/ does not trigger it (ainm → ˈanʲmˠ). */
    private static void Epenthesis(List<Seg> segs)
    {
        for (var i = segs.Count - 2; i >= 0; i--)
        {
            // the 2nd consonant must be a coda (bolg, not Gaeilge)
            var coda = i + 2 >= segs.Count || !segs[i + 2].Nucleus;
            if (coda && LIQUID.Contains(segs[i].Ph) && SVARABHAKTI_NEXT.Contains(segs[i + 1].Ph))
                segs.Insert(i + 1, new Seg { Ph = "ə", Nucleus = false });
        }
    }

    /** Native ⟨ng⟩ → ŋ (long → l̪ˠɔŋ), the word-final ɡ absorbed. Only before ɡ — not ⟨nc⟩, which stays n̪ˠk
     *  in the loanwords that have it (banc → bˠan̪ˠk). */
    private static void NasalAssim(List<Seg> segs)
    {
        for (var i = 0; i < segs.Count - 1; i++)
            if ((segs[i].Ph == "n̪ˠ" || segs[i].Ph == "nʲ") && segs[i + 1].Ph == "ɡ")
                segs[i].Ph = "ŋ";
        var l = segs.Count;
        if (l >= 2 && segs[l - 1].Ph == "ɡ" && segs[l - 2].Ph == "ŋ") segs.RemoveAt(l - 1);
    }

    /** One Irish word → canonical IPA. Stress the first nucleus (native default; marked even on monosyllables);
     *  every OTHER short-vowel nucleus reduces to ə (unstressed reduction, e.g. madra → mˠˈad̪ˠɾˠə). */
    public static string PhonemizeWord(string word) =>
        // Connacht lexicon override (semi-lexical vowel detail)
        Lexicon().TryGetValue(Js.ToLowerCase(word), out var hit) ? hit : G2pWord(word);

    /** ⚠ `JsRe.Replace`, NOT the `Rewrite` seam — the subject is a WORD the tokenizer handed over, never the
     *  pipeline string, so declaring it to the provenance tracker would report a span against a string it has
     *  never seen. */
    private static readonly JsRe ELISION = JsRegex.Compile("['’\\-]", "g");

    /** The pure rule-based g2p (no lexicon) — the OOV path, and the reference the lexicon build compares
     *  against. */
    public static string G2pWord(string word)
    {
        var segs = G2p.ToSegments(ELISION.Replace(word, "")); // strip elision/prothesis apostrophes + hyphens
        if (segs.Count == 0) return "";
        NasalAssim(segs);
        Epenthesis(segs); // svarabhakti schwa (gorm → ɡɔɾˠəmˠ)
        Offglide(segs);   // i-offglide before a slender coda (áit → ɑːⁱtʲ)
        var nucleiIdx = new List<int>();
        for (var i = 0; i < segs.Count; i++) if (segs[i].Nucleus) nucleiIdx.Add(i);
        if (nucleiIdx.Count == 0) return string.Concat(segs.Select(s => s.Ph));
        var stress = nucleiIdx[0];
        foreach (var idx in nucleiIdx)
            if (idx != stress && SHORT.Contains(segs[idx].Ph)) segs[idx].Ph = "ə";
        var outp = new StringBuilder();
        for (var i = 0; i < segs.Count; i++)
        {
            if (i == stress) outp.Append('ˈ');
            outp.Append(segs[i].Ph);
        }
        return outp.ToString();
    }

    private static IReadOnlyDictionary<string, string> CLAUSE_MARK => Manifest.MANIFEST.ClausePunctuation;

    // Irish groups thousands with COMMAS (1,400 — the TOKEN swallows the comma so the tier can still see the
    // number next to its unit/sign); the dot is a DECIMAL (1.5 → "pointe") or a version, claimed by Normalize.
    private static readonly string WORD_RUN = HostWord.HostWordRun(new[] { "Latin" }, "", "'’-");
    private static readonly JsRe TOKEN = JsRegex.Compile(
        "(" + WORD_RUN + ")|([1-9]\\d{0,2}(?:,\\d{3})+(?:\\.\\d+)?|\\d+\\.\\d+|\\d+)|([.!?…,;:])", "gu");

    /**
     * This language's OWN inventory. ⚠ TWO DIFFERENT QUESTIONS, KEPT APART: the TOKEN class above decides
     * where the SCRIPT boundary falls (routing), while this one decides whether the g2p has rules for these
     * letters. A token this class REJECTS carries a letter the language does not use — i.e. a foreign name.
     */
    private const string NATIVE_CLASS = "[a-záéíóúA-ZÁÉÍÓÚ]";
    /** ⚠ Mirrors the TS's exported `nat`, which test/lexicon-reachability.test.ts uses to assert that every
     *  key in this engine's lexicon survives its own fold. */
    public static readonly Func<string, string> Nat = HostWord.MakeNativiser(NATIVE_CLASS, "u");

    /** Thousands commas inside a matched number token — a matched group, not the pipeline string. */
    private static readonly JsRe TOKEN_COMMAS = JsRegex.Compile(",", "gu");

    // symbol normalization — Irish: % is "faoin gcéad" (after the number, as written).
    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        // `multiply` — the word is this language's OWN, harvested from its existing `×` rule. Declaring it
        // HERE is what makes ASCII `x` read like `×`: `6x6 cm` was reading the `x` as a LETTER NAME, and `NxN`
        // forms outnumber `×` roughly 85 to 20 across the corpora. One word, so `by` is omitted and defaults
        // to it — this language does not split dimension from product.
        Multiply = new MultiplyDef { Times = "faoi" },
        Percent = new[] { "faoin gcéad" },
        Currency = new Dictionary<string, IReadOnlyList<string>>
        {
            ["€"] = new[] { "euro" },
            ["$"] = new[] { "dollar", "dollair" },
            ["£"] = new[] { "punt" },
            ["¥"] = new[] { "yen" },
        },
        // `m` ADDED so the cube reading below has a head noun at all: méadar ×12, and every digit-adjacent
        // bare `m` in this corpus is a metre — `100m agus 200m`, `100 troith (30 m)`, `133 m/s`. That is the
        // one-letter-key hazard checked rather than assumed, and here it comes back clean.
        Units = new Dictionary<string, IReadOnlyList<string>>
        {
            ["km"] = new[] { "ciliméadar" },
            ["cm"] = new[] { "ceintiméadar" },
            ["mm"] = new[] { "milliméadar" },
            ["kg"] = new[] { "cileagram" },
            ["m"] = new[] { "méadar" },
        },
        // ONE INVARIANT FORM, matching `Units`' single `ciliméadar`: the sources disagree about agreement
        // (`4,840 slat chearnach` singular against `67,400 míle cearnacha` plural), so a count-form split
        // would be inventing a rule neither one settles. ⚠ `cearnóg` is NOT this word — it is the noun "a
        // square", the same shape-vs-unit split that bare `carré`, `kare` and ਵਰਗ have here.
        ExponentWords = new ExponentWordsDef
        {
            Squared = new[] { "cearnach" },
            Cubed = new[] { "ciúbach" },
            Position = ExponentPosition.After,
        },
    });

    public string Text(string input) =>
        // Normalize.cs FIRST, then the shared symbol tier — Normalize's ordinal/era/version steps need the
        // number and its suffix still adjacent, which the tier would break.
        Clauses.AssembleClauses(SYMBOLS(Normalize.NormalizeIrish(input)), TOKEN, (m, sink) =>
        {
            if (m.Groups[1].Success && m.Groups[1].Value.Length > 0)
                sink.Emit(PhonemizeWord(Nat(m.Groups[1].Value)));
            else if (m.Groups[2].Success && m.Groups[2].Value.Length > 0)
            {
                var bare = TOKEN_COMMAS.Replace(m.Groups[2].Value, "");
                foreach (var wd in Numbers.NumberToWords(Js.Number(bare), bare).Split(' '))
                    sink.Emit(PhonemizeWord(wd));
            }
            else if (m.Groups[3].Success && m.Groups[3].Value.Length > 0)
            {
                if (CLAUSE_MARK.TryGetValue(m.Groups[3].Value, out var mk) && mk.Length > 0) sink.Pause(mk);
            }
        });

    /** Build the Irish phonemizer (rule-based; the broad/slender axis is the core). */
    public static ILanguage CreateIrish() => new IrishPhonemizer();

    internal static void RegisterSelf() => Registry.Register("irish", CreateIrish);
}
