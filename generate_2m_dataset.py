"""
MURE 2,000,000 Priming Data Generator
Generates a comprehensive fine-tuning dataset for MURE causal reasoning.
"""
import json
import random
import os
import time

random.seed(42)

# ============================================================
# 1. TEMPLATE BANKS (English + Myanmar)
# ============================================================

CAUSAL_TEMPLATES = [
    # Cause → Effect
    ("What happens when {cause}?", "When {cause}, {effect}. (Confidence: {strength:.2f})"),
    ("What is the effect of {cause}?", "The effect of {cause} is {effect}. (Strength: {strength:.2f})"),
    ("What is the consequence of {cause}?", "The consequence is {effect}."),
    ("If {cause}, what follows?", "If {cause}, then {effect} will follow."),
    ("Analyze the result of: {cause}.", "{cause} leads to {effect} with confidence {strength:.2f}."),
    ("Given: {cause}. What do we conclude?", "We conclude: {effect}."),
    ("Identify the outcome of {cause}.", "The outcome is: {effect}."),
    ("What does {cause} lead to?", "{cause} leads to {effect}."),
    ("Predict the effect: {cause}.", "Predicted effect: {effect} (certainty: {strength:.2f})."),
    ("Determine the causal result of {cause}.", "Causal result: {effect}."),
    # Reverse reasoning
    ("What could cause {effect}?", "A possible cause of {effect} is {cause}."),
    ("What leads to {effect}?", "{cause} is known to lead to {effect}."),
    ("Identify the cause of {effect}.", "The cause of {effect} is {cause}."),
    ("What precedes {effect}?", "{cause} typically precedes {effect}."),
    # Strength-based
    ("How strong is the causal link between {cause} and {effect}?",
     "The causal strength is {strength:.2f}. {cause} leads to {effect} with this confidence."),
    ("Is {cause} strongly linked to {effect}?",
     "{'Yes' if strength > 0.8 else 'Moderately'}, with a confidence of {strength:.2f}, {cause} leads to {effect}."),
    # Chain reasoning
    ("Explain the causal chain starting from {cause}.", 
     "Starting from {cause}: this leads to {effect}. From there, further downstream effects may occur."),
    ("Trace the logic: {cause}.", "Logic trace: {cause} → {effect}. Confidence: {strength:.2f}."),
    # Negation variants
    ("Does {cause} always lead to {effect}?",
     "{'Yes, with high confidence' if strength > 0.9 else 'Not always, but often'} — strength: {strength:.2f}."),
    # Myanmar templates
    ("{cause} ဆိုတာ ဘာကို ဖြစ်စေသလဲ?", "{cause} ကြောင့် {effect} ဖြစ်ပေါ်ပါသည်။ (ယုံကြည်မှု: {strength:.2f})"),
    ("{cause} ရဲ့ အကျိုးဆက်ကဘာလဲ?", "အကျိုးဆက်မှာ {effect} ဖြစ်ပါသည်။"),
    ("{cause} ဖြစ်ရင် ဘာဖြစ်မလဲ?", "{cause} ဖြစ်ပါက {effect} ဖြစ်ပေါ်ပါမည်။"),
    ("{cause} ၏ ရလဒ်ကား မည်သို့?", "ရလဒ်မှာ {effect} ဖြစ်ပါသည်။ (တိကျမှု: {strength:.2f})"),
    ("{effect} ဖြစ်ရခြင်းရဲ့ အကြောင်းရင်းက ဘာ?", "{cause} သည် {effect} ကို ဖြစ်စေသော အကြောင်းရင်းဖြစ်သည်။"),
]

# ============================================================
# 2. SYNTHETIC DOMAIN DATA (beyond the 78 base rules)
# ============================================================

