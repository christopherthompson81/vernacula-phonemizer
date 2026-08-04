/**
 * Malagasy (mg) phonemizer — Standard/Official Malagasy (Merina), canonical IPA, espeak-independent. Rule-based
 * g2p (g2p.ts) + penultimate stress (the Malagasy default). text() tokenizes words / numbers / punctuation. See
 * docs/investigations/mg_native_bringup_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { hostWordRun, makeNativiser } from "../../core/hostWord.ts";
import { toSegments } from "./g2p.ts";
import { numberToWords } from "./numbers.ts";
import { MANIFEST } from "./manifest.ts";

/** Phonemize a single Malagasy word to canonical IPA (penultimate stress, before the stressed vowel). */
export function phonemizeWord(word: string): string {
    const segs = toSegments(word);
    const nuclei = segs.map((s, i) => (s.nucleus ? i : -1)).filter((i) => i >= 0);
    if (nuclei.length === 0) return segs.map((s) => s.ph).join("");
    // Penultimate stress (monosyllables → their only vowel).
    const stressIdx = nuclei.length >= 2 ? nuclei[nuclei.length - 2]! : nuclei[0]!;
    let out = "";
    for (let i = 0; i < segs.length; i++) {
        if (i === stressIdx) out += "ˈ";
        out += segs[i]!.ph;
    }
    return out;
}

const CLAUSE_MARK = MANIFEST.clausePunctuation;
// A word (Malagasy letters + apostrophe for elision: n'ny), a number, or clause punctuation.
const TOKEN = new RegExp(`(${hostWordRun(["Latin"], "", "'’")})|(\\d+)|([.!?…,;:])`, "giu");

/**
 * This language's OWN inventory — the TOKEN word class as it stood before the widening above, lifted
 * verbatim, so nothing about the orthography is invented here. A token this REJECTS carries a letter the
 * language does not use, i.e. a foreign name. See core/hostWord.ts: this is the INVENTORY question, and it
 * is no longer also deciding where the script boundary falls (#657).
 */
const NATIVE_CLASS = "[a-zàâôé]";
const nat = makeNativiser(NATIVE_CLASS, "iu");

class MalagasyPhonemizer implements Phonemizer {
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

/** Build the Malagasy phonemizer (rule g2p + penultimate stress). */
export function createMalagasy(): Phonemizer {
    return new MalagasyPhonemizer();
}
