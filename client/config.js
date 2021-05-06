let API_ENDPOINT = ''

;(async () => {
  let res = await fetch('/api/getEndpoint')
  if (res.ok) {
    let data = await res.json()
    API_ENDPOINT = data.API_ENDPOINT
  }
})()
