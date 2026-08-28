/**
 * Shared SYMBOL normalization — the language-independent machinery for rewriting %, currency signs and
 * unit abbreviations into a language's words, before its tokenizer. The per-language part is pure data
 * (`SymbolData`); the engine here owns the matching, the currency magnitude hop, and count agreement.
 * Ported from src/core/normalizeSymbols.ts — see that file for the corpus evidence.
 */

using System.Text;
using static Vernacula.Phonemizer.Core.Rewriter;

namespace Vernacula.Phonemizer.Core;

/*
 * TS `export type CountForms = string[]` — word forms for one countable noun. Index 0 = singular;
 * further indices per the language's `countForm`. A language with no agreement uses a 1-element array.
 * Ported as `IReadOnlyList<string>` rather than a named type so the language data reads as an array
 * literal, exactly as the TS manifests do.
 */

/** TS `export type ExponentPosition = "before" | "after" | "compound" | "suffix"` — where a language puts
 *  the squared/cubed measure word relative to the unit noun. See `SymbolData.ExponentWords`. */
public static class ExponentPosition
{
    public const string Before = "before";
    public const string After = "after";
    public const string Compound = "compound";
    public const string Suffix = "suffix";
}

/**
 * Port of the TS union `ExponentPosition | Partial<Record<"squared" | "cubed", ExponentPosition>>`.
 * `All` is the string arm; `Squared`/`Cubed` are the per-power record arm. The implicit conversion keeps
 * the language data reading like the TS (`Position = ExponentPosition.Before`).
 */
public sealed class ExponentPositionSpec
{
    public string? All { get; init; }
    public string? Squared { get; init; }
    public string? Cubed { get; init; }

    public static implicit operator ExponentPositionSpec(string s) => new() { All = s };

    /** `typeof declared === "string" ? declared : declared?.[power]` — null when this power is undeclared. */
    public string? For(string power) => All ?? (power == "cubed" ? Cubed : Squared);
}

/** Port of the TS union `string | Readonly<Record<string, string>>` on `SymbolData.UnitPer`. */
public sealed class UnitPerSpec
{
    public string? Word { get; init; }
    public IReadOnlyDictionary<string, string>? ByDenominator { get; init; }

    public static implicit operator UnitPerSpec(string s) => new() { Word = s };

    /** `typeof d.unitPer === "string" ? d.unitPer : (d.unitPer?.[denom] ?? d.unitPer?.[dl])` */
    public string? For(string denom, string denomLower)
    {
        if (Word is not null) return Word;
        if (ByDenominator is null) return null;
        if (ByDenominator.TryGetValue(denom, out var exact)) return exact;
        return ByDenominator.TryGetValue(denomLower, out var folded) ? folded : null;
    }
}

public sealed class ExponentWordsDef
{
    public IReadOnlyList<string>? Squared { get; init; }
    public IReadOnlyList<string>? Cubed { get; init; }
    public ExponentPositionSpec? Position { get; init; }

    public IReadOnlyList<string>? this[string power] => power == "cubed" ? Cubed : Squared;
}

/**
 * Reading for an exponent on a BARE base — one with no unit noun to attach to (`20²`, `mc²`, `2¹⁰`).
 * Templates, not bare words: `{n}` is the base as written and `{e}` the exponent in ASCII digits, so the
 * engine's own number path speaks it.
 */
public sealed class BareExponentDef
{
    public string? Squared { get; init; }
    public string? Cubed { get; init; }
    public string? Power { get; init; }
    /**
     * The word for a NEGATIVE exponent's sign — `10⁻³¹` is "to the power of MINUS thirty-one". A word, not a
     * left-over ASCII `-`: the language's own sign rule runs BEFORE this tier, so a `-` written here would be
     * downstream of it and simply dropped, inverting the sign silently.
     */
    public string? Negative { get; init; }

    public string? this[string power] => power == "cubed" ? Cubed : Squared;
}

/**
 * The MULTIPLICATION SIGN's words — `6 × 6 cm`, `4x4`, `5 × 5`. Two words, because a dimension and a
 * product are not the same reading; `by` defaults to `times` for the languages that use one word.
 * Which word is chosen is deliberately mechanical:
 *   · a UNIT follows (`6 × 6 cm`)                  → `by`  — it is a measurement
 *   · UNSPACED ASCII between digits (`4x4`)        → `by`  — the format/designation idiom
 *   · anything else (`5 × 5`, `4 × 100`)           → `times`
 */
public sealed class MultiplyDef
{
    public required string Times { get; init; }
    public string? By { get; init; }
}

public sealed class SymbolData
{
    /**
     * The word for %, or count forms for Slavic. ⚠ OPTIONAL: omitted, the percent arm is SKIPPED ENTIRELY and
     * the sign is left where the leak gates can see it. It must never emit an empty word or the literal string
     * "undefined" — which is why a declared form is VALIDATED (`AssertForms`) rather than trusted.
     */
    public IReadOnlyList<string>? Percent { get; init; }
    /**
     * Currency sign → count forms. The word is emitted after the number by default, before it with
     * `CurrencyPrefix`. A key may be more than one character (`US$`, `AUD$`); keys match longest-first.
     *
     * ⚠ INSERTION-ORDERED. JS `Object.keys` yields declaration order and the longest-first sort below is
     * STABLE, so ties resolve by declaration. A `Dictionary` preserves insertion order as long as nothing is
     * removed (none is), and the sort here is LINQ's stable `OrderByDescending` — see the call site.
     */
    public IReadOnlyDictionary<string, IReadOnlyList<string>>? Currency { get; init; }
    /**
     * Unit abbreviation (lowercase) → count forms. Matched only AFTER a number. (Insertion-ordered; see
     * `Currency`.)
     */
    public IReadOnlyDictionary<string, IReadOnlyList<string>>? Units { get; init; }
    /** Magnitude words that hop with a currency sign ("million" etc., in the language's spelling as it
     *  appears in running text). Omit if the language writes magnitudes after the currency word anyway. */
    public IReadOnlyList<string>? Magnitudes { get; init; }
    /// <summary>⚠ THIS LANGUAGE WRITES THE MAGNITUDE **BEFORE** ITS NUMBER (`miliyari 290`, not
    /// `290 miliyari`). Every magnitude arm assumed NUMBER-then-magnitude, so the other order had its
    /// magnitude STRANDED: the currency arm matched only the number-and-sign pair and put the noun BETWEEN
    /// the magnitude and its count — rw's `miliyari 290 Frw` read *miliyari amafaranga y'u Rwanda magana
    /// abiri na mirongo icyenda*. ⚠ OPT-IN: 131 languages declare Magnitudes and all mean the postposed
    /// order, so nothing that does not set this can move. See the TS for the attestation.</summary>
    public bool MagnitudePrecedes { get; init; }
    /**
     * The COUNT whose form a magnitude word selects for the noun after it. Defaults to `MANY`; declare it
     * where the language disagrees.
     */
    public double? MagnitudeCount { get; init; }
    /**
     * The word joining a magnitude to the currency noun (es/pt/fr/ca "de", it "di"). Only ever emitted when a
     * magnitude was matched, so a bare "$5" is unaffected.
     */
    public string? MagnitudeConnective { get; init; }
    /** n → index into a CountForms array. Default: n===1 → 0, else last index. Override for Slavic. */
    public Func<double, int>? CountForm { get; init; }
    /** The percent word PRECEDES the number (Turkish yüzde kırk, Mandarin 百分之四十). Text may write the
     *  sign on either side (%40 or 40%); both rewrite to prefix order. */
    public bool PercentPrefix { get; init; }
    /** The currency noun PRECEDES the number. The magnitude and its connective, if any, stay with the number. */
    public bool CurrencyPrefix { get; init; }
    /**
     * The UNIT noun precedes the number. ⚠ Opt-in rather than inferred from `CurrencyPrefix`: the two orders
     * are independent, and a language may want one without the other.
     */
    public bool UnitPrefix { get; init; }
    /**
     * The word joining two units in a RATE — `km/h` → "kilometres PER hour". Both units must be declared,
     * since the denominator needs its own noun. May be keyed BY DENOMINATOR where the preposition varies.
     */
    public UnitPerSpec? UnitPer { get; init; }
    /**
     * Nouns available ONLY as a rate DENOMINATOR — `h`, `u`, `s` — never matched as a standalone unit, since
     * a one-letter key collides with plural-s and with alphanumeric designations.
     */
    public IReadOnlyDictionary<string, string>? RateDenominators { get; init; }
    /**
     * Squared and cubed units — `km²` → "square kilometres". The measure word is language data and so is its
     * POSITION, which needs four values (`after`, `before`, `compound`, `suffix`) and may differ between the
     * squared and cubed powers — hence the per-power record arm on `ExponentPositionSpec`.
     */
    public ExponentWordsDef? ExponentWords { get; init; }
    /** See `BareExponentDef`. */
    public BareExponentDef? BareExponent { get; init; }
    /** See `MultiplyDef`. */
    public MultiplyDef? Multiply { get; init; }
    /**
     * The word for `&`, which is DROPPED outright without one. ⚠ SPACED ON BOTH SIDES, always: `B&B` is two
     * initialisms and substituting without spaces fuses them into one token. The HTML entity is folded first,
     * or `&amp;` reads as the word plus "amp" plus a semicolon.
     */
    public string? Ampersand { get; init; }
    /**
     * THIS LANGUAGE IS WRITTEN WITHOUT SPACES BETWEEN WORDS — Chinese, Japanese, and (for the separator) Khmer.
     * Set it and the boundary guards around currency keys and unit abbreviations narrow from "any letter" to
     * "a LATIN letter", since a Han or kana neighbour is a token boundary by script change. Left unset, the
     * guard rejects the ORDINARY case in these languages.
     */
    public bool UnspacedScript { get; init; }
}

