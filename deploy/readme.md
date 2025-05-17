# 🚀 Deploying Chatr

This document describes how to deploy the Chatr application to Azure using Bicep and the Azure CLI.
The Chatr application is a full-stack web application that consists of a frontend built with React and a backend API built with Azure Functions. The deployment process involves creating the necessary Azure resources, deploying the API to Azure Functions, and deploying the frontend to Azure Static Web Apps.

### Pre-reqs:

- Bash & make
- Azure CLI v2.22+
- [Static Web Apps CLI](https://azure.github.io/static-web-apps-cli/)
- [Azure Function Core Tools](https://learn.microsoft.com/en-us/azure/azure-functions/functions-run-local?tabs=linux%2Cisolated-process%2Cnode-v4%2Cpython-v2%2Chttp-trigger%2Ccontainer-apps&pivots=programming-language-javascript#install-the-azure-functions-core-tools)

### Deployment Notes

- The deployment is defined in an Azure Bicep template `main.bicep` and uses modules for the various child resources.
- To aid deployment a bash script is used `deploy.sh` this does various checks and configuration handling.
- The Bicep template is deployed using `az deployment sub create` as a subscription level template, that way the resource group can also be defined in the template.

A number of Azure resources are created as part of the deployment:

- Azure Web PubSub
- Azure Static Web App
- Azure Function App
- Azure Storage Account
- Azure Application Insights

Roles are assigned from the Azure Function App's system managed identity as follows:

- Web PubSub - `Web PubSub Service Owner`
- Storage Account - `Storage Blob Data Contributor`
- Storage Account - `Storage Table Data Contributor`
- Application Insights - `Monitoring Metrics Publisher`

# Deploy using make

From the root of the project run

```
make deploy
  AZURE_RESGRP={Name of Azure resource group, will be created} \
  AZURE_REGION={Azure region to deploy to} \
  AZURE_PREFIX={Resource name prefix, e.g. mychatr}
```

You can also run:

- `make deploy-infra` - Deploy just the Azure resources
- `make deploy-api` - Deploy the API to the Function App (needs deploy-infra to have run)
- `make deploy-client` - Deploy the frontend app to Static Web App (needs deploy-infra to have run)

> Note when picking a value for AZURE_PREFIX, use something other than "chatr" as that will result in resource name clash!
