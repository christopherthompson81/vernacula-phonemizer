#!/usr/bin/env python3
"""Drop paragraphs that are not in the target language, before mining.

⚠ WHY THIS EXISTS. A small Wikipedia is not all in its own language. su.wikipedia carries whole English
articles — 12.9% of its paragraphs by the test below — and they are not spread evenly: they are
PATTERN-RICH, so they dominate exactly the cells a normalizer is written from. On the su dump, before
filtering:

    ordinal-latin    27.2% Sundanese     (`\\d+th` is English; Sundanese writes ke-N / ka-N)
    ampersand        33.3%
    ranges           53.6%
    decimals         95.1%   ← most cells are fine, which is what makes the bad ones easy to miss

`mine.ts` selects adversarially, so those cells came through 6-8 out of 8 English in the artifact's
hard-set. A rule written from that evidence is a rule about English text that happens to sit in su.wikipedia,
attributed to Sundanese. This is playbook trap 34 (a small-wiki hit may be another language) applied to a
whole corpus rather than one probe.

⚠ THE TEST IS FUNCTION WORDS, NOT A LANGUAGE MODEL, and its limits are the reason it is conservative. It
counts how many of the target's high-frequency function words appear against a set of English ones, and keeps
a paragraph only when the target STRICTLY wins. Paragraphs with neither (short lists, tables, bare name
strings) are dropped as undecidable — on su that is 11.3%, and losing them is the right trade when 143k
paragraphs remain. ⚠ Do not use this to make a claim about the SIZE of a wiki; use it to make the text you
mine from be the language you are mining.

⚠ AND THE WORD LISTS MUST NOT BE SHARED WITH A CLOSE RELATIVE. Sundanese, Indonesian and Malay overlap
heavily; the su list below leans on words that are diagnostic against Indonesian (nyaéta, téh, jeung, ogé,
mangrupa) rather than the common core (yang, dan, di), so it does not silently accept Indonesian text.

  python3 filter-by-language.py --lang su --in su_paras.txt --out su_paras.su.txt
"""
import argparse
import collections
import re
import sys

