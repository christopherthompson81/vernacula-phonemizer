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
import { assembleClauses } from "../../core/clauses.ts";

export interface BengaliDef extends AbugidaDef {
    numbers: NumbersDef;
    clausePunctuation: Record<string, string>;
    symbols?: Record<string, string>;
    stripSymbols?: string;
}

/** Foreign-run phonemizer (embedded Latin → e.g. en), injected by the registry. */
export type ForeignPhonemizer = (latin: string) => string;

const VOWEL_G = new RegExp(`[${IPA_VOWELS}]`, "g");
const DIGIT_CLASS = "0-9" + Object.keys(BENGALI_DIGITS).join("");

// A geminate consonant (doubled base, possibly aspirated) → single + length ː. Same fleet convention as hi/si.
const GEMINATE =
    /(t͡ʃʰ|d͡ʒʱ|t͡ʃ|d͡ʒ|t̪ʰ|d̪ʱ|ɡʱ|kʰ|t̪|d̪|[kɡpbmnlʃɾɽŋjɦ])\1(?!͡)/gu;
// A vowel nucleus (for the harmony look-ahead and syllable count). Bengali vowels + diphthong heads.
const HIGH_MID = /[iueo]/; // vowels that trigger ɔ→o raising in the preceding syllable

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
     *  (exactly one consonant between it and the next vowel) and that vowel is high/mid [i u o] — kɔ.ri→ko.ri,
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
            // /ɔ/ raises to [o] before a high/mid vowel (kɔ.ri→ko.ri); /e/ lowers to [æ] before low [a]
            // (de.kʰa→dæ.kʰa) — the mid vowel agrees in height with the following nucleus.
            const to =
                cur === "ɔ" && HIGH_MID.test(nextV)
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

    function word(w: string): string {
        // 1. orthographic normalization (before the generic engine sees it).
        const norm = w
            .normalize("NFC")
            .replace(/ং/gu, "ঙ্") // velar-nasal sign → full [ŋ]
            .replace(/ৎ/gu, "ত্") // khanda ta → vowelless dental [t̪]
            // WORD-INITIAL ্যা → [æ] (ক্যা→kæ, গ্যাস→ɡæʃ, ন্যায়→næj) and অ্যা → [æ] (অ্যাসিড→æʃiɖ).
            // Only word-initial: MEDIAL ্যা geminates instead (বিদ্যা→bid̪d̪a) via the phôla rule below.
            .replace(/^অ্যা/u, AE)
            .replace(/^(\S)্যা/u, "$1" + AE)
            .replace(/ক্ষ/gu, "ক্খ") // ক্ষ conjunct → [kkʰ] (অক্ষর→ɔkkʰɔr), not [kʃ]
            .replace(/জ্ঞ/gu, "গ্গ") // জ্ঞ conjunct → [ɡɡ] ('gyô': জ্ঞান→ɡɡæn), not [d͡ʒn]
            // Phôla gemination — য/ব/ম as the 2nd member of a conjunct GEMINATE the preceding consonant
            // medially (jôphôla বিদ্যা→bid̪d̪a, অকাট্য→ɔkaʈːo; bôphôla মহত্ব→mɔhɔt̪t̪o; môphôla পদ্ম→pɔd̪d̪o), and
            // word-INITIALLY just drop (the phôla member is silent: ব্যথা→bæt̪ʰa, দ্বিতীয়→d̪it̪io).
            .replace(/([ক-হড়-য়])্[যবম]/gu, (_m, c: string, off: number) =>
                off === 0 ? c : c + "্" + c,
            );
        // 2. akshara → IPA (inherent ɔ intact).
        let x = g2p(norm);
        // 3. geminate → length + aspiration-before-length reorder (युद्ध-type conjuncts).
        x = x.replace(GEMINATE, "$1ː").replace(/ː([ʰʱ])/gu, "$1ː");
        // 4. HEIGHT HARMONY (ɔ→o, e→æ) — BEFORE deletion, so it keys on the ORIGINAL inherent /ɔ/. An inherent
        //    ɔ is not itself a high/mid trigger, so a later-retained final [o] can't spuriously raise the vowel
        //    before it (পদ্ম→pɔd̪ːo, not pod̪ːo); the real matra vowels still trigger (করি→koɾi, দেখা→d̪ækʰa).
        x = harmony(x);
        // 5. WORD-FINAL inherent-vowel deletion / retention — BEFORE medial (like Hindi) so a final inherent
        //    ɔ does not create a false V·C·ɔ·C·V context for the preceding vowel (জীবন→d͡ʒibɔn, শহর→ʃɔɦɔɾ).
        const syls = (x.match(VOWEL_G) || []).length;
        if (syls >= 2) x = deleteFinalInherent(x);
        // 6. MEDIAL inherent-vowel deletion — the Ohala V·C·ɔ·C·V rule (আপনার→apnaɾ, আকবর→akbɔɾ), same shared
        //    algorithm as Hindi's schwa deletion but on /ɔ/; a geminate coda keeps the syllable heavy (no delete).
        x = deleteMedialSchwa(x, "ɔ");
        return x.normalize("NFC");
    }

    const toAscii = (digits: string): string =>
        [...digits]
            .filter((d) => d !== ",")
            .map((d) => BENGALI_DIGITS[d] ?? d)
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

    function text(input: string): string {
        return assembleClauses(input, tokenRe, (m, sink) => {
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

    return { word, number, text };
}

/** Load bengali.jsonc (beside this file) and build the Bengali phonemizer. `foreign` handles embedded Latin. */
export function createBengali(foreign?: ForeignPhonemizer): {
    text(input: string): string;
} {
    return makeNativeBengali(
        loadManifest<BengaliDef>(import.meta.url, "bengali.jsonc"),
        loadSharedPhonology(),
        foreign,
    );
}

/** Bare word→IPA (for tests / the referee eval). */
export function phonemizeWord(w: string): string {
    return (BN ??= makeNativeBengali(
        loadManifest<BengaliDef>(import.meta.url, "bengali.jsonc"),
    )).word(w);
}
let BN: ReturnType<typeof makeNativeBengali> | undefined;
