/**
 * European Portuguese (pt-PT) phonemizer — canonical IPA, espeak-independent. Rule-based g2p (g2p.ts) →
 * stress pass → the EP vowel-REDUCTION pass (unstressed a→ɐ, e→ɨ, o→u) → sibilant voicing. text() tokenizes
 * words / numbers / punctuation. No lexicon (yet). See docs/investigations/pt_native_bringup_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { sibilants, toSegments, type Seg } from "./g2p.ts";
import { numberToWords } from "./numbers.ts";
import { MANIFEST } from "./manifest.ts";
import { normalizePortuguese, normalizePortugueseInitialisms } from "./normalize.ts";
import { loadTsvMap } from "../../core/loadTsv.ts";

// Lexical CORRECTION table (Approach A): the engine gets reduction/stress/glides right on its own; the lexicon
// only patches the two genuinely-lexical axes it cannot predict — the STRESSED mid-vowel quality (open ɛ/ɔ vs
// the close e/o default) and grapheme x (s/z/ks vs the ʃ default). Derived from wikipron EP (tools/pt-gen-
// lexicon.mts). Row: word<TAB>code, code ∈ { "ɛ", "ɔ", "x:s", "x:z", "x:ks" }, "|"-joined if both apply.
export interface Corr {
    open?: "ɛ" | "ɔ";
    x?: string;
    initE?: string;
}
let LEXICON: Map<string, Corr> | undefined;
/** Parse a correction code cell (e.g. "ɛ|x:s") into a Corr. */
function parseCorr(cell: string): Corr {
    const corr: Corr = {};
    for (const code of cell.split("|")) {
        if (code === "ɛ" || code === "ɔ") corr.open = code;
        else if (code.startsWith("x:")) corr.x = code.slice(2);
        else if (code.startsWith("e:")) corr.initE = code.slice(2); // word-initial e is e/ɛ (not the i default)
    }
    return corr;
}
function lexicon(): Map<string, Corr> {
    if (LEXICON === undefined) {
        // wikipron-generated table, then the hand-curated supplement OVERRIDES it (loaded second).
        LEXICON = loadTsvMap(import.meta.url, "lexicon.tsv", parseCorr, {
            optional: true,
        });
        for (const [k, v] of loadTsvMap(
            import.meta.url,
            "lexicon-manual.tsv",
            parseCorr,
            { optional: true },
        ))
            LEXICON.set(k, v);
    }
    return LEXICON;
}

// Reduction / nasalization maps are DATA (portuguese.jsonc). Reduction is the EP signature (unstressed a→ɐ,
// e→ɨ, o→u); nasal vowels resist it. NASAL maps an oral vowel IPA → its nasal quality.
const REDUCE = MANIFEST.reduce;
const NASAL = MANIFEST.nasal;

/** Index of the stressed nucleus. Written accent wins; else oxytone (final nucleus) when the word — ignoring a
 *  final -s — ends in r/l/z/x, i/u, a nasal tilde vowel / diphthong, or -im/-um; else paroxytone (penult). */
function stressedNucleus(word: string, segs: Seg[]): number {
    const nuclei = segs
        .map((s, i) => (s.nucleus ? i : -1))
        .filter((i) => i >= 0);
    if (nuclei.length === 0) return -1;
    const accented = nuclei.find((i) => segs[i]!.accent);
    if (accented !== undefined) return accented;
    if (nuclei.length === 1) return nuclei[0]!;
    const w = word.toLowerCase().replace(/s$/, "");
    const last = w[w.length - 1] ?? "";
    const oxytone =
        "lrzx".includes(last) ||
        last === "i" ||
        last === "u" ||
        last === "í" ||
        last === "ú" ||
        /[ãõ]$/.test(w) ||
        /(ão|ãe|õe)$/.test(w) ||
        /[iu][mn]$/.test(w); // -im/-um and their -ins/-uns plurals (s already stripped)
    return oxytone ? nuclei[nuclei.length - 1]! : nuclei[nuclei.length - 2]!;
}

const isGlidePh = (ph: string): boolean =>
    ph === "j" || ph === "w" || ph === "j̃" || ph === "w̃";

/** Post-stress onglide demotion: an UNSTRESSED high vowel (i/u) immediately before another nucleus is a rising
 *  glide, not a syllable of its own (diamante → djɐmɐ̃tɨ, água → aɡwɐ) — but a stressed one stays (dia → diɐ).
 *  Runs after stress so the count is settled; mid-vowel onglides (e/o) are left alone (moeda → muɛðɐ). */
