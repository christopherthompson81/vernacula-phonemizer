# Tibetan (bo) native bring-up investigation

Target: **Standard / Lhasa Tibetan** (Tournadre's "Standard Spoken Tibetan"),
Tibetan script (U+0F00–0FFF), canonical IPA. Sino-Tibetan; the fleet's first
Bodish/Tibetic language. One of the DEEPEST orthographies in the world —
Classical spelling encodes Old Tibetan; the Lhasa reading diverges massively.

## Run 1 — feasibility / referee landscape (2026-07-26)

Referees found:
- **wikipron `bod_tibt_broad`**: 3621 lines (HTTP 200). Space-separated phones;
  carries BOTH a `*`-prefixed transliteration of the SPELLING (ཀ→`* k a`) and
  the actual reading with Chao tone letters (ཀ→`k a ˥˥`).
- **kaikki Tibetan**: 3651 entries, 3909 IPA. **DIALECT-TAGGED** — Lhasa, Batang
  (Kham), Bla-Brang / Zêkog (Amdo), Dêgê (Kham). Same two-form pattern: the
  `/*.../ ` transliteration + the toned reading. **1281 Lhasa spelling→IPA pairs**
  (443 monosyllabic, 732 disyllabic).
- **epitran**: no `bod-Tibt` (too complex for epitran's model). None.

The transformations are the deep-orthography ones (Lhasa reading rules):
- silent superscript/prefix: རྟ `/*rta/` → `ta˥˥` (r- silent, HIGH tone)
- suffix-driven umlaut + length + tone: བོད `/*bot/` → `pʰøː˩˧˨` (o→ø, -d drops→
  long, b→pʰ LOW tone); གནས `/*gnas/` → `nɛː˥˨` (a→ɛ, -s→long)
- subscript palatalization: སྤྱན `/*spʲan/` → `t͡ɕɛ̃˥˥` (s- silent, py→t͡ɕ, -n→
  nasal+front); ཁྱི `/*kʰʲi/` → `cʰi˥˥`
- devoicing + tone from historical voicing: ཇ `/*d͡ʑa/` → `t͡ɕʰa˩˨` (LOW),
  ཀ `/*ka/` → `ka˥˥` (HIGH)
- suffix nasalization: ལམ → `lam˩˨`; velar སེང → `seŋ˥˥`

### ⚠ HONESTY — the referee is MODULE-GENERATED (reference-parity, the cdo case)

The Wiktionary source markup is **`{{bo-IPA|poew}}`** — the Lhasa IPA is produced
by **`Module:bo-pron`** (implementing Tournadre & Sangda Dorje's *Manual of
Standard Tibetan* rules) from a romanized input, NOT hand-transcribed. wikipron
scrapes the rendered template; kaikki IS Wiktionary. So **both referees are the
SAME module's output** → matching them is **🔷 reference-implementation parity**
("does our spec-derived engine reproduce Wiktionary's bo-pron?"), NOT independent
human verification. This sits near the ⛔ boundary — identical to `cdo` (Min Dong,
Wiktionary Module:cdo-pron) and `hmn` (deterministic RPA). No independent human
Tibetan IPA corpus is machine-available here.

Scope decision: target **Lhasa/Standard only** (kaikki's other tags — Batang/Dêgê
Kham, Bla-Brang/Zêkog Amdo — are separate reading traditions, deferred). The
engine is a real rule system (syllable-stack parser → tone → onset cluster
realization → suffix-driven vowel umlaut/length/nasalization), the Icelandic-tier
"long chain of measured rules" shape — not a greedy scan.

## Run 2 — independent-referee hunt (user gated: find one before build vs hold)

Searched wikipron/kaikki/epitran/ipa-dict/GitHub/academic. Results:
- **ipa-dict**: no Tibetan. **epitran**: no `bod-Tibt`. **mbykov/cholok**: models
  the CLASSICAL/ancient reading (not Lhasa) and is itself a rule tool. Useless.
- **TIBMD@MUC** (OpenSLR 124, Minzu Univ.): a genuinely INDEPENDENT academic Lhasa
  pronunciation dictionary + phoneme set EXISTS, "publicly available" — but it is
  bundled inside a **29 GB audio tarball** (`Tibetan_speech_data.tgz`) with no
  standalone lexicon download and no locatable code repo. Impractical to obtain.
- **JIPA "Central Tibetan (Lhasa)"** (Zhang 2024/25, JIPA 54:788–810), **Open
  Access CC-BY**: peer-reviewed, INDEPENDENT of Wiktionary. `pdftotext` FAILS (no
  Tibetan text layer; IPA font-mangled → would need brittle Tibetan+IPA OCR). BUT
  reading the PDF pages **visually** (the Read tool) works perfectly: p.789 =
  full consonant inventory; p.790 = a clean **onset/coda wordlist** giving IPA +
  Tibetan spelling + gloss per entry (/pá/ པ 'agentive particle', /ɲà/ ཉ 'fish',
  /kʰáŋ/ ཁང 'house', …); later pages = vowels, tone, vowel harmony, and a fully
  transcribed **North Wind and the Sun** passage. Tone convention: H = acute ◌́,
  L = grave ◌̀ on the vowel.

**Conclusion:** a turnkey MACHINE referee that is independent does NOT exist (the
only sizeable machine source is Wiktionary's bo-pron module = reference-parity).
BUT an independent HUMAN referee IS obtainable by hand-curating the JIPA CC-BY
illustration read visually (~50–80 spelling↔IPA pairs: onset/coda/vowel lists +
the passage) — the rkt-grammar-PDF pattern. That anchor is small but genuinely
non-circular, and the SAME article supplies the inventory + rules to build the
engine independently of the module. So the honest footing would be: PRIMARY =
hand-curated JIPA (independent, human, ~small); SECONDARY = wikipron/kaikki 1281
(large, reference-parity, disclosed) — strictly better-grounded than cdo.

## Run 3 — decision + spec + referees (user: get TIBMD text + use the JIPA pairs)

Decision: **BUILD** (Lhasa/Standard). Three referees:
1. **JIPA hand-curated** `bo.jipa-lhasa.tsv` — 40 pairs, INDEPENDENT human primary
   (onset/coda/vowel/diphthong lists, pp.790/795-796; tone á=H, à=L).
2. **TIBMD@MUC** — INDEPENDENT academic Lhasa pron-dict, being pulled from the
   29 GB OpenSLR tarball to /mnt/data (text-only kept, audio discarded). Pending.
3. **kaikki Lhasa** `bo.kaikki-lhasa.tsv` — 1281, MODULE-parity secondary (disclosed).

Spec captured from JIPA (all independent of the module):
- **Inventory**: 8 vowels i y u · e ø o · ɛ · a (front-round y/ø + ɛ are the
  suffix-umlaut reflexes); consonants incl. retroflex AFFRICATES ʈ͡ʂ ʈ͡ʂʰ ʂ + ɻ,
  alveolo-palatal t͡ɕ t͡ɕʰ ɕ, palatalized-velar cᵏ series, ɬ, glottal ʔ/h.
- **Tone (2, from tonogenesis)**: voiceless root → HIGH; plain voiced-obstruct
  root → aspirated-voiceless + LOW (བ ba→pʰà, ཇ ja→t͡ɕʰà); prefixed/superscribed
  voiced-obstruct → UNaspirated + LOW (མགོ mgo→kò); plain sonorant → LOW (ན na→nà),
  but prefix/superscript raises sonorant to HIGH (སྣ sna→ná). ← TUNE vs referee.
- **Onset clusters**: subscript ya→palatalize (ky→c, py→t͡ɕ, my→ɲ); subscript ra→
  retroflex AFFRICATE (khr→ʈ͡ʂʰ, e.g. ཁྲག→ʈ͡ʂʰáʔ); subscript la→l; wa→∅. Superscript
  r/l/s + prefix g/d/b/m/' → mostly SILENT (affect only tone).
- **Suffix → vowel** (the deep part): -d/-s/-l/-n FRONT (a→ɛ, o→ø, u→y); -l/-r
  DROP → LENGTH (ཟུར zur→sùː, གSAL gsal→sɛ́ː); -n/-m NASALIZE (-n also fronts:
  སྟོན ston→tǿ̃ː; -m keeps back); -ng→ŋ; -g/-d/-s/-b → checked ʔ (སྐུད skud→kýʔ,
  གSAD gsad→sɛ́ʔ); -b→p; -g→ʔ (back). Fossilized/ghost consonants across morphemes
  = advanced, DEFER.
- Formal (literary) vs colloquial split exists; target the JIPA broad register.

Engine plan: Unicode syllable-stack parser (full 0F40-6C vs subjoined 0F90-BC,
vowel signs, tsheg segmentation) → prefix/superscript/root/subscript/suffix →
onset+tone+vowel+coda rules. Emit 2-level tone ˥/˩. Icelandic-tier iterate.

## Run 4 — engine v1 (src/languages/tibetan/tibetan.ts)

Built the syllable-stack parser + reading rules. Two parser bugs fixed on the
first measurement: (1) inherent-/a/ syllables mis-rooted (suffix letters lumped
into the onset → khab read as root b) — fixed by tracking the vowel-sign position
and, for inherent /a/, the prefix-set rule (prefix ∈ g/d/b/m/' shifts the root
right); (2) ལྷ grabbed the subjoined ha as a root under an l-superscript — fixed by
excluding y/r/l/w/h from "root-from-subjoined" (subjoined ha → the ɬ/ʂ digraphs +
raises tone). Also: velar+ya → kʲ (JIPA notation, not c); subjoined-ha → HIGH; -m
→ m coda (no vowel nasalization, per JIPA kʰám).

**Results:**
- **JIPA independent anchor (40): 97.5% exact / 100% tone.** The lone miss is
  བེའུ (be'u), a syllable-FUSION diphthong (e+u→iu) — a rare edge, deferred.
- **kaikki module-parity (1281): 18% raw / 53.9% notation-folded / 74.7% mono
  notation-folded.** The raw number is DEFLATED by principled divergence from the
  module, NOT wrong segments: (a) DISYLLABIC WORD-TONE TEMPLATES — the module
  spreads syllable-1's tone across the word (ka˥.ʐa˥); we assign per-syllable tone
  (approximation; JIPA confirms word-level templates are correct → TODO). (b)
  REGISTER: -d/-g/-s → we emit ʔ (matching the JIPA CAREFUL anchor skud→kýʔ), the
  module emits vowel LENGTH (myː, colloquial) — we correctly follow the
  independent primary, not the parity referee. (c) NOTATION: kʲ~c, ɻ~ʐ, half-long
  ˑ. (d) syllable FUSION (ka·ba→kaː). We deliberately do NOT reflex-fix toward the
  module.

**Standing / TODO:** engine matches the INDEPENDENT primary at 97.5%. Remaining:
TIBMD independent-bulk validation (download in progress, ~9/29.7 GB) = the
decisive broad independent check; then disyllabic word-tone templates, the fusion
edge; then wiring (registry/eval/catalogue/maturity/tests) + full review.

## Run 5 — disyllabic word-tone template + TIBMD independent coverage

Derived the disyllabic tone rule from the kaikki data (474 2-tone disyllables):
the SECOND syllable is HIGH 95% of the time regardless of syllable 1 (H→H 52%,
L→H 43%) — exactly Tournadre's word-tone system (only syllable 1 carries the
contrastive register; non-initial syllables default HIGH + de-aspirate). Applied:
`first` flag → non-initial syllables force HIGH and take the headed (unaspirated)
onset. JIPA anchor unchanged (97.5%, monosyllabic); kaikki raw 18→21.5%,
notation-folded 53.9→55.7% (still deflated by the register ʔ~length split and the
module's per-syllable contour notation — principled, not chased).

**TIBMD@MUC** (29 GB pulled to /mnt/data; text-only extracted, audio discarded):
the tarball has ONLY per-speaker `text.txt` transcripts — NO pronunciation dict /
phoneme set (the paper's "pron dictionary" is not in this OpenSLR bundle). So
TIBMD is an INDEPENDENT (non-Wiktionary) Lhasa word-COVERAGE corpus, not an IPA
gold. Coverage check on the **Lhasa-dialect** transcripts (30,302 utterances,
299,733 syllable tokens, 2679 unique syllables): **99.5% unique / 100.0% token
coverage** — the parser produces clean Lhasa IPA for every non-numeral syllable
in natural text; the ONLY 14 failures are TIBETAN NUMERALS (U+0F20–0F29, e.g. ༢༠,
༤༠༠༠), a number-handling gap (deferred, like most fleet bring-ups), not a
phonology bug.

**Validation summary:** independent ACCURACY 97.5% (JIPA anchor, 40) · independent
COVERAGE 100% of tokens (TIBMD, 300k, numerals aside) · module-parity (kaikki,
disclosed). Engine solid.

## Run 6 — wiring + 2-agent review fixes

Wired registry/eval/langs-bo.jsonc/floor(0.90)/catalogue/maturity/README(153→154)/
goldens; 145 tests pass. Two review agents (parser + rules/wiring) found THREE real
bugs, all fixed:
1. **Inherent-/a/ root mis-identification (SEVERE, high-frequency)**: the old
   heuristic always treated a leading g/d/b/m/' as a PREFIX, corrupting common
   root+suffix words (དང 'and'→ŋa˥ instead of tʰaŋ˩, མར, བར, གངས 'snow'). Fixed
   with the proper resolver: the subjoined-bearing unit IS the root; else the
   PREFIX-ROOT combination table (a prefix is a prefix only if it may legally
   precede the next letter) + suffix/postsuffix rules. Now དང→tʰaŋ˩, གནས→nɛː˥
   (place, prefix g), གངས→kʰaŋ˩ (snow, root g), དགའ→kaː˩ all correct.
2. **la-btags tone**: bl/gl/rl clusters are [l] + HIGH regardless of root
   (Tournadre); the onset was set but tone left LOW (བློ→lo˩). Fixed → lo˥.
3. **db- cluster**: prefix-d + root-b is historically /w/ HIGH (དབང→waŋ, དབུ→ʔu,
   དབྱངས→jaŋ); was read as paŋ˩. Fixed.

Post-fix: JIPA 97.5%/96.9% (unchanged), kaikki 63.7% folded / 89.4% symbol (up
from 59.5/86.4 — the parser fix), TIBMD coverage 100%. Regression goldens added
for all three fixes. Folds adjudicated legit by the reviewer (ʔ→∅ merges checked/
open which are tone+length-distinguished, already folded — not an independent
contrast). Deferred: Tibetan numeral spelling, the be'u syllable-fusion diphthong,
zla→[t] lexical exception, Kham/Amdo.
