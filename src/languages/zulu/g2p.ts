/**
 * Zulu (zu, isiZulu) grapheme→phoneme engine — Nguni Bantu, Latin script, AUTHORED beyond-espeak (espeak ships
 * only a crude "testing" voice; no click phoneme exists in espeak). A near-clone of Xhosa. Orthography is a
 * longest-match scan (trigraphs/digraphs before the bare letter) so clicks and affricates resolve as single
 * phonemes with no stray-letter leakage. IPA + phoneme inventory ported from espeak-ng-portable's authored
 * authoring/zu/{zu_rules,ph_zulu} (epitran zul-Latn + kaikki referees). Fills the census click gaps ǀ ǃ ǁ.
 *   - 15-way click series: c/q/x → kǀ/kǃ/kǁ, aspirated ch/qh/xh, voiced-depressor gc/gq/gx (ɡ̤ǀ…),
 *     nasal nc/nq/nx (ŋǀ…), breathy-nasal ngc/ngq/ngx (ŋ̤ǀ…), ejective-nasal nkc/nkq/nkx (ŋǀʼ…).
 *   - implosive b → ɓ (plain b only after m: mb=[mb]); plain voiceless stops are EJECTIVE (p/t/k → pʼ/tʼ/kʼ),
 *     aspirates ph/th/kh → pʰ/tʰ/kʰ; voiced obstruents carry the depressor (breathy) diacritic (g→ɡ̤, d→d̤, z→z̤).
 *   - lateral fricatives hl→ɬ, dl→ɮ̤; velar-lateral affricate kl→kxʼ; nasal place-assimilation n→ŋ/ɲ before
 *     velar/palatal (nk→ŋkʼ, nj→ɲdʒ̤, ng→ŋɡ̤).
 * Penultimate stress + length and lexical tone are applied downstream in zulu.ts. See docs/investigations/zu_native_bringup_investigation.md.
 */

import { MANIFEST } from "./manifest.ts";

// Orthography → IPA, longest-match (multi-char keys tried first). The boolean = the unit is a vowel nucleus.
// The rule table is DATA (zulu.jsonc); this file is the longest-match scan over it.
const RULES = MANIFEST.rules;

export interface Seg {
    ph: string;
    v: boolean;
}

/** A longest-match orthography→IPA rule (orth, ipa, isVowelNucleus). */
export type Rule = [string, string, boolean];

/** Scan Nguni orthography into IPA segments (longest-match). `rules` defaults to the Zulu table; the sibling
 *  Xhosa engine passes its own (near-identical) table — the scan logic is shared. */
export function toSegments(word: string, rules: readonly Rule[] = RULES): Seg[] {
    const w = word.toLowerCase();
    const segs: Seg[] = [];
    let i = 0;
    outer: while (i < w.length) {
        // Word-initial ntsh keeps a plain n (Ntshonalanga→nt͡ʃʼ); the n→ɲ palatalization only fires medially.
        if (i === 0 && w.startsWith("ntsh")) {
            segs.push({ ph: "n", v: false }, { ph: "t͡ʃʼ", v: false });
            i += 4;
            continue;
        }
        for (const [orth, ipa, v] of rules) {
            if (w.startsWith(orth, i)) {
                segs.push({ ph: ipa, v });
                i += orth.length;
                continue outer;
            }
        }
        i++; // unknown char (skip)
    }
    return segs;
}
