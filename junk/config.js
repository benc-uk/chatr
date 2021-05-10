export async function getApiEndpoint() {
  // Default is blank, so all API calls point to where client is hosted from
  let endpoint = ''

  // When deployed to Azure Static Web App, try to call this API
  // This API call returns the endpoint of the real API !
  let res = await fetch('/api/getEndpoint')
  if (res.ok) {
    let data = await res.json()
    endpoint = data.API_ENDPOINT
  } else {
    console.log(`### Unable to call getEndpoint, will fall back to default`)
  }
  console.log(`### API_ENDPOINT = '${endpoint}'`)

  return endpoint
}
