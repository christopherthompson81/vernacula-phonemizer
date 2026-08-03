/**
 * Native Oromo / Afaan Oromoo (om) text phonemizer — canonical IPA, espeak-independent. A shallow near-phonemic
 * Latin (Qubee) orthography → rule-based transliterator: digraphs (ch→t͡ʃ, dh→ᶑ, ny→ɲ, ph→pʼ, sh→ʃ) then single
 * letters, with DOUBLED VOWELS = long (aa→aː) and DOUBLED CONSONANTS = geminate (bb→bː); a geminate DIGRAPH doubles
 * its first letter (ddh→[ᶑː], cch→[t͡ʃː]). The apostrophe → glottal stop [ʔ] (buʼaa→buʔaː). Qubee is largely
 * phonemic → the g2p is deterministic. Oromo (Cushitic) fills a census gap: the EJECTIVES c/q/x/ph + implosive dh.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { loadManifest } from "../../core/loadManifest.ts";
import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";
import { numberToWords } from "./numbers.ts";
import { normalizeOromo, normalizeOromoInitialisms, normalizeOromoNumerals } from "./normalize.ts";

interface OromoDef {
    digraphs: Record<string, string>;
    consonants: Record<string, string>;
    vowels: Record<string, string>;
    clausePunctuation: Record<string, string>;
}
const DEF = loadManifest<OromoDef>(import.meta.url, "oromo.jsonc");
const CLAUSE_MARK = DEF.clausePunctuation;

export type ForeignPhonemizer = (latin: string) => string;

const APOSTROPHE = new Set(["'", "ʼ", "’"]); // ' ʼ ’ → glottal stop

/** Scan a lowercased Oromo word → IPA units (digraphs, gemination, length, glottal stop). */
function scan(w: string): string[] {
    const s = [...w.toLowerCase()];
    const out: string[] = [];
    for (let i = 0; i < s.length; ) {
        const c = s[i]!;
        if (APOSTROPHE.has(c)) {
            // The glottal stop is written with an apostrophe only INTERIOR (buʼaa, saʼa); a word-edge apostrophe is
            // a quotation mark, not a glottal (and ’ U+2019 doubles as a closing quote), so emit [ʔ] only between
            // letters — a letter before, and a non-apostrophe letter after.
            const next = s[i + 1];
            if (i > 0 && next !== undefined && !APOSTROPHE.has(next)) out.push("ʔ");
            i++;
            continue;
        }
        // Geminate DIGRAPH: a doubled first letter + a digraph (Qubee writes it ddh/cch/nny/ssh/pph → [ᶑː]/[t͡ʃː]…).
        if (s[i + 1] === c) {
            const dg2 = (s[i + 1] ?? "") + (s[i + 2] ?? "");
            if (DEF.digraphs[dg2]) {
                out.push(DEF.digraphs[dg2]! + "ː");
                i += 3;
                continue;
            }
        }
        // Plain digraph.
        const dg = c + (s[i + 1] ?? "");
        if (DEF.digraphs[dg]) {
            out.push(DEF.digraphs[dg]!);
            i += 2;
            continue;
        }
        // Doubled letter → long vowel (aa→aː) or geminate consonant (bb→bː).
        if (s[i + 1] === c) {
            const single = DEF.vowels[c] ?? DEF.consonants[c];
            if (single !== undefined) {
                out.push(single + "ː");
                i += 2;
                continue;
            }
        }
        // Single letter.
        const single = DEF.vowels[c] ?? DEF.consonants[c];
        if (single !== undefined) out.push(single);
        i++;
    }
    return out;
}

