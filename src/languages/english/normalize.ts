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
    //     `No.` before a DIGIT is the number sign — the rule above needs a following letter, and this is
    //     the form that actually occurs ("No. 1", ×2 in the cased column), where it read as the word "no".
    s = s.replace(/\bnos?\.\s*(?=\d)/gi, "number ");
    //     The two Latin abbreviations are read as their LETTERS in speech, and must be handled before the
    //     generic dot-stripping below, which would leave "eg"/"ie" to be read as words.
    s = s.replace(/\be\.\s?g\./gi, "ee gee");
    s = s.replace(/\bi\.\s?e\./gi, "eye ee");
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
        "ss", "st", "th", "ts", "tt", "xt", "zz", "bs", "ds", "ls", "nx",
    ]),
});

/**
 * Letter names. English needs almost no data here: CMUdict carries all 26 single letters with their
 * letter-NAME pronunciations (f = EH1 F, h = EY1 CH, w = D AH1 B AH0 L Y UW0), so emitting the bare
 * letters space-separated resolves correctly. The one exception is `a`, which the dict has as the
 * reduced article AH0 rather than the letter name.
 */
const LETTER_NAME = (l: string): string | undefined => (/^[a-z]$/.test(l) ? (l === "a" ? "ay" : l) : undefined);

/** Spelled out despite being a dictionary word — convention beating phonotactics. Every one of these is
 *  a perfectly good English word and every one is spelled out in speech. `US` is the measured case: it
 *  occurs 18 times in the cased column and CMUdict reads it as the pronoun [ʌs]. */
const FORCE_LETTERS: ReadonlySet<string> = new Set([
    "us", "un", "it", "id", "am", "led", "who",
]);
// This list is deliberately SHORT, and its membership test is precise: an entry belongs here only if the
// dictionary reads the token as the WORD. CMUdict already carries the correct letter reading for eu, uk,
// tv, cd, dvd, dc, ac, pc, pm and dj — as ONE token with one stress (cd → [siːdˈiː]), which is better
// prosody than spelling them out ([sˈiː dˈiː]) — so forcing those would make the output worse, not
// better. Also deliberately absent: ordinary words that appear in caps as EMPHASIS rather than as
// initialisms ("I said NO", "get IN"); the dictionary branch reads those correctly as words.

/** Read as a word although CMUdict does not carry it as one. */
const WORD_ACRONYMS: ReadonlySet<string> = new Set([
    "nasa", "nato", "unesco", "unicef", "opec", "covid", "sars", "aids", "scuba", "radar", "laser",
    "asap", "ascii", "faq", "gif", "jpeg", "png", "ram", "rom", "wifi", "swat", "otan",
]);

/**
 * INITIALISMS. A separate exported pass, not a step inside `normalizeEnglish`, because of where it must
 * sit: Roman numerals are all-caps letter runs too, so the numeral rules get first refusal and this
 * claims only what they declined. `II` occurs 8 times in the English cased column, so the collision is
 * real — run earlier, this spells `Louis XIV` as EX-EYE-VEE.
 */
export function normalizeEnglishInitialisms(text: string, isWord: (lower: string) => boolean): string {
    return makeInitialismNormalizer({
        letterName: LETTER_NAME,
        forceLetters: FORCE_LETTERS,
        wordAcronyms: WORD_ACRONYMS,
        isWord,
        isUnreadable: isUnreadableEnglish,
    })(text);
}
