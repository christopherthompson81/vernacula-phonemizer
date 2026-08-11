/**
 * Native Pashto / پښتو (ps) phonemizer — Perso-Arabic (extended) abjad → canonical IPA. First Eastern Iranian
 * language. Logical order = phonetic order, so RTL is a non-issue. Pashto is a SHALLOWER abjad than Urdu/Arabic:
 * it writes the long/mid vowels distinctly — ا/آ→ɑ (ā), ې→e, و→o (or the glide w), ی→i (or the glide j), ۍ/ئ→əi —
 * but the SHORT vowels a/ə/i/u are usually UNWRITTEN, so a default [ə] (the zwarakay) + medial-schwa deletion
 * stand in for the deferred short-vowel-restoration subsystem (, as for Urdu/Persian). Word-final ه→[ə]
 * (ښه→ʂə); ع→ʔ. Dialect: ښ/ږ = Kandahari retroflex ʂ/ʐ.
 *
 * ⚠ THE THREE AMBIGUOUS-CARRIER RULES ARE THE FIDDLY PART OF THIS ENGINE, and each is a COUNTED majority on the
 * raw pbt reference rather than a tidy generalization — they live on `longVowel` and the glide branch in `g2p`,
 * with their counts. Summary: word-final ⟨ی⟩ is the -ay diphthong and ⟨ي⟩ is plain /i/; a carrier immediately
 * before ⟨ا⟩ is the glide; a carrier homorganic with the preceding vowel is the mater lectionis (⟨ـُو⟩→uː). The
 * cases that counted out as COIN FLIPS are deliberately absent and belong to `lexicon.tsv`: medial ⟨و⟩ is /u/
 * 103 vs /o/ 100, and the word-initial cluster is 70% vowel-broken / 30% kept with no sonority conditioning.
 *
 * ⚠ THE COVERAGE LEXICON IS CALIBRATED TO THIS FILE, so a change to what a carrier MEANS invalidates it and the
 * mine must be re-run — `invert_harakat.ts` searches vocalizations by round-tripping through this g2p, so it
 * learns whatever convention the g2p has, including its bugs. (It had mined بندول as بندُول for /bandawəl/ back
 * when a medial ⟨ـُو⟩ wrongly read u·w·ə.) Re-mine: `--lexicon ps --shard=k/14` → `export_lexicons.sh`.
 *
 * ⚠⚠ AND DO NOT QUOTE THIS ENGINE'S REFEREE SCORE WITHOUT THE CAVEAT: the lexicon is mined from wikipron/kaikki,
 * which ARE the referees, so the shipped number is substantially circular (pbt slice: shipped 69.6%, espeak-only
 * lexicon 46.7%, rules-only 46.9%). Engine changes are compared on RULES-ONLY. See tools/referee-eval/langs/
 * ps.jsonc and docs/investigations/ps_neural_restoration_investigation.md Run 11.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { LATIN_RUN } from "../../core/hostWord.ts";
import { deleteMedialSchwa } from "../../core/schwa.ts";
import { loadManifest } from "../../core/loadManifest.ts";
import { loadHarakatLexicon, restoreHarakat } from "../../core/harakatLexicon.ts";
import { makePashtoNormalizer } from "./normalize.ts";

interface NumbersDef {
    units: string[];
    ten: string;
    teens: string[];
    tens: Record<string, string>;
    compound: Record<string, string>;
    hundred: string;
    thousand: string;
    million: string;
    billion: string;
    and: string;
}
interface PashtoDef {
    consonants: Record<string, string>;
    harakat: Record<string, string>;
    sukun: string;
    shadda: string;
    inherentVowel: string;
    numbers: NumbersDef;
    clausePunctuation: Record<string, string>;
}
const DEF = loadManifest<PashtoDef>(import.meta.url, "pashto.jsonc");
const C = DEF.consonants;
const HARAKAT = DEF.harakat;
const INH = DEF.inherentVowel;
const CLAUSE_MARK = DEF.clausePunctuation;

const ALIF = "ا", ALIF_MADDA = "آ", WAW = "و", YA = "ی", YA_AR = "ي",
    YA_E = "ې", YA_FEM = "ۍ", YA_HAMZA = "ئ", HE = "ه", HE_DO = "ھ";
// The vowel/glide-bearing letters (after a consonant → a long/mid vowel; after a vowel → a glide).
const isVowelCarrier = (c: string): boolean =>
    c === ALIF || c === WAW || c === YA || c === YA_AR || c === YA_E || c === YA_FEM || c === YA_HAMZA;
const endsInVowel = (out: string): boolean => /[aeiouɑə]$/u.test(out);

/**
 * A vowel-carrier letter standing after a consonant → its long/mid vowel.
 *
 * ⚠ `final` SEPARATES ⟨ی⟩ FROM ⟨ي⟩, AND THAT ONE BIT IS THE LARGEST SINGLE ENGINE WIN THIS ENGINE HAS HAD.
 * Pashto's orthography distinguishes the two yehs word-finally where Persian/Urdu do not: ⟨ی⟩ (U+06CC) is the
 * masculine-singular / adjectival **-ay diphthong** and ⟨ي⟩ (U+064A) is plain /i/. Reading both as /i/ cost a
 * whole segment on every -ay word. Counted on the RAW pbt reference (never the folded string — Run 8):
 *
 *     word-final ی   108/125 (86%)  aɪ 53 · ai 52 · ɪ 2 · əi 1     ← the diphthong
 *                      8       i        (ناڅاپی, لوی — loans and a few natives)
 *                      5       j        (خدای, دوی — after a vowel, handled by the offglide branch instead)
 *     word-final ي    42/43  (98%)  i                              ← plain /i/, unchanged
 *
 * Emitted as `əi` rather than `aɪ` to match ⟨ۍ⟩/⟨ئ⟩, which are the SAME suffix in feminine/verbal spelling and
 * whose references write it `əi` 24× — one form for one morpheme. Under the eval fold all of aɪ/ai/əi/əɪ
 * collapse together anyway, so the choice is about internal consistency, not about scoring.
 */
