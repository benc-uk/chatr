//
// Chatr - API
// Token validation for JWT issued from Microsoft Entra ID
// Ben Coleman, 2025
//

import jwt from 'jsonwebtoken'
import jwksClient from 'jwks-rsa'

// Singleton memoized client
let client = null

async function getKey(kid, tenantId) {
  if (!client) {
    client = jwksClient({
      jwksUri: `https://login.microsoftonline.com/${tenantId}/discovery/keys`,
      cache: true,
      rateLimit: false,
      cacheMaxEntries: 5,
      cacheTTL: 60 * 60 * 24,
    })
  }

  try {
    const key = await client.getSigningKey(kid)
    return key.getPublicKey()
  } catch (err) {
    console.error(`Error getting signing key from https://login.microsoftonline.com/${tenantId}/discovery/keys`)
    console.error('Check the tenantId is correct and login.microsoftonline.com is reachable')
    throw new Error(`Error getting signing key: ${err.message}`)
  }
}

export async function validate(token, tenantId) {
  if (!token) {
    throw new Error('Missing token')
  }

  const decoded = jwt.decode(token, { complete: true })
  if (!decoded) {
    throw new Error('Invalid token')
  }

  const kid = decoded.header.kid
  if (!kid) {
    throw new Error('Missing kid in token header')
  }

  const key = await getKey(kid, tenantId)
  if (!key) {
    throw new Error('Key not found')
  }

  jwt.verify(token, key)
}