const LIQUID = new Set(MANIFEST.liquids);
function onglides(segs: Seg[], stress: number): void {
    for (let i = 0; i < segs.length; i++) {
        const s = segs[i]!;
        if (
            !s.nucleus ||
            i === stress ||
            (s.raw !== "i" && s.raw !== "u" && s.raw !== "e")
        )
            continue;
        const next = segs[i + 1];
        if (!next || !next.nucleus) continue;
        // A high vowel before a STRESSED high vowel is hiatus, not a glide (juiz → ʒuiʃ, miúdo → miudu; but
        // piano → pjɐnu, água → aɡwɐ glide before a low vowel).
        if (i + 1 === stress && (next.raw === "i" || next.raw === "u"))
            continue;
        // A high vowel after an obstruent+liquid onset cluster stays a nucleus (criança → kɾiɐ̃sɐ, not kɾjɐ̃-).
        const p1 = segs[i - 1],
            p2 = segs[i - 2];
        if (p1 && p2 && LIQUID.has(p1.ph) && !p2.nucleus) continue;
        s.nucleus = false;
        s.ph = s.raw === "u" ? "w" : "j"; // i/e → j, u → w
    }
}

// BP unstressed-vowel raising is POSITION-split, unlike EP's blanket reduction: only the FINAL atonic vowel
// raises (e→i, o→u, a→ɐ — cidade → sidad(ʒ)i, estado → estadu), while pretonic/postonic-medial vowels keep their
// mid quality (bonito → bonitu NOT bunitu, professor → pɾofesoɾ, telefone → telefoni). This is the deepest EP→BP
// difference and is NOT recoverable from EP surface forms (EP has already collapsed pretonic o→u), which is why
// the dialect is a parameter of the engine rather than a post-process. There is no [ɨ] and no initial-e→i in BP.
const REDUCE_BP_FINAL: Record<string, string> = { a: "ɐ", e: "i", o: "u" };
const REDUCE_BP_MID: Record<string, string> = { a: "a", e: "e", o: "o" };

/** Realize vowels: reduce unstressed oral vowels, nasalize nasal ones, mark the stressed nucleus with ˈ. */
function realize(segs: Seg[], stress: number, dialect: "ep" | "bp" = "ep"): string {
    let out = "";
    for (let i = 0; i < segs.length; i++) {
        const s = segs[i]!;
        let ph = s.ph;
        const diphthong =
            segs[i + 1] && !segs[i + 1]!.nucleus && isGlidePh(segs[i + 1]!.ph); // nucleus + offglide
        if (s.nucleus && i !== stress && !s.nasal && !diphthong && s.raw) {
            // Unstressed ⟨a⟩/⟨e⟩ before a coda dark-l (ɫ) do NOT reduce/raise — the velarized ɫ keeps the vowel
            // open: ⟨a⟩→[a] (altura → aɫtuɾɐ, salvar → saɫvaɾ) and ⟨e⟩→[ɛ] (delgado → dɛɫɡadu, the -ável/-ível
            // suffix -vel → vɛɫ). Onset l still reduces (falar → fɐlaɾ). ⟨o⟩ still raises before ɫ (soldado →
            // suɫdadu — the referee corroborates the o-raise, unlike a/e). Referee-confirmed 53:0 (a), 89:0 (e).
            const beforeDarkL = segs[i + 1]?.ph === "ɫ";
            if (dialect === "bp") {
                const isFinal = !segs.slice(i + 1).some((x) => x.nucleus); // last atonic nucleus = raises
                ph = beforeDarkL
                    ? s.raw === "a"
                        ? "a"
                        : s.raw === "e"
                          ? "e" // BP keeps unstressed ⟨e⟩ CLOSE before coda-l (the -ável/-ível suffix → [avew], not
                          : // the EP [avɛw]); the l→w step then gives [ew]. (EP opens it to [ɛ].)
                            s.raw === "o"
                            ? "o" // ⟨o⟩ keeps mid quality before coda-l → the l→w step gives [ow] (soldado → sowdadu)
                            : ph // ⟨i⟩/⟨u⟩ before coda-l keep their quality (fácil → fasiw, útil → ut͡ʃiw)
                    : ((isFinal ? REDUCE_BP_FINAL : REDUCE_BP_MID)[s.raw] ?? ph);
            } else {
                // EP: word-initial unstressed e → i (está → iʃta), else the blanket reduction a→ɐ, e→ɨ, o→u.
                ph =
                    beforeDarkL && s.raw === "a"
                        ? "a"
                        : beforeDarkL && s.raw === "e"
                          ? "ɛ"
                          : i === 0 && s.raw === "e"
                            ? "i"
                            : (REDUCE[s.raw] ?? ph);
            }
        }
        // BP: a stressed OPEN mid vowel (ɔ/ɛ) with no EXPLICIT accent, before a nasal-onset consonant, CLOSES —
        // the ô/ê of Brazilian orthography where Europe keeps ó/é open (abandona→abɐ̃donɐ, acena→asenɐ; EP
        // abɐ̃dɔnɐ/asɛnɐ). Gated on !s.accent so acute-marked ó/é stay open (afónica keeps [ɔ]).
        if (
            dialect === "bp" &&
            i === stress &&
            !s.accent &&
            !s.nasal &&
            (ph === "ɔ" || ph === "ɛ")
        ) {
            const nx = segs[i + 1];
            if (nx && !nx.nucleus && (nx.ph === "m" || nx.ph === "n" || nx.ph === "ɲ"))
                ph = ph === "ɔ" ? "o" : "e";
        }
        if (s.nasal && s.nucleus) ph = NASAL[ph] ?? ph;
        if (i === stress) out += "ˈ";
        out += ph;
    }
    return out;
}

