import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { phonemizeWord } from "../src/languages/tigrinya/tigrinya.ts";

// Canonical-IPA goldens for Tigrinya / ትግርኛ (ti) — North Ethiosemitic, the Ge'ez/Fidäl syllabary. Read by the
// SHARED Ge'ez engine (core/geez.ts, same as Amharic): flat fidel→CV lookup + epenthetic 6th-order ɨ deletion.
// Hand-adjudicated against kaikki tir (human) + epitran tir-Ethi. The SPLIT FROM AMHARIC is the preserved Semitic
// gutturals: ⟨ሐ ኀ⟩→ħ, ⟨ዐ⟩→ʕ (pharyngeals Amharic merged to h/ʔ), ⟨አ⟩→ʔ. Gemination is UNWRITTEN → single (the
// referee marks tː, folded).
describe("Tigrinya canonical IPA — Ge'ez syllabary + preserved gutturals", () => {
    test("the PHARYNGEALS — ⟨ሐ⟩→ħ, ⟨ዐ⟩→ʕ (the split from Amharic)", () => {
        expect(phonemizeWord("ሓደ")).toBe("ħadə"); // "one" — ሓ (4th order) → ħa
        expect(phonemizeWord("ዓሰርተ")).toBe("ʕasəɾtə"); // "ten" — ዓ → ʕa; ɾ tap; epenthetic ɨ deleted
        expect(phonemizeWord("ዕርዲ")).toBe("ʕɨɾdi"); // ዕ → ʕɨ (6th-order kept, breaks the cluster); ɾ tap
        expect(phonemizeWord("ትሽዓተ")).toBe("tɨʃʕatə"); // "nine" — medial ʕ
    });

    test("glottal ⟨አ⟩→ʔ, ejectives ⟨ቀ⟩→kʼ ⟨ጠ⟩→tʼ", () => {
        expect(phonemizeWord("አፍ")).toBe("ʔəf"); // ⟨አ⟩ → ʔə (glottal onset + central guttural-1st vowel, unlike Amharic)
        expect(phonemizeWord("ዕጣን")).toBe("ʕɨtʼan"); // ጠ → tʼ (ejective), ዕ → ʕɨ
        expect(phonemizeWord("ቃፍላይ")).toBe("kʼaflaj"); // ቃ → kʼa (velar ejective — the human referee's value)
    });

    test("units 1–10 (attested in the kaikki referee); epenthetic ɨ + gemination unwritten", () => {
        expect(phonemizeWord("ክልተ")).toBe("kɨltə"); // "two" — kɨl·tə (medial ɨ kept: k_lt illegal), single t
        expect(phonemizeWord("ሰለስተ")).toBe("sələstə"); // "three"
        expect(phonemizeWord("ሓሙሽተ")).toBe("ħamuʃtə"); // "five" — ħa·mu·ʃ·tə (referee ħamːuʃtɐ, gemination unwritten)
    });

    // NUMBERS — gold TEXT from Gaim, "Tigrinya Number Verbalization" (arXiv:2601.03403) Table 1 + §3.1-3.3,
    // read through the fidel g2p. Two bugs fixed here: NUM.tens is keyed by the ROUND value ("20".."90") but the
    // lookup used Math.floor(n/10) → "2".."9" → undefined, so 20-90 came out EMPTY and 21-99 lost their tens
    // word entirely; and nothing above 999 999 was composed at all (ሚልዮን / ቢልዮን were missing).
    test("numbers: units, teens (no internal ን), and the ን conjunction on 21–99", () => {
        expect(phonemize("7", "ti")).toBe("ʃəwʕatə"); // ሸውዓተ
        expect(phonemize("14", "ti")).toBe("ʕasəɾtə ʔaɾbaʕtə"); // ዓሰርተ ኣርባዕተ — a teen is ONE term, no ን
        expect(phonemize("40", "ti")).toBe("ʔaɾbʕa"); // ኣርብዓ — a 1-term chain takes no ን (was EMPTY)
        expect(phonemize("23", "ti")).toBe("ʕɨsɾan sələstən"); // ዕስራን ሰለስተን — both terms suffixed
        expect(phonemize("99", "ti")).toBe("təsʕan tɨʃʕatən"); // ተስዓን ትሽዓተን
    });

    test("numbers: the ሚእቲ / ሚእትን hundred alternation (§3.2) and the scale words", () => {
        expect(phonemize("700", "ti")).toBe("ʃəwʕatə miʔti"); // ሸውዓተ ሚእቲ — standalone hundred, multiplier bare
        expect(phonemize("309", "ti")).toBe("sələstə miʔɨtn tɨʃʕatən"); // ሰለስተ ሚእትን ትሽዓተን — compound allomorph
        expect(phonemize("1000", "ti")).toBe("ʃɨħ"); // ሽሕ — the leading ሓደ is optional and omitted
        expect(phonemize("3007", "ti")).toBe("sələstə ʃɨħn ʃəwʕatən"); // ሰለስተ ሽሕን ሸውዓተን
        expect(phonemize("12345", "ti")).toBe("ʕasəɾtə kɨltə ʃɨħn sələstə miʔɨtn ʔaɾbʕan ħamuʃtən");
        expect(phonemize("25000", "ti")).toBe("ʕɨsɾan ħamuʃtən ʃɨħ"); // ዕስራን ሓሙሽተን ሽሕ — ሽሕ standalone
        expect(phonemize("37000000", "ti")).toBe("səlasan ʃəwʕatən miljon"); // ሰላሳን ሸውዓተን ሚልዮን
        expect(phonemize("1000000000", "ti")).toBe("biljon"); // ቢልዮን
    });
});

