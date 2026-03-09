#!/bin/bash
# =============================================================================
# PDRL Website - Full Diagnostic & Test Script
# Tests: code integrity, ports, services, database, API endpoints, frontend
# Repository: BarryGilkes/PDRL-Website-Working-Base
# =============================================================================

set -o pipefail

# ── Configuration ─────────────────────────────────────────────────────────────
BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_PORT="${FRONTEND_PORT:-3000}"
BACKEND_HOST="${BACKEND_HOST:-127.0.0.1}"
FRONTEND_HOST="${FRONTEND_HOST:-127.0.0.1}"
BACKEND_BASE="http://${BACKEND_HOST}:${BACKEND_PORT}"
FRONTEND_BASE="http://${FRONTEND_HOST}:${FRONTEND_PORT}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="${SCRIPT_DIR}/app"
BACKEND_DIR="${APP_DIR}/backend"
FRONTEND_DIR="${APP_DIR}/frontend"
LOG_FILE="${SCRIPT_DIR}/pdrl_diagnostic_$(date +%Y%m%d_%H%M%S).log"
TIMEOUT=5  # curl timeout in seconds

# ── Colour helpers ────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'  # No Colour

# ── Counters ──────────────────────────────────────────────────────────────────
PASS=0
FAIL=0
WARN=0
TOTAL=0

# ── Utility functions ─────────────────────────────────────────────────────────
timestamp() { date '+%Y-%m-%d %H:%M:%S'; }

log()      { echo -e "[$(timestamp)] $1" | tee -a "$LOG_FILE"; }
log_pass() { ((PASS++)); ((TOTAL++)); echo -e "${GREEN}  ✅ PASS${NC} - $1" | tee -a "$LOG_FILE"; }
log_fail() { ((FAIL++)); ((TOTAL++)); echo -e "${RED}  ❌ FAIL${NC} - $1" | tee -a "$LOG_FILE"; }
log_warn() { ((WARN++)); ((TOTAL++)); echo -e "${YELLOW}  ⚠️  WARN${NC} - $1" | tee -a "$LOG_FILE"; }
log_info() { echo -e "${BLUE}  ℹ️  INFO${NC} - $1" | tee -a "$LOG_FILE"; }
log_debug(){ echo -e "${CYAN}  🔍 DEBUG${NC} - $1" | tee -a "$LOG_FILE"; }

section() {
    echo "" | tee -a "$LOG_FILE"
    echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}" | tee -a "$LOG_FILE"
    echo -e "${BOLD}  $1${NC}" | tee -a "$LOG_FILE"
    echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}" | tee -a "$LOG_FILE"
}

# ── 1. ENVIRONMENT & PREREQUISITES ───────────────────────────────────────────
check_prerequisites() {
    section "1. ENVIRONMENT & PREREQUISITES"

    # OS info
    log_debug "OS: $(uname -srm)"
    log_debug "Shell: $SHELL ($BASH_VERSION)"
    log_debug "User: $(whoami)"
    log_debug "Working dir: $(pwd)"
    log_debug "Log file: $LOG_FILE"

    # Python
    if command -v python3 &>/dev/null; then
        local pyver
        pyver=$(python3 --version 2>&1)
        log_pass "Python3 found: $pyver"
        log_debug "Python path: $(which python3)"
    else
        log_fail "Python3 not found"
    fi

    # pip
    if python3 -m pip --version &>/dev/null; then
        log_pass "pip available: $(python3 -m pip --version 2>&1 | head -1)"
    else
        log_fail "pip not available"
    fi

    # Node
    if command -v node &>/dev/null; then
        log_pass "Node.js found: $(node --version)"
    else
        log_fail "Node.js not found"
    fi

    # pnpm
    if command -v pnpm &>/dev/null; then
        log_pass "pnpm found: $(pnpm --version)"
    elif command -v npm &>/dev/null; then
        log_warn "pnpm not found, npm available: $(npm --version)"
    else
        log_fail "Neither pnpm nor npm found"
    fi

    # curl
    if command -v curl &>/dev/null; then
        log_pass "curl found: $(curl --version | head -1)"
    else
        log_fail "curl not found – HTTP tests will be skipped"
    fi

    # lsof (for port checks)
    if command -v lsof &>/dev/null; then
        log_pass "lsof found"
    elif command -v ss &>/dev/null; then
        log_warn "lsof not found, but ss available"
    else
        log_warn "Neither lsof nor ss found – port checks may be limited"
    fi

    # PostgreSQL client
    if command -v psql &>/dev/null; then
        log_pass "psql found: $(psql --version)"
    else
        log_warn "psql not found – direct DB tests limited"
    fi
}

