/**
 * Nigerian Pidgin / Naija (pcm) phonemizer — an English-lexified creole, canonical IPA.
 *
 * ⚠ TARGETS THE ENGLISH-ETYMOLOGICAL MEDIA ORTHOGRAPHY (BBC Pidgin, social media — what people actually read
 * and write), NOT the academic phonemic NLA orthography. Two layers:
 *   (1) a LEXICON (naija.jsonc) of high-frequency words whose media spelling is irregular
 *       (dey→dɛ, e→i, make→mek, say→se) or whose mid-vowel quality needs adjudication (comot→kɔmɔt, go→ɡo);
 *   (2) a Naija-phonology RULE g2p for everything else — 7 vowels /i e ɛ a ɔ o u/, TH-stopping (th→t), NO
 *       schwa reduction (full vowels), labial-velars ⟨gb⟩→ɡ͡b ⟨kp⟩→k͡p, ⟨ch⟩→t͡ʃ ⟨sh⟩→ʃ ⟨ny⟩→ɲ ⟨ng⟩→ŋ, ⟨r⟩→ɾ.
 *
 * ⚠ ENGLISH-SPELLED TOKENS GO THROUGH THE RULE G2P, NOT THE ENGLISH PHONEMIZER. Naija NATIVISES its English
 * loans — reads them with Naija values — so routing them out would be wrong for the creole. An English
 * reader is wired as `foreign` but deliberately not used automatically.
 *
 * Tone (H/L) is UNMARKED in the media orthography and out of scope; the output is segmental.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { LATIN_RUN, foldLatinToBase } from "../../core/hostWord.ts";
import { loadManifest } from "../../core/loadManifest.ts";
import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";
import { normalizeNaija } from "./normalize.ts";

interface NumbersDef {
    units: string[];
    teens: string[];
    tens: string[];
    hundred: string;
    thousand: string;
    million: string;
    billion: string;
    and: string;
    point: string;
}
interface OrdinalsDef {
    marker: string;
    first: string;
    second: string;
    third: string;
}
interface NaijaDef {
    letterNames: Record<string, string>;
    digraphs: Record<string, string>;
    consonants: Record<string, string>;
    vowels: Record<string, string>;
    lexicon: Record<string, string>;
    clausePunctuation: Record<string, string>;
    numbers: NumbersDef;
    ordinals: OrdinalsDef;
}
const DEF = loadManifest<NaijaDef>(import.meta.url, "naija.jsonc");
const CLAUSE_MARK = DEF.clausePunctuation;
const NUM = DEF.numbers;
const ORD = DEF.ordinals;
const LETTER = DEF.letterNames;

/** Dict-only English lookup: the CMUdict-derived citation IPA if the word is known English, else undefined
 *  (an OOV word — likely a substrate loan — that the rule g2p reads phonemically instead). */
export type ForeignPhonemizer = (latin: string) => string | undefined;

// NATIVISATION: standard-English CMUdict IPA → Naija phonology. Nigerian Pidgin is English-lexified and written
// (BBC-Pidgin / media style) mostly in ENGLISH spelling, so a known-English word is realised with Naija values:
// the 7-vowel system /i e ɛ a ɔ o u/ (no schwa reduction, no vowel-length), TH-stopping (θ→t, ð→d), NON-RHOTIC
// codas (car→ka, water→wata; onset r→ɾ). Lexical mergers inherited from the GenAm source (LOT/PALM, TRAP/BATH)
// are unresolved — a documented ceiling.
/**
 * English vowels, for the onset-/r/ lookahead — the alphabet as it stands at that line, before nativisation
 * collapses it. Stress and length are stripped by the first rule, so no mark class is needed here.
 *
 * ⚠ `ᵻ` WAS MISSING AND THAT DELETED ONSET /r/ (#1250). The parent's reduced vowel for unstressed `re-`/`ri-`
 * is a vowel, but it was not in this string, so `ɹᵻ` failed the onset test, fell through to the blanket drop
 * below, and `reports` read *ipɔts* — the /r/ off the front of the word. Audited over all 117,479 dict words
 * rather than patched for the reported symbol: `ᵻ` (×828) is the ONLY vowel that can follow an `ɹ`/`r` here
 * and is missing; every other character that can is a consonant or the word end, i.e. a genuine coda.
 * ⚠ "HERE" IS DOING WORK IN THAT SENTENCE: `ɚ`/`ɝ` are vowels and are NOT in this class, and they are safe
 * only because the two rules above consume them before the onset rule runs. `PRE_V` is what those use.
 */
