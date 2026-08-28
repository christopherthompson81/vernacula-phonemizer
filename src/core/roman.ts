import { tr } from "./provenance.ts";
/**
 * Shared ROMAN NUMERAL normalization — rewrite a Roman numeral to its DIGITS so the language's own
 * cardinal number compositor pronounces it. Language-independent by construction: the only thing
 * Roman numerals encode is an integer, and every registered language can now speak an integer.
 *
 * Why digits rather than words: it reuses the per-language compositors verbatim (no new per-language
 * numeral data), and it works even in the engines whose tokenizer drops Latin runs — `XIX век` would
 * otherwise lose the numeral entirely before any numeral logic could run.
 *
 * KNOWN LIMIT, deliberate: this emits a CARDINAL where no policy asks otherwise. Several languages read a
 * Roman numeral as an ORDINAL — Russian `XIX век` is *девятнадцатый век*, Polish *dziewiętnasty*, Italian
 * *diciannovesimo*, and English regnal names are "the fourteenth". Those need per-language ordinal
 * formation with gender/case agreement, which is a separate piece of work; a cardinal is the wrong
 * register but is audible and recoverable, where the status quo silently drops or letter-spells it.
 *
 * ⚠ THAT "SEPARATE PIECE OF WORK" IS NOW SIZED, so the next person does not have to re-derive it, and so
 * "it is big" stops being a feeling (trap 17). Measured over all 162 mined artifacts:
 *
 *     multi-letter Roman numerals            2,671  across 149 artifacts
 *     with a hyphenated case/ordinal ending    237  across 157 (`III-st`, `XIV-ojo`)
 *
 * ⚠ AND THE SINGLE-LETTER COUNT IS A TRAP THAT CAUGHT THIS MEASUREMENT ON ITS FIRST PASS. Counting one-letter
 * tokens too gives 7,529 — but 4,858 of those are `C` ×1712, `I` ×905, `D` ×709, `L` ×575, `M` ×433, and they
 * are initials, list labels and unit letters, not numerals. The conservative single-letter rule below is what
 * keeps them out at runtime; a probe written to size the work has to keep them out too (trap 2).
 *
 * ⚠ WHAT BLOCKS IT IS SOURCING, NOT MECHANISM, and the mechanism was built and then REVERTED for want of a
 * consumer. Passing the matched context word to `ordinal` — which the note on `RomanPolicy.ordinal` invites,
 * and which would make case and gender reachable — is about twenty lines. The consumer was going to be
 * Estonian, whose layer already composes `ordinal(n, caseEnding)`. It does not work, for reasons worth
 * recording because they recur:
 *   · Estonian's Roman class is REGNAL, not centuries — `sajand` next to a numeral is ×0 in its corpus, while
 *     `Johannes Paulus II`, `Louis XIII`, `Charles III`, `Salmanassar III` and a dozen more are there.
 *   · Whether Estonian reads a regnal numeral as an ordinal is UNATTESTED and the corpus cannot settle it:
 *     `Karl kaheteistkümnes` is 0 tokens / 0 articles on et.wikipedia, while every instance writes `Karl XII`.
 *     Writers type the numeral; they never write how they say it — the playbook's Igbo lesson, where silence
 *     is not a refusal and a dictionary is the next tier.
 *   · The hyphen-suffix shape is not a Roman problem at all: Estonian strands the ending on DIGITS too
 *     (`3-st` → *kˈolm st*), so it belongs in that language's layer, and its corpus has 8 instances of which
 *     two are fragments of an IUPAC chemical name (`…-1-üül)-2,4,6,8-nonatetraen-1-ool`) that any rule
 *     claiming `\d+-[a-z]{1,5}` would mangle.
 * ⚠ LATVIAN WAS EVALUATED AS THE SECOND CANDIDATE CONSUMER AND REJECTED, and it is worth recording because it
 * failed the SAME test as Estonian from the opposite direction. On paper it is the ideal case: it reads a
 * Roman numeral as an ordinal, its `roman` cell is 21,482 corpus-wide, and unlike Estonian it now ships an
 * ordinal compositor with a full case paradigm (`languages/latvian/ordinals.ts`) whose case is read off the
 * FOLLOWING NOUN — exactly the context parameter this seam would pass. Then the corpus was counted:
 *
 *     multi-letter Roman numerals in the retained text        13
 *     ...followed by a noun whose case is readable             2   (`XII gadsimts`, `XII gadsimta`)
 *     ...followed by `gs.`, the abbreviation that HIDES it     3
 *     ...not an ordinal at all                                 2   (`X ledus` — ice phase X, a designation)
 *
 * Two derivable sites. The blocker is not the mechanism and not the ordinal table; it is that the shapes a
 * Roman numeral actually appears in are dominated by ones that hide the case (`gs.`) or are not ordinals
 * (phase and regnal designations). Estonian's numerals were regnal and unattested; Latvian's are abbreviated
 * and ambiguous. Two independent probes, same floor — which raises rather than lowers the bar for the next
 * candidate: measure the FOLLOWERS, not the numerals.
 *
 * So the work is: pick a language whose ordinal register is SOURCED, add the context parameter, and wire it.
 * Russian and Polish are the strongest candidates — both already have a policy here, both have oblique
 * century phrases in their own corpora (`XVIII века`, `XVII веку`, `XX wieku`, `XV wieku`), and both would
 * need per-case ordinal tables to use them.
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
 *  abbreviations, not 400/900/40.
 *
 *  ⚠ A STOPLISTED TOKEN STILL CONVERTS IN AN EXPLICIT NUMERAL CONTEXT (see `licensed` below): `XL
 *  aniversario` is the 40th, not a clothing size. The list costs nothing where the text says outright
 *  that a numeral is meant; it only refuses the ambiguous bare case.
 *
 *  ⚠ THE ALL-CAPS ABBREVIATIONS WERE MEASURED, not guessed, because the first pass added only `DC` —
 *  the one instance that happened to be reported — and `DC` is not special. Every all-caps token in the
 *  163 mined corpora that is a canonical Roman numeral and would convert today was counted and its
 *  contexts read. The genuine numerals are the low ones (`II` ×657, `III` ×295, `IV` ×183, `XX` ×140,
 *  `XIX` ×117 …). Below them sits a clean band with ZERO numeral uses between them:
 *
 *      DC   50   Washington DC, DC Comics, direct current, Deputy Commissioner, Douglas DC-3
 *      MV   19   motor vessel — `MV Gojira`, `MV Iron Baron`, `MV Nyayo`
 *      MC   10   master of ceremonies, McGraw Hill, cassette (`LP & MC`)
 *      MD   10   medical doctor, MD Pictures, McDonnell Douglas MD-80, Azerbaijani MDİ
 *      CV    8   consonant-vowel (linguistics), curriculum vitae, horsepower — Somali `140 CV`
 *      DV    8   digital video, Latgalian DV = dienvidvakari (southwest), % daily value
 *      LV    6   Latvia (`lv-LV`, `LV-4332`), Louis Vuitton, launch vehicle `Atlas LV-3`
 *      DX    6   radio DX-listening (Finnish `DX-kuuntelu`), a trim level
 *      CCC   4   Computer Center Corporation
 *
 *  Nine tokens, 121 occurrences, not one of them a number. `CV` is the one that mis-read loudest, since
 *  it takes a preceding quantity: Somali `140 CV` read as `140 105`. */
