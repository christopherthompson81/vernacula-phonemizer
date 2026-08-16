/**
 * WESTERN Armenian / արեւմտահայերէն (hyw) text phonemizer — canonical IPA. The Istanbul/diaspora
 * standard. Reuses the shared, manifest-driven Armenian engine (armenian.ts `makeArmenianEngine`); everything specific
 * to Western Armenian lives in westarmenian.jsonc — chiefly the CONSONANT SHIFT (classical voiced ⟨բ դ գ ձ ջ⟩ and
 * classical aspirate ⟨փ թ ք ց չ⟩ merge to voiceless-aspirated [pʰ tʰ kʰ t͡sʰ t͡ʃʰ]; classical voiceless ⟨պ տ կ ծ ճ⟩ →
 * voiced [b d ɡ d͡z d͡ʒ]), the rhotic neutralisation ⟨ր ռ⟩→[ɾ], and the ⟨յու/իւ⟩→[ʏ] / ⟨յո⟩→[œ] digraphs.
 *
 * Validated vs wikipron hye_armn_w broad (17211) + narrow (17584).
 */
import type { Phonemizer } from "../../registry.ts";
import { loadManifest } from "../../core/loadManifest.ts";
import { makeArmenianEngine, type ArmenianDef } from "../armenian/armenian.ts";
import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";
import { normalizeWestArmenian } from "./normalize.ts";


/**
 * The shared SYMBOL tier for WESTERN Armenian. Every entry differs from the Eastern one in `armenian.ts`
 * by more than an accent, and each difference is measured on hyw.wikipedia (see normalize.ts's table):
 * `տոլար` ×48 not դոլար, `եւրօ` ×62 not եվրո, `մեթր`/`քիլոմեթր` with the classical ⟨թ⟩ not ⟨տ⟩.
 *
 * ⚠ `տոկոս` ×42 SHIPS AND `առ հարիւր` DOES NOT, which is a judgement worth stating. The Western-only
 * phrase is real and attested in the exact slot — "96 առ հարիւրը գրել-կարդալ գիտէ", "98 առ հարիւրը
 * կ'արտադրուի", "3 առ հարիւր աղով ջուրը" — but it is a two-word prepositional phrase whose article
 * attaches to its SECOND word, and the tier can only postpose a noun. `տոկոս` is what this corpus's own
 * retained text writes after a figure ("60-70 տոկոսէն ոչ պակաս", "շաքարի տոկոսը կը հասնի 70-ի").
 */
const SYMBOLS = makeSymbolNormalizer({
    percent: ["տոկոս"],
    // ⚠ NO `£` — this corpus writes only `$` and `€`, and no Western Armenian pound word is in any source
    // the sourcing gate can read. An undeclared sign stays visible to the leak gates.
    currency: { "$": ["տոլար"], "€": ["եւրօ"] },
    units: {
        "կմ": ["քիլոմեթր"], "մ": ["մեթր"], "սմ": ["սանթիմեթր"], "մմ": ["միլիմեթր"],
        "կգ": ["քիլոկրամ"], "հա": ["հեքթար"],
    },
    exponentWords: { squared: ["քառակուսի"], cubed: ["խորանարդ"], position: "before" },
    magnitudes: ["հազար", "միլիոն", "միլիառ"],
});

// ⚠ normalize FIRST, then the tier — the same coupling Eastern documents: normalize's ordinal, suffix,
// era and degree steps need the figure and its written suffix still adjacent, which the tier would break.
const western = makeArmenianEngine(
    loadManifest<ArmenianDef>(import.meta.url, "westarmenian.jsonc"),
    (s) => SYMBOLS(normalizeWestArmenian(s)),
);

/** One Western Armenian word → canonical IPA. */
export const phonemizeWord = western.phonemizeWord;

/** Build the Western Armenian phonemizer. */
export function createWestArmenian(): Phonemizer {
    return western.create();
}
