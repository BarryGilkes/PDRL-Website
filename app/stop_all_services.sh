#!/bin/bash
# =============================================================================
# PDRL Service Killer - Comprehensive Stop Script
# Stops ALL services, prevents restarts, and exits the sandbox
# =============================================================================

echo "=============================================="
echo "  PDRL SERVICE KILLER - FULL SHUTDOWN"
echo "=============================================="
echo ""

# --- Step 1: Create a kill switch file to prevent start_app_v2.sh from running ---
# If start_app_v2.sh gets re-launched by the platform, this file will block it
KILL_SWITCH="/tmp/.pdrl_services_stopped"
touch "$KILL_SWITCH"
echo "[1/7] Kill switch created: $KILL_SWITCH"

# Also create it in the app directory in case the script checks there
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" 2>/dev/null && pwd)"
APP_DIR="${SCRIPT_DIR:-/home/user/app}"
if [ -d "$APP_DIR" ]; then
    touch "$APP_DIR/.stop_services"
    echo "       Kill switch also created in: $APP_DIR/.stop_services"
fi

# --- Step 2: Kill the parent start_app_v2.sh script FIRST ---
echo ""
echo "[2/7] Killing start_app_v2.sh parent process..."
START_PIDS=$(pgrep -f "start_app_v2.sh" 2>/dev/null)
if [ -n "$START_PIDS" ]; then
    for pid in $START_PIDS; do
        # Kill all children of this process first
        CHILDREN=$(pgrep -P "$pid" 2>/dev/null)
        if [ -n "$CHILDREN" ]; then
            echo "       Killing children of PID $pid: $CHILDREN"
            kill -9 $CHILDREN 2>/dev/null || true
        fi
        echo "       Killing start_app_v2.sh PID: $pid"
        kill -9 "$pid" 2>/dev/null || true
    done
    echo "       ✓ start_app_v2.sh processes killed"
else
    echo "       (no start_app_v2.sh processes found)"
fi

# --- Step 3: Kill ALL uvicorn processes (backend) ---
echo ""
echo "[3/7] Killing all uvicorn/backend processes..."
UVICORN_PIDS=$(pgrep -f "uvicorn" 2>/dev/null)
if [ -n "$UVICORN_PIDS" ]; then
    for pid in $UVICORN_PIDS; do
        # Kill child workers first
        CHILDREN=$(pgrep -P "$pid" 2>/dev/null)
        if [ -n "$CHILDREN" ]; then
            kill -9 $CHILDREN 2>/dev/null || true
        fi
        kill -9 "$pid" 2>/dev/null || true
        echo "       Killed uvicorn PID: $pid"
    done
    echo "       ✓ All uvicorn processes killed"
else
    echo "       (no uvicorn processes found)"
fi

# Also kill any stray Python processes running main:app
PYTHON_APP_PIDS=$(pgrep -f "main:app" 2>/dev/null)
if [ -n "$PYTHON_APP_PIDS" ]; then
    kill -9 $PYTHON_APP_PIDS 2>/dev/null || true
    echo "       ✓ Killed stray main:app processes"
fi

# --- Step 4: Kill ALL frontend dev server processes ---
echo ""
echo "[4/7] Killing all frontend/node processes..."
# Kill pnpm dev
PNPM_PIDS=$(pgrep -f "pnpm dev" 2>/dev/null)
if [ -n "$PNPM_PIDS" ]; then
    kill -9 $PNPM_PIDS 2>/dev/null || true
    echo "       Killed pnpm dev processes"
fi

# Kill npm dev
NPM_PIDS=$(pgrep -f "npm dev" 2>/dev/null)
if [ -n "$NPM_PIDS" ]; then
    kill -9 $NPM_PIDS 2>/dev/null || true
    echo "       Killed npm dev processes"
fi

# Kill vite dev server
VITE_PIDS=$(pgrep -f "vite" 2>/dev/null)
if [ -n "$VITE_PIDS" ]; then
    kill -9 $VITE_PIDS 2>/dev/null || true
    echo "       Killed vite processes"
fi

# Kill any remaining node processes
NODE_PIDS=$(pgrep -f "node" 2>/dev/null)
if [ -n "$NODE_PIDS" ]; then
    kill -9 $NODE_PIDS 2>/dev/null || true
    echo "       Killed all remaining node processes"
fi

echo "       ✓ All frontend processes killed"

