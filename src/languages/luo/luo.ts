/**
 * Luo / Dholuo (luo) phonemizer — Western Nilotic (Luo group), the Latin orthography, canonical IPA,
 * espeak-independent. Spoken around Lake Victoria in Kenya + Tanzania (~4–5M). The FIRST Nilotic language in the repo.
 * A greedy longest-match scan over the grapheme table (manifest.ts) with ONE code rule: a high vowel ⟨i u⟩ before
 * another vowel becomes the glide ⟨j w⟩ (dhiang'→ðjaŋ, chieng'→t͡ʃjeŋ). Signatures: the DENTAL vs ALVEOLAR contrast
 * (⟨th dh⟩→θ ð vs ⟨t d⟩→t d); PRENASALISED voiced stops as single units (mb→ᵐb, nd→ⁿd, nj→ⁿd͡ʒ, ng→ᵑɡ); ⟨ng'⟩→ŋ vs
 * ⟨ng⟩→ᵑɡ; ⟨ny⟩→ɲ; the palatals ⟨ch⟩→t͡ʃ, ⟨j⟩→d͡ʒ; ⟨r⟩→ɾ. The 9-vowel ±ATR distinction and register TONE (H/L) are
 * UNWRITTEN in the orthography → emitted at a +ATR/toneless default (folded in the eval). See
 * docs/investigations/luo_native_bringup_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { hostWordRun, makeNativiser } from "../../core/hostWord.ts";
import { MANIFEST, GRAPHEME_KEYS } from "./manifest.ts";
import { numberToWords } from "./numbers.ts";

const G = MANIFEST.graphemes;
const CLAUSE_MARK = MANIFEST.clausePunctuation;

/** Phonemize a single Dholuo word to canonical IPA (segmental; +ATR/toneless default — ATR + tone are unwritten). A
 *  tone-marked citation spelling (chíeng', à) is normalised to its base letters first — the orthography proper is
 *  unaccented, and we emit no tone. */
export function phonemizeWord(word: string): string {
    // normalise the \u27e8ng'\u27e9 apostrophe (\u2019 U+2019 / \u02bc U+02BC \u2192 ASCII ') and strip tone-marked citation accents
    const w = word.toLowerCase().replace(/[\u2019\u02bc]/gu, "'").normalize("NFD").replace(/[\u0300-\u036f]/gu, "");
    let out = "";
    let i = 0;
    while (i < w.length) {
        const c = w[i]!;
        // GLIDE: ⟨i⟩ before a following ⟨a⟩/⟨e⟩ is the palatal glide [j] (dhiang'→ðjaŋ, chieng'→t͡ʃjeŋ — the only
        // environment the referee attests). Deliberately CONSERVATIVE: ⟨u⟩+V (would give dholuo→ðolwo — but the endonym
        // is the trisyllabic /ðoluo/) and ⟨i⟩ before a high/back vowel are left as HIATUS pending a second source, since
        // Dholuo's 9-vowel system has genuine VV sequences and the 17-word referee has no ⟨u⟩-glide / ⟨i⟩+{o,u} data.
        const nx = w[i + 1] ?? "";
        if (c === "i" && (nx === "a" || nx === "e")) {
            out += "j";
            i += 1;
            continue;
        }
        // greedy longest-match grapheme (ng' → the two-letter digraphs → singles); skip an unknown char
        const k = GRAPHEME_KEYS.find((key) => w.startsWith(key, i));
        if (k) { out += G[k]!; i += k.length; continue; }
        i += 1;
    }
    return out;
}

// A word (Dholuo letters + the ⟨ng'⟩ apostrophe in all three common forms — ASCII ', ’ U+2019, ʼ U+02BC MODIFIER
// LETTER APOSTROPHE, the Unicode-canonical letter-apostrophe for ng' in African Latin orthographies; also accented
// citation vowels, normalised away in phonemizeWord) / number / punctuation token.
const TOKEN = new RegExp(`(${hostWordRun(["Latin"], "'’ʼ")})|(\\d+)|([.!?…,;:])`, "giu");

/**
 * This language's OWN inventory — the TOKEN word class as it stood before the widening above, lifted
 * verbatim, so nothing about the orthography is invented here. A token this REJECTS carries a letter the
 * language does not use, i.e. a foreign name. See core/hostWord.ts: this is the INVENTORY question, and it
 * is no longer also deciding where the script boundary falls (#657).
 */
const NATIVE_CLASS = "[a-zàáâãäèéêëìíîïòóôõöùúûü'’ʼ]";
const nat = makeNativiser(NATIVE_CLASS, "iu");

class LuoPhonemizer implements Phonemizer {
    text(input: string): string {
        return assembleClauses(input, TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(nat(m[1]))); // phonemizeWord normalises the ’/ʼ apostrophe + citation accents
            // numbers: composed to Dholuo words (numbers.ts: decimal + the gi-elision), then the same g2p
            else if (m[2]) for (const wd of numberToWords(Number(m[2])).split(" ")) sink.emit(phonemizeWord(wd));
            else if (m[3]) {
                const mk = CLAUSE_MARK[m[3]];
                if (mk) sink.pause(mk);
            }
        });
    }
}

/** Build the Luo (Dholuo) phonemizer (greedy g2p + glide; decimal numbers; ATR + tone deferred). */
export function createLuo(): Phonemizer {
    return new LuoPhonemizer();
}
