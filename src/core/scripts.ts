/**
 * SCRIPT ROUTING — which language reads a run of text in a script the host engine does not own.
 *
 * ⚠ WHY THIS EXISTS. `core/foreign.ts` alone gives every engine a fallback for embedded foreign text, but only
 * for LATIN — every other script in an unclaimed gap is dropped outright:
 *
 *   Cyrillic inside Greek      Ο Πούτιν και ο Владимир   →  "o putin ce o"        (Владимир GONE)
 *   Greek inside English       The word λόγος means word →  "ðə wˈɝd mˈiːnz wˈɝd" (λόγος GONE)
 *   Cyrillic inside Japanese   これは Москва です          →  Москва GONE
 *   Greek inside Thai          คำว่า Ελλάδα คือ           →  Ελλάδα GONE
 *   Latin inside Russian       Слово hello значит        →  works, because Latin is the special case
 *
 * ⚠ A DROPPED RUN IS INVISIBLE TO EVERY LEAK-BASED CHECK — nothing survives into the IPA to be flagged.
 *
 * THE MODEL: a DEFAULT READER PER SCRIPT, overridable per language. A script is a much better predictor
 * of language than nothing at all, and for several scripts it is nearly deterministic — Greek script is
 * Greek, Hangul is Korean, Thai is Thai. Where a script serves several languages the default is the one
 * that makes an arbitrary run most likely readable (Cyrillic → Russian, Latin → English, Devanagari →
 * Hindi), and any engine that knows better injects its own reader.
 *
 * ⚠ THE LONE GREEK LETTER — the limit this file used to record, and now reads. A lone Greek letter in
 * another script is usually MATHEMATICS (α, β, π, Δ) and wants its NAME — "alpha", "pi" — not a Greek
 * word's worth of phonology, so the router declined it and the letter was DELETED in 186 of 188 engines.
 * See `GREEK_LETTER_NAME` for what replaced that, and why the name did not need a per-host table.
 */

/** The scripts worth routing. Ordered longest-lived first; detection tries each in turn. */
export type ScriptName =
    | "Latin" | "Cyrillic" | "Greek" | "Han" | "Kana" | "Hangul" | "Arabic" | "Hebrew"
    | "Devanagari" | "Bengali" | "Tamil" | "Thai" | "Ethiopic" | "Armenian" | "Georgian" | "Myanmar"
    // ⚠ THIS SET MUST BE DERIVED FROM WHAT THE FLEET CAN READ — the registry, the language catalogue, the
    // README examples — never from recall. A script with an engine that is missing here does not fall back:
    // every run in it vanishes from the host language's output, silently.
    | "Telugu" | "Kannada" | "Malayalam" | "Gujarati" | "Gurmukhi" | "Oriya" | "Sinhala"
    | "Khmer" | "Lao" | "Tibetan" | "Tifinagh" | "Cherokee" | "Ol_Chiki"
    | "Adlam" | "Nko" | "Syloti_Nagri" | "Javanese" | "Sundanese";

