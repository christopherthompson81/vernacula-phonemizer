/**
 * Umbundu (umb) phonemizer — Bantu (R11, Angola), the Latin orthography, canonical IPA. A pure
 * greedy longest-match scan over the grapheme table (manifest.ts): Umbundu is open CV with prenasalised clusters as
 * single onset units, so no coda/syllabification logic is needed. Signatures: VOICED obstruents ONLY prenasalised
 * (⟨mb nd nj ng⟩→ᵐb ⁿd ᶮd͡ʒ ᵑɡ), ⟨c⟩→t͡ʃ, ⟨v⟩→v, ⟨ñ⟩/⟨ny⟩→ɲ, ⟨ng'⟩→ŋ, ⟨l⟩→l. Tone (H á / L à + downstep) is often
 * unwritten → the accents are STRIPPED (tone DEFERRED); nasal-vowel tildes are kept. Cardinal numbers: numbers.ts (citation
 * forms + the quinary 6–9 nouns + the la/l’ connective).
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { latinPhone } from "../../core/latinPhones.ts";
import { MANIFEST, GRAPHEME_KEYS } from "./manifest.ts";
import { numberToWords } from "./numbers.ts";
import { normalizeUmbundu } from "./normalize.ts";

const G = MANIFEST.graphemes;
const CLAUSE_MARK = MANIFEST.clausePunctuation;

/** Strip the tone accents (acute U+0301 = H, grave U+0300 = L; tone is DEFERRED) but KEEP the nasalisation tilde
 *  (U+0303) — decompose, drop only the tone marks, recompose. */
function stripTone(w: string): string {
    return w.normalize("NFD").replace(/[̀́]/gu, "").normalize("NFC");
}

/** Phonemize a single Umbundu word to canonical IPA (segmental; tone unwritten/deferred). */
export function phonemizeWord(word: string): string {
    const w = stripTone(word.toLowerCase());
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
        // digraph) has been tried, so it can never override a reading this language has an opinion about.
        if (!matched) {
            out += latinPhone(w[i]!, { initial: i === 0, includeH: true }) ?? "";
            i++;
        }
    }
    return out;
}

// A word (Umbundu letters incl. ⟨ñ⟩ + the ⟨ng'⟩ apostrophe, and tone/nasal diacritics) / number / punctuation token.
// ⚠ THE WORD GROUP IS BOUNDED TO LATIN SCRIPT, and `[\p{L}\p{M}]` here was silent content loss. `\p{L}` matches
// EVERY script, so this token claimed embedded Greek, Cyrillic, Thai and Devanagari as though they were words of
// this language — and because they were CLAIMED they never became a gap, so `emitUnclaimed` never ran and the
// script router (core/scripts.ts) never saw them. The engine's own word path then returned empty for a script it
// cannot read, and the run vanished with nothing in the IPA to flag it.
// Bounding the group is what makes the run UNCLAIMED, which is the state the router is built to handle. `\p{M}` is
// kept alongside so a decomposed accent or tone mark stays attached to its Latin base.
//
// ⚠ AND THE GROUP MUST BEGIN WITH A LATIN LETTER, not merely contain Latin-or-mark. `[\p{Script=Latin}\p{M}]+`
// still matches a BARE COMBINING MARK, because `\p{M}` is script-neutral — so scanning `เด็ก` skipped the two
// Thai letters, claimed the lone U+0E47 as a "word", and split the gap into `เด` + `ก`. The router then read two
// syllables where Thai reads one: `dˈeː˧ kˈa˨˩ʔ` for what should be `dˈe˨˩k`. Anchoring on a Latin letter means a
// mark can only ever be claimed as part of a Latin word, which is the only thing it should attach to here.
const TOKEN = /(['’]?\p{Script=Latin}[\p{Script=Latin}\p{M}'’]*)|(\d+)|([.!?…,;:])/gu;

class UmbunduPhonemizer implements Phonemizer {
    text(input: string): string {
        // normalize.ts FIRST — its Greek-iota fold has to reach the word before TOKEN's Latin-script bound
        // splits it, and its separator, clock, dash and range steps need the figure and its mark still
        // adjacent. The shared symbol tier runs INSIDE that pass, ahead of the de-grouping (see normalize.ts).
        return assembleClauses(normalizeUmbundu(input), TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(m[1].replace(/’/gu, "'")));
            else if (m[2])
                for (const wd of numberToWords(Number(m[2]), m[2]).split(" ")) sink.emit(phonemizeWord(wd));
            else if (m[3]) { const mk = CLAUSE_MARK[m[3]]; if (mk) sink.pause(mk); }
        });
    }
}

/** Build the Umbundu phonemizer (greedy rule g2p + the cardinal compositor; tone deferred). */
export function createUmbundu(): Phonemizer {
    return new UmbunduPhonemizer();
}
