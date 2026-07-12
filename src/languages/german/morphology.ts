/**
 * German morphological decomposition — the layer that makes boundary-sensitive phonology possible. A word is
 * split into PREFIX* · STEM (+link · STEM)* · SUFFIX*, and the boundaries are marked so the g2p can apply:
 *   - element-initial rules at each boundary (sp/st → ʃp/ʃt, s → z before a vowel, glottal stop),
 *   - morpheme-final devoicing (Fried·hof → …t·h…),
 *   - blocked cross-boundary assimilation (Waren·korb keeps n·k, not ŋk),
 *   - the stress domain (primary stress on a separable prefix or the first stem).
 *
 * Two closed, curated lists (prefixes/suffixes — small by nature) drive the reliable part; an open content-stem
 * lexicon (stems.txt, from kaikki ∩ frequency) drives conservative, frequency-safe compound splitting. This is
 * the same shape as hunspell/espeak affix flags — the lists here ARE the affix table; a future lexicon could
 * instead carry per-word flags. See docs/de_native_bringup_investigation.md.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const BOUNDARY = "·"; // inserted between morphemes; the g2p treats the next letter as element-initial

// Inseparable (unstressed) prefixes — kept as spelling; the g2p reduces their vowel and treats the stem as
// element-initial. Ordered longest-first for greedy stripping.
export const PREFIX_UNSTRESSED = ["ver", "zer", "ent", "emp", "miss", "be", "ge", "er"];
// Separable prefixes — these carry the PRIMARY stress and are their own phonological word.
export const PREFIX_STRESSED = ["hinter", "wider", "durch", "unter", "über", "gegen", "voll", "auseinander",
  "auf", "aus", "ein", "vor", "mit", "nach", "bei", "zu", "an", "ab", "um", "her", "hin", "los", "weg", "empor", "dar"];

// Derivational + inflectional suffixes (longest-first). Kept as spelling; their phonology is regular in the g2p
// (-ig → ɪç, -lich → lɪç, -ung → ʊŋ, -chen → çən, weak -en/-er/-e → schwa/ɐ).
export const SUFFIXES = ["schaft", "ungen", "lichen", "keiten", "heiten", "chen", "lein", "ung", "heit", "keit",
  "lich", "isch", "bar", "sam", "los", "haft", "nis", "tum", "ig", "er", "en", "es", "em", "et", "st", "e"];

let STEMS: Set<string> | undefined;
function stems(): Set<string> {
  if (STEMS === undefined) {
    STEMS = new Set();
    try {
      const path = join(dirname(fileURLToPath(import.meta.url)), "stems.txt");
      for (const line of readFileSync(path, "utf8").split("\n")) if (line && !line.startsWith("#")) STEMS.add(line);
    } catch { /* absent → no compound splitting */ }
  }
  return STEMS;
}
const isStem = (w: string): boolean => w.length >= 3 && stems().has(w);
const LINKS = ["", "s", "n", "es", "en", "e", "er"]; // Fugen-elemente; attached to the preceding stem

/** Split a run of stem material into content stems (longest-leading-stem, ≤3 parts). null = not a compound.
 *  The leading element is ≥4 letters (so ham·burg doesn't split and wrongly lengthen the a); trailing ≥3 (hof). */
function splitCompound(w: string, depth = 0): string[] | null {
  if (depth > 2) return null;
  for (let i = w.length - 3; i >= 4; i--) {
    const head = w.slice(0, i);
    if (!isStem(head)) continue;
    for (const lk of LINKS) {
      if (!w.slice(i).startsWith(lk)) continue;
      const rest = w.slice(i + lk.length);
      if (rest.length < 3) continue;
      const link = lk;                                  // linking element stays with the head
      if (isStem(rest)) return [head + link, rest];
      const tail = splitCompound(rest, depth + 1);
      if (tail) return [head + link, ...tail];
    }
  }
  return null;
}

