/**
 * Native Akan / Akan kasa (ak) text phonemizer — canonical IPA, espeak-independent. Akan is a Kwa (Niger-Congo)
 * language of Ghana (~20M incl. L2) — the fleet's FIRST Kwa language. It has a shallow, well-standardised Latin
 * orthography (Bureau of Ghana Languages; the Asante/Akuapem Twi and Fante varieties share it), so a near
 * one-to-one rule g2p. The letter maps live in akan.jsonc; the contextual bits are here:
 *
 *   • CONSONANT DIGRAPHS (longest-match) — a palatal series ⟨ky gy hy ny⟩ → t͡ɕ d͡ʑ ɕ ɲ and a LABIALISED series
 *     ⟨tw dw kw gw hw nw⟩ → t͡ɕʷ d͡ʑʷ kʷ ɡʷ ɕʷ ŋʷ (the signature Akan labial-palatalisation), plus ⟨ng⟩ → ŋ.
 *   • GLIDE FORMATION (Paster 2010) — a round vowel ⟨o ɔ u⟩ before another vowel becomes the on-glide [w]
 *     (boa→bwa, uafɔn→wafɔ̃); front vowels stay in hiatus.
 *   • CODA nasal — a syllable-final ⟨n⟩ assimilates to the following consonant's PLACE (velar → ŋ, labial → m,
 *     else n); an onset ⟨n⟩ before a vowel stays n.
 *   • the combining tilde ⟨◌̃⟩ (rare, disambiguating) passes through as vowel nasalisation.
 *
 *   • ATR HARMONY (Paster 2010) — the orthography merges [e]/[ɪ] into ⟨e⟩ and [o]/[ʊ] into ⟨o⟩; atrByIndex()
 *     recovers the value from the word's harmony (triggers ⟨i u⟩ = +ATR, ⟨ɛ ɔ⟩ = −ATR, spreading to ⟨e o⟩:
 *     kyerɛ→t͡ɕɪrɛ, bisa→bisa).
 *   • NUMBERS — standard Twi cardinals (baako, du, aduonu, ɔha, apem), compositional.
 *
 * TONE (H/L) is phonemic but genuinely DATA-BLOCKED: the standard orthography does not write it, Akan tone is
 * lexical/grammatical (not predictable from segments), and no machine-readable tone-marked corpus exists (the only
 * source, kaikki, has 22 words) — so modelling it would mean fabricating unverifiable output. NASALISATION is
 * likewise contrastive-but-unwritten and NOT rule-derivable (mifi→mĩfi nasalises, soma→soma does not, same
 * post-nasal position) — only the rare disambiguating tilde ⟨◌̃⟩ is recoverable (handled). Small kaikki human gold
 * (no wikipron/epitran Akan) → 🔷 single-source. See docs/investigations/ak_native_bringup_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { loadManifest } from "../../core/loadManifest.ts";

interface AkanDef {
    digraphs: Record<string, string>;
    consonants: Record<string, string>;
    vowels: Record<string, string>;
    clausePunctuation: Record<string, string>;
    numbers: {
        zero: string; units: string[]; ten: string; tens: string[];
        hundreds: string[]; thousand: string; thousands: string;
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

/** One Akan word → canonical IPA (segmental + ATR harmony; tone deferred). */
export function phonemizeWord(word: string): string {
    const s = [...word.toLowerCase()];
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
        if (c in DEF.consonants) { out.push(DEF.consonants[c]!); i += 1; continue; }
        if (c === TILDE) { if (out.length) out[out.length - 1] += TILDE; i += 1; continue; } // nasalisation on the vowel
        i += 1; // unknown → skip
    }
    return out.join("").normalize("NFC");
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
/** Twi cardinal for a non-negative integer (big-to-small; thousands via apem / mpem N). */
function numberWords(n: number): string {
    if (n === 0) return NUM.zero;
    const th = Math.floor(n / 1000), r = n % 1000;
    const parts: string[] = [];
    if (th > 0) parts.push(th === 1 ? NUM.thousand : `${NUM.thousands} ${under1000(th)}`);
    if (r > 0) parts.push(under1000(r));
    return parts.join(" ");
}

const TOKEN = /([A-Za-zɛɔƐƆ̃]+)|(\d+)|([.?!,;:])/gu;

/** Build the Akan phonemizer. `foreign` handles embedded Latin/other runs (none native — Akan IS Latin). */
export function createAkan(foreign?: (s: string) => string): Phonemizer {
    return {
        text(input: string): string {
            return assembleClauses(input, TOKEN, (m, sink) => {
                if (m[1]) sink.emit(phonemizeWord(m[1]));
                else if (m[2]) {
                    const num = Number(m[2]);
                    if (Number.isSafeInteger(num)) for (const w of numberWords(num).split(" ")) sink.emit(phonemizeWord(w));
                    else sink.emit(m[2]);
                }
                else if (m[3]) {
                    const mk = DEF.clausePunctuation[m[3]];
                    if (mk) sink.pause(mk);
                }
            });
        },
    };
}
