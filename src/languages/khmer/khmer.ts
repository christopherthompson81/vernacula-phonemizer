/**
 * Khmer / ភាសាខ្មែរ (km) text phonemizer — Austroasiatic (Mon-Khmer), the Khmer abugida, canonical IPA,
 * espeak-independent. Cambodia's national language (~18M). NON-tonal.
 *
 * Khmer's defining feature is the TWO CONSONANT SERIES: every base consonant belongs to the a-series (1st,
 * inherent ɑː) or the o-series (2nd, inherent ɔː), and the SAME vowel sign is pronounced differently depending on
 * the series (ក+ា = kaː but គ+ា = kiə). Consonant clusters are written with SUBSCRIPTS (coeng ្ + consonant); the
 * consonant nearest the vowel governs the series. The g2p scans base → coeng subscripts → vowel sign (read by
 * series) → coda. Series values + the two-reading vowel table were DERIVED from wikipron khm (7107 words).
 * Khmer Unicode is logical-order (base before vowel), so no leading-vowel reorder is needed (unlike Thai/Lao).
 *
 * See docs/investigations/km_native_bringup_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { loadManifest } from "../../core/loadManifest.ts";

interface KhmerDef {
    consonants: Record<string, [string, string]>;
    vowels: Record<string, [string, string]>;
    codas: Record<string, string>;
    inherent: [string, string];
    clausePunctuation: Record<string, string>;
}

const DEF = loadManifest<KhmerDef>(import.meta.url, "khmer.jsonc");
const COENG = "្"; // U+17D2 — subscript former

/** One Khmer word → canonical IPA (segmental; two-series abugida). */
export function phonemizeWord(word: string): string {
    const s = [...word];
    const n = s.length;
    let out = "";
    let i = 0;
    while (i < n) {
        const c = s[i]!;
        const base = DEF.consonants[c];
        if (!base) { i += 1; continue; } // independent vowels / diacritics / unknown — skip (Phase 1)
        let onset = base[0];
        let ser = base[1]; // "a" | "o" — the series governing the vowel (last consonant before the vowel wins)
        i += 1;
        // coeng subscripts (្ + consonant): a written cluster. The BASE consonant governs the vowel series here
        // (ខ្មែ → kʰmae a-series from ខ, not o-series from ម — confirmed against wikipron). (A proper sesquisyllabic
        // pass — minor syllables + final subscript clusters as codas — is the deferred follow-up.)
        while (s[i] === COENG && DEF.consonants[s[i + 1] ?? ""]) {
            onset += DEF.consonants[s[i + 1]!]![0];
            i += 2;
        }
        const oIdx = ser === "a" ? 0 : 1;
        const vs = DEF.vowels[s[i] ?? ""];
        let nucleus = vs ? vs[oIdx]! : "";
        if (vs) i += 1;
        // coda: a following consonant NOT followed by its own vowel sign (word-final or before a new onset). A
        // trailing subscript ្ + consonant after the coda is SILENT (final cluster ⟨ន្ទ⟩ → coda n, ⟨្ទ⟩ dropped).
        let coda = "";
        const nx = s[i] ?? "";
        if (nx in DEF.codas && !(s[i + 1]! in DEF.vowels) && s[i + 1] !== COENG) {
            coda = DEF.codas[nx]!;
            i += 1;
        }
        // inherent vowel (no vowel sign): SHORT [ɑ/ɔ] in a closed syllable (before a coda), long open otherwise.
        if (!vs) nucleus = coda ? (ser === "a" ? "ɑ" : "ɔ") : DEF.inherent[oIdx]!;
        out += onset + nucleus + coda;
    }
    return out.normalize("NFC");
}

const TOKEN = /([ក-៝]+)|(\d[\d០-៩]*)|([។៕?!,.៖])/gu;

/** Build the Khmer phonemizer. */
export function createKhmer(): Phonemizer {
    return {
        text(input: string): string {
            return assembleClauses(input, TOKEN, (m, sink) => {
                if (m[1]) sink.emit(phonemizeWord(m[1]));
                else if (m[2]) sink.emit(m[2]); // numbers deferred
                else if (m[3]) {
                    const mk = DEF.clausePunctuation[m[3]];
                    if (mk) sink.pause(mk);
                }
            });
        },
    };
}
