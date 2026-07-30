/**
 * Indonesian (id) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not
 * already a pronounceable word into words the existing pipeline speaks. Pure text→text; no IPA.
 *
 * Eleventh language. Three defects were outside this layer and are fixed in the manifest and the engine:
 * `clausePunctuation` mapped every mark to a PADDED copy of itself, the number token was a bare `\d+` so
 * both Indonesian separators became clause pauses ("9.000" → "sembilan . nol"), and there was no decimal
 * word at all.
 *
 * ALREADY CORRECT and untouched, worth stating because it is unusual: Indonesian ordinals need nothing.
 * `ke-16` is genuinely "ke" plus the cardinal, which is what the engine already produced, and the manifest
 * carries a `letterNames` map so initialisms already spell out (PBB → pe-be-be, GPS → ge-pe-es). Roman
 * numerals arrive already converted from the registry seam.
 *
 * THE AMBIGUITY THAT SHAPES THIS FILE: Indonesian writes BOTH the thousands separator and the clock with a
 * period — `9.000` (×67 in the corpus) and `11.00` (×29). The digit count separates them cleanly: grouping
 * always takes exactly three digits after the dot, a clock exactly two. So the clock is claimed HERE,
 * before the number tokenizer, and everything the tokenizer then sees with a dot is real grouping.
 *
 * Measured over the id_id corpus (2,579 utterances): dot-thousands ×67, units ×55, dates ×51, ordinals
 * ×49, centuries ×36, the dot clock ×29, comma-decimals ×28, percent ×26, `pukul` ×25, all-caps ×242
 * (AS ×30, II ×10 Roman, TV ×8, GPS ×8, PBB ×7), dotted abbreviations ×10.
 */

/** Dotted abbreviations → the spoken words. Only three shapes occur (Dr. ×5, dll. ×4, No. ×1). */
const DOTTED_ABBREV: Readonly<Record<string, string>> = {
    dr: "dokter", prof: "profesor", ir: "insinyur", hj: "hajjah",
    dll: "dan lain lain", dsb: "dan sebagainya", dkk: "dan kawan kawan", tsb: "tersebut",
    no: "nomor", hlm: "halaman", jl: "jalan", yg: "yang", tgl: "tanggal", pt: "perseroan terbatas",
};
const ABBREV_ALT = Object.keys(DOTTED_ABBREV).sort((a, b) => b.length - a.length).join("|");

/** Unit abbreviations the shared tier cannot express, plus the slash unit. */
const UNIT_WORD: Readonly<Record<string, string>> = {
    "km/jam": "kilometer per jam", "m/detik": "meter per detik", "km/j": "kilometer per jam",
};
const UNIT_ALT = Object.keys(UNIT_WORD).sort((a, b) => b.length - a.length).join("|");

/** Every rule here emits DIGITS where a number is involved and lets the engine's own number path speak
 *  them, which keeps this layer free of the number words entirely. */
export function normalizeIndonesian(input: string): string {
    let s = input;

    // 1) CLOCK, before anything treats the dot as grouping. Exactly TWO digits after the dot is a time;
    //    exactly three is thousands separation, so the two never collide. Indonesian says
    //    "pukul delapan lewat empat puluh enam" — the hour, then "lewat" ("past"), then the minutes. At
    //    :00 the minutes drop out entirely.
    //    Both guards are needed. The trailing one keeps a RACE time out ("4:41.30, 2:11.60 menit" is
    //    minutes:seconds.hundredths, and the corpus has three); the LEADING one stops the scan restarting
    //    inside one and claiming "09.02" out of "1:09.02" as a clock in its own right.
    s = s.replace(/(?<![\d.:])([01]?\d|2[0-3])[.:]([0-5]\d)\b(?!\.?\d)/gu, (whole, h: string, min: string) => {
        const mv = Number(min);
        return mv === 0 ? `${Number(h)}` : `${Number(h)} lewat ${mv}`;
    });

    // 2) RUPIAH. `Rp` was read as the bare letter pair [rp]; the shared symbol tier is keyed on
    //    single-character signs and cannot express a two-letter prefix. Indonesian says the unit AFTER the
    //    amount, so the prefix is moved.
    s = s.replace(/\bRp\.?\s?(\d[\d.,]*)/gu, "$1 rupiah");

    // 2b) `No.` before a DIGIT is the number sign, which the letter-lookahead rule below cannot claim.
    //     The corpus instance is «kosmonot No. 11».
    s = s.replace(/\bno\.\s?(?=\d)/giu, "nomor ");

    // 3) DOTTED ABBREVIATIONS. The dot is CONSUMED when the sentence continues so it cannot become a
    //    phrase break; at a phrase end it stays, because there it really is the sentence end.
    s = s.replace(new RegExp(`\\b(${ABBREV_ALT})\\.(\\s+)(?=\\p{L})`, "giu"),
        (_m, ab: string, sp: string) => `${DOTTED_ABBREV[ab.toLowerCase()]!}${sp}`);
    s = s.replace(new RegExp(`\\b(${ABBREV_ALT})\\.(?=\\s*(?:[.,;:!?)]|$))`, "giu"),
        (_m, ab: string) => `${DOTTED_ABBREV[ab.toLowerCase()]!}.`);

    // 4) SLASH UNITS, before the shared tier claims the bare `km`.
    s = s.replace(new RegExp(`(\\d)\\s?(${UNIT_ALT})(?![\\p{L}])`, "gu"),
        (_m, d: string, u: string) => `${d} ${UNIT_WORD[u]!}`);

    // 5) DEGREES. °C was falling through to the English reading of the letter C.
    s = s.replace(/(\d)\s?°\s?C\b/giu, "$1 derajat Celsius");
    s = s.replace(/(\d)\s?°\s?F\b/giu, "$1 derajat Fahrenheit");
    s = s.replace(/(\d)\s?°/gu, "$1 derajat");

    // 6) SIGNS. Neither occurs in this corpus, but a dropped sign is silent content loss wherever it does.
    s = s.replace(/(^|[\s(])[-−–](\d)/gu, "$1minus $2");
    s = s.replace(/(\S)\+\s?(\d)/gu, "$1 plus $2");
    s = s.replace(/(^|\s)\+\s?(\d)/gu, "$1plus $2");

    // 7) FRACTIONS, as "numerator per denominator" — the ordinary spoken form; ½ is setengah.
    s = s.replace(/\b(\d{1,3})\/(\d{1,3})\b(?!\s*[/\d])/gu, (_m, a: string, b: string) =>
        Number(a) === 1 && Number(b) === 2 ? "setengah" : `${a} per ${b}`);

    return s;
}
