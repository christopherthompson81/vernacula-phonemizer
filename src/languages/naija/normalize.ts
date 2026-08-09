/**
 * Nigerian Pidgin (pcm) TEXT NORMALIZATION — the pre-tokenizer rewrites, the same slot Hausa's
 * `normalizeHausa` occupies. The SYMBOL tier (%, currency, &, units) stays in `naija.ts` with the rest of
 * the engine data, as it does for ha/af/ur; what belongs here is the text a reader rewrites before any
 * token boundary is decided.
 *
 * ⚠ THIS FILE'S EXISTENCE IS LOAD-BEARING BEYOND ITS CONTENTS. `tools/language-catalogue/derive-
 * normalization.py` decides a language's `normalization` column from exactly two things — does the engine
 * directory have a `normalize.ts`, and does the engine call it — so a treated language whose rewrites live
 * inline reads as UNTREATED in the planning query. Of the **62 engine directories** that use the symbol
 * tier (73 registry codes, since several codes share a directory), naija was the ONLY one with no
 * `normalize.ts`, so it alone was mis-reported; the fix is to be conventional rather than to teach the tool
 * a second pattern it would then have to keep matching.
 */

/**
 * ABBREVIATIONS. ⟨Dr⟩ nativised as a WORD → *dɾaiv* ("drive"), the same wrong-word class the ordinals were.
 * Expanded to the full word here so the ordinary path reads it. ⟨Doctor⟩ ×3 against ⟨Dr⟩ ×4 in the mined
 * corpus — the expansion is the corpus's own word, not an English import.
 *
 * ⚠ NO `i` FLAG. Case-insensitive matching read the COUNTRY abbreviation `DR Congo` as *dakta kaŋɡo*
 * ("Doctor Congo") — routine in the football and news copy this engine targets. The title is written ⟨Dr⟩
 * or ⟨dr⟩; an all-caps ⟨DR⟩ is a different word, so the alternation is explicit and the flag is dropped.
 *
 * ⚠ `\.?(?![\p{L}])`, NOT `\.?\b` — after a consumed dot the next character is a space, and `\b` between
 * `.` and ` ` is FALSE, so the dot survived and was read as a clause pause (`Dr. Ada` → *dakta . eda*). The
 * negative lookahead both consumes the dot and keeps ⟨Drama⟩/⟨Dreamstar⟩ out, since those continue past the
 * `r` and so never reach it.
 */
const ABBREV: Record<string, string> = { Dr: "Doctor", dr: "Doctor" };
const ABBREV_RE = new RegExp(`\\b(${Object.keys(ABBREV).join("|")})\\.?(?![\\p{L}])`, "gu");

/** Naija text → text, before tokenization. */
export function normalizeNaija(input: string): string {
    return input.replace(ABBREV_RE, (_m, w: string) => ABBREV[w]!);
}
