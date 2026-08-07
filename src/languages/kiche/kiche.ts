/**
 * K'iche' (quc) phonemizer — Qatzijob'al, the largest MAYAN language (~1.1M, Guatemala), Latin script (ALMG
 * orthography), canonical IPA. The fleet's first Mayan family. ALMG is near-1:1 phonemic, so a
 * longest-match grapheme scan. The Mayan hallmark is the EJECTIVE/glottalized series ⟨b'⟩→[ɓ] (implosive), ⟨t'⟩→[tʼ],
 * ⟨k'⟩→[kʼ], ⟨q'⟩→[qʼ], ⟨tz'⟩→[t͡sʼ], ⟨ch'⟩→[t͡ʃʼ]; the plain voiceless stops are ASPIRATED ⟨p t k q tz ch⟩→[pʰ tʰ kʰ qʰ
 * t͡sʰ t͡ʃʰ]. Uvular ⟨q q'⟩; ⟨x⟩→[ʃ], ⟨j⟩→[x], ⟨w⟩→[ʋ], ⟨r⟩→[ɻ], ⟨'⟩→[ʔ]; the sixth vowel ⟨ä⟩→[ə]. Vowel LENGTH is phonemic but
 * UNWRITTEN (folded); FINAL stress. ⚠ SINGLE-SOURCE: English Wiktionary, 127 pairs, and no second referee.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { latinPhone } from "../../core/latinPhones.ts";
import { hostWordRun, makeNativiser } from "../../core/hostWord.ts";
import { numberToWords } from "./numbers.ts";

// Multi-char units (longest-match first): the glottalized series (C + ʼ), then the plain aspirated affricates.
const UNIT: Record<string, string> = {
    "chʼ": "t͡ʃʼ", "tzʼ": "t͡sʼ", "bʼ": "ɓ", "tʼ": "tʼ", "kʼ": "kʼ", "qʼ": "qʼ", "pʼ": "pʼ",
    "ch": "t͡ʃʰ", "tz": "t͡sʰ",
};
// Single letters. Plain voiceless stops are ASPIRATED; ⟨b⟩ is the implosive [ɓ]; ⟨r⟩→[ɻ], ⟨w⟩→[ʋ], ⟨j⟩→[x], ⟨x⟩→[ʃ].
const G: Record<string, string> = {
    "a": "a", "e": "e", "i": "i", "o": "o", "u": "u", "ä": "ə",
    "ü": "u", "ö": "o", "ë": "e", "ï": "i", "á": "a", "é": "e", "í": "i", "ó": "o", "ú": "u", // accent/diaeresis → base vowel
    "p": "pʰ", "t": "tʰ", "k": "kʰ", "q": "qʰ", "b": "ɓ", "s": "s", "l": "l", "m": "m", "n": "n",
    "r": "ɻ", "w": "ʋ", "x": "ʃ", "j": "x", "y": "j", "ʼ": "ʔ",
    "d": "d", "g": "ɡ", "f": "f", "v": "b", "z": "s", "c": "k", // Spanish-loan consonants (kept, not silently dropped; ⟨h⟩ is silent per Spanish)
};
const ORDER = Object.keys(UNIT).sort((a, b) => b.length - a.length);
const VOWEL = new Set(["a", "e", "i", "o", "u", "ə"]);

/** Phonemize a K'iche' word → canonical IPA: longest-match scan + glottal onset + final stress (length not emitted).
 *  A multi-word phrase (some referee headwords) is split so each word gets its own glottal onset + stress. */
export function phonemizeWord(word: string): string {
    if (/\s/u.test(word.trim())) return word.trim().split(/\s+/u).map(phonemizeWord).join(" ");
    // Normalise the apostrophe glyphs (ASCII ' / curly ’ / modifier ʼ) so the glottalized units + glottal stop match.
    const w = word.normalize("NFC").toLowerCase().replace(/['’`]/gu, "ʼ");
    const segs: string[] = [];
    let i = 0;
    outer: while (i < w.length) {
        for (const key of ORDER) {
            if (w.startsWith(key, i)) { segs.push(UNIT[key]!); i += key.length; continue outer; }
        }
        // ⚠ A letter with no rule here still denotes a sound; dropping it deletes what the writer typed.
        // Consulted AFTER every digraph and single-letter rule, so it cannot override this language.
        const ph = G[w[i]!] ?? latinPhone(w[i]!, { initial: i === 0 });
        if (ph !== undefined) segs.push(ph);
        i += 1;
    }
    // FINAL (oxytone) stress — the K'iche' default: ˈ before the onset of the last syllable (folded in eval).
    const vidx = segs.map((s, idx) => (VOWEL.has(s) ? idx : -1)).filter((x) => x >= 0);
    if (vidx.length) {
        const nucleus = vidx[vidx.length - 1]!;
        const at = nucleus > 0 && !VOWEL.has(segs[nucleus - 1]!) ? nucleus - 1 : nucleus;
        segs.splice(at, 0, "ˈ");
    }
    return segs.join("").normalize("NFC");
}

// A K'iche' word (Latin + ä + the apostrophe glyphs) / number / punctuation.
const TOKEN = new RegExp(`(${hostWordRun(["Latin"], "'’ʼ`-")})|(\\d+)|([.!?…,;:])`, "gu");

/**
 * This language's OWN inventory. ⚠ TWO DIFFERENT QUESTIONS, KEPT APART: the TOKEN class above decides where
 * the SCRIPT boundary falls (routing), while this one decides whether the g2p has rules for these letters. A
 * token this class REJECTS carries a letter the language does not use — i.e. a foreign name. See
 * core/hostWord.ts.
 */
const NATIVE_CLASS = "[a-zäöëïüáéíóúÄÖËÏÜÁÉÍÓÚA-Z'’ʼ`-]";
const nat = makeNativiser(NATIVE_CLASS, "u");

class KicheePhonemizer implements Phonemizer {
    text(input: string): string {
        return assembleClauses(input, TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(nat(m[1])));
            else if (m[2]) for (const wd of numberToWords(Number(m[2])).split(" ")) sink.emit(phonemizeWord(wd));
            else if (m[3]) sink.pause(m[3] === "." || m[3] === "!" || m[3] === "?" ? m[3] : ",");
        });
    }
}

/** Build the K'iche' phonemizer (ALMG grapheme scan + ejective series + aspirated plain stops + final stress). */
export function createKichee(): Phonemizer {
    return new KicheePhonemizer();
}
