/**
 * Totontepec Mixe (mto) phonemizer — a greedy scan over the modern SIL practical orthography + Crawford's
 * allophony as passes, canonical IPA. This file owns the passes: POST-NASAL VOICING, intervocalic
 * /d g/→[ð ɣ], ⟨n⟩→[ŋ] before a velar, ⟨ny⟩→[ɲ], plus the underline/stress-mark stripping. The grapheme
 * tables and the encyclopedic record (Crawford provenance, the vowel reconstruction) live in
 * totontepecmixe.jsonc.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { hostWordRun, makeNativiser } from "../../core/hostWord.ts";
import { loadManifest } from "../../core/loadManifest.ts";
import { numberToWords } from "./numbers.ts";
import { latinPhone } from "../../core/latinPhones.ts";

interface TotontepecMixeDef {
    digraphs: [string, string][];
    vowels: Record<string, string>;
    consonants: Record<string, string>;
    voicingNasals: readonly string[];
    velars: readonly string[];
    postNasalVoice: Record<string, string>;
}
const DEF = loadManifest<TotontepecMixeDef>(import.meta.url, "totontepecmixe.jsonc");
// Grapheme tables (totontepecmixe.jsonc). The allophony passes (post-nasal voicing, ð/ɣ, ŋ) are below.
const DIGRAPHS = DEF.digraphs;
const VOWEL = DEF.vowels;
const CONS = DEF.consonants;
const POSTNASAL_VOICE = DEF.postNasalVoice;
const isVowel = (ph: string): boolean => [..."aeiouæɨʌʊ"].includes(ph[0] ?? "");
const NASAL = new Set(DEF.voicingNasals);
const VELAR = new Set(DEF.velars);

interface Seg { ph: string; vowel: boolean }

/** One Totontepec Mixe word → canonical IPA. */
export function phonemizeWord(word: string): string {
    // Strip the UNDERLINE diacritic (U+0331/U+0332 — a modern orthographic mark absent from Crawford; it most
    // likely marks a GLOTTALIZED/CREAKY phonation, corroborated by Wikipedia's documented glottalized-vowel
    // series /ḭ ə̰ o̰/ — but with no referee to place the creaky diacritic we conservatively read it as the plain
    // vowel, disclosed) AND the ACUTE/GRAVE stress marks
    // (U+0301/U+0300 — the orthography marks stress, which we do not emit; strip so the accented vowel is read,
    // not dropped), then re-compose (NFC).
    const t = word.normalize("NFD").toLowerCase().replace(/[̱̲́̀]/gu, "").normalize("NFC");
    const segs: Seg[] = [];
    let i = 0;
    while (i < t.length) {
        const dg = DIGRAPHS.find(([k]) => t.startsWith(k, i));
        if (dg) { segs.push({ ph: dg[1], vowel: false }); i += dg[0].length; continue; }
        const c = t[i]!;
        if (VOWEL[c] !== undefined) {
            // a doubled vowel → LENGTH (aa→aː). (The two graphemes may differ in the underline, already stripped.)
            if (t[i + 1] === c) { segs.push({ ph: VOWEL[c]! + "ː", vowel: true }); i += 2; continue; }
            segs.push({ ph: VOWEL[c]!, vowel: true }); i++; continue;
        }
        // ⚠ A letter with no rule here still denotes a sound; dropping it deletes what the writer typed. Only
        // reached when every grapheme (digraphs included) has declined, so the language's own reading wins.
        { const ph = CONS[c] ?? latinPhone(c, { initial: i === 0, includeH: true });
          if (ph !== undefined) segs.push({ ph, vowel: false }); }
        i++;
    }
    consonantPasses(segs);
    return segs.map((x) => x.ph).join("").normalize("NFC");
}

