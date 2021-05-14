# 🚀 Deploying Chatr

Pre-reqs:

- Bash
- Azure CLI v2.22+
- [Fork of this repo](https://github.com/benc-uk/chatr) in GitHub
- [A GitHub PAT](https://docs.github.com/en/github/authenticating-to-github/creating-a-personal-access-token) with admin rights to the forked repo

The reason a fork is required is due to how Azure Static WebApps deploys the app, after creating the resource in Azure, it creates a GitHub Actions workflow in the repo containing the app code, this workflow carries out the task of building/bundling and deploying the app.  
If you were to work from a clone the deployment, would try to create this workflow in my repo

### Deployment Notes

- The deployment is defined in an Azure Bicep template `main.bicep` and uses modules for the various child resources.
- To aid deployment a bash script is used `deploy.sh` this does various checks and configuration handling.
- The Bicep template is deployed using `az deployment sub create` as a subscription level template, that way the resource group can also be defined in the template.
- Outputs are used to pass values from modules to the main template and to the overall deployment output.
- The Static Web App config values (app settings) can not be set at resource deployment time, these have to be configured after the app code and function app have been deployed as a separate step.
- Due to a [bug in the Azure CLI](https://github.com/Azure/azure-cli/issues/17792), the command `az staticwebapp appsettings set` does not function as intended. A workaround has been found using `az rest --method put`

# Deploy using make

From the root of the project run

```
make deploy GITHUB_TOKEN={{Your GitHub PAT token}} \
  GITHUB_REPO={{GitHub URL of your fork}} \
  AZURE_RESGRP={{Name of Azure resource group, will be created}} \
  AZURE_REGION={{Azure region to deploy to}} \
  AZURE_PREFIX={{Resource name prefix, e.g. mychatr}}
```

> Note when picking a value for AZURE_PREFIX, use something other than "chatr" as that will result in resource name clash
