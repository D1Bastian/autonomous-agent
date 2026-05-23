import json
from datetime import datetime

FILE = "data/trades.json"

def execute_trade(signal):
trade = {
"time": str(datetime.now()),
"pair": signal["pair"],
"action": signal["action"],
"profit": round(5 * 0.5, 2)
}

try:
    with open(FILE, "r") as f:
        data = json.load(f)
except:
    data = []

data.append(trade)

with open(FILE, "w") as f:
    json.dump(data, f, indent=2)

return trade