/** Apply a lexical correction: open the stressed mid vowel (e→ɛ / o→ɔ) and/or override grapheme x. */
function correct(segs: Seg[], stress: number, corr: Corr): void {
    if (corr.open && segs[stress]) {
        const close = corr.open === "ɛ" ? "e" : "o";
        if (segs[stress]!.ph === close) segs[stress]!.ph = corr.open;
    }
    if (corr.x) for (const s of segs) if (s.raw === "x") s.ph = corr.x;
    // Word-initial e realizes as e/ɛ, overriding the default i-raising: raw="" so realize leaves ph untouched.
    if (corr.initE && segs[0] && segs[0]!.nucleus && segs[0]!.raw === "e") {
        segs[0]!.ph = corr.initE;
        segs[0]!.raw = "";
    }
}

/** Core: EP word → canonical IPA, applying an explicit correction (used by the lexicon and its generator). */
export function renderWord(word: string, corr?: Corr, dialect: "ep" | "bp" = "ep"): string {
    const segs = toSegments(word, dialect);
    if (segs.length === 0) return "";
    sibilants(segs, dialect);
    const stress = stressedNucleus(word, segs);
    onglides(segs, stress);
    if (corr) correct(segs, stress, corr);
    const ipa = realize(segs, stress, dialect);
    return dialect === "bp" ? bpConsonants(ipa) : ipa;
}

/** BP consonant surface rules applied to the realized string (their triggers — [i] incl. raised final ⟨e⟩, the
 *  onset glide [j] from a high front vowel, and coda [ɫ] — are unambiguous at this point): (1) affrication of
 *  /t d/ before [i]/[ĩ]/[j] (tia → t͡ʃia, dia → d͡ʒia, gente → ʒẽt͡ʃi, cidade → sidad͡ʒi; and before the glide —
 *  the referee palatalises categorically here: adiado → ad͡ʒjadu, ação-tipo cases); (2) coda-l vocalization ɫ →
 *  [w] (sal → saw, Brasil → bɾaziw). Coda-r stays [ɾ] and rr/initial stay [ʁ] — both attested in the BZ referee,
 *  so no contested [h]/[x]/[ɻ] choice. */
function bpConsonants(ipa: string): string {
    return ipa
        .replace(/t([ˈˌ]?[iĩj])/gu, "t͡ʃ$1")
        .replace(/d([ˈˌ]?[iĩj])/gu, "d͡ʒ$1")
        .replace(/ɫ/gu, "w");
}

/** One word → canonical IPA: rule engine + the lexical correction table (open/close vowels, x). `dialect` selects
 *  European (default) or Brazilian realization; the open/close correction lexicon is shared (EP-derived, mostly
 *  valid for BP — a small lexical tail where the dialects differ on a stressed mid vowel). */
export function phonemizeWord(word: string, dialect: "ep" | "bp" = "ep"): string {
    return renderWord(word, lexicon().get(word.toLowerCase()), dialect);
}

const CLAUSE_MARK = MANIFEST.clausePunctuation;
// Word / number / clause-punctuation. Portuguese numbers: dot = thousands (1.500), comma = decimal (3,14).
const TOKEN = /([a-zà-ÿ]+)|(\d+(?:\.\d+)*(?:,\d+)?)|([.!?…,;:])/giu;

