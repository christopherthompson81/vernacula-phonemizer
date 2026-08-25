/**
 * Hungarian (hu) text normalization — the pre-tokenizer pass that rewrites anything not already a
 * pronounceable word into words the pipeline speaks. Pure text→text, no IPA.
 *
 * ⚠ THE ORDINAL DETECTOR. Hungarian writes an ordinal as a numeral plus a PERIOD (`19. század`), which a
 * regex cannot distinguish from a sentence-final digit. The rule: `N.` is an ordinal when followed by
 * whitespace and a LOWERCASE letter, or by a comma. Hungarian starts sentences with a capital, so
 * "lowercase follows" is a STRONGER signal than "anything follows" — and the invariant that matters is that
 * no sentence-final pause is lost. An ordinal before a capitalised word is knowingly given up to hold it.
 *
 * A YEAR before a month name is read as a plain CARDINAL and its period is silent
 * (`1759. szeptember 24-en`), so the detector must not turn those into ordinals either.
 *
 * VOWEL HARMONY COSTS NOTHING HERE, though it looks as if it should: Hungarian selects `-ban`/`-ben`,
 * `-an`/`-en`, `-ra`/`-re` by the harmony of the SPOKEN numeral, and the orthography already writes the
 * chosen form after the hyphen (`1848-ban`, `1970-es`). Plain concatenation onto the spoken numeral is
 * therefore correct. The one place harmony IS computed is the bare date nominative, where nothing is
 * written to copy — see `dateNominative`.
 *
 * DELIBERATELY LEFT:
 *   · ranges and scores — Hungarian reads a range with `-tol …-ig` and a score with bare juxtaposition, and
 *     nothing distinguishes them in text. A wrong connective is worse than none.
 *   · the DOT decimal (`2.4Ghz`) — claiming `\d\.\d` would collide with version codes (`802.11n`).
 *   · `2` before a counted noun, which wants the attributive *ket* rather than *ketto*. That needs a noun
 *     test this layer has no business owning.
 *   · currency — no sign occurs in Hungarian text this engine has seen; the words are always spelled out,
 *     so declaring signs would be inventing them.
 *   · `-al`/`-el` after a numeral — the standard forms are `-mal`/`-tel` with assimilation, so plain
 *     concatenation gives *haromal* for *harommal*. The written form is the writer's shorthand.
 *
 * ⚠ THE MULTIPLICATION SIGN IS A VOWEL-HARMONIC SUFFIX, NOT A WORD, which is why it is unshipped. `56 × 56`
 * is *otvenhatszor otvenhat*: the multiplicative -szor/-szer/-szor fuses onto the FIRST numeral and the
 * allomorph depends on that numeral vowels (hat→hatszor, ot→otszor, ketto→ketszer). That needs the number
 * words plus harmony, not a string substitution — the shape `attachSuffix` handles for apostrophe suffixes.
 */
import { makeInitialismNormalizer, makeUnreadableTest } from "../../core/initialisms.ts";
import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";
import { multiplicativeWords, numberToWords, ordinalWords, stemForSuffix } from "./numbers.ts";

const LOWER = "a-záéíóöőúüű";

/** The twelve month names, matched case-insensitively and UNANCHORED at the end — Hungarian agglutinates
 *  onto them (`szeptemberében`, `augusztusban`). Used by three rules; see steps 9a/9b/10a. */
const MONTH =
    "(?:janu[áa]r|febru[áa]r|m[áa]rcius|[áa]prilis|m[áa]jus|j[úu]nius|j[úu]lius|augusztus|szeptember|okt[óo]ber|november|december)";

/** Dotted abbreviations → the spoken words. Counts are corpus counts. Every one of these previously left
 *  its interior dot behind as a phrase break, and `pl.`/`kb.`/`stb.` additionally reached the g2p as an
 *  unreadable consonant cluster. `stb.` is given as *satöbbi*, the dictionary-recorded single-word
 *  reading, so it carries one stress rather than three. */
const DOTTED_ABBREV: Readonly<Record<string, string>> = {
    "pl": "például", // ×7
    "kb": "körülbelül", // ×5
    "stb": "satöbbi", // ×5
    "ld": "lásd", // ×1
    "dr": "doktor", // ×6 (written `Dr.`)
};
const ABBREV_ALT = Object.keys(DOTTED_ABBREV)
    .sort((a, b) => b.length - a.length)
    .join("|");

/** Hungarian letter names (the traditional alphabet naming used when spelling an acronym: *gé-pé-es*,
 *  *ef-bé-í*, *á-bé-cé*). Vowels take their LONG name, which is what `USA`→*u-es-á* and `ABC`→*ábécé*
 *  show. `q/w/x/y` are the "foreign" letters but do have established names, so they are included. */
