import config from '../config/default'

export async function getFilebyPath(pathname, accessToken, thumbnail, noCache) {

    let r = {
        error: null,
        data: {
            file_id: 'root',
            type: 'folder'
        }
    }

    if (pathname === '') {
        return r
    }

    if (!noCache) {
        const data = await BUCKET.get(pathname,'json')
        if( data ) {
            console.log(`Fetched path: ${decodeURI(pathname)} from storage.`)
            r.data = data
            return r
        }
    
    }

    const aliyunFileEndpoint = `${config.apiEndpoint.api}/file/get_by_path`
    const resp = await fetch(aliyunFileEndpoint, {
        method: 'POST',
        body: JSON.stringify({
            "drive_id": config.drive_id,
            "url_expire_sec": 14400,
            "image_thumbnail_process": `image/resize,${thumbnail ? thumbnail : 'w_50'}`,
            "file_path": decodeURI(pathname)
        }),
        headers: {
            Authorization: `Bearer ${accessToken}`
        }
    })
    
    let data = await resp.json()
    if (resp.ok) {
        delete data.labels
        delete data.image_media_metadata
        delete data.video_media_metadata
        await BUCKET.put(pathname, JSON.stringify(data), {expirationTtl: 14400})
        console.log(`Update path: ${decodeURI(pathname)} to storage.`)
        r.data = data
    } else {
        r.data = data
        r.error = resp.status
    }
    return r
}