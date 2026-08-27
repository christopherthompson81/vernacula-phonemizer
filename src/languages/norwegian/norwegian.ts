/**
 * Native Norwegian Bokmål (nb) text phonemizer — canonical IPA. North Germanic, Latin. Urban East
 * Norwegian (standard østnorsk). A left-to-right rule g2p (norwegian.jsonc = the data) with the deep-orthography
 * machinery: COMPLEMENTARY VOWEL LENGTH on the stressed (first) syllable — open syllable → long V (short C), closed →
 * short V (long C) — which also picks the vowel QUALITY (short ⟨i⟩=ɪ vs long=iː; ⟨o⟩→uː/ʊ; ⟨u⟩→ʉː/ʉ; ⟨å⟩→oː/ɔ);
 * FRONT-VOWEL SOFTENING (sk/k/g before e i y ø æ → ʃ/ç/j) in the stressed onset; the digraphs sj/skj→ʃ, kj/tj→ç, hv→ʋ,
 * ng→ŋ; word-initial silent digraphs hj/gj/lj/dj → j; RETROFLEX r + coronal → ʈ ɳ ɭ ʂ; and SILENT ⟨d⟩ (word-final after
 * a vowel or l/n/r: god→ɡuː, land→lɑn, jord→juːr). Length ː + stress + pitch accent are folded in the referee eval.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { LATIN_RUN, makeNativiser } from "../../core/hostWord.ts";
import { renderNumber, spellDigits, westernNumberWords } from "../../core/numbers.ts";
import { normalizeNorwegian } from "./normalize.ts";
import { loadTsvMap } from "../../core/loadTsv.ts";
import { MANIFEST } from "./manifest.ts";

const V = MANIFEST.vowels;
const LONG = V.long;
const SHORT = V.short;
const LBR = V.longBeforeR;
const SBR = V.shortBeforeR;
const DIG = MANIFEST.digraphs;
const CONS = MANIFEST.consonants;
const RETRO = MANIFEST.retroflex;
const CLAUSE_MARK = MANIFEST.clausePunctuation;

const VOWEL_LETTERS = "aeiouyæøåéèêëàâôü";
const isV = (c: string): boolean => c !== "" && VOWEL_LETTERS.includes(c);
const FRONT = MANIFEST.frontVowels.toLowerCase();
const isFront = (c: string): boolean => c !== "" && FRONT.includes(c);

/** Is the stressed vowel at index i LONG? Count coda consonant LETTERS to the next vowel/word-end (a retroflex
 *  r+coronal counts as one; a silent word-final ⟨d⟩ doesn't close the syllable). 0–1 → long (open / single coda); ≥2
 *  (cluster / geminate / ng) → short. */
function stressedLong(w: string, i: number): boolean {
    let j = i + 1;
    let count = 0;
    while (j < w.length && !isV(w[j]!)) {
        // (a silent final ⟨d⟩ is NOT skipped — the historical coda still closes the syllable: god→ɡuː but hånd→hɔn)
        if (w[j] === "r" && "tnlsd".includes(w[j + 1] ?? "")) { count++; j += 2; } // r+coronal = one C (rd→r, silent d: jord→juːr)
        else if (w[j] === "x") { count += 2; j++; } // ⟨x⟩ = /ks/ closes the syllable
        else { count++; j++; }
    }
    return count <= 1;
}