const LETTER_NAME: Readonly<Record<string, string>> = {
    a: "á",
    "á": "á",
    b: "bé",
    c: "cé",
    d: "dé",
    e: "é",
    "é": "é",
    f: "ef",
    g: "gé",
    h: "há",
    i: "í",
    "í": "í",
    j: "jé",
    k: "ká",
    l: "el",
    m: "em",
    n: "en",
    o: "ó",
    "ó": "ó",
    "ö": "ő",
    "ő": "ő",
    p: "pé",
    q: "kú",
    r: "er",
    s: "es",
    t: "té",
    u: "ú",
    "ú": "ú",
    "ü": "ű",
    "ű": "ű",
    v: "vé",
    w: "dupla vé",
    x: "iksz",
    y: "ipszilon",
    z: "zé",
};

/**
 * Hungarian DIGRAPHS folded to one stand-in letter before the phonotactic test. Without this the test
 * counts letters where the orthography spells single consonants, and `ENSZ` (letters e-n-s-z) looks like
 * a three-consonant run and would be spelled out — where Hungarian reads it as the word *ensz*. The fold
 * models exactly what the g2p will do with the same string, which is what makes it the right input to a
 * "could this be read as a word" question.
 */
const DIGRAPH = /dzs|sz|zs|cs|gy|ny|ty|ly|dz/gu;
const DIGRAPH_FOLD: Readonly<Record<string, string>> = {
    dzs: "z",
    sz: "s",
    zs: "z",
    cs: "c",
    gy: "g",
    ny: "n",
    ty: "t",
    ly: "j",
    dz: "z",
};
const fold = (w: string): string => w.replace(DIGRAPH, (d) => DIGRAPH_FOLD[d]!);

/** Hungarian phonotactics, for the OOV rule in core/initialisms.ts. Native Hungarian words admit NO
 *  initial cluster; the onsets listed are the ones loanwords brought in. Applied to the digraph-folded
 *  form (see `fold`). */
const unreadableFolded = makeUnreadableTest({
    vowels: /[aáeéiíoóöőuúüű]/u,
    legalOnsets: new Set([
        "bl",
        "br",
        "cl",
        "cr",
        "dr",
        "dv",
        "fl",
        "fr",
        "gl",
        "gn",
        "gr",
        "hr",
        "kl",
        "kn",
        "kr",
        "kv",
        "kw",
        "pl",
        "pn",
        "pr",
        "ps",
        "sc",
        "sf",
        "sk",
        "sl",
        "sm",
        "sn",
        "sp",
        "sr",
        "st",
        "sv",
        "sw",
        "tr",
        "tv",
        "tw",
        "vl",
        "vr",
        "zl",
        "zn",
        "zv",
    ]),
    legalCodas: new Set([
        "ct",
        "ft",
        "js",
        "jt",
        "kk",
        "ks",
        "kt",
        "lb",
        "lc",
        "ld",
        "lf",
        "lg",
        "lj",
        "lk",
        "lm",
        "ln",
        "lp",
        "ls",
        "lt",
        "lz",
        "mb",
        "mp",
        "ms",
        "nc",
        "nd",
        "ng",
        "nj",
        "nk",
        "ns",
        "nt",
        "nz",
        "ps",
        "pt",
        "rb",
        "rc",
        "rd",
        "rf",
        "rg",
        "rj",
        "rk",
        "rl",
        "rm",
        "rn",
        "rp",
        "rs",
        "rt",
        "rz",
        "sk",
        "sp",
        "st",
    ]),
});
export const isUnreadableHungarian = (word: string): boolean => unreadableFolded(fold(word.toLowerCase()));

/** Letter-by-letter reading, or undefined if any character has no Hungarian letter name — the caller then
 *  leaves the token alone rather than emitting a partial reading. Mirrors core/initialisms.ts's own
 *  `spellOut`, which is private to it. */
function spellOut(acr: string): string | undefined {
    const names = [...acr.toLowerCase()].map((c) => LETTER_NAME[c]);
    return names.every((n) => n !== undefined) ? names.join(" ") : undefined;
}

/** LEXICAL overrides: acronyms whose Hungarian reading is neither "spell the letters" nor "read as a
 *  word". `WC` is *vécé*, a dictionary-recorded Hungarian word — the letter names would give the
 *  three-word *dupla vé cé*. Sourced, not guessed; nothing else in the corpus needed an entry. */
const ACRONYM_WORD: Readonly<Record<string, string>> = { WC: "vécé" };

/** Hungarian has no pronunciation dictionary here (the g2p is rule-based), so nothing is "recorded" and
 *  the decision rests on the phonotactic OOV test alone. `acronymLetters` is empty on purpose — see the
 *  header on AOL/CEP/HIV/SUV. */
const normalizeInitialisms = makeInitialismNormalizer({
    letterName: (l) => LETTER_NAME[l],
    acronymLetters: new Set<string>(),
    isRecorded: () => false,
    isUnreadable: isUnreadableHungarian,
});