/**
 * The SIGN AND MATH WORDS a language reads for ± + − & = &lt; &gt; × ÷.
 *
 * ⚠ AN EXACT SHAPE RATHER THAN A DICTIONARY, so a language cannot declare a key this does not name. It
 * does NOT validate the manifest — a missing key deserializes to the type default and reaches the output;
 * the guard is ManifestSignWordsTests. ⚠ The symbol tier does not read this yet: each language's own
 * normalize applies it, and this type exists so the engines converge on one shape as they migrate.
 */
public sealed class SignWords
{
    /** ± — ⚠ ONE code point (U+00B1), so no ⟨+⟩ rule can reach inside it; without an entry it vanishes. */
    public required string PlusMinus { get; init; }
    public required string Plus { get; init; }
    public required string Minus { get; init; }
    /** ⟨&amp;⟩ — the ordinary word for "and". */
    public required string Ampersand { get; init; }
    /** ⚠ `new` because the TS field is named `equals` and PascalCase collides with `object.Equals`.
     *  The name is kept rather than mangled — the manifests key on it, so the two sides must diff. */
    public required new string Equals { get; init; }
    public required string LessThan { get; init; }
    public required string GreaterThan { get; init; }
    public required string Times { get; init; }
    public required string DividedBy { get; init; }
}

public static class NormalizeSymbols
{
    /** Superscript digits → ASCII, so the exponent reaches the engine's number path as a readable numeral. */
    private static readonly IReadOnlyDictionary<string, string> SUPERSCRIPT = new Dictionary<string, string>
    {
        ["⁻"] = "-", // SUPERSCRIPT MINUS (U+207B) — a NEGATIVE exponent, `10⁻³¹`.
        ["⁰"] = "0",
        ["¹"] = "1",
        ["²"] = "2",
        ["³"] = "3",
        ["⁴"] = "4",
        ["⁵"] = "5",
        ["⁶"] = "6",
        ["⁷"] = "7",
        ["⁸"] = "8",
        ["⁹"] = "9",
    };
    private static readonly string SUPERSCRIPT_RUN = "[" + string.Concat(SUPERSCRIPT.Keys) + "]+";

    /**
     * A BARE exponent — a base with no unit noun for the unit path to attach the power to. The base may be
     * digits OR letters (`20²`, `mc²`). ⚠ `\p{Nd}` not `\d`, because a language may write its own numerals
     * and native-digit folding is applied per engine rather than fleet-wide.
     */
    private static readonly JsRe BARE_EXPONENT = JsRegex.Compile(
        "(\\p{Nd}[\\p{Nd}.,]*|(?<![\\p{L}\\p{M}])[\\p{L}\\p{M}]{1,3})\\s?(" + SUPERSCRIPT_RUN + ")",
        "gu");
    /** The same shape with a LETTER after the superscript — spaced off first, so the WORD the rule below
     *  emits cannot fuse with what follows (`I²C` read as one token). */
    /// <summary>⚠ AND NOT WHEN A SPACE PRECEDES THE SUPERSCRIPT (#1045/#1086): a space-separated superscript
    /// glued to a word is that word's NUCLIDE, and firing here inserts a space that HIDES the shape from
    /// NUCLIDE_FOLLOWS below, which tests for a letter IMMEDIATELY after. #1085 guarded both branches and
    /// this pass defeated the guard in the DECLARED one. `10⁶km` still spaces.</summary>
    private static readonly JsRe BARE_EXPONENT_GLUED = JsRegex.Compile(
        "(?:\\p{Nd}[\\p{Nd}.,]*|(?<![\\p{L}\\p{M}])[\\p{L}\\p{M}]{1,3})(?:" + SUPERSCRIPT_RUN + ")(?=[\\p{L}\\p{M}])",
        "gu");
    private static readonly JsRe DIGIT_BASE = JsRegex.Compile("^\\p{Nd}", "u");
    private static readonly JsRe LETTER_NEXT = JsRegex.Compile("^[\\p{L}\\p{M}]", "u");
    private static readonly JsRe LONE_MARK = JsRegex.Compile("^[⁰¹]$", "u");
    /// <summary>⚠ A RUN OF ONLY ¹ AFTER A COORDINATE CHAIN IS A DOUBLE PRIME, NOT A POWER (#1045). LONE_MARK
    /// declines a single ¹ as a prime; Mongolian writes SECONDS as two — `110⁰04¹05¹¹` is 110°04′05″, ×8 and
    /// every one a coordinate. ⚠ Declining `¹¹` outright would damage six languages that write real powers
    /// (`10¹¹`, `10¹⁰⁰`, `10¹⁰Ω`), so the discriminator is the unspaced `digits⁰digits¹` chain immediately
    /// before — anchored and space-free, because `10¹⁰ 10¹¹` has a ⁰ nearby and is still two powers.</summary>
    private static readonly JsRe PRIME_CHAIN = JsRegex.Compile(@"\p{Nd}+⁰\p{Nd}+¹$", "u");
    private static readonly JsRe ONLY_ONES = JsRegex.Compile("^¹+$", "u");
    /// <summary>⚠ A SPACED SUPERSCRIPT GLUED TO A WORD BELONGS TO WHAT FOLLOWS (#1045) — a leading NUCLIDE
    /// mass number would otherwise bind to the preceding number (`0,708 ¹⁸⁰Hf` → *0,708 180 Hf*). Both
    /// conditions are required: without the space `10¹⁰Ω` is 10¹⁰ ohms, and without a following letter
    /// there is no word for the superscript to belong to.</summary>
    private static readonly JsRe NUCLIDE_FOLLOWS = JsRegex.Compile(@"^[\p{L}\p{M}]", "u");
    private static readonly JsRe HAS_SPACE = JsRegex.Compile(@"\s", "u");