DOMAIN_RULES = {
    "physics": [
        ("temperature increases", "molecules move faster", 0.98),
        ("pressure increases in a gas", "volume decreases at constant temperature", 0.99),
        ("electric current flows through resistance", "heat is generated", 0.97),
        ("mass increases", "gravitational pull increases", 0.98),
        ("velocity increases", "kinetic energy increases quadratically", 0.99),
        ("friction is applied to a surface", "thermal energy is produced", 0.95),
        ("light enters a denser medium", "it slows down and bends", 0.97),
        ("two like charges are brought close", "repulsive force increases", 0.99),
        ("an object is in free fall", "it accelerates at 9.8 m/s²", 0.99),
        ("sound travels through denser medium", "its speed increases", 0.93),
        ("capacitor is charged", "electric field builds between plates", 0.96),
        ("resonance frequency is matched", "amplitude of oscillation increases dramatically", 0.97),
        ("entropy increases in an isolated system", "disorder and randomness grow", 0.98),
        ("surface area increases", "rate of heat transfer increases", 0.91),
        ("magnetic field changes around a coil", "induced current is generated", 0.97),
    ],
    "chemistry": [
        ("acid and base react", "neutralization produces salt and water", 0.99),
        ("catalyst is added to a reaction", "activation energy decreases", 0.96),
        ("concentration of reactants increases", "reaction rate increases", 0.95),
        ("temperature of reaction increases", "reaction rate typically doubles per 10°C", 0.91),
        ("oxidizing agent contacts metal", "metal oxidizes and loses electrons", 0.94),
        ("polymerization occurs", "long chain molecules form", 0.96),
        ("hydrogen bonds form between molecules", "boiling point increases significantly", 0.93),
        ("pH drops below 7", "solution is acidic", 1.0),
        ("organic compound burns in oxygen", "CO₂ and H₂O are produced", 0.98),
        ("solute is added to solvent", "colligative properties change", 0.92),
    ],
    "biology": [
        ("cell divides by mitosis", "two identical daughter cells form", 0.99),
        ("insulin is released", "blood glucose is absorbed by cells", 0.97),
        ("virus enters host cell", "viral replication begins", 0.96),
        ("immune system detects pathogen", "antibody production begins", 0.94),
        ("photosynthesis occurs", "glucose and oxygen are produced", 0.98),
        ("mutation occurs in DNA", "protein structure may change", 0.88),
        ("natural selection acts on population", "allele frequencies shift", 0.94),
        ("dehydration occurs", "cell function is impaired", 0.92),
        ("ATP is hydrolyzed", "energy is released for cellular processes", 0.98),
        ("neurotransmitter binds to receptor", "postsynaptic potential changes", 0.95),
        ("cortisol levels rise", "immune function is temporarily suppressed", 0.87),
        ("regular aerobic exercise is performed", "cardiovascular efficiency improves", 0.92),
        ("caloric intake exceeds expenditure", "body mass increases", 0.91),
        ("sleep deprivation occurs", "cognitive performance declines", 0.93),
        ("microbiome diversity decreases", "immune regulation is disrupted", 0.86),
    ],
    "economics": [
        ("inflation rises", "purchasing power decreases", 0.94),
        ("unemployment rises", "consumer spending falls", 0.88),
        ("interest rates are cut", "borrowing increases", 0.89),
        ("trade deficit widens", "currency may depreciate", 0.82),
        ("productivity increases", "economic output grows", 0.93),
        ("monopoly forms", "consumer prices tend to rise", 0.87),
        ("government spending increases during recession", "aggregate demand rises", 0.86),
        ("supply chain is disrupted", "production costs increase", 0.90),
        ("investor confidence falls", "stock market declines", 0.85),
        ("technological innovation improves efficiency", "production costs fall", 0.88),
        ("tax rates increase", "disposable income decreases", 0.91),
        ("foreign direct investment increases", "local employment typically rises", 0.84),
    ],
    "psychology": [
        ("positive reinforcement is applied", "desired behavior increases", 0.93),
        ("cognitive dissonance occurs", "individual seeks to resolve the tension", 0.88),
        ("trauma is experienced", "psychological stress response activates", 0.92),
        ("social isolation is prolonged", "mental health deteriorates", 0.89),
        ("mindfulness practice is regular", "stress and anxiety reduce", 0.87),
        ("self-efficacy belief is high", "persistence on tasks increases", 0.90),
        ("sleep is insufficient", "emotional regulation weakens", 0.91),
        ("growth mindset is adopted", "learning and resilience improve", 0.86),
        ("negative feedback is given harshly", "motivation may decrease", 0.82),
        ("social connection is maintained", "psychological wellbeing improves", 0.91),
    ],
    "technology": [
        ("more data is provided to ML model", "model performance improves up to saturation", 0.89),
        ("cache hit rate increases", "system response time decreases", 0.95),
        ("database is not indexed", "query time grows with dataset size", 0.93),
        ("encryption is applied", "data security increases", 0.97),
        ("technical debt accumulates", "development velocity slows", 0.88),
        ("neural network depth increases", "capacity for abstract learning increases", 0.87),
        ("overfitting occurs", "model generalizes poorly to new data", 0.93),
        ("batch size increases in training", "gradient noise decreases", 0.89),
        ("regularization is applied to model", "overfitting is reduced", 0.91),
        ("API rate limit is exceeded", "requests are rejected", 0.98),
        ("code is not tested", "bugs reach production more frequently", 0.88),
        ("load balancing is implemented", "system handles more concurrent users", 0.92),
    ],
    "environment": [
        ("carbon emissions increase", "global temperature rises over time", 0.92),
        ("deforestation occurs", "local rainfall patterns are disrupted", 0.88),
        ("ocean temperature rises", "coral bleaching increases", 0.90),
        ("plastic pollution enters ocean", "marine ecosystem is damaged", 0.91),
        ("ozone layer thins", "UV radiation reaching Earth increases", 0.96),
        ("glaciers melt", "sea levels rise", 0.94),
        ("biodiversity loss occurs", "ecosystem resilience decreases", 0.89),
        ("wetlands are destroyed", "flood regulation capacity decreases", 0.87),
        ("renewable energy adoption increases", "fossil fuel dependence decreases", 0.90),
        ("soil erosion occurs", "agricultural productivity declines", 0.88),
    ],
    "social": [
        ("education quality improves", "economic mobility increases", 0.85),
        ("corruption increases in institutions", "public trust decreases", 0.91),
        ("income inequality rises", "social mobility decreases", 0.86),
        ("misinformation spreads", "public decision making is impaired", 0.87),
        ("civic engagement increases", "policy responsiveness improves", 0.83),
        ("cultural exchange occurs", "prejudice and bias tend to decrease", 0.80),
        ("access to healthcare improves", "population health outcomes improve", 0.93),
        ("early childhood education is provided", "lifelong learning outcomes improve", 0.88),
        ("gender equality policies are implemented", "economic output grows", 0.84),
        ("community bonds strengthen", "crime rates tend to decrease", 0.81),
    ],
    "logic_math": [
        ("premises of a valid syllogism are true", "conclusion is necessarily true", 1.0),
        ("two sets have no intersection", "they are disjoint", 1.0),
        ("a function is differentiable", "it is also continuous", 1.0),
        ("integer is divisible by 4", "it is also divisible by 2", 1.0),
        ("recursive base case is missing", "infinite recursion or stack overflow occurs", 0.97),
        ("sample size increases", "margin of error decreases", 0.95),
        ("correlation is found", "causation cannot be assumed", 1.0),
        ("mathematical proof is valid", "conclusion holds universally", 1.0),
        ("probability of event is 0", "event is impossible", 1.0),
        ("set A is a subset of B and B is a subset of C", "A is a subset of C", 1.0),
    ],
    "myanmar_life": [
        ("မိုးခါသမယတွင် စိုက်ပျိုးတော်ရာ အပင်ကို ရေလောင်းပါက", "ရေပိုသောကြောင့် အပင်ပုပ်တတ်သည်", 0.82),
        ("ကျောင်းသားသည် မှန်မှန်ကန်ကန် လေ့လာလျင်", "စာမေးပွဲတွင် ကောင်းမွန်သောရမှတ်ရသည်", 0.91),
        ("မြန်မာနိုင်ငံတွင် မိုးရာသီတွင် မြစ်ရေမြင့်တက်လျင်", "မြေနိမ့်ပိုင်းတွင် ရေကြီးလေ့ရှိသည်", 0.90),
        ("ဆန်ထွက်နှုန်းကျဆင်းပါက", "ဆန်ဈေးနှုန်းမြင့်တက်တတ်သည်", 0.88),
        ("မိသားစု ချစ်ကြည်ရင်းနှီးမှုရှိပါက", "ကလေးများ စိတ်ကျန်းမာရေး ကောင်းမွန်သည်", 0.87),
        ("တောင်သူက မြေဩဇာ သင့်တင့်မျှတစွာ ထည့်ပါက", "သီးနှံ ထွက်နှုန်းကောင်းသည်", 0.86),
        ("ရေသောက်ပမာဏ မလုံလောက်ပါက", "ခန္ဓာကိုယ် ရေဓာတ်ခမ်းခြောက်ခြင်း ဖြစ်သည်", 0.95),
        ("ဒေသဆိုင်ရာ ဈေးကွက် ဖွံ့ဖြိုးတိုးတက်ပါက", "ဒေသဆိုင်ရာ နိုင်ငံသားများ ဝင်ငွေ တိုးတက်သည်", 0.83),
        ("နေ့စဉ် ကိုယ်လက်လေ့ကျင့်ခန်း လုပ်ပါက", "ကျန်းမာရေး ကောင်းမွန်ပြီး ရောဂါ ခံနိုင်ရည်တိုးသည်", 0.90),
        ("ပညာသင်ကြားမှု အခွင့်အလမ်း တိုးတက်ပါက", "ဆင်းရဲနွမ်းပါးမှု လျော့နည်းသည်", 0.86),
    ],
}

