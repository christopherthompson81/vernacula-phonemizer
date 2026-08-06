/**
 * Arabic (ar) phonemizer — canonical IPA (Modern Standard Arabic, broad phonemic).
 * Diacritized g2p (g2p.ts) + quantity-sensitive stress. Phase 1 assumes vowelled input; a neural diacritizer
 * pre-pass (permissively-sourced) will restore short vowels for bare text in Phase 2.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { toSegments, type Seg } from "./g2p.ts";
import { numberToIpa, type ArabicNumberData } from "./numbers.ts";
import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";
import {
    createArabicDiacritizer,
    type ArabicDiacritizer,
} from "./diacritizer.ts";
import { lexiconPrimary } from "./restore.ts";
import { loadTsvMap } from "../../core/loadTsv.ts";
import { normalizeArabic } from "./normalize.ts";
import { loadManifest } from "../../core/loadManifest.ts";
import { MANIFEST } from "./manifest.ts";

const isLongNucleus = (ph: string): boolean =>
    /ː/.test(ph) || ph === "aj" || ph === "aw" || /[aiu]n$/.test(ph);

/**
 * MSA quantity-sensitive stress. Syllabify (each vowel = a nucleus; a consonant between two vowels is the
 * next onset, so a syllable is closed only when ≥2 consonants follow / a trailing consonant at word end).
 * Stress: final if superheavy (CVVC/CVCC); else the last non-final heavy syllable within the last three;
 * else the first syllable.
 */
function stressedNucleus(segs: Seg[]): number {
    const nuclei = segs.map((s, i) => (s.vowel ? i : -1)).filter((i) => i >= 0);
    if (nuclei.length <= 1) return nuclei[0] ?? -1;

    const heavy: boolean[] = [],
        superheavy: boolean[] = [],
        longV: boolean[] = [];
    nuclei.forEach((vi, k) => {
        const long = isLongNucleus(segs[vi]!.ph);
        const end = k === nuclei.length - 1 ? segs.length : nuclei[k + 1]!;
        let consAfter = 0;
        for (let j = vi + 1; j < end; j++)
            if (!segs[j]!.vowel) consAfter += geminated(segs, j) ? 2 : 1;
        const coda = k === nuclei.length - 1 ? consAfter >= 1 : consAfter >= 2;
        longV[k] = long;
        heavy[k] = long || coda;
        superheavy[k] = (long && coda) || consAfter >= 2;
    });

    const last = nuclei.length - 1;
    if (superheavy[last]) return nuclei[last]!; // ultima superheavy (CVːC/CVCC) → ultima
    if (heavy[last]) return nuclei[last - 1]!; // ultima heavy (CVV/CVC) → penult
    if (heavy[last - 1]) return nuclei[last - 1]!; // ultima light, penult heavy → penult
    const ap = last - 2; // all-light ultima+penult → antepenult, UNLESS the
    if (ap >= 0 && heavy[ap] && !longV[ap]) return nuclei[last - 1]!; // antepenult is heavy by CODA only (madrasa → penult)
    return nuclei[Math.max(0, ap)]!; // else antepenult (light, or heavy by long vowel: ṭaːlib)
}

/** Is the consonant seg at index j a geminate (rendered Cː) — it fills both coda and following onset. */
function geminated(segs: Seg[], j: number): boolean {
    return /ː$/.test(segs[j]!.ph);
}