/**
 * Unit and percent words. NO count agreement: a Hungarian numeral takes the SINGULAR noun (*öt
 * kilométer*, *nyolc százalék*), so every `CountForms` here is a one-element array and the default
 * `countForm` collapses onto it.
 *
 * `unitPer: "per"` is the ordinary Hungarian rate idiom (*kilométer per óra*). The exponent is a
 * COMPOUND PREFIX — *négyzetkilométer*, *köbméter*, one word — which is the `compound` position the
 * Swedish/Japanese case introduced; `after` would give the non-word *kilométer négyzet*.
 *
 * `h`/`s`/`ó`/`óra`/`órás` are rate DENOMINATORS only. `s` in particular must never match standalone:
 * the corpus writes `802.11a`, `802.11b`, `802.11g` and a bare `s` unit would start biting into codes
 * like these — the hazard `rateDenominators` exists for.
 */
const normalizeSymbols = makeSymbolNormalizer({
    // ⚠ THE AMPERSAND WAS A MISSING CELL, NOT A SOURCING PROBLEM — the tier's own `ampersand` note says so,
    // and this language is one of the fourteen that still had no word declared, so `&` was DROPPED outright.
    // és is ×2257 TOKEN in this language's own corpus, i.e. among its commonest words; there was nothing to source.
    //
    // A Latin-script printing LIGATURE rather than anything native, so what it takes is a reading and not a
    // translation: for a language written in Latin script that is its own conjunction, and for one that is not,
    // the symbol only ever arrives inside a Latin run. Either way the tier substitutes the conjunction, SPACED —
    // see the tier, where the spacing exists because `B&B` is two initialisms.
    ampersand: "és",
    percent: ["százalék"],
    /**
     * CURRENCY. `$5` read as bare *ˈøt* — the sign contributed nothing, which is worse than a wrong
     * word because nothing in the output marks the loss. hu_hu contains ZERO `$` against 57 `%`, so the
     * corpus-driven gate that caught the percent could not see this; the WORDS are nonetheless in that same
     * corpus, spelled out:
     *
     *   dollár  ×6   "11,000 és 22,500 amerikai dollár közötti áron"
     *   font    ×10  "hivatalos pénzneme a falklandi font (FKP)"
     *
     * ONE FORM EACH, because Hungarian takes the SINGULAR after a numeral (öt dollár, not *öt dollárok).
     *
     * `euró` and `jen` are DELIBERATELY ABSENT: both are 0 in the corpus under a token test. An unsourced
     * currency word is left unread rather than guessed.
     */
    currency: { $: ["dollár"], "£": ["font"] },
    units: {
        km: ["kilométer"],
        m: ["méter"],
        cm: ["centiméter"],
        mm: ["milliméter"],
        kg: ["kilogramm"],
        "mérföld": ["mérföld"],
        mbit: ["megabit"],
        /**
         * ⚠ `mp` IS THE SECOND, AND IT IS A NUMERATOR KEY EVEN THOUGH `s` IS A DENOMINATOR-ONLY ONE. The
         * artifact's `133 m/s, 300 mp/h` left `ˈmp ˈh` raw: the tier resolved neither half, so the rate arm
         * declined and the whole phrase reached the IPA as ASCII. `s` cannot be promoted to fix it (see the
         * docblock above — a standalone `s` bites into `802.11a`-shaped codes), and `mp` has no such second
         * life: it is two letters, vowel-free, and not a Hungarian word.
         *
         * SOURCING — hu.wikipedia states the equivalence twice, from both ends, and `attest.ts --lang hu`
         * has both cached:
         *   · the *másodperc* article: "…(szövegben – az **mp** rövidítést is)" — the second, abbreviated
         *     ⟨mp⟩ in running text. 110 tokens / 19 articles.
         *   · the ⟨mp⟩ disambiguation page: "mp, Mp – időre vonatkozó mértékegységként a másodperc egyik
         *     jelölése, helyesen: s". 156 tokens / 18 articles.
         * ⚠ THAT SAME PAGE LISTS A SECOND UNIT SENSE AND IT IS READ AND REJECTED, not skipped: `mp` is also
         * the MILLIPOND, a CGS-era force unit. It is obsolete, it is not what a Hungarian text with a figure
         * in front of it means, and the ⟨s⟩-gloss above is the wiki's own account of ordinary written usage.
         * Declaring the millipond instead would be the *kong-si* error — the attested sense that is not the
         * one in the slot.
         * ⚠ AND THE CORPUS SENTENCE IS ITSELF A MISTRANSLATION — English "300 mph" rendered as `300 mp/h`,
         * so what it MEANS is miles per hour. That is not this layer's business and must not become it: the
         * layer reads the Hungarian that is written, and *háromszáz másodperc per óra* is what is written.
         */
        mp: ["másodperc"],
    },
    unitPer: "per",
    rateDenominators: { h: "óra", s: "másodperc", "ó": "óra", "óra": "óra", "órás": "órás" },
    exponentWords: { squared: ["négyzet"], cubed: ["köb"], position: "compound" },
});

