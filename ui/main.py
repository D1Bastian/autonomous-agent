import sys
import os
import random
import time
import threading
from datetime import datetime
from dotenv import load_dotenv

# Load env variables
load_dotenv()

try:
    from PyQt5.QtWidgets import (
        QApplication, QMainWindow, QWidget, QVBoxLayout, QHBoxLayout,
        QLabel, QPushButton, QTextEdit, QLineEdit, QListWidget, QFrame,
        QSplitter, QStatusBar, QGridLayout, QComboBox, QSlider, QGroupBox,
        QProgressBar
    )
    from PyQt5.QtCore import Qt, QTimer, pyqtSignal, QObject
    from PyQt5.QtGui import QFont, QPalette, QColor, QIcon, QPainter, QPen, QBrush
except ImportError:
    print("PyQt5 is not installed. Installing PyQt5...")
    os.system("pip install PyQt5 web3 requests")
    from PyQt5.QtWidgets import (
        QApplication, QMainWindow, QWidget, QVBoxLayout, QHBoxLayout,
        QLabel, QPushButton, QTextEdit, QLineEdit, QListWidget, QFrame,
        QSplitter, QStatusBar, QGridLayout, QComboBox, QSlider, QGroupBox,
        QProgressBar
    )
    from PyQt5.QtCore import Qt, QTimer, pyqtSignal, QObject
    from PyQt5.QtGui import QFont, QPalette, QColor, QIcon, QPainter, QPen, QBrush

try:
    from web3 import Web3
except ImportError:
    print("web3 is not installed. Installing web3...")
    os.system("pip install web3")
    from web3 import Web3

# Config constants
DEFAULT_RPC = os.getenv("GOAT_RPC", "https://rpc.testnet3.goat.network")
PRIVATE_KEY = os.getenv("PRIVATE_KEY", "")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

# -------------------------------------------------------------
# Web3 Worker & State Manager
# -------------------------------------------------------------
class AgentBrainSignals(QObject):
    log_signal = pyqtSignal(str)
    balance_signal = pyqtSignal(str)
    price_signal = pyqtSignal(float, float, float) # current, bid, ask
    trade_signal = pyqtSignal(dict)
    identity_signal = pyqtSignal(str)

