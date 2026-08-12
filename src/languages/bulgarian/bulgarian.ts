/**
 * Native Bulgarian / български (bg) text phonemizer — canonical IPA. South Slavic, Cyrillic.
 * Bulgarian is highly phonemic, so a left-to-right grapheme scan + a small set of well-defined post-rules recovers
 * the pronunciation: PALATALISATION (only before ь я ю — not и/е, unlike Russian), DARK-L (л→[l] before a front
 * vowel, [lʲ] before ь/я/ю, [ɫ] elsewhere), the velar nasal (н→ŋ before к/ɡ), FINAL DEVOICING, REGRESSIVE VOICING
 * assimilation (with /v/ voicing-transparent as [v]), SIBILANT assimilation (с/з→ʃ before ʃ/t͡ʃ), and cluster
 * simplification (стк→ск, stop-geminate collapse). STRESS is unwritten (lexical) and Bulgarian vowel reduction is
 * stress-conditioned, so we emit the FULL phonemic vowels and the reduction is folded in the referee eval.
 * Validated against two independent human referees.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { normalizeBulgarian } from "./normalize.ts";
import { loadManifest } from "../../core/loadManifest.ts";
import { IPA_VOWEL } from "../../core/ipa.ts";

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
    billion: string;
    billions: string;
    masculine: Record<string, string>;
    and: string;
}
interface BulgarianDef {
    letters: Record<string, string>;
    palatalizingLetters: readonly string[];
    frontVowelLetters: readonly string[];
    clausePunctuation: Record<string, string>;
    numbers: NumbersDef;
}
const DEF = loadManifest<BulgarianDef>(import.meta.url, "bulgarian.jsonc");
const L = DEF.letters;
const CLAUSE_MARK = DEF.clausePunctuation;
const NUM = DEF.numbers;

const VOWELS = IPA_VOWEL;
// The ⟨л⟩ environments (bulgarian.jsonc): [lʲ] before a palatalizer, [l] before a front vowel, else [ɫ].
const FRONT = new Set(DEF.frontVowelLetters);
const PAL = new Set(DEF.palatalizingLetters);
// Voiced obstruent → voiceless (final devoicing + regressive assimilation before a voiceless obstruent).
const DEVOICE: Record<string, string> = { b: "p", v: "f", ɡ: "k", d: "t", ʒ: "ʃ", z: "s", "d͡ʒ": "t͡ʃ", "d͡z": "t͡s" };
const VOICE: Record<string, string> = Object.fromEntries(Object.entries(DEVOICE).map(([k, v]) => [v, k]));
const VOICELESS = new Set([...Object.values(DEVOICE), "x", "ʃt"]);

const base = (t: string): string => t.replace("ʲ", "");
const isCons = (t: string): boolean => t !== "" && !VOWELS.has(base(t)[0]!);

/** Phonemize a single Bulgarian word to canonical IPA (full phonemic vowels; stress/reduction not emitted). */
export function phonemizeWord(word: string): string {
    const w = word.toLowerCase().replace(/['́̀]/gu, "");
    const chars = [...w];
    const toks: string[] = [];
    for (let i = 0; i < chars.length; i++) {
        const c = chars[i]!;
        const nxt = chars[i + 1] ?? "";
        if (c === "л") {
            toks.push(PAL.has(nxt) ? "lʲ" : FRONT.has(nxt) ? "l" : "ɫ");
        } else if (c === "я" || c === "ю") {
            const v = c === "я" ? "a" : "u";
            const last = toks[toks.length - 1];
            if (last !== undefined && isCons(last) && last !== "j") {
                if (!last.endsWith("ʲ")) toks[toks.length - 1] = last + "ʲ";
                toks.push(v);
            } else {
                toks.push("j", v);
            }
        } else if (c === "ь") {
            const last = toks[toks.length - 1];
            if (last !== undefined && isCons(last) && !last.endsWith("ʲ")) toks[toks.length - 1] = last + "ʲ";
        } else {
            const ph = L[c];
            if (ph !== undefined) toks.push(ph);
        }
    }
    return applyPhonotactics(toks);
}

/** The ordered consonant post-rules (each keyed on the token's base, preserving any ʲ). */
function applyPhonotactics(toks: string[]): string {
    const suf = (t: string): string => (t.endsWith("ʲ") ? "ʲ" : "");
    // н → ŋ before a velar stop к/ɡ (not before the fricative х).
    for (let k = 0; k < toks.length - 1; k++)
        if (base(toks[k]!) === "n" && ["k", "ɡ"].includes(base(toks[k + 1]!))) toks[k] = "ŋ" + suf(toks[k]!);
    // Word-final devoicing.
    const last = toks.length - 1;
    if (last >= 0 && base(toks[last]!) in DEVOICE) toks[last] = DEVOICE[base(toks[last]!)]! + suf(toks[last]!);
    // Regressive voicing assimilation (right-to-left). /v/ is voicing-transparent AS [v] (it does not trigger),
    // but once /v/ itself devoices to [f] before a voiceless obstruent, that [f] does trigger the preceding one.
    for (let k = toks.length - 2; k >= 0; k--) {
        const b = base(toks[k]!), nb = base(toks[k + 1]!);
        if (nb === "v") continue;
        if (b in DEVOICE && VOICELESS.has(nb)) toks[k] = DEVOICE[b]! + suf(toks[k]!);
        else if (b in VOICE && nb in DEVOICE) toks[k] = VOICE[b]! + suf(toks[k]!);
    }
    // т-elision in the -стк- cluster (s·t·k → s·k): аболиционистка → …iska.
    let out: string[] = [];
    for (let k = 0; k < toks.length; k++) {
        if (toks[k] === "t" && k > 0 && base(toks[k - 1]!) === "s" && k + 1 < toks.length && base(toks[k + 1]!) === "k") continue;
        out.push(toks[k]!);
    }
    toks = out;
    // Stop-geminate collapse (тт/дд/кк/пп/бб/гг → single); fricative/sonorant geminates (ss, nn) are KEPT (без+силен→bɛssilɛn).
    out = [];
    for (const t of toks) {
        if (out.length && out[out.length - 1] === t && ["t", "d", "k", "p", "b", "ɡ"].includes(base(t))) continue;
        out.push(t);
    }
    toks = out;
    // Sibilant assimilation: с/з → ʃ before a postalveolar ʃ or t͡ʃ (сч→ʃt͡ʃ, сш→ʃʃ).
    for (let k = 0; k < toks.length - 1; k++)
        if (["s", "z"].includes(base(toks[k]!)) && ["ʃ", "t͡ʃ"].includes(base(toks[k + 1]!))) toks[k] = "ʃ";
    return toks.join("");
}

// ── Numbers (decimal; Bulgarian) ──────────────────────────────────────────────
/** Build the Bulgarian words for n; "и" precedes the final component (сто двайсет и три; сто и три). */
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
        const thWord = th === 1 ? NUM.thousand : `${numberToText(th)} ${NUM.thousands}`;
        if (!r) return thWord;
        return `${thWord} ${r < 100 || r % 100 === 0 ? NUM.and + " " : ""}${numberToText(r)}`;
    }
    // ⚠ милион / милиард (10⁶ / 10⁹) ARE MASCULINE, so unlike the feminine хиляда they take a masculine
    // multiplier and the COUNT plural -а above one (един милион, два милиона, пет милиарда).
    // ⚠ Without a composer for them, 10⁶+ falls through to the digit string and the Cyrillic g2p emits EMPTY IPA.
    for (const [value, sg, pl] of [
        [1_000_000_000, NUM.billion, NUM.billions], [1_000_000, NUM.million, NUM.millions],
    ] as const) {
        if (n >= value) {
            const q = Math.floor(n / value), r = n % value;
            // The count plural is used for every multiplier except one ending in 1 (…и един милион).
            const qWord = masculineText(q);
            const mWord = `${qWord} ${q % 10 === 1 ? sg : pl}`;
            if (!r) return mWord;
            return `${mWord} ${r < 100 || r % 100 === 0 ? NUM.and + " " : ""}${numberToText(r)}`;
        }
    }
    return String(n);
}
/** Like `numberToText` but with the MASCULINE 1/2 (един/два, not едно/две) that милион/милиард require. */
function masculineText(n: number): string {
    const m = NUM.masculine[String(n % 10)];
    if (m === undefined || (n > 10 && n < 20)) return numberToText(n); // teens have no masculine alternation
    if (n < 10) return m;
    return numberToText(n).replace(/\S+$/u, m); // …двайсет и ЕДИН, сто и ДВА
}
function number(digits: string): string {
    const n = Number(digits);
    // ⚠ ABOVE 2^53 THE RAW ASCII DIGITS USED TO LEAK STRAIGHT INTO THE IPA. `isSafeInteger` is right to
    // refuse to COMPOSE — the float has already lost the low digits, so the numeral would be confidently
    // wrong — but the refusal returned the digit string, which no g2p in this fleet reads. Read it out
    // digit-at-a-time instead, THROUGH THE SAME COMPOSER: a one-digit number is a call this engine already
    // answers, so the fallback cannot invent a word. See core/numbers.ts `spellDigits` for the full
    // account and the cost — above 2^53 the reading is a digit string, not a quantity.
    const words = Number.isSafeInteger(n)
        ? numberToText(n)
        : [...digits].map((d) => numberToText(Number(d))).join(" ");
    return words.split(" ").filter(Boolean).map(phonemizeWord).join(" ");
}

// A word (Bulgarian Cyrillic) / number / punctuation token.
const TOKEN = /([а-яёА-ЯЁ']+)|(\d+)|([.!?…,;:—])/gu;

class BulgarianPhonemizer implements Phonemizer {
    text(rawInput: string): string {
        // everything the g2p cannot read is rewritten to Bulgarian words FIRST — see normalize.ts,
        // in particular the `N г.` year abbreviation (265 instances, the largest defect) and why there is
        // no ordinal-dot rule here despite it being the largest rule in the Germanic languages.
        return assembleClauses(normalizeBulgarian(rawInput), TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(m[1]));
            else if (m[2]) sink.emit(number(m[2]));
            else if (m[3]) {
                const mk = CLAUSE_MARK[m[3]];
                if (mk) sink.pause(mk);
            }
        });
    }
}

/** Build the Bulgarian phonemizer (phonemic g2p + phonotactics; stress/reduction not emitted, numbers composed). */
export function createBulgarian(): Phonemizer {
    return new BulgarianPhonemizer();
}
