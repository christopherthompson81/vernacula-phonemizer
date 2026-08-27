/**
 * Native Akan / Akan kasa (ak) text phonemizer — canonical IPA.
 *
 * Akan is a Kwa (Niger-Congo) language of Ghana (~20M incl. L2). It has a shallow, well-standardised Latin
 * orthography (Bureau of Ghana Languages; the Asante/Akuapem Twi and Fante varieties share it), so a near
 * one-to-one rule g2p. The letter maps live in akan.jsonc; the contextual bits are here:
 *
 *   • CONSONANT DIGRAPHS (longest-match) — a palatal series ⟨ky gy hy ny⟩ → t͡ɕ d͡ʑ ɕ ɲ and a LABIALISED series
 *     ⟨tw dw kw gw hw nw⟩ → t͡ɕʷ d͡ʑʷ kʷ ɡʷ ɕʷ ŋʷ (the signature Akan labial-palatalisation), plus ⟨ng⟩ → ŋ.
 *   • GLIDE FORMATION (Paster 2010) — a round vowel ⟨o ɔ u⟩ before another vowel becomes the on-glide [w]
 *     (boa→bwa, uafɔn→wafɔ̃); front vowels stay in hiatus.
 *   • NASAL rules (Paster 2010) — coda-⟨n⟩ Place Assimilation (velar → ŋ, labial → m, else n; nkran→ŋkran) and
 *     Labial Nasalization (/b/ → [m] after a nasal: mba→mma).
 *   • ATR HARMONY (Paster 2010) — the orthography merges [e]/[ɪ] into ⟨e⟩ and [o]/[ʊ] into ⟨o⟩; atrByIndex()
 *     recovers the value from the word's harmony (triggers ⟨i u⟩ = +ATR, ⟨ɛ ɔ⟩ = −ATR, spreading to ⟨e o⟩:
 *     kyerɛ→t͡ɕɪrɛ, bisa→bisa).
 *   • TONE (H/L) + vowel nasality — LEXICAL (Akan tone is unpredictable from the toneless orthography, per Paster).
 *     The Romanian-stress pattern: a mined lexicon (akan-tone.tsv) carries the citation tone/nasality, emitted as
 *     Chao letters (H→˥, L→˩) + ◌̃ on the SHIPPED phonemizeWord (papa→pa˩pa˥, mifi→mĩ˩fi˥). phonemizeWordRules is
 *     the tone-free segmental path (the non-circular referee signal). Coverage is small — no large toned corpus
 *     exists — so OOV words carry no tone; the SYSTEM is implemented and extensible with more lexicon.
 *   • NUMBERS — standard Twi cardinals (baako, du, aduonu, ɔha, apem), compositional.
 *
 * ⚠ SINGLE-SOURCE: the only referee is a small kaikki human-gold set — there is no wikipron or epitran Akan —
 * so nothing here is cross-checked against an independent transcription.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { latinPhone } from "../../core/latinPhones.ts";
import { LATIN_RUN, makeNativiser } from "../../core/hostWord.ts";
import { loadManifest } from "../../core/loadManifest.ts";
import { loadTsvMap } from "../../core/loadTsv.ts";
import { IPA_VOWEL } from "../../core/ipa.ts";
import { normalizeAkan } from "./normalize.ts";

// Tone + vowel-nasality lexicon (word → comma-joined per-nucleus tokens: H/L, +~ if nasal). Akan tone is lexical
// (unpredictable from the toneless orthography), so — the Romanian-stress pattern — a lexicon carries it and the
// tonal rules apply on top; mined from the tone-marked kaikki readings + Paster (2010). Small coverage (OOV = no
// tone); consumed by the SHIPPED phonemizeWord only (phonemizeWordRules stays tone-free / non-circular).
const TONE_LEX: ReadonlyMap<string, string> = loadTsvMap(import.meta.url, "akan-tone.tsv", undefined, { optional: true });
const NUCLEI = IPA_VOWEL;

interface AkanDef {
    digraphs: Record<string, string>;
    consonants: Record<string, string>;
    vowels: Record<string, string>;
    clausePunctuation: Record<string, string>;
    numbers: {
        zero: string; units: string[]; ten: string; tens: string[];
        hundreds: string[]; thousand: string; thousands: string;
        million: string; millions: string; billion: string; billions: string;
    };
}

const DEF = loadManifest<AkanDef>(import.meta.url, "akan.jsonc");
const TILDE = "̃"; // combining nasalisation
const isVowel = (c: string | undefined): boolean => c !== undefined && c in DEF.vowels;

/**
 * ATR HARMONY (Paster 2010 rule 4/5, Dolphyne 1988): the orthography merges the [+ATR]/[-ATR] mid pairs — ⟨e⟩ is
 * [e] or [ɪ], ⟨o⟩ is [o] or [ʊ] — and the value is fixed by the word's harmony. Compute, per orthographic vowel,
 * a +ATR/−ATR value: the unambiguous triggers are ⟨i u⟩ (+ATR) and ⟨ɛ ɔ⟩ (−ATR); ⟨a⟩ is harmony-neutral and ⟨e o⟩
 * are the ambiguous targets. An ambiguous vowel takes the ATR of its nearest trigger (spreading), defaulting to
 * +ATR when the word has no trigger. Returns a map from char-index → true(+ATR)/false(−ATR).
 */
