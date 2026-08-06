/**
 * Native Sepedi / Northern Sotho (nso) phonemizer — Bantu (Sotho-Tswana), Latin orthography, canonical IPA,
 * A pure greedy longest-match scan over the grapheme table (sepedi.jsonc), the same engine as
 * the sibling Setswana — Sepedi is open CV, so no coda/syllabification logic. Authored beyond any machine referee
 * (kaikki Sotho = 3 words) from standard Sepedi phonology. Signatures: EJECTIVE plain stops ⟨p t k⟩→[pʼ tʼ kʼ]
 * (vs aspirated ⟨ph th kh⟩), ⟨ts⟩→[t͡sʼ], ⟨hl⟩→[ɬ], ⟨a⟩→[ɑ]. Vowel height unwritten (default mid); tone deferred. Cardinal numbers: numbers.ts (citation stems + the
 * CONJUNCTIVE compounds lesometee/masomepedi/makgolopedi — authored from Northern Sotho sources, NOT from st).
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { latinPhone } from "../../core/latinPhones.ts";
import { LATIN_RUN, makeNativiser } from "../../core/hostWord.ts";
import { loadManifest } from "../../core/loadManifest.ts";
import { numberToWords } from "./numbers.ts";

interface SepediDef {
    graphemes: Record<string, string>;
    clausePunctuation: Record<string, string>;
}
const DEF = loadManifest<SepediDef>(import.meta.url, "sepedi.jsonc");
const CLAUSE_MARK = DEF.clausePunctuation;
// Grapheme keys sorted LENGTH DESC so the greedy scan tries trigraphs (tšh, tsh, tlh) before digraphs before singles.
const KEYS = Object.keys(DEF.graphemes).sort((a, b) => b.length - a.length);

/** Phonemize a single Sepedi word to canonical IPA (segmental; tone unwritten → not emitted). */
export function phonemizeWord(word: string): string {
    const w = word.toLowerCase();
    let out = "";
    for (let i = 0; i < w.length; ) {
        let matched = false;
        for (const key of KEYS) {
            if (w.startsWith(key, i)) { out += DEF.graphemes[key]!; i += key.length; matched = true; break; }
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

// A word (Sepedi letters incl. š and the ê/ô circumflex vowels) / number / punctuation token.
const TOKEN = new RegExp(`(${LATIN_RUN})|(\\d+)|([.!?…,;:])`, "giu");

/**
 * This language's OWN inventory — the TOKEN word class as it stood before the widening above, lifted
 * verbatim, so nothing about the orthography is invented here. A token this REJECTS carries a letter the
 * language does not use, i.e. a foreign name. See core/hostWord.ts: this is the INVENTORY question, and it
 * is no longer also deciding where the script boundary falls (#657).
 */
const NATIVE_CLASS = "[a-zšêô]";
const nat = makeNativiser(NATIVE_CLASS, "iu");

class SepediPhonemizer implements Phonemizer {
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

/** Build the Sepedi phonemizer (greedy rule g2p + the cardinal compositor; tone deferred). */
export function createSepedi(): Phonemizer {
    return new SepediPhonemizer();
}
