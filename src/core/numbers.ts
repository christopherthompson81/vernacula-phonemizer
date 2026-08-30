/**
 * Native number rendering — GENERAL, not abugida-specific (declarative, portable).
 *
 * ⚠ NUMBER COMPOSITION IS BESPOKE PER NUMBERING SYSTEM — there is no universal magnitude structure — so each
 * system contributes its own `<system>NumberWords` that decomposes an integer into an ordered list of
 * number-WORD spellings. `renderNumber` is the reusable seam: it takes a composer plus a word→IPA renderer and
 * stitches the result. The composer defaults to `indicNumberWords`; a non-Indic language passes its own.
 */

export interface NumbersDef {
    units: string[]; // 0..9 spellings
    teens?: string[]; // 10..19 spellings (Indic irregular teens; omitted by systems that compose them, e.g. Turkic oʻn+unit)
    tens: Record<string, string>; // "20".."90" (round) spellings (Turkic includes "10")
    hundreds?: string[]; // 0..9 → the irregular round-hundred spellings (Western/Slavic: сто, двісті, триста…), read by westernNumberWords
    // Magnitude words. hundred/thousand are universal; Indic adds lakh/crore, Western/Turkic million/billion.
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
     * (the Hindi-belt *ekchālīs* shape). ⚠ DRAVIDIAN LANGUAGES ARE THE OTHER WAY ROUND — Kannada
     * ಇಪ್ಪತ್ತೊಂದು, Malayalam ഇരുപത്തിയൊന്ന് — and read "one twenty" under the default.
     */
    compoundOrder?: "unit-tens" | "tens-unit";
    /**
     * Read a bare 100/1000/lakh/crore as the magnitude word ALONE — Kannada ನೂರು, not *ondu nūru. Opt-in,
     * because the Hindi-belt languages genuinely do say *ek sau* and *ek hazār*.
     *
     * ⚠ It applies to EVERY magnitude, not only hundred and thousand: a version that stopped at thousand
     * still read "one lakh" and "one crore" while correctly saying a bare hundred.
     */
    bareMagnitude?: boolean;
    /**
     * COUNT-AGREEING MAGNITUDE NOUNS. `magnitudes` holds one invariant string per magnitude, which is a
     * grammatical error in every language whose magnitude word is a NOUN that inflects for its count —
     * Norwegian read 2 000 000 as *to million, where it is to millionER. Where a magnitude appears here,
     * these forms replace the invariant one; the index comes from `magnitudeCountForm`.
     *
     * This is the two-form (sg/pl) case only. The three-form Slavic paradigm PLUS multiplier-gender
     * agreement is a strict superset, and `eastSlavicNumberWords` (uk/be) already implements it — that
     * composer is the place to look before widening this one.
     */
    magnitudeParadigm?: Partial<Record<"thousand" | "million" | "billion", string[]>>;
    /**
     * count → index into `magnitudeParadigm`. Default: singular at exactly 1, plural otherwise, which is the
     * Germanic/Romance rule. A language whose split is elsewhere (Latvian is singular after any count
     * ending in 1 except 11) supplies its own; `slavicCountForm` is the ready-made 3-way selector.
     */
    magnitudeCountForm?: (count: number) => number;
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
        // ⚠ A SUPPLETIVE ROUND HUNDRED WINS OUTRIGHT where the language declares one — Odia ଶହେ for 100,
        // which `bareMagnitude` cannot express: that only OMITS the leading "one" and would leave the wrong
        // word (ଶହ).
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
 * `d.hundreds` (сто, двісті, …; Armenian հարյուր, երկուհարյուր, …). The leading "one" is OMITTED for a bare thousand
 * (тисяча / հազար, matching the bare hundred сто), but KEPT for million/billion (один мільйон — grammatical).
 *
 * ITS SCOPE, measured rather than assumed, because "why isn't this used more widely" is a recurring question.
 * Three engines read it (hy, nb, and uk/be below 1000); 115 languages compose privately, and 22 of those
 * files carry an explicit why-not. Four requirements gate entry, and a language must satisfy ALL of them:
 * irregular round hundreds expressible as a FLAT array; magnitudes that are single words per count;
 * tens-before-units; and NO connector between groups.
 *
 * A CONNECTOR SLOT WAS CONSIDERED AND DECLINED. It looks like the single highest-value knob — sq, oc, an,
 * ast, gl and is are each blocked on it alone — but the placement rule is different in every one of them:
 * Albanian puts ⟨e⟩ between ALL groups (një mijë e dyqind e tridhjetë e katër), Galician only between tens
 * and units, Occitan/Aragonese only inside the twenties, and Icelandic ⟨og⟩ only before a trailing
 * SINGLE-WORD remainder (eitt hundrað og einn, but eitt hundrað tuttugu og einn). One `connective: string`
 * field cannot express that set, and a placement enum with five members is the per-consumer knob this
 * consolidation exists to avoid — cf. the note in `dravidianNumberWords` on why Tamil does not migrate.
 * Revisit only if two languages are found to share a placement rule exactly.
 */
export const westernNumberWords: NumberComposer = (n, d) => {
    const H = d.hundreds!; // Western systems carry the irregular round-hundred spellings
    // The magnitude noun in the form its count selects, falling back to the invariant string when the
    // language authors no paradigm (which is most of them — Armenian's միլիոն does not inflect here).
    const mag = (key: "thousand" | "million" | "billion", count: number): string => {
        const forms = d.magnitudeParadigm?.[key];
        if (forms === undefined || forms.length === 0) return d.magnitudes[key]!;
        const i = (d.magnitudeCountForm ?? ((c: number) => (c === 1 ? 0 : 1)))(count);
        // Clamp rather than emit `undefined`: a 3-way selector against a 2-form table is a data error the
        // caller should not hear as the literal string "undefined" in its IPA.
        return forms[Math.min(Math.max(i, 0), forms.length - 1)]!;
    };
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
        return [...(th === 1 ? [] : westernNumberWords(th, d)), mag("thousand", th), ...(r ? westernNumberWords(r, d) : [])];
    }
    if (n < 1_000_000_000) {
        const m = Math.floor(n / 1_000_000),
            r = n % 1_000_000;
        return [...westernNumberWords(m, d), mag("million", m), ...(r ? westernNumberWords(r, d) : [])];
    }
    const b = Math.floor(n / 1_000_000_000),
        r = n % 1_000_000_000;
    return [...westernNumberWords(b, d), mag("billion", b), ...(r ? westernNumberWords(r, d) : [])];
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
    // ⚠ THE COUNT IS COMPOSED RECURSIVELY, NOT BY `dravidianBelow1000`, AND THE DIFFERENCE STARTS AT 10^10.
    // Indian 2-2-3 grouping bounds the thousand and lakh counts at 99, but the CRORE group takes everything
    // above 10^7, so its count runs to 900,719,925 at the safe-integer ceiling. Sent to a function whose
    // contract is 1-999, a count of 1000 asked for `units[10]` — `undefined` in JS, which `join(" ")`
    // rendered as an empty string. So 10^10, 10^12 and 10^15 all read as ` നൂറ് കോടി` ("hundred crore",
    // with a leading space) — three different quantities given one wrong reading, and no throw to notice it
    // by. Found by the C# port, where the same index throws (csharp/PORTING.md, the bidirectional rule).
    //
    // Recursion is the composition the system already implies: 10^9 is നൂറ് കോടി, 10^10 ആയിരം കോടി,
    // 10^12 ലക്ഷം കോടി, 10^14 കോടി കോടി. It terminates because `count` is strictly smaller than `n`, and
    // for every count below 1000 it is the SAME call `dravidianBelow1000` was making.
    return count === 1 ? [mag] : [...dravidianNumberWords(count, d), mag];
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
 * for overlapping subsets of the above; that duplication was the evidence, and named
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

/**
 * THE DIGIT-AT-A-TIME READING — the fallback for a digit run `renderNumber` must refuse.
 *
 * ⚠ WHY THIS EXISTS. `Number.isSafeInteger` is used, correctly, to refuse composing a numeral whose low
 * digits the float has already lost: `9007199254740993` arrives as `…992`, so a composed reading would be
 * confidently WRONG about the quantity. That guard is right and stays. What was missing across the fleet
 * is the `else` — the numeral was either DELETED from the reading (11 engines) or its raw ASCII digits were
 * emitted straight into the IPA (44 engines), where no g2p reads them.
 *
 * Digit-at-a-time rather than BigInt, following commit 49f9a08's decision for Sinitic: every caller here
 * ALREADY reads a decimal tail this way, out of `d.units`, so the fallback needs no word the language's
 * data was never measured on — whereas composing a higher magnitude register (trillion, and above) would
 * invent words the dicts were never measured on and trade a silent drop for a confidently-wrong numeral.
 *
 * The cost is stated plainly: above 2^53 the reading is a DIGIT STRING, not a quantity. That is the honest
 * degradation, and it is what a speaker does with an account number anyway.
 *
 * Non-digit characters (a grouping comma, a stray sign) are skipped rather than guessed at. A `units`
 * entry that is empty is a genuine gap in the language's data and is likewise skipped, not invented.
 */
/**
 * THE INDEX OF A SINGLE DIGIT CHARACTER in a `units`-shaped table, or -1 for anything else.
 *
 * ⚠ THIS EXISTS BECAUSE `Number(c)` IS THE WRONG INDEX AND ITS WRONGNESS IS SILENT (#1165). `Number()`
 * maps EVERY whitespace character to 0 — space, tab, NBSP, NNBSP, thin space — so a units table indexed
 * by it answers with the language's word for ZERO for each one. And that set is not incidental: it is
 * exactly the fleet's own grouping-separator class, the characters de-grouping rules exist to remove. A
 * separator that survives into a digit-by-digit fallback is therefore SPOKEN, as a digit the writer never
 * typed. Measured across the composers: 106 of 194 probes changed their reading when a separator was left
 * in the operand.
 *
 * Returning -1 rather than throwing keeps every caller's existing shape working: `table[-1]` is
 * `undefined`, so an `?? c` passes the character through and a `.filter` drops it, each exactly as before
 * for real digits. The DECISION about non-digits is `spellDigits`'s and is unchanged — see its header.
 */
export function digitIndex(c: string): number {
    return c >= "0" && c <= "9" ? Number(c) : -1;
}

export function spellDigits(digits: string, d: NumbersDef, word: (w: string) => string): string {
    return [...digits]
        .map((c) => (c >= "0" && c <= "9" ? d.units[Number(c)] : undefined))
        .filter((w): w is string => w !== undefined && w !== "")
        // ⚠ `.map((w) => word(w))`, NOT `.map(word)`: Array.map passes (value, index, array), so a bare
        // reference hands the INDEX to any `word` with a second parameter — ckb's `phonemizeWord(word, oov?)`
        // received `0` as its OOV resolver and threw. Every engine's word reader passes through here.
        .map((w) => word(w))
        .join(" ");
}

