/**
 * Native Hindi text phonemizer — canonical IPA, espeak-independent. Assembles the generic abugida modules
 * (G2P + weight-stress + number compositor) with Hindi's self-describing JSONC definition (hindi.jsonc,
 * beside this file). No espeak rules/tables/dict/numbers.
 *
 * text() handles: Devanagari word runs, number runs (integer + Indian grouping + decimal), clause-
 * terminating punctuation → canonical inline pause marks, symbols (% → प्रतिशत, ₹ stripped), and embedded
 * Latin runs → an injected foreign (en) phonemizer.
 */
import { makeAbugidaG2P, type AbugidaDef } from "../../core/abugida.ts";
import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";
import { applyWeightStress } from "../../core/weightStress.ts";
import { renderNumber, type NumbersDef } from "../../core/numbers.ts";
import { loadSharedPhonology, type Phonology } from "../../core/phonology.ts";
import { deleteMedialSchwa } from "../../core/schwa.ts";
import {
    DEVANAGARI_DIGITS,
    DEVANAGARI_WORD,
    IPA_VOWELS,
} from "../../core/unicode.ts";
import { loadManifest } from "../../core/loadManifest.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { makeHindiNormalizer } from "./normalize.ts";

export interface HindiDef extends AbugidaDef {
    postRules: { from: string; to: string }[];
    finalRules: { from: string; to: string }[];
    numbers: NumbersDef;
    schwaDeletion: {
        deleteWordFinal?: boolean;
        retainInMonosyllable?: boolean;
        retainFinalAfterCluster?: boolean;
    };
    clausePunctuation: Record<string, string>;
    symbols?: Record<string, string>;
    stripSymbols?: string;
}

/** Foreign-run phonemizer (embedded Latin → e.g. en), injected by the registry. */
export type ForeignPhonemizer = (latin: string) => string;

const VOWEL_G = new RegExp(`[${IPA_VOWELS}]`, "g");

/** Does the coda (a word body with the final schwa already removed) end in a consonant CLUSTER or GEMINATE?
 *  Used by `retainFinalAfterCluster` (Marathi): the word-final inherent schwa is deleted after a single
 *  consonant (घर→ɡʱəɾ) but RETAINED to avoid a word-final cluster (अंक→əŋkə, महत्त्व→məɦət̪ːʋə, अन्न→ənːə).
 *  Affricates (t͡ʃ d͡ʒ t͡s d͡z) are ONE consonant (आज→aːd͡z deletes); a length mark ː is a geminate = heavy. */
export function heavyFinalCoda(body: string): boolean {
    // Geminate/long CONSONANT coda (क्क→kː) is heavy. Guard the ː to a consonant so a (structurally
    // unreachable, but defensive for future flag users) trailing long VOWEL isn't misread as a geminate.
    if (new RegExp(`[^${IPA_VOWELS}]ː$`).test(body)) return true;
    // Collapse affricates to a single placeholder BEFORE stripping the (combining) tie bar, so d͡z counts as 1.
    const collapsed = body
        .replace(/t͡ʃ|d͡ʒ|t͡s|d͡z/g, "Ç")
        .normalize("NFD")
        .replace(/[̀-ͯʰ-ʱːˈˌ]/g, ""); // drop combining marks, ʰ ʱ, ː, stress
    let n = 0;
    const chars = [...collapsed];
    for (let i = chars.length - 1; i >= 0; i--) {
        const c = chars[i]!;
        if (IPA_VOWELS.includes(c)) break;
        if (c.trim() !== "") n++;
    }
    return n >= 2;
}

/** The script's word-run char class + digit map — defaults to Devanagari (Hindi/Marathi); Gujarati etc. pass
 *  their own so the whole abugida orchestration (schwa deletion, weight stress, numbers) is reused as-is. */
export interface AbugidaScript {
    word: string;
    digits: Record<string, string>;
}

