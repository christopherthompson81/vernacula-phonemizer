/**
 * Native Tagalog / Filipino (tl) text phonemizer — canonical IPA, espeak-independent. A shallow near-phonemic
 * Latin orthography → rule-based transliterator: digraphs (ng→ŋ, ch→t͡ʃ, ny/ñ→ɲ, sy→ʃ) then single letters,
 * with a WORD-INITIAL glottal stop [ʔ] before a vowel and a hyphen → [ʔ] (pag-asa→paɡʔasa); whole-word
 * irregulars (mga→maŋa, ng→naŋ). Stress defaults to PENULTIMATE but is phonemic and unwritten, so the shipped path
 * pins the ~23% non-penultimate cases from a kaikki-sourced stress lexicon (magandá, ngayón); the rule engine keeps
 * the penult default (the referee eval folds stress). Intervocalic/word-final glottal stops are likewise phonemic
 * but unwritten (bata 'child' [ˈbataʔ] vs bata 'robe' [ˈbata]) — a lexical residual. See docs/investigations/tl_native_bringup_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { LATIN_RUN, makeNativiser } from "../../core/hostWord.ts";
import { loadManifest } from "../../core/loadManifest.ts";
import { loadLines, loadTsvMap } from "../../core/loadTsv.ts";

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
interface TagalogDef {
    digraphs: Record<string, string>;
    consonants: Record<string, string>;
    vowels: Record<string, string>;
    specialWords: Record<string, string>;
    clausePunctuation: Record<string, string>;
    numbers: NumbersDef;
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
// path only — homographs are abstained. See docs/investigations/tl_native_bringup_investigation.md.
let FINAL_GLOTTAL: ReadonlySet<string> | undefined;
const finalGlottal = (): ReadonlySet<string> =>
    (FINAL_GLOTTAL ??= new Set(loadLines(import.meta.url, "final-glottal.txt")));

// Phonemic stress is UNWRITTEN; the rule engine defaults to PENULTIMATE, but ~23% of words stress elsewhere (mostly
// FINAL: balik→balík). This MAP (stress-lexicon.tsv, kaikki-sourced: single confident stress position, vowel-count-
// aligned, only where it differs from the penult default) moves the stress mark on the SHIPPED path only — the eval
// backbone folds stress ˈˌ, so this is a TTS-quality closure invisible to the referee %. See the investigation doc.
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
// loanword glide/plain, so a referee-mined pin corrupts core words (siya, tao) — see the investigation doc. This
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

// ⚠ ALL OF LATIN, not just Tagalog's own letters — `[A-Za-zÑñ]+` ended the token at an out-of-class diacritic,
// so the letter carrying it became an unclaimed gap read as an English LETTER NAME and the rest of the word
// started over: `São Paulo` → *s ˈə ʔˈo paʔˈulo*, `Klöcker` → *kl ˈoᶷ kkˈeɾ*. Invisible to every gate — no digit
// or raw mark survives and nothing VANISHES, so neither the leak classes nor the differential DROP test see it.
// The hyphen-compound shape is preserved: Tagalog writes `kaibigan-ko` and the two halves are ONE word.
const TOKEN = new RegExp(`(${LATIN_RUN}(?:[-‑]${LATIN_RUN})*)|(\\d+)|([.?!,;:])`, "gu");
/**
 * Tagalog's OWN inventory — the token class as it stood before the widening, lifted verbatim.
 *
 * ⚠ `Ñ`/`ñ` IS NATIVE HERE, which is why the fold below has to be CONDITIONAL. Tagalog inherited the letter
 * from Spanish and reads it as /ɲ/ — `Doña` → *dˈoɲa*, `Cañitas` → *kaɲˈitas*, both already correct. Folding
 * every accent to its base the way pcm does would have destroyed exactly the accented letter this language CAN
 * read, turning `ñ` into `n`. So the fold applies only to a token this class REJECTS.
 */
const NATIVE_WORD = /^[A-Za-zÑñ]+(?:[-‑][A-Za-zÑñ]+)*$/u;
/**
 * NATIVISE a foreign name: fold an out-of-inventory accent to a base this g2p has a rule for. `NATIVE_WORD`
 * above is the inventory — a word it rejects carries a letter this language does not use. See
 * `core/hostWord.ts` for why the inventory and the script boundary are two different questions (#657).
 */
const nat = makeNativiser(NATIVE_WORD);

class TagalogPhonemizer implements Phonemizer {
    constructor(private foreign?: ForeignPhonemizer) {}
    text(input: string): string {
        return assembleClauses(input, TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(nat(m[1])));
            else if (m[2]) {
                const n = Number(m[2]);
                if (Number.isSafeInteger(n))
                    // Number words take the NUMBER-sense stress (numberStressIdx: final-except-penult, correct for
                    // the number reading of homographs like isá/limá/pitó) and bypass the final-glottal set, which
                    // fires inconsistently by incidental membership (sampu→sampuʔ but dalawampu not).
                    for (const wd of numberWords(n).split(" "))
                        sink.emit(phonemizeCore(wd, numberStressIdx(wd)));
            } else if (m[3]) {
                const mk = CLAUSE_MARK[m[3]];
                if (mk) sink.pause(mk);
            }
        });
    }
}

/** Build the Tagalog phonemizer. */
export function createTagalog(): Phonemizer {
    return new TagalogPhonemizer();
}
