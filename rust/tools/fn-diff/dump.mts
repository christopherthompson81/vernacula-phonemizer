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

/** `FLEURS_ROOT=…` overrides the default root (the transcripts are not at the default on every machine). */
const FLEURS_ROOT = process.env.FLEURS_ROOT ?? "/mnt/data/omnivoice_ipa/corpus/fleurs_transcripts/data";
/** The FLEURS transcript directory for a language code. */
const FLEURS_DIR: Record<string, string> = {
    en: "en_us", "en-GB": "en_us", es: "es_419", "es-419": "es_419", fr: "fr_fr", hi: "hi_in", it: "it_it",
    "pt-BR": "pt_br", pt: "pt_br", ja: "ja_jp", cmn: "cmn_hans_cn", el: "el_gr", ko: "ko_kr", th: "th_th", ru: "ru_ru", de: "de_de", pl: "pl_pl",
    tr: "tr_tr",
    nl: "nl_nl",
    uk: "uk_ua",
    sv: "sv_se",
    sr: "sr_rs",
    hr: "hr_hr",
    bs: "bs_ba",
    sl: "sl_si",
    lt: "lt_lt",
    lv: "lv_lv",
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

// ── Thai helpers ──────────────────────────────────────────────────────────────────────────────────────
const THAI = new URL("../../../src/languages/thai/thai.ts", import.meta.url).href;
/** Thai-block runs to probe the segmenter and g2p with (see "th-segment"). Synthetic strings are drawn from
 *  the seg-words list and the Thai block by a fixed-seed PRNG, never from the corpus. */
async function thaiItems(): Promise<string[]> {
    const { normalizeThai } = await import("../../../src/languages/thai/normalize.ts");
    const items = new Set<string>();
    const runs = (t: string) => { for (const m of t.matchAll(/[฀-๿]+/gu)) items.add(m[0]); };
    for (const t of langTexts("th")) { runs(t); runs(normalizeThai(t)); }
    const seg = loadLines(THAI, "seg-words.txt").map((l) => l.trim()).filter(Boolean);
    for (const w of seg) items.add(w);
    for (const k of loadTsvMap(THAI, "dictionary.tsv").keys()) items.add(k);
    let x = 0x7c3a91d;
    const rnd = (n: number): number => { x = (x + 0x6d2b79f5) | 0; let t = Math.imul(x ^ (x >>> 15), 1 | x); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return (((t ^ (t >>> 14)) >>> 0) % n); };
    const thaiCp = (): string => String.fromCodePoint(0x0e00 + rnd(0x80));
    for (let i = 0; i < 4000; i++) {
        let s = "";
        for (let k = 2 + rnd(4); k > 0; k--) s += seg[rnd(seg.length)]!;
        items.add(s);
        if (i % 2 === 0) { const cs = [...s]; cs.splice(rnd(cs.length + 1), 0, thaiCp()); items.add(cs.join("")); }
    }
    for (let i = 0; i < 2000; i++) { let s = ""; for (let k = 1 + rnd(12); k > 0; k--) s += thaiCp(); items.add(s); }
    return [...items];
}
/** thaiPrep + thaiScanSyllables, serialized for the "th-syllabify" replay. */
function thaiScanJson(prep: any, scans: any[]): string {
    const unit = (u: any): string => u.kind === "C" ? `C:${u.g}:${u.ph}` : `V:${u.gs.join("")}:${u.glide ?? ""}`;
    const fates = [...prep.fates.entries()].sort((a: any, b: any) => a[0] - b[0]).map(([k, v]: any) => `${k}=${v}`).join(",");
    return [
        prep.units.map(unit).join(","),
        fates,
        prep.unitMark.map((m: any) => m ?? "_").join(","),
        prep.shortMark.map((b: boolean) => (b ? "1" : "0")).join(""),
        scans.map((s) => `${s.nucleus}|${s.tone ?? "_"}|${s.onsetCs.join("")}|${unit(s.nucUnit)}|${s.codaG}|${s.long ? 1 : 0}|${s.fate ?? "_"}`).join(";"),
    ].join("\u0002");
}

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
/** Korean synthetic texts with lone surrogates (the &str replay cannot carry them). */
const KO_EXTRAS = ["\uD842가", "가\uDC00나", "1\uD800,000명", "A\uD800B 회의", "3\uDC00명", "\uD842FBI"];
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
        // Every multiplier before mil and each scale noun (the apocope: 21000 = veintiún mil, #1463).
        for (let k = 1; k < 1000; k++) ns.push(k * 1e3, k * 1e3 + 21, k * 1e6, k * 1e6 + 1, k * 1e9, (k + 1000) * 1e6, k * 1e12);
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
    // phonemizeTrace for LANGS, serialized: normalized, then one line per token (span, inputSpan, surface,
    // nativised, emitted, source, ipaSpan), then the rewrites' stages. "-" is an absent field.
    async "phonemize-trace"() {
        const { phonemizeTrace } = await import("../../../src/index.ts");
        const sp = (s?: [number, number]): string => (s ? `${s[0]},${s[1]}` : "-");
        for (const lang of LANGS)
            for (const text of langTexts(lang)) {
                const t = phonemizeTrace(text, lang);
                const lines = [`${t.traced}`, t.ipa, t.normalized];
                for (const k of t.tokens)
                    lines.push([sp(k.span), sp(k.inputSpan), k.surface, k.nativised ?? "-", k.emitted.join("+"), k.source ?? "-", sp(k.ipaSpan)].join("|"));
                for (const r of t.rewrites) lines.push(`rewrite ${r.stage}`);
                emit({ text: units(text), lang }, lines.join("\n"));
            }
    },
    // ── Greek (el). Inputs: the el golden, FLEURS el_gr (columns 3 and 4) and probes/el.txt. ──
    async "el-normalize"() {
        const { normalizeGreek } = await import("../../../src/languages/greek/normalize.ts");
        for (const [t, src] of textsFor(["el"], "el_gr", ["el.txt"])) emit({ text: units(t), src }, normalizeGreek(t));
    },
    // The three word entries over every letter run of the texts, every synizesis-lexicon key, every 1-3 letter
    // string of the inventory, every 4-letter string of the context letters, and astral/uppercase corners;
    // then numberToWords over 0..20000, powers of ten and the digit-by-digit fallback.
    async "el-g2p"() {
        const G = await import("../../../src/languages/greek/greek.ts");
        const { numberToWords } = await import("../../../src/languages/greek/numbers.ts");
        const words = new Set<string>();
        for (const t of textsFor(["el"], "el_gr", ["el.txt"]).keys()) for (const w of t.match(/[\p{L}\p{M}]+/gu) ?? []) words.add(w);
        for (const [k] of loadTsvMap(new URL("../../../src/languages/greek/greek.ts", import.meta.url).href, "greek-synizesis.tsv")) words.add(k);
        const inv = [..."αβγδεζηθικλμνξοπρσςτυφχψωάέήίόύώϊϋΐΰ"];
        for (const a of inv) { words.add(a); for (const b of inv) { words.add(a + b); for (const c of inv) words.add(a + b + c); } }
        const ctx = [..."αειουγκμπντσλχάίόύ"];
        for (const a of ctx) for (const b of ctx) for (const c of ctx) for (const d of ctx) words.add(a + b + c + d);
        for (const w of ["", "𝔞ά", "ά𝔞ια", "κ𝔞ιά", "α\uD800υ", "ΣΟΦΟΣ", "ΚΟΙΛΙΑ", "ΆΥΛΟΣ", "İα", "ἀρχή", "ᾠδή", "ϐ", "ϲ"]) words.add(w);
        for (const w of words) {
            emit({ word: units(w), op: "word" }, G.phonemizeWord(w));
            emit({ word: units(w), op: "rules" }, G.phonemizeWordRules(w));
            emit({ word: units(w), op: "forced" }, G.phonemizeWordForced(w));
        }
        const ns: number[] = [];
        for (let i = 0; i <= 20000; i++) ns.push(i);
        for (let e = 4; e <= 21; e++) ns.push(10 ** e, 10 ** e - 1, 3 * 10 ** e + 23, 1234567 * 10 ** (e - 4));
        for (const n of [2 ** 53 - 1, 2 ** 53, 1.5, -3, 999999999999, 1e12 - 1, 5e11 + 3e8 + 1234]) ns.push(n);
        for (const n of ns) emit({ n, op: "number" }, numberToWords(n));
        for (const raw of ["0", "007", "1234567890", "1000000000000", "99999999999999999999"]) emit({ n: Number(raw), raw: units(raw), op: "number" }, numberToWords(Number(raw), raw));
    },
    // ── German (de). Inputs: the de golden, FLEURS de_de (columns 3 and 4) and probes/de.txt. ──
    // Each stage of text()'s normalization chain separately (op), and the phonotactic test on every word.
    async "de-normalize"() {
        const N = await import("../../../src/languages/german/normalize.ts");
        const { MANIFEST: DE } = await import("../../../src/languages/german/manifest.ts");
        const { makeSymbolNormalizer } = await import("../../../src/core/normalizeSymbols.ts");
        const st = DE.symbolTier;
        const symbols = makeSymbolNormalizer({
            percent: st.percent, currency: st.currency, units: st.units, exponentWords: st.exponentWords,
            bareExponent: st.bareExponent, magnitudes: st.magnitudes, ampersand: st.ampersand, multiply: st.multiply,
        });
        const words = new Set<string>();
        for (const [t, src] of textsFor(["de"], FLEURS_DIR.de, ["de.txt"])) {
            const a = N.normalizeGerman(t);
            emit({ text: units(t), src, op: "normalize" }, a);
            const b = N.normalizeGermanInitialisms(a);
            emit({ text: units(a), src, op: "initialisms" }, b);
            const c = symbols(b);
            emit({ text: units(b), src, op: "symbols" }, c);
            emit({ text: units(c), src, op: "years" }, N.normalizeGermanYears(c));
            // The year pass on the RAW text too: it must hold on input the earlier stages did not shape.
            emit({ text: units(t), src, op: "years" }, N.normalizeGermanYears(t));
            for (const m of t.matchAll(/[\p{L}\p{M}]+/gu)) words.add(m[0]);
        }
        for (const w of words) emit({ text: units(w), src: "words", op: "unreadable" }, String(N.isUnreadableGerman(w)));
    },
    // The word level: phonemizeWord, toSegments and decompose over every key of the six German lexicons, every
    // letter run of the texts (as written and lowercased), synthetic compounds built from the lexicon's own
    // constituents (with each linking element, a prefix, a suffix, three parts), and every one- to three-letter
    // string over the German letters.
    async "de-g2p"() {
        const { phonemizeWord } = await import("../../../src/languages/german/german.ts");
        const { toSegments } = await import("../../../src/languages/german/g2p.ts");
        const { decompose } = await import("../../../src/languages/german/morphology.ts");
        const { MANIFEST: DE } = await import("../../../src/languages/german/manifest.ts");
        const GERMAN = new URL("../../../src/languages/german/german.ts", import.meta.url).href;
        const words = new Set<string>();
        for (const f of ["stress.tsv", "length.tsv", "quality.tsv", "consonant.tsv", "er.tsv", "lexicon.tsv"])
            for (const k of loadTsvMap(GERMAN, f).keys()) words.add(k);
        for (const t of textsFor(["de"], FLEURS_DIR.de, ["de.txt"]).keys())
            for (const m of t.matchAll(/[\p{L}\p{M}]+/gu)) { words.add(m[0]); words.add(m[0].toLowerCase()); }
        const lex = loadTsvMap(GERMAN, "lexicon.tsv");
        const cons = [...lex].filter(([w, f]) => w.length >= 3 && f.includes("k")).map(([w]) => w);
        const links = ["", ...DE.morphology.linkingElements];
        const prefixes = [...DE.morphology.prefixUnstressed, ...DE.morphology.prefixStressed];
        const suffixes = DE.morphology.suffixes;
        for (let i = 0; i + 2 < cons.length; i += 3) {
            const [a, b, c] = [cons[i]!, cons[i + 1]!, cons[i + 2]!];
            words.add(a + links[i % links.length]! + b);
            words.add(prefixes[i % prefixes.length]! + a);
            words.add(b + suffixes[i % suffixes.length]!);
            if (i % 9 === 0) words.add(a + "s" + b + c);
            if (i % 15 === 0) words.add(prefixes[(i >> 1) % prefixes.length]! + a + b + suffixes[(i >> 2) % suffixes.length]!);
        }
        const letters = [..."abcdefghijklmnopqrstuvwxyzäöüß"];
        for (const a of letters) { words.add(a); for (const b of letters) { words.add(a + b); for (const c of "aeiouäöüyhrs") words.add(a + b + c); } }
        for (const w of ["", "Ɛ", "é", "\ud800", "ah\ud800", "ſt", "İst"]) words.add(w);
        for (const w of words) {
            emit({ word: units(w), op: "word" }, phonemizeWord(w));
            emit({ word: units(w), op: "segs" }, toSegments(w).map((s) => `${s.ph}/${s.s}/${s.vowel ? 1 : 0}`).join(" "));
            const d = decompose(w);
            emit({ word: units(w), op: "decomp" }, `${d.parts.join("·")}|${d.kinds.join(",")}|${d.stressPart}`);
        }
    },
    async "de-numbers"() {
        const { numberToWords } = await import("../../../src/languages/german/numbers.ts");
        const ns: number[] = [];
        for (let i = 0; i <= 20000; i++) ns.push(i);
        for (let k = 1; k < 1000; k++) ns.push(k * 1e3, k * 1e3 + 1, k * 1e3 + 21, k * 1e6, k * 1e6 + 1001, k * 1e6 + 999999);
        for (let e = 4; e <= 21; e++) ns.push(10 ** e, 10 ** e - 1, 10 ** e + 7);
        ns.push(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER + 1, 1e21, 1.5, -1, -0, NaN, Infinity, -Infinity);
        for (const n of ns) emit({ n: String(n), raw: null }, numberToWords(n));
        for (const raw of ["12345678901234567890", "0001", "000", "1000000000", "9007199254740993", "", "1a2"])
            emit({ n: String(Number(raw)), raw: units(raw) }, numberToWords(Number(raw), raw));
    },
    // ── Turkish (tr). Inputs: the tr golden, FLEURS tr_tr (columns 3 and 4) and probes/tr.txt. ──
    // normalizeTurkish, the initialism pass alone (rebuilt with normalize.ts's own config) on the raw text, Turkish's
    // symbol tier on the normalized text, and the phonotactic test on every letter run. readSuffixedUnits and the
    // number-token reader are module-private: the `trace` dump's `normalized` and phonemize-sync cover them.
    async "tr-normalize"() {
        const N = await import("../../../src/languages/turkish/normalize.ts");
        const { trLower } = await import("../../../src/languages/turkish/g2p.ts");
        const { MANIFEST: TR } = await import("../../../src/languages/turkish/manifest.ts");
        const { makeSymbolNormalizer } = await import("../../../src/core/normalizeSymbols.ts");
        const { makeInitialismNormalizer } = await import("../../../src/core/initialisms.ts");
        const st = TR.symbolTier;
        const symbols = makeSymbolNormalizer({
            percent: st.percent, currency: st.currency, units: st.units, exponentWords: st.exponentWords,
            percentPrefix: st.percentPrefix, multiply: st.multiply,
        });
        const initialisms = makeInitialismNormalizer({
            lower: trLower, letterName: (l) => TR.letterNames[l], acronymLetters: new Set<string>(),
            isRecorded: () => false, isUnreadable: N.isUnreadableTurkish,
        });
        const words = new Set<string>();
        for (const [t, src] of textsFor(["tr"], FLEURS_DIR.tr, ["tr.txt"])) {
            const a = N.normalizeTurkish(t);
            emit({ text: units(t), src, op: "normalize" }, a);
            emit({ text: units(t), src, op: "initialisms" }, initialisms(t));
            emit({ text: units(a), src, op: "symbols" }, symbols(a));
            for (const m of t.matchAll(/[\p{L}\p{M}]+/gu)) { words.add(m[0]); words.add(m[0].toUpperCase()); }
        }
        for (const w of words) emit({ text: units(w), src: "words", op: "unreadable" }, String(N.isUnreadableTurkish(w)));
    },
    // The word level: trLower, toSegments, phonemizeWord (lexicon/morphology and forced-final) and nat over every
    // stress.tsv key, every letter run of the texts (as written, lowercased, uppercased and capitalised), synthetic
    // stem+suffix words (every vowel-harmony variant of the pre-accenting and tail suffixes on a set of stems), every
    // one- to three-letter string over the Turkish letters plus the casing specials, and edge strings.
    async "tr-g2p"() {
        const T = await import("../../../src/languages/turkish/turkish.ts");
        const { toSegments, trLower } = await import("../../../src/languages/turkish/g2p.ts");
        const TURKISH = new URL("../../../src/languages/turkish/turkish.ts", import.meta.url).href;
        const words = new Set<string>();
        for (const k of loadTsvMap(TURKISH, "stress.tsv").keys()) { words.add(k); words.add(k.toUpperCase()); }
        for (const t of textsFor(["tr"], FLEURS_DIR.tr, ["tr.txt"]).keys())
            for (const m of t.matchAll(/[\p{L}\p{M}]+/gu)) {
                const w = m[0];
                words.add(w); words.add(w.toLowerCase()); words.add(w.toUpperCase());
                words.add(w.charAt(0).toUpperCase() + w.slice(1));
            }
        const stems = ["gel", "git", "oku", "yaz", "ev", "köy", "okul", "kitap", "masa", "göz", "kuş", "baba", "anne",
            "öğretmen", "hasta", "doktor", "türk", "dağ", "değ", "yürü", "sor", "bil", "ağla", "İzmir", "Istanbul"];
        const suffixes = ["iyor", "ıyor", "uyor", "üyor", "iyorum", "ıyorsun", "uyoruz", "üyorsunuz", "iyorlar", "yor",
            "ken", "rken", "yken", "la", "le", "yla", "yle", "ma", "me", "sa", "se", "dır", "dir", "dur", "dür", "tır",
            "tir", "tur", "tür", "ım", "im", "um", "üm", "yım", "yim", "ız", "iz", "uz", "üz", "sınız", "siniz", "sunuz",
            "sünüz", "lar", "ler", "da", "de", "dan", "den", "ta", "te", "tan", "ten", "nın", "nin", "nun", "nün", "a", "e",
            "ya", "ye", "ı", "i", "u", "ü", "ğı", "ği", "mıyor", "miyorum", "acak", "ecek", "malı", "meli", "dı", "di"];
        for (const s of stems) for (const x of suffixes) { words.add(s + x); for (const y of ["lar", "ler", "dan", "a", "nın"]) words.add(s + x + y); }
        const letters = [..."abcçdefgğhıijklmnoöprsştuüvyzwxqâîûİIÂÎÛ"];
        for (const a of letters) { words.add(a); for (const b of letters) { words.add(a + b); for (const c of "aeıioöuüğlkgnr") words.add(a + b + c); } }
        for (const w of ["", "\ud800", "a\udc00ğ", "i̇", "İ", "İ̇", "ẞ", "Σ", "ΑΣ", "ﬁ", "ŉ", "K", "ſ", "ǅ",
            "Ⓐ", "𝐀", "Ꭰ", "ꭰ", "Ა", "ᲀ", "Ʂ", "Ɐ"]) words.add(w);
        for (const w of words) {
            emit({ word: units(w), op: "lower" }, trLower(w));
            emit({ word: units(w), op: "segs" }, toSegments(w).map((s) => `${s.ph}/${s.nucleus ? 1 : 0}`).join(" "));
            emit({ word: units(w), op: "word" }, T.phonemizeWord(w));
            emit({ word: units(w), op: "final" }, T.phonemizeWord(w, true));
            emit({ word: units(w), op: "nat" }, T.nat(w));
        }
    },
    // numberToWords and ordinalWords over 0…20,000, thousands/millions multiples, powers of ten to 10²⁴ and their
    // neighbours, and the non-integers / negatives / non-finites; attachSuffix over cardinals × suffixes.
    async "tr-numbers"() {
        const { numberToWords } = await import("../../../src/languages/turkish/numbers.ts");
        const { ordinalWords, attachSuffix } = await import("../../../src/languages/turkish/normalize.ts");
        const ns: number[] = [];
        for (let i = 0; i <= 20000; i++) ns.push(i);
        for (let k = 1; k < 1000; k++) ns.push(k * 1e3, k * 1e3 + 1, k * 1e6, k * 1e6 + 1001, k * 1e9 + 4);
        for (let e = 4; e <= 24; e++) ns.push(10 ** e, 10 ** e - 1, 10 ** e + 7);
        ns.push(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER + 1, 1e21, 1.5, 0.5, 1000.7, -1, -0, NaN, Infinity, -Infinity);
        for (const n of ns) {
            emit({ n: String(n), op: "words" }, numberToWords(n));
            emit({ n: String(n), op: "ordinal" }, ordinalWords(n) ?? "\u0000none");
        }
        const sufs = ["te", "ta", "de", "da", "ü", "i", "ı", "u", "e", "a", "Ü", "lerin", "ları", "sı", "si", "inci", "ten", "dan", ""];
        for (const n of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 14, 34, 40, 44, 100, 1000, 1985, 2004, 1e6, 1e9 + 4])
            for (const s of sufs) emit({ words: units(numberToWords(n)), suffix: units(s), op: "attach" }, attachSuffix(numberToWords(n).split(" "), s).join("|"));
        for (const s of sufs) emit({ words: null, suffix: units(s), op: "attach" }, attachSuffix([], s).join("|"));
    },
    // ── Dutch (nl). Inputs: the nl golden, FLEURS nl_nl (columns 3 and 4) and probes/nl.txt. ──
    // Each stage of text()'s normalization chain separately (op), and the phonotactic test on every word.
    async "nl-normalize"() {
        const N = await import("../../../src/languages/dutch/normalize.ts");
        const { MANIFEST: NL } = await import("../../../src/languages/dutch/manifest.ts");
        const { makeSymbolNormalizer } = await import("../../../src/core/normalizeSymbols.ts");
        const st = NL.symbolTier;
        const symbols = makeSymbolNormalizer({
            percent: st.percent, currency: st.currency, units: st.units, rateDenominators: st.rateDenominators,
            unitPer: st.unitPer, exponentWords: st.exponentWords, magnitudes: st.magnitudes, multiply: st.multiply,
        });
        const words = new Set<string>();
        for (const [t, src] of textsFor(["nl"], FLEURS_DIR.nl, ["nl.txt"])) {
            const a = N.normalizeDutch(t);
            emit({ text: units(t), src, op: "normalize" }, a);
            const b = N.normalizeDutchInitialisms(a);
            emit({ text: units(a), src, op: "initialisms" }, b);
            emit({ text: units(b), src, op: "symbols" }, symbols(b));
            // The initialism pass and the tier on the RAW text too: input the earlier stages did not shape.
            emit({ text: units(t), src, op: "initialisms" }, N.normalizeDutchInitialisms(t));
            emit({ text: units(t), src, op: "symbols" }, symbols(t));
            for (const m of t.matchAll(/[\p{L}\p{M}]+/gu)) words.add(m[0]);
        }
        for (const w of words) emit({ text: units(w), src: "words", op: "unreadable" }, String(N.isUnreadableDutch(w)));
    },
    // The word level: phonemizeWord, toSegments, decompose and isLexicalWord over every 3rd stem-list entry, every
    // letter run of the texts (as written and lowercased), SYNTHETIC compounds built from the stem list (two and
    // three stems with every linking element, a prefix on a stem and on a non-word, a stem plus each suffix, a
    // stem plus a 3-letter word for the trailing-length floor, and list entries that are themselves a stem·stem
    // concatenation), every one- and two-letter string over the Dutch letters (three letters over a context
    // set), and edge strings.
    async "nl-g2p"() {
        const { phonemizeWord } = await import("../../../src/languages/dutch/dutch.ts");
        const { toSegments } = await import("../../../src/languages/dutch/g2p.ts");
        const { decompose, isLexicalWord } = await import("../../../src/languages/dutch/morphology.ts");
        const { MANIFEST: NL } = await import("../../../src/languages/dutch/manifest.ts");
        const { readDataText } = await import("../../../src/core/dataSource.ts");
        const stems = readDataText("languages/dutch/nl-stems.txt").split("\n").map((l) => l.trim().toLowerCase()).filter(Boolean);
        const stemSet = new Set(stems);
        const words = new Set<string>();
        stems.forEach((w, i) => { if (i % 3 === 0) words.add(w); });
        for (const t of textsFor(["nl"], FLEURS_DIR.nl, ["nl.txt"]).keys())
            for (const m of t.matchAll(/[\p{L}\p{M}'’]+/gu)) { words.add(m[0]); words.add(m[0].toLowerCase()); }
        const M = NL.morphology;
        const links = M.linkingElements;
        const prefixes = [...M.prefixUnstressed, ...M.prefixStressed];
        const long = stems.filter((w) => w.length >= 4 && /^[a-z]+$/.test(w));
        const three = stems.filter((w) => w.length === 3 && /^[a-z]+$/.test(w));
        for (let i = 0; i + 2 < long.length; i += 37) {
            const [a, b, c] = [long[i]!, long[i + 1]!, long[i + 2]!];
            words.add(a + links[i % links.length]! + b);
            words.add(prefixes[i % prefixes.length]! + a);
            words.add(prefixes[(i >> 1) % prefixes.length]! + a.slice(1));
            words.add(b + M.suffixes[i % M.suffixes.length]!);
            words.add(a + three[i % three.length]!);
            if (i % 5 === 0) words.add(a + links[(i >> 2) % links.length]! + b + c);
            if (i % 7 === 0) words.add(prefixes[(i >> 3) % prefixes.length]! + a + b + M.suffixes[(i >> 1) % M.suffixes.length]!);
        }
        // List entries that are also a stem·stem concatenation: the dontSplitKnownWords branch.
        let known = 0;
        for (const w of long) {
            if (known >= 3000) break;
            for (let k = 4; k + 4 <= w.length; k++)
                if (stemSet.has(w.slice(0, k)) && stemSet.has(w.slice(k))) { words.add(w); words.add(w + "en"); words.add(w + "heid"); known++; break; }
        }
        const letters = [..."abcdefghijklmnopqrstuvwxyzáéíóúàèâêîôûäëïöüñç"];
        const ctx = [..."aeioulnrgschjkwëï"];
        for (const a of letters) { words.add(a); for (const b of letters) { words.add(a + b); for (const c of ctx) words.add(a + b + c); } }
        for (const w of ["", "'t", "’t", "'s", "constructor", "\ud800", "ge\ud800", "İs", "ſt", "Ĳs", "ĳzer", "𝔞ap"]) words.add(w);
        for (const w of words) {
            emit({ word: units(w), op: "word" }, phonemizeWord(w));
            emit({ word: units(w), op: "segs" }, toSegments(w).map((s) => `${s.ph}/${s.s}/${s.vowel ? 1 : 0}`).join(" "));
            const d = decompose(w);
            emit({ word: units(w), op: "decomp" }, `${d.parts.join("·")}|${d.kinds.join(",")}|${d.stressPart}`);
            emit({ word: units(w), op: "lexical" }, String(isLexicalWord(w)));
        }
    },
    async "nl-numbers"() {
        const { numberToWords } = await import("../../../src/languages/dutch/numbers.ts");
        const { ordinalWord } = await import("../../../src/languages/dutch/normalize.ts");
        const ns: number[] = [];
        for (let i = 0; i <= 20000; i++) ns.push(i);
        for (let k = 1; k < 1000; k++) ns.push(k * 1e3, k * 1e3 + 1, k * 1e3 + 22, k * 1e6, k * 1e6 + 1001, k * 1e9, k * 1e9 + 999999999);
        for (let e = 4; e <= 21; e++) ns.push(10 ** e, 10 ** e - 1, 10 ** e + 7);
        ns.push(1e12 - 1, 1e12, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER + 1, 1e21, 1.5, -1, -0, NaN, Infinity, -Infinity);
        for (const n of ns) {
            emit({ n: String(n), raw: null, op: "words" }, numberToWords(n));
            emit({ n: String(n), raw: null, op: "ordinal" }, ordinalWord(n) ?? "\u0000none");
        }
        for (const raw of ["12345678901234567890", "0001", "000", "1000000000000", "9007199254740993", "", "1a2", "𝟗9"])
            emit({ n: String(Number(raw)), raw: units(raw), op: "words" }, numberToWords(Number(raw), raw));
    },
    // ── Ukrainian (uk). Texts: the uk golden, FLEURS uk_ua (columns 3 and 4) and probes/uk.txt. ──
    // normalize.ts's two passes per text, isUnreadableUkrainian over every letter run (as written and
    // lowercased), and synthetic rows for the arms whose tables the texts reach only sparsely: numeral+suffix
    // over every suffix the paradigm writes, the clock over every hour after each governing preposition, and
    // fractions over small numerators and denominators.
    async "uk-normalize"() {
        const N = await import("../../../src/languages/ukrainian/normalize.ts");
        const { MANIFEST: UK } = await import("../../../src/languages/ukrainian/manifest.ts");
        const words = new Set<string>();
        const rows = new Map<string, string>();
        for (const [t, src] of textsFor(["uk"], FLEURS_DIR.uk, ["uk.txt"])) rows.set(t, src);
        const suffixes = new Set<string>(["х", "их", "ти", "ми", "го", "му", "й", "е", "а", "у", "і", "ю", "я", "м", "от", "ох", "ої", "ою", "ій", "ім", "ьох", "Й", "ГО", "ть"]);
        for (const e of UK.ordinals.endings) for (const end of [e.hard, e.soft]) for (let k = 1; k <= Math.min(3, end.length); k++) suffixes.add(end.slice(-k));
        const ns = ["0", "1", "2", "3", "4", "5", "9", "10", "11", "12", "13", "19", "20", "21", "22", "23", "30", "33", "40", "54", "78", "90", "99", "100", "101", "111", "120", "200", "300", "400", "999", "1000", "1001", "1800", "1920", "1970", "2000", "2008", "3000", "9000", "10000", "10001", "21000", "999999", "1000000", "1000001", "12345678901234567890"];
        for (const n of ns) for (const suf of suffixes) if (!rows.has(`${n}-${suf}`)) rows.set(`${n}-${suf}`, "synthetic");
        const add = (t: string): void => { if (!rows.has(t)) rows.set(t, "synthetic"); };
        for (let h = 0; h <= 24; h++) for (const mm of ["00", "05", "30", "59"]) {
            add(`${h}:${mm}`);
            for (const p of Object.keys(UK.clock.prepositionCase)) add(`${p} ${h}:${mm}`);
        }
        for (const p of ["Constructor", "constructor", "toString", "valueOf", "Між", "ЗІ"]) add(`${p} 10:30`);
        for (let a = 0; a <= 23; a++) for (const b of [0, 1, 2, 3, 4, 5, 7, 10, 12, 20, 21, 100, 1000]) add(`${a}/${b}`);
        for (const [t, src] of rows) {
            const n = N.normalizeUkrainian(t);
            emit({ text: units(t), op: "normalize", src }, n);
            emit({ text: units(t), op: "initialisms", src }, N.normalizeUkrainianInitialisms(n));
            for (const w of t.match(/\p{L}[\p{L}\p{M}]*/gu) ?? []) { words.add(w); words.add(w.toLowerCase()); }
        }
        for (const w of words) emit({ text: units(w), op: "unreadable" }, N.isUnreadableUkrainian(w) ? "1" : "0");
    },
    // phonemizeWord over every Cyrillic-block run of the texts (as written and lowercased), every 1-3 letter
    // string of the alphabet plus the apostrophe and four non-Ukrainian Cyrillic letters, and every 4-letter
    // string of the context letters (в й ь, the iotated and plain vowels, the coronals).
    async "uk-g2p"() {
        const U = await import("../../../src/languages/ukrainian/ukrainian.ts");
        const words = new Set<string>();
        for (const t of langTexts("uk")) for (const w of t.match(/[Ѐ-ӿ'’ʼ]+/gu) ?? []) { words.add(w); words.add(w.toLowerCase()); }
        const abc = [..."абвгґдеєжзиіїйклмнопрстуфхцчшщьюя'ёыэъ"];
        for (const a of abc) { words.add(a); for (const b of abc) { words.add(a + b); for (const c of abc) words.add(a + b + c); } }
        const ctx = [..."вйьяюєїіоаитлнсц'"];
        for (const a of ctx) for (const b of ctx) for (const c of ctx) for (const d of ctx) words.add(a + b + c + d);
        for (const w of ["", "ВОДА", "Ї", "\ud800", "a\ud800б", "ллля", "нння", "ттьтя", "ссся", "ддз", "шшш", "щщ", "ццця", "лльлль"]) words.add(w);
        for (const w of words) emit({ word: units(w), op: "word" }, U.phonemizeWord(w));
    },
    // renderNumber(n, DEF.numbers, identity, eastSlavicNumberWords) over 0..20000, powers and multiples of
    // ten, and the Roman ordinal over 0..120 and its non-integer corners.
    async "uk-numbers"() {
        const { renderNumber } = await import("../../../src/core/numbers.ts");
        const { eastSlavicNumberWords } = await import("../../../src/languages/ukrainian/numbers.ts");
        const { MANIFEST: UK } = await import("../../../src/languages/ukrainian/manifest.ts");
        const { ROMAN_POLICY } = await import("../../../src/languages/ukrainian/romanOrdinals.ts");
        const ns: number[] = [];
        for (let i = 0; i <= 20000; i++) ns.push(i);
        for (let e = 4; e <= 15; e++) ns.push(10 ** e, 10 ** e - 1, 10 ** e + 7, 1234567 * 10 ** (e - 4) + 42);
        for (let k = 1; k < 1000; k++) ns.push(k * 1e3, k * 1e3 + 21, k * 1e6, k * 1e6 + 2001, k * 1e9 + 1002, k * 1e12 + 22000);
        ns.push(Number.MAX_SAFE_INTEGER);
        for (const n of ns) emit({ n: String(n), op: "words" }, renderNumber(n, UK.numbers, (w: string) => w, eastSlavicNumberWords));
        for (const n of [...Array(121).keys(), -1, 1.5, NaN, Infinity, 1000])
            emit({ n: String(n), op: "roman" }, ROMAN_POLICY.ordinal(n) ?? "\u0000none");
    },
    // normalizeRomans with Ukrainian's policy (registry.ts romanUk) over the Ukrainian texts.
    async "uk-roman"() {
        const { normalizeRomans } = await import("../../../src/core/roman.ts");
        const { ROMAN_POLICY } = await import("../../../src/languages/ukrainian/romanOrdinals.ts");
        for (const [t, src] of textsFor(["uk"], FLEURS_DIR.uk, ["uk.txt"])) emit({ text: units(t), src }, normalizeRomans(t, ROMAN_POLICY));
    },
    // ── Swedish (sv). Inputs: the sv golden, FLEURS sv_se (columns 3 and 4) and probes/sv.txt. ──
    // Each stage of text()'s normalization chain separately (op), the initialism pass on the raw text too, the
    // phonotactic test on every letter run, and normalize.ts's ordinal / hundredsYear over a numeric sweep.
    // The symbol tier is rebuilt from swedish.ts's OWN object literal (evaluated from the source; it is not
    // exported), so the dump and the engine cannot hold two copies of it.
    async "sv-normalize"() {
        const N = await import("../../../src/languages/swedish/normalize.ts");
        const { makeSymbolNormalizer } = await import("../../../src/core/normalizeSymbols.ts");
        const sv = readFileSync(new URL("../../../src/languages/swedish/swedish.ts", import.meta.url), "utf8");
        const start = sv.indexOf("makeSymbolNormalizer({", sv.indexOf("const SYMBOLS")) + "makeSymbolNormalizer(".length;
        let depth = 0, end = start;
        for (let i = start; i < sv.length; i++) {
            if (sv[i] === "{") depth++;
            else if (sv[i] === "}" && --depth === 0) { end = i + 1; break; }
        }
        const symbols = makeSymbolNormalizer(new Function(`return (${sv.slice(start, end)});`)());
        const words = new Set<string>();
        for (const [t, src] of textsFor(["sv"], FLEURS_DIR.sv, ["sv.txt"])) {
            const a = N.normalizeSwedish(t);
            emit({ text: units(t), src, op: "normalize" }, a);
            const b = N.normalizeSwedishInitialisms(a);
            emit({ text: units(a), src, op: "initialisms" }, b);
            emit({ text: units(t), src, op: "initialisms" }, N.normalizeSwedishInitialisms(t));
            emit({ text: units(b), src, op: "symbols" }, symbols(b));
            for (const m of t.matchAll(/[\p{L}\p{M}]+/gu)) { words.add(m[0]); words.add(m[0].toLowerCase()); }
        }
        for (const w of words) emit({ text: units(w), src: "words", op: "unreadable" }, String(N.isUnreadableSwedish(w)));
        const ns: number[] = [];
        for (let i = -2; i <= 2100; i++) ns.push(i);
        ns.push(0.5, 1.5, 19.5, 1100.5, -0, NaN, Infinity, 9999, 1e9, 2 ** 53);
        for (const n of ns) {
            emit({ n: String(n), src: "numeric", op: "ordinal" }, N.ordinal(n) ?? "\u0000none");
            emit({ n: String(n), src: "numeric", op: "hundreds" }, N.hundredsYear(n) ?? "\u0000none");
        }
    },
    // The word level: phonemizeWord and nat over every lexicon key (with the #1068 nativised aliases), every
    // letter run of the texts (as written, lowercased and nativised), every 1-3 letter string over the Swedish
    // letters and the apostrophes, every 4-letter string over the context letters, and edge strings; the parsed
    // entry of every lexicon key; toSegments over a sample with off-range stress ordinals, oLong, and synthetic
    // compounds.
    async "sv-g2p"() {
        const S = await import("../../../src/languages/swedish/swedish.ts");
        const { toSegments } = await import("../../../src/languages/swedish/g2p.ts");
        const lex = S.lexicon();
        const words = new Set<string>();
        for (const k of lex.keys()) words.add(k);
        for (const t of textsFor(["sv"], FLEURS_DIR.sv, ["sv.txt"]).keys())
            for (const m of t.matchAll(/[\p{L}\p{M}'’]+/gu)) { words.add(m[0]); words.add(m[0].toLowerCase()); words.add(S.nat(m[0])); }
        const abc = [..."abcdefghijklmnopqrstuvwxyzåäöéü'’"];
        for (const a of abc) { words.add(a); for (const b of abc) { words.add(a + b); for (const c of abc) words.add(a + b + c); } }
        const ctx = [..."aeioyäöskgctjrnldh"];
        for (const a of ctx) for (const b of ctx) for (const c of ctx) for (const d of ctx) words.add(a + b + c + d);
        for (const w of ["", "\ud800", "a\ud800b", "ſkepp", "İsa", "KÖTT", "Ångström", "öl", "MÜNCHEN", "naïve", "ﬁsk", "cc", "accé", "succé", "ction", "tion", "station", "xx", "qq", "hh", "ww"]) words.add(w);
        for (const w of words) {
            emit({ word: units(w), op: "word" }, S.phonemizeWord(w));
            emit({ word: units(w), op: "nat" }, S.nat(w));
        }
        for (const [k, e] of lex) {
            const l = e.longOrds === undefined ? "-" : [...e.longOrds].join(",");
            emit({ word: units(k), op: "lex" }, `${e.accent}|${e.ord ?? "-"}|${e.oLong ? 1 : 0}|${e.secOrd ?? "-"}|${l}|${e.secVowelInitial ? 1 : 0}`);
        }
        const sample = [...words].filter((_, i) => i % 97 === 0);
        const ords = [0, 1, 2, 3, 7, -1, 1.5, NaN];
        type C = { secOrd: number; longOrds: number[]; secVowelInitial?: boolean } | null;
        const compounds: C[] = [
            null, { secOrd: 1, longOrds: [] }, { secOrd: 1, longOrds: [0, 1] }, { secOrd: 2, longOrds: [0, 2], secVowelInitial: true },
            { secOrd: 0, longOrds: [1] }, { secOrd: 1.5, longOrds: [1.5, 3] }, { secOrd: 3, longOrds: [0, 1, 2, 3], secVowelInitial: false },
        ];
        const seg = (w: string, o: number, ol: boolean, c: C): string =>
            toSegments(w, o, ol, c === null ? undefined : { secOrd: c.secOrd, longOrds: new Set(c.longOrds), secVowelInitial: c.secVowelInitial })
                .map((s) => `${s.ph}/${s.vowel ? 1 : 0}`).join(" ");
        for (const w of sample) for (const o of ords) for (const ol of [false, true]) for (const c of compounds)
            emit({ word: units(w), op: "segs", ord: String(o), oLong: ol, compound: c }, seg(w, o, ol, c));
    },
    async "sv-numbers"() {
        const { numberToWords } = await import("../../../src/languages/swedish/numbers.ts");
        const ns: number[] = [];
        for (let i = 0; i <= 20000; i++) ns.push(i);
        for (let k = 1; k < 1000; k++) ns.push(k * 1e3, k * 1e3 + 1, k * 1e3 + 21, k * 1e6, k * 1e6 + 1001, k * 1e6 + 999999, k * 1e6 + 21000);
        for (let e = 4; e <= 21; e++) ns.push(10 ** e, 10 ** e - 1, 10 ** e + 7);
        ns.push(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER + 1, 1e21, 1.5, -1, -0, NaN, Infinity, -Infinity);
        for (const n of ns) emit({ n: String(n), raw: null }, numberToWords(n));
        for (const raw of ["12345678901234567890", "0001", "000", "1000000000", "9007199254740993", "", "1a2", "１２"])
            emit({ n: String(Number(raw)), raw: units(raw) }, numberToWords(Number(raw), raw));
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
            const a = N.normalizeFrench(t);
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
    // ── Korean (ko). Inputs: the ko golden, FLEURS ko_kr (columns 3 and 4) and probes/ko.txt. ──
    async "ko-normalize"() {
        const { normalizeKorean } = await import("../../../src/languages/korean/normalize.ts");
        for (const [t, src] of textsFor(["ko"], "ko_kr", ["ko.txt"])) emit({ text: units(t), src }, normalizeKorean(t));
        for (const t of KO_EXTRAS) emit({ text: units(t), src: "extra" }, normalizeKorean(t));
    },
    // phonemizeWord over every syllable, a coda × onset grid of pairs, every tensification.tsv key (bare and
    // with a particle), every Hangul run of the texts (raw and normalized) and non-Hangul corners.
    async "ko-g2p"() {
        const { phonemizeWord } = await import("../../../src/languages/korean/g2p.ts");
        const { normalizeKorean } = await import("../../../src/languages/korean/normalize.ts");
        const K = new URL("../../../src/languages/korean/korean.ts", import.meta.url).href;
        const words = new Set<string>();
        const syl = (l: number, v: number, t: number): string => String.fromCharCode(0xac00 + (l * 21 + v) * 28 + t);
        for (let c = 0xac00; c <= 0xd7a3; c++) words.add(String.fromCharCode(c));
        for (const l1 of [0, 11, 18, 5]) for (const t1 of Array.from({ length: 28 }, (_, i) => i))
            for (let l2 = 0; l2 < 19; l2++) for (const v2 of [0, 6, 20]) for (const t2 of [0, 4, 8, 27])
                words.add(syl(l1, 0, t1) + syl(l2, v2, t2));
        for (let t1 = 0; t1 < 28; t1 += 3) for (let l2 = 0; l2 < 19; l2 += 2) for (let t2 = 0; t2 < 28; t2 += 5) for (let l3 = 0; l3 < 19; l3 += 3)
            words.add(syl(2, 4, t1) + syl(l2, 20, t2) + syl(l3, 8, 0));
        for (const k of loadTsvMap(K, "tensification.tsv").keys()) { words.add(k); words.add(k + "이"); words.add(k + "는"); words.add("가" + k); }
        for (const t of textsFor(["ko"], "ko_kr", ["ko.txt"]).keys())
            for (const x of [t, normalizeKorean(t)]) for (const m of x.matchAll(/[가-힣]+/gu)) words.add(m[0]);
        for (const w of ["", "a", "ㄱ", "ㅏ", "漢", "𠮷", "가a나", "가𠮷나", "\uD842", "가\uDC00나", "힤", "꯿가", "힣힣", "가"]) words.add(w);
        for (const w of words) emit({ word: units(w) }, phonemizeWord(w));
    },
    async "ko-numbers"() {
        const { numberToWords, spellDigits } = await import("../../../src/languages/korean/numbers.ts");
        const ns = new Set<number>();
        for (let i = 0; i <= 20000; i++) ns.add(i);
        for (let e = 4; e <= 16; e++)
            for (const k of [1, 2, 3, 7, 10, 11, 99, 101, 1001])
                for (const d of [0, 1, 10, -1, 1000, 10001]) ns.add(k * 10 ** e + d);
        for (const x of [Number.MAX_SAFE_INTEGER, 2 ** 53, 2 ** 53 + 2, 1e21, -1, -0, 1.5, NaN, Infinity, 0.1]) ns.add(x);
        for (const n of ns) emit({ n: String(n), op: "int" }, numberToWords(n));
        for (const d of ["0", "007", "1234567890", "99999999999999999999", "5x", "١", "𝟗", "", "\uD842"])
            emit({ digits: units(d), op: "digits" }, spellDigits(d));
    },
    // Texts only a JsString-level replay can carry (lone surrogates), through the trace and the reading.
    async "ko-extras"() {
        const { phonemize, phonemizeTrace } = await import("../../../src/index.ts");
        for (const text of KO_EXTRAS) {
            emit({ text: units(text), lang: "ko", op: "trace" }, traceJson(phonemizeTrace(text, "ko")));
            emit({ text: units(text), lang: "ko", op: "ipa" }, phonemize(text, "ko"));
        }
    },
    // ── Thai (th). Texts are langTexts("th") (golden, FLEURS th_th columns 3 and 4, probes/th.txt).
    // normalizeThai alone.
    async "th-normalize"() {
        const { normalizeThai } = await import("../../../src/languages/thai/normalize.ts");
        for (const t of langTexts("th")) emit({ text: units(t) }, normalizeThai(t));
    },
    // segment() over every Thai run of the texts (raw and normalized), every seg-words entry and dictionary key,
    // and SYNTHETIC strings from a seeded PRNG: 2-5 seg-words concatenated, the same with a random Thai-block
    // code point spliced in, and random Thai-block strings. Tokens joined by \u0001.
    async "th-segment"() {
        const { segment } = await import("../../../src/languages/thai/segment.ts");
        for (const run of await thaiItems()) emit({ text: units(run) }, segment(run).join("\u0001"));
    },
    // phonemizeWord over the same items, and the syllabifier's intermediate stages for each:
    // fixup, reorder, strip, and thaiPrep + thaiScanSyllables serialized.
    async "th-word"() {
        const { phonemizeWord } = await import("../../../src/languages/thai/g2p.ts");
        for (const run of await thaiItems()) emit({ text: units(run) }, phonemizeWord(run));
    },
    async "th-syllabify"() {
        const s = await import("../../../src/languages/thai/syllabifier.ts");
        for (const run of await thaiItems()) {
            const fixed = s.thaiLexicalFixup(run);
            const reordered = s.reorderThaiLeadingVowels(fixed);
            emit({ text: units(run), op: "fixup" }, fixed);
            emit({ text: units(run), op: "reorder" }, reordered);
            emit({ text: units(run), op: "strip" }, s.stripThaiMarks(run));
            const prep = s.thaiPrep(reordered);
            emit({ text: units(run), op: "scan" }, prep === null ? "\u0000none" : thaiScanJson(prep, s.thaiScanSyllables(prep.units, prep.fates, prep.unitMark, prep.shortMark)));
        }
    },
    // The public entry over number strings (0..3000, magnitudes, unsafe) and Thai runs inside the other hosts.
    async "th-numbers"() {
        const { phonemize } = await import("../../../src/index.ts");
        const ns = new Set<string>();
        for (let n = 0; n <= 3000; n++) ns.add(String(n));
        for (let e = 3; e <= 16; e++) for (const k of [1, 2, 11, 21, 101, 999]) for (const d of [0, 1, 11, 21, 101]) ns.add(String(k * 10 ** e + d));
        for (const x of ["9007199254740991", "9007199254740992", "9007199254740993", "1".repeat(40), "1".repeat(400), "007", "0000"]) ns.add(x);
        for (const n of ns) emit({ text: units(n), lang: "th" }, phonemize(n, "th"));
    },
    async "th-in-hosts"() {
        const { phonemize, phonemizeAsync } = await import("../../../src/index.ts");
        for (const line of readFileSync(new URL("./probes/th-in-hosts.txt", import.meta.url), "utf8").split("\n")) {
            if (line === "" || line.startsWith("#")) continue;
            for (const lang of ["en", "en-GB", "ja", "it", "es", "pt", "pt-BR", "hi", "cmn", "fr"])
                emit({ text: units(line), lang }, process.env.BEST ? await phonemizeAsync(line, lang) : phonemize(line, lang));
        }
    },
    // ── Russian (ru). Texts: the ru golden, FLEURS ru_ru (columns 3 and 4) and probes/ru.txt. ──
    // normalize.ts's two passes per text, and isUnreadableRussian over every letter run (as written and lowercased).
    async "ru-normalize"() {
        const N = await import("../../../src/languages/russian/normalize.ts");
        const words = new Set<string>();
        for (const [t, src] of textsFor(["ru"], FLEURS_DIR.ru, ["ru.txt"])) {
            const n = N.normalizeRussian(t);
            emit({ text: units(t), op: "normalize", src }, n);
            emit({ text: units(t), op: "initialisms", src }, N.normalizeRussianInitialisms(n));
            for (const w of t.match(/\p{L}[\p{L}\p{M}]*/gu) ?? []) { words.add(w); words.add(w.toLowerCase()); }
        }
        for (const w of words) emit({ text: units(w), op: "unreadable" }, N.isUnreadableRussian(w) ? "1" : "0");
    },
    // phonemizeWord over every Cyrillic run of the texts (as written and lowercased), every 1-3 letter string of
    // the alphabet, every 4-letter string of the context letters, every 50th stress.tsv key and every hard-e.tsv
    // key; toIpa with off-range stress ordinals and hard lists.
    async "ru-g2p"() {
        const R = await import("../../../src/languages/russian/russian.ts");
        const { toIpa } = await import("../../../src/languages/russian/g2p.ts");
        const RU = new URL("../../../src/languages/russian/russian.ts", import.meta.url).href;
        const words = new Set<string>();
        for (const t of langTexts("ru")) for (const w of t.match(/[а-яёА-ЯЁ]+/gu) ?? []) { words.add(w); words.add(w.toLowerCase()); }
        const abc = [..."абвгдеёжзийклмнопрстуфхцчшщъыьэюя"];
        for (const a of abc) { words.add(a); for (const b of abc) { words.add(a + b); for (const c of abc) words.add(a + b + c); } }
        const ctx = [..."тдсзжчцьяеиоайн"];
        for (const a of ctx) for (const b of ctx) for (const c of ctx) for (const d of ctx) words.add(a + b + c + d);
        const stress = loadTsvMap(RU, "stress.tsv", Number);
        let i = 0;
        for (const k of stress.keys()) if (i++ % 50 === 0) words.add(k);
        const hard = loadTsvMap(RU, "hard-e.tsv", (v) => v.split(",").map(Number));
        for (const k of hard.keys()) words.add(k);
        for (const w of words) emit({ word: units(w), op: "word" }, R.phonemizeWord(w));
        const samples = ["тест", "стенд", "кафе", "интернет", "молоко", "здравствуйте", "объём", "", "щ", "аэ", "ёж"];
        const ords = [0, 1, 2, 3, -1, -0, 1.5, NaN, 99, Infinity];
        const hards: (number[] | undefined)[] = [undefined, [], [0], [1], [0, 1, 2], [5], [-1], [1.5], [NaN]];
        for (const w of samples) for (const o of ords) for (const h of hards)
            emit({ word: units(w), op: "toipa", ord: String(o), hard: h === undefined ? null : h.map(String) }, toIpa(w, o, h));
    },
    // numberToWords (with and without raw) and russianOrdinal.
    async "ru-numbers"() {
        const { numberToWords } = await import("../../../src/languages/russian/numbers.ts");
        const { russianOrdinal } = await import("../../../src/languages/russian/romanOrdinals.ts");
        const ns: number[] = [];
        for (let i = 0; i <= 20000; i++) ns.push(i);
        for (let e = 4; e <= 21; e++) ns.push(10 ** e, 10 ** e - 1, 10 ** e + 7, 1234567 * 10 ** (e - 4) + 42);
        for (let k = 1; k < 1000; k++) ns.push(k * 1e3, k * 1e3 + 21, k * 1e6, k * 1e6 + 2001, k * 1e6 + 1000);
        ns.push(Number.MAX_SAFE_INTEGER, 2 ** 53, 1.5, -1, -21, -0, NaN, Infinity, -Infinity, 0.1, 1e-7);
        for (const n of ns) {
            emit({ n: String(n), raw: null, op: "words" }, numberToWords(n));
            emit({ n: String(n), raw: null, op: "ordinal" }, russianOrdinal(n) ?? "\u0000none");
        }
        for (const raw of ["0", "007", "1234567890", "99999999999999999999", "1e3", "12a", "１２", "𝟙2"])
            emit({ n: String(Number(raw)), raw: units(raw), op: "words" }, numberToWords(Number(raw), raw));
    },
    // normalizeRomans with Russian's policy (registry.ts romanRu) over the Russian texts.
    async "ru-roman"() {
        const { normalizeRomans } = await import("../../../src/core/roman.ts");
        const { ROMAN_POLICY } = await import("../../../src/languages/russian/romanOrdinals.ts");
        for (const [t, src] of textsFor(["ru"], FLEURS_DIR.ru, ["ru.txt"])) emit({ text: units(t), src }, normalizeRomans(t, ROMAN_POLICY));
    },
    // ── Polish (pl). Inputs: the pl golden, FLEURS pl_pl (columns 3 and 4) and probes/pl.txt. ──
    // Each stage of text()'s normalization chain separately (op; the symbol tier built as polish.ts builds it),
    // and the phonotactic test on every letter run (as written and lowercased).
    async "pl-normalize"() {
        const N = await import("../../../src/languages/polish/normalize.ts");
        const { MANIFEST: PL } = await import("../../../src/languages/polish/manifest.ts");
        const { makeSymbolNormalizer } = await import("../../../src/core/normalizeSymbols.ts");
        const st = PL.symbolTier;
        const symbols = makeSymbolNormalizer({
            units: st.units, countForm: N.plCountForm, percent: st.percent, currency: st.currency,
            exponentWords: st.exponentWords, magnitudes: st.magnitudes, ampersand: st.ampersand, multiply: st.multiply,
        });
        const words = new Set<string>();
        for (const [t, src] of textsFor(["pl"], FLEURS_DIR.pl, ["pl.txt"])) {
            const a = N.normalizePolish(t);
            emit({ text: units(t), src, op: "normalize" }, a);
            const b = N.normalizePolishInitialisms(a);
            emit({ text: units(a), src, op: "initialisms" }, b);
            emit({ text: units(b), src, op: "symbols" }, symbols(b));
            for (const m of t.matchAll(/[\p{L}\p{M}]+/gu)) { words.add(m[0]); words.add(m[0].toLowerCase()); }
        }
        for (const w of words) emit({ text: units(w), src: "words", op: "unreadable" }, String(N.isUnreadablePolish(w)));
    },
    // phonemizeWord and toSegments over every letter run of the texts (as written and lowercased), every 1-3 letter
    // string of the alphabet, every 4-letter string over the letters the scan's context rules look at, and corner
    // strings; plus the nativiser (polish.ts's NATIVE_CLASS, copied) over the runs and foreign names.
    async "pl-g2p"() {
        const { phonemizeWord } = await import("../../../src/languages/polish/polish.ts");
        const { toSegments } = await import("../../../src/languages/polish/g2p.ts");
        const { makeNativiser } = await import("../../../src/core/hostWord.ts");
        const nat = makeNativiser("[A-Za-ząćęłńóśźżĄĆĘŁŃÓŚŹŻ]", "u");
        const words = new Set<string>();
        for (const t of langTexts("pl")) for (const m of t.matchAll(/[\p{L}\p{M}]+/gu)) { words.add(m[0]); words.add(m[0].toLowerCase()); }
        const abc = [..."aąbcćdeęfghijklłmnńoóprsśtuwyzźżqvx"];
        for (const a of abc) { words.add(a); for (const b of abc) { words.add(a + b); for (const c of abc) words.add(a + b + c); } }
        const ctx = [..."dzirąęwcsnkbau"];
        for (const a of ctx) for (const b of ctx) for (const c of ctx) for (const d of ctx) words.add(a + b + c + d);
        for (const w of ["", "İ", "İstanbul", "ſ", "ẞ", "\ud800", "a\udc00z", "𝐚𝐛", "ĄĘ", "DZIEŃ", "Rzeżucha", "zaufanie",
            "nauka", "auto", "pauza", "Europa", "ąą", "ęę", "ąę", "gęś", "ząb", "kąt", "pięć", "dźwięk", "wziąć"]) words.add(w);
        for (const w of words) {
            emit({ word: units(w), op: "word" }, phonemizeWord(w));
            emit({ word: units(w), op: "segs" },
                toSegments(w).map((s) => `${s.ph}/${s.nucleus ? 1 : 0}/${s.nasal ? 1 : 0}/${s.rz ? 1 : 0}`).join(" "));
        }
        for (const w of [...words, "São", "Müller", "Dvořák", "Ørsted", "Žižek", "Ångström", "Œuvre", "façade", "Tōkyō", "Nguyễn"])
            emit({ word: units(w), op: "nat" }, nat(w));
    },
    // numberToWords (with and without raw), readDigits, the Roman ordinal and plCountForm.
    async "pl-numbers"() {
        const { numberToWords, readDigits } = await import("../../../src/languages/polish/numbers.ts");
        const { ordinal } = await import("../../../src/languages/polish/romanOrdinals.ts");
        const { plCountForm } = await import("../../../src/languages/polish/normalize.ts");
        const ns: number[] = [];
        for (let i = 0; i <= 20000; i++) ns.push(i);
        for (let e = 4; e <= 21; e++) ns.push(10 ** e, 10 ** e - 1, 10 ** e + 7, 1234567 * 10 ** (e - 4) + 42);
        for (let k = 1; k < 1000; k++) ns.push(k * 1e3, k * 1e3 + 21, k * 1e6, k * 1e6 + 2001, k * 1e6 + 1000, k * 1e9, k * 1e9 + 12013);
        ns.push(Number.MAX_SAFE_INTEGER, 2 ** 53, 1e12 - 1, 1e12, 1.5, 2.7, -1, -21, -0, NaN, Infinity, -Infinity, 0.1, 1e-7, 112, 1012, 22.5);
        for (const n of ns) {
            emit({ n: String(n), raw: null, op: "words" }, numberToWords(n));
            emit({ n: String(n), raw: null, op: "ordinal" }, ordinal(n) ?? "\u0000none");
            emit({ n: String(n), raw: null, op: "count" }, String(plCountForm(n)));
        }
        for (const raw of ["0", "007", "1234567890", "1000000000000", "99999999999999999999", "1e3", "12a", "１２", "𝟙2", "", "\ud800"]) {
            emit({ n: String(Number(raw)), raw: units(raw), op: "words" }, numberToWords(Number(raw), raw));
            emit({ n: "0", raw: units(raw), op: "digits" }, readDigits(raw));
        }
    },
    // normalizeRomans with Polish's policy (registry.ts romanPl) over the Polish texts.
    async "pl-roman"() {
        const { normalizeRomans } = await import("../../../src/core/roman.ts");
        const { ROMAN_POLICY } = await import("../../../src/languages/polish/romanOrdinals.ts");
        for (const [t, src] of textsFor(["pl"], FLEURS_DIR.pl, ["pl.txt"])) emit({ text: units(t), src }, normalizeRomans(t, ROMAN_POLICY));
    },
    // ── Serbo-Croatian (sr, hr, bs). `SH_LANGS=sr,hr` narrows the run. Inputs per language: its golden, its
    // FLEURS transcripts (columns 3 and 4) and probes/<lang>.txt, plus synthetic rows for the arms whose
    // tables the texts reach sparsely: numeral+suffix over every case ending (both scripts), `N.` before every
    // licensor of the three standards and the Object.prototype names, the colon clock over every hour, the
    // degree before every bearing letter, and the era markers in both cases.
    async "sh-normalize"() {
        const sr = await import("../../../src/languages/serbian/normalize.ts");
        const { slavicCountForm } = await import("../../../src/core/normalizeSymbols.ts");
        const { makeSymbolNormalizer } = await import("../../../src/core/normalizeSymbols.ts");
        const norm: Record<string, (t: string) => string> = { sr: sr.normalizeSerbian };
        // The symbol tiers, rebuilt from each file's OWN object literal (Serbian's and Bosnian's are not
        // exported; Croatian's is, and is checked the same way), so the dump cannot hold a second copy.
        const tierFrom = (file: string): ((t: string) => string) => {
            const src = readFileSync(new URL(`../../../src/languages/${file}`, import.meta.url), "utf8");
            const start = src.indexOf("makeSymbolNormalizer({", src.indexOf("SYMBOLS = ")) + "makeSymbolNormalizer(".length;
            let depth = 0, end = start;
            for (let i = start; i < src.length; i++) {
                if (src[i] === "{") depth++;
                else if (src[i] === "}" && --depth === 0) { end = i + 1; break; }
            }
            return makeSymbolNormalizer(new Function("slavicCountForm", `return (${src.slice(start, end)});`)(slavicCountForm));
        };
        const tiers: Record<string, (t: string) => string> = { sr: tierFrom("serbian/normalize.ts") };
        const langs = (process.env.SH_LANGS ?? "sr,hr,bs").split(",").filter((l) => l !== "");
        if (langs.includes("hr")) {
            norm.hr = (await import("../../../src/languages/croatian/normalize.ts")).normalizeCroatian;
            tiers.hr = tierFrom("croatian/croatian.ts");
        }
        if (langs.includes("bs")) {
            norm.bs = (await import("../../../src/languages/bosnian/normalize.ts")).normalizeBosnian;
            tiers.bs = tierFrom("bosnian/normalize.ts");
        }
        const words = new Set<string>();
        const licensors = ["godine", "godini", "godinu", "godina", "veka", "veku", "vek", "vijeka", "vijeku", "vijek", "stoljeća",
            "stoljeću", "stoljeće", "januara", "jula", "decembra", "kolovoza", "rujna", "prosinca", "marka", "marku", "najvećim",
            "mjesto", "mjestu", "dana", "kategorije", "husarska", "pukovnija", "pukovniju", "zemlja", "gol", "svjetskog", "svjetskom",
            "svjetski", "svjetskoga", "reda", "redu", "najveća", "najveći", "najveće", "pakistanskog", "године", "веку", "јула",
            "constructor", "hasOwnProperty", "toString", "valueOf", "isPrototypeOf", "propertyIsEnumerable", "toLocaleString", "nijedan"];
        const suffixes = ["i", "og", "eg", "om", "em", "o", "e", "a", "oj", "u", "ih", "im", "ti", "go", "x", "ог", "их", "ом", "е", "а", "ју", "ти"];
        const ns = ["0", "1", "2", "3", "4", "5", "9", "10", "11", "12", "19", "20", "21", "22", "30", "33", "99", "100", "101", "111", "120", "200",
            "300", "999", "1000", "1001", "1418", "1450", "1500", "1624", "1970", "1990", "2000", "2015", "2016", "2100", "2101", "3000", "21000",
            "999999", "1000000", "12345678901234567890"];
        for (const lang of langs) {
            const rows = new Map<string, string>();
            for (const [t, src] of textsFor([lang], FLEURS_DIR[lang], [`${lang}.txt`])) rows.set(t, src);
            const add = (t: string): void => { if (!rows.has(t)) rows.set(t, "synthetic"); };
            for (const n of ns) {
                for (const suf of suffixes) add(`${n}-${suf}`);
                for (const w of licensors) { add(`${n}. ${w}`); add(`U ${n}. ${w} je.`); }
                add(`${n}.`); add(`od ${n}. Zatim`); add(`${n}. i ${n}. stoljeća`); add(`${n}. ili 11. godini`); add(`${n} - 1450. godine`);
                add(`${n}-${n}.`); add(`(${n}–1912.)`); add(`${n}. n. e.`); add(`${n}. p.n.e. u`); add(`${n}. g. n. e.`); add(`${n}. pr. Kr. i`);
            }
            for (let h = 0; h <= 25; h++) for (const mm of ["00", "01", "05", "30", "59", "60"]) {
                add(`u ${h}:${mm}`); add(`${h}:${mm} h`); add(`${h}:${mm} sati.`); add(`${h}.${mm} sati`); add(`${h}:${mm}.`);
                add(`${h}:${mm} - ${h}:${mm} sati`);
            }
            for (const b of [..."NSEWJZIXYQnsewjzixyqСЈИЗсјиз", "K", "C", "F", "c", "f", "С", "Ц", "Ф", "с"]) {
                add(`35°${b}`); add(`35° ${b}`); add(`35 °${b} stepena`); add(`35°${b} od`);
            }
            for (const era of ["p.n.e.", "п.н.е.", "n. e.", "н. е.", "P.N.E.", "N. E.", "pr. Kr.", "p.n.e", "itd.", "Itd.", "итд.", "npr.", "tzv.", "tj.", "br.", "str.", "Dr.", "dr."])
                for (const after of ["", " u", " U", ",", ")", ".", "!"]) add(`Od 300 ${era}${after} kraj`);
            for (const sign of ["-5", "−5", "– 5", "5 - 3", "±2", "+3", "a+3", "=", "<", ">", "÷", "4x4", "4 × 4", "A&B", "a & b", "AUD$ 5", "45 miliona AUD$", "SAD-a", "SAD-u", "George W. Bush", "A. B. C."])
                add(`Rezultat ${sign} 7`);
            for (const [t, src] of rows) {
                const a = norm[lang]!(t);
                emit({ lang, text: units(t), src, op: "normalize" }, a);
                emit({ lang, text: units(t), src, op: "initialisms" }, sr.normalizeSerbianInitialisms(t));
                emit({ lang, text: units(t), src, op: "symbols" }, tiers[lang]!(t));
                emit({ lang, text: units(t), src, op: "decimal" }, sr.readDecimalComma(t));
                for (const m of t.matchAll(/[\p{L}\p{M}]+/gu)) { words.add(m[0]); words.add(m[0].toLowerCase()); }
            }
        }
        for (const w of words) emit({ lang: "sr", text: units(w), src: "words", op: "unreadable" }, String(sr.isUnreadableSerbian(w)));
    },
    // The shared word level: phonemizeWord, foreignLetters and each standard's nativiser over every stress.tsv
    // key (as written, uppercased), stem+ending forms that reach the OOV accent tier, every letter run of the
    // three standards' texts (as written, lowercased, and folded), every 1-2 letter string over both alphabets
    // plus q w x y й, every 3-letter string over the context letters, and edge strings.
    async "sh-g2p"() {
        const S = await import("../../../src/languages/serbian/serbian.ts");
        const SERBIAN = new URL("../../../src/languages/serbian/serbian.ts", import.meta.url).href;
        const { makeNativiser } = await import("../../../src/core/hostWord.ts");
        const natHr = makeNativiser("[a-zčćšžđ]", "iu");
        const stress = loadTsvMap(SERBIAN, "stress.tsv");
        const trans = loadTsvMap(SERBIAN, "accent-transitions.tsv");
        const words = new Set<string>();
        // The lexicon keys and the synthetic OOV forms take only the g2p (they are many); the rest take every op.
        const g2pOnly = new Set<string>(stress.keys());
        const keys = [...stress.keys()];
        const endings = [...new Set([...trans.keys()].map((k) => k.split("|")[0]!))];
        for (let i = 0; i < keys.length; i += 397) {
            g2pOnly.add(keys[i]!.toUpperCase());
            for (const e of endings) g2pOnly.add(keys[i]! + e);
        }
        for (const lang of ["sr", "hr", "bs"])
            for (const t of textsFor([lang], FLEURS_DIR[lang], [`${lang}.txt`]).keys())
                for (const m of t.matchAll(/[\p{L}\p{M}'’-]+/gu)) { words.add(m[0]); words.add(m[0].toLowerCase()); words.add(S.foreignLetters(m[0])); }
        const abc = [..."abcčćdđefghijklmnoprsštuvzžqwxyабвгдђежзијклљмнњопрстћуфхцчџшй"];
        for (const a of abc) { words.add(a); for (const b of abc) words.add(a + b); }
        const ctx = [..."aeiorlnjdžtshxwqyрнљј"];
        for (const a of ctx) for (const b of ctx) for (const c of ctx) words.add(a + b + c);
        for (const w of ["", "\ud800", "a\ud800b", "ljjubav", "pop-pevač", "SSSR", "СССР", "MMF", "www", "Holland", "HOLLAND", "krv", "prst", "Exxon",
            "prethodni", "pothranjenost", "Othello", "Thomas", "Toyota", "Dylana", "quiz", "Québec", "İstanbul", "Толстой", "ćemo", "bismo", "grad", "ADD"]) words.add(w);
        for (const w of g2pOnly) if (!words.has(w)) emit({ word: units(w), op: "word" }, S.phonemizeWord(w));
        for (const w of words) {
            emit({ word: units(w), op: "word" }, S.phonemizeWord(w));
            emit({ word: units(w), op: "foreign" }, S.foreignLetters(w));
            emit({ word: units(w), op: "nat" }, S.nat(w));
            emit({ word: units(w), op: "nat-hr" }, natHr(w));
            emit({ word: units(w), op: "has" }, String(S.accentLexiconHas(w)));
        }
    },
    // composeSlavicNumber over each standard's table: 0..20000, multiples and powers, the unsafe and non-finite
    // corners, and raw strings for the digit-by-digit fallback.
    async "sh-numbers"() {
        const { composeSlavicNumber } = await import("../../../src/languages/serbian/numbers.ts");
        const tables: Record<string, unknown> = {
            sr: (await import("../../../src/languages/serbian/manifest.ts")).MANIFEST.numbers,
            hr: (await import("../../../src/languages/croatian/manifest.ts")).MANIFEST.numbers,
            bs: (await import("../../../src/languages/bosnian/manifest.ts")).MANIFEST.numbers,
        };
        const ns: number[] = [];
        for (let i = 0; i <= 20000; i++) ns.push(i);
        for (let k = 1; k < 1000; k++) ns.push(k * 1e3, k * 1e3 + 1, k * 1e3 + 21, k * 1e6, k * 1e6 + 1001, k * 1e6 + 2002, k * 1e6 + 999999);
        for (let e = 4; e <= 21; e++) ns.push(10 ** e, 10 ** e - 1, 10 ** e + 7);
        ns.push(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER + 1, 1e21, 1.5, -1, -0, NaN, Infinity, -Infinity);
        for (const [lang, N] of Object.entries(tables)) {
            for (const n of ns) emit({ lang, n: String(n), raw: null }, composeSlavicNumber(n, N as never));
            for (const raw of ["12345678901234567890", "0001", "000", "1000000000", "9007199254740993", "", "1a2", "１２", "𝟗9"])
                emit({ lang, n: String(Number(raw)), raw: units(raw) }, composeSlavicNumber(Number(raw), N as never, raw));
        }
    },
};


const name = process.argv[2] ?? "";
const run = dumps[name];
if (run === undefined) {
    console.error(`unknown dump "${name}"; known: ${Object.keys(dumps).join(", ")}`);
    process.exit(2);
}
await run();
