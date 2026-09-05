/**
 * Perso-Arabic short-vowel COVERAGE layer — the shippable half of the two-layer rider phonemizer (Urdu, Persian,
 * Pashto, Punjabi-Shahmukhi). These abjads leave short vowels unwritten, so an undiacritized word is a skeleton
 * (کرن → default schwas) and the g2p can only guess a default [ə]. This looks the bare word up in a mined lexicon
 * (`lexicon.tsv` beside each g2p — g2p-inversion over wikipron + kaikki + Hindi→Urdu real spellings) and, on a hit,
 * substitutes OUR vocalization (کِرن) so the g2p reads the real short vowel (ɪ/ʊ/…). On a miss the word is returned
 * unchanged (current default-schwa behavior). This is the exact-match analogue of Arabic's
 * restore.ts/diacritization.tsv; the neural GENERALIZATION layer (novel words) is a later ONNX pass.
 */
import { loadTsvMap } from "./loadTsv.ts";

// Arabic harakat block (U+064B tanwīn … U+0652 sukūn) + U+0670 dagger alif — the diacritics an abjad may carry.
// Shared by the lexicon layer (this file) and the neural pre-pass (./riderDiacritizer.ts) so the two agree on what a
// "skeleton" is; the `g` variant strips them, the non-`g` variant tests for their presence.
export const HARAKAT = /[ً-ْٰ]/u;
export const HARAKAT_G = /[ً-ْٰ]/gu;
/** Strip every combining haraka → the bare consonant skeleton. */
export const stripHarakat = (word: string): string => word.replace(HARAKAT_G, "");

/** Load a rider's `skeleton⇥vocalized` restoration lexicon beside its module. Optional: absent → empty Map. */
/**
 * ⚠ AN ENTRY THAT VOCALIZES TO NOTHING IS REJECTED AT LOAD. This lexicon exists to supply the short vowels
 * an abjad leaves unwritten, so a row whose value carries NO harakat and a sukun on every consonant asserts
 * the opposite — that the word has no vowels at all — and is self-contradictory. It is also strictly worse
 * than having no entry: a miss falls through to the g2p, which at least inserts the default short vowel,
 * whereas the entry suppresses it and the word comes out unpronounceable (بزنس → *bzns*, برتخت → *brt̪xt̪*).
 *
 * 26 such rows are in `pashto/lexicon.tsv`, all in one alphabetical run (بر…/بز…) — the residue of the
 * loose-fold mining that `docs/investigations/ps/ps_neural_restoration_investigation.md` Run 11 identified and fixed at scale
 * ("ps silver was 78% all-bare"). fa/ur/pnb have none, so this costs them nothing; the guard lives here so
 * a re-mine cannot reintroduce the class into any of the four.
 */
const SUKUN = "\u0652";
const ARABIC_LETTER = /[\u0621-\u06D3]/u;

function vocalizesToNothing(value: string): boolean {
    if (/[\u064B-\u0650\u0670]/u.test(value)) return false; // carries a real vowel mark
    const consonants = [...value].filter((c) => ARABIC_LETTER.test(c) && c !== SUKUN).length;
    const sukuns = [...value].filter((c) => c === SUKUN).length;
    return sukuns >= 2 && sukuns >= consonants - 1;
}

export function loadHarakatLexicon(metaUrl: string): ReadonlyMap<string, string> {
    const raw = loadTsvMap(metaUrl, "lexicon.tsv", undefined, { optional: true });
    const out = new Map<string, string>();
    for (const [k, v] of raw) if (!vocalizesToNothing(v)) out.set(k, v);
    return out;
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