def load_base_rules():
    """Load rules from rules.json"""
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data/brain/rules.json")
    if os.path.exists(path):
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        if isinstance(data, dict):
            return data.get('causalMemory', [])
        return data
    return []

def format_template(template_pair, cause, effect, strength):
    """Safely format a template pair"""
    q_tmpl, a_tmpl = template_pair
    try:
        instruction = q_tmpl.format(cause=cause, effect=effect, strength=strength)
        output = a_tmpl.format(cause=cause, effect=effect, strength=strength)
        # Fix eval-like expressions (simplified)
        if "{'Yes'" in output or "{'Not'" in output:
            if strength > 0.8:
                output = output.replace("{'Yes' if strength > 0.8 else 'Moderately'}", "Yes")
                output = output.replace("{'Yes, with high confidence' if strength > 0.9 else 'Not always, but often'}", 
                                       "Yes, with high confidence" if strength > 0.9 else "Not always, but often")
            else:
                output = output.replace("{'Yes' if strength > 0.8 else 'Moderately'}", "Moderately")
                output = output.replace("{'Yes, with high confidence' if strength > 0.9 else 'Not always, but often'}", 
                                       "Not always, but often")
        return instruction, output
    except Exception:
        return None, None

def generate_chain_entries(rules_by_cause, max_entries=200000):
    """Generate causal chain reasoning entries"""
    entries = []
    causes = list(rules_by_cause.keys())
    if not causes: return entries
    for _ in range(max_entries):
        start = random.choice(causes)
        if start not in rules_by_cause:
            continue
        r1 = random.choice(rules_by_cause[start])
        effect1 = r1['effect']
        chain_str = f"{r1['cause']} → {effect1}"
        
        # Try to extend chain
        if effect1.lower() in rules_by_cause:
            r2 = random.choice(rules_by_cause[effect1.lower()])
            effect2 = r2['effect']
            chain_str += f" → {effect2}"
            instruction = f"Trace the causal chain: what are the downstream effects of '{r1['cause']}'?"
            output = f"Step 1: '{r1['cause']}' leads to '{effect1}' (confidence: {r1.get('strength', 0.8):.2f}). Step 2: '{effect1}' further leads to '{effect2}' (confidence: {r2.get('strength', 0.8):.2f}). Full chain: {chain_str}."
        else:
            instruction = f"What is the causal chain starting from '{r1['cause']}'?"
            output = f"The causal chain: '{r1['cause']}' → '{effect1}'. (Confidence: {r1.get('strength', 0.8):.2f})"
        
        entries.append({"instruction": instruction, "input": "", "output": output})
        if len(entries) >= max_entries:
            break
    return entries

