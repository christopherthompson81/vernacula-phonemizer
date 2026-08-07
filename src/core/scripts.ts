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
 * ⚠ KNOWN LIMIT, recorded rather than guessed at: a LONE Greek letter in a Latin-script text is usually
 * MATHEMATICS (α, β, π, Δ) and should be read as the host language's letter name — "alpha", "pi" — not as
 * a Greek word. This router has no way to tell that from a one-letter Greek word, so it requires a run of
 * two or more before routing to Greek, and a single stray letter stays dropped as it was. Doing better
 * needs a per-host letter-name table, which is lexical data and belongs in the host language.
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

/** The script of a run, or `undefined` if it carries no letters this router knows. */
/**
 * Script declarations for the codes that have NO `.jsonc` manifest of their own — the complement of the
 * manifests, so that (manifests ∪ this) covers every registered code exactly once. Three reasons a code lands
 * here, and none of them is an oversight:
 *
 *   · a VARIETY of another language (the nine Arabic dialects) — the engine and its manifest belong to `ar`;
 *   · an ACCENT VARIANT (en-GB, en-IN, fr-CA, pt-BR, es-419) or an ALIAS (ms/zsm, bgc, pnb, skr) — the
 *     manifest it reuses names its PARENT, not this code;
 *   · a single-`.ts` engine with no data to externalise (ab, chr, la, lo, sat, …) — there is no manifest to
 *     put a field in.
 *
 * ⚠ Kept here rather than by minting one-field manifests: a manifest exists to hold DATA, and a file whose
 * only content is its own script name is a worse record than a line in a table that can be read end to end.
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
    // Single-.ts engines with no manifest.
    ab: ["Cyrillic"], ba: ["Cyrillic"], chv: ["Cyrillic"], nog: ["Cyrillic"], tt: ["Cyrillic"],
    bo: ["Tibetan"], chr: ["Cherokee"], grc: ["Greek"], lo: ["Lao"], sat: ["Ol Chiki"],
    shn: ["Myanmar"],                       // the Shan abugida is a Myanmar-script variant (U+1075–U+108F)
    crh: ["Latin"], ee: ["Latin"], eu: ["Latin"], fo: ["Latin"], kaa: ["Latin"], kl: ["Latin"],
    la: ["Latin"], ltg: ["Latin"], mto: ["Latin"], naq: ["Latin"], nci: ["Latin"], pap: ["Latin"],
    quc: ["Latin"], rup: ["Latin"], smj: ["Latin"],
};

/**
 * Languages whose PRIMARY script is Cyrillic — the tie-break for `foldCyrillicConfusables`, which needs to know
 * whether the HOST language is Cyrillic when a word's own letters split evenly (`рaсa`, 2 and 2).
 *
 * ⚠ THIS CANNOT BE DERIVED FROM THE MANIFESTS ALONE, and the gap is why it is written out here. Only 136 of the
 * engines ship a `.jsonc` at all — ab, ba, chv, nog and tt are pure `.ts` engines with no manifest to declare
 * anything — so a manifest scan finds 10 of the 15 and silently misses five real Cyrillic languages. The
 * manifests stay authoritative WHERE THEY EXIST: test/cyrillic-confusables.test.ts asserts every manifest
 * declaring a Cyrillic-primary script appears here, so a new one cannot be forgotten, and names the
 * manifest-less five explicitly so the extra entries are accounted for rather than unexplained.
 *
 * `sr` and `kk` declare "Cyrillic/Latin" and are included — Cyrillic leads, so it is the primary. `bs` declares
 * "Latin + Cyrillic" and `uz` "Latin/Cyrillic", both Latin-led, and are NOT included.
 */
export const CYRILLIC_HOSTS: ReadonlySet<string> = new Set([
    // declared Cyrillic-primary in a manifest
    "be", "bg", "kk", "ky", "mk", "mn", "ru", "sr", "tg", "uk",
    // no manifest exists — engine is a single .ts
    "ab", "ba", "chv", "nog", "tt",
]);

export function scriptOf(run: string): ScriptName | undefined {
    for (const [name, re] of SCRIPT_TESTS) if (re.test(run)) return name;
    return undefined;
}

/**
 * Which language should read `run`, given the host language reading the document. `undefined` means
 * "leave it dropped": either the script is unknown, or the answer is the host itself — which would mean
 * handing the engine back text its own tokenizer already declined, and recursing.
 */
export function readerFor(run: string, host: string): string | undefined {
    const script = scriptOf(run);
    if (script === undefined) return undefined;
    // See the KNOWN LIMIT above: one Greek letter in another script is far more likely mathematics.
    if (script === "Greek" && [...run].filter((c) => /\p{Script=Greek}/u.test(c)).length < 2) return undefined;
    const target = OVERRIDES[host]?.[script] ?? DEFAULT_READER[script];
    return target === host ? undefined : target;
}
