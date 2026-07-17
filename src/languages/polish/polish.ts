/**
 * Polish (pl) phonemizer — canonical IPA, espeak-independent. Rule g2p (g2p.ts) + fixed PENULTIMATE stress
 * (the near-universal Polish pattern). text() tokenizes words / numbers / punctuation. Numbers are deferred (the
 * number WORDS phonemize fine). See docs/investigations/pl_native_bringup_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { toSegments } from "./g2p.ts";
import { MANIFEST } from "./manifest.ts";

const CLAUSE_MARK = MANIFEST.clausePunctuation;

export type ForeignPhonemizer = (latin: string) => string;

/** One Polish word → canonical IPA with penultimate primary stress. */
export function phonemizeWord(word: string): string {
    const segs = toSegments(word);
    const nucIdx = segs.map((s, i) => (s.nucleus ? i : -1)).filter((i) => i >= 0);
    // stressed nucleus = penultimate (or the only one)
    const stressAt = nucIdx.length >= 2 ? nucIdx[nucIdx.length - 2]! : nucIdx[0] ?? -1;
    let out = "";
    for (let i = 0; i < segs.length; i++) {
        if (i === stressAt) out += "ˈ";
        out += segs[i]!.ph;
    }
    return out.normalize("NFC");
}

const TOKEN = /([A-Za-ząćęłńóśźżĄĆĘŁŃÓŚŹŻ]+)|(\d+)|([.?!,;:])/gu;

class PolishPhonemizer implements Phonemizer {
    constructor(private foreign?: ForeignPhonemizer) {}
    text(input: string): string {
        return assembleClauses(input, TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(m[1]));
            else if (m[2]) sink.emit(this.foreign ? this.foreign(m[2]) : "");
            else if (m[3]) {
                const mk = CLAUSE_MARK[m[3]];
                if (mk) sink.pause(mk);
            }
        });
    }
}

/** Build the Polish phonemizer. */
export function createPolish(): Phonemizer {
    return new PolishPhonemizer();
}