/** Unit abbreviations that may carry a hyphen-attached suffix directly (`km-re`, `mm-es`, `km²-en`).
 *  `g` is deliberately ABSENT: the corpus's only `g-vel` is `802.11g-vel`, the WiFi standard, and
 *  reading it as *grammal* would be confidently wrong. */
const SUFFIXABLE_UNIT: Readonly<Record<string, string>> = {
    km: "kilométer",
    mm: "milliméter",
    cm: "centiméter",
    kg: "kilogramm",
    "mérföld": "mérföld",
};
const UNIT_ALT = Object.keys(SUFFIXABLE_UNIT)
    .sort((a, b) => b.length - a.length)
    .join("|");

/** Attach a suffix to the LAST word of a spoken numeral, applying the stem shortening a vowel-initial
 *  suffix triggers (`2022-es` → *kétezerhuszonkettes*, `1907-es` → *…hetes*; see numbers.ts). The split
 *  matters only at the millió/milliárd boundary, the one place `numberToWords` emits a space. */
function attachSuffix(words: string, suffix: string): string {
    const parts = words.split(" ");
    parts[parts.length - 1] = stemForSuffix(parts[parts.length - 1]!, suffix) + suffix;
    return parts.join(" ");
}

/**
 * The bare DATE NOMINATIVE — `augusztus 24.` → *huszonnegyedike*, `március 3.` → *harmadika*. This is the
 * one place the layer must compute vowel harmony itself, because nothing is written after the numeral to
 * copy from. The linking vowel is chosen by the vowel immediately before the ordinal's `-dik`: a BACK
 * vowel there takes `-a` (harmad·ik → harmadika, hatod·ik → hatodika, husza·dik → huszadika), a FRONT
 * one takes `-e` (ötöd·ik → ötödike, hetedik → hetedike, tizenkilencedik → tizenkilencedike). Day 1 is
 * suppletive: *elseje*, not *elsőe*.
 */
const BACK_VOWEL = /[aáoóuú]/u;
function dateStem(n: number): string | undefined {
    if (n === 1) return "elsej"; // elseje, elsején, elseji
    const ord = ordinalWords(n);
    return ord === undefined ? undefined : ord;
}
function dateNominative(n: number): string | undefined {
    const stem = dateStem(n);
    if (stem === undefined) return undefined;
    if (n === 1) return "elseje";
    const link = BACK_VOWEL.test(stem.slice(0, -3).slice(-1)) ? "a" : "e"; // the vowel before -dik
    return stem + link;
}

/** Date suffixes written after the hyphen on a day number (`17-én`, `1-jén`, `11-e`, `4-i`). They attach
 *  to the ORDINAL stem, not the cardinal: `szeptember 17-én` is *szeptember tizenhetedikén*, never
 *  *tizenhétén*. The `j-` forms belong to day 1's suppletive stem *elsej-* and are folded onto it. */
const DATE_SUFFIX = /^(j?[áé]n|je|jei|ei|e|i)$/u;

/**
 * Normalize one Hungarian input string. Pure text→text; the numbered steps are ORDER-DEPENDENT and each
 * coupling is stated where it applies.
 */
