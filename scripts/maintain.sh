#!/usr/bin/env bash

echo "=========================================="
echo " Starting Project Audit, Bug & Cleanup Tool"
echo "=========================================="

# 1. SYNTAX BUG CHECK
echo -e "\n[+] Checking for syntax errors and bugs..."
find . -type d \( -name "node_modules" -o -name ".git" -o -name "venv" -o -name "dist" \) -prune -o -type f \( -name "*.js" -o -name "*.py" -o -name "*.sh" \) -print | while read -r file; do
    case "$file" in
        *.js)
            node -c "$file" 2>&1 || echo "Bug found in JS: $file"
            ;;
        *.py)
            python3 -m py_compile "$file" 2>&1 || echo "Bug found in Python: $file"
            ;;
        *.sh)
            bash -n "$file" 2>&1 || echo "Bug found in Shell script: $file"
            ;;
    esac
done

# 2. FIND DUPLICATE FILES
echo -e "\n[+] Scanning for duplicate files (by MD5 hash)..."
find . -type d \( -name "node_modules" -o -name ".git" -o -name "venv" \) -prune -o -type f -exec md5sum {} + | sort | uniq -w32 -d --all-repeated=separate

# 3. UNUSED FILES / DEAD CODE SWEEP
echo -e "\n[+] Analyzing unused files..."
# Modify extensions or add paths you want to safely sweep below:
# Example: Automatically listing files not modified or referenced recently
find . -type f \( -name "*.tmp" -o -name "*.log" -o -name "*.bak" \) 2>/dev/null | while read -r oldfile; do
    echo "Found safe-to-delete temp/log file: $oldfile"
    # Uncomment the line below to auto-delete them:
    # rm "$oldfile"
done

echo -e "\n=========================================="
echo " Audit Complete."
echo "=========================================="
