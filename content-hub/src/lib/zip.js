// Gerador de ZIP no navegador, sem dependências.
//
// Usa o método "store" (sem compressão): os anexos são quase sempre imagens e
// vídeos, que já vêm comprimidos — deflate gastaria CPU sem reduzir tamanho.
//
// O ZIP é montado como Blob, e cada arquivo entra no Blob como o próprio Blob
// baixado (não uma cópia em ArrayBuffer), para não segurar todos os anexos na
// memória de uma vez.

const EOCD_MAX = 0xffffffff
const MAX_ENTRIES = 0xffff

let crcTable = null

function makeCrcTable() {
  const t = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[i] = c >>> 0
  }
  return t
}

export function crc32(bytes) {
  if (!crcTable) crcTable = makeCrcTable()
  let c = 0xffffffff
  for (let i = 0; i < bytes.length; i++) {
    c = crcTable[(c ^ bytes[i]) & 0xff] ^ (c >>> 8)
  }
  return (c ^ 0xffffffff) >>> 0
}

// Data/hora no formato MS-DOS usado pelo ZIP
function dosDateTime(date) {
  const year = Math.max(1980, date.getFullYear())
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1)
  const day = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()
  return { time: time & 0xffff, date: day & 0xffff }
}

function writer(size) {
  const buf = new Uint8Array(size)
  const view = new DataView(buf.buffer)
  let off = 0
  return {
    u16(v) { view.setUint16(off, v, true); off += 2 },
    u32(v) { view.setUint32(off, v >>> 0, true); off += 4 },
    bytes(b) { buf.set(b, off); off += b.length },
    done() { return buf },
  }
}

// Nomes iguais dentro do zip quebram a extração — resolve com sufixo (1), (2)...
function uniqueName(name, usados) {
  let final = name
  if (usados.has(final)) {
    const dot = name.lastIndexOf('.')
    const base = dot > 0 ? name.slice(0, dot) : name
    const ext = dot > 0 ? name.slice(dot) : ''
    let n = 1
    do { final = `${base} (${n++})${ext}` } while (usados.has(final))
  }
  usados.add(final)
  return final
}

/**
 * Monta um .zip a partir de uma lista de arquivos.
 *
 * @param entries [{ name, blob }]
 * @param onProgress (feitos, total) => void
 * @returns Blob do zip
 */
export async function createZip(entries, onProgress = () => {}) {
  if (entries.length > MAX_ENTRIES) {
    throw new Error(`O ZIP suporta até ${MAX_ENTRIES} arquivos (recebeu ${entries.length}).`)
  }

  const encoder = new TextEncoder()
  const parts = []
  const central = []
  const usados = new Set()
  const { time, date } = dosDateTime(new Date())
  let offset = 0

  for (let i = 0; i < entries.length; i++) {
    const { name, blob } = entries[i]
    const nameBytes = encoder.encode(uniqueName(name, usados))
    const size = blob.size

    if (size > EOCD_MAX) {
      throw new Error(`"${name}" passa de 4 GB e não cabe neste formato de ZIP.`)
    }

    // precisa dos bytes para o CRC; o buffer é liberado logo em seguida
    const crc = crc32(new Uint8Array(await blob.arrayBuffer()))

    const local = writer(30 + nameBytes.length)
    local.u32(0x04034b50)      // assinatura do cabeçalho local
    local.u16(20)              // versão necessária
    local.u16(0x0800)          // flag: nome em UTF-8
    local.u16(0)               // método: store
    local.u16(time)
    local.u16(date)
    local.u32(crc)
    local.u32(size)            // comprimido
    local.u32(size)            // original
    local.u16(nameBytes.length)
    local.u16(0)               // sem campo extra
    local.bytes(nameBytes)

    parts.push(local.done(), blob)

    const dir = writer(46 + nameBytes.length)
    dir.u32(0x02014b50)        // assinatura do diretório central
    dir.u16(20)                // versão de origem
    dir.u16(20)                // versão necessária
    dir.u16(0x0800)
    dir.u16(0)
    dir.u16(time)
    dir.u16(date)
    dir.u32(crc)
    dir.u32(size)
    dir.u32(size)
    dir.u16(nameBytes.length)
    dir.u16(0)                 // extra
    dir.u16(0)                 // comentário
    dir.u16(0)                 // disco
    dir.u16(0)                 // atributos internos
    dir.u32(0)                 // atributos externos
    dir.u32(offset)            // deslocamento do cabeçalho local
    dir.bytes(nameBytes)
    central.push(dir.done())

    offset += 30 + nameBytes.length + size
    if (offset > EOCD_MAX) {
      throw new Error('O total passa de 4 GB e não cabe neste formato de ZIP.')
    }

    onProgress(i + 1, entries.length)
  }

  const centralSize = central.reduce((n, b) => n + b.length, 0)
  const end = writer(22)
  end.u32(0x06054b50)          // fim do diretório central
  end.u16(0)                   // disco
  end.u16(0)                   // disco do início do diretório
  end.u16(central.length)
  end.u16(central.length)
  end.u32(centralSize)
  end.u32(offset)
  end.u16(0)                   // comentário

  return new Blob([...parts, ...central, end.done()], { type: 'application/zip' })
}
