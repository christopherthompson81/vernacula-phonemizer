/**
 * Azerbaijani grapheme→phoneme engine. Azerbaijani orthography is shallow and near-1:1 (vowel harmony is already
 * spelled), so this is a left-to-right scan with a few context rules — no lexicon. It mirrors the Turkish engine
 * but differs in three Oghuz-vs-Azerbaijani points:
 *   - the extra vowel ⟨ə⟩ → [æ] (a FRONT vowel), and a → [ɑ] (back), ö → [œ].
 *   - ⟨q⟩ is a distinct letter → [ɡ] (the back voiced stop), devoicing to [x] word-finally (oxumaq → oxumɑx);
 *     ⟨x⟩ → [x] (voiceless velar fricative, a real letter) and ⟨ğ⟩ → [ɣ] (voiced velar fricative) — NOT the
 *     Turkish ⟨x⟩=ks / ⟨ğ⟩=lengthening.
 *   - k/g palatalize before a FRONT vowel (k → c: kitab → citɑb; g → ɟ, Azerbaijani ⟨g⟩ being inherently palatal).
 * Dark/clear l, geminate stops, and nasal place assimilation are shared with Turkish. Stress (final-syllable) and
 * number reading are downstream. See docs/investigations/az_native_bringup_investigation.md.
 */
import { MANIFEST } from "./manifest.ts";

const VOWEL_IPA = MANIFEST.vowels.ipa;
const FRONT = new Set(MANIFEST.vowels.front);
const BACK = new Set(MANIFEST.vowels.back);
const CONS_IPA = MANIFEST.consonants;
const GEMINATE = new Set(MANIFEST.geminate);
const isVowel = (c: string): boolean => c !== "" && c in VOWEL_IPA;

export interface Seg {
    ph: string;
    nucleus: boolean;
}

/** Azerbaijani-locale lowercase: İ→i and I→ı (JS toLowerCase would give i̇ / i). */
export function azLower(word: string): string {
    return word.replace(/İ/g, "i").replace(/I/g, "ı").toLowerCase();
}

/** Azerbaijani word → segment list. */
export function toSegments(word: string): Seg[] {
    const chars = [...azLower(word)];
    const segs: Seg[] = [];
    let prevVowel = ""; // last vowel LETTER seen (for l-darkness)
    for (let i = 0; i < chars.length; i++) {
        const c = chars[i]!;
        const next = chars[i + 1] ?? "";
        const prevC = chars[i - 1] ?? "";
        const wordFinal = i === chars.length - 1;

        if (c in VOWEL_IPA) {
            segs.push({ ph: VOWEL_IPA[c]!, nucleus: true });
            prevVowel = c;
            continue;
        }
        // Geminate stop/affricate → length mark (the second of a doubled stop): səkkiz → sæcːiz.
        if (c === prevC && GEMINATE.has(c)) {
            segs.push({ ph: "ː", nucleus: false });
            continue;
        }
        // ğ (yumuşaq q) → the voiced velar fricative ɣ (dağ → dɑɣ, oğul → oɣul) — unlike Turkish, never a glide
        // or a lengthener.
        if (c === "ğ") {
            segs.push({ ph: "ɣ", nucleus: false });
            continue;
        }
        // x → the voiceless velar fricative (yaxşı → jɑxʃɯ).
        if (c === "x") {
            segs.push({ ph: "x", nucleus: false });
            continue;
        }
        // l: dark ɫ next to a back vowel, clear l next to a front vowel. Onset l keys on the FOLLOWING vowel, coda
        // l on the PRECEDING vowel.
        if (c === "l") {
            const ctx = isVowel(next) ? next : prevVowel;
            segs.push({ ph: BACK.has(ctx) ? "ɫ" : "l", nucleus: false });
            continue;
        }
        // k → c before a FRONT vowel (kitab → citɑb, kənd → cænd); onset keys on the following vowel, coda on the
        // preceding (kətil… / -ək → …c). Else k.
        if (c === "k") {
            const ctx = isVowel(next) ? next : prevVowel;
            segs.push({ ph: FRONT.has(ctx) ? "c" : "k", nucleus: false });
            continue;
        }
        // g → ɟ (Azerbaijani ⟨g⟩ is the inherently palatal voiced stop, occurring with front vowels: gəl → ɟæl).
        if (c === "g") {
            segs.push({ ph: "ɟ", nucleus: false });
            continue;
        }
        // q → ɡ (the back voiced stop: qapı → ɡɑpɯ), devoicing to x word-finally (oxumaq → oxumɑx, palıq → …ɑx).
        if (c === "q") {
            segs.push({ ph: wordFinal ? "x" : "ɡ", nucleus: false });
            continue;
        }
        const cons = CONS_IPA[c];
        if (cons !== undefined) segs.push({ ph: cons, nucleus: false });
        // else: unknown char (punctuation slipped in) → skip
    }
    // Nasal PLACE assimilation: /n/ → [ŋ] before a velar stop k/ɡ, [ɲ] before a palatal c/ɟ.
    for (let i = 0; i < segs.length - 1; i++) {
        if (segs[i]!.ph !== "n") continue;
        const nx = segs[i + 1]!.ph;
        if (nx === "k" || nx === "ɡ") segs[i]!.ph = "ŋ";
        else if (nx === "c" || nx === "ɟ") segs[i]!.ph = "ɲ";
    }
    return segs;
}
