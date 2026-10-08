# Results

## 1. Where Chitonga already exists in open AI data (checked 8 October 2026)

Every line was read at the source on that date.

**Models**
- **NLLB-200** (Meta): 202 language tags, including `bem_Latn`, `nya_Latn`, `tum_Latn`, `tsn_Latn` and `tso_Latn`, but **no `toi_Latn`**. It follows FLORES-200, which also has no Chitonga.
- **MMS** (Meta, speech): Chitonga (`toi`) is covered for language identification only; no speech recognition and no text-to-speech. (Gitonga of Mozambique, `toh`, has both. It is a different language.)
- **Hugging Face hub:** no model tagged for Chitonga.

**Data** (Hugging Face datasets tagged `toi`, the larger ones)

| Dataset | What | Size | Note |
|---|---|---|---|
| HuggingFaceFW/fineweb-2, `toi_Latn` | Web text | 1,664 documents, 2.9 MB | Mostly the 1963 Tonga Bible (bibles.org) and jw.org |
| HuggingFaceFW/finepdfs, `toi_Latn` | Text from PDFs | 6 documents | Health posters, a crop brief |
| cis-lmu/GlotCC-V1, `toi-Latn` | Web text | 19 documents | Religious sites |
| GiJoeHansFranz/Liseli | Monolingual and English-Tonga | 39,897 lines; 35,329 pairs | An earlier open Zambian corpus by Zamai's founder; mostly Bible text; 4,047 pairs are AI-generated dictionary entries and must not be used for testing |
| UBC-NLP/SimbaBench_dataset, `asr_test_toi` | Speech test set (from Zambezi Voice) | 463 utterances with transcripts | A ready Chitonga speech benchmark |
| Smaller | UDHR, PanLex, Wiktionary, GlotStoryBook, Tatoeba | small | |

- **OPUS** (en-toi): 8 sentence pairs in total.
- **MADLAD-400**: no Chitonga.

**What it means:** about 5 MB of raw Chitonga text exists, almost all of it Bible and Jehovah's Witness material, so a model trained on it alone writes like a sermon. Everyday Chitonga, human-translated and checked, is what is missing.

## 2. How current tokenizers split Chitonga (8 October 2026)

[`tokenizer_test.py`](tokenizer_test.py): 313 Chitonga sentences from our first translator, with their English originals as a control (3,068 Chitonga words, 4,480 English words). Chitonga words average 8.0 letters against 5.5 in English, because prefixes join the stem.

| Tokenizer | Chitonga tokens per word | English tokens per word | Same sentence, Chitonga vs English |
|---|---|---|---|
| NLLB-200 600M | 2.43 | 1.41 | 1.18x |
| Phi-4 mini / gpt-oss 20B (same tokenizer) | 2.78 | 1.23 | 1.55x |
| Gemma 3 4B / Gemma 4 E4B (same tokenizer) | 2.91 | 1.26 | 1.58x |
| Qwen3.5 9B | 3.07 | 1.26 | 1.67x |
| DeepSeek V3 | 3.20 | 1.25 | 1.74x |
| Llama 3.2 3B | 3.24 | 1.25 | 1.76x |
| Qwen3 4B | 3.29 | 1.26 | 1.79x |
| Mistral 7B v0.3 | 3.59 | 1.36 | 1.81x |

Reading: around the often-quoted line of three tokens per word, not badly fragmented; per-word counts overstate it because Chitonga words are long. The splits ignore the grammar (Gemma: *kucisyoma* → k|uc|isy|oma, not ku|ci|syoma), so extending the vocabulary is worth testing later, but it is not a precondition. Thanks to Ícaro Galvão do Nascimento for suggesting the test in [unslothai/unsloth#12593](https://github.com/unslothai/unsloth/discussions/12593).
