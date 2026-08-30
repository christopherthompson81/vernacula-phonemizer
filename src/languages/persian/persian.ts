/**
 * Native Persian / Farsi (fa) phonemizer — Perso-Arabic abjad → canonical IPA. Logical order = phonetic order,
 * so RTL is a non-issue (as for Arabic/Urdu). Handles: consonant letters, long vowels written with ا/آ/و/ی,
 * a WORD-INITIAL glottal stop ʔ before a vowel (آب→ʔaːb), the خوا→[xʷaː] labialization, word-final ه → [e]
 * (خانه→xaːne), shadda gemination, short vowels from harakat WHEN present — and, for the usual undiacritized
 * text, a DEFAULT short vowel [a] (the crude stand-in for the deferred short-vowel-restoration subsystem).
 */
import type { Phonemizer } from "../../registry.ts";
import { rewrite, renormalize } from "../../core/provenance.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { LATIN_RUN } from "../../core/hostWord.ts";
import { deleteMedialSchwa } from "../../core/schwa.ts";
import { renderNumber, spellDigits, type NumbersDef } from "../../core/numbers.ts";
import { loadManifest } from "../../core/loadManifest.ts";
import { loadHarakatLexicon, restoreHarakat } from "../../core/harakatLexicon.ts";
import { encliticWord, persianNumberWords, type FaNumbersDef } from "./numbers.ts";
import { makePersianNormalizer } from "./normalize.ts";

interface PersianDef {
    consonants: Record<string, string>;
    harakat: Record<string, string>;
    sukun: string;
    shadda: string;
    inherentVowel: string;
    numbers: FaNumbersDef;
    clausePunctuation: Record<string, string>;
}
const DEF = loadManifest<PersianDef>(import.meta.url, "persian.jsonc");
const C = DEF.consonants;
const HARAKAT = DEF.harakat;
const INH = DEF.inherentVowel;
const CLAUSE_MARK = DEF.clausePunctuation;
const ALIF = "ا",
    ALIF_MADDA = "آ",
    WAW = "و",
    YA = "ی",
    YA_AR = "ي",
    HE = "ه";
const isV = (c: string): boolean => c === ALIF || c === WAW || c === YA || c === YA_AR;
/**
 * WRITTEN-VOWEL GUARD. The two deletion heuristics below (medial schwa, and the final-cluster rule) exist to undo
 * the DEFAULT [a] this g2p inserts where the abjad wrote nothing. They must not touch an [a] the text actually
 * WROTE with a fatha — but the IPA string carries no such distinction, so a harakat-derived [a] is tagged and the
 * tag is removed once both heuristics have run. Without it the number table itself was damaged: سیصَد (300) came
 * out [sˈiːsd], and likewise پانصَد, نُهصَد and the rest of the fused hundreds — the hundreds digit of every year.
 *
 * IT MUST BE A COMBINING MARK, not a spacing sentinel. core/schwa.ts segments the IPA into units and decides by
 * the units on BOTH sides of a candidate (V·C·a·C·V); a spacing guard becomes a unit of its own and breaks one
 * side or the other — placed after the vowel it blocked the deletion in the preceding syllable (هَشتاد →
 * [haʃataːd]), placed before it blocked the one in the following syllable (پانصَد → [paːnasˈad]). A combining
 * mark is absorbed into the vowel's own unit, so the written vowel still counts as a vowel for its neighbours
 * while its unit text ("a"+mark) no longer equals the schwa the rule deletes. U+0332 is used because it is not
 * an IPA symbol this engine emits and composes with nothing under NFC.
 */
const WRITTEN = "\u0332";
const endsInVowel = (out: string): boolean =>
    new RegExp(`[aeiouɒ]${WRITTEN}?ː?$`, "u").test(out);

/** A written harakat's IPA, with the deletion guard attached when it is the same segment as the DEFAULT vowel
 *  (only that one is a deletion target, so only that one needs tagging). */
function harakatIpa(ch: string | undefined): string | undefined {
    const hk = ch !== undefined ? HARAKAT[ch] : undefined;
    return hk === INH ? hk + WRITTEN : hk;
}