const V = "iɪeɛæaɑɔoʊuʌəɐᵻ";
/**
 * The same vowels one step earlier, for the two NURSE/lettER rules — one step earlier `ɚ` and `ɝ` are still
 * in the string, because those two rules are what consume them.
 * ⚠ AND THEY ARE VOWELS, SO AN `ɚ` BEFORE ANOTHER ONE IS PRE-VOCALIC (#1250, review): looking ahead for `V`
 * alone, the first `ɚ` of `ɚɚ` missed the split below and the unconditional `ɚ → a` ate its onset /r/ —
 * `caterer` read *ketaa*, `acquirer` *akwaiaa*, 96 dict words in all. Kept separate from `V` for the reason
 * en-GB keeps its own separate: `V` describes the alphabet the ONSET rule sees, which no longer has them.
 */
const PRE_V = `${V}ɚɝ`;
/**
 * The four rhotic rules, HOISTED. `nativise` runs once per word and built these from `V` inside the chain,
 * recompiling four patterns per call. The C# port has always held them as statics; this is the TypeScript
 * catching up rather than a new idea, and it is the "repeated recompilation of regexes" PORTING.md lists as
 * free to fix — no byte of any golden moves. Measured, 40k dict words through `phonemize(w, "pcm")`, median
 * of five runs: 420 ms → 392 ms.
 */
const NURSE_PREVOCALIC = new RegExp(`ɝ(?=[${PRE_V}])`, "gu");
const LETTER_PREVOCALIC = new RegExp(`ɚ(?=[${PRE_V}])`, "gu");
const ONSET_R = new RegExp(`[ɹr](?=[${V}])`, "gu");
const CODA_R = new RegExp(`[ɹr](?![${V}])`, "gu");
function nativise(en: string): string {
    return en
        .normalize("NFC")
        .replace(/[ˈˌː]/gu, "") // stress, length
        .replace(/aᶦ/gu, "ai").replace(/aᶷ/gu, "au").replace(/[ɔo]ᶦ/gu, "ɔi") // PRICE/MOUTH/CHOICE
        .replace(/eᶦ/gu, "e").replace(/[oə]ᶷ/gu, "o") // FACE→e, GOAT→o
        // NURSE/lettER. ⚠ THE r IS ABSORBED ONLY IN CODA (#1250). These two ran unconditionally and mapped
        // the r-coloured vowel to a plain one BEFORE the onset rule below could see it, so a PRE-VOCALIC
        // ɚ/ɝ — where the /r/ is the onset of the next syllable and not a coda at all — lost it: `around`
        // (`ɚˈaᶷnd`) read *aaund*, `correct` *kaɛkt*, `arrive` *aaiv*. Measured over the 117k dict, 3,776 of
        // them are pre-vocalic (ɚ ×3,457, ɝ ×319). The tap is emitted here rather than left for the onset
        // rule because that rule matches `[ɹr]` and this vowel carries its r as a diacritic, not a segment.
        // Same split en-GB already makes for its linking /ɹ/, in the same position, for the same reason.
        .replace(NURSE_PREVOCALIC, "ɔɾ").replace(/ɝ/gu, "ɔ")
        .replace(LETTER_PREVOCALIC, "aɾ").replace(/ɚ/gu, "a")
        .replace(/ʰ/gu, "").replace(/̬/gu, "") // deaspirate, un-flap
        .replace(/θ/gu, "t").replace(/ð/gu, "d") // TH-stopping
        .replace(/ɫ/gu, "l").replace(/ʲ/gu, "j") // dark-l → l; palatal glide (abbreviate→abɾivijet) → j
        .replace(ONSET_R, "ɾ") // ONSET r → tap
        // CODA r → dropped (Naija is non-rhotic). ⚠ THE CODA CONDITION IS WRITTEN OUT (#1250) though the
        // onset rule one line up has already consumed every onset, which made this a blanket delete that was
        // correct only for as long as that rule stayed exhaustive — and it was not. Spelled out, a symbol
        // that ever reaches here before a vowel LEAKS as `ɹ` where a reader can see it instead of vanishing.
        // Verified a no-op today: the two fixes above leave nothing pre-vocalic for it to catch.
        .replace(CODA_R, "")
        .replace(/[iɪᵻ]/gu, "i").replace(/[uʊ]/gu, "u") // FLEECE/KIT, GOOSE/FOOT
        .replace(/[ʌɐ]/gu, "ɔ").replace(/ə/gu, "a") // STRUT→ɔ; schwa→a (lossy — see note)
        .replace(/[ɔɒ]/gu, "ɔ").replace(/[æɑ]/gu, "a"); // THOUGHT/LOT→ɔ; TRAP/PALM→a
}

