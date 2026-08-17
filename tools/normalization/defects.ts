/**
 * THE DEFECT CLASSES, in one place — what counts as a leak, what counts as a drop, and the
 * REDUNDANT-vs-DROP discrimination that separates a permissible drop from a real one.
 *
 * ⚠ EVERY TABLE HERE IS A FLEET FACT, NOT A PER-TOOL SETTING. These tables were once copied into each tool
 * that needed them and drifted apart, leaving the strongest gate in the repo blind to two whole sign classes
 * while the others could see them. Add a class here, never in a caller.
 */

import { SCRIPTS } from "./scripts.ts";

/** A LEAK is a character that SURVIVED into the IPA and should not have. */
export const LEAK_CLASSES: readonly (readonly [string, RegExp])[] = [
    // ⚠ `\p{Nd}`, NOT `\d`: under the `u` flag `\d` is ASCII 0-9 and nothing else, so `\d` is blind to a digit
    // leak in every language that writes its own numerals — Burmese ၀-၉, Thai ๐-๙, Bengali ০-৯, Khmer, Lao.
    ["DIGIT", /\p{Nd}/u],
    ["SLOT-GAP", /\s{2,}|^\s|\s$/u],
    // ⚠ NOT `.,;:!?` — those are the CANONICAL inline pause marks every engine emits via clauseSink, so
    // including them flags every utterance and the check tells you nothing. What belongs here is a mark that
    // should have BECOME one of those and did not: a native terminator, a symbol, or a non-ASCII digit.
    // U+00BA º and U+00AA ª are here because a class holding only `°` (U+00B0) lets `dell'11º` →
    // `undˈit͡ʃi º` pass the scan clean.
    ["RAWMARK", /[…。、，％℃°ºª〜～・！？²³\p{Sc}।॥۔؟،؛]/u],
    ["ZERO-WIDTH", /[​-‍⁠﻿]/u],
    /**
     * ⚠ NOT `[A-Za-z]` — THAT FLAGS EVERY UTTERANCE. IPA is WRITTEN IN ASCII LATIN: `m n s a i k p t b d e o
     * u l r j w h f v z q x y` are all IPA symbols, so a lowercase test over the output is a tautology, not a
     * detector. Measured on ig: `/[A-Za-z]/` fires on 460 of 460 lines.
     *
     * **No IPA symbol is an uppercase ASCII letter.** The small capitals the alphabet does use — ⟨ʀ ɢ ɪ ʏ ʟ ɴ
     * ʙ⟩ — are their own codepoints (U+0280, U+0262, U+026A, …), not `R G I Y L N B`, so this class cannot
     * collide with them. That makes it the one part of the raw-Latin problem decidable from the OUTPUT ALONE,
     * which is why it fits this table at all; the rest needs the source and lives in `rawLatinIn` below.
     *
     * ⚠ IT IS ALSO WHY THIS SITS HERE AND NOT IN `DROPPABLE`. A drop is tested by substituting the symbol and
     * comparing readings; there is nothing to substitute here, and `review.ts` would rightly demand a probe
     * string for a class that has no universal one.
     *
     * Measured across all 161 mined artifacts, 45 830 lines: it fired in **exactly one language** (hmn, 100
     * lines), where the engine passed unreadable words through verbatim — `Crocodile Dundee`, `United
     * Nations`, `BBC`, `COVID` all reached the IPA untouched. A class with a 1-in-161 fleet footprint that
     * lands squarely on a known-broken engine is a detector, not noise.
     *
     * ⚠ **THAT ONE LANGUAGE IS NOW FIXED, AND THE CLASS IS THEREFORE AT ZERO ACROSS THE FLEET.** hmn's
     * `syllableToIpa` returned its own input on an unknown rime and the caller emitted it; it now tiles a
     * solid run into tone-marked RPA syllables, and hands anything that is not RPA to the shared
     * `emitUnclaimed` foreign reader. Rescanned: **hmn `LEAK RAW-CAPS` 100 → 0** on the same 113 lines.
     * ⚠ A ZERO HERE IS NOT A REASON TO DELETE THE CLASS. It is the only part of the raw-Latin problem
     * decidable from the OUTPUT ALONE, it costs one regex, and the engine shape that produced the 100 —
     * a g2p returning its own input as a fallback — is not unique to hmn; it is merely the only place the
     * fallback was reached. The class earns its keep as the tripwire that catches the next one.
     * (⚠ `coverage.ts`'s header still quotes the pre-fix "68 lines in exactly one language" figure. It is
     * a second, DRIFTED copy of this fact — the exact hazard this file's own header names — and it is left
     * for whoever owns that file rather than edited from here.)
     */
    ["RAW-CAPS", /[A-Z]/u],
];

/**
 * RAW ASCII LATIN THAT SURVIVED INTO THE IPA — the class every counter above is blind to by construction.
 *
 * ## The instrument gap this closes
 *
 * Every other defect class in this file keys on a SIGN: a digit, a currency mark, a superscript, a zero-width
 * character. `km` is two ASCII letters, and in a Latin-script language a run of ASCII letters looks exactly
 * like a word. So four separate engines echoed a unit abbreviation straight into their output and no gate in
 * the repo could see it — hmn's `syllableToIpa("km")` returning its own input and appending a tone letter,
 * cdo's `2,133 km²` reading `… km˥˥`, ig's `48 kg` PRONOUNCED `iɾi anɔ na asatɔ kɡ`. hmn's referee scored a
 * perfect 455/455 throughout.
 *
 * ## The rule, and why each half is load-bearing
 *
 * > An ASCII run of **≥ 2 letters** in the SOURCE, containing **no vowel letter** (`aeiouy`, either case),
 * > that survives **verbatim as a whole token** into the IPA.
 *
 * ⚠ **THE VOWEL TEST IS WHAT MAKES IT SPECIFIC, AND NOTHING ELSE MEASURED DOES.** A phonemized word has a
 * syllable; `km kg cm mm th nd pdf mln` have no nucleus. The proxies tried first all failed on the fleet and
 * are recorded in the investigation doc with their rates: a source↔output token differential alone fires on
 * 96.1 % of ig (Igbo `na` reads `na`); a 50-entry unit-abbreviation list fires on English `in`, Igbo `ha`,
 * `mi`, `ft`; "the run sits next to a digit" fires on `na ×14, nke ×8, maka, dika`. Every one of those is a
 * guess about the CONTEXT of the run, and no amount of context repairs a rule that is wrong about the RUN.
 *
 * ⚠ **AND THE DIFFERENTIAL IS WHAT KEEPS THE VOWEL TEST HONEST.** A vowelless OUTPUT token on its own is not
 * a defect: Czech *vlk*, Serbian *krv* are syllabic-consonant words, and a bare "output token with no vowel"
 * rule reports them. Requiring byte-identity with the source rejects them before the vowel test is consulted,
 * because a syllabic reading is never its own spelling (`krv` → `kr̩ʋ`). Measured: cs, ru, sr all fire ZERO.
 * The two halves cover each other's blind spot and neither works alone.
 *
 * ⚠ **FOLD ASCII `g` → IPA `ɡ` BEFORE COMPARING.** ig's `48 kg` reads `kɡ`: the engine had already mapped the
 * ASCII `g` (U+0067) to the IPA one (U+0261) and left the `k` alone. `g` is the ONLY ASCII letter that is not
 * itself an IPA symbol, and that single codepoint is enough for a byte-identical comparison to miss the exact
 * defect in the brief.
 *
 * ⚠ **AND STRIP SUPRASEGMENTALS FROM THE OUTPUT TOKEN.** cdo's leak is `km˥˥` — the tone letter is appended
 * to the echoed input, so the raw token never equals the raw run and the scan reads clean.
 */
const RAW_LATIN_RUN = /[A-Za-z]+/gu;
/** A run with no vowel letter. `y` counts as a vowel: it is one in Welsh, Guaraní and Turkic orthography. */
const VOWELLESS_RUN = /^(?![A-Za-z]*[AEIOUYaeiouy])[A-Za-z]{2,}$/u;
/**
 * Marks that hang OFF a phone rather than being one, plus the punctuation `clauseSink` attaches to a token.
 * Stripped from an output token before it is compared with a source run.
 *
 * ⚠ `\p{Nd}` IS IN HERE and has to be, because an echoed run does not always arrive alone. `8th` reads `8th`
 * — the digit leak and the letter leak are the SAME token, and a scan that compares whole tokens sees a
 * string that matches no source run and reports neither. The digit is `LEAK DIGIT`'s business; this class
 * asks only what happened to the letters. Same for Maltese `fl-1091`.
 */
const SUPRASEGMENTAL = /[ˈˌːˑ˞ʰʲʷˡˤ˥-˩↗↘|‖‿()\[\],.;:!?"'’“”«»…-]|\p{Nd}|\p{M}/gu;
/**
 * ⚠ THE SYLLABICITY DIACRITICS ARE NOT STRIPPED — THEY ARE A VETO, and getting this wrong silently disarms
 * the differential's whole purpose. U+0329 ◌̩ and U+030D ◌̍ say "this consonant IS the nucleus", which is the
 * one thing that makes a vowelless output token a legitimate word. Fold them away with the rest of `\p{M}`
 * and Czech `krk` → `kr̩k` compares EQUAL to its own spelling and reports as a leak — measured, in the test
 * beside this file. A token carrying one is a syllabic reading and can never be an echo.
 */
const SYLLABIC = /[̩̥̍]/u;
/** ⚠ ASCII `g` is not IPA; every engine that reads a `g` at all emits `ɡ` U+0261. Fold before comparing. */
const foldToIpa = (run: string): string => run.replace(/g/gu, "ɡ").replace(/'/gu, "ʼ");

/**
 * LANGUAGES WHOSE PHONOLOGY GENUINELY WRITES VOWELLESS WORDS — the rule's one real false-positive population,
 * measured rather than guessed, and named rather than narrowed around.
 *
 * ⚠ THIS IS NOT AN `ACCEPTED_SILENT`-STYLE PER-LINE ESCAPE HATCH, and it must not be allowed to become one.
 * Every entry is a claim about the language's PHONOTACTICS — that a particular vowelless string is a word or
 * bound morpheme of the language — which is the one thing "no vowel ⇒ not a word" cannot know and cannot be
 * taught by any amount of context. An entry naming a unit abbreviation would be a defect being silenced and
 * belongs nowhere near this table.
 *
 * ⚠ AND THE ALTERNATIVE WAS MEASURED AND IS WORSE. Narrowing the rule to digit-adjacent runs — the obvious
 * way to avoid naming any language — was scored over the whole fleet: it fixes rn (97 → 2) and rw (94 → 4),
 * does NOT fix mt (201 → 111) or shi (192 → 130), and costs 780 true positives, 39 % of the class. Maltese
 * `fl-` means *in*, and what one is most often *in* is a YEAR (`fl-1091`, `fl-2007`), so the filter and the
 * false positives are correlated, not orthogonal. See the investigation doc, Run 4.
 */
export const VOWELLESS_WORDS: Readonly<Record<string, readonly string[] | "*">> = {
    /**
     * Maltese proclitic prepositions. `fl-` is *fi* + the definite article `l-` (*in the*), `bl-` is *bi* +
     * `l-` (*with the*); both are written bound to their host with a hyphen and are ordinary running text.
     * ×266 and ×43 in the artifact. ⚠ `km ×76`, `ft ×2` and `pm ×1` in the same corpus are NOT listed and
     * remain reported — mt is both a false-positive source and a real defect site, and conflating the two is
     * how a class becomes worthless.
     */
    mt: ["fl", "bl"],
    /**
     * Rundi and Kinyarwanda noun-class concords, elided before a vowel and written with an apostrophe:
     * `bw'u Rwanda`, `kw'ijana`, `nk'igihugu`, `mw'ijoro`, `tw'abana`. These are very nearly the whole of
     * each language's firing population — with them listed, rn falls to 0 residual hits and rw to 8.
     *
     * ⚠ `nd` IS THE EIGHTH ENTRY AND IT CORRECTS THIS COMMENT'S OWN CLASSIFICATION. The list above once
     * named rw's eight residuals — `hp`, `nd`, `gm`, `zh`, `kh`, `ts`, `php`, `ppm` — as "genuine echoes",
     * which was decided from the RUN and not from the source. Read in the artifact, `nd` is the ELIDED
     * COPULA: `gahunda ya nd' Umunyarwanda`, i.e. *ndi* ("I am") + a vowel-initial word, elided and
     * apostrophised exactly as the concords above are. The programme's own name is *Ndi Umunyarwanda*
     * ("I am Rwandan"), so the unelided form is beside it in the same corpus. It is a word of the language
     * being emitted correctly, which is what this table is for; the other seven stand.
     * ⚠ AND THE COST IS NAMED RATHER THAN HIDDEN: `nd` is also the English ordinal suffix, so a `2nd` in an
     * English citation inside rw text will now report as ACCEPTED-PHONOTACTIC instead of as a leak. That is
     * the same exposure `rw` and `cy` already carry (both are also ISO codes), it is a NOTE and not a
     * silence — the scan still prints the line — and the alternative is to keep failing a real Kinyarwanda
     * word to catch a hypothetical English one.
     */
    rn: ["bw", "kw", "nk", "mw", "tw", "rw", "cy"],
    rw: ["bw", "kw", "nk", "mw", "tw", "rw", "cy", "nd"],
    /**
     * ⚠ TASHELHIYT IS A WILDCARD, AND IT HAS TO BE. Berber phonology admits syllables with no vowel at all,
     * so vowelless words are not a closed list to enumerate — the artifact alone yields `gr ×184`,
     * `tlkm ×117`, `ns ×22`, `tn`, `tg`, `sg`, `dg`, `tskflt`, `skrn`, `lqblt`, `tmrslt`, `twtmt`, and 40
     * more in 403 lines. Listing them would be transcribing a dictionary, and the next artifact would add to
     * it. The premise "no vowel ⇒ not a word" is simply false here.
     *
     * ⚠ THE COST IS STATED, NOT HIDDEN: a wildcard blinds the class to this language, and shi DOES leak —
     * `km ×32` and `kg ×7` are in that same corpus. That is why `ALWAYS_REPORTED` below exists.
     */
    shi: "*",
};

/**
 * WHAT A WILDCARD CANNOT EXCUSE — the metric abbreviations, spelled the same in every language that uses them.
 *
 * ⚠ IT OVERRIDES ONLY `"*"`, NEVER AN EXPLICIT WORD LIST, and the asymmetry is the point. A wildcard is a
 * claim about a language's own phonotactics, and a language's phonotactics have nothing to say about a
 * borrowed SI abbreviation — so `km` in shi is still a leak and is still reported. An explicit entry is a
 * claim about THAT STRING in THAT LANGUAGE, which does outrank this: rn's `mw` is the concord *mw'*, and it
 * would be plainly wrong for "megawatt" to overrule a grammatical fact stated with its reason.
 *
 * ⚠ AND IT IS DELIBERATELY TINY. This is not the unit list rejected in Run 1 — that list failed as a
 * DETECTOR, firing on `in`, `ha`, `mi`. Here it can only ever RE-REPORT something a wildcard silenced, so its
 * failure mode is a stray report rather than a hidden defect, and it is kept to the unambiguous SI forms.
 */
const ALWAYS_REPORTED: ReadonlySet<string> = new Set(["km", "kg", "mm", "cm", "ml", "kw", "mw", "kb", "mb", "gb"]);

/**
 * Every raw-Latin run that survived into `ipa`, tagged with whether the language's phonotactics excuse it.
 *
 * Returns BOTH kinds rather than filtering: `mine.ts` reports an excused run under its own label, so a gate
 * run says which table spoke — the same discrimination `ACCEPTED` and `ACCEPTED-CLASS` already draw for signs.
 * A quiet exemption is indistinguishable from a clean scan, and that is precisely how this defect survived.
 */
export function rawLatinIn(lang: string, sentence: string, ipa: string): { run: string; phonotactic: boolean }[] {
    const exempt = VOWELLESS_WORDS[lang];
    const tokens = new Set(
        ipa.split(/\s+/u)
            .filter((t) => !SYLLABIC.test(t))
            .map((t) => foldToIpa(t.replace(SUPRASEGMENTAL, "")))
            .filter(Boolean),
    );
    const out: { run: string; phonotactic: boolean }[] = [];
    const seen = new Set<string>();
    RAW_LATIN_RUN.lastIndex = 0;
    for (const m of sentence.matchAll(RAW_LATIN_RUN)) {
        const run = m[0];
        if (seen.has(run) || !VOWELLESS_RUN.test(run) || !tokens.has(foldToIpa(run))) continue;
        seen.add(run);
        const lower = run.toLowerCase();
        const phonotactic = exempt === "*"
            ? !ALWAYS_REPORTED.has(lower)
            : exempt !== undefined && exempt.includes(lower);
        out.push({ run, phonotactic });
    }
    return out;
}

/**
 * A SILENT DELETION is a LETTER that reaches the engine, is not rejected, and produces NOTHING — the class
 * found six times by hand and never by an instrument.
 *
 * ## The instrument gap this closes
 *
 * `LEAK_CLASSES` sees a character that SURVIVED and should not have. `DROPPABLE` sees a SIGN that vanished.
 * Neither can see a LETTER that vanished, and nor can the referee or a corpus diff, because nothing appears
 * that should not — something simply fails to appear. So the same defect was found six times, each time by a
 * human reading a corpus or hand-running a character census:
 *
 * | language | character | scale |
 * |---|---|---|
 * | bm | ⟨ε⟩ U+03B5 ×166, ⟨ԑ⟩ U+0511 ×26, ⟨ᴐ⟩, ⟨ɳ⟩ — homoglyphs for ⟨ɛ ɔ ɲ⟩ | ~200 chars |
 * | ki | ⟨ű ī ū û î⟩ — keyboard substitutes for ⟨ĩ ũ⟩ | 7 % of paragraphs |
 * | bal | ⟨ݔ⟩ U+0754, a letter outside the token class | 38.9 % of paragraphs |
 * | gn | ⟨ꞌ⟩ U+A78C SALTILLO — the puso, a PHONEME | ×301 in 433 segments |
 * | ee | ◌͂ U+0342 perispomeni, written for the nasal tilde | ×6 |
 * | sat | ⟨ᱻ⟩ U+1C7B RELAA, inside the word class and claimed by no branch | ×7 |
 *
 * ## The rule, and why each half is load-bearing
 *
 * > A character that is a LETTER OR MARK (`\p{L}`/`\p{M}`), tested on the words of the corpus that CONTAIN it,
 * > where the reading of every such word is byte-identical to the reading of that word **with the character
 * > deleted**, or to the reading of it **with the character replaced by a space** — in EVERY word tested.
 *
 * ⚠ **BOTH PROBES ARE NEEDED AND THEY ARE DIFFERENT DEFECTS.** Deletion catches the character that is inside
 * the token class and mapped by nothing (gn, ee, sat); space-substitution catches the character that is
 * OUTSIDE it, which the engine treats as a word boundary — bal's ⟨ݔ⟩ turns `مسترݔن` into two fragments, and
 * `say(w)` there equals `say(w with ݔ → space)` and NOT `say(w without ݔ)`. A detector with one probe misses
 * half the class, and which half depends on where each engine draws its token class.
 *
 * ⚠ **AND UNIVERSALITY IS WHAT SEPARATES THIS FROM "A SILENT LETTER"**, which is the trap the naive version
 * falls into. French `parlent`, English `knight`, Spanish `hombre` all contain a letter that says nothing
 * HERE — and says something in the next word. A character is only reported when it says nothing in EVERY word
 * of the corpus it was tested in (≥ 3 distinct words). Measured: a single-word version fires on ⟨h⟩ in every
 * Ibero-Romance engine in the fleet, all of which read ⟨ch⟩ correctly.
 *
 * ## The rejected designs, with their measured fleet rates (investigation doc, Runs 2-5)
 *
 * | design | fleet result |
 * |---|---|
 * | "an input character absent from the output" | fires on every space, pause mark and silent letter — 100 % |
 * | per-word differential over ANY character | re-reports what `DROPPABLE` already discriminates, minus its REDUNDANT test |
 * | per-word differential, letters only, ONE probe word | fires on every orthographic silent letter |
 * | + universal over ≤8 probe words | **736 findings in 64 of 162 languages** — unreadable |
 * | + the CORE-INVENTORY word filter below | 736 → **176** |
 * | + case folding and the Han exclusion | 176 → **90 in 39 languages** |
 * | "the character is not MENTIONED in the engine's own source" | REJECTED: 41 of 46 hit characters are "mentioned", including every false positive and most true ones — this repo's design-note comments quote the corpus, and the question is not whether a character is mentioned but whether it is claimed IN THIS COMBINATION. It removes true positives at ~7× the rate it removes false ones. |
 */

/**
 * ⚠ THE CORE-INVENTORY FILTER IS WHAT REMOVES THE IPA-GLOSS FALSE POSITIVES, AND NOTHING SHALLOWER DOES.
 *
 * A wiki article's lead contains PRONUNCIATION GLOSSES — `ˈhɑːn`, `kaʊˈɑɪ`, `əˈkrɑː` — which are not words of
 * the language and are not in its script's ordinary use. Tested as words they report ⟨ɑ ɪ ʊ ə ː ˈ⟩ silent in
 * ki, haw, mos, sn, so, nya, lt, bar: about 60 % of every non-Han hit before this filter.
 *
 * ⚠ AND A HAND-WRITTEN LIST OF "IPA SYMBOLS" CANNOT BE THE FILTER. ⟨ɛ ɔ ŋ ɲ ɖ ƒ ʋ ɣ⟩ ARE the orthography in
 * bm, ee, ig and thirty more engines in this fleet; a blacklist of them would blind the class to exactly the
 * languages it was built for. So the test is about the CORPUS, not about IPA: a probe word is admissible only
 * when every character in it OTHER THAN THE CANDIDATE is a core character — one occurring at least
 * `max(20, 0.05 %)` of the corpus's letter occurrences. A gloss is built of characters that are themselves
 * rare in a Kikuyu corpus; a Kikuyu word is not.
 *
 * ⚠ THE CANDIDATE IS EXEMPT FROM THE FLOOR, AND HAS TO BE. The intruder is rare BY DEFINITION — ee's
 * perispomeni is ×6 in its whole artifact — so a rule that also required the candidate to be core would be
 * blind to the smallest and most interesting half of the class.
 */
const CORE_FLOOR = 0.0005, CORE_MIN = 20;
/** A word for probing purposes: a run of letters and marks. Digits and punctuation end it. */
const PROBE_WORD = /[\p{L}\p{M}]+/gu;
/** At most this many probe words per candidate, spread across the corpus rather than taken from its head. */
const PROBE_WORDS = 8;
/** Fewer distinct words than this is not evidence about a LANGUAGE, only about a word. */
const MIN_PROBE_WORDS = 3;

/** U+0301 COMBINING ACUTE, written as an escape — a bare combining mark in a string literal renders on top of
 *  the quote and is unreviewable. See the `ab`/`ba`/`be`/`chv`/`mn`/`tg`/`tt` entries below. */
const STRESS_MARK = "\u0301";

/**
 * CHARACTERS WHOSE SILENCE IS THE ORTHOGRAPHY'S OWN — this class's measured false-positive population, named
 * rather than narrowed around, exactly as `VOWELLESS_WORDS` is for `rawLatinIn`.
 *
 * ⚠ EVERY ENTRY IS A CLAIM ABOUT A WRITING SYSTEM, not a per-corpus escape hatch, and an entry that named a
 * letter an engine merely FAILS to read would be a defect being silenced. Both entries below are characters
 * that a correct engine must read as nothing.
 *
 * ⚠ AND AN ENTRY DOES NOT HIDE THE HIT — `mine.ts` reports it under `ACCEPTED-ORTHOGRAPHIC`, because a quiet
 * exemption is indistinguishable from a clean scan, which is how this defect class survived six times.
 */
export const ORTHOGRAPHIC_SILENCE: Readonly<Record<string, readonly string[]>> = {
    /**
     * ⚠ FLEET-WIDE, AND THE ONE CHARACTER THAT EARNS IT. U+0640 TATWEEL is not a letter at all: it is a
     * justification stroke that stretches the joining line between two letters, so a reader voices nothing for
     * it in ANY Arabic-script language. Reported in ary ×429, arz ×37 and skr ×3 before this entry. Unicode
     * gives it category `Lm`, which is why the `\p{L}` candidate test sees it in the first place.
     */
    /**
     * ⚠ FLEET-WIDE, AND THE SECOND CHARACTER THAT EARNS IT. U+0652 SUKŪN is the mark whose MEANING is "no
     * vowel here" — a reader voices nothing for it by definition, in every Arabic-script orthography. Every
     * engine in this half of the fleet already consumes it as an explicit no-vowel (ar's `resolveVowel`
     * default arm, ps's and Shahmukhi's `DEF.sukun` branch), so its silence is the rule firing, not a rule
     * missing. Reported in ary ×10 (`لْحرب → liħˈarb`, `تْجَاوَزُوهْ → taʒaːwazˈuːh`) before this entry.
     */
    /**
     * ⚠ AND THE URDU-SCRIPT HONORIFIC AND ANNOTATION SIGNS — U+0610–U+0614 — ARE NOT LETTERS AT ALL. Each one
     * ABBREVIATES A WHOLE PHRASE written above a name: ؐ SALLALLAHOU ALAYHE WASSALLAM (رسولؐ, حضورؐ), ؒ ALAYHE
     * ASSALLAM / RAHMATULLAH ALAYH (قشیریؒ, اجمیریؒ), and ؔ TAKHALLUS, which is purely typographic — it marks
     * that the word before it is a poet's PEN-NAME (ناصؔر, مخفیؔ) and has no reading in any register at all.
     * Voicing the first two would splice a four-word Arabic formula into the middle of every name a pious text
     * mentions; silence is the front-end convention and the one this fleet keeps. Reported in skr as ؒ ×5,
     * ؔ ×3, ؐ ×3. Fleet-wide, like the tatweel, because the claim is about PERSO-ARABIC WRITING and not about
     * Saraiki — ur, pnb and fa can all carry them, and a per-language list would go stale the first time one
     * did. All five of the block are listed, not only the three a 436-line artifact happened to contain.
     */
    "*": ["ـ", "ْ", "ؐ", "ؑ", "ؒ", "ؓ", "ؔ"],
    /**
     * Maltese ⟨h⟩ is silent — the /ħ/ of the language is written ⟨ħ⟩, a different letter, which this engine
     * reads. `hija → ɪja`, `iqaddsilhom → ɪʔattsɪlɔm` are both correct. ×1,315 in the artifact, and it is the
     * archetype of the population this table exists for: the letter that is silent BY RULE, in every word.
     * ⚠ Its Ibero-Romance cousins are NOT listed and must not be: es/an/ast/gl/it/oc all read ⟨ch⟩, so their
     * ⟨h⟩ demonstrably contributes and the case-folded probe below already clears them without a table entry.
     */
    mt: ["h"],
    /**
     * ⚠ TĀʾ MARBŪṬA IS SILENT IN PAUSAL FORM AND THESE ENGINES ARE PAUSAL BY CONSTRUCTION — the /a/ of
     * `madīna` is the FATḤA ON THE NŪN, not the ⟨ة⟩. `arabic.jsonc`'s `convention` block has said so since the
     * engine was written (`"taaMarbuta": "ة silent in pausal (phrase-final) form"`), `g2p.ts` implements it,
     * and `diacritizer.ts`'s `pausalize` puts EVERY word in that form, so this is the whole contract and not a
     * phrase-position accident.
     *
     * ⚠ AND THE ×5,951 REPORT THAT PUT IT HERE WAS AN ARTIFACT OF THE SYNCHRONOUS ENTRY POINT. `arabic.ts`
     * has two, and its header says they expect different input: `phonemize` assumes VOWELLED Arabic and reads
     * bare text off its consonant skeleton, while `phonemizeArabic` runs the neural diacritizer first.
     * `mine.ts scan` calls the synchronous one, so on `سلسلة → slsl` it is not only ⟨ة⟩ that says nothing —
     * every short vowel does; ⟨ة⟩ is singled out only because the other silent things there are marks that are
     * not in the text for a probe to delete. Re-run through the async path, ⟨ة⟩ CONTRIBUTES in 30 of 30 probe
     * words across ar/ary/arz: `سلسلة → silsˈila`, `مدينة → madˈiːna`, `منطقة → mintˤˈaʔa`.
     *
     * ⚠ NOT LISTED FOR ur/pnb/skr/sd, WHERE THE SAME CHARACTER IS A DIFFERENT LANGUAGE FACT: Urdu-script
     * writing reads final ⟨ة⟩/⟨ۃ⟩ as /a/ (السنۃ as-sunna, سورة sūra), so there its silence is a real deletion
     * and is fixed in that front end rather than exempted here.
     */
    ar: ["ة"], arz: ["ة"], ary: ["ة"], apc: ["ة"], apd: ["ة"],
    acm: ["ة"], afb: ["ة"], ayl: ["ة"], ajp: ["ة"], acw: ["ة"],
    /**
     * ⚠ PUNJABI AND ITS LAHNDA SIBLINGS HAVE NO PHONEMIC /ʔ/, so the Arabic-loan hamza ⟨ء⟩ is silent BY RULE
     * and the rule is already argued in `punjabi.ts` against the referee (`اعتراض → et̪raːz`, +13 net; the
     * same line removes ⟨ع⟩). Reported in pnb ×158 — `علماء → ˈəlmaː` *ʿulamā*, `اشیاء → ˈeːʃjaː` *ashyā*,
     * `فضاء` *fazā* — and every probe word is exactly that: an Arabic loan whose hamza Urdu-script writing
     * keeps in the spelling and drops in the mouth.
     * ⚠ THE OTHER 126 OF THOSE 158 WERE NOT THIS AT ALL, and finding that out is why the entry is narrow: a
     * STANDALONE ⟨ء⟩ after a year is the era marker for عیسوی "CE" (`1238 ء وچ`), which is a real deletion
     * and is now expanded in `punjabi/normalize.ts` instead of being exempted here. The detector could never
     * have reported that half on its own — a one-character word is not a probe word, since deleting the
     * candidate leaves nothing to read.
     */
    pa: ["ء"], pnb: ["ء"], skr: ["ء"],
    /**
     * ⚠ THE SOFT SIGN IS A PER-LANGUAGE QUESTION, AND THESE THREE ANSWER IT WITH "NOTHING". Russian's ⟨ь⟩
     * palatalises the preceding consonant, and copying that answer across the Cyrillic Turkic and Iranian
     * languages would INVENT a contrast none of them has. The evidence is each language's own independent
     * referee, not an argument from Russian:
     *   tt — `tt.kaikki-tatar.tsv`: `яшь jæʃ` (word-final, no trace at all), `дөнья døn.jɑ`, `көньяк
     *        ˈkø̞nˌjɑq` — before ⟨я ю е⟩ it is a HIATUS mark whose [j] the vowel letter already supplies, and
     *        this engine already emits it. No ʲ anywhere in the referee. ×275 in the artifact.
     *   tg — `tg.wikipron-tgk-cyrl-broad.tsv`: `автомобиль a v t o m o b i l`, `бисьёр b i s j o r`,
     *        `госпиталь ɡ o s p i t a l`. Tajik dropped ⟨ь⟩ from its alphabet in 1998; every one of the 34
     *        corpus occurrences is a Russian word or loan carrying Russian spelling. ×34.
     *   ky — no ⟨ь⟩ headword exists in `ky.wikipron-kir-broad.tsv`, so the corpus is the evidence instead: a
     *        census of every ⟨ь⟩ word in the artifact returns Russian loans and Russian-mediated toponyms
     *        without exception (Тянь, роль, Шань, Гумбольдт, декабрь, стиль, премьер, июль, Сибирь,
     *        Беларусь, Вильнюс). Kyrgyz has no palatalised consonant series to put the mark on. ×196.
     * ⚠ CHUVASH IS THE COUNTER-CASE AND IS DELIBERATELY ABSENT FROM THIS TABLE — its referee writes
     * `выльӑх ˈʋɯlʲəχ`, so ⟨ь⟩ there is a real [ʲ] and the engine now emits it. Four languages, one
     * character, two opposite verdicts: which is why this had to be decided per language rather than once.
     */
    tt: ["ь", STRESS_MARK],
    tg: ["ь", STRESS_MARK],
    ky: ["ь"],
    /**
     * ⚠ THE CYRILLIC DICTIONARY STRESS MARK, AND ITS SILENCE IS THE FIX RATHER THAN THE DEFECT. U+0301 on a
     * Cyrillic base is not a letter of any Cyrillic alphabet: it is the lexicographic annotation a wiki lead
     * writes to show where the word is stressed (`Абіса́ль`, `А́страхань`, `молоко́`). Before `foldCyrillicStressMarks`
     * (core/unicode.ts) it was reported in `separator` mode — it fell outside every Cyrillic engine's
     * `[Ѐ-ӿ]+` token class and BROKE THE WORD IN TWO, `Абіса́ль → abʲisa lʲ`. It now reports `inert` with the
     * word intact (`→ abʲisalʲ`), which is the correct reading of an annotation the engines cannot honour:
     * stress here is by rule or by lexicon, and none of them takes a per-word override.
     * ⚠ NOT A `"*"` ENTRY, unlike the tatweel. The same codepoint is a LETTER-FORMING mark elsewhere in the
     * fleet — the tone letter of vi, the stress letter of es, the tone mark of umbundu — and a fleet-wide
     * exemption would quietly accept an engine that deleted one of those. The claim is Cyrillic-scoped, and
     * this table has no script scope, so it is made once per language that carries the mark.
     */
    ab: [STRESS_MARK],
    ba: [STRESS_MARK],
    be: [STRESS_MARK],
    chv: [STRESS_MARK],
    mn: [STRESS_MARK],
};

/** A character the LEAK tables already own is not this class's business — derived, never re-listed. */
const claimedByLeakClass = (ch: string): boolean =>
    LEAK_CLASSES.some(([, re]) => { re.lastIndex = 0; return re.test(ch); });

/** One reported character, with the evidence that produced it. */
export interface SilentChar {
    /** The character, case-folded: `H` and `h` are the same letter and are judged together. */
    ch: string;
    /** How often it occurs in the corpus's words (all case variants). */
    occurrences: number;
    /** How many distinct words the verdict rests on. */
    words: number;
    /** `inert` — mapped by nothing inside the token; `separator` — treated as a word boundary. */
    mode: "inert" | "separator";
    /** `word → reading`, for a reader who has to judge whether the silence is correct. */
    examples: string[];
    /** Its silence is the orthography's own (`ORTHOGRAPHIC_SILENCE`) — a note, not a defect. */
    orthographic: boolean;
}

const escapeChar = (s: string): string => s.replace(/[.*+?^${}()|[\]\\-]/gu, "\\$&");
/** Spread across the list rather than its head — the first N words of an artifact are all one article. */
const spread = <T>(list: readonly T[], n: number): T[] =>
    list.length <= n ? [...list] : Array.from({ length: n }, (_, i) => list[Math.floor(i * (list.length / n))]!);

/**
 * Every letter of this corpus that says NOTHING, wherever it is used.
 *
 * ⚠ CORPUS-LEVEL, NOT PER-SENTENCE, AND THAT IS THE THIRD MECHANISM THIS FILE NOW CARRIES. `LEAK_CLASSES` is
 * decidable from one output; `rawLatinIn` needs one source and its output; this needs THE WHOLE CORPUS,
 * because the evidence is that a character says nothing in EVERY word — a claim no single line can support or
 * refute. A per-line version was tried first and it is the single-probe-word design in the table above: it
 * reports every orthographic silent letter in the fleet.
 *
 * ⚠ HAN, HIRAGANA AND KATAKANA CORPORA ARE EXCLUDED BY SCRIPT, and the exclusion is stated rather than
 * hidden. There the candidate alphabet IS the corpus's whole character set, so this degenerates into a
 * DICTIONARY-COVERAGE meter — measured: gan 417, hsn 122, cjy 20, wuu 2, i.e. 76 % of the fleet's findings,
 * every one of them "a hanzi outside the dictionary reads as nothing". That is real and it already has an
 * instrument (`10741c3`'s dict-silence probe). Left in, it swamps the other 38 languages 4:1 and teaches the
 * reader to skip the section.
 *
 * `nativeScript` is the caller's `dominantScript(corpus)`; `undefined` (thin evidence or a genuine two-script
 * mix) disables the native-word filter, which fails toward REPORTING rather than hiding.
 */
export function silentCharsIn(
    lang: string,
    lines: readonly string[],
    say: Say,
    nativeScript: string | undefined,
): SilentChar[] {
    if (nativeScript === "Han" || nativeScript === "Hiragana" || nativeScript === "Katakana") return [];
    const occurrences = new Map<string, number>();
    const variants = new Map<string, Set<string>>();
    const words = new Map<string, Set<string>>();
    const nativeRe = SCRIPTS.find(([name]) => name === nativeScript)?.[1];
    for (const line of lines) {
        for (const m of line.matchAll(PROBE_WORD)) {
            const word = m[0];
            // A 40-character "word" is a run-on from a table or a missing space, not a probe.
            if (word.length > 40 || (nativeRe !== undefined && !majorityScript(word, nativeRe))) continue;
            for (const ch of word) {
                occurrences.set(ch, (occurrences.get(ch) ?? 0) + 1);
                // ⚠ CASE-FOLDED. ⟨H⟩ fires in an, ast, es, gl, it and oc while ⟨h⟩ does not, because ⟨ch⟩ is a
                // digraph those engines read: the capital happens to occur only in names. A letter's case
                // variants are the SAME LETTER, and one contributing variant claims it.
                const key = ch.toLowerCase();
                let vs = variants.get(key);
                if (vs === undefined) { vs = new Set(); variants.set(key, vs); }
                vs.add(ch);
                let ws = words.get(key);
                if (ws === undefined) { ws = new Set(); words.set(key, ws); }
                if (ws.size < 400) ws.add(word);
            }
        }
    }
    const total = [...occurrences.values()].reduce((a, b) => a + b, 0);
    const floor = Math.max(CORE_MIN, total * CORE_FLOOR);
    const core = new Set([...occurrences].filter(([, n]) => n >= floor).map(([c]) => c));
    const exempt = new Set([...(ORTHOGRAPHIC_SILENCE["*"] ?? []), ...(ORTHOGRAPHIC_SILENCE[lang] ?? [])]);

    const out: SilentChar[] = [];
    for (const [ch, ws] of words) {
        if (claimedByLeakClass(ch)) continue;
        const vs = [...(variants.get(ch) ?? new Set([ch]))];
        const strip = new RegExp(`[${vs.map(escapeChar).join("")}]`, "gu");
        const probes = spread(
            [...ws].filter((w) => w.replace(strip, "").length > 0 && [...w].every((c) => vs.includes(c) || core.has(c))),
            PROBE_WORDS,
        );
        let tested = 0, inert = 0, separator = 0, contributed = false;
        const examples: string[] = [];
        for (const word of probes) {
            const read = say(word);
            if (read === undefined || read.trim() === "") continue;
            tested++;
            const deleted = say(word.replace(strip, "")), spaced = say(word.replace(strip, " "));
            if (deleted === read) inert++;
            else if (spaced === read) separator++;
            else { contributed = true; break; }
            if (examples.length < 3) examples.push(`${word} → ${read}`);
        }
        if (contributed || tested < MIN_PROBE_WORDS) continue;
        out.push({
            ch,
            occurrences: vs.reduce((a, c) => a + (occurrences.get(c) ?? 0), 0),
            words: tested,
            mode: separator > inert ? "separator" : "inert",
            examples,
            orthographic: exempt.has(ch),
        });
    }
    return out.sort((a, b) => b.occurrences - a.occurrences);
}

/** Is this word mostly in the corpus's own script? A gloss or a foreign name is not evidence about it. */
function majorityScript(word: string, nativeRe: RegExp): boolean {
    let native = 0, other = 0;
    for (const ch of word) {
        if (nativeRe.test(ch)) native++;
        else if (SCRIPTS.some(([, re]) => re.test(ch))) other++;
    }
    return native > other;
}

/**
 * A DROP is a symbol that VANISHED — detected differentially: phonemize the sentence, then phonemize it again
 * with the symbol REPLACED BY A SPACE (see `withoutSymbol`; deleting it perturbs how its neighbours tokenize
 * and the test then credits the symbol for that), and compare. Identical readings prove it said nothing.
 *
 * Keep each pattern at its WIDEST form — `minus` has to include the EN DASH, because a corpus writes `–5` as
 * readily as `-5`.
 */
export const DROPPABLE: readonly (readonly [string, RegExp])[] = [
    // U+066A ٪ is the Arabic-script sign and U+FF05 ％ the fullwidth one — both are ordinary typography in
    // their scripts, and the tier already accepts them.
    ["percent", /[%‰٪％]/gu],
    ["currency", /\p{Sc}/gu],
    ["degree", /[°℃℉]/gu],
    // Only where a digit FOLLOWS and no letter/digit precedes, so a compound hyphen (`Il-76`, `COVID-19`) and
    // a range (`5-3`) are not mistaken for a negative. Probe forms never merge two digits, so `-`/`+` are
    // judged on `5-`/`-5` and not on `5-5` → `55`.
    //
    // ⚠ `\p{M}` IS IN THE GUARD, and leaving it out makes this class blind across every abugida in the fleet.
    // A Devanagari word usually ends in a MATRA, not a bare consonant: the character before the hyphen in
    // `फ़ॉर्मूला-1` is ा (U+093E, `Mn`), so `(?<!\p{L})` passes and the scan reports a DROP on Formula-1 — a
    // designation whose hyphen is correctly silent.
    //
    // ⚠ THE SECOND LOOKBEHIND EXCLUDES A RANGE, and without it this class measures almost nothing it claims
    // to: resolved per hit, the overwhelming majority of "dropped minus" reports are ranges (`(1418 -1450)`,
    // `1995 -96`), designations (`चंद्रयान -1`) and apposition dashes, against a bare handful of true
    // negatives across the whole fleet.
    // ⚠ THE WINDOW IS DELIBERATELY TIGHT — a digit, then at most an ordinal suffix or an abbreviating dot,
    // then at most one space — rather than "a digit somewhere behind". Widen it far enough to reach past two
    // abbreviations and it swallows `०.३७२७१९ ख॰इ॰), -२.८८ परिमाण`, an astronomical magnitude and a genuine
    // negative. Under-excluding a range is a stray report; over-excluding deletes a true positive.
    //
    // ⚠ A DESIGNATION AFTER A SPACE IS NOT DECIDABLE HERE and is deliberately still reported. `चंद्रयान -1`
    // and a real `-5 stupňů` are the same shape — word, space, dash, digit — so separating them needs a
    // lexicon, not a guard. Those hits want a per-language judgement; a quiet gate would be worse. They are
    // accepted BY IDENTITY instead, in `ACCEPTED_SILENT` below.
    ["minus", /(?<![\p{L}\p{M}\p{Nd}])(?<!\p{Nd}[\p{L}\p{M}]{0,2}[.,]?[ \t]?)[-−–](?=\p{Nd})/gu],
    ["math-sign", /[+±×÷=<>]/gu],
    /**
     * ⚠ A SUPERSCRIPT WITH NOTHING BEFORE IT IS NOT AN EXPONENT. `⁸C` is an ISOTOPE MASS NUMBER — the
     * superscript precedes the element symbol — and `³He` the same; no language reads either as a power, and
     * `normalizeSymbols.ts` is right not to (its own `BARE_EXPONENT` requires a base BEFORE the run). A bare
     * `/[²³⁰¹⁴-⁹]/gu` reports a dropped exponent for text the reader is correct to leave alone.
     *
     * A LOOKBEHIND, not a captured base, because the scan needs the SIGN's own extent to test its removal.
     *
     * ⚠ IT MATCHES THE WHOLE RUN AND ALLOWS A SPACE. A superscript digit is `\p{No}`, not `\p{Nd}`, so a
     * per-character pattern anchored on a base matches only the FIRST superscript of `10¹⁵` and silently
     * shortens the sign's extent; and corpora write the sign spaced (`0,5 ² км`, `16000km ² `), which
     * `normalizeSymbols.ts` reads via its own `\s?`.
     *
     * ⚠ AND THE RUN INCLUDES THE SUPERSCRIPT MINUS, because `kg⁻²` is a real exponent whose run begins with
     * it. Leaving it out truncates every negative exponent to the digits after the sign.
     *
     * ⚠ A TRAILING LETTER IS WHAT ACTUALLY IDENTIFIES ISOTOPE NOTATION, and the base test alone does not
     * catch it: allowing the space that real spaced exponents need also lets `is ⁸C` through, since a letter
     * and a space do precede that superscript. What no exponent does is run straight into a letter. A power
     * is terminal or followed by punctuation, a space, or an operator.
     *
     * ⚠ THE LOOKAHEAD MUST ALSO EXCLUDE A FOLLOWING SUPERSCRIPT, or BACKTRACKING defeats it. On `¹⁴C` the
     * engine matches the run `¹⁴`, fails the letter test on `C`, then backtracks to `¹` — where the next
     * character is `⁴`, not a letter, so the trimmed match succeeds and the isotope is flagged after all.
     * Forbidding a superscript after the run leaves nothing to backtrack into.
     */
    ["exponent", /(?<=[\p{L}\p{M}\p{Nd}][ \t]?)[²³⁰¹⁴-⁹⁻]+(?![\p{L}\p{M}²³⁰¹⁴-⁹⁻])/gu],
    ["ampersand", /[&＆]/gu],
    ["iteration", /[ๆ々〃ヽヾゝゞៗ]/gu],
];

/**
 * WORDS SOURCED FROM OUTSIDE THE CORPUS, each with its citation — the `sourcing` gate's escape hatch, and the
 * narrowest one in this file.
 *
 * ⚠ WHY THIS IS NEEDED AT ALL: A CORPUS CANNOT ATTEST HOW A SYMBOL IS SPOKEN. Writers type `2.5`; they do not
 * spell out how they say it. So a language's decimal word can score exactly zero against a half-million-line
 * wiki dump and still be in universal spoken use, and a gate satisfiable only by corpus hits pushes the layer
 * toward dropping the symbol — the worse outcome.
 *
 * ⚠ AND WHY IT IS NOT SIMPLY THE MANIFEST. A haystack that includes the language's own `.jsonc` is the file
 * the gate EXTRACTS its needles from, so every declared word attests itself and a substituted nonsense word
 * passes. A declaration cannot be its own evidence; a citation naming a source outside this repository can.
 *
 * ⚠ THE CITATION IS THE POINT, NOT THE EXEMPTION. Anything vague enough that a reader could not go and check
 * it ("a dictionary", "standard usage") is a TODO wearing a citation's clothes and must keep failing the
 * gate. Name the work, the headword and the sense.
 */
export const CITED_WORDS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
    ilo: {
        libra: "⚠ THE BARE WORD IS THE UNIT OF WEIGHT AND ONLY THE COLLOCATION IS THE CURRENCY — trap 37, "
            + "and this is Cebuano's `libra`/`pound` split arriving from the other side. Measured over the "
            + "mined ilowiki corpus (38,673 paragraphs): bare `libra` is x4 and THREE are avoirdupois — "
            + "`12,546 a kilo (27,659 a libra)` of milk, `114 a libra (51 kg)`. `attest.ts` against "
            + "ilo.wikipedia reproduces it independently: `libra` attested x5, and its examples are "
            + "`250 libra (110 kg)`, `76 libra kada kubiko kadapan (1.03 iti 1.22 kg/dm3)` and the same "
            + "`114 a libra` sentence. ⚠ SO WHAT IS DECLARED IS THE TWO-WORD KEY `libra esterlina`, whose "
            + "single attestation is a sentence listing the world's reserve currencies in Ilocano — "
            + "`maysa a reserba a kuarta kalpasan ti doliar ti Estados Unidos, ti euro ken ti libra "
            + "esterlina` — i.e. the currency, named beside the other two this layer reads. ⚠ AND THE "
            + "THINNESS IS STATED RATHER THAN HIDDEN: that is ONE instance, and the corpus hit and the "
            + "attest.ts hit are the SAME SENTENCE (ilo.wikipedia is the corpus). It is declared because "
            + "`libra esterlina` has no competing sense (`esterlina` occurs nowhere else in the language's "
            + "whole written record), because the five corpus pound signs are otherwise dropped outright, "
            + "and because there is no rival candidate anywhere. If a later run finds a second reading, "
            + "this is the entry to revisit.",
        esterlina: "The second half of the `libra esterlina` key — see `libra` above. x1 in the mined "
            + "ilowiki corpus and x1 in `attest.ts`, and they are the same sentence. It occurs in Ilocano "
            + "ONLY in that collocation, which is what makes the compound key unambiguous even at x1.",
    },
    hil: {
        porsiyento: "⚠ THE WORD IS ATTESTED IN THE CORPUS AND THE ARTIFACT CANNOT SHOW IT — a sampling "
            + "limit, not a sourcing gap, and worth stating precisely because the two look identical from "
            + "here. There is no hil.wikipedia (meta's sitematrix lists bcl/ceb/ilo/pag/pam/tl/war and no "
            + "hil site of any kind), so `attest.ts` cannot be run for this language at all and the whole "
            + "evidence base is the Wikimedia Incubator's Wp/hil — 3,799 paragraphs after "
            + "`filter-by-language.py`. In THAT text the percent word occurs twice, both times "
            + "DIGIT-ADJACENT, i.e. in the exact slot: `4.4 porsiyento ang ginasakup sang Panay` and "
            + "`23 porsyento sang mga nagaduaw diri naghalin`. Both sentences are unambiguously Hiligaynon "
            + "(ginasakup sang, kun sa diin, naghalin). The committed artifact is a 133-line adversarial "
            + "selection of those 3,799 and did not pick either paragraph — the `percent` cell selected the "
            + "one carrying the SIGN instead — so the gate reads a corpus that does contain the word "
            + "through a window that does not. ⚠ THE SPELLINGS TIE AT ×1 EACH and `porsiyento` is taken as "
            + "the fuller lemma; `porsyento` is its co-equal variant and is recorded in normalize.ts so "
            + "nobody re-derives this from a single hit. ⚠ AND THE WEB IS NOT THE CITATION HERE: searching "
            + "for this word returns almost entirely TAGALOG dictionaries, which is the exact substitution "
            + "this language's brief warns against, so they are not relied on. Kaufmann, *Visayan-English "
            + "Dictionary* (Iloilo, 1934) predates the loan and carries neither spelling — it gives the "
            + "NATIVE frame instead, s.v. `gatús`: \"Napúlò sa gatús. Ten per cent.\", which is a "
            + "construction (`N sa gatos`) and not a drop-in word for the sign.",
        punto: "Kaufmann, *Visayan-English Dictionary* (Iloilo, 1934; 23,557 entries), headword `púnto`: "
            + "\"(Sp. punto) Point, full stop, period; tone, tune, pitch, key, clef.\" — the PUNCTUATION "
            + "sense, given for Hiligaynon, in the standard reference for this language and independent of "
            + "both the corpus and the two referees. This is the trap the playbook records for Igbo's "
            + "`ǹtụ̀kpọ` and it lands the same way: a written corpus is the weakest evidence there is about "
            + "how a SYMBOL is spoken — writers type `302.18`, they never spell out how they would say it — "
            + "so the dictionary outranks the corpus silence. The corpus is not silent anyway, merely "
            + "oblique: its one `punto` is `ang pinakamataas nga punto sa Negros`, the highest POINT, the "
            + "same sense in a different application. ⚠ Cebuano ships the same word on the WEAKER argument "
            + "(inference from sense, its own `punto` instances being a point of exposure and sports "
            + "points); hil does not have to, and the difference is recorded so the two are not read as one "
            + "borrowing.",
        piso: "Corpus-attested ×6 including a MONETARY use — `ang suplay sang piso sa Pilipinas nag-abot "
            + "569.2 bilyon` — plus Kaufmann s.v. `gásto`: \"Gingastohán ko na sing duhá ka líbo ka PÍSOS "
            + "ang bág-o ko nga baláy\" (\"I have spent two thousand pesos on my new house\"), the currency "
            + "in a monetary amount. The corpus's single `₱` is a MENTION — `simbolo sang kurensiya: ₱; "
            + "kodigo: PHP` — which is why the artifact scan reports this class REDUNDANT rather than "
            + "dropped: that sentence names the currency in words either way. ⚠ `$` is deliberately NOT "
            + "declared beside it: `$` is ×0 in the corpus and `dolyar`/`dolar` are ×0 in the corpus, ×0 in "
            + "Kaufmann and ×0 in both referees, so Cebuano's `$`→`dolyar` (which has ×4 corpus dollars "
            + "behind it) does not transfer.",
    },
    cdo: {
        "báh-hŭng-cĭ": "⚠ THE FOURTH SINITIC LECT WHOSE PERCENT WORD THE GATE CANNOT SEE, AND THE FIRST FOR "
            + "WHICH THE WORD DOES NOT EXIST IN WRITING AT ALL. cjy, hak and nan each had the gate look in "
            + "the wrong orthography; cdo's corpus IS the orthography the layer emits (cdo.wikipedia is "
            + "written in Bàng-uâ-cê) and a BUC percent word is absent from it anyway. Measured, and every "
            + "one of these is a zero: `attest.ts` → `báh-hŭng-cĭ` 0 tokens / 0 substring; CirrusSearch "
            + "`insource:/hŭng-cĭ/` 0, `/báh-hŭng/` 0, `/báik-hŭng/` 0, `/báh-hŭng-bī/` 0. `insource:/百分/` "
            + "returns exactly ONE hit and it is quoted PRC labour law in MANDARIN inside the 996工作制 "
            + "article (`支付無低過工資其百分一百五其工資報酬`) — playbook trap 34, in the one place a grep "
            + "would take it as evidence. So this is COMPOSED FROM ATTESTED PIECES, the Fula `e teemedere` "
            + "move, on four legs. (1) THE CONSTRUCTION IS ATTESTED FOR cdo: 分之 occurs ×2 on "
            + "cdo.wikipedia — 四分之一 in 艦隊收藏 and 七分之一弧秒 in 分點 — in Han, in the fraction slot, "
            + "denominator-first, which is what makes 百分之 'of a hundred parts' rather than a borrowing. "
            + "(2) 分 IS `hŭng` IN A NUMERIC CONTEXT BY cdo's OWN HAND: the Bìng-tàng article spells a "
            + "coordinate out as `25 dô 16 hŭng gáu 25 dô 44 hŭng` — 分 as the arc-minute. Wiktionary's "
            + "Eastern Min entry gives \"buŏng - vernacular; hŭng - literary\", and this is the literary "
            + "slot. `attest.ts`: hŭng attested 62 tokens / 20 articles. (3) 之 IS `cĭ` (Wiktionary), ×40 "
            + "whole-word in cdo's own corpus (cĭ-găng, cĭ-ék, cĭ-hâiu). (4) 百 IS `báh`: Wiktionary's "
            + "Eastern Min entry says \"báh - vernacular ('hundred'); báik - literary ('numerous')\", and "
            + "cdo.wikipedia's BUC prose writes it ×20 as the number (`gūi báh nièng`, `siŏh báh gūi "
            + "cṳ̄ng`, `báh nièng hâu-kéng`). ⚠ THE DISAGREEMENT THIS LEG EXPOSED IS NOW SETTLED, and the "
            + "record is kept because the leg is what found it: mindong.ts's compositor read 百 as ⟨báik⟩ "
            + "from the Wikivoyage phrasebook, so the engine and this word disagreed about the same "
            + "character — the engine read 百 two ways depending on which path reached it. Measured "
            + "separately (a0bc243): Wiktionary assigns the counting sense to the vernacular `báh` and gives "
            + "`báik` the distinct sense 'numerous'; cdo.wikipedia's number articles carry the recorded "
            + "AUDIO on `siŏh báh` with `siŏh báik` only a parenthesised alternate; `insource:` runs 14:2 "
            + "for báh, and both apparent counter-hits are false (a film title, and 八萬). The compositor "
            + "now reads `báh`; 八 keeps `báik`. ⚠ AND `hŭng-cĭ` ALONE IS THE SAME WORD MINUS ITS FIRST "
            + "SYLLABLE, used by the fraction rule, on legs (1)–(3); it is `absent` in the same probe.",
    },
    cjy: {
        "百分之": "⚠ THERE IS NO JIN CORPUS TO ATTEST ANYTHING IN — no cjy.wikipedia exists, and the "
            + "Wikimedia Incubator's Wp/cjy holds 3,060 Han characters whose artifact covers 7 of 35 cells "
            + "with `percent` among the EMPTY ones. So this rests on two other legs. (1) IT SPEAKS, which is "
            + "the gate that matters for this engine: 百 分 之 are all in the shipped Wiktionary/kaikki "
            + "Taiyuan dict, so 百分之 reads pai˥˧ fəŋ˩˩ t͡sz̩˩˩ — where ⟨度⟩ and ⟨摄氏⟩ are SILENT and were "
            + "refused for exactly that reason. (2) IT IS THE PAN-SINITIC WRITTEN FORM, not a dialect "
            + "vocabulary choice: 百分之 is corpus-verified in the cmn, yue and wuu layers already shipped, "
            + "each against its own corpus, and Jin is written in the same Han orthography. The genuinely "
            + "dialectal choices in this layer — the ampersand and the range word — were NOT inferred this "
            + "way; they come from the incubator text (和 ×16 coordinating, 到 ×5).",
    },
    hak: {
        "百分之": "⚠ THE GATE CANNOT SEE THIS WORD BECAUSE THE CORPUS IS IN THE OTHER ORTHOGRAPHY — the same "
            + "shape as nan, and for a stronger reason here: hak.wikipedia is written in Pha̍k-fa-sṳ and "
            + "**93.5% of its characters are Latin**, so a HAN spelling scores zero there by construction. "
            + "The romanization attests it directly. (1) THE WHOLE WORD, ONCE: `Sîn Nò-vî-ngî pûn sṳ́-yung "
            + "yî chhû-kiê sû-siá tha̍t-tó pak-fûn-chṳ̂-sṳ̍p-ńg` — 百分之十五, 15%, the percent word in a "
            + "percentage. (2) ITS SECOND HALF, ×39, IN EXACTLY THE CONSTRUCTION THE FRACTION RULE NEEDS: "
            + "`sâm-fûn-chṳ̂-ngi` (三分之二 = 2/3), `si-fûn-chṳ̂-yit` (四分之一), `ńg-fûn-chṳ̂-yit` (五分之一) "
            + "— denominator first, which is what makes 百分之 'of a hundred parts' rather than a borrowing. "
            + "(3) IT SPEAKS, which is this engine's hard gate: 百 分 之 are each dict keys, so 百分之 reads "
            + "pak̚¹ pun⁴⁴ t͡sz̩⁴⁴ — where ⟨度⟩ did NOT speak and had to be sourced as a derived entry before "
            + "the degree rule could exist at all.",
    },
    nan: {
        "百分之": "⚠ THE GATE CANNOT SEE THIS WORD BECAUSE THE CORPUS IS IN THE OTHER ORTHOGRAPHY. "
            + "nan.wikipedia is written in POJ, so a HAN spelling scores zero there by construction — and "
            + "this layer sources its words from POJ prose but EMITS them in Han, because the POJ forms leak "
            + "ASCII through the converter (`hun chi` → *hun chi˥*, the 之 syllable unmapped) while the Han "
            + "forms read cleanly. Two independent legs hold it up. (1) THE CONSTRUCTION IS CORPUS-ATTESTED: "
            + "百分之 is 百 + 分之, and the corpus writes `Tē-kiû ê gō͘ hun chi it` (1/5), `7 hun chi 1`, and "
            + "`1-pah-bān-hun chi it` — the same construction with a magnitude prefix, which is exactly what "
            + "百分之 is. (2) THE HAN SPELLING IS VALIDATED BY THE SHIPPED MOE DICTIONARY (Taiwan Ministry of "
            + "Education Taiwanese dictionary, via dict.tsv): 分之 reads hun-t͡ɕi and 百分之 reads paʔ-hun-t͡ɕi, "
            + "the POJ word's own reading. The same two-step is confirmed outright elsewhere — nan.wikipedia "
            + "glosses `Kong-lí ta̍k tiám-cheng (公里逐點鐘)`, pairing the POJ and Han spellings in one line.",
    },
    ig: {
        // Igbo has NO independent referee (wikipron ibo_latn, epitran ibo-Latn, kaikki: all 404), so a
        // non-corpus tier is the only tier it has beyond the corpus itself.
        "ntụkpọ": "Nkọwa okwu (nkowaokwu.com), an Igbo dictionary published by a 501(c)(3) nonprofit: "
            + "`ǹtụ̀kpọ`, n. 'decimal point; decimal number', with the definitional example "
            + "\"E ji ntụkpọ ekewapụ nọmba nnuzuroke na nọmba ọgwa\" — 'ntụkpọ is used to separate whole "
            + "numbers from fractions'. Corpus evidence is ZERO and that is expected: 0 hits for the word and "
            + "every variant, 0 digit-point-digit instances, and the 89 whole-word `point` hits are all English "
            + "text inside the Igbo wiki. Shipped untoned, matching the dictionary's own running-text examples "
            + "and the register of every other word the layer emits (pasent, naira, dollar)",
    },
};

/**
 * SIGN CLASSES A LANGUAGE IS INTENTIONALLY SILENT ON — the synthetic-probe counterpart of `ACCEPTED_SILENT`
 * below, and the difference between the two matters.
 *
 * `ACCEPTED_SILENT` names CORPUS LINES: this exact sentence's hyphen is a designation, so the drop is
 * correct. This names a whole CLASS for a language: no reading of this sign is shippable here at all, so a
 * synthetic probe (`-5`, `+5`) will always report DROPPED and always be right to.
 *
 * ⚠ WHY IT EXISTS RATHER THAN JUST LETTING THE GATE FAIL. A hard fail that can never be fixed is noise, and a
 * permanently red line says nothing about whether anything has REGRESSED.
 *
 * ⚠ AND IT IS DELIBERATELY SHORT. Only a class whose refusal is ARGUED IN THE LANGUAGE'S OWN FILE belongs
 * here; "no rule yet" is a TODO and must keep failing. Adding a real gap here to quiet the gate is exactly
 * the wrong use of it — and a long block is a smell, since the two highest-frequency entries this file ever
 * carried both turned out to be wrong refusals.
 *
 * The reason string is printed by both tools, so the justification travels with the exemption.
 */
export const ACCEPTED_SIGN_SILENCE: Readonly<Record<string, Readonly<Record<string, string>>>> = {
    tt: {
        // ⚠ FOUR REFUSALS, each a measurement over the retained text of `tools/corpus/mined/tt.jsonc`
        // (457 segments of a 1,014,015-paragraph tt.wikipedia dump), and each argued in
        // src/languages/tatar/normalize.ts. The `equals` one is the interesting entry: the sign is
        // COMMON here and almost never arithmetic.
        equals: "measured: `=` \u00d713 and TWELVE are a GLOSS SEPARATOR, not an equation \u2014 an "
            + "etymology (`aba=\u00abölkän ir tuğan, abí\u00bb`, `bik=\u00abnıq\u00bb`), a translation "
            + "glossary (`Cömratül-ğäqäbä (\u2026) = Zur bağana` and three more in the same list), and an "
            + "Arabic ligature (`\u0623\u064e + \u0627 = \u0622`). The ONE arithmetic instance is "
            + "`29+191/360=29.5305555`, so the rule that ships is DIGIT-GATED and reads exactly that one; "
            + "`тигез` is attested (\u00d7many, beside its own formula \u201c1000 м \u00d7 1000 м = "
            + "1 000 000 м\u00b2 га тигез\u201d) and would have been wrong on 12 of 13 without the gate",
        "less-than": "measured: `<` \u00d70 in the retained text \u2014 the sign does not occur",
        "greater-than": "measured: `>` \u00d70 in the retained text \u2014 the sign does not occur",
        divide: "measured: `\u00f7` \u00d70 in the retained text \u2014 the sign does not occur; division "
            + "is written with the slash, and every `\\d+/\\d+` in this corpus is a document number "
            + "(`ПБУ 19/02`), a street address (`Октябрьский городок, 1/66`) or an academic year "
            + "(`2010/11 уку елында`), so no fraction rule is written either",
    },
    chv: {
        // \u26a0 FIVE REFUSALS over the retained text of `tools/corpus/mined/chv.jsonc` (454 segments of a
        // 232,373-paragraph cv.wikipedia dump), each argued in src/languages/chuvash/normalize.ts. The
        // `equals` entry is a THIRD distinct non-equation sense of the sign in this sweep.
        equals: "measured: `=` \u00d714 and TEN are the ISBD PARALLEL-TITLE MARK of a library catalogue entry "
            + "\u2014 `Хал\u0103х шкул\u0115 = Народная школа` (\u00d74), `Tšuvassilais-suomalainen sanakirja = "
            + "Ч\u0103вашла-финла словарь`, `Reverse dictionary of Chuvash. = Обратный словарь` \u2014 plus one raw "
            + "LaTeX fragment. Three ARE equations (`1 мм\u00b2=0,000 001 м\u00b2`, `1 километр = 1000 метр`, "
            + "`\\pi = 3,1415926`). \u26a0 AND THE WORD IS THE SECOND REASON: `тан` is attested as \u201cequal\u201d but "
            + "POSTPOSITIONALLY (\u201cабсолютл\u0103 нул\u0115пе п\u0115р тан\u201d), and the tier can only place a connective "
            + "BETWEEN the operands \u2014 so even the three real ones could not be read correctly here. "
            + "gd's `=` was wiki headings and tt's was etymology glosses; this is a third sense",
        times: "measured: `\u00d7` \u00d70 in the retained text, and the candidate word is a Fula `tere` trap: `хут` "
            + "\u00d778 is PAPER in every attestation (\u201cХут \u2014 \u00e7ул\u00e7\u0103 ев\u0115р целлюлозăран хат\u0115рлесе тун\u0103 "
            + "\u00e7ыру материал\u0115\u201d). The frequency word is `хутчен` (\u201cт\u0103ватт\u0103 хутчен Совет Союз\u0115н "
            + "Патт\u0103р\u0115\u201d) \u2014 \u201con four occasions\u201d, not an arithmetic product",
        "plus-minus": "measured: `\u00b1` \u00d70 in the retained text \u2014 the sign does not occur",
        "less-than": "measured: `<` \u00d70 in the retained text \u2014 the sign does not occur",
        "greater-than": "measured: `>` \u00d70 in the retained text \u2014 the sign does not occur",
        divide: "measured: `\u00f7` \u00d70 in the retained text. The slash IS used for fractions and a rule is "
            + "written for them, but only where the noun `пай` follows \u2014 six of the nine slashes are a "
            + "Pi-day date, a year span (`1608/09`), two street addresses and a citation",
    },
    tk: {
        // \u26a0 SIX REFUSALS over the retained text of `tools/corpus/mined/tk.jsonc` (430 segments of a
        // 28,836-paragraph tk.wikipedia dump), each argued in src/languages/turkmen/normalize.ts. The
        // `times` entry is the interesting one: the sign is COMMON here and it is not arithmetic.
        times: "measured: `\u00d7` \u00d711 and every one is a BRICK DIMENSION in an archaeology article \u2014 "
            + "`31\u00d731\u00d77 sm`, `27\u00d727\u00d75 sm`, `23\u00d725\u00d76 sm`, `340\u00d7560 metr`, `26,5 \u00d7?\u00d75 sm` \u2014 a "
            + "three-term size specification, not a product. The Turkmen word for a multiplicative fold is "
            + "`esse` \u00d741, but no source in this corpus reads a DIMENSION with it, and emitting a product "
            + "word between the three terms of a brick's measurements would be confidently wrong \u00d711",
        equals: "measured: `=` \u00d713 and only ONE is prose arithmetic (`859+4050 = 4909`). The rest are a "
            + "TYPO for a hyphen (`1963=nji \u00fdyly\u0148`), raw LaTeX (`I = \\int_0^\\infty f(x)`), a unit-"
            + "equivalence chain (`1 uzel=sagatda 1 de\u0148iz mili=1,852 km/sag`), a byte-size table "
            + "(`1 Kba\u00fdt = 210 ba\u00fdt = 1 024 ba\u00fdt`, \u00d74) and a Quran citation in Russian and Arabic",
        divide: "measured: `\u00f7` \u00d70 in the retained text. The slash IS used for fractions and a rule is "
            + "written for them, but bounded: this corpus writes the Turkic DENOMINATOR-FIRST order "
            + "(`10/1 b\u00f6legini` = one tenth) and the ordinary order (`3/4`, `1/9`, `1/8`) in the same 430 "
            + "segments, and the only separator is that every reversed instance has numerator > denominator",
        "plus-minus": "measured: `\u00b1` \u00d70 in the retained text \u2014 the sign does not occur",
        "less-than": "measured: `<` \u00d70 in the retained text \u2014 the sign does not occur",
        "greater-than": "measured: `>` \u00d71 and it is a TYPO inside `immunizasiyany\u0148 ge\u00e7irmegine gar\u015f> "
            + "g\u00f6rk`, where the writer meant `\u015f`. Zero occur as a comparison",
    },
    shn: {
        // \u26a0 SIX REFUSALS over the retained text of `tools/corpus/mined/shn.jsonc` (407 segments of a
        // 43,435-paragraph shn.wikipedia dump), argued in src/languages/shan/normalize.ts. Two of them are
        // signs used for something no other language in this sweep used them for.
        percent: "measured: `%` \u00d715 and the class is REAL \u2014 but no readable Shan word for it exists. The "
            + "obvious compound `\u1050\u1030\u101d\u103a\u1015\u1062\u1000\u103a\u1087` (\u201chead-hundred\u201d) is the word for CENTURY, and this corpus "
            + "glosses it in English to prove it: \u201c\u1015\u102e\u1050\u1030\u101d\u103a\u1015\u1062\u1000\u103a\u1087 15 (15th Century AD)\u201d, \u201c\u1015\u102e\u1050\u1030\u101d\u103a\u1015\u1062\u1000\u103a\u1087 6 "
            + "(6th Century AD)\u201d. Two other candidates score 0 and a third came back with no readable "
            + "example \u2014 which in an UNSPACED script is not evidence, as attest.ts says itself",
        equals: "measured: `=` \u00d723 and every one is a PALI GLOSS SEPARATOR in the Buddhist-canon articles, "
            + "which gloss a Pali term against its Shan meaning \u2014 `\u101e\u1031\u101b\u102d\u101d\u101d\u102c\u1066\u102d\u1aa1=\u1000\u1030\u1075\u103a\u1038\u1075\u103c\u103a\u1019\u1062\u1000\u103a\u1087\u1015\u103d\u103c\u1038\u1010\u102e\u1038`, "
            + "`\u1015\u1075\u1011\u1000=\u1000\u1031\u102c\u1103\u103a\u1000\u102d\u1030\u1010\u103a\u1087\u1078\u103d\u1019\u103a\u1038\u1010\u1062\u1004\u103a\u1038`, `\u113b\u1031\u101d\u1aae\u1019\u103a\u1019=\u1010\u103c\u1062\u1038\u107d\u102e`. ZERO are equations. gd's `=` was wiki headings, tt's "
            + "etymology glosses, chv's a library catalogue's parallel titles \u2014 this is a fourth sense",
        "greater-than": "measured: `>` \u00d710 and every one is a SOUND-CHANGE ARROW in the historical-"
            + "linguistics prose \u2014 `\u101e\u103b\u103c\u102c\u1087\u1019 > \u101e\u103b\u1062\u1019\u103a\u1087 > \u101e\u103b\u1062\u1019\u103a\u1038 (Shan)`, `Rhwam > Yhwam > Hyam > Cyam > "
            + "Sham > Shan`. Zero are comparisons",
        "less-than": "measured: `<` \u00d70 in the retained text \u2014 the sign does not occur",
        times: "measured: `\u00d7` \u00d70 in the retained text \u2014 the sign does not occur",
        minus: "measured: `-` before a digit \u00d719 and NOT ONE IS A NEGATIVE. They are ranges "
            + "(`33-38\u00b0N`, `17 -18`), a timezone offset (`UTC -12`), a LABEL SEPARATOR in census figures "
            + "(`\u1078\u1062\u103b\u1038-1,226\u104a \u101a\u102d\u1004\u103a\u1038-1,316` \u2014 \u201cmale-1,226, female-1,316\u201d) and a level marker "
            + "(`\u1078\u1075\u1010\u103a\u1087-5`, `\u1010\u1015\u103a\u1019\u101f\u102c-\u1046`). The range rule requires a DIGIT before the hyphen, so the "
            + "label and level forms are untouched; no minus word is needed or attested",
        plus: "measured: `+` \u00d72 and both are a TIMEZONE OFFSET (`UTC +12`, `UTC +6:30`), not an addition",
        "plus-minus": "measured: `\u00b1` \u00d71 (`4.5672 \u00b1 0.0006 \u103f\u102e\u1087\u101c\u102e\u1087\u101a\u1062\u1071\u103a\u1087\u1015\u102e`). No Shan reading is attested, and "
            + "dropping it ran the value and its tolerance together into one ten-digit string \u2014 so it takes "
            + "a PAUSE, which keeps them apart and invents nothing",
        exponent: "measured: `\u00b2` \u00d72 (`2.5 \u1075\u1019\u00b2`, `7770 km\u00b2`) and no Shan measure word for a squared "
            + "unit is attested. `exponentWords` is undeclared, so the tier emits the unit and hands the "
            + "superscript back where the leak gate can see it \u2014 a visible missing WORD rather than an "
            + "invisible missing reading",
        divide: "measured: `\u00f7` \u00d70. The slash IS used, and it is a D/M/Y DATE (`10/1/1990`, `9-18/5/1962`) "
            + "or a paired measurement (`2299/925 \u101c\u1000\u103a\u1038`), never a fraction \u2014 so it takes a pause and no "
            + "fraction rule is written at all",
    },
    hyw: {
        // \u26a0 FOUR REFUSALS over the retained text of `tools/corpus/mined/hyw.jsonc` (444 segments of a
        // 140,044-paragraph hyw.wikipedia dump), argued in src/languages/westarmenian/normalize.ts.
        // `equals` is NOT among them \u2014 this language is the counter-example to trap 62, and its 44 `=`
        // are mostly real arithmetic from the number-theory articles, so a digit-gated rule ships.
        times: "measured: `\u00d7` \u00d76 across THREE different senses \u2014 two are AMMUNITION CALIBRES "
            + "(`7.92\u00d733mm Kurz`, `7.62\u00d739mm M43`), two are SCIENTIFIC NOTATION (`4\u00d710\u00b9\u2070`, "
            + "`7.8\u00b10.9\u00d710\u00b9\u2070`) and two are a product (`105=3 \u00d7 5 \u00d7 7`). No single word reads all three, "
            + "and a calibre read as a multiplication is a defect that produces a READING (trap 56)",
        divide: "measured: `\u00f7` \u00d72 and NEITHER is a division \u2014 one is a RANGE in the Russian tradition "
            + "(`0.96\u00f71.41 \u0531\u0544 \u0570\u0565\u057c\u0561\u0582\u0578\u0580\u0578\u0582\u0569\u0565\u0561\u0576`, the same finding ba recorded) and the other is an ALBUM "
            + "TITLE (`2017-\u056b \u0561\u056c\u057a\u0578\u0574\u056b\u0576\u055d \u00f7`, Ed Sheeran's). The range sense takes a pause; the album keeps the sign",
        "plus-minus": "measured: `\u00b1` \u00d73 and all three are a TOLERANCE (`3800\u00b1200\u00b0C-\u056b\u0576`, `\u03c1 =1260\u00b170 \u0584\u056f/\u0574\u00b3`, "
            + "`7.8\u00b10.9\u00d710\u00b9\u2070`). No Western Armenian reading is attested and dropping the sign ran the two "
            + "figures together into one numeral, so it takes a PAUSE",
        "less-than": "measured: `<` \u00d70 in the retained text \u2014 the sign does not occur",
        "greater-than": "measured: `>` \u00d70 in the retained text \u2014 the sign does not occur",
        equals: "the `=` IS read \u2014 44 instances, mostly real arithmetic, and the rule ships DIGIT-GATED "
            + "with `\u0570\u0561\u0582\u0561\u057d\u0561\u0580`. This entry covers the probe's LETTER form (`x = y`): the gate is only "
            + "reachable between digits, because the sign's other use here is a variable assignment in a "
            + "physics gloss (`\u03c1 =1260\u00b170 \u0584\u056f/\u0574\u00b3`) where the reading would be wrong",
        plus: "measured: `+` \u00d7several and every one is inside an ARITHMETIC IDENTITY already carried by "
            + "the `=` rule (`100=47+53`, `1\u00b3 + 2\u00b3 + 3\u00b3 + 4\u00b3`) or an English album title (`I Am the Dance "
            + "Commander + I Command You to Dance`). Omitting a summation plus is lossless where omitting "
            + "a MINUS inverts \u2014 the minus is read, the plus is not, the same call hy makes",
        ampersand: "measured: `&` \u00d72 and both sit inside a LATIN run (`$350& \u0574\u056c\u0576`, a dump-extraction "
            + "artifact, and an English genre list), which reaches the engine through the Latin-run router "
            + "and is read as English \u2014 so the reading is not Armenian's to supply",
        exponent: "measured: `\u00b2\u00b3` on a declared unit are read; the residual 18 are a SUPERSCRIPT RUN no "
            + "measure word reaches \u2014 an isotope mass number (`\u00b9\u2074\u2077Pm`), scientific notation (`10\u00b9\u2070`), a "
            + "number-theory identity (`1\u00b3 + 2\u00b3 + 3\u00b3 + 4\u00b3`, `144\u2075=27\u2075+84\u2075+110`) and a bracketed square "
            + "(`(1 + 2 + 3 + 4)\u00b2`). `bareExponent` would need a power phrase this corpus does not supply",
    },
    la: {
        // \u26a0 SIX REFUSALS over the retained text of `tools/corpus/mined/la.jsonc` (461 segments of a
        // 557,823-paragraph la.wikipedia dump), argued in src/languages/latin/normalize.ts. Unlike every
        // other entry in this table, the signs here are REAL \u2014 la.wikipedia has articles on arithmetic
        // written in Latin \u2014 and the blocker is AGREEMENT, not sense.
        equals: "measured: `=` is contentful and dense (`6/3 = 2`, `73 = 5 \u00d7 14 + 3`, "
            + "`1/2 = 2/4 = 3/6 = 4/8 = 5/10`) \u2014 hyw's counter-example to trap 62 repeated. `aequat` is "
            + "attested \u00d725, but the corpus's own arithmetic article writes its prose AROUND the signs and "
            + "never spells one out, and a Latin verb dropped between two operands this layer also cannot "
            + "decline is two guesses stacked. The sign stays visible to the leak gates",
        times: "measured: `\u00d7` occurs in the same arithmetic identities (`73 = 5 \u00d7 14 + 3`, "
            + "`232.3\u00b2 = 232.3 \u00d7 232.3`). `multiplicatum` \u00d74 is attested but takes `per` plus the "
            + "ABLATIVE of its operand, which this layer cannot supply \u2014 the same agreement wall the "
            + "Roman-ordinal refusal rests on",
        divide: "measured: `\u00f7` \u00d70; the DIVISION is written with a slash (`6/3 = 2`) and the same slash is "
            + "also the FRACTION (`1/2 est reducta`, `1/3 = 2/6 = 3/9 = 4/12`) in the same paragraph. "
            + "Nothing distinguishes them but the surrounding prose, and `divisum` takes the ablative too",
        "greater-than": "measured: `>` \u00d71 and it IS a comparison (`si summa > 11 sit`) \u2014 the first real "
            + "one in this sweep, gd's and shn's having been LaTeX and a sound-change arrow. `maius` \u00d730 "
            + "is attested and governs `quam` plus a nominative; one instance does not license the rule",
        "less-than": "measured: `<` \u00d70 in the retained text \u2014 the sign does not occur",
        "plus-minus": "measured: `\u00b1` \u00d70 in the retained text \u2014 the sign does not occur",
        plus: "measured: `+` appears only inside the arithmetic identities above, where the `=` refusal "
            + "already leaves the whole expression unread. Omitting a summation plus is lossless where "
            + "omitting a MINUS inverts \u2014 the minus is read, the plus is not",
        ampersand: "measured: the `ampersand` cell is **30,613 corpus-wide, the largest in the fleet, and it "
            + "is an HTML ENTITY** \u2014 `&nbsp;`, this corpus's THOUSANDS SEPARATOR (`1&nbsp;320&nbsp;000&nbsp;"
            + "000 km\u00b3`), which core/markup.ts folds before the layer runs. The BARE `&` is \u00d722 in the "
            + "retained text and none is Latin prose: English book titles (`Astronomy & Astrophysics`, "
            + "`Harper & Row`) and a French film title, all of which reach the engine through the Latin-run "
            + "router and are read in their own language. The two that ARE Latin are `&c.`, which IS read",
    },
    ast: {
        // \u26a0 FIVE REFUSALS over the retained text of `tools/corpus/mined/ast.jsonc` (460 segments of
        // the fleet's largest artifact, 1,343,097 paragraphs), argued in src/languages/asturian/normalize.ts.
        // \u26a0 THE `\u00d70 IN PROSE` VERDICT SURVIVED THE FLEET SYMBOL AUDIT BUT ITS ENUMERATION DID NOT. The two
        // things this entry named as "the residual" (a LaTeX chemical equation and a PIE root) carry no `=`
        // at all \u2014 they are residuals of OTHER math signs. The eleven actual `=` are listed below, and six of
        // them are chart markup that was never mentioned.
        equals: "measured: `=` \u00d711 in the retained text and \u00d70 in Asturian prose. SIX ARE EASYTIMELINE "
            + "CHART DIRECTIVES the extraction did not strip (`PlotArea = left: 60 bottom: 30`, `PlotArea = "
            + "top:10 bottom:30`, `ScaleMajor = gridcolor:darkgrey increment:500`, `ScaleMajor = unit:year "
            + "increment:25 start:710`, `ScaleMinor = \u2026`, `ImageSize = width:800 height:auto`). Of the other "
            + "five, one is a CURRENCY CONVERSION quoted as a rate (`1\u20ac = 103,2 RSD`), one an ISBD "
            + "PARALLEL-TITLE mark in a bibliography, two are lexical/taxonomic glosses where `=` means "
            + "'that is' (`p\u00e1 (sustantivu = padre)`, `Saccopetalum Benn. = Miliusa Lesch.`) and one is an "
            + "algebra statement written between LETTERS, not numbers (`a\u00b7b = b\u00b7a`). No Asturian equals word "
            + "is attested digit-adjacent. \u26a0 Chart markup is a property of the MINING PIPELINE, not of this "
            + "language \u2014 the same directives recur in 24 other artifacts, an and oc among them",
        times: "measured: `\u00d7` \u00d70 in the retained text \u2014 the sign does not occur",
        divide: "measured: `\u00f7` \u00d70. The slash occurs and is NOT a fraction: `\u00ab\u00eda f\u00f3rmula dentaria I 3/3, "
            + "C 0-1/0-1, P 3-4/3 M 3/3\u00bb is a DENTAL FORMULA in the mammal articles \u2014 Roman-letter tooth "
            + "classes with slashed counts. A fraction rule lands on it, and so does a range rule",
        "less-than": "measured: `<` \u00d70 in the retained text \u2014 the sign does not occur",
        "greater-than": "measured: `>` \u00d70 in the retained text \u2014 the sign does not occur",
        "plus-minus": "measured: `\u00b1` \u00d70 in the retained text \u2014 the sign does not occur",
        plus: "measured: `+` \u00d71 and it is inside a LaTeX fragment the dump extraction left raw "
            + "(`2y^- + BiO^{-}_{3(s)}`). Zero occur as a signed number or an addition in Asturian prose; "
            + "the MINUS is read, because omitting it inverts, and omitting a plus does not",
        degrees: "the degree IS read \u2014 this entry covers the ONE residual, `1758 - James Monroe, 5\u00b0 "
            + "presidente de los Estaos Xun\u00edos`, where the DEGREE SIGN is used for an ORDINAL. This corpus "
            + "swaps `\u00b0` U+00B0 and `\u00ba` U+00BA in both directions (`23\u00baC` and `30\u00ba de media` are degrees "
            + "written with the ordinal indicator), so neither codepoint identifies the sense and the rule "
            + "keys on what FOLLOWS. Sixteen instances qualify as degrees; this one does not, and is left "
            + "unread rather than told to say *cinco graos presidente* (trap 56)",
    },
    oc: {
        // \u26a0 SIX REFUSALS over the retained text of `tools/corpus/mined/oc.jsonc` (453 segments of a
        // 393,961-paragraph oc.wikipedia dump), argued in src/languages/occitan/normalize.ts.
        "greater-than": "measured: `>` \u00d747 and ALL of them are ONE STRING \u2014 a TAXONOMIC RANK CHAIN "
            + "repeated down a mammal article's classification box: `Eucari\u00f2tas > Metazoaris > Cordats > "
            + "Craniats > vertebrats > Euteleost\u00f2ms > Mamif\u00e8rs > Euteriats > Carnivora > Fissipedia > "
            + "Canidae`. Zero are comparisons. That is a FIFTH distinct sense of this sign in the sweep: "
            + "gd's was a LaTeX fragment, tk's a typo for \u015f, shn's a SOUND-CHANGE ARROW, la's a genuine "
            + "comparison, and this is a rank separator",
        // \u26a0 THE OLD COUNT WAS \u00d71 AND THE TRUE COUNT IS \u00d715 \u2014 a fifteenfold undercount found by the fleet
        // symbol audit, which read every `=` in the retained text rather than the one the scan surfaced.
        // Three of the fifteen are chart markup that was never mentioned, and one IS digit-flanked, so the
        // old blanket "zero are equations" was too strong. The refusal still stands (no Occitan reading is
        // attested and fourteen of fifteen are not relations between numbers) but it is now argued honestly.
        equals: "measured: `=` \u00d715 in the retained text, and THREE ARE EASYTIMELINE CHART DIRECTIVES the "
            + "extraction did not strip (`PlotArea = left:50 bottom:30`, `ScaleMajor = gridcolor:darkgrey "
            + "increment:25000`, `ScaleMinor = \u2026`). Five more are ONE bibliographic segment repeated \u2014 the "
            + "ISBD parallel-title mark of a library catalogue entry. The rest are a raw LaTeX fragment "
            + "(`l'eq\u00fcacion \\ x^n +y^n = z^n`, Fermat's last theorem), a Greek ETYMOLOGY gloss "
            + "(`astronomia \u2026 (dau gr\u00e8c \u03b1\u03c3\u03c4\u03c1\u03bf\u03bd\u03bf\u03bc\u03af\u03b1 = \u03ac\u03c3\u03c4\u03c1\u03bf\u03bd + \u03bd\u03cc\u03bc\u03bf\u03c2)`), two DIALECT glosses where `=` means "
            + "'that is' (`en gascon, julh = junh`, `sarrar = barrar`), a definitional gloss of jihad and an "
            + "economics identity written between LETTERS (`la relacion Y = C + S`). \u26a0 EXACTLY ONE is "
            + "digit-flanked \u2014 a currency peg quoted as a rate, `1 \u20ac = 1,95583 nov\u00e8l lev` \u2014 and one instance "
            + "of a foreign-currency conversion is not enough to source an Occitan reading for the class. "
            + "\u26a0 Chart markup is a property of the MINING PIPELINE, not of this language \u2014 the same "
            + "directives recur in 24 other artifacts",
        "less-than": "measured: `<` \u00d70 in the retained text \u2014 the sign does not occur",
        times: "measured: `\u00d7` \u00d70 in the retained text \u2014 the sign does not occur",
        divide: "measured: `\u00f7` \u00d70 in the retained text \u2014 the sign does not occur",
        "plus-minus": "measured: `\u00b1` \u00d70 in the retained text \u2014 the sign does not occur",
        plus: "measured: `+` \u00d72 and both are a bibliographic FLORUIT marker (`Jean de Roquetaillade "
            + "(+ 1366 ca)`) and the LaTeX fragment above. Zero are additions; the MINUS is read, because "
            + "omitting it inverts",
    },
    fo: {
        // \u26a0 SIX REFUSALS over the retained text of `tools/corpus/mined/fo.jsonc` (452 segments of a
        // 52,355-paragraph fo.wikipedia dump), argued in src/languages/faroese/normalize.ts.
        equals: "measured: `=` \u00d70 in the retained text \u2014 the sign does not occur",
        times: "measured: `\u00d7` \u00d70 in the retained text \u2014 the sign does not occur",
        divide: "measured: `\u00f7` \u00d70 in the retained text \u2014 the sign does not occur",
        "less-than": "measured: `<` \u00d70 in the retained text \u2014 the sign does not occur",
        "greater-than": "measured: `>` \u00d70 in the retained text \u2014 the sign does not occur",
        "plus-minus": "measured: `\u00b1` \u00d70 in the retained text \u2014 the sign does not occur",
        plus: "measured: `+` \u00d70 as an addition. The `math-sign` residual is the FOOTBALL SCORE "
            + "(`EB/Streymur - FC Lusitans 5-1. M\u00e1lini: 1-0: \u2026, 2-0: \u2026`), where the hyphen separates "
            + "goals and is given a pause by the range rule. The MINUS is read, because omitting it "
            + "inverts and omitting a plus does not",
    },
    ltg: {
        // \u26a0 EIGHT REFUSALS over the retained text of `tools/corpus/mined/ltg.jsonc` (394 segments of a
        // 3,444-paragraph ltg.wikipedia dump), each argued in src/languages/latgalian/normalize.ts.
        // \u26a0 NO ARITHMETIC SIGN WORD IS SOURCEABLE AT ALL for this language: `m\u012bnuss`, `m\u012bnus`, `plyus`
        // and `dal\u012bts` are ALL \u00d70 on ltg.wikipedia, and the one `plus` \u00d71 sits inside an ENGLISH
        // sentence on the IT-glossary page (\u201ctranslates common terms of IT (plus some Wikipedia specific
        // ones) into Latgalian\u201d) while `plyusmuos` \u00d71 is *pl\u016bsma*, a FLOW. So the refusals below are a
        // vocabulary floor, not a set of independent judgements \u2014 except `equals`, which has a second and
        // stronger reason of its own.
        minus: "measured: `-` \u00d76 across THREE encodings \u2014 ASCII in `-7\u00b0C` and `sasamazynuos par -7%`, "
            + "U+2212 in `nu \u22123.5 \u00b0C soluos da \u22127.6 \u00b0C`, and EN DASH in `(\u201343 gradi C)` \u00d72 \u2014 and "
            + "\u26a0 THIS REFUSAL COSTS, exactly as haw's does: a minus INVERTS its operand, so Daugpils's "
            + "record low reads as +43 and the Estonian January means read as positive. There is no word "
            + "to read it with (see the header note above). \u26a0 AND THE EM DASH IS NOT A WAY ROUND IT: `\u2014` "
            + "is \u00d7169 here and is the COPULA standing in for the absent verb (`Bolvi () \u2014 m\u012bsts p\u016bstumu "
            + "Latgol\u0101`, `Golvysm\u012bsts \u2014 Santjago`), which is Karakalpak's finding arriving from the "
            + "other side; the ONE em dash that is a minus (`temperatura beja \u2014 43\u00b0 C`) cannot be "
            + "separated from the other 168. Registered with the price stated rather than papered over",
        plus: "measured: `+` \u00d75. Four are the temperature sign (`+17\u00b0C`, `+36\u00b0 C`, `(+36 gradi C)` "
            + "\u00d72) and the fifth is English text (`Baltic language + samogitian = bat-smg`). A plus does "
            + "not invert its operand \u2014 `+36\u00b0` and `36\u00b0` are the same temperature \u2014 so unlike the minus "
            + "above this silence is lossless",
        equals: "measured: `=` \u00d714 and ONE is arithmetic (`26*26=676`). Five are EASYTIMELINE CHART "
            + "MARKUP the extraction left in (`PlotArea = left:50 right:20`, `ScaleMajor = unit:year "
            + "increment:6000000`, `ScaleMinor = \u2026` \u00d73), two are formula assignments (`x = log(1)`, "
            + "`y = log(69971)`), one is an English sentence, three are CURRENCY EQUIVALENCES whose right "
            + "operand is a word (`1 eura (EUR) = apm\u0101ram 0,702804 latu (LVL)`, `1 lats (LVL) = "
            + "apm\u0101ram 1,422872 euru`) and two are GOTHIC NUMERAL GLOSSES (`\u2022\ud800\udf39\ud800\udf31\u2022 = 12`, "
            + "`\ud800\udf39\ud800\udf31 = 12`). A digit gate would take three of the fourteen. \u26a0 AND THE WORD IS THE "
            + "SECOND, INDEPENDENT REASON: `v\u012bnaids` \u00d73 is attested and is exactly \u2018equal\u2019, but it is an "
            + "ADJECTIVE that takes its complement with `ar` (\u201cteik v\u012bnaids ar breivuos kris\u0161onys "
            + "padreiz\u012bni\u201d), and the tier can only place a connective BETWEEN the operands \u2014 so even "
            + "those three could not be read correctly here. chv's `\u0442\u0430\u043d`, kaa's `te\u0144` and haw's "
            + "`huinahelu` are the same shape; this is the fourth",
        "greater-than": "measured: `>` \u00d74 and THREE ARE AN ARROW rather than a comparison \u2014 a "
            + "sound-change/derivation arrow (`\u201cder Baum\u201d (k\u016bks) -> \u201cdie B\u00e4ume\u201d (k\u016bki)`) and a "
            + "TERM-GLOSSARY mapping in the IT wordlist (`computer science: informatika > datorzineiba`, "
            + "\u00d72). The one real comparison is `Daugpi\u013cs dzeivuotuoju lelumam (>80%)`. `leluoks` \u00d77 is "
            + "attested as \u2018bigger\u2019 and takes `kai` for \u2018than\u2019 (`10\u201420 rei\u017eu leluoks kai st\u012bp\u0161onuos "
            + "iztvereiba`), but it is an ADJECTIVE agreeing with its subject, and here the sense is the "
            + "adverbial \u2018more than 80%\u2019 \u2014 one instance is not worth a confidently wrong agreement",
        "less-than": "measured: `<` \u00d71 and it is an ETYMOLOGY ARROW, not a comparison: `Aluviskuos "
            + "n\u016bs\u0101dys aba aluvejs (nu lati\u0146u alluvius < alluere \u2014 \u2018skoluot, skoluot\u012bs\u2019)`. Same "
            + "sense as shn's `>` sound-change arrow, in the sister sign",
        divide: "measured: `\u00f7` \u00d70 in the retained text \u2014 the sign does not occur, and `dalejums` "
            + "\u00d724/20, the obvious candidate, is the ADMINISTRATIVE division in every single example "
            + "(`Latvejis administrativais teritoriskais dalejums`, `N\u016bvodi i teritoriskuo dalejuma`). "
            + "The slash occurs \u00d712 and is a SEASON (`2003/2004 g. sezon\u0101`, \u00d77), a standard number "
            + "(`ISO 639/2`), a density denominator (`899 dzeiv/km\u00b2`) or a publisher mark (`P/s Latga\u013cu "
            + "izdevn\u012bceiba`), never a fraction, so no fraction rule is written either",
        "plus-minus": "measured: `\u00b1` \u00d70 in the retained text \u2014 the sign does not occur",
        currency: "measured: `$` \u00d70 in the retained text \u2014 the only currency sign this corpus writes is "
            + "`\u20ac`, once (`va\u013csteibys bud\u017eets tur \u20ac151 miljonu viersejumu`), and it IS read as "
            + "`eura`/`euru` (5 and 8 tokens over 2 articles each, from the euro's own ltg.wikipedia "
            + "article). `dolaru` \u00d73 is attested but only as the genitive plural of a currency this "
            + "corpus names in WORDS and never by its sign (`32,7 tri\u013cjonim ASV dolaru`), so declaring "
            + "the key would buy nothing and risk a wrong count form. The gate's probe is a bare `$5`",
    },
    haw: {
        // \u26a0 SEVEN REFUSALS over the retained text of `tools/corpus/mined/haw.jsonc` (423 segments of a
        // 7,735-paragraph haw.wikipedia dump), each argued in src/languages/hawaiian/normalize.ts.
        // \u26a0 THE CORPUS NAMES ALL FOUR ARITHMETIC SIGNS IN ONE SENTENCE, and that sentence is the reason
        // none of them is read: the names are NOUNS FOR THE OPERATIONS, not connectives.
        //
        //   "Ma ka makemakika, aia \u02bbeh\u0101 hana ma\u02bbamau: ka huinahelu (+), ka lawenahelu (\u2212),
        //    ka ho\u02bbonui (\u00d7), a me ka m\u0101hele (\u00f7)."
        //   \u2014 four common operations: ADDITION (+), SUBTRACTION (\u2212), MULTIPLICATION (\u00d7), DIVISION (\u00f7)
        //
        // *huinahelu* is \u2018addition\u2019, not \u2018plus\u2019; the tier can only place a connective BETWEEN
        // operands, so `4 huinahelu 5` would read *four addition five*. Same shape as chv\u0027s `\u0442\u0430\u043d`,
        // skr\u0027s `\u0628\u0631\u0627\u0628\u0631` and kaa\u0027s `te\u0148` \u2014 the fourth time in this sweep, and the first where
        // the corpus supplies the whole glossary at once.
        minus: "measured: `-` \u00d76, and \u26a0 THIS REFUSAL COSTS, unlike the plus refused in crh one round "
            + "earlier: a minus INVERTS its operand, so `-19.7\u02daC i -19.9\u02daC` (Eureka, Nunavut) reads as "
            + "POSITIVE nineteen degrees. There is no word to read it with. `maina` and `m\u012bnuke` are "
            + "ABSENT from haw.wikipedia; `koena` \u00d718 is \u2018the remainder/the rest of\u2019 in every example; "
            + "`emi` is the verb \u2018to decrease\u2019; and the integers article names the CLASS rather than the "
            + "sign (\u201cn\u0101 helu piha \u02bbi\u02bbo \u02bbole\u201d, non-positive integers), which is an adjectival phrase "
            + "the tier cannot place. Registered with the price stated rather than papered over",
        plus: "measured: `+` \u00d72. One is the arithmetic glossary above, which names the sign as "
            + "*huinahelu*, \u2018addition\u2019; the other is `+6` inside a machine-translated climate paragraph "
            + "whose surrounding prose is not Hawaiian. A plus does not invert its operand, so unlike the "
            + "minus this silence costs nothing",
        times: "measured: `\u00d7` \u00d72. One is the glossary (*ho\u02bbonui*, \u2018multiplication\u2019, a noun); the "
            + "other is a CARTRIDGE DESIGNATION \u2014 `n\u0101 p\u014dk\u0101 7.62\u00d739mm` in the Kalashnikov article, where "
            + "the sign is part of a name and not an operation at all",
        divide: "measured: `\u00f7` \u00d71 and it is the glossary entry itself (*m\u0101hele*, \u2018division\u2019). The "
            + "slash occurs separately and is a RATING (`me ka helu waena 8.6/10`) or an IP-address path; "
            + "no fraction rule is written",
        equals: "measured: `=` \u00d711 and TEN ARE EASYTIMELINE CHART MARKUP the extraction left in \u2014 "
            + "`PlotArea = left:50 right:20 top:25 bottom:30`, `ScaleMajor = unit:year increment:6000000`, "
            + "`TimeAxis = orientation:horizontal format:yyyy`, `ImageSize = width:640 height:auto`. The "
            + "eleventh is a run-together sentence (`\u02bbO death forever= Ballspielverein Borussia 09`). "
            + "\u26a0 THIRD LANGUAGE RUNNING for the EasyTimeline sense, after an and crh \u2014 chart markup is a "
            + "property of dump-sourced artifacts, not a quirk of one wiki",
        "less-than": "measured: `<` \u00d70 in the retained text \u2014 the sign does not occur",
        "greater-than": "measured: `>` \u00d70 in the retained text \u2014 the sign does not occur",
        "plus-minus": "measured: `\u00b1` \u00d70 in the retained text \u2014 the sign does not occur",
    },
    nci: {
        // \u26a0 ELEVEN REFUSALS over the retained text of `tools/corpus/mined/nci.jsonc` (410 unique
        // segments of a 3,135-paragraph nah.wikipedia dump), each argued in
        // src/languages/nahuatl/normalize.ts. This is the sweep's smallest corpus so far and every
        // instance of every sign below was read; the counts are exhaustive, not sampled.
        // \u26a0 THE WIKI IS FILED UNDER `nah`, NOT `nci` \u2014 the artifact's own provenance line says
        // `nci.wikipedia.org`, which does not resolve, so every attestation cited here was taken with
        // `attest.ts --lang nci --wiki nah`. Without it the tool returns a page of false absences and
        // every refusal below would have looked better-founded than it is.
        // \u26a0 AND THE ROUND'S GOVERNING FACT: THIS CORPUS WRITES ITS MEASURE WORDS IN SPANISH.
        // `kil\u00f3metros`, `metros`, `minutos`, `segundos`, `millones`, `mil`, `pesos`, `horas` are what
        // nah.wikipedia puts beside a figure; the Nahuatl nouns for them do not exist in running text.
        // So a refusal here is never "the language has no word" \u2014 it is "neither language's word is
        // attested in this slot", which is a stronger claim and the reason each entry names its probes.
        plus: "measured: `+` \u00d724 and TWENTY-TWO ARE A MORPHEME BOUNDARY inside nah.wikipedia's own "
            + "NUMERAL articles, which decompose a vigesimal word and then state its digits \u2014 "
            + "\u201cC\u0113mp\u014dhualom\u0113yi (c\u0113m + p\u014dhual + on + \u0113yi) \u012bt\u014dc\u0101 c\u0113 tlap\u014dhualli auh mohcuiloa \u201c23\u201d\u201d, "
            + "\u201cCaxt\u014dlonn\u0101hui (caxt\u014dl-li + on- + n\u0101hui) \u2026 \u201c19\u201d\u201d, \u201c\u014cmp\u014dhualmahtl\u0101ctli om\u014dme (\u014dm + p\u014dhual + "
            + "mahtl\u0101ctli + om + \u014dme) \u2026 \u201c52\u201d\u201d, across eight numeral stubs. Reading the sign turns a "
            + "morphological gloss into *c\u0113m plus p\u014dhual plus on plus \u0113yi* \u2014 a defect that produces a "
            + "READING and one this layer would have INTRODUCED. The other two are an imported Spanish "
            + "chemistry infobox (`Estados de oxidaci\u00f3n (\u00f3xido) +2`) and a decay-mode column "
            + "(`0,012% 8,125 h \u03b5 \u03b2 + 0,854`). Zero arithmetic plus signs in Nahuatl prose, and `m\u00e1s` "
            + "\u00d734 on nah.wikipedia is Spanish film titles (`M\u00e1s negro que la noche`) and the same grammar "
            + "table `menos` comes from",
        minus: "measured: `-` before a digit \u00d72, and \u26a0 THIS REFUSAL COSTS \u2014 `-1\u00b0 C` (the freezing "
            + "point, in the sand-filtration article) and `(-120\u00a0\u00b0C)` are TRUE NEGATIVES and a dropped "
            + "minus INVERTS them. There is nothing to read them with: `menos` \u00d721 on nah.wikipedia is "
            + "ENTIRELY INSIDE ONE SPANISH GRAMMAR TABLE in the Nahuatl-morphology article \u2014 \u201cNi- m\u00e1s el "
            + "verbo menos vocal larga final o vocal inicial opcional\u201d, repeated once per person and "
            + "voice \u2014 where it is the preposition *without* describing a morphological subtraction and "
            + "never stands before a number; `negativo` is \u00d70. \u26a0 The corpus also writes one of its "
            + "negatives with a LETTER O for the zero (`(-2O\u00b0C)`), which is a separate reason this class "
            + "cannot be repaired by a rule. Registered with the price stated rather than papered over",
        equals: "measured: `=` \u00d712 and ELEVEN ARE NOT EQUATIONS. Six are imported Spanish infobox "
            + "key=value rows (`TC= 647,096 K PC= 22,0664MPa d=322kg/m\u00b3`, twice); three are a calendar "
            + "table's LABEL column (`\u012apan helenotl\u0101cah: 2, a, 12, 24 = moch\u012bhualiztli: N\u0101hui "
            + "Tlap\u0113uhc\u0101y\u014dtl`, and the same shape for `yudiotl\u0101cah` and `n\u0101huatl\u0101cah`); two are a GREEK "
            + "GLOSS (`\u03b8\u03b1\u03bd\u03b1\u03c4\u03bf\u03c3=miquiztli, \u0395\u03c1\u03c9\u03c3=tlazohtlaliztli`). Exactly ONE is an equation, and it "
            + "defines a calendar unit rather than computing anything: `1 N\u0113mont\u0113mi = 5 nozo 6 T\u014dnalli`. "
            + "\u26a0 AND THE WORD FAILS ITS EXAMPLES TOO, which is the second leg: `igual` scores \u00d71 on "
            + "nah.wikipedia and the one hit is Spanish `Al igual que las versiones de Wikipedia que "
            + "existen en otros idiomas` \u2014 *just like*, not *equals*. A fifth distinct non-equation sense "
            + "for this sign in the sweep, after gd's wiki headings, tt's etymology glosses, chv's ISBD "
            + "parallel titles and ny/za's EasyTimeline markup",
        times: "measured: `\u00d7` \u00d74 and ALL FOUR ARE SCIENTIFIC NOTATION \u2014 `1.4\u00d710\u00b2\u00b9 kg` and `5.1\u00d710\u00b9\u2078 kg` "
            + "(the mass of the atmosphere and of the oceans, in Nahuatl prose), `1,67262 \u00d7 10\u201327 kg` and "
            + "`1,602 176 487(40) \u00d7 10-19 culombios` (the proton article's imported Spanish figures). The "
            + "corpus writes the same operation with ASCII `x` three more times, always inside the Spanish "
            + "infoboxes (`>1,2 x 10\u00b9\u2075 a`, `2,144 x10\u2076 a`, `7,61 x 10\u2076 m\u207b\u00b9\u00b7\u03a9\u207b\u00b9`). No language reads "
            + "scientific notation in this fleet, and `veces` is \u00d70 on nah.wikipedia besides",
        divide: "measured: `\u00f7` \u00d70 in the retained text \u2014 the sign does not occur. The slash occurs and is "
            + "not a division either: `4970 m/s` and `322kg/m\u00b3` are rates in Spanish infoboxes, "
            + "`1494-1524/1525` and `1563/64?` are regnal and publication alternatives, and the three real "
            + "fractions are SELF-GLOSSED (see `currency` below), so no fraction rule is written",
        "less-than": "measured: `<` \u00d70 in the retained text \u2014 the sign does not occur",
        "greater-than": "measured: `>` \u00d71 and it is the leading bound of a HALF-LIFE in the imported "
            + "Spanish tantalum infobox \u2014 `180m Ta {Sin} >1,2 x 10\u00b9\u2075 a \u03b2 - \u03b5 0,075 \u00b9\u2078\u2070W 180 Hf`. Not a "
            + "relation between two quantities in any Nahuatl sentence, and no comparison word is attested",
        "plus-minus": "measured: `\u00b1` \u00d70 in the retained text \u2014 the sign does not occur",
        ampersand: "measured: `&` \u00d718 and NOT ONE JOINS TWO NAHUATL WORDS, \u26a0 which is the interesting "
            + "half because the WORD IS EVERYWHERE: `ihuan` \u00d7514 / `\u012bhu\u0101n` \u00d7112 on nah.wikipedia. Ten are "
            + "the literal HTML entity `&nbsp;` the dump extractor left in text (`25&nbsp;\u00b0C`, "
            + "`133&nbsp;km`, `45.9&nbsp;km`) \u2014 markup, not a sign, and normalize.ts step 2 turns it back "
            + "into the space it is. The other eight are FOREIGN PROPER NAMES: English band and label "
            + "credits (`Queen & David Bowie`, `Blank & Jones`, `Jo & Co`, `Ward Lock & Co`), German "
            + "publisher imprints (`Schuster & Loeffler`, `Fretz & Wasmuth`), and the Spanish decay-mode "
            + "column `FE & \u03b1`. Emitting the conjunction would speak a Nahuatl word inside an English "
            + "band name",
        percent: "measured: `%` \u00d717 and the class is REAL \u2014 nine are Nahuatl prose (`mochihua in 78% ic "
            + "ehecatehuiltic, 21% ic ehecayoh ihuan 1% ic arg\u00f3n`, `in 96.5% in mochi \u0101tl ca`, `piya in "
            + "1.72%`, `in cotoctic 0.04%`, `in 71% in Tl\u0101lticpactli \u012btla\u012bxpayo`, `quichihua in 99.86% in "
            + "ipipinca in Tonatiuh`) and eight are the Spanish isotope tables. \u26a0 BUT NO PERCENT WORD "
            + "EXISTS IN EITHER LANGUAGE HERE: `porciento` \u00d70, `porcentaje` \u00d70 AND `ciento` \u00d70 on "
            + "nah.wikipedia \u2014 and `ciento` at zero is what also rules out the two-token Spanish `por "
            + "ciento`, since its head noun would have to appear somewhere in 20 articles' worth of "
            + "examples. The Tashelhit case: a wrong percent word is worse than a dropped sign, so "
            + "`makeSymbolNormalizer`'s `percent` field is not declared \u2014 nor is the tier itself",
        currency: "measured: `$` \u00d71, and \u26a0 THE WRITER HAS ALREADY SAID IT: \u201cNaman ipatiuh cetzin $40 "
            + "pesos tlen tomin\u201d \u2014 *now its price is forty pesos of money*. The Spanish noun `pesos` and "
            + "the Nahuatl money word `tomin` (\u00d714, from Arabic *\u1e6f\u00famn* via Spanish, per nah.wikipedia's "
            + "own article on it) are both in the sentence, so expanding the sign says the noun twice. "
            + "One instance, self-glossed, declined \u2014 the same shape as this corpus's three FRACTIONS, "
            + "which the Moon article also glosses in full (`\u012bnn\u0101hui c\u0113 (1/4)`, `\u012bmmahtl\u0101ctli onc\u0113 c\u0113 "
            + "(1/11)`, `\u012bn\u014dmp\u014dhualli ommahtl\u0101ctli c\u0113 (1/50)`). \u20ac \u00a3 \u00a5 are \u00d70",
        exponent: "measured: the superscript runs are \u00d715 and THIRTEEN ARE NOT EXPONENTS \u2014 they are "
            + "ISOTOPE MASS NUMBERS and ELECTRON CONFIGURATIONS in the imported Spanish chemistry "
            + "infoboxes (`\u2075\u2078Ni`, `\u2076\u00b3Cu`, `\u00b9\u2078\u2070Ta`, `\u00b2\u00b3\u2077Np`, `Configuraci\u00f3n electr\u00f3nica [ Xe ] 4f\u00b9\u2074 5d\u00b3 "
            + "6s\u00b2`, `10\u2076 m\u207b\u00b9\u00b7\u03a9\u207b\u00b9`), for which a squared/cubed reading is nonsense. \u26a0 THE TWO GENUINE "
            + "ONES ARE DELIBERATELY LEFT UNREAD AND VISIBLE: `(37,932,330 km\u00b2)` and `(21,860,000,000 "
            + "km\u00b3)` in the Moon article. `cuadrado`, `cuadrada`, `c\u00fabico` and `c\u00fabica` are all \u00d70 on "
            + "nah.wikipedia \u2014 this wiki's Spanish measure vocabulary stops at the base nouns \u2014 so "
            + "normalize.ts's unit rules exclude `km` before `\u00b2`/`\u00b3` on purpose, which keeps the real gap "
            + "reportable instead of silently swallowing the power with the unit (trap 51's floor)",
    },
    crh: {
        // \u26a0 SIX REFUSALS over the retained text of `tools/corpus/mined/crh.jsonc` (415 segments of a
        // 35,437-paragraph crh.wikipedia dump), each argued in src/languages/crimeantatar/normalize.ts.
        // `minus` is NOT here \u2014 it is claimed, and the PLUS is refused instead, which is the round's
        // asymmetry: a minus inverts its operand and a plus does not.
        equals: "measured: `=` \u00d711 and ALL ELEVEN ARE MARKUP \u2014 the cleanest refusal of this sign in the "
            + "sweep. Eight are EasyTimeline chart directives (`PlotArea = left:50 right:20 top:25 "
            + "bottom:30`, `ScaleMajor = unit:year increment:5000 start:0`, `ScaleMinor = \u2026`), two are a "
            + "MediaWiki URL parameter (`preload=Template:Standard content for new page`) and one is a "
            + "section heading (`== Bağlantılar ==`). \u26a0 The EasyTimeline sense RECURS from Aragonese, "
            + "which had six of them one round earlier \u2014 chart markup is a property of dump-sourced "
            + "artifacts, not a quirk of one wiki",
        plus: "measured: `+` \u00d713, and TWELVE ARE TEMPERATURES in the climate paragraphs (`+3 \u2013 +4\u00b0C`, "
            + "`+24,6\u00b0C`, `+2,8 \u00b0C`, `+0,4 \u00b0C`, `+21,7 \u00b0C`, `+22 \u2013 +28\u00b0C`\u2026); the thirteenth is a "
            + "party abbreviation, `VF+` (South Africa\u0027s Freedom Front Plus), declined by the digit "
            + "lookahead. \u26a0 THE REFUSAL IS ABOUT THE WORD, NOT THE SIGN: `pl\u00fcs` \u00d75 is entirely RUSSIAN "
            + "FILM TITLES (\u201cPl\u00fcs odin\u201d, \u201cTri pl\u00fcs dva\u201d), `artı` \u00d79 is the postposition "
            + "\u2018beyond/behind\u2019 (`deñiz artı departamentı`, `Evniñ artı bağça`) and `eksi` is ABSENT. \u26a0 A "
            + "PLUS DOES NOT INVERT ITS OPERAND, so `+24\u00b0C` reads as twenty-four degrees either way and "
            + "the silence costs nothing \u2014 which is exactly why the MINUS, whose word the corpus does "
            + "gloss (\u201cgecede minus 16\u00b0\u0421-ge yaqın ve k\u00fcnd\u00fcz minus 11\u00b0\u0421\u201d), IS claimed",
        "plus-minus": "measured: `\u00b1` \u00d71 \u2014 `İon deñizindeki Kalipso çuqurlığında 5109 \u00b1 1 m teşkil "
            + "ete`, a sounding tolerance. One instance, and no word: the plus half is unsourceable (see "
            + "`plus`) so a \u2018plus or minus\u2019 reading cannot be composed from what this wiki attests",
        "less-than": "measured: `<` \u00d70 in the retained text \u2014 the sign does not occur",
        "greater-than": "measured: `>` \u00d70 in the retained text \u2014 the sign does not occur",
        times: "measured: `\u00d7` \u00d70 in the retained text \u2014 the sign does not occur",
        divide: "measured: `\u00f7` \u00d70. The slash occurs and is a DATE ALTERNATIVE (`m.e. 754/753 seneleri`, "
            + "two candidate foundation years for Rome), a UNIT FRACTION in the time-unit articles "
            + "(`bir saatnıñ 1/60-ine ve 60 saniyege teñ`) and a RATE (`Ortalama debit 2 m\u00b3/sn`). No "
            + "fraction rule is written",
    },
    bs: {
        // \u26a0 FIVE REFUSALS, each measured over the 1,976 DEDUPLICATED utterances of FLEURS `bs_ba` and
        // each argued in src/languages/bosnian/normalize.ts. Bosnian is the fleet's trap-55 case: it has
        // TWO treated siblings and BOTH of them declare all five of these signs. hr/sr were measured over
        // WIKI dumps, where arithmetic markup, chart directives and formula fragments are common; bs has no
        // mined artifact and its only corpus is READ-ALOUD NEWS, in which none of these five glyphs occurs
        // even once. So the refusals are not a claim about the Bosnian LANGUAGE \u2014 every word is
        // attested on bs.wikipedia (`jednako` \u00d727 in 16 articles, `podijeljeno` \u00d732/18, `manje`
        // \u00d728/17, `ve\u0107e` \u00d730/19, `plus` \u00d752/15, `minus` \u00d771/19, the last two
        // glossed together in the Negativni-brojevi article) \u2014 they are a refusal to ship a rule this
        // round cannot measure.
        // \u26a0 `minus` IS NOT HERE, and the asymmetry is deliberate: a dropped plus is lossless and a
        // dropped minus INVERTS its operand, so the guarded minus ships even though its candidate count is
        // also \u00d70. `times` is likewise absent \u2014 `\u00d7` is \u00d70 but ASCII `x` between digits
        // is \u00d74 (`6x6 cm`, `56x56 mm`), so `multiply` is declared and the class reads.
        "plus-minus": "measured: `\u00b1` \u00d70 in the 1,976 FLEURS bs_ba utterances. The `+` occurs "
            + "\u00d72 and NEITHER is arithmetic \u2014 `temperature iznad + 30 \u00b0C su "
            + "uobi\u010dajene` is a positive temperature and `po lokalnom vremenu (UTC+1)` is a zone "
            + "offset \u2014 so this corpus holds no tolerance frame from which the two-word reading "
            + "could be composed and checked",
        equals: "measured: `=` \u00d70 in the 1,976 FLEURS bs_ba utterances. \u26a0 THE SIGN'S ABSENCE IS "
            + "A PROPERTY OF THE SOURCE, not of the language: this corpus is read-aloud news, and every "
            + "non-equation sense the sweep has catalogued for `=` (tt's etymology glosses, chv's ISBD "
            + "parallel-title marks, crh's EasyTimeline directives, gd's wiki headings) is a WIKI-DUMP "
            + "artifact. Croatian and Serbian both declare the sign from wiki-sourced corpora; porting "
            + "their rule here would be an unmeasured import, which is the whole subject of trap 55",
        "less-than": "measured: `<` \u00d70 in the 1,976 FLEURS bs_ba utterances \u2014 it does not occur",
        "greater-than": "measured: `>` \u00d70 in the 1,976 FLEURS bs_ba utterances \u2014 does not occur",
        divide: "measured: `\u00f7` \u00d70 in the 1,976 FLEURS bs_ba utterances, and the SLASH is not "
            + "division here either: all 16 of its instances are RATES (`160 km/h`, `133 m/s`, "
            + "`600Mbit/s`, `100-200 milja/sat`, `35-40 mi/h`), which the tier and two local rules "
            + "already read. The `\\d+/\\d+` fraction shape is \u00d70, so no fraction rule is written "
            + "for the slash \u2014 the two vulgar-fraction GLYPHS that do occur (`29\u00be in\u010da sa "
            + "24\u00bd in\u010da`) are read directly",
    },
    chr: {
        // \u26a0 TWELVE REFUSALS \u2014 every sign class this repo probes \u2014 over the retained text of
        // `tools/corpus/mined/chr.jsonc` (315 segments of a 734-paragraph chr.wikipedia dump, the SMALLEST
        // corpus in the fleet), each argued in src/languages/cherokee/normalize.ts. This is the round where
        // trap 51's floor is the whole result: the layer that ships reads three SEPARATORS (a grouping
        // comma, a decimal dot, a span dash) and declares no shared symbol tier at all, because
        // chr.wikipedia attests no percent word, no currency name, no unit word and no exponent word.
        // \u26a0 THE SOURCING FLOOR IS MEASURED, not assumed: `espeak-ng/dictsource/chr_list` is ZERO LINES
        // long (espeak ships 324 lines of `chr_rules` over a ROMANIZATION and not one dictionary entry), and
        // `attest.ts --after` on six Cherokee numerals returns FOUR followers across the whole wiki, none a
        // measure word \u2014 this wiki essentially never spells a numeral out beside a unit.
        percent: "measured: `%` \u00d76 and every one is a genuine percentage in Cherokee prose "
            + "(\u13c2\u13aa\u13af\u13b8 \u13a4\u13c1\u13cd\u13d3\u13b3 98% \u13a6\u13d9\u13af "
            + "\u13d7\u13da\u13dd\u13a2, \u13e2 95% \u13a2\u13a6 \u13a1\u13b6\u13af, plus the two spans "
            + "`20\u201325%` and `10\u201315%`). \u26a0 THERE IS NO CANDIDATE WORD: \u13cd\u13aa\u13af\u13e5\u13c6 "
            + "(100) is attested \u00d71 in \u00d71 article and its one example is a COUNT OF PEOPLE in a "
            + "narrative rather than a proportion, and \u13cd\u13aa\u13af\u13e5\u13c6 \u13a2\u13f3\u13d3\u13b5 "
            + "(\u2018per hundred\u2019) is \u00d70. Composing one would be Fula\u2019s `e teemedere` only if the "
            + "preposition were attested in that frame, and it is not",
        currency: "measured: `\u00a5` \u00d71 and it is a TRAP-12 REDUNDANT DROP, not a gap. The corpus\u2019s only "
            + "currency sign is \u13a4\u13be\u13e4\u13b5 \u13a0\u13d5\u13b3 \u13e3\u13c6\u13c2 \u13a0\u13d5\u13b3 "
            + "(\u00a5) \u2014 \u2018their money, Japan money (\u00a5)\u2019 \u2014 so the Cherokee word "
            + "\u13a0\u13d5\u13b3 (money) is ALREADY WRITTEN twice beside the sign, and saying it a third time is "
            + "what would be wrong. `attest.ts` finds the same gloss shape for the euro on this wiki, which "
            + "confirms the construction independently: \u13f3\u13b3\u13db (\u20ac) \u13a0\u13d5\u13b3 "
            + "\u13be\u13bf European Union. No yen name is attested in any source",
        minus: "measured: the ASCII hyphen is \u00d7101 in the retained text and NOT ONE is a negative. `mine.ts "
            + "scan` reports `DROP minus \u00d71`; read, the instance is \u13b9\u13f1\u13a9\u13b5 I "
            + "\u13b3\u13c2\u13a6\u13c7 (????-844) \u2014 a reign span whose start year is unknown, written as "
            + "four question marks. \u26a0 THE HYPHEN IS A CHEROKEE WORD-JOINER: the -\u13af/-\u13c2 enclitic "
            + "(\u13e7\u13f4\u13e2 \u13a0\u13b9\u13f0\u13b5-\u13af, \u13a1\u13b6\u13af-\u13c2), a COMPOUND NUMERAL "
            + "(\u13e6\u13cd\u13aa\u13af-\u13d0\u13c1\u13b3 (39), which the writer glosses with its own digits in "
            + "the same clause), an ISBN separator (\u00d79 hyphens over 3 citations) and English compounds \u2014 "
            + "against THREE genuine spans. Only `\u2013` and `\u2014` are claimed by this layer",
        plus: "measured: `+` \u00d70 in the retained text \u2014 the sign does not occur",
        "plus-minus": "measured: `\u00b1` \u00d70 in the retained text \u2014 the sign does not occur",
        equals: "measured: `=` \u00d70 in the retained text \u2014 the sign does not occur. Trap 62 says print every "
            + "instance with its context before writing a rule for it; here there is nothing to print, which is "
            + "trap 48\u2019s definitive negative rather than a deferral",
        "less-than": "measured: `<` \u00d70 in the retained text \u2014 the sign does not occur",
        "greater-than": "measured: `>` \u00d70 in the retained text \u2014 the sign does not occur",
        times: "measured: `\u00d7` \u00d70 in the retained text \u2014 the sign does not occur",
        divide: "measured: `\u00f7` \u00d70. The slash occurs \u00d73 and every instance sits inside ENGLISH text in "
            + "the citation apparatus \u2014 a page range ((1897/98: pt.1)), a dictionary title (English/Cherokee "
            + "Glossary) and a spaced apposition (for Cherokee / Tsalagi). No fraction rule and no rate rule is "
            + "written",
        degrees: "measured: `\u00b0` \u00d70 and `\u2103`/`\u2109` \u00d70 \u2014 the sign does not occur, and "
            + "neither does any temperature figure anywhere in this corpus. The artifact\u2019s `degrees` cell is 0",
        ampersand: "measured: `&` \u00d73 and NOT ONE is a Cherokee conjunction. Two are the unexpanded HTML entity "
            + "`&ndash;` ((1914&ndash;1972), (1961&ndash;1989)), which this layer folds to the real dash so the "
            + "span rule can read it; the third is Ben & Jerry's \u13a4\u13db\u13c1\u13a2 "
            + "\u13a4\u13a6\u13be\u13cd\u13d7 Holdings Inc., an English brand name inside a Cherokee sentence. "
            + "\u26a0 THE WORD WOULD HAVE BEEN EASY \u2014 \u13a0\u13b4 (\u2018and\u2019) is \u00d7255 over 20 "
            + "articles and is this corpus\u2019s ordinary conjunction \u2014 and it is refused because splicing a "
            + "Cherokee word into an English trade name is a defect this layer would have INTRODUCED rather than "
            + "inherited (trap 56)",
    },
    kaa: {
        // \u26a0 SIX REFUSALS over the retained text of `tools/corpus/mined/kaa.jsonc` (443 segments of a
        // 63,415-paragraph kaa.wikipedia dump), each argued in src/languages/karakalpak/normalize.ts.
        // `plus` and `minus` are NOT here \u2014 both are claimed, and the guard that made the plus safe is
        // the interesting part of the round (`C++` never puts a digit after the sign).
        equals: "measured: `=` \u00d78 and FIVE are real equivalences \u2014 the unit-conversion lines "
            + "(`1 pikosekund = 1/1,000,000,000,000 sekund`, `1 femtosecond = \u2026`, `1 jıl = 12 ay = 365 "
            + "k\u00fan`, `1 bazis punkt = 0,01 %`) and `E=mc^2`. The other three are not: a raw LaTeX "
            + "fragment, an ETYMOLOGICAL GLOSS (`helios = quyash`) and \u26a0 a TAXONOMIC SYNONYMY \u2014 "
            + "`Elaeagnus orientalis = Elaeagnus angustifolia var. orientalis`, the botanists\u0027 \u2018is a "
            + "synonym of\u2019, which is a sense no earlier language in this sweep produced. \u26a0 AND THE WORD "
            + "IS WHY THE MAJORITY DOES NOT CARRY IT: `teń` \u00d7104 is attested and is exactly \u2018equal\u2019, "
            + "but POSTPOSITIONALLY \u2014 \u201c10-12 metrge teń\u201d, \u201cbasıp \u00f3tken jolına teń\u201d \u2014 and the tier "
            + "can only place a connective BETWEEN operands. Third language to refuse it on these grounds, "
            + "after chv and skr",
        times: "measured: `\u00d7` \u00d71 and it is SCIENTIFIC NOTATION, not a multiplication to be read: "
            + "\u201cunikal giltler sanı sonshelli \u00falken (2\u00b9\u00b2\u2078 yamasa 3,4028\u00d710\u00b3\u2078)\u201d, the AES key space. The "
            + "superscript exponent beside it is unread too, so a multiplier alone would produce *\u00fash \u00fatir "
            + "t\u00f3rt nol eki segiz kerete on* \u2014 worse than the silence",
        divide: "measured: `\u00f7` \u00d70. The slash occurs and is a UNIT FRACTION inside those same "
            + "conversion lines (`1/1,000,000,000,000 sekund`), an IP PREFIX LENGTH (`198.51.100.0/24`), a "
            + "COMPOUND UNIT (`kvt/saat`, `kilovatt/saat` \u2014 kilowatt-HOURS, a product rather than a rate, "
            + "which is why this layer expands it without a \u2018per\u2019 word) and a density "
            + "(`24,9 adam/km\u00b2`). No fraction rule is written",
        "less-than": "measured: `<` \u00d70 in the retained text \u2014 the sign does not occur",
        "greater-than": "measured: `>` \u00d70 in the retained text \u2014 the sign does not occur",
        "plus-minus": "measured: `\u00b1` \u00d70 in the retained text \u2014 the sign does not occur. \u26a0 The WORDS "
            + "do: `plyus` \u00d714 and `minus` \u00d76, and the corpus writes the PAIR out in prose "
            + "(\u201cstavkasin plyus yamasa minus funttaǵi 3 pensqa \u00f3zgertiw\u201d, \u201c\u00e1piwayı ǵana «plyus\u2013minus» "
            + "dep ataladı\u201d) \u2014 which is what sources the two separate signs this layer DOES claim",
    },
    skr: {
        // \u26a0 EIGHT REFUSALS over the retained text of `tools/corpus/mined/skr.jsonc` (436 segments of a
        // 120,763-paragraph skr.wikipedia dump), each argued in src/languages/saraiki/normalize.ts. \u26a0 THE
        // `equals` ENTRY IS THE FIRST IN THIS SWEEP WHERE ARITHMETIC IS THE MAJORITY SENSE \u2014 and it is
        // still refused, for the reason Chuvash gave: the WORD IS POSTPOSITIONAL and the tier can only
        // place a connective BETWEEN operands.
        equals: "measured: `=` \u00d712, and SIX ARE GENUINE ARITHMETIC \u2014 the Rubik\u0027s-cube article\u0027s "
            + "piece counts (`2\u00d72\u00d72 = 8`, `3\u00d73\u00d73= 27`, `4\u00d74\u00d74= 64`, `5\u00d75\u00d75= 125`, "
            + "`7\u00d77\u00d77=483`, the last of which the corpus gets wrong) and one satirical couplet "
            + "(`\u0688\u0648 + \u0686\u0627\u0631 = \u0686\u06be \u062f\u0627\u0646\u0634\u0648\u0631\u0627\u06ba`). The rest are two physics formulas "
            + "(`F = ma`, `E=mc^2`), two ETYMOLOGICAL GLOSSES (`\u0627\u0646\u0648\u0627\u0621 = \u0646\u0648\u0621 \u062f\u06cc \u062c\u0645\u0639 \u06c1\u06d2`, "
            + "`\u06c1\u0627\u0626\u0688\u0631\u0648 = \u067e\u0627\u0645\u0679\u06cc`), one angle assignment (`\u03b8 = 0\u00b0`) and one WIKI TEMPLATE PARAMETER "
            + "the extraction left in (`\u0631\u0628\u0637= \u06af\u0631\u06cc\u0646\u0688 \u06a9\u0631\u0627\u0633`). \u26a0 AND THE WORD IS WHY THE MAJORITY DOES NOT "
            + "CARRY IT: `\u0628\u0631\u0627\u0628\u0631` \u00d745 is attested and is exactly \u2018equal\u2019, but POSTPOSITIONALLY \u2014 the "
            + "corpus writes \u201c2.43 \u00d7 10\u207b\u00b9\u00b2 \u0645\u06cc\u0679\u0631 \u062f\u06d2 \u0628\u0631\u0627\u0628\u0631 \u06c1\u06d2\u201d, *is equal TO x*, and the tier can only "
            + "place a connective between operands. Same refusal as chv, same reason",
        times: "measured: `\u00d7` \u00d711 with THREE SENSES and no clean majority: the cube dimensions above "
            + "(`9\u00d79\u00d79\u060c 11\u00d711\u00d711 \u062a\u06d2 17\u00d717\u00d717 \u0645\u06a9\u0639\u0628`), SCIENTIFIC NOTATION (`2.43 \u00d7 10\u207b\u00b9\u00b2 "
            + "\u0645\u06cc\u0679\u0631`) and a PHYSICS LAW (`\u0642\u0648\u062a = \u06a9\u0645\u06cc\u062a \u00d7 \u062a\u06a9\u0648\u0646 (F = ma)`) \u2014 plus PAPER DIMENSIONS "
            + "written with an ASCII \u27e8x\u27e9 (`A4; 297x210 mm`, `\u06f3x\u06f3 \u06c1\u062a\u06be`), which is why `\u06f3x\u06f3` reads "
            + "*tin eks tin* today. \u26a0 AND THE WORD IS THE FULA SHAPE: `\u0636\u0631\u0628` \u00d745 on the wiki is "
            + "`\u0636\u0631\u0628 \u0627\u0644\u0645\u062b\u0644`, \u2018proverb\u2019, in every example read",
        plus: "measured: `+` \u00d72 and ONE IS AN ORTHOGRAPHIC DECOMPOSITION rather than an addition \u2014 "
            + "`\u0632\u0628\u0631+\u06cc+ \u0654 \u06c1\u06d2`, the article on how \u27e8\u0626\u27e9 is built from zabar plus ye plus hamza. The other "
            + "is the satirical couplet counted under `equals`. A plus does not invert its operand, so "
            + "silence costs nothing",
        "plus-minus": "measured: `\u00b1` \u00d70 in the retained text \u2014 the sign does not occur",
        "greater-than": "measured: `>` \u00d70 in the retained text \u2014 the sign does not occur",
        "less-than": "measured: `<` \u00d71 and it is an APPROXIMATION MARKER inside a currency parenthetical, "
            + "not a comparison to read aloud: `2 \u0628\u0644\u06cc\u0646 \u06cc\u0646 (<US$20 \u0645\u0644\u06cc\u0646)`, \u2018under twenty million "
            + "dollars\u2019. \u26a0 The figure beside it IS read \u2014 `US$` is declared as its own currency key "
            + "(trap 64) \u2014 so what is dropped is the hedge, not the quantity",
        divide: "measured: `\u00f7` \u00d70. The slash occurs and is a CITATION (`\u0645\u0639\u062c\u0645 \u0627\u0644\u0628\u0644\u062f\u0627\u0646 \u06f4/\u06f1\u06f5\u06f0`, "
            + "volume over page; `213-276/828-889`, Hijri over Gregorian), a RATE (`h/m\u2091c`) or a date "
            + "(`5/1987 to 12/1995`). No fraction rule is written",
        exponent: "measured: \u00d716, and NONE has a unit noun for a power to attach to. They are "
            + "SCIENTIFIC NOTATION (`2.43 \u00d7 10\u207b\u00b9\u00b2`), an inline negative exponent "
            + "(`10\u221250 cm4 s photon\u22121`), a caret (`E=mc^2`) and a SUBSCRIPT variable (`h/m\u2091c`). "
            + "\u26a0 `units` IS FOUR CORPUS-WIDE in 120,763 segments \u2014 this language spells its measures out "
            + "(`\u0645\u0631\u0628\u0639 \u06a9\u0644\u0648\u0645\u06cc\u0679\u0631`, `\u0645\u0631\u0628\u0639 \u0645\u06cc\u0644`, `\u0645\u06a9\u0639\u0628`) \u2014 so there is no unit table here for an "
            + "exponent to modify, and the squared/cubed words would have nothing to attach to",
    },
    an: {
        // \u26a0 SEVEN REFUSALS over the retained text of `tools/corpus/mined/an.jsonc` (448 segments of a
        // 255,887-paragraph an.wikipedia dump), each argued in src/languages/aragonese/normalize.ts. The
        // `equals` entry is a SEVENTH distinct non-equation sense of the sign in this sweep, and a kind
        // no earlier language produced: CHART MARKUP the dump extraction left behind.
        equals: "measured: `=` \u00d710 and SIX are EasyTimeline chart directives the extraction did not "
            + "strip \u2014 `PlotArea = width:450 height:230 left:180 bottom:35`, and five `ScaleMajor = "
            + "unit:year increment:N start:0` lines. One more is a GREEK ETYMOLOGY GLOSS (\u201cde photos "
            + "= luz, y graphis = debuixo\u201d) and one a raw LaTeX fragment. Only TWO are equations "
            + "(`m = E/c\u00b2`, `hf = \u00f8 + y k`), both physics prose quoting a formula rather than "
            + "asking for it to be read aloud",
        "greater-than": "measured: `>` \u00d716 and every one is a SOUND-CHANGE ARROW \u2014 the etymology "
            + "table of the arag\u00f3n\u00e9s article, Latin etymon to Aragonese reflex: `PONTE > puent`, "
            + "`FERRU > fierro`, `FOLIA > fuella`, `SPEC\u0027LU > espiello`, `GRANDE > gran`, `IUVEN > "
            + "choven`, `GELARE > chelar`, `FILIU > fillo`. Shan\u0027s `>` was the same sign in the same "
            + "sense; gd\u0027s was a LaTeX fragment, tk\u0027s a typo for \u27e8\u015f\u27e9, la\u0027s a "
            + "real comparison and oc\u0027s a taxonomic rank chain. ZERO comparisons here",
        "less-than": "measured: `<` \u00d70 in the retained text \u2014 the sign does not occur",
        divide: "measured: `\u00f7` \u00d70. The slash occurs \u00d711 and only THREE are fractions "
            + "(`2/3`, `1/10`, `1/72`); the rest are LEGAL CITATIONS (`Lei 10/2009`, `Decreto 208/1993`, "
            + "`Lei Organica 4/1979`), an issue number (`Fuellas, 16/93`), a sports season "
            + "(`temporada 2004/2005`), a date (`from:30/10/1977`) and the population rate `hab/km\u00b2` "
            + "\u2014 which IS read, as a rate. Reading a statute number as a fraction is trap 56",
        plus: "measured: `+` \u00d73 and NONE is an addition: a PHONOLOGICAL ENVIRONMENT in the "
            + "orthography article (\u201cch, j, g(+e), g(+i) son uniformizatas en ch\u201d \u2014 \u27e8g\u27e9 "
            + "before \u27e8e\u27e9, before \u27e8i\u27e9), a PAGINATION in a citation (`XVIII+1022 pp.`), "
            + "and the physics formula above. A plus does not invert its operand, so silence costs nothing",
        "plus-minus": "measured: `\u00b1` \u00d71 and it is an APPROXIMATE GEOLOGICAL DATE \u2014 \u201cEn o "
            + "Devoniano (fa \u00b1415 - \u00b1360 m.a.) se form\u00f3 la penya calsinera\u201d, where `m.a.` is "
            + "*millons d\u0027anyadas* and IS claimed by the layer. The sign means \u2018about\u2019 here, not "
            + "\u2018plus or minus\u2019, and no Aragonese word for either reading is written",
        times: "measured: `\u00d7` \u00d71 and it is SCIENTIFIC NOTATION, not a multiplication to be read: "
            + "\u201cuna reserva de 11.800 millons de barrils (`1.88\u00d710^9 m\u00b3`)\u201d. The caret "
            + "exponent beside it is unread too, so emitting a multiplier alone would produce *un coma "
            + "uitanta y ueito por diez nueu* \u2014 worse than the silence",
    },
    pap: {
        // \u26a0 SIX REFUSALS over the retained text of `tools/corpus/mined/pap.jsonc` (448 segments of a
        // 31,099-paragraph pap.wikipedia dump), argued in src/languages/papiamento/normalize.ts.
        equals: "measured: `=` \u00d71 and it is inside a raw LaTeX fragment the dump extraction left in "
            + "(`1 Pa = \\frac{1N}{m^2}`). Zero are equations in Papiamento prose",
        times: "measured: `\u00d7` \u00d70 in the retained text \u2014 the sign does not occur",
        divide: "measured: `\u00f7` \u00d70. The slash occurs and is a FLAG SPECIFICATION \u2014 `E streanan tin "
            + "diameter di 1/6 i 2/9 di e haltura`, the proportions of the Cura\u00e7ao flag \u2014 beside the "
            + "stripe RATIO `5:1:2` in the same sentence. Neither is a fraction to be read aloud as one",
        "less-than": "measured: `<` \u00d70 in the retained text \u2014 the sign does not occur",
        "greater-than": "measured: `>` \u00d70 in the retained text \u2014 the sign does not occur",
        "plus-minus": "measured: `\u00b1` \u00d70 in the retained text \u2014 the sign does not occur",
        plus: "measured: `+` \u00d70 as an addition; the `math-sign` residual is a TIMEZONE OFFSET in a "
            + "daylight-saving note. The MINUS is read, because omitting it inverts and omitting a plus "
            + "does not",
    },
    gd: {
        // ⚠ FOUR REFUSALS, each a measurement over the retained text of `tools/corpus/mined/gd.jsonc`
        // (441 segments of a 49,150-paragraph gd.wikipedia dump), and each argued in
        // src/languages/scottishgaelic/normalize.ts. None is a missing rule; all four are missing WORDS
        // with the wrong candidate already ruled out, or a sign this corpus does not use as a sign.
        degrees: "measured: the Gaelic word is `ceum` and ALL 43 of its gd.wikipedia attestations are the "
            + "ACADEMIC degree (\"rinn e ceum ann am matamataig\", \"Thug e ceum bho Oilthigh Uppsala\"). "
            + "`ceum Celsius`, `ceumannan Celsius` and `ìre Celsius` all score 0. The Fula `tere` shape — a "
            + "real word in the wrong sense — so the 358 degrees stay unread rather than being told to say "
            + "\"university degree Celsius\"",
        times: "measured: `×` ×10 and they ARE arithmetic (`7 × ( 14 + 9 – 4) = (7 × 14) + …`, the "
            + "distributive law), but the plausible word `uiread` ×36 is \"quantity/amount\" in every hit "
            + "(\"'s e uiread neo-aithnichte\" — an unknown quantity), never \"times\"",
        equals: "measured: `=` ×50, and they are WIKI HEADING MARKERS (`== Hallstatt agus La Tène ==`) and "
            + "raw LaTeX (`y = r sin(φ) sin(θ)`). Zero are equations in Gaelic prose",
        plus: "measured: `+` occurs only inside BBC video timestamps (`agallamhan-bhideo 3:58+4:21`), "
            + "which is a list separator rather than an addition, and no Gaelic plus word is attested",
        "plus-minus": "measured: `±` ×0 in the retained text — the sign does not occur",
        "less-than": "measured: `<` ×0 in the retained text — the sign does not occur",
        "greater-than": "measured: `>` ×1, inside the raw LaTeX fragment `a - b, & : a > b \\quad` the dump "
            + "extraction left in. Zero occur in Gaelic prose",
        divide: "measured: `÷` ×0 in the retained text — the sign does not occur",
    },
    ba: {
        // ⚠ FOUR CLASSES, ONE MEASUREMENT EACH, over the retained text of `tools/corpus/mined/ba.jsonc`
        // (460 segments of a 618,078-paragraph ba.wikipedia dump). Bashkir Wikipedia carries a great deal
        // of RUSSIAN-language material — bibliographies, archival citations, quoted decrees — and raw
        // LaTeX the dump extraction left in, and that is what these four signs are made of.
        // Every refusal comes green the day a real Bashkir instance appears; none of them is a missing word.
        equals: "measured: `=` ×17, of which 16 are LaTeX (`a*a^{-1}=a^{-1}*a=e`, `\\aleph_0=\\hbar`), a "
            + "formula the dump left raw, or a typo inside Russian text (`1996=2006`). The ONE real "
            + "equation (`рН = 6,4÷6,7`) carries a digit, and normalize.ts step 8 reads it — the word "
            + "`тигеҙ` is sourced ×350 beside its own formula. The refusal is the letter-flanked probe only",
        "less-than": "measured: `<` ×0 in the retained text — the sign does not occur at all",
        "greater-than": "measured: `>` ×1, and it is a THAI REDUPLICATION ARROW in a linguistics example "
            + "(`เด็ก (dek, «бала») --> เด็กๆ`), not a comparison. One instance of the wrong sense is not "
            + "evidence for the sign",
        divide: "measured: `÷` ×1, and it is a RANGE in the Russian convention rather than a division — "
            + "`рН = 6,4÷6,7` means pH from 6.4 to 6.7. Reading it as a division would assert an "
            + "arithmetic operation the sentence does not perform",
    },
    be: {
        // ⚠ NOT A MISSING RULE — a DIGIT-GATED one, and the gate is the whole point. `=` is ×9 in the
        // retained text of `tools/corpus/mined/be.jsonc` and SEVEN of them are BIBLIOGRAPHIC TITLE
        // SEPARATORS in Belarusian's own citation style: `Запісы = Zapisy`, `Беларускі гістарычны зборнік =
        // Białoruskie Zeszyty Historyczne`, `Беларусіка = Albaruthenica`, `Время действий и преобразований
        // = The region`. An eighth is raw LaTeX the dump extraction left in. Reading `ёсць` there would
        // assert an equation about a TRANSLATION — the Lithuanian lesson, in the same class.
        // The two real equations both carry a digit (`1 аўстр. дол. = 0,71 дол. ЗША`, `фунт стэрлінгаў =
        // 100 пенсаў`), so `normalize.ts` step 10 requires one on either side and BOTH read correctly. The
        // probe here is `x = y`, letters on both sides, which is exactly the shape being refused.
        // The word itself is sourced: be.wikipedia's multiplication article reads the notation aloud —
        // "2 ⋅ 3 = 6 … чытаецца «два памножыць на тры роўна шасці», або проста «два на тры ёсць шэсць»".
        equals: "measured: `=` ×9 in the retained text, of which 7 are bibliographic title separators and "
            + "1 is raw LaTeX; the 2 real equations both have a DIGIT beside the sign and are read. The "
            + "refusal is the letter-flanked shape only, not the class",
    },
    lt: {
        // ⚠ EVERY COUNT BELOW IS OVER THE RETAINED TEXT OF `tools/corpus/mined/lt.jsonc` — 464 segments
        // (264 hard + 200 sample) out of a 1,193,488-paragraph lt.wikipedia dump — with the artifact's
        // whole-corpus `counts` quoted where they differ. `attest.ts` against lt.wikipedia is the second
        // tier and is THE SAME WIKI, so it is a bigger sample of one source; espeak's Lithuanian
        // `dictsource/lt_list` is the only genuinely independent one. Every refusal is argued in
        // src/languages/lithuanian/normalize.ts.
        // ⚠ `degree`, `exponent` and `minus` ARE DELIBERATELY ABSENT, WHICH IS WHY THE ARTIFACT SCAN FOR
        // lt STAYS RED — the ak / ln / bm / ilo / lg stance, and here it names three separate real gaps
        // rather than one. (1) The BARE degree sign, ×16 in the retained text and 14 of them coordinates
        // (`54° 54′ šiaurės platumos`, `81° 20´ v. ilg.`): the degree WORD is sourced (`laipsnių
        // Celsijaus` ×13/11) and the layer reads `°C` with it, so what is missing is the ARCMINUTE and
        // ARCSECOND words and the compass letters, not the degree. Reading the degree alone would fuse
        // `54° 54′` into one 54-and-54 reading, so the whole coordinate is refused instead (trap 53).
        // (2) `exponent` on `140–160 kcal/cm²`: a RATE whose numerator this tree cannot name, refused
        // whole so the `²` is not invented onto it (trap 54's so/si case). (3) `minus` ×2, both the same
        // shape — `1936 metų liepos 20 d.–22 dienomis`, a DATE SPAN whose dash sits after an abbreviation
        // dot rather than a digit, so neither the range rule nor the sign rule may claim it. All three
        // come green the day the missing reading is sourced, and not before.
        equals: "×39, and reading them finds no arithmetic anywhere — which matters because the word is "
            + "NOT the blocker: espeak's lt_list states `=  l;'i:gu`, so *lygu* is available and is still "
            + "the wrong thing to say here. The instances split three ways. (1) RAW LaTeX the dump "
            + "extraction left in — `\\mathbb{N}^0 = \\mathbb{N}_0 = \\{ 0, 1, 2, \\ldots \\}`, which is the "
            + "very example `mine.ts scan` prints for this class, and which nobody reads aloud. (2) An "
            + "ETYMOLOGY GLOSS where `=` means \"means\" or \"is\": `γράφω = graphō 'rašau'`, `φιλο – "
            + "'myliu' + σοφία = išmintis`, `Biotopas + Biocenozė = Ekosistema`. Saying *lygu* there would "
            + "assert an equation about a translation. (3) A BILINGUAL TITLE SEPARATOR in a Latvian "
            + "bibliography — `Baltu valodu atlants: prospekts = Baltų kalbų atlasas`. The `arithmetic` "
            + "cell is ×3,936 whole-corpus and measures the same three things. A sourced word in the "
            + "wrong register is trap 37's deeper form, so it is not shipped.",
        times: "×3 and every one is a DIMENSION CROSS, which reads \"by\" and not \"times\": "
            + "`Jis sveria 90 g, yra 110 x 46 x 21 mm dydžio` (a device's dimensions) and "
            + "`250–300×150 m`. The th finding on its own corpus, reproduced here. espeak's lt_list "
            + "leaves `×` commented out and offers nothing, so this is a sense refusal AND a sourcing "
            + "gap at once — but the sense settles it alone: no multiplication word would be correct in "
            + "any of the three, and a dimension word is a separate rule with its own sourcing.",
        "plus-minus": "×0 in the retained text. A definitive absence recorded so the negative is not "
            + "re-investigated (trap 48). espeak's lt_list has `±  plus_minus`, which is its own internal "
            + "directive rather than a Lithuanian reading, so even the apparent source is not one — worth "
            + "knowing before someone reads that line as an attestation.",
        "less-than": "×0 in the retained text, and `<` does not occur in the artifact at all — "
            + "`sources.ts --lang lt` reports the sign absent from the evidence. Same definitive absence "
            + "as `plus-minus`.",
        "greater-than": "×0 in the retained text; `>` likewise absent from the evidence. Same definitive "
            + "absence as `plus-minus`.",
        divide: "×0 in the retained text; `÷` absent from the evidence. Note this is NOT the same as the "
            + "SLASH, which is ×14 and is a fraction, a rate or a document number (`Nr. 130/63`) — never "
            + "a division sign. Same definitive absence as `plus-minus`.",
    },
    gn: {
        // ⚠ EVERY COUNT BELOW IS OVER THE RETAINED TEXT OF `tools/corpus/mined/gn.jsonc` — 433 segments
        // (233 hard + 200 sample) out of a 35,143-paragraph gn.wikipedia dump — with the artifact's
        // whole-corpus `counts` quoted where they differ. `attest.ts` against gn.wikipedia is the second
        // tier; espeak does not ship Guaraní at all, so there is no third. Every refusal is argued in
        // src/languages/guarani/normalize.ts.
        // ⚠ `minus` IS DELIBERATELY ABSENT, AND THAT IS WHY `review.ts --lang gn` STAYS RED ON IT — the
        // ak / ln / bm / ilo stance. Guaraní has GENUINE negatives and they are not ranges in disguise:
        // three in the retained text, every one a temperature minimum — `-89,2°C` (Antarctica's record
        // low), `mínima araro'y jave -1ºC`, `araro'y jave katu -8 °C-pe`. Omitting a plus is lossless;
        // omitting a minus INVERTS. And the rule SHAPE is available — every one of the three is a sign
        // directly before a number followed by a degree mark, which is exactly trap 24's Hindi
        // discriminator — so what is missing is a WORD, not a guard. Both candidates fail on sense:
        // `menos` reports "attested ×8/7" and every hit is inside SPANISH prose (`las especies menos
        // corrientes`, `por lo menos` ×4), the adverb "less/at least"; `negativo` ×4/2 is a photographic
        // NEGATIVE (the Boggiani glass-plate collection) or a negative test result (`osẽ negativo pe
        // RADT`). Trap 37 twice, with healthy counts on the wrong sense. The gate comes green the day a
        // Guaraní negative-number word is attested, not before.
        ampersand: "×46 in the retained text and NOT ONE of them is a conjunction — every single "
            + "occurrence is an HTML ENTITY the dump preserved: `&nbsp;` ×45 (`11&nbsp;000&nbsp;000`, "
            + "`21&nbsp;696 ava`, `30&nbsp;°C-pe`, `US$ 5.188.250&nbsp;sua`, `3152&nbsp;km`) and "
            + "`&thinsp;` ×1 (`176&thinsp;215&nbsp;km²`). The `ampersand` cell reports ×765 whole-corpus "
            + "and it is measuring the same thing. `stripMarkup` decodes `&nbsp;` to a space at the "
            + "registry's dispatch point, ABOVE this language's layer, so by the time any gn rule runs "
            + "there is no ampersand left — which is why the probe is the only place it can still be seen. "
            + "This is not a sourcing gap: Guaraní's coordinator `ha` is the corpus's commonest token at "
            + "×932 and would be available instantly. There is simply nothing in this language to read. "
            + "(⚠ `&thinsp;` is the one entity `src/core/markup.ts` lacks, so it reaches the IPA as "
            + "*tˈhinsp* — a real defect, REPORTED rather than fixed here, because that file is shared.)",
        equals: "×18, and reading them splits three ways, none of which wants an arithmetic word. "
            + "(1) MEDIAWIKI HEADING MARKUP the dump extraction left in — `=== Mboꞌehára ha aranduka "
            + "ñeꞌẽtekuaaguigua ===`, which is the very example `mine.ts scan` prints for this class; "
            + "silence there is not merely harmless, it is the only correct reading. (2) A GRAMMAR "
            + "ARTICLE'S GLOSS SEPARATOR, where `=` means \"conjugates as\" or \"is realised as\": "
            + "`karu = rekaru, okaru, jakaru, rokaru, pekaru`, `vyꞌa = revyꞌa, ovyꞌa`, `hiꞌ = avaite "
            + "mbohapyha`. Reading it as \"equals\" would say *karu equals rekaru* about a paradigm. "
            + "(3) ONE RAW CALCULATION DUMP inside a land-survey article — `17 .17=289 .13.75 =3973.75 = "
            + "39,73 cúbicos` — which is arithmetic and is also not prose anyone reads aloud. ⚠ This is "
            + "why the `arithmetic` CELL, ×69 whole-corpus, measures 0% arithmetic and only 50% Guaraní: "
            + "all eight of its hard instances are that grammar article's conjugation and pronoun tables. "
            + "No equals word is attested in Guaraní and none of these three shapes would take one.",
        plus: "×1 in the retained text, and `signed-number` is ×26 whole-corpus against `digit-run` "
            + "×19,814 — trap 48's shape, a definitive negative rather than a probe failure. Nothing "
            + "attests how Guaraní voices a plus, `concept.ts` returns no gn label for the operation, and "
            + "the playbook's own measurement applies unchanged here: a written corpus is silent about "
            + "signs BY CONSTRUCTION, and in the one context that recurs across the fleet (`+30°C`) the "
            + "sign is redundant with the comparative anyway. Not read.",
        "plus-minus": "×0 in the retained text. A definitive absence, recorded so the negative is not "
            + "re-investigated (trap 48): the class costs a probe line and answers nothing about Guaraní.",
        "less-than": "×0 in the retained text. Same definitive absence as `plus-minus`.",
        "greater-than": "×0 in the retained text. Same definitive absence as `plus-minus`.",
        times: "×0 in the retained text — neither `×` nor a digit-flanked ASCII `x`. ⚠ AND THE ONE PLACE "
            + "A DIMENSION CROSS DOES OCCUR IS SPANISH: `colección orekóva 175 negativo de vidrio 18 x 24 "
            + "cm, 81 de 13 x 18` — a photographic-plate inventory quoted from a Spanish catalogue, inside "
            + "an article whose surrounding prose is Guaraní. Declaring a Guaraní word for it on that "
            + "evidence would be reading a Spanish measurement idiom in Guaraní, which is the failure this "
            + "language's whole Jopara measurement exists to prevent. Not read.",
        divide: "×0 in the retained text. Same definitive absence as `plus-minus`.",
    },
    wo: {
        // ⚠ EVERY COUNT BELOW IS OVER THE RETAINED TEXT of `tools/corpus/mined/wo.jsonc` — 408 segments
        // (208 hard + 200 sample) out of a 10,278-paragraph wo.wikipedia dump — with the artifact's
        // whole-corpus `counts` quoted where they differ. `attest.ts` against wo.wikipedia is the second
        // tier and espeak does not ship Wolof AT ALL, so there is no third. Every refusal is argued in
        // src/languages/wolof/normalize.ts.
        // ⚠ `minus` IS DELIBERATELY ABSENT, AND THAT IS WHY `review.ts --lang wo` STAYS RED ON IT — the
        // ak / ln / bm / ilo / gn stance. `mine.ts scan` reports `DROP minus ×2` and reading both shows
        // they are not negatives: one is a LIST BULLET in a botanical description (`Doom bi: -Daa tàcc -5
        // ba 7,5i sàntimet ci guddaay`, where the leading hyphens open each dashed line) and the other is
        // the ASCII half of a scientific exponent (`1,602 189 2 ∙ 10 -19 C`). So there is no true negative
        // here to read — but that is a fact about this corpus, not a licence, and omitting a minus INVERTS
        // where omitting a plus is lossless. No Wolof negative-number word is attested in the corpus, on
        // wo.wikipedia or in the kaikki referee, so the class stays red until one is.
        equals: "×20 in the retained text, splitting three ways and none of them wanting an arithmetic "
            + "word. (1) THREE PHYSICS EQUATIONS — `q e = 1,602 · 10⁻¹⁹ C`, `moo yem ak e = 1,602 189 2 ∙ "
            + "10-19 C`, `ñu koy faral di binde e = -1,602 10⁻¹⁹ c` — and the second of those is decisive "
            + "against reading the sign rather than for it: the sentence ALREADY writes the words, `moo "
            + "yem ak` ('is equal to'), so this is trap 12's redundant shape and the correct reading says "
            + "it once. (2) ~NINE LEXICAL AND TRANSLATION GLOSSES, where `=` means 'means' rather than "
            + "'equals': `baziira = gisug xol`, `yax=nassu ci araab.=texte ci français`, `sotti = nusxa`, "
            + "`marsiya = xasida gu niy waxe jëf ju baax`, `xarala(fr : économie ; en : economics) = "
            + "koom-koom`, `vin= akusativo`. Reading those as 'equals' would say *baziira equals gisug "
            + "xol* about a definition. (3) TWO MEDIAWIKI HEADING MARKERS the dump extraction left in — "
            + "`==Melo wi==` and `Death forever=`, which is the very example `mine.ts scan` prints for "
            + "this class — where silence is the only correct reading. `yem ak` IS attested (×4/4 on "
            + "wo.wikipedia) and is a real Wolof phrase; what is missing is a shape it fits, not a word.",
        plus: "×0 in the retained text — `sources.ts` reports `[ · ] plus-word: the sign does not occur in "
            + "the evidence`, and the `signed-number` cell is ×7 whole-corpus against `digit-run` ×1928. "
            + "Trap 48's shape: a definitive negative rather than a probe failure. Nothing attests how a "
            + "Wolof reader voices a plus, and the playbook's fleet-wide finding is that the only "
            + "contentful plus is the UTC offset — which this corpus does not write either.",
        "plus-minus": "×0 in the retained text and ×0 whole-corpus. A definitive absence, recorded so the "
            + "negative is not re-investigated (trap 48): the class costs a probe line and answers "
            + "nothing about Wolof.",
        "less-than": "×0 in the retained text. Same definitive absence as `plus-minus`; `sources.ts` "
            + "reports the sign does not occur in the evidence.",
        "greater-than": "×0 in the retained text. Same definitive absence as `plus-minus`.",
        times: "×0 in the retained text — neither `×` nor a digit-flanked ASCII `x`. ⚠ THE ONE PLACE A "
            + "MULTIPLICATION SIGN DOES OCCUR IS THE MIDDLE DOT of scientific notation, ×3, all in one "
            + "physics article: `1,602 · 10⁻¹⁹ C`, `9,10 · 10−31 kg`, `1,602 189 2 ∙ 10 -19 C`. That is a "
            + "shape the shared tier's `multiply` field does not match at all (it reads `×` and ASCII "
            + "`x`), and no Wolof word for the operation is attested in the corpus, on wo.wikipedia or in "
            + "the kaikki referee. Not read, and the mark stays visible to the RAWMARK gate.",
        divide: "×0 in the retained text. Same definitive absence as `plus-minus`.",
    },
    ilo: {
        // ⚠ EVERY COUNT BELOW IS OVER THE MINED ilowiki CORPUS — 38,655 paragraphs extracted from the
        // `ilowiki` dump, 43,258 kept by `filter-by-language.py --lang ilo` (a new row whose CONTRAST set
        // had to be measured: `para`, `mula`, `hindi`, `wala`, `usa`, `mao` and `dili` all look like
        // Tagalog/Cebuano markers and are ordinary Ilocano or ordinary Ilocano topics), 38,673 unique
        // mined. `attest.ts` against ilo.wikipedia is the second tier. Every refusal is argued at length
        // in src/languages/ilocano/normalize.ts.
        // ⚠ THE ARITHMETIC SIGNS ARE NOT ONE PROBLEM BUT TWO, AND THEY ARE SEPARATED HERE. `<` x10,
        // `>` x37, `÷` x0 and `±` x15 are essentially an ABSENCE — trap 48's shape, a definitive negative.
        // `+` x243, `=` x150 and `×` x19 are the harder case: the signs are common and every candidate
        // WORD fails on sense. Both kinds are recorded with their evidence rather than collapsed.
        // ⚠ `minus` IS DELIBERATELY ABSENT, AND THAT IS WHY `review.ts --lang ilo` STAYS RED ON IT — the
        // ak / ln / bm stance. An accepted silence claims the drop is CORRECT, and this one is not: omitting
        // a plus is lossless, omitting a minus INVERTS. Unlike most of the fleet, ilo's leading minuses are
        // not ranges in disguise — they are GENUINE NEGATIVES, and there are six of them in the artifact
        // alone: `nalawag a kapigsa iti \u22124.6` (a stellar magnitude), `temperatura ti 49 K
        // (\u2212224 \u00b0C)`, `Manipud \u22120.4 aginggana ti 5.5`, `-9.3 \u00b0C`, `naabutanna ti
        // \u221289 \u00b0C (\u2212129 \u00b0F)`, and the UTC offsets `ti timbengan ti oras ket -5 nga oras`.
        // ⚠ WHAT IS MISSING IS A WORD, AND EVERY CANDIDATE FAILED ON SENSE. `minus` is x3 in the corpus and
        // all three are SPECIES EPITHETS — `Syzygium minus`, `Hypocalymma minus`, `Empodisma minus` (trap 37
        // with a healthy-looking count). `menos` is x0. `negatibo` is x48 and every instance is the
        // ADJECTIVE, never digit-adjacent — `negatibo a komento`, `negatibo a kargo nga elektron`, `negatibo
        // wenno positibo a bisiesto a segundo` — a modifier of a noun and not the sign of a number, which is
        // the Fula `hakkunde` part-of-speech lesson. `kurang` x12 is 'lacking/insufficient'. Reading any of
        // them would be confidently wrong in the one class where confidently wrong INVERTS THE VALUE, so
        // the sign stays unread and the gate comes green the day an Ilocano negative-number word is
        // attested, not before.
        plus: "x243, and the sign is real while no operator word is. Read in context the instances split "
            + "three ways and none wants the arithmetic word: a STELLAR MAGNITUDE or declination "
            + "(`ti patingnga a kadakkel iti init ket +4.83`, `panagpababa a +27.4\u00b0`, `iti +6.1`), a "
            + "UTC OFFSET (`ti UTC iti +08:00`, and there are 103 of those), and ETYMOLOGY or TITLES "
            + "(`pre- 'sakbay' + sedere 'agtugaw'`, `Travel + Leisure`, the Christian cross glossed as "
            + "`addaan iti porma a '+' a senial`). Cebuano's `dugang` does NOT transfer \u2014 it is x0 "
            + "here \u2014 and `nayon` x6 is 'increase/addition' in a salary sense, never an operator. "
            + "The playbook's own conclusion for this sign holds: a measurement plus is frequently omitted "
            + "and only a UTC offset is contentful, and nothing in this language attests how to say it",
        "plus-minus": "x15, and every one is a TOLERANCE rather than an operation: `24 nga oras \u00b1 30 "
            + "a segundo`, `iti agarup a \u00b10.001%`, `glusemiko nga indeks a 39\u00b13`, `sumakop ti "
            + "\u00b140 \u00b0C`. No Ilocano word for the sign occurs anywhere in the corpus or on "
            + "ilo.wikipedia, and composing one would need the minus word this language does not have "
            + "(see above), so the compound cannot be built from attested pieces either",
        equals: "x150, and reading it as an arithmetic word would be wrong for most of them. The dominant "
            + "sense is a GLOSS \u2014 `(Am=amianan; Dy=daya)` expanding a compass abbreviation, "
            + "`Griego zoion = ayup ken logia = agadal`, `mikron = bassit` \u2014 where the sign means "
            + "'is', not 'equals', and Ilocano writes that with the topic marker `ket`, which the "
            + "sentence usually already has. The genuinely arithmetic instances are a handful "
            + "(`A = Z + N`, `26 \u00d7 26 \u00d7 26 = 17576`). `katumbas` \u2014 the obvious candidate "
            + "\u2014 is x1 and it is not the operator: `ti akinbaba a Mamberamo ket awan iti katumbas "
            + "iti dayta a pamilia` ('has no counterpart in that family'). One instance, wrong sense",
        "less-than": "x10, `>` x37, and neither has a word. Both signs occur almost entirely inside "
            + "chemical, mathematical or markup residue (`< 0.4 gr/ku pie`), and no Ilocano reading for "
            + "either is attested in the corpus or on ilo.wikipedia. A definitive negative (trap 48)",
        "greater-than": "See `less-than`. x37, and the same absence of any candidate word",
        times: "x19, AND THE SENSES DO NOT AGREE, which is why no `multiply` is declared even though "
            + "Cebuano declares one. The instances are a PRODUCT (`17 \u00d7 2\u00b9\u2076`, "
            + "`26 \u00d7 26 \u00d7 26`, `2.5 \u00d7 10\u2076 km\u00b3`), a DIMENSION "
            + "(`10\u00d710\u00d710`), and \u2014 the ones that settle it \u2014 the BOTANICAL HYBRID "
            + "SIGN: `Musa \u00d7 paradisiaca`, `Musa acuminata \u00d7 M. balbisiana`. That last is read "
            + "as neither 'times' nor 'by' in any language. `pilo` x69 is the corpus's multiplicative "
            + "(`ka pilo`), but it is a nominal '-fold', not an infix operator, and it is never "
            + "digit-flanked here; `daras` x8 is 'times' in the frequency sense (`iti maikadua a daras`, "
            + "'for the second time'), which is a different word for a different concept",
        divide: "x0. The sign does not occur in 38,673 paragraphs. A query that was run, not a gap",
    },
    hil: {
        // ⚠ EVERY COUNT BELOW IS OVER THE WIKIMEDIA INCUBATOR'S Wp/hil, because there is no hil.wikipedia
        // and no FLEURS hil. meta's sitematrix lists Wikipedias for bcl, ceb, ilo, pag, pam, tl and war and
        // NO hil site of any kind, so `attest.ts` cannot be run for this language and there is no second
        // haystack behind the corpus. The corpus is 3,799 paragraphs after `filter-by-language.py --lang
        // hil` (whose CONTRAST row had to be tl+ceb, not English). The second source throughout is
        // Kaufmann, *Visayan-English Dictionary* (Iloilo, 1934), 23,557 entries. Both are argued at length
        // in src/languages/hiligaynon/normalize.ts.
        // ⚠ AND THE ARITHMETIC SIGNS ARE NOT A SOURCING PROBLEM HERE, THEY ARE AN ABSENCE: `± < > × ÷` are
        // ×0 in the whole corpus, `=` is ×1 and `+` is ×1. This is the playbook's trap-48 shape — a
        // definitive negative, worth spending the effort on because it closes the question.
        minus: "measured: ZERO. The `minus` DROPPABLE shape — a dash opening a string or following a "
            + "space/bracket with a digit after it — has no instances at all in 3,799 paragraphs. Every one "
            + "of the corpus's 10 digit-flanked dashes is a RANGE and every one IS read (`hasta`, "
            + "normalize.ts step 4): year spans (`(1910-1912)`, `1967-1972`, `c. 1303–1213 BC`), a date "
            + "span (`9 Enero 1902–26 Hunyo 1975`) and one decimal span (`3.5–3.8 bilyon ka tinúig`). No "
            + "negative-value word occurs either: `menos` ×1 is the Spanish adverbial phrase `mas o menos "
            + "23.9 ka milyon` (\"more or less\"), never an operator",
        plus: "measured: ONE `+` in the corpus, and it is a GREEK ETYMOLOGY GLOSS — `naghalin ni siya sa "
            + "Griyego arkhitekton (arkhi-, lider + tekton, ga obra bilding)`, the same shape tl records "
            + "(`astron + nomos`) and ak records (`pseudo + epistaxis`). ⚠ That paragraph is itself part "
            + "Tagalog (`Ang arkitekto AY may kaalam`), which is one more reason not to build a Hiligaynon "
            + "rule on it. No plus word is attested digit-adjacent: `dugang` ×3 is the ADJECTIVE "
            + "\"additional\" (`ang dugang nga sugpon`, `may dugang nga 73 ka mga pwesto`), never an "
            + "operator — so Cebuano's `dugang` plus rule does not transfer to hil",
        "plus-minus": "measured: zero ± in the corpus",
        equals: "measured: ONE `=` in 3,799 paragraphs and it is not an operator — `buttonlabel=Maghimo "
            + "sang bag-o nga artikulo`, MediaWiki `<inputbox>` markup that survived extraction. "
            + "`katumbas` ×1 is the ADJECTIVE \"equivalent\" (`isa ka katumbas nga organisasyon sang mga "
            + "girl scout`), not a copula for a sign, and it is never digit-adjacent",
        "less-than": "measured: zero < in the corpus",
        "greater-than": "measured: zero > in the corpus",
        times: "measured: zero × in the corpus. `beses` ×2 is the ITERATION sense — `Tatlo ka beses siya "
            + "nagsilbi bilang Presidente` (\"three times he served\") — which is trap 37's shape: a real "
            + "word, healthy-looking, and the wrong sense for a multiplication sign. `pilo`, the Cebuano "
            + "multiplier, is ×0",
        divide: "measured: zero ÷ in the corpus",
        degrees: "measured: FOUR ° and they are all in ONE SENTENCE, a geographic COORDINATE — `Ang banwa "
            + "sang Tapaz yara sa latitudo nga 11° 09’ hasta 11° 09’ 42\"`. There is no temperature "
            + "instance anywhere: `°C`/`°F`/`℃` are ×0, and so are `Celsius`, `Fahrenheit`, `selsiyus`, "
            + "`sentigrado` and `digri`. ⚠ THE REFUSAL IS ON SENSE, NOT ABSENCE OF A WORD, which is the "
            + "distinction the Igbo lesson turns on: Kaufmann DOES carry `grádo, (Sp. grado) Grade, class, "
            + "degree`, so hil has a degree word — but a coordinate needs a coordinate reading (degrees, "
            + "arc-minutes, arc-seconds, hemisphere letter), not a bare degree word bolted onto the number, "
            + "and voicing ° alone would leave the ’ and \" silent beside it. tl and yo record the same "
            + "coordinate-only refusal",
        currency: "measured: the ONLY currency sign in the corpus is `₱` ×1, and it IS declared and read "
            + "(→ `piso`; the artifact scan reports that instance as REDUNDANT, not dropped, because the "
            + "sentence names the currency in words as well). This exemption covers the probe's `$5`: `$`, "
            + "`€`, `£` and `¥` are ×0 in the corpus, and `dolyar`/`dolar` are ×0 in the corpus, ×0 in "
            + "Kaufmann's 23,557 entries and ×0 in both referees. Cebuano declares `$`→`dolyar` on ×4 "
            + "corpus dollars; hil has none, and inventing one is the Fula `tere` failure",
    },
    ee: {
        // ⚠ THERE IS NO FLEURS FOR EWE, so every count below is over `tools/corpus/mined/ee.jsonc` (an
        // ee.wikipedia dump, 5,921 paragraphs, 398 retained) with `attest.ts` against ee.wikipedia as the
        // second tier, and `sources.ts` reports espeak does not ship this language at all. Every refusal is
        // argued at length in src/languages/ewe/normalize.ts's header.
        degrees: "measured: `°C` ×3 and NO Ewe degree word or scale name exists. `Selsius`/`selsius` are "
            + "×0 on ee.wikipedia and `sources.ts` agrees: `[NONE] scale-names — nothing follows ° in the "
            + "corpus but the bare letter`. ⚠ AND THE COST IS WORSE THAN A DROPPED SIGN, which is why it is "
            + "stated here rather than left implicit: ⟨C⟩ reads through Ewe's OWN ⟨c⟩ = /t͡s/, so `22 °C` is "
            + "*blaeve vɔ eve t͡s* — a phantom syllable (trap 56). Deleting the letter would lose the unit "
            + "outright and a word would be an invention, so it stands",
        exponent: "measured: NO square or cube word exists — `attest.ts --after kilometa,meta,milimeta` "
            + "returns only `ɖeka` and `miliɔn`, i.e. the slot is filled by the FIGURE and there is no "
            + "modifier to find. ⚠ THE SILENCE IS DELIBERATE AND IT IS THE LESSER OF TWO WRONG READINGS "
            + "(trap 53). All 8 of this corpus's area figures write the ASCII `km2`, so ak's refusal — "
            + "leave the key unclaimed before an exponent — would ship Igbo's `790 km2` → \"kilometres "
            + "TWO\", an invented quantity. What this wiki DOES is write an area with the bare unit noun: "
            + "`eƒe lolome nye kilometa 20,271 sq`, `tsi si ƒe lolome nye kilometa 19,022 (7,344 mi2)`, and "
            + "Africa's 30 million km² as `kilometa miliɔn 30`. normalize.ts step 4 therefore reads `km2` "
            + "and `km²` as `kilometa` — this corpus's own convention for exactly this slot — and loses the "
            + "\"square\" the corpus also loses, instead of inventing a number",
        times: "measured: the only × in the corpus is `meta 4 × 100`, a RELAY dimension — which is \"by\" "
            + "and not \"times\" (the ak and bm finding, reproduced). No Ewe multiply word is attested "
            + "digit-adjacent, and `sources.ts` reports `chk?` with nothing found",
        // ⚠ `minus` IS DELIBERATELY ABSENT, and the class is not clean. Its 6 corpus instances read back as
        // a lifespan dash (`24 September 1844 –1938`), a judo WEIGHT CLASS (`−63 kg`, i.e. "under 63 kg"),
        // `Nigeria -7`, and four `[ -1]`…`[ -4]` REFERENCE markers — not one a negative quantity. But
        // omitting a plus is lossless where omitting a minus INVERTS, and no Ewe word for a negative is
        // attested anywhere, so this one stays red rather than being declared correct. Same stance as ak,
        // ln, bm and rw.
    },
    ak: {
        // ⚠ ak.wikipedia IS LOCKED — its entire extract is the notice pointing at the Twi and Fante wikis —
        // so every measurement below is over tw.wikipedia (27,415 paragraphs) + fat.wikipedia (9,029), and
        // `sources.ts` reports espeak does not ship this language at all. The refusals are argued at length
        // in src/languages/akan/normalize.ts's header.
        degrees: "measured: `°C`/`°F` ×103 tw + 24 fat and NO Akan degree word or scale name exists. "
            + "`Celsius` ×1 and `Fahrenheit` ×2 are leads, not findings. The 354 tw + 353 fat hits for "
            + "*degree* are the ACADEMIC degree — `Master's degree`, `bakyela degree wɔ Law` — which is the "
            + "trap-37 shape with a count healthy enough to convince. `sources.ts` agrees: `[NONE] "
            + "scale-names`. The `C` still reads as a bare [k], which is the visible half of the same gap",
        plus: "measured: 18 tw + 3 fat, and not one is arithmetic — `Senegal + Liberia` (a range of "
            + "countries), the etymological gloss `pseudo + epistaxis`, `Mixed (Cultural + Natural)` (a "
            + "UNESCO category) and `UTC +14:00`. No Akan word for the operator is attested digit-adjacent",
        "plus-minus": "measured: zero ± across both wikis",
        equals: "measured: 108 tw + 5 fat, and the bulk is WIKI SECTION HEADING residue that survived "
            + "extraction (`== Ankorankoro asetra ==`, `== Amanyɔsɛm ==`) — reading the sign would say an "
            + "equals word twice on every heading. The handful that are real are a vote tally (`no mu = "
            + "78.6%`) and one linguistic gloss. No Akan equals word is attested in the slot",
        times: "measured: 19 tw + 11 fat, and every one read is either a BOTANICAL HYBRID (`Citrus × "
            + "latifolia`) or a RELAY/DIMENSION cross (`mita 4 × 100`, `4x100m`), which is \"by\" and not "
            + "\"times\" — the bm finding, reproduced here",
        divide: "measured: zero ÷ across both wikis",
        "less-than": "measured: zero < across both wikis (the `<` in the artifact is markup residue)",
        "greater-than": "measured: zero > across both wikis",
        // ⚠ `minus` IS DELIBERATELY ABSENT. All 39 tw leading minuses read back as EN-DASH RANGES, which
        // normalize.ts step 8 claims — but the coordinate `6.28ɛ; -1.850` is a GENUINE negative and no Akan
        // word for one is attested anywhere. Omitting a plus is lossless; omitting a minus INVERTS, so this
        // one stays red. Same stance as ln, bm and rw.
    },
    shi: {
        // ⚠ THERE IS NO FLEURS FOR TASHELHIT, so every count below is over `tools/corpus/mined/shi.jsonc`'s
        // 403 retained segments (203 hard + 200 sample) from a shi.wikipedia dump, and `sources.ts` reports
        // espeak does not ship this language at all — so the haystack is the corpus, the artifact, two
        // Wiktionary-derived referees and shi.wikipedia via `attest.ts`. Every refusal is argued at length
        // in src/languages/tashelhit/normalize.ts's header.
        // ⚠ THE ARITHMETIC BLOCK IS A DEFINITIVE NEGATIVE, NOT A SOURCING GAP — the playbook's trap-48
        // shape. Almost every sign in this corpus is RAW TeX that survived extraction from two articles (the
        // natural logarithm and the binomial theorem), and no reading of markup is correct.
        percent: "NOT a markup case and this language's LARGEST class — `DROP percent ×136` before this "
            + "layer, 234 number+% instances in 403 segments, 24,338 in the whole-corpus cell count. It is "
            + "nevertheless unsourceable, and the reason is structural. `tigmiḍi` is attested 120 tokens / "
            + "20 shi.wikipedia articles and is the wrong slot: every instance is the section heading "
            + "`Tigmiḍi n tagufi (…) : 17,9%`, i.e. the NOUN \"percentage\" standing BEFORE its figure and "
            + "written BESIDE the sign, so emitting it after the number gives \"17.9 percentage\" — the Fula "
            + "`tere` shape. `attay` (×5) fails identically. Every candidate SPELLING is ×0 on "
            + "shi.wikipedia: afmiḍi, tamiḍi, amiḍi, `ɣ mya`, `f mya`, `zɣ mya`, `g mya`, `ɣ timiḍi`, lmya, "
            + "lmiya, almya, pursan, purṣan. `timiḍi` ×20 IS attested and is the literary numeral 100 plus a "
            + "douar name (×18 of the 20). `concept.ts` on Q11229/Q137985650 finds no article in shi, kab, "
            + "zgh OR ary. ⚠ AND `attest.ts --after ɛcrin,xmsin,tlatin,mya,sbɛin` returns NOTHING — this "
            + "wiki never spells a numeral out at all, so the reading of the SIGN is absent from text by "
            + "construction and no extra corpus would find it; the escalation tier for that is the corpus's "
            + "own AUDIO, and shi has none. Web search offers only the Moroccan DARIJA `f-lmya`, which is a "
            + "fact about Darija. A wrong percent word is worse than a dropped sign",
        equals: "measured: 23, and NOT ONE is arithmetic in running prose. 22 are raw LaTeX from the "
            + "logarithm and binomial-theorem articles (`\\ln(a^n) = n \\ln(a)`, `n=2,& (x + y)^2 &= x^2 + "
            + "2xy + y^2`); the 23rd is a glossary SYNONYM list, `Tibḍit = afukku = afray`, where an equals "
            + "word would be wrong even if one were attested. No shi equals word occurs digit-adjacent",
        ampersand: "measured: 20, and EVERY ONE is the LaTeX ALIGNMENT ampersand in a single displayed "
            + "equation array (`n=3,& (x + y)^3 &= …`, `+ y^4,&&\\\\`). There is no conjunction use in the "
            + "corpus at all, so this is markup residue rather than the fleet's `B&B` defect, and no "
            + "reading of it — including the correct Tashelhit `d` — would be right in a single instance",
        times: "measured: 1. `attayen n 1,989 1 × 1030 kg` — the Sun's mass in SCIENTIFIC NOTATION, where "
            + "the sign is a mantissa multiplier rather than a dimension cross or a product, so neither a "
            + "`times` nor a `by` word fits it. ASCII `\\d ?x ?\\d` is ×0, so the `4x4` arm has nothing to "
            + "claim either. One instance is not a rule",
        plus: "measured: 55, and every one read back. The bulk is LaTeX (`\\in ]0 ; + \\infty[`, `x + y`, "
            + "`x^7+7x^6y`) and π-series terms (`(4/1)-(4/3)+(4/5)-(4/7)`). What remains splits two ways, "
            + "and BOTH are the classes trap 48 settled fleet-wide: UTC-style offsets (`tlla gr -12 d +12`, "
            + "`gr +1 ar +12`, a timezone-letter table) and a MEASUREMENT plus (`i ur izzrayn +25 n tskflt` "
            + "— and this layer now reads that `n tskflt` itself, so the figure is spoken as a temperature "
            + "either way). Omitting a plus is lossless. Nothing attests how shi would say one",
        "plus-minus": "measured: zero ± in the artifact",
        divide: "measured: zero ÷ in the artifact",
        "less-than": "measured: zero < in the artifact",
        "greater-than": "measured: 5, and none is a comparison this layer could read: three are LaTeX "
            + "(`x > 0`, `y > 0`), one is the HTML comment terminator `-->` that survived extraction, and "
            + "the last is a clinical threshold whose UNIT is undeclared (`tawsmulalit tablazmant > 295 "
            + "mOsm/kg`) — reading the sign there would speak half a measurement",
        // ⚠ `minus` IS DELIBERATELY ABSENT AND STAYS RED. Omitting a plus is lossless; omitting a minus
        // INVERTS. The 15 leading minuses in the retained text split THREE ways — a genuine negative
        // temperature (`ingr -45°Silsyus ar 30°Silsyus`), NEGATIVE YEARS used as an era marker (`sg -945
        // armi ar -924`) and UTC offsets (`gr -12 d +12`) — which is three readings and not one, and no shi
        // word for a negative is attested anywhere. Same stance as ak, ln, bm and rw.
    },
    cdo: {
        // ⚠ cdo IS THE ONE SINITIC LECT WHOSE HARD GATE IS NEITHER A DICT NOR AN ORTHOGRAPHY MISMATCH. There
        // is no Han front-end and no reading dict at all (see mindong.ts): this is a Bàng-uâ-cê → IPA
        // converter, and `baseToIpa` returns its INPUT when it cannot parse a rime, appending tone letters
        // anyway. So an unreadable string does not vanish, it LEAKS (`km` → *km˥˥*). Every refusal below is
        // therefore about a missing WORD, never a missing dict entry — and each names its measurement.
        // espeak ships no Min Dong, so the haystack is the corpus, the artifact, the Wiktionary-derived
        // referee and cdo.wikipedia.
        // ⚠ `minus` IS DELIBERATELY ABSENT, and its absence is the most considered thing in this block.
        // Measured: the artifact holds 2 GENUINE negatives, both temperatures (`dăk gáu -15 dô`,
        // `ŭng-dô sê -6~7dô`); the other 9 leading signs are the mantissa exponents of scientific notation
        // (`×10 −31 kg`, `×10 −27 kg`, `×10 −11`, `m·s −2`), two LaTeX bodies (`y^2=-2px`) and the
        // census-style parentheticals `(3%-4%)` / `(1%-2%)`, which normalize.ts step 4 now reads as percent
        // ranges. THE WORD IS WHAT IS MISSING, NOT THE RULE: ⟨負⟩ is `hô` (Wiktionary, Eastern Min) and
        // nothing corroborates it in the mathematical sense — `attest.ts` returns 49 tokens across 20
        // articles and EVERY example is a different morpheme (戶 in the radical article 戶部 and in the
        // constellation 獵戶座, 父 in 父部). gan is the one lect in this family that could ship the rule,
        // because its own integer article writes ⟨負⟩ beside the glyphs it names (`負值(-1、-2、-3...)`);
        // cdo has no such sentence. Omitting a plus is lossless; omitting a minus INVERTS, so a known-wrong
        // reading does not get to be a green gate and `review.ts --lang cdo` stays RED on this class.
        // Same stance as ak, ln, bm, mad and rw.
        plus: "measured: zero digit-adjacent `+` in the artifact that is arithmetic. What occurs is the "
            + "language name `C++`, a GDP identity written as an equation of labelled terms (`… (C) + "
            + "Dàu-cṳ̆ (I) + Céng-hū siĕu-hié ciĕ-chók (G)+ Chók-kāu (X) - Céng-kāu`), a number-theory "
            + "example (`100 = 23 + 7 · 11`), balanced chemistry in LaTeX (`\\rm 2NaCl + H_2SO_4`) and an "
            + "article ABOUT the sign (`Gă-huák gì hù-hô̤ sê „+“`). No cdo word for the operator is "
            + "attested digit-adjacent anywhere",
        equals: "measured: every `=` is either LaTeX/wiki markup (`y^2=-2px \\quad \\left (p>0 \\right)`, "
            + "`isbn = InputBox(`, `S={\\color{Red}7}\\times10+…`), a definition of a labelled quantity "
            + "(`GDP) = Sṳ̆-ìng siĕu-hié (C)`, `F = ma`), or a bibliographic gloss (`ISBN Users'Manual = "
            + "[國際標準書號使用者手冊]`). No cdo equals word is attested in the slot",
        times: "measured: all 8 `×` are SCIENTIFIC NOTATION (`9.10938356(11)×10 −31 kg`, `6.67 × 10 −11`, "
            + "`1.672621898(21)×10 −27 kg`, `5×10 30`) plus one RELAY LEG (`nàng-gái 4×100 mī`), which is "
            + "\"by\" and not \"times\" — the bm/ak finding again. This layer reads scientific notation for "
            + "no language, and no cdo multiply word is attested",
        divide: "measured: zero ÷ in the artifact",
        "plus-minus": "measured: zero ± in the artifact",
        "less-than": "measured: zero digit-adjacent < in the artifact (`≥10℃` is the only comparison and "
            + "it is ≥, whose reading would need a word too)",
        "greater-than": "measured: the only `>` are a LaTeX condition (`\\left (p>0 \\right)`) and the "
            + "phonological-change arrows of the Fuzhou sound-change tables (`cṳā > cāi`, `hṳa > hie`), "
            + "which are notation and not a relation at all",
        ampersand: "measured, and this is a DELIBERATE DIVERGENCE FROM EVERY OTHER SINITIC LAYER, all of "
            + "which declare the word. After the registry decodes entities and strips markup — the "
            + "artifact's raw `&` are mostly `&nbsp;` and `&#x3A;` and never reach the layer — SIX remain "
            + "and ALL SIX sit inside Latin proper names: `AT&T` ×3, `Ebaugh, Helen Rose Fuchs & Chafetz`, "
            + "`Thames & Hudson`, `Ngâng-dièng Gáu-tuàng & THE Mìng-sĭng Rockets`. gan declared ⟨同到⟩ on "
            + "the strength of ONE Han-flanked instance; cdo has ZERO BUC-flanked ones, so declaring "
            + "⟨gâe̤ng⟩ (the language's ordinary 'and', ×162 in the corpus, attested 31/20 on the wiki) "
            + "would only ever put a Fuzhou syllable inside an English company name. Trap 18's merge hazard "
            + "is the argument on the other side and it is INERT here: cdo has no letter-name table, so "
            + "`AT&T` and `ATT` both leak raw either way",
        currency: "measured: `currency: 0` in the artifact — no $, €, £ or ¥ occurs anywhere in this "
            + "corpus, so there is no sign to read and no name to source",
    },
    ceb: {
        // ⚠ NO CEBUANO DEGREE WORD IS ATTESTED ANYWHERE IN THE CORPUS. `grado` ×0, `digri` ×0, `celsius` ×0 —
        // and the corpus is FLEURS rather than the wiki (see cebuano/normalize.ts for why), so there is no
        // larger haystack to fall back on for this language: ceb.wikipedia is ~99% Lsjbot boilerplate and an
        // attestation there would be a fact about a template. The sign occurs ×2. Naming a reading would be
        // invention of exactly the kind the Fula `tere` lesson forbids, so `°` stays unread and stays VISIBLE
        // as a RAWMARK the scan can see, which is the better failure.
        degrees: "no Cebuano degree word in FLEURS (grado/digri/celsius all ×0) and the wiki is bot-generated",
        // ⚠ THE SAME REFUSAL, FIVE MORE TIMES, AND FOR THE SAME REASON: this corpus contains none of these
        // signs (`=` `<` `>` `±` `÷` are ×0 apiece) AND no Cebuano word for any of them — `katumbas`
        // (equals) ×0, `minus` ×0. The two arithmetic words it DOES carry are spent: `dugang` ×32 reads `+`
        // and `pilo` ×14 reads `×`. Writing five more readings out of a 1,932-sentence corpus that attests
        // neither the sign nor the word is exactly the Fula `tere` failure, so they stay unread.
        // ⚠ AND ceb HAS NO SECOND HAYSTACK. For most languages an unattested word can be probed against
        // Wikipedia; ceb.wikipedia is ~99% Lsjbot-generated, so a hit there is a fact about a template.
        // That is why this list is longer here than anywhere else — the refusal is better evidenced, not
        // lazier.
        minus: "sign ×0 and no Cebuano word (minus ×0, kulang is 'lacking'); FLEURS is the only usable corpus",
        "plus-minus": "sign ×0; the ± reading would compose two words, neither of which is attested",
        equals: "sign ×0 and katumbas ×0 (parehas ×31 means 'the same', not the relation)",
        "less-than": "sign ×0 and no comparative-magnitude phrase attested",
        "greater-than": "sign ×0 and no comparative-magnitude phrase attested",
        divide: "sign ×0; gibahin ×2 is 'divided' in the partition sense, not the operator",
    },
    gan: {
        // ⚠ THE HARD GATE FOR THIS LANGUAGE IS THE DICT, NOT THE CORPUS — gan HAS a real corpus (a
        // gan.wikipedia dump, 3,020 segments, 29/35 cells), which cjy and hsn did not. But
        // `sinitic/hanDictIpa.ts` skips an uncovered character SILENTLY, so an unsourced word does not
        // mispronounce — it VANISHES, which is worse than leaving the symbol unread. Every refusal below
        // names which of the two evidences decided it.
        plus: "measured: the corpus's 20-odd `+` contain NO arithmetic. They are a GRAMMAR NOTATION "
            + "(`“動詞+得+補語+賓語”`, the Gan verb-complement schema, ×10 in one paragraph), the language "
            + "name `C++` ×4, balanced CHEMICAL EQUATIONS (`2H₂O+2e⁻=H₂↑+2OH⁻`, `MnO₂+4HCl=MnCl₂+…`), a "
            + "LaTeX body (`e\\,^{i \\pi} + 1 = 0\\;`), a naming schema (`「名 + 爺名 + 姓」`) and an "
            + "asteroid designation (`沃虎+585`). And the word is unavailable anyway: ⟨加⟩ is SILENT in this "
            + "dict, so emitting it would delete the operator rather than read it",
        equals: "measured: every `=` is set theory (`0=0/1`, `2'=0' ' '={0,1,2}={0,{0}}`), a chemical "
            + "equation, an abbreviation gloss (`American English = AE`) or EasyTimeline markup "
            + "(`PlotArea = left:10`). ⟨等於⟩/⟨等于⟩ is HALF — the engine emits tɛn˨˩˧, one syllable of "
            + "two, dropping 於 — so the reading would be a truncated word",
        times: "measured: all 3 `×` are SCIENTIFIC NOTATION (`1.6 × 10⁻¹⁹ 庫侖`, `1.6726231 × 10⁻²⁷ kg`, "
            + "`半衰期有1.9×10¹⁹年`), which this layer reads for no language. ⟨乘⟩ is SILENT in this dict",
        divide: "measured: zero ÷ in the corpus. ⟨除⟩ does speak, unlike ⟨乘⟩, but there is nothing to read",
        "plus-minus": "measured: both ± are a MEASUREMENT UNCERTAINTY in one sentence on luminescence "
            + "dating (`36.1±2.6ka同到 64.2±4.9ka`). ⟨正負⟩ is HALF (emits fu˩˩, dropping 正), so the "
            + "reading would be the minus word alone — which INVERTS the sense of a tolerance",
        "less-than": "measured: zero digit-adjacent `<` in the corpus. ⟨小於⟩ is HALF (drops 於)",
        "greater-than": "measured: the only `>` is a mathematical definition of π quoted in prose "
            + "(`最細嗰 x > 0 讓 sin(x) = 0`) and two fullwidth `＞` inside a LaTeX chemistry condition "
            + "(`（條件：＞900&nbsp;°C）`). ⟨大於⟩ is HALF (drops 於)",
        degrees: "measured: the corpus's `°` are COORDINATES (`東經116°57′--117°42′`, `北纬27°33′-28°05′`), "
            + "COMPASS BEARINGS (`係N90°E或者S90°E`, `符號090°`) and an article ABOUT the sign itself "
            + "(`一份就係1度（1°）`) — plus exactly ONE real temperature (`熔點380℃`). And the word is "
            + "unavailable: ⟨度⟩ is SILENT in this dict, ⟨攝氏⟩ is HALF (sz̩˩˩ — it would say 'shì' and drop "
            + "'shè') and ⟨攝氏度⟩ emits 1 syllable of 3, so `20°C` would lose the WORD as well as the sign "
            + "— strictly worse than the raw sign, which at least survives as a RAWMARK the scan can see. "
            + "⚠ Note the corpus writes `係090度，符號090°`: the word is there and it is silent too, which is "
            + "a DICT gap and not a normalization one",
        currency: "n/a — the `$` IS read (美元, through the shared tier). ⚠ IT WAS DECLINED ON THE CORPUS "
            + "FIRST and the reversal is worth recording: the corpus's 4 `$` are all in ONE article, a film's "
            + "box office labelled as UK takings, and the only money word it attests is 美金 ×1 in a fine — "
            + "so on corpus evidence a currency word would have been a guess of the Fula `tere` kind. "
            + "`attest.ts` supplied the sense: gan.wikipedia writes 美元 ×5/4 articles in monetary amounts "
            + "AND glosses the sign itself (`美金（United States dollar），又叫美圓、美元，符號USD或者US$`). "
            + "Only `$` is declared; €, £ and ¥ are ×0 here and stay unread",
        ampersand: "n/a — the ampersand IS read (同到, the corpus's own coordinator ×59, every instance "
            + "coordinating; normalize.ts declares it through the shared tier)",
    },
    hsn: {
        // ⚠ THERE IS NO hsn.wikipedia AND NO REFEREE. Every reason below is read off the Wikimedia Incubator's
        // `Wp/hsn` — 153 pages, 30,640 characters, the only Xiang text that exists — plus a DICT CHECK through
        // the shipped engine, which is the harder gate: `sinitic/hanDictIpa.ts` skips an uncovered character
        // SILENTLY, so an unsourced word does not mispronounce, it VANISHES.
        times: "measured: `×` occurs ONCE in the whole corpus and it is SCIENTIFIC NOTATION — `質量5.9742×"
            + "10²⁴公斤`, the mass of the Earth — which this layer reads for no language. And the word is not "
            + "available anyway: ⟨乘⟩ is SILENT in this dict, so emitting it would delete the operator rather "
            + "than read it",
        equals: "measured: `=` is digit-adjacent 0 times; the corpus's `===` runs are wiki heading markup. "
            + "⟨等於⟩/⟨等于⟩ is HALF — the engine emits tən˦˩, one syllable of two, dropping 於 — so the "
            + "reading would be a truncated word",
        plus: "measured: zero digit-adjacent `+` in 30,640 characters",
        minus: "measured: the only digit-flanked dashes are the 3 ranges the layer READS (到, normalize.ts "
            + "step 6) and the coordinate span `東經111°53'－114°5'`. No negative number occurs",
        "plus-minus": "measured: zero ± in the corpus",
        "less-than": "measured: zero < in the corpus",
        "greater-than": "measured: zero > in the corpus",
        divide: "measured: zero ÷ in the corpus. ⟨除⟩ does speak, unlike ⟨乘⟩, but there is nothing to read",
        exponent: "⚠ THE SQUARED/CUBED UNIT IS READ (平方/立方 compose onto the unit noun, normalize.ts step "
            + "4); a BARE superscript is not, and that is this corpus's sharpest finding. Of its 24 "
            + "superscript runs **23 are ROMANIZATION TONE NUMBERS** from the 湘語羅馬字 tables the incubator "
            + "carries — /ʃɘ̃⁴⁵/, /ye²⁴/, /mɔ⁴²/, /tɕiɑʌ⁴⁵/, /n̩⁴²/ — and exactly ONE is an exponent "
            + "(5.9742×10²⁴). Reading superscripts as powers would turn a pronunciation table into "
            + "arithmetic. hsn is the FIFTH Sinitic corpus to produce this hazard from a fifth source, after "
            + "wuu, nan, cjy and hak; test/accepted-silent.test.ts predicted it here by name",
        // ⚠ THE KEY IS `degrees`, PLURAL — it must match the PROBE name in review.ts's signCases, not the
        // DROPPABLE class name. Spelled `degree` here it silently exempts nothing and the gate still fails.
        degrees: "measured: the corpus's only 2 `°` are COORDINATES (`東經111°53'－114°5'`, `北緯27°51'－"
            + "28°40'`), where neither the degree nor the primes has a reading. And the word is unavailable: "
            + "⟨度⟩ is SILENT in this dict and ⟨攝氏⟩ is HALF (sz̩˦˥ — it would say 'shì' and drop 'shè'), so "
            + "`20°C` would lose the WORD as well as the sign — strictly worse than the raw sign, which at "
            + "least survives as a RAWMARK the scan can see",
        currency: "measured: NO currency sign occurs in the 30,640-character corpus at all — not ¥, not $, "
            + "not €. ⟨元⟩ speaks and appears ×33, but every instance is an already-spelled amount "
            + "(`可支配收入12434元`) — the WORD, never a sign to rewrite. Declaring a currency would be "
            + "robustness for input this language has never been observed to write, and the sign probe would "
            + "then be reporting on a rule with no evidence behind it",
        ampersand: "n/a — the ampersand IS read (跟, the corpus's own coordinator ×136 against 和 ×63; "
            + "normalize.ts declares it through the shared tier)",
    },
    mg: {
        // ⚠ THE MINUS IS A BCE YEAR, NOT ARITHMETIC — and it is the bot template that writes it. Every one
        // of the 22 mined instances is either an ancient-biography stub (`Croesus … dia teraka ny
        // 1 Janoary -596 ary maty ny 1 Janoary -546`, "born 1 January -596, died 1 January -546") or a
        // negative COORDINATE from the commune stubs (`-97.0602777778`). Neither wants "minus": the first
        // means 596 BC and the second is a longitude. `signed-number` is 15,177 in the dump and that count
        // IS the template.
        // ⚠ And the only candidate word fails on PART OF SPEECH, which is the Fula `hakkunde` shape:
        // `latsaka` ×24 is a comparative verb taking a whole clause — `tsy latsaka ny 8,5 %` ("not less
        // than 8.5%"), `latsaka 40 kilometatra atsimon'ny` ("40 km south of") — never an infix before a
        // numeral. No era phrase is attested either (`sources.ts`: "no era marker in the corpus").
        minus: "measured: all 22 mined `-` are a bot-template BCE year (`1 Janoary -596`) or a negative "
            + "coordinate; neither reading is 'minus', and latsaka is a clause-taking comparative",
        // ⚠ RE-COUNTED IN THE FLEET SYMBOL AUDIT, AND THE OLD ENTRY NAMED THE WRONG THING. It said the mined
        // `=` were spelling-article glosses; reading all ten shows NOT ONE is. Six are EasyTimeline chart
        // markup the dump extraction left in, and the remainder are a currency equivalence, an infobox field,
        // a physics formula and HTML attribute residue. The VERDICT is unchanged — none of them is a relation
        // between two numbers a reader would voice, and no Malagasy equals word is attested — but the
        // evidence behind it is not what was written down, so it is written down correctly here.
        equals: "measured: `=` ×10 in the retained text and SIX ARE EASYTIMELINE CHART DIRECTIVES the "
            + "extraction did not strip (`Period = from:-5000 till:1300`, `ScaleMajor = unit:year "
            + "increment:500`, `ImageSize = width:800 height:auto`, `PlotArea = top:15 left:50`, "
            + "`DateFormat = yyyy`, `TimeAxis = orientation:horizontal`). Of the other four, one is a "
            + "CURRENCY EQUIVALENCE between two named units rather than two numbers (`1 Ariary = 5 "
            + "iraimbilanja`), one an INFOBOX FIELD that survived stripping (`Halavany = 320 km`), one a "
            + "physics formula quoted as a display object (`T = 1/f`) and one raw HTML attribute residue. "
            + "Zero are arithmetic in Malagasy prose and no Malagasy equals word is attested in corpus or "
            + "wiki. ⚠ Chart markup is a property of the MINING PIPELINE, not of this language — the same "
            + "directives recur in an, ast, crh, haw, ig, nya, st, za and 17 more",
        times: "measured: the mined `×` are dimension crosses; no Malagasy reading is attested",
        plus: "measured: digit-flanked `+` is ×0 in the artifact",
        "plus-minus": "measured: ± is ×0 in the artifact",
        "less-than": "measured: `<` is ×0 in the artifact",
        "greater-than": "measured: `>` is ×0 in the artifact",
        divide: "measured: `÷` is ×0; the corpus's `/` instances are rates and dates",
    },
    lo: {
        // ⚠ EVERY MINED `=` AND `+` IS INSIDE A FORMULA OR A WORKED EXAMPLE, and in the clearest of them the
        // corpus writes the reading ITSELF in the very next bracket: `1,000 Hz = 1 KHz (1 ພັນແຮັກ ເທົ່າກັບ
        // 1 …)` — "1,000 Hz = 1 KHz (1 kilohertz EQUALS 1 …)". Voicing the sign there would say it twice.
        // The rest are an economics illustration (`ລົດຈັກ x1/100 ຄັນ + ເຂົ້າ x2/50 ໂຕນ`), a coordinate
        // conversion (`(D + M/60 + S/3600)`), matrix notation (`C_{2,1}=8`) and `3/4 = 0.75`.
        equals: "measured: all 38 mined math-signs are formulas, matrix notation or unit equivalences — and "
            + "the equivalences already write ເທົ່າກັບ beside the sign, so reading it would double the word",
        plus: "measured: every mined `+` is an operand in a worked example or a DMS conversion "
            + "(`(D + M/60 + S/3600)`); digit-flanked arithmetic `+` in running prose is ×0",
        // ⚠ AND `×` IS THE OPPOSITE SHAPE — the WORD is sourced and the SIGN is not. lo.wikipedia's
        // multiplication article glosses it directly: *"ການຄູນ (ມັກຈະສະແດງດ້ວຍ ສັນຍາລັກຂ້າມ ×, …)"*,
        // "multiplication (often shown with the cross symbol ×, …)". But `×` is ×0 in the mined segments:
        // there is nothing to read. Recorded here rather than declared, so the word is on file if a later
        // corpus produces the sign.
        times: "measured: `×` is ×0 in the artifact. The word IS sourced — ຄູນ, glossed against the symbol "
            + "in lo.wikipedia's own multiplication article — and is left undeclared only for want of a sign",
        // ⚠ `>` OCCURS EXACTLY ONCE AND IT IS INSIDE A UTILITY FUNCTION — `ຖ້າ u(x) > ຫຼື = u(y) (x R y)`,
        // "if u(x) > or = u(y)" — where the Lao text around it already reads the relation aloud
        // (`ຫຼາຍກ່ວາ ຫຼື ເທົ່າກັນ`, "greater than or equal to"). Reading the sign would double the phrase,
        // which is the same argument as `equals` above. `<`, `±` and `÷` do not occur at all.
        "greater-than": "measured: `>` occurs ONCE, in a utility function whose Lao gloss already says "
            + "ຫຼາຍກ່ວາ ຫຼື ເທົ່າກັນ beside it — reading the sign would say the relation twice",
        "less-than": "measured: `<` is ×0 in the artifact",
        "plus-minus": "measured: ± is ×0 in the artifact",
        divide: "measured: `÷` is ×0; ຫານ is attested as the word but there is no sign to attach it to",
    },
    kmr: {
        // ⚠ NOT ONE OF THE 15 MINED `=` `+` `×` IS ARITHMETIC, and they are not even mostly prose. Three
        // classes, none of which wants an operator reading:
        //   · a GLOSS or an etymology — `çiya = lêr`, `Deutsches Wörterbuch = Ferhenga Kurdî-Alman`,
        //     `Mesîn = me/mekan + sî/av + in/tê`, `"GNU/Linux" (GNU + Linux)`, `C++`
        //   · EasyTimeline / wiki MARKUP that survived into the artifact — `ImageSize = width:800`,
        //     `PlotArea = top:10`, `ScaleMajor = unit:year`, and URL-encoded catalogue parameters (`$003d`)
        //   · a FORMULA and scientific notation — `E=mc²`, `7.2×109 m3`, `UTC+7`
        // No Kurmanji reading of any of the three signs is attested in either haystack (the corpus and
        // ku.wikipedia — espeak does not ship this language), so all three stay unread.
        equals: "measured: all mined `=` are a gloss (`çiya = lêr`), EasyTimeline markup (`ImageSize = "
            + "width:800`) or a formula (`E=mc²`); none is a relation between two numbers, and no Kurmanji "
            + "reading is attested",
        plus: "measured: every mined `+` joins WORDS in an etymology (`me/mekan + sî/av`), a software name "
            + "(`GNU + Linux`, `C++`) or a UTC offset; digit-flanked arithmetic `+` is ×0",
        times: "measured: the only mined `×` is scientific notation (`7.2×109 m3`), which this layer reads "
            + "for no language; no Kurmanji word for the operator or the dimension cross is attested",
        // ⚠ THREE SIGNS THAT DO NOT OCCUR AT ALL, and one that arrives BROKEN. `±` and `÷` are ×0 in the
        // artifact and `>` is ×0; `<` is ×0 as a character but the corpus shows it was there upstream and
        // was mangled into a pseudo-entity — `heya &kêm; 16&nbsp;diguhere` is `&lt;` with its name
        // translated, so the one instance this language has of a less-than is unreachable by any rule and
        // is a corpus-repair question, not a reading one. None of the four has an attested Kurmanji
        // reading either: `kêm` ("less") takes a whole clause (`273.15 pileyan ji sifira Selsiyusî kêm`),
        // which is the Fula `hakkunde` shape — a real word that does not fit the slot.
        "plus-minus": "measured: ± is ×0 in the artifact and no Kurmanji reading is attested",
        "less-than": "measured: `<` is ×0 as a character — its one upstream instance arrives as the mangled "
            + "pseudo-entity `&kêm;` — and `kêm` is a clause-taking comparative, not the relation",
        "greater-than": "measured: `>` is ×0 and no comparative phrase is attested digit-flanked",
        divide: "measured: `÷` is ×0; the corpus's `/` instances are rates, dates and URLs",
    },
    si: {
        // ⚠ EVERY `=`, `+` AND `×` IN THIS CORPUS IS SOMETHING OTHER THAN ARITHMETIC, which is the whole
        // reason all three are refused rather than read. Measured over the 448 mined si.jsonc segments —
        // there is no FLEURS corpus for Sinhala and espeak does not ship the language, so the artifact and
        // si.wikipedia are the only haystacks there are.
        //
        // `=` is a GLOSSARY or table separator, never a relation: `අබ්බඩා=.....................`,
        // `මාමා = මාමා`, `Detective Comics(ඩිටෙක්ටිව් කොමික්ස්) = රහස් පරික්ෂක චිත්‍ර කථා`,
        // `ක්‍රියාකාරී අනුපාතිකය = නිශ්චිත වසරක…` (a definition heading), and the wiki markup `|alt=`.
        // The two that LOOK like equations are a variable assignment in an astronomy worked example
        // (`Y = 0.25`, `RAMC=36.0437268⁰`), where the operand is a letter and the reading would be a
        // formula rather than prose.
        equals: "measured: all 20+ mined `=` are a glossary/table separator, a definition heading or wiki "
            + "markup (`මාමා = මාමා`, `|alt=`); the only two flanking a number are variable assignments in "
            + "one astronomy worked example. No Sinhala reading is attested for the relation either",
        // `+` is an ETYMOLOGY GLOSS every time: `කොළ + අඹ යන්න කොළඹ ලෙස`, `αστρονομία = άστρον + νόμος`,
        // `astron + nomos`, and — in the article on Sinhala orthography itself — `ක් + ර = ක්‍ර : ග් + ය =
        // ග්‍ය`, which is a statement about CONJUNCT FORMATION. Reading any of them as "plus" would turn
        // word-formation into a sum. Digit-adjacent `+` is ×0.
        plus: "measured: every mined `+` joins two WORDS in an etymology or conjunct-formation gloss "
            + "(`කොළ + අඹ`, `ක් + ර = ක්‍ර`); digit-adjacent `+` is ×0",
        // `×` is a DIMENSION CROSS in all six instances, every one after `මිලිමීටර්`: `8.2×6.3×0.6`,
        // `13.7×15.3×1.5`, `8.7×7.7×1.5`, `10.0×0.6`, `40×26`, `2.5m X 2.5m`. That reading is "by", not
        // "times", and no Sinhala rendering of the dimension cross is attested in either haystack —
        // `ගුණිත` is ×0 in the corpus. th reached the same conclusion for the same shape.
        times: "measured: all 6 mined `×` are a DIMENSION CROSS after මිලිමීටර් (`8.2×6.3×0.6`), which is "
            + "'by' and not 'times'; no Sinhala reading of either sense is attested (ගුණිත ×0)",
        // ⚠ THE REMAINING THREE ARE ×0 SIGNS WITH ×0 WORDS, and both halves matter. `±`, `<` and `÷` do
        // not occur in the artifact at all, and no Sinhala rendering of any of them is attested in the two
        // haystacks this language has. `අඩු`/`වැඩි` ("less"/"more") exist as ordinary adjectives but the
        // COMPARATIVE RELATION needs a phrase around them (`…ට වඩා අඩු`), which nothing attests in the
        // slot; that is the Fula `hakkunde` failure — a real word that does not fit the position.
        "plus-minus": "measured: ± is ×0 in the artifact, and its reading would compose two words neither "
            + "of which is attested in the slot",
        "less-than": "measured: `<` is ×0; අඩු is an adjective and the relation needs a phrase (`…ට වඩා "
            + "අඩු`) that nothing attests digit-flanked",
        "greater-than": "measured: `>` is ×0; same as less-than — වැඩි is the adjective, not the relation",
        divide: "measured: `÷` is ×0; බෙදීම is the noun 'division' (and the corpus's only arithmetic `/` "
            + "instances are rates and dates), never the operator between two numbers",
    },
    ps: {
        // ⚠ NO ESPEAK PASHTO AT ALL, so every reason below is a corpus measurement over a fresh
        // ps.wikipedia dump (242,649 lines after markup and category-residue filtering) and nothing else can
        // check it. Argued at length in src/languages/pashto/normalize.ts's header.
        equals: "measured: `=` counts 7,734 and essentially NONE of it is arithmetic. The bulk is WIKI "
            + "SECTION HEADING markup that wikidump-to-text.py leaves in (`==خوي او عادتونه==`, "
            + "`==په طبيعت کښي د يورانيم موجوديت==`) and the rest is chemistry and physics copy "
            + "(`P1=750mmHg V1=290cc`). Reading the sign would say an equals word twice on every heading. "
            + "`مساوي` ×935 is the ordinary copula-adjective, never a digit-adjacent operator",
        plus: "measured: `+` counts 2,001 and is almost entirely CHEMICAL EQUATIONS — `2KMnO4+10FeSO4+"
            + "8H2SO4`, `Cl2+2NaOH → NaClO + NaCl + H2O`, `Al2O3.2H2O + 6NaOh`. `جمع` ×1,729 is the ordinary "
            + "noun 'sum/total' and the corpus never places it between two operands",
        times: "measured: `×` counts 196 and is FOUR different things in one glyph — a cartridge dimension "
            + "(`۳۹×۷،۶۲ ماډل ۴۳ گولی`), scientific notation (`1.60218 × 10 −13 J`), an equipment count "
            + "(`۲ × Lyulka AL-37FU`) and genuine arithmetic in one maths article (`1×8 + 90×8`). `ضرب` "
            + "×574 is attested but no single reading is right for all four senses",
        "less-than": "measured: `<` is digit-adjacent 1 time in the artifact, inside a temperature range "
            + "copied from an English source (`>950 °C; >1,740 °F`) — a comparative, not an operator",
        "greater-than": "measured: same instance as `less-than`, the same imported English fragment",
        "plus-minus": "measured: zero ± in 242,649 lines",
        divide: "measured: zero ÷ in 242,649 lines",
        ampersand: "measured: all 297 `&` sit inside LATIN text — `AT&T`, `P&T/Telecom Éireann`, "
            + "`Sight & Sound`, the Bangladeshi highway pair `N4 & N405`, and URL query strings "
            + "(`…&oldid=421080475`). The Pashto conjunction is `او`, and emitting it here would put a "
            + "Pashto word inside an English proper name",
    },
    ln: {
        // ⚠ NO ESPEAK LINGALA AT ALL and a 36-line referee, so every reason below is a corpus measurement
        // over a fresh ln.wikipedia dump (23,678 paragraphs) and nothing else can check it. The refusals are
        // argued at length in src/languages/lingala/normalize.ts's header.
        minus: "measured: the digit-flanked dash in Lingala is a RANGE, not a minus — 1,424 hyphens and 162 "
            + "en dashes sit between digits, and reading them gives year spans (`1965 - 1997 Mobutu Sese "
            + "Seko`, a governor list), ISBNs and the ISO code `639-3`. Of 228 LEADING dashes, two are true "
            + "negatives (`-273,15 °C`, `-1,602 189 × 10⁻¹⁹`); the rest are coordinates (`-4.2667`), a "
            + "postcode (`B-3840`), a compound (`TB-8,000`) and open-ended spans (`19.. - 1960`). And no "
            + "negative word exists: `molongola` ×1 is an ADJECTIVE in a physics gloss ('mokúmba ya "
            + "molongola (negative \"-\")'), i.e. the wrong register. Ranges ARE read (kino, normalize.ts "
            + "step 7). ⚠ OMITTING A MINUS INVERTS — this is a known-wrong silence, not an acceptable one",
        plus: "measured: 16 digit-flanked `+`, and not one is arithmetic — TELEPHONE COUNTRY CODES (`+255`, "
            + "`+872 – unassigned`, a dialling-plan article), two album titles (`Libala 1+1`, `1+1=1 (Remix "
            + "Total)`) and a French book title (`Devenir Président en 50 + 20 jours`). Of 360 leading `+`, "
            + "the bulk is that same dialling table plus infobox residue (`bato1= +30 000 000`). `kobakisa` "
            + "×141 is the verb 'to add/increase' and is never digit-adjacent as an operator",
        "plus-minus": "measured: zero ± in 23,678 paragraphs",
        equals: "measured: 6 digit-flanked `=` — an album title (`1+1=1`), a population table (`2004 = "
            + "13197`) and spectroscopy (`v1 = 3650 cm−1`). The bare total of 870 is dominated by WIKI "
            + "SECTION HEADINGS (`== Bomoyi ==`), so reading the sign would say the equals word twice on "
            + "every heading. `ezalí` is the ordinary copula, not an arithmetic reading — the corpus writes "
            + "its own equalities with it (`Falánga ya Swisi mókó ezalí 100 centimes`)",
        "less-than": "measured: `<` occurs once in the whole corpus and 0 times between digits",
        "greater-than": "measured: `>` occurs 27 times and 0 of them between digits — all markup residue",
        times: "measured: `×` occurs 5 times in total. Three are SCIENTIFIC NOTATION (`9,109 53 × 10⁻³¹ "
            + "kg`), which this layer reads for no language; one is a band name (Wenge Musica 4×4) and one "
            + "a French relay leg (`le relais du 4 × 100 m`). Zero arithmetic instances, and no multiply "
            + "word is attested",
        divide: "measured: zero ÷ in 23,678 paragraphs",
        exponent: "measured: the SQUARED UNIT is read (`km²`/`km2` → `kilomɛtrɛ-kare`, the word attested ×11 "
            + "hyphenated onto its noun), but a BARE exponent has no reading: all 24 superscripts are "
            + "scientific-notation exponents in two physics articles (`10⁻¹⁹`, `10⁻²⁷`, `10⁻³¹`) plus one "
            + "edition marker (`Kinsásá, 2007³`), and no power word occurs anywhere in the corpus",
    },
    tl: {
        // Every reason is a reading of the mined artifact's actual instances (259 utterances) — the classes
        // are physics/科 encyclopedia copy, not running Tagalog, and no reading word is attested anywhere.
        minus: "measured: the digit-flanked leading dashes are PREHISTORIC-YEAR notation (`taong -73 000 "
            + "hanggang -60 000`, `-4000`) — a BCE convention, not arithmetic, and no negative-value word "
            + "occurs in the corpus. Digit–digit dashes AND digit-hyphen-digit are RANGES and ARE read "
            + "(hanggang, normalize.ts — a hyphen between digits cannot be a compound)",
        plus: "measured: 5 instances — a quark charge (`bayad + 2/3`), Greek etymology glosses (`astron + "
            + "nomos` ×2), a pulsar designation (PSR B1257+12) and one timezone (UTC+8). No plus word is "
            + "attested; ⟨dagdag⟩ never occurs digit-adjacent",
        "plus-minus": "measured: zero digit-flanked ± in the artifact",
        equals: "measured: 5 instances, all physics/etymology copy (`c = 299,792,458m/s`, `E = mc²`, "
            + "`αστρονομία = άστρον + νόμος`). ⟨katumbas⟩ is never digit-adjacent",
        "less-than": "measured: zero digit-flanked < in the artifact",
        "greater-than": "measured: zero digit-flanked > in the artifact",
        times: "measured: all 9 × are SCIENTIFIC NOTATION (`6.022 × 10²³`) — and every instance is preceded "
            + "by a wiki value-template artifact (`7023602200000000000♠`), so the class is template dirt on "
            + "top of a notation this layer does not read for any language",
        divide: "measured: zero ÷ in the artifact",
        degrees: "measured: 16 digit-adjacent ° — nearly all geographic COORDINATES (`116°&nbsp;40′ E`), the "
            + "yo shape, and the two temperatures write the scale word out themselves (`26.5° sentigrado`), "
            + "so voicing ° would double it. \"digri Selsiyus\" has 0 tl.wikipedia phrase hits",
    },
    yo: {
        // Yoruba's referees (wikipron yor, kaikki yor) are word→IPA: they can check how a word is pronounced,
        // never whether it is the right word for a sign. So every reason below is a corpus measurement.
        minus: "measured: the digit-flanked dash in Yoruba is a RANGE, not a minus — 3,378 hyphens and 4,159 en "
            + "dashes sit between digits, and the corpus glosses the reading twice: `ọgọ́rùn-ún méjì sí mẹ́fà "
            + "(200-600 kg)` and, for a scoreline, `góòlù mẹ́rin sí òdo (4–0)`. `sí` IS read for the range, 1,427 "
            + "digit-flanked instances — see ig/nl/mr/ta/yue, which record the same shape",
        degrees: "measured: only the BARE ° with no scale letter — 128 occurrences, of which 55 are "
            + "digit-flanked geographic coordinates (`7°30′S 3°21′E`). °C and °F ARE read (`ìwọ̀n 38 Celsius`). "
            + "The angular `digiri` has 1 hit and three of its four total hits are ACADEMIC degrees "
            + "(`ẹ̀rí digiri (doctorate)`, `masita digiri (MBA)`)",
        plus: "measured: + is 9 digit-flanked in 21 MB. `àfikún` (564 whole-word) is the nominal 'addition' and "
            + "is digit-adjacent 3 times in running prose, not as an operator; `kún` is a verb 'to fill'",
        "plus-minus": "measured: ± is 18 digit-flanked and NO tolerance word occurs — the sign appears in "
            + "scientific ranges copied into the wiki, with nothing in the corpus that reads it",
        equals: "measured: = is 7 digit-flanked. `dọ́gba` (124 whole-word) means 'is equal to' and is "
            + "digit-adjacent 9 times, which is too thin to map a sign onto, and `jẹ́` (30,012) is the ordinary "
            + "copula rather than an arithmetic reading",
        "less-than": "measured: < occurs 13 times and NEVER between digits (0 digit-flanked); the sign is not "
            + "used as a comparator in this corpus",
        "greater-than": "measured: > occurs 39 times and 0 of them between digits",
        divide: "measured: ÷ occurs twice in 21 MB and never between digits. `pín` (709) is the ordinary verb "
            + "'to divide/share' and `ìpín` (349) a share or portion — neither is digit-adjacent as an operator",
        exponent: "measured: the SQUARED UNIT is read (`km²` → `kìlómítà onígun mẹ́rin`, 754 occurrences of the "
            + "sign, the reading attested 15 times after a unit noun), but a BARE exponent has no reading: ³ "
            + "occurs 23 times with no cube word anywhere in the corpus, and no predicate form — the `20 squared` "
            + "shape — is attested for a base with no unit noun",
    },
    ig: {
        // ⚠ IGBO HAS NO REFEREE (wikipron ibo_latn, epitran ibo-Latn and the kaikki extract are all 404), so
        // every reason below is a corpus measurement and nothing else can check it.
        minus: "measured: the digit-flanked dash in Igbo is a RANGE, not a minus — of 4,993 in a 26 MB sample, "
            + "1,734 are year-year (`1967-1970`, `1979-1983`) and 1,741 small-small (`peeji 90-120`). A minus rule "
            + "would read every date range as arithmetic. `ruo` ('to') IS read for the range, 1,687 digit-flanked "
            + "instances — see nl/mr/ta/yue, which record the same shape",
        degrees: "measured: ° occurs 41 times digit-flanked but NEITHER scale name occurs anywhere in the corpus — "
            + "`dịgrii` 0 hits, `selsiọs` 0 hits. `sources.ts` reports [NONE] scale-names for this language. Most "
            + "of the corpus's ° is geographic coordinates (`4°06′12′′S 141°39′54′′E`) rather than temperature",
        times: "measured: × occurs 123 times digit-flanked and every one is a relay distance (`4 × 100` metres). "
            + "The candidate `mụba` is the VERB 'to increase' (`na-amụba 6`), not the arithmetic operator; no "
            + "operator word is attested",
        plus: "measured: + is 23 digit-flanked in a 26 MB sample. `mgbakwunye` (4,685 hits) is the NOMINAL "
            + "'addition', not what a reader says between two operands — the distinction concept.ts warns about",
        // ⚠ THE "24 LEADING" FIGURE WAS A DUMP-WIDE COUNT AND SAID NOTHING ABOUT WHAT THOSE SIGNS ARE. The
        // fleet symbol audit read every `=` in the artifact itself: all ten are MARKUP, none of it Igbo. That
        // strengthens the same refusal rather than changing it, but the entry now says what the evidence is.
        equals: "measured: = is 1 digit-flanked and 24 leading in a 26 MB sample, and reading the artifact's "
            + "own ten instances finds NOT ONE in Igbo prose: SEVEN ARE EASYTIMELINE CHART DIRECTIVES the "
            + "extraction did not strip (`PlotArea = left:50 bottom:30`, `ScaleMajor = gridcolor:b "
            + "increment:3000`, `ScaleMinor = …`, `ImageSize = width:auto height:250`) and the other three "
            + "are raw HTML attribute residue from an unstripped wikilink (`id=…`, `rel=\"mw:WikiLink\"`, "
            + "`title=\"Leiden University\"`). `nhata` ('equal', 2,250 hits) is available but there is no "
            + "digit-flanked instance anywhere to sense-check a reading against. ⚠ Chart markup is a property "
            + "of the MINING PIPELINE, not of this language — the same directives recur in 24 other artifacts",
        "plus-minus": "measured: the sign does not occur digit-flanked in the corpus (1 instance in 26 MB)",
        "less-than": "measured: the sign does not occur in the corpus (0 digit-flanked, 0 leading)",
        "greater-than": "measured: 0 digit-flanked; the 6 leading instances are markup residue, not comparisons",
        divide: "measured: the sign does not occur in the corpus at all (0 digit-flanked, 0 leading)",
        exponent: "measured: `sources.ts` reports the sign does not occur in the evidence for this language",
    },
    bar: {
        // ⚠ THE SIGNS ARE PRESENT AND NONE OF THEM IS ARITHMETIC — which is a genuine divergence from
        // Standard German, whose layer reads `=`, `<`, `>` and `÷`. A dialect wiki's subject matter is
        // largely ITS OWN LANGUAGE, so these characters are doing morphology, not maths. All 22 enumerated
        // over the artifact, and measured over the BAVARIAN subset (24% of bar.wikipedia is Standard German
        // — see bavarian/normalize.ts):
        //   · the DERIVATION ARROW, the single largest group: `da- (< der-)`, `dabogga (< der+packen)`,
        //     `daduan (< der+tun)`, `si dabarma (< der+barmen)`, `(si) darenna (< der+rennen)`,
        //     `magy (< ugrisch *mańćε)` — and note the `+` inside them is a MORPHEME BOUNDARY;
        //   · the SOUND-CHANGE ARROW: `Lautwandlregl ei > oa`;
        //   · the GLOSSING EQUALS: `bei dem = beim`, `an dem = am`, `(= nach)`, `(= in)`, `ius = es Recht`,
        //     `ys = schnej`, `grad = Buag und ec = die Nochsübn`, `caribaria = Duacheinanda`,
        //     `on = „zehn“ + ogur = „Stamm“`;
        //   · a CAST LIST's "and": `mit Ludwig Prell + Josef Amann`, `Hörspiel von + mit Bally + Ludwig Prell`;
        //   · an AWARD TALLY's multiplier: `26 × Annie Award (… 2 × 1995, 4 × 1997 …)`, `26 × Emmy`;
        //   · x86 ASSEMBLY: `movl $4,%eax # Syscall-ID 4 (= __NR_write)`;
        //   · a Y-DNA HAPLOGROUP table: `P* (xR1a) 56%`.
        // Reading `<` as a comparison would be confidently wrong in every instance, and porting German's
        // words here is exactly the Standard-German-for-Bavarian substitution this language's layer exists to
        // avoid. `review.ts --lang bar` stays red on the class, correctly (trap 24).
        equals: "measured: all 22 math-sign instances in the artifact, zero arithmetic. `=` is a GLOSSING "
            + "equals in a dialect wiki writing about its own language (`bei dem = beim`, `(= nach)`, "
            + "`ius = es Recht`, `ys = schnej`) or x86 assembly (`movl $4,%eax # (= __NR_write)`)",
        "less-than": "measured: every `<` is the ETYMOLOGICAL DERIVATION ARROW, which is what a dialect wiki "
            + "uses it for — `da- (< der-)`, `dabogga (< der+packen)`, `si dabarma (< der+barmen)`, "
            + "`magy (< ugrisch *mańćε)`. Not one comparison in the corpus",
        "greater-than": "measured: the only `>` is a SOUND-CHANGE arrow in the phonology section "
            + "(`Ausnahma vo da Lautwandlregl ei > oa`), i.e. 'becomes', not 'is greater than'",
        plus: "measured: no `+` is addition. Inside a derivation it is a MORPHEME BOUNDARY (`der+packen`, "
            + "`der+tun`, `on = „zehn“ + ogur`), and in a radio-play credit it is 'and' (`mit Ludwig Prell + "
            + "Josef Amann`). ⚠ The signed-TEMPERATURE plus IS read — `+15 °C` — by a degree-guarded rule in "
            + "bavarian/normalize.ts; this refusal is the bare sign everywhere else",
        times: "measured: both `×` are an AWARD TALLY's occurrence count (`26 × Emmy (… 6 × 1992, 2 × 1997)`), "
            + "and no Bavarian operator word is attested — `moi` appears as 'moi so grouß wia' (times as "
            + "large) but never between two operands",
        divide: "measured: the sign does not occur in the artifact at all",
        "plus-minus": "measured: the sign does not occur in the artifact at all; the ± rule in "
            + "bavarian/normalize.ts is robustness, composed from the two words its own sign rules already use",
        ampersand: "measured: 83 of the 83 `&` in the Bavarian subset are the HTML entity `&nbsp;`, which "
            + "bavarian/normalize.ts folds to a space at step 1 because the engine was phonemizing `nbsp` as "
            + "a WORD. There is not one real ampersand in Bavarian text — the only four in the whole artifact "
            + "are Standard German publisher names in bibliographies (`Königshausen & Neumann`, `W W Norton & "
            + "Co`, `Quelle & Meyer`, `Rosa & Karl`). `und` is abundant, but declaring it would be a rule "
            + "about German bibliography filed under Bavarian",
    },
    km: {
        // ⚠ SPACING SPLITS THIS SHAPE, which is why only the unspaced form is refused. A refusal that
        // describes `=` as a whole ("glosses and code") throws away 1,649 spaced operand-flanked sites, the
        // great majority of them Khmer prose. The spaced form now reads ស្មើ; see khmer/normalize.ts rule 5.
        // The Khmer-free spaced sites are EasyTimeline markup, which `allOccurrencesInMarkup` keeps the scan
        // from reporting as a language defect.
        //
        // ⚠ NOTE what remains in the probe's reading: `x = y` gives *ˈɛks smaə wˈaᶦ* — the sign is right and
        // the LETTER NAMES are English inside a Khmer engine. That is the letter-name seam, and it is its own
        // work.
        equals: "measured: what is STILL silent is the UNSPACED equals only — 239 sites, and they are a "
            + "translation gloss (`ចក្រវាឡរណប=satellite`, Khmer joined to its English equivalent) or a solution "
            + "set (`x=-1/2`), plus 694 code operators `==`/`!=`/`>=`/`<=`. Reading `equal` in a translation gloss "
            + "would voice a sign that means 'renders as'. The SPACED form — 1,649 sites, 1,546 of them Khmer "
            + "prose — now reads ស្មើ, so this entry covers the unspaced shape and nothing else",
    },
    gu: {
        minus: "measured: gu_in has two `word -digit` instances (the bill `એચજેઆર -3` and the ordinal range "
            + "`10મી -11મી`), the shape no guard can reject — see ta's entry and ACCEPTED_SILENT",
    },
    kn: {
        minus: "measured: kn_in has the bill number `ಎಚ್‌ಜೆಆರ್ -3`, the `word -digit` shape no guard can reject "
            + "— see ta's entry and ACCEPTED_SILENT, which lists this instance as correctly silent",
    },
    yue: {
        // ⚠ HERE THE SHAPE IS AN ARTEFACT OF THE TRANSCRIPT, not of Chinese. FLEURS writes Han with a space
        // between EVERY character, so the aircraft designation `Il-76` is stored as `伊 爾 -76` — a letter, a
        // space, then the hyphen. The undecidable shape arrives through the corpus's own formatting.
        minus: "measured: the per-character spacing FLEURS uses for Han turns the designation `Il-76` into "
            + "`伊 爾 -76`, producing the `word -digit` shape no guard can reject",
    },
    ta: {
        // ⚠ TRIED, AND THE CORPUS DIFF REJECTED IT. A guarded minus rule correctly refuses every range, score
        // and closed designation — and then reads `சந்திரயான் -1` as "கழித்தல் ஒன்று", minus one. The rule
        // converts an accepted silence into an audible error, which is strictly worse than the gap.
        // ⚠ AND IT IS THE SAME SENTENCE IN FIVE LANGUAGES. FLEURS is parallel, so the Chandrayaan designation
        // appears in gu, hi, kn, mr and ta — exactly the five languages listed for `minus` here and in
        // `ACCEPTED_SILENT`. Whatever is decided applies to all of them.
        minus: "measured, then TESTED: a guarded rule read the spacecraft `சந்திரயான் -1` as minus one, the one "
            + "shape no guard can reject — see ACCEPTED_SILENT, which lists this instance as correctly silent",
    },
    mn: {
        // ⚠ MONGOLIAN'S HAYSTACK, so the strength of every "measured" below is legible. There is NO FLEURS mn.
        // The evidence is the 452 retained segments of `tools/corpus/mined/mn.jsonc` (a 233,098-paragraph
        // mn.wikipedia dump), the artifact's whole-corpus `counts`, and `attest.ts` against THAT SAME WIKI —
        // a bigger sample of one source, never two. What Mongolian adds over the lg/qu position is espeak:
        // `dictsource/mn_list` ships a SYMBOL block (`% xUvi`, `$ dOllar`, `_dpt tseg`, `+ nemex`,
        // `= tentse:`) and a 35-row letter-name block, so several of the readings that DID land have two
        // independent authorities. All of it is argued at length in src/languages/mongolian/normalize.ts.
        // ⚠ `minus` AND `plus` ARE DELIBERATELY ABSENT FROM THIS BLOCK, so `review.ts --lang mn` STAYS RED on
        // both. Each is a SOURCING gap with a reading still to find, and this table is not where TODOs go:
        //   · MINUS is READ where it is unambiguous — `хасах` is attested ×33/18 with the sense checked
        //     (`хасах ТЕМПЕРАТУРТАЙ болсон үед`, `хасах цэнэгтэй`) and the corpus names the sign outright
        //     (`(хасах тэмдэг)`) — but only on a temperature. The residue the artifact still reports is the
        //     RANGE hyphen (`1206-1635`, 112 digit-hyphen-digit shapes) and one exponent written `kmol -1`.
        //     Mongolian reads a span with the ABLATIVE on the first operand, whose allomorph is chosen by the
        //     harmony of the SPOKEN numeral and is suppletive (зуу→зуунаас, хорь→хориос) — trap 14, and
        //     nothing in this tree attests those forms. A rule is still to find; the class stays red.
        //   · PLUS has the same shape one step earlier. `нэмэх` is attested ×34/15 in the right paradigm
        //     (`нэмэх бета задрал`, `протон (нэмэх цэнэгтэй)`), but this corpus's `+` is three senses and
        //     `нэмэх` says only two: a positive temperature (`+41 хэм`, `+37`), ARITHMETIC (`12 + 16 × 2`),
        //     and "over/more than" — `250000+орчим`, `160 000+ орчим`, `300000+ орчим`, and the judo weight
        //     CLASSES `+100 кг-н аварга` and `+78 кг`. The playbook's asymmetry settles the first (omitting a
        //     plus is lossless, omitting a minus INVERTS); the third has no attested word at all.
        "plus-minus": "measured: `±` is ×0 in the retained text, and the reading would compose two words of "
            + "which the plus side is the open question above",
        equals: "measured: `=` ×22, and most are not equations — `=== Уур амьсгал ===` MediaWiki headings and "
            + "`4X гэдэг маань = \"explore, expand…\"` glosses. ⚠ AND THE WORD IS NOT THE GAP: espeak's "
            + "`mn_list` gives `= tentse:` and the corpus gives `тэнцүү` ×2 — but BOTH corpus instances "
            + "case-mark their argument and put the verb last (`1 mol N A -ТЭЙ (Авогадрогийн тоо) ТЭНЦҮҮ`, "
            + "`10 их наяд ам.доллар-ТАЙ ТЭНЦЭЖ`), so there is no invariant string to place BETWEEN two "
            + "operands and the case cannot be computed from digits. Trap 14 arriving as a reason to DECLINE, "
            + "the same place Luganda's noun-class concord landed",
        "less-than": "measured: `<` is ×0 in the retained text (espeak names it `baga'temdeg`, the "
            + "\"less sign\" — a NAME for the character, not a reading between operands; the hi `धन` register "
            + "lesson)",
        "greater-than": "measured: `>` ×0 as a comparison. The retained text's only angle brackets are the "
            + "HTML-tag article's escaped markup (`&lt;h1&gt;`, `&lt;img&gt;`), which core/markup.ts decodes "
            + "above this layer, plus one chemistry arrow (`H ->He`)",
        times: "measured: `×` ×5, all genuine multiplication (`1000 W × 24 цаг × 365`, `12 + 16 × 2`) — AND "
            + "THE WORD FAILS THE SENSE CHECK, which is why this is a refusal and not a rule. `үржих` is "
            + "attested ×24/18 on mn.wikipedia and EVERY example is biological REPRODUCTION: `өсөж үржих` "
            + "(grow and multiply), bacteria, `үржих үзүүлэлт` (breeding rate), `бэлгийн болон бэлгийн бус "
            + "замаар үржих`. That is the `ilo dollar` / `ki digirii` shape — a green count and the wrong "
            + "word — and espeak's `mn_list` has no `×` row to cross-check it against",
        divide: "measured: `÷` is ×0 in the retained text. `хуваах` occurs ×1 and is the political sense "
            + "(`эзэнт гүрнийг ХУВААХАД`, on partitioning an empire), not an operator",
        ampersand: "measured: `&` ×27, of which 22 are HTML ENTITIES that core/markup.ts decodes above this "
            + "layer (`&nbsp;` ×3, `&mdash;` ×4, `&ndash;` ×2, `&lt;`/`&gt;` ×8, `&sup2;` ×2, `&apos;`). All "
            + "FIVE bare signs are inside FOREIGN LATIN titles this wiki carries — `Mr. & Mrs. Smith (2005)`, "
            + "`C&C Red Alert`, `Warcraft: Orc & Humans`, `Global Banking & Finance Review`, `Lavlagaa & "
            + "apos;` — so a Mongolian conjunction would be inserted into an English film title. Not one is a "
            + "Mongolian sentence, and the conjunction is not the gap (`ба`/`болон` are everywhere): one "
            + "instance would not be a rule (trap 9) and zero certainly is not. espeak's `& ampersand` is the "
            + "English word transliterated and is not a reading for this slot. ki, sn and lg reached the same "
            + "conclusion from the same evidence",
    },
    mr: {
        // Devanagari compounds are written with a hyphen (आस-पास), and the corpus's one hyphen-before-digit
        // outside a range is `चंद्रयान -1`, a spacecraft name.
        minus: "measured: the corpus's only hyphen-before-digit outside a range is the spacecraft `चंद्रयान -1`, "
            + "so a minus rule would read a designation as arithmetic — see marathi/normalize.ts step 15",
    },
    nl: {
        minus: "measured: every `-\\d` in nl_nl is a score or a range, so the rule would have turned 14 scores "
            + "into negatives — see dutch/normalize.ts step 9",
    },
    cjy: {
        // ⚠ cjy HAS NO CORPUS — there is no cjy.wikipedia, and the Wikimedia Incubator's Wp/cjy is 3,060 Han
        // characters whose artifact covers 7 of 35 cells. So these reasons are NOT corpus measurements like
        // every other entry in this table. They are something rarer and, for once, stronger: a CHECK AGAINST
        // THE SHIPPED DICT, which decides whether a word can be spoken at all. The shared Han-dict engine
        // skips an uncovered character SILENTLY, so a rule using one of these would delete the word instead
        // of mispronouncing it — strictly worse than leaving the sign unread, which at least leaves a
        // RAWMARK the scan can see.
        degrees: "checked, not measured: ⟨度⟩ is SILENT in this dict, and so are ⟨摄氏⟩/⟨攝氏⟩. `20°C` would "
            + "lose the degree WORD as well as the sign. The corpus cannot help — its `degrees` cell is EMPTY",
        equals: "checked: ⟨等于⟩ emits ONE syllable — 于 is silent — so it would say the first half of the "
            + "word and drop the second. ⟨等於⟩ likewise",
        "less-than": "checked: the same half-word problem as ⟨等于⟩, on ⟨小于⟩",
        "greater-than": "checked: the same half-word problem, on ⟨大于⟩",
        divide: "checked: ⟨除以⟩ needs 以, and no reading is available for the pair; the artifact's "
            + "`arithmetic` cell is EMPTY so there is nothing to measure either",
        times: "checked: ⟨乘⟩ speaks but ⟨乘以⟩ does not, and a bare 乘 in the dimension slot is an inference "
            + "no Jin text available can support",
        plus: "checked: ⟨加⟩ speaks, but ⟨减⟩ is SILENT — so the layer could read a plus and not a minus, "
            + "which is a worse state than reading neither. Deferred as a pair",
        minus: "checked: ⟨负⟩ speaks and ⟨减⟩ is silent (see plus). And with an EMPTY `signed-number` cell "
            + "there is no evidence about which shapes a Jin corpus would even contain",
        "plus-minus": "checked: no reading available, and the cell is EMPTY",
        currency: "⚠ NOT a dict problem — ⟨元⟩ speaks. It is a SENSE problem: all four incubator instances "
            + "are 維基元 (Meta-Wiki) and the personal names 元好問 / 柳宗元, never money. No Jin currency word "
            + "is attested in any source available, so the sign stays unread",
    },
    hak: {
        // ⚠ THE MEASUREMENT BEHIND EVERY LINE HERE IS UNUSUAL AND IS STATED ONCE: hak.wikipedia is written in
        // Pha̍k-fa-sṳ, not Han — 93.5% of the sample tier's characters are Latin — so these counts are over a
        // ROMANIZED corpus, and the words they are about would be emitted in Han. That split is nan's shape
        // too. What it costs here is nothing, because each refusal below rests on reading the INSTANCES.
        equals: "measured: the `=` instances are not arithmetic. `Egnatia T=thai-kiê` is a mangled wikitable "
            + "cell, `UTC+8` a timezone, `Yit Kûng-khín = 10 000 Phìn-fông Kûng-tshak` a unit DEFINITION "
            + "whose two sides are already words, and the rest are LaTeX bodies (`&=\\lim_{h \\to 0}{9 + 6h "
            + "+ h^2 - 9\\over{h}}`). And ⟨於⟩/⟨于⟩ are SILENT in this dict, so ⟨等於⟩ could only say half of "
            + "itself — the same half-word refusal cjy made",
        plus: "measured: ⟨加⟩ speaks but ⟨減⟩ is SILENT, so the layer could read a plus and not a minus, "
            + "which is worse than reading neither. The 19 `arithmetic` instances do not argue otherwise: "
            + "`「3+1」的安排` is a train-scheduling label and `-2, 0, +4, +6` are chemical oxidation states",
        times: "measured: every digit-adjacent `×` is SCIENTIFIC NOTATION whose superscript the dump "
            + "stripped — `1.392×106`, `2×1030`, `5×1030` are 10⁶, 10³⁰, 10³⁰. Reading the sign there would "
            + "say \"times one hundred and six\". ⟨乘⟩ speaks; the sign has no attested operator instance",
        divide: "measured: the one ÷ is inside a formula gloss (`ńg sien chhòng-thu ÷180÷60`), and ⟨除以⟩ "
            + "needs ⟨以⟩, which this dict does not carry",
        "plus-minus": "measured: zero ± in the artifact",
        minus: "measured, and the refusal is NARROWER than it looks: a negative IS read — but only before a "
            + "degree sign, because the only negative-number word this corpus supplies is 零下 (`làng-hâ`, "
            + "'below zero'), which is temperature-specific. All 6 genuine negatives in the corpus ARE "
            + "temperatures (`-4.5℃`, `-218 °C`, `−224℃`, `-170°C` ×2, `-5 °C`) and all 6 are read. A BARE "
            + "`-5` is what stays silent, and it has no attested instance and no attested word: the other 28 "
            + "leading hyphens before digits are 3-digit year-range separators (`303-ngièn -349-ngièn`), "
            + "coordinate ranges (`112°50'-114°45'`, read as ranges by step 3) and chemical oxidation states "
            + "(`-2, 0, +4, +6`). ⚠ AND THE HYPHEN IS THE WORST CHARACTER IN THIS ORTHOGRAPHY TO GUESS WITH — "
            + "Pha̍k-fa-sṳ joins every polysyllable with one (`Hak-kâ-ngìn`, `2005-ngièn`), which is why nan "
            + "declined the ASCII hyphen outright for the same reason",
        "less-than": "measured: zero `<` in the artifact; and the ⟨小於⟩ half-word problem would apply",
        "greater-than": "measured: zero `>` in the artifact; same half-word problem on ⟨大於⟩",
    },
    nan: {
        // ⚠ EVERY REASON HERE IS A CORPUS MEASUREMENT. nan HAS a referee (wikipron Hokkien), but it is
        // word→IPA: it can check how a word is pronounced, never whether it is the right word for a SIGN.
        minus: "measured: THE HYPHEN IS A WORD-INTERNAL SYLLABLE JOINER IN POJ, which is what makes this "
            + "class unlike any other language's. The corpus's digit-adjacent dashes are POJ compounds "
            + "(`ko͘-1-ê`, `bó͘-1-ê`, `têng poaⁿ--1-piàn`), the `ISO 8859-1 … 8859-16` designation block, an "
            + "ISBN (`957-2053-07-8`) and citation pages (`313-332`). The two GENUINE negatives are both "
            + "inside formulas or glosses — `10°C kàu -2°C` and `(2000 kg) × (−10 m/s)` — and no Min Nan "
            + "negative-number word occurs anywhere in the corpus. The RANGES are read, via the en dash and "
            + "the tilde, which are 5/5 and 4/4 genuine (normalize.ts step 2)",
        equals: "measured: the `=` instances are WIKI SECTION HEADINGS (`== Chām-gōa liân-kiat ==`) and "
            + "EasyTimeline template code (`ScaleMajor = unit:year increment:20 start:01/01/1800`, "
            + "`ScaleMinor = unit:year`). Not one is arithmetic in running prose",
        plus: "measured: the digit-adjacent `+` joins RUNNING MATES in an election table — "
            + "`Chúi-píⁿ(chóng-thóng)+Lū Siù-liân(hù-chóng-thóng)` — which is a list separator, not an "
            + "operator, and no Min Nan addition word is attested digit-adjacent",
        "plus-minus": "measured: zero ± in the artifact",
        "less-than": "measured: zero `<` in the artifact",
        "greater-than": "measured: zero `>` in the artifact",
        divide: "measured: zero ÷ in the artifact",
        times: "measured: the one `×` is a PHYSICS FORMULA in a quoted gloss, `(2000 kg) × (−10 m/s)`, and "
            + "no multiplication word is attested; the corpus writes dimensions out in words instead",
        currency: "measured: `$` IS read (⟨箍⟩, which the corpus glosses — `Bí-kim 1 kho͘ (US$1)`). What "
            + "remains is ¥ ×2, € ×2, £ ×6 and ¢, for which NO Min Nan currency name occurs anywhere in the "
            + "corpus — ⟨箍⟩ is the unit word, not a currency name — plus `$now`, which is EasyTimeline "
            + "template code rather than money",
    },
    jv: {
        minus: "measured: the corpus's ONE true negative is `at –45 °C` inside an ENGLISH bibliographic "
            + "citation title, and no Javanese negative-number word is attested in the corpus or on "
            + "jv.wikipedia. Every other digit-adjacent dash is a RANGE (read as ⟨nganti⟩, normalize.ts "
            + "step 7), a COORDINATE range (step 4b), a citation PAGE range (`157-167 doi:`), a DOI's own "
            + "`0301-0104`, or a botanical parenthetical extreme (`10-15(-17) cm`)",
        // ⚠ jv HAS referees (kaikki jv + Aksara), but they are word→IPA: they can check how a word is
        // pronounced, never whether it is the right word for a SIGN. So every reason below is a corpus
        // measurement over the mined artifact (jv.wikipedia dump).
        equals: "measured: 34 `=`, and NOT ONE is arithmetic. They are DEFINITIONAL GLOSSES — a formula "
            + "being explained (`Rumus: x + y = z. X = pengalaman, y = renungan, z = hasilipun`), a "
            + "register equivalence (`dèwèkè=dhékné (ngoko)`, `piambeké=piyambekipun`) and a cross-language "
            + "gloss (`tembung rika (jw = kowé, ind = kamu)`). No equals word is attested, and reading one "
            + "would speak it aloud in every dictionary-style line the wiki has",
        plus: "measured: 7 `+`, and the digit-adjacent ones are not operators — `+/- 327.866` is an "
            + "APPROXIMATION (claimed as ⟨kurang luwih⟩ in normalize.ts step 5b, so the sign IS read there) "
            + "and the rest are MUSICAL NOTATION, the slendro/pelog scale degrees `[C-D E+ G A]` and "
            + "`[C+ D E-F# G# A B]`, where a `+` marks a raised pitch",
        "less-than": "measured: zero `<` in the artifact",
        "greater-than": "measured: zero `>` in the artifact",
        divide: "measured: zero `÷` in the artifact",
        // ⚠ NOT LISTED, deliberately: `±` and `×` ARE read — ± as ⟨kurang luwih⟩ (step 5b) and × as
        // ⟨kaping⟩ through the tier — so a drop of either is a real regression and must keep failing.
    },
    wuu: {
        // ⚠ wuu HAS NO REFEREE (the whole modern Wu ecosystem derives from the one Wugniu tradition, so any
        // automated referee is circular), and no FLEURS corpus. Every count below is over the mined
        // artifact's retained text; the words are separately checked against `src/languages/wu/dict.tsv`,
        // which is a hard gate here — a word the dict does not carry is SKIPPED by the front end, silently.
        minus: "measured: 169 hyphens, 56 digit-flanked, and ZERO of them a negative. They are RANGES with a "
            + "unit (`2-8°C`, `15-25公里`, `0-14 岁`), YEAR ranges (`1763-1774`), BUS ROUTE LISTS "
            + "(`公交车8 - 31 - 32 - 46 - 49D - 55`), MODEL NUMBERS (`747-400`, `Qwen2.5-72B`) and a TONE "
            + "NOTATION (`223-33`). The ranges ARE read (到, wu/normalize.ts step 6, right-context guarded); "
            + "the other three shapes are correctly silent. The only `−` U+2212 instances are 2, both inside "
            + "Japanese-language mathematics copy quoted in a wuu article (`m = −1 で调和平均`)",
        plus: "measured: 22 `+`, exactly ONE digit-flanked — a programming tutorial computing `3+2`. And the "
            + "word fails independently: all 47 corpus hits of 加 are BOUND (外加, 加勒比, 新加坡, 加工, 增加, "
            + "加拿大) and wuu.wikipedia adds only 汤加 and 毕加索, so no operator sense is attested anywhere",
        "plus-minus": "measured: zero ± in the artifact",
        equals: "measured: 20 `=`, ONE digit-flanked (`195 kg ÷ 3 = 65 kg`). The rest are WIKI SECTION "
            + "HEADINGS (`== 参考文献 ==`) and LaTeX formula bodies (`(x-x_m)^2 + (y-y_m)^2 = a^2`, "
            + "`y = y_m + a \\sin \\theta`). 等于 is in the dict AND corpus-attested in sense — the WORD is "
            + "fine and the SIGN is not what the count implied; reading it would say 等于等于 参考文献 等于等于 "
            + "aloud on every article",
        "less-than": "measured: zero `<` in the artifact",
        "greater-than": "measured: zero `>` in the artifact",
        times: "measured: one `×`, and it is SCIENTIFIC NOTATION (`地球质量约为5.97×10²⁴千克`), which this "
            + "layer reads for no language. 乘 is in the dict but both its corpus hits are 乘坐 'to ride'",
        divide: "measured: one `÷`, in the same `195 kg ÷ 3 = 65 kg` worked example as the `=` above; 除以 "
            + "occurs zero times in the corpus",
    },
    nya: {
        // ⚠ EVERY ONE OF THESE SIGNS IS EASYTIMELINE CHART MARKUP IN THIS CORPUS, NOT CHICHEWA PROSE — the
        // sharpest instance yet of the playbook's "a small wiki is not all in its own language" warning
        // arriving as MARKUP rather than as another language. `mine.ts` selects adversarially, so a handful
        // of ny.wikipedia population-graph articles supply almost the whole `arithmetic` and `signed-number`
        // evidence. Counted over the mined artifact and read one by one, not sampled.
        // ⚠ AND THERE IS NO SECOND HAYSTACK: espeak does not ship Chichewa AT ALL, so `sources.ts` reports
        // `[chk?]` for every one of these and the corpus plus ny.wikipedia is the entire evidence base.
        minus: "measured: 10 candidate instances, of which 9 are EasyTimeline PIXEL OFFSETS "
            + "(`shift:(-10,5)`, `shift:(-60,-5)`, `shift:(-14,5)`) — a chart directive, never a quantity — "
            + "and the 10th is a spaced RANGE dash (`2004 -2009`) which normalize.ts step 8 now reads as "
            + "`mpaka`. ZERO negative numbers occur in Chichewa prose, and no minus word is attested in the "
            + "corpus, in the referees or on ny.wikipedia. Omitting a minus INVERTS a value, so this is a "
            + "refusal that would have to be revisited the moment a real negative appears — see ln, which "
            + "deliberately has no entry here because its six drops ARE genuine negatives",
        // ⚠ THE SIX ARITHMETIC SIGNS ARE ONE REFUSAL, WRITTEN SIX TIMES because `SIGN_CASES` is per sign
        // while `DROPPABLE` is coarse. Every one rests on the same two measurements: the sign is absent from
        // Chichewa prose, and no Chichewa word for it is attested in the corpus, the referees or
        // ny.wikipedia — and espeak, the usual third tier, does not ship this language at all.
        // ⚠ THE COUNT MOVED 14 → 9 AND THE REFUSAL DID NOT, which is the shape a measured refusal should
        // have. The 5 CSS `=` were TemplateStyles residue (`.reflist-columns-2{column-width:30em}`, and the
        // `mw` "finding" reported twice against this language), removed from the artifact once the guard
        // reached all three mining routes. Deleting evidence FOR a refusal is the direction that could
        // invalidate one, so it is restated rather than left: what remains is 9 EasyTimeline directives and
        // still zero Chichewa arithmetic, so the class is refused on the same ground with a smaller n.
        equals: "measured: all 9 `=` in the artifact are MARKUP — EasyTimeline directives "
            + "(`ScaleMajor = unit:year increment:11000`, `PlotArea = left:50 right:20`). Zero occur in "
            + "Chichewa prose, and no equals word is attested. (Was 14 before 5 CSS declarations were "
            + "removed from the artifact as MediaWiki stylesheet residue — same verdict, smaller n)",
        "plus-minus": "measured: `±` ×0 in the artifact; the ± reading would compose two unattested words",
        "less-than": "measured: `<` ×0 in the artifact",
        "greater-than": "measured: `>` ×0 in the artifact",
        times: "measured: `×` ×0 in the artifact. The `x` between digits does not occur either",
        divide: "measured: `÷` ×0 in the artifact",
        plus: "measured: `+` occurs twice, both a UTC OFFSET (`(UTC + 7)`, `(GMT+1)`), which the playbook's "
            + "fleet sweep found is the one contentful plus and the one nothing attests. No Chichewa plus "
            + "word is in the corpus, the referees or ny.wikipedia, and naming one would be the Fula `tere` "
            + "failure. The other plus context — a leading `+` on a temperature — does not occur here",
    },
    za: {
        // ⚠ EVERY COUNT HERE IS OVER THE ZHUANG-ONLY SUBSET of a fresh za.wikipedia dump — 2,929 of 7,328
        // paragraphs — because that wiki carries whole imported GERMAN and ENGLISH articles and `mine.ts`
        // selects adversarially, so the artifact's hard-set is dominated by them (the su.wikipedia lesson).
        // The filter is validated on words that cannot cross the boundary: `nienz` 907 / `bi` 115 /
        // `nyied` 288 in the Zhuang subset and ALL ZERO in the other 814. See zhuang/normalize.ts.
        degrees: "no Zhuang degree or scale word exists in any source. `doh` (度) ×33 is 'throughout' "
            + "(`faenbouh doh daengx siqgyaiq`, `cienz doh lajbiengz`) or the country INDIA (`Yaenq Doh`); "
            + "`dohraeuj` ×1 is the noun 'temperature', not a unit; `Sesi`/`Sipsi` (摄氏) ×0; espeak does "
            + "not ship Zhuang at all. The four `°C` are one climate sentence, and normalize.ts step 6 "
            + "CONSUMES the sign rather than reading it — a deliberate downgrade from the scale letter "
            + "reaching the IPA as a bare [ɕ] to a silence, which is the better of the two available failures",
        currency: "measured: `$` occurs ZERO times in Zhuang text. All three instances in the artifact are "
            + "inside ENGLISH sentences imported into za.wikipedia (`a $500,000 award`, `grant of $179,113`, "
            + "`the $15,000 prize`) — a cell about English text that happens to sit in this wiki. `¥ € £` "
            + "are ×0 everywhere, and the corpus's 7 `元` are all Chinese dynastic and personal names "
            + "(元朝, 元世祖忽必烈, 蒙元耀), never money. No Zhuang currency word is attested in any source",
        plus: "measured: two `+`, neither arithmetic — `insectum «Non» + caedo` joins two Latin etymology "
            + "glosses, `laengconghndaeng+gwnz hoz` joins two anatomical sites in a clinical checklist",
        "plus-minus": "measured: zero ± in the Zhuang subset",
        equals: "measured: zero `=` in Zhuang prose. The artifact's instances are EasyTimeline TEMPLATE "
            + "DEBRIS that survived the dump extractor (`PlotArea = left:50 bottom:30`, `ScaleMajor = "
            + "gridcolor:darkgrey increment:200`) — chart markup, not text anyone reads aloud",
        "less-than": "measured: one `<`, and it is a stray glyph closing a sentence about a hand gesture "
            + "(`duiyenz dog haengj yungq fajfwngz <.`), not a relation between two quantities",
        "greater-than": "measured: zero `>` in the Zhuang subset",
        // ⚠ THE OPERATION NOUNS EXIST AND ARE THE WRONG REGISTER, which is trap 35's Hindi जोड़/धन split.
        times: "measured: two `×`. One is SCIENTIFIC NOTATION (`gij dijgiz dwg 10830 ik laebfueng "
            + "goengleix, 5.976×10(27) seuq`), which this layer reads for no language; the other is "
            + "METALINGUISTIC — the wiki's own stub article on multiplication naming the symbol in quotes "
            + "(`Swngzfap dwg cungj suenqsoq, fouzhauh dwg \"×\", gezgoj dwg \"giz\"`). That stub gives the "
            + "OPERATION noun `Swngzfap` and the RESULT noun `giz`, and neither is what a reader says "
            + "BETWEEN two operands",
        divide: "measured: one `÷`, in the parallel division stub (`Cawzfap dwg cungj suenqsoq, fouzhauh "
            + "dwg \"÷\", gezgoj dwg \"sieng\"`) — the symbol MENTIONED, not used. Same refusal as `times`",
        // ⚠ NO `minus` KEY, AND ITS ABSENCE IS THE POINT. The corpus has three TRUE negatives — one
        // article's Dead Sea elevations, `dwg -422m`, `dwg -418m`, `gemj daengz -420m` — and no Zhuang word
        // for a negative number is attested anywhere. Omitting a plus is lossless; omitting a minus
        // INVERTS, so a known-wrong reading does not get to be a green gate: `review.ts --lang za` stays
        // red on `minus` until a word is sourced. Same standing refusal as `ln`.
    },
    bm: {
        // ⚠ ESPEAK SHIPS NO BAMBARA AT ALL, so every reason below is a measurement over bm.wikipedia — the
        // WHOLE of it, 2,359 lines / 430,646 characters — and nothing else can check it.
        equals: "measured: `=` occurs 40 times and NONE is arithmetic. The majority is EasyTimeline markup "
            + "residue that survived extraction (`ImageSize = width:420`, `DateFormat = yyyy`, `Period = "
            + "from:0 till:2000000`); the rest are definitional glosses in the grammar and proverb articles "
            + "(`sabu ba = ma`, `Misali: ka ji Bɔn = jibɔn`), one economic identity written between WORDS "
            + "(`BSK = makoɲe + bakrunba nafolo + …`) and `E=mc^2`. Zero digit-flanked instances, and no "
            + "Bambara word for the relation is attested anywhere",
        plus: "measured: `+` occurs 6 times and not one is a sum between two numbers — a phone number's "
            + "dialling prefix (`n'numero fayi +22379311167`), a UTC offset (`(UTC+8)`), the word-level terms "
            + "of the BSK identity above, and a typographic dash run (`Empire français--+san 1809`). The "
            + "playbook's own finding applies: a UTC offset is the only contentful plus and nothing attests "
            + "how bm says it",
        times: "measured: `×` occurs 3 times and every one is a CARTRIDGE DIMENSION — `7,62 × 39 mm`, "
            + "`7.62 ×33 mm`, `7,62x41` — which is 'by' and not 'times'. No Bambara multiplication word is "
            + "attested in the corpus or on bm.wikipedia",
        "plus-minus": "measured: `±` is ×0 in the whole wiki",
        divide: "measured: `÷` is ×0 in the whole wiki; the corpus's `/` instances are date pairs "
            + "(`1994/1995`, `22/2009`) and rates",
        "less-than": "measured: `<` is ×0 in the whole wiki",
        "greater-than": "measured: `>` is ×0 in the whole wiki",
        degrees: "measured: `°` occurs exactly TWICE in the whole bm wiki and both are geographic "
            + "COORDINATES on one page (`Latitude: 44°27'56″`, `Longitude: 17°33'36″`) — no temperature, and "
            + "the primes have no reading either. NEITHER SCALE NAME EXISTS ANYWHERE: `selsiyu`, `degere`, "
            + "`digere` and `Celsius` are all ×0, and `sources.ts` reports `[  · ] scale-names — no ° in the "
            + "corpus`. espeak ships no Bambara, so there is no second haystack. Naming a reading here would "
            + "be the Fula `tere` invention exactly, and `20°C` losing the WORD as well as the sign is worse "
            + "than the raw letter it would replace",
    },
    mad: {
        // ⚠ ESPEAK SHIPS NO MADURESE AT ALL and there is no machine referee for it (no wikipron/epitran/
        // kaikki), so every reason below is a measurement over the mined mad.wikipedia artifact plus
        // `attest.ts` against that same wiki.
        // ⚠ A THIRD TIER DOES EXIST FOR THIS LANGUAGE, and an earlier version of this comment said it did
        // not. Off-repo Madurese lexicography is reachable and it settled two questions the corpus could
        // not: the Madurese–Indonesian dictionary at willnode.github.io/madura (9,789 entries) carries
        // `koma`, `jutah` and `milyad` as headwords, and ruangbudaya.com's "Numeral dalam Bahasa Madura"
        // supplies a whole composed numeral (1,508,070 = *sajuta lèmaratos bâllu' èbu pèttongpolo*) that
        // fixes the magnitude WORD ORDER. Both are cited at their point of use (madurese.jsonc,
        // numbers.ts, normalize.ts step 10). The classes below are still refused — none of these sources
        // offers a sign word — but "the corpus is silent" is not by itself the end of the enquiry here.
        // ⚠ AND `attest.ts`'s wiki probe SUBSTRING-MATCHES, which under-counted `koma` into invisibility:
        // `insource:/koma/` on mad.wikipedia is dominated by `komandan`/`hokoman`/`okoman`, and the one
        // snippet that names the punctuation mark (`tandhâ bâca koma`, in `Bhâsa Jeppang`) only surfaced
        // when all thirty were read by hand. Read the snippets, not the count — the same lesson `sampè'`
        // taught from the other direction (trap 41).
        // ⚠ AND `minus` IS DELIBERATELY ABSENT FROM THIS BLOCK, which is the point of the entry as a whole.
        // Madurese has TWO genuine negatives in the artifact (`-1 mèter dpl`, and the integers article's
        // `0, 1, -1, 2, - 2, ...`), omitting a minus INVERTS the value, and `korang` ×17 — the only
        // candidate word — is bound into a COMPARATIVE PHRASE in every instance (`korang lebbi` "more or
        // less" ×13, `korang ḍâri` "less than" ×4), never a prefixed sign. That is the Fula `hakkunde`
        // failure: a real word whose part of speech does not fit the slot. So `review.ts --lang mad` stays
        // RED on the minus, exactly as `ln` does, and the designation instances are named in
        // `ACCEPTED_SILENT` instead so the two true negatives remain visible.
        plus: "measured: FOUR `+` in the artifact and not one is a sum — two PHONE DIALLING PREFIXES "
            + "(`Kode telepon: +31 (Èropa), +599 (Amerika)`), one UTC OFFSET (`bâkto lokal (UTC+7)`) and a "
            + "SONG TITLE (`single sè andhi' judhul \"1+1\"`). The playbook's fleet sweep already settled "
            + "the UTC case: it is the one contentful plus and nothing in any corpus attests how it is "
            + "said. And the candidate word refutes itself on sense — `tamba` is attested in 9 articles on "
            + "mad.wikipedia and every hit is the verb/adverb 'to increase' (`pânḍuḍuk Katolik tamba "
            + "bânnya'`, `Karir mènangka panyanyi tamba kalonta`), not the operator",
        equals: "measured: FIVE `=` in the artifact and NONE is arithmetic. Four are BILINGUAL GLOSSES — "
            + "`Eatore, konye' gunong = Silahkan dimakan, seadanya`, `\"dahana\" = apoy, \"pura\" = kotta`, "
            + "`tangghâl 1 bulân Tisyri = Rosh Hashanah`, and a German/Indonesian book-title equation in a "
            + "citation — and the fifth is the physics formula `E = mc²`. A reading for the RELATION would "
            + "be wrong in every attested instance, and no Madurese equals word is attested in the corpus "
            + "or on the wiki (`sarowa` ×0, `padha` ×0)",
        "less-than": "measured: `<` is ×0 in the artifact. The comparative Madurese does write is the "
            + "PHRASE `korang ḍâri` ×4 (`korang ḍâri 50%`, `korang ḍâri sèttong milimeter`), which is a "
            + "quantity comparison in prose and not a reading for a notational relation — the same "
            + "distinction Indonesian's and Sundanese's layers record",
        "greater-than": "measured: `>` is ×0 in the artifact, and `lebbi ḍâri` ×9 is the prose 'more than' "
            + "rather than the magnitude relation the sign denotes",
        divide: "measured: `÷` is ×0 in the artifact. Every `/` in this corpus is a date (`10/01/2007`), a "
            + "year pair (`1998/1999-2008/2009`), a document number (`SK No. 17/1961`, `No 01/0/SKB/2004`), "
            + "a RATE (`jiwa/km²`, `mm/taon` — which normalize.ts step 7 reads with `per`) or the 'or' "
            + "slash Madurese writes constantly (`bân/otabâ`, `daging/ajam/tempe`, `atoran/kabiyasaan`). "
            + "`bagi` ×2 is 'for' (`Requiem bagi ROCKER`), not the operator",
    },
    he: {
        // ⚠ ESPEAK SHIPS NO HEBREW AT ALL and there is no FLEURS corpus, so every reason below is a
        // measurement over `tools/corpus/mined/he.jsonc` (he.wikipedia, 380 segments) plus `attest.ts` and
        // targeted `insource:` searches against that wiki. The refusals are argued in
        // `src/languages/hebrew/normalize.ts`'s header and logged in
        // `docs/investigations/he_normalization_investigation.md`.
        //
        // ⚠ NO `minus` KEY, DELIBERATELY, AND THE GATE STAYS RED ON IT — the `rw`/`ht` position exactly.
        // Hebrew's negative IS read, in the one slot the corpus writes it: the sign follows the unit
        // (`18°C-`, `נמוכות מ-60°C-`, ×5), because in RTL display a trailing hyphen renders to the LEFT of
        // the quantity. `מִינוּס` is well sourced for that — ×145 tokens / 18 articles, always PREPOSED to
        // its quantity (`מינוס 273.15 מעלות צלזיוס`, `מינוס 38 מעלות`). What is NOT read is a LEADING `-5`,
        // and the reason is trap 24 rather than sourcing: all 7 leading instances in the corpus are a date
        // RANGE dash inside a birth–death parenthetical (`9 בדצמבר 1942 - 7 בדצמבר 1997`, ×5), a clause dash
        // (`בעולם - 783.84 קילומטר רבוע`) or an aircraft designation (`-700W`) — **not one is a negative** —
        // so a rule would be 0-for-7. hi's escape (a narrower rule keyed on a following degree word) buys
        // nothing here, because that is the arm already shipped on the other side. Omitting a minus INVERTS,
        // so the class stays failing rather than being declared correct.
        plus: "measured: 6 `+` in the artifact and none is arithmetic — `date +%s` (a shell format string in "
            + "the Unix-time article), `דיסני+` (the brand Disney+), `+1.9%` (a population growth figure, "
            + "where the sign is redundant with the word `שינוי` before it) and three AGE BRACKETS "
            + "(`34% מבני +65`, `42% מבני +75`, `24% מבני +20`) — which an RTL renderer displays as `65+`, "
            + "i.e. the sign is written first and read last. The playbook's audio tier settles the rest: "
            + "omitting a plus is lossless where omitting a minus inverts",
        equals: "measured: 5 `=` and every one is a written EQUATION quoted as a display object rather than "
            + "read aloud — `\"שמונה בריבוע\" (כי 8² = 64)` (the sentence has already SPOKEN the equality in "
            + "words, so the sign is redundant, trap 12) and one line of `2030 = 27² + 26² + 25² = 24² + "
            + "23² + 22² + 21²` from the same numerology article. No he candidate was probed because the "
            + "corpus supplies no slot for one: there is no sentence where a reader must voice the relation",
        times: "measured: `×` is ×0 in the artifact. The `/` shapes that could stand in for it are football "
            + "SEASONS (`2010/11`, `2012/2013`, ×5), Israeli court docket numbers (`ע\"א 136/71`, `513/89`, "
            + "`41/92`, ×3) and two genuine fractions — never multiplication",
        divide: "measured: `÷` is ×0 in the artifact, and `sources.ts` reports the sign as not occurring in "
            + "the evidence at all",
        "plus-minus": "measured: `±` is ×0 in the artifact. Its reading would compose the plus and minus "
            + "words, and the plus half is refused above",
        "less-than": "measured: `<` is ×0 in the artifact; no Hebrew comparative-magnitude phrase is "
            + "attested digit-adjacent in the corpus or in the attest.ts probes",
        "greater-than": "measured: `>` is ×0 in the artifact, same evidence as `less-than`",
        ampersand: "measured: 12 `&` and ten are inside ENGLISH titles the registry's Latin fallback owns "
            + "(`אצטדיון AT&T`, `\"Key & Peele\"`, `\"Safe & Sound\"` ×2, `Boys & Girls Clubs`, `בן & "
            + "ג'ריס`, `\"Live & Kicking\"`). Two more are markup residue from a broken entity (`שלט ב "
            + "?–848&`, `ב-847–838&`). That leaves TWO Hebrew instances (`מצעד שירי הרוק & האלטרנטיביים`), "
            + "and their reading is the PROCLITIC ו־ — a bound prefix that would have to be welded onto the "
            + "following token, not an infix word. `ff hakkunde` is what emitting it as a free word would be",
    },
    ht: {
        // ⚠ ESPEAK SHIPS NO HAITIAN CREOLE, so every reason below is a measurement over an ht.wikipedia dump
        // (800,158 paragraphs), and — because this wiki is 15.1% FRENCH — over its Creole-only 154,110 as
        // well. Both numbers are given where they differ, because the gap IS the finding.
        //
        // ⚠ NO `minus` KEY, DELIBERATELY, AND THE GATE STAYS RED ON IT. Omitting a plus is lossless;
        // omitting a minus INVERTS. There are genuine negatives here — `−20°C`, `−4 °C`, `-17.2°C`, and the
        // maths article's `(-1)` — and the corpus's one candidate reading is a self-gloss that names the
        // word `mwen`: `2+ (-2) = 0 i.e de plis (mwen de) fè zewo … (-2) se mwen de ou byen zewo mwen de`.
        // `mwen` is Haitian for **"I / me"**, the commonest word in the language, and the actual comparative
        // `mwens` (×569) is never digit-adjacent. One sentence proposing a reading homographic with the 1SG
        // pronoun is not enough, so the sign stays unread AND unaccepted — a green gate here would claim a
        // known-wrong silence is correct. The same refusal is argued in src/languages/haitian/normalize.ts.
        plus: "measured: 55 leading `+` in Creole text and the largest class is the DEATH MARKER of this "
            + "wiki's anniversary lists — `(+ 1987)`, `(† 1867)`, partner of the `(° )` birth marker the "
            + "degree rule guards against. The rest are binary arithmetic tables quoted verbatim "
            + "(`0 + 0 = 0 0 + 1 = 1 1 + 0 = 1`), a percentage delta (`2 % (+38 %)`) and a UTC-style offset. "
            + "So the corpus DISQUALIFIES the reading rather than merely failing to supply it: `plis` is a "
            + "real Haitian word (×many, as the comparative `plis pase`) and reading a death marker with it "
            + "would be confidently wrong",
        equals: "measured: `=` counts 93,254 in the dump and 304 in Creole text, and NONE of the 304 is an "
            + "arithmetic equality a reader would voice. They are EasyTimeline markup that survived "
            + "extraction (`ScaleMajor = unit:year increment:500`, `PlotArea = left:50 right:20`), template "
            + "attributes (`|alt=Foto`, `langue=es`), a rhetorical pair in the creole-prestige article "
            + "(`nou ta di lang=bon, kreyòl=pa bon`), a Latin etymology gloss (`Radix = rasin`), school "
            + "algebra (`R = 4S`, `R = 4(20) = 80 goud`) and the binary table above. No Haitian word for the "
            + "relation is attested digit-adjacent anywhere",
        times: "measured: 185 `×` in the dump, 32 in Creole text, and they are DIMENSION CROSSES "
            + "(`Big book, 11 x 17`) and SCIENTIFIC NOTATION (`6.02 X 10²³ patikil`) — 'by' and a mantissa "
            + "power, neither of which is multiplication. `miltipliye` is attested as the VERB in prose "
            + "(`li miltipliye pa (1/2)`) and never as an infix between two operands",
        divide: "measured: `÷` is ×0 in the whole dump. The corpus writes division in words when it means "
            + "it — `Si senk divize pa de, li ap bay 2,50` — which is a verb phrase, not an operator",
        "plus-minus": "measured: 14 `±` in the dump and 3 in Creole text, all measurement tolerances in "
            + "physics prose. Its reading would compose the plus and the minus words, and neither is "
            + "available: see the plus entry above and the minus refusal in the header",
        "less-than": "measured: 156 `<`/`>` in the dump and 88 in Creole text, and the readable ones are "
            + "inside ENGLISH paper titles quoted in reference lists (`Improved Staging Criteria for Thin "
            + "(< 1.00mm) Invasive Cutaneous Melanoma`); the rest are stripped-markup residue (`anba Lisans "
            + "> .`). No Haitian comparative-magnitude phrase is attested in the slot",
        "greater-than": "measured: the same 88, same two families — an English abstract's `>` and markup "
            + "residue. Zero digit-flanked instances in Creole prose",
        // ⚠ NO `degrees` KEY: the degree sign IS read. `°C` → `degre Sèlsiyis` (the corpus glosses its own
        // symbol: `yon tanperati mwayèn 25 °C (25 degre Sèlsiyis)`) and a digit-preceded bare `°` → `degre`
        // (`kiltive ant 60 degre latitid nò`). What is NOT read is the numero sign — which is read as
        // `nimewo` instead — and the birth marker `(° )`, which has no digit before it.
    },
    rw: {
        // ⚠ EVERY REFUSAL BELOW IS MEASURED OVER `tools/corpus/mined/rw.jsonc` AND ARGUED IN
        // `src/languages/kinyarwanda/normalize.ts`'s header. rw has no FLEURS corpus and espeak ships no
        // Kinyarwanda at all, so the artifact, the referee word list and `attest.ts` against rw.wikipedia are
        // the whole haystack — which is why each entry names WHICH of those was asked.
        // ⚠ AND `minus` IS DELIBERATELY ABSENT FROM THIS TABLE, so `review.ts --lang rw` stays RED on it. The
        // corpus contains a genuine negative that is NOT a temperature — the latitude `−2.010556` in the
        // Kabarondo article — omitting a minus INVERTS the value, and no general Kinyarwanda sign word is
        // attested. The `ln` precedent exactly: a known-wrong reading does not get to be a green gate. What
        // rw DOES read is the negative TEMPERATURE (`−27.2 °C` → `dogere selisiyusi 27 2 munsi ya zeru`),
        // which is the one slot with an attested phrase; the class stays failing for the rest.
        plus: "measured over the artifact: all 7 `+` are CHEMICAL FORMULATIONS (`Cypermethrin 4%+profenofos "
            + "40%`, `Acetamiprid 20g/l + Lambda-Cyhalothrin 16g/l`), COLOUR MIXING in a children's teaching "
            + "text (`umutuku + umuhondo = ikijuju`, ×3), an English sentence (`jobs for 11+ people`) and an "
            + "album title (`Amatsiko Y'ibigeragezo + Abantu`). No arithmetic addition anywhere. And no word "
            + "is available: `concept.ts` returns NO rw label for addition or subtraction at all (Wikidata has "
            + "neither), which is the playbook's fleet-wide finding for the plus. Omitting a plus is lossless",
        equals: "measured: all 13 `=` are FOREIGN-LANGUAGE GLOSSES (`Yağ Camii = 'Umusigiti w'Amavuta'`, "
            + "`anesthésie = perte de la sensibilité au tact`, a Rwanda-French dictionary title), an INFOBOX "
            + "FIELD that survived stripping (`population_estimate = 2,944,459`), EasyTimeline chart markup "
            + "(`PlotArea = left:50 right:20`) and the colour-mixing text above. Kinyarwanda prose contains no "
            + "equation, and no equals word is attested in any source this repo has for rw",
        times: "measured: both `×` are LOST SUPERSCRIPTS, not multiplication — `gigawatt 100 (130 × 106 hp)` "
            + "and `toni 500 × 106` are `10⁶` with the power flattened by the dump pipeline, so ANY reading of "
            + "those two sentences is wrong. No rw multiplication word is attested either",
        divide: "measured: `÷` is ×0 in the artifact. The 432 `/` shapes are dd/mm/yyyy DATES "
            + "(`13/04/1994`) and decree numbers (`029/2005`), never division",
        "plus-minus": "measured: `±` is ×0 in the artifact, and the reading would compose two words neither "
            + "of which is attested",
        "less-than": "measured: `<` is ×0 in the artifact and no comparative-magnitude phrase is attested "
            + "digit-adjacent anywhere in the corpus or on rw.wikipedia",
        "greater-than": "measured: `>` is ×0 in the artifact, same evidence as `less-than`",
    },
    ug: {
        // ⚠ ESPEAK SHIPS NO UYGHUR AT ALL, so every reason below is a measurement over the mined
        // ug.wikipedia artifact (429 segments), `attest.ts` against that wiki, and the wikipron
        // `uig_arab_broad` HUMAN referee. The refusals are argued in `src/languages/uyghur/normalize.ts`.
        equals: "measured: `=` occurs 39 times and IS arithmetic, so this refusal is about the WORD. `تەڭ` "
            + "is the one candidate — ×5 whole-word in the corpus and a wikipron referee headword — and "
            + "every corpus instance is the ADJECTIVE 'equal' (`كۆلىمىگە تەڭ` 'equal to the area of', `تەڭ "
            + "ھوقۇقلۇق` 'equal rights', `تەڭ پايدا`). Not one is digit-adjacent. Trap 37 with the count on "
            + "the wrong side; `ff hakkunde` is what shipping it anyway would look like",
        plus: "measured: `+` occurs 8 times and NONE is arithmetic — `+86/27` dialling codes ×3, `451 + 389 "
            + "pp.` (a page count), `180=120t+16t2` (a formula), `24+3`, two lines of forum spam. And the "
            + "audio tier's standing finding applies: omitting a plus is lossless where omitting a minus "
            + "inverts, so this is the cheap half of the refusal",
        times: "measured: `×` occurs 3 times and none is multiplication — `68 ×105 مېتىرلىق مەيدان` is a "
            + "football pitch, i.e. a DIMENSION CROSS that reads 'by', and `1015× Hz30` is mangled "
            + "scientific notation. No single reading is right for both",
        "plus-minus": "the sign does not occur in the evidence (×0), and no Uyghur word for the tolerance "
            + "relation is attested in corpus, wiki or referee",
        "less-than": "the sign does not occur in the evidence (×0) and no comparative-magnitude phrase is "
            + "attested digit-adjacent",
        "greater-than": "the sign does not occur in the evidence (×0) and no comparative-magnitude phrase "
            + "is attested digit-adjacent",
        divide: "the sign does not occur in the evidence (×0); the corpus's only division is written with a "
            + "backslash in an IQ formula (`ئەقلى يېشى \\ ئەمەلىي يېشى`), which is not this sign",
        ampersand: "measured: all 9 `&` are markup or English — `&nbsp;` ×4 (removed as an HTML entity by "
            + "normalize.ts step 2), `&amp;quot;` ×1, two lines of forum spam, `Heath, EG & Chiara` (an "
            + "English citation) and `510 بەت & 1013 بەت`. Reading it as `ۋە` would put an Uyghur word "
            + "inside an English name",
        // ⚠ THE `minus` KEY IS HERE EVEN THOUGH THE SIGN *IS* READ, and that is this table's stated purpose
        // rather than an exception to it: the synthetic probe `-5` will always report DROPPED and will
        // always be right to. `مىنۇس` is sourced (a wikipron referee headword /m i n u s/ and ×7 tokens / 5
        // articles on ug.wikipedia, in-slot as `يىللىق خاتالىق مىنۇس 0.9 دەقىقە`) and normalize.ts step 9
        // emits it — but only with a TEMPERATURE to its right, because that is the only right context that
        // separates a negative from the other two things this corpus writes with a dash. Measured over all
        // 36 `[space or bracket] - digit` instances: 8 real negatives (every one followed by `℃`), 19 range
        // dashes, 9 stray clause-opening dashes glued to a year. A probe with no right context is
        // indistinguishable from the 28 that must stay silent.
        minus: "READ, but only with a right context the synthetic probe cannot carry — `مىنۇس` is emitted "
            + "for `- N°C` (8/8 of the corpus's real negatives) and withheld from the 19 range dashes and 9 "
            + "clause-opening dashes that share the shape. See uyghur/normalize.ts step 9 for the tabulation",
    },
    syl: {
        // ⚠ THE MINUS IS DELIBERATELY ABSENT FROM THIS BLOCK, and that is the whole shape of Sylheti's
        // sign situation. syl's corpus contains three GENUINE negatives (`ꠍꠦꠟꠍꠤꠀꠍ ꠁꠃꠘꠤꠐꠅ -২৭৩.১৫° ꠍꠦ.`,
        // `ꠚꠣꠞꠦꠘꠢꠣꠁꠐ ꠁꠃꠘꠤꠐꠅ -৪৫৯.৬৭° ꠚꠣ.` — absolute zero on both scales), no word for the sign is
        // attested anywhere (ꠝꠣꠁꠘꠣꠍ, ꠝꠣꠁꠘꠥꠍ, ꠞꠤꠘꠣꠔ꠆ꠝꠇ, ꠘꠦꠉꠦꠐꠤꠛ are all 0/0 on syl.wikipedia and
        // en.wiktionary carries no Sylheti entries at all), and omitting a minus INVERTS. So that class
        // stays RED — same stance as `ht` and `rw`. Everything below is a class where the SIGN ITSELF is
        // never used for its arithmetic meaning in this corpus, which is a different and answerable claim.
        //
        // ⚠ AND THE TAXONOMY BELOW WAS READ, NOT COUNTED. The first draft of this entry said "all citation
        // residue"; reading every instance found four kinds, only one of which is residue, and one of them
        // is a real equation. State what is there.
        equals: "37 instances, none of them a Sylheti relation. 31 are unstripped citation-template "
            + "residue (`|last1=Lawson`, `|s2cid=144496795`, `|ꠜꠧꠟꠤꠃꠝ=69`, `|doi=10.1016/…`); 3 are "
            + "ORTHOGRAPHIC composition in the script article (`ꠏꠦꠝꠘ ꠔ+ꠤ=ꠔꠤ`, \"for example ta + i = ti\"); "
            + "1 is a Latin gloss (`ꠟꠦꠐꠤꠘ: columba = ꠚꠣꠞꠧ`). The ONE real equation is a currency "
            + "conversion, `1 ꠒꠟꠣꠞ = 84 ꠐꠦꠇꠣ` — and no Sylheti equals word is attested (sources.ts reports "
            + "`chk?`, and the probe found none), so reading it would be invention",
        plus: "3 instances, all the same orthographic-composition formula as above (`ꠔ+ꠤ=ꠔꠤ`, `ꠕ+ꠥ=ꠕꠥ`, "
            + "`ꠝ+ꠦ=ꠝꠦ`) — a spelling rule, not an addition. No arithmetic `+` occurs and no word is sourced",
        times: "6 instances and NOT ONE is a multiplication. Four are an acronym written with the sign as "
            + "a separator (`ꠝꠦ×ꠅ×ꠍ`, `ꠀꠁ×ꠅ×ꠄꠍ`); one is inside a mojibake'd `ꠛꠤ×ꠄꠟ`; and the last is the "
            + "corpus GLOSSING the character in a punctuation list — `ꠅꠞ ꠝꠣꠏꠈꠣꠘꠧ ꠇꠝꠣ (꠨) ꠀꠞ ꠖꠥꠁ ꠒꠦꠘ꠆ꠒꠣꠞ "
            + "(॥) ꠎꠦꠉꠣꠔ (×)`, where ꠎꠦꠉꠣꠔ is 'junction', a NAME for the mark and not a reading of it",
        "greater-than": "3 instances, all in one sentence, and it is a LANGUAGE-DESCENT chain rather than a "
            + "comparison: `ꠡꠋꠍꠇ꠆ꠞꠤꠔ > ꠝꠣꠉꠗꠤ (ꠝꠂꠕꠤꠟꠤ) > ꠍꠤꠟꠐꠤ > ꠛꠣꠋꠟꠣ` — Sanskrit gives Magadhi gives "
            + "Sylheti gives Bangla. A 'greater than' reading would be actively wrong there",
        ampersand: "2 instances, BOTH inside a Latin-script run where a Sylheti word cannot go — a URL "
            + "query string (`lsi.php?volume=5-1&pages=463`) and an English proper name "
            + "(`Bangladesh B.M.H.M School & College`). Sylheti's `ꠀꠞ` is everywhere in this corpus and is "
            + "the right word for 'and'; the slot is the problem, not the vocabulary",
        "plus-minus": "the sign is ×0 in the corpus and no Sylheti reading is attested for either half",
        "less-than": "the sign is ×0 in the corpus (its twin `>` occurs and is a descent arrow, above)",
        divide: "the sign is ×0 in the corpus and no Sylheti division word is attested",
        currency: "the synthetic probe uses `$`, which is ×0 in this corpus. The currency Sylheti actually "
            + "writes is `৳` ×5, and that IS read — `৳৫` → `ɸas ʈexa`, from ꠐꠦꠈꠣ, defined by the article "
            + "that bears its name (`ꠐꠦꠈꠣ (ꠝꠥꠖ꠆ꠞꠣ ꠙ꠆ꠞꠔꠤꠇ ꠪ ৳ ॥ ꠛ꠆ꠎꠣꠋꠇ ꠇꠧꠒ ꠪ BDT)`). No dollar, euro, "
            + "pound or yen amount occurs, so no name for one is claimed",
    },
    rn: {
        // ⚠ EVERY REFUSAL BELOW IS MEASURED OVER `tools/corpus/mined/rn.jsonc` (4,125 paragraph segments from
        // an rn.wikipedia dump) AND ARGUED IN `src/languages/kirundi/normalize.ts`'s header. rn has no FLEURS
        // corpus and espeak ships no Kirundi at all, so the artifact, the referee word list and `attest.ts`
        // against rn.wikipedia are the whole haystack — which is why each entry names WHICH was asked.
        // ⚠ AND `minus` IS DELIBERATELY ABSENT FROM THIS TABLE, so `review.ts --lang rn` stays RED on it. rn's
        // one genuine negative is the temperature `(nko munsi ya -39°C)`, and Kirundi has no attested word for
        // the sign: the corpus, the referee list and rn.wikipedia are all silent, and Kinyarwanda's phrase
        // (`munsi ya zeru`) is a KINYARWANDA citation that this language does not get to borrow — the whole
        // premise of rn's layer. Omitting a minus INVERTS the value where omitting a plus is lossless, so the
        // class stays failing. Same stance as `ln` and `rw`, reached from rn's own evidence.
        plus: "measured over the artifact: both `+` are WIKIPEDIA PORTAL SIZE MARKERS, not arithmetic — "
            + "`+1 000 000 : English · Deutsch · Français · Español` and `+100 000 : Nederlands · Polski · "
            + "Svenska`, i.e. the interwiki lists of wikis above an article count. No addition appears in "
            + "Kirundi prose anywhere in the corpus, and no Kirundi word for the sign is attested in the "
            + "corpus, the referee list or on rn.wikipedia. Omitting a plus is lossless",
        equals: "measured: the single `=` is a LEXICAL GLOSS in a vocabulary explainer, not an equation — "
            + "`gushavura canke gutungurwa = gutangara` ('to be angry or surprised = to be astonished'), "
            + "where the sign means 'that is'. Kirundi prose in this corpus contains no equation at all, and "
            + "no equals word is attested in any source this repo has for rn",
        times: "measured: `×` is ×0 in the artifact. The corpus's multiplicative idiom is written out as a "
            + "word (`igitigiri c'abantu caraduze incuro kabiri`, 'doubled'), never as a sign, and no Kirundi "
            + "multiplication word is attested digit-adjacent anywhere",
        divide: "measured: `÷` is ×0 in the artifact. The 12 `fractions`-cell `/` shapes are dd/mm/yyyy DATES "
            + "(`01/07/1962`, `13/07/1982`, `27/01/2013`), rate denominators (`hab/km²`, `233/km²`) and five "
            + "measurement SPANS (`22/25`, `1.500 / 1.800`) that normalize.ts step 5 reads as spans — never "
            + "division",
        "plus-minus": "measured: `±` is ×0 in the artifact, and a reading would compose two words neither of "
            + "which is attested for Kirundi",
        "less-than": "measured: `<` is ×0 in the artifact and no comparative-magnitude phrase is attested "
            + "digit-adjacent in the corpus or on rn.wikipedia",
        "greater-than": "measured: `>` is ×0 in the artifact, same evidence as `less-than`",
    },
    hmn: {
        // ⚠ WHITE HMONG (mww) SPECIFICALLY — `hmn` is a macrolanguage and nothing here is evidence about
        // Green Hmong (hnj). And the haystack behind these refusals is the SMALLEST in this table after bal:
        // there is NO Hmong Wikipedia at any code (hmn, mww and hnj all fail DNS; Wp/hnj does not exist on
        // Incubator and Wp/hmn is one page, in English, saying hmn is a macrolanguage), so `attest.ts`
        // cannot be run at all. The only Hmong text that exists is Incubator's `Wp/mww` — 112 pages, 190
        // paragraphs — and that IS the corpus these counts are over, so there is no second tier to appeal
        // to. `sources.ts` reports espeak does not ship this language either. Full argument in
        // src/languages/hmong/normalize.ts.
        degrees: "measured: SIX `°`, and the refusal has two halves. FIVE are temperatures (`6 mus rau -50 "
            + "° C`, `1 mus rau 25 ° C`, `+45,4 ° C`, `-71,2 ° C`, `116,6 ° C`) and normalize.ts step 7 "
            + "CONSUMES them unread, which is a downgrade from a wrong reading to a silence rather than a "
            + "fix: what it replaces is the scale letter `C` reaching the IPA RAW — and in RPA `c` is a real "
            + "onset, so a stray `C` is not even visibly foreign. No degree or scale word exists to put "
            + "there: `sources.ts` says `scale-names [NONE] ° occurs, neither scale name in "
            + "corpus/referee/espeak`, nothing follows `°` in this corpus but a bare letter, and no "
            + "dictionary or phrasebook search returned one. The SIXTH is a COORDINATE (`ntawm 50 ° N. M.)`, "
            + "a latitude) and is deliberately left alone, because a compass direction is CONTENTFUL where a "
            + "scale name beside `° C` is not — the coordinate-only refusal hil, tl and yo also record",
        plus: "measured: TWO `+`, neither of them arithmetic between two operands. One is METALINGUISTIC — "
            + "the corpus's own sentence NAMING the symbol, `qhov kos npe ntxiv (+)` (\"the added-sign "
            + "mark\"), the `za` stub-article shape. The other is a MEASUREMENT PLUS, `+45,4 ° C`, and the "
            + "playbook's own convention is that a measurement plus is frequently omitted and that omitting "
            + "it is LOSSLESS (`+45°` and `45°` are the same temperature). No Hmong plus word is attested "
            + "digit-adjacent anywhere: `ntxiv` ×12 is the ordinary verb/adverb \"to add, additionally\" "
            + "(`cov tswv yim ntxiv`), never an operator",
        equals: "measured: TWO `=` and both are the same GLOSS construction inside one sentence, not a "
            + "copula for a quantity: `'Ch.' = Suav lub npe, 'auto.' = autonym Court npe` — an abbreviation "
            + "key in a list of Miao ethnonyms. ⚠ AND THE CANDIDATE WORD FAILS ITS SENSE CHECK, which is "
            + "trap 37: `npaug` ×2 is both times *sib npaug* = \"balance/equilibrium\", in a sentence about "
            + "the VESTIBULAR SYSTEM (`lub cev sib npaug siv lub vestibular system`), never equality",
        times: "measured: `×` is ×0 in the corpus",
        divide: "measured: `÷` is ×0 in the corpus",
        "plus-minus": "measured: `±` is ×0 in the corpus",
        "less-than": "measured: `<` is ×0 in the corpus",
        "greater-than": "measured: `>` is ×0 in the corpus",
        // ⚠ THERE IS DELIBERATELY NO `minus` KEY AND NO `exponent` KEY, and their absence is the point —
        // the ln/za/cdo shape. hmn's two true negatives are temperatures (`-50 ° C`, `-71,2 ° C`); omitting
        // a plus is lossless but omitting a MINUS INVERTS, and no Hmong word for a negative quantity is
        // attested in the corpus, in any dictionary searched, or in espeak (which does not ship this
        // language). The two `²` are `17.125.187 km²` and its sibling, and an exponent word needs a head
        // noun — hmn has no sourced unit noun to head it, because the corpus writes `km` as the symbol every
        // time and its one spelled-out candidate (`kis lus mev`, ×1) decomposes into `lus Mev` = SPANISH,
        // which this corpus uses in that sense twice. So `review.ts --lang hmn` stays RED on both classes.
        // An accepted silence claims a drop is correct; neither of these is.
    },
    bal: {
        // ⚠ THE EVIDENCE BEHIND EVERY LINE HERE IS UNUSUAL AND IS STATED ONCE, because this language has
        // LESS to source from than any other entry in this table. Balochi has NO referee (kaikki 0,
        // wikipron 0), espeak does not ship it in any variety, `referee-eval.ts` does not accept the code,
        // and there is NO WIKIPEDIA — bal, bcc, bgn and bgp are all absent from Wikimedia's sitematrix and
        // all four fail DNS, so `attest.ts` has nothing to probe. The only Southern-Balochi text that
        // exists is Wikimedia Incubator's `Wp/bcc`, and 37.4% of its long paragraphs are PERSIAN or URDU.
        // So the counts below are over the 383 paragraphs that survive `filter-by-language.py --lang bal`,
        // and where a second number is given it is `Wp/bgn` — WESTERN Balochi, a different language of the
        // macrolanguage, quoted as a labelled second opinion and never as Southern evidence.
        // ⚠ AND THAT DISTINCTION IS WHAT DECIDES THE PERCENT LINE, which is the only class here where a
        // word actually exists. Naming a Western word in a Southern engine is this language's version of
        // the French-into-Haitian-Creole failure.
        percent: "measured: `٪` ×2 Southern (`۷۷٪ جهانی`, `چہ ۸۰٪ بلۏچ`), and the word is attested only in "
            + "WESTERN Balochi — `فیصد` ×14 in Wp/bgn, in slot (`۱۹٫۸ فیصد`, `۱۳ فیصد`) — against ×0 in "
            + "Southern. The one Southern candidate `سدی` ×1 is the CENTURY (`دھمی سدی ءَ`), trap 37; "
            + "`درصد` ×2 and `صدی` ×2 in the unfiltered project are in its Persian and Urdu paragraphs. A "
            + "dictionary check was attempted as the playbook requires of a silence-based refusal and did "
            + "not resolve: webonary.org's dialect-labelled Balochi dictionary returns HTTP 403",
        currency: "measured: the corpus's only currency sign is `₿` ×1, and it is the sign being NAMED "
            + "rather than used — `گۏن سیاھگ ₿` (\"with the symbol ₿\"), beside its own ticker `BTC`, in the "
            + "article on Bitcoin. No amount, no Balochi currency word attested in either corpus; ×0 "
            + "currency signs of any kind in Wp/bgn",
        ampersand: "measured: `&` ×1 Southern and ×1 Western, and both are inside an ENGLISH gloss the "
            + "article supplies for itself — `(Antigua & Barbuda)`. There is no Balochi ampersand to source "
            + "from that, and the Balochi conjunction ⟨و⟩/⟨ۇ⟩ is written out wherever the language means one",
        plus: "measured: `+` ×1 Southern and it is not arithmetic — `گِد + رۏچ اَنت`, an etymology in the "
            + "calendar article showing that ⟨گدرۏچ⟩ is ⟨گِد⟩ plus ⟨رۏچ⟩. ×5 in Wp/bgn, of which the "
            + "readable ones are a mathematical series (`3 − 4 + · · · ۱ − ۲ + ۳ − ۴ + …`) and a second "
            + "etymology (`چَتیس: ۳۶ + گَر`). No plus word is attested in either corpus",
        minus: "measured: `[-−–]` before a digit is ×4 Southern and every one is a RANGE — `2-7 پیش چه "
            + "میلاد` (7–2 BC), `1960-1973`, `۱ - ۶`, `۳-۱`. There is no negative quantity in the corpus to "
            + "read, and no minus word anywhere. ⚠ This refusal is DIFFERENT IN KIND from the plus's and is "
            + "kept separate for the reason the playbook gives: omitting a plus is lossless and omitting a "
            + "minus INVERTS — so this line records an ABSENCE of negatives, and the moment one appears it "
            + "must be re-argued rather than inherited",
        "plus-minus": "measured: `±` is ×0 in both corpora — nothing to read and nothing to source",
        equals: "measured: `=` is ×0 Southern. ×11 in Wp/bgn and genuinely arithmetic there, so this is a "
            + "refusal about the WORD rather than about the sign: no Balochi equals-word is attested in "
            + "either corpus, and Balochi's own `برابر`-shaped candidates do not occur digit-adjacent",
        "less-than": "measured: `<` is ×0 in both corpora",
        "greater-than": "measured: `>` is ×0 in both corpora",
        times: "measured: `×` is ×0 in both corpora. ⚠ And the dimension-cross sense that supplies most "
            + "other languages' evidence is absent too, so there is not even a shape to argue about",
        divide: "measured: `÷` is ×0 in both corpora",
        exponent: "measured: superscripts are ×0 Southern. ×3 in Wp/bgn (`کیلومتر مربع` is written out in "
            + "words beside them), and `units` is ×0 in the Southern artifact — so there is no unit for an "
            + "exponent to attach to, which makes this a missing CLASS rather than a missing word",
        degrees: "measured: `°` is ×0 Southern and ×5 Western, where it is coordinates and one temperature "
            + "(`۴ درجه سانتیگراد(۵۷ °F)`). ⚠ That Western instance also shows the degree WORD `درجه` in "
            + "the same sentence as the sign, i.e. Western Balochi glosses itself here — which is exactly "
            + "the evidence Southern does not have, and exactly why it is not borrowed",
    },
    ti: {
        // ⚠ EVERY COUNT BELOW IS OVER `tools/corpus/mined/ti.jsonc` (323 deduplicated lines from a
        // ti.wikipedia dump) and argued in src/languages/tigrinya/normalize.ts and in
        // docs/investigations/ti_normalization_investigation.md.
        //
        // ⚠ `minus` AND `plus` ARE DELIBERATELY ABSENT FROM THIS BLOCK, and that omission is the whole point
        // of the split. Each has exactly ONE genuine Tigrinya instance that this layer does not read — the
        // electron's charge, `ኤሌክትሮናት -1 ኣሃዱ ዝኾነ ኣሉታዊ ቻርጅ`, and the proton's, `+1 ኣሃዱታት ዝኾነ ኣወንታዊ ቻርጅ`
        // — so they are real unclosed defects and must keep failing (playbook trap 24: a red gate that is
        // correct beats a green gate that is wrong). The seven classes below are different in kind: the
        // SIGN does not occur in Tigrinya text at all, so there is nothing a word could fix.
        equals: "measured: `=` ×2 and NEITHER is a Tigrinya relation. One is inside an English gloss "
            + "(`„መቀለ ድሓር ሰፈነ“ (= divide and conquer)`), the other is a URL query string "
            + "(`index.php?title=Ethiopia_national_football_team&action=edit`). ⚠ AND THE WORD IS NOT THE "
            + "BLOCKER, which is what makes this trap 48's shape rather than a sourcing gap: `ማዕረ` "
            + "\"equal\" is attested ×9 in this corpus. The word is available and the sign is not Tigrinya",
        divide: "measured: `÷` ×5 and NOT ONE IS DIVISION — every instance is clause-final, introducing a "
            + "list (`ንሳቶም ድማ÷`, `ገለ ካብቶም ብቐንዲ ዝጥቐሱ ጥራሕ ንርአ÷`, `እዞም ዝስዕቡ ረብሓታት ኪጎናጸፍ ይኽእል÷`), i.e. "
            + "an idiosyncratic typographic stand-in for the Ethiopic preface colon ፦. Reading it as "
            + "\"divided by\" would turn a list introduction into arithmetic — confidently wrong replacing "
            + "merely silent. The Ethiopic marks this corpus DOES use for that job (። ፣ ፤ ፥ ፦ ፧) are all "
            + "declared and all read",
        "plus-minus": "measured: `±` is ×0 in the corpus",
        "less-than": "measured: `<` is ×0 in the corpus",
        "greater-than": "measured: `>` is ×0 in the corpus",
        times: "measured: `×` is ×0 in the corpus. ⚠ Amharic's whole relational/division block (its "
            + "normalize.ts step 16, the ከ-prefixed comparative and በ-prefixed division) therefore has NO "
            + "instances to transfer to, which is one of the seven am rules this language's re-measurement "
            + "failed — the script makes them look applicable and the count says they are not",
        ampersand: "measured: `&` ×27 and NOT ONE IS A TIGRINYA AMPERSAND. 13 are `&nbsp;`, 11 are numeric "
            + "character entities (`&#x5B;`, `&#x5D;`, `&#x2013;`, `&#x3A;`) and the rest sit inside "
            + "English strings (`Shoe Shine & Piano`, a mangled `R & amp;B`, a `?...&action=edit` URL). "
            + "This is unstripped WIKI MARKUP that survived the dump extraction, not orthography — so the "
            + "refusal is for want of a SIGN, not of a word, and adding a conjunction here would attach a "
            + "Tigrinya word to a non-breaking space",
    },
    mos: {
        // ⚠ EVERY COUNT HERE IS OVER THE FILTERED MOORÉ WIKI, AND THE FILTER IS THE POINT. mos.wikipedia
        // dumps directly (2,088 pages → 12,650 paragraphs) but 11.6% of it is not Mooré, and — measured
        // rather than assumed, because Burkina Faso is francophone — the contaminant is ENGLISH (`of`
        // ×4,460, `the` ×2,658, from citation blocks and Ghana-topic articles) rather than French (`de`
        // ×774). It does not spread evenly: the `ampersand` cell is 44% Mooré and the `era-marker` cell
        // 24%, against `percent` at 99.8%. Counts below are over the 12,733 paragraphs that survive
        // `filter-by-language.py --lang mos`. There is no FLEURS, no kaikki and no wikipron for Mooré and
        // espeak does not ship it, so the corpus and `attest.ts` are the whole haystack. Argued at length
        // in src/languages/mossi/normalize.ts.
        // ⚠ `minus` AND `currency` ARE DELIBERATELY ABSENT FROM THIS LIST — both are real gaps and
        // `review.ts --lang mos` stays red on them. See the notes at the end.
        percent: "measured: `\\d ?%` ×1,328 — this language's largest unread class, in the one cell whose "
            + "evidence is 99.8% Mooré. The corpus writes the GLYPH every time and never spells the "
            + "reading, so the silence alone would not settle it and a dictionary check was owed (the Igbo "
            + "lesson). Every route ran dry: `concept.ts` returns NO Wikidata label and NO article for mos "
            + "on either Q11229 or Q137985650; the French loan is ×0 in every spelling tried (`pourcent`, "
            + "`pursã`, `poursã`, `pursaã`) and Glosbe fr→mos answers \"nous n'avons pas de traductions "
            + "pour pour cent\"; espeak ships no Mooré at all. ⚠ THE COMPOSED NATIVE FORM IS THE ONE THAT "
            + "NEARLY SHIPPED and it is refused on POSITION, which is the Fula `hakkunde` failure exactly. "
            + "`koabg pʋgẽ` (\"in a hundred\", from `pʋgẽ` ×6,707 and the 100-stem the corpus glosses "
            + "itself — `kilometr ramba koabga (62 mi)(Ãnglindi: 100 kilometres)`) comes back attested ×4; "
            + "TWO are the CENTURY sense `yʋʋm koabg pʋgẽ`, and the two percent-sense hits are the SAME "
            + "SENTENCE of ONE article (the Ouahigouya demographics paragraph, in a visibly non-standard "
            + "register). That is a lead, not a finding — and even in that lead the phrase PRECEDES its "
            + "figure (`koabg pʋgẽ gɛɛlga 50,28`) where a normalizer would postpose it. Nothing attests "
            + "the postposed order, so the composition is refused where Fula's `e teemedere` was accepted",
        plus: "measured: `+` ×26 and NOT ONE is a signed number or an operator needing a plus word. One "
            + "arithmetic gloss in one article (`b sõorã yaa tres la torre sẽn naag taab (3 + 2 = 5)`), a "
            + "Tamil ETYMOLOGY gloss (`\"Man\" (\"mangre tɩɩga\") + \"Kay\"`) — the same shape hil, tl and "
            + "ak each record — a biology label pair (`LFS- ne LFS+`), and a telephone country code "
            + "(`Tẽnga code ya +233`). No Mooré plus word is attested anywhere",
        "plus-minus": "measured: `±` ×2, both a TOLERANCE rather than a sign to read: `andante ± 96 bpm` "
            + "and `yʋʋmd 19 600 ± 400 BC`. No word attested",
        equals: "measured: `=` ×25 and only ONE is arithmetic (the `3 + 2 = 5` gloss above). The other 24 "
            + "are MediaWiki heading markup that survived extraction — `==A sẽn wilg tɩ b sẽn maand bũmb "
            + "ningã==` — which is the same residue bm records. Nothing to read and no copula word "
            + "attested digit-adjacent",
        "less-than": "measured: `<` ×1 and it is a DERIVATION ARROW in an etymology, not a comparison: "
            + "`a dotar do tār (< du do \"kẽmba\")`",
        "greater-than": "measured: `>` ×6 and none is a comparison. Four are derivation or translation "
            + "arrows (`Byzantine Greek la Late Latin pitta > pizza`, `\"…vrane\" -> \"Chiro zĩi…\"`) and "
            + "the rest are a blockquote marker. Same class as `<` above",
        times: "measured: `×` ×15 and every one is \"BY\", never \"times\". Nine are the BOTANICAL HYBRID "
            + "sign (`Musa × paradisiaca sẽn yaa Musa acuminata × M. balbisiana`) and the rest a DIMENSION "
            + "CROSS (`kɩls sẽn zem 30 cm × 14 cm × 9 cm (11.8 in × 5.5 in × 3.5 in)`). That is the th and "
            + "bm finding reproduced, and a multiplication word would be wrong for all 15",
        divide: "measured: `÷` ×0 in the whole filtered corpus",
        ampersand: "measured: `&` ×111, and the cell is only 44% Mooré — the lowest-scoring cell this "
            + "layer looked at bar `era-marker`. Read back, the instances are ENGLISH PROPER NAMES inside "
            + "citation and company strings: `Mim Cashew & Agric Products LTD`, `Leadership & "
            + "Development`, `(Camargo & L.B.Sm.) Coppens & F.Leal`, `Room, Adrian (2008). African "
            + "placenames`. Mooré's own \"and\" is `la` (×23,594) and it is never written as `&`, so a "
            + "rule here would be reading English text with a Mooré word",
        exponent: "measured: superscripts ×24, and they are TWO DIFFERENT THINGS — which is why no rule "
            + "fits. Some are a genuine area exponent (`hɛktaar 350 mamsgo (akre 860; km² 3.5)`), but "
            + "others are SUPERSCRIPT TONE NUMBERS in Cantonese-opera transliterations (`Siu² Sang¹`, "
            + "`Mou⁵ Sang¹`, `Faa¹ Daan²`), where a squared reading would be nonsense. No Mooré "
            + "squared/cubed word is attested either: `attest.ts --after` on the metre nouns returns "
            + "nothing, which is the playbook's trap-51 floor — a small wiki does not discuss area",
        degrees: "measured: `°` ×41, all genuine temperature and all in the SAME translated agronomy "
            + "articles (`zĩig sẽn yaa 18 °C n ta 24 °C (64 °F n ta 75 °F)`). The refusal is about the "
            + "WORD, not the sign: `sources.ts` reports `[NONE] scale-names — ° occurs, neither scale name "
            + "in corpus/referee/espeak`, and nothing follows the ° in this corpus but the bare letter. "
            + "espeak ships no Mooré, so there is no phonetic fallback to derive one from",
    },
    tg: {
        // ⚠ EVERY COUNT BELOW IS OVER `tools/corpus/mined/tg.jsonc` (455 retained segments of a 237,973-segment
        // tg.wikipedia dump), corroborated where stated by `insource:` REGEX article counts against that wiki,
        // and argued in `src/languages/tajik/normalize.ts` and
        // `docs/investigations/tg_normalization_investigation.md`. tg has NO FLEURS corpus and espeak ships no
        // Tajik at all, so the artifact, `attest.ts` against tg.wikipedia and Wikidata are the whole haystack;
        // the wikipron/epitran referees are WORD lists and can say nothing about any sign.
        //
        // ⚠ `minus` AND `equals` ARE DELIBERATELY ABSENT, and each for a different reason — the omissions are
        // the point of this block, not an oversight.
        //   `minus`: Tajik HAS real negatives (`ҳарорати миёнаи моҳи январ -4`, `-9`, `-7,8 °C`, `–26°С`) and
        //   no word for them. `манфӣ` is attested ×37 in 20 articles and fails on SENSE every time —
        //   "ҷонишини манфӣ" is a negative PRONOUN, a grammar term; "иттилооти манфӣ" is negative information;
        //   and `Манфӣ` is a Libyan politician's surname. Omitting a minus INVERTS a value where omitting a
        //   plus is lossless, so this stays a red, unclosed defect (playbook trap 24).
        //   `equals`: it IS read — `1 доллар = 100 сент` becomes *як доллар баробар аст ба сад сент*, from the
        //   corpus's own phrasing («Як километри мураббаъ баробар аст ба:»). The rule is guarded to a Cyrillic
        //   or digit operand on both sides, so `review.ts`'s synthetic Latin probe `x = y` reports DROPPED and
        //   is right to: the artifact's Latin-operand instances are optics formulae (`D = ℓlgI 0 /I = k λ ℓ`)
        //   and EasyTimeline markup (`ScaleMinor = gridcolor:lightgrey`), which are not statements about
        //   quantities at all. That is a guard, not a refusal, so it does not belong in this table.
        plus: "measured: `+` ×17 in 10 segments and NOT ONE IS ARITHMETIC. Seven are a MEASUREMENT plus on a "
            + "temperature (`+16°С`, `+37°С`, `аз +24°С то +36°С`, `+28`, `+26`, `+15`, `+22,2 °C`), where "
            + "the sign is redundant with the reading and omitting it is lossless — the playbook's trap-48 "
            + "finding, and the reason a plus may never borrow the minus's argument. The remaining ten are "
            + "DESIGNATIONS: a UTC offset (`UTC+5`), a diplomatic format (`«С5+1»`), two display specs "
            + "(`HD+ (1280x768)`, `FHD + 1080x2400`), a product name (`Super AMOLED Plus`) and a dialling "
            + "code written twice (`Тел.: +992 (3522)`, `Факс: +992`). ⚠ AND THE WORD FAILS ON REGISTER "
            + "INDEPENDENTLY: `ҷамъ` is Wikidata's tg label for ADDITION (Q32043) and all 29 of its "
            + "tg.wikipedia instances are `ҷамъ намудан`, to COLLECT/gather (`ҷамъ намудани далелҳо`) — "
            + "trap 37's wrong-register shape, which is harder to catch than a wrong word because the "
            + "citation looks correct",
        "plus-minus": "measured: ZERO. `±` does not occur in the artifact at all, and no tolerance is "
            + "written any other way. Nothing a word could fix",
        divide: "measured: ZERO. `÷` does not occur in the artifact. The corpus's only division-shaped "
            + "notation is the slash, and every digit-flanked slash in it is either a genuine fraction "
            + "(`1/3 ҳиссаи`, `3/4 тамоми силоҳҳо` — read by normalize.ts step 10 as *як сеюм* / *се чорум*), "
            + "a RATE (`нафар/км²`, `кВт/соат` — read through the tier's `дар`) or a STREET ADDRESS "
            + "(`кӯчаи Ҳусейнзода, 31/1`, `Хиёбони Абӯалӣ Сино, 29/31`), which is why that rule is bounded "
            + "by numerator < denominator ≤ 10",
        "less-than": "measured: ZERO. `<` does not occur in the artifact",
        "greater-than": "measured: `>` ×1, and it is NOT A COMPARISON — it is the historical-linguistics "
            + "DERIVATION arrow in an etymology: `Исфара ( > аз *’spr «сипар» дар суғдӣ )`, \"Isfara (< from "
            + "*’spr 'shield' in Sogdian)\". Reading it as \"greater than\" would turn a sound-change note "
            + "into arithmetic. The comparative word is not the blocker and would not help: `зиёда аз` "
            + "(\"more than\") is everywhere in this corpus, spelled, in exactly the sentences that make a "
            + "comparison — trap 48's shape, where the word is available and the SIGN is not the language's",
        times: "measured: `×` ×2, both in ONE sentence, and both a DIMENSION rather than a product: "
            + "`Бадминтонро дар майдони 13,4×5,2 м (як ба як) ё 13,4×6,1 м (ҷуфт-ҷуфт)` — the badminton "
            + "court, singles and doubles. Beside them the corpus writes the same shape with Cyrillic `х` "
            + "(`16 х 25 миллиметр`, ×2) and with Latin `x` (`1080x2400`, `1280x768`, ×9). ⚠ NO OPERATOR "
            + "WORD IS SOURCEABLE: `зарб` is Wikidata's tg label for MULTIPLICATION (Q40276) and is the "
            + "abstract NOUN — nothing attests it, or anything else, as what a reader says BETWEEN two "
            + "operands. `ба` appears in that very sentence (`як ба як`) and there it means \"one against "
            + "one\", the singles format, not \"one by one\" — the same word in the same line meaning "
            + "something else, which is exactly why a bare count could not settle it",
    },
    sn: {
        // ⚠ EVERY REFUSAL BELOW IS MEASURED OVER `tools/corpus/mined/sn.jsonc` (439 deduplicated segments) AND
        // ARGUED IN `src/languages/shona/normalize.ts`'s header. Shona has NO FLEURS corpus, NO wikipron, a
        // kaikki extract under 25 entries, and espeak does not ship it at all — so the artifact, `attest.ts`
        // against sn.wikipedia and, where named, a cited outside source are the whole haystack. The referee
        // (`epitran sna-Latn`) is programmatic AND word-only, so it can say nothing about any of this.
        // ⚠ AND `minus` IS DELIBERATELY ABSENT FROM THIS TABLE, so `review.ts --lang sn` stays RED on it —
        // the `ln` / `rw` / `ht` stance. Read one by one, the class's 10 lines are FOUR genuine negative
        // LATITUDES (`-18.3`, `-23.5 o S`, `-18.4622700S`, `-18.4468360S`) and six where the hyphen is a
        // DECIMAL RANGE that normalize.ts step 6 declines by design (`0.5-8.9kg`, `3.2-3.6kg`, `0.3-1.2m`,
        // `40-90cm`, `0.5-1.0m`, `2-2.5kg`) — and beside them, outside this class because the sign is not
        // digit-flanked, sit two negative dollar amounts (`-$100`, `-$50`, from a worked example about debt)
        // and `-273,15K`. So Shona has real negatives, and omitting a minus INVERTS a value where omitting a
        // plus is lossless. Two
        // Shona candidates are attested and NEITHER fits the slot: `hwaradada` (23 tokens / 9 articles,
        // glossed `-236 inhamba hwaradada: -236 is a negative number`, but also meaning "empty" —
        // `Musoro wake wakati hwaradada`) and `yakagon'a` (this corpus's own gloss of `-$100`). Both are
        // CONCORDED ADJECTIVES taking the frame NOUN + adjective, never `hwaradada <number>` — the Fula
        // `hakkunde` failure, a real word whose part of speech is not the operator slot. A known-wrong
        // reading does not get to be a green gate.
        equals: "measured over the artifact: 20 `=`, and they ARE Shona prose — a physics/maths article "
            + "cluster (`Basa = Fosi x nhambwe`, `Spidhi = (nhambwe/nguva)`, `0 o C = 273,15K`, "
            + "`431,257,698 = Mazana mana ane makumi matatu…`). So this is a VOCABULARY refusal, not an "
            + "absence one. The word IS attested — `-enzana`, 'be equal': `0 Kelvins inenge YAENZANA ne "
            + "-273,15K`, `inoda KUYENZANA na (22/7)`, and a maths article reading `mbiri (2) kuwanzana "
            + "nenhatu (3) ZVAKAENZANA na 6`. Every finite form carries a SUBJECT CONCORD (`ya-` cl.9, "
            + "`zva-` cl.8, `ra-` cl.5) which this layer cannot compute from a digit, and that article's own "
            + "`zvakaenzana` is already a class mismatch for a numeric subject. A wrong concord is "
            + "confidently wrong; the sign stays silent",
        plus: "measured over the artifact: 11 `+`, and NOT ONE is an arithmetic addition. Eight are a "
            + "COORDINATE SIGN redundant with the letter beside it (`+30 o E`, `+23.5 o`, `+29.9`, `+90 o`, "
            + "`+180 o`, `+20 o`) — and the corpus names that convention itself, `nhamba dzichipiwa vara "
            + "(+)`. Two are ION CHARGES (`Zn 2+`, `Mg 2+`). One is a UTC offset (`GMT + 2hrs`), which the "
            + "playbook's fleet finding identifies as the one contentful plus and the one nothing attests. "
            + "No Shona plus word is attested in the corpus, on sn.wikipedia or in any source this repo can "
            + "reach. Omitting a plus is lossless",
        ampersand: "measured over the artifact: 12 `&`, and EVERY ONE is markup or English. Three are "
            + "`&nbsp;` sitting in the number-unit gap (`46–76&nbsp;kg`, `80&nbsp;km/h`) and two are Greek "
            + "letter entities in a coordinate caption (`&phi;`, `&lambda;`) — normalize.ts step 1 folds all "
            + "five, which is the real defect. The other seven are inside the ENGLISH parentheticals this "
            + "wiki's comparative-Bantu dictionary carries (`flour & water`, `crushers & mills`, `procedures "
            + "& protocols`, `physical & psychological`). ZERO bare ampersands occur in a Shona sentence, so "
            + "the language's conjunction `ne` is deliberately not spent — Chichewa reached the same "
            + "conclusion on its own evidence, and this is Shona's",
        divide: "measured: `÷` is ×0 in the artifact. The 12 `N/N` shapes are FRACTIONS in worked examples "
            + "(`22/7`, `27/16`, `8/10`), two DATES (`31/07/1920`, `12/12/2000`) and rate abbreviations the "
            + "shared tier reads through `unitPer` (`m/s`, `km/hr`). `sources.ts` reports `[NONE] "
            + "fraction-series` and there is no denominator series to compose from — `hafu` is attested "
            + "(`zvitatu nehafu (3.5%)`) and nothing else is",
        "plus-minus": "measured: `±` is ×0 in the artifact, and the reading would compose two words of "
            + "which only one side has any candidate at all — see the minus note above",
        "less-than": "measured: `<` is ×0 in the artifact. Shona expresses the comparison with a verb phrase "
            + "(`chiri pasi pe 10%`, `hunodarika`), which is not a sign reading",
        "greater-than": "measured: `>` is ×0 in the artifact, same evidence as `less-than`",
    },
    ki: {
        // ⚠ KIKUYU'S HAYSTACK, so the strength of every "measured" below is legible. There is no FLEURS ki,
        // no kaikki per-language dump, no wikipron `kik`, no epitran `kik-Latn`, and espeak does not ship
        // the language at all — `sources.ts` reports `[NONE]` or `[chk?]` for every class. The one real
        // referee, en.wiktionary Kikuyu (1062 IPA words), is a WORD list and says nothing about a sign. So
        // the evidence is the 3921-paragraph ki.wikipedia dump behind `tools/corpus/mined/ki.jsonc` plus
        // `attest.ts` against that same wiki — a bigger sample of one source, never two. Counts below are
        // over the artifact's 372 retained segments; all of it is argued at length in
        // src/languages/kikuyu/normalize.ts.
        // ⚠ `degrees` AND `greater-than` ARE DELIBERATELY ABSENT FROM THIS BLOCK, so `review.ts --lang ki`
        // STAYS RED on them. Both are sourcing gaps rather than absences — the degree sign occurs and a
        // degree word may well exist (this wiki's `digirii` is the academic one, ×4/3, every hit); `>`
        // occurs 23 times and one of those, the GDP legend `>$60,000`, could plausibly take the corpus's
        // own `makĩria ma` ("more than"). A class with a reading still to find is a TODO, and this table is
        // not where TODOs go.
        minus: "measured: ZERO true negatives in 3921 paragraphs. Every instance of the `minus` DROPPABLE "
            + "shape resolves to something else on reading: RANGES, which step 5 of normalize.ts claims or "
            + "deliberately declines (`1891-1978`, `1985-1995`, `1849 – 27 February 1936`); a list bullet "
            + "(`fĩthiki - 47, űthagia - 63`); TWO CHESS TOURNAMENT RECORDS (`(+1 -3 =0)`, `(+2 -5 =2)`), "
            + "whose signs are win/loss/draw tallies; and one EXPONENT (`r⋅min −1`, revolutions per "
            + "minute). There is no negative quantity in the corpus at all. ⚠ The playbook's asymmetry is "
            + "attached rather than assumed away: omitting a plus is lossless and omitting a minus INVERTS, "
            + "so this exemption is void the moment a negative value appears in ki text",
        plus: "measured: `+` ×2, and both are the chess records above, where the sign is a tally of wins "
            + "and not an operator. Nothing on ki.wikipedia attests a plus word; `concept.ts` has no ki "
            + "labels, and the corpus's arithmetic vocabulary is a single sudoku article",
        "plus-minus": "measured: `±` is ×0 in 3921 paragraphs, and the reading would compose two words of "
            + "which neither side has a candidate — see the minus and plus notes above",
        // ⚠ 7 → 2, and the same note as nya's `equals`: the five CSS attribute selectors
        // (`.references[data-mw-group=upper-alpha]`) were TemplateStyles residue and left the artifact when
        // the guard reached all three mining routes. The two that remain still carry the whole refusal.
        equals: "measured: `=` ×2, and NEITHER is a comparison to read. Both are chess records (`=0`, "
            + "`=2`, the draw count). Kikuyu states equality with a verb phrase, which is not a sign "
            + "reading, and the class has nothing to attach to. (Was 7 before 5 CSS attribute selectors "
            + "were removed from the artifact as MediaWiki stylesheet residue — same verdict, smaller n)",
        "less-than": "measured: `<` is ×0 in 3921 paragraphs",
        divide: "measured: `÷` is ×0 in 3921 paragraphs. The corpus's one division is written as a VERB "
            + "phrase (`60 sekondi ikĩgayanio na 120`, \"60 seconds divided by 120\"), which is a clause "
            + "and not a word that fits between two operands — the Fula `hakkunde` part-of-speech test",
        times: "measured: `×` ×2, both in one SUDOKU article (`ndaguro kaingĩ kĩa 9 × 9`, `cia 3×3`), "
            + "where the sign is read \"by\" and denotes a grid rather than a product. That is the same "
            + "dimension-cross the playbook records for Thai, and claiming it as multiplication would be "
            + "confidently wrong about the one place ki writes the sign",
        ampersand: "measured: FOLDING THE ENTITIES IS THE WHOLE DEFECT, and step 2 of normalize.ts does "
            + "it. Of 28 `&` in the artifact, 16 are `&nbsp;` and 2 `&quot;` — markup, now folded — and "
            + "every bare sign is inside an ENGLISH name this wiki carries (`Niia & Lil Wayne`, `Trinidad "
            + "& Tobago`, `SM & Bar MMM KStJ`), never between two Kikuyu conjuncts. Kikuyu's conjunction "
            + "`na` is everywhere in the corpus, so the word is not the gap; the SLOT is. Shona reached "
            + "the identical conclusion from the identical evidence",
    },
    eu: {
        // ⚠ BASQUE IS AN ISOLATE, so there is no sibling corpus or sibling referee to lean on and every
        // refusal below rests on eu's own evidence: the 463 retained segments of `tools/corpus/mined/eu.jsonc`
        // (there is no FLEURS eu on disk), espeak's `dictsource/eu_list`, `attest.ts` against eu.wikipedia,
        // and the 20,114-entry wikipron referee. All of it is argued in src/languages/basque/normalize.ts.
        // ⚠ `minus` AND `degrees` ARE DELIBERATELY ABSENT, so `review.ts --lang eu` stays red on both. Each is
        // a reading still to find rather than a measured absence: the corpus's `−` instances sit inside a
        // worked arithmetic example (`2.000 – 1.000`) whose operation is spelled out in words either side, so
        // a sign word would be sourceable from that sentence by someone willing to read it properly; and the
        // bare `°` is not claimed only because `gradu` is attested here as the ANGULAR degree (`ekuatoretik
        // latitude gradu bat`) and the bare instances are coordinates — `°C`/`°F` ARE read, from `gradu
        // Celsius` ×7/6 on the wiki. Those are TODOs, and this table is not where TODOs go.
        equals: "measured: `=` ×2 and neither is a comparison to read — both are LaTeX residue in one "
            + "set-theory paragraph (`S = \\aleph`), which the artifact scan reports separately as "
            + "MARKUP rather than as a dropped sign",
        times: "measured: `×` ×2, and both are SCIENTIFIC NOTATION rather than multiplication — `5.97×10²⁴ "
            + "kg` and `5,98x1024 kg`, the mass of the Earth written twice in the same article with the "
            + "exponent flattened differently. The reading there is an exponent predicate, not `bider`; and "
            + "`bider` is ×0 as a whole word in this corpus, its 6 raw hits all inside `eskubiderik` and "
            + "kin (trap 37, a substring in the wrong sense)",
        divide: "measured: `÷` is ×0 in the retained text. `zati` — the obvious candidate, and the word "
            + "Basque does use for division — is ×9 whole-word here and every one is the NOUN \"part\" "
            + "(`espektroaren zati garrantzitsutzat`, `lurrazalaren zati bat`). Attested, wrong sense",
        "less-than": "measured: `<` is ×0 in the retained text",
        "greater-than": "measured: `>` is ×0 in the retained text",
        "plus-minus": "measured: `±` is ×0 in the retained text",
        plus: "measured: `+` is ×0 in the retained text",
        ampersand: "measured: `&` ×4 and every one is the `&nbsp;` ENTITY, which `core/markup.ts` decodes at "
            + "the registry's dispatch point above this layer — so by the time any eu rule runs there is no "
            + "ampersand left. The bare sign is ×0. Basque's conjunction `eta` is everywhere in the corpus, "
            + "so the word is not the gap; there is nothing to read",
    },
    lg: {
        // ⚠ LUGANDA'S HAYSTACK, so the strength of every "measured" below is legible. There is no FLEURS lg
        // and espeak does not ship the language at all, so `sources.ts` reports `[NONE]` or `[chk?]` for
        // every class it checks. The evidence is the 447 retained segments of `tools/corpus/mined/lg.jsonc`
        // (a 43,455-paragraph lg.wikipedia dump), the artifact's whole-corpus `counts` where they exist, and
        // `attest.ts` against that same wiki — a bigger sample of one source, never two. The one referee,
        // epitran lug-Latn, is a WORD list and a rule system, and says nothing about a sign. All of it is
        // argued at length in src/languages/luganda/normalize.ts.
        // ⚠ `minus` AND `degrees` ARE DELIBERATELY ABSENT FROM THIS BLOCK, so `review.ts --lang lg` STAYS RED
        // on both. Each is a SOURCING gap with a reading still to find, and this table is not where TODOs go:
        // the corpus has one genuine negative (`Latitude:-0.214709`, a southern latitude that inverts if the
        // sign is dropped) and no attested Luganda negative-number word; and the degree sign occurs ×13 with
        // `digiri` well attested (×59/20, and the wiki's own maths textbook NAMES the sign — "Akabonero ka
        // digiri kalagibwa nga ' ° '"), while the SCALE names are not — `Selsiyasi` and `sentigureedi` are
        // both ×0 — so a rule would delete the scale and leave its letter to read as ⟨c⟩ → /c/.
        plus: "measured: `+` ×7 and NOT ONE is an operator. Three are phone country codes "
            + "(`+256753940995/+256788343739/ +256773940995`, `(+0045 6618 4058.)`), two are names or "
            + "markers carrying the sign as a character (`REDD+`, `CD4+ Tcells`), one is the legal-wind "
            + "reading in an athletics record (`100 m: 10.35s (+1.4 m/s)`). Nothing attests a plus word "
            + "either: `plus` on lg.wikipedia is ×10 tokens / 10 articles and every hit is a PROPER NOUN "
            + "(`Sauti Plus Media Hub`, `Coco Plus Vanilla`, `ASSM Elgeco Plus`, `Reach a Hand`), which is "
            + "trap 37; `pulasa` is ×0",
        "plus-minus": "measured: `±` is ×0 in the retained text, and the reading would compose two words of "
            + "which the minus side has no candidate at all — see the plus note above and the header's minus "
            + "paragraph",
        equals: "measured: `=` ×19, and 19 of 19 resolve to something that is not an equation to read — 16 "
            + "are MediaWiki infobox parameters (`| abakulembeze = President Frank-Walter Steinmeier`, "
            + "`| luyimba lw'eggwanga = Das Lied der Deutschen`) and 3 are EasyTimeline directives "
            + "(`PlotArea = left:50 right:20`, `ScaleMajor = unit:year increment:40000000`). ⚠ AND THE WORD "
            + "IS NOT THE GAP, WHICH IS WHY THIS ENTRY IS LONGER THAN ITS COUNT DESERVES: Luganda's equals "
            + "verb is attested twice over, in the corpus (`Obunene Buswedi YENKANA 449 964 km²`) and in the "
            + "wiki's maths textbook (`25 % (kisomwa ebitundu abiri mu bitaano ku kikumi) KYENKANA 25/100 "
            + "oba 0.25`) — but it is a VERB TAKING NOUN-CLASS CONCORD from its subject (kyenkana ~ yenkana "
            + "~ zeenkana), so there is no invariant string to put between two operands and the concord "
            + "cannot be computed from digits. Trap 14 arriving as a reason to DECLINE rather than as a "
            + "conversion to make, and the Fula `hakkunde` part-of-speech test reaching the same place",
        "less-than": "measured: `<` is ×0 in the retained text",
        "greater-than": "measured: `>` ×1, and it is inside a quoted wikitext fragment rather than a "
            + "comparison — `omu ku myaka 11 AD \">11 BCE, AD 11, 1911, 2011`, a disambiguation line whose "
            + "quote mark and angle bracket are both markup residue",
        times: "measured: `×` is ×0. The one multiplication this corpus writes is spelled with an ASCII "
            + "letter and is a DIMENSION product, not a sign to read: `Ojja kufuna sekazzi 7200 k.k. "
            + "(2x3x1200)`, three seeds per hole times 1200 holes",
        divide: "measured: `÷` is ×0 in the retained text",
        ampersand: "measured: THE CELL IS ENTITIES AND `core/markup.ts` ALREADY DECODES THEM, above this "
            + "language's layer — `&nbsp;` ×4, `&#x5B;`/`&#x5D;` ×4 each (the bracketed `okujuliza "
            + "kwetaagisa`, \"citation needed\") and `&#x2013;` ×1 (an en dash inside the year span "
            + "`1861&#x2013;1865`, which normalize.ts's range step then claims). The `ampersand` cell "
            + "reports ×1007 whole-corpus and is measuring the same thing. The BARE sign is ×3 and two are "
            + "inside English names this wiki carries (`Zero & Nil`, `Wolters Kluwer/Lippincott Williams & "
            + "Wilkins`); the third is a Luganda sentence (`omusunyi w'endongo Johnny Zero & omuyimbi Maxi "
            + "Nil`) where it does mean \"and\". Luganda's conjunction `ne`/`n'` is everywhere in the "
            + "corpus, so the word is not the gap — one instance is not a rule (trap 9). ki and sn reached "
            + "the identical conclusion from the identical evidence",
    },
    et: {
        // ⚠ ESTONIAN'S HAYSTACK, so the strength of every "measured" below is legible. There is no FLEURS et
        // on this machine, so the corpus evidence is the 464 retained segments of `tools/corpus/mined/et.jsonc`
        // (a 1,931,621-paragraph et.wikipedia dump) plus `attest.ts` against THAT SAME WIKI — a bigger sample
        // of one source, never two. What is genuinely independent is espeak-ng's `dictsource/et_list` (380
        // lines, and it declares readings for `+`, `-`, `=`, `<`, `>`, `%`, `$`, `€`, `£`) and the referee
        // `et.wikipron-est-broad.tsv`. Every refusal is argued at length in src/languages/estonian/normalize.ts.
        // ⚠ `minus`, `plus`, `ampersand`, `percent`, `currency`, `degrees` AND `exponent` ARE ABSENT FROM THIS
        // BLOCK BECAUSE THEY ARE SHIPPED, not because they are unresolved — `review.ts --lang et` is green on
        // all seven. The six entries here are the whole of this language's sign silence.
        equals: "measured: `=` ×9, and the DOMINANT SENSE IS NOT ARITHMETIC — it is EQUIVALENCE-OF-NAME. "
            + "Two are title glosses giving a work's other language's title (`\"Kuitund = The If Hour\"`, "
            + "`Henriku Liivimaa kroonika = Heinrici chronicon Livoniae`), where the sign means \"also "
            + "known as\"; three are currency-conversion statements (`£1 = 240p`, `£1 = 100p`, `400 rubla = "
            + "1 USA dollar`); three are mathematics (`x = log a N`, `siis y = z`, `f(x) = sin(x) + x³`); "
            + "and one is a raw LaTeX fragment the dump preserved (`\\lim_{\\Delta x\\to 0} \\, \\Delta y = "
            + "0`), which the scan reports separately as `MARKUP math-sign ×1`. "
            + "⚠ AND THE WORD IS NOT THE GAP, WHICH IS WHY THIS ENTRY IS LONGER THAN ITS COUNT DESERVES. "
            + "Estonian's equals verb is `võrdub` and it is attested ×39 tokens / 20 articles on "
            + "et.wikipedia, DEFINITIONALLY and beside the sign itself: \"Kilomeeter (tähis km) on "
            + "SI-süsteemi pikkusühik, mis VÕRDUB tuhande meetriga: 1 km = 103 m = 1000 m\". But every hit "
            + "shows it GOVERNS THE COMITATIVE on its complement — *võrdub 1000 kilogrammiGA*, *võrdub "
            + "tuhande meetriGA*, *võrdub 61,0459 puudaGA*, *võrdub alale jäävate siseveekogude pindalade "
            + "summaGA* — and this layer's right-hand operand is DIGITS, which become words in the "
            + "tokenizer downstream of every rule here. `240p võrdub` cannot be inflected, so *võrdub 240p* "
            + "would be ungrammatical. Trap 14 arriving as a reason to DECLINE rather than as a conversion "
            + "to make, and the same shape as lg's noun-class `kyenkana`. ⚠ espeak's `_= v8R:dus||m,&rk:` "
            + "does NOT rescue it: that is *võrdusmärk*, the sign's NAME, which is the wrong REGISTER for "
            + "what a reader says between two operands — the Hindi `धन` mistake exactly",
        "plus-minus": "measured: `±` is ×0 in the retained text and ×0 in the artifact's `signs` cell "
            + "examples. A definitive absence, recorded so the negative is not re-investigated (trap 48). "
            + "Estonian would compose it from the two words this layer already ships (`pluss` + `miinus`), "
            + "so this is not a sourcing gap either — there is simply nothing here to read",
        "less-than": "measured: `<` is ×0 in the retained text. espeak declares `_< v&ik:sem` (*väiksem*, "
            + "\"smaller\"), so the word exists; what is missing is the FRAME. Estonian's comparative takes "
            + "the elative on its standard (*väiksem kui*, *väiksem kolmest*), and with digit operands "
            + "neither the `kui` complementiser nor the case can be placed — the same trap 14 wall the "
            + "equals entry hits. ×0 instances means nothing is pressing the question",
        "greater-than": "measured: `>` is ×0 in the retained text. Same as `less-than`, and espeak's "
            + "`_> su:rem` (*suurem*) has the same comparative frame problem",
        times: "measured: `×` is ×0. The one multiplication-shaped string this corpus writes is spelled "
            + "with an ASCII letter and is a RELAY EVENT, not an operator — `medali Ivar Stukolkin 4x200 m "
            + "vabaujumises (7:23.50)`, the 4×200 m freestyle relay, where Estonian says *neli korda "
            + "kakssada meetrit* and the reading is a dimension idiom rather than arithmetic. One instance "
            + "of a shape the sign does not even use is not a rule (trap 9)",
        divide: "measured: `÷` is ×0 in the retained text. The corpus's only division is written with a "
            + "slash inside a fraction (`2/3`, `1/5`) or a rate (`$/kg`, `kg/ha`, `in/km²`), both of which "
            + "normalize.ts declines for their own measured reasons. A definitive absence, like `plus-minus`",
    },
    qu: {
        // ⚠ THERE IS NO FLEURS FOR QUECHUA, so every count below is over `tools/corpus/mined/qu.jsonc`'s
        // 446 retained segments (246 hard + 200 sample) from a qu.wikipedia dump, with the whole-corpus
        // cell counts quoted where they exist. espeak does not ship Quechua at all and there is no
        // wikipron, so the haystack is the corpus, the artifact, the kaikki referee and qu.wikipedia via
        // `attest.ts`. Every refusal is argued at length in src/languages/quechua/normalize.ts's header.
        // ⚠ AND THE CORPUS IS 19.7% SPANISH-DOMINANT, measured with `filter-by-language.py --lang qu` (a
        // row added for this run). That matters here specifically: the arithmetic and bibliography cells
        // are the DIRTIEST ones, so several of the counts below are counts of Spanish or Latin text and
        // are labelled as such rather than being read as facts about Quechua.
        equals: "measured: 28, and the DOMINANT SENSE IS NOT ARITHMETIC AT ALL — it is TAXONOMIC "
            + "SYNONYMY. Six of the eight `arithmetic` hard-set instances are a pair of Latin binomials "
            + "either side of the sign (`Anas specularoides = Lophonetta specularioides`, `Pseudalopex "
            + "culpaeus = Dusicyon culpaeus`, `Centropelma microptera = Rollandia microptera`, `Felis "
            + "colocolo = Leopardus colocolo`), where the sign means \"is the same species as\" and no "
            + "operator word is right. The rest are a GLOSS (`km² = t'asra waranqa thatki`, `Muyuk'uchu = "
            + "360 patakuna = 400 patachakkuna`, `Sapan Churi = Hijo solo`) — the `ket`-style copular use "
            + "Ilocano also found — and LaTeX residue (`\\mathbb{R} = \\{x / x\\}`, `T = 6l²`). No "
            + "Quechua equals word is attested digit-adjacent anywhere in the corpus or on qu.wikipedia",
        plus: "measured: 60 in the artifact, and every one read back. The single largest block is one "
            + "CORRUPT paragraph of keyboard mash (`+9+98+95FT+9D59NG5+GFH9+…`, 40 signs in one line), "
            + "which is not text. What remains is exactly the two classes trap 48 settled fleet-wide, plus "
            + "one that is neither: a MEASUREMENT PLUS on an Andean elevation — `+4.200 mitrum aswan "
            + "hanaq`, `+4.600 m`, `+4.800 m`, `+4.400 m`, `+4.000 m` — where the sign is REDUNDANT with "
            + "the `aswan hanaq` (\"higher than\") the sentence already carries, so omitting it is "
            + "lossless in the playbook's own sense; a complex-number worked example rendered in LaTeX "
            + "(`(2 + 5i) + (-8 +17i) = (2 + -8) + (5 + 17)`); and a Gantt-chart offset "
            + "(`shift:(25,-10)`). Nothing in this language attests how a plus would be said",
        times: "measured: 6, AND THE SENSES DO NOT AGREE, which is why no `multiply` is declared. "
            + "`2.9–4.8 × 109 inti masayuq` is a PRODUCT (a mantissa in scientific notation); `1874, 80 × "
            + "100 cm, musée Courbet` is a painting's DIMENSIONS, which wants \"by\"; `4×100 m estilo "
            + "libre` and `4×200 m estilo libre` are SWIMMING RELAYS inside a Spanish results table, which "
            + "want \"by\" too and are not Quechua text. `kuti` is the only candidate and it is attested "
            + "exactly ONCE in the product slot — `huk Newton N nisqaqa huk kilugramu kuti mitru t'asra "
            + "sikunduman` (kg·m/s², qu.wikipedia's SI article) — while `multiply.by` defaults to "
            + "`multiply.times`, so declaring the one word would read the canvas as \"eighty TIMES one "
            + "hundred centimetres\". One article, one slot, and wrong for the majority of instances",
        "greater-than": "measured: 4, and NOT ONE is a comparison. All four are the ASCII arrow `--->` "
            + "in two name-evolution chains that are themselves Spanish glosses — `Suti: Virú ---> Pirú "
            + "---> Perú (kastilla simipi) ---> Piruw (qhichwa simipi)` and `República Peruana [1821 - "
            + "1950] ---> República del Perú`. Reading the sign there would speak \"greater than\" three "
            + "times inside a list of spellings",
        "less-than": "measured: zero `<` in 446 segments. A query that was run, not a gap",
        divide: "measured: zero `÷` in 446 segments. ⚠ The `/` that DOES occur is a different question and "
            + "is not this class: it is a rate denominator (`14 m³/s`, `217 km/s`, which normalize.ts now "
            + "reads with the dative `sikunduman`), a common-noun ratio the unit table cannot name "
            + "(`8,76 runa/km²`, `0,59 gol/partido`), or a year pair (`1615/1616`, `1803/04`)",
        "plus-minus": "measured: zero ± in 446 segments",
        // ⚠ `minus` IS DELIBERATELY ABSENT AND `review.ts --lang qu` STAYS RED ON IT — the ak / ln / bm /
        // ilo / shi stance. Omitting a plus is lossless; omitting a minus INVERTS, so a class whose drop
        // would be wrong the moment a negative appears does not get to be a green gate. Measured: U+2212 is
        // ×0 and the two `DROP minus` instances are an ASCII hyphen inside the complex-number example and
        // inside the Gantt offset above, so this corpus contains no negative QUANTITY at all — Hindi's
        // position, re-measured here. That is a fact about this corpus and not about Quechua, and no
        // Quechua sign word is attested in any source, so nothing is read and the gate stays red.
        // ⚠ `percent` IS ALSO DELIBERATELY ABSENT, and for the OTHER reason: `%` is ×170 whole-corpus and
        // `DROP percent ×11` here, so the drop is a real lost reading rather than a correct silence. The
        // two candidates both fail on SENSE — `pachakmanta` ×13/13 is "N HUNDRED" twelve times over
        // (`qanchis pachakmanta aswan rikch'aqkunam`, "more than seven hundred species") and its one
        // remaining hit writes the SIGN as well (`sapa pachakmanta 14.6%`); `pursintu`, `pursyintu`,
        // `porsyentu` and `pachakchasqa` are ×0 on qu.wikipedia. This is Tashelhit's position: a wrong
        // percent word is worse than a dropped sign, and the day one is attested the gate goes green.
        // ⚠ `degrees` IS ABSENT TOO, and NOT because the sign is unread — normalize.ts reads a bare `°` as
        // `k'atma`. What the probe tests is `20 °C`, and the SCALE name is what has no source: `°C`, `°F`,
        // `℃` and `℉` are ALL ×0 in this corpus and `sources.ts` reports `scale-names [NONE]`. The rule
        // refuses the whole match rather than half of it (trap 53), so `°C` reads exactly as it did
        // before; the class stays red because a missing scale word is a real gap, not a correct silence.
    },
    sat: {
        // ⚠ SANTALI IS THE OPPOSITE SHAPE TO EVERY OTHER ENTRY IN THIS TABLE, AND ONLY TWO CLASSES BELONG
        // HERE. Elsewhere a class is silenced because the SIGN is never used for its arithmetic meaning in
        // that corpus (syl's `×` is an acronym separator, bal's `+` is an etymology, ki's `&` is an English
        // name). sat's `+ − × ÷ = <` ARE arithmetic — every one is in the wiki's own zero/arithmetic
        // article, `᱐ × ᱑ = ᱐`, `᱑ + ᱐ = ᱑`, `᱐ - ᱑ = -᱑`, `᱑<᱒<᱓` — and Santali HAS a complete native
        // vocabulary for them, each with a dedicated sat.wikipedia article that states its own sign:
        //     +  ᱥᱮᱞᱮᱫ   "ᱥᱮᱞᱮᱫ (ᱤᱝᱞᱤᱥ: Addition) (ᱱᱚᱶᱟ ᱨᱮᱭᱟᱜ ᱪᱤᱱᱦᱟᱹ ᱫᱚ \"+\")"   44 tok / 11 arts
        //     −  ᱵᱷᱮᱜᱮᱫ  ×  ᱜᱟᱵᱟᱬ   ÷  ᱦᱟᱴᱟᱬ   =  ᱥᱚᱢᱟᱱ ᱪᱤᱱᱦᱟᱹ
        // (ᱥᱮᱞᱮᱫ is independently in en.wiktionary from Hansdah's *Concise English-Santali Dictionary*.)
        // What blocks the reading is SYNTAX, not vocabulary: these are operation NOUNS and the articles'
        // own worked examples put the infix on `ᱟᱨ` with the operation POSTPOSED —
        // `᱒+᱓ = ᱕ (ᱢᱮᱱᱫᱚ ᱒ ᱟᱨ ᱓ ᱥᱮᱞᱮᱫ ᱞᱮᱠᱷᱟᱱ ᱕ ᱦᱩᱭᱩᱜᱼᱟ)`, with subtraction taking the ablative ᱠᱷᱚᱱ on
        // the minuend. So `᱑ ᱥᱮᱞᱮᱫ ᱐` is ungrammatical and a correct rule restructures the expression.
        // **That is an addressable gap, not a permissible silence**, so `plus`, `minus`, `times`, `divide`,
        // `equals` and `less-than` are DELIBERATELY ABSENT from this block and `review.ts --lang sat` stays
        // RED on them — the `ak` exponent stance and the `syl` minus stance, for the same reason. The
        // minus is the sharpest case: this corpus writes a real negative result (`᱐ - ᱑ = -᱑`) and omitting
        // a minus INVERTS.
        ampersand: "17 instances and NOT ONE is a Santali conjunction. 11 are the HTML entity `&nbsp;` "
            + "surviving the dump (`83,883&nbsp;km²`, `$25&nbsp;ᱢᱤᱞᱤᱭᱚᱱ`) — markup, not text, and "
            + "normalize.ts step 1 repairs those to a space because they sat between a number and its unit "
            + "and broke the adjacency the shared tier matches on. The rest belong to English proper names "
            + "inside a Latin run (`A. P. J. Abdul kalam`, `ᱰᱤᱯᱷᱮᱱᱥ ᱨᱤᱥᱚᱨᱪ & ᱰᱮᱵᱷᱞᱚᱯᱢᱮᱱᱴ ᱚᱨᱜᱟᱱᱤᱡᱮᱥᱚᱱ "
            + "(DRDO)`). Santali's conjunction `ᱟᱨ` is everywhere in this corpus, so the word is not the "
            + "gap; the SLOT is — the same conclusion ki and sn reached from the same evidence",
        "plus-minus": "the sign is ×0 in the corpus and no Santali reading of it is attested. Unlike the "
            + "arithmetic signs above there is nothing to restructure here, because there is nothing there",
    },
    tn: {
        // ⚠ EVERY COUNT BELOW IS OVER THE 448 RETAINED SEGMENTS OF `tools/corpus/mined/tn.jsonc` (240 hard +
        // 200 sample, from a 44,271-paragraph tn.wikipedia dump), with the artifact's whole-corpus `counts`
        // quoted where they differ, and every refusal is argued in `src/languages/setswana/normalize.ts`.
        // Setswana has NO FLEURS corpus and espeak does not ship it at all; `concept.ts` returns no tn label
        // for ANY of these concepts, not even an article title. So the artifact and `attest.ts` against
        // tn.wikipedia are the whole haystack, and the referee (`epitran tsn-Latn`) is programmatic and
        // word-only, so it can say nothing about any of this.
        // ⚠ `minus` IS DELIBERATELY ABSENT FROM THIS BLOCK, so `review.ts --lang tn` STAYS RED on it — the
        // gn / sn / ln stance. normalize.ts DOES read a negative TEMPERATURE (`−15.0 °C` →
        // `dikirii tsa Celcius tse di kwa tlase ga lefela di le …`, from tn.wikipedia's own gloss
        // *"degree Celsius tse di kwa tlase ga lefela di le thataro ntlha botlhano (−6.5 °C)"*), which
        // covers five of the class's seven instances. What stays unread is the BARE negative — this
        // corpus's negative LATITUDE, `selekanyo sa -21.95 (21° 56' 60 S)` — and "below zero" is not what a
        // southern latitude says. The probe is `-5`, a bare number, so it reports DROPPED and is right to.
        // Omitting a plus is lossless; omitting a minus INVERTS, so this line goes green the day a Setswana
        // negative-number word is attested, and not before.
        plus: "the only `+` in the retained text is `UTC+02:00`, and the playbook's fleet-wide finding is "
            + "that the UTC-offset plus is the one contentful plus that nothing attests in any language. "
            + "The measurement-plus context (`+30 °C`) does not occur here at all. No Setswana candidate "
            + "exists to check: `concept.ts` has no tn label for 'addition' or 'plus sign'",
        "plus-minus": "×0 in the retained text and ×0 in the whole-corpus `signs` cell breakdown. Nothing "
            + "to read and no candidate word in any source",
        equals: "×122 whole-corpus in the `arithmetic` cell, and NOT ONE is Setswana arithmetic. Every "
            + "instance in the retained text is an EasyTimeline chart directive the dump preserved "
            + "(`PlotArea = left:50 right:20 top:25 bottom:30`, `ScaleMajor = unit:year increment:11000 "
            + "start:0 gridcolor:linegrey`, `ScaleMinor = …`) or an English book title in a citation "
            + "(`Food × Mixing + Heat = Baking, New York: Stewart, Tabori & Chang`) or an infobox field "
            + "(`| currency = Zimbabwe Gold …`). Setswana prose in this corpus contains no equation. This "
            + "is the gn / nya conclusion from the same evidence: markup, not text",
        "less-than": "×0 in the retained text. The comparison is written as WORDS throughout — "
            + "`ka fa tlase ga 5%`, `e e kwa tlase ga`, `go feta` — so there is no sign to read",
        "greater-than": "×0 in the retained text, for the same reason as `less-than`: the corpus writes "
            + "`go feta` / `di fetang` in full",
        divide: "×0 in the retained text. The `/` that does occur is a rate (`km/h`, `m/s`, `m3`), which "
            + "the shared tier composes with `ka` — never a division",
        times: "16 matches of the shape and NOT ONE has an attested Setswana reading. Six are RELAY "
            + "FORMATS (`4×100m relay` ×3, `4 × 400 m relay` ×2, `4x400 relay`), two are scientific-"
            + "notation mantissas whose superscript the dump lost (`3.9×109 cu ft`, `1×10−6 metre`), one "
            + "is a product (`360×1024`), one a dental formula (`× 2 = 46-50`), one an English book title, "
            + "and the rest are my own probe matching `&#x20;` entities. ⚠ THE CORPUS'S OWN GLOSS OF THE "
            + "COMMONEST CASE IS A PARAPHRASE, NOT A WORD: `4×100m relay` is written out as *batho ba le "
            + "bane dimmithara dile lekgolo mongwe le mongwe* — 'four people, one hundred metres each' — "
            + "which no substitution rule can produce. The one candidate, `makgetlho` (*makgetlho a le "
            + "lesome le borataro*, 'sixteen times'), is the OCCURRENCE word and not the multiplier: a real "
            + "word whose slot is not this slot, which is the Fula `hakkunde` failure. Nothing is read",
    },
    bo: {
        // ⚠ EVERY COUNT BELOW IS OVER THE RETAINED TEXT OF `tools/corpus/mined/bo.jsonc` — 419 segments out
        // of an 89,427-paragraph bo.wikipedia dump — with the artifact's whole-corpus `counts` quoted where
        // they differ. `attest.ts` against bo.wikipedia and `concept.ts` are the second tier; espeak does
        // not ship Tibetan at all, so there is no third. Every refusal is argued in
        // src/languages/tibetan/normalize.ts and worked in docs/investigations/bo_normalization_investigation.md.
        // ⚠ `minus` IS DELIBERATELY ABSENT, AND THAT IS WHY `review.ts --lang bo` STAYS RED ON IT — the
        // gn / ak / ln / bm / ilo stance. Tibetan has at least one genuine negative in the retained text
        // (`Ayding Lake (−154m)`, a below-sea-level elevation), and omitting a minus INVERTS where omitting
        // a plus is lossless. What is missing is a WORD, not a guard: Wikidata's bo label for subtraction
        // (Q40754) is `འཕྲི་རྩིས`, the operation NOUN — trap 35's `जोड़`/`धन` split — and nothing attests
        // what a reader says between two operands. The gate comes green the day one is attested.
        plus: "×12 in the retained text and NOT ONE is a spoken plus between two numbers. Eight are one "
            + "linguistics table's MORPHOLOGICAL FORMULA joining word-class names — `སྔོན་འཇུག+མིང་གཞི།"
            + "+འདོགས་ཅན།` ('prefix + root + suffix'), where the sign concatenates labels the way a `-` "
            + "does in a compound; two are ALGEBRA in a maths article (`X+Y=30`, `x²*20+x³*20=295,237,900`, "
            + "with `x` and `y` as variables); one is CHEMISTRY (`Al 2 O 3 + 2NaOH → 2NaAlO 2 + H 2 O`); "
            + "and one is a telephone COUNTRY CODE, `(+86)0973`. The playbook's own finding on this class "
            + "(trap 48) is that the plus is written as a glyph everywhere and spelled nowhere, so corpus "
            + "silence settles nothing on its own — but here the SENSE settles it: there is no arithmetic "
            + "plus in this corpus to read, and a compound joiner is correctly spoken by simple adjacency",
        "plus-minus": "×0 in the retained text and `signs`/`arithmetic` show no ± anywhere. `sources.ts` "
            + "agrees: `[  · ] plus-minus-word — the sign does not occur in the evidence`. A definitive "
            + "absence, not a gap",
        equals: "×15 and every one is METALINGUISTIC or a formula, which is why this is the largest "
            + "remaining drop and still not a reading gap. The bulk is bo.wikipedia's SI-unit stub series "
            + "defining one unit in terms of another — `༡སྐར་ཆ། = ༡ ༠༠༠ སྐར་ཆ་ཕྲ་མོ།(ms) = ༡༠༠༠ ༠༠༠ཝེ་སྐར་ཆ།"
            + "(µs)`, `༡ལི་སྨིད། = ༡/༡༠༠སྨི།`, `༡ཝ་ཐི། = ༡/༡ ༠༠༠ ༠༠༠ ས་ཡ་ཝ་ཐི།(MW)` — beside school algebra "
            + "(`X=22ནི་མཉམ་བྱ་x+12=34`), a chemistry worked example (`2 x (1)² = 2`) and a Devanagari "
            + "glossary line (`(Rig Veda / Vedic tradition) = वेद परम्परा`). ⚠ AND THE ONE CANDIDATE IS THE "
            + "WRONG PART OF SPEECH, in the corpus's own sentence: `མཉམ་བྱ` in `X=22ནི་མཉམ་བྱ་x+12=34` is "
            + "the NOUN 'equation' naming the whole expression, not what a reader says at the sign — the "
            + "Fula `hakkunde` failure, and the sentence that supplies the word also shows it in the wrong "
            + "slot. Nothing is read",
        "less-than": "×0 in the retained text; `sources.ts` reports the sign as not occurring in the "
            + "evidence at all",
        "greater-than": "×0 in the retained text; `sources.ts` reports the sign as not occurring in the "
            + "evidence at all",
        times: "×2, and NEITHER IS A MULTIPLICATION. `དེབ་ཚད་༨༥༠×༡༡༦༨` is a book's PAGE SIZE, i.e. a "
            + "dimension cross that reads 'by' rather than 'times', and `2 x (1)² = 2` is an ASCII `x` "
            + "inside the electron-shell worked example, where it is the algebraic multiplier of a formula "
            + "this layer reads for no language. One reading cannot serve both senses (the ug/si/tg "
            + "finding), and no Tibetan operator word is attested for either: Wikidata has no bo label for "
            + "multiplication and `attest.ts` returns nothing in the slot",
        divide: "×0 in the retained text. The `/` that does occur is a UNIT RATE (`km/h`, `m/s༢`, read by "
            + "normalize.ts step 4 with the corpus's own `ཆུ་ཚོད་རེར`) or a FRACTION inside the SI-unit "
            + "stubs (`༡/༡༠༠སྨི།`), never a division between two prose operands",
        ampersand: "×42 in the `ampersand` cell and not one is a Tibetan conjunction. Every occurrence is "
            + "either an HTML ENTITY the dump preserved — `&nbsp;`, `&ndash;` ×5, `&#126;`, `&#x5B;` — "
            + "which `stripMarkup` decodes at the registry's dispatch point ABOVE this layer, so the probe "
            + "is the only place it can still be seen; or it sits inside an embedded ENGLISH title, "
            + "`\"མེ་ཏོག་དང་ཟླ་འོད། flower & Moon\"`, where the film's Tibetan name is given first and the "
            + "English gloss follows. This is not a sourcing gap — Tibetan's coordinator `དང` is already in "
            + "tibetan.jsonc as the number composer's joiner — it is that reading `&` as དང inside an "
            + "English phrase would be wrong, and there is no Tibetan `&` to read",
    },
    ky: {
        // ⚠ EVERY COUNT BELOW IS OVER THE RETAINED TEXT OF `tools/corpus/mined/ky.jsonc` — 456 segments
        // (256 hard + 200 sample) out of a 233,521-paragraph ky.wikipedia dump — with the artifact's
        // whole-corpus `counts` quoted where they differ. `attest.ts` against ky.wikipedia is the second
        // tier and espeak's `dictsource/ky_list` the third. Every refusal is argued in
        // src/languages/kyrgyz/normalize.ts, at the foot of the file.
        // ⚠ THE CLASS IS READ — this exemption is about the PROBE'S SHAPE, not about the sign. normalize.ts
        // step 8b claims a dash whose number is followed by a DEGREE mark and which is not itself preceded by
        // a digit, a degree, a prime or a letter: 18 hits over the 456 retained segments and ZERO false
        // positives, every one a genuine negative temperature (`-38°С`, `−10 °Cга`, `-18°Сден`, `—40°С`,
        // `-23...-29 °C`). Before it, `-38°С` read as *отуз сегиз градус* — thirty-eight degrees ABOVE zero,
        // the sign silently INVERTED. The word is ky.wikipedia's own: «Минус (латынча minus – кем) – кемитүү
        // амалын, ошондой эле терс санды…», and «белгилер [+ (плюс), — (минус), . (чекит)]».
        minus: "READ where the corpus can be told apart, and the probe `-5` is the shape that CANNOT be. "
            + "Dash-before-digit is 285 instances in 456 segments and the overwhelming majority are RANGES "
            + "(`2750-3800 метр`, `25-35 см`, `20-23 күндү`, `6-16 °C`) or coordinates (`39°11′–43°16′`); a "
            + "bare `-5` with no right context is exactly the ambiguous case, so claiming it would claim all "
            + "285. The degree-flanked arm that IS shipped covers 18/18 with no false positive — see the note "
            + "above. ⚠ The artifact scan still reports `DROP minus ×9` and that is a REAL, argued gap left "
            + "deliberately red: those nine are the RANGE dashes, and the range joiner is refused because "
            + "Kyrgyz's `чейин` is a postposition needing the ablative on one operand and the dative on the "
            + "OTHER — and the corpus puts that dative on the following UNIT (`16дан 19 ммге чейин`), not on "
            + "the number the rule would have",
        plus: "20 retained instances and NOT ONE is arithmetic: `+4 °Cдан`, `+22 °C`, `+8...+10 °C` are "
            + "temperatures where the sign is REDUNDANT with the degree word the layer now emits (trap 12, "
            + "and the playbook's own audio finding that a measurement plus is routinely unspoken while a "
            + "minus INVERTS — the two never share an argument); `UTC+5:45` and `UTC-08:00` are offsets. "
            + "espeak's `ky_list` gives `+ qoS'u:` = кошуу, but that is the NOUN 'addition' — the ky.wikipedia "
            + "минус article calls the operation `кемитүү амалы`, i.e. the same nominal register — and trap 37 "
            + "warns that a correctly-sourced word from the wrong register is harder to catch than a wrong one",
        "plus-minus": "the sign does not occur in the corpus at all (0 in 456 retained segments, and the "
            + "artifact's whole-corpus `signs` cell carries no ± instance). No candidate word, and nothing to "
            + "measure a candidate against",
        "less-than": "0 occurrences. espeak's `ky_list` does carry names — `> azd'Iq belgisi`, "
            + "`< kOptyk belgisi` — and they read as 'the LESS sign' for `>` and 'the MORE sign' for `<`, "
            + "i.e. the pair is inverted or is naming something else entirely. An unverifiable source on a "
            + "class with zero instances is not a reading",
        "greater-than": "0 occurrences; see less-than — the same espeak pair, with the same inversion",
        times: "×1 in 456 segments. espeak gives `× kObOjty:` = көбөйтүү, which is the NOUN "
            + "'multiplication' (ky.wikipedia's arithmetic prose uses it that way: «кошуу, кемитүү, "
            + "көбөйтүү, бөлүү» as a list of OPERATIONS), and nothing attests what a reader says BETWEEN two "
            + "operands. One instance is not enough to settle a register question that trap 37 says is the "
            + "hard one",
        divide: "0 occurrences of `÷`. The `/` that does occur is a fraction (claimed, as the attested "
            + "«ондон бир» construction) or a rate denominator (declined whole — see normalize.ts), never a "
            + "division between two prose operands",
        // ⚠ NOT A REFUSAL — READ IT AS ONE AND YOU WILL DELETE A WORKING RULE. `=` IS read, as postposed
        // `барабар` (×56 over 20 ky.wikipedia articles, every one this relation with the second operand in
        // the DATIVE: «суммасы нөлгө барабар», «Бир доллар жалпысынан 100 центке барабар»; espeak's
        // `= barab'ar` agrees). The rule requires a CYRILLIC OR DIGIT operand on BOTH sides, and the probe
        // `x = y` is Latin on both, so it reports DROPPED and is CORRECT to: the corpus's Latin-operand `=`
        // is a bibliographic TITLE SEPARATOR — «Модернизация и ремонт ПК = Upgrading and Repairing PCs» —
        // and reading it as an equation would be confidently wrong. 14 retained instances, ~6 of them real
        // equations, all of which the rule claims.
        equals: "READ, not refused — see the note above. Exempt because the synthetic probe's operands are "
            + "LATIN, which this layer deliberately declines (the bibliographic `ПК = Upgrading` separator), "
            + "so the probe can only ever report DROPPED",
    },
    hy: {
        // ⚠ COUNTS ARE OVER THE RETAINED TEXT OF `tools/corpus/mined/hy.jsonc` — 460 segments (260 hard +
        // 200 sample) out of a 2,517,219-paragraph hy.wikipedia dump. Every refusal is argued in
        // src/languages/armenian/normalize.ts; only these TWO are entered here, and the rest of the class
        // stays RED on purpose (the ak/gn stance).
        //
        // ⚠ `minus` IS SHIPPED, NOT EXEMPTED, and `review.ts --lang hy` still reports it because the rule
        // is DELIBERATELY NARROW. All four true negatives in the retained text are followed by a percent
        // or a degree — `-4.9 %`, `-0,018 %`, `-20 °C`, `−15 °C` — which is trap 24's Hindi discriminator,
        // and `մինուս` is attested (hy.wikipedia ×28/2, the article defining the + and − signs). Widening
        // to a bare `(^|[\s(])[-−]\d` was measured and is NET NEGATIVE here: it adds no true instance and
        // six false ones — the bibliographic separators `- 1. - Cambridge`, `. - 394 էջ`, `. - 455 էջ`,
        // the record number `- 010401006121…` and the timeline markup `shift:(-10,5)`. The probe's bare
        // `-5` has no corpus instance at all, so the red line is the guard reporting itself, not a gap.
        //
        // ⚠ `equals`, `times`, `divide`, `less-than`, `greater-than` are ALSO NOT HERE, because they are
        // real sourcing gaps rather than correct silences: `×` is contentful in four instances of
        // scientific notation (`6,022 × 10²³`, `3,086 × 10¹³`, `9,46 × 10¹²`) and no Armenian word for it
        // has been sourced with its sense read. That stays red until one is.
        plus: "×11 in the retained text and EVERY ONE IS A TEMPERATURE — `+15.2°С`, `+7 °C`, `+26-28°С`, "
            + "`+8-9 °C`, `+24-25 °C`, `+28-ից +32 °C`, `+8-ից +10 °C`, `+ 30 … + 40 °C`, "
            + "`+ 17 … + 20 °C`. There is no `UTC+N` in the corpus and no arithmetic plus; the whole class "
            + "is the measurement plus, which the playbook's own trap-48 measurement settles: omitting it "
            + "is LOSSLESS (`+30°` and `30°` are the same temperature) where omitting a minus INVERTS. "
            + "This is why hy ships the minus and not the plus, rather than treating them as a pair. "
            + "⚠ SOURCING IS NOT THE BLOCKER and that is stated so nobody re-opens it as one: `պլյուս` is "
            + "attested on hy.wikipedia in the SAME article as `մինուս` («Պլյուս» և «մինուս» նշաններ "
            + "(+ և −), մաթեմատիկական նշաններ), so the word is available and the rule shape is identical "
            + "to the minus's. It is withheld because the reading it would add is redundant, not because "
            + "it could not be written. (⚠ `գումարած` ×2 in the corpus is a DIFFERENT slot — the "
            + "two-operand arithmetic participle, `մեկին գումարած երկրորդ մեկի կեսը` — the same "
            + "part-of-speech trap as `հանած`, which is why neither is the sign's word.)",
        ampersand: "×9 in the retained text and NINE OF NINE sit inside an ENGLISH phrase: `AT&T` ×2, "
            + "`R&B` ×2, `\"Shake, Rattle & Roll\"`, `Gerry & The Pacemakers`, `Eddie & the Showmen`, "
            + "`BBC Four Film & Drama`, `A. & C. Black, Ltd., London`. Every one reaches the engine "
            + "through the registry's Latin-run router, so the reading that belongs there is ENGLISH's "
            + "`and`, not an Armenian word substituted into the middle of an English band name — and the "
            + "artifact scan reports five of them as `FOREIGN ampersand` for exactly that reason. This is "
            + "not a sourcing gap: Armenian's coordinator `և` is ubiquitous in the corpus and would be "
            + "available instantly. There is simply no Armenian `&` here to read",
    },
    mt: {
        // ⚠ EVERY COUNT IS OVER THE RETAINED TEXT OF `tools/corpus/mined/mt.jsonc` — 449 segments
        // (249 hard + 200 sample) out of a 118,526-paragraph mt.wikipedia dump — with the artifact's
        // whole-corpus `counts` quoted where they differ. There is no FLEURS corpus for Maltese, so the
        // tiers are that artifact, `mt.wikipron-mlt-broad.tsv`, espeak's `mt_list`, and `attest.ts`
        // against mt.wikipedia — WHICH IS THE SAME WIKI THE ARTIFACT WAS MINED FROM, and therefore a
        // bigger sample of one source rather than a second one. Every refusal is argued in
        // src/languages/maltese/normalize.ts.
        //
        // ⚠ THREE CLASSES ARE DELIBERATELY ABSENT FROM THIS BLOCK, AND THAT IS WHY `review.ts --lang mt`
        // STAYS RED ON THEM — the ak / ki / lg / mos stance, that a sourcing gap with a reading still to
        // find is a TODO and not an exemption:
        //   · `math-sign` (×17). `×` is ×5 in the retained text and BOTH of its senses are present — a
        //     DIMENSION (`361 cm × 520 cm (142.13 in × 204.72 in)`, a painting's measurements) and
        //     SCIENTIFIC NOTATION (`2.2 × 1012 m3`, `1.2 × 10 10 cu ft`, exponents already flattened by
        //     the source). The rule SHAPE exists — `SymbolData.multiply` takes `times` and `by` and the
        //     tier picks between them mechanically — so what is missing is a WORD. Both Maltese candidates
        //     fail: `bi` is the ordinary preposition "with/by" and is far too common for a token count to
        //     mean anything (trap 37 in its purest form), and `darbiet` ("times", the noun) is attested
        //     nowhere between two operands. Refused whole rather than half (trap 53), so the two figures
        //     stay juxtaposed exactly as they were rather than acquiring a confidently wrong connective.
        //   · `degree` (×4 residual, from ×12). `°C` and `°F` are read — the collocations `grad Celsius`
        //     ×16/13, `gradi Celsius` ×6/6, `grad Ċelsju` ×7/5 and `grad Fahrenheit` ×3/3 are attested in
        //     the numeral slot. What is left is the BARE sign, and all four are COORDINATES
        //     (`bejn il-latitudnijiet 42° u 47° N`, `f'19° 16' 50" lonġitudni`) plus one Richter magnitude
        //     (`b'intensità ta' 7.6°`). `grad` is sourced (×96/20) and still buys nothing there: a rule
        //     would cut a coordinate in half and has no minutes/seconds reading to put back. lg's position,
        //     reached independently on this corpus.
        //   · `minus` (×2 residual, from ×11). Nine of the eleven are read; the rule is narrowed by
        //     measurement to a sign whose number is followed by `°` or `%`, because the fleet's usual
        //     "sign after a space or bracket" shape produces a FALSE POSITIVE in this orthography — the
        //     definite article is written with a hyphen (`it-43.8°C`, `l-1%`, and `fl -2021` with a stray
        //     space) and 3,322 of the retained text's hyphens are that. What is knowingly left is
        //     `(Neuendorf bei Wilster) -3.54 m`, Germany's lowest point: a GENUINE negative where omitting
        //     the sign puts the place above sea level. Buying it would mean admitting a bare unit after the
        //     sign, which is one token away from `fl -2021`. Omitting a minus inverts, so this stays red.
        // ⚠ THE COUNT WAS RIGHT AND TWO OF THE CLAIMS AROUND IT WERE NOT, found by the fleet symbol audit
        // reading all twelve rather than the enumerated nine. "Every instance is a GLOSS" was false for the
        // last two, which are EasyTimeline chart markup, and "NOT ONE is arithmetic" was false for the
        // election tally, which really is an addition. The refusal survives on the corrected evidence — ten
        // of twelve are a typographic 'means' and the twelfth is markup — but it is no longer overclaimed.
        equals: "×12 in the retained text. NINE are a GLOSS inside a parenthesis — `etimoloġija ta' Bibbja "
            + "hi Griega (= kotba)`, `Technische Lehranstalt HTL = istituzzjoni ta' edukazzjoni`, `HBLA = "
            + "istituzzjoni ta' edukazzjoni`, `il-Kotba Profetiċi (ta' Kmieni = Kotba Storiċi u tat-Tard = "
            + "profeti)`, `tissostitwixxi is-suġġett (EN = dummy subject)` — or a Greek ETYMOLOGY quoted "
            + "verbatim (`astronomija (Grieg: αστρονομία = άστρον + νόμος, astronomia = astron + nomos)`). "
            + "⚠ TWO ARE EASYTIMELINE CHART DIRECTIVES the extraction did not strip (`PlotArea = left:50 "
            + "bottom:50`, `ScaleMajor = gridcolor:darkgrey increment:5000`) — not text anyone reads aloud, "
            + "and a property of the MINING PIPELINE rather than of Maltese; the same directives recur in 24 "
            + "other artifacts. ⚠ AND EXACTLY ONE IS ARITHMETIC, which this entry used to deny outright: an "
            + "election seat tally, `Siġġijiet - PN 26( +4 = 30)`. One addition inside one parenthesised "
            + "results line is not enough to source a Maltese operator word — and the same instance is the "
            + "unenumerated eleventh `+` in the `plus` entry below. For the other eleven the sign is a "
            + "typographic 'means' between a term and its explanation, not an operator between two operands, "
            + "and the sentences read correctly with it silent. This is not a sourcing gap either: the "
            + "artifact cell reports `arithmetic` ×318 whole-corpus and that figure is measuring the same "
            + "shapes",
        plus: "×10 in the retained text and, like `equals`, not one is an operator. Six are the Greek "
            + "etymology above (`άστρον + νόμος`, `astron + nomos`), three are a TELEPHONE COUNTRY CODE "
            + "(`biex iċempel lil xi ħadd barra l-Ġermanja jkollu iċempel +49 89 123456`), and one is a "
            + "sentence ABOUT the character itself (`fejn il-+ ifisser il-kodiċi internazzjonali`). The "
            + "playbook's standing finding applies with full force here: omitting a plus is LOSSLESS "
            + "(`+30°` and `30°` are the same temperature) while omitting a minus INVERTS, so silence is "
            + "the correct reading for this sign and a missing one for that sign — which is why `minus` is "
            + "absent from this block and `plus` is in it. `±`, `÷`, `<` and `>` are ×0",
    },
    ka: {
        // ⚠ EVERY COUNT IS OVER THE RETAINED TEXT OF `tools/corpus/mined/ka.jsonc` — 453 segments
        // (253 hard + 200 sample) out of a 1,025,770-paragraph ka.wikipedia dump. espeak does not ship
        // Georgian at all, so the tiers are this corpus, `ka.wikipron-kat-narrow.tsv` and `attest.ts`
        // against ka.wikipedia. The refusal is argued in src/languages/georgian/normalize.ts.
        // ⚠ `math-sign` IS DELIBERATELY ABSENT, AND THAT IS WHY `review.ts --lang ka` STAYS RED ON IT —
        // the ak / gn / ln / bm stance. `+` and `=` ARE read (პლუს, უდრის, both attested in one
        // ka.wikipedia sentence, „ორს პლუს ორი უდრის ხუთს“ (2 + 2 = 5)); what is refused is `×`, whose
        // five instances are not one class — `17×11 კმ` and `6.9X3.6 მ` are DIMENSION crosses that read
        // "by", `1 000 000 × 1 000 000 მ` is a genuine multiplication, and `1280x1024` is a screen
        // resolution inside a Latin run. One word cannot serve all four, and `გამრავლებული` ×12/12 on the
        // wiki is the ordinary participle "multiplied/propagated" (`ფოტოასლებით გამრავლებული` — copies of
        // a book), never the operator: trap 37 with a healthy count on the wrong sense. Declaring the
        // whole class silent here would also hide the two signs that ARE read, which is the wrong trade.
        ampersand: "×9 in the retained text and NOT ONE is Georgian. Every occurrence sits inside a "
            + "LATIN run that the shared unclaimed-run pass hosts out to the foreign path: `AT&T` ×2, "
            + "`Simon & Schuster`, `Vandenhoeck & Ruprecht`, `Artemis & Winkler`, `.40 S&W`, "
            + "`& Iankoshvili` (a citation author list), plus `&nbsp;` entity residue that `stripMarkup` "
            + "decodes above this layer. Georgian prose writes its coordinator და as a word and does not "
            + "use the character — so this is not a sourcing gap (და is in georgian.jsonc's number "
            + "composer already) but a SENSE refusal: reading `&` as და inside `Simon & Schuster` would "
            + "put a Georgian conjunction into an English publisher's name. There is no Georgian `&` to read",
    },
};

/**
 * SISTER STANDARDS — codes that are the same language under different standardisation, so one's artifact,
 * corpus and referee are evidence for another's.
 *
 * ⚠ ONE COPY ONLY. Two tools holding their own sister sets will answer the same question differently: a code
 * present in one and absent from the other is reported as artifact-covered by one tool and sent looking for a
 * file that does not exist by the other.
 */
export const SISTER_STANDARDS: readonly (readonly string[])[] = [
    ["hr", "sr", "bs"],      // Serbo-Croatian: three standards, one language
    ["id", "zsm", "ms"],     // Malay: Indonesian and Malaysian
    ["nb", "nn", "no"],      // Norwegian: Bokmål and Nynorsk
    ["es", "es-419"],        // Latin American Spanish shares the Spanish wiki, and so its artifact
];

/** The other codes in `code`'s sister set, or none. */
export function sistersOf(code: string): readonly string[] {
    return SISTER_STANDARDS.find((set) => set.includes(code))?.filter((c) => c !== code) ?? [];
}

/**
 * THE SIGN-CLASS PROBES — one synthetic input per droppable sign, and the pattern that removes it. A sign is
 * DROPPED when the reading of the probe equals the reading of the probe with the sign stripped out.
 *
 * ⚠ SHARED, BECAUSE A HAND-KEPT LIST IN ONE TOOL IS A LIST THAT DRIFTS. Held inside a CLI script this table
 * cannot be imported, so a fleet sweep cannot use the same probes a per-language review uses — and this very
 * list was once missing `÷ > ±`, the exponent and the currency sign, with nothing to say so.
 *
 * ⚠ IT CANNOT BE DERIVED FROM `DROPPABLE`. A defect regex is not a probe string, and one class needs several
 * probes — `math-sign` alone covers `+ ± = < > × ÷`. Callers should ASSERT the mapping between the two rather
 * than trusting it, which turns the next omission into a loud failure.
 */
export const SIGN_CASES: readonly (readonly [string, string, RegExp])[] = [
    ["minus", "-5", /[-−]/gu],
    ["plus", "+5", /\+/gu],
    ["plus-minus", "±5", /±/gu],
    ["ampersand", "A & B", /&/gu],
    ["equals", "x = y", /=/gu],
    ["less-than", "5 < 6", /</gu],
    ["greater-than", "6 > 5", />/gu],
    ["times", "6 × 6", /×/gu],
    ["divide", "6 ÷ 3", /÷/gu],
    ["exponent", "5 km²", /²/gu],
    ["currency", "$5", /\$/gu],
    ["percent", "25 %", /%/gu],
    ["degrees", "20 °C", /°/gu],
];

/**
 * DESIGNATIONS ACCEPTED AS CORRECTLY SILENT — the sweep's permanent residual, named per instance.
 *
 * ⚠ WHY A BASELINE AND NOT A GUARD: widening the `minus` regex to swallow these would blind the class to
 * every true negative of the same shape (see its note above).
 *
 * So these are accepted BY IDENTITY instead. Each entry is the literal string as it appears in the corpus,
 * and a hit is accepted only when EVERY occurrence of the symbol in that sentence falls inside one of them.
 * Two properties follow, and both are the point:
 *   · a NEW designation, or the same one in a new language, still reports — nothing is suppressed by shape
 *   · a sentence carrying a listed designation AND a real negative still reports, because the negative's
 *     match does not lie inside a named span
 *
 * ⚠ WHAT IS BEING ASSERTED is not that the drop is harmless — that the reading is already CORRECT. These are
 * product names and bill numbers whose hyphen is silent in speech, so a silent hyphen is the right output and
 * the differential test is reporting a true fact with a false label.
 *
 * ⚠ THIS LIST IS EVIDENCE, NOT A TODO. Do not "fix" an entry by making its hyphen audible.
 */
export const ACCEPTED_SILENT: Readonly<Record<string, Readonly<Record<string, readonly string[]>>>> = {
    chr: {
        // ⚠ TWO INSTANCES THE CLASS-LEVEL REFUSAL CANNOT REACH, and each fails `acceptedSignClass` for its
        // own mechanical reason rather than because the refusal is weak — the arguments and their counts are
        // in `ACCEPTED_SIGN_SILENCE` above.
        //   · the CURRENCY sign is `¥`, and `SIGN_CASES`'s currency probe is keyed on `$`, so the class
        //     test never sees a currency in this line at all;
        //   · the MINUS pattern requires a digit AFTER the sign, which a single bare `-` handed to
        //     `covered.test(ch)` can never satisfy, so the class test finds nothing relevant either.
        //
        // ⚠ WHAT IS ASSERTED IS THAT THE READING IS ALREADY CORRECT, not merely that the drop is harmless.
        // The yen line is trap 12 in its purest form: `ᎤᎾᏤᎵ ᎠᏕᎳ
        // ᏣᏆᏂ ᎠᏕᎳ (¥)` reads *unat͡seli atela t͡sakʷani
        // atela* — ‘their money, Japan money’ — so the currency is NAMED, twice, by the
        // writer's own words, and a third naming from the sign would be the defect. The reign span's hyphen
        // is a designation joining a KNOWN death year to an UNKNOWN birth year typed as four question marks;
        // there is no negative number anywhere in this corpus.
        currency: ["ᏣᏆᏂ ᎠᏕᎳ (¥)"],
        minus: ["ᎳᏂᎦᏇ (????-844)"],
    },
    mos: {
        // ⚠ TWO OF THE THREE, AND THE THIRD IS THE WHOLE REASON THIS IS AN INSTANCE LIST AND NOT A CLASS
        // ENTRY. The Mooré artifact has exactly three matches of the `minus` shape. Two are RANGES written
        // with a DOUBLE ASCII HYPHEN — a wiki `--` convention that survived extraction, so the regex's
        // digit lookbehind rejects the first hyphen and matches the second — and mos declines the range
        // class outright (no Mooré connective between two figures is attested, so the pair reads as two
        // bare cardinals, the Swahili/Lingala state). A silent hyphen is the correct output for both.
        // The THIRD is a genuine negative temperature written with U+2212, `n yɩɩg −1 °C la 2 °C`, and it
        // is deliberately NOT listed: omitting a plus is lossless and omitting a minus INVERTS, so
        // `review.ts --lang mos` stays red on this class and `minus` is absent from ACCEPTED_SIGN_SILENCE.
        minus: ["A.D. 800--1532", "yaa 20--40 km"],
        // SUPERSCRIPTS THAT ARE NOT EXPONENTS — Jyutping and Pinyin TONE NUMBERS, in the Cantonese-opera
        // article. ⟨cing⁴ sik¹ sing³⟩ is a romanisation with tone digits raised; reading them as powers
        // would be nonsense, so silence is correct here rather than merely harmless. ⚠ THE ARTIFACT'S ONE
        // GENUINE `km²` (`hɛktaar 350 mamsgo (akre 860; km² 3.5)`) IS DELIBERATELY NOT LISTED, so the
        // exponent class stays red on the real gap — no Mooré squared word is attested (trap 51's floor:
        // `attest.ts --after` on the metre nouns returns nothing, because a small wiki does not discuss
        // area). Listing the tone numbers is what makes that one instance visible instead of buried in ×9.
        exponent: [
            "cing⁴ sik¹ sing³", "heoi¹ ji⁵ sing³", "sin¹ ming⁴ sing³",
            "zung³ hap⁶ ngai⁶ seot⁶ jing⁴ sik¹", "sei³ gung¹ ng⁵ faat³",
            "Siu² Sang¹", "Siu² Mou⁵ Sang¹",
        ],
    },
    ak: {
        // A REDUNDANT PERCENT SIGN, WHICH THIS CORPUS WRITES CONSTANTLY — and the six below are where the
        // scan's own REDUNDANT test cannot see it. Akan reads `%` as `ɔha mu nkyekyɛmu` (PREPOSED, ×1,387
        // tw + 215 fat) and akan/normalize.ts step 5 suppresses the word when the sentence has ALREADY
        // written it, which is 893 of the 5,154 percent signs across the two wikis: the writer spells the
        // figure out in words and then repeats it in digits — "ɔha mu nkyekyemu eduokron (90%)". Saying it
        // once is the correct reading (trap 12), and the correct reading is byte-identical with the sign
        // deleted, so the differential test reports a drop and is right to.
        // ⚠ WHY THESE SIX AND NOT THE OTHER FIVE. `isRedundant` looks for the symbol's own contribution
        // tokens in the reading, and it FINDS them for the five sentences that spell the word the way the
        // rule does. These six use the corpus's ⟨e⟩ variants — `nkyekyem`, `nkyekyemu` — which phonemize to
        // ŋt͡ɕɪt͡ɕem(u) rather than ŋt͡ɕɪt͡ɕɛmu, so the token test misses a word that is plainly there. That is a
        // limitation of the probe, not a defect in the reading.
        // ⚠ Listed with the WORD in the span rather than as a bare `90%`, so a genuinely dropped `2%`
        // somewhere else in this language still reports. A bare figure would launder it.
        percent: ["ɔha mu nkyekyemu mmienu (2%", "ɔha mu nkyekyemu eduonu (50%", "ɔha mu nkyekyemu eduokron (90%",
            "ɔha mu nkyekyem eduasa-mmienu (32%", "ɔha mu nkyekyem eduosia-nsia(66%", "ɔha mu nkyekyemu eduonum-nson(57%"],
    },
    cdo: {
        // ⚠ cdo IS THE SEVENTH SINITIC CORPUS TO PRODUCE THE ROMANIZATION-TONE HAZARD, which closes the
        // prediction this file has been carrying since cjy ("Expect it in gan/hak/hsn too") for the whole
        // family. And cdo produces it from THREE romanizations at once, because cdo.wikipedia glosses other
        // varieties inline: Cantonese jyutping (`hoeng¹ gong²`), Min Nan Pe̍h-ōe-jī with Chao digits
        // (`Choân-chiu-oē /t͡suan²⁴⁻²² t͡siu³³ ue⁴¹/`) and its own Fuzhou IPA (`/y⁵³ y³⁵ touŋ³³/`,
        // `/touŋ⁵⁵ touŋ²¹³ t͡sʰiɑ²⁴²/`). Reading a bare superscript as a power would turn the engine's own
        // source notation into arithmetic, which is why `bareExponent` is undeclared. A squared/cubed UNIT
        // is still read — `84 km²` → 84 bìng-huŏng gŭng-lī — and listing these BY INSTANCE rather than
        // silencing the class is what keeps a genuine km² regression visible.
        // The genuine exponents left are ones no layer reads: a physics constant's mantissa and its
        // dimensional formula (`6.67 × 10 −11 N m² kg⁻²` — the negative exponent sits on a unit this layer
        // does not declare), a cube on a RATE denominator inside a quoted Han paragraph (`1,980 m³/s`), and
        // a footnote marker (`ou³ mun 4*2`, a Cantonese tone-change notation).
        exponent: ["hoeng¹", "gong²", "t͡suan²⁴⁻²²", "t͡siu³³", "ue⁴¹", "y⁵³", "y³⁵", "touŋ³³",
            "touŋ⁵⁵", "touŋ²¹³", "t͡sʰiɑ²⁴²", "kg⁻²", "N m²", "m³/s", "ou³ mun"],
        // NOT ARITHMETIC, ANY OF IT — the class refusals and their evidence are in ACCEPTED_SIGN_SILENCE;
        // these spans exist because `acceptedSignClass` tests a sign regex against a SINGLE character while
        // the minus pattern is CONTEXTUAL, the limitation gan, nan, hak, tl and wuu all record.
        // The set: scientific notation, LaTeX bodies (conic sections and an ISBN check-digit worked example),
        // the GDP identity, chemistry, a number-theory example, the Fuzhou sound-change arrows, a bibliographic
        // gloss, a Visual Basic snippet, `C++`/`C#`, a track relay leg, and an article about the plus sign.
        "math-sign": ["9.10938356(11)×10", "1.672621898(21)×10", "6.67 × 10", "5×10 30", "4×100 mī",
            "cṳā > cāi", "hṳa > hie", "hṳa > ha̤", "(CD + VCD)", "C++", "C#",
            "y^2=-2px", "x^2=-2py", "p>0", "100 = 23 + 7 · 11",
            "(GDP) = Sṳ̆-ìng siĕu-hié (C)", "(I) + Céng-hū", "(G)+ Chók-kāu (X)", "F = ma",
            "Sák-gā-lé-ā Cṳ̆ = 撒賈利亞書", "\\times10+", "\\times9+", "\\times8+", "\\times7+", "\\times6+",
            "\\times5+", "\\times4+", "\\times3+", "\\times2=226", "isbn = InputBox",
            "Users'Manual = [國際標準書號使用者手冊]", "2NaCl + H_2SO_4", "Na_2SO_4 + 2HCl",
            "hù-hô̤ sê „+“"],
        // ⚠ NOT NEGATIVES. `(3%-4%)` and `(1%-2%)` are PERCENT RANGES, which normalize.ts step 4 now reads
        // whole (`báh-hŭng-cĭ 3 gáu 4`) — they are listed because the scan's minus probe sees the dash
        // before the layer's rule has consumed it. `−2` is the exponent of an acceleration's dimensional
        // formula. The two genuine temperature negatives are NOT here: they are the class refusal above,
        // and they must keep reporting until a cdo minus word is sourced.
        minus: ["(3%-4%)", "(1%-2%)", "bìng-huŏng miēu (m·s −2"],
        // THE AMPERSAND, EVERY SURVIVING INSTANCE — all six inside Latin proper names. The class-level
        // refusal and the gan comparison are in ACCEPTED_SIGN_SILENCE; these spans exist so that an `&`
        // appearing between two BUC words would still report, which is the case that would reverse it.
        ampersand: ["AT&T", "Fuchs & Chafetz", "Thames & Hudson", "Gáu-tuàng & THE"],
    },
    ceb: {
        // THE YEN, and it is the ONE currency in this corpus with no Cebuano name. The dollar (`dolyar` ×4),
        // the euro (×1) and the pound (`pound` ×3, in `Falkland pound (FKP)`) are all declared and read; `yen`
        // scores ZERO, so the three ¥ amounts in this one sentence about Japanese event tickets stay unread.
        // ⚠ Listed BY INSTANCE rather than silencing the class, so the moment a ¥ appears beside a Cebuano
        // yen-word — or any other currency regresses — the scan reports it again.
        currency: ["¥2,500", "¥130,000", "¥7,000"],
    },
    mg: {
        // ⚠ PER MILLE, NOT PER CENT. `‰` is in the percent DROPPABLE class, and these two are infant- and
        // general-mortality rates (`42,50 ‰`, `64 ‰`) in one paragraph. Malagasy reads `%` as `isan-jato`
        // ("per hundred") and the parallel `isan-arivo` is attested in NEITHER haystack, so the thousand
        // sign stays unread rather than guessed — the per-hundred word would be actively wrong.
        // ⚠ The spans carry `&nbsp;` because the corpus does: `42,50&nbsp;‰`. A span written with an
        // ordinary space matches nothing, which is silent — the entry simply fails to accept.
        percent: ["42,50&nbsp;‰", "64&nbsp;‰"],
        // FOUR SHAPES THE UNIT PATH CANNOT REACH, none of them a missing word. Three are a square or cube
        // inside a RATE (`30 mp/km²`, `8,5 mp/ km²`, `3 mp/ km²` — population per km²; `1,429 kg/m³`),
        // where the numerator is an undeclared noun and no Malagasy "per" is attested in the slot; and two
        // are FORMULAE, where the base is a variable rather than a unit — `C 12 H 22 O¹¹` (sucrose) and
        // `χ²` (the chi-squared test). `bareExponent` is undeclared for this language for that reason.
        // ⚠ The ordinary unit exponents ARE read (`km²` → kilaometatra toradroa, `km³` → …toratelo), which
        // is what keeps this list honest.
        exponent: ["mp/km²", "mp/ km²", "kg/m³", "O¹¹", "χ²"],
        // TWO CURRENCIES THE TIER CORRECTLY DECLINES. `R$ 9.195.871,95` is the Brazilian real, which has no
        // Malagasy name in either haystack; `$30 tapitrisa dolara` writes the sign AND the word, so the
        // reading already says *dolara* and dropping the sign is trap 12's permissible drop — the same
        // sentence is reported as REDUNDANT for its other instance.
        currency: ["R$ 9.195.871,95", "$30 tapitrisa dolara"],
        // THE FRENCH NUMERO SIGN, not a degree — `"Loi-n°-2023-007-Code-minier"`, a statute cited in a
        // reference. The degree rule requires a DIGIT before the sign precisely so that `n°` cannot match.
        // TWO SIGNS THAT ARE NOT DEGREES. `"Loi-n°-2023-007-Code-minier"` is the French NUMERO sign in a
        // statute citation — the degree rule requires a DIGIT before the sign precisely so `n°` cannot
        // match. `taonjato faha 17°` is "the 17TH century": ⟨faha-⟩ is the Malagasy ordinal prefix and the
        // writer has used `°` as a raised ordinal marker. ⚠ It is U+00B0, the real degree sign — U+00BA,
        // the masculine ordinal indicator, is ×0 here — so no character test separates them and the
        // preceding `faha` is the guard.
        degree: ["Loi-n°-2023-007", "faha 17°"],
        // ⚠ THE MINUS INSTANCES, LISTED BESIDE THE CLASS REFUSAL rather than instead of it — because
        // `acceptedSignClass` cannot accept this class at all. Its test asks whether the DROPPABLE regex
        // matches a single character, and the minus regex is CONTEXTUAL (`[-−–](?=\p{Nd})` with two
        // lookbehinds), so it can never match one. `tl` carries the same pair for the same reason, and for
        // the same BCE-year shape.
        //
        // Three families, none of them arithmetic:
        //   · BCE YEARS from the ancient-biography stub — `-596 ary maty`, `-546`, `-258`, `-209`,
        //     `-3 000 taona`. "Born 1 January -596" means 596 BC.
        //   · NEGATIVE COORDINATES from the commune stubs — `-97.0602777778`, `-83.6138888889`, `-0.6408°`.
        //   · EasyTimeline CHART MARKUP that survived into the artifact — `from:-5000 till:-3000`,
        //     `-30 align:center`, `-3200 align:right`. Axis origins and label offsets, i.e. code.
        minus: ["-209", "-258", "-546", "-596", "-3 000", "-3 800",
            "-0.6408", "-1.1956", "-119.3425", "-122.09", "-76.71", "-78.70", "-83.61", "-86.17",
            "-97.06", "-97.785", "-99.47",
            "-2000", "-30 ", "-3000", "-3200", "-5000", "-2023"],
    },
    lo: {
        // THREE SUPERSCRIPTS WITH NOTHING THE TIER CAN ATTACH THEM TO. `i ² = −1` and `10¹⁰⁰` (a googol,
        // in the article that names it) are BARE exponents — the base is a variable or a mantissa — and
        // `bareExponent` is undeclared for this language because no Lao power phrase is attested.
        // `10.000ກມ²` is the UNIT exponent written with the LAO abbreviation ⟨ກມ⟩ rather than `km`, and
        // ⚠ that abbreviation is deliberately NOT a declared key: Lao is unspaced, and a digit-adjacent
        // Lao ⟨ມ⟩ is ×35 in the mined segments with **every single one a MONTH NAME** (`19 ມີນາ`,
        // `5 ມິຖຸນາ`, `1 ມັງກອນ`). A one-letter unit key in an unspaced script is trap 27 and trap 46 at
        // once, and the price of refusing it is this one instance.
        exponent: ["i ² = −1", "10¹⁰⁰", "10.000ກມ²"],
        // ⚠ A PERMISSIBLE DROP THE DIFFERENTIAL TEST CANNOT SEE — trap 12, and this layer CREATED it on
        // purpose. The sentence already writes the percent word before its figure (`ຈະໄດ້ເປີເຊັນ 10%`,
        // "the winner gets 10 percent"), so normalize.ts spends the sign rather than letting the tier add
        // `ຮ້ອຍລະ` on top and say percent twice. The reading is then byte-identical with and without the
        // `%`, which is exactly the shape the drop test cannot distinguish from a real loss — and the
        // second question it asks (is the symbol's own word in the reading?) does not help either, because
        // the word that is present is the LOAN `ເປີເຊັນ` and only the native `ຮ້ອຍລະ` is declared.
        percent: ["ເປີເຊັນ 10%"],
    },
    kmr: {
        // ⚠ kmr DOES read the minus — inside its DEGREE rule, which is where the sign is unambiguous.
        // Measured over the mined segments, a dash before a digit not itself preceded by a digit occurs ~22
        // times and **all ten genuine negatives are temperatures** (`-24,2 °C`, `-52,6℃`, `-24 û -30
        // pileyan`). These are the residue, and not one of them is a number's sign: a book TITLE
        // (`Komkujiya Ermenîyan -1915`), a COORDINATE span whose first operand the degree rule has already
        // spent (`42°-20´`), and EasyTimeline chart MARKUP — `start:-1500`/`start:-1250` are axis origins
        // and `shift:(-10,5)`/`shift:(-5,5)` are label offsets in pixels, i.e. code rather than prose.
        minus: ["Ermenîyan -1915", "42°-20´", "start:-1500", "start:-1250", "shift:(-10,5)", "shift:(-5,5)"],
        // THE TWO CURRENCIES WITH NO KURMANJI NAME, plus one sign the tier cannot reach. `¥` and `£` occur
        // in Chinese- and UK-education figures; neither has a Kurmanji word in the corpus or on
        // ku.wikipedia, and naming one would be the Fula `tere` failure. The dollar, by contrast, IS
        // declared and read (`dolar`, corpus-attested as `50 bilyon dolaran`). `1,5 mîlyar $` is the third:
        // a sign POSTPOSED after a magnitude word, where no digit is adjacent for the tier to match on —
        // and the same sentence's `Sequoia $ 50 mîlyon dolar` already says `dolar` in full.
        currency: ["20,023 ¥", "3.204 ¥", "230.000 £", "3.121 £", "mîlyar $", "Sequoia $ 50"],
        // TWO SUPERSCRIPTS WITH NOTHING TO ATTACH TO. `E=mc²` is Einstein's, where the base is a VARIABLE
        // and `bareExponent` is undeclared for this language (no Kurmanji power phrase is attested).
        // `qebareya kupê (m³)` is the corpus writing the CUBE WORD and the symbol side by side — the
        // reading already says *kupê*, so the symbol is a gloss and dropping it is trap 12's permissible
        // drop; the differential test cannot see that, because the correct reading is byte-identical.
        exponent: ["E=mc²", "kupê (m³)"],
    },
    si: {
        // RANGES AND DATE/DESIGNATION DASHES, none of them a negative — and si/normalize.ts reads the
        // negative sign as U+2212 ONLY, on the measurement that U+2212 is ×5 in this corpus and all five are
        // temperatures, while an ASCII hyphen before a digit is ×9 and none of the nine is. These are six of
        // that nine: three coordinate/temperature RANGES (the layer declines ranges outright — Sinhala
        // writes its own connective, `අතර`, and two of these carry it), an ordinal with a leading dash, and
        // two years. Listed per instance rather than widened into the guard, so a real negative written with
        // a hyphen would still report.
        minus: ["20°-30°", "29°-39°", "60°-75°", "සමරසේකර -12", "Nations -1967", "උපත -1918"],
        // TWO SUPERSCRIPTS WITH NO UNIT TO ATTACH TO. `mg• L⁻¹` is a reciprocal-litre exponent whose unit
        // (`mg`) this language deliberately does not declare — see si/normalize.ts, where all nine `mg` are
        // inside a rate with no sourced denominator — and `ටොන් 10¹⁵` is scientific notation, which no
        // language in this tree reads. `bareExponent` is undeclared for si for that reason; the UNIT
        // exponent (`km²` → වර්ග කිලෝමීටර්) is read and is what keeps this list honest.
        exponent: ["mg• L⁻¹", "10¹⁵"],
        // TWO CURRENCIES WITH NO SINHALA NAME AND ONE LETTER-PREFIXED CODE. `GH¢` (Ghanaian cedi) and `CN¥`
        // (yuan) sit in one sentence about African stock exchanges; neither `සෙඩි` nor `යුවාන්` is attested
        // in the corpus or on si.wikipedia, and naming one would be the Fula `tere` failure. `PPP$22,480`
        // is purchasing-power parity — the `$` there is part of a notation, not a price, and the tier's
        // letter-bounded key correctly refuses it. The dollar, euro, pound and rupee ARE all declared and
        // read, which is what makes these three visible rather than hidden.
        currency: ["GH¢", "CN¥180.4", "PPP$22,480"],
        // ⚠ A MANUFACTURED PERCENT SIGN — the corpus's own corruption, not a defect this layer can repair.
        // One article has lost its rakaransaya conjunct `්‍ර` and a `%` has been substituted for it, so
        // `ප්‍රතිපත්ති` is written `ප%තිපත්ති`, `සංග්‍රහයක` `සංග%හයක`, and `ක්‍රි.පූ` `කs%.පූ`. Every `%` in
        // the line is inside a WORD with no digit anywhere near it. Reading them would insert *සියයට* into
        // five Sinhala nouns; the percent rule requires a digit and correctly declines. Same class as the
        // mojibake that manufactures a degree sign in `Ä°zmir` (playbook: repair before you measure).
        percent: ["කs%.පූ", "ප%තිපත්ති", "ප%රාතාසා", "ප%කාශයට", "සංග%හයක"],
    },
    so: {
        // A `+` JOINING TWO GREEK ETYMOLOGY GLOSSES, not arithmetic — `"waan gubaa" + ōps "wejiga"`, inside the
        // article on the name Αἰθιοπία. so/normalize.ts reads `+` before a digit or a bracketed one; this one
        // has quoted words on both sides, and voicing it would read a word-formation gloss as a sum.
        "math-sign": ['"waan gubaa" + ōps'],
        // TWO SUPERSCRIPTS WITH NO NUMBER TO ATTACH TO. `cm³` follows the WORD `cubo` — the article writes the
        // Somali reading and the abbreviation side by side (`11.548 Sentimitir cubo cm³`), so the cube is
        // already spoken and the symbol is a gloss. `E = mc²` is Einstein's, where the base is a VARIABLE; the
        // `=` IS read (`u dhiganta`), and `bareExponent` is not declared for this language because its
        // superscripts are overwhelmingly units (km² ×93, m³ ×37) which the unit path already handles.
        exponent: ["cubo cm³", "E = mc²"],
    },
    su: {
        // ⚠ ALGEBRAIC SUBTRACTION WITH A VARIABLE OPERAND. su/normalize.ts reads the minus before a DIGIT
        // (`-1,00`, `antara -100`, `(−3)`); these are `1 - p` and `1 − p` inside a standard-deviation
        // formula, where the operand is a letter. Reading them would mean matching a dash between two
        // variables, which is the same shape as a compound hyphen in an ordinary Sundanese word — the
        // language hyphenates reduplication constantly (`kira-kira`, `béda-béda`, `rata-rata`, ×thousands).
        // The formula is niche; the hyphen is not. Left silent deliberately.
        // Three lines, none of them arithmetic: `(H^+)` is an ION CHARGE, `L(+)-asam` is an optical-isomer
        // label, and `aX + b ~ N(aμ + b, (aσ)²)` is algebra over VARIABLES — su/normalize.ts reads `+` only
        // before a digit or a bracketed one. Widening it to letters would match a dash between two variables,
        // the same shape as the reduplication hyphen Sundanese writes constantly (`kira-kira`, `béda-béda`).
        "math-sign": ["(H^+)", "L(+)-asam", "aX + b ~ N(aμ + b, (aσ)²)", "X+b", "σ = (n p (1 - p))",
            "σ = (p(1 − p)/n)", "1.5log((r+ra)/g)+.45", "((r+ra)/g)^.287", "A/(A+B)"],
        // THE SOURCE'S OWN TYPO, twice: `$28.ooUS` and `$60.ooUS` are `.00` mistyped with letter o's, so the
        // amount is `28.oo` and no rule can make a number of it. The `$` IS read (*dua puluh dalapan dolar*);
        // what the scan sees is the trailing `US` fragment. Not repairable from this side.
        // LaTeX MATH DELIMITERS, not money — `($10^7$ nepi ka $10^{12}$)`, `($10^{13}$–$10^{14}$ taun)`.
        // su/normalize.ts step 0 strips the pair so the exponent can be read; the scan then sees a `$` whose
        // removal changes nothing, which is exactly right and exactly what it cannot tell from a real drop.
        // ⚠ `$28.ooUS` / `$60.ooUS` are the SOURCE'S OWN TYPO (`.00` mistyped with letter o's). The `$` IS
        // read there (*dua puluh dalapan dolar*); the fragment the scan sees is the trailing `US`.
        currency: ["$10^7$", "$10^{12}$", "$10^{13}$", "$10^{14}$", "$28.ooUS", "$60.ooUS"],
        // AN IUPAC CHEMICAL NAME — `2-(Buta-1,3-diynyl)-5-(but-3-en-1-ynyl)`. Every dash is a locant
        // separator, none is a minus. The Burmese precedent exactly (playbook 5d): the flag needed the
        // instances read, not a rule.
        minus: ["2-(Buta-1,3-diynyl)-5-(but-3-en-1-ynyl)", "-5-(4-c", "-ynyl)-2,2'-b"],
        // ⚠ A JAPANESE ITERATION MARK QUOTED IN A SUNDANESE ARTICLE ABOUT JAPANESE WRITING — `Misuzu (みすゞ)`.
        // The article is ABOUT the mark, so the one instance is a mention rather than a use, and Sundanese has
        // no iteration mark of its own to read it with.
        iteration: ["みすゞ"],
    },
    tl: {
        // ⟨EU$8.86 bilyon⟩ — a NONSTANDARD currency marker: the sentence is about EU aid, so reading the $
        // as ⟨dolyar⟩ would assert dollars for what the context says are EU funds, and rewriting it as euro
        // would be inventing what the writer meant. The bare-$ rule cannot reach it anyway (letter-bounded
        // key), so the silence is the correct reading of an ambiguous token, not a gap.
        currency: ["EU$8.86"],
        // The Japanese ideographic iteration mark inside JAPANESE NAMES quoted in a sentence about katakana
        // (佐々木, 奈々子). The names are Japanese, read as names; the foreign-span filter cannot always see
        // it because the surrounding gloss is Latin.
        iteration: ["々", "ゝ", "ゞ"], // 々 in quoted Japanese names; ゝ/ゞ MENTIONED as signs in the same orthography article
        // PREHISTORIC-YEAR notation — the leading dash is a BCE convention, not arithmetic (the class refusal
        // with its measurement is in ACCEPTED_SIGN_SILENCE; these instance spans exist because the scan's
        // class-acceptance test cannot match a CONTEXTUAL sign regex against single characters).
        minus: ["-73 000", "-60 000", "-70 000", "-50 000", "-52 000", "-108 000", "-39 000", "-38 000",
            "-10 000", "-4000", "-8000", "-9000", "-1 BCE",
            // EasyTimeline MARKUP that survived into the artifact ("bar:1991 at:626 fontsize:XS text: 626
            // shift:(-8,5)") — code coordinates, not prose; the km %lf shape.
            "shift:(-8,5)"],
        // BARE POWERS OF TEN in physics copy — scientific notation (`6.022 × 10²³`, `9.11 × 10⁻³¹`) and an
        // electron configuration (`5s² 4d¹⁰`), the same encyclopedia-copy register as the accepted ×
        // refusal; this layer reads UNIT exponents (km² → kuwadrado) and no language reads mantissa
        // notation. Instance-listed rather than class-silenced so a km² regression stays visible.
        exponent: ["10⁵", "10²¹", "10²²", "10²³", "10⁵⁰", "10⁻⁴", "10⁻¹⁵", "10⁻²⁷", "10⁻³¹", "5s² 4d¹⁰", "mc²"],
    },
    km: {
        // A C FORMAT SPECIFIER, not a percentage — the km wiki carries a programming tutorial whose code
        // survives into the corpus (`scanf("%lf %lf",&a, &b); /*Khmer comment*/`), and the cell selector
        // reaches for it because `%` next to letters is exactly what the percent cell looks for. The `%` in
        // `%lf` is a conversion flag, so silence is the CORRECT reading and a rule that voiced it would be a
        // defect. The line survives the native-script filter legitimately: its trailing comment really is
        // Khmer.
        percent: ["%lf"],
        // ⚠ STRIPPED-MARKUP DEBRIS, not operators — the reading is correct BECAUSE these are not signs at
        // all. A `<` immediately after the Khmer full stop ៕, a `>` standing before a Greek gloss, and a lone
        // `÷` after ។ are all what a removed tag or a mis-rendered entity leaves behind.
        // ⚠ AND THE PROPER FIX IS UPSTREAM, NOT HERE. `wikidump-to-text.py`/`filter-markup.py` own the
        // residue guards, and a bare angle bracket adjacent to sentence punctuation is exactly the shape they
        // exist to catch. Listed here so the gate reads true today, with the cleaning gap recorded rather
        // than papered over — re-mining km after extending those guards should let these entries be deleted.
        "math-sign": ["៕<", "ឈោ្មះ >", "។ ÷"],
    },
    // DESIGNATIONS — a product name or bill number whose hyphen is silent in speech. FLEURS translates ONE
    // English set, so these recur across the fleet; the languages listed here are simply the ones that write
    // a SPACE before the hyphen. Every other language writes it closed and the
    // `(?<![\p{L}\p{M}\p{Nd}])` guard already handles it.
    cjy: {
        // ⚠ A SUPERSCRIPT IN A JIN ARTICLE IS A ROMANIZATION TONE NUMBER, NOT A POWER — the incubator writes
        // Jin romanized with them: `Hai²-di²-lau¹ si³ Zung¹-gueh⁴ dieh⁴ hue²-gue¹-tsi² ing²-seh⁵ gung¹-si¹`.
        // ⚠ THIS IS THE THIRD SINITIC CORPUS TO PRODUCE THAT HAZARD FROM A DIFFERENT SOURCE: wuu from Chao
        // tone letters in its own phonology sections, nan from jyutping quoted in a Hong Kong article, and
        // now cjy from its own romanization. Worth expecting in gan/hak/hsn when they are treated.
        exponent: ["Hai²", "di²", "lau¹", "si³", "Zung¹", "gueh⁴", "dieh⁴", "hue²", "gue¹", "tsi²",
            "ing²", "seh⁵", "gung¹", "si¹"],
    },
    nan: {
        // FOREIGN ITERATION MARKS inside QUOTED JAPANESE AND THAI, which Min Nan does not use: the Japanese
        // 々 in names (`千々岩 助太郎`, `佐々木舜一`, `天々座理世`, `東方妖々夢`), the hiragana ゝ in a book
        // title (`Kokoro (こゝろ)`), and Thai's ๆ in a passage ABOUT Thai text (`และอื่นๆ`). Reading them
        // would need the quoted language's rule, not this one's.
        iteration: ["々", "ゝ", "ๆ"],
        // EASYTIMELINE TEMPLATE CODE that survived into the corpus — a chart definition, not prose:
        // `ScaleMajor = unit:year increment:20 start:01/01/1800`, `from: 25/10/1945 till: $now text:"…"`.
        // The `$` there is a template variable and the `=` a parameter assignment.
        "math-sign": ["ScaleMajor =", "ScaleMinor =", "increment:20"],
        // `km²` after a POJ magnitude word joined by a HYPHEN — `5-ek 1000-ban km²`. The shared tier's
        // magnitude hop is declared and handles the SPACED form (`1.797 ek km²` reads), but its `magAlt` is
        // whitespace and POJ also hyphenates. Widening that is a fleet change with its own measurement.
        // ⚠ A SUPERSCRIPT IN A nan ARTICLE IS OFTEN A ROMANIZATION TONE NUMBER, NOT A POWER — the same
        // hazard the Wu layer records, here with JYUTPING quoted in a Hong Kong article:
        // `hoeng¹ gong² dak⁶ bit⁶ hang⁴ zing³ keoi¹`. Plus scientific notation (`1.6749 × 10⁻²⁷ kg`) and a
        // physics unit (`39.573 MeV/c²`), neither of which this layer reads for any language.
        exponent: ["1000-ban km²", "5-ek", "chhù-goân-", "hoeng¹", "gong²", "dak⁶", "bit⁶", "hang⁴",
            "zing³", "keoi¹", "10⁻²⁷", "MeV/c²"],
        // The genuine negatives and the POJ compounds, listed by span because `acceptedSignClass` tests a
        // sign regex against a SINGLE CHARACTER and the minus pattern is contextual — the same limitation
        // tl and wuu record. `-2°C` and `(−10 m/s)` are real negatives with no Min Nan word to read them;
        // the rest are POJ's word-internal hyphen and the ISO/ISBN designation blocks.
        minus: ["-2°C", "−10 m/s", "Ko·-1-kái", "--1-piàn", "ko͘-1-ê", "bó͘-1-ê", ", -1633", ", -1636",
            "8859-1", "8859-2", "8859-3", "8859-4", "8859-5", "8859-6", "8859-7", "8859-8", "8859-9",
            "8859-10", "8859-11", "8859-13", "8859-14", "8859-15", "8859-16", "957-2053-07-8", "313-332",
            "2^7-1", "1700-1400", "36-45", "1837-1898", "85%–90%",
            // POJ's `ko·-1-` compounds (the middle-dot spelling of ko͘), and EasyTimeline chart offsets.
            "ko·-1-", "shift:(-40,0)"],
        // ¢ and ¥/€/£ — no Min Nan currency NAME occurs in the corpus (⟨箍⟩ is the unit word), so they are
        // left unread rather than guessed. `$` IS read.
        // ⚠ THE POUND DENOMINATIONS ARE LISTED INDIVIDUALLY because `isAcceptedSilent` is all-or-nothing per
        // LINE, and one sentence lists six of them (`£1 kap £2 … £5, £10, £20, kap £50`). No Min Nan name
        // for the pound occurs in the corpus — ⟨箍⟩ is the unit word, not a currency — so they are left
        // unread rather than guessed, as ¥/€/¢/₫ are.
        currency: ["$now", "3¢", "¥147,778", "£1", "£2", "£5", "£10", "£20", "£50", "M$2", "€;", "€9500", "₫44"],
    },
    jv: {
        // BARE POWERS OF TEN in astronomy infoboxes — SCIENTIFIC NOTATION (`108,2 × 10⁶ km`,
        // `2,875 × 10⁹ km`, the planetary orbital radii), which this layer reads for NO language: it reads
        // UNIT exponents (km² → kilomèter persegi) and mantissa notation is a different thing. Listed by
        // instance rather than silencing the class, so a km²/cm³ regression stays visible — both ARE read.
        // …and `mil³`, cubic MILES in a parenthetical unit gloss (`1,4 triliun kilomèter kubik (330 juta
        // mil³)`). The metric units are declared and read; the imperial one is not, and one instance inside
        // a conversion aside does not justify adding a short, collision-prone `mil` key.
        // `--- jiwa/km²` is INFOBOX DEBRIS — a template whose value never filled in ("Kapadhetan: +/- ---
        // jiwa/km²"), so the density rule finds no number to key on. `m³/s` is a tier limitation rather than
        // a data gap: its unit pattern offers a numerator EXPONENT and a rate DENOMINATOR as alternatives,
        // not together, so `1 m³/s` composes the m³ and leaves the `/s`. One instance, in a unit-conversion
        // aside; widening the shared tier for it would want its own fleet measurement.
        exponent: ["10⁶", "10⁹", "sa-km²", "mil³", "ft³", "--- jiwa/km²", "m³/s"],
        // PARENTHETICAL EXTREMES in a botanical description, not negatives: `Godhong awangun jorong nganti
        // lansét, 10-15(-17) cm × 3-4,5(-12,5) cm` — the flora convention for "usually 10–15, rarely to 17".
        // A minus rule would read a leaf measurement as arithmetic.
        // …plus the corpus's ONE TRUE NEGATIVE, which is inside an ENGLISH bibliographic citation: "a
        // thermodynamic singularity at –45 °C, The Journal of Chemical Physics". No Javanese negative-number
        // word is attested anywhere in the corpus or on jv.wikipedia, and the sign here sits in foreign
        // text; inventing one to read a reference title would be the wrong trade.
        minus: ["(-17)", "(-12,5)", "(-1", "–45"],
        // A MIXED FRACTION before the degree sign — `2 garis balik (23 1/2°LU-23 1/2° LS)`, the tropics at
        // 23½°. Step 4 turns the `1/2` into ⟨setengah⟩, which leaves a WORD rather than a digit before the
        // sign, and the degree rule requires a digit. One instance, and the alternative — letting the degree
        // rule fire on a word — would misread every other shape.
        degree: ["setengah°", "1/2°"],
        // The ⟨×⟩ of a BOTANICAL DIMENSION whose left operand is a unit word, not a digit — `10-15(-17) cm
        // × 3-4,5(-12,5) cm`. The tier's multiply composes number×number, and the sign IS read in that
        // shape; this one instance sits after `cm`. Listed rather than widening the tier, since a
        // `word × number` rule has exactly one attested instance to justify it (trap 9).
        "math-sign": ["cm × 3"],
    },
    gan: {
        // ⚠ gan IS THE SIXTH SINITIC CORPUS TO PRODUCE THE ROMANIZATION-TONE HAZARD, and this file's own
        // cjy note predicted it here by name ("worth expecting in gan/hak/hsn"). gan.wikipedia opens its
        // articles with a NANCHANG PRONUNCIATION GLOSS — `亞細亞洲（南昌話：/ŋa²¹³ ɕi³⁵ ŋa²¹³ t͡siiu⁴²/）`,
        // `地球（南昌話：/tʰi¹¹ tɕʰiu²⁴/）`, `江澤民（南昌話：[kɔŋ⁴⁴ tsʰik⁵ min³⁵]）` — so a superscript in
        // this corpus is usually a TONE NUMBER on the very variety the engine speaks. Reading it as a power
        // would turn the dict's own source notation into arithmetic. That is why `bareExponent` is
        // undeclared; a squared UNIT is still read (`750萬 km²` → 750萬 平方公里, step 4), which is what
        // keeps this list honest.
        // The genuine exponents here are all things no layer reads: mantissa notation (`1.6 × 10⁻¹⁹`,
        // `1.6726231 × 10⁻²⁷ kg`), a physics unit on a rate denominator (`938 百萬電子伏特 /c²（MeV/c²）`)
        // and a cube on an undeclared one-character unit (`2.32g/cm³` — ⟨立方⟩ is undeclared because it is
        // ×0 in this corpus against ⟨平方⟩'s ×29, the same evidence hak used).
        exponent: ["10⁻¹⁹", "/c²", "MeV/c²", "10⁻²⁷", "cm³", "10¹⁹",
            "ŋa²¹³", "ɕi³⁵", "t͡siiu⁴²", "tʰi¹¹", "tɕʰiu²⁴", "tsʰɔŋ⁴²", "tɕin⁴⁵", "tɕiu²¹³",
            "u²¹³", "tɕʰi²¹³", "ȵi²¹", "nyy³", "kah⁶", "kɔŋ⁴⁴", "tsʰik⁵", "min³⁵"],
        // THE DEGREE, EVERY INSTANCE — coordinates, compass bearings, and an article ABOUT the sign. The
        // class-level refusal with its dict measurement is in ACCEPTED_SIGN_SILENCE; these spans exist
        // because the two tables answer different questions, and listing the instances means a real
        // temperature regression would still report. (The corpus's one real temperature, `熔點380℃`, is in
        // that same class refusal: ⟨度⟩ is SILENT, so no rule can read it.)
        degree: ["113°", "114°", "27°", "28°", "116°", "117°", "29°", "47.8°", "28.3°",
            "090°", "N90°", "S90°", "180°", "S0°", "270°", "000°", "N0°", "「°」", "（1°）"],
        // ⚠ NOT NEGATIVES — the minus rule (step 6) READS the corpus's real ones (`負4點六`, `負1、負2、負3`,
        // and the word ⟨負⟩ is attested in sense in gan's own integer article). What is left is four
        // COORDINATE SPANS, where the dash is a range between two bearings whose primes have no reading
        // either, and one PERCENT RANGE: `3%-4%` reads as `百分之 3-百分之 4`, because step 4 claims each `%`
        // and step 7 can then no longer see two digits across the dash. All five are correctly silent; the
        // percent range is counted and declined in gan/normalize.ts.
        // Listed by span because `acceptedSignClass` tests a sign regex against a SINGLE character and the
        // minus pattern is CONTEXTUAL — the same limitation nan, hak, tl and wuu record.
        minus: ["113°54′-114°", "27°33′-28°", "116°57′--117°", "28°44′--29°", "3%-4%"],
        // NOT ARITHMETIC, ANY OF IT. The class refusal and its evidence are in ACCEPTED_SIGN_SILENCE; these
        // spans exist for the same reason the minus ones do. The set is: the Gan verb-complement GRAMMAR
        // SCHEMA (`“動詞+得+補語+賓語”`), `C++`, set-theory definitions of the naturals, balanced chemical
        // equations, LaTeX bodies, a Cyrillic-name schema, an asteroid designation, a measurement tolerance
        // and EasyTimeline chart code.
        "math-sign": ["0=0/1", "3=3/1", "...=7/9", "0.1=0.10000", "0'={0}", "2'=0' ' '={0,1,2}={0,{0}",
            "動詞+得+補語+賓語", "動詞+不+補語+賓語", "動詞+得+賓語+補語", "動詞+賓語+不+補語",
            "C++", "1.6 × 10", "1.7×10", "1.6726231 × 10", "1.9×10",
            "2H 2 O+2e - =H 2 ↑+2OH -", "2Cl - =Cl 2 +2e -",
            "MnO 2 +4HCl=MnCl 2 +Cl 2 ↑+2H 2 O", "2KMnO 4 +16HCl=2MnCl 2 +2KCl+5Cl 2 ↑+8H 2 O",
            "{CO}_2 + {ZnO}", "{CO}_2 + {C}", "{ZnO} + {CO}", "{Zn} + {CO}_2",
            "x > 0", "sin(x) = 0", "π = 3.14159", "English = AE", "English = BE",
            "\\pi} + 1 = 0", "PlotArea = left:10", "名 + 爺名 + 姓", "沃虎+585", "Wolfe+585",
            "36.1±2.6ka", "64.2±4.9ka"],
        // ⚠ NO `currency` KEY, DELIBERATELY, AND THE ABSENCE IS THE RECORD OF A REVERSED REFUSAL. The four
        // `$` in this corpus WERE going to be listed here — one article, a film's box office, and no
        // corpus-attested word for the sign. `attest.ts` then found 美元 ×5 on gan.wikipedia in monetary
        // amounts and the wiki's own gloss of the symbol (`符號USD或者US$`), so the sign is now READ and an
        // entry here would cover nothing. Deleted rather than left as ballast, per this table's own rule.
        // A JAPANESE ITERATION MARK in a quoted list of Japanese surnames (`長谷川、佐々木、五十嵐…`), which
        // Gan does not use. Reading it would need Japanese's rule, not this one's — the nan precedent.
        iteration: ["佐々木"],
    },
    hak: {
        // ⚠ THE SAME SINITIC HAZARD wuu RECORDS: A SUPERSCRIPT IN THESE ARTICLES IS OFTEN A TONE NUMBER,
        // not a power — hak.wikipedia glosses other varieties' phonology inline (`Si-chhôn-fa piang-yîm:
        // Xu⁴nin²`). Silence is the CORRECT reading there; voicing it would read a pronunciation gloss as
        // arithmetic. The rest are real exponents this layer cannot reach, each for a stated reason:
        //   · `m/s²` and `m/s/s` — an acceleration in a quoted CHINESE rolling-stock article. The exponent
        //     sits on a RATE denominator, which the shared tier composes but cannot then square.
        //   · `万m³` (`2700万m³`, `11.85万m³`) — cubic metres, and BOTH halves are declined: ⟨立方⟩ is
        //     undeclared because `li̍p-fông` has ZERO corpus instances against `phiàng-fông`'s 1,850, and
        //     `m` is undeclared because a one-character unit in an unspaced script is inseparable from any
        //     name containing it. The two gaps are the same gap, as they were in wuu.
        //   · `ngìn/km²` (population density) — the exponent IS read; what the reading lacks is the rate,
        //     and wuu's density rule was local precisely because the per-phrase order is per-language and
        //     this corpus never writes the fact in words for it to be sourced from.
        // Instance-listed rather than class-silenced so a km² regression stays visible — km² IS read
        // (`8,494 km²` → 8494 平方公里).
        //   · `R² sa to R³` — a MATHEMATICAL space (ℝ²→ℝ³) in the calculus article. Not a unit at all, so
        //     no `exponentWords` slot can reach it; reading it as "square" would be wrong for a dimension.
        exponent: ["Xu⁴nin²", "No²san¹", "ȵi²bin¹", "Mi²san¹", "R² sa", "to R³", "m/s²", "1.3m/s²",
            "1.35m/s²", "2700万m³", "11.85万m³", "ngìn/km²", "ngìn /km²", "sṳ̀-kiên²", "x^2", "y^2", "h^2"],
        // ⚠ NOT ARITHMETIC, which is why the class refusal in ACCEPTED_SIGN_SILENCE cannot carry them (that
        // table is consulted per SIGN and the minus pattern is CONTEXTUAL, so it never matches one char):
        //   · `-2, 0, +4, +6` — CHEMICAL OXIDATION STATES in the sulfur article, a list not a subtraction.
        //   · `112°50'-114°45'` and `23°5'-25°31'` — COORDINATE RANGES, which normalize.ts step 3 reads as
        //     ranges (`112度50分至114度45分`); the leading `-` the pattern sees is that connective.
        //   · THE 3-DIGIT YEAR RANGES — `562-ngièn -560-ngièn`, `303-ngièn -349-ngièn`, `319-ngièn -351`,
        //     `384-ngièn -407-ngièn`. Step 2 folds the morpheme so both endpoints read as cardinals with 年,
        //     but `spellYears` claims FOUR digits only, so the dash between them stays unread. That is the
        //     fleet's standing refusal working as intended, not an oversight: a short `N年` is a DURATION as
        //     often as a year and nothing in the surface separates them. ⚠ THEIR 4-DIGIT COUSINS ARE READ —
        //     `1847-ngièn -1899-ngièn` → 一八四七年至一八九九年 — which is what makes this a boundary rather
        //     than a gap. `(1906 -1979)` has no year word on either side and is declined for that reason.
        // The GENUINE negatives are read, and their word is the corpus's own: `-4.5℃`, `-218 °C`, `−224℃`,
        // `-170°C`, `-5 °C` all take 零下 (`làng-hâ`, corpus-attested) — normalize.ts step 4.
        minus: ["-2, 0, +4", "+4, +6", "50'-114", "5'-25", "562-ngièn -560", "1906 -1979",
            "303-ngièn -349", "319-ngièn -351", "384-ngièn -407",
            "chṳ́ -yû", "chṳ́ -yu", "sṳ́ -yung", "Chhṳ́ -ngoi"],
    },
    hsn: {
        // THE COORDINATE DEGREE, and it is the whole of this class: the corpus's only two `°` are one
        // sentence's bounding box — `地圖座標為東經111°53'－114°5'，北緯27°51'－28°40'`. The TEMPERATURE
        // degree is not read either, but for a different and harder reason recorded in ACCEPTED_SIGN_SILENCE:
        // ⟨度⟩ is SILENT in this dict, so a `°C` rule would delete the word as well as the sign. Listed by
        // instance rather than silencing the class, so if a Xiang temperature ever appears it still reports.
        degree: ["111°", "114°", "27°", "28°"],
    },
    ps: {
        // THE BARE DEGREE SIGN, every instance a GEOGRAPHIC COORDINATE. ps/normalize.ts step 6 reads the
        // temperature one (`۲۴ °C` → `۲۴ سانتيګراد`, the word attested ×100 and ×56 directly after a
        // numeral); the degree OF ARC has no attested Pashto reading and neither do the prime/double-prime
        // marks beside it, so `۳۳°۳۹'۱۱"N` would be half-read at best. Listed by instance so a `°C`
        // regression stays visible.
        degree: ["5 °", "29 °", "22 °", "37 °", "45 °", "38 °", "48 °", "31°", "64 °", "۳۳°", "۷۳°",
            "۱۳°", "۵۹°"],
        // CURRENCIES THIS LAYER DOES NOT DECLARE, and deliberately: only the dollar is (`ډالر` ×2,520,
        // ×374 directly after a numeral). The rupee, the pound and the won have NO Pashto name anywhere in
        // 242,649 lines, and all four instances are foreign-context asides — Indian cinema ticket prices
        // (`۱۲۰ ₹`, `₹ 50`), a British statutory fine (`د £ ۵۰۰۰ جریمې`) and a Korean prize
        // (`₩۱۰۰ میلیونه`). Naming them would be invention; `؋`, the AFGHANI, occurs ONCE in the whole
        // corpus, which is why the country's own currency is not declared either.
        // ⚠ AND THE `$` SPANS ARE THE OPPOSITE CASE — PERMISSIBLE DROPS the probe cannot see (trap 12).
        // The sentence NAMES the dollar on the other side of the figure, so ps/normalize.ts step 10 drops
        // the sign on purpose: `$ 250 ډالرو`, `$۱۷۴۰۰ ډالره`, `100 $ میلیارده امریکایي ډالرو`. The word IS
        // in the reading — but in an OBLIQUE/plural form (ډالرو، ډالره) where the probe looks for the
        // citation form ډالر, so the redundancy test scores it as a drop. Emitting the word anyway would
        // say the currency twice, which is the reading this layer exists to avoid.
        currency: ["₹", "£", "₩", "$ 250", "$١٧٤٠٠", "100 $"],
        // AN EN DASH INSIDE A SCIENTIFIC-NOTATION RANGE — `نژدې 10¹¹–10¹² د وينې نوي سلولونه`, i.e.
        // 10¹¹ to 10¹². It is a span, not a negative, and the range rule (step 8) cannot claim it because
        // its operands end in SUPERSCRIPTS rather than digits. Reading it as a minus would turn a blood-cell
        // count into arithmetic. The corpus's true negatives ARE read — `منفي`, step 11.
        minus: ["10¹¹–10¹²"],
        // SCIENTIFIC NOTATION, which this layer reads for no language: `4.1×10¹⁰ m³`, `3 x 10²⁶`,
        // `2×10³⁰`, `4×10¹³`, `7.2 x 10¹³ jouls/kg`, `2.4 x 10⁷`. A mantissa power is a different thing
        // from a squared unit, and the squared unit IS read (`km²` → `کیلو متر مربع`, step 5).
        // Three that are not scientific notation and are worth naming separately:
        //   · `هر km²` — a unit with NO NUMERAL in front of it ("per every km²"). The rule keys on
        //     number+unit adjacency, which is right; a numberless unit is a tier limitation, not a gap in
        //     the data, and it is one instance.
        //   · `۱۳۷ ک.م²` — the exponent on the PASHTO abbreviation of kilometre (ک.م) rather than the Latin
        //     one. Undeclared because ک.م is two letters plus a dot and would collide with ordinary prose.
        //   · `يادېږي²` — a FOOTNOTE MARKER on a word, not a power at all.
        exponent: ["10¹⁰", "10²⁶", "10³⁰", "10¹³", "10⁷", "km²", "ک.م²", "يادېږي²", "m³"],
    },
    ln: {
        // THE BARE DEGREE SIGN, which is not the temperature one. ln/normalize.ts step 6 reads `25 °C` as
        // `Celsius 25` — the SCALE NAME, since `Celsius`/`kelvin` are attested and no Lingala word for
        // *degree* is (`degré` ×1 is French). Every instance below is the sign WITHOUT a scale letter, and
        // there are exactly three kinds, none of them a temperature:
        //   · GEOGRAPHIC COORDINATES — `4°16′S`, `15°17′E`, `04°48′S`, `11°51′E`, `77° 02’ 12’’ W`, and the
        //     decimal-degree pair a geohack template emits (`4.800°S 11.850°E`).
        //   · GEOMETRY ANGLES in the maths articles — the sum of a triangle's angles (`180°`) and the right
        //     angle (`90°`, ×3 across the perpendicularity and right-triangle definitions).
        //   · THE FRENCH NUMERO SIGN, which is a different character's job done by this one: `Mobéko
        //     n°011/2002` (a statute number) and `n° 33-34` / `n° 68-70` (journal issues, two citations in
        //     the same reference list).
        //     Reading it as a degree would be worse than silence.
        // Listed by instance rather than silencing the class so a `°C` regression stays visible — that IS read.
        degree: ["4°16", "4°22", "15°17", "77°", "04°48", "11°51", "4.800°S", "11.850°E",
            "180°", "90°", "n°011", "n° 33", "n° 68"],
        // SCIENTIFIC NOTATION and BIBLIOGRAPHIC EDITION NUMBERS — neither is a unit exponent, and unit
        // exponents are what this layer reads (`km²` → kilomɛtrɛ-kare, ln/normalize.ts step 5, sourced from
        // the corpus's own `kilomɛtrɛ-kare` ×11).
        //   · `10⁻¹⁹`, `10⁻³¹`, `10⁻²⁷` — the electron charge, the electron mass and the neutron mass, in the
        //     physics articles. A mantissa power is a different thing from a squared unit and no language in
        //     the fleet reads it.
        //   · `2007³` and `2007²` — the CONTINENTAL EDITION CONVENTION in a reference list ("3rd ed., 2007"),
        //     where the superscript numbers the edition, not a power of the year.
        //   · `m³/s` — a river's discharge. The shared unit tier offers a numerator exponent OR a rate
        //     denominator, not both, so `m³` composes and the `/s` is left; the same one-instance tier
        //     limitation jv records. Widening it wants its own fleet measurement.
        exponent: ["10⁻¹⁹", "10⁻³¹", "10⁻²⁷", "2007³", "2007²", "m³/s"],
        // THE SIGN IS NAMED IN ITS OWN SENTENCE in every case — the drop is redundant, not lossy, and the
        // contribution test cannot see it because the name the corpus writes is not the word this layer says.
        //   · `Bozitó Sterling (lingɛlɛ́sa: Pound Sterling, £) ezalí mbóngo ya Ingɛlɛ́tɛlɛ` and
        //     `Euro (€) ezalí mbɔ́ngɔ ya Erópa` — DEFINITIONAL GLOSSES, the sign parenthesised beside the
        //     currency's spelled-out name. Only `dolare` is declared (×16, sense-checked); the pound and the
        //     euro have no attested Lingala name, so naming them here would be an invention on top of a
        //     sentence that already says which currency it means.
        //   · `badollar 45$ tii na badollar 10$` — the DOLLAR, named immediately before the figure. The
        //     layer's `NAMED` lookbehind (step 9) is what suppresses this on purpose: emitting the word would
        //     read the currency twice.
        //   · `ndako na €1` sits inside a French-language passage about a French city.
        currency: ["£", "€", "45$", "10$"],
        // LUA MODULE SOURCE quoted verbatim into the wiki (`local zehner = (zahl - zahl % 10 ) / 10;`), where
        // `%` is the MODULO OPERATOR. A percent word here would read a line of code as a proportion.
        percent: ["zahl % 10"],
        // ⚠ NO `minus` KEY, DELIBERATELY. Six lines still report, and all six are GENUINE negatives: two
        // negative latitudes (`-4.2667`, `-4.800`), the electron charge (`-1,602 189`), absolute zero
        // (`-273,15 °C`), and two BCE years (`mobú -753`, `mobú -3300`). Lingala has no attested word for
        // them — the corpus's only candidate, `molongola`, is an adjective describing a charge, not what a
        // reader says before a number — so the sign is silent and the silence INVERTS the value. Accepting
        // it here would turn a known-wrong reading into a green gate; the header of ln/normalize.ts records
        // the same refusal. The two `%`-flanked hyphens that used to report alongside them were never
        // negatives at all (`20%-40%`, `7.5%-10%`) and are now read as spans, step 7.
    },
    wuu: {
        // A SUPERSCRIPT IN A WU ARTICLE IS OFTEN A CHAO TONE NUMBER, NOT A POWER — the language's own
        // phonology is written with them, and wuu.wikipedia does it constantly: `khan³⁵-ban⁵⁵-kae³¹`,
        // `[ʑin²²ø⁵⁵tɕʰy²¹]`, `di⁶ jieu⁶`. Silence is the CORRECT reading; a rule that voiced these would
        // read a pronunciation gloss as arithmetic. That is a hazard specific to the Sinitic dirs and not a
        // gap. The remaining two are real exponents this layer cannot reach: `m³` needs the metre, which is
        // deliberately undeclared (米 is one character and inseparable from 米勒 "Miller" in an unspaced
        // script), and `公分³` puts the superscript on a HAN unit, which the shared tier cannot key on.
        // Instance-listed rather than class-silenced so a km² regression stays visible — km² IS read.
        exponent: ["khan³⁵", "ban⁵⁵", "kae³¹", "ʑin²²", "ø⁵⁵", "tɕʰy²¹", "di⁶", "jieu⁶", "doŋ²²³", "473m³",
            "公分³", "khan³⁵-ban⁵⁵-kae³¹"],
        // ⚠ NEITHER OF THESE IS ARITHMETIC, which is the whole reason the class refusal in
        // ACCEPTED_SIGN_SILENCE cannot carry them: that table is consulted per SIGN and the minus pattern is
        // CONTEXTUAL, so it can never match a single character (the tl entry records the same limitation).
        //   · `m = −1 で调和平均` — Japanese-language mathematics copy quoted in a wuu article.
        //   · `kg·m·s −2` — an SI derived unit, where the sign opens a NEGATIVE EXPONENT (s⁻²) spelled with
        //     an ASCII minus. Reading it as "minus two" would turn a unit into a subtraction.
        //   · `g·mol −1` and `g·cm −3` are the same SI shape twice more (mol⁻¹, cm⁻³) — one CHEMISTRY
        //     infobox carries both, so the line is only accepted once every span in it is named.
        minus: ["= −1", "s −2", "mol −1", "cm −3"],
        // A COLUMN HEADING IN A STATISTICS TABLE (`省内生产总值/GDP％ 人均省内生产总值`), where the sign
        // follows an INITIALISM and no number is in reach. The shared tier is right to require a number; a
        // percent word here would attach to nothing.
        percent: ["GDP％"],
        // The Japanese ideographic iteration mark inside JAPANESE text quoted in a wuu article
        // (`物理学や工学で様々な応用をもつ`). ⚠ AND THE DROP TEST IS A FALSE POSITIVE HERE FOR A SECOND
        // REASON: 様 is not a dict.tsv key, so the character it would repeat is skipped either way and the
        // reading is byte-identical with the mark deleted. The mark IS read wherever the base character is
        // in the dict — 佐々木 → 佐佐木, wu/normalize.ts step 13.
        iteration: ["様々"],
    },
    bar: {
        // ⚠ THE POINT OF THIS BLOCK IS THAT `minus` IS HERE AND NOT IN ACCEPTED_SIGN_SILENCE. Bavarian DOES
        // read the sign — `-13 °C`, `−20 °C`, `−45,9 Grad Celsius` all come out with *minus*, via the
        // degree-guarded rule in bavarian/normalize.ts. What is left over is five instances that are not
        // negatives at all, and unlike ln/ht/rw there is no genuine unreadable negative hiding among them:
        //   · a BCE year RANGE with the era marker on both ends (`4400 v. Kr.-4000 v. Kr.`);
        //   · a typo'd year range where a bracket has replaced a digit (`(180]–1927)`);
        //   · EasyTimeline CHART MARKUP, twice — `shift:(-10,5)` is a label offset in pixels, not a quantity,
        //     and it reaches the corpus because the dump-to-text keeps the template body;
        //   · an ELIDED YEAR — `de Finanzkrise vu de Joa 2007 und -8`, i.e. "2007 and '08", where the hyphen
        //     stands in for the dropped century exactly as an apostrophe would.
        // Listed by instance rather than silenced by class precisely so that a real negative outside the
        // degree slot would still surface.
        minus: ["v. Kr.-4000", "(180]–1927", "shift:(-10,5)", "und -8"],
        // ⚠ NEITHER IS A DEFECT THIS LAYER CAN CLOSE, and they are different in kind.
        //   · `3,2 Eihwohna/km²` is an exponent in a RATE DENOMINATOR. bar declares no `unitPer`, because its
        //     denominator nouns are unattested and the Bavarian subset has zero `km/h` (see normalize.ts) —
        //     and the numerator here is `Eihwohna`, a head noun no unit table would ever carry anyway.
        //   · `13.000 k² Eihkaaffsflächen` is a CORPUS TYPO: `k²` for `km²`, in an article about a shopping
        //     centre. `km²` itself IS read (→ *Quadratkilometa*), so no rule should learn `k²`.
        exponent: ["Eihwohna/km²", "13.000 k²"],
        // AN x86 ASSEMBLY LISTING in the article on assembly language. `%eax` and `%ebx` are REGISTER names —
        // the `%` is AT&T syntax, not a percentage — and `$4` is an immediate operand, not four dollars.
        // Silence is the correct reading for both, and the same two lines carry the `math-sign` refusal above.
        // ⚠ No `currency` key, although those same two lines contain `$4` and `$1`: the `$` there is an
        // IMMEDIATE OPERAND and the tier reads it as a currency, so the sign contributes and never reports.
        // An entry that cannot fire is ballast that would mask the regression this table exists to show.
        percent: ["%eax", "%ebx"],
        // ⚠ No `iteration` key either, and checking that was worth the two minutes. The artifact does carry a
        // Japanese iteration mark — `Yukihiro "chachamaru" Fujimura (茶々丸)`, a musician credit — and against
        // `bavarian.ts` alone it reports a drop. Through the REGISTRY's `phonemize`, which routes the Han run
        // to the CJK fallback, `々` SURVIVES into the IPA (`ʈ͡ʂʰɑ˧˥ 々 wɑn˧˥`), so it is a leak and not a drop
        // and the entry could never fire. An entry that cannot fire is ballast that would mask a real
        // regression — the `mi` lesson at the head of accepted-silent.test.ts.
        // ⚠ Measure an acceptance against the gate's OWN path (`phonemize(t, lang)`), not the engine's.
    },
    gu: { minus: ["એચજેઆર -3"] },
    kn: { minus: ["ಎಚ್‌ಜೆಆರ್ -3"] },
    mr: { minus: ["चंद्रयान -1"] },
    ta: { minus: ["சந்திரயான் -1"] },
    hi: {
        minus: [
            "चंद्रयान -1",
            // AN ERA RANGE, not a negative: "circa 600 BCE-1200 CE". The range lookbehind spans a digit plus
            // at most two letters and a dot, and `600 ई. पू.-` is longer than that — widening it far enough
            // to reach past two abbreviations would swallow hi's ONE true negative (`ख॰इ॰), -२.८८ परिमाण`),
            // which is the same shape. So the range is named instead of pattern-matched.
            "पू.-1200",
        ],
    },
    my: {
        // AN APPOSITION dash inside a list of ethnic groups — `(Koreans -၂သန်း)`, "Koreans – 2 million".
        minus: ["Koreans -၂သန်း"],
        // A COMPOUND JOINER, and this one is a linguistic judgement rather than a shrug. `အချိန်+ရပ်ဝန်းထု`
        // is *spacetime*; the `+` marks a compound and the words are spoken adjacent, exactly as a hyphen
        // would be. ⚠ Contrast a GLOSS sign (`=`), which separates a label from its expansion and must be
        // audible — burmese/normalize.ts step 12 draws the distinction — and Italian's `volo+hotel`, a
        // coordination whose reader was recorded saying *più*. Same glyph, different function.
        "math-sign": ["အချိန်+ရပ်ဝန်းထု", "ရပ်ဝန်း+အချိန်"],
        // A BARE ITERATION MARK HAS NOTHING TO REPEAT, so silence is the only correct output. These two are
        // wikitable rows from a Burmese article about JAPANESE kana marks — `ゝ`/`ゞ` are not Burmese
        // orthography at all. Routed to Japanese the mark still reads empty, because `ja` also (correctly)
        // has no antecedent to reduplicate.
        iteration: ["ゝ (reduplicates", "ゞ (reduplicates"],
    },
    xh: {
        // A STRAY HYPHEN. `ebhudla kangange -40 mph`, where the English original reads "winds blowing at
        // 40 mph" — so reading it as *thabatha* ("minus") would be confidently wrong. xhosa/normalize.ts
        // step 14 records this and measures its guarded pattern at 0 corpus matches.
        minus: ["kangange -40"],
    },
    nya: {
        // THE EURO, and it is the ONE currency sign in this corpus with no usable Chichewa name. The dollar
        // (`madola` ×29 in 19 ny.wikipedia articles, in monetary amounts) and the pound (`mapaundi` ×3, two
        // of them Nyasaland stamp denominations) are both declared and read; `yuro` scores ONE hit in ONE
        // article — and that article is the same machine-translated Europe piece the corpus itself carries,
        // so the wiki is not an independent source for it at all. One hit in one article is a lead, not a
        // finding, and a wrong currency word is confidently wrong where a silent sign is only missing.
        // ⚠ Listed BY INSTANCE rather than silencing the class, so the moment a `$` or `£` regresses — or a
        // € appears beside an attested Chichewa euro-word — the scan reports it again. Both listed lines
        // contain € and nothing else; the mixed `€ 94 miliyoni (£ 80 miliyoni)` line does NOT report,
        // because its pound IS read and the differential therefore changes.
        currency: ["€ 100 miliyoni", "€ 12 miliyoni"],
        // EASYTIMELINE PIXEL OFFSETS — a graph directive's x/y shift, not a number in any language. Nine
        // lines of ny.wikipedia population-graph source reach the artifact because `mine.ts` selects
        // adversarially and a chart is dense in exactly the characters the `signed-number` cell hunts.
        // ⚠ LISTED BY INSTANCE EVEN THOUGH THE CLASS REFUSAL IS ALREADY ARGUED IN `ACCEPTED_SIGN_SILENCE`,
        // for the same mechanical reason tl and wuu are: the `minus` DROPPABLE pattern is CONTEXTUAL
        // (`(?<!…)[-−–](?=\p{Nd})`), and `acceptedSignClass` tests a coarse class by matching it against a
        // SINGLE CHARACTER, which a contextual regex can never satisfy. The `=` lines above need no such
        // entry because `math-sign` is the plain character class `[+±×÷=<>]`.
        minus: ["shift:(-10,5)", "shift:(-60,-5)", "shift:(-15,5)", "shift:(-14,5)"],
    },
    za: {
        // ⚠ za IS THE SIXTH CORPUS TO PRODUCE THE ROMANIZATION-TONE-NUMBER FALSE POSITIVE, from a sixth
        // source — and unlike wuu/nan/cjy/hak/hsn, Zhuang is not Sinitic at all. za.wikipedia glosses its
        // headwords with CANTONESE readings, labelled in the text itself: `Vahgvangjdungh：hung¹ hei³`
        // (空氣), `Vahgvangjdungh：dang¹ taap³` (燈塔), `Vahgvangjdungh：ngaa⁴ caat²` (牙刷). Those
        // superscripts are jyutping tones, so voicing them would read a pronunciation gloss as arithmetic.
        // ⚠ Listed BY INSTANCE, never by class, because za's genuine unit exponents ARE read — `km²` →
        // *bingzfueng goengleix* (zhuang/normalize.ts step 5) — and a regression there must stay visible.
        exponent: ["hung¹ hei³", "dang¹ taap³", "ngaa⁴ caat²"],
    },
    bm: {
        // A PER-MILLE SIGN WITH NO OPERAND — the source article's template lost its figures, so the sentence
        // reads "… ka ca ( ‰ ka kɛɲɛ ni ‰ ye diɲɛ kɔnɔ)", three bare signs and not a number between them.
        // Silence is the CORRECT output: there is no quantity to attach a reading to, and no Bambara
        // per-mille word is attested either. The spans carry their neighbouring words deliberately, so a
        // NUMBERED `‰` would still report.
        percent: ["( ‰ ka kɛɲɛ ni ‰ ye diɲɛ kɔnɔ)", "ka kɛ ‰ ye Sahara"],
        // AN ENGLISH PRESS HEADLINE quoted whole inside a citation — "RELX said to be planning £100mln
        // takeover of Times Higher Education". `£` is the only non-`$` currency sign in the entire bm wiki
        // and no Bambara name for the pound is attested anywhere; `$` IS read (`dolar`, normalize.ts step
        // 10), so this is instance-listed rather than class-silenced to keep that reading under test.
        currency: ["£100mln"],
        // ⚠ NO BAMBARA CUBE WORD EXISTS, which is a sourcing block and not a rule gap. `kube` is attested ×2
        // on bm.wikipedia and BOTH hits mean CAPITAL CITY ("Kɔnakry kɛli a faaba (kube) ye"); `kubu` is ×0.
        // The corpus's own gloss writes raw French beside the symbol (`metre cube 135 000 m³`), i.e. it has
        // no Bambara word to offer either. Instance-listed rather than class-silenced so a `km²` regression
        // stays visible — km² IS read (`kilomɛtɛrɛ kɛnɛ`, sourced from 17 corpus glosses).
        exponent: ["metre cube 135 000 m³", "152 000 m³"],
    },
    mad: {
        // ⚠ THREE DESIGNATIONS AND A SPAN, AND WHAT IS *NOT* HERE IS THE POINT. Madurese's `minus` class is
        // deliberately NOT in `ACCEPTED_SIGN_SILENCE` (see there for why), so the two GENUINE negatives in
        // this corpus — `ka'dissa' -1 mèter dpl` and the integers article's `0, 1, -1, 2, - 2, ...` — keep
        // reporting. These three do not, because none of them is a sign at all:
        //   · `ka -8` and `kapèng -20` are the SPACED spelling of the ORDINAL prefix ⟨ka-⟩ ("the 8th prime
        //     minister", "the 20th century"), which the engine already reads correctly as a word plus a
        //     cardinal — the hyphen is orthographic, and normalize.ts adds no rule for it (playbook trap 16).
        //   · `35° Lintang Dâjâ -71° Lintang Dâjâ` is a COORDINATE SPAN whose endpoints have a two-word
        //     compass phrase between them, so no digit-adjacent rule can reach it; step 3 claims the spans
        //     whose mark and digit are contiguous and correctly declines this one.
        minus: ["ka -8", "kapèng -20", "Dâjâ -71°"],
        // A ± THE SENTENCE ALREADY SPELLS OUT — `Sorbhâjâ anḍi' lowas ra-kèra ±335,28 km²`. ⟨ra-kèra⟩ is
        // "approximately", which is exactly what this corpus's ± means (all four instances are a rounded
        // area or height, and one of them GLOSSES the sign: `korang lebbi ±1.752,21 km²`). normalize.ts
        // step 5 therefore CONSUMES the redundant sign rather than doubling the connective — the playbook's
        // trap-12 permissible drop, which no differential test can distinguish from a swallowed sign.
        // ⚠ `±` IS OTHERWISE READ (`korang lebbi`), which is why this is instance-listed and `plus-minus`
        // is absent from the class table: a regression on the unglossed form must stay visible.
        "math-sign": ["ra-kèra ±335,28"],
        // THREE CURRENCY SIGNS WITH NO MADURESE NAME, in a corpus where `$`, `US$`, `AS$`, `Rp` and `€` are
        // all read. `S$8 miliar` (Singapore) and `HK$ 490,3 miliar` (Hong Kong) cannot be reached by the
        // bare `$` key at all — the tier is letter-bounded on the left, correctly — and `¥ 150.000` has no
        // yen word anywhere in the corpus or on mad.wikipedia. The su/xh/ceb residue exactly: a currency
        // borrowing the language plausibly uses and no in-repo source records. Instance-listed rather than
        // class-silenced so the five signs that ARE read stay under test.
        currency: ["S$8 miliar", "¥ 150.000", "HK$ 490,3 miliar"],
        // A BARE-BASE EXPONENT INSIDE A FORMULA — `rumus persamaan massa-energi E = mc²`, the only one in
        // the corpus. `bareExponent` is deliberately not declared for mad (see normalize.ts): this wiki's
        // superscripts are overwhelmingly UNIT exponents, which the tier reads (`km²` → *kilomèter
        // persegi*), and the only things a bare-base rule would newly claim are this formula and a mangled
        // scientific notation. Same call `so` records for `E = mc²`, and instance-listed for the same
        // reason — a `km²` regression must stay visible.
        exponent: ["E = mc²"],
    },
    he: {
        // ⚠ BOTH ENTRIES ARE THE RESIDUE OF CLASSES THE LAYER DOES READ, listed by instance so the readings
        // stay under test — `25 %` → *ʔesʁim veχameʃ ʔaχuz* and `$5` → *χameʃ dolaʁ* both work, and a
        // regression in either must report again immediately.
        //
        // A PERCENT SIGN THAT IS NOT A PERCENTAGE. The corpus's Unix-time article quotes a SHELL COMMAND —
        // "ניתן לקבל את זמן יוניקס … על ידי הקלדת date +%s בשורת הפקודה" — where `%s` is strftime's
        // seconds-since-epoch format specifier. There is no quantity, and the `+` beside it is the same
        // non-arithmetic instance the ACCEPTED_SIGN_SILENCE `plus` entry counts. 1 of the corpus's 79
        // percent signs; the other 78 are read.
        percent: ["date +%s"],
        // A CURRENCY SIGN INSIDE AN ISO-STYLE CODE, AND A TEXTBOOK TRAP-12 REDUNDANCY. The sentence is
        // "ראש ממשלת טרינידד וטובגו עומד על 576,000 דולר טרינידדי (TT$)" — the amount is already stated
        // with the currency SPELLED OUT in Hebrew (`דולר טרינידדי`, Trinidadian dollars) and the code in
        // brackets repeats it. Saying it once, in the position Hebrew puts it, is the correct reading, and
        // the correct reading is byte-identical with the sign deleted — so the differential test reports a
        // drop and is right to. The rule cannot claim it in any case: there is no number adjacent to the
        // sign, which is the guard that keeps `$` from biting into ordinary Latin runs.
        currency: ["(TT$)"],
        // ⚠ THE MINUS IS NOT LISTED HERE, AND THAT IS DELIBERATE — see the ACCEPTED_SIGN_SILENCE header
        // above. The 8 hyphens the scan reports are compound hyphens (`מזון אולטרה-מעובד`, `דרום-קוריאני`,
        // `על-פני`, `אל-אסד`), date-range dashes and the designation `-700W`, every one correctly silent;
        // but accepting them by instance would make the class green, and a LEADING negative genuinely is
        // unread in this language. A red gate that is correct beats a green gate that is wrong (trap 24).
    },
    ht: {
        // A `km²` WITH NO NUMERAL IN FRONT OF IT. The unit rule keys on number-unit adjacency, which is
        // right; both of these lost their figures when the source article's template was stripped, so the
        // sentence reads `te gen abitan ak yon sifas tè km² ( mil kare)` and `pou chak km² ( pou chak mil
        // kare)` — a bare unit with nothing to measure. The ordinary exponents ARE read (`131 669 km²` →
        // *kilomèt kare*, normalize.ts step 5, sourced from `kilomèt kare` ×24 in the corpus's own prose),
        // which is what keeps this pair honest as a tier limitation rather than a data gap.
        exponent: ["sifas tè km²", "chak km²"],
        // THE POUND, the one currency sign here with no Haitian name. `$` IS read (`dola` ×493,
        // sense-checked, normalize.ts step 9) and `€` is dropped where the sentence already says *dola*
        // (trap 12, reported as REDUNDANT for exactly that reason). The pound has neither: no Haitian word
        // for it is attested anywhere in 800,158 paragraphs, and all three instances are one sentence about
        // the Chagos lease (`peman lwaye anyèl £165 milyon … apre sa £120 milyon pa ane`).
        // ⚠ Instance-listed rather than class-silenced, so a `$` regression reports again the moment it
        // happens — which is the whole reason the currency class is not in ACCEPTED_SIGN_SILENCE above.
        currency: ["£165 milyon", "£120 milyon"],
        // THE `=` AND `+` INSTANCES, LISTED BESIDE the class refusals above rather than instead of them,
        // because `acceptedSignClass` cannot accept `math-sign` — that class's regex matches a single
        // character and the scan reports per SENTENCE. Three families, none arithmetic a reader would voice:
        //   · EasyTimeline CHART MARKUP that survived extraction — `ScaleMajor = unit:year`, `PlotArea =
        //     left:50 right:20`, `ScaleMinor = unit:year increment:1000000`. This is code.
        //   · A BINARY ADDITION TABLE quoted whole from the computer-arithmetic article — `0 + 0 = 0 0 + 1
        //     = 1 1 + 0 = 1 1 + 1 = 0`, where the signs are a truth table's column headings.
        //   · DEFINITIONAL GLOSSES and school algebra — `(Radix = rasin)`, `lang=bon, kreyòl=pa bon`,
        //     `R = 4S`, `R = 4(20) = 80 goud`, `a n =(-1) n`, and the English melanoma title's `(< 1.00mm)`.
        "math-sign": ["ScaleMajor =", "ScaleMinor =", "PlotArea =", "Radix = rasin", "lang=bon", "kreyòl=pa",
            "R = 4S", "R = 4(20) = 80", "a n =(-1) n", "(< 1.00mm)", "anba Lisans >", "2 % (+38 %)",
            "0 + 0 = 0 0 + 1 = 1 1 + 0 = 1 1 + 1 = 0"],
    },
    rw: {
        // ⚠ THE CLASS-LEVEL REFUSALS AND THEIR MEASUREMENTS ARE IN `ACCEPTED_SIGN_SILENCE` ABOVE; these are the
        // per-INSTANCE residue the artifact scan still reports, and each is a case where silence is the
        // CORRECT reading rather than a missing rule.
        // ⚠ `minus` LISTS ONE DESIGNATION AND DELIBERATELY NOT THE OTHER LINE. `(HIV -1)` is a virus type
        // name whose hyphen is silent in speech — the `चंद्रयान -1` shape exactly. The corpus's OTHER minus is
        // a genuine negative LATITUDE (`ku bubangikane bwa −2.010556`, the Kabarondo coordinates) and is NOT
        // listed, so it keeps reporting: rw reads the negative TEMPERATURE it has a phrase for
        // (`munsi ya zeru`) and has no reading for a bare negative number, which must stay visible.
        minus: ["(HIV -1)"],
        // TWO SIGNS WITH NO KINYARWANDA MONEY BEHIND THEM, for two different reasons.
        // · `K¢` is not currency at all — it sits in a CYRILLIC TRANSLITERATION TABLE that reached the dump
        //   as `indagkk. K¢ 19: б [b], в [v], …`, i.e. dump debris where the cent sign is a lost glyph.
        // · `€` is the euro, and it is a SOURCING refusal: `iyero` scores 1 token in 1 article on
        //   rw.wikipedia, and that article is the SAME machine-translated Spain piece the corpus already
        //   carries — so the second haystack is not independent evidence. One hit in one article is a lead,
        //   not a finding. `$`/`US$` and `FRw`/`Rwf`/`RWF` ARE read (`amadolari`, `amafaranga y'u Rwanda`,
        //   both named beside their own symbols in rw.wikipedia's currency articles), so this is listed by
        //   INSTANCE rather than class-silenced to keep those two readings under test.
        currency: ["K¢ 19", "iyero (€)"],
        // A SUPERSCRIPT ZERO USED AS A SECTION MARKER, French `N°` style — `4⁰ Ihame ryo kumenyesha`, the
        // fourth principle in a numbered list of environmental principles. It is an ORDINAL indicator, not a
        // power, so reading it as one would be the defect. rw's real exponents ARE read: `km²`/`m³` compose
        // through the shared tier (`kilometero kare`, `metero kibe`, both attested collocations), which is
        // why this is one instance and not a class.
        exponent: ["4⁰"],
    },
    ug: {
        // ⚠ THE RESIDUE OF A CLASS THE LAYER DOES READ, listed by instance so the reading stays under test.
        // `مىنۇس` IS emitted for a real negative (see ACCEPTED_SIGN_SILENCE above and normalize.ts step 9);
        // these are the two mechanical families that share the shape and must stay silent — a clause-opening
        // dash glued to a year (`. -2006يىلى مۇقىم تېلپون`, the corpus's country-infobox boilerplate) and a
        // PERCENT RANGE (`ئىقتىسادى ئېشىش سۈرئىتى 5%-6%`, a growth rate). Plus one wiki signature.
        // ⚠ AND THE ONE GENUINE GAP IS DELIBERATELY NOT LISTED: `ياۋروپا ۋاقتى(-2ۋاقىت رايونى)` is a real
        // UTC offset, which the audio tier says IS voiced. One instance is not enough to widen a guard that
        // 28 counter-examples argued for (trap 9), so that line stays RED rather than accepted.
        minus: [
            "-2006يىلى", "-2005يىلى", "-1810يىلى",
            "2%-3%", "3%-4%", "5%-6%", "8%-9%",
            "--203.173.138.159",
        ],
        // FORUM SPAM, not prose. One paragraph of a bulletin-board signature block survived extraction
        // (`' i4 j9 k% K& x; y# K3 M5 @`) and carries a `%` and an `&`; another (`+ l# c9 ?& ]+ k`) and a
        // third (`9 Z$ t, _# B4 X( m3 P`) carry a `&` and a `$`. Nothing is read there because nothing is
        // said there. `%`, `&` and `$` are all read in this language's prose, which is why these are
        // instance-listed rather than class-silenced.
        percent: ["k% K&"],
        currency: ["9 Z$ t,"],
    },
    syl: {
        // TWO OF THE FOUR HYPHENS THE MINUS PROBE FINDS, and deliberately not the other two — this is the
        // instance list that keeps `review.ts --lang syl` HONESTLY red rather than quietly green.
        //  · `০°–১০০°` is a RANGE between two degree readings ("between 0° and 100° Celsius"). The range
        //    rule cannot claim it because the operands end in `°` rather than a digit, and the en-dash is
        //    correctly silent between two spoken temperatures.
        //  · `–5088` is a JSTOR citation's page span (`ꠜ꠆ꠞꠝꠘ –5088 |jstor=4414346`), not a quantity.
        // ⚠ WHAT IS NOT LISTED is the sentence carrying `-২৭৩.১৫°` and `-৪৫৯.৬৭°` — absolute zero in
        // Celsius and Fahrenheit, two real negatives whose sign this engine drops because no Sylheti word
        // for it is attested anywhere. Omitting a minus INVERTS, so that line must keep reporting. See
        // `ACCEPTED_SIGN_SILENCE` above for why the CLASS is not silenced either.
        minus: ["০°–১০০°", "–5088"],
    },
    rn: {
        // ⚠ THE CLASS-LEVEL REFUSALS AND THEIR MEASUREMENTS ARE IN `ACCEPTED_SIGN_SILENCE` ABOVE; this is the
        // per-INSTANCE residue the artifact scan still reports, and it is a case where silence is the CORRECT
        // reading rather than a missing rule.
        // ⚠ ONE OF rn's TWO MINUSES IS LISTED AND THE OTHER DELIBERATELY IS NOT. `(Kindergaten –2ème année)`
        // is a FRENCH grade range inside a parenthetical about English-language schooling — "Kindergarten to
        // 2nd year" — so the dash is a French connective in French text, not a Kirundi negative, and no
        // Kirundi reading of it could be right. The corpus's OTHER minus is a genuine negative TEMPERATURE
        // (`hakaba hakonje cane (nko munsi ya -39°C)`) and is NOT listed, so it keeps reporting: Kirundi has
        // no attested word for the sign and a dropped minus INVERTS the value, which must stay visible.
        minus: ["(Kindergaten –2ème année)"],
    },
    bal: {
        // ⚠ THE CLASS-LEVEL REFUSALS AND THEIR MEASUREMENTS ARE IN `ACCEPTED_SIGN_SILENCE` ABOVE; this is
        // the per-INSTANCE residue the artifact scan still reports, and all three are cases where silence
        // is the CORRECT reading rather than a missing rule. Southern Balochi's whole sign inventory is
        // these three characters, so the two lists happen to cover the same ground here — which is a fact
        // about how little this corpus writes, not a redundancy.
        // ⚠ A SIGN BEING NAMED, NOT USED. `₿` appears once in the corpus and twice in the artifact (the
        // hard and sample tiers both selected the sentence): `بیتکوین یا گۏن نماد BTC گۏن سیاھگ ₿` —
        // "Bitcoin, with the ticker BTC, with the symbol ₿". A symbol quoted as the thing under discussion
        // has no amount attached and wants no currency word; this is the `su` iteration-mark shape, a
        // mention rather than a use.
        currency: ["گۏن سیاھگ ₿"],
        // ⚠ AN ETYMOLOGY, NOT ARITHMETIC — and the plus is doing real work that no Balochi word would
        // improve. The calendar article decomposes ⟨گدرۏچ⟩ into its two parts: `گِد + رۏچ اَنت`, "is گِد
        // plus رۏچ". The operands are WORDS, so every guard the fleet uses (a digit on one side) already
        // rejects it, and reading a plus-word here would put arithmetic into a word-formation gloss.
        "math-sign": ["گِد + رۏچ اَنت"],
        // ⚠ ENGLISH INSIDE A PARENTHETICAL, which is this wiki's constant habit — it glosses proper nouns
        // with `(پہ انگرݔزی: …)` or a bare Latin parenthesis. The ampersand belongs to the English name
        // `Antigua & Barbuda` and is already on the Latin fallback's side of the seam.
        ampersand: ["(Antigua & Barbuda)"],
    },
    ti: {
        // ⚠ THE CLASS-LEVEL REFUSALS AND THEIR MEASUREMENTS ARE IN `ACCEPTED_SIGN_SILENCE` ABOVE; these
        // spans exist because `acceptedSignClass` tests a sign regex against a SINGLE character while the
        // artifact scan matches in context — the limitation cdo, gan, nan, hak, tl, wuu and syl all record.
        //
        // ⚠ AND THE POINT OF LISTING BY IDENTITY RATHER THAN SILENCING THE CLASS is visible in this
        // language better than anywhere: the ONE span deliberately left off the `minus` list below is the
        // only genuine Tigrinya negative in the corpus, and it keeps reporting.
        //
        // The `÷`-as-list-punctuation instances, the English gloss and the URL — argued in
        // ACCEPTED_SIGN_SILENCE. `+1 ኣሃዱታት` is NOT here: it is a real positive charge and a real defect.
        "math-sign": ["(= divide and conquer)", "ንሳቶም ድማ÷", "ጥራሕ ንርአ÷", "ኣብነት ንርአ÷", "ኪጎናጸፍ ይኽእል÷",
            "ኣብእስልምና÷", "football_team&action="],
        // ⚠ ONE SPAN ONLY, AND IT IS AN ERA DASH, NOT A NEGATIVE: `( –500 ቅድሚ ልደተ ክርስቶስ)` is "(500 BC)" —
        // the phrase after it says so in the corpus's own words, which is what makes this decidable where
        // the fleet's `चंद्रयान -1` cases are not. The sentence's other digit-adjacent dashes are all year
        // spans.
        // ⚠ `ኤሌክትሮናት -1 ኣሃዱ ዝኾነ ኣሉታዊ ቻርጅ` IS ABSENT FROM THIS LIST ON PURPOSE — the electron's charge is
        // a genuine negative that this layer declines to read (1 true against 1 false positive over 323
        // lines, and hi's narrowing arms do not separate them, since the false positive IS the
        // bracket-opening arm). It must keep failing until a ti minus rule earns its place.
        minus: ["( –500 ቅድሚ ልደተ ክርስቶስ)"],
        // EVERY SURVIVING `&`, and not one is an ampersand: unstripped HTML entities from the dump
        // extraction (`&nbsp;` ×13, `&#x…;` ×11) plus three English names. Listed by identity rather than
        // silenced so that a genuine Tigrinya `&`, if this wiki ever grows one, still reports.
        ampersand: ["&nbsp;", "&#x5B;", "&#x5D;", "&#x2013;", "&#x3A;", "R & amp;B",
            "\"Shoe Shine & Piano\"", "football_team&action="],
    },
    sn: {
        // ⚠ WHAT THIS `exponent` LIST DOES *NOT* CARRY IS THE POINT, and it is the stance `ln` and `rw` take
        // on their minus. The superscripts this layer CAN read it reads: `1m²` → `maskweya mamita motsi`,
        // `0,5m²` the same through normalize.ts step 7, `25339 m²` through the shared tier. Listed here are
        // only the instances where the exponent sits on a RATE ABBREVIATION cited in parentheses with NO
        // NUMBER AT ALL — a symbol being NAMED, not a quantity being stated, which is why nothing can attach
        // to it. ⚠ The bare-base line (`Kumucheto kurudyi kuna 2⁰, panotevera … 2¹ … 2²`) is deliberately
        // NOT listed: that is a real reading Shona declines for want of a connective — `pawa` is attested as
        // the power word (`pawa ra 2`, `pawa wa 2`, `nhamba b iri kuradanurwa ne pawa n`) but its
        // associative changes with the base's noun class, the same blocker as the `=` — so
        // `review.ts --lang sn` stays red on it.
        exponent: [
            "Rufangu (Acceleration)- iri izwi rinoreva kuchinja kwemuchacha paumwe hwechiyero chenguva. Kufangura kune chiyero (m/s²). Tsazaniso inoti Rufangu = (kuchinja kwemuchacha/nguva).",
            "Rufangu (Acceleration)- iri izwi rinoreva kuchinja kweSpidhi paumwe hwechiyero chenguva. Rufangu rune chiyero (m/s²). Rufangu runowanikwa nekugova spidhi pane nguva.",
            "a yakamirira rufangu runoyerwa muma(m/s²)",
            "Muchidzidzo Fundoyetsimba, (Physics), puresha (Pressure) izwi rinotsanangudza huhwandu hweFosi iri kudzvanya pamusoro penharaunda yakapimwa. Puresha inopimwa nechiyero chinonzi Pascal kana kuti N/m². Puresha inopimwa nerudzivo rwakarurama panharaunda yakadzvanyiwa nepuresha yacho.",
        ],
        // THE POUND, and it is the one currency sign in this corpus with no usable Shona name. The dollar is
        // declared and read — `madhora`, which the corpus itself glosses against the sign in `chikwereti
        // chezana remadhora chinonyorwa senhamba yakagon'a sezvizvi -$100` — and so is `US$`, through its own
        // compound key. `mapondo` and `pondo` are BOTH ×0 on sn.wikipedia, and this sign's only two instances
        // are inside a quotation of Virginia Woolf in a literary biography. One quotation is not an
        // attestation, and a wrong currency word is confidently wrong where a silent sign is merely missing.
        // ⚠ Listed BY INSTANCE rather than silencing the class, so the moment a `$` regresses — or a Shona
        // pound word appears — the scan reports it again.
        currency: [
            "Achibvunzwa nezve kushomeka kwake kwekunyora kubvira Nervous Conditions, Dangarembga akatsanangura muna 2004: \"Chekutanga, riini rakaburitswa mushure mekunge ndashandura kuita firimu sesvikiro; chechipiri, kuona kwaVirginia Woolf kwakangwara kuti mukadzi anoda £500 nekamuri. zvake kuti anyore zvine musoro zvachose. Sezvineiwo, ndiri kufamba uye ndinovimba kuti, kekutanga kubvira Nervous Conditions, ndichave nekamuri yangu ndega. Ndichaedza kufuratira zvishoma nezve £500.\" Zvechokwadi, makore maviri gare gare muna 2006, akaburitsa chinyorwa chake chechipiri, Bhuku reKwete, sequel kune Nervous Conditions . Vakapindawo mune zvematongerwo enyika, uye muna 2010 vakadomwa semunyori wezvedzidzo mubato rezvematongerwo enyika reMovement for Democratic Change rinotungamirwa naVaArthur Mutambara . Akataura nezvekwaakabva kumhuri yevadzidzisi, nguva yake pfupi semudzidzisi, uye kupinda kwake muchikamu chedzidzo sekumugadzirira basa iri. Akapedza zvidzidzo zvekuva chiremba muzvidzidzo zveAfrica paHumboldt University yeBerlin, uye akanyora dzidziso yake yePhD pamusoro pekugamuchirwa kwefirimu reAfrica.",
        ],
    },
    bo: {
        // A REDUNDANT PERCENT SIGN THE `isRedundant` PROBE CANNOT SEE — the ak situation exactly, and for
        // the same reason. Tibetan PREPOSES `བརྒྱ་ཆ` ("hundred-part") to its figure and the corpus writes it
        // beside the sign in seven of the retained text's twenty-two percent instances, so
        // tibetan/normalize.ts step 7 SUPPRESSES its own word where the sentence has already said it.
        // Saying it once is the correct reading (trap 12), and the correct reading is byte-identical with
        // the sign deleted, so the differential test reports a drop and is right to.
        // ⚠ WHY THESE FOUR AND NOT THE OTHER THREE. `isRedundant` looks for the symbol's own contribution
        // tokens — the reading of a bare `25 %`, where `བརྒྱ་ཆ` is word-INITIAL and comes out *kʲa˩t͡ɕʰa˥*
        // with LOW tone. In these four the corpus writes the word tsheg-bound into the phrase before it
        // (`མི་འབོར་བརྒྱ་ཆ༩༩.༧%`, `བརྒྱ་ཆའི་30%`), so it is a NON-INITIAL syllable and Lhasa's word-tone
        // template flattens it to *kʲa˥t͡ɕʰa˥* — a one-diacritic difference that the token test cannot match
        // on a word that is plainly there. That is a limitation of the probe, not a defect in the reading.
        // ⚠ Listed WITH THE WORD in the span rather than as a bare `30%`, so a genuinely dropped percent
        // elsewhere in this language still reports. A bare figure would launder it.
        percent: ["བརྒྱ་ཆ༩༩.༧%", "བརྒྱ་ཆའི་30%", "བརྒྱ་ཆ་ 95%", "བརྒྱ་ཆ་70%"],
    },
};

/**
 * Is every occurrence of this class's symbol inside a designation accepted for this language?
 *
 * Deliberately strict: returns false when the sentence contains a match OUTSIDE a named span, and false when
 * the language names none, so the accept can only ever remove a hit it can fully account for.
 */
export function isAcceptedSilent(lang: string, cls: string, line: string, re: RegExp): boolean {
    const forms = ACCEPTED_SILENT[lang]?.[cls];
    if (forms === undefined) return false;
    const spans: [number, number][] = [];
    for (const f of forms)
        for (let i = line.indexOf(f); i !== -1; i = line.indexOf(f, i + 1)) spans.push([i, i + f.length]);
    if (spans.length === 0) return false;
    const saved = re.lastIndex;
    re.lastIndex = 0;
    let sawOne = false;
    for (let m = re.exec(line); m !== null; m = re.exec(line)) {
        sawOne = true;
        if (!spans.some(([a, b]) => m!.index >= a && m!.index < b)) { re.lastIndex = saved; return false; }
    }
    re.lastIndex = saved;
    return sawOne;
}

/**
 * ISO codes that denote each currency sign.
 *
 * ⚠ A CURRENCY IS ALSO NAMED BY ITS ISO CODE, which `contribution` cannot see: the code reads as spelled
 * letters, so the sign's own word is nowhere in the IPA and a correct drop still reports. Malay writes
 * `$45 juta AUD` — the sign and the code are the same currency stated twice, so saying it once is the right
 * reading and the deletion test cannot pass on it. Sign-keyed rather than a bare three-capitals shape,
 * because that shape is every other initialism in the corpus too.
 */
export const SIGN_CODES: Readonly<Record<string, string>> = {
    $: "USD|AUD|CAD|NZD|SGD|HKD|TWD|MXN|BRL|ARS|CLP|COP",
    "€": "EUR", "£": "GBP", "¥": "JPY|CNY|RMB", "₹": "INR", "₽": "RUB", "₩": "KRW", "₺": "TRY", "₪": "ILS",
};

/** Phonemize one probe string, or undefined if the engine throws on it. */
export type Say = (text: string) => string | undefined;

/**
 * The IPA tokens a symbol adds to a bare `5` — its own word, or [] if it says nothing at all.
 *
 * ⚠ THIS IS WHAT SEPARATES A PERMISSIBLE DROP FROM A DEFECT. A sentence like `($১৪.৭ বিলিয়ন আমেৰিকান ডলাৰ)`
 * already says "American dollar", so the correct reading is byte-identical with and without the sign and no
 * correct rule can escape the deletion test there. Ask instead whether the symbol's OWN WORD is in the
 * reading: present → the meaning IS spoken → permissible; absent → nothing says it → a real drop.
 *
 * Strictly narrower than "does the engine know this symbol anywhere": an engine that reads a bare `$5` but
 * swallows the `$` in `leUS$30` still reports. A symbol the engine never reads adds no tokens, so it can
 * never be downgraded.
 */
export function makeContribution(say: Say): (sym: string) => string[] {
    const memo = new Map<string, string[]>();
    return (sym: string): string[] => {
        const hit = memo.get(sym);
        if (hit !== undefined) return hit;
        let words: string[] = [];
        const bareRead = say("5");
        if (bareRead !== undefined) {
            const bare = new Set(bareRead.split(/\s+/u));
            for (const probe of [`5${sym}`, `${sym}5`]) {
                const read = say(probe);
                if (read === undefined) continue;
                const added = read.split(/\s+/u).filter((t) => t !== "" && !bare.has(t));
                if (added.length > 0) { words = added; break; }
            }
        }
        memo.set(sym, words);
        return words;
    };
}

/**
 * Is this drop PERMISSIBLE — i.e. does the sentence already say what the symbol means?
 *
 * Two ways it can: the symbol's own word is in the reading, or the sentence names a currency by its ISO CODE
 * and that code is itself spoken. ⚠ The code must be SPOKEN, or a dropped code would license a dropped sign.
 */
export function isRedundant(
    sentence: string,
    ipa: string,
    symbols: readonly string[],
    contribution: (sym: string) => string[],
    say: Say,
): boolean {
    if (symbols.length === 0) return false;
    return symbols.every((sym) => {
        const words = contribution(sym);
        if (words.length > 0 && words.every((w) => ipa.includes(w))) return true;
        const alt = SIGN_CODES[sym];
        if (alt === undefined) return false;
        const code = new RegExp(`(?<![\\p{L}\\p{M}])(?:${alt})(?![\\p{L}\\p{M}])`, "u").exec(sentence)?.[0];
        if (code === undefined) return false;
        const spelled = say(code)?.split(/\s+/u).filter((t) => t !== "") ?? [];
        return spelled.length > 0 && spelled.every((t) => ipa.includes(t));
    });
}

/**
 * THE PROBE STRING for the differential test: the sentence with the symbol replaced by a SPACE (see `dropsIn`
 * for why a space and not deletion).
 *
 * ⚠ EXPORTED BECAUSE THERE ARE TWO DIFFERENTIAL LOOPS, NOT ONE. `dropsIn` below tests every class against one
 * sentence, while a fleet sweep iterates PER CLASS and stops at the first hit — deliberately, since a class
 * whose instances sit late in the corpus is otherwise never tested. Those two shapes cannot share a loop, so
 * they share this instead, rather than writing the same one-character decision in two files.
 */
export const withoutSymbol = (sentence: string, re: RegExp): string => sentence.replace(re, " ");

/**
 * Are ALL occurrences of this sign inside LaTeX or template MARKUP rather than prose?
 *
 * ⚠ MARKUP IS NOT A LANGUAGE'S READING GAP. A maths article's complex-number formulas survive into an
 * artifact verbatim — `z_1z_2 = r_1r_2[cos(\alpha_1+\alpha_2)+isin(\alpha_1+\alpha_2)]\!` — and their `+` and
 * `=` get reported as defects. Nothing is read there because nothing should be: `\!` is a LaTeX thin-space
 * and `\alpha_1` a subscripted variable, and a reader voices neither.
 *
 * The test is per SIGN, not per line: a line may mix a formula with prose, and a dropped sign in the prose
 * half is still a defect. So every occurrence must be inside a markup neighbourhood for the line to be
 * excused.
 *
 * ⚠ AND THE MARKERS ARE BRACE-LESS AS OFTEN AS NOT. `\mathbb{R}` has braces and `\alpha_1`, `\!`, `\,`, `i^2`
 * do not, which is why the miner's own markup filter misses exactly these lines. Subscripts and superscripts
 * written with `_` and `^` are the giveaway that survives the dump converter.
 */
const LATEX = /\\[a-zA-Z]+|\\[!,;:]|[A-Za-z0-9)\]]_[0-9A-Za-z]|[A-Za-z0-9)\]]\^[0-9A-Za-z]/u;
export function allOccurrencesInMarkup(sentence: string, re: RegExp): boolean {
    if (!LATEX.test(sentence)) return false;
    const saved = re.lastIndex;
    re.lastIndex = 0;
    let sawOne = false;
    for (let m = re.exec(sentence); m !== null; m = re.exec(sentence)) {
        sawOne = true;
        // A window either side, because a formula's signs sit between its markers rather than beside them.
        const from = Math.max(0, m.index - 30), to = Math.min(sentence.length, m.index + m[0].length + 30);
        if (!LATEX.test(sentence.slice(from, to))) { re.lastIndex = saved; return false; }
    }
    re.lastIndex = saved;
    return sawOne;
}

/**
 * Is this symbol sitting inside a FOREIGN-LANGUAGE SPAN of a bilingual line?
 *
 * ⚠ WHY THIS IS NOT THE SAME AS THE NATIVE-SEGMENT FILTER, and why both are needed. `scripts.ts`'s
 * `isNativeSegment` discards a mined segment with no native letter at all — a wholly English article quoted
 * in a non-Latin wiki. It cannot help with a BILINGUAL segment, which is legitimately in the corpus because
 * most of it IS the language: 73 Khmer letters against 306 Latin ones, with the currency sign inside the
 * ENGLISH half. A dropped sign there is a fact about English, not about Khmer.
 *
 * The test is deliberately conservative — Latin must OUTNUMBER the native script on BOTH sides of the symbol
 * within a short window — so a native sentence that merely quotes a foreign name still counts as native. And
 * it is INERT for Latin-script languages: there `nativeRe` matches Latin, so Latin can never outnumber it.
 */
export function inForeignSpan(sentence: string, index: number, nativeRe: RegExp, window = 30): boolean {
    const side = (s: string): [number, number] => {
        let nat = 0, lat = 0;
        for (const ch of s) {
            if (nativeRe.test(ch)) nat++;
            else if (LATIN.test(ch)) lat++;
        }
        return [nat, lat];
    };
    const [ln, ll] = side(sentence.slice(Math.max(0, index - window), index));
    const [rn, rl] = side(sentence.slice(index + 1, index + 1 + window));
    return ll > ln && rl > rn && ll + rl > 0;
}
const LATIN = /\p{sc=Latn}/u;

/**
 * Do ALL occurrences of this class in the line sit in foreign-language spans? Only then is the drop not this
 * language's problem — one native-context occurrence makes it a real gap again.
 */
export function allOccurrencesForeign(sentence: string, re: RegExp, nativeRe: RegExp | undefined): boolean {
    if (nativeRe === undefined) return false;
    re.lastIndex = 0;
    const idx = [...sentence.matchAll(new RegExp(re.source, re.flags.includes("g") ? re.flags : `${re.flags}g`))]
        .map((m) => m.index);
    if (idx.length === 0) return false;
    return idx.every((i) => inForeignSpan(sentence, i, nativeRe));
}

/**
 * Is a drop of this COARSE class an already-argued silence for this language?
 *
 * ⚠ WHY THE SCAN HAS TO ASK. `DROPPABLE` is coarse — `math-sign` alone covers `+ ± × ÷ = < >` — while
 * `ACCEPTED_SIGN_SILENCE` is per SIGN. A scan consulting only the per-INSTANCE table (`ACCEPTED_SILENT`)
 * makes km's `=` simultaneously a documented refusal and a hard scan failure: two tables disagreeing about
 * the same character.
 *
 * A coarse-class drop is accepted only when EVERY sign of that class present in the line belongs to an
 * accepted class. A line mixing `=` (accepted for km) with `×` (which km reads) is still a defect, because
 * the `×` may be the one being dropped.
 */
export function acceptedSignClass(lang: string, klass: string, sentence: string): boolean {
    const accepted = ACCEPTED_SIGN_SILENCE[lang];
    if (accepted === undefined) return false;
    const present = SIGN_CASES.filter(([, , re]) => { re.lastIndex = 0; return re.test(sentence); }).map(([n]) => n);
    if (present.length === 0) return false;
    // Only the signs this coarse class actually covers are relevant.
    const covered = DROPPABLE.find(([k]) => k === klass)?.[1];
    if (covered === undefined) return false;
    const relevant = present.filter((n) => {
        const re = SIGN_CASES.find(([m]) => m === n)?.[2];
        if (re === undefined) return false;
        // does this sign's own character belong to the coarse class's set?
        const ch = [...sentence].find((c) => { re.lastIndex = 0; return re.test(c); });
        if (ch === undefined) return false;
        covered.lastIndex = 0;
        return covered.test(ch);
    });
    return relevant.length > 0 && relevant.every((n) => n in accepted);
}

/**
 * Run the differential drop test for one sentence.
 *
 * ⚠ `re.lastIndex = 0` BEFORE EVERY `.test`: these regexes are `/g/` and shared across a whole corpus loop,
 * and `RegExp.prototype.test` ADVANCES lastIndex on a hit — so the next sentence resumes mid-string and the
 * one after that starts over (`re.test(s1), re.test(s2), re.test(s1)` → true, false, true on the same
 * pattern). Without the reset a scan silently skips about half its candidate sentences.
 */
export function dropsIn(
    sentence: string,
    ipa: string,
    say: Say,
    contribution: (sym: string) => string[],
): { klass: string; redundant: boolean }[] {
    const out: { klass: string; redundant: boolean }[] = [];
    for (const [klass, re] of DROPPABLE) {
        re.lastIndex = 0;
        if (!re.test(sentence)) continue;
        // ⚠ SUBSTITUTE A SPACE, DO NOT DELETE. Deleting the symbol also changes how its NEIGHBOURS tokenize,
        // and the test then attributes that change to the symbol — worst in an agglutinative language.
        // `32℃에` reads as two tokens (*sˈɐmsibi ˈe*); delete the ℃ and `32에` agglutinates into one
        // (*sˈɐmsibie*), so the readings differ, the test concludes the ℃ contributed, and the scan reports
        // NO DEFECTS while `20℃` reads as bare *isˈip̚*. Replacing the symbol with a space holds the token
        // boundary still, so what is compared is the symbol's own contribution and nothing else.
        const without = say(withoutSymbol(sentence, re));
        if (without === undefined || without !== ipa) continue;
        const symbols = [...new Set(sentence.match(re) ?? [])];
        out.push({ klass, redundant: isRedundant(sentence, ipa, symbols, contribution, say) });
    }
    return out;
}
