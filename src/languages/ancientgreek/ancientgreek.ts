/**
 * Ancient Greek (grc) phonemizer — Ἑλληνική, the POLYTONIC Greek script, targeting the reconstructed 5th-century
 * BCE CLASSICAL ATTIC pronunciation (Allen, *Vox Graeca*), canonical IPA. The classical
 * Hellenic counterpart to the Classical-Latin bring-up. A grapheme scan over the NFD-decomposed polytonic text:
 *   ★ Vowels α ε η ι ο υ ω → [a e ɛː i o y ɔː] (η/ω are LONG mid; υ is the front-rounded [y]); the MACRON marks
 *     length on α ι υ (ᾱ→aː). DIPHTHONGS: αι→[ai̯], ει→[eː], οι→[oi̯], υι→[yi̯], αυ→[au̯], ευ→[eu̯], ου→[uː],
 *     ηυ→[ɛːu̯], ωυ→[ɔːu̯]; the IOTA SUBSCRIPT (ᾳ ῃ ῳ) → long vowel + [i̯]; a DIAERESIS breaks a diphthong.
 *   ★ Consonants: the ASPIRATES θ φ χ → [tʰ pʰ kʰ], β γ δ → [b ɡ d], ζ→[zd], ξ→[ks], ψ→[ps]; γ before a velar
 *     (γ κ χ ξ) → [ŋ] (ἄγγελος→áŋɡelos); ρ/σ/etc. direct.
 *   ★ ROUGH BREATHING (dasia ῾) on a word-initial vowel → a prefixed [h] (ἵππος→híppos); SMOOTH breathing → ∅.
 *   ★ PITCH ACCENT (acute/grave/circumflex) is emitted on the vowel and folded by the eval (the Latin treatment).
 * Referee: wikipron grc_grek (human, {{grc-IPA}} 5th-BCE Attic row).
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { numberToWords } from "./numbers.ts";

// Combining marks (NFD): breathings, accents, iota subscript, diaeresis, length.
const ROUGH = "̔", SMOOTH = "̓";
const ACUTE = "́", GRAVE = "̀", CIRCUM = "͂";
const SUBSCRIPT = "ͅ", DIAERESIS = "̈", MACRON = "̄", BREVE = "̆";
const ACCENTS = new Set([ACUTE, GRAVE, CIRCUM]);
const MARKS = new Set([ROUGH, SMOOTH, ACUTE, GRAVE, CIRCUM, SUBSCRIPT, DIAERESIS, MACRON, BREVE]);

// Base vowel letter → [short, long] IPA. η ω are inherently long; α ι υ take length from the macron/subscript.
const VOWEL: Record<string, [string, string]> = {
    α: ["a", "aː"], ε: ["e", "e"], η: ["ɛː", "ɛː"], ι: ["i", "iː"], ο: ["o", "o"], υ: ["y", "yː"], ω: ["ɔː", "ɔː"],
};
// Base consonant letter → IPA (γ is context-sensitive; handled in the scan).
const CONS: Record<string, string> = {
    β: "b", δ: "d", ζ: "zd", θ: "tʰ", κ: "k", λ: "l", μ: "m", ν: "n", ξ: "ks", π: "p",
    ρ: "r", σ: "s", ς: "s", τ: "t", φ: "pʰ", χ: "kʰ", ψ: "ps", ϝ: "w",
};
const VELAR = new Set(["ɡ", "k", "kʰ", "ks"]); // γ → [ŋ] before one of these (the ⟨γγ γκ γχ γξ⟩ nasal)
// Diphthong: a base vowel + an offglide ⟨ι⟩/⟨υ⟩ → the diphthong IPA (unless the offglide has a diaeresis).
const DIPHTHONG: Record<string, string> = {
    αι: "ai̯", αυ: "au̯", ει: "eː", ευ: "eu̯", οι: "oi̯", ου: "uː", υι: "yː", ηυ: "ɛːu̯", ωυ: "ɔːu̯", ηι: "ɛːi̯", ωι: "ɔːi̯",
};
// ⟨σ⟩ → [z] before a VOICED consonant (β γ δ μ ν λ ρ): Λέσβια→lézbia, Σμύρνα→zmýrna (the standard assimilation).
const VOICED_AFTER_S = new Set(["β", "γ", "δ", "μ", "ν", "λ", "ρ"]);

interface Seg { ph: string; accent: string }

/** One Ancient Greek (polytonic) word → canonical IPA (5th-BCE Attic). */
export function phonemizeWord(word: string): string {
    const s = [...word.normalize("NFD").toLowerCase()];
    // Group base letters with their following combining marks.
    interface Unit { base: string; marks: Set<string> }
    const units: Unit[] = [];
    for (let i = 0; i < s.length; i++) {
        const c = s[i]!;
        if (MARKS.has(c)) continue; // stray mark (shouldn't lead)
        const marks = new Set<string>();
        while (i + 1 < s.length && MARKS.has(s[i + 1]!)) marks.add(s[++i]!);
        units.push({ base: c, marks });
    }
    // Rough breathing on a word-INITIAL vowel → a prefixed [h].
    let hPrefix = "";
    if (units.length && VOWEL[units[0]!.base] !== undefined && units[0]!.marks.has(ROUGH)) hPrefix = "h";
    // (A rough breathing may also sit on the 2nd vowel of an initial diphthong — αὑ, εὑ.)
    if (units.length >= 2 && VOWEL[units[0]!.base] !== undefined && units[1]!.marks.has(ROUGH)) hPrefix = "h";

    const segs: Seg[] = [];
    for (let i = 0; i < units.length; i++) {
        const u = units[i]!, base = u.base;
        if (VOWEL[base] !== undefined) {
            const next = units[i + 1];
            const hasAcc = (m?: Set<string>): boolean => !!m && (m.has(ACUTE) || m.has(GRAVE) || m.has(CIRCUM));
            const ownAccent = hasAcc(u.marks) ? "́" : "";
            // DIPHTHONG: base + ⟨ι υ⟩ offglide (unless the offglide has a DIAERESIS) — the diphthong carries an
            // accent from EITHER element (μοῦσα: circumflex on the ⟨υ⟩).
            if (next && (next.base === "ι" || next.base === "υ") && !next.marks.has(DIAERESIS)) {
                const key = base + next.base;
                if (DIPHTHONG[key] !== undefined) {
                    segs.push({ ph: DIPHTHONG[key]!, accent: ownAccent || (hasAcc(next.marks) ? "́" : "") });
                    i++; continue;
                }
            }
            // IOTA SUBSCRIPT → long vowel + [i̯]; MACRON → long; else the base [short/long]. A plain vowel keeps
            // only ITS OWN accent (not the next vowel's — θεός→tʰeós, the acute stays on the ⟨ο⟩).
            const long = u.marks.has(MACRON) || u.marks.has(SUBSCRIPT);
            let ph = VOWEL[base]![long && !u.marks.has(BREVE) ? 1 : 0]!;
            if (u.marks.has(SUBSCRIPT)) ph += "i̯";
            segs.push({ ph, accent: ownAccent });
            continue;
        }
        // γ → [ŋ] before a velar (γ κ χ ξ) OR ⟨μ⟩ (the agma: δεδεγμένος→dedeŋménos), else [ɡ].
        if (base === "γ") {
            const nx = units[i + 1]?.base ?? "";
            const nph = CONS[nx] ?? (nx === "γ" ? "ɡ" : "");
            segs.push({ ph: VELAR.has(nph) || nx === "γ" || nx === "μ" ? "ŋ" : "ɡ", accent: "" });
            continue;
        }
        // ⟨σ ς⟩ → [z] before a voiced consonant.
        if ((base === "σ" || base === "ς") && VOICED_AFTER_S.has(units[i + 1]?.base ?? "")) {
            segs.push({ ph: "z", accent: "" });
            continue;
        }
        // ⟨ρ⟩ → the VOICELESS [r̥] when word-initial (initial ρ always carries the rough breathing ῥ), when it
        // carries the rough mark, or in a ⟨ρρ⟩ cluster (Πύρρα→pýr̥r̥a); a plain intervocalic ⟨ρ⟩ is [r].
        if (base === "ρ") {
            const voiceless = i === 0 || u.marks.has(ROUGH) || units[i - 1]?.base === "ρ" || units[i + 1]?.base === "ρ";
            segs.push({ ph: voiceless ? "r̥" : "r", accent: "" });
            continue;
        }
        if (CONS[base] !== undefined) segs.push({ ph: CONS[base]!, accent: "" });
        // else: punctuation/unknown → skip
    }
    // ASPIRATE ASSIMILATION: a plain stop before its aspirate counterpart aspirates too (πφ→[pʰpʰ], τθ→[tʰtʰ],
    // κχ→[kʰkʰ]: Σαπφώ→sapʰpʰɔ́ː, Βάκχε→bákʰkʰe).
    for (let k = 0; k < segs.length - 1; k++) {
        const a = segs[k]!.ph, b = segs[k + 1]!.ph;
        if ((a === "p" && b === "pʰ") || (a === "t" && b === "tʰ") || (a === "k" && b === "kʰ")) segs[k]!.ph = b;
    }
    // Place the pitch accent (combining acute) on the vowel that carries it, then join.
    const body = segs.map((x) => x.ph + x.accent).join("");
    return (hPrefix + body).normalize("NFC");
}

// Polytonic Greek letters + all the combining diacritics (̀-ͯ) + the precomposed range (Ἀ-ῼ). Word / punct.
const TOKEN = /([Ͱ-Ͽἀ-῿̀-ͯ]+)|(\d+)|([.·;!?;·,:])/gu;

class AncientGreekPhonemizer implements Phonemizer {
    text(input: string): string {
        return assembleClauses(input, TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(m[1]));
            // Numbers: compose the Greek numeral phrase (καὶ-linked, myriad-grouped), then phonemize each word.
            else if (m[2]) for (const wd of numberToWords(Number(m[2])).split(" ")) sink.emit(phonemizeWord(wd));
            else if (m[3]) sink.pause(m[3] === "." || m[3] === ";" || m[3] === ";" ? "." : ",");
        });
    }
}

/** Build the Ancient Greek phonemizer (polytonic → 5th-BCE Attic reconstructed IPA). */
export function createAncientGreek(): Phonemizer {
    return new AncientGreekPhonemizer();
}
