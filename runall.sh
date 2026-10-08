#!/bin/bash
# 이 파일이 있는 폴더에서 검사를 전부 돌린다
cd "$(dirname "$0")" || exit 1
run(){ out=$(node "$1" 2>&1); if [ $? -eq 0 ]; then echo "PASS $1"; else echo "FAIL $1"; echo "$out" | grep -E '✗|ERR' | head -8; fi; }
export -f run
ls test.js test[0-9]*.js | xargs -P 6 -I{} bash -c 'run {}'
