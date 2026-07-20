#!/usr/bin/env python3
"""Regenerate catalogue.tsv (the diffable source of truth) from the inline data blocks below.

This is the bootstrap/data-entry aid: edit the blocks here (or edit catalogue.tsv directly), then run
`python3 gen-seed.py` to rewrite the TSV, and `python3 build.py` to rebuild languages.db. Populations are
ESTIMATES in millions (blank = unknown); referee columns are blank until probed. Keep both in sync by editing
whichever is convenient and regenerating the other side is NOT automatic — the TSV is authoritative for build.py.
"""
import csv, os

# code | verdict | name  — the IMPLEMENTED set (mirrors docs/language-maturity.md).
IMPL = """
acm|🟡|Iraqi Arabic
acw|🔷|Hijazi Arabic
afb|🟡|Gulf Arabic
ajp|🔷|South Levantine Arabic
apc|🟡|North Levantine Arabic
apd|🔷|Sudanese Arabic
ar|✅|Arabic (MSA)
ary|🟡|Moroccan Arabic
arz|🟡|Egyptian Arabic
ak|🔷|Akan (Twi)
am|🟡|Amharic
as|🟡|Assamese
awa|⛔|Awadhi
ayl|🟡|Libyan Arabic
az|✅|Azerbaijani (North)
bg|✅|Bulgarian
bho|⛔|Bhojpuri
bm|🔷|Bambara
bn|🟡|Bengali
ca|✅|Catalan
ceb|✅|Cebuano
ckb|🟡|Central Kurdish (Sorani)
cjy|🔷|Jin Chinese
cmn|✅|Mandarin Chinese
cs|✅|Czech
cy|✅|Welsh
de|✅|German
el|🟡|Greek
en|✅|English
es|✅|Spanish
es-419|✅|Spanish (Latin American)
fa|🟡|Persian (Iranian)
ff|✅|Fula
fr|✅|French
ga|✅|Irish
gan|🔷|Gan Chinese
gu|🟡|Gujarati
ha|✅|Hausa
hak|🔷|Hakka Chinese
hi|✅|Hindi
hne|⛔|Chhattisgarhi
hsn|🔷|Xiang Chinese
hu|✅|Hungarian
id|🟢|Indonesian
ig|🔷|Igbo
it|✅|Italian
ja|✅|Japanese
jv|🟡|Javanese
kk|✅|Kazakh
km||Khmer
kmr|✅|Kurmanji (Northern Kurdish)
kn|✅|Kannada
ko|✅|Korean
lg|🔷|Luganda
ln|🔷|Lingala
lo|🟡|Lao
mad|🔷|Madurese
mai|🔷|Maithili
mg|🔷|Malagasy
ml|✅|Malayalam
mr|🟡|Marathi
my|✅|Burmese
nan|🟡|Min Nan Chinese
ne|🟡|Nepali
nl|🟡|Dutch
nya|✅|Chichewa (Nyanja)
om|✅|Oromo
or|✅|Odia
pa|🟡|Punjabi (Eastern)
pcm|🔷|Nigerian Pidgin
pl|✅|Polish
pnb|🟡|Western Punjabi (Lahnda)
ps|🟡|Pashto
pt|✅|Portuguese
rn|🔷|Kirundi
ro|🟡|Romanian
ru|✅|Russian
rw|🔷|Kinyarwanda
sd|🟡|Sindhi
si|✅|Sinhala
skr|🔷|Saraiki
sn|🔷|Shona
so|✅|Somali
sr|✅|Serbian
su|✅|Sundanese
sv|✅|Swedish
sw|✅|Swahili
syl|🔷|Sylheti
ta|✅|Tamil
te|✅|Telugu
th|✅|Thai
ti|🔷|Tigrinya
tl|🟢|Tagalog
tn|🔷|Setswana
tr|✅|Turkish
ug|✅|Uyghur
uk|✅|Ukrainian
ur|🟡|Urdu
uz|✅|Uzbek
vi|✅|Vietnamese
wo|🔷|Wolof
wuu|🔷|Wu Chinese (Shanghainese)
xh|✅|Xhosa
yo|✅|Yoruba
yue|✅|Cantonese (Yue)
za|🔷|Zhuang
zu|✅|Zulu
"""

