/**
 * Setswana / Tswana (tn) phonemizer — Bantu (Sotho-Tswana, S31), the Latin orthography, canonical IPA,
 * espeak-independent. A pure greedy longest-match scan over the grapheme table (manifest.ts): Setswana is open CV
 * with the syllabic-nasal + C clusters as onset units, so no coda/syllabification logic is needed. Signatures:
 * the uvular-fricative ⟨g⟩→χ (NO /g/ phoneme — a beyond-epitran divergence), dorsal aspirates ⟨kg kh⟩→k͡χʰ kʰ,
 * lateral affricates ⟨tl tlh⟩→t͡ɬ t͡ɬʰ, ⟨tš š⟩→t͡ʃ ʃ, ⟨ny ng⟩→ɲ ŋ. Vowels are the standard 7-vowel system
 * /i ɪ ɛ a ɔ ʊ u/ (⟨e⟩→ɪ, ⟨o⟩→ʊ, ⟨ê ô⟩→ɛ ɔ). Tone (H/L) is lexical + unwritten → DEFERRED (segmental output
 * only). Cardinal numbers via numbers.ts. See docs/investigations/tn_native_bringup_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { latinPhone } from "../../core/latinPhones.ts";
import { LATIN_RUN, makeNativiser } from "../../core/hostWord.ts";
import { MANIFEST, GRAPHEME_KEYS } from "./manifest.ts";
import { numberToWords } from "./numbers.ts";

const G = MANIFEST.graphemes;
const CLAUSE_MARK = MANIFEST.clausePunctuation;

/** Phonemize a single Setswana word to canonical IPA (segmental; no tone — Setswana tone is unwritten). */
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

// A word (Setswana letters incl. š and the ê/ô circumflex vowels) / number / punctuation token.
const TOKEN = new RegExp(`(${LATIN_RUN})|(\\d+)|([.!?…,;:])`, "giu");

/**
 * This language's OWN inventory — the TOKEN word class as it stood before the widening above, lifted
 * verbatim, so nothing about the orthography is invented here. A token this REJECTS carries a letter the
 * language does not use, i.e. a foreign name. See core/hostWord.ts: this is the INVENTORY question, and it
 * is no longer also deciding where the script boundary falls (#657).
 */
const NATIVE_CLASS = "[a-zšêô]";
const nat = makeNativiser(NATIVE_CLASS, "iu");

class SetswanaPhonemizer implements Phonemizer {
    text(input: string): string {
        return assembleClauses(input, TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(nat(m[1])));
            else if (m[2]) for (const wd of numberToWords(Number(m[2])).split(" ")) sink.emit(phonemizeWord(wd));
            else if (m[3]) {
                const mk = CLAUSE_MARK[m[3]];
                if (mk) sink.pause(mk);
            }
        });
    }
}

/** Build the Setswana phonemizer (greedy rule g2p; tone + numbers deferred). */
export function createSetswana(): Phonemizer {
    return new SetswanaPhonemizer();
}
