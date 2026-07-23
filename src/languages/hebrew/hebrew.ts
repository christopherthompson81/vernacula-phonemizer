/**
 * Hebrew (he) phonemizer — Afro-Asiatic (Semitic), the Hebrew abjad, MODERN ISRAELI pronunciation,
 * espeak-independent. PHASE 1: a niqqud→IPA segmental g2p over VOCALIZED (pointed) Hebrew — the deterministic
 * core. A stateful scan: each consonant carries the trailing points (dagesh, shin/sin dot, a vowel), which it
 * resolves — the bgdkpt dagesh split (ⁿⁿב→b/v, כ→k/χ, פ→p/f), ⟨ש⟩ shin/sin, the ⟨ו⟩ specials (shuruk וּ→u, holam
 * male וֹ→o, else consonant v), quiescent alef / silent final he / mater yod, and patach genuvah (a final guttural's
 * patach surfaces [a] BEFORE the consonant). Stress is phonemic but unwritten → not emitted (folded).
 *
 * PHASE 2 (done, hebrewNeural.ts): unvocalized restoration — a sentence-level neural nakdan that supplies the niqqud
 * for bare consonantal text (the reconstructed words come back through this g2p). Digit tokens route to numbers.ts.
 * See docs/investigations/he_native_bringup_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { MANIFEST } from "./manifest.ts";
import { numberToIpa } from "./numbers.ts";

const CONS = MANIFEST.consonants;
const HARD = MANIFEST.dageshHard;
const VOW = MANIFEST.vowels;
const CLAUSE_MARK = MANIFEST.clausePunctuation;

const DAGESH = "ּ"; // dagesh / mappiq / shuruk-dot
const SHIN = "ׁ";
const SIN = "ׂ";
const SHEVA = "ְ";
const HOLAM = "ֹ";
const PATACH = "ַ";
const POINT = /[֑-ׇ]/u; // any Hebrew cantillation/point/mark
const FINAL_GUTTURAL = new Set(["ח", "ע", "ה"]);
// Word-initial sheva under a one-letter PROCLITIC prefix (וְ/לְ/בְּ/כְּ/מְ) is sheva-na → realised [e] in spoken
// Modern Hebrew (veʁaʔa, leʔeveʁ, bejisʁaʔel) — two independent audio-grounded referees (Phonikud, ReNikud) agree.
// Restricted to these prefixes so word-initial STEM clusters stay elided (שְׁלוֹשִׁים→ʃloʃim, תְּשַׁע→tʃaʔ). Other
// sheva → ∅ (Modern Hebrew elides sheva-na pervasively; a full na/nach rule needs morphology). See Run 8.
const PROCLITIC = new Set(["ו", "ל", "ב", "כ", "מ"]);

/** One consonant of the (unvocalized) skeleton and the IPA chunk its points resolved to (chunk "" = silent mater). */
export interface HebrewChunk { cons: string; ipa: string }

/**
 * Scan a VOCALIZED (pointed) Hebrew word into per-consonant chunks: each skeleton consonant (the letter that
 * SURVIVES niqqud-stripping) paired with the IPA its points resolved to. `phonemizeWord` joins the ipa parts; the
 * Phase-2 tagger data-gen (tools/hebrew/build_tagger_data.ts) uses the (cons → ipa) alignment as its training tags.
 */
