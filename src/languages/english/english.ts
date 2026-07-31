/**
 * Native English text phonemizer — canonical IPA, espeak-independent. English is irregular, so pronunciation
 * comes from a CMUdict-derived lexicon + a cleanroom n-gram OOV G2P + a POS perceptron for heteronyms
 * (no rules, no espeak). Resolution order per word: heteronym (POS-gated, incl. -s plural) → flat lexicon →
 * possessive 's → OOV G2P. Numbers become words (numberToWords) resolved through the same path. There is NO
 * fallback — an OOV word is G2P'd natively, never handed to espeak.
 *
 * NOTE: this stage emits per-word CITATION stress + clause-pause marks. Sentence-level de-accenting (the
 * `look over there` → ˌoᶷvɚ demotion) is a following pass (intonation.ts).
 */
import { readForeignRun } from "../../core/foreign.ts";
import { FOREIGN_RUN } from "../../core/clauses.ts";
import { MANIFEST, type HeteronymEntry } from "./manifest.ts";
import { loadJson } from "../../core/loadManifest.ts";
import { loadTsvMap, loadLines } from "../../core/loadTsv.ts";

import {
    createEnglishG2p,
    type EnglishG2p,
    type EnglishG2pModel,
} from "./englishG2p.ts";
import { makeArpabetToIpa } from "./englishArpabet.ts";
import {
    PosTagger,
    posExpectation,
    headsObjectPhrase,
    type PosExpectation,
    type PosModel,
} from "./posTagger.ts";
import { numberToWords, ordinalToWords } from "./numbers.ts";
import { foldLatinDiacritics } from "../../core/unicode.ts";
import { normalizeEnglish, normalizeEnglishInitialisms } from "./normalize.ts";

/** English regular plural/3sg/genitive sibilant allomorph appended to a base IPA: sibilant→ɪz, voiceless→s,
 *  else voiced/vowel→z. Skips trailing diacritics/length/stress/offglide to read the final base phone. */
function sibilantAllomorph(ipa: string): string {
    const chars = [...ipa.normalize("NFC")];
    let i = chars.length - 1;
    while (i >= 0 && /[̀-ͯːˈˌ‿ᶦᶷʰʲ]/u.test(chars[i]!)) i--;
    const last = chars[i] ?? "";
    if ("szʃʒ".includes(last)) return "ɪz";
    if ("ptkfθ".includes(last)) return "s";
    return "z";
}

/** A voicing-pair heteronym (default & marked differ only in the final consonant: use/close/house). Their
 *  -s inflection voicing is lexical/irregular, so those defer their plurals to the flat lexicon. */
function isVoicingHeteronym(het: HeteronymEntry): boolean {
    const marked = het.verb ?? het.noun ?? het.past;
    if (marked === undefined) return false;
    const strip = (s: string): string =>
        s.normalize("NFD").replace(/[̀-ͯ]/gu, "").replace(/[ˈˌː]/g, "");
    const a = strip(het.default),
        b = strip(marked);
    return (
        a.length === b.length &&
        a.length > 0 &&
        a.slice(0, -1) === b.slice(0, -1) &&
        a.slice(-1) !== b.slice(-1)
    );
}

/** Insert primary stress before the first vowel — the nuclear-tonic fallback for an all-unstressed clause. */
function promoteFirstVowel(ipa: string): string {
    const m = /[aeiouɪʊɛɔəɐæɑɒʌɝɚɜɨʉ]/u.exec(ipa);
    return m === null ? ipa : ipa.slice(0, m.index) + "ˈ" + ipa.slice(m.index);
}

type Token =
    | { kind: "word"; text: string }
    | { kind: "number"; text: string; ordinal: boolean }
    | { kind: "clause"; text: string }
    // A run in a script this engine does not own, ALREADY resolved to IPA by whichever engine owns that
    // script (core/scripts.ts). It carries phonemes rather than text because it must bypass the tagger
    // and the resolver entirely — there is no English pronunciation of Владимир to look up.
    | { kind: "foreign"; ipa: string };

