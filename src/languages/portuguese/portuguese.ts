/**
 * European Portuguese (pt-PT) phonemizer — canonical IPA, espeak-independent. Rule-based g2p (g2p.ts) →
 * stress pass → the EP vowel-REDUCTION pass (unstressed a→ɐ, e→ɨ, o→u) → sibilant voicing. text() tokenizes
 * words / numbers / punctuation. No lexicon (yet). See docs/pt_native_bringup_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import { sibilants, toSegments, type Seg } from "./g2p.ts";
import { numberToWords } from "./numbers.ts";

// Unstressed-vowel reduction (the EP signature). Nasal vowels resist it (handled separately).
const REDUCE: Record<string, string> = { a: "ɐ", e: "ɨ", o: "u", i: "i", u: "u" };
// Oral → nasal quality (stressed keeps ɛ/ɔ/e/o; reduced e/o already normalised before this map is applied).
const NASAL: Record<string, string> = { a: "ɐ̃", ɐ: "ɐ̃", e: "ẽ", ɛ: "ẽ", i: "ĩ", ɨ: "ɨ̃", o: "õ", ɔ: "õ", u: "ũ" };

/** Index of the stressed nucleus. Written accent wins; else oxytone (final nucleus) when the word — ignoring a
 *  final -s — ends in r/l/z/x, i/u, a nasal tilde vowel / diphthong, or -im/-um; else paroxytone (penult). */
function stressedNucleus(word: string, segs: Seg[]): number {
  const nuclei = segs.map((s, i) => (s.nucleus ? i : -1)).filter((i) => i >= 0);
  if (nuclei.length === 0) return -1;
  const accented = nuclei.find((i) => segs[i]!.accent);
  if (accented !== undefined) return accented;
  if (nuclei.length === 1) return nuclei[0]!;
  const w = word.toLowerCase().replace(/s$/, "");
  const last = w[w.length - 1] ?? "";
  const oxytone =
    "lrzx".includes(last) || last === "i" || last === "u" || last === "í" || last === "ú" ||
    /[ãõ]$/.test(w) || /(ão|ãe|õe)$/.test(w) || /[iu][mn]$/.test(w); // -im/-um and their -ins/-uns plurals (s already stripped)
  return oxytone ? nuclei[nuclei.length - 1]! : nuclei[nuclei.length - 2]!;
}

const isGlidePh = (ph: string): boolean => ph === "j" || ph === "w" || ph === "j̃" || ph === "w̃";

/** Post-stress onglide demotion: an UNSTRESSED high vowel (i/u) immediately before another nucleus is a rising
 *  glide, not a syllable of its own (diamante → djɐmɐ̃tɨ, água → aɡwɐ) — but a stressed one stays (dia → diɐ).
 *  Runs after stress so the count is settled; mid-vowel onglides (e/o) are left alone (moeda → muɛðɐ). */
const LIQUID = new Set(["ɾ", "l", "ʁ", "ɫ"]);
function onglides(segs: Seg[], stress: number): void {
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i]!;
    if (!s.nucleus || i === stress || (s.raw !== "i" && s.raw !== "u" && s.raw !== "e")) continue;
    const next = segs[i + 1];
    if (!next || !next.nucleus) continue;
    // A high vowel after an obstruent+liquid onset cluster stays a nucleus (criança → kɾiɐ̃sɐ, not kɾjɐ̃-).
    const p1 = segs[i - 1], p2 = segs[i - 2];
    if (p1 && p2 && LIQUID.has(p1.ph) && !p2.nucleus) continue;
    s.nucleus = false; s.ph = s.raw === "u" ? "w" : "j"; // i/e → j, u → w
  }
}

/** Realize vowels: reduce unstressed oral vowels, nasalize nasal ones, mark the stressed nucleus with ˈ. */
function realize(segs: Seg[], stress: number): string {
  let out = "";
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i]!;
    let ph = s.ph;
    const diphthong = segs[i + 1] && !segs[i + 1]!.nucleus && isGlidePh(segs[i + 1]!.ph); // nucleus + offglide
    if (s.nucleus && i !== stress && !s.nasal && !diphthong && s.raw) ph = REDUCE[s.raw] ?? ph; // reduce (not a diphthong nucleus)
    if (s.nasal && s.nucleus) ph = NASAL[ph] ?? ph;
    if (i === stress) out += "ˈ";
    out += ph;
  }
  return out;
}

/** One EP word → canonical IPA. */
export function phonemizeWord(word: string): string {
  const segs = toSegments(word);
  if (segs.length === 0) return "";
  sibilants(segs);
  const stress = stressedNucleus(word, segs);
  onglides(segs, stress);
  return realize(segs, stress);
}

const CLAUSE_MARK: Record<string, string> = { ".": ".", "!": "!", "?": "?", "…": ",", ",": ",", ";": ",", ":": "," };
// Word / number / clause-punctuation. Portuguese numbers: dot = thousands (1.500), comma = decimal (3,14).
const TOKEN = /([a-zà-ÿ]+)|(\d+(?:\.\d+)*(?:,\d+)?)|([.!?…,;:])/giu;

/** A number token (thousands-dots / decimal-comma) → spoken words. */
function numberTokenToWords(tok: string): string {
  const [intRaw, frac] = tok.split(",");
  let words = numberToWords(Number(intRaw!.replace(/\./g, "")));
  if (frac !== undefined) words += " vírgula " + [...frac].map((d) => numberToWords(Number(d))).join(" ");
  return words;
}

// Unstressed monosyllabic clitics (articles, prepositions, conjunctions, clitic pronouns) — de-stressed in
// running text.
const FUNCTION_WORDS = new Set([
  "o", "a", "os", "as", "um", "e", "ou", "que", "se", "de", "do", "da", "dos", "das", "em", "no", "na", "nos", "nas",
  "com", "por", "me", "te", "lhe", "nos", "vos", "lhes", "meu", "teu", "seu", "sua", "ao", "aos", "à",
]);

function wordIpa(word: string): string {
  const ipa = phonemizeWord(word);
  return FUNCTION_WORDS.has(word.toLowerCase()) ? ipa.replace("ˈ", "") : ipa;
}

class PortuguesePhonemizer implements Phonemizer {
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

/** Build the European Portuguese phonemizer (no data files — fully rule-based). */
export function createPortuguese(): Phonemizer {
  return new PortuguesePhonemizer();
}
