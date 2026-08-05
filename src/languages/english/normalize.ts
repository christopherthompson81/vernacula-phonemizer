/**
 * English TEXT NORMALIZATION (#562) — rewrite non-lexical tokens into speakable words BEFORE the
 * tokenizer, so the existing number/ordinal/OOV machinery does the pronouncing. Every rule emits plain
 * words and digits the pipeline already handles (e.g. a year becomes two 2-digit numbers), which keeps
 * this layer free of IPA and lets the POS tagger / stress logic see a flat word stream.
 *
 * Found by close-reading the FLEURS corpus (Run 28): % and $ were DROPPED outright (silent content
 * loss), roman numerals spelled as letter soup (viii → vɪiːʲiː), km read as a word, dates read as
 * cardinals, clock times split by a spurious clause pause, and years read as "one thousand nine
 * hundred …". Ordinal suffixes (16th), grouped/decimal numbers, and initialisms (bbc → biːbisiː via
 * the OOV G2P) already worked and are untouched.
 *
 * ORDER MATTERS and is documented per rule below. The pass is idempotent — every rewrite removes the
 * pattern it matches.
 */

import { makeInitialismNormalizer, makeUnreadableTest } from "../../core/initialisms.ts";
import { romanToInt } from "../../core/roman.ts";
import { MANIFEST } from "./manifest.ts";

// ── Roman numerals ──────────────────────────────────────────────────────────────────────────────────
// A closed, conservative set (2–20, minus vi and xi): FLEURS text is lowercased, so "VI"/"vi" cannot be
// told apart, and vi (the editor) / xi (the name/letter) are real words. Single letters (i, v, x) are
// never treated as numerals. Larger romans (xxi+, l, c, m compounds) collide with too many words (mix
// is a valid 1009) and are left to the OOV G2P — this list covers monarchs, wars, chapters and film
// sequels, which is what actually occurs in prose.
const ROMAN: Record<string, number> = {
    ii: 2, iii: 3, iv: 4, vii: 7, viii: 8, ix: 9, xii: 12, xiii: 13, xiv: 14,
    xv: 15, xvi: 16, xvii: 17, xviii: 18, xix: 19, xx: 20,
};
// Context words after which a roman is a CARDINAL (world war ii → "world war 2"); anywhere else it is
// read as a REGNAL ordinal (henry viii → "henry the 8th"), the reading English gives name-attached
// numerals. Known limit, stated: a bare medical "iv" or list-marker "(ii)" gets the regnal reading.
const ROMAN_CARDINAL_CTX =
    /\b(war|chapter|part|act|section|volume|book|phase|stage|grade|class|type|level|apollo|rocky|bowl|wrestlemania|olympiad|super)$/i;

// ── Units and symbols ───────────────────────────────────────────────────────────────────────────────
// Only unambiguous multi-character abbreviations, and only AFTER a number ("40 km"); bare "km" in prose
// stays. Single letters (m, g, s) are far too ambiguous and deliberately absent. [sg, pl] for count
// agreement: "1 km" → kilometer, "40 km" → kilometers.
const UNITS: Record<string, [string, string]> = {
    km: ["kilometer", "kilometers"], cm: ["centimeter", "centimeters"], mm: ["millimeter", "millimeters"],
    kg: ["kilogram", "kilograms"], mg: ["milligram", "milligrams"], lb: ["pound", "pounds"],
    lbs: ["pounds", "pounds"], oz: ["ounce", "ounces"], ft: ["foot", "feet"], mi: ["mile", "miles"],
    mph: ["miles per hour", "miles per hour"], kph: ["kilometers per hour", "kilometers per hour"],
    // Slash and degree units. "km/h" occurs 15× in the corpus and read as "kilometers aitch"; the degree
    // signs read as the bare letter names ("20 °C" → "twenty see"). Longest keys must match first.
    "km/h": ["kilometer per hour", "kilometers per hour"], "m/s": ["meter per second", "meters per second"],
    "miles/hour": ["mile per hour", "miles per hour"], "mbit/s": ["megabit per second", "megabits per second"],
    "yards/meters": ["yard per meter", "yards per meters"],
    "°c": ["degree Celsius", "degrees Celsius"], "°f": ["degree Fahrenheit", "degrees Fahrenheit"],
    // ℃ and ℉ are SINGLE CODE POINTS (U+2103, U+2109), so the two keys above cannot reach them and `20℃`
    // read as bare "twenty" — the whole unit gone, not merely the sign. They are in the RAWMARK leak class
    // for exactly this reason. Found while reviewing the cmn/hi loop-back (#586), which had the same gap;
    // measured across the fleet, 53 of 65 languages still drop ℃ and each needs its own word.
    "℃": ["degree Celsius", "degrees Celsius"], "℉": ["degree Fahrenheit", "degrees Fahrenheit"],
    "°": ["degree", "degrees"],
    m: ["meter", "meters"], l: ["liter", "liters"], ml: ["milliliter", "milliliters"],
    g: ["gram", "grams"], t: ["ton", "tons"], w: ["watt", "watts"],
    hz: ["hertz", "hertz"], khz: ["kilohertz", "kilohertz"], mhz: ["megahertz", "megahertz"],
    ghz: ["gigahertz", "gigahertz"], kb: ["kilobyte", "kilobytes"], mb: ["megabyte", "megabytes"],
    gb: ["gigabyte", "gigabytes"], tb: ["terabyte", "terabytes"], kw: ["kilowatt", "kilowatts"],
};
const CURRENCY: Record<string, [string, string]> = {
    $: ["dollar", "dollars"], "£": ["pound", "pounds"], "€": ["euro", "euros"], "¥": ["yen", "yen"],
};

