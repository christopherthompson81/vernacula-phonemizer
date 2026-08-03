/**
 * Native Bengali (bn) text phonemizer — canonical IPA, espeak-independent. Uses the generic abugida G2P
 * engine (core/abugida.ts) for the systematic akshara→IPA mapping, then layers the Bengali-specific
 * phonology that Hindi's assembly does NOT share:
 *
 *   1. Orthographic normalization: ং (velar-nasal sign) → ঙ্ (full [ŋ], not vowel nasalization); ৎ
 *      (khanda ta) → ত্ (vowelless dental [t̪]).
 *   2. geminate → length (fleet Indic convention) + aspiration-before-length reorder.
 *   3. VOWEL HARMONY: the inherent/independent /ɔ/ raises to [o] when a high or mid vowel (i u e o) follows
 *      in the next syllable (kɔr → kɔɾ, but kɔri → koɾi). Bengali's signature height harmony.
 *   4. INHERENT-VOWEL DELETION: unlike Hindi schwa deletion, Bengali drops the word-final inherent vowel
 *      after a single consonant (bɔl not bɔlɔ) but RETAINS it (as [o]) after a consonant CLUSTER
 *      (ɔŋʃo). Medial inherent vowels are kept.
 *
 * Stress is word-initial and weak in Bengali; the broad referee does not mark it, so we leave it unmarked.
 */
import { makeAbugidaG2P } from "../../core/abugida.ts";
import { renderNumber, type NumbersDef } from "../../core/numbers.ts";
import { deleteMedialSchwa } from "../../core/schwa.ts";
import { loadSharedPhonology, type Phonology } from "../../core/phonology.ts";
import type { AbugidaDef } from "../../core/abugida.ts";
import { BENGALI_DIGITS, BENGALI_WORD, IPA_VOWELS } from "../../core/unicode.ts";
import { loadManifest } from "../../core/loadManifest.ts";
import { loadTsvMap } from "../../core/loadTsv.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";
import { makeBengaliNormalizer } from "./normalize.ts";

// Whole-word pronunciation lexicon for the PROVEN-lexical vowel tail (closed-syllable ɔ→o, final-[o] retention)
// that no rule can derive — see bengali-lexicon.tsv for the cross-source-consensus provenance. Loaded once; the
// override is applied only on the SHIPPED path (phonemizeWord / text), never in the rule engine.
let LEXICON: Map<string, string> | undefined;
const lexicon = (): Map<string, string> => {
    if (!LEXICON) {
        // NFC-normalize keys on load: Bengali nukta letters (ড় ঢ় য়) have composed/decomposed forms, and the
        // lookup normalizes the query to NFC — so the stored keys must be NFC too or a decomposed entry would
        // silently never match.
        LEXICON = new Map();
        for (const [k, v] of loadTsvMap(
            import.meta.url,
            "bengali-lexicon.tsv",
            (v) => v,
            { optional: true },
        ))
            LEXICON.set(k.normalize("NFC"), v);
    }
    return LEXICON;
};

export interface BengaliDef extends AbugidaDef {
    numbers: NumbersDef;
    clausePunctuation: Record<string, string>;
    symbols?: Record<string, string>;
    stripSymbols?: string;
    /** Bengali height harmony (ɔ→o before a high vowel). Set false for Assamese, which lacks it. Default true. */
    heightHarmony?: boolean;
    /** Hindi/Bengali-style medial inherent-vowel deletion. Set false for Assamese, which retains it. Default true. */
    medialSchwaDeletion?: boolean;
    /** Skip the (Bengali-specific) whole-word lexicon override — set true for a reusing language (Assamese). */
    skipLexicon?: boolean;
}

/** Foreign-run phonemizer (embedded Latin → e.g. en), injected by the registry. */
export type ForeignPhonemizer = (latin: string) => string;

const VOWEL_G = new RegExp(`[${IPA_VOWELS}]`, "g");
const DIGIT_CLASS = "0-9" + Object.keys(BENGALI_DIGITS).join("");

