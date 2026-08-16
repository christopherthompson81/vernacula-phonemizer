/**
 * Chuvash (chv) phonemizer — a Cyrillic grapheme scan, canonical IPA. This file owns the two signature
 * rules as passes: ALLOPHONIC VOICING (voiceless obstruents voice between vowels / after a nasal/glide /
 * after a liquid before a FULL vowel, with geminates blocking) and REDUCED-VOWEL STRESS (stress on the
 * last FULL vowel; ⟨ӑ ӗ⟩ never stressed), plus the ⟨е⟩ [je]/[e] split and gemination. The letter tables
 * and the encyclopedic record live in chuvash.jsonc.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { loadManifest } from "../../core/loadManifest.ts";
import { numberToWords } from "./numbers.ts";
import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";
import { normalizeChuvash, normalizeChuvashInitialisms, spellAttributive } from "./normalize.ts";

interface ChuvashDef {
    onset: Record<string, string>;
    voiced: Record<string, string>;
    vowels: Record<string, string>;
    iotated: Record<string, string>;
    voicingSonorants: readonly string[];
    liquids: readonly string[];
    vowelLetters: readonly string[];
}
const DEF = loadManifest<ChuvashDef>(import.meta.url, "chuvash.jsonc");
// Letter → IPA tables (chuvash.jsonc). The voicing/stress/⟨е⟩/gemination rules are the scan below.
const ONSET = DEF.onset;
const VOICE = DEF.voiced;
const VOWEL = DEF.vowels;
const IOTATED = DEF.iotated;
const CYR_VOWEL = new Set(DEF.vowelLetters);
// Voicing triggers (before a vowel). The nasals ⟨н м ҥ⟩ and the glide ⟨й⟩ trigger voicing UNCONDITIONALLY, like an
// intervocalic vowel (манпа→manˈba, мӗншӗн→ˈmŏnʐɘn before a REDUCED vowel, айта→ajˈda). The liquids ⟨р л⟩ trigger it
// only before a FULL vowel — the generalization that fits all three referee cases: вӑлсем→ʋəlˈzem (л·с·е FULL → z) vs
// ҫулҫӑ→ɕulɕ… (л·ҫ·ӑ REDUCED → ɕ) and чӗрпӗк→…rʲpʲ… (р·п·ӗ REDUCED → p).
const NASAL_GLIDE = new Set(DEF.voicingSonorants);
const LIQUID = new Set(DEF.liquids);
const REDUCED = new Set(["ə", "ɘ"]); // reduced vowels — never stressed

type Seg = { ipa: string; vowel: boolean; reduced: boolean; palatal?: boolean };

/** Phonemize one Chuvash word → canonical IPA (Cyrillic scan + intervocalic/post-nasal voicing + reduced-vowel stress). */
export function phonemizeWord(word: string): string {
    const chars = [...word.normalize("NFC").toLowerCase()];
    const segs: Seg[] = [];
    for (let i = 0; i < chars.length; i++) {
        const ch = chars[i]!;
        if (ch === "е") {
            // ⟨е⟩ → [je] word-initial / post-vowel, [e] otherwise.
            // ⚠ AND AFTER ⟨ъ⟩/⟨ь⟩, which is the whole point of writing one: the SEPARATING sign says the
            // following iotated letter keeps its glide instead of merging with the consonant. Chuvash writes
            // both only in Russian loans, and the loans are exactly the words that need it — `объектов` read
            // `obekˈtoʋ`, losing the [j] of [objekt]. ⟨я ю ё⟩ need no arm here: their glide is unconditional.
            const prevV = i > 0 && (CYR_VOWEL.has(chars[i - 1]!) || chars[i - 1] === "ъ" || chars[i - 1] === "ь");
            if (i === 0 || prevV) segs.push({ ipa: "j", vowel: false, reduced: false });
            segs.push({ ipa: "e", vowel: true, reduced: false });
        } else if (VOWEL[ch] !== undefined) {
            const v = VOWEL[ch]!;
            segs.push({ ipa: v, vowel: true, reduced: REDUCED.has(v) });
        } else if (IOTATED[ch] !== undefined) {
            const [g, v] = [...IOTATED[ch]!]; // glide + vowel (ja ju jo)
            segs.push({ ipa: g!, vowel: false, reduced: false });
            segs.push({ ipa: v!, vowel: true, reduced: false });
        } else if (ONSET[ch] !== undefined) {
            // Gemination: a doubled consonant is the "strong" segment — single long [Cː] that BLOCKS voicing.
            if (i + 1 < chars.length && chars[i + 1] === ch) {
                segs.push({ ipa: ONSET[ch]! + "ː", vowel: false, reduced: false });
                i++; // consume the pair
            } else {
                segs.push({ ipa: ONSET[ch]!, vowel: false, reduced: false });
            }
        } else if (ch === "ь") {
            // ⚠ THE SOFT SIGN IS NOT SILENT IN CHUVASH — it PALATALIZES the consonant it follows, and it is
            // the one place the contrast is not predictable. Chuvash palatalization before a FRONT vowel is
            // allophonic and this engine does not emit it (see the referee config's `ʲ` fold); ⟨ь⟩ marks it
            // where no front vowel follows — before a REDUCED or back vowel, or word-finally, which is where
            // the language's own minimal pairs live: `выльӑх` [ʋɯlʲəχ] (the referee's own transcription),
            // `тӑрать` [təradʲ] the 3sg present against a bare stem. Reading it as nothing deleted the mark
            // in all 364 of its corpus occurrences.
            // ⚠ RECORDED AS A FLAG, APPLIED AFTER THE VOICING PASS. Appending [ʲ] to the segment here would
            // change the string the voicing table is keyed on (`t` → `tʲ` is not a row in `voiced`), so the
            // allophonic voicing of every ⟨ь⟩-bearing word would silently switch off.
            const prev = segs[segs.length - 1];
            if (prev !== undefined && !prev.vowel && prev.ipa !== "j") prev.palatal = true;
        }
        // ъ and stray marks: dropped (⟨ъ⟩'s one job, the glide before ⟨е⟩, is in the ⟨е⟩ arm above)
    }

    // ⚠ VOICING pass: a voiceless obstruent voices when the previous seg is a vowel or a nasal AND the next seg is a
    // vowel (intervocalic V_V, or nasal_V). Geminates already carry the length mark and are not in VOICE → untouched.
    for (let k = 0; k < segs.length; k++) {
        const s = segs[k]!;
        const voiced = VOICE[s.ipa];
        if (voiced === undefined) continue;
        const prev = segs[k - 1];
        const next = segs[k + 1];
        if (prev === undefined || next === undefined || !next.vowel) continue; // must be prevocalic
        const trigger = prev.vowel || NASAL_GLIDE.has(prev.ipa) || (LIQUID.has(prev.ipa) && !next.reduced);
        if (trigger) s.ipa = voiced;
    }

    // PALATALIZATION, after the voicing table has read the bare segment: `тӑрать` is [təradʲ], the voicing
    // and the softening both. Applied to the FINAL segment string, so `t͡ɕ`-style multi-character segments
    // take the modifier at the end where IPA wants it.
    for (const s of segs) if (s.palatal === true) s.ipa += "ʲ";

    // ⚠ STRESS: the last FULL (non-reduced) vowel; if the word has only reduced vowels, the first vowel. ˈ before the
    // nucleus's onset consonant.
    const vIdx = segs.map((s, idx) => (s.vowel ? idx : -1)).filter((x) => x >= 0);
    if (vIdx.length) {
        const full = vIdx.filter((idx) => !segs[idx]!.reduced);
        const nucleus = full.length ? full[full.length - 1]! : vIdx[0]!;
        const at = nucleus > 0 && !segs[nucleus - 1]!.vowel ? nucleus - 1 : nucleus;
        segs.splice(at, 0, { ipa: "ˈ", vowel: false, reduced: false });
    }
    return segs.map((s) => s.ipa).join("").normalize("NFC");
}

