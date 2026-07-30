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
const ENTITY = /&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z][a-zA-Z0-9]*);/gu;

/** Strip HTML tags and decode character entities. Pure text→text; a string containing neither is
 *  returned unchanged, and the fast path makes that the common case. */
export function stripMarkup(text: string): string {
    if (!text.includes("<") && !text.includes("&")) return text;
    return text.replace(TAG, "").replace(ENTITY, (whole, body: string) => {
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
