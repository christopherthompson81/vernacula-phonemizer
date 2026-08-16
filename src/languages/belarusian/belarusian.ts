/**
 * Native Belarusian / беларуская (be) text phonemizer — canonical IPA. East Slavic, Cyrillic.
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
import { renderNumber, spellDigits } from "../../core/numbers.ts";
// The East-Slavic AGREEING compositor lives in the Ukrainian module and is parameterised by the number-word
// table (the croatian←serbian pattern): uk and be share the grammar and differ only in their words.
import { eastSlavicNumberWords, type EastSlavicNumbers } from "../ukrainian/numbers.ts";
import { loadManifest } from "../../core/loadManifest.ts";
import { makeSymbolNormalizer, slavicCountForm } from "../../core/normalizeSymbols.ts";
import { normalizeBelarusian, normalizeBelarusianInitialisms } from "./normalize.ts";

interface BelarusianDef {
    vowels: Record<string, string>;
    iotated: Record<string, string>;
    palatalizers: readonly string[];
    vowelLetters: readonly string[];
    consonants: Record<string, string>;
    voicing: { toVoiceless: Record<string, string>; toVoiced: Record<string, string> };
    numbers: EastSlavicNumbers & { decimalConnector: string }; // + the magnitude count forms, feminine 1/2, and the decimal-comma name
    clausePunctuation: Record<string, string>;
}
const DEF = loadManifest<BelarusianDef>(import.meta.url, "belarusian.jsonc");
const CLAUSE_MARK = DEF.clausePunctuation;
const TO_VOICELESS = DEF.voicing.toVoiceless;
const TO_VOICED = DEF.voicing.toVoiced;

const SOFT = "ь";
const PALATALIZERS = new Set(DEF.palatalizers);
const VOWEL_LETTERS = new Set(DEF.vowelLetters);
const isCons = (c: string): boolean => c in DEF.consonants;

/** Palatalise a hard-consonant IPA: dark ɫ → lʲ (loses velarisation), everything else appends ʲ. */
const palatalise = (ipa: string): string => (ipa === "ɫ" ? "lʲ" : ipa + "ʲ");

// Regressive-palatalisation triggers (a palatalised coronal or labial or soft l — NOT a velar) + compiled regexes,
// hoisted to module scope (compiled once, not per word).
const PALC = "(?:t͡s|d͡z|[tdsznbpvfml])ʲ";
const RE_DARKL_SOFT = new RegExp(`ɫ(?=${PALC}|lʲ)`, "gu"); // dark l softens before a palatalised coronal/labial or soft l
const RE_SIB_SOFT = new RegExp(`(t͡s|d͡z|[sz])(?=${PALC})`, "gu"); // с з ц дз soften before a palatalised coronal/labial

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
    // LABIAL (or soft л) assimilates and softens (везці→vʲesʲt͡sʲi, Боснія→bosʲnʲija, Зміцер→zʲmʲit͡sʲer, абразлівы→
    // abrazʲlʲivɨ, Наталля→natalʲːa). The referee is inconsistent for the stops/nasal as TARGETS (Пенсільванія→
    // pʲensʲilʲvanʲija keeps hard н; Гародня→ɣarodnʲa keeps hard д), so ⟨т д н⟩ are excluded as targets; and a
    // palatalised VELAR does not trigger it (the -скі ending keeps hard с: Заборскі→zaborskʲi).
    x = x.replace(RE_DARKL_SOFT, "lʲ");
    x = x.replace(RE_SIB_SOFT, "$1ʲ");
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

function number(digits: string): string {
    const n = Number(digits);
    // ⚠ ABOVE 2^53 THE RAW ASCII DIGITS USED TO LEAK STRAIGHT INTO THE IPA. `isSafeInteger` is right to
    // refuse to COMPOSE — the float has already lost the low digits, so the numeral would be confidently
    // wrong — but the refusal returned the digit string, which no g2p in this fleet reads. Read it out
    // digit-at-a-time through this engine's own number words instead; see core/numbers.ts `spellDigits`
    // for the full account and the cost (above 2^53 the reading is a digit string, not a quantity).
    if (!Number.isSafeInteger(n)) return spellDigits(digits, DEF.numbers, phonemizeWord);
    // East-Slavic composer: the magnitude nouns AGREE with their multiplier (дзве тысячы, пяць тысяч)
    return renderNumber(n, DEF.numbers, phonemizeWord, eastSlavicNumberWords);
}

