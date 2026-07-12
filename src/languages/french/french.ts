/**
 * French (fr) phonemizer — canonical IPA (standard/Parisian), espeak-independent. Primary path is a
 * pronunciation LEXICON (Lexique 3.83, ~125k forms) that carries every irregular as data; the rule-based
 * g2p (g2p.ts) is the out-of-vocabulary fallback for unseen words. text() tokenizes words / numbers /
 * punctuation; French has no lexical stress, so a single phrase-final accent marks each rhythmic group.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { Phonemizer } from "../../registry.ts";
import { toIpa } from "./g2p.ts";
import { numberToWords } from "./numbers.ts";

// Lexique 3.83 pronunciation lexicon: word → IPA for ~125k attested forms, loaded once (lazily).
let LEXICON: Map<string, string> | undefined;
function lexicon(): Map<string, string> {
  if (LEXICON === undefined) {
    LEXICON = new Map();
    const path = join(dirname(fileURLToPath(import.meta.url)), "lexicon.tsv");
    for (const line of readFileSync(path, "utf8").split("\n")) {
      if (line === "" || line.startsWith("#")) continue;
      const tab = line.indexOf("\t");
      if (tab > 0) LEXICON.set(line.slice(0, tab), line.slice(tab + 1));
    }
  }
  return LEXICON;
}

const VOWEL_IPA = /[aeiouyɛɔøœəɑ]/;

/** One French word → IPA: lexicon lookup first, then the g2p engine for out-of-vocabulary words. */
export function phonemizeWord(word: string): string {
  return lexicon().get(word.toLowerCase()) ?? toIpa(word);
}

/** Add a phrase-final accent: ˈ before the last vowel of the last IPA token (rhythmic-group stress). */
function accentFinal(tokens: string[]): void {
  for (let k = tokens.length - 1; k >= 0; k--) {
    const t = tokens[k]!;
    if (!VOWEL_IPA.test(t)) continue;
    const m = [...t.matchAll(/[aeiouyɛɔøœəɑ]/g)];
    const last = m[m.length - 1]!;
    tokens[k] = t.slice(0, last.index) + "ˈ" + t.slice(last.index);
    return;
  }
}

const CLAUSE_MARK: Record<string, string> = { ".": ".", "!": "!", "?": "?", "…": ",", ",": ",", ";": ",", ":": "," };
const TOKEN = /([a-zà-ÿœæ]+(?:['’][a-zà-ÿœæ]+)?)|(\d+(?:[.,]\d+)?)|([.!?…,;:])/giu;

class FrenchPhonemizer implements Phonemizer {
  constructor(private readonly foreign?: (latin: string) => string) {}

  text(input: string): string {
    let group: string[] = [];        // IPA tokens of the current rhythmic group (until a pause)
    let out = "";
    const flush = (pause: string | null): void => {
      if (group.length) { accentFinal(group); out += (out ? " " : "") + group.join(" "); group = []; }
      if (pause) out += ` ${pause}`;
    };
    const add = (word: string): void => { const ipa = phonemizeWord(word); if (ipa) group.push(ipa); }; // skip empties
    for (const m of input.matchAll(TOKEN)) {
      if (m[1]) add(m[1]);
      else if (m[2]) {
        const [intPart, frac] = m[2].split(/[.,]/);
        for (const w of numberToWords(Number(intPart)).split(" ")) add(w);
        if (frac !== undefined) {                    // decimal: "virgule" + digit-by-digit
          add("virgule");
          for (const d of frac) for (const w of numberToWords(Number(d)).split(" ")) add(w);
        }
      } else if (m[3]) { const mk = CLAUSE_MARK[m[3]]; if (mk && (group.length || out)) flush(mk); }
    }
    flush(null);
    return out;
  }
}

/** Build the French phonemizer. `foreign` handles embedded non-French (unused for now). No data files. */
export function createFrench(foreign?: (latin: string) => string): Phonemizer {
  return new FrenchPhonemizer(foreign);
}
