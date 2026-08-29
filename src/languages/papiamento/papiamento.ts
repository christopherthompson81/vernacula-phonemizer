/**
 * Papiamentu (pap) phonemizer — a greedy longest-match scan over the Curaçao/Bonaire phonemic
 * orthography, canonical IPA. This file owns the rules: word-final coda-⟨n⟩ → [ŋ] with vowel
 * nasalization, degemination, the ⟨ou⟩ diphthong, and stress placement (acute pin / penult default /
 * ultimate for consonant-final). The grapheme tables and the encyclopedic record (the coda-⟨n⟩ hallmark,
 * attestation caveat) live in papiamento.jsonc.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { LATIN_RUN, makeNativiser } from "../../core/hostWord.ts";
import { loadManifest } from "../../core/loadManifest.ts";
import { IPA_VOWEL } from "../../core/ipa.ts";
import { numberToWords } from "./numbers.ts";
import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";
import { normalizePapiamento } from "./normalize.ts";
import { renormalize } from "../../core/provenance.ts";

interface PapiamentoDef {
    digraphs: [string, string][];
    vowelLetters: readonly string[];
    letters: Record<string, string>;
    nasalized: Record<string, string>;
}
const DEF = loadManifest<PapiamentoDef>(import.meta.url, "papiamento.jsonc");
// Grapheme tables (papiamento.jsonc). The coda-⟨n⟩, degemination and stress rules are the scan below.
const DIGRAPHS = DEF.digraphs;
const LETTER = DEF.letters;
const NASALIZE = DEF.nasalized;
const VOWEL_G = new Set(DEF.vowelLetters); // the vowel letters counted to place an acute-marked stress
const ACUTE: Record<string, string> = { "á": "a", "é": "e", "í": "i", "ó": "o", "ú": "u" };

/** One Papiamentu word → canonical IPA. */
export function phonemizeWord(word: string): string {
    // Degeminate: Papiamentu has no geminate consonants, so a doubled consonant (mostly in Dutch/Spanish loans) is a
    // single one (Willemstad→[wiləmstad]). Vowels are left alone (they can be genuine sequences).
    const w = word.normalize("NFC").toLowerCase().replace(/([bcdfghjklmnpqrstvwxz])\1+/gu, "$1");
    const chars = [...w];
    const segs: string[] = [];
    const stressAcute = chars.findIndex((c) => ACUTE[c] !== undefined); // an acute vowel marks irregular stress
    for (let i = 0; i < chars.length; i++) {
        const c = chars[i]!;
        const dg = DIGRAPHS.find(([k]) => chars[i] === k[0] && chars[i + 1] === k[1]);
        if (dg) { segs.push(dg[1]); i++; continue; }
        if (c === "o" && chars[i + 1] === "u") { segs.push("ɔ"); continue; } // the ⟨ou⟩ diphthong → [ɔu] (Kòrsou→kɔrsɔu)
        // CODA ⟨n⟩ is RETAINED (Papiamentu does NOT delete it — Maurer; Kouwenberg & Murray): WORD-FINAL ⟨n⟩ → the
        // velar nasal [ŋ], also NASALIZING the preceding vowel (bon→[bõŋ], federashon→[fedeɾaʃõŋ]). A ⟨n⟩ before a
        // consonant or a vowel stays [n] (kontra→[kɔntra], abominabel→[abominabel]). (The Wiktionary referee's
        // "nasalize + drop the ⟨n⟩" is a Portuguese-style over-transcription — the ⟨n⟩→∅ is folded, not modelled.)
        if (c === "n" && i + 1 >= chars.length && segs.length && IPA_VOWEL.has(segs[segs.length - 1]!.slice(-1))) {
            const prev = segs[segs.length - 1]!;
            segs[segs.length - 1] = prev.slice(0, -1) + (NASALIZE[prev.slice(-1)] ?? prev.slice(-1));
            segs.push("ŋ");
            continue;
        }
        const ph = LETTER[c];
        if (ph !== undefined) segs.push(ph);
    }
    // STRESS: an acute-accented vowel pins it; otherwise the penultimate vowel (Iberian default).
    // Vowel nuclei for stress. A falling-diphthong OFFGLIDE — a high vowel [i]/[u] right after another vowel (ou, ai,
    // au, ei, oi) — is NOT a separate nucleus (Kòrsou→[ˈkɔrsou], one nucleus per the ⟨ou⟩ diphthong).
    const isVowelSeg = (s: string): boolean => [...s.normalize("NFD")].some((x) => IPA_VOWEL.has(x));
    const vIdx = segs.map((s, idx) => {
        if (!isVowelSeg(s)) return -1;
        if ((s === "i" || s === "u") && idx > 0 && isVowelSeg(segs[idx - 1]!)) return -1; // diphthong offglide
        return idx;
    }).filter((x) => x >= 0);
    if (vIdx.length) {
        let nucleus: number;
        if (stressAcute >= 0) {
            // map the acute grapheme position to its vowel seg (count vowels up to it)
            const vowelsBefore = chars.slice(0, stressAcute).filter((c) => VOWEL_G.has(c)).length;
            nucleus = vIdx[Math.min(vowelsBefore, vIdx.length - 1)]!;
        } else {
            // Iberian default: penultimate for a vowel-final word; ULTIMATE for a consonant-final word or one ending
            // in a NASALIZED vowel (a dropped coda-⟨n⟩ loan, -shon/-in → final stress: federashon, mashin).
            const last = segs[segs.length - 1]!;
            const lastVowel = [...last.normalize("NFD")].some((x) => IPA_VOWEL.has(x));
            const lastNasal = last.normalize("NFD").includes("̃");
            nucleus = (!lastVowel || lastNasal || vIdx.length < 2) ? vIdx[vIdx.length - 1]! : vIdx[vIdx.length - 2]!;
        }
        const at = nucleus > 0 && ![...segs[nucleus - 1]!.normalize("NFD")].some((x) => IPA_VOWEL.has(x)) ? nucleus - 1 : nucleus;
        segs.splice(at, 0, "ˈ");
    }
    return segs.join("");
}

