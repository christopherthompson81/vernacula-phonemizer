/**
 * Native number rendering — GENERAL, not abugida-specific (declarative, portable — no espeak number data).
 *
 * Number COMPOSITION is bespoke per numbering system (there is no universal magnitude structure — see the
 * rejected Layer-A number-builder consolidation), so each system contributes its own `<system>NumberWords`
 * that decomposes an integer into an ordered list of number-WORD spellings. `renderNumber` is the reusable
 * seam: it takes a composer + a word→IPA renderer and stitches the result. The composer defaults to
 * `indicNumberWords` (the only system so far); a non-Indic native language passes its own (e.g. a Western
 * thousand/million/billion composer) to the same `renderNumber`. The magnitude-field DATA schema on
 * `NumbersDef` (currently Indic lakh/crore) generalises when that 2nd system lands (ADR-0002 defers the
 * data-schema lift to the 2nd consumer; the composer SEAM exists from day one).
 */

export interface NumbersDef {
    units: string[]; // 0..9 spellings
    teens?: string[]; // 10..19 spellings (Indic irregular teens; omitted by systems that compose them, e.g. Turkic oʻn+unit)
    tens: Record<string, string>; // "20".."90" (round) spellings (Turkic includes "10")
    hundreds?: string[]; // 0..9 → the irregular round-hundred spellings (Western/Slavic: сто, двісті, триста…), read by westernNumberWords
    // Magnitude words. hundred/thousand are universal; Indic adds lakh/crore, Western/Turkic adds million/billion.
    // (ADR-0002: the data-schema lift lands with the 2nd numbering system — Uzbek's Turkic composer.)
    magnitudes: {
        hundred: string;
        thousand: string;
        lakh?: string;
        crore?: string;
        million?: string;
        billion?: string;
    };
    /** Optional full irregular 21..99 spellings (keyed by the number); overrides tens+unit composition. */
    compound?: Record<string, string>;
    /**
     * Order of the 21..99 FALLBACK when no `compound` spelling is authored. The default is UNIT then TENS
     * (the Hindi-belt *ekchālīs* shape). DRAVIDIAN languages are the other way round — Kannada
     * ಇಪ್ಪತ್ತೊಂದು, Malayalam ഇരുപത്തിയൊന്ന് — and were reading "one twenty". Found by the Telugu run,
     * which fixed its own with a private composer and then measured the same defect in its relatives.
     */
    compoundOrder?: "unit-tens" | "tens-unit";
    /**
     * Read a bare 100/1000/lakh/crore as the magnitude word ALONE — Kannada ನೂರು, not *ondu nūru. Opt-in,
     * because the Hindi-belt languages genuinely do say *ek sau* and *ek hazār*.
     *
     * It applied to hundred and thousand ONLY when first added, so a language declaring it still read
     * "one lakh" and "one crore" while correctly saying a bare hundred — Malayalam did, and Kannada would
     * have but for writing its own composer. Reported independently by the Punjabi and Kannada runs, both
     * of which read the code rather than probing.
     */
    bareMagnitude?: boolean;
    /** Optional decimal-point word (Hindi दशमलव); when present the text path reads N.M as int दशमलव digit-by-digit. */
    decimalWord?: string;
}

/** A number-composition strategy: integer → ordered number-word spellings (`null` = un-authored gap). */
export type NumberComposer = (n: number, d: NumbersDef) => (string | null)[];

/**
 * INDIC (South Asian) number composition: 2-2-3 lakh/crore grouping. Hindi 21-99 are irregular (not
 * compositional) and require their `compound` spellings; a missing one yields `null` (a marked gap).
 */