/** A long-vowel letter standing after a consonant → its long vowel. */
function longVowel(ch: string): string | undefined {
    if (ch === ALIF || ch === ALIF_MADDA) return "aː";
    if (ch === WAW) return "uː";
    if (ch === YA || ch === YA_AR) return "iː";
    return undefined;
}

/** Persian word → canonical IPA (consonant + long-vowel skeleton + default short vowel). */
function g2p(word: string): string {
    const s = [...word.normalize("NFC")];
    const n = s.length;
    let out = "";
    let i = 0;

    // Word-initial vowel carrier: آ→ʔaː; ا+و→ʔuː, ا+ی→ʔiː; bare ا → ʔ + default short vowel.
    if (s[0] === ALIF_MADDA) {
        out += "ʔaː";
        i = 1;
    } else if (s[0] === ALIF) {
        if (s[1] === WAW) {
            out += "ʔuː";
            i = 2;
        } else if (s[1] === YA || s[1] === YA_AR) {
            out += "ʔiː";
            i = 2;
        } else {
            out += "ʔ" + INH;
            i = 1;
        }
    }

    while (i < n) {
        const ch = s[i]!;
        // Word-final ه after a consonant → the [e] vowel (خانه→xaːne); elsewhere it is [h].
        if (ch === HE) {
            if (i === n - 1 && out && !endsInVowel(out)) out += "e";
            else out += "h";
            i++;
            // ⟨ه⟩ is the only consonant whose branch returns BEFORE the shared harakat consumption below, so a
            // short vowel written after it was silently discarded. That corrupted the DIACRITIZED number table
            // itself — هِزار read [hzˈaːɾ], هَفت [hfˈat], هَشتاد [hʃatˈaːd], i.e. every year from 1000 up.
            // Undiacritized running text is unaffected (nothing to consume) and no lexicon entry writes a
            // harakat after ⟨ه⟩ (0 of 4,132 in lexicon.tsv), so this only ever adds the vowel that was written.
            const hk = harakatIpa(s[i]);
            if (hk !== undefined) {
                out += hk;
                i++;
            }
            continue;
        }
        // Standalone glide/vowel letters: after a vowel → glide (v/j); after a consonant → long vowel.
        if (isV(ch)) {
            out += endsInVowel(out)
                ? ch === WAW
                    ? "v"
                    : "j"
                : (longVowel(ch) ?? "");
            i++;
            continue;
        }
        // Consonant.
        if (ch in C) {
            const ph = C[ch]!;
            i++;
            // خوا → [xʷaː]: خ + و (silent, labializes) + ا.
            if (ph === "x" && s[i] === WAW && s[i + 1] === ALIF) {
                out += "xʷaː";
                i += 2;
                continue;
            }
            out += ph;
            if (s[i] === DEF.shadda) {
                out += "ː";
                i++;
            }
            const hk = harakatIpa(s[i]);
            if (s[i] === DEF.sukun) i++;
            else if (hk !== undefined) {
                out += hk;
                i++;
            } else {
                // ی/و before another vowel letter is a glide; a bare long-vowel letter is the nucleus.
                const glideNext =
                    (s[i] === YA || s[i] === WAW) && longVowel(s[i + 1] ?? "") !== undefined;
                const lv = glideNext ? undefined : longVowel(s[i] ?? "");
                if (lv !== undefined) {
                    out += lv;
                    i++;
                } else if (glideNext) {
                    out += s[i] === WAW ? "v" : "j";
                    i++;
                } else if (i < n && !(s[i] === HE && i === n - 1)) {
                    out += INH; // the abjad's omitted SHORT vowel: default [a]
                }
            }
            continue;
        }
        i++; // unknown / diacritic → skip
    }
    return out.normalize("NFC");
}

const VOWEL_G = /[aeiouɒ]/g;