# ── 2. PROJECT STRUCTURE ─────────────────────────────────────────────────────
check_project_structure() {
    section "2. PROJECT STRUCTURE"

    local required_files=(
        "$BACKEND_DIR/main.py"
        "$BACKEND_DIR/core/config.py"
        "$BACKEND_DIR/core/database.py"
        "$BACKEND_DIR/services/database.py"
        "$BACKEND_DIR/services/auth.py"
        "$BACKEND_DIR/routers/auth.py"
        "$BACKEND_DIR/routers/health.py"
        "$BACKEND_DIR/routers/api_health.py"
        "$BACKEND_DIR/routers/registrations.py"
        "$BACKEND_DIR/routers/storage.py"
        "$BACKEND_DIR/routers/diagnostics.py"
        "$BACKEND_DIR/routers/admin_management.py"
        "$BACKEND_DIR/routers/settings.py"
        "$BACKEND_DIR/lambda_handler.py"
        "$FRONTEND_DIR/vite.config.ts"
        "$FRONTEND_DIR/src/App.tsx"
        "$FRONTEND_DIR/src/lib/config.ts"
        "$FRONTEND_DIR/src/lib/auth.ts"
        "$FRONTEND_DIR/src/lib/publicApi.ts"
        "$APP_DIR/start_app_v2.sh"
    )

    for f in "${required_files[@]}"; do
        if [ -f "$f" ]; then
            log_pass "Found: ${f#$SCRIPT_DIR/}"
        else
            log_fail "Missing: ${f#$SCRIPT_DIR/}"
        fi
    done

    local required_dirs=(
        "$BACKEND_DIR/routers"
        "$BACKEND_DIR/models"
        "$BACKEND_DIR/schemas"
        "$BACKEND_DIR/services"
        "$BACKEND_DIR/core"
        "$BACKEND_DIR/dependencies"
        "$BACKEND_DIR/mock_data"
        "$FRONTEND_DIR/src/pages"
        "$FRONTEND_DIR/src/components"
        "$FRONTEND_DIR/public"
    )

    for d in "${required_dirs[@]}"; do
        if [ -d "$d" ]; then
            local count
            count=$(find "$d" -maxdepth 1 -type f | wc -l)
            log_pass "Directory exists: ${d#$SCRIPT_DIR/} ($count files)"
        else
            log_fail "Missing directory: ${d#$SCRIPT_DIR/}"
        fi
    done
}

# ── 3. DEPENDENCY CHECKS ─────────────────────────────────────────────────────
check_dependencies() {
    section "3. DEPENDENCY CHECKS"

    # Backend
    if [ -f "$BACKEND_DIR/requirements.txt" ]; then
        log_pass "Backend requirements.txt found"
        local total_deps
        total_deps=$(grep -cve '^\s*$' "$BACKEND_DIR/requirements.txt" 2>/dev/null || echo 0)
        log_info "Backend has $total_deps dependencies listed"

        # Check critical Python packages
        local critical_packages=("fastapi" "uvicorn" "sqlalchemy" "pydantic" "pydantic-settings" "httpx" "sse-starlette")
        for pkg in "${critical_packages[@]}"; do
            if grep -qi "$pkg" "$BACKEND_DIR/requirements.txt" 2>/dev/null; then
                log_pass "Backend dep listed: $pkg"
            else
                log_warn "Backend dep not explicitly listed: $pkg (may be a sub-dependency)"
            fi
        done

        # Check if packages are actually installed
        log_info "Verifying installed Python packages..."
        for pkg in fastapi uvicorn sqlalchemy pydantic; do
            if python3 -c "import $pkg" 2>/dev/null; then
                local ver
                ver=$(python3 -c "import $pkg; print($pkg.__version__)" 2>/dev/null || echo "unknown")
                log_pass "Python package installed: $pkg ($ver)"
            else
                log_fail "Python package NOT installed: $pkg"
            fi
        done
    else
        log_fail "Backend requirements.txt not found"
    fi

    # Frontend
    if [ -f "$FRONTEND_DIR/package.json" ]; then
        log_pass "Frontend package.json found"
        local pkg_name pkg_ver
        pkg_name=$(python3 -c "import json; print(json.load(open('$FRONTEND_DIR/package.json')).get('name','?'))" 2>/dev/null)
        pkg_ver=$(python3 -c "import json; print(json.load(open('$FRONTEND_DIR/package.json')).get('version','?'))" 2>/dev/null)
        log_info "Frontend package: $pkg_name@$pkg_ver"
    else
        log_fail "Frontend package.json not found"
    fi

    if [ -d "$FRONTEND_DIR/node_modules" ]; then
        local nm_count
        nm_count=$(ls "$FRONTEND_DIR/node_modules" 2>/dev/null | wc -l)
        log_pass "node_modules exists ($nm_count top-level packages)"
    else
        log_warn "node_modules not found – run 'pnpm install' in frontend/"
    fi
}

