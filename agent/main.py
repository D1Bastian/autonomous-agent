import time
import os
import json
import random
from dotenv import load_dotenv
from strategy import HFTStrategy
from trader import HFTTrader

# Try importing Gemini SDK safely
try:
    import google.generative-ai as genai
except ImportError:
    genai = None

load_dotenv()

class AutonomousAgent:
    def __init__(self):
        self.strategy = HFTStrategy()
        self.trader = HFTTrader()
        self.is_running = False
        
        # Init Gemini
        self.api_key = os.getenv("GEMINI_API_KEY", "")
        self.has_llm = False
        if genai and self.api_key and "YOUR_GEMINI_API_KEY" not in self.api_key:
            try:
                genai.configure(api_key=self.api_key)
                self.model = genai.GenerativeModel('gemini-1.5-pro')
                self.has_llm = True
                print("🧠 Gemini LLM Brain successfully activated.")
            except Exception as e:
                print(f"⚠️ Error configuring Gemini: {e}")
        else:
            print("💡 No Gemini API key detected. Running on-board rule-based engine.")

    def think(self, signal, price, spread):
        """
        Uses Gemini LLM to analyze the micro-scalping environment and refine confidence/action.
        Provides a vibe-coded explanation of current trading decisions.
        """
        if not self.has_llm:
            return f"Rule Engine triggered {signal['action']} signal at ${price:,.2f} with confidence {signal['confidence']:.2f}."

        prompt = f"""
        You are AggressiveScalpBot, an autonomous trading agent.
        You detected a micro-opportunity:
        - Direction: {signal['action']}
        - Current Price: ${price:,.2f}
        - Bid-Ask Spread: {spread:.4f}%
        - Technical Indicator: {signal['indicator']}
        - Technical Confidence: {signal['confidence']:.2f}
        
        Provide a concise, expert 1-sentence thought analysis of why you are taking or refining this action.
        """
        try:
            response = self.model.generate_content(prompt)
            return response.text.strip()
        except Exception as e:
            return f"Strategic analysis fallback: Executing {signal['action']} scalp based on technical crossovers. ({e})"

    def start(self):
        self.is_running = True
        print("⚡ AggressiveScalpBot HFT Loop Activated.")
        
        # Simulate active order book feed
        current_price = 68450.00
        
        while self.is_running:
            try:
                # 1. Update Market depth
                price_noise = random.uniform(-10.0, 10.0)
                current_price += price_noise
                
                bid_depth = random.randint(100, 500)
                ask_depth = random.randint(100, 500)
                spread = 0.05
                
                # 2. Get Signal
                signal = self.strategy.get_scalp_signal(current_price, bid_depth, ask_depth)
                
                if signal:
                    # 3. LLM Brain Analysis
                    thought = self.think(signal, current_price, spread)
                    print(f"\n🧠 Agent Brain Thought: {thought}")
                    
                    # 4. Trader Execution
                    trade_amount = random.uniform(0.0005, 0.002)
                    record = self.trader.execute_on_chain_trade(
                        signal["action"], 
                        trade_amount, 
                        current_price
                    )
                    
                    print(f"💰 Scalp Action Result: {record['action']} {record['amount']:.5f} BTC - Status: {record['status']}")
                
                time.sleep(2)
            except KeyboardInterrupt:
                self.stop()
            except Exception as e:
                print(f"⚠️ Loop Error: {e}")
                time.sleep(2)

    def stop(self):
        self.is_running = False
        print("🛑 AggressiveScalpBot HFT Loop Deactivated.")

if __name__ == "__main__":
    agent = AutonomousAgent()
    agent.start()
