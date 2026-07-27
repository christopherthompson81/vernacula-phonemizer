/**
 * WESTERN Armenian / արեւմտահայերէն (hyw) text phonemizer — canonical IPA, espeak-independent. The Istanbul/diaspora
 * standard. Reuses the shared, manifest-driven Armenian engine (armenian.ts `makeArmenianEngine`); everything specific
 * to Western Armenian lives in westarmenian.jsonc — chiefly the CONSONANT SHIFT (classical voiced ⟨բ դ գ ձ ջ⟩ and
 * classical aspirate ⟨փ թ ք ց չ⟩ merge to voiceless-aspirated [pʰ tʰ kʰ t͡sʰ t͡ʃʰ]; classical voiceless ⟨պ տ կ ծ ճ⟩ →
 * voiced [b d ɡ d͡z d͡ʒ]), the rhotic neutralisation ⟨ր ռ⟩→[ɾ], and the ⟨յու/իւ⟩→[ʏ] / ⟨յո⟩→[œ] digraphs.
 *
 * Validated vs wikipron hye_armn_w broad (17211) + narrow (17584). See docs/investigations/hyw_native_bringup_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import { loadManifest } from "../../core/loadManifest.ts";
import { makeArmenianEngine, type ArmenianDef } from "../armenian/armenian.ts";

const western = makeArmenianEngine(loadManifest<ArmenianDef>(import.meta.url, "westarmenian.jsonc"));

/** One Western Armenian word → canonical IPA. */
export const phonemizeWord = western.phonemizeWord;

/** Build the Western Armenian phonemizer. */
export function createWestArmenian(): Phonemizer {
    return western.create();
}
