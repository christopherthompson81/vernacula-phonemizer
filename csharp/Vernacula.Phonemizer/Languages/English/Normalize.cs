/**
 * English text normalization — rewrite non-lexical tokens into speakable words BEFORE the tokenizer, so the
 * existing number/ordinal/OOV machinery does the pronouncing. Every rule emits plain words and digits the
 * pipeline already handles (a year becomes two 2-digit numbers), which keeps this layer free of IPA and lets
 * the POS tagger / stress logic see a flat word stream.
 *
 * ORDER MATTERS and is documented per rule below. The pass is idempotent — every rewrite removes the pattern
 * it matches.
 *
 * ⚠ English does NOT use the shared symbol tier (`core/normalizeSymbols.ts`), so anything that tier provides
 * — `NOT_VERSION`, `magnitudes`, `bareExponent` — has a local equivalent here or it does not exist for
 * English at all.
 */
using System.Text.RegularExpressions;
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.English;

public static class Normalize
{
    // ── Roman numerals ──────────────────────────────────────────────────────────────────────────────────
    // A closed, conservative set (2–20, minus vi and xi). Lowercased text cannot tell "VI" from "vi", and vi
    // (the editor) / xi (the name/letter) are real words. Single letters (i, v, x) are never treated as
    // numerals. Larger romans (xxi+, l, c, m compounds) collide with too many words (mix is a valid 1009) and
    // are left to the OOV G2P — this list covers monarchs, wars, chapters and film sequels.
    private static readonly IReadOnlyDictionary<string, int> ROMAN = new Dictionary<string, int>(StringComparer.Ordinal)
    {
        ["ii"] = 2, ["iii"] = 3, ["iv"] = 4, ["vii"] = 7, ["viii"] = 8, ["ix"] = 9, ["xii"] = 12,
        ["xiii"] = 13, ["xiv"] = 14, ["xv"] = 15, ["xvi"] = 16, ["xvii"] = 17, ["xviii"] = 18,
        ["xix"] = 19, ["xx"] = 20,
    };

    // Context words after which a roman is a CARDINAL (world war ii → "world war 2"); anywhere else it is read
    // as a REGNAL ordinal (henry viii → "henry the 8th"), the reading English gives name-attached numerals.
    // Known limit: a bare medical "iv" or list-marker "(ii)" gets the regnal reading.
    private static readonly JsRe ROMAN_CARDINAL_CTX = JsRegex.Compile(
        "\\b(war|chapter|part|act|section|volume|book|phase|stage|grade|class|type|level|apollo|rocky|bowl|wrestlemania|olympiad|super)$", "i");

    // ── Units and symbols ───────────────────────────────────────────────────────────────────────────────
    // Only unambiguous multi-character abbreviations, and only AFTER a number ("40 km"); bare "km" in prose
    // stays. [sg, pl] for count agreement: "1 km" → kilometer, "40 km" → kilometers.
    private static readonly IReadOnlyDictionary<string, string[]> UNITS = new Dictionary<string, string[]>(StringComparer.Ordinal)
    {
        ["km"] = new[] { "kilometer", "kilometers" }, ["cm"] = new[] { "centimeter", "centimeters" },
        ["mm"] = new[] { "millimeter", "millimeters" }, ["kg"] = new[] { "kilogram", "kilograms" },
        ["mg"] = new[] { "milligram", "milligrams" }, ["lb"] = new[] { "pound", "pounds" },
        ["lbs"] = new[] { "pounds", "pounds" }, ["oz"] = new[] { "ounce", "ounces" },
        ["ft"] = new[] { "foot", "feet" }, ["mi"] = new[] { "mile", "miles" },
        ["mph"] = new[] { "miles per hour", "miles per hour" }, ["kph"] = new[] { "kilometers per hour", "kilometers per hour" },
        // Slash and degree units. ⚠ Longest keys must match first, or `km` shadows `km/h` and the `/h` is read
        // as the letter aitch.
        ["km/h"] = new[] { "kilometer per hour", "kilometers per hour" }, ["m/s"] = new[] { "meter per second", "meters per second" },
        ["miles/hour"] = new[] { "mile per hour", "miles per hour" }, ["mbit/s"] = new[] { "megabit per second", "megabits per second" },
        ["yards/meters"] = new[] { "yard per meter", "yards per meters" },
        ["°c"] = new[] { "degree Celsius", "degrees Celsius" }, ["°f"] = new[] { "degree Fahrenheit", "degrees Fahrenheit" },
        // ⚠ ℃ and ℉ are SINGLE CODE POINTS (U+2103, U+2109), so the two keys above cannot reach them and `20℃`
        // reads as bare "twenty" — the whole unit gone, not merely the sign.
        ["℃"] = new[] { "degree Celsius", "degrees Celsius" }, ["℉"] = new[] { "degree Fahrenheit", "degrees Fahrenheit" },
        ["°"] = new[] { "degree", "degrees" },
        ["m"] = new[] { "meter", "meters" }, // ⚠ ⟨L⟩ AND ⟨l⟩ ARE BOTH OFFICIAL for the litre (⟨L⟩ is the dominant printed form), so BOTH are
        // declared — the one exception to the one-letter case rule in core/normalizeSymbols.ts, which
        // exists for symbols whose two cases are DIFFERENT units. Here they are the same unit.
        ["l"] = new[] { "liter", "liters" }, ["L"] = new[] { "liter", "liters" }, ["ml"] = new[] { "milliliter", "milliliters" },
        // ⚠ ⟨W⟩ IS CAPITAL — watt is named after Watt, and #763 resolves a one-letter symbol case-SENSITIVELY,
        // so a lower-case ⟨w⟩ is not a unit. The multi-letter kw/hz/gb below still fold, so sloppy case reads.
        ["g"] = new[] { "gram", "grams" }, ["t"] = new[] { "ton", "tons" }, ["W"] = new[] { "watt", "watts" },
        // ⚠ ⟨ha⟩ WAS NOT LEAKING, IT WAS MIS-READING — the one unit English got wrong, and the reason no gate
        // caught it. `12,700,000 ha` read *…hˈɑː*: the letters are a pronounceable English word, so nothing
        // survived as ASCII and nothing vanished, and the leak classes, the DROP counter and the corpus diff
        // are all blind to it by construction (see tools/normalization/misread.ts). The evidence is this
        // language's OWN artifact, which glosses the unit against acres in the same clause — "farms in 2010
        // (−32% since 2000) covering 12,700,000 ha or 31,382,383 acres" — and `hectare`/`hectares` are already
        // in g2p-dict.tsv and the accent lexicon, so nothing new is being asserted about the word.
        ["ha"] = new[] { "hectare", "hectares" },
        ["hz"] = new[] { "hertz", "hertz" }, ["khz"] = new[] { "kilohertz", "kilohertz" }, ["mhz"] = new[] { "megahertz", "megahertz" },
        ["ghz"] = new[] { "gigahertz", "gigahertz" }, ["kb"] = new[] { "kilobyte", "kilobytes" }, ["mb"] = new[] { "megabyte", "megabytes" },
        ["gb"] = new[] { "gigabyte", "gigabytes" }, ["tb"] = new[] { "terabyte", "terabytes" }, ["kw"] = new[] { "kilowatt", "kilowatts" },
    };

