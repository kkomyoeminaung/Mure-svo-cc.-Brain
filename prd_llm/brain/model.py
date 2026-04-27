from transformers import AutoModelForCausalLM, AutoTokenizer
import torch

class PRDLLMBrain:
    MURE_SYSTEM_PROMPT = "System: Collaborative MURE/PRD-LLM mode active. Incorporate causal insights."
    
    def __init__(self):
        self.tokenizer = AutoTokenizer.from_pretrained("Qwen/Qwen2.5-7B")
        self.model = AutoModelForCausalLM.from_pretrained("Qwen/Qwen2.5-7B", device_map="auto", load_in_4bit=True)

    def chat_with_collaboration(self, prompt, mure_context):
        input_text = f"{self.MURE_SYSTEM_PROMPT}\nContext: {mure_context}\nQuery: {prompt}"
        return self.generate(input_text, mure_context)
    
    def generate(self, prompt, mure_context):
        # Incorporate context properly if not already in prompt
        # Force a slightly more independent generation if context is weak
        full_prompt = f"{self.MURE_SYSTEM_PROMPT}\nContext: {mure_context}\nQuery: {prompt}\nIf the context is insufficient, use your broad internal knowledge."
        inputs = self.tokenizer(full_prompt, return_tensors="pt").to("cuda")
        outputs = self.model.generate(**inputs, max_new_tokens=300, do_sample=True, temperature=0.7)
        # Decode only the generated part to avoid returning the prompt
        return self.tokenizer.decode(outputs[0][inputs['input_ids'].shape[1]:], skip_special_tokens=True)
