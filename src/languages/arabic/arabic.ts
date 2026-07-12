/**
 * Arabic (ar) phonemizer — canonical IPA (Modern Standard Arabic, broad phonemic), espeak-independent.
 * Diacritized g2p (g2p.ts) + quantity-sensitive stress. Phase 1 assumes vowelled input; a neural diacritizer
 * pre-pass (permissively-sourced) will restore short vowels for bare text in Phase 2.
 */
import { toSegments, type Seg } from "./g2p.ts";

const isLongNucleus = (ph: string): boolean => /ː/.test(ph) || ph === "aj" || ph === "aw" || /[aiu]n$/.test(ph);

/**
 * MSA quantity-sensitive stress. Syllabify (each vowel = a nucleus; a consonant between two vowels is the
 * next onset, so a syllable is closed only when ≥2 consonants follow / a trailing consonant at word end).
 * Stress: final if superheavy (CVVC/CVCC); else the last non-final heavy syllable within the last three;
 * else the first syllable.
 */
function stressedNucleus(segs: Seg[]): number {
  const nuclei = segs.map((s, i) => (s.vowel ? i : -1)).filter((i) => i >= 0);
  if (nuclei.length <= 1) return nuclei[0] ?? -1;

  const heavy: boolean[] = [], superheavy: boolean[] = [];
  nuclei.forEach((vi, k) => {
    const long = isLongNucleus(segs[vi]!.ph);
    const end = k === nuclei.length - 1 ? segs.length : nuclei[k + 1]!;
    let consAfter = 0;
    for (let j = vi + 1; j < end; j++) if (!segs[j]!.vowel) consAfter += geminated(segs, j) ? 2 : 1;
    const coda = k === nuclei.length - 1 ? consAfter >= 1 : consAfter >= 2;
    heavy[k] = long || coda;
    superheavy[k] = (long && coda) || consAfter >= 2;
  });

  const last = nuclei.length - 1;
  if (superheavy[last]) return nuclei[last]!;                  // ultima superheavy (CVːC/CVCC) → ultima
  if (heavy[last]) return nuclei[last - 1]!;                   // ultima heavy (CVV/CVC) → penult
  if (heavy[last - 1]) return nuclei[last - 1]!;               // ultima light, penult heavy → penult
  if (last >= 2 && !heavy[last - 2]) return nuclei[last - 2]!; // all light + antepenult light → antepenult
  return nuclei[last - 1]!;                                    // else (antepenult heavy) → penult
}

/** Is the consonant seg at index j a geminate (rendered Cː) — it fills both coda and following onset. */
function geminated(segs: Seg[], j: number): boolean {
  return /ː$/.test(segs[j]!.ph);
}

/** Phonemize a single diacritized Arabic word to canonical IPA (with a stress mark). */
export function phonemizeWord(word: string): string {
  const segs = toSegments(word);
  if (segs.length === 0) return "";
  const stress = stressedNucleus(segs);
  let out = "";
  for (let i = 0; i < segs.length; i++) {
    if (i === stress) out += "ˈ";
    out += segs[i]!.ph;
  }
  return out;
}
