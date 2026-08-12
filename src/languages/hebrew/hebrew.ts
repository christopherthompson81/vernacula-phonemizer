/**
 * Hebrew (he) phonemizer — Afro-Asiatic (Semitic), the Hebrew abjad, MODERN ISRAELI pronunciation,
 * A niqqud→IPA segmental g2p over VOCALIZED (pointed) Hebrew — the deterministic
 * core. A stateful scan: each consonant carries the trailing points (dagesh, shin/sin dot, a vowel), which it
 * resolves — the bgdkpt dagesh split (ⁿⁿב→b/v, כ→k/χ, פ→p/f), ⟨ש⟩ shin/sin, the ⟨ו⟩ specials (shuruk וּ→u, holam
 * male וֹ→o, else consonant v), quiescent alef / silent final he / mater yod, and patach genuvah (a final guttural's
 * patach surfaces [a] BEFORE the consonant). Stress is phonemic but unwritten → not emitted (folded).
 *
 * PHASE 2 (done, hebrewNeural.ts): unvocalized restoration — a sentence-level neural nakdan that supplies the niqqud
 * for bare consonantal text (the reconstructed words come back through this g2p). Digit tokens route to numbers.ts.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { MANIFEST } from "./manifest.ts";
import { normalizeHebrew } from "./normalize.ts";
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
const GERESH_DIGRAPH = MANIFEST.gereshDigraphs;
/** The GERESH and every character a corpus writes in its place. U+05F3 is the correct one and is ×0 in the
 *  mined corpus; the ASCII apostrophe carries all 183 digraph instances, and U+2019 rides along. */
const GERESH = "'׳’";
const POINT = /[֑-ׇ'׳’]/u; // any Hebrew cantillation/point/mark — plus the geresh, which modifies its letter
// The furtive-patach gutturals, and the proclitic prefixes under which a word-initial sheva is realised [e]
// rather than elided. Both lists — and why the second one is only five letters — are in hebrew.jsonc.
const FINAL_GUTTURAL = new Set(MANIFEST.furtivePatachGutturals);
const PROCLITIC = new Set(MANIFEST.proclitics);

/** One consonant of the (unvocalized) skeleton and the IPA chunk its points resolved to (chunk "" = silent mater). */
export interface HebrewChunk { cons: string; ipa: string }

/**
 * Scan a VOCALIZED (pointed) Hebrew word into per-consonant chunks: each skeleton consonant (the letter that
 * SURVIVES niqqud-stripping) paired with the IPA its points resolved to. `phonemizeWord` joins the ipa parts; the
 * Tagger data-gen (tools/hebrew/build_tagger_data.ts) uses the (cons → ipa) alignment as its training tags.
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
        const geresh = marks.some((m) => GERESH.includes(m));
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
        // ⟨א⟩ with no vowel: a silent mater MID-WORD (רֹאשׁ→ʁoʃ), but a glottal ONSET [ʔ] word-initially (אוֹר→ʔoʁ)
        // — the 3-referee consensus KEEPS the initial glottal. Word-initial → fall through to [ʔ].
        if (c === "א" && !vowel && !sheva && chunks.length > 0) { chunks.push({ cons: c, ipa: "" }); k = j; continue; }
        if (c === "ה" && atEnd && !vowel) { chunks.push({ cons: c, ipa: "" }); k = j; continue; }  // silent final he
        // word-FINAL ⟨ע⟩ with no vowel is dropped (Modern Hebrew; אֶצְבַּע→ʔetsba not ʔetsbaʔ) — consensus drops it
        if (c === "ע" && atEnd && !vowel) { chunks.push({ cons: c, ipa: "" }); k = j; continue; }

        // consonant IPA: bgdkpt dagesh-hard override + ⟨ש⟩ shin/sin split + the GERESH digraph
        let ci = CONS[c]!;
        if (has(DAGESH) && c in HARD) ci = HARD[c]!;
        if (c === "ש") ci = has(SIN) ? "s" : "ʃ";
        // ⟨ג׳⟩ ⟨צ׳⟩ ⟨ץ׳⟩ ⟨ז׳⟩ — the geresh is part of the LETTER, not a mark on it, so it overrides the base
        // value outright. Every other letter's geresh (ת׳ ד׳ ח׳ ר׳, an abbreviation dot, a closing quote) is
        // absent from the table and falls through silently, which is the pre-existing behaviour.
        if (geresh && c in GERESH_DIGRAPH) ci = GERESH_DIGRAPH[c]!;

        // patach genuvah: a word-final guttural ח/ע/ה with patach → [a] BEFORE the consonant (maʃiaχ); ⟨ע⟩ itself
        // then contributes nothing (jodˈea, not jodeaʔ) — the consensus drops final-ayin glottal.
        // ⚠ `chunks.length > 0` — A FURTIVE PATACH NEEDS A VOWEL TO BE FURTIVE TO. The guttural must not be
        // the word's FIRST consonant, or a one-letter word is read backwards: the definite article הַ came
        // out *ah*, which is exactly the word normalize.ts emits 41 times for `ה-19` ("the 19th"). The other
        // proclitics were unaffected because only ח/ע/ה are in this list.
        if (atEnd && chunks.length > 0 && FINAL_GUTTURAL.has(c) && vowel === PATACH) {
            emit("a" + (c === "ע" ? "" : ci), ""); continue;
        }

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

// A Hebrew word (letters U+05D0–05EA + points U+0591–05C7 + maqaf ־ + GERESH) / number (integer or decimal) /
// punctuation token. The number group precedes punctuation so "3.14" is one token while a trailing "." stays a
// clause mark.
// ⚠ THE GERESH IS ADMITTED IN THE INNER GROUP TOO, and that is the half `hebrewNeural.ts` had wrong. Its
// token class allows the apostrophe only after the FIRST letter, so `ג'יימס` survives but `בייג'ינג` — a
// word-MEDIAL digraph — splits at the geresh into two vowel-less fragments. Here the same class was missing
// it entirely: every one of the corpus's 183 geresh digraphs split its word (`ג'יימס` → *ɡ jjms*).
const TOKEN = /([א-ת][֑-ׇ־'׳’]*(?:[א-ת][֑-ׇ'׳’]*)*)|(\d+(?:\.\d+)?)|([.!?…,;:׃])/gu;

/** Per-call OOV resolver: word → IPA, or undefined to fall back to the rule g2p. Used by the async neural path
 *  (hebrewNeural.ts) to inject the neural tagger's reading for UNVOCALIZED words. */
export type HebrewOovResolver = (w: string) => string | undefined;

class HebrewPhonemizer implements Phonemizer {
    text(input: string, oovOverride?: HebrewOovResolver): string {
        // The normalization pass runs BEFORE tokenization — see normalize.ts. Pure text→text: everything it
        // emits is Hebrew (with niqqud) or digits, and reaches the IPA through this same g2p (trap 6).
        return assembleClauses(normalizeHebrew(input), TOKEN, (m, sink) => {
            if (m[1]) sink.emit(oovOverride?.(m[1]) ?? phonemizeWord(m[1]));
            else if (m[2]) sink.emit(numberToIpa(m[2])); // cardinal → IPA (numbers.ts)
            else if (m[3]) {
                const mk = CLAUSE_MARK[m[3]];
                if (mk) sink.pause(mk);
            }
        });
    }
}

/** Build the Hebrew phonemizer (the niqqud→IPA rule g2p; the returned `text` takes an optional per-call
 *  `oovOverride` for the neural restoration of unvocalized words). */
export function createHebrew(): { text(input: string, oovOverride?: HebrewOovResolver): string } {
    return new HebrewPhonemizer();
}
