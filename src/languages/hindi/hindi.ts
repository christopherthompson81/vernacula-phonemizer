/**
 * Native Hindi text phonemizer — canonical IPA. Assembles the generic abugida modules
 * (G2P + weight-stress + number compositor) with Hindi's self-describing JSONC definition (hindi.jsonc,
 * beside this file).
 *
 * text() handles: Devanagari word runs, number runs (integer + Indian grouping + decimal), clause-
 * terminating punctuation → canonical inline pause marks, symbols (% → प्रतिशत, ₹ stripped), and embedded
 * Latin runs → an injected foreign (en) phonemizer.
 */
import { makeAbugidaG2P, type AbugidaDef } from "../../core/abugida.ts";
import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";
import { applyWeightStress } from "../../core/weightStress.ts";
import { renderNumber, spellDigits, type NumbersDef } from "../../core/numbers.ts";
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
        /** ⚠ A word-final AVAGRAHA ⟨ऽ⟩ (U+093D) retains the inherent vowel it writes. See the note in
         *  wordRules — this is spelling-driven, so it overrides the deletion rule for that word alone.
         *  The SIGN itself comes from `AbugidaScript.avagraha`, since it differs per Brahmic block. */
        retainOnAvagraha?: boolean;
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
    /**
     * The script's AVAGRAHA sign, for `schwaDeletion.retainOnAvagraha`. ⚠ IT IS PER-SCRIPT, not a
     * constant: the Brahmic blocks are aligned so it sits at offset 0x3D in each — Devanagari ऽ U+093D,
     * Bengali ঽ U+09BD, Gujarati ઽ U+0ABD. Hard-coding the Devanagari one would make the flag silently
     * INERT for any language passing another block, with the manifest still reading as though it were on.
     */
    avagraha?: string;
}

