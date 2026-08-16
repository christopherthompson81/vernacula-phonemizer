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

/** Word forms for one countable noun. Index 0 = singular; further indices per the language's
 *  `countForm`. A language with no agreement uses a 1-element array. */
export type CountForms = string[];

/** Superscript digits → ASCII, so the exponent reaches the engine's number path as a readable numeral. */
const SUPERSCRIPT: Readonly<Record<string, string>> = {
    "⁻": "-", // SUPERSCRIPT MINUS (U+207B) — a NEGATIVE exponent, `10⁻³¹`. Without it the whole run failed to
    //         match and `10⁻³¹` read as bare *tʰˈɛn*, sign and power both gone.
    "⁰": "0",
    "¹": "1",
    "²": "2",
    "³": "3",
    "⁴": "4",
    "⁵": "5",
    "⁶": "6",
    "⁷": "7",
    "⁸": "8",
    "⁹": "9",
};
const SUPERSCRIPT_RUN = `[${Object.keys(SUPERSCRIPT).join("")}]+`;

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
const BARE_EXPONENT = new RegExp(
    `(\\p{Nd}[\\p{Nd}.,]*|(?<![\\p{L}\\p{M}])[\\p{L}\\p{M}]{1,3})\\s?(${SUPERSCRIPT_RUN})`,
    "gu",
);

/** Where a language puts the squared/cubed measure word relative to the unit noun. See `exponentWords`. */
export type ExponentPosition = "before" | "after" | "compound" | "suffix";

export interface SymbolData {
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
    percent?: CountForms;
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
     */
    currency?: Record<string, CountForms>;
    /** Unit abbreviation (lowercase) → count forms. Matched only AFTER a number. */
    units?: Record<string, CountForms>;
    /** Magnitude words that hop with a currency sign ("million" etc., in the language's spelling as it
     *  appears in running text). Omit if the language writes magnitudes after the currency word anyway. */
    magnitudes?: string[];
    /**
     * The COUNT whose form a magnitude word selects for the noun after it. Defaults to `MANY` (5), i.e. the
     * slot a large count takes — right for most of the fleet. Declare it when the language disagrees:
     * Maltese takes the SINGULAR after a magnitude (*745 miljun dollaru*) while still needing the plural for
     * *ħames dollari*, so it declares a count its own `countForm` maps to the singular. See `MANY`.
     */
    magnitudeCount?: number;
    /** The word joining a magnitude to the currency noun: Spanish/Portuguese/French/Catalan "de", Italian
     *  "di" — *cinco millones **de** dólares*. Omit for the languages that take none (German "fünf
     *  Millionen Dollar", Swedish "fem miljoner dollar"). Only ever emitted when a magnitude was matched,
     *  so a bare "$5" is unaffected — without it, es/pt/fr/ca read *cinco millones dólares*. */
    magnitudeConnective?: string;
    /** n → index into a CountForms array. Default: n===1 → 0, else last index. Override for Slavic. */
    countForm?: (n: number) => number;
    /** The percent word PRECEDES the number (Turkish yüzde kırk, Mandarin 百分之四十). Text may write the
     *  sign on either side (%40 or 40%); both rewrite to prefix order. */
    percentPrefix?: boolean;
    /**
     * The currency noun PRECEDES the number — Swahili "dola 30", where the tier's default is to emit it
     * after. The magnitude and its connective, if any, stay with the number: "dola milioni 5".
     */
    currencyPrefix?: boolean;
    /**
     * The UNIT noun precedes the number — Swahili writes *kilomita 19,500*, *mita 100*, the mirror of the
     * `currencyPrefix` case and for the same reason (a measure noun heads its phrase in Bantu).
     *
     * ⚠ Opt-in rather than inferred from `currencyPrefix`: the two orders are independent, and a language
     * may want one without the other.
     */
    unitPrefix?: boolean;
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
    unitPer?: string | Readonly<Record<string, string>>;
    /**
     * Nouns available ONLY as a rate DENOMINATOR — `h`, `u`, `s` — never matched as a standalone unit.
     *
     * ⚠ Declaring `s` in `units` so `m/s` can compose ALSO makes a bare `76s` match, turning `Il-76s` (an
     * aircraft, plural) into *zesenzeventig seconde* — confidently wrong, and worse than the raw letter it
     * replaced. One-letter denominators collide with plural-s and with alphanumeric designations, so they
     * stay out of the standalone alternation entirely.
     */
    rateDenominators?: Record<string, string>;
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
    exponentWords?: {
        squared?: CountForms;
        cubed?: CountForms;
        position?: ExponentPosition | Readonly<Partial<Record<"squared" | "cubed", ExponentPosition>>>;
    };
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
    bareExponent?: {
        squared?: string;
        cubed?: string;
        power?: string;
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
        negative?: string;
    };
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
    multiply?: {
        times: string;
        by?: string;
    };
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
    ampersand?: string;
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
    unspacedScript?: boolean;
}

