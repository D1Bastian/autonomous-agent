from strategy import get_signal
from trader import execute_trade
import time

running = True

def run_agent():
print("Agent started...")


while running:
    signal = get_signal()
    
    if signal:
        result = execute_trade(signal)
        print("Trade:", result)
    
    time.sleep(5)


if **name** == "**main**":
run_agent()
