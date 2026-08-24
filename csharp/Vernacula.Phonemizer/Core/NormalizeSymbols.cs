/**
 * Shared SYMBOL normalization — the language-independent machinery for rewriting %, currency
 * signs, and unit abbreviations into that language's words, BEFORE its tokenizer. The per-language part
 * is pure data (`SymbolData`); the engine here owns the matching, the number-magnitude hop for currency
 * ($5 million → "5 million dollars"-shaped), and COUNT AGREEMENT — which for Slavic needs more than
 * singular/plural, so forms are selected by an overridable `countForm(n)` (Russian: 1 процент /
 * 2 процента / 5 процентов, keyed on the numeral's final digits).
 *
 * English's normalize.ts predates this seam and keeps its own implementation (it also handles dates,
 * times, years and romans, which are NOT shared — their rules are language-specific by nature). The
 * contract everywhere: emit plain words and digits the language's EXISTING pipeline already speaks.
 */

using System.Text;

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
 * Reading for an exponent on a BARE base — one with no unit noun to attach to. `20²`, `mc²`, `2¹⁰`.
 *
 * ⚠ SEPARATE FROM `exponentWords` BY NECESSITY: that field holds the UNIT MODIFIER, and in most languages
 * the modifier and the predicate are DIFFERENT WORDS. English reads *square kilometres* but *twenty
 * squared*; Italian *chilometri quadrati* but *venti al quadrato*, which needs a connective the modifier
 * form does not carry. Reusing `exponentWords` here yields "twenty square". Without this field the
 * exponent is dropped entirely — the rest of the machinery is unit-only.
 *
 * TEMPLATES, not bare words, because word order and connectives are language data. `{n}` is the base as
 * written and `{e}` the exponent in ASCII digits, so the engine's own number path speaks it:
 *   en  squared: "{n} squared"        power: "{n} to the power of {e}"
 *   hi  squared: "{n} का वर्ग"          power: "{n} की घात {e}"
 * A template also lets a language put the power word FIRST if that is its order, which no arrangement of
 * fixed fields could express.
 *
 * ⚠ `power` USES THE CARDINAL, NOT THE ORDINAL — "to the power of five", never "to the fifth power". The
 * ordinal is more idiomatic in English but would require the exponent's ordinal form in every language,
 * several of which inflect it for gender and case, and the exponent would then need agreement rules of
 * its own. The cardinal reuses the existing number path and needs one connective phrase per language;
 * `{e}` is emitted as DIGITS for that reason.
 *
 * Rare in practice — this is robustness for arbitrary input, not a repair of a common defect.
 */
public sealed class BareExponentDef
{
    public string? Squared { get; init; }
    public string? Cubed { get; init; }
    public string? Power { get; init; }
    /**
     * The word for a NEGATIVE exponent's sign — `10⁻³¹` is "to the power of MINUS thirty-one".
     *
     * Emitted as a WORD rather than left as an ASCII `-`, because ordering makes that the only correct
     * option: a language's own sign rule lives in its normalize.ts, which runs BEFORE this tier, so a `-`
     * written here is downstream of it and would simply be dropped — reading `2⁻⁵` as "two to the power of
     * five", with the sign silently inverted.
     *
     * ⚠ ENGLISH USES "negative" HERE AND "minus" FOR THE OPERATOR, and the distinction is worth carrying:
     * `minus` is the arithmetic operator ("ten minus four") and English convention reserves it for that,
     * spending `negative` on a sign attached to an amount. Most other languages do not split the two words
     * — de *minus*, fr *moins*, ru *минус* serve both — so each entry is that language's own sign word,
     * taken from the minus rule already in its normalize.ts rather than invented here.
     */
    public string? Negative { get; init; }

    public string? this[string power] => power == "cubed" ? Cubed : Squared;
}

/**
 * The MULTIPLICATION SIGN's words — `6 × 6 cm`, `4x4`, `5 × 5`.
 *
 * ⚠ ASCII `x` IS THE DOMINANT WRITTEN FORM and must be matched, not just `×`. Unhandled it reads as the
 * letter name — *six EKS six centimetres* — which is audible garbage rather than a drop, so no leak or
 * DROP gate can see it.
 *
 * TWO WORDS, because a dimension and a product are not the same reading. English says "six BY six
 * centimetres" for a format and "five TIMES five" for a product; a `4x4` is "a four BY four". Most
 * languages reuse one word for both (cs *krát*, da *gange*, ro *ori*, ca *per*, ga *faoi*) and simply
 * declare it twice — `by` defaults to `times` when omitted, so a single-word language costs nothing.
 *
 * WHICH WORD IS CHOSEN, and the rule is deliberately mechanical:
 *   · a UNIT follows (`6 × 6 cm`, `56 × 56 mm`)            → `by`  — it is a measurement
 *   · UNSPACED ASCII between digits (`4x4`, `6x6`)          → `by`  — the format/designation idiom
 *   · anything else (`5 × 5`, `4 × 100`)                    → `times`
 * The unspaced-ASCII arm is what separates `4x4` (a vehicle) from `5 × 5` (a product), since both have
 * equal operands and equality alone cannot tell them apart.
 */
public sealed class MultiplyDef
{
    public required string Times { get; init; }
    public string? By { get; init; }
}

