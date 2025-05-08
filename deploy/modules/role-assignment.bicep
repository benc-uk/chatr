// Filepath: c:\Source\Repos\chatr\deploy\modules\role-assignment.bicep
targetScope = 'resourceGroup' // This module is deployed into a resource group

param principalId string
param roleDefinitionId string
param roleAssignmentName string
param storageAccountName string // Name of the storage account to assign the role to

// Reference the existing storage account within this module's deployment scope (resource group)
resource storageAccount 'Microsoft.Storage/storageAccounts@2023-01-01' existing = {
  name: storageAccountName
}

resource roleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: roleAssignmentName
  scope: storageAccount // Assign the role directly on the symbolically referenced storage account
  properties: {
    roleDefinitionId: roleDefinitionId
    principalId: principalId
    principalType: 'ServicePrincipal'
  }
}
