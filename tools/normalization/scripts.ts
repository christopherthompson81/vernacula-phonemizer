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
    /**
     * ⚠ MARKUP IS NOT SPOKEN TEXT, whatever script it is in. The dump converter strips wikitext, but LaTeX
     * commands and HTML entities survive it, and a hard-set line carrying them asks a gate to source a reading
     * for something no reader says: yo's artifact holds `Ami ikosile R (tabi \mathbb{R} tabi Unicode ℝ)` and
     * `bi i ² = &minus;1`, and both reported as Yoruba exponent defects.
     */
    if (/\\[a-zA-Z]+\s*\{|&(?:[a-zA-Z]{2,10}|#\d{2,5});/u.test(segment)) return false;
    /**
     * ⚠ A LATIN-SCRIPT LANGUAGE STILL GETS A SCRIPT TEST, and it used to get none — this returned `true` for
     * every segment, so the filter was wholly inert for the 60-odd Latin-script languages in the fleet. Yoruba's
     * artifact carried three lines of a GREEK SI-prefix table (`yotta Y yotta 10²⁴ εφτάκις εκατομμυριάδα
     * γιοτάμετρο`), whose superscripts were reported as Yoruba exponent defects. A segment is foreign when
     * another script DOMINATES it — the test is dominance, not presence, or a single quoted foreign name would
     * discard an otherwise native line (the `デジモン` lesson from corpus-words.ts).
     *
     * What this CANNOT do is discriminate ENGLISH prose in a Latin-script language's wiki, which is the same
     * script by definition. That residue is real and is why `inForeignSpan` documents itself as inert here.
     */
    /**
     * ⚠ `undefined` IS NOT "Latin" HERE, and conflating them broke three artifacts. `dominantScript` returns
     * undefined when no script has a clear majority — which is every Japanese corpus, since it splits across
     * Han, Hiragana and Katakana — and the dominance test below then rejected 54 of ja's 54 lines as foreign.
     * An unknown script must FAIL OPEN, the same property `allOccurrencesForeign` documents: thin or mixed
     * evidence means report, never discard.
     */
    if (script === undefined) return true;
    if (script === "Latin") {
        const latin = countLetters(segment, /\p{sc=Latn}/u);
        for (const [name, re] of SCRIPTS) {
            if (name === "Latin") continue;
            if (countLetters(segment, re) > latin) return false;
        }
        return true;
    }
    const re = SCRIPTS.find(([name]) => name === script)?.[1];
    if (re === undefined) return true;
    // Char-by-char because JS cannot intersect `\p{Script=…}` with `\p{L}` in one class without the `v` flag.
    for (const ch of segment) if (re.test(ch) && LETTER.test(ch)) return true;
    return false;
}
const LETTER = /\p{L}/u;

/** Letters of one script in a segment. Char-by-char for the same reason `isNativeSegment` is. */
function countLetters(segment: string, re: RegExp): number {
    let n = 0;
    for (const ch of segment) if (re.test(ch) && LETTER.test(ch)) n++;
    return n;
}
