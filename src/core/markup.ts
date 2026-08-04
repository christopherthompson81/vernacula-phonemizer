/**
 * Shared MARKUP stripping (#562) — render HTML to the text it stands for, before any engine sees it.
 *
 * WHY THIS EXISTS. The Vietnamese fan-out run found `km<sup>2</sup>` being SPOKEN: the tags reached the
 * phoneme stream and came out as "sup … sup", twice per occurrence. Auditing all 66 FLEURS corpora, 11
 * carry markup or entities — small counts in most, but `lb_lu` has `&apos;` ×192, which matters because
 * Luxembourgish writes `d'Land`, `t'ass` with apostrophes throughout, and `ms_my` carries `<i>` tags.
 *
 * The corpora arguably should not contain markup at all. But a phonemizer handed `<i>` should render it,
 * not read it, so this is the engine's problem to absorb rather than the caller's to pre-clean. Applied at
 * the single dispatch point in the registry, like the Roman-numeral pass, so it reaches all 191 engines
 * instead of being re-implemented per language.
 *
 * ORDER MATTERS AND IS DELIBERATE: tags are stripped BEFORE entities are decoded. The other way round,
 * `&lt;i&gt;` — which is an author writing about a tag, and must stay literal text — would decode to `<i>`
 * and then be stripped as though it were markup.
 */

/** The named entities that actually occur, plus the handful any text realistically carries. */
const NAMED: Readonly<Record<string, string>> = {
    amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
    laquo: "«", raquo: "»", ldquo: "“", rdquo: "”", lsquo: "‘", rsquo: "’",
    hellip: "…", ndash: "–", mdash: "—", deg: "°", times: "×", middot: "·", euro: "€", pound: "£", yen: "¥",
    // ⚠ ADDED because they were staying LITERAL. An unknown entity is deliberately left as written (see below),
    // which is right for a name nothing can render — but every one of these maps to a character the engine
    // ALREADY reads, so leaving them literal meant `km&sup2;` reached the phoneme stream as the text
    // "km ampersand sup two semicolon". A programmer hands a phonemizer whichever encoding is at hand, and the
    // NUMERIC forms already worked (`&#178;` → `²`), so the named ones failing was pure inconsistency.
    // Each is paired with the machinery that reads it: sup1-3 → the exponent rules, frac → the vulgar-fraction
    // fold, minus/plusmn → the sign rules, cent/micro/permil → the symbol tier.
    sup1: "¹", sup2: "²", sup3: "³",
    frac12: "½", frac14: "¼", frac34: "¾",
    minus: "−", plusmn: "±", micro: "µ", permil: "‰", cent: "¢",
};

/**
 * LaTeX CONTROL SEQUENCES, as MediaWiki's `<math>` leaves them. cmn's artifact carries
 * `{\displaystyle W={\frac {Rv+Cm}{v+m}}}`, and the commands were SPOKEN — *dˈʌbəɫjuː dɪsplˈeᶦstaᶦɫ …*,
 * "W displaystyle W", the markup recited as English. Same class as the wikitable prefix: not a dropped sign
 * but AUDIBLE GARBAGE, and strictly worse, because silence can at least pass for a reading choice.
 *
 * ⚠ ZERO RISK, measured: a BACKSLASH occurs **zero times in all 67 FLEURS corpora** and in exactly one mined
 * artifact entry (the cmn formula above). A backslash followed by letters is never natural prose in any of
 * these orthographies, so the pattern cannot reach real text.
 * ⚠ THE BRACES ARE ONLY STRIPPED WHEN A COMMAND WAS PRESENT, which the first version got wrong. `{\frac
 * {Rv+Cm}{v+m}}` is a math group and its braces must go, but stripping `[{}]` unconditionally reached ordinary
 * prose — `a {curly} aside` became `a  curly  aside`. Braces are rare rather than impossible in running text,
 * so the LaTeX command is what licenses treating them as math. No command, no brace strip.
 */
const LATEX_CMD = /\\[a-zA-Z]+\s?/gu;
/** Non-global twin for the presence test — `.test()` on a `/g` regex advances `lastIndex` and would make
 *  alternate calls disagree with themselves. */
const HAS_LATEX = /\\[a-zA-Z]+/u;
const MATH_BRACE = /[{}]/gu;

