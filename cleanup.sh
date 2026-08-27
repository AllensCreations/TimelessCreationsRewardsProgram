#!/usr/bin/env bash
# TCRP cleanup script — removes CONFIRMED duplicate/superseded files only.
# Does NOT touch anything I wasn't sure about (see AUDIT_REPORT.md section 4
# for the orphaned-but-maybe-intentional scripts list — review those by hand).
#
# Usage:
#   chmod +x cleanup.sh
#   ./cleanup.sh            # dry run, prints what would happen
#   ./cleanup.sh --apply    # actually deletes, after making a backup tarball

set -euo pipefail

APPLY=false
if [[ "${1:-}" == "--apply" ]]; then
  APPLY=true
fi

TARGETS=(
  # views/assets is stale and never actually ships (root assets/ wins the build copy) — see AUDIT_REPORT §3
  "views/assets"
  # root-level messengerbot.html is a 165-line abandoned draft; public/messengerbot.html (417 lines) is the real one
  "messengerbot.html"
  # root setup-persistent-menu.js is superseded by scripts/setup-persistent-menu.js (fails closed on missing token)
  "setup-persistent-menu.js"
)

echo "== TCRP cleanup =="
if [[ "$APPLY" == false ]]; then
  echo "(dry run — nothing will be deleted. Re-run with --apply to actually delete.)"
fi
echo ""

for t in "${TARGETS[@]}"; do
  if [[ -e "$t" ]]; then
    echo "  will remove: $t"
  else
    echo "  (already absent) $t"
  fi
done

if [[ "$APPLY" == true ]]; then
  echo ""
  BACKUP="tcrp_cleanup_backup_$(date +%Y%m%d_%H%M%S).tar.gz"
  echo "Backing up targets to $BACKUP before deleting..."
  EXISTING=()
  for t in "${TARGETS[@]}"; do
    [[ -e "$t" ]] && EXISTING+=("$t")
  done
  if [[ ${#EXISTING[@]} -gt 0 ]]; then
    tar -czf "$BACKUP" "${EXISTING[@]}"
    echo "Backup written: $BACKUP"
    for t in "${EXISTING[@]}"; do
      rm -rf -- "$t"
      echo "  deleted: $t"
    done
  else
    echo "Nothing to delete."
  fi
  echo ""
  echo "Done. If anything broke, restore with: tar -xzf $BACKUP"
fi

cat <<'EOF'

------------------------------------------------------------------
NOT deleted automatically (see AUDIT_REPORT.md §4 for full list) —
these are orphaned (no other file references them) but could be
manual/CLI utilities you still run by hand. Review before removing:

  scripts/audit-all-endpoints.js   scripts/fix-database.js
  scripts/fix-roster.sh            scripts/git-push.sh
  scripts/gitbranch.js             scripts/setup-messenger.js
  scripts/sync-csv.js              scripts/test-email.js
  scripts/test_status.sh           scripts/tester.sh
  scripts/update-terms.js

  test-anti-exploit.js             test-flow.js
  test-hourly-rate-limit.js        test-messenger-bot.js
  test-new-user.js                 test-new-user-detailed.js
  messenger-bot-50-users.js        cleanup-db.js
  reset-db.js                      run-all-suites.js (also broken, see §2.5)

  tests/test-bot-run.js            tests/test-brevo.js
  tests/test-live-messenger.js     tests/test-live-webhook.js
  tests/test-messenger.js          tests/tester.js
    (tests/tester.js's coverage is now folded into
     tests/tester.consolidated.js — delete the old one once you've
     confirmed the new one covers what you need)

If you confirm you don't run these by hand, delete with:
  rm -f scripts/audit-all-endpoints.js scripts/fix-database.js \
        scripts/fix-roster.sh scripts/git-push.sh scripts/gitbranch.js \
        scripts/setup-messenger.js scripts/sync-csv.js scripts/test-email.js \
        scripts/test_status.sh scripts/tester.sh scripts/update-terms.js \
        test-anti-exploit.js test-flow.js test-hourly-rate-limit.js \
        test-messenger-bot.js test-new-user.js test-new-user-detailed.js \
        messenger-bot-50-users.js cleanup-db.js reset-db.js run-all-suites.js \
        tests/test-bot-run.js tests/test-brevo.js tests/test-live-messenger.js \
        tests/test-live-webhook.js tests/test-messenger.js tests/tester.js
------------------------------------------------------------------
EOF
