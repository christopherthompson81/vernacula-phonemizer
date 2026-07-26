/**
 * Latvian (lv) phonemizer — canonical IPA, latviešu, Baltic, espeak-independent. Rule g2p (g2p.ts) + FIXED
 * first-syllable stress (emitted before the first nucleus — Latvian stress is predictable, unlike Lithuanian).
 * Written length (macrons) + written palatals are emitted directly; the syllable tone the narrow referee carries is
 * unwritten → folded. text() tokenizes words / numbers / punctuation. See docs/investigations/lv_native_bringup_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { toSegments } from "./g2p.ts";
import { numberToWords, readDigits } from "./numbers.ts";
import { MANIFEST } from "./manifest.ts";

/** One Latvian word → canonical IPA with fixed first-syllable stress (ˈ before the first nucleus). */
export function phonemizeWord(word: string): string {
    const segs = toSegments(word);
    const first = segs.findIndex((s) => s.nucleus);
    let out = "";
    for (let i = 0; i < segs.length; i++) {
        if (i === first) out += "ˈ";
        out += segs[i]!.ph;
    }
    return out;
}

const CLAUSE_MARK = MANIFEST.clausePunctuation;
const TOKEN = /([A-Za-zĀāČčĒēĢģĪīĶķĻļŅņŌōŠšŪūŽž]+)|(\d+)|([.!?…,;:])/gu;

class LatvianPhonemizer implements Phonemizer {
    text(input: string): string {
        return assembleClauses(input, TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(m[1]));
            else if (m[2]) {
                const words = m[2].length <= 9 ? numberToWords(Number(m[2])) : readDigits(m[2]);
                for (const wd of words.split(" ")) sink.emit(phonemizeWord(wd));
            } else if (m[3]) {
                const mk = CLAUSE_MARK[m[3]];
                if (mk) sink.pause(mk);
            }
        });
    }
}

/** Build the Latvian phonemizer (rule g2p + first-syllable stress + cardinal numbers). */
export function createLatvian(): Phonemizer {
    return new LatvianPhonemizer();
}
