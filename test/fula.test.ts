import { describe, expect, it } from "vitest";
import { phonemize } from "../src/index.ts";
import { normalizeFula } from "../src/languages/fula/normalize.ts";
import { createFula, phonemizeWord } from "../src/languages/fula/fula.ts";
import { numberToWords } from "../src/languages/fula/numbers.ts";
import { ordinalWords } from "../src/languages/fula/normalize.ts";

describe("Fula g2p (authored)", () => {
    it("implosives, prenasalized digraphs, geminates, length", () => {
        expect(phonemizeWord("ɓiɗɗo")).toBe("ɓˈiɗːo"); // implosive ɓ, geminate ɗɗ→ɗː
        expect(phonemizeWord("ƴiiƴam")).toBe("ʄˈiːʄam"); // ƴ→ʄ (implosive), long ii→iː
        expect(phonemizeWord("ngol")).toBe("ᵑɡˈol"); // prenasalized ng→ᵑɡ
        expect(phonemizeWord("njamndi")).toBe("ⁿd͡ʒˈamⁿdi"); // nj→ⁿd͡ʒ, nd→ⁿd
        expect(phonemizeWord("koŋgol")).toBe("kˈoŋɡol"); // ŋ + g (not the ng digraph)
        expect(phonemizeWord("debbo")).toBe("dˈebːo"); // geminate bb→bː
        expect(phonemizeWord("moƴƴude")).toBe("moʄːˈude"); // geminate ƴƴ→ʄː
    });

    it("penultimate stress", () => {
        expect(phonemizeWord("Fulfulde")).toBe("fulfˈulde"); // 3 syllables → penult
        expect(phonemizeWord("tati")).toBe("tˈati"); // 2 syllables → first (penult)
        expect(phonemizeWord("gorko")).toBe("ɡˈoɾko"); // r→ɾ
    });

    it("Adlam (𞤀𞤁𞤂𞤃) front-end — transliterates to Boko, IDENTICAL IPA to the Latin path", () => {
        expect(phonemizeWord("𞤊𞤵𞤤𞤩𞤫")).toBe("fˈulɓe"); // Fulɓe (the people); bhe→ɓ
        expect(phonemizeWord("𞤊𞤵𞤤𞤩𞤫")).toBe(phonemizeWord("Fulɓe")); // Adlam ≡ Latin
        expect(phonemizeWord("𞤆𞤵𞤤𞤢𞥄𞤪")).toBe("pˈulaːɾ"); // Pulaar — the ALIF LENGTHENER (𞥄) → long aː
        expect(phonemizeWord("𞤂𞤢𞥄𞤥𞤯𞤮")).toBe("lˈaːmɗo"); // laamɗo "chief" — lengthener + implosive ɗ (dha)
        expect(phonemizeWord("𞤁𞤫𞤦𞥆𞤮")).toBe("dˈebːo"); // debbo — the GEMINATION MARK (𞥆) → long bː
    });

    // NUMBERS — QUINARY (base-5) below ten, DECIMAL above it, with a vigesimal relic at 20: 6–9 are 5+n
    // compounds on jee- < jowi 'five', noogaas 20 is its own lexeme (< 'it is finished' — fingers AND toes),
    // and 30–90 are cappanɗe (the ƊE plural of sappo, with s→c mutation) + a multiplier that may itself be
    // quinary (cappanɗe jeetati = 10×(5+3) = 80). Slots join with the comitative e. Magnitude nouns go to their
    // plural when multiplied (teemedere → teemedde, ujundere → ujunaaje). Lect: Pulaar Futa-Tooro.
    // Sources: Kosogorova 2023 (SALC 57) §2.1–2.2, Peace Corps/Mauritania "Introduction to Pulaar", Omniglot.
    // See src/languages/fula/numbers.ts.
    it("numbers: the QUINARY 6–9 (jee- + n)", () => {
        expect(numberToWords(5)).toBe("joyi");
        expect(numberToWords(6)).toBe("jeegom"); // 5+1
        expect(numberToWords(7)).toBe("jeeɗiɗi"); // 5+2
        expect(numberToWords(8)).toBe("jeetati"); // 5+3
        expect(numberToWords(9)).toBe("jeenayi"); // 5+4
    });

    it("numbers: sappo / noogaas / cappanɗe tens + the comitative e", () => {
        expect(numberToWords(10)).toBe("sappo");
        expect(numberToWords(11)).toBe("sappo e goo");
        expect(numberToWords(20)).toBe("noogaas"); // a lexeme, not 2×10
        expect(numberToWords(21)).toBe("noogaas e goo");
        expect(numberToWords(42)).toBe("cappanɗe nayi e ɗiɗi"); // 10×4 + 2
        expect(numberToWords(80)).toBe("cappanɗe jeetati"); // 10×(5+3) — quinary multiplier
        expect(numberToWords(99)).toBe("cappanɗe jeenayi e jeenayi");
    });

    it("numbers: teemedere/ujundere and their ƊE plurals; the borrowed million/milyar", () => {
        expect(numberToWords(100)).toBe("teemedere"); // singular, bare
        expect(numberToWords(101)).toBe("teemedere e goo");
        expect(numberToWords(555)).toBe("teemedde joyi e cappanɗe joyi e joyi"); // plural when multiplied
        expect(numberToWords(1000)).toBe("ujundere");
        expect(numberToWords(12345)).toBe("ujunaaje sappo e ɗiɗi e teemedde tati e cappanɗe nayi e joyi");
        expect(numberToWords(1_000_000)).toBe("million");
        expect(numberToWords(2_000_000)).toBe("milionji ɗiɗi");
        expect(numberToWords(1_000_000_000)).toBe("milyar");
    });

    it("numbers: both registered scripts — Adlam digits (𞥐–𞥙) ≡ ASCII", () => {
        const ff = createFula();
        expect(ff.text("7")).toBe("d͡ʒeːɗˈiɗi"); // jeeɗiɗi — long ee→eː, implosive ɗ, penultimate stress
        expect(ff.text("𞥗")).toBe(ff.text("7")); // Adlam digits fold to ASCII → identical IPA
    });
});

