/**
 * Kamba / Kikamba (kam) phonemizer — Niger-Congo BANTU (E55), the Latin orthography, canonical IPA,
 * Kenya (~4M). A PURE greedy longest-match scan over the grapheme table (manifest.ts) — no code
 * rules; the Bantu fricativization/prenasalization live entirely in the table (the Kikuyu pattern). The 7-vowel ATR
 * system has the TILDE marking vowel QUALITY not nasalization (⟨ĩ⟩=e, ⟨ũ⟩=o; ⟨e⟩=ɛ, ⟨o⟩=ɔ). TONE (H/L) is not
 * written → not emitted. Cardinal numbers: numbers.ts (the shared E5x compositor, citation forms).
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { latinPhone } from "../../core/latinPhones.ts";
import { MANIFEST, GRAPHEME_KEYS } from "./manifest.ts";
import { numberToWords } from "./numbers.ts";
import { normalizeKamba } from "./normalize.ts";

const G = MANIFEST.graphemes;
const CLAUSE_MARK = MANIFEST.clausePunctuation;

/** Phonemize a single Kamba word to canonical IPA (segmental; non-tonal — tone is not in the orthography). */
export function phonemizeWord(word: string): string {
    const w = word.normalize("NFC").toLowerCase();
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
            i += 1;
        }
    }
    return out;
}

// A word (Kamba Latin letters incl. ĩ ũ and the ⟨ng'⟩ apostrophe) / number / punctuation token. The word class admits
// the three apostrophe variants that spell ⟨ng'⟩ in the wild: straight ', curly ’ (U+2019), and modifier-letter ʼ
// (U+02BC, common in Kenyan Bantu orthographies).
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
const TOKEN = /(['’ʼ]?\p{Script=Latin}[\p{Script=Latin}\p{M}'’ʼ]*)|(\d+)|([.!?…,;:])/gu;

class KambaPhonemizer implements Phonemizer {
    text(input: string): string {
        // The pre-tokenizer normalization pass (normalize.ts): separators, units, signs, the clock, and the
        // ⟨î û í ú⟩ → ⟨ĩ ũ⟩ confusable fold — all of it text→text, before TOKEN ever runs.
        return assembleClauses(normalizeKamba(input), TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(m[1].replace(/[’ʼ]/gu, "'"))); // normalise ’ / ʼ → ' so the ⟨ng'⟩ key matches
            else if (m[2])
                for (const wd of numberToWords(Number(m[2]), m[2]).split(" ")) sink.emit(phonemizeWord(wd));
            else if (m[3]) {
                const mk = CLAUSE_MARK[m[3]];
                if (mk) sink.pause(mk);
            }
        });
    }
}

/** Build the Kamba phonemizer (greedy g2p + the E5x cardinal compositor; tone deferred). */
export function createKamba(): Phonemizer {
    return new KambaPhonemizer();
}
