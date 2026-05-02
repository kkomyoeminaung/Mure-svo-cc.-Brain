const fs = require("fs");

const newNotebook = {
  "cells": [
    {
      "cell_type": "markdown",
      "metadata": {},
      "source": ["# 🌌 MURE-AGI Auto-Training Pipeline (Rebuilt Final)\n", "Run all cells sequentially."]
    },
    {
      "cell_type": "code",
      "metadata": {},
      "source": [
        "%%capture\n",
        "!pip install \"unsloth[colab-new] @ git+https://github.com/unslothai/unsloth.git\"\n",
        "!pip install --no-deps xformers trl peft accelerate bitsandbytes vllm jsonlines tqdm\n",
        "print('✅ Dependencies installed.')"
      ]
    },
    {
      "cell_type": "code",
      "metadata": {},
      "source": [
        "from google.colab import drive\n",
        "import os, torch, gc, json\n",
        "drive.mount('/content/drive')\n",
        "ROOT_DIR = '/content/drive/MyDrive/mure_auto_train'\n",
        "for p in [os.path.join(ROOT_DIR, 'dataset'), os.path.join(ROOT_DIR, 'checkpoints')]: os.makedirs(p, exist_ok=True)\n",
        "DATASET_PATH = os.path.join(ROOT_DIR, 'dataset', 'mure_1m_dataset.jsonl')"
      ]
    },
    {
      "cell_type": "code",
      "metadata": {},
      "source": [
        "from tqdm.auto import tqdm\n",
        "import random\n",
        "\n",
        "TARGET = 1000000\n",
        "if not os.path.exists(DATASET_PATH):\n",
        "    with open(DATASET_PATH, 'w') as f:\n",
        "        for i in tqdm(range(TARGET), desc='Generating'):\n",
        "            f.write(json.dumps({'instruction': 'Causal Analysis', 'output': 'Caused by complexity.'}) + '\\n')\n",
        "    print('✅ Dataset Created')\n",
        "else:\n",
        "    print('✅ Dataset already exists.')"
      ]
    },
    {
      "cell_type": "code",
      "metadata": {},
      "source": [
        "from unsloth import FastLanguageModel\n",
        "from trl import SFTTrainer\n",
        "from transformers import TrainingArguments\n",
        "from datasets import load_dataset\n",
        "\n",
        "model, tokenizer = FastLanguageModel.from_pretrained('Qwen/Qwen2.5-3B-Instruct', max_seq_length=2048, load_in_4bit=True)\n",
        "model = FastLanguageModel.get_peft_model(model, r=16, target_modules=['q_proj','k_proj','v_proj','o_proj','gate_proj','up_proj','down_proj'], lora_alpha=16, lora_dropout=0)\n",
        "\n",
        "dataset = load_dataset('json', data_files=DATASET_PATH, split='train')\n",
        "dataset = dataset.map(lambda e: {'text': f\"<|im_start|>user\\n{e['instruction']}<|im_end|>\\n<|im_start|>assistant\\n{e['output']}<|im_end|>\"}, batched=False)\n",
        "\n",
        "trainer = SFTTrainer(model=model, tokenizer=tokenizer, train_dataset=dataset, dataset_text_field='text', max_seq_length=1024, args=TrainingArguments(per_device_train_batch_size=4, gradient_accumulation_steps=4, max_steps=1000, learning_rate=2e-4, fp16=not torch.cuda.is_bf16_supported(), bf16=torch.cuda.is_bf16_supported(), output_dir=os.path.join(ROOT_DIR, 'checkpoints')))\n",
        "trainer.train()\n",
        "model.save_pretrained(os.path.join(ROOT_DIR, 'MURE_Final_LoRA'))\n",
        "print('✅ Finished.')"
      ]
    }
  ],
  "metadata": {
    "kernelspec": { "display_name": "Python 3", "language": "python", "name": "python3" },
    "language_info": { "codemirror_mode": { "name": "ipython", "version": 3 }, "file_extension": ".py", "mimetype": "text/x-python", "name": "python", "nbconvert_exporter": "python", "pygments_lexer": "ipython3", "version": "3.10.12" }
  },
  "nbformat": 4,
  "nbformat_minor": 5
};

fs.writeFileSync("MURE_AUTO_TRAIN_PIPELINE.ipynb", JSON.stringify(newNotebook, null, 2));
console.log("Notebook successfully rebuilt.");
