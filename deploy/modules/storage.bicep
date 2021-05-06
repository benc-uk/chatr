param location string = 'westeurope'
param name string = 'chatrstore'
param shareName string = 'caddydata'

resource storageAcct 'Microsoft.Storage/storageAccounts@2021-02-01' = {
  name: name
  location: location
  kind: 'StorageV2'
  
  sku: {
    name: 'Standard_LRS'
    tier: 'Standard'
  }
}

resource share 'Microsoft.Storage/storageAccounts/fileServices/shares@2021-02-01' = {
  name: '${storageAcct.name}/default/${shareName}'
}

output key string = listKeys(storageAcct.id, storageAcct.apiVersion).keys[0].value
