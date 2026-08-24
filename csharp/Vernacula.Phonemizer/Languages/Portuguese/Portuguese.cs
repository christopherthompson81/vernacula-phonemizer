/**
 * European Portuguese (pt-PT) phonemizer — canonical IPA. Rule-based g2p (g2p.ts) →
 * stress pass → the EP vowel-REDUCTION pass (unstressed a→ɐ, e→ɨ, o→u) → sibilant voicing. text() tokenizes
 * words / numbers / punctuation. No lexicon (yet).
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Portuguese;

// Lexical CORRECTION table (Approach A): the engine gets reduction/stress/glides right on its own; the lexicon
// only patches the two genuinely-lexical axes it cannot predict — the STRESSED mid-vowel quality (open ɛ/ɔ vs
// the close e/o default) and grapheme x (s/z/ks vs the ʃ default). Derived from wikipron EP by
// tools/gen/pt-gen-lexicon.mts. Row: word<TAB>code, code ∈ { "ɛ", "ɔ", "x:s", "x:z", "x:ks" }, "|"-joined
// if both apply.
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
            // wikipron-generated table, then the hand-curated supplement OVERRIDES it (loaded second).
            LEXICON = LoadTsv.LoadTsvMap<Corr>("languages/portuguese", "lexicon.tsv", (v, _) => ParseCorr(v), optional: true);
            foreach (var (k, v) in LoadTsv.LoadTsvMap<Corr>("languages/portuguese", "lexicon-manual.tsv", (v, _) => ParseCorr(v), optional: true))
                LEXICON[k] = v;
        }
        return LEXICON;
    }

    // Reduction / nasalization maps are DATA (portuguese.jsonc). Reduction is the EP signature (unstressed a→ɐ,
    // e→ɨ, o→u); nasal vowels resist it. NASAL maps an oral vowel IPA → its nasal quality.
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

    /** Post-stress onglide demotion: an UNSTRESSED high vowel (i/u) immediately before another nucleus is a rising
     *  glide, not a syllable of its own (diamante → djɐmɐ̃tɨ, água → aɡwɐ) — but a stressed one stays (dia → diɐ).
     *  Runs after stress so the count is settled; mid-vowel onglides (e/o) are left alone (moeda → muɛðɐ). */
    private static readonly IReadOnlySet<string> LIQUID =
        new HashSet<string>(Manifest.MANIFEST.Liquids, StringComparer.Ordinal);

    private static void Onglides(List<Seg> segs, int stress)
    {
        for (var i = 0; i < segs.Count; i++)
        {
            var s = segs[i];
            if (!s.Nucleus || i == stress || (s.Raw != "i" && s.Raw != "u" && s.Raw != "e")) continue;
            var next = i + 1 < segs.Count ? segs[i + 1] : null;
            if (next is null || !next.Nucleus) continue;
            // A high vowel before a STRESSED high vowel is hiatus, not a glide (juiz → ʒuiʃ, miúdo → miudu; but
            // piano → pjɐnu, água → aɡwɐ glide before a low vowel).
            if (i + 1 == stress && (next.Raw == "i" || next.Raw == "u")) continue;
            // A high vowel after an obstruent+liquid onset cluster stays a nucleus (criança → kɾiɐ̃sɐ, not kɾjɐ̃-).
            var p1 = i - 1 >= 0 ? segs[i - 1] : null;
            var p2 = i - 2 >= 0 ? segs[i - 2] : null;
            if (p1 is not null && p2 is not null && LIQUID.Contains(p1.Ph) && !p2.Nucleus) continue;
            s.Nucleus = false;
            s.Ph = s.Raw == "u" ? "w" : "j"; // i/e → j, u → w
        }
    }

    // BP unstressed-vowel raising is POSITION-split, unlike EP's blanket reduction: only the FINAL atonic vowel
    // raises (e→i, o→u, a→ɐ — cidade → sidad(ʒ)i, estado → estadu), while pretonic/postonic-medial vowels keep their
    // mid quality (bonito → bonitu NOT bunitu, professor → pɾofesoɾ, telefone → telefoni). This is the deepest EP→BP
    // difference and is NOT recoverable from EP surface forms (EP has already collapsed pretonic o→u), which is why
    // the dialect is a parameter of the engine rather than a post-process. There is no [ɨ] and no initial-e→i in BP.
    private static readonly IReadOnlyDictionary<string, string> REDUCE_BP_FINAL =
        new Dictionary<string, string>(StringComparer.Ordinal) { ["a"] = "ɐ", ["e"] = "i", ["o"] = "u" };
    private static readonly IReadOnlyDictionary<string, string> REDUCE_BP_MID =
        new Dictionary<string, string>(StringComparer.Ordinal) { ["a"] = "a", ["e"] = "e", ["o"] = "o" };

    /** Realize vowels: reduce unstressed oral vowels, nasalize nasal ones, mark the stressed nucleus with ˈ. */
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
                // Unstressed ⟨a⟩/⟨e⟩ before a coda dark-l (ɫ) do NOT reduce/raise — the velarized ɫ keeps the vowel
                // open: ⟨a⟩→[a] (altura → aɫtuɾɐ, salvar → saɫvaɾ) and ⟨e⟩→[ɛ] (delgado → dɛɫɡadu, the -ável/-ível
                // suffix -vel → vɛɫ). Onset l still reduces (falar → fɐlaɾ). ⟨o⟩ still raises before ɫ (soldado →
                // suɫdadu — the referee corroborates the o-raise, unlike a/e). Referee-confirmed 53:0 (a), 89:0 (e).
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
                    // EP: word-initial unstressed e → i (está → iʃta), else the blanket reduction a→ɐ, e→ɨ, o→u.
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
            // BP: a stressed OPEN mid vowel (ɔ/ɛ) with no EXPLICIT accent, before a nasal-onset consonant, CLOSES —
            // the ô/ê of Brazilian orthography where Europe keeps ó/é open (abandona→abɐ̃donɐ, acena→asenɐ; EP
            // abɐ̃dɔnɐ/asɛnɐ). Gated on !s.accent so acute-marked ó/é stay open (afónica keeps [ɔ]).
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
        // Word-initial e realizes as e/ɛ, overriding the default i-raising: raw="" so realize leaves ph untouched.
        if (corr.InitE is not null && segs.Count > 0 && segs[0].Nucleus && segs[0].Raw == "e")
        {
            segs[0].Ph = corr.InitE;
            segs[0].Raw = "";
        }
    }

    /** Core: EP word → canonical IPA, applying an explicit correction (used by the lexicon and its generator). */
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

    /** BP consonant surface rules applied to the realized string (their triggers — [i] incl. raised final ⟨e⟩, the
     *  onset glide [j] from a high front vowel, and coda [ɫ] — are unambiguous at this point): (1) affrication of
     *  /t d/ before [i]/[ĩ]/[j] (tia → t͡ʃia, dia → d͡ʒia, gente → ʒẽt͡ʃi, cidade → sidad͡ʒi; and before the glide —
     *  the referee palatalises categorically here: adiado → ad͡ʒjadu, ação-tipo cases); (2) coda-l vocalization ɫ →
     *  [w] (sal → saw, Brasil → bɾaziw). Coda-r stays [ɾ] and rr/initial stay [ʁ] — both attested in the BZ referee,
     *  so no contested [h]/[x]/[ɻ] choice. */
    private static string BpConsonants(string ipa) =>
        BP_DARK_L.Replace(BP_D_AFFRICATE.Replace(BP_T_AFFRICATE.Replace(ipa, "t͡ʃ$1"), "d͡ʒ$1"), "w");

    /** One word → canonical IPA: rule engine + the lexical correction table (open/close vowels, x). `dialect` selects
     *  European (default) or Brazilian realization; the open/close correction lexicon is shared (EP-derived, mostly
     *  valid for BP — a small lexical tail where the dialects differ on a stressed mid vowel). */
    public static string PhonemizeWord(string word, string dialect = "ep") =>
        RenderWord(word, Lexicon().GetValueOrDefault(word.ToLowerInvariant()), dialect);

    private static IReadOnlyDictionary<string, string> CLAUSE_MARK => Manifest.MANIFEST.ClausePunctuation;
    // Word / number / clause-punctuation. Portuguese numbers: dot = thousands (1.500), comma = decimal (3,14).
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

    // Unstressed monosyllabic clitics (articles, prepositions, conjunctions, clitic pronouns) — de-stressed in
    // running text (DATA: portuguese.jsonc).
    private static readonly IReadOnlySet<string> FUNCTION_WORDS =
        new HashSet<string>(Manifest.MANIFEST.FunctionWords, StringComparer.Ordinal);

    /** `postWord`, if given, refines a resolved word's IPA with its (lowercased) source word — the hook the pt-BR
     *  variant uses to apply its BP open/close override lexicon while reusing this engine's number/clause context. */
    private static string WordIpa(string word, string dialect, Func<string, string, string>? postWord)
    {
        var ipa = PhonemizeWord(word, dialect);
        if (postWord is not null) ipa = postWord(ipa, word.ToLowerInvariant());
        return FUNCTION_WORDS.Contains(word.ToLowerInvariant()) ? Js.ReplaceFirst(ipa, "ˈ", "") : ipa;
    }

    // symbol normalization — Portuguese (quilômetro: the BR spelling; pt-BR is the corpus variety).
    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        // `&` was DROPPED outright: the corpus's `B&B` and `Arts & Sciences` lost the sign.
        // `e` ×1118 in this corpus. The tier spaces it on both sides, because `B&B` is two
        // initialisms and joining them would make one token.
        // `multiply` — this language DROPPED the sign outright. ⚠ STANDARD MATHEMATICAL REGISTER, not a corpus
        // attestation: the sweep failed exactly as the exponent sweep did, because the plausible hits are homographs
        // of PREPOSITIONS — es `por` ×23, it `per` ×25, ru `на` ×31 are all the preposition, never the operator.
        // One word, so `by` defaults to it; this language does not split dimension from product.
        Multiply = new MultiplyDef { Times = "vezes" },
        Ampersand = "e",
        Percent = new[] { "por cento" },
        // THE DOLLAR CODES ARE FOLDED TO `$` IN normalize.ts STEP 5b, so no compound key is declared here — one
        // would be unreachable. The earlier note on this line said the declared `US$` key was "verified on the
        // direct form, inert on the corpus, and the difference is not yet explained". It is now explained: the
        // INITIALISM pass runs before this tier and split `US` into letters, leaving the `$` preceded by a letter
        // where this tier's guard correctly refuses it — and the "verification" had used an all-caps probe string,
        // which trips initialisms.ts's all-caps-document guard and skips the pass. See step 5b for the evidence,
        // including the two pt_br speakers who say *dólares* and never voice the code.
        // `dólar` ×9 / `dólares` ×8 are the corpus's own words.
        Currency = new Dictionary<string, IReadOnlyList<string>>
        {
            ["€"] = new[] { "euro", "euros" }, ["$"] = new[] { "dólar", "dólares" }, ["£"] = new[] { "libra", "libras" },
            ["¥"] = new[] { "iene", "ienes" },
        },
        // Longest keys match first, so km/h beats km. The slash unit was dropping its /h entirely.
        Units = new Dictionary<string, IReadOnlyList<string>>
        {
            ["km/h"] = new[] { "quilômetro por hora", "quilômetros por hora" },
            ["m/s"] = new[] { "metro por segundo", "metros por segundo" },
            ["km"] = new[] { "quilômetro", "quilômetros" }, ["cm"] = new[] { "centímetro", "centímetros" },
            ["mm"] = new[] { "milímetro", "milímetros" }, ["kg"] = new[] { "quilograma", "quilogramas" },
            ["mg"] = new[] { "miligrama", "miligramas" }, ["m"] = new[] { "metro", "metros" },
            // ⚠ ⟨L⟩ AND ⟨l⟩ ARE BOTH OFFICIAL for the litre (⟨L⟩ is the dominant printed form), so BOTH are
            // declared — the one exception to the one-letter case rule in core/normalizeSymbols.ts, which
            // exists for symbols whose two cases are DIFFERENT units. Here they are the same unit.
            ["l"] = new[] { "litro", "litros" }, ["L"] = new[] { "litro", "litros" },
            ["ml"] = new[] { "mililitro", "mililitros" }, ["g"] = new[] { "grama", "gramas" },
            ["t"] = new[] { "tonelada", "toneladas" }, ["ha"] = new[] { "hectare", "hectares" },
            ["kw"] = new[] { "quilowatt", "quilowatts" },
        },
        ExponentWords = new ExponentWordsDef
        {
            Squared = new[] { "quadrado", "quadrados" }, Cubed = new[] { "cúbico", "cúbicos" },
        },
        // BARE EXPONENT — the reading for a power with NO unit to modify (`20²`, `mc²`), which every language
        // in the fleet was dropping silently. See `bareExponent` in core/normalizeSymbols.ts for why this cannot
        // reuse `exponentWords` above: that is the unit MODIFIER and this is the PREDICATE, and in most languages
        // they are different words (quilómetros quadrados but vinte ao quadrado).
        // ⚠ PROVENANCE, stated because it is weaker than most data in this repo: these are STANDARD MATHEMATICAL
        // REGISTER, not corpus attestations. The power words are ×0 in this language's artifact, and the apparent
        // hits for other languages were substring traps of exactly the kind tools/normalization/attest.ts warns
        // about — th `กำลัง` matched the progressive-aspect marker, fa `توان` and ar `أس` matched inside unrelated
        // words. FLEURS is news and encyclopedia prose and simply does not contain spoken arithmetic.
        // The cardinal is used for the generic power, never the ordinal — see core for that argument.
        BareExponent = new BareExponentDef
        {
            Squared = "{n} ao quadrado", Cubed = "{n} ao cubo", Power = "{n} elevado a {e}", Negative = "menos",
        },
        Magnitudes = new[] { "milhões", "milhão", "bilhões", "bilhão" },
        MagnitudeConnective = "de", // cinco milhões DE dólares
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
            // order: Portuguese rewrites (abbreviations, era markers, ordinal indicators, clock, R$) →
            // INITIALISMS → the shared symbol tier last, since the clock rule has already claimed the hour.
            // Roman numerals arrive already converted from the registry seam (pt is not in ROMAN_NATIVE).
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
     *  Brazilian ("bp") realization; `postWord` is an optional per-word IPA refinement (the BP open/close lexicon).
     *  See src/languages/portuguese-br for the BP accent-variant entry points. */
    public static ILanguage CreatePortuguese(string dialect = "ep", Func<string, string, string>? postWord = null) =>
        new PortugueseEngine(dialect, postWord);

    internal static void RegisterSelf()
    {
        Registry.Register("portuguese", () => CreatePortuguese());
        Registry.RegisterRomanPolicy("pt", RomanOrdinals.ROMAN_POLICY);
    }
}
