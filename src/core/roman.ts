/**
 * Shared ROMAN NUMERAL normalization — rewrite a Roman numeral to its DIGITS so the language's own
 * cardinal number compositor pronounces it. Language-independent by construction: the only thing
 * Roman numerals encode is an integer, and every registered language can now speak an integer.
 *
 * Why digits rather than words: it reuses the per-language compositors verbatim (no new per-language
 * numeral data), and it works even in the engines whose tokenizer drops Latin runs — `XIX век` would
 * otherwise lose the numeral entirely before any numeral logic could run.
 *
 * KNOWN LIMIT, deliberate: this emits a CARDINAL. Several languages read a Roman numeral as an
 * ORDINAL — Russian `XIX век` is *девятнадцатый век*, Polish *dziewiętnasty*, Italian
 * *diciannovesimo*, and English regnal names are "the fourteenth". Those need per-language ordinal
 * formation with gender/case agreement, which is a separate piece of work; a cardinal is the wrong
 * register but is audible and recoverable, where the status quo silently drops or letter-spells it.
 * Languages that already resolve Romans themselves (English's regnal/cardinal context rule, French's
 * ordinal `XIVe`) are excluded at the registry seam — this pass must not pre-empt them.
 *
 * THE DETECTION PROBLEM is homographs, not decoding: many valid Roman numerals are ordinary words or
 * abbreviations. Measured in the FLEURS corpora, Italian `di` ("of", = DI 501) occurs 2,917 times,
 * French `dix` ("ten", = DIX 509) 28 times, Romanian `vii` ("alive", = VII 7) 6 times, and `mm`/`cm`
 * (= 2000/900) are metric abbreviations in nearly every language. So the policy below is conservative
 * in both directions: an explicit collision stoplist, and for lowercased input only the shapes that
 * are essentially never words.
 */

/** Canonical Roman numeral form. Non-canonical spellings (IIII, XXXX, IC) are deliberately rejected —
 *  they are far more likely to be an acronym or typo than an intended numeral. */
const CANONICAL = /^m{0,4}(cm|cd|d?c{0,3})(xc|xl|l?x{0,3})(ix|iv|v?i{0,3})$/;
const VALUES: ReadonlyArray<readonly [string, number]> = [
    ["m", 1000], ["cm", 900], ["d", 500], ["cd", 400], ["c", 100], ["xc", 90],
    ["l", 50], ["xl", 40], ["x", 10], ["ix", 9], ["v", 5], ["iv", 4], ["i", 1],
];

/**
 * Canonical Roman numeral → integer, or `null` if the token is not one. Case-insensitive; the caller
 * decides whether the token's case makes it *usable* (see `normalizeRomans`).
 */
export function romanToInt(token: string): number | null {
    const s = token.toLowerCase();
    if (s === "" || !CANONICAL.test(s)) return null;
    let n = 0;
    for (let i = 0; i < s.length; ) {
        const two = s.slice(i, i + 2);
        const pair = VALUES.find(([sym]) => sym.length === 2 && sym === two);
        if (pair) { n += pair[1]; i += 2; continue; }
        const one = VALUES.find(([sym]) => sym.length === 1 && sym === s[i]);
        if (!one) return null;
        n += one[1];
        i += 1;
    }
    return n > 0 ? n : null;
}

/** Valid canonical Roman numerals that are overwhelmingly NOT numerals in running text: metric and
 *  size abbreviations, and short words. Applied regardless of case — `CD`/`CM`/`XL` uppercase are the
 *  abbreviations, not 400/900/40. */
const COLLISIONS: ReadonlySet<string> = new Set([
    "mm", "cm", "ml", "dl", "cl", "cc", // metric: millimetre, centimetre, millilitre, …
    "xl", "xxl", // clothing sizes
    "cd", // compact disc
    "mi", "di", "ci", "li", "vi", "xi", // short words across Romance/Slavic/Nordic/Turkic; `xi` is also a name
    "mix", "div", "civ", "liv", "dix", // words/abbreviations: mix, div, civ, Nordic "liv", French "dix"
]);

