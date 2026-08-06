/**
 * Malagasy grapheme→phoneme engine. Standard/Official Malagasy (Merina) orthography is fairly regular, so this is
 * a left-to-right scan with a match table for the multi-letter graphemes — no lexicon. The notable rules:
 *   - ⟨o⟩ → /u/ (the signature Malagasy value: olona → ˈuluna), ⟨y⟩ → /i/ (only word-final), ⟨ô⟩ → /o/.
 *   - retroflex affricates ⟨tr⟩ → ʈʂ, ⟨dr⟩ → ɖʐ; ⟨ts⟩ → ts; ⟨j⟩ → dz.
 *   - prenasalized stops: ⟨mb mp nd nt ndr ntr nts ng nk nj⟩ → ᵐb ᵐp ⁿd ⁿt ⁿɖʐ ⁿʈʂ ⁿts ᵑɡ ᵑk ⁿdz (single segments).
 * Penultimate stress and the weak-final vowels (kept full in this broad canonical transcription) are handled
 * downstream (malagasy.ts).
 */
import { MANIFEST } from "./manifest.ts";
import { latinPhone } from "../../core/latinPhones.ts";

const VOWEL_IPA = MANIFEST.vowels;
const CONS_IPA = MANIFEST.consonants;
const isVowelLetter = (c: string): boolean => c !== "" && c in VOWEL_IPA;

// Multi-letter graphemes, LONGEST FIRST (so ndr beats nd/dr, ntr beats nt/tr, nts beats nt/ts). Prenasalized
// stops carry a place-matched superscript nasal (ᵐ labial, ⁿ coronal, ᵑ velar); the retroflex affricates are
// two-character ʈʂ / ɖʐ. Each maps to a single consonant segment.
const DIGRAPHS: [string, string][] = [
    ["ndr", "ⁿɖʐ"],
    ["ntr", "ⁿʈʂ"],
    ["nts", "ⁿts"],
    ["ndz", "ⁿdz"],
    ["mp", "ᵐp"],
    ["mb", "ᵐb"],
    ["nd", "ⁿd"],
    ["nt", "ⁿt"],
    ["nj", "ⁿdz"],
    ["ng", "ᵑɡ"],
    ["nk", "ᵑk"],
    ["tr", "ʈʂ"],
    ["dr", "ɖʐ"],
    ["ts", "ts"],
    ["j", "dz"],
];

// Vowel sequences that are ONE nucleus (a diphthong or a monophthongized digraph), so ⟨o⟩ inside them does NOT
// take the /u/ value and stress counts them as a single syllable: ⟨ai⟩/⟨ay⟩ → the diphthong [aj], ⟨ao⟩ → [o]
// (tao→to, not tau). Checked before the single-vowel rule.
const VOWEL_SEQ: [string, string][] = [
    ["ai", "aj"],
    ["ay", "aj"],
    ["ao", "o"],
];

export interface Seg {
    ph: string;
    nucleus: boolean;
}

/** Malagasy word → segment list (no stress). */
export function toSegments(word: string): Seg[] {
    const w = word.toLowerCase();
    const n = w.length;
    const segs: Seg[] = [];
    let i = 0;
    outer: while (i < n) {
        // Multi-letter graphemes (prenasalized stops, retroflex affricates, ⟨j⟩) — longest match first.
        for (const [seq, ph] of DIGRAPHS) {
            if (w.startsWith(seq, i)) {
                segs.push({ ph, nucleus: false });
                i += seq.length;
                continue outer;
            }
        }
        // Vowel digraphs (one nucleus): ⟨ai⟩/⟨ay⟩→[aj], ⟨ao⟩→[o].
        for (const [seq, ph] of VOWEL_SEQ) {
            if (w.startsWith(seq, i)) {
                segs.push({ ph, nucleus: true });
                i += seq.length;
                continue outer;
            }
        }
        const c = w[i]!;
        if (c in VOWEL_IPA) {
            segs.push({ ph: VOWEL_IPA[c]!, nucleus: true });
            i++;
            continue;
        }
        // ⚠ A letter with no rule here still denotes a sound; dropping it deletes what the writer typed.
        // Reached only when every rule above has declined, so the language's own reading always wins.
        const cons = CONS_IPA[c] ?? latinPhone(c, { initial: i === 0, includeH: true });
        if (cons !== undefined) segs.push({ ph: cons, nucleus: false });
        i++;
    }
    return segs;
}

/** Is this segment a syllable nucleus (a vowel)? */
export function isNucleus(s: Seg): boolean {
    return s.nucleus;
}
