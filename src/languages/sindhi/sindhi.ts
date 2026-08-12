/**
 * Native Sindhi (sd) text phonemizer — canonical IPA. Perso-Arabic (Sindhi) ABJAD → the
 * consonant + LONG-vowel skeleton (incl. the signature IMPLOSIVES ٻɓ ڏɗ ڄʄ ڳɠ and the retroflex series) via a
 * rule g2p; SHORT vowels are usually UNWRITTEN, so a default [ə] stands in (the abjad wall, as for Urdu — folded in
 * the referee eval). ھ aspirates the sonorants + ج/گ (جھ→d͡ʒʰ); و/ي are long vowels after a consonant, glides
 * elsewhere.
 */
import type { Phonemizer } from "../../registry.ts";
import { renderNumber, spellDigits, type NumbersDef } from "../../core/numbers.ts";
import { normalizeSindhi } from "./normalize.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { LATIN_RUN } from "../../core/hostWord.ts";
import { loadManifest } from "../../core/loadManifest.ts";
import { loadTsvMap } from "../../core/loadTsv.ts";
import { applyWeightStress } from "../../core/weightStress.ts";

interface SindhiDef {
    consonants: Record<string, string>;
    aspirateWithHe: Record<string, string>;
    longVowels: Record<string, string>;
    glides: Record<string, string>;
    harakat: Record<string, string>;
    clausePunctuation: Record<string, string>;
    /** Indic lakh/crore number words — see the note in sindhi.jsonc on how each form was sourced. */
    numbers: NumbersDef;
}
const DEF = loadManifest<SindhiDef>(import.meta.url, "sindhi.jsonc");
const CLAUSE_MARK = DEF.clausePunctuation;

export type ForeignPhonemizer = (latin: string) => string;

const HE = "ھ";
// The scan marks its DEFAULT-inserted [ə] with a private-use sentinel so the nasal-assimilation pass can consume
// that ə without touching an ə the writer actually spelled with a harakat. Without this, نَب (explicit fatha)
// lost its written vowel: `nə?(?=[bpɓ])` ate it and the word came out mb. Stripped back to ə at the end of
// phonemizeCore, so the sentinel never escapes this module.
const DEFAULT_SCHWA = "\uE000";
const NOON_GHUNNA = "ں"; // nasalization
const isConsonant = (c: string): boolean => c in DEF.consonants;
const isVowelLetter = (c: string): boolean => c in DEF.longVowels;

/** Scan a Sindhi (Perso-Arabic) word → IPA. Consonants + long vowels are recoverable; short vowels default to [ə].
 *
 *  `vocalized`: the word is FULLY harakat-marked (a diacritized dictionary headword rather than running text).
 *  Then the diacritics are authoritative and the default-[ə] insertion must be OFF — an unmarked consonant cluster
 *  means there is NO vowel there, not an unwritten one. Reading اُستادُ with insertion on gives ʊsət̪aːd̪ʊ; the
 *  attested form is ʊst̪aːd̪ʊ. */
function scan(word: string, vocalized = false): string {
    const s = [...word];
    const out: string[] = [];
    let prevNucleus = false; // was the last emitted unit a vowel nucleus?
    for (let i = 0; i < s.length; ) {
        const c = s[i]!;
        // harakat → explicit short vowel
        if (DEF.harakat[c]) {
            out.push(DEF.harakat[c]!);
            prevNucleus = true;
            i++;
            continue;
        }
        // ں → nasalize the preceding vowel
        if (c === NOON_GHUNNA) {
            if (prevNucleus) out[out.length - 1] += "̃";
            i++;
            continue;
        }
        // long-vowel / glide letters: a long vowel after a consonant, a glide word-initially or in hiatus
        if (isVowelLetter(c)) {
            if (out.length === 0) {
                // word-initial vowel carrier: آ (madda) is [aː]; bare ا is a short [ə] carrier; و/ي → glide.
                // If a harakat FOLLOWS the bare alif it is the carrier's vowel (اِجازت ɪd͡ʒaːzət̪ə, اُستاد ʊst̪aːd̪ʊ) —
                // emit nothing here and let the harakat supply it, or the two stack into a spurious əi/əu.
                if (c === "ا" && DEF.harakat[s[i + 1] ?? ""]) {
                    prevNucleus = false;
                    i++;
                    continue;
                }
                out.push(c === "آ" ? "aː" : c === "ا" ? "ə" : (DEF.glides[c] ?? DEF.longVowels[c]!));
                prevNucleus = c === "و" || c === "ي" || c === "ی" || c === "ے" ? false : true;
            } else if (prevNucleus) {
                out.push(DEF.glides[c] ?? DEF.longVowels[c]!);
                prevNucleus = false;
            } else {
                out.push(DEF.longVowels[c]!);
                prevNucleus = true;
            }
            i++;
            continue;
        }
        // ئ/ؤ are hamza SEATS (not a glottal stop): they carry a hiatus vowel — emit nothing but break the glide so
        // a following ي/و is read as a full vowel (آئينو→aːiːnoː, not aːjnoː).
        if (c === "ئ" || c === "ؤ") {
            prevNucleus = false;
            i++;
            continue;
        }
        // ع is usually SILENT / a vowel modifier in Sindhi (تعليم→t̪əliːm), not a full [ʔ] — skip it.
        if (c === "ع") {
            i++;
            continue;
        }
        // word-final ه/ہ/ح is a silent vowel-carrier (ٻه→ɓə, روح→ruh→ru), not [h]
        if ((c === "ه" || c === "ہ" || c === "ح") && i === s.length - 1) {
            i++;
            continue;
        }
        // consonants; do-chashmi ھ (U+06BE) after ج/گ/a sonorant → aspiration (جھ→d͡ʒʰ, لھ→lʰ). Plain ه (U+0647)
        // is the /h/ CONSONANT, NOT an aspiration marker — the letters are contrastive (نه→nə, مهينو→məhiːnoː,
        // NOT nʰə/mʰiːnoː). Words that spell aspiration with plain ه (گهوڙو) are orthographic variants that collide
        // with real /h/ and can't be disambiguated from the letter alone (the abjad ambiguity — a lexicon tail).
        if (isConsonant(c)) {
            if (s[i + 1] === HE && DEF.aspirateWithHe[c]) {
                out.push(DEF.aspirateWithHe[c]!);
                i += 2;
            } else {
                out.push(DEF.consonants[c]!);
                i++;
            }
            prevNucleus = false;
            // insert a default short [ə] when no vowel is written before the next consonant / word-end (abjad).
            const nx = s[i] ?? "";
            if (!vocalized && (nx === "" || (isConsonant(nx) && !(nx === HE)))) {
                out.push(DEFAULT_SCHWA);
                prevNucleus = true;
            }
            continue;
        }
        i++; // unknown → skip
    }
    return out.join("");
}