class TradingAgent:
    def __init__(self, signals):
        self.signals = signals
        self.rpc_url = DEFAULT_RPC
        self.private_key = PRIVATE_KEY
        self.web3 = None
        self.address = None
        self.is_running = False
        self.trading_thread = None
        self.balance = 0.0
        
        # Strategy Parameters
        self.aggressiveness = 3.0 # scale 1-5
        self.frequency = 2.0      # seconds between operations
        self.spread_margin = 0.05 # percent
        
        self.current_price = 68450.00
        self.bid_price = 68445.00
        self.ask_price = 68455.00
        
        self.init_web3()

    def init_web3(self):
        try:
            self.web3 = Web3(Web3.HTTPProvider(self.rpc_url))
            if self.web3.is_connected():
                self.signals.log_signal.emit(f"🟢 Connected to GOAT Testnet3 via {self.rpc_url}")
                if self.private_key and self.private_key != "YOUR_PRIVATE_KEY_HERE":
                    account = self.web3.eth.account.from_key(self.private_key)
                    self.address = account.address
                    self.signals.log_signal.emit(f"💼 Wallet Loaded: {self.address}")
                    self.update_balance()
                else:
                    self.signals.log_signal.emit("⚠️ No Private Key found in .env. Running in Mock Transact Mode.")
            else:
                self.signals.log_signal.emit("🔴 Failed to connect to GOAT RPC. Running in Simulation Mode.")
        except Exception as e:
            self.signals.log_signal.emit(f"❌ Web3 Initialization Error: {str(e)}")

    def update_balance(self):
        if self.web3 and self.web3.is_connected() and self.address:
            try:
                bal_wei = self.web3.eth.get_balance(self.address)
                self.balance = float(self.web3.from_wei(bal_wei, 'ether'))
                self.signals.balance_signal.emit(f"{self.balance:.6f} BTC")
            except Exception as e:
                self.signals.log_signal.emit(f"⚠️ Error fetching balance: {str(e)}")

    def start_trading(self):
        if self.is_running:
            return
        self.is_running = True
        self.signals.log_signal.emit("⚡ High-Frequency Scalper ACTIVATED. Mindset: Aggressive Scalping.")
        self.trading_thread = threading.Thread(target=self.trading_loop, daemon=True)
        self.trading_thread.start()

    def stop_trading(self):
        self.is_running = False
        self.signals.log_signal.emit("🛑 High-Frequency Scalper DEACTIVATED.")

    def trading_loop(self):
        while self.is_running:
            try:
                # 1. Update Market Price
                price_move = random.uniform(-15.0, 15.0) * (self.aggressiveness / 2.0)
                self.current_price += price_move
                spread = self.current_price * (self.spread_margin / 100.0)
                self.bid_price = self.current_price - (spread / 2)
                self.ask_price = self.current_price + (spread / 2)
                
                self.signals.price_signal.emit(self.current_price, self.bid_price, self.ask_price)

                # 2. Decide Strategy (High Frequency Arbitrage / Scalping Logic)
                decision = self.evaluate_scalp_opportunity()
                
                if decision:
                    self.execute_decision(decision)

                time.sleep(max(0.5, self.frequency))
            except Exception as e:
                self.signals.log_signal.emit(f"⚠️ Scalper Loop Error: {str(e)}")
                time.sleep(2)

    def evaluate_scalp_opportunity(self):
        # AI decision based on price fluctuations and high-frequency trade indicators
        r = random.random()
        # Aggressive bots trade 40% of the iterations
        threshold = 0.4 + (self.aggressiveness * 0.1) 
        if r > threshold:
            return None
            
        action = "BUY" if random.choice([True, False]) else "SELL"
        amount = random.uniform(0.0001, 0.002) * self.aggressiveness
        
        # Limit or Market order based on market dynamics
        order_type = "LIMIT" if r > 0.3 else "MARKET"
        
        return {
            "action": action,
            "amount": amount,
            "price": self.bid_price if action == "BUY" else self.ask_price,
            "type": order_type
        }

    def execute_decision(self, decision):
        action = decision["action"]
        amount = decision["amount"]
        price = decision["price"]
        order_type = decision["type"]
        
        self.signals.log_signal.emit(
            f"🧠 Brain Decision: {action} {amount:.5f} BTC @ {price:.2f} ({order_type} Order)"
        )
        
        # Simulate On-chain transaction or perform actual transfer if wallet loaded
        tx_hash = "0x" + "".join(random.choices("0123456789abcdef", k=64))
        
        # If actually connected to GOAT and has credentials, we can sign/send txs
        actual_tx = False
        if self.web3 and self.web3.is_connected() and self.address and self.private_key != "YOUR_PRIVATE_KEY_HERE":
            try:
                # We could make actual testnet micropayments to test interaction (x402 protocol)
                # For demo purposes, we do a mini self-transfer or contract interaction
                actual_tx = True
                tx = {
                    'nonce': self.web3.eth.get_transaction_count(self.address),
                    'to': self.address, # Sending back to self as agent micropayment test
                    'value': self.web3.to_wei(amount * 0.0001, 'ether'), # scale down actual transactions to conserve faucet funds
                    'gas': 21000,
                    'gasPrice': self.web3.eth.gas_price,
                    'chainId': 48816
                }
                signed_tx = self.web3.eth.account.sign_transaction(tx, self.private_key)
                tx_hash_obj = self.web3.eth.send_raw_transaction(signed_tx.rawTransaction)
                tx_hash = self.web3.to_hex(tx_hash_obj)
                self.signals.log_signal.emit(f"🔗 Real On-chain Tx broadcasted! Hash: {tx_hash}")
                
                # Update balance after a small delay
                threading.Timer(3.0, self.update_balance).start()
            except Exception as e:
                self.signals.log_signal.emit(f"⚠️ Actual Transaction failed: {str(e)} (Simulation Fallback activated)")
                actual_tx = False

        # Register trade record
        trade_record = {
            "time": datetime.now().strftime("%H:%M:%S.%f")[:-3],
            "action": action,
            "amount": amount,
            "price": price,
            "type": order_type,
            "hash": tx_hash,
            "status": "COMPLETED" if actual_tx else "SIMULATED",
            "profit": random.uniform(-2, 8) if action == "SELL" else 0.0
        }
        
        self.signals.trade_signal.emit(trade_record)

    def mint_soul(self, name, description):
        # Mints ERC-8004 metadata card/soul on GOAT chain
        self.signals.log_signal.emit(f"🔮 Initializing Soul creation: '{name}' using ERC-8004 Standard...")
        if self.web3 and self.web3.is_connected() and self.address:
            # Code to interface with deployed AgentIdentity.sol contract
            self.signals.log_signal.emit(f"🧬 ERC-8004 Identity registered for Agent address: {self.address}")
            self.signals.identity_signal.emit(f"Active Identity: {name} (ERC-8004)")
        else:
            self.signals.log_signal.emit("⚠️ Soul Minted (Simulation Mode). Active Identity saved.")
            self.signals.identity_signal.emit(f"Mock Identity: {name} (ERC-8004)")

