/**
 * Irish Gaelic grapheme→phoneme scanner. The core is the BROAD/SLENDER axis: each consonant's quality is set by
 * its flanking vowel LETTERS (slender next to e/i, broad next to a/o/u — "caol le caol"), and the matching
 * velarized/palatalized form is emitted. Vowel clusters are a longest-match lookup (the pronounced nucleus).
 * Lenition digraphs (bh/ch/dh/fh/gh/mh/ph/sh/th) are resolved first. Stress + assembly: irish.ts.
 */

import { MANIFEST } from "./manifest.ts";

const SLENDER_V = MANIFEST.slenderVowels;
const BROAD_V = MANIFEST.broadVowels;
const VOWELS = SLENDER_V + BROAD_V;
const BROAD = MANIFEST.broad;
const SLENDER = MANIFEST.slender;
const LENITION = MANIFEST.lenition;
const VOWEL_CLUSTERS = Object.keys(MANIFEST.vowels).sort((a, b) => b.length - a.length); // longest-first

const isVowel = (c: string): boolean => c !== "" && VOWELS.includes(c);
const isSlenderV = (c: string): boolean => c !== "" && SLENDER_V.includes(c);

export interface Seg {
    ph: string;
    nucleus: boolean; // is a vowel nucleus (for stress placement)
}

/** Is the consonant at index i SLENDER? Determined by the nearest vowel LETTER — the one immediately after (the
 *  onset rule), else the one immediately before (coda) — searching past any intervening consonants. Word-initial
 *  ⟨r⟩ is always broad. */
function consonantSlender(w: string, i: number): boolean {
    if (w[i] === "r" && i === 0) return false; // word-initial r → always broad
    for (let j = i + 1; j < w.length; j++) if (isVowel(w[j]!)) return isSlenderV(w[j]!);
    for (let j = i - 1; j >= 0; j--) if (isVowel(w[j]!)) return isSlenderV(w[j]!);
    return false; // no vowels (all-consonant token) → broad
}

/** Scan a lowercased Irish word into segments. */
export function toSegments(word: string): Seg[] {
    const w = word.toLowerCase();
    const n = w.length;
    const segs: Seg[] = [];
    let i = 0;
    const cons = (ph: string): void => { if (ph) segs.push({ ph, nucleus: false }); };

    while (i < n) {
        const c = w[i]!;
        const two = w.slice(i, i + 2);

        // --- word-final ⟨dh⟩/⟨gh⟩ → silent (the -aigh/-idh verbal endings: chéadaigh → çeːd̪ˠə) ---
        if ((two === "dh" || two === "gh") && i + 2 === n && segs.length > 0) { i += 2; continue; }

        // --- lenition digraphs (séimhiú): bh ch dh fh gh mh ph sh th ---
        if (LENITION[two]) {
            const slender = consonantSlender(w, i);
            const ph = LENITION[two]![slender ? 1 : 0];
            // broad bh/mh add a labial-velar glide before a back vowel (bhuail → wuəlʲ); keep w/vʲ otherwise.
            cons(ph);
            i += 2;
            continue;
        }

        // --- doubled consonant (rr/ll/nn/…) → a single quality-determined consonant (carr → kaɾˠ) ---
        if (c === w[i + 1] && !isVowel(c) && !LENITION[two]) {
            const map = consonantSlender(w, i) ? SLENDER : BROAD;
            if (map[c]) cons(map[c]!);
            i += 2;
            continue;
        }

        // --- vowel clusters (longest-match) → the pronounced nucleus ---
        if (isVowel(c)) {
            const key = VOWEL_CLUSTERS.find((k) => w.startsWith(k, i));
            if (key) {
                segs.push({ ph: MANIFEST.vowels[key]!, nucleus: true });
                i += key.length;
                continue;
            }
            segs.push({ ph: c, nucleus: true }); // unknown vowel char: pass through
            i++;
            continue;
        }

        // --- single consonants: broad or slender ---
        const slender = consonantSlender(w, i);
        const map = slender ? SLENDER : BROAD;
        if (map[c]) cons(map[c]!);
        else if (c === "h") { /* handled in lenition; stray h → silent */ }
        else cons(c); // unknown consonant: pass through
        i++;
    }
    return segs;
}
