import { Hono } from 'hono'

// Porta de server/routes/mineracao.js para Hono. Só usa fetch().
// Os geradores de XMEML/CSV são JS puro e ficaram idênticos ao original.
export const mineracaoRouter = new Hono()

const OPENAI_API = 'https://api.openai.com/v1/chat/completions'
const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages'

async function callClaude(env, messages, systemPrompt) {
  const key = (env && env.ANTHROPIC_API_KEY) || ''
  if (!key) {
    console.log('callClaude: no ANTHROPIC_API_KEY')
    return null
  }

  try {
    const res = await fetch(ANTHROPIC_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 2000,
        system: systemPrompt,
        messages: messages.map(m => ({
          role: m.role === 'system' ? 'user' : m.role,
          content: m.content,
        })),
      }),
    })

    if (!res.ok) return null

    const data = await res.json()
    return { text: data.content[0]?.text?.trim() }
  } catch (err) {
    return null
  }
}

async function callOpenAI(env, messages, systemPrompt) {
  const key = (env && env.OPENAI_API_KEY) || ''
  if (!key) return null

  try {
    const res = await fetch(OPENAI_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'system', content: systemPrompt }, ...messages],
        max_tokens: 2000,
      }),
    })

    if (!res.ok) return null
    const data = await res.json()
    return { text: data.choices[0]?.message?.content?.trim() }
  } catch (err) {
    return null
  }
}

const SYSTEM_PROMPT = `Você é um analista de conteúdo especializado em identificar cortes em transcrições de vídeo.

A transcrição contém timecodes no formato [HH:MM:SS] ou similar.

REGRAS:
- Extraia ENTRE 10 E 25 CORTES por vídeo
- Busque identificar TODOS os momentos interessantes, não seja tão criterioso
- Inclua hooks, dicas, exemplos, transições, resultados, opiniões fortes
- Cada corte deve ter entre 5 e 30 segundos de duração
- Prefira MAIS cortes a menos cortes

Retorne APENAS um array JSON válido com:
  - "inicio": timecode de início (ex: "00:01:23")
  - "fim": timecode de fim (ex: "00:01:45")
  - "titulo": título descritivo do corte (máx 60 chars)
  - "descricao": breve descrição do conteúdo (máx 120 chars)

REGRAS TÉCNICAS:
- Mínimo 10, máximo 25 cortes
- Timecodes DEVEM vir da transcrição, não invente
- Se não houver timecodes, retorne array vazio
- Retorne SOMENTE o JSON, sem markdown

Exemplo:
[{"inicio":"00:02:15","fim":"00:02:35","titulo":"Hook: O erro que todo criador comete","descricao":"Abertura forte com gatilho de curiosidade"},{"inicio":"00:05:00","fim":"00:05:20","titulo":"Dica prática de edição","descricao":"Tutorial passo a passo com exemplo real"}]`

function timecodeToSMPTE(tc) {
  if (!tc) return '00:00:00:00'
  const parts = tc.replace(/[\[\]]/g, '').split(/[:,;]/)
  const h = String(parseInt(parts[0], 10) || 0).padStart(2, '0')
  const m = String(parseInt(parts[1], 10) || 0).padStart(2, '0')
  const s = String(parseInt(parts[2], 10) || 0).padStart(2, '0')
  return `${h}:${m}:${s}:00`
}