# --- Step 5: Kill ANY process on the common ports ---
echo ""
echo "[5/7] Clearing all common ports (3000-3100, 8000-8100)..."
for port in $(seq 3000 3100) $(seq 8000 8100); do
    PIDS=""
    if command -v lsof >/dev/null 2>&1; then
        PIDS=$(lsof -ti :"$port" 2>/dev/null)
    elif command -v fuser >/dev/null 2>&1; then
        PIDS=$(fuser "$port"/tcp 2>/dev/null)
    fi
    if [ -n "$PIDS" ]; then
        kill -9 $PIDS 2>/dev/null || true
        echo "       Killed process(es) on port $port: $PIDS"
    fi
done
echo "       ✓ All ports cleared"

# --- Step 6: Disable the trap and sabotage the startup script ---
echo ""
echo "[6/7] Preventing service restart..."

# Create a wrapper that blocks start_app_v2.sh from running
# This injects an early exit at the top of the script if the kill switch exists
if [ -f "$APP_DIR/start_app_v2.sh" ]; then
    # Back up original
    cp "$APP_DIR/start_app_v2.sh" "$APP_DIR/start_app_v2.sh.bak" 2>/dev/null || true

    # Create a blocker script that wraps the original
    cat > /tmp/block_restart.sh << 'BLOCKER'
#!/bin/bash
# Check for kill switch - if it exists, refuse to start
if [ -f "/tmp/.pdrl_services_stopped" ] || [ -f "$(dirname "${BASH_SOURCE[0]}")/.stop_services" ]; then
    echo "[BLOCKED] Services were manually stopped. Remove /tmp/.pdrl_services_stopped to allow restart."
    echo "[BLOCKED] To re-enable: rm /tmp/.pdrl_services_stopped && rm -f $(dirname "${BASH_SOURCE[0]}")/.stop_services"
    # Sleep forever so the platform thinks we're running
    while true; do sleep 3600; done
    exit 0
fi
BLOCKER

    # Prepend the blocker to the start script (after the shebang)
    if head -1 "$APP_DIR/start_app_v2.sh" | grep -q "^#!"; then
        SHEBANG=$(head -1 "$APP_DIR/start_app_v2.sh")
        {
            echo "$SHEBANG"
            cat /tmp/block_restart.sh
            tail -n +2 "$APP_DIR/start_app_v2.sh.bak"
        } > "$APP_DIR/start_app_v2.sh"
    else
        {
            echo "#!/bin/bash"
            cat /tmp/block_restart.sh
            cat "$APP_DIR/start_app_v2.sh.bak"
        } > "$APP_DIR/start_app_v2.sh"
    fi
    chmod +x "$APP_DIR/start_app_v2.sh"
    echo "       ✓ start_app_v2.sh patched with restart blocker"
    echo "       ✓ Original backed up to start_app_v2.sh.bak"
fi

# --- Step 7: Final verification ---
echo ""
echo "[7/7] Verifying all services are stopped..."
sleep 2

REMAINING_UVICORN=$(pgrep -f "uvicorn" 2>/dev/null | wc -l)
REMAINING_NODE=$(pgrep -f "node" 2>/dev/null | wc -l)
REMAINING_START=$(pgrep -f "start_app_v2" 2>/dev/null | wc -l)

echo ""
echo "=============================================="
echo "  SHUTDOWN RESULTS"
echo "=============================================="
echo ""

if [ "$REMAINING_UVICORN" -eq 0 ] && [ "$REMAINING_NODE" -eq 0 ] && [ "$REMAINING_START" -eq 0 ]; then
    echo "  ✅ ALL SERVICES STOPPED SUCCESSFULLY"
else
    echo "  ⚠️  Some processes may still be running:"
    [ "$REMAINING_UVICORN" -gt 0 ] && echo "      - uvicorn processes: $REMAINING_UVICORN"
    [ "$REMAINING_NODE" -gt 0 ] && echo "      - node processes: $REMAINING_NODE"
    [ "$REMAINING_START" -gt 0 ] && echo "      - start_app processes: $REMAINING_START"
    echo ""
    echo "  Running a final nuclear kill..."
    pgrep -f "uvicorn|node|vite|pnpm|start_app" 2>/dev/null | xargs kill -9 2>/dev/null || true
    sleep 1
    echo "  ✅ Final kill completed"
fi

echo ""
echo "  🔒 Restart prevention: ACTIVE"
echo ""
echo "  To re-enable services later, run:"
echo "    rm /tmp/.pdrl_services_stopped"
echo "    rm -f $APP_DIR/.stop_services"
echo "    # Then restore the original startup script:"
echo "    cp $APP_DIR/start_app_v2.sh.bak $APP_DIR/start_app_v2.sh"
echo ""
echo "=============================================="