/** A digit run → spoken Chuvash, phonemized through the same Cyrillic g2p (data + provenance in numbers.ts). */
function number(digits: string): string {
    const n = Number(digits);
    // ⚠ ABOVE 2^53 THE RAW ASCII DIGITS USED TO LEAK STRAIGHT INTO THE IPA. `isSafeInteger` is right to
    // refuse to COMPOSE — the float has already lost the low digits, so the numeral would be confidently
    // wrong — but the refusal returned the digit string, which no g2p in this fleet reads. Read it out
    // digit-at-a-time instead, THROUGH THE SAME COMPOSER: a one-digit number is a call this engine already
    // answers, so the fallback cannot invent a word. See core/numbers.ts `spellDigits` for the full
    // account and the cost — above 2^53 the reading is a digit string, not a quantity.
    if (!Number.isSafeInteger(n))
        return [...digits].flatMap((d) => numberToWords(Number(d))).map(phonemizeWord).join(" ");
    return numberToWords(n).map(phonemizeWord).join(" ");
}

/**
 * The shared SYMBOL tier. Every word is a cv.wikipedia TOKEN attestation whose examples were read
 * (`tools/corpus/attest/chv.jsonc`).
 *
 * \u26a0 NO BARE `\u0433` OR `\u0442` AND NO `\u0441`. This corpus carries Russian bibliography in quantity
 * (`\u2013 255 \u0441. : \u0438\u043b., \u043f\u043e\u0440\u0442\u0440.`, `\u0423\u0447. \u0437\u0430\u043f. \u0427\u041d\u0418\u0418, \u0432\u044b\u043f. 49`, `1000 \u044d\u043a\u0437.`), where `\u0441.` is
 * \u0441\u0442\u0440\u0430\u043d\u0438\u0446 and `\u0433.` is \u0433\u043e\u0434\u0430 \u2014 and the tier's trailing guard does not reject a dot, so declaring
 * either key would read every Russian page count as a second and every Russian year as a gram. Same call
 * ba and tt made. `\u04ab` IS declared as a rate denominator, because the slash position rules the other
 * reading out: the corpus's `2,8 \u043c/\u00e7` is metres per second.
 */
