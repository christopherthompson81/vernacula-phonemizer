/**
 * Hawaiian / ʻŌlelo Hawaiʻi (haw) phonemizer — Austronesian (Eastern Polynesian, sibling of Māori), Latin, canonical
 * IPA. ONE OF THE SIMPLEST phonologies in the world: 5 vowels /a e i o u/ + the MACRON (kahakō)
 * = LENGTH, and 8 consonants ⟨p k m n l h w⟩ + the ʻokina ⟨ʻ⟩→[ʔ] (a full glottal-stop consonant). A near-1:1
 * phonemic grapheme scan (no digraphs). Loanwords adapt the non-Hawaiian letters to the nearest phoneme (t→k, s→k,
 * r→l, b→p, d/g→k, v→w). A falling diphthong's 2nd vowel is a non-syllabic offglide [i̯ u̯ …] in the narrow — we
 * emit plain vowels (folded). Stress (penultimate, mora-based, unmarked) is not emitted. Cardinal numbers: numbers.ts (kūmā compounds). Referee: wikipron
 * haw_latn_broad (human, 2152).
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { hostWordRun, makeNativiser } from "../../core/hostWord.ts";
import { loadManifest } from "../../core/loadManifest.ts";
import { numberToWords } from "./numbers.ts";

interface HawaiianDef {
    graphemes: Record<string, string>;
    clausePunctuation: Record<string, string>;
}
const DEF = loadManifest<HawaiianDef>(import.meta.url, "hawaiian.jsonc");
const G = DEF.graphemes;
const CLAUSE_MARK = DEF.clausePunctuation;

/** Phonemize a single Hawaiian word to canonical IPA — a direct single-grapheme scan. */
export function phonemizeWord(word: string): string {
    const w = word.normalize("NFC").toLowerCase();
    const out: string[] = [];
    for (const ch of w) {
        const ph = G[ch];
        if (ph !== undefined) out.push(ph); // unknown marks (hyphen etc.) → skip
    }
    return out.join("");
}

// A word (Hawaiian Latin letters incl. the macron vowels ā ē ī ō ū and the ʻokina variants) / number / punctuation.
// The combining-diacritics range ̀-ͯ keeps a DECOMPOSED (NFD) macron vowel (a+◌̄) inside one token so
// phonemizeWord's NFC-normalize can recompose it (else the raw macron would split the word: kāne→"ka ne").
const TOKEN = new RegExp(`(${hostWordRun(["Latin"], "'ʻʼ‘`-")})|(\\d+)|([.!?…,;:])`, "gu");

/**
 * This language's OWN inventory — the TOKEN word class as it stood before the widening above, lifted
 * verbatim, so nothing about the orthography is invented here. A token this REJECTS carries a letter the
 * language does not use, i.e. a foreign name. See core/hostWord.ts: this is the INVENTORY question, and it
 * is no longer also deciding where the script boundary falls (#657).
 */
const NATIVE_CLASS = "[a-zāēīōūĀĒĪŌŪA-Z'ʻʼ‘`ʔ̀-ͯ-]";
const nat = makeNativiser(NATIVE_CLASS, "u");

class HawaiianPhonemizer implements Phonemizer {
    text(input: string): string {
        return assembleClauses(input, TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(nat(m[1])));
            // Cardinal numbers (numbers.ts) — emitted one word at a time, as for ordinary text.
            else if (m[2]) for (const wd of numberToWords(Number(m[2])).split(" ")) sink.emit(phonemizeWord(wd));
            else if (m[3]) { const mk = CLAUSE_MARK[m[3]]; if (mk) sink.pause(mk); }
        });
    }
}

/** Build the Hawaiian phonemizer (direct phonemic g2p + macron length + ʻokina glottal + loan adaptation + numbers). */
export function createHawaiian(): Phonemizer {
    return new HawaiianPhonemizer();
}
