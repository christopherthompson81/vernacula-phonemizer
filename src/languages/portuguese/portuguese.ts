/**
 * European Portuguese (pt-PT) phonemizer — canonical IPA, espeak-independent. Rule-based g2p (g2p.ts) →
 * stress pass → the EP vowel-REDUCTION pass (unstressed a→ɐ, e→ɨ, o→u) → sibilant voicing. text() tokenizes
 * words / numbers / punctuation. No lexicon (yet). See docs/pt_native_bringup_investigation.md.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { Phonemizer } from "../../registry.ts";
import { sibilants, toSegments, type Seg } from "./g2p.ts";
import { numberToWords } from "./numbers.ts";

// Lexical CORRECTION table (Approach A): the engine gets reduction/stress/glides right on its own; the lexicon
// only patches the two genuinely-lexical axes it cannot predict — the STRESSED mid-vowel quality (open ɛ/ɔ vs
// the close e/o default) and grapheme x (s/z/ks vs the ʃ default). Derived from wikipron EP (tools/pt-gen-
// lexicon.mts). Row: word<TAB>code, code ∈ { "ɛ", "ɔ", "x:s", "x:z", "x:ks" }, "|"-joined if both apply.
export interface Corr { open?: "ɛ" | "ɔ"; x?: string; initE?: string }
let LEXICON: Map<string, Corr> | undefined;
function lexicon(): Map<string, Corr> {
  if (LEXICON === undefined) {
    LEXICON = new Map();
    const path = join(dirname(fileURLToPath(import.meta.url)), "lexicon.tsv");
    let text = "";
    try { text = readFileSync(path, "utf8"); } catch { text = ""; } // absent lexicon → pure rule engine
    for (const line of text.split(/\r?\n/)) {
      if (line === "" || line.startsWith("#")) continue;
      const tab = line.indexOf("\t");
      if (tab < 0) continue;
      const corr: Corr = {};
      for (const code of line.slice(tab + 1).split("|")) {
        if (code === "ɛ" || code === "ɔ") corr.open = code;
        else if (code.startsWith("x:")) corr.x = code.slice(2);
        else if (code.startsWith("e:")) corr.initE = code.slice(2);   // word-initial e is e/ɛ (not the i default)
      }
      LEXICON.set(line.slice(0, tab), corr);
    }
  }
  return LEXICON;
}

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
    if (s.nucleus && i !== stress && !s.nasal && !diphthong && s.raw) {
      // word-initial unstressed e → i (está → iʃta, emérico → imɛɾiku), the EP raising; else the usual reduction.
      ph = i === 0 && s.raw === "e" ? "i" : (REDUCE[s.raw] ?? ph);
    }
    if (s.nasal && s.nucleus) ph = NASAL[ph] ?? ph;
    if (i === stress) out += "ˈ";
    out += ph;
  }
  return out;
}

/** Apply a lexical correction: open the stressed mid vowel (e→ɛ / o→ɔ) and/or override grapheme x. */
function correct(segs: Seg[], stress: number, corr: Corr): void {
  if (corr.open && segs[stress]) {
    const close = corr.open === "ɛ" ? "e" : "o";
    if (segs[stress]!.ph === close) segs[stress]!.ph = corr.open;
  }
  if (corr.x) for (const s of segs) if (s.raw === "x") s.ph = corr.x;
  // Word-initial e realizes as e/ɛ, overriding the default i-raising: raw="" so realize leaves ph untouched.
  if (corr.initE && segs[0] && segs[0]!.nucleus && segs[0]!.raw === "e") { segs[0]!.ph = corr.initE; segs[0]!.raw = ""; }
}

/** Core: EP word → canonical IPA, applying an explicit correction (used by the lexicon and its generator). */
export function renderWord(word: string, corr?: Corr): string {
  const segs = toSegments(word);
  if (segs.length === 0) return "";
  sibilants(segs);
  const stress = stressedNucleus(word, segs);
  onglides(segs, stress);
  if (corr) correct(segs, stress, corr);
  return realize(segs, stress);
}

/** One EP word → canonical IPA: rule engine + the lexical correction table (open/close vowels, x). */
export function phonemizeWord(word: string): string {
  return renderWord(word, lexicon().get(word.toLowerCase()));
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
