/**
 * Native Swahili / Kiswahili (sw) text phonemizer — canonical IPA. Bantu, but with a highly
 * PHONEMIC shallow Latin orthography and (unusually) NO tone — just regular penultimate stress. A rule-based g2p
 * (the id/tl pattern) with Swahili's distinctive segments: the plain voiced stops are IMPLOSIVES (b→ɓ d→ɗ j→ʄ
 * g→ɠ), PRENASALIZED stops are one segment with a homorganic superscript nasal (mb→ᵐb, nd→ⁿd, nj→ⁿd͡ʒ, ng→ᵑɡ),
 * ⟨ng'⟩→ŋ is DISTINCT from ⟨ng⟩→ᵑɡ, a nasal before another consonant is SYLLABIC (mtu→m̩tu, nchi→n̩t͡ʃi), and the
 * Arabic-loan fricatives dh/th/gh/kh→ð/θ/ɣ/x. Vowels [a e i o u].
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { hostWordRun, makeNativiser } from "../../core/hostWord.ts";
import { loadManifest } from "../../core/loadManifest.ts";
import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";
import { normalizeSwahili } from "./normalize.ts";

interface NumbersDef {
    units: string[];
    ten: string;
    tens: Record<string, string>;
    hundred: string;
    thousand: string;
    million: string;
    and: string;
}
interface SwahiliDef {
    velarNasal: string;
    prenasal: Record<string, string>;
    digraphs: Record<string, string>;
    consonants: Record<string, string>;
    vowels: Record<string, string>;
    clausePunctuation: Record<string, string>;
    numbers: NumbersDef;
}
const DEF = loadManifest<SwahiliDef>(import.meta.url, "swahili.jsonc");
const CLAUSE_MARK = DEF.clausePunctuation;
const NUM = DEF.numbers;
const TWO = { ...DEF.prenasal, ...DEF.digraphs }; // all 2-letter graphemes
const VOWEL_LETTER = "aeiou";
const isConsonantLetter = (c: string): boolean =>
    /[a-z]/u.test(c) && !VOWEL_LETTER.includes(c);

interface Seg {
    ph: string;
    nucleus: boolean; // a vowel or a syllabic nasal — bears stress
}

/** Scan a lowercased Swahili word into segments (ng' → prenasal digraphs → consonant digraphs → singles). */
function scan(w: string): Seg[] {
    const s = [...w];
    const n = s.length;
    const segs: Seg[] = [];
    for (let i = 0; i < n; ) {
        // ⟨ng'⟩ → ŋ (velar nasal) — before ⟨ng⟩ (prenasalized ᵑɡ).
        if (w.startsWith(DEF.velarNasal, i)) {
            segs.push({ ph: "ŋ", nucleus: false });
            i += DEF.velarNasal.length;
            continue;
        }
        const two = s[i]! + (s[i + 1] ?? "");
        if (TWO[two]) {
            segs.push({ ph: TWO[two]!, nucleus: false });
            i += 2;
            continue;
        }
        const c = s[i]!;
        if (VOWEL_LETTER.includes(c)) {
            // Two identical adjacent vowels (⟨aa⟩ ⟨ee⟩ …) are one LONG vowel (kuu→kuː, taa→taː).
            const long = s[i + 1] === c;
            segs.push({ ph: DEF.vowels[c]! + (long ? "ː" : ""), nucleus: true });
            i += long ? 2 : 1;
        } else if (
            c === "w" &&
            segs.length > 0 &&
            !segs[segs.length - 1]!.nucleus &&
            VOWEL_LETTER.includes(s[i + 1] ?? "")
        ) {
            // ⟨w⟩ after a consonant onset, before a vowel → labialization on that consonant (kweli→kʷeli, mwezi→mʷezi).
            segs[segs.length - 1]!.ph += "ʷ";
            i++;
        } else if (c === "m" || c === "n") {
            // A nasal before another (non-glide) consonant is SYLLABIC; before a vowel/glide it is a plain onset.
            const nx = s[i + 1];
            const syllabic =
                nx === undefined || (isConsonantLetter(nx) && nx !== "w" && nx !== "y");
            segs.push({ ph: syllabic ? c + "̩" : c, nucleus: syllabic });
            i++;
        } else if (c in DEF.consonants) {
            segs.push({ ph: DEF.consonants[c]!, nucleus: false });
            i++;
        } else i++; // unknown → skip
    }
    return segs;
}

/** One Swahili word → canonical IPA (penultimate stress). */
export function phonemizeWord(word: string): string {
    const segs = scan(word.toLowerCase());
    if (segs.length === 0) return "";
    const nuclei = segs
        .map((sg, i) => (sg.nucleus ? i : -1))
        .filter((i) => i >= 0);
    // Penultimate stress (regular); a monosyllable is stressed on its only nucleus.
    const stress =
        nuclei.length >= 2 ? nuclei[nuclei.length - 2]! : nuclei[0] ?? -1;
    let out = "";
    for (let i = 0; i < segs.length; i++) {
        if (i === stress) out += "ˈ";
        out += segs[i]!.ph;
    }
    return out.normalize("NFC");
}