/** For LOWERCASED input the case signal is gone, so only these shapes convert — the numeral forms that
 *  are essentially never words in any of the fleet's languages. Mirrors the closed set English's own
 *  roman rule uses (which likewise excludes `vi` and `xi`), extended through the twenties. */
const LOWERCASE_SAFE: ReadonlySet<string> = new Set([
    "ii", "iii", "iv", "vii", "viii", "ix",
    "xii", "xiii", "xiv", "xv", "xvi", "xvii", "xviii", "xix", "xx",
    "xxi", "xxii", "xxiii", "xxiv", "xxv", "xxvi", "xxvii", "xxviii", "xxix", "xxx",
]);

export interface RomanPolicy {
    /** Extra tokens this language must never read as a numeral — its own homographs. Lowercase. */
    exclude?: ReadonlySet<string>;
    /**
     * Integer → ORDINAL word, or `undefined` where this language cannot form one. A FUNCTION rather than
     * a table on purpose: ordinal contexts are not bounded by the century range. Anniversaries,
     * editions, congresses and Olympiads reach L (50th), and a fixed 1–30 table would silently fall back
     * to a cardinal there. Most languages form ordinals regularly above ten (Italian: cardinal minus its
     * final vowel + -esimo), so the implementation is usually a small irregular table for the low values
     * plus a rule — and the policy lives in the language's own directory precisely so it can import that
     * language's cardinal compositor and build on it. Returns a word in the language's own orthography,
     * emitted verbatim for the engine to phonemize.
     */
    ordinal?: (n: number) => string | undefined;
    /*
     * KNOWN CONTRACT LIMIT, worth stating where the next person will look: `ordinal` receives only the
     * number, not the matched context word — so it cannot inflect for the head noun. Two consequences,
     * both accepted deliberately rather than overlooked:
     *   CASE   — oblique century phrases are common ("в XIX веке", "w XIX wieku", "у XIX столітті") and
     *            want девятнадцатом / dziewiętnastym / дев'ятнадцятому; they get the nominative. The
     *            right lexeme with the wrong ending still beats a cardinal, which is the wrong word.
     *   GENDER — a feminine or neuter head takes the masculine form (Russian `L годовщина` →
     *            пятидесятый, not пятидесятая).
     * Fixing either means passing the matched context word through to `ordinal` and giving each language
     * per-case/per-gender tables. Additive to this interface when someone wants it.
     */
    /**
     * Fires the ORDINAL reading when it matches the text immediately BEFORE the numeral — the century
     * noun ("siglo", "secolul", "wiek", "век") or a regnal title. Without a match the numeral stays a
     * cardinal, which is the right default for enumeration and for the languages (es, pt) that read
     * centuries as cardinals natively. Tested against the preceding word only.
     */
    ordinalBefore?: RegExp;
    /** As `ordinalBefore`, but matched against the word FOLLOWING the numeral ("xix secolo", "xix век"). */
    ordinalAfter?: RegExp;
}

/** Per-language homographs of a Roman numeral, beyond the global collision list. */
export const ROMAN_EXCLUSIONS: Readonly<Record<string, ReadonlySet<string>>> = {
    ro: new Set(["vii"]), // "vii" = alive / vines (plural of viu, vie)
    rup: new Set(["vii"]),
};

const TOKEN = /\p{L}+/gu;

/**
 * Rewrite Roman numerals in `text` to digits. Conservative by design: a token converts only when it is
 * a canonical Roman numeral of at least two characters, is not a known collision, and its case makes
 * it identifiable — ALL-CAPS in text that has lowercase elsewhere (so the capitals are meaningful), or
 * a member of the lowercase-safe closed set.
 */
const PREV_WORD = /(\p{L}+)[^\p{L}]*$/u;
const NEXT_WORD = /^[^\p{L}]*(\p{L}+)/u;

