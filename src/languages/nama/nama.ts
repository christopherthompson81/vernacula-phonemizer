/**
 * Native Nama / Khoekhoe (naq) text phonemizer — Khoekhoegowab, canonical IPA, espeak-independent. Nama (Khoekhoe/
 * Damara) is a KHOE-KWADI language of Namibia/South Africa/Botswana (~250k) — the fleet's FIRST CLICK language. The
 * Khoekhoegowab Latin orthography writes the four click TYPES with the Unicode click letters and their ACCOMPANIMENT
 * (efflux) with a following letter; a greedy scan handles them.
 *
 *   ★★ THE CLICKS — four places × five accompaniments:
 *     place:  ⟨ǀ⟩ dental · ⟨ǁ⟩ lateral · ⟨ǂ⟩ palatal · ⟨ǃ⟩ alveolar
 *     efflux: BARE ⟨ǀ⟩→[ᵑ̊ǀˀ] (glottalised nasal) · ⟨ǀg⟩→[ᵏǀ] (tenuis) · ⟨ǀkh⟩→[ᵏǀʰ] (aspirated) ·
 *             ⟨ǀh⟩→[ᵑ̊ǀʰ] (aspirated nasal) · ⟨ǀn⟩→[ᵑǀ] (voiced nasal) — uniform across all four places.
 *   ★ Non-click: ⟨kh⟩→[kʰ], ⟨g⟩ (not after a click)→[x], ⟨w⟩→[w]; the WORD-FINAL gender suffix ⟨-b⟩ devoices to [p]
 *     (ǀgomab→[ǀómàp]), ⟨-s⟩ stays. Vowels a e i o u, with the CIRCUMFLEX = NASALIZED (⟨â⟩→[ã], phonemic in Nama) and
 *     a MACRON or DOUBLED vowel = LONG (⟨ā⟩/⟨aa⟩→[aː]). Nama's lexical TONE (H/L, marked with an acute/grave in the
 *     narrow referee) is NOT written in the orthography and not emitted (it folds).
 *
 * 🔷 thin, largely REFERENCE-PARITY: the referee (English Wiktionary "Khoekhoe terms with IPA pronunciation", 46) is
 * dominated by the click-letter DEFINITIONS (the orthography→IPA spec we implement), with a few real words as an
 * independent check. See docs/investigations/naq_native_bringup_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { numberToWords, readDigits } from "./numbers.ts";

const CLICK = new Set(["ǀ", "ǁ", "ǂ", "ǃ"]); // dental, lateral, palatal, alveolar
/** A click letter + its accompaniment (the following g/kh/h/n, longest-first) → the IPA click cluster. */
function clickIPA(click: string, accomp: string): string {
    switch (accomp) {
        case "g": return "ᵏ" + click; // tenuis (voiceless unaspirated)
        case "kh": return "ᵏ" + click + "ʰ"; // aspirated
        case "h": return "ᵑ̊" + click + "ʰ"; // aspirated (voiceless) nasal
        case "n": return "ᵑ" + click; // voiced nasal
        default: return "ᵑ̊" + click + "ˀ"; // BARE click → the glottalised nasal click
    }
}
// Non-click letters. ⟨kh⟩→[kʰ] handled as a digraph; ⟨g⟩ only occurs as a click accompaniment.
const LETTER: Record<string, string> = {
    "a": "a", "e": "e", "i": "i", "o": "o", "u": "u",
    "ā": "aː", "ē": "eː", "ī": "iː", "ō": "oː", "ū": "uː", // macron = long vowel (ǃkhās→kǃʰaːs)
    "â": "ã", "ê": "ẽ", "î": "ĩ", "ô": "õ", "û": "ũ", // circumflex = NASALIZED vowel (phonemic in Nama: ǂgâ, ǀî)
    "b": "b", "d": "d", "g": "x", "h": "h", "k": "k", "m": "m", "n": "n", "p": "p", "r": "r", "s": "s",
    "t": "t", "w": "w", "x": "x", // ⟨g⟩ NOT after a click → the velar fricative [x] (Khoekhoegowab→…xo…); ⟨w⟩→[w]
    // ⟨l j⟩ occur only in NATURALISED LOANS, but they do occur: the Khoekhoegowab section of Namibia's New Era
    // writes "N$47 miljunsa" / "N$1 biljunmaris" (10⁶/10⁹ — see numbers.ts). Without these two entries the scan
    // silently deleted them (miljun→*miun), so they are mapped to their ordinary values.
    "l": "l", "j": "j",
};
const PLAIN_VOWEL = new Set([..."aeiou"]);

