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

/**
 * ⟨bn⟩ GLUED TO A FIGURE — the money magnitude of Nigerian press copy, and the one raw-Latin residual in
 * this corpus that has a reading already shipped in this engine.
 *
 * The artifact's instance GLOSSES ITSELF one clause later: *"Sim Fabura sign N195.3BN kontrat wit Julius
 * Berger … Di govnor tok sey e don pay N150 BILLION fest"* — the same figure class, abbreviated once and
 * spelled once, by the same writer in the same sentence. `naija.ts` already declares ⟨billion⟩ as a
 * magnitude word (×13 beside a currency sign in this corpus), so nothing is being sourced here: the
 * abbreviation is expanded into a word the tier and the g2p both already speak, and the magnitude then
 * hops the currency exactly as the written-out form does.
 *
 * ⚠ DIGIT-ANCHORED AND GLUED, which is what makes it safe against the other ⟨bn⟩. Outside a figure the
 * string is *ibn* in an Arabic name — routine in northern-Nigerian copy — and a bare-token rule would have
 * read *Abdullahi bn Fodio* as a billion. Requiring a digit immediately to the left admits `195.3bn` and
 * `200bn` and no name at all.
 * ⚠ NO ⟨m⟩ AND NO ⟨tn⟩. `100m` is the one-letter hazard the whole tree refuses (it is also a metre, a
 * version suffix and, in this corpus's sports copy, the sprint distance — `di 100 mita race`); `tn` is ×0.
 */
const MAGNITUDE_ABBREV = /(?<=\d)\s?bn(?![\p{L}\p{M}\d])/gu;

/** Naija text → text, before tokenization. */
export function normalizeNaija(input: string): string {
    return input.replace(ABBREV_RE, (_m, w: string) => ABBREV[w]!).replace(MAGNITUDE_ABBREV, " billion");
}