// ── Stress ────────────────────────────────────────────────────────────────────────────────────────────────
// Oromo stress is PHONETIC and PREDICTABLE — "there is no lexical contrast by making use of stress, and it could
// be predictable from the environment of the utterance" (Dejene Geshe, *Kamisee Oromo Phonology*, Addis Ababa
// University MA thesis, 2010, §5.3.1). The same patterns are reported for the MECHA dialect by Waqo (1981:44) and
// Gragg (1976:175), so this is not one dialect's quirk. Dejene further argues (§5.4.3) that the dialect is a
// STRESS language employing pitch rather than a tone language, against Habte (2003).
//
// The thesis rules, verbatim:
//   1) monosyllables are stressed
//   2) disyllabic ending in a SHORT vowel → primary on the PENULT, "whatever the length of the vowel of a
//      preceding syllable"
//   3) polysyllabic with NO long vowels  → primary on the PENULT
//   4) ending in a LONG vowel            → primary on the ULTIMATE
//   5) ending in a CONSONANT             → primary on the ULTIMATE if all syllables are short; if another
//      syllable has a long vowel, THAT one takes primary
//   fn16) a non-ultimate long vowel with a short ultimate attracts the stress
//
// Validated against a genuinely INDEPENDENT source — the 39 accent-marked kaikki (Wiktionary) human
// transcriptions in tools/referee-eval/referees/om.human-kaikki.tsv: **76.9% as written, 92.3%** with the
// infinitive refinement below. Neither source saw the other.
const IS_VOWEL = new Set([...Object.values(DEF.vowels)]);
const isVowelUnit = (u: string): boolean => IS_VOWEL.has(u.replace(/ː/g, ""));

/** Nucleus indices into the unit array, with whether each is long. */
function nuclei(units: string[]): Array<{ at: number; long: boolean }> {
    const out: Array<{ at: number; long: boolean }> = [];
    units.forEach((u, i) => {
        if (isVowelUnit(u)) out.push({ at: i, long: u.includes("ː") });
    });
    return out;
}

// §5.3.1 rule 7 — "The following open mono syllabic words are unstressed": the focus marker and the short
// object pronouns. They are high-frequency in running text, so leaving them stressed would put a spurious
// prominence on a clitic-like particle in almost every sentence. Matched on the ORTHOGRAPHY (the scan
// lowercases), which is where the thesis states them.
const UNSTRESSED_WORDS = new Set(["tu", "nu", "na", "si"]);

/** Index of the syllable carrying primary stress, or -1 to leave the word unmarked. */
function stressIndex(units: string[], word: string): number {
    if (UNSTRESSED_WORDS.has(word.toLowerCase())) return -1; // rule 7
    const nu = nuclei(units);
    const n = nu.length;
    if (n === 0) return -1;
    if (n === 1) return 0; // rule 1

    // The INFINITIVE suffix -uu does not attract stress; it is extrametrical. The thesis's rule-4 examples are
    // all nouns/adjectives in -aa/-oo/-ii (sàngáa, dargàggóo, ʔàdíi) — never infinitives — and the independent
    // kaikki data marks every -uu infinitive on an earlier syllable (ˈdɪ́duː, ˈbɐ́nuː, ʔɐdʒˈdʒeːsuː). Adding this
    // takes agreement 76.9% → 92.3%. KNOWN LIMIT: a NOUN in -uu is misread the same way (tiruu 'liver' is
    // tɪˈrúː, we predict the penult) — telling the two apart needs morphology we do not have here.
    const last = nu[n - 1]!;
    const endsWithVowel = last.at === units.length - 1;
    if (endsWithVowel && last.long && units[last.at]!.startsWith("u")) {
        const head = nu.slice(0, -1);
        for (let k = head.length - 1; k >= 0; k--) if (head[k]!.long) return k;
        return head.length - 1;
    }

    if (!endsWithVowel) {
        // rule 5: a long vowel anywhere else outranks the ultimate
        for (let k = 0; k < n - 1; k++) if (nu[k]!.long) return k;
        return n - 1;
    }
    if (last.long) return n - 1; // rule 4
    // ultimate is a SHORT vowel → fn16, else rules 2/3 (penult)
    for (let k = n - 2; k >= 0; k--) if (nu[k]!.long) return k;
    return n - 2;
}

/** Insert the primary-stress mark before the nucleus of the selected syllable (the fleet convention: kˈiː). */
function applyStress(units: string[], word: string): string[] {
    const idx = stressIndex(units, word);
    if (idx < 0) return units;
    const nu = nuclei(units);
    const at = nu[idx]!.at;
    return [...units.slice(0, at), "ˈ", ...units.slice(at)];
}