const MONTH_ALT = "january|february|march|april|may|june|july|august|september|october|november|december";

// ── Title/place abbreviations (st, dr, mt, mr, mrs) ─────────────────────────────────────────────────
// Two defects (FLEURS listening, Run 30): the CMU dict reads bare "st" as STREET and "dr" as DRIVE, so
// "st. james" came out "street . james" — wrong word AND the abbreviation's period survived into the
// clause segmenter as a phrase break. The dot must be consumed here, and st/dr disambiguated: a
// following CONTENT word means the abbreviation precedes a name (saint james, doctor tony); a following
// function word or phrase end means it follows one (main st. in dublin = street). FLEURS text is
// lowercased, so capitalization can't be the signal — the neighbor test is the whole heuristic.
const ABBREV_FUNCTION_NEXT =
    /^(?:in|on|at|and|or|but|the|a|an|is|was|were|are|to|for|with|of|from|by|near|that|this|it|he|she|they|we|you|i|as|his|her|its|their|there|then|when|where|which|who|had|has|have)$/i;
// CAPITALIZATION, where the input has it, beats the neighbour test: "Dr. Who" is Doctor Who, but "who"
// is a function word, so the neighbour test alone read it as "drive who". FLEURS text is lowercased and
// keeps relying on the neighbour heuristic; real input usually has the stronger signal.
const isName = (next: string): boolean => /^\p{Lu}/u.test(next);
const DOTTED_ABBREV: Record<string, (next: string) => string> = {
    st: (next) => (!isName(next) && ABBREV_FUNCTION_NEXT.test(next) ? "street" : "saint"),
    dr: (next) => (!isName(next) && ABBREV_FUNCTION_NEXT.test(next) ? "drive" : "doctor"),
    mt: () => "mount",
    mr: () => "mister",
    mrs: () => "missus",
};

// Built FROM the table, longest key first, so adding a unit is a one-line data change and "km/h" cannot
// be shadowed by "km". Previously this alternation was hardcoded and had drifted from the table.
// THE EXPONENT IS PART OF THE UNIT MATCH, not a separate rule, because the unit rule consumes the unit and
// anything left behind reaches the g2p raw. `km²` matched `km`, the `²` was stranded and then dropped, and
// `The park covers 19,500 km²` read as a LENGTH — the area gone. Two corpus instances, and #586 opens with
// this one. `m³` has zero instances and is claimed anyway (trap 8 (zero corpus instances is not evidence of…)): it is the same rule's other branch.
// A DOTTED DESIGNATION IS NOT A QUANTITY, and this rule had no guard for it: the number group accepts a
// fraction, so `802.11g` matched with `802.11` + `g` and read as "eight hundred two point one one GRAMS".
// That is the exact defect the shared tier's `NOT_VERSION` exists to stop — its own note records `802.11g`
// reading as "802.11 grams" in ten languages — and English never got it, because English does not use the
// tier. `802.11g` occurs in 46 of the 67 corpora, en_us among them, so this was live.
//
// The guard is the tier's, copied verbatim in shape: reject a `\d+[.,]\d+` immediately followed by a SINGLE
// letter. Measured before adopting it — the only glued decimal-plus-one-letter forms in any corpus are
// `3.50m` (ko) and `4.892m` (pt), neither of them English, against 802.11a/b/c/g/n ×232. A SPACED quantity is
// untouched because the lookahead requires the letter to be glued, so `100.5 m` still reads as metres.
// AND THE STANDARD IS NAMED EXPLICITLY, not left to the general heuristic. 802.11 is a networking standard
// whose amendment suffixes are now TWO letters — 802.11ac, ax, ah, be, bn — and `802.11ah` (Wi-Fi HaLow)
// collides with `Ah`, ampere-hours. The general arm above only guards a SINGLE trailing letter, so naming the
// family covers every suffix length, present and future, and costs nothing: it is the only such designation
// in any of the 67 corpora (×232 across 46 of them).
const NOT_VERSION = "(?<![\\d.,])(?!802[.,]11\\w)(?!\\d+[.,]\\d+[a-zA-Z](?![a-zA-Z\\d]))";
const UNIT_RE = new RegExp(
    // ⚠ THE ASCII EXPONENT IS ACCEPTED TOO (`km2`, `m3`), not only the superscript. Two reasons, and the first
    // is that WE PRODUCE the ASCII form: stripping `<sup>2</sup>` used to leave the digits inline, so twelve
    // corpora carry a flattened `km2`. English matched only `[²³]`, so the `2` fell out of the unit match and
    // read as a SEPARATE NUMBER — `19,500 km2` came out "nineteen thousand five hundred kilometres TWO".
    // Audibly wrong, and invisible to both gates: no superscript survives to leak and no symbol vanishes.
    // Second, `km2` is simply what a person types when the keyboard has no superscript, so accepting it is
    // right independently of how our own pipeline mangled it.
    // Bounded by the UNIT LIST, which is what makes it safe — `H2O` cannot match because `H` is not a unit key.
    // ⚠ A MAGNITUDE WORD MAY SIT BETWEEN THE NUMBER AND ITS UNIT, and without this English LEAKED the unit.
    // `2.2 million km2 of ocean` — the archipelago sentence, in en_us — read as *… mˈɪɫjən ˈʊkm tʰˈuː …*: the
    // abbreviation reached the phoneme stream AS RAW LETTERS and the area was lost entirely. Invisible to every
    // gate, because bare Latin letters are in no leak class and nothing vanished for the DROP test to catch.
    // This is the same defect the shared tier fixed with `magnitudes` (reported by the Luxembourgish run and
    // found again in Italian this sweep) — English does not use that tier, so it needs its own hop.
    // The magnitude is RE-EMITTED in place: it belongs to the number's reading, not the unit's.
    `${NOT_VERSION}(\\d[\\d,]*(?:\\.\\d+)?)(\\s+(?:hundred|thousand|million|billion|trillion))?\\s?(${
        Object.keys(UNITS).sort((a, b) => b.length - a.length)
            .join("|")})([²³23])?(?![\\p{L}\\p{M}])`,
    "giu",
);

