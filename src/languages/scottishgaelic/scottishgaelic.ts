/**
 * Scottish Gaelic / Gàidhlig (gd) phonemizer — Goidelic Celtic (sibling of Irish), canonical IPA.
 * A rule-based grapheme scan on the BROAD/SLENDER axis ("caol le caol": a consonant is velarized
 * [Cˠ]/dental next to a/o/u, palatalized [Cʲ] next to e/i), self-contained (Irish's engine is lexicon-bound and
 * diverges on the values below, so this isolates it). The Scottish hallmarks:
 *   ⚠ PRE-ASPIRATION: a medial/final fortis ⟨p t c⟩ → [hp ht̪ xk] (mac→maxk, cat→kʰaht̪); word-initial → the
 *      aspirated [pʰ t̪ʰ kʰ].
 *   ⚠ ⟨b d g⟩ → the UNASPIRATED lenis [p t̪ k] (NOT Irish's voiced [bˠ d̪ˠ ɡ]).
 *   · ⟨ao⟩ → [ɯː] (the signature vowel).
 * First-syllable stress (native default); unstressed short vowels reduce to [ə]. The data (broad/slender maps,
 * lenition digraphs, vowel clusters) lives in scottishgaelic.jsonc. Referee: wikipron gla_latn_broad (human,
 * MULTI-DIALECT).
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { hostWordRun, makeNativiser } from "../../core/hostWord.ts";
import { loadManifest } from "../../core/loadManifest.ts";
import { makeNumberToWords, type GaelicNumbers } from "./numbers.ts";
import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";
import { normalizeScottishGaelic } from "./normalize.ts";

interface GaelicManifest {
    slenderVowels: string;
    broadVowels: string;
    sonorants: readonly string[];
    broad: Record<string, string>;
    slender: Record<string, string>;
    lenition: Record<string, [string, string]>;
    vowels: Record<string, string>;
    numbers: GaelicNumbers;
    clausePunctuation: Record<string, string>;
}
const M = loadManifest<GaelicManifest>(import.meta.url, "scottishgaelic.jsonc");
const VOWELS = M.slenderVowels + M.broadVowels;
const VOWEL_CLUSTERS = Object.keys(M.vowels).sort((a, b) => b.length - a.length);
const isVowel = (c: string): boolean => c !== "" && VOWELS.includes(c);
const isSlenderV = (c: string): boolean => c !== "" && M.slenderVowels.includes(c);

interface Seg { ph: string; nucleus: boolean }

/** Is the consonant at index i SLENDER? Its quality comes from the immediately adjacent vowel LETTER — the one
 *  right after (onset) else right before (coda); ⟨s⟩ is broad before another consonant; a coda cluster with no
 *  following vowel is broad. */
function consonantSlender(w: string, i: number): boolean {
    if (w[i] === "r" && i === 0) return false; // word-initial r → broad
    const nx = w[i + 1] ?? "", pv = w[i - 1] ?? "";
    if (isVowel(nx)) return isSlenderV(nx);
    if (isVowel(pv)) return isSlenderV(pv);
    if (w[i] === "s") return false;
    for (let j = i + 1; j < w.length; j++) if (isVowel(w[j]!)) return isSlenderV(w[j]!);
    return false;
}

/** Scan a lowercased Scottish Gaelic word into segments (lenition digraphs → broad/slender consonants → vowel
 *  clusters). */
function scan(word: string): Seg[] {
    const w = word.normalize("NFC").toLowerCase();
    const n = w.length;
    const segs: Seg[] = [];
    const cons = (ph: string): void => { if (ph) segs.push({ ph, nucleus: false }); };
    let i = 0;
    while (i < n) {
        const c = w[i]!;
        const two = w.slice(i, i + 2);
        // word-final ⟨dh⟩/⟨gh⟩ → silent (the -idh/-adh endings): the exposed nucleus reduces to schwa.
        if ((two === "dh" || two === "gh") && i + 2 === n && segs.length > 0) { i += 2; continue; }
        // lenition digraphs (séimhichte): bh ch dh fh gh mh ph sh th.
        if (M.lenition[two]) {
            cons(M.lenition[two]![consonantSlender(w, i) ? 1 : 0]);
            i += 2;
            continue;
        }
        // doubled consonant (ll/nn/rr) → a single quality-determined consonant.
        if (c === w[i + 1] && !isVowel(c) && !M.lenition[two]) {
            const map = consonantSlender(w, i) ? M.slender : M.broad;
            if (map[c]) cons(map[c]!);
            i += 2;
            continue;
        }
        // vowel clusters (longest-match) → the pronounced nucleus.
        if (isVowel(c)) {
            const key = VOWEL_CLUSTERS.find((k) => w.startsWith(k, i));
            if (key) { segs.push({ ph: M.vowels[key]!, nucleus: true }); i += key.length; continue; }
            segs.push({ ph: c, nucleus: true }); i++; continue;
        }
        // single consonants: broad or slender.
        const map = consonantSlender(w, i) ? M.slender : M.broad;
        if (map[c]) cons(map[c]!);
        else if (/[a-z]/.test(c)) cons(c);
        i++;
    }
    return segs;
}