/** Scan a lowercased Naija word with the rule g2p (digraphs first, then single letters, Naija values). Naija has
 *  no geminates, so doubled letters (English-spelling artifacts: jollof, garri) collapse to one first. */
function scan(w: string): string {
    // Degeminate (Naija has no geminates), then apply the SOFT-C convention the English-etymological media
    // orthography inherits: ⟨c⟩ before e/i/y → /s/ (once→wɔns, since→sins); elsewhere ⟨c⟩→k (the consonant map).
    // Naija phonemic spelling uses ⟨k⟩/⟨s⟩ (not ⟨c⟩), so this only ever touches English-etymological ⟨c⟩.
    const s = [...w.replace(/c(?=[eiy])/gu, "s").replace(/(.)\1+/gu, "$1")];
    let out = "";
    for (let i = 0; i < s.length; ) {
        const dg = (s[i] ?? "") + (s[i + 1] ?? "");
        if (DEF.digraphs[dg]) {
            out += DEF.digraphs[dg];
            i += 2;
            continue;
        }
        const c = s[i]!;
        if (c in DEF.consonants) out += DEF.consonants[c];
        else if (c in DEF.vowels) out += DEF.vowels[c];
        // else: unknown → skip
        i++;
    }
    return out;
}

/** One Naija word → canonical IPA. Order: (1) the Naija lexicon (respellings + substrate loans + irregulars);
 *  (2) if `known` resolves it as standard English → NATIVISE that (BBC-Pidgin text is mostly English spelling);
 *  (3) the nativising rule g2p (phonemically-spelled substrate loans: danfo, egusi). Segmental only — Naija tone
 *  is unmarked in the media orthography. `known` is omitted by the referee eval (rule path only; no referee).
 *
 *  ⚠ `Object.hasOwn`, NOT A BARE `DEF.lexicon[lw]`. The manifest is a `JSON.parse` object, so it inherits
 *  `Object.prototype` — and the bracket lookup walked the chain. ⟨constructor⟩ is ordinary vocabulary in this
 *  corpus's construction and road-contract copy, and `DEF.lexicon["constructor"]` resolved to the `Object`
 *  CONSTRUCTOR FUNCTION, which is `!== undefined`, so it was returned as the word's reading and template-
 *  concatenated into the clause: `Constructor dey come` shipped *function Object() { [native code] } dɛ kɔm*.
 *  JS source injected into the phoneme stream, not merely a wrong reading. Found reviewing the C# port, whose
 *  `TryGetValue` has no prototype chain and read it correctly all along — so the two engines DISAGREED on a
 *  real English word and the 200-row golden could not see it. */