const CYRILLIC = "\\u0400-\\u04FF";
// ⚠ THE NUMBER TOKEN SPANS THE DECIMAL COMMA. Without it the comma is clause punctuation and `5,3 %`
// read as *пяць , тры* — a phrase break inside a quantity, on 64,420 corpus instances.
const TOKEN = new RegExp(`([${CYRILLIC}'’ʼ]+)|(\\d+(?:,\\d+)?)|([.?!,;:…—])`, "gu");


/**
 * SYMBOL NORMALIZATION — Belarusian. Every word is a be.wikipedia TOKEN attestation whose examples were
 * read (see normalize.ts's header and docs/investigations/be_normalization_investigation.md, run 3):
 *   `працэнт` ×16/13 — its own article writes the sign and the word in one sentence: "гулец, які кідае на
 *     33 %, пападае кожны трэці кідок. Працэнт апісвае некалькі дыскрэтных падзей."
 *     ⚠ `адсотак` scored HIGHER (×20/20) and was declined: every one of its twenty hits is the same
 *     copy-pasted football-table legend (`% = Адсотак перамог`). Twenty articles carrying one template is
 *     one source, not twenty — a count is a lead, never a finding.
 *   `долар` ×101/16 — the currency article, "Долар — назва валют мноства краін, першапачаткова ЗША".
 *     ⚠ `даляр` (the тарашкевіца spelling) is ×12 and every hit is a PLACE or a PERSON — "чыгуначная
 *     станцыя Даляр" in Azerbaijan, and a character name. A false attestation of exactly the shape the
 *     header warns about, so the наркамаўка spelling is what ships.
 *   `еўра` ×71 · `кіламетраў` ×31 · `кілаграм` ×27 · `сантыметраў` ×32 · `міліметраў` ×31 ·
 *   `квадратны кіламетр` ×21 ("395 чалавек на адзін квадратны кіламетр") · `кубічных` ×25 ·
 *   `мільярдаў` ×45 · `тысяч` ×71 · `мінус` (be.wikipedia renders the film title `ゴジラ -1.0` as
 *   «Гадзіла мінус адзін» — the sign read aloud before a numeral) · `плюс-мінус` ×4.
 *
 * ⚠ THREE ONE-LETTER KEYS ARE DELIBERATELY NOT DECLARED, each on a counted corpus fact:
 *   `г` is *год* in 7 of its 8 digit-adjacent instances, not *грам*; `с` is *старонка* in every one of its
 *   bibliography instances, not *секунда*; `т` is *том*. Declaring any of them would misread the language's
 *   own citation style and its years. `м` is claimed in normalize.ts instead, with an explicit guard.
 */