    /// <summary>The two #1045 refusals, shared by the fallback and the declared branch.</summary>
    private static bool IsPrimeOrNuclide(string whole, string sup, int at, string all) =>
        (ONLY_ONES.IsMatch(sup) && PRIME_CHAIN.IsMatch(all[Math.Max(0, at - 24)..at]))
        || (HAS_SPACE.IsMatch(whole) && NUCLIDE_FOLLOWS.IsMatch(all[Math.Min(at + whole.Length, all.Length)..]));
    /** A digit base, a lone ² or ³, and a short letter run that may be a unit key — the shape whose power
     *  belongs to the UNIT rather than to the number. Separators: space, NBSP, NNBSP, thin space. */
    private static readonly JsRe UNIT_POWER_BEFORE = JsRegex.Compile(
        // separators: space, NBSP, NNBSP, thin space
        "\\p{Nd}[\\p{Nd}.,]*[ \u00a0\u202f\u2009]?[²³](?=[ \u00a0\u202f\u2009]?([\\p{L}\\p{M}]{1,4})(?![\\p{L}\\p{M}]))",
        "gu");
    /** The mark and the separator before it, stripped together — see the TS for why the separator goes too. */
    private static readonly JsRe UNIT_POWER_MARK = JsRegex.Compile("[ \u00a0\u202f\u2009]?[²³]", "u");

    /// <summary>The floor under every exponent refusal: emit a bare power's DIGITS, spaced off
    /// (`10⁶` → `10 6`). Public because 52 engines do not use this tier and must call it themselves, AFTER
    /// their own unit rule. Ported from src/core/normalizeSymbols.ts — see it for the evidence.</summary>
    public static string SpacedBareExponent(string s)
    {
        var all = s;
        return Rewrite(s, BARE_EXPONENT, m =>
        {
            var whole = m.Value;
            var sup = m.Groups[2].Value;
            if (LONE_MARK.IsMatch(sup)) return whole;
            if (IsPrimeOrNuclide(whole, sup, m.Index, all)) return whole;
            var digits = new StringBuilder();
            foreach (var c in Js.CodePoints(sup)) digits.Append(SUPERSCRIPT[c]);
            return SpacedDigits(m.Groups[1].Value, digits.ToString(), all, m.Index + m.Length) ?? whole;
        });
    }

    /// <summary>The digit reading, or null where no honest one exists: no letter base, no negative.</summary>
    private static string? SpacedDigits(string baseText, string digitStr, string all, int end)
    {
        if (!DIGIT_BASE.IsMatch(baseText)) return null;
        if (digitStr.StartsWith('-')) return null;
        return LETTER_NEXT.IsMatch(all[end..]) ? $"{baseText} {digitStr} " : $"{baseText} {digitStr}";
    }

    private static int DefaultCountForm(double n) => n == 1 ? 0 : 1;

    /** The Slavic three-way selector (ru, cs): 1→0 (sg), 2–4→1 (paucal), else→2 — keyed on the final
     *  digits, with 11–14 always plural (21 процент, 22 процента, 25 процентов, 12 процентов). */
    public static readonly Func<double, int> SlavicCountForm = n =>
    {
        var mod100 = Math.Abs(n) % 100;
        var mod10 = mod100 % 10;
        if (mod100 >= 11 && mod100 <= 14) return 2;
        if (mod10 == 1) return 0;
        if (mod10 >= 2 && mod10 <= 4) return 1;
        return 2;
    };

    /**
     * The form a currency noun takes after a MAGNITUDE word ("5 million dollars"). ⚠ RESOLVED THROUGH THE
     * LANGUAGE'S OWN `countForm` with a many-count, never a fixed slot index: a literal 2 means the PAUCAL to
     * the Slavic selector, and "last entry" stops meaning "most plural" the moment a fourth form is added.
     */
    private const double MANY = 5; // any count that selects a language's plural/genitive-plural slot

    /**
     * ⚠ `MANY` IS THE DEFAULT, NOT A UNIVERSAL — `MagnitudeCount` overrides it per language, and it is
     * declared as a COUNT rather than a slot index so it goes through `countForm` like every other number here.
     */
    private static string WithMagnitude(
        IReadOnlyList<string> forms,
        string? mag,
        double n,
        Func<double, int> countForm,
        double? magnitudeCount = null) =>
        Pick(forms, mag is not null && mag != "" ? magnitudeCount ?? MANY : n, countForm);

    /**
     * ⚠ ABSENT IS A DECISION; MALFORMED IS A BUG — and only a runtime check tells them apart. Every field on
     * `SymbolData` is optional, so declining a reading is inert; but a manifest key that fails to bind
     * deserializes to the type default, and an empty form would write the literal word "undefined" into the
     * phoneme stream. A declared form is therefore checked at CONSTRUCTION, where the message can name it.
     */
    private static void AssertForms(string field, IReadOnlyList<string>? forms)
    {
        var bad = forms is null || forms.Count == 0 || forms.Any(string.IsNullOrEmpty);
        if (bad)
            throw new InvalidOperationException(
                $"SymbolData.{field}: declared, but not a non-empty list of non-empty words (got {JsonOf(forms)}). " +
                "Omit the field entirely if this language has no word to say; do not declare an empty one.");
    }

    /** `JSON.stringify(forms)` for the assertion message only — never on an output path. */
    private static string JsonOf(IReadOnlyList<string>? forms) =>
        forms is null ? "null" : "[" + string.Join(",", forms.Select(w => w is null ? "null" : "\"" + w + "\"")) + "]";

    private static string Pick(IReadOnlyList<string> forms, double n, Func<double, int> countForm)
    {
        var i = Math.Min(countForm(n), forms.Count - 1);
        return forms[Math.Max(0, i)];
    }

    /**
     * ⚠ THE DIGIT-GROUPING SEPARATORS, and they are not just the ASCII space: French, Russian and Swedish
     * typography group with U+00A0, U+202F and U+2009. Do not narrow this class — the failure is invisible to
     * the parity gate, because no golden groups a numeral with a NBSP, and it surfaces instead as a whole
     * downstream rule declining (a `unitPrefix` language stops recognising the number and postposes its unit).
     * Shared by all five sites so they cannot drift apart again.
     */
    private const string GROUP_SP = "[ \u00a0\u202f\u2009]";
    private static readonly JsRe NUM_SPACE = JsRegex.Compile(GROUP_SP, "gu");
    private static readonly JsRe NUM_SHAPE = JsRegex.Compile("^(\\d+(?:[.,]\\d{3})*)(?:[.,](\\d+))?$");
    private static readonly JsRe NUM_SEPS = JsRegex.Compile("[.,]", "g");

    /**
     * Leading integer value of a possibly grouped/decimal numeral ("1,234.5" → 1234) — agreement is driven by
     * the integer part, and a decimal always takes the plural/genitive form.
     */
    private static double NumValue(string num)
    {
        var cleaned = JsRegex.Replace(num, NUM_SPACE, "");
        var m = NUM_SHAPE.Match(cleaned);
        if (!m.Success) return double.NaN;
        var integer = double.Parse(NUM_SEPS.Replace(m.Groups[1].Value, ""), System.Globalization.CultureInfo.InvariantCulture);
        return m.Groups[2].Success && m.Groups[2].Value.Length != 3 ? integer + 0.5 : integer;
    }

    private const string NUM = "\\d+(?:[ \u00a0\u202f\u2009]\\d{3}(?!\\d)|[.,]\\d+)*";

