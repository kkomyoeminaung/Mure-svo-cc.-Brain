from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
import torch

class PRDLLMBrain:
    MURE_SYSTEM_PROMPT = "System: Collaborative MURE/PRD-LLM mode active. Incorporate causal insights."
    
    def __init__(self):
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.tokenizer = AutoTokenizer.from_pretrained("Qwen/Qwen2.5-7B")
        bnb_config = BitsAndBytesConfig(
            load_in_4bit=True,
            bnb_4bit_compute_dtype=torch.bfloat16,
            bnb_4bit_quant_type="nf4",
            bnb_4bit_use_double_quant=True,
        ) if self.device == "cuda" else None
        
        self.model = AutoModelForCausalLM.from_pretrained(
            "Qwen/Qwen2.5-7B", 
            device_map="auto" if self.device == "cuda" else None, 
            quantization_config=bnb_config
        )

    def chat_with_collaboration(self, prompt, mure_context):
        # BUG-PRD-04 Fix: Simplified pass-through to avoid double wrapping
        return self.generate(prompt, mure_context)
    
    def generate(self, prompt, mure_context):
        full_prompt = f"{self.MURE_SYSTEM_PROMPT}\nContext: {mure_context}\nQuery: {prompt}\nIf the context is insufficient, use your broad internal knowledge.\nResponse:"
        inputs = self.tokenizer(full_prompt, return_tensors="pt").to(self.device)
        outputs = self.model.generate(**inputs, max_new_tokens=300, do_sample=True, temperature=0.7)
        return self.tokenizer.decode(outputs[0][inputs['input_ids'].shape[1]:], skip_special_tokens=True)
