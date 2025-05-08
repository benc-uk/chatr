#!/bin/bash
set -e
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

which node > /dev/null || { echo "💥 Error! Node not found, please install it https://nodejs.org/en/download/ :)"; exit 1; }

for varName in STORAGE_ACCOUNT_NAME STORAGE_ACCOUNT_KEY; do
  varVal=$(eval echo "\${$varName}")
  [ -z "$varVal" ] && { echo "💥 Error! Required variable '$varName' is unset!"; varUnset=true; }
done
[ $varUnset ] && exit 1

# Change this as required or pass in as an argument
MAX_AGE=${1:-24}

echo -e "\e[31m🧹 Warning! You are about to run the cleanup script\nThis will remove old chats and users older than $MAX_AGE hours!\e[0m";
read -n 1 -s -r -p "Press any key to continue, or ctrl+c to exit...";
echo

node "$SCRIPT_DIR/cleanup.js" "$MAX_AGE"