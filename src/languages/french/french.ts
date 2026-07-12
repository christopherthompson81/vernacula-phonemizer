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

// Obligatory liaison: a normally-silent final consonant of a function word / number is pronounced as the
// onset of a following vowel-initial word. z after plural determiners/pronouns & the -x/-s numbers; n after
// nasal monosyllables; t after est/sont/tout/petit… (grand/quand: d→t). Attached to the next word (re-syllabified).
const LIAISON: Record<string, string> = {
  les: "z", des: "z", ces: "z", mes: "z", tes: "z", ses: "z", nos: "z", vos: "z", leurs: "z", aux: "z",
  ils: "z", elles: "z", nous: "z", vous: "z", dans: "z", chez: "z", sans: "z", très: "z", plus: "z", moins: "z",
  deux: "z", trois: "z", six: "z", dix: "z",
  un: "n", mon: "n", ton: "n", son: "n", en: "n", on: "n", aucun: "n", bien: "n", rien: "n", commun: "n",
  est: "t", sont: "t", ont: "t", font: "t", vont: "t", tout: "t", quand: "t", grand: "t", petit: "t", dont: "t", cet: "t",
  "c'est": "t", "c’est": "t", "n'est": "t", "n’est": "t", // elided single tokens: c'est ici → sɛ tisi
};
// h aspiré (and vowel-initial words that block liaison, e.g. huit/onze/y-): the following word looks
// vowel-initial but forbids liaison — les héros → le eʁo, not le zeʁo.
const H_ASPIRE = new Set([
  "héros", "haricot", "hasard", "haine", "hibou", "hiboux", "hangar", "honte", "haut", "hauteur", "hache",
  "handicap", "hérisson", "hollande", "hongrie", "hamac", "hall", "hamburger", "hérault", "hérissé",
  "huit", "huitième", "onze", "onzième", "yaourt", "yacht", "yoga", "oui", "ouistiti", "uhlan",
]);
const STARTS_VOWEL = /^[aeiouyàâäéèêëîïôöûüùœæh]/i; // h → treat as mute unless the word is in H_ASPIRE
function liaisonOnto(prev: string, next: string): string {
  const c = LIAISON[prev.toLowerCase()];
  if (!c) return "";
  const nx = next.toLowerCase();
  return STARTS_VOWEL.test(nx) && !H_ASPIRE.has(nx) ? c : "";
}

class FrenchPhonemizer implements Phonemizer {
  constructor(private readonly foreign?: (latin: string) => string) {}

  text(input: string): string {
    // Flatten to a sequence of word strings / pause marks (numbers expand to their spelled words), so liaison
    // can look one word ahead across the whole stream (incl. spelled numbers: "2 ans" → deux → dø zˈɑ̃).
    type Item = { word: string } | { pause: string };
    const items: Item[] = [];
    for (const m of input.matchAll(TOKEN)) {
      if (m[1]) items.push({ word: m[1] });
      else if (m[2]) {
        const [intPart, frac] = m[2].split(/[.,]/);
        for (const w of numberToWords(Number(intPart)).split(" ")) items.push({ word: w });
        if (frac !== undefined) {                    // decimal: "virgule" + digit-by-digit
          items.push({ word: "virgule" });
          for (const d of frac) for (const w of numberToWords(Number(d)).split(" ")) items.push({ word: w });
        }
      } else if (m[3]) { const mk = CLAUSE_MARK[m[3]]; if (mk) items.push({ pause: mk }); }
    }

    let group: string[] = [];        // IPA tokens of the current rhythmic group (until a pause)
    let out = "";
    let carry = "";                  // liaison consonant to prepend to the next word (its new onset)
    const flush = (pause: string | null): void => {
      if (group.length) { accentFinal(group); out += (out ? " " : "") + group.join(" "); group = []; }
      if (pause) out += ` ${pause}`;
    };
    for (let k = 0; k < items.length; k++) {
      const it = items[k]!;
      if ("pause" in it) { carry = ""; if (group.length || out) flush(it.pause); continue; } // liaison never crosses a pause
      const ipa = carry + phonemizeWord(it.word);
      carry = "";
      const next = items[k + 1];                       // liaison only onto an immediately adjacent word
      if (next && "word" in next) carry = liaisonOnto(it.word, next.word);
      if (ipa) group.push(ipa);
    }
    flush(null);
    return out;
  }
}

/** Build the French phonemizer. `foreign` handles embedded non-French (unused for now). No data files. */
export function createFrench(foreign?: (latin: string) => string): Phonemizer {
  return new FrenchPhonemizer(foreign);
}
