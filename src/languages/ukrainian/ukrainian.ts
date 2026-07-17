/**
 * Native Ukrainian / українська (uk) text phonemizer — canonical IPA, espeak-independent. East Slavic, Cyrillic.
 * Ukrainian has NO vowel reduction (akanye), so — unlike Russian — no stress dictionary is needed for vowel
 * quality: a left-to-right scan with fixed vowel values. The work is PALATALISATION (a consonant → Cʲ before ь,
 * і, or an iotated vowel я/ю/є/ї) + the iotated vowels ([j]+V word-initially / after a vowel / after an
 * apostrophe; the bare V after a consonant, which it palatalises) + в-vocalisation (ʋ before a vowel, [w] in the
 * coda) + г→ɦ / ґ→ɡ / dark л→ɫ. Stress is lexical and unmarked here (Ukrainian stress is unpredictable and does
 * not change vowel quality). Validated vs wikipron ukr_cyrl narrow + kaikki + epitran ukr-Cyrl.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { renderNumber, type NumbersDef } from "../../core/numbers.ts";
import { loadManifest } from "../../core/loadManifest.ts";

interface UkrainianDef {
    vowels: Record<string, string>;
    iotated: Record<string, string>;
    consonants: Record<string, string>;
    numbers: NumbersDef & { hundreds: string[] };
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

// Slavic decimal composition: units + teens + tens + hundreds + thousand/million/billion (space-separated).
function slavicNumberWords(n: number, d: NumbersDef & { hundreds: string[] }): (string | null)[] {
    if (n < 10) return [d.units[n]!];
    if (n < 20) return [d.teens![n - 10]!];
    if (n < 100) {
        const t = Math.floor(n / 10) * 10,
            u = n % 10;
        return [d.tens[String(t)]!, ...(u ? [d.units[u]!] : [])];
    }
    if (n < 1000) {
        const h = Math.floor(n / 100),
            r = n % 100;
        return [d.hundreds[h]!, ...(r ? slavicNumberWords(r, d) : [])];
    }
    if (n < 1_000_000) {
        const th = Math.floor(n / 1000),
            r = n % 1000;
        return [...slavicNumberWords(th, d), d.magnitudes.thousand!, ...(r ? slavicNumberWords(r, d) : [])];
    }
    if (n < 1_000_000_000) {
        const m = Math.floor(n / 1_000_000),
            r = n % 1_000_000;
        return [...slavicNumberWords(m, d), d.magnitudes.million!, ...(r ? slavicNumberWords(r, d) : [])];
    }
    const b = Math.floor(n / 1_000_000_000),
        r = n % 1_000_000_000;
    return [...slavicNumberWords(b, d), d.magnitudes.billion!, ...(r ? slavicNumberWords(r, d) : [])];
}

function number(digits: string): string {
    const n = Number(digits);
    if (!Number.isSafeInteger(n)) return digits;
    return renderNumber(n, DEF.numbers, phonemizeWord, (m) => slavicNumberWords(m, DEF.numbers));
}

const CYRILLIC = "\\u0400-\\u04FF";
const TOKEN = new RegExp(`([${CYRILLIC}'’ʼ]+)|(\\d+)|([.?!,;:…—])`, "gu");

export type ForeignPhonemizer = (latin: string) => string;

class UkrainianPhonemizer implements Phonemizer {
    text(input: string): string {
        return assembleClauses(input, TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(m[1]));
            else if (m[2]) sink.emit(number(m[2]));
            else if (m[3]) {
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
