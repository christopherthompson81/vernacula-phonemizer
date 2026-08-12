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
