/**
 * French (fr) phonemizer — canonical IPA (standard/Parisian), espeak-independent. Rule-based g2p (g2p.ts)
 * for the ~80% regular core + an exception lexicon for irregulars (monsieur, femme, ville, Greek ch→k, …).
 * text() tokenizes words / numbers / punctuation; French has no lexical stress, so a single phrase-final
 * accent is added on the last word before a pause (the rhythmic-group stress).
 */
import type { Phonemizer } from "../../registry.ts";
import { toIpa } from "./g2p.ts";
import { numberToWords } from "./numbers.ts";

// Irregular words the reading rules get wrong (silent/idiosyncratic spellings, Greek ch→k, -ome/-one).
const EXCEPTIONS: Record<string, string> = {
  monsieur: "məsjø", messieurs: "mesjø", femme: "fam", femmes: "fam", oignon: "ɔɲɔ̃", oignons: "ɔɲɔ̃",
  ville: "vil", villes: "vil", village: "vilaʒ", mille: "mil", tranquille: "tʁɑ̃kil", fils: "fis",
  gars: "ɡa", pays: "pei", second: "səɡɔ̃", seconde: "səɡɔ̃d", automne: "otɔn", sculpture: "skyltyʁ",
  œufs: "ø", bœufs: "bø", œuf: "œf", bœuf: "bœf", est: "ɛ", et: "e", les: "le", des: "de", ces: "se",
  mes: "me", tes: "te", ses: "se", aux: "o", eux: "ø", chœur: "kœʁ", chorale: "kɔʁal", orchestre: "ɔʁkɛstʁ",
  technique: "tɛknik", écho: "eko", psychologie: "psikɔlɔʒi", chaos: "kao", chrome: "kʁom",
  // counting forms (isolated): final consonant sounded
  dix: "dis", six: "sis", huit: "ɥit", sept: "sɛt", neuf: "nœf", cinq: "sɛ̃k", plus: "plys",
  // loanwords / learned words (final consonant sounded; -um Latin → ɔm)
  film: "film", album: "albɔm", forum: "fɔʁɔm", item: "itɛm", direct: "diʁɛkt", strict: "stʁikt",
  ours: "uʁs", ouest: "wɛst", août: "ut", tous: "tus",
};

const stripAccentsForKey = (w: string): string => w.toLowerCase();
const VOWEL_IPA = /[aeiouyɛɔøœəɑ]/;

/** One French word → IPA (exception lexicon first, then the g2p engine). */
export function phonemizeWord(word: string): string {
  const key = stripAccentsForKey(word);
  return EXCEPTIONS[key] ?? toIpa(word);
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
