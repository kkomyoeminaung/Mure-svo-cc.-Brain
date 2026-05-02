const fs = require("fs");
const path = "MURE_AUTO_TRAIN_PIPELINE.ipynb";
const nb = JSON.parse(fs.readFileSync(path, "utf8"));

// 1. Fix setup deps (Cell 2)
nb.cells[2].source = [
  "# 2. Install Dependencies\n",
  "%%capture\n",
  "!pip install -q \\\"unsloth[colab-new] @ git+https://github.com/unslothai/unsloth.git\\\"\n",
  "!pip install -q --no-deps xformers trl peft accelerate bitsandbytes\n",
  "!pip install -q vllm jsonlines tqdm\n",
  "print(\"🚀 Engines installed.\")\n"
];

// 2. Fix Generator VRAM OOM (Cell 3)
nb.cells[3].source[nb.cells[3].source.length - 1] = "print(\"✅ 1M Rule Dataset Ready.\")\n";
nb.cells[3].source.push(
  "import gc\n",
  "if 'llm' in locals():\n",
  "    del llm\n",
  "    gc.collect(); torch.cuda.empty_cache()\n",
  "    print(\"🧹 vLLM engine cleared for Training.\")\n"
);

// 3. Fix Training SFTTrainer Input (Cell 4)
nb.cells[4].source = [
  "# 4. Unsloth QLoRA (4-bit) Finetuning\n",
  "from unsloth import FastLanguageModel\n",
  "import torch\n",
  "from trl import SFTTrainer\n",
  "from transformers import TrainingArguments\n",
  "from datasets import load_dataset\n",
  "\n",
  "model, tokenizer = FastLanguageModel.from_pretrained(\n",
  "    model_name = \"Qwen/Qwen2.5-3B-Instruct\",\n",
  "    max_seq_length = 2048,\n",
  "    load_in_4bit = True,\n",
  ")\n",
  "model = FastLanguageModel.get_peft_model(\n",
  "    model, r = 16, target_modules = [\"q_proj\", \"k_proj\", \"v_proj\", \"o_proj\", \"gate_proj\", \"up_proj\", \"down_proj\"],\n",
  "    lora_alpha = 16, lora_dropout = 0, bias = \"none\",\n",
  ")\n",
  "\n",
  "dataset = load_dataset(\"json\", data_files=DATASET_PATH, split=\"train\")\n",
  "def formatting_func(examples):\n",
  "    texts = []\n",
  "    for inst, out in zip(examples.get(\"instruction\", []), examples.get(\"output\", [])):\n",
  "        texts.append(f\"<|im_start|>user\\n{inst}<|im_end|>\\n<|im_start|>assistant\\n{out}<|im_end|>\")\n",
  "    return {\"text\": texts}\n",
  "dataset = dataset.map(formatting_func, batched=True)\n",
  "\n",
  "trainer = SFTTrainer(\n",
  "    model = model, tokenizer = tokenizer, train_dataset = dataset,\n",
  "    dataset_text_field = \"text\",\n",
  "    max_seq_length = 1024,\n",
  "    args = TrainingArguments(\n",
  "        per_device_train_batch_size = 4, gradient_accumulation_steps = 4,\n",
  "        warmup_steps = 100, max_steps = 1000, learning_rate = 2e-4,\n",
  "        fp16 = not torch.cuda.is_bf16_supported(), bf16 = torch.cuda.is_bf16_supported(),\n",
  "        output_dir = MODEL_DIR, save_steps = 500,\n",
  "    ),\n",
  ")\n",
  "print(\"💪 Starting Training...\")\n",
  "trainer.train()\n"
];
fs.writeFileSync(path, JSON.stringify(nb, null, 1));
