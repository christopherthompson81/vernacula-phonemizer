# ASR × phonemization — arbitrating readings, and auditing transcript/audio divergence

Investigation log. Opened 2026-07-30 while deciding how English should read `i.e.` and `e.g.` (#562).

## Why this exists

The phonemizer's output is a **training target paired with audio**. Every normalization decision is
therefore answerable in a way most of them were not before: *what did the reader actually say?* Until now
the corpus work has read only the FLEURS **transcript column**, which is the script the reader was given —
not a record of what came out of their mouth. Where those differ, phonemizing the transcript produces IPA
for phonemes that were never uttered, and the TTS fine-tune learns an alignment that is simply wrong.

ASR closes that loop. Vernacula ships Parakeet TDT v3, so the audio is already readable locally.

## Run 1 — 2026-07-30 11:40

**Question.** English `i.e.`/`e.g.` have several interchangeable spoken readings (the letter names, the
English gloss, the full Latin). The project chose the gloss. Does that choice match the audio, and if not,
what does?

**Method.** All six en_us FLEURS recordings containing one of the two forms — four distinct sentences, two
of them read twice by different speakers. Audio comes out of the FLEURS `train.tar.gz`; ASR is the
Vernacula CLI running the production pipeline (Sortformer diarization → Parakeet ASR) on the CPU EP.

```sh
# 1. which recordings contain the form
cd /mnt/data/omnivoice_ipa/corpus/fleurs_transcripts/data/en_us
grep -h 'e\.g\.\|i\.e\.' *.tsv | awk -F'\t' '{print $2}' | sort -u   # col 2 = the wav name

# 2. pull just those out of the archive (it is 1.4 GB; do not extract all of it)
tar -xzf /mnt/data/omnivoice_ipa/corpus/audio_cache/data/en_us/audio/train.tar.gz train/<id>.wav

# 3. transcribe
cd /mnt/data/Programming/vernacula/src/Vernacula.CLI
dotnet build -c Release -p:EP=Cpu -p:Platform=x64
dotnet run -c Release -p:EP=Cpu -p:Platform=x64 --no-build -- \
    --audio <wav> --model /home/chris/.local/share/Parakeet/models \
    --output <out>.txt --export-format txt
```

**Raw finding.**

| recording | transcript | what the reader said |
|---|---|---|
| 8943036589905798133 | `i.e. 0 or 1` | *"values, zero or one"* — **omitted** |
| 8444646757018174763 | `i.e. 0 or 1` | **omitted** |
| 6335280368099145037 | `(e.g. in the Netherlands` | *"E.g., in the Netherlands"* — letter names |
| 12268645777003278278 | `e.g. the Pennsylvania Wilds` | *"e. g. the Pennsylvania Wilds"* — letter names |
| 9035023492553755712 | `(e.g. visa)` | *"For example, a visa"* — the gloss |
| 9748067524408569243 | `(e.g. visa)` | *"Example given a visa"* |

**What it implies.**

1. **The question had no answer, and that IS the answer.** `e.g.` gets three different readings across four
   recordings — including two speakers reading *the same sentence* differently. There is no consistent
   target to match, so the choice of reading is free, and the concern that prompted the check ("the gloss
   may misalign against the audio") does not survive contact with the data.
2. **`i.e.` was not read at all.** Both readers of that sentence treated it as unspoken punctuation. This
   was not a reading either of us had considered, and it is the more consequential result: for that
   construction, *any* expansion adds phonemes the audio does not contain. Letter names would have been
   just as wrong as the gloss.
3. **Transcript ≠ audio is a data-quality issue, not a curiosity.** 2 of 6 recordings here diverge from
   their script on the very token under study. If that rate holds anywhere near generally, a meaningful
   slice of the TTS training pairs teach a wrong alignment — and nothing in the current pipeline would
   notice, because every check to date compares the phonemizer against the *transcript*.

**Caveat on the method.** Parakeet emits normalized orthography, so `E.g.` in its output means it heard the
letter names — it would not invent that spelling from the words "for example", and conversely it wrote
"For example" where those words were spoken. That makes it a usable arbiter for *which* reading, but it is
not a phonetic transcription: it cannot distinguish reduced from full forms, and a token it drops may have
been spoken quickly rather than skipped. Two independent readers omitting `i.e.` is stronger evidence than
either alone would be.

## Next step, not yet taken

The obvious follow-up is a **divergence audit**: run ASR across a corpus, align to the transcript, and
report the utterances where they disagree — as a data-quality filter for the TTS pairs and as a source of
normalization questions worth asking. That is a corpus-preparation tool rather than a phonemizer change,
and it is not built. The cost is real (ASR over a whole corpus, per language), so it wants a measured
sample first: audit one language, see what the divergence rate actually is, and decide from that.

Two things that audit should NOT assume:
- that divergence means the transcript is wrong — the reader may have misread
- that a phonemizer change is the fix — often the right response is to drop the pair