// Fortis stops carry the aspiration mark ʰ from the manifest. Word-INITIALLY they stay aspirated [pʰ t̪ʰ kʰ];
// after a vowel/sonorant they PRE-ASPIRATE — the velar to [xk], the SLENDER (palatal) to [ç]+stop, the others
// to [h]+stop (mac→maxk, cat→kʰaht̪, aice→açkʲ, bhite→viçtʲ); after an obstruent (s) they DE-aspirate (asta→as̪t̪).
// The pre-aspirated fortis forms: the DORSAL (c) fricates to [ç]/[x], the CORONAL/LABIAL take a plain [h] (the
// palatal ç is dorsal-specific — slender ⟨t⟩ → [htʲ], NOT [çtʲ]; slender ⟨c⟩ → [çkʲ]).
const PREASP: Record<string, string> = { "pʰ": "hp", "t̪ʰ": "ht̪", "tʲʰ": "htʲ", "kʰ": "xk", "kʲʰ": "çkʲ" };
const DEASP: Record<string, string> = { "pʰ": "p", "t̪ʰ": "t̪", "tʲʰ": "tʲ", "kʰ": "k", "kʲʰ": "kʲ" };
// Sonorant phones after which pre-aspiration is a valid site (plus any vowel nucleus): the LIQUIDS l/r only —
// NOT the nasals (post-nasal fortis stays plain: annta→an̪t̪ə, cainnt→kaɲtʲ — the fortis de-aspirates there).
const SONORANT = new Set(M.sonorants);
/** PRE-ASPIRATION: a non-initial fortis stop pre-aspirates after a vowel/liquid, else de-aspirates. */
function preaspirate(segs: Seg[]): void {
    for (let i = 1; i < segs.length; i++) {
        const ph = segs[i]!.ph;
        if (PREASP[ph] === undefined) continue;
        const prev = segs[i - 1]!;
        const site = prev.nucleus || SONORANT.has(prev.ph);
        segs[i]!.ph = site ? PREASP[ph]! : DEASP[ph]!;
    }
}

const SHORT = new Set(["a", "e", "ɛ", "i", "ɪ", "ɔ", "o", "u", "ʊ"]);

/** ⟨chd⟩ / ⟨cht⟩ cluster → [xk]: a dental stop [t̪]/[tʲ] right after [x]/[ç] surfaces as [k] (bochd→pɔxk,
 *  luchd→l̪ˠuxk) — the SG ⟨-chd⟩ ending. */
function chdCluster(segs: Seg[]): void {
    for (let i = 1; i < segs.length; i++) {
        const prev = segs[i - 1]!.ph;
        if ((prev === "x" || prev === "ç") && (segs[i]!.ph === "t̪" || segs[i]!.ph === "tʲ")) segs[i]!.ph = "k";
    }
}