// ── Numbers (standard Swahili, joined by "na") ────────────────────────────────
function belowHundred(n: number): string {
    if (n === 0) return "";
    if (n < 10) return NUM.units[n]!;
    if (n === 10) return NUM.ten;
    if (n < 20) return `${NUM.ten} ${NUM.and} ${NUM.units[n - 10]}`;
    const t = Math.floor(n / 10),
        u = n % 10;
    return NUM.tens[String(t)]! + (u ? ` ${NUM.and} ${NUM.units[u]}` : "");
}
function belowThousand(n: number): string {
    const h = Math.floor(n / 100),
        r = n % 100;
    if (h === 0) return belowHundred(n);
    const hw = `${NUM.hundred} ${h === 1 ? NUM.units[1] : NUM.units[h]}`;
    return r ? `${hw} ${NUM.and} ${belowHundred(r)}` : hw;
}
/** Non-negative integer → standard Swahili numeral spelling. */
function numberToText(n: number): string {
    if (n === 0) return NUM.units[0]!;
    const groups: string[] = [];
    const mil = Math.floor(n / 1_000_000);
    if (mil) {
        groups.push(`${NUM.million} ${belowThousand(mil)}`);
        n %= 1_000_000;
    }
    const th = Math.floor(n / 1000);
    if (th) {
        groups.push(`${NUM.thousand} ${belowThousand(th)}`);
        n %= 1000;
    }
    if (n) groups.push(belowThousand(n));
    return groups.join(` ${NUM.and} `);
}

/**
 * This language's OWN inventory — the TOKEN class as it stood before the widening below, lifted verbatim, so
 * nothing about the orthography is invented here. A token this REJECTS carries a letter the language does not
 * use, i.e. a foreign name.
 */
const NATIVE_CLASS = "[a-zA-Z']";
/**
 * NATIVISE a foreign name: fold an out-of-inventory accent to a base this g2p has a rule for. `NATIVE_CLASS`
 * above is the inventory — a word it rejects carries a letter this language does not use. See
 * `core/hostWord.ts` for why the inventory and the script boundary are two different questions.
 */
const nat = makeNativiser(NATIVE_CLASS, "u");

// ⚠ ALL OF LATIN, not just this language's own letters — the narrow class ended the token at an
// out-of-inventory diacritic, so that letter became an unclaimed gap read as an English LETTER NAME and the
// rest of the word started over: `São Paulo` fragmented into three pieces, none of them right. Invisible to
// every gate: no digit or raw mark survives and nothing VANISHES.
const TOKEN = new RegExp(`(${hostWordRun(["Latin"], "'")})|(\\d+)|([.?!,;:])`, "gu");

/**
 * Shared symbol tier — PERCENT ONLY, and that is a measured decision, not an omission.
 *
 * · `percentPrefix` is exactly the Swahili order: the corpus writes *asilimia 31*, *asilimia 93*,
 *   *asilimia 3 hadi 5* (×16 spelled out), so `80%` → `asilimia 80` needs no local rule at all.
 *   `percent` is a ONE-element `CountForms` because *asilimia* is a class 9/10 N-class noun, which is
 *   invariant in both number and numeral agreement.
 * · `units` is NOT declared: there is not a single abbreviated unit symbol in the 1,938-utterance corpus.
 *   Swahili spells the measure noun out and puts it BEFORE the numeral (*kilomita 70 kwa saa*), so there
 *   is nothing for a "number then symbol" matcher to find, and declaring short keys like `m` would only
 *   create the `Il-76s` class of false positive the tier's own comment warns about.
 * · `currency` is NOT declared either, for a different reason — the tier always emits the currency word
 *   AFTER the number and offers no `currencyPrefix` to mirror `percentPrefix`, while the corpus writes
 *   *dola 30*. Swahili therefore handles currency locally in normalize.ts. Recorded as a core limitation
 *   rather than worked around in core.
 */