export function phonemizeWord(word: string, known?: ForeignPhonemizer): string {
    const lw = word.toLowerCase();
    const lex = Object.hasOwn(DEF.lexicon, lw) ? DEF.lexicon[lw] : undefined;
    if (lex !== undefined) return lex;
    const en = known?.(lw);
    if (en !== undefined) return nativise(en).normalize("NFC");
    return scan(lw).normalize("NFC");
}

// ── Numbers (nativised English, simple compositor) ────────────────────────────
function numberWords(n: number): string {
    if (n < 0) return "";
    if (n < 10) return NUM.units[n]!;
    if (n < 20) return NUM.teens[n - 10]!;
    if (n < 100) {
        const t = Math.floor(n / 10),
            u = n % 10;
        return NUM.tens[t]! + (u ? " " + NUM.units[u] : "");
    }
    if (n < 1000) {
        const h = Math.floor(n / 100),
            r = n % 100;
        return `${NUM.units[h]} ${NUM.hundred}${r ? " " + NUM.and + " " + numberWords(r) : ""}`;
    }
    if (n < 1000000) {
        const th = Math.floor(n / 1000),
            r = n % 1000;
        return `${numberWords(th)} ${NUM.thousand}${r ? " " + numberWords(r) : ""}`;
    }
    // The chain stopped at tauzin, so 10⁶+ leaked the raw digits into the IPA. English-lexified, so the scales are
    // the English ones read in Naija phonology (miliọn / biliọn — see naija.jsonc).
    for (const [value, scale] of [[1_000_000_000, NUM.billion], [1_000_000, NUM.million]] as const) {
        if (n >= value) {
            const q = Math.floor(n / value),
                r = n % value;
            return `${numberWords(q)} ${scale}${r ? " " + numberWords(r) : ""}`;
        }
    }
    return String(n); // beyond the compositor → leave as digits
}

/**
 * ORDINALS. `1st` used to reach the g2p as the WORD `st` and read *stɾit* ("street"), so `1st place` was
 * *wan stɾit ples* — a wrong-word defect, 26 of them in the mined corpus. The productive rule is `nɔmba` +
 * the CARDINAL (APiCS survey 17), with suppletive forms for 1-3; see naija.jsonc for the sourcing.
 */
function ordinalWords(n: number): string {
    if (n === 1) return ORD.first;
    if (n === 2) return ORD.second;
    if (n === 3) return ORD.third;
    return `${ORD.marker} ${numberWords(n)}`;
}

/**
 * INITIALISMS ARE LETTER-SPELLINGS UNLESS LEXIFIED. `FC` scanned as a word gave the unpronounceable *fk*,
 * and `A.I.` split on the dots so ⟨I⟩ hit the pcm pronoun lexicon and read *a*. The LEXIFIED test is the
 * English dict: it already carries the ones pronounced as words (FIFA fˈɪfɑː, NEPA nˈiːpə) AND the ones
 * conventionally spelled out (APC ˈeᶦpʰˈiːsˈiː, BBC, TV, DJ, CD), so a dict hit is nativised as usual and
 * only a MISS is spelled letter by letter — which is what rescues FC, LGA, PSV, YBNL.
 * ⚠ The known cost: UEFA (×3 in corpus) is not in the dict, so it spells out. It is genuinely ambiguous
 * and the rule chosen here is "letter-spelling unless lexified", so this is the specified behaviour rather
 * than an oversight; lexifying it is a one-line lexicon entry if a source turns up.
 */
/**
 * ⚠ A DICT MISS IS NOT ENOUGH — it must also be UNPRONOUNCEABLE. Gating on the dict alone spelled out 87 of
 * the corpus's 133 all-caps types, and while most were wins (FC *fk*→*ɛf si*, PDP, PSV, YBNL, RCCG), eight
 * were word-acronyms the base engine already read correctly: COVID → *si o vi ai di*, plus ABIA (a state),
 * BOGA (a language), AFCON, APGA, INEC, AIBA, NADECO. Requiring NO VOWEL LETTER keeps every consonant-only
 * win and rescues all eight, because a run with no vowel cannot be a syllable.
 * ⚠ THE COST, stated: a vowel-bearing letter-acronym (LGA, PGA, AG) keeps reading as a word — unchanged
 * from the base engine, so a smaller win rather than a regression. DOTTED forms are unaffected: the dots
 * are an explicit instruction and are handled on their own branch.
 */
