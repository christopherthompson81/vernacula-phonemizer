/**
 * Spanish grapheme→phoneme engine (broad Castilian). Spanish orthography is shallow and near-deterministic,
 * so this is a left-to-right scan with small context rules — no lexicon. Produces a segment list (phoneme +
 * whether it's a syllable nucleus + whether it bears a written accent); stress and spirantization are
 * applied downstream. See docs/es_native_bringup_investigation.md for the convention.
 */

const STRONG = "aeoáéó";       // strong vowels (each is its own nucleus; two adjacent = hiatus)
const WEAK_UNACC = "iuü";      // unaccented weak vowels (glide beside another vowel)
const WEAK_ACC = "íú";         // accented weak vowels (always a nucleus; breaks a diphthong)
const ACCENTED: Record<string, string> = { á: "a", é: "e", í: "i", ó: "o", ú: "u", ü: "u" };
const FRONT = "eiéí";          // front vowels that soften c and g

// NB: guard against "" — "abc".includes("") is true, which at word end would misread the missing next char.
const isVowel = (c: string): boolean => c !== "" && (STRONG.includes(c) || WEAK_UNACC.includes(c) || WEAK_ACC.includes(c));
const isStrong = (c: string): boolean => c !== "" && STRONG.includes(c);
const isFront = (c: string): boolean => c !== "" && FRONT.includes(c);

export interface Seg {
  ph: string;       // IPA phoneme(s)
  nucleus: boolean; // is a syllable nucleus (vowel, not a glide)
  accent: boolean;  // bears a written accent (á é í ó ú) → lexically stressed
}

/** Classify a maximal run of vowel characters into nucleus vs glide roles. */
function classifyRun(run: string): { nucleus: boolean; accent: boolean }[] {
  const chars = [...run];
  const roles = chars.map(() => false); // true = nucleus
  const hasNucleus = chars.some((c) => isStrong(c) || WEAK_ACC.includes(c));
  chars.forEach((c, k) => {
    if (isStrong(c) || WEAK_ACC.includes(c)) roles[k] = true;         // strong / accented-weak = nucleus
  });
  if (!hasNucleus) roles[roles.length - 1] = true;                    // all-weak run (iu, ui, i) → last is nucleus
  return chars.map((c, k) => ({ nucleus: roles[k]!, accent: WEAK_ACC.includes(c) || "áéó".includes(c) }));
}

/** A weak vowel that is a glide: an ONglide (before the nucleus) is consonantal j/w (cielo → θjelo); an
 *  OFFglide (after the nucleus) is the non-syllabic vowel ᶦ/ᶷ (aire → aᶦɾe, auto → aᶷto). */
const glideOf = (c: string, offglide: boolean): string =>
  (c === "i" || c === "í") ? (offglide ? "ᶦ" : "j") : (offglide ? "ᶷ" : "w");

/** Scan a lowercased Spanish word into segments. */
export function toSegments(word: string): Seg[] {
  const w = word.toLowerCase();
  const segs: Seg[] = [];
  const n = w.length;
  let i = 0;
  const cons = (ph: string): void => { segs.push({ ph, nucleus: false, accent: false }); };

  while (i < n) {
    const c = w[i]!;
    const nx = w[i + 1] ?? "";
    const nx2 = w[i + 2] ?? "";

    // Digraphs / multi-letter units.
    if (c === "c" && nx === "h") { cons("t͡ʃ"); i += 2; continue; }
    if (c === "l" && nx === "l") { cons("ʎ"); i += 2; continue; }
    if (c === "r" && nx === "r") { cons("r"); i += 2; continue; }
    if (c === "q" && nx === "u") { cons("k"); i += 2; continue; }                       // qu → k (u silent)
    if (c === "g" && nx === "u" && isFront(nx2)) { cons("ɡ"); i += 2; continue; }        // gue/gui → ɡ (u silent)
    if (c === "g" && nx === "ü" && (nx2 === "e" || nx2 === "i")) { cons("ɡ"); cons("w"); i += 2; continue; } // güe/güi → ɡw

    // y: a consonant (ʝ) before a vowel; otherwise the vowel i — an offglide after a nucleus (muy → muj) or
    // a standalone nucleus (y "and" → i).
    if (c === "y") {
      if (isVowel(nx)) { cons("ʝ"); i++; continue; }
      const prev = segs[segs.length - 1];
      if (prev && prev.nucleus) cons("ᶦ");   // offglide after a nucleus (muy → muᶦ, buey → bweᶦ)
      else segs.push({ ph: "i", nucleus: true, accent: false });
      i++; continue;
    }

    // Vowel run → nuclei + glides.
    if (isVowel(c)) {
      let j = i; while (j < n && isVowel(w[j]!)) j++;
      const run = w.slice(i, j);
      const roles = classifyRun(run);
      [...run].forEach((vc, k) => {
        const base = ACCENTED[vc] ?? vc;
        if (roles[k]!.nucleus) segs.push({ ph: base, nucleus: true, accent: roles[k]!.accent });
        else cons(glideOf(vc, roles.slice(0, k).some((r) => r.nucleus)));  // offglide if a nucleus precedes it
      });
      i = j; continue;
    }

    // Single consonants.
    switch (c) {
      case "b": case "v": cons("b"); break;                    // spirantized downstream
      case "c": cons(isFront(nx) ? "θ" : "k"); break;
      case "z": cons("θ"); break;
      case "d": cons("d"); break;
      case "f": cons("f"); break;
      case "g": cons(isFront(nx) ? "x" : "ɡ"); break;
      case "h": break;                                          // silent
      case "j": cons("x"); break;
      case "k": cons("k"); break;
      case "l": cons("l"); break;
      case "m": cons("m"); break;
      case "n": cons("n"); break;
      case "ñ": cons("ɲ"); break;
      case "p": cons("p"); break;
      case "r": cons(segs.length === 0 || "nls".includes(lastPhoneme(segs)) ? "r" : "ɾ"); break;
      case "s": cons("s"); break;
      case "t": cons("t"); break;
      case "w": cons("w"); break;
      case "x": cons("k"); cons("s"); break;                    // x → ks
      default: if (/[a-zñ]/.test(c)) cons(c); break;            // unknown letter: pass through
    }
    i++;
  }
  return segs;
}

/** The last emitted consonant phoneme (for the r-trill onset test). */
function lastPhoneme(segs: Seg[]): string {
  return segs.length ? segs[segs.length - 1]!.ph : "";
}