// A geminate consonant (doubled base, possibly aspirated) → single + length ː. Same fleet convention as hi/si.
const GEMINATE =
    /(t͡ʃʰ|d͡ʒʱ|t͡ʃ|d͡ʒ|t̪ʰ|d̪ʱ|ɡʱ|kʰ|t̪|d̪|[kɡpbmnlʃɾɽŋjɦ])\1(?!͡)/gu;
// A vowel nucleus (for the harmony look-ahead and syllable count). Bengali vowels + diphthong heads.
// Bengali height harmony is triggered by a [+HIGH] vowel (i, u) in the next syllable — /ɔ/ raises to [o]
// before it (Ferguson & Chowdhury 1960). A following MID vowel (o, e) does NOT raise /ɔ/ (ঘরে→ɡʱɔre stays,
// অকলুষ→ɔkoluʃ stays), so the trigger is i/u only — not [iueo].
const HIGH = /[iu]/; // vowels that trigger ɔ→o raising in the preceding syllable

/** Per-call OOV resolver: word → IPA, or undefined to defer to the rule engine. Consulted by `word()`/`text()`
 *  BETWEEN the lexicon and the rule engine (lexicon → oovOverride → rules). Used only by the async neural path
 *  (bengaliNeural.ts) to inject pre-computed tagger readings; the sync path passes nothing, so behaviour is
 *  unchanged. It is per-CALL (a `.text()` argument), not a construction option, so one built engine is reused. */
export type OovResolver = (w: string) => string | undefined;

