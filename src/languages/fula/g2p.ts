/**
 * Fula (ff) grapheme→phoneme engine — Fulfulde, espeak-independent and AUTHORED beyond-espeak (espeak ships no
 * Fula). Latin/Adlam-Latin orthography is shallow, so a longest-match scan: prenasalized digraphs (mb→ᵐb,
 * nd→ⁿd, nj→ⁿd͡ʒ, ng→ᵑɡ; nng→ŋːɡ) and geminates (Cː) resolve before the bare letter. Sole census provider of the
 * implosives ʄ (ƴ) / ɠ, plus ɓ ɗ and the prenasalized series. Stress is penultimate.
 * See docs/investigations/ff_native_bringup_investigation.md.
 */

import { MANIFEST } from "./manifest.ts";
import { latinPhone } from "../../core/latinPhones.ts";

// Orthography → IPA, longest-match. `nuc` = a vowel nucleus (for stress).
const RULES = MANIFEST.rules;

interface Seg {
    ph: string;
    nuc: boolean;
}

/** Scan Fula orthography into IPA segments (longest-match). */
function toSegments(word: string): Seg[] {
    const w = word.toLowerCase();
    const segs: Seg[] = [];
    let i = 0;
    outer: while (i < w.length) {
        for (const [orth, ipa, nuc] of RULES) {
            if (w.startsWith(orth, i)) {
                segs.push({ ph: ipa, nuc });
                i += orth.length;
                continue outer;
            }
        }
        // ⚠ A letter with no rule here still denotes a sound; dropping it deletes what the writer typed. Only
        // reached when every grapheme (digraphs included) has declined, so the language's own reading wins (#663).
        { const p = latinPhone(w[i]!, { initial: i === 0, includeH: true }); if (p !== undefined) segs.push({ ph: p, nuc: false }); }
        i++;
    }
    return segs;
}

/** One Fula word → canonical IPA with penultimate stress. */
export function phonemizeWord(word: string): string {
    const segs = toSegments(word);
    const nucIdx = segs.map((s, i) => (s.nuc ? i : -1)).filter((i) => i >= 0);
    if (nucIdx.length === 0) return segs.map((s) => s.ph).join("");
    const stressIdx =
        nucIdx.length >= 2 ? nucIdx[nucIdx.length - 2]! : nucIdx[0]!; // penultimate nucleus
    let out = "";
    for (let i = 0; i < segs.length; i++) {
        if (i === stressIdx) out += "ˈ";
        out += segs[i]!.ph;
    }
    return out;
}
