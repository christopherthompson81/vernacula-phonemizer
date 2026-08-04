/**
 * Kinyarwanda / Ikinyarwanda (rw) phonemizer — Bantu (JD61, Rwanda-Rundi), the Latin orthography, canonical IPA,
 * espeak-independent. A pure greedy longest-match scan over the grapheme table (manifest.ts): Kinyarwanda
 * syllables are open CV, so no coda/syllabification logic is needed. Signatures: PALATALISATION ⟨Cy⟩→[Cʲ] (Cox
 * K&KCG grammar, Table 25) — ⟨cy⟩→kʲ, ⟨jy⟩→ɡʲ, ⟨shy⟩→ʃʲ, ⟨by⟩→bʲ, ⟨ry⟩→ɾʲ, ⟨my⟩→mʲ (⟨ny⟩→ɲ phonemic); the plain
 * ⟨c⟩→t͡ʃ, ⟨j⟩→ʒ, ⟨sh⟩→ʃ (epitran is wrong on these three); ⟨ng⟩→ŋ; double vowels → long. Tone (H/L) unwritten → DEFERRED.
 * See docs/investigations/rw_native_bringup_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { latinPhone } from "../../core/latinPhones.ts";
import { LATIN_RUN, makeNativiser } from "../../core/hostWord.ts";
import { numberToWords } from "./numbers.ts";
import { MANIFEST, GRAPHEME_KEYS } from "./manifest.ts";

const G = MANIFEST.graphemes;
const CLAUSE_MARK = MANIFEST.clausePunctuation;

/** Phonemize a single Kinyarwanda word to canonical IPA (segmental; no tone — Kinyarwanda tone is unwritten). */
export function phonemizeWord(word: string): string {
    const w = word.toLowerCase();
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

// A word (Kinyarwanda letters; the apostrophe marks vowel elision — a boundary, so it splits tokens) / number /
// punctuation.
const TOKEN = new RegExp(`(${LATIN_RUN})|(\\d+)|([.!?…,;:])`, "giu");

/**
 * This language's OWN inventory — the TOKEN word class as it stood before the widening above, lifted
 * verbatim, so nothing about the orthography is invented here. A token this REJECTS carries a letter the
 * language does not use, i.e. a foreign name. See core/hostWord.ts: this is the INVENTORY question, and it
 * is no longer also deciding where the script boundary falls (#657).
 */
const NATIVE_CLASS = "[a-z]";
const nat = makeNativiser(NATIVE_CLASS, "iu");

class KinyarwandaPhonemizer implements Phonemizer {
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

/** Build the Kinyarwanda phonemizer (greedy rule g2p; tone deferred). */
export function createKinyarwanda(): Phonemizer {
    return new KinyarwandaPhonemizer();
}
