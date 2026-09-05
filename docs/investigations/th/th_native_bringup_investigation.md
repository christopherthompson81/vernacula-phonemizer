# Thai (th) native bring-up

Target: Standard (Bangkok) Thai, canonical IPA. Slot #16 in the OmniVoice coverage set (contributes `ɤ`).
Thai is an authored bring-up (espeak-ng shipped only a broken partial) and the HARDEST script in the set: a
Brahmic abugida written with no inter-word spaces, wrap-around vowel circumfixes, silent leaders, and computed
(not lexical) tone.

## Approach — REUSE our authored syllabifier
The genuinely hard subsystem (vowel-span parsing, the epitran-based schwa/inherent-vowel algorithm, leading-
vowel reorder + อักษรนำ leaders, syllable segmentation, and the tone computation) was already written by us in
espeak-ng-portable's `src/Normalize/scriptSegmentation.ts` + `thaiPron.ts`. Rather than reimplement it, we PORT
those (→ `syllabifier.ts` + `thaiTone.ts`), which produce a per-syllable structure `{onset, nucleus, coda,
long, tone}`. In espeak-ng-portable that structure is emitted as PUA markers for the espeak L2S rules; here
`g2p.ts` RENDERS it to IPA directly — so vernacula stays espeak-independent while reusing the hard logic.

The lesson: a first from-scratch attempt (bespoke vowel-pattern matcher + greedy syllabifier) plateaued at 24%
— multi-syllable segmentation is the crux. Swapping in the ported syllabifier took it to 73% with only a thin
IPA renderer (consonant/vowel/coda/tone tables + glide/length/glottal conventions).