/** A number token (thousands-dots / decimal-comma) → spoken words. `dialect` selects the BP teen forms (16/17/19
 *  dez-e- vs the EP dez-a-). */
function numberTokenToWords(tok: string, dialect: "ep" | "bp"): string {
    const [intRaw, frac] = tok.split(",");
    let words = numberToWords(Number(intRaw!.replace(/\./g, "")), dialect);
    if (frac !== undefined)
        words +=
            ` ${MANIFEST.numbers.decimalConnector} ` +
            [...frac].map((d) => numberToWords(Number(d), dialect)).join(" ");
    return words;
}

// Unstressed monosyllabic clitics (articles, prepositions, conjunctions, clitic pronouns) — de-stressed in
// running text (DATA: portuguese.jsonc).
const FUNCTION_WORDS = new Set(MANIFEST.functionWords);

/** `postWord`, if given, refines a resolved word's IPA with its (lowercased) source word — the hook the pt-BR
 *  variant uses to apply its BP open/close override lexicon while reusing this engine's number/clause context. */
function wordIpa(
    word: string,
    dialect: "ep" | "bp",
    postWord?: (ipa: string, word: string) => string,
): string {
    let ipa = phonemizeWord(word, dialect);
    if (postWord) ipa = postWord(ipa, word.toLowerCase());
    return FUNCTION_WORDS.has(word.toLowerCase()) ? ipa.replace("ˈ", "") : ipa;
}

// #562 symbol normalization — Portuguese (quilômetro: the BR spelling; pt-BR is the corpus variety).
const SYMBOLS = makeSymbolNormalizer({
    percent: ["por cento"],
    currency: { "€": ["euro", "euros"], "$": ["dólar", "dólares"], "£": ["libra", "libras"], "¥": ["iene", "ienes"] },
    // Longest keys match first, so km/h beats km. The slash unit was dropping its /h entirely.
    units: { "km/h": ["quilômetro por hora", "quilômetros por hora"], "m/s": ["metro por segundo", "metros por segundo"],
        km: ["quilômetro", "quilômetros"], cm: ["centímetro", "centímetros"], mm: ["milímetro", "milímetros"],
        kg: ["quilograma", "quilogramas"], mg: ["miligrama", "miligramas"], m: ["metro", "metros"],
        l: ["litro", "litros"], ml: ["mililitro", "mililitros"], g: ["grama", "gramas"],
        t: ["tonelada", "toneladas"], ha: ["hectare", "hectares"], kw: ["quilowatt", "quilowatts"] },
    exponentWords: { squared: ["quadrado", "quadrados"], cubed: ["cúbico", "cúbicos"] },
    magnitudes: ["milhões", "milhão", "bilhões", "bilhão"],
    magnitudeConnective: "de", // cinco milhões DE dólares
});

class PortuguesePhonemizer implements Phonemizer {
    constructor(
        private readonly dialect: "ep" | "bp" = "ep",
        private readonly postWord?: (ipa: string, word: string) => string,
    ) {}
    text(input: string): string {
        const d = this.dialect,
            pw = this.postWord;
        // #562 order: Portuguese rewrites (abbreviations, era markers, ordinal indicators, clock, R$) →
        // INITIALISMS → the shared symbol tier last, since the clock rule has already claimed the hour.
        // Roman numerals arrive already converted from the registry seam (pt is not in ROMAN_NATIVE).
        const normalized = SYMBOLS(normalizePortugueseInitialisms(normalizePortuguese(input, this.dialect === "bp")));
        return assembleClauses(normalized, TOKEN, (m, sink) => {
            if (m[1]) sink.emit(wordIpa(m[1], d, pw));
            else if (m[2])
                sink.emit(
                    numberTokenToWords(m[2], d)
                        .split(" ")
                        .map((w) => wordIpa(w, d, pw))
                        .join(" "),
                );
            else if (m[3]) {
                const mk = CLAUSE_MARK[m[3]];
                if (mk) sink.pause(mk);
            }
        });
    }
}

/** Build the Portuguese phonemizer (no data files — fully rule-based). `dialect` selects European (default) or
 *  Brazilian ("bp") realization; `postWord` is an optional per-word IPA refinement (the BP open/close lexicon).
 *  See src/languages/portuguese-br for the BP accent-variant entry points. */
export function createPortuguese(
    dialect: "ep" | "bp" = "ep",
    postWord?: (ipa: string, word: string) => string,
): Phonemizer {
    return new PortuguesePhonemizer(dialect, postWord);
}