function atrByIndex(s: string[]): Map<number, boolean> {
    const idx: number[] = [];
    const val: (boolean | null)[] = [];
    for (let k = 0; k < s.length; k++) {
        const c = s[k]!;
        if (!(c in DEF.vowels)) continue;
        idx.push(k);
        val.push(c === "i" || c === "u" ? true : c === "ɛ" || c === "ɔ" ? false : null);
    }
    // spread the nearest known value forwards then backwards; default +ATR
    let last: boolean | null = null;
    for (let k = 0; k < val.length; k++) { if (val[k] !== null) last = val[k]!; else if (last !== null) val[k] = last; }
    last = null;
    for (let k = val.length - 1; k >= 0; k--) { if (val[k] !== null) last = val[k]!; else if (last !== null) val[k] = last; }
    const m = new Map<number, boolean>();
    for (let k = 0; k < idx.length; k++) m.set(idx[k]!, val[k] ?? true);
    return m;
}

/** One Akan word → canonical IPA. `useTone` overlays the lexical tone + vowel-nasality (shipped path). */
function phonemizeCore(word: string, useTone: boolean): string {
    const lw = word.toLowerCase();
    const s = [...lw];
    const n = s.length;
    const atr = atrByIndex(s);
    const out: string[] = [];
    let i = 0;
    while (i < n) {
        const c = s[i]!;
        const nx = s[i + 1];
        const two = c + (nx ?? "");
        // consonant digraphs first (ky gy hy ny tw dw kw gw hw nw ng)
        if (two in DEF.digraphs) { out.push(DEF.digraphs[two]!); i += 2; continue; }
        if (c in DEF.vowels) {
            // GLIDE FORMATION (Paster 2010): a round vowel o/ɔ/u before a DIFFERENT vowel becomes [w] (boa→bwa,
            // uafɔn→wafɔ̃) — the round vowel's mora deletes. Not before the same vowel (uu/oo = length, not glide).
            if ("oɔu".includes(c) && isVowel(nx) && nx !== c) { out.push("w"); i += 1; continue; }
            // ATR harmony resolves the ambiguous mid letters: ⟨e⟩ → [e]/[ɪ], ⟨o⟩ → [o]/[ʊ].
            if (c === "e") { out.push(atr.get(i) ? "e" : "ɪ"); i += 1; continue; }
            if (c === "o") { out.push(atr.get(i) ? "o" : "ʊ"); i += 1; continue; }
            out.push(DEF.vowels[c]!); i += 1; continue;
        }
        // ⟨n⟩: an onset before a vowel stays n; before a consonant it assimilates to that consonant's PLACE
        // (velar k/g → ŋ, labial p/b/f/m → m, else n; word-final stays n); a literal ⟨ŋ⟩ (kaikki) passes through.
        if (c === "n") {
            const p = isVowel(nx) ? "n" : nx === "k" || nx === "g" ? "ŋ" : nx === "p" || nx === "b" || nx === "f" || nx === "m" ? "m" : "n";
            out.push(p); i += 1; continue;
        }
        if (c === "ŋ") { out.push("ŋ"); i += 1; continue; }
        // LABIAL NASALIZATION (Paster 2010 rule 8): /b/ → [m] after a nasal consonant (mb → mm, n-bisa → mmisa).
        if (c === "b") { out.push(/[mnɲŋ]$/u.test(out[out.length - 1] ?? "") ? "m" : "b"); i += 1; continue; }
        if (c in DEF.consonants) { out.push(DEF.consonants[c]!); i += 1; continue; }
        if (c === TILDE) { if (out.length) out[out.length - 1] += TILDE; i += 1; continue; } // nasalisation on the vowel
        // ⚠ NOT SILENTLY: a letter this g2p has no rule for still denotes a sound, and dropping it deletes
        // content the writer typed. `latinPhone` is consulted HERE, after every digraph and single-letter rule
        // has been tried, so it can never override a reading this language has an opinion about.
        { const p = latinPhone(c, { initial: i === 0 }); if (p !== undefined) out.push(p); }
        i += 1;
    }
    // TONE + vowel-nasality overlay (shipped path): attach Chao letters (H→˥, L→˩) and ◌̃ to each nucleus.
    if (useTone) {
        const pat = TONE_LEX.get(lw);
        if (pat) {
            const toks = pat.split(",");
            const nuc: number[] = [];
            for (let k = 0; k < out.length; k++) if (NUCLEI.has(out[k]!)) nuc.push(k);
            if (toks.length === nuc.length) {
                for (let k = 0; k < nuc.length; k++) {
                    const t = toks[k]!;
                    out[nuc[k]!] += (t.includes("~") ? TILDE : "") + (t[0] === "H" ? "˥" : "˩");
                }
            }
        }
    }
    return out.join("").normalize("NFC");
}

