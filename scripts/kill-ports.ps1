param()
$ErrorActionPreference = "SilentlyContinue"

function Kill-Port([int]$port) {
    $lines = netstat -ano | Select-String ":$port " | Select-String "LISTENING"
    if (-not $lines) {
        Write-Host "INFO: porta $port ja esta livre"
        return
    }
    $lines | ForEach-Object {
        $pid = ($_.ToString().Trim() -split "\s+")[-1]
        if ($pid -match "^\d+$" -and $pid -ne "0") {
            Write-Host "Matando PID $pid na porta $port ..."
            taskkill /PID $pid /F 2>$null
        }
    }
}

# Matar processos node.exe que possam ter ficado presos (ts-node, vite, etc.)
Write-Host "Limpando processos Node.js residuais ..."
Get-Process -Name "node" -ErrorAction SilentlyContinue | ForEach-Object {
    Write-Host "Matando node PID $($_.Id) ..."
    Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
}

Start-Sleep -Milliseconds 500

Kill-Port 3001
Kill-Port 3006
Kill-Port 3007

Write-Host "Portas liberadas."
