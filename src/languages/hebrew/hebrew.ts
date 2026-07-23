/**
 * Hebrew (he) phonemizer — Afro-Asiatic (Semitic), the Hebrew abjad, MODERN ISRAELI pronunciation,
 * espeak-independent. PHASE 1: a niqqud→IPA segmental g2p over VOCALIZED (pointed) Hebrew — the deterministic
 * core. A stateful scan: each consonant carries the trailing points (dagesh, shin/sin dot, a vowel), which it
 * resolves — the bgdkpt dagesh split (ⁿⁿב→b/v, כ→k/χ, פ→p/f), ⟨ש⟩ shin/sin, the ⟨ו⟩ specials (shuruk וּ→u, holam
 * male וֹ→o, else consonant v), quiescent alef / silent final he / mater yod, and patach genuvah (a final guttural's
 * patach surfaces [a] BEFORE the consonant). Stress is phonemic but unwritten → not emitted (folded).
 *
 * PHASE 2 (deferred): unvocalized restoration — a neural nakdan that supplies the niqqud for bare consonantal text
 * (the Arabic-diacritizer analogue). See docs/investigations/he_native_bringup_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { MANIFEST } from "./manifest.ts";

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

/** Phonemize one vocalized (pointed) Hebrew word to Modern Israeli IPA (segmental; stress not emitted). */
export function phonemizeWord(word: string): string {
    const cps = [...word.normalize("NFC")];
    let out = "";
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
        const step = (v: string): void => { prevVowel = v; k = j; };

        // ⟨ו⟩ vav: shuruk (וּ) = [u], holam male (וֹ) = [o], else consonant [v] (+ its vowel)
        if (c === "ו") {
            if (has(DAGESH) && !vowel) { out += "u"; step("u"); continue; }
            if (has(HOLAM)) { out += "o"; step("o"); continue; }
            out += "v"; const vv = vowel ? VOW[vowel]! : ""; out += vv; step(vv); continue;
        }
        // ⟨י⟩ with no vowel/dagesh is a SILENT mater ONLY as a hiriq/tsere male (preceded by [i]/[e] — the vowel is
        // already out: בִּיב→biv); ELSEWHERE it is a consonant/glide [j] — an onset (יוּם→jum, ־יָה→ja) or a
        // diphthong offglide after [a o u] (אֲבוֹי→avoj, אֲדוֹנָי→adonaj).
        if (c === "י" && !vowel && !sheva && !has(DAGESH)) {
            if (prevVowel === "i" || prevVowel === "e") { k = j; continue; } // silent mater (keep prevVowel)
            out += "j"; step(""); continue;
        }
        if (c === "א" && !vowel && !sheva) { k = j; continue; } // quiescent alef (keep prevVowel)
        if (c === "ה" && atEnd && !vowel) { k = j; continue; }  // silent final he (mater/mappiq)

        // consonant IPA: bgdkpt dagesh-hard override + ⟨ש⟩ shin/sin split
        let ci = CONS[c]!;
        if (has(DAGESH) && c in HARD) ci = HARD[c]!;
        if (c === "ש") ci = has(SIN) ? "s" : "ʃ";

        // patach genuvah: a word-final guttural ח/ע/ה with patach → [a] BEFORE the consonant (maʃiaχ)
        if (atEnd && FINAL_GUTTURAL.has(c) && vowel === PATACH) { out += "a" + ci; step(""); continue; }

        out += ci;
        // SHEVA → ∅: Modern Hebrew elides sheva-na pervasively (clusters/loanwords: astʁo, anɡli), and where it IS
        // realised the referee mostly marks it optional (e) → dropped by the paren-fold; a reliable na/nach rule
        // needs morphology (native prefix vs loanword cluster), deferred to Phase 2.
        if (vowel) { out += VOW[vowel]!; step(VOW[vowel]!); } else step("");
    }
    return out;
}

// A Hebrew word (letters U+05D0–05EA + points U+0591–05C7 + maqaf ־) / number / punctuation token.
const TOKEN = /([א-ת][֑-ׇ־־]*(?:[א-ת][֑-ׇ]*)*)|(\d+)|([.!?…,;:׃])/gu;

class HebrewPhonemizer implements Phonemizer {
    text(input: string): string {
        return assembleClauses(input, TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(m[1]));
            else if (m[2]) sink.emit(m[2]); // numbers deferred (digits passed through)
            else if (m[3]) {
                const mk = CLAUSE_MARK[m[3]];
                if (mk) sink.pause(mk);
            }
        });
    }
}

/** Build the Hebrew phonemizer (Phase-1 niqqud→IPA g2p; unvocalized restoration + numbers deferred). */
export function createHebrew(): Phonemizer {
    return new HebrewPhonemizer();
}
