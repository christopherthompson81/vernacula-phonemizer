/**
 * Xhosa (xh, isiXhosa) phonemizer — canonical IPA, espeak-independent and AUTHORED beyond-espeak. The Nguni
 * sibling of Zulu: it REUSES the shared Zulu g2p scan (zulu/g2p.ts toSegments, longest-match over a rule table)
 * with the Xhosa rule table (xhosa.jsonc — adds ⟨rh⟩→[x]) and the Nguni penultimate-stress-with-lengthening
 * logic. Xhosa tone (lexical, unwritten) is DEFERRED — words are left untoned (the referee eval folds tone). See
 * docs/investigations/xh_native_bringup_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { toSegments } from "../zulu/g2p.ts";
import { numberToWords } from "./numbers.ts";
import { MANIFEST } from "./manifest.ts";

const RULES = MANIFEST.rules;
const CLAUSE_MARK = MANIFEST.clausePunctuation;

/** One Xhosa word → canonical IPA: shared Nguni segments + penultimate stress/length (tone deferred). */
export function phonemizeWord(word: string): string {
    const segs = toSegments(word, RULES);
    const vowelIdx = segs.map((s, i) => (s.v ? i : -1)).filter((i) => i >= 0);
    if (vowelIdx.length === 0) return segs.map((s) => s.ph).join("");
    // Nguni penultimate stress: ˈ + ː on the penult vowel (the only vowel if monosyllabic).
    const stressIdx = vowelIdx.length >= 2 ? vowelIdx[vowelIdx.length - 2]! : vowelIdx[0]!;
    let out = "";
    for (let i = 0; i < segs.length; i++) {
        const s = segs[i]!;
        out += s.v && i === stressIdx ? `ˈ${s.ph}ː` : s.ph;
    }
    return out;
}

const TOKEN = /([A-Za-z]+)|(\d+)|([.!?…,;:])/gu;

// #562 symbol normalization — Xhosa: class-10 loan plurals (iipesenti, iidola, iikhilomitha).
// ¥ and the mm/cm/mi/mph units are NOT wired — no attested Xhosa forms to hand; see #562.
const SYMBOLS = makeSymbolNormalizer({
    percent: ["iipesenti"],
    currency: { "$": ["iidola"], "£": ["iiponti"] },
    units: { km: ["iikhilomitha"] },
});

class XhosaPhonemizer implements Phonemizer {
    text(input: string): string {
        return assembleClauses(SYMBOLS(input), TOKEN, (m, sink) => {
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

/** Build the Xhosa phonemizer (shared Nguni g2p + penultimate stress; tone deferred). */
export function createXhosa(): Phonemizer {
    return new XhosaPhonemizer();
}
