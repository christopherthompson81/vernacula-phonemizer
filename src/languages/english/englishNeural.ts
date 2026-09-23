/**
 * Async neural entry for English (en). Runs the per-grapheme BiLSTM tagger (englishTagger.ts, ONNX) over the OOV words
 * — those the CMUdict lexicon misses — and leaves everything else (dict, heteronym POS disambiguation, numbers,
 * possessives, clause assembly) to the SYNC engine. Precedence per word: heteronym → lexicon → possessive → BiLSTM
 * tagger → n-gram engine. On a clean CMUdict held-out the tagger roughly HALVES the OOV phone-error-rate vs the n-gram
 * (7.4% vs 18.2%; 92.6% vs 81.8% phone-accuracy). Integration is a pre-pass: resolve each OOV word to IPA with the
 * tagger, then run the ordinary sync
 * `createEnglish().text()` with those readings injected as its `oovOverride` — so ONLY OOV word readings change;
 * numbers, heteronyms, and punctuation are byte-identical to `phonemize(text, "en")`. When `onnxruntime-node` or the
 * model is absent the tagger is `undefined` and this returns exactly the sync path (no throw).
 */
import { createEnglish } from "./english.ts";
import { addForeignOov, lookupForeignOov, withHost } from "../../core/foreign.ts";
import { createEnglishTagger, type EnglishTagger } from "./englishTagger.ts";

/**
 * A word to consider tagging.
 *
 * ⚠ NOT ADJACENT TO A DIGIT, AND THAT GUARD ARRIVED WITH #1452. Scanning the NORMALIZED text surfaces
 * letter runs that are fragments of a number rather than words: `2026-09-23` normalizes to
 * `september 23rd`, where a bare `[A-Za-z]+` matches the `rd` of `23rd` and hands the tagger a nonsense
 * key. The raw text had no such fragment, so the old scan never saw one.
 * ⚠ IT COSTS AN ONNX CALL EACH, WHICH IS WHAT MAKES IT WORTH GUARDING rather than tolerating: measured on
 * number-heavy text, that one junk key was the difference between 0.682 and 0.50 ms/call. The resolver
 * never asks for the fragment either, so the tagged entry was dead as well as expensive.
 */
