#!/bin/bash
set -e

which az > /dev/null || { echo "💥 Error! Azure CLI not found, please install https://aka.ms/azure-cli"; exit 1; }

for varName in GITHUB_TOKEN GITHUB_REPO AZURE_REGION AZURE_PREFIX AZURE_RESGRP; do
  varVal=$(eval echo "\${$varName}")
  [ -z "$varVal" ] && { echo "💥 Error! Required variable '$varName' is unset!"; varUnset=true; }
done
[ $varUnset ] && exit 1

[ "$GITHUB_REPO" ==  "https://github.com/benc-uk/chatr.git" ] && {
  echo "💔 Warning! You should be running from a fork of this repo, not a clone!";
  read -n 1 -s -r -p "Press any key to continue, or ctrl+c to exit...";
}

echo -e "\n\n🚀 Deployment started..."
az deployment sub create                 \
  --template-file deploy/main.bicep      \
  --location "$AZURE_REGION"             \
  --name chatr                           \
  --parameters githubRepo="$GITHUB_REPO" \
  githubToken="$GITHUB_TOKEN"            \
  resPrefix="$AZURE_PREFIX"              \
  resGroupName="$AZURE_RESGRP"           \
  location="$AZURE_REGION"


echo -e "\n✨ Deployment complete!\n🌐 The URL to accecss the app is: $(az deployment sub show --name chatr --query 'properties.outputs.appUrl.value' -o tsv)"
