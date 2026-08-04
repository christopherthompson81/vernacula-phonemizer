/**
 * Lithuanian / lietuvių (lt) phonemizer — Baltic (Indo-European), Latin script, ~3M, espeak-independent. A RULE-based
 * g2p (g2p.ts): a left-to-right scan + the hard/soft PALATALIZATION contrast (consonants → Cʲ before front vowels /
 * the softening ⟨i⟩, spreading through clusters) + regressive VOICING assimilation + n→ŋ before velars. STRESS is
 * lexical + pitch-accented (unpredictable from spelling) → not marked. Numbers are composed by numbers.ts (the
 * Baltic three-way counted-noun concord). See
 * docs/investigations/lt_bringup_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { toSegments } from "./g2p.ts";
import { MANIFEST } from "./manifest.ts";
import { numberToWords } from "./numbers.ts";

const CLAUSE_MARK = MANIFEST.clausePunctuation;

/** One Lithuanian word → canonical IPA (segmental; stress not marked). */
export function phonemizeWord(word: string): string {
    return toSegments(word).map((s) => s.ph).join("");
}

// A word (Lithuanian Latin letters incl. ą č ę ė į š ų ū ž) / number / punctuation token.
/**
 * This language's OWN inventory — the TOKEN class as it stood before the widening below, lifted verbatim, so
 * nothing about the orthography is invented here. A token this REJECTS carries a letter the language does not
 * use, i.e. a foreign name.
 */
const NATIVE_WORD = /^[A-Za-ząčęėįšųūžĄČĘĖĮŠŲŪŽ]+$/u;
/**
 * Fold an OUT-OF-INVENTORY accent to its base — `ö`→`o`, `ã`→`a`. This engine NATIVISES rather than routing (its
 * loan reading is its own, not English's), so a foreign name is read with native values — which needs a letter to
 * read. The g2p has no rule for a letter outside its inventory and simply DROPS it, and dropping is not
 * nativising but deleting: that is the `Klöcker` → *klkkeɾ* trap. NFD then discard marks, so a precomposed and a
 * decomposed accent behave alike.
 * ⚠ CONDITIONAL, because a native accent must survive: folding unconditionally would destroy exactly the
 * accented letters this language CAN read (Tagalog's `ñ` was the case that showed it).
 */
const foldToBase = (w: string): string => w.normalize("NFD").replace(/\p{M}+/gu, "").normalize("NFC");
const nat = (w: string): string => (NATIVE_WORD.test(w) ? w : foldToBase(w));

// ⚠ ALL OF LATIN, not just this language's own letters — the narrow class ended the token at an
// out-of-inventory diacritic, so that letter became an unclaimed gap read as an English LETTER NAME and the
// rest of the word started over: `São Paulo` fragmented into three pieces, none of them right. Invisible to
// every gate: no digit or raw mark survives and nothing VANISHES (#657).
const TOKEN = /(\p{Script=Latin}[\p{Script=Latin}\p{M}]*)|(\d+)|([.!?…,;:])/gu;

class LithuanianPhonemizer implements Phonemizer {
    text(input: string): string {
        return assembleClauses(input, TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(nat(m[1])));
            else if (m[2])
                for (const wd of numberToWords(Number(m[2])).split(" "))
                    sink.emit(phonemizeWord(wd));
            else if (m[3]) {
                const mk = CLAUSE_MARK[m[3]];
                if (mk) sink.pause(mk);
            }
        });
    }
}

/** Build the Lithuanian phonemizer (rule g2p; stress not marked). */
export function createLithuanian(): Phonemizer {
    return new LithuanianPhonemizer();
}
