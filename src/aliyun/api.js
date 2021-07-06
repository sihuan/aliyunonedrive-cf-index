import config from '../config/default'

export async function getFilebyPath(pathname, accessToken, thumbnail) {

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

    const id = await BUCKET.get(pathname, { cacheTtl: 86400 })

    if (id) {
        const file = await getFilebyID(id, accessToken, thumbnail)
        if (file) {
            console.log(`Fetched path ${decodeURI(pathname)} from storage.`)
            r.data = file
            return r
        }
        await BUCKET.delete(pathname)
    }

    const { error, data } = await getFilebyPath(pathname.replace(/\/[^\/]*?$/, ''), accessToken)

    if (error) {
        r.error = error
        r.data = data
        return r
    }


    const aliyunFileEndpoint = `${config.apiEndpoint.api}/file/list`

    let marker = ''
    do {
        const resp = await fetch(aliyunFileEndpoint, {
            method: 'POST',
            body: JSON.stringify({
                "drive_id": config.drive_id,
                "fields": "*",
                "limit": 200,
                "marker": marker,
                "order_by": "created_at",
                "parent_file_id": data.file_id
            }),
            headers: {
                Authorization: `Bearer ${accessToken}`
            }
        })

        if (resp.ok) {
            const data = await resp.json()
            const name = decodeURI(pathname.match(/[^\/]*?$/)[0])

            for (let i of data.items) {
                if (name === i.name) {
                    await BUCKET.put(pathname, i.file_id)
                    r.data = i
                    return r
                }
            }

            marker = data.next_marker
        } else {
            r.error = resp.status
            r.data = await resp.json()
            return r
        }
    }
    while (marker);

    r.error = 404
    r.data = {
        code: "NotFound.File",
        message: "The resource file cannot be found. file not exist"
    }
    return r
}

async function getFilebyID(id, accessToken, thumbnail) {
    const aliyunFileEndpoint = `${config.apiEndpoint.api}/file/get`

    const resp = await fetch(aliyunFileEndpoint, {
        method: 'POST',
        body: JSON.stringify({
            "drive_id": config.drive_id,
            "image_thumbnail_process": `image/resize,${thumbnail ? thumbnail : 'w_50'}`,
            "file_id": id
        }),
        headers: {
            Authorization: `Bearer ${accessToken}`
        }
    })

    if (resp.ok) {
        return await resp.json()
    }
}