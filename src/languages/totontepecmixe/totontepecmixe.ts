/**
 * Totontepec Mixe / ayöök (mto) phonemizer — Mixe-Zoquean (Mixean, Oaxaca, North Highland), ~6k, the modern SIL
 * practical orthography, canonical IPA. The fleet's FIRST Mixe-Zoquean language. The g2p is
 * AUTHORED FROM Crawford, *Totontepec Mixe Phonotagmemics* (SIL, 1963) — a published phonology (the bho/Balochi
 * mold). The consonants + allophony are Crawford-grounded and confident; the modern-orthography VOWEL mapping is
 * reconstructed from Crawford's example words (kääm 'pig'=/kæːm/, këp 'tree'=/kɨp/, üts 'I'=/ʌts/, ök 'dog'=/ʊk/)
 * with the central-vowel series + the UNDERLINE diacritic as the disclosed residual.
 *   ★ 9 VOWELS (Crawford §1.112): a→[a], e→[e], i→[i], o→[o], u→[u]; ä→[æ], ë→[ɨ], ü→[ʌ], ö→[ʊ]; a DOUBLED vowel
 *     → LENGTH (kääm→kæːm). ⟨ts⟩→[t͡s], ⟨tx cy⟩→[t͡ʃ] (palatalized), ⟨x⟩→[ʃ], ⟨j⟩→[h], ⟨c⟩→[k], ⟨ꞌ ' ⟩→[ʔ].
 *   ★ POST-NASAL VOICING (§1.121d): /p t ts k/ → [b d d͡z ɡ] after a nasal (mp→mb, nt→nd, nts→nd͡z, nk→ŋɡ).
 *   ★ /d g/ → the fricatives [ð ɣ] intervocalically; ⟨n⟩→[ŋ] before a velar; ⟨ny⟩→[ɲ].
 * Stress (accentual, not lexical-tonal) is not emitted. Referee: the ASJP North-Highland-Mixe Swadesh list
 * (coarse, independent) — inventory-only.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { hostWordRun, makeNativiser } from "../../core/hostWord.ts";
import { numberToWords } from "./numbers.ts";
import { latinPhone } from "../../core/latinPhones.ts";

// Multi-letter graphemes (longest-first). ⟨tx cy ch⟩ = the palatalized affricate /cy/ [t͡ʃ]; ⟨ts⟩ = /c/ [t͡s];
// ⟨qu⟩ = [k]. (Nasal clusters ⟨ny⟩ + post-nasal voicing are handled in the passes below.)
const DIGRAPHS: [string, string][] = [["tx", "t͡ʃ"], ["cy", "t͡ʃ"], ["ch", "t͡ʃ"], ["ts", "t͡s"], ["qu", "k"]];
// Single vowel graphemes → IPA. The central/back special vowels (ä ë ü ö) are the reconstructed values.
const VOWEL: Record<string, string> = {
    a: "a", e: "e", i: "i", o: "o", u: "u", ä: "æ", ë: "ɨ", ü: "ʌ", ö: "ʊ",
};
// Single consonant graphemes → IPA. ⟨c⟩=[k], ⟨x⟩=[ʃ] (Crawford's retroflex /š/), ⟨j⟩=[h], ⟨v w⟩=[v]/[w], ⟨y⟩=[j].
const CONS: Record<string, string> = {
    p: "p", t: "t", k: "k", c: "k", b: "b", d: "d", g: "ɡ", m: "m", n: "n", s: "s", x: "ʃ", j: "h",
    h: "h", v: "v", w: "w", y: "j", l: "l", r: "ɾ", f: "f", z: "ʒ", "ʼ": "ʔ", "'": "ʔ", "’": "ʔ", "ꞌ": "ʔ", "`": "ʔ",
};
const isVowel = (ph: string): boolean => [..."aeiouæɨʌʊ"].includes(ph[0] ?? "");
const NASAL = new Set(["m", "n"]);
const VELAR = new Set(["k", "ɡ", "ɣ"]);
const POSTNASAL_VOICE: Record<string, string> = { p: "b", t: "d", k: "ɡ", "t͡s": "d͡z" };

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
        // reached when every grapheme (digraphs included) has declined, so the language's own reading wins (#663).
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
 * This language's OWN inventory — the TOKEN word class as it stood before the widening above, lifted
 * verbatim, so nothing about the orthography is invented here. A token this REJECTS carries a letter the
 * language does not use, i.e. a foreign name. See core/hostWord.ts: this is the INVENTORY question, and it
 * is no longer also deciding where the script boundary falls (#657).
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