/** One Nama word → canonical IPA. */
export function phonemizeWord(word: string): string {
    const chars = [...word.normalize("NFC")];
    // Lowercase PER-INDEX (not a separate array) so a char that lowercases to a different code-point count (İ→i̇, ß→ss)
    // can never desync the index from `chars`.
    const lc = (idx: number): string => (chars[idx] ?? "").toLowerCase();
    const segs: string[] = [];
    for (let i = 0; i < chars.length; i++) {
        const c = chars[i]!;
        if (CLICK.has(c)) {
            // Accompaniment: longest-first — ⟨kh⟩ (2 letters) before ⟨g h n⟩. Case-insensitive (ǀKh, ǀG in citations).
            const next2 = lc(i + 1) + lc(i + 2);
            const next1 = lc(i + 1);
            if (next2 === "kh") { segs.push(clickIPA(c, "kh")); i += 2; }
            else if (next1 === "g" || next1 === "h" || next1 === "n") { segs.push(clickIPA(c, next1)); i += 1; }
            else segs.push(clickIPA(c, ""));
            continue;
        }
        const cur = lc(i);
        if (cur === "k" && lc(i + 1) === "h") { segs.push("kʰ"); i++; continue; } // ⟨kh⟩ digraph
        // A DOUBLED identical vowel → a long vowel [Vː] (the standard Khoekhoegowab length convention, aa/ee…).
        if (PLAIN_VOWEL.has(cur) && lc(i + 1) === cur) { segs.push(LETTER[cur]! + "ː"); i++; continue; }
        // WORD-FINAL gender suffix ⟨-b⟩ → [p] (devoicing): ǀgomab→ǀómàp.
        if (cur === "b" && i === chars.length - 1) { segs.push("p"); continue; }
        const ph = LETTER[cur];
        if (ph !== undefined) segs.push(ph);
        // tone diacritics on vowels, ʼ, etc.: dropped (tone not emitted; it folds)
    }
    return segs.join("").normalize("NFC");
}

// Nama Latin + the click letters ǀ ǁ ǂ ǃ. Word / number / punctuation.
/**
 * This language's OWN inventory — the TOKEN class as it stood before the widening below, lifted verbatim, so
 * nothing about the orthography is invented here. A token this REJECTS carries a letter the language does not
 * use, i.e. a foreign name.
 */
const NATIVE_WORD = /^[a-zA-Zǀǁǂǃ]+$/u;
/**
 * Fold an OUT-OF-INVENTORY accent to its base — `ö`→`o`, `ã`→`a`. This engine NATIVISES rather than routing (its
 * loan reading is its own, not English's), so a foreign name is read with native values — which needs a letter to
 * read. The g2p has no rule for a letter outside its inventory and simply DROPS it, and dropping is not
 * nativising but deleting: that is the `Klöcker` → *klkkeɾ* trap. NFD then discard marks, so a precomposed and a
 * decomposed accent behave alike.
 * ⚠ CONDITIONAL, because a native accent must survive: folding unconditionally would destroy exactly the
 * accented letters this language CAN read (Tagalog's `ñ` was the case that showed it).
 */
const foldToBase = (w: string): string => w.normalize("NFD").replace(/\p{M}+/gu, "").normalize("NFC");
const nat = (w: string): string => (NATIVE_WORD.test(w) ? w : foldToBase(w));

// ⚠ ALL OF LATIN, not just this language's own letters — the narrow class ended the token at an
// out-of-inventory diacritic, so that letter became an unclaimed gap read as an English LETTER NAME and the
// rest of the word started over: `São Paulo` fragmented into three pieces, none of them right. Invisible to
// every gate: no digit or raw mark survives and nothing VANISHES (#657).
const TOKEN = /(\p{Script=Latin}[\p{Script=Latin}\p{M}]*)|(\d+)|([.?!,;:…])/gu;

class NamaPhonemizer implements Phonemizer {
    text(input: string): string {
        return assembleClauses(input.normalize("NFC"), TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(nat(m[1])));
            else if (m[2]) {
                // Cardinals 1 … 10¹²−1 compose natively; 0 emits the flagged Afrikaans stopgap `nul` and anything
                // above the ceiling reads digit-by-digit. Never silently dropped. See numbers.ts.
                const words = m[2].length <= 12 ? numberToWords(Number(m[2])) : readDigits(m[2]);
                for (const wd of words.split(" ")) sink.emit(phonemizeWord(wd));
            }
            else if (m[3]) sink.pause(m[3] === "." || m[3] === "!" || m[3] === "?" ? m[3] : ",");
        });
    }
}

/** Build the Nama (Khoekhoe) phonemizer (click-aware Khoekhoegowab scan). */
export function createNama(): Phonemizer {
    return new NamaPhonemizer();
}
