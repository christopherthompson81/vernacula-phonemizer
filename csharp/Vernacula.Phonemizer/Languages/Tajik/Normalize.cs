/**
 * Tajik (tg) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not already a
 * pronounceable word into words the pipeline speaks. Pure text→text; no IPA.
 *
 * ⚠ TAJIK IS PERSIAN IN CYRILLIC, so two precedent families apply and they disagree. Every rule below was
 * re-measured against the language's own text rather than inherited, and the split came out mixed:
 *
 *   RUSSIAN CONVENTIONS THAT SURVIVED — the decimal COMMA (5,819 articles), the SPACE thousands separator
 *   (7,348), the Cyrillic unit abbreviations км м см мм кг т га (5,685 for `км` alone), the magnitude
 *   abbreviations млн/млрд, the dotted D.MM.YYYY date (3,659) and the em dash as a copula.
 *   PERSIAN CONVENTIONS THAT SURVIVED — the percent word дарсад (درصد), the ordinal suffix -ум/-юм
 *   (3,675 + 793 articles), the range preposition то, and the Arabic-Persian measure words мураббаъ /
 *   мукааб for ² and ³, which take the IZOFAT on the head noun (километри мураббаъ).
 *   RUSSIAN CONVENTIONS THAT DID NOT — the whole `dotted` abbreviation cell. 13,693 corpus occurrences of a
 *   dotted Cyrillic abbreviation, and its evidence is RUSSIAN: `М.` (Moscow) ×26, `Т.` (том) ×7, `А.` ×22,
 *   `В.` ×17 are the bibliography blocks that end a tg.wikipedia article. 7.0% of the mined artifact is
 *   Russian-language text and it is not spread evenly — it lands in exactly the cells a Cyrillic normalizer
 *   would mine. No rule here touches them. (See `docs/investigations/tg_normalization_investigation.md`.)
 *
 * ⚠ THE ONE CHARACTER THAT SPLITS A TAJIK WORD IS NOT A LETTER. All 35 letters, including ғ ӣ қ ӯ ҳ ҷ, are
 * inside the engine's `[Ѐ-ӿ]` token class — probed one by one, bound inside a word, 0 defective. The SOFT
 * HYPHEN is not: 54 occurrences in 13 of 456 segments, and `Осиёи Мар­ка­зӣ` read as three words with three
 * stresses. Step 0 strips it.
 *
 * ⚠ Every boundary in this file is an explicit lookaround, never `\b` — `\b` is ASCII-defined and finds no
 * boundary against Cyrillic (playbook trap 1).
 *
 * ⚠ WHAT IS DELIBERATELY NOT READ, with its counts, is in step 12. The decimal SEPARATOR is the largest of
 * them and the refusal is sourced, not lazy.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Tajik;

public static class Normalize
{
    // ---------------------------------------------------------------------------------------------------
    // ORDINALS — the Persian side of the language, and its highest-traffic native pattern
    // ---------------------------------------------------------------------------------------------------

    private static readonly JsRe ENDS_VOWEL = JsRegex.Compile("[аоеиуӯёюяӣэ]$", "u");

    /**
     * Tajik ordinal ending: -юм after a vowel, -ум after a consonant. ONLY THE LAST ELEMENT TAKES IT, exactly as
     * in Persian — `129-ум` is *саду бисту нӯҳум*, not *садуми бисту нӯҳ*.
     *
     * ⚠ `сӣ` (30) IS THE ONE IRREGULAR: the long ӣ shortens before the ending, giving сиюм and not *сӣюм*.
     * Attested ×20 in 20 articles, which is what settles it. The eight forms the composition produces that
     * `attest.ts` could check all match: якум ×35, дуюм ×22, сеюм ×27, чорум ×42, панҷум ×19, ҳаштум ×20,
     * садум ×14, сиюм ×20.
     */
    private static string OrdinalEnding(string word)
    {
        if (word == "сӣ") return "сиюм";
        return ENDS_VOWEL.IsMatch(word) ? $"{word}юм" : $"{word}ум";
    }

    /** Integer → the Tajik ordinal in ORTHOGRAPHY (emitted as text, phonemized by the g2p). */
    public static string? TajikOrdinal(double n)
    {
        if (!double.IsInteger(n) || n < 1 || n > 999_999) return null;
        var parts = TajikPhonemizer.NumberWords(n).Split(' ');
        var last = parts.Length > 0 ? parts[^1] : null;
        if (last is null || last == "") return null;
        parts[^1] = OrdinalEnding(last);
        return string.Join(" ", parts);
    }

    /**
     * Glue a bound suffix to the LAST WORD of a spoken number. ⚠ AGREEMENT CANNOT BE APPLIED TO DIGITS
     * (playbook trap 14): `129-умро` is one word *нӯҳумро* at the end of three, and the enclitic cannot attach
     * to anything until the digits have become words. So the operand is wordified first, here, and only then
     * does the suffix land.
     */
    private static string GlueSuffix(string words, string suffix)
    {
        var parts = words.Split(' ');
        parts[^1] = $"{parts[^1]}{suffix}";
        return string.Join(" ", parts);
    }

    /** The Tajik enclitics that appear glued to a numeral, a percent sign or a unit in the corpus. */
    private const string SUFFIX = "ро|и|ест|аш|ат|ам|он|ҳо";

    // ---------------------------------------------------------------------------------------------------
    // INITIALISMS — the seam already exists, and this language's biggest untreated class
    // ---------------------------------------------------------------------------------------------------

    /**
     * Tajik phonotactics for the OOV half of `core/initialisms.ts`.
     *
     * ⚠ TAJIK, LIKE PERSIAN, HAS NO NATIVE INITIAL CLUSTER AT ALL — a word begins C-V. The onsets listed are
     * therefore the RUSSIAN-LOAN inventory the language has actually absorbed (пл-, тр-, ст-, кл- in план,
     * трактор, стансия, клуб); listing them is what keeps a caps-set Tajik headword like КАРБОН or БЕНИН from
     * being spelled out letter by letter, which the encyclopedia's own headword style would otherwise trigger.
     *
     * ⚠ THE CODA SET IS WIDE ON PURPOSE. Tajik ends words in two consonants routinely — шаҳр, ҳашт, гурд, ранг,
     * панҷ — and an over-tight coda list would spell out ordinary words.
     */
    public static readonly Func<string, bool> IsUnreadableTajik = Initialisms.MakeUnreadableTest(new PhonotacticsData
    {
        Vowels = JsRegex.Compile("[аеёиоуыэюяӣӯ]", "u"),
        LegalOnsets = new HashSet<string>(new[]
        {
            "бл", "бр", "гл", "гр", "др", "кл", "кр", "пл", "пр", "сл", "см", "сп", "ст", "тр",
            "фл", "фр", "хл", "хр", "шк", "шл", "шп", "шт", "зв", "св", "тв", "дв", "сн",
        }, StringComparer.Ordinal),
        LegalCodas = new HashSet<string>(new[]
        {
            "ст", "шт", "фт", "хт", "ҳт", "нт", "нд", "нг", "нҷ", "нч", "нз", "нс", "мб", "мп",
            "рб", "рд", "рг", "рз", "рк", "рқ", "рм", "рн", "рс", "рт", "рф", "рх", "рҳ", "рҷ", "рш",
            "лб", "лд", "лк", "лм", "лт", "лф", "хш", "шк", "зм", "сб", "ск", "ср", "тр", "др", "бр", "гр",
        }, StringComparer.Ordinal),
    });

    private static IReadOnlyDictionary<string, string> LETTER_NAME => Manifest.MANIFEST.LetterNames;
    private static readonly IReadOnlySet<string> ACRONYM_LETTERS =
        new HashSet<string>(Manifest.MANIFEST.AcronymLetters, StringComparer.Ordinal);

    /**
     * Spell an unreadable all-caps run with Tajik letter names. `СММ` → *се ме ме*, `ММД` → *ме ме де*,
     * `ТВ` → *те ве*. Before this, each reached the g2p as a vowel-less cluster — `smm`, `mmd`, `tv` — which is
     * exactly what `core/initialisms.ts` exists to prevent (playbook trap 16).
     *
     * `isRecorded` is `false`: Tajik has no pronunciation dictionary in this tree, so the decision rests on the
     * lexical list plus the OOV test alone — the same position Russian is in.
     */
    private static readonly Func<string, string> INITIALISMS = Initialisms.MakeInitialismNormalizer(new InitialismData
    {
        LetterName = l => LETTER_NAME.GetValueOrDefault(l),
        AcronymLetters = ACRONYM_LETTERS,
        IsRecorded = _ => false,
        IsUnreadable = IsUnreadableTajik,
    });

    public static string NormalizeTajikInitialisms(string text) => INITIALISMS(text);

    // ---------------------------------------------------------------------------------------------------
    // THE SHARED SYMBOL TIER
    // ---------------------------------------------------------------------------------------------------

    /**
     * ⚠ DECLARED IN `normalize.ts`, AND CALLED FROM INSIDE IT rather than around it — the ordering below is not
     * free. The tier matches a number ADJACENT to its sign, and three of this layer's own steps destroy that
     * adjacency: the decimal comma becomes a space, `%-и` strands its enclitic, and the range rule inserts a
     * word between two numbers. So the tier sits at step 9, after everything that must see the raw text and
     * before everything that rewrites what it matches on (playbook trap 39).
     *
     * ⚠ THE EXPONENT IS DECLARED AS COMPOUND UNIT KEYS, NOT THROUGH `exponentWords`, and that is a genuine
     * "the tier cannot say it" case (trap 47 reason 1). Tajik postposes the measure word AND puts the IZOFAT on
     * the head noun: *километри мураббаъ*, not *километр мураббаъ*. `exponentWords.position: "after"` would emit
     * the second. Keys are matched longest-first, so `км²` wins over `км` and nothing else is needed.
     *
     * ⚠ ONE-LETTER KEYS `м` AND `т`, AND WHAT THEY COST (trap 46). Both are attested after a numeral
     * (`/[0-9] метр/` → 10,041 articles, `вазнаш то 3 т`), and both are also Russian bibliographic
     * abbreviations — but `М., 1964` and `т. VIII` are never preceded by a number, and the tier only matches
     * after one, so the citation blocks are untouched. The residual cost is real and small: the artifact's one
     * `1362 ш. / 1983 м.` is a Hijri/Gregorian year pair inside a Persian book citation and will read `м` as
     * *метр*. One instance in 456 segments, recorded rather than hidden.
     */
    private static readonly Func<string, string> SYMBOLS = NormalizeSymbols.MakeSymbolNormalizer(new SymbolData
    {
        // ⚠ `дарсад`, NOT `фоиз`, AND IT IS THE CLOSEST CALL IN THIS LAYER. Both are real Tajik words for
        // "percent" and both are attested; фоиз is even Wikidata's own tg label for the concept. дарсад wins on
        // every SLOT-specific measure: ×19 in 11 mined segments against фоиз ×3 in 3; `/[0-9] дарсад/` 303
        // articles against `/[0-9] фоиз/` 248; and two segments write the sign AND the word together —
        // `аз 45 % дарсад ба 66 %` and `23,1% дарсад` — which is the only direct evidence anywhere of how the
        // SIGN is spoken, and it says дарсад both times.
        // ⚠ The phrase probe that looked like it settled this was lying: `insource:"% фоиз"` returns exactly the
        // same 541 as `insource:"фоиз"`, because the search analyzer strips `%`. Only `insource:/…/` sees a sign.
        Percent = new[] { "дарсад" },
        // `1 доллар = 100 сент` is tg.wikipedia's own definition of the sign's currency; сомонӣ ×70/12 is the
        // national one but has no sign in the corpus, so it is not declared. €/£ are declared because the tier
        // only spends a currency word when its sign is present.
        Currency = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["$"] = new[] { "доллар" }, ["€"] = new[] { "евро" }, ["£"] = new[] { "фунт" },
        },
        Units = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            // squared/cubed FIRST in intent — the tier sorts longest-first, so these win over the bare key.
            // Sourced from tg.wikipedia's own unit article, which defines the abbreviation in its first line:
            // «Километри мураббаъ (км², км кв., англ. km²) — воҳиди ченаки масоҳат» … «километри мукааб — km³».
            // ⚠ THE ASCII EXPONENT IS DECLARED BESIDE THE SUPERSCRIPT ONE, in both scripts. The corpus writes
            // `24,751 km2` and `2,65 нафар/км2` as well as `135 620 км²`, and an undeclared `km2` leaves the `2`
            // to be read as a SEPARATE NUMBER — *…километр ду*, which is the `mm2` defect trap 37 found in
            // fr/id/ne, arriving here through a different door.
            ["км²"] = new[] { "километри мураббаъ" }, ["м²"] = new[] { "метри мураббаъ" }, ["см²"] = new[] { "сантиметри мураббаъ" },
            ["км³"] = new[] { "километри мукааб" }, ["м³"] = new[] { "метри мукааб" }, ["см³"] = new[] { "сантиметри мукааб" },
            ["км2"] = new[] { "километри мураббаъ" }, ["м2"] = new[] { "метри мураббаъ" }, ["км3"] = new[] { "километри мукааб" },
            ["km²"] = new[] { "километри мураббаъ" }, ["km2"] = new[] { "километри мураббаъ" }, ["km³"] = new[] { "километри мукааб" },
            ["км"] = new[] { "километр" }, ["м"] = new[] { "метр" }, ["см"] = new[] { "сантиметр" }, ["мм"] = new[] { "миллиметр" },
            ["кг"] = new[] { "килограмм" }, ["т"] = new[] { "тонна" }, ["га"] = new[] { "гектар" },
            ["МВт"] = new[] { "мегаватт" }, ["кВт"] = new[] { "киловатт" }, ["ГВт"] = new[] { "гигаватт" },
            // LATIN KEYS TOO, for the same reason kk needed them: the corpus writes both, and the Latin form
            // reaches the ENGLISH foreign fallback — `24,751 km2` read as the cluster [ˈʊkm] (trap 38). Bare
            // Latin `m` is deliberately absent (trap 46: `802.11m`); the Cyrillic `м` is not exposed that way
            // because a version's trailing letter is never Cyrillic.
            ["km"] = new[] { "километр" }, ["cm"] = new[] { "сантиметр" }, ["mm"] = new[] { "миллиметр" }, ["kg"] = new[] { "килограмм" },
        },
        // `нафар дар километри квадратӣ` is how tg.wikipedia spells out its own `нафар/км²`, and `Километр/соат`
        // is the title of its km/h article — so the connective is `дар` and the hour noun is `соат` (×71/20).
        UnitPer = "дар",
        RateDenominators = new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["соат"] = "соат", ["сония"] = "сония", ["сон"] = "сония",
        },
        Magnitudes = new[] { "миллиард", "миллион", "ҳазор", "триллион" },
        // `&` was dropped outright (×3 DROP + ×4 inside a foreign run). `ва` is the Tajik conjunction and the
        // tier spaces it, because `Blohm & Voss` is two tokens and joining them would make one.
        Ampersand = "ва",
    });

    // ---------------------------------------------------------------------------------------------------
    // THE RULES
    // ---------------------------------------------------------------------------------------------------

    private static string[] MONTHS => Manifest.MANIFEST.Months;

    // The step patterns. The TS builds each inline in `normalizeTajik`; JsRegex.Compile caches, so hoisting
    // them is a readability choice and not a behaviour one.
    private static readonly JsRe SOFT_HYPHEN = JsRegex.Compile("\\u00ad", "gu");
    private static readonly JsRe NBSP_ENTITY = JsRegex.Compile("&nbsp;?", "gu");
    private static readonly JsRe GROUP_SPACE = JsRegex.Compile("(\\d) (\\d{3})(?![\\d])", "gu");
    private static readonly JsRe SOLI = JsRegex.Compile("(?<![\\p{L}\\p{M}])[Сс]\\.\\s?(?=\\d{3,4}(?![\\d]))", "gu");
    private static readonly JsRe DIGAR = JsRegex.Compile("(?<![\\p{L}\\p{M}])диг\\.", "gu");
    private static readonly JsRe GHAYRA = JsRegex.Compile("(?<![\\p{L}\\p{M}])ғ\\.(?=\\s|$|\\))", "gu");
    private static readonly JsRe MLRD_DOT = JsRegex.Compile("(?<=\\d\\s?)млрд\\.(?=\\s+[\\p{Ll}\\d])", "gu");
    private static readonly JsRe MLN_DOT = JsRegex.Compile("(?<=\\d\\s?)млн\\.(?=\\s+[\\p{Ll}\\d])", "gu");
    private static readonly JsRe HAZ_DOT = JsRegex.Compile("(?<=\\d\\s?)ҳаз\\.(?=\\s+[\\p{Ll}\\d])", "gu");
    private static readonly JsRe MLRD = JsRegex.Compile("(?<=\\d\\s?)млрд(?![\\p{L}\\p{M}])", "gu");
    private static readonly JsRe MLN = JsRegex.Compile("(?<=\\d\\s?)млн(?![\\p{L}\\p{M}])", "gu");
    private static readonly JsRe HAZ = JsRegex.Compile("(?<=\\d\\s?)ҳаз(?![\\p{L}\\p{M}])", "gu");
    private static readonly JsRe DOTTED_DATE = JsRegex.Compile("(?<![\\d.,])(\\d{1,2})\\.(\\d{1,2})\\.(\\d{4})(?![\\d.])", "gu");
    private static readonly JsRe DIGIT_COLON = JsRegex.Compile("(?<=\\d):(?=\\d)", "gu");
    private static readonly JsRe ORDINAL = JsRegex.Compile("(?<![\\d.,])(\\d+)-(ум|юм)([\\p{L}\\p{M}]*)", "gu");
    private static readonly JsRe PERCENT_ENCLITIC = JsRegex.Compile($"(\\d[\\d,]*)\\s?%-({SUFFIX})(?![\\p{{L}}\\p{{M}}])", "gu");
    private static readonly JsRe NUMBER_ENCLITIC = JsRegex.Compile($"(?<![\\d.,])(\\d+)-({SUFFIX})(?![\\p{{L}}\\p{{M}}])", "gu");
    private static readonly JsRe RANGE = JsRegex.Compile("(?<![\\p{L}\\p{M}])(\\d+)\\s?[-–—]\\s?(\\d)", "gu");
    private static readonly JsRe SPACED_DASH = JsRegex.Compile("\\s+[–—]\\s+", "gu");
    private static readonly JsRe DEG_CELSIUS = JsRegex.Compile($"(\\d)\\s?°\\s?[CСcс](?:-({SUFFIX}))?(?![\\p{{L}}\\p{{M}}])", "gu");
    private static readonly JsRe DEG_FAHRENHEIT = JsRegex.Compile("(\\d)\\s?°\\s?F(?![\\p{L}\\p{M}])", "gui");
    private static readonly JsRe DEG_COMPASS = JsRegex.Compile("(\\d)\\s?°\\s?([NSEW])(?![\\p{L}\\p{M}])", "gu");
    private static readonly JsRe DEG_BARE = JsRegex.Compile($"(\\d)\\s?°(?:-({SUFFIX}))?", "gu");
    private static readonly JsRe DENSITY = JsRegex.Compile("(?<![\\p{L}\\p{M}])([Ѐ-ӿ]{2,})\\s?\\/\\s?км(²|2)(?![\\p{L}\\p{M}\\d])", "gu");
    private static readonly JsRe FRACTION = JsRegex.Compile("(?<![\\p{L}\\p{M}\\d./])(\\d{1,2})\\s?\\/\\s?(\\d{1,2})(?![\\d./])", "gu");
    private static readonly JsRe DECIMAL_COMMA = JsRegex.Compile("(?<=\\d),(?=\\d)", "gu");
    private static readonly JsRe DECIMAL_DOT = JsRegex.Compile("(?<![\\d.])(\\d+)\\.(\\d+)(?![\\d.])", "gu");
    private static readonly JsRe EQUALS = JsRegex.Compile("([\\dЀ-ӿ])\\s*=\\s*([\\dЀ-ӿ])", "gu");

    private static readonly IReadOnlyDictionary<string, string> COMPASS = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["N"] = "шимолӣ", ["S"] = "ҷанубӣ", ["E"] = "шарқӣ", ["W"] = "ғарбӣ",
    };

    /** Normalize one Tajik input string. Pure text→text. */
    public static string NormalizeTajik(string input)
    {
        var s = input;

        // 0) THE SOFT HYPHEN, AND IT COMES FIRST BECAUSE EVERY LATER RULE MATCHES LITERALS. U+00AD is an
        //    invisible discretionary break carried in from print-derived wiki text. It is not in the engine's
        //    `[Ѐ-ӿ]` token class, so it TERMINATES A WORD: `Осиёи Мар­ка­зӣ` → *ɔsijɔjˈi mˈar kˈa zˈi*, three
        //    words with three primary stresses. 54 occurrences inside a word across 13 of 456 mined segments
        //    (2.9%) — the same shape as the Balochi run's deleted letter, one character class over.
        //    `&nbsp;` goes with it: the artifact carries the ENTITY as literal text (`+22,2&nbsp;°C`), and the
        //    ampersand tier at step 9 would otherwise read it as the word "ва" plus *nbsp*.
        s = JsRegex.Replace(JsRegex.Replace(s, SOFT_HYPHEN, _ => ""), NBSP_ENTITY, _ => " ");

        // 1) SPACE-GROUPED THOUSANDS — `70 000`, `5 781 203`, `135 620 км²`, `877 802 песо`. The Russian
        //    convention, and the engine's `\d+` splits on the space: `70 000 нафар` read *ҳафтод сифр нафар*
        //    ("seventy zero"). 42 occurrences in 24 of 456 segments; 7,348 articles wiki-wide.
        //    FIRST after the invisible-character fold, because a grouping space that survives is later read as
        //    two operands by the range rule and as two numbers by the tier.
        for (var i = 0; i < 3; i++) s = JsRegex.Replace(s, GROUP_SPACE, m => m.Groups[1].Value + m.Groups[2].Value);

        // 2) DOTTED ABBREVIATIONS — the three that are TAJIK. Before any single-dot handling, so the interior
        //    dot cannot survive as a phrase break.
        //    ⚠ `с.` IS `соли` ("in the year"), and the artifact proves it by writing both in one sentence:
        //    «С.1924 нахустин амбулатория ва соли 1925 якумин беморхона». Claimed ONLY before a 4-digit year —
        //    that guard is what keeps it off `Солодов А. А., Петриков С. С.`, the Russian initials that make up
        //    most of the 23 capital `С.` in the artifact. 9 occurrences in 3 segments.
        s = JsRegex.Replace(s, SOLI, _ => "соли ");
        //    `ва диг.` = ва дигар ("and others"), 8/8 artifact instances in that exact collocation.
        s = JsRegex.Replace(s, DIGAR, _ => "дигар");
        //    `ва ғ.` = ва ғайра ("etc."), 5/5 instances after `ва`; ғайра ×246 in 18 articles.
        s = JsRegex.Replace(s, GHAYRA, _ => "ғайра");
        //    млн / млрд / ҳаз — the Russian-style magnitude abbreviations, spoken as the full international
        //    words the same corpus spells out beside them (миллион ×20, миллиард ×12, ҳазор ×45 in the
        //    artifact). Claimed only AFTER a number, which is where all 50 artifact occurrences sit, and the
        //    trailing abbreviation dot is spent only when a lowercase word or a digit follows — at the end of a
        //    sentence it is the sentence's own period and must stay (`45,4 млн. нафар` vs `— 6458 км.`).
        s = JsRegex.Replace(s, MLRD_DOT, _ => "миллиард");
        s = JsRegex.Replace(s, MLN_DOT, _ => "миллион");
        s = JsRegex.Replace(s, HAZ_DOT, _ => "ҳазор");
        s = JsRegex.Replace(s, MLRD, _ => "миллиард");
        s = JsRegex.Replace(s, MLN, _ => "миллион");
        s = JsRegex.Replace(s, HAZ, _ => "ҳазор");

        // 3) DOTTED DATES — `1.01.2017`, `08.09.2016`, `14.11.1606`, `05.01.1952—08.09.2001`. The Russian
        //    D.MM.YYYY order, 3,659 articles wiki-wide, 16 occurrences in 9 mined segments. Unclaimed each dot
        //    is a CLAUSE BREAK, so a date read as three separate sentences.
        //    The reading is the corpus's own spelled form: `16 ноябри соли 1992` — cardinal day, month in the
        //    izofat, then `соли` before the year. ⚠ A FOUR-DIGIT YEAR IS REQUIRED, and that is what keeps the
        //    rule off `10.02.22` and `10.02.08`, the Russian dissertation-speciality codes in the artifact's
        //    bibliography lines, which have the identical shape and are not dates.
        //    BEFORE the range rule, so `05.01.1952—08.09.2001` is two dates and not a numeric range.
        s = JsRegex.Replace(s, DOTTED_DATE, m =>
        {
            double dv = Js.Number(m.Groups[1].Value), mv = Js.Number(m.Groups[2].Value);
            if (dv < 1 || dv > 31 || mv < 1 || mv > 12) return m.Value;
            return $"{Js.NumberToString(dv)} {MONTHS[(int)mv - 1]} соли {m.Groups[3].Value}";
        });

        // 4) THE COLON BETWEEN DIGITS IS NEVER A CLAUSE BREAK. `соати 15:39:37` read as *понздаҳ , сию нӯҳ ,
        //    сию ҳафт* — a timestamp delivered as three sentences. 2,991 articles carry `\d:\d\d`; 11
        //    occurrences in 8 mined segments, and they are not all clocks (`20:9` an aspect ratio, `2:17.73` a
        //    swim time, `01:11:45` a video length). Nothing here needs to know WHICH: the defect is the pause,
        //    and the fields read correctly as consecutive numbers in every one of those senses. So the colon
        //    becomes a plain separator and no reading is invented for the notation.
        s = JsRegex.Replace(s, DIGIT_COLON, _ => " ");

        // 5) ORDINALS — `1-ум`, `2-юм`, `10-уми`, `129-умро`, `18-ум`. Tajik's own native pattern and the
        //    densest one this layer has after the decimal: 3,675 articles for `\d-ум`, 793 for `\d-юм`, 1,660
        //    for `\d-уми`; 28 occurrences in 19 mined segments. Unclaimed, `ҷойи 1-ум` read *d͡ʒɔjˈi jˈak ˈum*,
        //    the ending standing as its own stressed word.
        //    BEFORE the range rule, or `1-ум` looks like the start of a hyphen range; BEFORE the generic
        //    enclitic rule, so a tail that IS an ordinal ending is claimed as one.
        s = JsRegex.Replace(s, ORDINAL, m =>
        {
            var ord = TajikOrdinal(Js.Number(m.Groups[1].Value));
            return ord is null ? m.Value : GlueSuffix(ord, m.Groups[3].Value);
        });

        // 6) THE ENCLITIC GLUED TO A NUMBER OR TO A PERCENT SIGN — `60,1%-и`, `18,3%-ро`, `8%-и`, `100-и`.
        //    ⚠ The percent arm must run BEFORE the tier (step 9): the tier emits `дарсад` and would leave the
        //    `-и` stranded as its own token. Reading the sign here and gluing the enclitic to the emitted word
        //    is trap 14's fix shape — wordify the operand, then apply the agreement. 10 occurrences in 6 mined
        //    segments; 220 + 97 articles for `%-и` / `%-ро`.
        s = JsRegex.Replace(s, PERCENT_ENCLITIC, m => $"{m.Groups[1].Value} дарсад{m.Groups[2].Value}");
        //    The bare numeral form. The digits become words HERE so the enclitic has a word to attach to.
        s = JsRegex.Replace(s, NUMBER_ENCLITIC, m =>
        {
            var w = TajikPhonemizer.NumberWords(Js.Number(m.Groups[1].Value));
            return w == "" ? m.Value : GlueSuffix(w, m.Groups[2].Value);
        });

        // 7) NUMERIC RANGES — `1992—1997`, `750—930 метр`, `10-15 %`, `2000-3000м`, `солҳои 1887-95`. 22,836
        //    corpus occurrences and the biggest silent one in the language: the dash is not in the token class,
        //    so `1992—1997` read as two bare numbers with no connective AND NO PAUSE, i.e. indistinguishable
        //    from a compound number.
        //    `то` is the Tajik "to", and it is the same relation SPELLED: `/[0-9] то [0-9]/` is 3,238 articles
        //    against 5,273 for `/[0-9]—[0-9]/`, so the language writes both forms of one construction.
        //    ⚠ A DIGIT IS REQUIRED ON THE LEFT OF THE DASH, which is the whole guard. Every counter-example in
        //    the corpus is a DESIGNATION whose hyphen follows a letter — `COVID-19`, `Варзоб-1`, `Sirius-4`,
        //    `ABS-1`, `CASA-1000`, `1-Май` — and none of them can match. AFTER the ordinal and date rules, both
        //    of which own a hyphen or a dash of their own.
        s = JsRegex.Replace(s, RANGE, m => $"{m.Groups[1].Value} то {m.Groups[2].Value}");

        // 8) THE SPACED DASH IS A PAUSE, and it was being deleted outright. Tajik uses ` — ` as the copula
        //    (`Тоҷикистон — кишварест…`) and for apposition; it is the single most frequent punctuation mark in
        //    the artifact after the period — 280 occurrences across 181 of 456 segments, 40% of the corpus — and
        //    not one of them produced a break, because `—` is in neither the token class nor
        //    `clausePunctuation`. Rewritten to a comma, which the manifest already maps to a comma-length pause.
        //    AFTER step 7, so a numeric range has already taken its dash.
        s = JsRegex.Replace(s, SPACED_DASH, _ => " , ");

        // 9a) DEGREES. `38° арзи шимолӣ` (a latitude), `14,1°С-ро`, `+22,2 °C`, `–26°С`, `75.0°E`. 634 corpus
        //     occurrences, 45 in 16 mined segments, all dropped.
        //     ⚠ BOTH ENCODINGS OF THE SCALE LETTER, and this is trap 11 in Cyrillic: the corpus writes `°С`
        //     with CYRILLIC С (U+0421) and `°C` with Latin C, they render identically, and they took different
        //     paths — the Cyrillic one read as a bare `s`, the Latin one as the ENGLISH letter name *sˈiː*.
        //     `дараҷаи Селсий` is attested in exactly this slot: «аз 0 дараҷаи Селсий то — 15 дараҷаи Селсий …
        //     аз 25 дараҷаи Селсий то 40 дараҷа» — one article, which is a lead rather than a broad finding, and
        //     it is the only source there is. The bare `дараҷа` in that same sentence is corroborated at 122
        //     articles by `/[0-9] дараҷа/`.
        // ⚠ THE LOWERCASE SCALE LETTER GOES IN THE CLASS, NOT IN AN `i` FLAG — the suffix class beside it
        //    is genuinely lowercase-only, and `i` folds it so the flag would widen the suffix capture too.
        s = JsRegex.Replace(s, DEG_CELSIUS,
            m => $"{m.Groups[1].Value} дараҷаи Селсий{(m.Groups[2].Success ? m.Groups[2].Value : "")}");
        s = JsRegex.Replace(s, DEG_FAHRENHEIT, m => $"{m.Groups[1].Value} дараҷаи Фаренгейт");
        //     A COORDINATE's direction letter is Latin and the language's own words are Tajik; the corpus writes
        //     the spelled form beside the sign (`38° арзи шимолӣ`, `68° тули шарқӣ`), which is where these come
        //     from. Without it `75.0°E` lost the degree AND glued a raw `E` into the reading.
        s = JsRegex.Replace(s, DEG_COMPASS,
            m => $"{m.Groups[1].Value} дараҷаи {COMPASS[m.Groups[2].Value.ToUpperInvariant()]}");
        //     Bare degree, last, so the scale and direction arms get first refusal.
        s = JsRegex.Replace(s, DEG_BARE,
            m => $"{m.Groups[1].Value} дараҷа{(m.Groups[2].Success ? m.Groups[2].Value : "")}");

        // 9b) THE DENSITY RATE `нафар/км²` — 10 articles, and neither operand is a unit the tier can hold
        //     (`нафар` is the ordinary Tajik word for "person" and declaring it would rewrite every population
        //     figure in the language). tg.wikipedia spells this one out itself: «зичии аҳолӣ … нафар дар
        //     километри квадратӣ». Local, and above the tier so the `км²` key is still there to consume.
        //     ⚠ THE NOUN IS A CAPTURE, NOT A LITERAL, and that came out of re-scanning: `нафар/км²` was the form
        //     the artifact showed, the rule was written for it, and the scan then reported the SAME defect once
        //     more on `5914,4 тан/км²` — the identical construction with the other word for "person". A cell can
        //     hide behind itself; this one had two spellings of one noun.
        s = JsRegex.Replace(s, DENSITY, m => $"{m.Groups[1].Value} дар километри мураббаъ");

        // 9c) THE SHARED SYMBOL TIER — %, currency, units, rates. The number must still be ADJACENT to its sign
        //     and must still carry its decimal comma (`26,5 %`), so this runs before step 10 spends the comma.
        s = SYMBOLS(s);

        // 10) FRACTIONS — `1/3 ҳиссаи`, `2/3 ҳиссаи`, `1/2 ҳиссаи`, `3/4 тамоми силоҳҳо`. Persian order:
        //     numerator cardinal + denominator ORDINAL — *як сеюм*, *се чорум* — which the step-5 machinery
        //     already composes, so no new vocabulary is sourced.
        //     ⚠ THE SLASH IS USUALLY A STREET ADDRESS IN THIS CORPUS, not a fraction: `кӯчаи Ҳусейнзода, 31/1`,
        //     `Ҳувайдуллоев 2/1`, `Хиёбони Абӯалӣ Сино, 29/31` — 3 of the artifact's 16 digit-slash-digit
        //     instances, against 5 real fractions. Both are claimed by numerator < denominator ≤ 10, which
        //     accepts every fraction and rejects every address, and also rejects `12/256 GB`, `9/195-106` and
        //     the half-life subscript in `К 14С(Т1/2` (a letter precedes it).
        s = JsRegex.Replace(s, FRACTION, m =>
        {
            double n = Js.Number(m.Groups[1].Value), d = Js.Number(m.Groups[2].Value);
            if (!(n >= 1 && n < d && d <= 10)) return m.Value;
            var den = TajikOrdinal(d);
            return den is null ? m.Value : $"{TajikPhonemizer.NumberWords(n)} {den}";
        });

        // 11) THE DECIMAL SEPARATOR, AND THE WORD IS REFUSED — see step 12. What is fixed here is the PAUSE:
        //     `2,2 млн тонна` read *dˈu , dˈu …*, a clause break in the middle of a quantity, on 242
        //     occurrences across 82 of 456 segments (18% of the corpus, the layer's densest defect). The comma
        //     becomes a plain separator, so the two groups are read consecutively with no break and no invented
        //     word — merely missing, never confidently wrong.
        //     The dot form goes the same way: the corpus writes both (`1.8 - 4.5кг`, `9.85Mb`, `75.0°E`).
        //     Guarded to an unspaced dot between digits, so a sentence period is never eaten.
        s = JsRegex.Replace(s, DECIMAL_COMMA, _ => " ");
        s = JsRegex.Replace(s, DECIMAL_DOT, m => $"{m.Groups[1].Value} {m.Groups[2].Value}");

        // 12) EQUALS — `1 доллар = 100 сент`, `372 ҳиҷрии қамарӣ = 982 милодӣ`. `баробар аст ба` is the corpus's
        //     own phrasing of the relation («Як километри мураббаъ баробар аст ба:», «масоҳаташон ба 11 146 км²
        //     баробар аст»). 15 occurrences in 10 segments. ⚠ Guarded to a Cyrillic or digit operand on BOTH
        //     sides, which is what excludes the artifact's timeline-markup line `ScaleMinor = gridcolor:lightgrey`
        //     — Latin on both sides, and not a statement about quantities at all.
        s = JsRegex.Replace(s, EQUALS, m => $"{m.Groups[1].Value} баробар аст ба {m.Groups[2].Value}");

        return s;
    }
}

