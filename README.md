# ⚡ AggressiveScalpBot - Autonomous Agent Wallet & Trade Engine

An autonomous, "vibe-coded" high-frequency trading AI agent with on-chain identity and payment rails, built for **GOAT Network Testnet3** (secured mathematically by BitVM2 on Bitcoin).

## 🚀 Key Features

1. **🧠 Gemini LLM Brain**: Configured via the OpenClaw framework guidelines to drive aggressive trading decisions without human oversight.
2. **🧬 ERC-8004 On-Chain Identity**: Solidity smart contract (`AgentIdentity.sol`) representing the agent's unique, decentralized soul/identity metadata.
3. **💸 x402 Payment Skill**: Enabling micro-transactions and payment streams autonomously on-chain.
4. **📊 Premium PyQt5 Desktop UI**: Real-time cyberpunk dashboard showing:
   * Loaded Wallet Address and balance in BTC.
   * Real-time price chart and bid-ask order-book simulation.
   * High-Frequency Trade Stream recording every scalping transaction.
   * Agent Brain Thought logs displaying Gemini logic outputs.
   * Interactive controls to adjust bot speed, aggressiveness (1-5), and spread limits.
   * One-click "Mint Agent Soul" creator.

---

## 🛠️ Installation & Setup

### 1. Install System Dependencies
Ensure you have Node.js and Python 3.x installed, then install the packages:

```bash
# Install Node dependencies (Hardhat, OpenZeppelin, etc.)
npm install

# Install Python UI & Web3 dependencies
pip install PyQt5 web3 python-dotenv requests
```

### 2. Configure Environment (`.env`)
Create/edit the `.env` file in the root folder:
```env
GOAT_RPC=https://rpc.testnet3.goat.network
CHAIN_ID=48816
PRIVATE_KEY=your_private_key_here
GEMINI_API_KEY=your_gemini_api_key_here
```

> ⚠️ **Security Tip**: Run `git update-index --assume-unchanged .env` to prevent committing your secret keys!

---

## 💻 Running the Project

### Compile Smart Contracts
Compile the ERC-8004 contract using Hardhat:
```bash
npx hardhat compile
```

### Deploy to GOAT Testnet3
Make sure your `.env` contains a funded private key, then run:
```bash
npx hardhat run scripts/deploy.js --network goatTestnet
```

### Launch the Desktop UI
Start the real-time monitoring visual center:
```bash
python ui/main.py
```

---

## 🤝 Collaborative Development
This repository is pre-configured with a robust `.gitignore` file to ensure no sensitive files (`.env`), compiled artifacts (`/artifacts`), or heavy packages (`node_modules/`, `venv/`) are accidentally committed to GitHub.

---
*Vibe-coded with mathematical security on Bitcoin Layer-2.* 🦾
