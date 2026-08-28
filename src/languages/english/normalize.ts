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

import { makeInitialismNormalizer, makeUnreadableTest } from "../../core/initialisms.ts";
import { resolveUnitSymbol } from "../../core/normalizeSymbols.ts";
import { COLLISIONS as ROMAN_COLLISIONS, romanToInt } from "../../core/roman.ts";
import { MANIFEST } from "./manifest.ts";
import { rewrite } from "../../core/provenance.ts";

// ── Roman numerals ──────────────────────────────────────────────────────────────────────────────────
// A closed, conservative set (2–20, minus vi and xi). Lowercased text cannot tell "VI" from "vi", and vi
// (the editor) / xi (the name/letter) are real words. Single letters (i, v, x) are never treated as
// numerals. Larger romans (xxi+, l, c, m compounds) collide with too many words (mix is a valid 1009) and
// are left to the OOV G2P — this list covers monarchs, wars, chapters and film sequels.
const ROMAN: Record<string, number> = {
    ii: 2, iii: 3, iv: 4, vii: 7, viii: 8, ix: 9, xii: 12, xiii: 13, xiv: 14,
    xv: 15, xvi: 16, xvii: 17, xviii: 18, xix: 19, xx: 20,
};
// Context words after which a roman is a CARDINAL (world war ii → "world war 2"); anywhere else it is read
// as a REGNAL ordinal (henry viii → "henry the 8th"), the reading English gives name-attached numerals.
// Known limit: a bare medical "iv" or list-marker "(ii)" gets the regnal reading.
const ROMAN_CARDINAL_CTX =
    /\b(war|chapter|part|act|section|volume|book|phase|stage|grade|class|type|level|apollo|rocky|bowl|wrestlemania|olympiad|super)$/i;

// ── Units and symbols ───────────────────────────────────────────────────────────────────────────────
// Only unambiguous multi-character abbreviations, and only AFTER a number ("40 km"); bare "km" in prose
// stays. [sg, pl] for count agreement: "1 km" → kilometer, "40 km" → kilometers.
const UNITS: Record<string, [string, string]> = {
    km: ["kilometer", "kilometers"], cm: ["centimeter", "centimeters"], mm: ["millimeter", "millimeters"],
    kg: ["kilogram", "kilograms"], mg: ["milligram", "milligrams"], lb: ["pound", "pounds"],
    lbs: ["pounds", "pounds"], oz: ["ounce", "ounces"], ft: ["foot", "feet"], mi: ["mile", "miles"],
    mph: ["miles per hour", "miles per hour"], kph: ["kilometers per hour", "kilometers per hour"],
    // Slash and degree units. ⚠ Longest keys must match first, or `km` shadows `km/h` and the `/h` is read
    // as the letter aitch.
    "km/h": ["kilometer per hour", "kilometers per hour"], "m/s": ["meter per second", "meters per second"],
    "miles/hour": ["mile per hour", "miles per hour"], "mbit/s": ["megabit per second", "megabits per second"],
    "yards/meters": ["yard per meter", "yards per meters"],
    "°c": ["degree Celsius", "degrees Celsius"], "°f": ["degree Fahrenheit", "degrees Fahrenheit"],
    // ⚠ ℃ and ℉ are SINGLE CODE POINTS (U+2103, U+2109), so the two keys above cannot reach them and `20℃`
    // reads as bare "twenty" — the whole unit gone, not merely the sign.
    "℃": ["degree Celsius", "degrees Celsius"], "℉": ["degree Fahrenheit", "degrees Fahrenheit"],
    "°": ["degree", "degrees"],
    m: ["meter", "meters"], // ⚠ ⟨L⟩ AND ⟨l⟩ ARE BOTH OFFICIAL for the litre (⟨L⟩ is the dominant printed form), so BOTH are
    // declared — the one exception to the one-letter case rule in core/normalizeSymbols.ts, which
    // exists for symbols whose two cases are DIFFERENT units. Here they are the same unit.
    l: ["liter", "liters"], L: ["liter", "liters"], ml: ["milliliter", "milliliters"],
    // ⚠ ⟨W⟩ IS CAPITAL — watt is named after Watt, and #763 resolves a one-letter symbol case-SENSITIVELY,
    // so a lower-case ⟨w⟩ is not a unit. The multi-letter kw/hz/gb below still fold, so sloppy case reads.
    g: ["gram", "grams"], t: ["ton", "tons"], W: ["watt", "watts"],
    // ⚠ ⟨ha⟩ WAS NOT LEAKING, IT WAS MIS-READING — the one unit English got wrong, and the reason no gate
    // caught it. `12,700,000 ha` read *…hˈɑː*: the letters are a pronounceable English word, so nothing
    // survived as ASCII and nothing vanished, and the leak classes, the DROP counter and the corpus diff
    // are all blind to it by construction (see tools/normalization/misread.ts). The evidence is this
    // language's OWN artifact, which glosses the unit against acres in the same clause — "farms in 2010
    // (−32% since 2000) covering 12,700,000 ha or 31,382,383 acres" — and `hectare`/`hectares` are already
    // in g2p-dict.tsv and the accent lexicon, so nothing new is being asserted about the word.
    ha: ["hectare", "hectares"],
    hz: ["hertz", "hertz"], khz: ["kilohertz", "kilohertz"], mhz: ["megahertz", "megahertz"],
    ghz: ["gigahertz", "gigahertz"], kb: ["kilobyte", "kilobytes"], mb: ["megabyte", "megabytes"],
    gb: ["gigabyte", "gigabytes"], tb: ["terabyte", "terabytes"], kw: ["kilowatt", "kilowatts"],
};
/** The case-folded index for step 1 (see resolveUnitSymbol) — built once, beside the table it indexes. */
const UNITS_FOLDED: Record<string, [string, string]> = Object.fromEntries(
    Object.entries(UNITS).map(([k, v]) => [k.toLowerCase(), v] as const).reverse(),
);

const CURRENCY: Record<string, [string, string]> = {
    $: ["dollar", "dollars"], "£": ["pound", "pounds"], "€": ["euro", "euros"], "¥": ["yen", "yen"],
};