/**
 * ───────────────────────────────────────────────────────────────────────────────────────────────────
 * DELIBERATELY NOT READ, with the count that makes each a decision rather than an oversight.
 *
 * ⚠ THE DECIMAL SEPARATOR'S WORD — 242 occurrences, 82 of 456 segments, the layer's highest-traffic slot.
 *   FIVE candidates, every one attested in Tajik and every one with a DIFFERENT sense, and every one
 *   returning ZERO between two digits over the whole of tg.wikipedia:
 *
 *       бутун   ×16/10   "адади бутун" = an INTEGER (also a runway surface)   /[0-9] бутун [0-9]/   = 0
 *       нуқта   ×40/19   the FULL STOP, defined as such; "нуқтаи аҳолинишин" a settlement   = 0
 *       вергул  ×13/7    the COMMA as a written mark, defined as such                       = 0
 *       мумайиз ×1/1     a court ASSESSOR — Persian ممیز is the decimal word, and the Cyrillic
 *                        cognate has moved: «ба ҳайси мумайиз дар санҷишҳои судӣ ва ҷиноӣ»
 *       аъшорӣ  ×0       absent outright
 *
 *   This is a SENSE refusal, not a silence, so it stands on the corpus alone (the Igbo distinction). Step 11
 *   removes the false pause and leaves the digits unjoined. The Persian word does not transfer, which is the
 *   same lesson as ckb's `کم` being kilometre and fa's being "few" — a shared etymology is not a shared slot.
 *
 * ⚠ THE MINUS — the `signed-number` cell is 1,139 corpus occurrences and the reading is refused on BOTH
 *   halves of the question. The WORD: `манфӣ` ×37/20 is attested and fails on sense — "ҷонишини манфӣ" is a
 *   negative PRONOUN (a grammar term), "иттилооти манфӣ" negative information, and `Манфӣ` is a Libyan
 *   politician's surname. The SHAPE: the artifact's dash-before-a-number instances are overwhelmingly NOT
 *   negatives — `мардҳо −71,3, занҳо −76,2` is an apposition dash, `аз ҷумла тиҷоратӣ –19,3 ҳазор км` is a
 *   list dash, `аз 0 дараҷаи Селсий то — 15` writes the minus AS an em dash — against a genuine `-1,1` and
 *   `–26°С`. Claiming one claims the other, which is hi's trap-24 position exactly. Step 8 gives the spaced
 *   dash its pause, which is the part that IS unambiguous.
 *
 * ⚠ THE PLUS — 17 occurrences in 10 segments, and they are `Тел.: +992` (a dialling code), `UTC+5`,
 *   `FHD + 1080x2400` (a display spec) and `+28` / `+22,2 °C` (temperatures). `ҷамъ` is Wikidata's tg label
 *   for ADDITION and every one of its ×29 corpus instances is "ҷамъ намудан", to COLLECT — the wrong
 *   register, which trap 37 warns is harder to catch than a wrong word because the citation looks right.
 *   And omitting a plus is lossless where omitting a minus inverts, so the two do not share an argument.
 *
 * ⚠ MULTIPLICATION — 13 occurrences of `×` / Cyrillic `х` / Latin `x` between digits in 6 segments, and
 *   most are a resolution (`1080x2400`) or a court size (`13,4×5,2 м`). `зарб` is the NOUN "multiplication"
 *   (Wikidata's tg label for Q40276) and nothing attests it as the word a reader says BETWEEN two operands.
 *
 * ⚠ THE RUSSIAN ABBREVIATION BLOCK — `М.` ×26, `А.` ×22, `В.` ×17, `Б.` ×11, `Т.` ×7, `т.`, `вв.`, `изд.`,
 *   `п.л.`, `с.` for *страница*. The `dotted` cell is 13,693 corpus occurrences and it is the richest
 *   abbreviation evidence tg.wikipedia has. It is also RUSSIAN — 7.0% of the mined artifact is
 *   Russian-language text, concentrated in the bibliography blocks that end an article, and 8 of the 8 hard
 *   instances of that cell are citations. A Tajik expansion for any of them would be a Russian word wearing
 *   a Tajik layer, which is the ht `pwen` and bar `Euro` failure.
 *
 * ⚠ `шим.` (×5) and `ш.` (×5) — the expansion is genuinely ambiguous. `шим.` is шимол or шимолӣ depending
 *   on the phrase (`ноҳияҳои шим.` vs `минтақаҳои шим. ғарбӣ`), and `ш.` is шаҳри in `ш.Хоруғ`, шарқӣ in a
 *   coordinate and шамсӣ in `1362 ш.`, a Hijri-solar year. Three senses, five instances, no discriminator.
 *
 * ⚠ THE ENCLITIC AFTER AN ABBREVIATION OR AN INITIALISM — `ММД-ро`, `3 000 км-ро`, `15 км²-ро`. 4 + 4
 *   occurrences. The enclitic stays a separate token; gluing it would fuse it into a caps run the initialism
 *   pass must still see, or into a unit key the tier must still match, and both are worse than a short
 *   stranded word that is at least pronounced.
 * ───────────────────────────────────────────────────────────────────────────────────────────────────
 */
