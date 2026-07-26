/**
 * Native Macedonian / македонски (mk) text phonemizer — canonical IPA, espeak-independent. South Slavic, Cyrillic.
 * Macedonian is fully phonemic with NO vowel reduction, so a left-to-right grapheme scan + the shared South-Slavic
 * phonotactics recovers the pronunciation. Macedonian specifics vs Bulgarian: the palatals are DISTINCT LETTERS
 * (ѓ ќ љ њ ѕ џ ј → ɟ c ʎ ɲ d͡z d͡ʒ j — no ь/я/ю palatalization), and STRESS is FIXED on the ANTEPENULT syllable
 * (predictable → emitted). Rules: dark-l (⟨л⟩→[l] before е/и/ј, [ɫ] else), syllabic ⟨р⟩→[r̩], n→ŋ before a velar,
 * word-final devoicing, regressive voicing assimilation. See docs/investigations/mk_native_bringup_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { loadManifest } from "../../core/loadManifest.ts";

interface NumbersDef {
    units: string[];
    ten: string;
    teens: string[];
    tens: Record<string, string>;
    hundreds: Record<string, string>;
    thousand: string;
    thousands: string;
    million: string;
    millions: string;
    and: string;
}
interface MacedonianDef {
    letters: Record<string, string>;
    clausePunctuation: Record<string, string>;
    numbers: NumbersDef;
}
const DEF = loadManifest<MacedonianDef>(import.meta.url, "macedonian.jsonc");
const L = DEF.letters;
const CLAUSE_MARK = DEF.clausePunctuation;
const NUM = DEF.numbers;

const VOWELS = new Set([..."aɛiɔu"]);
const FRONT_L = new Set(["е", "и", "ј"]); // ⟨л⟩ is light [l] before these, dark [ɫ] elsewhere
// Voiced obstruent → voiceless (final devoicing + regressive assimilation before a voiceless obstruent).
const DEVOICE: Record<string, string> = { b: "p", v: "f", ɡ: "k", d: "t", ʒ: "ʃ", z: "s", "d͡ʒ": "t͡ʃ", "d͡z": "t͡s", ɟ: "c" };
const VOICE: Record<string, string> = Object.fromEntries(Object.entries(DEVOICE).map(([k, v]) => [v, k]));
const VOICELESS = new Set([...Object.values(DEVOICE), "x"]); // the voiceless obstruents (DEVOICE values) + ⟨х⟩

const isVowel = (t: string): boolean => t !== "" && VOWELS.has(t);
const isNucleus = (t: string): boolean => isVowel(t) || t === "r̩"; // the syllabic р counts as a nucleus for stress

/** Scan a lowercased Macedonian word into IPA phoneme tokens (dark-l in code, every other letter from the table). */
function scan(word: string): string[] {
    const chars = [...word.toLowerCase()];
    const toks: string[] = [];
    for (let i = 0; i < chars.length; i++) {
        const c = chars[i]!;
        if (c === "л") {
            toks.push(FRONT_L.has(chars[i + 1] ?? "") ? "l" : "ɫ");
        } else {
            const ph = L[c];
            if (ph !== undefined) toks.push(ph);
        }
    }
    return toks;
}

/** Syllabic ⟨р⟩: an [r] with no vowel-token neighbour becomes [r̩] (прст→pr̩st, Грк→ɡr̩k). */
function syllabicR(toks: string[]): void {
    for (let k = 0; k < toks.length; k++) {
        if (toks[k] !== "r") continue;
        const left = k > 0 && isVowel(toks[k - 1]!);
        const right = k + 1 < toks.length && isVowel(toks[k + 1]!);
        if (!left && !right) toks[k] = "r̩";
    }
}

/** The shared South-Slavic consonant post-rules: n→ŋ before a velar, word-final devoicing, regressive voicing. */
function applyPhonotactics(toks: string[]): void {
    // н → ŋ before a velar stop к/ɡ.
    for (let k = 0; k < toks.length - 1; k++)
        if (toks[k] === "n" && (toks[k + 1] === "k" || toks[k + 1] === "ɡ")) toks[k] = "ŋ";
    // Word-final devoicing (град→ɡrat, нож→nɔʃ, ѕид→d͡zit).
    const last = toks.length - 1;
    if (last >= 0 && toks[last]! in DEVOICE) toks[last] = DEVOICE[toks[last]!]!;
    // Regressive voicing assimilation (right-to-left). /v/ is voicing-transparent as [v] (does not trigger), but once
    // it devoices to [f] before a voiceless obstruent that [f] triggers the preceding one.
    for (let k = toks.length - 2; k >= 0; k--) {
        const b = toks[k]!, nb = toks[k + 1]!;
        if (nb === "v") continue;
        if (b in DEVOICE && VOICELESS.has(nb)) toks[k] = DEVOICE[b]!;
        else if (b in VOICE && nb in DEVOICE) toks[k] = VOICE[b]!;
    }
    // Sibilant assimilation: с/з → ʃ before a postalveolar ʃ/t͡ʃ.
    for (let k = 0; k < toks.length - 1; k++)
        if ((toks[k] === "s" || toks[k] === "z") && (toks[k + 1] === "ʃ" || toks[k + 1] === "t͡ʃ")) toks[k] = "ʃ";
}

