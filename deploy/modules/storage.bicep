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

output key string = listKeys(storageAcct.id, storageAcct.apiVersion).keys[0].value