const SCRIPT_TESTS: [ScriptName, RegExp][] = [
    ["Latin", /\p{Script=Latin}/u],
    ["Cyrillic", /\p{Script=Cyrillic}/u],
    ["Greek", /\p{Script=Greek}/u],
    // Kana BEFORE Han: Japanese text mixes them, and a run containing any kana is Japanese whatever else
    // it holds, whereas a Han-only run is ambiguous between Chinese and Japanese.
    ["Kana", /[\p{Script=Hiragana}\p{Script=Katakana}]/u],
    ["Han", /\p{Script=Han}/u],
    ["Hangul", /\p{Script=Hangul}/u],
    ["Arabic", /\p{Script=Arabic}/u],
    ["Hebrew", /\p{Script=Hebrew}/u],
    ["Devanagari", /\p{Script=Devanagari}/u],
    ["Bengali", /\p{Script=Bengali}/u],
    ["Tamil", /\p{Script=Tamil}/u],
    ["Thai", /\p{Script=Thai}/u],
    ["Ethiopic", /\p{Script=Ethiopic}/u],
    ["Armenian", /\p{Script=Armenian}/u],
    ["Georgian", /\p{Script=Georgian}/u],
    ["Myanmar", /\p{Script=Myanmar}/u],
    ["Telugu", /\p{Script=Telugu}/u],
    ["Kannada", /\p{Script=Kannada}/u],
    ["Malayalam", /\p{Script=Malayalam}/u],
    ["Gujarati", /\p{Script=Gujarati}/u],
    ["Gurmukhi", /\p{Script=Gurmukhi}/u],
    ["Oriya", /\p{Script=Oriya}/u],
    ["Sinhala", /\p{Script=Sinhala}/u],
    ["Khmer", /\p{Script=Khmer}/u],
    ["Lao", /\p{Script=Lao}/u],
    ["Tibetan", /\p{Script=Tibetan}/u],
    ["Tifinagh", /\p{Script=Tifinagh}/u],
    ["Cherokee", /\p{Script=Cherokee}/u],
    ["Ol_Chiki", /\p{Script=Ol_Chiki}/u],
    ["Adlam", /\p{Script=Adlam}/u],
    ["Nko", /\p{Script=Nko}/u],
    ["Syloti_Nagri", /\p{Script=Syloti_Nagri}/u],
    ["Javanese", /\p{Script=Javanese}/u],
    ["Sundanese", /\p{Script=Sundanese}/u],
];

/**
 * DEFAULT READER PER SCRIPT. Three tiers of confidence, and the comments say which is which, because a
 * near-deterministic mapping and a pragmatic guess should not look alike to whoever edits this next:
 *
 *   NEARLY DETERMINISTIC — the script serves essentially one language.
 *   DOMINANT            — several languages share it; this is the one an arbitrary run most likely is.
 *   PRAGMATIC           — genuinely contested; the choice maximises the chance of a readable result and
 *                         is expected to be overridden by any engine that has better information.
 */
export const DEFAULT_READER: Readonly<Record<ScriptName, string>> = {
    Greek: "el", // nearly deterministic
    Hangul: "ko", // nearly deterministic
    Thai: "th", // nearly deterministic
    Hebrew: "he", // nearly deterministic
    Armenian: "hy", // nearly deterministic
    Georgian: "ka", // nearly deterministic
    Myanmar: "my", // nearly deterministic
    Ethiopic: "am", // dominant (also Tigrinya)
    Kana: "ja", // nearly deterministic
    Latin: "en", // dominant — and already the de facto default at 44 registry call sites
    Cyrillic: "ru", // dominant
    Arabic: "ar", // dominant (also fa, ur, ps, sd — but MSA reads an arbitrary run best)
    Devanagari: "hi", // dominant (also mr, ne)
    Bengali: "bn", // dominant (also as)
    Tamil: "ta", // nearly deterministic
    Han: "cmn", // pragmatic — Japanese and Cantonese also write Han; see OVERRIDES
    // NEARLY DETERMINISTIC — one script, one major language, and the fleet has an engine for each.
    Telugu: "te",
    Kannada: "kn",
    Malayalam: "ml",
    Gujarati: "gu",
    Gurmukhi: "pa",
    Oriya: "or",
    Sinhala: "si",
    Khmer: "km",
    Lao: "lo",
    Tibetan: "bo",
    Tifinagh: "shi", // Tashelhit is the fleet's Tifinagh engine (Central Atlas Tamazight also uses it)
    Cherokee: "chr",
    Ol_Chiki: "sat",
    Adlam: "ff", // Fula, which the catalogue records as Latin/Adlam
    Nko: "bm", // the fleet's N'Ko engine is Bambara (Latin/N'Ko)
    Syloti_Nagri: "syl",
    Javanese: "jv", // Latin/Javanese — the native script routes to the same engine
    Sundanese: "su", // Latin/Aksara Sunda
};