export function makeNativeHindi(
    def: HindiDef,
    phon: Phonology = loadSharedPhonology(),
    foreign?: ForeignPhonemizer,
    script: AbugidaScript = { word: DEVANAGARI_WORD, digits: DEVANAGARI_DIGITS },
    lexicon?: ReadonlyMap<string, string>,
    /**
     * PER-LANGUAGE OVERRIDES for the two things that are Hindi's LEXICAL choices rather than its engine.
     *
     * Nine languages reuse this engine, and until this parameter existed they also inherited Hindi's
     * normalizer and Hindi's symbol words — so Marathi spoke प्रतिशत, बजकर and मिनट, none of which are
     * Marathi. That is the same principle the acronym work settled one layer up: a lexical fact belongs in
     * the language's own data, not in shared machinery.
     *
     * Both default to Hindi's, so a language that supplies neither is byte-identical to before. Six of the
     * nine (bho, mai, mag, awa, hne, rkt) have no FLEURS corpus and so will never come through a
     * normalization batch; leaving them on the Hindi defaults is the honest outcome for them until
     * someone has evidence, and this parameter is how that evidence gets applied without touching Hindi.
     */
    overrides: {
        normalize?: (input: string) => string;
        symbols?: (input: string) => string;
    } = {},
) {
    const g2p = makeAbugidaG2P(def, phon);
    const DIGIT_CLASS = "0-9" + Object.keys(script.digits).join("");
    const CLAUSE_MARK = def.clausePunctuation; // Devanagari danda ।/॥ + ASCII → canonical pause (from hindi.jsonc)
    const post = def.postRules.map((r) => ({
        re: new RegExp(r.from, "gu"),
        to: r.to,
    }));
    const fin = def.finalRules.map((r) => ({
        re: new RegExp(r.from, "gu"),
        to: r.to,
    }));
    const symbols = def.symbols ?? {};
    const strip = def.stripSymbols ?? "";
    const symbolClass = [...Object.keys(symbols), ...strip].join("");
    const tokenRe = new RegExp(
        // ⚠ THE LATIN GROUP SPANS ALL OF LATIN, not just ASCII — `[A-Za-z]+` shredded every accented foreign name.
    // A diacritic ENDED the token, so the letter carrying it became an unclaimed gap read as an English LETTER
    // NAME and the rest of the word started over: `São Paulo` in Hindi read *ˈɛs ˈə ˈoᶷ pʰˈɔːloᶷ* — "ES ə O
    // Paulo". One word became three, none of them right.
    // ⚠ INVISIBLE TO EVERY GATE: no digit or raw mark survives and nothing VANISHES, so it is a WRONG-WORD
    // defect that neither the leak classes nor the differential DROP test can see.
    // Simpler than the identical fix in `id`, and for a structural reason: THIS group already means "foreign"
    // (its match goes straight to the injected reader), so widening it is the whole change. Indonesian's Latin
    // group is its NATIVE word group, so widening there also needed a native-vs-foreign decision.
    // `\p{M}` so a DECOMPOSED accent stays with its base instead of ending the token one character later.
    // ⚠ REACHES 17 LANGUAGES, every one that composes `makeNativeHindi`.
    `([${script.word}]+)|(\\p{Script=Latin}[\\p{Script=Latin}\\p{M}]*)|([${DIGIT_CLASS}]+(?:,[${DIGIT_CLASS}]+)*(?:\\.[${DIGIT_CLASS}]+)?)` +
            `|([।॥.?!,;:])${symbolClass ? `|([${symbolClass}])` : ""}`,
        "gu",
    );

    /** Pure RULE-ENGINE word→IPA (no lexicon) — the honest, non-circular signal used by the referee eval. */
    function wordRules(w: string): string {
        let x = g2p(w);
        for (const r of post) x = x.replace(r.re, r.to);
        const syls = (x.match(VOWEL_G) || []).length;
        if (
            def.schwaDeletion.deleteWordFinal &&
            !(def.schwaDeletion.retainInMonosyllable && syls <= 1) &&
            !(
                def.schwaDeletion.retainFinalAfterCluster &&
                /ə$/.test(x) &&
                heavyFinalCoda(x.slice(0, -1))
            )
        )
            x = x.replace(/ə$/, "");
        x = deleteMedialSchwa(x);
        for (const r of fin) x = x.replace(r.re, r.to);
        return applyWeightStress(x).normalize("NFC");
    }

    /** SHIPPED word→IPA: a whole-word lexicon override (for the proven-lexical schwa tail) then the rule engine. */
    function word(w: string): string {
        return lexicon?.get(w.normalize("NFC")) ?? wordRules(w);
    }

    const toAscii = (digits: string): string =>
        [...digits]
            .filter((d) => d !== ",")
            .map((d) => script.digits[d] ?? d)
            .join("");

    function number(digits: string): string {
        const ascii = toAscii(digits);
        const dot = ascii.indexOf(".");
        if (dot >= 0 && def.numbers.decimalWord) {
            const intN = Number(ascii.slice(0, dot) || "0");
            if (!Number.isSafeInteger(intN)) return ascii;
            const frac = [...ascii.slice(dot + 1)].map((d) =>
                word(def.numbers.units[Number(d)]!),
            );
            return [
                renderNumber(intN, def.numbers, word),
                word(def.numbers.decimalWord),
                ...frac,
            ].join(" ");
        }
        const n = Number(ascii);
        if (!Number.isSafeInteger(n)) return ascii;
        return renderNumber(n, def.numbers, word);
    }

    // #562 normalization: Hindi-specific rewrites (ordinal suffixes, Devanagari unit abbreviations,
    // abbreviations, clock, signs, fractions) BEFORE the shared symbol tier, whose unit keys are Latin.
    // Roman numerals need no ordering care: `hi` is not in the registry's ROMAN_NATIVE set, so the shared
    // pass has already run at the registry seam.
    const normalize = overrides.normalize ?? makeHindiNormalizer(def.numbers);
    const symbolTier = overrides.symbols ?? SYMBOLS;

    function text(input: string): string {
        return assembleClauses(symbolTier(normalize(input)), tokenRe, (m, sink) => {
            if (m[1]) sink.emit(word(m[1]));
            else if (m[2]) sink.emit(foreign ? foreign(m[2]) : "");
            else if (m[3]) sink.emit(number(m[3]));
            else if (m[4]) {
                const mk = CLAUSE_MARK[m[4]];
                if (mk) sink.pause(mk);
            } else if (m[5]) {
                if (!strip.includes(m[5]) && symbols[m[5]])
                    sink.emit(word(symbols[m[5]]!));
            }
        });
    }

    return { word, wordRules, number, text };
}

