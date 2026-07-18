/**
 * Madurese / Bhâsa Madhurâ (mad) phonemizer — Austronesian, the 2008-revision Latin orthography, canonical IPA,
 * espeak-independent. NOT a direct grapheme map: Madurese has a signature VOWEL-REGISTER HARMONY (vowels raise
 * a→ɤ, ɛ→i, ə→ɨ, ɔ→u after a voiced OR aspirated stop; low elsewhere; ⟨l r w y⟩ transparent), plus glide/glottal
 * epenthesis between vowels, word-final devoicing, and geminate length. See
 * docs/investigations/mad_native_bringup_investigation.md.
 *
 * Pipeline: tokenize (greedy longest-match, tracking geminates) → epenthesis (insert ʔ between identical vowels,
 * w/j between different vowels unless height rises) → harmony (a register state machine sets each vowel's height)
 * → final devoicing → join.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { numberToWords } from "./numbers.ts";
import { MANIFEST, CONS, CONS_KEYS, VOWEL_KEYS, type Reg } from "./manifest.ts";

const VSPEC = MANIFEST.vowelSpec;
const DEVOICE = MANIFEST.finalDevoice;
const CLAUSE_MARK = MANIFEST.clausePunctuation;

type Seg =
    | { kind: "C"; ipa: string; reg: Reg }
    | { kind: "V"; low: string; high: string };

const isConsLetter = (ch: string): boolean =>
    CONS.has(ch) || ch === "h"; // h forms digraphs (bh/dh/…) and is itself a consonant
const HEIGHT: Record<string, number> = { a: 0, ɛ: 1, ə: 1, ɔ: 1, e: 1, i: 2, u: 2 };
const isFront = (u: string): boolean => u === "i" || u === "ɛ" || u === "e";

/** Tokenize a word into consonant/vowel segments, expanding geminates to a length-marked consonant. */
function tokenize(w: string): Seg[] {
    const segs: Seg[] = [];
    let i = 0;
    let geminate = false;
    while (i < w.length) {
        // A doubled consonant LETTER marks a geminate: skip the first, length-mark the real consonant next round
        // (⟨tt⟩→tː, ⟨ss⟩→sː, ⟨bbh⟩→pʰː; liquids ⟨rr ll⟩ degeminate to a plain single).
        if (w[i] === w[i + 1] && isConsLetter(w[i]!)) {
            geminate = true;
            i += 1;
            continue;
        }
        let matched = false;
        for (const key of CONS_KEYS) {
            if (w.startsWith(key, i)) {
                const c = CONS.get(key)!;
                let ipa = c.ipa;
                if (geminate) {
                    if (c.ipa !== "l" && c.ipa !== "ɾ") ipa += "ː"; // liquids degeminate
                    geminate = false;
                }
                segs.push({ kind: "C", ipa, reg: c.reg });
                i += key.length;
                matched = true;
                break;
            }
        }
        if (matched) continue;
        for (const key of VOWEL_KEYS) {
            if (w.startsWith(key, i)) {
                const [low, high] = VSPEC[key]!;
                segs.push({ kind: "V", low, high });
                i += key.length;
                matched = true;
                break;
            }
        }
        if (!matched) {
            geminate = false;
            i += 1; // unknown char → skip
        }
    }
    return segs;
}

/** Insert epenthetic glides/glottal between adjacent vowels (Madurese vowel hiatus). */
function epenthesize(segs: Seg[]): Seg[] {
    const out: Seg[] = [];
    for (let k = 0; k < segs.length; k++) {
        out.push(segs[k]!);
        const a = segs[k]!;
        const b = segs[k + 1];
        // Decisions use the LOW (underlying) vowel quality — hiatus is resolved before the harmony sets height.
        if (a.kind === "V" && b && b.kind === "V") {
            if (a.low === b.low) out.push({ kind: "C", ipa: "ʔ", reg: "low" }); // identical → glottal
            else if ((HEIGHT[b.low] ?? 0) <= (HEIGHT[a.low] ?? 0))
                out.push({ kind: "C", ipa: isFront(a.low) ? "j" : "w", reg: "transp" }); // non-rising → glide
            // rising in height → true hiatus, no insertion
        }
    }
    return out;
}

/** Phonemize a single Madurese word to canonical IPA (register harmony + epenthesis + devoicing + gemination). */
export function phonemizeWord(word: string): string {
    const segs = epenthesize(tokenize(word.toLowerCase()));
    // A vowel's height is set by the register carried to it: a raise-class (voiced/aspirated) stop sets HIGH, a
    // low-class consonant sets LOW. A TRANSPARENT consonant (l r w y) is invisible to the harmony only inside an
    // ONSET CLUSTER — it passes a preceding stop's register through (bra→bɾɤ) — but a liquid AFTER a vowel is a
    // fresh onset and resets to low (bâla→bɤla). We approximate the cluster test as "the previous segment was a
    // consonant" (no syllabifier).
    let prevRaise = false; // word-initial = low
    let prevKind: "start" | "C" | "V" = "start";
    const ipa: string[] = [];
    let lastC = -1;
    for (const s of segs) {
        if (s.kind === "C") {
            if (s.reg === "raise") prevRaise = true;
            else if (s.reg === "low") prevRaise = false;
            else if (prevKind !== "C") prevRaise = false; // transparent liquid after a vowel/start → fresh low onset
            ipa.push(s.ipa);
            lastC = ipa.length - 1;
            prevKind = "C";
        } else {
            ipa.push(prevRaise ? s.high : s.low);
            lastC = -1; // a vowel is last, so no final-consonant devoicing
            prevKind = "V";
        }
    }
    // Word-final devoicing: a final voiced/aspirated stop neutralises to voiceless-unaspirated (length-insensitive,
    // so a final geminate ⟨…bb⟩→[pː] devoices too).
    if (lastC === ipa.length - 1 && lastC >= 0) {
        const seg = ipa[lastC]!;
        const long = seg.endsWith("ː");
        const d = DEVOICE[long ? seg.slice(0, -1) : seg];
        if (d) ipa[lastC] = long ? d + "ː" : d;
    }
    return ipa.join("");
}

// A word (Madurese letters incl. â è é ò ḍ ṭ and the ' glottal) / number / punctuation token.
const TOKEN = /([a-zâèéòḍṭ']+)|(\d+)|([.!?…,;:])/giu;

class MaduresePhonemizer implements Phonemizer {
    text(input: string): string {
        return assembleClauses(input, TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(m[1]));
            else if (m[2])
                for (const wd of numberToWords(Number(m[2])).split(" ")) sink.emit(phonemizeWord(wd));
            else if (m[3]) {
                const mk = CLAUSE_MARK[m[3]];
                if (mk) sink.pause(mk);
            }
        });
    }
}

/** Build the Madurese phonemizer (register-harmony rule g2p; tone/stress not salient). */
export function createMadurese(): Phonemizer {
    return new MaduresePhonemizer();
}