/** Assemble the tokens with the fixed ANTEPENULT stress: ˈ before the 3rd-from-last nucleus (penult in disyllables,
 *  the sole nucleus in monosyllables). */
function withStress(toks: string[]): string {
    const nuclei = toks.map((t, i) => (isNucleus(t) ? i : -1)).filter((i) => i >= 0);
    if (nuclei.length === 0) return toks.join("");
    const stressIdx = nuclei[Math.max(0, nuclei.length - 3)]!;
    let out = "";
    for (let i = 0; i < toks.length; i++) {
        if (i === stressIdx) out += "ˈ";
        out += toks[i]!;
    }
    return out;
}

/** Phonemize a single Macedonian word to canonical IPA with antepenultimate stress. */
export function phonemizeWord(word: string): string {
    const toks = scan(word);
    syllabicR(toks);
    applyPhonotactics(toks);
    return withStress(toks);
}

// ── Numbers (decimal; Macedonian) ─────────────────────────────────────────────
/** Build the Macedonian words for n; "и" precedes the final component (дваесет и еден; сто и еден). */
function numberToText(n: number): string {
    if (n < 0) return "";
    if (n < 10) return NUM.units[n]!;
    if (n === 10) return NUM.ten;
    if (n < 20) return NUM.teens[n - 11]!;
    if (n < 100) {
        const t = NUM.tens[String(Math.floor(n / 10) * 10)]!, u = n % 10;
        return u ? `${t} ${NUM.and} ${NUM.units[u]}` : t;
    }
    if (n < 1000) {
        const h = NUM.hundreds[String(Math.floor(n / 100))]!, r = n % 100;
        if (!r) return h;
        return `${h} ${r < 20 || r % 10 === 0 ? NUM.and + " " : ""}${numberToText(r)}`;
    }
    if (n < 1_000_000) {
        const th = Math.floor(n / 1000), r = n % 1000;
        // The multiplier of the FEMININE илјада takes feminine "две" for 2 (две илјади, not два).
        const thCount = numberToText(th).split(" ").map((x) => (x === NUM.units[2] ? "две" : x)).join(" ");
        const thWord = th === 1 ? NUM.thousand : `${thCount} ${NUM.thousands}`;
        if (!r) return thWord;
        return `${thWord} ${r < 100 || r % 100 === 0 ? NUM.and + " " : ""}${numberToText(r)}`;
    }
    if (n < 1_000_000_000) {
        const mil = Math.floor(n / 1_000_000), r = n % 1_000_000;
        const milWord = mil === 1 ? NUM.million : `${numberToText(mil)} ${NUM.millions}`; // милион is masculine
        return r ? `${milWord} ${numberToText(r)}` : milWord;
    }
    // ≥ 10⁹: read the digits as words (never empty).
    return [...String(n)].map((d) => NUM.units[Number(d)]!).join(" ");
}
function number(digits: string): string {
    const n = Number(digits);
    if (!Number.isSafeInteger(n)) return digits;
    return numberToText(n).split(" ").filter(Boolean).map(phonemizeWord).join(" ");
}

// A word (Macedonian Cyrillic) / number / punctuation token.
const TOKEN = /([а-шА-ШѓѕјљњќџЃЅЈЉЊЌЏѐѝЀЍ]+)|(\d+)|([.!?…,;:—])/gu;

class MacedonianPhonemizer implements Phonemizer {
    text(input: string): string {
        return assembleClauses(input, TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(m[1]));
            else if (m[2]) sink.emit(number(m[2]));
            else if (m[3]) {
                const mk = CLAUSE_MARK[m[3]];
                if (mk) sink.pause(mk);
            }
        });
    }
}

/** Build the Macedonian phonemizer (phonemic g2p + antepenultimate stress + composed numbers). */
export function createMacedonian(): Phonemizer {
    return new MacedonianPhonemizer();
}
