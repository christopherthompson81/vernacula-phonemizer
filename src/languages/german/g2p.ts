/**
 * German (Standard/Hochdeutsch) grapheme→phoneme engine. Latin, largely rule-governed. Handles long/short
 * vowels (from spelling), diphthongs (ei/au/eu → aɪ̯/aʊ̯/ɔʏ̯), the ch ich-laut/ach-laut split, sch and
 * word-initial sp-/st-, final devoicing, r-vocalization, and schwa in unstressed endings. Stress is added
 * downstream (german.ts). See docs/de_native_bringup_investigation.md.
 */

const VOWELS = "aeiouäöüy";
const isV = (c: string): boolean => c !== "" && VOWELS.includes(c);

// Long / short IPA for each vowel letter.
const LONG: Record<string, string> = { a: "aː", e: "eː", i: "iː", o: "oː", u: "uː", ä: "ɛː", ö: "øː", ü: "yː", y: "yː" };
const SHORT: Record<string, string> = { a: "a", e: "ɛ", i: "ɪ", o: "ɔ", u: "ʊ", ä: "ɛ", ö: "œ", ü: "ʏ", y: "ʏ" };

const VOICED_FINAL: Record<string, string> = { b: "p", d: "t", ɡ: "k", v: "f", z: "s" };

export interface Seg { ph: string; s: number; vowel: boolean; }

/** Number of consonant letters from index j up to the next vowel or word end. */
function consRun(w: string, j: number): number {
  let n = 0;
  while (j < w.length && !isV(w[j]!)) { n++; j++; }
  return n;
}

// Common short-vowel monosyllables (function words) that the V+single-final-C → long rule would over-lengthen.
const SHORT_MONO = new Set(["das", "was", "des", "es", "in", "im", "an", "am", "um", "mit", "bis", "weg", "man",
  "von", "hat", "ob", "ab", "bin", "hin", "wes", "des", "bist", "ist", "und", "als", "hast", "wenn", "denn"]);
// Stems whose vowel before ch is LONG (the minority; the default is short — ach, Bach, mich).
const LONG_CH = ["nach", "buch", "such", "sprach", "hoch", "tuch", "fluch", "kuch", "wuch"];

/** Is the vowel at index i long? V+h, doubled vowel and ie → long; V+double-C / ck / tz / ≥2 C → short;
 *  V+single-C(+vowel|end) → long (open syllable). */
function isLong(w: string, i: number): boolean {
  const c = w[i]!, nx = w[i + 1] ?? "", nx2 = w[i + 2] ?? "";
  if (SHORT_MONO.has(w)) return false;                          // das, in, mit … (function words)
  if (nx === "h") return true;                                   // Uhr, sehen (h silent, lengthens)
  if (nx === c && "aeou".includes(c)) return true;              // Saat, See, Boot
  if (nx === "ß") return true;                                  // Straße, Fuß
  if (nx === "c" && nx2 === "h") return LONG_CH.some((s) => w.startsWith(s)); // nach/Buch/suchen long; ach/Bach short
  const run = consRun(w, i + 1);
  if (run >= 2) return false;                                  // Wasser, kommen, Angst, ck, tz, sch → short
  return true;                                                  // Vater, gut, Tag, Hof (single C → long)
}

/** ch after a back vowel a/o/u (incl. au) → ach-laut x; otherwise ich-laut ç (ich, Milch, Bücher). */
function chSound(prevVowel: string): string {
  return "aou".includes(prevVowel) ? "x" : "ç";
}

