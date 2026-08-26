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
 * The artifact's instance GLOSSES ITSELF one clause later: *"Sim Fabura sign N195.3bn kontrat wit Julius
 * Berger … Di govnor tok sey e don pay N150 billion fest"* — the same figure class, abbreviated once and
 * spelled once, by the same writer in the same sentence. `naija.ts` already declares ⟨billion⟩ as a
 * magnitude word (×13 beside a currency sign in this corpus), so nothing is being sourced here: the
 * abbreviation is expanded into a word the tier and the g2p both already speak, and the magnitude then
 * hops the currency exactly as the written-out form does.
 *
 * ⚠ THAT QUOTATION IS IN THE CORPUS'S OWN CASE, AND IT IS LOWERCASE IN BOTH HALVES. An earlier version of
 * this note wrote ⟨BN⟩ and ⟨BILLION⟩, which made the case-sensitive pattern below look as though it failed
 * on its own motivating instance — it does not, and re-casing the quote is cheaper than the next reader
 * re-deriving that.
 *
 * ⚠ DIGIT-ANCHORED AND GLUED, which is what makes it safe against the other ⟨bn⟩. Outside a figure the
 * string is *ibn* in an Arabic name — routine in northern-Nigerian copy — and a bare-token rule would have
 * read *Abdullahi bn Fodio* as a billion. Requiring a digit immediately to the left admits `195.3bn` and
 * `200bn` and no name at all.
 * ⚠ NO ⟨m⟩ AND NO ⟨tn⟩. `100m` is the one-letter hazard the whole tree refuses (it is also a metre, a
 * version suffix and, in this corpus's sports copy, the sprint distance — `di 100 mita race`); `tn` is ×0.
 */
const MAGNITUDE_ABBREV = /(?<=\d)\s?bn(?![\p{L}\p{M}\d])/gu;

/**
 * THE MINUS — U+2212 ONLY, and the word is `minus`, in English, because Naija is an English-lexified creole
 * and this layer already works that way.
 *
 * ⚠ THE PRECEDENT IS IN THIS LANGUAGE'S OWN TIER: `percent: ["percent"]` — the bare English word, declared
 * on pcm.wikipedia's own "85 percent" / "reduce by about 0.87 percent", and read as [pasɛnt] because the
 * engine NATIVISES a known English spelling through the English dict rather than spelling it out. `minus`
 * takes the identical route and comes out [mainas], which is the ordinary Naija reflex of /ˈmaɪnəs/.
 *
 * ⚠ THE ATTESTATION IS ×1 AND IS RECORDED AS A LEAD, NOT A FINDING — pcm.wikipedia's Ngozi Okonjo-Iweala
 * article writes *"kolet loan for Sovereign credit rating (of BB minus) fom fitch rating"*, which is the
 * word in Naija prose in the MODIFIER sense, though not in front of a numeral. What carries the rest of the
 * argument is that the register around the sign is English-lexified throughout — the corpus sentence holding
 * the only U+2212 reads *"get di lowes minimum temperashor of 49 K (−224 °C; −371 °F)"* — and that a creole
 * whose maths vocabulary is its lexifier's has no competing native candidate to be wrong about. Omitting the
 * sign INVERTS the value; `mainas` is the reading a Naija speaker gives it.
 *
 * ⚠ U+2212 ONLY. The hyphen here is compounding and ranges (`planet-dem`, `63°F to 98°F` written with dashes
 * elsewhere), and it is the ambiguous character; U+2212 can only be the operator.
 * ⚠ `(?<!\p{Nd}\s)` refuses the space-separated exponent, the fleet-wide guard.
 *
 * ⚠ NOTED, NOT FIXED: `°C` IS STILL DROPPED HERE — `47.6 °C` reads *foti sɛvin pɔint siks si*, the degree
 * sign gone and ⟨C⟩ read as the English letter name. pcm.wikipedia has seven digit-adjacent degrees
 * (`37.5°C`, `70°C`, `63°F`) and writes the noun as `temperazho` / `tempireshon`, but no DEGREE word is
 * sourced yet. That is a separate gap with its own sourcing, and the minus is worth reading without it:
 * a dropped degree loses a unit, a dropped minus inverts the quantity.
 */
const MINUS = /(?<![\p{L}\p{M}\p{Nd}])(?<!\p{Nd}\s)\u2212(?=\p{Nd})/gu;

/** Naija text → text, before tokenization. */
export function normalizeNaija(input: string): string {
    return input.replace(ABBREV_RE, (_m, w: string) => ABBREV[w]!)
        .replace(MAGNITUDE_ABBREV, " billion")
        .replace(MINUS, "minus ");
}