/**
 * PER-LANGUAGE OVERRIDES: host language → the reader IT wants for a given script. This is the "overridable
 * per language" half, and the Han row is the reason it has to exist — a Han run inside Japanese text is
 * Japanese, not Mandarin, and inside Korean text is hanja read as Korean.
 */
export const OVERRIDES: Readonly<Record<string, Partial<Record<ScriptName, string>>>> = {
    ja: { Han: "ja" },
    ko: { Han: "ko" }, // hanja in Korean text is read with Korean readings
    yue: { Han: "yue" },
    // A Cyrillic run inside Ukrainian or Serbian text is that language's own, not Russian — those engines
    // claim their script anyway, so this only matters for characters outside their own alphabet.
    uk: { Cyrillic: "uk" },
    sr: { Cyrillic: "sr" },
    fa: { Arabic: "fa" },
    ur: { Arabic: "ur" },
    mr: { Devanagari: "mr" },
    ne: { Devanagari: "ne" },
};

/**
 * Script declarations for the codes that have NO `.jsonc` manifest of their own — the complement of the
 * manifests, so that (manifests ∪ this) covers every registered code exactly once. Two reasons a code lands
 * here, and both are deliberate:
 *
 *   · a VARIETY of another language (the nine Arabic dialects) — the engine and its manifest belong to `ar`;
 *   · an ACCENT VARIANT (en-GB, en-IN, fr-CA, pt-BR, es-419) or an ALIAS (ms/zsm, bgc, pnb, skr) — the
 *     manifest it reuses names its PARENT, not this code.
 *
 * Every LANGUAGE engine declares its script in its own manifest (#741 gave the last 26 theirs), so a new row
 * here should only ever be a variety or an alias.
 *
 * test/manifest-script.test.ts asserts the union is exact in BOTH directions, so a new engine cannot be added
 * without landing in one place or the other, and a stale row here cannot outlive its code.
 */
export const MANIFESTLESS_SCRIPTS: Readonly<Record<string, readonly string[]>> = {
    // Arabic varieties — the shared `ar` engine plus a VarietyDef delta.
    acm: ["Arabic"], acw: ["Arabic"], afb: ["Arabic"], ajp: ["Arabic"], apc: ["Arabic"],
    apd: ["Arabic"], ary: ["Arabic"], arz: ["Arabic"], ayl: ["Arabic"],
    // Accent variants — a post-process on the parent engine's output.
    "en-GB": ["Latin"], "en-IN": ["Latin"], "es-419": ["Latin"], "fr-CA": ["Latin"], "pt-BR": ["Latin"],
    // Aliases and close siblings riding another language's engine.
    ms: ["Latin"], zsm: ["Latin"],          // Malay / Standard Malay
    bgc: ["Devanagari"],                    // Haryanvi, on the Hindi engine
    pnb: ["Arabic"], skr: ["Arabic"],       // Western Punjabi + Saraiki, both Shahmukhi
    // Southern/Kandahari Pashto — the MEMBER code for the engine `ps` also resolves to. `pus` is a
    // macrolanguage (pbt/pbu/pst) and src/languages/pashto/ implements the Southern variety only, so `pbt` is
    // the accurate code; the manifest declares `ps`, which is why this one needs a row here.
    pbt: ["Arabic"],
};

/**
 * Languages whose PRIMARY script is Cyrillic — the tie-break for `foldCyrillicConfusables`, which needs to know
 * whether the HOST language is Cyrillic when a word's own letters split evenly (`рaсa`, 2 and 2).
 *
 * The manifests are authoritative — every Cyrillic-led entry here has a manifest whose `script` array leads
 * with "Cyrillic" — but the set is written out rather than derived at import time so that the fold does not
 * pay a 190-file directory scan on startup. test/cyrillic-confusables.test.ts asserts the two agree in both
 * directions, so a new Cyrillic-primary manifest cannot be forgotten and a stale entry cannot linger.
 *
 * `sr` and `kk` declare "Cyrillic/Latin" and are included — Cyrillic leads, so it is the primary. `bs` declares
 * "Latin + Cyrillic" and `uz` "Latin/Cyrillic", both Latin-led, and are NOT included.
 */
