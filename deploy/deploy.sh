#!/bin/bash

[ -z "$GITHUB_TOKEN" ] && { echo "💥 Variable GITHUB_TOKEN was not set, can not continue"; exit 1; }
[ "$GITHUB_REPO" ==  "https://github.com/benc-uk/chatr.git" ] && { echo "💔 Warning! You should be running from a fork of this repo, not a clone!"; read -n 1 -s -r -p "Press any key to continue, or ctrl+c to exit..."; }

echo -e "\n\n🚀 Deployment started..."
az deployment sub create \
--template-file deploy/main.bicep \
--location $AZURE_REGION \
--name chatr \
--parameters githubRepo=$GITHUB_REPO \
githubToken=$GITHUB_TOKEN \
resPrefix=$AZURE_PREFIX \
resGroupName=$AZURE_RESGRP \
location=$AZURE_REGION

pubSubConnStr=$(az deployment sub show --name chatr --query 'properties.outputs.pubSubConnStr.value' -o tsv)
storageKey=$(az deployment sub show --name chatr --query 'properties.outputs.storageKey.value' -o tsv)

echo -e "\n💩 Unable to configure settings for Static Web App due to this CLI bug https://github.com/Azure/azure-cli/issues/17792"
echo "   Please manually set the following properties in your Static Web App config"
echo -e "\nSTORAGE_ACCOUNT_KEY\t\t${storageKey}"
echo -e "STORAGE_ACCOUNT_NAME\t\t${AZURE_PREFIX}store"
echo -e "PUBSUB_CONNECTION_STRING\t${pubSubConnStr}"
echo -e "PUBSUB_HUB\t\t\tchat"

# Uncomment when bug is eventually fixed
# az staticwebapp appsettings set --name "$AZURE_PREFIX" --setting-names "PUBSUB_CONNECTION_STRING='$pubSubConnStr'" \
# PUBSUB_HUB="chat"" \
# STORAGE_ACCOUNT_KEY=$(az deployment sub show --name chatr --query 'properties.outputs.storageKey.value') \
# STORAGE_ACCOUNT_NAME="${AZURE_PREFIX}store"

echo -e "\n✨ Deployment complete!\n🌐 The URL to accecss the app is: $(az deployment sub show --name chatr --query 'properties.outputs.appUrl.value' -o tsv)"