/** Scan one Norwegian word → IPA (no stress mark). The first syllable carries the complementary-length contrast. */
function toSegments(word: string): string[] {
    const w = word.toLowerCase();
    const n = w.length;
    const out: string[] = [];
    let i = 0;
    let vowelOrd = 0;
    while (i < n) {
        const c = w[i]!;
        const nx = w[i + 1] ?? "";
        const nx2 = w[i + 2] ?? "";
        const two = w.slice(i, i + 2);
        const three = w.slice(i, i + 3);

        // -sjon / -tion suffix → ʃuːn (nasjon, stasjon, pensjon), gated to i>0 (a stem precedes it)
        const four = w.slice(i, i + 4);
        if (i > 0 && (four === "sjon" || four === "tion")) {
            out.push("ʃ", "uː", "n");
            vowelOrd++;
            i += 4;
            continue;
        }

        // vowel — complementary length picks quality; an UNSTRESSED ⟨e⟩ reduces to schwa (Bergen→bærɡən)
        if (isV(c)) {
            if (vowelOrd > 0 && c === "e") { out.push("ə"); vowelOrd++; i++; continue; } // unstressed ⟨e⟩ → schwa
            const long = vowelOrd === 0 && stressedLong(w, i);
            const beforeR = nx === "r";
            const ph = long ? (beforeR && LBR[c]) || LONG[c]! : (beforeR && SBR[c]) || SHORT[c]!;
            out.push(ph);
            vowelOrd++;
            i++;
            continue;
        }

        // word-initial silent digraphs: hj/gj/lj/dj → j (medially these are C + j)
        if (i === 0 && nx === "j" && "hgld".includes(c)) { out.push("j"); i += 2; continue; }

        // three-letter digraph (skj → ʃ)
        if (DIG[three]) { out.push(DIG[three]!); i += 3; continue; }

        // sk before a front vowel in the stressed onset → ʃ (else s + k)
        if (two === "sk" && vowelOrd === 0 && isFront(nx2)) { out.push("ʃ"); i += 2; continue; }

        // retroflex r + coronal → single retroflex (r absorbed)
        if (c === "r" && RETRO[two]) { out.push(RETRO[two]!); i += 2; continue; }

        // two-letter digraph (sj/kj/tj/hv/ng/gn/ck)
        if (DIG[two]) { for (const ch of DIG[two]!) out.push(ch); i += 2; continue; }

        // front-vowel softening on a single k/g in the stressed onset: k→ç, g→j
        if (vowelOrd === 0 && (c === "k" || c === "g") && isFront(nx)) { out.push(c === "k" ? "ç" : "j"); i++; continue; }

        // silent word-final ⟨d⟩ after a vowel or l/n/r (god→ɡuː, land→lɑn, jord→juːr)
        if (c === "d" && i === n - 1 && (isV(w[i - 1] ?? "") || "lnr".includes(w[i - 1] ?? ""))) { i++; continue; }

        // geminate consonant → single C + ː (short preceding vowel already set by the length rule)
        if (c === nx && !isV(c)) {
            if (c === "g") out.push("ɡː");
            else if (c === "k") out.push("kː");
            else if (CONS[c]) out.push(CONS[c]! + "ː");
            else out.push(c);
            i += 2;
            continue;
        }

        if (CONS[c]) out.push(CONS[c]!);
        i++; // unknown char → skip
    }
    return out;
}

/** One Norwegian word → canonical IPA by RULE (the OOV fallback + the non-circular eval floor): first-syllable stress
 *  over the segmental scan. Deep-orthography stress/vowel-quality that spelling underdetermines is not recoverable
 *  here — that is what the lexicon tier covers. */
export function phonemizeWordRules(word: string): string {
    const segs = toSegments(word);
    // place ˈ before the onset of the first syllable (before the first vowel phoneme, incl. its onset consonants)
    const firstV = segs.findIndex((p) => /[ɑaeɛiɪoɔuʉʊyʏøœæ]/u.test(p));
    if (firstV < 0) return segs.join("");
    // onset = the run of consonants immediately before the first vowel
    let onset = firstV;
    while (onset > 0 && !/[ɑaeɛiɪoɔuʉʊyʏøœæ]/u.test(segs[onset - 1]!)) onset--;
    return segs.slice(0, onset).join("") + "ˈ" + segs.slice(onset).join("");
}

// TIER-1 PRONUNCIATION LEXICON (nb-lexicon.tsv, from the NST National-Library lexicon, CC0, frequency-filtered to the
// ~38k common word forms → 98% of real-text tokens). NST carries the LEXICAL stress + vowel quality the deep
// orthography underdetermines (absorbere→ɑbsɔɾˈbeːɾə), so a known word is looked up at reference quality; the rule
// engine is the OOV fallback. NST is independent of Wiktionary (the referee) → non-circular.
let LEX: Map<string, string> | undefined;
/** ⚠ EXPORTED FOR `test/lexicon-reachability.test.ts` — see swedish.ts. */
export function lexicon(): Map<string, string> {
    if (LEX === undefined) LEX = loadTsvMap(import.meta.url, "nb-lexicon.tsv", undefined,
        // ⚠ #1068: alias each key to its nativised spelling — `text()` folds before it looks up. 14 keys,
        // `señor`, `malmö`, `göring` among them.
        { optional: true, fold: (k) => nat(k) });
    return LEX;
}

/** The NST pronunciation lexicon (lowercased word → canonical IPA). Exposed so the async neural path (nbNeural.ts)
 *  can skip lexicon-covered words — they are served authoritatively by the sync lexicon path. */
