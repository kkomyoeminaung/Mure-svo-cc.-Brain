import asyncio
import sys
import os

# Add parent directory to sys.path to allow modular imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from mure_agi.unified_mure import get_mure

async def main():
    mure = get_mure()
    
    # Start Dream Mode in background
    dream_task = asyncio.create_task(mure.run_dream_mode())
    
    print("\n--- MURE Ultimate AGI CLI ---")
    print("Type 'exit' to quit. Mode: Hybrid Fuzzy-Semantic")
    
    loop = asyncio.get_event_loop()
    
    while True:
        try:
            user_input = await loop.run_in_executor(None, lambda: input("\n👤 User: "))
            if user_input.lower() in ['exit', 'quit']:
                break
            
            response = mure.chat(user_input)
            print(f"🤖 MURE: {response}")
            
        except KeyboardInterrupt:
            break
        except Exception as e:
            print(f"⚠️ Error: {e}")
    
    dream_task.cancel()
    await asyncio.gather(dream_task, return_exceptions=True)

if __name__ == "__main__":
    asyncio.run(main())