# ── 4. ENVIRONMENT VARIABLES ─────────────────────────────────────────────────
check_env_vars() {
    section "4. ENVIRONMENT VARIABLES"

    # Check for .env files
    local env_files=("$APP_DIR/.env" "$BACKEND_DIR/.env" "$FRONTEND_DIR/.env")
    for ef in "${env_files[@]}"; do
        if [ -f "$ef" ]; then
            log_pass "Env file found: ${ef#$SCRIPT_DIR/}"
            local line_count
            line_count=$(grep -cve '^\s*$\|^\s*#' "$ef" 2>/dev/null || echo 0)
            log_info "  Contains $line_count variable definitions"
        else
            log_info "Env file not found (may be OK): ${ef#$SCRIPT_DIR/}"
        fi
    done

    # Check critical env vars
    local critical_vars=("DATABASE_URL" "HOST" "PORT" "JWT_SECRET_KEY" "FRONTEND_URL")
    for var in "${critical_vars[@]}"; do
        if [ -n "${!var}" ]; then
            # Mask sensitive values
            if [[ "$var" == *"SECRET"* ]] || [[ "$var" == *"PASSWORD"* ]] || [[ "$var" == *"KEY"* ]]; then
                log_pass "Env var set: $var=****"
            else
                log_pass "Env var set: $var=${!var}"
            fi
        else
            log_warn "Env var not set: $var"
        fi
    done

    # Check DATABASE_URL format
    if [ -n "$DATABASE_URL" ]; then
        if [[ "$DATABASE_URL" == postgresql* ]] || [[ "$DATABASE_URL" == sqlite* ]]; then
            log_pass "DATABASE_URL has valid scheme"
        else
            log_warn "DATABASE_URL scheme may be unsupported: ${DATABASE_URL%%://*}"
        fi
    fi
}

# ── 5. PORT CHECKS ───────────────────────────────────────────────────────────
check_ports() {
    section "5. PORT & PROCESS CHECKS"

    check_single_port() {
        local port=$1
        local service_name=$2
        local pid=""

        if command -v lsof &>/dev/null; then
            pid=$(lsof -ti :$port 2>/dev/null | head -1)
        elif command -v ss &>/dev/null; then
            pid=$(ss -tlnp 2>/dev/null | grep ":$port " | grep -oP 'pid=\K[0-9]+' | head -1)
        fi

        if [ -n "$pid" ]; then
            local proc_name
            proc_name=$(ps -p "$pid" -o comm= 2>/dev/null || echo "unknown")
            local proc_cmd
            proc_cmd=$(ps -p "$pid" -o args= 2>/dev/null || echo "unknown")
            log_pass "Port $port ($service_name) is LISTENING – PID: $pid ($proc_name)"
            log_debug "  Command: $proc_cmd"
        else
            log_warn "Port $port ($service_name) is NOT in use"
        fi
    }

    check_single_port "$BACKEND_PORT" "Backend/FastAPI"
    check_single_port "$FRONTEND_PORT" "Frontend/Vite"

    # Check for common conflicting ports
    local common_ports=(80 443 3000 5000 5432 8000 8080)
    log_info "Scanning common ports for conflicts..."
    for p in "${common_ports[@]}"; do
        if [ "$p" != "$BACKEND_PORT" ] && [ "$p" != "$FRONTEND_PORT" ]; then
            local pid
            if command -v lsof &>/dev/null; then
                pid=$(lsof -ti :$p 2>/dev/null | head -1)
            fi
            if [ -n "$pid" ]; then
                local pname
                pname=$(ps -p "$pid" -o comm= 2>/dev/null || echo "unknown")
                log_debug "Port $p: in use by PID $pid ($pname)"
            fi
        fi
    done

    # PostgreSQL default port
    if command -v lsof &>/dev/null; then
        local pg_pid
        pg_pid=$(lsof -ti :5432 2>/dev/null | head -1)
        if [ -n "$pg_pid" ]; then
            log_pass "PostgreSQL port 5432: LISTENING (PID $pg_pid)"
        else
            log_warn "PostgreSQL port 5432: not listening (DB may be remote or on custom port)"
        fi
    fi
}

