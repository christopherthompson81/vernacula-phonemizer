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
    id: "id_id",
    ms: "ms_my",
    tl: "fil_ph",
    ceb: "ceb_ph",
    sr: "sr_rs",
    hr: "hr_hr",
    bs: "bs_ba",
    sl: "sl_si",
    lt: "lt_lt",
    lv: "lv_lv",
    "fr-CA": "fr_fr",
    ca: "ca_es",
    gl: "gl_es",
    ro: "ro_ro",
    cs: "cs_cz",
    sk: "sk_sk",
    be: "be_by",
    bg: "bg_bg",
    mk: "mk_mk",
    ne: "ne_np",
    mr: "mr_in",
    fi: "fi_fi",
    et: "et_ee",
    hu: "hu_hu",
    is: "is_is",
    az: "az_az",
    kk: "kk_kz",
    ky: "ky_kg",
    uz: "uz_uz",
    da: "da_dk",
    nb: "nb_no",
    af: "af_za",
    lb: "lb_lu",
    tg: "tg_tj",
    cy: "cy_gb",
    ga: "ga_ie",
    ast: "ast_es",
    oc: "oc_fr",
    bn: "bn_in",
    as: "as_in",
    or: "or_in",
    zu: "zu_za",
};
/** The FLEURS splits a directory ships, where it is not all three (kk_kz has only train). Still loud: a split named
 *  here or by default that is absent throws. */
const FLEURS_SPLITS: Record<string, string[]> = { kk_kz: ["train"], zu_za: ["train"], xh_za: ["train"] };

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
        for (const split of Object.hasOwn(FLEURS_SPLITS, fleursDir) ? FLEURS_SPLITS[fleursDir]! : ["train", "dev", "test"])
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
    if (lang === "en-IN") return [...textsFor(["en", "en-GB", "en-IN"], "en_us", ["en-normalize.txt", "en-IN.txt"]).keys()];
    const extra = Object.hasOwn(EXTRA_PROBES, lang) ? EXTRA_PROBES[lang]! : [];
    return [...textsFor([lang], Object.hasOwn(FLEURS_DIR, lang) ? FLEURS_DIR[lang] : undefined, [`${lang}.txt`, ...extra]).keys()];
}
/** Probe files a language replays besides its own: the six dialects inherit Hindi's normalizer and symbol tier
 *  unchanged, so Hindi's arm-by-arm probes are theirs too. */
const EXTRA_PROBES: Record<string, string[]> = {
    bho: ["hi.txt"], mag: ["hi.txt"], awa: ["hi.txt"], mai: ["hi.txt"], hne: ["hi.txt"], rkt: ["hi.txt"],
    as: ["bn.txt"], bpy: ["bn.txt"],
};
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
/** A language's symbol tier rebuilt from the `makeSymbolNormalizer({...})` literal in its own source (`dir/file.ts`
 *  under src/languages), so the dump also proves the data the Rust port embeds. */
async function symbolsFromLiteral(path: string): Promise<(t: string) => string> {
    const { makeSymbolNormalizer } = await import("../../../src/core/normalizeSymbols.ts");
    const src = readFileSync(new URL(`../../../src/languages/${path}`, import.meta.url), "utf8");
    const start = src.indexOf("makeSymbolNormalizer({", src.indexOf("const SYMBOLS")) + "makeSymbolNormalizer(".length;
    let depth = 0, end = start;
    for (let i = start; i < src.length; i++) {
        if (src[i] === "{") depth++;
        else if (src[i] === "}" && --depth === 0) { end = i + 1; break; }
    }
    return makeSymbolNormalizer(new Function(`return (${src.slice(start, end)});`)());
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
    // en-IN: toIndian over every accent-lexicon reading (and through indianWordTransform), every 1-3 symbol string
    // over the delta's context alphabet, and phonemizeWord over every letter run of the English texts.
    async enin() {
        const I = await import("../../../src/languages/english-in/english-in.ts");
        const lex = loadTsvMap(ENGLISH, "accent-lexicon.tsv", (rest) => { const f = rest.split("\t"); const ipa = f[1]?.trim(); return f.length >= 2 && ipa ? ipa : undefined; });
        for (const [w, ipa] of lex) emit({ word: units(w), ipa: units(ipa), op: "transform" }, I.indianWordTransform(ipa));
        const alpha = ["t", "d", "ʰ", "̬", "̰", "͡", "ʃ", "θ", "ð", "e", "o", "a", "ᶦ", "ᶷ", "v", "w", "p", "k", "ɫ", "ɝ", "ɚ", "ɹ", "ᵻ", "ᵿ", "ʲ", "ˈ", " ", "\uD800"];
        for (const a of alpha) { emit({ ipa: units(a), op: "indian" }, I.toIndian(a)); for (const b of alpha) { emit({ ipa: units(a + b), op: "indian" }, I.toIndian(a + b)); for (const c of alpha) emit({ ipa: units(a + b + c), op: "indian" }, I.toIndian(a + b + c)); } }
        const words = new Set<string>();
        for (const t of textsFor(["en", "en-GB", "en-IN"], "en_us", ["en-normalize.txt", "en-IN.txt"]).keys())
            for (const m of t.matchAll(/[\p{L}\p{M}'’-]+/gu)) words.add(m[0]);
        for (const w of words) emit({ ipa: units(w), op: "word" }, I.phonemizeWord(w));
    },
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
    // es-419: phonemizeWord (the Castilian word + seseo/yeísmo) over every letter run of the es and es-419 texts
    // (as written and lowercased) and the 1-3 letter strings of es-g2p; toLatinAmerican over synthetic strings.
    async "es419-word"() {
        const E = await import("../../../src/languages/spanish-419/spanish-419.ts");
        const words = new Set<string>();
        for (const t of [...textsFor(["es", "es-419"], FLEURS_DIR.es, ["es.txt", "es-419.txt"]).keys()])
            for (const m of t.matchAll(/[\p{L}\p{M}]+/gu)) { words.add(m[0]); words.add(m[0].toLowerCase()); }
        const letters = [..."abcdefghijklmnopqrstuvwxyzáéíóúüñç"];
        for (const a of letters) { words.add(a); for (const b of letters) { words.add(a + b); for (const c of "aeiouyáíú") words.add(a + b + c); } }
        for (const w of words) emit({ word: units(w), op: "word" }, E.phonemizeWord(w));
        for (const s of ["", "θ", "ʎ", "θθʎʎ", "aθa ʎa", "\uD800θ", "ʎ\uDC00", "Θ", "sθ̃", "kaʎe θjelo"])
            emit({ word: units(s), op: "latam" }, E.toLatinAmerican(s));
    },
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
    // Nepali's own normalizer (makeNepaliNormalizer with nepali.jsonc's numbers) over the ne golden, FLEURS ne_np
    // (columns 3 and 4) and probes/ne.txt.
    async "ne-normalize"() {
        const { makeNepaliNormalizer } = await import("../../../src/languages/nepali/normalize.ts");
        const { parseJsonc } = await import("../../../src/core/jsonc.ts");
        const def = parseJsonc(readFileSync(new URL("../../../data/languages/nepali/nepali.jsonc", import.meta.url), "utf8")) as any;
        const norm = makeNepaliNormalizer(def.numbers);
        for (const [t, src] of textsFor(["ne"], "ne_np", ["ne.txt"])) emit({ text: units(t), src }, norm(t));
    },
    // Marathi's own normalizer (makeMarathiNormalizer(DEF)) over the mr golden, FLEURS mr_in (columns 3 and 4)
    // and probes/mr.txt.
    async "mr-normalize"() {
        const { makeMarathiNormalizer } = await import("../../../src/languages/marathi/normalize.ts");
        const { DEF } = await import("../../../src/languages/marathi/marathi.ts");
        const norm = makeMarathiNormalizer(DEF);
        for (const [t, src] of textsFor(["mr"], "mr_in", ["mr.txt"])) emit({ text: units(t), src }, norm(t));
    },
    // The Hindi-belt engines' word level (LANGS, default all eight): word, wordRules and number() of each
    // language's own create function (so awa's flap, mai's fold and ne's ʌ are in it), over every Devanagari run
    // in that language's golden + FLEURS + probes, every consonant of ITS manifest x matra/virama/sign tails, and
    // the hi-word digit strings.
    async "hindi-family-word"() {
        const FAMILY: Record<string, [string, string]> = {
            bho: ["bhojpuri", "createBhojpuri"], mag: ["magahi", "createMagahi"], awa: ["awadhi", "createAwadhi"],
            mai: ["maithili", "createMaithili"], hne: ["chhattisgarhi", "createChhattisgarhi"],
            rkt: ["rangpuri", "createRangpuri"], ne: ["nepali", "createNepali"], mr: ["marathi", "createMarathi"],
        };
        const langs = process.env.LANGS ? LANGS : Object.keys(FAMILY);
        for (const lang of langs) {
            const [dir, make] = FAMILY[lang]!;
            const mod = await import(`../../../src/languages/${dir}/${dir}.ts`);
            const E = mod[make]();
            const { parseJsonc } = await import("../../../src/core/jsonc.ts");
            const def = parseJsonc(readFileSync(new URL(`../../../data/languages/${dir}/${dir}.jsonc`, import.meta.url), "utf8")) as any;
            const words = new Set<string>();
            for (const t of langTexts(lang)) for (const m of t.normalize("NFC").matchAll(/[ऀ-ॣॲ-ॿ]+/gu)) words.add(m[0]);
            const s = def.signs;
            const sign = (k: string): string[] => (s[k]?.char ? [s[k].char] : []);
            const tails = ["", ...sign("virama"), ...sign("anusvara"), ...sign("chandrabindu"), ...sign("visarga"), ...sign("nukta"),
                ...Object.keys(def.vowelSigns), ...Object.keys(def.vowelSigns).flatMap((v) => sign("anusvara").map((a) => v + a)),
                ...Object.keys(def.vowelSigns).flatMap((v) => sign("chandrabindu").map((a) => v + a)), "‍", "‌", "ऽ", "॑"];
            const cons = Object.keys(def.consonants);
            const vir = sign("virama")[0] ?? "्";
            for (const c of cons) for (const t of tails) { words.add(c + t); words.add(c + t + "क"); words.add("अ" + c + t + "ता"); words.add("आ" + c + t + "ा"); }
            for (const c of cons) for (const d of ["क", "ग", "च", "ड", "ढ", "त", "प", "म", "र", "ह"]) { words.add(c + vir + d + "ा"); words.add("आ" + c + vir + d + "ी"); }
            for (const v of Object.keys(def.independentVowels)) for (const t of ["", ...sign("anusvara"), ...sign("chandrabindu"), ...sign("visarga")]) { words.add(v + t); words.add(v + t + "ब"); words.add(v + t + "डा"); }
            for (const w of words) {
                emit({ op: "word", lang, word: units(w) }, E.word(w));
                emit({ op: "rules", lang, word: units(w) }, E.wordRules(w));
            }
            const nums = new Set<string>();
            for (let n = 0; n <= 3000; n++) nums.add(String(n));
            for (let e = 4; e <= 22; e++) { nums.add("1" + "0".repeat(e)); nums.add("9".repeat(e)); nums.add("12345678901234567890123".slice(0, e)); }
            for (const x of ["0.5", "3.14", "12.05", ".5", "0.0", "१२३", "१,२३४", "१.५", "1,00,000", "9,000", "0,001", "10,0", "9007199254740993", "9007199254740993.25", "123456789012345678901.5"]) nums.add(x);
            for (const x of nums) emit({ op: "number", lang, word: units(x) }, E.number(x));
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
        // digitsToWords (#1523): the written numeral, grouped from its digits — every power of ten to 10⁴⁰, with
        // ±1-style neighbours, leading zeros, and deterministic pseudo-random digit strings of every length to 40.
        const { digitsToWords } = await import("../../../src/languages/turkish/numbers.ts");
        const ds: string[] = ["", "0", "00", "007", "0001000", "1", "10", "1000"];
        for (let k = 0; k <= 40; k++) ds.push("1" + "0".repeat(k), "9".repeat(k + 1), "1" + "0".repeat(k) + "1", "2" + "0".repeat(k) + "5");
        let seed = 1523;
        for (let len = 1; len <= 40; len++)
            for (let r = 0; r < 25; r++) {
                let d = "";
                for (let i = 0; i < len; i++) { seed = (seed * 1103515245 + 12345) % 2147483648; d += String(seed % 10); }
                ds.push(d);
            }
        for (const d of ds) emit({ n: d, op: "digits" }, digitsToWords(d));
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
        // centuryYear (#1526) reaches past 2100: the 1000s blocks and their boundaries up to 10000.
        for (let i = -2; i <= 10001; i += i < 2200 ? 1 : 7) ns.push(i);
        ns.push(2999, 3000, 3099, 3100, 9000, 9099, 9100, 9998, 10000, 2000.5);
        for (const n of ns) emit({ n: String(n), src: "numeric", op: "century" }, N.centuryYear(n) ?? "\u0000none");
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
    // ── Indonesian (id) and Malay (ms). Texts: each golden, FLEURS id_id / ms_my (columns 3 and 4) and
    // probes/<code>.txt. id-normalize: normalizeIndonesian per text, then the symbol tier on its output — the
    // TS tier rebuilt from indonesian.ts's own literal (evaluated from source with the manifest in scope).
    // ms-normalize: normalizeMalay per ms text, then normalizeIndonesian on its output (the inherited layer).
    async "id-normalize"() {
        const N = await import("../../../src/languages/indonesian/normalize.ts");
        const { MANIFEST: DEF } = await import("../../../src/languages/indonesian/indonesian.ts");
        const { makeSymbolNormalizer } = await import("../../../src/core/normalizeSymbols.ts");
        const src = readFileSync(new URL("../../../src/languages/indonesian/indonesian.ts", import.meta.url), "utf8");
        const start = src.indexOf("makeSymbolNormalizer({", src.indexOf("const SYMBOLS")) + "makeSymbolNormalizer(".length;
        let depth = 0, end = start;
        for (let i = start; i < src.length; i++) {
            if (src[i] === "{") depth++;
            else if (src[i] === "}" && --depth === 0) { end = i + 1; break; }
        }
        const symbols = makeSymbolNormalizer(new Function("DEF", `return (${src.slice(start, end)});`)(DEF));
        for (const [t, from] of textsFor(["id"], FLEURS_DIR.id, ["id.txt"])) {
            const a = N.normalizeIndonesian(t);
            emit({ text: units(t), src: from, op: "normalize" }, a);
            emit({ text: units(a), src: from, op: "symbols" }, symbols(a));
        }
    },
    async "ms-normalize"() {
        const M = await import("../../../src/languages/malay/normalize.ts");
        const N = await import("../../../src/languages/indonesian/normalize.ts");
        for (const [t, src] of textsFor(["ms"], FLEURS_DIR.ms, ["ms.txt"])) {
            const a = M.normalizeMalay(t);
            emit({ text: units(t), src, op: "malay" }, a);
            emit({ text: units(a), src, op: "indonesian" }, N.normalizeIndonesian(a));
        }
    },
    // The word level: phonemizeWord and phonemizeWordRules over every ⟨e⟩-lexicon key, every letter run of the
    // id and ms texts (as written, lowercased, UPPERCASED, Capitalised), every 1-3 letter string over a-z (and
    // the same UPPERCASED, which is the acronym gate and the unreadable test), every 4-letter string over a
    // context set, and edge strings.
    async "id-g2p"() {
        const I = await import("../../../src/languages/indonesian/indonesian.ts");
        const words = new Set<string>();
        for (const l of loadLines(new URL("../../../src/languages/indonesian/indonesian.ts", import.meta.url).href, "indonesian-e-lexicon.tsv")) {
            const k = l.split("\t")[0]!;
            if (l.includes("\t")) { words.add(k); words.add(k.toUpperCase()); }
        }
        const texts = [...textsFor(["id"], FLEURS_DIR.id, ["id.txt"]).keys(), ...textsFor(["ms"], FLEURS_DIR.ms, ["ms.txt"]).keys()];
        for (const t of texts)
            for (const m of t.matchAll(/[\p{L}\p{M}]+/gu)) {
                const w = m[0];
                words.add(w); words.add(w.toLowerCase()); words.add(w.toUpperCase());
                words.add(w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
            }
        const abc = [..."abcdefghijklmnopqrstuvwxyz"];
        for (const a of abc) {
            words.add(a); words.add(a.toUpperCase());
            for (const b of abc) {
                words.add(a + b); words.add((a + b).toUpperCase());
                for (const c of abc) { words.add(a + b + c); words.add((a + b + c).toUpperCase()); }
            }
        }
        const ctx = [..."aeioukngyshc"];
        for (const a of ctx) for (const b of ctx) for (const c of ctx) for (const d of ctx) { words.add(a + b + c + d); words.add((a + b + c + d).toUpperCase()); }
        for (const w of ["", "\ud800", "a\ud800b", "ſkala", "İndah", "ﬁsik", "Ångström", "KHUSUS", "NGANGA", "BBM", "DPK", "AKP", "constructor", "__proto__", "toString", "AI", "AU", "OI", "kk", "k", "q", "x", "aiai", "aai"])
            words.add(w);
        for (const w of words) {
            emit({ word: units(w), op: "word" }, I.phonemizeWord(w));
            emit({ word: units(w), op: "rules" }, I.phonemizeWordRules(w));
        }
    },
    // numberWords is module-private; reach it as the engine does, through phonemize(<digits>, "id") — the
    // number path splits on spaces and reads each word with the rules, so this is the module end to end.
    async "id-numbers"() {
        const { phonemize } = await import("../../../src/index.ts");
        const ns: string[] = [];
        for (let i = 0; i <= 12000; i++) ns.push(String(i));
        for (let k = 1; k < 1000; k += 7) ns.push(String(k * 1e3), String(k * 1e3 + 1), String(k * 1e6), String(k * 1e6 + 1001), String(k * 1e9 + 7));
        for (let e = 4; e <= 22; e++) ns.push("1" + "0".repeat(e), "9".repeat(e));
        ns.push("9007199254740991", "9007199254740992", "9007199254740993", "1.000", "12.345.678", "1,5", "0,25", "007", "1,", "1.000,5");
        for (const n of ns) emit({ text: units(n), lang: "id" }, phonemize(n, "id"));
    },
    // ── Tagalog (tl). Texts: the tl golden, FLEURS fil_ph (columns 3 and 4) and probes/tl.txt. ──
    // tl-normalize: normalizeTagalog per text, then the symbol tier on its output, the TS tier rebuilt from
    // tagalog.ts's own literal (evaluated from source).
    async "tl-normalize"() {
        const N = await import("../../../src/languages/tagalog/normalize.ts");
        const { makeSymbolNormalizer } = await import("../../../src/core/normalizeSymbols.ts");
        const src = readFileSync(new URL("../../../src/languages/tagalog/tagalog.ts", import.meta.url), "utf8");
        const start = src.indexOf("makeSymbolNormalizer({", src.indexOf("const SYMBOLS")) + "makeSymbolNormalizer(".length;
        let depth = 0, end = start;
        for (let i = start; i < src.length; i++) {
            if (src[i] === "{") depth++;
            else if (src[i] === "}" && --depth === 0) { end = i + 1; break; }
        }
        const symbols = makeSymbolNormalizer(new Function(`return (${src.slice(start, end)});`)());
        for (const [t, from] of textsFor(["tl"], FLEURS_DIR.tl, ["tl.txt"])) {
            const a = N.normalizeTagalog(t);
            emit({ text: units(t), src: from, op: "normalize" }, a);
            emit({ text: units(a), src: from, op: "symbols" }, symbols(a));
        }
    },
    // The word level: phonemizeWord, phonemizeWordRules, phonemizeShippedNoLoan and nat over every key of the
    // three lexicons, every letter run (with hyphens) of the texts (as written, lower, UPPER), every 1-3 letter
    // string over the Tagalog letters and the two hyphens, and edge strings.
    async "tl-g2p"() {
        const T = await import("../../../src/languages/tagalog/tagalog.ts");
        const at = new URL("../../../src/languages/tagalog/tagalog.ts", import.meta.url).href;
        const words = new Set<string>();
        for (const f of ["stress-lexicon.tsv", "loanword-lexicon.tsv"]) for (const k of loadTsvMap(at, f).keys()) words.add(k);
        for (const l of loadLines(at, "final-glottal.txt")) words.add(l);
        for (const t of textsFor(["tl"], FLEURS_DIR.tl, ["tl.txt"]).keys())
            for (const m of t.matchAll(/[\p{L}\p{M}‑-]+/gu)) { words.add(m[0]); words.add(m[0].toLowerCase()); words.add(m[0].toUpperCase()); }
        const abc = [..."abcdefghijklmnopqrstuvwxyzñ-‑"];
        for (const a of abc) { words.add(a); for (const b of abc) { words.add(a + b); for (const c of abc) words.add(a + b + c); } }
        for (const w of ["", "\ud800", "a\ud800b", "ſala", "İlog", "ﬁlo", "Ñora", "MGA", "Ng", "constructor", "__proto__", "toString", "pag-asa", "pag‑asa", "--", "a-", "-a", "maaari", "aaa"])
            words.add(w);
        for (const w of words) {
            emit({ word: units(w), op: "word" }, T.phonemizeWord(w));
            emit({ word: units(w), op: "rules" }, T.phonemizeWordRules(w));
            emit({ word: units(w), op: "noloan" }, T.phonemizeShippedNoLoan(w));
            emit({ word: units(w), op: "nat" }, T.nat(w));
        }
    },
    // numberWords (exported) over 0…20,000 and scaled samples past 2^53 (the float composes), then the number,
    // clock and ika- ordinal paths end to end through phonemize(…, "tl").
    async "tl-numbers"() {
        const { numberWords } = await import("../../../src/languages/tagalog/tagalog.ts");
        const { phonemize } = await import("../../../src/index.ts");
        const ns: number[] = [];
        for (let i = 0; i <= 20000; i++) ns.push(i);
        for (let k = 1; k < 1000; k += 3) ns.push(k * 1e3, k * 1e3 + 1, k * 1e3 + 22, k * 1e6, k * 1e6 + 1001, k * 1e9 + 7);
        for (let e = 4; e <= 25; e++) ns.push(10 ** e, 10 ** e - 1, 10 ** e + 7);
        ns.push(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER + 1, 1e21, 1.5e30, -1, -0);
        for (const n of ns) emit({ n: String(n), op: "words" }, numberWords(n));
        const texts: string[] = [];
        for (let i = 0; i <= 1200; i++) texts.push(String(i), `ika-${i}`, `ika${i}`, `Ika-${i}`);
        for (let h = 0; h < 24; h++) for (const mm of ["00", "05", "30", "59"]) texts.push(`${h}:${mm}`, `${h}:${mm}:07`, `${h}:${mm}:00`);
        for (let e = 4; e <= 30; e++) texts.push("1" + "0".repeat(e), "9".repeat(e), `ika-${"9".repeat(e)}`);
        texts.push("1,000", "1,000,000.25", "3.14", "0.5", "007", "ika-002", "ika-03", "9007199254740993", "12,345.6789");
        for (const t of texts) emit({ text: units(t), op: "text" }, phonemize(t, "tl"));
    },
    // ── Cebuano (ceb). Texts: the ceb golden, FLEURS ceb_ph (columns 3 and 4) and probes/ceb.txt. ──
    // normalizeCebuano per text (the symbol tier is inside it); phonemizeWord and nat over every letter run of
    // the texts (as written, lower, UPPER), every 1-3 letter string over the letters, apostrophes and hyphens,
    // and edge strings; numberToWords over 0…20,000, scaled samples, the ≥10⁹ digit path and raw strings.
    async "ceb-normalize"() {
        const N = await import("../../../src/languages/cebuano/normalize.ts");
        for (const [t, src] of textsFor(["ceb"], FLEURS_DIR.ceb, ["ceb.txt"])) emit({ text: units(t), src }, N.normalizeCebuano(t));
    },
    async "ceb-g2p"() {
        const { phonemizeWord } = await import("../../../src/languages/cebuano/cebuano.ts");
        const { makeNativiser } = await import("../../../src/core/hostWord.ts");
        const nat = makeNativiser("[a-zñ'ʼ-]", "iu"); // cebuano.ts's own (module-private) nativiser, same class and flags
        const words = new Set<string>();
        for (const t of textsFor(["ceb"], FLEURS_DIR.ceb, ["ceb.txt"]).keys())
            for (const m of t.matchAll(/[\p{L}\p{M}'ʼ‑-]+/gu)) { words.add(m[0]); words.add(m[0].toLowerCase()); words.add(m[0].toUpperCase()); }
        const abc = [..."abcdefghijklmnopqrstuvwxyzñ'ʼ-‑"];
        for (const a of abc) { words.add(a); for (const b of abc) { words.add(a + b); for (const c of abc) words.add(a + b + c); } }
        for (const w of ["", "\ud800", "a\ud800b", "ſala", "İlog", "ﬁlo", "MGA", "constructor", "__proto__", "--", "a-", "-a", "maayo", "kap-atan", "Ñ"]) words.add(w);
        for (const w of words) {
            emit({ word: units(w), op: "word" }, phonemizeWord(w));
            emit({ word: units(w), op: "nat" }, nat(w));
        }
    },
    async "ceb-numbers"() {
        const { numberToWords } = await import("../../../src/languages/cebuano/numbers.ts");
        const ns: number[] = [];
        for (let i = 0; i <= 20000; i++) ns.push(i);
        for (let k = 1; k < 1000; k += 3) ns.push(k * 1e3, k * 1e3 + 1, k * 1e3 + 22, k * 1e6, k * 1e6 + 1001, k * 1e6 + 999999);
        for (let e = 4; e <= 21; e++) ns.push(10 ** e, 10 ** e - 1, 10 ** e + 7);
        ns.push(999999999, 1e9, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER + 1, 1.5, -1, -0, -12, NaN, Infinity, -Infinity);
        for (const n of ns) emit({ n: String(n), raw: null }, numberToWords(n));
        for (const raw of ["12345678901234567890", "0001", "000", "1000000000", "9007199254740993", "", "1a2", "１２", "\ud800"])
            emit({ n: String(Number(raw)), raw: units(raw) }, numberToWords(Number(raw), raw));
    },
    // ── Hiligaynon (hil). Texts: the hil golden and probes/hil.txt (FLEURS has no hil). ──
    // normalizeHiligaynon per text (the symbol tier is inside it); phonemizeWord and nat over every letter run of
    // the texts (as written, lower, UPPER), every 1-3 letter string over the letters, apostrophes and hyphens,
    // and edge strings; numberToWords over 0…20,000, scaled samples, the ≥10⁹ digit path and raw strings.
    async "hil-normalize"() {
        const N = await import("../../../src/languages/hiligaynon/normalize.ts");
        for (const [t, src] of textsFor(["hil"], undefined, ["hil.txt"])) emit({ text: units(t), src }, N.normalizeHiligaynon(t));
        // ⚠ NO FLEURS FOR hil, so the arms are also driven by generated shapes: every arm's template over a sweep
        // of operands, each with the neighbours that must decline it (synthetic, never corpus text).
        const gen: string[] = [];
        for (let h = 0; h <= 25; h++) for (const mm of ["00", "05", "30", "59", "60", "7"])
            for (const pre of ["alas ", "las ", "Alas-", "ALAS ", "", "salas ", "alas  "]) gen.push(`${pre}${h}:${mm} sa aga`);
        for (const a of ["1", "12", "1.5", "1,000", "2,5", "10.25", "0"]) for (const b of ["2", "20", "3.5", "2,000", "7.125"])
            for (const sep of ["-", "–", " - ", "—", "--"]) for (const pre of ["", "halin sa ", "hasta ", "x", "ika-"]) gen.push(`${pre}${a}${sep}${b} ka adlaw`);
        for (const n of ["1", "12", "123", "1234", "0"]) for (const f of ["5", "25", "125", "05"]) gen.push(`${n}.${f}`, `${n}.${f}.`, `${n},${f}`, `${n}.${f}x`);
        for (const g of ["1,000", "12,345", "123,456,789", "1,23", "1,2345", "0,123", "1,000.5", "1,000,00"]) gen.push(`May ${g} ka tawo`);
        for (const w of ["dr", "Dr", "DR", "fr", "mrs", "Mrs", "prof", "st", "dſ", "xdr", "dr1"]) gen.push(`Si ${w}. Cruz`, `${w}.`);
        for (const n of ["1", "20", "100"]) for (const t of ["ng", "NG", "nga", "ngx"]) gen.push(`ika-${n}${t} adlaw`, `Ika-${n}${t}`);
        for (const w of ["sg", "Sg", "SG", "sg.", "1sg", "sg1", "sg/", "-sg", "sgt"]) gen.push(`balay ${w} tawo`);
        for (const t of gen) emit({ text: units(t), src: "generated" }, N.normalizeHiligaynon(t));
    },
    async "hil-g2p"() {
        const { phonemizeWord } = await import("../../../src/languages/hiligaynon/hiligaynon.ts");
        const { makeNativiser } = await import("../../../src/core/hostWord.ts");
        const nat = makeNativiser("[a-zñ'ʼ-]", "iu"); // hiligaynon.ts's own (module-private) nativiser, same class and flags
        const words = new Set<string>();
        for (const t of textsFor(["hil"], undefined, ["hil.txt"]).keys())
            for (const m of t.matchAll(/[\p{L}\p{M}'ʼ‑-]+/gu)) { words.add(m[0]); words.add(m[0].toLowerCase()); words.add(m[0].toUpperCase()); }
        const abc = [..."abcdefghijklmnopqrstuvwxyzñ'ʼ-‑"];
        for (const a of abc) { words.add(a); for (const b of abc) { words.add(a + b); for (const c of abc) words.add(a + b + c); } }
        for (const w of ["", "\ud800", "a\ud800b", "ſala", "İlog", "ﬁlo", "MGA", "constructor", "__proto__", "--", "a-", "-a", "daan", "kap-atan", "guitara", "queso", "gue", "qui", "ng", "gu", "Ñ"]) words.add(w);
        for (const w of words) {
            emit({ word: units(w), op: "word" }, phonemizeWord(w));
            emit({ word: units(w), op: "nat" }, nat(w));
        }
    },
    async "hil-numbers"() {
        const { numberToWords } = await import("../../../src/languages/hiligaynon/numbers.ts");
        const ns: number[] = [];
        for (let i = 0; i <= 20000; i++) ns.push(i);
        for (let k = 1; k < 1000; k += 3) ns.push(k * 1e3, k * 1e3 + 1, k * 1e3 + 22, k * 1e6, k * 1e6 + 1001, k * 1e6 + 999999);
        for (let e = 4; e <= 21; e++) ns.push(10 ** e, 10 ** e - 1, 10 ** e + 7);
        ns.push(999999999, 1e9, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER + 1, 1.5, -1, -0, -12, NaN, Infinity, -Infinity);
        for (const n of ns) emit({ n: String(n), raw: null }, numberToWords(n));
        for (const raw of ["12345678901234567890", "0001", "000", "1000000000", "9007199254740993", "", "1a2", "１２", "\ud800"])
            emit({ n: String(Number(raw)), raw: units(raw) }, numberToWords(Number(raw), raw));
    },
    // ── Ilocano (ilo). Texts: the ilo golden and probes/ilo.txt (FLEURS has no ilo), plus GENERATED shapes for
    // each normalize.ts arm and its neighbours (synthetic, never corpus text). ──
    async "ilo-normalize"() {
        const N = await import("../../../src/languages/ilocano/normalize.ts");
        for (const [t, src] of textsFor(["ilo"], undefined, ["ilo.txt"])) emit({ text: units(t), src }, N.normalizeIlocano(t));
        const gen: string[] = [];
        for (let h = 0; h <= 25; h++) for (const mm of ["00", "05", "30", "59", "60"])
            for (const [pre, post] of [["", " a.m."], ["", " pm"], ["", "PM"], ["", " p. m."], ["", " GMT"], ["", " UTC"], ["", " ti agsapa"], ["", " iti rabii"], ["", " ti aldawen"], ["oras a ", ""], ["oras ti ", ""], ["Oras nga ", ""], ["oras  a ", ""], ["", ""], ["+", " UTC"], ["-", " pm"], ["1.", " am"], ["", " amang"]])
                gen.push(`${pre}${h}:${mm}${post}`);
        for (const d of ["1h 30m", "2h30m", "12 h 5 m 20 s", "1h 2m 3.5s", "1h 30mx", "x1h 30m", "100h 3m", "1h"]) gen.push(`Nagbayag ${d}.`);
        for (const u of ["km²", "m²", "km", "m", "kg", "km³"]) for (const p of ["tunggal ", "tunggal maysa a ", "tunggal maysa nga ", "Tunggal ", "tunggal  "]) gen.push(`50 tao ${p}${u}`);
        for (const a of ["1", "12", "1.5", "1,000", "0"]) for (const b of ["2", "20", "3.5", "2,000", "7.125"])
            for (const sep of ["-", "–", " - ", "--"]) for (const pre of ["", "manipud ", "manipud iti ", "aginggana ti ", "x"]) gen.push(`${pre}${a}${sep}${b} nga aldaw`);
        for (const n of ["1", "12", "123", "0"]) for (const f of ["5", "25", "125"]) gen.push(`${n}.${f}`, `${n}.${f}.`, `${n}.${f}x`);
        for (const g of ["1,000", "12,345", "123,456,789", "1,23", "1,000.5"]) gen.push(`Adda ${g} a tao`);
        for (const d of ["30°C", "30 ° c", "86°F", "45°", "45° N", "30°Cx"]) gen.push(`Ti ${d} ditoy`);
        for (const m of ["−5", "x−5", "5 −3", "−x", "(−2)"]) gen.push(`Ti ${m} ditoy`);
        for (const w of ["blng", "Blng", "dr", "DR", "jr", "sr", "st", "dſ", "xdr"]) gen.push(`Ni ${w}. Cruz`, `${w}.`);
        for (const c of ["c. 1900", "ca. 1900", "C.1900", "c.x", "abc. 1900", "c. 19"]) gen.push(`Naipasngay ${c}`);
        for (const t of gen) emit({ text: units(t), src: "generated" }, N.normalizeIlocano(t));
    },
    async "ilo-g2p"() {
        const I = await import("../../../src/languages/ilocano/ilocano.ts");
        const words = new Set<string>();
        for (const k of loadTsvMap(new URL("../../../src/languages/ilocano/ilocano.ts", import.meta.url).href, "ilo-lexicon.tsv").keys()) { words.add(k); words.add(k.toUpperCase()); }
        for (const t of textsFor(["ilo"], undefined, ["ilo.txt"]).keys())
            for (const m of t.matchAll(/[\p{L}\p{M}'ʼ‑-]+/gu)) { words.add(m[0]); words.add(m[0].toLowerCase()); words.add(m[0].toUpperCase()); }
        const abc = [..."abcdefghijklmnopqrstuvwxyzñ'ʼ-‑"];
        for (const a of abc) { words.add(a); for (const b of abc) { words.add(a + b); for (const c of abc) words.add(a + b + c); } }
        const ctx = [..."aeiougqn"];
        for (const a of ctx) for (const b of ctx) for (const c of ctx) for (const d of ctx) words.add(a + b + c + d);
        for (const w of ["", "\ud800", "a\ud800b", "ſala", "İlog", "ﬁlo", "constructor", "__proto__", "--", "a-", "-a", "dua", "radio", "tao", "guitara", "queso", "garcia", "é", "É"]) words.add(w);
        for (const w of words) {
            emit({ word: units(w), op: "word" }, I.phonemizeWord(w));
            emit({ word: units(w), op: "rules" }, I.phonemizeWordRules(w));
            emit({ word: units(w), op: "nat" }, I.nat(w));
        }
    },
    async "ilo-numbers"() {
        const { numberToWords } = await import("../../../src/languages/ilocano/numbers.ts");
        const ns: number[] = [];
        for (let i = 0; i <= 20000; i++) ns.push(i);
        for (let k = 1; k < 1000; k += 3) ns.push(k * 1e3, k * 1e3 + 1, k * 1e3 + 22, k * 1e6, k * 1e6 + 1001, k * 1e6 + 999999);
        for (let e = 4; e <= 21; e++) ns.push(10 ** e, 10 ** e - 1, 10 ** e + 7);
        ns.push(999999999, 1e9, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER + 1, 1.5, -1, -0, -12, NaN, Infinity, -Infinity);
        for (const n of ns) emit({ n: String(n), raw: null }, numberToWords(n));
        for (const raw of ["12345678901234567890", "0001", "000", "1000000000", "9007199254740993", "", "1a2", "１２", "\ud800"])
            emit({ n: String(Number(raw)), raw: units(raw) }, numberToWords(Number(raw), raw));
    },
    // ── Catalan (ca). Inputs: the ca golden, FLEURS ca_es (columns 3 and 4) and probes/ca.txt. ──
    // normalizeCatalan, the symbol tier (rebuilt from catalan.ts's own literal) on its output, isUnreadableCatalan
    // over every letter run, and ordinalWords (m/f) over -2…2100 and the float/NaN/∞ corners.
    async "ca-normalize"() {
        const N = await import("../../../src/languages/catalan/normalize.ts");
        const symbols = await symbolsFromLiteral("catalan/catalan.ts");
        const words = new Set<string>();
        for (const [t, src] of textsFor(["ca"], FLEURS_DIR.ca, ["ca.txt"])) {
            const a = N.normalizeCatalan(t);
            emit({ text: units(t), src, op: "normalize" }, a);
            emit({ text: units(a), src, op: "symbols" }, symbols(a));
            for (const m of t.matchAll(/[\p{L}\p{M}·]+/gu)) { words.add(m[0]); words.add(m[0].toLowerCase()); }
        }
        for (const w of words) emit({ text: units(w), src: "words", op: "unreadable" }, String(N.isUnreadableCatalan(w)));
        const ns: number[] = [];
        for (let i = -2; i <= 2100; i++) ns.push(i);
        ns.push(0.5, 1.5, 21.5, -0, NaN, Infinity, 9999, 123456, 999999999, 1e9, 2 ** 53, 2 ** 53 + 2);
        for (const n of ns) for (const fem of [false, true])
            emit({ n: String(n), fem, src: "numeric", op: "ordinal" }, N.ordinalWords(n, fem) ?? "\u0000none");
    },
    // phonemizeWord (stressed and proclitic), toSegments and nat over every mid-vowel / geminate key, every letter
    // run of the texts (as written, lowercased, nativised), every 1-3 letter string over the Catalan letters and
    // every 4-letter string over the context letters, plus edge strings.
    async "ca-g2p"() {
        const C = await import("../../../src/languages/catalan/catalan.ts");
        const { toSegments } = await import("../../../src/languages/catalan/g2p.ts");
        const CA = new URL("../../../src/languages/catalan/catalan.ts", import.meta.url).href;
        const words = new Set<string>([...loadTsvMap(CA, "mid-vowels.tsv").keys(), ...loadTsvMap(CA, "bl-gl-geminate.tsv").keys()]);
        for (const t of textsFor(["ca"], FLEURS_DIR.ca, ["ca.txt"]).keys())
            for (const m of t.matchAll(/[\p{L}\p{M}·]+/gu)) { words.add(m[0]); words.add(m[0].toLowerCase()); words.add(C.nat(m[0])); }
        const abc = [..."abcdefghijklmnopqrstuvwxyzàèéíòóúüïç·"];
        for (const a of abc) { words.add(a); for (const b of abc) { words.add(a + b); for (const c of abc) words.add(a + b + c); } }
        const ctx = [..."aeiouxgrstlnyc·"];
        for (const a of ctx) for (const b of ctx) for (const c of ctx) for (const d of ctx) words.add(a + b + c + d);
        for (const w of ["", "\ud800", "a\ud800b", "ſant", "İgual", "ÀNGEL", "ﬁ", "naïf", "examen", "exèrcit", "pausa", "maig", "puig", "ig", "ix", "aix", "xx", "qq", "ñ", "ß", "Ñandú", "Qatar", "kiwi", "whisky"]) words.add(w);
        for (const w of words) {
            emit({ word: units(w), op: "word" }, C.phonemizeWord(w));
            emit({ word: units(w), op: "unstressed" }, C.phonemizeWord(w, true));
            emit({ word: units(w), op: "nat" }, C.nat(w));
            emit({ word: units(w), op: "segs" }, toSegments(w).map((s) => `${s.ph}/${s.nucleus ? 1 : 0}${s.accent ? 1 : 0}${s.reduced ?? "-"}`).join(" "));
        }
    },
    // numberToWords (with and without raw) and the Roman ordinal (ROMAN_POLICY.ordinal) over 0…20000 and beyond.
    async "ca-numbers"() {
        const { numberToWords } = await import("../../../src/languages/catalan/numbers.ts");
        const { ROMAN_POLICY } = await import("../../../src/languages/catalan/romanOrdinals.ts");
        const ns: number[] = [];
        for (let i = 0; i <= 20000; i++) ns.push(i);
        for (let k = 1; k < 1000; k++) ns.push(k * 1e3, k * 1e3 + 1, k * 1e3 + 21, k * 1e6, k * 1e6 + 1001, k * 1e6 + 999999);
        for (let e = 4; e <= 21; e++) ns.push(10 ** e, 10 ** e - 1, 10 ** e + 7);
        ns.push(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER + 1, 1e21, 1.5, -1, -0, NaN, Infinity, -Infinity);
        for (const n of ns) {
            emit({ n: String(n), raw: null, op: "words" }, numberToWords(n));
            emit({ n: String(n), raw: null, op: "roman" }, ROMAN_POLICY.ordinal(n) ?? "\u0000none");
        }
        for (const raw of ["12345678901234567890", "0001", "000", "1000000000", "9007199254740993", "", "1a2", "１２", "x𝟙"])
            emit({ n: String(Number(raw)), raw: units(raw), op: "words" }, numberToWords(Number(raw), raw));
    },
    // ── Galician (gl). Inputs: the gl golden, FLEURS gl_es (columns 3 and 4) and probes/gl.txt. ──
    // normalizeGalician, the symbol tier (rebuilt from galician.ts's own literal) on its output,
    // isUnreadableGalician over every letter run, and galicianOrdinal over -2…200 and the float corners.
    async "gl-normalize"() {
        const N = await import("../../../src/languages/galician/normalize.ts");
        const symbols = await symbolsFromLiteral("galician/galician.ts");
        const words = new Set<string>();
        for (const [t, src] of textsFor(["gl"], FLEURS_DIR.gl, ["gl.txt"])) {
            const a = N.normalizeGalician(t);
            emit({ text: units(t), src, op: "normalize" }, a);
            emit({ text: units(a), src, op: "symbols" }, symbols(a));
            for (const m of t.matchAll(/[\p{L}\p{M}]+/gu)) { words.add(m[0]); words.add(m[0].toLowerCase()); }
        }
        for (const w of words) emit({ text: units(w), src: "words", op: "unreadable" }, String(N.isUnreadableGalician(w)));
        const ns: number[] = [];
        for (let i = -2; i <= 200; i++) ns.push(i);
        ns.push(0.5, 1.5, 99.5, -0, NaN, Infinity);
        for (const n of ns) emit({ n: String(n), src: "numeric", op: "ordinal" }, N.galicianOrdinal(n) ?? "\u0000none");
    },
    // phonemizeWord, nat and toSegments over every letter run of the texts (as written, lowercased, nativised),
    // every 1-3 letter string over the Galician letters, every 4-letter string over the context letters, and edges.
    async "gl-g2p"() {
        const G = await import("../../../src/languages/galician/galician.ts");
        const { toSegments } = await import("../../../src/languages/galician/g2p.ts");
        const { makeNativiser } = await import("../../../src/core/hostWord.ts");
        const nat = makeNativiser("[a-záéíóúüñ]", "iu");
        const words = new Set<string>();
        for (const t of textsFor(["gl"], FLEURS_DIR.gl, ["gl.txt"]).keys())
            for (const m of t.matchAll(/[\p{L}\p{M}]+/gu)) { words.add(m[0]); words.add(m[0].toLowerCase()); words.add(nat(m[0])); }
        const abc = [..."abcdefghijklmnopqrstuvwxyzáéíóúüñ"];
        for (const a of abc) { words.add(a); for (const b of abc) { words.add(a + b); for (const c of abc) words.add(a + b + c); } }
        const ctx = [..."aeiouíúyxnhgqcrsl"];
        for (const a of ctx) for (const b of ctx) for (const c of ctx) for (const d of ctx) words.add(a + b + c + d);
        for (const w of ["", "\ud800", "a\ud800b", "ſol", "İgrexa", "ÁLBUM", "ﬁ", "muíño", "ruído", "viúva", "saíu", "cantou", "amei", "cans", "ningún", "xente", "texto", "Qatar", "kiwi", "ß", "ç", "whisky"]) words.add(w);
        for (const w of words) {
            emit({ word: units(w), op: "word" }, G.phonemizeWord(w));
            emit({ word: units(w), op: "nat" }, nat(w));
            emit({ word: units(w), op: "segs" }, toSegments(w).map((s) => `${s.ph}/${s.nucleus ? 1 : 0}${s.accent ? 1 : 0}`).join(" "));
        }
    },
    async "gl-numbers"() {
        const { numberToWords } = await import("../../../src/languages/galician/numbers.ts");
        const ns: number[] = [];
        for (let i = 0; i <= 20000; i++) ns.push(i);
        for (let k = 1; k < 1000; k++) ns.push(k * 1e3, k * 1e3 + 1, k * 1e3 + 21, k * 1e6, k * 1e6 + 1001, k * 1e9, k * 1e12 + 7, (k + 1000) * 1e6);
        for (let e = 4; e <= 21; e++) ns.push(10 ** e, 10 ** e - 1, 10 ** e + 7);
        ns.push(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER + 1, 999999999999999, 1e21, 1.5, -1, -0, NaN, Infinity, -Infinity);
        for (const n of ns) emit({ n: String(n), raw: null }, numberToWords(n));
        for (const raw of ["12345678901234567890", "0001", "000", "1000000000000000000", "9007199254740993", "", "1a2", "１２", "x𝟙"])
            emit({ n: String(Number(raw)), raw: units(raw) }, numberToWords(Number(raw), raw));
    },
    // ── Romanian (ro). Inputs: the ro golden, FLEURS ro_ro (columns 3 and 4) and probes/ro.txt. ──
    async "ro-normalize"() {
        const N = await import("../../../src/languages/romanian/normalize.ts");
        for (const [t, src] of textsFor(["ro"], FLEURS_DIR.ro, ["ro.txt"])) emit({ text: units(t), src }, N.normalizeRomanian(t));
    },
    // phonemizeWord (lexicon stress) and phonemizeWordRules (rule stress) and nat over every stress-lexicon key,
    // every letter run of the texts (as written, lowercased, nativised), every 1-3 letter string over the Romanian
    // letters, every 4-letter string over the context letters, and edge strings.
    async "ro-g2p"() {
        const R = await import("../../../src/languages/romanian/romanian.ts");
        const RO = new URL("../../../src/languages/romanian/romanian.ts", import.meta.url).href;
        const words = new Set<string>(loadTsvMap(RO, "romanian-stress.tsv").keys());
        for (const t of textsFor(["ro"], FLEURS_DIR.ro, ["ro.txt"]).keys())
            for (const m of t.matchAll(/[\p{L}\p{M}]+/gu)) { words.add(m[0]); words.add(m[0].toLowerCase()); words.add(R.nat(m[0])); }
        const abc = [..."abcdefghijklmnopqrstuvwxyzăâîșț"];
        for (const a of abc) { words.add(a); for (const b of abc) { words.add(a + b); for (const c of abc) words.add(a + b + c); } }
        const ctx = [..."aeiouăcghxqlrt"];
        for (const a of ctx) for (const b of ctx) for (const c of ctx) for (const d of ctx) words.add(a + b + c + d);
        for (const w of ["", "\ud800", "a\ud800b", "ſat", "İași", "ŞTIINŢĂ", "ştiinţă", "ﬁ", "este", "ESTE", "copii", "membri", "geografie", "cheie", "Alexandria", "examen", "x", "qu", "ß", "é", "𝐚b"]) words.add(w);
        for (const w of words) {
            emit({ word: units(w), op: "word" }, R.phonemizeWord(w));
            emit({ word: units(w), op: "rules" }, R.phonemizeWordRules(w));
            emit({ word: units(w), op: "nat" }, R.nat(w));
        }
    },
    // numberWords (cardinal and stem) and the Roman ordinal over 0…20000 and the magnitude strides.
    async "ro-numbers"() {
        const { numberWords } = await import("../../../src/languages/romanian/romanian.ts");
        const { ROMAN_POLICY } = await import("../../../src/languages/romanian/romanOrdinals.ts");
        const ns: number[] = [];
        for (let i = 0; i <= 20000; i++) ns.push(i);
        for (let k = 1; k < 1000; k++) ns.push(k * 1e3, k * 1e3 + 1, k * 1e3 + 2, k * 1e6, k * 1e6 + 21000, k * 1e9, k * 1e9 + 2e6 + 12);
        for (let e = 4; e <= 21; e++) ns.push(10 ** e, 10 ** e - 1, 10 ** e + 7);
        // No fractional n: the engine passes only integers, and a fraction indexes `NUM.units` with a non-integer.
        ns.push(Number.MAX_SAFE_INTEGER, 1e21, -1, -0, NaN, Infinity);
        for (const n of ns) {
            emit({ n: String(n), op: "words" }, numberWords(n));
            emit({ n: String(n), op: "stem" }, numberWords(n, { stem: true }));
            emit({ n: String(n), op: "roman" }, ROMAN_POLICY.ordinal(n) ?? "\u0000none");
        }
    },
    // ── Czech (cs). Inputs: the cs golden, FLEURS cs_cz (columns 3 and 4) and probes/cs.txt. ──
    // Each stage of text()'s normalization chain separately (op; the symbol tier is the one czech.ts builds,
    // recorded through the wrapper), a TS THROW recorded as its own output, the phonotactic test on every letter
    // run, plus synthetic rows: every ordinal step × numbers around its 1–999 domain, the clock grid, fractions.
    async "cs-normalize"() {
        const { register } = await import("node:module");
        register(new URL("./symbols-hook.mjs", import.meta.url));
        const { records } = await import("./symbols-wrap.ts");
        const N = await import("../../../src/languages/czech/normalize.ts");
        await import("../../../src/languages/czech/czech.ts");
        const rec = records.find((r) => /src\/languages\/czech\//u.test(r.stack.split("\n").slice(2).join("\n")))!;
        const norm = (t: string): string => { try { return N.normalizeCzech(t); } catch (e) { return `\u0000throw ${String(e)}`; } };
        const rows = new Map<string, string>();
        for (const [t, src] of textsFor(["cs"], FLEURS_DIR.cs, ["cs.txt"])) rows.set(t, src);
        const nums = ["0", "1", "2", "5", "12", "21", "39", "40", "99", "100", "101", "121", "999", "1000", "1001", "007", "12345678901234567890"];
        for (const n of nums)
            for (const tail of [" století", ", 12. století", " let", " letech", " ledna", " září", " červenci", " místě", " místo",
                " a 2. místě", " hodině", " hodinách", " pokus", " Pokus", ",", "–3.", "-1000.", "/5", " 1."])
                for (const head of ["", "ve ", "V ", "Karel "]) if (!rows.has(`${head}${n}.${tail}`)) rows.set(`${head}${n}.${tail}`, "synthetic");
        for (let h = 0; h <= 25; h++) for (const m of ["00", "01", "02", "05", "21", "59", "60"]) rows.set(`v ${h}:${m} hodin.`, "synthetic");
        for (const a of ["1", "2", "0", "01"]) for (const b of ["0", "1", "2", "3", "5", "10", "100", "999", "1000"]) rows.set(`${a}/${b}`, "synthetic");
        const words = new Set<string>();
        for (const [t, src] of rows) {
            const a = norm(t);
            emit({ text: units(t), src, op: "normalize" }, a);
            if (a.startsWith("\u0000throw")) continue;
            const b = N.normalizeCzechInitialisms(a);
            emit({ text: units(a), src, op: "initialisms" }, b);
            emit({ text: units(b), src, op: "symbols" }, rec.apply(b));
            for (const m of t.matchAll(/[\p{L}\p{M}]+/gu)) { words.add(m[0]); words.add(m[0].toLowerCase()); }
        }
        for (const w of words) emit({ text: units(w), src: "words", op: "unreadable" }, String(N.isUnreadableCzech(w)));
    },
    // phonemizeWord and toSegments over every letter run of the texts (as written and lowercased), every lexicon
    // key, every 1-3 letter string of the alphabet, every 4-letter string over the letters the context rules look
    // at, and corner strings; plus the nativiser (czech.ts's `nat`) over the runs and foreign names.
    async "cs-g2p"() {
        const { phonemizeWord, nat } = await import("../../../src/languages/czech/czech.ts");
        const { toSegments } = await import("../../../src/languages/czech/g2p.ts");
        const CZECH = new URL("../../../src/languages/czech/czech.ts", import.meta.url).href;
        const words = new Set<string>();
        for (const t of langTexts("cs")) for (const m of t.matchAll(/[\p{L}\p{M}]+/gu)) { words.add(m[0]); words.add(m[0].toLowerCase()); }
        for (const k of loadTsvMap(CZECH, "loanwords.tsv").keys()) { words.add(k); words.add(k.toUpperCase()); words.add(k + "a"); }
        const abc = [..."aábcčdďeéěfghiíjklmnňoópqrřsštťuúůvwxyýzž"];
        for (const a of abc) { words.add(a); for (const b of abc) { words.add(a + b); for (const c of abc) words.add(a + b + c); } }
        const ctx = [..."ěinmdtbvrlhkzsux"];
        for (const a of ctx) for (const b of ctx) for (const c of ctx) for (const d of ctx) words.add(a + b + c + d);
        for (const w of ["", "İ", "İstanbul", "ſ", "ẞ", "\ud800", "a\udc00z", "𝐚𝐛", "ĚĚ", "ŘEKA", "Ch", "CH", "ě", "nnn", "nně", "nň",
            "rrr", "lrl", "vztah", "vzhled", "shoda", "kdo", "abeceda", "neuron", "iia", "yě"]) words.add(w);
        for (const w of words) {
            emit({ word: units(w), op: "word" }, phonemizeWord(w));
            emit({ word: units(w), op: "segs" }, toSegments(w).map((s) => `${s.ph}/${s.nucleus ? 1 : 0}`).join(" "));
        }
        for (const w of [...words, "São", "Müller", "Dvořák", "Ørsted", "Žižek", "Ångström", "Œuvre", "façade", "Tōkyō", "Nguyễn"])
            emit({ word: units(w), op: "nat" }, nat(w));
    },
    // numberToWords (with and without raw), readDigits (through numberToWords' raw fallback) and csCountForm.
    async "cs-numbers"() {
        const { numberToWords } = await import("../../../src/languages/czech/numbers.ts");
        const { csCountForm } = await import("../../../src/languages/czech/normalize.ts");
        const ns: number[] = [];
        for (let i = 0; i <= 20000; i++) ns.push(i);
        for (let e = 4; e <= 21; e++) ns.push(10 ** e, 10 ** e - 1, 10 ** e + 7, 1234567 * 10 ** (e - 4) + 42);
        for (let k = 1; k < 1000; k++) ns.push(k * 1e3, k * 1e3 + 21, k * 1e6, k * 1e6 + 2001, k * 1e6 + 1000, k * 1e9, k * 1e9 + 12013);
        ns.push(Number.MAX_SAFE_INTEGER, 2 ** 53, 1e12 - 1, 1e12, 1.5, 2.7, -1, -21, -0, NaN, Infinity, -Infinity, 0.1, 1e-7, 112, 1012, 22.5);
        for (const n of ns) {
            emit({ n: String(n), op: "words" }, numberToWords(n));
            emit({ n: String(n), op: "count" }, String(csCountForm(n)));
        }
        for (const raw of ["0", "007", "1234567890", "1000000000000", "99999999999999999999", "1e3", "12a", "１２", "𝟙2", "", "\ud800", "1000000000000\ud800𝟙"]) {
            emit({ n: String(Number(raw)), raw: units(raw), op: "words" }, numberToWords(Number(raw), raw));
            // the readDigits fallback over an arbitrary raw string
            emit({ n: "1000000000000", raw: units(raw), op: "words" }, numberToWords(1e12, raw));
        }
    },
    // ── Slovak (sk). Inputs: the sk golden, FLEURS sk_sk (columns 3 and 4) and probes/sk.txt. ──
    // normalizeSlovak (which runs the symbol tier and the initialism pass itself), the initialism pass alone on
    // the raw text, the phonotactic test on every letter run, plus synthetic rows: numbers around the ordinal
    // domain × every licensor head × 3 heads, the clock grid after each governing preposition, fractions.
    async "sk-normalize"() {
        const N = await import("../../../src/languages/slovak/normalize.ts");
        const rows = new Map<string, string>();
        for (const [t, src] of textsFor(["sk"], FLEURS_DIR.sk, ["sk.txt"])) rows.set(t, src);
        const heads = ["storočia", "storočí", "storočím", "mieste", "kategórie", "gólom", "najväčšou", "rokoch", "augusta", "typ", "ročník", "Ročník", ","];
        for (const n of ["0", "1", "3", "13", "23", "39", "40", "100", "103", "190", "999", "1000", "1001", "1918", "9999", "007"])
            for (const h of heads) for (const pre of ["", "v ", "Alžbeta ", "Alžbety ", "Lealofiho ", "11., "])
                rows.set(`${pre}${n}. ${h}`, "synthetic");
        for (const p of ["", "o ", "medzi ", "do ", "Okolo "])
            for (let h = 0; h <= 24; h++) for (const m of ["00", "05", "21", "59"]) rows.set(`${p}${h}:${m} hod.`, "synthetic");
        for (const a of ["1", "2", "3", "5", "21", "0"]) for (const b of ["0", "1", "2", "3", "4", "5", "10", "11", "02"]) rows.set(`${a}/${b}`, "synthetic");
        const words = new Set<string>();
        for (const [t, src] of rows) {
            emit({ text: units(t), src, op: "normalize" }, N.normalizeSlovak(t));
            emit({ text: units(t), src, op: "initialisms" }, N.normalizeSlovakInitialisms(t));
            for (const m of t.matchAll(/[\p{L}\p{M}]+/gu)) { words.add(m[0]); words.add(m[0].toLowerCase()); }
        }
        for (const w of words) emit({ text: units(w), src: "words", op: "unreadable" }, String(N.isUnreadableSlovak(w)));
        const slots = ["m.nom", "m.gen", "m.dat", "m.loc", "m.instr", "f.nom", "f.gen", "f.acc", "f.instr", "n.nom", "n.gen", "n.loc", "n.instr", "pl.nom", "pl.gen"];
        const ns: number[] = [];
        for (let i = 0; i <= 3000; i++) ns.push(i);
        ns.push(999999, 1000000, 123456, 20000, 20003, 1.5, -1, NaN, Infinity);
        for (const n of ns) for (const slot of slots) emit({ n: String(n), slot, op: "ordinal" }, N.ordinalWords(n, slot as any) ?? "\u0000none");
    },
    // phonemizeWord and toSegments over every letter run, every 1-3 letter string of the alphabet, every 4-letter
    // string over the letters the context rules look at, and corner strings; plus the nativiser (slovak.ts's
    // NATIVE_CLASS, copied) over the runs and foreign names.
    async "sk-g2p"() {
        const { phonemizeWord } = await import("../../../src/languages/slovak/slovak.ts");
        const { toSegments } = await import("../../../src/languages/slovak/g2p.ts");
        const { makeNativiser } = await import("../../../src/core/hostWord.ts");
        const nat = makeNativiser("[A-Za-zÁáÄäČčĎďÉéÍíĹĺĽľŇňÓóÔôŔŕŠšŤťÚúÝýŽž]", "u");
        const words = new Set<string>();
        for (const t of langTexts("sk")) for (const m of t.matchAll(/[\p{L}\p{M}]+/gu)) { words.add(m[0]); words.add(m[0].toLowerCase()); }
        const abc = [..."aáäbcčdďeéfghiíjklĺľmnňoóôpqrŕsštťuúvwxyýzž"];
        for (const a of abc) { words.add(a); for (const b of abc) { words.add(a + b); for (const c of abc) words.add(a + b + c); } }
        const ctx = [..."vdtnliezhcskrbaž"];
        for (const a of ctx) for (const b of ctx) for (const c of ctx) for (const d of ctx) words.add(a + b + c + d);
        for (const w of ["", "İ", "ſ", "\ud800", "a\udc00z", "𝐚𝐛", "CH", "Dz", "DŽ", "kkk", "ssss", "vvv", "fv", "zv", "é", "ia", "iai"]) words.add(w);
        for (const w of words) {
            emit({ word: units(w), op: "word" }, phonemizeWord(w));
            emit({ word: units(w), op: "segs" }, toSegments(w).map((s) => `${s.ph}/${s.nucleus ? 1 : 0}`).join(" "));
        }
        for (const w of [...words, "São", "Müller", "Dvořák", "Ørsted", "Žižek", "Ångström", "Œuvre", "façade", "Tōkyō", "Nguyễn"])
            emit({ word: units(w), op: "nat" }, nat(w));
    },
    // numberToWords (with and without raw), readDigits and skCountForm.
    async "sk-numbers"() {
        const { numberToWords, readDigits } = await import("../../../src/languages/slovak/numbers.ts");
        const { skCountForm } = await import("../../../src/languages/slovak/slovak.ts");
        const ns: number[] = [];
        for (let i = 0; i <= 20000; i++) ns.push(i);
        for (let e = 4; e <= 21; e++) ns.push(10 ** e, 10 ** e - 1, 10 ** e + 7, 1234567 * 10 ** (e - 4) + 42);
        for (let k = 1; k < 1000; k++) ns.push(k * 1e3, k * 1e3 + 21, k * 1e6, k * 1e6 + 2001, k * 1e6 + 1000);
        ns.push(Number.MAX_SAFE_INTEGER, 2 ** 53, 1e9 - 1, 1e9, 1.5, 2.7, -1, -21, -0, NaN, Infinity, -Infinity, 0.1, 1e-7, 22.5);
        for (const n of ns) {
            emit({ n: String(n), op: "words" }, numberToWords(n));
            emit({ n: String(n), op: "count" }, String(skCountForm(n)));
        }
        for (const raw of ["0", "007", "1234567890", "99999999999999999999", "1e3", "12a", "１２", "𝟙2", "", "\ud800"]) {
            emit({ n: String(Number(raw)), raw: units(raw), op: "words" }, numberToWords(Number(raw), raw));
            emit({ n: "1000000000", raw: units(raw), op: "words" }, numberToWords(1e9, raw));
            emit({ n: "0", raw: units(raw), op: "digits" }, readDigits(raw));
        }
    },
    // ── Belarusian (be). Inputs: the be golden, FLEURS be_by (columns 3 and 4) and probes/be.txt. ──
    // Each stage of text()'s normalization chain (op; the symbol tier is the one belarusian.ts built, recorded
    // through the wrapper), the phonotactic test on every letter run, plus synthetic rows: numbers × written
    // suffixes (every 1–3 letter tail of every ordinal / genitive form), the clock grid, fractions, and the
    // dotted abbreviations behind each follower shape.
    async "be-normalize"() {
        const { register } = await import("node:module");
        register(new URL("./symbols-hook.mjs", import.meta.url));
        const { records } = await import("./symbols-wrap.ts");
        const N = await import("../../../src/languages/belarusian/normalize.ts");
        await import("../../../src/languages/belarusian/belarusian.ts");
        const rec = records.find((r) => /src\/languages\/belarusian\//u.test(r.stack.split("\n").slice(2).join("\n")))!;
        const rows = new Map<string, string>();
        for (const [t, src] of textsFor(["be"], FLEURS_DIR.be, ["be.txt"])) rows.set(t, src);
        const add = (t: string): void => { if (!rows.has(t)) rows.set(t, "synthetic"); };
        const suffixes = new Set(["ы", "га", "му", "ым", "е", "я", "х", "ай", "ой", "мі", "ці", "і", "ага", "ога", "яга", "аму", "ому", "яму", "ае", "ое", "яе", "ыя", "ія", "ых", "іх", "ая", "яя", "яй", "ымі", "імі", "ГА", "Х", "ш", "шы", "го"]);
        const ns = ["0", "1", "2", "3", "4", "5", "9", "10", "11", "13", "19", "20", "21", "22", "23", "28", "30", "40", "42", "50", "90", "99", "100", "101", "140", "200", "999", "1000", "1001", "1950", "2000", "2010", "3000", "9000", "10000", "10001", "21000", "999999", "1000000", "12345678901234567890"];
        for (const n of ns) for (const suf of suffixes) add(`${n}-${suf}`);
        for (let h = 0; h <= 24; h++) for (const mm of ["00", "05", "30", "59"]) add(`у ${h}:${mm}.`);
        for (let a = 0; a <= 11; a++) for (const b of [0, 1, 2, 3, 4, 5, 7, 10, 11, 12]) add(`${a}/${b}`);
        for (const ab of ["гг", "ст", "стст", "нар", "пам", "інш", "тыс", "напр", "гл", "вул", "дол", "СТ", "Гл", "ᲃт", "ᲁол"])
            for (const tail of [" слова", ", далей", ".", " Потым", ")", ""]) add(`гэта ${ab}.${tail}`);
        const words = new Set<string>();
        for (const [t, src] of rows) {
            const a = N.normalizeBelarusian(t);
            emit({ text: units(t), src, op: "normalize" }, a);
            const b = N.normalizeBelarusianInitialisms(a);
            emit({ text: units(a), src, op: "initialisms" }, b);
            emit({ text: units(b), src, op: "symbols" }, rec.apply(b));
            for (const m of t.matchAll(/[\p{L}\p{M}]+/gu)) { words.add(m[0]); words.add(m[0].toLowerCase()); }
        }
        for (const w of words) emit({ text: units(w), src: "words", op: "unreadable" }, String(N.isUnreadableBelarusian(w)));
    },
    // phonemizeWord over every Cyrillic-block run of the texts (as written and lowercased), every 1-3 letter
    // string of the alphabet plus the apostrophes and four non-Belarusian Cyrillic letters, and every 4-letter
    // string of the context letters.
    async "be-g2p"() {
        const B = await import("../../../src/languages/belarusian/belarusian.ts");
        const words = new Set<string>();
        for (const t of langTexts("be")) for (const w of t.match(/[Ѐ-ӿ'’ʼ]+/gu) ?? []) { words.add(w); words.add(w.toLowerCase()); }
        const abc = [..."абвгґдеёжзійклмнопрстуўфхцчшыьэюя'’ъщиї"];
        for (const a of abc) { words.add(a); for (const b of abc) { words.add(a + b); for (const c of abc) words.add(a + b + c); } }
        const ctx = [..."дзжьіяеўйлсцнтв'"];
        for (const a of ctx) for (const b of ctx) for (const c of ctx) for (const d of ctx) words.add(a + b + c + d);
        for (const w of ["", "ВАДА", "\ud800", "a\ud800б", "ллля", "нння", "ццца", "чччч", "ддзь", "дзьдзь", "сссь", "зззь"]) words.add(w);
        for (const w of words) emit({ word: units(w), op: "word" }, B.phonemizeWord(w));
    },
    // renderNumber(n, DEF.numbers, identity, eastSlavicNumberWords) with the be table, and the Roman ordinal.
    async "be-numbers"() {
        const { renderNumber } = await import("../../../src/core/numbers.ts");
        const { eastSlavicNumberWords } = await import("../../../src/languages/ukrainian/numbers.ts");
        const { loadManifest } = await import("../../../src/core/loadManifest.ts");
        const { ROMAN_POLICY } = await import("../../../src/languages/belarusian/romanOrdinals.ts");
        const BE = loadManifest<any>(new URL("../../../src/languages/belarusian/belarusian.ts", import.meta.url).href, "belarusian.jsonc");
        const ns: number[] = [];
        for (let i = 0; i <= 20000; i++) ns.push(i);
        for (let e = 4; e <= 15; e++) ns.push(10 ** e, 10 ** e - 1, 10 ** e + 7, 1234567 * 10 ** (e - 4) + 42);
        for (let k = 1; k < 1000; k++) ns.push(k * 1e3, k * 1e3 + 21, k * 1e6, k * 1e6 + 2001, k * 1e9 + 1002, k * 1e12 + 22000);
        ns.push(Number.MAX_SAFE_INTEGER);
        for (const n of ns) emit({ n: String(n), op: "words" }, renderNumber(n, BE.numbers, (w: string) => w, eastSlavicNumberWords));
        for (const n of [...Array(121).keys(), -1, 1.5, NaN, Infinity, 1000])
            emit({ n: String(n), op: "roman" }, ROMAN_POLICY.ordinal(n) ?? "\u0000none");
    },
    // normalizeRomans with Belarusian's policy (registry.ts romanBe) over the Belarusian texts.
    async "be-roman"() {
        const { normalizeRomans } = await import("../../../src/core/roman.ts");
        const { ROMAN_POLICY } = await import("../../../src/languages/belarusian/romanOrdinals.ts");
        for (const [t, src] of textsFor(["be"], FLEURS_DIR.be, ["be.txt"])) emit({ text: units(t), src }, normalizeRomans(t, ROMAN_POLICY));
    },
    // ── Bulgarian (bg). Inputs: the bg golden, FLEURS bg_bg (columns 3 and 4) and probes/bg.txt. ──
    // normalizeBulgarian per text, plus synthetic rows: every unit / squared / currency / degree / rate shape
    // after a number with and without a space, the clock grid, decimals, and signs in each position.
    async "bg-normalize"() {
        const N = await import("../../../src/languages/bulgarian/normalize.ts");
        const rows = new Map<string, string>();
        for (const [t, src] of textsFor(["bg"], FLEURS_DIR.bg, ["bg.txt"])) rows.set(t, src);
        const add = (t: string): void => { if (!rows.has(t)) rows.set(t, "synthetic"); };
        for (const u of ["км", "кг", "см", "мм", "km", "kg", "cm", "mm", "м", "г", "г.", "км²", "км2", "м³", "KM", "Км", "%", "°", "°C", "℃", "$", "€", "£", "¥", "км/ч", "м/с", "мили/час"])
            for (const n of ["5", "1,5", "12 000"]) { add(`${n}${u} края`); add(`${n} ${u} края`); add(`${u}${n}`); }
        for (let h = 0; h <= 25; h++) for (const m of ["00", "05", "59", "5"]) add(`в ${h}:${m}.`);
        for (const s of ["-", "−", "+", "–", "—"]) for (const ctx of ["", "а", "5", " ", "("]) add(`${ctx}${s}5 и 3${s}4`);
        for (const w of rows.keys()) emit({ text: units(w), src: rows.get(w)!, op: "normalize" }, N.normalizeBulgarian(w));
    },
    // phonemizeWord over every Cyrillic-block run of the texts (as written and lowercased), every 1-3 letter
    // string of the alphabet plus the apostrophe, stress marks and four non-Bulgarian Cyrillic letters, and every
    // 4-letter string of the context letters; numberToText via the engine's number reading.
    async "bg-g2p"() {
        const B = await import("../../../src/languages/bulgarian/bulgarian.ts");
        const words = new Set<string>();
        for (const t of langTexts("bg")) for (const w of t.match(/[Ѐ-ӿ'’̀́]+/gu) ?? []) { words.add(w); words.add(w.toLowerCase()); }
        const abc = [..."абвгдежзийклмнопрстуфхцчшщъьюя'ёыэѝ́"];
        for (const a of abc) { words.add(a); for (const b of abc) { words.add(a + b); for (const c of abc) words.add(a + b + c); } }
        const ctx = [..."лняюьстзкгвдшчбп"];
        for (const a of ctx) for (const b of ctx) for (const c of ctx) for (const d of ctx) words.add(a + b + c + d);
        for (const w of ["", "ГРАД", "\ud800", "a\ud800б", "ттт", "сстк", "ьь", "яя", "йя", "щя"]) words.add(w);
        for (const w of words) emit({ word: units(w), op: "word" }, B.phonemizeWord(w));
        const P = B.createBulgarian();
        const ns: string[] = [];
        for (let i = 0; i <= 20000; i++) ns.push(String(i));
        for (let k = 1; k < 1000; k++) ns.push(String(k * 1000), String(k * 1e6), String(k * 1e6 + 1001), String(k * 1e9 + 21), String(k * 1e6 + 100));
        ns.push("9007199254740991", "9007199254740993", "12345678901234567890", "007", "1000000000000");
        for (const n of ns) emit({ word: units(n), op: "number" }, P.text(n));
    },
    // ── Macedonian (mk). Inputs: the mk golden, FLEURS mk_mk (columns 3 and 4) and probes/mk.txt. ──
    // Each stage of text()'s normalization chain (op; the symbol tier is the one macedonian.ts built, recorded
    // through the wrapper), the phonotactic test on every letter run, plus synthetic rows: numbers × every
    // ordinal suffix (with and without the hyphen and a following word), centuries, dates, the clock grid,
    // regnal shapes and fractions.
    async "mk-normalize"() {
        const { register } = await import("node:module");
        register(new URL("./symbols-hook.mjs", import.meta.url));
        const { records } = await import("./symbols-wrap.ts");
        const N = await import("../../../src/languages/macedonian/normalize.ts");
        await import("../../../src/languages/macedonian/macedonian.ts");
        const rec = records.find((r) => /src\/languages\/macedonian\//u.test(r.stack.split("\n").slice(2).join("\n")))!;
        const rows = new Map<string, string>();
        for (const [t, src] of textsFor(["mk"], FLEURS_DIR.mk, ["mk.txt"])) rows.set(t, src);
        const add = (t: string): void => { if (!rows.has(t)) rows.set(t, "synthetic"); };
        const sufs = ["тите", "тиот", "миот", "виот", "риот", "тина", "ите", "от", "ти", "ви", "ми", "ри", "та", "ма", "те"];
        const ns = ["0", "1", "2", "3", "7", "10", "11", "20", "21", "40", "99", "100", "101", "116", "190", "200", "1000", "1001", "1970", "2000", "9999", "10000", "1000000"];
        for (const n of ns) for (const s of sufs) { add(`${n}-${s}`); add(`${n}${s} години`); add(`${n} - ${s} век`); }
        for (const n of ns) { add(`${n} век`); add(`${n} и 5 век`); add(`${n}. век`); add(`${n} мај`); add(`${n}. јули - 3 август`); add(`Петар ${n}.`); add(`Ана ${n},`); }
        for (let h = 0; h <= 24; h++) for (const m of ["00", "05", "30", "59"]) { add(`во ${h}:${m}`); add(`во ${h}:${m} ч.`); }
        for (const a of ["1", "2", "0", "12"]) for (const b of ["1", "2", "3", "4", "5", "6", "7", "10"]) add(`${a}/${b}`);
        const words = new Set<string>();
        for (const [t, src] of rows) {
            const a = N.normalizeMacedonian(t);
            emit({ text: units(t), src, op: "normalize" }, a);
            const b = N.normalizeMacedonianInitialisms(a);
            emit({ text: units(a), src, op: "initialisms" }, b);
            emit({ text: units(b), src, op: "symbols" }, rec.apply(b));
            for (const m of t.matchAll(/[\p{L}\p{M}]+/gu)) { words.add(m[0]); words.add(m[0].toLowerCase()); }
        }
        for (const w of words) emit({ text: units(w), src: "words", op: "unreadable" }, String(N.isUnreadableMacedonian(w)));
    },
    // phonemizeWord over every Cyrillic-block run, every 1-3 letter string of the alphabet plus five
    // non-Macedonian Cyrillic letters, and every 4-letter string over the context letters.
    async "mk-g2p"() {
        const M = await import("../../../src/languages/macedonian/macedonian.ts");
        const words = new Set<string>();
        for (const t of langTexts("mk")) for (const w of t.match(/[Ѐ-ӿ]+/gu) ?? []) { words.add(w); words.add(w.toLowerCase()); }
        const abc = [..."абвгдѓежзѕијклљмнњопрстќуфхцчџшѐѝйюяыщ"];
        for (const a of abc) { words.add(a); for (const b of abc) { words.add(a + b); for (const c of abc) words.add(a + b + c); } }
        const ctx = [..."лрнкгвдзсшчтаеиј"];
        for (const a of ctx) for (const b of ctx) for (const c of ctx) for (const d of ctx) words.add(a + b + c + d);
        for (const w of ["", "ГРАД", "\ud800", "a\ud800б", "ррр", "рр", "р"]) words.add(w);
        for (const w of words) emit({ word: units(w), op: "word" }, M.phonemizeWord(w));
    },
    // numberToText (with and without raw) and mkOrdinal.
    async "mk-numbers"() {
        const { numberToText, mkOrdinal } = await import("../../../src/languages/macedonian/numbers.ts");
        const ns: number[] = [];
        for (let i = 0; i <= 20000; i++) ns.push(i);
        for (let e = 4; e <= 21; e++) ns.push(10 ** e, 10 ** e - 1, 10 ** e + 7, 1234567 * 10 ** (e - 4) + 42);
        for (let k = 1; k < 1000; k++) ns.push(k * 1e3, k * 1e3 + 21, k * 1e6, k * 1e6 + 2001, k * 1e6 + 100);
        ns.push(Number.MAX_SAFE_INTEGER, 1.5, -1, -0, NaN, Infinity, 0.5);
        for (const n of ns) {
            emit({ n: String(n), op: "words" }, numberToText(n));
            emit({ n: String(n), op: "ordinal" }, mkOrdinal(n) ?? "\u0000none");
        }
        for (const raw of ["1234567890", "99999999999999999999", "１２", "𝟙2", "12a3", "\ud800"])
            emit({ n: "1000000000", raw: units(raw), op: "words" }, numberToText(1e9, raw));
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
    // fr-CA: toQuebecois over every Lexique / supplement reading and every 1-3 symbol string over the delta's
    // context alphabet; phonemizeWord (France text() + the delta) over every letter run of the fr / fr-CA texts.
    async "frca-word"() {
        const Q = await import("../../../src/languages/french-ca/french-ca.ts");
        const FR = new URL("../../../src/languages/french/french.ts", import.meta.url).href;
        const ipa = new Set<string>([...loadTsvMap(FR, "lexicon.tsv").values(), ...loadTsvMap(FR, "supplement.tsv").values()]);
        const alpha = ["t", "d", "i", "y", "u", "ɥ", "j", "a", "ˈ", "ˌ", "p", "k", "s", "ʁ", "v", "z", "ʒ", "l", "ɛ", "͡", "ʃ", " ", ".", "»", "…", "ɑ", "\uD800"];
        for (const a of alpha) { ipa.add(a); for (const b of alpha) { ipa.add(a + b); for (const c of alpha) ipa.add(a + b + c); } }
        for (const s of ipa) emit({ word: units(s), op: "quebec" }, Q.toQuebecois(s));
        const words = new Set<string>();
        for (const t of textsFor(["fr", "fr-CA"], "fr_fr", ["fr.txt", "fr-CA.txt"]).keys())
            for (const m of t.matchAll(/[\p{L}\p{M}'’-]+/gu)) words.add(m[0]);
        for (const w of words) emit({ word: units(w), op: "word" }, Q.phonemizeWord(w));
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
        // The folded letters (letterFolds), alone, inside a word and in both cases (#1513).
        for (const f of ["ѣ", "і", "ѳ", "ѵ", "ї", "є", "ґ"]) for (const c of [f, f.toUpperCase()])
            for (const w of [c, `х${c}бъ`, `${c}ва`, `ки${c}в`]) words.add(w);
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
        // cardinalInCase (#1513) over its range, both ends and the off-range corners.
        const { cardinalInCase } = await import("../../../src/languages/russian/numbers.ts");
        const cs: number[] = [];
        for (let i = -1; i <= 1001; i++) cs.push(i);
        cs.push(1.5, -0, NaN, Infinity, 2 ** 53);
        for (const n of cs) for (const kase of ["genitive", "instrumental"] as const)
            emit({ n: String(n), raw: null, op: kase }, cardinalInCase(n, kase) ?? "\u0000none");
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
    // ── Slovenian (sl). Inputs: the sl golden, FLEURS sl_si (columns 3 and 4) and probes/sl.txt, plus synthetic
    // rows for the arms the texts reach sparsely: `N.` before every licensor (and the bare-ordinal endings),
    // the clock after every governing preposition, regnal titles, fractions, decades, scores and ranges, the
    // gender repair before every counted noun's forms, and the dotted abbreviations before each follower.
    async "sl-normalize"() {
        const N = await import("../../../src/languages/slovenian/normalize.ts");
        const { SYMBOLS, COUNTED } = await import("../../../src/languages/slovenian/slovenian.ts");
        const src = readFileSync(new URL("../../../src/languages/slovenian/normalize.ts", import.meta.url), "utf8");
        const block = src.slice(src.indexOf("const LICENSOR: Readonly"), src.indexOf("const LICENSOR_ALT"));
        const licensors = [...block.matchAll(/^\s+([\p{L}]+): "/gmu)].map((m) => m[1]!);
        const rows = new Map<string, string>();
        for (const [t, s] of textsFor(["sl"], FLEURS_DIR.sl, ["sl.txt"])) rows.set(t, s);
        const add = (t: string): void => { if (!rows.has(t)) rows.set(t, "synthetic"); };
        const ns = ["0", "1", "2", "3", "4", "5", "11", "20", "21", "99", "100", "101", "120", "999", "1000", "1001", "1991", "2000", "2016", "21000", "999999", "1000000"];
        for (const n of ns) {
            for (const w of licensors) add(`V ${n}. ${w} je.`);
            for (const w of ["prvega", "letih", "naprej", "constructor", "Toda"]) add(`Bil je ${n}. ${w}`);
            add(`${n}., ${n}. in ${n}. stoletja`); add(`${n}-ih`); add(`${n}-letni`); add(`${n} 1/2`); add(`${n}/3`);
            for (const t of ["kralj Karel", "kralja Ludvika XIV", "cesarica Marija", "papež Janez Pavel"]) { add(`${t} ${n}.`); add(`${t} ${n}. Nato`); add(`${t} ${n} je`); }
        }
        for (let h = 0; h <= 25; h++) for (const mm of ["00", "05", "30", "59"]) {
            add(`${h}:${mm}`); add(`${h}.${mm} ure`); add(`${h}${mm} UTC`);
            for (const p of ["ob", "po", "okoli", "od", "do", "med", "pred", "Ob", "OD", "konec"]) add(`${p} ${h}:${mm}`);
        }
        for (const [a, b] of [["3", "2"], ["2", "3"], ["10", "12"], ["1990", "95"], ["1990", "1995"], ["5", "5"]]) for (const m of [":", "-", "–"]) add(`Izid ${a}${m}${b} proti`);
        for (const c of Object.values(COUNTED)) for (const n of ["1", "2", "3", "4", "5", "do 3", "1,5"]) for (const f of c.forms) add(`${n} ${f}`);
        for (const ab of ["itd.", "npr.", "oz.", "idr.", "št.", "ml.", "Itd.", "ŠT.", "Dr.", "dr.", "G.", "Ga.", "St.", "Inc.", "et al.", "pr. n. št.", "n. št."])
            for (const after of ["", " u", " Ana", ",", ")", ".", " „x"]) add(`Bilo je ${ab}${after}`);
        const words = new Set<string>();
        for (const [t, from] of rows) {
            emit({ text: units(t), src: from, op: "normalize" }, N.normalizeSlovenian(t));
            emit({ text: units(t), src: from, op: "initialisms" }, N.normalizeSlovenianInitialisms(t));
            emit({ text: units(t), src: from, op: "symbols" }, SYMBOLS(t));
            for (const m of t.matchAll(/[\p{L}\p{M}]+/gu)) { words.add(m[0]); words.add(m[0].toLowerCase()); }
        }
        for (const w of words) emit({ text: units(w), src: "words", op: "unreadable" }, String(N.isUnreadableSlovenian(w)));
        const slots = ["m.nom", "m.gen", "m.dat", "m.loc", "m.instr", "f.nom", "f.gen", "f.dat", "f.acc", "n.nom", "n.gen", "n.loc", "n.instr", "pl.nom", "pl.gen"];
        const nums: number[] = [];
        for (let i = -1; i <= 1100; i++) nums.push(i);
        nums.push(1999, 2000, 2016, 3000, 21000, 100000, 999999, 1000000, 1.5, NaN);
        for (const n of nums) for (const sl of slots) emit({ n: String(n), slot: sl, src: "numeric", op: "ordinal" }, N.ordinalWords(n, sl as never) ?? "\u0000none");
    },
    // The word level: phonemizeWord, toSegments, nat and stressLexiconHas over every stress.tsv key, every
    // letter run of the texts (as written, lowercased, nativised), stem+suffix compounds that reach bySuffix,
    // every 1-2 letter string over the alphabet, every 3-letter string over the context letters, and edges.
    async "sl-g2p"() {
        const S = await import("../../../src/languages/slovenian/slovenian.ts");
        const { toSegments } = await import("../../../src/languages/slovenian/g2p.ts");
        const words = new Set<string>();
        const keys = [...S.stressDict().keys()];
        for (const k of keys) words.add(k);
        for (let i = 0; i < keys.length; i += 53) for (const p of ["pet", "štiriin", "pre", "r", "rd", "sr"]) { words.add(p + keys[i]!); words.add(keys[i]!.toUpperCase()); }
        for (const t of textsFor(["sl"], FLEURS_DIR.sl, ["sl.txt"]).keys())
            for (const m of t.matchAll(/[\p{L}\p{M}'’]+/gu)) { words.add(m[0]); words.add(m[0].toLowerCase()); words.add(S.nat(m[0])); }
        const abc = [..."abcčdefghijklmnoprsštuvzžqwxyćđ"];
        for (const a of abc) { words.add(a); for (const b of abc) words.add(a + b); }
        const ctx = [..."aeiorljndžbpgkxhfsv"];
        for (const a of ctx) for (const b of ctx) for (const c of ctx) words.add(a + b + c);
        for (const w of ["", "\ud800", "a\ud800b", "prst", "vrt", "čmrlj", "kralj", "konj", "polje", "grad", "glasba", "Afganistan", "Abhazija", "rdeč", "São", "İzmir", "ŁÓDŹ", "Ahil"]) words.add(w);
        for (const w of words) {
            emit({ word: units(w), op: "word" }, S.phonemizeWord(w));
            emit({ word: units(w), op: "segs" }, toSegments(w).map((s) => `${s.ph}/${s.nucleus ? 1 : 0}`).join(" "));
            emit({ word: units(w), op: "nat" }, S.nat(w));
            emit({ word: units(w), op: "has" }, String(S.stressLexiconHas(w)));
        }
    },
    async "sl-numbers"() {
        const { numberToWords, readDigits } = await import("../../../src/languages/slovenian/numbers.ts");
        const ns: number[] = [];
        for (let i = 0; i <= 20000; i++) ns.push(i);
        for (let k = 1; k < 1000; k++) ns.push(k * 1e3, k * 1e3 + 1, k * 1e6, k * 1e6 + 2002, k * 1e9, k * 1e9 + 3004005, k * 1e9 + 999999999);
        for (let e = 4; e <= 21; e++) ns.push(10 ** e, 10 ** e - 1, 10 ** e + 7);
        ns.push(Number.MAX_SAFE_INTEGER, 1e21, 1.5, 2.7, -1, -0, NaN, Infinity, -Infinity);
        for (const n of ns) emit({ n: String(n), raw: null, op: "words" }, numberToWords(n));
        for (const raw of ["12345678901234567890", "0001", "000", "1000000000000", "9007199254740993", "", "1a2", "１２", "\ud800"]) {
            emit({ n: String(Number(raw)), raw: units(raw), op: "words" }, numberToWords(Number(raw), raw));
            emit({ n: "0", raw: units(raw), op: "digits" }, readDigits(raw));
        }
    },
    // ── Lithuanian (lt). Inputs: the lt golden, FLEURS lt_lt (columns 3 and 4) and probes/lt.txt, plus synthetic
    // rows: every counted unit, currency and magnitude after a set of numbers (with and without a decimal and a
    // magnitude between), years/days/centuries with and without a month, ranges after each correlative, and the
    // abbreviations before each follower.
    async "lt-normalize"() {
        const N = await import("../../../src/languages/lithuanian/normalize.ts");
        const rows = new Map<string, string>();
        for (const [t, s] of textsFor(["lt"], FLEURS_DIR.lt, ["lt.txt"])) rows.set(t, s);
        const add = (t: string): void => { if (!rows.has(t)) rows.set(t, "synthetic"); };
        const ns = ["0", "1", "2", "5", "10", "11", "12", "19", "20", "21", "22", "100", "101", "111", "1000", "2021", "1,5", "0,25", "12 345"];
        for (const n of ns) {
            for (const u of ["%", " proc.", " °C", "°F", " km", " km²", " km2", " mm", " cm", " kg", " ha", " ha2", " mg", " m", " t", " g", " t-", " m/s", " mln. km", " tūkst. ha", " mlrd", " mln", " tūkst.", " tūkst. gyventojų", " mln. pr. m. e.", " m.", " m. sausio", " d.", " a.", " val.", " min.", " €", " $", " £", " Lt", " mln. €", " milijonų eurų"])
                add(`Apie ${n}${u} buvo.`);
            for (const c of ["€", "$", "£"]) { add(`Kaina ${c}${n} mln.`); add(`Kaina ${c} ${n} eurų`); add(`Kaina ${n} ${c} dolerių`); }
        }
        for (const [a, b] of [["5", "10"], ["1990", "1995"], ["3", "4"], ["1,5", "2,5"], ["10", "12"]])
            for (const pre of ["", "nuo ", "iki ", "per ", "rezultatas ", "Tarp "]) for (const post of ["", " m.", " val.", " t", " dienų", " amžiaus"]) add(`Buvo ${pre}${a}–${b}${post} kartų`);
        for (const ab of ["pr. m. e.", "p. m. e.", "m. e.", "t. y.", "p. pl.", "š. pl.", "v. ilg.", "r. ilg.", "t-mečio", "mėn.", "pvz.", "ir kt.", "Ir Kt.", "nr.", "Nr.", "psl", "psl.", "gyv.", "val.", "min.", "&amp;", "&"])
            for (const after of ["", " A", " a", ","]) add(`Tai ${ab}${after} buvo`);
        for (let h = 0; h <= 24; h++) for (const mm of ["00", "30"]) { add(`${h}:${mm} val.`); add(`${h}.${mm} val`); add(`${h}:${mm}val`); }
        const words = new Set<string>();
        for (const [t, from] of rows) {
            const a = N.normalizeLithuanian(t);
            emit({ text: units(t), src: from, op: "normalize" }, a);
            emit({ text: units(a), src: from, op: "initialisms" }, N.normalizeLithuanianInitialisms(a));
            emit({ text: units(t), src: from, op: "initialisms" }, N.normalizeLithuanianInitialisms(t));
            for (const m of t.matchAll(/[\p{L}\p{M}]+/gu)) { words.add(m[0]); words.add(m[0].toLowerCase()); }
        }
        // isUnreadableLithuanian is not exported; the initialism pass over each word (and its uppercase) is
        // where it decides.
        for (const w of words) for (const x of [w, w.toUpperCase()]) emit({ text: units(x), src: "words", op: "initialisms" }, N.normalizeLithuanianInitialisms(x));
    },
    async "lt-g2p"() {
        const L = await import("../../../src/languages/lithuanian/lithuanian.ts");
        const { toSegments } = await import("../../../src/languages/lithuanian/g2p.ts");
        const { makeNativiser } = await import("../../../src/core/hostWord.ts");
        const nat = makeNativiser("[A-Za-ząčęėįšųūžĄČĘĖĮŠŲŪŽ]", "u");
        const words = new Set<string>();
        for (const t of textsFor(["lt"], FLEURS_DIR.lt, ["lt.txt"]).keys())
            for (const m of t.matchAll(/[\p{L}\p{M}'’]+/gu)) { words.add(m[0]); words.add(m[0].toLowerCase()); words.add(nat(m[0])); }
        const abc = [..."aąbcčdeęėfghiįyjklmnoprsštuųūvzžqwxäöüéàñ"];
        for (const a of abc) { words.add(a); for (const b of abc) words.add(a + b); }
        const ctx = [..."aąeėiįuųoyjkgnsštdzžcčhb"];
        for (const a of ctx) for (const b of ctx) for (const c of ctx) words.add(a + b + c);
        for (const w of ["", "\ud800", "a\ud800b", "čia", "Dievas", "dirbti", "duona", "ranka", "kiaušinis", "džiaugsmas", "chemija", "XXL", "xenon", "Hamletas"]) words.add(w);
        for (const w of words) {
            emit({ word: units(w), op: "word" }, L.phonemizeWord(w));
            emit({ word: units(w), op: "segs" }, toSegments(w).map((s) => `${s.ph}/${s.nucleus ? 1 : 0}`).join(" "));
            emit({ word: units(w), op: "nat" }, nat(w));
        }
    },
    async "lt-numbers"() {
        const { numberToWords, readDigits } = await import("../../../src/languages/lithuanian/numbers.ts");
        const ns: number[] = [];
        for (let i = 0; i <= 20000; i++) ns.push(i);
        for (let k = 1; k < 1000; k++) ns.push(k * 1e3, k * 1e3 + 1, k * 1e6, k * 1e6 + 2002, k * 1e9, k * 1e9 + 3004005, k * 1e9 + 999999999);
        for (let e = 4; e <= 21; e++) ns.push(10 ** e, 10 ** e - 1, 10 ** e + 7);
        ns.push(Number.MAX_SAFE_INTEGER, 1e21, 1.5, 2.7, -1, -0, NaN, Infinity, -Infinity);
        for (const n of ns) emit({ n: String(n), raw: null, op: "words" }, numberToWords(n));
        for (const raw of ["12345678901234567890", "0001", "000", "1000000000000", "9007199254740993", "", "1a2", "１２", "\ud800"]) {
            emit({ n: String(Number(raw)), raw: units(raw), op: "words" }, numberToWords(Number(raw), raw));
            emit({ n: "0", raw: units(raw), op: "digits" }, readDigits(raw));
        }
    },
    // ── Latvian (lv). Inputs: the lv golden, FLEURS lv_lv (columns 3 and 4) and probes/lv.txt, plus synthetic
    // rows: `N.` and `N.–M.` before every HEAD_NOUN form (and a non-head word, the Object.prototype names), the
    // abbreviations before each follower, every unit/currency/degree form after a set of numbers, and the signs.
    // `ordinalWords` over 0..2100 and corners × every case.
    async "lv-normalize"() {
        const N = await import("../../../src/languages/latvian/normalize.ts");
        const O = await import("../../../src/languages/latvian/ordinals.ts");
        const rows = new Map<string, string>();
        for (const [t, s] of textsFor(["lv"], FLEURS_DIR.lv, ["lv.txt"])) rows.set(t, s);
        const add = (t: string): void => { if (!rows.has(t)) rows.set(t, "synthetic"); };
        const heads = [...Object.keys(O.HEAD_NOUN), "mājās", "constructor", "Gadā", "valueof"];
        for (const n of ["1", "2", "3", "10", "11", "19", "20", "21", "100", "200", "1000", "1885", "2010", "2024", "3100", "10000"]) {
            for (const h of heads) { add(`Tas bija ${n}. ${h} beigās.`); add(`No ${n}.–1550. ${h} ilga.`); }
            for (const u of ["%", " km", " m", " cm", " mm", " kg", " g", " ha", " nm", " t", " km/h", " m/s", " km²", " m³", " $", " €", " £", " miljardiem $", "°", " °C", "°F", "°K", " lpp.", "lpp", ",5", ",05", ",0"])
                add(`Ir ${n}${u} tur.`);
        }
        for (const ab of ["p.m.ē.", "m.ē.", "u.tml.", "u.t.t.", "t.sk.", "utt.", "u.c.", "t.i.", "piem.", "plkst.", "nr.5", "Nr. 5", "№3", "№ 3", "№"])
            for (const after of ["", " Nākamais", " un", ","]) add(`Tas ir dārgi ${ab}${after}`);
        for (const sg of ["≈5", "≈ -3", "±2", "+3", "-4", "−4", "6 ÷ 3", "a = b", "x=2", "3 < 4", "5 > 1", "a<b", "== 2", "2^3", "x²", "5-10", "1995–96", "5,5-7"])
            add(`Vērtība ${sg} ir.`);
        for (const [t, from] of rows) emit({ text: units(t), src: from, op: "normalize" }, N.normalizeLatvian(t));
        const cases = ["nomSg", "genSg", "datSg", "accSg", "locSg", "nomPl", "datPl", "accPl", "locPl"];
        const ns: number[] = [];
        for (let i = -1; i <= 2100; i++) ns.push(i);
        ns.push(9999, 10000, 1.5, NaN, 3100, 5000);
        for (const n of ns) for (const c of cases) emit({ n: String(n), case: c, src: "numeric", op: "ordinal" }, O.ordinalWords(n, c as never) ?? "\u0000none");
    },
    async "lv-g2p"() {
        const L = await import("../../../src/languages/latvian/latvian.ts");
        const { toSegments } = await import("../../../src/languages/latvian/g2p.ts");
        const { makeNativiser } = await import("../../../src/core/hostWord.ts");
        const nat = makeNativiser("[A-Za-zĀāČčĒēĢģĪīĶķĻļŅņŌōŠšŪūŽž]", "u");
        const words = new Set<string>();
        for (const t of textsFor(["lv"], FLEURS_DIR.lv, ["lv.txt"]).keys())
            for (const m of t.matchAll(/[\p{L}\p{M}'’]+/gu)) { words.add(m[0]); words.add(m[0].toLowerCase()); words.add(nat(m[0])); }
        const abc = [..."aābcčdeēfgģhiījkķlļmnņoōprsštuūvzžqwxyäöü"];
        for (const a of abc) { words.add(a); for (const b of abc) words.add(a + b); }
        const ctx = [..."aeiuoāīvzdžsgknbtj"];
        for (const a of ctx) for (const b of ctx) for (const c of ctx) words.add(a + b + c);
        for (const w of ["", "\ud800", "a\ud800b", "loks", "maize", "draugs", "dievs", "Latvija", "dzelzs", "atgriezt", "daudz", "Monako", "xenons", "hokejs"]) words.add(w);
        for (const w of words) {
            emit({ word: units(w), op: "word" }, L.phonemizeWord(w));
            emit({ word: units(w), op: "segs" }, toSegments(w).map((s) => `${s.ph}/${s.nucleus ? 1 : 0}`).join(" "));
            emit({ word: units(w), op: "nat" }, nat(w));
        }
    },
    async "lv-numbers"() {
        const { numberToWords, readDigits } = await import("../../../src/languages/latvian/numbers.ts");
        const ns: number[] = [];
        for (let i = 0; i <= 20000; i++) ns.push(i);
        for (let k = 1; k < 1000; k++) ns.push(k * 1e3, k * 1e3 + 1, k * 1e6, k * 1e6 + 2002, k * 1e6 + 11011, k * 1e6 + 999999);
        for (let e = 4; e <= 21; e++) ns.push(10 ** e, 10 ** e - 1, 10 ** e + 7);
        ns.push(Number.MAX_SAFE_INTEGER, 1e21, 1.5, 2.7, -1, -0, NaN, Infinity, -Infinity);
        for (const n of ns) emit({ n: String(n), raw: null, op: "words" }, numberToWords(n));
        for (const raw of ["12345678901234567890", "0001", "000", "1000000000", "9007199254740993", "", "1a2", "１２", "\ud800"]) {
            emit({ n: String(Number(raw)), raw: units(raw), op: "words" }, numberToWords(Number(raw), raw));
            emit({ n: "0", raw: units(raw), op: "digits" }, readDigits(raw));
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
    // ── Finnish (fi). Inputs: the fi golden, FLEURS fi_fi (columns 3 and 4) and probes/fi.txt. ──
    // Each stage of text()'s chain (normalizeFinnish, the initialism pass over its output, the symbol tier over
    // that, recorded through the wrapper), the phonotactic test on every letter run, synthetic rows (numbers ×
    // the ordinal heads, dotted dates, the clock grid behind each marker, decimals, colon suffixes), and
    // `ordinal` over 0…1200 and corners.
    async "fi-normalize"() {
        const { register } = await import("node:module");
        register(new URL("./symbols-hook.mjs", import.meta.url));
        const { records } = await import("./symbols-wrap.ts");
        const N = await import("../../../src/languages/finnish/normalize.ts");
        await import("../../../src/languages/finnish/finnish.ts");
        const rec = records.find((r) => /src\/languages\/finnish\//u.test(r.stack.split("\n").slice(2).join("\n")))!;
        const rows = new Map<string, string>();
        for (const [t, src] of textsFor(["fi"], FLEURS_DIR.fi, ["fi.txt"])) rows.set(t, src);
        const add = (t: string): void => { if (!rows.has(t)) rows.set(t, "synthetic"); };
        const heads = ["toukokuuta", "päivänä", "kesäkuu", "herttuatar", "Jakokoski", "", "(PDF)", "5.", "– 24. lokakuuta", "–24. heinäkuuta", "—3. sija"];
        for (const n of ["0", "1", "2", "9", "10", "11", "19", "20", "21", "22", "99", "100", "101", "126", "200", "999", "1000", "1978", "007"])
            for (const h of heads) for (const pre of ["", "vuonna ", "s. ", "k. ", "V. ", "a"]) add(`${pre}${n}. ${h}`);
        for (const d of ["0", "1", "13", "31", "32", "01"]) for (const mo of ["0", "1", "5", "12", "13", "07"]) { add(`${d}.${mo}.2019`); add(`${d}.${mo}. alkaen`); add(`x ${d}.${mo}.19`); }
        for (const p of ["kello ", "klo ", "klo. ", "Kello ", "(", ""]) for (const h of ["0", "9", "21", "23", "24", "06"]) for (const m of ["00", "01", "30", "59", "60"]) {
            add(`${p}${h}.${m} UTC`); add(`${p}${h}:${m} ja 7.${m} välisenä`); add(`${p}${h}.${m},43`);
        }
        for (const x of ["3,14", "50,7 %", "13,6 cm", "1,2,3", "0,001 km/h", "12 , 5", "33:s", "1000:s", "850:n", "55 kg:n", "53 %:lla", "°C:n", "km²:iin", "5 m:ssä"]) add(x);
        const words = new Set<string>();
        for (const [t, src] of rows) {
            const a = N.normalizeFinnish(t);
            emit({ text: units(t), src, op: "normalize" }, a);
            const b = N.normalizeFinnishInitialisms(a);
            emit({ text: units(a), src, op: "initialisms" }, b);
            emit({ text: units(b), src, op: "symbols" }, rec.apply(b));
            for (const m of t.matchAll(/[\p{L}\p{M}]+/gu)) { words.add(m[0]); words.add(m[0].toLowerCase()); }
        }
        for (const w of words) emit({ text: units(w), src: "words", op: "unreadable" }, String(N.isUnreadableFinnish(w)));
        const ns: number[] = [];
        for (let i = 0; i <= 1200; i++) ns.push(i);
        ns.push(1.5, -1, -0, NaN, Infinity, 999.5, 1e9);
        for (const n of ns) emit({ n: String(n), op: "ordinal" }, N.ordinal(n) ?? "\u0000none");
    },
    // phonemizeWord over every letter run of the texts (as written and lowercased), every 1–3 letter string of the
    // alphabet plus loan and foreign letters, every 4-letter string of the context letters (n g k, doubled
    // consonants, the diphthong vowels), and corners; the nativiser over them and foreign names; then
    // numberToWords / readDigits.
    async "fi-g2p"() {
        const { phonemizeWord } = await import("../../../src/languages/finnish/finnish.ts");
        const { numberToWords, readDigits } = await import("../../../src/languages/finnish/numbers.ts");
        const { makeNativiser } = await import("../../../src/core/hostWord.ts");
        const nat = makeNativiser("[a-zäöåšž]", "iu");
        const words = new Set<string>();
        for (const t of langTexts("fi")) for (const m of t.matchAll(/[\p{L}\p{M}]+/gu)) { words.add(m[0]); words.add(m[0].toLowerCase()); }
        const abc = [..."abcdefghijklmnopqrstuvwxyzäöåšžéüñ"];
        for (const a of abc) { words.add(a); for (const b of abc) { words.add(a + b); for (const c of abc) words.add(a + b + c); } }
        const ctx = [..."ngkaieuoyäöh"];
        for (const a of ctx) for (const b of ctx) for (const c of ctx) for (const d of ctx) words.add(a + b + c + d);
        for (const w of ["", "İ", "ſ", "\ud800", "a\udc00z", "𝐚𝐛", "NG", "Nk", "nng", "nkk", "kkk", "ŋ", "x", "xx", "hh", "Ää", "ÄÖ", "ẞ"]) words.add(w);
        for (const w of words) emit({ word: units(w), op: "word" }, phonemizeWord(w));
        for (const w of [...words, "São", "Müller", "Dvořák", "Ørsted", "Žižek", "Ångström", "Œuvre", "façade", "Tōkyō", "Nguyễn", "Słania"])
            emit({ word: units(w), op: "nat" }, nat(w));
        const ns: number[] = [];
        for (let i = 0; i <= 20000; i++) ns.push(i);
        for (let k = 1; k < 1000; k++) ns.push(k * 1e3, k * 1e3 + 21, k * 1e6, k * 1e6 + 2001, k * 1e6 + 1000);
        for (let e = 4; e <= 21; e++) ns.push(10 ** e, 10 ** e - 1, 10 ** e + 7);
        ns.push(Number.MAX_SAFE_INTEGER, 2 ** 53, 1e9 - 1, 1e9, 1.5, 2.7, -1, -21, -0, NaN, Infinity, -Infinity, 0.1, 1e-7, 22.5);
        for (const n of ns) emit({ n: String(n), raw: null, op: "words" }, numberToWords(n));
        for (const raw of ["0", "007", "1234567890", "99999999999999999999", "1e3", "12a", "１２", "٣٠", "𝟙2", "", "\ud800", " \t\u00a0"]) {
            emit({ n: String(Number(raw)), raw: units(raw), op: "words" }, numberToWords(Number(raw), raw));
            emit({ n: "1000000000", raw: units(raw), op: "words" }, numberToWords(1e9, raw));
            emit({ n: "0", raw: units(raw), op: "digits" }, readDigits(raw));
        }
    },
    // ── Estonian (et). Inputs: the et golden, FLEURS et_ee (columns 3 and 4) and probes/et.txt. ──
    // Each stage of text()'s chain (normalizeEstonian, the initialism pass over its output, the symbol tier over
    // that, recorded through the wrapper), the phonotactic test on every letter run, synthetic rows (numbers ×
    // every head stem × every ending, coordination and range, the clock grid, ranges, the hyphen suffix,
    // degrees near and far from a `kraad` word, abbreviations before a capital and at the end), and `ordinal`
    // over 0…2100 and corners × every ending.
    async "et-normalize"() {
        const { register } = await import("node:module");
        register(new URL("./symbols-hook.mjs", import.meta.url));
        const { records } = await import("./symbols-wrap.ts");
        const N = await import("../../../src/languages/estonian/normalize.ts");
        await import("../../../src/languages/estonian/estonian.ts");
        const rec = records.find((r) => /src\/languages\/estonian\//u.test(r.stack.split("\n").slice(2).join("\n")))!;
        const rows = new Map<string, string>();
        for (const [t, src] of textsFor(["et"], FLEURS_DIR.et, ["et.txt"])) rows.set(t, src);
        const add = (t: string): void => { if (!rows.has(t)) rows.set(t, "synthetic"); };
        const stems = ["aastatuhande", "sünniaastapäeva", "eluaasta", "aasta", "sajandi", "koha", "järgu", "mai", "juuli", "detsembri", "jaanuar", "oktoober", "sajand", "trükk", "valitsus", "tundmatu"];
        const ends = ["", "l", "st", "ks", "t", "ni", "te", "tel", "test", "il", "na", "sse"];
        for (const n of ["1", "2", "3", "11", "21", "22", "100", "101", "102", "1000", "1921", "1922", "1924", "9999", "10000", "007"])
            for (const s of stems) for (const e of ends) add(`${n}. ${s}${e}`);
        for (const [a, b] of [["7", "6"], ["1", "2"], ["1920", "1940"], ["3", "8"], ["21", "22"]])
            for (const j of [" ja ", " või ", ".–", ". – ", ".-"]) for (const h of ["sajandil", "aastatel", "aastail", "sajandini", "tundmatu"]) add(`${a}.${j.startsWith(".") ? j.slice(1) : j}${b}. ${h}`);
        for (const p of ["kell ", "Kella ", "kello ", "akell ", ""]) for (const h of ["0", "9", "19", "23", "24"]) for (const m of ["00", "08", "59", "60"]) { add(`${p}${h}.${m} palus`); add(`${p}${h}:${m},`); add(`${p}${h}.${m}.5`); }
        for (const [a, b] of [["1912", "1913"], ["3000", "2000"], ["14,5", "30"], ["5", "13,7"], ["50 000", "100 000"]])
            for (const d of ["–", "-", " – ", "—", "..."]) { add(`${a}${d}${b}`); add(`${a}${d}${b}.`); add(`lk ${a}${d}${b} °C`); }
        for (const n of ["1", "4", "10", "6000", "9999", "10000", "0"]) for (const s of ["le", "ni", "st", "aastaselt"]) { add(`${n}-${s}`); add(`$${n}-${s}`); }
        for (const x of ["25 °C", "25°F", "-15 °C kraadini", "46° ja 49°", "38°51'", "Temperatuur oli 30 °C. Sellest sai kraadi.", "Kraadini 26 °C", "põhjalaiuskraadil, 26 °C"]) add(x);
        for (const ab of ["jms", "jmt", "ptk", "tlk", "nt", "nr", "nn", "sh", "jm", "jt", "vt", "u", "e.m.a", "m.a.j", "eKr", "pKr"])
            for (const tail of [" 5", ". Teine", ".", ". kass", " kass", ""]) add(`vaata ${ab}${tail}`);
        const words = new Set<string>();
        for (const [t, src] of rows) {
            const a = N.normalizeEstonian(t);
            emit({ text: units(t), src, op: "normalize" }, a);
            const b = N.normalizeEstonianInitialisms(a);
            emit({ text: units(a), src, op: "initialisms" }, b);
            emit({ text: units(b), src, op: "symbols" }, rec.apply(b));
            for (const m of t.matchAll(/[\p{L}\p{M}]+/gu)) { words.add(m[0]); words.add(m[0].toLowerCase()); }
        }
        for (const w of words) emit({ text: units(w), src: "words", op: "unreadable" }, String(N.isUnreadableEstonian(w)));
        const ns: number[] = [];
        for (let i = 0; i <= 2100; i++) ns.push(i);
        ns.push(9999, 10000, 1.5, -1, -0, NaN, Infinity, 9998.5);
        for (const n of ns) for (const e of [N.NOMINATIVE, ...ends])
            emit({ n: String(n), ending: e === N.NOMINATIVE ? null : e, op: "ordinal" }, N.ordinal(n, e) ?? "\u0000none");
    },
    // phonemizeWord over every letter run (as written and lowercased), every 1–3 letter string of the alphabet
    // plus loan and foreign letters, every 4-letter string over the gemination context letters, corners; the
    // nativiser; and the number reader through createEstonian().text over 0…20,000, magnitudes and long runs.
    async "et-g2p"() {
        const { phonemizeWord, createEstonian } = await import("../../../src/languages/estonian/estonian.ts");
        const { makeNativiser } = await import("../../../src/core/hostWord.ts");
        const nat = makeNativiser("[a-zõäöüšžáéíóú]", "iu");
        const words = new Set<string>();
        for (const t of langTexts("et")) for (const m of t.matchAll(/[\p{L}\p{M}]+/gu)) { words.add(m[0]); words.add(m[0].toLowerCase()); }
        const abc = [..."abcdefghijklmnopqrstuvwxyzõäöüšžáéíóúñ"];
        for (const a of abc) { words.add(a); for (const b of abc) { words.add(a + b); for (const c of abc) words.add(a + b + c); } }
        const ctx = [..."aeoõkstlny"];
        for (const a of ctx) for (const b of ctx) for (const c of ctx) for (const d of ctx) words.add(a + b + c + d);
        for (const w of ["", "İ", "ſ", "\ud800", "a\udc00z", "𝐚𝐛", "KKK", "kkk", "skk", "aaa", "x", "xx", "Õõ", "ẞ", "1a"]) words.add(w);
        for (const w of words) emit({ word: units(w), op: "word" }, phonemizeWord(w));
        for (const w of [...words, "São", "Müller", "Dvořák", "Ørsted", "Žižek", "Ångström", "Œuvre", "façade", "Tōkyō", "Nguyễn"])
            emit({ word: units(w), op: "nat" }, nat(w));
        const et = createEstonian();
        const ns: string[] = [];
        for (let i = 0; i <= 20000; i++) ns.push(String(i));
        for (let k = 1; k < 1000; k++) ns.push(String(k * 1e3), String(k * 1e3 + 21), String(k * 1e6), String(k * 1e6 + 2001), String(k * 1e6 + 1000));
        ns.push("999999999", "1000000000", "9007199254740991", "9007199254740993", "12345678901234567890", "007", "0000");
        for (const n of ns) emit({ text: units(n), op: "text" }, et.text(n));
    },
    // ── Hungarian (hu). Inputs: the hu golden, FLEURS hu_hu (columns 3 and 4) and probes/hu.txt. ──
    // normalizeHungarian (the symbol tier and the initialism pass run inside it), the phonotactic test on every
    // letter run, and synthetic rows: multiplication, the dotted abbreviations (incl. case-folded spellings),
    // de-grouping, the clock grid, unit / percent / degree / numeral / date / acronym hyphen suffixes, signs,
    // division, decimals and the three ordinal arms.
    async "hu-normalize"() {
        const N = await import("../../../src/languages/hungarian/normalize.ts");
        const rows = new Map<string, string>();
        for (const [t, src] of textsFor(["hu"], FLEURS_DIR.hu, ["hu.txt"])) rows.set(t, src);
        const add = (t: string): void => { if (!rows.has(t)) rows.set(t, "synthetic"); };
        for (const n of ["1", "2", "3", "6", "10", "22", "56", "100", "999999", "1000000"]) for (const x of ["x", "×", " x ", " × "]) { add(`${n}${x}4 méter`); add(`3.${n}${x}4`); }
        for (const ab of ["pl", "Pl", "PL", "kb", "stb", "ld", "dr", "Dr", "\u212Ab", "ſtb", "Kr", "i", "d"]) for (const t of [". 20 km-re", ". körül", ".", ".)", ". Ma", "."]) add(`ez ${ab}${t}`);
        for (const x of ["Kr. e.", "Kr.u.", "i. sz.", "i.e.", "d. e.", "d.u.", "KR. E."]) add(`a ${x} 100`);
        for (const g of ["100.000", "5.000.000", "400. 000", "30 000", "100,000", "24.000, és", "0.123", "12,5", "1,234,567", "1\u00a0000"]) add(`van ${g} ember`);
        for (const h of ["0", "9", "11", "23", "24"]) for (const m of ["00", "05", "35", "59", "60"]) { add(`${h}:${m}-kor`); add(`${h}: ${m} óra`); add(`${h}:${m}-re`); }
        for (const u of ["km", "mm", "cm", "kg", "mérföld", "KM", "\u212Am", "m", "g"]) for (const e of ["", "²", "³", "2", "3"]) { add(`20 ${u}${e}-re`); add(`2${u}${e}-es`); }
        for (const p of ["29%-a", "8 %-kal", "5٪-os", "3％-ot", "10%"]) add(p);
        for (const d of ["35°-tól", "20 °c-a", "30°C", "5 °F", "45°", "-5 °C", "1990-5", "a −3 fok", "±2", "UTC+1", "a + 30°C"]) add(d);
        for (const r of ["1 = 1", "2<3", "4 > 3", "6 ÷ 3", "100 ÷ 22", "7÷1", "9÷4", "10÷20", "12÷30"]) add(r);
        for (const n of ["1", "2", "3", "5", "10", "19", "20", "24", "31", "32", "1759", "2022", "10000"]) {
            add(`${n}. szeptember`); add(`augusztus ${n}. és`); add(`a ${n}. helyen`); add(`a ${n}., a`); add(`szeptember ${n}-én`); add(`szeptember ${n}-jén`);
            add(`május ${n}-e`); add(`május ${n}-i`); add(`${n}-ban`); add(`${n}-es`); add(`${n}-an`); add(`${n}-ig`); add(`${n}. Ma`);
        }
        for (const x of ["XIX. század", "II. Erzsébet", "IV. Béla", "XX. századi", "a III. kerület", "V. fejezet"]) add(x);
        for (const a of ["GPS-hez", "FBI-nak", "GDP-je", "WC-be", "NATO-hoz", "ENSZ-ben", "WC", "AOL", "HIV", "ÉÁ-ra", "BBC"]) add(`a ${a} és`);
        const words = new Set<string>();
        for (const [t, src] of rows) {
            emit({ text: units(t), src, op: "normalize" }, N.normalizeHungarian(t));
            for (const m of t.matchAll(/[\p{L}\p{M}]+/gu)) { words.add(m[0]); words.add(m[0].toLowerCase()); }
        }
        for (const w of words) emit({ text: units(w), src: "words", op: "unreadable" }, String(N.isUnreadableHungarian(w)));
    },
    // phonemizeWord over every letter run (as written and lowercased), every 1–3 letter string of the alphabet,
    // every 4-letter string over the context letters (digraph halves, the voicing pairs, n and j), corners and the
    // c+h / c+sz boundary shapes; the nativiser.
    async "hu-g2p"() {
        const { phonemizeWord } = await import("../../../src/languages/hungarian/hungarian.ts");
        const { makeNativiser } = await import("../../../src/core/hostWord.ts");
        const nat = makeNativiser("[a-záéíóöőúüű]", "iu");
        const words = new Set<string>();
        for (const t of langTexts("hu")) for (const m of t.matchAll(/[\p{L}\p{M}]+/gu)) { words.add(m[0]); words.add(m[0].toLowerCase()); }
        const abc = [..."abcdefghijklmnopqrstuvwxyzáéíóöőúüűñ"];
        for (const a of abc) { words.add(a); for (const b of abc) { words.add(a + b); for (const c of abc) words.add(a + b + c); } }
        const ctx = [..."szcygnjdtkbva"];
        for (const a of ctx) for (const b of ctx) for (const c of ctx) for (const d of ctx) words.add(a + b + c + d);
        for (const w of ["", "İ", "ſ", "\ud800", "a\udc00z", "𝐚𝐛", "harminchat", "kilenchet", "archoz", "perchez", "nyolcszáz", "csz", "cscs", "ddzs", "feddj", "adj", "bánja", "hallja", "feddte", "hang", "angyal", "színpad", "biztat", "vasgolyó", "Bach", "Schmidt"]) words.add(w);
        for (const w of words) emit({ word: units(w), op: "word" }, phonemizeWord(w));
        for (const w of [...words, "São", "Müller", "Dvořák", "Ørsted", "Žižek", "Ångström", "Œuvre", "façade", "Tōkyō", "Nguyễn"])
            emit({ word: units(w), op: "nat" }, nat(w));
    },
    // numberToWords (0…20,000, magnitudes to 10¹², unsafe and non-finite corners, raw strings), ordinalWords,
    // multiplicativeWords, stemForSuffix over cardinals × suffixes, and the Roman policy's ordinal.
    async "hu-numbers"() {
        const { numberToWords, ordinalWords, multiplicativeWords, stemForSuffix } = await import("../../../src/languages/hungarian/numbers.ts");
        const { ROMAN_POLICY } = await import("../../../src/languages/hungarian/romanOrdinals.ts");
        const ns: number[] = [];
        for (let i = 0; i <= 20000; i++) ns.push(i);
        for (let k = 1; k < 1000; k++) ns.push(k * 1e3, k * 1e3 + 2, k * 1e6, k * 1e6 + 2002, k * 1e9, k * 1e9 + 22022);
        for (let e = 4; e <= 21; e++) ns.push(10 ** e, 10 ** e - 1, 10 ** e + 7);
        ns.push(Number.MAX_SAFE_INTEGER, 2 ** 53, 1e12 - 1, 1e12, 1.5, 2.7, -1, -21, -1.5, -0, NaN, Infinity, -Infinity, 0.1, 1e-7, 22.5);
        for (const n of ns) {
            emit({ n: String(n), raw: null, op: "words" }, numberToWords(n));
            emit({ n: String(n), op: "ordinal" }, ordinalWords(n) ?? "\u0000none");
            emit({ n: String(n), op: "mult" }, multiplicativeWords(n) ?? "\u0000none");
        }
        for (let n = 0; n <= 3000; n++) emit({ n: String(n), op: "roman" }, ROMAN_POLICY.ordinal(n) ?? "\u0000none");
        for (const raw of ["0", "007", "1234567890", "99999999999999999999", "1e3", "12a", "１２", "٣٠", "𝟙2", "", "\ud800"]) {
            emit({ n: String(Number(raw)), raw: units(raw), op: "words" }, numberToWords(Number(raw), raw));
            emit({ n: "1000000000000", raw: units(raw), op: "words" }, numberToWords(1e12, raw));
        }
        const sufs = ["es", "as", "an", "ban", "ig", "e", "ő", "re", "", "Es", "ös"];
        for (let i = 0; i <= 3000; i++) for (const s of sufs) emit({ word: units(numberToWords(i)), suffix: units(s), op: "stem" }, stemForSuffix(numberToWords(i), s));
    },
    // ── Icelandic (is). Inputs: the is golden, FLEURS is_is (columns 3 and 4) and probes/is.txt. ──
    // normalizeIcelandic per text, plus synthetic rows: the ordinal 0…40 (and `07`) before a month, an `öld`
    // oblique, a neuter noun, a capital; grouping, decimals, the clock, units in every case, ranges, currency on
    // both sides, signs and relational signs.
    async "is-normalize"() {
        const { normalizeIcelandic } = await import("../../../src/languages/icelandic/normalize.ts");
        const rows = new Map<string, string>();
        for (const [t, src] of textsFor(["is"], FLEURS_DIR.is, ["is.txt"])) rows.set(t, src);
        const add = (t: string): void => { if (!rows.has(t)) rows.set(t, "synthetic"); };
        const ns: string[] = ["07", "00", "100", "123"];
        for (let i = 0; i <= 40; i++) ns.push(String(i));
        for (const n of ns) for (const h of ["september", "maíbyrjun", "aldar", "öldinni", "sæti", "Maí", "dag", ""]) { add(`${n}. ${h}`); add(`a${n}. ${h}`); }
        for (const g of ["1.234", "12.345.678", "0.123", "1.23", "12,5", "3,14159", "6.34"]) add(`um ${g} manns`);
        for (const c of ["9:30", "23:59", "123:45", "1:5"]) add(`klukkan ${c}`);
        for (const u of ["mph", "MPH", "km", "KM", "kg", "cm", "mm", "m", "km²", "km2", "m²", "M3", "km³", "km/klst.", "km/h", "Km/H"]) { add(`5 ${u} og`); add(`5${u}x`); }
        for (const r of ["1990–2000", "1-2-3", "5 - 7", "-5", "+3", "−2", "a-5", "3+4", "2 ± 1", "1=1", "1≈2", "2<3", "4>3", "2×3", "2 x 3", "6÷3", "R&D", "AT&T"]) add(`er ${r} hér`);
        for (const c of ["$", "€", "£", "¥"]) { add(`${c}5`); add(`5 ${c}`); add(`${c} 5 og 6${c}`); }
        for (const x of ["o.s.frv.", "o. s. frv", "O.S.FRV.", "o.fl.", "o. fl", "bo.fl."]) add(`epli ${x} og`);
        for (const [t, src] of rows) emit({ text: units(t), src, op: "normalize" }, normalizeIcelandic(t));
    },
    // phonemizeWord over every letter run (as written and lowercased), every 1–3 letter string of the alphabet,
    // every 4-letter string over the context letters (the geminates, k/g + front vowels, n, f, í), corners; the
    // nativiser; numberToWords over 0…20,000, magnitudes and raw strings.
    async "is-g2p"() {
        const { phonemizeWord } = await import("../../../src/languages/icelandic/icelandic.ts");
        const { numberToWords } = await import("../../../src/languages/icelandic/numbers.ts");
        const { makeNativiser } = await import("../../../src/core/hostWord.ts");
        const nat = makeNativiser("[a-záéíóúýþðæöA-ZÁÉÍÓÚÝÞÐÆÖ'-]", "u");
        const words = new Set<string>();
        for (const t of langTexts("is")) for (const m of t.matchAll(/[\p{L}\p{M}'-]+/gu)) { words.add(m[0]); words.add(m[0].toLowerCase()); }
        const abc = [..."aábcdðeéfghiíjklmnoóöpqrstuúvwxyýzþæ'-"];
        for (const a of abc) { words.add(a); for (const b of abc) { words.add(a + b); for (const c of abc) words.add(a + b + c); } }
        const ctx = [..."kgnfíaeijt"];
        for (const a of ctx) for (const b of ctx) for (const c of ctx) for (const d of ctx) words.add(a + b + c + d);
        for (const w of ["", "İ", "ſ", "\ud800", "a\udc00z", "𝐚𝐛", "ég", "Hekla", "vatn", "Biblía", "María", "drekkja", "deigja", "Alþingi", "bang", "Steinn", "Anna", "Sviss", "höfn", "lofa", "lukt", "þríeyki", "erkiengill", "ein"]) words.add(w);
        for (const w of words) emit({ word: units(w), op: "word" }, phonemizeWord(w));
        for (const w of [...words, "São", "Müller", "Dvořák", "Ørsted", "Žižek", "Ångström", "Œuvre", "façade", "Tōkyō", "Nguyễn"])
            emit({ word: units(w), op: "nat" }, nat(w));
        const ns: number[] = [];
        for (let i = 0; i <= 20000; i++) ns.push(i);
        for (let k = 1; k < 1000; k++) ns.push(k * 1e3, k * 1e3 + 1, k * 1e3 + 21, k * 1e6, k * 1e6 + 2, k * 1e6 + 1001, k * 1e9, k * 1e9 + 3);
        for (let e = 4; e <= 21; e++) ns.push(10 ** e, 10 ** e - 1, 10 ** e + 7);
        ns.push(Number.MAX_SAFE_INTEGER, 1e12 - 1, 1e12, 1.5, -1, -21, -1.5, -0, NaN, Infinity, -Infinity);
        for (const n of ns) emit({ n: String(n), raw: null, op: "words" }, numberToWords(n));
        for (const raw of ["0", "007", "1234567890", "99999999999999999999", "1e3", "12a", "１２", "٣٠", "𝟙2", "", "\ud800"]) {
            emit({ n: String(Number(raw)), raw: units(raw), op: "words" }, numberToWords(Number(raw), raw));
            emit({ n: "1000000000000", raw: units(raw), op: "words" }, numberToWords(1e12, raw));
        }
    },
    // ── Faroese (fo). Inputs: the fo golden and probes/fo.txt; FLEURS has no Faroese, so the synthetic rows and
    // the probes carry the arms the golden misses. ──
    // normalizeFaroese, the symbol tier over its output (recorded through the wrapper), and synthetic rows for
    // every arm: the leap-second time grid, both grouping separators, the decimal dot, each abbreviation
    // mid-sentence and sentence-final, the ordinal period before a lowercase word / a capital / an NBSP,
    // degrees, signs, en-dash and hyphen ranges.
    async "fo-normalize"() {
        const { register } = await import("node:module");
        register(new URL("./symbols-hook.mjs", import.meta.url));
        const { records } = await import("./symbols-wrap.ts");
        const { normalizeFaroese } = await import("../../../src/languages/faroese/normalize.ts");
        const fo = (await import("../../../src/languages/faroese/faroese.ts")).createFaroese();
        await import("../../../src/languages/faroese/faroese.ts");
        const rec = records.find((r) => /src\/languages\/faroese\//u.test(r.stack.split("\n").slice(2).join("\n")))!;
        const rows = new Map<string, string>();
        for (const [t, src] of textsFor(["fo"], undefined, ["fo.txt"])) rows.set(t, src);
        const add = (t: string): void => { if (!rows.has(t)) rows.set(t, "synthetic"); };
        for (const h of ["0", "9", "19", "23", "24", "25", "01"]) for (const m of ["00", "59", "60"]) for (const sec of ["00", "59", "60", "61"]) add(`kl ${h}.${m}.${sec} í dag`);
        for (const g of ["49.267", "1.000.000", "12.34", "1.2", "0.500", "7 737", "48\u00a0219", "12 000–10 000", "1.234,5", "3.00 kr", "4.19$"]) add(`har eru ${g} fólk`);
        for (const ab of ["n.br.", "n. br.", "v.l.", "f.Kr.", "f. Kr.", "e.Kr.", "e.m.", "f.m.", "kl.", "mió.", "uml.", "Kl."]) for (const tail of [" 5", "", ")", " Síðan", "\""]) add(`tað var ${ab}${tail}`);
        for (const n of ["1", "23", "999", "1998", "10000"]) for (const t of [". juli", ". Síðan", ".\u00a0des.", ".\u00a0Des", ". 5"]) add(`tann ${n}${t}`);
        for (const d of ["11 °C", "52°F", "62°", "56,7 °c", "-5 stig", "(−3)", "a –4", "x-5", "1269–1308", "5 — 7", "3-4", "1-2-3", "2/3-4", "10-20 km"]) add(`er ${d} her`);
        for (const [t, src] of rows) {
            const a = normalizeFaroese(t);
            emit({ text: units(t), src, op: "normalize" }, a);
            emit({ text: units(a), src, op: "symbols" }, rec.apply(a));
            emit({ text: units(t), src, op: "text" }, fo.text(t));
        }
    },
    // phonemizeWord over every letter run (as written and lowercased), every 1–3 letter string of the alphabet,
    // every 4-letter string over the context letters (the vowels that pair with ð/g, g/k/j, r + coronals, n, v, h),
    // corners; the nativiser; numberToWords over 0…20,000, magnitudes and raw strings.
    async "fo-g2p"() {
        const { phonemizeWord } = await import("../../../src/languages/faroese/faroese.ts");
        const { numberToWords } = await import("../../../src/languages/faroese/numbers.ts");
        const { makeNativiser } = await import("../../../src/core/hostWord.ts");
        const nat = makeNativiser("[a-záíóúýæøðþA-ZÁÍÓÚÝÆØÐÞ'-]", "u");
        const words = new Set<string>();
        for (const t of langTexts("fo")) for (const m of t.matchAll(/[\p{L}\p{M}'-]+/gu)) { words.add(m[0]); words.add(m[0].toLowerCase()); }
        const abc = [..."aábdðefghiíjklmnoóprstuúvyýæøþcqwxz'-"];
        for (const a of abc) { words.add(a); for (const b of abc) { words.add(a + b); for (const c of abc) words.add(a + b + c); } }
        const ctx = [..."aeiouóðgkjrnvhm"];
        for (const a of ctx) for (const b of ctx) for (const c of ctx) for (const d of ctx) words.add(a + b + c + d);
        for (const w of ["", "İ", "ſ", "\ud800", "a\udc00z", "𝐚𝐛", "ógv", "dúgva", "ógv", "eggja", "ikki", "allur", "Bogi", "Eyður", "dagur", "bága", "agað", "aðal", "avgera", "ahorn", "fílum", "Adam", "heim", "gangi", "Urð", "tjóðra", "hvat", "hjá", "ggjj", "kkj", "rðn"]) words.add(w);
        for (const w of words) emit({ word: units(w), op: "word" }, phonemizeWord(w));
        for (const w of [...words, "São", "Müller", "Dvořák", "Ørsted", "Žižek", "Ångström", "Œuvre", "façade", "Tōkyō", "Nguyễn"])
            emit({ word: units(w), op: "nat" }, nat(w));
        const ns: number[] = [];
        for (let i = 0; i <= 20000; i++) ns.push(i);
        for (let k = 1; k < 1000; k++) ns.push(k * 1e3, k * 1e3 + 1, k * 1e3 + 21, k * 1e6, k * 1e6 + 2, k * 1e6 + 1001, k * 1e9, k * 1e9 + 3);
        for (let e = 4; e <= 21; e++) ns.push(10 ** e, 10 ** e - 1, 10 ** e + 7);
        ns.push(Number.MAX_SAFE_INTEGER, 1e12 - 1, 1e12, 1.5, -1, -21, -1.5, -0, NaN, Infinity, -Infinity);
        for (const n of ns) emit({ n: String(n), raw: null, op: "words" }, numberToWords(n));
        for (const raw of ["0", "007", "1234567890", "99999999999999999999", "1e3", "12a", "１２", "٣٠", "𝟙2", "", "\ud800"]) {
            emit({ n: String(Number(raw)), raw: units(raw), op: "words" }, numberToWords(Number(raw), raw));
            emit({ n: "1000000000000", raw: units(raw), op: "words" }, numberToWords(1e12, raw));
        }
    },
    // ── Azerbaijani (az). Inputs: the az golden, FLEURS az_az (columns 3 and 4) and probes/az.txt. ──
    // normalizeAzerbaijani, the initialism pass alone (rebuilt with normalize.ts's own config) on the raw text, the
    // symbol tier azerbaijani.ts built (recorded through the wrapper) on the normalized text, and the phonotactic
    // test on every letter run, plus synthetic ordinal / clock / fraction / percent shapes. The tokenizer is
    // module-private: phonemize-sync and trace cover it.
    async "az-normalize"() {
        const { register } = await import("node:module");
        register(new URL("./symbols-hook.mjs", import.meta.url));
        const { records } = await import("./symbols-wrap.ts");
        const N = await import("../../../src/languages/azerbaijani/normalize.ts");
        await import("../../../src/languages/azerbaijani/azerbaijani.ts");
        const { azLower } = await import("../../../src/languages/azerbaijani/g2p.ts");
        const { makeInitialismNormalizer } = await import("../../../src/core/initialisms.ts");
        const rec = records.find((r) => /src\/languages\/azerbaijani\//u.test(r.stack.split("\n").slice(2).join("\n")))!;
        const LETTER: Record<string, string> = {
            a: "a", b: "be", c: "ce", ç: "çe", d: "de", e: "e", ə: "ə", f: "fe", g: "ge", ğ: "ğe", h: "he",
            x: "xı", ı: "ı", i: "i", j: "je", k: "ke", q: "qe", l: "el", m: "em", n: "en", o: "o", ö: "ö",
            p: "pe", r: "er", s: "se", ş: "şe", t: "te", u: "u", ü: "ü", v: "ve", y: "ye", z: "ze",
        };
        const WORDS = new Set(["abş", "nasa", "unesco", "aol", "covid", "fiba", "opec", "rem"]);
        const initialisms = makeInitialismNormalizer({
            lower: azLower, letterName: (l) => LETTER[azLower(l)],
            acronymLetters: new Set(["bmt", "gps", "ms", "knp", "cep", "mt", "mri", "dnt", "ftb", "cctv", "dvd", "pbs", "utc", "gmt"]),
            isRecorded: (w) => WORDS.has(w), isUnreadable: N.isUnreadableAzerbaijani,
        });
        const rows = new Map<string, string>();
        for (const [t, src] of textsFor(["az"], FLEURS_DIR.az, ["az.txt"])) rows.set(t, src);
        const add = (t: string): void => { if (!rows.has(t)) rows.set(t, "synthetic"); };
        for (const n of ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "20", "30", "40", "50", "60", "70", "80", "90", "100", "1000", "1001", "2010", "1000000", "999999999"])
            for (const suf of ["cı", "ci", "cu", "cü", "CI", "Cİ"]) add(`${n}-${suf} yer`);
        for (let h = 0; h <= 24; h++) for (const mm of ["00", "05", "30", "59"]) for (const sfx of ["", "-da", "-də", "-dan", "-dən", "-a", "-ə", "-u"]) add(`saat ${h}:${mm}${sfx} gəldi`);
        for (let a = 0; a <= 11; a++) for (const b of [0, 1, 2, 3, 4, 5, 6, 7, 10, 11, 20, 60, 100]) { add(`${a}/${b}`); add(`${a} ÷ ${b}`); }
        for (const n of ["1", "3", "20", "88", "46"]) for (const sfx of ["i", "ı", "u", "ü", "ni", "nin", "dən", "da", "ə", "a"]) add(`${n}%-${sfx}`);
        const words = new Set<string>();
        for (const [t, src] of rows) {
            const a = N.normalizeAzerbaijani(t);
            emit({ text: units(t), src, op: "normalize" }, a);
            emit({ text: units(t), src, op: "initialisms" }, initialisms(t));
            emit({ text: units(a), src, op: "symbols" }, rec.apply(a));
            for (const m of t.matchAll(/[\p{L}\p{M}]+/gu)) { words.add(m[0]); words.add(m[0].toUpperCase()); words.add(azLower(m[0])); }
        }
        for (const w of words) emit({ text: units(w), src: "words", op: "unreadable" }, String(N.isUnreadableAzerbaijani(w)));
    },
    // The word level: azLower, toSegments, phonemizeWord and the nativiser (rebuilt with azerbaijani.ts's class)
    // over every letter run of the texts (as written, lowercased, uppercased, capitalised), every 1-3 letter string
    // over the alphabet plus the casing specials (third letter from a context set), and edge strings.
    async "az-g2p"() {
        const A = await import("../../../src/languages/azerbaijani/azerbaijani.ts");
        const { toSegments, azLower } = await import("../../../src/languages/azerbaijani/g2p.ts");
        const { makeNativiser } = await import("../../../src/core/hostWord.ts");
        const nat = makeNativiser("[a-zçğəıiöşüx]", "iu");
        const words = new Set<string>();
        for (const t of langTexts("az"))
            for (const m of t.matchAll(/[\p{L}\p{M}]+/gu)) {
                const w = m[0];
                words.add(w); words.add(w.toLowerCase()); words.add(w.toUpperCase()); words.add(w.charAt(0).toUpperCase() + w.slice(1));
            }
        const letters = [..."abcçdeəfgğhxıijkqlmnoöprsştuüvyzwİIƏÇĞÖŞÜQX"];
        for (const a of letters) { words.add(a); for (const b of letters) { words.add(a + b); for (const c of "aeəıioöuüqklgnğ") words.add(a + b + c); } }
        for (const w of ["", "\ud800", "a\udc00q", "i̇", "İ", "İ̇", "ẞ", "Σ", "ﬁ", "ŉ", "K", "ſ", "ǅ", "nk", "nq", "ng", "nkə", "ppp", "qq", "kk", "gg"]) words.add(w);
        for (const w of words) {
            emit({ word: units(w), op: "lower" }, azLower(w));
            emit({ word: units(w), op: "segs" }, toSegments(w).map((s) => `${s.ph}/${s.nucleus ? 1 : 0}`).join(" "));
            emit({ word: units(w), op: "word" }, A.phonemizeWord(w));
            emit({ word: units(w), op: "nat" }, nat(w));
        }
    },
    // numberToWords and ordinalWords over 0…20,000, multiples, powers of ten to 10²⁴ and their neighbours, and
    // the non-integers / negatives / non-finites; the Roman ordinal over 0…120 and its corners.
    async "az-numbers"() {
        const { numberToWords } = await import("../../../src/languages/azerbaijani/numbers.ts");
        const { ordinalWords } = await import("../../../src/languages/azerbaijani/normalize.ts");
        const { ROMAN_POLICY } = await import("../../../src/languages/azerbaijani/romanOrdinals.ts");
        const ns: number[] = [];
        for (let i = 0; i <= 20000; i++) ns.push(i);
        for (let k = 1; k < 1000; k++) ns.push(k * 1e3, k * 1e3 + 1, k * 1e6, k * 1e6 + 1001, k * 1e9 + 4);
        for (let e = 4; e <= 24; e++) ns.push(10 ** e, 10 ** e - 1, 10 ** e + 7);
        ns.push(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER + 1, 1e21, 1.5, 0.5, 1000.7, -1, -0, NaN, Infinity, -Infinity);
        for (const n of ns) {
            emit({ n: String(n), op: "words" }, numberToWords(n));
            emit({ n: String(n), op: "ordinal" }, ordinalWords(n) ?? "\u0000none");
        }
        for (const n of [...Array(121).keys(), -1, 1.5, NaN, Infinity, 1000])
            emit({ n: String(n), op: "roman" }, ROMAN_POLICY.ordinal(n) ?? "\u0000none");
    },
    // normalizeRomans with Azerbaijani's policy (registry.ts romanAz) over the Azerbaijani texts.
    async "az-roman"() {
        const { normalizeRomans } = await import("../../../src/core/roman.ts");
        const { ROMAN_POLICY } = await import("../../../src/languages/azerbaijani/romanOrdinals.ts");
        for (const [t, src] of textsFor(["az"], FLEURS_DIR.az, ["az.txt"])) emit({ text: units(t), src }, normalizeRomans(t, ROMAN_POLICY));
    },
    // ── Kazakh (kk). Inputs: the kk golden, FLEURS kk_kz (columns 3 and 4) and probes/kk.txt. ──
    // normalizeKazakh (which applies the symbol tier inside, step 7) and the tier kazakh.ts exports on the
    // normalized text, plus synthetic rows: every case suffix, ordinal suffix and noun tail after a sweep of
    // numbers, the clock grid × every case suffix, fractions, divisions and degrees. ordinalWord / orthographic /
    // withCase are module-private: these rows drive them.
    async "kk-normalize"() {
        const N = await import("../../../src/languages/kazakh/normalize.ts");
        const { SYMBOLS } = await import("../../../src/languages/kazakh/kazakh.ts");
        const rows = new Map<string, string>();
        for (const [t, src] of textsFor(["kk"], FLEURS_DIR.kk, ["kk.txt"])) rows.set(t, src);
        const add = (t: string): void => { if (!rows.has(t)) rows.set(t, "synthetic"); };
        const sufs = ["ге", "ға", "ке", "қа", "ден", "дан", "тен", "тан", "нен", "нан", "ның", "нің", "дың", "дің", "тың", "тің",
            "да", "де", "та", "те", "мен", "бен", "пен", "ші", "шы", "нші", "ншы", "жылы", "ғасыр", "і", "ы", "ГЕ", "Ші"];
        const ns = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "15", "20", "29", "30", "40", "50", "60", "70", "80",
            "90", "99", "100", "101", "110", "200", "340", "999", "1000", "1001", "1990", "2016", "10000", "99999", "100000", "999999", "1000000", "1000001"];
        for (const n of ns) for (const sfx of sufs) { add(`${n}-${sfx} кейін`); add(`${n}${sfx}`); }
        for (let h = 0; h <= 24; h++) for (const mm of ["00", "05", "30", "59"]) for (const sfx of ["", "-ден", "-да", "-ге", "-та", "-мен", "ге"]) add(`сағат ${h}:${mm}${sfx} келді`);
        for (let a = 0; a <= 11; a++) for (const b of [0, 1, 2, 3, 4, 5, 6, 7, 10, 11, 20, 40, 60, 100, 1000]) { add(`${a}/${b}`); add(`${a} ÷ ${b}`); }
        for (const n of ["0", "1", "5", "30", "40", "1000000"]) for (const d of ["°C", " °C-тан", "°F-ке", "°N", "°w"]) { add(`${n}${d}`); add(`+${n}${d}`); add(`-${n}${d}`); }
        for (const [t, src] of rows) {
            const a = N.normalizeKazakh(t);
            emit({ text: units(t), src, op: "normalize" }, a);
            emit({ text: units(a), src, op: "symbols" }, SYMBOLS(a));
        }
    },
    // phonemizeWord and toSegments over every Cyrillic-block run of the texts (as written, lowercased, uppercased),
    // the camelCase parts, every 1-3 letter string over the alphabet plus the signs (third letter from a context
    // set), every 4-letter string of the cluster letters, and edge strings.
    async "kk-g2p"() {
        const K = await import("../../../src/languages/kazakh/kazakh.ts");
        const { toSegments } = await import("../../../src/languages/kazakh/g2p.ts");
        const words = new Set<string>();
        for (const t of langTexts("kk"))
            for (const w of t.match(/[Ѐ-ӿ]+/gu) ?? []) {
                words.add(w); words.add(w.toLowerCase()); words.add(w.toUpperCase());
                for (const p of w.split(/(?<=\p{Ll})(?=\p{Lu})/u)) words.add(p);
            }
        const abc = [..."аәбвгғдеёжзийкқлмнңоөпрстуұүфхһцчшщъыіьэюя"];
        for (const a of abc) { words.add(a); for (const b of abc) { words.add(a + b); for (const c of "аеыіиуьъл") words.add(a + b + c); } }
        const ctx = [..."стркпьъиу"];
        for (const a of ctx) for (const b of ctx) for (const c of ctx) for (const d of ctx) words.add(a + b + c + d);
        for (const w of ["", "\ud800", "а\udc00б", "ЁЛКА", "Ӏ", "ԥ", "ӑ", "ј"]) words.add(w);
        for (const w of words) {
            emit({ word: units(w), op: "segs" }, toSegments(w).map((s) => `${s.ph}/${s.nucleus ? 1 : 0}`).join(" "));
            emit({ word: units(w), op: "word" }, K.phonemizeWord(w));
        }
    },
    // numberToIpa over 0…20,000, multiples, powers of ten to 10²⁴ and neighbours, the corners; the Roman ordinal.
    async "kk-numbers"() {
        const { numberToIpa } = await import("../../../src/languages/kazakh/numbers.ts");
        const { ROMAN_POLICY } = await import("../../../src/languages/kazakh/romanOrdinals.ts");
        const ns: number[] = [];
        for (let i = 0; i <= 20000; i++) ns.push(i);
        for (let k = 1; k < 1000; k++) ns.push(k * 1e3, k * 1e3 + 1, k * 1e6, k * 1e6 + 1001, k * 1e9 + 4);
        for (let e = 4; e <= 24; e++) ns.push(10 ** e, 10 ** e - 1, 10 ** e + 7);
        ns.push(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER + 1, 1e21, 1e300, 1.5, 0.5, 1000.7, -1, -0, NaN, Infinity, -Infinity);
        for (const n of ns) emit({ n: String(n), op: "ipa" }, numberToIpa(n));
        for (const n of [...Array(121).keys(), -1, 1.5, NaN, Infinity, 1000])
            emit({ n: String(n), op: "roman" }, ROMAN_POLICY.ordinal(n) ?? "\u0000none");
    },
    // normalizeRomans with Kazakh's policy (registry.ts romanKk) over the Kazakh texts.
    async "kk-roman"() {
        const { normalizeRomans } = await import("../../../src/core/roman.ts");
        const { ROMAN_POLICY } = await import("../../../src/languages/kazakh/romanOrdinals.ts");
        for (const [t, src] of textsFor(["kk"], FLEURS_DIR.kk, ["kk.txt"])) emit({ text: units(t), src }, normalizeRomans(t, ROMAN_POLICY));
    },
    // ── Kyrgyz (ky). Inputs: the ky golden, FLEURS ky_kg (columns 3 and 4) and probes/ky.txt. ──
    // normalizeKyrgyz, the initialism pass alone (normalizeKyrgyzInitialisms, both seam modes) on the raw text, and
    // the phonotactic test on every letter run, plus synthetic rows: every case suffix after a sweep of numerals,
    // percents, units and acronyms; ordinal heads; degree shapes; fractions and decimals.
    async "ky-normalize"() {
        const N = await import("../../../src/languages/kyrgyz/normalize.ts");
        const rows = new Map<string, string>();
        for (const [t, src] of textsFor(["ky"], FLEURS_DIR.ky, ["ky.txt"])) rows.set(t, src);
        const add = (t: string): void => { if (!rows.has(t)) rows.set(t, "synthetic"); };
        const sufs = ["дын", "дин", "тун", "нүн", "дан", "дөн", "тан", "дай", "тей", "ына", "сына", "үн", "сын", "га", "кө", "да", "те",
            "ны", "ди", "ту", "ы", "сы", "у", "ү", "орун", "класс", "жылы", "кылым", "ГА", "Дан"];
        const ns = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "20", "30", "40", "50", "60", "70", "80", "90", "100",
            "101", "200", "1000", "2010", "1000000", "999999999999", "1000000000000"];
        for (const n of ns) for (const sfx of sufs) { add(`${n}-${sfx} кийин`); add(`${n}${sfx}`); add(`${n}-${n}-${sfx}`); }
        for (const u of ["км", "кг", "м²", "см3", "га", "л", "km", "ha", "мкг"]) for (const sfx of ["ге", "дан", "де", "ны", "га", "ка", "тан"]) add(`5 ${u}${sfx}`);
        for (const run of ["КР", "АКШ", "БУУ", "ЖОЖ", "NATO", "ООН", "ЭЭМ"]) for (const sfx of ["дин", "га", "до", "нун", "ны", "дан"]) add(`${run}${sfx}`);
        for (const d of ["°C", "°С-та", "°", "°-ка", "°F", "°30′", "°30′15″", "оC"]) for (const n of ["5", "-5", "−5", "+5", "5,5"]) add(`${n}${d}`);
        for (let a = 0; a <= 13; a++) for (const b of [1, 2, 3, 4, 5, 10, 12, 13]) add(`${a}/${b}`);
        for (const n of ["0", "3", "12", "999999999999", "1000000000000"]) for (const f of ["5", "25", "05", "123"]) { add(`${n},${f}`); add(`${n}.${f}`); }
        const words = new Set<string>();
        for (const [t, src] of rows) {
            emit({ text: units(t), src, op: "normalize" }, N.normalizeKyrgyz(t));
            emit({ text: units(t), src, op: "initialisms" }, N.normalizeKyrgyzInitialisms(t));
            for (const m of t.matchAll(/[\p{L}\p{M}]+/gu)) { words.add(m[0]); words.add(m[0].toLowerCase()); }
        }
        for (const w of words) emit({ text: units(w), src: "words", op: "unreadable" }, String(N.isUnreadableKyrgyz(w)));
    },
    // phonemizeWord over every Cyrillic-block run of the texts (as written and lowercased), every 1-3 letter string
    // over the alphabet (third letter from a context set), every 4-letter string of the harmony letters, and edges.
    async "ky-g2p"() {
        const K = await import("../../../src/languages/kyrgyz/kyrgyz.ts");
        const words = new Set<string>();
        for (const t of langTexts("ky")) for (const w of t.match(/[Ѐ-ӿ]+/gu) ?? []) { words.add(w); words.add(w.toLowerCase()); }
        const abc = [..."абвгдеёжзийклмнңоөпрстуүфхцчшщъыьэюя"];
        for (const a of abc) { words.add(a); for (const b of abc) { words.add(a + b); for (const c of "аеыиуүкглб") words.add(a + b + c); } }
        const ctx = [..."кглбаеоү"];
        for (const a of ctx) for (const b of ctx) for (const c of ctx) for (const d of ctx) words.add(a + b + c + d);
        for (const w of ["", "\ud800", "а\udc00б", "ТОО", "Ӏ", "ә", "і", "ј", "аааа", "кк"]) words.add(w);
        for (const w of words) emit({ word: units(w), op: "word" }, K.phonemizeWord(w));
    },
    // numberWords and kyrgyzOrdinal over 0…20,000, multiples, powers of ten to 10²⁴ and neighbours, the corners;
    // the engine's own number reading (createKyrgyz().text on a digit run: renderNumber / spellDigits).
    async "ky-numbers"() {
        const K = await import("../../../src/languages/kyrgyz/kyrgyz.ts");
        const { kyrgyzOrdinal } = await import("../../../src/languages/kyrgyz/normalize.ts");
        const P = K.createKyrgyz();
        const ns: number[] = [];
        for (let i = 0; i <= 20000; i++) ns.push(i);
        for (let k = 1; k < 1000; k++) ns.push(k * 1e3, k * 1e3 + 1, k * 1e6, k * 1e6 + 1001, k * 1e9 + 4, k * 1e12 + 5);
        for (let e = 4; e <= 24; e++) ns.push(10 ** e, 10 ** e - 1, 10 ** e + 7);
        ns.push(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER + 1, 1e21, 1.5, 0.5, 1000.7, -1, -0, NaN, Infinity, -Infinity);
        for (const n of ns) {
            emit({ n: String(n), op: "words" }, K.numberWords(n) ?? "\u0000none");
            emit({ n: String(n), op: "ordinal" }, kyrgyzOrdinal(n) ?? "\u0000none");
        }
        const ds: string[] = ["0", "00", "007", "9007199254740991", "9007199254740993", "12345678901234567890", "1".repeat(40)];
        for (let i = 0; i <= 3000; i++) ds.push(String(i));
        for (let k = 1; k < 1000; k++) ds.push(String(k * 1e6 + 7), String(k * 1e9 + 21), String(k * 1e12 + 300));
        for (const d of ds) emit({ n: d, op: "number" }, P.text(d));
    },
    // ── Uzbek (uz). Inputs: the uz golden, FLEURS uz_uz (columns 3 and 4) and probes/uz.txt. ──
    // normalizeUzbek, the initialism pass alone (rebuilt with normalize.ts's own config — it is module-private) on
    // the raw text, the symbol tier uzbek.ts built (recorded through the wrapper) on the normalized text, and the
    // phonotactic test (rebuilt likewise) on every letter run, plus synthetic ordinal / regnal / fraction / rate rows.
    async "uz-normalize"() {
        const { register } = await import("node:module");
        register(new URL("./symbols-hook.mjs", import.meta.url));
        const { records } = await import("./symbols-wrap.ts");
        const N = await import("../../../src/languages/uzbek/normalize.ts");
        await import("../../../src/languages/uzbek/uzbek.ts");
        const { makeInitialismNormalizer, makeUnreadableTest } = await import("../../../src/core/initialisms.ts");
        const rec = records.find((r) => /src\/languages\/uzbek\//u.test(r.stack.split("\n").slice(2).join("\n")))!;
        const LETTER: Record<string, string> = {
            a: "a", b: "be", c: "se", d: "de", e: "e", f: "ef", g: "ge", h: "ha", i: "i", j: "je",
            k: "ka", l: "el", m: "em", n: "en", o: "o", p: "pe", q: "qa", r: "er", s: "es", t: "te",
            u: "u", v: "ve", w: "ve", x: "xa", y: "ye", z: "ze",
        };
        const unreadable = makeUnreadableTest({
            vowels: /[aeiou]/u,
            legalOnsets: new Set(["bl", "br", "by", "dr", "dy", "fl", "fr", "gl", "gr", "kl", "kr", "kv", "ky", "pl",
                "pr", "ps", "py", "sk", "sl", "sm", "sn", "sp", "st", "sv", "sy", "tr", "ts", "vy"]),
            legalCodas: new Set(["ft", "kt", "ks", "lm", "lt", "nd", "ng", "nk", "nt", "pt", "rd", "rf", "rk", "rl",
                "rm", "rn", "rp", "rs", "rt", "sk", "st", "ts", "yk"]),
        });
        const WORDS = new Set(["aqsh", "nasa", "asus", "opec", "rem", "covid"]);
        const initialisms = makeInitialismNormalizer({
            letterName: (l) => LETTER[l.toLowerCase()], acronymLetters: new Set(["pa", "to", "oha", "aol"]),
            isRecorded: (w) => WORDS.has(w), isUnreadable: unreadable,
        });
        const rows = new Map<string, string>();
        for (const [t, src] of textsFor(["uz"], FLEURS_DIR.uz, ["uz.txt"])) rows.set(t, src);
        const add = (t: string): void => { if (!rows.has(t)) rows.set(t, "synthetic"); };
        for (const n of ["0", "1", "2", "3", "4", "5", "6", "7", "9", "10", "19", "20", "40", "90", "100", "101", "999", "1000", "1001",
            "1978", "2000", "1000000", "1000001", "3,5", "12,25", "9007199254740993"])
            for (const w of ["yil", "oʻrin", "noyabr", "Mart", "regbi", "moliviy", "rasmga", "sinf"]) add(`${n}-${w} keldi`);
        for (const name of ["Yelizaveta", "Pyotr", "Sahifa"]) for (const d of ["1", "2", "3", "39", "40", "12"]) for (const tail of [" ning", " hukmronligi", ".", " kitob"]) add(`${name} ${d}${tail}`);
        for (let a = 0; a <= 13; a++) for (const b of [0, 1, 2, 3, 4, 5, 10, 12, 13]) add(`${a}/${b}`);
        for (const n of ["5", "35", "2,4", "480"]) for (const u of ["km/soat", "km/s", "km/h", "mil/soat", "milya/soat", "m/s"])
            for (const sfx of ["", "ga", "gacha", " dan", "da"]) { add(`${n} ${u}${sfx}`); add(`${n}–40 ${u}`); }
        const words = new Set<string>();
        for (const [t, src] of rows) {
            const a = N.normalizeUzbek(t);
            emit({ text: units(t), src, op: "normalize" }, a);
            emit({ text: units(t), src, op: "initialisms" }, initialisms(t));
            emit({ text: units(a), src, op: "symbols" }, rec.apply(a));
            for (const m of t.matchAll(/[\p{L}\p{M}]+/gu)) { words.add(m[0]); words.add(m[0].toLowerCase()); }
        }
        for (const w of words) emit({ text: units(w), src: "words", op: "unreadable" }, String(unreadable(w)));
    },
    // phonemizeWord and the nativiser (rebuilt with uzbek.ts's class) over every letter run of the texts (as
    // written, lowercased, uppercased), every 1-3 letter string over the alphabet and the apostrophe variants
    // (third letter from a context set), and edge strings.
    async "uz-g2p"() {
        const U = await import("../../../src/languages/uzbek/uzbek.ts");
        const { makeNativiser } = await import("../../../src/core/hostWord.ts");
        const nat = makeNativiser("[a-zʻ'’‘`ʼ′]", "iu");
        const words = new Set<string>();
        for (const t of langTexts("uz"))
            for (const m of t.matchAll(/[\p{L}\p{M}ʻ'’‘`ʼ′]+/gu)) { words.add(m[0]); words.add(m[0].toLowerCase()); words.add(m[0].toUpperCase()); }
        const abc = [..."abcdefghijklmnopqrstuvwxyzʻ'’‘`ʼ′OʻGʻ"];
        for (const a of abc) { words.add(a); for (const b of abc) { words.add(a + b); for (const c of "aeiougnhʻ'") words.add(a + b + c); } }
        for (const w of ["", "\ud800", "a\udc00b", "ŉ", "ǅ", "K", "ſ", "ﬁ", "nʻg", "ngʻ", "ʻa", "aʻ", "ʻʻ", "é", "é"]) words.add(w);
        for (const w of words) {
            emit({ word: units(w), op: "word" }, U.phonemizeWord(w));
            emit({ word: units(w), op: "nat" }, nat(w));
        }
    },
    // numberToWords and ordinalWords over 0…20,000, multiples, powers of ten to 10²⁴ and neighbours, the corners;
    // the Roman ordinal; and the engine's own number reading on digit runs (renderNumber / spellDigits, decimals).
    async "uz-numbers"() {
        const { numberToWords, ordinalWords } = await import("../../../src/languages/uzbek/numbers.ts");
        const { ROMAN_POLICY } = await import("../../../src/languages/uzbek/romanOrdinals.ts");
        const U = await import("../../../src/languages/uzbek/uzbek.ts");
        const P = U.createUzbek();
        const ns: number[] = [];
        for (let i = 0; i <= 20000; i++) ns.push(i);
        for (let k = 1; k < 1000; k++) ns.push(k * 1e3, k * 1e3 + 1, k * 1e6, k * 1e6 + 1001, k * 1e9 + 4, k * 1e12 + 5);
        for (let e = 4; e <= 24; e++) ns.push(10 ** e, 10 ** e - 1, 10 ** e + 7);
        ns.push(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER + 1, 1e21, 1e300, 1.5, 0.5, 1000.7, -1, -0, NaN, Infinity, -Infinity);
        for (const n of ns) {
            emit({ n: String(n), op: "words" }, numberToWords(n));
            emit({ n: String(n), op: "ordinal" }, ordinalWords(n) ?? "\u0000none");
        }
        for (const n of [...Array(121).keys(), -1, 1.5, NaN, Infinity, 1000])
            emit({ n: String(n), op: "roman" }, ROMAN_POLICY.ordinal(n) ?? "\u0000none");
        const ds: string[] = ["0", "00", "007", "9007199254740991", "9007199254740993", "12345678901234567890", "1".repeat(40), "2,5", "0,05", "3,14159"];
        for (let i = 0; i <= 3000; i++) ds.push(String(i));
        for (let k = 1; k < 1000; k++) ds.push(String(k * 1e6 + 7), String(k * 1e9 + 21), String(k * 1e12 + 300));
        for (const d of ds) emit({ n: d, op: "number" }, P.text(d));
    },
    // normalizeRomans with Uzbek's policy (registry.ts romanUz) over the Uzbek texts.
    async "uz-roman"() {
        const { normalizeRomans } = await import("../../../src/core/roman.ts");
        const { ROMAN_POLICY } = await import("../../../src/languages/uzbek/romanOrdinals.ts");
        for (const [t, src] of textsFor(["uz"], FLEURS_DIR.uz, ["uz.txt"])) emit({ text: units(t), src }, normalizeRomans(t, ROMAN_POLICY));
    },
    // ── Turkmen (tk). Inputs: the tk golden and probes/tk.txt (FLEURS has no tk), plus GENERATED shapes. ──
    // normalizeTurkmen, normalizeTurkmenInitialisms (on the raw and the normalized text), foldTurkmenTildes, the
    // symbol tier turkmen.ts built (recorded through the wrapper) on the prepared text, and the phonotactic test,
    // over the texts and synthetic rows: every written-ordinal suffix after a sweep of numbers, the era markers in
    // every trailing context, percents and years with suffixes, fractions, signs, degrees, ranges.
    async "tk-normalize"() {
        const { register } = await import("node:module");
        register(new URL("./symbols-hook.mjs", import.meta.url));
        const { records } = await import("./symbols-wrap.ts");
        const N = await import("../../../src/languages/turkmen/normalize.ts");
        const P = (await import("../../../src/languages/turkmen/turkmen.ts")).createTurkmen();
        const rec = records.find((r) => /src\/languages\/turkmen\//u.test(r.stack.split("\n").slice(2).join("\n")))!;
        const rows = new Map<string, string>();
        for (const [t, src] of textsFor(["tk"], undefined, ["tk.txt"])) rows.set(t, src);
        const add = (t: string): void => { if (!rows.has(t)) rows.set(t, "synthetic"); };
        const sufs = ["nji", "njy", "inji", "ynjy", "unjy", "ünji", "njiden", "njidan", "njisi", "njysy", "njilerde", "njynyň", "NJI", "nj", "ji"];
        const ns = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "20", "30", "40", "50", "60", "70", "80", "90", "100",
            "101", "200", "1000", "1990", "2024", "1000000", "1000000000", "9007199254740993"];
        for (const n of ns) for (const sfx of sufs) { add(`${n}-${sfx} ýyl`); add(`${n} - ${sfx}`); }
        for (const era of ["b.e.ö.", "b. e. ö.", "b.e.öň", "b.e.öňki", "b.e.", "B.E.Ö."]) for (const tail of ["", " 300 ýyl", ".", "\"", " »", ")", " soň"]) add(`Bu ${era}${tail}`);
        for (const n of ["1", "20", "50"]) for (const sfx of ["i", "iň", "den", "e", "ä", "ler"]) { add(`${n}%-${sfx}`); add(`${n} % - ${sfx}`); }
        for (let a = 0; a <= 13; a++) for (const b of [1, 2, 3, 4, 5, 10, 12, 13, 2020]) add(`${a}/${b}`);
        for (const d of ["°C", "°c-den", "°C-a", "°F", "°", "°dan", "°30′", "°30′15″", " ° gradus"]) for (const n of ["5", "-5", "+5", "−5", "(–5"]) add(`${n}${d} boldy`);
        for (const r of ["5-8", "5 - 8", "5–8", "5—8", "1990/95", "-8"]) add(`Gar ${r} sm`);
        for (const [t, src] of rows) {
            const a = N.normalizeTurkmen(t);
            const b = N.normalizeTurkmenInitialisms(a);
            emit({ text: units(t), src, op: "normalize" }, a);
            emit({ text: units(t), src, op: "initialisms" }, N.normalizeTurkmenInitialisms(t));
            emit({ text: units(a), src, op: "initialisms" }, b);
            emit({ text: units(t), src, op: "tildes" }, N.foldTurkmenTildes(t));
            emit({ text: units(b), src, op: "symbols" }, rec.apply(b));
            emit({ text: units(t), src, op: "engine" }, P.text(t));
        }
        const words = new Set<string>();
        for (const t of rows.keys()) for (const m of t.matchAll(/[\p{L}\p{M}]+/gu)) { words.add(m[0]); words.add(m[0].toLowerCase()); }
        for (const w of words) emit({ text: units(w), src: "words", op: "unreadable" }, String(N.isUnreadableTurkmen(w)));
    },
    // phonemizeWord and the nativiser (rebuilt with turkmen.ts's class) over every letter run of the texts (as
    // written, lowercased, uppercased), every 1-3 letter string over the alphabet (third letter from a context
    // set), every 4-letter string of the onset-cluster letters, and edge strings.
    async "tk-g2p"() {
        const T = await import("../../../src/languages/turkmen/turkmen.ts");
        const { makeNativiser } = await import("../../../src/core/hostWord.ts");
        const nat = makeNativiser("[a-zäçžňöşüýA-ZÄÇŽŇÖŞÜÝ]", "iu");
        const words = new Set<string>();
        for (const t of langTexts("tk")) for (const m of t.matchAll(/[\p{L}\p{M}]+/gu)) { words.add(m[0]); words.add(m[0].toLowerCase()); words.add(m[0].toUpperCase()); }
        const abc = [..."abçdeäfghijžklmnňoöprsştuüwyýzcqvxÄÇŽŇÖŞÜÝ"];
        for (const a of abc) { words.add(a); for (const b of abc) { words.add(a + b); for (const c of "aeiouyäöüsrlmn") words.add(a + b + c); } }
        const ctx = [..."strpklmnşçjaey"];
        for (const a of ctx) for (const b of ctx) for (const c of ctx) for (const d of ctx) words.add(a + b + c + d);
        for (const w of ["", "\ud800", "a\udc00b", "ŉ", "ǅ", "K", "ſ", "ﬁ", "é", "é", "ñ", "İ", "ı"]) words.add(w);
        for (const w of words) {
            emit({ word: units(w), op: "word" }, T.phonemizeWord(w));
            emit({ word: units(w), op: "nat" }, nat(w));
        }
    },
    // numberToWords, ordinalOf (both harmony classes) over 0…20,000 and beyond, the Roman ordinal, and the engine's
    // own number reading on digit runs (renderNumber / spellDigits).
    async "tk-numbers"() {
        const { numberToWords } = await import("../../../src/languages/turkmen/numbers.ts");
        const { ordinalOf } = await import("../../../src/languages/turkmen/normalize.ts");
        const { ROMAN_POLICY } = await import("../../../src/languages/turkmen/romanOrdinals.ts");
        const T = await import("../../../src/languages/turkmen/turkmen.ts");
        const P = T.createTurkmen();
        const ns: number[] = [];
        for (let i = 0; i <= 20000; i++) ns.push(i);
        for (let k = 1; k < 1000; k++) ns.push(k * 1e3, k * 1e3 + 1, k * 1e6, k * 1e6 + 1001, k * 1e9 + 4, k * 1e12 + 5);
        for (let e = 4; e <= 24; e++) ns.push(10 ** e, 10 ** e - 1, 10 ** e + 7);
        ns.push(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER + 1, 1e21, 1.5, 0.5, -1, -0, NaN, Infinity, -Infinity);
        for (const n of ns) {
            if (Number.isFinite(n) && n >= 0 && Number.isInteger(n)) emit({ n: String(n), op: "words" }, numberToWords(n).join("|"));
            emit({ n: String(n), front: true, op: "ordinal" }, ordinalOf(n, true) ?? "\u0000none");
            emit({ n: String(n), front: false, op: "ordinal" }, ordinalOf(n, false) ?? "\u0000none");
        }
        for (const n of [...Array(121).keys(), -1, 1.5, NaN, Infinity, 1000])
            emit({ n: String(n), op: "roman" }, ROMAN_POLICY.ordinal(n) ?? "\u0000none");
        const ds: string[] = ["0", "00", "007", "9007199254740991", "9007199254740993", "12345678901234567890", "1".repeat(40)];
        for (let i = 0; i <= 3000; i++) ds.push(String(i));
        for (let k = 1; k < 1000; k++) ds.push(String(k * 1e6 + 7), String(k * 1e9 + 21), String(k * 1e12 + 300));
        for (const d of ds) emit({ n: d, op: "number" }, P.text(d));
    },
    // normalizeRomans with Turkmen's policy (registry.ts romanTk) over the Turkmen texts.
    async "tk-roman"() {
        const { normalizeRomans } = await import("../../../src/core/roman.ts");
        const { ROMAN_POLICY } = await import("../../../src/languages/turkmen/romanOrdinals.ts");
        const rows = new Map(textsFor(["tk"], undefined, ["tk.txt"]));
        for (const r of ["I", "II", "IV", "IX", "XIX", "XX", "XXI", "C", "MM", "L"]) for (const ctx of ["asyr", "asyrda", "asyrlaryň", "asyrdan", "ýyl", "asyrlik"]) { rows.set(`${r} ${ctx}`, "synthetic"); rows.set(`${ctx} ${r}`, "synthetic"); }
        for (const [t, src] of rows) emit({ text: units(t), src }, normalizeRomans(t, ROMAN_POLICY));
    },
    // ── Tatar (tt). Inputs: the tt golden and probes/tt.txt (FLEURS has no tt), plus GENERATED shapes. ──
    // normalizeTatar, normalizeTatarInitialisms (on the raw and the normalized text), the symbol tier tatar.ts built
    // (recorded through the wrapper) on the prepared text, the engine's text(), and the phonotactic test, over the
    // texts and synthetic rows: every ordinal / case suffix after a sweep of numbers (hyphenated, glued, spaced),
    // the era markers in every trailing context, clocks with suffixes, degrees with suffixes, signs, ranges.
    async "tt-normalize"() {
        const { register } = await import("node:module");
        register(new URL("./symbols-hook.mjs", import.meta.url));
        const { records } = await import("./symbols-wrap.ts");
        const N = await import("../../../src/languages/tatar/normalize.ts");
        const P = (await import("../../../src/languages/tatar/tatar.ts")).createTatar();
        const rec = records.find((r) => /src\/languages\/tatar\//u.test(r.stack.split("\n").slice(2).join("\n")))!;
        const rows = new Map<string, string>();
        for (const [t, src] of textsFor(["tt"], undefined, ["tt.txt"])) rows.set(t, src);
        const add = (t: string): void => { if (!rows.has(t)) rows.set(t, "synthetic"); };
        const sufs = ["нче", "нчы", "енче", "ынчы", "нчедә", "енчесе", "нчыга", "ның", "нең", "га", "гә", "ка", "кә", "да", "дә", "та", "тә",
            "дан", "тән", "ннан", "лар", "ләр", "ларда", "ы", "сы", "ен", "ына", "ндә", "н", "НЧЕ", "ел", "еллар"];
        const ns = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "15", "20", "30", "40", "50", "60", "70", "80", "90",
            "100", "101", "200", "1000", "1990", "2011", "1000000", "1000000000", "9007199254740993"];
        for (const n of ns) for (const sfx of sufs) { add(`${n}-${sfx} кайт`); add(`${n}${sfx}`); add(`${n} ${sfx}`); }
        for (const era of ["б.э.к.", "б. э. к.", "я.э.к", "б.э.", "я. э.", "һ.б.", "ш.и.", "млрд.", "млн .", "Б.Э.К."]) for (const tail of ["", " 300 ел", ".", "\"", " »", ")", " соң"]) add(`Бу ${era}${tail}`);
        for (let h = 0; h <= 25; h++) for (const mm of ["00", "05", "30", "59"]) for (const sfx of ["", "да", "-дә", "тән", "ка", "кә", "х"]) { add(`${h}:${mm}${sfx} килде`); add(`${h}:${mm}:15${sfx}`); }
        for (const d of ["°C", "°С", "°F", "°Ф", "°", "°30′", "°30′та", "°30'да", "°30′кеше", " ° почмак"]) for (const n of ["5", "-5", "+5", "−5", "(–5"]) add(`${n}${d} булды`);
        for (const r of ["5-8", "5 - 8", "5–8", "5—8", "-8", "5 = 5", "2×3", "±2"]) add(`Кар ${r} см`);
        for (const [t, src] of rows) {
            const a = N.normalizeTatar(t);
            const b = N.normalizeTatarInitialisms(a);
            emit({ text: units(t), src, op: "normalize" }, a);
            emit({ text: units(t), src, op: "initialisms" }, N.normalizeTatarInitialisms(t));
            emit({ text: units(a), src, op: "initialisms" }, b);
            emit({ text: units(b), src, op: "symbols" }, rec.apply(b));
            emit({ text: units(t), src, op: "engine" }, P.text(t));
        }
        const words = new Set<string>();
        for (const t of rows.keys()) for (const m of t.matchAll(/[\p{L}\p{M}]+/gu)) { words.add(m[0]); words.add(m[0].toLowerCase()); }
        for (const w of words) emit({ text: units(w), src: "words", op: "unreadable" }, String(N.isUnreadableTatar(w)));
    },
    // phonemizeWord over every Cyrillic-block run of the texts (as written, lowercased, uppercased), every 1-3
    // letter string over the alphabet (third letter from a context set), every 4-letter string of the harmony and
    // cluster letters, and edge strings.
    async "tt-g2p"() {
        const T = await import("../../../src/languages/tatar/tatar.ts");
        const words = new Set<string>();
        for (const t of langTexts("tt")) for (const w of t.match(/[\p{L}\p{M}]+/gu) ?? []) { words.add(w); words.add(w.toLowerCase()); words.add(w.toUpperCase()); }
        const abc = [..."аәбвгдеёжҗзийклмнңоөпрстуүфхһцчшщъыьэюя"];
        for (const a of abc) { words.add(a); for (const b of abc) { words.add(a + b); for (const c of "аәеиыоөуүкгрлсн") words.add(a + b + c); } }
        const ctx = [..."кгаәеоысттрл"];
        for (const a of ctx) for (const b of ctx) for (const c of ctx) for (const d of ctx) words.add(a + b + c + d);
        for (const w of ["", "\ud800", "а\udc00б", "ЁЛКА", "Ӏ", "ԥ", "ӑ", "ј", "е́", "й"]) words.add(w);
        for (const w of words) emit({ word: units(w), op: "word" }, T.phonemizeWord(w));
    },
    // numberToWords and ordinalOf over 0…20,000 and beyond, the Roman ordinal, and the engine's own number reading
    // on digit runs (the unsafe ones digit at a time) and comma decimals.
    async "tt-numbers"() {
        const { numberToWords } = await import("../../../src/languages/tatar/numbers.ts");
        const { ordinalOf } = await import("../../../src/languages/tatar/normalize.ts");
        const { ROMAN_POLICY } = await import("../../../src/languages/tatar/romanOrdinals.ts");
        const P = (await import("../../../src/languages/tatar/tatar.ts")).createTatar();
        const ns: number[] = [];
        for (let i = 0; i <= 20000; i++) ns.push(i);
        for (let k = 1; k < 1000; k++) ns.push(k * 1e3, k * 1e3 + 1, k * 1e6, k * 1e6 + 1001, k * 1e9 + 4, k * 1e12 + 5);
        for (let e = 4; e <= 24; e++) ns.push(10 ** e, 10 ** e - 1, 10 ** e + 7);
        ns.push(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER + 1, 1e21);
        for (const n of ns) {
            emit({ n: String(n), op: "words" }, numberToWords(n).join("|"));
            emit({ n: String(n), op: "ordinal" }, ordinalOf(n) ?? "\u0000none");
        }
        for (const n of [1.5, -1, NaN, Infinity]) emit({ n: String(n), op: "ordinal" }, ordinalOf(n) ?? "\u0000none");
        for (const n of [...Array(121).keys(), -1, 1.5, NaN, Infinity, 1000])
            emit({ n: String(n), op: "roman" }, ROMAN_POLICY.ordinal(n) ?? "\u0000none");
        const ds: string[] = ["0", "00", "007", "9007199254740991", "9007199254740993", "12345678901234567890", "1".repeat(40), "2,5", "0,05", "3,14159"];
        for (let i = 0; i <= 3000; i++) ds.push(String(i));
        for (let k = 1; k < 1000; k++) ds.push(String(k * 1e6 + 7), String(k * 1e9 + 21), String(k * 1e12 + 300));
        for (const d of ds) emit({ n: d, op: "number" }, P.text(d));
    },
    // normalizeRomans with Tatar's policy (registry.ts romanTt) over the Tatar texts and synthetic Roman × context rows.
    async "tt-roman"() {
        const { normalizeRomans } = await import("../../../src/core/roman.ts");
        const { ROMAN_POLICY } = await import("../../../src/languages/tatar/romanOrdinals.ts");
        const rows = new Map(textsFor(["tt"], undefined, ["tt.txt"]));
        for (const r of ["I", "II", "IV", "IX", "XIX", "XX", "XXI", "C", "MM", "L"]) for (const ctx of ["гасыр", "гасырда", "гасырларның", "йөзьеллык", "йөзъеллыкта", "ел", "гасырлык"]) { rows.set(`${r} ${ctx}`, "synthetic"); rows.set(`${ctx} ${r}`, "synthetic"); }
        for (const [t, src] of rows) emit({ text: units(t), src }, normalizeRomans(t, ROMAN_POLICY));
    },
    // ── Danish (da). Inputs: the da golden, FLEURS da_dk (columns 3 and 4) and probes/da.txt. ──
    // normalizeDanish (the symbol tier included) over every text plus synthetic rows for every arm: the thousands
    // dot (3/4/2 digits, a leading zero, chained groups), the decimal comma, the colon clock, each abbreviation in
    // three casings, percent, every degree form, squared units, ordinal ranges / coordinated / single (1…40, padded),
    // ranges, every currency sign in both positions and before a letter, signs, relational signs, the ampersand;
    // and `createDanish().text` over the same rows (the tokenizer and the number words).
    async "da-normalize"() {
        const { normalizeDanish } = await import("../../../src/languages/danish/normalize.ts");
        const { createDanish } = await import("../../../src/languages/danish/danish.ts");
        const { withHost } = await import("../../../src/core/foreign.ts");
        const E = createDanish();
        const rows = new Map<string, string>();
        for (const [t, src] of textsFor(["da"], FLEURS_DIR.da, ["da.txt"])) rows.set(t, src);
        const add = (t: string): void => { if (!rows.has(t)) rows.set(t, "synthetic"); };
        for (const g of ["330.000", "1.000.000", "12.34", "1.2345", "0.500", "00.500", "10.000.0", "1.234,5", "3,00", "12,", ",5", "802.11"]) add(`der er ${g} mennesker`);
        for (const c of ["9:05", "14:30", "24:60", "123:456", "1:2", "kl. 14:30"]) add(`ved ${c} i dag`);
        for (const ab of ["kl.", "bl.a.", "f.eks.", "dvs.", "osv.", "nr.", "dr."]) for (const v of [ab, ab.toUpperCase(), ab[0]!.toUpperCase() + ab.slice(1)]) for (const tail of [" 5", "", " Så", "x"]) add(`det var ${v}${tail}`);
        for (const d of ["20 °C", "20°c", "68 ° F", "25°Cölner", "35°V", "40°", "5 °", "30 ℃", "86℉", "°C", "12°Ca"]) add(`det er ${d} her`);
        for (const u of ["km²", "km ²", "m²", "cm²", "m³", "mm²", "KM²"]) add(`et areal på 5 ${u} jord`);
        for (let a = 0; a <= 40; a++) for (const tail of [". maj", ". Maj", ".", ".-" + (a + 1) + ". århundrede", ". og " + (a + 2) + ". bind", ". eller " + (a + 2) + ". New"]) add(`den ${a}${tail}`);
        for (const a of ["01", "07", "10"]) for (const tail of [". maj", ".-08. århundrede", ". og 08. bind"]) add(`den ${a}${tail}`);
        for (const r of ["1990-1995", "10 – 20", "1-2-3", "-5-6", "5—7", "a-5", "(−3)", "+30", "2+3", "4 + 5"]) add(`fra ${r} og så`);
        for (const sgn of ["$", "€", "£", "¥"]) for (const f of [`1000${sgn}`, `1000 ${sgn}`, `${sgn}50`, `${sgn} 50`, `${sgn}110m`, `US${sgn}`, `${sgn}`]) add(`det koster ${f} nu`);
        for (const r of ["±", "≈", "≤", "≥", "=", "<", ">", "×", "÷", "&", "＆"]) add(`a ${r} b og 3${r}4`);
        for (const [t, src] of rows) {
            emit({ text: units(t), src, op: "normalize" }, normalizeDanish(t));
            emit({ text: units(t), src, op: "text" }, withHost("da", () => E.text(t)));
        }
    },
    // phonemizeWordRules and phonemizeWord over every letter run (as written and lowercased), every lexicon key,
    // every 1–3 letter string of the alphabet, every 4-letter string over the context letters, corners; the
    // nativiser; numberToWords over 0…20,000, magnitudes and raw strings.
    async "da-g2p"() {
        const { phonemizeWordRules, phonemizeWord, nat, lexicon } = await import("../../../src/languages/danish/danish.ts");
        const { numberToWords } = await import("../../../src/languages/danish/numbers.ts");
        const words = new Set<string>();
        for (const t of langTexts("da")) for (const m of t.matchAll(/[\p{L}\p{M}'’-]+/gu)) { words.add(m[0]); words.add(m[0].toLowerCase()); }
        const abc = [..."abcdefghijklmnopqrstuvwxyzæøåéöäü'"];
        for (const a of abc) { words.add(a); for (const b of abc) { words.add(a + b); for (const c of abc) words.add(a + b + c); } }
        const ctx = [..."aeiodtrcgnkhjvlf"];
        for (const a of ctx) for (const b of ctx) for (const c of ctx) for (const d of ctx) words.add(a + b + c + d);
        for (const p of ["af", "be", "for", "ge", "und", "er"]) for (const s of ["", "b", "r", "rt", "ste", "ler", "en", "et", "el", "ning", "e"]) words.add(p + s);
        for (const w of ["", "İ", "ſ", "\ud800", "a\udc00z", "𝐚𝐛", "ÆBLE", "Østerbro", "ÅEN", "é", "öl", "ﬁsk", "café", "naïve", "Müller"]) words.add(w);
        for (const w of words) {
            emit({ word: units(w), op: "rules" }, phonemizeWordRules(w));
            emit({ word: units(w), op: "word" }, phonemizeWord(w));
            emit({ word: units(w), op: "nat" }, nat(w));
        }
        for (const k of lexicon().keys()) emit({ word: units(k), op: "word" }, phonemizeWord(k));
        const ns: number[] = [];
        for (let i = 0; i <= 20000; i++) ns.push(i);
        for (let k = 1; k < 1000; k++) ns.push(k * 1e3, k * 1e3 + 1, k * 1e3 + 21, k * 1e6, k * 1e6 + 2, k * 1e6 + 1001, k * 1e9, k * 1e9 + 3);
        for (let e = 4; e <= 21; e++) ns.push(10 ** e, 10 ** e - 1, 10 ** e + 7);
        ns.push(Number.MAX_SAFE_INTEGER, 1e12 - 1, 1e12, 1.5, -1, -21, -1.5, -0, NaN, Infinity, -Infinity);
        for (const n of ns) emit({ n: String(n), raw: null, op: "words" }, numberToWords(n));
        for (const raw of ["0", "007", "1234567890", "99999999999999999999", "9007199254740993", "1e3", "12a", "１２", "٣٠", "𝟙2", "", "\ud800"]) {
            emit({ n: String(Number(raw)), raw: units(raw), op: "words" }, numberToWords(Number(raw), raw));
            emit({ n: "1000000000000", raw: units(raw), op: "words" }, numberToWords(1e12, raw));
        }
    },
    // The BiLSTM tagger over every out-of-lexicon word of the texts (nativised, as the pre-pass offers it), every
    // 25th lexicon key, and corners; oneStress over synthetic stress-mark arrangements.
    async "da-tagger"() {
        const { createDanishTagger } = await import("../../../src/languages/danish/danishTagger.ts");
        const { oneStress } = await import("../../../src/core/structuralTagger.ts");
        const { nat, lexicon, DA_WORD } = await import("../../../src/languages/danish/danish.ts");
        const tagger = await createDanishTagger();
        if (!tagger) throw new Error("da tagger unavailable");
        const words = new Set<string>();
        const re = new RegExp(DA_WORD, "gu");
        for (const t of langTexts("da")) for (const m of t.matchAll(re)) words.add(nat(m[0]));
        let i = 0;
        for (const w of lexicon().keys()) if (i++ % 25 === 0) words.add(w);
        for (const w of ["", "мир", "a☃b", "ÆBLE", "ég", "İsted", "ſkib", "x", "qqqq", "abcdefghijklmnopqrstuvwxyzæøå"]) words.add(w);
        for (const w of words) emit({ word: units(w), op: "tag" }, await tagger.tag(w));
        for (const s of ["", "ˈa", "ˈˈa", "ˌˌa", "ˈaˈb", "ˌaˈb", "ˌa", "aˌbˌc", "ba", "bdə", "pst", "ˈˌaˌˈb", "kɐɐ", "øːˀ", "ˈaˌbˈc"])
            emit({ word: units(s), op: "oneStress" }, oneStress(s));
    },
    // ── Norwegian Bokmål (nb). Inputs: the nb golden, FLEURS nb_no (columns 3 and 4) and probes/nb.txt. ──
    // normalizeNorwegian (the symbol tier included) and `createNorwegian().text` over every text plus synthetic rows
    // for every arm: each grouping separator (and a leading zero / four digits), comma grouping vs decimals, colon
    // clocks, each abbreviation in three casings and four tails, percent, every degree form, squared units, dates
    // (valid / day or month out of range / zero), ordinal ranges and dots (0…40, padded), ranges, each currency sign,
    // signs and relational signs.
    async "nb-normalize"() {
        const { normalizeNorwegian } = await import("../../../src/languages/norwegian/normalize.ts");
        const { createNorwegian } = await import("../../../src/languages/norwegian/norwegian.ts");
        const { withHost } = await import("../../../src/core/foreign.ts");
        const E = createNorwegian();
        const rows = new Map<string, string>();
        for (const [t, src] of textsFor(["nb"], FLEURS_DIR.nb, ["nb.txt"])) rows.set(t, src);
        const add = (t: string): void => { if (!rows.has(t)) rows.set(t, "synthetic"); };
        for (const g of ["5 000 000", "1\u00a0250", "3\u202f400", "7\u2009800", "0 500", "12 3456", "23,764", "291,773,000", "0,500", "1,2345", "12,5", "1 234,5", "802.11"]) add(`det er ${g} mennesker`);
        for (const c of ["9:05", "14:30", "24:60", "123:456", "kl. 14:30"]) add(`ved ${c} i dag`);
        for (const ab of ["f.kr.", "f.kr", "e.kr.", "ca.", "kl.", "dvs.", "bl.a.", "f.eks.", "osv.", "nr.", "dr.", "jr."]) for (const v of [ab, ab.toUpperCase(), ab[0]!.toUpperCase() + ab.slice(1)]) for (const tail of [" 5", "", " Så", "x"]) add(`det var ${v}${tail}`);
        for (const d of ["20 °C", "20°c", "68 ° F", "25°Cölner", "40°", "30 ℃", "86℉"]) add(`det er ${d} her`);
        for (const u of ["km²", "km ²", "m²", "cm²", "m³", "KM²"]) add(`et areal på 5 ${u} jord`);
        for (const dt of ["24.08.2021", "5.9.1939", "31.13.2000", "32.01.1999", "00.00.2020", "1.1.20201", "12.12.1912"]) add(`født ${dt} her`);
        for (let a = 0; a <= 40; a++) for (const tail of [". mai", ". Mai", ".", ".–" + (a + 1) + ". århundre"]) add(`den ${a}${tail}`);
        for (const a of ["01", "07", "10"]) for (const tail of [". mai", ".-08. århundre"]) add(`den ${a}${tail}`);
        for (const r of ["1990-1995", "10 – 20", "1-2-3", "-5-6", "5—7", "a-5", "(−3)", "+30", "3+1", "4 + 5", "UTC +1"]) add(`fra ${r} og så`);
        for (const sgn of ["$", "€", "£", "¥"]) for (const f of [`${sgn}50`, `${sgn} 50`, `${sgn}130 000 og`, `${sgn}2500 og`, `${sgn}110m`, `50${sgn}`, `${sgn}`]) add(`det koster ${f} nu`);
        for (const r of ["±", "≈", "≤", "≥", "=", "<", ">", "×", "÷", "&"]) add(`a ${r} b og 3${r}4`);
        for (const [t, src] of rows) {
            emit({ text: units(t), src, op: "normalize" }, normalizeNorwegian(t));
            emit({ text: units(t), src, op: "text" }, withHost("nb", () => E.text(t)));
        }
        // numbers through text(): 0…20,000, magnitudes, 2^53 neighbours, long runs.
        const ns: string[] = [];
        for (let i = 0; i <= 20000; i++) ns.push(String(i));
        for (let k = 1; k < 1000; k += 7) ns.push(String(k * 1e3 + 21), String(k * 1e6 + 1001), String(k * 1e9 + 3));
        ns.push("9007199254740991", "9007199254740992", "9007199254740993", "12345678901234567890", "007", "1000000000000");
        for (const n of ns) emit({ text: units(n), src: "number", op: "text" }, withHost("nb", () => E.text(n)));
    },
    // phonemizeWordRules and phonemizeWord over every letter run (as written and lowercased), every lexicon key,
    // every 1–3 letter string of the alphabet, every 4-letter string over the context letters, corners; the
    // nativiser.
    async "nb-g2p"() {
        const { phonemizeWordRules, phonemizeWord, nat, lexicon } = await import("../../../src/languages/norwegian/norwegian.ts");
        const words = new Set<string>();
        for (const t of langTexts("nb")) for (const m of t.matchAll(/[\p{L}\p{M}'’-]+/gu)) { words.add(m[0]); words.add(m[0].toLowerCase()); }
        const abc = [..."abcdefghijklmnopqrstuvwxyzæøåéèêëàâôü'"];
        for (const a of abc) { words.add(a); for (const b of abc) { words.add(a + b); for (const c of abc) words.add(a + b + c); } }
        const ctx = [..."aeiosktgjrnldhxv"];
        for (const a of ctx) for (const b of ctx) for (const c of ctx) for (const d of ctx) words.add(a + b + c + d);
        for (const s of ["sjon", "tion", "skj", "sk", "ng", "ck", "gn", "hv", "kj", "tj"]) for (const p of ["", "a", "na", "ske", "ber"]) words.add(p + s);
        for (const w of ["", "İ", "ſ", "\ud800", "a\udc00z", "𝐚𝐚", "𝐚𝐛", "ÆBLE", "Øystein", "é", "öl", "ﬁsk", "São", "''", "--"]) words.add(w);
        for (const w of words) {
            emit({ word: units(w), op: "rules" }, phonemizeWordRules(w));
            emit({ word: units(w), op: "word" }, phonemizeWord(w));
            emit({ word: units(w), op: "nat" }, nat(w));
        }
        for (const k of lexicon().keys()) emit({ word: units(k), op: "word" }, phonemizeWord(k));
    },
    // The BiLSTM tagger over every pre-pass word of the texts (raw, as the pre-pass offers it, and nativised),
    // every 25th lexicon key and corners; oneStress with the nb vowel class over synthetic mark arrangements.
    async "nb-tagger"() {
        const { createNorwegianTagger } = await import("../../../src/languages/norwegian/norwegianTagger.ts");
        const { oneStress } = await import("../../../src/core/structuralTagger.ts");
        const { nat, lexicon } = await import("../../../src/languages/norwegian/norwegian.ts");
        const tagger = await createNorwegianTagger();
        if (!tagger) throw new Error("nb tagger unavailable");
        const words = new Set<string>();
        for (const t of langTexts("nb")) for (const m of t.matchAll(/[A-Za-zÆØÅæøåÉéÈèÊêËëÀàÂâÔôÜü]+/gu)) words.add(m[0]);
        for (const t of langTexts("nb")) for (const m of t.matchAll(/[\p{L}\p{M}'’]+/gu)) words.add(nat(m[0]));
        let i = 0;
        for (const w of lexicon().keys()) if (i++ % 25 === 0) words.add(w);
        for (const w of ["", "мир", "a☃b", "ÆBLE", "ég", "İsted", "ſkip", "x", "qqqq", "abcdefghijklmnopqrstuvwxyzæøå"]) words.add(w);
        for (const w of words) emit({ word: units(w), op: "tag" }, await tagger.tag(w));
        for (const s of ["", "ˈa", "ˈˈa", "ˌˌa", "ˈaˈb", "ˌaˈb", "ˌa", "aˌbˌc", "ba", "bdə", "pst", "ˈˌaˌˈb", "kɐɐ", "øːˀ", "ˈaˌbˈc"])
            emit({ word: units(s), op: "oneStressNb" }, oneStress(s, /[ɑaeɛiɪoɔuʉʊyʏøœæ]/u));
    },
    // ── Afrikaans (af). Inputs: the af golden, FLEURS af_za (columns 3 and 4) and probes/af.txt. ──
    // normalizeAfrikaans, the symbol tier over its output (recorded through the wrapper), the initialism pass over
    // the tier's output, and `createAfrikaans().text`, over every text plus synthetic rows for every arm (the
    // article spellings, each multi-dot and dotted abbreviation in three casings and three tails, dotted capitals,
    // ordinal suffixes 0…200 × 7 endings, the clock forms over an hour × minute × marker grid, comma grouping and
    // decimals, version dots, rates, regnal ordinals, degrees, signs, fractions); isUnreadableAfrikaans over every
    // letter run; ordinalWord over 0…2,000 and corners.
    async "af-normalize"() {
        const { register } = await import("node:module");
        register(new URL("./symbols-hook.mjs", import.meta.url));
        const { records } = await import("./symbols-wrap.ts");
        const N = await import("../../../src/languages/afrikaans/normalize.ts");
        const { createAfrikaans } = await import("../../../src/languages/afrikaans/afrikaans.ts");
        const { withHost } = await import("../../../src/core/foreign.ts");
        const rec = records.find((r) => /src\/languages\/afrikaans\//u.test(r.stack.split("\n").slice(2).join("\n")))!;
        const E = createAfrikaans();
        const rows = new Map<string, string>();
        for (const [t, src] of textsFor(["af"], FLEURS_DIR.af, ["af.txt"])) rows.set(t, src);
        const add = (t: string): void => { if (!rows.has(t)) rows.set(t, "synthetic"); };
        for (const a of ["‘n", "’n", "ʼn", "`n", "´n", "ń", "'n", "‘nuwe", "x‘n"]) add(`dit is ${a} huis`);
        for (const ab of ["v.C.", "v. C.", "vC", "n.C.", "n. C", "d.i.", "dr.", "mnr.", "m.p.u.", "m.p.u", "n.m.", "n.m", "Dr", "V.S.", "U. K."])
            for (const v of [ab, ab.toUpperCase(), ab.toLowerCase()]) for (const tail of [" 5 jaar", "", ")", " (x)"]) add(`dit was ${v}${tail}`);
        for (let n = 0; n <= 200; n++) for (const suf of ["ste", "sten", "de", "den", "e", "De", "x"]) add(`die ${n}${suf} keer`);
        for (const h of ["0", "9", "09", "12", "23", "24"]) for (const m of ["00", "05", "30", "59", "60"]) for (const p of ["", " vm", "nm", " NM", " GUT", " UTC"]) { add(`om ${h}:${m}${p} daar`); add(`om ${h}.${m}${p} daar`); add(`om ${h}${m}${p} daar`); }
        for (const g of ["17,500", "1,234,567", "0,500", "12,5", "R2,50", "1,2345", "802.11n", "1.1a", "Figuur 3.2", "12.5km", "600Mbit/s", "6 mbit/s"]) add(`daar is ${g} hier`);
        for (const w of ["Wêreld Oorlog 2", "Wereld oorlog 1", "Wêreldoorlog II", "Wêreld Oorlog IV", "Wêreld Oorlog IIV", "Wêreld Oorlog 0", "Wêreld Oorlog III"]) add(`die ${w} was`);
        for (const d of ["+30°C", "90 ° F-hitte", "20 °c", "45°", "25°Cölner", "±5", "UTC+1", "-5", "−12", "2-3", "1838−1917", "B&B", "a & b", "x = y", "3<4", "5 > 2", "3×4", "8 ÷ 2", "1/5", "1/2", "3/2", "3/4", "1/5/2020", "2/0", "7/100"]) add(`dit is ${d} nou`);
        for (const [t, src] of rows) {
            const a = N.normalizeAfrikaans(t);
            emit({ text: units(t), src, op: "normalize" }, a);
            const b = rec.apply(a);
            emit({ text: units(a), src, op: "symbols" }, b);
            emit({ text: units(b), src, op: "initialisms" }, N.normalizeAfrikaansInitialisms(b));
            emit({ text: units(t), src, op: "text" }, withHost("af", () => E.text(t)));
            for (const m of t.matchAll(/\p{L}+/gu)) for (const w of [m[0], m[0].toLowerCase()]) emit({ word: units(w), op: "unreadable" }, String(N.isUnreadableAfrikaans(w)));
        }
        const ns: number[] = [];
        for (let i = -2; i <= 2000; i++) ns.push(i);
        ns.push(1e6, 1e6 + 12, 999999999, 1e9, 1e9 + 1, 2 ** 53, 1.5, NaN, Infinity);
        for (const n of ns) emit({ n: String(n), op: "ordinal" }, N.ordinalWord(n) ?? "\u0000none");
    },
    // phonemizeWordRules, phonemizeWord and decompose over every letter run (as written and lowercased), every
    // key of both lexicons, every 1–3 letter string of the alphabet, every 4-letter string over the context
    // letters, corners; numberToWords over 0…20,000, magnitudes and raw strings.
    async "af-g2p"() {
        const A = await import("../../../src/languages/afrikaans/afrikaans.ts");
        const { decompose } = await import("../../../src/languages/afrikaans/morphology.ts");
        const { numberToWords } = await import("../../../src/languages/afrikaans/numbers.ts");
        const AF = new URL("../../../src/languages/afrikaans/afrikaans.ts", import.meta.url).href;
        const words = new Set<string>();
        for (const t of langTexts("af")) for (const m of t.matchAll(/[\p{L}\p{M}'’-]+/gu)) { words.add(m[0]); words.add(m[0].toLowerCase()); }
        const abc = [..."abcdefghijklmnopqrstuvwxyzêôûîëïéèáàóúüöñç'"];
        for (const a of abc) { words.add(a); for (const b of abc) { words.add(a + b); for (const c of abc) words.add(a + b + c); } }
        const ctx = [..."aeiouybdgvwstkch"];
        for (const a of ctx) for (const b of ctx) for (const c of ctx) for (const d of ctx) words.add(a + b + c + d);
        for (const w of ["", "İ", "ſ", "\ud800", "a\udc00z", "𝐚𝐛", "'n", "’n", "‘n", "N", "Ê", "é", "öp", "ﬁsk", "bâton", "Dvořák", "ſon"]) words.add(w);
        for (const k of [...loadTsvMap(AF, "af-lexicon.tsv").keys(), ...loadTsvMap(AF, "af-rcrl-lexicon.tsv").keys()]) words.add(k);
        for (const w of words) {
            emit({ word: units(w), op: "rules" }, A.phonemizeWordRules(w));
            emit({ word: units(w), op: "word" }, A.phonemizeWord(w));
            const d = decompose(w);
            emit({ word: units(w), op: "decompose" }, `${d.parts.join("+")}|${d.kinds.join("+")}|${d.stressPart}`);
        }
        const ns: number[] = [];
        for (let i = 0; i <= 20000; i++) ns.push(i);
        for (let k = 1; k < 1000; k++) ns.push(k * 1e3, k * 1e3 + 1, k * 1e3 + 21, k * 1e6, k * 1e6 + 2, k * 1e6 + 1001);
        for (let e = 4; e <= 21; e++) ns.push(10 ** e, 10 ** e - 1, 10 ** e + 7);
        ns.push(Number.MAX_SAFE_INTEGER, 1e9 - 1, 1e9, 1.5, -1, -21, -1.5, -0, NaN, Infinity, -Infinity);
        for (const n of ns) emit({ n: String(n), raw: null, op: "words" }, numberToWords(n));
        for (const raw of ["0", "007", "1234567890", "99999999999999999999", "1e3", "12a", "１２", "٣٠", "𝟙2", "", "\ud800"]) {
            emit({ n: String(Number(raw)), raw: units(raw), op: "words" }, numberToWords(Number(raw), raw));
            emit({ n: "1000000000", raw: units(raw), op: "words" }, numberToWords(1e9, raw));
        }
    },
    // The BiLSTM tagger over every pre-pass word of the texts (keyed NFC + lowercase, as the pre-pass offers it),
    // every 25th RCRL key and corners.
    async "af-tagger"() {
        const { createAfrikaansTagger } = await import("../../../src/languages/afrikaans/afrikaansTagger.ts");
        const AF = new URL("../../../src/languages/afrikaans/afrikaans.ts", import.meta.url).href;
        const tagger = await createAfrikaansTagger();
        if (!tagger) throw new Error("af tagger unavailable");
        const words = new Set<string>();
        const re = /['’]?\p{Script=Latin}[\p{Script=Latin}\p{M}]*(?:['’]\p{Script=Latin}[\p{Script=Latin}\p{M}]*)*/gu;
        for (const t of langTexts("af")) for (const m of t.matchAll(re)) words.add(m[0].normalize("NFC").toLowerCase());
        let i = 0;
        for (const w of loadTsvMap(AF, "af-rcrl-lexicon.tsv").keys()) if (i++ % 25 === 0) words.add(w);
        for (const w of ["", "мир", "a☃b", "ÊKS", "ég", "İsted", "ſkip", "x", "qqqq", "abcdefghijklmnopqrstuvwxyzêôûîëï"]) words.add(w);
        for (const w of words) emit({ word: units(w), op: "tag" }, await tagger.tag(w));
    },
    // ── Luxembourgish (lb). Inputs: the lb golden, FLEURS lb_lu (columns 3 and 4) and probes/lb.txt. ──
    // normalizeLuxembourgish, the symbol tier over its output (recorded through the wrapper) and
    // `createLuxembourgish().text`, over every text plus synthetic rows for every arm: grouping in both forms and
    // every separator, era markers in every position, the multi-dot and single-dot abbreviations (and the long-s
    // fold), ordinals 0…120 after each licenser / before each noun / in lists / unlicensed, sports times, the clock
    // over an hour × minute × licenser grid, fractions, both decimals, ranges, mph, degrees, signs; the Eifeler Regel
    // over every word ending × every following letter; ordinalStem over 0…2,000.
    async "lb-normalize"() {
        const { register } = await import("node:module");
        register(new URL("./symbols-hook.mjs", import.meta.url));
        const { records } = await import("./symbols-wrap.ts");
        const { normalizeLuxembourgish, ordinalStem } = await import("../../../src/languages/luxembourgish/normalize.ts");
        const { applyEifelerRegel } = await import("../../../src/languages/luxembourgish/numbers.ts");
        const { createLuxembourgish } = await import("../../../src/languages/luxembourgish/luxembourgish.ts");
        const { withHost } = await import("../../../src/core/foreign.ts");
        const rec = records.find((r) => /src\/languages\/luxembourgish\//u.test(r.stack.split("\n").slice(2).join("\n")))!;
        const E = createLuxembourgish();
        const rows = new Map<string, string>();
        for (const [t, src] of textsFor(["lb"], FLEURS_DIR.lb, ["lb.txt"])) rows.set(t, src);
        const add = (t: string): void => { if (!rows.has(t)) rows.set(t, "synthetic"); };
        for (const g of ["1.000", "130.000", "1.000.000", "0.500", "1.2345", "9 000", "2\u00a0500", "7\u202f000", "3\u20094000", "12 345 678"]) add(`et kascht ${g} Euro`);
        for (const ab of ["v. Chr.", "v.Chr.", "n. Chr", "v. Chr)", "n.\u00a0Chr."]) for (const tail of [" an", " 5", ".", "!", "", ")."]) add(`am Joer 300 ${ab}${tail}`);
        for (const ab of ["z. B.", "z.B.", "d. h.", "d.h.", "asw.", "Dr.", "NR.", "jr.", "aſw.", "dr"]) for (const tail of [" an", ", déi", ").", ".", ""]) add(`dat ${ab}${tail}`);
        for (let n = 0; n <= 120; n++) for (const [pre, post] of [["", " Joerhonnert"], ["", " Mee"], ["den ", " Dag"], ["der ", " Plaz"], ["vum ", " Dag"], ["", ", 12. an 13. Joerhonnert"], ["ass ", " beim"], ["", " Dag"], ["am ", " Abrëll"]]) add(`${pre}${n}.${post}`);
        for (const h of ["0", "1", "07", "12", "23", "24"]) for (const m of ["00", "05", "15", "59", "60"]) for (const [pre, post] of [["um ", ""], ["", " Auer"], ["", " UTC"], ["Um ", " MDT"], ["", ""], ["géint ", ","]]) add(`${pre}${h}.${m}${post} dann`);
        for (const t of ["4.41,30", "1.09,02", "12.30,5"]) add(`hien huet ${t} gelaf`);
        for (const f of ["1/5", "1/2", "3/2", "1/4", "3/4", "1/3", "2/7", "1.5/2", "1/2,5", "2/0", "1/100", "999/999"]) add(`ongeféier ${f} Zoll`);
        for (const d of ["1.5", "20.30", "1,5", "7,74", "1894 – 1895", "2 – 3 km", "7 – 8", "1000000 – 2000000", "60 mph", "30 Meilen/h", "20 °C", "90°F", "35 °W", "-5", "(−3)", "A+1", "+3", "±2", "x = y", "3 < 4", "5 > 2", "3 × 4", "8 ÷ 2", "A&B"]) add(`et war ${d} hei`);
        for (const [t, src] of rows) {
            const a = normalizeLuxembourgish(t);
            emit({ text: units(t), src, op: "normalize" }, a);
            emit({ text: units(a), src, op: "symbols" }, rec.apply(a));
            emit({ text: units(t), src, op: "text" }, withHost("lb", () => E.text(t)));
        }
        for (const w of ["an", "een", "siwen", "Milliounen", "Millioun", "eent", "", "n", "dräi"]) for (const f of ["", "a", "b", "d", "e", "h", "n", "t", "z", "v", "A", "B", "D", "Z", "ä", "ë", "é", "è", "ô", "y", "İ", "ſ", "1", ".", " ", "\ud800", "𝐚"]) emit({ word: units(w), following: units(f), op: "eifeler" }, applyEifelerRegel(w, f));
        for (let n = -2; n <= 2000; n++) emit({ n: String(n), op: "stem" }, ordinalStem(n) ?? "\u0000none");
        for (const n of [1e6, 1e6 + 3, 1e9, 1e12, 2 ** 53, 1.5, NaN, Infinity]) emit({ n: String(n), op: "stem" }, ordinalStem(n) ?? "\u0000none");
    },
    // phonemizeWord over every letter run (as written and lowercased), every 1–3 letter string of the alphabet,
    // every 4-letter string over the context letters, corners; the nativiser; numberToWords over 0…20,000,
    // magnitudes and raw strings.
    async "lb-g2p"() {
        const { phonemizeWord } = await import("../../../src/languages/luxembourgish/luxembourgish.ts");
        const { numberToWords } = await import("../../../src/languages/luxembourgish/numbers.ts");
        const { makeNativiser } = await import("../../../src/core/hostWord.ts");
        const nat = makeNativiser("[a-zéëäA-ZÉËÄ'-]", "u");
        const words = new Set<string>();
        for (const t of langTexts("lb")) for (const m of t.matchAll(/[\p{L}\p{M}'’-]+/gu)) { words.add(m[0]); words.add(m[0].toLowerCase()); }
        const abc = [..."abcdefghijklmnopqrstuvwxyzéëäôü'-"];
        for (const a of abc) { words.add(a); for (const b of abc) { words.add(a + b); for (const c of abc) words.add(a + b + c); } }
        const ctx = [..."aeiouëgsntkdbzpvr"];
        for (const a of ctx) for (const b of ctx) for (const c of ctx) for (const d of ctx) words.add(a + b + c + d);
        for (const p of ["ge", "be", "er", "zer", "ze", "ver"]) for (const s of ["", "a", "b", "e", "äin", "follegt", "halen", "ste"]) words.add(p + s);
        for (const w of ["", "İ", "ſ", "\ud800", "a\udc00z", "𝐚𝐛", "Éischt", "é", "öl", "ﬁsch", "Dvořák", "Ångström", "xylo"]) words.add(w);
        for (const w of words) {
            emit({ word: units(w), op: "word" }, phonemizeWord(w));
            emit({ word: units(w), op: "nat" }, nat(w));
        }
        const ns: number[] = [];
        for (let i = 0; i <= 20000; i++) ns.push(i);
        for (let k = 1; k < 1000; k++) ns.push(k * 1e3, k * 1e3 + 1, k * 1e3 + 21, k * 1e6, k * 1e6 + 2, k * 1e6 + 1001, k * 1e9, k * 1e9 + 3);
        for (let e = 4; e <= 21; e++) ns.push(10 ** e, 10 ** e - 1, 10 ** e + 7);
        ns.push(Number.MAX_SAFE_INTEGER, 1e12 - 1, 1e12, 1.5, -1, -21, -1.5, -0, NaN, Infinity, -Infinity);
        for (const n of ns) emit({ n: String(n), raw: null, op: "words" }, numberToWords(n));
        for (const raw of ["0", "007", "1234567890", "99999999999999999999", "1e3", "12a", "１２", "٣٠", "𝟙2", "", "\ud800"]) {
            emit({ n: String(Number(raw)), raw: units(raw), op: "words" }, numberToWords(Number(raw), raw));
            emit({ n: "1000000000000", raw: units(raw), op: "words" }, numberToWords(1e12, raw));
        }
    },
    // ── Bavarian (bar). Inputs: the bar golden and probes/bar.txt; FLEURS has no Bavarian, so the synthetic rows
    // and the probes carry every arm the golden misses. ──
    // normalizeBavarian (the symbol tier included) and `createBavarian().text` over every text plus synthetic rows
    // for every arm: the three `&nbsp;` spellings, `z. B.`, ordinals 0…40 after every licenser / before every head
    // noun / under a governing preposition / declined, each abbreviation in three casings and tails, the clock
    // and clock ranges over an hour × minute grid, both groupings and every separator, degrees, signs in and out of
    // the degree slot, fractions over the full 2-digit × 1-digit grid, ranges ascending / descending / chained.
    async "bar-normalize"() {
        const { normalizeBavarian } = await import("../../../src/languages/bavarian/normalize.ts");
        const { createBavarian } = await import("../../../src/languages/bavarian/bavarian.ts");
        const { withHost } = await import("../../../src/core/foreign.ts");
        const E = createBavarian();
        const rows = new Map<string, string>();
        for (const [t, src] of textsFor(["bar"], undefined, ["bar.txt"])) rows.set(t, src);
        const add = (t: string): void => { if (!rows.has(t)) rows.set(t, "synthetic"); };
        for (const sp of ["&nbsp;", "&#160;", "\u00a0", "&NBSP;", "&#160"]) add(`67${sp}km und a${sp}b`);
        for (const z of ["z. B.", "z.B.", "Z. B.", "z.  B.", "z. b."]) add(`des is ${z} a Haus`);
        for (let n = 0; n <= 40; n++) for (const [pre, post] of [["", " Jenna"], ["", " Joahundat"], ["", " Jh"], ["am ", " Haus"], ["da ", " Buachstob"], ["vo da ", " Person"], ["um de ", " Person"], ["", " ISBN"], ["", " noch"], ["Im ", " Mai"], ["seitm ", " Beziak"], ["", ""]]) add(`${pre}${n}.${post}`);
        for (const ab of ["bzw.", "za.", "ca.", "Eihw.", "Mrd.", "Mio."]) for (const v of [ab, ab.toUpperCase(), ab.toLowerCase()]) for (const tail of [" 5", " €", "", ")", " Haus"]) add(`es san ${v}${tail}`);
        for (const h of ["0", "5", "09", "12", "23", "24", "39"]) for (const m of ["00", "05", "30", "59", "60"]) for (const post of ["", " Uhr", "Uhr", "-9:00 Uhr", " - 12:00", ":36", ".30"]) add(`vo ${h}:${m}${post} do`);
        for (const g of ["30.528", "4.324.782", "0.500", "1.2345", "8140.43P", "549 000", "43\u00a0000", "1\u202f234", "7\u2009000", "12345 678"]) add(`des san ${g} km`);
        for (const d of ["-13 °C", "+15 °C", "30 ℃", "86℉", "20°c", "47°16′15″", "90°-Winkl", "360°", "−1 bis −2 °C", "-0,5 beziehungsweise -1,4 °C", "1961 -1990", "-5 Grad", "(−3 Grad)", "±5"]) add(`do woar ${d} hoit`);
        for (let a = 0; a <= 12; a++) for (let b = 0; b <= 9; b++) add(`des hod ${a}/${b} da`);
        for (const r of ["5 - 8", "6-9", "2003-2004", "9-3", "3-86520-078-8", "8115-2", "1–2", "12—11"]) add(`Beziak ${r} do`);
        for (const [t, src] of rows) {
            emit({ text: units(t), src, op: "normalize" }, normalizeBavarian(t));
            emit({ text: units(t), src, op: "text" }, withHost("bar", () => E.text(t)));
        }
    },
    // phonemizeWord over every letter run (as written and lowercased), every 1–3 letter string of the alphabet,
    // every 4-letter string over the context letters, corners; the nativiser; numberToWords over 0…20,000,
    // magnitudes and raw strings.
    async "bar-g2p"() {
        const { phonemizeWord } = await import("../../../src/languages/bavarian/bavarian.ts");
        const { numberToWords } = await import("../../../src/languages/bavarian/numbers.ts");
        const { makeNativiser } = await import("../../../src/core/hostWord.ts");
        const nat = makeNativiser("[a-zåäöüéèáàâßA-ZÅÄÖÜÉÈÁÀÂ'-]", "u");
        const words = new Set<string>();
        for (const t of langTexts("bar")) for (const m of t.matchAll(/[\p{L}\p{M}'’-]+/gu)) { words.add(m[0]); words.add(m[0].toLowerCase()); }
        const abc = [..."abcdefghijklmnopqrstuvwxyzåäöüéß'-"];
        for (const a of abc) { words.add(a); for (const b of abc) { words.add(a + b); for (const c of abc) words.add(a + b + c); } }
        const ctx = [..."aeiouårhcgnksdtp"];
        for (const a of ctx) for (const b of ctx) for (const c of ctx) for (const d of ctx) words.add(a + b + c + d);
        for (const w of ["", "İ", "ſ", "\ud800", "a\udc00z", "𝐚𝐛", "é", "öl", "ﬁsch", "Dvořák", "Ångström", "Müller", "Ärger"]) words.add(w);
        for (const w of words) {
            emit({ word: units(w), op: "word" }, phonemizeWord(w));
            emit({ word: units(w), op: "nat" }, nat(w));
        }
        const ns: number[] = [];
        for (let i = 0; i <= 20000; i++) ns.push(i);
        for (let k = 1; k < 1000; k++) ns.push(k * 1e3, k * 1e3 + 1, k * 1e3 + 21, k * 1e6, k * 1e6 + 2, k * 1e6 + 1001, k * 1e9, k * 1e9 + 3);
        for (let e = 4; e <= 21; e++) ns.push(10 ** e, 10 ** e - 1, 10 ** e + 7);
        ns.push(Number.MAX_SAFE_INTEGER, 1e12 - 1, 1e12, 1.5, -1, -21, -1.5, -0, NaN, Infinity, -Infinity);
        for (const n of ns) emit({ n: String(n), raw: null, op: "words" }, numberToWords(n));
        for (const raw of ["0", "007", "1234567890", "99999999999999999999", "1e3", "12a", "１２", "٣٠", "𝟙2", "", "\ud800"]) {
            emit({ n: String(Number(raw)), raw: units(raw), op: "words" }, numberToWords(Number(raw), raw));
            emit({ n: "1000000000000", raw: units(raw), op: "words" }, numberToWords(1e12, raw));
        }
    },
    // ── Bashkir (ba). Inputs: the ba golden and probes/ba.txt (FLEURS has no ba), plus GENERATED shapes. ──
    // normalizeBashkir, normalizeBashkirInitialisms (on the raw and the normalized text), the symbol tier bashkir.ts
    // built (recorded through the wrapper) on the prepared text, the engine's text(), and the phonotactic test, over
    // the texts and synthetic rows: every ordinal / case suffix after a sweep of numbers (hyphenated and spaced), the
    // era markers in every trailing context, clocks with suffixes, degrees with the suffix on the sign, signs, ranges.
    async "ba-normalize"() {
        const { register } = await import("node:module");
        register(new URL("./symbols-hook.mjs", import.meta.url));
        const { records } = await import("./symbols-wrap.ts");
        const N = await import("../../../src/languages/bashkir/normalize.ts");
        const P = (await import("../../../src/languages/bashkir/bashkir.ts")).createBashkir();
        const rec = records.find((r) => /src\/languages\/bashkir\//u.test(r.stack.split("\n").slice(2).join("\n")))!;
        const rows = new Map<string, string>();
        for (const [t, src] of textsFor(["ba"], undefined, ["ba.txt"])) rows.set(t, src);
        const add = (t: string): void => { if (!rows.has(t)) rows.set(t, "synthetic"); };
        const sufs = ["се", "сы", "сө", "со", "нсы", "енсе", "сеһе", "сөнөң", "сынан", "ҙән", "дән", "тан", "ҡа", "гә", "ға", "кә", "ҙа", "лә",
            "ө", "ы", "е", "й", "н", "һе", "ның", "ҙың", "ләр", "СЕ", "Се", "ҙәр", "ынсыһы"];
        const ns = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "15", "20", "30", "40", "50", "60", "70", "80", "90",
            "100", "101", "200", "613", "1000", "1990", "2011", "1000000", "1000000000", "9007199254740993"];
        for (const n of ns) for (const sfx of sufs) { add(`${n}-${sfx} килде`); add(`${n} - ${sfx}`); add(`${n}${sfx}`); }
        for (const era of ["б.э.т.", "б. э. т.", "б.э.", "б. э.", "һ.б.", "һ. б.", "Б.Э.Т.", "Һ.Б."]) for (const tail of ["", " 300 йыл", ".", "\"", " »", ")", " һуң"]) add(`Был ${era}${tail}`);
        for (let h = 0; h <= 25; h++) for (const mm of ["00", "05", "30", "59"]) for (const sfx of ["", "-ҙа", "-гә", " - тан", "-ҡа", "-Ҙа", "-х"]) add(`${h}:${mm}${sfx} килде`);
        for (const d of ["°C", "°С", "°c", "°с", "°F", "°Ф", "°", "°-ҡа", "°C-тан", "° С-тан", "С°", "C°-ҡа", "С° -тан", " ° почмаҡ", "°Т"]) for (const n of ["5", "-5", "+5", "−5", "(–5", "0,3"]) add(`${n}${d} булды`);
        for (const r of ["5-8", "5 - 8", "5–8", "5—8", "-8", "5 = 5", "2×3", "±2", "3 г", "3,5 г.", "3 гр", "1991 й.", "1991й.х", "№ 5", "№5"]) add(`Ҡар ${r} см`);
        for (const [t, src] of rows) {
            const a = N.normalizeBashkir(t);
            const b = N.normalizeBashkirInitialisms(a);
            emit({ text: units(t), src, op: "normalize" }, a);
            emit({ text: units(t), src, op: "initialisms" }, N.normalizeBashkirInitialisms(t));
            emit({ text: units(a), src, op: "initialisms" }, b);
            emit({ text: units(b), src, op: "symbols" }, rec.apply(b));
            emit({ text: units(t), src, op: "engine" }, P.text(t));
        }
        const words = new Set<string>();
        for (const t of rows.keys()) for (const m of t.matchAll(/[\p{L}\p{M}]+/gu)) { words.add(m[0]); words.add(m[0].toLowerCase()); }
        for (const w of words) emit({ text: units(w), src: "words", op: "unreadable" }, String(N.isUnreadableBashkir(w)));
    },
    // phonemizeWord (with the Russian-loan route), phonemizeWordNative, isRussianLoan and foldLegacyCodepage over
    // every letter run of the texts (as written, lowercased, uppercased), every 1-3 letter string over the alphabet
    // (third letter from a context set), every 4-letter string of the harmony and glide letters, and edge strings.
    async "ba-g2p"() {
        const B = await import("../../../src/languages/bashkir/bashkir.ts");
        const words = new Set<string>();
        for (const t of langTexts("ba")) for (const w of t.match(/[\p{L}\p{M}]+/gu) ?? []) { words.add(w); words.add(w.toLowerCase()); words.add(w.toUpperCase()); }
        const abc = [..."аәбвгғдҙеёжзийкҡлмнңоөпрсҫтуүфхһцчшщъыьэюяѳӊ"];
        for (const a of abc) { words.add(a); for (const b of abc) { words.add(a + b); for (const c of "аәеиыоөуүлрсн") words.add(a + b + c); } }
        const ctx = [..."ауүеэолыәиҡр"];
        for (const a of ctx) for (const b of ctx) for (const c of ctx) for (const d of ctx) words.add(a + b + c + d);
        for (const w of ["", "\ud800", "а\udc00б", "ЁЛКА", "Ѳ", "Ӊ", "ӑ", "ј", "е́", "й", "республика", "Европа", "миллион"]) words.add(w);
        for (const w of words) {
            emit({ word: units(w), op: "word" }, B.phonemizeWord(w));
            emit({ word: units(w), op: "native" }, B.phonemizeWordNative(w));
            emit({ word: units(w), op: "loan" }, String(B.isRussianLoan(w)));
            emit({ word: units(w), op: "fold" }, B.foldLegacyCodepage(w));
        }
    },
    // numberToWords and ordinalOf over 0…20,000 and beyond, the Roman ordinal, and the engine's own number reading
    // on digit runs (the unsafe ones digit at a time) and comma decimals.
    async "ba-numbers"() {
        const { numberToWords } = await import("../../../src/languages/bashkir/numbers.ts");
        const { ordinalOf } = await import("../../../src/languages/bashkir/normalize.ts");
        const { ROMAN_POLICY } = await import("../../../src/languages/bashkir/romanOrdinals.ts");
        const P = (await import("../../../src/languages/bashkir/bashkir.ts")).createBashkir();
        const ns: number[] = [];
        for (let i = 0; i <= 20000; i++) ns.push(i);
        for (let k = 1; k < 1000; k++) ns.push(k * 1e3, k * 1e3 + 1, k * 1e6, k * 1e6 + 1001, k * 1e9 + 4, k * 1e12 + 5);
        for (let e = 4; e <= 24; e++) ns.push(10 ** e, 10 ** e - 1, 10 ** e + 7);
        ns.push(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER + 1, 1e21);
        for (const n of ns) {
            emit({ n: String(n), op: "words" }, numberToWords(n).join("|"));
            emit({ n: String(n), op: "ordinal" }, ordinalOf(n) ?? "\u0000none");
        }
        for (const n of [1.5, -1, NaN, Infinity]) emit({ n: String(n), op: "ordinal" }, ordinalOf(n) ?? "\u0000none");
        for (const n of [...Array(121).keys(), -1, 1.5, NaN, Infinity, 1000])
            emit({ n: String(n), op: "roman" }, ROMAN_POLICY.ordinal(n) ?? "\u0000none");
        const ds: string[] = ["0", "00", "007", "9007199254740991", "9007199254740993", "12345678901234567890", "1".repeat(40), "2,5", "0,05", "3,14159"];
        for (let i = 0; i <= 3000; i++) ds.push(String(i));
        for (let k = 1; k < 1000; k++) ds.push(String(k * 1e6 + 7), String(k * 1e9 + 21), String(k * 1e12 + 300));
        for (const d of ds) emit({ n: d, op: "number" }, P.text(d));
    },
    // normalizeRomans with Bashkir's policy (registry.ts romanBa) over the Bashkir texts and synthetic Roman × context rows.
    async "ba-roman"() {
        const { normalizeRomans } = await import("../../../src/core/roman.ts");
        const { ROMAN_POLICY } = await import("../../../src/languages/bashkir/romanOrdinals.ts");
        const rows = new Map(textsFor(["ba"], undefined, ["ba.txt"]));
        for (const r of ["I", "II", "IV", "IX", "XIX", "XX", "XXI", "C", "MM", "L"]) for (const ctx of ["быуат", "быуатта", "быуаттарҙың", "Быуаттан", "БЫУАТ", "йыл", "быуатлыҡ"]) { rows.set(`${r} ${ctx}`, "synthetic"); rows.set(`${ctx} ${r}`, "synthetic"); }
        for (const [t, src] of rows) emit({ text: units(t), src }, normalizeRomans(t, ROMAN_POLICY));
    },
    // ── Crimean Tatar (crh). Inputs: the crh golden and probes/crh.txt (FLEURS has no crh), plus GENERATED shapes. ──
    // normalizeCrimeanTatar, the symbol tier normalize.ts built (recorded through the wrapper) on the raw text, and
    // the engine's text(), over the texts and synthetic rows: the percent suffix, the magnitude abbreviations, every
    // grouping mark, the era marker and coordinates in every trailing context, signed ranges, minus and degrees.
    async "crh-normalize"() {
        const { register } = await import("node:module");
        register(new URL("./symbols-hook.mjs", import.meta.url));
        const { records } = await import("./symbols-wrap.ts");
        const N = await import("../../../src/languages/crimeantatar/normalize.ts");
        const P = (await import("../../../src/languages/crimeantatar/crimeantatar.ts")).createCrimeanTatar();
        const rec = records.find((r) => /src\/languages\/crimeantatar\//u.test(r.stack.split("\n").slice(2).join("\n")))!;
        const rows = new Map<string, string>();
        for (const [t, src] of textsFor(["crh"], undefined, ["crh.txt"])) rows.set(t, src);
        const add = (t: string): void => { if (!rows.has(t)) rows.set(t, "synthetic"); };
        for (const n of ["0", "5", "0,7", "12.5", "100", "1 000"]) for (const p of ["%", " %", "%-ine", "% -den", "%ten", "% - ge", "%-İNE", "%-yüzde", "%-x"]) add(`Bu ${n}${p} kele`);
        for (const m of ["mln", "mln.", "mln .", "mlrd", "mlrd.", "Mln", "mlnler", "kvadrat km", "kvadrat  km", "kvadrat km-ge", "kvadrat kmler"]) for (const tail of ["", " km²", " kişi", "."]) add(`5 ${m}${tail}`);
        for (const n of ["1 000", "12 345 678", "1,000", "12,345,678", "1.000", "12.345.678", "1,5", "1.5", "123,4567", "0,123", "3 779,8", "1 000,000.5"]) add(`Bu ${n} metr`);
        for (const ab of ["m.e.", "m. e.", "M.E.", "ş.e.", "c.e.", "ş.b.", "ğ.b.", "ş. e.", "ğ . b ."]) for (const tail of ["", " 753 senesi", ".", "\"", " »", ")", " enlikleri", " boyluğı", "enlik", " ve"]) add(`Bu ${ab}${tail}`);
        for (const r of ["5-8", "5 - 8", "5–8", "5—8", "5 – +8", "+3 – +4", "-8", "–8", "−8", "(–5", "5/6-7", "5-6/7", "1-2-3", "a-5", "x -5"]) for (const d of ["", "°C", " °С", "°c-den", "°-ge", "°", " %"]) add(`Hava ${r}${d} oldı`);
        for (const [t, src] of rows) {
            emit({ text: units(t), src, op: "normalize" }, N.normalizeCrimeanTatar(t));
            emit({ text: units(t), src, op: "symbols" }, rec.apply(t));
            emit({ text: units(t), src, op: "engine" }, P.text(t));
        }
    },
    // phonemizeWord and the nativiser (rebuilt with crimeantatar.ts's class) over every letter run of the texts (as
    // written, lowercased, uppercased), every 1-3 letter string over the alphabet (third letter from a context set),
    // every 4-letter string of the coda and casing letters, and edge strings.
    async "crh-g2p"() {
        const T = await import("../../../src/languages/crimeantatar/crimeantatar.ts");
        const { makeNativiser } = await import("../../../src/core/hostWord.ts");
        const nat = makeNativiser("[a-zâçğıiñöşüA-ZÂÇĞIİÑÖŞÜ]", "u");
        const words = new Set<string>();
        for (const t of langTexts("crh")) for (const m of t.matchAll(/[\p{L}\p{M}]+/gu)) { words.add(m[0]); words.add(m[0].toLowerCase()); words.add(m[0].toUpperCase()); }
        const abc = [..."abcçdefgğhıijklmnñoöprsştuüvyzâqxwIİÂ"];
        for (const a of abc) { words.add(a); for (const b of abc) { words.add(a + b); for (const c of "aeıiouüvlnrs") words.add(a + b + c); } }
        const ctx = [..."avuIİıiqlns"];
        for (const a of ctx) for (const b of ctx) for (const c of ctx) for (const d of ctx) words.add(a + b + c + d);
        for (const w of ["", "\ud800", "a\udc00b", "ŉ", "ǅ", "K", "ſ", "ﬁ", "é", "é", "ñ", "İ", "ı", "ẞ", "Ω", "й"]) words.add(w);
        for (const w of words) {
            emit({ word: units(w), op: "word" }, T.phonemizeWord(w));
            emit({ word: units(w), op: "nat" }, nat(w));
        }
    },
    // numberToWords over 0…20,000 and beyond, and the engine's own number reading on digit runs (the unsafe ones
    // digit at a time).
    async "crh-numbers"() {
        const { numberToWords } = await import("../../../src/languages/crimeantatar/numbers.ts");
        const P = (await import("../../../src/languages/crimeantatar/crimeantatar.ts")).createCrimeanTatar();
        const ns: number[] = [];
        for (let i = 0; i <= 20000; i++) ns.push(i);
        for (let k = 1; k < 1000; k++) ns.push(k * 1e3, k * 1e3 + 1, k * 1e6, k * 1e6 + 1001, k * 1e9 + 4, k * 1e12 + 5);
        for (let e = 4; e <= 24; e++) ns.push(10 ** e, 10 ** e - 1, 10 ** e + 7);
        ns.push(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER + 1, 1e21);
        for (const n of ns) emit({ n: String(n), op: "words" }, numberToWords(n).join("|"));
        const ds: string[] = ["0", "00", "007", "9007199254740991", "9007199254740993", "12345678901234567890", "1".repeat(40)];
        for (let i = 0; i <= 3000; i++) ds.push(String(i));
        for (let k = 1; k < 1000; k++) ds.push(String(k * 1e6 + 7), String(k * 1e9 + 21), String(k * 1e12 + 300));
        for (const d of ds) emit({ n: d, op: "number" }, P.text(d));
    },
    // ── Karakalpak (kaa). Inputs: the kaa golden and probes/kaa.txt (FLEURS has no kaa), plus GENERATED shapes. ──
    // normalizeKarakalpak, the symbol tier normalize.ts built (recorded through the wrapper) on the raw text, and the
    // engine's text(), over the texts and synthetic rows: every percent suffix, the abbreviations, every grouping and
    // decimal mark, the era and year markers, clocks, paired signs, degrees with and without the gloss, ranges.
    async "kaa-normalize"() {
        const { register } = await import("node:module");
        register(new URL("./symbols-hook.mjs", import.meta.url));
        const { records } = await import("./symbols-wrap.ts");
        const N = await import("../../../src/languages/karakalpak/normalize.ts");
        const P = (await import("../../../src/languages/karakalpak/karakalpak.ts")).createKarakalpak();
        const rec = records.find((r) => /src\/languages\/karakalpak\//u.test(r.stack.split("\n").slice(2).join("\n")))!;
        const rows = new Map<string, string>();
        for (const [t, src] of textsFor(["kaa"], undefined, ["kaa.txt"])) rows.set(t, src);
        const add = (t: string): void => { if (!rows.has(t)) rows.set(t, "synthetic"); };
        for (const n of ["0", "5", "0,7", "12.5", "100", "1 000"]) for (const p of ["%", " %", "%in", "% ın", "%ke", "% ki", "%ten", "% dan", "%tı", "% ti", "%i", "%ma", "%-ke", "%KE"]) add(`Bul ${n}${p} boldı`);
        for (const m of ["mln", "mln.", "mln .", "mlrd", "mlrd.", "Mln", "m.kv.", "m. kv .", "km kv", "km.kv.", "km kv.", "kvt/saat", "kvt - saat", "kvt saat", "mlnler"]) for (const tail of ["", " km²", " adam", ".", "ga"]) add(`5 ${m}${tail}`);
        for (const n of ["1,000", "12,345,678", "1,000 mıń", "205,539 million", "1 000", "12 345 678", "1,5", "1.5", "1.2.3", "123,4567", "0,123"]) add(`Bul ${n} metr`);
        for (const ab of ["b.e.sh.", "b. e. sh.", "B.E.SH.", "1994-j.", "1994-j .", "t-rası", "t-ra", "t-ralar"]) for (const tail of ["", " 776-jılı", ".", "\"", " »", ")", " hám"]) add(`Bul ${ab}${tail}`);
        for (let h = 0; h <= 25; h++) for (const mm of ["00", "05", "59", "60"]) for (const sec of ["", ":15", ":75"]) add(`saat ${h}:${mm}${sec} de`);
        for (const r of ["5-8", "5 - 8", "5–8", "5—8", "+40+45", "-32-38", "+3+300", "6+90", "-8", "–8", "−8", "+8", "(–5", "5/6-7", "5-6/7", "1-2-3", "a-5", "x -5", "C++11"]) for (const d of ["", "°C", " °С", "°c", "° gradus", "°", " gradus", "C", " mm"]) add(`Hawa ${r}${d} boldı`);
        for (const [t, src] of rows) {
            emit({ text: units(t), src, op: "normalize" }, N.normalizeKarakalpak(t));
            emit({ text: units(t), src, op: "symbols" }, rec.apply(t));
            emit({ text: units(t), src, op: "engine" }, P.text(t));
        }
    },
    // phonemizeWord and the nativiser (rebuilt with karakalpak.ts's class) over every letter run of the texts (as
    // written, lowercased, uppercased), every 1-3 letter string over the alphabet (third letter from a context set),
    // every 4-letter string of the digraph and casing letters, and edge strings.
    async "kaa-g2p"() {
        const T = await import("../../../src/languages/karakalpak/karakalpak.ts");
        const { makeNativiser } = await import("../../../src/core/hostWord.ts");
        const nat = makeNativiser("[a-záóúíńǵıA-ZÁÓÚÍŃǴIİ]", "u");
        const words = new Set<string>();
        for (const t of langTexts("kaa")) for (const m of t.matchAll(/[\p{L}\p{M}]+/gu)) { words.add(m[0]); words.add(m[0].toLowerCase()); words.add(m[0].toUpperCase()); }
        const abc = [..."aábcdefgǵhıijklmnńoópqrstuúvwxyzíçIİÁŃǴ"];
        for (const a of abc) { words.add(a); for (const b of abc) { words.add(a + b); for (const c of "aeıiouúshcnr") words.add(a + b + c); } }
        const ctx = [..."schıiIİaeqn"];
        for (const a of ctx) for (const b of ctx) for (const c of ctx) for (const d of ctx) words.add(a + b + c + d);
        for (const w of ["", "\ud800", "a\udc00b", "ŉ", "ǅ", "K", "ſ", "ﬁ", "é", "é", "ǵ", "İ", "ı", "ẞ", "Ω", "й", "s\ud800h"]) words.add(w);
        for (const w of words) {
            emit({ word: units(w), op: "word" }, T.phonemizeWord(w));
            emit({ word: units(w), op: "nat" }, nat(w));
        }
    },
    // numberToWords over 0…20,000 and beyond, and the engine's own number reading on digit runs (the unsafe ones
    // digit at a time).
    async "kaa-numbers"() {
        const { numberToWords } = await import("../../../src/languages/karakalpak/numbers.ts");
        const P = (await import("../../../src/languages/karakalpak/karakalpak.ts")).createKarakalpak();
        const ns: number[] = [];
        for (let i = 0; i <= 20000; i++) ns.push(i);
        for (let k = 1; k < 1000; k++) ns.push(k * 1e3, k * 1e3 + 1, k * 1e6, k * 1e6 + 1001, k * 1e9 + 4, k * 1e12 + 5);
        for (let e = 4; e <= 24; e++) ns.push(10 ** e, 10 ** e - 1, 10 ** e + 7);
        ns.push(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER + 1, 1e21);
        for (const n of ns) emit({ n: String(n), op: "words" }, numberToWords(n).join("|"));
        const ds: string[] = ["0", "00", "007", "9007199254740991", "9007199254740993", "12345678901234567890", "1".repeat(40)];
        for (let i = 0; i <= 3000; i++) ds.push(String(i));
        for (let k = 1; k < 1000; k++) ds.push(String(k * 1e6 + 7), String(k * 1e9 + 21), String(k * 1e12 + 300));
        for (const d of ds) emit({ n: d, op: "number" }, P.text(d));
    },
    // ── Nogai (nog). Inputs: the nog golden and probes/nog.txt (no FLEURS, no corpus), plus GENERATED shapes. ──
    // normalizeNogai (= core/separatorHygiene.ts) and the engine's text() over the texts and synthetic rows: every
    // grouping mark and group count, short decimals in every trailing context, dotted runs, and dash spans.
    async "nog-normalize"() {
        const N = await import("../../../src/languages/nogai/normalize.ts");
        const P = (await import("../../../src/languages/nogai/nogai.ts")).createNogai();
        const rows = new Map<string, string>();
        for (const [t, src] of textsFor(["nog"], undefined, ["nog.txt"])) rows.set(t, src);
        const add = (t: string): void => { if (!rows.has(t)) rows.set(t, "synthetic"); };
        const seps = [" ", "\u00a0", "\u202f", "\u2009", ".", ",", "  "];
        for (const sp of seps) for (const head of ["0", "1", "12", "123", "1234"]) for (const groups of [["000"], ["000", "000"], ["234", "5678"], ["23"], ["2"], ["000", "00"]])
            for (const tail of ["", ".", ",", " сом", ".5", ",5", "-"]) add(`${head}${groups.map((g) => sp + g).join("")}${tail}`);
        for (const r of ["5–8", "5 – 8", "5—8", "5-8", "5 — 8", "–8", "5–", "1.2.3", "1.2.3.4.5", "12345.1.1", "1.2", "1..2", "v1.2.3"]) for (const tail of ["", ".", " йыл"]) add(`Сан ${r}${tail}`);
        for (const [t, src] of rows) {
            emit({ text: units(t), src, op: "normalize" }, N.normalizeNogai(t));
            emit({ text: units(t), src, op: "engine" }, P.text(t));
        }
    },
    // phonemizeWord over every Cyrillic run of the texts (as written, lowercased, uppercased), every 1-3 letter string
    // over the alphabet (third letter from a context set), every 4-letter string of the digraph, в and е letters, and
    // edge strings.
    async "nog-g2p"() {
        const T = await import("../../../src/languages/nogai/nogai.ts");
        const words = new Set<string>();
        for (const t of langTexts("nog")) for (const w of t.match(/[\p{L}\p{M}]+/gu) ?? []) { words.add(w); words.add(w.toLowerCase()); words.add(w.toUpperCase()); }
        const abc = [..."абвгдеёжзийклмнопрстуфхцчшщъыьэюя"];
        for (const a of abc) { words.add(a); for (const b of abc) { words.add(a + b); for (const c of "аеиоуыэьъвлрст") words.add(a + b + c); } }
        const ctx = [..."авеоуьъгкнсрт"];
        for (const a of ctx) for (const b of ctx) for (const c of ctx) for (const d of ctx) words.add(a + b + c + d);
        for (const w of ["", "\ud800", "а\udc00б", "ЁЛКА", "Ӏ", "ԥ", "ӑ", "ј", "е́", "й", "а\ud800ь"]) words.add(w);
        for (const w of words) emit({ word: units(w), op: "word" }, T.phonemizeWord(w));
    },
    // numberToWords over 0…20,000 and beyond, and the engine's own number reading on digit runs (the unsafe ones
    // digit at a time).
    async "nog-numbers"() {
        const { numberToWords } = await import("../../../src/languages/nogai/numbers.ts");
        const P = (await import("../../../src/languages/nogai/nogai.ts")).createNogai();
        const ns: number[] = [];
        for (let i = 0; i <= 20000; i++) ns.push(i);
        for (let k = 1; k < 1000; k++) ns.push(k * 1e3, k * 1e3 + 1, k * 1e6, k * 1e6 + 1001, k * 1e9 + 4, k * 1e12 + 5);
        for (let e = 4; e <= 24; e++) ns.push(10 ** e, 10 ** e - 1, 10 ** e + 7);
        ns.push(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER + 1, 1e21);
        for (const n of ns) emit({ n: String(n), op: "words" }, numberToWords(n).join("|"));
        const ds: string[] = ["0", "00", "007", "9007199254740991", "9007199254740993", "12345678901234567890", "1".repeat(40)];
        for (let i = 0; i <= 3000; i++) ds.push(String(i));
        for (let k = 1; k < 1000; k++) ds.push(String(k * 1e6 + 7), String(k * 1e9 + 21), String(k * 1e12 + 300));
        for (const d of ds) emit({ n: d, op: "number" }, P.text(d));
    },
    // ── Chuvash (chv). Inputs: the chv golden and probes/chv.txt (FLEURS has no chv), plus GENERATED shapes. ──
    // normalizeChuvash, normalizeChuvashInitialisms (on the raw and the normalized text), the symbol tier chuvash.ts
    // built (recorded through the wrapper) on the prepared text, spellAttributive on the tier's output, the engine's
    // text(), and the phonotactic test, over the texts and synthetic rows: every -мӗш suffix shape after a sweep of
    // numbers, ordinal ranges, fractions, clocks, magnitude / era abbreviations, degrees, signs, ranges, and figures
    // before words, units and punctuation.
    async "chv-normalize"() {
        const { register } = await import("node:module");
        register(new URL("./symbols-hook.mjs", import.meta.url));
        const { records } = await import("./symbols-wrap.ts");
        const N = await import("../../../src/languages/chuvash/normalize.ts");
        const P = (await import("../../../src/languages/chuvash/chuvash.ts")).createChuvash();
        const rec = records.find((r) => /src\/languages\/chuvash\//u.test(r.stack.split("\n").slice(2).join("\n")))!;
        const rows = new Map<string, string>();
        for (const [t, src] of textsFor(["chv"], undefined, ["chv.txt"])) rows.set(t, src);
        const add = (t: string): void => { if (!rows.has(t)) rows.set(t, "synthetic"); };
        const sufs = ["мӗш", "мĕш", "мӗшӗ", "мĕшĕнче", "мӗшӗсенче", "мӗшсем", "МӖШ", "мӗшӗнчен", "мш", "ри", "мӗшӗсенчен"];
        const ns = ["0", "1", "2", "3", "4", "5", "7", "10", "11", "17", "20", "22", "40", "80", "90", "100", "101", "200", "1000", "1870", "2011",
            "1000000", "9007199254740993"];
        for (const n of ns) for (const sfx of sufs) { add(`${n}-${sfx} кун`); add(`${n} - ${sfx}`); add(`1-${n}-${sfx}`); add(`${n} - 19-${sfx}`); }
        for (const n of ns) for (const tail of [" ҫын", " км", " пин ҫын", ".", ",", " 5", "", " Ҫын", " km", " %"]) add(`Ку ${n}${tail}`);
        for (const [a, b] of [[1, 2], [3, 4], [2, 3], [5, 3], [1, 12], [1, 13], [0, 5], [11, 12]]) for (const p of [" пайӗ", " пай", " пая", " пайĕн", " пайсем", " ҫурт", ""]) add(`вӗсенчен ${a}/${b}${p}`);
        for (let h = 0; h <= 25; h++) for (const mm of ["00", "05", "30", "59", "60"]) { add(`${h}:${mm} килчӗ`); add(`${h}:${mm}:60 UTC`); add(`${h}: ${mm}`); }
        for (const ab of ["млн", "млн.", "МЛН", "млрд.", "трлн", "п. эрч.", "п.эрч.", "ҫ.", "ҫҫ.", "№ "]) for (const tail of ["", " ҫын", " 300", "."]) add(`5 ${ab}${tail}`);
        for (const d of ["°C", "°С", "°с", "°c", "°F", "°Ф", "°ф", "°", " ° кӗтес"]) for (const n of ["5", "-5", "+5", "−5", "(–5", "+ 5", "18,7"]) add(`${n}${d} пулчӗ`);
        for (const r of ["5-8", "5 - 8", "5–8", "5—8", "-8", "±2"]) add(`Юр ${r} см`);
        for (const [t, src] of rows) {
            const a = N.normalizeChuvash(t);
            const b = N.normalizeChuvashInitialisms(a);
            const c = rec.apply(b);
            emit({ text: units(t), src, op: "normalize" }, a);
            emit({ text: units(t), src, op: "initialisms" }, N.normalizeChuvashInitialisms(t));
            emit({ text: units(a), src, op: "initialisms" }, b);
            emit({ text: units(b), src, op: "symbols" }, c);
            emit({ text: units(c), src, op: "attributive" }, N.spellAttributive(c));
            emit({ text: units(t), src, op: "attributive" }, N.spellAttributive(t));
            emit({ text: units(t), src, op: "engine" }, P.text(t));
        }
        const words = new Set<string>();
        for (const t of rows.keys()) for (const m of t.matchAll(/[\p{L}\p{M}]+/gu)) { words.add(m[0]); words.add(m[0].toLowerCase()); }
        for (const w of words) emit({ text: units(w), src: "words", op: "unreadable" }, String(N.isUnreadableChuvash(w)));
    },
    // phonemizeWord over every Cyrillic run of the texts (as written, lowercased, uppercased, NFD), every 1-3 letter
    // string over the alphabet (third letter from a context set), every 4-letter string of the voicing, reduced-vowel,
    // sign and geminate letters, and edge strings.
    async "chv-g2p"() {
        const T = await import("../../../src/languages/chuvash/chuvash.ts");
        const words = new Set<string>();
        for (const t of langTexts("chv")) for (const w of t.match(/[\p{L}\p{M}]+/gu) ?? []) { words.add(w); words.add(w.toLowerCase()); words.add(w.toUpperCase()); words.add(w.normalize("NFD")); }
        const abc = [..."аӑбвгдеӗёжзийклмнҥопрсҫтуӳфхцчшщъыьэюяĕ"];
        for (const a of abc) { words.add(a); for (const b of abc) { words.add(a + b); for (const c of "аӑеӗиуӳыьптксҫ") words.add(a + b + c); } }
        const ctx = [..."аӑӗептсрлнйьъ"];
        for (const a of ctx) for (const b of ctx) for (const c of ctx) for (const d of ctx) words.add(a + b + c + d);
        for (const w of ["", "\ud800", "а\udc00б", "ЁЛКА", "Ӏ", "ԥ", "е́", "й", "ьа", "ъе", "ь", "ппп", "аппа", "атта"]) words.add(w);
        for (const w of words) emit({ word: units(w), op: "word" }, T.phonemizeWord(w));
    },
    // numberToWords (both series) and ordinalOf over 0…20,000 and beyond, the Roman ordinal, and the engine's own
    // number reading on digit runs (the unsafe ones digit at a time) and comma decimals.
    async "chv-numbers"() {
        const { numberToWords } = await import("../../../src/languages/chuvash/numbers.ts");
        const { ordinalOf } = await import("../../../src/languages/chuvash/normalize.ts");
        const { ROMAN_POLICY } = await import("../../../src/languages/chuvash/romanOrdinals.ts");
        const P = (await import("../../../src/languages/chuvash/chuvash.ts")).createChuvash();
        const ns: number[] = [];
        for (let i = 0; i <= 20000; i++) ns.push(i);
        for (let k = 1; k < 1000; k++) ns.push(k * 1e3, k * 1e3 + 1, k * 1e6, k * 1e6 + 1001, k * 1e9 + 4, k * 1e12 + 5);
        for (let e = 4; e <= 24; e++) ns.push(10 ** e, 10 ** e - 1, 10 ** e + 7);
        ns.push(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER + 1, 1e21);
        for (const n of ns) {
            emit({ n: String(n), attr: false, op: "words" }, numberToWords(n).join("|"));
            emit({ n: String(n), attr: true, op: "words" }, numberToWords(n, true).join("|"));
            emit({ n: String(n), op: "ordinal" }, ordinalOf(n) ?? "\u0000none");
        }
        for (const n of [1.5, -1, NaN, Infinity]) emit({ n: String(n), op: "ordinal" }, ordinalOf(n) ?? "\u0000none");
        for (const n of [...Array(121).keys(), -1, 1.5, NaN, Infinity, 1000])
            emit({ n: String(n), op: "roman" }, ROMAN_POLICY.ordinal(n) ?? "\u0000none");
        const ds: string[] = ["0", "00", "007", "9007199254740991", "9007199254740993", "12345678901234567890", "1".repeat(40), "2,5", "0,05", "3,14159"];
        for (let i = 0; i <= 3000; i++) ds.push(String(i));
        for (let k = 1; k < 1000; k++) ds.push(String(k * 1e6 + 7), String(k * 1e9 + 21), String(k * 1e12 + 300));
        for (const d of ds) emit({ n: d, op: "number" }, P.text(d));
    },
    // normalizeRomans with Chuvash's policy (registry.ts romanChv) over the Chuvash texts and synthetic Roman × context
    // rows, with ӗмӗр in both encodings of its ӗ.
    async "chv-roman"() {
        const { normalizeRomans } = await import("../../../src/core/roman.ts");
        const { ROMAN_POLICY } = await import("../../../src/languages/chuvash/romanOrdinals.ts");
        const rows = new Map(textsFor(["chv"], undefined, ["chv.txt"]));
        for (const r of ["I", "II", "IV", "IX", "XIII", "XVIII", "XX", "XXI", "C", "MM", "L"]) for (const ctx of ["ӗмӗр", "ĕмĕр", "ӗмӗрте", "ĕмĕрччен", "ӗмĕрсенче", "ӖМӖР", "Ĕмĕрĕн", "ҫул", "ӗмӗрлӗх"]) { rows.set(`${r} ${ctx}`, "synthetic"); rows.set(`${ctx} ${r}`, "synthetic"); }
        for (const [t, src] of rows) emit({ text: units(t), src }, normalizeRomans(t, ROMAN_POLICY));
    },
    // ── Tajik (tg). Inputs: the tg golden, FLEURS tg_tj (columns 3 and 4) and probes/tg.txt, plus GENERATED shapes. ──
    // normalizeTajik, normalizeTajikInitialisms (on the raw and the normalized text), the symbol tier normalize.ts built
    // (recorded through the wrapper) on the raw text, the engine's text(), and the phonotactic test, over the texts
    // and synthetic rows: every ordinal / case suffix after a sweep of numbers, dotted dates, the abbreviations in every
    // trailing context, degrees with suffixes and compass letters, fractions, ranges and decimals.
    async "tg-normalize"() {
        const { register } = await import("node:module");
        register(new URL("./symbols-hook.mjs", import.meta.url));
        const { records } = await import("./symbols-wrap.ts");
        const N = await import("../../../src/languages/tajik/normalize.ts");
        const P = (await import("../../../src/languages/tajik/tajik.ts")).createTajik();
        const rec = records.find((r) => /src\/languages\/tajik\//u.test(r.stack.split("\n").slice(2).join("\n")))!;
        const rows = new Map<string, string>();
        for (const [t, src] of textsFor(["tg"], FLEURS_DIR.tg, ["tg.txt"])) rows.set(t, src);
        const add = (t: string): void => { if (!rows.has(t)) rows.set(t, "synthetic"); };
        const sufs = ["ум", "юм", "умин", "юми", "ро", "и", "ест", "аш", "ат", "ам", "он", "ҳо", "ҳоро", "x", "РО"];
        const ns = ["0", "1", "2", "3", "5", "10", "11", "20", "21", "30", "33", "40", "100", "101", "200", "999", "1000", "1001", "1992",
            "999999", "1000000", "9007199254740993"];
        for (const n of ns) for (const sfx of sufs) { add(`${n}-${sfx} рӯз`); add(`${n}%-${sfx}`); add(`${n}-${sfx}`); }
        for (const d of ["16.11.1992", "1.1.2000", "32.1.1992", "1.13.1992", "0.5.1992", "16.11.92", "1.2.3.4"]) add(`Ин ${d} буд`);
        for (const ab of ["с.", "С.", "диг.", "ғ.", "млрд.", "млн.", "ҳаз.", "млрд", "млн", "ҳаз"]) for (const tail of ["", " 1992", " нафар", " Нафар", ")", " 5", "."]) { add(`5 ${ab}${tail}`); add(`Ин ${ab}${tail}`); }
        for (const d of ["°C", "°С", "°c", "°с", "°C-ро", "°С-и", "°F", "°f", "°N", "°S", "°E", "°W", "°n", "°", "°-ро", " ° кунҷ"]) for (const n of ["5", "-5", "45"]) add(`${n}${d} буд`);
        for (const r of ["5-8", "5 - 8", "5–8", "5—8", "5 — 8", "а – б", "1/2", "2/3", "9/10", "3/2", "1/11", "1.5", "1,5", "1.2.3", "5=5", "а = б", "нафар/км²", "нафар / км2"]) add(`Ин ${r} аст`);
        for (const [t, src] of rows) {
            const a = N.normalizeTajik(t);
            const b = N.normalizeTajikInitialisms(a);
            emit({ text: units(t), src, op: "normalize" }, a);
            emit({ text: units(t), src, op: "initialisms" }, N.normalizeTajikInitialisms(t));
            emit({ text: units(a), src, op: "initialisms" }, b);
            emit({ text: units(t), src, op: "symbols" }, rec.apply(t));
            emit({ text: units(t), src, op: "engine" }, P.text(t));
        }
        const words = new Set<string>();
        for (const t of rows.keys()) for (const m of t.matchAll(/[\p{L}\p{M}]+/gu)) { words.add(m[0]); words.add(m[0].toLowerCase()); }
        for (const w of words) emit({ text: units(w), src: "words", op: "unreadable" }, String(N.isUnreadableTajik(w)));
    },
    // phonemizeWord over every Cyrillic run of the texts (as written, lowercased, uppercased, NFD), every 1-3 letter
    // string over the alphabet (third letter from a context set), every 4-letter string of the vowel / glide letters,
    // and edge strings.
    async "tg-g2p"() {
        const T = await import("../../../src/languages/tajik/tajik.ts");
        const words = new Set<string>();
        for (const t of langTexts("tg")) for (const w of t.match(/[\p{L}\p{M}]+/gu) ?? []) { words.add(w); words.add(w.toLowerCase()); words.add(w.toUpperCase()); words.add(w.normalize("NFD")); }
        const abc = [..."абвгғдеёжзиӣйкқлмнопрстуӯфхҳчҷшъэюяцщьыѝў"];
        for (const a of abc) { words.add(a); for (const b of abc) { words.add(a + b); for (const c of "аеиӣоуӯэёюяйнр") words.add(a + b + c); } }
        const ctx = [..."аеэиӣйёяъьн"];
        for (const a of ctx) for (const b of ctx) for (const c of ctx) for (const d of ctx) words.add(a + b + c + d);
        for (const w of ["", "\ud800", "а\udc00б", "ЁЛКА", "Ӏ", "ԥ", "е́", "й", "ʼ", "x"]) words.add(w);
        for (const w of words) emit({ word: units(w), op: "word" }, T.phonemizeWord(w));
    },
    // numberWords and tajikOrdinal over 0…20,000 and beyond (to and past 2^53, where the composer has no guard), and the
    // engine's own number reading on digit runs.
    async "tg-numbers"() {
        const T = await import("../../../src/languages/tajik/tajik.ts");
        const { tajikOrdinal } = await import("../../../src/languages/tajik/normalize.ts");
        const P = T.createTajik();
        const ns: number[] = [];
        for (let i = 0; i <= 20000; i++) ns.push(i);
        for (let k = 1; k < 1000; k++) ns.push(k * 1e3, k * 1e3 + 1, k * 1e6, k * 1e6 + 1001, k * 1e9 + 4, k * 1e12 + 5);
        for (let e = 4; e <= 24; e++) ns.push(10 ** e, 10 ** e - 1, 10 ** e + 7);
        ns.push(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER + 1, 1e21, -1, NaN, Infinity);
        for (const n of ns) {
            emit({ n: String(n), op: "words" }, T.numberWords(n));
            emit({ n: String(n), op: "ordinal" }, tajikOrdinal(n) ?? "\u0000none");
        }
        const ds: string[] = ["0", "00", "007", "9007199254740991", "9007199254740993", "12345678901234567890", "1".repeat(40)];
        for (let i = 0; i <= 3000; i++) ds.push(String(i));
        for (let k = 1; k < 1000; k++) ds.push(String(k * 1e6 + 7), String(k * 1e9 + 21), String(k * 1e12 + 300));
        for (const d of ds) emit({ n: d, op: "number" }, P.text(d));
    },
    // ── Welsh (cy). Inputs: the cy golden, FLEURS cy_gb (columns 3 and 4) and probes/cy.txt. ──
    // normalizeWelsh, the symbol tier over its output (recorded through the wrapper) and `createWelsh().text`, over
    // every text plus synthetic rows for every arm: era markers, the currency prefixes and UD/DU/UDA/AS in every case
    // and tail, dotted capitals (NBSP, non-ASCII capitals), ayb., ordinals 0…220 × every suffix, decades, the
    // timezone hyphen, clock ranges and number ranges (every unit, a sign after), clocks over an hour × minute ×
    // marker grid, dot clocks before a timezone, version dots and decimals, comma decimals, fractions over a
    // numerator × denominator grid, degrees, rates, signs; ordinalWords over −2…2,000 and corners; soften.
    async "cy-normalize"() {
        const { register } = await import("node:module");
        register(new URL("./symbols-hook.mjs", import.meta.url));
        const { records } = await import("./symbols-wrap.ts");
        const { normalizeWelsh, ordinalWords, soften } = await import("../../../src/languages/welsh/normalize.ts");
        const { createWelsh } = await import("../../../src/languages/welsh/welsh.ts");
        const { withHost } = await import("../../../src/core/foreign.ts");
        const rec = records.find((r) => /src\/languages\/welsh\//u.test(r.stack.split("\n").slice(2).join("\n")))!;
        const E = createWelsh();
        const rows = new Map<string, string>();
        for (const [t, src] of textsFor(["cy"], FLEURS_DIR.cy, ["cy.txt"])) rows.set(t, src);
        const add = (t: string): void => { if (!rows.has(t)) rows.set(t, "synthetic"); };
        for (const e of ["O.C.", "o.c.", "C.C.", "OC 1000-1300", "oc 5 – 6", "OC"]) for (const tail of ["", ".", " a", ", wedyn"]) add(`yn 400 ${e}${tail}`);
        for (const c of ["AUD$45", "AUD 45", "aud$7", "US$11,000", "US 3", "UD $14.7", "U.D.", "yr UD", "UD,", "UDa", "DU", "du", "DU.", "UDA", "UDA,", "AS", "as", "AS.", "ASa"]) for (const tail of ["", " yma", "."]) add(`mae ${c}${tail}`);
        for (const d of ["George W. Bush", "D. Wyn Jones", "R. Ŵyn Jones", "U.S.A.", "U. S. A.", "U.\u00a0S.", "É.Ü.", "A.b."]) add(`gan ${d} heddiw`);
        for (const a of ["ayb. a", "ayb.", "ayb.,", "AYB. Mae", "ayb.)", "ayb. 5", "aybc."]) add(`llyfrau ${a}`);
        for (let n = 0; n <= 220; n++) for (const sfx of ["fed", "ed", "af", "eg", "ydd", "ain", "FED", "feda"]) add(`y ${n}${sfx} tro`);
        for (const n of ["1,000fed", "1,0fed", "99999fed", "100000fed", "190fed", "007fed", "1.5fed", "x5fed"]) add(`y ${n} tro`);
        for (const d of ["1970au", "90au", "1,900au", "a1970au", "1970aua", "1970AU"]) add(`yn y ${d} roedd`);
        for (const z of ["UTC-08:00", "GMT-0:44", "UTC–5", "a-b", "x-5"]) add(`amser ${z} yma`);
        for (const r of ["10:00-11:00", "6:30 – 7:45", "23:59-00:00", "25:00-26:00", "9:60-10:00", "6-6", "5-3", "6-6.", "7-2.", "26-00", "1894-1895", "100-200", "10-60 munud", "2-3 km", "2-3km", "2 - 3 m", "4-5 kg", "1-2 mm", "5-6 cm", "5-6 cma", "10-20%", "10-20 $", "1995-96, pan", "1,000-2,000", "1-2.5", "3-4.", "9007199254740993-9007199254740995", "1-1000000000"]) add(`roedd ${r} yno`);
        for (const h of ["0", "1", "06", "11", "12", "23", "24"]) for (const m of ["00", "05", "35", "59"]) for (const ap of ["", " p.m.", " a.m.", "pm", "AM", " P.M", " amser", " a", "am."]) add(`am ${h}:${m}${ap} heddiw`);
        for (const c of ["4:41.30", "10:00:00", "1:2", ",5:30"]) add(`amser ${c} yma`);
        for (const c of ["15.00 UTC", "12.00 GMT", "9.30 utc", "24.00 UTC", "15.00UTC"]) add(`am ${c} yna`);
        for (const v of ["802.11n", "802.11n/a/b/g", "2.4Ghz", "5.0Gh", "5.0 GHZ", "1.5 miliwn", "$2.3", "1.234", "4.2-3.9 miliwn", "12.8 km", "12.8km", "1.5 M", "3.25 kg", "0.5 mm", "2.5 cm", "2.5 cma", "1.2.3", "3.14"]) add(`mae ${v} yma`);
        for (const v of ["12,5", "4,2", "1,400", "1,4000", "3,14,", "0,05"]) add(`mae ${v} yma`);
        for (let a = 0; a <= 12; a++) for (const b of [0, 1, 2, 3, 4, 5, 7, 10, 19, 20, 21, 25, 37, 40, 45, 100, 190, 200, 1000]) add(`tua ${a}/${b} modfedd`);
        for (const f of ["2¾", "1½", "1/5/7", "1234/5"]) add(`tua ${f} modfedd`);
        for (const d of ["+30°C", "30 °C", "30°c", "86°F", "86 º F", "45°", "45° ", "45°N", "20°Ca"]) add(`roedd ${d} heddiw`);
        for (const r of ["480 cilomedr/awr", "100 llath/metr", "Cilomedr/Awr", "cilomedr/awra"]) add(`ar ${r} yno`);
        for (const g of ["±2", "+3", "+ 3", "-5", "−5", "a-5", "5-5", "-5 - 6", "A&B", "A&Bs", "Ŵ&Ŷ", "a & b", "x = y", "a=b", "8 ÷ 2", "3 < 4", "5 > 2", "3 × 4", "AT&T"]) add(`mae ${g} yn wir`);
        for (const [t, src] of rows) {
            const a = normalizeWelsh(t);
            emit({ text: units(t), src, op: "normalize" }, a);
            emit({ text: units(a), src, op: "symbols" }, rec.apply(a));
            emit({ text: units(t), src, op: "text" }, withHost("cy", () => E.text(t)));
        }
        for (let n = -2; n <= 2000; n++) emit({ n: String(n), op: "ordinal" }, ordinalWords(n) ?? "\u0000none");
        for (const n of [1e5, 1e6, 2 ** 53, 2 ** 53 + 2, 1.5, 20.5, NaN, Infinity, -0]) emit({ n: String(n), op: "ordinal" }, ordinalWords(n) ?? "\u0000none");
        for (const w of ["pump", "tri", "cant", "dau gant", "llyfr", "Llyfr", "rhif", "Rhyd", "chwech", "ddeg", "ffordd", "ngh", "phump", "thri", "mil", "gardd", "Gwyn", "bach", "deg", "a", "İ", "\ud800x", "𝐚", "Pump", "M"]) emit({ word: units(w), op: "soften" }, soften(w));
    },
    // phonemizeWord and toSegments over every letter run (as written and lowercased), every lexicon key, every 1–3
    // letter string of the alphabet, every 4-letter string over the context letters, enclitic and corner forms; the
    // nativiser; numberToWords over 0…20,000, magnitudes and raw strings.
    async "cy-g2p"() {
        const { phonemizeWord, nat } = await import("../../../src/languages/welsh/welsh.ts");
        const { toSegments } = await import("../../../src/languages/welsh/g2p.ts");
        const { numberToWords } = await import("../../../src/languages/welsh/numbers.ts");
        const W = new URL("../../../src/languages/welsh/welsh.ts", import.meta.url).href;
        const words = new Set<string>();
        for (const t of langTexts("cy")) for (const m of t.matchAll(/[\p{L}\p{M}'’-]+/gu)) { words.add(m[0]); words.add(m[0].toLowerCase()); }
        for (const k of loadTsvMap(W, "lexicon.tsv", undefined, { optional: true }).keys()) words.add(k);
        const abc = [..."abcdefghijklmnopqrstuvwxyzâêîôûŵŷïë'"];
        for (const a of abc) { words.add(a); for (const b of abc) { words.add(a + b); for (const c of abc) words.add(a + b + c); } }
        const ctx = [..."aeiouwyngchdlsr"];
        for (const a of ctx) for (const b of ctx) for (const c of ctx) for (const d of ctx) words.add(a + b + c + d);
        for (const p of ["o", "hi", "mae", "cymru", "i", "y", "fe"]) for (const e of ["'r", "’n", "'m", "'th", "'ch", "'x", "'"]) words.add(p + e);
        for (const w of ["", "İ", "ſ", "\ud800", "a\udc00z", "𝐚𝐛", "é", "Ŵyn", "ﬁ", "Dvořák", "Ångström", "xylo", "Qing", "Joaquim", "nghymru", "Nghymru", "mhrifysgol", "enghraifft", "gwyn", "achwyn", "llyfrau", "cau", "-", "'", "a-b", "constructor", "toString"]) words.add(w);
        for (const w of words) {
            emit({ word: units(w), op: "word" }, phonemizeWord(w));
            emit({ word: units(w), op: "nat" }, nat(w));
            emit({ word: units(w), op: "segs" }, toSegments(w).map((s) => `${s.ph}/${s.nucleus ? 1 : 0}${s.long ? 1 : 0}`).join(" "));
        }
        const ns: number[] = [];
        for (let i = 0; i <= 20000; i++) ns.push(i);
        for (let k = 1; k < 1000; k++) ns.push(k * 1e3, k * 1e3 + 1, k * 1e3 + 21, k * 1e6, k * 1e6 + 2, k * 1e6 + 1001, k * 1e9, k * 1e9 + 3);
        for (let e = 4; e <= 21; e++) ns.push(10 ** e, 10 ** e - 1, 10 ** e + 7);
        ns.push(Number.MAX_SAFE_INTEGER, 1e9 - 1, 1e12, 1.5, -1, -21, -1.5, -0, NaN, Infinity, -Infinity);
        for (const n of ns) emit({ n: String(n), raw: null, op: "words" }, numberToWords(n));
        for (const raw of ["0", "007", "1234567890", "99999999999999999999", "1e3", "12a", "１２", "٣٠", "𝟙2", "", "\ud800", "2.3", "1,400"]) {
            emit({ n: String(Number(raw)), raw: units(raw), op: "words" }, numberToWords(Number(raw), raw));
            emit({ n: "1000000000000", raw: units(raw), op: "words" }, numberToWords(1e12, raw));
        }
    },
    // ── Irish (ga). Inputs: the ga golden, FLEURS ga_ie (columns 3 and 4) and probes/ga.txt. ──
    // normalizeIrish, the symbol tier over its output (recorded through the wrapper) and `createIrish().text`, over
    // every text plus synthetic rows for every arm: zero-width characters, era markers in each position and case,
    // N.A./S.A./srl, US$, dotted capitals, Dr./etc., the `Nú` ordinal over 0…120 after `an`/bare × enclosed and
    // excluded nouns, ranges, the timezone hyphen, clocks over an hour × minute × marker grid, gigahertz, version
    // letters, decimals with every unit and a slash, comma decimals, fractions over a numerator × denominator grid,
    // degrees and compass points, rates, signs, the percent-after-pointe rule; ordinalWords over 0…2,000 with and
    // without a noun.
    async "ga-normalize"() {
        const { register } = await import("node:module");
        register(new URL("./symbols-hook.mjs", import.meta.url));
        const { records } = await import("./symbols-wrap.ts");
        const { normalizeIrish, ordinalWords } = await import("../../../src/languages/irish/normalize.ts");
        const { createIrish } = await import("../../../src/languages/irish/irish.ts");
        const { withHost } = await import("../../../src/core/foreign.ts");
        const rec = records.find((r) => /src\/languages\/irish\//u.test(r.stack.split("\n").slice(2).join("\n")))!;
        const E = createIrish();
        const rows = new Map<string, string>();
        for (const [t, src] of textsFor(["ga"], FLEURS_DIR.ga, ["ga.txt"])) rows.set(t, src);
        const add = (t: string): void => { if (!rows.has(t)) rows.set(t, "synthetic"); };
        for (const z of ["\u200b", "\u200c", "\u200d", "\ufeff"]) add(`fo${z}cal${z} eile`);
        for (const e of ["A.D.", "a.d.", "R.C.", "AD 500", "ad500", "500 AD", "1,200 AD", "500 ADa", "BC 44", "44 BC", "44 bc", "N.A.", "S.A.", "srl", "srl.", "srla", "Srl."]) for (const tail of ["", ".", " agus", ","]) add(`sa bhliain ${e}${tail}`);
        for (const c of ["US$5", "uS$ 5", "US$5,000", "US $5", "AUS$5"]) add(`costas ${c} ann`);
        for (const d of ["U.S.A.", "U. S.", "U.\u00a0S.", "Á.É.", "J. Ó Néill", "A.b."]) add(`le ${d} inniu`);
        for (const a of ["Dr. Ó", "Dr.", "Dr.,", "dr. 5", "etc. agus", "etc.", "etc.)", "ETC. A"]) add(`bhí ${a} ann`);
        for (let n = 0; n <= 120; n++) for (const [pre, post] of [["an ", ""], ["an ", " lá"], ["", " lá"], ["an ", " agus"], ["", ""], ["An ", " hÁras"], ["an ", "\u00a0bliain"], ["", " sa"]]) add(`${pre}${n}ú${post} anseo`);
        for (const n of ["1,000ú", "1,0ú", "999999999999ú", "1000000000000ú", "0ú", "05ú", "1.5ú", "x5ú", "21úa"]) add(`an ${n} uair`);
        for (const r of ["5-3", "1990-1995", "1,000-2,000", "10 – 20", "5-3.", "5-3.5", "a-5", "UTC-5", "x-y"]) add(`idir ${r} ann`);
        for (const h of ["0", "1", "06", "11", "12", "23", "24"]) for (const m of ["00", "05", "35", "59"]) for (const ap of ["", " i.n.", " r.n.", " in", "rn", " a.m.", " P.M.", " am", " pm", " iad"]) add(`ag ${h}:${m}${ap} inniu`);
        for (const c of ["4:41.30", "10:00:00", ",5:30", "25:00"]) add(`am ${c} anseo`);
        for (const v of ["2.4Ghz", "5.0Gh", "802.11n", "802.11n/a", "1.5 km", "1.5km", "1.5 M", "3.25 kg", "0.5 mm", "2.5 cm", "60.5 msu", "60.5 mſu", "1.5 km/h", "1.5 km /u", "2.5 cma", "1.2.3", "3.14", "1.5 kmx"]) add(`tá ${v} ann`);
        for (const v of ["12,5", "4,2", "1,400", "1,4000", "3,14,", "0,05"]) add(`tá ${v} ann`);
        for (let a = 0; a <= 12; a++) for (const b of [0, 1, 2, 3, 4, 5, 7, 10, 11, 12, 19, 20, 21, 25, 37, 40, 45, 100, 101, 190, 200, 1000]) add(`thart ar ${a}/${b} orlach`);
        for (const f of ["2¾", "1½", "1/5/7", "1234/5"]) add(`thart ar ${f} orlach`);
        for (const d of ["+30°C", "30 °C", "30°c", "86°F", "86 º F", "45°", "45°N", "45° S", "45°e", "45°w", "45°ſ", "20°Ca", "45°Na"]) add(`bhí ${d} inné`);
        for (const r of ["100 km/h", "100km / u", "5 m/h", "5 kg/u", "5 mm/h", "5 cm/u", "5 KM/H", "60 msu", "60msu", "60 mſu", "5 km/hx"]) add(`ag ${r} anseo`);
        for (const g of ["±2", "+3", "+ 3", "-5", "−5", "a-5", "5-5", "-5 - 6", "A&B", "A&Bs", "A&Bach", "Á&É", "a & b", "x = y", "a=b", "8 ÷ 2", "3 < 4", "5 > 2", "3 × 4", "AT&T"]) add(`tá ${g} fíor`);
        for (const p of ["1.5 %", "1.5%", "3,5 %", "1.5 % a", "1.5%x", "12 %"]) add(`méadú ${p} ann`);
        for (const [t, src] of rows) {
            const a = normalizeIrish(t);
            emit({ text: units(t), src, op: "normalize" }, a);
            emit({ text: units(a), src, op: "symbols" }, rec.apply(a));
            emit({ text: units(t), src, op: "text" }, withHost("ga", () => E.text(t)));
        }
        for (let n = -2; n <= 2000; n++) for (const noun of ["", "lá"]) emit({ n: String(n), noun: units(noun), op: "ordinal" }, ordinalWords(n, noun) ?? "\u0000none");
        for (const n of [1e6, 1e9, 1e12 - 1, 1e12, 2 ** 53, 1.5, 20.5, NaN, Infinity, -0, 1234567, 1000021]) for (const noun of ["", "bliain"]) emit({ n: String(n), noun: units(noun), op: "ordinal" }, ordinalWords(n, noun) ?? "\u0000none");
    },
    // phonemizeWord, g2pWord and toSegments over every letter run (as written and lowercased), every lexicon key,
    // every 1–3 letter string of the alphabet, every 4-letter string over the context letters, eclipsis / lenition
    // forms and corners; the nativiser; numberToWords over 0…20,000, magnitudes and raw strings.
    async "ga-g2p"() {
        const { phonemizeWord, g2pWord, nat } = await import("../../../src/languages/irish/irish.ts");
        const { toSegments } = await import("../../../src/languages/irish/g2p.ts");
        const { numberToWords } = await import("../../../src/languages/irish/numbers.ts");
        const I = new URL("../../../src/languages/irish/irish.ts", import.meta.url).href;
        const words = new Set<string>();
        for (const t of langTexts("ga")) for (const m of t.matchAll(/[\p{L}\p{M}'’-]+/gu)) { words.add(m[0]); words.add(m[0].toLowerCase()); }
        for (const k of loadTsvMap(I, "lexicon.tsv").keys()) words.add(k);
        const abc = [..."abcdefghijklmnopqrstuvwxyzáéíóú'-"];
        for (const a of abc) { words.add(a); for (const b of abc) { words.add(a + b); for (const c of abc) words.add(a + b + c); } }
        const ctx = [..."aeiouáóbdghlnrst"];
        for (const a of ctx) for (const b of ctx) for (const c of ctx) for (const d of ctx) words.add(a + b + c + d);
        for (const p of ["mb", "gc", "nd", "bp", "dt", "ts", "bhf", "ng", "n-", "t-", "h"]) for (const s of ["ád", "éan", "oileán", "ar", "ír", "uí", "eo"]) words.add(p + s);
        for (const w of ["", "İ", "ſ", "\ud800", "a\udc00z", "𝐚𝐛", "é", "ﬁ", "Dvořák", "Ångström", "xylo", "piquet", "Albuquerque", "yoga", "rr", "carr", "gorm", "bolg", "ainm", "áit", "cóir", "ceoil", "long", "banc", "chéadaigh", "airigh", "-", "'", "d'", "constructor", "toString"]) words.add(w);
        for (const w of words) {
            emit({ word: units(w), op: "word" }, phonemizeWord(w));
            emit({ word: units(w), op: "g2p" }, g2pWord(w));
            emit({ word: units(w), op: "nat" }, nat(w));
            emit({ word: units(w), op: "segs" }, toSegments(w).map((s) => `${s.ph}/${s.nucleus ? 1 : 0}${s.noGlide ? 1 : 0}`).join(" "));
        }
        const ns: number[] = [];
        for (let i = 0; i <= 20000; i++) ns.push(i);
        for (let k = 1; k < 1000; k++) ns.push(k * 1e3, k * 1e3 + 1, k * 1e3 + 21, k * 1e6, k * 1e6 + 2, k * 1e6 + 1001, k * 1e9, k * 1e9 + 3);
        for (let e = 4; e <= 21; e++) ns.push(10 ** e, 10 ** e - 1, 10 ** e + 7);
        ns.push(Number.MAX_SAFE_INTEGER, 1e9 - 1, 1e12, 1.5, -1, -21, -1.5, -0, NaN, Infinity, -Infinity);
        for (const n of ns) emit({ n: String(n), raw: null, op: "words" }, numberToWords(n));
        for (const raw of ["0", "007", "1234567890", "99999999999999999999", "1e3", "12a", "１２", "٣٠", "𝟙2", "", "\ud800", "2.3", "1,400", "-5"]) {
            emit({ n: String(Number(raw)), raw: units(raw), op: "words" }, numberToWords(Number(raw), raw));
            emit({ n: "-1", raw: units(raw), op: "words" }, numberToWords(-1, raw));
        }
    },
    // ── Scottish Gaelic (gd). Inputs: the gd golden and probes/gd.txt; FLEURS has no Scottish Gaelic, so the
    // synthetic rows and the probes carry every arm the golden misses. ──
    // normalizeScottishGaelic, the symbol tier over its output (recorded through the wrapper) and
    // `createScottishGaelic().text`, over every text plus synthetic rows for every arm: grouping with each separator
    // (and the leading-zero guard), the dotted abbreviations in three casings and every tail (and the long-s fold),
    // àireamh, decades, the ordinal over 0…25 × every suffix × hyphen × a following noun, decimals, minus forms.
    async "gd-normalize"() {
        const { register } = await import("node:module");
        register(new URL("./symbols-hook.mjs", import.meta.url));
        const { records } = await import("./symbols-wrap.ts");
        const { normalizeScottishGaelic } = await import("../../../src/languages/scottishgaelic/normalize.ts");
        const { createScottishGaelic } = await import("../../../src/languages/scottishgaelic/scottishgaelic.ts");
        const { withHost } = await import("../../../src/core/foreign.ts");
        const rec = records.find((r) => /src\/languages\/scottishgaelic\//u.test(r.stack.split("\n").slice(2).join("\n")))!;
        const E = createScottishGaelic();
        const rows = new Map<string, string>();
        for (const [t, src] of textsFor(["gd"], undefined, ["gd.txt"])) rows.set(t, src);
        const add = (t: string): void => { if (!rows.has(t)) rows.set(t, "synthetic"); };
        for (const g of ["1,000", "1,000,000", "12,345,678", "0,500", "1.000", "1.234.567", "0.500", "1 000", "2\u00a0500", "7\u202f000", "3\u20094000", "12 345 678", "1,23", "1,2345", "10,000.5", "5 000 000 km"]) add(`tha ${g} duine ann`);
        for (const ab of ["srl.", "SRL.", "Srl.", "td.", "TD.", "bh.", "Bh.", "ſrl.", "srlx.", "asrl."]) for (const tail of [" agus", " 5", " (a)", ".", "", ")", ","]) add(`leabhraichean ${ab}${tail}`);
        for (const a of ["no. 5", "No.5", "àir. 7", "Àir.3", "№ 4", "№4", "no.", "àir. x"]) add(`aig ${a} an seo`);
        for (const d of ["1990s", "1800s", "2000s", "2010s", "1990sa", "199s", "1995s", "2100s"]) add(`anns na ${d} bha`);
        for (let n = 0; n <= 25; n++) for (const sfx of ["mh", "na", "s", "d", "MH", "ſ", "x"]) for (const hy of ["", "-"]) for (const tail of ["", " latha", " Latha", " àite'n", ".", " 5"]) add(`an ${n}${hy}${sfx}${tail} seo`);
        for (const d of ["1.5", "3.14", "10.05", "1.234", "1.5km", "1.5.2", "x1.5", "0.5"]) add(`tha ${d} ann`);
        for (const m of ["-5", "−5", "–5", "(-3)", "a -5", "5-3", "x-5", " -5"]) add(`teòthachd ${m} ceum`);
        for (const [t, src] of rows) {
            const a = normalizeScottishGaelic(t);
            emit({ text: units(t), src, op: "normalize" }, a);
            emit({ text: units(a), src, op: "symbols" }, rec.apply(a));
            emit({ text: units(t), src, op: "text" }, withHost("gd", () => E.text(t)));
        }
    },
    // phonemizeWord and the nativiser over every letter run (as written and lowercased), every 1–3 letter string of
    // the alphabet, every 4-letter string over the context letters, lenition/pre-aspiration corners; numberToWords
    // over 0…20,000, magnitudes and raw strings.
    async "gd-g2p"() {
        const { phonemizeWord, numberToWords } = await import("../../../src/languages/scottishgaelic/scottishgaelic.ts");
        const { makeNativiser } = await import("../../../src/core/hostWord.ts");
        const nat = makeNativiser("[a-zàèìòùáéíóúA-ZÀÈÌÒÙÁÉÍÓÚ]", "u");
        const words = new Set<string>();
        for (const t of langTexts("gd")) for (const m of t.matchAll(/[\p{L}\p{M}'’-]+/gu)) { words.add(m[0]); words.add(m[0].toLowerCase()); }
        const abc = [..."abcdefghijklmnopqrstuvwxyzàèìòùéó'-"];
        for (const a of abc) { words.add(a); for (const b of abc) { words.add(a + b); for (const c of abc) words.add(a + b + c); } }
        const ctx = [..."aeiouàòbcdghlnprst"];
        for (const a of ctx) for (const b of ctx) for (const c of ctx) for (const d of ctx) words.add(a + b + c + d);
        for (const w of ["", "İ", "ſ", "\ud800", "a\udc00z", "𝐚𝐛", "é", "e\u0300", "ﬁ", "Dvořák", "Ångström", "xylo", "mac", "cat", "bochd", "luchd", "aidh", "taigh", "rr", "constructor", "toString", "-", "'"]) words.add(w);
        for (const w of words) {
            emit({ word: units(w), op: "word" }, phonemizeWord(w));
            emit({ word: units(w), op: "nat" }, nat(w));
        }
        const ns: number[] = [];
        for (let i = 0; i <= 20000; i++) ns.push(i);
        for (let k = 1; k < 1000; k++) ns.push(k * 1e3, k * 1e3 + 1, k * 1e3 + 21, k * 1e6, k * 1e6 + 2, k * 1e6 + 1001, k * 1e9, k * 1e9 + 3);
        for (let e = 4; e <= 21; e++) ns.push(10 ** e, 10 ** e - 1, 10 ** e + 7);
        ns.push(Number.MAX_SAFE_INTEGER, 1e9 - 1, 1e12, 1.5, -1, -21, -1.5, -0, NaN, Infinity, -Infinity);
        for (const n of ns) emit({ n: String(n), raw: null, op: "words" }, numberToWords(n));
        for (const raw of ["0", "007", "1234567890", "99999999999999999999", "1e3", "12a", "１２", "٣٠", "𝟙2", "", "\ud800", "2.3", "-5"]) {
            emit({ n: String(Number(raw)), raw: units(raw), op: "words" }, numberToWords(Number(raw), raw));
            emit({ n: "-1", raw: units(raw), op: "words" }, numberToWords(-1, raw));
        }
    },
    // ── Basque (eu). Inputs: the eu golden and probes/eu.txt; FLEURS has no Basque, so the synthetic rows and the
    // probes carry every arm the golden misses. ──
    // normalizeBasque (the symbol tier is inside it) and `createBasque().text`, over every text plus synthetic rows
    // for every arm: º, dot and space grouping with every separator, degrees, each unit × rate × case ending, each
    // unit × exponent × hyphen × case ending, the tier's percent/currency/units/magnitudes, minus in and out of a
    // range, every number × case ending with and without the hyphen and a comma fraction, comma decimals.
    async "eu-normalize"() {
        const { normalizeBasque } = await import("../../../src/languages/basque/normalize.ts");
        const { createBasque } = await import("../../../src/languages/basque/basque.ts");
        const { withHost } = await import("../../../src/core/foreign.ts");
        const E = createBasque();
        const rows = new Map<string, string>();
        for (const [t, src] of textsFor(["eu"], undefined, ["eu.txt"])) rows.set(t, src);
        const add = (t: string): void => { if (!rows.has(t)) rows.set(t, "synthetic"); };
        const ENDINGS = ["etik", "eko", "ean", "era", "koa", "tik", "an", "ko", "ra", "en", "a", "n", "x", ""];
        for (const g of ["1.000", "130.000", "1.000.000", "0.500", "1.2345", "9 000", "2\u00a0500", "7\u202f000", "3\u20094000", "12 345 678", "12.5", "1.000,5"]) add(`${g} euro dira`);
        for (const d of ["20 °C", "20°c", "90°F", "20\u00a0°\u00a0C", "20 ºC", "20º", "20°Ca", "20 °K"]) add(`tenperatura ${d} da`);
        for (const u of ["km", "m", "kg", "mm"]) for (const r of ["h", "s", "x"]) for (const e of ENDINGS) add(`100 ${u}/${r}-${e} abiadura`);
        for (const u of ["km", "m", "kg", "mm", "cm"]) for (const x of ["²", "³", "²-", "-", ""]) for (const e of ENDINGS) add(`5 ${u}${x}${e} dira`);
        for (const p of ["%5", "5%", "% 5", "5 %", "€5", "5€", "5 £", "$5", "5 milioi", "5 mila", "5 km", "5 km/h", "5 km²"]) add(`hori ${p} da`);
        for (const m of ["-5", "−5", "5-3", "a-5", "(-5)", "1990 - 5", "x -5"]) add(`balioa ${m} da`);
        for (const n of ["0", "1", "5", "10", "19", "20", "21", "40", "99", "100", "101", "1000", "1998", "2000000", "999999999999", "1000000000000"]) for (const e of ENDINGS) for (const h of ["", "-"]) add(`${n}${h}${e} urte`);
        for (const f of ["1,5", "1,05", "1,50", "1,0", "1,00", "2,25", "3,141", "0,5", "1,99999999999999"]) for (const e of ["", "ean", "-ean", "a", "eko"]) add(`${f}${e} da`);
        for (const [t, src] of rows) {
            emit({ text: units(t), src, op: "normalize" }, normalizeBasque(t));
            emit({ text: units(t), src, op: "text" }, withHost("eu", () => E.text(t)));
        }
    },
    // phonemizeWord and the nativiser over every letter run (as written and lowercased), every 1–3 letter string of
    // the alphabet, every 4-letter string over the context letters, corners; cardinalWords over 0…20,000 and
    // magnitudes.
    async "eu-g2p"() {
        const { phonemizeWord, cardinalWords } = await import("../../../src/languages/basque/basque.ts");
        const { makeNativiser } = await import("../../../src/core/hostWord.ts");
        const nat = makeNativiser("[a-zñçA-ZÑÇ]", "u");
        const words = new Set<string>();
        for (const t of langTexts("eu")) for (const m of t.matchAll(/[\p{L}\p{M}'’-]+/gu)) { words.add(m[0]); words.add(m[0].toLowerCase()); }
        const abc = [..."abcdefghijklmnopqrstuvwxyzñç'"];
        for (const a of abc) { words.add(a); for (const b of abc) { words.add(a + b); for (const c of abc) words.add(a + b + c); } }
        const ctx = [..."aeiourtzsxdlh"];
        for (const a of ctx) for (const b of ctx) for (const c of ctx) for (const d of ctx) words.add(a + b + c + d);
        for (const w of ["", "İ", "ſ", "\ud800", "a\udc00z", "𝐚𝐛", "n\u0303", "c\u0327", "Ñ", "ﬁ", "Dvořák", "Ångström", "etxe", "hitz", "ttipi", "kalle", "erreka", "ura"]) words.add(w);
        for (const w of words) {
            emit({ word: units(w), op: "word" }, phonemizeWord(w));
            emit({ word: units(w), op: "nat" }, nat(w));
        }
        const ns: number[] = [];
        for (let i = 0; i <= 20000; i++) ns.push(i);
        for (let k = 1; k < 1000; k++) ns.push(k * 1e3, k * 1e3 + 1, k * 1e3 + 21, k * 1e6, k * 1e6 + 2, k * 1e6 + 1001, k * 1e9, k * 1e9 + 3, k * 1e9 + 99);
        ns.push(1e12 - 1);
        for (const n of ns) emit({ n: String(n), op: "words" }, cardinalWords(n));
    },
    // ── Albanian (sq). Inputs: the sq golden and probes/sq.txt; FLEURS has no Albanian, so the synthetic rows and the
    // probes carry every arm the golden misses. ──
    // normalizeAlbanian (the symbol tier is inside it) and `createAlbanian().text`, over every text plus synthetic rows
    // for every arm: ASCII km exponents, grouping with every separator, ranges (decimal operands, chained, after a
    // letter), per mille, the tier's currency/units/rates/magnitudes, degrees with each scale and a following word or
    // scale name, every sign in and out of its guards, decimals with leading zeros.
    async "sq-normalize"() {
        const { normalizeAlbanian } = await import("../../../src/languages/albanian/normalize.ts");
        const { createAlbanian } = await import("../../../src/languages/albanian/albanian.ts");
        const { withHost } = await import("../../../src/core/foreign.ts");
        const E = createAlbanian();
        const rows = new Map<string, string>();
        for (const [t, src] of textsFor(["sq"], undefined, ["sq.txt"])) rows.set(t, src);
        const add = (t: string): void => { if (!rows.has(t)) rows.set(t, "synthetic"); };
        for (const k of ["km2", "km3", "km2a", "km4", "akm2", "km22", "KM2"]) add(`sipërfaqja 5 ${k} është`);
        for (const g of ["1.000", "130.000", "1,000,000", "0.500", "1.2345", "9 000", "2\u00a0500", "7\u202f000", "3\u20094000", "12 345 678", "1.000,5", "12.5"]) add(`janë ${g} banorë`);
        for (const r of ["5-8", "5 – 8", "1990—2000", "1.5-2.5", "5-8-9", "a5-8", "x-5", "5-", "-5", "3,5–4,5"]) add(`nga ${r} vjet`);
        for (const p of ["5‰", "5 ‰", "x‰"]) add(`norma ${p} është`);
        for (const c of ["5%", "1%", "US$5", "$1", "5 €", "£2", "5 km", "1 km", "5 m", "1 kg", "5 mb", "5 mhz", "5 km/h", "1 m/s", "5 km²", "5 milion", "1 milion", "5 mijë", "2 × 3", "A & B"]) add(`vlera ${c} sot`);
        for (const d of ["20°", "20 °C", "20°c", "90 °F", "20° C Celsius", "20°Celsius", "20°veri", "1,5°", "20 ° C", "20°Ca"]) add(`temperatura ${d} sot`);
        for (const s of ["+5", "+ 5", "a+5", "-5", "−5", "–5", "a-5", "x = y", "5=5", "a==b", "3 < 4", "a<=b", "5 > 2", "8 ÷ 2", "8÷x"]) add(`vlera ${s} sot`);
        for (const d of ["1.5", "1,05", "0.005", "1.000005", "3,0", "3.00", "1.5.6"]) add(`numri ${d} është`);
        for (const n of ["0", "1", "2", "5", "21", "1000", "1.5", "1,5", "1 000"]) for (const u of ["%", "‰", "€", "$", "US$", "£", "km", "m", "cm", "mm", "kg", "mb", "mhz", "km²", "m³", "km/h", "m/s", "milion", "mijë", "miliard", "°", "°C", "°F"]) { add(`janë ${n}${u} sot`); add(`janë ${n} ${u}`); add(`${u}${n} sot`); }
        for (const [t, src] of rows) {
            emit({ text: units(t), src, op: "normalize" }, normalizeAlbanian(t));
            emit({ text: units(t), src, op: "text" }, withHost("sq", () => E.text(t)));
        }
    },
    // phonemizeWord and the nativiser over every letter run (as written and lowercased), every 1–3 letter string of
    // the alphabet, every 4-letter string over the context letters, corners; numberToWords over 0…20,000, magnitudes
    // and raw strings.
    async "sq-g2p"() {
        const { phonemizeWord, numberToWords } = await import("../../../src/languages/albanian/albanian.ts");
        const { makeNativiser } = await import("../../../src/core/hostWord.ts");
        const nat = makeNativiser("[a-zçëA-ZÇË]", "iu");
        const words = new Set<string>();
        for (const t of langTexts("sq")) for (const m of t.matchAll(/[\p{L}\p{M}'’-]+/gu)) { words.add(m[0]); words.add(m[0].toLowerCase()); }
        const abc = [..."abcdefghijklmnopqrstuvwxyzçë'"];
        for (const a of abc) { words.add(a); for (const b of abc) { words.add(a + b); for (const c of abc) words.add(a + b + c); } }
        const ctx = [..."aeiëoushdtlmnrjz"];
        for (const a of ctx) for (const b of ctx) for (const c of ctx) for (const d of ctx) words.add(a + b + c + d);
        for (const w of ["", "İ", "ſ", "\ud800", "a\udc00z", "𝐚𝐛", "e\u0308", "c\u0327", "Ë", "ﬁ", "Dvořák", "Ångström", "mprehtë", "shtëpi", "ndrrojnë", "gjuhë", "xhaxha", "atlas", "qytet"]) words.add(w);
        for (const w of words) {
            emit({ word: units(w), op: "word" }, phonemizeWord(w));
            emit({ word: units(w), op: "nat" }, nat(w));
        }
        const ns: number[] = [];
        for (let i = 0; i <= 20000; i++) ns.push(i);
        for (let k = 1; k < 1000; k++) ns.push(k * 1e3, k * 1e3 + 1, k * 1e3 + 21, k * 1e6, k * 1e6 + 2, k * 1e6 + 1001, k * 1e9, k * 1e9 + 3);
        for (let e = 4; e <= 21; e++) ns.push(10 ** e, 10 ** e - 1, 10 ** e + 7);
        ns.push(Number.MAX_SAFE_INTEGER, 1e9 - 1, 1e12, 1.5, -1, -21, -1.5, -0, NaN, Infinity, -Infinity);
        for (const n of ns) emit({ n: String(n), raw: null, op: "words" }, numberToWords(n));
        for (const raw of ["0", "007", "1234567890", "99999999999999999999", "1e3", "12a", "１２", "٣٠", "𝟙2", "", "\ud800", "2.3", "-5"]) {
            emit({ n: String(Number(raw)), raw: units(raw), op: "words" }, numberToWords(Number(raw), raw));
            emit({ n: "-1", raw: units(raw), op: "words" }, numberToWords(-1, raw));
        }
    },
    // ── Asturian (ast). Inputs: the ast golden, FLEURS ast_es (columns 3 and 4) and probes/ast.txt. ──
    // normalizeAsturian, the symbol tier over its output (recorded through the wrapper) and `createAsturian().text`,
    // over every text plus synthetic rows for every arm: grouping with every separator and the decimal neighbour,
    // the dot decimal, era markers mid-text and text-final (with a closing quote), Roman and numeric month dates
    // over every month and out-of-range neighbours, the clock over an hour × minute grid, degrees with a scale /
    // minutes / each licensed tail, minus forms, dash and hyphen ranges with their declining neighbours.
    async "ast-normalize"() {
        const { register } = await import("node:module");
        register(new URL("./symbols-hook.mjs", import.meta.url));
        const { records } = await import("./symbols-wrap.ts");
        const { normalizeAsturian } = await import("../../../src/languages/asturian/normalize.ts");
        const { createAsturian } = await import("../../../src/languages/asturian/asturian.ts");
        const { withHost } = await import("../../../src/core/foreign.ts");
        const rec = records.find((r) => /src\/languages\/asturian\//u.test(r.stack.split("\n").slice(2).join("\n")))!;
        const E = createAsturian();
        const rows = new Map<string, string>();
        for (const [t, src] of textsFor(["ast"], FLEURS_DIR.ast, ["ast.txt"])) rows.set(t, src);
        const add = (t: string): void => { if (!rows.has(t)) rows.set(t, "synthetic"); };
        for (const g of ["1.000", "130.000", "1.000.000", "0.500", "1.2345", "9 000", "2\u00a0500", "7\u202f000", "3\u20094000", "12 345 678", "1,5 000", "12.5", "3.14", "1.000,5", "1.5.6"]) add(`hai ${g} persones`);
        for (const e of ["e.C.", "e. C.", "e.C", "d.C.", "d. C .", "ae.C."]) for (const tail of ["", ".", "\"", " »", " y depués", ")"]) add(`nel añu 300 ${e}${tail}`);
        for (const r of ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "IIII", "VV"]) add(`el 12-${r}-1990 foi`);
        for (let mo = 0; mo <= 13; mo++) add(`el 5-${mo}-2001 y el 05 - ${mo} - 199 foi`);
        for (const h of ["0", "1", "09", "12", "23", "24", "25"]) for (const m of ["00", "05", "30", "59", "60"]) add(`a les ${h}:${m} hores`);
        for (const d of ["20 °C", "20°c", "90ºF", "20° 30′", "20°30'", "20° de llatitú", "20° y", "20° col", "20° na", "20°.", "20°)", "20°", "20° N", "20°S", "20°x", "20° dena"]) add(`tenía ${d} agora`);
        for (const m of ["-5", "−5", "–5", "(-3)", "a -5", "5-3", "x-5", " - 5"]) add(`valor ${m} grados`);
        for (const r of ["1990–2000", "5—8", "1990-2000", "5 - 8", "5-8-9", "1/5-8", "5-8/9", "a5-8", "1.5-2"]) add(`ente ${r} años`);
        for (const [t, src] of rows) {
            const a = normalizeAsturian(t);
            emit({ text: units(t), src, op: "normalize" }, a);
            emit({ text: units(a), src, op: "symbols" }, rec.apply(a));
            emit({ text: units(t), src, op: "text" }, withHost("ast", () => E.text(t)));
        }
    },
    // phonemizeWord and the nativiser over every letter run (as written and lowercased), every 1–3 letter string of
    // the alphabet, every 4-letter string over the context letters, corners; numberToWords over 0…20,000,
    // magnitudes and raw strings.
    async "ast-g2p"() {
        const { phonemizeWord } = await import("../../../src/languages/asturian/asturian.ts");
        const { numberToWords } = await import("../../../src/languages/asturian/numbers.ts");
        const { makeNativiser } = await import("../../../src/core/hostWord.ts");
        const nat = makeNativiser("[a-zñáéíóúüïḥḷA-ZÑÁÉÍÓÚÜÏḤḶ'·]", "u");
        const words = new Set<string>();
        for (const t of langTexts("ast")) for (const m of t.matchAll(/[\p{L}\p{M}'’·-]+/gu)) { words.add(m[0]); words.add(m[0].toLowerCase()); }
        const abc = [..."abcdefghijklmnopqrstuvwxyzñáéíóúüïḥḷ'·"];
        for (const a of abc) { words.add(a); for (const b of abc) { words.add(a + b); for (const c of abc) words.add(a + b + c); } }
        const ctx = [..."aeiouüqgcynrlbpm"];
        for (const a of ctx) for (const b of ctx) for (const c of ctx) for (const d of ctx) words.add(a + b + c + d);
        for (const w of ["", "İ", "ſ", "\ud800", "a\udc00z", "𝐚𝐛", "l\u0323l\u0323", "ḷḷ", "Ḷḷ", "n\u0303", "ﬁ", "Dvořák", "Ångström", "xylo", "güeyu", "quixu", "ḥuerta"]) words.add(w);
        for (const w of words) {
            emit({ word: units(w), op: "word" }, phonemizeWord(w));
            emit({ word: units(w), op: "nat" }, nat(w));
        }
        const ns: number[] = [];
        for (let i = 0; i <= 20000; i++) ns.push(i);
        for (let k = 1; k < 1000; k++) ns.push(k * 1e3, k * 1e3 + 1, k * 1e3 + 21, k * 1e6, k * 1e6 + 2, k * 1e6 + 1001, k * 1e9, k * 1e9 + 3);
        for (let e = 4; e <= 21; e++) ns.push(10 ** e, 10 ** e - 1, 10 ** e + 7);
        ns.push(Number.MAX_SAFE_INTEGER, 1e12 - 1, 1e12, 1.5, -1, -21, -1.5, -0, NaN, Infinity, -Infinity);
        for (const n of ns) emit({ n: String(n), raw: null, op: "words" }, numberToWords(n));
        for (const raw of ["0", "007", "1234567890", "99999999999999999999", "1e3", "12a", "１２", "٣٠", "𝟙2", "", "\ud800", "-5"]) {
            emit({ n: String(Number(raw)), raw: units(raw), op: "words" }, numberToWords(Number(raw), raw));
            emit({ n: "1000000000000", raw: units(raw), op: "words" }, numberToWords(1e12, raw));
        }
    },
    // ── Aragonese (an). Inputs: the an golden and probes/an.txt; FLEURS has no Aragonese, so the synthetic rows and
    // the probes carry every arm the golden misses. ──
    // normalizeAragonese, the symbol tier over its output (recorded through the wrapper) and `createAragonese().text`,
    // over every text plus synthetic rows for every arm: grouping with every separator, the dot decimal, era markers
    // mid-text and text-final, numero/lumero, hab./ and m.a., the clock over an hour × minute grid, minus forms (and
    // the clock exclusion), degrees with a scale / minutes / each compass point / each licensed tail, ranges.
    async "an-normalize"() {
        const { register } = await import("node:module");
        register(new URL("./symbols-hook.mjs", import.meta.url));
        const { records } = await import("./symbols-wrap.ts");
        const { normalizeAragonese } = await import("../../../src/languages/aragonese/normalize.ts");
        const { createAragonese } = await import("../../../src/languages/aragonese/aragonese.ts");
        const { withHost } = await import("../../../src/core/foreign.ts");
        const rec = records.find((r) => /src\/languages\/aragonese\//u.test(r.stack.split("\n").slice(2).join("\n")))!;
        const E = createAragonese();
        const rows = new Map<string, string>();
        for (const [t, src] of textsFor(["an"], undefined, ["an.txt"])) rows.set(t, src);
        const add = (t: string): void => { if (!rows.has(t)) rows.set(t, "synthetic"); };
        for (const g of ["1.000", "130.000", "1.000.000", "0.500", "1.2345", "9 000", "2\u00a0500", "7\u202f000", "3\u20094000", "12 345 678", "12.5", "3.14", "1.000,5", "1.5.6"]) add(`bi ha ${g} personas`);
        for (const e of ["a.C.", "a. C.", "a.C", "d.C.", "d. C .", "ba.C."]) for (const tail of ["", ".", "\"", " »", " y dimpués", ")"]) add(`en l'anyo 300 ${e}${tail}`);
        for (const a of ["n.º 5", "nº5", "n° 3", "n.5", "lum. 7", "lum.x", "5 hab./km²", "5hab./km2", "5 hab. en", "3 m.a.", "3m. a.", "3 m.a"]) add(`ye ${a} aquí`);
        for (const h of ["0", "1", "09", "12", "23", "24", "25"]) for (const m of ["00", "05", "30", "59", "60"]) add(`a las ${h}:${m} horas`);
        for (const m of ["-5", "−5", "–5", "(-3)", "a -5", "5-3", "-5:30", "-12:00", " - 5"]) add(`valor ${m} graus`);
        for (const d of ["20 °C", "20°c", "90ºF", "20° 30′", "20°30'", "20° N", "20°S", "20° E", "20°U", "20°Na", "20° de latitut", "20° y", "20° en", "20°.", "20°(", "20°", "20°x", "20° dena", "20° W"]) add(`teneba ${d} agora`);
        for (const r of ["1990–2000", "5—8", "1990-2000", "5 - 8", "5-8-9", "1/5-8", "5-8/9", "a5-8", "1.5-2"]) add(`entre ${r} anyos`);
        for (const [t, src] of rows) {
            const a = normalizeAragonese(t);
            emit({ text: units(t), src, op: "normalize" }, a);
            emit({ text: units(a), src, op: "symbols" }, rec.apply(a));
            emit({ text: units(t), src, op: "text" }, withHost("an", () => E.text(t)));
        }
    },
    // phonemizeWord and the nativiser over every letter run (as written and lowercased), every 1–3 letter string of
    // the alphabet, every 4-letter string over the context letters, corners; numberToWords over 0…20,000,
    // magnitudes and raw strings.
    async "an-g2p"() {
        const { phonemizeWord } = await import("../../../src/languages/aragonese/aragonese.ts");
        const { numberToWords } = await import("../../../src/languages/aragonese/numbers.ts");
        const { makeNativiser } = await import("../../../src/core/hostWord.ts");
        const nat = makeNativiser("[a-zñáéíóúüïA-ZÑÁÉÍÓÚÜÏ'·]", "u");
        const words = new Set<string>();
        for (const t of langTexts("an")) for (const m of t.matchAll(/[\p{L}\p{M}'’·-]+/gu)) { words.add(m[0]); words.add(m[0].toLowerCase()); }
        const abc = [..."abcdefghijklmnopqrstuvwxyzñáéíóúüï'·"];
        for (const a of abc) { words.add(a); for (const b of abc) { words.add(a + b); for (const c of abc) words.add(a + b + c); } }
        const ctx = [..."aeiouüqgcynrlbpmt"];
        for (const a of ctx) for (const b of ctx) for (const c of ctx) for (const d of ctx) words.add(a + b + c + d);
        for (const w of ["", "İ", "ſ", "\ud800", "a\udc00z", "𝐚𝐛", "n\u0303", "ﬁ", "Dvořák", "Ångström", "xylo", "chesús", "fer", "mullers", "agüelo", "quiet", "gent"]) words.add(w);
        for (const w of words) {
            emit({ word: units(w), op: "word" }, phonemizeWord(w));
            emit({ word: units(w), op: "nat" }, nat(w));
        }
        const ns: number[] = [];
        for (let i = 0; i <= 20000; i++) ns.push(i);
        for (let k = 1; k < 1000; k++) ns.push(k * 1e3, k * 1e3 + 1, k * 1e3 + 21, k * 1e6, k * 1e6 + 2, k * 1e6 + 1001, k * 1e9, k * 1e9 + 3);
        for (let e = 4; e <= 21; e++) ns.push(10 ** e, 10 ** e - 1, 10 ** e + 7);
        ns.push(Number.MAX_SAFE_INTEGER, 1e12 - 1, 1e12, 1.5, -1, -21, -1.5, -0, NaN, Infinity, -Infinity);
        for (const n of ns) emit({ n: String(n), raw: null, op: "words" }, numberToWords(n));
        for (const raw of ["0", "007", "1234567890", "99999999999999999999", "1e3", "12a", "１２", "٣٠", "𝟙2", "", "\ud800", "-5"]) {
            emit({ n: String(Number(raw)), raw: units(raw), op: "words" }, numberToWords(Number(raw), raw));
            emit({ n: "1000000000000", raw: units(raw), op: "words" }, numberToWords(1e12, raw));
        }
    },
    // ── Occitan (oc). Inputs: the oc golden, FLEURS oc_fr (columns 3 and 4) and probes/oc.txt. ──
    // normalizeOccitan, the symbol tier over its output (recorded through the wrapper) and `createOccitan().text`,
    // over every text plus synthetic rows for every arm: grouping with every separator, the dot decimal, both era
    // markers in their dotted/undotted spellings and neighbours, the clock over an hour × minute grid, minus forms,
    // degrees with a scale / minutes / bare and inside the `in-4°` book format, dash and hyphen ranges.
    async "oc-normalize"() {
        const { register } = await import("node:module");
        register(new URL("./symbols-hook.mjs", import.meta.url));
        const { records } = await import("./symbols-wrap.ts");
        const { normalizeOccitan } = await import("../../../src/languages/occitan/normalize.ts");
        const { createOccitan } = await import("../../../src/languages/occitan/occitan.ts");
        const { withHost } = await import("../../../src/core/foreign.ts");
        const rec = records.find((r) => /src\/languages\/occitan\//u.test(r.stack.split("\n").slice(2).join("\n")))!;
        const E = createOccitan();
        const rows = new Map<string, string>();
        for (const [t, src] of textsFor(["oc"], FLEURS_DIR.oc, ["oc.txt"])) rows.set(t, src);
        const add = (t: string): void => { if (!rows.has(t)) rows.set(t, "synthetic"); };
        for (const g of ["1 000", "2\u00a0500", "7\u202f000", "3\u20094000", "12 345 678", "1.000", "12.5", "3.14", "1,5 000", "1.5.6"]) add(`i a ${g} personas`);
        for (const e of ["ab. C.", "av. C.", "abC", "av.C", "ap. C.", "apC.", "ap. Ca", "xap. C.", "ab. c."]) add(`en 300 ${e} e après`);
        for (const h of ["0", "1", "09", "12", "23", "24", "25"]) for (const m of ["00", "05", "30", "59", "60"]) add(`a ${h}:${m} oras`);
        for (const m of ["-5", "−5", "–5", "(-3)", "a -5", "5-3", " - 5"]) add(`valor ${m} graus`);
        for (const d of ["20 °C", "20°c", "90°F", "20° 30′", "20°30'", "20°", "20° N", "in-4°", "in-12° C", "in-8°30'", "fin-4°", "20°Ca"]) add(`aviá ${d} ara`);
        for (const r of ["1990–2000", "5—8", "1990-2000", "5 - 8", "5-8-9", "1/5-8", "5-8/9", "a5-8", "1.5-2"]) add(`entre ${r} ans`);
        for (const [t, src] of rows) {
            const a = normalizeOccitan(t);
            emit({ text: units(t), src, op: "normalize" }, a);
            emit({ text: units(a), src, op: "symbols" }, rec.apply(a));
            emit({ text: units(t), src, op: "text" }, withHost("oc", () => E.text(t)));
        }
    },
    // phonemizeWord and the nativiser over every letter run (as written and lowercased), every 1–3 letter string of
    // the alphabet, every 4-letter string over the context letters, corners; numberToWords over 0…20,000,
    // magnitudes and raw strings.
    async "oc-g2p"() {
        const { phonemizeWord } = await import("../../../src/languages/occitan/occitan.ts");
        const { numberToWords } = await import("../../../src/languages/occitan/numbers.ts");
        const { makeNativiser } = await import("../../../src/core/hostWord.ts");
        const nat = makeNativiser("[a-zàèòáéíóúïüçA-ZÀÈÒÁÉÍÓÚÏÜÇ'·-]", "u");
        const words = new Set<string>();
        for (const t of langTexts("oc")) for (const m of t.matchAll(/[\p{L}\p{M}'’·-]+/gu)) { words.add(m[0]); words.add(m[0].toLowerCase()); }
        const abc = [..."abcdefghijklmnopqrstuvwxyzàèòáéíóúïüç'·-"];
        for (const a of abc) { words.add(a); for (const b of abc) { words.add(a + b); for (const c of abc) words.add(a + b + c); } }
        const ctx = [..."aeiouòqgcsnrdbtz"];
        for (const a of ctx) for (const b of ctx) for (const c of ctx) for (const d of ctx) words.add(a + b + c + d);
        for (const w of ["", "İ", "ſ", "\ud800", "a\udc00z", "𝐚𝐛", "a\u0300", "c\u0327", "ﬁ", "Dvořák", "Ångström", "xylo", "lenga", "occitana", "casa", "rosa", "pan", "amor", "grand", "nuèit"]) words.add(w);
        for (const w of words) {
            emit({ word: units(w), op: "word" }, phonemizeWord(w));
            emit({ word: units(w), op: "nat" }, nat(w));
        }
        const ns: number[] = [];
        for (let i = 0; i <= 20000; i++) ns.push(i);
        for (let k = 1; k < 1000; k++) ns.push(k * 1e3, k * 1e3 + 1, k * 1e3 + 21, k * 1e6, k * 1e6 + 2, k * 1e6 + 1001, k * 1e9, k * 1e9 + 3);
        for (let e = 4; e <= 21; e++) ns.push(10 ** e, 10 ** e - 1, 10 ** e + 7);
        ns.push(Number.MAX_SAFE_INTEGER, 1e12 - 1, 1e12, 1.5, -1, -21, -1.5, -0, NaN, Infinity, -Infinity);
        for (const n of ns) emit({ n: String(n), raw: null, op: "words" }, numberToWords(n));
        for (const raw of ["0", "007", "1234567890", "99999999999999999999", "1e3", "12a", "１２", "٣٠", "𝟙2", "", "\ud800", "-5"]) {
            emit({ n: String(Number(raw)), raw: units(raw), op: "words" }, numberToWords(Number(raw), raw));
            emit({ n: "1000000000000", raw: units(raw), op: "words" }, numberToWords(1e12, raw));
        }
    },
    // ── The Bengali maker (bn, and as / bpy, which build it from their own manifests). LANGS (default bn,as,bpy).
    // Inputs: each language's golden, FLEURS (bn_in, as_in) and probes (bn.txt for all three, plus the language's
    // own). Ops: the Bengali normalizer with that language's numbers; the engine's text() (no foreign reader); the
    // raw abugida g2p, wordRules, word and number() over every Bengali-script run, every consonant of the manifest x
    // matra/virama/sign tails, the conjuncts the orthographic rules key on, and digit strings. For as the engine is
    // createAssamese's (its pre-pass and geminate collapse included) and an "as-normalize" op runs the pre-pass alone.
    async "bengali-family"() {
        const { makeBengaliNormalizer } = await import("../../../src/languages/bengali/normalize.ts");
        const { makeAbugidaG2P } = await import("../../../src/core/abugida.ts");
        const { loadSharedPhonology } = await import("../../../src/core/phonology.ts");
        const { withHost } = await import("../../../src/core/foreign.ts");
        const { parseJsonc } = await import("../../../src/core/jsonc.ts");
        const FAMILY: Record<string, string> = { bn: "bengali", as: "assamese", bpy: "bishnupriya" };
        const langs = process.env.LANGS ? LANGS : Object.keys(FAMILY);
        for (const lang of langs) {
            const dir = FAMILY[lang]!;
            const def = parseJsonc(readFileSync(new URL(`../../../data/languages/${dir}/${dir}.jsonc`, import.meta.url), "utf8")) as any;
            const g2p = makeAbugidaG2P(parseJsonc(readFileSync(new URL(`../../../data/languages/${dir}/${dir}.jsonc`, import.meta.url), "utf8")) as any, loadSharedPhonology());
            let E: any;
            if (lang === "bn") E = (await import("../../../src/languages/bengali/bengali.ts")).createBengali();
            else if (lang === "as") E = (await import("../../../src/languages/assamese/assamese.ts")).createAssamese();
            else E = (await import("../../../src/languages/bishnupriya/bishnupriya.ts")).createBishnupriya();
            const W: any = E; // makeNativeBengali's word level (for as, createAssamese's wrapper of it)
            const norm = makeBengaliNormalizer(def.numbers);
            const rows = new Map<string, string>();
            for (const [t, src] of textsFor([lang], Object.hasOwn(FLEURS_DIR, lang) ? FLEURS_DIR[lang] : undefined, ["bn.txt", ...(lang === "bn" ? [] : [`${lang}.txt`])])) rows.set(t, src);
            const add = (t: string): void => { if (!rows.has(t)) rows.set(t, "synthetic"); };
            const bnd = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
            for (let n = 0; n <= 40; n++) for (const suf of ["তম", "শে", "ই", "ম", "য়", "র্থ", "ষ্ঠ", "লা", "রা", "ঠা", "শ", "নং"]) { add(`সে ${n}${suf} দিন`); add(`সে ${[...String(n)].map((d) => bnd[Number(d)]).join("")} ${suf} দিন`); }
            for (const h of [0, 1, 9, 10, 12, 23, 24]) for (const m of ["00", "05", "30", "59", "60"]) for (const tail of ["", "টা", " টা", " বাজে"]) add(`এখন ${h}:${m}${tail}`);
            for (let a = 0; a <= 12; a++) for (const b of [1, 2, 3, 4, 10, 100, 1000]) add(`${a}/${b} অংশ`);
            for (const sg of ["$", "€", "£", "¥", "₹", "৳", "US$", "AUD$"]) for (const f of [`${sg}50`, `${sg} 50`, `${sg}১৪.৭ বিলিয়ন`, `${sg}৪৫ মিলিয়ন`, `${sg}2.3 বিলিয়ন ডলাৰৰ`, `50${sg}`]) add(`দাম ${f} হল`);
            for (const r of ["±", "=", "<", ">", "×", "÷", "&", "+", "-", "−"]) { add(`ক ${r} খ এবং 3${r}4`); add(`B${r}B য়ে`); }
            for (const [t, src] of rows) {
                emit({ text: units(t), src, lang, op: "normalize" }, norm(t));
                if (lang === "as") {
                    const { normalizeAssamese } = await import("../../../src/languages/assamese/normalize.ts");
                    emit({ text: units(t), src, lang, op: "as-normalize" }, normalizeAssamese(t));
                }
                emit({ text: units(t), src, lang, op: "text" }, withHost(lang, () => E.text(t)));
            }
            const words = new Set<string>();
            for (const t of rows.keys()) for (const m of t.normalize("NFC").matchAll(/[ঀ-ৣৰ-৾]+/gu)) words.add(m[0]);
            for (const t of rows.keys()) for (const m of t.matchAll(/[ঀ-ৣৰ-৾]+/gu)) words.add(m[0]);
            const s = def.signs;
            const sign = (k: string): string[] => (s[k]?.char ? [s[k].char] : []);
            const tails = ["", ...sign("virama"), ...sign("anusvara"), ...sign("chandrabindu"), ...sign("visarga"), ...sign("nukta"),
                ...Object.keys(def.vowelSigns), ...Object.keys(def.vowelSigns).flatMap((v) => sign("anusvara").map((a) => v + a)),
                ...Object.keys(def.vowelSigns).flatMap((v) => sign("chandrabindu").map((a) => v + a)), "‍", "‌", "ৎ", "্যা", "্য", "্ব", "্ম", "্র", "ওয়া", "য়া"];
            const cons = Object.keys(def.consonants);
            for (const c of cons) for (const t of tails) { words.add(c + t); words.add(c + t + "ক"); words.add("অ" + c + t + "তা"); words.add("আ" + c + t + "ি"); words.add(c + t + "র"); }
            for (const c of cons) for (const d of ["ক", "খ", "গ", "চ", "জ", "ট", "ড", "ত", "দ", "ধ", "ন", "প", "ব", "ম", "য", "র", "ল", "শ", "ষ", "স", "হ"]) { words.add(c + "্" + d + "া"); words.add("আ" + c + "্" + d + "ি"); words.add(c + "্" + d); words.add("অ" + c + "্" + d); }
            for (const v of Object.keys(def.independentVowels)) for (const t of ["", ...sign("anusvara"), ...sign("chandrabindu"), ...sign("visarga"), "্যা"]) { words.add(v + t); words.add(v + t + "ব"); words.add(v + t + "ডা"); words.add(v + "ই"); words.add(v + "উ"); }
            for (const w of ["", "\u09dc", "\u09a1\u09bc", "\u09dd", "\u09df", "\u09af\u09bc", "\u09dc\u09bf", "আষা\u09dd", "ব\u09a1\u09bcো", "\ud800", "a", "অ্যাক্ষ", "ক্ষ্যা", "ঙ্ক্ষ"]) words.add(w);
            for (const w of words) {
                emit({ op: "g2p", lang, word: units(w) }, g2p(w));
                emit({ op: "rules", lang, word: units(w) }, W.wordRules(w));
                emit({ op: "word", lang, word: units(w) }, W.word(w));
            }
            const nums = new Set<string>();
            for (let n = 0; n <= 3000; n++) nums.add(String(n));
            for (let e = 4; e <= 22; e++) { nums.add("1" + "0".repeat(e)); nums.add("9".repeat(e)); nums.add("12345678901234567890123".slice(0, e)); }
            for (const x of ["0.5", "3.14", "12.05", ".5", "0.0", "১২৩", "১,২৩৪", "১.৫", "1,00,000", "9,000", "0,001", "10,0", "9007199254740993", "9007199254740993.25", "123456789012345678901.5", "০.০৭"]) nums.add(x);
            for (const x of nums) emit({ op: "number", lang, word: units(x) }, W.number(x));
        }
    },
    // The BiLSTM tagger over every Bengali run of the bn texts (as the pre-pass offers it: raw), every 10th lexicon
    // key, the bengali-family synthetic words, and corners.
    async "bn-tagger"() {
        const { createBengaliTagger } = await import("../../../src/languages/bengali/bengaliTagger.ts");
        const { bengaliLexicon } = await import("../../../src/languages/bengali/bengali.ts");
        const tagger = await createBengaliTagger();
        if (!tagger) throw new Error("bn tagger unavailable");
        const words = new Set<string>();
        for (const t of langTexts("bn")) for (const m of t.matchAll(/[ঀ-ৣৰ-৾]+/gu)) words.add(m[0]);
        let i = 0;
        for (const w of bengaliLexicon().keys()) if (i++ % 10 === 0) words.add(w);
        for (const c of ["ক", "খ", "গ", "চ", "জ", "ট", "ত", "দ", "ন", "প", "ব", "ম", "র", "ল", "শ", "স", "হ", "য়", "ড়"]) for (const t of ["", "া", "ি", "ু", "ে", "ো", "্", "ং", "ঁ"]) { words.add(c + t); words.add("অ" + c + t + "ল"); words.add(c + t + "কর"); }
        for (const w of ["", "мир", "aক", "ক☃খ", "\u09dc", "\u09df", "\u09af\u09bc", "বাংলাদেশ", "ক্ষমতা", "জ্ঞানী", "অ্যাসিড", "\u200dক", "ক\u200c্"]) words.add(w);
        for (const w of words) emit({ word: units(w), op: "tag" }, await tagger.tag(w));
    },
    // ── Sylheti (syl). Inputs: the syl golden and probes/syl.txt (FLEURS has no syl), plus synthetic grids. ──
    // normalizeSylheti and `createSylheti().text` over every text plus synthetic rows (ranges over a value grid,
    // grouping shapes, degrees, decimals, percent, taka, stray Bengali characters in and out of a Syloti run);
    // phonemizeWord over every Syloti run, every consonant x vowel-sign/hasanta tail in three frames, conjuncts, and
    // corners; number() through text() over 0…3000 and long runs.
    async "syl"() {
        const { normalizeSylheti } = await import("../../../src/languages/sylheti/normalize.ts");
        const { createSylheti, phonemizeWord } = await import("../../../src/languages/sylheti/sylheti.ts");
        const { withHost } = await import("../../../src/core/foreign.ts");
        const { parseJsonc } = await import("../../../src/core/jsonc.ts");
        const def = parseJsonc(readFileSync(new URL("../../../data/languages/sylheti/sylheti.jsonc", import.meta.url), "utf8")) as any;
        const E = createSylheti();
        const rows = new Map<string, string>();
        for (const [t, src] of textsFor(["syl"], undefined, ["syl.txt"])) rows.set(t, src);
        const add = (t: string): void => { if (!rows.has(t)) rows.set(t, "synthetic"); };
        const bnd = (n: number | string): string => [...String(n)].map((d) => (d >= "0" && d <= "9" ? "০১২৩৪৫৬৭৮৯"[Number(d)] : d)).join("");
        for (const [a, b] of [[1, 2], [2, 1], [5, 5], [10, 14], [14, 10], [1.5, 2.5], [1990, 1995], [0, 0]] as const)
            for (const dash of ["-", "–", "—", " - "]) { add(`ꠔꠣꠞꠤꠈ ${a}${dash}${b} ꠛꠍꠞ`); add(`ꠔꠣꠞꠤꠈ ${bnd(a)}${dash}${bnd(b)} ꠛꠍꠞ`); }
        for (const g of ["1,000", "10,00,000", "1,23,456", "0,5", "00,500", "1,2", "1,2345", "12,345,678"]) { add(`ꠝꠣꠘꠥꠡ ${g} ꠎꠘ`); add(`ꠝꠣꠘꠥꠡ ${bnd(g)} ꠎꠘ`); }
        for (const d of ["5°", "5 °", "5°ꠍꠦ", "5° ꠍꠦ.", "5°ꠚꠣ.", "5°C", "5°c", "5 ° F", "5°Cx", "5°ꠍꠦꠟ", "°ꠍꠦ"]) { add(`ꠔꠣꠙ ${d} ꠀꠍꠦ`); add(`ꠔꠣꠙ ${bnd(d)} ꠀꠍꠦ`); }
        for (const p of ["5%", "5 %", "%", "৳5", "৳ 5", "৳5 ꠐꠦꠈꠣ", "৳5 ꠀꠞ ꠐꠦꠈꠣ", "৳", "5.5", "5.5.5", "5.5/2", "5..5"]) { add(`ꠄꠇ ${p} ꠀꠍꠦ`); add(`ꠄꠇ ${bnd(p)} ꠀꠍꠦ`); }
        const SYL_C = Object.keys(def.consonants), SYL_V = Object.keys(def.vowelSigns), SYL_IV = Object.keys(def.independentVowels);
        const BN = ["়", "ঁ", "ং", "্", "ৎ", "ৃ", "া", "ি", "ে", "ো", "অ", "আ", "ক", "ণ", "ষ", "ড়", "ড়", "য়", "য়", "ৰ", "০"];
        for (const b of BN) { add(`ꠇ${b}ꠣ ꠀꠍꠦ`); add(`${b}ꠇ`); add(`ꠇꠣ ${b}`); add(`ꠎ${b}ꠣ`); }
        for (const [t, src] of rows) {
            emit({ text: units(t), src, op: "normalize" }, normalizeSylheti(t));
            emit({ text: units(t), src, op: "text" }, withHost("syl", () => E.text(t)));
        }
        const words = new Set<string>();
        for (const t of rows.keys()) for (const m of t.matchAll(/[ꠀ-ꠧ꠬]+/gu)) words.add(m[0]);
        const vir = def.signs.virama.char as string;
        for (const c of SYL_C) for (const t of ["", vir, ...SYL_V, "ꠋ", "ꠂ", "ꠀ", "꠬"]) { words.add(c + t); words.add(c + t + "ꠇ"); words.add("ꠅ" + c + t + "ꠔꠣ"); words.add("ꠀ" + c + t + "ꠤ"); }
        for (const c of SYL_C) for (const d of ["ꠇ", "ꠔ", "ꠘ", "ꠝ", "ꠞ", "ꠟ", "ꠛ", "ꠡ"]) { words.add(c + vir + d + "ꠣ"); words.add("ꠀ" + c + vir + d); words.add(c + vir + c + "ꠅ"); }
        for (const v of SYL_IV) for (const t of ["", "ꠋ", "ꠇ", "ꠤ", "ꠥ"]) { words.add(v + t); words.add(v + t + "ꠘ"); }
        for (const w of ["", "ꠀ", "꠆", "ꠇ꠆", "\ud800", "ꠇ়", "ꠇꠇꠇꠇ", "ꠍꠤꠟꠐꠤ"]) words.add(w);
        for (const w of words) emit({ word: units(w), op: "word" }, phonemizeWord(w));
        const ns: string[] = [];
        for (let i = 0; i <= 3000; i++) ns.push(String(i));
        for (let e = 4; e <= 22; e++) ns.push("1" + "0".repeat(e), "9".repeat(e), "12345678901234567890123".slice(0, e));
        ns.push("9007199254740991", "9007199254740993", "007");
        for (const n of ns) emit({ text: units(n), src: "number", op: "text" }, withHost("syl", () => E.text(n)));
    },
    // ── Odia (or). Inputs: the or golden, FLEURS or_in (columns 3 and 4) and probes/or.txt, plus synthetic grids. ──
    // makeOdiaNormalizer (its symbol tier included) and `createOdia().text` over every text plus synthetic rows
    // (ordinals 0…40 × each suffix, spaced and glued, the clock grid, both groupings, decimals, each unit
    // abbreviation, the rate slash, each currency and unit of the tier, the signs in their guarded contexts, the
    // Latin I); phonemizeWord over every Odia run, every consonant × matra/virama/sign tail in four frames, conjuncts
    // and corners; numbers through text() over 0…3000, magnitudes and long runs in both digit scripts.
    async "or"() {
        const { makeOdiaNormalizer } = await import("../../../src/languages/odia/normalize.ts");
        const { MANIFEST } = await import("../../../src/languages/odia/manifest.ts");
        const { createOdia, phonemizeWord } = await import("../../../src/languages/odia/odia.ts");
        const { withHost } = await import("../../../src/core/foreign.ts");
        const norm = makeOdiaNormalizer(MANIFEST.numbers);
        const E = createOdia();
        const rows = new Map<string, string>();
        for (const [t, src] of textsFor(["or"], FLEURS_DIR.or, ["or.txt"])) rows.set(t, src);
        const add = (t: string): void => { if (!rows.has(t)) rows.set(t, "synthetic"); };
        const ord = (n: number | string): string => [...String(n)].map((d) => (d >= "0" && d <= "9" ? "୦୧୨୩୪୫୬୭୮୯"[Number(d)] : d)).join("");
        for (let n = 0; n <= 40; n++) for (const suf of [...MANIFEST.ordinalSuffixes, "ଶହ", "ତମରେ"]) { add(`ସେ ${n}${suf} ସ୍ଥାନ`); add(`ସେ ${n} ${suf} ସ୍ଥାନ`); }
        for (const n of ["100", "1000", "100000", "10000000", "9007199254740993", "1.5", "1,000"]) for (const suf of MANIFEST.ordinalSuffixes) add(`ସେ ${n}${suf} ସ୍ଥାନ`);
        for (const h of ["0", "07", "9", "10", "12", "19", "23", "24", "123"]) for (const m of ["00", "05", "30", "59", "60", "5"]) add(`ସମୟ ${h}:${m}ଟା`);
        for (const g of ["1,00,000", "12,34,567", "5,000,000", "7,000", "0,500", "1990, 1991", "1,2345", "12,34", "1,234.5"]) add(`ପ୍ରାୟ ${g} ଲୋକ`);
        for (const u of ["କି.ମି.", "କି.ମି", "କିମି", "ମି.ମି.", "ମି.ମି", "ମିମି", "କି.ଗ୍ରା.", "କି.ଗ୍ରା", "km", "mm", "kg", "mph", "kph", "km/h", "m/s", "km²", "mm2", "s", "h"]) { add(`5${u} ଦୂର`); add(`5 ${u} ଦୂର`); add(`${u} ଦୂର`); }
        for (const [a, b] of [["କିଲୋମିଟର", "ଘଣ୍ଟା"], ["ମାଇଲ୍", "ସେକେଣ୍ଡ"], ["ଏବଂ", "କିମ୍ବା"], ["ମିଟର", "ମିନିଟ୍"]]) { add(`${a}/${b}`); add(`${a} / ${b}ରେ`); }
        for (const sg of ["$", "US$", "£", "¥", "€", "₹"]) for (const f of [`${sg}50`, `${sg} 50`, `${sg}14.7 ବିଲିଅନ୍`, `50${sg}`, `${sg}`]) add(`ମୂଲ୍ୟ ${f} ଥିଲା`);
        for (const r of ["±5", "-5", "−5", "–5", "3-5", "3 -5", "a-5", "ଏ -5", "+5", "UTC+1", "5 < 6", "5 > 4", "a=b", "8÷2", "50%", "5 %", "3×4", "3x4", "A & B"]) add(`ମାନ ${r} ଅଟେ`);
        for (const t of ["ହୋଇଛି I", "ପାଇଥିଲେI", "I am", "AI", "I.", "a.m. ରେ", "U.S.A", "A.D.", "802.11a", "ଡଃ. ରାମ", "ଡାଃ.ରାମ", "ଡା. ରାମ", "ନଂ. 5", "ନଂ.ରାମ", "35°W", "90 °", "5 °C"]) add(`ସେ ${t} ଥିଲେ`);
        for (const [t, src] of rows) {
            emit({ text: units(t), src, op: "normalize" }, norm(t));
            emit({ text: units(t), src, op: "text" }, withHost("or", () => E.text(t)));
        }
        const words = new Set<string>();
        for (const t of rows.keys()) for (const m of t.normalize("NFC").matchAll(/[଀-୥୰-୷]+/gu)) words.add(m[0]);
        for (const t of rows.keys()) for (const m of t.matchAll(/[଀-୥୰-୷]+/gu)) words.add(m[0]);
        const s = MANIFEST.signs as any;
        const sign = (k: string): string[] => (s[k]?.char ? [s[k].char] : []);
        const tails = ["", ...sign("virama"), ...sign("anusvara"), ...sign("chandrabindu"), ...sign("visarga"), ...sign("nukta"),
            ...Object.keys(MANIFEST.vowelSigns), ...Object.keys(MANIFEST.vowelSigns).flatMap((v) => sign("anusvara").map((a) => v + a)), "‍", "‌"];
        const cons = Object.keys(MANIFEST.consonants);
        for (const c of cons) for (const t of tails) { words.add(c + t); words.add(c + t + "କ"); words.add("ଅ" + c + t + "ତା"); words.add("ଆ" + c + t + "ି"); }
        for (const c of cons) for (const d of ["କ", "ଗ", "ଟ", "ତ", "ଦ", "ନ", "ପ", "ବ", "ମ", "ଯ", "ର", "ଳ", "ଲ", "ଷ", "ସ", "ହ"]) { words.add(c + "୍" + d + "ା"); words.add("ଆ" + c + "୍" + d); words.add(c + "୍" + c); }
        for (const v of Object.keys(MANIFEST.independentVowels)) for (const t of ["", ...sign("anusvara"), ...sign("chandrabindu"), ...sign("visarga")]) { words.add(v + t); words.add(v + t + "ବ"); }
        for (const w of ["", "ଡ଼", "ଡ଼", "ଢ଼", "ୟ", "ଯ଼", "ଳ୍ଳ", "\ud800", "୰", "୷", "଀"]) words.add(w);
        for (const w of words) emit({ word: units(w), op: "word" }, phonemizeWord(w));
        const ns: string[] = [];
        for (let i = 0; i <= 3000; i++) ns.push(String(i));
        for (let e = 4; e <= 22; e++) ns.push("1" + "0".repeat(e), "9".repeat(e), "12345678901234567890123".slice(0, e));
        for (const x of ["9007199254740991", "9007199254740993", "007", "୧୨୩", "୯୦୦୭୧୯୯୨୫୪୭୪୦୯୯୩"]) ns.push(x);
        for (const n of ns) emit({ text: units(n), src: "number", op: "text" }, withHost("or", () => E.text(n)));
    },
    // ── Zulu (zu). Inputs: the zu golden, FLEURS zu_za (columns 3 and 4) and probes/zu.txt. ──
    // normalizeZulu, the symbol tier over its output (recorded through the wrapper) and `createZulu().text` (no
    // foreign reader: the English route is covered end to end) over every text plus synthetic rows for every arm;
    // isForeignNguniWord over every letter run against the real English lexicon.
    async "zu-normalize"() {
        const { register } = await import("node:module");
        register(new URL("./symbols-hook.mjs", import.meta.url));
        const { records } = await import("./symbols-wrap.ts");
        const { normalizeZulu } = await import("../../../src/languages/zulu/normalize.ts");
        const { createZulu, isForeignNguniWord } = await import("../../../src/languages/zulu/zulu.ts");
        const { withHost } = await import("../../../src/core/foreign.ts");
        const rec = records.find((r) => /src\/languages\/zulu\//u.test(r.stack.split("\n").slice(2).join("\n")))!;
        const E = createZulu();
        const en = createEnglish();
        const rows = new Map<string, string>();
        for (const [t, src] of textsFor(["zu"], FLEURS_DIR.zu, ["zu.txt"])) rows.set(t, src);
        const add = (t: string): void => { if (!rows.has(t)) rows.set(t, "synthetic"); };
        for (const a of ["amaB&amp;B", "A & B", "A&B", "x&AMP;y", "a &amp; b", "&"]) add(`kukhona ${a} lapha`);
        for (const e of ["B.C.", "B.C.E.", "B.C", "BCE", "BC", "BCD", "aB.C.", "B.C.E"]) for (const tail of ["", ".", " Kodwa", " kodwa", ",", "\u00a0Kodwa"]) { add(`ngo-400 ${e}${tail}`); add(`ngo-400\u00a0${e}${tail}`); }
        for (const d of ["U.S.", "U. S. A.", "U.\u00a0S.", "É.Ü.", "A.b.", "uJoji W. Hlathi", "uJoji W. hlathi", "uJoji W.\u00a0Hlathi", "W. Hlathi"]) add(`ngu ${d} namuhla`);
        for (const g of ["1,000", "1,000,", "1,000.", "1,000.5", "12,345,678", "0,500", "1,0000", "1,5", "100 000", "100\u00a0000", "100\u202f000", "100\u2009000", "30 9", "1 000 000", "1,000 000"]) add(`angu-${g} futhi`);
        for (const p of ["4:41.30", "2:11.60", "1:09.02", "12:34.5", "4:41.305"]) add(`isikhathi ${p} sokugijima`);
        for (const h of ["0", "1", "07", "11", "12", "19", "23", "24"]) for (const m of ["00", "05", "30", "59", "60", " 08"]) for (const ap of ["", " a.m.", " p.m.", "pm", "AM", " P.M", " am.", " amaXhosa"]) add(`ngo-${h}:${m}${ap} namuhla`);
        for (const c of ["12,00 GMT", "15.00 UTC", "0230 UTC", "24.00 UTC", "9.30 utc", "15.00UTC", "1230 GMT", "12,00 GMTa", "1,30 UTC"]) add(`(${c})`);
        for (const a of ["a.m.", "p.m", "A.M.", "pm", "P.M", "ama.m."]) add(`ekuseni ${a} namuhla`);
        for (const x of ["±2", "+3", "+ 3", "a+3", "+\u00a03", "+30°C", "UTC+1", "+"]) add(`inani ${x} lapha`);
        for (const d of ["+30°C", "30 °C", "30°c", "30º C", "86°F", "86 º F", "45°", "45° ", "35°W", "35°w", "35° N", "20°Ca", "1.5°C", "1,5°C"]) { add(`kwaba ${d} namuhla`); add(`amazinga kwaba ${d} namuhla`); add(`amazinga. kwaba ${d}`); }
        for (const r of ["1995-96", "5-3", "26 -00", "4.2-3.9", "4.2 – 3.9", "10-20", "1,000-2,000", "3 – 5", "3—5", "5-5", "1.5-2", "2-1.5", "35-40 mph", "9007199254740993-9007199254740995"]) add(`kusukela ${r} lapha`);
        for (const r of ["100 km/h", "5 m/s", "100km/H", "5 m/\u017f", "100 \u212am/h", "5 MM / S", "3 kg/h", "2 cm/h", "7 mi/h", "1.5 km/h", "mph", "kph", "sama-kph", "40 MPH", "kphx", "80 km / h"]) add(`ngejubane le-${r} manje`);
        for (const q of ["300,948 sq mi", "5 sqmi", "5 SQ MI", "5 sq mia", "1600 kma", "kma", "1600.5 kma", "1600kma kusuka"]) add(`indawo ${q} lapha`);
        for (const v of ["$2.50", "US$ 14.7", "£3.05", "AUD$1.5", "$2.00", "12.8 km", "3.5km²", "3.5 km2", "2.5 m'", "1.50", "1.2.3", "2.5 FT", "0.5 mm", "1.5 \u212ag", "3.10", "4.0", "1.5.", "$1.5.2"]) add(`kwakungu-${v} lapha`);
        for (const v of ["1,5", "1,50", "1,500", "12,3,", "0,05"]) add(`ezingu-${v} lapha`);
        for (const f of ["1/2", "1/5", "1/10", "1/11", "1/0", "1/05", "1/00", "2/5", "1/2/3", "1 / 4", "1.5/2", "11/2"]) add(`ingxenye ${f} yabantu`);
        for (const g of ["6 × 6", "6×6", "x = y", "a=b", "3 < 4", "5 > 2", "-5", "a -5", "a-5", "−5", "5 -5", "(-5)", "6x6 cm"]) add(`inani ${g} lapha`);
        for (const d of ["ilunga - bona", "a -- b", "5 - 6", "a – b", "a — 5", "a - "]) add(`${d} Umfanekiso`);
        for (const n of ["njll.", "njl.", "njll", "NJLL.", "njlla", "udkt.", "dkt", "Udkt.", "udkta"]) add(`izinto, ${n} futhi`);
        for (const i of ["UTC", "i-PBS", "weNPWS", "kwiTV", "i-COVID-19", "US$5", "AUD$45", "ABCDEFG", "ABCDEF", "PBS2", "SADC", "eskom", "ESKOM"]) add(`sibona ${i} lapha`);
        for (const c of ["ALL CAPS DOCUMENT", "ALLCAPS", "PBS NEWS", " PBS "]) add(c);
        for (const [t, src] of rows) {
            const a = normalizeZulu(t);
            emit({ text: units(t), src, op: "normalize" }, a);
            emit({ text: units(a), src, op: "symbols" }, rec.apply(a));
            emit({ text: units(t), src, op: "text" }, withHost("zu", () => E.text(t)));
        }
        const words = new Set<string>();
        for (const t of rows.keys()) for (const m of t.matchAll(/\p{L}+/gu)) { words.add(m[0]); words.add(m[0].toLowerCase()); }
        for (const w of ["china", "cima", "xhosa", "cha", "check", "cycle", "box", "quick", "fox", "Xerox", "quiz", "xyz", "compyutha", "acquire", "exact", "chalk", "qinsekisa", "constructor"]) words.add(w);
        for (const w of words) emit({ word: units(w), op: "foreign" }, isForeignNguniWord(w.toLowerCase(), (x) => en.knownWord(x) !== undefined) ? "1" : "0");
    },
    // phonemizeWord (lexicon tone, explicit codes and no codes), phonemizeCompound, toSegments and `nat` over every
    // letter run, every tone-lexicon key, every 1–3 letter string of the alphabet, every 4-letter string over the
    // click-context letters and corners; deClick and the loan lexicon; numberToWords over 0…20,000 and magnitudes.
    async "zu-g2p"() {
        const { phonemizeWord, phonemizeCompound, nat } = await import("../../../src/languages/zulu/zulu.ts");
        const { toSegments } = await import("../../../src/languages/zulu/g2p.ts");
        const { numberToWords } = await import("../../../src/languages/zulu/numbers.ts");
        const { deClick, NGUNI_LOANS } = await import("../../../src/languages/zulu/nguniLoans.ts");
        const Z = new URL("../../../src/languages/zulu/zulu.ts", import.meta.url).href;
        const words = new Set<string>();
        for (const t of langTexts("zu")) for (const m of t.matchAll(/[\p{L}\p{M}'’-]+/gu)) { words.add(m[0]); words.add(m[0].toLowerCase()); }
        for (const k of loadTsvMap(Z, "tone.tsv", undefined, { optional: true }).keys()) { words.add(k); words.add(k[0]!.toUpperCase() + k.slice(1)); words.add("e" + k[0]!.toUpperCase() + k.slice(1)); }
        for (const k of NGUNI_LOANS.keys()) { words.add(k); words.add(k.toUpperCase()); }
        const abc = [..."abcdefghijklmnopqrstuvwxyz'"];
        for (const a of abc) { words.add(a); for (const b of abc) { words.add(a + b); for (const c of abc) words.add(a + b + c); } }
        const ctx = [..."aeiounhgcqxtsk"];
        for (const a of ctx) for (const b of ctx) for (const c of ctx) for (const d of ctx) words.add(a + b + c + d);
        for (const w of ["", "İ", "ſ", "\ud800", "a\udc00z", "𝐚𝐛", "é", "ﬁ", "Ntshonalanga", "ntsh", "ntshntsh", "NTSHA", "eNingizimu", "INingizimu", "KwaZulu", "uMnuMnu", "AbC", "aBc", "ABc", "XHosa", "São", "constructor", "toString", "Ā", "a-b", "'"]) words.add(w);
        for (const w of words) {
            emit({ word: units(w), op: "word" }, phonemizeWord(w));
            emit({ word: units(w), codes: units("HLFRHLX"), op: "toned" }, phonemizeWord(w, "HLFRHLX"));
            emit({ word: units(w), codes: units(""), op: "toned" }, phonemizeWord(w, ""));
            emit({ word: units(w), op: "compound" }, phonemizeCompound(w).join("|"));
            emit({ word: units(w), op: "nat" }, nat(w));
            emit({ word: units(w), op: "segs" }, toSegments(w).map((s) => `${s.ph}/${s.v ? 1 : 0}`).join(" "));
            emit({ word: units(w), op: "declick" }, deClick(w));
            emit({ word: units(w), op: "loan" }, NGUNI_LOANS.get(w) ?? "\u0000none");
        }
        const ns: number[] = [];
        for (let i = 0; i <= 20000; i++) ns.push(i);
        for (let k = 1; k < 1000; k++) ns.push(k * 1e3, k * 1e3 + 1, k * 1e3 + 21, k * 1e6, k * 1e6 + 2, k * 1e6 + 1001, k * 1e9, k * 1e9 + 3);
        for (let e = 4; e <= 25; e++) ns.push(10 ** e, 10 ** e - 1, 10 ** e + 7);
        ns.push(Number.MAX_SAFE_INTEGER, 2 ** 53 + 2, 1e300, 1.5, 20.7, -1, -0, NaN, Infinity, -Infinity);
        for (const n of ns) emit({ n: String(n), op: "words" }, numberToWords(n));
    },
};


const name = process.argv[2] ?? "";
const run = dumps[name];
if (run === undefined) {
    console.error(`unknown dump "${name}"; known: ${Object.keys(dumps).join(", ")}`);
    process.exit(2);
}
await run();
