/**
 * French (fr) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not already
 * a pronounceable word into words the existing pipeline speaks. Pure text→text; no IPA.
 *
 * One ordered pipeline of numbered steps, where ⚠ THE ORDER IS ITSELF LOAD-BEARING. The contract, as
 * everywhere in the fleet: emit plain French words and bare digits, and let the tokenizer / lexicon / g2p /
 * number compositor do the pronouncing.
 *
 * The couplings that bite:
 *   · Abbreviations run before initialisms, or `MM.` (Messieurs) is letter-spelled as EM-EM.
 *   · Roman numerals run before initialisms, or `Louis XIV` is letter-spelled as IXE-I-VÉ. Both are
 *     all-caps letter runs; only the numeral rule can tell them apart, so it gets first refusal.
 *   · Times run before units, or a unit rule for `h` eats the hour of `11 h 20` and leaves `20`.
 *   · `av. J.-C.` runs before the generic `av.` → avenue, since every instance in the corpus is the
 *     era marker, not a street.
 *   · Thousands-degrouping runs first so every later step sees one unbroken digit run.
 *
 * Dates and years need less than one might expect: French reads a year as a plain CARDINAL (1988 = mille
 * neuf cent quatre-vingt-huit), so there is no pair-wise year rule of the English "nineteen eighty-eight"
 * kind, and a day is a plain cardinal too. ⚠ The only irregular day is the 1st, an ordinal (1er janvier =
 * premier janvier).
 *
 * ⚠ FEMININE AGREEMENT IS THE TRAP IN TIMES: heure and minute are feminine, so 1 and any number ending in 1
 * take *une*, not *un* — `1 h 15` is "une heure quinze" and `4:41` is "quatre heures quarante et une".
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.French;

public static class Normalize
{
    /** Space characters used as digit-group separators in French typography: regular, NBSP, narrow NBSP,
     *  thin space. The FLEURS transcripts use NBSP (`5 000`, `9 h 30`, `n° 11`). */
    private const string GROUP_SPACE = "    ";

    /** Currency sign → [singular, plural], for the money-with-centimes rule. Mirrors the SYMBOLS config in
     *  french.ts, which owns the plain (no-centimes) currency case. */
    private static readonly IReadOnlyDictionary<string, string[]> CURRENCY_WORDS = new Dictionary<string, string[]>(StringComparer.Ordinal)
    {
        ["€"] = new[] { "euro", "euros" }, ["$"] = new[] { "dollar", "dollars" },
        ["£"] = new[] { "livre", "livres" }, ["¥"] = new[] { "yen", "yens" },
    };

    /** Months, for the date rules. */
    private const string MONTHS = "janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre";

    /**
     * Dotted abbreviations → the spoken words. Keyed lowercase; the corpus is lowercased throughout, so
     * these must not depend on capitalization. Each was checked against its corpus context: `m.` is
     * Monsieur (m. reid, m. hu, m. costello), `st.` is Saint (st. louis), `dr.` is docteur (le dr. damadian),
     * `av.` is the era marker in every instance (see AV_JC below, which claims those first).
     */
    private static readonly IReadOnlyDictionary<string, string> DOTTED_ABBREV = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["m"] = "monsieur", ["mm"] = "messieurs", ["mme"] = "madame", ["mmes"] = "mesdames",
        ["mlle"] = "mademoiselle", ["mlles"] = "mesdemoiselles",
        ["dr"] = "docteur", ["pr"] = "professeur", ["st"] = "saint", ["ste"] = "sainte", ["sts"] = "saints", ["stes"] = "saintes",
        ["cf"] = "confer", ["ex"] = "exemple", ["env"] = "environ",
        ["p"] = "page", ["pp"] = "pages", ["art"] = "article", ["vol"] = "volume", ["chap"] = "chapitre",
        ["éd"] = "édition", ["av"] = "avenue", ["bd"] = "boulevard", ["bld"] = "boulevard", ["jr"] = "junior",
        ["tél"] = "téléphone",
    };

    /**
     * Abbreviations Lexique ALREADY pronounces as a token (etc → [ɛtseteʁa], mme → [madam]). These only need
     * the dot removed so it cannot become a phrase break; expanding them was a regression — spelling out
     * "et cetera" made the g2p read *cetera* with a schwa, [e sətəʁa] instead of Lexique's [ɛtseteʁa].
     */
    private static readonly IReadOnlySet<string> DOT_ONLY =
        new HashSet<string>(new[] { "etc", "mme", "mmes", "mlle", "mlles" }, StringComparer.Ordinal);

    /** Undotted abbreviations. French normally writes these bare (le Dr Martin, Mme Curie); `dr`/`pr` are not
     *  French words, so expanding them unconditionally is safe. */
    private static readonly IReadOnlyDictionary<string, string> UNDOTTED_ABBREV = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["dr"] = "docteur", ["pr"] = "professeur",
    };

    /** French letter names, for initialisms. Verified individually through this engine: bé=[be], cé=[se],
     *  effe=[ɛf], ache=[aʃ], ku=[ky], esse=[ɛs] (NOT "èse", which voices to [ɛz]), ixe=[iks], zède=[zɛd].
     *  `w` and `y` are genuinely two words in French (double vé, i grec). */
    private static readonly IReadOnlyDictionary<string, string> LETTER_NAME = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["a"] = "a", ["b"] = "bé", ["c"] = "cé", ["d"] = "dé", ["e"] = "e", ["f"] = "effe", ["g"] = "gé", ["h"] = "ache", ["i"] = "i",
        ["j"] = "ji", ["k"] = "ka", ["l"] = "elle", ["m"] = "emme", ["n"] = "enne", ["o"] = "o", ["p"] = "pé", ["q"] = "ku",
        ["r"] = "erre", ["s"] = "esse", ["t"] = "té", ["u"] = "u", ["v"] = "vé", ["w"] = "double vé", ["x"] = "ixe",
        ["y"] = "i grec", ["z"] = "zède",
    };

    /**
     * French phonotactics, for the OOV rule in core/initialisms.ts. Legal onsets are obstruent + liquid plus
     * the s-/p- clusters and the digraphs standing for one sound; legal codas are broadly the liquid- and
     * nasal-final ones plus stop/fricative + s (the shape of a written plural, and of PACS [paks]). What is
     * NOT legal is the stop+stop / fricative+stop shape an initialism throws up: RATP /tp/, EDF /df/, and the
     * /tv/ onset of TVA.
     */
    public static readonly Func<string, bool> IsUnreadableFrench = Initialisms.MakeUnreadableTest(new PhonotacticsData
    {
        Vowels = JsRegex.Compile("[aeiouyàâäéèêëîïôöûüùœæ]", "u"),
        LegalOnsets = new HashSet<string>(new[]
        {
            "bl", "br", "cl", "cr", "dr", "fl", "fr", "gl", "gr", "pl", "pr", "tr", "vr", "kl", "kr",
            "ch", "ph", "th", "gn", "qu", "sc", "sp", "st", "ps", "pn", "pt", "sm", "sn", "gu", "rh", "ct",
        }, StringComparer.Ordinal),
        LegalCodas = new HashSet<string>(new[]
        {
            "bl", "br", "cl", "cr", "dr", "fl", "fr", "gl", "gr", "pl", "pr", "tr", "vr", "ch", "gn",
            "st", "sc", "sk", "sp", "ct", "pt", "ft", "xt", "ss", "tt", "ll", "mm", "nn", "pp", "rr", "ff",
            "rt", "rd", "rs", "rc", "rl", "rm", "rn", "rp", "rb", "rg", "rf", "rv", "rq",
            "lt", "ld", "ls", "lc", "lm", "lp", "lb", "lf", "lk", "lv",
            "nt", "nd", "ns", "nc", "nk", "ng", "mp", "mb",
            "cs", "ks", "ts", "ps", "bs", "ds", "gs", "fs", "ms",
        }, StringComparer.Ordinal),
    });

    /** LEXICAL: acronyms spelled out although their lowercase form is an attested French word. Authored in
     *  french.jsonc alongside the language's other hand-authored facts, not here. */
    private static readonly IReadOnlySet<string> ACRONYM_LETTERS =
        new HashSet<string>(Manifest.MANIFEST.AcronymLetters, StringComparer.Ordinal);

    private static readonly JsRe FINAL_UN = JsRegex.Compile("(^|[-\\s])un$", "u");

    /** Non-negative integer → words, with the final *un* feminized (heure/minute are feminine). */
    private static string FeminineWords(double n) => FINAL_UN.Replace(Numbers.NumberToWords(n), "$1une");

    /** An hour/minute pair → "onze heures vingt" / "une heure" / "zéro heure trente". */
    private static string TimeWords(double h, double? min)
    {
        var hourWord = h == 1 ? "heure" : "heures";
        var head = $"{FeminineWords(h)} {hourWord}";
        return min is null || min == 0 ? head : $"{head} {FeminineWords(min.Value)}";
    }

    /** Fraction denominators with a suppletive name; anything else uses the ordinal (1/5 = un cinquième). */
    private static readonly IReadOnlyDictionary<int, string> DENOMINATOR = new Dictionary<int, string>
    {
        [2] = "demi", [3] = "tiers", [4] = "quart",
    };

    private static string? FractionWords(int num, int den)
    {
        var baseWord = DENOMINATOR.GetValueOrDefault(den) ?? Ordinals.Ordinal(den);
        if (baseWord is null || den < 2) return null;
        // *tiers* is invariable; the others take the plural s.
        var plural = num > 1 && !baseWord.EndsWith("s", StringComparison.Ordinal) ? $"{baseWord}s" : baseWord;
        return $"{Numbers.NumberToWords(num)} {plural}";
    }

    /** Longest first, so `mmes` is not matched as `mme` + a stray s. */
    private static readonly string ABBREV_ALT =
        string.Join("|", DOTTED_ABBREV.Keys.Concat(DOT_ONLY).OrderByDescending(k => k.Length));

    private static readonly JsRe GROUP_SPACE_RE = JsRegex.Compile($"(\\d)[{GROUP_SPACE}](\\d{{3}})(?!\\d)", "gu");
    private static readonly JsRe NBSP_RUN = JsRegex.Compile("[   ]", "gu");
    private static readonly JsRe ERA_BC = JsRegex.Compile("\\bav(?:ant)?\\.?\\s*j\\.?\\s*-?\\s*c\\.?", "giu");
    private static readonly JsRe ERA_AD = JsRegex.Compile("\\bapr(?:ès)?\\.?\\s*j\\.?\\s*-?\\s*c\\.?", "giu");
    private static readonly JsRe DEGREE_SPACED = JsRegex.Compile("(\\d)\\s*°\\s*(?=[CF](?![\\p{L}\\p{M}]))", "gui");
    private static readonly JsRe NUMERO = JsRegex.Compile("\\bn[°º]\\s*(?=\\d)", "giu");
    private static readonly JsRe ABBREV_MID = JsRegex.Compile($"\\b({ABBREV_ALT})\\.(\\s+)(?=\\p{{L}})", "giu");
    private static readonly JsRe ABBREV_END = JsRegex.Compile($"\\b({ABBREV_ALT})\\.(?=\\s*(?:[.,;:!?»)]|$))", "giu");
    private static readonly JsRe UNDOTTED = JsRegex.Compile("\\b(dr|pr)\\b\\.?(?=\\s+\\p{L})", "giu");
    private static readonly JsRe NAME_INITIAL = JsRegex.Compile("\\b([a-zà-ÿ])\\.(\\s+)(?=[\\p{L}])", "giu");
    private static readonly JsRe MONEY_POST = JsRegex.Compile("(\\d+),(\\d{2})\\s?([€$£¥])", "gu");
    private static readonly JsRe MONEY_PRE = JsRegex.Compile("([€$£¥])\\s?(\\d+),(\\d{2})", "gu");
    private static readonly JsRe PLUS_MINUS = JsRegex.Compile("±", "gu");
    private static readonly JsRe PLUS_ATTACHED = JsRegex.Compile("(\\S)\\+\\s?(\\d)", "gu");
    private static readonly JsRe PLUS_LEADING = JsRegex.Compile("(^|\\s)\\+\\s?(\\d)", "gu");
    private static readonly JsRe MINUS = JsRegex.Compile("(^|[\\s(])[-−–](\\d)", "gu");
    private static readonly JsRe EQUALS_RE = JsRegex.Compile("\\s?=\\s?", "gu");
    private static readonly JsRe LESS_THAN = JsRegex.Compile("\\s?<\\s?", "gu");
    private static readonly JsRe GREATER_THAN = JsRegex.Compile("\\s?>\\s?", "gu");
    private static readonly JsRe DIVIDE = JsRegex.Compile("\\s?÷\\s?", "gu");
    private static readonly JsRe FRACTION = JsRegex.Compile("\\b(\\d{1,3})/(\\d{1,3})\\b(?!\\s*/?\\d)", "gu");
    private static readonly JsRe CLOCK_H = JsRegex.Compile("\\b([01]?\\d|2[0-3])\\s*[hH]\\s*([0-5]\\d)?(?![\\p{L}\\p{M}\\d])", "gu");
    private static readonly JsRe CLOCK_COLON = JsRegex.Compile("\\b([01]?\\d|2[0-3]):([0-5]\\d)(?![\\d:])(?!\\.\\d)", "gu");
    private static readonly JsRe NUMERIC_DATE = JsRegex.Compile("\\b(\\d{1,2})[/.](\\d{1,2})[/.](\\d{4})\\b", "gu");
    private static readonly JsRe FIRST_OF_MONTH = JsRegex.Compile($"\\b1\\s+({MONTHS})\\b", "giu");

    /**
     * Normalize one French input string. Pure text→text.
     *
     * `isWord` is the Lexique membership test, passed in by french.ts (the lexicon lives there, and taking
     * it as a parameter keeps this module free of both an import cycle and mutable state). It decides
     * whether an all-caps run is an acronym to be read as a word or an initialism to be spelled out.
     */
    public static string NormalizeFrench(string input, Func<string, bool> isWord)
    {
        var s = input;

        // 0) DIGIT GROUPING: French groups thousands with a space (5 000 = five thousand). The tokenizer's
        //    number class does not span a space, so "5 000 ans" read as "cinq zéro ans" — two numbers, and
        //    the thousand lost. Degroup to one digit run, but ONLY for exact 3-digit blocks, or "30 9" would
        //    fuse two unrelated numbers.
        s = GROUP_SPACE_RE.Replace(s, "$1$2");
        s = GROUP_SPACE_RE.Replace(s, "$1$2"); // millions: 1 234 567
        //    Remaining non-breaking spaces become ordinary ones so every later pattern can use \s.
        s = NBSP_RUN.Replace(s, " ");

        // 1) ERA MARKERS, before the generic `av.` → avenue: every "av." in the corpus is this.
        s = ERA_BC.Replace(s, "avant Jésus-Christ");
        s = ERA_AD.Replace(s, "après Jésus-Christ");

        // 1b) THE DEGREE SIGN, SPACED. French typography puts a space before `°C`, and the corpus writes
        //     `une chaleur de 32 ° C` — with blanks on BOTH sides of the sign. The tier reads the degree through
        //     its `"°c"` UNIT KEY, which needs the two characters adjacent, so the spaced form matched nothing and
        //     the whole `° C` was DROPPED: the sentence read "trente-deux" with no unit at all. Closed up here
        //     rather than by loosening the tier's key, because a key is a spelling and this is whitespace.
        //     Only between a DIGIT and the scale letter, so an ordinary `°` (bearings, `n°`) is untouched.
        s = DEGREE_SPACED.Replace(s, "$1°");

        // 2) NUMÉRO: n° / nº before a number.
        s = NUMERO.Replace(s, "numéro ");

        // 3) DOTTED ABBREVIATIONS. The dot is CONSUMED when the sentence continues (a following word), so it
        //    cannot become a phrase break — the defect behind the reported English "St. James" pause. At a
        //    phrase end the dot stays, because there it really is the sentence end.
        s = ABBREV_MID.Replace(s, m =>
        {
            var ab = m.Groups[1].Value;
            var sp = m.Groups[2].Value;
            var key = ab.ToLowerInvariant();
            return DOT_ONLY.Contains(key) ? $"{ab}{sp}" : $"{DOTTED_ABBREV[key]}{sp}";
        });
        s = ABBREV_END.Replace(s, m =>
        {
            var ab = m.Groups[1].Value;
            return DOT_ONLY.Contains(ab.ToLowerInvariant()) ? m.Value : $"{DOTTED_ABBREV[ab.ToLowerInvariant()]}.";
        });

        // 3b) UNDOTTED abbreviations, which is how French normally writes them (le Dr Martin).
        s = UNDOTTED.Replace(s, m => UNDOTTED_ABBREV[m.Groups[1].Value.ToLowerInvariant()]);

        // 4) NAME INITIALS: a single letter + dot before a word is an initial, read as the LETTER NAME
        //    ("n. wayne hale" → "enne wayne hale"). Runs after step 3 so the honorifics (m., p.) win.
        s = NAME_INITIAL.Replace(s, m =>
        {
            var name = LETTER_NAME.GetValueOrDefault(m.Groups[1].Value.ToLowerInvariant());
            return name is null ? m.Value : $"{name}{m.Groups[2].Value}";
        });

        // 4b) MONEY with centimes: "deux euros cinquante", not "deux virgule cinquante euro" — a decimal
        //     reading of a price is wrong in a way listeners notice. Runs before SYMBOLS, which owns the
        //     plain currency case. The symbol normally follows the amount in French; both orders are matched.
        s = MONEY_POST.Replace(s, m =>
        {
            var (intPart, cents, sym) = (m.Groups[1].Value, m.Groups[2].Value, m.Groups[3].Value);
            var forms = CURRENCY_WORDS[sym];
            var unit = intPart == "1" ? forms[0] : forms[1];
            return cents == "00" ? $"{intPart} {unit}" : $"{intPart} {unit} {Js.NumberToString(Js.Number(cents))}";
        });
        s = MONEY_PRE.Replace(s, m =>
        {
            var (sym, intPart, cents) = (m.Groups[1].Value, m.Groups[2].Value, m.Groups[3].Value);
            var forms = CURRENCY_WORDS[sym];
            var unit = intPart == "1" ? forms[0] : forms[1];
            return cents == "00" ? $"{intPart} {unit}" : $"{intPart} {unit} {Js.NumberToString(Js.Number(cents))}";
        });

        // 4c) PLUS. The mirror of the negative rule below: a dropped sign is silent content loss, and "+5"
        //     read as "cinq" is as wrong as "-5" read as "cinq" was. Covers the attached form (utc+1).
        //     Emits the ordinary spelling `plus`; the HETERONYM map in french.jsonc supplies the [plys]
        //     operator reading, selected by the number that follows. This replaced a "plusse" respelling that
        //     existed only because Lexique carries just the [ply] "more" reading.
        // ⚠ ± IS A SINGLE CHARACTER (U+00B1), NOT A `+`, so no `+` rule can ever match inside it. It needs
        //    its own rule or the sign is dropped in silence; ordering against the `+` rule is free. The
        //    reading is this language's own two words juxtaposed, both taken from the plus and minus rules
        //    already in this file.
        s = PLUS_MINUS.Replace(s, " plus moins ");
        s = PLUS_ATTACHED.Replace(s, "$1 plus $2");
        s = PLUS_LEADING.Replace(s, "$1plus $2");

        // 5) NEGATIVES: a minus sign before a number is spoken. Requires a boundary before it so a hyphenated
        //    range or a score ("2-1", "1918-1939") is not turned into a subtraction.
        s = MINUS.Replace(s, "$1moins $2");

        // 5b) RELATIONAL AND DIVISION SIGNS. ⚠ SEARCH FOR THE WORDS, NEVER FOR THE SIGN — the notation is
        //     absent from fr_fr (every `<` in the fleet is an HTML tag) while the vocabulary is ordinary prose.
        //
        //     ⚠ AND FRENCH INFLECTS, SO AN EXACT-FORM TOKEN COUNT UNDER-REPORTS THE LEMMA. Counted in fr_fr
        //     (4158 utterances) the citation forms look thin, and the substring column is where the word actually
        //     is — as inflection, not as a longer unrelated word:
        //
        //       `inférieur`   ×5 TOKEN                      — attested outright
        //       `supérieur`   ×0 token / ×18 SUBSTRING      — all `supérieure(s)`, the feminine/plural of the SAME
        //                                                     adjective, in 16 distinct utterances
        //       `divisé`      ×0 token / ×2 SUBSTRING       — `divisée`, `divisées`: same past participle
        //       `égal`        ×3 TOKEN / ×211 substring     ⚠ the 211 are `également` — see below
        //
        //     ⚠ `égale` IS THE SUBSTRING TRAP, AND IT IS THE SHARPEST INSTANCE YET: ×0 TOKEN / ×190 SUBSTRING, and
        //     every one of the 190 is inside `également` ("also"), a word with no arithmetic sense at all. A plain
        //     grep would have called it the best-attested of the four. That is the sixth time this error has been
        //     caught, and the first where the containing word means something entirely unrelated.
        //
        //     ⚠ THE READING IS QUOTED VERBATIM FROM THE CANONICAL SOURCE. The register tier
        //     (`attest.ts --context "mathématiques arithmétique division"`) put fr.wikipedia's Division article in
        //     the sample, and that article reads the whole expression aloud, both signs in one sentence, between
        //     two operands:
        //
        //       « a divisé par b est égal à c »
        //
        //     with the inequalities attested in the same register on numeric operands ("le plus grand multiple de 7
        //     inférieur à 93", "tout nombre pair strictement supérieur à 2").
        //
        //     ⚠ THE COPULA IS KEPT HERE, unlike de/es/en, and that is a fact about French rather than a change of
        //     policy. `sept égal à trois` is not a French construction — the adjective needs its verb — so the
        //     bare form those languages use has no French equivalent to drop to. `lb` (`ass gläich`) and `nb`
        //     (`er lik`) already ship the copular form, so the fleet has both shapes and this picks the one the
        //     language admits. `divisé par` is a participle and needs no verb ("3 564 divisé par 17").
        s = EQUALS_RE.Replace(s, " est égal à ");
        s = LESS_THAN.Replace(s, " est inférieur à ");
        s = GREATER_THAN.Replace(s, " est supérieur à ");
        s = DIVIDE.Replace(s, " divisé par ");

        // 6) FRACTIONS. Guarded against a date (14/07/1789) and against a unit ratio (km/h) by requiring
        //    digits on both sides and nothing numeric after.
        s = FRACTION.Replace(s, m =>
            FractionWords((int)Js.Number(m.Groups[1].Value), (int)Js.Number(m.Groups[2].Value)) ?? m.Value);

        // 7) TIMES. The `h` form is the French standard (11 h 20, 20h30) and is what the corpus uses; the
        //    colon form also occurs. Both were losing the hour marker completely — "11 h 20" read as "onze
        //    vingt", and "4:41" turned the colon into a pause mark.
        s = CLOCK_H.Replace(s, m => TimeWords(
            Js.Number(m.Groups[1].Value),
            m.Groups[2].Success && m.Groups[2].Value.Length > 0 ? Js.Number(m.Groups[2].Value) : null));
        //    ⚠ A FRACTIONAL PART MEANS IT IS NOT A TIME OF DAY, and the guard must reject it. `4:41.20` is a
        //    race time — minutes, seconds, hundredths — and without this the clock rule claimed it and asserted
        //    an hour on a four-minute race: *quatre HEURES quarante-et-un*, with the `.20` left over as a stray
        //    pause. The corpus carries one such sentence (a Paralympic result, translated into 45 languages),
        //    so the footprint is small and the reading is flatly wrong. ⚠ THIS DECLINES, IT DOES NOT READ:
        //    a proper duration reading needs its own per-language sourcing, and inventing one would score well
        //    while staying wrong — see the trap documented in tools/corpus/numeral_register.mts. German uses
        //    the same `(?!\.?\d)` shape; a clock at the end of a sentence (`à 4:41.`) still matches.
        s = CLOCK_COLON.Replace(s, m => TimeWords(Js.Number(m.Groups[1].Value), Js.Number(m.Groups[2].Value)));

        // 8) DATES. A numeric date is day-first in French. Then a bare day 1 before a month name becomes the
        //    ordinal (1 janvier → premier janvier); every other day is a plain cardinal and already correct.
        s = NUMERIC_DATE.Replace(s, m =>
        {
            var (d, mo, y) = (m.Groups[1].Value, m.Groups[2].Value, m.Groups[3].Value);
            var monthIdx = (int)Js.Number(mo) - 1;
            var months = MONTHS.Split('|');
            if (monthIdx < 0 || monthIdx >= months.Length || Js.Number(d) < 1 || Js.Number(d) > 31) return m.Value;
            return $"{(Js.Number(d) == 1 ? Ordinals.Ordinal(1) : d)} {months[monthIdx]} {y}";
        });
        s = FIRST_OF_MONTH.Replace(s, m => $"{Ordinals.Ordinal(1)} {m.Groups[1].Value}");

        return s;
    }

    /**
     * INITIALISMS. A SEPARATE pass from `normalizeFrench` because of where it must sit in the order: Roman
     * numerals are all-caps letter runs too (`Louis XIV`), so the numeral rules get first refusal and this
     * claims only what they declined. The decision order and its measurement live in core/initialisms.ts.
     */
    public static string NormalizeFrenchInitialisms(string text, Func<string, bool> isRecorded)
    {
        // ⚠ NOT HOISTED TO A STATIC FIELD like the other ports' initialism normalizers: this one closes over
        // `isRecorded`, the Lexique membership test the caller supplies, so it is rebuilt per call exactly as
        // the TS `makeInitialismNormalizer({...})(text)` is.
        return Initialisms.MakeInitialismNormalizer(new InitialismData
        {
            LetterName = l => LETTER_NAME.GetValueOrDefault(l),
            AcronymLetters = ACRONYM_LETTERS,
            IsRecorded = isRecorded,
            IsUnreadable = IsUnreadableFrench,
        })(text);
    }
}
