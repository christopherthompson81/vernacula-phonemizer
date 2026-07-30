/**
 * Native Sesotho / Southern Sotho (st) phonemizer — Bantu (Sotho-Tswana), Latin orthography, canonical IPA,
 * espeak-independent. A pure greedy longest-match scan over the grapheme table (sesotho.jsonc), the same engine as
 * the sibling Setswana — Sesotho is open CV, so no coda/syllabification logic. Authored beyond any machine referee
 * (kaikki Sotho = 3 words) from standard Sesotho phonology. Signatures: EJECTIVE plain stops ⟨p t k⟩→[pʼ tʼ kʼ]
 * (vs aspirated ⟨ph th kh⟩), ⟨ts⟩→[t͡sʼ], ⟨hl⟩→[ɬ], ⟨a⟩→[ɑ]. Vowel height unwritten (default mid); tone deferred. Cardinal numbers: numbers.ts (citation stems + the
 * motso/metso compound construction).
 * See docs/investigations/st_native_bringup_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { loadManifest } from "../../core/loadManifest.ts";
import { numberToWords } from "./numbers.ts";

interface SesothoDef {
    graphemes: Record<string, string>;
    clausePunctuation: Record<string, string>;
}
const DEF = loadManifest<SesothoDef>(import.meta.url, "sesotho.jsonc");
const CLAUSE_MARK = DEF.clausePunctuation;
// Grapheme keys sorted LENGTH DESC so the greedy scan tries trigraphs (tšh, tsh, tlh) before digraphs before singles.
const KEYS = Object.keys(DEF.graphemes).sort((a, b) => b.length - a.length);

/** Phonemize a single Sesotho word to canonical IPA (segmental; tone unwritten → not emitted). */
export function phonemizeWord(word: string): string {
    const w = word.toLowerCase();
    let out = "";
    for (let i = 0; i < w.length; ) {
        let matched = false;
        for (const key of KEYS) {
            if (w.startsWith(key, i)) { out += DEF.graphemes[key]!; i += key.length; matched = true; break; }
        }
        if (!matched) i++; // unknown char → skip
    }
    return out;
}

// A word (Sesotho letters incl. š and the ê/ô circumflex vowels) / number / punctuation token.
const TOKEN = /([a-zšêô]+)|(\d+)|([.!?…,;:])/giu;

class SesothoPhonemizer implements Phonemizer {
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

/** Build the Sesotho phonemizer (greedy rule g2p + the cardinal compositor; tone deferred). */
export function createSesotho(): Phonemizer {
    return new SesothoPhonemizer();
}