/** Load hindi.jsonc (beside this file) and build the Hindi phonemizer. `foreign` handles embedded Latin. */
// #562 symbol normalization — Hindi (प्रतिशत is invariant; units after the number).
const SYMBOLS = makeSymbolNormalizer({
    // #586 `multiply` — the word is this language's OWN, harvested from its existing `×` rule, so nothing new
    // is sourced. Declaring it HERE is what makes ASCII `x` read like `×`: `6x6 cm` was reading the `x` as a
    // LETTER NAME, and `NxN` forms outnumber `×` roughly 85 to 20 across the corpora. One word, so `by` is
    // omitted and defaults to it — this language does not split dimension from product.
    multiply: { times: "गुणा" },
    percent: ["प्रतिशत"],
    // `¢` added for #586, and it is ROBUSTNESS with an unusually honest caveat. The sign occurs in ZERO of the
    // 67 FLEURS corpora and NO language in the fleet declares it, so this is a fleet-wide gap that happens to
    // surface through hi — the only hit anywhere is hi's wiki artifact, `२०¢ या १०¢ तक`.
    // ⚠ AND THAT SENTENCE IS ALMOST CERTAINLY CORRUPT. It is about a VERNIER SCALE ("बर्नियर से … तक पढ़ने की
    // सुविधा"), which reads arc-seconds, not money — and the same artifact carries the same sentence with `²`
    // where this one has `¢` (`२०² या १०²`). Two different characters in one slot across two copies is the
    // signature of an OCR or encoding corruption of `″`, and neither `¢` nor `²` is what the author wrote.
    // Declared anyway, because the engine's job is to read the character it is given and #584's rule stands: a
    // dropped sign is INAUDIBLE, the one outcome that cannot be right. `सेंट` is the ordinary Hindi form of the
    // currency name — plain lexis, not an attestation, and marked so no later pass credits the corpus with it.
    currency: { "$": ["डॉलर"], "€": ["यूरो"], "£": ["पाउंड"], "₹": ["रुपये"], "¥": ["येन"], "¢": ["सेंट"] },
    // `m` — मीटर ×8, and digit-adjacent bare `m` is ×0 in this corpus, so the one-letter-key hazard is
    // checked rather than assumed. `घन` was declared below but unreachable without it: the exponent branch
    // resolves the unit from `units` first, so `5 m³` read as the bare letter *ˈɛm*.
    units: { km: ["किलोमीटर"], cm: ["सेंटीमीटर"], mm: ["मिलीमीटर"], kg: ["किलोग्राम"], m: ["मीटर"] },
    // `km²` → वर्ग किलोमीटर. Undeclared, the tier left the whole match alone and `km²` reached the IPA as a
    // Latin fragment — `5 km²` read as *pˈaː̃t͡ʃ ˈʊkm*, worse than the raw text, and the review gate could not
    // flag it as a DROP because deleting the `²` changes the output.
    // वर्ग is corpus-attested in exactly this slot: "यह पार्क 19,500 वर्ग किलोमीटर में फैला है". घन is the
    // formal counterpart; the corpus writes the loan क्यूबिक once ("120-160 क्यूबिक मीटर ईंधन"), which is
    // what a speaker may say but not what the notation should compose to.
    // `before`, not `compound`: Hindi sets the measure word off with a space, and one form each because the
    // word does not agree with its count here.
    exponentWords: { squared: ["वर्ग"], cubed: ["घन"], position: "before" },
    // #586 BARE EXPONENT — the reading for a power with NO unit to modify (`20²`, `mc²`), which every language
    // in the fleet was dropping silently. See `bareExponent` in core/normalizeSymbols.ts for why this cannot
    // reuse `exponentWords` above: that is the unit MODIFIER and this is the PREDICATE, and in most languages
    // they are different words (वर्ग किलोमीटर but बीस का वर्ग).
    // ⚠ PROVENANCE, stated because it is weaker than most data in this repo: these are STANDARD MATHEMATICAL
    // REGISTER, not corpus attestations. The power words are ×0 in this language's artifact, and the apparent
    // hits for other languages were substring traps of exactly the kind tools/normalization/attest.ts warns
    // about — th `กำลัง` matched the progressive-aspect marker, fa `توان` and ar `أس` matched inside unrelated
    // words. FLEURS is news and encyclopedia prose and simply does not contain spoken arithmetic.
    // The cardinal is used for the generic power, never the ordinal — see core for that argument.
    bareExponent: { squared: "{n} का वर्ग", cubed: "{n} का घन", power: "{n} की घात {e}" , negative: "ऋण" },
});

export function createHindi(foreign?: ForeignPhonemizer): {
    text(input: string): string;
} {
    return makeNativeHindi(
        loadManifest<HindiDef>(import.meta.url, "hindi.jsonc"),
        loadSharedPhonology(),
        foreign,
    );
}