export const CYRILLIC_HOSTS: ReadonlySet<string> = new Set([
    "ab", "ba", "be", "bg", "chv", "kk", "ky", "mk", "mn", "nog", "ru", "sr", "tg", "tt", "uk",
]);

/** The script of a run, or `undefined` if it carries no letters this router knows. */
export function scriptOf(run: string): ScriptName | undefined {
    for (const [name, re] of SCRIPT_TESTS) if (re.test(run)) return name;
    return undefined;
}

/**
 * THE LONE GREEK LETTER, AND WHY ITS NAME IS SPELLED IN GREEK.
 *
 * A run of two or more Greek letters is Greek text and routes to the Greek reader: si's `Παν` reads *pan*.
 * A run of ONE was declined — and a declined run is a DELETED run, because `emitUnclaimed`'s only
 * fall-through is the Latin-to-English path and a Greek letter is not Latin. Measured across the fleet:
 * **the letter vanished in 186 of 188 engines** (the two exceptions being Greek itself, which owns the
 * script, and Ancient Greek). That is gd's `γ-iarann` → *ˈiərˠən̪ˠ*, both of sn's lone letters, and the
 * reason six Greek HTML entities were declined from `core/markup.ts`'s table: decoding `&gamma;` would have
 * fed the decoder's output straight into this deletion, so which entities were safe to add depended on
 * which letters a corpus happened to reach for.
 *
 * ⚠ ROUTING THE LONE LETTER AS GREEK TEXT IS THE WRONG FIX, and is why the threshold was there. `α` in
 * "the value is α" is not a Greek word being quoted, it is a mathematical symbol, and its reading is the
 * LETTER NAME. A phone (`γ` → /ɣ/) would be a wrong reading where there had been a silence, which is the
 * worse trade.
 *
 * ⚠ AND THE NAME DOES NOT NEED A PER-HOST TABLE — the objection that kept this unfixed. The name of a Greek
 * letter is a GREEK WORD; the international names (alpha, beta, delta, sigma) ARE those words borrowed. So
 * the letter's own script supplies its own lexical data, one table for all 193 engines instead of 193
 * tables, and the Greek engine speaks it: ⟨α⟩ → «άλφα» → *alfa*, ⟨π⟩ → «πι» → *pi*, ⟨Δ⟩ → «δέλτα» →
 * *ðelta*, ⟨σ⟩ → «σίγμα» → *siɣma*. Reading an embedded run with the phonology of the script's own language
 * is exactly what this router already does everywhere else — a Cyrillic name inside Greek is read as
 * Russian, not transliterated into Greek — so the lone letter is now the same rule, not a special case.
 *
 * ⚠ THE ACCENT IS THE DISCRIMINATOR, AND IT WAS MEASURED, NOT REASONED. The one-letter GREEK WORD is the
 * real ambiguity — `ή` "or", `ὁ`/`ἡ` the article — and reading those as letter names would be a wrong
 * reading put where a silence had been, which is the worse trade. A census of every lone Greek letter in
 * all 162 mined artifacts separates the two populations with nothing left over:
 *
 *   MATHEMATICS, ~34 languages, and every instance BARE — an `α Scorpii` (an), `Ψ 1 und … Ψ 2` (bar),
 *   `圓周率，一般用 π 表示` (gan), `π × i` (gd), `χ² kritēriju` (lv), `[Ω m]`, `Φ से प्रदशित` (mag), `δ(G)`
 *   (mn), `α, β, γ радиоактивдүүлүк` (ky), `θ बलके दिशा` (mag), `μ = np` (su), `λ′ − λ` (skr).
 *   GREEK PROSE, 2 languages, and every instance ACCENTED — crh's `ἡ θάλασσα` ×5 (the article, quoted from
 *   Ancient Greek) and lg's `Ελευθερία ή θάνατος` (the conjunction "or").
 *
 * A mathematical symbol is never written with a Greek accent or breathing; a Greek one-letter word always
 * is. So the lone letter is named only when it is BARE, and an accented one stays declined exactly as it
 * was — the two cost cases above are unchanged by this fix rather than newly mis-read.
 *
 * ⚠ BOTH CASES, ONE NAME. `Δ` is the commonest lone letter of all in mathematics, and ⟨ς⟩ final sigma is
 * the same letter as ⟨σ⟩, so the lookup lowercases. It does NOT strip accents — see above. Names are the
 * modern Greek ones as the Greek Wikipedia's own alphabet article spells them.
 */