def generate_comparison_entries(all_rules, max_entries=150000):
    """Generate comparison/ranking entries"""
    entries = []
    if len(all_rules) < 2: return entries
    for _ in range(max_entries):
        r1, r2 = random.sample(all_rules, 2)
        if r1.get('strength', 0.5) > r2.get('strength', 0.5):
            stronger, weaker = r1, r2
        else:
            stronger, weaker = r2, r1
        
        instruction = f"Which causal relationship is stronger: A) '{r1['cause']} → {r1['effect']}' or B) '{r2['cause']} → {r2['effect']}'?"
        output = f"Relationship A has confidence {r1.get('strength',0.5):.2f} and B has confidence {r2.get('strength',0.5):.2f}. Therefore, {'A' if r1.get('strength',0.5) > r2.get('strength',0.5) else 'B'} ('{stronger['cause']} → {stronger['effect']}') is the stronger causal link."
        entries.append({"instruction": instruction, "input": "", "output": output})
        if len(entries) >= max_entries: break
    return entries

def generate_negation_entries(all_rules, max_entries=100000):
    """Generate negation/counterfactual entries"""
    entries = []
    templates = [
        ("What if '{cause}' does NOT occur?", "If '{cause}' does not occur, then '{effect}' is less likely to happen. The expected causal pathway is disrupted."),
        ("Negate the cause: '{cause}'. What changes?", "By negating '{cause}', the effect '{effect}' would not be triggered. Confidence for the negated scenario: {neg_strength:.2f}."),
        ("If the opposite of '{cause}' happens, what is the effect?", "The opposite of '{cause}' would likely prevent or reverse '{effect}', given the original causal strength of {strength:.2f}."),
    ]
    if not all_rules: return entries
    for _ in range(max_entries):
        rule = random.choice(all_rules)
        tmpl = random.choice(templates)
        cause = rule.get('cause', '')
        effect = rule.get('effect', '')
        strength = rule.get('strength', 0.5)
        if not cause or not effect:
            continue
        instruction = tmpl[0].format(cause=cause, effect=effect)
        output = tmpl[1].format(cause=cause, effect=effect, strength=strength, neg_strength=1.0-strength)
        entries.append({"instruction": instruction, "input": "", "output": output})
        if len(entries) >= max_entries: break
    return entries