/** One Scottish Gaelic word → canonical IPA. Stress the first nucleus; other short-vowel nuclei reduce to [ə]. */
export function phonemizeWord(word: string): string {
    const segs = scan(word.replace(/['’\-]/gu, ""));
    if (segs.length === 0) return "";
    preaspirate(segs);
    chdCluster(segs);
    const nucleiIdx = segs.map((s, i) => (s.nucleus ? i : -1)).filter((i) => i >= 0);
    if (nucleiIdx.length === 0) return segs.map((s) => s.ph).join("");
    const stress = nucleiIdx[0]!;
    for (const idx of nucleiIdx) if (idx !== stress && SHORT.has(segs[idx]!.ph)) segs[idx]!.ph = "ə";
    let out = "";
    for (let i = 0; i < segs.length; i++) { if (i === stress) out += "ˈ"; out += segs[i]!.ph; }
    return out;
}

const CLAUSE_MARK = M.clausePunctuation;

/**
 * SYMBOL NORMALIZATION — Scottish Gaelic. Every word is a gd.wikipedia TOKEN attestation whose examples
 * were read (see normalize.ts's header and docs/investigations/gd_normalization_investigation.md):
 *   `sa cheud` ×7/4 — "Tha a' Ghàidhlig aig **deich sa cheud** duine", "**10 sa cheud** dhiubh"
 *   `not` ×19 — and the currency article names the sign: "Punnd Sasannach (**GB£**, “**not**”)"
 *   `ceàrnagach` ×26/20 — and the corpus glosses its own abbreviation in one sentence: "an fharsaingeachd
 *     de 551,695 **cilemeatair ceàrnagach (km²)**", which fixes the word AND its position, after the noun
 *   `cilemeatair` ×35 · `meatair` ×42 · `cileagram` ×5 · `dolar` ×11
 *
 * ⚠ GAELIC HAS NO NUMBER AGREEMENT ON A COUNTED NOUN — it stays singular after any numeral (`còig
 * cilemeatair`, never *còig cilemeatairean*) — so every entry is a ONE-element `CountForms` array and the
 * tier's default `countForm` always picks it. Same shape as the Turkic layers, not the Romance ones.
 *
 * ⚠ AND `ceum` IS NOT DECLARED FOR DEGREES. All 43 of its attestations are the ACADEMIC degree ("rinn e
 * ceum ann am matamataig"); `ceum Celsius`, `ceumannan Celsius` and `ìre Celsius` all score 0. The 358
 * degrees stay unread and visible to the RAWMARK gate rather than acquiring a reading that means
 * "university degree Celsius" — the Fula `tere` lesson.
 */
const SYMBOLS = makeSymbolNormalizer({
    percent: ["sa cheud"],
    // ⚠ `Euro` IS THE CORPUS'S OWN SPELLING, not an invented Gaelicisation: `eòro` scores 0 everywhere
    // (corpus, artifact, referee, lexicon, wikipedia) and the sourcing gate said so. The corpus's currency
    // list writes it in the English form — "Dolar (US$) Euro Punnd Sasannach (GB£, “not”)" — the same
    // sentence that sources `not`, so that is what ships. `€` ×3 in the retained text.
    currency: { "£": ["not"], "$": ["dolar"], "€": ["Euro"] },
    units: {
        km: ["cilemeatair"], cm: ["ceudameatair"], mm: ["milemeatair"], kg: ["cileagram"],
        m: ["meatair"], g: ["gram"],
    },
    // Gaelic puts the measure adjective AFTER the noun — *cilemeatair ceàrnagach* — the corpus's own gloss.
    exponentWords: { squared: ["ceàrnagach"], cubed: ["ciùbach"], position: "after" },
    // THE RATE, and both halves are sourced with the notation glossed beside them:
    //   `san uair` ×2 — "a bha air siubhal aig deich air fhichead mile 'san uair" (thirty miles per hour)
    //   `diog` ×29 — and the physics article reads the sign: "aonadan de meatairean anns an diog (m/s)"
    // `san` is the contraction of `anns an`, which is the form that second quotation writes out.
    unitPer: "san",
    rateDenominators: { h: "uair", u: "uair", s: "diog" },
    // `&` ×13 in the retained text, of which 12 are HTML entities the markup pass leaves behind
    // (`&gamma;`, `&nbsp;`) and one is a real bibliographic conjunction — "Ross, R.J. & J. Hendry (deas.)".
    // `agus` is the language's own "and" and is everywhere in this corpus.
    ampersand: "agus",
    magnitudes: ["muillean", "billean"],
});
/** Integer → Scottish Gaelic numeral words (counting/attributive series + lenition; see numbers.ts). */
export const numberToWords = makeNumberToWords(M.numbers);
const TOKEN = new RegExp(`(${hostWordRun(["Latin"], "", "'’-")})|(\\d+)|([.!?…,;:])`, "gu");

/**
 * This language's OWN inventory. ⚠ TWO DIFFERENT QUESTIONS, KEPT APART: the TOKEN class above decides where
 * the SCRIPT boundary falls (routing), while this one decides whether the g2p has rules for these letters. A
 * token this class REJECTS carries a letter the language does not use — i.e. a foreign name. See
 * core/hostWord.ts.
 */
const NATIVE_CLASS = "[a-zàèìòùáéíóúA-ZÀÈÌÒÙÁÉÍÓÚ]";
const nat = makeNativiser(NATIVE_CLASS, "u");

class ScottishGaelicPhonemizer implements Phonemizer {
    text(input: string): string {
        // normalize.ts FIRST — its de-grouping, ordinal and decimal steps need the figure and its written
        // suffix still adjacent, which the tier would break — then the shared symbol tier, which matches a
        // unit only when a NUMBER is adjacent.
        return assembleClauses(SYMBOLS(normalizeScottishGaelic(input)), TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(nat(m[1])));
            // Numbers: compose the Gaelic numeral phrase, then phonemize each word through the same g2p.
            // ⚠ THE TOKEN IS PASSED AS `raw` (#1095) — the fallback cannot recover the digits from the
            // double it exists to bypass.
            else if (m[2]) for (const wd of numberToWords(Number(m[2]), m[2]).split(" ")) sink.emit(phonemizeWord(wd));
            else if (m[3]) { const mk = CLAUSE_MARK[m[3]]; if (mk) sink.pause(mk); }
        });
    }
}

/** Build the Scottish Gaelic phonemizer (broad/slender rule engine + pre-aspiration). */
export function createScottishGaelic(): Phonemizer {
    return new ScottishGaelicPhonemizer();
}