/** Scan a lowercased German word into IPA segments (no stress; devoicing + r-vocalization applied here). */
export function toSegments(word: string): Seg[] {
  const w = word.toLowerCase();
  const n = w.length;
  const segs: Seg[] = [];
  let i = 0;
  const push = (ph: string, s: number, vowel = false): void => { segs.push({ ph, s, vowel }); };
  let lastVowelLetter = "";

  while (i < n) {
    const c = w[i]!, nx = w[i + 1] ?? "", nx2 = w[i + 2] ?? "", nx3 = w[i + 3] ?? "";
    const initial = i === 0;

    // Diphthongs.
    if ((c === "e" || c === "a") && nx === "i") { push("aɪ̯", i, true); lastVowelLetter = "i"; i += 2; continue; }
    if (c === "a" && nx === "u") { push("aʊ̯", i, true); lastVowelLetter = "u"; i += 2; continue; }
    if ((c === "e" && nx === "u") || (c === "ä" && nx === "u")) { push("ɔʏ̯", i, true); lastVowelLetter = "u"; i += 2; continue; }

    // Consonant digraphs / context.
    if (c === "s" && nx === "c" && nx2 === "h") { push("ʃ", i); i += 3; continue; }              // sch → ʃ
    if (c === "s" && nx === "s") { push("s", i); i += 2; continue; }                              // ss → s
    if (c === "ß") { push("s", i); i++; continue; }
    // sp-/st- → ʃp/ʃt word-initially or after a derivational prefix (bestimmt → bəʃtɪmt, verstehen → fɛɐ̯ʃteːən).
    if (c === "s" && (nx === "p" || nx === "t") && (initial || /^(be|ge|ver|zer|ent|emp|er)$/.test(w.slice(0, i)))) { push("ʃ", i); i++; continue; }
    if (c === "c" && nx === "h") { push(chSound(lastVowelLetter), i); i += 2; continue; }          // ch → x/ç
    if (c === "c" && nx === "k") { push("k", i); i += 2; continue; }                              // ck → k
    if (c === "t" && nx === "s" && nx2 === "c" && nx3 === "h") { push("t͡ʃ", i); i += 4; continue; } // tsch → t͡ʃ
    if (c === "t" && nx === "z") { push("t͡s", i); i += 2; continue; }                             // tz → t͡s
    if (c === "d" && nx === "t") { push("t", i); i += 2; continue; }                              // dt → t (Stadt)
    if (c === "p" && nx === "h") { push("f", i); i += 2; continue; }                              // ph → f
    if (c === "q" && nx === "u") { push("k", i); push("v", i); i += 2; continue; }                 // qu → kv
    if (c === "n" && nx === "g") { push("ŋ", i); i += 2; continue; }                              // ng → ŋ
    if (c === "n" && nx === "k") { push("ŋ", i); push("k", i); i += 2; continue; }                 // nk → ŋk
    if (c === "p" && nx === "f") { push("p", i); push("f", i); i += 2; continue; }                 // pf → pf
    if (c === "i" && nx === "g" && nx2 === "" ) { push("ɪ", i, true); push("ç", i); i += 2; continue; } // final -ig → ɪç

    if (isV(c)) {
      lastVowelLetter = c;
      const seenVowel = segs.some((s) => s.vowel);
      const noVowelAfter = !/[aeiouäöüy]/.test(w.slice(i + 1));
      // -er coda in a non-first syllable → ɐ (Vater, über, Wasser); Erde (first syllable) keeps eː + ɐ̯.
      if (c === "e" && nx === "r" && !isV(nx2) && seenVowel) { push("ɐ", i, true); i += 2; continue; }
      // ie → iː (native: die, Liebe, sieben).
      if (c === "i" && nx === "e") { push("iː", i, true); i += 2; continue; }
      // doubled vowel aa/ee/oo → one long vowel (Saat, See, Boot).
      if (nx === c && "aeo".includes(c)) { push(LONG[c]!, i, true); i += 2; continue; }
      // weak schwa: an unstressed e in the FINAL syllable — machen (-en), Blume (-e); a root e keeps its quality
      // because a later vowel follows (blenden → blɛndən). Mid-compound -en needs morphology, left for later.
      if (c === "e" && seenVowel && noVowelAfter) { push("ə", i, true); i++; continue; }
      push(isLong(w, i) ? LONG[c]! : SHORT[c]!, i, true); // silent lengthening/hiatus h is dropped in the switch
      i++;
      continue;
    }

    // r: vocalize to ɐ̯ only after a LONG vowel (Uhr → uːɐ̯) or word-finally after a vowel (wir → viːɐ̯); stays ʁ
    // in an onset and in a coda after a SHORT vowel (scherz → ʃɛʁt͡s, Herz → hɛʁt͡s).
    if (c === "r") {
      const prev = segs[segs.length - 1];
      const coda = nx === "" || !isV(nx);
      if (coda && prev?.vowel) push("ɐ̯", i);   // coda r after a vowel → vocalized (Uhr, hart, Hamburg, scherz)
      else push("ʁ", i);                        // onset r (rot, drei, Straße)
      i++;
      continue;
    }

    switch (c) {
      case "b": push("b", i); break;
      case "c": push("k", i); break;
      case "d": push("d", i); break;
      case "f": push("f", i); break;
      case "g": push("ɡ", i); break;
      case "h": if (!isV(w[i - 1] ?? "")) push("h", i); break; // onset h pronounced; after a vowel (sehen, Uhr) silent
      case "j": push("j", i); break;
      case "k": push("k", i); break;
      case "l": push("l", i); break;
      case "m": push("m", i); break;
      case "n": push("n", i); break;
      case "p": push("p", i); break;
      case "s": push(isV(nx) ? "z" : "s", i); break; // s → z before a vowel (sehen, lesen); s finally / before a consonant
      case "t": push("t", i); break;
      case "v": push("f", i); break;
      case "w": push("v", i); break;
      case "x": push("k", i); push("s", i); break;
      case "z": push("t͡s", i); break;
      default: break;
    }
    i++;
  }

  finalDevoice(segs, w);
  // Collapse doubled consonants — German writes them only to mark a short vowel (Wasser, null, mittage → single).
  const out: Seg[] = [];
  for (const s of segs) {
    const prev = out[out.length - 1];
    if (prev && !prev.vowel && !s.vowel && prev.ph === s.ph && s.ph.length === 1) continue;
    out.push(s);
  }
  return out;
}

/** Auslautverhärtung: a voiced obstruent that is word-final or before a voiceless consonant devoices. */
function finalDevoice(segs: Seg[], w: string): void {
  for (let k = 0; k < segs.length; k++) {
    const s = segs[k]!;
    const dev = VOICED_FINAL[s.ph];
    if (!dev) continue;
    const next = segs[k + 1];
    if (!next || (!next.vowel && "ptksf".includes(next.ph[0] ?? ""))) s.ph = dev;
  }
  void w;
}