// MIGRATION: currency moved off the local rule onto the shared tier, now that `currencyPrefix`
// exists. Swahili puts the measure noun BEFORE the number for every measure it writes out — "dola 30 za
// Kimarekani", "kilomita 70 kwa saa" — which is why the local rule existed. Verified byte-identical over
// the whole sw_ke corpus.
const SYMBOLS = makeSymbolNormalizer({
    // ⚠ THE AMPERSAND WAS A MISSING CELL, NOT A SOURCING PROBLEM — the tier's own `ampersand` note says so,
    // and this language is one of the fourteen that still had no word declared, so `&` was DROPPED outright.
    // na is ×3577 TOKEN in this language's own corpus, i.e. among its commonest words; there was nothing to source.
    //
    // A Latin-script printing LIGATURE rather than anything native, so what it takes is a reading and not a
    // translation: for a language written in Latin script that is its own conjunction, and for one that is not,
    // the symbol only ever arrives inside a Latin run. Either way the tier substitutes the conjunction, SPACED —
    // see the tier, where the spacing exists because `B&B` is two initialisms.
    ampersand: "na",
    // `multiply` — this language DROPPED the sign outright. ⚠ STANDARD MATHEMATICAL REGISTER, not a corpus
    // attestation: the sweep failed exactly as the exponent sweep did, because the plausible hits are homographs
    // of PREPOSITIONS — es `por` ×23, it `per` ×25, ru `на` ×31 are all the preposition, never the operator.
    // One word, so `by` defaults to it; this language does not split dimension from product.
    multiply: { times: "mara" },
    percent: ["asilimia"],
    percentPrefix: true,
    currency: {
        "$": ["dola"], "€": ["euro"], "£": ["pauni"], "¥": ["yeni"],
        "KSh": ["shilingi"], "TSh": ["shilingi"],
    },
    currencyPrefix: true,
    // `5 km` read as *tˈano kˈm̩*: no unit was declared, and until now none COULD be, because Swahili
    // puts the measure noun FIRST and the tier only emitted it after. Counted over sw_ke's four attested unit
    // words: 82 unit-before to 0 unit-after — "Mbuga hiyo inachukua kilomita 19,500 mraba", "mtindo huru wa
    // mita 100 na mita 200". Hence `unitPrefix`, the mirror of the `currencyPrefix` already set above.
    // Verified: kilomita ×59, mita ×23, kilogramu ×6, sentimita ×2.
    unitPrefix: true,
    units: { km: ["kilomita"], m: ["mita"], cm: ["sentimita"], kg: ["kilogramu"] },
    // THE RATE, because declaring the unit alone left a stray letter. sw_ke writes `160 Km/h` ×2 — with a
    // CAPITAL K, which a case-sensitive grep misses and the tier's `giu` pattern does not — and once `Km` read
    // as kilomita the `/h` was stranded as a bare *h*. "kwa saa" is attested ×34 and "kwa sekunde" ×5.
    unitPer: "kwa",
    rateDenominators: { h: "saa", s: "sekunde" },
});

class SwahiliPhonemizer implements Phonemizer {
    text(input: string): string {
        // ORDER: the shared symbol tier runs FIRST, then normalize.ts. The tier matches on a raw
        // `<number> %` adjacency, and normalize.ts's decimal rewrite (`1.5` → `1 nukta 5`) destroys
        // exactly that adjacency — the reverse order would have left a percent sign stranded on any
        // decimal. Nothing normalize.ts emits can create a new percent sign, so the order is safe.
        return assembleClauses(normalizeSwahili(SYMBOLS(input)), TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(nat(m[1])));
            else if (m[2]) {
                // ⚠ ABOVE 2^53 THE RAW ASCII DIGITS USED TO BE EMITTED STRAIGHT INTO THE IPA. Refusing to
                // COMPOSE is right — the float has already lost the low digits — but the else emitted the
                // token itself, which is not a reading. Digit-at-a-time through the same number words
                // instead; see core/numbers.ts `spellDigits` for the account and the cost.
                const num = Number(m[2]);
                if (Number.isSafeInteger(num))
                    for (const wd of numberToText(num).split(" "))
                        sink.emit(phonemizeWord(wd));
                else
                    for (const d of m[2])
                        for (const wd of numberToText(Number(d)).split(" "))
                            sink.emit(phonemizeWord(wd));
            } else if (m[3]) {
                const mk = CLAUSE_MARK[m[3]];
                if (mk) sink.pause(mk);
            }
        });
    }
}

/** Build the Swahili phonemizer (no data files beyond the manifest — the engine is rule-based). */
/**
 * NO FOREIGN PHONEMIZER IS WIRED, and that is deliberate rather than an oversight.
 *
 * Languages in a non-Latin script (gu, ps, kn, ml, ak …) take `(latin) => english.text(latin)` because
 * embedded Latin there really is foreign text. Swahili is Latin-script, so `GPS` is not foreign — it is an
 * acronym IN Swahili, and routing it to English would put English phonemes in a Swahili stream, which is
 * the exact defect the Japanese, Thai and Greek runs each worked to remove.
 *
 * The correct reading is Swahili letter names, which `core/initialisms.ts` would supply given an
 * `acronymLetters` table — but the Swahili run found no source for them, so none is authored. Until one
 * exists an unreadable acronym stays a cluster (GPS → [ɠps]). That is a MISSING reading rather than a
 * confidently wrong one, which is the trade an unsourced substitute always loses.
 */
export function createSwahili(): Phonemizer {
    return new SwahiliPhonemizer();
}
