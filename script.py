import json

with open('/distillation_notebook.ipynb', 'r') as f:
    nb = json.load(f)

# Modify HuggingFace login & student model size
for cell in nb['cells']:
    if cell['cell_type'] == 'code':
        source_code = "".join(cell['source'])
        
        if 'google/gemma-2-2b-it' in source_code:
            cell['source'] = [
                 "from transformers import AutoTokenizer, AutoModelForCausalLM, BitsAndBytesConfig, LlamaConfig, LlamaForCausalLM\n",
                 "from huggingface_hub import login\n",
                 "import torch\n",
                 "\n",
                 "# Uncomment the below line and add your token if not using colab's secret manager\n",
                 "# login(token=\"YOUR_HF_TOKEN\")\n",
                 "\n",
                 "model_id = \"google/gemma-2-2b-it\"\n",
                 "bnb_config = BitsAndBytesConfig(load_in_4bit=True, bnb_4bit_compute_dtype=torch.bfloat16)\n",
                 "\n",
                 "print(\"📥 Loading Teacher (Gemma)...\")\n",
                 "tokenizer = AutoTokenizer.from_pretrained(model_id)\n",
                 "teacher = AutoModelForCausalLM.from_pretrained(model_id, quantization_config=bnb_config, device_map=\"auto\")\n",
                 "\n",
                 "print(\"🏗️ Initializing Student (SentenceLLM-400M)...\")\n",
                 "student_config = LlamaConfig(\n",
                 "    vocab_size=len(tokenizer), \n",
                 "    hidden_size=1024, \n",
                 "    intermediate_size=4096, \n",
                 "    num_hidden_layers=12,\n",
                 "    num_attention_heads=16,\n",
                 "    num_key_value_heads=8,\n",
                 "    torch_dtype=\"bfloat16\"\n",
                 ")\n",
                 "student = LlamaForCausalLM(student_config).to(torch.bfloat16).to(\"cuda\")\n",
                 "student.gradient_checkpointing_enable()"
            ]
            
        if 'loss.backward()' in source_code:
            new_source = []
            for line in cell['source']:
                new_source.append(line)
                if 'loss.backward()' in line:
                    new_source.append("            torch.cuda.empty_cache()\n")
            cell['source'] = new_source

with open('/distillation_notebook.ipynb', 'w') as f:
    json.dump(nb, f, indent=1)
