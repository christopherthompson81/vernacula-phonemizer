/**
 * Native Ukrainian / українська (uk) text phonemizer — canonical IPA. East Slavic, Cyrillic.
 * Ukrainian has NO vowel reduction (akanye), so — unlike Russian — no stress dictionary is needed for vowel
 * quality: a left-to-right scan with fixed vowel values. The work is PALATALISATION (a consonant → Cʲ before ь,
 * і, or an iotated vowel я/ю/є/ї) + the iotated vowels ([j]+V word-initially / after a vowel / after an
 * apostrophe; the bare V after a consonant, which it palatalises) + в-vocalisation (ʋ before a vowel, [w] in the
 * coda) + г→ɦ / ґ→ɡ / dark л→ɫ. Stress is lexical and unmarked here (Ukrainian stress is unpredictable and does
 * not change vowel quality). Validated vs wikipron ukr_cyrl narrow + kaikki + epitran ukr-Cyrl.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { renderNumber } from "../../core/numbers.ts";
import { eastSlavicNumberWords, type EastSlavicNumbers } from "./numbers.ts";
import { loadManifest } from "../../core/loadManifest.ts";
import { makeSymbolNormalizer, slavicCountForm } from "../../core/normalizeSymbols.ts";
import { normalizeUkrainian, normalizeUkrainianInitialisms } from "./normalize.ts";

interface UkrainianDef {
    vowels: Record<string, string>;
    iotated: Record<string, string>;
    consonants: Record<string, string>;
    /** Western/Slavic base table + the magnitude count forms, feminine 1/2, and the decimal-comma name. */
    numbers: EastSlavicNumbers & { decimalConnector: string };
    clausePunctuation: Record<string, string>;
}
const DEF = loadManifest<UkrainianDef>(import.meta.url, "ukrainian.jsonc");
const CLAUSE_MARK = DEF.clausePunctuation;

const SOFT = "ь";
const PALATALIZERS = new Set(["ь", "і", "я", "ю", "є", "ї"]);
const VOWEL_LETTERS = new Set(["а", "е", "и", "і", "о", "у", "я", "ю", "є", "ї"]);
const PLAIN_VOWELS = new Set(["а", "е", "и", "і", "о", "у"]); // non-iotated vowels (for the й onset test)
const isCons = (c: string): boolean => c in DEF.consonants;

/** Palatalise a hard-consonant IPA: dark ɫ → lʲ (loses velarisation), everything else appends ʲ. */
const palatalise = (ipa: string): string => (ipa === "ɫ" ? "lʲ" : ipa + "ʲ");