// TEXT NORMALIZATION (src/languages/fula/normalize.ts) — the pre-tokenizer pass. The defining
// rules are the English ordinal digits read as Fula ordinals (1st → gootal), the comma-thousands (the
// corpus groups with commas), the dot-decimal "tere", the a.m./p.m. clocks with Fula time-of-day words,
// the rates "e wakkati gootel", and the letter-spelled initialisms.
describe("Fula text normalization", () => {
    const ph = (s: string): string => phonemize(s, "ff").trim();

    it("text→text: the English ordinal digit reads the Fula ordinal", () => {
        expect(normalizeFula("1st")).toBe("gootal");
        expect(normalizeFula("16th")).toBe("sappo e jeegaɓal");
        expect(normalizeFula("190th")).toBe("teemedere e cappanɗe jeenayaɓal");
        expect(ph("1st je janeru")).toBe("ɡˈoːtal d͡ʒˈe d͡ʒanˈeɾu");
    });

    it("comma-thousands stay grouped; the dot is a decimal (tere)", () => {
        expect(ph("2,243")).toBe("ud͡ʒunˈaːd͡ʒe ɗˈiɗi ˈe teːmˈedːe ɗˈiɗi ˈe t͡ʃapːˈanɗe nˈaji ˈe tˈati");
        expect(ph("100,000")).toBe("ud͡ʒunˈaːd͡ʒe teːmedˈeɾe");
        expect(ph("1.5 million")).toBe("ɡˈoː toɓːˈeɾe d͡ʒˈoji milːˈion");
        expect(ph("12.8km")).toBe("sˈapːo ˈe ɗˈiɗi toɓːˈeɾe d͡ʒeːtˈati kilomˈetɾe");
    });

    it("clocks read hour [minute] with p.m./a.m. as kikiiɗe / fajiri", () => {
        expect(ph("1:15 a.m.")).toBe("ɡˈoː ˈe sˈapːo ˈe d͡ʒˈoji fad͡ʒˈiɾi");
        expect(ph("8:30 p.m.")).toBe("d͡ʒeːtˈati ˈe t͡ʃapːˈanɗe tˈati kikˈiːɗe");
        expect(ph("15.00 UTC")).toBe("sˈapːo ˈe d͡ʒˈoji ˈu tˈa t͡ʃˈa");
    });

    it("era markers expand; ranges join haa; rates use e wakkati gootel", () => {
        expect(ph("1000B.C.")).toBe("ud͡ʒuⁿdˈeɾe ɓˈawo");
        expect(ph("7-2")).toBe("d͡ʒeːɗˈiɗi hˈaː ɗˈiɗi");
        expect(ph("160km/h")).toBe("teːmedˈeɾe ˈe t͡ʃapːˈanɗe d͡ʒˈeːɡom kilomˈetɾe ˈe wakːˈati ɡˈoːtel");
        expect(ph("300mph")).toBe("teːmˈedːe tˈati mˈiles ˈe wakːˈati ɡˈoːtel");
    });

    it("currency, percent, degrees and initialisms read their words or letters", () => {
        expect(ph("US$11,000")).toBe("dˈolːaɾ amˈeɾik ud͡ʒunˈaːd͡ʒe sˈapːo ˈe ɡˈoː");
        expect(ph("AUD$45")).toBe("dˈolːaɾ awstɾalˈija t͡ʃapːˈanɗe nˈaji ˈe d͡ʒˈoji");
        expect(ph("88%")).toBe("t͡ʃapːˈanɗe d͡ʒeːtˈati ˈe d͡ʒeːtˈati ˈe teːmedˈeɾe");
        expect(ph("30°C")).toBe("t͡ʃapːˈanɗe tˈati diɡˈiɾi t͡ʃelsˈius");
        expect(ph("MRI")).toBe("mˈa ɾˈa ˈi");
        expect(ph("H5N1")).toBe("hˈa d͡ʒˈoji nˈa ɡˈoː");
        expect(ph("U.S.")).toBe("ˈu sˈa");
        // UN is the United Nations — letter-spelled, not the word "un"
        expect(ph("ha UN")).toBe("hˈa ˈu nˈa");
    });

    // SOURCING PINS. Every word these rules emit has to come from somewhere; the forms below were changed
    // in review because the shipped ones appear in neither the corpus nor the epitran referee's word list.
    it("emits only sourced words: toɓɓere (dot), haa (range), e teemedere (percent), fota, usta", () => {
        expect(normalizeFula("1.5")).toBe("1 toɓɓere joyi"); // toɓɓere is the referee's word for a dot
        expect(normalizeFula("10-60")).toBe("10 haa 60"); // haa ×12 in the corpus; hakkunde is a PREPOSITION
        expect(normalizeFula("88%")).toBe("88 e teemedere"); // composed: e ×92, teemedere = 100
        expect(normalizeFula("x = y")).toBe("x fota y"); // fota ×2 in the corpus, in this very sense
        expect(normalizeFula("-5")).toBe("usta 5"); // usta ×7 ("reduce"); zero leading minuses in the corpus
    });

    // the cube word came from ff.wikipedia via attest.ts, because the FLEURS corpus attests NO
    // measure word at all: "60 miliyoŋ meeteer kubik (2.1×10⁹ cu ft)" — postposed, exactly this slot.
    // ⚠ `kaare` and `kaaree` are DIFFERENT WORDS, one letter apart: the shorter is the SHAPE ("Suudu
    // juulirde nduu ko kaare" — the prayer hall is square) and probing it concluded this language had no
    // squared word at all. The SLOT probe (`attest.ts --after kiloomeeteer`) found the real one, because it
    // names the noun the modifier attaches to instead of guessing the modifier — `kaaree`, across six
    // independent place articles, which are the pages that cannot state their subject without an area.
    // The other rejected candidates: `punndi` ×5 a PUBLICATION NAME in citations, `karre` ×1 a proper noun.
    it("the squared and cubed measure words, sourced from the wiki", () => {
        expect(phonemize("468 km²", "ff")).toContain("kilomˈetɾe kˈaːɾeː");
        expect(phonemize("120 m³", "ff")).toContain("mˈetɾe kˈubik");
        expect(phonemize("160 km/h", "ff")).toContain("kilomˈetɾe ˈe wakːˈati");
    });

    // ⚠ THE sh / ch DIGRAPHS. Fula writes /t͡ʃ/ as bare ⟨c⟩, so a ⟨ch⟩ spelling used to scan as c→t͡ʃ then
    // h→h and emit the impossible cluster t͡ʃh (514 of 530 corpus rows containing ⟨ch⟩); ⟨sh⟩ had no rule
    // at all and fell through to s + h, leaving the LITERAL two-letter sequence "sh" in an IPA stream
    // (280 of 280 rows). Both were found by the wav2vec2 alignment sweep over FLEURS ff_sn. The Adlam
    // block in fula.jsonc had declared the loan letter 𞥃 → "sh" as something "the Latin engine already
    // uses" — it did not, so the second script transliterated into the same dead end.
    it("reads the sh and ch digraphs", () => {
        expect(phonemizeWord("shiri")).toBe("ʃˈiɾi");
        expect(phonemizeWord("karshe")).toBe("kˈaɾʃe");
        expect(phonemizeWord("tasha")).toBe("tˈaʃa");
        expect(phonemizeWord("chede")).toBe("t͡ʃˈede");
        expect(phonemizeWord("chanjata")).toBe("t͡ʃaⁿd͡ʒˈata");
        expect(phonemizeWord("march")).toBe("mˈaɾt͡ʃ");
        // and NO stray h survives either digraph
        for (const w of ["shiri", "karshe", "chede", "march"]) expect(phonemizeWord(w)).not.toContain("h");
    });

    // ⟨cch⟩ is the geminate of ⟨ch⟩, and it fails one level up: cc→t͡ʃː matches first, then the h is left
    // over. 25 corpus rows — acchugo, yeccheta, picchu, bocchi — so it needs a rule ordered before ⟨ch⟩.
    it("reads the cch geminate without a leftover h", () => {
        expect(phonemizeWord("acchugo")).toBe("at͡ʃːˈuɡo");
        expect(phonemizeWord("yeccheta")).toBe("jet͡ʃːˈeta");
        expect(phonemizeWord("picchu")).toBe("pˈit͡ʃːu");
        // the plain geminates are untouched by the new ordering
        expect(phonemizeWord("haccu")).toBe("hˈat͡ʃːu");
        expect(phonemizeWord("sanne")).toBe("sˈanːe");
        expect(phonemizeWord("njamndi")).toBe("ⁿd͡ʒˈamⁿdi");
    });


    // ⚠ ⟨chh⟩ is the INDIC TRANSLITERATION digraph for an aspirated /t͡ʃʰ/ (Chhatrapati Shivaji
    // Terminus, Chhappan). This language marks no aspiration, so the host reads a plain /t͡ʃ/ — but
    // the rule has to EXIST, because ⟨ch⟩ alone leaves the second h stranded as its own consonant and
    // rebuilds the exact t͡ʃ+h cluster the ⟨ch⟩ fix removed. Found by re-scanning the REGENERATED
    // corpus for the cluster that fix targeted: 5 rows survived in ff and 4 in ha, all of them these
    // two proper nouns. A fix is not done until the thing it targeted is actually gone.
    it("reads ⟨chh⟩ without stranding the second h", () => {
        expect(phonemizeWord("chhatrapati")).not.toContain("h");
        expect(phonemizeWord("chhappan")).not.toContain("h");
        expect(phonemizeWord("chhatrapati")).toContain("t͡ʃ");
        expect(phonemizeWord("acchugo")).toBe("at͡ʃːˈuɡo");
    });

});