/** Rule g2p: consonant + long-vowel skeleton with default-[ə] short vowels, then homorganic nasal assimilation
 *  before a velar → ŋ (انگ→əŋɡ), labial → m (انب→əmb), retroflex → ɳ (آنڊو→aːɳɖo), palatal → ɲ (پنج→pəɲd͡ʒ),
 *  dental → plain n (سنڌ→sənd̪ʰ).
 *
 *  Each rule also CONSUMES the default [ə] the abjad scan inserted between the nasal and the stop. A homorganic
 *  nasal + stop is a single tautosyllabic cluster in Sindhi — it is never broken by a vowel — so the scan's
 *  blanket "consonant before consonant → ə" is wrong here. The lexicon goldens show this directly: انب is əmb
 *  (not əməb) and سنڌي is sɪndʱiː (not sɪnədʱiː). Measured over the 539-word lexicon, dropping the ə here fixes
 *  12 of the 53 places where the rule path split a cluster the attested form keeps (53 → 41).
 *
 *  The other 41 (sC- st/sp/sk, obstruent+liquid kɾ/kl/pɾ, and assorted codas lm/ɾs/kt) are deliberately left
 *  alone: unlike the homorganic nasal they are not categorically un-splittable in Sindhi, and the lexicon does
 *  not carry enough same-shape pairs to tell a real cluster from a genuine epenthesis word-by-word. Re-measured
 *  later on the full 9,920-word lexicon, only 8.9% of ALL default-ə insertions are wrong, so this is a narrow
 *  correction rather than a large one. */
function phonemizeCore(word: string, vocalized = false): string {
    return scan(word, vocalized)
        .replace(/n\uE000?(?=(?:kʰ|[kɡxɠ]))/gu, "ŋ")
        .replace(/n\uE000?(?=[bpɓ])/gu, "m")
        .replace(/n\uE000?(?=[ʈɖɳɽ])/gu, "ɳ")
        .replace(/n\uE000?(?=(?:d͡ʒ|t͡ʃ|ʄ))/gu, "ɲ")
        .replace(/n\uE000(?=t̪|d̪)/gu, "n")
        .replace(/\uE000/gu, "ə")
        .normalize("NFC");
}

// SHORT-VOWEL restoration lexicon (sindhi-lexicon.tsv): bare word → voweled IPA, mined from kaikki Sindhi
// (Wiktionary, CC BY-SA). The Perso-Arabic abjad leaves short vowels unwritten, so the rule g2p defaults every
// one to [ə] (زبان → zəbaːnə); this restores the attested Sindhi short vowels (zʊbaːnə), the Urdu restoreHarakat
// pattern. The referee eval FOLDS short vowels (abjad wall) so it scores the RULE path (phonemizeWordRules,
// non-circular); this lexicon is a SHIPPED refinement — its value is the correct vocalization for TTS.
let LEX: ReadonlyMap<string, string> | undefined;
const lexicon = (): ReadonlyMap<string, string> =>
    (LEX ??= loadTsvMap(import.meta.url, "sindhi-lexicon.tsv", undefined, { optional: true }));

/** One Sindhi word → canonical IPA, SHIPPED path (rule g2p + the kaikki short-vowel restoration lexicon).
 *  Lexicon entries are stored UNSTRESSED (as for Urdu), so weight stress is applied at lookup — one stress
 *  policy for both the lexicon and the rule path. */