// ── TEXT NORMALIZATION (src/languages/tigrinya/normalize.ts) ──────────────────────────────────────────
// Counts are over tools/corpus/mined/ti.jsonc — a ti.wikipedia dump artifact, 323 deduplicated lines.
// Every rule's sourcing and every refusal is argued in normalize.ts's header and in
// docs/investigations/ti/ti_normalization_investigation.md.
//
// ⚠ PIN THE RULE'S BRANCHES, NOT THE CORPUS'S INSTANCES (trap 13). The ordinal has a TABLE branch and an
// out-of-table branch; the de-grouping has a comma branch, a period branch and the comma-guard that
// separates the period grouping from a period decimal; the Ge'ez numeral rule has an additive-looking
// input and a positional-looking one. Each is pinned below, including cases the corpus does not contain.
describe("Tigrinya text normalization", () => {
    test("⚠ THE LARGEST DEFECT WAS PUNCTUATION: lone ፡ is a clause break, not a word separator", () => {
        // 998 instances in 323 lines, 910 of them spaced clause boundaries, and NONE produced a pause
        // before this rule — ፡ (U+1361) is above the letter class, outside TOKEN's punctuation branch, and
        // core/geez.ts merely split on it. This one rule is more restored pauses than the rest of the
        // layer combined.
        expect(phonemize("ኣብ 2010፡ ንኣስታት 9,000 ሰባት", "ti"))
            .toBe("ʔab kɨltə ʃɨħn ʕasəɾtən , nɨʔastat tɨʃʕatə ʃɨħ səbat");
        // The unspaced form is a list and wants the same comma (`ገጀረት፡ሰምበል፡ሰኒታ`, three Asmara districts).
        expect(phonemize("ገጀረት፡ሰምበል፡ሰኒታ", "ti")).toBe("ɡəd͡ʒəɾət , səmbəl , sənita");
        // ፡፡ and :: are the typewriter/ASCII substitutes for ። and must be a full STOP, not two commas.
        expect(phonemize("ትዋሰን፡፡ ጠቅላላ", "ti")).toBe("tɨwasən . tʼəkʼlala");
        expect(phonemize("ይረጋገጽ:: ብርግጽ", "ti")).toBe("jɨɾəɡaɡət͡sʼ . bɨɾɨɡt͡sʼ");
    });

    test("⚠ ETHIOPIC NUMERALS read as the EMPTY STRING — the ug/bal defect in Ge'ez", () => {
        // U+1369–U+137C is outside [ሀ-ፚ], is not \p{Nd}, and is not punctuation, so 20 instances reached
        // NO branch of TOKEN: `፻፲ ኪሎሜተር` read *kilometəɾ* with the number simply gone.
        expect(phonemize("፻፲ ኪሎሜተር", "ti")).toBe("miʔti ʕasəɾtə kilometəɾ");
        // ⚠ CHARACTER-WISE, NOT ARITHMETIC. ti.wikipedia glosses `ሓሙሽተ ሚእቲ ቁጽሪ ፭፻።` — ፭፻ read as its two
        // characters' words, which is exactly what this emits.
        expect(phonemize("፭፻", "ti")).toBe("ħamuʃtə miʔti");
        // BOTH BRANCHES, and the corpus writes both: ፻፲ is proper additive Ge'ez for 110, while ፩፱፱፱ is
        // the digits 1-9-9-9 typed one glyph apiece for 1999. An evaluator would read the second as
        // 1+9+9+9 = 28. Nothing in the text separates them, so neither is evaluated.
        expect(phonemize("፻፲", "ti")).toBe("miʔti ʕasəɾtə");
        expect(phonemize("፩፱፱፱", "ti")).toBe("ħadə tɨʃʕatə tɨʃʕatə tɨʃʕatə");
    });

    test("ordinals: Tigrinya's Nይ, and NOT Amharic's ኛ (×0 here)", () => {
        // am's ኛ suffix and its whole consonant-final-cardinal morphology have ZERO instances in ti, which
        // has a Semitic pattern series instead. `6ይ` read as `ʃɨdʃtə jɨ` — cardinal plus an orphan syllable.
        expect(phonemize("6ይ ፕረዚደንት", "ti")).toBe("ʃadʃaj pɨɾəzidənt"); // ሻድሻይ
        expect(phonemize("2ይቲ ኮይና", "ti")).toBe("kalʔajti kojna"); // ካልኣይቲ — the feminine tail survives
        expect(phonemize("9ይን 10ይን", "ti")).toBe("taʃʕajn ʕasɾajn"); // the ን conjunction tail survives
        // THE GE'EZ-NUMERAL SPELLING OF THE SAME THING — `፮ይ ክፍሊ`, "sixth grade". Claimed by the ordinal
        // step, not by the numeral step, which would otherwise leave the ይ behind.
        expect(phonemize("፮ይ ክፍሊ", "ti")).toBe("ʃadʃaj kɨfli");
        // ⚠ THE OUT-OF-TABLE BRANCH, which the corpus does not exercise: every `Nይ` here is 1–10, and a
        // higher value is LEFT ALONE rather than composed, because `መበል N` is the above-ten form.
        expect(phonemize("መበል 16", "ti")).toBe("məbəl ʕasəɾtə ʃɨdʃtə"); // already correct with no rule
    });

    test("⚠ ti GROUPS WITH THE PERIOD AS WELL AS THE COMMA — and the guard is per-number", () => {
        expect(phonemize("1,600", "ti")).toBe("ʃɨħn ʃɨdʃtə miʔɨtn"); // was "one , six hundred"
        // 4 of the 5 `\d.\d{3}` instances are thousands separators — `200.000 ሰባት` read as
        // "two hundred . zero", a sentence STOP mid-number plus the word for zero.
        expect(phonemize("200.000", "ti")).toBe("kɨltə miʔti ʃɨħ");
        // ⚠ THE FIFTH IS A DECIMAL, and it is the one number that ALREADY CARRIES A COMMA GROUP — a number
        // cannot use both marks for the same job. Pinned STANDALONE, so the guard is proved to be
        // per-number and not per-string: a paragraph mentioning one comma-grouped figure must not disable
        // the period rule for another number beside it.
        expect(phonemize("1,741.980", "ti"))
            .toBe("ʃɨħn ʃəwʕatə miʔɨtn ʔaɾbʕan ħadən nətʼbi tɨʃʕatə ʃəmontə zeɾo");
        expect(phonemize("ኣብ 312,696 ከምኡውን 200.000 ሰባት", "ti"))
            .toBe("ʔab sələstə miʔɨtn ʕasəɾtə kɨltən ʃɨħn ʃɨdʃtə miʔɨtn təsʕan ʃɨdʃtən kəmʔuwn kɨltə miʔti ʃɨħ səbat");
        // A two-digit fraction is untouched and stays a decimal.
        expect(phonemize("1.24", "ti")).toBe("ħadə nətʼbi kɨltə ʔaɾbaʕtə");
    });

    test("⚠ …AND IT POINTS WITH THE COMMA TOO — the other half of the same argument", () => {
        // Of the 67 `\d,\d` instances in the artifact, 62 are three-digit thousands groups (step 6) and
        // FIVE are decimals. Every one of the five used to emit a CLAUSE PAUSE inside the number and read
        // the fraction as a whole number: a confidently wrong quantity, not a drop.
        expect(phonemize("2,5 ሜ.", "ti")).toBe("kɨltə nətʼbi ħamuʃtə me ."); // was *kɨltə , ħamuʃtə*
        expect(phonemize("99,7%", "ti")).toBe("təsʕan tɨʃʕatən nətʼbi ʃəwʕatə miʔtawit");
        expect(phonemize("ኣስታት 2,5 ሚልዮን", "ti")).toBe("ʔastat kɨltə nətʼbi ħamuʃtə miljon");
        // ⚠ THE TWO MARKS READ IDENTICALLY, which is the property the split is for: a leading zero can
        // never be a thousands group, so step 6 declines `0,001` and step 10 must claim it.
        expect(phonemize("0,001 ግራም", "ti")).toBe(phonemize("0.001 ግራም", "ti"));
        expect(phonemize("0,001 ግራም", "ti")).toBe("zeɾo nətʼbi zeɾo zeɾo ħadə ɡɨɾam");
        // ⚠ AND THE THOUSANDS GROUP MUST NOT MOVE. Three digits is still a group, both marks, including
        // the one number in the artifact that carries both — its comma is spent by step 6 and only the
        // period survives to become the point.
        expect(phonemize("1,600", "ti")).toBe("ʃɨħn ʃɨdʃtə miʔɨtn");
        expect(phonemize("1,741.980", "ti"))
            .toBe("ʃɨħn ʃəwʕatə miʔɨtn ʔaɾbʕan ħadən nətʼbi tɨʃʕatə ʃəmontə zeɾo");
        // A SPACED pair is a list and cannot match — the fraction has to be digit-adjacent.
        expect(phonemize("ኣብ 2010, 2011", "ti")).toBe("ʔab kɨltə ʃɨħn ʕasəɾtən , kɨltə ʃɨħn ʕasəɾtə ħadən");
    });

    test("percent, currency and the decimal point", () => {
        // ሚእታዊት: this corpus ×2, ti.wikipedia ×2, and Gaim (arXiv:2601.03403) Table 1 — the paper this
        // manifest already cites for its cardinals. POSTPOSED. The fraction is read one digit at a time.
        expect(phonemize("48.33%", "ti")).toBe("ʔaɾbʕan ʃəmontən nətʼbi sələstə sələstə miʔtawit");
        // The magnitude list is load-bearing: without it the currency noun lands before the magnitude.
        expect(phonemize("ብ1.65 ቢልዮን ዶላር", "ti")).toBe("bɨ ħadə nətʼbi ʃɨdʃtə ħamuʃtə biljon dolaɾ");
        expect(phonemize("$17 ሚልዮን", "ti")).toBe("ʕasəɾtə ʃəwʕatə miljon dolaɾ");
        expect(phonemize("800 ፓውንድ", "ti")).toBe("ʃəmontə miʔti pawɨnd");
    });

    test("era markers, dotted abbreviations, units and the degree sign", () => {
        // The era phrases are the CORPUS'S OWN WORDS — `ቅድሚ ልደተ ክርስቶስ` is written out in full ×12 here.
        // Expanded BEFORE the generic dot-stripping, which would otherwise leave the letter-run `ቅልክ`.
        expect(phonemize("7ይ ቅ.ል.ክ", "ti")).toBe("ʃawʕaj kʼɨdmi lɨdətə kɨɾstos");
        expect(phonemize("ድ.ል.ክ", "ti")).toBe("dɨħɾi lɨdətə kɨɾstos");
        // ኪ.ሜ ×15; the corpus writes the word out ×6, so the expansion is sourced rather than invented.
        expect(phonemize("224 ኪ.ሜ", "ti")).toBe("kɨltə miʔɨtn ʕɨsɾan ʔaɾbaʕtən kilo metəɾ");
        expect(phonemize("ኪ.ሜ ንታሕቲ", "ti")).toBe("kilo metəɾ nɨtaħti"); // fires with no adjacent number
        // ትርብዒት PRECEDES the unit (corpus ×7, wiki ×11) and must be claimed before the plain ኪሜ expansion.
        expect(phonemize("26.990 ኪ.ሜ2", "ti"))
            .toBe("ʕɨsɾan ʃɨdʃtən ʃɨħn tɨʃʕatə miʔɨtn təsʕan tɨɾbʕit kilo metəɾ");
        expect(phonemize("6°54′ ሰሜን", "ti")).toBe("ʃɨdʃtə diɡɨɾi ħamsan ʔaɾbaʕtən səmen");
    });

    test("the clock is claimed on ፡ ONLY, and the range only in the ካብ frame", () => {
        // ⚠ THE NARROWNESS IS THE RULE, and it is where am's step 6 fails re-measurement. ti's only ASCII
        // `d:dd` in 323 lines is a SCRIPTURE CITATION (surah 21 verse 10), so keying on `:` would give one
        // false positive and no true ones; keying on ፡ gives one true and none false. `፡00` is the whole
        // hour, and no ሰዓት is inserted because the text already supplies it.
        expect(phonemize("ሰዓት 10፡00 ቅድሚ ቐትሪ", "ti")).toBe("səʕat ʕasəɾtə kʼɨdmi kʼətɨɾi");
        expect(phonemize("21:10", "ti")).toBe("ʕɨsɾan ħadən , ʕasəɾtə"); // the citation, deliberately unclaimed
        // The frame is not invented: the corpus writes `ካብ N ክሳብ M` out in full 15 times.
        expect(phonemize("ካብ 51-70 ኪ.ሜ", "ti")).toBe("kab ħamsan ħadən kɨsab səbʕa kilo metəɾ");
        // ⚠ AND THE RESTRICTION IS THE RULE: 22 of the 27 hyphenated digit pairs are year spans, scores or
        // designations, none of which may become "from…to". They stay two adjacent numbers with no pause.
        expect(phonemize("1937-1938", "ti"))
            .toBe("ʃɨħn tɨʃʕatə miʔɨtn səlasan ʃəwʕatən ʃɨħn tɨʃʕatə miʔɨtn səlasan ʃəmontən");
    });
});