export function norwegianLexicon(): Map<string, string> {
    return lexicon();
}

/** Per-call OOV resolver: word → IPA, or undefined to defer to the rule engine. Consulted BETWEEN the lexicon and the
 *  rule engine (lexicon → oovOverride → rules). Used only by the async neural path (nbNeural.ts) to inject the BiLSTM
 *  tagger's OOV readings; the sync path passes nothing, so behaviour is unchanged. */
export type OovResolver = (word: string) => string | undefined;

/** One Norwegian word → canonical IPA. TIER 1 lexicon (NST, known words at reference quality) → TIER 2 oovOverride
 *  (neural tagger, async path only) → TIER 3 rule fallback. */
export function phonemizeWord(word: string, oovOverride?: OovResolver): string {
    const hit = lexicon().get(word.toLowerCase());
    if (hit !== undefined) return hit;
    return oovOverride?.(word) ?? phonemizeWordRules(word);
}

/**
 * This language's OWN inventory. ⚠ TWO DIFFERENT QUESTIONS, KEPT APART: the TOKEN class below decides where
 * the SCRIPT boundary falls (routing), while this one decides whether the g2p has rules for these letters. A
 * token this class REJECTS carries a letter the language does not use — i.e. a foreign name, which `nat`
 * then folds to a base the g2p does have a rule for. See core/hostWord.ts.
 */
const NATIVE_CLASS = "[A-Za-zÆØÅæøåÉéÈèÊêËëÀàÂâÔôÜü]";
/** ⚠ EXPORTED FOR `test/lexicon-reachability.test.ts`, which asserts that every key in this engine's
 *  lexicons survives its own fold. A key the fold rewrites can never be matched from `text()`, and both
 *  engines agree on the miss, so the parity gate cannot see it (#1068). */
export const nat = makeNativiser(NATIVE_CLASS, "u");

// ⚠ ALL OF LATIN, not just this language's own letters — the narrow class ended the token at an
// out-of-inventory diacritic, so that letter became an unclaimed gap read as an English LETTER NAME and the
// rest of the word started over: `São Paulo` fragmented into three pieces, none of them right. Invisible to
// every gate: no digit or raw mark survives and nothing VANISHES.
const TOKEN = new RegExp(`(${LATIN_RUN})|(\\d+)|([.?!,;:…—])`, "gu");

// Number words (en, hundre, tusen, …) are all in the lexicon, so they never reach the oovOverride tier — the sync
// phonemizeWord is correct here and the neural path's tagged map (populated only from input tokens) never holds them.
function number(digits: string): string {
    const nn = Number(digits);
    // ⚠ ABOVE 2^53 THE RAW ASCII DIGITS USED TO LEAK STRAIGHT INTO THE IPA. `isSafeInteger` is right to
    // refuse to COMPOSE — the float has already lost the low digits, so the numeral would be confidently
    // wrong — but the refusal returned the digit string, which no g2p in this fleet reads. Read it out
    // digit-at-a-time through this engine's own number words instead; see core/numbers.ts `spellDigits`
    // for the full account and the cost (above 2^53 the reading is a digit string, not a quantity).
    if (!Number.isSafeInteger(nn)) return spellDigits(digits, MANIFEST.numbers, phonemizeWord);
    return renderNumber(nn, MANIFEST.numbers, phonemizeWord, westernNumberWords);
}

class NorwegianPhonemizer implements Phonemizer {
    // `oovOverride` (neural path only) resolves OOV words between the lexicon and the rule engine; the sync path omits
    // it, so tokenizer / numbers / clause assembly are byte-identical to phonemize(text, "nb").
    text(rawInput: string, oovOverride?: OovResolver): string {
        // everything the g2p cannot read is rewritten to Norwegian words FIRST — see normalize.ts
        // for the ordered steps and the three measured disambiguations.
        return assembleClauses(normalizeNorwegian(rawInput), TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(nat(m[1]), oovOverride));
            else if (m[2]) sink.emit(number(m[2]));
            else if (m[3]) {
                const mk = CLAUSE_MARK[m[3]];
                if (mk) sink.pause(mk);
            }
        });
    }
}

/** Build the Norwegian Bokmål phonemizer. The returned `text` takes an optional per-call `oovOverride` (neural path
 *  only) that injects tagger readings for OOV words (lexicon → oovOverride → rules); still assignable to Phonemizer. */
export function createNorwegian(): { text(input: string, oovOverride?: OovResolver): string } {
    return new NorwegianPhonemizer();
}
