/**
 * English text normalization — rewrite non-lexical tokens into speakable words BEFORE the tokenizer, so the
 * existing number/ordinal/OOV machinery does the pronouncing.
 * Ported from src/languages/english/normalize.ts — see that file for the corpus evidence.
 */
using System.Text.RegularExpressions;
using Vernacula.Phonemizer.Core;
using static Vernacula.Phonemizer.Core.Rewriter;

namespace Vernacula.Phonemizer.Languages.English;

public static class Normalize
{
    private static readonly IReadOnlyDictionary<string, int> ROMAN = new Dictionary<string, int>(StringComparer.Ordinal)
    {
        ["ii"] = 2, ["iii"] = 3, ["iv"] = 4, ["vii"] = 7, ["viii"] = 8, ["ix"] = 9, ["xii"] = 12,
        ["xiii"] = 13, ["xiv"] = 14, ["xv"] = 15, ["xvi"] = 16, ["xvii"] = 17, ["xviii"] = 18,
        ["xix"] = 19, ["xx"] = 20,
    };

    private static readonly JsRe ROMAN_CARDINAL_CTX = JsRegex.Compile(
        "\\b(war|chapter|part|act|section|volume|book|phase|stage|grade|class|type|level|apollo|rocky|bowl|wrestlemania|olympiad|super)$", "i");

    private static readonly IReadOnlyDictionary<string, string[]> UNITS = new Dictionary<string, string[]>(StringComparer.Ordinal)
    {
        ["km"] = new[] { "kilometer", "kilometers" }, ["cm"] = new[] { "centimeter", "centimeters" },
        ["mm"] = new[] { "millimeter", "millimeters" }, ["kg"] = new[] { "kilogram", "kilograms" },
        ["mg"] = new[] { "milligram", "milligrams" }, ["lb"] = new[] { "pound", "pounds" },
        ["lbs"] = new[] { "pounds", "pounds" }, ["oz"] = new[] { "ounce", "ounces" },
        ["ft"] = new[] { "foot", "feet" }, ["mi"] = new[] { "mile", "miles" },
        ["mph"] = new[] { "miles per hour", "miles per hour" }, ["kph"] = new[] { "kilometers per hour", "kilometers per hour" },
        ["km/h"] = new[] { "kilometer per hour", "kilometers per hour" }, ["m/s"] = new[] { "meter per second", "meters per second" },
        ["miles/hour"] = new[] { "mile per hour", "miles per hour" }, ["mbit/s"] = new[] { "megabit per second", "megabits per second" },
        ["yards/meters"] = new[] { "yard per meter", "yards per meters" },
        // ⚠ SPELLED OUT IN THE TABLE — after a number the initialism pass backs off. See the TS.
        ["btu"] = new[] { "b t u", "b t u" },
        ["btu/hr"] = new[] { "b t u per hour", "b t u per hour" },
        ["btu/sf"] = new[] { "b t u per square foot", "b t u per square foot" },
        ["btu/hr/sf"] = new[] { "b t u per hour, per square foot", "b t u per hour, per square foot" },
        ["°c"] = new[] { "degree Celsius", "degrees Celsius" }, ["°f"] = new[] { "degree Fahrenheit", "degrees Fahrenheit" },
        ["℃"] = new[] { "degree Celsius", "degrees Celsius" }, ["℉"] = new[] { "degree Fahrenheit", "degrees Fahrenheit" },
        ["°"] = new[] { "degree", "degrees" },
        // ⚠ OHM IS DECLARED EXACTLY AND NOT CASE-FOLDED. `ResolveUnitSymbol` only folds a key of length > 1,
        // so the bare sign must be declared to be reachable — and the PREFIXED forms must be too, because
        // folding destroys the distinction that matters: `mΩ` is a MILLIohm and `MΩ` a MEGAohm, 10⁹ apart.
        // ⚠ AND THE PREFIXES ARE HERE SO NOTHING IS STRANDED: the key list is sorted longest-first, so with
        // only the bare sign declared `5 kΩ` would match the `Ω` and leave the `k` to reach the g2p raw.
        // ⚠ TWO CODE POINTS, the same shape as ℃: U+03A9 GREEK CAPITAL OMEGA and U+2126 OHM SIGN.
        // ⚠ THE PREFIXED FORMS ARE TWO WORDS, the idiom the micro entries use — the glued spellings are
        // mangled by the OOV g2p at the `o|o` seam (`kiloohm` → kʰˈɪləm, "killum"). See the TS twin.
        ["Ω"] = new[] { "ohm", "ohms" }, ["\u2126"] = new[] { "ohm", "ohms" },
        ["kΩ"] = new[] { "kilo ohm", "kilo ohms" },
        ["MΩ"] = new[] { "mega ohm", "mega ohms" },
        ["mΩ"] = new[] { "milli ohm", "milli ohms" },
        // ⚠ EVERY SPELLING IS DECLARED, AND THESE ARE NOT REDUNDANT — leaving them out INVERTED THE
        // MAGNITUDE BY 10⁹. `mΩ` written with U+2126 or a lowercase omega misses the exact table, falls to
        // the FOLDED index, and `"m\u2126".ToLowerInvariant()` is `"mω"` — the slot `MΩ` already occupies.
        // Measured: `a 5 m\u2126 shunt` read "MEGA ohms". The folded index cannot carry them, because case
        // IS the distinction. See the TS twin.
        ["k\u2126"] = new[] { "kilo ohm", "kilo ohms" },
        ["M\u2126"] = new[] { "mega ohm", "mega ohms" },
        ["m\u2126"] = new[] { "milli ohm", "milli ohms" },
        ["kω"] = new[] { "kilo ohm", "kilo ohms" },
        ["Mω"] = new[] { "mega ohm", "mega ohms" },
        ["mω"] = new[] { "milli ohm", "milli ohms" },
        // ⚠ MICRO IS TWO CODE POINTS AND THE GREEK ONE DOMINATES — U+00B5 MICRO SIGN vs U+03BC GREEK
        // SMALL LETTER MU, 14 to 490 across the mined corpora. Neither folds to the other, so BOTH are
        // declared, as ℃ is declared beside °c above. The drop here was a WRONG UNIT, not a missing
        // word: `5 µg` had no key, the sign fell out, and the bare `g` was SPELLED — "five gee".
        // ⚠ micro meter / micro liter are TWO WORDS on purpose — "micrometer" is recorded as the
        // CALIPER and "microliter" comes out with an unstressed `li`. See normalize.ts for the full
        // reasoning and the British-spelling attempts that do not rescue it.
        ["\u00b5g"] = new[] { "microgram", "micrograms" }, ["\u03bcg"] = new[] { "microgram", "micrograms" },
        ["\u00b5s"] = new[] { "microsecond", "microseconds" }, ["\u03bcs"] = new[] { "microsecond", "microseconds" },
        ["\u00b5mol"] = new[] { "micromole", "micromoles" }, ["\u03bcmol"] = new[] { "micromole", "micromoles" },
        ["\u00b5m"] = new[] { "micro meter", "micro meters" }, ["\u03bcm"] = new[] { "micro meter", "micro meters" },
        ["\u00b5l"] = new[] { "micro liter", "micro liters" }, ["\u03bcl"] = new[] { "micro liter", "micro liters" },
        // ⚠ ⟨µin⟩ IS A WHOLE KEY BECAUSE ⟨in⟩ CANNOT BE ONE: the bare inch is the English PREPOSITION,
        // so declaring it would read `5 in the morning` as "5 inches the morning". ONE word, unlike
        // ⟨µm⟩/⟨µl⟩ above — measured, not assumed: `microinch` reads as one token with one primary
        // stress. See the TypeScript.
        ["\u00b5in"] = new[] { "microinch", "microinches" }, ["\u03bcin"] = new[] { "microinch", "microinches" },
        ["\u2032"] = new[] { "foot", "feet" }, ["\u2033"] = new[] { "inch", "inches" },   // PRIME, DOUBLE PRIME
        // ⚠ CAPITALS ⟨M⟩ AND ⟨S⟩ ARE DIFFERENT UNITS — µM is MICROMOLAR, µS is MICROSIEMENS, not sloppy
        // spellings of µm/µs. ResolveUnitSymbol consults the declared table with the EXACT written form
        // before folding, so declaring them is what stops `25 µM` folding to `µm` and reading "micro
        // METERS" — the wrong-unit failure this block exists to remove, reintroduced by the fix for it.
        // ⟨L⟩ needs no twin: µL and µl are the same unit. See normalize.ts.
        ["\u00b5M"] = new[] { "micromolar", "micromolar" }, ["\u03bcM"] = new[] { "micromolar", "micromolar" },
        ["\u00b5S"] = new[] { "microsiemens", "microsiemens" }, ["\u03bcS"] = new[] { "microsiemens", "microsiemens" },
        ["\u00b5g/g"] = new[] { "microgram per gram", "micrograms per gram" }, ["\u03bcg/g"] = new[] { "microgram per gram", "micrograms per gram" },
        ["\u00b5g/ml"] = new[] { "microgram per milliliter", "micrograms per milliliter" }, ["\u03bcg/ml"] = new[] { "microgram per milliliter", "micrograms per milliliter" },
        ["\u00b5mol/l"] = new[] { "micromole per liter", "micromoles per liter" }, ["\u03bcmol/l"] = new[] { "micromole per liter", "micromoles per liter" },
        ["m"] = new[] { "meter", "meters" },
        ["l"] = new[] { "liter", "liters" }, ["L"] = new[] { "liter", "liters" }, ["ml"] = new[] { "milliliter", "milliliters" },
        ["g"] = new[] { "gram", "grams" }, ["t"] = new[] { "ton", "tons" }, ["W"] = new[] { "watt", "watts" },
        ["ha"] = new[] { "hectare", "hectares" },
        ["hz"] = new[] { "hertz", "hertz" }, ["khz"] = new[] { "kilohertz", "kilohertz" }, ["mhz"] = new[] { "megahertz", "megahertz" },
        ["ghz"] = new[] { "gigahertz", "gigahertz" }, ["kb"] = new[] { "kilobyte", "kilobytes" }, ["mb"] = new[] { "megabyte", "megabytes" },
        ["gb"] = new[] { "gigabyte", "gigabytes" }, ["tb"] = new[] { "terabyte", "terabytes" }, ["kw"] = new[] { "kilowatt", "kilowatts" },
    };

