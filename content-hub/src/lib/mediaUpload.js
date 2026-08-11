// Upload de mídia para o R2 (via Worker /api/media/*).
//
// uploadMedia(file, onProgress) -> { url, key, size }
//   - Arquivos até SIMPLE_LIMIT: 1 request (POST /upload)
//   - Maiores: multipart em partes de PART_SIZE (aguenta vídeos grandes)
//   - onProgress recebe um número 0..100

const SIMPLE_LIMIT = 80 * 1024 * 1024 // 80MB
const PART_SIZE = 80 * 1024 * 1024 // 80MB por parte

function xhrSend({ method, url, body, contentType, onProgress }) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open(method, url)
    if (contentType) xhr.setRequestHeader('Content-Type', contentType)
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(e.loaded, e.total)
    }
    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText)
        if (xhr.status >= 200 && xhr.status < 300) resolve(data)
        else reject(new Error(data.error || `HTTP ${xhr.status}`))
      } catch (e) {
        reject(new Error(`Resposta inválida do servidor (HTTP ${xhr.status})`))
      }
    }
    xhr.onerror = () => reject(new Error('Falha de rede durante o upload'))
    xhr.send(body)
  })
}

async function jsonFetch(url, options) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
  return data
}

export async function uploadMedia(file, onProgress = () => {}, prefix = '') {
  const type = file.type || 'application/octet-stream'
  const prefixParam = prefix ? `&prefix=${encodeURIComponent(prefix)}` : ''

  // ---- Caminho simples (1 request) ----
  if (file.size <= SIMPLE_LIMIT) {
    const data = await xhrSend({
      method: 'POST',
      url: `/api/media/upload?filename=${encodeURIComponent(file.name)}${prefixParam}`,
      body: file,
      contentType: type,
      onProgress: (loaded, total) => onProgress(Math.round((loaded / total) * 100)),
    })
    return data
  }

  // ---- Caminho multipart (arquivos grandes) ----
  const { key, uploadId } = await jsonFetch('/api/media/mpu/create', {
    method: 'POST',
    body: JSON.stringify({ filename: file.name, contentType: type, prefix }),
  })

  const totalParts = Math.ceil(file.size / PART_SIZE)
  const parts = []

  try {
    for (let i = 0; i < totalParts; i++) {
      const start = i * PART_SIZE
      const chunk = file.slice(start, Math.min(start + PART_SIZE, file.size))
      const partNumber = i + 1

      const part = await xhrSend({
        method: 'PUT',
        url: `/api/media/mpu/part?key=${encodeURIComponent(key)}&uploadId=${encodeURIComponent(uploadId)}&partNumber=${partNumber}`,
        body: chunk,
        contentType: 'application/octet-stream',
        onProgress: (loaded) => {
          const done = start + loaded
          onProgress(Math.min(99, Math.round((done / file.size) * 100)))
        },
      })
      parts.push({ partNumber: part.partNumber, etag: part.etag })
    }

    const result = await jsonFetch('/api/media/mpu/complete', {
      method: 'POST',
      body: JSON.stringify({ key, uploadId, parts }),
    })
    onProgress(100)
    return result
  } catch (err) {
    // limpa o upload incompleto (best-effort)
    jsonFetch('/api/media/mpu/abort', {
      method: 'DELETE',
      body: JSON.stringify({ key, uploadId }),
    }).catch(() => {})
    throw err
  }
}

export async function deleteMedia(urlOrKey) {
  const key = urlOrKey.replace(/^\/api\/media\/file\//, '')
  return jsonFetch(`/api/media/file/${key}`, { method: 'DELETE' })
}

// Lista os anexos de um item (prefix = "videosLongos/<id>", "criativos/<id>"...)
export async function listMedia(prefix) {
  const data = await jsonFetch(`/api/media/list?prefix=${encodeURIComponent(prefix)}`)
  return data.files || []
}
