/**
 * Native Tagalog / Filipino (tl) text phonemizer — canonical IPA. A shallow near-phonemic
 * Latin orthography → rule-based transliterator: digraphs (ng→ŋ, ch→t͡ʃ, ny/ñ→ɲ, sy→ʃ) then single letters,
 * with a WORD-INITIAL glottal stop [ʔ] before a vowel and a hyphen → [ʔ] (pag-asa→paɡʔasa); whole-word
 * irregulars (mga→maŋa, ng→naŋ). Stress defaults to PENULTIMATE but is phonemic and unwritten, so the shipped path
 * pins the ~23% non-penultimate cases from a kaikki-sourced stress lexicon (magandá, ngayón); the rule engine keeps
 * the penult default (the referee eval folds stress). Intervocalic/word-final glottal stops are likewise phonemic
 * but unwritten (bata 'child' [ˈbataʔ] vs bata 'robe' [ˈbata]) — a lexical residual.
 */
import { MANIFEST } from "./manifest.ts";
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { LATIN_RUN, makeNativiser } from "../../core/hostWord.ts";
import { loadManifest } from "../../core/loadManifest.ts";
import { loadLines, loadTsvMap } from "../../core/loadTsv.ts";
import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";
import { normalizeTagalog } from "./normalize.ts";

interface NumbersDef {
    units: string[];
    teens: string[]; // 10–19: explicit (irregular labing- sandhi)
    tens: string[]; // indexed by tens digit 1–9: explicit (o→u raising, na/ng split)
    hundred: string; // daan
    hundredAfterNa: string; // raan (after a " na" ligature: apat na raan)
    hundred1: string; // sandaan (100)
    thousand: string; // libo
    thousand1: string; // sanlibo (1000)
    million: string;
    and: string; // at → 't after a vowel
    stressPenult: string[]; // number roots that are penult- not final-stressed (séro, ápat, líbo, …)
}
export interface TagalogDef {
    digraphs: Record<string, string>;
    consonants: Record<string, string>;
    vowels: Record<string, string>;
    specialWords: Record<string, string>;
    clausePunctuation: Record<string, string>;
    numbers: NumbersDef;
    /** The two CONTRACTED ordinals; `ika-N` is regular and composed in code. */
    contractedOrdinals: Record<string, string>;
}
const DEF = loadManifest<TagalogDef>(import.meta.url, "tagalog.jsonc");
const CLAUSE_MARK = DEF.clausePunctuation;
const NUM = DEF.numbers;

export type ForeignPhonemizer = (latin: string) => string;

const isVowelLetter = (c: string): boolean => "aeiou".includes(c);
const VOWEL_PH = "aeiou";

/** Scan a lowercased Tagalog word → IPA (digraphs, single letters, glottal stops). */
function scan(w: string): string[] {
    const s = [...w];
    const out: string[] = [];
    for (let i = 0; i < s.length; ) {
        const c = s[i]!;
        // Hyphen → glottal stop (pag-asa → paɡʔasa).
        if (c === "-" || c === "‑") {
            out.push("ʔ");
            i++;
            continue;
        }
        const dg = c + (s[i + 1] ?? "");
        if (DEF.digraphs[dg]) {
            out.push(DEF.digraphs[dg]!);
            i += 2;
            continue;
        }
        if (isVowelLetter(c)) {
            // Glottal stop: word-initial before a vowel (araw→ʔaɾaw), and between two vowels in hiatus
            // (tao→taʔo, maaari→maʔaʔaɾi) — the y/w glides are consonants, so ay/aw stay glides.
            const prev = out[out.length - 1];
            if (out.length === 0 || (prev && VOWEL_PH.includes(prev[0]!)))
                out.push("ʔ");
            out.push(DEF.vowels[c]!);
            i++;
        } else if (DEF.consonants[c]) {
            out.push(DEF.consonants[c]!);
            i++;
        } else i++; // unknown → skip
    }
    return out;
}

/** Stress the given vowel-nucleus (0-based `overrideVowelIdx`, from the stress lexicon) or the penultimate nucleus
 *  (default; phonemic stress is unmarked in spelling, and ~77% of words are penultimate). */
