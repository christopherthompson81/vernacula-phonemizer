/**
 * Croatian (hr, hrvatski) phonemizer — South Slavic, Gaj's Latin, fully phonemic. Croatian and
 * Serbian are the pluricentric standards of one phonological system (Serbo-Croatian); the SEGMENTAL grapheme→IPA is
 * IDENTICAL, so this module reuses the Serbian engine's word g2p (phonemizeWord) directly. The only Croatian-specific
 * delta is the CARDINAL NUMBER WORDS (Croatian tisuća/milijun/dvjesto vs Serbian hiljada/milion/dvesta) — a thin
 * numbers override (numbers.ts) over the shared agreement compositor. Croatian is written exclusively in Latin, so
 * the tokenizer is Latin-only. STRESS POSITION arrives with the shared g2p — phonemizeWord is Serbian's, and it
 * now reads the unified Serbo-Croatian stress lexicon (Wiktionary does not split sr/hr/bs, and the Ijekavian
 * lemmas hr needs are in the same dump as the Ekavian ones), including the four-way contour.
 * docs/investigations/south_slavic_stress_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { LATIN_RUN, makeNativiser } from "../../core/hostWord.ts";
import { makeSymbolNormalizer, slavicCountForm } from "../../core/normalizeSymbols.ts";
import { foreignLetters, phonemizeWord } from "../serbian/serbian.ts";
import { numberToWords } from "./numbers.ts";
import { normalizeCroatian } from "./normalize.ts";
import { MANIFEST } from "./manifest.ts";

const CLAUSE_MARK = MANIFEST.clausePunctuation;
// A Croatian word (Gaj's Latin incl. diacritics č ć š ž đ) / number / punctuation token. Latin-only: modern Croatian
// is written exclusively in Latin (the Serbian engine's Cyrillic path is not exposed here).
// the corpus groups thousands with PERIODS (2.500, 40.000) and writes decimals with COMMAS (2,4 Ghz).
// The de-grouping happens in normalize.ts; the TOKEN here swallows the comma so the tier can see the number.
const TOKEN = new RegExp(`(${LATIN_RUN})|(\\d{1,3}(?:\\.\\d{3})+(?:,\\d+)?|\\d+,\\d+|\\d+)|([.!?…,;:])`, "giu");

/**
 * This language's OWN inventory. ⚠ TWO DIFFERENT QUESTIONS, KEPT APART: the TOKEN class above decides where
 * the SCRIPT boundary falls (routing), while this one decides whether the g2p has rules for these letters. A
 * token this class REJECTS carries a letter the language does not use — i.e. a foreign name. See
 * core/hostWord.ts.
 */
const NATIVE_CLASS = "[a-zčćšžđ]";
const nat = makeNativiser(NATIVE_CLASS, "iu");

/**
 * ⟨q w x y⟩ — THE FOUR LETTERS GAJ'S LATIN DOES NOT HAVE, AND THIS ENGINE WAS DELETING.
 *
 * Found by `silentCharsIn`: ⟨w⟩ ×19 and ⟨y⟩ ×10 in the mined artifact, inert — `Downing → doninɡ`,
 * `Whitehallu → xitexallu`, `web → eb`, `Toyota → toota`, `Dylana → dlana`. Reading the same corpus by hand
 * finds the other two behaving identically: `taxi → tai`, `quiz → uiz`. One family, four letters.
 *
 * ⚠ WHY THE NATIVISER DOES NOT CATCH THEM, which is the part worth recording. `NATIVE_CLASS` above is
 * `[a-zčćšžđ]`, so ⟨q w x y⟩ are inside it and the token is never judged foreign; and even if they were
 * outside it, `foldLatinToBase` only strips ACCENTS — `w` folds to `w`, which the shared g2p still has no
 * rule for. The nativiser handles the letter that is a decorated native letter; this is the letter that is
 * simply not in the alphabet, and that needs a reading.
 *
 * ⚠ THE FLEET ALREADY AGREES, WHICH IS HOW LARGE THE HOLE IS. The same four probes across the neighbours:
 *
 *     hr  Downing → doninɡ   taxi → tai     quiz → uiz     New York → ne ork      ← this engine, before
 *     sl  Downing → dɔʋnink  taxi → taksi   quiz → kuis    New York → nɛʋ iɔrk
 *     cs  Downing → dˈovɲɪŋk taxi → tˈaksɪ  quiz → kˈuɪs   New York → nˈɛf ˈɪjork
 *     pl  Downing → dˈɔvɲiŋk taxi → tˈaksi  quiz → kˈuis   New York → nˈɛf ˈɨɔrk
 *
 * ⚠ THE READINGS ARE THE ORTHOGRAPHY'S OWN, taken from what Croatian writes when it DOES adapt the
 * spelling — which is the least speculative evidence available for how the letter is read:
 *
 *     w → v     `Wales` keeps its ⟨W⟩ but the derivatives are *Velšani*, *velški* (hr.wikipedia, Gajica)
 *     x → ks    `taxi` → *taksi*, `boxing` → *boks*
 *     qu → kv   `quiz` → *kviz*, `quality` → *kvaliteta*, `quart` → *kvart*
 *     q → k     the residue, when no ⟨u⟩ follows
 *     y → i     `Dylan` → *Dilan*, `Barry` → *Bari*
 *
 * The letters themselves are documented as outside the alphabet and used only in foreign material —
 * *Hrvatski pravopis* (pravopis.hr/slova): "Pri abecediranju q dolazi iza p, a w, x, y iza v", "U pisanju
 * stranih imena i stranih riječi"; hr.wikipedia (Gajica): "Slova Ww, Yy i Qq u hrvatskom jeziku koriste se
 * samo pri pisanju stranih vlastitih imena i stranih zemljopisnih imena."
 *
 * ⚠ ⟨y⟩ IS THE ONE WITH A CONDITION, and it is taken NARROWLY. Croatian reads final ⟨-ay -ey -oy⟩ as a /j/
 * offglide — *Nestroy*, *Gray*, *Hemingway* (jezicni-savjeti.com.hr, on why no epenthetic ⟨j⟩ is inserted
 * in their oblique cases: "ni kad se završno y izgovara kao j"). Everywhere else it is the vowel /i/. So:
 * ⟨y⟩ after a vowel → ⟨j⟩, otherwise → ⟨i⟩. `Toyota` → *tojota*, `Dylana` → *dilana*.
 *
 * ⚠ WHAT THIS DELIBERATELY DOES NOT DO. It does not touch `serbian/serbian.ts`, whose `phonemizeWord` this
 * engine borrows: sr and bs share the same hole and the same fix would serve them, but they are two other
 * languages' referees and are not this change's to move. It is a SPELLING fold, not a g2p rule, for the
 * same reason — the shared g2p stays byte-identical for its other two callers.
 * ⚠ AND IT WILL BE WRONG ON FRENCH ⟨qu⟩ (`Québec` is *kebek*, not *kvebek*). That is a source-language
 * override on a proper name, a much smaller and rarer error than deleting the letter, and inventing a
 * French-name detector here would be guessing at a population the artifact does not contain.
 */

