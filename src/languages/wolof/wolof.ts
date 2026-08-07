/**
 * Wolof (wo) phonemizer — Atlantic-Congo (Senegambian), the Latin orthography, canonical IPA.
 * The principal language of Senegal (~12M incl. L2). NON-tonal. A greedy longest-match scan over the grapheme
 * table (manifest.ts) with two code rules: CONSONANT GEMINATION — a doubled consonant is a geminate [Cː]
 * (benn→bɛnː, làkk→laːkː) — and NASAL place assimilation — ⟨n⟩→ŋ before g/k (Angale→aŋɡalɛ). Signatures: ATR
 * vowels (⟨e⟩=ɛ / ⟨é⟩=e, ⟨o⟩=ɔ / ⟨ó⟩=o, ⟨ë⟩=ə, ⟨à⟩=aː) with DOUBLING = LENGTH (aa→aː, ée→eː); the palatal STOPS
 * ⟨c⟩=c, ⟨j⟩=ɟ; ⟨x⟩=x, ⟨ñ⟩=ɲ, ⟨ŋ⟩=ŋ, ⟨q⟩=q. The variable word-initial glottal onset [ʔ] is not emitted (folded).
 * Wolof is also written in Arabic (Wolofal) and Garay — those scripts are deferred.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { latinPhone } from "../../core/latinPhones.ts";
import { LATIN_RUN, makeNativiser } from "../../core/hostWord.ts";
import { MANIFEST, GRAPHEME_KEYS } from "./manifest.ts";
import { numberToWords } from "./numbers.ts";

const G = MANIFEST.graphemes;
const CLAUSE_MARK = MANIFEST.clausePunctuation;
const VOWEL_LETTERS = new Set(["a", "à", "e", "é", "ë", "i", "o", "ó", "u"]);

/** Phonemize a single Wolof word to canonical IPA (segmental; gemination + nasal assimilation; non-tonal). */
export function phonemizeWord(word: string): string {
    const w = word.toLowerCase();
    let out = "";
    let i = 0;
    while (i < w.length) {
        const c = w[i]!;
        // consonant gemination: a doubled consonant letter → geminate [Cː]
        if (!VOWEL_LETTERS.has(c) && w[i + 1] === c && G[c]) {
            out += G[c]! + "ː";
            i += 2;
            continue;
        }
        // nasal place assimilation: ⟨n⟩ → ŋ before a velar g/k
        if (c === "n" && (w[i + 1] === "g" || w[i + 1] === "k")) {
            out += "ŋ";
            i += 1;
            continue;
        }
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
            out += latinPhone(w[i]!, { initial: i === 0 }) ?? "";
            i += 1;
        }
    }
    return out;
}

// A word (Wolof Latin letters incl. à é ë ó ñ ŋ) / number / punctuation token.
const TOKEN = new RegExp(`(${LATIN_RUN})|(\\d+)|([.!?…,;:])`, "giu");

/**
 * This language's OWN inventory. ⚠ TWO DIFFERENT QUESTIONS, KEPT APART: the TOKEN class above decides where
 * the SCRIPT boundary falls (routing), while this one decides whether the g2p has rules for these letters. A
 * token this class REJECTS carries a letter the language does not use — i.e. a foreign name. See
 * core/hostWord.ts.
 */
const NATIVE_CLASS = "[a-zàéëóñŋ]";
const nat = makeNativiser(NATIVE_CLASS, "iu");

class WolofPhonemizer implements Phonemizer {
    text(input: string): string {
        return assembleClauses(input, TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(nat(m[1])));
            // numbers: spoken in the QUINARY/decimal Wolof system (numbers.ts), then through the same g2p
            else if (m[2]) for (const wd of numberToWords(Number(m[2])).split(" ")) sink.emit(phonemizeWord(wd));
            else if (m[3]) {
                const mk = CLAUSE_MARK[m[3]];
                if (mk) sink.pause(mk);
            }
        });
    }
}

/** Build the Wolof phonemizer (greedy g2p + gemination; quinary numbers). */
export function createWolof(): Phonemizer {
    return new WolofPhonemizer();
}