/** One Ukrainian word → canonical IPA. */
export function phonemizeWord(word: string): string {
    const s = word.toLowerCase();
    const chars = [...s];
    const out: string[] = [];
    for (let i = 0; i < chars.length; ) {
        const c = chars[i]!;
        const nxt = chars[i + 1] ?? "";
        if (isCons(c)) {
            let ipa = DEF.consonants[c]!;
            // в is /w/ with the standard Ukrainian allophony: [w] before a ROUNDED vowel о/у (слово→sɫɔwɔ,
            // вода→wɔda) and in the CODA / word-initial-before-a-consonant (Влад→wɫad; true post-vocalic coda is
            // the non-syllabic [u̯]: Європа→…u̯r…); [ʋ] before а/е/и (мова→mɔʋa); [ʋʲ] before і (вікно→ʋʲiknɔ).
            if (c === "в") {
                if (nxt === "о" || nxt === "у") ipa = "w";
                else if (nxt === "а" || nxt === "е" || nxt === "и") ipa = "ʋ";
                else if (nxt === "і" || nxt === SOFT || nxt in DEF.iotated) ipa = "ʋʲ"; // palatalised before і/ь/iotated (свято→sʲʋʲatɔ)
                else ipa = i > 0 && VOWEL_LETTERS.has(chars[i - 1] ?? "") ? "u̯" : "w"; // coda vs word-initial-before-C
            } else if (c === "й") ipa = PLAIN_VOWELS.has(nxt) ? "j" : "i̯"; // onset [j] before a plain vowel; else coda [i̯] (Майя→…i̯j…)
            // Palatalise before ь / і / an iotated vowel (unless an apostrophe intervenes — handled by adjacency).
            else if (PALATALIZERS.has(nxt)) ipa = palatalise(ipa);
            out.push(ipa);
            i++;
            if (nxt === SOFT) i++; // consume the soft sign (palatalisation already applied)
            continue;
        }
        if (c in DEF.iotated) {
            const v = DEF.iotated[c]!;
            const prev = chars[i - 1] ?? "";
            // ї is always [ji]; the others are the bare vowel ONLY when they directly follow a PALATALISABLE
            // consonant (which they palatalised) — otherwise (initial / after a vowel / apostrophe / the glide й)
            // they are [j]+V. й is a glide, not a palatalising consonant (Майя→mai̯ja).
            if (c === "ї" || !isCons(prev) || prev === "й") {
                out.push("j");
                out.push(v);
            } else out.push(v);
            i++;
            continue;
        }
        if (c in DEF.vowels) {
            out.push(DEF.vowels[c]!);
            i++;
            continue;
        }
        if (c === SOFT) {
            // A soft sign not consumed by a preceding consonant (rare) — palatalise the last emitted consonant.
            const last = out[out.length - 1];
            if (last && !last.endsWith("ʲ")) out[out.length - 1] = palatalise(last);
            i++;
            continue;
        }
        i++; // apostrophe (breaks C+iotated adjacency → [j]V) and unknowns → skip
    }
    let x = out.join("");
    // REGRESSIVE PALATALISATION: a coronal (т д з с ц н л) directly before a palatalised consonant assimilates and
    // is itself palatalised (Близнюк→bɫɪzʲnʲuk, Дніпряни→dʲnʲiprʲanɪ). Dark ɫ → lʲ; the rest append ʲ.
    const PALC = "(?:t͡s|t͡ʃ|d͡z|d͡ʒ|[bpkɡtdszʃʒʋfxmnrlj])ʲ";
    x = x.replace(new RegExp(`ɫ(?=${PALC})`, "gu"), "lʲ");
    x = x.replace(new RegExp(`(t͡s|[tdszn])(?=${PALC})`, "gu"), "$1ʲ");
    // Doubled consonant → a single geminate Cː: the palatalised-pair case CʲCʲ→Cʲː (Буття→butʲːa, after the
    // regressive rule doubled both), then the plain-before-ʲ case CCʲ→Cʲː (ння→nʲː, Євробачення), then plain CC→Cː.
    x = x.replace(/([bʋɦɡdʒznɫlmnprstfxʃ])ʲ\1ʲ/gu, "$1ʲː")
        .replace(/([bʋɦɡdʒznɫlmnprstfxʃ])\1ʲ/gu, "$1ʲː")
        .replace(/([bʋɦɡdʒznɫlmprstfxʃ])\1(?!ʲ)/gu, "$1ː");
    return x.normalize("NFC");
}

function number(digits: string): string {
    const n = Number(digits);
    if (!Number.isSafeInteger(n)) return digits;
    // East-Slavic composer: the magnitude nouns AGREE with their multiplier (дві тисячі, п'ять тисяч) — see numbers.ts
    return renderNumber(n, DEF.numbers, phonemizeWord, eastSlavicNumberWords);
}

