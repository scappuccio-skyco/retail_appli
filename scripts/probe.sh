#!/bin/bash
# Smoke tests for API routes
# Tests basic endpoints: health, auth-protected routes

BASE_URL="${BASE_URL:-https://api.retailperformerai.com}"

echo "🔍 API Smoke Tests - Base URL: $BASE_URL"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
PASSED=0
FAILED=0

# Test function
test_endpoint() {
    method=$1
    path=$2
    expected_status=$3
    description=$4
    
    url="${BASE_URL}${path}"
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -o /dev/null -w "%{http_code}" "$url")
    elif [ "$method" = "POST" ]; then
        response=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$url" -H "Content-Type: application/json" -d '{}')
    else
        response=$(curl -s -o /dev/null -w "%{http_code}" -X "$method" "$url")
    fi
    
    if [ "$response" = "$expected_status" ]; then
        echo -e "${GREEN}✅ PASS${NC}: $method $path -> $response (expected $expected_status) - $description"
        PASSED=$((PASSED + 1))
    else
        echo -e "${RED}❌ FAIL${NC}: $method $path -> $response (expected $expected_status) - $description"
        FAILED=$((FAILED + 1))
    fi
}

# Public endpoints
echo "📋 Testing Public Endpoints..."
test_endpoint "GET" "/health" "200" "Health check"
test_endpoint "GET" "/api/health" "200" "API health check"
test_endpoint "GET" "/" "200" "Root endpoint"

# Protected endpoints (should return 401)
echo ""
echo "📋 Testing Protected Endpoints (should return 401 without auth)..."
test_endpoint "GET" "/api/stores/my-stores" "401" "Stores list (requires auth)"
test_endpoint "POST" "/api/stores/" "401" "Create store (requires auth)"
test_endpoint "GET" "/api/manager/subscription-status" "401" "Manager subscription (requires auth)"
test_endpoint "GET" "/api/seller/subscription-status" "401" "Seller subscription (requires auth)"

# Invalid route
echo ""
echo "📋 Testing Invalid Route (should return 404)..."
test_endpoint "GET" "/api/invalid/route" "404" "Invalid route"

# Summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Summary:"
echo -e "  ${GREEN}Passed: $PASSED${NC}"
if [ $FAILED -gt 0 ]; then
    echo -e "  ${RED}Failed: $FAILED${NC}"
    exit 1
else
    echo -e "  ${GREEN}Failed: $FAILED${NC}"
    exit 0
fi

