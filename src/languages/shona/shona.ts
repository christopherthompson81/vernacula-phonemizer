/**
 * Shona / chiShona (sn) phonemizer — Bantu (S10, Standard Zezuru), the Latin orthography, canonical IPA,
 * A pure greedy longest-match scan over the grapheme table (manifest.ts): Shona syllables are
 * open CV with a prenasalized cluster as a single onset unit, so no coda or syllabification logic is needed. The
 * signatures: IMPLOSIVES ⟨b d⟩→ɓ ɗ (vs breathy ⟨bh dh⟩→b̤ d̤), WHISTLED sibilants ⟨sv zv⟩→ȿ ɀ, PRENASALIZED
 * ⟨mb nd ng nz nj⟩ → ᵐb ⁿd ᵑɡ ⁿz ⁿd͡ʒ (⟨ng'⟩→ŋ). Tone (H/L) is unwritten → DEFERRED (segmental output only).
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { latinPhone } from "../../core/latinPhones.ts";
import { hostWordRun, makeNativiser } from "../../core/hostWord.ts";
import { numberToWords } from "./numbers.ts";
import { MANIFEST, GRAPHEME_KEYS } from "./manifest.ts";

const G = MANIFEST.graphemes;
const CLAUSE_MARK = MANIFEST.clausePunctuation;

/** Phonemize a single Shona word to canonical IPA (segmental; no tone — Shona tone is unwritten). */
export function phonemizeWord(word: string): string {
    // Normalise the typographic apostrophe to ' so the ⟨ng'⟩→[ŋ] grapheme matches regardless of entry point
    // (the eval calls phonemizeWord directly, not via text()).
    const w = word.toLowerCase().replace(/’/gu, "'");
    let out = "";
    let i = 0;
    while (i < w.length) {
        let matched = false;
        for (const key of GRAPHEME_KEYS) {
            if (w.startsWith(key, i)) {
                out += G[key]!;
                i += key.length;
                matched = true;
                break;
            }
        }
        // ⚠ NOT SILENTLY: a letter with no grapheme rule here still denotes a sound, and dropping it deletes
        // what the writer typed. Consulted only on the MISS branch, after every grapheme (including every
        // digraph) has been tried, so it can never override a reading this language has an opinion about (#663).
        if (!matched) {
            out += latinPhone(w[i]!, { initial: i === 0, includeH: true }) ?? "";
            i++;
        }
    }
    return out;
}

// A word (Shona letters + the ⟨ng'⟩ apostrophe, incl. the typographic ’) / number / punctuation token.
const TOKEN = new RegExp(`(${hostWordRun(["Latin"], "'’")})|(\\d+)|([.!?…,;:])`, "giu");

/**
 * This language's OWN inventory — the TOKEN word class as it stood before the widening above, lifted
 * verbatim, so nothing about the orthography is invented here. A token this REJECTS carries a letter the
 * language does not use, i.e. a foreign name. See core/hostWord.ts: this is the INVENTORY question, and it
 * is no longer also deciding where the script boundary falls (#657).
 */
const NATIVE_CLASS = "[a-z'’]";
const nat = makeNativiser(NATIVE_CLASS, "iu");

class ShonaPhonemizer implements Phonemizer {
    text(input: string): string {
        return assembleClauses(input, TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(nat(m[1])));
            else if (m[2])
                for (const wd of numberToWords(Number(m[2])).split(" ")) sink.emit(phonemizeWord(wd));
            else if (m[3]) {
                const mk = CLAUSE_MARK[m[3]];
                if (mk) sink.pause(mk);
            }
        });
    }
}

/** Build the Shona phonemizer (greedy rule g2p; tone deferred). */
export function createShona(): Phonemizer {
    return new ShonaPhonemizer();
}
