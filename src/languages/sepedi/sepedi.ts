/**
 * Native Sepedi / Northern Sotho (nso) phonemizer — Bantu (Sotho-Tswana), Latin orthography, canonical IPA,
 * A pure greedy longest-match scan over the grapheme table (sepedi.jsonc), the same engine as
 * the sibling Setswana — Sepedi is open CV, so no coda/syllabification logic. Authored from standard Sepedi
 * phonology: there is no wikipron, no kaikki (Sotho = 3 words) and no epitran nso map. ⚠ It is NOT unverifiable,
 * though — 1,990 FLEURS utterances in the ASR-alignment corpus are a referee in another modality, and they
 * carried a quantified vowel defect for as long as this file said otherwise (see VOWELS below). Signatures: EJECTIVE plain stops ⟨p t k⟩→[pʼ tʼ kʼ]
 * (vs aspirated ⟨ph th kh⟩), ⟨ts⟩→[t͡sʼ], ⟨hl⟩→[ɬ].
 * VOWELS: the unmarked ⟨e o⟩ are the CLOSE-mid [e o] and the circumflex ⟨ê ô⟩ the OPEN-mid [ɛ ɔ] — the contrast the
 * orthography writes; ⟨a⟩→[a]. The residual height alternation (⟨e⟩ also realised [i], ⟨o⟩ also [u], conditioned by a
 * following high vowel) is NOT modelled: it is real in the audio but raising categorically measures WORSE than the flat
 * default (0.2840 vs 0.2763), so it needs a better source than a phone recognizer.
 * Tone deferred. Cardinal numbers: numbers.ts (citation stems + the CONJUNCTIVE compounds lesometee/masomepedi/makgolopedi — authored from Northern Sotho sources, NOT from st).
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { latinPhone } from "../../core/latinPhones.ts";
import { LATIN_RUN, makeNativiser } from "../../core/hostWord.ts";
import { loadManifest } from "../../core/loadManifest.ts";
import { numberToWords } from "./numbers.ts";
import { normalizeSepedi } from "./normalize.ts";

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
        // digraph) has been tried, so it can never override a reading this language has an opinion about.
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
 * This language's OWN inventory. ⚠ TWO DIFFERENT QUESTIONS, KEPT APART: the TOKEN class above decides where
 * the SCRIPT boundary falls (routing), while this one decides whether the g2p has rules for these letters. A
 * token this class REJECTS carries a letter the language does not use — i.e. a foreign name. See
 * core/hostWord.ts.
 */
const NATIVE_CLASS = "[a-zšêô]";
const nat = makeNativiser(NATIVE_CLASS, "iu");

class SepediPhonemizer implements Phonemizer {
    text(input: string): string {
        // TEXT NORMALIZATION FIRST — %, currency, units, ranges, decimals and the grouping separators become
        // words before anything is tokenized. Pure text→text; the words it emits are phonemized by the very
        // same branches below, so no spelling can reach the phoneme sink (normalize.ts, playbook trap 6).
        return assembleClauses(normalizeSepedi(input), TOKEN, (m, sink) => {
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
