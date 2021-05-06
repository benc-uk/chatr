# Used by `image`, `push` & `deploy` targets, override as required
IMAGE_REG ?= ghcr.io
IMAGE_REPO ?= benc-uk/chatr/server
IMAGE_TAG ?= latest

# Used by `deploy` target
AZURE_PREFIX ?= chatr
AZURE_RESGRP ?= chatr
AZURE_REGION ?= westeurope
GITHUB_REPO ?= $(shell git remote get-url origin)
GITHUB_TOKEN ?= ""

# Don't change
SRC_DIR := server

.PHONY: help image push run watch deploy
.DEFAULT_GOAL := help

help:  ## 💬 This help message
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

lint: $(SRC_DIR)/node_modules  ## 🔎 Lint & format, will not fix but sets exit code on error 
	cd $(SRC_DIR); npm run lint

lint-fix: $(SRC_DIR)/node_modules  ## 📜 Lint & format, will try to fix errors and modify code
	cd $(SRC_DIR); npm run lint-fix

image:  ## 🔨 Build container image from Dockerfile 
	docker build $(SRC_DIR) --file build/Dockerfile \
	--tag $(IMAGE_REG)/$(IMAGE_REPO):$(IMAGE_TAG)

push:  ## 📤 Push container image to registry 
	docker push $(IMAGE_REG)/$(IMAGE_REPO):$(IMAGE_TAG)

run: $(SRC_DIR)/node_modules  ## 🏃 Run locally using Node.js
	cd $(SRC_DIR); npm start

watch: $(SRC_DIR)/node_modules  ## 👀 Watch & hot reload locally using nodemon
	cd $(SRC_DIR); nodemon server.js

clean:  ## 🧹 Clean up project
	rm -rf $(SRC_DIR)/node_modules

deploy:  ## 🚀 Deploy everything to Azure using Bicep
ifeq ($(GITHUB_TOKEN),"")
	@echo "💥 Variable GITHUB_TOKEN was not set, can not continue"
	exit 1
endif
ifeq ($(GITHUB_REPO),https://github.com/benc-uk/chatr.git)
	@echo "⛔ Warning! You should be running from a fork of this repo, not a clone!"
	@bash -c 'read -n 1 -s -r -p "Press any key to continue, or ctrl+c to exit..."'
	@echo "\n\n🚀 Starting deployment...\n"
endif
	@az deployment sub create \
	--template-file deploy/main.bicep \
	--location $(AZURE_REGION) \
	--parameters githubRepo=$(GITHUB_REPO) githubToken="$(GITHUB_TOKEN)" resPrefix=$(AZURE_PREFIX) resGroupName=$(AZURE_RESGRP) location=$(AZURE_REGION)
	az staticwebapp appsettings set --name $(AZURE_PREFIX) --setting-names "API_ENDPOINT=https://$(AZURE_PREFIX).$(AZURE_REGION).azurecontainer.io"
	@echo "🌐 The URL to accecss the app is: $(shell az deployment sub show --name main --query 'properties.outputs.appUrl.value')"

# ============================================================================

$(SRC_DIR)/node_modules: $(SRC_DIR)/package.json
	cd $(SRC_DIR); npm install --silent
	touch -m $(SRC_DIR)/node_modules

$(SRC_DIR)/package.json: 
	@echo "package.json was modified"