export function phonemizeAligned(word: string): HebrewChunk[] {
    const cps = [...word.normalize("NFC")];
    const chunks: HebrewChunk[] = [];
    let k = 0;
    let prevVowel = ""; // last vowel emitted — decides whether a bare ⟨י⟩ is a silent mater or a [j] glide
    while (k < cps.length) {
        const c = cps[k]!;
        if (!(c in CONS)) { k += 1; continue; } // stray mark / maqaf / punctuation
        // gather this consonant's trailing points up to the next consonant
        let j = k + 1;
        const marks: string[] = [];
        while (j < cps.length && POINT.test(cps[j]!)) { marks.push(cps[j]!); j += 1; }
        const has = (m: string): boolean => marks.includes(m);
        const vowel = marks.find((m) => m in VOW);
        const atEnd = j >= cps.length;
        const sheva = has(SHEVA);
        const emit = (ipa: string, v: string): void => { chunks.push({ cons: c, ipa }); prevVowel = v; k = j; };

        // ⟨ו⟩ vav: shuruk (וּ) = [u], holam male (וֹ) = [o], else consonant [v] (+ its vowel, or [e] for proclitic וְ)
        if (c === "ו") {
            if (has(DAGESH) && !vowel) { emit("u", "u"); continue; }
            if (has(HOLAM)) { emit("o", "o"); continue; }
            const vv = vowel ? VOW[vowel]! : (chunks.length === 0 && sheva ? "e" : ""); // word-initial וְ → [ve]
            emit("v" + vv, vv); continue;
        }
        // ⟨י⟩ with no vowel/dagesh is a SILENT mater ONLY as a hiriq/tsere male (preceded by [i]/[e] — the vowel is
        // already out: בִּיב→biv); ELSEWHERE a consonant/glide [j] — onset (יוּם→jum) or offglide after [a o u] (avoj).
        if (c === "י" && !vowel && !sheva && !has(DAGESH)) {
            if (prevVowel === "i" || prevVowel === "e") { chunks.push({ cons: c, ipa: "" }); k = j; continue; } // silent mater
            emit("j", ""); continue;
        }
        if (c === "א" && !vowel && !sheva) { chunks.push({ cons: c, ipa: "" }); k = j; continue; } // quiescent alef
        if (c === "ה" && atEnd && !vowel) { chunks.push({ cons: c, ipa: "" }); k = j; continue; }  // silent final he

        // consonant IPA: bgdkpt dagesh-hard override + ⟨ש⟩ shin/sin split
        let ci = CONS[c]!;
        if (has(DAGESH) && c in HARD) ci = HARD[c]!;
        if (c === "ש") ci = has(SIN) ? "s" : "ʃ";

        // patach genuvah: a word-final guttural ח/ע/ה with patach → [a] BEFORE the consonant (maʃiaχ)
        if (atEnd && FINAL_GUTTURAL.has(c) && vowel === PATACH) { emit("a" + ci, ""); continue; }

        // Vowel: the niqqud, else [e] for a word-initial PROCLITIC sheva-na (realised), else ∅ (sheva elided).
        const v = vowel ? VOW[vowel]! : (chunks.length === 0 && sheva && PROCLITIC.has(c) ? "e" : "");
        emit(ci + v, v);
    }
    return chunks;
}

/** Phonemize one vocalized (pointed) Hebrew word to Modern Israeli IPA (segmental; stress not emitted). */
export function phonemizeWord(word: string): string {
    return phonemizeAligned(word).map((c) => c.ipa).join("");
}

// A Hebrew word (letters U+05D0–05EA + points U+0591–05C7 + maqaf ־) / number (integer or decimal) / punctuation
// token. The number group precedes punctuation so "3.14" is one token while a trailing "." stays a clause mark.
const TOKEN = /([א-ת][֑-ׇ־־]*(?:[א-ת][֑-ׇ]*)*)|(\d+(?:\.\d+)?)|([.!?…,;:׃])/gu;

/** Per-call OOV resolver: word → IPA, or undefined to fall back to the Phase-1 g2p. Used by the async neural path
 *  (hebrewNeural.ts) to inject the Phase-2 tagger's reading for UNVOCALIZED words. */
export type HebrewOovResolver = (w: string) => string | undefined;

class HebrewPhonemizer implements Phonemizer {
    text(input: string, oovOverride?: HebrewOovResolver): string {
        return assembleClauses(input, TOKEN, (m, sink) => {
            if (m[1]) sink.emit(oovOverride?.(m[1]) ?? phonemizeWord(m[1]));
            else if (m[2]) sink.emit(numberToIpa(m[2])); // cardinal → IPA (numbers.ts)
            else if (m[3]) {
                const mk = CLAUSE_MARK[m[3]];
                if (mk) sink.pause(mk);
            }
        });
    }
}

/** Build the Hebrew phonemizer (Phase-1 niqqud→IPA g2p; the returned `text` takes an optional per-call
 *  `oovOverride` for the Phase-2 neural restoration of unvocalized words). */
export function createHebrew(): { text(input: string, oovOverride?: HebrewOovResolver): string } {
    return new HebrewPhonemizer();
}
