/**
 * Dutch (nl) phonemizer — Northern Standard Dutch, canonical IPA, espeak-independent. Rule-based g2p (g2p.ts)
 * with Germanic initial stress (the first full syllable, or the first after an unstressed prefix be-/ge-/ver-/
 * ont-/her-/te-). text() tokenizes words / numbers / punctuation. See
 * docs/investigations/nl_native_bringup_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { toSegments, type Seg } from "./g2p.ts";
import { numberToWords } from "./numbers.ts";
import { MANIFEST } from "./manifest.ts";

// Unstressed prefixes that shift stress off the first syllable (verkópen, gelóven, begín, ontslág, herhálen).
const UNSTRESSED_PREFIX = /^(ver|ge|be|ont|her|te)/u;
// The subset whose vowel additionally REDUCES to schwa when the prefix is treated as unstressed (ge-/be-/ver-/te-
// → ɣə/bə/vər/tə). ont-/her- shift stress but KEEP their full vowel (ɔnt-/hɛr-), so they are excluded here.
const SCHWA_PREFIX = /^(ver|ge|be|te)/u;

// High-frequency function words / clitics whose vowel is reduced to schwa (unstressed by default) — the g2p's
// first-syllable rule would give them a full vowel (de → deː). The numeral/article "een" is left to the g2p
// (eːn) so the number path is unaffected. Apostrophe clitics ('t, 'n, 'k, …) are the reduced forms.
const FUNCTION_WORDS: Record<string, string> = {
    de: "də", je: "jə", ze: "zə", we: "ʋə", me: "mə", te: "tə", ge: "ɣə",
    het: "ɦət", "'t": "ət", "'n": "ən", "'k": "ək", "'m": "əm", "'s": "əs",
};

/** Place primary stress and reduce an unstressed prefix's vowel. Returns the stressed-nucleus seg index. The
 *  prefix is treated as unstressed ONLY when a later nucleus exists AND it isn't a schwa — this distinguishes a
 *  real prefix (ge·maakt, nucleus1 = aː → shift + reduce ge→ɣə) from a ⟨ge⟩-root (geven, nucleus1 = ə → no shift,
 *  ɣˈeːvən, no stressed schwa). When the shift fires, a ge-/be-/ver-/te- prefix vowel (segs[nuclei0]) also
 *  reduces to ə (ont-/her- keep their full vowel). Offglides (vowel:false) are skipped — only true nuclei count. */
function placeStress(segs: Seg[], word: string): number {
    const nuclei = segs.map((s, k) => (s.vowel ? k : -1)).filter((k) => k >= 0);
    if (nuclei.length === 0) return -1;
    const lower = word.toLowerCase();
    if (nuclei.length > 1 && UNSTRESSED_PREFIX.test(lower) && segs[nuclei[1]!]!.ph !== "ə") {
        if (SCHWA_PREFIX.test(lower)) segs[nuclei[0]!]!.ph = "ə"; // ge-/be-/ver-/te- vowel → schwa
        return nuclei[1]!;
    }
    // First non-schwa nucleus (a schwa-initial root like the reduced prefix be- pushes stress right).
    return nuclei.find((k) => segs[k]!.ph !== "ə") ?? nuclei[0]!;
}

/** Phonemize a single Dutch word to canonical IPA (with a stress mark). */
export function phonemizeWord(word: string): string {
    const reduced = FUNCTION_WORDS[word.toLowerCase()];
    if (reduced !== undefined) return reduced;
    const segs = toSegments(word);
    if (segs.length === 0) return "";
    const stress = placeStress(segs, word);
    let out = "";
    for (let k = 0; k < segs.length; k++) {
        if (k === stress) out += "ˈ";
        out += segs[k]!.ph;
    }
    return out;
}

const CLAUSE_MARK = MANIFEST.clausePunctuation;
// A word (Latin letters incl. Dutch diacritics) / number / punctuation token. An optional LEADING apostrophe
// captures the reduced clitics 't 'n 'k 'm 's (informal Dutch); medial apostrophes handle zo'n, auto's.
const TOKEN = /(['’]?[a-zà-ÿ]+(?:['’][a-zà-ÿ]+)*)|(\d+)|([.!?…,;:])/giu;

class DutchPhonemizer implements Phonemizer {
    text(input: string): string {
        return assembleClauses(input, TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(m[1]));
            else if (m[2])
                sink.emit(
                    numberToWords(Number(m[2])).split(" ").map(phonemizeWord).join(" "),
                );
            else if (m[3]) {
                const mk = CLAUSE_MARK[m[3]];
                if (mk) sink.pause(mk);
            }
        });
    }
}

/** Build the Dutch phonemizer. */
export function createDutch(): Phonemizer {
    return new DutchPhonemizer();
}