const WORD = /[A-Za-z][A-Za-z']*/gu;

/**
 * An ORDINAL SUFFIX glued to a digit — `23rd`, `1st`, `2nd`, `4th`.
 *
 * ⚠ SCANNING THE NORMALIZED TEXT SURFACES FRAGMENTS THE RAW TEXT NEVER HAD (#1452). `2026-09-23`
 * normalizes to `september 23rd`, where `WORD` matches the bare `rd` and hands the tagger a nonsense key.
 * The resolver never asks for it — the tokenizer reads `23rd` whole — so the tagged entry is dead, and an
 * ONNX call is the most expensive thing in that loop.
 *
 * ⚠ AND THE FIRST VERSION OF THIS GUARD WAS A BLANKET "NOT ADJACENT TO A DIGIT", WHICH THE GOLDENS
 * REFUSED. It excluded a large legitimate class — pinyin with a tone number (`zhong1`, `zhi3`, `guai2`),
 * unit abbreviations (`600Mbit`), identifiers (`35px`) — where the LETTERS are a real word the tagger
 * reads well and the n-gram does not: `zhong1` went `ʒˈɔːŋ` → `ʒˈɑːnd͡ʒ`, `Mbit` went `ˌɛmbˈɪt` → `mbˈʌt`.
 * SIX golden rows across five languages, every one a regression. That is trading CORRECTNESS for one
 * ONNX call, which is the wrong trade — so the guard names the four ordinal suffixes and nothing else.
 */
const DIGIT_ORDINAL = /^[0-9](?:st|nd|rd|th)$/iu;
let taggerP: Promise<EnglishTagger | undefined> | undefined;
let engine: ReturnType<typeof createEnglish> | undefined;
const enEngine = (): ReturnType<typeof createEnglish> => (engine ??= createEnglish());

/** The sync resolver's OOV key: strip a trailing possessive ('s / s'), then any apostrophes — the exact `g2pKey`
 *  resolveWord() consults `oovOverride` with, so the pre-pass map lines up. */
function g2pKeyOf(word: string): string {
    const lower = word.toLowerCase();
    let lookup = lower;
    if (lower.endsWith("'s") && lower.length > 2) lookup = lower.slice(0, -2);
    else if (lower.endsWith("'") && lower.length > 2 && lower[lower.length - 2] === "s") lookup = lower.slice(0, -1);
    return lookup.replace(/'/gu, "");
}

/**
 * Tag the OOV words of `text` and record them for the FOREIGN reader (core/foreign.ts), for a host language that
 * is about to delegate an embedded Latin run to English.
 *
 * This is the async half the delegation could not have on its own: `defaultForeign` is typed synchronous, so a
 * host's run reached English's n-gram OOV G2P even under `phonemizeAsync`. Called from `phonemizeAsync` BEFORE the
 * host's render, so by the time the (synchronous) reader asks, the readings are already memoized.
 *
 * The words tagged are every Latin word in the host's text, which is a SUPERSET of the words the host will
 * actually delegate — the tokenizer decides that, deep inside `emitUnclaimed`, and asking it would mean rendering
 * twice. A superset only costs surplus tagger calls, and `phonemizeAsync` gates on mixed script so a Latin-script
 * host (whose own tokenizer claims its words) never gets here at all.
 *
 * Silent no-op without a model / `onnxruntime-node`: the memo stays empty and the reader falls back to the n-gram
 * engine, which is the pre-existing behaviour.
 */
export async function prewarmForeignEnglish(text: string): Promise<void> {
    if (taggerP === undefined) taggerP = createEnglishTagger();
    const tagger = await taggerP;
    if (!tagger) return;
    const E = enEngine();
    const done = new Set<string>();
    for (const m of text.matchAll(WORD)) {
        const w = m[0];
        if (E.knownWord(w) !== undefined) continue; // dict / heteronym → the sync path is authoritative
        const key = g2pKeyOf(w);
        if (done.has(key) || !/^[a-z]+$/u.test(key)) continue;
        done.add(key);
        // ⚠ CONSULT THE MEMO BEFORE TAGGING. It was written here and read only by the foreign reader, so
        // every call re-ran the BiLSTM over names already resolved. The reading is context-free, so a hit
        // is always valid. Measured on a repeated arz utterance carrying a novel name: 10 ms cold, 2 ms
        // warm. (The Latin handling itself costs about 1 ms/call — 6.2 vs 5.2 on the same sentence with
        // and without its Latin tokens.)
        if (lookupForeignOov(key) !== undefined) continue;
        const ipa = await tagger.tag(key);
        if (ipa) addForeignOov(key, ipa);
    }
}

/**
 * Phonemize English text with the neural tagger filling the OOV tail. Async because the ONNX pass is; falls back to
 * the plain sync path (CMUdict + n-gram engine) when the model / `onnxruntime-node` is unavailable.
 */
export async function phonemizeEnNeural(
    text: string,
    /** An ACCENT VARIANT rides here (#1260): its host code, and the per-word delta `createEnglishGB` /
     *  `createEnglishIN` hand to `text()`. Without this the variants composed on the sync engine only, so
     *  `phonemizeAsync("Croydon", "en-GB")` was the n-gram's *kɹˈɒɔᶦdɒn* while `"en"` had the tagger's
     *  *kɹˈɔᶦd̬ən* — the corpus is built on the async path, and en-GB was the one English that never got it. */
    variant?: { host: string; wordTransform: (ipa: string, word: string) => string },
): Promise<string> {
    if (taggerP === undefined) taggerP = createEnglishTagger();
    const tagger = await taggerP;
    const E = enEngine();
    const host = variant?.host ?? "en";
    if (!tagger) return withHost(host, () => E.text(text, variant?.wordTransform)); // no model → sync path

    // PRE-PASS: tag each distinct OOV word once. Skip words the sync engine already knows (dict/heteronym) — they are
    // served authoritatively by the sync path; genuinely-OOV pure-alpha words go to the BiLSTM. An empty tag ("")
    // means the tagger DECLINED (an out-of-vocab letter) → leave it out so the sync n-gram engine handles the word.
    const tagged = new Map<string, string>();
    // ⚠ THE NORMALIZED TEXT, NOT THE CALLER'S (#1452). This scanned `text` — the RAW input — so a word the
    // NORMALIZER creates was never in it, never tagged, and fell silently to the weaker n-gram path:
    // `τ` → `tau`, `µin` → `microinch`, `5 Ω` → `ohms`, `ξ` → `zye`. Those are exactly the
    // normalizer-introduced words that are also OOV, i.e. the ones with no dictionary row to fall back on.
    // ⚠ IT WAS INVISIBLE BECAUSE THE TWO PATHS AGREED ON EVERYTHING ELSE: `phonemize` and `phonemizeAsync`
    // returned different IPA for BYTE-IDENTICAL normalized text, and nothing in the trace said why until
    // #1453 added the tier.
    // ⚠ NORMALIZED ONCE, HERE, AND HANDED ON — not normalized again inside `text()`. Two passes cost
    // 0.583 → 0.947 ms/call (+62%) on this path, and the second would POISON the trace: `rewrite` refuses
    // a string the mapping does not describe, and a repeat pass from the raw input is exactly that shape,
    // which withholds every `inputSpan`. One pass under the same recording keeps the mapping correct.
    const normalized = E.normalizedFor(text);
    for (const m of normalized.matchAll(WORD)) {
        const w = m[0];
        // ⚠ An ordinal suffix glued to a digit is a FRAGMENT, not a word — see DIGIT_ORDINAL.
        if (m.index > 0 && DIGIT_ORDINAL.test(normalized.slice(m.index - 1, m.index + w.length))) continue;
        // ⚠ THE PREDICATE, NOT `knownWord` — see `hasWord`. Building the citation for every scanned word
        // is most of the cost, and this scan now walks the EXPANDED text where a date is a dozen words.
        if (E.hasWord(w)) continue; // dict / heteronym → sync path
        const key = g2pKeyOf(w);
        if (tagged.has(key) || !/^[a-z]+$/u.test(key)) continue;
        const ipa = await tagger.tag(key);
        if (ipa) tagged.set(key, ipa);
    }
    // Run the SYNC engine with the tagger readings injected between the lexicon and the n-gram — everything else
    // (numbers, heteronym POS, possessives, punctuation) is the sync path, so only OOV word readings differ.
    // `withHost` — this engine is built here, not by the registry, so nothing else pushes the host and a
    // foreign run would be dropped for want of one (core/foreign.ts). Synchronous, as that stack requires.
    return withHost(host, () => E.text(normalized, variant?.wordTransform, (g2pKey) => tagged.get(g2pKey), true));
}