export function phonemizeWord(word: string): string {
    return stress(lexicon().get(word) ?? phonemizeCore(word));
}

/** One Sindhi word → canonical IPA, RULE-ONLY (no lexicon) — the non-circular signal for the referee eval. */
export function phonemizeWordRules(word: string): string {
    return stress(phonemizeCore(word));
}

/** Quantity-sensitive word stress — the shared Indo-Aryan weight rule already used by hi/ur/pa
 *  (rightmost superheavy, else rightmost non-final heavy, else initial). Sindhi is the same stress family;
 *  this module simply never had the layer, so every word came out unstressed. */
function stress(ipa: string): string {
    return applyWeightStress(ipa).normalize("NFC");
}

const SD_WORD = "ء-ٟٮ-ۿ";
// Latin runs and digits BOTH route through `foreign` (the English phonemizer, wired in the registry — the
// ur/hi pattern). They used to be dropped outright: Latin matched no group at all, and digits emitted ""
// because createSindhi() never passed a foreign phonemizer — 7% of FLEURS sd_in tokens silently vanished.
/** A digit run → Sindhi number words → IPA through this engine's own g2p. Indic lakh/crore grouping. */
function number(digits: string): string {
    const n = Number(digits);
    // ⚠ ABOVE 2^53 THIS USED TO RETURN "" AND THE NUMBER VANISHED — the same silent deletion this file's
    // header records for the pre-composer era, reintroduced at the top of the range. Refusing to COMPOSE is
    // right (the float has lost the low digits); the guard simply had no else. Digit-at-a-time out of the
    // manifest's own unit words invents nothing. Above 2^53 the reading is a digit string, not a quantity.
    if (!Number.isSafeInteger(n)) return spellDigits(digits, DEF.numbers, (w) => phonemizeWordWith(w));
    return renderNumber(n, DEF.numbers, (w) => phonemizeWordWith(w));
}

// The foreign arm is `LATIN_RUN`, ALL of Latin plus marks — not `[A-Za-z]+`, which ended the token at a
// diacritic and left that letter to be read as an English letter name (`Cañitas` → *ka ˈɛn ˈitas*). This
// engine ROUTES a foreign word to the injected reader, so widening the class is the whole fix.
const TOKEN = new RegExp(`([${SD_WORD}]+)|(${LATIN_RUN})|(\\d+)|([۔؟،؛.?,])`, "gu");

/** Resolve an OOV word to IPA. Consulted BETWEEN the lexicon and the rule engine (lexicon → oovOverride →
 *  rules); used only by the async neural path (`sindhiNeural.ts`), so the sync engine is unchanged. */
export type OovResolver = (word: string) => string | undefined;

class SindhiPhonemizer implements Phonemizer {
    constructor(private foreign?: ForeignPhonemizer) {}
    text(rawInput: string, oovOverride?: OovResolver): string {
        // everything the g2p cannot read is rewritten to Sindhi words FIRST — see normalize.ts.
        // This layer was pointless until the number composer landed, since every rule there
        // produces digits for that composer to read.
        return assembleClauses(normalizeSindhi(rawInput), TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWordWith(m[1], oovOverride));
            // A LATIN run goes to the foreign phonemizer; a DIGIT run does NOT. Sending digits there
            // meant every numeral in Sindhi text was spoken in English.
            else if (m[2]) sink.emit(this.foreign ? this.foreign(m[2]) : "");
            else if (m[3]) sink.emit(number(m[3]));
            else if (m[4]) {
                const mk = CLAUSE_MARK[m[4]];
                if (mk) sink.pause(mk);
            }
        });
    }
}

/** Lexicon → oovOverride → rules. The lexicon still wins any word it covers; the override only fills the tail. */
function phonemizeWordWith(word: string, oov?: OovResolver): string {
    const hit = lexicon().get(word);
    if (hit) return stress(hit);
    const o = oov?.(word);
    return o ? stress(o) : stress(phonemizeCore(word));
}

/** True when the shipped lexicon covers `word` — the neural path uses this to skip covered words.
 *  Deliberately the SAME lookup the engine performs (`lexicon().get(word)`, no normalisation): if the two
 *  disagreed, a word could be judged "covered" here, skipped by the tagger, and then miss in the engine —
 *  silently falling through to default-ə instead of the neural reading. */
export function sindhiLexiconHas(word: string): boolean {
    return lexicon().has(word);
}

/** Build the Sindhi phonemizer. `foreign` reads embedded Latin words and digit runs (wired to English in
 *  the registry, as for ur/hi — code-switching is normal in Sindhi text; silence is not). */
export function createSindhi(foreign?: ForeignPhonemizer): Phonemizer {
    return new SindhiPhonemizer(foreign);
}

/** Build the Sindhi engine with a per-call `oovOverride` hook (the async neural path). */
export function createSindhiEngine(): { text: (input: string, oov?: OovResolver) => string } {
    return new SindhiPhonemizer();
}
