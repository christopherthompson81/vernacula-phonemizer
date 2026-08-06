/**
 * Native Papiamentu / Papiamento (pap) text phonemizer — canonical IPA. Papiamentu is an IBERIAN-
 * (Portuguese/Spanish-) lexified CREOLE of the ABC islands (Aruba, Bonaire, Curaçao), ~340k speakers — the fleet's 4th
 * creole (after Haitian, Cape Verdean, Nigerian Pidgin). This targets the CURAÇAO/BONAIRE phonemic orthography, a
 * greedy longest-match scan with two creole hallmarks:
 *
 *   ★ CODA-⟨n⟩ RETENTION (Maurer; Kouwenberg & Murray) — Papiamentu KEEPS a coda ⟨n⟩ (it does NOT delete it):
 *     WORD-FINAL ⟨n⟩ → the velar nasal [ŋ], also nasalizing the vowel (bon→[bõŋ], federashon→[fedeɾaˈʃõŋ]); a ⟨n⟩
 *     before a consonant or a vowel stays [n] (kontra→[ˈkontɾa], Papiamentu→[papiaˈmentu]). (The Wiktionary referee's
 *     Portuguese-style "nasalize + drop the ⟨n⟩" — ʃõ — is a transcription artifact; the dropped ⟨n⟩ is folded.)
 *   ★ The digraphs ⟨ch⟩→[t͡ʃ], ⟨sh⟩→[ʃ], ⟨dj⟩→[d͡ʒ], ⟨zj⟩→[ʒ]; the OPEN-vowel letters ⟨è⟩→[ɛ], ⟨ò⟩→[ɔ], ⟨ù⟩→[ø]
 *     and the ⟨ou⟩ diphthong → [ɔu]; ⟨ñ⟩→[ɲ], ⟨y⟩→[j], ⟨r⟩→[ɾ]. Acute-accented vowels ⟨á é í ó ú⟩ mark irregular
 *     STRESS (abolí→aboˈli); default penult (a diphthong counts as one nucleus), ULTIMATE for a consonant-final word.
 *     Papiamentu's lexical PITCH-ACCENT (H/L on each syllable) is not written and not emitted (it folds).
 *
 * 🔷 thin single-source (kaikki + English Wiktionary "Papiamentu terms with IPA pronunciation", ~20 pairs — no
 * wikipron/epitran pap).
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { LATIN_RUN, makeNativiser } from "../../core/hostWord.ts";
import { numberToWords } from "./numbers.ts";

const DIGRAPHS: [string, string][] = [["ch", "t͡ʃ"], ["sh", "ʃ"], ["dj", "d͡ʒ"], ["zj", "ʒ"]];
// Single letters. Open-vowel letters ⟨è ò ù⟩; acute ⟨á é í ó ú⟩ = stressed base vowel (stress found separately).
const LETTER: Record<string, string> = {
    "a": "a", "e": "e", "i": "i", "o": "o", "u": "u", "è": "ɛ", "ò": "ɔ", "ù": "ø",
    "á": "a", "é": "e", "í": "i", "ó": "o", "ú": "u", "à": "a", "ì": "i",
    "b": "b", "c": "k", "d": "d", "f": "f", "g": "ɡ", "h": "h", "j": "j", "k": "k", "l": "l",
    "m": "m", "n": "n", "ñ": "ɲ", "p": "p", "q": "k", "r": "ɾ", "s": "s", "t": "t", "v": "v",
    "w": "w", "x": "ks", "y": "j", "z": "z",
};
const VOWEL_G = new Set([..."aeiouèòùáéíóúàìeo"]); // Latin vowels (for the coda-⟨n⟩ nasalization context)
const IPA_VOWEL = new Set([..."aeiouɛɔø"]);
const NASALIZE: Record<string, string> = { a: "ã", e: "ẽ", i: "ĩ", o: "õ", u: "ũ", ɛ: "ɛ̃", ɔ: "ɔ̃", ø: "ø̃" };
const ACUTE: Record<string, string> = { "á": "a", "é": "e", "í": "i", "ó": "o", "ú": "u" };

/** One Papiamentu word → canonical IPA. */
export function phonemizeWord(word: string): string {
    // Degeminate: Papiamentu has no geminate consonants, so a doubled consonant (mostly in Dutch/Spanish loans) is a
    // single one (Willemstad→[wiləmstad]). Vowels are left alone (they can be genuine sequences).
    const w = word.normalize("NFC").toLowerCase().replace(/([bcdfghjklmnpqrstvwxz])\1+/gu, "$1");
    const chars = [...w];
    const segs: string[] = [];
    const stressAcute = chars.findIndex((c) => ACUTE[c] !== undefined); // an acute vowel marks irregular stress
    for (let i = 0; i < chars.length; i++) {
        const c = chars[i]!;
        const dg = DIGRAPHS.find(([k]) => chars[i] === k[0] && chars[i + 1] === k[1]);
        if (dg) { segs.push(dg[1]); i++; continue; }
        if (c === "o" && chars[i + 1] === "u") { segs.push("ɔ"); continue; } // the ⟨ou⟩ diphthong → [ɔu] (Kòrsou→kɔrsɔu)
        // CODA ⟨n⟩ is RETAINED (Papiamentu does NOT delete it — Maurer; Kouwenberg & Murray): WORD-FINAL ⟨n⟩ → the
        // velar nasal [ŋ], also NASALIZING the preceding vowel (bon→[bõŋ], federashon→[fedeɾaʃõŋ]). A ⟨n⟩ before a
        // consonant or a vowel stays [n] (kontra→[kɔntra], abominabel→[abominabel]). (The Wiktionary referee's
        // "nasalize + drop the ⟨n⟩" is a Portuguese-style over-transcription — the ⟨n⟩→∅ is folded, not modelled.)
        if (c === "n" && i + 1 >= chars.length && segs.length && IPA_VOWEL.has(segs[segs.length - 1]!.slice(-1))) {
            const prev = segs[segs.length - 1]!;
            segs[segs.length - 1] = prev.slice(0, -1) + (NASALIZE[prev.slice(-1)] ?? prev.slice(-1));
            segs.push("ŋ");
            continue;
        }
        const ph = LETTER[c];
        if (ph !== undefined) segs.push(ph);
    }
    // STRESS: an acute-accented vowel pins it; otherwise the penultimate vowel (Iberian default).
    // Vowel nuclei for stress. A falling-diphthong OFFGLIDE — a high vowel [i]/[u] right after another vowel (ou, ai,
    // au, ei, oi) — is NOT a separate nucleus (Kòrsou→[ˈkɔrsou], one nucleus per the ⟨ou⟩ diphthong).
    const isVowelSeg = (s: string): boolean => [...s.normalize("NFD")].some((x) => IPA_VOWEL.has(x));
    const vIdx = segs.map((s, idx) => {
        if (!isVowelSeg(s)) return -1;
        if ((s === "i" || s === "u") && idx > 0 && isVowelSeg(segs[idx - 1]!)) return -1; // diphthong offglide
        return idx;
    }).filter((x) => x >= 0);
    if (vIdx.length) {
        let nucleus: number;
        if (stressAcute >= 0) {
            // map the acute grapheme position to its vowel seg (count vowels up to it)
            const vowelsBefore = chars.slice(0, stressAcute).filter((c) => VOWEL_G.has(c)).length;
            nucleus = vIdx[Math.min(vowelsBefore, vIdx.length - 1)]!;
        } else {
            // Iberian default: penultimate for a vowel-final word; ULTIMATE for a consonant-final word or one ending
            // in a NASALIZED vowel (a dropped coda-⟨n⟩ loan, -shon/-in → final stress: federashon, mashin).
            const last = segs[segs.length - 1]!;
            const lastVowel = [...last.normalize("NFD")].some((x) => IPA_VOWEL.has(x));
            const lastNasal = last.normalize("NFD").includes("̃");
            nucleus = (!lastVowel || lastNasal || vIdx.length < 2) ? vIdx[vIdx.length - 1]! : vIdx[vIdx.length - 2]!;
        }
        const at = nucleus > 0 && ![...segs[nucleus - 1]!.normalize("NFD")].some((x) => IPA_VOWEL.has(x)) ? nucleus - 1 : nucleus;
        segs.splice(at, 0, "ˈ");
    }
    return segs.join("");
}