/** The Crawford allophony passes. */
function consonantPasses(segs: Seg[]): void {
    for (let i = 0; i < segs.length; i++) {
        const s = segs[i]!;
        if (s.vowel) continue;
        const prev = segs[i - 1], next = segs[i + 1];
        // ⟨ny⟩ → [ɲ] (the palatal nasal; the ⟨y⟩=[j] is absorbed).
        if (s.ph === "n" && next && next.ph === "j") { s.ph = "ɲ"; next.ph = ""; continue; }
        // ⟨n⟩ → [ŋ] before a velar stop.
        if (s.ph === "n" && next && VELAR.has(next.ph)) { s.ph = "ŋ"; continue; }
        // POST-NASAL VOICING: /p t ts k/ → [b d d͡z ɡ] after a nasal.
        if (prev && NASAL.has(prev.ph[0] === "ŋ" ? "n" : prev.ph) && POSTNASAL_VOICE[s.ph] !== undefined) {
            s.ph = POSTNASAL_VOICE[s.ph]!;
            continue;
        }
        // INTERVOCALIC ⟨d g⟩ → the fricatives [ð ɣ] (voiced stops only after a nasal, handled above).
        if ((s.ph === "d" || s.ph === "ɡ") && prev && prev.vowel && next && next.vowel) {
            s.ph = s.ph === "d" ? "ð" : "ɣ";
        }
        // A NASAL adjacent to /h/ → a VOICELESS nasal [m̥ n̥ ɲ̥ ŋ̥] (Crawford §1.121: hn→[n̥], mh→[m̥], há·hn→[haːn̥]);
        // the /h/ is absorbed. Both orders: ⟨mh⟩ (nasal + h) and ⟨hn⟩ (h + nasal).
        const NAS = (ph: string): boolean => ["m", "n", "ɲ", "ŋ"].includes(ph);
        if (NAS(s.ph) && next && next.ph === "h") { s.ph += "̥"; next.ph = ""; continue; }
        if (s.ph === "h" && next && NAS(next.ph)) { next.ph += "̥"; s.ph = ""; continue; }
    }
    // WORD-FINAL ⟨v⟩ → [f] as a terminus (Crawford §1.121 v-c): after a short vowel → [f] (cív→[t͡síf]); after
    // /a/ → [w] (sáv→[sáw]); after a LONG vowel/diphthong → [v] stays.
    const last = segs[segs.length - 1], pen = segs[segs.length - 2];
    if (last && last.ph === "v" && pen && pen.vowel) {
        last.ph = pen.ph === "a" ? "w" : pen.ph.includes("ː") ? "v" : "f";
    }
}

// Modern Totontepec Mixe letters (incl. ä ë ö ü, the underline, and the ʼ/ꞌ glottal). Word / number / punctuation.
const TOKEN = new RegExp(`(${hostWordRun(["Latin"], "ʼ'’`-")})|(\\d+)|([.?!,;:…])`, "giu");

/**
 * This language's OWN inventory. ⚠ TWO DIFFERENT QUESTIONS, KEPT APART: the TOKEN class above decides where
 * the SCRIPT boundary falls (routing), while this one decides whether the g2p has rules for these letters. A
 * token this class REJECTS carries a letter the language does not use — i.e. a foreign name. See
 * core/hostWord.ts.
 */
const NATIVE_CLASS = "[a-zäëöüáéíóúÄËÖǛ-ͯʼꞌ'’`-]";
const nat = makeNativiser(NATIVE_CLASS, "iu");

class TotontepecMixePhonemizer implements Phonemizer {
    text(input: string): string {
        return assembleClauses(input.normalize("NFC"), TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(nat(m[1])));
            else if (m[2]) for (const wd of numberToWords(Number(m[2])).split(" ")) sink.emit(phonemizeWord(wd));
            else if (m[3]) sink.pause(m[3] === "." || m[3] === "!" || m[3] === "?" ? m[3] : ",");
        });
    }
}

/** Build the Totontepec Mixe phonemizer (Crawford-grounded consonants + allophony; reconstructed vowels). */
export function createTotontepecMixe(): Phonemizer {
    return new TotontepecMixePhonemizer();
}
