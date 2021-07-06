import emojiRegex from 'emoji-regex/RGI_Emoji'
import { getClassNameForMimeType, getClassNameForFilename } from 'font-awesome-filetypes'

import { renderHTML } from './render/htmlWrapper'
import { renderPath } from './render/pathUtil'
import { renderMarkdown } from './render/mdRenderer'
import { extensions } from './render/fileExtension'

/**
 * Convert bytes to human readable file size
 *
 * @param {Number} bytes File size in bytes
 * @param {Boolean} si 1000 - true; 1024 - false
 */
function readableFileSize(bytes, si) {
  bytes = parseInt(bytes, 10)
  var thresh = si ? 1000 : 1024
  if (Math.abs(bytes) < thresh) {
    return bytes + ' B'
  }
  var units = si
    ? ['kB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
    : ['KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB']
  var u = -1
  do {
    bytes /= thresh
    ++u
  } while (Math.abs(bytes) >= thresh && u < units.length - 1)
  return bytes.toFixed(1) + ' ' + units[u]
}

function readableUpdatedTime(updated) {
  const d = new Date(updated)
  return d.toLocaleDateString('zh-CN')
}

/**
 * Render Folder Index
 *
 * @param {*} items
 * @param {*} isIndex don't show ".." on index page.
 */
export async function renderFolderView(items, path, request) {
  const isIndex = path === '/'

  const el = (tag, attrs, content) => `<${tag} ${attrs.join(' ')}>${content}</${tag}>`
  const div = (className, content) => el('div', [`class=${className}`], content)
  const fileItem = (icon, fileName, fileAbsoluteUrl, size, noPreview) =>
    el(
      'a',
      [`href="${fileAbsoluteUrl}"`, 'class="item"', size ? `size="${size}"` : '', noPreview ? 'data-turbolinks="false"' : ''],
      el('i', [`class="${icon}"`], '') +
      fileName +
      el('div', ['style="flex-grow: 1;"'], '') +
      el('span', ['class="size"'], readableFileSize(size))
    )

  const folderItem = (icon, fileName, fileAbsoluteUrl, updated, emojiIcon) =>
    el(
      'a',
      [`href="${fileAbsoluteUrl}"`, 'class="item"'],
      (emojiIcon ? el('i', ['style="font-style: normal"'], emojiIcon) : el('i', [`class="${icon}"`], '')) +
      fileName +
      el('div', ['style="flex-grow: 1;"'], '') +
      (fileName === '..' ? '' : el('span', ['class="size"'], readableUpdatedTime(updated)))
    )

  const intro = `<div class="intro markdown-body" style="text-align: left; margin-top: 2rem;">
                    <h2>Yoo, I'm SiHuan 👋</h2>
                    <p>This is SiHuan's AliyunDrive public directory listing. Feel free to download any files that you find useful. Reach me at: sihuan [at] sakuya [dot] love.</p>
                    <p><a href="https://sakuya.love">Homepage</a> · <a href="https://blog.sakuya.love">Blog</a> · <a href="https://github.com/sihuan">GitHub</a></p>
                  </div>`

  // Check if current directory contains README.md, if true, then render spinner
  let readmeExists = false
  let readmeFetchUrl = ''

  const body = div(
    'container',
    div('path', renderPath(path)) +
    div(
      'items',
      el(
        'div',
        ['style="min-width: 600px"'],
        (!isIndex ? folderItem('far fa-folder', '..', `${path}..`) : '') +
        items
          .map(i => {
            // Check if the current item is a folder or a file
            if ('folder' === i.type) {
              const emoji = emojiRegex().exec(i.name)
              if (emoji && !emoji.index) {
                return folderItem('', i.name.replace(emoji, '').trim(), `${path}${i.name}/`, i.updated_at, emoji[0])
              } else {
                return folderItem('far fa-folder', i.name, `${path}${i.name}/`, i.updated_at)
              }
            } else if ('file' === i.type) {
              // Check if README.md exists
              if (!readmeExists) {
                // TODO: debugging for README preview rendering
                // console.log(i)

                readmeExists = i.name.toLowerCase() === 'readme.md'
                readmeFetchUrl = i.url
              }

              // Render file icons
              let fileIcon = getClassNameForMimeType(i.mime_type)
              const extension = i.file_extension
              if (fileIcon === 'fa-file') {
                // Check for files that haven't been rendered as expected
                if (extension === 'md') {
                  fileIcon = 'fab fa-markdown'
                } else if (['7z', 'rar', 'bz2', 'xz', 'tar', 'wim'].includes(extension)) {
                  fileIcon = 'far fa-file-archive'
                } else if (['flac', 'oga', 'opus'].includes(extension)) {
                  fileIcon = 'far fa-file-audio'
                } else {
                  fileIcon = `far ${getClassNameForFilename(i.name)}`
                }
              } else {
                fileIcon = `far ${fileIcon}`
              }
              return fileItem(fileIcon, i.name, `${path}${i.name}`, i.size, !(extension in extensions))
            } else {
              console.log(`unknown item type ${i}`)
            }
          })
          .join('')
      )
    ) +
    (readmeExists && !isIndex ? await renderMarkdown(readmeFetchUrl, 'fade-in-fwd', '') : '') +
    (isIndex ? intro : '')
  )
  return renderHTML(body, ...[request.pLink, request.pIdx])
}