/** One Akan word → canonical IPA (segmental + ATR harmony + lexical tone/nasality where known). */
export function phonemizeWord(word: string): string {
    return phonemizeCore(word, true);
}

/** Rule-only path (segmental + ATR, NO tone lexicon) — the non-circular signal for the referee eval. */
export function phonemizeWordRules(word: string): string {
    return phonemizeCore(word, false);
}

// ── Numbers (compositional; standard Asante Twi cardinals, space-joined counting form) ──────────────────
const NUM = DEF.numbers;
/** Twi words for 0 ≤ n < 100. */
function under100(n: number): string {
    if (n < 10) return NUM.units[n - 1]!; // 1–9 (n≥1 here)
    if (n === 10) return NUM.ten;
    if (n < 20) return `${NUM.ten} ${NUM.units[n - 11]}`; // du baako …
    const t = Math.floor(n / 10), u = n % 10;
    return u === 0 ? NUM.tens[t - 2]! : `${NUM.tens[t - 2]} ${NUM.units[u - 1]}`;
}
/** Twi words for 0 ≤ n < 1000. */
function under1000(n: number): string {
    if (n < 100) return under100(n);
    const h = Math.floor(n / 100), r = n % 100;
    return r === 0 ? NUM.hundreds[h - 1]! : `${NUM.hundreds[h - 1]} ${under100(r)}`;
}
/**
 * Twi cardinal for a non-negative integer (big-to-small). Each magnitude is the singular noun on its own
 * (apem, ɔpepem) or the plural + multiplier (mpem mmienu, mpepem mmienu). Every multiplier goes through
 * `under1000`, so the top magnitude bounds what we can say: ≥10¹² would need a multiplier ≥1000 and has no word,
 * and falls back to digit-by-digit.
 */
function numberWords(n: number): string {
    if (n === 0) return NUM.zero;
    if (n >= 1e12) return [...String(n)].map((d) => (d === "0" ? NUM.zero : NUM.units[Number(d) - 1]!)).join(" ");
    const parts: string[] = [];
    const bil = Math.floor(n / 1e9), mil = Math.floor((n % 1e9) / 1e6);
    const th = Math.floor((n % 1e6) / 1000), r = n % 1000;
    if (bil > 0) parts.push(bil === 1 ? NUM.billion : `${NUM.billions} ${under1000(bil)}`);
    if (mil > 0) parts.push(mil === 1 ? NUM.million : `${NUM.millions} ${under1000(mil)}`);
    if (th > 0) parts.push(th === 1 ? NUM.thousand : `${NUM.thousands} ${under1000(th)}`);
    if (r > 0) parts.push(under1000(r));
    return parts.join(" ");
}

