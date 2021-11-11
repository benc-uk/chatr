# Used by `deploy` target
AZURE_PREFIX ?= chatr
AZURE_RESGRP ?= projects
AZURE_REGION ?= westeurope
GITHUB_REPO ?= $(shell git remote get-url origin)
GITHUB_TOKEN ?= 

# Don't change
API_DIR := api
CLIENT_DIR := client

.PHONY: help run deploy lint lint-fix
.DEFAULT_GOAL := help
.EXPORT_ALL_VARIABLES:

help: ## 💬 This help message
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

lint: $(API_DIR)/node_modules ## 🔎 Lint & format, will not fix but sets exit code on error 
	cd $(API_DIR); npm run lint
	eslint $(CLIENT_DIR)

lint-fix: $(API_DIR)/node_modules ## 📜 Lint & format, will try to fix errors and modify code
	cd $(API_DIR); npm run lint-fix

run: $(API_DIR)/node_modules ## 🏃 Run server locally using node
	@which swa > /dev/null || { echo "👋 Must install the SWA CLI https://aka.ms/swa-cli"; exit 1; }
	swa start ./client --api-location ./api --swa-config-location ./client

clean: ## 🧹 Clean up project
	rm -rf $(API_DIR)/node_modules

deploy: ## 🚀 Deploy everything to Azure using Bicep
	@./deploy/deploy.sh

tunnel: ## 🚇 Start loophole tunnel to expose localhost
	loophole http 7071 --hostname chatr

# ============================================================================

$(API_DIR)/node_modules: $(API_DIR)/package.json
	cd $(API_DIR); npm install --silent
	touch -m $(API_DIR)/node_modules

$(API_DIR)/package.json: 
	@echo "package.json was modified"
