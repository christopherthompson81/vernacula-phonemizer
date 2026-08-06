/**
 * Shared MARKUP stripping — render HTML to the text it stands for, before any engine sees it.
 *
 * A phonemizer handed `<i>` should render it, not read it, so this is the engine's problem to absorb rather
 * than the caller's to pre-clean: left alone, tags reach the phoneme stream and are SPOKEN (`km<sup>2</sup>`
 * came out as "sup … sup"). Applied at the single dispatch point in the registry, like the Roman-numeral pass,
 * so it reaches every engine instead of being reimplemented per language.
 *
 * ⚠ ORDER: tags are stripped BEFORE entities are decoded. The other way round, `&lt;i&gt;` — an author writing
 * ABOUT a tag, which must stay literal — would decode to `<i>` and then be stripped as markup.
 */

/** The named entities that actually occur, plus the handful any text realistically carries. */
const NAMED: Readonly<Record<string, string>> = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    apos: "'",
    nbsp: " ",
    laquo: "«",
    raquo: "»",
    ldquo: "“",
    rdquo: "”",
    lsquo: "‘",
    rsquo: "’",
    hellip: "…",
    ndash: "–",
    mdash: "—",
    deg: "°",
    times: "×",
    middot: "·",
    euro: "€",
    pound: "£",
    yen: "¥",
    // An unknown entity is deliberately left literal (see the decoder), which is right for a name nothing can
    // render. These are listed because each maps to a character the engine ALREADY reads, and the NUMERIC forms
    // (`&#178;` → `²`) already worked — so leaving the named ones literal sent "km ampersand sup two semicolon"
    // to the phoneme stream. Each pairs with the machinery that reads it: sup1-3 → exponent rules, frac →
    // vulgar-fraction fold, minus/plusmn → sign rules, cent/micro/permil → symbol tier.
    sup1: "¹",
    sup2: "²",
    sup3: "³",
    frac12: "½",
    frac14: "¼",
    frac34: "¾",
    minus: "−",
    plusmn: "±",
    micro: "µ",
    permil: "‰",
    cent: "¢",
};

/**
 * LaTeX CONTROL SEQUENCES, as MediaWiki's `<math>` leaves them: `{\displaystyle W={\frac {Rv+Cm}{v+m}}}` was
 * recited as English (*dˈʌbəɫjuː dɪsplˈeᶦstaᶦɫ …*). Audible garbage rather than a dropped sign, and worse for it.
 *
 * A backslash followed by letters is never natural prose in these orthographies, so the pattern cannot reach
 * real text.
 *
 * ⚠ BRACES ARE STRIPPED ONLY WHEN A COMMAND WAS PRESENT. `{\frac {Rv+Cm}{v+m}}` is a math group whose braces
 * must go, but stripping `[{}]` unconditionally reaches ordinary prose (`a {curly} aside` → `a  curly  aside`).
 * The LaTeX command is what licenses treating braces as math.
 */
const LATEX_CMD = /\\[a-zA-Z]+\s?/gu;
/** Non-global twin for the presence test — `.test()` on a `/g` regex advances `lastIndex` and would make
 *  alternate calls disagree with themselves. */
const HAS_LATEX = /\\[a-zA-Z]+/u;
const MATH_BRACE = /[{}]/gu;

/**
 * `<sup>` is rendered to real superscript characters BEFORE the general tag pass removes its brackets.
 *
 * ⚠ THE ORDER IS THE WHOLE POINT. Stripping `<sup>10</sup>` first leaves the digits INLINE, so
 * `2.802×10<sup>10</sup>` becomes `2.802×1010` — the exponent merges into the mantissa and no later pass can
 * recover the boundary. This is survivable for units (`km<sup>2</sup>` → `km2`, which the symbol tier accepts
 * as an ASCII exponent after a letter), which is exactly why it hides until the base is a NUMBER.
 *
 * DIGITS AND SIGNS ONLY. `4<sup>th</sup>` keeps its letters as plain text (`4th`), which the ordinal rule
 * already reads; there is no superscript `th` worth inventing.
 *
 * ⚠ `<sub>` IS DELIBERATELY NOT MAPPED. Superscripts are READ — the exponent machinery speaks them — but
 * NOTHING reads a subscript digit, so rendering `<sub>2</sub>` to `₂` takes a form that was readable and makes
 * it silent:
 *     `CO2 levels`  → *kʰˈoᶷ tʰˈuː lˈɛvəɫz*   ← flattened ASCII; the 2 is spoken
 *     `CO₂ levels`  → *kʰˈoᶷ lˈɛvəɫz*         ← "correctly" rendered; the 2 is GONE
 * A transform is only a repair if something downstream can read what it produces. If a subscript reading is
 * ever wanted, the digit words come first and the mapping second.
 */
