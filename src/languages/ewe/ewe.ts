/**
 * Ewe (ee) phonemizer — a near-phonemic longest-match scan, canonical IPA. This file owns the allophony:
 * the ⟨r⟩ [l]~[r] split (post-consonant [l]), the ⟨w⟩ [w]/[ɰ] rounding rule, and the nasalization-tilde
 * handling on both combining and precomposed vowels. The digraph/letter tables and the encyclopedic
 * record live in ewe.jsonc.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { loadManifest } from "../../core/loadManifest.ts";
import { latinPhone } from "../../core/latinPhones.ts";
import { numberToWords } from "./numbers.ts";

interface EweDef {
    digraphs: Record<string, string>;
    letters: Record<string, string>;
}
const DEF = loadManifest<EweDef>(import.meta.url, "ewe.jsonc");
// Letter → IPA tables (ewe.jsonc). The ⟨r⟩ and ⟨w⟩ allophony rules are handled in the scan below.
const DIGRAPH = DEF.digraphs;
const G = DEF.letters;
const ORDER = Object.keys(DIGRAPH); // all length-2

// NFD so a PRECOMPOSED nasal vowel (ã ẽ ĩ õ ũ) decomposes to base+◌̃ and its base is still recognised as a vowel.
const isVowelSeg = (s: string | undefined): boolean => s !== undefined && [...s.normalize("NFD")].some((c) => "aeiouɛɔ".includes(c));

/** Phonemize one Ewe word → canonical IPA: longest-match scan (nasalization tilde kept, tone not emitted). */
export function phonemizeWord(word: string): string {
    const w = word.normalize("NFC").toLowerCase();
    const chars = [...w];
    const segs: string[] = [];
    let i = 0;
    outer: while (i < chars.length) {
        // Two-letter digraph?
        if (i + 1 < chars.length) {
            const two = chars[i]! + chars[i + 1]!;
            if (DIGRAPH[two] !== undefined) { segs.push(DIGRAPH[two]!); i += 2; continue; }
        }
        const c = chars[i]!;
        // ⟨r⟩ is [l] after a consonant (an onset cluster — Ewe /l/~/r/ allophony, "[l] follows velar/alveolar
        // consonants", Jalloh), else [r] (word-initial, after a vowel — mostly loans: Mars→mars).
        if (c === "r") { segs.push(segs.length === 0 || isVowelSeg(segs[segs.length - 1]) ? "r" : "l"); i += 1; continue; }
        // ⟨w⟩ is the ROUNDED [w] before a rounded vowel (o u ɔ), the unrounded velar approximant [ɰ] before an
        // unrounded one (Jalloh's rounding allophony; ⟨ɣ⟩ is always [ɰ]). A post-consonant ⟨w⟩ is a labialization
        // glide → [w] (loan Cw, e.g. kwasiɖa). The referee generalizes [ɰ] (folded in eval).
        if (c === "w") {
            const nb = chars[i + 1]?.normalize("NFD")[0];
            const afterConsonant = segs.length > 0 && !isVowelSeg(segs[segs.length - 1]);
            segs.push(afterConsonant || (nb !== undefined && "ouɔ".includes(nb)) ? "w" : "ɰ");
            i += 1; continue;
        }
        // A base letter, possibly carrying a combining nasalization tilde (U+0303) — keep the tilde, drop tone
        // (acute/grave/… — the orthography doesn't write tone anyway).
        if (G[c] !== undefined) {
            segs.push(chars[i + 1] === "̃" ? (G[c]! + "̃").normalize("NFC") : G[c]!);
            if (chars[i + 1] === "̃") i += 1;
            i += 1; continue outer;
        }
        // A precomposed letter carrying a mark (ã ẽ ɛ̃ é à ç ý …): decompose, map the BASE with Ewe's own value
        // for that letter, and keep only the nasalization tilde.
        // ⚠ THE BASE NEED NOT BE A VOWEL. This branch used to require `"aeiouɛɔ".includes(base)`, which was a
        // restatement of "the tilde only nasalises a vowel" in the wrong place — it also threw away every
        // marked CONSONANT, whose base letter Ewe reads perfectly well: `Podobský` → *podobsk (⟨y⟩ = /j/ is in
        // the table), `Française` → *flanaise (⟨c⟩ = /t͡s/ is too). The vowel test belongs on the TILDE, which
        // is where it now is, and this branch does what it says: read the letter under the mark.
        const nfd = [...c.normalize("NFD")];
        const base = nfd[0]!;
        if (G[base] !== undefined) {
            const nasal = nfd.includes("̃") && "aeiouɛɔ".includes(base);
            segs.push((G[base]! + (nasal ? "̃" : "")).normalize("NFC"));
            i += 1; continue;
        }
        // Still nothing: a letter from an alphabet Ewe does not use at all (ñ, ß, æ). The shared table names
        // the phone the letter denotes rather than dropping it — ⟨ñ⟩ → /ɲ/, which Ewe has (⟨ny⟩).
        const ph = latinPhone(c, { initial: i === 0 });
        if (ph !== undefined) { segs.push(ph); i += 1; continue; }
        i += 1; // unmapped (a stray combining mark of its own, punctuation) — drop
    }
    return segs.join("").normalize("NFC");
}

// An Ewe word (Latin + ɖ Ɖ ƒ ʋ ɣ ŋ ɔ ɛ + combining marks) / number / punctuation. The input is NFD-normalised in text()
// so a precomposed nasal/toned vowel (ã ẽ … á à) decomposes to base + a combining mark the ̀-ͯ range captures. Numbers → numbers.ts.
const TOKEN = /([a-zɖƒʋɣŋɔɛA-ZƉƑƲƔŊƆƐ̀-ͯ']+)|(\d+)|([.!?…,;:])/gu;

class EwePhonemizer implements Phonemizer {
    text(input: string): string {
        return assembleClauses(input.normalize("NFD"), TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(m[1]));
            // numbers: composed to Ewe words (numbers.ts: wui-/bla- decimal), then through the same scan
            else if (m[2]) for (const wd of numberToWords(Number(m[2])).split(" ")) sink.emit(phonemizeWord(wd));
            else if (m[3]) sink.pause(m[3] === "." || m[3] === "!" || m[3] === "?" ? "." : ",");
        });
    }
}

/** Build the Ewe phonemizer (near-phonemic Gbe scan; toneless). */
export function createEwe(): Phonemizer {
    return new EwePhonemizer();
}