function stressed(units: string[], overrideVowelIdx?: number): string {
    const nuclei = units
        .map((u, i) => (VOWEL_PH.includes(u[0] ?? "") ? i : -1))
        .filter((i) => i >= 0);
    if (nuclei.length === 0) return units.join("");
    const vni =
        overrideVowelIdx !== undefined && overrideVowelIdx >= 0 && overrideVowelIdx < nuclei.length
            ? overrideVowelIdx
            : nuclei.length >= 2 ? nuclei.length - 2 : 0;
    const idx = nuclei[vni]!;
    let out = "";
    for (let i = 0; i < units.length; i++) {
        if (i === idx) out += "ˈ";
        out += units[i];
    }
    return out;
}

/** Scan + stress one word (shared core). `overrideVowelIdx` (from the stress lexicon) moves stress off the
 *  penultimate default; undefined keeps the default. */
function phonemizeCore(word: string, overrideVowelIdx?: number): string {
    const lw = word.toLowerCase();
    const special = DEF.specialWords[lw];
    const units = special !== undefined ? scan(special) : scan(lw);
    if (units.length === 0) return "";
    return stressed(units, overrideVowelIdx).normalize("NFC");
}

/** One Tagalog word → canonical IPA, RULE-ENGINE ONLY (no word-final-glottal or stress lexicon) — the honest,
 *  non-circular signal used by the referee eval (the final ʔ is unwritten/lexical, so a wikipron-sourced set would
 *  be circular; stress is folded by the eval backbone anyway, so the penult default is the honest rule signal). */
export function phonemizeWordRules(word: string): string {
    return phonemizeCore(word);
}

// The unwritten word-final glottal stop (bata child [bataʔ] vs bata robe [bata]) is phonemic but lexical. This SET
// (final-glottal.txt, wikipron-sourced: all readings end in ʔ and the rest already matches) closes it on the SHIPPED
// path only — homographs are abstained.
let FINAL_GLOTTAL: ReadonlySet<string> | undefined;
const finalGlottal = (): ReadonlySet<string> =>
    (FINAL_GLOTTAL ??= new Set(loadLines(import.meta.url, "final-glottal.txt")));

// Phonemic stress is UNWRITTEN; the rule engine defaults to PENULTIMATE, but ~23% of words stress elsewhere (mostly
// FINAL: balik→balík). This MAP (stress-lexicon.tsv, kaikki-sourced: single confident stress position, vowel-count-
// aligned, only where it differs from the penult default) moves the stress mark on the SHIPPED path only — the eval
// backbone folds stress ˈˌ, so this is a TTS-quality closure invisible to the referee %.
let STRESS_LEX: ReadonlyMap<string, number> | undefined;
const stressLex = (): ReadonlyMap<string, number> =>
    (STRESS_LEX ??= loadTsvMap(import.meta.url, "stress-lexicon.tsv", (v) => {
        const n = Number(v);
        // reject empty/whitespace (Number("")===0 would else silently pin the first vowel) and non-integers
        return v.trim() !== "" && Number.isInteger(n) && n >= 0 ? n : undefined;
    }));

/** The shipped path WITHOUT the loanword override: rule engine + stress lexicon + word-final-glottal pin. This is the
 *  base the loanword lexicon is built ON (so its pins inherit correct stress + final-ʔ) and the fallback when a word
 *  isn't pinned — kept separate so the generator can baseline against it without loading the file it's generating. */
export function phonemizeShippedNoLoan(word: string): string {
    const lw = word.toLowerCase();
    const ipa = phonemizeCore(word, stressLex().get(lw));
    if (ipa && !ipa.endsWith("ʔ") && finalGlottal().has(lw)) return ipa + "ʔ";
    return ipa;
}

// The loanword FOREIGN-SEGMENT class — Spanish ⟨j⟩→[h] (abenojar→abenohaɾ), soft ⟨c⟩→[s] (abece→abese) — is
// origin-specific (native Tagalog has no ⟨j⟩→[h] or soft-c), so pinning it does NOT touch native vocabulary. The
// broader VV/glide/hiatus loanword class is NOT mineable this way: the SAME spelling is native [ij]/hiatus-ʔ vs
// loanword glide/plain, so a referee-mined pin corrupts core words (siya, tao) — This
// MAP (loanword-lexicon.tsv, wikipron-sourced: unanimous readings, foreign op verified against the referee) pins
// the corrected IPA on the SHIPPED path only; phonemizeWordRules (the eval) skips it → non-circular. Generated by
// tools/referee-eval/gen-tl-loanword-lexicon.ts.
let LOANWORD_LEX: ReadonlyMap<string, string> | undefined;
const loanwordLex = (): ReadonlyMap<string, string> =>
    (LOANWORD_LEX ??= loadTsvMap(import.meta.url, "loanword-lexicon.tsv"));

