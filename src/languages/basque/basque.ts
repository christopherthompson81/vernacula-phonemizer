/**
 * Basque (eu) phonemizer — a left-to-right greedy scan over a digraph + letter table, canonical IPA.
 * This file owns the two context rules: the ⟨r⟩ tap/trill split (tap only between vowels) and the ⟨h⟩
 * choice, plus the vigesimal number composition. The grapheme tables (incl. the three-way sibilant
 * hallmark), the number words and the encyclopedic record live in basque.jsonc.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { LATIN_RUN, makeNativiser } from "../../core/hostWord.ts";
import { loadManifest } from "../../core/loadManifest.ts";

interface BasqueNumbers {
    ones: string[];
    scores: string[];
    hundreds: string[];
    thousand: string;
    million: string;
    and: string;
}
interface BasqueDef {
    digraphs: [string, string][];
    letters: Record<string, string>;
    numbers: BasqueNumbers;
}
const DEF = loadManifest<BasqueDef>(import.meta.url, "basque.jsonc");
// Letter tables (basque.jsonc). ⟨h⟩ and the tap/trill ⟨r⟩ are context-dependent — handled in the scan below.
const DIGRAPHS = DEF.digraphs;
const LETTER = DEF.letters;
const VOWELS = new Set([..."aeiou"]);

/** One Basque word → canonical IPA. */
export function phonemizeWord(word: string): string {
    const chars = [...word.normalize("NFC").toLowerCase()]; // NFC so ⟨ñ ç⟩ stay single codepoints (NFD would drop the mark)

    const out: string[] = [];
    for (let i = 0; i < chars.length; i++) {
        const c = chars[i]!;
        // Digraphs first (tx tz ts dd tt ll rr).
        const dg = DIGRAPHS.find(([k]) => chars[i] === k[0] && chars[i + 1] === k[1]);
        if (dg) { out.push(dg[1]); i++; continue; }
        if (c === "h") { out.push("h"); continue; } // ⟨h⟩→[h] (northern/careful standard, faithful to the spelling; the southern majority drops it — the referee lists both, and the h-form scores higher)
        if (c === "r") {
            // TAP [ɾ] only between vowels; TRILL [r] word-initially, word-finally, or next to a consonant.
            const prevV = i > 0 && VOWELS.has(chars[i - 1]!);
            const nextV = i + 1 < chars.length && VOWELS.has(chars[i + 1]!);
            out.push(prevV && nextV ? "ɾ" : "r");
            continue;
        }
        const ph = LETTER[c];
        if (ph !== undefined) out.push(ph);
        // else: unknown char (apostrophe, hyphen) — skip
    }
    return out.join("");
}

// ── NUMBERS (the Basque VIGESIMAL / base-20 system; data + provenance in basque.jsonc) ─────────────────────────────
const NUM = DEF.numbers;
const ONES = NUM.ones;
const SCORES = NUM.scores;
const HUNDREDS = NUM.hundreds;

/** Basque cardinal 0 ≤ n < 10¹² → the spelled-out words (space-separated). */
function cardinalWords(n: number): string {
    if (n < 20) return ONES[n]!;
    if (n < 100) {
        const score = Math.floor(n / 20), rem = n % 20;
        return rem === 0 ? SCORES[score]! : `${SCORES[score]}ta ${ONES[rem]}`; // hogeita hamar
    }
    if (n < 1000) {
        const h = Math.floor(n / 100), rem = n % 100;
        return rem === 0 ? HUNDREDS[h]! : `${HUNDREDS[h]} ${NUM.and} ${cardinalWords(rem)}`; // ehun eta bat
    }
    if (n < 1_000_000) {
        const th = Math.floor(n / 1000), rem = n % 1000;
        const thWord = th === 1 ? NUM.thousand : `${cardinalWords(th)} ${NUM.thousand}`;
        return rem === 0 ? thWord : `${thWord}${rem < 100 ? ` ${NUM.and} ` : " "}${cardinalWords(rem)}`;
    }
    if (n < 1_000_000_000) {
        const mil = Math.floor(n / 1_000_000), rem = n % 1_000_000;
        const milWord = mil === 1 ? `${NUM.million} bat` : `${cardinalWords(mil)} ${NUM.million}`;
        return rem === 0 ? milWord : `${milWord}${rem < 100 ? ` ${NUM.and} ` : " "}${cardinalWords(rem)}`;
    }
    // 10⁹ is NOT ⟨bilioi⟩ in Basque — the long scale puts bilioi at 10¹², and 10⁹ is said ⟨mila milioi⟩ "a thousand
    // million" (Berria Estilo Liburua, the Euskaltzaindia-aligned style manual: "45.000 milioi [45 mila milioi]";
    // it also states bilioi = 10¹²). Before this, ≥ 10⁹ fell out of range and leaked the raw digits.
    const bil = Math.floor(n / 1_000_000_000), rem = n % 1_000_000_000;
    const bilWord = bil === 1 ? `${NUM.thousand} ${NUM.million}` : `${cardinalWords(bil)} ${NUM.thousand} ${NUM.million}`;
    return rem === 0 ? bilWord : `${bilWord}${rem < 100 ? ` ${NUM.and} ` : " "}${cardinalWords(rem)}`;
}

/** A digit string → canonical IPA of its Basque cardinal (each word phonemized, space-joined). Out-of-range → raw. */
function number(digits: string): string {
    const n = Number(digits);
    if (!Number.isSafeInteger(n) || n < 0 || n >= 1_000_000_000_000) return digits; // 10¹² (bilioi) not authored
    return cardinalWords(n).split(" ").map(phonemizeWord).join(" ");
}

// Basque uses the basic Latin alphabet + ⟨ñ ç⟩. Word / number / punctuation.
const TOKEN = new RegExp(`(${LATIN_RUN})|(\\d+)|([.?!,;:…])`, "gu");

/**
 * This language's OWN inventory. ⚠ TWO DIFFERENT QUESTIONS, KEPT APART: the TOKEN class above decides where
 * the SCRIPT boundary falls (routing), while this one decides whether the g2p has rules for these letters. A
 * token this class REJECTS carries a letter the language does not use — i.e. a foreign name. See
 * core/hostWord.ts.
 */
const NATIVE_CLASS = "[a-zñçA-ZÑÇ]";
const nat = makeNativiser(NATIVE_CLASS, "u");

class BasquePhonemizer implements Phonemizer {
    text(input: string): string {
        // NFC-normalize before tokenizing: Basque ⟨ñ ç⟩ decompose under NFD to base+combining, which fall outside the
        // [a-zñçA-ZÑÇ] token class → NFD input would shatter words and drop the letter.
        return assembleClauses(input.normalize("NFC"), TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(nat(m[1])));
            else if (m[2]) sink.emit(number(m[2])); // Basque vigesimal cardinals
            else if (m[3]) sink.pause(m[3] === "." || m[3] === "!" || m[3] === "?" ? m[3] : ",");
        });
    }
}

/** Build the Basque phonemizer (greedy digraph+letter scan; three-way sibilants; r tap/trill). */
export function createBasque(): Phonemizer {
    return new BasquePhonemizer();
}
