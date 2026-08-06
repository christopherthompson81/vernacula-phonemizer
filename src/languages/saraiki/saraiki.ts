/**
 * Saraiki (skr) text phonemizer — canonical IPA.
 *
 * Saraiki is a Lahnda (Greater Punjabi) language of the Pakistani south-west (~26M speakers), written in an
 * extended Shahmukhi (Perso-Arabic) abjad with four DEDICATED implosive letters. Engine-wise it is the NON-tonal
 * sibling of Punjabi: where Punjabi (pa/pnb) turned its historical voiced aspirates into TONE, Saraiki kept them
 * as segments AND retains the four implosives (like Sindhi). So it reuses the shared Lahnda machinery — the
 * Shahmukhi front-end (scanShahmukhi), gemination→length, homorganic nasal assimilation, weight stress — via
 * `makeNativePunjabi` with the `{ saraiki: true }` variant flag, which:
 *
 *   1. skips TONOGENESIS (keeps the voiced aspirates bʰ d̪ʱ ɡʱ … as segments);
 *   2. keeps ASPIRATED SONORANTS (لھ→lʰ, نھ→nʰ — real Saraiki segments the referee writes);
 *   3. skips the plain-ن→ɳ infinitive heuristic (Saraiki writes retroflex ɳ explicitly as ݨ).
 *
 * The four implosive letters ٻ→ɓ, ڄ→ʄ, ڳ→ɠ, ݙ→ɗ live in the shared shahmukhi.jsonc table (Punjabi text never uses
 * them). Short vowels are UNWRITTEN in the abjad → a default [ə] (the shared restoration gap, as for pnb/ur/sd);
 * the referee-eval folds the short-vowel + majhūl axes it cannot recover.
 *
 * Referee: wikipron skr_arab broad (HUMAN, Wiktionary).
 */
import { loadSharedPhonology } from "../../core/phonology.ts";
import { restoreHarakat, loadHarakatLexicon } from "../../core/harakatLexicon.ts";
import {
    makeNativePunjabi,
    loadPunjabiManifest,
    type ForeignPhonemizer,
} from "../punjabi/punjabi.ts";

let SKR: ReturnType<typeof makeNativePunjabi> | undefined;
function engine() {
    return (SKR ??= makeNativePunjabi(loadPunjabiManifest(), loadSharedPhonology(), undefined, { saraiki: true }));
}

// Short-vowel coverage lexicon (optional; beside this module). Mirrors the pnb/ur pattern: an exact-match
// skeleton→vocalized map consulted before the rule g2p. Absent → the default-[ə] rules run unchanged.
let LEXICON: ReadonlyMap<string, string> | undefined;
function saraikiLexicon(): ReadonlyMap<string, string> {
    return (LEXICON ??= loadHarakatLexicon(import.meta.url));
}

/** Rule-only bare word→IPA (the non-circular referee signal). */
export function phonemizeWordRules(w: string): string {
    return engine().word(w);
}

/** Shipped bare word→IPA: short-vowel coverage lexicon → rule g2p. */
export function phonemizeWord(w: string): string {
    return phonemizeWordRules(restoreHarakat(w, saraikiLexicon()));
}

/** Build the Saraiki phonemizer. `foreign` handles embedded Latin. */
export function createSaraiki(foreign?: ForeignPhonemizer): { text(input: string): string } {
    return makeNativePunjabi(loadPunjabiManifest(), loadSharedPhonology(), foreign, { saraiki: true });
}