/** Dotted abbreviations with a single fixed reading (no neighbour test needed). `Jr.` is the most
 *  frequent abbreviation in the cased column; `No.` otherwise reads as the word "no". */
const PLAIN_ABBREV: Readonly<Record<string, string>> = {
    jr: "junior", sr: "senior", prof: "professor", rev: "reverend", sgt: "sergeant", cpl: "corporal",
    lt: "lieutenant", col: "colonel", gen: "general", gov: "governor", sen: "senator", rep: "representative",
    no: "number", nos: "numbers", ave: "avenue", blvd: "boulevard", rd: "road", ln: "lane",
    dept: "department", est: "established", approx: "approximately", vs: "versus",
    vol: "volume", ch: "chapter", fig: "figure", pp: "pages", ed: "edition", eds: "editors",
    inc: "incorporated", ltd: "limited", corp: "corporation", univ: "university",
    // LATIN SCHOLARLY ABBREVIATIONS. Each was reaching the g2p with its dot intact, so mid-sentence the
    // dot became a phrase break — and two of them were not words at all: `cf.` came out as the
    // unpronounceable cluster [kf] and `viz.` as the nonsense word [vɪts]. `ibid` maps to itself purely
    // to consume the dot; it is already read as written. `i.e.`/`e.g.`/`N.B.`/`a.m.`/`p.m.` are handled
    // separately below because they are read as LETTERS rather than expanded.
    // `etc` and `ibid` map to THEMSELVES: the dictionary already reads both correctly as single tokens
    // ([ɛtsˈɛt̬ɚə], [ˈɪbɪd]), so the entry exists only to consume the dot. Expanding etc to "et cetera"
    // was tried and rejected — it fixed the two mid-sentence instances but needlessly re-stressed the four
    // sentence-final ones as two words, changing output that was already right.
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
    if (y >= 2000 && y < 2010) return lo === 0 ? "2 thousand" : `2 thousand ${lo}`;
    if (lo === 0) return `${hi} hundred`;
    if (lo < 10) return `${hi} oh ${lo}`;
    return `${hi} ${lo}`;
}

/** Normalize one English input string. Pure text→text; no IPA. */
/** Superscript digits → ASCII, so an exponent reaches the number path as a readable numeral. */
const SUPERSCRIPT_DIGIT: Readonly<Record<string, string>> = {
    "\u207b": "-", // SUPERSCRIPT MINUS — a negative exponent, `10\u207b\u00b3\u00b9`
    "\u2070": "0", "\u00b9": "1", "\u00b2": "2", "\u00b3": "3", "\u2074": "4",
    "\u2075": "5", "\u2076": "6", "\u2077": "7", "\u2078": "8", "\u2079": "9",
};