/** One Tagalog word → canonical IPA (shipped): the loanword foreign-segment override, else the rule/stress/final-ʔ path. */
export function phonemizeWord(word: string): string {
    return loanwordLex().get(word.toLowerCase()) ?? phonemizeShippedNoLoan(word);
}

// ── Numbers (native Tagalog; explicit irregular teens/tens + productive ligature sandhi) ──────────────────────
const endsInVowel = (s: string): boolean => "aeiou".includes(s[s.length - 1] ?? "");

/** The multiplier ligature before daan/libo/milyon: vowel-final → +ng (dalawa→dalawang), /n/-final → +g
 *  (daan→daang, so sandaang libo = 100,000), other consonant → + " na" (apat→apat na). Attaches to the phrase's
 *  last word, so a multi-word multiplier ligates correctly (…lima→…limang, sandaan→sandaang). */
const ligate = (phrase: string): string =>
    endsInVowel(phrase)
        ? phrase + "ng"
        : phrase.endsWith("n")
          ? phrase + "g"
          : phrase + " na";

/** Attach a remainder r to a higher group: a sub-100 tail joins with "at" → "'t" after a vowel (dalawampu't isa;
 *  sandaan at isa); a ≥100 tail is space-juxtaposed (isang libo dalawang daan). */
function joinRemainder(high: string, r: number): string {
    if (r === 0) return high;
    const low = numberWords(r);
    if (r >= 100) return `${high} ${low}`;
    return endsInVowel(high) ? `${high}'t ${low}` : `${high} ${NUM.and} ${low}`;
}

/** Native Tagalog cardinal for a non-negative integer (exported for the orthography test; the IPA is derived by
 *  running each space-separated word through the g2p). */
export function numberWords(n: number): string {
    if (n < 0) return "";
    if (n < 10) return NUM.units[n]!;
    if (n < 20) return NUM.teens[n - 10]!; // 10–19 explicit
    if (n < 100) {
        const t = Math.floor(n / 10);
        return joinRemainder(NUM.tens[t]!, n % 10);
    }
    if (n < 1000) {
        const h = Math.floor(n / 100);
        const lig = ligate(NUM.units[h]!);
        const daan = lig.endsWith("na") ? NUM.hundredAfterNa : NUM.hundred; // apat na raan vs dalawang daan
        const hundreds = h === 1 ? NUM.hundred1 : `${lig} ${daan}`;
        return joinRemainder(hundreds, n % 100);
    }
    if (n < 1000000) {
        const th = Math.floor(n / 1000);
        const thousands = th === 1 ? NUM.thousand1 : `${ligate(numberWords(th))} ${NUM.thousand}`;
        return joinRemainder(thousands, n % 1000);
    }
    const m = Math.floor(n / 1000000);
    return joinRemainder(`${ligate(numberWords(m))} ${NUM.million}`, n % 1000000);
}

const NUM_PENULT = new Set(NUM.stressPenult);

/** The stressed vowel-nucleus index for one emitted number token — FINAL by default, PENULT for the kaikki-mined
 *  exceptions (séro, ápat, líbo, …). The -ng ligature and 't contraction add no vowel, so they leave the index
 *  unchanged; strip them to recover the root for the penult lookup. Overrides the general (prose) stress lexicon,
 *  which abstains on the number-sense homographs (isá, limá, pitó). */
function numberStressIdx(token: string): number | undefined {
    const root = token.endsWith("'t")
        ? token.slice(0, -2)
        : token.endsWith("ng")
          ? token.slice(0, -2)
          : token;
    const nuclei = [...token].filter((c) => "aeiou".includes(c)).length;
    if (nuclei === 0) return undefined;
    return NUM_PENULT.has(root) && nuclei >= 2 ? nuclei - 2 : nuclei - 1;
}