# ── 6. BACKEND SERVICE TESTS ─────────────────────────────────────────────────
test_backend() {
    section "6. BACKEND SERVICE TESTS"

    if ! command -v curl &>/dev/null; then
        log_fail "curl not available – skipping HTTP tests"
        return
    fi

    # Helper: make a request and capture status + body
    http_test() {
        local method=$1
        local url=$2
        local description=$3
        local expected_status=${4:-200}
        local data=$5

        local curl_args=(-s -S -w "\n%{http_code}\n%{time_total}" --max-time "$TIMEOUT")
        [ "$method" = "POST" ] && curl_args+=(-X POST -H "Content-Type: application/json")
        [ -n "$data" ] && curl_args+=(-d "$data")

        local output
        output=$(curl "${curl_args[@]}" "$url" 2>&1)
        local curl_exit=$?

        if [ $curl_exit -ne 0 ]; then
            log_fail "$description – curl error (exit $curl_exit): connection refused or timeout"
            log_debug "  URL: $url"
            return 1
        fi

        local body http_code time_total
        time_total=$(echo "$output" | tail -1)
        http_code=$(echo "$output" | tail -2 | head -1)
        body=$(echo "$output" | sed '$d' | sed '$d')

        if [ "$http_code" = "$expected_status" ]; then
            log_pass "$description – HTTP $http_code (${time_total}s)"
            if [ -n "$body" ]; then
                # Pretty-print JSON if python3 available
                local pretty
                pretty=$(echo "$body" | python3 -m json.tool 2>/dev/null || echo "$body")
                log_debug "  Response: $(echo "$pretty" | head -5)"
            fi
            return 0
        else
            log_fail "$description – Expected HTTP $expected_status, got $http_code (${time_total}s)"
            log_debug "  URL: $url"
            log_debug "  Body: $(echo "$body" | head -3)"
            return 1
        fi
    }

    # Root endpoint
    http_test GET "$BACKEND_BASE/" "Root endpoint (/)"

    # Health checks
    http_test GET "$BACKEND_BASE/health" "Main health check (/health)"
    http_test GET "$BACKEND_BASE/api/v1/health" "API health check (/api/v1/health)"
    http_test GET "$BACKEND_BASE/database/health" "Database health (/database/health)"

    # OpenAPI / Docs
    http_test GET "$BACKEND_BASE/docs" "Swagger UI (/docs)"
    http_test GET "$BACKEND_BASE/openapi.json" "OpenAPI spec (/openapi.json)"

    # Public endpoints (no auth required)
    http_test GET "$BACKEND_BASE/api/v1/public/events" "Public events listing"
    http_test GET "$BACKEND_BASE/api/v1/registrations/public" "Public registrations"
    http_test GET "$BACKEND_BASE/api/v1/entities/race_times/all" "Public race times"

    # Driver endpoints
    http_test GET "$BACKEND_BASE/api/v1/driver/search?q=test" "Driver search"

    # Config endpoint
    http_test GET "$BACKEND_BASE/api/config" "Runtime config (/api/config)" "200"

    # Auth endpoints (will redirect or return auth info)
    http_test GET "$BACKEND_BASE/api/v1/auth/login" "Auth login (may redirect)" "307"

    # Diagnostics
    http_test GET "$BACKEND_BASE/api/v1/diagnostics/events-flyer-status" "Diagnostics: flyer status"

    # Protected endpoint (expect 401/403 without auth)
    http_test GET "$BACKEND_BASE/api/v1/auth/me" "Auth /me (expect 401 without token)" "401"
    http_test GET "$BACKEND_BASE/api/v1/admin/check" "Admin check (expect 401 without token)" "401"
    http_test GET "$BACKEND_BASE/api/v1/storage/list-buckets" "Storage list (expect 401)" "401"

    # Test CORS headers
    log_info "Testing CORS headers..."
    local cors_output
    cors_output=$(curl -s -I -X OPTIONS \
        -H "Origin: http://localhost:3000" \
        -H "Access-Control-Request-Method: GET" \
        --max-time "$TIMEOUT" \
        "$BACKEND_BASE/health" 2>&1)
    if echo "$cors_output" | grep -qi "access-control-allow"; then
        log_pass "CORS headers present"
        log_debug "$(echo "$cors_output" | grep -i 'access-control')"
    else
        log_warn "CORS headers not detected in OPTIONS response"
    fi
}