const isInitialism = (w: string): boolean => /^\p{Lu}{2,6}$/u.test(w) && !/[AEIOU]/u.test(w);

const spellOut = (w: string): string[] =>
    [...w.toLowerCase()].map((c) => LETTER[c]).filter((x): x is string => x !== undefined);

/**
 * TIMES follow the English pattern with pcm number words — hour then minutes — until a better-sourced
 * model turns up (⚠ PROVISIONAL, and stated as such: no pcm source for clock-reading was found; the one
 * phrasebook hit uses an orthography, *twu/tiri/sevun*, that contradicts this engine's own numerals).
 * `:00` is the bare hour, and a minute under ten keeps its zero (5:05 → *faiv ziɾo faiv*) rather than
 * borrowing English's "oh", which would be an unsourced word.
 */
function timeWords(h: number, mm: number): string[] {
    const out = numberWords(h).split(" ");
    if (mm === 0) return out;
    if (mm < 10) return [...out, NUM.units[0]!, NUM.units[mm]!];
    return [...out, ...numberWords(mm).split(" ")];
}

// ⚠ ALL OF LATIN, not just ASCII — `[A-Za-z]+` ended the token at a diacritic, so the letter carrying it became
// an unclaimed gap read as an English LETTER NAME and the rest of the word started over: `São Paulo` read
// *ɛs ˈə o pɔlo* ("ES ə O") and `Cañitas` *kɔ ˈɛn itas*. One word became three. Invisible to every gate: no digit
// or raw mark survives and nothing VANISHES, so it is a WRONG-WORD defect the leak and DROP classes cannot see.
// `\p{M}` so a DECOMPOSED accent stays with its base instead of ending the token one character later.
//
// ⚠ AND THAT IS THE WHOLE FIX HERE — deliberately NO native-vs-foreign routing, unlike id and om.
// This engine NATIVISES: the header states that the rule g2p is applied to English-spelled tokens rather than
// routed to the English phonemizer, because "nativising is more correct for the creole", and the evidence is in
// its own output — `water` → *wata*, `computer` → *kampjuta*, not English's *wˈɔːt̬ɚ* / *kəmpjˈuːt̬ɚ*. Sending an
// accented token to the foreign reader would contradict the engine's design, so the token is only made WHOLE and
// pcm's own g2p reads it, which is what the fragmentation was preventing.
//
// ⚠ THE NUMBER CLASS MUST SWALLOW THE SEPARATORS, or the clause branch claims them. `(\d+)` alone made the
// thousands COMMA and the decimal DOT clause marks, so `₦2,000` read *tu , ziɾo* — "two [pause] zero", the
// number destroyed — and `3.5` read *tɾi . faiv*. Both shapes are the corpus norm, not edge cases: the mined
// pcm corpus has 60 comma-grouped numbers and 61 dot-decimals. Same class as Hausa's, and for the same reason.
//
// ⚠ ORDER IS LOAD-BEARING. Time before the number class (else `5:30` splits and the `:` becomes a pause);
// the ordinal before the Latin run (else `1st` splits and ⟨st⟩ nativises to *stɾit*, "street"); the dotted
// initialism before it too (else `A.I.` splits on the dots and ⟨I⟩ hits the pcm PRONOUN lexicon → *a*).
const TOKEN = new RegExp(
    `(?<![\\d:])(\\d{1,2}):([0-5]\\d)(?![\\d:])` +
        `|(\\d+)(?:st|nd|rd|th|ST|ND|RD|TH)(?![\\p{L}])` +
        `|((?:\\p{L}\\.){2,})` +
        `|(${LATIN_RUN})` +
        `|([1-9]\\d{0,2}(?:,\\d{3})+(?:\\.\\d+)?|\\d+\\.\\d+|\\d+)` +
        `|([.?!,;:])`,
    "gu",
);