/**
 * SHARED SYMBOL TIER — every word corpus-attested with the sense checked (mined artifact ×counts; tl.wikipedia
 * for the contested calls, the pcm/km two-source method):
 * · percent → ⟨porsiyento⟩ — BOTH spellings are real (artifact 3:4, essentially tied) and tl.wikipedia
 *   decides it 575:216 over ⟨porsyento⟩; the artifact's own spelled-out instance agrees ("siyamnapu't-limang
 *   porsiyento"). ⚠ WITHOUT the linker: a Tagalog reader ligates ("limang porsiyento"), but the tier appends
 *   a word to a digit string before the number is read, so the sandhi has nowhere to attach — deferred, and
 *   recorded rather than half-done.
 * · ₱ → ⟨piso⟩ (×5 in the artifact; the sign itself ×1), $ → ⟨dolyar⟩ (×17, against $-signs ×34 — the word
 *   is the corpus's own: "$19.8 bilyon" prose reads "dolyar").
 * · magnitudes milyon ×35 / bilyon ×21 (tl.wikipedia 572) / trilyon (68) — the corpus composes them with
 *   currency ("$224.754 bilyon GDP"), which is exactly the shape the tier's magnitude logic exists for.
 * · & → ⟨at⟩ (×23 REAL ampersands; the other 44 are HTML entities — normalize.ts disposes of those first,
 *   which is why it must run before this tier).
 * · km → ⟨kilometro⟩ (tl.wikipedia 5,907; the abbreviated unit appears digit-adjacent in the artifact).
 *   ⟨°⟩ is still REFUSED: its 18 artifact instances are nearly all coordinate notation (116°40' E), which is
 *   a different reading problem than temperature, and "digri Selsiyus" has 0 tl.wikipedia phrase hits —
 *   declaring ⟨°C⟩ from parts would be the zu/xh Kristu mistake.
 * · ⟨m⟩ ⟨mm⟩ ⟨l⟩ ⟨ha⟩ — THE FOUR SI UNITS THIS LAYER LEAKED AS RAW ASCII (`10 m` read *sampˈu m*), and
 *   tl.wikipedia names the SYMBOL beside the word for every one of them, which is as good as this kind of
 *   evidence gets:
 *     metro       119 tokens / 20 arts  *"Ang metro (SIMBOLO: m) ay ang sukat ng haba … Ang simbolo para
 *                                        sa metro ay m."* — the metre article, definitional
 *     milimetro    38 / 20              *"ang kahabaa'y higit-kumulang sa dalawang milimetro (2mm)"* —
 *                                        glossed against the abbreviation in the same clause
 *     litro        36 / 20              *"L o l ang daglat ng litro"* ("L or l is the abbreviation of
 *                                        litro"), and *"1000 mL = 1 L"* — BOTH cases named by the article
 *     ektarya      45 / 20              *"Ang ektarya, simbolo: ha, (mula sa Espanyol na hectárea …)"*
 *   ⚠ NOT BORROWED FROM CEBUANO OR HILIGAYNON, which ship the same Spanish-loan shapes (`metro`,
 *   `milimetro`) three files away. Every count above is tl.wikipedia's own; the sister languages were not
 *   consulted, because a Philippine-language loan looking identical to its neighbour's is exactly how a
 *   wrong-language word gets laundered into a layer.
 *   ⚠ POSTPOSED, measured: over the mined artifact the unit noun follows its number 11 times
 *   (`kilometro` ×4, `metro` ×7) and precedes it 0 times. So no `unitPrefix` — the tier's default is right
 *   for Tagalog, and this is the OPPOSITE of the hil/rw Bantu-and-Visayan order the brief asks about.
 *   ⚠ THE ONE-LETTER KEYS ⟨m⟩ AND ⟨l⟩, AND WHAT THE MEASUREMENT SAYS (trap 46). Rebuilding the tier's own
 *   pattern — the number, the key, and the trailing `(?![\p{L}\p{M}'’ʼ])` guard — over the whole artifact:
 *     m  → 2 matches, BOTH genuine metres: `c = 299,792,458m/s` and `Rio (23 m)`. 0 counter-examples.
 *          ⚠ The 24 other `\d m` shapes in the artifact are `mílyon`/`metro` and similar words, and the
 *          trailing letter guard rejects every one — the count without the guard is not the count.
 *     l  → 1 match, and it is NOT a litre: *"bilang 91 L / kopyang elektroniko"*, a shelf number in an
 *          English bibliographic citation quoted inside a Tagalog reference list. Declared ANYWAY, and the
 *          reason is that this is not a Tagalog construction the way `mad`'s `m'`, `rn`'s `50 m'ubumwe` or
 *          `hmn`'s tone-letter finals are — those recur because the LANGUAGE writes them; a library
 *          catalogue string recurs only where a references section quotes English. One instance, named
 *          here so a regression on it is recognised rather than rediscovered.
 * · ⟨cm⟩ ⟨kg⟩ ⟨mg⟩ — THE MIS-READING SET, and ⟨cm⟩ is the case the previous pass left open with the
 *   note that it "does not LEAK, it MIS-READS": Tagalog's g2p reads ⟨c⟩ as /k/, so `10 cm` came out
 *   *sampˈu km* — the letter pair, silent to every leak class, DROP counter and corpus diff in the tree.
 *   `misread.ts` now names the class mechanically, and the four keys below are what it reports for tl.
 *     sentimetro  39 tokens / 20 arts   *"humahaba hanggang 60 sentimetro"*, *"5–15 sentimetro at luwang
 *                                       na 2–8 sentimetro"*, *"Ini-angat ito nang 70 sentimetro"* — every
 *                                       example a genuine LENGTH, digit-adjacent and postposed
 *     kilogramo   44 / 20               the kilogram article NAMES THE SYMBOL: *"Ang kilogramo ay isang
 *                                       metrikong yunit na naglalarawan ng masa … ang kilo na may SAGISAG
 *                                       NA KG o kgs"* — definitional, and as good as this evidence gets
 *     miligramo    4 / 4                thin but unambiguous: *"200 miligramo ng calcio"*, and the SI
 *                                       article's own *"sistemang milimetro-miligramo-segundo"*
 *   ⚠ THE CORPUS DOES NOT WRITE TWO OF THE THREE, and that is not a reason to decline. Over the mined
 *   artifact `cm` is ×0, `mg` ×0 and `kg` ×1 (*"masa o kasalansanang 40 kg (90 lbs)"*). A rare token is
 *   evidence about a 400-line artifact, not about Tagalog — these are SI units, tl.wikipedia writes all
 *   three words in their own unit articles, and the pre-existing `km`/`m`/`mm` were declared off the same
 *   wiki evidence. Declining here would leave a silent defect in place to protect a diff.
 *   ⚠ ⟨g⟩ IS REFUSED, AND THE COUNTER-EXAMPLE IS THE LIGATED MAGNITUDE — trap 46 through a door the
 *   existing measurement cannot see. `gramo` is the best-attested word of the four (49 tokens / 20 arts,
 *   *"500 mga gramo ng halayang petrolyo"*, *"pitong gramo ng proteina"*), and scanning the artifact for
 *   the tier's own shape — a digit, an optional space, `g`, the trailing guard — gives 0 matches with the
 *   guard and 0 without it. That measurement is WRONG, because the tier's pattern admits a MAGNITUDE
 *   between the number and the unit, and Tagalog's magnitudes are declared in their ligated forms three
 *   lines below: `milyong`, `bilyong`, `trilyong`, `libong` all END IN ⟨g⟩. Declared, the rule split the
 *   linker off the magnitude and `11 milyong mga Pilipino` read *labiŋʔisˈa mˈiljon ɡɾˈamo maŋˈa
 *   pilipˈino* — eleven million GRAMS of Filipinos. Re-measured against the right shape, `<digit>
 *   <ligated magnitude>` is ×21 in the artifact (`109 milyong katao`, `28 bilyong dolyar`, `3.9 milyong
 *   tao`) against 0 genuine grams. Refused on 21:0, and the number that decided it was invisible to the
 *   scan that would normally settle a one-letter key.
 * · ⟨nm⟩ ⟨lb⟩ ⟨lbs⟩ — THE RAW-LATIN RESIDUAL SET, and the two that survived a collision audit.
 *     nanometro   25 tokens / 15 arts   EVERY example digit-adjacent in the length slot: *"may kapal na
 *                                       10 nanometro"*, *"sa pagitan ng halos 585 at 620 nanometro"*,
 *                                       *"0.01 hanggang 10 nanometro"*. The artifact's own instance is
 *                                       the same shape — *"wavelength ng liwanag (400-700 nm)"*.
 *     libra       71 / 20               and tl.wikipedia NAMES THE ABBREVIATION: *"ang kasalukuyang gamit
 *                                       ng libra (o pound sa Ingles at DINADAGLAT BILANG LB)"*. Both
 *                                       spellings are keyed because the corpus writes the plural — *"40 kg
 *                                       (90 lbs)"* — and `lbs` must be tried before `lb`, which the tier's
 *                                       longest-key-first sort already guarantees.
 *   ⚠ ⟨fm⟩ IS REFUSED, AND THE WORD IS NOT WHAT IS MISSING. `femtometro` is attested 2 tokens / 1 article
 *   and BOTH sit in the corpus's own slot (*"mga 1 hanggang 3 femtometro"*, *"0.8 femtometro na radyus ng
 *   nukleyo"*), matching the artifact's `1.07 fm` / `2.5 fm` in the same physics article. The counter-shape
 *   is the collision: multi-character keys resolve CASE-FOLDED on the digit path, so a Philippine radio
 *   frequency — `101.1 FM`, `DZBB 594 FM`, the commonest `<number> FM` string a tl wiki has — would read
 *   *101.1 femtometro*. Three instances of a unit nobody outside nuclear physics writes, against a
 *   station-name shape this corpus's own register is full of. The leak stays VISIBLE, which is the honest
 *   side to fail on and the same trade `g` was refused on four lines above.
 *   ⚠ AND ⟨km⟩ STILL REPORTS ONCE, FOR A REASON THAT IS NOT IN THIS TABLE. `64,936 (una) at 64,710
 *   (ikalawa) katao/km²` leaks, while the identical `43,079 katao/km²` and `20,164 katao/km²` in the same
 *   sentence read correctly as *…katao bawat kilometro kuwadrado*. The difference is a PARENTHETICAL
 *   between the number and the unit: the tier's unit pattern admits a MAGNITUDE there and nothing else, so
 *   the numerator `katao` is not adjacent to a numeral and the match never starts; the bare-unit fallback
 *   then declines by its own `/` guard, which exists so a rate is never read half-way. No tl declaration
 *   can reach it — it is the tier's shape, recorded here so the residual is not re-diagnosed as a missing key.
 *   ⚠ Nothing here can reach a CAPITAL: the two digit-adjacent capitals in the artifact are `2GO` (a
 *   shipping line) and `15 GB`, and one-letter symbols resolve EXACT-CASE (`resolveUnitSymbol`), with
 *   case-folding restricted to multi-character symbols precisely so a bare ⟨G⟩ is never read as grams.
 * · `rateDenominators` ⟨s⟩ → ⟨segundo⟩, which is what makes the artifact's own `299,792,458m/s` compose
 *   instead of stranding the `/s` as raw letters. tl.wikipedia glosses the whole rate: *"metro BAWAT
 *   SEGUNDO para sa belosidad"*, and *"(metro bawat segundo na kuwadrado)"* for m/s² — the tier's existing
 *   `unitPer: "bawat"` plus this one noun reproduces that phrase exactly. `segundo` 135 tokens / 20 arts,
 *   the seconds article definitional (*"Ang segundo ay ang batayang yunit ng panahon"*). ⚠ In
 *   `rateDenominators` and NOT in `units`, which is the declaration's whole point: a bare `76s` must not
 *   become 76 seconds.
 */