# ── 7. FRONTEND SERVICE TESTS ────────────────────────────────────────────────
test_frontend() {
    section "7. FRONTEND SERVICE TESTS"

    if ! command -v curl &>/dev/null; then
        log_fail "curl not available – skipping"
        return
    fi

    # Check if frontend dev server is running
    local output
    output=$(curl -s -o /dev/null -w "%{http_code}" --max-time "$TIMEOUT" "$FRONTEND_BASE/" 2>&1)

    if [ "$output" = "200" ]; then
        log_pass "Frontend dev server responding on $FRONTEND_BASE"
    else
        log_warn "Frontend dev server not responding (HTTP $output) – may not be running"
        # Check for built dist
        if [ -d "$FRONTEND_DIR/dist" ]; then
            log_pass "Frontend dist/ build exists"
            if [ -f "$FRONTEND_DIR/dist/index.html" ]; then
                log_pass "dist/index.html found"
                local size
                size=$(wc -c < "$FRONTEND_DIR/dist/index.html")
                log_info "index.html size: $size bytes"
            fi
        else
            log_warn "Frontend dist/ not found – run 'pnpm run build'"
        fi
        return
    fi

    # Test proxy pass-through to backend
    local proxy_output
    proxy_output=$(curl -s -o /dev/null -w "%{http_code}" --max-time "$TIMEOUT" "$FRONTEND_BASE/api/v1/health" 2>&1)
    if [ "$proxy_output" = "200" ]; then
        log_pass "Vite proxy /api → backend working"
    else
        log_warn "Vite proxy not working (HTTP $proxy_output)"
    fi

    # Test static assets
    for asset_path in "/favicon.ico" "/app.js"; do
        local asset_status
        asset_status=$(curl -s -o /dev/null -w "%{http_code}" --max-time "$TIMEOUT" "${FRONTEND_BASE}${asset_path}" 2>&1)
        if [ "$asset_status" = "200" ]; then
            log_pass "Static asset: $asset_path"
        else
            log_info "Static asset $asset_path: HTTP $asset_status"
        fi
    done

    # Check critical frontend pages
    local pages=("/" "/events" "/classes" "/rules" "/leaderboard" "/register" "/media" "/about" "/contact" "/driver")
    for page in "${pages[@]}"; do
        local page_status
        page_status=$(curl -s -o /dev/null -w "%{http_code}" --max-time "$TIMEOUT" "${FRONTEND_BASE}${page}" 2>&1)
        if [ "$page_status" = "200" ]; then
            log_pass "Frontend route: $page"
        else
            log_warn "Frontend route $page: HTTP $page_status"
        fi
    done
}

# ── 8. DATABASE CONNECTIVITY ─────────────────────────────────────────────────
test_database() {
    section "8. DATABASE CONNECTIVITY"

    # Test via the app's health endpoint
    local db_health
    db_health=$(curl -s --max-time "$TIMEOUT" "$BACKEND_BASE/database/health" 2>&1)
    if echo "$db_health" | grep -q '"healthy"'; then
        log_pass "Database health via API: healthy"
    elif echo "$db_health" | grep -q '"unhealthy"'; then
        log_fail "Database health via API: unhealthy"
        log_debug "Response: $db_health"
    else
        log_warn "Could not determine database health (backend may not be running)"
        log_debug "Response: $db_health"
    fi

    # Direct psql test if DATABASE_URL is set and psql exists
    if [ -n "$DATABASE_URL" ] && command -v psql &>/dev/null; then
        log_info "Attempting direct PostgreSQL connection..."
        if psql "$DATABASE_URL" -c "SELECT 1;" &>/dev/null; then
            log_pass "Direct PostgreSQL connection successful"

            # Get table count
            local table_count
            table_count=$(psql "$DATABASE_URL" -t -c \
                "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';" 2>/dev/null | tr -d ' ')
            log_info "Public schema tables: $table_count"

            # List tables
            local tables
            tables=$(psql "$DATABASE_URL" -t -c \
                "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name;" 2>/dev/null)
            if [ -n "$tables" ]; then
                log_debug "Tables: $(echo "$tables" | tr '\n' ', ' | sed 's/,$//')"
            fi
        else
            log_fail "Direct PostgreSQL connection failed"
        fi
    else
        log_info "Skipping direct DB test (DATABASE_URL not set or psql not found)"
    fi
}