describe("Fula: the three dead tables the port batch found", () => {
    it("does not assert 'per hour' for a per-second rate", () => {
        // Rule 10's trailing word was chosen by `d === "h" ? "gootel" : "gootel"` — two identical
        // branches — so the corpus's `480 km/h (133m/s; 300mph)`, one wind speed glossed three ways,
        // read the second gloss as an hour rate. `gootel` agrees with `wakkati`'s noun class and the
        // form for `sahaawa` is unsourced, so `/s` now declines and reads its letters instead.
        expect(normalizeFula("133m/s")).not.toContain("wakkati");
        expect(normalizeFula("20 m/s")).not.toContain("wakkati");
        expect(normalizeFula("480 km/h")).toContain("e wakkati gootel"); // the sourced half is unchanged
        expect(normalizeFula("300mph")).toContain("e wakkati gootel");
    });

    it("forms an ordinal at exactly 1e6 and 1e9", () => {
        // STEM_ORD keyed `miliyon`/`milion`; the compositor emits `million`/`milyar`. Both rows were
        // dead, and these are the only two magnitudes where the magnitude word is itself the LAST word.
        expect(ordinalWords(1e6)).toBe("millionaɓal");
        expect(ordinalWords(1e9)).toBe("milyaraɓal");
        expect(ordinalWords(2e6)).toBe("milionji ɗiɗaɓal"); // the multiplier still carries it
    });

    it("reads a vulgar fraction as a ratio, not as a percentage", () => {
        // `(\d+)¾` → `$1 e teemedere` was character-for-character the percent phrase, so `1¾` read as
        // *one per hundred*. Unreachable through phonemize (the fold runs first) but not through the
        // exported normalizer, which the C# port exposes too.
        expect(normalizeFula("1¾ kilometre")).not.toContain("e teemedere");
        expect(phonemize("5%", "ff")).toContain("teːmedˈeɾe"); // the real percent reading survives
        expect(phonemize("1¾ kilometre", "ff")).toBe(phonemize("1 3/4 kilometre", "ff"));
    });
});

describe("Fula: a comma before a minus is not a range", () => {
    it("reads `1, -2` as a negative, and a real range as a range", () => {
        expect(normalizeFula("1, -2")).not.toContain("haa");
        expect(normalizeFula("1-2")).toContain("haa");
        expect(normalizeFula("1,234-5,678")).toContain("haa");
    });
});
