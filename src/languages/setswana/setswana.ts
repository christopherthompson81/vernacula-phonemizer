/**
 * Setswana / Tswana (tn) phonemizer — Bantu (Sotho-Tswana, S31), the Latin orthography, canonical IPA,
 * A pure greedy longest-match scan over the grapheme table (manifest.ts): Setswana is open CV
 * with the syllabic-nasal + C clusters as onset units, so no coda/syllabification logic is needed. Signatures:
 * the uvular-fricative ⟨g⟩→χ (NO /g/ phoneme — a beyond-epitran divergence), dorsal aspirates ⟨kg kh⟩→k͡χʰ kʰ,
 * lateral affricates ⟨tl tlh⟩→t͡ɬ t͡ɬʰ, ⟨tš š⟩→t͡ʃ ʃ, ⟨ny ng⟩→ɲ ŋ. Vowels are the standard 7-vowel system
 * /i ɪ ɛ a ɔ ʊ u/ (⟨e⟩→ɪ, ⟨o⟩→ʊ, ⟨ê ô⟩→ɛ ɔ). Tone (H/L) is lexical + unwritten → DEFERRED (segmental output
 * only). Cardinal numbers via numbers.ts.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { latinPhone } from "../../core/latinPhones.ts";
import { LATIN_RUN, makeNativiser } from "../../core/hostWord.ts";
import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";
import { MANIFEST, GRAPHEME_KEYS } from "./manifest.ts";
import { numberToWords } from "./numbers.ts";
import { normalizeSetswanaPre, normalizeSetswanaPost } from "./normalize.ts";

const G = MANIFEST.graphemes;
const CLAUSE_MARK = MANIFEST.clausePunctuation;

/** Phonemize a single Setswana word to canonical IPA (segmental; no tone — Setswana tone is unwritten). */
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

// A word (Setswana letters incl. š and the ê/ô circumflex vowels) / number / punctuation token.
const TOKEN = new RegExp(`(${LATIN_RUN})|(\\d+)|([.!?…,;:])`, "giu");

/**
 * This language's OWN inventory. ⚠ TWO DIFFERENT QUESTIONS, KEPT APART: the TOKEN class above decides where
 * the SCRIPT boundary falls (routing), while this one decides whether the g2p has rules for these letters. A
 * token this class REJECTS carries a letter the language does not use — i.e. a foreign name. See
 * core/hostWord.ts.
 */
const NATIVE_CLASS = "[a-zšêô]";
const nat = makeNativiser(NATIVE_CLASS, "iu");

/**
 * The shared symbol tier's Setswana data. Every field is sourced against the mined artifact
 * (`tools/corpus/mined/tn.jsonc`) or `attest.ts` against tn.wikipedia — espeak does not ship Setswana at all
 * and Wikidata carries no tn label for any of these concepts, so those two are the whole haystack. The
 * sourcing trail is in `docs/investigations/tn/tn_normalization_investigation.md`; what a declaration turns on
 * is recorded here.
 *
 * ⚠ EVERY NOUN CARRIES ITS CONCORD COPULA, and that is data, not decoration. Of the 51 measure-noun
 * occurrences in the artifact every one is followed by one (`dikilometara di le 200`, `dimetara di le 650`,
 * `metsotswana e le 44.55`) and there are ZERO instances of a bare measure noun beside a digit. Index 0 is
 * the bare citation form — what `makeBareUnitNormalizer` emits for a symbol standing alone, where a dangling
 * copula would be ungrammatical — and index 1 the counted form. Digit-adjacent `km` is ×11 in the artifact
 * and STANDALONE `km` is ×0, so index 0 is robustness rather than a measured repair.
 */
