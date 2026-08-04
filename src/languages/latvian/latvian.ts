/**
 * Latvian (lv) phonemizer — canonical IPA, latviešu, Baltic, espeak-independent. Rule g2p (g2p.ts) + FIXED
 * first-syllable stress (emitted before the first nucleus — Latvian stress is predictable, unlike Lithuanian).
 * Written length (macrons) + written palatals are emitted directly; the syllable tone the narrow referee carries is
 * unwritten → folded. text() tokenizes words / numbers / punctuation. See docs/investigations/lv_native_bringup_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { toSegments } from "./g2p.ts";
import { numberToWords, readDigits } from "./numbers.ts";
import { MANIFEST } from "./manifest.ts";

/** One Latvian word → canonical IPA with fixed first-syllable stress (ˈ before the first nucleus). */
export function phonemizeWord(word: string): string {
    const segs = toSegments(word);
    const first = segs.findIndex((s) => s.nucleus);
    let out = "";
    for (let i = 0; i < segs.length; i++) {
        if (i === first) out += "ˈ";
        out += segs[i]!.ph;
    }
    return out;
}

const CLAUSE_MARK = MANIFEST.clausePunctuation;
/**
 * This language's OWN inventory — the TOKEN class as it stood before the widening below, lifted verbatim, so
 * nothing about the orthography is invented here. A token this REJECTS carries a letter the language does not
 * use, i.e. a foreign name.
 */
const NATIVE_WORD = /^[A-Za-zĀāČčĒēĢģĪīĶķĻļŅņŌōŠšŪūŽž]+$/u;
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

class LatvianPhonemizer implements Phonemizer {
    text(input: string): string {
        return assembleClauses(input, TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(nat(m[1])));
            else if (m[2]) {
                const words = m[2].length <= 9 ? numberToWords(Number(m[2])) : readDigits(m[2]);
                for (const wd of words.split(" ")) sink.emit(phonemizeWord(wd));
            } else if (m[3]) {
                const mk = CLAUSE_MARK[m[3]];
                if (mk) sink.pause(mk);
            }
        });
    }
}

/** Build the Latvian phonemizer (rule g2p + first-syllable stress + cardinal numbers). */
export function createLatvian(): Phonemizer {
    return new LatvianPhonemizer();
}
