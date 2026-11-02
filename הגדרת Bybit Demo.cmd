@echo off
setlocal
title Trading City - Bybit Demo Setup
echo Create a Bybit DEMO system-generated HMAC key with Spot trading permission.
echo Enter it here. Input is hidden. Only this Windows user can decrypt the saved keys.
powershell.exe -NoLogo -NoProfile -Command "$env:PSModulePath=$PSHOME+'\Modules'; $ErrorActionPreference='Stop'; $key=Read-Host 'Demo API key' -AsSecureString; $secret=Read-Host 'Demo API secret' -AsSecureString; if ($key.Length -lt 4 -or $secret.Length -lt 8) {throw 'Incomplete demo credentials'}; $dir=Join-Path $env:LOCALAPPDATA 'TradingCity\BybitDemo'; [IO.Directory]::CreateDirectory($dir) | Out-Null; $tmp=Join-Path $dir ([Guid]::NewGuid().ToString()+'.tmp'); $dest=Join-Path $dir 'credentials.json'; $json=([ordered]@{key=(ConvertFrom-SecureString $key);secret=(ConvertFrom-SecureString $secret)} | ConvertTo-Json -Compress); [IO.File]::WriteAllText($tmp,$json); if ([IO.File]::Exists($dest)){[IO.File]::Replace($tmp,$dest,[System.Management.Automation.Language.NullString]::Value)}else{[IO.File]::Move($tmp,$dest)}; Write-Host 'Saved. Open Trading City and choose Connect to Bybit Demo.'"
if errorlevel 1 echo Demo setup was not completed.
pause
