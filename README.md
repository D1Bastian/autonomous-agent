# AggressiveScalpBot (Clawed) - Autonomous Multi-Modal Swarm Bot & x402 Oracle Ecosystem

Registered on the GOAT Network Mainnet (Chain ID 2345, ERC-8004 Identity Token #45).

---

## Core Concepts

### 1. Multi-Modal AI Brain
AggressiveScalpBot (Clawed) is designed to process multi-modal inputs: it handles natural-language instructions from user chats, interprets market price telemetry, and processes visual data schemas to make automated trading decisions without human intervention.

### 2. Swarm Intelligence & Role-Based Sub-Agents
The bot is not a single trader—it is a commander of a local HFT fleet. Depending on market conditions, Clawed dynamically spins up, funds, and deploys specialized sub-agents with their own wallets and execution loops:
* **SCALPER**: Fast momentum capture in high-volatility environments.
* **MAKER**: Order-book spread farming and liquidity provisioning in flat markets.
* **ARBITRAGEUR**: Cross-protocol price discrepancy capture.

### 3. x402 Oracle Bot Ecosystem (Machine-to-Machine Economy)
Clawed participates in the agentic data economy using the x402 payment protocol:
* **Data Consumer**: When requesting alpha trading signals, Clawed automatically intercepts 402 Payment Required headers, executes an on-chain transfer of native GOAT or ERC-20 USDC stablecoins, and resubmits the transaction hash to unlock the oracle data.
* **Data Provider (Oracle Bot)**: The codebase includes a running Oracle Server that sells premium signals to other network bots, verifying their incoming blockchain transfers autonomously.

---

## Key Features

1. **On-Chain ERC-8004 Identity**: Minted live on GOAT Network Mainnet (Token ID 45). Verification listing on [8004scan.io/agents/45?chain=2345](https://8004scan.io/agents/45?chain=2345).
2. **Dynamic USDC & GOAT x402 Rails**: Support for native gas tokens and stablecoin micropayments with dynamic decimal and symbol resolution on-chain.
3. **Interactive Telegram Bot**: Access live controls via @GBCClawedbot. You can request wallet reports, buy signals, spawn sub-agents, or adjust guardrails directly in chat.
4. **PyQt5 Swarm Monitor GUI**: Cyberpunk dashboard displaying the main wallet, active sub-agent fleet, and live transaction telemetry logs.
5. **Human-in-the-Loop Guardrails**: Customizable spending thresholds enforced on every transaction to prevent agent self-drainage.

---

## Installation & Setup

### 1. Install System Dependencies
Ensure you have Node.js and Python 3.x installed:

```bash
# Install Node dependencies
npm install

# Install Python GUI & Web3 dependencies
pip install PyQt5 websocket-client python-dotenv requests
```

### 2. Configure Environment (.env)
Create a .env file in the root directory:
```env
PRIVATE_KEY="0x..." # Your mainnet wallet private key
GOAT_RPC="https://rpc.goat.network"
AGENT_NAME="AggressiveScalpBot"
TELEGRAM_BOT_TOKEN="your_bot_token"
X402_MERCHANT_ID="37"
MAX_SPEND_GOAT="0.005"
```

---

## Running the Project

### 1. Start the Agent & Oracle Server
This launches the TypeScript backend, the local Oracle node, and the Telegram listener:
```bash
npm start
```

### 2. Launch the PyQt5 GUI Dashboard
In a separate terminal tab:
```bash
python3 ui/main.py
```

---
*Vibe-coded on GOAT Network Mainnet. Secured by Bitcoin L2.*