/**
 * A MAGNITUDE ABBREVIATION GLUED TO A MONEY FIGURE — `$1.5m`, `£2.3m`, `$2bn`, `£700k`.
 *
 * ⚠ THE ONE-LETTER ⟨m⟩ IS THE WHOLE PROBLEM, because it is ALSO the metre, and `UNITS` declares it as one.
 * The two readings are separated by exactly one thing — a CURRENCY SIGN in front of the number — and that
 * discriminator is not a guess here: three engines in this tree reached it independently before this rule
 * existed. `akan/normalize.ts` guards its unit table with a currency lookbehind, noting *"a one-letter `m`
 * after a money amount is the magnitude, not the metre… a currency sign in front is the discriminator"*;
 * `sinhala/normalize.ts` spends `US$100m` as the magnitude for the same reason, having first shipped it as
 * *ඩොලර් මීටර් 100*; `naija/normalize.ts` expands a glued ⟨bn⟩ and REFUSES ⟨m⟩ precisely because it has no
 * currency guard to lean on (`di 100 mita race`).
 *
 * Measured over the 162 committed mined artifacts:
 *
 *   currency sign + digits + GLUED abbreviation   43 instances, 15 artifacts — every one a magnitude
 *   bare digits + glued/spaced ⟨m⟩             1,327 instances, 110 artifacts — overwhelmingly METRES
 *
 * The currency sign separates those two populations completely, with no counterexample in either direction.
 * `he ran 100m`, `a 5m drop` and `1,854 m` keep the metre; only a figure carrying a sign loses it.
 *
 * ⚠ GLUED ONLY — THE SPACED FORM IS NOT SEPARABLE AND IS DELIBERATELY DECLINED. Scanning the fleet for
 * `$NN m` with an ASCII letter boundary returns 15 hits and TWELVE ARE FALSE: the ⟨m⟩ is the first letter
 * of the next word, and the next word is usually the language's own spelled-out magnitude — Kurmanji
 * `$ 125 mîlyon`, Yoruba `$500 mílíọ̀nù`, Hakka `$600 Mî-ngièn`, Estonian `$50, mängija`, Māori `$22,500 mō`.
 * That is the ASCII-`\b` trap this repo already records for the initialism pass, arriving in a new place:
 * `[a-z]` cannot see a boundary before `î`, `í` or `ä`. Under a Unicode letter class only 3 hits survive
 * fleet-wide. A rule worth 3 instances that manufactures 12 wrong readings is not worth having, so the
 * space is required to be absent.
 *
 * ⚠ THE KEYS ARE THE ATTESTED ONES AND NOTHING ELSE. ⟨m/M⟩, ⟨bn/BN⟩, ⟨B⟩ and ⟨k/K⟩ all occur glued to a
 * signed figure in the artifacts (`£1M`, `$7.32B`, `$178k`, `$2bn`). ⟨tn⟩ for trillion is ×0 across the
 * fleet — the same count on which naija declined it — and bare lowercase ⟨b⟩ is ×0 too; both are left out
 * rather than added on the strength of being plausible English.
 *
 * Nothing is SOURCED here: "million", "billion" and "thousand" are already the words step 1 hops with when
 * the text spells them, so this only lets the abbreviation reach the reading the spelled form already gets.
 */
const MONEY_MAGNITUDE: Readonly<Record<string, string>> = {
    m: "million", M: "million", bn: "billion", BN: "billion", Bn: "billion", B: "billion",
    k: "thousand", K: "thousand",
};
const MONEY_MAG_ALT = Object.keys(MONEY_MAGNITUDE).sort((a, b) => b.length - a.length).join("|");

const MONTH_ALT = "january|february|march|april|may|june|july|august|september|october|november|december";

// ── Title/place abbreviations (st, dr, mt, mr, mrs) ─────────────────────────────────────────────────
// ⚠ The dictionary reads bare "st" as STREET and "dr" as DRIVE, so "st. james" comes out "street . james" —
// wrong word AND the abbreviation's period survives into the clause segmenter as a phrase break. The dot
// must be consumed here, and st/dr disambiguated: a following CONTENT word means the abbreviation precedes
// a name (saint james, doctor tony); a following function word or phrase end means it follows one (main st.
// in dublin = street). Lowercased input cannot use capitalization, so the neighbour test is the whole
// heuristic there.
const ABBREV_FUNCTION_NEXT =
    /^(?:in|on|at|and|or|but|the|a|an|is|was|were|are|to|for|with|of|from|by|near|that|this|it|he|she|they|we|you|i|as|his|her|its|their|there|then|when|where|which|who|had|has|have)$/i;
// CAPITALIZATION, where the input has it, beats the neighbour test: "Dr. Who" is Doctor Who, but "who" is a
// function word, so the neighbour test alone reads it as "drive who".
const isName = (next: string): boolean => /^\p{Lu}/u.test(next);
const DOTTED_ABBREV: Record<string, (next: string) => string> = {
    st: (next) => (!isName(next) && ABBREV_FUNCTION_NEXT.test(next) ? "street" : "saint"),
    dr: (next) => (!isName(next) && ABBREV_FUNCTION_NEXT.test(next) ? "drive" : "doctor"),
    mt: () => "mount",
    mr: () => "mister",
    mrs: () => "missus",
};

// ⚠ A DOTTED DESIGNATION IS NOT A QUANTITY. The number group accepts a fraction, so `802.11g` matches as
// `802.11` + `g` and reads as "eight hundred two point one one GRAMS". This is the shared tier's
// `NOT_VERSION`, which English cannot inherit because it does not use the tier.
// The guard rejects a `\d+[.,]\d+` immediately followed by a SINGLE letter. A SPACED quantity is untouched
// because the lookahead requires the letter to be glued, so `100.5 m` still reads as metres.
// ⚠ AND 802.11 IS NAMED EXPLICITLY. Its amendment suffixes are now TWO letters — 802.11ac, ax, ah, be — and
// `802.11ah` (Wi-Fi HaLow) collides with `Ah`, ampere-hours. The general arm only guards a SINGLE trailing
// letter, so naming the family covers every suffix length; it is the only such designation that occurs.
const NOT_VERSION = "(?<![\\d.,])(?!802[.,]11\\w)(?!\\d+[.,]\\d+[a-zA-Z](?![a-zA-Z\\d]))";
const UNIT_RE = new RegExp(
    // ⚠ THE EXPONENT IS PART OF THE UNIT MATCH, not a separate rule, because the unit rule consumes the unit
    // and anything left behind reaches the g2p raw: `km²` matches `km`, the `²` is stranded and dropped, and
    // `19,500 km²` reads as a LENGTH — the area gone.
    // ⚠ THE ASCII EXPONENT IS ACCEPTED TOO (`km2`, `m3`), not only the superscript, and it is what a person
    // types when the keyboard has no superscript. Matching only `[²³]` lets the `2` fall out of the unit
    // match and read as a SEPARATE NUMBER — `19,500 km2` as "…kilometres TWO". Audibly wrong, and invisible
    // to both gates: no superscript survives to leak and no symbol vanishes.
    // Bounded by the UNIT LIST, which is what makes it safe — `H2O` cannot match because `H` is not a key.
    // ⚠ A MAGNITUDE WORD MAY SIT BETWEEN THE NUMBER AND ITS UNIT, and without the hop English LEAKS the
    // unit: `2.2 million km2 of ocean` read as *… mˈɪɫjən ˈʊkm tʰˈuː …*, the abbreviation reaching the
    // phoneme stream AS RAW LETTERS. Invisible to every gate, because bare Latin letters are in no leak
    // class and nothing vanished for the DROP test to catch. The magnitude is RE-EMITTED in place: it
    // belongs to the number's reading, not the unit's.
    `${NOT_VERSION}(\\d[\\d,]*(?:\\.\\d+)?)(\\s+(?:hundred|thousand|million|billion|trillion))?\\s?(${
        Object.keys(UNITS).sort((a, b) => b.length - a.length)
            .join("|")})([²³23])?(?![\\p{L}\\p{M}])`,
    "giu",
);

/** Dotted abbreviations with a single fixed reading (no neighbour test needed). `No.` otherwise reads as
 *  the word "no". */