export const indicNumberWords: NumberComposer = (n, d) => {
    if (n < 10) return [d.units[n]!];
    if (n < 20) return [d.teens![n - 10]!];
    if (n < 100) {
        const t = Math.floor(n / 10) * 10,
            u = n % 10;
        if (u === 0) return [d.tens[String(t)]!];
        if (d.compound?.[String(n)]) return [d.compound[String(n)]!];
        // 21-99 fused spelling not authored → degrade to a best-effort two-word reading instead of leaking
        // a "?" into the IPA. Approximate (the real fused form differs) but readable; a full `compound`
        // map overrides it. The ORDER is language-specific — see `compoundOrder`.
        return d.compoundOrder === "tens-unit"
            ? [d.tens[String(t)]!, d.units[u]!]
            : [d.units[u]!, d.tens[String(t)]!];
    }
    if (n < 1000) {
        const h = Math.floor(n / 100),
            r = n % 100;
        // A SUPPLETIVE round hundred wins outright where the language declares one — Odia ଶହେ for 100,
        // which `bareMagnitude` cannot express because that only OMITS the leading "one" and would leave
        // the wrong word (ଶହ). `NumbersDef.hundreds` already existed for this but only westernNumberWords
        // and the Dravidian composer read it. Reported by the Odia run, and by Kannada before it.
        const sup = d.hundreds?.[h];
        if (sup !== undefined && sup !== "") return [sup, ...(r ? indicNumberWords(r, d) : [])];
        return [
            // Otherwise a bare hundred is just the magnitude word in the languages that declare it.
            ...(h === 1 && d.bareMagnitude ? [] : [d.units[h]!]),
            d.magnitudes.hundred,
            ...(r ? indicNumberWords(r, d) : []),
        ];
    }
    if (n < 100000) {
        const th = Math.floor(n / 1000),
            r = n % 1000;
        return [
            ...(th === 1 && d.bareMagnitude ? [] : indicNumberWords(th, d)),
            d.magnitudes.thousand,
            ...(r ? indicNumberWords(r, d) : []),
        ];
    }
    if (n < 10000000) {
        const l = Math.floor(n / 100000),
            r = n % 100000;
        return [
            ...(l === 1 && d.bareMagnitude ? [] : indicNumberWords(l, d)),
            d.magnitudes.lakh!,
            ...(r ? indicNumberWords(r, d) : []),
        ];
    }
    const c = Math.floor(n / 10000000),
        r = n % 10000000;
    return [
        ...(c === 1 && d.bareMagnitude ? [] : indicNumberWords(c, d)),
        d.magnitudes.crore!,
        ...(r ? indicNumberWords(r, d) : []),
    ];
};

/**
 * WESTERN / Slavic decimal composition (units + teens + tens + hundreds + thousand/million/billion, space-separated).
 * Shared by the East-Slavic (uk, be) and Armenian (hy) engines — they differ only in their DATA (`d.units` etc.),
 * routed through each language's own G2P by `renderNumber`. Needs the irregular round-hundred spellings in
 * `d.hundreds` (сто, двісті, …; Armenian հարюр, երկուհարюр, …). The leading "one" is OMITTED for a bare thousand
 * (тисяча / հазар, matching the bare hundred сто), but KEPT for million/billion (один мільйон — grammatical).
 */
export const westernNumberWords: NumberComposer = (n, d) => {
    const H = d.hundreds!; // Western systems carry the irregular round-hundred spellings
    if (n < 10) return [d.units[n]!];
    if (n < 20) return [d.teens![n - 10]!];
    if (n < 100) {
        const t = Math.floor(n / 10) * 10,
            u = n % 10;
        return [d.tens[String(t)]!, ...(u ? [d.units[u]!] : [])];
    }
    if (n < 1000) {
        const h = Math.floor(n / 100),
            r = n % 100;
        return [H[h]!, ...(r ? westernNumberWords(r, d) : [])];
    }
    if (n < 1_000_000) {
        const th = Math.floor(n / 1000),
            r = n % 1000;
        // omit the leading "one" for exactly 1000 (тисяча, not *один тисяча — a bare magnitude like the hundred сто)
        return [...(th === 1 ? [] : westernNumberWords(th, d)), d.magnitudes.thousand, ...(r ? westernNumberWords(r, d) : [])];
    }
    if (n < 1_000_000_000) {
        const m = Math.floor(n / 1_000_000),
            r = n % 1_000_000;
        return [...westernNumberWords(m, d), d.magnitudes.million!, ...(r ? westernNumberWords(r, d) : [])];
    }
    const b = Math.floor(n / 1_000_000_000),
        r = n % 1_000_000_000;
    return [...westernNumberWords(b, d), d.magnitudes.billion!, ...(r ? westernNumberWords(r, d) : [])];
};

