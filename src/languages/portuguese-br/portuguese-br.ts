/**
 * Brazilian Portuguese (pt-BR) — "neutral"/standard (paulistano-based) realization, an ACCENT VARIANT of the
 * European Portuguese `pt` engine (not a separate language). It is the SAME rule engine parameterized by
 * `dialect: "bp"` (portuguese.ts) — the EP→BP delta is deep enough (vowel reduction is not recoverable from EP
 * surface forms) that it lives inside the engine, not as an output post-process:
 *
 *   • REDUCTION is position-split, not blanket. Only the FINAL atonic vowel raises (e→i, o→u, a→ɐ: cidade →
 *     sidad͡ʒi, estado → estadu); pretonic/postonic-medial vowels keep their mid quality (bonito → bonitu NOT the
 *     EP bunitu, professor → pɾofesoɾ, telefone → telefoni). No [ɨ], no EP initial-e→i raising.
 *   • CODA sibilant is ALVEOLAR s/z (paulistano), not the EP postalveolar ʃ/ʒ (estado → estadu, três → tɾes).
 *   • /t d/ AFFRICATE to t͡ʃ/d͡ʒ before [i]/[ĩ] (tia → t͡ʃia, dia → d͡ʒia, gente → ʒẽt͡ʃi) — the BP signature.
 *   • Coda /l/ VOCALIZES to [w] (sal → saw, Brasil → bɾaziw).
 *   • Coda /r/ stays [ɾ] and rr/initial stay [ʁ] — both attested in the BZ referee, avoiding the regionally
 *     contested [h]/[x]/[ɻ] realizations.
 *
 * The open/close correction lexicon is shared with EP (EP-derived; mostly valid for BP, a small stressed-mid
 * lexical tail differs). No referee-mined data → the eval scores this shipped path directly (non-circular).
 * See docs/investigations/pt-br_native_bringup_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import {
    createPortuguese,
    phonemizeWord as phonemizeWordPt,
} from "../portuguese/portuguese.ts";

/** One BP word → canonical IPA (rule engine in Brazilian mode + the shared open/close lexicon). */
export function phonemizeWord(word: string): string {
    return phonemizeWordPt(word, "bp");
}

/** Build the Brazilian Portuguese phonemizer (EP engine, `dialect: "bp"`). */
export function createPortugueseBR(): Phonemizer {
    return createPortuguese("bp");
}