/**
 * This language's OWN inventory — the TOKEN class as it stood before the widening below, lifted verbatim, so
 * nothing about the orthography is invented here. A token this REJECTS carries a letter the language does not
 * use, i.e. a foreign name.
 */
const NATIVE_CLASS = "[A-Za-zɛɔƐƆ̃]";
/**
 * NATIVISE a foreign name: fold an out-of-inventory accent to a base this g2p has a rule for. `NATIVE_CLASS`
 * above is the inventory — a word it rejects carries a letter this language does not use. See
 * `core/hostWord.ts` for why the inventory and the script boundary are two different questions.
 */
/** ⚠ EXPORTED FOR `test/lexicon-reachability.test.ts`, which asserts that every key in this engine's
 *  lexicons survives its own fold. A key the fold rewrites can never be matched from `text()`, and both
 *  engines agree on the miss, so the parity gate cannot see it (#1068). */
export const nat = makeNativiser(NATIVE_CLASS, "u");

// ⚠ ALL OF LATIN, not just this language's own letters — the narrow class ended the token at an
// out-of-inventory diacritic, so that letter became an unclaimed gap read as an English LETTER NAME and the
// rest of the word started over: `São Paulo` fragmented into three pieces, none of them right. Invisible to
// every gate: no digit or raw mark survives and nothing VANISHES.
const TOKEN = new RegExp(`(${LATIN_RUN})|(\\d+)|([.?!,;:])`, "gu");

/**
 * Build the Akan phonemizer.
 *
 * ⚠ NO `foreign` PARAMETER, AND THAT IS A DECISION RATHER THAN AN OMISSION. The signature used to take one
 * and the registry used to pass `getPhonemizer("en").text` into it; the body never referenced it, so every
 * Latin run went through `phonemizeWord` regardless and `February` read *febrwarj*. The parameter is gone
 * rather than wired because there is nothing for it to be wired TO: Akan is a Latin-script language, `TOKEN`
 * claims every Latin run, `nat()` folds any out-of-inventory letter to one this g2p has a rule for, and
 * `phonemizeWord` always answers. Routing to English would require deciding which Latin words are NOT Akan,
 * which is a lexicon this repo does not have for this language — and normalize.ts records why a wrong answer
 * there is worse than none: an English reader makes a defect sound like a plausible English word instead of
 * showing up as the gibberish that gets it noticed. `core/foreign.ts` still serves runs in OTHER SCRIPTS
 * through the shared script router, which needs no per-language argument.
 */
export function createAkan(): Phonemizer {
    return {
        text(input: string): string {
            // TEXT NORMALIZATION first — the pre-tokenizer pass that rewrites what is not already a
            // pronounceable word (grouping marks, the percent and currency signs, ranges, the decimal
            // point, the elision apostrophe) into words this tokenizer already speaks. See normalize.ts
            // for the corpus counts behind every rule and for what it deliberately declines.
            return assembleClauses(normalizeAkan(input), TOKEN, (m, sink) => {
                if (m[1]) sink.emit(phonemizeWord(nat(m[1])));
                else if (m[2]) {
                    // ⚠ ABOVE 2^53 THE RAW ASCII DIGITS USED TO BE EMITTED STRAIGHT INTO THE IPA. Refusing to
                    // COMPOSE is right — the float has already lost the low digits — but the else emitted the
                    // token itself, which is not a reading. Digit-at-a-time through the same number words
                    // instead; see core/numbers.ts `spellDigits` for the account and the cost.
                    const num = Number(m[2]);
                    if (Number.isSafeInteger(num)) for (const w of numberWords(num).split(" ")) sink.emit(phonemizeWord(w));
                    else
                        for (const d of m[2])
                            for (const w of numberWords(Number(d)).split(" ")) sink.emit(phonemizeWord(w));
                }
                else if (m[3]) {
                    const mk = DEF.clausePunctuation[m[3]];
                    if (mk) sink.pause(mk);
                }
            });
        },
    };
}