    /** The case-folded index for step 1 (see resolveUnitSymbol) — built once, beside the table it indexes. */
    /**
     * THE GREEK ALPHABET AS ENGLISH WORDS (#1448) — the name an English speaker says for the letter.
     * ⚠ THE NAMES ARE ENGLISH, NOT TRANSLITERATIONS: `β` is "beta", not the Modern Greek "vita". That
     * difference IS the defect. Both cases map to one name; `ξ`/`Ξ` is the phonetic respelling `zye` (/zaɪ/)
     * because the lexicon's `xi` is the Chinese SURNAME and no lexicon edit can fix a homograph. See the TypeScript twin.
     */
    private static readonly IReadOnlyDictionary<string, string> GREEK_NAME = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["α"] = "alpha", ["β"] = "beta", ["γ"] = "gamma", ["δ"] = "delta", ["ε"] = "epsilon", ["ζ"] = "zeta",
        ["η"] = "eta", ["θ"] = "theta", ["ι"] = "iota", ["κ"] = "kappa", ["λ"] = "lambda", ["μ"] = "mu",
        ["ν"] = "nu", ["ξ"] = "zye", ["ο"] = "omicron", ["π"] = "pi", ["ρ"] = "rho", ["σ"] = "sigma",
        ["ς"] = "sigma", ["τ"] = "tau", ["υ"] = "upsilon", ["φ"] = "phi", ["χ"] = "chi", ["ψ"] = "psi",
        ["ω"] = "omega",
        ["Α"] = "alpha", ["Β"] = "beta", ["Γ"] = "gamma", ["Δ"] = "delta", ["Ε"] = "epsilon", ["Ζ"] = "zeta",
        ["Η"] = "eta", ["Θ"] = "theta", ["Ι"] = "iota", ["Κ"] = "kappa", ["Λ"] = "lambda", ["Μ"] = "mu",
        ["Ν"] = "nu", ["Ξ"] = "zye", ["Ο"] = "omicron", ["Π"] = "pi", ["Ρ"] = "rho", ["Σ"] = "sigma",
        ["Τ"] = "tau", ["Υ"] = "upsilon", ["Φ"] = "phi", ["Χ"] = "chi", ["Ψ"] = "psi", ["Ω"] = "omega",
        // ⚠ U+2126 OHM SIGN is a second code point for the same letter and needs its own key, exactly as
        // UNITS declares it separately — without it the bare character fell through to the Greek reader and
        // came back `omeɣa`, the phone english.jsonc does not declare. See the TS twin.
        ["\u2126"] = "omega",
    };

    /** ONE Greek letter with no Greek letter or combining mark on either side — a run of exactly one.
     *  ⚠ THE LOOKAROUNDS ARE THE WHOLE RULE, and the combining marks are in them: a decomposed accented
     *  Greek vowel would otherwise read as a lone letter and turn the first letter of a Greek word into
     *  "alpha". A LATIN neighbour is accepted on purpose — `Δx`, `μm`, `5Ω`. See the TypeScript twin. */
    private static readonly JsRe GREEK_LETTER =
    // ⚠ `Script=Greek`, NOT .NET's `\p{IsGreek}`. Those are different things — `IsGreek` is the BLOCK
    // (U+0370–U+03FF, which also holds Coptic letters) and `Script=Greek` is the SCRIPT (which adds Greek
    // Extended, U+1F00–U+1FFF, and excludes the Coptic ones). Writing the block here would have diverged
    // from the TypeScript on both edges. `JsRegex` translates `Script=` from tables generated by the same
    // engine as the TS, so the identical source string is the only way the two ports can agree.
        JsRegex.Compile("([\\p{L}\\p{Nd}])?(?<![\\p{Script=Greek}\\p{M}²³])(\\p{Script=Greek})([²³])?"
            + "(?![\\p{Script=Greek}\\p{M}²³])([\\p{L}\\p{Nd}])?", "gu");

    /** ⚠ THE SUPERSCRIPT IS CONSUMED HERE because step 6b's bare-exponent rule caps a LETTER base at three
     *  characters — `Smith¹` is a footnote, not an exponent — and `omega` is five, so `Ω²` would otherwise
     *  lose its `²` outright. The cap's reasoning does not apply to a Greek base: no one footnotes a lone
     *  Greek letter. The PREDICATE, not the modifier: *chi SQUARED*, never *cubic chi*. See the TS twin. */
    private static readonly IReadOnlyDictionary<string, string> GREEK_EXPONENT = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["²"] = " squared", ["³"] = " cubed",
    };

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

    /** The fractional unit of each currency — [singular, plural]; the penny's plural is suppletive.
     *  ⚠ ⟨¥⟩ HAS NO ENTRY ON PURPOSE — see src/languages/english/normalize.ts. */
    private static readonly IReadOnlyDictionary<string, string[]> SUBUNIT = new Dictionary<string, string[]>(StringComparer.Ordinal)
    {
        ["$"] = new[] { "cent", "cents" }, ["€"] = new[] { "cent", "cents" }, ["£"] = new[] { "penny", "pence" },
    };

    /** A MAGNITUDE ABBREVIATION GLUED TO A MONEY FIGURE — `$1.5m`, `£2.3m`, `$2bn`, `£700k`. */
    private static readonly IReadOnlyDictionary<string, string> MONEY_MAGNITUDE = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["m"] = "million", ["M"] = "million", ["bn"] = "billion", ["BN"] = "billion",
        ["Bn"] = "billion", ["B"] = "billion", ["k"] = "thousand", ["K"] = "thousand",
    };
    private static readonly string MONEY_MAG_ALT = string.Join("|", MONEY_MAGNITUDE.Keys.OrderByDescending(k => k.Length));

    private const string MONTH_ALT = "january|february|march|april|may|june|july|august|september|october|november|december";
    /** ⚠ The month list WITHOUT ⟨may⟩, for the weekday gate only — `may` is a modal verb and `wed`/`sat`
     *  take a bare date complement. See src/languages/english/normalize.ts. */
    private static readonly string MONTH_ALT_NO_MAY = string.Join("|", MONTH_ALT.Split('|').Where(m => m != "may"));

    /** Three-letter month abbreviations → the month NAME. ⚠ `may` is deliberately absent. */
    private static readonly IReadOnlyDictionary<string, string> MONTH_ABBREV = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["jan"] = "january", ["feb"] = "february", ["mar"] = "march", ["apr"] = "april", ["jun"] = "june",
        ["jul"] = "july", ["aug"] = "august", ["sep"] = "september", ["sept"] = "september",
        ["oct"] = "october", ["nov"] = "november", ["dec"] = "december",
    };
    /** Longest-first, so `sept` is claimed before `sep` can take its first three letters. */
    private static readonly string MONTH_ABBREV_ALT = string.Join("|", MONTH_ABBREV.Keys.OrderByDescending(k => k.Length));

    /** Weekday abbreviations → the weekday NAME. */
    private static readonly IReadOnlyDictionary<string, string> WEEKDAY_ABBREV = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["mon"] = "monday", ["tue"] = "tuesday", ["tues"] = "tuesday", ["wed"] = "wednesday",
        ["weds"] = "wednesday", ["thu"] = "thursday", ["thur"] = "thursday", ["thurs"] = "thursday",
        ["fri"] = "friday", ["sat"] = "saturday", ["sun"] = "sunday",
    };
    /** Longest-first: `thurs` before `thur` before `thu`, `tues` before `tue`, `weds` before `wed`. */
    private static readonly string WEEKDAY_ABBREV_ALT = string.Join("|", WEEKDAY_ABBREV.Keys.OrderByDescending(k => k.Length));

    private static readonly JsRe ABBREV_FUNCTION_NEXT = JsRegex.Compile(
        "^(?:in|on|at|and|or|but|the|a|an|is|was|were|are|to|for|with|of|from|by|near|that|this|it|he|she|they|we|you|i|as|his|her|its|their|there|then|when|where|which|who|had|has|have)$", "i");

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

    private const string NOT_VERSION = "(?<![\\d.,])(?!802[.,]11\\w)(?!\\d+[.,]\\d+[a-zA-Z](?![a-zA-Z\\d]))";

    /**
     * ⚠ THE TWO CODE GUARDS ARE NOT DECORATION — see the TypeScript's `UNIT_RE`, which carries the full
     * reasoning. A one-letter unit symbol glued behind a digit is ambiguous with the letter slot of an
     * alphanumeric CODE, and ⟨L⟩ and ⟨W⟩ are the only two that can collide, because one-letter
     * symbols resolve case-SENSITIVELY (#763) — uppercase ⟨G⟩/⟨T⟩/⟨M⟩ are not gram/ton/metre.
     *
     * ⚠ AND THEY WERE MISSING HERE WHILE THE PARITY GATE READ 189 BYTE-IDENTICAL (#1421). The gate is
     * golden-driven and no golden row carries a postal code, so this was not a check that was too weak
     * — it is outside what the check ranges over. Measured before the fix: `V6L 2T5` read "vee six
     * LITRES two tee five" and `L4W 5M1` "el four WATTS five em one", the two spellings the TypeScript
     * comment names verbatim as already fixed.
     *
     * ⚠ THE COVER IS `EnglishCodeSlotUnitTests`, NOT A GOLDEN ROW, and the difference is worth stating
     * because the obvious fix is the wrong one. The goldens are GENERATED (`tools/gen_parity_goldens.mts`);
     * a hand-added row survives `check:goldens`, which only asks whether the recorded IPA is still what
     * the engine says, and is then silently dropped the next time the generator runs for `en`. That is
     * the write-once drift the generator's own comments warn about, and it would leave a gate that looks
     * present and is not. The real asymmetry was narrower anyway: the TypeScript half of this block has
     * had a test since the guards landed and the C# mirror was simply never written.
     */
    private static readonly JsRe UNIT_RE = JsRegex.Compile(
        NOT_VERSION + "(\\d[\\d,]*(?:\\.\\d+)?)(\\s+(?:hundred|thousand|million|billion|trillion))?\\s?"
        // A token-initial letter, ONE digit, then a one-letter unit: that is a code slot, not a unit.
        + "(?!(?<=(?<![\\p{L}\\d])\\p{L}\\d)\\p{L}(?!\\p{L}))("
        + string.Join("|", UNITS.Keys.OrderByDescending(k => k.Length)) + ")([²³23])?(?![\\p{L}\\p{M}])"
        // A one-letter unit FOLLOWED by a digit is likewise a code slot — the `0L1` half of `A1A 0L1`.
        + "(?!(?<=(?<!\\p{L})\\p{L})\\d)",
        "giu");

    /**
     * Is this ASCII `2`/`3` a CODE'S DIGIT rather than an exponent? The mirror of the TypeScript's
     * `asciiExponentIsCodeDigit`, which carries the reasoning.
     *
     * ⚠ WITHOUT IT THE EXPONENT SWALLOWS THE CODE'S LAST DIGIT, so the trailing-digit guard above never
     * sees it and the match ends at the token boundary quite legitimately: `A1A 0L2` read "zero SQUARE
     * LITRES". A square litre is not a thing that could be meant — the litre is already a volume — so a
     * length is the only unit an exponent says anything about, and ⟨m⟩ is the only one-letter ASCII
     * length. The superscripts are NOT restricted: nobody writes a code with a ².
     */
    private static bool AsciiExponentIsCodeDigit(string unit, string? exponent)
    {
        if (exponent != "2" && exponent != "3") return false; // ²/³ can never be a code's digit
        return unit.Length == 1 && char.IsAsciiLetter(unit[0]) && !unit.Equals("m", StringComparison.OrdinalIgnoreCase);
    }

    /**
     * Is this ASCII `2`/`3` the NEXT PART OF A COMPOUND MEASURE rather than an exponent? (#1434, #1435)
     * Ported from src/languages/english/normalize.ts — see that file for the measurements.
     *
     * ⚠ THIS CASE CORRUPTS RATHER THAN DROPS. A latitude is written unspaced — `40°26′46″N` — so the
     * minutes digit sits exactly where an exponent would: `40°26` read "40 SQUARE DEGREES6", the wrong
     * unit AND a digit silently eaten. The spaced form was always fine; the unspaced one is usual.
     *
     * ⚠ AND IT MUST NOT DECLINE THE WHOLE MATCH, which the code-slot rule above does. Declining leaves
     * the raw ⟨°⟩ to reach the g2p, where it is DROPPED — trading a corruption for a silent loss. The
     * unit is expanded and the digit handed back instead.
     */
    private static bool AsciiExponentIsCompoundPart(string unit, string? exponent) =>
        (exponent == "2" || exponent == "3") && COMPOUND_MEASURE.Contains(unit);

    /**
     * The symbols that take a FOLLOWING NUMBER in a compound measurement, so an ASCII `2`/`3` after
     * them is that number and not a power: degrees-minutes-seconds and feet-inches.
     *
     * ⚠ ⟨′⟩ AND ⟨″⟩ JOINED THIS LIST THE MOMENT THEY BECAME UNITS — `6′2″` read "6 SQUARE FEET"
     * with the inches stranded. The same defect #1434 fixed for ⟨°⟩, one symbol over.
     */
    private static readonly HashSet<string> COMPOUND_MEASURE =
        new(new[] { "°", "′", "″" }, StringComparer.Ordinal);

    /** The SLASHED unit keys only, for the bare-rate arm — a slash inside a token can never be a word,
     *  so these need no number in front of them. See the TS for the URL guard. */
    private static readonly JsRe BARE_RATE_RE = JsRegex.Compile(
        "(?<![\\p{L}\\d])(" + string.Join("|", UNITS.Keys.Where(k => k.Contains('/'))
            .OrderByDescending(k => k.Length)) + ")(?![\\p{L}\\d])",
        "giu");

    /**
     * THE MICRO-PREFIXED unit keys, for the bare arm — a unit standing with NO number in front of it.
     *
     * ⚠ SAME ARGUMENT AS THE SLASHED KEYS ABOVE, AND THE SAME REPORTED SHAPE. `BARE_RATE_RE` exists
     * because a rate arrived as a COLUMN HEADER, where a slash inside a token can never be a word; a
     * MICRO SIGN glued to letters can never be one either. `µin` was reported in exactly that bare
     * form and read as the preposition *in*, with the sign dropped. See the TypeScript.
     *
     * ⚠ AND IT REQUIRES THE LETTERS: a LONE mu is the Greek letter and must stay one.
     *
     * ⚠ THE SLASH IS EXCLUDED ON BOTH SIDES, and leaving it out was a REGRESSION: this arm runs before
     * the rate arm, so it claimed the NUMERATOR of every micro rate whose full key the table does not
     * enumerate and stripped the plural — `µg/kg` read "microgram per kilogram" for "micrograms per
     * kilogram". The lookBEHIND carries it too, for the URL path segment (`…/µm/…`).
     *
     * ⚠ `i`, LIKE THE SLASHED ARM ABOVE. Case-sensitivity is `ResolveUnitSymbol`'s job, not the
     * pattern's — it consults the declared table with the EXACT written form before folding, so ⟨µM⟩
     * stays micromolar and ⟨µm⟩ a micro metre either way. Without the flag ⟨µL⟩, the DOMINANT
     * printed spelling of the microlitre, never matched at all and put a raw µ into the g2p.
     */
    private static readonly JsRe BARE_MICRO_RE = JsRegex.Compile(
        "(?<![\\p{L}\\d/])(" + string.Join("|", UNITS.Keys
            .Where(k => k.Length > 1 && (k[0] == '\u00b5' || k[0] == '\u03bc'))
            .OrderByDescending(k => k.Length)) + ")(?![\\p{L}\\d/])",
        "giu");

    /** The Unicode relational operators. The ASCII `<`/`>` are NOT here — they keep a digit gate above
     *  because they can be markup and these cannot. */
    private static readonly (string Sign, string Words)[] RELATIONAL =
    [
        ("\u2265", "greater than or equal to"),
        ("\u2264", "less than or equal to"),
        ("\u2260", "not equal to"),
        ("\u00b1", "plus or minus"),
        ("\u2248", "approximately"),
    ];

    private static readonly JsRe[] RELATIONAL_RE =
        RELATIONAL.Select(r => JsRegex.Compile($"[ \\t]*{r.Sign}[ \\t]*", "gu")).ToArray();

    /** A dash between two numbers is a range. ⚠ TYPOGRAPHIC dashes only — the ASCII hyphen is already
     *  ISO dates, phone numbers and scores. See the TS. */
    /** `Rev.` is "revision" before a designator and "reverend" before a name. ⚠ NO "i" FLAG — with it
     *  the `[a-z]` in the lookahead matches uppercase and the test inverts. See the TS. */
    private static readonly JsRe REV_REVISION =
        JsRegex.Compile("\\b[Rr][Ee][Vv]\\.?\\s+(?=(?:[A-Z](?![a-z.])|\\d))", "gu");

    private static readonly JsRe NUMBER_RANGE = JsRegex.Compile("(\\d)[\\u2012\\u2013\\u2014](?=\\d)", "gu");

    /// <summary>
    /// An arrow between two numbers is a TRANSITION, and it was dropped outright — `16 → 28 h` read as
    /// "sixteen twenty-eight hours". The reading is the range rule's above ("to"), not a gloss of the
    /// glyph. Digit-gated on both sides, like × and ÷: between words an arrow's reading is contested,
    /// and a missing word beats a wrong one. Spaced, because an arrow between digits is written loose.
    /// </summary>
    private static readonly JsRe NUMBER_ARROW = JsRegex.Compile("(\\d)[ \\t]*\\u2192[ \\t]*(?=\\d)", "gu");

    /** A space-guarded dash of any kind is a parenthetical break; the spaces are what keep this off
     *  the word-joiner (`well-known`, `re-enter`). Two arms, claiming everything EXCEPT a dash with a
     *  digit on BOTH sides — that is a loose-written span (`1418 – 1450`), not a parenthesis, and it
     *  keeps its measured reading. See the TS for the whole argument. */
    private static readonly JsRe SPACED_DASH =
        JsRegex.Compile("(?<=[^\\s\\d])[ \\t\\u00a0]+[-\\u2010\\u2011\\u2012\\u2013\\u2014\\u2015]+[ \\t\\u00a0]+(?=\\S)", "gu");

    private static readonly JsRe SPACED_DASH_AFTER_NUMBER =
        JsRegex.Compile("(?<=\\d)[ \\t\\u00a0]+[-\\u2010\\u2011\\u2012\\u2013\\u2014\\u2015]+[ \\t\\u00a0]+(?=[^\\s\\d])", "gu");

    /** …and the unspaced EM dash, which is the same break in the other house style. The em dash only:
     *  an unspaced en dash is a joiner (`Bose–Einstein`) and between digits it is already a span. */
    private static readonly JsRe EM_DASH_BREAK = JsRegex.Compile("(?<=[^\\s\\d])\\u2014+(?=[^\\s\\d])", "gu");

    private static readonly JsRe TY_YEAR = JsRegex.Compile("\\bTY\\s?(\\d{4})\\b", "gu");

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
        ["etc"] = "etc", ["ibid"] = "ibid", ["cf"] = "compare", ["viz"] = "namely",
    };
    private static readonly string PLAIN_ABBREV_ALT = string.Join("|", PLAIN_ABBREV.Keys.OrderByDescending(k => k.Length));

    /** The keys above that may be expanded WITHOUT their dot — a key qualifies only if its bare form is
     *  not an English word. ⚠ No two-letter key but `vs`: `jr`/`sr` cost `SR&O series` → "senior and O
     *  series". See the TypeScript. */
    private static readonly string BARE_ABBREV_ALT = string.Join("|",
        new[] { "vs", "approx", "dept", "univ", "blvd" }.OrderByDescending(k => k.Length));
    private static readonly JsRe BARE_ABBREV_RE =
        JsRegex.Compile($"(?<![\\p{{L}}\\p{{M}}.])({BARE_ABBREV_ALT})(?![\\p{{L}}\\p{{M}}.])", "giu");

    /** A section number's dot is "point" — `Section G.2`. A single letter only; versions are guarded
     *  elsewhere. See the TypeScript. */
    private static readonly JsRe SECTION_POINT = JsRegex.Compile("(?<![\\p{L}\\p{M}.])(\\p{L})\\.(?=\\d)", "gu");

    /** The words the unit table expands to, single-word forms only — what tells a slash it is a RATE.
     *  See the TypeScript. */
    private static readonly IReadOnlySet<string> UNIT_WORDS =
        new HashSet<string>(UNITS.Values.SelectMany(v => new[] { v[0], v[1] }).Where(w => !w.Contains(' ')),
                            StringComparer.Ordinal);

    /** Periods of time as a denominator: a slash before one is a rate whatever the numerator is. The
     *  abbreviations map to the word because the unit rules key on a preceding number and there is none
     *  after a slash — `hr` stayed `hr` and read as *aitch ar*. */
    private static readonly IReadOnlyDictionary<string, string> TIME_PERIOD = new Dictionary<string, string>
    {
        ["s"] = "second", ["sec"] = "second", ["secs"] = "seconds", ["second"] = "second",
        ["seconds"] = "seconds", ["min"] = "minute", ["mins"] = "minutes", ["minute"] = "minute",
        ["minutes"] = "minutes", ["h"] = "hour", ["hr"] = "hour", ["hrs"] = "hours", ["hour"] = "hour",
        ["hours"] = "hours", ["d"] = "day", ["day"] = "day", ["days"] = "days", ["wk"] = "week",
        ["wks"] = "weeks", ["week"] = "week", ["weeks"] = "weeks", ["mo"] = "month", ["month"] = "month",
        ["months"] = "months", ["yr"] = "year", ["yrs"] = "years", ["year"] = "year", ["years"] = "years",
        ["annum"] = "annum", ["capita"] = "capita",
    };

    /** Pairs read without the mark — `and/or` is said "and or". */
    private static readonly IReadOnlySet<string> SLASH_ELIDED = new HashSet<string>(
        new[] { "and/or", "he/she", "she/he", "his/her", "her/his", "s/he", "either/or" }, StringComparer.Ordinal);

    /**
     * Slashed abbreviations with a fixed reading — a WHOLE UNIT, where neither the rate reading nor the
     * conjunction reading is right. ⚠ The bar for a row is a SINGLE DOMINANT reading, because the failure
     * mode of guessing is a wrong word inserted into prose; `a/c`, `b/w`, `s/n`, `p/e`, `o/s` have two
     * live readings each and deliberately fall through to the single-letter guard, which leaves the mark
     * silent and reads the letters. See the TypeScript.
     */
    private static readonly IReadOnlyDictionary<string, string> SLASH_ABBREV = new Dictionary<string, string>
    {
        ["w/o"] = "without", ["c/o"] = "care of", ["n/a"] = "not applicable",
        ["w/out"] = "without",
        ["a/d"] = "analog to digital", ["d/a"] = "digital to analog", ["y/n"] = "yes no",
        // ⚠ `r/w` is the one row that does not fully meet the bar: read/write is dominant and is the
        // reading asked for, but RIGHT-OF-WAY is live in civil and property text. See the TypeScript.
        ["r/w"] = "read write",
    };

    /** ⚠ `w/` has no right-hand side, so the pair rule cannot see it and the token reached the g2p as a
     *  dangling letter. Gated on nothing following the slash, so `w/o` stays with the pair rule. */
    /** ⚠ A leading slash is a PATH, not the abbreviation — `the /w/ path` read "the /with path". */
    private static readonly JsRe W_WITH =
        JsRegex.Compile("(?<![\\p{L}\\p{M}\\d/])w\\/(?![\\p{L}\\d])", "giu");

    /** The compositional slash — a rate, a fixed abbreviation, or (between two ALL-CAPS labels) the mark
     *  said aloud. See the TypeScript for why prose keeps it silent. */
    private static readonly JsRe SLASH_PAIR = JsRegex.Compile(
        "(?<![\\p{L}\\d/])(\\p{L}[\\p{L}\u00b2\u00b3]*)[ \\t]*/[ \\t]*(\\p{L}[\\p{L}\u00b2\u00b3]*)(?![\\p{L}\\d/])",
        "giu");  // superscript two, superscript three
    private static readonly JsRe SLASH_WS = JsRegex.Compile("[ \\t]", "gu");

    /**
     * Canadian provinces and territories, and US states, as the two-letter codes an address writes.
     * ⚠ Half of these are ordinary English words (IN, ON, OR, OK, HI, ME, MA, DE, LA, PA, CA…), so the
     * table is worthless without the gate in ADDRESS_CODE. See the TypeScript.
     */
    private static readonly IReadOnlyDictionary<string, string> REGION_CODE = new Dictionary<string, string>
    {
        ["ab"] = "Alberta", ["bc"] = "British Columbia", ["mb"] = "Manitoba", ["nb"] = "New Brunswick",
        ["nl"] = "Newfoundland and Labrador", ["ns"] = "Nova Scotia", ["nt"] = "Northwest Territories",
        ["nu"] = "Nunavut", ["on"] = "Ontario", ["pe"] = "Prince Edward Island", ["qc"] = "Quebec",
        ["sk"] = "Saskatchewan", ["yt"] = "Yukon",
        ["al"] = "Alabama", ["ak"] = "Alaska", ["az"] = "Arizona", ["ar"] = "Arkansas",
        ["ca"] = "California", ["co"] = "Colorado", ["ct"] = "Connecticut", ["de"] = "Delaware",
        ["fl"] = "Florida", ["ga"] = "Georgia", ["hi"] = "Hawaii", ["ia"] = "Iowa", ["id"] = "Idaho",
        ["il"] = "Illinois", ["in"] = "Indiana", ["ks"] = "Kansas", ["ky"] = "Kentucky",
        ["la"] = "Louisiana", ["ma"] = "Massachusetts", ["md"] = "Maryland", ["me"] = "Maine",
        ["mi"] = "Michigan", ["mn"] = "Minnesota", ["mo"] = "Missouri", ["ms"] = "Mississippi",
        ["mt"] = "Montana", ["nc"] = "North Carolina", ["nd"] = "North Dakota", ["ne"] = "Nebraska",
        ["nh"] = "New Hampshire", ["nj"] = "New Jersey", ["nm"] = "New Mexico", ["nv"] = "Nevada",
        ["ny"] = "New York", ["oh"] = "Ohio", ["ok"] = "Oklahoma", ["or"] = "Oregon",
        ["pa"] = "Pennsylvania", ["ri"] = "Rhode Island", ["sc"] = "South Carolina",
        ["sd"] = "South Dakota", ["tn"] = "Tennessee", ["tx"] = "Texas", ["ut"] = "Utah",
        ["va"] = "Virginia", ["vt"] = "Vermont", ["wa"] = "Washington", ["wi"] = "Wisconsin",
        ["wv"] = "West Virginia", ["wy"] = "Wyoming", ["dc"] = "District of Columbia",
    };

    private const string POSTCODE =
        "(?:[A-Z]\\d[A-Z][ \u00a0]?\\d[A-Z]\\d|\\d{5}(?:-\\d{4})?)(?![\\w-])";  // NBSP

    /** ⚠ The three codes that are also POST-NOMINAL CREDENTIALS. `Smith, MD` is a doctor and
     *  `Baltimore, MD` an address, and nothing in the shape tells them apart — so these need a
     *  postcode after them, which a credential never has. See the TypeScript. */
    private static readonly IReadOnlySet<string> CREDENTIAL_CODE =
        new HashSet<string>(new[] { "MD", "PA", "DC" }, StringComparer.Ordinal);

    /** The shape that licenses the table, all three parts load-bearing: a CAPITALISED WORD, a comma,
     *  the code IN CAPITALS, then a postcode or the end of the phrase. The capitalised word is what
     *  separates a city from a clause — `Portland, OR, is closed` against `he lives in, or near,
     *  Boston`. See the TypeScript. */
    private static readonly JsRe ADDRESS_CODE = JsRegex.Compile(
        "(?<=\\p{Lu}\\p{L}*)(,[ \u00a0]*)("
        + string.Join("|", REGION_CODE.Keys.Select(k => k.ToUpperInvariant())) + ")"
        + "(?=[ \u00a0]*" + POSTCODE
        + "|[ \u00a0]*(?:[.,;:!?\\n]|$))",  // NBSP throughout
        "gu");

    private static readonly JsRe FOLLOWED_BY_POSTCODE =
        JsRegex.Compile("^[ \u00a0]*" + POSTCODE, "u");  // NBSP

    /** ⚠ A US ZIP is a DIGIT STRING, not a quantity — once the state is a name the five digits after
     *  it reach the number rules and are read as one. Scoped to a ZIP directly after a state name this
     *  pass just produced. See the TypeScript. */
    private static readonly JsRe ADDRESS_ZIP = JsRegex.Compile(
        "(?<=\\b(?:" + string.Join("|", REGION_CODE.Values.Distinct().OrderByDescending(v => v.Length))
        + ")[ \u00a0])(\\d{5})(-(\\d{4}))?(?![\\w-])",  // NBSP
        "gu");

    /** `Re:` is "regarding", not the note of the scale. The colon is consumed for the reason every
     *  abbreviation dot is: left in place it becomes a phrase break. */
    private static readonly JsRe RE_REGARDING = JsRegex.Compile("(?<![\\p{L}\\p{M}])[Rr][Ee]:[ \\t]*", "gu");

    /**
     * A HYPHENATED `re-` IS THE PREFIX, NOT THE NOTE — the same collision as `RE_REGARDING` above,
     * reached through a hyphen instead of a colon. The hyphen makes `re` a token of its own and CMUdict
     * records the bare word as `R EY1`, so `re-machined` read *RAY-machined*. See the TypeScript.
     *
     * ⚠ THE NOTE IS PROTECTED LEXICALLY, NOT POSITIONALLY. Refusing any preceding HYPHEN keeps
     * `do-re-mi` as the note but also suppresses the fix wherever `re-` legitimately follows one —
     * `non-re-entrant` and `pre-re-heat` kept reading *ray*. Asking whether the PRECEDING
     * hyphen-segment is a solfège syllable keeps the note and releases both. It is the PRECEDING
     * segment and not the following one because `re-do` is an ordinary prefixed word whose second
     * element is a solfège syllable.
     * ⚠ KNOWN COST: a sequence that OPENS on the note (`re-mi-fa-sol`) and the rhenium–osmium pair
     * `Re-Os` still read *ree*. Both are far rarer than the prefix and neither is separable by shape.
     * ⚠ AND THE REPLACEMENT ECHOES THE MATCHED CASE, which is not cosmetic — the initialism pass
     * decides whether a document is SHOUTING by looking for any lowercase letter, so a lowercase `ree`
     * in an all-caps document changes how every OTHER run in it is read.
     */
    private static readonly JsRe RE_PREFIX = JsRegex.Compile(
        "(?<![\\p{L}\\p{M}\\d])(?<!\\b(?:do|re|mi|fa|sol|la|ti|si|ut)-)([Rr])([Ee])(?=-\\p{L})", "giu");

    /**
     * AN ENUMERATED LIST LEAD-IN — `(a) the first item`, `b) the second` (#1423).
     * Ported from src/languages/english/normalize.ts — see that file for the measurements.
     *
     * ⚠ THE LETTER WAS READ AS THE INDEFINITE ARTICLE, and ⟨a⟩ is the ONLY letter of 26 it happens
     * to: the other 25 already give their letter name, because CMUdict carries them with letter-NAME
     * pronunciations and records `a` as the reduced article AH0. A CLAIMING problem, not a naming one.
     *
     * ⚠ A PAUSE IS PART OF THE REPORT, and the comma is this file's existing spelling for one.
     */
    private static readonly JsRe LIST_MARKER =
        JsRegex.Compile("(?<=^|\\n)([ \\t]*)[([]?([A-Za-z]|\\d{1,2})[)\\]](?=[ \\t]+\\S)", "gu");

    /** A LONE LETTER INSIDE BRACKETS — a REFERENCE to a list item, so the letter name but NO pause. */
    private static readonly JsRe BRACKETED_LETTER =
        JsRegex.Compile("(?<=[([{])([A-Za-z])(?=[)\\]}])", "gu");

    /**
     * A MARKER LETTER AS THE PASS WOULD SAY IT, WITHOUT DESTROYING ITS CASE (#1423).
     *
     * ⚠ `LetterName(l.ToLowerInvariant())` IS NOT A NO-OP for the other 24 letters — it returns the
     * LOWERCASED input, so a rule written that way silently lowercases a capital, and the initialism
     * pass decides SHOUTING by looking for any lowercase letter. One injected lowercase flipped the
     * verdict for a whole document: `SEE (B) OF US ARMY` spelled out `US`. See the TypeScript.
     */
    private static string SayLetter(string l) =>
        Manifest.MANIFEST.LetterNameExceptions.TryGetValue(l.ToLowerInvariant(), out var name)
            ? (l == l.ToUpperInvariant() ? name.ToUpperInvariant() : name)
            : l;

    /** Digits only, for telling a numbered marker from a lettered one. */
    private static readonly JsRe ALL_DIGITS = JsRegex.Compile("^[0-9]+$", "u");

    /**
     * A DEGREES-MINUTES-SECONDS COORDINATE — `40°26′46″N` (#1435).
     * Ported from src/languages/english/normalize.ts — see that file for the reasoning.
     *
     * ⚠ IT EXISTS TO REMOVE AN AMBIGUITY, NOT ONLY TO READ A COORDINATE. ⟨′⟩ and ⟨″⟩ are feet and
     * inches in ordinary prose and ARCMINUTES and ARCSECONDS after a degree sign. Consuming the
     * coordinate FIRST leaves every surviving prime unambiguously a foot or an inch, which is what
     * lets them be plain UNITS keys.
     *
     * ⚠ THE HEMISPHERE LETTER ENDS ON `(?![\p{L}\p{M}])`, NOT `\b` — JS defines `\b` on ASCII `\w`,
     * so `40°26′Nörd` read "…minutes northörd", the defect class of #949.
     *
     * ⚠ MINUTES ARE REQUIRED, so this claims nothing the unit rule already handles: a bare `5°` or
     * `5°C` is left to it. Seconds and the hemisphere letter are optional.
     */
    private static readonly JsRe DMS_COORDINATE = JsRegex.Compile(
        // ⚠ BOTH QUOTE STYLES (#1449): once FEET_INCHES_ASCII existed, this rule was the only thing between
        // it and `40°26'46"N` — the ASCII compound claimed `26'46"` and read "26 FEET 46 INCHES". The `°`
        // is what makes the ASCII form safe here. See the TypeScript twin.
        // ⚠ `(?!s)` — the `°` guards against QUOTATION but not against `N's`: `turn 90° 5's worth` read
        // "90 degrees 5 minutes s worth". ⚠ And `''` is a third spelling of the seconds mark, or the rule
        // matched the minutes and GLUED the leftover: "26 minutes46''N". See the TS twin.
        "(\\d+(?:\\.\\d+)?)°[ \\t\\u00a0]?(\\d+(?:\\.\\d+)?)[′'](?!s)(?:[ \\t\\u00a0]?(\\d+(?:\\.\\d+)?)(?:[″\"]|''))?"
        + "(?:[ \\t\\u00a0]?((?:[NS][EW]|[NSEW]))(?![\\p{L}\\p{M}]))?",   // space, tab, NBSP
        "gu");

    /** The hemisphere letters, spoken. */
    private static readonly IReadOnlyDictionary<string, string> HEMISPHERE =
        new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["N"] = "north", ["S"] = "south", ["E"] = "east", ["W"] = "west",
            ["NE"] = "northeast", ["NW"] = "northwest", ["SE"] = "southeast", ["SW"] = "southwest",
        };

    /** Is this number exactly one? ⚠ THE SAME NUMERIC TEST THE UNIT RULE USES, not a string compare. */
    private static readonly JsRe DMS_ONE = JsRegex.Compile("^0*1(?:\\.0+)?$", "u");

    /** `n` of `unit`, with count agreement — "1 degree", "40 degrees". */
    private static string Counted(string n, string sg, string pl) =>
        $"{n} {(DMS_ONE.IsMatch(JsRegex.Replace(n, COMMAS, "")) ? sg : pl)}";

    /**
     * FEET AND INCHES WRITTEN TIGHT — `6′2″`, the commonest spelling of a height (#1435).
     * ⚠ Consumed WHOLE for the same reason the coordinate is: the unit rule's exponent group would
     * otherwise eat the inches digit. Runs AFTER the DMS rule. See the TypeScript.
     */
    /** A letter immediately after a DMS match, which would otherwise fuse into the last word. */
    private static readonly JsRe DMS_TRAILING_LETTER = JsRegex.Compile("^[\\p{L}\\p{M}]", "u");

    /** ⚠ BOTH QUOTE STYLES, INDEPENDENTLY PER POSITION (#1449): an editor's smart quotes convert one mark
     *  and not the other, and two same-style rules stranded the other — `6'` surviving as a bare
     *  apostrophe is the louder half. The PAIR is what makes the ASCII form safe. See the TS twin. */
    private static readonly JsRe FEET_INCHES =
        JsRegex.Compile("(\\d+(?:\\.\\d+)?)[′'][ \\t\\u00a0]?(\\d+(?:\\.\\d+)?)(?:[″\"]|'')", "gu");  // space, tab, NBSP

    /** A DECIMAL followed by an ASCII double quote — `0.015"`. ⚠ THE DECIMAL POINT IS THE GUARD: all six
     *  closing quotes in the corpus end an INTEGER. A bare integer + `"` is refused, which costs
     *  `a 2" pipe` — taken at six counterexamples to zero. See the TypeScript twin. */
    private static readonly JsRe INCH_DECIMAL_ASCII = JsRegex.Compile("(\\d+\\.\\d+)\"(?!\\p{L})", "gu");

    /**
     * IS EVERY `"` IN THIS TEXT AN INCH MARK? True only when each is immediately preceded by a decimal.
     *
     * ⚠ THE DECIMAL POINT ALONE IS NOT A GUARD, and the measurement that said it was came from a corpus
     * that could not contain the counterexamples: FLEURS en_us is read NEWS SPEECH, with essentially no
     * version numbers, prices, scores or markup. Unguarded, `he called it "Web 2.0"` read `"Web 2.0
     * inches` — a wrong unit AND an orphaned opening quote.
     * ⚠ A BALANCE TEST DOES NOT WORK: an inch mark IS an unpaired quote, so counting left to right makes
     * the SECOND measurement in `a 0.015" and a 0.020" shim` look like it sits inside a quotation.
     * ⚠ ALL-OR-NOTHING, and computed on the STRING so both ports run identical logic — .NET's
     * MatchEvaluator does not expose the input, which is what ruled out doing it inside the match.
     */
    private static bool EveryQuoteIsAnInch(string t)
    {
        var any = false;
        for (var i = 0; i < t.Length; i++)
        {
            if (t[i] != '"') continue;
            any = true;
            if (!DECIMAL_BEFORE_QUOTE.IsMatch(t[..i])) return false;
        }
        return any;
    }

    private static readonly JsRe DECIMAL_BEFORE_QUOTE = JsRegex.Compile("\\d\\.\\d+$", "u");

    /** A month range is a date frame the digit gate cannot see — `Oct-Dec 2024`. See the TypeScript. */
    private static readonly JsRe MONTH_RANGE = JsRegex.Compile(
        // space, tab, NBSP; hyphen through horizontal bar (U+2010-U+2015)
        $"\\b({MONTH_ABBREV_ALT}|{MONTH_ALT})\\b\\.?[ \\t ]*([-‐-―])[ \\t ]*"
        + $"({MONTH_ABBREV_ALT}|{MONTH_ALT})\\b\\.?", "giu");

    /**
     * CONCATENATED ELEMENT-SYMBOL FORMULAE with a fixed reading — `CoCr` is "cobalt chromium", not the
     * word *cocker*. Ported from src/languages/english/normalize.ts — see that file for the reasoning.
     *
     * ⚠ A LIST, NOT A FORMULA PARSER. A rule that tiled any token into element symbols was built and
     * thrown away: it reads `CoCo` as "cobalt cobalt", and only an ad-hoc "a repeated two-letter symbol
     * is a name" guard stopped it — a heuristic standing in for chemistry knowledge this engine does
     * not have. Listing the tokens actually read wrong claims only what is true.
     *
     * ⚠ THE LOOKUP IS CASE-SENSITIVE (Ordinal, and no `i` flag on the regex): an element symbol is
     * `[A-Z]` or `[A-Z][a-z]`, and case alone separates a formula from the recorded word it spells —
     * `sic`, `tin` and `nan` are all real dictionary entries.
     */
    private static readonly IReadOnlyDictionary<string, string> FORMULA_READING =
        new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["CoCr"] = "cobalt chromium",
            ["CoCrMo"] = "cobalt chromium molybdenum",
            // ⚠ THE HYPHENATED SPELLINGS OF A LISTED ALLOY BELONG WITH IT, or the row HALF-EXPANDS:
            // the boundary deliberately does not exclude ⟨-⟩ (so `CoCr-based` reads "cobalt
            // chromium-based", which is right), and without these `CoCr-Mo` matched `CoCr` and
            // stranded a bare ⟨Mo⟩.
            ["CoCr-Mo"] = "cobalt chromium molybdenum",
            ["Co-Cr-Mo"] = "cobalt chromium molybdenum",
            ["Co-Cr"] = "cobalt chromium",
        };

    /**
     * ⚠ No `i` flag — the capitalisation IS the signal. Longest-first so `CoCrMo` is not claimed as
     * `CoCr` plus a stranded tail.
     *
     * ⚠ AND A FOLLOWING HYPHENATED CAPITAL REFUSES THE WHOLE MATCH, which is where a LIST has to stop
     * honestly. `Co-Cr-Mo-W` is a real alloy that is not listed; without this it matched the listed
     * `Co-Cr-Mo` and read "cobalt chromium molybdenum-W", stranding a bare ⟨W⟩ — a half-expansion,
     * the worst outcome, because it sounds finished. A lowercase tail must still pass: `CoCr-based`
     * is "cobalt chromium-based".
     */
    private static readonly JsRe FORMULA_TOKEN = JsRegex.Compile(
        "(?<![\\p{L}" + Core.Initialisms.LATIN_MARK + "\\d])("
        + string.Join("|", FORMULA_READING.Keys.OrderByDescending(k => k.Length))
        + ")(?![\\p{L}" + Core.Initialisms.LATIN_MARK + "\\d])(?!-\\p{Lu})", "gu");

    /**
     * ALPHANUMERIC MATERIAL DESIGNATIONS — a grade or alloy name that is not an element-symbol formula (#1458).
     *
     * ⚠ THE `L` OF `316L` RESOLVED AS LITRES — a WRONG UNIT, not a missing word. It is #1421's leak
     * (`V6L 2T5` → "vee six LITRES two") reached from the other side: that guard needs a TOKEN-INITIAL
     * LETTER then one digit, and `316L` has no leading letter.
     * ⚠ AND NO SHAPE-BASED RULE SEPARATES IT FROM `a 5L jug` → "5 liters", which is correct and pinned.
     * The discriminator is which numbers name a grade — knowledge a list carries and a regex cannot.
     * ⚠ THE SPOKEN FORM, NOT A GLOSS (the user's call): "three sixteen L", never "…austenitic stainless
     * steel". `Ti64` is the same principle from the other side. See the TS twin.
     * ⚠ ROWS ON REPORT, NOT BY ENUMERATION: `304L`, `321`, `410`, `17-4PH` all misread today and are
     * deliberately absent.
     */
    private static readonly IReadOnlyDictionary<string, string> DESIGNATION_READING =
        new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["316L"] = "three sixteen L",
            ["Ti64"] = "titanium sixty-four",
        };

    /** ⚠ NO `i` FLAG — the capitalisation IS the signal, as in FORMULA_TOKEN. Longest-first so a future
     *  row that prefixes another cannot claim it and strand the tail.
     *  ⚠ IT DELIBERATELY DROPS FORMULA_TOKEN's `(?!-\p{Lu})` TAIL — the one place the two differ. With the
     *  tail, `316L-Grade` is left unclaimed and falls through to the unit pass as "316 LITERS-Grade", the
     *  wrong-unit outcome this rule exists to prevent. The accepted cost is `Ti64-Al` → "titanium
     *  sixty-four-Al". See the TS twin for the full reasoning. */
    private static readonly JsRe DESIGNATION_TOKEN = JsRegex.Compile(
        "(?<![\\p{L}" + Core.Initialisms.LATIN_MARK + "\\d])("
        + string.Join("|", DESIGNATION_READING.Keys.OrderByDescending(k => k.Length))
        + ")(?![\\p{L}" + Core.Initialisms.LATIN_MARK + "\\d])", "gu");

    /**
     * MIXED-CASE ABBREVIATIONS — expanded, claimed on EXACT CASE ONLY (#1460).
     *
     * ⚠ `DoE` READ "doe", and it reaches no initialism rule at all: that pass claims ALL-CAPS runs, so a
     * mixed-case token is never a candidate. Measured, forcing the pass's dictionary gate BOTH ways leaves
     * `DoE matrix` unchanged either time — unlike `CT` (#1459), which the gate DECLINES.
     * ⚠ AND `PLAIN_ABBREV` CANNOT HOLD IT: that table needs a DOT and is matched case-INSENSITIVELY. The
     * CASING IS THE WHOLE GUARD — `doe` is a noun, `DOE` is the Department of Energy.
     * ⚠ ONE ROW, AND `PoC` IS WHY: it has TWO common expansions, so enumerating this shape is unsafe.
     * See the TS twin.
     */
    private static readonly IReadOnlyDictionary<string, string> MIXED_CASE_ABBREV =
        new Dictionary<string, string>(StringComparer.Ordinal) { ["DoE"] = "design of experiments" };

    /** ⚠ NO `i` FLAG — the mixed casing is the only thing separating it from the noun and the agency. */
    private static readonly JsRe MIXED_CASE_TOKEN = JsRegex.Compile(
        "(?<![\\p{L}" + Core.Initialisms.LATIN_MARK + "\\d])("
        + string.Join("|", MIXED_CASE_ABBREV.Keys.OrderByDescending(k => k.Length))
        + ")(?![\\p{L}" + Core.Initialisms.LATIN_MARK + "\\d])", "gu");

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

    /** THE CALENDAR NAMES — the twelve months and the seven weekdays. A dash between two of them is a
     *  SPAN and is spoken "to"; `May–June 2025` read as "may june", with the span silently gone.
     *  ⚠ ⟨may⟩ is safe here though it is a modal verb: the licence is TWO calendar names joined by a
     *  dash, not the word. The ABBREVIATIONS are deliberately out — they are personal names too. */
    private const string WEEKDAYS = "monday|tuesday|wednesday|thursday|friday|saturday|sunday";
    private static readonly string CALENDAR_NAME = $"{MONTH_ALT}|{WEEKDAYS}";
    private static readonly JsRe CALENDAR_RANGE = JsRegex.Compile(  // space, tab, NBSP
        $"\\b({CALENDAR_NAME})[ \\t\\u00a0]*[-\\u2010\\u2011\\u2012\\u2013\\u2014\\u2015][ \\t\\u00a0]*({CALENDAR_NAME})\\b",
        "giu");

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
    // ⚠ CASE-SENSITIVE ON PURPOSE (no "i"): `IR` is the initialism, `Ir` the iridium symbol; `Max` is
    // a name. See the TS for the full reasoning.
    private static readonly JsRe IR_GLOSS = JsRegex.Compile("\\bIR\\b", "gu");
    private static readonly JsRe MAX_DOT = JsRegex.Compile("\\bmax\\.(\\s+)(?=[\\p{L}\\p{N}])", "gu");
    private static readonly JsRe MAX_BARE = JsRegex.Compile("\\bmax\\b(?!\\.?\\s+(?:\\w+\\s+)?out\\b)", "gu");
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
    private static readonly JsRe MONTH_ABBREV_BEFORE_NUM =
        JsRegex.Compile($"\\b({MONTH_ABBREV_ALT})\\b\\.?(?=[ \u00a0]+\\d)", "giu");  // space, NBSP
    private static readonly JsRe MONTH_ABBREV_AFTER_DAY =
        JsRegex.Compile($"(?<=\\b\\d{{1,2}}[ \u00a0])({MONTH_ABBREV_ALT})\\b\\.?", "giu");  // space, NBSP
    private static readonly JsRe WEEKDAY_ABBREV_RE = JsRegex.Compile(
        // space, NBSP
        $"\\b({WEEKDAY_ABBREV_ALT})\\b\\.?(?=,?[ \u00a0]+(?:\\d{{1,2}}[ \u00a0]+)?(?:{MONTH_ALT_NO_MAY})\\b)", "giu");
    private static readonly JsRe ERA = JsRegex.Compile("\\b(BCE|BC|CE|AD)\\b", "g");
    private static readonly JsRe SPACE_GROUP = JsRegex.Compile(
        $"(?<!(?:{MONTH_ALT})[ \u00a0\u202f\u2009])(?<![\\d.,])[1-9]\\d{{0,2}}(?:[ \u00a0\u202f\u2009]\\d{{3}})+(?![\\d])", "giu");
    private static readonly JsRe SPACE_GROUP_SEPS = JsRegex.Compile("[ \\u00a0\\u202f\\u2009]", "gu");  // space, NBSP, NNBSP, thin space

    /**
     * A LEADING-POINT DECIMAL GETS ITS ZERO — `.002` → `0.002` (#1437).
     * Ported from src/languages/english/normalize.ts — see that file for the measurements.
     *
     * ⚠ THE TOKEN WAS NEVER A NUMBER AT ALL, so every downstream rule declined it in turn and one
     * insertion fixes a cascade rather than a reading: `.5 kg` read "five KING", `.002 mm` "two m",
     * `.002` "two" — a value wrong by a factor of 500 and entirely fluent.
     *
     * ⚠ THE LOOKBEHIND CARRIES THE STRUCTURAL GUARD. A point preceded by a LETTER is an abbreviation
     * (`Fig.2`), by a MARK the same (a decomposed accent ends in a combining mark, not a letter), by a
     * DIGIT a version or an address (`v1.002`, `192.168.1.1`), and by another POINT an ellipsis. A
     * sentence-final period is followed by a space, which the digit lookahead excludes.
     *
     * ⚠ AND THE TWO CUE LOOKAROUNDS CARRY THE LEXICAL ONE. A firearm CALIBER and a batting AVERAGE
     * are integer labels written with a point, and no shape separates them from a decimal, so they are
     * named: a cue word after the digits (`.50 caliber`, `.45 ACP`, `.22 LR`), or `batting`/`hitting`
     * before the point. All of them read correctly before this rule existed and would have regressed.
     */
    private static readonly JsRe LEADING_DECIMAL_POINT = JsRegex.Compile(
        "(?<![\\d\\p{L}\\p{M}.])(?<!\\b(?:batting|hitting|slugging|averaging)[ \\t\\u00a0])"
        + "\\.(?=\\d)(?!\\d+[ \\t\\u00a0-]*(?:cal|calibre|caliber|acp|magnum|mag|special|spl|auto"
        + "|lr|win|winchester|rem|remington|luger|s&w)\\b)", "giu");
    private static readonly JsRe SCI_EXPONENT = JsRegex.Compile(
        "(?<=[×x·]\\s?)(10)\\s?(\\u207b?[\\u2070\\u00b9\\u00b2\\u00b3\\u2074-\\u2079]+|-\\d+)", "gu");
    private static readonly JsRe NEGATIVE = JsRegex.Compile("(^|[\\s(])[-−–](\\d)", "gu");
    private static readonly JsRe PLUS_MINUS = JsRegex.Compile("(^|[\\s(])±\\s?(\\d)", "gu");
    /** `HH:MM` and `HH:MM:SS` — the two clock shapes a timezone offset can hang off. */
    private const string TZ_CLOCK = "\\d{1,2}:[0-5]\\d";
    private const string TZ_CLOCK_SEC = TZ_CLOCK + ":[0-5]\\d";
    private const string TZ_SIGN = "([+\\-\u2212])";
    /** ⚠ TWO ARMS: a GLUED compact offset must show the seconds field, because `09:00-1200` is a RANGE with
     *  the same shape; a SPACED one needs none. See src/languages/english/normalize.ts. */
    private static readonly JsRe TZ_COMPACT_GLUED =
        JsRegex.Compile($"(?<={TZ_CLOCK_SEC})[ \u00a0]*{TZ_SIGN}(\\d{{2}})(\\d{{2}})\\b", "gu");  // space, NBSP
    private static readonly JsRe TZ_COMPACT_SPACED =
        JsRegex.Compile($"(?<={TZ_CLOCK})[ \u00a0]+{TZ_SIGN}(\\d{{2}})(\\d{{2}})\\b", "gu");  // space, NBSP
    private static readonly JsRe TZ_COLON =
        JsRegex.Compile($"(?<={TZ_CLOCK_SEC})[ \u00a0]*{TZ_SIGN}(\\d{{2}}):(\\d{{2}})\\b", "gu");  // space, NBSP
    private static readonly JsRe TZ_ZULU = JsRegex.Compile($"(?<={TZ_CLOCK}(?::[0-5]\\d)?)Z\\b", "gu");
    private static readonly JsRe ISO_DATE =
        JsRegex.Compile("\\b(\\d{4})-(\\d{2})-(\\d{2})(?:T(?=\\d{1,2}:)|(?![\\p{L}\\d-]))", "gu");
    private static readonly JsRe US_DATE = JsRegex.Compile("\\b(\\d{1,2})\\/(\\d{1,2})\\/(\\d{4})\\b", "g");
    // ⚠ `(?![\\p{L}\\p{M}])`, NOT `\\b` — and the `u` flag is required for it. JS defines `\\b` on ASCII
    // `\\w`, so `$1.50é` read as money while `$1.50a` did not. See src/languages/english/normalize.ts.
    private static readonly JsRe MONEY_CENTS =
        // ⚠ The class excludes DIGITS (a third decimal is not cents) and the rule declines before a
        // magnitude word (`$5.50 million` is a decimal amount) — see src/languages/english/normalize.ts.
        JsRegex.Compile("([$£€¥])\\s?(\\d[\\d,]*)\\.(\\d{2})(?![\\p{L}\\p{M}\\d])"
            + "(?!\\s+(?:million|billion|trillion|thousand))", "gu");
    private static readonly JsRe PLUS_ATTACHED = JsRegex.Compile("(\\S)\\+\\s?(\\d)", "gu");
    private static readonly JsRe PLUS_LEADING = JsRegex.Compile("(^|\\s)\\+\\s?(\\d)", "gu");

    /** POSTFIX plus — both arms above require a digit on the RIGHT, so `C7+`, `18+`, `A+` and `C++`
     *  dropped the sign outright. The run is matched WHOLE: `C++` is two signs, and a per-sign rule
     *  reads the first and strands the second. See the TS. */
    private static readonly JsRe PLUS_POSTFIX =
        JsRegex.Compile("([\\p{L}\\d])(\\++)(?![ \\t\\u00a0]?\\d)", "gu");

    /** …and the sign between two NON-DIGIT operands (`a + b`, `the + sign`), which the infix arm's
     *  digit gate also misses. Horizontal space only, so a `+`-marked list keeps its bullets. */
    private static readonly JsRe PLUS_BETWEEN_WORDS =
        JsRegex.Compile("(?<=\\S)[ \\t\\u00a0]\\+[ \\t\\u00a0](?=\\S)", "gu");
    private static readonly JsRe FRACTION = JsRegex.Compile("\\b(\\d{1,3})\\/(\\d{1,3})\\b(?!\\s*[\\/\\d])", "gu");
    /** ⚠ `24/7` is an IDIOM, not a fraction — the rule above read it "twenty four sevenths". Claimed
     *  before it so the fraction rule never sees it. See the TypeScript. */
    private static readonly JsRe TWENTY_FOUR_SEVEN = JsRegex.Compile("(?<![\\d/])24\\/7(?![\\d/])", "gu");
    private static readonly JsRe CURRENCY_RE = JsRegex.Compile(
        "([$£€¥])\\s?(\\d[\\d,]*(?:\\.\\d+)?)(?:(\\s+(?:million|billion|trillion|thousand))|("
        + MONEY_MAG_ALT + ")(?![\\p{L}\\p{M}\\d]))?", "gu");
    private static readonly JsRe PERCENT = JsRegex.Compile("(\\d)\\s?%", "gu");
    private static readonly JsRe CLOCK = JsRegex.Compile("\\b(\\d{1,2}):([0-5]\\d)(?::([0-5]\\d))?\\b(\\s*[ap]m\\b)?", "gu");
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
    /** …spaced off from a following letter first — see the TS for why `I²C` fused into one token.
     *  ⚠ AND NOT WHEN A SPACE PRECEDES THE SUPERSCRIPT (#1045): a space-separated superscript glued to a
     *  word is that word's NUCLIDE (`0,708 ¹⁸⁰Hf`), and firing here would insert the space and hide the
     *  shape from the decline below, which tests for a letter IMMEDIATELY after. `10⁶km` still spaces. */
    private static readonly JsRe BARE_EXPONENT_GLUED = JsRegex.Compile(
        "(?:\\d[\\d.,]*|(?<![A-Za-z])[A-Za-z]{1,3})(?:\\u207b?[\\u2070\\u00b9\\u00b2\\u00b3\\u2074-\\u2079]+)(?=[\\p{L}\\p{M}])", "gu");
    /** ⚠ ENGLISH KEEPS ITS OWN COPY of the exponent pass, so the core's #1045 guards do not reach it — see
     *  the TS. The seconds prime (`110⁰04¹05¹¹`) and the nuclide (`0,708 ¹⁸⁰Hf`) are declined here too. */
    private static readonly JsRe EN_PRIME_CHAIN = JsRegex.Compile("\\d+⁰\\d+¹$", "u");
    private static readonly JsRe EN_ONLY_ONES = JsRegex.Compile("^¹+$", "u");
    private static readonly JsRe EN_NUCLIDE_FOLLOWS = JsRegex.Compile("^[\\p{L}\\p{M}]", "u");
    private static readonly JsRe EN_HAS_SPACE = JsRegex.Compile("\\s", "u");
    private static readonly JsRe LONE_SUPERSCRIPT_MARK = JsRegex.Compile("^[⁰¹]$", "u");
    private static readonly JsRe HAS_LOWER = JsRegex.Compile("[a-z]");
    private static readonly JsRe CAPS_ROMAN = JsRegex.Compile("\\b([A-Za-z][A-Za-z']*)\\s+([IVXLCDM]{2,})\\b", "g");
    private static readonly JsRe CAP_INITIAL = JsRegex.Compile("^[A-Z]");
    private static readonly JsRe LOWER_ROMAN = JsRegex.Compile(
        "\\b([a-z']+)\\s+(ii|iii|iv|vii|viii|ix|xii|xiii|xiv|xv|xvi|xvii|xviii|xix|xx)\\b", "gi");
    private static readonly JsRe AMP_INITIALISM =
        // ⚠ The entity folds case, the letter runs do not — an `i` flag would widen `[A-Z]` too.
        JsRegex.Compile("(?<![\\p{L}\\p{M}])([A-Z]{1,3})&(?:[aA][mM][pP];)?([A-Z]{1,3})(?![\\p{L}\\p{M}])", "gu");
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
    private static readonly JsRe ALL_ZEROS = JsRegex.Compile("^0+$");

    /** A timezone offset spoken as the displacement it is. */
    private static string OffsetWords(Match m)
    {
        var h = Js.Number(m.Groups[2].Value);
        var min = Js.Number(m.Groups[3].Value);
        if (h > 14 || min > 59) return m.Value; // outside the range any real offset lives in — not an offset
        if (h == 0 && min == 0) return " UTC";
        var word = m.Groups[1].Value == "+" ? "plus" : "minus";
        var hours = h == 0 ? "" : $" {Js.NumberToString(h)} {(h == 1 ? "hour" : "hours")}";
        var mins = min == 0 ? "" : $" {Js.NumberToString(min)} {(min == 1 ? "minute" : "minutes")}";
        return $" {word}{hours}{mins}";
    }

    /** Could this half be read as a word at all? A pair is an initialism when some half could not. */
    private static bool IsAmpInitialismHalf(string half) =>
        IsUnreadableEnglish(half.ToLowerInvariant()) || ACRONYM_LETTERS.Contains(half.ToLowerInvariant());

    /** A letter run as its LETTER NAMES, space-separated. */
    private static string SpellLetters(string run) =>
        string.Join(" ", Js.CodePoints(run.ToLowerInvariant()).Select(l => LetterName(l) ?? l));

    /** Normalize one English input string. Pure text→text; no IPA. */
    public static string NormalizeEnglish(string input)
    {
        var s = input;

        s = Rewrite(s, TITLE_ABBREV, m =>
        {
            var next = m.Groups[2].Value;
            if (!DOTTED_ABBREV.TryGetValue(m.Groups[1].Value.ToLowerInvariant(), out var f)) return m.Value;  // ⚠ reachable miss (#1122)
            return $"{f(next)} {next}";
        });
        s = Rewrite(s, TITLE_ABBREV_END, m => m.Groups[1].Value.ToLowerInvariant() switch
        {
            "st" => "street", "dr" => "drive", _ => "mount",
        });
        s = Rewrite(s, SAINT_UNDOTTED, m =>
        {
            var next = m.Groups[1].Value;
            return ABBREV_FUNCTION_NEXT.IsMatch(next) ? m.Value : $"saint {next}";
        });

        // ⚠ BEFORE the fixed-reading table below, which claims `Rev.` unconditionally.
        s = Rewrite(s, REV_REVISION, "revision ");

        s = Rewrite(s, PLAIN_MID, m =>
            // ⚠ THE MISS BRANCH IS REACHABLE (#1122) — the pattern is built from this table's own keys but
            // carries `i`+`u`, so JS's fold widens it and a near-miss matches while its key is absent.
            PLAIN_ABBREV.TryGetValue(m.Groups[1].Value.ToLowerInvariant(), out var w) ? $"{w}{m.Groups[2].Value}" : m.Value);
        // ⚠ Some of these are written without the dot far more often than with it — `vs` was reported
        // reading *vee ess*. Only the keys that are not words in their own right; see the TypeScript.
        s = Rewrite(s, BARE_ABBREV_RE, m =>
            PLAIN_ABBREV.TryGetValue(m.Groups[1].Value.ToLowerInvariant(), out var b) ? b : m.Value);
        s = Rewrite(s, PLAIN_END, m =>
            PLAIN_ABBREV.TryGetValue(m.Groups[1].Value.ToLowerInvariant(), out var w) ? $"{w}." : m.Value);
        s = Rewrite(s, TY_YEAR, "Tax Year $1");
        s = Rewrite(s, IR_GLOSS, "infrared");
        s = Rewrite(s, MAX_DOT, "maximum$1");
        s = Rewrite(s, MAX_BARE, "maximum");
        s = Rewrite(s, ET_AL_MID, "et al$1");
        s = Rewrite(s, ET_AL_END, "et al.");
        s = Rewrite(s, CIRCA, "circa ");
        s = Rewrite(s, NUMBER_SIGN, "number ");
        s = Rewrite(s, EG_MID, "for example$1");
        s = Rewrite(s, EG_END, "for example.");
        s = Rewrite(s, IE_MID, "that is$1");
        s = Rewrite(s, IE_END, "that is.");
        s = Rewrite(s, AM_PM, m => m.Groups[1].Value.ToLowerInvariant() == "a" ? "ay em" : "pee em");
        s = Rewrite(s, DOTTED_INITIALS, m => DOTS.Replace(m.Value, "").ToUpperInvariant());

        // ⚠ The weekday rule runs AFTER the two month rules — its gate reads the names they emit.
        s = Rewrite(s, RE_REGARDING, "regarding ");
        // A hyphenated `re-` is the prefix, not the note. See RE_PREFIX.
        s = Rewrite(s, RE_PREFIX, m =>
        {
            var e = m.Groups[2].Value;
            return m.Groups[1].Value + e + (e == e.ToUpperInvariant() ? "E" : "e");
        });
        // A province or state code in an address. See ADDRESS_CODE for why the gate is this narrow.
        var beforeCodes = s;
        s = Rewrite(s, ADDRESS_CODE, m =>
        {
            var code = m.Groups[2].Value;
            // ⚠ A credential needs the stronger gate — see CREDENTIAL_CODE.
            if (CREDENTIAL_CODE.Contains(code)
                && !FOLLOWED_BY_POSTCODE.IsMatch(beforeCodes[(m.Index + m.Length)..]))
                return m.Value;
            return m.Groups[1].Value + (REGION_CODE.TryGetValue(code.ToLowerInvariant(), out var name)
                ? name : code);
        });
        // ⚠ AFTER the rule above, because it keys on the state NAME that rule just produced.
        s = Rewrite(s, ADDRESS_ZIP, m =>
            string.Join(" ", m.Groups[1].Value.ToCharArray())
            + (m.Groups[3].Success ? " " + string.Join(" ", m.Groups[3].Value.ToCharArray()) : ""));

        // 0b6) A LISTED ELEMENT-SYMBOL FORMULA — `CoCr` → "cobalt chromium". See `FORMULA_READING`:
        //      a case-SENSITIVE list of tokens read wrong, not a formula parser.
        s = Rewrite(s, FORMULA_TOKEN, m => FORMULA_READING.TryGetValue(m.Value, out var r) ? r : m.Value);

        // 0b6b) A LISTED MATERIAL DESIGNATION — `316L` → "three sixteen L". See DESIGNATION_READING.
        //       ⚠ BEFORE THE UNIT RULE, which is the point: left to step 6 the `L` resolves as LITRES.
        s = Rewrite(s, DESIGNATION_TOKEN, m => DESIGNATION_READING.TryGetValue(m.Value, out var d) ? d : m.Value);

        // 0b6c) A MIXED-CASE ABBREVIATION — `DoE` → "design of experiments". See MIXED_CASE_ABBREV.
        s = Rewrite(s, MIXED_CASE_TOKEN, m => MIXED_CASE_ABBREV.TryGetValue(m.Value, out var a) ? a : m.Value);

        // 0b7) An enumerated list lead-in — the letter name AND a pause. See LIST_MARKER.
        // ⚠ Roman markers are deliberately not claimed; see the TypeScript for why a MIXED choice
        // would be worse than the defect.
        s = Rewrite(s, LIST_MARKER, m =>
        {
            var mark = m.Groups[2].Value;
            var said = ALL_DIGITS.IsMatch(mark) ? mark : SayLetter(mark);
            return m.Groups[1].Value + said + ",";
        });

        // 0b8) A lone letter in brackets elsewhere — a reference, so no pause. See BRACKETED_LETTER.
        s = Rewrite(s, BRACKETED_LETTER, m => SayLetter(m.Value));

        // A range is a date frame too, and the digit gate cannot see it. Runs FIRST. See the TypeScript.
        s = Rewrite(s, MONTH_RANGE, m =>
        {
            var a = m.Groups[1].Value;
            var b = m.Groups[3].Value;
            return (MONTH_ABBREV.TryGetValue(a.ToLowerInvariant(), out var ea) ? ea : a)
                 + m.Groups[2].Value
                 + (MONTH_ABBREV.TryGetValue(b.ToLowerInvariant(), out var eb) ? eb : b);
        });
        s = Rewrite(s, MONTH_ABBREV_BEFORE_NUM, m =>
            MONTH_ABBREV.TryGetValue(m.Groups[1].Value.ToLowerInvariant(), out var w) ? w : m.Value);
        s = Rewrite(s, MONTH_ABBREV_AFTER_DAY, m =>
            MONTH_ABBREV.TryGetValue(m.Groups[1].Value.ToLowerInvariant(), out var w) ? w : m.Value);
        s = Rewrite(s, WEEKDAY_ABBREV_RE, m =>
            WEEKDAY_ABBREV.TryGetValue(m.Groups[1].Value.ToLowerInvariant(), out var w) ? w : m.Value);

        // A section number's dot is "point", not a phrase break. See the TypeScript.
        s = Rewrite(s, SECTION_POINT, "$1 point ");
        s = Rewrite(s, ERA, m => m.Value switch
        {
            "BCE" => "bee see ee", "BC" => "bee see", "CE" => "see ee", "AD" => "ay dee", _ => m.Value,
        });

        s = Rewrite(s, SPACE_GROUP, m => SPACE_GROUP_SEPS.Replace(m.Value, ""));

        // A leading-point decimal gets its zero, BEFORE the numeric tier and after the abbreviation
        // dots, so currency, units and the range all see an ordinary decimal. See LEADING_DECIMAL_POINT.
        s = Rewrite(s, LEADING_DECIMAL_POINT, "0.");

        s = Rewrite(s, SCI_EXPONENT, m =>
        {
            var ten = m.Groups[1].Value;
            var sup = m.Groups[2].Value;
            var digits = sup.StartsWith("-", StringComparison.Ordinal)
                ? sup
                : string.Concat(Js.CodePoints(sup).Select(c => SUPERSCRIPT_DIGIT[c]));
            var neg = digits.StartsWith("-", StringComparison.Ordinal);
            return $"{ten} to the power of {(neg ? $"negative {digits[1..]}" : digits)}";
        });

        // ⚠ Before the sign rules below, which would otherwise claim the sign off the offset.
        s = Rewrite(s, TZ_COMPACT_GLUED, OffsetWords);
        s = Rewrite(s, TZ_COMPACT_SPACED, OffsetWords);
        s = Rewrite(s, TZ_COLON, OffsetWords);
        s = Rewrite(s, TZ_ZULU, " UTC");

        s = Rewrite(s, NEGATIVE, "$1negative $2");
        s = Rewrite(s, PLUS_MINUS, "$1plus or minus $2");

        s = Rewrite(s, ISO_DATE, m =>
        {
            var date = IsoDate(Js.Number(m.Groups[1].Value), Js.Number(m.Groups[2].Value), Js.Number(m.Groups[3].Value));
            return date is null ? m.Value : m.Value.EndsWith("T", StringComparison.Ordinal) ? $"{date} " : date;
        });
        s = Rewrite(s, US_DATE, m =>
            IsoDate(Js.Number(m.Groups[3].Value), Js.Number(m.Groups[1].Value), Js.Number(m.Groups[2].Value)) ?? m.Value);

        s = Rewrite(s, MONEY_CENTS, m =>
        {
            var sym = m.Groups[1].Value;
            var intPart = m.Groups[2].Value;
            var cents = m.Groups[3].Value;
            if (!SUBUNIT.TryGetValue(sym, out var sub)) return m.Value; // no fractional unit — see SUBUNIT
            var forms = CURRENCY[sym];
            var whole = Rewrite(intPart, COMMAS, "");
            var unit = ONE_INT.IsMatch(whole) ? forms[0] : forms[1];
            var n = Js.Number(cents);
            if (n == 0) return $"{intPart} {unit}";
            var frac = $"{Js.NumberToString(n)} {(n == 1 ? sub[0] : sub[1])}";
            // ⚠ An amount under one unit is the fraction alone, and the parts are JUXTAPOSED — an "and"
            // here merges `$1.00 and $0.50` with `$1.50`. See src/languages/english/normalize.ts.
            return ALL_ZEROS.IsMatch(whole) ? frac : $"{intPart} {unit} {frac}";
        });

        s = Rewrite(s, PLUS_ATTACHED, "$1 plus $2");
        s = Rewrite(s, PLUS_LEADING, "$1plus $2");
        s = Rewrite(s, PLUS_POSTFIX, m =>
            m.Groups[1].Value + string.Concat(Enumerable.Repeat(" plus", m.Groups[2].Value.Length)));
        s = Rewrite(s, PLUS_BETWEEN_WORDS, " plus ");

        s = Rewrite(s, TWENTY_FOUR_SEVEN, "24 7");
        s = Rewrite(s, FRACTION, m =>
            FractionWords(Js.Number(m.Groups[1].Value), Js.Number(m.Groups[2].Value)) ?? m.Value);

        s = Rewrite(s, CURRENCY_RE, m =>
        {
            var sym = m.Groups[1].Value;
            var num = m.Groups[2].Value;
            var spelled = m.Groups[3].Success ? m.Groups[3].Value : null;
            var abbrev = m.Groups[4].Success ? m.Groups[4].Value : null;
            var forms = CURRENCY[sym];
            var mag = spelled ?? (abbrev is null ? null : $" {MONEY_MAGNITUDE[abbrev]}");
            var one = ONE_EXACT.IsMatch(JsRegex.Replace(num, COMMAS, ""));
            return $"{num}{mag ?? ""} {(one && mag is null ? forms[0] : forms[1])}";
        });

        s = Rewrite(s, PERCENT, "$1 percent");

        s = Rewrite(s, CLOCK, m =>
        {
            var h = m.Groups[1].Value;
            var mm = m.Groups[2].Value;
            var ss = m.Groups[3].Success ? m.Groups[3].Value : null;
            var suffix = m.Groups[4].Success ? m.Groups[4].Value : "";
            var n = ss is null ? 0 : Js.Number(ss);
            var secs = ss is null || ss == "00" ? "" : $" and {Js.NumberToString(n)} {(n == 1 ? "second" : "seconds")}";
            // ⚠ The meridiem trails the WHOLE clock, seconds included, and `o'clock` is only for a bare one.
            var body = mm == "00" ? (suffix.Length > 0 || secs.Length > 0 ? $"{h}" : $"{h} o'clock")
                : mm.StartsWith("0", StringComparison.Ordinal) ? $"{h} oh {Js.NumberToString(Js.Number(mm))}"
                : $"{h} {mm}";
            return $"{body}{secs}{suffix}";
        });

        s = Rewrite(s, MONTH_DAY, m =>
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

        s = Rewrite(s, YEAR_RANGE, m =>
        {
            double a = Js.Number(m.Groups[1].Value), b = Js.Number(m.Groups[3].Value);
            return b >= a ? $"{YearWords(a)}{m.Groups[2].Value}{YearWords(b)}" : m.Value;
        });
        s = Rewrite(s, YEAR_CONTEXT, m =>
        {
            var ctx = m.Groups[1].Value;
            var det = m.Groups[2].Success ? m.Groups[2].Value : null;
            var y = Js.Number(m.Groups[3].Value);
            return det is not null && y >= 2010 ? m.Value : $"{ctx}{det ?? ""} {YearWords(y)}";
        });
        s = Rewrite(s, YEAR_MONTH, m =>
            $"{m.Groups[1].Value}{m.Groups[2].Value} {YearWords(Js.Number(m.Groups[3].Value))}");

        // A DMS coordinate, BEFORE the unit rule, so every prime the unit rule then sees is
        // unambiguously a foot or an inch. See DMS_COORDINATE.
        var beforeDms = s;
        s = Rewrite(s, DMS_COORDINATE, m =>
        {
            var sec = m.Groups[3].Success ? " " + Counted(m.Groups[3].Value, "second", "seconds") : "";
            var dir = m.Groups[4].Success ? " " + HEMISPHERE[m.Groups[4].Value] : "";
            // ⚠ The trailing space is not cosmetic: the replacement ends in a word, so an unclaimed
            // letter after the match FUSES into it — `40°26′46″n` read "… secondsn".
            var glue = DMS_TRAILING_LETTER.IsMatch(beforeDms[(m.Index + m.Length)..]) ? " " : "";
            return Counted(m.Groups[1].Value, "degree", "degrees")
                 + " " + Counted(m.Groups[2].Value, "minute", "minutes") + sec + dir + glue;
        });

        // Feet and inches written tight, AFTER the DMS rule. See FEET_INCHES.
        s = Rewrite(s, FEET_INCHES, m =>
            Counted(m.Groups[1].Value, "foot", "feet") + " " + Counted(m.Groups[2].Value, "inch", "inches"));

        // A decimal followed by an ASCII `"` — `0.015"` (#1449). ⚠ GATED ON EveryQuoteIsAnInch, not on the
        // decimal point alone. AFTER FEET_INCHES, which has already consumed the `"` of a `6' 2"` compound.
        if (EveryQuoteIsAnInch(s))
            s = Rewrite(s, INCH_DECIMAL_ASCII, m => Counted(m.Groups[1].Value, "inch", "inches"));

        s = Rewrite(s, UNIT_RE, m =>
        {
            var num = m.Groups[1].Value;
            var mag = m.Groups[2].Success ? m.Groups[2].Value : null;
            var u = m.Groups[3].Value;
            var exp = m.Groups[4].Success ? m.Groups[4].Value : null;
            var forms = NormalizeSymbols.ResolveUnitSymbol(UNITS, UNITS_FOLDED, u);
            if (forms is null) return m.Value; // unresolvable → leave the text alone
            // An ASCII exponent on a one-letter unit that is not ⟨m⟩ is a code's digit, not an exponent.
            if (AsciiExponentIsCodeDigit(u, exp)) return m.Value;
            // ⚠ A coordinate's minutes, not a power — the unit still expands and the digit is handed
            // back, because declining outright would drop the ⟨°⟩ itself. See the predicate.
            var minutes = AsciiExponentIsCompoundPart(u, exp);
            var measure = minutes ? ""
                : exp == "²" || exp == "2" ? "square " : exp == "³" || exp == "3" ? "cubic " : "";
            var one = mag is null && ONE_EXACT.IsMatch(JsRegex.Replace(num, COMMAS, ""));
            return $"{num}{mag ?? ""} {measure}{(one ? forms[0] : forms[1])}{(minutes ? " " + exp : "")}";
        });

        // A slashed rate standing alone, with no number. ⚠ Ordered AFTER the arm above so count
        // agreement survives; the lookarounds keep it out of URLs. See the TS.
        s = Rewrite(s, BARE_RATE_RE, m =>
        {
            var forms = NormalizeSymbols.ResolveUnitSymbol(UNITS, UNITS_FOLDED, m.Value);
            return forms is null ? m.Value : forms[0];
        });

        // A micro-prefixed unit standing alone, with no number — the shape `µin` was reported in.
        // Ordered after the numbered arm so count agreement survives. See BARE_MICRO_RE.
        s = Rewrite(s, BARE_MICRO_RE, m =>
        {
            var forms = NormalizeSymbols.ResolveUnitSymbol(UNITS, UNITS_FOLDED, m.Value);
            return forms is null ? m.Value : forms[0];
        });

        s = Rewrite(s, W_WITH, "with");
        // A slash the table cannot enumerate: a rate, a fixed abbreviation, or the mark said aloud
        // between two ALL-CAPS labels. Ordered after the two arms above. See the TypeScript.
        s = Rewrite(s, SLASH_PAIR, m =>
        {
            var left = m.Groups[1].Value;
            var right = m.Groups[2].Value;
            var key = JsRegex.Replace(m.Value.ToLowerInvariant(), SLASH_WS, "");
            if (SLASH_ABBREV.TryGetValue(key, out var fixedReading)) return fixedReading;
            if (SLASH_ELIDED.Contains(key)) return $"{left} {right}";
            // ⚠ Two single letters are an ABBREVIATION, and that outranks both readings below — half the
            // alphabet is a unit symbol or a period of time on its own, so the rate test fired on `A/D
            // converter`, `R/W`, `O/S`. The real rates of this shape are enumerated unit keys the arm
            // above has already claimed. See the TypeScript.
            if (left.Length < 2 && right.Length < 2) return m.Value;
            var num = NormalizeSymbols.ResolveUnitSymbol(UNITS, UNITS_FOLDED, left);
            var den = NormalizeSymbols.ResolveUnitSymbol(UNITS, UNITS_FOLDED, right);
            var hasPeriod = TIME_PERIOD.TryGetValue(right.ToLowerInvariant(), out var period);
            var rate = hasPeriod || num is not null || den is not null
                || UNIT_WORDS.Contains(left.ToLowerInvariant()) || UNIT_WORDS.Contains(right.ToLowerInvariant());
            if (rate) return $"{num?[1] ?? left} per {(hasPeriod ? period : den?[0] ?? right)}";
            var label = left == left.ToUpperInvariant() && right == right.ToUpperInvariant();
            return label ? $"{left} slash {right}" : m.Value;
        });

        s = Rewrite(s, BARE_EXPONENT_GLUED, m => $"{m.Value} ");
        var allE = s;
        s = Rewrite(s, BARE_EXPONENT, m =>
        {
            var bas = m.Groups[1].Value;
            // A lone ⁰ or ¹ is a degree sign or a prime, not a power — see LONE_MARK in Core/NormalizeSymbols.cs.
            if (LONE_SUPERSCRIPT_MARK.IsMatch(m.Groups[2].Value)) return m.Value;
            // ⚠ …and the SECONDS prime is two of them, and a spaced superscript before a word is a NUCLIDE
            // (#1045). See the TS: this file's own note already cited `110⁰04¹05¹` and stopped one short.
            if (EN_ONLY_ONES.IsMatch(m.Groups[2].Value)
                && EN_PRIME_CHAIN.IsMatch(allE[Math.Max(0, m.Index - 24)..m.Index])) return m.Value;
            if (EN_HAS_SPACE.IsMatch(m.Value)
                && EN_NUCLIDE_FOLLOWS.IsMatch(allE[Math.Min(m.Index + m.Length, allE.Length)..])) return m.Value;
            var digits = string.Concat(Js.CodePoints(m.Groups[2].Value).Select(c => SUPERSCRIPT_DIGIT[c]));
            var neg = digits.StartsWith("-", StringComparison.Ordinal);
            var mag = neg ? digits[1..] : digits;
            var power = neg ? $"negative {mag}" : mag;
            return mag == "2" && !neg ? $"{bas} squared"
                : mag == "3" && !neg ? $"{bas} cubed"
                : $"{bas} to the power of {power}";
        });

        if (HAS_LOWER.IsMatch(s))
        {
            s = Rewrite(s, CAPS_ROMAN, m =>
            {
                var prev = m.Groups[1].Value;
                var n = Roman.RomanToInt(m.Groups[2].Value);
                if (n is null) return m.Value;
                var named = ROMAN_CARDINAL_CTX.IsMatch(prev);
                var evidence = named || CAP_INITIAL.IsMatch(prev);
                if (!evidence) return m.Value;
                // The capitalized-previous-word signal is the weak one; the shared measured stoplist
                // applies to it, but an explicit numbered-event noun still licenses a stoplisted token.
                if (!named && Roman.COLLISIONS.Contains(m.Groups[2].Value.ToLowerInvariant())) return m.Value;
                if (named) return $"{prev} {n}";
                var v = n.Value;
                var suf = v % 10 == 1 && v % 100 != 11 ? "st" : v % 10 == 2 && v % 100 != 12 ? "nd"
                    : v % 10 == 3 && v % 100 != 13 ? "rd" : "th";
                return $"{prev} the {v}{suf}";
            });
        }

        s = Rewrite(s, LOWER_ROMAN, m =>
        {
            var prev = m.Groups[1].Value;
            var n = ROMAN[m.Groups[2].Value.ToLowerInvariant()];
            if (ROMAN_CARDINAL_CTX.IsMatch(prev)) return $"{prev} {n}";
            var suf = n % 10 == 1 && n != 11 ? "st" : n % 10 == 2 && n != 12 ? "nd" : n % 10 == 3 && n != 13 ? "rd" : "th";
            return $"{prev} the {n}{suf}";
        });

        // A LONE GREEK LETTER IS A SYMBOL, NOT GREEK TEXT (#1448). One letter is a symbol, two or more is a
        // word — `λόγος` stays Greek and must. Emits the ENGLISH NAME as text so the ordinary lexicon
        // supplies the reading and the stress. AFTER the unit rules, because `μ` and `Ω` are unit symbols
        // before they are letter names (`5 μm`, `5 Ω`). See the TypeScript twin for the full reasoning.
        // ⚠ THE NEIGHBOURS ARE CAPTURED AND RE-EMITTED WITH A SPACE. Splicing the name straight in glued it
        // to whatever was beside it — `Δx is small` became `deltax` and read `dˈɛɫtˌæks`. See the TS twin.
        s = Rewrite(s, GREEK_LETTER, m =>
        {
            if (!GREEK_NAME.TryGetValue(m.Groups[2].Value, out var n)) return m.Value;
            var exp = m.Groups[3].Value;
            var body = exp.Length > 0 && GREEK_EXPONENT.TryGetValue(exp, out var e) ? n + e : n;
            var lead = m.Groups[1].Value;
            var tail = m.Groups[4].Value;
            return (lead.Length > 0 ? lead + " " : "") + body + (tail.Length > 0 ? " " + tail : "");
        });

        // ⚠ Before the generic ampersand arms below, which dissolve the construction this keys on.
        s = Rewrite(s, AMP_INITIALISM, m =>
        {
            var a = m.Groups[1].Value;
            var b = m.Groups[2].Value;
            return IsAmpInitialismHalf(a) || IsAmpInitialismHalf(b)
                ? $"{SpellLetters(a)} and {SpellLetters(b)}"
                : m.Value;
        });
        s = Rewrite(s, AMP_ENTITY, " and ");
        s = Rewrite(s, AMP, " and ");
        s = Rewrite(s, TIMES_SIGN, m =>
        {
            var left = m.Groups[1].Value;
            var sign = m.Groups[2].Value;
            var tail = s[(m.Index + m.Value.Length)..];
            var hasUnit = HAS_UNIT_TAIL.IsMatch(tail);
            var unspacedAscii = sign == "x" && !HAS_SPACE.IsMatch(m.Value);
            return $"{left} {(hasUnit || unspacedAscii ? "by" : "times")} ";
        });
        s = Rewrite(s, DIVIDE, "$1 divided by ");
        s = Rewrite(s, EQUALS, "$1 equals $2");
        s = Rewrite(s, LESS_THAN, "$1 less than ");
        s = Rewrite(s, GREATER_THAN, "$1 greater than ");

        s = Rewrite(s, NUMBER_RANGE, "$1 to ");
        s = Rewrite(s, NUMBER_ARROW, "$1 to ");

        // ⚠ BEFORE the parenthetical rule, or the SPACED forms are claimed as a pause and the span is
        // lost a second way. See the TS.
        s = Rewrite(s, CALENDAR_RANGE, "$1 to $2");

        s = Rewrite(s, SPACED_DASH, ", ");
        s = Rewrite(s, SPACED_DASH_AFTER_NUMBER, ", ");
        s = Rewrite(s, EM_DASH_BREAK, ", ");

        for (var i = 0; i < RELATIONAL.Length; i++)
            s = Rewrite(s, RELATIONAL_RE[i], $" {RELATIONAL[i].Words} ");

        return s;
    }

    /** English phonotactics, for the fail-safe guard in core/initialisms.ts. */
    public static readonly Func<string, bool> IsUnreadableEnglish = Initialisms.MakeUnreadableTest(new PhonotacticsData
    {
        Vowels = JsRegex.Compile($"[{Manifest.MANIFEST.Phonotactics.Vowels}]", "u"),
        LegalOnsets = new HashSet<string>(Manifest.MANIFEST.Phonotactics.Onsets, StringComparer.Ordinal),
        LegalCodas = new HashSet<string>(Manifest.MANIFEST.Phonotactics.Codas, StringComparer.Ordinal),
    });

    private static readonly JsRe SINGLE_LOWER_LETTER = JsRegex.Compile("^[a-z]$");

    /** Letter names. */
    private static string? LetterName(string l) =>
        SINGLE_LOWER_LETTER.IsMatch(l)
            ? (Manifest.MANIFEST.LetterNameExceptions.TryGetValue(l, out var name) ? name : l)
            : null;

    /** LEXICAL: acronyms spelled out although their lowercase form is a dictionary word. Authored in
     *  english.jsonc alongside the language's other hand-authored facts, not here. */
    private static readonly IReadOnlySet<string> ACRONYM_LETTERS =
        new HashSet<string>(Manifest.MANIFEST.AcronymLetters, StringComparer.Ordinal);

    /** INITIALISMS. */
    public static string NormalizeEnglishInitialisms(string text, Func<string, bool> isRecorded) =>
        Initialisms.MakeInitialismNormalizer(new InitialismData
        {
            LetterName = LetterName,
            AcronymLetters = ACRONYM_LETTERS,
            IsRecorded = isRecorded,
            IsUnreadable = w => IsUnreadableEnglish(w),
        })(text);
}
