/**
 * Zhuang / Vahcuengh (za) phonemizer — Tai-Kadai, Standard Zhuang (Wuming), the 1982 Latin orthography, canonical
 * IPA, espeak-independent. A longest-match scan: multi-letter onsets (mb→ɓ, nd→ɗ, gv→kʷ, ng→ŋ, …) + vowel digraphs
 * before single letters; the pinyin-style ⟨b d g⟩=/p t k/ and ⟨s⟩→θ / ⟨r⟩→ɣ / ⟨c⟩→ɕ / ⟨v⟩→β; a word-initial
 * vowel takes a [ʔ] onset. TONES are written as syllable-final letters — ⟨z j x q h⟩ = tones 2-6, none = tone 1,
 * a p/t/k coda = a checked tone — and emitted as Chao contour letters after each syllable's vowel (the referee
 * eval strips them, so corroboration is segmental). ⟨z x q j⟩ are never onsets; ⟨h⟩ is an onset before a vowel and
 * tone-6 otherwise. See docs/investigations/za_native_bringup_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { numberToWords } from "./numbers.ts";
import { MANIFEST } from "./manifest.ts";

const ONSETS = MANIFEST.onsets;
const CONS = MANIFEST.consonants;
const VDIGRAPH = MANIFEST.vowelDigraphs;
const VOWELS = MANIFEST.vowels;
const TONE = MANIFEST.tones;
const CLAUSE_MARK = MANIFEST.clausePunctuation;

const isVowelStart = (w: string, i: number): boolean =>
    i < w.length && (VOWELS[w[i]!] !== undefined || Object.keys(VDIGRAPH).some((d) => w.startsWith(d, i)));
// The tone letters that are NEVER onsets (z/x/q/j); ⟨h⟩ is contextual, handled inline.
const TONE_LETTER: Record<string, string> = { z: "z", j: "j", x: "x", q: "q" };
// Coda stop letters → PLAIN (unaspirated) stops (Zhuang codas never aspirate): b/p→p, d/t→t, g/k→k.
const CODA: Record<string, string> = { b: "p", p: "p", d: "t", t: "t", g: "k", k: "k", m: "m", n: "n" };

/** Phonemize one Zhuang word to canonical IPA (segments + Chao tones). Tones fold in the eval. */
export function phonemizeWord(word: string): string {
    const w = word.toLowerCase();
    let out = "";
    let i = 0;
    // Per-syllable state: whether the current syllable has a vowel and whether a tone was already placed.
    let sylVowel = false;
    let sylCoda = ""; // "" (open), or "p"/"t"/"k" (checked)
    let toneDone = false;
    let sylStart = true;

    const closeSyllable = (): void => {
        if (sylVowel && !toneDone) out += sylCoda ? TONE.checked! : TONE["1"]!;
        sylVowel = false;
        sylCoda = "";
        toneDone = false;
    };

    while (i < w.length) {
        const c = w[i]!;
        // Tone letters z/j/x/q — always a tone; close the syllable.
        if (TONE_LETTER[c]) {
            if (sylVowel) {
                out += TONE[c]!;
                toneDone = true;
            }
            i++;
            sylStart = true;
            continue;
        }
        // h — onset [h] before a vowel; tone-6 marker otherwise.
        if (c === "h") {
            if (isVowelStart(w, i + 1)) {
                if (sylVowel) closeSyllable();
                out += "h";
                sylStart = false;
                i++;
                continue;
            }
            if (sylVowel) {
                out += TONE.h!;
                toneDone = true;
            }
            i++;
            sylStart = true;
            continue;
        }
        // Multi-letter onset (mb/nd/ng/ny/gv/by/gy/ngv/mby) — a new syllable onset.
        let matched = false;
        for (const [orth, ipa] of Object.entries(ONSETS)) {
            if (w.startsWith(orth, i) && isVowelStart(w, i + orth.length)) {
                if (sylVowel) closeSyllable();
                out += ipa;
                sylStart = false;
                i += orth.length;
                matched = true;
                break;
            }
        }
        if (matched) continue;
        // Coda ⟨ng⟩ → [ŋ] (a velar nasal coda, NOT an onset — no following vowel: mwngz→mɯŋ).
        if (w.startsWith("ng", i) && !isVowelStart(w, i + 2)) {
            out += "ŋ";
            i += 2;
            continue;
        }
        // ⟨ae⟩ → the diphthong [ai] in an OPEN syllable (bae→pai), but short [a] before a CODA (caet→ɕat, haemh→ham).
        if (w.startsWith("ae", i) && !w.startsWith("aeu", i)) {
            if (sylVowel) closeSyllable();
            out += /^(ng|[bdgptkmn])/u.test(w.slice(i + 2)) ? "a" : "ai";
            sylVowel = true;
            sylStart = false;
            i += 2;
            continue;
        }
        // Vowel digraph. A vowel starting when the syllable already has a nucleus = a new syllable (VV hiatus).
        let vmatched = false;
        for (const [orth, ipa] of Object.entries(VDIGRAPH)) {
            if (w.startsWith(orth, i)) {
                if (sylVowel) closeSyllable();
                out += ipa;
                sylVowel = true;
                sylStart = false;
                i += orth.length;
                vmatched = true;
                break;
            }
        }
        if (vmatched) continue;
        // Single vowel.
        if (VOWELS[c] !== undefined) {
            if (sylVowel && sylStart) closeSyllable();
            out += VOWELS[c]!;
            sylVowel = true;
            sylStart = false;
            i++;
            continue;
        }
        // Single consonant — onset (before a vowel) or coda.
        const cp = CONS[c];
        if (cp !== undefined) {
            if (isVowelStart(w, i + 1)) {
                if (sylVowel) closeSyllable();
                out += cp;
                sylStart = false;
            } else {
                // Coda: the stop letters are PLAIN (unaspirated) in coda — ⟨b p⟩→p, ⟨d t⟩→t, ⟨g k⟩→k (a checked
                // syllable); ⟨m n⟩ → nasal. Only ONSET p/t/k aspirate.
                const coda = CODA[c] ?? cp;
                out += coda;
                if (coda === "p" || coda === "t" || coda === "k") sylCoda = coda;
            }
            i++;
            continue;
        }
        i++; // unknown → skip
    }
    closeSyllable();
    // Word-initial vowel → glottal onset.
    if (/^[aeiouɯɵ]/u.test(out)) out = "ʔ" + out;
    return out;
}

// A word (Zhuang letters) / number / punctuation token.
const TOKEN = /([a-z]+)|(\d+)|([.!?…,;:])/giu;

class ZhuangPhonemizer implements Phonemizer {
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

/** Build the Zhuang phonemizer (rule g2p + tone letters). */
export function createZhuang(): Phonemizer {
    return new ZhuangPhonemizer();
}
