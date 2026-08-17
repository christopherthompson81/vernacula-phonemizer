import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { phonemizeWord } from "../src/languages/german/german.ts";

// Canonical-IPA goldens for Standard German (de). Rule-based g2p (long/short vowels from
// spelling, diphthongs aɪ̯/aʊ̯/ɔʏ̯, ch ich-/ach-laut, sch, sp-/st-→ʃ, final devoicing, r-vocalization ɐ̯,
// schwa in weak endings) + mostly-Germanic stress (first syllable, or after an unstressed prefix) with a
// kaikki stress lexicon for loanwords. Stress mark is placed before the stressed VOWEL (repo convention).
describe("german canonical IPA", () => {
    test("vowel length + schwa endings + r-vocalization", () => {
        expect(phonemizeWord("Vater")).toBe("fˈaːtɐ"); // long aː (single C), -er → ɐ
        expect(phonemizeWord("Wasser")).toBe("vˈasɐ"); // short a (double s → single), -er → ɐ
        expect(phonemizeWord("machen")).toBe("mˈaxən"); // -en → ə
        expect(phonemizeWord("über")).toBe("ˈyːbɐ");
        expect(phonemizeWord("lieben")).toBe("lˈiːbən"); // ie → iː
        expect(phonemizeWord("sehen")).toBe("zˈeːən"); // silent h, s → z
        expect(phonemizeWord("Hamburg")).toBe("hˈambʊɐ̯k"); // coda r → ɐ̯, final g → k
        expect(phonemizeWord("das")).toBe("das"); // short function-word monosyllable
    });

    test("ch split, sch, sp/st, diphthongs, devoicing", () => {
        expect(phonemizeWord("ich")).toBe("ɪç"); // ich-laut
        expect(phonemizeWord("Buch")).toBe("buːx"); // ach-laut, long u
        expect(phonemizeWord("König")).toBe("kˈøːnɪç"); // -ig → ɪç
        expect(phonemizeWord("Straße")).toBe("ʃtʁˈaːsə"); // st- → ʃt, ß → s
        expect(phonemizeWord("Zeit")).toBe("t͡saɪ̯t"); // z → t͡s, ei → aɪ̯
        expect(phonemizeWord("Deutschland")).toBe("dˈɔʏ̯t͡ʃlant"); // eu → ɔʏ̯, tsch → t͡ʃ, final d → t
        expect(phonemizeWord("Häuser")).toBe("hˈɔʏ̯zɐ"); // äu → ɔʏ̯
        expect(phonemizeWord("müssen")).toBe("mˈʏsən"); // short ü → ʏ (the census primitive)
        expect(phonemizeWord("Tag")).toBe("taːk"); // final devoicing g → k
        expect(phonemizeWord("Hund")).toBe("hʊnt");
    });

    test("prefix reduction, sp/st after prefix", () => {
        expect(phonemizeWord("gemacht")).toBe("ɡəmˈaxt"); // ge- prefix → ə
        expect(phonemizeWord("bestimmt")).toBe("bəʃtˈɪmt"); // be- → ə, st after prefix → ʃt
        expect(phonemizeWord("gehen")).toBe("ɡˈeːən"); // ge- ROOT not reduced (stress on first)
    });

    test("morphology: compound + affix boundary phonology", () => {
        // Compound seams reset element-initial context (sp/st→ʃ), devoice the preceding stem, and block assimilation.
        expect(phonemizeWord("Laubsturm")).toBe("lˈaʊ̯pʃtʊɐ̯m"); // st→ʃt at seam, b→p devoiced
        expect(phonemizeWord("Warenkorb")).toBe("vˈaːʁənkɔɐ̯p"); // n·k NOT assimilated to ŋ
        expect(phonemizeWord("aufstehen")).toBe("ˈaʊ̯fʃteːən"); // separable prefix stressed, st→ʃt
        expect(phonemizeWord("verstehen")).toBe("fəɐ̯ʃtˈeːən"); // ver- → fə here (kaikki reduction lexicon; cf. vergessen fɛɐ̯ — per-word)
        expect(phonemizeWord("freundlich")).toBe("fʁˈɔʏ̯ntlɪç"); // -lich suffix, d→t devoiced at boundary
        expect(phonemizeWord("Zeitung")).toBe("t͡sˈaɪ̯tʊŋ"); // -ung
        // Vowel-initial inflection resyllabifies (no boundary): lieben not lieb·en, Häuser not häus·er.
        expect(phonemizeWord("lieben")).toBe("lˈiːbən"); // b stays (not devoiced)
        expect(phonemizeWord("Häuser")).toBe("hˈɔʏ̯zɐ"); // s → z (onset), not final s
    });

    test("flag-driven decomposition: linking-s, false-prefix guards", () => {
        expect(phonemizeWord("Zeitungsartikel")).toBe("t͡sˈaɪ̯tʊŋsaɐ̯tiːkəl"); // Fugen-s via the s flag
        expect(phonemizeWord("Geburtstag")).toBe("ɡəbˈuːɐ̯tstaːk"); // geburts·tag; ge- reduces to ə (kaikki ɡəˈbuːɐ̯tstaːk)
        expect(phonemizeWord("beiden")).toBe("bˈaɪ̯dən"); // NOT be·iden (iden isn't a word)
        expect(phonemizeWord("beten")).toBe("bˈeːtən"); // be- ROOT, dict-stressed on first
        expect(phonemizeWord("bestimmt")).toBe("bəʃtˈɪmt"); // real be- prefix (dict stress ord 1)
        // splittability test: a consonant-initial suffix is only stripped if the stem resolves.
        expect(phonemizeWord("Möglichkeit")).toBe("mˈøːɡlɪçkaɪ̯t"); // möglich·keit (möglich is a word)
        expect(phonemizeWord("endlich")).toBe("ˈɛndlɪç"); // NOT end·lich (end isn't a word)
    });

    test("the ⟨hör⟩ root keeps its h after a prefix (gehör, behörde)", () => {
        expect(phonemizeWord("gehör")).toBe("ɡəhˈøːɐ̯"); // ge+hör: h is a real onset (was dropped)
        expect(phonemizeWord("Behörde")).toBe("bəhˈøːɐ̯də");
        expect(phonemizeWord("gehen")).toBe("ɡˈeːən"); // control: silent lengthening h stays silent
        expect(phonemizeWord("fröhlich")).toBe("fʁˈøːlɪç"); // control: öh (not hö) stays silent
    });

    test("\"mit\" prefix needs a real-word stem (mittel not mit·tel)", () => {
        expect(phonemizeWord("mittelmäßig")).toBe("mˈɪtəlmɛsɪç"); // mittel·mäßig: tt collapses (was mit·telmäßig → ɪttəl)
        expect(phonemizeWord("mitteilen")).toBe("mˈɪttaɪ̯lən"); // control: real mit·teilen (teilen is a word)
    });

    test("negation un- before a prefix blocks the ng→ŋ merge (ungefähr)", () => {
        expect(phonemizeWord("ungefähr")).toBe("ˈʊnɡəfɛːɐ̯"); // un·ge → nɡ (not ŋ), un → ʊn
        expect(phonemizeWord("Union")).toBe("uːni̯ˈoːn"); // control: un+ion NOT split (ion after un isn't a prefix)
        expect(phonemizeWord("Universität")).toBe("ʊnifɛʁzitˈɛːt"); // control: not un-prefixed
    });

    test("monomorphemic ge-/er-+st keeps alveolar st (gestern, erst)", () => {
        expect(phonemizeWord("gestern")).toBe("ɡˈɛstɐn"); // NOT ge·stern → ʃt
        expect(phonemizeWord("erst")).toBe("eːɐ̯st");
        expect(phonemizeWord("Gestein")).toBe("ɡəʃtˈaɪ̯n"); // control: real ge- prefix → ʃt
        expect(phonemizeWord("erstaunen")).toBe("ɛɐ̯ʃtˈaʊ̯nən"); // control: real er- prefix → ʃt
    });

    test("particle-verb seam splits (fest·stellen → st → ʃt)", () => {
        expect(phonemizeWord("feststellen")).toBe("fˈɛstʃtɛlən"); // fest·stellen: seam st → ʃt
        expect(phonemizeWord("klarstellen")).toBe("klˈaːɐ̯ʃtɛlən");
        expect(phonemizeWord("schreiben")).toBe("ʃʁˈaɪ̯bən"); // control: simplex verb stays whole (no seam)
        expect(phonemizeWord("Klarinette")).toBe("klaʁinˈɛtə"); // control: klar+inette NOT split (inette not a constituent)
    });

    test("doubled voiced obstruent collapses before devoicing (Krabbe → kʁabə)", () => {
        expect(phonemizeWord("Krabbe")).toBe("kʁˈabə"); // bb → b (was wrongly kʁapbə)
        expect(phonemizeWord("Widder")).toBe("vˈɪdɐ"); // dd → d
        expect(phonemizeWord("Smaragd")).toBe("smaʁˈakt"); // control: real coda cluster gd → kt still devoices
    });

    test("loanword full unstressed vowel (ə → ɛ/e), native schwa protected", () => {
        expect(phonemizeWord("Talent")).toBe("talˈɛnt"); // loanword -ent → ɛ (was ə)
        expect(phonemizeWord("Dokument")).toBe("dɔkumˈɛnt");
        expect(phonemizeWord("machen")).toBe("mˈaxən"); // control: native weak-schwa stays ə
        expect(phonemizeWord("gemacht")).toBe("ɡəmˈaxt"); // control: native ge- prefix stays ə
    });

    test("word-final French -eur → øːɐ̯ (not the ɔʏ̯ diphthong)", () => {
        expect(phonemizeWord("Friseur")).toBe("fʁizˈøːɐ̯"); // -eur loan suffix → øːɐ̯
        expect(phonemizeWord("Amateur")).toBe("amatˈøːɐ̯");
        expect(phonemizeWord("Steuer")).toBe("ʃtˈɔʏ̯ɐ"); // control: -euer is eu+er → diphthong stays
    });

    test("unstressed uː/oː lax to ʊ/ɔ (Latinate -ium/-um)", () => {
        expect(phonemizeWord("Aluminium")).toBe("aːluːmˈiːni̯ʊm"); // -ium → ʊm (was uːm)
        expect(phonemizeWord("Zentrum")).toBe("t͡sˈɛntʁʊm"); // -um → ʊm
        expect(phonemizeWord("Buch")).toBe("buːx"); // control: STRESSED uː stays long (build skips stressed)
    });

    test("-nis suffix devoices a bound stem's final obstruent", () => {
        expect(phonemizeWord("Bündnis")).toBe("bˈʏntnɪs"); // bünd·nis: d → t at the boundary
        expect(phonemizeWord("Ergebnis")).toBe("ɛɐ̯ɡˈeːpnɪs"); // ergeb·nis: b → p
        expect(phonemizeWord("Tennis")).toBe("tˈɛnɪs"); // control: monomorphemic (sonorant stem) → NOT split
    });

    test("-er restore before consonant lexicon unblocks loanword v→v", () => {
        expect(phonemizeWord("universal")).toBe("univɛʁzˈaːl"); // v now lands (was f) — ʁ inserted before applyConsonant
        expect(phonemizeWord("Vater")).toBe("fˈaːtɐ"); // control: native ⟨v⟩ → f unchanged
    });

    test("loanword -er restoration lexicon (unstressed ɐ → ɛʁ)", () => {
        expect(phonemizeWord("Adverb")).toBe("ˈatfɛʁp"); // loanword unstressed -er → ɛʁ (was ɐ)
        expect(phonemizeWord("Expertise")).toBe("ɛkspɛʁtˈiːzə");
        expect(phonemizeWord("Wasser")).toBe("vˈasɐ"); // control: native -er stays reduced ɐ
        expect(phonemizeWord("Wanderer")).toBe("vˈandəʁɐ"); // control: native medial -er (ə/ɐ), not restored
    });

    test("unstressed i in medial hiatus → glide i̯ (Latinate -iVC-)", () => {
        expect(phonemizeWord("Union")).toBe("uːni̯ˈoːn"); // -ion → i̯oːn
        expect(phonemizeWord("genial")).toBe("ɡeni̯ˈaːl"); // -ial → i̯aːl
        expect(phonemizeWord("Material")).toBe("maːteːʁi̯ˈaːl");
        expect(phonemizeWord("Liberia")).toBe("libˈeːʁia"); // control: word-final -iV# stays syllabic
    });

    test("recurse into a prefixed compound constituent (wahn·vor·stellung)", () => {
        expect(phonemizeWord("Wahnvorstellung")).toBe("vˈaːnfoːɐ̯ʃtɛlʊŋ"); // inner vor·stellung → st → ʃt
        expect(phonemizeWord("Vorstellung")).toBe("fˈoːɐ̯ʃtɛlʊŋ"); // control: standalone still correct
        expect(phonemizeWord("Donaudampfschiff")).toBe("dˈoːnaʊ̯dampfʃɪf"); // control: unaffected compound
    });

    test("a STRESSED bare ɐ is a wrongly-reduced -er → ɛʁ", () => {
        expect(phonemizeWord("Laterne")).toBe("latˈɛʁnə"); // stressed -er → ɛʁ (was ɐ)
        expect(phonemizeWord("Inferno")).toBe("ɪnfˈɛʁno");
        expect(phonemizeWord("Wasser")).toBe("vˈasɐ"); // control: UNSTRESSED -er stays reduced ɐ
    });

    test("vocalized coda-r ɐ̯ holds a consonant slot (unblocks the lexicon)", () => {
        expect(phonemizeWord("Marge")).toBe("mˈaɐ̯ʒə"); // ʒ correction now lands (was skew-blocked by the r)
        expect(phonemizeWord("Vater")).toBe("fˈaːtɐ"); // control: native word, corrections unchanged
    });

    test("French -age/-ge loans: g → ʒ", () => {
        expect(phonemizeWord("Garage")).toBe("ɡaʁˈaːʒə"); // -age loan → ʒ
        expect(phonemizeWord("Etage")).toBe("etˈaːʒə");
        expect(phonemizeWord("Regen")).toBe("ʁˈeːɡən"); // control: native ⟨g⟩ stays ɡ
    });

    test("unstressed Latinate -ie/-ien suffix → i̯ə/i̯ən", () => {
        expect(phonemizeWord("Familie")).toBe("famˈiːli̯ə"); // unstressed -ie → i̯ə
        expect(phonemizeWord("Ferien")).toBe("fˈeːʁi̯ən"); // -ien → i̯ən
        expect(phonemizeWord("Melodie")).toBe("melodˈiː"); // final-STRESSED loan → iː (restore post-pass)
        expect(phonemizeWord("Knie")).toBe("kniː"); // control: monosyllable (no preceding vowel) → iː
    });

    test("voiced obstruent devoices before ç/x/ʃ", () => {
        expect(phonemizeWord("Mädchen")).toBe("mˈɛːtçən"); // d before ç (ch) → t
        expect(phonemizeWord("Bildchen")).toBe("bˈɪltçən"); // control: cross-boundary case still devoices
    });

    test("long ä is always ɛː (never eː)", () => {
        expect(phonemizeWord("Ärzte")).toBe("ˈɛːɐ̯t͡stə"); // cluster-preceded long ä → ɛː (not eː)
        expect(phonemizeWord("Gespräch")).toBe("ɡəʃpʁˈɛːç");
        expect(phonemizeWord("Hätte")).toBe("hˈɛtə"); // control: genuinely-short ä → ɛ (marker normalised)
        expect(phonemizeWord("Käse")).toBe("kˈɛːzə"); // control: open-syllable long ä unaffected
    });

    test("recurse into a known constituent (triple compound seam)", () => {
        expect(phonemizeWord("Waffenstillstand")).toBe("vˈafənʃtɪlʃtant"); // waffen·still·stand: inner st → ʃt
        expect(phonemizeWord("Landstraße")).toBe("lˈantʃtʁaːsə"); // control: 2-part still splits
    });

    test("-igkeit: ⟨g⟩ between i and k → ç", () => {
        expect(phonemizeWord("Geschwindigkeit")).toBe("ɡəʃvˈɪndɪçkaɪ̯t"); // -igk- → ɪçk
        expect(phonemizeWord("Iglu")).toBe("ˈiːɡlu"); // control: igl (not igk) → ɡl
    });

    test("unstressed -igen i → ɪ (stressed iː protected)", () => {
        expect(phonemizeWord("würdigen")).toBe("vˈʏɐ̯dɪɡən"); // -ig- unstressed → ɪ (was long iːɡ)
        expect(phonemizeWord("Liga")).toBe("lˈiːɡa"); // control: STRESSED iː stays long (build skips stressed)
    });

    test("mid-compound reduction recovered (kaikki syllabic n̩ expanded)", () => {
        expect(phonemizeWord("Christentum")).toBe("kʁˈɪstəntuːm"); // christen·tum: -en → ə (was ɛ)
        expect(phonemizeWord("Heidelbeere")).toBe("hˈaɪ̯dəlbeːʁə"); // heidel- -el → ə
    });

    test("split ordering: prefer the whole-word lexeme (schreib·en not schrei·ben)", () => {
        expect(phonemizeWord("schreiben")).toBe("ʃʁˈaɪ̯bən"); // known verb → schreib·en, not the schrei·ben compound
        expect(phonemizeWord("Waldsterben")).toBe("vˈaltʃtɛɐ̯bən"); // control: a non-lexeme compound still splits
    });

    test("loanword consonants (v→v, s→s), native unchanged", () => {
        expect(phonemizeWord("Vase")).toBe("vˈaːzə"); // LOANWORD ⟨v⟩ → v
        expect(phonemizeWord("Pseudonym")).toBe("psɔʏ̯donˈyːm"); // loanword initial ⟨s⟩ → s (not z)
        expect(phonemizeWord("Vater")).toBe("fˈaːtɐ"); // control: NATIVE ⟨v⟩ → f
        expect(phonemizeWord("Sonne")).toBe("zˈɔnə"); // control: native initial ⟨s⟩ → z
    });

    test("split ranking: don't shatter ⟨sch⟩ (…schen verb, not raus·chen)", () => {
        expect(phonemizeWord("rauschen")).toBe("ʁˈaʊ̯ʃən"); // rausch·en (sch = ʃ), NOT raus·chen (s+ç)
        expect(phonemizeWord("waschen")).toBe("vˈaʃən");
        expect(phonemizeWord("Tuch")).toBe("tuːx"); // control: ⟨ch⟩ unaffected
    });

    test("word-initial ch (ç/k) + coda-cluster final devoicing", () => {
        expect(phonemizeWord("China")).toBe("çˈiːna"); // initial ch + front vowel → ç
        expect(phonemizeWord("Christ")).toBe("kʁɪst"); // initial ch + consonant → k
        expect(phonemizeWord("Chaos")).toBe("kˈaːɔs"); // initial ch + back vowel → k
        expect(phonemizeWord("Milch")).toBe("mɪlç"); // control: mid/final ich-laut ç unaffected
        expect(phonemizeWord("Smaragd")).toBe("smaʁˈakt"); // coda cluster gd → kt (both devoice)
        expect(phonemizeWord("Adler")).toBe("ˈaːdlɐ"); // control: d before a sonorant stays voiced
    });

    test("compound-split retry after a suffix strip (fires the seam st→ʃt)", () => {
        expect(phonemizeWord("Waldsterben")).toBe("vˈaltʃtɛɐ̯bən"); // wald·sterben: seam st→ʃt (was waldsterb·en)
        expect(phonemizeWord("leben")).toBe("lˈeːbən"); // control: a simple -en word is NOT wrongly compound-split
    });

    test("unstressed loanword vowel tensing (lax → tense, kaikki-derived quality lexicon)", () => {
        expect(phonemizeWord("November")).toBe("nofˈɛmbɐ"); // ɔ → o
        expect(phonemizeWord("digital")).toBe("diɡitˈaːl"); // ɪ → i (×2)
        expect(phonemizeWord("Dezember")).toBe("det͡sˈɛmbɐ"); // ɛ → e
        expect(phonemizeWord("Plural")).toBe("pluʁˈaːl"); // ʊ → u
    });

    test("no stressed schwa (weak-schwa mis-fire on a stressed root → ɛ, lengthened where flagged)", () => {
        expect(phonemizeWord("gesetz")).toBe("ɡəzˈɛt͡s"); // setz is the stressed root, not a schwa ending
        expect(phonemizeWord("generell")).toBe("ɡenəʁˈɛl");
        expect(phonemizeWord("Problem")).toBe("pʁoblˈeːm"); // ɛ→eː (length 1L) + unstressed ɔ→o (quality lexicon)
        expect(phonemizeWord("machen")).toBe("mˈaxən"); // control: genuine unstressed -en schwa unaffected
    });

    test("unstressed e→ə reduction (lexical: native ə, loanword ɛ)", () => {
        expect(phonemizeWord("wesentlich")).toBe("vˈeːzəntlɪç"); // native: -ent- e → ə
        expect(phonemizeWord("anderen")).toBe("ˈandəʁən"); // native: -er- e → ə
        expect(phonemizeWord("helikopter")).toBe("helikˈɔptɐ"); // LOANWORD: unstressed e/i TENSE (quality lexicon), not reduced to ə
    });

    test("Latin -tion/-tial suffix (ti + o/a → t͡si̯), native -tie unaffected", () => {
        expect(phonemizeWord("Aktion")).toBe("akt͡si̯ˈoːn"); // ti + o → t͡si̯
        expect(phonemizeWord("Nation")).toBe("naːt͡si̯ˈoːn");
        expect(phonemizeWord("Garantie")).toBe("ɡaʁantˈiː"); // word-final -tie (ie digraph) → tiː, NOT t͡si̯
        expect(phonemizeWord("Studie")).toBe("ʃtˈuːdi̯ə"); // unstressed -ie suffix → i̯ə; ⟨di⟩ not ⟨ti⟩ — unaffected
    });

    test("numbers + text", () => {
        expect(phonemize("21", "de")).toBe("ˈaɪ̯nʊntt͡svant͡sɪç"); // einundzwanzig
        expect(phonemize("100", "de")).toBe("ˈaɪ̯nhʊndɐt"); // einhundert
        expect(phonemize("Ich wohne in Berlin.", "de")).toBe(
            "ɪç vˈoːnə ɪn bɛɐ̯lˈiːn .",
        );
    });

    // OOV compounds (absent from the whole-word kaikki dicts) fall back to MORPHEME-KEYED corrections that compose
    // per stem — each morpheme keeps its own loanword length/quality/consonant correction + prefix reduction, which
    // a no-correction fallback loses. Measured held-out at 81.3% against 68.5% raw on OOV compounds — that
    // A/B is why the extra machinery exists. Known words are unaffected: they take the exact whole-word path.
    test("OOV compound fallback: morpheme-keyed corrections compose", () => {
        expect(phonemizeWord("Musikverein")).toBe("muzˈiːkfɛʁaɪ̯n"); // musik: s→z, short u, iː; verein: ver-→fɛʁ
        expect(phonemizeWord("Musikschule")).toBe("muzˈiːkʃuːlə"); // musik loan-corrected + schule
        expect(phonemizeWord("Naturschutzgebiet")).toBe("natˈuːɐ̯ʃʊt͡sɡəbiːt"); // gebiet: ge-→ɡə reduction survives
    });
});

