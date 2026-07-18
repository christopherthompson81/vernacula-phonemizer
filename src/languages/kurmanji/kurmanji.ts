/**
 * Kurmanji / Northern Kurdish (kmr) phonemizer — Iranian, the Latin (Hawar) alphabet, canonical IPA, espeak-
 * independent. A near-phonemic left-to-right scan (the digraph ⟨xw⟩→[xʷ], then single letters) + final-syllable
 * stress (Kurmanji default; unwritten, folded by the eval). Signature: ⟨c⟩→d͡ʒ / ⟨ç⟩→t͡ʃ, ⟨j⟩→ʒ, ⟨ş⟩→ʃ, ⟨q⟩→q,
 * ⟨x⟩→x; long a/ê/î/o/û vs short e/i/u. Aspiration/pharyngealisation are allophonic and not emitted. text()
 * tokenizes words / numbers / punctuation. See docs/investigations/kmr_native_bringup_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { numberToWords } from "./numbers.ts";
import { MANIFEST } from "./manifest.ts";

const DIGRAPHS = MANIFEST.digraphs;
const VOWELS = MANIFEST.vowels;
const CONS = MANIFEST.consonants;
const CLAUSE_MARK = MANIFEST.clausePunctuation;

interface Seg {
    ph: string;
    v: boolean;
}

/** Scan a lowercased Kurmanji word into IPA segments (xw digraph, then single letters). */
function toSegments(word: string): Seg[] {
    const w = word.toLowerCase();
    const segs: Seg[] = [];
    for (let i = 0; i < w.length; ) {
        const two = w.slice(i, i + 2);
        if (DIGRAPHS[two]) {
            segs.push({ ph: DIGRAPHS[two]!, v: false });
            i += 2;
            continue;
        }
        const c = w[i]!;
        if (VOWELS[c] !== undefined) segs.push({ ph: VOWELS[c]!, v: true });
        else if (CONS[c] !== undefined) segs.push({ ph: CONS[c]!, v: false });
        i++; // unknown char (punctuation) → skip
    }
    // Nasal place assimilation: /n/ → [ŋ] before a velar stop k/ɡ (bang→bɑːŋɡ, aheng→ɑːhɛŋɡ).
    for (let k = 0; k < segs.length - 1; k++)
        if (segs[k]!.ph === "n" && /^[kɡ]/.test(segs[k + 1]!.ph)) segs[k]!.ph = "ŋ";
    return segs;
}

/** One Kurmanji word → canonical IPA with final-syllable stress (before the last vowel nucleus). */
export function phonemizeWord(word: string): string {
    const segs = toSegments(word);
    const nuclei = segs.map((s, i) => (s.v ? i : -1)).filter((i) => i >= 0);
    if (nuclei.length === 0) return segs.map((s) => s.ph).join("");
    const stressIdx = nuclei[nuclei.length - 1]!; // final-syllable default
    let out = "";
    for (let i = 0; i < segs.length; i++) {
        if (i === stressIdx) out += "ˈ";
        out += segs[i]!.ph;
    }
    return out;
}

// A word (Kurmanji Hawar letters incl. diacritics ê î û ç ş, the dotted ğ ẍ ḧ, and the apostrophe ayn) / number /
// punctuation token. All three dotted letters that appear in the consonant map must be here or text() drops them.
const TOKEN = /([a-zêîûçşğẍḧ']+)|(\d+)|([.!?…,;:])/giu;

class KurmanjiPhonemizer implements Phonemizer {
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

/** Build the Kurmanji phonemizer (near-phonemic g2p + final-syllable stress). */
export function createKurmanji(): Phonemizer {
    return new KurmanjiPhonemizer();
}
