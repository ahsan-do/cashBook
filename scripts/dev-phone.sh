#!/usr/bin/env bash

set -u

status=0
for port in 54321 8081 54324; do
  if adb reverse "tcp:${port}" "tcp:${port}"; then
    printf 'Forwarded phone tcp:%s to development machine tcp:%s\n' "$port" "$port"
  else
    printf 'Failed to forward tcp:%s. Check that adb is installed and a device is connected.\n' "$port" >&2
    status=1
  fi
done

exit "$status"
