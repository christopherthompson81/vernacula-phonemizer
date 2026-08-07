/**
 * Lule Sami / julevsámegiella (smj) phonemizer — Uralic (Saami branch), ~700–2000 speakers (Norway/Sweden),
 * the 1983 Latin orthography, canonical IPA. Authored from Ylikoski, "Lule Saami" (a published reference
 * chapter). A TRANSPARENT SEGMENTAL grapheme scan.
 *
 *   · VOWELS /i u e o ɑ/ + diphthongs ⟨ie uo oa⟩: ⟨a⟩→ɑ, ⟨á⟩→ɑː (the one written length contrast), ⟨å⟩→o,
 *     ⟨æ/ä⟩→æ, loan ⟨y⟩→y ⟨ø/ö⟩→ø. Most vowel LENGTH is UNWRITTEN, so it is not emitted.
 *   ⚠ THE ORTHOGRAPHY TRAP (North-Saami-style): word-initial ⟨b d g⟩ are VOICELESS UNASPIRATED [p t k], NOT
 *     voiced — bena=[peːnə], giella=[kiellɑ]. ⟨p t k⟩ are the marginal ASPIRATED series [pʰ tʰ kʰ], found only
 *     WORD-INITIALLY in loans (§9.2.2); medially and in clusters they are PLAIN [p t k] (Table 9.5:
 *     bargo=[parkuo]).
 *   · CONSONANTS: ⟨sj⟩→ʃ, ⟨tj⟩→t͡ʃ, ⟨ts⟩→t͡s, ⟨dtj⟩→d͡ʒ, ⟨dts⟩→d͡z, ⟨nj⟩→ɲ, ⟨ŋ⟩→ŋ, ⟨ddj⟩→ɟː; ⟨lj⟩→ʎ renders the
 *     grammar's /lj/ SEQUENCE (Ylikoski has no phonemic /ʎ/). Doubled → geminate [Cː]; pre-stop ⟨h⟩
 *     (⟨hk hp ht⟩) is the gradation/pre-aspiration marker. Primary stress = the FIRST syllable.
 *
 * DEFERRED, because none of it is recoverable from a segmental scan (§9.2.5): the 3-grade consonant gradation,
 * epenthetic vowels, labial harmony, 2nd-syllable lengthening, and unwritten length.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { LATIN_RUN, makeNativiser } from "../../core/hostWord.ts";
import { numberToWords, readDigits } from "./numbers.ts";

// Multi-letter graphemes, LONGEST-FIRST (trigraphs → digraphs → geminate doubles). ⟨dtj dts⟩ = the voiced
// affricates (geminate-only); ⟨ssj ttj tts nnj llj⟩ = the palatal/sibilant geminates; ⟨ie uo oa⟩ = diphthongs.
const MULTI: [string, string][] = [
    ["ddj", "ɟː"], ["dtj", "d͡ʒ"], ["dts", "d͡z"],
    ["ssj", "ʃː"], ["ttj", "t͡ʃː"], ["tts", "t͡sː"], ["nnj", "ɲː"], ["llj", "ʎː"],
    ["sj", "ʃ"], ["tj", "t͡ʃ"], ["ts", "t͡s"], ["nj", "ɲ"], ["lj", "ʎ"], ["dj", "ɟ"],
    ["ie", "ie"], ["uo", "uo"], ["oa", "oɑ"],
    ["bb", "pː"], ["dd", "tː"], ["gg", "kː"], ["pp", "pː"], ["tt", "tː"], ["kk", "kː"],
    ["mm", "mː"], ["nn", "nː"], ["ll", "lː"], ["rr", "rː"], ["vv", "vː"], ["ss", "sː"], ["ff", "fː"],
];
// Single graphemes → IPA. ⟨b d g⟩ = VOICELESS UNASPIRATED [p t k]; ⟨p t k⟩ are PLAIN here (word-initial
// aspiration is applied below). c/q/w/x/z are loan letters (Scandinavian) adapted to the nearest phoneme.
const SINGLE: Record<string, string> = {
    a: "ɑ", á: "ɑː", å: "o", e: "e", i: "i", o: "o", u: "u", æ: "æ", ä: "æ", ø: "ø", ö: "ø", y: "y",
    b: "p", d: "t", g: "k", p: "p", t: "t", k: "k",
    m: "m", n: "n", ŋ: "ŋ", r: "r", l: "l", v: "v", j: "j", f: "f", h: "h", s: "s",
    c: "k", q: "k", w: "v", x: "ks", z: "s",
};

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
        return assembleClauses(input.normalize("NFC"), TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(nat(m[1])));
            else if (m[2]) {
                // ≤12 digits stays inside the attested range (< 10¹²); longer reads the raw digit string so the
                // Number() conversion can't lose precision or go exponential. See numbers.ts for the source.
                const words = m[2].length <= 12 ? numberToWords(Number(m[2])) : readDigits(m[2]);
                for (const wd of words.split(" ")) sink.emit(phonemizeWord(wd));
            } else if (m[3]) sink.pause(m[3] === "." || m[3] === "!" || m[3] === "?" ? m[3] : ",");
        });
    }
}

/** Build the Lule Sami phonemizer (transparent segmental scan; Ylikoski-grounded). */
export function createLuleSami(): Phonemizer {
    return new LuleSamiPhonemizer();
}
