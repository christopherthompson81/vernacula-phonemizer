/**
 * Native Belarusian / беларуская (be) text phonemizer — canonical IPA, espeak-independent. East Slavic, Cyrillic.
 * Belarusian orthography is PHONETIC — akanne (unstressed о→а, е→я) is SPELLED, so ⟨о⟩ is only ever stressed → [o]
 * and no stress dictionary is needed for vowel quality. The work is: PALATALISATION (a consonant → Cʲ before ь, or
 * an iotated vowel я/е/ё/ю/і) + the iotated vowels ([j]+V word-initially / after a vowel / after an apostrophe; the
 * bare V after a consonant, which it palatalises — ⟨і⟩ is iotated here: Іван→jivan); ⟨ў⟩→[u̯] post-vocalic / [w]
 * elsewhere; the ⟨дз дж⟩ affricate digraphs → [d͡z d͡ʐ]; ⟨г⟩→[ɣ]; dark ⟨л⟩→[ɫ]; and — unlike Ukrainian — regressive
 * VOICING assimilation + word-final devoicing (горад→ɣorat, хлеб→xlʲep). Stress is lexical and unmarked (akanne
 * being spelled means stress does not change vowel quality). Validated vs wikipron bel_cyrl narrow.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { renderNumber, type NumbersDef } from "../../core/numbers.ts";
import { loadManifest } from "../../core/loadManifest.ts";

interface BelarusianDef {
    vowels: Record<string, string>;
    iotated: Record<string, string>;
    consonants: Record<string, string>;
    voicing: { toVoiceless: Record<string, string>; toVoiced: Record<string, string> };
    numbers: NumbersDef & { hundreds: string[] };
    clausePunctuation: Record<string, string>;
}
const DEF = loadManifest<BelarusianDef>(import.meta.url, "belarusian.jsonc");
const CLAUSE_MARK = DEF.clausePunctuation;
const TO_VOICELESS = DEF.voicing.toVoiceless;
const TO_VOICED = DEF.voicing.toVoiced;

const SOFT = "ь";
const PALATALIZERS = new Set(["ь", "і", "я", "е", "ё", "ю"]);
const VOWEL_LETTERS = new Set(["а", "о", "у", "ы", "э", "я", "е", "ё", "ю", "і"]);
const isCons = (c: string): boolean => c in DEF.consonants;

/** Palatalise a hard-consonant IPA: dark ɫ → lʲ (loses velarisation), everything else appends ʲ. */
const palatalise = (ipa: string): string => (ipa === "ɫ" ? "lʲ" : ipa + "ʲ");

/** Regressive voicing assimilation + word-final devoicing over the phoneme list (right-to-left). ⟨в⟩=v does not
 *  TRIGGER voicing on a preceding obstruent (Slavic), but is itself a target (final/pre-voiceless в→f). */
function applyVoicing(out: string[]): void {
    const split = (p: string): [string, string] => (p.endsWith("ʲ") ? [p.slice(0, -1), "ʲ"] : [p, ""]);
    for (let i = out.length - 1; i >= 0; i--) {
        const [base, soft] = split(out[i]!);
        if (!(base in TO_VOICELESS || base in TO_VOICED)) continue; // not an obstruent
        const nx = out[i + 1];
        let target: "voiced" | "voiceless" | null = null;
        if (nx === undefined) target = "voiceless"; // word-final devoicing
        else {
            const [nbase] = split(nx);
            if ((nbase in TO_VOICELESS || nbase in TO_VOICED) && nbase !== "v") {
                target = nbase in TO_VOICELESS ? "voiced" : "voiceless";
            } // before a sonorant / vowel / в: keep base voicing
        }
        if (target === "voiceless" && base in TO_VOICELESS) out[i] = TO_VOICELESS[base]! + soft;
        else if (target === "voiced" && base in TO_VOICED) out[i] = TO_VOICED[base]! + soft;
    }
}