# code | family | script | L1(millions) | L2(millions)   — blanks = unknown.
META = """
acm|Semitic (Arabic)|Arabic|15|
acw|Semitic (Arabic)|Arabic|11|
afb|Semitic (Arabic)|Arabic|15|
ajp|Semitic (Arabic)|Arabic|10|
apc|Semitic (Arabic)|Arabic|30|
apd|Semitic (Arabic)|Arabic|32|
ar|Semitic (Arabic)|Arabic|0|274
ary|Semitic (Arabic)|Arabic|29|
arz|Semitic (Arabic)|Arabic|78|25
ak|Niger-Congo (Kwa)|Latin|11|9
am|Semitic (Ethiosemitic)|Ge'ez|35|25
as|Indo-Aryan (Eastern)|Eastern Nagari (Assamese)|15|
awa|Indo-Aryan|Devanagari|38|
az|Turkic (Oghuz)|Latin|23|
bg|Slavic (South)|Cyrillic|8|
bho|Indo-Aryan|Devanagari|52|
bm|Mande|Latin/N'Ko|14|
bn|Indo-Aryan (Eastern)|Bengali|240|40
ca|Romance|Latin|4|5
ceb|Austronesian (Philippine)|Latin|20|
ckb|Iranian (NW)|Arabic (Sorani)|8|
cjy|Sinitic|Han|47|
cmn|Sinitic|Han|940|200
cs|Slavic (West)|Latin|10|
cy|Celtic (Brythonic)|Latin|0.9|
de|Germanic|Latin|76|56
el|Hellenic|Greek|13|
en|Germanic|Latin|380|1080
es|Romance|Latin|485|75
es-419|Romance|Latin|420|
fa|Iranian (SW)|Arabic (Persian)|60|50
ff|Niger-Congo (Atlantic)|Latin|25|
fr|Romance|Latin|80|230
ga|Celtic (Goidelic)|Latin|0.1|1.7
gan|Sinitic|Han|22|
gu|Indo-Aryan|Gujarati|57|
ha|Afro-Asiatic (Chadic)|Latin/Ajami|54|40
hak|Sinitic|Han|44|
hi|Indo-Aryan|Devanagari|345|265
hne|Indo-Aryan|Devanagari|18|
hsn|Sinitic|Han|37|
hu|Uralic|Latin|13|
id|Austronesian (Malayic)|Latin|70|130
ig|Niger-Congo (Volta-Niger)|Latin|31|
it|Romance|Latin|65|
ja|Japonic|Japanese (kanji+kana)|123|
jv|Austronesian|Latin/Javanese|68|
kk|Turkic (Kipchak)|Cyrillic/Latin|13|
km|Austroasiatic|Khmer|17|
kmr|Iranian (NW)|Latin (Hawar)|15|
kn|Dravidian|Kannada|44|15
ko|Koreanic|Hangul|81|
lg|Niger-Congo (Bantu)|Latin|6|5
ln|Niger-Congo (Bantu)|Latin|20|20
lo|Kra-Dai|Lao|30|
mad|Austronesian|Latin|14|
mai|Indo-Aryan|Devanagari|34|
mg|Austronesian (Barito)|Latin|25|
ml|Dravidian|Malayalam|37|
mr|Indo-Aryan|Devanagari|83|16
my|Sino-Tibetan|Burmese|33|10
nan|Sinitic|Han|49|
ne|Indo-Aryan|Devanagari|16|
nl|Germanic|Latin|25|
nya|Niger-Congo (Bantu)|Latin|14|
om|Afro-Asiatic (Cushitic)|Latin|37|
or|Indo-Aryan (Eastern)|Odia|35|
pa|Indo-Aryan|Gurmukhi|113|
pcm|English creole|Latin|5|116
pl|Slavic (West)|Latin|40|
pnb|Indo-Aryan (Lahnda)|Arabic (Shahmukhi)|66|
ps|Iranian (Eastern)|Arabic (Pashto)|40|
pt|Romance|Latin|240|25
rn|Niger-Congo (Bantu)|Latin|11|
ro|Romance|Latin|24|4
ru|Slavic (East)|Cyrillic|150|110
rw|Niger-Congo (Bantu)|Latin|12|
sd|Indo-Aryan|Arabic (Sindhi)|33|
si|Indo-Aryan|Sinhala|16|2
skr|Indo-Aryan (Lahnda)|Arabic (Shahmukhi)|26|
sn|Niger-Congo (Bantu)|Latin|9|
so|Afro-Asiatic (Cushitic)|Latin|22|
sr|Slavic (South)|Cyrillic/Latin|12|
su|Austronesian|Latin|32|
sv|Germanic|Latin|10|
sw|Niger-Congo (Bantu)|Latin|16|70
syl|Indo-Aryan (Eastern)|Syloti Nagri|11|
ta|Dravidian|Tamil|79|8
te|Dravidian|Telugu|83|13
th|Kra-Dai|Thai|60|40
ti|Semitic (Ethiosemitic)|Ge'ez|9|
tl|Austronesian (Philippine)|Latin|28|60
tn|Niger-Congo (Bantu)|Latin|6|8
tr|Turkic (Oghuz)|Latin|84|6
ug|Turkic (Karluk)|Arabic (Uyghur)|11|
uk|Slavic (East)|Cyrillic|33|
ur|Indo-Aryan|Arabic (Urdu)|70|160
uz|Turkic (Karluk)|Latin/Cyrillic|35|
vi|Austroasiatic|Latin|85|
wo|Niger-Congo (Atlantic)|Latin|5|7
wuu|Sinitic|Han|83|
xh|Niger-Congo (Bantu)|Latin|8|11
yo|Niger-Congo (Volta-Niger)|Latin|46|
yue|Sinitic|Han|86|
za|Kra-Dai|Latin/Sawndip|16|
zu|Niger-Congo (Bantu)|Latin|12|16
"""

