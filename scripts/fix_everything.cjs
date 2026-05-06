const fs = require("fs");

function fixAutoTrainPipeline() {
  const path = "MURE_AUTO_TRAIN_PIPELINE.ipynb";
  const nb = {
    "cells": [
      {
        "cell_type": "markdown",
        "metadata": {},
        "source": ["# 🌌 MURE-AGI Auto-Training Pipeline\n", "Run all cells sequentially."]
      },
      {
        "cell_type": "code",
        "metadata": {},
        "source": [
          "# Install unsloth exactly as per latest instructions\n",
          "!pip install \"unsloth[colab-new] @ git+https://github.com/unslothai/unsloth.git\"\n",
          "!pip install --no-deps xformers trl peft accelerate bitsandbytes vllm jsonlines tqdm\n"
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
          "import torch\n",
          "import os\n",
          "from transformers import TrainingArguments\n",
          "from datasets import load_dataset\n",
          "\n",
          "model, tokenizer = FastLanguageModel.from_pretrained('Qwen/Qwen2.5-3B-Instruct', max_seq_length=2048, load_in_4bit=True)\n",
          "model = FastLanguageModel.get_peft_model(model, r=16, target_modules=['q_proj','k_proj','v_proj','o_proj','gate_proj','up_proj','down_proj'], lora_alpha=16, lora_dropout=0, bias=\"none\")\n",
          "\n",
          "dataset = load_dataset('json', data_files=DATASET_PATH, split='train')\n",
          "dataset = dataset.map(lambda e: {'text': f\"<|im_start|>user\\n{e.get('instruction', '')}<|im_end|>\\n<|im_start|>assistant\\n{e.get('output', '')}<|im_end|>\"}, batched=False)\n",
          "\n",
          "trainer = SFTTrainer(\n",
          "    model=model, \n",
          "    tokenizer=tokenizer, \n",
          "    train_dataset=dataset, \n",
          "    dataset_text_field='text', \n",
          "    max_seq_length=1024, \n",
          "    args=TrainingArguments(\n",
          "        per_device_train_batch_size=4, \n",
          "        gradient_accumulation_steps=4, \n",
          "        max_steps=1000, \n",
          "        learning_rate=2e-4, \n",
          "        fp16=not torch.cuda.is_bf16_supported(), \n",
          "        bf16=torch.cuda.is_bf16_supported(), \n",
          "        output_dir=os.path.join(ROOT_DIR, 'checkpoints')\n",
          "    )\n",
          ")\n",
          "print('🚀 Train start!')\n",
          "trainer.train()\n",
          "model.save_pretrained(os.path.join(ROOT_DIR, 'MURE_Final_LoRA'))\n",
          "print('✅ Finished.')\n"
        ]
      }
    ],
    "metadata": {
      "kernelspec": { "display_name": "Python 3", "language": "python", "name": "python3" },
      "language_info": { "name": "python", "version": "3.10.12" }
    },
    "nbformat": 4,
    "nbformat_minor": 5
  };
  fs.writeFileSync(path, JSON.stringify(nb, null, 2));
}

function fixLLMFineTune() {
  const path = "MURE_LLM_FINETUNE.ipynb";
  const nb = JSON.parse(fs.readFileSync(path, "utf8"));
  
  // Make sure trainer.train() exists in cell 5
  let foundTrain = false;
  let trainSrc = nb.cells[5].source;
  for (let i = 0; i < trainSrc.length; i++) {
    if (trainSrc[i].includes("trainer.train()")) foundTrain = true;
  }
  if (!foundTrain) {
    nb.cells[5].source.push("trainer.train()\n");
  }

  // Also in cell 2, fix the install syntax just in case
  nb.cells[2].source = [
    "# ============================================================\n",
    "# CELL 2: Install Unsloth + Dependencies (one-time setup)\n",
    "# ============================================================\n",
    "import torch\n",
    "major_version, minor_version = torch.cuda.get_device_capability() if torch.cuda.is_available() else (0,0)\n",
    "# Install unsloth\n",
    "!pip install \"unsloth[colab-new] @ git+https://github.com/unslothai/unsloth.git\"\n",
    "if major_version >= 8:\n",
    "    !pip install --no-deps packaging ninja einops flash-attn xformers trl peft accelerate bitsandbytes\n",
    "else:\n",
    "    !pip install --no-deps \"xformers<0.0.27\" \"trl==0.8.6\" peft accelerate bitsandbytes\n",
    "print('✅ Dependencies installed!')\n"
  ];
  
  // Also fix dataset mapping which is missing!
  // Cell 5 needs dataset formatting
  const datasetMapping = [
      "\n# Format dataset\n",
      "def formatting_func(examples):\n",
      "    texts = []\n",
      "    for i, _ in enumerate(examples['instruction']):\n",
      "        texts.append(f\"<start_of_turn>user\\n{examples['instruction'][i]}<end_of_turn>\\n<start_of_turn>model\\n{examples['output'][i]}<end_of_turn>\")\n",
      "    return {'text': texts}\n",
      "\n",
      "from datasets import load_dataset\n",
      "dataset = load_dataset('json', data_files=DATASET_FILE, split='train')\n",
      "dataset = dataset.map(formatting_func, batched=True)\n\n"
  ];
  
  nb.cells[5].source = [...datasetMapping, ...nb.cells[5].source];

  fs.writeFileSync(path, JSON.stringify(nb, null, 2));
}

fixAutoTrainPipeline();
fixLLMFineTune();
console.log("Notebooks fixed.");
