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

// Word-initial ECLIPSIS (urú): the eclipsing consonant is pronounced, the radical letter is silent.
const ECLIPSIS: Record<string, string> = { mb: "m", gc: "g", nd: "n", bp: "b", dt: "d", ts: "t" };

export interface Seg {
    ph: string;
    nucleus: boolean; // is a vowel nucleus (for stress placement)
    noGlide?: boolean; // long oː spelled ⟨eo⟩ already carries its on-glide → suppresses the i-offglide (ceoil)
}

/** Is the consonant at index i SLENDER? Its quality comes from the IMMEDIATELY adjacent vowel letter — the one
 *  right after (onset) else right before (coda). Word-initial ⟨r⟩ is always broad. A cluster-internal consonant
 *  (no adjacent vowel) agrees with the following vowel (bl → both slender), EXCEPT ⟨s⟩ which is broad before a
 *  consonant (spéir → sˠpʲeːɾʲ); a coda cluster with no following vowel is broad (ainm → …mˠ). */
function consonantSlender(w: string, i: number): boolean {
    if (w[i] === "r" && i === 0) return false; // word-initial r → always broad
    const nx = w[i + 1] ?? "", pv = w[i - 1] ?? "";
    if (isVowel(nx)) return isSlenderV(nx); // onset: immediate following vowel
    if (isVowel(pv)) return isSlenderV(pv); // coda: immediate preceding vowel
    if (w[i] === "s") return false; // s before a consonant (sp/st/sc/sm/sn) is broad
    for (let j = i + 1; j < w.length; j++) if (isVowel(w[j]!)) return isSlenderV(w[j]!); // onset cluster (bl/br…)
    return false; // coda cluster with no following vowel → broad
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

        // --- word-initial ECLIPSIS (urú): eclipsing consonant wins, radical letter silent (mbád → mˠɑːd̪ˠ) ---
        if (i === 0) {
            const slender = consonantSlender(w, 0);
            if (w.slice(0, 3) === "bhf") { cons(slender ? "vʲ" : "w"); i += 3; continue; } // bhf → w/vʲ (f silent)
            if (two === "ng") { cons(slender ? "ɲ" : "ŋ"); i += 2; continue; } // ng → ŋ (g silent)
            if (ECLIPSIS[two]) { cons((slender ? SLENDER : BROAD)[ECLIPSIS[two]!]!); i += 2; continue; }
        }

        // --- word-final ⟨dh⟩/⟨gh⟩ → silent (the -aigh/-idh verbal endings: chéadaigh → çeːd̪ˠə); the exposed
        // short nucleus then reduces to the ending schwa (airigh → aɾʲə) via the unstressed reduction. ---
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
                // ⟨eo⟩/⟨eó⟩/⟨eoi⟩ → oː but with a built-in on-glide → no separate i-offglide (ceoil → koːlʲ).
                const seg: Seg = { ph: MANIFEST.vowels[key]!, nucleus: true };
                if (/^e[oó]/.test(key)) seg.noGlide = true;
                segs.push(seg);
                i += key.length;
                continue;
            }
            segs.push({ ph: c, nucleus: true }); // unknown vowel char: pass through
            i++;
            continue;
        }

        // --- single consonants: broad or slender ---
        const map = consonantSlender(w, i) ? SLENDER : BROAD;
        if (map[c]) cons(map[c]!);
        else if (/[a-z]/.test(c)) cons(c); // unknown letter: pass through; apostrophe/hyphen/punct → skip
        i++;
    }
    return segs;
}
