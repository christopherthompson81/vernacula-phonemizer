/**
 * Sinhala (si) phonemizer — canonical IPA, espeak-independent. The systematic abugida parsing is done by the
 * shared core/abugida.ts (sinhala.jsonc); Sinhala-specifics are a post-pass: homorganic anusvara ං (velar/h→ŋ,
 * palatal→ɲ, retroflex→n, else→m; pre-rewritten to a nasal-coda letter), geminate C→Cː, coda/final ව→w, the
 * inherent-vowel schwa alternation (a in the first syllable of a polysyllable, else ə), and initial stress with
 * ˌ on even non-final nuclei. Shim-parity (espeak ships si). See docs/si_native_bringup_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import { makeAbugidaG2P } from "../../core/abugida.ts";
import { loadSharedPhonology } from "../../core/phonology.ts";
import { numberToWords } from "./numbers.ts";
import { MANIFEST } from "./manifest.ts";

const GEMINATE = /(t͡ʃ|d͡ʒ|t̪|d̪|ʂ|ʃ|[pbʈɖkɡmnŋɲlshjʋrf])\1/gu; // aspirates stay doubled (ඛ්ඛ→kʰkʰ)
const VOWEL_G = /aᶦ|aᶷ|aː|æː|iː|uː|eː|oː|[aæiueoə]/gu; // vowel units, in longest-first order

let G2P: ((w: string) => string) | undefined;
function g2p(word: string): string {
  if (G2P === undefined) G2P = makeAbugidaG2P(MANIFEST, loadSharedPhonology());
  return G2P(word);
}

/** Reduce inherent/independent short 'a' to schwa 'ə': the first vowel keeps 'a' unless it is the very end of
 *  the word (an open monosyllable like ක→kə); every later short 'a' → ə. */
function applySchwa(ipa: string): string {
  let out = "", i = 0, vi = -1;
  for (const m of ipa.matchAll(VOWEL_G)) {
    out += ipa.slice(i, m.index); vi++;
    if (m[0] === "a") { const atEnd = m.index + 1 === ipa.length; out += (vi === 0 && !atEnd) ? "a" : "ə"; }
    else out += m[0];
    i = m.index + m[0].length;
  }
  return out + ipa.slice(i);
}

// Anusvara ං is a homorganic nasal set by the FOLLOWING consonant (velar/h → ŋ, palatal → ɲ, retroflex → n,
// else → m). The class table is DATA (sinhala.jsonc); here it is expanded to a per-letter nasal-coda map.
const NASAL_CODA: Record<string, string> = {};
for (const cls of MANIFEST.anusvara.classes) for (const c of cls.triggers) NASAL_CODA[c] = cls.nasal;
/** Rewrite each ං to its homorganic nasal coda (default ම් = m). */
function anusvara(word: string): string {
  return word.replace(/ං(.?)/gu, (_m, nxt: string) => (NASAL_CODA[nxt] ?? MANIFEST.anusvara.default) + nxt);
}

/** One Sinhala word → canonical IPA (abugida core + anusvara + geminate + schwa + initial stress). */
export function phonemizeWord(word: string): string {
  let ipa = applySchwa(g2p(anusvara(word)).replace(GEMINATE, "$1ː"));
  ipa = ipa.replace(/ʋ(?![aæeiouəːᶦᶷ])/gu, "w"); // a coda ව් (ʋ not before a vowel) → glide w (නිව්ටන්→niwʈən)
  ipa = ipa.replace(/ʋː[aə]?$/u, "wː"); // a word-final geminate ව්ව → wː (පව්ව→pawː)
  ipa = ipa.replace(/ʋ[aə]?$/u, "w"); // a word-final ව with its inherent vowel → w (බව→baw)
  // Stress: ˈ on the first vowel; ˌ on even nucleus indices ≥2 EXCEPT the last nucleus.
  const nuclei = [...ipa.matchAll(VOWEL_G)];
  let out = "", i = 0;
  for (let vi = 0; vi < nuclei.length; vi++) {
    const m = nuclei[vi]!;
    out += ipa.slice(i, m.index);
    out += (vi === 0 ? "ˈ" : (vi >= 2 && vi % 2 === 0 && vi !== nuclei.length - 1 ? "ˌ" : "")) + m[0];
    i = m.index! + m[0].length;
  }
  return out + ipa.slice(i);
}

const CLAUSE_MARK = MANIFEST.clausePunctuation;
const TOKEN = /([඀-෿]+)|(\d+)|([.!?…,;:])/gu;

class SinhalaPhonemizer implements Phonemizer {
  text(input: string): string {
    let out = "", pending: string | null = null;
    const emit = (ipa: string): void => {
      if (ipa === "") return;
      if (out === "") out = ipa;
      else if (pending !== null) { out += ` ${pending} ${ipa}`; pending = null; }
      else out += ` ${ipa}`;
    };
    for (const m of input.matchAll(TOKEN)) {
      if (m[1]) emit(phonemizeWord(m[1]));
      else if (m[2]) for (const wd of numberToWords(Number(m[2])).split(" ")) emit(phonemizeWord(wd));
      else if (m[3]) { const mk = CLAUSE_MARK[m[3]]; if (mk && out !== "") pending = mk; }
    }
    if (pending !== null && out !== "") out += ` ${pending}`;
    return out;
  }
}
export function createSinhala(): Phonemizer { return new SinhalaPhonemizer(); }