/**
 * symbol normalization — Ukrainian: CYRILLIC unit abbreviations (км, not km) and the three-way Slavic
 * agreement, which for uk IS Russian's selector (see normalize.ts's header for the evidence).
 *
 * `м` is NOT declared here on purpose: the shared tier's trailing guard is `(?![\p{L}\p{M}])`, and the
 * Ukrainian apostrophe is neither a letter nor a mark, so `41 м'яч` would become *сорок один метр'яч*.
 * It is handled in normalize.ts with an apostrophe-aware guard instead.
 *
 * Currency: NOT attested in uk_ua (the corpus spells доларів / фунтів / євро out), but the signs were
 * being dropped outright, so the three that occur in Ukrainian text at all are declared. The forms are
 * standard dictionary paradigms, not invented.
 */
const SYMBOLS = makeSymbolNormalizer({
    // `multiply` — this language had NO word for the sign at all. ⚠ STANDARD MATHEMATICAL REGISTER, not a
    // corpus attestation: the sweep's plausible hits were homographs of PREPOSITIONS (es `por` ×23, it `per` ×25,
    // ru `на` ×31 are all the preposition), the same trap that defeated the exponent sourcing. One word, so `by`
    // defaults to it — this language does not split dimension from product.
    multiply: { times: "на" },
    // ⚠ CORRECTED FROM `помножити на` BY THE AUDIO. The register guess was too long: the uk_ua speaker of the
    // universal `4x4` sentence says just **на** — wav2vec2 over uk_ua/train gives
    // `… tʃ o t e r i  t aɪ … tʃ u t r i  n a  tʃ e t e r e …`, "chotyry NA chetery". `помножити на` is the full
    // verbal form a textbook uses; a reader saying a dimension uses the bare preposition.
    // `&` was DROPPED outright, losing the sign from `готелі типу B&B`. `та` is the conjunction used
    // to join two nouns, and it is the shape every other treated language took here (de *und*, pt *e*,
    // ru *и*, mi *me*): the plain conjunction, not a transliteration. `і` is the other Ukrainian "and" and
    // is equally correct as a word; `та` is preferred between two coordinate nouns, which is what an
    // ampersand always joins. ⚠ Both were checked at TOKEN level rather than by substring — a substring
    // count is meaningless for these two, since `і` and `та` occur inside hundreds of ordinary words
    // (3853 and 2290 raw substring hits against 51 and 14 real tokens).
    // ⚠ THE STRONGEST EVIDENCE IS IN THE SENTENCE ITSELF: the corpus GLOSSES the abbreviation using this very
    // word — `готелі типу B&B … змагаються у двох основних речах: ліжко та сніданок` ("bed AND breakfast").
    // That settles the `і` vs `та` question on the corpus's own usage rather than on a preference.
    ampersand: "та",
    percent: ["відсоток", "відсотки", "відсотків", "відсотка"],
    currency: {
        "€": ["євро"], // indeclinable
        "$": ["долар", "долари", "доларів", "долара"],
        "£": ["фунт", "фунти", "фунтів", "фунта"],
    },
    units: {
        "км": ["кілометр", "кілометри", "кілометрів", "кілометра"],
        "см": ["сантиметр", "сантиметри", "сантиметрів", "сантиметра"],
        "мм": ["міліметр", "міліметри", "міліметрів", "міліметра"],
        "кг": ["кілограм", "кілограми", "кілограмів", "кілограма"],
        "ггц": ["гігагерц", "гігагерци", "гігагерців", "гігагерца"],
        "мбіт": ["мегабіт", "мегабіти", "мегабіт"],
        // THE BARE METRE, BOTH SPELLINGS. This was excluded, and the stated reason — the apostrophe in
        // `41 м\u2019яч` ("41 balls"), where a short key would bite into the following word — is no longer a
        // reason: the tier's trailing guard rejects `\u0027\u2019\u02bc` explicitly, so `м\u2019яч` cannot
        // be entered. Verified against that exact corpus string. метрів ×6, and the cube word declared below
        // could not reach a bare metre without this, so `120 m\u00b3` read as the letter name while
        // `120 km\u00b3` read correctly.
        "м": ["метр", "метри", "метрів", "метра"],
        "m": ["метр", "метри", "метрів", "метра"],
        // LATIN aliases. uk_ua writes the Cyrillic abbreviation throughout, but the engine's TOKEN drops
        // Latin runs outright, so a foreign-sourced `120 km` loses the unit entirely rather than merely
        // mispronouncing it. Same reasoning as Russian's aliases.
        "km": ["кілометр", "кілометри", "кілометрів", "кілометра"],
        "cm": ["сантиметр", "сантиметри", "сантиметрів", "сантиметра"],
        "mm": ["міліметр", "міліметри", "міліметрів", "міліметра"],
        "kg": ["кілограм", "кілограми", "кілограмів", "кілограма"],
    },
    unitPer: "на", // км/год → кілометрів НА годину; the denominator is accusative
    rateDenominators: { "год": "годину", "ч": "годину", "h": "годину", "с": "секунду", "s": "секунду" },
    // Ukrainian puts the measure adjective BEFORE the noun as a separate agreeing word — квадратних
    // кілометрів — the same shape as Russian, not Swedish's fused compound.
    exponentWords: {
        squared: ["квадратний", "квадратні", "квадратних", "квадратного"],
        cubed: ["кубічний", "кубічні", "кубічних", "кубічного"],
        position: "before",
    },
    // Inflected forms too, because running text writes the one its numeral governs (2 мільйони, 5 мільйонів).
    magnitudes: ["тисячі", "тисяч", "мільйон", "мільйона", "мільйони", "мільйонів",
        "мільярд", "мільярда", "мільярди", "мільярдів"],
    // A DECIMAL governs the GENITIVE SINGULAR in Ukrainian — 2,4 відсотка — which is a fourth form,
    // because unlike Russian the 2–4 slot here is the NOMINATIVE PLURAL (два відсотки) and so cannot
    // serve. `CountForms` is a plain string[] and `pick` clamps to the array length, so the extra entry
    // is local data, not a schema change; the three-form languages are untouched.
    countForm: (n) => (Number.isInteger(n) ? slavicCountForm(n) : 3),
});

