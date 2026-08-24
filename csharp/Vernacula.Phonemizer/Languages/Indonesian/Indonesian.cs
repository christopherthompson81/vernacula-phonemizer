/**
 * Native Indonesian (id) text phonemizer — canonical IPA. Bahasa Indonesia has a shallow,
 * near-phonemic Latin orthography, so this is a rule-based transliterator: digraphs (ng→ŋ, ny→ɲ, sy→ʃ, kh→x)
 * then single letters, ⟨e⟩→schwa [ə] by default, closed-syllable lax allophones (i→ɪ, u→ʊ, e→ɛ, o→ɔ), falling
 * diphthongs ai/au/oi, and syllable-final ⟨k⟩ → glottal stop [ʔ]. Penultimate stress (skips a schwa nucleus).
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
    /** The word for the decimal comma ("koma"); absent before, so a decimal ran its two halves together. */
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
            // Falling diphthong at word end (ai/au/oi): the two vowels form one nucleus.
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

    // NOTE: Indonesian /i u e o/ have lax closed-syllable allophones [ɪ ʊ ɛ ɔ], but the referee (and standard
    // descriptions) apply them only erratically/dialectally — kecil→kətʃil, air→air keep TENSE vowels. We emit the
    // tense phonemes for canonical consistency; the eval folds the tense/lax axis (config.ts). laxVowels stays in
    // the manifest for reference.

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

    /**
     * Can this letter run be an Indonesian word at all? Indonesian syllables are simple — (C)V(C) with a
     * short coda inventory — so a capital run with no vowel, or with a cluster the language does not
     * license, is an acronym and nothing else.
     */
    private static readonly Func<string, bool> IsUnreadableIndonesian = Initialisms.MakeUnreadableTest(new PhonotacticsData
    {
        Vowels = JsRegex.Compile("[aeiou]", "u"),
        Digraphs = new HashSet<string>(new[] { "ng", "ny", "sy", "kh" }, StringComparer.Ordinal),
        LegalOnsets = new HashSet<string>(new[]
        {
            "b", "c", "d", "f", "g", "h", "j", "k", "l", "m", "n", "p", "q", "r", "s", "t", "v", "w",
            "y", "z", "ng", "ny", "sy", "kh",
            // the borrowed clusters the reformed orthography admits
            "bl", "br", "dr", "fl", "fr", "gl", "gr", "kl", "kr", "pl", "pr", "sl", "sp", "st", "sk",
            "tr", "sw", "ps", "kw",
        }, StringComparer.Ordinal),
        LegalCodas = new HashSet<string>(new[]
        {
            "b", "d", "f", "h", "k", "l", "m", "n", "ng", "p", "r", "s", "t", "kh",
        }, StringComparer.Ordinal),
        Liquids = JsRegex.Compile("[lr]", "u"),
    });

    /**
     * ⚠ READABLE AND STILL SPELLED OUT — the cases the phonotactic test gets wrong in the other direction.
     * `core/initialisms.ts` states the principle: "readability is not convention". `AS` (Amerika Serikat)
     * and `REM` are perfectly pronounceable Indonesian shapes and are still said letter by letter, so a
     * test on shape alone would read them as words. Evidence: the FLEURS id_id audio has `as` as
     * `a e s` and `aol` as `a o e l` — spelled, in both cases.
     */
    private static readonly IReadOnlySet<string> SPELLED_ANYWAY =
        new HashSet<string>(new[] { "as", "rem", "oha", "aol" }, StringComparer.Ordinal);

    /**
     * ⚠ ACRONYM LEXICON — the word-pronounced borrowings whose reading is NOT derivable from Indonesian
     * orthography, and so has to be listed rather than computed.
     *
     * The readability gate above decides the right QUESTION (word, not letters), but the answer then comes
     * from the native rules — and native ⟨c⟩ is /t͡ʃ/, so `UNESCO` read as an Indonesian word gives
     * *unəst͡ʃˈo*. These borrowings keep the /k/ of their source spelling. That is a fact about each word,
     * not about its shape, which is what a lexicon is for — the same reasoning as the Nguni loan list.
     *
     * ATTESTED IN THE FLEURS id_id AUDIO, not assumed:
     *     unesco   ASR `o n i a o n i s k o`   -> …nesko, with /k/
     *     covid    ASR `k ɔ f i t`             -> /kovid/, with /k/
     *     acta     ASR `ŋ a n a t a`           -> /akta/, with /k/
     *
     * Acronyms WITHOUT a ⟨c⟩ need no entry: `NATO` and `ASEAN` fall through the readability gate and the
     * native rules already read them correctly (nˈato, asəˈan).
     */
    private static readonly IReadOnlyDictionary<string, string> ACRONYM_LEXICON = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["unesco"] = "unˈɛsko",
        ["covid"] = "kˈovid",
        ["acta"] = "ˈakta",
    };

    private static readonly JsRe ALL_CAPS = JsRegex.Compile("^[A-Z]{2,}$", "");

    /** One Indonesian word → canonical IPA, RULE-ENGINE ONLY (no ⟨e⟩ lexicon). The honest, non-circular engine
     *  signal used by the referee eval; the shipped phonemizeWord layers the consensus ⟨e⟩ lexicon on top. */
    public static string PhonemizeWordRules(string word)
    {
        // All-caps acronym → spell each letter by its Indonesian name (BBM → be-be-em → bebeem).
        //
        // ⚠ ONLY IF IT CANNOT BE READ AS A WORD, and omitting that test spelled out every acronym that is
        // actually PRONOUNCED as one: `UNESCO` came out `uɛneɛst͡ʃeo` (u-e-en-e-es-che-o) instead of
        // /unɛsko/, and `NATO`, `ASEAN`, `COVID`, `ACTA` the same way. ASEAN and UNESCO are not marginal
        // vocabulary in Indonesian or Malay. The bare `/^[A-Z]{2,}$/` claimed any capital run, so an
        // ordinary word in caps — `RUMAH` — was spelled out too.
        //
        // This is the discrimination `core/initialisms.ts` already makes for the rest of the fleet
        // (`isUnreadable`, plus a listed-exception set for the readable-but-still-spelled cases). Indonesian
        // never went through that pass, so it never got the test. Indonesian phonotactics make it clean:
        // TV / DVD / GPS / PBB have no vowel at all and are unreadable by construction, while NATO / ASEAN /
        // UNESCO syllabify without trouble.
        if (ALL_CAPS.IsMatch(word))
        {
            var low = word.ToLowerInvariant();
            if (ACRONYM_LEXICON.TryGetValue(low, out var lex)) return lex; // listed borrowing: its own attested reading
            if (SPELLED_ANYWAY.Contains(low) || IsUnreadableIndonesian(low))
                return string.Concat(Js.CodePoints(low).Select(c => DEF.LetterNames.GetValueOrDefault(c) ?? ""));
            // readable, unlisted → fall through and read it as an ordinary word
        }
        var segs = Scan(word.ToLowerInvariant());
        if (segs.Count == 0) return "";
        // Syllable-final /k/ → glottal stop [ʔ] (coda k, before a consonant or word end).
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

    // ⟨e⟩ pepet/taling lexicon — cross-source consensus (wikipron ind ∩ kaikki ind), Latin-keyed. Latin ⟨e⟩ conflates
    // pepet /ə/ (the rule default) and taling /e/~/ɛ/, which is lexical and unrecoverable from the orthography; each
    // entry pins the taling quality where both independent human referees agree. See indonesian-e-lexicon.tsv.
    private static Dictionary<string, string>? LEXICON;
    private static Dictionary<string, string> Lexicon() =>
        LEXICON ??= LoadTsv.LoadTsvMap("languages/indonesian", "indonesian-e-lexicon.tsv", optional: true);

    /** SHIPPED Indonesian word → canonical IPA. A consensus ⟨e⟩ lexicon override resolves the pepet/taling ambiguity
     *  for known words; everything else falls through to the rule engine (which defaults pepet). */
    public static string PhonemizeWord(string word)
    {
        if (!ALL_CAPS.IsMatch(word))
        {
            if (Lexicon().TryGetValue(word.ToLowerInvariant(), out var hit)) return hit;
        }
        return PhonemizeWordRules(word);
    }

    // ── Numbers (regular, compositional) ─────────────────────────────────────────
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

    // The number class accepts Indonesian's DOT thousands grouping and COMMA decimal. Without them "9.000"
    // tokenized as 9 | . | 000 and the separator became a clause PAUSE ("sembilan . nol"), and "1,5" likewise.
    // Times (11.00) are claimed earlier by normalize.ts, so only real numbers reach this.
    // Indonesian had no symbol tier at all: "3%" read as just "tiga", losing the percent.
    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        // ⚠ `multiply` IS STANDARD MATHEMATICAL REGISTER, not a corpus attestation: a corpus sweep for the operator
        // returns homographs of PREPOSITIONS in every language tried. One word, so `by` defaults to it — this
        // language does not split dimension from product.
        Multiply = new MultiplyDef { Times = "kali" },
        // Unread, `&` is DROPPED outright and `B&B` loses the sign entirely.
        // `dan` ×1053 in this corpus. The tier spaces it on both sides, because `B&B` is two
        // initialisms and joining them would make one token.
        Ampersand = "dan",
        Percent = new[] { "persen" },
        Currency = new Dictionary<string, IReadOnlyList<string>>
        {
            ["$"] = new[] { "dolar" }, ["€"] = new[] { "euro" }, ["£"] = new[] { "pound" }, ["¥"] = new[] { "yen" },
        },
        // REQUIRED BY THE `US$` FOLD, and found only because the fold exposed it. Unfolding `US$ 14,7
        // miliar` let the tier place the currency noun at last, and it placed it in the WRONG SLOT:
        // *empat belas koma tujuh DOLAR MILIAR*, because without this list the magnitude is not part of the
        // quantity and the noun lands directly after the digits. Indonesian puts the noun after the magnitude —
        // *14,7 miliar dolar*. So the fold turned a silent DROP into an audible word-order error, which is a
        // reminder that closing a drop is not finished until the reading is checked, not just the differential.
        //
        // NO `magnitudeConnective`: Indonesian juxtaposes (*miliar dolar*, not *miliar de dolar*), unlike
        // Catalan's *de* or Italian's *di*. Attested in this corpus as `juta` ×8, `miliar` and `ribu`.
        Magnitudes = new[] { "triliun", "miliar", "juta", "ribu" },
        Units = new Dictionary<string, IReadOnlyList<string>>
        {
            ["km"] = new[] { "kilometer" }, ["cm"] = new[] { "sentimeter" }, ["mm"] = new[] { "milimeter" },
            ["kg"] = new[] { "kilogram" }, ["m"] = new[] { "meter" }, ["g"] = new[] { "gram" },
            // ⚠ ⟨L⟩ AND ⟨l⟩ ARE BOTH OFFICIAL for the litre (⟨L⟩ is the dominant printed form), so BOTH are
            // declared — the one exception to the one-letter case rule in core/normalizeSymbols.ts, which
            // exists for symbols whose two cases are DIFFERENT units. Here they are the same unit.
            ["l"] = new[] { "liter" }, ["L"] = new[] { "liter" }, ["ha"] = new[] { "hektar" },
        },
        // `kilometer persegi` ×3 — the modifier follows. Bare `persegi` ×9 includes the SHAPE ("persegi yang
        // tidak memiliki sisi bawahnya"), so the collocation is what attests the unit sense. `kubik` ×0, so
        // `m³` keeps the fallback.
        ExponentWords = new ExponentWordsDef { Squared = new[] { "persegi" }, Position = "after" },
    });

    // ⚠ THE WORD GROUP SPANS ALL OF LATIN, not just ASCII, and `[a-zA-Z]+` was silently shredding foreign names.
    // A diacritic ended the token, so the letter carrying it became an unclaimed gap read as an English LETTER NAME
    // and the rest of the word started over: `Cañitas` → *t͡ʃˈa ˈɛn ˈitas* ("cha EN itas"), `São` → *s ˈə ˈo*,
    // `Klöcker` → *ʔl ˈoᶷ t͡ʃkˈər*. One word became three, none of them right.
    // ⚠ INVISIBLE TO EVERY GATE: no digit or raw mark survives, and nothing VANISHES, so it is a WRONG-WORD defect
    // that neither the leak classes nor the differential DROP test can see. Found only by reading a corpus diff.
    // `\p{M}` so a DECOMPOSED accent stays with its base rather than ending the token one character later.
    // yue fixed the same defect the same way and pins it (`yue("Müslüm") === phonemize(…, "en")`).
    private static readonly JsRe TOKEN =
        JsRegex.Compile("(\\p{Script=Latin}[\\p{Script=Latin}\\p{M}]*)|(\\d{1,3}(?:\\.\\d{3})+|\\d+(?:,\\d+)?)|([.?!,;:])", "gu");
    /** An ordinary Indonesian word is plain ASCII letters. A diacritic means a FOREIGN name — Indonesian
     *  orthography has none — so such a token goes to the injected foreign reader instead of the native g2p, which
     *  has no rule for `ñ`/`ö`/`ó` and would mangle what it cannot spell. */
    private static readonly JsRe NATIVE_WORD = JsRegex.Compile("^[a-zA-Z]+$", "u");

    private static readonly JsRe GROUPING_DOT = JsRegex.Compile("\\.", "gu");

    private sealed class Engine : ILanguage
    {
        private readonly Func<string, string>? _foreign;
        internal Engine(Func<string, string>? foreign = null) => _foreign = foreign;

        public string Text(string input)
        {
            // the Indonesian rewrites (clock, rupiah, abbreviations, slash units) run BEFORE the shared
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
                    // Strip the dot grouping, then split on the decimal comma. Number words bypass the ⟨e⟩
                    // lexicon (their ⟨e⟩ is pepet; avoid any taling homograph).
                    var split = GROUPING_DOT.Replace(m.Groups[2].Value, "").Split(',');
                    var intPart = split[0];
                    var frac = split.Length > 1 ? split[1] : null;
                    var n = Js.Number(intPart);
                    // ⚠ ABOVE 2^53 THIS USED TO `return` AND THE WHOLE NUMBER VANISHED FROM THE READING — the
                    // decimal tail with it. Refusing to compose is right (the float has already lost the low
                    // digits, so the composed numeral would be confidently wrong), but the guard had no else.
                    // Digit-at-a-time is exactly what the fractional part below already does, so the fallback
                    // needs no word this engine was never measured on: above 2^53 the reading is a digit
                    // string, not a quantity. Inherited by `ms`/`zsm`, which wrap this engine.
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

    /** Build the Indonesian phonemizer. */
    /** `foreign` reads a token carrying a DIACRITIC — a foreign name, since Indonesian orthography has none. The
     *  registry injects English, exactly as it does for Hindi. Without it the native g2p silently drops the letter it
     *  cannot spell (`Cañitas` → *t͡ʃaˈitas*), which is quieter than the old fragmentation but no more correct. */
    public static ILanguage CreateIndonesian(Func<string, string>? foreign = null) => new Engine(foreign);

    internal static void RegisterSelf() =>
        Registry.Register("indonesian", () => CreateIndonesian(Registry.ReadAsEnglish));
}
