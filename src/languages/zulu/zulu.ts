/**
 * Zulu (zu) phonemizer — canonical IPA, espeak-independent and AUTHORED beyond-espeak. Rule g2p (g2p.ts) +
 * Nguni penultimate stress with vowel LENGTHENING (the penult vowel takes ˈ and ː) + a lexical TONE overlay.
 * Zulu tone is not derivable from spelling, so it is overlaid from tone.tsv (kaikki/Wiktionary-derived, one
 * H/L/F/R code per vowel nucleus, placed after the vowel and its length); out-of-lexicon words are left untoned.
 * See docs/zu_native_bringup_investigation.md.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { Phonemizer } from "../../registry.ts";
import { toSegments } from "./g2p.ts";
import { numberToWords } from "./numbers.ts";

const TONE_CHAO: Record<string, string> = { H: "˥", L: "˩", F: "˥˩", R: "˩˥" };

// Tone lexicon: word → per-vowel tone codes (H/L/F/R). Out-of-lexicon words are left untoned.
let TONE: Map<string, string> | undefined;
function toneLexicon(): Map<string, string> {
  if (TONE === undefined) {
    TONE = new Map();
    try {
      const path = join(dirname(fileURLToPath(import.meta.url)), "tone.tsv");
      for (const line of readFileSync(path, "utf8").split("\n")) {
        if (line === "" || line.startsWith("#")) continue;
        const tab = line.indexOf("\t");
        if (tab > 0) TONE.set(line.slice(0, tab), line.slice(tab + 1).trim());
      }
    } catch { /* absent → all untoned */ }
  }
  return TONE;
}

const SPLIT = /(?<=.)(?=[A-Z][a-z])/u; // compound boundary: before an internal Titlecase run

/** Phonemize a (possibly camelCase-compound) Zulu word to an array of IPA words. A compound whose FULL form is
 *  in the tone lexicon (isingisi→HLHL) threads those codes across its split parts, since espeak overlays the
 *  compound's tone across the whole word even though it splits on the internal capital. */
export function phonemizeCompound(word: string): string[] {
  const parts = word.split(SPLIT);
  if (parts.length === 1) return [phonemizeWord(word)];
  // espeak tones only whole-word lexicon hits: if the full compound isn't listed, the whole word is untoned
  // (isiTsonga → untoned, even though standalone "isi" carries tone).
  const codes = toneLexicon().get(word.toLowerCase());
  if (codes === undefined) return parts.map((p) => phonemizeWord(p, ""));
  const out: string[] = [];
  let ci = 0;
  for (const p of parts) {
    const nv = toSegments(p).filter((s) => s.v).length;
    out.push(phonemizeWord(p, codes.slice(ci, ci + nv)));
    ci += nv;
  }
  return out;
}

/** One Zulu word → canonical IPA: segments + penultimate stress/length + lexical tone overlay. */
export function phonemizeWord(word: string, toneCodes?: string): string {
  const segs = toSegments(word);
  const vowelIdx = segs.map((s, i) => (s.v ? i : -1)).filter((i) => i >= 0);
  if (vowelIdx.length === 0) return segs.map((s) => s.ph).join("");
  // Nguni penultimate stress: ˈ + ː on the penult vowel (the only vowel if monosyllabic).
  const stressIdx = vowelIdx.length >= 2 ? vowelIdx[vowelIdx.length - 2]! : vowelIdx[0]!;
  const codes = toneCodes ?? toneLexicon().get(word.toLowerCase()) ?? "";
  let out = "", vi = 0;
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i]!;
    if (s.v) {
      if (i === stressIdx) out += `ˈ${s.ph}ː`; else out += s.ph;
      out += TONE_CHAO[codes[vi] ?? ""] ?? ""; // tone after the vowel (and its length)
      vi++;
    } else out += s.ph;
  }
  return out;
}

const CLAUSE_MARK: Record<string, string> = { ".": ".", "!": "!", "?": "?", "…": ",", ",": ",", ";": ",", ":": "," };
const TOKEN = /([A-Za-z]+)|(\d+)|([.!?…,;:])/gu;

class ZuluPhonemizer implements Phonemizer {
  text(input: string): string {
    let out = "", pending: string | null = null;
    const emit = (ipa: string): void => {
      if (ipa === "") return;
      if (out === "") out = ipa;
      else if (pending !== null) { out += ` ${pending} ${ipa}`; pending = null; }
      else out += ` ${ipa}`;
    };
    for (const m of input.matchAll(TOKEN)) {
      // Compound (noun-class prefix + Titlecase stem, eNingizimu / INingizimu) splits before an internal
      // Titlecase run; a full-word tone-lexicon hit is threaded across the parts.
      if (m[1]) for (const part of phonemizeCompound(m[1])) emit(part);
      else if (m[2]) for (const wd of numberToWords(Number(m[2])).split(" ")) emit(phonemizeWord(wd, "")); // numbers are untoned
      else if (m[3]) { const mk = CLAUSE_MARK[m[3]]; if (mk && out !== "") pending = mk; }
    }
    if (pending !== null && out !== "") out += ` ${pending}`;
    return out;
  }
}
export function createZulu(): Phonemizer { return new ZuluPhonemizer(); }
