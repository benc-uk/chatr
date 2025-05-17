param location string = 'westeurope'
param name string = 'chatrstore'

resource storageAcct 'Microsoft.Storage/storageAccounts@2021-02-01' = {
  name: name
  location: location
  kind: 'StorageV2'

  sku: {
    name: 'Standard_LRS'
  }
}

resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2024-01-01' = {
  parent: storageAcct
  name: 'default'
}

// Add a container for the deploy-packages
resource deployPackagesContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2024-01-01' = {
  parent: blobService
  name: 'deployment-packages'
  properties: {
    publicAccess: 'None'
  }
}

output resourceId string = storageAcct.id
output storageAccountName string = storageAcct.name