const SYMBOLS = makeSymbolNormalizer({
    percent: ["porsiyento"],
    currency: {
        "US$": ["dolyar"], $: ["dolyar"], "₱": ["piso"],
        // ¥ and € are attested by their own line: the anime-industry sentence writes "¥10,000,000 (80,000 €)"
        // and spells both words itself ("200,000,000,000 yen", "1 at kalahating bilyon euros").
        "¥": ["yen"], "€": ["euro"],
    },
    // Including the LIGATED forms — Tagalog writes the magnitude with its linker fused ("380 libong
    // kilometro²", "3.9 milyong tao"), and the tier matches the token as written.
    magnitudes: ["milyon", "bilyon", "trilyon", "libo", "milyong", "bilyong", "trilyong", "libong",
        "Milyon", "Bilyon", "Trilyon"],
    ampersand: "at",
    // ⟨kilometro⟩ appears as a KEY too: "380 libong kilometro²" writes the full word with the superscript,
    // and the bare-exponent fallback only reads 1–3-letter bases.
    // ⚠ ⟨L⟩ AND ⟨l⟩ ARE BOTH DECLARED, which is the litre's documented exception to the one-letter rule
    // (see `resolveUnitSymbol`): both cases are official for this unit, the exact branch is case-sensitive,
    // and tl.wikipedia's own litre article names them together — "L o l ang daglat ng litro".
    units: { km: ["kilometro"], kilometro: ["kilometro"], m: ["metro"], cm: ["sentimetro"], mm: ["milimetro"],
        kg: ["kilogramo"], mg: ["miligramo"], nm: ["nanometro"], lb: ["libra"], lbs: ["libra"],
        l: ["litro"], L: ["litro"], ha: ["ektarya"],
        katao: ["katao"], naninirahan: ["naninirahan"] },
    rateDenominators: { s: "segundo" },
    // ⟨km²⟩ — the artifact's single largest dropped class (×22 of the 35 superscripts: katao/km², 56,594 km²).
    // The word is POSTPOSED: tl.wikipedia "kilometro kuwadrado" 1,605 against "kwadrado" 54 (spelling) and 0
    // for the preposed orders. ⟨kubiko⟩ ("metro kubiko" ×19) rides the same evidence, thinner but the same
    // Spanish-loan shape and the only attested order.
    exponentWords: { squared: ["kuwadrado"], cubed: ["kubiko"], position: "after" },
    // ⟨katao/km²⟩ — the per-slash reads ⟨bawat⟩ ("each/per"): tl.wikipedia "bawat kilometro kuwadrado" 64
    // against "kada kilometro" 42, and the artifact uses both at 9:9 — bawat is the formal register the
    // encyclopedia itself favours in exactly this frame.
    unitPer: "bawat",
});

