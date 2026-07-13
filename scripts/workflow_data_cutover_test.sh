#!/usr/bin/env bash
#
# Copyright 2025 coze-dev Authors
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRIPT="$ROOT_DIR/scripts/workflow_data_cutover.sh"
TESTS=0

fail() {
  printf 'FAIL: %s\n' "$*" >&2
  exit 1
}

assert_eq() {
  TESTS=$((TESTS + 1))
  [ "$1" = "$2" ] || fail "expected '$2', got '$1'"
}

assert_fails() {
  TESTS=$((TESTS + 1))
  if "$@" >/dev/null 2>&1; then
    fail "expected command to fail: $*"
  fi
}

[ -f "$SCRIPT" ] || fail "missing $SCRIPT"

WORKFLOW_CUTOVER_LIB_ONLY=1
# shellcheck source=workflow_data_cutover.sh
source "$SCRIPT"

assert_eq "$(normalize_object_key 'default_icon/default_workflow_icon.png')" \
  "default_icon/default_workflow_icon.png"
assert_eq "$(normalize_object_key 'tos-cn-i-v4nquku3lp/mirap-phase0-upload-20260711.txt')" \
  "tos-cn-i-v4nquku3lp/mirap-phase0-upload-20260711.txt"
assert_fails normalize_object_key '../mysql/ibdata1'
assert_fails normalize_object_key '/etc/passwd'
assert_fails normalize_object_key 'foo//bar'
assert_fails require_destructive_confirmation migrate run-1 false
assert_fails require_destructive_confirmation migrate '' true
assert_eq "$(csv_join user space workflow_meta)" "user,space,workflow_meta"
assert_eq "$(normalize_run_id '20260713-143959')" "20260713-143959"
assert_fails normalize_run_id '../outside'
assert_fails normalize_run_id 'run/child'
assert_fails normalize_run_id '..'
assert_eq "$(workflow_source_where workflow_meta '11,22')" "id IN (11,22)"
assert_eq "$(workflow_source_where workflow_draft '11,22')" "id IN (11,22)"
assert_eq "$(workflow_source_where workflow_version '11,22')" "workflow_id IN (11,22)"
assert_eq "$(workflow_source_where workflow_reference '11,22')" \
  "referring_id IN (11,22) AND referred_id IN (11,22)"
assert_fails workflow_source_where workflow_meta '11,abc'
assert_fails workflow_source_where user '11,22'

printf 'PASS: %d workflow cutover helper assertions\n' "$TESTS"
