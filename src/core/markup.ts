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
};

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
    if (!text.includes("<") && !text.includes("&") && !text.includes("|") && !text.includes("!")) return text;
    // Wikitable first: a cell's contents may themselves be HTML, and the cell prefix is what hides them.
    return text.replace(WIKITABLE, " ").replace(TAG, "").replace(ENTITY, (whole, body: string) => {
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
