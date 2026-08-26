/**
 * Chichewa / Chinyanja (nya) phonemizer — Bantu (N31), the Latin orthography, canonical IPA.
 * A pure greedy longest-match scan over the grapheme table (manifest.ts): Chichewa is open CV with prenasalised
 * clusters as single onset units, so no coda/syllabification logic is needed. Signatures: IMPLOSIVES ⟨b d⟩→ɓ ɗ,
 * the retroflex-tap liquid ⟨l⟩=⟨r⟩→ɽ, PRENASALISED ⟨mb nd ng⟩→ᵐb ⁿd ᵑɡ (⟨ng'⟩→ŋ), aspirates ⟨ph th kh⟩→pʰ tʰ kʰ.
 * Tone (H/L) is unwritten → DEFERRED (segmental output only).
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { latinPhone } from "../../core/latinPhones.ts";
import { hostWordRun, makeNativiser } from "../../core/hostWord.ts";
import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";
import { numberToWords } from "./numbers.ts";
import { normalizeChichewa } from "./normalize.ts";
import { MANIFEST, GRAPHEME_KEYS } from "./manifest.ts";

const G = MANIFEST.graphemes;
const CLAUSE_MARK = MANIFEST.clausePunctuation;

/** Phonemize a single Chichewa word to canonical IPA (segmental; no tone — Chichewa tone is unwritten). */
export function phonemizeWord(word: string): string {
    const w = word.toLowerCase();
    let out = "";
    let i = 0;
    while (i < w.length) {
        let matched = false;
        for (const key of GRAPHEME_KEYS) {
            if (w.startsWith(key, i)) {
                out += G[key]!;
                i += key.length;
                matched = true;
                break;
            }
        }
        // ⚠ NOT SILENTLY: a letter with no grapheme rule here still denotes a sound, and dropping it deletes
        // what the writer typed. Consulted only on the MISS branch, after every grapheme (including every
        // digraph) has been tried, so it can never override a reading this language has an opinion about.
        if (!matched) {
            out += latinPhone(w[i]!, { initial: i === 0, includeH: true }) ?? "";
            i++;
        }
    }
    return out;
}

// A word (Chichewa letters + the ⟨ng'⟩ apostrophe, incl. the typographic ’) / number / punctuation token.
const TOKEN = new RegExp(`(${hostWordRun(["Latin"], "'’")})|(\\d+)|([.!?…,;:])`, "giu");

/**
 * This language's OWN inventory. ⚠ TWO DIFFERENT QUESTIONS, KEPT APART: the TOKEN class above decides where
 * the SCRIPT boundary falls (routing), while this one decides whether the g2p has rules for these letters. A
 * token this class REJECTS carries a letter the language does not use — i.e. a foreign name. See
 * core/hostWord.ts.
 */
const NATIVE_CLASS = "[a-z'’]";
const nat = makeNativiser(NATIVE_CLASS, "iu");

