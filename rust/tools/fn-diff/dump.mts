// Dump TypeScript outputs for one module-level function over a probe set, as JSONL, for the Rust replay
// in src/main.rs. Strings are encoded as arrays of UTF-16 code units so a lone surrogate survives.
//
//   npx tsx rust/tools/fn-diff/dump.mts <name> > .probe/rust/<name>.jsonl
import { readFileSync } from "node:fs";
import { MANIFEST } from "../../../src/languages/english/manifest.ts";
import { makeArpabetToIpa } from "../../../src/languages/english/englishArpabet.ts";
import { loadTsvMap, loadLines } from "../../../src/core/loadTsv.ts";
import { loadJson } from "../../../src/core/loadManifest.ts";
import { PosTagger, type PosModel } from "../../../src/languages/english/posTagger.ts";
import { americanSpelling } from "../../../src/languages/english/spellingVariants.ts";
import { numberToWords, ordinalToWords } from "../../../src/languages/english/numbers.ts";
import { rpWordTransform, toRP } from "../../../src/languages/english-gb/english-gb.ts";
import { createEnglish } from "../../../src/languages/english/english.ts";
import { createEnglishG2p, type EnglishG2pModel } from "../../../src/languages/english/englishG2p.ts";

import { normalizeEnglish, normalizeEnglishInitialisms } from "../../../src/languages/english/normalize.ts";

const units = (s: string): number[] => Array.from({ length: s.length }, (_, i) => s.charCodeAt(i));

const FLEURS_ROOT = "/mnt/data/omnivoice_ipa/corpus/fleurs_transcripts/data";
/** The FLEURS transcript directory for a language code. */
const FLEURS_DIR: Record<string, string> = {
    en: "en_us", "en-GB": "en_us", es: "es_419", "es-419": "es_419", fr: "fr_fr", hi: "hi_in", it: "it_it",
    "pt-BR": "pt_br", pt: "pt_br", ja: "ja_jp", cmn: "cmn_hans_cn",
};

/**
 * A language's inputs, deduplicated, each tagged with the first source it came from: its goldens' text column,
 * its FLEURS transcripts (⚠ COLUMNS 3 AND 4 — column 2 is a WAV filename) and its probe files (`\n` and
 * `\u{XXXX}` escapes decoded).
 * ⚠ LOUD ON A MISSING SOURCE. A golden or FLEURS file that is named but absent throws, and so does a language
 * with neither: a dump of zero rows replays as "0 DIFFER" and proves nothing. Only a probe file may be absent.
 */
function textsFor(goldens: readonly string[], fleursDir: string | undefined, probes: readonly string[]): Map<string, string> {
    const out = new Map<string, string>();
    const add = (t: string, src: string): void => { if (t !== "" && !out.has(t)) out.set(t, src); };
    for (const g of goldens)
        for (const row of readFileSync(new URL(`../../../csharp/goldens/${g}.tsv`, import.meta.url), "utf8").split("\n"))
            add(row.split("\t")[0] ?? "", "golden");
    if (fleursDir !== undefined)
        for (const split of ["train", "dev", "test"])
            for (const row of readFileSync(`${FLEURS_ROOT}/${fleursDir}/${split}.tsv`, "utf8").split("\n")) {
                const cols = row.split("\t");
                add(cols[2] ?? "", "fleurs");
                add(cols[3] ?? "", "fleurs");
            }
    for (const file of probes) {
        let text: string;
        try { text = readFileSync(new URL(`./probes/${file}`, import.meta.url), "utf8"); } catch { process.stderr.write(`note: no probes/${file}\n`); continue; }
        for (const line of text.split("\n")) {
            if (line === "" || line.startsWith("#")) continue;
            add(line.replace(/\\n/g, "\n").replace(/\\u\{([0-9a-fA-F]+)\}/g, (_m, h: string) => String.fromCodePoint(parseInt(h, 16))), "probe");
        }
    }
    if (out.size === 0) throw new Error(`no input text for goldens=${goldens.join(",")} fleurs=${fleursDir}`);
    return out;
}

/** English's normalizer inputs: all three English goldens, FLEURS en_us and the normalizer probes. */
function englishTexts(): Map<string, string> {
    return textsFor(["en", "en-GB", "en-IN"], "en_us", ["en-normalize.txt"]);
}

/** Every distinct text for `lang` (English keeps `englishTexts()`). A language needs a golden. */
function langTexts(lang: string): string[] {
    if (lang === "en" || lang === "en-GB") return [...englishTexts().keys()];
    return [...textsFor([lang], Object.hasOwn(FLEURS_DIR, lang) ? FLEURS_DIR[lang] : undefined, [`${lang}.txt`]).keys()];
}
/** `LANGS=es,fr` (default: en,en-GB) for the end-to-end dumps. */
const LANGS = (process.env.LANGS ?? "en,en-GB").split(",").filter((l) => l !== "");

// ── Mandarin helpers ──────────────────────────────────────────────────────────────────────────────────
const MANDARIN = new URL("../../../src/languages/mandarin/mandarin.ts", import.meta.url).href;
/** The pinyin tables exactly as createMandarin() builds them. */
function cmnPinyinTables(): { chars: Map<string, string[]>; phrases: Map<string, string>; maxPhrase: number } {
    const chars = loadTsvMap(MANDARIN, "chars.tsv", (v) => v.split(","));
    const phrases = loadTsvMap(MANDARIN, "phrases.tsv");
    const maxPhrase = [...phrases.keys()].reduce((m, k) => Math.max(m, Array.from(k).length), 2);
    return { chars, phrases, maxPhrase };
}
/** Synthetic texts only a JsString-level replay can carry: lone surrogate halves (the public &str API cannot). */
const CMN_EXTRAS = ["\uD842", "\uDFB7你", "你好\uD842", "𠮷\uD842", "1\uDC00年", "A\uD800B", "气温-\uD8005度"];
/** The `trace` dump's serializer: traced, normalized, and per token
 *  [span, inputSpan|null, ipaSpan|null, surface units, source|null], as JSON. */
function traceJson(t: {
    traced: boolean; normalized: string;
    tokens: { span: [number, number]; inputSpan?: [number, number]; ipaSpan?: [number, number]; surface: string; source?: string }[];
}): string {
    return JSON.stringify({
        traced: t.traced,
        normalized: units(t.normalized),
        tokens: t.tokens.map((k) => [k.span, k.inputSpan ?? null, k.ipaSpan ?? null, units(k.surface), k.source ?? null]),
    });
}
const emit = (input: unknown, output: string): void => {
    process.stdout.write(JSON.stringify({ input, output: units(output) }) + "\n");
};
const ENGLISH = new URL("../../../src/languages/english/english.ts", import.meta.url).href;

