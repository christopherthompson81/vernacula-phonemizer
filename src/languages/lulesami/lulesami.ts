/**
 * Lule Sami (smj) phonemizer — a transparent segmental grapheme scan (Ylikoski), canonical IPA. This
 * file owns the longest-match order (trigraphs → digraphs → geminate doubles) and the word-initial
 * ⟨p t k⟩ aspiration rule, plus fixed first-syllable stress. The grapheme tables and the encyclopedic
 * record (the b/d/g voicelessness trap, the deferred morphophonology) live in lulesami.jsonc.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { LATIN_RUN, makeNativiser } from "../../core/hostWord.ts";
import { loadManifest } from "../../core/loadManifest.ts";
import { numberToWords, readDigits } from "./numbers.ts";
import { normalizeLuleSami } from "./normalize.ts";

interface LuleSamiDef {
    multigraphs: [string, string][];
    letters: Record<string, string>;
}
const DEF = loadManifest<LuleSamiDef>(import.meta.url, "lulesami.jsonc");
// Grapheme tables (lulesami.jsonc). The word-initial ⟨p t k⟩ aspiration rule is in the scan below.
const MULTI = DEF.multigraphs;
const SINGLE = DEF.letters;

/** One Lule Sami word → canonical IPA (transparent segmental scan; morphophonology is the deferred residual). */
export function phonemizeWord(word: string): string {
    const t = word.normalize("NFC").toLowerCase();
    let out = "";
    let i = 0;
    while (i < t.length) {
        const dg = MULTI.find(([k]) => t.startsWith(k, i));
        if (dg) { out += dg[1]; i += dg[0].length; continue; }
        let ph = SINGLE[t[i]!] ?? "";
        // ⟨p t k⟩ are the ASPIRATED loan series only WORD-INITIALLY (§9.2.2); medially they are plain (a digraph
        // ⟨tj ts⟩ or geminate has already been consumed above, so a bare initial p/t/k here is the loan stop).
        if (i === 0 && (t[i] === "p" || t[i] === "t" || t[i] === "k")) ph += "ʰ";
        out += ph;
        i++;
    }
    // Primary stress falls on the first syllable (fixed, Saami-wide) → the word onset.
    return out ? ("ˈ" + out).normalize("NFC") : "";
}

// Lule Sami letters (a-z + á å æ ä ø ö ŋ) / number / punctuation.
const TOKEN = new RegExp(`(${LATIN_RUN})|(\\d+)|([.?!,;:…])`, "giu");

/**
 * This language's OWN inventory. ⚠ TWO DIFFERENT QUESTIONS, KEPT APART: the TOKEN class above decides where
 * the SCRIPT boundary falls (routing), while this one decides whether the g2p has rules for these letters. A
 * token this class REJECTS carries a letter the language does not use — i.e. a foreign name. See
 * core/hostWord.ts.
 */
const NATIVE_CLASS = "[a-zŋáåæäøö]";
const nat = makeNativiser(NATIVE_CLASS, "iu");

class LuleSamiPhonemizer implements Phonemizer {
    text(input: string): string {
        return assembleClauses(normalizeLuleSami(input.normalize("NFC")), TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(nat(m[1])));
            else if (m[2]) {
                // ≤12 digits stays inside the attested range (< 10¹²); longer reads the raw digit string so the
                // Number() conversion can't lose precision or go exponential. See numbers.ts for the source.
                const words = m[2].length <= 12 ? numberToWords(Number(m[2]), m[2]) : readDigits(m[2]);
                for (const wd of words.split(" ")) sink.emit(phonemizeWord(wd));
            } else if (m[3]) sink.pause(m[3] === "." || m[3] === "!" || m[3] === "?" ? m[3] : ",");
        });
    }
}

/** Build the Lule Sami phonemizer (transparent segmental scan; Ylikoski-grounded). */
export function createLuleSami(): Phonemizer {
    return new LuleSamiPhonemizer();
}