# ── 9. CODE QUALITY CHECKS ───────────────────────────────────────────────────
check_code_quality() {
    section "9. CODE QUALITY CHECKS"

    # Python syntax check
    log_info "Checking Python files for syntax errors..."
    local py_errors=0
    while IFS= read -r pyfile; do
        if ! python3 -c "import py_compile; py_compile.compile('$pyfile', doraise=True)" 2>/dev/null; then
            log_fail "Syntax error: ${pyfile#$SCRIPT_DIR/}"
            ((py_errors++))
        fi
    done < <(find "$BACKEND_DIR" -name "*.py" -type f 2>/dev/null)

    if [ $py_errors -eq 0 ]; then
        local py_count
        py_count=$(find "$BACKEND_DIR" -name "*.py" -type f 2>/dev/null | wc -l)
        log_pass "All $py_count Python files pass syntax check"
    fi

    # TypeScript compilation check
    if [ -f "$FRONTEND_DIR/tsconfig.json" ]; then
        if command -v npx &>/dev/null && [ -d "$FRONTEND_DIR/node_modules" ]; then
            log_info "Running TypeScript type-check (this may take a moment)..."
            if (cd "$FRONTEND_DIR" && npx tsc --noEmit 2>/dev/null); then
                log_pass "TypeScript compilation: no errors"
            else
                log_warn "TypeScript has type errors (non-blocking for Vite builds)"
            fi
        else
            log_info "Skipping TypeScript check (npx or node_modules not available)"
        fi
    fi

    # Check for common issues
    log_info "Checking for common code issues..."

    # Hardcoded localhost in production files
    local hardcoded
    hardcoded=$(grep -rn "localhost" "$BACKEND_DIR/core/config.py" 2>/dev/null | grep -v "#" | grep -v "127.0.0.1")
    if [ -n "$hardcoded" ]; then
        log_info "Found 'localhost' references in config (may be OK for default values)"
    fi

    # Check for debug mode indicators
    if grep -q 'debug.*=.*True' "$BACKEND_DIR/core/config.py" 2>/dev/null; then
        log_warn "Debug mode appears to be ON by default in config.py"
    else
        log_pass "Debug mode is OFF by default"
    fi
}

# ── 10. API ENDPOINT ENUMERATION ─────────────────────────────────────────────
enumerate_api_routes() {
    section "10. API ROUTE ENUMERATION"

    if ! command -v curl &>/dev/null; then
        log_info "curl not available – skipping"
        return
    fi

    local openapi
    openapi=$(curl -s --max-time "$TIMEOUT" "$BACKEND_BASE/openapi.json" 2>/dev/null)

    if [ -z "$openapi" ]; then
        log_warn "Could not fetch OpenAPI spec – backend may not be running"
        # Fallback: parse router files
        log_info "Falling back to static analysis of router files..."
        if [ -d "$BACKEND_DIR/routers" ]; then
            while IFS= read -r router_file; do
                local prefix
                prefix=$(grep -oP 'prefix\s*=\s*"[^"]*"' "$router_file" 2>/dev/null | head -1 | grep -oP '"[^"]*"')
                local route_count
                route_count=$(grep -cP '@router\.(get|post|put|delete|patch)\(' "$router_file" 2>/dev/null || echo 0)
                local fname
                fname=$(basename "$router_file")
                log_info "  Router ${fname}: prefix=$prefix, routes=$route_count"
            done < <(find "$BACKEND_DIR/routers" -name "*.py" -type f 2>/dev/null)
        fi
        return
    fi

    log_pass "OpenAPI spec retrieved"

    # Parse routes with Python
    python3 -c "
import json, sys
try:
    spec = json.loads('''$openapi''')
    paths = spec.get('paths', {})
    print(f'  Total API paths: {len(paths)}')
    methods_count = {}
    for path, methods in sorted(paths.items()):
        for method in methods:
            m = method.upper()
            methods_count[m] = methods_count.get(m, 0) + 1
            print(f'    {m:6s} {path}')
    print(f'  Method summary: {dict(methods_count)}')
except Exception as e:
    print(f'  Error parsing OpenAPI: {e}', file=sys.stderr)
" 2>&1 | while IFS= read -r line; do
        log_info "$line"
    done
}

