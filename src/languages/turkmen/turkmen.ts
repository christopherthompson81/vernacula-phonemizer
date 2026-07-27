/**
 * Standard Turkmen (tk) phonemizer — Türkmençe, Oghuz Turkic, Latin script, canonical IPA, espeak-independent. The
 * fleet's first Turkmen. Near-phonemic (no digraphs — one sound per letter), so a direct grapheme scan. The
 * HALLMARK is the INTERDENTAL fricatives ⟨s⟩→[θ] / ⟨z⟩→[ð] (shared with Bashkir). 9 vowels (⟨ä⟩→[æ], ⟨ö⟩→[ø],
 * ⟨ü⟩→[y], ⟨y⟩→[ɯ]) + UNWRITTEN phonemic length (not emitted); ⟨ç⟩→t͡ʃ, ⟨j⟩→d͡ʒ, ⟨ž⟩→ʒ, ⟨ş⟩→ʃ, ⟨ň⟩→ŋ, ⟨ý⟩→j (the
 * glide), ⟨h⟩→x, ⟨w⟩→w, ⟨r⟩→ɾ. Word-final (oxytone) stress, the Turkic default. See docs/investigations/tk_native_bringup_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { loadManifest } from "../../core/loadManifest.ts";

interface TurkmenDef {
    digraphs: Record<string, string>;
    graphemes: Record<string, string>;
    clausePunctuation: Record<string, string>;
}
const DEF = loadManifest<TurkmenDef>(import.meta.url, "turkmen.jsonc");
const G = DEF.graphemes;
const CLAUSE_MARK = DEF.clausePunctuation;
const VOWEL = new Set(["ɑ", "e", "æ", "i", "o", "ø", "u", "y", "ɯ"]);
const NASAL = new Set(["m", "n", "ŋ"]);

/** Sonority class (higher = more sonorous): vowel 6, glide 5, liquid 4, nasal 3, fricative 2, affricate 1, stop 0. */
function sonority(seg: string): number {
    if (VOWEL.has(seg)) return 6;
    if (seg === "j" || seg === "w") return 5;
    if (["l", "ɾ", "r"].includes(seg)) return 4;
    if (NASAL.has(seg)) return 3;
    if (seg.includes("͡")) return 1; // affricate (t͡ʃ d͡ʒ)
    if (["f", "v", "θ", "ð", "ʃ", "ʒ", "x", "χ", "h"].includes(seg)) return 2;
    return 0; // stop (p b t d k ɡ)
}

/** Phonemize one Turkmen word → canonical IPA: direct grapheme scan + word-final stress. */
export function phonemizeWord(word: string): string {
    const w = word.normalize("NFC").toLowerCase();
    const segs: string[] = [];
    for (const ch of w) {
        const ph = G[ch];
        if (ph !== undefined) segs.push(ph);
    }
    // Word-final (oxytone) stress — the Turkic default: ˈ before the MAXIMAL onset of the last vowel's syllable.
    // Native Turkmen has no onset clusters; loanwords do (plan, sport→θp, klub), so back up over the whole onset by
    // sonority sequencing (rising toward the vowel) + fricative-initial (θp, θt) and nasal-initial clusters.
    const vidx = segs.map((s, idx) => (VOWEL.has(s) ? idx : -1)).filter((x) => x >= 0);
    if (vidx.length) {
        const nucleus = vidx[vidx.length - 1]!;
        let at = nucleus;
        if (at > 0 && !VOWEL.has(segs[at - 1]!)) at--; // always include the immediate onset consonant
        while (at > 0 && !VOWEL.has(segs[at - 1]!)) {
            // extend only over a valid COMPLEX onset: obstruent + liquid/glide (pl, kr), fricative + stop (θp, θt),
            // or nasal + stop — NOT nasal/liquid + liquid/glide (those are a coda + the next onset).
            const p = segs[at - 1]!,
                l = segs[at]!;
            const obstruentLiquid = sonority(p) <= 2 && sonority(l) >= 4;
            const fricStop = sonority(p) === 2 && sonority(l) <= 1;
            const nasalStop = NASAL.has(p) && sonority(l) <= 1;
            if (!(obstruentLiquid || fricStop || nasalStop)) break;
            at--;
        }
        segs.splice(at, 0, "ˈ");
    }
    return segs.join("").normalize("NFC");
}

// A word (Turkmen Latin letters incl. ä ç ž ň ö ş ü ý) / number / punctuation token. Numbers deferred.
const TOKEN = /([a-zäçžňöşüýA-ZÄÇŽŇÖŞÜÝ]+)|(\d+)|([.!?…,;:])/giu;

class TurkmenPhonemizer implements Phonemizer {
    text(input: string): string {
        return assembleClauses(input, TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(m[1]));
            else if (m[2]) sink.emit(m[2]); // numbers deferred (digits passed through)
            else if (m[3]) {
                const mk = CLAUSE_MARK[m[3]];
                if (mk) sink.pause(mk);
            }
        });
    }
}

/** Build the Turkmen phonemizer (direct grapheme g2p + the interdental hallmark + final stress). */
export function createTurkmen(): Phonemizer {
    return new TurkmenPhonemizer();
}