/**
 * A Dravidian magnitude/hundred word's forms. `bare` and `combining` are the minimum — the combining
 * ("oblique") form is the one used when a remainder follows, and it is the joint that holds an Indian
 * numeral together: Kannada ಸಾವಿರದ, Malayalam ആയിരത്തി, Telugu నూట. `plural`/`pluralOblique` exist for
 * the languages that ALSO inflect the noun for a count above one (Telugu రెండు వందలు / రెండు వందల);
 * where they are absent the bare/combining pair is used at every count, which is Kannada and Malayalam.
 */
export interface DravidianForms {
    bare: string;
    combining: string;
    plural?: string;
    pluralOblique?: string;
}

/**
 * The data a Dravidian numeral needs beyond `indicNumberWords`. See `dravidianNumberWords` for why the
 * three extra fields exist; each of them is a thing `indicNumberWords` structurally cannot say.
 */
export interface DravidianNumbersDef {
    units: string[]; // 0..9
    teens: string[]; // 10..19
    tens: Record<string, string>; // "20".."90"
    /** Fused 21-99, keyed by the number. Absent ⇒ the two-word ten+unit reading (Telugu). */
    compound?: Record<string, string>;
    /** Suppletive round hundreds, keyed by the COUNT of hundreds (kn ಇನ್ನೂರು, ml ഇരുന്നൂറ്). */
    hundredForms?: Record<string, DravidianForms>;
    /** Suppletive round thousands, keyed by the COUNT of thousands (ml രണ്ടായിരം, മൂവായിരം). */
    thousandForms?: Record<string, DravidianForms>;
    magnitudeForms: {
        hundred: DravidianForms;
        thousand: DravidianForms;
        lakh: DravidianForms;
        crore: DravidianForms;
    };
}

type MagnitudeKey = keyof DravidianNumbersDef["magnitudeForms"];

/** The form a noun takes at this count, with this much following it. */
const dravidianForm = (f: DravidianForms, count: number, hasRemainder: boolean): string =>
    count === 1
        ? (hasRemainder ? f.combining : f.bare)
        : (hasRemainder ? (f.pluralOblique ?? f.combining) : (f.plural ?? f.bare));

/** 1-99. The fused `compound` spelling wins; without one, the ten and the unit are two words. */
function dravidianBelow100(n: number, d: DravidianNumbersDef): string[] {
    if (n <= 0) return [];
    if (n < 10) return [d.units[n]!];
    if (n < 20) return [d.teens[n - 10]!];
    const t = Math.floor(n / 10) * 10,
        u = n % 10;
    if (u === 0) return [d.tens[String(t)]!];
    const fused = d.compound?.[String(n)];
    return fused !== undefined ? [fused] : [d.tens[String(t)]!, d.units[u]!];
}

/** 1-999. A suppletive hundred is ONE word; a count of exactly one is never spelled out. */
function dravidianBelow1000(n: number, d: DravidianNumbersDef): string[] {
    const h = Math.floor(n / 100),
        r = n % 100;
    if (h === 0) return dravidianBelow100(r, d);
    const sup = d.hundredForms?.[String(h)];
    if (sup !== undefined) return [r > 0 ? sup.combining : sup.bare, ...dravidianBelow100(r, d)];
    const mag = dravidianForm(d.magnitudeForms.hundred, h, r > 0);
    return h === 1
        ? [mag, ...dravidianBelow100(r, d)]
        : [d.units[h]!, mag, ...dravidianBelow100(r, d)];
}