# Target-language function words. Add a language by adding a row; keep the words HIGH-FREQUENCY and, where a
# close relative exists, DIAGNOSTIC against it.
MARKERS = {
    "su": "jeung anu nyaéta dina éta ogé kalawan sarta minangka téh mangrupa taun basa urang lian ieu "
          "kacamatan désa kabupatén nu ka ti geus baé hiji dua tilu opat lima kota wewengkon aya",
    "jv": "lan sing ing saka kanthi yaiku uga déning kang menyang iku dadi taun basa wong kutha",
    "id": "yang dan di dari dengan untuk pada adalah ini itu tidak akan sebagai oleh dalam tahun kota",
    # so: Cushitic, so no relative in this table to be diagnostic against; these are simply the highest-
    # frequency function words (iyo "and", ee/oo linkers, waxaa/waxay focus markers, ku/ka/la prepositions).
    "so": "iyo ee ah ka ku la oo waa in uu ay si ugu kala ayaa waxaa waxay lagu loo soo dhexe "
          "magaalada dalka sanadkii badan mid oo dhan ka mid",
    # ak (Akan): Twi and Fante are two varieties of ONE language, so this row is deliberately NOT
    # diagnostic between them — it is diagnostic against ENGLISH, which is what tw.wikipedia and
    # fat.wikipedia actually carry (4.5% / 8.1% English-dominant paragraphs). The words are the copula
    # yɛ, the locative/possessive wɔ, the linkers na/ne/nso, the postposed article no, the postpositions
    # mu/ho/so, the complementiser sɛ, and the pronoun set — all shared by both varieties.
    "ak": "yɛ wɔ na ne no mu sɛ nso nyinaa de ma ho so wɔn yɛn me nti bio saa anaa firi kɔ ase "
          "deɛ ɔno afe da mmom bɛ aa ɔyɛ",
    # bar: Bavarian, and the relative to be diagnostic against is STANDARD GERMAN, not English — see
    # CONTRAST below. Every word here is one bar.wikipedia's orthography spells differently from de:
    # is/san (ist/sind), vo (von), ned·net (nicht), de·dea (die/der), des (das), wead·wean (wird/werden),
    # hod·hom (hat/haben), wia (wie), ois (als), owa (aber), iwa (über), mid (mit), vui (viel), nua (nur),
    # aa (auch), af (auf), duach (durch), oiso (also), koa (kein), wos (was), eana (ihre), i·mia (ich/wir).
    # ⚠ `is` COLLIDES WITH THE ENGLISH LIST, and it is kept anyway: it is one of the highest-frequency
    # Bavarian markers, and an English paragraph that scores +1 here scores far more on the other side —
    # measured, the artifact's one English quotation ("The greatest cultural extravaganza…") still drops.
    "bar": "is san sand vo ned net de dea des wead wean woan hod houd hom ham wia ois owa iwa mid vui "
           "nua aa af duach oiso koa wos eana eppa woa gwen boarisch joar joah oa oans zwoa moa ma "
           "se si z hoaßt easchte deitsch deitschland minga wean stod",
    # hil (Hiligaynon/Ilonggo): the contaminants are TAGALOG and CEBUANO, its two nearest neighbours, plus
    # English — see CONTRAST below. Every word here is one hil writes differently from BOTH: the genitive
    # `sang`/`sng` (tl `ng`, ceb `sa`), the conjunction `kag` (tl `at`, ceb `ug`), the deictics
    # `ini`/`sini`/`ina`/`sina` (tl `ito`/`nito`, ceb `kini`/`niini`), the disjunction `ukon` (tl/ceb `o`),
    # the negator `indi` (tl `hindi`, ceb `dili`), `halin` (ceb `gikan`), `subong` (tl `ngayon`),
    # `damo`/`madamo` (ceb `daghan`), `bilog` and the numeral `isa` (tl `isa` is shared but `duha`/`tatlo`
    # are not tl's `dalawa`/`tatlo` pair). ⚠ `nga` is Cebuano's too and is kept anyway for the same reason
    # bar keeps `is`: it is the highest-frequency hil marker and a Cebuano paragraph scores far more on the
    # contrast side. ⚠ `sa`, `ang`, `mga`, `may`, `ka` are ABSENT: all three languages write them
    # identically, so they discriminate nothing.
    "hil": "sang sng kag nga ini sini ina sina ukon indi halin subong damo madamo iya ila amo yara "
           "bisan tanan gid kon diri sia akon imo aton amon agod samtang tungod parte ginhalinan "
           "isa duha tuig banwa syudad probinsya kalaparon nabata makita kabahin",
    # bal (Balochi): the contaminants are PERSIAN and URDU, both in the same Perso-Arabic script, which is
    # what makes them invisible — see CONTRAST. Every word here was checked to be frequent in the Balochi
    # paragraphs of the Incubator projects AND near-absent from their Persian ones: the copulas انت/اینت
    # ("is/are", Persian است/اند), the prepositions په/پہ ("for", Persian به), گون/گوں ("with", Persian با),
    # تها/تھا ("in", Persian در), چہ/شه ("from", Persian از), the reflexive وتی ("own", Persian خود), the
    # verb stems بیت/بیتنت/کنت/کننت/کرت/بوتگ/زانت/گشت/دارنت/داریت/هستنت, the demonstrative اے ("this",
    # Persian این), the pronouns منی/تئی/آیی, the plural oblique ئان and the enclitic ئے.
    # ⚠ NO PROPER NOUNS. The first draft of this row carried بلوچی and بلوچستان and it scored whole URDU
    # articles ABOUT Balochistan as Balochi — the tribal-history pages on Wp/bcc, which are the single
    # largest block of Urdu in that project. A topic word is not a language marker.
    # ⚠ تھا IS BALOCHI HERE, NOT THE URDU PAST TENSE, and it looks exactly like it. Wp/bgn writes
    # `آسیاءِ تھا` ("in Asia") 89 times inside otherwise unambiguous Balochi; putting it in the Urdu
    # contrast set would have thrown away the most Balochi paragraphs in the corpus. Read the instances
    # (playbook trap 34) — the same two graphemes are a different word one language over.
    "bal": "انت اینت ئنت اے ئے په پہ وتی بیت بیتنت کنت کننت کرت کتگ بوتگ بوتگین مروچی تها تهء تھا "
           "گون گوں گؤں منی تئی شه ئان هستنت دارنت داریت زانت هچ گشت آییءَ آیی چہ ین ایں مه جهل نیمگ",
    # hmn (White Hmong / Hmoob Dawb, RPA): the ONLY contaminant is ENGLISH — Wikimedia Incubator's Wp/mww
    # is written largely by translating English articles, so a paragraph that was never translated stays
    # English, and the ordinary Hmong paragraphs around it are dense with untranslated English proper nouns.
    # There is no close relative in this table to be diagnostic against: Green Hmong (hnj) has no project
    # here, and it shares this function-word core anyway.
    # ⚠ EVERY WORD HERE IS ≥3 LETTERS AND ENDS IN A TONE LETTER OR A VOWEL, which is what keeps the row
    # safe: in RPA a word-final consonant letter is a TONE marker, not a coda, so `yog`, `cov`, `nyob`,
    # `tus` cannot be truncations of anything and cannot collide with an English word.
    # ⚠ SHORT RPA MONOSYLLABLES ARE DELIBERATELY ABSENT even though they are the commonest tokens: `ib`
    # (one), `ob` (two), `li`, `no` (this), `ua` (do), `us`. `no` and `is` are English words, and a
    # two-letter token is worth nothing as evidence either way.
    "hmn": "lub ntawm rau cov yog thiab teb hauv nyob muaj kev los ntau neeg uas tau tus nws lus "
           "chaws qhov feem tug nrog mus tshaj hmoob sib tsis siv lawv yam loj hom lwm hais ntiaj "
           "xyoo tias raws txhua thiaj kuj tsuas nkaus tseem hnub tsev txiv poj niam",
    # mos (Mooré/Mossi): Burkina Faso is FRANCOPHONE, so French is the contaminant one expects — and
    # measuring it first said otherwise. Counted over mos.wikipedia's 12,650 paragraphs, French function
    # words are rare (`de` ×774 whole-corpus, `dans` ×56, `pour` ×44) while ENGLISH is everywhere:
    # `of` ×4,460 and `the` ×2,658, from bibliographic citation blocks and from the wiki's large body of
    # Ghana/Anglophone-topic articles. Both sides are therefore in the contrast set, English carrying the
    # weight. The markers are the highest-frequency Mooré grammatical words: the relativiser `sẽn`
    # (×61,919), the copula `yaa`, the definite `wã`, the complementiser `tɩ`, the locative `pʋgẽ`,
    # `yʋʋmd` "year", `boond` "is called", `rasem` "days", `kiuug` "month".
    # ⚠ `la`, `n`, `a` and `b` ARE ABSENT even though they are the corpus's four commonest tokens. `la`
    # is Mooré "and" ×19,073 AND the French article; `n`/`a` collide with the French elision `n'`/`l'`
    # split and with English `a`; single letters are not markers.
    "mos": "sẽn yaa wã tɩ pʋgẽ yʋʋmd yʋʋm taoor boond tẽnga tẽng bũmb nins rasem wʋsg kiuug sõma fãa "
           "tõe tõog paam paama maan maand soaba soab soabã sull sulli tar tara yɩɩd lebg neb ned "
           "buud yãk toor woto tʋʋm zĩig wakat sʋka poore nin-buiid bãngr gomd",
    # ki (Kikuyu/Gĩkũyũ): TWO contaminants and the second one is the reason this row needed care —
    # ki.wikipedia carries English (bibliographies, untranslated articles, film/company names) AND
    # SWAHILI, Kenya's lingua franca, which is a Bantu language with the same word shapes. See CONTRAST.
    # The markers are the highest-frequency Gĩkũyũ grammatical words: the focus/copula `nĩ`, the
    # relative/demonstrative `ũrĩa`/`ũcio`/`ũyũ`/`icio`, the class-agreeing associatives `kĩa`/`gĩa`/`rĩa`,
    # the class-7/8 plural `cia`, `atĩ` ("that"), `tondũ` ("because"), `kana` ("or"), `nĩguo`, `thĩinĩ`,
    # `kũrĩ`, `hĩndĩ` ("time"), `mũndũ`/`andũ` ("person/people"), `bũrũri` ("country"), `mũno` ("very"),
    # `nyingĩ`/`maingĩ` ("many"), `ũhoro` ("matter"), `rũthiomi` ("language"), `gũkorwo`.
    # ⚠ `na`, `wa`, `ya`, `kwa`, `mwaka`, `wake`, `yake` ARE DELIBERATELY ABSENT. Every one of them is
    # written identically in Swahili and is ordinary Kikuyu — this corpus's own `ũhoro-inĩ wake wa 1972`
    # and `mwaka wa 1963` are Kikuyu sentences — so listing them discriminates nothing and putting the
    # Swahili twin in CONTRAST would score real Kikuyu as Swahili. The tilde vowels ⟨ĩ ũ⟩ do most of the
    # work here: Swahili has no such letters, so a marker carrying one cannot be borrowed by accident.
    "ki": "nĩ ũrĩa ũcio ũyũ icio cia kĩa gĩa rĩa atĩ tondũ kana nĩguo thĩinĩ kũrĩ hĩndĩ mũndũ andũ "
          "bũrũri mũno nyingĩ maingĩ ũhoro rũthiomi gũkorwo nĩo nĩkĩo kuma arĩ ũguo gĩkũyũ agĩkũyũ "
          "itũũra ihinda mahinda ciothe othe rĩrĩa kĩrĩa ũrĩ nĩwe",
    # ilo (Ilocano/Iloko): ilo.wikipedia is a real human-written wiki (15,526 articles, NOT a Lsjbot farm
    # like ceb's), and its contaminant is ENGLISH by a factor of 17 over Tagalog — measured, 12,769
    # English-dominant paragraphs against 730 Tagalog and 9 Cebuano. So the stock ENGLISH set carries the
    # weight here and the CONTRAST row below is a narrow supplement, which is the reverse of the hil case.
    # The markers are Ilocano's own grammar, every one of which tl, ceb and hil write differently: the
    # articles `ti`/`iti` (tl `ang`/`sa`, ceb/hil `ang`), the plural `dagiti`/`kadagiti` (tl `mga`), the
    # topic marker `ket`, the conjunction `ken` (tl `at`, ceb `ug`, hil `kag`), the linker `nga`, the
    # deictics `daytoy`/`dayta`/`dagitoy` (tl `ito`, ceb `kini`, hil `ini`), the numeral `maysa`
    # (ceb `usa`, tl/hil `isa`), `idi`/`idiay`, `manipud` "from", `wenno` "or", `ngem` "but",
    # `saan` "not" (tl `hindi`, ceb `dili`, hil `indi`), `awan` "none", `babaen` "by means of",
    # `laeng` "only", `kalpasan` "after", `aginggana` "until", `nupay`/`urayno` "although".
    # ⚠ `a`, `ni`, `no` and `ta` ARE ABSENT although they are among the corpus's commonest tokens: single
    # letters are not markers, `ni` is shared with Tagalog, and `no`/`ta` are two-letter tokens that
    # collide with English and Spanish. `nga` is kept even though ceb and hil write it too, for the same
    # reason bar keeps `is` — it is one of the highest-frequency Ilocano markers and a Cebuano paragraph
    # scores far more on the contrast side.
    "ilo": "ti iti ket nga ken dagiti kadagiti dagitoy kadagitoy daytoy dayta idi idiay maysa kas "
           "babaen manipud wenno ngem saan awan adda addaan mabalin kalpasan isu isuna isuda "
           "kenkuana kadakuada laeng met pay uray urayno nupay tapno gapu bayat kabayatan "
           "aginggana dua tallo uppat lima innem pito walo siam sangapulo tawen ili probinsia "
           "pagilian paset bassit adu kaaduan nangruna mabirukan agnanaed naisasao kadawyan",
    # qu (Quechua): the contaminant is SPANISH, and this is the row where the CONTRAST set below matters
    # most — qu.wikipedia's non-Quechua paragraphs are bibliographies, Ministry-of-Education catalogue
    # entries and untranslated Spanish talk-page prose, none of which share a function word with English.
    # ⚠ QUECHUA IS AGGLUTINATIVE AND ITS FUNCTION WORDS ARE MOSTLY SUFFIXES, so a whole-word marker list
    # is thinner here than for an isolating language. The commonest inflected forms are therefore listed
    # alongside their stems (`llaqta llaqtam llaqtapi llaqtaqa`, `suyu suyupi`, `simi simipi`) — the
    # tokenizer splits on non-letters, so `llaqtapi` is a token and the bare stem never appears in it.
    # ⚠ THE MACROLANGUAGE IS NOT SPLIT BY THIS ROW, deliberately. Southern Quechua, Ancash and Ecuadorian
    # Kichwa share this core (`nisqa`, `huk`, `kay`, `chay`, `wan`, `-pi`), and the row's job is to
    # separate Quechua from SPANISH, not one variety from another. Variety is settled by reading, not by
    # a word count — see docs/investigations/qu_normalization_investigation.md.
    # ⚠ `kan` AND `wan` ARE TWO-TO-THREE LETTERS AND KEPT ANYWAY: `kan` is the copula "there is" and
    # `wan` the comitative "and/with", both among the highest-frequency Quechua tokens, and neither is a
    # Spanish or English word. Genuinely short and ambiguous tokens (`mi`, `pi`, `ta`, `qa`) are absent.
    "qu": "nisqaqa nisqa nisqam nisqakuna icha huk kaq kan karqan kay chay chaymanta wan aswan hina "
          "hinaspa hinallataq mana manam achka ancha tukuy sapa wakin allin llaqta llaqtam llaqtapi "
          "llaqtaqa llaqtanqa mamallaqta mamallaqtapi suyu suyupi simi simipi runa runakuna runakunam "
          "mayu qucha urqu pacha wata watapi killapi punchaw p'unchaw iskay kimsa tawa pichqa qhichwa "
          "qichwa kichwa pruwinsya pruwinsyapi distritu distritum kawsachkanku uma kanku karqa",
}
ENGLISH = set(
    "the of and in to was were is are that with for by as from this which been has his its it on at "
    "an be or not they their he she we you have had also".split()
)
# ⚠ THE CONTRAST SET IS PART OF THE TEST, and English is only the right one when the contaminating
# language IS English. bar.wikipedia's contamination is STANDARD GERMAN — bibliographies, quotations and
# whole imported paragraphs — and German shares no function word with the English list, so the stock test
# would have kept every German paragraph as "Bavarian". A language whose contaminant is a close relative
# supplies that relative's function words here, and they are merged with (never replace) ENGLISH.
#
# ⚠ Words bar and de SHARE are deliberately absent: `und in im an auf für oder bei aus nach noch` are
# written identically in both, and — the sharpest one — `des` is Standard German's genitive article AND
# Bavarian's ordinary word for "das", so listing it would score Bavarian text as German.
CONTRAST = {
    "bar": set(
        "der die das ist sind war waren nicht auch von eine einen einem einer wird werden wurde "
        "über viel nur mit hat haben wie als aber sich durch jahr jahre jahren zwischen deutsche "
        "deutschen deutsch er sie es ich wir sein ihre".split()
    ),
    # hil's contaminants are TAGALOG and CEBUANO — the Incubator's Wp/hil carries verbatim tl passages
    # (Philippine topics get written in Tagalog first) and ceb-shaped stub text. ⚠ Words hil SHARES with
    # them are deliberately absent, and the list was pruned twice for exactly that: `sa ang mga may ka`
    # are identical in all three; `duha` and `tatlo` are hil's OWN numerals as much as Cebuano's; `nila`,
    # `didto`, `karon`, `lamang`, `gamay`, `tanang` and `usab` are ordinary Hiligaynon. What remains is
    # what tl and ceb write and hil does not — tl's genitive `ng`, conjunction `at`, inversion marker `ay`,
    # deictics `ito/nito`, `hindi`, `dalawa`, `ngayon`, `upang`, `habang`, `bawat`; ceb's `ug`, `gikan`,
    # `kini/niini`, `dili`, `daghan`, `usa`, `aduna(y)`, `kaayo`, `unya`, `matud`, `ilaha/iyaha`.
    "hil": set(
        "ng at ay ito nito iyan iyon hindi mayroon dalawa noong ngayon dito doon kanila kanilang "
        "naman upang nang mula habang bawat sila'y ako'y siya'y "
        "ug gikan kini niini niana dili daghan usa ilaha iyaha pud kaayo unya matud sumala "
        "aduna adunay mao kanunay".split()
    ),
    # bal: TWO contaminants, and both had to be measured before the set could be written. Wikimedia
    # Incubator's Wp/bcc (Southern Balochi) carries whole PERSIAN articles (physics, geography) and whole
    # URDU ones (Balochistan tribal histories); 37.4% of its paragraphs are one or the other.
    # ⚠ THE WORDS BALOCHI SHARES WITH PERSIAN ARE DELIBERATELY ABSENT, and there are more of them than the
    # de/bar case had. Counted over the strongly-Balochi paragraphs of both projects: `که` ×1273, `به`
    # ×2688, `تا` ×1464, `یا` ×148, `هم` ×234, `و` ×7300, `یک` ×1715 — all ordinary Balochi. Listing any of
    # them would score Balochi text as Persian.
    # ⚠ `از` IS THE SHARPEST DISCRIMINATOR AND IT IS THE ONE THAT LOOKS SHARED. Persian's "from" is ×413 in
    # the raw Wp/bcc text and ×3 in 103k tokens of Balochi — Balochi says چہ/شه — so it belongs here even
    # though every other short Perso-Arabic preposition does not.
    # ⚠ THE URDU HALF IS NARROW ON PURPOSE. `کی`, `پر`, `جو`, `کو` and `تھا` all have Balochi readings
    # (`کی` = "who?" in `اے زهگ کی انت؟`), so only the forms with no Balochi homograph are listed: the
    # copulas ہے/ہیں and the oblique ergative frame کے/کا/میں/سے/نے.
    "bal": set(
        "در است این را های می شود بود نیز دارای باشد شده هستند کند بوده آنها توسط بیشتر خود برای مورد "
        "از وی همچنین کرد دارد شد کرده هایی آن نیست "
        "ہے ہیں کے کا میں سے نے رہتے ہوئے وہ اور بھی کیا مشتمل ان".split()
    ),
    # mos: FRENCH, merged with (never replacing) ENGLISH — which on this wiki is the larger contaminant.
    # ⚠ `le`, `de` and `la` ARE DELIBERATELY ABSENT, and each for its own measured reason. `le` ×652
    # inside strongly-Mooré paragraphs is the Mooré adverb "again/any more" (`a pa le get radio wã`,
    # `zũngã pa le tõe n paam tɩbsg`), not the French article. `de` ×399 in the same set is never French
    # prose — every instance is inside a francophone PROPER NAME the Mooré sentence is naming
    # (`Cascades de Karfiguéla`), so listing it would drop real Mooré text about Burkinabè places.
    # `la` is Mooré "and". ⚠ `region` (×142 in strong-mos) is out for the same reason: it is the English
    # loan inside Mooré sentences about Ghana (`Ghana Ashanti region`), a topic word and not a marker.
    "mos": set(
        "les des du et en un une dans pour par sur est sont avec au aux qui que ce cette son ses "
        "il elle nous ou comme entre ainsi selon depuis leur cet".split()
    ),
    # ki: SWAHILI, merged with (never replacing) ENGLISH. Kenya's lingua franca is in this wiki, and it is
    # the contaminant the playbook's trap 34 warns about hardest here — a Swahili sentence inside a Kikuyu
    # article is still Bantu, still Latin, still topical, and still the wrong evidence for a Kikuyu rule.
    # ⚠ WORDS THE TWO SHARE ARE DELIBERATELY ABSENT, and there are many: `na wa ya za la cha kwa mwaka`
    # are identical in both and ordinary Kikuyu. So is `wake`/`yake` (`ũhoro-inĩ wake` is this corpus's
    # own Kikuyu). What is listed is what Swahili writes and Kikuyu does not — Kikuyu says `thĩinĩ wa`
    # for `katika`, `andũ` for `watu`, `bũrũri` for `nchi`, `itũũra` for `mji`, `mũno` for `sana`,
    # `kuma` for `kutoka`, `kana` for `au`, `no` for `lakini` — plus the `ku-`/`a-li-` verb morphology
    # (`kuwa`, `alikuwa`, `walikuwa`) and the relativisers `ambayo`/`ambao`, which Kikuyu forms with `ũrĩa`.
    "ki": set(
        "katika kwamba ambayo ambao ambaye hii hiyo hivyo huo kuwa alikuwa walikuwa ilikuwa yao zao "
        "hadi lakini pia sana kutoka baada ndani watu mji nchi wengi kila zaidi wakati yote ili bila "
        "chini juu kwenye wote hao huyu wenye kama ndiyo".split()
    ),
    # ilo: a NARROW Tagalog supplement to ENGLISH, which is this wiki's real contaminant. Every word here
    # was counted inside 30,340 strongly-Ilocano paragraphs first and kept only at ≤5 occurrences.
    # ⚠ EIGHT OBVIOUS CANDIDATES WERE CUT BECAUSE THEY ARE ORDINARY ILOCANO OR ORDINARY ILOCANO TOPICS —
    # trap 37, four times in one row:
    #   `para` ×4,748 and `mula` ×4,112 are Ilocano words (the benefactive "for"; a PLANT/crop — it is
    #       Tagalog, not Ilocano, where `mula` means "from");
    #   `hindi` ×33 is the LANGUAGE Hindi ("am-ammo kas mung iti Hindi"), not the Tagalog negator;
    #   `wala` ×7 is a LANGUAGE NAME ("Ti pagsasao a Langalanga, wenno Wala");
    #   `usa` ×6, `mao` ×14, `dili` ×11, `kaayo` ×1 are the USA, Mao Tse-tung, Dili in East Timor, and
    #       the Ilocano word for a tree — not the Cebuano function words they look like.
    # ⚠ `ay`, `at`, `ang`, `ng`, `sa`, `mga` are also absent: all six occur inside genuine Ilocano
    # paragraphs (×989, ×539, ×212, ×195, ×92, ×15), mostly in quoted Tagalog institution and song titles,
    # so listing them would drop Ilocano prose for naming a Philippine thing in Tagalog.
    # qu: SPANISH, merged with (never replacing) ENGLISH. qu.wikipedia's contaminant is overwhelmingly
    # Spanish — Peruvian/Bolivian bibliography blocks, Ministry-of-Education catalogue records and
    # untranslated editorial prose — and English arrives separately in scientific citations, so both
    # sides are needed.
    # ⚠ `de` AND `la` ARE DELIBERATELY ABSENT, for the same measured reason mos leaves out `de`. Counted
    # over the 143 strongly-Quechua paragraphs of the mined artifact, `de` occurs ×25 and `la` ×6, and
    # every one is inside a Spanish PROPER NAME that the Quechua sentence is naming or glossing
    # (`kastilla simipi: Provincia de Espinar`, `Santiago de Chile`). A gloss of a Spanish place name is
    # the most ordinary thing a Quechua encyclopaedia paragraph does; listing those two would drop the
    # text this filter exists to keep. `del`/`al`/`el`/`los`/`las`/`y` are ×2-4 in the same set, low
    # enough that a real Quechua paragraph out-scores them, and they are kept.
    "qu": set(
        "el los las del al en que y con por para un una es son fue como su sus se no lo este esta "
        "entre sobre desde hasta cuando tambien todos donde tiene sido segun mas pero sin ni "
        "provincia distrito departamento historia lengua edicion".split()
    ),
    "ilo": set(
        "ito nito iyan iyon noong ngayon dito doon kanila kanilang naman upang habang bawat "
        "dalawa marami lahat kung sila nila niya ninyo tayo kami ako din rin".split()
    ),
}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--lang", required=True, choices=sorted(MARKERS))
    ap.add_argument("--in", dest="inp", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--min-chars", type=int, default=40)
    a = ap.parse_args()

    target = set(MARKERS[a.lang].split())
    contrast = ENGLISH | CONTRAST.get(a.lang, set())
    word_rx = re.compile(r"[^\W\d_]+", re.UNICODE)
    tally = collections.Counter()

    with open(a.inp, encoding="utf8") as fin, open(a.out, "w", encoding="utf8") as fout:
        for line in fin:
            s = line.strip()
            if len(s) < a.min_chars:
                tally["short"] += 1
                continue
            w = set(m.lower() for m in word_rx.findall(s))
            t, e = len(w & target), len(w & contrast)
            if t > e:
                tally["kept"] += 1
                fout.write(s + "\n")
            elif e > t:
                tally["dropped: contrast"] += 1
            else:
                tally["dropped: undecidable"] += 1

    n = sum(tally.values())
    for k, v in tally.most_common():
        print(f"  {k:22} {v:7}  ({100*v/n:.1f}%)", file=sys.stderr)
    print(f"→ {a.out}: {tally['kept']} paragraphs", file=sys.stderr)


if __name__ == "__main__":
    main()