## Convention
Onset/coda consonant tables; vowel quality from the unit's graphemes + length from the scan's live/dead
computation; 5 tones as Chao contours (`˧` mid, `˨˩` low, `˦˥` high, `˥˩` falling, `˩˩˦` rising) after the
nucleus. Glide vowels ไ/ใ/ำ/เา are short + a j/w coda; centering diphthongs ua/ia/ɯa take no length. A written
SHORT open syllable takes a glottal `ʔ` — but only word-finally (minor/unstressed short syllables don't). Stress
`ˈ` on the first syllable; `ˌ` on the last when there are ≥3.

## Validation
vs the espeak-ng-portable authored gold (20k words): **exact 89.3%** (73.2% rules-only → 89.3% with the
dictionary; 95% on monosyllables). The lexical irregulars are closed by porting espeak's Thai dictionary
(dictionary.tsv, 1,789 entries, converted from espeak tone digits 1-5 → Chao contours placed after the nucleus,
98.8% self-match to the gold): length irregulars (ได้→daːj, น้ำ→naːm), silent-ร Sanskrit (สร้าง→saːŋ,
จริง→t͡ɕiŋ), cluster-under-leading-vowel (ใคร→kʰraj), and the short เ–ิ exceptions (เงิน) — which let the RULE
treat เ–ิ as long (ɤː) since the exceptions are dictionaried. Secondary stress fixed to even nuclei (≥2). The
remaining residual is ~8% compound words espeak splits into separate words (needs the seg-words segmentation,
also reusable from espeak-ng-portable) + ~3% minor segmental.

## Run 1 — reuse the authored syllabifier — 2026-07-13
Ported scriptSegmentation.ts (Thai portions) + thaiPron.ts; wrote a native IPA renderer over the scan output.
24% (from-scratch) → 73.2% (with the ported syllabifier). 111 tests pass; residual is dictionary-class lexical
irregulars.

## Run 2 — Thai dictionary (Chao notation) — 2026-07-13
Ported+converted espeak's data/th/dictionary.jsonl → dictionary.tsv (1,789 entries). The espeak phoneme tokens
use tone DIGITS 1-5 before the vowel; the converter maps them to Chao contours (˩˩˦/˨˩/˧/˦˥/˥˩) placed AFTER
the nucleus (with length before tone), diphthongs as one nucleus, and stress ˈ-first + ˌ-even-nuclei. 98.8%
self-match to the gold. Wired as a lookup before the rule engine. Also: fixed the g2p secondary-stress rule
(even nuclei ≥2, not last), re-enabled เ–ิ→ɤː long (exceptions now dictionaried), and a final-short-open glottal
(ณ→naʔ). 73.2%→89.3%. Next: port segmentThai + seg-words for the ~8% compound-split residual.
## Run 3 — word segmentation (seg-words DAG) — 2026-07-13
Ported segmentThai + segmentByDag + thaiTccBoundaries (→ segment.ts) and the seg-words set (64,808 words: ICU
thaidict + PyThaiNLP + curated extra). phonemizeWord now SEGMENTS a token into words via the DAG (TCC-boundary-
constrained maximal matching) and phonemizes each, joined by a space — so a compound corpus token espeak split
(ก็คือ → ก็ คือ) now matches. 89.3%→97.1% exact (98.4% on monosyllables). Thai reaches parity-ish by reusing
all three authored subsystems (syllabifier, dictionary, segmentation) + a native IPA renderer. Residual ~3% is
minor segmental (rare vowel/length edge cases, a few multi-word dict compounds).
## Run 4 — 2026-07-14 — segmentation is DONE; honest residual audit + re-tier 🟠→🟡

Revisited the "compound segmentation" 🟠 gap. It was already CLOSED in Run 3 (segment.ts + 64.8k-word seg-words
DAG, wired into phonemizeWord) — the maturity note was stale. Confirmed on independent running text: เขาไปโรงเรียน
→ เขา|ไป|โรงเรียน, ฉันรักประเทศไทย → ฉัน|รัก|ประเทศไทย, วันนี้อากาศดี → วันนี้|อากาศ|ดี. Running-text espeak-gold
89.3→97.1% (Run 3), with an INDEPENDENT word-list (ICU thaidict + PyThaiNLP), so the segmentation itself isn't
espeak-circular.

Audited the wikipron residual (81.9% folded, 1024 mismatches) to find what's actually left:
- **Isolated consonant-LETTER names** (23 words): ก→kɔː vs our inherent-vowel ก→kaʔ. Tried the letter-name reading
  (append อ → Cɔː); +0.2% but it's an ADVERSARIAL, INCONSISTENT referee — wikipron gives ก→kɔː (name) yet จ→t͡ɕaʔ
  (inherent) and ณ→naʔ (the WORD "at"), and ฤ/ฦ are vocalic letters. It also broke the deliberate ณ→naʔ test.
  REVERTED — this is isolated-lemma noise, not a quality gap.
- **Sanskrit/Pali multi-syllable readings** (~50+): กรมการ→ours kon-ma-kaːn vs krom-ma-kaːn; การพิจารณา→…jaːn-naː
  vs …jaːra-naː. The single/short forms are RIGHT (กรม→krom ✓, ตรง→troŋ ✓, ทรง→soŋ ✓); the failures are word-internal
  ร in longer seg-words the syllabifier mis-parses (cluster-vs-inserted-vowel ambiguity). This is the genuine real
  residual — a bounded lexical class, dictionary-closable (espeak resolves it the same way, via its dictionary;
  we already imported all 1789 espeak entries, so the tail beyond that needs new entries). Not chased: low-leverage
  long tail + high regression risk in the 31 KB ported syllabifier (111 tests green).

VERDICT: the compound-segmentation SUBSYSTEM is done → off 🟠. A specific dictionary-closable Sanskrit class remains
→ **🟡**. With this, NO language sits at 🟠 — every language is ✅ or 🟡.

## Run 5 — 2026-07-14 — word-internal ר-cluster fix (partial Sanskrit close)

Traced the multi-syllable ר failures to a rule interaction in the ported epitran schwa-fates algorithm: for กรม
ALONE, ר keeps its schwa → rule 5 clusters ก+ר → krom. But inside กรมการ, the extra context lets **rule 3**
(ə→0 / VC_CV) delete ר's cluster schwa BEFORE rule 5 runs, so rule 4 neutralizes the stranded ר→น → kon·ma·kaːn.

Fix: rule 3 now PROTECTS a cluster schwa — when w[1] is ר right after an onset that forms a valid kr/pr/tr cluster,
the middle schwa is left for rule 5 to cluster. Restricted to ר (med==="r"): kr/pr/tr are almost always true
clusters, whereas ל/ו after an onset are usually the inserted-o + ל-coda reading (ผล→pʰon, พล→pʰon) — an unrestricted
guard broke 6 ל-words (ผลงาน, พลเอก…) to fix 3 ר-words. Narrowed: **FIXED 2, BROKE 0** on the referee (81.9%,
+2 net); real running-text wins beyond the referee (กรมการ→krom·kaːn, ตรงนั้น→troŋ·nan, ผลกระทบ's กร→kra). Suite
261/261. Shared thaiIsCluster() helper (rules 3 & 5).

Thai STAYS 🟡: this closes the structural kr-cluster half; the remaining ר residual is genuinely lexical — Sanskrit
inserted-vowel (กรกฎา→ka-ra, same graphemes as the cluster reading) and coda-sonorant doubling (กรมการ→krom·MA·kaːn,
ธรรม→tʰam·ma) — which no structural rule can disambiguate and espeak resolves via its dictionary. Closing that tail
needs dictionary expansion from an independent pronunciation source (not the wikipron referee → circular), a
separate effort. The ceiling for the rule engine alone is here; ✅ would require the lexical layer.

## Run 6 — 2026-07-14 — dictionary layer: kaikki (Wiktionary) expansion for the lexical tail

Per user steer (kaikki is the authoritative Thai pronunciation source — the only path to correct lexical output,
accepting the circularity), expanded the dictionary from espeak-ng-portable's th_kaikki_gold (9025 Wiktionary
IPA+tone entries), following espeak's methodology: dictionary ONLY the words the rules can't derive.

CONVERTER (tools/gen/build-th-kaikki-dict.mts): kaikki IPA → our convention — strip syllable dots + unreleased ̚
+ offglide ̯; move the tone from after-coda to after-nucleus (wat̚˨˩→wa˨˩t); add stress ˈ/ˌ. VALIDATED: on words
our rules already get right, converted-kaikki reproduces our EXACT output **6172/6173 = 100.0%** — so the converter
is faithful and any remaining diff is a real rules-gap, not a conversion artifact.

Added **+774 multi-syllable content words** (1789→2563). Restricted to ≥2-syllable words: single letters (ก→kɔː
name) and monosyllabic function words (ก็, ณ) are where kaikki's letter-name/colloquial noise lives, and the rules
already handle real monosyllables ~98% — an unfiltered dump broke 2 goldens (re-introduced the adversarial
letter-names). The additions are exactly the Sanskrit/Pali tail the rules mis-derived: วิทยาศาสตร์ (science),
ประวัติศาสตร์ (history), ประชาธิปไตย (democracy), คณิตศาสตร์, อุตสาหกรรม — all now correct.

MEASUREMENT (honest): wikipron full-system 81.9→84.7%, but kaikki and wikipron are BOTH Wiktionary, so the 874
dict-covered wikipron words match CIRCULARLY — that rise is NOT independent validation. The independent signal is
the RULE-ENGINE accuracy on OOV (non-dictionaried) words: **82.7%** (3944/4771) — the rules' true quality on their
own domain, now that the dictionary absorbs the hard irregulars. Suite 262/262. This closes the lexical tail to the
extent an authoritative source covers it; the thin remainder (Sanskrit words absent from kaikki, e.g. กรมการ) has
no available source. → ✅ referee-limited (wikipron partly circular; the rule engine is the independent anchor).

### 6a — pruned redundant espeak imports
Our port's rule gaps differ from espeak's (esp. the Run-5 cluster fix), so 22 of the 1789 imported espeak entries are now RULES-DERIVABLE dead weight — mostly the kr/pr/tr cluster words espeak dictionaried but our rules now handle (ตรงกลาง/ตรงข้าม/กรงขัง/ปรบมือ/พรมแดน). The build tool is now self-maintaining: it empties the dict, runs RULES-ONLY, and keeps only entries the rules can't reproduce (prune) + adds kaikki the rules mis-derive. Net 1789 → 2541 (kept 1767, pruned 22, +774 kaikki). Referee unchanged by the prune (rules give identical output).