/** One magnitude group: its count, then the noun in the form that count and that remainder select. */
function dravidianGroup(
    key: MagnitudeKey,
    count: number,
    hasRemainder: boolean,
    d: DravidianNumbersDef,
): string[] {
    const sup = key === "thousand" ? d.thousandForms?.[String(count)] : undefined;
    if (sup !== undefined) return [hasRemainder ? sup.combining : sup.bare];
    const mag = dravidianForm(d.magnitudeForms[key], count, hasRemainder);
    return count === 1 ? [mag] : [...dravidianBelow1000(count, d), mag];
}

/**
 * DRAVIDIAN number composition — Indian 2-2-3 grouping like `indicNumberWords`, but able to say the
 * three things that composer structurally cannot, each of which made a whole language's numerals wrong:
 *
 *   1. FUSION. 21-99 is ONE word (kn ಇಪ್ಪತ್ತೊಂದು, ml ഇരുപത്തിയൊന്ന്), not two. `indicNumberWords` has a
 *      `compound` map for this, so this reason alone would not need a new composer; the next two do.
 *   2. SUPPLETIVE ROUND HUNDREDS/THOUSANDS. 200 is kn ಇನ್ನೂರು / ml ഇരുന്നൂറ്, 900 is ml തൊള്ളായിരം, and
 *      2000 is ml രണ്ടായിരം — single fused stems, not "two hundred"/"two thousand".
 *      `NumbersDef.hundreds` exists but only `westernNumberWords` reads it, and nothing expresses the
 *      thousands at all.
 *   3. COMBINING (oblique) MAGNITUDE FORMS. When a remainder follows, the noun changes: kn 1976 is
 *      ಸಾವಿರದ ಒಂಬೈನೂರಾ ಎಪ್ಪತ್ತಾರು, ml ആയിരത്തി തൊള്ളായിരത്തി എഴുപത്തിയാറ്. `indicNumberWords` emits the
 *      bare noun everywhere, so ml 1976 read ആയിരം ഒമ്പത് നൂറ് എഴുപത് ആറ് — five words for three, with
 *      the wrong hundred and no linkage.
 *
 * WHY IT IS HERE AND NOT A FOURTH PRIVATE COPY. Tamil, Telugu and Kannada each wrote their own composer
 * for overlapping subsets of the above; the playbook recorded that duplication as evidence and named
 * Malayalam as the trigger to consolidate. It is, so this is that consolidation — te, kn and ml all read
 * it, and each of their corpus diffs is byte-identical across the migration.
 *
 * TAMIL DOES NOT MIGRATE, and the reason is recorded in tamil/numbers.ts: it fuses the COUNT into the
 * thousand for counts of 21-99 (23,000 = இருபத்தி மூவாயிரம், the ten's oblique plus a fused thousand),
 * and it spells a count of one as an attributive ஒரு before லட்சம்/கோடி. Neither is expressible here,
 * and inventing knobs for one consumer is what this consolidation exists to avoid.
 */
export function dravidianNumberWords(n: number, d: DravidianNumbersDef): string[] {
    if (!Number.isFinite(n) || n < 0) return [];
    if (n === 0) return [d.units[0]!];
    const parts: string[] = [];
    const crore = Math.floor(n / 10000000);
    n %= 10000000;
    const lakh = Math.floor(n / 100000);
    n %= 100000;
    const thou = Math.floor(n / 1000);
    n %= 1000;
    if (crore > 0) parts.push(...dravidianGroup("crore", crore, lakh + thou + n > 0, d));
    if (lakh > 0) parts.push(...dravidianGroup("lakh", lakh, thou + n > 0, d));
    if (thou > 0) parts.push(...dravidianGroup("thousand", thou, n > 0, d));
    parts.push(...dravidianBelow1000(n, d));
    return parts;
}

/** Render an integer to canonical IPA: compose it to number words (`compose`, default Indic), then map
 *  each word through `word` (a native G2P word→IPA renderer). The generic, system-agnostic seam. */
export function renderNumber(
    n: number,
    d: NumbersDef,
    word: (w: string) => string,
    compose: NumberComposer = indicNumberWords,
): string {
    return compose(n, d)
        .map((w) => (w === null ? "?" : word(w)))
        .join(" ");
}