// ⚠ ALL OF LATIN, not just Tagalog's own letters — `[A-Za-zÑñ]+` ended the token at an out-of-class diacritic,
// so the letter carrying it became an unclaimed gap read as an English LETTER NAME and the rest of the word
// started over: `São Paulo` → *s ˈə ʔˈo paʔˈulo*, `Klöcker` → *kl ˈoᶷ kkˈeɾ*. Invisible to every gate — no digit
// or raw mark survives and nothing VANISHES, so neither the leak classes nor the differential DROP test see it.
// The hyphen-compound shape is preserved: Tagalog writes `kaibigan-ko` and the two halves are ONE word.
/**
 * ⟨ika-N⟩ ORDINALS — the productive form is ⟨ika⟩ + the cardinal, fused, with two CONTRACTIONS the corpus
 * and tl.wikipedia both insist on: ikalawa (503:2 over *ikadalawa) and ikatlo (367); 1st is suppletive ⟨una⟩.
 * ×42 in the artifact (ika-3 buwan, ika-20 siglo, ika-130 sa buong mundo). Hoisted to module level so the
 * literals are data, not spellings inside text() (the review gate's spelling→g2p check is right to object).
 */
const ORDINAL_ONE = "una";
const ORDINAL_PREFIX = "ika";
/** Read from the manifest — see the jsonc, where the evidence lives. */
const ORDINAL_CONTRACTED = MANIFEST.contractedOrdinals;