function longVowel(ch: string, final = false): string {
    if (ch === ALIF || ch === ALIF_MADDA) return "ɑ";
    if (ch === WAW) return "o";
    if (ch === YA) return final ? "əi" : "i";
    if (ch === YA_AR) return "i";
    if (ch === YA_E) return "e";
    if (ch === YA_FEM || ch === YA_HAMZA) return "əi";
    return "";
}

/** Pashto word → canonical IPA (consonant + written-vowel skeleton + default [ə]). */
function g2p(word: string): string {
    const s = [...word.normalize("NFC")];
    const n = s.length;
    let out = "";
    let i = 0;

    // Word-initial vowel carrier: آ→ɑ; ا + long-vowel letter → that vowel; bare ا → short [a].
    if (s[0] === ALIF_MADDA) {
        out += "ɑ";
        i = 1;
    } else if (s[0] === ALIF) {
        if (s[1] === WAW) { out += "o"; i = 2; }
        else if (s[1] === YA || s[1] === YA_AR) { out += "i"; i = 2; }
        else if (s[1] === YA_E) { out += "e"; i = 2; }
        else { out += "a"; i = 1; }
    }

    while (i < n) {
        const ch = s[i]!;
        // ه / ھ: word-final → the schwa [ə] (ښه→ʂə); before a consonant when it can't be a vowel → [h].
        if (ch === HE || ch === HE_DO) {
            if (i === n - 1 && out && !endsInVowel(out)) out += "ə";
            else out += "h";
            i++;
            continue;
        }
        // Vowel/glide letters: a glide (w/j) after a vowel OR before a word-final ه (ـیه→jə); else the long vowel.
        if (isVowelCarrier(ch)) {
            // Explicit glide: وْ/یْ (a sukun on the و/ی) → the consonantal glide w/j — a cluster onset, NOT a vowel
            // nucleus (الوْتل→alwətəl vs the long-vowel الوتل→alot̪əl). Medial و/ی is long-vowel-vs-glide ambiguous, so
            // the sukun makes it mineable/lexicon-correctable. Consumes the sukun; epenthesis before a next consonant.
            if ((ch === WAW || ch === YA || ch === YA_AR) && s[i + 1] === DEF.sukun) {
                out += ch === WAW ? "w" : "j";
                const nx = s[i + 2];
                if (nx !== undefined && nx in C && !isVowelCarrier(nx) && nx !== HE && nx !== HE_DO &&
                    s[i + 3] !== DEF.sukun)
                    out += INH;
                i += 2;
                continue;
            }
            const glideable = ch === WAW || ch === YA || ch === YA_AR;
            const glideBeforeFinalHe = s[i + 1] === HE && i + 2 === n && glideable;
            // ⚠ A و/ی/ي IMMEDIATELY BEFORE ا/آ IS THE GLIDE, AND THE ا IS THE [ɑ] NUCLEUS — ⟨وا⟩→wɑ, ⟨يا⟩→jɑ
            // (خواږه→xwɑʐə, باغوان→bɑɣwɑn, خپلواک→xpəlwɑk, اسپانيا→əspɑnjɑ). Counted on the RAW pbt+kaikki
            // references, this is the most one-sided fact in Pashto's carrier inventory:
            //
            //     ⟨وا⟩  31/31 = 100% glide          ⟨يا⟩  25/25 = 100% glide
            //     ⟨وی⟩  5/10  =  50%  ⟨يو⟩ 4/9 = 44%  ⟨وي⟩ 5/7 — COIN FLIPS, left lexical on purpose
            //
            // ⚠ THE OLD RULE WAS THIS ONE RESTRICTED TO WORD-FINAL ـيا, AND THE RESTRICTION HID A BUG. After a
            // CONSONANT the و took the `longVowel` branch → [o], which then made `endsInVowel` true at the ا, so
            // the ا fell into the glide branch below and was emitted as **[j]** — a sound ⟨ا⟩ has in no position.
            // خواږه read *xojʐə for xwɑʐə. That is why `ALIF` is excluded from the glide test: a carrier that
            // reaches it before an ا is now already the glide, and an ا that reaches it is a hiatus [ɑ], never j.
            const glideBeforeAlif = glideable && (s[i + 1] === ALIF || s[i + 1] === ALIF_MADDA);
            const offglideAfterVowel = endsInVowel(out) && ch !== ALIF && ch !== ALIF_MADDA;
            if (glideBeforeAlif || glideBeforeFinalHe || offglideAfterVowel) {
                // A WORD-FINAL و/ی after a vowel is the DIPHTHONG offglide (سړی -ay→saɽaɪ, لوی→loɪ), not the
                // consonantal glide — a medial glide (دنيا→dənjɑ) stays j/w.
                //
                // ⚠ BUT HOMORGANIC FIRST, AND IN **ANY** POSITION: a و after /u/ (or a ی after /i/) is the
                // MATER LECTIONIS marking that vowel long — the ordinary Perso-Arabic ⟨ـُو⟩ = /uː/, ⟨ـِي⟩ =
                // /iː/. This test used to be gated on `i === n - 1`, so it only ever fired word-finally
                // (آسُو→ɑsuː) and a MEDIAL ⟨ـُو⟩ fell through to the glide arm: کُور read *kuwər for /kur/ and
                // مُوک read *muwək for /muk/ — an epenthetic vowel and a spurious /w/ on every such word.
                // ⚠ THAT WAS ON THE SHIPPED PATH, not a hypothetical: `lexicon.tsv` supplies exactly these
                // harakat, and **416 of its 10,731 entries carry ⟨ُو⟩**, so the coverage layer was feeding the
                // bug rather than avoiding it. The gate is gone; the glide arm now handles only the genuinely
                // heterorganic cases it was written for.
                const pv = out.at(-1);
                const homorganic =
                    (ch === WAW && (pv === "u" || pv === "ʊ")) || (ch !== WAW && (pv === "i" || pv === "ɪ"));
                let emittedGlide = false;
                if (homorganic && !glideBeforeAlif) out += "ː";
                else if (i === n - 1 && endsInVowel(out)) out += ch === WAW ? "ʊ" : "ɪ";
                else { out += ch === WAW ? "w" : "j"; emittedGlide = true; }
                // A glide behaves like a coda consonant: before another consonant it takes an epenthetic ə (the
                // verbal infinitive -ول = /awəl/: کَول→kawəl, not kawl). Mirrors the consonant-branch INH insertion.
                // SUPPRESSED by a sukun on that consonant (ښایسْته→ʂɑjstə, not ʂɑjəstə) — glide+CC is lexically
                // ambiguous (راوستل wants the ə, ښایسته doesn't), so the sukun makes it lexicon-correctable/mineable.
                // ⚠ AND GATED ON `emittedGlide`, WHICH IS THE OTHER HALF OF THE MATER-LECTIONIS FIX. The rule is
                // about a CODA CONSONANT needing a following nucleus; a length mark is not one. Without the gate
                // مُوک came out *muːək — the /w/ was gone but the epenthetic ə it had licensed stayed behind, and
                // the referee got WORSE (810 → 799) even though the segment it complained about was fixed.
                const nx = s[i + 1];
                if (emittedGlide && nx !== undefined && nx in C && !isVowelCarrier(nx) && nx !== HE &&
                    nx !== HE_DO && s[i + 2] !== DEF.sukun)
                    out += INH;
            } else out += longVowel(ch, i === n - 1);
            i++;
            continue;
        }
        // Consonant.
        if (ch in C) {
            out += C[ch]!;
            i++;
            if (s[i] === DEF.shadda) { out += "ː"; i++; }
            const hk = s[i] !== undefined ? HARAKAT[s[i]!] : undefined;
            if (s[i] === DEF.sukun) i++;
            else if (hk !== undefined) { out += hk; i++; }
            else {
                // A following vowel-carrier letter is the nucleus; otherwise insert the default short vowel [ə].
                const next = s[i];
                if (next !== undefined && !isVowelCarrier(next) && next !== HE && next !== HE_DO)
                    out += INH;
            }
            continue;
        }
        i++; // unknown / diacritic → skip
    }
    return out.normalize("NFC");
}

