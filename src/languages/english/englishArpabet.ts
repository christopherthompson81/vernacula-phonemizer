/**
 * English-native canonical converter: CMUdict ARPABET → canonical IPA (the en divestment convention).
 * Cleanroom GenAm allophony (flapping, aspiration, dark-l, offglides, weak-vowel ᵻ, reduction), before-
 * nucleus stress. This is the single source of truth for the en canonical convention: the compile-time
 * pronunciation-lexicon build (build-en-cmudict.ts) and the runtime OOV G2P (englishG2p.ts) both use it,
 * so dict words and G2P'd words share one convention with no seam.
 */

// ARPABET (stressless) → IPA, in the en canonical convention. Vowels that carry stress are handled in
// arpabetToIpa(); AH is special (unstressed→ə, stressed→ʌ) and resolved there.
const ARPA_IPA: Record<string, string> = {
  AA: "ɑː", AE: "æ", AO: "ɔː", AW: "aᶷ", AY: "aᶦ", EH: "ɛ", EY: "eᶦ", IH: "ɪ", IY: "iː",
  OW: "oᶷ", OY: "ɔᶦ", UH: "ʊ", UW: "uː",
  B: "b", CH: "t͡ʃ", D: "d", DH: "ð", F: "f", G: "ɡ", HH: "h", JH: "d͡ʒ", K: "k", L: "l", M: "m",
  N: "n", NG: "ŋ", P: "p", R: "ɹ", S: "s", SH: "ʃ", T: "t", TH: "θ", V: "v", W: "w", Y: "j", Z: "z", ZH: "ʒ",
};
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

/** Convert a CMUdict ARPABET phone list → canonical IPA (before-nucleus stress + cleanroom GenAm allophony). */
export function arpabetToIpa(phones: string[], word = ""): string {
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
      else if (base === "AH") out += stress <= 0 ? "ə" : "ʌ";
      else if (base === "ER") out += stress <= 0 ? "ɚ" : "ɝ";
      else if (base === "IY") out += nextIsR ? "ɪ" : (stress <= 0 ? "i" : "iː");
      else if (base === "UW") out += nextIsR ? "ʊ" : "uː";
      else out += ARPA_IPA[base] ?? base;
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
    out += ARPA_IPA[base] ?? base;
  }
  return out;
}
