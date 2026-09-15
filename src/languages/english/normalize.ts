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
    // ⚠ THE SLASHED RATE KEYS ARE THE TABLE'S OWN IDIOM (km/h, m/s, mbit/s above), and they are what
    // makes a multi-denominator unit readable at all: the unit rule claims ONE key, so without the
    // whole chain as a key the tail is stranded and reaches the g2p raw — `BTU/hr/sf` read as
    // *bˈiː tʰˈiː jˈuː ˈeᶦt͡ʃˈɑːɹ sf*, with `sf` arriving in the phoneme stream AS LETTERS.
    // ⚠ THE COMMA IS DELIBERATE. "per hour per square foot" is two denominators with nothing between
    // them; the break is what makes the second one hear as a second denominator rather than a
    // continuation of the first.
    // ⚠ `BTU` STAYS AS LETTERS in the expansion — the initialism pass runs after this one and spells
    // it — because nobody says "British thermal unit" aloud when the page says BTU.
    // ⚠ AND BARE `hr`/`sf` ARE NOT KEYS. Both are number-gated here, but `2 HR` is home runs and
    // `500 SF` is San Francisco often enough that neither earns an entry on its own; inside a slashed
    // rate there is nothing else they can be.
    // ⚠ SPELLED OUT IN THE TABLE, not left as `BTU` for the initialism pass to claim, because after a
    // NUMBER that pass deliberately backs off — a caps run there is the unit rule's territory. `250 BTU`
    // read as the word *bt͡ʃˈuː* ("btchoo") before this, and emitting `BTU` would have changed nothing.
    // Lowercase space-separated letters is what the house `spellLetters` produces.
    btu: ["b t u", "b t u"],
    "btu/hr": ["b t u per hour", "b t u per hour"],
    "btu/sf": ["b t u per square foot", "b t u per square foot"],
    "btu/hr/sf": ["b t u per hour, per square foot", "b t u per hour, per square foot"],
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
 * THE FRACTIONAL UNIT of each currency, for the cents rule at 0f1 — [singular, plural], and the plural of
 * the penny is SUPPLETIVE (`pence`, not *pennies*, for an amount of money).
 *
 * ⚠ ⟨¥⟩ HAS NO ENTRY, AND THE OMISSION IS THE DECISION. The sen was demonetised in 1953, so a yen price is
 * not written with a fractional part at all; a decimal ¥ amount is some other quantity wearing a currency
 * sign, and inventing a subunit for it would assert a word Japanese money has not used in seventy years.
 * The rule declines it and the general currency rule at step 1 reads it as the decimal it is.
 */