// Arabic VARIETIES share this engine (scanner + diacritizer + numbers) and differ only by data: ordered IPA
// rewrites applied to the MSA g2p output ("restore MSA → transform to the variety"). Registered under distinct ISO
// codes (arz Egyptian, apc Levantine, …), NOT a runtime flag — like hi/gu/ur sharing one abugida engine. Consonant
// shifts + diphthong monophthongization are deterministic; short-vowel restructuring is a per-variety lexical tail.
interface VarietyDef {
    variety: string;
    iso: string;
    consonantShifts: [string, string][];
    diphthongShifts: Record<string, string>;
    articleVowel?: string; // raise the definite-article nucleus (arz "i" → il-); omitted = keep MSA [a]
    numbers?: ArabicNumberData; // per-variety numeral tables (#561: arz 80 is tamaniːn, not MSA θamaːnuːn)
}
interface VarietyRules {
    consonantShifts: [string, string][]; // literal string rewrites (consonants are unambiguous)
    diphthongShifts: [RegExp, string][]; // guarded: aj/aw only when NOT an onset of the next syllable
    articleVowel?: string; // per-variety definite-article vowel (applied to the tagged article seg, pre-join)
    numbers?: ArabicNumberData; // per-variety numerals; absent → the MSA compositor tables
}
/** A diphthong [aj]/[aw] monophthongizes only when its glide is a CODA — i.e. NOT followed by (an optional stress
 *  mark and) a vowel. This distinguishes the diphthong بيت bajt→beːt from the hiatus طويل tˤawiːl (a·w·iː, glide
 *  onsets the next syllable) which must stay. Vowel onsets: a i u (MSA) + e o (dialect eː/oː) + æ (imāla). */
function compileVariety(d: VarietyDef): VarietyRules {
    return {
        consonantShifts: d.consonantShifts,
        diphthongShifts: Object.entries(d.diphthongShifts).map(([from, to]) => [
            new RegExp(from + "(?!ˈ?[aiueoæ])", "gu"),
            to,
        ]),
        articleVowel: d.articleVowel,
        numbers: d.numbers,
    };
}
const VARIETIES: Record<string, VarietyRules> = {
    egyptian: compileVariety(loadManifest<VarietyDef>(import.meta.url, "egyptian.jsonc")),
    levantine: compileVariety(loadManifest<VarietyDef>(import.meta.url, "levantine.jsonc")),
    sudanese: compileVariety(loadManifest<VarietyDef>(import.meta.url, "sudanese.jsonc")),
    iraqi: compileVariety(loadManifest<VarietyDef>(import.meta.url, "iraqi.jsonc")),
    gulf: compileVariety(loadManifest<VarietyDef>(import.meta.url, "gulf.jsonc")),
    moroccan: compileVariety(loadManifest<VarietyDef>(import.meta.url, "moroccan.jsonc")),
    libyan: compileVariety(loadManifest<VarietyDef>(import.meta.url, "libyan.jsonc")),
    southlevantine: compileVariety(loadManifest<VarietyDef>(import.meta.url, "southlevantine.jsonc")),
    hijazi: compileVariety(loadManifest<VarietyDef>(import.meta.url, "hijazi.jsonc")),
};

/** Phonemize a single diacritized Arabic word to canonical IPA (with a stress mark). `variety` (e.g. "egyptian")
 *  applies its dialectal shifts on top of the MSA output; undefined/"msa" = Modern Standard Arabic. */
export function phonemizeWord(word: string, variety?: string): string {
    const segs = toSegments(word);
    if (segs.length === 0) return "";
    const stress = stressedNucleus(segs);
    const vdef = variety ? VARIETIES[variety] : undefined;
    let out = "";
    for (let i = 0; i < segs.length; i++) {
        if (i === stress) out += "ˈ";
        // a variety may raise the definite-article nucleus (arz [a]→[i], il-); the tag survives the seg build
        out += vdef?.articleVowel && segs[i]!.article ? vdef.articleVowel : segs[i]!.ph;
    }
    if (vdef) {
        for (const [from, to] of vdef.consonantShifts) out = out.replaceAll(from, to);
        for (const [re, to] of vdef.diphthongShifts) out = out.replace(re, to);
        // A diphthong shift over a GEMINATE glide (كُوَيِّس ay+ː → eː + ː) leaves a double length; IPA length is
        // binary, so collapse ːː → ː (kuwayyis → kuweːis, أَيَّة ayya → ʔeːa).
        out = out.replace(/ːː/gu, "ː");
    }
    return out;
}