const SYMBOLS = makeSymbolNormalizer({
    percent: ["процент"],
    currency: { "$": ["доллар"], "€": ["евро"], "₽": ["тенкӗ"] },
    units: {
        "км": ["километр"], "см": ["сантиметр"], "мм": ["миллиметр"], "кг": ["килограмм"],
        "га": ["гектар"], "м": ["метр"],
        // LATIN aliases. cv.wikipedia writes the Cyrillic abbreviation in most articles, but its Turkish
        // province stubs write `8 413 km²` and `12 235 km²` in otherwise-Chuvash prose, and the
        // engine's TOKEN matches Cyrillic only — so those lose the unit entirely.
        "km": ["километр"], "cm": ["сантиметр"], "mm": ["миллиметр"], "m": ["метр"],
    },
    // Chuvash does not say "A per B": the denominator takes the possessive-locative and stands alone
    // (*метр ҫеккунтра*), which is Basque's shape — `unitPer` is the empty string.
    unitPer: "",
    rateDenominators: { "ҫ": "ҫеккунтра", "ç": "ҫеккунтра", "s": "ҫеккунтра", "h": "сехетре" },
    exponentWords: { squared: ["тӑваткал"], cubed: ["куб"], position: "before" },
    ampersand: "тата", // ×52 — "Лот тата Гаронна", "4 округ, 40 кантон тата 319 коммуна кĕреççĕ"
    // ⚠ NO `multiply`, AND THE CANDIDATE IS THE REASON. `хут` ×78 is PAPER in every one of its
    // attestations ("Хут — çулçă евĕр целлюлозăран хатĕрлесе тунă çыру материалĕ") — the Fula `tere`
    // shape. The frequency word is `хутчен` ("тăваттă хутчен Совет Союзĕн Паттăрĕ", "Виç хутчен
    // чĕрĕлнĕскер"), which is "on four occasions" rather than an arithmetic product. This corpus's `×`
    // is ×0 and its `=` is a library catalogue's parallel-title mark, so nothing is lost by declining.
    // Chuvash writes the magnitude word after the figure and often after a DECIMAL (`13,3 пин км²`,
    // `1,3 миллион ҫын`), so the tier must hop it to reach a unit on the far side. Turkic
    // magnitudes do not inflect.
    magnitudes: ["пин", "миллион", "миллиард", "триллион"],
});