const VOWEL_G = /[aeiouɑə]/g;

// COVERAGE layer: mined undiacritized skeletons are vocalized before g2p (see core/harakatLexicon.ts). Loaded
// LAZILY (registry.ts imports every rider eagerly; the TSV is only read on first Pashto use).
let LEXICON: ReadonlyMap<string, string> | undefined;
export function harakatLexicon(): ReadonlyMap<string, string> {
    return (LEXICON ??= loadHarakatLexicon(import.meta.url));
}

/** Lexicon-FREE core: skeleton g2p + default-schwa deletion + stress. Used by the number path and the mining tool,
 *  which must NOT consult the content lexicon (number words / mining candidates collide with content homographs). */
export function phonemizeWordCore(word: string): string {
    let ipa = g2p(word);
    if (!ipa) return "";
    ipa = deleteMedialSchwa(ipa, "ə");
    // Homorganic nasal AFTER schwa deletion (so the nasal is adjacent to the velar): ن before a velar stop → [ŋ]
    // (انګور→aŋɡor). The standard assimilation; runs post-deletion because the epenthetic ə is removed first.
    ipa = ipa.replace(/n(?=[kɡq])/gu, "ŋ");
    // NOTE: no word-final-cluster ə-deletion — Pashto RETAINS the epenthetic ə before many final clusters
    // (اخښل→axʂəl), unlike Persian; deleting it there hurt the referee.
    // Stress: default to the last long vowel (ɑ/o/u/e/i), else the last nucleus.
    const longs = [...ipa.matchAll(/[ɑoue]|i(?!̯)/gu)];
    const marks = longs.length ? longs : [...ipa.matchAll(VOWEL_G)];
    if (marks.length) {
        const at = marks[marks.length - 1]!.index!;
        ipa = ipa.slice(0, at) + "ˈ" + ipa.slice(at);
    }
    return ipa.normalize("NFC");
}

