/**
 * Weight-based (quantity-sensitive) word stress — GENERAL, not abugida-specific: pure IPA-string in/out,
 * script-agnostic. `tokenizeIpa` splits any IPA string into C/V units; `applyWeightStress` places stress
 * from syllable WEIGHT. This is the Latin/Arabic/Indic quantity-sensitive stress family; Hindi is just the
 * first consumer (see the examples below). Reusable by any native language with quantity-sensitive stress.
 *
 * Weight rule (Hayes/Pandey): syllable weights are Light (short open V),
 * Heavy (long/nasal V, or short V + coda), Superheavy (long/nasal V + coda). Primary stress goes to
 * the RIGHTMOST superheavy syllable; else the rightmost NON-FINAL heavy (the final syllable is
 * extrametrical); else the first syllable. Verified against the espeak-derived hi output across
 * light/heavy/superheavy shapes (सरकार final-superheavy stressed; नमस्ते penult-heavy, final CVː skipped).
 */

import { ATTACHING_MODIFIERS, COMBINING_DIACRITICS, IPA_VOWELS, STRESS_PRIMARY, TIE_BAR } from "./unicode.ts";

// Regexes built from the notation-primitive lists (src/Phonemize/native/unicode.ts) — the list is the
// single source, the pattern is derived. VOWEL = syllable nuclei; MOD = trailing modifiers that attach
// to the preceding unit (spacing modifiers ː ˑ ʲ ʰ ʱ ʼ + any combining diacritic, so t̪/d̪/n̪ stay ONE token).
const VOWEL = new RegExp(`[${IPA_VOWELS}]`);
const MOD = new RegExp(`[${ATTACHING_MODIFIERS}${COMBINING_DIACRITICS}]`);

/** Tokenize an IPA string into consonant/vowel units (ties + modifiers stay attached). */
export function tokenizeIpa(ipa: string): string[] {
  // NFD so combining marks (nasal ◌̃, dental ◌̪) are separate → attach to their base vowel/consonant
  // as MOD, and a precomposed nasal vowel (ẽ) is recognised as a vowel (base e).
  const s = [...ipa.normalize("NFD")];
  const out: string[] = [];
  for (let i = 0; i < s.length;) {
    let t = s[i]!; i++;
    while (i < s.length && (MOD.test(s[i]!) || s[i] === TIE_BAR)) {
      t += s[i]!;
      if (s[i] === TIE_BAR && i + 1 < s.length) { i++; t += s[i]!; }
      i++;
    }
    out.push(t);
  }
  return out;
}

const isVowel = (tok: string): boolean => VOWEL.test(tok[0]!);

/** Insert the primary-stress mark ˈ before the onset of the weight-selected syllable. */
export function applyWeightStress(ipa: string): string {
  const T = tokenizeIpa(ipa);
  const nuclei: number[] = [];
  T.forEach((t, k) => { if (isVowel(t)) nuclei.push(k); });
  if (nuclei.length === 0) return ipa;

  // Syllable onset = the single consonant immediately before the nucleus (belongs to THIS syllable);
  // any earlier consonants since the previous nucleus are the previous syllable's coda.
  const onset = (si: number): number => {
    const v = nuclei[si]!;
    const prevV = si > 0 ? nuclei[si - 1]! : -1;
    return v > prevV + 1 && !isVowel(T[v - 1]!) ? v - 1 : v;
  };
  // Coda count of syllable si = consonants between this nucleus and the next syllable's onset.
  const coda = (si: number): number => {
    const v = nuclei[si]!;
    const end = si + 1 < nuclei.length ? onset(si + 1) : T.length;
    return end - v - 1;
  };
  const weight = (si: number): "L" | "H" | "S" => {
    const longNas = /[ː̃]/.test(T[nuclei[si]!]!);
    const c = coda(si);
    if ((longNas && c >= 1) || (!longNas && c >= 2)) return "S";
    if (longNas || c >= 1) return "H";
    return "L";
  };

  // The stress mark is placed before the NUCLEUS (vowel), matching the espeak/fleet convention
  // (kˈiː, not the standard-IPA before-onset ˈkiː) so native output is fleet-consistent. `onset` is
  // retained for syllable-weight bookkeeping only.
  void onset;
  if (nuclei.length === 1) return mark(T, nuclei[0]!);

  let target = -1;
  for (let si = nuclei.length - 1; si >= 0; si--) if (weight(si) === "S") { target = si; break; }
  if (target < 0) for (let si = nuclei.length - 2; si >= 0; si--) if (weight(si) === "H") { target = si; break; }
  if (target < 0) target = 0;
  return mark(T, nuclei[target]!);
}

function mark(T: string[], idx: number): string {
  return T.slice(0, idx).join("") + STRESS_PRIMARY + T.slice(idx).join("");
}