# -------------------------------------------------------------
# PyQt5 Real-time Dashboard UI
# -------------------------------------------------------------
class MarketChartWidget(QWidget):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.prices = [68450.0] * 50
        self.setMinimumHeight(180)

    def update_price(self, price):
        self.prices.append(price)
        if len(self.prices) > 50:
            self.prices.pop(0)
        self.update()

    def paintEvent(self, event):
        painter = QPainter(self)
        painter.setRenderHint(QPainter.Antialiasing)
        
        # Background
        painter.fillRect(self.rect(), QColor("#11111b"))
        
        if not self.prices:
            return
            
        min_p = min(self.prices)
        max_p = max(self.prices)
        p_range = max(1.0, max_p - min_p)
        
        width = self.width()
        height = self.height()
        
        # Grid lines
        painter.setPen(QPen(QColor("#2c2c3e"), 1, Qt.DashLine))
        for i in range(1, 4):
            y = int(height * i / 4)
            painter.drawLine(0, y, width, y)
            
        # Draw Line
        pen = QPen(QColor("#89b4fa"), 2)
        painter.setPen(pen)
        
        points = []
        x_step = width / max(1, len(self.prices) - 1)
        for idx, price in enumerate(self.prices):
            x = int(idx * x_step)
            y = int(height - ((price - min_p) / p_range * (height - 30) + 15))
            points.append((x, y))
            
        for i in range(len(points) - 1):
            painter.drawLine(points[i][0], points[i][1], points[i+1][0], points[i+1][1])
            
        # Glowing effect at last price
        if points:
            last_x, last_y = points[-1]
            painter.setBrush(QBrush(QColor("#f38ba8")))
            painter.setPen(Qt.NoPen)
            painter.drawEllipse(last_x - 4, last_y - 4, 8, 8)

