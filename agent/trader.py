import os
import json
import time
from datetime import datetime
from dotenv import load_dotenv
from web3 import Web3

load_dotenv()

class HFTTrader:
    def __init__(self):
        self.rpc_url = os.getenv("GOAT_RPC", "https://rpc.testnet3.goat.network")
        self.private_key = os.getenv("PRIVATE_KEY", "")
        self.chain_id = int(os.getenv("CHAIN_ID", 48816))
        self.address = None
        self.web3 = None
        
        self.init_web3()

    def init_web3(self):
        try:
            self.web3 = Web3(Web3.HTTPProvider(self.rpc_url))
            if self.web3.is_connected():
                print(f"🟢 Web3 connected to GOAT Network at {self.rpc_url}")
                if self.private_key and "YOUR_PRIVATE_KEY" not in self.private_key:
                    account = self.web3.eth.account.from_key(self.private_key)
                    self.address = account.address
                    print(f"💼 Wallet loaded: {self.address}")
                else:
                    print("⚠️ No valid private key found. Running in sandbox simulation mode.")
            else:
                print("🔴 Failed to connect to GOAT RPC. Sandbox mode active.")
        except Exception as e:
            print(f"❌ Error initializing Web3: {e}")

    def get_balance(self):
        if self.web3 and self.web3.is_connected() and self.address:
            try:
                bal_wei = self.web3.eth.get_balance(self.address)
                return float(self.web3.from_wei(bal_wei, 'ether'))
            except Exception as e:
                print(f"⚠️ Error fetching balance: {e}")
        return 0.0

    def execute_on_chain_trade(self, action, amount, price):
        """
        Executes an on-chain transaction or simulated trade record.
        Uses x402 payment methodology for autonomous agent spending.
        """
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
        tx_hash = "0x" + "".join(os.urandom(32).hex())
        status = "SIMULATED"

        if self.web3 and self.web3.is_connected() and self.address and self.private_key and "YOUR_PRIVATE_KEY" not in self.private_key:
            try:
                # To maintain safety of faucet funds, we limit live automated transaction amounts
                scaled_amount = amount * 0.0001
                tx = {
                    'nonce': self.web3.eth.get_transaction_count(self.address),
                    'to': self.address, # Auto-payment loopback (x402 proof of transfer)
                    'value': self.web3.to_wei(scaled_amount, 'ether'),
                    'gas': 21000,
                    'gasPrice': int(self.web3.eth.gas_price * 1.1), # 10% premium for high-frequency prioritisation
                    'chainId': self.chain_id
                }
                
                signed_tx = self.web3.eth.account.sign_transaction(tx, self.private_key)
                tx_hash_obj = self.web3.eth.send_raw_transaction(signed_tx.raw_transaction)
                tx_hash = self.web3.to_hex(tx_hash_obj)
                status = "CONFIRMED"
                print(f"🔗 Transaction Sent! Action: {action} | Hash: {tx_hash}")
            except Exception as e:
                print(f"⚠️ Live trade execution failed, falling back to sandbox: {e}")
                status = "SIMULATED_FALLBACK"

        trade_record = {
            "time": timestamp,
            "action": action,
            "amount": amount,
            "price": price,
            "hash": tx_hash,
            "status": status,
            "profit": round(amount * price * 0.001, 6) if action == "SELL" else 0.0
        }

        # Save to local database for visual tracking
        self.save_trade_history(trade_record)
        return trade_record

    def execute_x402_payment(self, amount, merchant_id):
        """
        Executes a real x402 payment to another agent or merchant.
        To be filled during the workshop when endpoint is known.
        """
        print(f"💰 Initiating x402 payment of {amount} to merchant {merchant_id}...")
        # Placeholder for x402 logic
        return True

    def save_trade_history(self, record):
        os.makedirs("data", exist_ok=True)
        file_path = "data/trades.json"
        try:
            if os.path.exists(file_path):
                with open(file_path, "r") as f:
                    data = json.load(f)
            else:
                data = []
        except Exception:
            data = []

        data.append(record)
        # Cap local database records at 500
        if len(data) > 500:
            data.pop(0)

        with open(file_path, "w") as f:
            json.dump(data, f, indent=2)