# code | wikipron | kaikki | epitran(0/1) | espeak(0/1)   — only what has actually been probed/measured.
REF = """
bg|46034|47616|0|1
ti|0|26|1|0
ckb|972|1037|1|1
syl|397|492|0|0
ajp|2513|1|0|0
acw|1891|1|0|0
apd|0|0|0|0
mag|0|2|0|0
bgc|0|0|0|0
bal|0|0|0|0
knc|0|0|0|0
ilo|926|973|1|0
hil|465|477|0|0
"""

# code | verdict   — verdict for an EXTRA (non-IMPL) implemented row (e.g. authored ⛔ bring-ups).
VERDICTS_EXTRA = """
bal|🔷
hil|🟢
ilo|🟡
"""

# code | served_by   — a language served by ANOTHER language's engine as a labelled approximation (not bespoke).
SERVED = """
mag|bho
bgc|hi
"""

# Extra rows (rejected / unimplemented candidates):
# code | name | family | script | L1m | L2m | decision | rejection_reason | notes
EXTRA = """
ctg|Chittagonian|Indo-Aryan (Eastern)|(no standard script)|13||rejected|unsuitable orthography|Built then REMOVED — 3 competing scripts, no community-adopted standard. Contrast bho/awa/syl (real script tradition).
zsm|Standard Malay|Austronesian (Malayic)|Latin|20|60|rejected|macrolanguage umbrella|Mutually intelligible with and covered by Indonesian (id).
arq|Algerian Arabic|Semitic (Arabic)|Arabic|40||unimplemented|data scarcity|No wikipron, no kaikki — cannot verify (would be authored-blind, the bho trap). Largest missing Arabic dialect.
ars|Najdi Arabic|Semitic (Arabic)|Arabic|30||unimplemented|data scarcity|No wikipron, no kaikki.
aec|Sa'idi Arabic (Upper Egypt)|Semitic (Arabic)|Arabic|25||unimplemented|data scarcity|No wikipron, no kaikki.
aeb|Tunisian Arabic|Semitic (Arabic)|Arabic|12||unimplemented|data scarcity|No wikipron, no kaikki.
raj|Rajasthani|Indo-Aryan|Devanagari|20||unimplemented|macrolanguage umbrella|Cover term (Marwari, Dhundhari, …), not a single phonology.
azb|South Azerbaijani|Turkic (Oghuz)|Arabic|13||unimplemented|variant without sufficient vowel-encoding|Arabic-script (abjad) sibling of the done Latin `az`; under-writes vowels.
mag|Magahi|Indo-Aryan|Devanagari|14||implemented||ALIAS to the Bhojpuri engine (served_by=bho). Referee PROBED 2026-07-19: no wikipron, no epitran mag-Deva map, kaikki only 2 IPA entries -> NO independent referee. Source reviewed: Priya (2020, IJSR, CC-BY) 'Morphophonology of Magahi' = a morphophonology paper (not a pronunciation lexicon); confirms Magahi is segmentally ~= Bhojpuri (shares श->s, विशाल->bisɑl) with no confidently-encodable Magahi-specific delta. Served via bho (nearest verified sibling) as a labelled approximation rather than an unverifiable bespoke clone.
st|Southern Sotho (Sesotho)|Niger-Congo (Bantu)|Latin|6|8|unimplemented||SA official; Latin Bantu sibling of done tn. Good candidate.
nso|Northern Sotho (Sepedi)|Niger-Congo (Bantu)|Latin|5|9|unimplemented||SA official; Latin Bantu.
ilo|Ilocano (Iloko)|Austronesian (Northern Philippine)|Latin|8|2|implemented||Northern Luzon lingua franca (NOT Bisayan). Bespoke rule g2p — Philippine core + Ilocano HIATUS (high vowel i/u glides before a vowel: dua→dwa) + 6th vowel ⟨e⟩→ɯ~ɛ + geminate ⟨ll⟩. THREE referees: wikipron 82.7% + kaikki 84.5% + epitran 75.9%. 🟡 bounded — gliding/hiatus is orthography-ambiguous. Numbers deferred.
hil|Hiligaynon (Ilonggo)|Austronesian (Western Bisayan)|Latin|9||implemented||Sibling of done Cebuano/Tagalog. Bespoke rule g2p (Cebuano core + Spanish-loan deltas ⟨j⟩→h, ⟨f⟩→p). TWO human referees: wikipron hil_latn (465, proper-noun-heavy) 94.4% + kaikki hil (477, native) 94.1%. Folds: stress/final-glottal/lax-vowels. Residual = Spanish rising diphthongs (origin-ambiguous). Numbers deferred. 🟢.
kr|Kanuri (macrolanguage)|Nilo-Saharan (Saharan)|Latin/Ajami|9||unimplemented|macrolanguage umbrella|COVER TERM — do NOT build the umbrella; target a specific variety (as with Balochi→bcc, Arabic→dialects). Individual codes: Central/Yerwa knc (~4M, the standard w/ orthography), Manga kby (~1M, Niger), Tumari krt. Referee PROBED 2026-07-19: knc/kby/krt/kr ALL have no wikipron, no kaikki page, no epitran map → also DATA-SCARCE. Revisit trigger = a referee appears OR a deliberate authored-⛔ from a grammar (the Hausa/Balochi-Run-1 path), not merely surfacing in a population list.
knc|Central Kanuri (Yerwa)|Nilo-Saharan (Saharan)|Latin/Ajami|4||unimplemented|data scarcity|The STANDARD Kanuri variety (Borno, Nigeria) — the real target if we build "Kanuri" (not the kr macrolanguage umbrella). Referee PROBED 2026-07-19: no wikipron/kaikki/epitran → authored-⛔-only. See kr.
mos|Mossi (Mooré)|Niger-Congo (Gur)|Latin|9||unimplemented||Burkina Faso; new branch (Gur).
bal|Balochi (Southern)|Iranian (NW)|Arabic (Balochi)|9||implemented||Southern Balochi, CROSS-SCRIPT (Arabic + Roman). Authored from Jahani & Korn (2009) + Korn (2005a). Cross-script LEXICON (balochi-lexicon.tsv, 399 words: 55 curated + 344 from Korn Etymological Index; ASJP-corroborated) recovers the vowels the Arabic abjad loses (short a/i/u unwritten + و/ی conflate uː/oː, iː/eː); Roman orthography is phonemic. Independent referee = ASJP Southern-Balochi bcc (CC0, coarse ~40w) corroborates the inventory ~97%. Fills the RETROFLEX-Iranian gap (ʈ ɖ ɽ vs dental t̪ d̪; ق->k; unaspirated). Arabic-OOV still skeleton-defective (⛔ tail); lexicon+Roman full-voweled. 🔷 single-referee-family.
tg|Tajik|Iranian (SW)|Cyrillic|8|4|unimplemented||Persian variety in Cyrillic — different script from done fa.
ki|Kikuyu (Gikuyu)|Niger-Congo (Bantu)|Latin|8||unimplemented||Kenya Bantu.
bgc|Haryanvi (Bangaru)|Indo-Aryan|Devanagari|10||implemented||ALIAS to the Hindi engine (served_by=hi). Referee PROBED 2026-07-19: no wikipron, no kaikki page, no epitran bgc-Deva map -> NO independent referee. Western Hindi (Hindustani group), segmentally ~= Hindi (28-30 consonants, same 4-way stop contrast); documented differences (vowel free-variation a~e/i~e, a marked retroflexion tendency r/n/l, intonation) are ALLOPHONIC/prosodic, not a categorical grapheme->IPA delta. Served via hi (nearest verified sibling) as a labelled approximation.
sat|Santali|Austroasiatic (Munda)|Ol Chiki|7||unimplemented||New script family (Ol Chiki).
ee|Ewe|Niger-Congo (Kwa)|Latin|7||unimplemented||Ghana/Togo.
ks|Kashmiri|Indo-Aryan (Dardic)|Arabic (Kashmiri)|7||unimplemented||Dardic; vowel-rich abjad.
mn|Mongolian (Khalkha)|Mongolic|Cyrillic|6||unimplemented||Cyrillic (+ traditional Mongolian script).
bo|Tibetan|Sino-Tibetan|Tibetan|6||unimplemented||Large orthography-to-sound gap (historical spelling).
kok|Konkani|Indo-Aryan (Southern)|Devanagari|2||unimplemented||Was in espeak-portable; small.
"""

