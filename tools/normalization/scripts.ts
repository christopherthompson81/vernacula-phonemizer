/**
 * The scripts the fleet writes in, and the "is this segment even in the language?" test built on them.
 *
 * ⚠ WHY THIS IS A SHARED MODULE RATHER THAN A TABLE IN EACH TOOL. It began as a private table inside
 * `wiki-health.ts`, and `mine.ts` needed the same knowledge to decide whether a mined segment is native text.
 * Duplicating it would have repeated the `sources.ts` failure exactly: a sister table that falls behind its
 * twin and then reports, by silence, that a class does not apply. The table below is the ONLY copy.
 *
 * A TABLE IS UNAVOIDABLE — there is no regex that asks a character "which script are you"; `\p{Script=…}` can
 * only be tested one script at a time. Keeping the list explicit and finite is the honest version: an unlisted
 * script lands in `Other`, which is visible in the output rather than being silently folded into a neighbour.
 */
export const SCRIPTS: readonly [string, RegExp][] = [
    ["Latin", /\p{Script=Latin}/u], ["Cyrillic", /\p{Script=Cyrillic}/u], ["Arabic", /\p{Script=Arabic}/u],
    ["Devanagari", /\p{Script=Devanagari}/u], ["Han", /\p{Script=Han}/u], ["Hiragana", /\p{Script=Hiragana}/u],
    ["Katakana", /\p{Script=Katakana}/u], ["Hangul", /\p{Script=Hangul}/u], ["Greek", /\p{Script=Greek}/u],
    ["Hebrew", /\p{Script=Hebrew}/u], ["Bengali", /\p{Script=Bengali}/u], ["Tamil", /\p{Script=Tamil}/u],
    ["Telugu", /\p{Script=Telugu}/u], ["Kannada", /\p{Script=Kannada}/u], ["Malayalam", /\p{Script=Malayalam}/u],
    ["Gujarati", /\p{Script=Gujarati}/u], ["Gurmukhi", /\p{Script=Gurmukhi}/u], ["Oriya", /\p{Script=Oriya}/u],
    ["Sinhala", /\p{Script=Sinhala}/u], ["Thai", /\p{Script=Thai}/u], ["Lao", /\p{Script=Lao}/u],
    ["Myanmar", /\p{Script=Myanmar}/u], ["Khmer", /\p{Script=Khmer}/u], ["Ethiopic", /\p{Script=Ethiopic}/u],
    ["Georgian", /\p{Script=Georgian}/u], ["Armenian", /\p{Script=Armenian}/u], ["Tibetan", /\p{Script=Tibetan}/u],
    ["Thaana", /\p{Script=Thaana}/u], ["Cherokee", /\p{Script=Cherokee}/u], ["Ol_Chiki", /\p{Script=Ol_Chiki}/u],
    ["Tifinagh", /\p{Script=Tifinagh}/u], ["Syriac", /\p{Script=Syriac}/u], ["Nko", /\p{Script=Nko}/u],
    ["Vai", /\p{Script=Vai}/u], ["Adlam", /\p{Script=Adlam}/u], ["Mongolian", /\p{Script=Mongolian}/u],
    // ADDED after a fleet run reported `100% of lines are not in Other script` — the languages whose script
    // this table did not name. Each is a registry language with a mined corpus.
    ["Syloti_Nagri", /\p{Script=Syloti_Nagri}/u], ["Tai_Le", /\p{Script=Tai_Le}/u],
    ["New_Tai_Lue", /\p{Script=New_Tai_Lue}/u], ["Tai_Tham", /\p{Script=Tai_Tham}/u],
    ["Coptic", /\p{Script=Coptic}/u], ["Yi", /\p{Script=Yi}/u],
    ["Canadian_Aboriginal", /\p{Script=Canadian_Aboriginal}/u],
];

/** How many characters of each named script a text contains. Unlisted scripts are simply absent from the map. */
export function scriptCounts(text: string): Map<string, number> {
    const out = new Map<string, number>();
    for (const ch of text) {
        for (const [name, re] of SCRIPTS)
            if (re.test(ch)) { out.set(name, (out.get(name) ?? 0) + 1); break; }
    }
    return out;
}

/**
 * The script a corpus is WRITTEN IN, inferred from the corpus itself rather than from a language code.
 *
 * ⚠ INFERRED, AND DELIBERATELY SO. The alternative is a language→script map, which is one more hand-maintained
 * table that can fall behind the registry — and `sources.ts` already demonstrated what a stale table costs: its
 * silence about the sign classes read as "these do not apply" and a whole layer was written on that assumption.
 * A corpus knows its own script, so nothing has to be remembered.
 *
 * Returns `undefined` when there is too little evidence to be sure, so callers fail open rather than filtering
 * a corpus on a guess.
 */
export function dominantScript(text: string): string | undefined {
    const counts = [...scriptCounts(text)].sort((a, b) => b[1] - a[1]);
    const top = counts[0];
    if (top === undefined || top[1] < 200) return undefined;
    // A clear plurality only. A corpus that is a genuine two-script mix has no single native script, and
    // filtering it against either half would discard real text.
    const second = counts[1]?.[1] ?? 0;
    return top[1] >= second * 2 ? top[0] : undefined;
}

/**
 * Does this segment contain any of the corpus's own script?
 *
 * ⚠ WHAT THIS IS FOR, AND THE MEASUREMENT BEHIND IT. Wikis in a non-Latin script carry whole articles quoted in
 * English, and `selectCells` is ADVERSARIAL — it prefers symbol-dense segments. Symbol density and
 * foreign-language prose correlate strongly (prices, dates, box-office figures, bare markup), so the foreign
 * lines were over-represented in exactly the tier the gate reads. Across the 154 mined artifacts, 33 in a
 * non-Latin script contained cells with ZERO characters of that script: ps 60/248, sat 57/245, ug 55/239,
 * si 52/252, km 47/253, wuu 47/242, lo 45/244. In km's case those cells were a Jackie Chan filmography, a
 * Stradivari-violin article and a UN administration report, and they produced `US$` currency drops that read as
 * Khmer reading gaps while being nothing of the kind.
 *
 * ⚠ THE TEST IS "ZERO", NOT A RATIO, and that is the conservative choice. A Khmer sentence quoting an English
 * film title is still Khmer evidence and must survive; only a segment with no native character at all is
 * discarded. Latin-script corpora are never filtered, because for them a Latin-only segment is the normal case
 * and the user's point about Latinized orthographies applies directly — a wiki in Latin script is fine.
 *
 * ⚠ AND IT MUST BE A NATIVE LETTER, NOT MERELY A NATIVE CHARACTER. Testing `\p{Script=Khmer}` alone let English
 * prose through on the strength of a Khmer-digit year, because the digits ០-៩ ARE script=Khmer: wiki timeline
 * entries like `២០០៥ - Influenced by Live 8, the G8 leaders pledged…` survived the first version of this filter
 * and went on producing the same `US$` drops. 17 of km's 252 cells were that exact shape. A year written in
 * native digits says nothing about how the language forms sentences, which is what these artifacts are for.
 */
export function isNativeSegment(segment: string, script: string | undefined): boolean {
    if (script === undefined || script === "Latin") return true;
    const re = SCRIPTS.find(([name]) => name === script)?.[1];
    if (re === undefined) return true;
    // Char-by-char because JS cannot intersect `\p{Script=…}` with `\p{L}` in one class without the `v` flag.
    for (const ch of segment) if (re.test(ch) && LETTER.test(ch)) return true;
    return false;
}
const LETTER = /\p{L}/u;
