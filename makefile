# Used by `deploy` & `tunnel` targets
AZURE_PREFIX ?= chatrapp
AZURE_RESGRP ?= projects
AZURE_REGION ?= westeurope
AZURE_SUB = $(shell az account show --query id -o tsv)

# Don't change :)
API_DIR := api
CLIENT_DIR := client

.PHONY: help lint lint-fix run clean deploy-infra deploy-api deploy-client deploy tunnel
.DEFAULT_GOAL := help
.EXPORT_ALL_VARIABLES:

help: ## 💬 This help message
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

lint: $(API_DIR)/node_modules ## 🔎 Lint & format, will not fix but sets exit code on error 
	cd $(API_DIR); npm run lint

lint-fix: $(API_DIR)/node_modules ## 📜 Lint & format, will try to fix errors and modify code
	cd $(API_DIR); npm run lint-fix

run: $(API_DIR)/node_modules ## 🏃 Run client and API locally using SWA CLI
	@which swa > /dev/null || { echo "👋 Must install the SWA CLI https://aka.ms/swa-cli"; exit 1; }
	swa start ./client --api-location ./api --swa-config-location ./client

clean: ## 🧹 Clean up project
	rm -rf $(API_DIR)/node_modules

deploy-infra: ## 🧱 Deploy required infra in Azure using Bicep
	@./deploy/deploy.sh

deploy-api: ## 🌐 Deploy API to Azure using Function Core Tools
	@which func > /dev/null || { echo "👋 Must install the Azure Functions Core Tools https://aka.ms/azure-functions-core-tools"; exit 1; }
	cd $(API_DIR); func azure functionapp publish $(AZURE_PREFIX)

deploy-client: ## 🧑 Deploy client to Azure using SWA CLI
	swa deploy -a ./client -n $(AZURE_PREFIX) -S $(AZURE_SUB) -R $(AZURE_RESGRP) --env production

deploy: deploy-infra deploy-api deploy-client ## 🚀 Deploy everything!

tunnel: ## 🚇 Start AWPS local tunnel tool for local development
	@which awps-tunnel > /dev/null || { echo "👋 Must install the AWPS Tunnel Tool"; exit 1; }
	awps-tunnel run --hub chat -s $(AZURE_SUB) -g $(AZURE_RESGRP) -u http://localhost:7071 -e https://$(AZURE_PREFIX).webpubsub.azure.com

# ============================================================================

$(API_DIR)/node_modules: $(API_DIR)/package.json
	cd $(API_DIR); npm install --silent
	touch -m $(API_DIR)/node_modules

$(API_DIR)/package.json: 
	@echo "package.json was modified"
