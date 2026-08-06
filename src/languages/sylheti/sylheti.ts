/**
 * Native Sylheti / ꠍꠤꠟꠐꠤ ꠘꠣꠉꠞꠤ (syl) text phonemizer — canonical IPA. Eastern Indo-Aryan
 * (Bengali-Assamese), written in the SYLOTI NAGRI abugida. Read by the generic engine (core/abugida.ts) with the
 * inherent vowel /ɔ/ and Bengali-style inherent-vowel deletion (final drop after a single coda, retain [o] after a
 * cluster; medial Ohala deletion). Sylheti's signature is SPIRANTISATION (ꠇ/ꠈ→x, ꠌ/ꠍ→s, ꠎ→z, ꠙ→ɸ, ꠚ→f, ꠡ→ʃ,
 * ꠢ→ɦ; aspiration lost on the voiced stops) — the split from Bengali, encoded in the grapheme table. Cardinal
 * numbers use the INDIC composer (2-2-3 lakh/crore grouping, fused 21-99). Tone (H/L,
 * developed from lost breathy voice) is UNWRITTEN → deferred.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { makeAbugidaG2P, type AbugidaDef } from "../../core/abugida.ts";
import { renderNumber, indicNumberWords, type NumbersDef } from "../../core/numbers.ts";
import { deleteMedialSchwa } from "../../core/schwa.ts";
import { loadSharedPhonology } from "../../core/phonology.ts";
import { loadManifest } from "../../core/loadManifest.ts";

interface SylhetiDef extends AbugidaDef {
    numbers: NumbersDef;
    clausePunctuation: Record<string, string>;
}
const DEF = loadManifest<SylhetiDef>(import.meta.url, "sylheti.jsonc");
const CLAUSE_MARK = DEF.clausePunctuation;
const VOWEL_G = /[aeiouɔ]/gu;
// Geminate consonant (doubled base, possibly aspirated) → single + length ː.
const GEMINATE = /(t̪|d̪|ʈ|ɖ|[xszʃɸfbɡmnlɾɽjɦ])\1(?!͡)/gu;

let G2P: ((w: string) => string) | undefined;
const g2p = (w: string): string => (G2P ??= makeAbugidaG2P(DEF, loadSharedPhonology()))(w);

/** Word-final inherent /ɔ/: drop after a single light coda (…VCɔ → …VC), retain as [o] after a heavy coda. */
function deleteFinalInherent(ipa: string): string {
    if (!ipa.endsWith("ɔ")) return ipa;
    const body = ipa.slice(0, -1);
    const lastV = [...body.matchAll(VOWEL_G)].pop();
    if (!lastV) return body;
    const coda = body.slice(lastV.index! + 1).replace(/[ʰʱ̪͡ː̃]/gu, "");
    return body.slice(lastV.index! + 1).includes("ː") || coda.length >= 2 ? body + "o" : body;
}

/** One Sylheti word → canonical IPA (rules only; tone deferred). */
export function phonemizeWord(word: string): string {
    let x = g2p(word.normalize("NFC"));
    x = x.replace(GEMINATE, "$1ː").replace(/ː([ʰʱ])/gu, "$1ː");
    const syls = (x.match(VOWEL_G) || []).length;
    if (syls >= 2) x = deleteFinalInherent(x);
    x = deleteMedialSchwa(x, "ɔ");
    return x.normalize("NFC");
}

/** A run of ASCII digits → the spoken Sylheti cardinal in canonical IPA (Indic 2-2-3 lakh/crore grouping). */
function number(digits: string): string {
    const n = Number(digits);
    if (!Number.isSafeInteger(n)) return digits;
    return renderNumber(n, DEF.numbers, phonemizeWord, indicNumberWords);
}

// A word (Syloti Nagri block U+A800–A82C) / number / punctuation token.
const TOKEN = /([ꠀ-꠬]+)|(\d+)|([꠨꠩।.?!,])/gu;

class SylhetiPhonemizer implements Phonemizer {
    text(input: string): string {
        return assembleClauses(input, TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(m[1]));
            else if (m[2]) sink.emit(number(m[2])); // Syloti Nagri has no digits of its own — ASCII/Bengali used
            else if (m[3]) {
                const mk = CLAUSE_MARK[m[3]];
                if (mk) sink.pause(mk);
            }
        });
    }
}

/** Build the Sylheti phonemizer (Syloti Nagri abugida + Indic cardinals; tone deferred). */
export function createSylheti(): Phonemizer {
    return new SylhetiPhonemizer();
}
