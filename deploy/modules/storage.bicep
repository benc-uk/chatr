param location string = 'westeurope'
param name string = 'chatrstore'
param deploymentPackageContainerName string = 'function-releases' // Added: Parameter for deployment package container name

resource storageAcct 'Microsoft.Storage/storageAccounts@2021-02-01' = {
  name: name
  location: location
  kind: 'StorageV2'

  sku: {
    name: 'Standard_LRS'
  }
}

// Added: Resource to create the blob container for deployment packages
// Added: Resource for blob service under the storage account
resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2021-02-01' = {
  parent: storageAcct
  name: 'default'
}

// Updated: Resource to create the blob container for deployment packages
resource deploymentPackagesContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-01-01' = {
  parent: blobService // Nests under the blob service
  name: deploymentPackageContainerName // Container name
  properties: {
    publicAccess: 'None' // Or 'Blob' or 'Container' if public access is needed, typically 'None'
  }
}

output resourceId string = storageAcct.id
output storageAccountName string = storageAcct.name
output containerName string = deploymentPackageContainerName
