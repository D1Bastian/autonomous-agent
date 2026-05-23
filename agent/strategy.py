import random

def get_signal():
signals = ["BUY", "SELL", None]
action = random.choice(signals)


if action:
    return {
        "pair": "EUR/USD",
        "action": action
    }
return None