// Prefix destressing for words the 68k stress dict has never seen. ⚠ The dict stores LEMMAS, so inflected forms (bedeutet, genutzten) missed the be-/ge- reduction and
// came out with a stressed long prefix (bˈeːdɔʏ̯tət). Two extensions: inflection-aware lookup (suffix
// strip/swap to the lemma entry — which also PROTECTS roots: beiden → beide ord 0), and a guarded fallback
// for dict-missing prefix words (ablaut participles like gegangen, which no suffix trick can reach).
describe("German unstressed prefixes on dict-missing forms", () => {
    test("inflected forms reach the lemma's stress entry", () => {
        expect(phonemize("bedeutet", "de")).toBe("bədˈɔʏ̯tət"); // ← bedeuten (ord 1); was bˈeːdɔʏ̯tət
        expect(phonemize("genutzten", "de")).toBe("ɡənˈʊt͡stən"); // ← genutzt
        expect(phonemize("behörden", "de")).toBe("bəhˈœɐ̯dən"); // ← behörde
    });

    test("ablaut participles via the prefix fallback", () => {
        expect(phonemize("gegangen", "de")).toBe("ɡəɡˈaŋən");
        expect(phonemize("gebracht", "de")).toBe("ɡəbʁˈaxt");
    });

    test("ge-/be-/er- ROOTS keep first-syllable stress", () => {
        expect(phonemize("beiden", "de")).toBe("bˈaɪ̯dən"); // beide — inflected lookup protects it
        expect(phonemize("gestern", "de")).toBe("ɡˈɛstɐn");
        expect(phonemize("gegen", "de")).toBe("ɡˈɛɡən");
        expect(phonemize("erste", "de")).toBe("ˈeːɐ̯stə");
    });
});

