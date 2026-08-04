/**
 * Kalaallisut / West Greenlandic (kl) phonemizer — Eskimo-Aleut (Inuit branch), ~56k (Greenland), the 1973
 * PHONEMIC Latin orthography. Canonical IPA, espeak-independent. The fleet's FIRST Eskimo-Aleut language. Because
 * the orthography is highly phonemic, this is a near-1:1 scan:
 *   ★ THREE-VOWEL system /a i u/ (the Inuit hallmark). ⟨e o⟩ are NOT phonemes — they are the LOWERED allophones of
 *     /i u/ the orthography writes before a uvular ⟨q r⟩, so ⟨e⟩→[i], ⟨o⟩→[u] (aaneq→aːniq). Doubled vowel → LENGTH.
 *   ★ the UVULAR stop ⟨q⟩→[q] and the uvular fricative ⟨r⟩→[ʁ]; ⟨ng⟩→[ŋ], ⟨nng⟩→[ŋː]; a doubled consonant → LENGTH.
 * The PHONETIC regressive consonant ASSIMILATION (rp→pp) + uvular vowel-lowering ([ɜ ɔ ɑ], ll→ɬ) are the NARROW
 * layer — deferred (we target the broad/phonemic level). No stress (weight-based, unmarked). Referee: wikipron
 * kal_latn_broad (human, 1581). See docs/investigations/kl_native_bringup_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { hostWordRun, makeNativiser } from "../../core/hostWord.ts";
import { numberToWords, readDigits } from "./numbers.ts";
import { latinPhone } from "../../core/latinPhones.ts";

// Single vowel graphemes → IPA. ⟨e o⟩ are the orthographic lowered-before-uvular allophones of /i u/ → [i]/[u].
// ⟨y⟩ joins æ ø å as a Danish-loan vowel letter: it is unavoidable once Danish numerals are read (tyve, fyrre,
// sytten — see numbers.ts), and without it the scan silently deleted it (tyve → *[tvi]).
const VOWEL: Record<string, string> = { a: "a", i: "i", u: "u", e: "i", o: "u", æ: "ɛ", ø: "ø", å: "ɔ", y: "y" };
// Single consonant graphemes → IPA. ⟨r⟩ is the uvular fricative [ʁ]; ⟨g⟩→[ɡ].
// ⟨b d⟩ are loan letters — Greenlandic has no voiced stops, so they DEVOICE to [p t] (Biina→piːna, Bolatta→
// pulatːa). ⟨g⟩ is the voiced velar FRICATIVE [ɣ] (isigak→isiɣak) — the continuant parallel to the stop ⟨k⟩,
// exactly as ⟨r⟩→[ʁ] is to ⟨q⟩ (the series v s g r = [v s ɣ ʁ]); the broad referee coarsens it to [ɡ] (fold).
const CONS: Record<string, string> = {
    p: "p", t: "t", k: "k", q: "q", b: "p", d: "t", g: "ɣ", f: "f", h: "h", j: "j",
    l: "l", m: "m", n: "n", s: "s", v: "v", r: "ʁ", w: "v",
};
const isVowelChar = (c: string): boolean => VOWEL[c] !== undefined;

/** Phonemize one Kalaallisut word → canonical IPA (near-1:1 scan; doubled letter → length; ng/nng → ŋ/ŋː). */
export function phonemizeWord(word: string): string {
    const w = word.normalize("NFC").toLowerCase();
    const chars = [...w];
    const out: string[] = [];
    for (let i = 0; i < chars.length; i++) {
        const c = chars[i]!, nx = chars[i + 1] ?? "", nx2 = chars[i + 2] ?? "";
        // ⟨nng⟩ → [ŋː], ⟨ng⟩ → [ŋ] (longest-match).
        if (c === "n" && nx === "n" && nx2 === "g") { out.push("ŋː"); i += 2; continue; }
        if (c === "n" && nx === "g") { out.push("ŋ"); i += 1; continue; }
        // Doubled VOWEL → long (aa→aː, ee→iː, oo→uː). Keyed on the same GRAPHEME (c===nx) so a heterographic
        // ⟨ei⟩/⟨ou⟩ (both mapping to the same /i u/) is NOT wrongly merged to a single long vowel.
        if (isVowelChar(c) && c === nx) { out.push(VOWEL[c]! + "ː"); i += 1; continue; }
        if (isVowelChar(c)) { out.push(VOWEL[c]!); continue; }
        // Doubled CONSONANT → long (aallaat→aːlːaːt, aappaa→aːpːaː).
        if (CONS[c] !== undefined && c === nx) { out.push(CONS[c]! + "ː"); i += 1; continue; }
        if (CONS[c] !== undefined) { out.push(CONS[c]!); continue; }
        // ⚠ A letter with no rule here still denotes a sound; dropping it deletes what the writer typed.
        // Reached only when every rule above has declined, so the language's own reading always wins (#663).
        { const p = latinPhone(c, { initial: i === 0, includeH: true }); if (p !== undefined) out.push(p); }
    }
    return out.join("");
}

// Kalaallisut Latin letters (+ Danish-loan æ ø å). Word / number / punctuation. Numbers deferred.
const TOKEN = new RegExp(`(${hostWordRun(["Latin"], "'’-")})|(\\d+)|([.!?…,;:])`, "gu");

/**
 * This language's OWN inventory — the TOKEN word class as it stood before the widening above, lifted
 * verbatim, so nothing about the orthography is invented here. A token this REJECTS carries a letter the
 * language does not use, i.e. a foreign name. See core/hostWord.ts: this is the INVENTORY question, and it
 * is no longer also deciding where the script boundary falls (#657).
 */
const NATIVE_CLASS = "[a-zæøåA-ZÆØÅ'’-]";
const nat = makeNativiser(NATIVE_CLASS, "u");

class KalaallisutPhonemizer implements Phonemizer {
    text(input: string): string {
        return assembleClauses(input, TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(nat(m[1])));
            else if (m[2]) {
                // ≤12 digits stays inside the attested range (< 10¹²); longer reads the raw digit string so the
                // Number() conversion can't lose precision. Native 0–12, Danish above — see numbers.ts.
                const words = m[2].length <= 12 ? numberToWords(Number(m[2])) : readDigits(m[2]);
                for (const wd of words.split(" ")) sink.emit(phonemizeWord(wd));
            }
            else if (m[3]) sink.pause(m[3] === "." || m[3] === "!" || m[3] === "?" ? m[3] : ",");
        });
    }
}

/** Build the Kalaallisut phonemizer (near-1:1 phonemic scan). */
export function createKalaallisut(): Phonemizer {
    return new KalaallisutPhonemizer();
}