// Order is load-bearing: times before the number class (else 12:23 is two numbers and a colon pause),
// ika- ordinals before LATIN_RUN (else ⟨ika⟩ is a word and the digits are a stray cardinal), and the number
// class must swallow its own thousands-commas and decimal dot (else ⟨1,000⟩ reads "isa [pause] sero sero
// sero" and ⟨3.5⟩ "tatlo [pause] lima" — both real artifact shapes: grouped ×84, dot-decimals ×100).
const TOKEN = new RegExp(
    `(?<![\\d:])(\\d{1,2}):([0-5]\\d)(?::([0-5]\\d))?(?![\\d:])` +
        `|[Ii]ka-?(\\d+)(?![\\p{L}\\d])` +
        `|(${LATIN_RUN}(?:[-‑]${LATIN_RUN})*)` +
        `|([1-9]\\d{0,2}(?:,\\d{3})+(?:\\.\\d+)?|\\d+\\.\\d+|\\d+)` +
        `|([.?!,;:])`,
    "gu",
);
/**
 * Tagalog's OWN inventory — the token class as it stood before the widening, lifted verbatim.
 *
 * ⚠ `Ñ`/`ñ` IS NATIVE HERE, which is why the fold below has to be CONDITIONAL. Tagalog inherited the letter
 * from Spanish and reads it as /ɲ/ — `Doña` → *dˈoɲa*, `Cañitas` → *kaɲˈitas*, both already correct. Folding
 * every accent to its base the way pcm does would have destroyed exactly the accented letter this language CAN
 * read, turning `ñ` into `n`. So the fold applies only to a token this class REJECTS.
 */
const NATIVE_CLASS = "[A-Za-zÑñ‑-]";
/**
 * NATIVISE a foreign name: fold an out-of-inventory accent to a base this g2p has a rule for. `NATIVE_CLASS`
 * above is the inventory — a word it rejects carries a letter this language does not use. See
 * `core/hostWord.ts` for why the inventory and the script boundary are two different questions.
 */