const CYRILLIC = "\\u0400-\\u04FF";
// The number token carries its DECIMAL COMMA (Ukrainian's decimal mark) so the comma is not read as clause
// punctuation — `1,5 кілометра` was coming out as a phrase break between "один" and "п'ять".
const TOKEN = new RegExp(`([${CYRILLIC}'’ʼ]+)|(\\d+(?:,\\d+)?)|([.?!,;:…—])`, "gu");

export type ForeignPhonemizer = (latin: string) => string;

class UkrainianPhonemizer implements Phonemizer {
    text(input: string): string {
        // order: Ukrainian rewrites (de-grouping, abbreviations, ordinal notation, clock, ranges,
        // signs) → INITIALISMS (after the abbreviations, so a dotted abbreviation is never spelled out)
        // → the shared symbol tier LAST, because it needs the number still adjacent to its unit or sign.
        // Roman numerals arrive already converted at the registry seam (uk is not in ROMAN_NATIVE), with
        // romanOrdinals.ts supplying the ordinal a century wants, so the roman-vs-initialism ordering
        // hazard cannot arise here.
        const normalized = SYMBOLS(normalizeUkrainianInitialisms(normalizeUkrainian(input)));
        return assembleClauses(normalized, TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(m[1]));
            else if (m[2]) {
                const [intPart, frac] = m[2].split(",");
                sink.emit(number(intPart!));
                if (frac !== undefined) {
                    sink.emit(phonemizeWord(DEF.numbers.decimalConnector));
                    for (const dg of frac) sink.emit(number(dg));
                }
            } else if (m[3]) {
                const mk = CLAUSE_MARK[m[3]];
                if (mk) sink.pause(mk);
            }
        });
    }
}

/** Build the Ukrainian phonemizer. */
export function createUkrainian(): Phonemizer {
    return new UkrainianPhonemizer();
}