const dumps: Record<string, () => void | Promise<void>> = {
    // Every g2p-dict row through the arpabet converter with the shipped syllabic / nasal-seam tables.
    arpabet() {
        const slots = (v: string): number[] => v.split(",").map(Number).filter((n) => Number.isInteger(n));
        const syllabic = loadTsvMap(ENGLISH, "en-syllabic.tsv", slots);
        const nasalSeam = loadTsvMap(ENGLISH, "en-nasal-seam.tsv", slots);
        const conv = makeArpabetToIpa(MANIFEST.arpabet, syllabic, nasalSeam);
        const dict = loadTsvMap(ENGLISH, "g2p-dict.tsv", (v) => v.split(" "));
        for (const [word, phones] of dict) emit({ word: units(word), phones }, conv(phones, word));
        // Also with no word (the tagger's call shape: makeArpabetToIpa(MANIFEST.arpabet)(phones)).
        const bare = makeArpabetToIpa(MANIFEST.arpabet);
        for (const [, phones] of [...dict].slice(0, 5000)) emit({ word: [], phones, bare: true }, bare(phones));
    },
    // Whitespace-split sentences of every English golden, through the POS tagger (tags joined by spaces).
    pos() {
        const tagger = new PosTagger(loadJson<PosModel>(ENGLISH, "pos-model.json"));
        for (const g of ["en", "en-GB", "en-IN"]) {
            const rows = readFileSync(new URL(`../../../csharp/goldens/${g}.tsv`, import.meta.url), "utf8").split("\n");
            for (const row of rows) {
                const text = row.split("\t")[0] ?? "";
                if (text === "") continue;
                const words = text.split(/\s+/u).filter((w) => w !== "");
                emit({ words: words.map(units) }, tagger.tag(words).join(" "));
            }
        }
    },
    // Every word of the en-GB lexical-set tables and the lexicon, against lexicon membership as `known`.
    spelling() {
        const dict = loadTsvMap(ENGLISH, "g2p-dict.tsv", (v) => v);
        const known = (w: string): boolean => dict.has(w);
        const words = new Set<string>();
        const GB = new URL("../../../src/languages/english-gb/english-gb.ts", import.meta.url).href;
        for (const f of ["en-gb-lexical.tsv", "en-gb-bath.tsv", "en-gb-trap.tsv", "en-gb-lotr.tsv", "en-gb-cloth.tsv", "en-gb-palm.tsv", "en-gb-marry.tsv", "en-gb-yod.tsv"])
            for (const l of loadLines(GB, f)) words.add(l.split("\t")[0]!);
        for (const k of dict.keys()) words.add(k);
        for (const w of ["colour", "honourable", "favourite", "centre", "theatre", "realise", "organisations", "analyse", "travelled", "jewellery", "fulfilment", "anaesthetic", "manoeuvre", "catalogue", "programme", "sulphur", "connexion", "hourly", "ourselves", "flavourful", "labourer", "neighbourhoods", "paediatrician", "oestrogen", "haemorrhage", "cancelled", "modelling"]) words.add(w);
        for (const w of words) emit({ word: units(w) }, americanSpelling(w, known) ?? "\u0000none");
    },
    // The OOV G2P, built exactly as createEnglish() builds it, over every accent-lexicon word plus
    // lexicon words with OOV-making edits (doubled letters, suffixes, glued pairs).
    g2p() {
        const slots = (v: string): number[] => v.split(",").map(Number).filter((n) => Number.isInteger(n));
        const conv = makeArpabetToIpa(MANIFEST.arpabet, loadTsvMap(ENGLISH, "en-syllabic.tsv", slots), loadTsvMap(ENGLISH, "en-nasal-seam.tsv", slots));
        const dict = loadTsvMap(ENGLISH, "g2p-dict.tsv", (v) => v.split(" "));
        const g2p = createEnglishG2p(loadJson<EnglishG2pModel>(ENGLISH, "g2p-model.json"), dict,
            new Set(loadLines(ENGLISH, "g2p-common.txt")), conv,
            { ...MANIFEST.g2pClasses, vowels: MANIFEST.arpabet.vowels, letterNameExceptions: MANIFEST.letterNameExceptions });
        const words = new Set<string>();
        for (const l of loadLines(ENGLISH, "accent-lexicon.tsv")) words.add(l.split("\t")[0]!);
        const base = [...words].filter((w) => /^[a-z]+$/u.test(w));
        for (let i = 0; i + 1 < base.length; i += 97) {
            words.add(base[i]! + base[i + 1]!);
            words.add(base[i]! + "ishness");
            words.add(base[i]! + "ings");
            words.add(base[i]!.replace(/([aeiou])/u, "$1$1"));
        }
        for (const w of ["xkcd", "brrr", "zzzz", "mmmhmm", "tsktsk", "pfft", "hmms", "crwth", "nth", "cwm", "q", "zz", "bbc", "cnn", "llms"]) words.add(w);
        const take = process.env.G2P_LIMIT ? Number(process.env.G2P_LIMIT) : Infinity;
        let n = 0;
        for (const w of words) { if (n++ >= take) break; emit({ word: units(w) }, g2p.g2p(w)); }
    },
    // The engine on PRE-NORMALIZED text (normalize.ts runs on the TS side only): every golden sentence and
    // every FLEURS en_us utterance (column 3 is the text; column 2 is a WAV filename).
    "english-pre"() {
        const E = createEnglish();
        for (const text of englishTexts().keys()) {
            const normalized = E.normalizedFor(text);
            emit({ normalized: units(normalized) }, E.text(normalized, undefined, undefined, true));
        }
    },
    "english-gb-pre"() {
        const E = createEnglish();
        for (const text of englishTexts().keys()) {
            const normalized = E.normalizedFor(text);
            emit({ normalized: units(normalized) }, E.text(normalized, rpWordTransform(), undefined, true));
        }
    },
    // toRP alone over every lexicon reading (word + GenAm IPA), with and without the lexical sets.
    torp() {
        const lex = loadTsvMap(ENGLISH, "accent-lexicon.tsv", (rest) => { const f = rest.split("\t"); const ipa = f[1]?.trim(); return f.length >= 2 && ipa ? ipa : undefined; });
        const T = rpWordTransform();
        let i = 0;
        for (const [w, ipa] of lex) {
            emit({ word: units(w), ipa: units(ipa) }, T(ipa, w));
            if (i++ % 7 === 0) emit({ word: units(w), ipa: units(ipa), bare: true }, toRP(ipa, w));
        }
    },
    normalize() {
        for (const [t, src] of englishTexts()) emit({ text: units(t), src }, normalizeEnglish(t));
    },
    // normalizeEnglishInitialisms(normalizeEnglish(t), lexicon.has), the lexicon parsed as createEnglish() does.
    initialisms() {
        const lexicon = loadTsvMap(ENGLISH, "accent-lexicon.tsv", (rest) => {
            const fields = rest.split("\t");
            const ipa = fields[1]?.trim();
            return fields.length >= 2 && ipa ? ipa : undefined;
        });
        for (const [t, src] of englishTexts())
            emit({ text: units(t), src }, normalizeEnglishInitialisms(normalizeEnglish(t), (w) => lexicon.has(w)));
    },
    // The public sync entry, end to end (registry pre-passes + normalize + engine), for en and en-GB.
    async "phonemize-sync"() {
        const { phonemize } = await import("../../../src/index.ts");
        for (const lang of LANGS)
            for (const text of langTexts(lang)) emit({ text: units(text), lang }, phonemize(text, lang));
    },
    // The best path (phonemizeAsync: registry pre-passes + the BiLSTM OOV tagger), for en and en-GB.
    async "phonemize-best"() {
        const { phonemizeAsync } = await import("../../../src/index.ts");
        for (const lang of LANGS)
            for (const text of langTexts(lang)) emit({ text: units(text), lang }, await phonemizeAsync(text, lang));
    },
    // readerFor(run, host) over one run per script plus Greek lone-letter cases, against every override host.
    async reader() {
        const { readerFor } = await import("../../../src/core/scripts.ts");
        const runs = ["word", "слово", "λόγος", "α", "ά", "Ω", "ξ²", "ϐ", "かな", "カナ", "漢字", "한글", "كلمة", "מילה",
            "शब्द", "শব্দ", "சொல்", "คำ", "ቃል", "բառ", "სიტყვა", "စကား", "పదం", "ಪದ", "വാക്ക്", "શબ્દ", "ਸ਼ਬਦ",
            "ଶବ୍ଦ", "වචනය", "ពាក្យ", "ຄຳ", "ཚིག", "ⵜⴰⵡⴰⵍⵜ", "ᏣᎳᎩ", "ᱥᱟᱱᱛᱟᱲᱤ", "𞤀𞤣𞤤𞤢𞤥", "ߒߞߏ", "ꠍꠤꠟꠐꠤ", "ꦗꦮ", "ᮞᮥᮔ᮪ᮓ", "123", "μ-", "γ-"];
        for (const host of ["en", "ja", "ko", "yue", "uk", "sr", "fa", "ur", "mr", "ne", "el", "hi", "ru", "cmn"])
            for (const run of runs) {
                const r = readerFor(run, host);
                emit({ run: units(run), host }, r === undefined ? "\u0000none" : `${r.target}|${r.text}`);
            }
    },
    // latinPhone (both option sets) and foldLatinToBase over every BMP letter and a few clusters.
    async latin() {
        const { latinPhone } = await import("../../../src/core/latinPhones.ts");
        const { foldLatinToBase } = await import("../../../src/core/hostWord.ts");
        const items: string[] = ["é", "e\u0301", "ǆ", "ﬁ", "İ"];
        for (let cp = 0x41; cp < 0x3000; cp++) { const c = String.fromCodePoint(cp); if (/\p{L}/u.test(c)) items.push(c); }
        for (const c of items) {
            emit({ c: units(c), op: "phone" }, latinPhone(c) ?? "\u0000none");
            emit({ c: units(c), op: "phone-ih" }, latinPhone(c, { initial: true, includeH: true }) ?? "\u0000none");
            emit({ c: units(c), op: "fold" }, foldLatinToBase(c));
        }
    },
    // core/numbers composers over the Hindi (indic) and Armenian (western) manifest tables: 0..120000 plus
    // powers of ten and mixed values to 10^12, then renderNumber with an identity word function.
    async "core-numbers"() {
        const { indicNumberWords, westernNumberWords, renderNumber, spellDigits } = await import("../../../src/core/numbers.ts");
        const { loadManifest } = await import("../../../src/core/loadManifest.ts");
        const at = (dir: string) => new URL(`../../../src/languages/${dir}/${dir}.ts`, import.meta.url).href;
        const defs = [["indic", (loadManifest(at("hindi"), "hindi.jsonc") as any).numbers], ["western", (loadManifest(at("armenian"), "armenian.jsonc") as any).numbers]] as const;
        const ns: number[] = [];
        for (let n = 0; n <= 120000; n++) ns.push(n);
        for (let e = 5; e <= 12; e++) { ns.push(10 ** e, 10 ** e - 1, 10 ** e + 7, 123456789 % 10 ** e + 10 ** e); }
        for (const [kind, d] of defs) {
            const compose = kind === "indic" ? indicNumberWords : westernNumberWords;
            for (const n of ns) emit({ kind, n }, renderNumber(n, d, (w: string) => w, compose));
            for (const digits of ["0", "07", "1234567890", "x9y"]) emit({ kind, digits }, spellDigits(digits, d, (w: string) => w));
        }
    },
    // core makeSymbolNormalizer, for EVERY language that builds one: symbols-hook.mjs swaps in a recording
    // wrapper, the public sync entry runs over every golden (and FLEURS where FLEURS_DIR names it), and each
    // recorded SymbolData is emitted once as a `def` row followed by the (input, output) pairs it saw. es, fr
    // and hi also get their RAW texts through their own tier, and every tier gets probes/symbols.txt.
    // `SYMBOLS_LANGS=es,fr` narrows the run.
    async symbols() {
        const { register } = await import("node:module");
        register(new URL("./symbols-hook.mjs", import.meta.url));
        const { records } = await import("./symbols-wrap.ts");
        const { slavicCountForm } = await import("../../../src/core/normalizeSymbols.ts");
        const { phonemize } = await import("../../../src/index.ts");
        const { readdirSync } = await import("node:fs");
        const all = readdirSync(new URL("../../../csharp/goldens/", import.meta.url)).filter((f) => f.endsWith(".tsv")).map((f) => f.slice(0, -4));
        const langs = process.env.SYMBOLS_LANGS ? process.env.SYMBOLS_LANGS.split(",") : all;
        const raw = new Map<string, string[]>();
        for (const lang of langs) {
            const texts = [...textsFor([lang], Object.hasOwn(FLEURS_DIR, lang) ? FLEURS_DIR[lang] : undefined, []).keys()];
            raw.set(lang, texts);
            for (const t of texts) { try { phonemize(t, lang); } catch { /* the engine's own failure; not this dump's */ } }
        }
        const dirOf = (stack: string): string => /src\/languages\/([^/]+)\//u.exec(stack.split("\n").slice(2).join("\n"))?.[1] ?? "core";
        const RAW_DIR: Record<string, string> = { spanish: "es", french: "fr", hindi: "hi" };
        // A countForm is a function, so it travels by NAME: `default`, `slavic` (by identity), or
        // `custom:<language dir>` for a language's own selector. The replay maps the name onto a Rust twin and
        // checks the twin against `COUNT_PROBE`, the TS selector's values on a fixed vector, so a selector that
        // changes in the TS fails the replay loudly instead of being replayed with stale arithmetic.
        const sigOf = (cf: unknown, dir: string): string =>
            cf === undefined ? "default" : cf === slavicCountForm ? "slavic" : `custom:${dir}`;
        const COUNT_PROBE = [0, 1, 2, 3, 4, 5, 10, 11, 12, 13, 14, 15, 20, 21, 22, 25, 100, 101, 102, 111, 112, 121,
            1001, 0.5, 1.5, 2.5, -1, -2, -21, NaN, Infinity];
        const countProbe = (cf: ((n: number) => number) | undefined): [string, string][] =>
            COUNT_PROBE.map((n) => [String(n), String((cf ?? ((x: number) => (x === 1 ? 0 : 1)))(n))]);
        const probes = [...textsFor([], undefined, ["symbols.txt"]).keys()];
        const seen = new Map<string, number>();
        records.forEach((rec, i) => {
            const dir = dirOf(rec.stack);
            const sig = sigOf(rec.data.countForm, dir);
            const key = `${dir}\u0000${sig}\u0000${JSON.stringify(rec.data)}`;
            let id = seen.get(key);
            if (id === undefined) {
                id = i;
                seen.set(key, id);
                process.stdout.write(JSON.stringify({ def: id, dir, countForm: sig, countProbe: countProbe(rec.data.countForm), data: rec.data }) + "\n");
                // The synthetic arm probes, through every distinct tier.
                for (const t of probes) emit({ def: id, text: units(t), src: "probe" }, rec.apply(t));
            }
            const lang = Object.hasOwn(RAW_DIR, dir) ? RAW_DIR[dir]! : undefined;
            const inputs = new Map(rec.calls);
            for (const [text, out] of inputs) emit({ def: id, text: units(text), src: dir }, out);
            if (lang !== undefined && raw.has(lang))
                // The raw texts too: the tier must also be right on input its own normalizer did not shape.
                for (const t of raw.get(lang)!) if (!inputs.has(t)) emit({ def: id, text: units(t), src: `${dir}-raw` }, rec.apply(t));
        });
        process.stderr.write(`symbols: ${records.length} normalizers recorded, ${seen.size} distinct\n`);
    },
    // Spanish normalize.ts over the es golden, FLEURS es_419 and probes/es.txt: normalizeSpanish (both
    // varieties) and the initialism pass after it.
    async "es-normalize"() {
        const { normalizeSpanish, normalizeSpanishInitialisms } = await import("../../../src/languages/spanish/normalize.ts");
        for (const [t, src] of textsFor(["es"], FLEURS_DIR.es, ["es.txt"])) {
            const n = normalizeSpanish(t);
            emit({ text: units(t), src, op: "normalize" }, n);
            emit({ text: units(t), src, op: "americas" }, normalizeSpanish(t, { americas: true }));
            emit({ text: units(t), src, op: "initialisms" }, normalizeSpanishInitialisms(n));
        }
    },
    // Spanish g2p: every distinct letter run of the es texts (as written and lowercased) plus every one- to
    // three-letter string over the Spanish letters and a few foreign ones, through phonemizeWord and toSegments.
    async "es-g2p"() {
        const { phonemizeWord } = await import("../../../src/languages/spanish/spanish.ts");
        const { toSegments } = await import("../../../src/languages/spanish/g2p.ts");
        const words = new Set<string>();
        for (const t of textsFor(["es"], FLEURS_DIR.es, ["es.txt"]).keys())
            for (const m of t.matchAll(/[\p{L}\p{M}]+/gu)) { words.add(m[0]); words.add(m[0].toLowerCase()); }
        const letters = [..."abcdefghijklmnopqrstuvwxyzáéíóúüñçàèœ"];
        for (const a of letters) { words.add(a); for (const b of letters) { words.add(a + b); for (const c of "aeiouyáíúü") words.add(a + b + c); } }
        for (const w of words) {
            emit({ word: units(w), op: "word" }, phonemizeWord(w));
            emit({ word: units(w), op: "segs" }, toSegments(w).map((s) => `${s.ph}/${s.nucleus ? 1 : 0}${s.accent ? 1 : 0}`).join(" "));
        }
    },
    // Spanish numberToWords (with and without `raw`) and spanishOrdinal.
    async "es-numbers"() {
        const { numberToWords } = await import("../../../src/languages/spanish/numbers.ts");
        const { spanishOrdinal } = await import("../../../src/languages/spanish/romanOrdinals.ts");
        const ns: number[] = [];
        for (let i = 0; i <= 20000; i++) ns.push(i);
        for (let e = 4; e <= 19; e++) { ns.push(10 ** e, 10 ** e - 1, 10 ** e + 7, 1234567 * 10 ** (e - 4) + 42); }
        ns.push(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER + 1, 2 ** 53 + 2, 999999999999999, 1e21, 1.5, -1, NaN, Infinity);
        for (const n of ns) {
            emit({ n: String(n), raw: null, op: "words" }, numberToWords(n));
            emit({ n: String(n), raw: null, op: "ordinal" }, spanishOrdinal(n) ?? "\u0000none");
        }
        for (const raw of ["12345678901234567890", "9007199254740993", "000", "1000000000000000000", "999999999999999999"])
            emit({ n: String(Number(raw)), raw, op: "words" }, numberToWords(Number(raw), raw));
    },
    // Hindi's normalizer (makeHindiNormalizer with Hindi's own data) over every hi text: golden, FLEURS hi_in
    // (columns 3 and 4) and probes/hi.txt.
    async "hi-normalize"() {
        const { makeHindiNormalizer } = await import("../../../src/languages/hindi/normalize.ts");
        const { MANIFEST: HI } = await import("../../../src/languages/hindi/manifest.ts");
        const norm = makeHindiNormalizer(HI.numbers, HI);
        for (const [t, src] of textsFor(["hi"], "hi_in", ["hi.txt"])) emit({ text: units(t), src }, norm(t));
    },
    // The word level: the raw abugida g2p, wordRules and number(), over every Devanagari run in the
    // Devanagari-script goldens + hi FLEURS + hi probes, every consonant x matra/virama/sign combination, and
    // digit strings (ASCII, Devanagari, grouped, decimal, past 2^53).
    async "hi-word"() {
        const { makeAbugidaG2P } = await import("../../../src/core/abugida.ts");
        const { loadSharedPhonology } = await import("../../../src/core/phonology.ts");
        const { makeNativeHindi } = await import("../../../src/languages/hindi/hindi.ts");
        const { MANIFEST: HI } = await import("../../../src/languages/hindi/manifest.ts");
        const g2p = makeAbugidaG2P(HI, loadSharedPhonology());
        const H = makeNativeHindi(HI);
        const words = new Set<string>();
        const texts = textsFor(["hi", "mr", "ne", "awa", "bho", "hne", "mai", "mag"].filter((g) => {
            try { readFileSync(new URL(`../../../csharp/goldens/${g}.tsv`, import.meta.url)); return true; } catch { return false; }
        }), "hi_in", ["hi.txt"]);
        for (const t of texts.keys()) for (const m of t.normalize("NFC").matchAll(/[ऀ-ॣॲ-ॿ]+/gu)) words.add(m[0]);
        const s = HI.signs;
        const tails = ["", s.virama.char, s.anusvara.char, s.chandrabindu.char, s.visarga.char, s.nukta.char,
            ...Object.keys(HI.vowelSigns), ...Object.keys(HI.vowelSigns).map((v) => v + s.anusvara.char),
            ...Object.keys(HI.vowelSigns).map((v) => v + s.chandrabindu.char), "‍", "‌", "ऽ"];
        const cons = Object.keys(HI.consonants);
        for (const c of cons) for (const t of tails) { words.add(c + t); words.add(c + t + "क"); words.add("अ" + c + t + "ता"); }
        for (const c of cons) for (const d of ["क", "ग", "च", "ट", "त", "प", "म", "र", "ह"]) words.add(c + s.virama.char + d + "ा");
        for (const v of Object.keys(HI.independentVowels)) for (const t of ["", s.anusvara.char, s.chandrabindu.char, s.visarga.char]) { words.add(v + t); words.add(v + t + "ब"); }
        for (const w of words) {
            emit({ op: "g2p", word: units(w) }, g2p(w));
            emit({ op: "rules", word: units(w) }, H.wordRules(w));
        }
        const nums = new Set<string>();
        for (let n = 0; n <= 3000; n++) nums.add(String(n));
        for (let e = 4; e <= 22; e++) { nums.add("1" + "0".repeat(e)); nums.add("9".repeat(e)); nums.add("12345678901234567890123".slice(0, e)); }
        for (const x of ["0.5", "3.14", "12.05", ".5", "0.0", "१२३", "१,२३४", "१.५", "1,00,000", "9,000", "0,001", "10,0", "9007199254740993", "9007199254740993.25", "123456789012345678901.5"]) nums.add(x);
        for (const x of nums) emit({ op: "number", word: units(x) }, H.number(x));
    },
    // The new core modules through representative calls: deleteMedialSchwa (both schwas), applyWeightStress,
    // tokenizeIpa, heavyFinalCoda, over g2p outputs and every hi/mr golden IPA line; postposedSign over hi texts.
    async "abugida-core"() {
        const { makeAbugidaG2P } = await import("../../../src/core/abugida.ts");
        const { loadSharedPhonology } = await import("../../../src/core/phonology.ts");
        const { deleteMedialSchwa } = await import("../../../src/core/schwa.ts");
        const { applyWeightStress, tokenizeIpa } = await import("../../../src/core/weightStress.ts");
        const { postposedSign } = await import("../../../src/core/postposedSign.ts");
        const { heavyFinalCoda } = await import("../../../src/languages/hindi/hindi.ts");
        const { MANIFEST: HI } = await import("../../../src/languages/hindi/manifest.ts");
        const g2p = makeAbugidaG2P(HI, loadSharedPhonology());
        const ipas = new Set<string>();
        const texts = textsFor(["hi"], "hi_in", ["hi.txt"]);
        for (const t of texts.keys()) for (const m of t.normalize("NFC").matchAll(/[ऀ-ॣॲ-ॿ]+/gu)) ipas.add(g2p(m[0]));
        for (const g of ["hi", "mr", "bn", "gu", "ne"])
            for (const row of readFileSync(new URL(`../../../csharp/goldens/${g}.tsv`, import.meta.url), "utf8").split("\n")) {
                const ipa = row.split("\t")[1];
                if (ipa) { ipas.add(ipa); for (const w of ipa.split(" ")) ipas.add(w); }
            }
        for (const x of ["", " ", "ə", "kəməl", "kə məl\tkəɾ", "ˈkəməl", "kːəmə", "t͡ʃəlnaː", "ɔkɔɾɔ", "a͡", "ə̃kəɽ", "bʱaːɾət̪", "d͡zd͡z", "aːɡʱ"]) ipas.add(x);
        for (const x of ipas) {
            emit({ op: "schwa", ipa: units(x) }, deleteMedialSchwa(x));
            emit({ op: "schwa-o", ipa: units(x) }, deleteMedialSchwa(x, "ɔ"));
            emit({ op: "stress", ipa: units(x) }, applyWeightStress(x));
            emit({ op: "tokenize", ipa: units(x) }, tokenizeIpa(x).join("|"));
            emit({ op: "heavy", ipa: units(x) }, String(heavyFinalCoda(x)));
        }
        for (const t of texts.keys())
            for (const [sign, words] of [["<", "से कम"], [">", "से अधिक"], ["÷", "ने भागणे"], ["\\+", "जमा"]] as const)
                emit({ op: "postposed", ipa: units(t), sign, words }, postposedSign(t, sign, words));
        for (const t of ["a < b", "a<b<c", "यह 5 < 6, और वह", "x > y।", "< 5", "5 <", "a < b) c", "p ÷ q", "1 + 2 + 3", "$ < £"])
            for (const [sign, words] of [["<", "से कम"], [">", "से अधिक"], ["÷", "ने भागणे"], ["\\+", "जमा $&"]] as const)
                emit({ op: "postposed", ipa: units(t), sign, words }, postposedSign(t, sign, words));
    },
    // Devanagari inside ENGLISH text (probes/hi-in-en.txt), through the script reader. Replayed by the
    // `phonemize-sync` / `phonemize-best` arms (BEST=1 for the second).
    async "hi-in-en"() {
        const { phonemize, phonemizeAsync } = await import("../../../src/index.ts");
        for (const line of readFileSync(new URL("./probes/hi-in-en.txt", import.meta.url), "utf8").split("\n")) {
            if (line === "" || line.startsWith("#")) continue;
            for (const lang of ["en", "en-GB"])
                emit({ text: units(line), lang }, process.env.BEST ? await phonemizeAsync(line, lang) : phonemize(line, lang));
        }
    },
    numbers() {
        const ns: bigint[] = [];
        for (let i = 0n; i <= 20000n; i++) ns.push(i);
        for (let e = 3n; e <= 36n; e++) { ns.push(10n ** e); ns.push(10n ** e - 1n); ns.push(10n ** e + 7n); ns.push(123456789n * 10n ** (e - 3n) + 42n); }
        for (const n of ns) {
            emit({ n: n.toString(), ordinal: false }, numberToWords(n).join(" "));
            emit({ n: n.toString(), ordinal: true }, ordinalToWords(n).join(" "));
        }
    },
    // ── Japanese (ja) ──────────────────────────────────────────────────────────────────────────────────
    // normalizeJapanese over every ja text (golden, FLEURS ja_jp columns 3+4, probes/ja.txt).
    async "ja-normalize"() {
        const { normalizeJapanese } = await import("../../../src/languages/japanese/normalize.ts");
        for (const [t, src] of textsFor(["ja"], "ja_jp", ["ja.txt"])) emit({ text: units(t), src }, normalizeJapanese(t));
    },
    // kanaToMorae (joined by "|", or \0none) over every kana reading in readings.tsv / fallback.tsv, every
    // kana-only pitch key, every single kana and every ordered pair of kana and marks.
    async "ja-kana"() {
        const { kanaToMorae, segmentsToMorae } = await import("../../../src/languages/japanese/kana.ts");
        const J = new URL("../../../src/languages/japanese/japanese.ts", import.meta.url).href;
        const words = new Set<string>();
        for (const v of loadTsvMap(J, "readings.tsv").values()) words.add(v);
        for (const v of loadTsvMap(J, "fallback.tsv").values()) for (const r of v.split("\t")) if (r) words.add(r);
        for (const k of loadTsvMap(J, "pitch-accent.tsv").keys()) if (/^[ぁ-ゖァ-ヺー]+$/u.test(k)) words.add(k);
        const singles: string[] = ["ー", "ｰ", "ッ", "ゝ", "a", "漢", "\u{20b9f}", "\ud842"];
        for (let c = 0x3041; c <= 0x3096; c++) singles.push(String.fromCodePoint(c));
        for (let c = 0x30a1; c <= 0x30fa; c++) singles.push(String.fromCodePoint(c));
        for (const a of singles) { words.add(a); for (const b of singles) words.add(a + b); }
        for (const w of ["っ", "あっ", "っか", "っきゃ", "っう", "んあ", "ん", "けいい", "おおさか", "ーあ", "きゅう"]) words.add(w);
        for (const w of words) {
            const m = kanaToMorae(w);
            emit({ word: units(w), op: "morae" }, m === null ? "\u0000none" : m.join("|"));
        }
        // segmentsToMorae over split readings: each word cut at every interior code point.
        let n = 0;
        for (const w of words) {
            if (n++ % 13 !== 0) continue;
            const cps = [...w];
            for (let k = 1; k < cps.length; k++) {
                const segs = [cps.slice(0, k).join(""), cps.slice(k).join("")];
                const m = segmentsToMorae(segs);
                emit({ segs: segs.map(units), op: "segments" }, m === null ? "\u0000none" : m.join("|"));
            }
        }
    },
    // The kanji reading path: applyReadingSegments (joined by "|") and headsCompound over every readings.tsv
    // key, every fallback kanji, every key with a counter/digit-ish prefix and every TOKEN run of the ja texts.
    async "ja-kanji"() {
        const { applyReadingSegments, headsCompound } = await import("../../../src/languages/japanese/kanji.ts");
        const J = new URL("../../../src/languages/japanese/japanese.ts", import.meta.url).href;
        const words = new Set<string>();
        for (const k of loadTsvMap(J, "readings.tsv").keys()) words.add(k);
        for (const k of loadTsvMap(J, "fallback.tsv").keys()) { words.add(k); words.add(k + "々"); words.add(k + "の"); words.add(k + "る"); }
        for (const t of textsFor(["ja"], "ja_jp", ["ja.txt"]).keys())
            for (const m of t.matchAll(/[㐀-鿿\u{20000}-\u{2a6df}々〻ぁ-ゖァ-ヺー゛゜]+/gu)) words.add(m[0]);
        for (const w of ["々", "〻", "奈々", "時々", "人々", "\u{20b9f}", "\u{20b9f}る", "𠮟る", "ｱ", "abc", "日本ゴ", "\ud842"]) words.add(w);
        for (const w of words) {
            emit({ word: units(w), op: "segments" }, applyReadingSegments(w).join("|"));
            emit({ word: units(w), op: "heads" }, String(headsCompound(w)));
        }
    },
    // segmentText over every ja text after normalizeJapanese (its real input).
    async "ja-segment"() {
        const { segmentText } = await import("../../../src/languages/japanese/kanji.ts");
        const { normalizeJapanese } = await import("../../../src/languages/japanese/normalize.ts");
        for (const [t, src] of textsFor(["ja"], "ja_jp", ["ja.txt"])) {
            emit({ text: units(t), src, op: "raw" }, segmentText(t));
            emit({ text: units(t), src, op: "normalized" }, segmentText(normalizeJapanese(t)));
        }
    },
    // readCounter(n, ctr) (or \0none) for n in 0..1100 plus large and unsafe values, every counter and some
    // non-counter neighbours.
    async "ja-counters"() {
        const { readCounter } = await import("../../../src/languages/japanese/counters.ts");
        const ctrs = ["つ", "月", "時", "円", "年", "人", "日", "分", "本", "匹", "杯", "泊", "個", "回", "階", "軒", "歳", "冊", "足",
            "枚", "番", "度", "台", "名", "秒", "羽", "頭", "着", "丁", "間", "生", "の", "\u{20b9f}"];
        const ns: number[] = [];
        for (let n = 0; n <= 1100; n++) ns.push(n);
        for (const n of [2000, 3000, 6000, 8000, 10000, 10001, 13000, 30000, 100000, 1000000, 12345678, 2 ** 53 - 1, 2 ** 53, 1e21, -1, 1.5, NaN]) ns.push(n);
        for (const c of ctrs) for (const n of ns) emit({ n: String(n), ctr: units(c) }, readCounter(n, c) ?? "\u0000none");
    },
    // numberToKana(n, raw) for 0..20000, powers and mixed values to 10^16, and unsafe digit strings via raw.
    async "ja-numbers"() {
        const { numberToKana } = await import("../../../src/languages/japanese/numbers.ts");
        const raws: string[] = [];
        for (let n = 0; n <= 20000; n++) raws.push(String(n));
        for (let e = 4; e <= 16; e++) raws.push(String(10 ** e), String(10 ** e - 1), String(10 ** e + 7), String(123456789 % 10 ** e + 10 ** e));
        for (const r of ["9007199254740991", "9007199254740992", "12345678901234567890", "0000", "007", "100000000000000000000000"]) raws.push(r);
        for (const r of raws) emit({ raw: r }, numberToKana(Number(r), r));
    },
    // accentNucleus(surface, reading) and phonemizeWord over every readings.tsv row, the stripped-affix shapes
    // (word + particle/copula) and every TOKEN run of the ja texts with its computed reading.
    async "ja-pitch"() {
        const { accentNucleus } = await import("../../../src/languages/japanese/pitch.ts");
        const { phonemizeWord } = await import("../../../src/languages/japanese/japanese.ts");
        const { applyReadings } = await import("../../../src/languages/japanese/kanji.ts");
        const J = new URL("../../../src/languages/japanese/japanese.ts", import.meta.url).href;
        const pairs = new Map<string, string>();
        let i = 0;
        for (const [k, v] of loadTsvMap(J, "readings.tsv")) {
            pairs.set(k, v);
            if (i++ % 5 === 0) for (const a of ["を", "は", "です", "ですね", "だった", "には"]) pairs.set(k + a, v + a);
        }
        for (const t of textsFor(["ja"], "ja_jp", ["ja.txt"]).keys())
            for (const m of t.matchAll(/[㐀-鿿\u{20000}-\u{2a6df}々〻ぁ-ゖァ-ヺー゛゜]+/gu)) pairs.set(m[0], applyReadings(m[0]));
        for (const p of ["は", "から", "までの", "", "ハシ", "はしを"]) pairs.set(p, p);
        for (const [s, r] of pairs) {
            emit({ surface: units(s), reading: units(r), op: "nucleus" }, String(accentNucleus(s, r)));
            emit({ surface: units(s), op: "word" }, phonemizeWord(s));
        }
    },
    // phonemizeTrace(text, lang) per LANGS text: traced, normalized, and per token
    // [span, inputSpan|null, ipaSpan|null, surface units, source|null], as JSON.
    async trace() {
        const { phonemizeTrace } = await import("../../../src/index.ts");
        for (const lang of LANGS)
            for (const text of langTexts(lang)) {
                emit({ text: units(text), lang }, traceJson(phonemizeTrace(text, lang)));
            }
    },
    // Italian: normalize.ts's three exported passes over the golden, FLEURS it_it (columns 3 and 4) and
    // probes/it.txt (the symbol tier is covered end to end by phonemize-sync/best).
    async "it-normalize"() {
        const N = await import("../../../src/languages/italian/normalize.ts");
        for (const [t, src] of textsFor(["it"], "it_it", ["it.txt"])) {
            emit({ text: units(t), op: "normalize", src }, N.normalizeItalian(t));
            emit({ text: units(t), op: "initialisms", src }, N.normalizeItalianInitialisms(N.normalizeItalian(t)));
            emit({ text: units(t), op: "decimals", src }, N.normalizeItalianDecimals(t));
        }
    },
    // Italian phonemizeWord over every letter run of the texts, every 1-3 letter string of the inventory and
    // every 4-letter string of the context letters; numberWords and the Roman ordinal over 0..20000 and beyond.
    async "it-g2p"() {
        const I = await import("../../../src/languages/italian/italian.ts");
        const { ROMAN_POLICY } = await import("../../../src/languages/italian/romanOrdinals.ts");
        const words = new Set<string>();
        for (const t of langTexts("it")) for (const w of t.match(/\p{L}[\p{L}\p{M}]*/gu) ?? []) words.add(w);
        const inv = [..."abcdefghijklmnopqrstuvwxyzàèéìíîòóùú"];
        for (const a of inv) { words.add(a); for (const b of inv) { words.add(a + b); for (const c of inv) words.add(a + b + c); } }
        const ctx = [..."aeiouìcgshlnqz"];
        for (const a of ctx) for (const b of ctx) for (const c of ctx) for (const d of ctx) words.add(a + b + c + d);
        for (const w of words) emit({ word: units(w), op: "word" }, I.phonemizeWord(w));
        const ns: number[] = [];
        for (let i = 0; i <= 20000; i++) ns.push(i);
        for (let e = 4; e <= 21; e++) { ns.push(10 ** e); ns.push(10 ** e - 1); ns.push(3 * 10 ** e + 23); ns.push(1234567 * 10 ** (e - 4)); }
        for (const n of ns) {
            emit({ n, op: "cardinal" }, I.numberWords(n));
            emit({ n, op: "ordinal" }, ROMAN_POLICY.ordinal(n) ?? "\u0000none");
        }
    },
    // normalizeRomans with Italian's policy (registry.ts romanIt) over the Italian texts.
    async "it-roman"() {
        const { normalizeRomans } = await import("../../../src/core/roman.ts");
        const { ROMAN_POLICY } = await import("../../../src/languages/italian/romanOrdinals.ts");
        for (const [t, src] of textsFor(["it"], "it_it", ["it.txt"])) emit({ text: units(t), src }, normalizeRomans(t, ROMAN_POLICY));
    },
    // Portuguese normalize.ts over both goldens, FLEURS pt_br and probes/pt-BR.txt: EP and BP, and the
    // initialism pass over the BP output.
    async "pt-normalize"() {
        const { normalizePortuguese, normalizePortugueseInitialisms } = await import("../../../src/languages/portuguese/normalize.ts");
        for (const [t, src] of textsFor(["pt-BR", "pt"], "pt_br", ["pt-BR.txt"])) {
            emit({ text: units(t), src, op: "ep" }, normalizePortuguese(t));
            emit({ text: units(t), src, op: "bp" }, normalizePortuguese(t, true));
            emit({ text: units(t), src, op: "initialisms" }, normalizePortugueseInitialisms(normalizePortuguese(t, true)));
        }
    },
    // Portuguese word g2p: every correction-lexicon and open/close key, every word token of the normalized
    // goldens/FLEURS/probes, and synthetic corners (foreign letters, a lone surrogate, astral letters).
    async "pt-g2p"() {
        const pt = await import("../../../src/languages/portuguese/portuguese.ts");
        const br = await import("../../../src/languages/portuguese-br/portuguese-br.ts");
        const { normalizePortuguese } = await import("../../../src/languages/portuguese/normalize.ts");
        const PT = new URL("../../../src/languages/portuguese/portuguese.ts", import.meta.url).href;
        const BR = new URL("../../../src/languages/portuguese-br/portuguese-br.ts", import.meta.url).href;
        const words = new Set<string>();
        for (const f of ["lexicon.tsv", "lexicon-manual.tsv"]) for (const l of loadLines(PT, f)) words.add(l.split("\t")[0]!);
        for (const l of loadLines(BR, "pt-br-openclose.tsv")) words.add(l.split("\t")[0]!);
        for (const t of textsFor(["pt-BR", "pt"], "pt_br", ["pt-BR.txt"]).keys())
            for (const m of normalizePortuguese(t, true).matchAll(/([a-zà-ÿ]+)/giu)) words.add(m[1]!);
        for (const w of ["naïve", "Klöcker", "Vichy", "curry", "Madhya", "Cañitas", "señor", "Straße", "Æsir", "ðe", "þorn",
            "yoga", "ý", "ÿ", "x\uD800y", "a\uDC00", "𝐚bc", "ação", "mãe", "põe", "tem", "homem", "também", "bom", "sim",
            "um", "ouvir", "raiz", "sair", "mais", "dois", "juiz", "miúdo", "piano", "água", "criança", "real", "beato",
            "moeda", "dia", "tia", "gente", "cidade", "sal", "Brasil", "fácil", "útil", "soldado", "abandona", "acena",
            "afónica", "s", "ss", "h", "", "x", "qu", "gue", "queijo", "guerra", "quatro", "×", "÷", "K", "ſol", "İstanbul"])
            words.add(w);
        for (const w of words) {
            emit({ word: units(w), op: "ep" }, pt.phonemizeWord(w));
            emit({ word: units(w), op: "bp" }, pt.phonemizeWord(w, "bp"));
            emit({ word: units(w), op: "br" }, br.phonemizeWord(w));
            emit({ word: units(w), op: "render-ep" }, pt.renderWord(w));
            emit({ word: units(w), op: "render-bp" }, pt.renderWord(w, undefined, "bp"));
        }
    },
    // Portuguese numberToWords (EP and BP, with and without the raw digits) and portugueseOrdinal.
    async "pt-numbers"() {
        const { numberToWords: ptWords } = await import("../../../src/languages/portuguese/numbers.ts");
        const { portugueseOrdinal } = await import("../../../src/languages/portuguese/romanOrdinals.ts");
        const ns: number[] = [];
        for (let n = 0; n <= 25000; n++) ns.push(n);
        for (let e = 5; e <= 12; e++) ns.push(10 ** e, 10 ** e - 1, 10 ** e + 7, 10 ** e + 100, 10 ** e + 1001, 123456789 % 10 ** e + 10 ** e);
        for (let n = 1e6; n <= 1e9; n += 7_777_777) ns.push(n);
        ns.push(-1, 1.5, 2 ** 53, 2 ** 53 + 2, 1e21, NaN, Infinity);
        // Past 2^53 and below 1: no `raw`, so the fallback spells String(Math.abs(n)) — shortest round-trip
        // digits, zero-padded integers, exponent forms.
        ns.push(2 ** 60, -(2 ** 60), 2 ** 64, 2 ** 53 * 3 + 4, 123456789012345680000, 1e20, 1.5e21, 1e300, Number.MAX_VALUE,
            1e-7, 1.5e-7, 1e-6, 5e-324, 0.1 + 0.2, 1 / 3, 2 / 3, 1e9 + 0.5, 4.35, 0.000001234, -0.5, -0);
        for (let e = 54; e <= 70; e++) ns.push(2 ** e + 2 ** (e - 52) * 3, 2 ** e / 7);
        for (const n of ns)
            for (const d of ["ep", "bp"] as const) {
                emit({ n: String(n), d }, ptWords(n, d));
                emit({ n: String(n), d, raw: "0" + String(n) }, ptWords(n, d, "0" + String(n)));
            }
        for (const raw of ["0001234567890", "12x4", "99999999999999999999", "1 6"])
            for (const d of ["ep", "bp"] as const) emit({ n: raw, d, raw }, ptWords(Number(raw), d, raw));
        for (let n = -1; n <= 1002; n++) emit({ n: String(n), ordinal: true }, portugueseOrdinal(n) ?? "\u0000none");
        emit({ n: "2.5", ordinal: true }, portugueseOrdinal(2.5) ?? "\u0000none");
    },
    // ── Mandarin (cmn). Texts are langTexts("cmn") (golden, FLEURS cmn_hans_cn columns 3 and 4, probes/cmn.txt)
    // plus CMN_EXTRAS. normalizeMandarin and spellInitialisms alone, and chained as mandarin.ts chains them
    // (without the symbol tier between them).
    async "cmn-normalize"() {
        const { normalizeMandarin, spellInitialisms } = await import("../../../src/languages/mandarin/normalize.ts");
        for (const t of [...langTexts("cmn"), ...CMN_EXTRAS]) {
            emit({ text: units(t), op: "normalize" }, normalizeMandarin(t));
            emit({ text: units(t), op: "initialisms" }, spellInitialisms(t));
            emit({ text: units(t), op: "both" }, spellInitialisms(normalizeMandarin(t)));
        }
    },
    // segment() over each text's code points (no mask, and a mask exempting every third), before and after
    // applyYiBuSandhi. Tokens as `py\u0001src` (src absent → \u0000) joined by \u0002.
    async "cmn-segment"() {
        const { segment } = await import("../../../src/languages/mandarin/segment.ts");
        const { applyYiBuSandhi } = await import("../../../src/languages/mandarin/yiBuSandhi.ts");
        const t = cmnPinyinTables();
        const ser = (toks: { py: string; src?: string }[]): string =>
            toks.map((k) => `${k.py}\u0001${k.src ?? "\u0000"}`).join("\u0002");
        for (const text of [...langTexts("cmn"), ...CMN_EXTRAS]) {
            const cps = Array.from(text);
            for (const masked of [false, true]) {
                const exempt = masked ? cps.map((_c, i) => i % 3 === 0) : [];
                const toks = segment(cps, t, exempt);
                emit({ text: units(text), masked, sandhi: false }, ser(toks));
                applyYiBuSandhi(toks);
                emit({ text: units(text), masked, sandhi: true }, ser(toks));
            }
        }
    },
    // createPinyinPhonemizer() over: each text's segmented + sandhied Han pinyin, each raw text, every phrases.tsv
    // value, every syllable with each tone digit (and none, and out-of-range), every chars.tsv reading, and corners.
    async "cmn-pinyin"() {
        const { segment } = await import("../../../src/languages/mandarin/segment.ts");
        const { applyYiBuSandhi } = await import("../../../src/languages/mandarin/yiBuSandhi.ts");
        const { createPinyinPhonemizer } = await import("../../../src/languages/mandarin/mandarin.ts");
        const conv = createPinyinPhonemizer();
        const t = cmnPinyinTables();
        const items = new Set<string>();
        for (const text of langTexts("cmn")) {
            const toks = segment(Array.from(text).filter((c) => /\p{Script=Han}/u.test(c)), t);
            applyYiBuSandhi(toks);
            items.add(toks.map((k) => k.py).join(" "));
            items.add(text);
        }
        for (const v of t.phrases.values()) items.add(v);
        for (const k of loadTsvMap(MANDARIN, "syllable-ipa.tsv").keys())
            for (const tone of ["", "1", "2", "3", "4", "5", "6", "0"]) items.add(k + tone);
        for (const r of t.chars.values()) for (const p of r) items.add(p);
        for (const x of ["lv3", "nv3", "lve4", "nve4", "lu:e4", "nu:3", "LV3", "Ni3 HAO3", "MP3", "", "   ", " ni3  hao3 ",
            "ni3\thao3\nma", "xyz9", "ni3hao3", "ü", "u:", "a1 a3 a3 a3", "ni3 ni3 ni3", "ma5 ma", "er2", "r5", "ng2", "hm",
            "n2", "ê", "yo1", "lo5", "Ü3", "lÜ3", "ſi3", "K3"]) items.add(x);
        for (const x of items) emit({ text: units(x) }, conv(x));
    },
    // integerToChinese over 0..20000, myriad edges and up to MAX_SAFE_INTEGER; digitsToChinese over digit strings.
    async "cmn-numbers"() {
        const { integerToChinese, digitsToChinese } = await import("../../../src/languages/mandarin/numbers.ts");
        const ns = new Set<number>();
        for (let i = 0; i <= 20000; i++) ns.add(i);
        for (let e = 4; e <= 15; e++)
            for (const k of [1, 2, 3, 7, 10, 20, 22, 99, 101, 1001, 2002])
                for (const d of [0, 2, 20, -1, 2000, 10001]) ns.add(k * 10 ** e + d);
        for (let x = 1; x < 9e15; x = x * 7 + 3) ns.add(x);
        for (const x of [Number.MAX_SAFE_INTEGER, 9007199254739999, 20000000000002, 200020002, 2000200020002]) ns.add(x);
        for (const n of ns) if (Number.isSafeInteger(n)) emit({ n, op: "int" }, integerToChinese(n));
        for (const d of ["0", "2009", "2024", "1999", "3", "14", "000", "1234567890", "99999999999999999999", "5x", "１", "٣", "𝟗", ""])
            emit({ digits: units(d), op: "digits" }, digitsToChinese(d));
    },
    // The lone-surrogate CMN_EXTRAS through main's `trace` serializer (traceJson), plus each one's reading: the
    // `trace` and `phonemize-sync` dumps go through the &str API on the Rust side and cannot carry them.
    async "cmn-trace-extras"() {
        const { phonemize, phonemizeTrace } = await import("../../../src/index.ts");
        for (const text of CMN_EXTRAS) {
            emit({ text: units(text), lang: "cmn", op: "trace" }, traceJson(phonemizeTrace(text, "cmn")));
            emit({ text: units(text), lang: "cmn", op: "ipa" }, phonemize(text, "cmn"));
        }
    },
    // ── French (fr). Inputs: the fr golden, FLEURS fr_fr (columns 3 and 4) and probes/fr.txt. ──
    // Each stage of the normalization chain separately (op), with the Lexique membership test as isWord.
    async "fr-normalize"() {
        const N = await import("../../../src/languages/french/normalize.ts");
        const O = await import("../../../src/languages/french/ordinals.ts");
        const { normalizeRomans } = await import("../../../src/core/roman.ts");
        const lex = loadTsvMap(new URL("../../../src/languages/french/french.ts", import.meta.url).href, "lexicon.tsv");
        const isWord = (w: string): boolean => lex.has(w);
        for (const [t, src] of textsFor(["fr"], "fr_fr", ["fr.txt"])) {
            const a = N.normalizeFrench(t, isWord);
            emit({ text: units(t), src, op: "normalize" }, a);
            const b = normalizeRomans(O.normalizeFrenchOrdinalDigits(O.normalizeFrenchOrdinalRomans(a, isWord)));
            emit({ text: units(a), src, op: "numerals" }, b);
            emit({ text: units(b), src, op: "initialisms" }, N.normalizeFrenchInitialisms(b, isWord));
        }
    },
    // The rule g2p over every Lexique word, every word of the texts, and OOV-making edits of lexicon words.
    async "fr-g2p"() {
        const { toIpa } = await import("../../../src/languages/french/g2p.ts");
        const lex = loadTsvMap(new URL("../../../src/languages/french/french.ts", import.meta.url).href, "lexicon.tsv");
        const words = new Set<string>(lex.keys());
        for (const t of textsFor(["fr"], "fr_fr", ["fr.txt"]).keys())
            for (const m of t.matchAll(/[\p{L}\p{M}'’-]+/gu)) words.add(m[0]);
        const base = [...lex.keys()];
        for (let i = 0; i + 1 < base.length; i += 53) {
            words.add(base[i]! + base[i + 1]!);
            words.add(base[i]! + "ent");
            words.add(base[i]!.toUpperCase());
            words.add("ill" + base[i]!);
        }
        for (const w of ["", "h", "ill", "illégal", "Málaga", "Taínos", "Cañitas", "𝔞b", "\ud835x", "c'", "c’est", "qu'", "ﬁn", "İle", "straße", "øre", "x", "ex", "eux", "euille", "aill", "œuf", "bœufs"]) words.add(w);
        for (const w of words) emit({ word: units(w) }, toIpa(w));
    },
    async "fr-numbers"() {
        const { numberToWords } = await import("../../../src/languages/french/numbers.ts");
        for (let n = 0; n <= 20000; n++) emit({ n }, numberToWords(n));
        for (let e = 4; e <= 21; e++) for (const n of [10 ** e, 10 ** e - 1, 10 ** e + 7, 123456789 * 10 ** (e - 4) + 42]) emit({ n }, numberToWords(n));
        for (const n of [999999999, 1e9, 2 ** 53 - 1, 2 ** 53, 1.5, -3]) emit({ n }, numberToWords(n));
        for (const raw of ["0", "007", "1234567890", "99999999999999999999", "123456789012345678901234"]) emit({ n: Number(raw), raw: units(raw) }, numberToWords(Number(raw), raw));
    },
    async "fr-ordinals"() {
        const { ordinal, normalizeFrenchOrdinalDigits, normalizeFrenchOrdinalRomans } = await import("../../../src/languages/french/ordinals.ts");
        const lex = loadTsvMap(new URL("../../../src/languages/french/french.ts", import.meta.url).href, "lexicon.tsv");
        const ns = [0, 1.5, -1, 1e9, 1e6, 2e6, 1e12, 2 ** 53];
        for (let n = 1; n <= 3000; n++) ns.push(n);
        for (const n of ns)
            for (const [feminine, plural] of [[false, false], [true, false], [false, true], [true, true]] as const)
                emit({ n, feminine, plural }, ordinal(n, { feminine, plural }) ?? "\u0000none");
        for (const t of textsFor(["fr"], "fr_fr", ["fr.txt"]).keys()) {
            emit({ text: units(t), op: "digits" }, normalizeFrenchOrdinalDigits(t));
            emit({ text: units(t), op: "romans" }, normalizeFrenchOrdinalRomans(t, (w) => lex.has(w)));
        }
    },
    // The OOV tagger over every distinct word the neural pre-pass would offer it, plus a lexicon sample.
    async "fr-tagger"() {
        const { createFrenchTagger } = await import("../../../src/languages/french/frenchTagger.ts");
        const tagger = await createFrenchTagger();
        if (!tagger) throw new Error("fr tagger unavailable");
        const lex = loadTsvMap(new URL("../../../src/languages/french/french.ts", import.meta.url).href, "lexicon.tsv");
        const words = new Set<string>();
        for (const t of textsFor(["fr"], "fr_fr", ["fr.txt"]).keys())
            for (const m of t.matchAll(/[a-zà-ÿœæ]+(?:['’][a-zà-ÿœæ]+)?/giu)) words.add(m[0].toLowerCase());
        let i = 0;
        for (const w of lex.keys()) if (i++ % 25 === 0) words.add(w);
        for (const w of words) emit({ word: units(w) }, await tagger.tag(w));
    },
};


const name = process.argv[2] ?? "";
const run = dumps[name];
if (run === undefined) {
    console.error(`unknown dump "${name}"; known: ${Object.keys(dumps).join(", ")}`);
    process.exit(2);
}
await run();
