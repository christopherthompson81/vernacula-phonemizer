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
import { loadTsvMap } from "../../core/loadTsv.ts";
import type { Phonemizer } from "../../registry.ts";
import {
    createPortuguese,
    phonemizeWord as phonemizeWordPt,
} from "../portuguese/portuguese.ts";

// BP open/close override lexicon: word → the correct STRESSED mid vowel (e/ɛ/o/ɔ). The stressed-vowel openness
// that the rules can't predict (cheque [ɛ] vs sede [e]; the -osa/-ote/verb-morphology open ɔ/ɛ) is genuinely
// LEXICAL — mined from the wikipron BZ referee for words where the rule output matches NO attested variant (so
// homographs, which match one reading, are left alone). Because it is referee-mined, the referee EVAL scores the
// RULE-ONLY path (phonemizeWordRules) → the honest, non-circular number; this lexicon is a SHIPPED refinement.
let LEX: Map<string, string> | undefined;
const lex = (): Map<string, string> =>
    (LEX ??= loadTsvMap(import.meta.url, "pt-br-openclose.tsv", (v) => v, {
        optional: true,
    }));

/** Apply the BP open/close override: replace the stressed vowel (the char after ˈ) with the lexicon target. */
function openClose(ipa: string, word: string): string {
    const t = lex().get(word);
    return t ? ipa.replace(/ˈ./u, `ˈ${t}`) : ipa;
}

/** One BP word → canonical IPA, SHIPPED path (rule engine in Brazilian mode + the open/close lexicon). */
export function phonemizeWord(word: string): string {
    return openClose(phonemizeWordPt(word, "bp"), word.toLowerCase());
}

/** One BP word → canonical IPA, RULE-ONLY (no open/close lexicon) — the non-circular signal for the referee eval. */
export function phonemizeWordRules(word: string): string {
    return phonemizeWordPt(word, "bp");
}

/** Build the Brazilian Portuguese phonemizer (EP engine, `dialect: "bp"`, + the open/close lexicon). */
export function createPortugueseBR(): Phonemizer {
    return createPortuguese("bp", openClose);
}
