/**
 * Brazilian Portuguese Roman-numeral reading — identical to pt.
 *
 * pt-BR differs from pt-PT in phonology, not in numeral words, and shares the ordinal-≤X / cardinal-≥XI
 * convention. Re-exported rather than copied so the two cannot drift; the variant's own g2p supplies the
 * Brazilian pronunciation. See ../portuguese/romanOrdinals.ts for the rationale.
 */
export { ROMAN_POLICY } from "../portuguese/romanOrdinals.ts";
