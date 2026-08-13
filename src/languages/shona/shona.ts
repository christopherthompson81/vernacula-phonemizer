/**
 * Shona / chiShona (sn) phonemizer — Bantu (S10, Standard Zezuru), the Latin orthography, canonical IPA,
 * A pure greedy longest-match scan over the grapheme table (manifest.ts): Shona syllables are
 * open CV with a prenasalized cluster as a single onset unit, so no coda or syllabification logic is needed. The
 * signatures: IMPLOSIVES ⟨b d⟩→ɓ ɗ (vs breathy ⟨bh dh⟩→b̤ d̤), WHISTLED sibilants ⟨sv zv⟩→ȿ ɀ, PRENASALIZED
 * ⟨mb nd ng nz nj⟩ → ᵐb ⁿd ᵑɡ ⁿz ⁿd͡ʒ (⟨ng'⟩→ŋ). Tone (H/L) is unwritten → DEFERRED (segmental output only).
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { latinPhone } from "../../core/latinPhones.ts";
import { hostWordRun, makeNativiser } from "../../core/hostWord.ts";
import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";
import { numberToWords } from "./numbers.ts";
import { normalizeShonaPre, normalizeShonaPost } from "./normalize.ts";
import { MANIFEST, GRAPHEME_KEYS } from "./manifest.ts";

const G = MANIFEST.graphemes;
const CLAUSE_MARK = MANIFEST.clausePunctuation;

/** Phonemize a single Shona word to canonical IPA (segmental; no tone — Shona tone is unwritten). */
export function phonemizeWord(word: string): string {
    // Normalise the typographic apostrophe to ' so the ⟨ng'⟩→[ŋ] grapheme matches regardless of entry point
    // (the eval calls phonemizeWord directly, not via text()).
    const w = word.toLowerCase().replace(/’/gu, "'");
    let out = "";
    let i = 0;
    while (i < w.length) {
        let matched = false;
        for (const key of GRAPHEME_KEYS) {
            if (w.startsWith(key, i)) {
                out += G[key]!;
                i += key.length;
                matched = true;
                break;
            }
        }
        // ⚠ NOT SILENTLY: a letter with no grapheme rule here still denotes a sound, and dropping it deletes
        // what the writer typed. Consulted only on the MISS branch, after every grapheme (including every
        // digraph) has been tried, so it can never override a reading this language has an opinion about.
        if (!matched) {
            out += latinPhone(w[i]!, { initial: i === 0, includeH: true }) ?? "";
            i++;
        }
    }
    return out;
}

// A word (Shona letters + the ⟨ng'⟩ apostrophe, incl. the typographic ’) / number / punctuation token.
const TOKEN = new RegExp(`(${hostWordRun(["Latin"], "'’")})|(\\d+)|([.!?…,;:])`, "giu");

/**
 * This language's OWN inventory. ⚠ TWO DIFFERENT QUESTIONS, KEPT APART: the TOKEN class above decides where
 * the SCRIPT boundary falls (routing), while this one decides whether the g2p has rules for these letters. A
 * token this class REJECTS carries a letter the language does not use — i.e. a foreign name. See
 * core/hostWord.ts.
 */
const NATIVE_CLASS = "[a-z'’]";
const nat = makeNativiser(NATIVE_CLASS, "iu");

