/**
 * Loads the consolidated Arabic data manifest (arabic.jsonc) once at module init and exposes it typed. The
 * hand-authored DATA tables (consonant map, sun letters, proclitics, clause punctuation, number words, and the
 * diacritizer's label / defective-spelling tables) live in the JSONC; the ALGORITHMS that consume them stay in
 * the sibling modules (g2p.ts, numbers.ts, diacritizer.ts, arabic.ts).
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export interface ArabicManifest {
  marks: {
    fatha: string; kasra: string; damma: string; sukun: string; shadda: string;
    fathatan: string; kasratan: string; dammatan: string; daggerAlif: string;
  };
  letters: { alif: string; alifMaqsura: string; alifMadda: string; taaMarbuta: string; waw: string; ya: string };
  consonants: Record<string, string>;
  sunLetters: string[];
  proclitics: Record<string, string>;
  clausePunctuation: Record<string, string>;
  numbers: {
    ones: string[];
    teens: string[];
    tens: string[];
    hundredsConstruct: string[];
    connector: string;
    magnitudes: {
      hundred: string; hundredDual: string;
      thousand: string; thousandDual: string; thousandsPlural: string;
      million: string; millionDual: string; millionsPlural: string;
    };
  };
  diacritizer: {
    labelMarks: Record<string, string>;
    defectiveSpelling: Record<string, string>;
  };
}

const dir = dirname(fileURLToPath(import.meta.url));
const raw = readFileSync(join(dir, "arabic.jsonc"), "utf8").replace(/^\s*\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");

/** The consolidated hand-authored Arabic data tables (see arabic.jsonc). */
export const MANIFEST = JSON.parse(raw) as ArabicManifest;
