import os
from web3 import Web3
from dotenv import load_dotenv

load_dotenv()

RPC = "https://rpc.testnet3.goat.network"
CONTRACT_ADDRESS = "0x556089008Fc0a60cD09390Eca93477ca254A5522"
PRIVATE_KEY = os.getenv("PRIVATE_KEY")
URI = "https://gist.githubusercontent.com/ifradhos55/ac0654d0934471f358dea76fc3051886/raw"

w3 = Web3(Web3.HTTPProvider(RPC))
account = w3.eth.account.from_key(PRIVATE_KEY)
address = account.address

print(f"Using address: {address}")
print(f"Balance: {w3.eth.get_balance(address)} wei")

# ABI for register(string)
abi = [
    {
        "inputs": [{"internalType": "string", "name": "uri", "type": "string"}],
        "name": "register",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    }
]

contract = w3.eth.contract(address=CONTRACT_ADDRESS, abi=abi)

print("Building transaction...")
tx = contract.functions.register(URI).build_transaction({
    'from': address,
    'nonce': w3.eth.get_transaction_count(address),
    'gas': 200000,
    'gasPrice': w3.eth.gas_price,
    'chainId': 48816
})

print("Signing and sending...")
signed_tx = w3.eth.account.sign_transaction(tx, PRIVATE_KEY)
tx_hash = w3.eth.send_raw_transaction(signed_tx.raw_transaction)
print(f"Success! TX Hash: {w3.to_hex(tx_hash)}")