// COVERAGE layer: an undiacritized skeleton whose short vowels we've mined is looked up here and vocalized before
// g2p, so the g2p reads the real e/o/u instead of a default schwa (see core/harakatLexicon.ts). Loaded LAZILY
// (registry.ts imports every rider eagerly; the ~3k-line TSV is only read on first Persian use).
let LEXICON: ReadonlyMap<string, string> | undefined;
export function harakatLexicon(): ReadonlyMap<string, string> {
    return (LEXICON ??= loadHarakatLexicon(import.meta.url));
}

/** Lexicon-FREE core: g2p + default-short-vowel deletion + final stress. Used by the number path and the mining
 *  tool, which must NOT consult the content lexicon (number words / mining candidates collide with homographs). */
export function phonemizeWordCore(word: string): string {
    let ipa = g2p(word);
    if (!ipa) return "";
    // Persian, like Urdu, drops the over-inserted default vowel in a medial C·a·C cluster (the shared Ohala
    // rule on /a/). The correct e/o quality needs the deferred restoration layer; the STRUCTURE is right.
    ipa = deleteMedialSchwa(ipa, "a");
    // …then the SAME rule again for a WRITTEN fatha. The guard mark makes the written vowel a distinct unit text,
    // so the pass above cannot see it; this pass restores exactly the previous medial behaviour for it. The guard
    // is therefore scoped to the final-cluster rule below — the only one that was demonstrably wrong about it.
    // Deliberate: 5 mined lexicon entries of the shape C-a-ی-ه (تکَیه, گِرَیه, کُلَیه) write a fatha that the medial
    // rule then deletes, and the wikipron referee agrees with the DELETION (takje, not takaje). Whether that
    // fatha should have been mined at all is a lexicon question, not one for this pass to answer, so the medial
    // behaviour is left bit-identical and only the word-final case changes.
    ipa = deleteMedialSchwa(ipa, "a" + WRITTEN);
    // Persian ALLOWS word-final consonant CLUSTERS (mard, duːst) — so a default [a] before a run of coda
    // consonants at word end is spurious; delete it when a vowel precedes (unlike Urdu, which retains it).
    // The `(?![ː WRITTEN])` guard is what keeps it off a fatha the text actually wrote: هَشت [haʃat]→[haʃt] is the
    // inserted vowel and must go, سیصَد [siːsad] is written and must stay (it used to come out [siːsd]).
    ipa = ipa.replace(
        new RegExp(`([aeiouɒ]ː?[^aeiouɒː ]*)a(?![ː${WRITTEN}])(?=[^aeiouɒː ]+$)`, "gu"),
        "$1",
    );
    ipa = ipa.replace(new RegExp(WRITTEN, "gu"), ""); // guard removed once both deletion heuristics have run
    // Persian stress is (mostly) word-FINAL: mark the last vowel nucleus.
    const vowels = [...ipa.matchAll(VOWEL_G)];
    if (vowels.length) {
        const last = vowels[vowels.length - 1]!.index!;
        ipa = ipa.slice(0, last) + "ˈ" + ipa.slice(last);
    }
    return ipa.normalize("NFC");
}

/** One Persian word → canonical IPA (coverage-lexicon restore + the lexicon-free core). */
export function phonemizeWord(word: string): string {
    return phonemizeWordCore(restoreHarakat(word, harakatLexicon()));
}

const EASTERN_DIGITS: Record<string, string> = {
    "۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4",
    "۵": "5", "۶": "6", "۷": "7", "۸": "8", "۹": "9",
};
const DIGIT_CLASS = "0-9" + Object.keys(EASTERN_DIGITS).join("");
const PERSO_ARABIC_WORD = "ء-ٟٮ-ۓە-ۿ";
const toAscii = (d: string): string =>
    [...d].map((c) => EASTERN_DIGITS[c] ?? c).join("");
