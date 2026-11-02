import { promises as fs, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash, randomUUID } from 'node:crypto';

const run = promisify(execFile);
const dir = join(process.env.LOCALAPPDATA || join(homedir(), '.local', 'share'), 'TradingCity', 'BybitDemo');
const ledgerPath = join(dir, 'ledger-v1.json');
const credentialPath = join(dir, 'credentials.json');

export const hasDemoCredentials = () =>
  Boolean((process.env.BYBIT_DEMO_API_KEY && process.env.BYBIT_DEMO_API_SECRET) ||
    (process.platform === 'win32' && existsSync(credentialPath)));

export async function loadDemoCredentials() {
  let apiKey = process.env.BYBIT_DEMO_API_KEY, apiSecret = process.env.BYBIT_DEMO_API_SECRET;
  if (!apiKey || !apiSecret) {
    if (process.platform !== 'win32' || !existsSync(credentialPath)) throw Error('יש להגדיר מפתח דמו מקומי.');
    const decrypt = [
      "$env:PSModulePath=$PSHOME+'\\Modules'",
      "$ErrorActionPreference='Stop'",
      "$file=Get-Content -LiteralPath $env:TRADING_CITY_KEY_FILE -Raw | ConvertFrom-Json",
      "function ReadProtected($cipher) { [Net.NetworkCredential]::new('',(ConvertTo-SecureString $cipher)).Password }",
      "[Console]::Write((@{apiKey=(ReadProtected $file.key);apiSecret=(ReadProtected $file.secret)} | ConvertTo-Json -Compress))"
    ].join(';');
    try {
      const result = await run('powershell.exe', ['-NoProfile','-NonInteractive','-Command',decrypt],
        {windowsHide:true, timeout:10000, maxBuffer:16384, env:{...process.env,TRADING_CITY_KEY_FILE:credentialPath}});
      ({apiKey, apiSecret} = JSON.parse(result.stdout));
    } catch { throw Error('לא ניתן לפתוח את מפתח הדמו המקומי תחת משתמש Windows הנוכחי.'); }
  }
  if (!apiKey || !apiSecret) throw Error('פרטי הדמו המקומיים חסרים.');
  return {apiKey, apiSecret, fingerprint:createHash('sha256').update(apiKey).digest('hex')};
}

export async function readLedger() {
  try { return JSON.parse(await fs.readFile(ledgerPath, 'utf8')); }
  catch (err) { if (err.code === 'ENOENT') return null; throw Error('לא ניתן לקרוא את יומן הדמו. שליחת הוראות חסומה.'); }
}

export async function writeLedger(data) {
  await fs.mkdir(dir, {recursive:true, mode:0o700});
  const temp = join(dir, 'ledger-' + randomUUID() + '.tmp');
  try {
    await fs.writeFile(temp, JSON.stringify(data), {encoding:'utf8',mode:0o600,flag:'wx',flush:true});
    await fs.rename(temp, ledgerPath);
  } finally { await fs.unlink(temp).catch(()=>{}); }
}