function gerarCSV(segmentos) {
  const linhas = ['Name, In Time, Out Time, Comments']
  segmentos.forEach((seg, i) => {
    const name = `Corte ${i + 1}: ${seg.titulo}`.replace(/"/g, '""')
    const desc = (seg.descricao || '').replace(/"/g, '""')
    linhas.push(`"${name}", ${timecodeToSMPTE(seg.inicio)}, ${timecodeToSMPTE(seg.fim)}, "${desc}"`)
  })
  return linhas.join('\n')
}

function secondsToFrames(sec, fps = 30) {
  return Math.round(sec * fps)
}

function gerarXMEML(segmentos, nomeVideo = 'Transcrição') {
  if (!segmentos.length) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE xmeml>
<xmeml version="5">
  <sequence id="sequence-mineracao">
    <name>Mineração — ${escapeXml(nomeVideo)}</name>
    <duration>1</duration>
    <rate><timebase>30</timebase><ntsc>TRUE</ntsc></rate>
    <timecode>
      <rate><timebase>30</timebase><ntsc>TRUE</ntsc></rate>
      <string>00:00:00:00</string>
      <frame>0</frame>
      <displayformat>NDF</displayformat>
    </timecode>
  </sequence>
</xmeml>`
  }

  const sourceEndSec = segmentos.reduce((max, s) => Math.max(max, timecodeToSeconds(s.fim)), 0)
  const sourceDuration = secondsToFrames(sourceEndSec + 60)
  const totalDuration = segmentos.reduce((acc, seg) => {
    const d = secondsToFrames(timecodeToSeconds(seg.fim)) - secondsToFrames(timecodeToSeconds(seg.inicio))
    return acc + Math.max(d, 0)
  }, 0)

  let markerPos = 0
  const markers = []

  segmentos.forEach((seg, i) => {
    const duration = secondsToFrames(timecodeToSeconds(seg.fim)) - secondsToFrames(timecodeToSeconds(seg.inicio))
    if (duration <= 0) return

    markers.push(`    <marker>
      <name>${escapeXml(`Corte ${i + 1} — ${seg.titulo}`)}</name>
      <comment>${escapeXml(seg.descricao || '')}</comment>
      <in>${markerPos}</in>
      <out>${markerPos + duration}</out>
    </marker>`)
    markerPos += duration
  })

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE xmeml>
<xmeml version="5">
  <sequence id="sequence-mineracao">
    <name>Mineração — ${escapeXml(nomeVideo)}</name>
    <duration>${totalDuration}</duration>
    <rate>
      <timebase>30</timebase>
      <ntsc>TRUE</ntsc>
    </rate>
    <timecode>
      <rate>
        <timebase>30</timebase>
        <ntsc>TRUE</ntsc>
      </rate>
      <string>00:00:00:00</string>
      <frame>0</frame>
      <displayformat>NDF</displayformat>
    </timecode>
${markers.join('\n')}
    <media>
      <video>
        <format>
          <samplecharacteristics>
            <rate>
              <timebase>30</timebase>
              <ntsc>TRUE</ntsc>
            </rate>
            <width>1920</width>
            <height>1080</height>
            <anamorphic>FALSE</anamorphic>
            <pixelaspectratio>square</pixelaspectratio>
            <fielddominance>none</fielddominance>
          </samplecharacteristics>
        </format>
        <track>
          <clipitem id="base-clip">
            <name>Mineração</name>
            <duration>${totalDuration}</duration>
            <rate>
              <timebase>30</timebase>
              <ntsc>TRUE</ntsc>
            </rate>
            <start>0</start>
            <end>${totalDuration}</end>
            <in>0</in>
            <out>${sourceDuration}</out>
            <file id="source-file">
              <name>video.mp4</name>
              <pathurl>file://localhost/video.mp4</pathurl>
              <duration>${sourceDuration}</duration>
              <rate>
                <timebase>30</timebase>
                <ntsc>TRUE</ntsc>
              </rate>
              <media>
                <video>
                  <samplecharacteristics>
                    <rate>
                      <timebase>30</timebase>
                      <ntsc>TRUE</ntsc>
                    </rate>
                    <width>1920</width>
                    <height>1080</height>
                    <anamorphic>FALSE</anamorphic>
                    <pixelaspectratio>square</pixelaspectratio>
                    <fielddominance>none</fielddominance>
                  </samplecharacteristics>
                </video>
                <audio>
                  <samplecharacteristics>
                    <depth>16</depth>
                    <samplerate>48000</samplerate>
                  </samplecharacteristics>
                  <channelcount>2</channelcount>
                </audio>
              </media>
            </file>
          </clipitem>
        </track>
      </video>
      <audio>
        <numOutputChannels>2</numOutputChannels>
        <format>
          <samplecharacteristics>
            <depth>16</depth>
            <samplerate>48000</samplerate>
          </samplecharacteristics>
        </format>
        <track>
          <clipitem id="audio-base">
            <name>Áudio</name>
            <duration>${totalDuration}</duration>
            <rate>
              <timebase>30</timebase>
              <ntsc>TRUE</ntsc>
            </rate>
            <start>0</start>
            <end>${totalDuration}</end>
            <in>0</in>
            <out>${sourceDuration}</out>
            <file id="source-file"/>
          </clipitem>
        </track>
      </audio>
    </media>
  </sequence>
</xmeml>`
}

function timecodeToSeconds(tc) {
  if (!tc) return 0
  const parts = tc.replace(/[\[\]]/g, '').split(/[:,;]/)
  if (parts.length >= 3) {
    const h = parseInt(parts[0], 10) || 0
    const m = parseInt(parts[1], 10) || 0
    const s = parseInt(parts[2], 10) || 0
    return h * 3600 + m * 60 + s
  }
  return 0
}

function escapeXml(str) {
  if (!str) return ''
  return str.replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

mineracaoRouter.get('/debug', (c) => {
  return c.json({
    openai_key_set: !!(c.env && c.env.OPENAI_API_KEY),
    anthropic_key_set: !!(c.env && c.env.ANTHROPIC_API_KEY),
    kv_bound: !!(c.env && c.env.CONTENT_HUB_KV),
    runtime: 'cloudflare-pages',
  })
})

mineracaoRouter.post('/analisar', async (c) => {
  const { transcricao } = await c.req.json().catch(() => ({}))

  if (!transcricao || transcricao.trim().length < 20) {
    return c.json({ error: 'Transcrição muito curta. Cole pelo menos 20 caracteres.' }, 400)
  }

  const userMessage = { role: 'user', content: `Analise esta transcrição e identifique os melhores cortes:\n\n${transcricao}` }

  let result = await callClaude(c.env, [userMessage], SYSTEM_PROMPT)
  if (!result) {
    result = await callOpenAI(c.env, [userMessage], SYSTEM_PROMPT)
  }

  if (!result) {
    return c.json({
      error: 'Serviço de IA indisponível. Configure as chaves ANTHROPIC_API_KEY ou OPENAI_API_KEY no servidor.',
      simulated: gerarSimulacao(transcricao),
    }, 503)
  }

  let nomeVideo = 'Transcrição'
  for (const linha of transcricao.split('\n')) {
    const limpa = linha.replace(/^[\s\d\-:;,.\/\[\]()>]+/, '').trim()
    if (limpa.length > 5) {
      nomeVideo = limpa.substring(0, 60)
      break
    }
  }

  try {
    const jsonStr = result.text.replace(/```json\s*/gi, '').replace(/```\s*$/, '').trim()
    const segmentos = JSON.parse(jsonStr)

    if (!Array.isArray(segmentos) || segmentos.length === 0) {
      return c.json({
        segmentos: [],
        xmeml: gerarXMEML([], nomeVideo),
        csv: gerarCSV([]),
        totalCortes: 0,
        aviso: 'Nenhum corte identificado pela IA. Pode ser que a transcrição seja muito curta ou genérica. Tente com um conteúdo mais denso.',
      })
    }
    const xmeml = gerarXMEML(segmentos, nomeVideo)
    const csv = gerarCSV(segmentos)

    return c.json({
      segmentos,
      xmeml,
      csv,
      totalCortes: segmentos.length,
    })
  } catch (e) {
    console.error('Erro ao parsear resposta da IA:', e)
    console.log('Raw response:', result.text)
    const fallback = gerarSimulacao(transcricao)
    return c.json({
      segmentos: fallback,
      xmeml: gerarXMEML(fallback),
      csv: gerarCSV(fallback),
      totalCortes: fallback.length,
      aviso: 'Resposta da IA teve formato inesperado. Usei análise simulada como fallback.',
    })
  }
})

function gerarSimulacao(transcricao) {
  const linhas = transcricao.split('\n').filter(l => l.trim())
  const segmentos = []
  const timecodeRegex = /(?:\[?)(\d{1,2}:\d{2}(?::\d{2})?)(?:]?\s*-\s*(?:\[?)(\d{1,2}:\d{2}(?::\d{2})?)(?:]?)?)?/

  for (const linha of linhas) {
    const match = linha.match(timecodeRegex)
    if (match && segmentos.length < 8) {
      const inicio = match[1]
      const fim = match[2] || incrementTimecode(inicio, 20)
      const texto = linha.replace(timecodeRegex, '').trim().substring(0, 80)
      if (texto.length > 5) {
        segmentos.push({
          inicio,
          fim,
          titulo: texto.substring(0, 55) + (texto.length > 55 ? '...' : ''),
          descricao: 'Trecho identificado com potencial para corte.',
        })
      }
    }
  }

  if (segmentos.length === 0) {
    const text = transcricao.replace(/[\[\]\d:;,.-]+/g, '').trim()
    const words = text.split(/\s+/).filter(w => w.length > 2)
    for (let i = 0; i < Math.min(5, words.length); i += 3) {
      const chunk = words.slice(i, i + 8).join(' ')
      if (chunk.length > 10) {
        segmentos.push({
          inicio: `00:0${Math.floor(i / 3) + 1}:00`,
          fim: `00:0${Math.floor(i / 3) + 1}:30`,
          titulo: chunk.substring(0, 55),
          descricao: 'Potencial ponto de interesse identificado.',
        })
      }
    }
  }

  return segmentos
}

function incrementTimecode(tc, seconds) {
  const total = timecodeToSeconds(tc) + seconds
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