export function normalizeHungarian(input: string): string {
    let s = input;

    // 1) DOTTED ABBREVIATIONS, multi-dot before single-dot so an interior dot cannot be claimed by the
    //    shorter pattern first (`et al.` before `al.`). The dot is consumed with the abbreviation, since
    //    leaving it makes a phrase break inside the expansion.
    s = s.replace(/(?<![\d.,\-])(?<!\d[ .,])(\d{1,6})\s?[x×]\s?(?=\d)/gu, (m0, n: string) => {
        const w = multiplicativeWords(Number(n));
        return w === undefined ? m0 : `${w} `;
    });

    s = s.replace(/(?<![\p{L}\p{M}])Kr\.\s?e\./giu, "Krisztus előtt"); // ×3
    s = s.replace(/(?<![\p{L}\p{M}])Kr\.\s?u\./giu, "Krisztus után"); // ×1
    s = s.replace(/(?<![\p{L}\p{M}])i\.\s?sz\./giu, "időszámításunk szerint"); // ×2
    s = s.replace(/(?<![\p{L}\p{M}])i\.\s?e\./giu, "időszámításunk előtt"); // 0 in corpus; the pair of i.sz.
    s = s.replace(/(?<![\p{L}\p{M}])d\.\s?e\./giu, "délelőtt"); // ×1
    s = s.replace(/(?<![\p{L}\p{M}])d\.\s?u\./giu, "délután"); // 0 in corpus; the pair of d.e.
    //    The dot is consumed when the sentence continues, and kept at a phrase end where it really is the
    //    sentence period (`…, stb.`).
    //    A DIGIT counts as a continuation as well as a letter: `kb. 20 km-re` and `kb. 1000 körül` are the
    //    commonest shape of all, and a `(?=\p{L})` lookahead alone left them as the cluster [ɡb] + a pause.
    s = s.replace(
        new RegExp(`(?<![\\p{L}\\p{M}])(${ABBREV_ALT})\\.(\\s+)(?=[\\p{L}\\d])`, "giu"),
        (_m, ab: string, sp: string) => `${DOTTED_ABBREV[ab.toLowerCase()]!}${sp}`,
    );
    s = s.replace(
        new RegExp(`(?<![\\p{L}\\p{M}])(${ABBREV_ALT})\\.(?=\\s*(?:[.,;:!?»)\\]]|$))`, "giu"),
        (_m, ab: string) => `${DOTTED_ABBREV[ab.toLowerCase()]!}.`,
    );

    // 2) DIGIT DE-GROUPING, FIRST among the number rules: a grouping period is otherwise read as clause
    //    punctuation AND the trailing `000` becomes its own numeral *nulla* (`100.000` → *száz . nulla*),
    //    and a grouping space fuses nothing at all (`30 000` → *harminc nulla*). Run before the ordinal
    //    detector in step 9, which would otherwise see `100.` as an ordinal.
    //    Hungarian groups with a SPACE or a PERIOD and takes the COMMA as its decimal mark — the opposite
    //    of the German/Dutch bug, and verified here rather than assumed: the corpus has 14 space-grouped
    //    and 7 dot-grouped thousands against 16 comma decimals.
    //    A COMMA followed by exactly three digits is the English convention leaking through the FLEURS
    //    translations (`100,000 ember`, `11,000 és 22,500 amerikai dollár` — 3 of 3 in the corpus are
    //    thousands, none is a decimal), so it is de-grouped too rather than read as *száz egész nulla*.
    for (let i = 0; i < 3; i++) {
        // repeat: 5.000.000 has two separators
        // THE TRAILING GUARD EXCLUDES A DECIMAL, NOT A CLAUSE MARK. `(?![\d.,])` refused to de-group a number
        // followed by its own sentence comma, so `24.000, és mások` read *huszonnégy . NULLA ,* — the group
        // split off, `000` spoken as zero, AND a spurious full stop. Hungarian marks the decimal with a
        // comma, so the mark is only a separator when a digit follows: `(?![\d]|,\d)`. Same defect the zu
        // and xh runs found in swahili/normalize.ts, which is where this guard shape came from.
        s = s.replace(/(\d)[.\u00a0\u202f\u2009 ](\d{3})(?![\d]|,\d)/gu, "$1$2");  // NBSP, NNBSP, thin space
        s = s.replace(/(\d)\.[ \u00a0\u202f\u2009](\d{3})(?![\d]|,\d)/gu, "$1$2"); // the corpus's one `400. 000`  // space, NBSP, NNBSP, thin space
        s = s.replace(/(\d),(\d{3})(?![\d]|,\d)/gu, "$1$2");
    }

    // 3) CLOCK, before any rule can read the separator: the colon is clause punctuation and became a
    //    COMMA PAUSE inside `10:00`. The corpus writes the space form too (`11: 20-kor`, `8: 46-kor`), so
    //    the separator absorbs it. Zero minutes are dropped — Hungarian says *tizenegy óra*, not
    //    *tizenegy nulla nulla*. Output stays DIGITS so the number path expands them, and so step 10's
    //    suffix rule can still attach (`11:35-re` → `11 35-re` → *harmincötre*).
    //    Two-digit minutes are REQUIRED, which is what keeps the score `3:2-re` out of this rule.
    s = s.replace(/(?<![\d.,:])([01]?\d|2[0-3]):[ \u00a0]?([0-5]\d)(?![\d:])/gu, (_m, h: string, min: string) =>  // space, NBSP
        Number(min) === 0 ? h : `${h} ${min}`,
    );

    // 4) UNIT ABBREVIATION + HYPHEN SUFFIX, BEFORE the shared symbol tier (step 6). The tier would
    //    otherwise claim `20 km-re` and leave `-re` stranded behind the substituted word, where the
    //    tokenizer drops the hyphen and *re* becomes its own stressed word.
    s = s.replace(
        new RegExp(`(?<![\\p{L}\\p{M}])(${UNIT_ALT})([²³23])?-([${LOWER}]+)`, "giu"),
        (whole, u: string, exp: string | undefined, suf: string) => {
            const head = SUFFIXABLE_UNIT[u.toLowerCase()];
            if (head === undefined) return whole;
            const pre = exp === undefined ? "" : exp === "³" || exp === "3" ? "köb" : "négyzet";
            return `${pre}${head}${suf}`;
        },
    );
    //    The single-letter `m` needs a preceding NUMBER to be a unit at all (`2m-es`); bare `m-` is far
    //    likelier to be an initial or a typo than a metre.
    s = s.replace(
        new RegExp(`(\\d)\\s?m([²³23])?-([${LOWER}]+)`, "gu"),
        (_m, d: string, exp: string | undefined, suf: string) => {
            const pre = exp === undefined ? "" : exp === "³" || exp === "3" ? "köb" : "négyzet";
            return `${d} ${pre}méter${suf}`;
        },
    );

    // 5) PERCENT + HYPHEN SUFFIX. Every one of the corpus's 8 percent signs carries a suffix (`29%-a`,
    //    `93%-ával`, `8%-kal`), so this must run before the shared tier in step 6 — the tier emits the
    //    bare noun and would strand the suffix exactly as step 4's units would.
    s = s.replace(new RegExp(`(\\d)\\s?[%٪％]-([${LOWER}]+)`, "gu"), "$1 százalék$2");

    // 6) SHARED SYMBOL TIER — %, units, rates (`km/h`), exponents (`km²`). Runs BEFORE the decimal
    //    rewrite in step 8: the tier matches a unit only when a NUMBER is adjacent, and turning `3,5` into
    //    *három egész öt* destroys that adjacency.
    s = normalizeSymbols(s);

    // 7) DEGREES and SIGNS. `°` was dropped outright and a trailing C was read as Hungarian ⟨c⟩ → [t͡s].
    //    The suffixed form (`35°-tól`, a longitude) is claimed FIRST, for the reason step 4 exists: the
    //    plain rule would emit *fok* and leave `-tól` to become its own stressed word.
    s = s.replace(
        // ⚠ THE LOWERCASE SCALE LETTERS GO IN THE CLASS, NOT IN AN `i` FLAG. `LOWER` is the Hungarian
        //    lowercase alphabet and the suffix is genuinely lowercase-only, so `i` would fix the scale
        //    letter and silently widen the suffix capture. Leaving this arm case-sensitive while the plain
        //    arms below are not is worse still: `20 °c-a` falls through to them and `-a` is stranded as
        //    its own stressed word, which is the whole reason this arm is claimed first.
        new RegExp(`(\\d)\\s?°\\s?([CFcf])?-([${LOWER}]+)`, "gu"),
        (_m, d: string, scale: string | undefined, suf: string) =>
            `${d} ${scale?.toUpperCase() === "C" ? "Celsius-" : scale?.toUpperCase() === "F" ? "Fahrenheit-" : ""}fok${suf}`,
    );
    s = s.replace(/(\d)\s?°\s?C(?![\p{L}\p{M}])/gui, "$1 Celsius-fok");
    s = s.replace(/(\d)\s?°\s?F(?![\p{L}\p{M}])/gui, "$1 Fahrenheit-fok");
    s = s.replace(/(\d)\s?°/gu, "$1 fok");
    // THE MINUS. ⚠ EVERY `-<digit>` in Hungarian text of this kind is a RANGE or a score, not a negative, so
    // a bare leading-dash rule would read date ranges as arithmetic. Restricted to positions a range cannot
    // occupy.
    s = s.replace(/(?<![\p{L}\p{M}\p{Nd}])[-−–](?=\d)/gu, (m0: string, off: number, whole: string) =>
        /\d\s*$/u.test(whole.slice(0, off)) ? m0 : "mínusz ",
    );
    // ⚠ ± TAKES TWO SIGN NAMES, so it is only expressible once BOTH the plus and the minus rules exist —
    //    both halves are taken from the rules in this file. ⚠ It needs its OWN rule: ± is a single character
    //    (U+00B1), not a `+`, so no `+` rule can match inside it and the sign would otherwise be dropped in
    //    silence.
    //    ⚠ AND hu.wikipedia NAMES BOTH SIGNS TOGETHER, which is as direct as this gets: "A két előjel a
    //    pluszjel (+) és a mínuszjel (−), melyek a matematikában a pozitív és a negatív fogalmát" — the two
    //    SIGNS are the plus sign and the minus sign, expressing positive and negative. Exactly the sense ±
    //    needs, and the reason this pair is a tolerance marker rather than two operations.
    s = s.replace(/±/gu, " plusz mínusz ");
    s = s.replace(/(\S)\+\s?(\d)/gu, "$1 plusz $2"); // UTC+1
    s = s.replace(/(^|\s)\+\s?(\d)/gu, "$1plusz $2"); // "a + 30°C"

    // THE RELATIONAL SIGNS. All three read INFIX and all three are attested, `egyenlő` ×12 token / 8
    // articles in the arithmetic register with the sense in view ("nagyobb vagy egyenlő", "két egyenlő részre
    // osztja") and `nagyobb mint` in both corpus (×3 phrase) and wiki. `kisebb mint` has ×0 phrase hits in
    // either, while `kisebb` ×24 and `mint` ×259 are both common in hu_hu — the construction is ADJ + mint and
    // its sibling proves it, exactly as `größer als` needed for German.
    s = s.replace(/\s?=\s?/gu, " egyenlő ");
    s = s.replace(/\s?<\s?/gu, " kisebb mint ");
    s = s.replace(/\s?>\s?/gu, " nagyobb mint ");
    // THE DIVISION SIGN. `osztva` governs the INSTRUMENTAL on its operand, so the divisor must carry
    // `-val`/`-vel` with assimilation — the suffix doubles the final consonant (`ottel`, `hattal`). Spelled
    // from the number words rather than substituted, because the allomorph depends on the operand vowels.
    const HU_BACK = /[aáoóuú]/u;
    /** The last vowel decides harmony; `harminc` is the one numeral where the vowel and the harmony disagree. */
    const huLinkVowel = (stem: string): string => {
        if (stem.endsWith("harminc")) return "a";
        const vs = [...stem].filter((c) => /[aáeéiíoóöőuúüű]/u.test(c));
        const last = vs[vs.length - 1];
        return last !== undefined && HU_BACK.test(last) ? "a" : "e";
    };
    const HU_DIGRAPH = ["gy", "sz", "cs", "ny", "ly", "ty", "zs", "dz"];
    /** Instrumental -val/-vel: harmony, then v→consonant assimilation with digraph-aware doubling. */
    const huInstrumental = (w: string): string => {
        const cut = w.lastIndexOf(" ") + 1,
            head = w.slice(0, cut),
            stem = w.slice(cut);
        const v = huLinkVowel(stem);
        if (/[aáeéiíoóöőuúüű]$/u.test(stem)) return `${head}${stem}v${v}l`;
        // ⚠ THE DOUBLED LETTER GOES BEFORE THE DIGRAPH, NOT AFTER THE WORD. Hungarian writes the geminate by
        // repeating the digraph's FIRST letter in front of it: egy → e+g+gy = eggyel, négy → néggyel,
        // húsz → hússzal. Appending it instead produced *egygel* and *húszsal*, which the g2p duly read as
        // [ɛɟɡɛl] and [huːsʃɒl] — two wrong consonants, caught by probing the whole numeral vocabulary rather
        // than the one example the rule was written against.
        const dg = HU_DIGRAPH.find((d) => stem.endsWith(d));
        const doubled = dg !== undefined ? `${stem.slice(0, -dg.length)}${dg[0]!}${dg}` : stem + stem.slice(-1);
        return `${head}${doubled}${v}l`;
    };
    s = s.replace(
        /(\d+)\s?÷\s?(\d+)/gu,
        (_m, a: string, b: string) => `${numberToWords(Number(a))} ${huInstrumental(numberToWords(Number(b)))} osztva`,
    );

    // 8) DECIMALS. The comma was reaching `clausePunctuation` as a COMMA PAUSE mid-number. Hungarian says
    //    *egész* between the parts (*három egész öt*). The digits are LEFT AS DIGITS so the existing
    //    number path pronounces them — this layer has no reason to duplicate the compositor here.
    //    After step 2, any comma still sitting between digits is a decimal mark.
    s = s.replace(/(\d),(?=\d)/gu, "$1 egész ");

    // 9) ORDINALS. All three sub-rules license on "whitespace + a LOWERCASE letter" (or a comma); see the
    //    file header for the 80-instance tabulation and the zero-sentence-final-pauses-lost check.
    // 9a) YEAR + MONTH: the year is a plain CARDINAL and the period is silent — `1759. szeptember` is
    //     *ezerhétszázötvenkilenc szeptember*, NOT *ezerhétszázötvenkilencedik*. This must precede 9c,
    //     which would otherwise claim the same period as an ordinal marker. ×19.
    s = s.replace(new RegExp(`(?<![\\d.,])(\\d{1,4})\\.(\\s+)(?=${MONTH})`, "giu"), "$1$2");
    // 9b) MONTH + DAY: the bare date nominative — `augusztus 24. és` is *augusztus huszonnegyedike és*.
    //     ×2. Licensed by a following lowercase word so a date ending a sentence keeps its period.
    s = s.replace(
        new RegExp(`(${MONTH}\\p{L}*\\s+)(\\d{1,2})\\.(?=\\s+[${LOWER}])`, "giu"),
        (whole, pre: string, d: string) => {
            const w = dateNominative(Number(d));
            return w === undefined ? whole : `${pre}${w}`;
        },
    );
    // 9c) THE GENERAL ORDINAL. The left lookbehind refuses a numeral that is itself preceded by a digit or
    //     a dot (`1.1. ábra`, `802.11a`); the lookahead refuses a digit, an uppercase continuation and the
    //     end of input. The period is CONSUMED — removing the spurious phrase break is half the fix.
    s = s.replace(
        new RegExp(`(?<![\\d.,])(\\d{1,4})\\.(?=\\s+[${LOWER}]|,)`, "gu"),
        (whole, d: string) => ordinalWords(Number(d)) ?? whole,
    );
    // 9d) The period after a Roman-numeral ORDINAL WORD. `XIX. század` has already become
    //     `tizenkilencedik. század` by the time this runs (the shared roman pass in registry.ts rewrites
    //     before `text()`), and that period was surviving as a phrase break — the artefact
    //     romanOrdinals.ts records as needing "a Hungarian-side pre-pass that swallows the ordinal
    //     period". This is that pre-pass. Every Hungarian ordinal ends in `-dik` except *első*, and the
    //     same lowercase-continuation licence applies, so a sentence-final ordinal keeps its period.
    s = s.replace(new RegExp(`(?<=dik|első)\\.(?=\\s+[${LOWER}])`, "gu"), "");
    //     NOT extended to a CAPITALISED follower, though the regnal shape wants it: `II. Erzsébet`
    //     becomes *második. Erzsébet* and that period survives as a phrase break. Tried, and reverted.
    //     The guard would have to distinguish a regnal ordinal from a sentence that merely ENDS in an
    //     ordinal, and "something precedes it on the same line" does not: `Ez a második. Erzsébet jött`
    //     has exactly that shape and lost its sentence boundary.
    //
    //     THE CORPUS CANNOT SETTLE THIS, which is the point. Its census reported 0 terminal marks lost,
    //     but only 12% of hu_hu utterances contain a sentence boundary at all — FLEURS is largely one
    //     sentence per utterance — so the shape needs a boundary the corpus mostly does not have. And it
    //     is not contrived: Hungarian uses ordinals PREDICATIVELY (*a csapat lett a harmadik* — "the team
    //     came third"), so an ordinal-final sentence is ordinary prose. A spurious pause is not worth
    //     gambling a sentence boundary on evidence this corpus is structurally unable to provide.

    // 10) NUMERAL + HYPHEN SUFFIX → WORDS. LAST of the number rules, because it is the only one that
    //     leaves digits behind: steps 3–9 all need digits still present to match on. `1848-ban` was
    //     splitting into two stressed words; concatenation onto the spoken numeral gives one.
    //     The leading lookbehind refuses a digit glued to LETTERS (`802.11g-vel`, `4x4-el`, `km2-re`),
    //     which are codes and units, not numerals.
    // 10a) DATES take the ORDINAL stem: `szeptember 17-én` is *tizenhetedikén*, not *tizenhétén*. Gated on
    //      a preceding month name — all 32 date-suffixed numerals in the corpus have one, and the gate is
    //      what keeps an ordinary superessive on a cardinal out of the ordinal path.
    s = s.replace(
        new RegExp(`(?<=${MONTH}\\p{L}*\\s)(\\d{1,2})-([${LOWER}]+)(?![\\p{L}\\p{M}])`, "giu"),
        (whole, d: string, suf: string) => {
            if (!DATE_SUFFIX.test(suf)) return whole;
            const stem = dateStem(Number(d));
            if (stem === undefined) return whole;
            // day 1's stem is *elsej-*, so the written `j` of `1-jén` is already in the stem.
            return stem + (Number(d) === 1 ? suf.replace(/^j/u, "") : suf);
        },
    );
    // 10b) Everything else concatenates onto the cardinal, which is correct because the orthography
    //      already wrote the harmonically-chosen form (`1848-ban`, `1970-es`, `36-an`, `1945-ig`).
    s = s.replace(
        new RegExp(`(?<![\\p{L}\\p{M}\\d])(\\d+)-([${LOWER}]+)(?![\\p{L}\\p{M}])`, "gu"),
        (whole, d: string, suf: string) => {
            const n = Number(d);
            if (!Number.isSafeInteger(n)) return whole;
            const words = numberToWords(n);
            return /\d/u.test(words) ? whole : attachSuffix(words, suf);
        },
    );

    // 11) ACRONYMS, LAST of the letter rules: after step 1 (else `Kr`/`ld` are spelled) and after the
    //     roman pass, which has already run in registry.ts — so `II. Erzsébet` is a numeral by now and
    //     can never be spelled EM-EM. Roman numerals need no sequencing here for that reason.
    // 11a) ACRONYM + HYPHEN SUFFIX (`GPS-hez`, `FBI-nak`, `GDP-je`) — the suffix belongs to the LAST
    //      letter name (*gé pé eshez*), so it is glued here rather than left for the tokenizer to drop
    //      the hyphen and emit it as its own stressed word. The word-vs-letters decision mirrors the
    //      shared pass's: spell only what could not be read as a word at all.
    s = s.replace(
        new RegExp(`(?<![\\p{L}\\p{M}])(\\p{Lu}{2,})-([${LOWER}]+)`, "gu"),
        (whole, acr: string, suf: string) => {
            const lexical = ACRONYM_WORD[acr];
            if (lexical !== undefined) return lexical + suf;
            if (!isUnreadableHungarian(acr)) return acr.toLowerCase() + suf;
            const spelled = spellOut(acr);
            return spelled === undefined ? whole : spelled + suf;
        },
    );
    // 11b) The lexical overrides, before the shared pass can spell them out letter by letter.
    for (const [acr, word] of Object.entries(ACRONYM_WORD))
        s = s.replace(new RegExp(`(?<![\\p{L}\\p{M}])${acr}(?![\\p{L}\\p{M}])`, "gu"), word);
    s = normalizeInitialisms(s);

    return s;
}