# ── 11. RESPONSE TIME BENCHMARKS ─────────────────────────────────────────────
benchmark_endpoints() {
    section "11. RESPONSE TIME BENCHMARKS"

    if ! command -v curl &>/dev/null; then
        log_info "curl not available – skipping"
        return
    fi

    local endpoints=(
        "$BACKEND_BASE/health"
        "$BACKEND_BASE/api/v1/health"
        "$BACKEND_BASE/database/health"
        "$BACKEND_BASE/api/v1/public/events"
        "$BACKEND_BASE/api/v1/registrations/public"
    )

    printf "  %-45s %10s %10s %10s\n" "Endpoint" "Status" "Time" "Size" | tee -a "$LOG_FILE"
    printf "  %-45s %10s %10s %10s\n" "─────────" "──────" "────" "────" | tee -a "$LOG_FILE"

    for ep in "${endpoints[@]}"; do
        local result
        result=$(curl -s -o /dev/null -w "%{http_code} %{time_total} %{size_download}" --max-time "$TIMEOUT" "$ep" 2>/dev/null)
        local status time_s size_b
        status=$(echo "$result" | awk '{print $1}')
        time_s=$(echo "$result" | awk '{print $2}')
        size_b=$(echo "$result" | awk '{print $3}')
        local path="${ep#$BACKEND_BASE}"
        printf "  %-45s %10s %8ss %8sB\n" "$path" "$status" "$time_s" "$size_b" | tee -a "$LOG_FILE"
    done
}

# ── 12. PROCESS & MEMORY OVERVIEW ────────────────────────────────────────────
check_processes() {
    section "12. PROCESS & MEMORY OVERVIEW"

    log_info "Looking for PDRL-related processes..."

    # Find uvicorn / python backend processes
    local backend_procs
    backend_procs=$(ps aux 2>/dev/null | grep -E "(uvicorn|python.*main\.py|fastapi)" | grep -v grep)
    if [ -n "$backend_procs" ]; then
        log_pass "Backend process(es) found:"
        echo "$backend_procs" | while IFS= read -r line; do
            log_debug "  $line"
        done
    else
        log_warn "No backend processes found"
    fi

    # Find node/vite frontend processes
    local frontend_procs
    frontend_procs=$(ps aux 2>/dev/null | grep -E "(vite|node.*dev)" | grep -v grep)
    if [ -n "$frontend_procs" ]; then
        log_pass "Frontend process(es) found:"
        echo "$frontend_procs" | while IFS= read -r line; do
            log_debug "  $line"
        done
    else
        log_warn "No frontend processes found"
    fi

    # System resources
    log_info "System resources:"
    if command -v free &>/dev/null; then
        local mem_info
        mem_info=$(free -h 2>/dev/null | grep Mem)
        log_debug "  Memory: $mem_info"
    fi

    if command -v df &>/dev/null; then
        local disk_info
        disk_info=$(df -h / 2>/dev/null | tail -1)
        log_debug "  Disk (/): $disk_info"
    fi

    # Ulimits
    log_debug "  Open files limit: $(ulimit -n 2>/dev/null || echo 'unknown')"
}

# ── 13. LOG FILE ANALYSIS ────────────────────────────────────────────────────
check_logs() {
    section "13. APPLICATION LOG ANALYSIS"

    # Check for recent backend log output
    local log_patterns=("$BACKEND_DIR/*.log" "$APP_DIR/*.log" "/var/log/pdrl*" "/tmp/pdrl*")
    local found_logs=false

    for pattern in "${log_patterns[@]}"; do
        for logfile in $pattern; do
            if [ -f "$logfile" ]; then
                found_logs=true
                local size
                size=$(wc -c < "$logfile")
                local errors
                errors=$(grep -ci "error\|exception\|traceback" "$logfile" 2>/dev/null || echo 0)
                local warnings
                warnings=$(grep -ci "warning\|warn" "$logfile" 2>/dev/null || echo 0)

                log_info "Log file: $logfile ($size bytes)"
                log_info "  Errors: $errors, Warnings: $warnings"

                if [ "$errors" -gt 0 ]; then
                    log_warn "Recent errors in $logfile:"
                    grep -i "error\|exception\|traceback" "$logfile" 2>/dev/null | tail -5 | while IFS= read -r line; do
                        log_debug "  $line"
                    done
                fi
            fi
        done
    done

    if [ "$found_logs" = false ]; then
        log_info "No application log files found (may use stdout/stderr)"
    fi
}