const nat = makeNativiser(NATIVE_CLASS, "u");

class TagalogPhonemizer implements Phonemizer {
    constructor(private foreign?: ForeignPhonemizer) {}
    text(input: string): string {
        // Normalization BEFORE tokenizing (entities, digit ranges), then the symbol tier — that order is
        // load-bearing: the tier's ampersand rule voices every ⟨&⟩, and the corpus's 44 HTML entities must be
        // gone before it runs (normalize.ts has the counts).
        return assembleClauses(SYMBOLS(normalizeTagalog(input)), TOKEN, (m, sink) => {
            const emitNumber = (digits: string): void => {
                const n = Number(digits);
                // ⚠ ABOVE 2^53 THIS USED TO `return` AND THE NUMBER VANISHED FROM THE READING. Refusing to
                // compose is right — the float has already lost the low digits — but the guard had no else.
                // Digit-at-a-time reuses the same number words and the same NUMBER-sense stress below, so it
                // invents nothing; above 2^53 the reading is a digit string, not a quantity.
                if (!Number.isSafeInteger(n)) {
                    for (const d of digits)
                        for (const wd of numberWords(Number(d)).split(" "))
                            sink.emit(phonemizeCore(wd, numberStressIdx(wd)));
                    return;
                }
                // Number words take the NUMBER-sense stress (numberStressIdx: final-except-penult, correct for
                // the number reading of homographs like isá/limá/pitó) and bypass the final-glottal set, which
                // fires inconsistently by incidental membership (sampu→sampuʔ but dalawampu not).
                for (const wd of numberWords(n).split(" "))
                    sink.emit(phonemizeCore(wd, numberStressIdx(wd)));
            };
            if (m[1] !== undefined) {
                // TIME, hh:mm(:ss) — ⚠ PROVISIONAL, the pcm arrangement: each field as a cardinal, zero
                // minutes silent (5:00 → the bare hour). The artifact's 13 instances are timestamps
                // (08:50:38 UTC), and the traditional Spanish-numeral clock reading (alas-otso) has ZERO
                // attestation there — all 16 ⟨alas⟩ hits are ⟨madalas⟩/⟨kadalasang⟩ substrings — so digits
                // are read in Tagalog rather than a convention being invented.
                emitNumber(m[1]);
                if (m[2] !== "00") emitNumber(String(Number(m[2])));
                if (m[3] !== undefined) emitNumber(String(Number(m[3])));
            } else if (m[4] !== undefined) {
                // ⟨ika-N⟩ ORDINAL — see ORDINAL_CONTRACTED above. The prefix fuses onto the cardinal's
                // FIRST word (ika-130 → ikasandaan at tatlumpu), matching the written one-word forms
                // (ikaapat, 901 tl.wikipedia hits).
                const n = Number(m[4]);
                // ⚠ ⟨una⟩ goes through the PROSE path: it is not a number token (penult stress, ʔˈuna), and
                // the number-sense stress default would wrongly finalise it (*ʔunˈa).
                if (n === 1) { sink.emit(phonemizeWord(ORDINAL_ONE)); return; }
                const words = ORDINAL_CONTRACTED[n] ?? ORDINAL_PREFIX + numberWords(n);
                for (const wd of words.split(" ")) sink.emit(phonemizeCore(wd, numberStressIdx(wd)));
            } else if (m[5] !== undefined) {
                sink.emit(phonemizeWord(nat(m[5])));
            } else if (m[6] !== undefined) {
                // De-group thousands, then read a surviving dot's fraction DIGIT-BY-DIGIT with the dot
                // silent. ⚠ THE DECIMAL WORD IS REFUSED, the km arrangement, and the evidence is recorded:
                // written Filipino does not spell it — ⟨punto⟩ has 1,122 tl.wikipedia hits but the phrase
                // "punto lima" has ONE, and the artifact's single ⟨punto⟩ is the geometric sense ("kalagitnaang
                // punto"). Declaring it anyway would be inventing a convention the written language avoids.
                const [int, frac] = m[6].replace(/,/gu, "").split(".");
                emitNumber(int!);
                if (frac !== undefined) for (const d of frac) emitNumber(d);
            } else if (m[7] !== undefined) {
                const mk = CLAUSE_MARK[m[7]];
                if (mk) sink.pause(mk);
            }
        });
    }
}

/** Build the Tagalog phonemizer. */
export function createTagalog(): Phonemizer {
    return new TagalogPhonemizer();
}