// Clause / phrase punctuation (Arabic + ASCII) → canonical inline pause marks (authored data in arabic.jsonc).
const CLAUSE_MARK = MANIFEST.clausePunctuation;
// A word (Arabic letters + harakat) / number (Arabic-Indic or ASCII digits) / punctuation token.
// The number class accepts GROUPING and DECIMAL separators. Without them "1,000" tokenized as 1 | , | 000
// and the separator became a clause PAUSE ("واحد , صفر"); "1.5" likewise. Arabic-Indic digits are folded to
// ASCII by normalizeArabic before this runs, so only the ASCII forms need matching here.
const TOKEN = /([ء-يٰٱً-ْـ]+)|(\d+(?:,\d{3})*(?:\.\d+)?)|([۔.!؟?،,؛;:…])/gu;
/** Arabic-Indic digits ٠..٩ → ASCII. */
const toAscii = (d: string): string =>
    d.replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x0660));

// Egyptian short-vowel LEXICON (arz): word (undiacritized) → canonical Egyptian IPA, mined from kaikki (Wiktionary
// Egyptian Arabic, CC BY-SA) — the dialect vowel data the MSA diacritizer cannot supply (Egyptian restructures the
// short vowels: مصر MSA miṣr → BP maṣr, أنا anā → ana). Because kaikki and the wikipron-arz referee share the
// Wiktionary tradition, the eval scores the RULE path (useLexicon:false) → this lexicon is a SHIPPED refinement.
let egyptianLex: ReadonlyMap<string, string> | undefined;
function egyptianLexicon(): ReadonlyMap<string, string> {
    if (egyptianLex === undefined)
        egyptianLex = loadTsvMap(import.meta.url, "egyptian-lexicon.tsv", ipaOnly, {
            optional: true,
        });
    return egyptianLex;
}
const HARAKAT = /[ً-ْٰـ]/gu; // short-vowel diacritics + dagger-alif + tatweel → bare lexicon key

