# Lao (lo) native bring-up

Lao — Tai-Kadai, ~30M (incl. Isan, Lao in Thai script), Brahmic ABUGIDA. Sibling of Thai but MORE PHONEMIC
orthography (Lao-PDR reforms stripped most Indic etymological spelling) → a LEANER rule g2p than Thai (no
Sanskrit-reading dictionary). Authored beyond-espeak. Referee: kaikki Lao (Wiktionary, 2310 words, human, tone-
marked). Tones stripped by the eval backbone → SEGMENTAL check.

## Architecture
Self-contained `lao.ts`: leading-vowel reorder (ເ ແ ໂ ໃ ໄ before the consonant) → L→R syllable scan matching the
vowel-sign PATTERN (Lao vowels are discontinuous, around the onset) → tone (class × live/dead × length × mark). The
Thai engine's syllabifier is Thai-orthography-specific, so Lao gets its own leaner scanner reusing the same shape.

## Run 1 — first compile
**57.4% folded** (kaikki, tone-stripped). Consonant/class tables, the 8-way coda, ~28 vowel patterns, ຫ-led high
sonorants, Cວ/Cຼ clusters, leading-vowel reorder. Next: read the residual for the biggest vowel-pattern gaps.

## Run 2 — parens fold + ວາ vowel + ວ→ʋ
**57.4 → 76.0%.** Three fixes: (1) kaikki wraps an optional secondary tone in parens `˩(˧)` — after the backbone
strips the Chao letters the bare `()` remained → fold them out (big); (2) `ວາ` is the VOWEL uːə (ຄວາຍ→kʰuːəj), not
a kʷ cluster; (3) ວ onset → [ʋ] (referee), labialised cluster ʷ~w folded.

## Run 3 — tone-mark extraction (76 → 89.1%)
THE structural fix. Lao tone marks (◌່ ◌້ ◌໊ ◌໋) combine ABOVE the onset and appear BEFORE the vowel signs in the
character stream (ຂ່າ = ຂ + ່ + າ), which broke vowel-pattern matching (ຂ່າວ read the tone mark as the vowel →
inherent-a garbage). `extractTones()` pulls the marks out up front, keyed by onset index, so the scanner sees
contiguous vowel signs (ຂ່າວ→kʰaːw, ເຂົ່າ→kʰaw, ຊ່ອງ→sɔːŋ). +13pp.

## Run 4 — Cວ vowel + ຫຼ ligature (89.1 → 92.7%)
Two fixes: (1) Cວ is the VOWEL uːə in nearly all cases (nwat→nuːət, luəŋ) — only Cວຽ is a labialised kʷ cluster;
flipped the default. (2) ຫ + ຼ (the lam-ligature, U+0EBC, not a base consonant) → [l] HIGH (ສະຫຼາດ→salaːt).

## Run 5 — ຣ → [l] (92.7 → 93.8%)
Modern Lao ຣ (rare, Indic-loan) is realized [l] (the referee uses l: ຈິດຕະລາ→t͡ɕittalaː, ກາລີຍະວິເສດ). Verdict:
**93.8% folded vs kaikki** (2310 words). The residual is diffuse — proper-noun silent letters (Luang Prabang
ຫຼວງພຣະບາງ→luəŋpʰabaŋ), Indic loanword vowels, and referee oddities. A solid authored bring-up: consonant classes,
8-way coda, ~30 vowel patterns, leading-vowel reorder, tone-mark extraction, ຫ-led high sonorants, Cວ/Cຼ, tone
(class×life×length×mark). Tone is APPROXIMATE (eval strips it); a Wiktionary-Module:lo-pron-exact tone pass is a
follow-up. 🟡 — single referee (no wikipron Lao); more phonemic than Thai, so no Sanskrit dictionary needed.

## Run 6 — exact tone pass (VERIFIED, tone approximate → 100% single-syllable)
Made the placeholder `tone()` exact and validated it against the referee's Chao contours (previously the eval
stripped tone entirely, so it was unmeasured). Derived the Vientiane 5-tone system directly from the kaikki
distribution over single-syllable words, tallied by (consonant class × live/dead × length × tone-mark):

- **mai ek ່** → ˧ (mid), all classes.
- **mai tho ້** → high class: ˧˩ (low-falling); low/mid: ˥˨ (high-falling).
- **no mark, LIVE** → low: ˧˥ (rising); high/mid: ˩ (low).
- **no mark, DEAD-long** → low: ˥˨; high/mid: ˧˩.
- **no mark, DEAD-short** → low: ˧ (mid); high/mid: ˧˥.