// symbol normalization — Croatian: % is "posto" (indecilnable), the units/rates/exponents follow the
// Serbian tier, and the currency signs the corpus writes (¥, $, €, £) are declared. Kept in the ENGINE
// file so the review tool's sourcing check can see the words.
export const SYMBOLS = makeSymbolNormalizer({
    // `multiply` — the word is this language's OWN, harvested from its existing `×` rule, so nothing new
    // is sourced. Declaring it HERE is what makes ASCII `x` read like `×`: `6x6 cm` was reading the `x` as a
    // LETTER NAME, and `NxN` forms outnumber `×` roughly 85 to 20 across the corpora. One word, so `by` is
    // omitted and defaults to it — this language does not split dimension from product.
    multiply: { times: "puta" },
    percent: ["posto"],
    // `jen` — the PR asked for an attestation, and there is one in the repo, from the SISTER STANDARD.
    // Croatian and Serbian are two standards of one language, and the Serbian corpus renders THIS VERY
    // FLEURS SENTENCE with the word spelled out: "od 2500 i 130.000 japanskih jena" (Cyrillic "јапанских
    // јена") where the Croatian translation writes "2.500 ¥ … 130.000 ¥". That sentence is the whole of the
    // evidence: the Serbian referee does NOT carry the word (its `jen*` entries are jendek/jenjati), so the
    // attestation is the corpus's genitive plural *jena*, which is the lemma in one of its forms.
    currency: { "¥": ["jen"], "$": ["dolar", "dolara"], "€": ["euro"], "£": ["funta"] },
    units: {
        km: ["kilometar", "kilometra", "kilometara"],
        m: ["metar", "metra", "metara"],
        mm: ["milimetar", "milimetra", "milimetara"],
        cm: ["centimetar", "centimetra", "centimetara"],
        mi: ["milja", "milje", "milja"],
        ghz: ["gigaherc", "gigaherca", "gigaherca"],
    },
    unitPer: "na", // 70 km/h -> sedamdeset kilometara NA sat
    rateDenominators: { h: "sat", s: "sekunda" },
    exponentWords: {
        squared: ["kvadratni", "kvadratna", "kvadratnih"],
        cubed: ["kubni", "kubna", "kubnih"],
        position: "before",
    },
    countForm: slavicCountForm,
});

class CroatianPhonemizer implements Phonemizer {
    text(input: string): string {
        // normalize.ts FIRST, then the shared symbol tier — normalize's ordinal/era/rate steps need the
        // number and its suffix still adjacent, which the tier would break.
        return assembleClauses(SYMBOLS(normalizeCroatian(input)), TOKEN, (m, sink) => {
            // `foreignLetters` BEFORE `nat`: the fold is spelled in Gaj's Latin, so what reaches the
            // nativiser is a word the shared g2p has rules for. See FOREIGN_LETTER.
            if (m[1]) sink.emit(phonemizeWord(nat(foreignLetters(m[1])))); // shared Serbo-Croatian g2p
            else if (m[2])
                for (const wd of numberToWords(Number(m[2].replace(/\./gu, "").replace(/,/gu, ""))).split(" ")) sink.emit(phonemizeWord(wd)); // Croatian numbers
            else if (m[3]) {
                const mk = CLAUSE_MARK[m[3]];
                if (mk) sink.pause(mk);
            }
        });
    }
}

/** Build the Croatian phonemizer (shared Serbo-Croatian g2p + Croatian cardinal numbers). */
export function createCroatian(): Phonemizer {
    return new CroatianPhonemizer();
}
