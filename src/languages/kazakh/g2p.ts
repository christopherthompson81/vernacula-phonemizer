/**
 * Kazakh (kk) grapheme→phoneme engine — Cyrillic, canonical IPA. Kazakh Cyrillic is a
 * shallow near-1:1 orthography, so this is a left-to-right scan with a few context rules — no lexicon:
 *   - vowels: а ә е о ө ұ ү ы і э → ɑ æ e o ɵ ʊ ʏ ə ɪ ɛ. Word-INITIAL е → je (ел→jel); elsewhere e.
 *   - iotated / glide letters: и → əj (a diphthong), у → w (glide, not a nucleus:
 *     су→sw), я → ja, ю → ju, ё → jo.
 *   - consonants are context-free except л, which is DARK ɫ next to a back vowel (а о ұ ы) and clear l next to
 *     a front vowel (ә е ө ү і э) — the ɫ census contribution. г→ɡ and к→k do NOT palatalize (unlike Turkish).
 *   - doubled consonants stay doubled (кк→kk, сс→ss); Kazakh has no gemination-to-length.
 * Stress is applied downstream in kazakh.ts.
 */

import { MANIFEST } from "./manifest.ts";

// Letter→IPA lookup tables are DATA (kazakh.jsonc). Nucleus vowels (glides w/j are not nuclei); ə (from ы and from
// и=əj) is the only "unstressed" vowel — see kazakh.ts. Iotated/glide letters expand to a fixed IPA sequence.
const VOWEL_IPA = MANIFEST.vowels;
const GLIDE_IPA = MANIFEST.glides;
const CONS_IPA = MANIFEST.consonants;
export interface Seg {
    ph: string;
    nucleus: boolean;
}

/** Kazakh word → IPA segment list (nucleus flags drive stress). */
export function toSegments(word: string): Seg[] {
    const chars = [...word.toLowerCase()];
    const segs: Seg[] = [];
    let prevVowel = ""; // last vowel LETTER seen (for l-darkness)
    for (let i = 0; i < chars.length; i++) {
        const c = chars[i]!;
        const next = chars[i + 1] ?? "";
        // Plain vowel. Word-initial е → je: the j is a separate glide so stress lands on the vowel (ел→jˈel).
        if (c in VOWEL_IPA) {
            if (c === "е" && i === 0) segs.push({ ph: "j", nucleus: false });
            segs.push({ ph: VOWEL_IPA[c]!, nucleus: true });
            prevVowel = c;
            continue;
        }
        // Iotated / glide letter.
        if (c in GLIDE_IPA) {
            const ph = GLIDE_IPA[c]!;
            // у is a pure glide (no nucleus); и/я/ю/ё carry a vowel nucleus.
            if (c === "у") segs.push({ ph, nucleus: false });
            else {
                for (const p of ph)
                    segs.push({ ph: p, nucleus: /[əauo]/u.test(p) });
            } // əj/ja/ju/jo: vowel is the nucleus
            prevVowel = c;
            continue;
        }
        // l: emitted DARK ɫ here; kazakh.ts lightens ɫ→l word-wide when the token carries a front vowel (Kazakh
        // vowel harmony — a word is uniformly front or back).
        if (c === "л") {
            segs.push({ ph: "ɫ", nucleus: false });
            continue;
        }
        // ⚠ THE SIGNS ARE NOT SEGMENTS. ⟨ь⟩ and ⟨ъ⟩ were both mapped to ʔ in kazakh.jsonc, which put a
        // GLOTTAL STOP into 408 corpus rows — миль `mˈəjɫʔ`, гольф `ɡˈoɫʔf`, пальма `pɑɫʔmˈɑ`, Нью
        // `nʔjˈu`, премьер `premʔˈer`. Neither sign denotes a sound in any reading. They reach Kazakh
        // only in Russian loans and names, and there they do opposite jobs:
        //   ь (soft)  palatalises the consonant BEFORE it            миль → mˈəjlʲ, Чарльз → t͡ʃˈɑrlʲz
        //   ъ (hard)  separates, giving a /j/ onset to what follows   объектив → objektˈiv
        if (c === "ь") {
            const prev = segs[segs.length - 1];
            if (prev !== undefined && !prev.nucleus && !prev.ph.endsWith("ʲ")) {
                // a palatalised l is LIGHT by definition, so it also escapes the ɫ that л emits above —
                // the word-wide harmony pass in kazakh.ts only lightens, so setting it here is safe.
                if (prev.ph === "ɫ") prev.ph = "l";
                prev.ph += "ʲ";
            }
            continue;
        }
        if (c === "ъ") {
            segs.push({ ph: "j", nucleus: false });
            continue;
        }

        const cons = CONS_IPA[c];
        if (cons !== undefined) segs.push({ ph: cons, nucleus: false });
        // else: unknown char (punctuation) → skip
    }
    return segs;
}