// TEXT NORMALIZATION. ⚠ German writes an ORDINAL as a numeral plus a bare PERIOD, which is
// indistinguishable by shape from a numeral ending a sentence — the detector below is what separates them.
describe("german normalization", () => {
    test("ordinal N. is detected and DECLINED, without eating a sentence period", () => {
        // Every one of these previously read as a cardinal plus a PAUSE ("sechzehn . Jahrhundert"). The
        // detector fires on the FOLLOWING word (a month or Jahrhundert), or on a licensing article plus a
        // capitalised noun. The governing word picks the ending: am/im/des/dem take weak -en, das/der -e.
        expect(phonemize("im 16. Jahrhundert", "de")).toBe("ɪm zˈɛçt͡seːntən jaːɐ̯hˈʊndɐt");
        expect(phonemize("das 16. Jahrhundert", "de")).toBe("das zˈɛçt͡seːntə jaːɐ̯hˈʊndɐt"); // -e, not -en
        expect(phonemize("des 16. Jahrhunderts", "de")).toBe("dəs zˈɛçt͡seːntən jaːɐ̯hˈʊndɐts");
        expect(phonemize("am 1. Januar", "de")).toBe("am ˈɛɐ̯stən jˈanuaːɐ̯"); // suppletive stem erst-
        expect(phonemize("am 26. November", "de")).toBe("am zˈɛçzʊntt͡svant͡sɪkstən nofˈɛmbɐ"); // -st above 20
        // …and a sentence-final digit-period must stay a PAUSE. Verified across the corpus: 109 utterances
        // contain a digit-period and no sentence-final pause was lost.
        expect(phonemize("Er kam 1958. Der Rest", "de")).toContain(" . ");
        expect(phonemize("genau 500. Dann", "de")).toContain(" . ");
    });

    test("a BARE number before a month is still a date ordinal", () => {
        // Corpora that strip punctuation have no dot to key on, and the reader still says the ordinal:
        // the OmniVoice audit heard *vierundzwanzigsten september* where we read the cardinal.
        expect(phonemize("am 24 september 1759", "de")).toContain("fiːʁʊntt͡svˈant͡sɪçstən");
        expect(phonemize("der 3 mai", "de")).toContain("dʁˈɪtə");
        // A number NOT before a month stays a cardinal.
        expect(phonemize("es waren 24 stunden", "de")).toContain("fiːʁʊntt͡svˈant͡sɪç ʃt");
    });

    test("...and LOWERCASED input gets the same ordinal, because lowercased input is real input", () => {
        // FLEURS ships its German transcripts lowercased, so the month test — case-sensitive until now — matched
        // nothing and these read as a cardinal plus a leaked phrase break. 103 utterances in the OmniVoice de_de
        // corpus. Each of these must equal its capitalised sibling above.
        expect(phonemize("am 16. februar", "de")).toBe("am zˈɛçt͡seːntən fˈeːbʁuaːɐ̯");
        expect(phonemize("der 3. mai", "de")).toBe("deːɐ̯ dʁˈɪtə maɪ̯");
        expect(phonemize("des 16. jahrhunderts", "de")).toBe("dəs zˈɛçt͡seːntən jaːɐ̯hˈʊndɐts");
        // The relaxation must not reach a SENTENCE BOUNDARY. A German day/century ordinal is ≤ 31, so a bigger
        // number before a month is a year ending a sentence — and stays a pause. (True of the capitalised form
        // too: `1998. Mai` over-fired before the ≤ 31 guard.)
        expect(phonemize("im jahr 1998. mai war warm", "de")).toContain(" . ");
        expect(phonemize("im Jahr 1998. Mai war warm", "de")).toContain(" . ");
        expect(phonemize("es waren 16. dann kamen mehr", "de")).toContain(" . ");
    });

    test("the period is thousands grouping, the comma is the decimal", () => {
        // The number token accepted either as a DECIMAL, so "1.000" read as *eins komma null null null*.
        expect(phonemize("1.000 Menschen", "de")).toBe("ˈaɪ̯ntaʊ̯zənt mˈɛnʃən");
        expect(phonemize("22.500", "de")).toBe("t͡svaɪ̯ʊntt͡svˈant͡sɪçtaʊ̯zənt fˈʏnfhʊndɐt");
        expect(phonemize("1,5 Meter", "de")).toBe("aɪ̯ns kˈɔma fʏnf mˈeːtɐ"); // …and the comma still works
    });

    test("clock: both written forms, neither of which worked", () => {
        // The colon became a PAUSE with a spurious "null"; the dot form was read as a decimal.
        expect(phonemize("11:00 Uhr", "de")).toBe("ɛlf uːɐ̯");
        expect(phonemize("8:46", "de")).toBe("axt uːɐ̯ zˈɛçsʊntfɪɐ̯t͡sɪç");
    });

    test("abbreviations, which were consonant clusters plus pauses", () => {
        expect(phonemize("z. B. das", "de")).toBe("t͡suːm bˈaɪ̯ʃpiːl das"); // was [t͡s . p .]
        expect(phonemize("bzw. auch", "de")).toBe("bət͡sˈiːʊŋsvaɪ̯zə aʊ̯x"); // ×13, was [pt͡sf .]
        expect(phonemize("Dr. Meier", "de")).toBe("dˈɔktoːɐ̯ mˈaɪ̯ɐ");
        expect(phonemize("usw.", "de")).toBe("ʊnt zoː vˈaɪ̯tɐ ."); // sentence-final dot kept
        expect(phonemize("356 v. Chr.", "de")).toBe("dʁˈaɪ̯ʊndɐtzɛçzʊntfʏnft͡sɪç foːɐ̯ kʁˈɪstʊs");
    });

    test("initialisms, units, signs and fractions", () => {
        expect(phonemize("die USA", "de")).toBe("diː uː ɛs aː"); // was the word [ˈuːzaː]
        expect(phonemize("AOL", "de")).toBe("aː oː ɛl");
        expect(phonemize("120 km/h", "de")).toBe("ˈaɪ̯nhʊndɐtt͡svant͡sɪç kilomˈeːtɐ pʁoː ʃtˈʊndə"); // /h was a letter
        expect(phonemize("20 °C", "de")).toBe("t͡svˈant͡sɪç ɡʁaːt kˈɛlzi̯ʊs");
        expect(phonemize("+3 Grad", "de")).toBe("plʊs dʁaɪ̯ ɡʁaːt");
        expect(phonemize("1/5", "de")).toBe("aɪ̯n fˈʏnftəl"); // ordinal stem + -el
    });

    // bare `m` was the RAW LETTER, so `5 m³` read as *fʏnf m* while `5 km³` read correctly: the
    // exponent branch resolves its head noun from `units` first, and `Kubik` had nothing to attach to.
    // Meter ×6, and every digit-adjacent bare `m` in the corpus is a metre.
    test("the bare metre, and the cube word it feeds", () => {
        expect(phonemize("4892 m", "de")).toContain("mˈeːtɐ");
        expect(phonemize("100 m und 200 m", "de")).toContain("mˈeːtɐ ʊnt");
        expect(phonemize("5 m³", "de")).toContain("kˈuːbɪkmeːtɐ"); // compound, one word
        expect(phonemize("BMW M3", "de")).toContain("m dʁaɪ̯");    // not a volume
    });

    // ⚠ THESE FOUR WERE NOT LEAKING, THEY WERE MIS-READING — the class tools/normalization/misread.ts
    // exists to see. `10 ha` read *t͡seːn haː*, a German interjection; `10 g` read as the letter's own
    // sound. Nothing in the tree could flag either: no ASCII survives into the IPA and nothing VANISHES,
    // so neither a leak class nor the differential DROP test can reach it.
    test("units that MIS-READ rather than leak — ⟨g⟩ ⟨ha⟩ ⟨l⟩ ⟨L⟩", () => {
        // Each word definitional on de.wikipedia, and each article names its own symbol.
        expect(phonemize("10 g", "de")).toBe("t͡seːn ɡʁam");
        expect(phonemize("10 ha", "de")).toBe("t͡seːn hˈɛktaːɐ̯");
        expect(phonemize("10 l", "de")).toBe("t͡seːn lˈɪtɐ");
        expect(phonemize("10 L", "de")).toBe("t͡seːn lˈɪtɐ"); // ⚠ both cases are official for the litre
        // ⚠ A DOTTED DESIGNATION IS NOT A QUANTITY — the artifact's only `<digit> g` is a Wi-Fi standard.
        expect(phonemize("802.11g", "de")).not.toContain("ɡʁam");
    });
});