# ── SUMMARY ───────────────────────────────────────────────────────────────────
print_summary() {
    section "DIAGNOSTIC SUMMARY"

    echo "" | tee -a "$LOG_FILE"
    echo -e "  ${GREEN}Passed:  $PASS${NC}" | tee -a "$LOG_FILE"
    echo -e "  ${RED}Failed:  $FAIL${NC}" | tee -a "$LOG_FILE"
    echo -e "  ${YELLOW}Warnings: $WARN${NC}" | tee -a "$LOG_FILE"
    echo -e "  Total checks: $TOTAL" | tee -a "$LOG_FILE"
    echo "" | tee -a "$LOG_FILE"

    if [ $FAIL -eq 0 ]; then
        echo -e "  ${GREEN}${BOLD}🎉 ALL CRITICAL CHECKS PASSED${NC}" | tee -a "$LOG_FILE"
    elif [ $FAIL -le 3 ]; then
        echo -e "  ${YELLOW}${BOLD}⚠️  SOME ISSUES DETECTED – Review failures above${NC}" | tee -a "$LOG_FILE"
    else
        echo -e "  ${RED}${BOLD}🚨 MULTIPLE FAILURES – Immediate attention required${NC}" | tee -a "$LOG_FILE"
    fi

    echo "" | tee -a "$LOG_FILE"
    echo -e "  📄 Full log saved to: ${BOLD}$LOG_FILE${NC}" | tee -a "$LOG_FILE"
    echo "" | tee -a "$LOG_FILE"

    # Quick-fix suggestions
    if [ $FAIL -gt 0 ]; then
        section "SUGGESTED FIXES"

        if ! curl -s --max-time 2 "$BACKEND_BASE/health" &>/dev/null; then
            echo -e "  ${CYAN}Backend not reachable:${NC}" | tee -a "$LOG_FILE"
            echo "    cd app/backend && python3 main.py" | tee -a "$LOG_FILE"
            echo "    # or: cd app && bash start_app_v2.sh" | tee -a "$LOG_FILE"
            echo "" | tee -a "$LOG_FILE"
        fi

        if ! curl -s --max-time 2 "$FRONTEND_BASE/" &>/dev/null; then
            echo -e "  ${CYAN}Frontend not reachable:${NC}" | tee -a "$LOG_FILE"
            echo "    cd app/frontend && pnpm install && pnpm dev" | tee -a "$LOG_FILE"
            echo "" | tee -a "$LOG_FILE"
        fi

        echo -e "  ${CYAN}General tips:${NC}" | tee -a "$LOG_FILE"
        echo "    • Ensure DATABASE_URL is set (export DATABASE_URL=postgresql+asyncpg://...)" | tee -a "$LOG_FILE"
        echo "    • Run 'pip install -r app/backend/requirements.txt' for backend deps" | tee -a "$LOG_FILE"
        echo "    • Run 'cd app/frontend && pnpm install' for frontend deps" | tee -a "$LOG_FILE"
        echo "    • Use 'bash app/start_app_v2.sh' to start everything" | tee -a "$LOG_FILE"
        echo "" | tee -a "$LOG_FILE"
    fi
}

# ── MAIN ──────────────────────────────────────────────────────────────────────
main() {
    echo "" | tee -a "$LOG_FILE"
    echo -e "${BOLD}╔══════════════════════════════════════════════════════════════════╗${NC}" | tee -a "$LOG_FILE"
    echo -e "${BOLD}║       PDRL Website - Full Diagnostic & Test Suite              ║${NC}" | tee -a "$LOG_FILE"
    echo -e "${BOLD}║       $(timestamp)                                  ║${NC}" | tee -a "$LOG_FILE"
    echo -e "${BOLD}╚══════════════════════════════════════════════════════════════════╝${NC}" | tee -a "$LOG_FILE"

    check_prerequisites
    check_project_structure
    check_dependencies
    check_env_vars
    check_ports
    test_backend
    test_frontend
    test_database
    check_code_quality
    enumerate_api_routes
    benchmark_endpoints
    check_processes
    check_logs
    print_summary

    # Exit with error code if there were failures
    [ $FAIL -eq 0 ] && exit 0 || exit 1
}

main "$@"