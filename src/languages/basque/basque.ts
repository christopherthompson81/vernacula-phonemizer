/**
 * Native Basque / euskara (eu) text phonemizer — canonical IPA. Basque is a LANGUAGE ISOLATE (no
 * living relatives), Latin script, and its orthography is highly phonemic → a left-to-right greedy scan over a digraph
 * + letter table with two context rules (the ⟨r⟩ tap/trill split and the sibilant places).
 *
 * ⚠⚠ THE HALLMARK — the THREE-WAY SIBILANT / affricate system, a laminal vs apical vs postalveolar contrast:
 *     fricatives  ⟨z⟩→[s̻] (laminal)  ⟨s⟩→[s̺] (apical)   ⟨x⟩→[ʃ] (postalveolar)
 *     affricates  ⟨tz⟩→[t͡s̻]          ⟨ts⟩→[t͡s̺]          ⟨tx⟩→[t͡ʃ]
 *   (zu 'you'→[s̻u] vs su 'fire'→[s̺u]; atzo 'yesterday'→[at͡s̻o] vs hots 'sound'→[ot͡s̺]). The laminal/apical
 *   distinction is neutralised in the western dialects and the wikipron referee records it INCONSISTENTLY (both s̺/s̻
 *   for ⟨z⟩), and the eval backbone strips the apical/laminal diacritics anyway — but we EMIT the standard three-way.
 * ⚠ ⟨r⟩ is a TAP [ɾ] between vowels, a TRILL [r] word-finally / before a consonant / doubled ⟨rr⟩ (hartu→[artu],
 *   udare→[udaɾe], agirre→[aɡire]). ⚠ ⟨j⟩→[x] (the southern/Gipuzkoan standard; [j]~[ɟ]~[d͡ʒ] dialectally). ⟨h⟩ is
 *   silent (southern majority; [h] in the north). Palatal digraphs ⟨tt⟩→[c], ⟨dd⟩→[ɟ], ⟨ll⟩→[ʎ], ⟨ñ⟩→[ɲ]. ⟨g⟩→[ɡ]
 *   always (no soft g). Diphthong offglides ⟨i u⟩→[i̯ u̯] are written as plain vowels (the non-syllabic mark folds).
 *
 * Validated vs wikipron eus_latn broad (20114) + narrow (20079).
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { LATIN_RUN, makeNativiser } from "../../core/hostWord.ts";

// Digraphs, longest-first. The three affricates carry the sibilant place; ⟨tt dd ll rr⟩ are the palatal/geminate pairs.
const DIGRAPHS: [string, string][] = [
    ["tx", "t͡ʃ"], ["tz", "t͡s̻"], ["ts", "t͡s̺"], ["dd", "ɟ"], ["tt", "c"], ["ll", "ʎ"], ["rr", "r"],
];
const VOWELS = new Set([..."aeiou"]);
// Single letters. ⟨z⟩→[s̻] laminal, ⟨s⟩→[s̺] apical, ⟨x⟩→[ʃ]; ⟨j⟩→[x]; ⟨g⟩→[ɡ] always; ⟨h⟩ dropped ("" below). Loan
// letters ⟨c q v w y ç⟩ map to their nearest Basque value.
const LETTER: Record<string, string> = {
    "a": "a", "e": "e", "i": "i", "o": "o", "u": "u",
    "b": "b", "d": "d", "f": "f", "g": "ɡ", "j": "x", "k": "k", "l": "l", "m": "m", "n": "n",
    "ñ": "ɲ", "p": "p", "s": "s̺", "t": "t", "x": "ʃ", "z": "s̻",
    "c": "k", "q": "k", "v": "b", "w": "w", "y": "j", "ç": "s̻",
    // ⟨h⟩ is handled explicitly (dropped); ⟨r⟩ is context-dependent (tap/trill) — both below.
};

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

// ── NUMBERS (the Basque VIGESIMAL / base-20 system) ────────────────────────────────────────────────────────────────
// 0-19 are listed; the tens are built on scores of 20 — 20 hogei, 40 berrogei (2×20), 60 hirurogei (3×20), 80 laurogei
// (4×20) — with the connective ⟨-ta⟩ suffixed for a remainder (hogeita hamar = 20+10 = 30). Hundreds prefix the score
// system (ehun, berrehun…) and take the free connective ⟨eta⟩; likewise ⟨mila⟩ (thousand), ⟨milioi⟩ (million). ⟨eta⟩
// is placed once, before the final sub-100 group (the common Euskaltzaindia convention). Not referee-validated (the
// wikipron dump has no composed numbers) — the component words ARE (bat→bat, hiru→hiɾu, hogei→hoɡei̯…).
const ONES = ["zero", "bat", "bi", "hiru", "lau", "bost", "sei", "zazpi", "zortzi", "bederatzi",
    "hamar", "hamaika", "hamabi", "hamahiru", "hamalau", "hamabost", "hamasei", "hamazazpi", "hemezortzi", "hemeretzi"];
const SCORES = ["", "hogei", "berrogei", "hirurogei", "laurogei"]; // multiples of 20
const HUNDREDS = ["", "ehun", "berrehun", "hirurehun", "laurehun", "bostehun", "seiehun", "zazpiehun", "zortziehun", "bederatziehun"];

/** Basque cardinal 0 ≤ n < 10¹² → the spelled-out words (space-separated). */
function cardinalWords(n: number): string {
    if (n < 20) return ONES[n]!;
    if (n < 100) {
        const score = Math.floor(n / 20), rem = n % 20;
        return rem === 0 ? SCORES[score]! : `${SCORES[score]}ta ${ONES[rem]}`; // hogeita hamar
    }
    if (n < 1000) {
        const h = Math.floor(n / 100), rem = n % 100;
        return rem === 0 ? HUNDREDS[h]! : `${HUNDREDS[h]} eta ${cardinalWords(rem)}`; // ehun eta bat
    }
    if (n < 1_000_000) {
        const th = Math.floor(n / 1000), rem = n % 1000;
        const thWord = th === 1 ? "mila" : `${cardinalWords(th)} mila`;
        return rem === 0 ? thWord : `${thWord}${rem < 100 ? " eta " : " "}${cardinalWords(rem)}`;
    }
    if (n < 1_000_000_000) {
        const mil = Math.floor(n / 1_000_000), rem = n % 1_000_000;
        const milWord = mil === 1 ? "milioi bat" : `${cardinalWords(mil)} milioi`;
        return rem === 0 ? milWord : `${milWord}${rem < 100 ? " eta " : " "}${cardinalWords(rem)}`;
    }
    // 10⁹ is NOT ⟨bilioi⟩ in Basque — the long scale puts bilioi at 10¹², and 10⁹ is said ⟨mila milioi⟩ "a thousand
    // million" (Berria Estilo Liburua, the Euskaltzaindia-aligned style manual: "45.000 milioi [45 mila milioi]";
    // it also states bilioi = 10¹²). Before this, ≥ 10⁹ fell out of range and leaked the raw digits.
    const bil = Math.floor(n / 1_000_000_000), rem = n % 1_000_000_000;
    const bilWord = bil === 1 ? "mila milioi" : `${cardinalWords(bil)} mila milioi`;
    return rem === 0 ? bilWord : `${bilWord}${rem < 100 ? " eta " : " "}${cardinalWords(rem)}`;
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