/**
 * SYMBOL TIER. pcm was flagged PCT-DROP and CUR-DROP by tools/normalization/audit.ts — `50%` read exactly
 * like `50` and `$5` exactly like `5`, so the sign contributed nothing and nothing downstream marked the
 * loss. Every word here is attested IN THE MINED pcm CORPUS (tools/corpus/mined/pcm.jsonc), which is
 * dump-sourced, so the counts are real rates rather than an artifact of a search.
 */
const SYMBOLS = makeSymbolNormalizer({
    // ⚠ ⟨percent⟩ IS THE ONE WORD HERE NOT CARRIED BY THE MINED CORPUS — it has 27 `%` signs but only ONE
    // instance of the word. (An earlier count of ×9 was wrong: the grep was matching the corpus's own
    // "cell": "percent" LABELS, i.e. its metadata, not its text.) Sourced instead from pcm.wikipedia the way
    // ⟨kilomita⟩/⟨mita⟩ were — "85 percent" (Yuganda), "reduce by about 0.87 percent" (Climate change in
    // Zambia). The sign follows the number in every corpus instance ("35%", "87.14%", "70%"), this tier's
    // default, so no `percentPrefix`.
    percent: ["percent"],
    // ⚠ THE CURRENCY WORD IS ⟨dolla⟩, NOT ⟨dollar⟩. The corpus writes ⟨Dolla⟩ ×2 ("$12.4 Billion Dolla")
    // against ⟨dollars⟩ ×1 — the English spelling is the minority form here, and the sourcing rule is the
    // language's own word, so ⟨dolla⟩ ships. ⟨Naira⟩/⟨naira⟩ ×5 against 3 `₦` signs.
    // ⚠ `US$` IS DECLARED SEPARATELY AND IS NOT REDUNDANT: the tier's currency match is letter-bounded on
    // the left so a bare `$` cannot match after a letter, and pcm writes `US$` ×6 against a bare `$` ×14 —
    // undeclared, every `US$2 Million` would have kept its sign. This is the compound-key case the
    // normalize-multilang suite records as the intended fix rather than a limitation.
    // ⚠ `US$` TAKES THE SAME WORD, NOT "US dolla": this engine nativises ⟨US⟩ as the English pronoun *us*
    // → [ɔs], so spelling the code out shipped `US$2` as *tu ɔs dola*. The code is orthographic here and
    // goes unvoiced; the compound key exists for the LEFT-BOUNDARY match, not to add a word.
    currency: { "US$": ["dolla"], $: ["dolla"], "₦": ["naira"] },
    // The corpus writes the magnitude in ENGLISH spelling next to the sign — "$12.4 Billion", "₦200
    // Million", "US$2 Million" (million ×25, billion ×13) — so these are the forms the tier must hop.
    // ⚠ THE CAPITALISED FORMS ARE DECLARED SEPARATELY AND ARE NOT REDUNDANT. The tier builds `magnitudes`
    // into a case-SENSITIVE alternation, and this corpus capitalises 8 of its 38 magnitude words (they
    // follow a currency sign, where English style capitalises). Undeclared, `₦200 Million` failed the hop
    // and read *tu hɔndɛd nɛɾa miljan* — "two hundred naira million", the magnitude stranded after the
    // currency noun — while the lowercase `₦200 million` was already correct. A language whose corpus never
    // capitalises them needs only the one form.
    // ⚠ ⟨Thousand⟩ WAS MISSING AND HAD THE SAME DEFECT, found by an off-golden probe while porting to C#.
    // The corpus writes `US$500 Thousand` (×1, in the same sentence as the `US$2 Million` that motivated
    // the entry above), and undeclared it read *faiv hɔndɛd dola tauzand* — "five hundred dollar thousand",
    // the stranded-magnitude shape this list exists to prevent, one scale down. NO NEW WORD IS SOURCED: the
    // hop only reorders text the corpus already writes, and ⟨Thousand⟩ nativises through the English dict
    // exactly as ⟨Million⟩ does. The lowercase form is ×0 here and is declared anyway, because the
    // alternation is case-SENSITIVE and the two spellings are one word — leaving one out would make the
    // reading depend on whether the writer capitalised, which is not a distinction this language draws.
    magnitudes: ["million", "billion", "Million", "Billion", "thousand", "Thousand"],
    // `&` ×24. The word is ⟨an⟩, this language's own conjunction and the one its number compositor already
    // uses (`numbers.and` in the manifest). ⚠ The corpus writes BOTH ⟨an⟩ ×425 and English ⟨and⟩ ×233; ⟨an⟩
    // is chosen for consistency with the manifest rather than by margin alone.
    ampersand: "an",
    // UNITS. The mined corpus has 29 unit-bearing numbers and ZERO spelled-out unit words, so the words had
    // to come from outside it: pcm.wikipedia writes ⟨kilomita⟩ ("85 kilomita fom di main kampos", "200
    // kilomita from Bilabrin") and ⟨mita⟩ ("di 100 mita race", "3 mitas … rish 1 mita").
    // ⚠ ONLY THE TWO THAT ARE ATTESTED. ⟨kilogram⟩, ⟨kilo⟩ and ⟨sentimita⟩ each return ZERO hits there, so
    // kg/cm stay undeclared rather than extrapolated — and the cost of guessing is concrete, since this
    // engine's nativisation reads English ⟨kilometer⟩ as [kalamata].
    // ⚠ RE-OPENED AND RE-REFUSED, INCLUDING ⟨ft⟩, WHICH IS THE INTERESTING ONE. The mined artifact leaks
    // `ft` ×3 (`29,031.7ft`, `330ft`, `114000 sq ft`), `kg` ×1 (`75kg`) and `nm` ×1 (`500nm thick`), so all
    // three shapes are real. `attest.ts --lang pcm`: `kilogram` 0, `kilo` 0, `nanomita` 0 — the refusal
    // above, re-measured. And `fut` comes back ATTESTED, 4 tokens / 2 articles, WHICH IS THE TRAP: every
    // one of the four is `fut-bola` / `fut-bol`, FOOTBALL (*"na profeshunal fut-bola, im dey pley
    // centa-bak"*). `fit` ×116 is the modal verb "can", not the foot either. This is the Fula `tere` shape
    // exactly — a token count that says *attested* about a different word — and a grep would have shipped
    // it. So the imperial length keeps leaking visibly, which is the honest side to fail on.
    units: { km: ["kilomita"], m: ["mita"] },
});

