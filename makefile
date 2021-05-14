# Used by `deploy` target
AZURE_PREFIX ?= chatr
AZURE_RESGRP ?= projects
AZURE_REGION ?= westeurope
GITHUB_REPO ?= $(shell git remote get-url origin)
GITHUB_TOKEN ?= 

# Don't change
SRC_DIR := api

.PHONY: help run deploy lint lint-fix
.DEFAULT_GOAL := help
.EXPORT_ALL_VARIABLES:

help:  ## 💬 This help message
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

lint: $(SRC_DIR)/node_modules  ## 🔎 Lint & format, will not fix but sets exit code on error 
	cd $(SRC_DIR); npm run lint

lint-fix: $(SRC_DIR)/node_modules  ## 📜 Lint & format, will try to fix errors and modify code
	cd $(SRC_DIR); npm run lint-fix

run: $(SRC_DIR)/node_modules  ## 🏃 Run server locally using node
	@which swa > /dev/null || { echo "👋 Must install the SWA CLI https://aka.ms/swa-cli"; exit 1; }
	swa start ./client --api ./api --swa-config-location ./client

clean:  ## 🧹 Clean up project
	rm -rf $(SRC_DIR)/node_modules

deploy:  ## 🚀 Deploy everything to Azure using Bicep
	@./deploy/deploy.sh

tunnel:  ## 🚇 Start loophole tunnel to expose localhost
	loophole http 3000 --hostname chatr

# ============================================================================

$(SRC_DIR)/node_modules: $(SRC_DIR)/package.json
	cd $(SRC_DIR); npm install --silent
	touch -m $(SRC_DIR)/node_modules

$(SRC_DIR)/package.json: 
	@echo "package.json was modified"
