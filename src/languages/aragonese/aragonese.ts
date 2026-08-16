/**
 * Aragonese (an) phonemizer — aragonés, Ibero-Romance (Pyrenean, ~25k, Aragon/NE Spain), Latin, canonical IPA.
 *
 * A Spanish-shaped shallow greedy scan (the Asturian/Galician pattern) with the Aragonese
 * hallmarks:
 *   ⚠ ⟨ch⟩→[t͡ʃ] (Aragonese writes ⟨ch⟩ where Spanish has [x]: Chesús→t͡ʃesus), ⟨ny⟩→[ɲ] (the Catalan-style digraph:
 *     Espanya→espaɲa), ⟨x⟩→[ʃ] (baxo→baʃo), ⟨v⟩→[b] (betacism);
 *   ⚠ DISTINCIÓN (standard Aragonese, per the Academia): ⟨z⟩ / ⟨c⟩ before e/i → [θ] (seseo [s] is the marked
 *     Benasquese/Ribagorçan minority → we emit [θ] and fold the axis); ⟨j⟩ / ⟨g⟩ before e/i → [x];
 *   ⚠ WORD-FINAL ⟨-r⟩ after a vowel is DROPPED (the Aragonese apocope: abanzar→abansa, cantar→canta).
 * Single ⟨r⟩→[ɾ] tap vs ⟨rr⟩/word-initial → [r] trill; the rising glides ⟨i⟩→[j]/⟨u⟩→[w] before a vowel; ⟨qu gu⟩→
 * [k ɡ] before a front vowel (⟨u⟩ silent) / [kw ɡw] before a back vowel. Stress (written accents + the Ibero rule)
 * and SPIRANTIZATION (intervocalic b/d/g→β/ð/ɣ) are folded/deferred. Referee: wikipron arg_latn_broad (human,
 * 1320).
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { latinPhone } from "../../core/latinPhones.ts";
import { hostWordRun, makeNativiser } from "../../core/hostWord.ts";
import { loadManifest } from "../../core/loadManifest.ts";
import { IPA_VOWEL } from "../../core/ipa.ts";
import { numberToWords } from "./numbers.ts";
import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";
import { normalizeAragonese } from "./normalize.ts";

interface AragoneseDef {
    digraphs: Record<string, string>;
    graphemes: Record<string, string>;
    clausePunctuation: Record<string, string>;
    vowelLetters: readonly string[];
    frontLetters: readonly string[];
}
const DEF = loadManifest<AragoneseDef>(import.meta.url, "aragonese.jsonc");
const DIGRAPHS = DEF.digraphs;
const G = DEF.graphemes;
const CLAUSE_MARK = DEF.clausePunctuation;
const ORDER = Object.keys(DIGRAPHS).sort((a, b) => b.length - a.length);
// Letter environments (aragonese.jsonc): ⟨c⟩/⟨g⟩ soften and ⟨qu gu⟩ drop the [w] before a FRONT letter.
const VOWEL_LETTER = new Set(DEF.vowelLetters);
const FRONT_LETTER = new Set(DEF.frontLetters);

/** Scan a lowercased Aragonese word into IPA phone tokens. */
function scan(word: string): string[] {
    const w = word.normalize("NFC").toLowerCase();
    const out: string[] = [];
    let i = 0;
    outer: while (i < w.length) {
        const c = w[i]!, next = w[i + 1] ?? "";
        for (const key of ORDER) {
            if (w.startsWith(key, i)) { out.push(DIGRAPHS[key]!); i += key.length; continue outer; }
        }
        // ⟨qu gu⟩ → [k ɡ] before a front vowel (⟨u⟩ silent); ⟨gu gü / qu⟩ → [kw ɡw] before a back vowel.
        if ((c === "q" || c === "g") && (next === "u" || next === "ü") && VOWEL_LETTER.has(w[i + 2] ?? "")) {
            const base = c === "q" ? "k" : "ɡ";
            out.push(next === "ü" || !FRONT_LETTER.has(w[i + 2]!) ? base + "w" : base);
            i += 2;
            continue;
        }
        if (c === "c") { out.push(FRONT_LETTER.has(next) ? "θ" : "k"); i += 1; continue; } // distinción: c+e/i → [θ]
        if (c === "g") { out.push(FRONT_LETTER.has(next) ? "x" : "ɡ"); i += 1; continue; } // g+e/i → [x] (jota)
        // the RISING glides: ⟨i⟩→[j], ⟨u⟩→[w] before another vowel.
        if (c === "i" && VOWEL_LETTER.has(next)) { out.push("j"); i += 1; continue; }
        if (c === "u" && VOWEL_LETTER.has(next)) { out.push("w"); i += 1; continue; }
        // ⟨y⟩ → [ʝ] as an onset (before a vowel), [i] as a coda offglide (rey→rei).
        if (c === "y") { out.push(VOWEL_LETTER.has(next) ? "ʝ" : "i"); i += 1; continue; }
        // word-initial ⟨r⟩ → [r] trill (single ⟨r⟩ is the tap [ɾ] via the table; ⟨rr⟩ is the digraph above).
        if (c === "r" && i === 0) { out.push("r"); i += 1; continue; }
        // ⚠ A letter with no rule here still denotes a sound; dropping it deletes what the writer typed.
        // Consulted AFTER every digraph and single-letter rule, so it cannot override this language.
        const ph = G[c] ?? latinPhone(c, { initial: i === 0 });
        if (ph !== undefined && ph !== "") out.push(ph);
        i += 1;
    }
    // WORD-FINAL ⟨-r⟩ APOCOPE: a final tap [ɾ] after a vowel is dropped (the documented Aragonese trait, shared
    // with Catalan/Occitan: cantar→[kanˈta], banyar→[baˈɲa]). The referee attests BOTH the dropped and the
    // spelling-pronunciation form (dialect-variable) → the dropped form is the phonetically-accurate default.
    if (out.length >= 2 && out[out.length - 1] === "ɾ" && IPA_VOWEL.has(out[out.length - 2]!)) out.pop();
    return out;
}