const defaultCountForm = (n: number): number => (n === 1 ? 0 : 1);

/** The Slavic three-way selector (ru, cs): 1→0 (sg), 2–4→1 (paucal), else→2 — keyed on the final
 *  digits, with 11–14 always plural (21 процент, 22 процента, 25 процентов, 12 процентов). */
export const slavicCountForm = (n: number): number => {
    const mod100 = Math.abs(n) % 100;
    const mod10 = mod100 % 10;
    if (mod100 >= 11 && mod100 <= 14) return 2;
    if (mod10 === 1) return 0;
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
const MANY = 5; // any count that selects a language's plural/genitive-plural slot

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
function withMagnitude(
    forms: CountForms,
    mag: string | undefined,
    n: number,
    countForm: (n: number) => number,
    magnitudeCount: number = MANY,
): string {
    return pick(forms, mag !== undefined && mag !== "" ? magnitudeCount : n, countForm);
}

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
function assertForms(field: string, forms: CountForms): void {
    const bad =
        !Array.isArray(forms) || forms.length === 0 || forms.some((w) => typeof w !== "string" || w === "");
    if (bad)
        throw new Error(
            `SymbolData.${field}: declared, but not a non-empty list of non-empty words (got ${JSON.stringify(forms)}). ` +
                `Omit the field entirely if this language has no word to say; do not declare an empty one.`,
        );
}

function pick(forms: CountForms, n: number, countForm: (n: number) => number): string {
    const i = Math.min(countForm(n), forms.length - 1);
    return forms[Math.max(0, i)]!;
}

/** Leading integer value of a possibly grouped/decimal numeral string ("1,234.5" → 1234; agreement is
 *  driven by the integer part, matching how the languages themselves resolve it). A decimal number
 *  always takes the plural/genitive form (1.5 процента… — close enough; decimals are rare in prose). */
function numValue(num: string): number {
    const cleaned = num.replace(/[  ]/gu, ""); // thin/regular space grouping
    // Grouping separators come in 3-digit blocks; a trailing 1–2 digit block after . or , is a decimal.
    const m = /^(\d+(?:[.,]\d{3})*)(?:[.,](\d+))?$/.exec(cleaned);
    if (!m) return NaN;
    const int = Number(m[1]!.replace(/[.,]/g, ""));
    return m[2] !== undefined && m[2].length !== 3 ? int + 0.5 : int; // a real fraction ⇒ never "one" ⇒ plural
}

// Space-grouping is only real grouping when the block is EXACTLY three digits (3 850 = 3850); otherwise
// "30 9" would fuse two separate numbers and eat the association between a number and its unit.
const NUM = "\\d+(?:[  ]\\d{3}(?!\\d)|[.,]\\d+)*";

/** Build the text→text symbol normalizer for one language's data. */
/**
 * A case-folded INDEX of a unit map. Folding the lookup STRING instead is asymmetric: it rescues
 * upper-case text against a lower-case key (`KM` → `km`) but not lower-case text against a correctly
 * capitalised one (`kw` → `kW`), so declaring SI case properly would have broken the sloppy spellings.
 * First declaration wins; the EXACT lookup runs first, so a real pair like ⟨Mb⟩/⟨MB⟩ never reaches this.
 */
function foldedIndex<V>(map: Record<string, V> | undefined): Record<string, V> {
    const out: Record<string, V> = {};
    for (const [k, v] of Object.entries(map ?? {})) {
        const lk = k.toLowerCase();
        if (!(lk in out)) out[lk] = v;
    }
    return out;
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
export function resolveUnitSymbol<V>(
    declared: Record<string, V> | undefined,
    folded: Record<string, V>,
    written: string,
    foldSingle = false,
): V | undefined {
    if (declared?.[written] !== undefined) return declared[written];
    return written.length > 1 || foldSingle ? folded[written.toLowerCase()] : undefined;
}

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
export function isBareUnitKey(key: string): boolean {
    return key.length > 1 && /^[A-Za-z]+$/u.test(key) && !/[aeiouy]/iu.test(key);
}

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
export function makeBareUnitNormalizer(
    readings: Iterable<readonly [string, string]>,
): (text: string) => string {
    const map = new Map([...readings].filter(([k]) => isBareUnitKey(k)));
    if (map.size === 0) return (text) => text;
    const keys = [...map.keys()].sort((a, b) => b.length - a.length);
    const re = new RegExp(
        `(?<![\\p{L}\\p{M}\\p{Nd}'’ʼ/-])(?<!\\p{Nd}\\s)(${keys.join("|")})` +
            `(?![\\p{L}\\p{M}\\p{Nd}'’ʼ/²³-])(?!\\.\\p{L})(?!\\s?[23](?![\\d\\p{L}]))`,
        "gu",
    );
    return (text: string): string => text.replace(re, (_whole: string, u: string) => map.get(u)!);
}

/**
 * The SIGN AND MATH WORDS a language reads for ± + − & = < > × ÷.
 *
 * ⚠ AN EXACT SHAPE RATHER THAN `Record<string, string>`, so the .ts side of a language cannot read a key
 * this does not name. ⚠ BUT IT DOES NOT VALIDATE THE MANIFEST: `loadManifest<T>` parses JSON and casts,
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
export interface SignWords {
    /** ± — ⚠ ONE code point (U+00B1), so no ⟨+⟩ rule can reach inside it; without an entry it vanishes. */
    plusMinus: string;
    plus: string;
    minus: string;
    /** ⟨&⟩ — the ordinary word for "and". */
    ampersand: string;
    equals: string;
    lessThan: string;
    greaterThan: string;
    times: string;
    dividedBy: string;
}

export function makeSymbolNormalizer(d: SymbolData): (text: string) => string {
    // Validate what IS declared, before any of it is compiled into a pattern. See `assertForms`.
    if (d.percent !== undefined) assertForms("percent", d.percent);
    for (const [k, forms] of Object.entries(d.currency ?? {})) assertForms(`currency[${k}]`, forms);
    for (const [k, forms] of Object.entries(d.units ?? {})) assertForms(`units[${k}]`, forms);
    for (const p of ["squared", "cubed"] as const)
        if (d.exponentWords?.[p] !== undefined) assertForms(`exponentWords.${p}`, d.exponentWords[p]);
    const cf = d.countForm ?? defaultCountForm;
    const unitsFolded = foldedIndex(d.units);
    const denomFolded = foldedIndex(d.rateDenominators);
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
    const OPT_SEP = d.unspacedScript ? "[\\s\u200b\u200c]?" : "\\s?";
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
    const magList = d.magnitudes ?? [];
    const magPrefixHazard = magList.some((a) => magList.some((b) => b !== a && b.startsWith(a)));
    const MAG_END = magPrefixHazard ? "(?![\\p{L}\\p{M}])" : "";
    const magAlt = d.magnitudes?.length
        ? `(\\s*(?:${[...d.magnitudes].sort((a, b) => b.length - a.length).join("|")})${MAG_END})?`
        : "()?";
    // For the UNIT path the magnitude may be followed by its connective, already present in the text
    // (`2,2 milions de km²`): two words separate the number from the unit, breaking the adjacency this tier
    // matches on.
    // ⚠ Kept OUT of the currency path deliberately — there the connective is GENERATED by `join()`, so
    // consuming one that is already present would produce a second. Here it is consumed inside the
    // magnitude's own capture group and re-emitted by the callback.
    const magAltU =
        d.magnitudes?.length && d.magnitudeConnective !== undefined
            ? `(\\s*(?:${[...d.magnitudes].sort((a, b) => b.length - a.length).join("|")})${MAG_END}(?:\\s+${d.magnitudeConnective.replace(
                  /[.*+?^${}()|[\]\\]/gu,
                  "\\$&",
              )})?)?`
            : magAlt;
    // Currency keys are an ALTERNATION, not a character class: a class holds only single characters, which
    // would exclude letter-code currencies (`zł`, `PLN`, `USD`). Longest first so a two-letter code is not
    // shadowed by a one-letter one, and letter-bounded on both sides so a bare code cannot match inside a word.
    const curKeys = d.currency
        ? Object.keys(d.currency)
              .sort((a, b) => b.length - a.length)
              .map((s) => s.replace(/[$.*+?^${}()|[\]\\]/gu, "\\$&"))
              .join("|")
        : "";
    // ⚠ THE BOUNDARY GUARDS ASSUME SPACES BETWEEN WORDS, and Chinese and Japanese have none — so the ordinary
    // case is the one they reject (`為$500` drops the sign, `50 km²的面积` drops the exponent).
    // `unspacedScript` narrows the guard from "any letter" to "a letter that could CONTINUE this token", which
    // for a Latin/symbol key means a Latin letter; a Han neighbour is already a token boundary by script
    // change. Opt-in per language rather than global, because the guard is load-bearing where words ARE
    // spaced — it is what stops a one-letter unit biting into a word (Ukrainian `41 м’яч`).
    const wordCont = d.unspacedScript ? "\\p{sc=Latn}" : "\\p{L}";
    /**
     * ⚠ THE MARK GUARD FOLLOWS `unspacedScript`, AND MUST. In an abugida a dependent vowel is how a word
     * ENDS, not a mid-word-only signal, so an unconditional `\p{M}` — right for Latin — drops a currency sign
     * attached to a mark-final word: Khmer `១លាន$` reads "one million dollars" but `១កោដិ$` loses the sign.
     *
     * Safe to relax here because A CURRENCY SIGN IS NOT A LETTER and cannot be the prefix of a longer word.
     * The unit path below KEEPS its trailing mark guard for exactly that reason.
     */
    const markCont = d.unspacedScript ? "" : "\\p{M}";
    const CUR = `(?<![${wordCont}${markCont}])(?:${curKeys})(?![${wordCont}${markCont}])`;
    const curBefore = d.currency ? new RegExp(`(${CUR})${OPT_SEP}(${NUM})${magAlt}`, "gu") : null;
    // The magnitude is matched on BOTH sides of the number; without it on the postposed form, `5 millions $`
    // matches nothing and the sign is DROPPED. `magAlt` is `()?` when a language declares no magnitudes, so
    // the group indices stay fixed either way.
    const curAfter = d.currency ? new RegExp(`(${NUM})${magAlt}${OPT_SEP}(${CUR})`, "gu") : null;
    const unitAlt = d.units
        ? Object.keys(d.units)
              .sort((a, b) => b.length - a.length)
              .join("|")
        : "";
    // Denominators may come from either map; only `units` keys are matchable standalone.
    const denomKeys = [...Object.keys(d.units ?? {}), ...Object.keys(d.rateDenominators ?? {})]
        .sort((a, b) => b.length - a.length)
        .join("|");
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
    const DESIGNATIONS = ["802[.,]11"];
    const NOT_VERSION = `(?<![\\d.,])(?!(?:${DESIGNATIONS.join("|")})[a-zA-Z](?![a-zA-Z\\d]))`;
    const unitRe = d.units
        ? new RegExp(
              `${NOT_VERSION}(${NUM})${magAltU}\\s?(${unitAlt})(?:\\s?/\\s?(${denomKeys})(\u00b2|\u00b3)?|\\s?(\u00b2|\u00b3|(?<=[a-zA-Z])[23](?![\\d\\p{L}])))?(?![${wordCont}\\p{M}\u0027\u2019\u02bc])`,
              "giu",
          )
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
    const bareUnit = makeBareUnitNormalizer(
        d.unspacedScript === true
            ? []
            : Object.entries(d.units ?? {}).map(([k, forms]) => [k, pick(forms, 1, cf)] as const),
    );
    // All three percent signs: ASCII `%`, U+066A ٪ (Arabic script) and U+FF05 ％ (full-width, ordinary CJK
    // typography). Accepted here so no language has to pre-fold them locally.
    //
    // \u26a0 BUILT ONLY WHEN THE LANGUAGE HAS A WORD TO SAY. Undeclared, both patterns are null and the arm below
    // never runs \u2014 the sign stays in the text where the leak gates can see it. Same shape as `curBefore` /
    // `curAfter` / `unitRe` above, and for the same reason.
    const PCT = "[%\u066a\uff05]";
    const pctRe = d.percent ? new RegExp(`(${NUM})${OPT_SEP}${PCT}`, "gu") : null;
    // The %-before-number form (%40). The lookbehind stops a misfire after other rules run: currency turns
    // "88% $2" into "88% 2 doler", and without the guard this rule would glue "% 2" into 88's replacement.
    const pctPreRe = d.percent ? new RegExp(`(?<!\\d)${PCT}\\s?(${NUM})`, "gu") : null;

    const esc = (t: string): string => t.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
    /**
     * "Does the text right AFTER the match already spell this noun?" — used to stay quiet rather than say
     * it twice. The magnitude connective may sit between, so "…millones de dólares" counts as already
     * said. Shared by currency and percent: the guard was currency-only at first and Malayalam's
     * `93% ശതമാനം` read as *ശതമാനം ശതമാനം*.
     */
    const saidAfter = (forms: CountForms): RegExp => {
        const conn = d.magnitudeConnective === undefined ? "" : `(?:${esc(d.magnitudeConnective)}[  ]+)?`;
        // ⚠ CASE-INSENSITIVE. Running text capitalises the currency noun (English style capitalises it after
        // a sign), and a case-sensitive guard let it through TWICE: pcm's own sourcing sentence,
        // "$12.4 Billion Dolla", read *…biljan dola dola*. Suppression only — emission is unaffected, so a
        // language whose word this matches still emits its own declared form.
        return new RegExp(`^[  ]*${conn}(?:${forms.map(esc).join("|")})`, "iu");
    };
    /** The mirror, for a PREFIX word: Turkish `yüzde 40%` was reading *yüzde yüzde kırk*. */
    const saidBefore = (forms: CountForms): RegExp => new RegExp(`(?:${forms.map(esc).join("|")})[  ]*$`, "iu");
    const PCT_AFTER = d.percent ? saidAfter(d.percent) : null;
    const PCT_BEFORE = d.percent ? saidBefore(d.percent) : null;

    return (text: string): string => {
        // THE AMPERSAND FIRST, and spaced — see `ampersand`. Before every other rule because a `&` between
        // two initialisms (`B&B`) must become three tokens, and any later rule that reads a token boundary
        // needs the split to have happened already.
        if (d.ampersand !== undefined)
            text = text.replace(/&amp;/giu, "&").replace(/[ \t]*[&\uff06][ \t]*/gu, ` ${d.ampersand} `);
        let s = text;
        // "cinco millones DE dólares" — emitted only when a magnitude was actually matched.
        const join = (mag: string | undefined): string =>
            mag !== undefined && mag !== "" && d.magnitudeConnective !== undefined ? `${d.magnitudeConnective} ` : "";
        // Both orders emit through one shape so the magnitude and its connective travel with the number
        // whichever side the noun goes on.
        //
        // `rest` is the text immediately after the whole match. When it ALREADY spells the currency noun
        // the sign is redundant and emitting the word again doubles it: `$1000 dollar` read as
        // "1000 dollar dollar", and `$45 million dollars` as "45 dollar million dollars" — the word
        // inserted before the magnitude while the written one stayed put. Reported by the Nepali run,
        // whose corpus writes `$1000 डलर`.
        const money = (num: string, mag: string | undefined, sym: string, rest: string): string => {
            const forms = d.currency![sym]!;
            const already = saidAfter(forms);
            const body = `${num}${mag ?? ""}`;
            if (already.test(rest)) return body; // the text says it; do not say it twice
            const w = withMagnitude(forms, mag, numValue(num), cf, d.magnitudeCount);
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
            const fuses = /^[\p{L}\p{M}]/u.test(rest);
            const tail = fuses ? " " : "";
            return d.currencyPrefix
                ? `${w}${mag ?? ""} ${join(mag)}${num}${tail}`.replace(/\s+/gu, " ")
                : `${body} ${join(mag)}${w}${tail}`;
        };
        if (curBefore)
            s = s.replace(
                curBefore,
                (m: string, sym: string, num: string, mag: string | undefined, offset: number, full: string) =>
                    money(num, mag, sym, full.slice(offset + m.length)),
            );
        if (curAfter)
            s = s.replace(
                curAfter,
                (m: string, num: string, mag: string | undefined, sym: string, offset: number, full: string) =>
                    money(num, mag, sym, full.slice(offset + m.length)),
            );
        // The percent word is suppressed when the text already carries it — on whichever side this
        // language puts it. `93% ശതമാനം` doubled the suffix; `yüzde 40%` doubled the prefix.
        //
        // ⚠ AND THE WHOLE ARM IS SKIPPED WHEN THE LANGUAGE DECLARES NO PERCENT WORD — not run with an empty
        // one. Emitting `${num} ` for a missing word would leave a trailing space and DELETE the sign; the
        // `%` is left in place instead, which is the visible failure the DROP gate counts.
        if (d.percent !== undefined && pctRe && pctPreRe && PCT_AFTER && PCT_BEFORE) {
            const forms = d.percent;
            const pct = (num: string, offset: number, full: string, matchLen: number): string => {
                const before = full.slice(0, offset),
                    after = full.slice(offset + matchLen);
                const w = pick(forms, numValue(num), cf);
                if (d.percentPrefix) return PCT_BEFORE.test(before) ? num : `${w} ${num}`;
                return PCT_AFTER.test(after) ? num : `${num} ${w}`;
            };
            s = s.replace(pctPreRe, (m: string, num: string, off: number, full: string) => pct(num, off, full, m.length));
            s = s.replace(pctRe, (m: string, num: string, off: number, full: string) => pct(num, off, full, m.length));
        }
        // THE MULTIPLICATION SIGN, both `×` and ASCII `x` — BEFORE the unit path, and that ordering is load-bearing.
        // Placed after it, a `unitPrefix` language broke: Swahili's unit path MOVES the noun ahead of its number,
        // so `6x6 cm` became *sita KS sentimita sita* — the pattern no longer had a digit after the sign and the
        // `x` fell through to the letter reading. Running first also makes the dimension test easier rather than
        // harder: the unit is still an ABBREVIATION here, so "is a unit coming?" is just "digit then letters",
        // and no reordering has happened. The unit path still finds its number adjacent — `6 per 6 cm` keeps
        // `6 cm` together.
        if (d.multiply !== undefined) {
            const mul = d.multiply;
            const by = mul.by ?? mul.times;
            s = s.replace(
                /(\p{Nd})\s*(×|x)\s*(?=\p{Nd})/gu,
                (whole, left: string, sign: string, off: number, full: string) => {
                    // A UNIT after the right operand makes it a measurement; an UNSPACED ascii `x` is the
                    // `4x4`/`6x6` format idiom. `\s*` in the pattern means the spacing test has to read the source.
                    const spaced = /\s/u.test(whole);
                    const tail = full.slice(off + whole.length);
                    const hasUnit = /^\p{Nd}[\d.,]*\s?\p{L}/u.test(tail);
                    const word = hasUnit || (sign === "x" && !spaced) ? by : mul.times;
                    return `${left} ${word} `;
                },
            );
        }

        if (unitRe)
            s = s.replace(
                unitRe,
                (whole, num: string, mag: string | undefined, u: string, denom?: string, denomExp?: string, exp?: string) => {
                    // The magnitude travels with the NUMBER and is re-emitted verbatim — ⚠ a rule that
                    // CONSUMES a word must put it back. It also governs the count form the way a LARGE COUNT
                    // does, resolved through the language's own `countForm` via MANY — the same reasoning, and
                    // the same constant, that `withMagnitude` uses for the currency side, and for the same
                    // reason: passing a literal 2 means the PAUCAL to a Slavic selector, and taking the last
                    // entry breaks as soon as a fourth form is appended.
                    const hasMag = mag !== undefined && mag !== "";
                    const q = hasMag ? `${num}${mag}` : num;
                    const n = hasMag ? (d.magnitudeCount ?? MANY) : numValue(num);
                    // Correct-then-identify; see resolveUnitSymbol. A miss leaves the text alone — before
                    // #763 this was `units[u.toLowerCase()]!`, and the assertion turned an unreachable
                    // uppercase key into a THROW from inside pick().
                    const forms = resolveUnitSymbol(d.units, unitsFolded, u);
                    if (forms === undefined) return whole;
                    const head = pick(forms, n, cf);
                    if (denom !== undefined) {
                        // A rate needs both nouns and the connective; without any of them leave the text
                        // alone rather than emit half a reading.
                        // Same exact-then-folded resolution as the head unit, and for the same reason:
                        // ⟨h⟩ hour and ⟨H⟩ henry are different units.
                        // Same two steps as the head, but folding is allowed for a ONE-letter denominator
                        // too (see resolveUnitSymbol): the slash position rules out the other reading, and
                        // without it `100 KM/H` resolved neither half and dropped the head unit as well.
                        const dl = denom.toLowerCase();
                        const dWord = resolveUnitSymbol(d.units, unitsFolded, denom, true)?.[0]
                            ?? resolveUnitSymbol(d.rateDenominators, denomFolded, denom, true);
                        const per = typeof d.unitPer === "string" ? d.unitPer : (d.unitPer?.[denom] ?? d.unitPer?.[dl]);
                        if (per === undefined || dWord === undefined) return whole;
                        // ⚠ THE DENOMINATOR MAY CARRY AN EXPONENT — ⟨20,164 katao/km²⟩, the population-density
                        // shape. The rate alternative used to end at the denominator key, so the ² fell outside
                        // the match and was silently dropped (tl's largest exponent class, 13 of 35). Composed
                        // only when the language declares `exponentWords`; otherwise the old reading stands and
                        // the superscript is re-emitted where the leak gate can see it, as the head branch does.
                        let dPhrase = typeof dWord === "string" ? dWord : dWord[0]!;
                        if (denomExp !== undefined) {
                            const dPower = denomExp === "\u00b3" ? "cubed" : "squared";
                            const dForms = d.exponentWords?.[dPower];
                            if (dForms === undefined) dPhrase = `${dPhrase}${denomExp}`;
                            else {
                                const dw = dForms[0]!;
                                const dDeclared = d.exponentWords?.position;
                                const dPos = (typeof dDeclared === "string" ? dDeclared : dDeclared?.[dPower]) ?? "after";
                                dPhrase = dPos === "compound" ? `${dw}${dPhrase}`
                                    : dPos === "suffix" ? `${dPhrase}${dw}`
                                    : dPos === "before" ? `${dw} ${dPhrase}`
                                    : `${dPhrase} ${dw}`;
                            }
                        }
                        // `unitPrefix` applies here too, and forgetting it left Swahili reading
                        // "160 kilomita kwa saa" where the language writes the measure noun first. The rate is
                        // one phrase, so the whole of it hinges on the head noun's position.
                        return d.unitPrefix ? `${head} ${q} ${per} ${dPhrase}` : `${q} ${head} ${per} ${dPhrase}`;
                    }
                    if (exp !== undefined) {
                        const power = exp === "\u00b3" || exp === "3" ? "cubed" : "squared";
                        const forms = d.exponentWords?.[power];
                        if (forms === undefined) {
                            // ⚠ NO MEASURE WORD DECLARED — emit the UNIT and hand the exponent back rather than
                            // abandoning the match. Returning `whole` loses the QUANTITY too, not just its power:
                            // the abbreviation reaches the phoneme sink verbatim. Re-emitting the exponent keeps
                            // the unit's reading and leaves `²` where the leak gate can see it, turning an
                            // invisible missing reading into a visible missing WORD in one language's data.
                            return `${q} ${head}${exp}`;
                        }
                        // Count forms, because in Romance the measure word is an ADJECTIVE and agrees:
                        // "un kilómetro cuadrado" vs "cincuenta kilómetros cuadrados".
                        const word = pick(forms, n, cf);
                        const declared = d.exponentWords?.position;
                        const pos = (typeof declared === "string" ? declared : declared?.[power]) ?? "after";
                        // ⚠ The unit PHRASE is assembled first and the quantity placed around it, because
                        // `unitPrefix` governs the exponent reading exactly as it governs the plain one — Oromo
                        // writes `iskuweer kiloometiiri 783,562`, noun phrase THEN number. Building the return
                        // per-position instead silently ignores `unitPrefix` on this branch.
                        const phrase =
                            pos === "compound"
                                ? `${word}${head}`
                                : pos === "suffix"
                                  ? `${head}${word}`
                                  : pos === "before"
                                    ? `${word} ${head}`
                                    : `${head} ${word}`;
                        return d.unitPrefix ? `${phrase} ${q}` : `${q} ${phrase}`;
                    }
                    return d.unitPrefix ? `${head} ${q}` : `${q} ${head}`;
                },
            );

        // THE BARE UNIT TOKEN, after the digit-adjacent path has had every chance at the text — a `km` still
        // standing here has no numeral of its own, which is the case `bareUnitKeys` describes.
        s = bareUnit(s);

        // A BARE EXPONENT, LAST — after the unit path, which must have its chance first or this would steal
        // every `km²` and read it as "kilometre squared" instead of "square kilometres". By the time control
        // reaches here a surviving superscript has no unit to modify, which is exactly the case `bareExponent`
        // describes. Undeclared, nothing changes and the character stays where the RAWMARK leak gate can see
        // it — the same choice the unit branch makes for a missing measure word, and for the same reason: a
        // visible gap in one language's data beats an invisible missing reading.
        if (d.bareExponent !== undefined) {
            const be = d.bareExponent;
            s = s.replace(BARE_EXPONENT, (whole, base: string, sup: string) => {
                const digits = [...sup].map((c) => SUPERSCRIPT[c]!).join("");
                // `2` and `3` have their own words in every language that has any; everything else — including
                // `1`, `0` and a multi-digit power — goes through the generic form. `¹` is deliberately NOT
                // special-cased to "to the power of one": it is vanishingly rare and reading it plainly is
                // correct, where inventing "itself" would not be.
                const neg = digits.startsWith("-");
                const mag = neg ? digits.slice(1) : digits;
                // A NEGATIVE exponent always takes the generic `power` form: no language has a word for
                // "negative squared", and `10⁻²` is "to the power of minus two", not "minus squared".
                const tpl = neg ? be.power : mag === "2" ? be.squared : mag === "3" ? be.cubed : be.power;
                if (tpl === undefined) return whole; // this language declares only some powers
                if (neg && be.negative === undefined) return whole; // sign unreadable → leave it visible
                const exponent = neg ? `${be.negative} ${mag}` : mag;
                return tpl.replace(/\{n\}/gu, base).replace(/\{e\}/gu, exponent);
            });
        }
        return s;
    };
}