(high and mid differ ONLY under mai tho.) One structural bug surfaced: the centring diphthongs (uːə/iːə/ɯːə) carry
their length inside the quality string and set `long:false` so `scan()` doesn't double the ː — but that made them
read as dead-short/open-dead for tone. Added a `heavy = long || quality.includes("ː")` flag used for tone+live;
this fixed the whole diphthong cluster (ກວາດ kuːə+t̚: ˧˥→˧˩ dead-long; ຂວາ kʰuːə open: ˧˥→˩ live).

**Result: single-syllable segmentally-correct words 100.0% tone-correct (755/755).** Per-syllable tone where our
syllable count agrees with the referee: non-final 100.0% (537/537), final 99.5% (426/428). The full-word tone-sequence
figure (58.4%) is dominated by syllable-COUNT disagreements (our syllabification vs the referee's compound splits),
NOT tone errors — a segmentation matter, separate from the tone rules. Tone is no longer "approximate": the citation
tone system is exact. Segmental eval unchanged at 93.8% (tone is stripped there). Gold updated to the verified tones.

## Run 7 — segmental residual cleanup, 93.8 → 97.7%
Bucketed the 145 segmental misses (they were NOT diffuse noise — the "diffuse residual" claim was wrong). Six
clean structural classes, each fixed and measured:

1. **ອ/ວ onset-vs-vowel ambiguity (biggest, ~40 words).** ອ and ວ are BOTH vowel signs (ɔː / uːə) and onset
   consonants (ʔ / ʋ). The scanner's coda check mis-assigned the preceding consonant. Fixed with a 2-char
   lookahead: an ອ/ວ after a coda-candidate `nx` is a NEW onset (so `nx` is this syllable's coda) only when that
   ອ/ວ carries its OWN vowel (the char after it is a vowel sign/lead) — ຄົນອັງກິດ→kʰon.ʔaŋ.kit, ກັງວານ→kaŋ.ʋaːn;
   otherwise the ອ/ວ is `nx`'s own vowel and `nx` stays the onset — ອຸປະກອນ→ʔu.pa.kɔːn, ຂະບວນ→kʰa.buːən,
   ຂ້ານ້ອຍ→kʰaː.nɔːj. (First cut inverted the polarity → −1.4pp; the after2 test fixed it → +1.5pp net over the
   naive rule.)
2. **Final ຽ → [j] offglide (~13).** ຽ is the iːə vowel only when it directly follows the onset (consumed by
   resolveVowel); AFTER a nucleus it's a [j] coda (ຕາຽ→taːj, ຜູ້ຮ້າຽ→…haːj). Also killed the WRONG Cວຽ→kʷ
   labialised-cluster analysis: the referee writes muːə̯j, so ມວຽ = ມ + uːə(vowel) + j(coda) → muːəj, not mʷiːə.
3. **ໆ repetition mark (~3).** Duplicate the preceding syllable (ຊ້າໆ→saː.saː).
4. **ຫຼ + leading vowel (~13).** reorder() wasn't carrying the ຼ lam-ligature (U+0EBC) across the lead-vowel
   move, so ເຫຼັກ split the ligature → "heː.ka" instead of the high-[l] "lek̚". Also Luang Prabang ຫຼວງພຣະບາງ.
5. **reorder ວ/ຫ over-absorb (~7).** reorder() let ວ (and ຫ before a NON-sonorant) swallow the next consonant:
   ເວລາ→"ʋa.leː" (ວ ate ລ) and ເຫດ→"ha.deː" (ຫ ate ດ). Restricted: ວ never absorbs after a lead; ຫ absorbs ONLY
   a sonorant {ງ ຍ ນ ມ ລ ວ}/ຼ (shared HSON set with the scanner). → ເວລາ→ʋeː.laː, ເຫດ→heːt̚, ເຫດການ→heːt̚.kaːn.
6. **ເ◌ັຽ / ເ◌ັຍ → iːə (~7).** A missing vowel pattern (ເຊັຽ→siːə, ນີວຄະເລັຽ→…liːə), was falling through to ເ◌ັ→e.

**93.8% → 97.7% folded.** Tone unaffected (still 100% single-syllable; more words now segmentally-correct so the
tone-eval denominator grew 755→765). Gold 12/12 unchanged. Floor raised 0.90→0.95. The remaining ~54 misses are a
genuine **loanword/Sanskrit tail**, each needing lexical knowledge, not a rule: the ໌ (yamakkan) cancellation mark
+ Sanskrit codas (ວຽງຈັນທນ໌→ʋiːəŋ.t͡ɕan, ໄຟລ໌→faj), the kʷ labialised cluster with its aspiration-ordering fold
mismatch (ຄວັນ→kʷʰan), Sanskrit ສ codas that are variably [s]~[t̚] (Alaska laːs vs ປຼະເທສ tʰeːt̚), and English
loans (Easter, email). This is the honest ceiling for rule-only Lao without a loanword lexicon.