/**
 * The shared symbol tier. EVERY WORD BELOW IS A CORPUS OR sn.wikipedia TOKEN READ IN ITS OWN SLOT — espeak
 * ships no Shona at all and the referee is word-only, so the corpus, the mined artifact and `attest.ts` are
 * the whole in-repo haystack; the two entries that needed more say where they came from.
 *
 * · `percent` — *pazana*, 22 tokens / 20 articles, and GLOSSED AGAINST THE SIGN in both sources:
 *   *"chikamu chimwe pazana (1%), zviviri pazana (2%)"* on the wiki, *"chikamu che 71 pazana (71%)"* and
 *   *"makumi masere nemapfumbamwe kubva pazana (79%)"* in the corpus. Postposed, so no `percentPrefix`.
 *   ⚠ `muzana` IS THE HIGHER-COUNT LOSER — 56 tokens / 20 articles against 22, and it is the wrong pick
 *   because every one of its hits sits inside the frame `kubva muzana` ("out of a hundred") while the tier
 *   emits a BARE word after the number. `pazana` is the only one attested bare-postposed, which is exactly
 *   the shape produced here. Trap 37's "picking by count picks the wrong unit", one language on.
 *   ⚠ AND `peresenti` — THE WORD CHICHEWA SHIPS — IS ×0 ON sn.wikipedia. A sibling's rule, refuted.
 * · `currency` / `currencyPrefix` — *madhora* in monetary amounts and BEFORE the number: *madhora miriyoni
 *   1.1*, *madhora 5.5 miriyoni*, *madhora makumi masere emamiriyoni*, and the corpus's own gloss of the
 *   sign, *"chikwereti chezana remadhora chinonyorwa senhamba yakagon'a sezvizvi -$100"*. The singular
 *   `dhora` is ×0 on the wiki; the class-6 plural is the citation form.
 *   ⚠ `US$` NEEDS ITS OWN KEY, AND THAT IS A DIVERGENCE FROM CHICHEWA, whose file records that its corpus
 *   writes the code SPACED so a bare `$` matches. Shona GLUES it — `US$28,000`, `US$7 000`, `US$22 billion`,
 *   `US$100,000`, 4 of this corpus's 19 currency instances — and the tier's `$` key is letter-bounded on the
 *   left precisely so a code prefix is not split. Copied verbatim, nya's declaration reads none of them.
 *   ⚠ `£` IS DELIBERATELY ABSENT: `mapondo` and `pondo` are both ×0, and the sign's only two instances here
 *   are inside a quotation of Virginia Woolf. A dropped sign is missing; a wrong currency word is wrong.
 * · `units` / `unitPrefix` — a measure noun heads its phrase in Shona, in every source and without
 *   exception: *makiromita 200*, *makilomita 305*, *mamita anosvika*, *masendimita 5.5*, *matani gumi*,
 *   *maawa 2*, *mita pa sekondi*, *maskweya kiromita 1,886,068*.
 *   ⚠ `kg` IS DECLARED ON A SOURCE OUTSIDE THIS REPO, and that is worth flagging rather than burying. It is
 *   the most-written unit after km and m (8 digit-adjacent instances here) and sn.wikipedia is SILENT:
 *   `makirogiramu`, `kirogiramu` and `makiro` are all ×0, and the wiki's own substitute is `keiji`, from a
 *   self-declared neologism article this layer rejects. The word comes from JW.org's Shona corpus — a large
 *   human-translated Standard Shona body that writes *makirogiramu 34* — and it is the productive SI pattern
 *   this language already uses for the units the wiki DOES attest (`kiromita`/`makiromita`,
 *   `sendimita`/`masendimita`). Recorded here so the next reader can re-weigh it.
 *   ⚠ `cm` IS A LEAD, NOT A FINDING, and is declared anyway: `masendimita` is 1 token in 1 article on the
 *   wiki (*"anokwanisa kureba masendimita 5.5"*), which is under the article-count bar — but the same JW.org
 *   corpus writes it repeatedly (*masendimita 51,8*, *masendimita 168*) and the corpus writes `cm` 8 times.
 *   ⚠ BARE `m` IS DECLARED and the tier reads `3m`, `500m`, `1,752 m` from it. What it CANNOT read is
 *   `1.5m` — `NOT_VERSION` rejects a dotted number glued to a one-letter key — so normalize.ts step 7 claims
 *   that case locally. See its comment for the 7-against-0 measurement.
 *   `ft`, `in`, `oz`, `mi` are NOT declared: every instance is an English parenthetical glossing a metric
 *   figure already given, and `mi` only ever occurs inside `sk mi`.
 *   ⚠ `mm`, `ha` AND `l` WERE UNDECLARED AND LEAKED AS RAW ASCII (`10 mm` read *ɡumi mm*), and all three
 *   are ×0 in this corpus — which is a fact about a 439-segment artifact, not about Shona. Each is
 *   sourced on sn.wikipedia instead, and each carries its own caveat:
 *   · `mm` → *mamirimita*, 3 tokens in ONE article — a sediment-grade article that writes it three times
 *     in the measure slot against digits: *"mheu yakakura zvinosvika 4 kusvika 64 mamirimita"*, *"2
 *     kusvika 4 mamirimita dhayamita"*, *"64 kusvika 256 mamirimita dhayamita"*. One article is a LEAD by
 *     this file's own article-count rule, and what lifts it is a SECOND article carrying the same stem and
 *     naming the abbreviation: the SI-prefix article's *"masikati (mm) - haakwanise kushandiswa nekuti
 *     zvinopokana ne MILIMITA"*. ⚠ The ⟨r⟩ spelling is the Shona one and it is not a guess — `mamilimita`
 *     is ×0, exactly as `makiromita`/`masendimita` predict for a language with no /l/.
 *   · `ha` → *hekita*, 1 token / 1 article, and GLOSSED AGAINST THE SIGN in the same clause: *"Minda
 *     yeIrigesheni iyi pamwechete inema HEKITA anodarika 44 (44.4 ha)"*. ⚠ THE ATTESTED STRING IS TAKEN
 *     RATHER THAN THE ONE THIS FILE'S SYMMETRY WANTS. `inema hekita` is `ine` + `ma` + a stray space +
 *     `hekita`, and `anodarika` carries the class-6 subject prefix `a-`, so the writer plainly meant the
 *     `ma-` plural every other unit here uses — but `mahekita` is ×0 on the wiki and composing it would be
 *     asserting a token nobody wrote. `hekita` ships; the ma- reading is recorded, not taken. That is also
 *     why `ha` is absent from normalize.ts's `MA_NOUNS`.
 *   · `l` → *rita*, and the sense check is the whole of this bullet. `attest.ts` returns 10 tokens / 10
 *     articles and NINE OF THEM ARE THE PERSONAL NAME RITA (*"Rita Mpumba"*, *"Rita Makarau"*). The tenth
 *     is the litre, and it is this corpus's own already-quoted sentence: *"tarakita yangu inofamba 10km pa
 *     RITA repeturu"* — "my tractor does 10 km per litre of petrol". ⚠ THE `ma-` PLURAL IS BLOCKED BY A
 *     HOMOGRAPH: `marita` IS attested ×1 and it is **Malta** (*"Maruta (kureva Malta …) kana Marita"*).
 *     That is `churu`-was-an-anthill caught before shipping rather than after. ⚠ AND `lita` IS A TRAP THE
 *     OTHER WAY — attested ×3 and every hit is SWEDISH (*"Du kan lita på mig"*) inside a discography list.
 *     ⚠ THE HONEST LIMIT: the one Shona litre instance sits in the rate DENOMINATOR slot (`pa rita`), not
 *     the head slot. Declaring it in `units` serves both — a `units` key is matchable as a denominator too
 *     — so `10 km/l` now composes as *makiromita 10 pa rita*, which is the attested sentence exactly.
 * · `unitPer` / `rateDenominators` — *pa*, in six independent slots and glossed against the English three
 *   times: *"chiyero chinonzi mita pa sekondi (m/s)"*, *"Dendera pa Mineti (Revolutions per minute)"*,
 *   *"radian pa mineti"*, *"10km pa Rita repeturu"*, *"$5 pa Kg"*, *"US$28,000 pa tonne"*. This is the one
 *   word Chichewa found that transfers to Shona unchanged.
 * · `exponentWords` — *maskweya* / *skweya*, 5 and 38 tokens, and the position is settled by a definitional
 *   list in the geometry article: *"Nharaunda inomimwa nezviyero zvinoti: skweya remita; skweya rekiromita;
 *   skweya refutu"*. Running text writes *maskweya ekiromita 1,100,000* and *1,886,068 maskweya kiromita*.
 *   ⚠ WHAT `before` CANNOT EXPRESS is the associative concord Shona writes on the following unit —
 *   `maskweya EMAkiromita`, whose `e-` is inside the next word. The tier emits `maskweya makiromita`; the
 *   bare juxtaposition `maskweya kiromita` is itself attested twice, so the shape is right and one prefix is
 *   missing. Recorded rather than hidden.
 *   ⚠ NO `cubed`: see normalize.ts's header — trap 51's floor.
 * · `multiply` — *kuwanzana ne*, glossed FOUR TIMES in the infix slot by a Shona maths article: *"four times
 *   five inenge yonzi zvina KUWANZANA NEshanu"*, *"mbiri (2) KUWANZANA NEnhatu (3)"*, *"nhatu (3) KUWANZANA
 *   NEina"*, *"5x kureva 5 KUWANZANA NAx"*. ⚠ `attest.ts` puts all 7 tokens in ONE article, which is a lead
 *   by the article-count rule — taken anyway because it is a DEFINITIONAL article glossing the operation
 *   against both the English and the digit form four separate times, and because the 5 genuine `N x N`
 *   instances in Shona prose here currently read as bare juxtaposition. The one-article limit is the
 *   recorded caveat. No `by` word is attested, so a `4x100` relay takes the `times` reading; its 3 instances
 *   are all inside the imported English swimming table.
 * · `magnitudes` IS DELIBERATELY WITHHELD, and Shona's reason is NOT Chichewa's. nya withheld it because its
 *   corpus attests only NOUN + NUMBER + MAGNITUDE. Shona attests BOTH orders, in the same article — *madhora
 *   miriyoni 1.1* and *madhora 5.5 miriyoni* — so declaring the field would assert a preference the evidence
 *   does not support, while withholding leaves the magnitude exactly where the writer put it, which is right
 *   either way. ⚠ THE PLAYBOOK'S "one declaration, two consumers" WARNING WAS CHECKED, NOT ASSUMED: the
 *   field also gates `magAltU`, the UNIT path's connective hop, and the shape that needs it — a digit, a
 *   magnitude word, then a unit ABBREVIATION — is ×0 in this corpus. Every magnitude here is followed by a
 *   noun or a clause.
 * · `ampersand` IS NOT DECLARED — the sign's only Shona-sentence instances are HTML entities, which
 *   normalize.ts step 1 folds. Same conclusion as Chichewa, reached on Shona's own evidence.
 */