    /**
     * A case-folded INDEX of a unit map. Folding the lookup STRING instead is asymmetric: it rescues `KM`→`km`
     * but not `kw`→`kW`. First declaration wins; the EXACT lookup runs first, so a real ⟨Mb⟩/⟨MB⟩ pair never
     * reaches this.
     */
    private static Dictionary<string, V> FoldedIndex<V>(IReadOnlyDictionary<string, V>? map)
    {
        var outp = new Dictionary<string, V>(StringComparer.Ordinal);
        if (map is null) return outp;
        foreach (var (k, v) in map)
        {
            var lk = k.ToLowerInvariant();
            if (!outp.ContainsKey(lk)) outp[lk] = v;
        }
        return outp;
    }

    /**
     * Resolve a WRITTEN unit symbol to its declared forms: `kw` → `kW` → the caller's spoken word.
     *
     * ⚠ STEP 1 IS A SPELLING CORRECTION AND STEP 2 IS AN IDENTIFICATION. Units are CASE-SENSITIVE, so
     * identification is exact; correction is then restricted to MULTI-CHARACTER symbols, because one letter is
     * exactly where the case contrast carries two different real units (⟨s⟩/⟨S⟩, ⟨t⟩/⟨T⟩, ⟨a⟩/⟨A⟩).
     * ⚠ `foldSingle` LIFTS THAT RESTRICTION and only the RATE DENOMINATOR passes it — after the `/` of a rate,
     * ⟨H⟩ is not plausibly henry.
     *
     * Returns null when neither step resolves; every caller must then leave the text ALONE rather than emit
     * half a reading.
     */
    public static V? ResolveUnitSymbol<V>(
        IReadOnlyDictionary<string, V>? declared,
        IReadOnlyDictionary<string, V> folded,
        string written,
        bool foldSingle = false) where V : class
    {
        if (declared is not null && declared.TryGetValue(written, out var exact)) return exact;
        if (written.Length > 1 || foldSingle)
            return folded.TryGetValue(written.ToLowerInvariant(), out var f) ? f : null;
        return null;
    }

    private static readonly JsRe BARE_KEY_LATIN = JsRegex.Compile("^[A-Za-z]+$", "u");
    private static readonly JsRe BARE_KEY_VOWEL = JsRegex.Compile("[aeiouy]", "iu");

    /**
     * IS THIS UNIT SYMBOL SAFE TO READ WHEN IT STANDS ALONE, with no number attached? Three tests, each
     * measured rather than preferred:
     *   ⚠ NEVER ONE LETTER — a bare `m`/`g`/`l` collides with too many real words;
     *   ⚠ NO VOWEL, which is the whole discriminator — an alphabet that writes its vowels does not write
     *     vowel-less words, so this separates a symbol from a word without a lexicon per language
     *     (`y` counts as a vowel);
     *   ⚠ LATIN SCRIPT ONLY — in an abugida a consonant-only run is a word fragment, and Cyrillic `см` is also
     *     the standard abbreviation of *смотри*.
     */
    public static bool IsBareUnitKey(string key) =>
        key.Length > 1 && BARE_KEY_LATIN.IsMatch(key) && !BARE_KEY_VOWEL.IsMatch(key);

    /**
     * THE BARE-UNIT REWRITE ITSELF — `key → the word to say when the symbol stands alone`, as a text→text pass.
     * Public because several engines keep a local unit table and must not hand-write a second copy of the
     * guards below. Every guard:
     *   ⚠ EXACT CASE, no folding — the opposite of the digit-adjacent path, where the numeral in front has
     *     already established that a unit is meant;
     *   ⚠ NOT AFTER A NUMERAL, so the digit-adjacent path keeps every match it can make;
     *   ⚠ NOT BEFORE AN EXPONENT, superscript or ASCII, and NOT BEFORE `.` + letter;
     *   ⚠ and it declines a rate, whose denominator noun the language may not declare — a half reading is
     *     worse than a visible leak.
     */
    public static Func<string, string> MakeBareUnitNormalizer(
        IEnumerable<KeyValuePair<string, string>> readings)
    {
        // JS `new Map(entries)`: a repeated key keeps its FIRST position and its LAST value.
        var order = new List<string>();
        var map = new Dictionary<string, string>(StringComparer.Ordinal);
        foreach (var (k, v) in readings)
        {
            if (!IsBareUnitKey(k)) continue;
            if (!map.ContainsKey(k)) order.Add(k);
            map[k] = v;
        }
        if (map.Count == 0) return text => text;
        // ⚠ LINQ's OrderByDescending is STABLE, matching `Array.prototype.sort` — List.Sort is not.
        var keys = order.OrderByDescending(k => k.Length).ToList();
        var re = JsRegex.Compile(
            "(?<![\\p{L}\\p{M}\\p{Nd}'’ʼ/-])(?<!\\p{Nd}\\s)(" + string.Join("|", keys) + ")"
                + "(?![\\p{L}\\p{M}\\p{Nd}'’ʼ/²³-])(?!\\.\\p{L})(?!\\s?[23](?![\\d\\p{L}]))",
            "gu");
        return text => Rewrite(text, re, m => map[m.Groups[1].Value]);
    }

    /** `t.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")` */
    private static readonly JsRe ESC_RE = JsRegex.Compile("[.*+?^${}()|[\\]\\\\]", "gu");
    /** The currency-key escape, which also lists `$` first — kept as its own pattern so the ports diff. */
    private static readonly JsRe ESC_CUR_RE = JsRegex.Compile("[$.*+?^${}()|[\\]\\\\]", "gu");

    private static string Esc(string t) => JsRegex.Replace(t, ESC_RE, "\\$&");
    private static string EscCur(string t) => JsRegex.Replace(t, ESC_CUR_RE, "\\$&");

    private static readonly JsRe AMP_ENTITY = JsRegex.Compile("&amp;", "giu");
    private static readonly JsRe AMP_SIGN = JsRegex.Compile("[ \\t]*[&\uff06][ \\t]*", "gu");
    private static readonly JsRe FUSES = JsRegex.Compile("^[\\p{L}\\p{M}]", "u");
    private static readonly JsRe WS_RUN = JsRegex.Compile("\\s+", "gu");
    private static readonly JsRe MUL_RE = JsRegex.Compile("(\\p{Nd})\\s*(×|x)\\s*(?=\\p{Nd})", "gu");
    private static readonly JsRe MUL_SPACED = JsRegex.Compile("\\s", "u");
    private static readonly JsRe MUL_HAS_UNIT = JsRegex.Compile("^\\p{Nd}[\\d.,]*\\s?\\p{L}", "u");
    private static readonly JsRe TPL_N = JsRegex.Compile("\\{n\\}", "gu");
    private static readonly JsRe TPL_E = JsRegex.Compile("\\{e\\}", "gu");