/**
 * NATIVISE a foreign name: fold an out-of-inventory accent to a base this g2p has a rule for. `NATIVE_WORD`
 * above is the inventory — a word it rejects carries a letter this language does not use. See
 * `core/hostWord.ts` for why the inventory and the script boundary are two different questions.
 */

class NaijaPhonemizer implements Phonemizer {
    // `foreign` = the English DICT lookup (knownWord): a known-English word is nativised, an OOV one (substrate
    // loan) falls through to the rule g2p. Wired in the registry from the English module.
    constructor(private foreign?: ForeignPhonemizer) {}
    text(input: string): string {
        return assembleClauses(SYMBOLS(normalizeNaija(input)), TOKEN, (m, sink) => {
            if (m[1] !== undefined && m[2] !== undefined) {
                for (const wd of timeWords(Number(m[1]), Number(m[2]))) sink.emit(wd);
            } else if (m[3]) {
                // ⚠ ABOVE 2^53 THE RAW ASCII DIGITS USED TO BE EMITTED STRAIGHT INTO THE IPA. Refusing to
                // COMPOSE is right (the float has already lost the low digits); emitting the token is not a
                // reading. The ORDINAL fallback keeps the marker and reads the digits after it — `ordinalWords`
                // is itself `marker + numberWords`, so nothing new is invented; only the quantity is lost.
                //
                // ⚠ AND THE FALLBACK WAS DEAD CODE UNTIL THE BRACES WENT IN — a DANGLING ELSE. Written
                // brace-free, `if (safe) for (…) if (wd) emit(wd); else { … }` parses the `else` onto the
                // INNER `if (wd)`, not onto the safety test: above 2^53 the whole `for` was skipped and the
                // ordinal was DELETED from the reading (`9007199254740993rd item` → *aitam*), which is the
                // exact defect the paragraph above says this branch exists to prevent. The safe path never
                // reached it — `ordinalWords` cannot yield an empty word — so it failed only where it was
                // the only thing standing between the numeral and silence.
                const n = Number(m[3]);
                if (Number.isSafeInteger(n)) {
                    for (const wd of ordinalWords(n).split(" ")) if (wd) sink.emit(wd);
                } else {
                    sink.emit(ORD.marker);
                    for (const d of m[3]) sink.emit(NUM.units[Number(d)]!);
                }
            } else if (m[4]) {
                // dotted initialism — the dots ARE the instruction to spell it out
                for (const ph of spellOut(m[4].replace(/\./gu, ""))) sink.emit(ph);
            } else if (m[5]) {
                const w = foldLatinToBase(m[5]);
                // A bare ALL-CAPS run is an initialism unless the dict lexifies it (see spellOut's note).
                // `hasOwn` for the same reason `phonemizeWord` uses it. Unreachable as written — `isInitialism`
                // admits only vowel-less 2-6 letter runs — but the guard is what keeps widening it safe.
                if (isInitialism(w) && !Object.hasOwn(DEF.lexicon, w.toLowerCase()) && this.foreign?.(w.toLowerCase()) === undefined)
                    for (const ph of spellOut(w)) sink.emit(ph);
                else sink.emit(phonemizeWord(w, this.foreign));
            } else if (m[6]) {
                // Strip the thousands commas the TOKEN now swallows, then split off a decimal tail.
                const [int = "", frac] = m[6].replace(/,/gu, "").split(".");
                const n = Number(int);
                // numberWords already yields canonical IPA (the number words are media-spelled loans given
                // directly as IPA in the manifest) — emit them, don't re-run the g2p.
                if (Number.isSafeInteger(n)) {
                    for (const wd of numberWords(n).split(" "))
                        if (wd) sink.emit(wd);
                    // A decimal tail is read DIGIT BY DIGIT after the separator word (1.50 → "wan pɔint faiv
                    // ziɾo"), the house convention — `core/numbers.ts` `decimalWord` does the same for the
                    // languages that declare one. Reading it as a whole number would say "fifty".
                    if (frac !== undefined && frac !== "") {
                        sink.emit(NUM.point);
                        for (const d of frac) sink.emit(NUM.units[Number(d)]!);
                    }
                } else {
                    // ⚠ ABOVE 2^53 the token itself used to be emitted. `NUM.units` is already how the
                    // decimal tail just above is read, so the digit-at-a-time fallback is the house
                    // convention applied to the whole numeral — including any tail, which the old branch
                    // dropped along with everything else.
                    for (const d of m[6].replace(/,/gu, "")) {
                        if (d === ".") sink.emit(NUM.point);
                        else sink.emit(NUM.units[Number(d)]!);
                    }
                }
            } else if (m[7]) {
                const mk = CLAUSE_MARK[m[7]];
                if (mk) sink.pause(mk);
            }
        });
    }
}

/** Build the Nigerian Pidgin phonemizer. `foreign` (English) is available for code-switch but not auto-used. */
export function createNaija(foreign?: ForeignPhonemizer): Phonemizer {
    return new NaijaPhonemizer(foreign);
}