function number(digits: string): string {
    const nn = Number(toAscii(digits));
    // ⚠ ABOVE 2^53 THE RAW ASCII DIGITS USED TO LEAK STRAIGHT INTO THE IPA. `isSafeInteger` is right to
    // refuse to COMPOSE — the float has already lost the low digits, so the numeral would be confidently
    // wrong — but the refusal returned the digit string, which no g2p in this fleet reads. Read it out
    // digit-at-a-time through this engine's own number words instead; see core/numbers.ts `spellDigits`
    // for the full account and the cost (above 2^53 the reading is a digit string, not a quantity).
    if (!Number.isSafeInteger(nn))
        return spellDigits(toAscii(digits), DEF.numbers, encliticWord(phonemizeWordCore, DEF.numbers));
    // The DECIMAL IRANIAN compositor (persian/numbers.ts), not the default Indic lakh/crore one — Persian's
    // hundreds are irregular fused words and every group is linked by the enclitic ⟨و⟩ /o/, which `encliticWord`
    // appends to the already-phonemized head word. Numbers bypass the content lexicon (homograph collisions).
    return renderNumber(nn, DEF.numbers, encliticWord(phonemizeWordCore, DEF.numbers), persianNumberWords);
}
// The foreign arm is `LATIN_RUN`, ALL of Latin plus marks — not `[A-Za-z]+`, which ended the token at a
// diacritic and left that letter to be read as an English letter name (`Cañitas` → *ka ˈɛn ˈitas*). This
// engine ROUTES a foreign word to the injected reader, so widening the class is the whole fix.
const TOKEN = new RegExp(
    `([${PERSO_ARABIC_WORD}]+)|(${LATIN_RUN})|([${DIGIT_CLASS}]+)|([۔؟،؛.?!,;:])`,
    "gu",
);

export type ForeignPhonemizer = (latin: string) => string;

// Real-world Persian text frequently uses ARABIC-script letter variants — Arabic yeh ي (U+064A), Arabic kaf ك
// (U+0643), alef maksura ى (U+0649), teh marbuta ة (U+0629) — instead of their Farsi forms (ی U+06CC, ک U+06A9).
// NFC does NOT unify them (distinct base letters, not canonical-equivalent), so the harakat lexicon and the neural
// tagger — both keyed on Farsi orthography — treat Arabic yeh as unknown and GARBLE the word (کسي→kˈasv vs Farsi
// کسی→kasˈiː). Fold them to Farsi at every fa text entry. Surfaced by the independent GE2PE referee (1207 Arabic
// yehs in its test set).
const FA_ORTHO: Record<string, string> = { "ي": "ی", "ك": "ک", "ى": "ی", "ة": "ه" };
export function normalizePersianOrthography(text: string): string {
    // NFC first so decomposed input (e.g. NFD آ = bare alef + combining madda U+0653) composes to the single
    // codepoint the tagger vocab + the آ→aː rule key on — the sync g2p already NFC-normalizes, the neural path must
    // too. Then fold the Arabic-script letter variants to their Farsi forms.
    // ⚠ ON THE SEAM. Both arms run on the PIPELINE STRING: the NFC and the letterform fold were native,
    // so the tracker went on believing the text still held ⟨ك⟩ and every later `rewrite` poisoned (#1179).
    return rewrite(renormalize(text, "NFC"), /[يكىة]/gu, (c: string) => FA_ORTHO[c] ?? c);
}

/**
 * TEXT NORMALIZATION — the pre-tokenizer pass (normalize.ts). Exported because the NEURAL entry points in
 * persianNeural.ts do their own tokenization and must see the same rewritten text as the sync path; both call it
 * immediately after `normalizePersianOrthography`. It is idempotent, so the neural path re-entering the sync path
 * for a digit run costs nothing.
 */
export const normalizePersianText = makePersianNormalizer(DEF.numbers);

class PersianPhonemizer implements Phonemizer {
    constructor(private foreign?: ForeignPhonemizer) {}
    text(input: string): string {
        return assembleClauses(normalizePersianText(normalizePersianOrthography(input)), TOKEN, (m, sink) => {
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

/** Build the Persian phonemizer. `foreign` handles embedded Latin runs. */
export function createPersian(foreign?: ForeignPhonemizer): Phonemizer {
    return new PersianPhonemizer(foreign);
}
