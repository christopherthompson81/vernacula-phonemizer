/**
 * English-native canonical converter: CMUdict ARPABET → canonical IPA (the en divestment convention).
 * Cleanroom GenAm allophony (flapping, aspiration, dark-l, offglides, weak-vowel ᵻ, reduction), before-
 * nucleus stress. This is the single source of truth for the en canonical convention: the compile-time
 * pronunciation-lexicon build (build-en-cmudict.ts) and the runtime OOV G2P (englishG2p.ts) both use it,
 * so dict words and G2P'd words share one convention with no seam.
 */

/** The ARPABET→IPA correspondence DATA (from english.jsonc's `arpabet` block). The allophony ALGORITHM
 *  below reads these values; a different English variety supplies its own `map` / `conditionalVowels`. */
export interface ArpabetDef {
  /** ARPABET phone → IPA: consonants + simple (unconditional) vowels. */
  map: Record<string, string>;
  /** Vowels resolved by stress (AH, ER) or a following R (IY, UW). */
  conditionalVowels: {
    AH: { unstressed: string; stressed: string };
    ER: { unstressed: string; stressed: string };
    IY: { beforeR: string; unstressed: string; stressed: string };
    UW: { beforeR: string; default: string };
  };
}

/** The ARPABET vowel bases — a fixed property of the notation (variety-independent), so the engine owns it. */
const VOWELS = new Set(["AA", "AE", "AH", "AO", "AW", "AY", "EH", "ER", "EY", "IH", "IY", "OW", "OY", "UH", "UW"]);

/** One CMUdict phone (e.g. "AH0", "T", "ER1") → {base, stress}. */
function split(phone: string): { base: string; stress: number } {
  const m = /^([A-Z]+)([0-2])?$/.exec(phone);
  return { base: m?.[1] ?? phone, stress: m?.[2] ? Number(m[2]) : -1 };
}

/** Should this unstressed vowel-phone at index `vi` (nucleus number `ni`) surface as the weak vowel ᵻ?
 *  Cleanroom weak-vowel-merger rule from the WORD's morphology (public GenAm phonology, no espeak). */
function isBarredI(word: string, P: { base: string; stress: number }[], vi: number, ni: number, nucleiCount: number): boolean {
  const { base, stress } = P[vi]!;
  if (stress > 0 || (base !== "IH" && base !== "AH")) return false;
  // -ed / -ted / -ded after an alveolar stop (started, wanted, united, decided → ᵻd)
  if (/(ed|es)$/.test(word) && ni === nucleiCount - 1 && vi + 1 < P.length && vi > 0
    && (P[vi - 1]!.base === "T" || P[vi - 1]!.base === "D")) return true;
  // -ity/-ety/-ities/-ility (university, quality, security → ᵻti); the vowel before the final -t- cluster
  if (/(it|iti|ities|ety|ities)y?$/.test(word) && P[vi + 1] && P[vi + 1]!.base === "T") return true;
  // -ible (possible → ᵻbəl)
  if (/ibl[ey]?$/.test(word) && vi + 1 < P.length && P[vi + 1]!.base === "B") return true;
  // Latinate reduced prefix be/de/re/se/pre + consonant (believe, decide, review, security → ᵻ)
  if (ni === 0 && /^(be|de|re|se|pre)[^aeiouy]/.test(word)) return true;
  return false;
}

/** Build the ARPABET→IPA converter from a correspondence def. The allophony (flap/aspirate/dark-l/ŋ/ʲ,
 *  stress marking, weak-vowel merger) is the shared engine; `def` supplies the variety-specific IPA values. */
export function makeArpabetToIpa(def: ArpabetDef): (phones: string[], word?: string) => string {
  const { map, conditionalVowels: cv } = def;
  /** Convert a CMUdict ARPABET phone list → canonical IPA (before-nucleus stress + cleanroom GenAm allophony). */
  return function arpabetToIpa(phones: string[], word = ""): string {
  const P = phones.map(split);
  const nucleiIdx = P.map((p, i) => (VOWELS.has(p.base) ? i : -1)).filter((i) => i >= 0);
  const nucleusNum = new Map(nucleiIdx.map((vi, ni) => [vi, ni]));
  const primaryNi = nucleiIdx.findIndex((vi) => P[vi]!.stress === 1);
  let out = "";
  for (let i = 0; i < P.length; i++) {
    const { base, stress } = P[i]!;
    const nextIsR = i + 1 < P.length && P[i + 1]!.base === "R";
    const nextIsV = i + 1 < P.length && VOWELS.has(P[i + 1]!.base);
    if (VOWELS.has(base)) {
      const ni = nucleusNum.get(i)!;
      // Secondary-stress clash: drop a 2° whose syllable is ADJACENT (consecutive nucleus) to the 1°.
      let mark = stress === 1 ? "ˈ" : stress === 2 ? "ˌ" : "";
      if (stress === 2 && primaryNi >= 0 && Math.abs(ni - primaryNi) === 1) mark = "";
      out += mark;
      if (base === "AH" && isBarredI(word, P, i, ni, nucleiIdx.length)) out += "ᵻ";
      else if (base === "IH" && isBarredI(word, P, i, ni, nucleiIdx.length)) out += "ᵻ";
      else if (base === "AH") out += stress <= 0 ? cv.AH.unstressed : cv.AH.stressed;
      else if (base === "ER") out += stress <= 0 ? cv.ER.unstressed : cv.ER.stressed;
      else if (base === "IY") out += nextIsR ? cv.IY.beforeR : (stress <= 0 ? cv.IY.unstressed : cv.IY.stressed);
      else if (base === "UW") out += nextIsR ? cv.UW.beforeR : cv.UW.default;
      else out += map[base] ?? base;
      // ʲ-glide hiatus: a high front nucleus (i/iː) directly before another vowel inserts ʲ.
      if ((base === "IY") && nextIsV) out += "ʲ";
      continue;
    }
    if (base === "N" && i + 1 < P.length && (P[i + 1]!.base === "K" || P[i + 1]!.base === "G")) { out += "ŋ"; continue; }
    // FLAP (mined t:V_V0=ɾ79 / d:V_V0=ɾ64): t/d intervocalic before a NON-primary vowel → voiced flap.
    if ((base === "T" || base === "D") && i > 0 && i + 1 < P.length) {
      const prev = P[i - 1]!, next = P[i + 1]!;
      if ((VOWELS.has(prev.base) || prev.base === "R") && VOWELS.has(next.base) && next.stress !== 1) {
        out += base === "T" ? "t̬" : "d̬"; continue;
      }
    }
    // ASPIRATE (mined #_V1=ʰ~75, NOT after /s/): p/t/k at a syllable onset before a STRESSED vowel.
    if (base === "P" || base === "T" || base === "K") {
      const prevBase = i > 0 ? P[i - 1]!.base : "#";
      const next = i + 1 < P.length ? P[i + 1]! : null;
      const onset = i === 0 || VOWELS.has(prevBase);       // word-initial or after a vowel (starts a syllable)
      if (prevBase !== "S" && onset && next && VOWELS.has(next.base) && next.stress >= 1) {
        out += base === "P" ? "pʰ" : base === "T" ? "tʰ" : "kʰ"; continue;
      }
    }
    // DARK-L (mined coda l→ɫ): l is velarized in the coda (before a consonant or word-finally).
    if (base === "L" && !(i + 1 < P.length && VOWELS.has(P[i + 1]!.base))) { out += "ɫ"; continue; }
    out += map[base] ?? base;
  }
  return out;
  };
}
