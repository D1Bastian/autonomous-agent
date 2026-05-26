import sys
import os
import json
import time
import threading
from datetime import datetime
from dotenv import load_dotenv
import websocket

load_dotenv()

from PyQt5.QtWidgets import (
    QApplication, QMainWindow, QWidget, QVBoxLayout, QHBoxLayout,
    QLabel, QPushButton, QTextEdit, QLineEdit, QListWidget, QFrame,
    QSplitter, QStatusBar, QGridLayout, QComboBox, QGroupBox, QTableWidget,
    QTableWidgetItem, QHeaderView
)
from PyQt5.QtCore import Qt, QTimer, pyqtSignal, QObject
from PyQt5.QtGui import QFont, QColor, QPainter, QPen, QBrush

class BackendSignals(QObject):
    log_signal = pyqtSignal(str)
    telemetry_signal = pyqtSignal(dict)
    fleet_signal = pyqtSignal(list)

class FleetClient:
    def __init__(self, signals):
        self.signals = signals
        self.ws_url = "ws://localhost:8080"
        self.ws = None
        self.is_connected = False
        self.init_ws()

    def init_ws(self):
        try:
            self.ws = websocket.WebSocketApp(self.ws_url,
                                  on_message=self.on_message,
                                  on_error=self.on_error,
                                  on_close=self.on_close,
                                  on_open=self.on_open)
            self.ws_thread = threading.Thread(target=self.ws.run_forever, daemon=True)
            self.ws_thread.start()
        except Exception as e:
            self.signals.log_signal.emit(f"❌ WebSocket Init Error: {str(e)}")

    def on_open(self, ws):
        self.is_connected = True
        self.signals.log_signal.emit(f"🟢 Connected to Aegis Fleet Command (TS Backend)")

    def on_message(self, ws, message):
        try:
            data = json.loads(message)
            if data.get('type') == 'status':
                self.signals.log_signal.emit(f"🤖 Backend Status: {data.get('data')}")
            elif data.get('type') == 'telemetry':
                self.signals.telemetry_signal.emit(data)
            elif data.get('type') == 'log':
                self.signals.log_signal.emit(f"📡 Backend: {data.get('message')}")
            elif data.get('type') == 'fleet_update':
                self.signals.fleet_signal.emit(data.get('agents', []))
        except Exception:
            pass

    def on_error(self, ws, error):
        self.signals.log_signal.emit(f"⚠️ WS Error: {error}")

    def on_close(self, ws, close_status_code, close_msg):
        self.is_connected = False
        self.signals.log_signal.emit("🔴 WS Disconnected from backend.")

    def spawn_agent(self, name, strategy):
        if self.is_connected and self.ws:
            self.ws.send(json.dumps({
                "command": "spawn_agent",
                "name": name,
                "strategy": strategy
            }))
            self.signals.log_signal.emit(f"⚡ Requesting Agent Spawn: {name} ({strategy})")
            
    def trigger_oracle(self):
        if self.is_connected and self.ws:
            self.ws.send(json.dumps({"command": "test_x402"}))


