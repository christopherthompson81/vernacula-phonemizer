/**
 * Khmer / ភាសាខ្មែរ (km) text phonemizer — Austroasiatic (Mon-Khmer), the Khmer abugida, canonical IPA,
 * espeak-independent. Cambodia's national language (~18M). NON-tonal but SESQUISYLLABIC.
 *
 * Khmer's defining feature is the TWO CONSONANT SERIES: every base consonant belongs to the a-series (1st,
 * inherent ɑː) or the o-series (2nd, inherent ɔː), and the SAME vowel sign is pronounced differently depending
 * on the governing series (ក+ា = kaː but គ+ា = kiə). The algorithm below follows Huffman (1970), Cambodian
 * System of Writing:
 *   1. UNIT PASS — scan base consonant + coeng (្) subscripts + dependent vowel sign + diacritics into "units".
 *   2. CODA PASS — the last bare unit (no written vowel) attaches as the coda of the previous syllable; a
 *      NASAL superscript in a medial cluster (CVN-) closes the previous syllable and its subscript opens the
 *      next (តម្រង → tɑm.rɑŋ, not tɑ.mrɑŋ). A medial bare unit between two vowelled syllables is its own
 *      minor syllable (ចេតនា → ceːtaʔnaː).
 *   3. RENDER PASS — GOVERNANCE (Huffman VI.B): a vowel's series is set by the LAST PRECEDING stop/spirant
 *      (dominant) consonant, tracked ACROSS THE WHOLE WORD so a passive-initial syllable harmonises to the
 *      last dominant (ចេតនា: ន harmonises to a-series from ត). Bare-vowel syllables: SHORT inherent (ɑ/ɔ) as
 *      an unstressed presyllable or a closed syllable, LONG inherent (ɑː/ɔː) only when stressed-and-open.
 * Series values + the two-reading vowel table were DERIVED from wikipron khm (7107 words). Khmer Unicode is
 * logical-order, so no leading-vowel reorder is needed. See docs/investigations/km_native_bringup_investigation.md.
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
const TOANDAKHIAT = "៍"; // U+17CD — silences the consonant it sits on
const MUUSIKATOAN = "៉"; // U+17C9 — converts a 2nd-series (o) consonant to 1st-series (a)
const TRIISAP = "៊"; // U+17CA — converts a 1st-series (a) consonant to 2nd-series (o)
// Combining diacritics consumed after a unit's vowel (register shifters handled separately, rest ignored).
const DIACRITICS = new Set(["់", "៉", "៊", "៌", "៍", "៎", "៏", "័", "៑", "៓", "ៈ"]);
// Passive consonants = continuants (nasals, semivowels, liquids); everything else is a dominant stop/spirant.
const PASSIVE = new Set(["ង", "ញ", "ណ", "ន", "ម", "យ", "រ", "ល", "វ", "ឡ"]);
const NASAL = new Set(["ង", "ញ", "ណ", "ន", "ម"]);

interface Unit {
    ons: string[]; // onset consonant letters (base + coeng subscripts)
    vs: string | null; // dependent vowel sign, or null (inherent)
    ser: "a" | "o" | null; // register-shifter override, if any
    coda: string | null; // coda consonant letter, or null
}

/** One Khmer word → canonical IPA (segmental; two-series sesquisyllabic abugida). */
export function phonemizeWord(word: string): string {
    const s = [...word];
    const n = s.length;

    // ---- PASS 1: scan into orthographic units ---------------------------------------------------------
    const units: Unit[] = [];
    let i = 0;
    while (i < n) {
        const c = s[i]!;
        if (!(c in DEF.consonants)) { i += 1; continue; } // independent vowels / stray marks — skip (Phase 1)
        const ons = [c];
        let ser: "a" | "o" | null = null;
        i += 1;
        // register shifters can sit directly on the base consonant
        while (s[i] === MUUSIKATOAN || s[i] === TRIISAP) { ser = s[i] === MUUSIKATOAN ? "a" : "o"; i += 1; }
        // coeng subscripts (្ + consonant): a written cluster
        while (s[i] === COENG && (s[i + 1] ?? "") in DEF.consonants) {
            ons.push(s[i + 1]!);
            i += 2;
            while (s[i] === MUUSIKATOAN || s[i] === TRIISAP) { ser = s[i] === MUUSIKATOAN ? "a" : "o"; i += 1; }
        }
        const vs = (s[i] ?? "") in DEF.vowels ? s[i]! : null;
        if (vs) i += 1;
        // diacritics after the vowel — ៍ silences the whole unit; the rest are consumed and ignored
        let silent = false;
        while (DIACRITICS.has(s[i] ?? "")) { if (s[i] === TOANDAKHIAT) silent = true; i += 1; }
        if (!silent) units.push({ ons, vs, ser, coda: null });
    }
    if (units.length === 0) return word;

    // ---- PASS 2: coda assignment ----------------------------------------------------------------------
    // A trailing bare unit (no written vowel) supplies the coda of the previous syllable; any subscript in a
    // final cluster (ចន្ទ → can) is silent, so only ons[0] is taken.
    const last = units[units.length - 1]!;
    if (units.length >= 2 && last.vs === null && units[units.length - 2]!.coda === null) {
        units[units.length - 2]!.coda = last.ons[0]!;
        units.pop();
    }
    // Nasal-superscript medial cluster (CVN-): a nasal at the head of a medial cluster closes the PREVIOUS
    // syllable and its subscript opens this one (តម្រង → tɑm.rɑŋ). Only when the previous syllable can still
    // take a coda; word-initial nasal clusters (ម្រាម → mriəm) are left as genuine onset clusters.
    for (let u = 1; u < units.length; u++) {
        const cur = units[u]!;
        const prev = units[u - 1]!;
        if (cur.ons.length >= 2 && NASAL.has(cur.ons[0]!) && prev.coda === null) {
            prev.coda = cur.ons[0]!;
            cur.ons = cur.ons.slice(1);
        }
    }

    // ---- PASS 3: render with GOVERNANCE running-state -------------------------------------------------
    let lastDom: "a" | "o" | null = null; // series of the last dominant (stop/spirant) consonant seen
    let out = "";
    for (let u = 0; u < units.length; u++) {
        const unit = units[u]!;
        // onset IPA — ⟨ប⟩ is [p] as the first member of a cluster, [ɓ] as a simple onset
        let onset = "";
        for (let k = 0; k < unit.ons.length; k++) {
            const letter = unit.ons[k]!;
            onset += letter === "ប" && unit.ons.length > 1 && k === 0 ? "p" : DEF.consonants[letter]![0];
        }
        // governing series: register-shifter override, else the LAST dominant among the onset consonants,
        // else the running last-dominant (vowel harmony), else this onset's own last series.
        let gov: "a" | "o";
        if (unit.ser) {
            gov = unit.ser;
            lastDom = gov;
        } else {
            let onsetDom: "a" | "o" | null = null;
            for (const letter of unit.ons) if (!PASSIVE.has(letter)) onsetDom = DEF.consonants[letter]![1] as "a" | "o";
            if (onsetDom) { gov = onsetDom; lastDom = gov; }
            else gov = lastDom ?? (DEF.consonants[unit.ons[unit.ons.length - 1]!]![1] as "a" | "o");
        }
        const oIdx = gov === "a" ? 0 : 1;
        const codaIpa = unit.coda ? DEF.codas[unit.coda] ?? "" : "";
        // nucleus
        let nucleus: string;
        if (unit.vs) {
            nucleus = DEF.vowels[unit.vs]![oIdx]!;
        } else if (u === units.length - 1) {
            // stressed (last) syllable: LONG inherent when open, SHORT inherent when closed (Huffman IX.A.2:
            // 1st-series /a/, 2nd-series /uə/). A silent coda (ⁿ⟨រ⟩) leaves the syllable phonetically open.
            nucleus = codaIpa === "" ? DEF.inherent[oIdx]! : (gov === "a" ? "ɑ" : "uə");
        } else {
            nucleus = gov === "a" ? "ɑ" : "ɔ"; // unstressed presyllable → reduced short inherent
        }
        out += onset + nucleus + codaIpa;
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