/** ⟨n⟩ → [m] before a labial [b p m] (⟨v⟩ is already [b]). */
function labialNasal(toks: string[]): void {
    for (let i = 0; i < toks.length - 1; i++) {
        if (toks[i] === "n" && (toks[i + 1] === "b" || toks[i + 1] === "p" || toks[i + 1] === "m")) toks[i] = "m";
    }
}

/** Phonemize a single Aragonese word to canonical IPA (segmental; stress + spirantization folded/deferred). */
export function phonemizeWord(word: string): string {
    const toks = scan(word);
    labialNasal(toks);
    return toks.join("");
}

/**
 * The shared SYMBOL tier. ⚠ EVERY WORD HERE IS TAKEN FROM AN ARTICLE THAT DEFINES THE SYMBOL ITSELF, which
 * is the strongest sourcing this sweep has had. an.wikipedia carries a unit article per symbol and each one
 * pairs the noun with the abbreviation in its first sentence:
 *
 *     "O kilogramo (simbolo kg) ye a unidat base de masa"     · "O centimetro, que tiene por simbolo cm"
 *     "O milimetro, que ha simbolo mm"                        · "O kilometro ye una unidat de largaria"
 *     "Un kilometro cuadrau … Se simboliza por km²"           · "O grau Celsius … representau como °C"
 *     "O kilogramo por metro cubico … se representa por kg/m³" — the RATE, with its own connective
 *     "a densidat … s'expresa en habitants por km²"           — and the density rate, likewise
 *
 * ⚠ THE PERCENT WORD IS `por cient`, NOT THE HIGHER-SCORING `ciento`. On the wiki `ciento` ×49 outscores
 * `cient` ×35, but the percentage phrase this corpus actually writes is "creixió en un 6 **por cient**",
 * "un creiximiento total d'o PIB meyo d'o 4.5 **por cient**". The count ranks the word; the slot picks it.
 *
 * ⚠ AND THE CURRENCY IS WRITTEN IN BOTH ORDERS, which is where the Asturian sibling hypothesis broke. That
 * corpus is postposed without exception; this one prefixes twelve of its sixteen instances (`$359,9`,
 * `US$185`, `€47.5`, `£4.300`, `US$ 690.000`) and postposes four (`92.000€`, `2€`, `10€`, `300$`). The tier
 * reads both positions, and `currencyPrefix` is left OFF because the spoken order is still noun-last —
 * "8.000 millons de dólars" is how the corpus says it.
 *
 * `dólar` ×52 / `dólars` ×47 beat the unaccented `dolar` ×32 / `dolars` ×42; `libra` ×36 / `libras` ×33;
 * `euro` ×16 / `euros` ×34; `millons` ×75; `billons` ×27; `habitants` ×71; `graus` ×64; `Celsius` ×36;
 * `Fahrenheit` ×35; `menutos` ×27; `ora` ×12.
 */