// Papiamentu Latin — a-z + the accented/open letters. Word / number / punctuation.
/**
 * The shared SYMBOL tier. Every word is a pap.wikipedia TOKEN attestation whose examples were read:
 * `promé` ×129, `florin` ×112, `meter` ×75, `grado` ×41, `kilometer` ×38, `dollar` ×35, `euro` ×34,
 * `porshento` ×28, `kuadrá` ×23, `koma` ×18, `Celsius` ×10, `kubiko` ×3.
 *
 * ⚠ EVERY ONE OF THEM IS CURAÇAOAN, AND THAT IS NOT A CHOICE — the Aruban spellings `porcento` and
 * `cuadrado` score **zero** on the same wiki, even though a third of this corpus is written in Aruban
 * orthography (see normalize.ts). So the measure words are phonological where the surrounding article may
 * be etymological. A small, real cost, stated rather than discovered.
 *
 * ⚠ AND THE FLORIN IS THE LOCAL CURRENCY, ×112 — more than the dollar and the euro together. The corpus
 * writes it beside its code: "un tarifa oficial fiho di AWG 1,79 pa cada US$ 1".
 */
const SYMBOLS = makeSymbolNormalizer({
    percent: ["porshento"],
    currency: { "$": ["dollar", "dollarnan"], "€": ["euro", "euronan"], "ƒ": ["florin", "florinnan"] },
    units: {
        "km": ["kilometer", "kilometernan"], "m": ["meter", "meternan"],
        "cm": ["sentimeter", "sentimeternan"], "mm": ["milimeter", "milimeternan"],
        "kg": ["kilo", "kilonan"],
    },
    exponentWords: { squared: ["kuadrá"], cubed: ["kubiko"], position: "after" },
    ampersand: "i",
    magnitudes: ["mil", "mion", "miyon", "biyon"],
});

// ⚠ THE DECIMAL COMMA IS SPANNED BY THE NUMBER BRANCH, or the tokenizer's own `,` claims it as a clause
// pause and `24,6%` reads as *bintikuater , seis* — a phrase break inside a quantity. normalize.ts has
// already folded the dot decimals onto the comma, so one branch covers both orthographies' conventions.
// `decimals` is 1,951 corpus-wide.
const TOKEN = new RegExp(`(${LATIN_RUN})|(\\d+(?:,\\d+)?)|([.?!,;:\u2026])`, "gu");

/**
 * This language's OWN inventory. ⚠ TWO DIFFERENT QUESTIONS, KEPT APART: the TOKEN class above decides where
 * the SCRIPT boundary falls (routing), while this one decides whether the g2p has rules for these letters. A
 * token this class REJECTS carries a letter the language does not use — i.e. a foreign name. See
 * core/hostWord.ts.
 */
const NATIVE_CLASS = "[a-zàáèéìíòóùúñA-ZÀÁÈÉÌÍÒÓÙÚÑ]";
const nat = makeNativiser(NATIVE_CLASS, "u");

class PapiamentoPhonemizer implements Phonemizer {
    text(input: string): string {
        // normalize.ts FIRST — its separator, era, sign and degree steps need the figure and its mark
        // still adjacent, which the tier would break — then the shared symbol tier.
        return assembleClauses(SYMBOLS(normalizePapiamento(renormalize(input, "NFC"))), TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(nat(m[1])));
            // A digit run reads as Papiamentu number WORDS, each phonemized like any other word.
            else if (m[2]) {
                const [intPart, frac] = m[2].split(",");
                for (const wd of numberToWords(Number(intPart), intPart).split(" ")) sink.emit(phonemizeWord(wd));
                if (frac !== undefined) {
                    // `koma` ×18 on pap.wikipedia — the separator's own name. The fractional part is read
                    // digit by digit, the same call every other layer in this sweep makes.
                    sink.emit(phonemizeWord("koma"));
                    for (const dg of frac) for (const wd of numberToWords(Number(dg), dg).split(" ")) sink.emit(phonemizeWord(wd));
                }
            }
            else if (m[3]) sink.pause(m[3] === "." || m[3] === "!" || m[3] === "?" ? m[3] : ",");
        });
    }
}

/** Build the Papiamentu phonemizer (Curaçao-orthography scan + coda-n nasalization + stress). */
export function createPapiamento(): Phonemizer {
    return new PapiamentoPhonemizer();
}