/**
 * `<sup>` AND `<sub>` CARRY MEANING THAT THE TAG STRIP DESTROYS, so they are rendered to real superscript
 * characters BEFORE the general tag pass removes their brackets.
 *
 * ⚠ WE WERE THE CAUSE OF A DATA LOSS I HAD RECORDED AS THE SOURCE'S FAULT. Stripping `<sup>10</sup>` leaves the
 * digits INLINE, so `2.802×10<sup>10</sup>` becomes `2.802×1010` — the exponent merges into the mantissa and no
 * later pass can tell where the boundary was. I had written that off as corpus damage; it is ours.
 *
 * THE ARITHMETIC PROVES IT, which is what settles the question rather than a guess about the wiki source:
 *   `2,603 वर्ग किलोमीटर (2.802×1010 वर्ग फुट)`  →  2,603 km² IS 2.802×10¹⁰ sq ft
 *   `100 kमी2 (1.1×109 वर्ग फुट)`               →  100 km²   IS 1.1×10⁹ sq ft
 * The values only reconcile with the exponent restored, so `1010` and `109` were `10¹⁰` and `10⁹`.
 *
 * ⚠ AND IT WAS SURVIVABLE FOR UNITS, WHICH IS WHY IT HID. `km<sup>2</sup>` flattens to `km2`, and the symbol
 * tier deliberately accepts an ASCII exponent after a letter — the branch that made the original `<sup>` fix
 * work. So the damage showed up in twelve corpora as a harmless-looking `km2` and only became visible where the
 * base was a NUMBER and the two digit runs collided. A lossy transform that happens to be readable in the
 * common case is the hardest kind to notice.
 *
 * DIGITS AND SIGNS ONLY. `4<sup>th</sup>` keeps its letters as plain text (`4th`), which the ordinal rule
 * already reads — there is no superscript `th` worth inventing, and mapping letters would break that path.
 *
 * ⚠ `<sub>` IS DELIBERATELY *NOT* MAPPED, and writing the mapping first is what showed why. Superscripts are
 * READ — the exponent machinery speaks them — so rendering `<sup>2</sup>` to `²` hands the information to
 * something that can use it. NOTHING reads a subscript digit, so rendering `<sub>2</sub>` to `₂` takes a form
 * that WAS readable and makes it silent:
 *     `CO2 levels`  → *kʰˈoᶷ tʰˈuː lˈɛvəɫz*      ← the flattened ASCII form, and the 2 is spoken
 *     `CO₂ levels`  → *kʰˈoᶷ lˈɛvəɫz*            ← "correctly" rendered, and the 2 is GONE
 * That is the same error as the bug this whole comment is about, pointed the other way: a transform is only a
 * repair if something downstream can read what it produces. `<sub>` occurs ZERO times in all 67 corpora and all
 * 67 artifacts, so the mapping had no measured benefit to weigh against a measured regression. If a subscript
 * reading is ever wanted, the digit words come first and the mapping second.
 */
const SUP_MAP: Readonly<Record<string, string>> = {
    "0": "\u2070", "1": "\u00b9", "2": "\u00b2", "3": "\u00b3", "4": "\u2074",
    "5": "\u2075", "6": "\u2076", "7": "\u2077", "8": "\u2078", "9": "\u2079",
    "-": "\u207b", "+": "\u207a",
};
const SUP_TAG = /<sup>([+-]?\d+)<\/sup>/giu;

/**
 * An HTML TAG. The name must start with a letter or `/`, which is what keeps ordinary prose safe: a
 * comparison like `5 < 6` or `a < b` has a space or digit after the `<` and is never matched.
 */
const TAG = /<\/?[a-zA-Z][^<>]*>/gu;