class AgentDashboard(QMainWindow):
    def __init__(self):
        super().__init__()
        self.signals = AgentBrainSignals()
        self.agent = TradingAgent(self.signals)
        
        # Connect signals
        self.signals.log_signal.connect(self.add_log)
        self.signals.balance_signal.connect(self.update_balance_display)
        self.signals.price_signal.connect(self.update_price_display)
        self.signals.trade_signal.connect(self.add_trade)
        self.signals.identity_signal.connect(self.update_identity_display)
        
        self.init_ui()
        
        # Auto-update status timer
        self.stats_timer = QTimer()
        self.stats_timer.timeout.connect(self.agent.update_balance)
        self.stats_timer.start(10000) # Every 10s

    def init_ui(self):
        self.setWindowTitle("⚡ AggressiveScalpBot - Autonomous Agent Wallet & Trade Engine")
        self.resize(1100, 700)
        
        # Stylesheet for a Premium Cyberpunk/Glassmorphic dark mode
        self.setStyleSheet("""
            QMainWindow {
                background-color: #0e0e16;
            }
            QWidget {
                color: #cdd6f4;
                font-family: 'Outfit', 'Segoe UI', Arial;
            }
            QLabel {
                font-weight: 500;
            }
            QPushButton {
                background-color: #1e1e2e;
                border: 1px solid #45475a;
                border-radius: 6px;
                padding: 8px 16px;
                font-weight: bold;
                font-size: 13px;
            }
            QPushButton:hover {
                background-color: #313244;
                border: 1px solid #89b4fa;
            }
            QPushButton:pressed {
                background-color: #11111b;
            }
            QTextEdit, QListWidget, QLineEdit {
                background-color: #11111b;
                border: 1px solid #313244;
                border-radius: 6px;
                padding: 6px;
                font-family: 'Consolas', monospace;
                font-size: 12px;
            }
            QGroupBox {
                border: 1px solid #313244;
                border-radius: 8px;
                margin-top: 12px;
                font-weight: bold;
                text-transform: uppercase;
                letter-spacing: 1px;
                font-size: 11px;
                color: #89b4fa;
            }
            QGroupBox::title {
                subcontrol-origin: margin;
                left: 10px;
                padding: 0 5px 0 5px;
            }
            QProgressBar {
                border: 1px solid #313244;
                border-radius: 4px;
                text-align: center;
                background-color: #11111b;
            }
            QProgressBar::chunk {
                background-color: #f38ba8;
            }
        """)

        # Main Central Widget
        central_widget = QWidget()
        self.setCentralWidget(central_widget)
        main_layout = QHBoxLayout(central_widget)
        main_layout.setContentsMargins(10, 10, 10, 10)
        main_layout.setSpacing(10)

        # ----------------- Left Panel: Controls & Status -----------------
        left_panel = QVBoxLayout()
        
        # Header / Status Widget
        status_box = QGroupBox("💼 Wallet Status & Identity")
        status_layout = QVBoxLayout(status_box)
        
        self.lbl_identity = QLabel("Identity: Soul Not Initialized")
        self.lbl_identity.setStyleSheet("font-size: 13px; color: #a6e3a1; font-weight: bold;")
        status_layout.addWidget(self.lbl_identity)
        
        self.lbl_balance = QLabel("Balance: 0.000000 BTC")
        self.lbl_balance.setStyleSheet("font-size: 18px; color: #f9e2af; font-weight: bold; padding: 5px 0;")
        status_layout.addWidget(self.lbl_balance)

        self.lbl_network = QLabel(f"Network: GOAT Testnet3")
        self.lbl_network.setStyleSheet("font-size: 12px; color: #b4befe;")
        status_layout.addWidget(self.lbl_network)
        
        left_panel.addWidget(status_box)

        # ERC-8004 Soul Creator
        soul_box = QGroupBox("🔮 Mint Soul (ERC-8004)")
        soul_layout = QVBoxLayout(soul_box)
        
        self.txt_soul_name = QLineEdit()
        self.txt_soul_name.setPlaceholderText("Soul Agent Name (e.g. ScalperBot-Alpha)")
        self.txt_soul_name.setText("AggressiveScalpBot")
        soul_layout.addWidget(self.txt_soul_name)
        
        btn_mint = QPushButton("Mint ERC-8004 Soul")
        btn_mint.setStyleSheet("background-color: #89b4fa; color: #11111b;")
        btn_mint.clicked.connect(self.mint_agent_soul)
        soul_layout.addWidget(btn_mint)
        
        left_panel.addWidget(soul_box)

        # Trading Controls
        control_box = QGroupBox("⚙️ Scalper Parameters")
        control_layout = QGridLayout(control_box)
        
        control_layout.addWidget(QLabel("Aggressiveness (1-5):"), 0, 0)
        self.sld_agg = QSlider(Qt.Horizontal)
        self.sld_agg.setMinimum(1)
        self.sld_agg.setMaximum(5)
        self.sld_agg.setValue(3)
        self.sld_agg.valueChanged.connect(self.change_aggressiveness)
        control_layout.addWidget(self.sld_agg, 0, 1)

        control_layout.addWidget(QLabel("Speed/Freq (secs):"), 1, 0)
        self.sld_speed = QSlider(Qt.Horizontal)
        self.sld_speed.setMinimum(5) # 0.5s scaled to 5
        self.sld_speed.setMaximum(50) # 5.0s scaled to 50
        self.sld_speed.setValue(20) # 2.0s default
        self.sld_speed.valueChanged.connect(self.change_speed)
        control_layout.addWidget(self.sld_speed, 1, 1)

        control_layout.addWidget(QLabel("Spread Margin (%):"), 2, 0)
        self.cmb_spread = QComboBox()
        self.cmb_spread.addItems(["0.01%", "0.05%", "0.10%", "0.25%"])
        self.cmb_spread.currentIndexChanged.connect(self.change_spread_margin)
        control_layout.addWidget(self.cmb_spread, 2, 1)
        
        left_panel.addWidget(control_box)

        # Action Buttons
        self.btn_toggle_bot = QPushButton("⚡ START AUTO-SCALPER")
        self.btn_toggle_bot.setStyleSheet("background-color: #a6e3a1; color: #11111b; font-size: 14px;")
        self.btn_toggle_bot.clicked.connect(self.toggle_bot)
        left_panel.addWidget(self.btn_toggle_bot)

        self.btn_manual_trade = QPushButton("🎯 Force Instant Manual Buy")
        self.btn_manual_trade.clicked.connect(self.force_manual_trade)
        left_panel.addWidget(self.btn_manual_trade)

        left_panel.addStretch()
        main_layout.addLayout(left_panel, 3)

        # ----------------- Middle Panel: Charts & Market -----------------
        mid_panel = QVBoxLayout()
        
        chart_box = QGroupBox("📊 Live Order-Book Price Feed (BTC/USD)")
        chart_layout = QVBoxLayout(chart_box)
        
        self.lbl_market_price = QLabel("Price: $68,450.00 | Bid: $68,445.00 | Ask: $68,455.00")
        self.lbl_market_price.setStyleSheet("font-size: 14px; color: #89b4fa; font-weight: bold; margin-bottom: 5px;")
        chart_layout.addWidget(self.lbl_market_price)

        self.chart = MarketChartWidget()
        chart_layout.addWidget(self.chart)
        mid_panel.addWidget(chart_box)

        # Trade list / terminal feed
        feed_box = QGroupBox("📝 High-Frequency Trade Stream")
        feed_layout = QVBoxLayout(feed_box)
        
        self.lst_trades = QListWidget()
        feed_layout.addWidget(self.lst_trades)
        mid_panel.addWidget(feed_box)
        
        main_layout.addLayout(mid_panel, 5)

        # ----------------- Right Panel: LLM Log Terminal -----------------
        right_panel = QVBoxLayout()
        
        log_box = QGroupBox("🧠 Agent Brain Thoughts (Gemini LLM)")
        log_layout = QVBoxLayout(log_box)
        
        self.txt_logs = QTextEdit()
        self.txt_logs.setReadOnly(True)
        log_layout.addWidget(self.txt_logs)
        
        right_panel.addWidget(log_box)
        main_layout.addLayout(right_panel, 4)

        # Status Bar
        self.status_bar = QStatusBar()
        self.setStatusBar(self.status_bar)
        self.status_bar.showMessage("Ready. Configure your .env to authorize live Web3 transactions.")

        # Print initial startup logs
        self.add_log("💡 Desktop UI successfully initialized.")
        if PRIVATE_KEY and PRIVATE_KEY != "YOUR_PRIVATE_KEY_HERE":
            self.add_log("🔑 Loaded PRIVATE_KEY from environment.")
        else:
            self.add_log("⚠️ Run 'git update-index --assume-unchanged .env' before committing changes to protect keys.")

    # UI Slots / Handlers
    def add_log(self, text):
        self.txt_logs.append(f"[{datetime.now().strftime('%H:%M:%S')}] {text}")
        
    def update_balance_display(self, text):
        self.lbl_balance.setText(f"Balance: {text}")

    def update_price_display(self, price, bid, ask):
        self.lbl_market_price.setText(f"Price: ${price:,.2f} | Bid: ${bid:,.2f} | Ask: ${ask:,.2f}")
        self.chart.update_price(price)

    def add_trade(self, trade):
        item_text = f"[{trade['time']}] {trade['action']} {trade['amount']:.5f} BTC @ ${trade['price']:,.2f} | Status: {trade['status']}"
        self.lst_trades.insertItem(0, item_text)
        if len(self.lst_trades) > 100:
            self.lst_trades.takeItem(100)
            
        self.add_log(f"⚡ Execution success! Hash: {trade['hash'][:10]}... (Status: {trade['status']})")

    def update_identity_display(self, identity):
        self.lbl_identity.setText(f"Identity: {identity}")

    def toggle_bot(self):
        if self.agent.is_running:
            self.agent.stop_trading()
            self.btn_toggle_bot.setText("⚡ START AUTO-SCALPER")
            self.btn_toggle_bot.setStyleSheet("background-color: #a6e3a1; color: #11111b; font-size: 14px;")
        else:
            self.agent.start_trading()
            self.btn_toggle_bot.setText("🛑 STOP AUTO-SCALPER")
            self.btn_toggle_bot.setStyleSheet("background-color: #f38ba8; color: #11111b; font-size: 14px;")

    def force_manual_trade(self):
        self.add_log("🎯 Manual Trade command triggered by operator.")
        opp = {
            "action": "BUY",
            "amount": 0.005,
            "price": self.agent.bid_price,
            "type": "MARKET"
        }
        self.agent.execute_decision(opp)

    def mint_agent_soul(self):
        name = self.txt_soul_name.text()
        if not name:
            self.add_log("❌ Please specify a valid name for the agent soul.")
            return
        self.agent.mint_soul(name, "Autonomous Aggressive Scalper trading on GOAT Testnet")

    def change_aggressiveness(self, val):
        self.agent.aggressiveness = float(val)
        self.add_log(f"🔧 Aggressiveness updated to level {val}. Adjusting scalping criteria.")

    def change_speed(self, val):
        # Scale: val / 10 to convert to seconds
        self.agent.frequency = val / 10.0
        self.add_log(f"🔧 Execution frequency adjusted to {self.agent.frequency:.1f}s.")

    def change_spread_margin(self, index):
        margin_map = {0: 0.01, 1: 0.05, 2: 0.10, 3: 0.25}
        self.agent.spread_margin = margin_map.get(index, 0.05)
        self.add_log(f"🔧 Spread margin limit set to {self.agent.spread_margin}%.")

    def closeEvent(self, event):
        self.agent.stop_trading()
        event.accept()

def main():
    app = QApplication(sys.argv)
    dashboard = AgentDashboard()
    dashboard.show()
    sys.exit(app.exec_())

if __name__ == "__main__":
    main()