public sealed class SymbolData
{
    /**
     * The word for %, e.g. "percent", "Prozent", "por ciento", or count forms for Slavic.
     *
     * ⚠ OPTIONAL, AND THE ONLY REASON TO OMIT IT IS THAT THE LANGUAGE HAS NO SOURCEABLE WORD. Every other
     * field here was already optional; this one was required and its arm unconditional, so a language with
     * no attested percent word could not declare the shared tier AT ALL and had to hand-write a local table
     * — duplicating the guards this file already owns. Tashelhit (shi) is the case that reported it: 234
     * number+% instances in its retained corpus, `tigmiḍi` a heading noun before its figure rather than a
     * postposed reading, 13 candidate spellings at ×0, and `attest.ts --after` on five numerals returning
     * nothing because shi.wikipedia never spells a numeral out — so the sign's reading is absent from text
     * by construction, not merely unfound. A wrong percent word is worse than a dropped sign.
     *
     * Omitted, the percent arm is SKIPPED ENTIRELY: the sign is left exactly where it was, visible to the
     * RAWMARK/DROP leak gates — the same choice `exponentWords` and `bareExponent` already make for a
     * missing measure word, and for the same reason. It does NOT emit an empty word, and it must never
     * emit the literal string "undefined".
     *
     * ⚠ OMITTING IS NOT THE SAME AS DECLARING NOTHING USEFUL. `loadManifest<T>` parses JSON and CASTS, so a
     * manifest that has lost this key type-checks cleanly and `percent: [MANIFEST.symbols.percent]` becomes
     * `[undefined]` — which would interpolate into the output as the six-letter word. That is why the
     * declared form is VALIDATED below (`assertForms`) rather than trusted: absent is inert, malformed
     * throws. See test/normalize-multilang.test.ts, which asserts both halves.
     */
    public IReadOnlyList<string>? Percent { get; init; }
    /**
     * Currency sign → count forms. The sign may precede or follow the number in text; the word is emitted
     * after the number by default, or before it with `currencyPrefix`.
     *
     * A KEY MAY BE MORE THAN ONE CHARACTER. A bare `$` cannot match in `US$30` or `AUD$45` — the pattern is
     * letter-bounded on the left so a code prefix is not split, and that guard is deliberate. Declare the
     * compound key instead:
     *
     *     currency: { "US$": ["US dollar"], "AUD$": ["Australian dollar"], "$": ["dollar"] }
     *
     * Keys are matched longest-first, so the compound wins over the bare sign. Likewise, a language whose
     * noun has non-concatenative plurals should declare them as further CountForms entries — the
     * "already said it" suppression below tests every declared form, so `$100 ዶላሮች` only stays quiet if
     * ዶላሮች is one of them.
     *
     * ⚠ INSERTION-ORDERED. JS `Object.keys` yields declaration order and the longest-first sort below is
     * STABLE, so ties resolve by declaration. A `Dictionary` preserves insertion order as long as nothing
     * is removed (none is), and the sort here is LINQ's stable `OrderByDescending` — see the call site.
     */
    public IReadOnlyDictionary<string, IReadOnlyList<string>>? Currency { get; init; }
    /** Unit abbreviation (lowercase) → count forms. Matched only AFTER a number. (Insertion-ordered; see
     *  `Currency`.) */
    public IReadOnlyDictionary<string, IReadOnlyList<string>>? Units { get; init; }
    /** Magnitude words that hop with a currency sign ("million" etc., in the language's spelling as it
     *  appears in running text). Omit if the language writes magnitudes after the currency word anyway. */
    public IReadOnlyList<string>? Magnitudes { get; init; }
    /**
     * The COUNT whose form a magnitude word selects for the noun after it. Defaults to `MANY` (5), i.e. the
     * slot a large count takes — right for most of the fleet. Declare it when the language disagrees:
     * Maltese takes the SINGULAR after a magnitude (*745 miljun dollaru*) while still needing the plural for
     * *ħames dollari*, so it declares a count its own `countForm` maps to the singular. See `MANY`.
     */
    public double? MagnitudeCount { get; init; }
    /** The word joining a magnitude to the currency noun: Spanish/Portuguese/French/Catalan "de", Italian
     *  "di" — *cinco millones **de** dólares*. Omit for the languages that take none (German "fünf
     *  Millionen Dollar", Swedish "fem miljoner dollar"). Only ever emitted when a magnitude was matched,
     *  so a bare "$5" is unaffected — without it, es/pt/fr/ca read *cinco millones dólares*. */
    public string? MagnitudeConnective { get; init; }
    /** n → index into a CountForms array. Default: n===1 → 0, else last index. Override for Slavic. */
    public Func<double, int>? CountForm { get; init; }
    /** The percent word PRECEDES the number (Turkish yüzde kırk, Mandarin 百分之四十). Text may write the
     *  sign on either side (%40 or 40%); both rewrite to prefix order. */
    public bool PercentPrefix { get; init; }
    /**
     * The currency noun PRECEDES the number — Swahili "dola 30", where the tier's default is to emit it
     * after. The magnitude and its connective, if any, stay with the number: "dola milioni 5".
     */
    public bool CurrencyPrefix { get; init; }
    /**
     * The UNIT noun precedes the number — Swahili writes *kilomita 19,500*, *mita 100*, the mirror of the
     * `currencyPrefix` case and for the same reason (a measure noun heads its phrase in Bantu).
     *
     * ⚠ Opt-in rather than inferred from `currencyPrefix`: the two orders are independent, and a language
     * may want one without the other.
     */
    public bool UnitPrefix { get; init; }
    /**
     * The word joining two units in a RATE — `km/h` → "kilometres PER hour". Composition is shared; only
     * the word is language data ("per", "pro", "par"). Both units must be declared in `units`, since the
     * denominator needs its own noun (`h` → hour/Stunde/heure).
     *
     * NOT universal, which is why it is opt-in: Korean writes the rate as a PREFIX (시속 = "hour-speed"),
     * and Japanese/Vietnamese/Thai already resolve their own rate units locally for ordering reasons. Those
     * keep doing so; this serves the majority "A per B" idiom.
     *
     * MAY BE KEYED BY DENOMINATOR, because the preposition is not always one word: Serbian writes
     * `километара НА сат` but `километара У секунди`, and had to compose `/s` locally for want of this.
     * A plain string applies to every denominator; a record selects on the denominator key.
     */
    public UnitPerSpec? UnitPer { get; init; }
    /**
     * Nouns available ONLY as a rate DENOMINATOR — `h`, `u`, `s` — never matched as a standalone unit.
     *
     * ⚠ Declaring `s` in `units` so `m/s` can compose ALSO makes a bare `76s` match, turning `Il-76s` (an
     * aircraft, plural) into *zesenzeventig seconde* — confidently wrong, and worse than the raw letter it
     * replaced. One-letter denominators collide with plural-s and with alphanumeric designations, so they
     * stay out of the standalone alternation entirely.
     */
    public IReadOnlyDictionary<string, string>? RateDenominators { get; init; }
    /**
     * Squared and cubed units — `km²` → "square kilometres". The measure word is language data and so is
     * its POSITION, which needs FOUR values, not two:
     *   `after`    (default) — Italian, Vietnamese, Polish: *chilometri quadrati*, *kilometr kwadratowy*
     *   `before`   — Russian: *квадратных километров*, an agreeing adjective with a space
     *   `compound` — Swedish and Japanese, which fuse it BEFORE: *kvadratkilometer*, 平方キロメートル
     *   `suffix`   — Turkish, which fuses it AFTER: *kilometrekare*, *metreküp*
     * ⚠ `before` and `compound` are NOT interchangeable — collapsing them yields Russian
     * *квадратныхкилометров*, one unreadable token. Nor are `suffix` and `compound`: Turkish is
     * *kilometrekare*, and neither *karekilometre* nor *kilometre kare* is that word.
     *
     * ⚠ THE POSITION CAN DIFFER BETWEEN SQUARED AND CUBED, so it also takes a per-power record — the same
     * shape `unitPer` takes, for the same reason. Amharic is the case: it borrowed the two readings from
     * different directions and its corpus writes `783,562 ስኩዌር ኪ.ሜ.` (word BEFORE) beside `120-160 ሜትር ኪዩብ`
     * (word AFTER). One value per language would have had to be wrong about one of them.
     */
    public ExponentWordsDef? ExponentWords { get; init; }
    /** See `BareExponentDef`. */
    public BareExponentDef? BareExponent { get; init; }
    /** See `MultiplyDef`. */
    public MultiplyDef? Multiply { get; init; }
    /**
     * The word for `&`, which is DROPPED outright without one — and a dropped sign is inaudible.
     *
     * 16 languages still lost it after the first symbol sweep, always in the same two corpus sentences: `B&B` and
     * `Arts & Sciences` (also `bed & breakfast`, `Qatar Airways & Turkish Airlines`). Every one of them has a
     * high-frequency conjunction to spend — und ×1135, dan ×1053, og ×1135, и ×1129, және ×561 — so this was a
     * missing CELL, not a sourcing problem.
     *
     * ⚠ SPACED ON BOTH SIDES, always. `B&B` is two initialisms and `bed&breakfast` (which pl writes glued) is
     * two words; substituting without spaces fuses them into one token, which is the merge defect
     * `review.ts`'s own probe carried for thirty-seven languages. The HTML entity is folded first, or `&amp;`
     * reads as the word plus "amp" plus a semicolon.
     *
     * NOT for a language whose conjunction is an ENCLITIC: Malayalam joins nouns with `-ഉം`, which cannot be
     * emitted as a free word, and `കൂടാതെ` means "besides", not "and". Left dropped there rather than wrong.
     */
    public string? Ampersand { get; init; }
    /**
     * THIS LANGUAGE IS WRITTEN WITHOUT SPACES BETWEEN WORDS — Chinese, Japanese.
     *
     * Set it and the boundary guards around currency keys and unit abbreviations stop treating "any letter"
     * as token-continuation and treat only a LATIN letter that way. The guards exist to stop a short key
     * biting into a word (Ukrainian `41 м\u2019яч`, Dutch `Il-76s`), a hazard that only arises inside one
     * alphabetic run; a Han or kana neighbour is a token boundary by script change and never continues a
     * Latin/symbol key. Left unset, the guard rejects the ORDINARY case in these languages — measured on cmn,
     * where `38\u2103\u5f88\u70ed` dropped the \u2103 and `\u70ba$500\uff0c` dropped the `$` while their
     * punctuation-adjacent twins worked.
     */
    public bool UnspacedScript { get; init; }
}

