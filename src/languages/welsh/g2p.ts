/**
 * Welsh grapheme→phoneme scanner. Welsh spelling is highly phonemic: resolve the digraphs (ch dd ff ng ll ph rh
 * th) and the vowel clusters (diphthongs, which carry a superscript offglide) by longest-match, with a few
 * context rules — ⟨si⟩+V → ʃ, ⟨w⟩/⟨i⟩ are consonants (/w/, /j/) before a vowel but vowels otherwise, and ⟨y⟩ is
 * obscure ə (non-final syllable or a function-word clitic) vs clear ɨ (final syllable). Stress + vowel length:
 * welsh.ts.
 */

import { MANIFEST } from "./manifest.ts";

const DIGRAPHS = MANIFEST.digraphs;
const NASAL_MUTATION = MANIFEST.nasalMutation;
const CONSONANTS = MANIFEST.consonants;
const VOWEL_CLUSTERS = Object.keys(MANIFEST.vowels).sort(
    (a, b) => b.length - a.length,
); // longest-first
const OBSCURE_Y = new Set(MANIFEST.obscureY);
// Vowel LETTERS, derived from the manifest's single-char vowel keys (+ ⟨y⟩, which the code resolves separately)
// so the accented inventory lives in ONE place — adding a vowel to welsh.jsonc can't silently desync the scanner.
const VOWEL_LETTERS = new Set([
    ...Object.keys(MANIFEST.vowels).filter((k) => k.length === 1),
    "y",
]);

const isVowelLetter = (c: string): boolean => c !== "" && VOWEL_LETTERS.has(c);

export interface Seg {
    ph: string;
    nucleus: boolean; // is a vowel nucleus (for stress placement)
    long?: boolean; // already long (circumflex / diphthong) → the length pass leaves it alone
}

/** Does a vowel LETTER occur in `w` at or after index i? (⟨y⟩ is clear ɨ only when nothing follows in the word.) */
function vowelAfter(w: string, i: number): boolean {
    for (let j = i; j < w.length; j++) if (isVowelLetter(w[j]!)) return true;
    return false;
}

/** Scan a lowercased Welsh word into segments. */
export function toSegments(word: string): Seg[] {
    const w = word.toLowerCase();
    const n = w.length;
    const obscureWord = OBSCURE_Y.has(w.replace(/['’]/g, ""));
    const segs: Seg[] = [];
    let i = 0;

    while (i < n) {
        const c = w[i]!;
        const three = w.slice(i, i + 3);
        const two = w.slice(i, i + 2);

        // --- word-initial nasal mutation (ngh → ŋ̥, mh → m̥, nh → n̥); medial ⟨ngh⟩ etc. fall through to ŋ+h ---
        if (i === 0) {
            if (NASAL_MUTATION[three]) {
                segs.push({ ph: NASAL_MUTATION[three]!, nucleus: false });
                i += 3;
                continue;
            }
            if (NASAL_MUTATION[two]) {
                segs.push({ ph: NASAL_MUTATION[two]!, nucleus: false });
                i += 2;
                continue;
            }
        }

        // --- digraphs (2-char: ch dd ff ng ll ph rh th) ---
        if (DIGRAPHS[two]) {
            segs.push({ ph: DIGRAPHS[two]!, nucleus: false });
            i += 2;
            continue;
        }

        // --- ⟨si⟩ + vowel → ʃ (siarad → ʃarad); ⟨si⟩ + consonant stays s+i (sir → siːr) ---
        if (c === "s" && w[i + 1] === "i" && isVowelLetter(w[i + 2] ?? "")) {
            segs.push({ ph: "ʃ", nucleus: false });
            i += 2;
            continue;
        }

        // --- vowels: multi-char clusters (diphthongs incl. wy/yw) win first, then w/i-as-consonant, then y ---
        if (isVowelLetter(c)) {
            const key = VOWEL_CLUSTERS.find(
                (k) => k.length >= 2 && w.startsWith(k, i),
            );
            if (key) {
                const ph = MANIFEST.vowels[key]!;
                segs.push({
                    ph,
                    nucleus: true,
                    long: ph.includes("ː") || /[ᶤᶦᶷᵘ]/.test(ph),
                });
                i += key.length;
                continue;
            }
            // ⟨w⟩ and ⟨i⟩ are CONSONANTS (/w/, /j/) before a vowel letter (wedi → wɛdi, iaith → jaᶦθ). ⟨w⟩ also
            // stays a consonant in the ⟨gw⟩ onset (gwlad → ɡwlaːd, gwr → ɡwr) — keyed on the previous SEGMENT
            // being ɡ, NOT the raw ⟨g⟩, which would also match the ɡ of a ⟨ng⟩→ŋ digraph and wrongly consonantize
            // a nuclear ⟨w⟩ (llongwr → ɬɔŋʊr, dwr → dʊr keep ⟨w⟩ as the vowel).
            const prevSeg = segs[segs.length - 1];
            if (
                c === "w" &&
                (isVowelLetter(w[i + 1] ?? "") || prevSeg?.ph === "ɡ")
            ) {
                segs.push({ ph: "w", nucleus: false });
                i += 1;
                continue;
            }
            if (c === "i" && isVowelLetter(w[i + 1] ?? "")) {
                segs.push({ ph: "j", nucleus: false });
                i += 1;
                continue;
            }
            if (c === "y") {
                // obscure ə (a clitic word, or a later vowel exists → non-final) vs clear ɨ (final syllable)
                const clear = !obscureWord && !vowelAfter(w, i + 1);
                segs.push({ ph: clear ? "ɨ" : "ə", nucleus: true });
                i += 1;
                continue;
            }
            const ph = MANIFEST.vowels[c] ?? c; // single vowel (incl. circumflex/diaeresis)
            segs.push({ ph, nucleus: true, long: ph.includes("ː") });
            i += 1;
            continue;
        }

        // --- single consonants ---
        if (CONSONANTS[c]) segs.push({ ph: CONSONANTS[c]!, nucleus: false });
        else if (/[a-z]/.test(c)) segs.push({ ph: c, nucleus: false }); // unknown letter: pass through
        // apostrophe / hyphen / punctuation: skip
        i += 1;
    }
    return segs;
}