const SUBUNIT: Readonly<Record<string, [string, string]>> = {
    $: ["cent", "cents"], "€": ["cent", "cents"], "£": ["penny", "pence"],
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
/**
 * ⚠ THE MONTH LIST WITHOUT ⟨may⟩, for the weekday gate below and nothing else. `may` is a modal verb, and
 * two of the weekday keys take a bare date complement — so "they wed May 5" (they married on the 5th) read
 * as *ðeᶦ wˈɛnzdi meᶦ fˈɪfθ*, "they WEDNESDAY may fifth". The cost is `Wed May 7`, which now keeps the verb
 * reading it would have had anyway; the gain is that the commonest verb+month collision in the language
 * cannot reach the rule at all. `MONTH_ABBREV` excludes `may` for the mirror-image reason.
 */
const MONTH_ALT_NO_MAY = MONTH_ALT.split("|").filter((m) => m !== "may").join("|");

/**
 * THREE-LETTER MONTH ABBREVIATIONS, expanded to the month NAME. Unexpanded they reach the g2p as ordinary
 * words and are read as such — `Jan` as *d͡ʒˈæn*, `Mar` as *mˈɑːɹ*, `Dec` as *dˈɛk* — and the date rules
 * below (the ordinal day at step 4, the pair-wise year at step 5) key on the full name, so an abbreviated
 * date loses BOTH the month and its year reading.
 *
 * ⚠ `may` IS ABSENT: it is already the full name, and listing it would let the modal verb into a date rule.
 * ⚠ EVERY OTHER KEY IS ALSO A NAME OR A WORD (`Jan`, `Mar`, `Aug`, `Sept`), so the rule is gated on an
 * ADJACENT DIGIT — a day before or a day/year after. That is what a date looks like and what a person's
 * name does not; `Jan said so` is untouched. The dot, where there is one, is consumed for the usual reason:
 * left in place it becomes a phrase break in the middle of the date.
 */
const MONTH_ABBREV: Readonly<Record<string, string>> = {
    jan: "january", feb: "february", mar: "march", apr: "april", jun: "june", jul: "july",
    aug: "august", sep: "september", sept: "september", oct: "october", nov: "november", dec: "december",
};
/** Longest-first, so `sept` is claimed before `sep` can take its first three letters. */
const MONTH_ABBREV_ALT = Object.keys(MONTH_ABBREV).sort((a, b) => b.length - a.length).join("|");

/**
 * WEEKDAY ABBREVIATIONS, expanded to the weekday NAME — the leading field of a printed timestamp
 * (`Mon, 02 Jan 2006 15:04:05 -0700`), which otherwise reads as the word *mˈoᶷn*.
 *
 * ⚠ THE GATE HERE IS MUCH TIGHTER THAN THE MONTH RULE'S, because four of these keys are ordinary English
 * words in their own right — `sat` and `wed` are verbs, `sun` and `mon` are nouns — and a bare digit after
 * them is NOT rare ("he sat 5 metres away"). So a digit alone does not license the expansion: a MONTH NAME
 * must follow, either immediately (`Sat. January 5`) or after a day number (`Mon, 02 January 2006`). That
 * is the one context in which the word reading is impossible, and it costs nothing — a weekday written
 * abbreviated without a date beside it has no date frame to be part of.
 */
const WEEKDAY_ABBREV: Readonly<Record<string, string>> = {
    mon: "monday", tue: "tuesday", tues: "tuesday", wed: "wednesday", weds: "wednesday",
    thu: "thursday", thur: "thursday", thurs: "thursday", fri: "friday", sat: "saturday", sun: "sunday",
};
/** Longest-first: `thurs` before `thur` before `thu`, `tues` before `tue`, `weds` before `wed`. */
const WEEKDAY_ABBREV_ALT = Object.keys(WEEKDAY_ABBREV).sort((a, b) => b.length - a.length).join("|");

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

/** The Unicode relational operators, none of which were read at all. Ordered longest-first is not needed
 *  — no sign is a prefix of another — but the ASCII `<`/`>` are deliberately NOT here: they are handled
 *  above under a digit gate, because they can be markup and these cannot. */
const RELATIONAL: ReadonlyArray<readonly [string, string]> = [
    ["\u2265", "greater than or equal to"],
    ["\u2264", "less than or equal to"],
    ["\u2260", "not equal to"],
    ["\u00b1", "plus or minus"],
    ["\u2248", "approximately"],
];

/** Hoisted, like every other pattern in this file — the loop below runs on every utterance, and none of
 *  these signs is a regex metacharacter, so the interpolation that built them per call bought nothing. */
const RELATIONAL_RE: readonly RegExp[] = RELATIONAL.map(
    ([sign]) => new RegExp(`[ \\t]*${sign}[ \\t]*`, "gu"),
);

/** The SLASHED unit keys only (`km/h`, `m/s`, `btu/hr/sf`), for the bare-rate arm — see step 6a2. */
const BARE_RATE_RE = new RegExp(
    `(?<![\\p{L}\\d])(${Object.keys(UNITS).filter((k) => k.includes("/"))
        .sort((a, b) => b.length - a.length).join("|")})(?![\\p{L}\\d])`,
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

    // 0a2) `Rev.` IS "revision" BEFORE A DESIGNATOR AND "reverend" BEFORE A NAME. It is in the
    //      fixed-reading table below, so a drawing title block's "Rev. B, 2025-10-21" read as
    //      *reverend B*. ⚠ THIS MUST RUN BEFORE THAT TABLE, which claims the token unconditionally.
    //      ⚠ THE DISCRIMINATOR IS WHAT FOLLOWS, the same shape `st.`/`dr.` already use — but their
    //      neighbour test reads a following LOWERCASE word, and a revision designator is a capital
    //      or a digit, so this needs its own arm rather than an entry in theirs.
    //      A designator is a lone capital or a number. `(?![a-z.])` is what separates it from a name:
    //      `Rev. Smith` has a capital followed by lowercase, and `Rev. J. Smith` a capital followed by
    //      a PERIOD — a personal initial, which is the shape that would otherwise be claimed wrongly.
    //      ⚠ IT ALSO CONSUMES THE DOT, which the table below could not: that arm requires a following
    //      LETTER, so `Rev. 3` matched nothing and its dot survived into the clause segmenter as a
    //      phrase break — the same defect `cf.`/`viz.`/`max.` have entries for.
    //      ⚠ NO `i` FLAG, AND THE LITERAL IS CASED BY HAND INSTEAD. With `i`, the `[a-z]` inside the
    //      lookahead matches UPPERCASE too, so `(?![a-z.])` rejected a following capital and the
    //      designator test quietly inverted itself — `Rev. AB` fell through to "reverend". The flag
    //      has to stay off for the two letter classes here to mean what they say.
    s = rewrite(s, /\b[Rr][Ee][Vv]\.?\s+(?=(?:[A-Z](?![a-z.])|\d))/gu, "revision ");

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
    //     `TY2024` read as the WORD "tie" followed by the number — `tʰˈaᶦ tʰˈuː θˈaᶷzənd twˈɛnti fˈɔːɹ`.
    //     Two letters with a vowel, so the initialism pass's phonotactic gate calls it pronounceable and
    //     hands it to the g2p, exactly as `IR` was. Financial and accounting documents write the fiscal
    //     year this way throughout.
    //     ⚠ THE FOUR-DIGIT YEAR IS THE GUARD, and it is what makes this safe to claim case-insensitively
    //     at all: bare `TY` is "thank you" in casual writing, and `ty` is a name fragment. Nothing but a
    //     year follows it in this shape. The space is optional because documents write both.
    s = rewrite(s, /\bTY\s?(\d{4})\b/gu, "Tax Year $1");

    //     INITIALISM GLOSSES — an all-caps initialism read as the WORDS it stands for rather than as its
    //     letters. Keyed on the EXACT uppercase form and applied case-sensitively, which is what keeps
    //     `Ir` (the element symbol for iridium) and a lowercase `ir` out of it.
    //     ⚠ Each entry is a judgement that one expansion dominates the others in the text this reader
    //     sees, and it is not reversible by context — `IR` is also Investor Relations, incident response
    //     and the ISO code for Iran. Add an entry only for a reading that is the overwhelming one, and
    //     record who asked for it, because nothing downstream can tell that the choice was made.
    //     `IR` (infrared) additionally fixes a misreading: it has a vowel and a legal coda, so the
    //     phonotactic gate in the initialism pass calls it PRONOUNCEABLE and leaves it to the g2p, which
    //     invents the word [ˈɪɹ] — neither "infrared" nor the letter names.
    s = rewrite(s, /\bIR\b/gu, "infrared");

    //     `max` is the one abbreviation here that must be CASE-SENSITIVE, so it cannot join the table
    //     above (whose arms carry `i` on purpose — `Dr.`/`dr.` are the same abbreviation). `Max` is a
    //     common given name, and a sentence-final "…is Max." would otherwise read as "maximum".
    //     Capitalisation is the only signal available at this stage: normalization runs before the POS
    //     tagger, so the verb cannot be identified by tag. It does not have to be — the verb takes a
    //     particle ("max out", "max it out", "maxed out"), and `maxed`/`maxing` are different tokens
    //     this rule never sees. So: lowercase only, and not when `out` follows within two words.
    //     ⚠ RESIDUAL, both unavoidable at this stage and both rare: a lowercase name ("max said so")
    //     expands, and a particle-less verb ("max the settings") expands. A sentence-initial "Max 40
    //     characters" does NOT expand, because it cannot be told from the name.
    s = rewrite(s, /\bmax\.(\s+)(?=[\p{L}\p{N}])/gu, "maximum$1");
    s = rewrite(s, /\bmax\b(?!\.?\s+(?:\w+\s+)?out\b)/gu, "maximum");

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

    // 0b2) MONTH AND WEEKDAY ABBREVIATIONS → the full name. BEFORE steps 3-5, whose date machinery all keys
    //      on the spelled-out month: the ordinal day (`january 5` → `january 5th`) and the pair-wise year
    //      (`january 2011` → `january 20 11`) are both invisible to `Jan`, so an abbreviated date lost the
    //      month's reading AND the year's. Also before 0d, whose space-grouping guard is the month list —
    //      `Jan 21 356 bce` is only protected once the month is a name.
    //      ⚠ The MONTH rule's gate is an adjacent DIGIT, in either direction, which is what makes it safe on
    //      the keys that are also personal names. See MONTH_ABBREV.
    s = rewrite(s, new RegExp(`\\b(${MONTH_ABBREV_ALT})\\b\\.?(?=[ \u00a0]+\\d)`, "giu"),  // space, NBSP
        (m0, ab: string) => MONTH_ABBREV[ab.toLowerCase()] ?? m0);
    s = rewrite(s, new RegExp(`(?<=\\b\\d{1,2}[ \u00a0])(${MONTH_ABBREV_ALT})\\b\\.?`, "giu"),  // space, NBSP
        (m0, ab: string) => MONTH_ABBREV[ab.toLowerCase()] ?? m0);
    //      ⚠ The WEEKDAY rule runs SECOND and requires a MONTH NAME, so it reads what the two rules above
    //      just produced. Its keys include four ordinary English words, so a digit alone cannot license it.
    //      See WEEKDAY_ABBREV.
    s = rewrite(s,
        // space, NBSP
        new RegExp(`\\b(${WEEKDAY_ABBREV_ALT})\\b\\.?(?=,?[ \u00a0]+(?:\\d{1,2}[ \u00a0]+)?(?:${MONTH_ALT_NO_MAY})\\b)`, "giu"),
        (m0, ab: string) => WEEKDAY_ABBREV[ab.toLowerCase()] ?? m0);

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
    s = rewrite(s, SPACE_GROUP, (m0) => m0.replace(/[ \u00a0\u202f\u2009]/gu, ""));  // space, NBSP, NNBSP, thin space

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

    // 0e2) A TIMEZONE OFFSET ON A PRINTED TIMESTAMP — `15:04:05 -0700`, `2026-09-11T08:30:00+05:30`.
    //      ⚠ IT MUST RUN BEFORE THE SIGN RULES AT 0f/0f2, which claim the sign first and leave the four
    //      digits to the number path: `-0700` read as *nˈɛɡət̬ɪv sˈɛvən hˈʌndɹəd* — "negative seven hundred",
    //      a quantity with no unit, where what the field says is seven HOURS. The offset is a displacement
    //      in hours and minutes, so it is spoken as one.
    //      ⚠ "MINUS", NOT "NEGATIVE", and the split from 0f is deliberate. 0f's word is the SIGN ON AN
    //      AMOUNT ("negative forty Celsius"); an offset is a SHIFT APPLIED to a clock, which is the sense
    //      English spends `minus` on — "minus seven hours", "New York is minus five".
    //      ⚠ THE GATE IS THE CLOCK IN THE LOOKBEHIND. Nothing else licenses this reading, and without it a
    //      bare `-0700` is just a negative number.
    //      `HH:MM`, and `HH:MM:SS` — the two clock shapes an offset can hang off.
    //      ⚠ NO `\b` ON THE HOUR. These are LOOKBEHINDS, so they only have to succeed, not to span the whole
    //      field — and requiring a boundary made the ISO form fail outright: in `…11T15:04:05-07:00` there
    //      is no word boundary between the date's `11` and the `T`, nor between the `T` and the hour, so the
    //      offset went unclaimed and `-07:00` read as *sˈɛvən əklˈɑːk*, "seven o'clock".
    const CLOCK = "\\d{1,2}:[0-5]\\d";
    const CLOCK_SEC = `${CLOCK}:[0-5]\\d`;
    const SIGN = "([+\\-\u2212])";
    const offsetWords = (m0: string, sign: string, hh: string, mm: string): string => {
        const h = Number(hh), m = Number(mm);
        if (h > 14 || m > 59) return m0; // outside the range any real offset lives in — not an offset
        // `+0000` is UTC itself, and "plus zero hours" is not a thing anyone says. The letters are left for
        // the initialism pass, which already reads UTC as three letter names.
        if (h === 0 && m === 0) return " UTC";
        const word = sign === "+" ? "plus" : "minus";
        const hours = h === 0 ? "" : ` ${h} ${h === 1 ? "hour" : "hours"}`;
        const mins = m === 0 ? "" : ` ${m} ${m === 1 ? "minute" : "minutes"}`;
        return ` ${word}${hours}${mins}`;
    };
    //      THE COMPACT FORM (RFC 2822, and what `date` prints) — four digits, no separator. TWO ARMS, and the
    //      split is the SAME GUARD the colon form carries below: `09:00-1200` and `10:15-1130` are RANGES
    //      with the shape of a glued offset, and reading them as one says "nine o'clock minus twelve hours".
    //      A GLUED offset must therefore show the seconds field, which a range never writes; a SPACED one
    //      needs no seconds, because a range spaced on one side only (`09:00 -1200`) is not how one is
    //      written. The `h > 14` test inside `offsetWords` is not enough on its own — it rescues only the
    //      ranges that end after 14:00.
    s = rewrite(s, new RegExp(`(?<=${CLOCK_SEC})[ \u00a0]*${SIGN}(\\d{2})(\\d{2})\\b`, "gu"),  // space, NBSP
        offsetWords as Parameters<typeof rewrite>[2]);
    s = rewrite(s, new RegExp(`(?<=${CLOCK})[ \u00a0]+${SIGN}(\\d{2})(\\d{2})\\b`, "gu"),  // space, NBSP
        offsetWords as Parameters<typeof rewrite>[2]);
    //      ⚠ THE COLON FORM (ISO 8601) REQUIRES THE SECONDS FIELD, and that is not decoration — `12:30-14:00`
    //      is a TIME RANGE with exactly the shape of a colon offset, and reading it as one says "minus
    //      fourteen hours" for an afternoon. A range is written without seconds; an ISO timestamp carrying
    //      an offset has them. That is the only thing separating the two, so it is required.
    s = rewrite(s, new RegExp(`(?<=${CLOCK_SEC})[ \u00a0]*${SIGN}(\\d{2}):(\\d{2})\\b`, "gu"),  // space, NBSP
        offsetWords as Parameters<typeof rewrite>[2]);
    //      `Z` is the same field spelled as a letter (`15:04:05Z`); left bare it reads as the letter zee
    //      glued to the seconds.
    s = rewrite(s, new RegExp(`(?<=${CLOCK}(?::[0-5]\\d)?)Z\\b`, "gu"), " UTC");

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
    //      ⚠ THE `T` SEPARATOR HAS TO BE CONSUMED, and a trailing `\b` could not even see the date it was
    //      attached to: in `2026-09-11T08:30:00Z` there is NO word boundary between the `11` and the `T`, so
    //      the whole ISO arm declined and the commonest printed UTC form read as four bare numbers with a
    //      stray letter tee between them. The `T` is claimed only when a clock follows it, which is the one
    //      thing it can be; every other trailing context still takes the plain boundary test.
    s = rewrite(s, /\b(\d{4})-(\d{2})-(\d{2})(?:T(?=\d{1,2}:)|(?![\p{L}\d-]))/gu,
        (m0, y: string, mo: string, d: string) => {
            const date = isoDate(Number(y), Number(mo), Number(d));
            return date === undefined ? m0 : m0.endsWith("T") ? `${date} ` : date;
        });
    s = rewrite(s, /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g, (m0, mo: string, d: string, y: string) =>
        isoDate(Number(y), Number(mo), Number(d)) ?? m0);

    // 0f1) MONEY with cents — "three dollars fourteen cents", not "three point one four dollars". A decimal
    //      reading of a price is wrong in a way listeners notice. Must precede the general currency rule.
    // ⚠ THE FRACTIONAL PART NEEDS ITS UNIT NOUN, and without one the number does not merely sound bare —
    //      IT JOINS THE NEXT CLAUSE. `for $3.14 and the 2nd time` read "for three dollars FOURTEEN AND the
    //      second time", where the listener hears the cents as the head of the following phrase. A bare
    //      integer with no unit has nothing to close it, so the clause boundary lands in the wrong place.
    // ⚠ AN AMOUNT UNDER ONE UNIT IS SPOKEN AS THE FRACTION ALONE. "zero dollars ninety nine cents" is
    //      nobody's reading of `$0.99`; the whole part is written for the column, not to be said.
    // ⚠ AND THE TWO PARTS ARE JUXTAPOSED, NOT JOINED WITH "and". The conjunction reads more formally and is
    //      what espeak-ng emits, but it MERGES TWO PRICES INTO ONE: with it, `$1.00 and $0.50` and `$1.50`
    //      both come out "1 dollar and 50 cents", because the elided whole part above leaves the second
    //      amount looking like the first one's fraction. That is the very failure this rule exists to
    //      prevent — a boundary landing in the wrong place — so the word that causes it cannot be spent
    //      here. Juxtaposition keeps the two distinguishable and is an ordinary reading of a price.
    // ⚠ EXCEPT BEFORE A MAGNITUDE WORD, where the DECIMAL reading is the right one: `$5.50 million` is five
    //      and a half million dollars, not five dollars fifty. This rule runs first and consumes the sign,
    //      so without the decline step 1's magnitude arm never saw the amount and the magnitude was
    //      orphaned after the unit noun — "5 dollars 50 cents million".
    // ⚠ `(?![\p{L}\p{M}\d])`, NOT `\b` — and the `u` flag is required for it. JS defines `\b` on ASCII
    // `\w`, so `$1.50é` was read as money while `$1.50a` was not (#949, #950).
    // ⚠ KNOWN LIMIT, AND IT IS A DELIBERATE NON-FIX: a symbol GLUED to the cents digits loses its adjacency
    // to a digit, because the unit noun now sits between them, and the rules that speak those symbols all
    // require that adjacency. `$1.50%` and `$2.50°` therefore drop the sign, where they used to read "1
    // dollar 50 percent" and "…50 degrees". Neither reading is right — a price is not a percentage and not
    // a temperature — and `$1.50+` and `$1.50/kg` strand their symbol on this rule's own account either
    // way. The shapes are malformed input, so no correct reading is being given up; do not "fix" this by
    // dropping the unit noun, which is the content that matters.
    // ⚠ THE DIGIT IN THAT CLASS IS LOAD-BEARING TOO. A THIRD DECIMAL IS NOT CENTS — `$3.499` is a pump
    // price, and a 4-decimal FX rate has the same shape — and matching only the first two stranded the rest
    // ON THE UNIT NOUN: "3 dollars 49 cents9", a bare "nine" with nothing to attach to. Declining hands the
    // whole amount to the general currency rule, which reads it as the decimal it is.
    s = rewrite(s, /([$£€¥])\s?(\d[\d,]*)\.(\d{2})(?![\p{L}\p{M}\d])(?!\s+(?:million|billion|trillion|thousand))/gu,
        (m0, sym: string, int: string, cents: string) => {
            const sub = SUBUNIT[sym];
            if (sub === undefined) return m0; // no fractional unit — see SUBUNIT
            const [sg, pl] = CURRENCY[sym]!;
            const whole = int.replace(/,/g, "");
            const unit = /^1$/.test(whole) ? sg : pl;
            const n = Number(cents);
            if (n === 0) return `${int} ${unit}`;
            const frac = `${n} ${n === 1 ? sub[0] : sub[1]}`;
            return /^0+$/.test(whole) ? frac : `${int} ${unit} ${frac}`;
        });

    // 0f2) PLUS. The mirror of the minus rule: a dropped sign is silent content loss. Covers the attached
    //      form too (UTC+1 → "UTC plus 1").
    s = rewrite(s, /(\S)\+\s?(\d)/gu, "$1 plus $2");
    s = rewrite(s, /(^|\s)\+\s?(\d)/gu, "$1plus $2");
    //      ⚠ BOTH ARMS ABOVE REQUIRE A DIGIT ON THE RIGHT, so a POSTFIX plus was dropped outright —
    //      the whole reported class, and the same shape the Unicode relationals were fixed for: a
    //      pattern that can only bind to an operand it does not have, failing silently and leaving a
    //      fluent sentence with the content gone.
    //          C7+ → "C seven"    18+ → "eighteen"    100+ people → "a hundred people"
    //          A+  → "ə"          C++ → "C"           Na+ → "na"
    //      ⚠ THE RUN IS MATCHED WHOLE, not one sign at a time, because `C++` is two of them and a
    //      per-sign rule reads the first and STRANDS the second: `String.replace` scans the original
    //      string, so after consuming `C+` the next `+` no longer has a letter before it.
    s = rewrite(s, /([\p{L}\d])(\++)(?![ \t\u00a0]?\d)/gu,  // space, tab, NBSP
        (_m, head: string, signs: string) => head + " plus".repeat(signs.length));
    //      …and the same sign between two NON-DIGIT operands, which the infix arm's digit gate also
    //      misses: `a + b` read as "a b" and `the + sign` as "the sign".
    //      ⚠ HORIZONTAL SPACE ONLY. With `\s` a newline satisfies the left guard and a list written
    //      with `+` markers turns every bullet into the word "plus".
    s = rewrite(s, /(?<=\S)[ \t\u00a0]\+[ \t\u00a0](?=\S)/gu, " plus ");  // space, tab, NBSP

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
    //    ⚠ THE SECONDS FIELD IS PART OF THE MATCH, and leaving it out was content loss dressed as a pause:
    //    `15:04:05` matched only its first two fields, so the second colon SURVIVED into the clause
    //    segmenter and read as *fɪftˈiːn ˈoᶷ fˈɔːɹ , fˈaᶦv* — a phrase break in the middle of a timestamp
    //    and a stray "five" with nothing to attach to. A printed timestamp is exactly where this shape
    //    occurs, so the clock rule has to own all three fields.
    //    ⚠ `:00` SECONDS ARE NOT SPOKEN. "eight thirty and zero seconds" is nobody's reading of `08:30:00`,
    //    which is the commonest timestamp shape there is; the zero field is a formatting artifact of a
    //    fixed-width clock, not content. A non-zero field IS content and is spoken.
    //    ⚠ THE MERIDIEM TRAILS THE WHOLE CLOCK, seconds included. Folded into the hour-and-minute string it
    //    is spoken in the middle of the time — `8:30:45 pm` read "eight thirty PEE EM and forty-five
    //    seconds" — so it is appended last, after the seconds it must follow.
    //    ⚠ AND `o'clock` IS ONLY FOR A BARE CLOCK. It is suppressed before a meridiem for the reason it
    //    always was ("3 o'clock pm"), and before a seconds field for the same one.
    s = rewrite(s, /\b(\d{1,2}):([0-5]\d)(?::([0-5]\d))?\b(\s*[ap]m\b)?/gu,
        (_m, h: string, mm: string, ss?: string, ap?: string) => {
            const suffix = ap ?? "";
            const n = ss === undefined ? 0 : Number(ss);
            const secs = ss === undefined || ss === "00" ? "" : ` and ${n} ${n === 1 ? "second" : "seconds"}`;
            const body = mm === "00"
                ? (suffix || secs ? `${h}` : `${h} o'clock`)
                : mm.startsWith("0") ? `${h} oh ${Number(mm)}` : `${h} ${mm}`;
            return `${body}${secs}${suffix}`;
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

    // 6a2) A SLASHED RATE STANDING ALONE, with no number in front of it — `BTU/hr/sf` as a column
    //      header or an axis label, which is the shape the report arrived in. The rule above requires a
    //      NUMBER, deliberately, because a bare `km` in prose is mostly not a unit; that reasoning does
    //      NOT extend to a slashed key, because a slash inside a token can never be a word. So these are
    //      claimed wherever they stand.
    //      ⚠ ORDERED AFTER the number rule, or it would steal `50 km/h` and drop the count agreement.
    //      ⚠ THE LOOKAROUNDS ARE WHAT KEEP URLS OUT: `example.com/s/page` contains `m/s`, and without the
    //      letter lookbehind it reads as "meters per second" mid-path.
    s = rewrite(s, BARE_RATE_RE, (m0: string) => {
        const forms = resolveUnitSymbol(UNITS, UNITS_FOLDED, m0);
        return forms === undefined ? m0 : forms[0];
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
    //    ⚠ AN ALL-CAPS PAIR AROUND THE AMPERSAND IS ONE INITIALISM, AND IS SPELLED AS ONE — and it has to be
    //    claimed HERE, before the generic arms below turn the sign into the word, because after that the two
    //    halves are ordinary tokens and the dictionary answers for them SEPARATELY. That is where the
    //    reading goes wrong, and it goes wrong silently: `R&D` survives only because ⟨R⟩ and ⟨D⟩ are not
    //    words, while a half that IS a recorded token is read as that token — a two-letter half collides
    //    with an abbreviation entry and comes out as the expanded WORD, and a half like ⟨ED⟩ comes out as
    //    the name *ˈɛd*. Neither the initialism pass nor the lexicon can see the construction, because by
    //    then the ampersand that proves it is gone.
    //    THE DISCRIMINATOR IS CONTIGUITY: `A&B` with no space is a single orthographic word, and no
    //    conjoined phrase is written that way — `College of Arts & Sciences` and `Johnson & Johnson` both
    //    have spaces, and neither half is an all-caps run. So the rule claims the glued all-caps shape and
    //    leaves every spaced one to the generic arms (AT&T, S&P, R&D, PB&J, M&A, B&B).
    //    ⚠ CONTIGUITY ALONE IS NOT ENOUGH, because a TITLE set in capitals has the same shape: `LAW&ORDER`,
    //    `ROCK&ROLL`, `MOM&POP` were all spelled letter by letter. Two further gates, both measured against
    //    every glued all-caps pair in the mined corpora (89 instances, every one an initialism):
    //      · EACH HALF AT MOST 3 LETTERS. The longest half attested anywhere is TWO (`AT&T`, `BM&F`), so
    //        this costs nothing and excludes `ORDER`, `ROLL`, `RADIO`, `CRAFTS`.
    //      · AT LEAST ONE HALF UNSAYABLE AS A WORD, which is the OOV signal `core/initialisms.ts` already
    //        owns — a pair is an initialism when some half could not be read any other way. `MOM&POP` has
    //        two readable halves and declines; `SR&O` licenses on ⟨sr⟩, `AT&T` on ⟨t⟩, `S&P` on ⟨s⟩.
    //        The only attested pairs this declines are all-vowel ones (`A&E`, `A&I`), and a bare vowel
    //        letter already reads as its letter name, so the generic arm gives the same words anyway.
    //    ⚠ THE ENTITY IS CASE-INSENSITIVE AND THE LETTER RUNS ARE NOT, so the case folding has to be spelled
    //    into the entity alone. `&AMP;` is valid HTML5 and is what uppercased markup carries; matching only
    //    the lowercase spelling let this rule fall through to its bare-`&` arm, where `[A-Z]{1,5}` swallowed
    //    the `AMP` and left the `;` and the real right half stranded — `R&AMP;D` → "r and ay m p;D". An `i`
    //    flag cannot do it: it would widen `[A-Z]` too and claim every lowercase pair.
    s = rewrite(s, /(?<![\p{L}\p{M}])([A-Z]{1,3})&(?:[aA][mM][pP];)?([A-Z]{1,3})(?![\p{L}\p{M}])/gu,
        (m0, a: string, b: string) => {
            const isInitialism = (half: string): boolean =>
                isUnreadableEnglish(half.toLowerCase()) || ACRONYM_LETTERS.has(half.toLowerCase());
            return isInitialism(a) || isInitialism(b) ? `${spellLetters(a)} and ${spellLetters(b)}` : m0;
        });
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

    //    ⚠ THE UNICODE RELATIONALS TAKE NEITHER GATE, and every one of them was silently DROPPED.
    //    `<`/`>` are digit-gated above because they can be markup, and `=` takes the two-operand house
    //    pattern; `≥ ≤ ≠ ± ≈` can be nothing but themselves, so they are claimed WHEREVER they stand —
    //    including the PREFIX position, which is where they mostly occur. "Panels lit at ≥30%" has no
    //    left operand for an infix pattern to bind to, and read as "…at thirty percent": the threshold
    //    gone and the sentence still fluent.
    //    ⚠ `≠` AND `±` ARE THE ONES THAT CHANGE MEANING WHEN DROPPED, which is the class this file ranks
    //    worst everywhere else ("missing word ≥ wrong word ≫ invented number" — but a dropped `≠` is not
    //    a missing word, it is the INVERSE claim): `a ≠ b` read as "a b", and `5 ± 0.2` as "five zero
    //    point two", which is a wrong number rather than a missing one.
    //    The separators are consumed on both sides so the prefix form does not leave a doubled space.
    //    A DASH BETWEEN TWO NUMBERS IS A RANGE, and it was dropped outright: "the 5–15% flammable
    //    range" read as "five fifteen percent", and `2019–2020` as "twenty nineteen twenty twenty".
    //    ⚠ THE TYPOGRAPHIC DASHES ONLY — figure, en and em. The ASCII hyphen is NOT claimable here and
    //    the measurement says why: `2024-01-15` is already read as a DATE by the rule above, `555-1234`
    //    is a phone number and `3-2` is a score, so claiming it would turn all three into ranges. A
    //    typographic dash is none of those things — it is what a document uses for a span.
    //    ⚠ AND NOT U+2212 MINUS, which is a sign and belongs to the negatives rule at step 0f.
    //    ⚠ UNSPACED, because a SPACED en dash is a parenthetical break ("the result — 15 — was high"),
    //    not a span. The range form is written tight in every style guide that has an opinion.
    //    Ordered after the year rule, so `2019–2020` has already become `20 19–20 20` and the dash is
    //    still between digits: the halves read pair-wise and the range still says "to".
    s = rewrite(s, /(\d)[\u2012\u2013\u2014](?=\d)/gu, "$1 to ");

    //    A SPACE-GUARDED DASH IS A PARENTHETICAL BREAK, and it was DROPPED OUTRIGHT — the rule above
    //    already said so ("a SPACED en dash is a parenthetical break, not a span") and then left the
    //    break unspoken. Reported against a question with a spaced hyphen in it: the two halves ran
    //    together with no boundary at all, where a comma in the same slot pauses.
    //    ⚠ THE PAUSE IS A COMMA, NOT A WORD. `clausePunctuation` already maps `;` and `:` to `,` for
    //    exactly this reason — the mark is a prosodic fact, and inventing a connective ("dash", "to")
    //    would be reading something the writer did not write.
    //    ⚠ SPACE-GUARDED ON BOTH SIDES IS THE WHOLE DISAMBIGUATION, and it is what keeps this off the
    //    word-joiner: `well-known`, `state-of-the-art` and `re-enter` are tight against their letters
    //    and never match. The left guard is a NON-SPACE rather than `\s`, so a list marker at the start
    //    of a line (`\n- item`) is not claimed either — its dash has no word before it.
    //    ⚠ ASCII `-` AND `--` ARE INCLUDED HERE though the range rule above refuses them, and the two
    //    refusals are about different things: there, an unspaced `5-15` is ambiguous against a date, a
    //    phone number and a score; here, the spaces have already ruled every one of those out.
    //    ⚠ EXCEPT BETWEEN TWO NUMBERS, WHICH IS A SPAN AND NOT A PARENTHESIS — `Sejong (1418 – 1450)`
    //    and `from 1990 - 1995` are date ranges written loose, and two pinned tests say what they read
    //    as today. A pause is not obviously wrong there, but it is not this report's question either,
    //    and those pins came with corpus measurement behind them; changing a measured reading as a
    //    side effect of an unrelated fix is how a regression gets in wearing a green gate. So the two
    //    arms below claim everything EXCEPT digit-on-both-sides, and the spaced numeric span keeps its
    //    current reading — which is no boundary at all, recorded in the investigation doc as open.
    s = rewrite(s, /(?<=[^\s\d])[ \t\u00a0]+[-\u2010\u2011\u2012\u2013\u2014\u2015]+[ \t\u00a0]+(?=\S)/gu, ", ");  // space, tab, NBSP
    s = rewrite(s, /(?<=\d)[ \t\u00a0]+[-\u2010\u2011\u2012\u2013\u2014\u2015]+[ \t\u00a0]+(?=[^\s\d])/gu, ", ");  // space, tab, NBSP
    //    …and an UNSPACED EM DASH is the same break in the other house style — `the answer—a long
    //    one—arrived` is the standard US form and was dropped just as completely.
    //    ⚠ THE EM DASH ONLY. An unspaced EN dash is a JOINER in English (`Bose–Einstein`), which must
    //    not gain a pause, and between digits it is a span the rule above has already turned into
    //    "to". An em dash is neither of those things in any English style guide.
    s = rewrite(s, /(?<=[^\s\d])\u2014+(?=[^\s\d])/gu, ", ");

    for (let i = 0; i < RELATIONAL.length; i++)
        s = rewrite(s, RELATIONAL_RE[i]!, ` ${RELATIONAL[i]![1]} `);

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

/**
 * A LETTER RUN AS ITS LETTER NAMES, space-separated. Declared here beside `LETTER_NAME` rather than beside
 * its caller, so the ampersand-initialism rule at step 8 spells a run the same way the initialism pass does
 * — the ⟨a⟩ exception included, which is the one letter the dictionary does not name for us.
 */
function spellLetters(run: string): string {
    return [...run.toLowerCase()].map((l) => LETTER_NAME(l) ?? l).join(" ");
}

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
