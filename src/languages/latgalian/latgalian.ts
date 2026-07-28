/**
 * Native Latgalian / latgaļu volūda (ltg) text phonemizer — canonical IPA, espeak-independent. Latgalian is an EASTERN
 * BALTIC language (~150k, Latgale in eastern Latvia), a close sibling of Latvian — the fleet's 3rd Baltic language
 * (after Latvian, Lithuanian). A near-phonemic Latin orthography with macron length + háček sibilants; a greedy scan
 * with the Latgalian PALATALIZATION system.
 *
 *   ★ THE ⟨i⟩/⟨y⟩ SOFT/HARD SPLIT — the signature: ⟨i ī e ē⟩ are FRONT and PALATALIZE the preceding consonant(s)
 *     (ci→[t͡sʲi], bet→[bʲæt], nest→[nʲæst]), but ⟨y⟩→[ɨ] is a HARD central vowel that does NOT (cylvāks→[t͡sɨlvaːks]).
 *   ★ Vowels: ⟨a e i o u y⟩→[a æ i ɔ u ɨ]; macron = LONG (⟨ā ē ī ū ō ȳ⟩→[aː æː iː uː ɔː ɨː]). Consonants: ⟨c⟩→[t͡s],
 *     ⟨č⟩→[t͡ʃ], ⟨š⟩→[ʃ], ⟨ž⟩→[ʒ], ⟨dz⟩→[d͡z], ⟨dž⟩→[d͡ʒ], the written palatals ⟨ļ ņ ģ ķ ř⟩→[lʲ nʲ ɡʲ kʲ rʲ], ⟨v⟩→[w]
 *     in a coda. Baltic VOICING assimilation in obstruent clusters (Latgola→[ladɡɔla]).
 *
 * Latgalian's pitch ACCENT (level/falling/broken, marked in the narrow referee) is not written → not emitted (folds).
 * Referee: wikipron ltg_latn narrow (488) + kaikki Latgalian (516). See docs/investigations/ltg_native_bringup_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";

// Multi-char graphemes (longest-first): the affricate digraphs.
const DIGRAPHS: [string, string][] = [["dz", "d͡z"], ["dž", "d͡ʒ"], ["tz", "d͡z"], ["ch", "x"]];
const VOWEL: Record<string, string> = {
    "a": "a", "ā": "aː", "e": "æ", "ē": "æː", "i": "i", "ī": "iː", "o": "ɔ", "ō": "ɔː",
    "u": "u", "ū": "uː", "y": "ɨ", "ȳ": "ɨː",
};
const FRONT = new Set([..."iīeē"]); // the vowel LETTERS that palatalize a preceding consonant (NOT ⟨y⟩)
const CONS: Record<string, string> = {
    "b": "b", "c": "t͡s", "č": "t͡ʃ", "d": "d", "f": "f", "g": "ɡ", "ģ": "ɡʲ", "h": "x", "j": "j", "k": "k",
    "ķ": "kʲ", "l": "l", "ļ": "lʲ", "m": "m", "n": "n", "ņ": "nʲ", "p": "p", "r": "r", "ř": "rʲ", "s": "s",
    "š": "ʃ", "t": "t", "v": "v", "z": "z", "ž": "ʒ",
};
const VOICE: Record<string, string> = { "p": "b", "t": "d", "k": "ɡ", "s": "z", "ʃ": "ʒ", "t͡s": "d͡z", "t͡ʃ": "d͡ʒ", "f": "v", "x": "ɣ" };
const DEVOICE: Record<string, string> = { "b": "p", "d": "t", "ɡ": "k", "z": "s", "ʒ": "ʃ", "d͡z": "t͡s", "d͡ʒ": "t͡ʃ", "v": "f" };

interface Seg { ph: string; vowel: boolean; frontTrigger: boolean; }

/** One Latgalian word → canonical IPA (scan → palatalization → voicing assimilation). */
export function phonemizeWord(word: string): string {
    const s = [...word.normalize("NFC").toLowerCase()];
    const segs: Seg[] = [];
    for (let i = 0; i < s.length; i++) {
        const c = s[i]!;
        const dg = DIGRAPHS.find(([k]) => c === k[0] && s[i + 1] === k[1]);
        if (dg) { segs.push({ ph: dg[1], vowel: false, frontTrigger: false }); i++; continue; }
        if (VOWEL[c] !== undefined) { segs.push({ ph: VOWEL[c]!, vowel: true, frontTrigger: FRONT.has(c) }); continue; }
        // ⟨v⟩ → [w] only BEFORE A CONSONANT (sovs→sows); it stays [v] before a vowel and WORD-FINALLY (where the
        // voicing pass then devoices it: div→dʲif, not dʲiw).
        if (c === "v") {
            const nx = s[i + 1];
            const beforeCons = nx !== undefined && VOWEL[nx] === undefined && nx !== "'" && nx !== "’";
            segs.push({ ph: beforeCons ? "w" : "v", vowel: false, frontTrigger: false });
            continue;
        }
        if (CONS[c] !== undefined) segs.push({ ph: CONS[c]!, vowel: false, frontTrigger: false });
        // else: apostrophe, hyphen, stray marks — skip
    }
    // ★ PALATALIZATION: a consonant is palatalized if its NEXT vowel (skipping the consonant cluster) is a FRONT
    // vowel ⟨i ī e ē⟩ — the whole ONSET before a front vowel softens (bazneica→bazʲnʲɛit͡sa). ★ /r/ is OPAQUE: an
    // obstruent+⟨r⟩ cluster stays HARD (treis→trɛis, not tʲrʲæis) — a consonant before ⟨r⟩ doesn't soften, and ⟨r⟩ in
    // a cluster (preceded by a consonant) doesn't soften; a SIMPLE ⟨r⟩ onset still does (svareigs→sʋarʲɛiks).
    for (let k = 0; k < segs.length; k++) {
        const seg = segs[k]!;
        if (seg.vowel || seg.ph.endsWith("ʲ") || seg.ph === "j") continue;
        if (segs[k + 1]?.ph === "r") continue; // consonant before ⟨r⟩ stays hard
        if (seg.ph === "r" && k > 0 && !segs[k - 1]!.vowel) continue; // ⟨r⟩ in a cluster stays hard
        for (let m = k + 1; m < segs.length; m++) {
            const t = segs[m]!;
            if (t.ph === "r") break; // /r/ blocks leftward spread
            if (t.vowel) { if (t.frontTrigger) seg.ph += "ʲ"; break; }
        }
    }
    // ★ t-EPENTHESIS: a word-final ⟨s⟩/⟨š⟩ after a nasal /n ņ/ surfaces with an epenthetic [t] → the affricate
    // [t͡s]/[t͡ʃ] (sens→sʲænt͡s, kaimiņš→kaimʲinʲt͡ʃ; the -ons nominatives + -eņš/-iņš diminutives).
    if (segs.length >= 2) {
        const last = segs[segs.length - 1]!, prev = segs[segs.length - 2]!;
        const prevNasal = prev.ph === "n" || prev.ph === "nʲ";
        if (prevNasal && last.ph === "s") last.ph = prev.ph === "nʲ" ? "t͡sʲ" : "t͡s";
        else if (prevNasal && last.ph === "ʃ") last.ph = "t͡ʃ";
    }
    // ★ VOICING assimilation (regressive) within obstruent clusters: a voiced/voiceless obstruent assimilates to the
    // LAST obstruent of the cluster; a word-final obstruent devoices (Latgola→ladɡɔla; absurds→apsurt͡s).
    for (let k = segs.length - 1; k >= 0; k--) {
        const base = segs[k]!.ph.replace(/ʲ$/u, "");
        const pal = segs[k]!.ph.endsWith("ʲ") ? "ʲ" : "";
        const next = segs[k + 1];
        if (next === undefined || next.vowel || !/[bdɡzʒvszʃfxptk]|t͡s|t͡ʃ|d͡z|d͡ʒ/u.test(next.ph.replace(/ʲ$/u, ""))) {
            // word-final or before a sonorant/vowel: devoice a word-final obstruent only
            if (next === undefined && DEVOICE[base] !== undefined) segs[k]!.ph = DEVOICE[base] + pal;
            continue;
        }
        const nb = next.ph.replace(/ʲ$/u, "");
        if (DEVOICE[nb] !== undefined && VOICE[base] !== undefined) segs[k]!.ph = VOICE[base] + pal; // next voiced → voice
        else if (VOICE[nb] !== undefined && DEVOICE[base] !== undefined) segs[k]!.ph = DEVOICE[base] + pal; // next voiceless → devoice
    }
    return segs.map((x) => x.ph).join("");
}

// Latgalian Latin + macron/háček letters. Word / number / punctuation.
const TOKEN = /([a-zāēīōūȳčšžģķļņř'’]+)|(\d+)|([.?!,;:…])/giu;

class LatgalianPhonemizer implements Phonemizer {
    text(input: string): string {
        return assembleClauses(input.normalize("NFC"), TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(m[1]));
            else if (m[2]) sink.emit(m[2]); // numbers deferred
            else if (m[3]) sink.pause(m[3] === "." || m[3] === "!" || m[3] === "?" ? m[3] : ",");
        });
    }
}

/** Build the Latgalian phonemizer (Latin scan + the ⟨i⟩/⟨y⟩ palatalization + Baltic voicing). */
export function createLatgalian(): Phonemizer {
    return new LatgalianPhonemizer();
}
