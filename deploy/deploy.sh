#!/bin/bash
set -e

which az > /dev/null || { echo "💥 Error! Azure CLI not found, please install https://aka.ms/azure-cli"; exit 1; }

for varName in GITHUB_TOKEN GITHUB_REPO AZURE_REGION AZURE_PREFIX AZURE_RESGRP; do
  varVal=$(eval echo "\${$varName}")
  [ -z $varVal ] && { echo "💥 Error! Required variable '$varName' is unset!"; varUnset=true; }
done
[ $varUnset ] && exit 1

[ "$GITHUB_REPO" ==  "https://github.com/benc-uk/chatr.git" ] && { 
  echo "💔 Warning! You should be running from a fork of this repo, not a clone!"; 
  read -n 1 -s -r -p "Press any key to continue, or ctrl+c to exit..."; 
}

subId=$(az account show --query id -o tsv)

echo -e "\n\n🚀 Deployment started..."
az deployment sub create               \
  --template-file deploy/main.bicep    \
  --location $AZURE_REGION             \
  --name chatr                         \
  --parameters githubRepo=$GITHUB_REPO \
  githubToken=$GITHUB_TOKEN            \
  resPrefix=$AZURE_PREFIX              \
  resGroupName=$AZURE_RESGRP           \
  location=$AZURE_REGION

pubSubConnStr=$(az deployment sub show --name chatr --query 'properties.outputs.pubSubConnStr.value' -o tsv)
storageKey=$(az deployment sub show --name chatr --query 'properties.outputs.storageKey.value' -o tsv)

configBody="{\"properties\":{
  \"PUBSUB_CONNECTION_STRING\": \"${pubSubConnStr}\",     \
  \"PUBSUB_HUB\":               \"chat\",                 \
  \"STORAGE_ACCOUNT_KEY\":      \"${storageKey}\",        \
  \"STORAGE_ACCOUNT_NAME\":     \"${AZURE_PREFIX}store\", \
}}"

# Using az rest commmand until this bug is fixed https://github.com/Azure/azure-cli/issues/17792
az rest --method put --headers "Content-Type=application/json" \
  --uri "/subscriptions/${subId}/resourceGroups/${AZURE_RESGRP}/providers/Microsoft.Web/staticSites/${AZURE_PREFIX}/config/functionappsettings?api-version=2020-12-01" \
  --body "${configBody}"

echo -e "\n✨ Deployment complete!\n🌐 The URL to accecss the app is: $(az deployment sub show --name chatr --query 'properties.outputs.appUrl.value' -o tsv)"
