/**
 * German (de) text normalization — the pre-tokenizer pass that rewrites everything which is not already a
 * pronounceable word into words the pipeline speaks. Pure text→text; no IPA.
 *
 * ⚠ GERMAN WRITES THE ORDINAL AS A NUMERAL PLUS A BARE PERIOD — `16. Jahrhundert`, `am 17. September` — which
 * a regex cannot tell from a sentence-final digit. It is the largest single defect class here, and unhandled
 * every one reads as a cardinal followed by a PAUSE: "im 16. Jahrhundert" → *sechzehn . Jahrhundert*.
 *
 * ⚠ THE DETECTOR IS BUILT FROM WHAT SURROUNDS `N.`, NOT FROM INTUITION:
 *   AFTER   Jahrhundert(s), month names, a few regiment names — and, critically, the sentence-final periods
 *           with NOTHING after them, which must NOT be claimed.
 *   BEFORE  am, im, des, dem, das, zum, vom, bis, ins, den.
 * So the rule fires on the FOLLOWING word (a month or Jahrhundert), or on a preceding date/ordinal-licensing
 * article plus a capitalised noun, which picks up the regiments. A sentence-final `N.` matches neither,
 * because nothing follows it and the word before is a content word.
 *
 * ⚠ DECLENSION COMES FROM THE SAME EVIDENCE, and it is TWO forms rather than full case agreement. The
 * governing preposition or article decides the ending: `am/im/vom/zum/dem/des/den/ins/seit/bis` take the weak
 * **-en** (*am siebzehnten September*, *des sechzehnten Jahrhunderts*), while `das/der/die` and a bare ordinal
 * take **-e** (*das sechzehnte Jahrhundert*).
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.German;

public static class Normalize
{
    private const string MONTHS = "Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember";
    /** Nouns that follow an ordinal numeral. `Jahrunderts` is the corpus's own misspelling, kept so the rule
     *  still fires on it. */
    private const string ORDINAL_NOUN = MONTHS + "|Jahrhundert|Jahrhunderts|Jahrunderts|Jh";
    /** Articles and prepositions that license an ordinal reading, and which of the two endings they govern. */
    private static readonly IReadOnlySet<string> WEAK_EN = new HashSet<string>(new[]
    {
        "am", "im", "vom", "zum", "beim", "dem", "des", "den", "ins", "seit", "bis", "ab", "nach", "vor", "zur",
    }, StringComparer.Ordinal);
    private static readonly IReadOnlySet<string> LICENSER =
        new HashSet<string>(WEAK_EN.Concat(new[] { "das", "der", "die", "ein", "eine", "sein", "ihr" }), StringComparer.Ordinal);

    /**
     * Integer → the German ordinal STEM. Below 20 the stem is the cardinal plus -t, above it plus -st, with
     * four suppletive stems (erst, dritt, siebt, and acht which already ends in t).
     */
    private static readonly IReadOnlyDictionary<int, string> IRREGULAR_STEM = new Dictionary<int, string>
    {
        [1] = "erst", [3] = "dritt", [7] = "siebt", [8] = "acht",
    };

    private static readonly JsRe HAS_DIGIT = JsRegex.Compile("\\d", "u");

    private static string? OrdinalStem(double n)
    {
        if (!(double.IsInteger(n) && Math.Abs(n) <= 9007199254740991d) || n < 1) return null;
        if (IRREGULAR_STEM.TryGetValue((int)n, out var irr)) return irr;
        var card = Numbers.NumberToWords(n);
        if (card == "" || HAS_DIGIT.IsMatch(card)) return null;
        return n < 20 ? $"{card}t" : $"{card}st";
    }

    /** Dotted abbreviations → the spoken words. `bzw.` ×13 and `usw.` ×7 are the frequent ones, and both were
     *  read as a consonant cluster plus a phrase break. */
    private static readonly IReadOnlyDictionary<string, string> DOTTED_ABBREV = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["bzw"] = "beziehungsweise", ["usw"] = "und so weiter", ["ca"] = "circa", ["evtl"] = "eventuell", ["ggf"] = "gegebenenfalls",
        ["inkl"] = "inklusive", ["exkl"] = "exklusive", ["bzgl"] = "bezüglich", ["einschl"] = "einschließlich",
        ["dr"] = "Doktor", ["prof"] = "Professor", ["st"] = "Sankt", ["hr"] = "Herr", ["fr"] = "Frau", ["nr"] = "Nummer",
        ["mio"] = "Millionen", ["mrd"] = "Milliarden", ["jh"] = "Jahrhundert", ["bd"] = "Band", ["s"] = "Seite", ["vgl"] = "vergleiche",
    };
    private static readonly string ABBREV_ALT = string.Join("|", DOTTED_ABBREV.Keys.OrderByDescending(k => k.Length));

    /** German letter names, for initialisms: USA is [uː ʔɛs ʔaː], not the word *usa*. */
    private static readonly IReadOnlyDictionary<string, string> LETTER_NAME = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["a"] = "a", ["b"] = "be", ["c"] = "ze", ["d"] = "de", ["e"] = "e", ["f"] = "eff", ["g"] = "ge", ["h"] = "ha", ["i"] = "i", ["j"] = "jott",
        ["k"] = "ka", ["l"] = "ell", ["m"] = "emm", ["n"] = "enn", ["o"] = "o", ["p"] = "pe", ["q"] = "ku", ["r"] = "err", ["s"] = "ess", ["t"] = "te",
        ["u"] = "u", ["v"] = "vau", ["w"] = "we", ["x"] = "iks", ["y"] = "üpsilon", ["z"] = "zett", ["ä"] = "ä", ["ö"] = "ö", ["ü"] = "ü",
    };

    /** German phonotactics, for the OOV rule in core/initialisms.ts. */
    public static readonly Func<string, bool> IsUnreadableGerman = Initialisms.MakeUnreadableTest(new PhonotacticsData
    {
        Vowels = JsRegex.Compile("[aeiouäöüy]", "u"),
        LegalOnsets = new HashSet<string>(new[]
        {
            "bl", "br", "ch", "dr", "fl", "fr", "gl", "gr", "kl", "kn", "kr", "pf", "pl", "pr", "ps",
            "qu", "sc", "sch", "sh", "sk", "sl", "sm", "sn", "sp", "st", "sw", "th", "tr", "tw", "vl", "vr", "zw",
            "ph", "gn", "schw", "wl",
        }, StringComparer.Ordinal),
        LegalCodas = new HashSet<string>(new[]
        {
            "ch", "ck", "ft", "ht", "lb", "ld", "lf", "lk", "lm", "ln", "lp", "ls", "lt", "lz", "mm",
            "mp", "ms", "nd", "nf", "ng", "nk", "ns", "nt", "nz", "pf", "ps", "rb", "rd", "rf", "rg",
            "rk", "rl", "rm", "rn", "rp", "rs", "rt", "rz", "sch", "sk", "sp", "st", "ss", "tt", "tz", "ts", "ks",
            "nn", "bt", "hl", "gt", "hr", "kt", "hn", "zt", "hm", "mt", "ll", "rr", "cht", "ngt",
        }, StringComparer.Ordinal),
        // ONE phoneme each — see PhonotacticsData.digraphs.
        Digraphs = new HashSet<string>(new[] { "ch", "sch", "tz", "ck", "ph", "th", "ng", "qu", "ss", "sh" }, StringComparer.Ordinal),
    });

    private static readonly IReadOnlySet<string> ACRONYM_LETTERS =
        new HashSet<string>(Manifest.MANIFEST.AcronymLetters, StringComparer.Ordinal);

    private static readonly Func<string, string> InitialismNormalizer =
        Initialisms.MakeInitialismNormalizer(new InitialismData
        {
            LetterName = l => LETTER_NAME.GetValueOrDefault(l),
            AcronymLetters = ACRONYM_LETTERS,
            IsRecorded = _ => false,
            IsUnreadable = IsUnreadableGerman,
        });

    /** German's lexicon is a stress/length correction table rather than a wordlist of attested forms, so it
     *  cannot serve as the "is this recorded" test. Acronyms are decided by the list plus the OOV rule. */
    public static string NormalizeGermanInitialisms(string text) => InitialismNormalizer(text);

    /** Normalize one German input string. Pure text→text. */
    /** A 4-digit year → the hundreds form German reads it in: 1945 → *neunzehnhundertfünfundvierzig*.
     *
     *  ⚠ RUNS AFTER THE SHARED SYMBOL TIER, not inside normalizeGerman, and the ordering is load-bearing in
     *  both directions. Every symbol rule — the degree arm here, and `%`/`€`/`$`/`×` in the shared tier — is
     *  keyed on a DIGIT next to the symbol. Rewriting the digits to words first leaves the symbol with nothing
     *  to attach to and it is dropped in silence: `1500 €` read as *fünfzehnhundert*, the currency simply gone.
     *  Running last also means this guard inspects SPELLED-OUT words (*Prozent*, *Euro*, *Kilometer*, *mal*)
     *  rather than the symbols and abbreviations they came from, which is one form per unit instead of two.
     *
     *  ⚠ THE RANGE STOPS AT 1999 AND AT 1100, and both bounds are real. German switched forms at the
     *  millennium — 2008 is *zweitausendacht*, never *zwanzighundertacht* — so a 20xx year takes the plain
     *  cardinal the number path already gives it. Below 1100 there is no hundreds form either: 1066 is
     *  *tausendsechsundsechzig*, not *zehnhundertsechsundsechzig*.
     *
     *  ⚠ NO CONTEXT CUE, deliberately, and this is where German differs from English. English gates its year
     *  rule on `in|of|since|…` because "2011 people died" is a live ambiguity; German writes a count of that
     *  size with a measure noun and writes a year bare — after a noun (*Festung 1620*), after a verb, at a
     *  sentence start. A preposition list reaches none of those. So the year reading is the default and
     *  NOT_A_YEAR carries the exceptions; widen that guard, not the cue. */
    private static readonly string MEASURE_STEM = string.Join("|", new[]
    {
        // ⚠ STEMS, matched with a trailing `\p{L}*`, because GERMAN INFLECTS THESE and an exact match with a
        //   `\b` misses every oblique case: *mit 1200 Einwohnern* is a count, and `Einwohner\b` fails on the
        //   dative -n. The stem list is what the shared tier and the unit table already spell out.
        "Prozent", "Grad", "Euro", "Cent", "Dollar", "Pfund", "Franken", "Kilometer", "Meter", "Zentimeter",
        "Millimeter", "Meile", "Kilogramm", "Gramm", "Tonne", "Liter", "Hektar", "Quadrat", "Kubik", "Volt",
        "Watt", "Stück", "Mal", "mal", "Million", "Milliarde", "Jahr", "Monat", "Tag", "Stunde", "Minute",
        "Sekunde", "Mann", "Mensch", "Einwohner", "Person", "Soldat", "Mitarbeiter", "Teilnehmer", "Besucher",
    });
    // ⚠ NO `\b` AFTER THE ALTERNATION and no bare symbols in it. `\b` is a WORD-boundary assertion, so after a
    //   non-word character (`%`, `°`, `€`, `$`) it only holds when a word character follows — `%\b` never
    //   matches `1200 %` at all, and every symbol alternative written that way is dead. Symbols are already
    //   spelled out by the time this runs, so the guard needs only the words.
    private static readonly string NOT_A_YEAR = $"(?!\\s*(?:{MEASURE_STEM})\\p{{L}}*)";
    private static readonly JsRe YEAR_RE =
        JsRegex.Compile($"(?<![\\d.,€$£¥₽₴])(1[1-9]\\d\\d)(?![.,]?\\d)(?![\\p{{L}}\\p{{M}}]){NOT_A_YEAR}", "giu");
    // The DECADE form, claimed first so `1980er` is not consumed as a bare year.
    // ⚠ ONLY ⟨er⟩ and ⟨ern⟩ — the two German forms. A looser `er[ns]?` also takes the English plural in
    //   `1980ers` and emits *neunzehnhundertachtzigers*, which is not a word in either language. What is left
    //   over must then stay a numeral, or the bare arm takes the digits and strands the suffix.
    private static readonly JsRe DECADE_RE = JsRegex.Compile("(?<![\\d.,])(1[1-9]\\d\\d)(ern?)(?![\\p{L}\\p{M}])", "gu");

    private static string YearWords(double y)
    {
        double hi = Math.Floor(y / 100), lo = y % 100;
        // German writes it solid, and inserts nothing for a lo under ten: 1905 → neunzehnhundertfünf.
        return $"{Numbers.NumberToWords(hi)}hundert{(lo == 0 ? "" : Numbers.NumberToWords(lo))}";
    }

    public static string NormalizeGermanYears(string input) =>
        YEAR_RE.Replace(
            DECADE_RE.Replace(input, m => $"{YearWords(Js.Number(m.Groups[1].Value))}{m.Groups[2].Value}"),
            m => YearWords(Js.Number(m.Groups[1].Value)));

    private static readonly JsRe ERA_BC = JsRegex.Compile("\\bv\\.\\s?Chr\\.", "giu");
    private static readonly JsRe ERA_AD = JsRegex.Compile("\\bn\\.\\s?Chr\\.", "giu");
    private static readonly JsRe ZB = JsRegex.Compile("\\bz\\.\\s?B\\.", "gu");
    private static readonly JsRe DH = JsRegex.Compile("\\bd\\.\\s?h\\.", "gu");
    private static readonly JsRe UA = JsRegex.Compile("\\bu\\.\\s?a\\.", "gu");
    private static readonly JsRe UAE = JsRegex.Compile("\\bu\\.\\s?Ä\\.", "gu");
    private static readonly JsRe ORD = JsRegex.Compile("(?:(\\p{L}+)(\\s+))?(\\d{1,4})\\.(?=\\s+(\\p{L}+))", "gu");
    private static readonly JsRe ORDINAL_NOUN_RE = JsRegex.Compile($"^(?:{ORDINAL_NOUN})$", "iu");
    private static readonly JsRe UPPER_START = JsRegex.Compile("^\\p{Lu}", "u");
    private static readonly JsRe BARE_DAY_MONTH =
        JsRegex.Compile($"(?:(\\p{{L}}+)(\\s+))?(\\d{{1,2}})(\\s+)(?=(?:{MONTHS})(?![\\p{{L}}\\p{{M}}]))", "giu");
    private static readonly JsRe ABBREV_MID =
        JsRegex.Compile($"(?<!\\p{{Lu}}\\.[ \u00a0])\\b({ABBREV_ALT})\\.(\\s+)(?=[\\p{{L}}\\d])", "giu");
    private static readonly JsRe ABBREV_END =
        JsRegex.Compile($"\\b({ABBREV_ALT})\\.(?=\\s*(?:[.,;:!?»)]|$))", "giu");
    private static readonly JsRe CLOCK = JsRegex.Compile("\\b([01]?\\d|2[0-3])[:.]([0-5]\\d)\\b(?!\\.?\\d)(\\s*Uhr)?", "giu");
    private static readonly JsRe KMH = JsRegex.Compile("(\\d)\\s?km\\/h\\b", "gu");
    private static readonly JsRe MS = JsRegex.Compile("(\\d)\\s?m\\/s\\b", "gu");
    private static readonly JsRe DEG_C = JsRegex.Compile("(\\d)\\s?°\\s?C\\b", "giu");
    private static readonly JsRe DEG_F = JsRegex.Compile("(\\d)\\s?°\\s?F\\b", "giu");
    private static readonly JsRe DEG = JsRegex.Compile("(\\d)\\s?°", "gu");
    private static readonly JsRe MINUS = JsRegex.Compile("(^|[\\s(])[-−–](\\d)", "gu");
    private static readonly JsRe PLUS_MINUS = JsRegex.Compile("±", "gu");
    private static readonly JsRe PLUS_ATTACHED = JsRegex.Compile("(\\S)\\+\\s?(\\d)", "gu");
    private static readonly JsRe PLUS_LEADING = JsRegex.Compile("(^|\\s)\\+\\s?(\\d)", "gu");
    private static readonly JsRe EQUALS_RE = JsRegex.Compile("\\s?=\\s?", "gu");
    private static readonly JsRe LESS_THAN = JsRegex.Compile("\\s?<\\s?", "gu");
    private static readonly JsRe GREATER_THAN = JsRegex.Compile("\\s?>\\s?", "gu");
    private static readonly JsRe DIVIDE = JsRegex.Compile("\\s?÷\\s?", "gu");
    private static readonly JsRe FRACTION = JsRegex.Compile("\\b(\\d{1,3})\\/(\\d{1,3})\\b(?!\\s*[/\\d])", "gu");

    public static string NormalizeGerman(string input)
    {
        var s = input;

        // 1) ERA and the multi-dot abbreviations, before the single-dot rule so their interior dots are not
        //    left behind as phrase breaks. `v. Chr.` ×11, `z. B.` ×11.
        // ⚠ CASE-INSENSITIVE: FLEURS ships German lowercased, so `356 v. chr.` matched nothing and read as
        // *f . kʁ* — a consonant cluster plus two phrase breaks. Same wall as the ordinal rule below and the
        // English st./dr. work: lowercased input is real input. `v. chr.` has no lowercase homograph to catch
        // by mistake.
        s = ERA_BC.Replace(s, "vor Christus");
        s = ERA_AD.Replace(s, "nach Christus");
        s = ZB.Replace(s, "zum Beispiel");
        s = DH.Replace(s, "das heißt");
        s = UA.Replace(s, "unter anderem");
        s = UAE.Replace(s, "und Ähnliches");

        // 2) ORDINALS. See the file header for how the detector and the two endings were derived. One rule,
        //    two licensing conditions: the FOLLOWING word is a month or Jahrhundert (which alone covers ~100 of
        //    the 109 in the corpus), or the PRECEDING word is a date/ordinal-licensing article and a
        //    capitalised noun follows. A sentence-final "N." satisfies neither.
        s = ORD.Replace(s, m =>
        {
            var prev = m.Groups[1].Success ? m.Groups[1].Value : null;
            var sp = m.Groups[2].Success ? m.Groups[2].Value : null;
            var digits = m.Groups[3].Value;
            var next = m.Groups[4].Value;
            // ⚠ CASE-INSENSITIVE on the noun condition, because LOWERCASED INPUT IS REAL INPUT: FLEURS ships its
            // German transcripts lowercased, so `am 16. februar` matched nothing and read as a cardinal plus a
            // leaked phrase break (*zˈɛçt͡sen . fˈeːbʁuaːɐ̯*) while `am 16. Februar` was already correct. 103
            // utterances in the OmniVoice de_de corpus. Safe to fold: every name in ORDINAL_NOUN is a month or
            // Jahrhundert, and none of them has a lowercase German homograph that could be licensed by mistake.
            //
            // The SECOND condition still requires a capitalised noun, and deliberately: it is the one that has to
            // reject a sentence-final "N.", and on lowercased text capitalisation is the only signal separating the
            // two (the same wall the English st./dr. fix hit). So lowercased input gets the noun condition only —
            // which the corpus says is ~100 of the 109 cases anyway.
            // AND ≤ 31 on that condition, which is what stops the relaxation from reaching a SENTENCE BOUNDARY:
            // `im Jahr 1998. Mai war warm` otherwise reads 1998 as an ordinal. A German day is 1–31 and a century
            // likewise, so a larger number before a month or Jahrhundert is not a date. Checked against the corpus:
            // all 100 such ordinals are ≤ 31, so the guard costs nothing real. (This over-fire pre-dates the
            // case fold — `1998. Mai` hit it too — the guard just closes both at once.)
            var day = Js.Number(digits);
            var licensed = (day <= 31 && ORDINAL_NOUN_RE.IsMatch(next))
                || (prev is not null && LICENSER.Contains(prev.ToLowerInvariant()) && UPPER_START.IsMatch(next));
            if (!licensed) return m.Value;
            var stem = OrdinalStem(Js.Number(digits));
            if (stem is null) return m.Value;
            var ending = prev is not null && WEAK_EN.Contains(prev.ToLowerInvariant()) ? "en" : "e";
            return $"{prev ?? ""}{sp ?? ""}{stem}{ending}";
        });

        // 2b) A BARE NUMBER BEFORE A MONTH is still a date, and German reads a date ordinal. The rule above
        //     needs the dot German writes (`am 16. Februar`); corpora that strip punctuation do not have it,
        //     and the reader still says the ordinal — the OmniVoice audit heard *vierundzwanzigSTEN september*
        //     where we read the cardinal *vierundzwanzig*. Safe without the dot precisely because a month name
        //     follows: a number in that position is a day, never a quantity. Same <= 31 guard, same endings.
        s = BARE_DAY_MONTH.Replace(s, m =>
        {
            var prev = m.Groups[1].Success ? m.Groups[1].Value : null;
            var sp = m.Groups[2].Success ? m.Groups[2].Value : null;
            var digits = m.Groups[3].Value;
            var sp2 = m.Groups[4].Value;
            var stem = OrdinalStem(Js.Number(digits));
            if (stem is null) return m.Value;
            var ending = prev is not null && WEAK_EN.Contains(prev.ToLowerInvariant()) ? "en" : "e";
            return $"{prev ?? ""}{sp ?? ""}{stem}{ending}{sp2}";
        });

        // 3) DOTTED ABBREVIATIONS. The dot is consumed when the sentence continues so it cannot become a
        //    phrase break; at a phrase end it stays, because there it really is the sentence end.
        //    NOT AFTER ANOTHER INITIAL. `s.` is *Seite*, so `J. S. Bach` expanded to "J Seite Bach" — the
        //    single-letter entries in this table collide with personal initials, and contiguity is what tells
        //    them apart (core/initialisms.ts claims a run of two on the same reasoning). A lone `S. Bach` at a
        //    sentence start stays ambiguous and is left to the table, as before.
        //    The lookahead admits a DIGIT as well as a letter: `S. 42` and `Nr. 5` are the ordinary forms and
        //    neither matched before, so both leaked a raw letter plus a spurious pause.
        s = ABBREV_MID.Replace(s, m => $"{DOTTED_ABBREV[m.Groups[1].Value.ToLowerInvariant()]}{m.Groups[2].Value}");
        s = ABBREV_END.Replace(s, m => $"{DOTTED_ABBREV[m.Groups[1].Value.ToLowerInvariant()]}.");

        // 4) CLOCK, before the number tokenizer sees the separator. Both written forms occur and both were
        //    broken: the colon became a PAUSE with a spurious "null", and the dot form was read as a DECIMAL
        //    ("11.00 Uhr" → *elf komma null null*). German says "elf Uhr", "acht Uhr sechsundvierzig".
        //    ⚠ THE `Uhr` MUST BE MATCHED CASE-INSENSITIVELY, exactly as the degree scale below must be, and
        //    for the same reason: the corpus is case-folded. All 2987 German rows are lowercase, so a
        //    capital-only `Uhr` never matched, the optional group stayed empty, the rule inserted its own
        //    " Uhr", and the literal one survived — *acht Uhr dreissig uhr*. That is 24 of 24 clock rows in
        //    the corpus, i.e. the rule was case-correct and corpus-wrong. The word is re-emitted rather than
        //    echoed back, so a lowercase or shouted `UHR` still yields the one properly-cased noun.
        s = CLOCK.Replace(s, m =>
        {
            var h = Js.Number(m.Groups[1].Value);
            var min = Js.Number(m.Groups[2].Value);
            var head = $"{Numbers.NumberToWords(h)} Uhr";
            return min == 0 ? head : $"{head} {Numbers.NumberToWords(min)}";
        });

        // 5) UNITS the shared tier cannot express, and the degree signs.
        s = KMH.Replace(s, "$1 Kilometer pro Stunde");
        s = MS.Replace(s, "$1 Meter pro Sekunde");
        // ⚠ THE SCALE LETTER MUST BE MATCHED CASE-INSENSITIVELY. Case-folded text writes `32 °c`, and an
        //    uppercase-only rule drops it through to the bare-`°` arm below, leaving the `c` as a loose
        //    letter for the g2p (`c` → /k/ context-free): *zweiunddreissig Grad k*. Fleet-wide invariant,
        //    asserted in test/degree-scale-case.test.ts.
        s = DEG_C.Replace(s, "$1 Grad Celsius");
        s = DEG_F.Replace(s, "$1 Grad Fahrenheit");
        s = DEG.Replace(s, "$1 Grad");

        // 6) SIGNS.
        s = MINUS.Replace(s, "$1minus $2");
        // ⚠ ± IS A SINGLE CHARACTER (U+00B1), NOT A `+`, so no `+` rule can ever match inside it. It needs
        //    its own rule or the sign is dropped in silence; ordering against the `+` rule is free. The
        //    reading is this language's own two words juxtaposed, both taken from the plus and minus rules
        //    already in this file.
        s = PLUS_MINUS.Replace(s, " plus minus ");
        s = PLUS_ATTACHED.Replace(s, "$1 plus $2");
        s = PLUS_LEADING.Replace(s, "$1plus $2");

        // 6b) RELATIONAL AND DIVISION SIGNS. ⚠ THE SIGNS ARE UNATTESTED AND THE WORDS ARE NOT, and that
        //     distinction is the whole sourcing story. Searching de_de for `=`/`<`/`>`/`÷` finds nothing usable — every
        //     `<` in the fleet is an HTML tag — so a first pass concluded the corpus could not source these
        //     and only Wikipedia could. Wrong question: these readings are ordinary comparative PROSE, and the words
        //     are in the corpus in quantity.
        //
        //     Counted as TOKENS in de_de (4212 utterances):
        //       `kleiner als`   7 phrase hits   (kleiner ×22, als ×606)
        //       `geteilt durch` 2 phrase hits   (geteilt ×4,  durch ×171)
        //       `größer`        ×10             — the mirror of the attested `kleiner als`
        //       `gleich`        ×3 TOKEN, ×107 SUBSTRING  ⚠ see below
        //
        //     ⚠ `gleich` IS THE SUBSTRING TRAP AGAIN. 107 raw hits look decisive and 104 of them are inside
        //     `Vergleich`, `gleichzeitig`, `gleichfalls`. Only 3 are the standalone word. It is still attested — 3
        //     token hits is attestation — but a plain grep would have reported it as the best-sourced of the four when
        //     it is the thinnest. `attest.ts` exists because this error has been made four times before.
        //
        //     ⚠ AND `größer als` HAS ZERO PHRASE HITS while both its words are common. Phrase-level attestation is too
        //     strict a bar for a construction: the language's comparative is `ADJ + als`, `kleiner als` proves the
        //     construction, and `größer` proves the adjective. Requiring the exact pair would reject a reading the
        //     corpus fully supports.
        //
        //     German math register puts the copula in (`ist gleich`, `ist kleiner als`), but the sign appears in
        //     running text where the verb is already present or absent for its own reasons, so the bare form is what
        //     the rule emits — the same choice `en` makes with `equals` rather than `is equal to`.
        s = EQUALS_RE.Replace(s, " gleich ");
        s = LESS_THAN.Replace(s, " kleiner als ");
        s = GREATER_THAN.Replace(s, " größer als ");
        s = DIVIDE.Replace(s, " geteilt durch ");

        // 7) FRACTIONS. ½ is "ein halb"; the rest are the ordinal stem plus -el (ein Fünftel).
        s = FRACTION.Replace(s, m =>
        {
            var num = Js.Number(m.Groups[1].Value);
            var den = Js.Number(m.Groups[2].Value);
            if (den == 2) return num == 1 ? "ein halb" : $"{Numbers.NumberToWords(num)} halbe";
            var stem = OrdinalStem(den);
            return stem is null ? m.Value : $"{(num == 1 ? "ein" : Numbers.NumberToWords(num))} {stem}el";
        });

        return s;
    }
}