/**
 * The SIGN AND MATH WORDS a language reads for ± + − & = &lt; &gt; × ÷.
 *
 * ⚠ AN EXACT SHAPE RATHER THAN `Record&lt;string, string&gt;`, so the .ts side of a language cannot read a key
 * this does not name. ⚠ BUT IT DOES NOT VALIDATE THE MANIFEST: `loadManifest&lt;T&gt;` parses JSON and casts,
 * so a .jsonc that omits a key type-checks CLEANLY and the miss reaches the output as the literal string
 * "undefined" — a leak the phoneme sink cannot tell from a word. Verified, not assumed: renaming a key in
 * afrikaans.jsonc left `tsc --noEmit` green.
 * ⚠ THE ACTUAL GUARD IS test/manifest-signwords.test.ts, which asserts every manifest declaring
 * `signWords` declares the whole shape. That is what makes this safe to roll out across 70 engines.
 *
 * ⚠ THE SYMBOL TIER DOES NOT READ THIS YET. Each language's own normalize.ts applies these, because the
 * surrounding rules (which signs occur, what guards they need) are per-language. This type exists so the
 * 70 engines converge on ONE shape as they migrate — afrikaans is the first (#765).
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
        ["⁻"] = "-", // SUPERSCRIPT MINUS (U+207B) — a NEGATIVE exponent, `10⁻³¹`. Without it the whole run failed to
        //         match and `10⁻³¹` read as bare *tʰˈɛn*, sign and power both gone.
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
     * A BARE exponent — a base with no unit noun, so the unit path above has nothing to attach the power to and
     * the superscript was being dropped.
     *
     * THE BASE MAY BE DIGITS OR LETTERS, and both occur. `20²` is a number; `mc²` is not, and it is the case that
     * exposed this — `E = mc²` inside a Burmese article read as *ˈiː ɲi˨m̥ja mˈɪk*, with the `=` correctly voiced
     * and the square silently gone. Letters are matched too so the power survives even when the base is a symbol
     * the host language reads its own way. `\p{Nd}` not `\d`, because a language may write its own numerals and
     * `foldNativeDigits` is applied per engine rather than fleet-wide (see core/unicode.ts).
     */
    private static readonly JsRe BARE_EXPONENT = JsRegex.Compile(
        "(\\p{Nd}[\\p{Nd}.,]*|(?<![\\p{L}\\p{M}])[\\p{L}\\p{M}]{1,3})\\s?(" + SUPERSCRIPT_RUN + ")",
        "gu");

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
     * The form a currency noun takes after a MAGNITUDE word ("5 million dollars").
     *
     * A magnitude governs the same form a LARGE COUNT does — "5 million dollars" agrees like "5 dollars" —
     * so it is resolved by asking the language's own `countForm` for a many-count rather than by picking a
     * fixed index. The first version passed the literal 2 as a count, which for the Slavic selector means the
     * PAUCAL, so Polish read "5 milionów dolary" instead of the genitive plural. The second took the LAST
     * entry outright, which was right until a fourth form (the Slavic genitive singular, for decimals) was
     * appended and "last" stopped meaning "most plural" — it then read "5 milionów dolara". Asking countForm
     * is stable under both, because it is the language that knows.
     */
    private const double MANY = 5; // any count that selects a language's plural/genitive-plural slot

    /**
     * ⚠ AND `MANY` IS THE DEFAULT, NOT A UNIVERSAL — `magnitudeCount` overrides it per language.
     *
     * A magnitude word governs the count form of the noun after it, and for most of the fleet that form is the
     * one a large count selects, which is what `MANY` resolves through the language's own `countForm`. Maltese
     * is the counter-example and it is not an edge case: after a magnitude it takes the SINGULAR
     * (*745 miljun dollaru*), while `countForm(5)` must still return the plural for *ħames dollari*. The two
     * facts are independent, so no single constant can express both and the language has to say which.
     *
     * Declared as a COUNT rather than a slot index for the reason the call sites already give: passing a literal
     * 2 means the PAUCAL to a Slavic selector, and taking the last entry breaks the moment a fourth form is
     * appended. A count goes through `countForm` like every other number in this module.
     */
    private static string WithMagnitude(
        IReadOnlyList<string> forms,
        string? mag,
        double n,
        Func<double, int> countForm,
        double? magnitudeCount = null) =>
        Pick(forms, mag is not null && mag != "" ? magnitudeCount ?? MANY : n, countForm);

    /**
     * ⚠ ABSENT IS A DECISION; MALFORMED IS A BUG — and only a runtime check can tell them apart here.
     *
     * Every data field on `SymbolData` is optional, so "this language declines this reading" is expressible and
     * inert. The failure mode that optionality creates is the OTHER one: a field the language MEANT to declare
     * whose value arrived empty or undefined. `loadManifest<T>` parses JSON and casts, so a manifest missing a
     * key type-checks cleanly (the hazard this module's header states, and the reason
     * test/manifest-signwords.test.ts exists); `percent: [MANIFEST.symbols.percent]` then yields `[undefined]`
     * and `${w}` writes the literal word "undefined" into the phoneme stream, which no leak gate can tell from
     * a real word.
     *
     * So a declared CountForms is checked at CONSTRUCTION, where the message can name the field, rather than
     * being discovered as a TypeError several frames down inside `pick`. Undeclared costs nothing and is never
     * checked — that is the whole point of the optional fields.
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

    /** ⚠ THE DIGIT-GROUPING SEPARATORS, and this used to be a class of two ASCII spaces — a duplicated
     *  U+0020 sitting under a comment that claimed "thin/regular space grouping". The characters French,
     *  Russian and Swedish typography actually group with (U+00A0 NBSP, U+202F narrow NBSP, U+2009 thin)
     *  all fell through. Found by the C# port under the bidirectional rule in csharp/PORTING.md.
     *  Measured failure: ru `3\u2009850 км` read as *three, eight hundred fifty* — the thousand lost —
     *  while the ASCII `3 850 км` worked, which is why it stayed invisible. Shared by all five sites so
     *  they cannot drift apart again.
     *
     *  ⚠ THIS SIDE WAS THE ONE THAT STAYED BROKEN, AND A `PAIRED-FIX PENDING` MARKER IS WHY. The TS half
     *  landed in #877; the C# half kept the doubled class under a marker saying the fix belonged in the TS,
     *  where it had already happened. A stale marker is a FORK THAT DOCUMENTS ITSELF as compliance — and the
     *  parity gate cannot see it, because no golden groups a numeral with a NBSP. What did see it: a
     *  separator differential over every ported language, where sw read `1\u00a0000 km` as *mˈoʄa
     *  kilomˈita* (unit postposed) against the TS's *kilomˈita mˈoʄa* — the language declares `unitPrefix`,
     *  and the prefix path never fired because the tier did not recognise the number. */
    private const string GROUP_SP = "[ \u00a0\u202f\u2009]";
    private static readonly JsRe NUM_SPACE = JsRegex.Compile(GROUP_SP, "gu");
    private static readonly JsRe NUM_SHAPE = JsRegex.Compile("^(\\d+(?:[.,]\\d{3})*)(?:[.,](\\d+))?$");
    private static readonly JsRe NUM_SEPS = JsRegex.Compile("[.,]", "g");

    /** Leading integer value of a possibly grouped/decimal numeral string ("1,234.5" → 1234; agreement is
     *  driven by the integer part, matching how the languages themselves resolve it). A decimal number
     *  always takes the plural/genitive form (1.5 процента… — close enough; decimals are rare in prose). */
    private static double NumValue(string num)
    {
        var cleaned = NUM_SPACE.Replace(num, "");
        // Grouping separators come in 3-digit blocks; a trailing 1–2 digit block after . or , is a decimal.
        var m = NUM_SHAPE.Match(cleaned);
        if (!m.Success) return double.NaN;
        var integer = double.Parse(NUM_SEPS.Replace(m.Groups[1].Value, ""), System.Globalization.CultureInfo.InvariantCulture);
        // a real fraction ⇒ never "one" ⇒ plural
        return m.Groups[2].Success && m.Groups[2].Value.Length != 3 ? integer + 0.5 : integer;
    }

    // Space-grouping is only real grouping when the block is EXACTLY three digits (3 850 = 3850); otherwise
    // "30 9" would fuse two separate numbers and eat the association between a number and its unit.
    private const string NUM = "\\d+(?:[ \u00a0\u202f\u2009]\\d{3}(?!\\d)|[.,]\\d+)*";

    /**
     * A case-folded INDEX of a unit map. Folding the lookup STRING instead is asymmetric: it rescues
     * upper-case text against a lower-case key (`KM` → `km`) but not lower-case text against a correctly
     * capitalised one (`kw` → `kW`), so declaring SI case properly would have broken the sloppy spellings.
     * First declaration wins; the EXACT lookup runs first, so a real pair like ⟨Mb⟩/⟨MB⟩ never reaches this.
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
     * Resolve a WRITTEN unit symbol to its declared forms — the reading is a multi-step one, and these are the
     * first two steps: `kw` (sloppy shorthand) → `kW` (the unit) → "kilowatt" (the spoken word, which is the
     * caller's job).
     *
     * ⚠ STEP 1 IS A SPELLING CORRECTION AND STEP 2 IS AN IDENTIFICATION, and keeping them apart is the whole
     * point. Units are CASE-SENSITIVE, so identification is exact. Correction then rescues a miscased symbol
     * only where no other unit could be meant — which is why it is restricted to MULTI-CHARACTER symbols:
     *   · one letter is where the case contrast lives, and both members are real, different units —
     *     ⟨s⟩ second vs ⟨S⟩ siemens, ⟨t⟩ tonne vs ⟨T⟩ tesla, ⟨a⟩ are vs ⟨A⟩ ampere;
     *   · ⟨V⟩ ⟨W⟩ ⟨J⟩ ⟨N⟩ are capital because they are named after people — the lower-case forms are no unit;
     *   · and an upper-case letter need not be a unit at all: a bare ⟨M⟩ is molar, or millions, or Roman
     *     1000, or an honorific — never metres, so folding it to ⟨m⟩ would assert a reading the text does not
     *     support. Declining leaves the symbol as text, which the g2p then reads as a letter.
     *
     * ⚠ `foldSingle` LIFTS THE ONE-LETTER RESTRICTION, and only the RATE DENOMINATOR passes it. Denominators
     * are almost always one letter (h, s, u, ч), so without this `100 KM/H` resolved neither half and the
     * callback abandoned the whole match, leaking two raw abbreviations. The position is what makes it safe:
     * after the `/` of a rate, ⟨H⟩ is not plausibly henry — nobody writes kilometres per henry.
     *
     * ⚠ THE ONE-LETTER RULE ALSO HAS A REAL EXCEPTION IN THE DATA, not handled here: ⟨L⟩ and ⟨l⟩ are BOTH
     * official for the litre, so the languages that declare it declare both spellings and the exact branch
     * resolves either. The rule is about symbols whose two cases are DIFFERENT units, not about case as such.
     *
     * Returns `undefined` when neither step resolves; every caller must then leave the text ALONE rather than
     * emit half a reading — the policy this module already states for a rate with a missing noun.
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
     * IS THIS UNIT SYMBOL SAFE TO READ WHEN IT STANDS ALONE, with no number attached?
     *
     * The unit path proper only fires AFTER a numeral, which is right for `10 km` and leaves the far commoner
     * failure untouched: a bare `km` reaches the phoneme sink as raw ASCII. In a Latin-script language that leak
     * is INVISIBLE to every existing gate — DIGIT hunts digits and RAWMARK hunts punctuation, while a Latin run
     * in a Latin-script language looks exactly like a word. 50 engines leaked it while already declaring the word.
     *
     * A bare token cannot lean on an adjacent numeral for evidence, so the KEY itself has to carry it. Three
     * tests, each of them a measurement rather than a preference:
     *
     * ⚠ NEVER ONE LETTER. The standing trap: `m` collides with a Madurese locative, with `US$ 1m`, with Kirundi
     * `50 m'ubumwe`, and in Hmong RPA the final letter IS the tone. A bare `m`/`g`/`l` is left alone, and this is
     * the same rule `resolveUnitSymbol` applies for the same reason.
     *
     * ⚠ NO VOWEL, AND THAT IS THE WHOLE DISCRIMINATOR. Scanning the mined corpora for standalone occurrences of
     * every declared multi-character key, the hits split cleanly in two. The vowel-free symbols (`km` ×68, `kg`,
     * `cm`, `mm`) were units in every instance. The keys WITH a vowel were mostly ordinary words of their own
     * language: `ha` ×24 (Somali particle — *si kastaba **ha** ahaatee*; Spanish *se **ha** registrado*), `mi`
     * ×29 (Yoruba possessive — *ìmò **mi***; and `sq mi` in an English parenthetical), and the spelled-out keys
     * a few languages declare, `katao`, `kilometro`, `naninirahan` — all of them ordinary nouns. An alphabet that
     * writes its vowels does not write vowel-less words, so "no vowel" separates a symbol from a word without
     * needing a lexicon per language. `y` counts as a vowel (it is a word in Welsh).
     *
     * ⚠ LATIN SCRIPT ONLY, which is narrower than the vowel argument strictly needs and deliberately so. Khmer
     * separates words with U+200B, so its `គម` key matched INSIDE សហ​គម ("community") — in an abugida a
     * consonant-only run is a word fragment, not a symbol. And in Cyrillic the very same shape is taken:
     * Russian `см` is not only the centimetre but the standard abbreviation of *смотри* ("see"), so the test
     * would license a wrong reading there. Latin `km`/`kg`/`cm`/`mm` carry no such second life, measured.
     */
    public static bool IsBareUnitKey(string key) =>
        key.Length > 1 && BARE_KEY_LATIN.IsMatch(key) && !BARE_KEY_VOWEL.IsMatch(key);

    /**
     * THE BARE-UNIT REWRITE ITSELF — `key → the word to say when the symbol stands alone`, as a text→text pass.
     *
     * ⚠ EXPORTED, because six of the fifty engines that leak this do NOT go through `makeSymbolNormalizer`:
     * ak, bm, ht, ln, om and ro each keep a local unit table, for reasons their own headers give (ro's
     * `802.11ah` lookbehind, ht's refusal to claim `km/h`, om's noun-first order). Giving them a second,
     * hand-written copy of the guards below is how the guards drift apart; they call this instead.
     *
     * Every guard, and the measurement behind it:
     *
     * ⚠ EXACT CASE, no folding — the opposite of the digit-adjacent path, which folds `KM`→`km` because the
     * numeral in front of it has already established that a unit is meant. Alone, the upper-case forms are
     * mostly NOT units, measured across the mined corpora: `MM` is the Mercalli scale (kmr), `MI` is Michigan in
     * a bibliography (nya), `Cm` is a variable in a rendered formula (cmn), `Mi` is the Yoruba word capitalised
     * at the head of a title. The one genuine upper-case unit found fleet-wide was `$5 pa Kg` (sn) ×2 — so
     * folding would buy two readings and cost four, and `Kg` keeps leaking VISIBLY, the honest side to fail on.
     *
     * ⚠ NOT AFTER A NUMERAL, so the digit-adjacent path — correct in all 50 of these engines — keeps every match
     * it can make, and the count it computes is never overwritten by an uncounted citation form.
     * ⚠ BUT IT DOES READ SYMBOLS THAT PATH COULD NOT REACH, and that is the point rather than a side effect:
     * `10-15(-17) cm` (jv) and `2 zillion km` have a bracket or an undeclared word between the numeral and the
     * symbol. That distance is a reason not to COUNT the unit; it was never a reason to leave raw ASCII in the
     * phoneme stream. Where the digit path declines because a reading would be HALF a reading, though, this one
     * declines too — hence the `/` guard, a rate whose denominator noun the language may not declare.
     *
     * ⚠ NOT BEFORE AN EXPONENT, superscript or ASCII. `245&nbsp;km 2` (yo) is a squared kilometre written with
     * the entity in the way; reading the unit and leaving a stray "2" behind is worse than the visible leak.
     *
     * ⚠ NOT BEFORE `.` + LETTER. `km.t` is the transliterated Ancient Egyptian name of Egypt (arz) — a
     * standalone `km` by every other test, and not a kilometre. A sentence-final `km.` still reads.
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
        return text => re.Replace(text, m => map[m.Groups[1].Value]);
    }

    /** `t.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")` */
    private static readonly JsRe ESC_RE = JsRegex.Compile("[.*+?^${}()|[\\]\\\\]", "gu");
    /** The currency-key escape, which also lists `$` first — kept as its own pattern so the ports diff. */
    private static readonly JsRe ESC_CUR_RE = JsRegex.Compile("[$.*+?^${}()|[\\]\\\\]", "gu");

    private static string Esc(string t) => ESC_RE.Replace(t, "\\$&");
    private static string EscCur(string t) => ESC_CUR_RE.Replace(t, "\\$&");

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
         * ⚠ A SEPARATOR IS NOT ALWAYS `\s`. Khmer separates words with U+200B ZERO WIDTH SPACE — 33,285 occurrences
         * in its corpus, the language's most frequent pattern cell — and `\s` does not match it in JavaScript. So
         * every `\s?` below silently failed on the commonest way Khmer is written: `៣០​%` dropped its percent and
         * `$​១០០` dropped its currency, while the space-separated forms worked.
         *
         * This rides on `unspacedScript` rather than being global, because that flag already means "this language's
         * word boundaries are not spaces" — the case it was introduced for was Han, which uses no separator at all,
         * and Khmer is the same problem with a zero-width one. Widening the class can only match MORE, and a
         * zero-width space between a number and its sign is adjacency in any script that types one.
         */
        var OPT_SEP = d.UnspacedScript ? "[\\s\u200b\u200c]?" : "\\s?";
        // ⚠ LONGEST FIRST, because a shorter magnitude is often a prefix of a longer inflected one: Russian
        // declares both миллион and миллионов, and in declaration order the short form matches first and strands
        // the suffix (*пять миллион долларовов*). Same discipline as the currency keys below.
        //
        // ⚠ `\s*`, NOT `\s+` — a space before the magnitude is not universal. Chinese and Japanese are written
        // without spaces, so `1350亿m³` is the ordinary form; with `\s+` the number is not adjacent to the
        // magnitude, the match fails, and `m³` reaches the IPA as the English letter name. The group is re-emitted
        // verbatim, so it carries its own leading space or none, and can never match empty.
        // ⚠ AND WHERE ONE MAGNITUDE IS A PREFIX OF ANOTHER, IT MUST END AT A WORD BOUNDARY — because there,
        // and only there, longest-first is defeated by BACKTRACKING. Galician declares `millóns`/`millón` and
        // the one-letter unit `s` (seconds, which `m/s` needs). The engine tried `millóns`, found no unit after
        // it, fell back to `millón`, and read the stranded plural marker as the unit:
        //     `5 millóns de euros`  →  *θˈiŋko miʎˈoŋ seɣˈundos de ˈeᶷɾos*   "five million SECONDS of euros"
        // Sorting cannot prevent that; sorting fixes the ORDER the alternatives are tried in, not whether the
        // short one is tried at all once the long one fails later in the pattern. Catalan carries the identical
        // declaration and escapes only by accident of morphology — `milions`/`milió` strands `ns`, which is
        // nobody's unit key. See playbook trap 59.
        //
        // ⚠ GATED ON THE PREFIX RELATION RATHER THAN APPLIED ALWAYS, and the gate is what keeps it safe in an
        // unspaced script. A blanket "not followed by a letter" rejects the ORDINARY Chinese case, where a Latin
        // letter after a Han magnitude is a token boundary by script change and not a continuation — `1350亿m³`
        // stopped hopping its magnitude and dropped the unit. `万`/`亿` are not prefixes of each other, so the
        // hazard cannot arise there and the assertion is simply not emitted. Where it IS emitted the change is
        // narrowing-only: what it stops matching is a magnitude that ran into the middle of a word.
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
        var curKeys = d.Currency is not null
            ? string.Join("|", d.Currency.Keys.OrderByDescending(s => s.Length).Select(EscCur))
            : "";
        // ⚠ THE BOUNDARY GUARDS ASSUME SPACES BETWEEN WORDS, and Chinese and Japanese have none — so the ordinary
        // case is the one they reject (`為$500` drops the sign, `50 km²的面积` drops the exponent).
        // `unspacedScript` narrows the guard from "any letter" to "a letter that could CONTINUE this token", which
        // for a Latin/symbol key means a Latin letter; a Han neighbour is already a token boundary by script
        // change. Opt-in per language rather than global, because the guard is load-bearing where words ARE
        // spaced — it is what stops a one-letter unit biting into a word (Ukrainian `41 м’яч`).
        var wordCont = d.UnspacedScript ? "\\p{sc=Latn}" : "\\p{L}";
        /**
         * ⚠ THE MARK GUARD FOLLOWS `unspacedScript`, AND MUST. In an abugida a dependent vowel is how a word
         * ENDS, not a mid-word-only signal, so an unconditional `\p{M}` — right for Latin — drops a currency sign
         * attached to a mark-final word: Khmer `១លាន$` reads "one million dollars" but `១កោដិ$` loses the sign.
         *
         * Safe to relax here because A CURRENCY SIGN IS NOT A LETTER and cannot be the prefix of a longer word.
         * The unit path below KEEPS its trailing mark guard for exactly that reason.
         */
        var markCont = d.UnspacedScript ? "" : "\\p{M}";
        var CUR = "(?<![" + wordCont + markCont + "])(?:" + curKeys + ")(?![" + wordCont + markCont + "])";
        var curBefore = d.Currency is not null
            ? JsRegex.Compile("(" + CUR + ")" + OPT_SEP + "(" + NUM + ")" + magAlt, "gu")
            : null;
        // The magnitude is matched on BOTH sides of the number; without it on the postposed form, `5 millions $`
        // matches nothing and the sign is DROPPED. `magAlt` is `()?` when a language declares no magnitudes, so
        // the group indices stay fixed either way.
        var curAfter = d.Currency is not null
            ? JsRegex.Compile("(" + NUM + ")" + magAlt + OPT_SEP + "(" + CUR + ")", "gu")
            : null;
        // ⚠ NOTE (latent, not a defect today): unit and denominator keys are NOT regex-escaped, where currency
        // keys are. No declared key contains a metacharacter — verified across every manifest — but a key like
        // `ኪ.ሜ` would compile its `.` as "any character". Flagged in the port report; a paired fix escapes both
        // sides in the TS first.
        var unitAlt = d.Units is not null
            ? string.Join("|", d.Units.Keys.OrderByDescending(s => s.Length))
            : "";
        // Denominators may come from either map; only `units` keys are matchable standalone.
        var denomKeys = string.Join("|",
            (d.Units?.Keys ?? Enumerable.Empty<string>())
                .Concat(d.RateDenominators?.Keys ?? Enumerable.Empty<string>())
                .OrderByDescending(s => s.Length));
        // The unit may carry a RATE denominator (`km/h`) or an EXPONENT (`km²`, `km2`). Both are consumed in the
        // same match so neither is stranded after the unit word is substituted.
        //
        // ⚠ THE TRAILING GUARD REJECTS AN APOSTROPHE as well as a letter or mark. An apostrophe is neither, but it
        // is WORD-INTERNAL in several orthographies, so without it a one-letter unit key bites into a real word:
        // with `м` declared, Ukrainian `41 м’яч` ("41 balls") reads *сорок один метр’яч*. Same hazard as the
        // one-letter `rateDenominators` case — a short key that is confidently wrong beats a raw letter.
        //
        // A MAGNITUDE WORD MAY SIT BETWEEN THE NUMBER AND THE UNIT, as it may between a number and a currency
        // sign (`2,2 Millioune km²`, `2.2 miljoen km2`). Without matching `magAlt` on both sides the number is not
        // adjacent to the unit, the match fails, and the unit reaches the IPA as raw letters. The magnitude is
        // re-emitted in place — it belongs to the NUMBER, not the unit.
        //
        // ⚠ `\s?` BEFORE THE EXPONENT SITS OUTSIDE THE CAPTURE GROUP, because the callback reads groups
        // POSITIONALLY and must not shift. It is also self-limiting: on the ASCII branch the lookbehind
        // `(?<=[a-zA-Z])` then sees the SPACE rather than the unit letter, so `km 2` (a kilometre, then two) is
        // still not an exponent while `km ²` is.
        //
        // ⚠ A DOTTED DESIGNATION IS NOT A QUANTITY, AND THE SHAPE OF ONE IS NOT A RULE. `802.11g` read as
        // "802.11 GRAMS" and `802.11n` as the letter *ˈɛn*, a one-letter key matching a version suffix. The guard
        // that shipped first rejected ANY number-with-a-dot glued to exactly one trailing letter, and that shape
        // is also how the world writes a measurement.
        //
        // ⚠ MEASURED, over all 161 mined artifacts (45,306 readings), by emitting the fleet with the shape guard
        // and without it and diffing line by line: **33 readings** change. **9 are the IEEE designation**
        // (`802.11a/b/g`, one line each in ar bn cmn de el es id ja pt — the same sentence, translated) and
        // **24 are genuine measurements** that the shape guard was silently costing:
        //
        //     ary ×11  `28.000m²` `76.000m²` … airport terminal areas — and the suppressed reading is a MIS-READ,
        //              not a silence: *sˤifr sˤifr sˤifr ˈɛm skwˈɛɹd*, an English letter name inside Moroccan
        //              Arabic, where `28.000 m²` reads *mˈitr murˈabːaʕ*
        //     awa ×3   `4.5m`, `१.७०m`, `३०.०m`     lo ×1 `146.6m`   mad ×1 `1.6m`   nan ×1 `1.2m`
        //     pcm ×2   `25,000 m²`, `3.7m`          pnb ×1 `6.5m`    pt ×1 `4.892m` (Vinson Massif)
        //     rw ×1    `1,5l`                       si ×1 `69.5m`    so ×1 `1,800m`
        //
        // So the guard is anchored on the DESIGNATION instead of on the shape, which gets all 33 right. A list of
        // known designations is not a general rule and is not pretending to be one — it is the only thing that
        // separated the two populations in 45,306 readings (the shape discriminators are recorded, with their
        // rates, in the small-backlog investigation: two dot-groups matches only dates and grouped numbers; the
        // `NNN.NN` digit shape spares the 24 here by accident and would take `150.25 m` and `220.50 g`).
        //
        // ⚠ IT IS NOT WHAT KEEPS `$1.5m` FROM READING AS METRES — that was the stated reason this was left alone,
        // and it is measurably not so. The currency rule runs FIRST and consumes the number, so by the time the
        // unit pattern is tried the string is `1.5 dollarsm` and there is no number for `m` to attach to. Probed
        // with the shape guard fully removed: en `$1.5m` and `£2.3m` read exactly as they do today, unchanged.
        // The magnitude-vs-unit question (`$1.5m` = 1.5 MILLION) is real, is still open, and lives in the
        // currency path — it never depended on this guard.
        //
        // ⚠ BOTH HALVES ARE STILL NEEDED. The lookahead alone is not enough: rejected at `802`, the engine retries
        // from the FRACTIONAL part and matches `11g` on its own. The lookbehind stops a match beginning inside a
        // number; the lookahead stops one beginning at its front.
        //
        // Either decimal separator, because a designation is not localised but the text around it is (`802,11` in
        // mr and hr). Add a designation here only with the same measurement — the whole point is that this list is
        // evidence, not intuition.
        string[] DESIGNATIONS = ["802[.,]11"];
        var NOT_VERSION = "(?<![\\d.,])(?!(?:" + string.Join("|", DESIGNATIONS) + ")[a-zA-Z](?![a-zA-Z\\d]))";
        var unitRe = d.Units is not null
            ? JsRegex.Compile(
                  // ⚠ THE NUMERATOR MAY CARRY AN EXPONENT TOO, and the rate alternative used to begin at the
                  // slash — so `9,44 м³/с` matched the EXPONENT branch, ended at the ³, and left `/с` outside
                  // the match entirely, to reach the phoneme sink as a bare letter. The DENOMINATOR side
                  // already had its exponent (the `katao/km²` population-density shape); this is its twin, and
                  // it has been missing for as long as that one has existed.
                  //
                  // ⚠ MEASURED, not assumed: `[letter][²³]\s?/` occurs **26 times across 10 mined artifacts**
                  // — ba ×8, tt ×7, jv ×2, mn ×2, qu ×2, and be, cdo, chv, lo, mt ×1 each — and is essentially
                  // ONE notation, the river-discharge `м³/с` of a geography article. Of those, every language
                  // that declares a rate at all (ba, tt, jv, qu) reads the denominator after this change and
                  // none did before: ba `3510 м³/с` was *…куб метр* with a bare [s] hanging off it. The rest
                  // still drop it, and that is a per-language DATA gap (no `с`/`s` denominator declared), not
                  // this regex — be `55 м³/с` loses the unit as well, which is a Belarusian finding, not a
                  // tier one.
                  NOT_VERSION + "(" + NUM + ")" + magAltU + "\\s?(" + unitAlt + ")"
                      + "(?:\\s?(\u00b2|\u00b3|(?<=[a-zA-Z])[23](?![\\d\\p{L}]))?\\s?/\\s?(" + denomKeys + ")(\u00b2|\u00b3)?"
                      + "|\\s?(\u00b2|\u00b3|(?<=[a-zA-Z])[23](?![\\d\\p{L}])))?"
                      + "(?![" + wordCont + "\\p{M}\u0027\u2019\u02bc])",
                  "giu")
            : null;
        /**
         * THE SAME UNIT SYMBOL STANDING ALONE — a table header, a caption, a legend, a sentence that names the
         * unit without counting it. The guards live in `makeBareUnitNormalizer`; two decisions are made here:
         *
         * ⚠ NOT IN AN UNSPACED SCRIPT. There "standalone" is not a thing a pattern can see — the Khmer `គម` hit
         * that `isBareUnitKey` records was a fragment of សហ​គម, split by a zero-width space — and these languages
         * resolve their units locally in any case.
         *
         * The SINGULAR is emitted (the count form for 1) because a bare symbol is a citation, not a count.
         */
        var bareUnit = MakeBareUnitNormalizer(
            d.UnspacedScript
                ? []
                : (d.Units ?? new Dictionary<string, IReadOnlyList<string>>())
                    .Select(kv => new KeyValuePair<string, string>(kv.Key, Pick(kv.Value, 1, cf))));
        // All three percent signs: ASCII `%`, U+066A ٪ (Arabic script) and U+FF05 ％ (full-width, ordinary CJK
        // typography). Accepted here so no language has to pre-fold them locally.
        //
        // ⚠ BUILT ONLY WHEN THE LANGUAGE HAS A WORD TO SAY. Undeclared, both patterns are null and the arm below
        // never runs — the sign stays in the text where the leak gates can see it. Same shape as `curBefore` /
        // `curAfter` / `unitRe` above, and for the same reason.
        const string PCT = "[%\u066a\uff05]";
        var pctRe = d.Percent is not null ? JsRegex.Compile("(" + NUM + ")" + OPT_SEP + PCT, "gu") : null;
        // The %-before-number form (%40). The lookbehind stops a misfire after other rules run: currency turns
        // "88% $2" into "88% 2 doler", and without the guard this rule would glue "% 2" into 88's replacement.
        var pctPreRe = d.Percent is not null ? JsRegex.Compile("(?<!\\d)" + PCT + "\\s?(" + NUM + ")", "gu") : null;

        /**
         * "Does the text right AFTER the match already spell this noun?" — used to stay quiet rather than say
         * it twice. The magnitude connective may sit between, so "…millones de dólares" counts as already
         * said. Shared by currency and percent: the guard was currency-only at first and Malayalam's
         * `93% ശതമാനം` read as *ശതമാനം ശതമാനം*.
         */
        JsRe SaidAfter(IReadOnlyList<string> forms)
        {
            var conn = d.MagnitudeConnective is null ? "" : "(?:" + Esc(d.MagnitudeConnective) + "[ \u00a0\u202f\u2009]+)?";
            // ⚠ CASE-INSENSITIVE. Running text capitalises the currency noun (English style capitalises it after
            // a sign), and a case-sensitive guard let it through TWICE: pcm's own sourcing sentence,
            // "$12.4 Billion Dolla", read *…biljan dola dola*. Suppression only — emission is unaffected, so a
            // language whose word this matches still emits its own declared form.
            return JsRegex.Compile("^[ \u00a0\u202f\u2009]*" + conn + "(?:" + string.Join("|", forms.Select(Esc)) + ")", "iu");
        }
        /** The mirror, for a PREFIX word: Turkish `yüzde 40%` was reading *yüzde yüzde kırk*. */
        JsRe SaidBefore(IReadOnlyList<string> forms) =>
            JsRegex.Compile("(?:" + string.Join("|", forms.Select(Esc)) + ")[ \u00a0\u202f\u2009]*$", "iu");
        var PCT_AFTER = d.Percent is not null ? SaidAfter(d.Percent) : null;
        var PCT_BEFORE = d.Percent is not null ? SaidBefore(d.Percent) : null;

        return text =>
        {
            // THE AMPERSAND FIRST, and spaced — see `ampersand`. Before every other rule because a `&` between
            // two initialisms (`B&B`) must become three tokens, and any later rule that reads a token boundary
            // needs the split to have happened already.
            if (d.Ampersand is not null)
                text = AMP_SIGN.Replace(AMP_ENTITY.Replace(text, "&"), " " + d.Ampersand + " ");
            var s = text;
            // "cinco millones DE dólares" — emitted only when a magnitude was actually matched.
            string Join(string? mag) =>
                mag is not null && mag != "" && d.MagnitudeConnective is not null ? d.MagnitudeConnective + " " : "";
            // Both orders emit through one shape so the magnitude and its connective travel with the number
            // whichever side the noun goes on.
            //
            // `rest` is the text immediately after the whole match. When it ALREADY spells the currency noun
            // the sign is redundant and emitting the word again doubles it: `$1000 dollar` read as
            // "1000 dollar dollar", and `$45 million dollars` as "45 dollar million dollars" — the word
            // inserted before the magnitude while the written one stayed put. Reported by the Nepali run,
            // whose corpus writes `$1000 डलर`.
            string Money(string num, string? mag, string sym, string rest)
            {
                var forms = d.Currency![sym];
                var already = SaidAfter(forms);
                var body = num + (mag ?? "");
                if (already.IsMatch(rest)) return body; // the text says it; do not say it twice
                var w = WithMagnitude(forms, mag, NumValue(num), cf, d.MagnitudeCount);
                /**
                 * ⚠ THE EMITTED NOUN MUST NOT FUSE WITH WHATEVER FOLLOWS. `$110m` is a number glued to a
                 * MAGNITUDE ABBREVIATION, and the match ends at the digits — so the currency noun landed directly
                 * against the `m` and the tokenizer read ONE word: et *dˈolːɑritm*, fi *dolːɑriɑm*, de *dˈɔlaɐ̯m*,
                 * es *dˈolaɾesm*, nl/sv/pt/it/pl/da the same. Ten of the eleven languages probed; English escapes
                 * only because its own layer reads `m` as *million* before the tier runs.
                 *
                 * That is trap 56 — a defect that produces a READING rather than garbage. `dollaritm` is a
                 * plausible-looking word in every one of those orthographies, so no leak class, no DROP and no
                 * referee can see it, while a bare `m` is visible to the RAW-LATIN gate the moment it appears.
                 *
                 * ⚠ SEPARATE, DO NOT REFUSE, and the difference is a whole reading. Refusing the match would drop
                 * the sign as well, losing the currency; separating keeps *110 dollars* — which is right as far as
                 * it goes — and leaves the unread magnitude letter where a gate can find it. Reading the magnitude
                 * is a language's own job (`magnitudes`), not something this tier can invent from one letter.
                 */
                var fuses = FUSES.IsMatch(rest);
                var tail = fuses ? " " : "";
                return d.CurrencyPrefix
                    ? WS_RUN.Replace(w + (mag ?? "") + " " + Join(mag) + num + tail, " ")
                    : body + " " + Join(mag) + w + tail;
            }
            if (curBefore is not null)
            {
                var full = s;
                s = curBefore.Replace(full, m => Money(
                    m.Groups[2].Value,
                    m.Groups[3].Success ? m.Groups[3].Value : null,
                    m.Groups[1].Value,
                    full[(m.Index + m.Length)..]));
            }
            if (curAfter is not null)
            {
                var full = s;
                s = curAfter.Replace(full, m => Money(
                    m.Groups[1].Value,
                    m.Groups[2].Success ? m.Groups[2].Value : null,
                    m.Groups[3].Value,
                    full[(m.Index + m.Length)..]));
            }
            // The percent word is suppressed when the text already carries it — on whichever side this
            // language puts it. `93% ശതമാനം` doubled the suffix; `yüzde 40%` doubled the prefix.
            //
            // ⚠ AND THE WHOLE ARM IS SKIPPED WHEN THE LANGUAGE DECLARES NO PERCENT WORD — not run with an empty
            // one. Emitting `${num} ` for a missing word would leave a trailing space and DELETE the sign; the
            // `%` is left in place instead, which is the visible failure the DROP gate counts.
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
                s = pctPreRe.Replace(pre, m => Pct(m.Groups[1].Value, m.Index, pre, m.Length));
                var post = s;
                s = pctRe.Replace(post, m => Pct(m.Groups[1].Value, m.Index, post, m.Length));
            }
            // THE MULTIPLICATION SIGN, both `×` and ASCII `x` — BEFORE the unit path, and that ordering is load-bearing.
            // Placed after it, a `unitPrefix` language broke: Swahili's unit path MOVES the noun ahead of its number,
            // so `6x6 cm` became *sita KS sentimita sita* — the pattern no longer had a digit after the sign and the
            // `x` fell through to the letter reading. Running first also makes the dimension test easier rather than
            // harder: the unit is still an ABBREVIATION here, so "is a unit coming?" is just "digit then letters",
            // and no reordering has happened. The unit path still finds its number adjacent — `6 per 6 cm` keeps
            // `6 cm` together.
            if (d.Multiply is not null)
            {
                var mul = d.Multiply;
                var by = mul.By ?? mul.Times;
                var full = s;
                s = MUL_RE.Replace(full, m =>
                {
                    var whole = m.Value;
                    var left = m.Groups[1].Value;
                    var sign = m.Groups[2].Value;
                    // A UNIT after the right operand makes it a measurement; an UNSPACED ascii `x` is the
                    // `4x4`/`6x6` format idiom. `\s*` in the pattern means the spacing test has to read the source.
                    var spaced = MUL_SPACED.IsMatch(whole);
                    var tail = full[(m.Index + whole.Length)..];
                    var hasUnit = MUL_HAS_UNIT.IsMatch(tail);
                    var word = hasUnit || (sign == "x" && !spaced) ? by : mul.Times;
                    return left + " " + word + " ";
                });
            }

            if (unitRe is not null)
                s = unitRe.Replace(s, m =>
                {
                    var whole = m.Value;
                    var num = m.Groups[1].Value;
                    var mag = m.Groups[2].Success ? m.Groups[2].Value : null;
                    var u = m.Groups[3].Value;
                    var numExp = m.Groups[4].Success ? m.Groups[4].Value : null;
                    var denom = m.Groups[5].Success ? m.Groups[5].Value : null;
                    var denomExp = m.Groups[6].Success ? m.Groups[6].Value : null;
                    var exp = m.Groups[7].Success ? m.Groups[7].Value : null;
                    // The magnitude travels with the NUMBER and is re-emitted verbatim — ⚠ a rule that
                    // CONSUMES a word must put it back. It also governs the count form the way a LARGE COUNT
                    // does, resolved through the language's own `countForm` via MANY — the same reasoning, and
                    // the same constant, that `withMagnitude` uses for the currency side, and for the same
                    // reason: passing a literal 2 means the PAUCAL to a Slavic selector, and taking the last
                    // entry breaks as soon as a fourth form is appended.
                    var hasMag = mag is not null && mag != "";
                    var q = hasMag ? num + mag : num;
                    var n = hasMag ? d.MagnitudeCount ?? MANY : NumValue(num);
                    // Correct-then-identify; see resolveUnitSymbol. A miss leaves the text alone — before
                    // #763 this was `units[u.toLowerCase()]!`, and the assertion turned an unreachable
                    // uppercase key into a THROW from inside pick().
                    var forms = ResolveUnitSymbol(d.Units, unitsFolded, u);
                    if (forms is null) return whole;
                    var head = Pick(forms, n, cf);
                    /** Attach a measure word to one side of a rate. Shared by the numerator and the
                     *  denominator, which take the same treatment for the same reason: an exponent
                     *  the language has no word for is re-emitted so the leak gate can see it, and
                     *  never abandons the match. The SINGULAR form is used on both sides — inside a
                     *  rate neither noun is what the quantity counts. */
                    string WithPower(string noun, string sup)
                    {
                        var power = sup == "\u00b3" ? "cubed" : "squared";
                        var eForms = d.ExponentWords?[power];
                        if (eForms is null) return noun + sup;
                        var ew = eForms[0];
                        var ePos = d.ExponentWords?.Position?.For(power) ?? "after";
                        return ePos == "compound" ? ew + noun
                            : ePos == "suffix" ? noun + ew
                            : ePos == "before" ? ew + " " + noun
                            : noun + " " + ew;
                    }
                    if (denom is not null)
                    {
                        // A rate needs both nouns and the connective; without any of them leave the text
                        // alone rather than emit half a reading.
                        // Same exact-then-folded resolution as the head unit, and for the same reason:
                        // ⟨h⟩ hour and ⟨H⟩ henry are different units.
                        // Same two steps as the head, but folding is allowed for a ONE-letter denominator
                        // too (see resolveUnitSymbol): the slash position rules out the other reading, and
                        // without it `100 KM/H` resolved neither half and dropped the head unit as well.
                        var dl = denom.ToLowerInvariant();
                        var dUnit = ResolveUnitSymbol(d.Units, unitsFolded, denom, true);
                        var dWord = (dUnit is not null && dUnit.Count > 0 ? dUnit[0] : null)
                            ?? ResolveUnitSymbol(d.RateDenominators, denomFolded, denom, true);
                        var per = d.UnitPer?.For(denom, dl);
                        if (per is null || dWord is null) return whole;
                        // ⚠ THE DENOMINATOR MAY CARRY AN EXPONENT — ⟨20,164 katao/km²⟩, the population-density
                        // shape. The rate alternative used to end at the denominator key, so the ² fell outside
                        // the match and was silently dropped (tl's largest exponent class, 13 of 35). Composed
                        // only when the language declares `exponentWords`; otherwise the old reading stands and
                        // the superscript is re-emitted where the leak gate can see it, as the head branch does.
                        var dPhrase = dWord;
                        if (denomExp is not null) dPhrase = WithPower(dPhrase, denomExp);
                        // ⚠ AND THE NUMERATOR TAKES IT TOO — `9,44 м³/с`, the river-discharge shape, which
                        // used to leave `/с` outside the match entirely. See the regex comment above.
                        var headPhrase = numExp is null ? head : WithPower(head, numExp);
                        // `unitPrefix` applies here too, and forgetting it left Swahili reading
                        // "160 kilomita kwa saa" where the language writes the measure noun first. The rate is
                        // one phrase, so the whole of it hinges on the head noun's position.
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
                            // ⚠ NO MEASURE WORD DECLARED — emit the UNIT and hand the exponent back rather than
                            // abandoning the match. Returning `whole` loses the QUANTITY too, not just its power:
                            // the abbreviation reaches the phoneme sink verbatim. Re-emitting the exponent keeps
                            // the unit's reading and leaves `²` where the leak gate can see it, turning an
                            // invisible missing reading into a visible missing WORD in one language's data.
                            return q + " " + head + exp;
                        }
                        // Count forms, because in Romance the measure word is an ADJECTIVE and agrees:
                        // "un kilómetro cuadrado" vs "cincuenta kilómetros cuadrados".
                        var word = Pick(eForms, n, cf);
                        var pos = d.ExponentWords?.Position?.For(power) ?? "after";
                        // ⚠ The unit PHRASE is assembled first and the quantity placed around it, because
                        // `unitPrefix` governs the exponent reading exactly as it governs the plain one — Oromo
                        // writes `iskuweer kiloometiiri 783,562`, noun phrase THEN number. Building the return
                        // per-position instead silently ignores `unitPrefix` on this branch.
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
            // standing here has no numeral of its own, which is the case `bareUnitKeys` describes.
            s = bareUnit(s);

            // A BARE EXPONENT, LAST — after the unit path, which must have its chance first or this would steal
            // every `km²` and read it as "kilometre squared" instead of "square kilometres". By the time control
            // reaches here a surviving superscript has no unit to modify, which is exactly the case `bareExponent`
            // describes. Undeclared, nothing changes and the character stays where the RAWMARK leak gate can see
            // it — the same choice the unit branch makes for a missing measure word, and for the same reason: a
            // visible gap in one language's data beats an invisible missing reading.
            if (d.BareExponent is not null)
            {
                var be = d.BareExponent;
                s = BARE_EXPONENT.Replace(s, m =>
                {
                    var whole = m.Value;
                    var baseText = m.Groups[1].Value;
                    var sup = m.Groups[2].Value;
                    var digits = new StringBuilder();
                    foreach (var c in Js.CodePoints(sup)) digits.Append(SUPERSCRIPT[c]);
                    // `2` and `3` have their own words in every language that has any; everything else — including
                    // `1`, `0` and a multi-digit power — goes through the generic form. `¹` is deliberately NOT
                    // special-cased to "to the power of one": it is vanishingly rare and reading it plainly is
                    // correct, where inventing "itself" would not be.
                    var digitStr = digits.ToString();
                    var neg = digitStr.StartsWith('-');
                    var mag = neg ? digitStr[1..] : digitStr;
                    // A NEGATIVE exponent always takes the generic `power` form: no language has a word for
                    // "negative squared", and `10⁻²` is "to the power of minus two", not "minus squared".
                    var tpl = neg ? be.Power : mag == "2" ? be.Squared : mag == "3" ? be.Cubed : be.Power;
                    if (tpl is null) return whole; // this language declares only some powers
                    if (neg && be.Negative is null) return whole; // sign unreadable → leave it visible
                    var exponent = neg ? be.Negative + " " + mag : mag;
                    return TPL_E.Replace(TPL_N.Replace(tpl, baseText), exponent);
                });
            }
            return s;
        };
    }
}