/** One Oromo word → canonical IPA. */
export function phonemizeWord(word: string): string {
    return applyStress(scan(word), word).join("").normalize("NFC");
}

/** One Oromo word → canonical IPA, WITHOUT the stress layer (the referee eval's segmental signal). */
export function phonemizeWordSegmental(word: string): string {
    return scan(word).join("").normalize("NFC");
}

const TOKEN = /([A-Za-zʼ’']+)|(\d+)|([.?!,;:])/gu;

/**
 * The shared SYMBOL tier (#562) — percent and currency, the two classes whose word is language DATA.
 *
 * BOTH ARE PREFIXED, because Oromo is head-initial for measure phrases: the corpus writes
 * `parsantii 3 hanga 5`, `dhibbeentaan tokko`, `doolaara US biiliyoonotaan`, `paawundii 200`,
 * `daqiiqaa 3` — the noun, then the number. Count forms are single-entry: an Oromo noun does not
 * inflect for the numeral that counts it (`kiiloo meetira 1600`, `paawundii 1,000`).
 *
 * SOURCING (playbook §5e — a wrong word is worse than a dropped sign; the evidence table is in
 * docs/investigations/om_normalization_investigation.md, Run 4):
 *   parsantii          FLEURS om_et ×3 (`parsantii 3 hanga 5`) + espeak-ng dictsource om_list `%`
 *   doolaara           FLEURS om_et ×1 (`doolaara US biiliyoonotaan`) + epitran referee + om_list `_$`
 *   doolaara Ameerikaa both words corpus-attested; `US$` is declared as a compound key because a bare
 *                      `$` cannot match inside `US$11,000` (the tier is letter-bounded on the left)
 *   paawundii          FLEURS om_et ×5 + om_list `£`. The corpus's five are the WEIGHT noun; Oromo
 *                      borrows one word for both senses, as English does
 *   yuuroo             om_list `€` only — and `€` never occurs in the corpus, so it carries no reading
 * NOT declared: `¥`, which has no source and no instance. UNITS are not declared here at all — the tier
 * can only postpose them, and Oromo puts them first; normalize.ts owns them.
 */
const SYMBOLS = makeSymbolNormalizer({
    percent: ["parsantii"],
    percentPrefix: true,
    currency: {
        "US$": ["doolaara Ameerikaa"],
        "$": ["doolaara"],
        "£": ["paawundii"],
        "€": ["yuuroo"],
    },
    currencyPrefix: true,
});

class OromoPhonemizer implements Phonemizer {
    constructor(private foreign?: ForeignPhonemizer) {}
    text(input: string): string {
        // normalize.ts, then the shared tier, then normalize.ts's number pass. The tier matches DIGITS
        // beside a sign, so every rule that turns digits into WORDS — the glued Oromo enclitic and the
        // decimal — has to run after it (trap 14 from the other end). That ordering is what keeps the
        // currency and percent words in ONE place, the declaration above.
        // The INITIALISM pass runs LAST of the three text passes: after normalizeOromo has expanded the
        // dotted abbreviations and the era marker (or `D.K.D` would be spelled DAA-KAA-DAA), and after the
        // symbol tier, whose signs are not letter runs. `core/roman.ts` is applied in registry.ts, wrapping
        // this method, so Roman numerals are digits before any of this — see normalize.ts's note on why that
        // ordering is what keeps the emitted vowel name `ii` from being read as "two".
        const normalized = normalizeOromoInitialisms(normalizeOromoNumerals(SYMBOLS(normalizeOromo(input))));
        return assembleClauses(normalized, TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(m[1]));
            else if (m[2])
                for (const wd of numberToWords(Number(m[2])).split(" ")) sink.emit(phonemizeWord(wd));
            else if (m[3]) {
                const mk = CLAUSE_MARK[m[3]];
                if (mk) sink.pause(mk);
            }
        });
    }
}

/** Build the Oromo phonemizer. `foreign` reads digit runs (English, wired in the registry) — a stopgap
 *  pending a proper Oromo numeral compositor; digits used to be dropped from the output entirely. */
export function createOromo(foreign?: ForeignPhonemizer): Phonemizer {
    return new OromoPhonemizer(foreign);
}