const PLAIN_ABBREV: Readonly<Record<string, string>> = {
    jr: "junior", sr: "senior", prof: "professor", rev: "reverend", sgt: "sergeant", cpl: "corporal",
    lt: "lieutenant", col: "colonel", gen: "general", gov: "governor", sen: "senator", rep: "representative",
    no: "number", nos: "numbers", ave: "avenue", blvd: "boulevard", rd: "road", ln: "lane",
    dept: "department", est: "established", approx: "approximately", vs: "versus",
    vol: "volume", ch: "chapter", fig: "figure", pp: "pages", ed: "edition", eds: "editors",
    inc: "incorporated", ltd: "limited", corp: "corporation", univ: "university",
    // LATIN SCHOLARLY ABBREVIATIONS. Each reaches the g2p with its dot intact, so mid-sentence the dot
    // becomes a phrase break — and two are not words at all: `cf.` comes out as the unpronounceable cluster
    // [kf] and `viz.` as the nonsense word [vɪts].
    // ⚠ `etc` and `ibid` map to THEMSELVES: the dictionary already reads both correctly as single tokens
    // ([ɛtsˈɛt̬ɚə], [ˈɪbɪd]), so the entry exists only to consume the dot. Expanding etc to "et cetera"
    // re-stresses the sentence-final instances as two words, changing output that was already right.
    // `i.e.`/`e.g.`/`a.m.`/`p.m.` are handled separately below, being read as LETTERS or glossed.
    etc: "etc", ibid: "ibid", cf: "compare", viz: "namely",
};
const PLAIN_ABBREV_ALT = Object.keys(PLAIN_ABBREV).sort((a, b) => b.length - a.length).join("|");

/** Fraction denominators. 2/3/4 are suppletive (half, third, quarter); the rest are the ordinal word,
 *  spelled out here rather than emitted as "5th" because the ordinal-suffix path has no plural form and
 *  "2/5" needs "fifths". Beyond 20 a fraction is vanishingly rare in prose and is left as digits. */
const DENOMINATOR: Readonly<Record<number, string>> = {
    2: "half", 3: "third", 4: "quarter", 5: "fifth", 6: "sixth", 7: "seventh", 8: "eighth",
    9: "ninth", 10: "tenth", 11: "eleventh", 12: "twelfth", 16: "sixteenth", 20: "twentieth",
};
function fractionWords(num: number, den: number): string | undefined {
    if (den < 2 || num < 1) return undefined;
    const base = DENOMINATOR[den];
    if (base === undefined) return undefined;
    const plural = num > 1 ? (base === "half" ? "halves" : `${base}s`) : base;
    return `${num} ${plural}`;
}

const MONTHS = MONTH_ALT.split("|");

/** English ordinal suffix for a day-of-month (1st, 2nd, 3rd, 4th … 21st, 22nd, 23rd). */
function ordinalSuffix(n: number): string {
    const mod10 = n % 10, mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return "st";
    if (mod10 === 2 && mod100 !== 12) return "nd";
    if (mod10 === 3 && mod100 !== 13) return "rd";
    return "th";
}

/** A numeric date → "march 14th 2011", the word order English speaks and the shape the date/year rules
 *  below already handle. `undefined` if the fields are not a real date, so the caller leaves it alone. */
function isoDate(year: number, month: number, day: number): string | undefined {
    if (month < 1 || month > 12 || day < 1 || day > 31) return undefined;
    return `${MONTHS[month - 1]} ${day}${ordinalSuffix(day)} ${year}`;
}

/** A 4-digit year in its English pair-wise reading, emitted as tokens the number path already handles:
 *  1998 → "19 98" (nineteen ninety-eight), 1905 → "19 oh 5", 1900 → "19 hundred", 2000 → "2 thousand",
 *  2007 → "2 thousand 7", 2011 → "20 11" (twenty eleven). */
function yearWords(y: number): string {
    const hi = Math.floor(y / 100), lo = y % 100;
    // ⚠ 2010-2019 STAYS PAIR-WISE ("twenty ten"), and it was measured rather than assumed. Readers split:
    // the corpus has "the 2010 earthquake" read *twenty ten* and "january 2017" read *two thousand
    // seventeen*. Switching the decade to the "2 thousand N" form scores 9 closer / 7 further with the
    // median moving 0.1847 -> 0.1812 -- a coin flip. Where both readings are real the standard one stands.
    if (y >= 2000 && y < 2010) return lo === 0 ? "2 thousand" : `2 thousand ${lo}`;
    if (lo === 0) return `${hi} hundred`;
    if (lo < 10) return `${hi} oh ${lo}`;
    return `${hi} ${lo}`;
}

/** Superscript digits → ASCII, so an exponent reaches the number path as a readable numeral. */
const SUPERSCRIPT_DIGIT: Readonly<Record<string, string>> = {
    "\u207b": "-", // SUPERSCRIPT MINUS — a negative exponent, `10\u207b\u00b3\u00b9`
    "\u2070": "0", "\u00b9": "1", "\u00b2": "2", "\u00b3": "3", "\u2074": "4",
    "\u2075": "5", "\u2076": "6", "\u2077": "7", "\u2078": "8", "\u2079": "9",
};

