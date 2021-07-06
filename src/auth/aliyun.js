import config from '../config/default'

/**
 * Get access token for aliyundrive API. Refresh token if needed.
 */
export async function getAccessToken() {

  // Fetch access token
  const data = await BUCKET.get('aliyun', 'json')
  if (data && data.access_token) {
    console.log('Fetched token from storage.')
    return data.access_token
  }

  // Token expired, refresh access token with aliyundrive API.
  const aliyunAuthEndpoint = `${config.apiEndpoint.auth}/account/token`

  const resp = await fetch(aliyunAuthEndpoint, {
    method: 'POST',
    body: JSON.stringify({
        "refresh_token": config.refresh_token,
        "grant_type":"refresh_token"
    }),
    headers: {
      'Content-Type': 'application/json'
    }
  })
  if (resp.ok) {
    console.info('Successfully refreshed access_token.')
    const data = await resp.json()

    // Update expiration time on token refresh
    await BUCKET.put('aliyun', JSON.stringify(data), {expirationTtl: data.expires_in})
    console.info('Successfully updated access_token.')

    // Finally, return access token
    return data.access_token
  } else {
    // eslint-disable-next-line no-throw-literal
    throw `getAccessToken error ${JSON.stringify(await resp.text())}`
  }
}