export function makeNativeHindi(
    def: HindiDef,
    phon: Phonology = loadSharedPhonology(),
    foreign?: ForeignPhonemizer,
    script: AbugidaScript = { word: DEVANAGARI_WORD, digits: DEVANAGARI_DIGITS, avagraha: "\u093D" },
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

    // ⚠ FAIL LOUDLY RATHER THAN SILENTLY DO NOTHING. A manifest asking for avagraha retention under a
    // script that has not declared its avagraha would read as though the rule were on while every final
    // schwa still deleted — the failure mode this codebase keeps turning up. Cheap, and only reachable
    // through misconfiguration.
    const retainOnAvagraha = def.schwaDeletion.retainOnAvagraha === true;
    if (retainOnAvagraha && script.avagraha === undefined)
        throw new Error("schwaDeletion.retainOnAvagraha is set but this script declares no `avagraha` sign");

    /** Pure RULE-ENGINE word→IPA (no lexicon) — the honest, non-circular signal used by the referee eval. */
    function wordRules(w: string): string {
        let x = g2p(w);
        // ⚠ THE AVAGRAHA ⟨ऽ⟩ IS READ FROM THE SPELLING, NOT THE PHONES. In Bhojpuri it WRITES the final
        // inherent vowel that would otherwise delete (करऽ kʌrʌ vs कर kʌr, दऽ dʌ, देखऽ dekʰʌ) — an
        // orthographic instruction to retain, so it is the one retain-condition that cannot be decided
        // from `x`: g2p drops the character, leaving nothing downstream to test. Verified against the
        // grammar-mined referee, where every one of its 31 avagraha forms keeps the vowel.
        const avagraha = retainOnAvagraha && w.endsWith(script.avagraha!);
        for (const r of post) x = x.replace(r.re, r.to);
        const syls = (x.match(VOWEL_G) || []).length;
        if (
            def.schwaDeletion.deleteWordFinal &&
            !avagraha &&
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
        // ⚠ ABOVE 2^53 THE RAW ASCII DIGITS USED TO LEAK STRAIGHT INTO THE IPA, in every engine built from
        // this maker — hi bgc mr gu ne bho mag hne awa mai rkt, one bug reaching eleven languages.
        // `isSafeInteger` is right to refuse to COMPOSE (the float has already lost the low digits) but the
        // refusal returned the digit string, and no g2p here reads Latin digits. Digit-at-a-time out of
        // `def.numbers.units` is exactly what the decimal tail on the line below already does, so the
        // fallback needs no word these languages' data was never measured on. See core/numbers.ts
        // `spellDigits`: above 2^53 the reading is a digit string, not a quantity.
            const intN = Number(ascii.slice(0, dot) || "0");
            const head = Number.isSafeInteger(intN)
                ? renderNumber(intN, def.numbers, word)
                : spellDigits(ascii.slice(0, dot), def.numbers, word);
            const frac = [...ascii.slice(dot + 1)].map((d) =>
                word(def.numbers.units[Number(d)]!),
            );
            return [head, word(def.numbers.decimalWord), ...frac].join(" ");
        }
        const n = Number(ascii);
        if (!Number.isSafeInteger(n)) return spellDigits(ascii, def.numbers, word);
        return renderNumber(n, def.numbers, word);
    }

    // ⚠ THE HINDI-SPECIFIC REWRITES RUN BEFORE THE SHARED SYMBOL TIER, whose unit keys are LATIN — ordinal
    // suffixes, Devanagari unit abbreviations, abbreviations, clock, signs, fractions.
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
// प्रतिशत is invariant, and the units follow the number.
const SYMBOLS = makeSymbolNormalizer({
    // ⚠ Declaring `multiply` HERE is what makes ASCII `x` read like `×`: otherwise `6x6 cm` reads the `x` as a
    // LETTER NAME, and `NxN` is the commoner written form. One word, so `by` defaults to it — Hindi does not
    // split dimension from product.
    multiply: { times: "गुणा" },
    percent: ["प्रतिशत"],
    // ⚠ `¢` IS ROBUSTNESS, NOT ATTESTATION, and the one place it surfaces is almost certainly CORRUPT: a
    // sentence about a VERNIER SCALE (`२०¢ या १०¢ तक`), which reads arc-seconds rather than money — and a second
    // copy of the same sentence carries `²` in that slot. Two different characters in one position across two
    // copies is the signature of an OCR corruption of `″`. Declared anyway, because the engine's job is to read
    // the character it is given and a dropped sign is INAUDIBLE. `सेंट` is the ordinary Hindi form of the
    // currency name — plain lexis, so no later pass should credit a corpus with it.
    currency: { "$": ["डॉलर"], "€": ["यूरो"], "£": ["पाउंड"], "₹": ["रुपये"], "¥": ["येन"], "¢": ["सेंट"] },
    // `m` — मीटर ×8, and digit-adjacent bare `m` is ×0 in this corpus, so the one-letter-key hazard is
    // checked rather than assumed. `घन` was declared below but unreachable without it: the exponent branch
    // resolves the unit from `units` first, so `5 m³` read as the bare letter *ˈɛm*.
    // ⚠ ⟨g⟩ ⟨l⟩ ⟨L⟩ ⟨ha⟩ WERE MIS-READING, NOT LEAKING — `10 ha` read *d̪ˈəs hˈɑː* and `10 l` *d̪ˈəs ˈɛɫ*,
    // the English letter name, out of a Devanagari engine. `tools/normalization/misread.ts` is the probe.
    //   लीटर     85/20  the litre article NAMES BOTH SYMBOLS: "लीटर आयतन की मात्रक है। इसके दो आधिकारिक
    //                   चिह्न (ℓ) और (L) हैं" — and writes them in use, "1 L ≡ 1 dm3", "मोल प्रति लीटर (mol/L)"
    //   हेक्टेयर  74/14  every example a digit-adjacent area glossed against acres — "1,281.67 हेक्टेयर
    //                   (3,167.1 एकड़)", "2,266.69 हेक्टेयर (5,601.1 एकड़)"
    //   ग्राम    130/10  the gram article, definitional — "ग्राम (… इसे gramme भी लिखा जाता है; एस आई इकाई…)"
    // ⚠ हेक्टर IS NOT THE WORD, and it probes better than the one that is (56 tokens / 12 arts). It is
    // HECTOR, the Trojan prince — "यूनानी मिथों के अनुसार 'हेक्टर' एक ट्रोजन सेनापति और राजकुमार था". The
    // hectare is हेक्टेयर, and taking the higher count would have put a mythological name in the unit slot.
    // ⚠ ग्राम IS A HOMOGRAPH and most of its 130 tokens are the OTHER sense — ग्राम पंचायत, "village
    // council". That is harmless HERE and would not be in a lexicon: this key emits the word only after a
    // number, where Hindi's village is not a possible reading, and the unit sense is the one the gram
    // article itself defines. The count is not the evidence; the definitional hit is.
    // ⚠ THIS TIER IS INHERITED BY SEVEN OTHER LANGUAGES, so these four keys are declared for them too.
    // `makeNativeHindi` resolves `overrides.symbols ?? SYMBOLS`, and awa, bgc, bho, hne, mag, mai and rkt
    // pass no override — mr is the one rider that does. Adding a key here therefore declares a word for
    // eight engines from ONE wiki's evidence, and it is stated rather than left to be discovered: the
    // words below are sourced from hi.wikipedia and were NOT separately attested against Awadhi, Haryanvi,
    // Bhojpuri, Chhattisgarhi, Magahi, Maithili or Rangpuri. That is the same footing the pre-existing
    // km/cm/mm/kg have stood on since they were declared, and the alternative — eight tiers differing only
    // in which SI units they omit — is worse. A rider that writes a different word should override.
    // ⚠ ONE-LETTER KEYS MEASURED (trap 46): over the artifact `<digit> g`, `<digit> l`, `<digit> L` are ×0
    // apiece, matching the bare-`m` check the line below already records, and Hindi declares no
    // `magnitudes`, so no ligature can put a stray letter where the tier expects a unit.
    // ⚠ `nm` WAS ADDED FROM A MAGAHI LEAK, NOT A HINDI ONE, and that is the clearest demonstration of the
    // inheritance note above. mag's artifact carries `एकर तरङ्गदैर्घ्य ५७०–५८० nm हे` — the visible-light
    // wavelength, in the colour article — and it read *… pˈɑ̃t͡ʃ sˈɔ ˈʌsːi nm* with the symbol echoed raw.
    // mag has no symbol tier of its own; it is this one. hi's own artifact contains no `nm` at all, so the
    // key could only ever have been found from a rider, and fixing it in the rider was never an option.
    // SOURCING, and hi.wikipedia GLOSSES THE SYMBOL ITSELF: the नैनोमीटर article opens
    // "नैनोमीटर (प्रतीक: नैमी या nm)" — the language's own statement that ⟨nm⟩ denotes this word — and the
    // word is in digit-adjacent use across unrelated articles ("380 नैनोमीटर से 750 नैनोमीटर तरंगदर्घ्य",
    // "1000 नैनोमीटर के तरंगदैघ्य पर 0.17 नैनोमीटर"). `attest.ts --lang hi`: 6 examples, every one the unit.
    // ⚠ नेनोमीटर IS A REAL VARIANT AND IS NOT DECLARED. It probes ×1, in a gloss of the symbol itself
    // ("100 nm (100 नेनोमीटर)"), against the article-title spelling with the ऐ. One form, the fuller lemma.
    units: { km: ["किलोमीटर"], cm: ["सेंटीमीटर"], mm: ["मिलीमीटर"], kg: ["किलोग्राम"], m: ["मीटर"],
        g: ["ग्राम"], l: ["लीटर"], L: ["लीटर"], ha: ["हेक्टेयर"], nm: ["नैनोमीटर"] },
    // `km²` → वर्ग किलोमीटर. Undeclared, the tier left the whole match alone and `km²` reached the IPA as a
    // Latin fragment — `5 km²` read as *pˈaː̃t͡ʃ ˈʊkm*, worse than the raw text, and the review gate could not
    // flag it as a DROP because deleting the `²` changes the output.
    // वर्ग is corpus-attested in exactly this slot: "यह पार्क 19,500 वर्ग किलोमीटर में फैला है". घन is the
    // formal counterpart; the corpus writes the loan क्यूबिक once ("120-160 क्यूबिक मीटर ईंधन"), which is
    // what a speaker may say but not what the notation should compose to.
    // `before`, not `compound`: Hindi sets the measure word off with a space, and one form each because the
    // word does not agree with its count here.
    exponentWords: { squared: ["वर्ग"], cubed: ["घन"], position: "before" },
    // BARE EXPONENT — the reading for a power with NO unit to modify (`20²`, `mc²`), which every language
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