// Papiamentu Latin — a-z + the accented/open letters. Word / number / punctuation.
const TOKEN = new RegExp(`(${LATIN_RUN})|(\\d+)|([.?!,;:…])`, "gu");

/**
 * This language's OWN inventory — the TOKEN word class as it stood before the widening above, lifted
 * verbatim, so nothing about the orthography is invented here. A token this REJECTS carries a letter the
 * language does not use, i.e. a foreign name. See core/hostWord.ts: this is the INVENTORY question, and it
 * is no longer also deciding where the script boundary falls (#657).
 */
const NATIVE_CLASS = "[a-zàáèéìíòóùúñA-ZÀÁÈÉÌÍÒÓÙÚÑ]";
const nat = makeNativiser(NATIVE_CLASS, "u");

class PapiamentoPhonemizer implements Phonemizer {
    text(input: string): string {
        return assembleClauses(input.normalize("NFC"), TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(nat(m[1])));
            // A digit run reads as Papiamentu number WORDS, each phonemized like any other word.
            else if (m[2]) for (const wd of numberToWords(Number(m[2])).split(" ")) sink.emit(phonemizeWord(wd));
            else if (m[3]) sink.pause(m[3] === "." || m[3] === "!" || m[3] === "?" ? m[3] : ",");
        });
    }
}

/** Build the Papiamentu phonemizer (Curaçao-orthography scan + coda-n nasalization + stress). */
export function createPapiamento(): Phonemizer {
    return new PapiamentoPhonemizer();
}