// number (grouped + decimal) with optional ordinal suffix · word (letters + internal/trailing apostrophes) · clause punct
// The word class is LATIN-SCRIPT, not [A-Za-z]: an ASCII-only class split accented loanwords at the
// accent, so "naïve" tokenized as "na"+"ve" -> [nˈɑː vˈiː] and "résumé" as "r"+"sum" -> [ˈɑːɹ sˈʌm].
// resolveWord folds the diacritics away for lookup (foldLatinDiacritics). Non-Latin scripts stay
// unmatched, as before — English is not the engine for them.
// ⚠ A WORD MUST START WITH A LATIN LETTER. The class was `[\p{Script=Latin}\p{M}]+`, which also matched a
// COMBINING MARK on its own — so the vowel signs of an embedded abugida were claimed as English "words"
// and the run was shattered around them: `తెలుగు` reached the Telugu engine as three bare consonants and
// read "ta la ga" instead of "telugu". Marks may follow a Latin letter; they may not begin a token.
const TOKEN_RE =
    /(\d[\d,]*(?:\.\d+)?)(st|nd|rd|th)?|(\p{Script=Latin}[\p{Script=Latin}\p{M}]*(?:['’]\p{Script=Latin}[\p{Script=Latin}\p{M}]*)*['’]?)|([.?!,;:])/gu;

export class EnglishPhonemizer {
    constructor(
        private readonly lexicon: Map<string, string>,
        private readonly heteronyms: Map<string, HeteronymEntry>,
        private readonly g2p: EnglishG2p,
        private readonly tagger: PosTagger,
        private readonly unstressed: ReadonlySet<string>,
        // Closed word-lists from english.jsonc: clause punctuation → pause, clause-final de-accented pronouns,
        // and wh-pronouns that demote to secondary stress.
        private readonly clausePunctuation: Record<string, string>,
        private readonly nonTonicFinal: ReadonlySet<string>,
        private readonly whSecondary: ReadonlySet<string>,
    ) {}

    /** Dict-only lookup for creoles (e.g. Naija) that NATIVISE English-etymological words: the CMUdict-derived
     *  citation IPA if `word` is known English, else undefined (an OOV word — likely a substrate loan — for the
     *  caller to handle differently). No OOV G2P and no clause/stress processing — the raw pronunciation to remap. */
    knownWord(word: string): string | undefined {
        const lower = word.toLowerCase();
        return this.lexicon.get(lower) ?? this.heteronyms.get(lower)?.default;
    }

    /** One orthographic word → canonical IPA, given its POS expectation. `oovOverride` (async neural path only,
     *  enNeural.ts) resolves a genuinely-OOV g2pKey to the BiLSTM tagger's reading BEFORE the sync n-gram engine —
     *  the sync path passes nothing, so behaviour is byte-identical. */
    private resolveWord(word: string, e: PosExpectation | undefined, oovOverride?: (g2pKey: string) => string | undefined): string {
        // Fold Latin diacritics before any lookup: the lexicon and the n-gram G2P are ASCII-keyed
        // (CMUdict has `cafe`/`naive`/`jalapeno`, never the accented spellings), and the curly
        // apostrophe is normalised so "don’t" resolves like "don't".
        const lower = foldLatinDiacritics(word.toLowerCase()).replace(/’/gu, "'");

        // Heteronym (direct or a regular -s/-es plural of a stress-shift heteronym).
        let het = this.heteronyms.get(lower);
        let pluralAllomorph = false;
        if (het === undefined) {
            const base =
                lower.endsWith("es") && this.heteronyms.has(lower.slice(0, -2))
                    ? lower.slice(0, -2)
                    : lower.endsWith("s") &&
                        lower.length > 1 &&
                        this.heteronyms.has(lower.slice(0, -1))
                      ? lower.slice(0, -1)
                      : undefined;
            const cand =
                base !== undefined ? this.heteronyms.get(base) : undefined;
            if (cand !== undefined && !isVoicingHeteronym(cand)) {
                het = cand;
                pluralAllomorph = true;
            }
        }
        if (het !== undefined) {
            let ipa =
                (e?.past && het.past) ||
                (e?.verb && het.verb) ||
                (e?.noun && het.noun) ||
                het.default;
            if (pluralAllomorph) ipa += sibilantAllomorph(ipa);
            return ipa;
        }

        // Possessive / genitive clitic: X's → base + allomorph; Xs' → base.
        let lookupKey = lower;
        let possAllomorph = false;
        if (lower.endsWith("'s") && lower.length > 2) {
            lookupKey = lower.slice(0, -2);
            possAllomorph = true;
        } else if (
            lower.endsWith("'") &&
            lower.length > 2 &&
            lower[lower.length - 2] === "s"
        )
            lookupKey = lower.slice(0, -1);

        let over = this.lexicon.get(lookupKey);
        if (over === undefined) {
            // OOV → the neural tagger (async path) if it has a reading, else native n-gram G2P (strip any apostrophes
            // so contractions/loanwords G2P their letters). No espeak fallback.
            const g2pKey = lookupKey.replace(/'/g, "");
            over =
                oovOverride?.(g2pKey) ??
                (/^[a-z]+$/.test(g2pKey) ? this.g2p.g2p(g2pKey) : g2pKey);
        }
        if (possAllomorph) over += sibilantAllomorph(over);
        return over;
    }

    /** POS expectations for a sentence's words (perceptron tags → verb/noun/past, + imperative recovery). */
    private posExpectations(words: string[]): (PosExpectation | undefined)[] {
        const tags = this.tagger.tag(words);
        const out = tags.map((t) => posExpectation(t));
        if (
            out.length > 1 &&
            !out[0]!.verb &&
            headsObjectPhrase(tags[1] ?? "")
        ) {
            out[0] = { verb: true, noun: false, past: false }; // sentence-initial imperative ("Wind the clock")
        }
        return out;
    }

    /** `wordTransform`, if given, post-processes each resolved word's IPA with its (lowercased) source word —
     *  the hook the en-GB accent variant uses to apply its per-word lexical-set delta while reusing this engine's
     *  full number/heteronym/prosody context. Clause pause marks are not passed through it. */
    text(
        input: string,
        wordTransform?: (ipa: string, word: string) => string,
        oovOverride?: (g2pKey: string) => string | undefined,
    ): string {
        // #562 text normalization: %, $, units, dates, times, years, romans. INITIALISMS run after, so
        // the Roman-numeral rules get first refusal on all-caps letter runs (II occurs 8× in the cased
        // corpus column; run earlier this would spell "Louis XIV" as EX-EYE-VEE).
        input = normalizeEnglishInitialisms(normalizeEnglish(input), (w) => this.lexicon.has(w));
        const tokens: Token[] = [];
        let m: RegExpExecArray | null;
        // GAPS between tokens carry embedded foreign text. English's tokenizer matches Latin script only,
        // so before this a Greek or Cyrillic run was dropped outright: "The word λόγος means word" read as
        // "the word means word". English cannot use `assembleClauses` — that is a streaming sink and this
        // is a two-phase pipeline (tokens → POS tagger → resolver) — but the GAP PASS is separable from
        // the clause model, which is the same split burmese.ts makes with its own exec loop.
        let gapCursor = 0;
        const claimGap = (upto: number): void => {
            if (upto > gapCursor) {
                const gap = input.slice(gapCursor, upto);
                for (const g of gap.matchAll(FOREIGN_RUN)) {
                    const ipa = readForeignRun(g[0]);
                    if (ipa !== undefined && ipa !== "") tokens.push({ kind: "foreign", ipa });
                }
            }
            gapCursor = upto;
        };
        while ((m = TOKEN_RE.exec(input)) !== null) {
            claimGap(m.index);
            gapCursor = m.index + m[0].length;
            if (m[1] !== undefined)
                tokens.push({
                    kind: "number",
                    text: m[1],
                    ordinal: m[2] !== undefined,
                });
            else if (m[3] !== undefined)
                tokens.push({ kind: "word", text: m[3] });
            else if (m[4] !== undefined)
                tokens.push({ kind: "clause", text: m[4] });
        }
        claimGap(input.length);

        // Expand numbers to words up-front so the POS tagger + resolver see a flat word stream. A word may be
        // flagged `reduced` at expansion time — the decimal separator "point" is a prosodically-weak connector,
        // not a stressed content noun, so it is de-accented like a function word.
        interface NumWord {
            text: string;
            reduced?: boolean;
        }
        interface Unit {
            words: NumWord[];
            clause?: string;
            /** Already-resolved IPA (a foreign run); contributes NO words, so tagger alignment is
             *  unaffected and `expect[wi]` keeps indexing the English stream correctly. */
            foreign?: string;
        }
        const units: Unit[] = [];
        for (const t of tokens) {
            if (t.kind === "clause") {
                const mk = this.clausePunctuation[t.text];
                if (mk) units.push({ words: [], clause: mk });
            } else if (t.kind === "foreign") units.push({ words: [], foreign: t.ipa });
            else if (t.kind === "word")
                units.push({ words: [{ text: t.text }] });
            else {
                const n = BigInt(t.text.replace(/[,.]/g, "")); // integer part; fractional read separately below
                const dot = t.text.indexOf(".");
                if (dot >= 0) {
                    const intWords = numberToWords(
                        BigInt(t.text.slice(0, dot).replace(/,/g, "") || "0"),
                    ).map((w) => ({ text: w }));
                    const frac = [...t.text.slice(dot + 1)].map((d) => ({
                        text: numberToWords(BigInt(d))[0]!,
                    }));
                    units.push({
                        words: [
                            ...intWords,
                            { text: "point", reduced: true },
                            ...frac,
                        ],
                    });
                } else {
                    units.push({
                        words: (t.ordinal
                            ? ordinalToWords(n)
                            : numberToWords(n)
                        ).map((w) => ({ text: w })),
                    });
                }
            }
        }

        // Tag word-by-word across the whole utterance (START/END padded), resolve each to CITATION IPA, then
        // de-accent: unstressed function words lose their primary; a clause left with no primary promotes its
        // last word back to the nuclear tonic. Clause boundaries are the pause marks.
        const allWords = units.flatMap((u) => u.words.map((w) => w.text));
        const expect = this.posExpectations(allWords);
        let wi = 0;
        interface Item {
            word: string;
            citation: string;
            reduced: boolean;
            display: string;
        }
        const clauses: { items: Item[]; mark: string | null }[] = [
            { items: [], mark: null },
        ];
        for (const u of units) {
            if (u.clause !== undefined) {
                const cur = clauses[clauses.length - 1]!;
                if (cur.items.length > 0) {
                    cur.mark = u.clause;
                    clauses.push({ items: [], mark: null });
                }
                continue;
            }
            if (u.foreign !== undefined) {
                clauses[clauses.length - 1]!.items.push({
                    word: "", citation: u.foreign, reduced: false, display: u.foreign,
                });
                continue;
            }
            for (const w of u.words) {
                const citation = this.resolveWord(w.text, expect[wi], oovOverride);
                wi++;
                if (citation === "") continue;
                const lw = w.text.toLowerCase();
                clauses[clauses.length - 1]!.items.push({
                    word: lw,
                    citation,
                    reduced: (w.reduced ?? false) || this.unstressed.has(lw),
                    display: citation,
                });
            }
        }

        const parts: string[] = [];
        for (const c of clauses) {
            for (const it of c.items) {
                if (this.whSecondary.has(it.word))
                    it.display = it.citation.replace(/ˈ/g, "ˌ"); // wh-pronoun → secondary
                else if (it.reduced) it.display = it.citation.replace(/ˈ/g, ""); // unstressed function word / decimal point
            }
            if (c.items.length > 0) {
                // Nuclear tonic: the clause-FINAL word takes primary in a TERMINAL clause (. ? ! / utterance end) —
                // EXCEPT a de-accentable personal pronoun ("please use it" → jˈuːz ɪt, not …ˈɪt). A clause with NO
                // primary at all always promotes its last word (tonic guarantee), pronoun or not.
                const terminal =
                    c.mark === null ||
                    c.mark === "." ||
                    c.mark === "?" ||
                    c.mark === "!";
                const hasPrimary = c.items.some((it) =>
                    it.display.includes("ˈ"),
                );
                const last = c.items[c.items.length - 1]!;
                const promote =
                    !hasPrimary ||
                    (terminal &&
                        !last.display.includes("ˈ") &&
                        !this.nonTonicFinal.has(last.word));
                if (promote)
                    last.display = last.citation.includes("ˈ")
                        ? last.citation
                        : promoteFirstVowel(last.citation);
            }
            for (const it of c.items)
                parts.push(wordTransform ? wordTransform(it.display, it.word) : it.display);
            if (c.mark !== null) parts.push(c.mark);
        }
        return parts.join(" ");
    }
}

/** Load the English data (beside this file) and build the phonemizer. */
export function createEnglish(): EnglishPhonemizer {
    // accent-lexicon.tsv is 3-column word<TAB>?<TAB>ipa. `parse` receives the post-first-tab REMAINDER
    // ("?<TAB>ipa"), so the ipa is remainder field [1] (= file column 3). Keep it when non-empty.
    const lexicon = loadTsvMap(import.meta.url, "accent-lexicon.tsv", (rest) => {
        const fields = rest.split("\t");
        const ipa = fields[1]?.trim();
        return fields.length >= 2 && ipa ? ipa : undefined;
    });

    const manifest = MANIFEST; // consolidated hand-authored facts (english.jsonc), loaded once by manifest.ts
    const heteronyms = new Map(Object.entries(manifest.heteronyms));
    const unstressed = new Set(manifest.unstressedWords);
    const arpabetToIpa = makeArpabetToIpa(manifest.arpabet);

    const g2pDict = loadTsvMap(import.meta.url, "g2p-dict.tsv", (v) =>
        v.split(" "),
    );
    const g2pCommon = new Set(loadLines(import.meta.url, "g2p-common.txt"));
    const g2p = createEnglishG2p(
        loadJson<EnglishG2pModel>(import.meta.url, "g2p-model.json"),
        g2pDict,
        g2pCommon,
        arpabetToIpa,
        { ...manifest.g2pClasses, vowels: manifest.arpabet.vowels }, // OOV G2P reuses arpabet.vowels (single source)
    );

    const tagger = new PosTagger(
        loadJson<PosModel>(import.meta.url, "pos-model.json"),
    );

    return new EnglishPhonemizer(
        lexicon,
        heteronyms,
        g2p,
        tagger,
        unstressed,
        manifest.clausePunctuation,
        new Set(manifest.nonTonicFinal),
        new Set(manifest.whSecondary),
    );
}