export const COLLISIONS: ReadonlySet<string> = new Set([
    "mm", "cm", "ml", "dl", "cl", "cc", // metric: millimetre, centimetre, millilitre, …
    "xl", "xxl", // clothing sizes
    "cd", "dc", "dv", "dx", "lv", "mv", "mc", "md", "cv", "ccc", // see the measurement above
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
    // ⚠ Fast path: ONE Roman letter is the floor, not two. Requiring two CONSECUTIVE letters misses a
    // single-letter numeral in non-Latin context — "L годовщина" (the 50th anniversary) returns early
    // unconverted, while "L rocznica" passes only because "rocznica" happens to contain "ci". This still
    // short-circuits every text with no Latin at all, which is the bulk of the engines this pass exists for.
    if (!/[ivxlcdmIVXLCDM]/u.test(text)) return text;
    const hasLower = /\p{Ll}/u.test(text);
    return tr(text, TOKEN, (tok, offset: number) => {
        const lower = tok.toLowerCase();
        if (policy.exclude?.has(lower)) return tok; // this language's own homograph — never a numeral
        // GLUED TO DIGITS ⇒ not a numeral but part of an alphanumeric code: the C of `39C`, the B of
        // `2B`, the X of `X5`. core/initialisms.ts encodes the same fact from the other side, claiming
        // `\p{Lu}+(?=\d)` as a code rather than an acronym.
        // ⚠ CHECKED BEFORE EVERYTHING ELSE, because the numeral-context licence below deliberately
        // bypasses the single-letter guard — without this, an ordinal context turns the `C` of
        // `JAS 39C Gripen` into "hundredth".
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
        // Without it, `D K Arya főfelügyelő-helyettes` reads as *ötszázadik K Arya* as soon as a regnal
        // rule licenses a following capitalised word — D is Roman 500.
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