def generate_dataset(target_count=2_000_000, output_file="mure_finetune_2M.jsonl"):
    print(f"🚀 Generating {target_count:,} training examples...")
    start = time.time()
    
    # Collect all rules
    base_rules = load_base_rules()
    domain_rules_list = []
    for domain, rules in DOMAIN_RULES.items():
        for cause, effect, strength in rules:
            domain_rules_list.append({
                "cause": cause, "effect": effect, "strength": strength,
                "domain": domain, "source": "synthetic_extended"
            })
    
    all_rules = base_rules + domain_rules_list
    rules_by_cause = {}
    for r in all_rules:
        k = r.get('cause', '').lower()
        if k not in rules_by_cause:
            rules_by_cause[k] = []
        rules_by_cause[k].append(r)
    
    total_base = len(all_rules)
    print(f"  Base rules loaded: {total_base:,}")
    
    entries_written = 0
    BATCH = 50000
    
    with open(output_file, 'w', encoding='utf-8') as out_f:
        
        # Phase 1: Core template expansion (~900K entries)
        print("  Phase 1: Template expansion...")
        phase1_target = int(target_count * 0.45)
        while entries_written < phase1_target:
            rule = random.choice(all_rules)
            cause = rule.get('cause', '')
            effect = rule.get('effect', '')
            strength = rule.get('strength', rule.get('confidence', 0.8))
            if not cause or not effect:
                continue
            tmpl = random.choice(CAUSAL_TEMPLATES)
            instruction, output = format_template(tmpl, cause, effect, strength)
            if instruction and output:
                out_f.write(json.dumps({"instruction": instruction, "input": "", "output": output}, ensure_ascii=False) + '\n')
                entries_written += 1
                if entries_written % BATCH == 0:
                    print(f"    {entries_written:,} / {target_count:,} ({entries_written*100/target_count:.1f}%)")
        
        # Phase 2: Causal chain entries (~300K)
        print("  Phase 2: Causal chain reasoning...")
        chain_entries = generate_chain_entries(rules_by_cause, int(target_count * 0.15))
        for e in chain_entries:
            out_f.write(json.dumps(e, ensure_ascii=False) + '\n')
            entries_written += 1
            if entries_written % BATCH == 0:
                print(f"    {entries_written:,} / {target_count:,} ({entries_written*100/target_count:.1f}%)")
        
        # Phase 3: Comparison entries (~200K)
        print("  Phase 3: Comparison reasoning...")
        comp_entries = generate_comparison_entries(all_rules, int(target_count * 0.10))
        for e in comp_entries:
            out_f.write(json.dumps(e, ensure_ascii=False) + '\n')
            entries_written += 1
            if entries_written % BATCH == 0:
                print(f"    {entries_written:,} / {target_count:,} ({entries_written*100/target_count:.1f}%)")
        
        # Phase 4: Negation/counterfactual entries (~100K)
        print("  Phase 4: Negation & counterfactuals...")
        neg_entries = generate_negation_entries(all_rules, int(target_count * 0.05))
        for e in neg_entries:
            out_f.write(json.dumps(e, ensure_ascii=False) + '\n')
            entries_written += 1
        
        # Phase 5: Fill remaining to hit target
        print("  Phase 5: Filling to target...")
        while entries_written < target_count:
            rule = random.choice(all_rules)
            cause = rule.get('cause', '')
            effect = rule.get('effect', '')
            strength = rule.get('strength', rule.get('confidence', 0.8))
            if not cause or not effect:
                continue
            tmpl = random.choice(CAUSAL_TEMPLATES)
            instruction, output = format_template(tmpl, cause, effect, strength)
            if instruction and output:
                out_f.write(json.dumps({"instruction": instruction, "input": "", "output": output}, ensure_ascii=False) + '\n')
                entries_written += 1
                if entries_written % BATCH == 0:
                    print(f"    {entries_written:,} / {target_count:,} ({entries_written*100/target_count:.1f}%)")
    
    elapsed = time.time() - start
    try:
        size_mb = os.path.getsize(output_file) / (1024*1024)
    except:
        size_mb = 0
    print(f"\n✅ Done! {entries_written:,} entries written")
    print(f"   File: {output_file}")
    print(f"   Size: {size_mb:.1f} MB")
    print(f"   Time: {elapsed:.1f}s")
    return entries_written

if __name__ == "__main__":
    generate_dataset(2_000_000, "mure_finetune_2M.jsonl")
