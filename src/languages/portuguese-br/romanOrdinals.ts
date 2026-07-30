/**
 * BRAZILIAN PORTUGUESE (pt-BR) Roman-numeral reading — identical to pt.
 *
 * pt-BR differs from pt-PT in PHONOLOGY (open/close vowels, unreduced pretonic vowels), not in the numeral
 * words, and the ordinal-≤X / cardinal-≥XI reading convention is shared: Brazilian usage likewise says
 * *século dezenove*, *Bento dezesseis*. The ordinal series is spelled identically in both norms
 * (*quadragésimo*, *quinquagésimo*), so this re-exports pt rather than copying, and the two variants cannot
 * drift. The variant's own g2p supplies the Brazilian pronunciation of those words.
 *   → https://ciberduvidas.iscte-iul.pt/consultorio/perguntas/numeracao-romana-ordinal-ou-cardinal/14167
 * See ../portuguese/romanOrdinals.ts for the full rationale (centuries stay CARDINAL; the policy supplies
 * the prenominal event ordinal, *XL aniversário* → *quadragésimo aniversário*).
 */
export { ROMAN_POLICY } from "../portuguese/romanOrdinals.ts";