/**
 * The shared symbol tier. EVERY WORD BELOW IS A CORPUS OR ny.wikipedia TOKEN read in its own slot — espeak
 * ships no Chichewa at all, so the corpus, the referee lists and `attest.ts` are the whole haystack.
 *
 * · `percent` — *peresenti* ×33 in 19 articles, ALWAYS after the number (*85 peresenti ya anawo*,
 *   *7.8 peresenti*), and twice in the nya corpus itself (*75 peresenti ya anthu*). Hence no
 *   `percentPrefix`, unlike Swahili's *asilimia 31*: the two Bantu languages differ here and the corpus
 *   says which is which. (`pa zana`, "out of a hundred", occurs once — a Metacritic score — and is the
 *   compositional alternative, not the loan the language actually writes.)
 * · `currency` / `currencyPrefix` — *madola* ×29 in 19 articles, in monetary amounts and BEFORE the
 *   number: *madola 195*, *madola 50 mpaka 100*, *madola a ku America 0.58*. *mapaundi* ×3 in 2 articles,
 *   of which two are Nyasaland stamp denominations (*kuyambira ndalama imodzi mpaka mapaundi khumi*) and
 *   one is DNA base PAIRS mistranslated — 2 of 3 in the monetary sense, which is what closes `£`.
 *   ⚠ `€` IS DELIBERATELY ABSENT. See normalize.ts's header: one hit, one article, and that article is
 *   machine-translated. A dropped sign is missing; a wrong currency word is confidently wrong.
 *   ⚠ NO `US$` COMPOUND KEY IS NEEDED: this corpus always writes the code SPACED (`US $ 50,000`,
 *   `US $200 miliyoni`), so the bare `$` is not letter-bounded and matches on its own.
 * · `units` / `unitPrefix` — a measure noun heads its phrase in Chichewa exactly as in Swahili:
 *   *makilomita 402*, *ma kilomita 1200*, *mamita 108*, *mphindi 12*, *maola 20*, *madola 195*. Every
 *   plain-unit instance in both sources takes that order.
 *   ⚠ BARE `m` IS NOT DECLARED, though *mamita* is the best-attested unit word of the lot. The blocker is
 *   the KEY, not the word: Chichewa's locative prefix `m'` defeats the tier's `(?![\p{L}\p{M}])` guard, 6
 *   instances against 3 genuine metres. It is claimed locally instead — see METRE in normalize.ts.
 *   ⚠ `milimita` IS COMPOSED, not attested: ny.wikipedia has zero hits, and this is Chichewa's own SI
 *   pattern (*sentimita*, *makilomita*, *mamita*) applied to `mili-`. The corpus writes `mm` 3 times
 *   (`500mm - 1200mm`, `1200 mm`), so the alternative is leaving them as a raw [mm] cluster.
 *   `kg`, `ft`, `in`, `oz` are NOT declared — no Chichewa word for any of them is attested anywhere, and
 *   `kg` does not occur digit-adjacent in the corpus at all.
 * · `unitPer` / `rateDenominators` — *"321 miles pa ola (517 kilomita pa ola)"* on ny.wikipedia gives the
 *   whole rate construction in one sentence: the connective is the ordinary preposition *pa* and the
 *   denominator noun is *ola*. ⚠ ROBUSTNESS, NOT A MEASURED REPAIR: the nya corpus contains no `km/h` at
 *   all, so no corpus reading changes — said here rather than left to look like a defect fix (trap 22).
 * · `magnitudes` IS DELIBERATELY WITHHELD, and the corpus is what decided it. The field makes the magnitude
 *   hop to the currency word's side of the number, which is right for the languages that write
 *   *cinco millones de dólares* — and wrong for this one. Chichewa's order is NOUN + NUMBER + MAGNITUDE,
 *   36 instances and no counter-example: *matani 1.3 miliyoni*, *makilomita 4 biliyoni*, *anthu 739-743
 *   miliyoni*, *Mafayilo 5 miliyoni*, *£ 12.24 miliyoni*. Declared, `$ 350 miliyoni` read *madola miliyoni
 *   350*; withheld, the tier attaches only the noun and the magnitude stays where the writer put it —
 *   *madola 350 miliyoni*. `madola miliyoni` and `miliyoni madola` are both ×0 on ny.wikipedia.
 *   ⚠ THE PLAYBOOK'S "one declaration, two consumers" WARNING WAS CHECKED, NOT ASSUMED: the field also
 *   gates the UNIT path's connective hop, so withholding it would break a `2,2 miliyoni km²` shape. That
 *   shape is ×0 in this corpus — every magnitude here is followed by a noun or a clause, never by a unit
 *   abbreviation — so the second consumer loses nothing.
 * · `exponentWords` — *sikweya* ×3 on ny.wikipedia, of which 2 are the collocation `sikweya makilomita`
 *   (the third is the SHAPE, an aspect ratio `mu sikweya (1: 1)` — trap 37 again), and the same
 *   collocation twice in the nya corpus. `km²` occurs 9 times and read as a raw `km` with the exponent
 *   gone.
 *   ⚠ POSITION IS `before` THE UNIT NOUN, which `sikweya makilomita` fixes directly. What it does NOT
 *   settle is where the NUMBER goes: both corpus instances write it first (*10.180.000 sikweya
 *   makilomita*), where `unitPrefix` puts it last. Those two sentences are from the visibly
 *   machine-translated Europe/North-America articles ("Europe ndi yachiwiri zing'onozing'ono Africa ndi
 *   padziko area"), and a parallel corpus can be wrong in exactly the cell you are reading — so the
 *   language's dominant measure-noun order wins and the divergence is recorded here.
 * · `ampersand` IS NOT DECLARED — 6 of the corpus's 14 ampersands are `&nbsp;`, which the tier would read
 *   as "ndi nbsp". The entity table must be consulted first, so the sign is handled in normalize.ts.
 */
