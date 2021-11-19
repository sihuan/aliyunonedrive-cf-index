import config from '../config/default'

/**
 * Get access token for aliyundrive API. Refresh token if needed.
 */
export async function getAccessToken() {

  // Fetch access token
  const data1 = await BUCKET.get('aliyun', 'json')
  if (data1 && data1.access_token) {
    console.log('Fetched token from storage.')
    return data1.access_token
  }

  // Token expired, refresh access token with aliyundrive API.
  const aliyunAuthEndpoint = `${config.apiEndpoint.auth}/account/token`

  let refresh_token = config.refresh_token
  const data2 = await BUCKET.get('refresh_token')
  if (data2) {
    refresh_token = data2    
  }

  const resp = await fetch(aliyunAuthEndpoint, {
    method: 'POST',
    body: JSON.stringify({
        "refresh_token": refresh_token,
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
    await BUCKET.put('refresh_token', data.refresh_token)
    console.info('Successfully updated refresh_token.')


    // Finally, return access token
    return data.access_token
  } else {
    // eslint-disable-next-line no-throw-literal
    throw `getAccessToken error ${JSON.stringify(await resp.text())}`
  }
}