const SYMBOLS = makeSymbolNormalizer({
    percent: ["працэнт", "працэнты", "працэнтаў", "працэнта"],
    currency: {
        "€": ["еўра"], // indeclinable
        "$": ["долар", "долары", "долараў", "долара"],
        "£": ["фунт", "фунты", "фунтаў", "фунта"],
        "₽": ["рубель", "рублі", "рублёў", "рубля"],
    },
    units: {
        "км": ["кіламетр", "кіламетры", "кіламетраў", "кіламетра"],
        "см": ["сантыметр", "сантыметры", "сантыметраў", "сантыметра"],
        "мм": ["міліметр", "міліметры", "міліметраў", "міліметра"],
        "кг": ["кілаграм", "кілаграмы", "кілаграмаў", "кілаграма"],
        "га": ["гектар", "гектары", "гектараў", "гектара"],
        "ггц": ["гігагерц", "гігагерцы", "гігагерцаў", "гігагерца"],
        // LATIN aliases. be.wikipedia writes the Cyrillic abbreviation throughout, but the engine's TOKEN
        // matches Cyrillic only, so a foreign-sourced `120 km` loses the unit entirely rather than merely
        // mispronouncing it — the same reasoning as Russian's and Ukrainian's aliases.
        "km": ["кіламетр", "кіламетры", "кіламетраў", "кіламетра"],
        "cm": ["сантыметр", "сантыметры", "сантыметраў", "сантыметра"],
        "mm": ["міліметр", "міліметры", "міліметраў", "міліметра"],
        "kg": ["кілаграм", "кілаграмы", "кілаграмаў", "кілаграма"],
    },
    unitPer: "на", // км/гадз → кіламетраў НА гадзіну
    rateDenominators: { "гадз": "гадзіну", "год": "гадзіну", "h": "гадзіну", "s": "секунду" },
    // Belarusian puts the measure adjective BEFORE the noun as a separate agreeing word — квадратных
    // кіламетраў — the East-Slavic shape, not Swedish's fused compound.
    exponentWords: {
        squared: ["квадратны", "квадратныя", "квадратных", "квадратнага"],
        cubed: ["кубічны", "кубічныя", "кубічных", "кубічнага"],
        position: "before",
    },
    // A BARE power — `5²`, with no unit noun for the exponent to modify — was dropped outright.
    // ⚠ ONLY `squared` IS DECLARED, and the asymmetry is the evidence. `у квадраце` is ×10/8 and one hit is
    // exactly this slot — "ват дзяліць на метр у квадраце". Against that, `у кубе` is ×1/1 (a lead, not a
    // finding) and `у ступені` ×5/3 is a FALSE attestation: its hits are the ORDER-OF-MERIT sense,
    // "у ступені «Вялікі крыж»". An undeclared power leaves the superscript where the RAWMARK gate can see
    // it, which is strictly better than inventing a reading for it.
    bareExponent: { squared: "{n} у квадраце" },
    // `×` and `&`. The multiplication article reads the notation aloud and gives the SHORT register —
    // «два на тры ёсць шэсць» — which is also the register `=` takes in normalize.ts step 10. Every `×`
    // in this corpus is a dimension (`270×18 метраў`, `9×19mm Parabellum`, the orbit `215×939`), so one
    // word serves and `by` defaults to it.
    multiply: { times: "на" },
    ampersand: "і",
    // Inflected forms too, because running text writes the one its numeral governs (2 мільёны, 5 мільёнаў).
    magnitudes: ["тысячы", "тысяч", "мільён", "мільёна", "мільёны", "мільёнаў",
        "мільярд", "мільярда", "мільярды", "мільярдаў"],
    // A DECIMAL governs the GENITIVE SINGULAR — 2,4 працэнта — a fourth form, because the 2–4 slot here is
    // the nominative plural (два працэнты) and so cannot serve. Same shape as Ukrainian.
    countForm: (n) => (Number.isInteger(n) ? slavicCountForm(n) : 3),
});

class BelarusianPhonemizer implements Phonemizer {
    text(input: string): string {
        // normalize.ts FIRST (its ordinal, clock, era, year and range steps need the number and its suffix
        // still adjacent, which the tier would break), then the INITIALISM pass, then the shared symbol
        // tier — the initialism pass must not see a `$` glued to a caps run, and the tier matches a unit
        // only when a NUMBER is adjacent, which is why the degree and clock rules run before it.
        const prepared = SYMBOLS(normalizeBelarusianInitialisms(normalizeBelarusian(input)));
        return assembleClauses(prepared, TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(m[1]));
            else if (m[2]) {
                const [intPart, frac] = m[2].split(",");
                sink.emit(number(intPart!));
                if (frac !== undefined) {
                    sink.emit(phonemizeWord(DEF.numbers.decimalConnector));
                    for (const dg of frac) sink.emit(number(dg));
                }
            }
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