    /** The case-folded index for step 1 (see resolveUnitSymbol) — built once, beside the table it indexes.
     *  ⚠ REVERSED, as in the TS: `Object.fromEntries` keeps the LAST duplicate, so reversing makes the
     *  FIRST-declared spelling win a case collision (⟨l⟩ before ⟨L⟩). */
    private static readonly IReadOnlyDictionary<string, string[]> UNITS_FOLDED = BuildFolded();

    private static Dictionary<string, string[]> BuildFolded()
    {
        var d = new Dictionary<string, string[]>(StringComparer.Ordinal);
        foreach (var kv in UNITS.Reverse()) d[kv.Key.ToLowerInvariant()] = kv.Value;
        return d;
    }

    private static readonly IReadOnlyDictionary<string, string[]> CURRENCY = new Dictionary<string, string[]>(StringComparer.Ordinal)
    {
        ["$"] = new[] { "dollar", "dollars" }, ["£"] = new[] { "pound", "pounds" },
        ["€"] = new[] { "euro", "euros" }, ["¥"] = new[] { "yen", "yen" },
    };

    /**
     * A MAGNITUDE ABBREVIATION GLUED TO A MONEY FIGURE — `$1.5m`, `£2.3m`, `$2bn`, `£700k`.
     *
     * ⚠ THE ONE-LETTER ⟨m⟩ IS THE WHOLE PROBLEM, because it is ALSO the metre, and `UNITS` declares it as one.
     * The two readings are separated by exactly one thing — a CURRENCY SIGN in front of the number — and that
     * discriminator is not a guess here: three engines in this tree reached it independently before this rule
     * existed. Measured over the 162 committed mined artifacts:
     *
     *   currency sign + digits + GLUED abbreviation   43 instances, 15 artifacts — every one a magnitude
     *   bare digits + glued/spaced ⟨m⟩             1,327 instances, 110 artifacts — overwhelmingly METRES
     *
     * ⚠ GLUED ONLY — THE SPACED FORM IS NOT SEPARABLE AND IS DELIBERATELY DECLINED: of 15 fleet-wide hits for
     * `$NN m`, TWELVE are the first letter of the next word (Kurmanji `$ 125 mîlyon`, Yoruba `$500 mílíọ̀nù`).
     *
     * ⚠ THE KEYS ARE THE ATTESTED ONES AND NOTHING ELSE. ⟨tn⟩ and bare lowercase ⟨b⟩ are ×0 fleet-wide and
     * are left out rather than added on the strength of being plausible English.
     */
    private static readonly IReadOnlyDictionary<string, string> MONEY_MAGNITUDE = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["m"] = "million", ["M"] = "million", ["bn"] = "billion", ["BN"] = "billion",
        ["Bn"] = "billion", ["B"] = "billion", ["k"] = "thousand", ["K"] = "thousand",
    };
    private static readonly string MONEY_MAG_ALT = string.Join("|", MONEY_MAGNITUDE.Keys.OrderByDescending(k => k.Length));

    private const string MONTH_ALT = "january|february|march|april|may|june|july|august|september|october|november|december";

    // ── Title/place abbreviations (st, dr, mt, mr, mrs) ─────────────────────────────────────────────────
    // ⚠ The dictionary reads bare "st" as STREET and "dr" as DRIVE, so "st. james" comes out "street . james" —
    // wrong word AND the abbreviation's period survives into the clause segmenter as a phrase break. The dot
    // must be consumed here, and st/dr disambiguated: a following CONTENT word means the abbreviation precedes
    // a name (saint james, doctor tony); a following function word or phrase end means it follows one (main st.
    // in dublin = street). Lowercased input cannot use capitalization, so the neighbour test is the whole
    // heuristic there.
    private static readonly JsRe ABBREV_FUNCTION_NEXT = JsRegex.Compile(
        "^(?:in|on|at|and|or|but|the|a|an|is|was|were|are|to|for|with|of|from|by|near|that|this|it|he|she|they|we|you|i|as|his|her|its|their|there|then|when|where|which|who|had|has|have)$", "i");

    // CAPITALIZATION, where the input has it, beats the neighbour test: "Dr. Who" is Doctor Who, but "who" is a
    // function word, so the neighbour test alone reads it as "drive who".
    private static readonly JsRe UPPER_INITIAL = JsRegex.Compile("^\\p{Lu}", "u");
    private static bool IsName(string next) => UPPER_INITIAL.IsMatch(next);

    private static readonly IReadOnlyDictionary<string, Func<string, string>> DOTTED_ABBREV =
        new Dictionary<string, Func<string, string>>(StringComparer.Ordinal)
        {
            ["st"] = next => !IsName(next) && ABBREV_FUNCTION_NEXT.IsMatch(next) ? "street" : "saint",
            ["dr"] = next => !IsName(next) && ABBREV_FUNCTION_NEXT.IsMatch(next) ? "drive" : "doctor",
            ["mt"] = _ => "mount",
            ["mr"] = _ => "mister",
            ["mrs"] = _ => "missus",
        };

    // ⚠ A DOTTED DESIGNATION IS NOT A QUANTITY. The number group accepts a fraction, so `802.11g` matches as
    // `802.11` + `g` and reads as "eight hundred two point one one GRAMS". This is the shared tier's
    // `NOT_VERSION`, which English cannot inherit because it does not use the tier.
    // ⚠ AND 802.11 IS NAMED EXPLICITLY. Its amendment suffixes are now TWO letters — 802.11ac, ax, ah, be — and
    // `802.11ah` (Wi-Fi HaLow) collides with `Ah`, ampere-hours.
    private const string NOT_VERSION = "(?<![\\d.,])(?!802[.,]11\\w)(?!\\d+[.,]\\d+[a-zA-Z](?![a-zA-Z\\d]))";

    // ⚠ THE EXPONENT IS PART OF THE UNIT MATCH, not a separate rule, because the unit rule consumes the unit
    // and anything left behind reaches the g2p raw: `km²` matches `km`, the `²` is stranded and dropped, and
    // `19,500 km²` reads as a LENGTH — the area gone.
    // ⚠ THE ASCII EXPONENT IS ACCEPTED TOO (`km2`, `m3`), not only the superscript.
    // ⚠ A MAGNITUDE WORD MAY SIT BETWEEN THE NUMBER AND ITS UNIT, and without the hop English LEAKS the unit.
    private static readonly JsRe UNIT_RE = JsRegex.Compile(
        NOT_VERSION + "(\\d[\\d,]*(?:\\.\\d+)?)(\\s+(?:hundred|thousand|million|billion|trillion))?\\s?("
        + string.Join("|", UNITS.Keys.OrderByDescending(k => k.Length)) + ")([²³23])?(?![\\p{L}\\p{M}])",
        "giu");

    /** Dotted abbreviations with a single fixed reading (no neighbour test needed). `No.` otherwise reads as
     *  the word "no". */
    private static readonly IReadOnlyDictionary<string, string> PLAIN_ABBREV = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["jr"] = "junior", ["sr"] = "senior", ["prof"] = "professor", ["rev"] = "reverend", ["sgt"] = "sergeant",
        ["cpl"] = "corporal", ["lt"] = "lieutenant", ["col"] = "colonel", ["gen"] = "general", ["gov"] = "governor",
        ["sen"] = "senator", ["rep"] = "representative", ["no"] = "number", ["nos"] = "numbers", ["ave"] = "avenue",
        ["blvd"] = "boulevard", ["rd"] = "road", ["ln"] = "lane", ["dept"] = "department", ["est"] = "established",
        ["approx"] = "approximately", ["vs"] = "versus", ["vol"] = "volume", ["ch"] = "chapter", ["fig"] = "figure",
        ["pp"] = "pages", ["ed"] = "edition", ["eds"] = "editors", ["inc"] = "incorporated", ["ltd"] = "limited",
        ["corp"] = "corporation", ["univ"] = "university",
        // LATIN SCHOLARLY ABBREVIATIONS. Each reaches the g2p with its dot intact, so mid-sentence the dot
        // becomes a phrase break — and two are not words at all: `cf.` comes out as the unpronounceable cluster
        // [kf] and `viz.` as the nonsense word [vɪts].
        // ⚠ `etc` and `ibid` map to THEMSELVES: the dictionary already reads both correctly as single tokens,
        // so the entry exists only to consume the dot.
        ["etc"] = "etc", ["ibid"] = "ibid", ["cf"] = "compare", ["viz"] = "namely",
    };
    private static readonly string PLAIN_ABBREV_ALT = string.Join("|", PLAIN_ABBREV.Keys.OrderByDescending(k => k.Length));

    /** Fraction denominators. 2/3/4 are suppletive (half, third, quarter); the rest are the ordinal word,
     *  spelled out here rather than emitted as "5th" because the ordinal-suffix path has no plural form and
     *  "2/5" needs "fifths". Beyond 20 a fraction is vanishingly rare in prose and is left as digits. */
    private static readonly IReadOnlyDictionary<int, string> DENOMINATOR = new Dictionary<int, string>
    {
        [2] = "half", [3] = "third", [4] = "quarter", [5] = "fifth", [6] = "sixth", [7] = "seventh",
        [8] = "eighth", [9] = "ninth", [10] = "tenth", [11] = "eleventh", [12] = "twelfth",
        [16] = "sixteenth", [20] = "twentieth",
    };

    private static string? FractionWords(double num, double den)
    {
        if (den < 2 || num < 1) return null;
        if (!DENOMINATOR.TryGetValue((int)den, out var bas)) return null;
        var plural = num > 1 ? (bas == "half" ? "halves" : $"{bas}s") : bas;
        return $"{Js.NumberToString(num)} {plural}";
    }

    private static readonly string[] MONTHS = MONTH_ALT.Split('|');

    /** English ordinal suffix for a day-of-month (1st, 2nd, 3rd, 4th … 21st, 22nd, 23rd). */
    private static string OrdinalSuffix(double n)
    {
        double mod10 = n % 10, mod100 = n % 100;
        if (mod10 == 1 && mod100 != 11) return "st";
        if (mod10 == 2 && mod100 != 12) return "nd";
        if (mod10 == 3 && mod100 != 13) return "rd";
        return "th";
    }

    /** A numeric date → "march 14th 2011", the word order English speaks and the shape the date/year rules
     *  below already handle. Null if the fields are not a real date, so the caller leaves it alone. */
    private static string? IsoDate(double year, double month, double day)
    {
        if (month < 1 || month > 12 || day < 1 || day > 31) return null;
        return $"{MONTHS[(int)month - 1]} {Js.NumberToString(day)}{OrdinalSuffix(day)} {Js.NumberToString(year)}";
    }

    /** A 4-digit year in its English pair-wise reading, emitted as tokens the number path already handles:
     *  1998 → "19 98" (nineteen ninety-eight), 1905 → "19 oh 5", 1900 → "19 hundred", 2000 → "2 thousand",
     *  2007 → "2 thousand 7", 2011 → "20 11" (twenty eleven). */
    private static string YearWords(double y)
    {
        double hi = Math.Floor(y / 100), lo = y % 100;
        // ⚠ 2010-2019 STAYS PAIR-WISE ("twenty ten"), and it was measured rather than assumed. Readers split;
        // switching the decade to the "2 thousand N" form scores 9 closer / 7 further — a coin flip. Where
        // both readings are real the standard one stands.
        if (y >= 2000 && y < 2010) return lo == 0 ? "2 thousand" : $"2 thousand {Js.NumberToString(lo)}";
        if (lo == 0) return $"{Js.NumberToString(hi)} hundred";
        if (lo < 10) return $"{Js.NumberToString(hi)} oh {Js.NumberToString(lo)}";
        return $"{Js.NumberToString(hi)} {Js.NumberToString(lo)}";
    }

    /** Superscript digits → ASCII, so an exponent reaches the number path as a readable numeral. */
    private static readonly IReadOnlyDictionary<string, string> SUPERSCRIPT_DIGIT = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["⁻"] = "-", // SUPERSCRIPT MINUS — a negative exponent, `10⁻³¹`
        ["⁰"] = "0", ["¹"] = "1", ["²"] = "2", ["³"] = "3", ["⁴"] = "4",
        ["⁵"] = "5", ["⁶"] = "6", ["⁷"] = "7", ["⁸"] = "8", ["⁹"] = "9",
    };

    // Compiled once rather than per call — the TS builds several of these with `new RegExp` inside the pass.
    private static readonly JsRe TITLE_ABBREV = JsRegex.Compile("\\b(st|dr|mt|mr|mrs)\\.\\s+([a-zà-ÿ']+)", "gi");
    private static readonly JsRe TITLE_ABBREV_END = JsRegex.Compile("\\b(st|dr|mt)\\.(?=\\s*(?:[.,;:!?]|$))", "gi");
    private static readonly JsRe SAINT_UNDOTTED = JsRegex.Compile("\\bst\\s+([a-z']+)", "gi");
    private static readonly JsRe PLAIN_MID = JsRegex.Compile($"\\b({PLAIN_ABBREV_ALT})\\.(\\s+)(?=\\p{{L}})", "giu");
    private static readonly JsRe PLAIN_END = JsRegex.Compile($"\\b({PLAIN_ABBREV_ALT})\\.(?=\\s*(?:[.,;:!?)]|$))", "giu");
    private static readonly JsRe ET_AL_MID = JsRegex.Compile("\\bet\\s+al\\.(\\s+)(?=\\p{L})", "giu");
    private static readonly JsRe ET_AL_END = JsRegex.Compile("\\bet\\s+al\\.(?=\\s*(?:[.,;:!?)]|$))", "giu");
    private static readonly JsRe CIRCA = JsRegex.Compile("\\bca?\\.\\s*(?=\\d{3,4}(?!\\d))", "gi");
    private static readonly JsRe NUMBER_SIGN = JsRegex.Compile("\\bnos?\\.\\s*(?=\\d)", "gi");
    private static readonly JsRe EG_MID = JsRegex.Compile("\\be\\.\\s?g\\.(\\s+)(?=[\\p{L}\\d])", "giu");
    private static readonly JsRe EG_END = JsRegex.Compile("\\be\\.\\s?g\\.(?=\\s*(?:[,;:!?)]|$))", "giu");
    private static readonly JsRe IE_MID = JsRegex.Compile("\\bi\\.\\s?e\\.(\\s+)(?=[\\p{L}\\d])", "giu");
    private static readonly JsRe IE_END = JsRegex.Compile("\\bi\\.\\s?e\\.(?=\\s*(?:[,;:!?)]|$))", "giu");
    private static readonly JsRe AM_PM = JsRegex.Compile("\\b([ap])\\.\\s?m\\.", "gi");
    private static readonly JsRe DOTTED_INITIALS = JsRegex.Compile("\\b([A-Za-z](?:\\.[A-Za-z]){1,4})\\.(?!\\w)", "g");
    private static readonly JsRe DOTS = JsRegex.Compile("\\.", "g");
    private static readonly JsRe ERA = JsRegex.Compile("\\b(BCE|BC|CE|AD)\\b", "g");
    private static readonly JsRe SPACE_GROUP = JsRegex.Compile(
        $"(?<!(?:{MONTH_ALT})[ \u00a0\u202f\u2009])(?<![\\d.,])\\d{{1,3}}(?:[ \u00a0\u202f\u2009]\\d{{3}})+(?![\\d])", "giu");
    private static readonly JsRe SPACE_GROUP_SEPS = JsRegex.Compile("[    ]", "gu");
    private static readonly JsRe SCI_EXPONENT = JsRegex.Compile(
        "(?<=[×x·]\\s?)(10)\\s?(\\u207b?[\\u2070\\u00b9\\u00b2\\u00b3\\u2074-\\u2079]+|-\\d+)", "gu");
    private static readonly JsRe NEGATIVE = JsRegex.Compile("(^|[\\s(])[-−–](\\d)", "gu");
    private static readonly JsRe PLUS_MINUS = JsRegex.Compile("(^|[\\s(])±\\s?(\\d)", "gu");
    private static readonly JsRe ISO_DATE = JsRegex.Compile("\\b(\\d{4})-(\\d{2})-(\\d{2})\\b", "g");
    private static readonly JsRe US_DATE = JsRegex.Compile("\\b(\\d{1,2})\\/(\\d{1,2})\\/(\\d{4})\\b", "g");
    private static readonly JsRe MONEY_CENTS = JsRegex.Compile("([$£€¥])\\s?(\\d[\\d,]*)\\.(\\d{2})\\b", "g");
    private static readonly JsRe PLUS_ATTACHED = JsRegex.Compile("(\\S)\\+\\s?(\\d)", "gu");
    private static readonly JsRe PLUS_LEADING = JsRegex.Compile("(^|\\s)\\+\\s?(\\d)", "gu");
    private static readonly JsRe FRACTION = JsRegex.Compile("\\b(\\d{1,3})\\/(\\d{1,3})\\b(?!\\s*[\\/\\d])", "gu");
    private static readonly JsRe CURRENCY_RE = JsRegex.Compile(
        "([$£€¥])\\s?(\\d[\\d,]*(?:\\.\\d+)?)(?:(\\s+(?:million|billion|trillion|thousand))|("
        + MONEY_MAG_ALT + ")(?![\\p{L}\\p{M}\\d]))?", "gu");
    private static readonly JsRe PERCENT = JsRegex.Compile("(\\d)\\s?%", "gu");
    private static readonly JsRe CLOCK = JsRegex.Compile("\\b(\\d{1,2}):([0-5]\\d)\\b(\\s*[ap]m\\b)?", "gu");
    private static readonly JsRe MONTH_DAY = JsRegex.Compile(
        $"\\b({MONTH_ALT})\\s+(\\d{{1,2}})(?!\\d|\\s*(?:st|nd|rd|th|percent))\\b", "gi");
    private static readonly JsRe YEAR_RANGE = JsRegex.Compile(
        "(?<!\\b(?:pp|p|pages?|nos?|no|rooms?|chapters?|verses?|lines?|sections?|parts?|models?|items?|figs?|figures?|tables?|suites?|apt|ext)\\.?\\s)"
        + "\\b(1[1-9]\\d\\d|20\\d\\d)(\\s*[-–—]\\s*)(1[1-9]\\d\\d|20\\d\\d)\\b(?![.,]?\\d)"
        + "(?!\\s*(?:percent|kilometers?|meters?|km|kg|miles?|feet|ft|dollars?|usd|euros?))", "gi");
    private static readonly JsRe YEAR_CONTEXT = JsRegex.Compile(
        "\\b(in|of|since|from|until|till|by|before|after|around|circa|year|late|early|mid)(\\s+(?:the|a|an))?\\s+(1[1-9]\\d\\d|20\\d\\d)\\b(?![.,]?\\d)(?!\\s*(?:percent|kilometers?|meters?))", "gi");
    private static readonly JsRe YEAR_MONTH = JsRegex.Compile(
        $"\\b({MONTH_ALT})((?:\\s+\\d{{1,2}}(?:st|nd|rd|th))?,?)\\s+(1[1-9]\\d\\d|20\\d\\d)\\b(?![.,]?\\d)", "gi");
    private static readonly JsRe BARE_EXPONENT = JsRegex.Compile(
        "(\\d[\\d.,]*|(?<![A-Za-z])[A-Za-z]{1,3})\\s?(\\u207b?[\\u2070\\u00b9\\u00b2\\u00b3\\u2074-\\u2079]+)", "gu");
    private static readonly JsRe HAS_LOWER = JsRegex.Compile("[a-z]");
    private static readonly JsRe CAPS_ROMAN = JsRegex.Compile("\\b([A-Za-z][A-Za-z']*)\\s+([IVXLCDM]{2,})\\b", "g");
    private static readonly JsRe CAP_INITIAL = JsRegex.Compile("^[A-Z]");
    private static readonly JsRe LOWER_ROMAN = JsRegex.Compile(
        "\\b([a-z']+)\\s+(ii|iii|iv|vii|viii|ix|xii|xiii|xiv|xv|xvi|xvii|xviii|xix|xx)\\b", "gi");
    private static readonly JsRe AMP_ENTITY = JsRegex.Compile("\\s*&amp;\\s*", "giu");
    private static readonly JsRe AMP = JsRegex.Compile("\\s*&\\s*", "gu");
    private static readonly JsRe TIMES_SIGN = JsRegex.Compile("(\\d)\\s*(×|x)\\s*(?=\\d)", "gu");
    private static readonly JsRe HAS_UNIT_TAIL = JsRegex.Compile("^\\d[\\d.,]*\\s?[A-Za-z]", "u");
    private static readonly JsRe HAS_SPACE = JsRegex.Compile("\\s", "u");
    private static readonly JsRe DIVIDE = JsRegex.Compile("(\\d)\\s*÷\\s*(?=\\d)", "gu");
    private static readonly JsRe EQUALS = JsRegex.Compile("(\\S)\\s*=\\s*(\\S)", "gu");
    private static readonly JsRe LESS_THAN = JsRegex.Compile("(\\d)\\s*<\\s*(?=\\d)", "gu");
    private static readonly JsRe GREATER_THAN = JsRegex.Compile("(\\d)\\s*>\\s*(?=\\d)", "gu");
    private static readonly JsRe COMMAS = JsRegex.Compile(",", "g");
    private static readonly JsRe ONE_EXACT = JsRegex.Compile("^1(?:\\.0+)?$");
    private static readonly JsRe ONE_INT = JsRegex.Compile("^1$");

    /** Normalize one English input string. Pure text→text; no IPA. */
    public static string NormalizeEnglish(string input)
    {
        var s = input;

        // 0) ABBREVIATIONS: dotted forms first (the dot is consumed so it can't become a phrase break), then the
        //    undotted saint pattern ("st petersburg"). An undotted "st" before a function word stays as-is: the
        //    dict's street reading is correct there ("main st in dublin"). A dotted abbreviation at phrase end
        //    is the trailing use (street/drive), keeping the punctuation that follows it.
        s = TITLE_ABBREV.Replace(s, m =>
        {
            var next = m.Groups[2].Value;
            return $"{DOTTED_ABBREV[m.Groups[1].Value.ToLowerInvariant()](next)} {next}";
        });
        s = TITLE_ABBREV_END.Replace(s, m => m.Groups[1].Value.ToLowerInvariant() switch
        {
            "st" => "street", "dr" => "drive", _ => "mount",
        });
        s = SAINT_UNDOTTED.Replace(s, m =>
        {
            var next = m.Groups[1].Value;
            return ABBREV_FUNCTION_NEXT.IsMatch(next) ? m.Value : $"saint {next}";
        });

        // 0b) MORE DOTTED ABBREVIATIONS. The dot is consumed when the sentence continues so it cannot become a
        //     phrase break, and kept at a phrase end where it really is the sentence end — the same discipline
        //     as the st./dr. rule above, and the shape every arm in this step repeats.
        s = PLAIN_MID.Replace(s, m => $"{PLAIN_ABBREV[m.Groups[1].Value.ToLowerInvariant()]}{m.Groups[2].Value}");
        s = PLAIN_END.Replace(s, m => $"{PLAIN_ABBREV[m.Groups[1].Value.ToLowerInvariant()]}.");
        //     `et al.` is TWO tokens, so it needs its own arm after the single-token rule above has run.
        s = ET_AL_MID.Replace(s, "et al$1");
        s = ET_AL_END.Replace(s, "et al.");
        //     `c.`/`ca.` is circa ONLY before a year — a bare `c.` is the letter (or an initial) and must be
        //     left to the initials rule, so the digit lookahead is what makes this safe.
        s = CIRCA.Replace(s, "circa ");
        //     `No.` before a DIGIT is the number sign; the rule above needs a following letter.
        s = NUMBER_SIGN.Replace(s, "number ");
        //     `e.g.` and `i.e.` take the ENGLISH GLOSS, which is a CHOICE: readers genuinely disagree three ways
        //     (letter names, "for example", omitting it outright), so there is no single correct target here.
        //     ⚠ The lookahead admits a DIGIT — "i.e. 0 or 1" occurs, and a letter-only lookahead lets it fall
        //     through to the dot-stripping, which reads the bare "ie" as the word [iː].
        s = EG_MID.Replace(s, "for example$1");
        s = EG_END.Replace(s, "for example.");
        s = IE_MID.Replace(s, "that is$1");
        s = IE_END.Replace(s, "that is.");
        //     a.m./p.m. likewise: dot-stripping alone leaves lowercase "am", which reads as the verb.
        s = AM_PM.Replace(s, m => m.Groups[1].Value.ToLowerInvariant() == "a" ? "ay em" : "pee em");
        //     Other dotted initialisms (U.S., U.K.) — strip the interior dots so they cannot become pause marks,
        //     leaving the letters for the initialism pass or the dictionary.
        //     ⚠ AND UPPERCASED, because a contiguous dotted letter run IS an initialism by construction, while
        //     the pass that spells one out is gated on capitals. On lowercased input `u.s.` became `us` and was
        //     read as the WORD *ʌs*; the reader said "U-S".
        s = DOTTED_INITIALS.Replace(s, m => DOTS.Replace(m.Value, "").ToUpperInvariant());

        // 0c) ERA MARKERS. Spelled out, not expanded to words: "B C" is how they are read aloud, and "AD" must
        //     not be read as the word "ad".
        s = ERA.Replace(s, m => m.Value switch
        {
            "BCE" => "bee see ee", "BC" => "bee see", "CE" => "see ee", "AD" => "ay dee", _ => m.Value,
        });

        // 0d) DIGIT GROUPING with a space (SI style, "1 356"). The number token cannot span a space, so these
        //     read as two numbers with the thousand lost.
        // ⚠ TWO GUARDS, BOTH FROM THE AUDIO. The wav2vec2 pass caught this rule joining numbers that were never
        //     one number, and English has no genuine space-grouped instance to trade against: across en_us the
        //     pattern matched twice and BOTH were false merges. LEADING GROUP 1-3 DIGITS is the shape of SI
        //     grouping itself; NOT AFTER A MONTH NAME fixes the day/year pair.
        s = SPACE_GROUP.Replace(s, m => SPACE_GROUP_SEPS.Replace(m.Value, ""));

        // 0e) SCIENTIFIC NOTATION'S EXPONENT, resolved before BOTH the sign rule and the unit rule — ⚠ AND THE
        //     ORDERING IS THE WHOLE REASON THIS IS SEPARATE FROM 6b rather than the same rule.
        //     A superscript sits BETWEEN the number and its unit (`9.11 × 10⁻³¹ kg`), which breaks the adjacency
        //     the unit rule matches on: the unit then fails and `kg` reaches the phoneme stream RAW as *kɡ*.
        //     ⚠ THE ASCII FORM IS MATCHED TOO, and it is the one that actually occurs. THE ATTACHED MINUS IS THE
        //     DISCRIMINATOR: `10 -31` is scientific notation, `10 - 31` (spaced both sides) is subtraction.
        s = SCI_EXPONENT.Replace(s, m =>
        {
            var ten = m.Groups[1].Value;
            var sup = m.Groups[2].Value;
            var digits = sup.StartsWith("-", StringComparison.Ordinal)
                ? sup
                : string.Concat(Js.CodePoints(sup).Select(c => SUPERSCRIPT_DIGIT[c]));
            var neg = digits.StartsWith("-", StringComparison.Ordinal);
            return $"{ten} to the power of {(neg ? $"negative {digits[1..]}" : digits)}";
        });

        // 0f) NEGATIVES. A dropped minus sign INVERTS the meaning, which for a temperature is the worst class of
        //     silent error: "-5 degrees" read as "five degrees".
        //     ⚠ "NEGATIVE", NOT "MINUS": `minus` is the ARITHMETIC OPERATOR, `negative` is the SIGN on an amount.
        s = NEGATIVE.Replace(s, "$1negative $2");
        //     ⚠ THE SIGN ARM ABOVE REQUIRES THE DIGIT IMMEDIATELY, with no `\s?`, and that is what keeps a
        //     spaced range out. `±` can afford the `\s?` because no range is written with one.
        s = PLUS_MINUS.Replace(s, "$1plus or minus $2");

        // 0f0) NUMERIC DATES, before the fraction rule and before the date/year steps below.
        s = ISO_DATE.Replace(s, m =>
            IsoDate(Js.Number(m.Groups[1].Value), Js.Number(m.Groups[2].Value), Js.Number(m.Groups[3].Value)) ?? m.Value);
        s = US_DATE.Replace(s, m =>
            IsoDate(Js.Number(m.Groups[3].Value), Js.Number(m.Groups[1].Value), Js.Number(m.Groups[2].Value)) ?? m.Value);

        // 0f1) MONEY with cents. Read as "five dollars fifty", not "five point five zero dollars".
        s = MONEY_CENTS.Replace(s, m =>
        {
            var sym = m.Groups[1].Value;
            var intPart = m.Groups[2].Value;
            var cents = m.Groups[3].Value;
            var forms = CURRENCY[sym];
            var unit = ONE_INT.IsMatch(COMMAS.Replace(intPart, "")) ? forms[0] : forms[1];
            return cents == "00" ? $"{intPart} {unit}" : $"{intPart} {unit} {Js.NumberToString(Js.Number(cents))}";
        });

        // 0f2) PLUS. The mirror of the minus rule: a dropped sign is silent content loss.
        s = PLUS_ATTACHED.Replace(s, "$1 plus $2");
        s = PLUS_LEADING.Replace(s, "$1plus $2");

        // 0g) FRACTIONS. Guarded against dates (3/14/2011) and unit ratios (km/h) by requiring digits both sides
        //     and nothing numeric or alphabetic after.
        s = FRACTION.Replace(s, m =>
            FractionWords(Js.Number(m.Groups[1].Value), Js.Number(m.Groups[2].Value)) ?? m.Value);

        // 1) CURRENCY before anything else touches the digits: the symbol precedes but is SPOKEN after, and a
        //    magnitude word hops with it ($5 million → "5 million dollars").
        //    ⚠ AND THE ABBREVIATED MAGNITUDE HOPS THE SAME WAY — `$1.5m` → "1.5 million dollars". It is spent
        //    HERE because the currency rule CONSUMES THE NUMBER, and because the UNIT step below would otherwise
        //    claim the `m` as a metre.
        s = CURRENCY_RE.Replace(s, m =>
        {
            var sym = m.Groups[1].Value;
            var num = m.Groups[2].Value;
            var spelled = m.Groups[3].Success ? m.Groups[3].Value : null;
            var abbrev = m.Groups[4].Success ? m.Groups[4].Value : null;
            var forms = CURRENCY[sym];
            var mag = spelled ?? (abbrev is null ? null : $" {MONEY_MAGNITUDE[abbrev]}");
            var one = ONE_EXACT.IsMatch(COMMAS.Replace(num, ""));
            return $"{num}{mag ?? ""} {(one && mag is null ? forms[0] : forms[1])}";
        });

        // 2) PERCENT: "40%" → "40 percent". Before times/years so the bare number stays one token.
        s = PERCENT.Replace(s, "$1 percent");

        // 3) TIMES: H:MM (optionally already followed by am/pm, which the dictionary reads fine).
        //    :00 → o'clock (dropped before am/pm: "3 pm", not "3 o'clock pm"), :0X → "oh X".
        s = CLOCK.Replace(s, m =>
        {
            var h = m.Groups[1].Value;
            var mm = m.Groups[2].Value;
            var suffix = m.Groups[3].Success ? m.Groups[3].Value : "";
            if (mm == "00") return suffix.Length > 0 ? $"{h}{suffix}" : $"{h} o'clock";
            if (mm.StartsWith("0", StringComparison.Ordinal)) return $"{h} oh {Js.NumberToString(Js.Number(mm))}{suffix}";
            return $"{h} {mm}{suffix}";
        });

        // 4) DATES: month + bare day number → ordinal suffix, letting the existing 16th path speak it
        //    (february 16 → "february 16th"). Runs BEFORE years.
        s = MONTH_DAY.Replace(s, m =>
        {
            var mon = m.Groups[1].Value;
            var d = m.Groups[2].Value;
            var n = Js.Number(d);
            if (n < 1 || n > 31) return m.Value;
            var suf = d.EndsWith("1", StringComparison.Ordinal) && n != 11 ? "st"
                : d.EndsWith("2", StringComparison.Ordinal) && n != 12 ? "nd"
                : d.EndsWith("3", StringComparison.Ordinal) && n != 13 ? "rd" : "th";
            return $"{mon} {d}{suf}";
        });

        // 5) YEARS: a bare 4-digit 1100–2099 in a date-like CONTEXT → pair-wise reading. ⚠ Context-gated on
        //    purpose: "2011 people died" must not become "twenty eleven people".
        //    ⚠ A DASHED PAIR OF 4-DIGIT YEARS IS A DATE RANGE, and it MUST RUN BEFORE THE CONTEXT RULE — with
        //    the context rule first, "from 1918-1939" had its LEFT year consumed and the pair was gone.
        //    ⚠ AND A DATE RANGE ASCENDS: `call 1800-1234` is a phone number, not a reign.
        s = YEAR_RANGE.Replace(s, m =>
        {
            double a = Js.Number(m.Groups[1].Value), b = Js.Number(m.Groups[3].Value);
            return b >= a ? $"{YearWords(a)}{m.Groups[2].Value}{YearWords(b)}" : m.Value;
        });
        //    ⚠ A DETERMINER MAY SIT BETWEEN THE CONTEXT WORD AND THE YEAR: "in a 1998 book" read as *one
        //    thousand nine hundred ninety-eight* while "in 1998" read correctly.
        s = YEAR_CONTEXT.Replace(s, m =>
        {
            var ctx = m.Groups[1].Value;
            var det = m.Groups[2].Success ? m.Groups[2].Value : null;
            var y = Js.Number(m.Groups[3].Value);
            // ⚠ THE DETERMINER ARM IS PRE-2010 ONLY, and the split is measured, not stylistic: 12 closer / 0
            // further on years before 2000, and 1 closer / 6 further on 2010-2019.
            return det is not null && y >= 2010 ? m.Value : $"{ctx}{det ?? ""} {YearWords(y)}";
        });
        s = YEAR_MONTH.Replace(s, m =>
            $"{m.Groups[1].Value}{m.Groups[2].Value} {YearWords(Js.Number(m.Groups[3].Value))}");

        // 6) UNITS: number + known abbreviation. Count agreement from the number.
        s = UNIT_RE.Replace(s, m =>
        {
            var num = m.Groups[1].Value;
            var mag = m.Groups[2].Success ? m.Groups[2].Value : null;
            var u = m.Groups[3].Value;
            var exp = m.Groups[4].Success ? m.Groups[4].Value : null;
            // ⚠ SAME TWO STEPS, SAME HELPER as the shared symbol layer — English keeps its own UNITS table
            // (this normalizer predates that layer), and it carried the same `UNITS[u.toLowerCase()]!` that
            // #763 fixed there: an uppercase key was unreachable and the assertion made the miss a THROW.
            var forms = NormalizeSymbols.ResolveUnitSymbol(UNITS, UNITS_FOLDED, u);
            if (forms is null) return m.Value; // unresolvable → leave the text alone
            // English puts the measure word BEFORE the unit — "square kilometers" — and the COUNT still
            // governs the noun: "one cubic meter", not "one cubic meters".
            var measure = exp == "²" || exp == "2" ? "square " : exp == "³" || exp == "3" ? "cubic " : "";
            // ⚠ A magnitude forces the PLURAL: "2.2 million square kilometres", never "…kilometre".
            var one = mag is null && ONE_EXACT.IsMatch(COMMAS.Replace(num, ""));
            return $"{num}{mag ?? ""} {measure}{(one ? forms[0] : forms[1])}";
        });

        // 6b) A BARE EXPONENT — a base with NO unit for the rule above to attach the power to, so the
        //     superscript is dropped outright. Ordered AFTER the unit rule so a unit exponent is never stolen.
        //     ⚠ THE PREDICATE IS A DIFFERENT WORD FROM THE MODIFIER: *square kilometres* but *twenty SQUARED*.
        //     ⚠ A LETTER BASE IS CAPPED AT THREE, because a superscript on an ordinary word is a FOOTNOTE
        //     marker far more often than an exponent — and the cap needs `(?<![A-Za-z])` or it caps nothing.
        s = BARE_EXPONENT.Replace(s, m =>
        {
            var bas = m.Groups[1].Value;
            var digits = string.Concat(Js.CodePoints(m.Groups[2].Value).Select(c => SUPERSCRIPT_DIGIT[c]));
            //     ⚠ THE SIGN WORD IS EMITTED HERE, not left as an ASCII `-` for the sign rule to pick up:
            //     that rule is step 0f and this is step 6b, so a `-` would simply be dropped.
            var neg = digits.StartsWith("-", StringComparison.Ordinal);
            var mag = neg ? digits[1..] : digits;
            var power = neg ? $"negative {mag}" : mag;
            return mag == "2" && !neg ? $"{bas} squared"
                : mag == "3" && !neg ? $"{bas} cubed"
                : $"{bas} to the power of {power}";
        });

        // 7a) ALL-CAPS romans of ANY value, when the text distinguishes case — "Super Bowl LVIII" (58),
        //     "WrestleMania XL" (40), "Louis XVI". Case makes them unambiguous, but an acronym is also all-caps
        //     ("the CD player"), so the preceding word must itself be evidence.
        if (HAS_LOWER.IsMatch(s))
        {
            s = CAPS_ROMAN.Replace(s, m =>
            {
                var prev = m.Groups[1].Value;
                var n = Roman.RomanToInt(m.Groups[2].Value);
                if (n is null) return m.Value;
                var evidence = ROMAN_CARDINAL_CTX.IsMatch(prev) || CAP_INITIAL.IsMatch(prev);
                if (!evidence) return m.Value;
                if (ROMAN_CARDINAL_CTX.IsMatch(prev)) return $"{prev} {n}";
                var v = n.Value;
                var suf = v % 10 == 1 && v % 100 != 11 ? "st" : v % 10 == 2 && v % 100 != 12 ? "nd"
                    : v % 10 == 3 && v % 100 != 13 ? "rd" : "th";
                return $"{prev} the {v}{suf}";
            });
        }

        // 7b) ROMAN NUMERALS, the closed 2–20 set: cardinal after a context word, else the regnal ordinal.
        s = LOWER_ROMAN.Replace(s, m =>
        {
            var prev = m.Groups[1].Value;
            var n = ROMAN[m.Groups[2].Value.ToLowerInvariant()];
            if (ROMAN_CARDINAL_CTX.IsMatch(prev)) return $"{prev} {n}";
            var suf = n % 10 == 1 && n != 11 ? "st" : n % 10 == 2 && n != 12 ? "nd" : n % 10 == 3 && n != 13 ? "rd" : "th";
            return $"{prev} the {n}{suf}";
        });

        // 8) THE AMPERSAND AND THE SIGN CLASSES. A dropped sign is inaudible, the one outcome that cannot be
        //    right: `College of Arts & Sciences` read *Arts Sciences*, `B&Bs` read *bee bees*.
        //    ⚠ LAST, deliberately. Every rule above matches on digits or letters adjacent to a symbol.
        //    ⚠ THE HTML ENTITY FIRST, or the bare-`&` rule below turns `&amp;` into "and amp;".
        s = AMP_ENTITY.Replace(s, " and ");
        s = AMP.Replace(s, " and ");
        //    `×`/`÷`/`<`/`>` only BETWEEN digits.
        // ⚠ TWO WORDS FOR ONE SIGN, and ASCII `x` accepted alongside `×`. English says "six BY six centimetres"
        //     for a FORMAT and "five TIMES five" for a PRODUCT. THE DISCRIMINATOR: a unit after the right
        //     operand means a measurement; an UNSPACED ascii `x` between digits is the `4x4`/`6x6` idiom.
        s = TIMES_SIGN.Replace(s, m =>
        {
            var left = m.Groups[1].Value;
            var sign = m.Groups[2].Value;
            var tail = s[(m.Index + m.Value.Length)..];
            var hasUnit = HAS_UNIT_TAIL.IsMatch(tail);
            var unspacedAscii = sign == "x" && !HAS_SPACE.IsMatch(m.Value);
            return $"{left} {(hasUnit || unspacedAscii ? "by" : "times")} ";
        });
        s = DIVIDE.Replace(s, "$1 divided by ");
        //    ⚠ `=` takes the house pattern `(\S)\s*=\s*(\S)`, not the digit gate: an equals sign between
        //    non-digits is still an equals sign (`x = y`), and unlike `<`/`>` it carries no tag hazard.
        s = EQUALS.Replace(s, "$1 equals $2");
        s = LESS_THAN.Replace(s, "$1 less than ");
        s = GREATER_THAN.Replace(s, "$1 greater than ");

        return s;
    }

    // ── Initialisms ─────────────────────────────────────────────────────────────────────────────────────
    /**
     * English phonotactics, for the fail-safe guard in core/initialisms.ts. English codas are far more
     * permissive than French ones, so the load here is carried mostly by the no-vowel test — which is exactly
     * the failing class (NHS, MP, GDP, DVD, TV, PBS all lack a vowel entirely).
     */
    public static readonly Func<string, bool> IsUnreadableEnglish = Initialisms.MakeUnreadableTest(new PhonotacticsData
    {
        Vowels = JsRegex.Compile("[aeiouy]", "u"),
        LegalOnsets = new HashSet<string>(new[]
        {
            "bl", "br", "ch", "cl", "cr", "dr", "dw", "fl", "fr", "gh", "gl", "gr", "gn", "kn", "kl", "kr",
            "ph", "pl", "pr", "ps", "qu", "rh", "sc", "sh", "sk", "sl", "sm", "sn", "sp", "sq", "st", "sv",
            "sw", "th", "tr", "tw", "vl", "wh", "wr", "zl",
        }, StringComparer.Ordinal),
        LegalCodas = new HashSet<string>(new[]
        {
            "ch", "ck", "ct", "ff", "ft", "gh", "gs", "ks", "ld", "lf", "lk", "ll", "lm", "ln", "lp", "ls",
            "lt", "lv", "mb", "mn", "mp", "ms", "nc", "nd", "ng", "nk", "ns", "nt", "ph", "pt", "ps", "rb",
            "rc", "rd", "rf", "rg", "rk", "rl", "rm", "rn", "rp", "rs", "rt", "rv", "sh", "sk", "sm", "sp",
            "ss", "st", "th", "ts", "tt", "xt", "zz", "bs", "ds", "ls", "nx", "mf", "lb", "rth", "nth",
        }, StringComparer.Ordinal),
    });

    private static readonly JsRe SINGLE_LOWER_LETTER = JsRegex.Compile("^[a-z]$");

    /**
     * Letter names. English needs almost no data here: CMUdict carries all 26 single letters with their
     * letter-NAME pronunciations (f = EH1 F, h = EY1 CH, w = D AH1 B AH0 L Y UW0), so emitting the bare letters
     * space-separated resolves correctly. The one exception is `a`, which the dict has as the reduced article
     * AH0 rather than the letter name.
     */
    private static string? LetterName(string l) =>
        SINGLE_LOWER_LETTER.IsMatch(l) ? (l == "a" ? "ay" : l) : null;

    /** LEXICAL: acronyms spelled out although their lowercase form is a dictionary word. Authored in
     *  english.jsonc alongside the language's other hand-authored facts, not here. */
    private static readonly IReadOnlySet<string> ACRONYM_LETTERS =
        new HashSet<string>(Manifest.MANIFEST.AcronymLetters, StringComparer.Ordinal);

    /**
     * INITIALISMS. A separate pass, not a step inside `NormalizeEnglish`, because of where it must sit: Roman
     * numerals are all-caps letter runs too, so the numeral rules get first refusal and this claims only what
     * they declined. Run earlier, this spells `Louis XIV` as EX-EYE-VEE.
     */
    public static string NormalizeEnglishInitialisms(string text, Func<string, bool> isRecorded) =>
        Initialisms.MakeInitialismNormalizer(new InitialismData
        {
            LetterName = LetterName,
            AcronymLetters = ACRONYM_LETTERS,
            IsRecorded = isRecorded,
            IsUnreadable = w => IsUnreadableEnglish(w),
        })(text);
}
