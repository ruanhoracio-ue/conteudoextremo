import { Hono } from 'hono'

// Upload e entrega de mídia (vídeos, criativos, reels) via Cloudflare R2.
// Binding: env.MEDIA (bucket content-hub-media, ver wrangler.jsonc).
//
// Fluxos de upload:
//   1. Arquivos até ~90MB: POST /api/media/upload (1 request, corpo = arquivo)
//   2. Arquivos grandes: multipart em partes de ~80MB
//      POST /api/media/mpu/create  -> { key, uploadId }
//      PUT  /api/media/mpu/part?key=&uploadId=&partNumber=  (corpo = parte)
//      POST /api/media/mpu/complete { key, uploadId, parts }
//      DELETE /api/media/mpu/abort { key, uploadId }
//
// Entrega: GET /api/media/file/<key> (com suporte a Range p/ player de vídeo)
export const mediaRouter = new Hono()

function bucketOf(c) {
  return c.env && c.env.MEDIA ? c.env.MEDIA : null
}

function sanitizeFilename(name) {
  return (name || 'arquivo')
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // remove acentos
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .slice(0, 120) || 'arquivo'
}

function newKey(filename) {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const rand = Math.random().toString(36).slice(2, 8)
  return `uploads/${yyyy}/${mm}/${Date.now()}-${rand}-${sanitizeFilename(filename)}`
}

// POST /api/media/upload?filename=video.mp4  (corpo = bytes do arquivo)
mediaRouter.post('/upload', async (c) => {
  const bucket = bucketOf(c)
  if (!bucket) return c.json({ error: 'Bucket R2 (MEDIA) não está vinculado. Crie o bucket content-hub-media e faça deploy.' }, 500)

  const filename = c.req.query('filename') || 'arquivo'
  const contentType = c.req.header('content-type') || 'application/octet-stream'
  const key = newKey(filename)

  try {
    const obj = await bucket.put(key, c.req.raw.body, {
      httpMetadata: { contentType },
      customMetadata: { originalName: filename },
    })
    return c.json({
      success: true,
      key,
      size: obj.size,
      url: `/api/media/file/${key}`,
    })
  } catch (err) {
    console.error('R2 upload error:', err)
    return c.json({ error: `Falha no upload: ${err.message}` }, 500)
  }
})

// POST /api/media/mpu/create { filename, contentType }
mediaRouter.post('/mpu/create', async (c) => {
  const bucket = bucketOf(c)
  if (!bucket) return c.json({ error: 'Bucket R2 (MEDIA) não está vinculado.' }, 500)

  const { filename, contentType } = await c.req.json().catch(() => ({}))
  const key = newKey(filename)

  try {
    const mpu = await bucket.createMultipartUpload(key, {
      httpMetadata: { contentType: contentType || 'application/octet-stream' },
      customMetadata: { originalName: filename || 'arquivo' },
    })
    return c.json({ key: mpu.key, uploadId: mpu.uploadId })
  } catch (err) {
    return c.json({ error: `Falha ao iniciar upload: ${err.message}` }, 500)
  }
})

// PUT /api/media/mpu/part?key=&uploadId=&partNumber=1  (corpo = bytes da parte)
mediaRouter.put('/mpu/part', async (c) => {
  const bucket = bucketOf(c)
  if (!bucket) return c.json({ error: 'Bucket R2 (MEDIA) não está vinculado.' }, 500)

  const key = c.req.query('key')
  const uploadId = c.req.query('uploadId')
  const partNumber = parseInt(c.req.query('partNumber'), 10)
  if (!key || !uploadId || !partNumber) {
    return c.json({ error: 'key, uploadId e partNumber são obrigatórios' }, 400)
  }

  try {
    const mpu = bucket.resumeMultipartUpload(key, uploadId)
    const part = await mpu.uploadPart(partNumber, c.req.raw.body)
    return c.json({ partNumber: part.partNumber, etag: part.etag })
  } catch (err) {
    return c.json({ error: `Falha na parte ${partNumber}: ${err.message}` }, 500)
  }
})

