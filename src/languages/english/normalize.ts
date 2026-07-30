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
const UNIT_RE = new RegExp(
    `(\\d[\\d,]*(?:\\.\\d+)?)\\s?(${Object.keys(UNITS).sort((a, b) => b.length - a.length)
        .join("|")})(?![\\p{L}\\p{M}])`,
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
    //     `e.g.` and `i.e.` — the ENGLISH GLOSS, which is a CHOICE among readings that are genuinely
    //     interchangeable in speech ("for example" / "ee gee" / "exempli gratia"). The gloss is the most
    //     common spoken form for e.g., and the project's preference for i.e. as well. Both must be handled
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

    // 0e) NEGATIVES. A dropped minus sign INVERTS the meaning, which for a temperature is the worst
    //     class of silent error: "-5 degrees" was read as "five degrees".
    s = s.replace(/(^|[\s(])[-−–](\d)/gu, "$1minus $2");

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
        (_m, num: string, u: string) => {
            const [sg, pl] = UNITS[u.toLowerCase()]!;
            return `${num} ${/^1(?:\.0+)?$/.test(num.replace(/,/g, "")) ? sg : pl}`;
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
