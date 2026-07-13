/**
 * Tamil (ta) phonemizer — canonical IPA, espeak-independent. The systematic abugida parsing (consonant +
 * inherent/sign vowel, virama clusters, independent vowels) is handled by the SHARED core/abugida.ts
 * interpreter driven by tamil.jsonc — the same engine Hindi uses. Tamil-specifics are layered on top as a
 * post-pass: the Dravidian plosive voicing allophony and the two-level (primary + secondary) stress, which are
 * context-sensitive and cannot be declarative. See docs/ta_native_bringup_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { makeAbugidaG2P } from "../../core/abugida.ts";
import { loadSharedPhonology } from "../../core/phonology.ts";
import { numberToWords } from "./numbers.ts";
import { MANIFEST } from "./manifest.ts";

const TIE = "͡";
const COMBINING = new Set(["̪", "̃", "ᶦ", "ᶷ"]); // dental, nasalisation, superscript i/u (aᶦ/aᶷ diphthong offglides)
// Dravidian voicing classes are DATA (tamil.jsonc). VOICE: க/ட/த/ப → voiced; VOICELESS_BLOCK: units (voiceless
// obstruents + ற) that block a following stop from voicing (the tap ர ɾ is NOT here, so a stop voices after it).
const VOICE = MANIFEST.voicing.voice;
const NASAL_UNITS = new Set(MANIFEST.voicing.nasals);
const VOICELESS_BLOCK = new Set(MANIFEST.voicing.voicelessBlock);
const isVowel = (u: string): boolean => u !== "" && "aɐɪiʊueo".includes(u[0]!);

/** Split an IPA string into phoneme units (base char + its combining marks / tie / length). */
function segment(ipa: string): string[] {
    const ch = [...ipa];
    const units: string[] = [];
    let i = 0;
    while (i < ch.length) {
        let u = ch[i]!;
        i++;
        for (;;) {
            const c = ch[i];
            if (c === TIE) {
                u += c + (ch[i + 1] ?? "");
                i += 2;
            } else if (c !== undefined && (COMBINING.has(c) || c === "ː")) {
                u += c;
                i++;
            } else break;
        }
        units.push(u);
    }
    return units;
}

/** Dravidian plosive allophony over the base phoneme units (from the shared abugida core). */
function allophony(units: string[]): string[] {
    const out: string[] = [];
    for (let i = 0; i < units.length; i++) {
        let u = units[i]!;
        const prev = units[i - 1],
            next = units[i + 1];
        // ற்ச → t͡ɕː (the ற assimilates to a following ச).
        if (u === "r" && next === "t͡ɕ") {
            out.push("t͡ɕː");
            i++;
            continue;
        }
        // Geminate: identical adjacent consonants → Cː; ற்ற → ʈr.
        if (!isVowel(u) && next === u) {
            out.push(u === "r" ? "ʈr" : u + "ː");
            i++;
            continue;
        }
        // Coda ர (ɾ) → the alveolar r (அவர்→aʋɐr); onset ர stays the tap ɾ (அரசு→aɾɐt͡ɕʊ).
        if (u === "ɾ" && (next === undefined || !isVowel(next))) u = "r";
        // Voicing. க/ட/த/ப voice unless word-initial, after a voiceless obstruent/ற, or a coda (except ட and the
        // word-final proclitic-sandhi form). ச is the exception: voiceless t͡ɕ, d͡ʒ only after a nasal.
        const prevVoiceless = prev === undefined || VOICELESS_BLOCK.has(prev);
        const postNasal = prev !== undefined && NASAL_UNITS.has(prev);
        const onset = next !== undefined && isVowel(next);
        if (u === "t͡ɕ") {
            if (postNasal) u = "d͡ʒ";
        } else if (
            u in VOICE &&
            !prevVoiceless &&
            (onset || next === undefined || u === "ʈ")
        )
            u = VOICE[u]!;
        out.push(u);
    }
    return out;
}

/** Primary ˈ on syllable 1; secondary ˌ on even nucleus indices ≥2 that are NOT the last (1–3-syllable words
 *  carry only the primary; 4+ get ˌ on syllables 3, 5, 7…). */
function stress(units: string[]): string {
    const last = units.reduce((n, u, i) => (isVowel(u) ? i : n), -1);
    let ni = -1,
        res = "";
    for (let i = 0; i < units.length; i++) {
        const u = units[i]!;
        if (isVowel(u)) {
            ni++;
            if (ni === 0) res += "ˈ";
            else if (ni >= 2 && ni % 2 === 0 && i !== last) res += "ˌ";
        }
        res += u;
    }
    return res;
}

let G2P: ((w: string) => string) | undefined;
function g2p(word: string): string {
    if (G2P === undefined)
        G2P = makeAbugidaG2P(MANIFEST, loadSharedPhonology());
    return G2P(word);
}

/** One Tamil word → canonical IPA (abugida core + allophony + two-level stress). */
export function phonemizeWord(word: string): string {
    return stress(allophony(segment(g2p(word))));
}

const CLAUSE_MARK = MANIFEST.clausePunctuation;
const TOKEN = /([஀-௿]+)|(\d+)|([.!?…,;:])/gu;

class TamilPhonemizer implements Phonemizer {
    text(input: string): string {
        return assembleClauses(input, TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(m[1]));
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

/** Build the Tamil phonemizer (shared abugida core + Tamil allophony/stress post-pass). */
export function createTamil(): Phonemizer {
    return new TamilPhonemizer();
}