// POST /api/media/mpu/complete { key, uploadId, parts: [{partNumber, etag}] }
mediaRouter.post('/mpu/complete', async (c) => {
  const bucket = bucketOf(c)
  if (!bucket) return c.json({ error: 'Bucket R2 (MEDIA) não está vinculado.' }, 500)

  const { key, uploadId, parts } = await c.req.json().catch(() => ({}))
  if (!key || !uploadId || !Array.isArray(parts)) {
    return c.json({ error: 'key, uploadId e parts são obrigatórios' }, 400)
  }

  try {
    const mpu = bucket.resumeMultipartUpload(key, uploadId)
    const obj = await mpu.complete(parts)
    return c.json({ success: true, key, size: obj.size, url: `/api/media/file/${key}` })
  } catch (err) {
    return c.json({ error: `Falha ao finalizar upload: ${err.message}` }, 500)
  }
})

// DELETE /api/media/mpu/abort { key, uploadId }
mediaRouter.delete('/mpu/abort', async (c) => {
  const bucket = bucketOf(c)
  if (!bucket) return c.json({ error: 'Bucket R2 (MEDIA) não está vinculado.' }, 500)

  const { key, uploadId } = await c.req.json().catch(() => ({}))
  try {
    const mpu = bucket.resumeMultipartUpload(key, uploadId)
    await mpu.abort()
  } catch (e) {
    // abort é best-effort
  }
  return c.json({ success: true })
})

// GET /api/media/file/<key...>  — entrega o arquivo (com Range p/ vídeo)
mediaRouter.get('/file/*', async (c) => {
  const bucket = bucketOf(c)
  if (!bucket) return c.json({ error: 'Bucket R2 (MEDIA) não está vinculado.' }, 500)

  const key = decodeURIComponent(c.req.path.replace(/^\/api\/media\/file\//, ''))
  if (!key) return c.text('Missing key', 400)

  const range = c.req.header('range')
  let obj
  try {
    obj = await bucket.get(key, range ? { range: parseRange(range) } : undefined)
  } catch (e) {
    obj = await bucket.get(key) // range inválido -> devolve inteiro
  }
  if (!obj) return c.text('Not found', 404)

  const headers = new Headers()
  obj.writeHttpMetadata(headers)
  headers.set('etag', obj.httpEtag)
  headers.set('accept-ranges', 'bytes')
  headers.set('cache-control', 'public, max-age=31536000, immutable')

  if (range && obj.range) {
    const start = obj.range.offset ?? 0
    const end = obj.range.length != null ? start + obj.range.length - 1 : obj.size - 1
    headers.set('content-range', `bytes ${start}-${end}/${obj.size}`)
    headers.set('content-length', String(end - start + 1))
    return new Response(obj.body, { status: 206, headers })
  }

  headers.set('content-length', String(obj.size))
  return new Response(obj.body, { status: 200, headers })
})

// DELETE /api/media/file/<key...>
mediaRouter.delete('/file/*', async (c) => {
  const bucket = bucketOf(c)
  if (!bucket) return c.json({ error: 'Bucket R2 (MEDIA) não está vinculado.' }, 500)

  const key = decodeURIComponent(c.req.path.replace(/^\/api\/media\/file\//, ''))
  if (!key) return c.text('Missing key', 400)

  await bucket.delete(key)
  return c.json({ success: true })
})

function parseRange(header) {
  // "bytes=start-end" -> { offset, length } | { offset } | { suffix }
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim())
  if (!m) return undefined
  const [, startStr, endStr] = m
  if (startStr && endStr) {
    const offset = parseInt(startStr, 10)
    return { offset, length: parseInt(endStr, 10) - offset + 1 }
  }
  if (startStr) return { offset: parseInt(startStr, 10) }
  if (endStr) return { suffix: parseInt(endStr, 10) }
  return undefined
}
