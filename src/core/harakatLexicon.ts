/**
 * Perso-Arabic short-vowel COVERAGE layer — the shippable half of the two-layer rider phonemizer (Urdu, Persian,
 * Pashto, Punjabi-Shahmukhi). These abjads leave short vowels unwritten, so an undiacritized word is a skeleton
 * (کرن → default schwas) and the g2p can only guess a default [ə]. This looks the bare word up in a mined lexicon
 * (`lexicon.tsv` beside each g2p — g2p-inversion over wikipron + kaikki + Hindi→Urdu real spellings) and, on a hit,
 * substitutes OUR vocalization (کِرن) so the g2p reads the real short vowel (ɪ/ʊ/…). On a miss the word is returned
 * unchanged (current default-schwa behavior). This is the exact-match analogue of Arabic's restore.ts/diacritization
 * .tsv; the neural GENERALIZATION layer (novel words) is a later ONNX pass. See docs/investigations/arabic_script_restorer_investigation.md.
 */
import { loadTsvMap } from "./loadTsv.ts";

// Arabic harakat block (U+064B tanwīn … U+0652 sukūn) + U+0670 dagger alif — the diacritics an abjad may carry.
// Shared by the lexicon layer (this file) and the neural pre-pass (riderDiacritizer.ts) so the two agree on what a
// "skeleton" is; the `g` variant strips them, the non-`g` variant tests for their presence.
export const HARAKAT = /[ً-ْٰ]/u;
export const HARAKAT_G = /[ً-ْٰ]/gu;
/** Strip every combining haraka → the bare consonant skeleton. */
export const stripHarakat = (word: string): string => word.replace(HARAKAT_G, "");

/** Load a rider's `skeleton⇥vocalized` restoration lexicon beside its module. Optional: absent → empty Map. */
export function loadHarakatLexicon(metaUrl: string): ReadonlyMap<string, string> {
    return loadTsvMap(metaUrl, "lexicon.tsv", undefined, { optional: true });
}

/**
 * Restore a single word's short vowels from the lexicon. If the word already carries harakat it is RESPECTED
 * (the writer supplied explicit vowels — never clobber them); otherwise a lexicon hit replaces the bare skeleton
 * with our vocalization, and a miss returns the word unchanged. Pure lookup — the g2p still does the IPA mapping.
 * The lookup key is NFC-normalized (the mined lexicon keys are NFC): NFD input (decomposed آ/أ, reordered marks)
 * would otherwise silently miss a covered word.
 */
export function restoreHarakat(word: string, lexicon: ReadonlyMap<string, string>): string {
    if (HARAKAT.test(word)) return word;
    return lexicon.get(word.normalize("NFC")) ?? word;
}
