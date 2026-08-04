/**
 * Chichewa / Chinyanja (nya) phonemizer — Bantu (N31), the Latin orthography, canonical IPA, espeak-independent.
 * A pure greedy longest-match scan over the grapheme table (manifest.ts): Chichewa is open CV with prenasalised
 * clusters as single onset units, so no coda/syllabification logic is needed. Signatures: IMPLOSIVES ⟨b d⟩→ɓ ɗ,
 * the retroflex-tap liquid ⟨l⟩=⟨r⟩→ɽ, PRENASALISED ⟨mb nd ng⟩→ᵐb ⁿd ᵑɡ (⟨ng'⟩→ŋ), aspirates ⟨ph th kh⟩→pʰ tʰ kʰ.
 * Tone (H/L) is unwritten → DEFERRED (segmental output only). See docs/investigations/nya_native_bringup_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { latinPhone } from "../../core/latinPhones.ts";
import { hostWordRun, makeNativiser } from "../../core/hostWord.ts";
import { numberToWords } from "./numbers.ts";
import { MANIFEST, GRAPHEME_KEYS } from "./manifest.ts";

const G = MANIFEST.graphemes;
const CLAUSE_MARK = MANIFEST.clausePunctuation;

/** Phonemize a single Chichewa word to canonical IPA (segmental; no tone — Chichewa tone is unwritten). */
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

// A word (Chichewa letters + the ⟨ng'⟩ apostrophe, incl. the typographic ’) / number / punctuation token.
const TOKEN = new RegExp(`(${hostWordRun(["Latin"], "'’")})|(\\d+)|([.!?…,;:])`, "giu");

/**
 * This language's OWN inventory — the TOKEN word class as it stood before the widening above, lifted
 * verbatim, so nothing about the orthography is invented here. A token this REJECTS carries a letter the
 * language does not use, i.e. a foreign name. See core/hostWord.ts: this is the INVENTORY question, and it
 * is no longer also deciding where the script boundary falls (#657).
 */
const NATIVE_CLASS = "[a-z'’]";
const nat = makeNativiser(NATIVE_CLASS, "iu");

class ChichewaPhonemizer implements Phonemizer {
    text(input: string): string {
        return assembleClauses(input, TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(nat(m[1]).replace(/’/gu, "'")));
            else if (m[2])
                for (const wd of numberToWords(Number(m[2])).split(" ")) sink.emit(phonemizeWord(wd));
            else if (m[3]) {
                const mk = CLAUSE_MARK[m[3]];
                if (mk) sink.pause(mk);
            }
        });
    }
}

/** Build the Chichewa phonemizer (greedy rule g2p; tone deferred). */
export function createChichewa(): Phonemizer {
    return new ChichewaPhonemizer();
}