const SYMBOLS = makeSymbolNormalizer({
    /**
     * ⚠ TWO REAL CANDIDATES, AND THE LOSER IS ALSO ATTESTED — this is picked on evidence, not on taste.
     * `mo lekgolong` ("in the hundred") is 156 tokens / 20 articles on tn.wikipedia, every readable example
     * the percent reading (*masome a le mararo mo lekgolong fela la Batswana ba ba dirisang inthanete*), and
     * the mined corpus GLOSSES it against the digit form three times: *sephatlo mo lekgolong (50%)*,
     * *bobedi mo lekgolong (2%)*, *masome a le mane le bosupa mo lekgolong (47%)*.
     * The competitor `diperesente di le N` is 59 / 20 and glossed too (*dipesente dile lesome (10%)*), but is
     * PREPOSED; `mo lekgolong` wins on 156-against-59 and needs no reordering, since it sits where the sign
     * does. ⚠ `phesente` ×2 in the corpus is the NOUN "a percentage" (*phesente e kgolo ya letseno*) — the
     * wrong slot, trap 37 — and bare `lekgolong` is the CENTURY (*mo lekgolong la bo 18 la dingwaga*). Only
     * the collocation attests.
     */
    percent: ["mo lekgolong"],
    /**
     * ⚠ `€` IS DELIBERATELY ABSENT (4 corpus instances). `diyuro` is ×0 and `yuro` is 6 tokens in 2 articles
     * of which FIVE are the UEFA football tournament; one genuine hit in one article is a lead, not a
     * finding. ⚠ `R` IS ABSENT TOO and is handled in normalize.ts, because the guard it needs — an amount
     * with a separator or a magnitude, to tell rand from a South African ROAD number (`R59, N12, N17 le N3`)
     * — is not expressible here (trap 47 reason 1).
     * `US$` is declared beside `$` because the bare sign is letter-bounded on the left and cannot match
     * inside `US$5 million`; keys are matched longest-first.
     */
    currency: {
        // attest 30/19 — *didolara di le dikete di le tlhano*, *didolara di le dimilione di le 65*
        "US$": ["didolara", "didolara di le"],
        $: ["didolara", "didolara di le"],
        // corpus: *diponto di le dikete tse tharo*; attest 28/20, every hit an amount of money
        "£": ["diponto", "diponto di le"],
        // ⚠ TRAP 37 LIVE: bare `dipula` is 61/20 and every displayed hit is RAIN — Setswana names its
        // currency after rain. Only the money frame attests: the corpus's *pampiri ya polymer ya dipula di
        // le 10* (a 10-pula note), and `dipula di le` 2/2, both money (*kotlhao … dipula di le makgolo a
        // matlhano*, *ntlo ya dipula di le dimilione di le 2 (US$312,000)*).
        // The sign is safe where `R` is not: `P` + digit is ×1 in the artifact and it is the pula
        // (`ba dirisa P4.7million`), with no counter-example of any kind.
        P: ["dipula", "dipula di le"],
    },
    /**
     * ⚠ `m³` AND `m3` ARE THEIR OWN KEYS RATHER THAN `exponentWords.cubed`, because Setswana's cube word is
     * a FUSED COMPOUND whose class prefix migrates to the front: `dikhubikimitara` is *di-khubiki-mitara*,
     * and none of the four `ExponentPosition` values produces that (`compound` gives *khubikidimetara*).
     * Attested `dikhubikimitara di le` 19 tokens / 16 articles — *bokgoni jwa dikhubikimitara di le 4 500
     * (160 000 cu ft)*, *dikhubikimitara di le 111 000 000 (3.9×10⁹ cu ft)*. The analytic variant is real
     * too (*dimetara tse di khubiki di le 6,700 (maoto a khubiki a le 240,000)*, `khubiki` 12/2) and loses on
     * article count. Keys are longest-first, so these are tried before bare `m`, and `m2` still reaches the
     * squared branch below.
     */
    units: {
        "m³": ["dikhubikimitara", "dikhubikimitara di le"],
        m3: ["dikhubikimitara", "dikhubikimitara di le"],
        // corpus, glossed against its own abbreviation: *dikhilometara di le makgolo a mabedi (200km)*;
        // attest 37/20. `dikilometara` is the majority spelling (14 of 16 artifact instances).
        km: ["dikilometara", "dikilometara di le"],
        // corpus: *dimilimitara dile 360 (360 mm)*, *dimilimithara dile makgolo a marataro le masome a
        // matlhano (650 mm)*. `dimilimetara` is the spelling the corpus also writes bare.
        mm: ["dimilimetara", "dimilimetara di le"],
        cm: ["disentimetara", "disentimetara di le"],
        // attest 30/20, every hit a weight — *bokete jwa dikilogerama di le 350 le 700*
        kg: ["dikilogerama", "dikilogerama di le"],
        // corpus, glossed against the abbreviation itself: *diheketara di le 15,254,700 (ha)*
        ha: ["diheketara", "diheketara di le"],
        // corpus: *(dimaele di le 124)* glossing `200km`, and *sekwere sa dimaele di le 224 607*
        mi: ["dimaele", "dimaele di le"],
        // ⚠ THE ONE-LETTER KEY, and the standing hazard (traps 28, 46, 52). Digit-adjacent `m` in the
        // artifact is ×15 and EVERY instance is a genuine metre — athletics distances (`400 m`, `100 m`,
        // `800 m`, `4 × 400 m`) and elevations (`915 m`, `1,500 m`). The version-dot exposure that broke af,
        // ca, is and sd is closed by ORDER rather than by luck: this layer's decimal rule runs AFTER the
        // tier, so `NOT_VERSION` still has its dot to reject. `m` as a currency SCALE (`US$1.5M`) is spent
        // in normalize.ts step 2, before this ever sees it.
        m: ["dimetara", "dimetara di le"],
    },
    /**
     * `ka` is the corpus's own "per", attested in exactly this slot and glossed: *diphefo … di ne di foka ka
     * lebelo le le fetang dikilometara di le 97 KA URA* (97 km/h), *"(10-38) ka ura"*, and for the second
     * denominator *dikhubikimitara di le makgolo a matlhano KA MOTSOTSWANA (18,000 cu ft/s)* and the mined
     * corpus's own *12-13 m3 ka motsotswana*. The same preposition carries *dilithara di le lekgolo ka
     * letsatsi* (per day).
     */
    unitPer: "ka",
    /** Denominator-only, never standalone — a bare `76s` must not become "76 seconds" (the `Il-76s` defect
     *  this field exists for), and a bare `h` is not an hour. */
    rateDenominators: { h: "ura", s: "motsotswana" },
    /**
     * ⚠ POSITION IS `before`, AND THE COMMONER ORDER IS THE ONE THE TIER CANNOT SAY. Setswana attests both:
     * postposed `dikilometara di le 34,635 TSA SEKWERE` (`tsa sekwere` 15/14, incl. *Dikilometara tse
     * makgolo a matlhano tsa sekwere (190 sq mi)*), and preposed `SEKWERE SA dimaele di le 224 607`
     * (`sekwere sa` 8/7, and that instance is the mined corpus's own gloss of Botswana's area). Postposed
     * would need noun + number + modifier, which `ExponentPosition` cannot express; preposed reproduces the
     * corpus sentence exactly once `unitPrefix` puts the phrase in front. ⚠ Declining instead is NOT neutral
     * (trap 53): with `km` declared and no square word, `604.3 km2` reads *…dikilometara di le TWO*.
     * ⚠ `cubed` is deliberately absent — see the `m³` keys. A cubed unit OTHER than `m³` (×0 in the corpus)
     * therefore falls to the tier's re-emit branch and keeps a visible `³`.
     * ⚠ `sekwere` is polysemous exactly as English "square" is — *Sekwere sa Kereke* is Church Square, a
     * plaza — so only the collocation with a measure noun attests it.
     */
    exponentWords: { squared: ["sekwere sa"], position: "before" },
    /** The measure noun HEADS its phrase in Setswana, and the currency noun with it: *dikilometara di le
     *  200*, *didolara di le 65*. Both orders are opt-in and both are needed here. */
    unitPrefix: true,
    currencyPrefix: true,
    /** ⚠ NO `magnitudes`, AND THE TRADE WAS COUNTED. Declaring them would let the tier hop a magnitude, which
     *  buys ONE reading (`30.2 million km²`) and costs 24: with `currencyPrefix` the magnitude is dragged in
     *  front of its own number, so `$145 million` would read *didolara di le million 145*. Undeclared, the
     *  magnitude stays exactly where the writer put it — *didolara di le 145 million* — and the corpus has
     *  24 currency-plus-magnitude shapes against 1 unit-plus-magnitude. */
    /** The manifest's own conjunction, the same word the number path uses for *lesome LE bongwe*. 6 real
     *  ampersands in the artifact (`Food & Agriculture Org.`, `Stewart, Tabori & Chang`, `kwena &jones
     *  shoes`, `A. C. Armstrong & Son`, `Avance Media & CELBMD Africa`, `Texas A&I`); the other 26 are HTML
     *  entities, which normalize.ts folds first. */
    ampersand: MANIFEST.numbers.and,
});

class SetswanaPhonemizer implements Phonemizer {
    text(input: string): string {
        return assembleClauses(normalizeSetswanaPost(SYMBOLS(normalizeSetswanaPre(input))), TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(nat(m[1])));
            else if (m[2]) for (const wd of numberToWords(Number(m[2]), m[2]).split(" ")) sink.emit(phonemizeWord(wd));
            else if (m[3]) {
                const mk = CLAUSE_MARK[m[3]];
                if (mk) sink.pause(mk);
            }
        });
    }
}

/** Build the Setswana phonemizer (greedy rule g2p; tone + numbers deferred). */
export function createSetswana(): Phonemizer {
    return new SetswanaPhonemizer();
}
