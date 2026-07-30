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
    "mix", "div", "civ", "liv", "lix", "dix", // words/abbreviations: mix, div, civ, Nordic "liv", French "dix"
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
export function normalizeRomans(text: string, policy: RomanPolicy = {}): string {
    if (!/[ivxlcdmIVXLCDM]{2}/u.test(text)) return text; // fast path: nothing plausible
    const hasLower = /\p{Ll}/u.test(text);
    return text.replace(TOKEN, (tok) => {
        if (tok.length < 2) return tok; // single letters are never worth the risk (I, V, X, C, D, M, L)
        const lower = tok.toLowerCase();
        if (COLLISIONS.has(lower) || policy.exclude?.has(lower)) return tok;
        const n = romanToInt(tok);
        if (n === null) return tok;
        const allCaps = tok === tok.toUpperCase() && /\p{Lu}/u.test(tok);
        // ALL-CAPS is only a signal when the surrounding text actually distinguishes case.
        if (allCaps && hasLower) return String(n);
        if (LOWERCASE_SAFE.has(lower)) return String(n);
        return tok;
    });
}