COLS = ["code","name","family","script","l1_speakers","l2_speakers",
        "wikipron_entries","kaikki_entries","epitran","espeak",
        "decision","rejection_reason","verdict","served_by","pr","notes"]

def m(x):  # millions string → absolute int (or "")
    x=x.strip()
    return "" if x=="" else str(int(round(float(x)*1_000_000)))

def rows_from_blocks():
    meta={}
    for l in META.strip().splitlines():
        c,fam,scr,l1,l2=l.split("|"); meta[c]=(fam,scr,m(l1),m(l2))
    ref={}
    for l in REF.strip().splitlines():
        c,w,k,e,s=l.split("|"); ref[c]=(w,k,e,s)
    vext={}
    for l in VERDICTS_EXTRA.strip().splitlines():
        c,v=l.split("|"); vext[c]=v
    served={}
    for l in SERVED.strip().splitlines():
        c,sb=l.split("|"); served[c]=sb
    rows=[]
    for l in IMPL.strip().splitlines():
        c,v,name=l.split("|")
        fam,scr,l1,l2=meta.get(c,("","","",""))
        w,k,e,s=ref.get(c,("","","",""))
        rows.append([c,name,fam,scr,l1,l2,w,k,e,s,"implemented","",v,served.get(c,""),"",""])
    for l in EXTRA.strip().splitlines():
        c,name,fam,scr,l1,l2,dec,reason,notes=l.split("|")
        w,k,e,s=ref.get(c,("","","",""))
        rows.append([c,name,fam,scr,m(l1),m(l2),w,k,e,s,dec,reason,vext.get(c,""),served.get(c,""),"",notes])
    return rows

def main():
    here=os.path.dirname(os.path.abspath(__file__))
    rows=rows_from_blocks()
    rows.sort(key=lambda r: r[0])
    with open(os.path.join(here,"catalogue.tsv"),"w",newline="") as f:
        w=csv.writer(f,delimiter="\t")
        w.writerow(COLS)
        w.writerows(rows)
    print(f"wrote catalogue.tsv — {len(rows)} rows")

if __name__=="__main__":
    main()