const SYMBOLS = makeSymbolNormalizer({
    percent: ["peresenti"],
    currency: { "$": ["madola"], "£": ["mapaundi"] },
    currencyPrefix: true,
    // ⚠ ⟨kg⟩ ⟨g⟩ ⟨l⟩ ⟨ha⟩ — THE MASS/VOLUME/AREA HALF OF THE DEFECT THIS FILE ALREADY NAMES FOR ⟨cm⟩.
    // `10 kg` read *kʰumi kɡ* and `10 ha` *kʰumi ha*, which is the same failure as the 150cm one recorded
    // in the header: a pronounceable letter run, no ASCII surviving, nothing vanishing, invisible to every
    // gate in the tree. `tools/normalization/misread.ts` is the probe that finds it.
    // ⚠ ny.WIKIPEDIA IS BARREN FOR ALL FOUR AND THAT IS NOT AN ANSWER ABOUT CHICHEWA. `attest.ts` returns
    // 0 token hits for makilogalamu, kilogalamu, malita, lita, magalamu, galamu and hekitala; `gramu`'s
    // single hit is INSTAGRAM ("IG, Insta kapena gramu"), the trap-37 shape. The evidence is therefore
    // corpus evidence from outside the wiki, every sentence read for its sense:
    //   makilogalamu  Chichewa Chalero NT, Rev 6:6, giving BOTH numbers in one verse — "Kilogalamu imodzi
    //                 ya tirigu … makilogalamu atatu a barele"; John 19:39 "wolemera pafupifupi
    //                 makilogalamu 32"; corroborated in the independent JW Chichewa rendering of Rev 6:6,
    //                 so it is not one translator's coinage; and a Malawian agricultural-extension corpus
    //                 writes it as a rate — "makilogalamu 2000 pa hekitala imodzi"
    //   mahekitala    MBC (the state broadcaster), Chichewa news — "chimanga chomwe analima pa mahekitala
    //                 240"; the same extension corpus uses `pa hekitala` as the per-hectare idiom
    //                 throughout; and ny.wikipedia's one hit glosses it against the sign, "mahekitala
    //                 makumi asanu ndi atatu (89 hectares)"
    //   malita        Chichewa Chalero NT, John 2:6 "Uliwonse unali ndi malita 100 kapena kupitirirapo",
    //                 and a Malawian newspaper quoting a dairy farmer — "patsiku ndimagulitsa malita 18"
    //   magalamu      ⚠ THE THIN ONE, recorded as thin: ONE sentence, from the extension corpus — "Ikani
    //                 magalamu 15 pa phando" (apply 15 g per planting station). Unambiguously the mass
    //                 unit, and morphologically the stem inside the well-attested makilogalamu, but there
    //                 is no second sentence and no dictionary entry. Declared because the corpus DOES
    //                 write the key — `25.5 g (0,60 mpaka 0,90 oz)`, a genuine gram glossed against
    //                 ounces — so refusing leaves a live defect to protect a word that was read.
    // ⚠ ⟨lita⟩ AND ⟨litala⟩ ARE NOT THE LITRE, and the monolingual Mtanthauziramawu wa Chinyanja says so:
    // `lita` is a VERB (to bend without snapping) and `litala` a class-5 noun for the grass hut put over a
    // termite mound. Only the `ma-` form carries the litre, which is the sn `marita`/`lita` trap met from
    // the other side — there the plural was unavailable, here the SINGULAR is.
    // ⚠ ⟨ekala⟩ STAYS THE ACRE, confirmed rather than assumed: the dictionary defines it in yards, and the
    // extension corpus contrasts the two in one breath at the correct 2.47 ratio — "18500 pa hekitala
    // kapena 7400 pa ekala". So the hectare could not be taken from the word this corpus writes most.
    // ⚠ Plural forms throughout, matching `makilomita`/`mailosi`, and `unitPrefix` below already puts the
    // noun BEFORE its number — which is the order every sourced sentence above uses (`mahekitala 240`,
    // `makilogalamu 32`, `malita 100`, `magalamu 15`).
    // ⚠ The one-letter key ⟨l⟩ is measured, not assumed (trap 46): `<digit> l` is ×0 in the artifact, as
    // is `<digit> L`, and Chichewa declares no `magnitudes` at all (the header records why), so no ligated
    // linker can put a stray letter where the tier expects a unit — the trap that refused Tagalog's ⟨g⟩.
    units: { km: ["makilomita"], cm: ["sentimita"], mm: ["milimita"], mi: ["mailosi"],
        kg: ["makilogalamu"], g: ["magalamu"], l: ["malita"], L: ["malita"], ha: ["mahekitala"] },
    unitPrefix: true,
    unitPer: "pa",
    rateDenominators: { h: "ola" },
    exponentWords: { squared: ["sikweya"], position: "before" },
});

class ChichewaPhonemizer implements Phonemizer {
    text(input: string): string {
        // ⚠ THE TIER RUNS FIRST AND `normalizeChichewa` SECOND — the Swahili order, not the Xhosa one.
        // The decimal spell-out has to happen AFTER a percent/currency/unit word is attached, or the tier
        // sees `66 7 %` with no number beside the sign; de-grouping is unaffected by the order because it
        // keys on the digit run alone, which the tier leaves intact. Documented at length in normalize.ts.
        return assembleClauses(normalizeChichewa(SYMBOLS(input)), TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(nat(m[1]).replace(/’/gu, "'")));
            else if (m[2])
                for (const wd of numberToWords(Number(m[2]), m[2]).split(" ")) sink.emit(phonemizeWord(wd));
            else if (m[3]) {
                const mk = CLAUSE_MARK[m[3]];
                if (mk) sink.pause(mk);
            }
        });
    }
}

/** Build the Chichewa phonemizer (greedy rule g2p; tone deferred). */
export function createChichewa(): Phonemizer {
    return new ChichewaPhonemizer();
}