    public static Func<string, string> MakeSymbolNormalizer(SymbolData d)
    {
        // Validate what IS declared, before any of it is compiled into a pattern. See `assertForms`.
        if (d.Percent is not null) AssertForms("percent", d.Percent);
        foreach (var (k, forms) in d.Currency ?? new Dictionary<string, IReadOnlyList<string>>())
            AssertForms($"currency[{k}]", forms);
        foreach (var (k, forms) in d.Units ?? new Dictionary<string, IReadOnlyList<string>>())
            AssertForms($"units[{k}]", forms);
        foreach (var p in new[] { "squared", "cubed" })
            if (d.ExponentWords?[p] is not null) AssertForms($"exponentWords.{p}", d.ExponentWords[p]);
        var cf = d.CountForm ?? DefaultCountForm;
        var unitsFolded = FoldedIndex(d.Units);
        var denomFolded = FoldedIndex(d.RateDenominators);
        /**
         * ⚠ A SEPARATOR IS NOT ALWAYS `\s`. Khmer separates words with U+200B, which JS `\s` does not match, so
         * every `\s?` below silently failed on the commonest way Khmer is written. Ridden on `UnspacedScript`,
         * which already means "this language's word boundaries are not spaces".
         */
        var OPT_SEP = d.UnspacedScript ? "[\\s\u200b\u200c]?" : "\\s?";
        // The separators a compound key's seam may carry, for closing it again on lookup. Mirrors OPT_SEP.
        var SEAM_SEPS = JsRegex.Compile("[\\s\\u200b\\u200c]+", "gu");  // ZWSP, ZWNJ
        //
        // ⚠ LONGEST FIRST: a shorter magnitude is often a prefix of a longer inflected one, and in declaration
        // order the short form matches first and strands the suffix. ⚠ `\s*`, NOT `\s+` — Chinese and Japanese
        // are written without spaces, so `1350亿m³` is the ordinary form. The group is re-emitted verbatim, so it
        // carries its own leading space or none, and can never match empty.
        // ⚠ WHERE ONE MAGNITUDE IS A PREFIX OF ANOTHER IT MUST END AT A WORD BOUNDARY, because there, and only
        // there, longest-first is defeated by BACKTRACKING: the long alternative matches, the rest of the
        // pattern fails, and the engine retries with the short one and reads the stranded suffix as the unit.
        // ⚠ GATED ON THE PREFIX RELATION rather than applied always — a blanket "not followed by a letter"
        // rejects the ordinary unspaced-script case, where a Latin letter after a Han magnitude is a token
        // boundary and not a continuation.
        var magList = d.Magnitudes ?? [];
        var magPrefixHazard = magList.Any(a => magList.Any(b => b != a && b.StartsWith(a, StringComparison.Ordinal)));
        var MAG_END = magPrefixHazard ? "(?![\\p{L}\\p{M}])" : "";
        var magSorted = string.Join("|", magList.OrderByDescending(x => x.Length));
        var magAlt = magList.Count > 0
            ? "(\\s*(?:" + magSorted + ")" + MAG_END + ")?"
            : "()?";
        // For the UNIT path the magnitude may be followed by its connective, already present in the text
        // (`2,2 milions de km²`): two words separate the number from the unit, breaking the adjacency this tier
        // matches on.
        // ⚠ Kept OUT of the currency path deliberately — there the connective is GENERATED by `join()`, so
        // consuming one that is already present would produce a second. Here it is consumed inside the
        // magnitude's own capture group and re-emitted by the callback.
        var magAltU = magList.Count > 0 && d.MagnitudeConnective is not null
            ? "(\\s*(?:" + magSorted + ")" + MAG_END + "(?:\\s+" + Esc(d.MagnitudeConnective) + ")?)?"
            : magAlt;
        // Currency keys are an ALTERNATION, not a character class: a class holds only single characters, which
        // would exclude letter-code currencies (`zł`, `PLN`, `USD`). Longest first so a two-letter code is not
        // shadowed by a one-letter one, and letter-bounded on both sides so a bare code cannot match inside a word.
        // ⚠ A COMPOUND KEY'S LETTERS MAY BE SEPARATED FROM ITS SIGN BY A SPACE, and the literal key could not
        // match the shape it was declared for: `US$` is declared by 36 language layers, and Kirundi's corpus
        // writes all three of its instances as `US $ 4,000` — so the bare `$` claimed the amount and `US`
        // reached the g2p as the WORD *us* (#1137).
        // ⚠ ONLY AT THE LETTER→SIGN SEAM: the optional separator goes where a run of letters is followed by a
        // run of non-letters, so `US$`/`AUD$`/`CN¥` gain it and an all-letter code (`PLN`, `zł`) does not —
        // there is no seam inside a word, and admitting one would let a key match across a real token gap.
        // ⚠ THE LETTER RUN MUST BE AT LEAST TWO LONG: a ONE-letter code is short enough to be a WORD.
        // Afrikaans declares `U$`, and ⟨U⟩ is its capitalised polite second-person pronoun — widening that
        // key ate the pronoun and re-read a plain dollar sum as a US one. `{2,}` keeps every compound key
        // declared today (`US$ AS$ AUD$ CN¥ HK$ NZ$ VS$`) and excludes exactly that one.
        var seam = JsRegex.Compile("^(\\p{L}{2,})(\\P{L}+)$", "u");
        string CurKey(string k)
        {
            var m = seam.Match(k);
            return m.Success ? EscCur(m.Groups[1].Value) + OPT_SEP + EscCur(m.Groups[2].Value) : EscCur(k);
        }
        var curKeys = d.Currency is not null
            ? string.Join("|", d.Currency.Keys.OrderByDescending(s => s.Length).Select(CurKey))
            : "";
        // ⚠ THE BOUNDARY GUARDS ASSUME SPACES BETWEEN WORDS, and Chinese and Japanese have none, so the ordinary
        // case is the one they reject. `UnspacedScript` narrows the guard from "any letter" to "a letter that
        // could CONTINUE this token", i.e. a Latin one. Opt-in rather than global, because the guard is
        // load-bearing where words ARE spaced — it stops a one-letter unit biting into a word.
        var wordCont = d.UnspacedScript ? "\\p{sc=Latn}" : "\\p{L}";
        /**
         * ⚠ THE MARK GUARD FOLLOWS `UnspacedScript`, AND MUST. In an abugida a dependent vowel is how a word ENDS,
         * so an unconditional `\p{M}` — right for Latin — drops a currency sign attached to a mark-final word.
         * Safe to relax only because a currency sign is not a letter and cannot prefix a longer word; the unit
         * path below KEEPS its trailing mark guard for exactly that reason.
         */
        var markCont = d.UnspacedScript ? "" : "\\p{M}";
        var CUR = "(?<![" + wordCont + markCont + "])(?:" + curKeys + ")(?![" + wordCont + markCont + "])";
        var curBefore = d.Currency is not null
            ? JsRegex.Compile("(" + CUR + ")" + OPT_SEP + "(" + NUM + ")" + magAlt, "gu")
            : null;
        // The magnitude is matched on BOTH sides of the number, or the postposed `5 millions $` matches nothing
        // and the sign is dropped. `magAlt` is `()?` when a language declares no magnitudes, so the group
        // indices stay fixed either way.
        var curAfter = d.Currency is not null
            ? JsRegex.Compile("(" + NUM + ")" + magAlt + OPT_SEP + "(" + CUR + ")", "gu")
            : null;

        // ⚠ THE MAGNITUDE-BEFORE-NUMBER ARMS, built only when MagnitudePrecedes is declared. Two shapes, both
        // attested in rw: the sign AFTER the number (`miliyari 290 Frw`) and BETWEEN the magnitude and the
        // number (`miliyoni $800`). They must run BEFORE curAfter/curBefore, or those claim the number-and-sign
        // pair first and strand the magnitude — which is the whole defect.
        var magWord = magList.Count > 0
            ? "(?<![" + wordCont + markCont + "])(?:"
              + string.Join("|", magList.OrderByDescending(x => x.Length)) + ")" + MAG_END
            : "";
        var magFirstAfter = d.Currency is not null && d.MagnitudePrecedes && magWord != ""
            ? JsRegex.Compile("(" + magWord + ")\\s+(" + NUM + ")" + OPT_SEP + "(" + CUR + ")", "gu")
            : null;
        var magFirstBefore = d.Currency is not null && d.MagnitudePrecedes && magWord != ""
            ? JsRegex.Compile("(" + magWord + ")" + OPT_SEP + "(" + CUR + ")" + OPT_SEP + "(" + NUM + ")", "gu")
            : null;
        // ⚠ LATENT, not a defect today: unit and denominator keys are NOT regex-escaped, where currency keys
        // are. No declared key contains a metacharacter, but a key like `ኪ.ሜ` would compile its `.` as "any
        // character". A paired fix escapes both sides in the TS first.
        var unitAlt = d.Units is not null
            ? string.Join("|", d.Units.Keys.OrderByDescending(s => s.Length))
            : "";
        // Denominators may come from either map; only `units` keys are matchable standalone.
        var denomKeys = string.Join("|",
            (d.Units?.Keys ?? Enumerable.Empty<string>())
                .Concat(d.RateDenominators?.Keys ?? Enumerable.Empty<string>())
                .OrderByDescending(s => s.Length));
        // The unit may carry a RATE denominator (`km/h`) or an EXPONENT (`km²`, `km2`); both are consumed in the
        // same match so neither is stranded after the unit word is substituted. A MAGNITUDE may sit between the
        // number and the unit, so `magAlt` is matched on both sides and re-emitted — it belongs to the NUMBER.
        //
        // ⚠ THE TRAILING GUARD REJECTS AN APOSTROPHE as well as a letter or mark, because an apostrophe is
        // word-internal in several orthographies and a one-letter key would otherwise bite into a real word.
        //
        // ⚠ `\s?` BEFORE THE EXPONENT SITS OUTSIDE THE CAPTURE GROUP, because the callback reads groups
        // POSITIONALLY and must not shift. It is also self-limiting: on the ASCII branch the lookbehind
        // `(?<=[a-zA-Z])` then sees the SPACE rather than the unit letter, so `km 2` is still not an exponent.
        //
        // ⚠ THE VERSION GUARD IS ANCHORED ON A LIST OF KNOWN DESIGNATIONS, NOT ON A SHAPE. `802.11g` read as
        // "802.11 grams"; but the shape of a designation is also the shape of a measurement, and a shape guard
        // silently cost 24 genuine readings against the 9 it saved. Add a designation here only with the same
        // measurement behind it. Both halves are needed: rejected at `802`, the engine retries from the
        // fractional part and matches `11g` on its own — the lookbehind stops a match beginning inside a number,
        // the lookahead one beginning at its front. Either decimal separator, since a designation is not
        // localised but the text around it is.
        string[] DESIGNATIONS = ["802[.,]11"];
        var NOT_VERSION = "(?<![\\d.,])(?!(?:" + string.Join("|", DESIGNATIONS) + ")[a-zA-Z](?![a-zA-Z\\d]))";
        var unitRe = d.Units is not null
            ? JsRegex.Compile(
                  // ⚠ THE NUMERATOR MAY CARRY AN EXPONENT TOO — the rate alternative must not begin at the slash, or
                  // `9,44 м³/с` matches the EXPONENT branch, ends at the ³, and leaves `/с` outside the match to reach
                  // the phoneme sink as a bare letter.
                  NOT_VERSION + "(" + NUM + ")" + magAltU + "\\s?(" + unitAlt + ")"
                      + "(?:\\s?(\u00b2|\u00b3|(?<=[a-zA-Z])[23](?![\\d\\p{L}]))?\\s?/\\s?(" + denomKeys + ")(\u00b2|\u00b3)?"
                      + "|\\s?(\u00b2|\u00b3|(?<=[a-zA-Z])[23](?![\\d\\p{L}])))?"
                      + "(?![" + wordCont + "\\p{M}\u0027\u2019\u02bc\u00b2\u00b3])"
                      // ⚠ AN UNREADABLE RATE DECLINES RATHER THAN HALF-READING (#1093) — see the TS for the
                      // two measured counter-examples that put the line at an ASCII-Latin denominator rather
                      // than at any slash, and for why the exponent is rejected here too.
                      + "(?!\\s?/\\s?[A-Za-z])(?!(?<=[a-zA-Z])[23]\\s?/\\s?[A-Za-z])",
                  "giu")
            : null;
        /**
         * THE SAME UNIT SYMBOL STANDING ALONE — a table header, a caption, a legend. The guards live in
         * `MakeBareUnitNormalizer`; two decisions are made here: ⚠ NOT IN AN UNSPACED SCRIPT, where "standalone"
         * is not a thing a pattern can see, and the SINGULAR is emitted, because a bare symbol is a citation.
         */
        var bareUnit = MakeBareUnitNormalizer(
            d.UnspacedScript
                ? []
                : (d.Units ?? new Dictionary<string, IReadOnlyList<string>>())
                    .Select(kv => new KeyValuePair<string, string>(kv.Key, Pick(kv.Value, 1, cf))));
        // All three percent signs: ASCII `%`, U+066A ٪ and U+FF05 ％, so no language has to pre-fold them.
        // ⚠ BUILT ONLY WHEN THE LANGUAGE HAS A WORD TO SAY. Undeclared, both patterns are null and the arm below
        // never runs — the sign stays in the text where the leak gates can see it.
        const string PCT = "[%\u066a\uff05]";
        var pctRe = d.Percent is not null ? JsRegex.Compile("(" + NUM + ")" + OPT_SEP + PCT, "gu") : null;
        // The %-before-number form (%40). The lookbehind stops a misfire after the currency rule has already
        // rewritten a following amount, which would otherwise glue its digits onto this match.
        var pctPreRe = d.Percent is not null ? JsRegex.Compile("(?<!\\d)" + PCT + "\\s?(" + NUM + ")", "gu") : null;

        /**
         * "Does the text right AFTER the match already spell this noun?" — used to stay quiet rather than say it
         * twice. The magnitude connective may sit between. Shared by currency and percent.
         */
        JsRe SaidAfter(IReadOnlyList<string> forms)
        {
            var conn = d.MagnitudeConnective is null ? "" : "(?:" + Esc(d.MagnitudeConnective) + "[ \u00a0\u202f\u2009]+)?";
            // ⚠ CASE-INSENSITIVE, because running text capitalises the noun. Suppression only — emission is
            // unaffected, so a language whose word this matches still emits its own declared form.
            return JsRegex.Compile("^[ \u00a0\u202f\u2009]*" + conn + "(?:" + string.Join("|", forms.Select(Esc)) + ")", "iu");
        }
        /** The mirror, for a PREFIX word. */
        JsRe SaidBefore(IReadOnlyList<string> forms) =>
            JsRegex.Compile("(?:" + string.Join("|", forms.Select(Esc)) + ")[ \u00a0\u202f\u2009]*$", "iu");
        var PCT_AFTER = d.Percent is not null ? SaidAfter(d.Percent) : null;
        var PCT_BEFORE = d.Percent is not null ? SaidBefore(d.Percent) : null;

        return text =>
        {
            // THE AMPERSAND FIRST, and spaced. Before every other rule because a `&` between two initialisms must
            // become three tokens, and any later rule that reads a token boundary needs the split already done.
            if (d.Ampersand is not null)
                text = Rewrite(Rewrite(text, AMP_ENTITY, "&"), AMP_SIGN, " " + d.Ampersand + " ");
            var s = text;

            bool IsUnitKey(string k) =>
                (d.Units is not null && d.Units.ContainsKey(k))
                || unitsFolded.ContainsKey(k.ToLowerInvariant())
                || (d.RateDenominators is not null && d.RateDenominators.ContainsKey(k))
                || denomFolded.ContainsKey(k.ToLowerInvariant());

            // A square or cube standing BEFORE a unit noun is the UNIT's power — dropped here, first, because
            // the unit path rewrites the key into a word and the mark breaks the number↔unit adjacency.
            s = Rewrite(s, UNIT_POWER_BEFORE, m =>
                IsUnitKey(m.Groups[1].Value) ? UNIT_POWER_MARK.Replace(m.Value, "") : m.Value);

            string Join(string? mag) =>
                mag is not null && mag != "" && d.MagnitudeConnective is not null ? d.MagnitudeConnective + " " : "";
            // Both orders emit through one shape so the magnitude and its connective travel with the number
            // whichever side the noun goes on. `rest` is the text immediately after the whole match: when it ALREADY
            // spells the currency noun, emitting the word again doubles it.
            string Money(string num, string? mag, string sym, string rest, bool magFirst = false)
            {
                // ⚠ THE MATCHED TEXT IS NOT ALWAYS THE DECLARED KEY — a compound key may match with a
                // separator at its letter→sign seam (`US $` for the key `US$`), so the table is consulted
                // with the literal first and with the seam closed second.
                var forms = d.Currency!.TryGetValue(sym, out var litForms)
                    ? litForms
                    : d.Currency![SEAM_SEPS.Replace(sym, "")];
                var already = SaidAfter(forms);
                // ⚠ `magFirst` KEEPS THE MAGNITUDE AGAINST ITS NUMBER for a MagnitudePrecedes language. The
                // POSTPOSED branch below would otherwise emit `290 miliyari CUR` — right adjacency, wrong
                // order for this language. The PREFIX branch already places the magnitude before the number.
                var body = magFirst ? (mag ?? "").Trim() + " " + num : num + (mag ?? "");
                if (already.IsMatch(rest)) return body; // the text says it; do not say it twice
                var w = WithMagnitude(forms, mag, NumValue(num), cf, d.MagnitudeCount);
                /**
                 * ⚠ THE EMITTED NOUN MUST NOT FUSE WITH WHATEVER FOLLOWS. `$110m` ends the match at the digits, so the
                 * currency noun lands against the `m` and the tokenizer reads ONE word — a plausible-looking word in every
                 * orthography probed, which no leak class, DROP or referee can see.
                 *
                 * ⚠ SEPARATE, DO NOT REFUSE. Refusing would drop the sign too; separating keeps *110 dollars* and leaves
                 * the unread magnitude letter where a gate can find it.
                 */
                var fuses = FUSES.IsMatch(rest);
                var tail = fuses ? " " : "";
                return d.CurrencyPrefix
                    ? WS_RUN.Replace(w + (mag ?? "") + " " + Join(mag) + num + tail, " ")
                    : body + " " + Join(mag) + w + tail;
            }
            // BEFORE curBefore/curAfter — see the arms' comment above.
            if (magFirstAfter is not null)
            {
                var full = s;
                // ⚠ " " + mag — the leading space is what magAlt's capture carries, and the prefix template
                // in Money is written against that shape. The template itself is UNTOUCHED.
                s = Rewrite(full, magFirstAfter, m => Money(
                    m.Groups[2].Value, " " + m.Groups[1].Value, m.Groups[3].Value,
                    full[(m.Index + m.Length)..], true));
            }
            if (magFirstBefore is not null)
            {
                var full = s;
                s = Rewrite(full, magFirstBefore, m => Money(
                    m.Groups[3].Value, " " + m.Groups[1].Value, m.Groups[2].Value,
                    full[(m.Index + m.Length)..], true));
            }
            if (curBefore is not null)
            {
                var full = s;
                s = Rewrite(full, curBefore, m => Money(
                    m.Groups[2].Value,
                    m.Groups[3].Success ? m.Groups[3].Value : null,
                    m.Groups[1].Value,
                    full[(m.Index + m.Length)..]));
            }
            if (curAfter is not null)
            {
                var full = s;
                s = Rewrite(full, curAfter, m => Money(
                    m.Groups[1].Value,
                    m.Groups[2].Success ? m.Groups[2].Value : null,
                    m.Groups[3].Value,
                    full[(m.Index + m.Length)..]));
            }
            // The percent word is suppressed when the text already carries it, on whichever side this language puts
            // it. ⚠ AND THE WHOLE ARM IS SKIPPED WHEN THE LANGUAGE DECLARES NO PERCENT WORD — not run with an empty
            // one, which would leave a trailing space and DELETE the sign instead of leaving it visible.
            if (d.Percent is not null && pctRe is not null && pctPreRe is not null
                && PCT_AFTER is not null && PCT_BEFORE is not null)
            {
                var forms = d.Percent;
                string Pct(string num, int offset, string full, int matchLen)
                {
                    string before = full[..offset], after = full[(offset + matchLen)..];
                    var w = Pick(forms, NumValue(num), cf);
                    if (d.PercentPrefix) return PCT_BEFORE.IsMatch(before) ? num : w + " " + num;
                    return PCT_AFTER.IsMatch(after) ? num : num + " " + w;
                }
                var pre = s;
                s = Rewrite(pre, pctPreRe, m => Pct(m.Groups[1].Value, m.Index, pre, m.Length));
                var post = s;
                s = Rewrite(post, pctRe, m => Pct(m.Groups[1].Value, m.Index, post, m.Length));
            }
            // THE MULTIPLICATION SIGN, both `×` and ASCII `x` — BEFORE the unit path, and ⚠ THAT ORDERING IS
            // LOAD-BEARING. Placed after it, a `UnitPrefix` language breaks: its unit path MOVES the noun ahead of
            // its number, leaving no digit after the sign, and the `x` falls through to the letter reading. Running
            // first also keeps the dimension test simple — the unit is still an abbreviation at this point.
            if (d.Multiply is not null)
            {
                var mul = d.Multiply;
                var by = mul.By ?? mul.Times;
                var full = s;
                s = Rewrite(full, MUL_RE, m =>
                {
                    var whole = m.Value;
                    var left = m.Groups[1].Value;
                    var sign = m.Groups[2].Value;
                    // A UNIT after the right operand makes it a measurement; an UNSPACED ascii `x` is the `4x4` format
                    // idiom. `\s*` in the pattern means the spacing test has to read the source.
                    var spaced = MUL_SPACED.IsMatch(whole);
                    var tail = full[(m.Index + whole.Length)..];
                    var hasUnit = MUL_HAS_UNIT.IsMatch(tail);
                    var word = hasUnit || (sign == "x" && !spaced) ? by : mul.Times;
                    return left + " " + word + " ";
                });
            }

            if (unitRe is not null)
                s = Rewrite(s, unitRe, m =>
                {
                    var whole = m.Value;
                    var num = m.Groups[1].Value;
                    var mag = m.Groups[2].Success ? m.Groups[2].Value : null;
                    var u = m.Groups[3].Value;
                    var numExp = m.Groups[4].Success ? m.Groups[4].Value : null;
                    var denom = m.Groups[5].Success ? m.Groups[5].Value : null;
                    var denomExp = m.Groups[6].Success ? m.Groups[6].Value : null;
                    var exp = m.Groups[7].Success ? m.Groups[7].Value : null;
                    // The magnitude travels with the NUMBER and is re-emitted verbatim — ⚠ a rule that CONSUMES a word
                    // must put it back. It governs the count form the way a large count does, through MANY and the
                    // language's own `countForm`, for the reason `WithMagnitude` gives.
                    var hasMag = mag is not null && mag != "";
                    var q = hasMag ? num + mag : num;
                    var n = hasMag ? d.MagnitudeCount ?? MANY : NumValue(num);
                    // Correct-then-identify; see ResolveUnitSymbol. A miss leaves the text ALONE rather than throwing from
                    // inside Pick on an unreachable uppercase key.
                    var forms = ResolveUnitSymbol(d.Units, unitsFolded, u);
                    if (forms is null) return whole;
                    var head = Pick(forms, n, cf);
                    /**
                     * Attach a measure word to one side of a rate. An exponent the language has no word for is re-emitted so
                     * the leak gate can see it, and never abandons the match. The SINGULAR is used on both sides — inside a
                     * rate neither noun is what the quantity counts.
                     */
                    string WithPower(string noun, string sup)
                    {
                        // ⚠ THE ASCII SPELLING COUNTS ON BOTH HALVES OF THIS (#1145). The unit regex admits
                        // `m3` as well as `m³`, so classifying on the superscript alone read an ASCII CUBE as
                        // a SQUARE, and re-emitting the raw digit on the miss handed the NUMBER path a `3` to
                        // speak. Classify ONCE and derive the character from that.
                        var power = sup == "³" || sup == "3" ? "cubed" : "squared";
                        var eForms = d.ExponentWords?[power];
                        if (eForms is null) return noun + (power == "cubed" ? "³" : "²");
                        var ew = eForms[0];
                        var ePos = d.ExponentWords?.Position?.For(power) ?? "after";
                        return ePos == "compound" ? ew + noun
                            : ePos == "suffix" ? noun + ew
                            : ePos == "before" ? ew + " " + noun
                            : noun + " " + ew;
                    }
                    if (denom is not null)
                    {
                        // A rate needs both nouns and the connective; without any of them leave the text alone rather than emit
                        // half a reading. Same exact-then-folded resolution as the head unit, except that folding is allowed
                        // for a ONE-letter denominator (see ResolveUnitSymbol) — the slash position rules out the other unit.
                        var dl = denom.ToLowerInvariant();
                        var dUnit = ResolveUnitSymbol(d.Units, unitsFolded, denom, true);
                        var dWord = (dUnit is not null && dUnit.Count > 0 ? dUnit[0] : null)
                            ?? ResolveUnitSymbol(d.RateDenominators, denomFolded, denom, true);
                        var per = d.UnitPer?.For(denom, dl);
                        if (per is null || dWord is null) return whole;
                        // ⚠ THE DENOMINATOR MAY CARRY AN EXPONENT — ⟨20,164 katao/km²⟩, the population-density shape. Composed
                        // only when the language declares `ExponentWords`; otherwise the old reading stands and
                        // the superscript is re-emitted where the leak gate can see it, as the head branch does.
                        var dPhrase = dWord;
                        if (denomExp is not null) dPhrase = WithPower(dPhrase, denomExp);
                        // ⚠ AND THE NUMERATOR TAKES IT TOO — see the regex comment above.
                        var headPhrase = numExp is null ? head : WithPower(head, numExp);
                        // `UnitPrefix` applies here too: the rate is ONE phrase, so the whole of it hinges on the head noun's
                        // position.
                        return d.UnitPrefix
                            ? headPhrase + " " + q + " " + per + " " + dPhrase
                            : q + " " + headPhrase + " " + per + " " + dPhrase;
                    }
                    if (exp is not null)
                    {
                        var power = exp == "\u00b3" || exp == "3" ? "cubed" : "squared";
                        var eForms = d.ExponentWords?[power];
                        if (eForms is null)
                        {
                            // ⚠ NO MEASURE WORD DECLARED — emit the UNIT and hand the exponent back rather than abandoning the
                            // match. Returning `whole` would lose the QUANTITY too; re-emitting `²` leaves the gap where the leak
                            // gate can see it.
                            // ⚠ AND IT HONOURS UnitPrefix like every sibling branch — this one returned
                            // number-first unconditionally, giving a partially-declaring UnitPrefix language
                            // two word orders from one rule (#1060).
                            // ⚠ AND IT IS HANDED BACK AS THE SUPERSCRIPT, WHATEVER THE TEXT WROTE (#1145).
                            // The argument above holds only for a character the reader cannot SAY: `²`/`³`
                            // are dropped by the g2p, but the unit alternation also admits the ASCII `2`/`3`,
                            // and a bare digit is claimed by the NUMBER path and SPOKEN — `517 km3` read
                            // "kilometre THREE, five hundred and seventeen". Missing word ≥ wrong word ≫
                            // INVENTED NUMBER.
                            // ⚠ DERIVED FROM `power`, NOT RE-CLASSIFIED — a second ternary over `exp` is how
                            // the rate branch above came to disagree with this one about an ASCII `3`.
                            var back = power == "cubed" ? "³" : "²";
                            return d.UnitPrefix ? head + back + " " + q : q + " " + head + back;
                        }
                        // Count forms, because in Romance the measure word is an ADJECTIVE and agrees.
                        var word = Pick(eForms, n, cf);
                        var pos = d.ExponentWords?.Position?.For(power) ?? "after";
                        // ⚠ The unit PHRASE is assembled first and the quantity placed around it, because `UnitPrefix` governs
                        // the exponent reading exactly as it governs the plain one. Building the return per-position instead
                        // silently ignores `UnitPrefix` on this branch.
                        var phrase =
                            pos == "compound"
                                ? word + head
                                : pos == "suffix"
                                  ? head + word
                                  : pos == "before"
                                    ? word + " " + head
                                    : head + " " + word;
                        return d.UnitPrefix ? phrase + " " + q : q + " " + phrase;
                    }
                    return d.UnitPrefix ? head + " " + q : q + " " + head;
                });

            // THE BARE UNIT TOKEN, after the digit-adjacent path has had every chance at the text — a `km` still
            // standing here has no numeral of its own.
            s = bareUnit(s);

            // A BARE EXPONENT, LAST — after the unit path, which must have its chance first or this would steal
            // every `km²` and read it as "kilometre squared" instead of "square kilometres".
            if (d.BareExponent is not null)
            {
                var be = d.BareExponent;
                s = Rewrite(s, BARE_EXPONENT_GLUED, m => $"{m.Value} ");
                var allD = s;
                s = Rewrite(s, BARE_EXPONENT, m =>
                {
                    var whole = m.Value;
                    var baseText = m.Groups[1].Value;
                    var sup = m.Groups[2].Value;
                    var end = m.Index + m.Length;
                    if (LONE_MARK.IsMatch(sup)) return whole;
                    // ⚠ THE SAME TWO REFUSALS, AND THIS IS THE SITE #1045 IS ACTUALLY ABOUT: both shapes
                    // occur only in languages that do not declare `bareExponent` TODAY, so "it goes live
                    // when one adopts the tier" means it goes live HERE, not in the fallback.
                    if (IsPrimeOrNuclide(whole, sup, m.Index, allD)) return whole;
                    var digits = new StringBuilder();
                    foreach (var c in Js.CodePoints(sup)) digits.Append(SUPERSCRIPT[c]);
                    // `2` and `3` have their own words in every language that has any; everything else — including `1`, `0`
                    // and a multi-digit power — goes through the generic form.
                    var digitStr = digits.ToString();
                    var neg = digitStr.StartsWith('-');
                    var mag = neg ? digitStr[1..] : digitStr;
                    // A NEGATIVE exponent always takes the generic `power` form.
                    var tpl = neg ? be.Power : mag == "2" ? be.Squared : mag == "3" ? be.Cubed : be.Power;
                    // A PARTIAL declaration falls through to the digits, not back to the drop.
                    if (tpl is null) return SpacedDigits(baseText, digitStr, allD, end) ?? whole;
                    if (neg && be.Negative is null) return SpacedDigits(baseText, digitStr, allD, end) ?? whole;
                    var exponent = neg ? be.Negative + " " + mag : mag;
                    return JsRegex.Replace(JsRegex.Replace(tpl, TPL_N, baseText), TPL_E, exponent);
                });
            }
            else
            {
                s = SpacedBareExponent(s);
            }
            return s;
        };
    }
}
