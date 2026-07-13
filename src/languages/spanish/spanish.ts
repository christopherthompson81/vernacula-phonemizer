/**
 * Spanish (es) phonemizer — canonical IPA, broad Castilian, espeak-independent. Rule-based g2p (g2p.ts) +
 * spirantization + rule-based stress; no lexicon. text() tokenizes words / numbers / punctuation.
 */
import type { Phonemizer } from "../../registry.ts";
import { toSegments, type Seg } from "./g2p.ts";
import { numberToWords } from "./numbers.ts";
import { MANIFEST } from "./manifest.ts";

const NASALS = new Set(MANIFEST.nasals);
const STOP_TO_FRIC = MANIFEST.spirantize;
const FINAL_VOWEL = /[aeiouáéíóú]$/i;

/** b/d/ɡ → β/ð/ɣ except utterance-initial, after a nasal, or d after l. (Nasal place assimilation n→ŋ is
 *  narrow allophony left broad here — like the folded e→ɛ laxing — matching the broad referees.) */
function spirantize(segs: Seg[]): void {
  for (let i = 0; i < segs.length; i++) {
    const ph = segs[i]!.ph;
    const fric = STOP_TO_FRIC[ph];
    if (fric === undefined) continue;
    const prev = i > 0 ? segs[i - 1]!.ph : "";
    const stop = i === 0 || NASALS.has(prev) || (ph === "d" && prev === "l");
    if (!stop) segs[i]!.ph = fric;
  }
}

/** Index of the stressed nucleus: the written accent, else penultimate (word ends vowel/n/s) or final. */
function stressedNucleus(word: string, segs: Seg[]): number {
  const nuclei = segs.map((s, i) => (s.nucleus ? i : -1)).filter((i) => i >= 0);
  if (nuclei.length === 0) return -1;
  const accented = nuclei.find((i) => segs[i]!.accent);
  if (accented !== undefined) return accented;
  if (nuclei.length === 1) return nuclei[0]!;
  const w = word.toLowerCase();                          // n/s test must be case-insensitive (EXAMEN, CRISIS)
  const last = w[w.length - 1] ?? "";
  const penult = FINAL_VOWEL.test(w) || last === "n" || last === "s";
  return penult ? nuclei[nuclei.length - 2]! : nuclei[nuclei.length - 1]!;
}

/** Phonemize a single Spanish word to canonical IPA (with a stress mark). */
export function phonemizeWord(word: string): string {
  const segs = toSegments(word);
  if (segs.length === 0) return "";
  spirantize(segs);
  const stress = stressedNucleus(word, segs);
  let out = "";
  for (let i = 0; i < segs.length; i++) {
    if (i === stress) out += "ˈ";
    out += segs[i]!.ph;
  }
  return out;
}

const CLAUSE_MARK = MANIFEST.clausePunctuation; // ¿¡ openers are silent → absent from the map
// A word / number / clause-punctuation token. Numbers use the Spanish convention: dot = thousands separator
// (1.500), comma = decimal (3,14). Each dot/comma must be followed by digits, so a clause-final "." or ","
// glued to a number falls through to the punctuation branch. Spanish letters incl. accents + ñ/ü.
const TOKEN = /([a-záéíóúüñ]+)|(\d+(?:\.\d+)*(?:,\d+)?)|([.!?…,;:])/giu;

/** A number token (with Spanish thousands-dots / decimal-comma) → spoken words. */
function numberTokenToWords(tok: string): string {
  const [intRaw, frac] = tok.split(",");
  let words = numberToWords(Number(intRaw!.replace(/\./g, "")));
  if (frac !== undefined) words += ` ${MANIFEST.numbers.decimalConnector} ` + [...frac].map((d) => numberToWords(Number(d))).join(" ");
  return words;
}
// Unstressed monosyllabic clitics (articles, prepositions, conjunctions, clitic pronouns) — de-accented in
// running text (DATA: spanish.jsonc). Accented counterparts (sí, tú, mí, más) keep their accent and stay stressed.
const FUNCTION_WORDS = new Set(MANIFEST.functionWords);

/** Phonemize one running-text word, de-accenting unstressed function words (y → i, de → de). */
function wordIpa(word: string): string {
  const ipa = phonemizeWord(word);
  return FUNCTION_WORDS.has(word.toLowerCase()) ? ipa.replace("ˈ", "") : ipa;
}

class SpanishPhonemizer implements Phonemizer {
  text(input: string): string {
    let out = "";
    let pending: string | null = null;
    const emit = (ipa: string): void => {
      if (ipa === "") return;
      if (out === "") out = ipa;
      else if (pending !== null) { out += ` ${pending} ${ipa}`; pending = null; }
      else out += ` ${ipa}`;
    };
    for (const m of input.matchAll(TOKEN)) {
      if (m[1]) emit(wordIpa(m[1]));
      else if (m[2]) emit(numberTokenToWords(m[2]).split(" ").map(wordIpa).join(" "));
      else if (m[3]) { const mk = CLAUSE_MARK[m[3]]; if (mk && out !== "") pending = mk; }
    }
    if (pending !== null && out !== "") out += ` ${pending}`;
    return out;
  }
}

/** Build the Spanish phonemizer (no data files — the engine is fully rule-based). */
export function createSpanish(): Phonemizer {
  return new SpanishPhonemizer();
}
