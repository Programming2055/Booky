# Booky App Startup Script
# Starts both React dev server and Python ebook server

Write-Host "================================" -ForegroundColor Cyan
Write-Host "       Booky App Starter        " -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# Check if Python is available
$pythonCmd = $null
if (Get-Command python -ErrorAction SilentlyContinue) {
    $pythonCmd = "python"
} elseif (Get-Command python3 -ErrorAction SilentlyContinue) {
    $pythonCmd = "python3"
}

# Start Python server in background
if ($pythonCmd) {
    Write-Host "[1/2] Starting Python ebook server..." -ForegroundColor Yellow
    $pythonJob = Start-Process -FilePath $pythonCmd -ArgumentList "server/ebook_server.py" -NoNewWindow -PassThru
    Write-Host "      Python server started (PID: $($pythonJob.Id))" -ForegroundColor Green
} else {
    Write-Host "[1/2] Python not found - DJVU/PDF system app features will be disabled" -ForegroundColor DarkYellow
}

Write-Host ""
Write-Host "[2/2] Starting React dev server..." -ForegroundColor Yellow
Write-Host ""

# Start npm dev server (this will block)
npm run dev

# Cleanup when npm exits
if ($pythonJob) {
    Write-Host ""
    Write-Host "Stopping Python server..." -ForegroundColor Yellow
    Stop-Process -Id $pythonJob.Id -ErrorAction SilentlyContinue
}

Write-Host "Goodbye!" -ForegroundColor Cyan