/**
 * WIKITABLE SYNTAX. Not HTML, and it reached the phoneme stream and was SPOKEN — `my`'s artifact carries
 * `|bgcolor="#F3F5DE"| ゝ (reduplicates and unvoices syllable)`, which read as
 * *bɡkˈʌlɚ ɲi˨m̥ja˥ˀ ˈɛf θoʊɴ ˈɛf ŋa dˈiː* — "bgcolor equals F 3 F 5 D E", a style attribute read aloud
 * one hex digit at a time. That is the inverse of the dropped-sign problem: not silence, but AUDIBLE GARBAGE,
 * and it is strictly worse because it cannot be mistaken for anything a reader would say.
 *
 * Stripped here for the reason this file's header already gives for HTML: "a phonemizer handed `<i>` should
 * render it, not read it, so this is the engine's problem to absorb rather than the caller's to pre-clean."
 * Wikitable markup arrives by exactly the same route — scraped text — and deserves the same absorption.
 *
 * ⚠ NARROW BY DESIGN, because `|` and `!` are ordinary characters in a way `<tag>` is not. Only three shapes
 * are matched, each unambiguous:
 *   · a LINE-LEADING `{|` and the rest of its line   the table OPEN, whose remainder is always attributes
 *     ⚠ anchored to line start, because the arm consumes TO END OF LINE — unanchored, a stray `{|` in prose
 *     (set-builder notation, a code snippet) would delete the remainder of the sentence. A wikitable open is
 *     always the first thing on its line, so the anchor costs nothing and bounds the damage to nothing.
 *   · `|}`                            the table close
 *   · a LINE-LEADING `|`, optionally followed by `attr="value"` pairs and a closing `|`   the cell prefix
 *   · `||`                            the inline cell separator
 * A bare `|` mid-sentence is left alone — it is more likely to be prose or a phonetic bar than a table.
 *
 * ⚠ THE `!` HEADER ARMS WERE WRITTEN AND THEN REMOVED, which is worth recording because they look free.
 * Wikitables mark header cells with a leading `!` and separate them with `!!`, so both belong to the syntax —
 * but measured across all 67 corpora AND all 67 artifacts, `!!` and a line-leading `!` occur **zero times**,
 * while `!` is ordinary sentence punctuation everywhere. So those arms had no measured value and a real cost:
 * `Wow!! Amazing` would have lost its clause break. Only the `|` shapes ship, and `|` is the one character
 * here that is not also prose punctuation.
 * Measured across all 67 mined artifacts: wikitable markup appears in **2 entries, both in my**, so this is
 * robustness for scraped input rather than a broad repair. Both of those two are also the ONLY evidence for
 * my's `iteration` cell, and they describe JAPANESE kana marks in a Burmese article — the mark is not
 * Burmese orthography at all.
 */
const WIKITABLE =
    /^[ \t]*\{\|[^\n]*|\|\}|^[ \t]*\|(?:[a-zA-Z-]+=(?:"[^"\n]*"|'[^'\n]*'|[^|\s]+)[ \t]*)*\|?|\|\|/gmu;
const ENTITY = /&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z][a-zA-Z0-9]*);/gu;

/** Strip HTML tags and decode character entities. Pure text→text; a string containing neither is
 *  returned unchanged, and the fast path makes that the common case. */
export function stripMarkup(text: string): string {
    if (!text.includes("<") && !text.includes("&") && !text.includes("|") && !text.includes("!")
        && !text.includes("\\") && !text.includes("{") && !text.includes("}")) return text;
    // Wikitable first: a cell's contents may themselves be HTML, and the cell prefix is what hides them.
    // Then sup/sub, which must precede the general TAG pass — that pass deletes their brackets and leaves the
    // digits inline, which is exactly the flattening described above.
    // Braces only when a LaTeX command licensed it — see LATEX_CMD.
    const deLatex = HAS_LATEX.test(text) ? text.replace(LATEX_CMD, " ").replace(MATH_BRACE, " ") : text;
    return deLatex.replace(WIKITABLE, " ")
        .replace(SUP_TAG, (_m, d: string) => [...d].map((c) => SUP_MAP[c] ?? c).join(""))
        .replace(TAG, "").replace(ENTITY, (whole, body: string) => {
        if (body.startsWith("#")) {
            const cp = body[1] === "x" || body[1] === "X"
                ? Number.parseInt(body.slice(2), 16)
                : Number.parseInt(body.slice(1), 10);
            // An out-of-range or unparseable reference is left as written rather than replaced with a
            // replacement character, so nothing is silently invented.
            return Number.isFinite(cp) && cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : whole;
        }
        return NAMED[body.toLowerCase()] ?? whole; // an unknown entity stays literal
    });
}