const SYMBOLS = makeSymbolNormalizer({
    percent: ["pazana"],
    currency: { "US$": ["madhora"], "$": ["madhora"] },
    currencyPrefix: true,
    units: {
        km: ["makiromita"], m: ["mamita"], cm: ["masendimita"], mm: ["mamirimita"],
        kg: ["makirogiramu"], t: ["matani"], ha: ["hekita"],
        // ⚠ BOTH CASES, the litre's documented exception to the one-letter rule (`resolveUnitSymbol`).
        l: ["rita"], L: ["rita"],
    },
    unitPrefix: true,
    unitPer: "pa",
    rateDenominators: { h: "awa", hr: "awa", hrs: "awa", s: "sekondi", min: "mineti" },
    exponentWords: { squared: ["maskweya"], position: "before" },
    multiply: { times: "kuwanzana ne" },
});

class ShonaPhonemizer implements Phonemizer {
    text(input: string): string {
        // ⚠ RULES ON BOTH SIDES OF THE TIER — the Kinyarwanda shape. Ranges and de-grouping have to reach the
        // tier already rewritten (Shona writes the unit after the SECOND operand of a range, so the tier
        // would otherwise break the pair); the decimal spell-out and the class-6 concord pass have to follow
        // it (the tier needs the digit beside its sign, and the concord pass needs to see which measure noun
        // the tier just attached). Documented at length in normalize.ts's header.
        return assembleClauses(normalizeShonaPost(SYMBOLS(normalizeShonaPre(input))), TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(nat(m[1])));
            else if (m[2])
                for (const wd of numberToWords(Number(m[2])).split(" ")) sink.emit(phonemizeWord(wd));
            else if (m[3]) {
                const mk = CLAUSE_MARK[m[3]];
                if (mk) sink.pause(mk);
            }
        });
    }
}

/** Build the Shona phonemizer (greedy rule g2p; tone deferred). */
export function createShona(): Phonemizer {
    return new ShonaPhonemizer();
}