const SUP_MAP: Readonly<Record<string, string>> = {
    "0": "\u2070",
    "1": "\u00b9",
    "2": "\u00b2",
    "3": "\u00b3",
    "4": "\u2074",
    "5": "\u2075",
    "6": "\u2076",
    "7": "\u2077",
    "8": "\u2078",
    "9": "\u2079",
    "-": "\u207b",
    "+": "\u207a",
};
const SUP_TAG = /<sup>([+-]?\d+)<\/sup>/giu;

/**
 * An HTML TAG. The name must start with a letter or `/`, which is what keeps ordinary prose safe: a
 * comparison like `5 < 6` or `a < b` has a space or digit after the `<` and is never matched.
 */
const TAG = /<\/?[a-zA-Z][^<>]*>/gu;

/**
 * WIKITABLE SYNTAX — not HTML, but it arrives by the same route (scraped text) and was likewise SPOKEN:
 * `|bgcolor="#F3F5DE"|` read as "bgcolor equals F 3 F 5 D E", a style attribute one hex digit at a time.
 *
 * ⚠ NARROW BY DESIGN, because `|` and `!` are ordinary characters in a way `<tag>` is not. Only these shapes
 * match, each unambiguous: a line-leading `{|` and the rest of its line (the table open), `|}` (close), a
 * line-leading `|` with optional `attr="value"` pairs (cell prefix), and `||` (inline separator). A bare `|`
 * mid-sentence is left alone — more likely prose or a phonetic bar than a table.
 *
 * ⚠ THE `{|` ARM IS ANCHORED TO LINE START because it consumes TO END OF LINE. Unanchored, a stray `{|` in
 * prose (set-builder notation, a code snippet) would delete the rest of the sentence.
 *
 * ⚠ NO `!` HEADER ARMS, though wikitables do use them. `!!` and a line-leading `!` occur nowhere in the corpora,
 * while `!` is ordinary sentence punctuation everywhere — the arms would have cost `Wow!! Amazing` its clause
 * break for no measured gain. `|` is the one character here that is not also prose punctuation.
 */
const WIKITABLE = /^[ \t]*\{\|[^\n]*|\|\}|^[ \t]*\|(?:[a-zA-Z-]+=(?:"[^"\n]*"|'[^'\n]*'|[^|\s]+)[ \t]*)*\|?|\|\|/gmu;
const ENTITY = /&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z][a-zA-Z0-9]*);/gu;

/** Strip HTML tags and decode character entities. Pure text→text; a string containing neither is
 *  returned unchanged, and the fast path makes that the common case. */
export function stripMarkup(text: string): string {
    if (
        !text.includes("<") &&
        !text.includes("&") &&
        !text.includes("|") &&
        !text.includes("!") &&
        !text.includes("\\") &&
        !text.includes("{") &&
        !text.includes("}")
    )
        return text;
    // Wikitable first: a cell's contents may themselves be HTML, and the cell prefix is what hides them.
    // Then sup/sub, which must precede the general TAG pass — that pass deletes their brackets and leaves the
    // digits inline, which is exactly the flattening described above.
    // Braces only when a LaTeX command licensed it — see LATEX_CMD.
    const deLatex = HAS_LATEX.test(text) ? text.replace(LATEX_CMD, " ").replace(MATH_BRACE, " ") : text;
    return deLatex
        .replace(WIKITABLE, " ")
        .replace(SUP_TAG, (_m, d: string) => [...d].map((c) => SUP_MAP[c] ?? c).join(""))
        .replace(TAG, "")
        .replace(ENTITY, (whole, body: string) => {
            if (body.startsWith("#")) {
                const cp =
                    body[1] === "x" || body[1] === "X"
                        ? Number.parseInt(body.slice(2), 16)
                        : Number.parseInt(body.slice(1), 10);
                // An out-of-range or unparseable reference is left as written rather than replaced with a
                // replacement character, so nothing is silently invented.
                return Number.isFinite(cp) && cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : whole;
            }
            return NAMED[body.toLowerCase()] ?? whole; // an unknown entity stays literal
        });
}