/** Normalize one English input string. Pure text→text; no IPA. */
export function normalizeEnglish(input: string): string {
    let s = input;

    // 0) ABBREVIATIONS: dotted forms first (the dot is consumed so it can't become a phrase break), then the
    //    undotted saint pattern ("st petersburg"). An undotted "st" before a function word stays as-is: the
    //    dict's street reading is correct there ("main st in dublin"). A dotted abbreviation at phrase end
    //    is the trailing use (street/drive), keeping the punctuation that follows it.
    s = rewrite(s, /\b(st|dr|mt|mr|mrs)\.\s+([a-zà-ÿ']+)/gi,
        (_m, abbr: string, next: string) => `${DOTTED_ABBREV[abbr.toLowerCase()]!(next)} ${next}`);
    s = rewrite(s, /\b(st|dr|mt)\.(?=\s*(?:[.,;:!?]|$))/gi,
        (_m, abbr: string) => ({ st: "street", dr: "drive", mt: "mount" })[abbr.toLowerCase()]!);
    s = rewrite(s, /\bst\s+([a-z']+)/gi,
        (m0, next: string) => (ABBREV_FUNCTION_NEXT.test(next) ? m0 : `saint ${next}`));

    // 0b) MORE DOTTED ABBREVIATIONS. The dot is consumed when the sentence continues so it cannot become a
    //     phrase break, and kept at a phrase end where it really is the sentence end — the same discipline
    //     as the st./dr. rule above, and the shape every arm in this step repeats.
    s = rewrite(s, new RegExp(`\\b(${PLAIN_ABBREV_ALT})\\.(\\s+)(?=\\p{L})`, "giu"),
        (m0, ab: string, sp: string) => {
            // ⚠ THE MISS BRANCH IS REACHABLE (#1122): the pattern is built from this table's own
            // keys but carries `i`+`u`, so JS's fold widens it and a near-miss matches while its
            // key is absent. The `!` here made `String.replace` stringify `undefined`.
            const w = PLAIN_ABBREV[ab.toLowerCase()];
            return w === undefined ? m0 : `${w}${sp}`;
        });
    s = rewrite(s, new RegExp(`\\b(${PLAIN_ABBREV_ALT})\\.(?=\\s*(?:[.,;:!?)]|$))`, "giu"),
        (m0, ab: string) => {
            // ⚠ THE MISS BRANCH IS REACHABLE (#1122): the pattern is built from this table's own
            // keys but carries `i`+`u`, so JS's fold widens it and a near-miss matches while its
            // key is absent. The `!` here made `String.replace` stringify `undefined`.
            const w = PLAIN_ABBREV[ab.toLowerCase()];
            return w === undefined ? m0 : `${w}.`;
        });
    //     `et al.` is TWO tokens, so it needs its own arm after the single-token rule above has run.
    s = rewrite(s, /\bet\s+al\.(\s+)(?=\p{L})/giu, "et al$1");
    s = rewrite(s, /\bet\s+al\.(?=\s*(?:[.,;:!?)]|$))/giu, "et al.");
    //     `c.`/`ca.` is circa ONLY before a year — a bare `c.` is the letter (or an initial) and must be
    //     left to the initials rule, so the digit lookahead is what makes this safe.
    s = rewrite(s, /\bca?\.\s*(?=\d{3,4}(?!\d))/gi, "circa ");
    //     `No.` before a DIGIT is the number sign; the rule above needs a following letter.
    s = rewrite(s, /\bnos?\.\s*(?=\d)/gi, "number ");
    //     `e.g.` and `i.e.` take the ENGLISH GLOSS, which is a CHOICE: readers genuinely disagree three ways
    //     (letter names, "for example", omitting it outright), so there is no single correct target here.
    //     Both must be handled before the generic dot-stripping below, which would leave "eg"/"ie" to be
    //     read as words.
    //     ⚠ The lookahead admits a DIGIT — "i.e. 0 or 1" occurs, and a letter-only lookahead lets it fall
    //     through to the dot-stripping, which reads the bare "ie" as the word [iː].
    s = rewrite(s, /\be\.\s?g\.(\s+)(?=[\p{L}\d])/giu, "for example$1");
    s = rewrite(s, /\be\.\s?g\.(?=\s*(?:[,;:!?)]|$))/giu, "for example.");
    s = rewrite(s, /\bi\.\s?e\.(\s+)(?=[\p{L}\d])/giu, "that is$1");
    s = rewrite(s, /\bi\.\s?e\.(?=\s*(?:[,;:!?)]|$))/giu, "that is.");
    //     a.m./p.m. likewise: dot-stripping alone leaves lowercase "am", which reads as the verb. The
    //     initialism pass cannot rescue it because that pass only claims all-caps runs.
    s = rewrite(s, /\b([ap])\.\s?m\./gi, (_m, ap: string) => (ap.toLowerCase() === "a" ? "ay em" : "pee em"));
    //     Other dotted initialisms (U.S., U.K.) — strip the interior dots so they cannot become pause marks,
    //     leaving the letters for the initialism pass or the dictionary.
    //     ⚠ AND UPPERCASED, because a contiguous dotted letter run IS an initialism by construction, while
    //     the pass that spells one out is gated on capitals. On lowercased input the two collide whenever
    //     the stripped result is itself a word: `u.s.` became `us` and was read as the WORD *ʌs*, which the
    //     corpus audit caught — the reader said "U-S". (`u.k.` escaped only because "uk" is not a word,
    //     which is why this never showed up before.) Uppercasing is safe here precisely because the dots
    //     have already proved what the run is.
    s = rewrite(s, /\b([A-Za-z](?:\.[A-Za-z]){1,4})\.(?!\w)/g, (m0) => m0.replace(/\./g, "").toUpperCase());

    // 0c) ERA MARKERS. Spelled out, not expanded to words: "B C" is how they are read aloud, and "AD" must
    //     not be read as the word "ad".
    s = rewrite(s, /\b(BCE|BC|CE|AD)\b/g,
        (m0) => ({ BCE: "bee see ee", BC: "bee see", CE: "see ee", AD: "ay dee" })[m0] ?? m0);

    // 0d) DIGIT GROUPING with a space (SI style, "1 356"). The number token cannot span a space, so these
    //     read as two numbers with the thousand lost. Twice, because adjacent groups share a digit.
    //
    // ⚠ TWO GUARDS, BOTH FROM THE AUDIO. The wav2vec2 pass over the corpus caught this rule joining numbers
    //     that were never one number, and English has no genuine space-grouped instance to trade against:
    //     across en_us the pattern matched twice and BOTH were false merges.
    //
    //       `the 2008 400 richest americans`  -> 2008400, read *two million eight thousand four hundred*
    //                                            the reader said "two thousand and eight ... four hundred"
    //       `july 21 356 bce`                 -> 21356,   read *twenty-one thousand three hundred fifty-six*
    //
    //     LEADING GROUP 1-3 DIGITS is the shape of SI grouping itself: 2,008,400 is written `2 008 400`,
    //     never `2008 400`, so a four-digit head is proof the space is not a separator. That alone fixes
    //     the first. NOT AFTER A MONTH NAME fixes the second, where the left number is a day and the right
    //     a year — the one context in which two bare numbers legitimately sit adjacent.
    //     Matched as ONE WHOLE RUN rather than pairwise-twice, which is also what the comma rule in
    //     core/sinitic.ts does. Pairwise cannot carry the leading-group constraint: after `2 008 400`
    //     merges its first pair the head is four digits, so the second pass would refuse its own output.
    const SPACE_GROUP = new RegExp(
        `(?<!(?:${MONTH_ALT})[ \u00a0\u202f\u2009])(?<![\\d.,])[1-9]\\d{0,2}(?:[ \u00a0\u202f\u2009]\\d{3})+(?![\\d])`, "giu");  // space, NBSP, NNBSP, thin space
    s = rewrite(s, SPACE_GROUP, (m0) => rewrite(m0, /[ \u00a0\u202f\u2009]/gu, ""));  // space, NBSP, NNBSP, thin space

    // 0e) SCIENTIFIC NOTATION'S EXPONENT, resolved before BOTH the sign rule and the unit rule — ⚠ AND THE
    //     ORDERING IS THE WHOLE REASON THIS IS SEPARATE FROM 6b rather than the same rule.
    //     A superscript sits BETWEEN the number and its unit (`9.11 × 10⁻³¹ kg`), which breaks the adjacency
    //     the unit rule matches on: the unit then fails and `kg` reaches the phoneme stream RAW as *kɡ* — a
    //     LEAK, worse than the dropped exponent it accompanies. Resolving the superscript here leaves the
    //     exponent's DIGITS immediately before the unit, so step 6 sees `31 kg` and reads it.
    //     ⚠ It cannot simply be moved earlier wholesale: a BARE exponent must be resolved AFTER the unit
    //     rule or it steals every `km²` and reads it "kilometre squared". Hence two placements, narrow here
    //     and general at 6b — the narrowing is the `× 10` shape, which is unambiguous scientific notation.
    //     ⚠ AND BEFORE STEP 0e. Placed after it, the sign rule has already rewritten `-31` to `negative 31`,
    //     so the ASCII pattern can no longer match and the reading says "ten negative thirty-one" — the sign
    //     present, the power still missing. Running first means this rule owns the whole construction and
    //     emits the sign word itself.
    //     ⚠ THE ASCII FORM IS MATCHED TOO, and it is the one that actually occurs — real text writes the
    //     exponent as plain digits with the superscript lost (`9.1093837 × 10 -31 kg`). THE ATTACHED MINUS
    //     IS THE DISCRIMINATOR: `10 -31` is scientific notation, `10 - 31` (spaced both sides) is
    //     subtraction. Combined with the required `×` before the `10`, nothing else can reach this.
    s = rewrite(s, /(?<=[×x·]\s?)(10)\s?(\u207b?[\u2070\u00b9\u00b2\u00b3\u2074-\u2079]+|-\d+)/gu,
        (_m, ten: string, sup: string) => {
            const digits = sup.startsWith("-")
                ? sup
                : [...sup].map((c) => SUPERSCRIPT_DIGIT[c]!).join("");
            const neg = digits.startsWith("-");
            return `${ten} to the power of ${neg ? `negative ${digits.slice(1)}` : digits}`;
        });

    // 0f) NEGATIVES. A dropped minus sign INVERTS the meaning, which for a temperature is the worst class of
    //     silent error: "-5 degrees" read as "five degrees".
    //     ⚠ "NEGATIVE", NOT "MINUS", and the distinction is the point. `minus` is the ARITHMETIC OPERATOR —
    //     "ten minus four" — while `negative` is the SIGN on an amount. This rule only ever matches the SIGN
    //     position (start of string, after a space, or after an opening paren), so "minus" would spend the
    //     operator's word on the sign's job and be ambiguous with subtraction exactly where a phonemizer
    //     cannot afford it. `negative` on a measurement is unremarkable English ("negative forty Celsius").
    s = rewrite(s, /(^|[\s(])[-−–](\d)/gu, "$1negative $2");
    //     ⚠ THE SIGN ARM ABOVE REQUIRES THE DIGIT IMMEDIATELY, with no `\s?`, and that is what keeps a
    //     spaced range out: `(1418 – 1450)` reads as a subtraction the moment a space is allowed after the
    //     dash. `±` can afford the `\s?` because no range is written with one.
    s = rewrite(s, /(^|[\s(])±\s?(\d)/gu, "$1plus or minus $2");

    // 0f0) NUMERIC DATES, before the fraction rule (which would otherwise have to guard against them) and
    //      before the date/year steps below, whose ordinal-day and pair-wise-year rules then apply to what
    //      this emits. ISO is year-first, the US form month-first.
    s = rewrite(s, /\b(\d{4})-(\d{2})-(\d{2})\b/g, (m0, y: string, mo: string, d: string) =>
        isoDate(Number(y), Number(mo), Number(d)) ?? m0);
    s = rewrite(s, /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g, (m0, mo: string, d: string, y: string) =>
        isoDate(Number(y), Number(mo), Number(d)) ?? m0);

    // 0f1) MONEY with cents. Read as "five dollars fifty", not "five point five zero dollars" — a decimal
    //      reading of a price is wrong in a way listeners notice. Must precede the general currency rule.
    // ⚠ `(?![\p{L}\p{M}])`, NOT `\b` — and the `u` flag is required for it. JS defines `\b` on ASCII `\w`,
    // so `$1.50é` was read as money while `$1.50a` was not (#949, #950). The `u` flag alone changes nothing
    // here; the guard is the change.
    s = rewrite(s, /([$£€¥])\s?(\d[\d,]*)\.(\d{2})(?![\p{L}\p{M}])/gu,
        (_m, sym: string, int: string, cents: string) => {
            const [sg, pl] = CURRENCY[sym]!;
            const unit = /^1$/.test(rewrite(int, /,/g, "")) ? sg : pl;
            return cents === "00" ? `${int} ${unit}` : `${int} ${unit} ${Number(cents)}`;
        });

    // 0f2) PLUS. The mirror of the minus rule: a dropped sign is silent content loss. Covers the attached
    //      form too (UTC+1 → "UTC plus 1").
    s = rewrite(s, /(\S)\+\s?(\d)/gu, "$1 plus $2");
    s = rewrite(s, /(^|\s)\+\s?(\d)/gu, "$1plus $2");

    // 0g) FRACTIONS. Guarded against dates (3/14/2011) and unit ratios (km/h) by requiring digits both sides
    //     and nothing numeric or alphabetic after.
    s = rewrite(s, /\b(\d{1,3})\/(\d{1,3})\b(?!\s*[\/\d])/gu, (m0, a: string, b: string) =>
        fractionWords(Number(a), Number(b)) ?? m0);

    // 1) CURRENCY before anything else touches the digits: the symbol precedes but is SPOKEN after, and a
    //    magnitude word hops with it ($5 million → "5 million dollars").
    //
    //    ⚠ AND THE ABBREVIATED MAGNITUDE HOPS THE SAME WAY — `$1.5m` → "1.5 million dollars". See
    //    MONEY_MAGNITUDE for why the currency sign is the discriminator and why only the GLUED form is
    //    claimed. It is spent HERE, in the currency rule, and not anywhere later, for two reasons:
    //
    //      · the currency rule runs first and CONSUMES THE NUMBER, so a later rule has nothing to attach to.
    //        That is why `$1.5m` read as *… dˈɑːlɚzəm* rather than as a version string: the shape never
    //        reached `NOT_VERSION` at all, and removing that guard entirely changed nothing — `$1.5m`,
    //        `£2.3m` and `a $1.5m grant` all read identically with it gone. The defect was never in the
    //        version guard; it was here.
    //      · the UNIT step below would otherwise claim the `m` as a metre, since it runs later and `m` is a
    //        declared unit key. Consuming it here is what makes `he ran 100m` and `$1.5m` differ.
    s = rewrite(s,
        new RegExp(`([$£€¥])\\s?(\\d[\\d,]*(?:\\.\\d+)?)(?:(\\s+(?:million|billion|trillion|thousand))|(${
            // ⚠ THE BOUNDARY GUARD SITS INSIDE THE ABBREVIATION ARM, NOT AFTER THE WHOLE GROUP. Placed
            // outside, it applies even when no magnitude matched — and then `$2.5tn` cannot satisfy it, so
            // the engine BACKTRACKS THE NUMBER to `$2` (the `.` passes the lookahead) and reads "2 dollars"
            // with ".5tn" stranded, which is worse than the leak it was meant to fix. Inside the arm, a
            // failed abbreviation simply leaves the optional group empty and the old behaviour stands.
            MONEY_MAG_ALT})(?![\\p{L}\\p{M}\\d]))?`, "gu"),
        (_m, sym: string, num: string, spelled?: string, abbrev?: string) => {
            const [sg, pl] = CURRENCY[sym]!;
            const mag = spelled ?? (abbrev === undefined ? undefined : ` ${MONEY_MAGNITUDE[abbrev]!}`);
            const one = /^1(?:\.0+)?$/.test(num.replace(/,/g, ""));
            return `${num}${mag ?? ""} ${one && mag === undefined ? sg : pl}`;
        },
    );

    // 2) PERCENT: "40%" → "40 percent". Before times/years so the bare number stays one token.
    s = rewrite(s, /(\d)\s?%/gu, "$1 percent");

    // 3) TIMES: H:MM (optionally already followed by am/pm, which the dictionary reads fine).
    //    :00 → o'clock (dropped before am/pm: "3 pm", not "3 o'clock pm"), :0X → "oh X".
    s = rewrite(s, /\b(\d{1,2}):([0-5]\d)\b(\s*[ap]m\b)?/gu, (_m, h: string, mm: string, ap?: string) => {
        const suffix = ap ?? "";
        if (mm === "00") return suffix ? `${h}${suffix}` : `${h} o'clock`;
        if (mm.startsWith("0")) return `${h} oh ${Number(mm)}${suffix}`;
        return `${h} ${mm}${suffix}`;
    });

    // 4) DATES: month + bare day number → ordinal suffix, letting the existing 16th path speak it
    //    (february 16 → "february 16th"). Runs BEFORE years so "february 16 2011" ordinalizes the day first
    //    and the year rule then sees "2011" with a month in context.
    s = rewrite(s, /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(?!\d|\s*(?:st|nd|rd|th|percent))\b/gi, (m0, mon: string, d: string) => {
        const n = Number(d);
        if (n < 1 || n > 31) return m0;
        const suf = d.endsWith("1") && n !== 11 ? "st" : d.endsWith("2") && n !== 12 ? "nd" : d.endsWith("3") && n !== 13 ? "rd" : "th";
        return `${mon} ${d}${suf}`;
    });

    // 5) YEARS: a bare 4-digit 1100–2099 in a date-like CONTEXT (after in/of/since/…, a month name, or
    //    followed by a sentence boundary after such) → pair-wise reading. ⚠ Context-gated on purpose: "2011
    //    people died" must not become "twenty eleven people". Grouped digits (1,998) never match.
    //    ⚠ A DASHED PAIR OF 4-DIGIT YEARS IS A DATE RANGE, and encyclopedic prose is full of them —
    //    "guru nanak 1469–1539" is life dates, not arithmetic. Both sides take the pair-wise reading. The
    //    dash is left alone rather than spoken as "to", which would assert a word the reader may not say.
    //
    //    ⚠ IT NEEDS ITS OWN GATE, and shipping it without one was a defect: a bare dashed pair of 4-digit
    //    numbers is not always a date. `pp. 1234-1256` became "12 34-12 56" and `room 1200-1300` became
    //    "12 hundred-13 hundred". The reference/quantity cues below are excluded before, and the context
    //    arm's own unit list after, so a measurement range keeps its cardinal reading. This is the same
    //    principle the context gate above states — a bare number is not a year — applied to the pair.
    //
    //    ⚠ BOTH SIDES ARE `20\d\d`, NOT `200\d`. Restricting the range to pre-2010 while the tight
    //    contexts still convert 2010s years reintroduced the exact half-conversion the ordering below
    //    fixes: `from 2011-2015` matched no range, then the context arm ate the left year alone and gave
    //    "from 20 11-2015". A range IS a date context, as strong as "in", so it follows the tight-context
    //    behaviour for every year. Only the DETERMINER arm is pre-2010 gated, and for a different reason.
    //
    //    ⚠ THIS MUST RUN BEFORE THE CONTEXT RULE BELOW. With the context rule first, "from 1918-1939" had
    //    its LEFT year consumed and the range rule could no longer see a pair.
    //    ⚠ It does NOT fully escape the sign rule at step 0f: that arm needs the dash to follow a space or
    //    an open paren, which `1998-1999` and `1998 - 1999` avoid but `1998 -1999` does not — that spacing
    //    still reads as a negative, exactly as it does on main. Not introduced here, and not fixed here.
    s = rewrite(s,
        /(?<!\b(?:pp|p|pages?|nos?|no|rooms?|chapters?|verses?|lines?|sections?|parts?|models?|items?|figs?|figures?|tables?|suites?|apt|ext)\.?\s)\b(1[1-9]\d\d|20\d\d)(\s*[-–—]\s*)(1[1-9]\d\d|20\d\d)\b(?![.,]?\d)(?!\s*(?:percent|kilometers?|meters?|km|kg|miles?|feet|ft|dollars?|usd|euros?))/gi,
        //    ⚠ AND A DATE RANGE ASCENDS. This catches what no cue list can: `call 1800-1234` is a phone
        //    number, not a reign, and it read as "18 hundred-12 34". Requiring b >= a rules out phone
        //    fragments, descending part numbers and reversed ID ranges generally, rather than one at a
        //    time. An equal pair (`1998-1998`) is kept — it is a degenerate range, still a year.
        (_m, a: string, dash: string, b: string) =>
            Number(b) >= Number(a)
                ? `${yearWords(Number(a))}${dash}${yearWords(Number(b))}`
                : _m,
    );
    //    ⚠ A DETERMINER MAY SIT BETWEEN THE CONTEXT WORD AND THE YEAR, and requiring adjacency missed it:
    //    "in a 1998 book" and "since the 1998 report" read as *one thousand nine hundred ninety-eight*
    //    while "in 1998" read correctly. The corpus caught it — en_us `hˈʌndɹəd` is one of the commonest
    //    words in the investigate queue, and the recognizer plainly returns *nineteen ninety-eight*. Only
    //    the three bare determiners are allowed through: an adjective slot would let "in a 2011 people
    //    survey" past, which is the reading the context gate exists to prevent.
    s = rewrite(s,
        /\b(in|of|since|from|until|till|by|before|after|around|circa|year|late|early|mid)(\s+(?:the|a|an))?\s+(1[1-9]\d\d|20\d\d)\b(?![.,]?\d)(?!\s*(?:percent|kilometers?|meters?))/gi,
        (_m, ctx: string, det: string | undefined, y: string) =>
            // ⚠ THE DETERMINER ARM IS PRE-2010 ONLY, and the split is measured, not stylistic. Reaching
            // more contexts with the pair-wise reading scores 12 closer / 0 further on years before 2000
            // (median 0.2593 -> 0.1515) and 1 closer / 6 further on 2010-2019 (0.2083 -> 0.2378), because
            // readers of a 2010s year often say "two thousand N" while nobody says "one thousand nine
            // hundred ninety-eight". A year in the ORIGINAL tight contexts is untouched either way.
            det && Number(y) >= 2010 ? _m : `${ctx}${det ?? ""} ${yearWords(Number(y))}`,
    );
    s = rewrite(s,
        new RegExp(`\\b(${MONTH_ALT})((?:\\s+\\d{1,2}(?:st|nd|rd|th))?,?)\\s+(1[1-9]\\d\\d|20\\d\\d)\\b(?![.,]?\\d)`, "gi"),
        (_m, mon: string, day: string, y: string) => `${mon}${day} ${yearWords(Number(y))}`,
    );

    // 6) UNITS: number + known abbreviation. Count agreement from the number.
    s = rewrite(s, UNIT_RE,
        (_m: string, num: string, mag: string | undefined, u: string, exp: string | undefined) => {
            // ⚠ SAME TWO STEPS, SAME HELPER as the shared symbol layer — English keeps its own UNITS table
            // (this normalizer predates that layer), and it carried the same `UNITS[u.toLowerCase()]!`
            // that #763 fixed there: an uppercase key was unreachable and the assertion made the miss a
            // THROW. Declaring ⟨W⟩ correctly is what exposed it here.
            const forms = resolveUnitSymbol(UNITS, UNITS_FOLDED, u);
            if (forms === undefined) return _m; // unresolvable → leave the text alone
            const [sg, pl] = forms;
            // English puts the measure word BEFORE the unit — "square kilometers" — and the COUNT still
            // governs the noun: "one cubic meter", not "one cubic meters".
            const measure = exp === "²" || exp === "2" ? "square " : exp === "³" || exp === "3" ? "cubic " : "";
            // ⚠ A magnitude forces the PLURAL: "2.2 million square kilometres", never "…kilometre". The
            // singular test looks at the digits alone, so without this `1 million km` reads "kilometre".
            const one = mag === undefined && /^1(?:\.0+)?$/.test(num.replace(/,/g, ""));
            return `${num}${mag ?? ""} ${measure}${one ? sg : pl}`;
        });

    // 6b) A BARE EXPONENT — a base with NO unit for the rule above to attach the power to, so the
    //     superscript is dropped outright. Ordered AFTER the unit rule so a unit exponent is never stolen
    //     from it.
    //     ⚠ THE PREDICATE IS A DIFFERENT WORD FROM THE MODIFIER, which is why this cannot reuse the table
    //     above: English reads *square kilometres* but *twenty SQUARED*, *cubic metres* but *eight CUBED*.
    //     Substituting the modifier gives "twenty square".
    //     THE BASE MAY BE LETTERS, not only digits — `E = mc²` read as *ˈiː ˈiːkwəɫz mˈɪk*, the equals
    //     correctly voiced and the square silently gone.
    //     `to the power of N` USES THE CARDINAL, deliberately, though "to the fifth power" is the more
    //     idiomatic English: the ordinal form would have to be produced for an arbitrary exponent, and the
    //     cardinal is both correct and unambiguous.
    //     ⚠ A LETTER BASE IS CAPPED AT THREE, because a superscript on an ordinary word is a FOOTNOTE marker
    //     far more often than an exponent: `Smith¹` is a citation, and reading it "Smith to the power of
    //     one" is confidently wrong. Variables are short, prose words are not.
    //     ⚠ AND THE CAP NEEDS `(?<![A-Za-z])`, or it caps nothing: `{1,3}` happily matches the LAST three
    //     letters of a long word, so `Smith¹` matches `ith` and still reads as arithmetic.
    //     ⚠ AND A FOLLOWING LETTER MUST BE SPACED OFF FIRST. The superscript is consumed and the replacement
    //     is a WORD, so whatever stood after the mark fuses onto it: `I²C` read *aᶦ skwˈɛɹd**k*** — one token
    //     where there were two. Nothing is dropped and no raw mark survives, so it is a WRONG-WORD defect
    //     that no leak gate can reach. The shared tier had the identical bug in its `bareExponent` arm.
    //     ⚠ AND NOT WHEN A SPACE PRECEDES THE SUPERSCRIPT (#1045). This pass spaces the mark off so the word
    //     it becomes cannot fuse with a following unit — but a SPACE-separated superscript glued to a word
    //     is that word's NUCLIDE, not this number's power (`0,708 ¹⁸⁰Hf`). Firing here would insert the
    //     space and thereby hide the shape from the decline below, which tests for a letter IMMEDIATELY
    //     after. `10⁶km` still spaces, because nothing separates its base from its mark.
    s = rewrite(s, /(?:\d[\d.,]*|(?<![A-Za-z])[A-Za-z]{1,3})(?:\u207b?[\u2070\u00b9\u00b2\u00b3\u2074-\u2079]+)(?=[\p{L}\p{M}])/gu,
        (m0) => `${m0} `);
    s = rewrite(s, /(\d[\d.,]*|(?<![A-Za-z])[A-Za-z]{1,3})\s?(\u207b?[\u2070\u00b9\u00b2\u00b3\u2074-\u2079]+)/gu,
        (whole, base: string, sup: string, at: number, all: string) => {
            //     ⚠ A LONE ⁰ OR ¹ IS A DEGREE SIGN OR A PRIME, not a power — see `LONE_MARK` in
            //     core/normalizeSymbols.ts for the corpus measurement. `360⁰` is a bearing and
            //     `110⁰04¹05¹` is a coordinate; nobody writes x⁰ or x¹.
            if (/^[⁰¹]$/u.test(sup)) return whole;
            //     ⚠ …AND THE SECONDS PRIME IS TWO OF THEM (#1045). The note above already cites the
            //     coordinate `110⁰04¹05¹` as its reason and stops one character short: Mongolian writes
            //     the seconds as `05¹¹`, which is not lone, so it read as *five eleven*. The discriminator
            //     is the unspaced `digits⁰digits¹` chain immediately before — NOT the digits, because
            //     `10¹¹` is a real power and six languages write one. ⚠ ENGLISH KEEPS ITS OWN COPY of this
            //     pass (see the header: each tier feature "has a local equivalent here or it does not
            //     exist"), so the shared tier's guard does not reach it and both had to be fixed.
            if (/^¹+$/u.test(sup) && /\d+⁰\d+¹$/u.test(all.slice(Math.max(0, at - 24), at))) return whole;
            //     ⚠ …AND A SPACED SUPERSCRIPT GLUED TO A WORD IS THAT WORD'S NUCLIDE, not this number's
            //     power: `0,708 ¹⁸⁰Hf` would read the mass number as a separate numeral on the wrong
            //     operand. Both conditions are required — without the space `10¹⁰Ω` is 10¹⁰ ohms, and
            //     without a following letter there is no word for the superscript to belong to.
            if (/\s/u.test(whole) && /^[\p{L}\p{M}]/u.test(all.slice(at + whole.length))) return whole;
            const digits = [...sup].map((c) => SUPERSCRIPT_DIGIT[c]!).join("");
            //     ⚠ THE SIGN WORD IS EMITTED HERE, not left as an ASCII `-` for the sign rule to pick up:
            //     that rule is step 0f and this is step 6b, so anything written now is downstream of it and
            //     a `-` would simply be dropped — reading `2\u207b\u2075` as "two to the power of five",
            //     with the sign silently inverted.
            const neg = digits.startsWith("-");
            const mag = neg ? digits.slice(1) : digits;
            const power = neg ? `negative ${mag}` : mag;
            return mag === "2" && !neg ? `${base} squared`
                : mag === "3" && !neg ? `${base} cubed`
                : `${base} to the power of ${power}`;
        });

    // 7a) ALL-CAPS romans of ANY value, when the text distinguishes case — "Super Bowl LVIII" (58),
    //     "WrestleMania XL" (40), "Louis XVI". The closed lowercase set below stops at 20 and cannot express
    //     these. Case makes them unambiguous, but an acronym is also all-caps ("the CD player"), so the
    //     preceding word must itself be evidence: a known numbered-event noun, or Capitalized as a name
    //     would be. That keeps "size XL" and "a CD" out while letting the real numerals through.
    //     ⚠ THE CAPITALIZED-PREVIOUS-WORD SIGNAL IS THE WEAK ONE, and on its own it read every all-caps
    //     abbreviation after a name as a numeral: `Washington DC` → *the six hundredth*, and equally
    //     `Sony CD` → *the four hundredth*, `Detroit MI` → *the one thousand first*, `Boeing MD`,
    //     `Ocean Express MV`, `Honda CIV`, `Paris DX`. "a CD" was kept out only by the lowercase "a".
    //     core/roman.ts already owned the measured list of these; English simply was not consulting it.
    //     Sharing it puts BOTH engines on one list rather than two that drift.
    //     ⚠ The stoplist applies only to the weak signal. An explicit numbered-event noun still licenses
    //     a stoplisted token, exactly as core's `licensed` does — `Apollo XI` is 11 and `WrestleMania XL`
    //     is 40, and both would be lost to a blanket check.
    if (/[a-z]/.test(s)) {
        s = rewrite(s, /\b([A-Za-z][A-Za-z']*)\s+([IVXLCDM]{2,})\b/g, (m0, prev: string, rom: string) => {
            const n = romanToInt(rom);
            if (n === null) return m0;
            const named = ROMAN_CARDINAL_CTX.test(prev);
            const evidence = named || /^[A-Z]/.test(prev);
            if (!evidence) return m0;
            if (!named && ROMAN_COLLISIONS.has(rom.toLowerCase())) return m0;
            if (named) return `${prev} ${n}`;
            const suf = n % 10 === 1 && n % 100 !== 11 ? "st" : n % 10 === 2 && n % 100 !== 12 ? "nd"
                : n % 10 === 3 && n % 100 !== 13 ? "rd" : "th";
            return `${prev} the ${n}${suf}`;
        });
    }

    // 7b) ROMAN NUMERALS, the closed 2–20 set: cardinal after a context word, else the regnal ordinal.
    s = rewrite(s, /\b([a-z']+)\s+(ii|iii|iv|vii|viii|ix|xii|xiii|xiv|xv|xvi|xvii|xviii|xix|xx)\b/gi,
        (_m, prev: string, rom: string) => {
            const n = ROMAN[rom.toLowerCase()]!;
            if (ROMAN_CARDINAL_CTX.test(prev)) return `${prev} ${n}`;
            const suf = n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th";
            return `${prev} the ${n}${suf}`;
        });

    // 8) THE AMPERSAND AND THE SIGN CLASSES. A dropped sign is inaudible, the one outcome that cannot be
    //    right: `College of Arts & Sciences` read *Arts Sciences*, `B&Bs` read *bee bees*.
    //    ⚠ LAST, deliberately. Every rule above matches on digits or letters adjacent to a symbol — the
    //    currency step keys on `$` beside a number, the unit step on a number beside an abbreviation — and
    //    inserting words between them first would break those adjacencies.
    //    ⚠ THE HTML ENTITY FIRST, or the bare-`&` rule below turns `&amp;` into "and amp;" — a word invented
    //    out of markup, which is worse than the drop it replaces. (`core/markup.ts` decodes these properly,
    //    but English does not use it, and wiring it in would also strip tags.)
    s = rewrite(s, /\s*&amp;\s*/giu, " and ");
    s = rewrite(s, /\s*&\s*/gu, " and ");
    //    `×`/`÷`/`<`/`>` only BETWEEN digits — `<` is the one sign whose bare form would eat a tag if the
    //    input ever carried markup.
    // ⚠ TWO WORDS FOR ONE SIGN, and ASCII `x` accepted alongside `×`.
    //     English says "six BY six centimetres" for a FORMAT and "five TIMES five" for a PRODUCT; a `4x4` is
    //     "a four BY four". Reading a dimension as "times" is not what anyone says.
    //     ⚠ AND ASCII `x` WAS READ AS THE LETTER: `6x6 cm` came out *sˈɪks ˈɛks sˈɪks …* — "six EKS six".
    //     That is the DOMINANT written form, roughly four `NxN` for every `×`, and it is audible garbage
    //     rather than a drop, so no leak or DROP gate could see it.
    //     THE DISCRIMINATOR: a unit after the right operand means a measurement; an UNSPACED ascii `x`
    //     between digits is the `4x4`/`6x6` format idiom. Both take "by"; everything else takes "times".
    //     Equality of the operands cannot decide it — `4x4` and `5 × 5` are both equal and read differently.
    s = rewrite(s, /(\d)\s*(×|x)\s*(?=\d)/gu, (whole, left: string, sign: string, off: number, full: string) => {
        const tail = full.slice(off + whole.length);
        const hasUnit = /^\d[\d.,]*\s?[A-Za-z]/u.test(tail);
        const unspacedAscii = sign === "x" && !/\s/u.test(whole);
        return `${left} ${hasUnit || unspacedAscii ? "by" : "times"} `;
    });
    s = rewrite(s, /(\d)\s*÷\s*(?=\d)/gu, "$1 divided by ");
    //    ⚠ `=` takes the house pattern `(\S)\s*=\s*(\S)`, not the digit gate: an equals sign between
    //    non-digits is still an equals sign (`x = y`), and unlike `<`/`>` it carries no tag hazard.
    s = rewrite(s, /(\S)\s*=\s*(\S)/gu, "$1 equals $2");
    s = rewrite(s, /(\d)\s*<\s*(?=\d)/gu, "$1 less than ");
    s = rewrite(s, /(\d)\s*>\s*(?=\d)/gu, "$1 greater than ");

    return s;
}

// ── Initialisms ─────────────────────────────────────────────────────────────────────────────────────
/**
 * English phonotactics, for the fail-safe guard in core/initialisms.ts. English codas are far more
 * permissive than French ones, so the load here is carried mostly by the no-vowel test — which is exactly
 * the failing class (NHS, MP, GDP, DVD, TV, PBS all lack a vowel entirely).
 */
export const isUnreadableEnglish = makeUnreadableTest({
    vowels: new RegExp(`[${MANIFEST.phonotactics.vowels}]`, "u"),
    legalOnsets: new Set(MANIFEST.phonotactics.onsets),
    legalCodas: new Set(MANIFEST.phonotactics.codas),
});

/**
 * Letter names. English needs almost no data here: CMUdict carries all 26 single letters with their
 * letter-NAME pronunciations (f = EH1 F, h = EY1 CH, w = D AH1 B AH0 L Y UW0), so emitting the bare letters
 * space-separated resolves correctly. The one exception is `a`, which the dict has as the reduced article
 * AH0 rather than the letter name.
 */
const LETTER_NAME = (l: string): string | undefined =>
    /^[a-z]$/u.test(l) ? (MANIFEST.letterNameExceptions[l] ?? l) : undefined;

/** LEXICAL: acronyms spelled out although their lowercase form is a dictionary word. Authored in
 *  english.jsonc alongside the language's other hand-authored facts, not here. */
const ACRONYM_LETTERS: ReadonlySet<string> = new Set(MANIFEST.acronymLetters);

/**
 * INITIALISMS. A separate exported pass, not a step inside `normalizeEnglish`, because of where it must
 * sit: Roman numerals are all-caps letter runs too, so the numeral rules get first refusal and this claims
 * only what they declined. Run earlier, this spells `Louis XIV` as EX-EYE-VEE.
 */
export function normalizeEnglishInitialisms(text: string, isRecorded: (lower: string) => boolean): string {
    return makeInitialismNormalizer({
        letterName: LETTER_NAME,
        acronymLetters: ACRONYM_LETTERS,
        isRecorded,
        isUnreadable: isUnreadableEnglish,
    })(text);
}