// A Chuvash Cyrillic word / number / punctuation.
// \u26a0 THE DECIMAL COMMA IS SPANNED BY THE NUMBER BRANCH, or the tokenizer's own `,` claims it as a clause
// pause and `+18,7\u00b0\u0421` reads as *\u0432\u0443\u043d\u043d\u04d1 \u0441\u0430\u043a\u043a\u04d1\u0440 , \u04ab\u0438\u0447\u0447\u04d7* \u2014 a phrase break inside a temperature. `decimals` is
// 10,743 corpus-wide and the retained text writes 143 of them, mostly climate readings.
const TOKEN = /([Ѐ-ӿ]+)|(\d+(?:,\d+)?)|([.!?…,;:])/gu;

class ChuvashPhonemizer implements Phonemizer {
    text(input: string): string {
        // NFC-normalize BEFORE tokenizing: Chuvash ⟨ӑ ӗ ӳ⟩ decompose under NFD to base+combining (U+0306/U+030B), and
        // those combining marks fall OUTSIDE the [Ѐ-ӿ] token class — so NFD input would shatter words mid-token and
        // drop the reduction mark (чӑваш → "t͡ɕa ʋaʂ"). phonemizeWord re-normalizes, but the split has already happened.
        // normalize.ts FIRST — its clock, ordinal, degree and sign steps need the figure and its written
        // suffix still adjacent, which the tier would break — then the INITIALISM pass, then the shared
        // symbol tier, which matches a unit only when a NUMBER is adjacent. And `spellAttributive` LAST,
        // because the question it answers (is a noun coming?) has no answer until the tier has turned
        // `км` into `километр` — see normalize.ts.
        const prepared = spellAttributive(SYMBOLS(normalizeChuvashInitialisms(normalizeChuvash(input.normalize("NFC")))));
        return assembleClauses(prepared, TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(m[1]));
            else if (m[2]) {
                const [intPart, frac] = m[2].split(",");
                sink.emit(number(intPart!));
                if (frac !== undefined) {
                    // The decimal separator's own NAME, and ⚠ IT IS SOURCED BY A TRANSLATION GLOSS
                    // RATHER THAN BY A COUNT. `хӳрешке` is ×2 in cv.wikipedia and both are the same film
                    // title — but that title is glossed against the Russian in its own lead, "Пăнчă,
                    // пăнчă, хӳрешке... (выр. Точка, точка, запятая...)", which names the comma directly.
                    // ⚠ AND THE OBVIOUS CANDIDATE IS A FALSE ATTESTATION: `запятой` scores ×7 and all
                    // seven are inside RUSSIAN-language reference titles ("Орфографические правила
                    // употребления запятой"), the Fula `tere` shape. THE FULL SPOKEN READING IS DECLINED,
                    // deliberately: Chuvash says the whole-part word plus a tail that NAMES THE DECIMAL
                    // PLACE, and the place name cannot be composed here — half of a two-part reading is
                    // worse than the sign's name. Same call ba made (өтөр), tt made (өтер), uk made
                    // (кома), pl made (przecinek) and be made (коска).
                    sink.emit(phonemizeWord("хӳрешке"));
                    for (const dg of frac) sink.emit(number(dg));
                }
            }
            else if (m[3]) sink.pause(m[3] === "." || m[3] === "!" || m[3] === "?" ? m[3] : ",");
        });
    }
}

/** Build the Chuvash phonemizer (Cyrillic scan + allophonic voicing + geminate-blocking + reduced-vowel stress). */
export function createChuvash(): Phonemizer {
    return new ChuvashPhonemizer();
}