export function makeNativeBengali(
    def: BengaliDef,
    phon: Phonology = loadSharedPhonology(),
    foreign?: ForeignPhonemizer,
) {
    // ্যা (ya-phôla + aa-matra) and word-initial অ্যা spell the vowel [æ] in Bengali (mostly loanwords:
    // ক্যান্ডি→kænɖi, গ্যাস→ɡæʃ, ব্যাগ→bæɡ). There is no [æ] matra, so we rewrite the sequence to a private-use
    // SENTINEL and register it as both a matra (after a consonant) and an independent vowel (word-initial অ্যা).
    const AE = String.fromCharCode(0xe001);
    def.vowelSigns[AE] = { ipa: "æ" };
    def.independentVowels[AE] = { ipa: "æ" };
    const g2p = makeAbugidaG2P(def, phon);
    // #562 Bengali had NO symbol tier at all, so % and every currency sign were DROPPED outright ("3%"
    // read as just "তিন") and the Latin unit abbreviations were unexpanded. শতাংশ follows the number.
    const SYMBOLS = makeSymbolNormalizer({
        percent: ["শতাংশ"],
        currency: { "৳": ["টাকা"], "₹": ["রুপি"], $: ["ডলার"], "€": ["ইউরো"], "£": ["পাউন্ড"] },
        units: { km: ["কিলোমিটার"], cm: ["সেন্টিমিটার"], mm: ["মিলিমিটার"], kg: ["কিলোগ্রাম"],
            m: ["মিটার"], g: ["গ্রাম"], "km/h": ["কিলোমিটার প্রতি ঘন্টা"] },
        // `বর্গকিলোমিটার` ×8. SPACED rather than fused, because this tier is shared with ASSAMESE and the
        // two corpora disagree about the space — bn fuses it onto কিলোমিটার but writes `বর্গ মাইল` spaced in
        // the very same sentence, and as writes `বৰ্গ কিলোমিটাৰ` (×7) spaced throughout. `before` is
        // therefore attested in both, where `compound` would have been wrong for one of them.
        // No cubed word: ঘন ×19 in this corpus is the REDUPLICATED ADVERB `ঘন ঘন` ("frequently"), and
        // `ঘন মিটার`/`ঘনমিটার` are both zero — a count that says nothing about the unit sense (trap 12).
        exponentWords: { squared: ["বর্গ"], position: "before" },
    });
    const normalize = makeBengaliNormalizer(def.numbers);

    const CLAUSE_MARK = def.clausePunctuation;
    const symbols = def.symbols ?? {};
    const strip = def.stripSymbols ?? "";
    const symbolClass = [...Object.keys(symbols), ...strip].join("");
    const tokenRe = new RegExp(
        `([${BENGALI_WORD}]+)|([A-Za-z]+)|([${DIGIT_CLASS}]+(?:,[${DIGIT_CLASS}]+)*(?:\\.[${DIGIT_CLASS}]+)?)` +
            `|([।॥.?!,;:])${symbolClass ? `|([${symbolClass}])` : ""}`,
        "gu",
    );

    /** Bengali vowel HEIGHT HARMONY: /ɔ/ raises to [o] when the immediately following syllable is OPEN
     *  (exactly one consonant between it and the next vowel) and that vowel is HIGH [i u] — kɔ.ri→ko.ri,
     *  but a CODA blocks it (kɔɾ.ʃit stays ɔ). Right-to-left so a chain can propagate (ɔ.ɡu.ni→o.ɡu.ni). */
    function harmony(ipa: string): string {
        const vowels = [...ipa.matchAll(VOWEL_G)];
        if (vowels.length < 2) return ipa;
        let out = ipa;
        for (let k = vowels.length - 2; k >= 0; k--) {
            const idx = vowels[k]!.index!;
            const cur = out[idx]!;
            if (cur !== "ɔ" && cur !== "e") continue;
            const nextIdx = vowels[k + 1]!.index!;
            const nextV = out[nextIdx]!;
            // Between this vowel and the next: count base consonants (strip ties/modifiers). Height harmony
            // fires in an OPEN syllable — exactly one onset consonant (কর.ি→koɾi); a coda cluster (≥2) or
            // hiatus (0, the referee is inconsistent) blocks it.
            const between = out.slice(idx + 1, nextIdx).replace(/[ʰʱ̪̃͡ːʲ]/gu, "");
            const nBetween = [...between].length;
            // HIATUS (no consonant between): /ɔ/ still raises to [o] before a CLOSE vowel [i u] (বই→boi,
            // অই→oi) — but not before a mid [o e] (অওসৎ→ɔosɔt̪ keeps ɔ, referee-confirmed).
            if (nBetween === 0) {
                if (cur === "ɔ" && (nextV === "i" || nextV === "u"))
                    out = out.slice(0, idx) + "o" + out.slice(idx + 1);
                continue;
            }
            if (nBetween !== 1) continue;
            // /ɔ/ raises to [o] before a HIGH vowel [i u] (kɔ.ri→ko.ri); /e/ lowers to [æ] before low [a]
            // (de.kʰa→dæ.kʰa) — the mid vowel agrees in height with the following nucleus.
            const to =
                cur === "ɔ" && HIGH.test(nextV)
                    ? "o"
                    : cur === "e" && nextV === "a"
                      ? "æ"
                      : "";
            if (to) out = out.slice(0, idx) + to + out.slice(idx + 1);
        }
        return out;
    }

    /** Delete the word-final inherent /ɔ/ after a SINGLE consonant; keep it (raised to [o]) after a cluster. */
    function deleteFinalInherent(ipa: string): string {
        // …VC ɔ$  → …VC   (single coda consonant before the final ɔ, with a vowel before that consonant)
        // …CC ɔ$  → …CCo  (cluster: retain, realized [o])
        if (!ipa.endsWith("ɔ")) return ipa;
        const body = ipa.slice(0, -1);
        // Is there a vowel before the final consonant sequence? Find the last vowel in the body.
        const lastV = [...body.matchAll(VOWEL_G)].pop();
        if (!lastV) return body; // no vowel → drop (unusual)
        const coda = body.slice(lastV.index! + 1);
        // A heavy coda RETAINS the final vowel (realized [o]): a geminate (…ː, pɔd̪ːo) or a true cluster
        // (two+ base consonants, ɔŋʃo). A single light coda consonant DELETES it (bɔl, d͡ʒɔl) — an affricate
        // t͡ʃ/d͡ʒ counts as ONE (মাছ→mat͡ʃʰ, not mat͡ʃʰo).
        const codaBases = coda
            .replace(/t͡ʃ|d͡ʒ/gu, "C")
            .replace(/[ʰʱ̪͡ː̃]/gu, "");
        return coda.includes("ː") || codaBases.length >= 2 ? body + "o" : body;
    }

    /** Pure RULE-ENGINE word→IPA (no lexicon): the honest signal used by the referee eval. */
    function wordRules(w: string): string {
        // 1. orthographic normalization (before the generic engine sees it).
        const norm = w
            .normalize("NFC")
            .replace(/ং/gu, "ঙ্") // velar-nasal sign → full [ŋ]
            .replace(/ৎ/gu, "ত্") // khanda ta → vowelless dental [t̪]
            // ওয়া (o + antasthya-ya য় + aa) spells the glide sequence [oa]/[wa], NOT [oja] — the য় is not a
            // full [j] here (খাওয়া→kʰaoa, দেওয়া→d̪eoa, যাওয়া→d͡ʒaoa). Rewrite to ও + independent আ so the engine
            // emits o·a with no glide. (Elsewhere য় IS [j]: মেয়ে→meje is untouched.)
            .replace(/ওয়া/gu, "ওআ")
            // WORD-INITIAL ্যা → [æ] (ক্যা→kæ, গ্যাস→ɡæʃ, ন্যায়→næj) and অ্যা → [æ] (অ্যাসিড→æʃiɖ).
            // Only word-initial: MEDIAL ্যা geminates instead (বিদ্যা→bid̪d̪a) via the phôla rule below.
            .replace(/^অ্যা/u, AE)
            .replace(/^(\S)্যা/u, "$1" + AE)
            .replace(/ক্ষ/gu, "ক্খ") // ক্ষ conjunct → [kkʰ] (অক্ষর→ɔkkʰɔr), not [kʃ]
            .replace(/জ্ঞ/gu, "গ্গ") // জ্ঞ conjunct → [ɡɡ] ('gyô': জ্ঞান→ɡɡæn), not [d͡ʒn]
            // Phôla gemination — য/ব/ম as the 2nd member of a conjunct GEMINATE the preceding consonant
            // medially (jôphôla বিদ্যা→bid̪d̪a, অকাট্য→ɔkaʈːo; bôphôla মহত্ব→mɔhɔt̪t̪o; môphôla পদ্ম→pɔd̪d̪o), and
            // word-INITIALLY just drop (the phôla member is silent: ব্যথা→bæt̪ʰa, দ্বিতীয়→d̪it̪io).
            .replace(/([ক-হড়-য়])্([যবম])/gu, (_m: string, c: string, p2: string, off: number) =>
                c === "র" || (p2 === "ব" && "ঙঞণনম".includes(c)) ? _m : off === 0 ? c : c + "্" + c,
            );
        // 2. akshara → IPA (inherent ɔ intact).
        let x = g2p(norm);
        // 3. geminate → length + aspiration-before-length reorder (युद्ध-type conjuncts).
        x = x.replace(GEMINATE, "$1ː").replace(/ː([ʰʱ])/gu, "$1ː");
        // 4. HEIGHT HARMONY (ɔ→o, e→æ) — BEFORE deletion, so it keys on the ORIGINAL inherent /ɔ/. An inherent
        //    ɔ is not itself a high/mid trigger, so a later-retained final [o] can't spuriously raise the vowel
        //    before it (পদ্ম→pɔd̪ːo, not pod̪ːo); the real matra vowels still trigger (করি→koɾi, দেখা→d̪ækʰa).
        if (def.heightHarmony !== false) x = harmony(x); // Assamese (heightHarmony:false) lacks Bengali's ɔ→o raising
        // 5. WORD-FINAL inherent-vowel deletion / retention — BEFORE medial (like Hindi) so a final inherent
        //    ɔ does not create a false V·C·ɔ·C·V context for the preceding vowel (জীবন→d͡ʒibɔn, শহর→ʃɔɦɔɾ).
        const syls = (x.match(VOWEL_G) || []).length;
        if (syls >= 2) x = deleteFinalInherent(x);
        // 6. MEDIAL inherent-vowel deletion — the Ohala V·C·ɔ·C·V rule (আপনার→apnaɾ, আকবর→akbɔɾ), same shared
        //    algorithm as Hindi's schwa deletion but on /ɔ/; a geminate coda keeps the syllable heavy (no delete).
        if (def.medialSchwaDeletion !== false) x = deleteMedialSchwa(x, "ɔ"); // Assamese retains medial inherent ɔ (চকৰি→sɔkɔɹi)
        return x.normalize("NFC");
    }

    /** SHIPPED word→IPA: a whole-word lexicon override (for the proven-lexical tail) then the rule engine. The
     *  lexicon is Bengali-specific (bengali-lexicon.tsv), so a reusing language (Assamese) sets skipLexicon:true
     *  to avoid Bengali overrides (এক→æk) leaking onto its shared spellings. */
    function word(w: string, oov?: OovResolver): string {
        if (!def.skipLexicon) {
            const hit = lexicon().get(w.normalize("NFC"));
            if (hit !== undefined) return hit;
        }
        if (oov) {
            const o = oov(w);
            if (o !== undefined) return o;
        }
        return wordRules(w);
    }

    const toAscii = (digits: string): string =>
        [...digits]
            .filter((d) => d !== ",")
            .map((d) => BENGALI_DIGITS[d] ?? d)
            .join("");

    function number(digits: string, oov?: OovResolver): string {
        const w = (x: string): string => word(x, oov);
        const ascii = toAscii(digits);
        const dot = ascii.indexOf(".");
        if (dot >= 0 && def.numbers.decimalWord) {
            const intN = Number(ascii.slice(0, dot) || "0");
            if (!Number.isSafeInteger(intN)) return ascii;
            const frac = [...ascii.slice(dot + 1)].map((d) => w(def.numbers.units[Number(d)]!));
            return [renderNumber(intN, def.numbers, w), w(def.numbers.decimalWord), ...frac].join(" ");
        }
        const n = Number(ascii);
        if (!Number.isSafeInteger(n)) return ascii;
        return renderNumber(n, def.numbers, w);
    }

    // `oovOverride` (neural path only) resolves OOV words between the lexicon and the rule engine; the sync path
    // passes nothing → unchanged. Per-CALL so one engine instance is reused across calls (no per-call rebuild).
    function text(input: string, oovOverride?: OovResolver): string {
        // Bengali-specific rewrites (ordinals, clock, unit abbreviations, signs, fractions) BEFORE the
        // shared symbol tier, whose unit keys are Latin.
        return assembleClauses(SYMBOLS(normalize(input)), tokenRe, (m, sink) => {
            if (m[1]) sink.emit(word(m[1], oovOverride));
            else if (m[2]) sink.emit(foreign ? foreign(m[2]) : "");
            else if (m[3]) sink.emit(number(m[3], oovOverride));
            else if (m[4]) {
                const mk = CLAUSE_MARK[m[4]];
                if (mk) sink.pause(mk);
            } else if (m[5]) {
                if (!strip.includes(m[5]) && symbols[m[5]])
                    sink.emit(word(symbols[m[5]]!, oovOverride));
            }
        });
    }

    return { word, wordRules, number, text };
}