// The lexicon is MINED from kaikki, and the extraction once emitted a Wiktionary entry's phonemic and
// phonetic transcriptions glued together — كتب → "katab/[kˈatab" — which reached the output verbatim as a
// "phoneme" (issue #550). The data is repaired; this guard keeps a re-mine from reintroducing it.
//
// It REPAIRS rather than drops. Dropping would be wrong here specifically: this lexicon exists to supply
// EGYPTIAN short vowels, and without a hit the word falls back to the abjad rule path or the MSA neural
// diacritizer — which restores MSA vowels that are wrong for Egyptian (مصر MSA miṣr vs Egyptian maṣr).
// So a dropped row does not degrade to "unrefined", it degrades to "incorrect vowels". Recovering an
// alternant keeps the vocalization.
//
// Selection mirrors the one used to repair the data: of the alternants, prefer the single stressed one
// (the file header states entries carry "stress on the nucleus"), else the first. Only a value still
// holding a delimiter after that is unusable and dropped.
const VARIANT_SPLIT = /\/~\/|\/\/|\/\[/u;
const NOT_IPA = /[/[\]~()|\\]/u;
/** Exported for tests: the load-time repair rule for a mined lexicon value (see the note above). */
export const ipaOnly = (value: string): string | undefined => {
    if (!NOT_IPA.test(value)) return value;
    const parts = value.split(VARIANT_SPLIT).filter(Boolean);
    const stressed = parts.filter((p) => p.includes("ˈ"));
    const pick = stressed.length === 1 ? stressed[0]! : parts[0];
    return pick !== undefined && !NOT_IPA.test(pick) ? pick : undefined;
};

// #562 symbol normalization — % is the only symbol in the Arabic FLEURS text. في المئة (the standard
// written form, matching FLEURS' MSA-leaning register) reads cleanly through the diacritizer as
// fi ilmiʔa; the Egyptian colloquial المية spelling vocalized worse. Shared path — only arz has corpus %.
const SYMBOLS = makeSymbolNormalizer({
    // ⚠ THE AMPERSAND WAS A MISSING CELL, NOT A SOURCING PROBLEM — the tier's own `ampersand` note says so,
    // and this language is one of the fourteen that still had no word declared, so `&` was DROPPED outright.
    // وَ is ×71 TOKEN in this language's own corpus, i.e. among its commonest words; there was nothing to source.
    //
    // A Latin-script printing LIGATURE rather than anything native, so what it takes is a reading and not a
    // translation: for a language written in Latin script that is its own conjunction, and for one that is not,
    // the symbol only ever arrives inside a Latin run. Either way the tier substitutes the conjunction, SPACED —
    // see the tier, where the spacing exists because `B&B` is two initialisms.
    ampersand: "وَ",
    // Every emitted word carries HARAKAT: the engine reads undiacritized Arabic as a consonant skeleton,
    // so "في المئة" came out [fj almʔ] where "فِي الْمِئَة" gives [fˈiː almˈiʔa].
    percent: ["فِي الْمِئَة"],
    // Absent entirely before: a currency sign was DROPPED ($50 read as just "خمسون").
    currency: { $: ["دُولَار"], "€": ["يُورُو"], "£": ["جُنَيْه"], "¥": ["يِن"] },
    units: { km: ["كِيلُومِتْر"], cm: ["سِنْتِيمِتْر"], mm: ["مِلِّيمِتْر"], kg: ["كِيلُوجِرَام"],
        m: ["مِتْر"], g: ["جِرَام"], "km/h": ["كِيلُومِتْر فِي السَّاعَة"] },
    // `كيلومتر مربع` ×8 — the adjective FOLLOWS its noun, as Arabic adjectives do. Vocalised to match the
    // rest of this table; the corpus writes it bare, and the diacritizer would have to guess otherwise.
    // No cubed word: `متر مكعب` is zero in this corpus, so `m³` keeps the documented unit-plus-`³` fallback
    // rather than a plausible invention.
    // `متراً مكعّباً` — the corpus's cubic-metre sentence, adjective FOLLOWING as Arabic adjectives do, same
    // side as مربع above. (An earlier pass probed the bare `متر مكعب` and read ×0; the corpus writes it with
    // case endings, which a token probe for the bare form cannot match — the sentence is the evidence.)
    exponentWords: { squared: ["مُرَبَّع"], cubed: ["مُكَعَّب"], position: "after" },
});

class ArabicPhonemizer implements Phonemizer {
    constructor(
        private variety?: string,
        private useLexicon = false,
    ) {}
    text(input: string): string {
        // Arabic-specific rewrites (٪/٫/٬ folding, units, clock, signs) then the shared tier.
        input = SYMBOLS(normalizeArabic(input));
        // The Egyptian lexicon keys on the BARE word; the input here is diacritized (post neural-diacritizer), so
        // strip the harakat to look it up, and only for the egyptian variety with the lexicon enabled (shipped).
        const lex =
            this.variety === "egyptian" && this.useLexicon
                ? egyptianLexicon()
                : undefined;
        return assembleClauses(input, TOKEN, (m, sink) => {
            if (m[1])
                sink.emit(
                    lex?.get(m[1].replace(HARAKAT, "")) ??
                        phonemizeWord(m[1], this.variety),
                );
            else if (m[2]) {
                const nums = this.variety ? VARIETIES[this.variety]?.numbers : undefined;
                const [intPart, frac] = toAscii(m[2]).replace(/,/gu, "").split(".");
                const parts = [numberToIpa(Number(intPart), nums)];
                if (frac !== undefined) {
                    // A decimal is read "فاصلة" then the fractional digits one by one.
                    parts.push(phonemizeWord("فَاصِلَة", this.variety));
                    for (const d of frac) parts.push(numberToIpa(Number(d), nums));
                }
                sink.emit(parts.join(" "));
            }
            else if (m[3]) {
                const mk = CLAUSE_MARK[m[3]];
                if (mk) sink.pause(mk);
            }
        });
    }
}

/** Build the Arabic phonemizer for `variety` (undefined/"msa" = Modern Standard Arabic; "egyptian" = arz, …).
 *  `useLexicon` enables the Egyptian short-vowel lexicon (shipped; off for the non-circular referee eval).
 *  Expects diacritized input; the neural diacritizer pre-pass (phonemizeArabic) restores short vowels for bare text. */
export function createArabic(variety?: string, useLexicon = false): Phonemizer {
    return new ArabicPhonemizer(variety, useLexicon);
}

// Per-variety diacritizer cache: egyptian gets the Egyptian student model (diacritizer-egy), everything else the
// MSA model. Keyed so each variety's ONNX session is created once and reused.
const diacritizers = new Map<string, Promise<ArabicDiacritizer | undefined>>();
const phonemizers = new Map<string, Phonemizer>();
// Tashkeela-derived PAUSAL restoration lexicon (undiacritized → vocalized) — the supplement that repairs words the
// neural diacritizer leaves as skeletons. Optional: absent → the restore pass falls back to epenthesis only.
let restoreLexicon: ReadonlyMap<string, string> | undefined;
function restoreLex(): ReadonlyMap<string, string> {
    if (restoreLexicon === undefined)
        restoreLexicon = loadTsvMap(import.meta.url, "diacritization.tsv", undefined, {
            optional: true,
        });
    return restoreLexicon;
}

/**
 * Phonemize BARE (undiacritized) Arabic. Runs the neural diacritizer pre-pass (ONNX, async) to restore short
 * vowels, then the synchronous g2p. Requires the optional `onnxruntime-node` dependency and the diacritizer
 * model beside this module; if the model is absent it falls back to phonemizing the input as-is (which is
 * correct only for already-diacritized text). Diacritized input can use the sync `phonemize(text, "ar")`.
 *
 * `opts.lexicon` (default TRUE) enables the Egyptian short-vowel lexicon for `variety:"egyptian"` — a SHIPPED
 * refinement over the MSA-diacritizer vowels. The referee eval passes `lexicon:false` to keep the number
 * non-circular (the lexicon is mined from the same Wiktionary tradition as the wikipron-arz referee).
 */

// ── Foreign-cluster repair (Run 28: سنترال → sntrˈaːl) ──────────────────────────────────────────────────────
// The neural diacritizer vocalizes native words and FREQUENT loans (كمبيوتر → kumbijuːtar), but rare
// transliterations come back with few or no diacritics, and the g2p then emits consonant runs no Arabic
// syllable allows — (C)V(C)(C) permits at most CC, so a 3+-consonant run is always a vocalization failure
// (2.4% of FLEURS arz tokens: Carolyn kˈaːrwljn, Booking bwknɡ, microwave mjkrwwjf). Two repairs, applied
// word-wise to the ASYNC path's final IPA (the sync path expects vocalized input and is left alone):
//   Tier 1 — mater lectionis: inside an illegal run, و/ي were written AS VOWEL CARRIERS (o/u, e/i) but were
//   read as consonants w/j. Re-reading them as u/i fixes most words outright: bwknɡ → buknɡ → (tier 2)
//   bukinɡ; ˈiwtwbjs → utubiːs-shaped (autobus). The letter itself marks where the vowel goes — no guessing.
//   Tier 2 — epenthesis: residual 3+ runs get the variety's epenthetic vowel INSIDE the run, the repair
//   Arabic speakers themselves apply to foreign clusters. Insertion after the FIRST consonant of the run —
//   selected by measuring both documented templates (Broselow's after-first vs after-second) against 57
//   attested loanword transcriptions; after-first scored higher (booking → bukinɡ, not bukniɡ).
// Both passes no-op on any legally-syllabified word, so native output is untouched by construction.
// CAVEAT for future variety work: Moroccan (ary) legitimately allows heavy clusters in real Darija (ktbt).
// Today that is moot — every variety runs the MSA diacritizer first, so ary output arrives vocalized and
// the repair never fires on it (كتبت → kutˈibat). If ary ever gains true schwa-deletion, gate this repair
// per variety (or raise its run threshold for ary) BEFORE shipping that change.
const REPAIR_VOWELS = new Set([..."aeiouɑɐæəɛɔʊɪ"]);
const REPAIR_SKIP = new Set([..."ˈˌːˤ\u0651\u0640"]);

interface RUnit { text: string; vowel: boolean }
function repairUnits(word: string): RUnit[] {
    const out: RUnit[] = [];
    for (const ch of word.normalize("NFD")) {
        if (/\p{M}/u.test(ch) || REPAIR_SKIP.has(ch) || ch === "͡") {
            if (out.length) out[out.length - 1]!.text += ch;
            else out.push({ text: ch, vowel: false });
            continue;
        }
        out.push({ text: ch, vowel: REPAIR_VOWELS.has(ch) });
    }
    return out;
}

/** One word of final IPA → repaired IPA. `epenthetic` is the variety's cluster-repair vowel. */
export function repairForeignClusters(word: string, epenthetic = "i"): string {
    const units = repairUnits(word);
    // maximal consonant runs (stress marks travel with their unit; a unit whose BASE is a vowel ends a run)
    const runAt = (i: number): number => {
        let n = 0;
        while (i + n < units.length && !units[i + n]!.vowel) n++;
        return n;
    };
    let changed = false;
    // Tier 1: w/j inside an illegal run become u/i (leftmost first; re-scan, since each conversion splits a run)
    for (let guard = 0; guard < 8; guard++) {
        let acted = false;
        for (let i = 0; i < units.length; i++) {
            if (units[i]!.vowel) continue;
            const n = runAt(i);
            if (n < 3) { i += n; continue; }
            for (let k = i; k < i + n; k++) {
                const base = units[k]!.text[0];
                if (base === "w" || base === "j") {
                    units[k] = { text: (base === "w" ? "u" : "i") + units[k]!.text.slice(1), vowel: true };
                    acted = changed = true;
                    break;
                }
            }
            if (acted) break;
            i += n;
        }
        if (!acted) break;
    }
    // Tier 2: epenthesis after the FIRST consonant of each remaining 3+ run
    for (let guard = 0; guard < 8; guard++) {
        let acted = false;
        for (let i = 0; i < units.length; i++) {
            if (units[i]!.vowel) continue;
            const n = runAt(i);
            if (n >= 3) {
                units.splice(i + 1, 0, { text: epenthetic, vowel: true });
                acted = changed = true;
                break;
            }
            i += n;
        }
        if (!acted) break;
    }
    return changed ? units.map((u) => u.text).join("").normalize("NFC") : word;
}

/** Sentence-level wrapper: repair each word token, leave pause marks alone. */
function repairSentence(ipa: string, epenthetic = "i"): string {
    return ipa
        .split(" ")
        .map((t) => (/^[.,!?;:…]+$/.test(t) ? t : repairForeignClusters(t, epenthetic)))
        .join(" ");
}

export async function phonemizeArabic(
    text: string,
    variety?: string,
    opts?: { lexicon?: boolean },
): Promise<string> {
    const dkey = variety === "egyptian" ? "egyptian" : "msa";
    let diacP = diacritizers.get(dkey);
    if (!diacP) diacritizers.set(dkey, (diacP = createArabicDiacritizer(variety)));
    const diac = await diacP;
    // The diacritizer + Tashkeela restore lexicon are MSA (shared): they restore the MSA vocalization, which the
    // variety g2p then transforms. Egyptian short vowels differ from MSA — the egyptian-lexicon.tsv supplies them.
    // symbol words must be inserted BEFORE diacritization — a percent word injected after it would
    // reach the g2p as a bare skeleton (المئة → ilimʔ) instead of being vocalized (fi ilmiʔa).
    text = SYMBOLS(text);
    const vocalized = diac ? await diac.diacritize(text) : text;
    const restored = diac ? lexiconPrimary(vocalized, restoreLex()) : vocalized;
    const useLexicon = opts?.lexicon ?? true;
    const key = `${variety ?? "msa"}${useLexicon ? "" : ":nolex"}`;
    let phon = phonemizers.get(key);
    if (!phon) phonemizers.set(key, (phon = createArabic(variety, useLexicon)));
    return repairSentence(phon.text(restored));
}
