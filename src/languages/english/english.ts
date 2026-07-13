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
    | { kind: "clause"; text: string };

// number (grouped + decimal) with optional ordinal suffix · word (letters + internal/trailing apostrophes) · clause punct
const TOKEN_RE =
    /(\d[\d,]*(?:\.\d+)?)(st|nd|rd|th)?|([A-Za-z]+(?:'[A-Za-z]+)*'?)|([.?!,;:])/g;

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

    /** One orthographic word → canonical IPA, given its POS expectation. */
    private resolveWord(word: string, e: PosExpectation | undefined): string {
        const lower = word.toLowerCase();

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
            // OOV → native G2P (strip any apostrophes so contractions/loanwords G2P their letters). No espeak fallback.
            const g2pKey = lookupKey.replace(/'/g, "");
            over = /^[a-z]+$/.test(g2pKey) ? this.g2p.g2p(g2pKey) : g2pKey;
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

    text(input: string): string {
        const tokens: Token[] = [];
        let m: RegExpExecArray | null;
        while ((m = TOKEN_RE.exec(input)) !== null) {
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
        }
        const units: Unit[] = [];
        for (const t of tokens) {
            if (t.kind === "clause") {
                const mk = this.clausePunctuation[t.text];
                if (mk) units.push({ words: [], clause: mk });
            } else if (t.kind === "word")
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
            for (const w of u.words) {
                const citation = this.resolveWord(w.text, expect[wi]);
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
            for (const it of c.items) parts.push(it.display);
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