// The silent-deletion finding in ti, and the systematic hole it turned out to be.
// Evidence: docs/investigations/normalization/silent_sea_investigation.md Run 6.
describe("Tigrinya (ti) — the labiovelar orders", () => {
    /**
     * ⚠ THREE OF THE SIX LABIOVELAR SUB-SERIES WERE INCOMPLETE, AND WHAT WAS PRESENT WAS OFF BY ONE ORDER.
     * `silentCharsIn` reported ⟨ኲ⟩ U+12B2 ×28 and ⟨ቊ⟩ U+124A ×6 as inert — a fidel with no row reads as
     * nothing, so `ኲናት` ("war") came out `nat`, a whole syllable gone. Enumerating the block showed the
     * shape: KXW ⟨ዀ ዂ ዃ ዄ ዅ⟩ and QHW ⟨ቘ ቚ ቛ ቜ ቝ⟩ are complete and correct, while QW/KW/GW held only three
     * of five each AND mapped their 1st-order member to the 5th order's vowel.
     *
     * The 1st order is /ə/ throughout this very table (ሀ hə, ሰ sə, and the labiovelars ዀ xʷə, ቘ kʼʷə) and
     * the 5th is /e/ (ሄ he) — so ቈ/ኰ/ጐ reading `kʼʷe`/`kʷe`/`ɡʷe` was internally contradicted by the file
     * itself. The epitran tir-Ethi referee agrees on all three: `ቈለ qʷələ`, `ኰርኰረ kʷərɨkʷərə`,
     * `ተርጐመ tərɨɡʷəmə`.
     */
    test("⟨ኲ ቊ⟩ have rows at all — a fidel with no row deletes its whole syllable", () => {
        expect(phonemizeWord("ኲናት")).toBe("kʷinat"); // 'war' — was *nat*
        expect(phonemizeWord("ቊጽሪ")).toBe("kʼʷit͡sʼɨɾi"); // 'number' — was *t͡sʼɨɾi*
        expect(phonemizeWord("ቱርኲ")).toBe("tuɾkʷi"); // Turkey — was *tuɾ*
    });

    test("the 1st-order labiovelar is /ʷə/, not /ʷe/ — ⟨ቈ ኰ ጐ⟩ were an order out", () => {
        expect(phonemizeWord("ቈለ")).toBe("kʼʷələ"); // referee: qʷələ
        expect(phonemizeWord("ኰርኰረ")).toBe("kʷəɾkʷəɾə"); // referee: kʷərɨkʷərə
        expect(phonemizeWord("ተርጐመ")).toBe("təɾɡʷəmə"); // referee: tərɨɡʷəmə
        // ⚠ And the orders that were already right must stay right: 4th ⟨ʷa⟩, 6th ⟨ʷɨ⟩.
        expect(phonemizeWord("ቋንቋ")).toBe("kʼʷankʼʷa"); // 'language'
    });
});
