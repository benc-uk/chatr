#!/bin/bash
set -e

which az > /dev/null || { echo "💥 Error! Azure CLI not found, please install https://aka.ms/azure-cli"; exit 1; }

for varName in AZURE_REGION AZURE_PREFIX AZURE_RESGRP; do
  varVal=$(eval echo "\${$varName}")
  [ -z "$varVal" ] && { echo "💥 Error! Required variable '$varName' is unset!"; varUnset=true; }
done
[ "$varUnset" ] && exit 1

# Deiplay details and pause for confirmation
echo -e "\e[32m✨ This will deploy the Chatr app to Azure with the following details:\e[33m
  - Region: $AZURE_REGION
  - Prefix: $AZURE_PREFIX
  - Resource Group: $AZURE_RESGRP\e[0m"
read -n 1 -s -r -p "Press any key to continue, or ctrl+c to exit...";

echo -e "\n\n🚀 Starting Bicep deployment..."
az deployment sub create                 \
  --template-file deploy/main.bicep      \
  --location "$AZURE_REGION"             \
  --name chatr                           \
  --parameters resPrefix="$AZURE_PREFIX" \
  resGroupName="$AZURE_RESGRP"           \
  location="$AZURE_REGION" -o table

echo -e "\n✨ Deployment complete!\n🌐 The URL to access the app is: $(az deployment sub show --name chatr --query 'properties.outputs.appUrl.value' -o tsv)\n"