export function normalizeEnglish(input: string): string {
    let s = input;

    // 0) ABBREVIATIONS: dotted forms first (the dot is consumed so it can't become a phrase break),
    //    then the undotted saint pattern ("st petersburg" — FLEURS drops the dot). An undotted "st"
    //    before a function word stays as-is: the dict's street reading is correct there ("main st in
    //    dublin"). A dotted abbreviation at phrase end is the trailing use (street/drive), keeping the
    //    punctuation that follows it.
    s = s.replace(/\b(st|dr|mt|mr|mrs)\.\s+([a-zà-ÿ']+)/gi,
        (_m, abbr: string, next: string) => `${DOTTED_ABBREV[abbr.toLowerCase()]!(next)} ${next}`);
    s = s.replace(/\b(st|dr|mt)\.(?=\s*(?:[.,;:!?]|$))/gi,
        (_m, abbr: string) => ({ st: "street", dr: "drive", mt: "mount" })[abbr.toLowerCase()]!);
    s = s.replace(/\bst\s+([a-z']+)/gi,
        (m0, next: string) => (ABBREV_FUNCTION_NEXT.test(next) ? m0 : `saint ${next}`));

    // 0b) MORE DOTTED ABBREVIATIONS. Measured in the cased column, `Jr.` is the single most common one
    //     (×9) and English had no rule for it at all; `No.` (×2) read as the word "no". The dot is
    //     consumed when the sentence continues so it cannot become a phrase break, and kept at a phrase
    //     end where it really is the sentence end — the same discipline as the st./dr. rule above.
    s = s.replace(new RegExp(`\\b(${PLAIN_ABBREV_ALT})\\.(\\s+)(?=\\p{L})`, "giu"),
        (_m, ab: string, sp: string) => `${PLAIN_ABBREV[ab.toLowerCase()]!}${sp}`);
    s = s.replace(new RegExp(`\\b(${PLAIN_ABBREV_ALT})\\.(?=\\s*(?:[.,;:!?)]|$))`, "giu"),
        (_m, ab: string) => `${PLAIN_ABBREV[ab.toLowerCase()]!}.`);
    //     `et al.` is TWO tokens, so it precedes the single-token rule above having already run; its dot
    //     is consumed mid-sentence for the same reason. Same two-branch shape.
    s = s.replace(/\bet\s+al\.(\s+)(?=\p{L})/giu, "et al$1");
    s = s.replace(/\bet\s+al\.(?=\s*(?:[.,;:!?)]|$))/giu, "et al.");
    //     `c.`/`ca.` is circa ONLY before a year — a bare `c.` is the letter (or an initial) and must be
    //     left to the initials rule, so the digit lookahead is what makes this safe.
    s = s.replace(/\bca?\.\s*(?=\d{3,4}(?!\d))/gi, "circa ");
    //     `No.` before a DIGIT is the number sign — the rule above needs a following letter, and this is
    //     the form that actually occurs ("No. 1", ×2 in the cased column), where it read as the word "no".
    s = s.replace(/\bnos?\.\s*(?=\d)/gi, "number ");
    //     `e.g.` and `i.e.` — the ENGLISH GLOSS, a CHOICE among readings that are genuinely
    //     interchangeable in speech, and MEASURED rather than assumed. Running Parakeet ASR over the six
    //     en_us FLEURS recordings that contain one of these (4 sentences, 2 of them read twice):
    //         i.e. ×2  — BOTH readers omitted it outright ("values, zero or one")
    //         e.g. ×4  — 2 read the letter names, 1 read "for example", 1 "example given"
    //     So the readers disagree, three ways, and no single rendering matches the audio. That settles
    //     the question the other way from how it was posed: there is no "correct" target to match, so the
    //     project's preference for the gloss is as defensible as any and costs nothing measurable. Both
    //     must be handled
    //     before the generic dot-stripping below, which would otherwise leave "eg"/"ie" to be read as
    //     words. Two branches, as everywhere: the dot is consumed mid-sentence so it cannot become a
    //     phrase break, and kept where it really is the sentence end.
    //     The lookahead admits a DIGIT: the corpus writes "i.e. 0 or 1", and a letter-only lookahead let
    //     that fall through to the generic dot-stripping, which read the bare "ie" as the word [iː].
    s = s.replace(/\be\.\s?g\.(\s+)(?=[\p{L}\d])/giu, "for example$1");
    s = s.replace(/\be\.\s?g\.(?=\s*(?:[,;:!?)]|$))/giu, "for example.");
    s = s.replace(/\bi\.\s?e\.(\s+)(?=[\p{L}\d])/giu, "that is$1");
    s = s.replace(/\bi\.\s?e\.(?=\s*(?:[,;:!?)]|$))/giu, "that is.");
    //     a.m./p.m. likewise: dot-stripping alone leaves lowercase "am", which reads as the verb. The
    //     initialism pass cannot rescue it because that pass only claims all-caps runs.
    s = s.replace(/\b([ap])\.\s?m\./gi, (_m, ap: string) => (ap.toLowerCase() === "a" ? "ay em" : "pee em"));
    //     Other dotted initialisms (a.m., U.S., U.K.) — strip the interior dots so they cannot become
    //     pause marks, leaving the letters for the initialism pass or the dictionary.
    s = s.replace(/\b([A-Za-z](?:\.[A-Za-z]){1,4})\.(?!\w)/g, (m0) => m0.replace(/\./g, ""));

    // 0c) ERA MARKERS. BCE occurs 8 times in the cased column. Spelled out, not expanded to words: "B C"
    //     is how they are read aloud, and "AD" must not be read as the word "ad".
    s = s.replace(/\b(BCE|BC|CE|AD)\b/g,
        (m0) => ({ BCE: "bee see ee", BC: "bee see", CE: "see ee", AD: "ay dee" })[m0] ?? m0);

    // 0d) DIGIT GROUPING with a space (SI style, and "1 356"/"8 400" occur in the corpus). The number
    //     token cannot span a space, so these read as two numbers with the thousand lost.
    s = s.replace(/(\d)[  ](\d{3})(?!\d)/gu, "$1$2");
    s = s.replace(/(\d)[  ](\d{3})(?!\d)/gu, "$1$2");

    // 0d) SCIENTIFIC NOTATION'S EXPONENT, resolved before BOTH the sign rule and the unit rule — and the ordering is the whole reason
    //     this is a separate rule from 6b rather than the same one.
    //     A superscript sits BETWEEN the number and its unit (`9.11 × 10⁻³¹ kg`), which breaks the adjacency the
    //     unit rule matches on: the unit then failed and `kg` reached the phoneme stream RAW as *kɡ* — a LEAK,
    //     which is worse than the dropped exponent it accompanied. Resolving the superscript here leaves the
    //     exponent's DIGITS immediately before the unit, so step 6 sees `31 kg` and reads it, and the whole
    //     phrase comes out "…to the power of negative thirty-one kilograms" — which is how a person says it.
    //     ⚠ It cannot simply be moved earlier wholesale: a bare exponent must be resolved AFTER the unit rule or
    //     it steals every `km²` and reads it "kilometre squared". Hence two placements, narrow here and general
    //     there — the narrowing is the `× 10` shape, which is unambiguous scientific notation.
    //     ⚠ AND BEFORE STEP 0e, which is where the first attempt went wrong. Placed after it, the sign rule had
    //     already rewritten `-31` to `negative 31`, so the ASCII pattern could no longer match and the reading
    //     kept saying "ten negative thirty-one" — the sign present, the power still missing. Running first means
    //     this rule owns the whole construction and emits the sign word itself.
    //     Measured: the `10 -31` ASCII form occurs twice (my's artifact) and the superscript form ZERO times, so
    //     this is robustness for correctly-written input rather than a repair of a sampled defect.
    //     ⚠ THE ASCII FORM IS MATCHED TOO, and it is the one that actually occurs: both real instances in the
    //     fleet write the exponent as plain digits with the superscript lost — `9.1093837 × 10 -31 kg` and
    //     `2.5×10 -11 m` (my's artifact). Unhandled, that read "ten NEGATIVE thirty-one kilograms": the sign
    //     survived but the power was gone, so the reading said subtraction where the text meant an exponent.
    //     THE ATTACHED MINUS IS THE DISCRIMINATOR — `10 -31` is scientific notation, `10 - 31` (spaced on both
    //     sides) is subtraction — and both corpus instances write it attached, which is the convention. Combined
    //     with the required `×` before the `10`, nothing that is not scientific notation can reach this.
    s = s.replace(/(?<=[×x·]\s?)(10)\s?(\u207b?[\u2070\u00b9\u00b2\u00b3\u2074-\u2079]+|-\d+)/gu,
        (_m, ten: string, sup: string) => {
            const digits = sup.startsWith("-")
                ? sup
                : [...sup].map((c) => SUPERSCRIPT_DIGIT[c]!).join("");
            const neg = digits.startsWith("-");
            return `${ten} to the power of ${neg ? `negative ${digits.slice(1)}` : digits}`;
        });

    // 0e) NEGATIVES. A dropped minus sign INVERTS the meaning, which for a temperature is the worst
    //     class of silent error: "-5 degrees" was read as "five degrees".
    //     ⚠ "NEGATIVE", NOT "MINUS", and the distinction is the point. `minus` is the ARITHMETIC OPERATOR —
    //     "ten minus four" — and English convention reserves it for that, using `negative` for a SIGN on an
    //     amount: "negative thirty-one", "a low of negative forty". This rule only ever matches the SIGN
    //     position (start of string, after a space, or after an opening paren), so it was spending the
    //     operator's word on the sign's job. Reading `-31` as "minus thirty-one" is not wrong in isolation, but
    //     it is ambiguous with subtraction in exactly the place where a phonemizer cannot afford to be — and
    //     the ambiguity is real here, because a bare `10 - 4` is currently DROPPED, so "minus" in the output
    //     could only ever have come from a sign anyway.
    //     `negative` on a measurement is also unremarkable English ("negative forty Celsius"), so the
    //     disambiguation costs nothing on the reading it is most often applied to.
    s = s.replace(/(^|[\s(])[-−–](\d)/gu, "$1negative $2");
    //     `±` belongs here, with its siblings: it was the ONE sign genuinely missing. I first added a whole
    //     leading-sign block late in the pass before noticing 0e and 0f2 already existed — and the gate had
    //     said so, listing only `equals less-than times` as dropped, not minus or plus. Read the gate's own
    //     words before adding a rule it did not ask for. The duplicate `–` arm I added also RE-BROKE the
    //     corpus's `(1418 – 1450)`, because it allowed a space after the dash where 0e requires the digit
    //     immediately: `\s?` is what turns a range into a subtraction.
    s = s.replace(/(^|[\s(])±\s?(\d)/gu, "$1plus or minus $2");

    // 0f0) NUMERIC DATES, before the fraction rule (which would otherwise have to guard against them)
    //      and before the date/year steps below, whose ordinal-day and pair-wise-year rules then apply to
    //      what this emits. ISO is year-first, the US form month-first.
    s = s.replace(/\b(\d{4})-(\d{2})-(\d{2})\b/g, (m0, y: string, mo: string, d: string) =>
        isoDate(Number(y), Number(mo), Number(d)) ?? m0);
    s = s.replace(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g, (m0, mo: string, d: string, y: string) =>
        isoDate(Number(y), Number(mo), Number(d)) ?? m0);

    // 0f1) MONEY with cents. Read as "five dollars fifty", not "five point five zero dollars" — a decimal
    //      reading of a price is wrong in a way listeners notice. Must precede the general currency rule.
    s = s.replace(/([$£€¥])\s?(\d[\d,]*)\.(\d{2})\b/g,
        (_m, sym: string, int: string, cents: string) => {
            const [sg, pl] = CURRENCY[sym]!;
            const unit = /^1$/.test(int.replace(/,/g, "")) ? sg : pl;
            return cents === "00" ? `${int} ${unit}` : `${int} ${unit} ${Number(cents)}`;
        });

    // 0f2) PLUS. The mirror of the minus rule: a dropped sign is silent content loss, and "+5" read as
    //      "five" is as wrong as "-5" was. Covers the attached form too (UTC+1 → "UTC plus 1").
    s = s.replace(/(\S)\+\s?(\d)/gu, "$1 plus $2");
    s = s.replace(/(^|\s)\+\s?(\d)/gu, "$1plus $2");

    // 0f) FRACTIONS. Guarded against dates (3/14/2011) and unit ratios (km/h) by requiring digits both
    //     sides and nothing numeric or alphabetic after.
    s = s.replace(/\b(\d{1,3})\/(\d{1,3})\b(?!\s*[\/\d])/gu, (m0, a: string, b: string) =>
        fractionWords(Number(a), Number(b)) ?? m0);

    // 1) CURRENCY before anything else touches the digits: the symbol precedes but is SPOKEN after, and a
    //    magnitude word hops with it ($5 million → "5 million dollars"). Decimal cents ($5.50) stay a
    //    plain decimal number — "five point five zero dollars" is wrong, but rare in prose; deferred.
    s = s.replace(
        /([$£€¥])\s?(\d[\d,]*(?:\.\d+)?)(\s+(?:million|billion|trillion|thousand))?/gu,
        (_m, sym: string, num: string, mag?: string) => {
            const [sg, pl] = CURRENCY[sym]!;
            const one = /^1(?:\.0+)?$/.test(num.replace(/,/g, ""));
            return `${num}${mag ?? ""} ${one && !mag ? sg : pl}`;
        },
    );

    // 2) PERCENT: "40%" → "40 percent". Before times/years so the bare number stays one token.
    s = s.replace(/(\d)\s?%/gu, "$1 percent");

    // 3) TIMES: H:MM (optionally already followed by am/pm, which the dictionary reads fine).
    //    :00 → o'clock (dropped before am/pm: "3 pm", not "3 o'clock pm"), :0X → "oh X".
    s = s.replace(/\b(\d{1,2}):([0-5]\d)\b(\s*[ap]m\b)?/gu, (_m, h: string, mm: string, ap?: string) => {
        const suffix = ap ?? "";
        if (mm === "00") return suffix ? `${h}${suffix}` : `${h} o'clock`;
        if (mm.startsWith("0")) return `${h} oh ${Number(mm)}${suffix}`;
        return `${h} ${mm}${suffix}`;
    });

    // 4) DATES: month + bare day number → ordinal suffix, letting the existing 16th path speak it
    //    (february 16 → "february 16th"). Runs BEFORE years so "february 16 2011" ordinalizes the day
    //    first and the year rule then sees "2011" with a month in context.
    s = s.replace(/\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(?!\d|\s*(?:st|nd|rd|th|percent))\b/gi, (m0, mon: string, d: string) => {
        const n = Number(d);
        if (n < 1 || n > 31) return m0;
        const suf = d.endsWith("1") && n !== 11 ? "st" : d.endsWith("2") && n !== 12 ? "nd" : d.endsWith("3") && n !== 13 ? "rd" : "th";
        return `${mon} ${d}${suf}`;
    });

    // 5) YEARS: a bare 4-digit 1100–2099 in a date-like CONTEXT (after in/of/since/…, a month name, or
    //    followed by a sentence boundary after such) → pair-wise reading. Context-gated on purpose:
    //    "2011 people died" should not become "twenty eleven people". Grouped digits (1,998) never match.
    s = s.replace(
        /\b(in|of|since|from|until|till|by|before|after|around|circa|year|late|early|mid)\s+(1[1-9]\d\d|20\d\d)\b(?![.,]?\d)(?!\s*(?:percent|kilometers?|meters?))/gi,
        (_m, ctx: string, y: string) => `${ctx} ${yearWords(Number(y))}`,
    );
    s = s.replace(
        new RegExp(`\\b(${MONTH_ALT})((?:\\s+\\d{1,2}(?:st|nd|rd|th))?,?)\\s+(1[1-9]\\d\\d|20\\d\\d)\\b(?![.,]?\\d)`, "gi"),
        (_m, mon: string, day: string, y: string) => `${mon}${day} ${yearWords(Number(y))}`,
    );

    // 6) UNITS: number + known abbreviation. Count agreement from the number.
    s = s.replace(UNIT_RE,
        (_m, num: string, mag: string | undefined, u: string, exp: string | undefined) => {
            const [sg, pl] = UNITS[u.toLowerCase()]!;
            // English puts the measure word BEFORE the unit — "square kilometers", "cubic meters" — and the
            // COUNT still governs the noun: "one cubic meter", not "one cubic meters". A first cut forced the
            // plural on the reasoning that the quantity is the area rather than the one square; that is not
            // how English says it, and `1 m³` came out "one cubic meters".
            const measure = exp === "²" || exp === "2" ? "square " : exp === "³" || exp === "3" ? "cubic " : "";
            // A magnitude forces the PLURAL: "2.2 million square kilometres", never "…kilometre". The
            // singular test looks at the digits alone, so without this `1 million km` would read "kilometre".
            const one = mag === undefined && /^1(?:\.0+)?$/.test(num.replace(/,/g, ""));
            return `${num}${mag ?? ""} ${measure}${one ? sg : pl}`;
        });

    // 6b) A BARE EXPONENT — a base with NO unit for the rule above to attach the power to, so the superscript
    //     was dropped outright. English does not use the shared symbol tier (it has no `makeSymbolNormalizer`
    //     call at all), so `bareExponent` in core cannot reach it and this is the local equivalent.
    //
    //     ⚠ THE PREDICATE IS A DIFFERENT WORD FROM THE MODIFIER, which is the whole reason this cannot reuse
    //     the table above: English reads *square kilometres* but *twenty SQUARED*, *cubic metres* but
    //     *eight CUBED*. Substituting the modifier would give "twenty square".
    //
    //     THE BASE MAY BE LETTERS, not only digits, and that is the case that exposed the gap: `E = mc²` read
    //     as *ˈiː ˈiːkwəɫz mˈɪk* — the equals correctly voiced and the square silently gone. It reaches here
    //     through Burmese too, whose artifact quotes the formula and routes the Latin run to English.
    //
    //     `to the power of N` USES THE CARDINAL, deliberately, though "to the fifth power" is the more
    //     idiomatic English. The ordinal form would have to be produced for an arbitrary exponent, and the
    //     cardinal is both correct and unambiguous — see `bareExponent` in core/normalizeSymbols.ts for why the
    //     cross-language argument settles it the same way. The digits are emitted for the number path to speak.
    //     Ordered AFTER the unit rule so a unit exponent is never stolen from it.
    //     ⚠ A LETTER BASE IS CAPPED AT THREE, because a superscript on an ordinary word is a FOOTNOTE marker
    //     far more often than an exponent: `Smith¹` is a citation, and reading it "Smith to the power of one"
    //     is the confidently-wrong outcome this repo ranks below silence. Variables are short, prose words are
    //     not. See `BARE_EXPONENT` in core/normalizeSymbols.ts for the measurement behind the cap.
    //     ⚠ AND THE CAP NEEDS `(?<![A-Za-z])`, or it caps nothing: `{1,3}` happily matches the LAST three
    //     letters of a long word, so `Smith¹` matched `ith` and still read as arithmetic. Caught by probing the
    //     exact case the cap was written for.
    s = s.replace(/(\d[\d.,]*|(?<![A-Za-z])[A-Za-z]{1,3})\s?(\u207b?[\u2070\u00b9\u00b2\u00b3\u2074-\u2079]+)/gu,
        (_m, base: string, sup: string) => {
            const digits = [...sup].map((c) => SUPERSCRIPT_DIGIT[c]!).join("");
            //     THE SIGN WORD IS EMITTED HERE, not left as an ASCII `-` for the sign rule to pick up: that
            //     rule is step 0e and this is step 6b, so anything written now is downstream of it and a `-`
            //     would simply be dropped — reading `2\u207b\u2075` as "two to the power of five", with the sign
            //     silently inverted. Ordering makes emitting the word the only correct option.
            const neg = digits.startsWith("-");
            const mag = neg ? digits.slice(1) : digits;
            const power = neg ? `negative ${mag}` : mag;
            return mag === "2" && !neg ? `${base} squared`
                : mag === "3" && !neg ? `${base} cubed`
                : `${base} to the power of ${power}`;
        });

    // 7a) ALL-CAPS romans of ANY value, when the text distinguishes case — "Super Bowl LVIII" (58),
    //     "WrestleMania XL" (40), "Louis XVI". The closed lowercase set below stops at 20 and cannot
    //     express these. Case makes them unambiguous, but an acronym is also all-caps ("the CD player"),
    //     so the preceding word must itself be evidence: a known numbered-event noun, or Capitalized as
    //     a name would be. That keeps "size XL" and "a CD" out while letting the real numerals through.
    if (/[a-z]/.test(s)) {
        s = s.replace(/\b([A-Za-z][A-Za-z']*)\s+([IVXLCDM]{2,})\b/g, (m0, prev: string, rom: string) => {
            const n = romanToInt(rom);
            if (n === null) return m0;
            const evidence = ROMAN_CARDINAL_CTX.test(prev) || /^[A-Z]/.test(prev);
            if (!evidence) return m0;
            if (ROMAN_CARDINAL_CTX.test(prev)) return `${prev} ${n}`;
            const suf = n % 10 === 1 && n % 100 !== 11 ? "st" : n % 10 === 2 && n % 100 !== 12 ? "nd"
                : n % 10 === 3 && n % 100 !== 13 ? "rd" : "th";
            return `${prev} the ${n}${suf}`;
        });
    }

    // 7) ROMAN NUMERALS, the closed 2–20 set: cardinal after a context word, else the regnal ordinal.
    s = s.replace(/\b([a-z']+)\s+(ii|iii|iv|vii|viii|ix|xii|xiii|xiv|xv|xvi|xvii|xviii|xix|xx)\b/gi,
        (_m, prev: string, rom: string) => {
            const n = ROMAN[rom.toLowerCase()]!;
            if (ROMAN_CARDINAL_CTX.test(prev)) return `${prev} ${n}`;
            const suf = n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th";
            return `${prev} the ${n}${suf}`;
        });

    // 8) THE AMPERSAND AND THE SIGN CLASSES. English was the FIRST language treated and these were never
    //    added, so they were dropped silently for the whole of #562 — `College of Arts & Sciences` read
    //    *Arts Sciences*, `B&Bs` read *bee bees*, `Qatar Airways & Turkish Airlines` lost its conjunction.
    //    Three corpus instances of `&`; the relational signs have ZERO, which is not evidence of
    //    correctness (trap 8 (zero corpus instances is not evidence of…)) and is why `review.ts` reports them as DROPPED. A dropped sign is inaudible,
    //    the one outcome that cannot be right (#584).
    //
    //    LAST, deliberately. Every rule above matches on digits or letters adjacent to a symbol — the
    //    currency step keys on `$` beside a number, the unit step on a number beside an abbreviation — and
    //    inserting words between them first would break those adjacencies.
    //    THE HTML ENTITY FIRST, or the bare-`&` rule below turns `&amp;` into "and amp;" — a word invented
    //    out of markup, which is worse than the drop it replaces. This corpus writes no entity (0 measured)
    //    but a phonemizer is handed arbitrary text. `core/markup.ts` decodes these and English does not use
    //    it; wiring that is a broader change (it also strips tags) and is not what this PR is for.
    s = s.replace(/\s*&amp;\s*/giu, " and ");
    s = s.replace(/\s*&\s*/gu, " and ");
    //    `×`/`÷`/`<`/`>` only BETWEEN digits. Not because THIS corpus carries HTML — it does not, 0 tags
    //    measured, and an earlier draft of this comment claimed otherwise by carrying the reasoning over
    //    from the Malay layer, where the tags are real. The guard is kept because a phonemizer is handed
    //    arbitrary text and `<` is the one sign whose bare form would eat a tag if one ever arrived.
    // ⚠ TWO WORDS FOR ONE SIGN, and ASCII `x` accepted alongside `×`.
    //     English says "six BY six centimetres" for a FORMAT and "five TIMES five" for a PRODUCT; a `4x4` is
    //     "a four BY four". Reading a dimension as "times" is not what anyone says.
    //     ⚠ AND ASCII `x` WAS READ AS THE LETTER: `6x6 cm` came out *sˈɪks ˈɛks sˈɪks …* — "six EKS six". That
    //     is the DOMINANT written form, ~85 `NxN` instances across the corpora against ~20 for `×`, and it is
    //     audible garbage rather than a drop, so no leak or DROP gate could see it.
    //     THE DISCRIMINATOR: a unit after the right operand means a measurement; an UNSPACED ascii `x` between
    //     digits is the `4x4`/`6x6` format idiom. Both take "by"; everything else takes "times". Equality of the
    //     operands cannot decide it — `4x4` and `5 × 5` are both equal and read differently.
    s = s.replace(/(\d)\s*(×|x)\s*(?=\d)/gu, (whole, left: string, sign: string, off: number, full: string) => {
        const tail = full.slice(off + whole.length);
        const hasUnit = /^\d[\d.,]*\s?[A-Za-z]/u.test(tail);
        const unspacedAscii = sign === "x" && !/\s/u.test(whole);
        return `${left} ${hasUnit || unspacedAscii ? "by" : "times"} `;
    });
    s = s.replace(/(\d)\s*÷\s*(?=\d)/gu, "$1 divided by ");
    //    `=` takes the HOUSE PATTERN `(\S)\s*=\s*(\S)` that eleven other layers use, not the digit gate: an
    //    equals sign between non-digits is still an equals sign (`x = y`), and this corpus contains no `=`
    //    and no HTML tag at all (measured: 0 of each), so the tag hazard that justifies gating `<`/`>` does
    //    not apply to it. Gating it on digits left `review.ts` reporting `equals` as a DROPPED class.
    s = s.replace(/(\S)\s*=\s*(\S)/gu, "$1 equals $2");
    s = s.replace(/(\d)\s*<\s*(?=\d)/gu, "$1 less than ");
    s = s.replace(/(\d)\s*>\s*(?=\d)/gu, "$1 greater than ");

    return s;
}

// ── Initialisms ─────────────────────────────────────────────────────────────────────────────────────
/**
 * English phonotactics, for the fail-safe guard in core/initialisms.ts. English codas are far more
 * permissive than French ones, so the load here is carried mostly by the no-vowel test — which is
 * exactly the failing class (NHS, MP, GDP, DVD, TV, PBS all lack a vowel entirely).
 */
export const isUnreadableEnglish = makeUnreadableTest({
    vowels: /[aeiouy]/u,
    legalOnsets: new Set([
        "bl", "br", "ch", "cl", "cr", "dr", "dw", "fl", "fr", "gh", "gl", "gr", "gn", "kn", "kl", "kr",
        "ph", "pl", "pr", "ps", "qu", "rh", "sc", "sh", "sk", "sl", "sm", "sn", "sp", "sq", "st", "sv",
        "sw", "th", "tr", "tw", "vl", "wh", "wr", "zl",
    ]),
    legalCodas: new Set([
        "ch", "ck", "ct", "ff", "ft", "gh", "gs", "ks", "ld", "lf", "lk", "ll", "lm", "ln", "lp", "ls",
        "lt", "lv", "mb", "mn", "mp", "ms", "nc", "nd", "ng", "nk", "ns", "nt", "ph", "pt", "ps", "rb",
        "rc", "rd", "rf", "rg", "rk", "rl", "rm", "rn", "rp", "rs", "rt", "rv", "sh", "sk", "sm", "sp",
        "ss", "st", "th", "ts", "tt", "xt", "zz", "bs", "ds", "ls", "nx", "mf", "lb", "rth", "nth",
    ]),
});

/**
 * Letter names. English needs almost no data here: CMUdict carries all 26 single letters with their
 * letter-NAME pronunciations (f = EH1 F, h = EY1 CH, w = D AH1 B AH0 L Y UW0), so emitting the bare
 * letters space-separated resolves correctly. The one exception is `a`, which the dict has as the
 * reduced article AH0 rather than the letter name.
 */
const LETTER_NAME = (l: string): string | undefined => (/^[a-z]$/.test(l) ? (l === "a" ? "ay" : l) : undefined);

/** LEXICAL: acronyms spelled out although their lowercase form is a dictionary word. Authored in
 *  english.jsonc alongside the language's other hand-authored facts, not here. */
const ACRONYM_LETTERS: ReadonlySet<string> = new Set(MANIFEST.acronymLetters);

/**
 * INITIALISMS. A separate exported pass, not a step inside `normalizeEnglish`, because of where it must
 * sit: Roman numerals are all-caps letter runs too, so the numeral rules get first refusal and this
 * claims only what they declined. `II` occurs 8 times in the English cased column, so the collision is
 * real — run earlier, this spells `Louis XIV` as EX-EYE-VEE.
 */
export function normalizeEnglishInitialisms(text: string, isRecorded: (lower: string) => boolean): string {
    return makeInitialismNormalizer({
        letterName: LETTER_NAME,
        acronymLetters: ACRONYM_LETTERS,
        isRecorded,
        isUnreadable: isUnreadableEnglish,
    })(text);
}
