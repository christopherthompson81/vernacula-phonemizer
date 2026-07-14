/**
 * Irish Gaelic (ga) phonemizer — Standard/Connacht-leaning, canonical IPA, espeak-independent. Rule-based g2p
 * (g2p.ts, the broad/slender axis) + first-syllable stress (the native default). No lexicon yet; the vowel
 * clusters are the documented Run-2+ residual. See docs/ga_bringup_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { toSegments } from "./g2p.ts";
import { numberToWords } from "./numbers.ts";
import { MANIFEST } from "./manifest.ts";

// Short vowels reduce to ə when unstressed; long vowels + diphthongs (with ː) keep their quality.
const SHORT = new Set(["a", "ɛ", "ɪ", "ɔ", "ʊ"]);

/** One Irish word → canonical IPA. Stress the first nucleus (native default; marked even on monosyllables);
 *  every OTHER short-vowel nucleus reduces to ə (unstressed reduction, e.g. madra → mˠˈad̪ˠɾˠə). */
export function phonemizeWord(word: string): string {
    const segs = toSegments(word);
    if (segs.length === 0) return "";
    const nucleiIdx = segs.map((s, i) => (s.nucleus ? i : -1)).filter((i) => i >= 0);
    if (nucleiIdx.length === 0) return segs.map((s) => s.ph).join("");
    const stress = nucleiIdx[0]!;
    for (const idx of nucleiIdx) if (idx !== stress && SHORT.has(segs[idx]!.ph)) segs[idx]!.ph = "ə";
    let out = "";
    for (let i = 0; i < segs.length; i++) {
        if (i === stress) out += "ˈ";
        out += segs[i]!.ph;
    }
    return out;
}

const CLAUSE_MARK = MANIFEST.clausePunctuation;
const TOKEN = /([a-záéíóúA-ZÁÉÍÓÚ]+)|(\d+)|([.!?…,;:])/gu;

class IrishPhonemizer implements Phonemizer {
    text(input: string): string {
        return assembleClauses(input, TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(m[1]));
            else if (m[2]) for (const wd of numberToWords(Number(m[2])).split(" ")) sink.emit(phonemizeWord(wd));
            else if (m[3]) { const mk = CLAUSE_MARK[m[3]]; if (mk) sink.pause(mk); }
        });
    }
}

/** Build the Irish phonemizer (rule-based; the broad/slender axis is the core). */
export function createIrish(): Phonemizer {
    return new IrishPhonemizer();
}