// prettier-ignore
const GREEK_LETTER_NAME: Readonly<Record<string, string>> = {
    α: "άλφα", β: "βήτα", γ: "γάμμα", δ: "δέλτα", ε: "έψιλον", ζ: "ζήτα", η: "ήτα", θ: "θήτα",
    ι: "ιώτα", κ: "κάππα", λ: "λάμδα", μ: "μι", ν: "νι", ξ: "ξι", ο: "όμικρον", π: "πι",
    ρ: "ρο", σ: "σίγμα", ς: "σίγμα", τ: "ταυ", υ: "ύψιλον", φ: "φι", χ: "χι", ψ: "ψι", ω: "ωμέγα",
};
const GREEK_LETTER = /\p{Script=Greek}/u;

/**
 * The name of the ONE BARE Greek letter in `run` — `undefined` if the run holds none, holds several, or
 * holds one that carries an accent or breathing, which is the Greek-prose signal (see the table above).
 */
function loneGreekLetterName(run: string): { letter: string; name: string } | undefined {
    const letters = [...run].filter((c) => GREEK_LETTER.test(c) && !/\p{M}/u.test(c));
    if (letters.length !== 1) return undefined;
    const letter = letters[0]!;
    // NFD, so a PRECOMPOSED accent (`ή` U+03AE) is caught as surely as a combining one (`ἡ` U+1F21). A run
    // whose letter is followed by a loose combining mark fails the `length !== 1` test above already.
    const nfd = letter.normalize("NFD");
    if (nfd.length !== 1) return undefined;
    const name = GREEK_LETTER_NAME[nfd.toLowerCase()];
    return name === undefined ? undefined : { letter, name };
}

/**
 * Which language should read `run`, given the host language reading the document, and WHAT TEXT it should
 * be handed. `undefined` means "leave it dropped": either the script is unknown, or the answer is the host
 * itself — which would mean handing the engine back text its own tokenizer already declined, and recursing.
 *
 * `text` differs from `run` only for the lone Greek letter, which is rewritten to its NAME — see
 * `GREEK_LETTER_NAME`. Returning the pair rather than just the target is what keeps that rewrite a fact
 * about the SCRIPT, next to the table that states it, instead of a special case in the registry's callback.
 */
export function readerFor(run: string, host: string): { target: string; text: string } | undefined {
    const script = scriptOf(run);
    if (script === undefined) return undefined;
    let text = run;
    if (script === "Greek" && [...run].filter((c) => GREEK_LETTER.test(c)).length < 2) {
        const named = loneGreekLetterName(run);
        // An unnamed lone symbol (an archaic letter, an accented one, a lone combining mark) stays
        // declined, exactly as the whole class was before this existed.
        if (named === undefined) return undefined;
        // ⚠ SUBSTITUTED IN PLACE, not substituted FOR the run. `FOREIGN_RUN` carries a trailing superscript
        // and a joining hyphen along with the letter (`χ²`, gd's `γ-`), and replacing the whole run would
        // delete those before the reader ever saw them — trading one silent deletion for a smaller one.
        // (What the reader then does with them is its own business: `el` reads `χ²` as *çi* today either
        // way. The point is that this function stops making that decision on its behalf.)
        text = run.replace(named.letter, named.name);
    }
    const target = OVERRIDES[host]?.[script] ?? DEFAULT_READER[script];
    return target === host ? undefined : { target, text };
}
