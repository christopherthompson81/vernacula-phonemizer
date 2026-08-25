/**
 * Indonesian (id) text normalization — the pre-tokenizer pass that rewrites everything which is not already a
 * pronounceable word into words the pipeline speaks. Pure text→text; no IPA.
 *
 * ⚠ INDONESIAN WRITES BOTH THE THOUSANDS GROUPING AND THE CLOCK WITH A PERIOD — `9.000` and `11.00` — and the
 * DIGIT COUNT is what separates them: three digits after the dot is grouping, two is a time. Nothing else in
 * the surface form distinguishes the two, so a rule keyed on the dot alone gets one of them wrong.
 *
 * ⚠ THREE DEFECTS FOR THIS LANGUAGE LIVE OUTSIDE THIS LAYER, in the manifest and the engine:
 * `clausePunctuation` must not map a mark to a PADDED copy of itself, the number token must not be a bare
 * `\d+` (or both separators become clause pauses — "9.000" → "sembilan . nol"), and the decimal word has to
 * exist at all. Looking for them here wastes a pass.
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

/** Compass points for the COORDINATE sense of `°` (`35°W`), keyed lowercase because the rule matches
 *  case-insensitively. Indonesian names the direction, exactly as the degree rule names the scale. */
const COMPASS: Readonly<Record<string, string>> = {
    n: "utara", s: "selatan", e: "timur", w: "barat",
};

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

    // 1b) THE DOLLAR CODE → the bare sign. Third language with this defect after pt and nl, and it arrives by
    //     a THIRD route: those two compose an `initialisms` pass that split `US$` and left the `$` behind a
    //     letter, whereas Indonesian has no such pass — its `letterNames` map spells a capital run inside the
    //     engine, so `US$ 14,7` reached the tier with the `$` ALREADY preceded by `S` and the tier's
    //     word-guard, the one that stops a key biting into a word, correctly refused it. The corpus's
    //     `10 miliar euro (US$ 14,7 miliar)` read *…uɛs əmpat bəlas koma tud͡ʒuh miliar…*: the code spelled out
    //     and THE CURRENCY GONE. Different mechanism, identical symptom and identical fix — which is the
    //     argument for the fold being the right shape rather than a per-language patch.
    //
    //     The `(?=[ ]?\d)` tail is required, not decorative: pt shipped this without it and a bare `US$` with
    //     no amount after it would leave a lone `$` the tier cannot place. Note the corpus writes BOTH
    //     spacings — `US$ 14,7` and `US $30` — and only the closed one is broken, since the open one already
    //     puts a space between the letter and the sign.
    s = s.replace(/(?<![\p{L}\p{M}])(?:US|AUD)\$(?=[ \u00a0]?\d)/gu, "$");

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
    // ⚠ THE GUARD IS `(?![\\p{L}\\p{M}])`, NOT `\\b`. JS defines `\\b` on ASCII `\\w`, so a following
    // NON-ASCII letter counts as a boundary and this rule fired when it must not: `25°Cölner` ate the ⟨C⟩
    // as Celsius and left "ölner" behind. Invisible to any ASCII fixture, and this language's own
    // orthography is what supplies the accented letter. 71 other engines already guard it this way.
    s = s.replace(/(\d)\s?°\s?C(?![\p{L}\p{M}])/giu, "$1 derajat Celsius");
    s = s.replace(/(\d)\s?°\s?F(?![\p{L}\p{M}])/giu, "$1 derajat Fahrenheit");
    //    COORDINATES, the third sense of the sign, and it was UNREACHABLE UNTIL THE MOJIBAKE REPAIR. The
    //    corpus writes `di timur 35Â°W` — the coordinate's degree sign was half of a broken `°` in
    //    double-encoded text, so the bare arm below could never see it and the `W` was never a problem.
    //    Generalising `repairDoubleEncoded` to lead byte C4 (for `Ä°zmir`) also mended THIS sentence's `Â°`,
    //    at which point `35°W` reached the bare arm and read *tiga puluh lima derajatW* with the direction
    //    letter glued raw into the IPA. Repairing an input EXPOSES the rules that were never exercised on it,
    //    so a mojibake fix has to be followed by a re-read of the sentences it unmasks.
    s = s.replace(/(\d)\s?°\s?([NSEW])(?![\p{L}\p{M}])/giu,
        (_m, d: string, dir: string) => `${d} derajat ${COMPASS[dir.toLowerCase()]!}`);
    s = s.replace(/(\d)\s?°/gu, "$1 derajat");

    // 6) SIGNS. Neither occurs in this corpus, but a dropped sign is silent content loss wherever it does.
    s = s.replace(/(^|[\s(])[-−–](\d)/gu, "$1minus $2");
    // ⚠ ± IS A SINGLE CHARACTER (U+00B1), NOT A `+`, so no `+` rule can ever match inside it. It needs
    //    its own rule or the sign is dropped in silence; ordering against the `+` rule is free. The
    //    reading is this language's own two words juxtaposed, both taken from the plus and minus rules
    //    already in this file.
    s = s.replace(/±/gu, " plus minus ");
    s = s.replace(/(\S)\+\s?(\d)/gu, "$1 plus $2");
    s = s.replace(/(^|\s)\+\s?(\d)/gu, "$1plus $2");

    // 6b) RELATIONAL AND DIVISION SIGNS, and this language is sourced ENTIRELY from the corpus — tier 2,
    //     audio-aligned, no Wikipedia needed. Counted in id_id as phrases:
    //
    //       `sama dengan`      ×17  — "polusi cahaya di masa mereka tidak sama dengan persoalan di masa sekarang"
    //       `lebih besar dari` ×3   — the explicit magnitude comparative, which is what `>` means
    //       `lebih kecil dari` ×3   — "foton bahkan ukurannya lebih kecil dari hal-hal penyusun atom"
    //       `dibagi`           ×3   — "rasio aspek format ini dibagi dua belas"
    //
    //     The bare `lebih dari` ×65 / `kurang dari` ×6 ("more than", "fewer than") are commoner and are NOT what
    //     these signs mean: the notation compares MAGNITUDE, which Indonesian marks with `besar`/`kecil`. Both
    //     shapes are attested and the explicit pair is the one the sign denotes.
    //
    //     ⚠ THE DIVISION WORD COMES FROM THE PARALLEL SENTENCE, and that is worth naming because it generalises:
    //     FLEURS is a PARALLEL corpus, and one of its sentences reads a division ALOUD with a numeral operand
    //     ("…dividing by twelve to obtain the simplest whole-number ratio… 3:2"). It is present in 57 of the 67
    //     corpora, so for almost every language in the fleet the division word is available at the STRONGEST
    //     tier — a recording of a human saying it — rather than at tier 3 or 4. Measured, not assumed.
    //
    //     `lebih besar dari` is preferred over the commoner bare `lebih dari` ("more than") because the sign is a
    //     magnitude comparison and Indonesian marks that with `besar`; both are attested, and the explicit one is
    //     what the notation means.
    s = s.replace(/\s?=\s?/gu, " sama dengan ");
    s = s.replace(/\s?<\s?/gu, " lebih kecil dari ");
    s = s.replace(/\s?>\s?/gu, " lebih besar dari ");
    s = s.replace(/\s?÷\s?/gu, " dibagi ");

    // 7) FRACTIONS, as "numerator per denominator" — the ordinary spoken form; ½ is setengah.
    s = s.replace(/\b(\d{1,3})\/(\d{1,3})\b(?!\s*[/\d])/gu, (_m, a: string, b: string) =>
        Number(a) === 1 && Number(b) === 2 ? "setengah" : `${a} per ${b}`);

    return s;
}
