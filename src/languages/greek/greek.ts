/**
 * Modern Greek (el) phonemizer — Hellenic, the Greek script, canonical IPA, espeak-independent. A CONTEXT-SENSITIVE
 * left-to-right scan (not a table map). The historical spellings collapse to /a e i o u/; the interesting rules:
 *   • VELAR PALATALISATION before a front vowel [e i]: κ→c, γ→ʝ, χ→ç; the γ-nasal digraphs ⟨γγ γκ⟩→ŋɡ (→ŋɟ before
 *     front; word-initial ⟨γκ⟩ has no [ŋ]).
 *   • VOICED STOPS: ⟨μπ ντ⟩ word-initial → [b d], MEDIAL (before a vowel) → prenasalised [mb nd]; before a
 *     consonant they are the separate letters μ+π / ν+τ. ⟨τσ τζ⟩→t͡s d͡z.
 *   • SYNIZESIS: an UNSTRESSED [i] (ι/η/υ/ει/οι) before another vowel is not syllabic — after λ/ν it palatalises
 *     the consonant (→ʎ ɲ, the [i] absorbed), after κ/γ/χ likewise (→c ʝ ç), after any other consonant it becomes
 *     a glide [ç] (voiceless C) / [ʝ] (voiced C). A STRESSED [í] stays a full vowel (needs the tonos, tracked below).
 *   • ⟨αυ ευ⟩ → a/e + [v]/[f] and ⟨σ⟩ → [z] by the following consonant's voicing; double consonants simplify.
 * Stress itself is not emitted (the referees don't mark it). See docs/investigations/el_native_bringup_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { numberToWords } from "./numbers.ts";
import { MANIFEST } from "./manifest.ts";

const V = MANIFEST.vowels;
const VD = MANIFEST.vowelDigraphs;
const C = MANIFEST.consonants;
const CLAUSE_MARK = MANIFEST.clausePunctuation;

// Stress tonos → base vowel (stress is tracked separately, then stripped from the output).
const TONOS: Record<string, string> = { ά: "α", έ: "ε", ή: "η", ί: "ι", ό: "ο", ύ: "υ", ώ: "ω", ΐ: "ϊ", ΰ: "ϋ" };
const STRESSED = new Set("άέήίόύώΐΰ");
const isCons = (ch: string): boolean => C[ch] !== undefined && ch !== "ς";
const VOICELESS = new Set(["π", "τ", "κ", "θ", "φ", "χ", "σ", "ς", "ξ", "ψ"]);
// Palatal replacement of a consonant that swallows a following synizesis [i].
const SYN_PAL: Record<string, string> = { λ: "ʎ", ν: "ɲ", κ: "c", γ: "ʝ", χ: "ç" };
// Voiced sounds that turn ⟨αυ ευ⟩ → [av ev] (else [af ef]).
const AU_VOICED = new Set(["β", "γ", "δ", "ζ", "λ", "μ", "ν", "ρ", "μπ", "ντ", "γκ", "γγ"]);
// Consonants that voice a preceding ⟨σ⟩ → [z] (before a voiced obstruent/nasal).
const SIGMA_VOICED = new Set(["β", "γ", "δ", "μ", "ν", "μπ", "ντ", "γκ", "γγ"]);

/** Match a vowel grapheme (digraph first) at position i → [orthLen, sound] or null. */
function matchVowel(w: string, i: number): [number, string] | null {
    const two = w.slice(i, i + 2);
    if (VD[two] !== undefined) return [2, VD[two]!];
    const one = w[i];
    if (one !== undefined && V[one] !== undefined) return [1, V[one]!];
    return null;
}