/** Load bengali.jsonc (beside this file) and build the Bengali phonemizer. `foreign` handles embedded Latin; the
 *  returned `text` takes an optional per-call `oovOverride` (neural path only) that injects tagger readings for OOV
 *  words (lexicon → oovOverride → rules). */
export function createBengali(foreign?: ForeignPhonemizer): {
    text(input: string, oovOverride?: OovResolver): string;
} {
    return makeNativeBengali(
        loadManifest<BengaliDef>(import.meta.url, "bengali.jsonc"),
        loadSharedPhonology(),
        foreign,
    );
}

/** The whole-word pronunciation lexicon (cross-source consensus + Kolkata gold). Exposed so the neural OOV path
 *  (bengaliNeural.ts) can skip lexicon-covered words — they are served authoritatively by the sync path. */
export function bengaliLexicon(): ReadonlyMap<string, string> {
    return lexicon();
}

/** Bare word→IPA, SHIPPED path (lexicon override → rule engine). For tests and real text. */
export function phonemizeWord(w: string): string {
    return (BN ??= makeNativeBengali(
        loadManifest<BengaliDef>(import.meta.url, "bengali.jsonc"),
    )).word(w);
}
/** Bare word→IPA, RULE-ENGINE ONLY (no lexicon) — the honest, non-circular signal for the referee eval. */
export function phonemizeWordRules(w: string): string {
    return (BN ??= makeNativeBengali(
        loadManifest<BengaliDef>(import.meta.url, "bengali.jsonc"),
    )).wordRules(w);
}
let BN: ReturnType<typeof makeNativeBengali> | undefined;