class FleetDashboard(QMainWindow):
    def __init__(self):
        super().__init__()
        self.signals = BackendSignals()
        self.client = FleetClient(self.signals)
        
        self.signals.log_signal.connect(self.add_log)
        self.signals.fleet_signal.connect(self.update_fleet_table)
        self.signals.telemetry_signal.connect(self.process_telemetry)
        
        self.init_ui()

    def init_ui(self):
        self.setWindowTitle("🛡️ Aegis Fleet Command Center - GOAT Network")
        self.resize(1200, 750)
        
        self.setStyleSheet("""
            QMainWindow { background-color: #0e0e16; }
            QWidget { color: #cdd6f4; font-family: 'Segoe UI', Arial; }
            QPushButton {
                background-color: #1e1e2e; border: 1px solid #45475a;
                border-radius: 4px; padding: 6px 12px; font-weight: bold;
            }
            QPushButton:hover { background-color: #313244; border: 1px solid #89b4fa; }
            QTextEdit, QTableWidget {
                background-color: #11111b; border: 1px solid #313244;
                border-radius: 4px; padding: 4px; font-family: 'Consolas', monospace;
            }
            QGroupBox {
                border: 1px solid #313244; border-radius: 6px; margin-top: 10px;
                font-weight: bold; color: #89b4fa;
            }
            QGroupBox::title { subcontrol-origin: margin; left: 10px; padding: 0 5px; }
            QHeaderView::section { background-color: #1e1e2e; padding: 4px; border: 1px solid #313244; }
        """)

        central = QWidget()
        self.setCentralWidget(central)
        layout = QHBoxLayout(central)

        # Left Panel (Fleet Controls)
        left = QVBoxLayout()
        
        spawn_group = QGroupBox("🧬 Spawn New Agent (ERC-8004)")
        spawn_layout = QVBoxLayout(spawn_group)
        self.agent_name = QLineEdit()
        self.agent_name.setPlaceholderText("Agent Name (e.g. Maker-01)")
        self.agent_strat = QComboBox()
        self.agent_strat.addItems(["MAKER (Low Risk)", "ARBITRAGEUR (Med Risk)", "SCALPER (High Risk)"])
        btn_spawn = QPushButton("Mint & Spawn Agent")
        btn_spawn.clicked.connect(self.on_spawn)
        
        spawn_layout.addWidget(self.agent_name)
        spawn_layout.addWidget(self.agent_strat)
        spawn_layout.addWidget(btn_spawn)
        left.addWidget(spawn_group)
        
        oracle_group = QGroupBox("🔮 Oracle Node (x402)")
        oracle_layout = QVBoxLayout(oracle_group)
        btn_oracle = QPushButton("Test x402 Oracle Payment")
        btn_oracle.clicked.connect(self.client.trigger_oracle)
        oracle_layout.addWidget(QLabel("Sell data to other agents securely."))
        oracle_layout.addWidget(btn_oracle)
        left.addWidget(oracle_group)
        
        left.addStretch()
        
        # Middle Panel (Fleet Table)
        mid = QVBoxLayout()
        fleet_group = QGroupBox("🛡️ Active Swarm Fleet")
        fleet_layout = QVBoxLayout(fleet_group)
        
        self.fleet_table = QTableWidget(0, 4)
        self.fleet_table.setHorizontalHeaderLabels(["Name", "Strategy", "Wallet", "Balance (GOAT)"])
        self.fleet_table.horizontalHeader().setSectionResizeMode(QHeaderView.Stretch)
        fleet_layout.addWidget(self.fleet_table)
        mid.addWidget(fleet_group)
        
        # Right Panel (Logs)
        right = QVBoxLayout()
        log_group = QGroupBox("📡 Global Fleet Telemetry & Logs")
        log_layout = QVBoxLayout(log_group)
        self.txt_logs = QTextEdit()
        self.txt_logs.setReadOnly(True)
        log_layout.addWidget(self.txt_logs)
        right.addWidget(log_group)

        splitter = QSplitter(Qt.Horizontal)
        w_left, w_mid, w_right = QWidget(), QWidget(), QWidget()
        w_left.setLayout(left); w_mid.setLayout(mid); w_right.setLayout(right)
        
        splitter.addWidget(w_left)
        splitter.addWidget(w_mid)
        splitter.addWidget(w_right)
        splitter.setSizes([250, 500, 400])
        
        layout.addWidget(splitter)

    def on_spawn(self):
        name = self.agent_name.text() or "AnonAgent"
        strat = self.agent_strat.currentText().split()[0]
        self.client.spawn_agent(name, strat)

    def add_log(self, msg):
        time_str = datetime.now().strftime("%H:%M:%S")
        self.txt_logs.append(f"[{time_str}] {msg}")
        self.txt_logs.verticalScrollBar().setValue(self.txt_logs.verticalScrollBar().maximum())

    def update_fleet_table(self, agents):
        self.fleet_table.setRowCount(len(agents))
        for row, agent in enumerate(agents):
            self.fleet_table.setItem(row, 0, QTableWidgetItem(agent.get("name", "")))
            self.fleet_table.setItem(row, 1, QTableWidgetItem(agent.get("strategy", "")))
            self.fleet_table.setItem(row, 2, QTableWidgetItem(agent.get("wallet", "")))
            self.fleet_table.setItem(row, 3, QTableWidgetItem(str(agent.get("balance", "0"))))

    def process_telemetry(self, data):
        # We can update global charts here later
        pass

if __name__ == "__main__":
    app = QApplication(sys.argv)
    window = FleetDashboard()
    window.show()
    sys.exit(app.exec_())