/** One Belarusian word → canonical IPA. */
export function phonemizeWord(word: string): string {
    const chars = [...word.toLowerCase()];
    const out: string[] = [];
    for (let i = 0; i < chars.length; ) {
        const c = chars[i]!;
        const nxt = chars[i + 1] ?? "";
        // ⟨дз⟩→d͡z, ⟨дж⟩→d͡ʐ affricate digraphs (palatalise before ь/і/iotated: дзень→d͡zʲenʲ)
        if (c === "д" && (nxt === "з" || nxt === "ж")) {
            const after = chars[i + 2] ?? "";
            let aff = nxt === "з" ? "d͡z" : "d͡ʐ";
            if (PALATALIZERS.has(after) && nxt === "з") aff = palatalise(aff); // only дз softens (дж is always hard)
            out.push(aff);
            i += 2;
            if (after === SOFT) i++; // consume the soft sign
            continue;
        }
        // ⟨ў⟩ → [u̯] after a vowel (воўк→vou̯k), else [w] (ўзяць→wzʲatsʲ)
        if (c === "ў") {
            out.push(VOWEL_LETTERS.has(chars[i - 1] ?? "") ? "u̯" : "w");
            i++;
            continue;
        }
        if (isCons(c)) {
            let ipa = DEF.consonants[c]!;
            if (PALATALIZERS.has(nxt)) ipa = palatalise(ipa); // palatalise before ь / і / an iotated vowel
            out.push(ipa);
            i++;
            if (nxt === SOFT) i++; // consume the soft sign (palatalisation already applied)
            continue;
        }
        if (c in DEF.iotated) {
            const v = DEF.iotated[c]!;
            const prev = chars[i - 1] ?? "";
            // bare vowel ONLY when directly after a PALATALISABLE consonant (which it palatalised); otherwise
            // (word-initial / after a vowel / apostrophe / ў / й) → [j]+V. й is a glide, not a palataliser.
            if (!isCons(prev) || prev === "й") out.push("j", v);
            else out.push(v);
            i++;
            continue;
        }
        if (c in DEF.vowels) {
            out.push(DEF.vowels[c]!);
            i++;
            continue;
        }
        if (c === SOFT) {
            const last = out[out.length - 1];
            if (last && !last.endsWith("ʲ")) out[out.length - 1] = palatalise(last);
            i++;
            continue;
        }
        i++; // apostrophe (breaks C+iotated adjacency → [j]V) and unknowns → skip
    }
    applyVoicing(out);
    let x = out.join("");
    // REGRESSIVE PALATALISATION: a SIBILANT/affricate ⟨с з ц дз⟩ (+ dark л) directly before a palatalised CORONAL or
    // LABIAL assimilates and softens (везці→vʲesʲt͡sʲi, Боснія→bosʲnʲija, Зміцер→zʲmʲit͡sʲer, Мацвей→mat͡sʲvʲej). The
    // referee is inconsistent for the stops/nasal as TARGETS (Пенсільванія→pʲensʲilʲvanʲija keeps hard н; Гародня→
    // ɣarodnʲa keeps hard д), so ⟨т д н⟩ are excluded as targets; and a palatalised VELAR does not trigger it (the
    // -скі ending keeps hard с: Заборскі→zaborskʲi).
    const PALC = "(?:t͡s|d͡z|[tdsznbpvfm])ʲ";
    x = x.replace(new RegExp(`ɫ(?=${PALC}|lʲ)`, "gu"), "lʲ"); // dark l softens before a palatalised coronal/labial or a soft l (Наталля→natalʲːa)
    x = x.replace(new RegExp(`(t͡s|d͡z|[sz])(?=${PALC})`, "gu"), "$1ʲ");
    // ⟨н⟩ softens before a palatalised AFFRICATE (the -нцін/-нць cluster: Аргенціна→arɣʲenʲt͡sʲina) — reliable, unlike
    // н before a plain palatalised sibilant (Пенсільванія keeps hard н).
    x = x.replace(/n(?=(?:t͡s|d͡z)ʲ)/gu, "nʲ");
    // Affricate gemination (цц→t͡sʲː, чч→t͡ʂː) then plain doubled consonant → geminate Cː (CʲCʲ→Cʲː, CCʲ→Cʲː, CC→Cː).
    x = x.replace(/(t͡ʂ|t͡s|d͡ʐ|d͡z)(ʲ?)\1\2/gu, "$1$2ː");
    x = x.replace(/([bvɣɡdʐznɫlmnprstfxʂ])ʲ\1ʲ/gu, "$1ʲː")
        .replace(/([bvɣɡdʐznɫlmnprstfxʂ])\1ʲ/gu, "$1ʲː")
        .replace(/([bvɣɡdʐznɫlmprstfxʂ])\1(?!ʲ)/gu, "$1ː");
    return x.normalize("NFC");
}

// Slavic decimal composition: units + teens + tens + hundreds + thousand/million/billion (space-separated).
function slavicNumberWords(n: number, d: NumbersDef & { hundreds: string[] }): (string | null)[] {
    if (n < 10) return [d.units[n]!];
    if (n < 20) return [d.teens![n - 10]!];
    if (n < 100) {
        const t = Math.floor(n / 10) * 10;
        const u = n % 10;
        return [d.tens[String(t)]!, ...(u ? [d.units[u]!] : [])];
    }
    if (n < 1000) {
        const h = Math.floor(n / 100);
        const r = n % 100;
        return [d.hundreds[h]!, ...(r ? slavicNumberWords(r, d) : [])];
    }
    if (n < 1_000_000) {
        const th = Math.floor(n / 1000);
        const r = n % 1000;
        return [...slavicNumberWords(th, d), d.magnitudes.thousand!, ...(r ? slavicNumberWords(r, d) : [])];
    }
    if (n < 1_000_000_000) {
        const m = Math.floor(n / 1_000_000);
        const r = n % 1_000_000;
        return [...slavicNumberWords(m, d), d.magnitudes.million!, ...(r ? slavicNumberWords(r, d) : [])];
    }
    const b = Math.floor(n / 1_000_000_000);
    const r = n % 1_000_000_000;
    return [...slavicNumberWords(b, d), d.magnitudes.billion!, ...(r ? slavicNumberWords(r, d) : [])];
}

function number(digits: string): string {
    const n = Number(digits);
    if (!Number.isSafeInteger(n)) return digits;
    return renderNumber(n, DEF.numbers, phonemizeWord, (m) => slavicNumberWords(m, DEF.numbers));
}

const CYRILLIC = "\\u0400-\\u04FF";
const TOKEN = new RegExp(`([${CYRILLIC}'’ʼ]+)|(\\d+)|([.?!,;:…—])`, "gu");

class BelarusianPhonemizer implements Phonemizer {
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

/** Build the Belarusian phonemizer. */
export function createBelarusian(): Phonemizer {
    return new BelarusianPhonemizer();
}
