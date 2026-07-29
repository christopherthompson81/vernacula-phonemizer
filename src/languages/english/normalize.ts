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
    /\b(war|chapter|part|act|section|volume|book|phase|stage|grade|class|type|level|apollo|rocky)$/i;

// ── Units and symbols ───────────────────────────────────────────────────────────────────────────────
// Only unambiguous multi-character abbreviations, and only AFTER a number ("40 km"); bare "km" in prose
// stays. Single letters (m, g, s) are far too ambiguous and deliberately absent. [sg, pl] for count
// agreement: "1 km" → kilometer, "40 km" → kilometers.
const UNITS: Record<string, [string, string]> = {
    km: ["kilometer", "kilometers"], cm: ["centimeter", "centimeters"], mm: ["millimeter", "millimeters"],
    kg: ["kilogram", "kilograms"], mg: ["milligram", "milligrams"], lb: ["pound", "pounds"],
    lbs: ["pounds", "pounds"], oz: ["ounce", "ounces"], ft: ["foot", "feet"], mi: ["mile", "miles"],
    mph: ["miles per hour", "miles per hour"], kph: ["kilometers per hour", "kilometers per hour"],
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
    /^(?:in|on|at|and|or|but|the|a|an|is|was|were|are|to|for|with|of|from|by|near|that|this|it|he|she|they|we|you|i|as|his|her|its|their|there|then|when|where|which|who|had|has|have)$/;
const DOTTED_ABBREV: Record<string, (next: string) => string> = {
    st: (next) => (ABBREV_FUNCTION_NEXT.test(next) ? "street" : "saint"),
    dr: (next) => (ABBREV_FUNCTION_NEXT.test(next) ? "drive" : "doctor"),
    mt: () => "mount",
    mr: () => "mister",
    mrs: () => "missus",
};

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
    s = s.replace(/\b(st|dr|mt|mr|mrs)\.\s+([a-z']+)/gi,
        (_m, abbr: string, next: string) => `${DOTTED_ABBREV[abbr.toLowerCase()]!(next)} ${next}`);
    s = s.replace(/\b(st|dr|mt)\.(?=\s*(?:[.,;:!?]|$))/gi,
        (_m, abbr: string) => ({ st: "street", dr: "drive", mt: "mount" })[abbr.toLowerCase()]!);
    s = s.replace(/\bst\s+([a-z']+)/gi,
        (m0, next: string) => (ABBREV_FUNCTION_NEXT.test(next) ? m0 : `saint ${next}`));

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
    s = s.replace(/(\d[\d,]*(?:\.\d+)?)\s?(km|cm|mm|kg|mg|lbs|lb|oz|ft|mi|mph|kph|khz|mhz|ghz|hz|kb|mb|gb|tb|kw)\b/gi,
        (_m, num: string, u: string) => {
            const [sg, pl] = UNITS[u.toLowerCase()]!;
            return `${num} ${/^1(?:\.0+)?$/.test(num.replace(/,/g, "")) ? sg : pl}`;
        });

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
