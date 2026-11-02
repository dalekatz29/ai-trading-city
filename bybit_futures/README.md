# Bybit Demo perpetual futures

A standalone Python client for BTCUSDT and ETHUSDT USDT-settled linear perpetuals in one-way position mode. It uses pybit 5.17.0. No strategy runs in the background. The existing Trading City spot desk and its stored AI subaccount credentials are separate from this package.

## 1. Install and test offline

Run from the repository root, or extract the supplied ZIP and open a terminal in the directory **containing** `bybit_futures`. Use Python 3.10+ and a virtual environment. These PowerShell commands use Python installed with the Windows launcher. If the launcher reports no installed Python, install [Python for Windows](https://www.python.org/downloads/windows/) or substitute the full path to an existing Python 3.10+ executable.

```powershell
py -3 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r bybit_futures/requirements.txt
.\.venv\Scripts\python.exe -m unittest discover -s bybit_futures/tests -v
.\.venv\Scripts\python.exe -m bybit_futures public-check
```

On macOS or Linux, create the environment with `python3 -m venv .venv` and replace `.\.venv\Scripts\python.exe` with `.venv/bin/python`. The unit tests use mocked responses, simulated fills and temporary SQLite databases. The separate `public-check` command makes unsigned GET requests for the demo server clock, instrument rules and mark prices. It reads neither credential.

## 2. Check your demo credentials

Sign in to Bybit, switch to **Demo Trading**, verify the demo label, and create a system-generated HMAC API key inside that profile. Use a dedicated demo account. For the first private check a read-only key is sufficient. To place orders later the demo key needs derivatives order/position permissions. Keep credentials in a secret store or inject them into this terminal session. Do not paste them into chat, source code or shell history. [Bybit Demo documentation](https://bybit-exchange.github.io/docs/v5/demo#create-api-key)

The following prompts hide what you type. The values exist in the current process environment and are inherited by its child processes.

```powershell
$env:BYBIT_API_KEY = [Net.NetworkCredential]::new('', (Read-Host 'Demo API key' -AsSecureString)).Password
$env:BYBIT_API_SECRET = [Net.NetworkCredential]::new('', (Read-Host 'Demo API secret' -AsSecureString)).Password
$env:DEMO_TRADING_ENABLED = 'false'
$env:MAX_POSITION_USDT = '100'
$env:DAILY_LOSS_LIMIT_USDT = '10'
.\.venv\Scripts\python.exe -m bybit_futures check
.\.venv\Scripts\python.exe -m bybit_futures positions
```

`check` is also the default command. It reads public data, verifies the unified demo wallet and binds local risk state to the authenticated demo UID. It prints a verification flag and market metadata. It does not print keys, raw broker responses or wallet balances. `positions` shows supported futures positions. Keep the local clock synchronized.

## 3. Operations for later use

All mutations require the exact value `DEMO_TRADING_ENABLED=true`. Leave it false while testing. To see arguments without enabling anything, use `python -m bybit_futures place --help`, `protect --help` or `close --help` with your virtual-environment Python. In PowerShell the opt-in, **when you actually intend to send demo orders**, is `$env:DEMO_TRADING_ENABLED = 'true'`. Setting it alone submits nothing.

| Command after `python -m bybit_futures` | Effect |
| --- | --- |
| `place SYMBOL --side Buy\|Sell --qty Q --price P --link-id ID` | Submit a GTC limit order after both risk checks. Quantity is in BTC or ETH, price in USDT. Optional `--stop-loss SL` and `--take-profit TP` use mark-price triggers. |
| `order-status SYMBOL --link-id ID` | Read the order's reported status and cumulative filled quantity. |
| `cancel SYMBOL --link-id ID` | Request cancellation by its original order link ID. |
| `protect SYMBOL --stop-loss SL --take-profit TP` | Set both full-position stop loss and take profit for the existing one-way position. Bybit adjusts their quantity with the position. |
| `close SYMBOL --link-id ID [--qty Q]` | Submit a reduce-only market order for all or part of a confirmed position. A partial close cannot exceed that position. |
| `reconcile` | Refresh the status of recorded entry orders. Only confirmed terminal outcomes release the local reservation. |
| `kill` | Persist an emergency halt. If writes are enabled and the account is verified, request cancellation of this client's unresolved entries. Report remaining positions where available. No automatic liquidation. |
| `resume --confirm` | When execution is enabled, reconcile and explicitly clear the emergency latch. An unresolved entry blocks resume. The daily loss latch remains in force for its UTC date. |

Replace placeholders with your own intended values. Use a unique stable link ID per instruction (1–36 letters, digits, dashes or underscores). For an ambiguous acknowledgement, query that ID and use `reconcile`. Acknowledgement is distinct from a fill or confirmed cancellation. The client never automatically resubmits an uncertain order. A verified open entry holds the reservation until it settles, so at most one entry can be working through this client. If history, fills or position updates cannot establish the outcome, verify it in Bybit Demo before further action. A market close can execute partially or expire; check the remaining size.

## Risk accounting and operating scope

- **Maximum position size.** `MAX_POSITION_USDT` defaults to 100 USDT gross notional across both contracts. Preflight counts open positions of either side, remaining non-reduce-only orders (including conditional orders), and the proposed entry. It values pending quantity at the highest applicable mark, limit or trigger. Opposing orders do not offset each other. The exchange's minimum and maximum quantities, steps, tick and minimum entry notional are checked separately. For example, a BTC minimum lot above the cap will be refused.
- **Daily loss.** `DAILY_LOSS_LIMIT_USDT` defaults to 10 USDT. The measure is the negative portion of today's aggregate reported trading cash change plus the sum of current unrealized losses on the two contracts. The transaction log's net change includes realized trade cash flow, fees and funding once. External transfers are excluded. Open profits do not offset losses. This definition uses the current loss on an overnight position and is not midnight-to-current account-equity drawdown. A breach observed at entry preflight persists until the next UTC date. An entry guard cannot cap losses from price movement on an existing position.
- **Kill and recovery.** A kill blocks new entries locally even offline or with trading disabled. In that state broker cancellations require a later enabled `kill`. Existing exchange-side protective orders remain in place. An explicit reduce-only close remains available with execution enabled. The client never removes local intent merely because an order is absent from a query. Do not resubmit under a new ID to get past a lock.
- **Persistence.** Keep the SQLite files together under `~/.trading-city/bybit-demo-futures/` on a local disk. Share this same state among processes running as the same OS user. It records order IDs, latches and an account-identity hash. It contains no API keys. Do not discard or reset it while orders may be outstanding. Use one dedicated demo account, a single machine and consistent limits; independent programs and manual orders cannot participate in its local transaction lock.
- **Network boundary.** The SDK is configured for `https://api-demo.bybit.com`. Every prepared request is checked for that exact HTTPS origin, method and path. Redirection and environment proxies are disabled, TLS verification stays on, and the signed transport suppresses raw SDK request/error logging. All market data calls use the same demo endpoint. [Bybit Demo domains](https://bybit-exchange.github.io/docs/v5/demo#domain) · [Position protection](https://bybit-exchange.github.io/docs/v5/position/trading-stop)

To end a shell session, unset the variables or close the terminal. To disarm new commands in the current PowerShell session:

```powershell
$env:DEMO_TRADING_ENABLED = 'false'
Remove-Item Env:BYBIT_API_KEY, Env:BYBIT_API_SECRET -ErrorAction SilentlyContinue
```