/** One Pashto word → canonical IPA (coverage-lexicon restore + the lexicon-free core). */
export function phonemizeWord(word: string): string {
    return phonemizeWordCore(restoreHarakat(word, harakatLexicon()));
}

const EASTERN_DIGITS: Record<string, string> = {
    "۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4",
    "۵": "5", "۶": "6", "۷": "7", "۸": "8", "۹": "9",
};
const DIGIT_CLASS = "0-9" + Object.keys(EASTERN_DIGITS).join("");
const PERSO_ARABIC_WORD = "ء-ٟٮ-ۿ";
const toAscii = (d: string): string => [...d].map((c) => EASTERN_DIGITS[c] ?? c).join("");
const NUM = DEF.numbers;
/**
 * Non-negative integer → Pashto numeral spelling (decimal; ⟨و⟩ joins the magnitude groups). Three distinct
 * sub-100 patterns, per the sources cited in pashto.jsonc: irregular fused `teens`, the bound-⟨ویشت⟩ `compound`
 * series for 21-29, and UNITS-FIRST composition (یو دېرش) for 31-99.
 */
export function numberToText(nn: number): string {
    if (nn < 0) return "";
    if (nn < 10) return NUM.units[nn]!;
    if (nn < 20) return NUM.teens[nn - 10]!; // irregular fused forms — NOT unit+لس
    if (nn < 100) {
        // `tens` is keyed by the ROUND value ("20".."90"); the lookup used Math.floor(nn/10) → "2".."9" → undefined,
        // so 20-90 rendered EMPTY and 21-99 lost their tens slot entirely (SLOT-GAP: " ˈo ˈiʊ" for 21).
        const t = Math.floor(nn / 10) * 10, u = nn % 10;
        if (u === 0) return NUM.tens[String(t)]!;
        return NUM.compound[String(nn)] ?? `${NUM.units[u]} ${NUM.tens[String(t)]}`; // units-first, no connector
    }
    if (nn < 1000) {
        const h = Math.floor(nn / 100), r = nn % 100;
        return `${h > 1 ? NUM.units[h] + " " : ""}${NUM.hundred}${r ? ` ${NUM.and} ${numberToText(r)}` : ""}`;
    }
    // The magnitude chain: زر (10³) · میلیون (10⁶) · میلیارد (10⁹). The million branch was previously unreachable —
    // the data existed but nothing above 999 999 was composed, so 10⁶+ fell through to the digits (→ EMPTY IPA).
    for (const [value, scale] of MAGNITUDES) {
        if (nn >= value) {
            const q = Math.floor(nn / value), r = nn % value;
            return `${q > 1 ? numberToText(q) + " " : ""}${scale}${r ? ` ${NUM.and} ${numberToText(r)}` : ""}`;
        }
    }
    return String(nn);
}
/** Magnitude words, largest first (the descending scan `numberToText` walks). */
const MAGNITUDES: [number, string][] = [
    [1_000_000_000, NUM.billion], [1_000_000, NUM.million], [1000, NUM.thousand],
];
function number(digits: string): string {
    const nn = Number(toAscii(digits));
    if (!Number.isSafeInteger(nn) || nn < 0 || nn >= 1e12) return digits;
    return numberToText(nn).split(" ").map(phonemizeWordCore).join(" "); // numbers bypass the content lexicon
}
// The foreign arm is `LATIN_RUN`, ALL of Latin plus marks — not `[A-Za-z]+`, which ended the token at a
// diacritic and left that letter to be read as an English letter name (`Cañitas` → *ka ˈɛn ˈitas*). This
// engine ROUTES a foreign word to the injected reader, so widening the class is the whole fix.
const TOKEN = new RegExp(
    `([${PERSO_ARABIC_WORD}]+)|(${LATIN_RUN})|([${DIGIT_CLASS}]+)|([۔؟،؛.?!,;:])`,
    "gu",
);

