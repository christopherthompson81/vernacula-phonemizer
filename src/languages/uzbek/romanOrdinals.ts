/**
 * Uzbek Roman-numeral reading. A century is read as an ORDINAL: `XIX asr` is *oʻn toʻqqizinchi asr*; the
 * cardinal *oʻn toʻqqiz asr* means "nineteen centuries".
 *
 * SOURCES, and a note on their thinness (this is the weakest-sourced of the three Turkic languages here):
 *  - The orthographic rule is explicit: an Uzbek ordinal (tartib son) is the cardinal + -nchi after a vowel /
 *    -inchi after a consonant; written with an ARABIC numeral it takes a hyphen for the suffix (7-sinf,
 *    1991-yilning 1-sentabri), and *"Rim raqamlaridan keyin chiziqcha yozilmaydi"* — no hyphen after a Roman
 *    numeral. So a Roman numeral IS the ordinal writing, needing no suffix, exactly as in Azerbaijani.
 *  - The spelled century phrase is attested, though only for the round value: **"Yigirmanchi asr"** ("twentieth
 *    century") occurs as a film/topic title and as a news topic tag (zamin.uz, kinovaqt.info). Searches for the
 *    spelled *oʻn toʻqqizinchi asr* returned nothing, so the 19th-century reading is inferred from the same
 *    construction rather than separately attested. Combined with the orthographic rule that is enough to
 *    justify the ordinal policy; recorded here so the evidence base is visible rather than implied.
 *
 * FORM: no gender, and the suffix does not vary by head noun, so the single form is unconditionally correct in
 * every context, regnal names included. No agreement limitation.
 *
 * Uzbek is the Turkic language that LOST vowel harmony, so the suffix has ONE shape — no four-way alternation
 * as in Azerbaijani, no back/front pair as in Kazakh. Only the last element of a compound takes it.
 */
import { loadManifest } from "../../core/loadManifest.ts";
import type { RomanPolicy } from "../../core/roman.ts";

/** The language's own cardinal words (uzbek.jsonc): units 0–9, tens keyed by the round value. */
const N = loadManifest<{
    numbers: { units: string[]; tens: Record<string, string>; magnitudes: { hundred: string } };
}>(import.meta.url, "uzbek.jsonc").numbers;

/** Cardinal stem → ordinal. Vowel-final → -nchi (yigirma → yigirmanchi, olti → oltinchi); consonant-final →
 *  -inchi (toʻqqiz → toʻqqizinchi, sakson → saksoninchi). The comma-letter ʻ (U+02BB) is not a vowel, so
 *  `toʻrt` is correctly consonant-final → toʻrtinchi. */
function suffixed(stem: string): string {
    return `${stem}${/[aeiou]$/u.test(stem) ? "" : "i"}nchi`;
}

/**
 * Integer → Uzbek ordinal. `undefined` above 100 falls back to the cardinal.
 */
function ordinal(n: number): string | undefined {
    if (!Number.isInteger(n) || n < 1 || n > 100) return undefined;
    if (n === 100) return suffixed(N.magnitudes.hundred);
    if (n < 10) return suffixed(N.units[n]!);
    const t = Math.floor(n / 10),
        u = n % 10;
    const tens = N.tens[String(t * 10)];
    if (tens === undefined) return undefined;
    return u === 0 ? suffixed(tens) : `${tens} ${suffixed(N.units[u]!)}`;
}

/**
 * Agglutinative, so unanchored at the end: `asr` also matches asrda, asrning, asrlar, asrga. Covered: asr
 * (century), yuzyillik (century), mingyillik (millennium), yubiley (jubilee/anniversary), kongress, sinf
 * (school grade — the orthography's own ordinal example).
 */
const CONTEXT = /^(asr|yuzyillik|mingyillik|yubiley|kongress|sinf)/iu;

/** This policy always supplies `ordinal`, which is optional on `RomanPolicy` — the intersection makes it
 *  REQUIRED here so tests can call it directly without a non-null assertion. */
type Policy = RomanPolicy & { ordinal(n: number): string | undefined };

export const ROMAN_POLICY: Policy = {
    ordinal,
    ordinalBefore: CONTEXT,
    ordinalAfter: CONTEXT,
};