export function normalizeRomans(text: string, policy: RomanPolicy = {}): string {
    // Fast path: ONE Roman letter is the floor, not two. Requiring two CONSECUTIVE letters looked like a
    // cheaper filter but was wrong for a single-letter numeral in non-Latin context — "L годовщина" (the
    // 50th anniversary) returned early unconverted, while "L rocznica" happened to pass only because
    // "rocznica" contains "ci". This still short-circuits every text with no Latin at all, which is the
    // bulk of the engines this pass exists for.
    if (!/[ivxlcdmIVXLCDM]/u.test(text)) return text;
    const hasLower = /\p{Ll}/u.test(text);
    return text.replace(TOKEN, (tok, offset: number) => {
        const lower = tok.toLowerCase();
        if (policy.exclude?.has(lower)) return tok; // this language's own homograph — never a numeral
        // GLUED TO DIGITS ⇒ not a numeral but part of an alphanumeric code: the C of `39C`, the B of
        // `2B`, the X of `X5`. core/initialisms.ts already encodes the same fact from the other side,
        // claiming `\p{Lu}+(?=\d)` as a code rather than an acronym. This is checked BEFORE everything
        // else because the numeral-context licence below deliberately bypasses the single-letter guard,
        // so without it an ordinal context turns the `C` of `JAS 39C Gripen` into "hundredth". Found by
        // the Hungarian run, which measured a regnal-ordinal rule gaining 3 instances and losing that one
        // — and reverted the rule rather than ship a confidently wrong reading.
        if (/\d/u.test(text[offset - 1] ?? "") || /\d/u.test(text[offset + tok.length] ?? "")) return tok;
        const n = romanToInt(tok);
        if (n === null) return tok;
        const allCaps = tok === tok.toUpperCase() && /\p{Lu}/u.test(tok);
        // A NUMERAL CONTEXT (an adjacent century noun / ordinal trigger) is strong evidence, and it
        // licenses what the conservative rules would otherwise refuse: a stoplisted token (`XL
        // aniversario` is the 40th, not a clothing size) and a single letter (`L aniversario` is the
        // 50th). It is gated on ALL-CAPS deliberately — without that, Spanish `mi aniversario` ("my
        // anniversary", MI = 1001) would be read as a numeral, and lowercase Catalan `i` means "and".
        const prevW = PREV_WORD.exec(text.slice(0, offset))?.[1];
        const nextW = NEXT_WORD.exec(text.slice(offset + tok.length))?.[1];
        const inContext =
            (prevW !== undefined && policy.ordinalBefore?.test(prevW) === true) ||
            (nextW !== undefined && policy.ordinalAfter?.test(nextW) === true);
        // A CONTIGUOUS RUN OF SINGLE CAPITALS IS INITIALS, not numerals — the same contiguity principle
        // core/initialisms.ts uses, generalised: there the run was recognised by its periods (`J. S.
        // Bach`), but the dots are incidental and `D K Arya` is the same thing. Two adjacent single
        // capitals are unambiguous, because no numeral is written that way; a LONE capital stays
        // ambiguous and is left to the rules below.
        //
        // This is what let `D K Arya főfelügyelő-helyettes` read as *ötszázadik K Arya* once a regnal
        // rule licensed a following capitalised word — D is Roman 500.
        const isSingleCap = (w: string | undefined): boolean =>
            w !== undefined && w.length === 1 && w === w.toUpperCase() && /\p{Lu}/u.test(w);
        if (isSingleCap(tok) && (isSingleCap(prevW) || isSingleCap(nextW))) return tok;

        const licensed = inContext && allCaps && hasLower;
        if (!licensed) {
            if (tok.length < 2) return tok; // single letters are never worth the risk (I, V, X, C, D, M, L)
            if (COLLISIONS.has(lower)) return tok;
            // ALL-CAPS is only a signal when the surrounding text actually distinguishes case.
            if (!(allCaps && hasLower) && !LOWERCASE_SAFE.has(lower)) return tok;
        }
        // ORDINAL reading, when this language asks for one in this context ("siglo XIX", "XIX век").
        // The ordinal word is emitted verbatim; anything else becomes digits for the cardinal path.
        if (inContext) {
            const ord = policy.ordinal?.(n);
            if (ord !== undefined && ord !== "") return ord;
        }
        return String(n);
    });
}