export type ForeignPhonemizer = (latin: string) => string;

/** ⚠ THE NORMALIZER IS A FACTORY AND TAKES `numberToText`, WHICH IS NOT DECORATION. Pashto's ordinal is a
 *  gender/case SUFFIX written after the digits (`۱۹مه`), and a suffix cannot agree with a digit run — so
 *  that one rule has to turn the operand into WORDS inside itself and weld the suffix onto the last one
 *  (playbook trap 14). Passing the speller in rather than importing it there keeps the dependency one-way:
 *  the engine calls the normalizer, never the reverse. */
const normalizePashto = makePashtoNormalizer({ numeralWords: numberToText });

class PashtoPhonemizer implements Phonemizer {
    constructor(private foreign?: ForeignPhonemizer) {}
    text(input: string): string {
        // NORMALIZATION runs first — pure text→text, so everything it emits is then read by the ordinary
        // word, number and clause paths below. It must see the text BEFORE tokenization, because most of
        // what it repairs (a grouping `،`, a decimal `.`, a clock `:`) is a character this engine's TOKEN
        // would otherwise hand to `clausePunctuation` as a pause.
        return assembleClauses(normalizePashto(input), TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(m[1]));
            else if (m[2]) sink.emit(this.foreign ? this.foreign(m[2]) : "");
            else if (m[3]) sink.emit(number(m[3]));
            else if (m[4]) {
                const mk = CLAUSE_MARK[m[4]];
                if (mk) sink.pause(mk);
            }
        });
    }
}

/** Build the Pashto phonemizer. `foreign` handles embedded Latin runs. */
export function createPashto(foreign?: ForeignPhonemizer): Phonemizer {
    return new PashtoPhonemizer(foreign);
}
