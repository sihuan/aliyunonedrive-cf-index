import config from './config/default'
import { AUTH_ENABLED, NAME, ENABLE_PATHS } from './auth/config'
import { parseAuthHeader, unauthorizedResponse } from './auth/credentials'
import { getAccessToken } from './auth/aliyun'
import { handleFile } from './files/load'
import { extensions } from './render/fileExtension'
import { renderFolderView } from './folderView'
import { renderFilePreview } from './fileView'
import { getFilebyPath } from './aliyun/api'

addEventListener('fetch', event => {
  event.respondWith(handle(event.request))
})

async function handle(request) {
  if (AUTH_ENABLED === false) {
    return handleRequest(request)
  }

  if (AUTH_ENABLED === true) {
    const pathname = decodeURIComponent(new URL(request.url).pathname).toLowerCase()
    const privatePaths = ENABLE_PATHS.map(i => i.toLowerCase())

    if (privatePaths.filter(p => pathname.toLowerCase().startsWith(p)).length > 0 || /__Lock__/gi.test(pathname)) {
      const credentials = parseAuthHeader(request.headers.get('Authorization'))

      if (!credentials || credentials.name !== NAME || credentials.pass !== AUTH_PASSWORD) {
        return unauthorizedResponse('Unauthorized')
      }

      return handleRequest(request)
    } else {
      return handleRequest(request)
    }
  } else {
    console.info('Auth error unexpected.')
  }
}

// Cloudflare cache instance
const cache = caches.default
const base = encodeURI(config.base).replace(/\/$/, '')

function wrapPathName(pathname) {
  pathname = base + pathname
  return pathname.replace(/\/$/, '')
}

async function handleRequest(request) {
  if (config.cache && config.cache.enable) {
    const maybeResponse = await cache.match(request)
    if (maybeResponse) return maybeResponse
  }

  const accessToken = await getAccessToken()

  const { pathname, searchParams } = new URL(request.url)
  const neoPathname = pathname.replace(/pagination$/, '')
  const isRequestFolder = pathname.endsWith('/') || searchParams.get('page')

  const rawFile = searchParams.get('raw') !== null
  const thumbnail = config.thumbnail ? searchParams.get('thumbnail') : false
  const proxied = config.proxyDownload ? searchParams.get('proxied') !== null : false

  const { error, data } = await getFilebyPath(wrapPathName(neoPathname), accessToken, thumbnail)

  if (error) {
    const body = JSON.stringify(data)
    switch (error) {
      case 404:
      case 400:
        return new Response(body, {
          status: 404,
          headers: {
            'content-type': 'application/json'
          }
        })
      default:
        return new Response(body, {
          status: 500,
          headers: {
            'content-type': 'application/json'
          }
        })
    }
  }

  // 302 all folder requests that doesn't end with / or file requests that end with /
  if ((data.type === 'folder') === (!isRequestFolder)) {
    if (!isRequestFolder) {
      return Response.redirect(request.url + '/', 302)
    } else {
      return Response.redirect(request.url.slice(0, -1), 302)
    }
  }

  if (data.type === 'file') {
    if (thumbnail) {
      return await handleFile(request, pathname, data.thumbnail, {
        proxied
      })
    }

    // Render file preview view or download file directly
    const fileExt = data.file_extension

    // Render file directly if url params 'raw' are given
    if (rawFile || !(fileExt in extensions)) {
      return await handleFile(request, pathname, data.download_url, {
        proxied,
        fileSize: data.size
      })
    }

    // Add preview by CloudFlare worker cache feature
    let cacheUrl = null
    if (config.cache.enable && config.cache.previewCache && data.size < config.cache.chunkedCacheLimit) {
      cacheUrl = request.url + '?proxied&raw'
    }

    return new Response(await renderFilePreview(data, pathname, fileExt, cacheUrl || null), {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'content-type': 'text/html'
      }
    })
  }


  let body = {
    'drive_id': config.drive_id,
    'fields': '*',
    'order_by': 'name',
    'order_direction': 'ASC',
    'parent_file_id': data.file_id
  }

  // get & set {pLink ,pIdx} for fetching and paging
  const paginationLink = request.headers.get('pLink')
  const paginationIdx = request.headers.get('pIdx') - 0

  if (config.pagination.enable && config.pagination.top) {
    body["limit"] = config.pagination.top
  }
  if (paginationLink && paginationLink !== 'undefined') {
    body["marker"] = paginationLink
  }

  const resp = await fetch(`${config.apiEndpoint.api}/file/list`, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  })

  if (resp.ok) {
    let data = await resp.json()
    if (data['next_marker']) {
      request.pIdx = paginationIdx || 1
      request.pLink = data['next_marker']
    } else if (paginationIdx) {
      request.pIdx = -paginationIdx
    }

    // Render folder view, list all children files
    return new Response(await renderFolderView(data.items, neoPathname, request), {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'content-type': 'text/html'
      }
    })
  } else {
    return new Response(JSON.stringify(await resp.json()), {
      status: 500,
      headers: {
        'content-type': 'application/json'
      }
    })
  }
}