/** Phonemize a single Modern Greek word to canonical IPA (no stress mark). */
export function phonemizeWord(word: string): string {
    const raw = word.toLowerCase();
    // Which orthographic positions carry the stress tonos — needed for synizesis (unstressed i only).
    const stressed = [...raw].map((ch) => STRESSED.has(ch));
    const w = [...raw].map((ch) => TONOS[ch] ?? ch).join("");
    let out = "";
    let i = 0;
    const n = w.length;

    // Stress-aware vowel match: a tonos on the FIRST element of a would-be digraph marks HIATUS (τσάι = t͡s+a+i,
    // ρολόι = ɾo.lo.i), so the digraph must NOT merge — take just the single vowel there.
    const matchV = (p: number): [number, string] | null => {
        const m = matchVowel(w, p);
        if (m !== null && m[0] === 2 && stressed[p]) {
            const one = w[p];
            if (one !== undefined && V[one] !== undefined) return [1, V[one]!];
        }
        return m;
    };
    const front = (p: number): boolean => {
        const m = matchV(p);
        return m !== null && (m[1] === "e" || m[1] === "i");
    };
    // Is the vowel grapheme at p an UNSTRESSED [i]? (a synizesis trigger)
    const unstressedI = (p: number): [number, string] | null => {
        const m = matchV(p);
        if (m === null || m[1] !== "i") return null;
        for (let k = 0; k < m[0]; k++) if (stressed[p + k]) return null;
        return m;
    };

    while (i < n) {
        const ch = w[i]!;
        const two = w.slice(i, i + 2);
        // γ-nasal digraphs ⟨γγ γκ γχ γξ⟩ → [ŋ] + stop/fricative (palatalised before a front vowel). Word-initial
        // ⟨γκ⟩ has no [ŋ]. Before the double-consonant rule so ⟨γγ⟩ isn't taken for a geminate.
        if (two === "γγ" || two === "γκ" || two === "γχ" || two === "γξ") {
            const fr = front(i + 2);
            const nasal = two === "γκ" && i === 0 ? "" : "ŋ";
            out += nasal + (two === "γξ" ? "ks" : two === "γχ" ? (fr ? "ç" : "x") : fr ? "ɟ" : "ɡ");
            i += 2;
            continue;
        }
        // ⟨μπ ντ⟩ before a VOWEL or a LIQUID (ρ λ) → voiced stop: word-initial [b d] / medial prenasalised [mb nd]
        // (μπλε→ble, άντρας→andras). Before an OBSTRUENT they fall through to the separate letters μ+π / ν+τ
        // (Πέμπτη → …mpti).
        const afterMpNt = w[i + 2];
        if (
            (two === "μπ" || two === "ντ") &&
            (matchVowel(w, i + 2) !== null || afterMpNt === "ρ" || afterMpNt === "λ")
        ) {
            const voiced = two === "μπ" ? "b" : "d";
            out += i === 0 ? voiced : (two === "μπ" ? "m" : "n") + voiced;
            i += 2;
            continue;
        }
        if (two === "τσ" || two === "τζ") {
            out += two === "τσ" ? "t͡s" : "d͡z";
            i += 2;
            continue;
        }
        // Double consonant → simplify.
        if (ch === w[i + 1] && isCons(ch)) {
            i++;
            continue;
        }
        // ⟨αυ ευ⟩ → a/e + [v]/[f] by the following sound. A tonos on the α/ε is HIATUS (άυλος = a.i…), not this digraph.
        if ((two === "αυ" || two === "ευ") && !stressed[i]) {
            const nx2 = w.slice(i + 2, i + 4);
            const nx1 = w[i + 2];
            const voiced =
                i + 2 >= n ||
                AU_VOICED.has(nx2) ||
                (nx1 !== undefined && (AU_VOICED.has(nx1) || matchVowel(w, i + 2) !== null));
            out += (two === "αυ" ? "a" : "e") + (voiced ? "v" : "f");
            i += 2;
            continue;
        }
        // Vowel digraph (stress-aware: a tonos on the first element = hiatus, no merge).
        const vm = matchV(i);
        if (vm !== null && vm[0] === 2) {
            out += vm[1];
            i += 2;
            continue;
        }
        // Single consonant.
        if (C[ch] !== undefined) {
            // SYNIZESIS — only the RELIABLE subset: an unstressed [i] immediately before a STRESSED vowel (the
            // productive -ιά/-ιό pattern: κοιλιά→[ciˈʎa], Λειβαδιά→[livaˈðʝa]). Here the [i] is a glide/palatalisation,
            // not syllabic. (The broader unstressed-i-before-ANY-vowel synizesis is lexical/register — the careful
            // referees mostly keep the [i], e.g. Κύριος→[ˈciɾios] — so we do NOT apply it; a lexicon is the path.)
            const iv = unstressedI(i + 1);
            if (iv !== null) {
                const nv = matchV(i + 1 + iv[0]);
                let nvStressed = false;
                if (nv !== null) for (let k = 0; k < nv[0]; k++) if (stressed[i + 1 + iv[0] + k]) nvStressed = true;
                if (nvStressed) {
                    if (SYN_PAL[ch] !== undefined) out += SYN_PAL[ch]!; // λ ν κ γ χ → palatal, [i] absorbed
                    else out += C[ch]! + (VOICELESS.has(ch) ? "ç" : "ʝ"); // other C → C + glide
                    i += 1 + iv[0];
                    continue;
                }
            }
            // Velar palatalisation before a front vowel (the [i] is kept: γίδα → ʝiða).
            if ((ch === "κ" || ch === "γ" || ch === "χ") && front(i + 1)) {
                out += ch === "κ" ? "c" : ch === "γ" ? "ʝ" : "ç";
                i++;
                continue;
            }
            // ⟨σ⟩ → [z] before a voiced consonant.
            if (ch === "σ") {
                const n1 = w[i + 1];
                out += SIGMA_VOICED.has(w.slice(i + 1, i + 3)) || (n1 !== undefined && SIGMA_VOICED.has(n1)) ? "z" : "s";
                i++;
                continue;
            }
            out += C[ch]!;
            i++;
            continue;
        }
        // Single vowel.
        if (vm !== null) {
            out += vm[1];
            i++;
            continue;
        }
        i++; // unknown → skip
    }
    return out;
}

// A word (Greek letters) / number / punctuation. Greek uses ; as the question mark and · as a semicolon.
const TOKEN = /([Ͱ-Ͽἀ-῿]+)|(\d+)|([.!;?…,:·])/gu;

class GreekPhonemizer implements Phonemizer {
    text(input: string): string {
        return assembleClauses(input, TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(m[1]));
            else if (m[2])
                for (const wd of numberToWords(Number(m[2])).split(" ")) sink.emit(phonemizeWord(wd));
            else if (m[3]) {
                const mk = CLAUSE_MARK[m[3]];
                if (mk) sink.pause(mk);
            }
        });
    }
}

/** Build the Modern Greek phonemizer (context-sensitive rule g2p; stress not emitted). */
export function createGreek(): Phonemizer {
    return new GreekPhonemizer();
}
