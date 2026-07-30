/**
 * LATIN-AMERICAN SPANISH (es-419) Roman-numeral reading — identical to es.
 *
 * es-419 differs from es only in PHONOLOGY (seseo: no /θ/), never in the numeral words, and the reading
 * convention is the pan-Hispanic one: the RAE *Ortografía* is co-published with the Asociación de
 * Academias de la Lengua Española, so «siglo XXI» = *siglo veintiuno* holds on both sides of the Atlantic.
 * Re-exported rather than copied so the two variants cannot drift.
 *   → https://www.rae.es/ortografía/lectura-de-los-números-romanos
 * See ../spanish/romanOrdinals.ts for the full rationale (centuries stay CARDINAL; the policy supplies the
 * prenominal event ordinal, *XL aniversario* → *cuadragésimo aniversario*).
 */
export { ROMAN_POLICY } from "../spanish/romanOrdinals.ts";
