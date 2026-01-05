# Smoke tests for API routes (PowerShell version)
# Tests basic endpoints: health, auth-protected routes

param(
    [string]$BaseUrl = "https://api.retailperformerai.com"
)

$script:Passed = 0
$script:Failed = 0

function Test-Endpoint {
    param(
        [string]$Method,
        [string]$Path,
        [int]$ExpectedStatus,
        [string]$Description
    )
    
    $url = "$BaseUrl$Path"
    
    try {
        if ($Method -eq "GET") {
            $response = Invoke-WebRequest -Uri $url -Method $Method -UseBasicParsing -ErrorAction SilentlyContinue
        } elseif ($Method -eq "POST") {
            $body = @{} | ConvertTo-Json
            $response = Invoke-WebRequest -Uri $url -Method $Method -Body $body -ContentType "application/json" -UseBasicParsing -ErrorAction SilentlyContinue
        } else {
            $response = Invoke-WebRequest -Uri $url -Method $Method -UseBasicParsing -ErrorAction SilentlyContinue
        }
        
        $statusCode = $response.StatusCode
    } catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
    }
    
    if ($statusCode -eq $ExpectedStatus) {
        Write-Host "✅ PASS: $Method $Path -> $statusCode (expected $ExpectedStatus) - $Description" -ForegroundColor Green
        $script:Passed++
    } else {
        Write-Host "❌ FAIL: $Method $Path -> $statusCode (expected $ExpectedStatus) - $Description" -ForegroundColor Red
        $script:Failed++
    }
}

Write-Host "🔍 API Smoke Tests - Base URL: $BaseUrl" -ForegroundColor Cyan
Write-Host ""

# Public endpoints
Write-Host "📋 Testing Public Endpoints..." -ForegroundColor Yellow
Test-Endpoint "GET" "/health" 200 "Health check"
Test-Endpoint "GET" "/api/health" 200 "API health check"
Test-Endpoint "GET" "/" 200 "Root endpoint"

# Protected endpoints (should return 401)
Write-Host ""
Write-Host "📋 Testing Protected Endpoints (should return 401 without auth)..." -ForegroundColor Yellow
Test-Endpoint "GET" "/api/stores/my-stores" 401 "Stores list (requires auth)"
Test-Endpoint "POST" "/api/stores/" 401 "Create store (requires auth)"
Test-Endpoint "GET" "/api/manager/subscription-status" 401 "Manager subscription (requires auth)"
Test-Endpoint "GET" "/api/seller/subscription-status" 401 "Seller subscription (requires auth)"

# Invalid route
Write-Host ""
Write-Host "📋 Testing Invalid Route (should return 404)..." -ForegroundColor Yellow
Test-Endpoint "GET" "/api/invalid/route" 404 "Invalid route"

# Summary
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "📊 Summary:" -ForegroundColor Cyan
Write-Host "  Passed: $script:Passed" -ForegroundColor Green
if ($script:Failed -gt 0) {
    Write-Host "  Failed: $script:Failed" -ForegroundColor Red
    exit 1
} else {
    Write-Host "  Failed: $script:Failed" -ForegroundColor Green
    exit 0
}