// Fixed IPA for the closed affixes (this list IS the affix "flag table"). Unstressed prefixes reduce; the
// separable ones keep full vowels. Suffixes carry their regular phonology.
export const PREFIX_IPA: Record<string, string> = {
  be: "bə", ge: "ɡə", ver: "fɛɐ̯", zer: "t͡sɛɐ̯", ent: "ɛnt", emp: "ɛmp", miss: "mɪs", er: "ɛɐ̯",
  auf: "aʊ̯f", aus: "aʊ̯s", ein: "aɪ̯n", vor: "foːɐ̯", mit: "mɪt", nach: "naːx", bei: "baɪ̯", zu: "t͡suː",
  an: "an", ab: "ap", um: "ʊm", her: "heːɐ̯", hin: "hɪn", los: "loːs", weg: "vɛk", über: "yːbɐ", unter: "ʊntɐ",
  durch: "dʊʁç", gegen: "ɡeːɡən", voll: "fɔl", wider: "viːdɐ", hinter: "hɪntɐ", dar: "daːɐ̯", empor: "ɛmpoːɐ̯", auseinander: "aʊ̯saɪ̯nandɐ",
};
export const SUFFIX_IPA: Record<string, string> = {
  ung: "ʊŋ", ungen: "ʊŋən", heit: "haɪ̯t", heiten: "haɪ̯tən", keit: "kaɪ̯t", keiten: "kaɪ̯tən", schaft: "ʃaft",
  lich: "lɪç", lichen: "lɪçən", isch: "ɪʃ", bar: "baːɐ̯", sam: "zaːm", los: "loːs", haft: "haft", nis: "nɪs",
  tum: "tuːm", chen: "çən", lein: "laɪ̯n", ig: "ɪç", er: "ɐ", en: "ən", es: "əs", em: "əm", et: "ət", st: "st", e: "ə",
};

export type Kind = "prefix" | "stem" | "suffix";
export interface Decomp {
  parts: string[];        // morphemes in order (prefixes, stems, suffixes)
  kinds: Kind[];          // kind of each part
  stressPart: number;     // index of the part carrying primary stress
}

/** Decompose a word into ordered morphemes with a stress hint. Only splits when confident (known affixes,
 *  content stems); otherwise returns the whole word as a single stem. */
export function decompose(word: string): Decomp {
  const w = word.toLowerCase();
  const prefixes: string[] = [];
  let rest = w;
  // Strip unstressed then a stressed prefix (at most a couple), keeping ≥4 letters of stem behind.
  for (let round = 0; round < 3; round++) {
    let stripped = false;
    for (const p of PREFIX_UNSTRESSED) {
      if (rest.startsWith(p) && rest.length - p.length >= 4 && isStemish(rest.slice(p.length))) { prefixes.push(p); rest = rest.slice(p.length); stripped = true; break; }
    }
    if (!stripped) break;
  }
  let sepPrefix = "";
  for (const p of PREFIX_STRESSED) {
    if (rest.startsWith(p) && rest.length - p.length >= 4 && isStemish(rest.slice(p.length))) { sepPrefix = p; rest = rest.slice(p.length); break; }
  }
  // Strip trailing derivational suffixes (leave a ≥3-letter stem).
  const suffixes: string[] = [];
  for (let round = 0; round < 2; round++) {
    let stripped = false;
    for (const s of SUFFIXES) {
      if (rest.endsWith(s) && rest.length - s.length >= 3 && isStemish(rest.slice(0, rest.length - s.length))) { suffixes.unshift(s); rest = rest.slice(0, rest.length - s.length); stripped = true; break; }
    }
    if (!stripped) break;
  }
  // Compound-split whatever remains.
  const stemParts = splitCompound(rest) ?? [rest];

  const parts = [...prefixes, ...(sepPrefix ? [sepPrefix] : []), ...stemParts, ...suffixes];
  const kinds: Kind[] = [
    ...prefixes.map(() => "prefix" as Kind),
    ...(sepPrefix ? ["prefix" as Kind] : []),
    ...stemParts.map(() => "stem" as Kind),
    ...suffixes.map(() => "suffix" as Kind),
  ];
  // Primary stress: the separable prefix, else the first stem — both sit at index prefixes.length.
  return { parts, kinds, stressPart: prefixes.length };
}

const VALID_ONSET2 = new Set(["st", "sp", "sc", "sk", "sm", "sn", "sw", "tr", "dr", "kr", "gr", "br", "pr", "fr",
  "kl", "gl", "bl", "pl", "fl", "kn", "gn", "pf", "kw", "zw", "tw", "ph", "th", "ch", "qu", "wr", "schl", "schw"]);

/** Loose gate: a stripped stem must have a vowel and start with a valid German onset (so a prefix isn't peeled
 *  off a non-word — be+rlin, where "rl" is not an onset). */
function isStemish(w: string): boolean {
  if (!/[aeiouäöüy]/.test(w)) return false;
  const a = w[0] ?? "", b = w[1] ?? "";
  if ("aeiouäöüy".includes(a)) return true;                 // vowel-initial
  if ("aeiouäöüy".includes(b) || b === "") return true;     // single consonant onset
  return VALID_ONSET2.has(a + b) || VALID_ONSET2.has(w.slice(0, 3)); // valid cluster (st, schw…)
}
