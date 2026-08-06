/**
 * Kirundi / Ikirundi (rn) phonemizer — Bantu (JD62, Rwanda-Rundi), the Latin orthography, canonical IPA,
 * The principal language of Burundi (~11M incl. L2). A NEAR-CLONE of Kinyarwanda (rw): the same
 * greedy longest-match scan over the grapheme table (manifest.ts) + the Cox comparative-grammar palatal series,
 * with ONE confident Kirundi delta — ⟨j⟩ → d͡ʒ (the voiced palatal AFFRICATE, vs Kinyarwanda's fricative ⟨j⟩→ʒ).
 * Signatures: PALATALISATION ⟨Cy⟩→[Cʲ] (⟨cy⟩→kʲ, ⟨jy⟩→ɡʲ, ⟨shy⟩→ʃʲ, ⟨by⟩→bʲ, ⟨ry⟩→ɾʲ, ⟨my⟩→mʲ; ⟨ny⟩→ɲ), plain
 * ⟨c⟩→t͡ʃ, ⟨sh⟩→ʃ, ⟨ng⟩→ŋ, double vowels → long. Tone (H/L) unwritten → DEFERRED. The referee (epitran run-Latn) is
 * crude and partly circular; we do NOT follow its unverified blanket NC-spirantisation (mp→mh, nt→nh, nk→ŋx) — a
 * weaker verification than rw.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { latinPhone } from "../../core/latinPhones.ts";
import { LATIN_RUN, makeNativiser } from "../../core/hostWord.ts";
import { numberToWords } from "./numbers.ts";
import { MANIFEST, GRAPHEME_KEYS } from "./manifest.ts";

const G = MANIFEST.graphemes;
const CLAUSE_MARK = MANIFEST.clausePunctuation;

/** Phonemize a single Kirundi word to canonical IPA (segmental; no tone — Kirundi tone is unwritten). */
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

// A word (Kirundi letters; the apostrophe marks vowel elision — a boundary, so it splits tokens) / number /
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

class KirundiPhonemizer implements Phonemizer {
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

/** Build the Kirundi phonemizer (greedy rule g2p; tone deferred). */
export function createKirundi(): Phonemizer {
    return new KirundiPhonemizer();
}