const SYMBOLS = makeSymbolNormalizer({
    percent: ["por cient"],
    // ⚠ `US$` IS ITS OWN KEY, or the sign is silently DROPPED: the tier declines a currency mark that a
    // letter runs into, so `US$185 billons` read as *us cient uitanta i cinco billons* with no unit at
    // all. Five instances here (`US$185`, `US$27.420`, `US$ 690.000`, `US$ 2.000.000`, `US$ 5.500.000`),
    // and the corpus supplies the phrase for them: "As unidaz son en dólars estausunidenses."
    currency: {
        "US$": ["dólar estausunidense", "dólars estausunidenses"],
        "€": ["euro", "euros"], "£": ["libra", "libras"], "$": ["dólar", "dólars"],
    },
    units: {
        "km": ["kilometro", "kilometros"], "m": ["metro", "metros"],
        "cm": ["centimetro", "centimetros"], "mm": ["milimetro", "milimetros"],
        "kg": ["kilogramo", "kilogramos"], "g": ["gramo", "gramos"],
        // `hab` is declared as a unit ONLY so `hab/km²` composes as a rate — the shape in every geography
        // article here ("una densidat de población de 413 hab./km²"). normalize.ts drops the abbreviation
        // point first, because the tier cannot see a rate through it.
        "hab": ["habitant", "habitants"], "habitants": ["habitant", "habitants"],
    },
    unitPer: "por",
    rateDenominators: { "h": "ora" },
    exponentWords: { squared: ["cuadrau", "cuadraus"], cubed: ["cubico", "cubicos"], position: "after" },
    ampersand: "y",
    magnitudes: ["millón", "millons", "billón", "billons"],
    magnitudeConnective: "de",
});

// A word (Aragonese Latin letters incl. ñ, accents, ü) / number / punctuation token.
// ⚠ THE DECIMAL COMMA IS SPANNED BY THE NUMBER BRANCH, or the tokenizer's own `,` claims it as a clause
// pause and `0,33%` reads as *zero , trenta i tres* — a phrase break inside a quantity. normalize.ts has
// already folded the short dot-decimals (`10.92`) onto the comma, so one branch covers both conventions.
// `decimals` is 24,548 corpus-wide, the third-largest class in the artifact.
const TOKEN = new RegExp(`(${hostWordRun(["Latin"], "'·")})|(\\d+(?:,\\d+)?)|([.!?…,;:])`, "gu");

/**
 * This language's OWN inventory — the TOKEN word class as it stood before the widening above, lifted
 * verbatim, so nothing about the orthography is invented here. A token this REJECTS carries a letter the
 * language does not use, i.e. a foreign name. See core/hostWord.ts: this is the INVENTORY question, and it
 * is no longer also deciding where the script boundary falls.
 */
const NATIVE_CLASS = "[a-zñáéíóúüïA-ZÑÁÉÍÓÚÜÏ'·]";
const nat = makeNativiser(NATIVE_CLASS, "u");

class AragonesePhonemizer implements Phonemizer {
    text(input: string): string {
        // normalize.ts FIRST — its separator, era, abbreviation, clock and degree steps need the figure
        // and its mark still adjacent, which the tier would break — then the shared symbol tier, which
        // matches a unit only when a NUMBER is adjacent.
        return assembleClauses(SYMBOLS(normalizeAragonese(input)), TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(nat(m[1])));
            // A digit run reads as Aragonese number WORDS, each phonemized like any other word.
            else if (m[2]) {
                const [intPart, frac] = m[2].split(",");
                for (const wd of numberToWords(Number(intPart)).split(" ")) sink.emit(phonemizeWord(wd));
                if (frac !== undefined) {
                    // ⚠ `coma` ×74 on an.wikipedia, but MOSTLY AS A LANDFORM — "Una coma u nava ye una
                    // plana situada en un zona…", the Pyrenean hollow. The punctuation sense is attested
                    // through the corpus's own disambiguation line ("ta la coma como signo de puntuación,
                    // se veiga Coma (puntuación)") and through its metric glossary ("0,1 dam - zero coma
                    // un decametro"). The homograph costs nothing, since both senses are the same word.
                    sink.emit(phonemizeWord("coma"));
                    for (const dg of frac) for (const wd of numberToWords(Number(dg)).split(" ")) sink.emit(phonemizeWord(wd));
                }
            }
            else if (m[3]) { const mk = CLAUSE_MARK[m[3]]; if (mk) sink.pause(mk); }
        });
    }
}

/** Build the Aragonese phonemizer (Spanish-shaped Ibero-Romance g2p + ch/ny/x deltas + seseo + final-r drop). */
export function createAragonese(): Phonemizer {
    return new AragonesePhonemizer();
}
