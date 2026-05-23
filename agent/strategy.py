import random
import os
import json
from dotenv import load_dotenv

load_dotenv()

class HFTStrategy:
    def __init__(self):
        self.short_window = 5
        self.long_window = 15
        self.price_history = []
        
    def add_price(self, price):
        self.price_history.append(price)
        if len(self.price_history) > 100:
            self.price_history.pop(0)
            
    def calculate_ema(self, window):
        if len(self.price_history) < window:
            return None
        multiplier = 2 / (window + 1)
        ema = self.price_history[0]
        for price in self.price_history[1:]:
            ema = (price * multiplier) + (ema * (1 - multiplier))
        return ema

    def analyze_order_book(self, bid_depth, ask_depth):
        """
        Analyzes volume imbalance in order book.
        An imbalance > 0 indicates more buying pressure.
        An imbalance < 0 indicates more selling pressure.
        """
        total_depth = bid_depth + ask_depth
        if total_depth == 0:
            return 0.0
        return (bid_depth - ask_depth) / total_depth

    def get_scalp_signal(self, current_price, bid_depth, ask_depth):
        self.add_price(current_price)
        
        ema_short = self.calculate_ema(self.short_window)
        ema_long = self.calculate_ema(self.long_window)
        imbalance = self.analyze_order_book(bid_depth, ask_depth)
        
        # Default neutral signal
        signal = None
        confidence = 0.5
        
        # Scalping logic: EMA crossover with volume imbalance filter
        if ema_short and ema_long:
            if ema_short > ema_long and imbalance > 0.1:
                signal = "BUY"
                confidence = min(0.95, 0.5 + (imbalance * 0.5))
            elif ema_short < ema_long and imbalance < -0.1:
                signal = "SELL"
                confidence = min(0.95, 0.5 + (abs(imbalance) * 0.5))
                
        # High frequency mean-reversion fallback
        if not signal and len(self.price_history) >= 10:
            mean = sum(self.price_history) / len(self.price_history)
            deviation = current_price - mean
            threshold = mean * 0.0005 # 0.05% deviation threshold
            
            if deviation < -threshold:
                signal = "BUY" # oversold
                confidence = 0.7
            elif deviation > threshold:
                signal = "SELL" # overbought
                confidence = 0.7

        if signal:
            return {
                "action": signal,
                "confidence": confidence,
                "indicator": "EMA_Imbalance" if ema_short else "MeanReversion",
                "price": current_price
            }
        return None
