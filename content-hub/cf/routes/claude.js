import { Hono } from 'hono'

// Porta de server/routes/claude.js para Hono. Só usa fetch().
export const claudeRouter = new Hono()

const CLAUDE_API = 'https://api.anthropic.com/v1/messages'
const OPENAI_API = 'https://api.openai.com/v1/chat/completions'

async function callAI(env, systemPrompt, userMessage, maxTokens = 800) {
  // Tenta Claude primeiro
  const claudeKey = (env && env.ANTHROPIC_API_KEY) || ''
  if (claudeKey) {
    try {
      const res = await fetch(CLAUDE_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': claudeKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: maxTokens,
          system: systemPrompt,
          messages: [{ role: 'user', content: userMessage }],
        }),
      })

      if (res.ok) {
        const data = await res.json()
        return { text: data.content[0].text.trim() }
      }
    } catch (e) {
      // Cai para OpenAI
    }
  }

  // Fallback para OpenAI
  const openaiKey = (env && env.OPENAI_API_KEY) || ''
  if (openaiKey) {
    try {
      const res = await fetch(OPENAI_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage },
          ],
          max_tokens: maxTokens,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        return { text: data.choices[0].message.content.trim() }
      }
    } catch (e) {
      // Cai para erro
    }
  }

  return { error: 'Nenhuma API de IA configurada. Configure ANTHROPIC_API_KEY ou OPENAI_API_KEY no servidor.' }
}

claudeRouter.post('/chat', async (c) => {
  const { message, context } = await c.req.json().catch(() => ({}))

  const systemPrompt = `Você é um assistente especializado em criação de conteúdo digital. Você ajuda criadores a planejar e criar conteúdo para YouTube, Instagram Reels, TikTok e LinkedIn.

Você sabe criar:
- Roteiros para vídeos longos (YouTube)
- Roteiros para Shorts/Reels (30-60 segundos)
- Ideias e textos para Carrosséis do Instagram
- Legendas e hooks persuasivos
- Estratégias de conteúdo baseadas em métricas

Seja prático, direto e dê exemplos concretos. Responda em português brasileiro.

Contexto atual do criador:
${context ? JSON.stringify(context, null, 2) : 'Nenhum contexto específico'}`

  const result = await callAI(c.env, systemPrompt, message, 1200)
  return c.json(result)
})

claudeRouter.post('/ideias-carrossel', async (c) => {
  const { tema, nicho } = await c.req.json().catch(() => ({}))

  const result = await callAI(
    c.env,
    'Você é um estrategista de Instagram especializado em Carrosséis. Crie ideias completas de carrosséis com: título, texto de cada slide (5-8 slides), legenda e hashtags. Seja específico e dê exemplos prontos para usar.',
    `Crie 3 ideias de carrossel para o tema: "${tema || 'marketing digital'}"${nicho ? `. Nicho: ${nicho}` : ''}. Para cada ideia, dê: título do post, estrutura dos slides, legenda e 5 hashtags.`,
    1500,
  )

  return c.json(result)
})

claudeRouter.post('/roteiro-reels', async (c) => {
  const { tema, duracao } = await c.req.json().catch(() => ({}))

  const result = await callAI(
    c.env,
    'Você é um roteirista de Reels/Shorts. Crie roteiros prontos para vídeos curtos de 30-60 segundos com: hook (primeiros 3s), desenvolvimento, CTA. Use linguagem dinâmica e marcas de tempo.',
    `Crie um roteiro de Reels sobre: "${tema || 'dica rápida de marketing'}"${duracao ? `. Duração: ~${duracao} segundos` : ''}. Inclua: texto falado, ações em tela, e sugestão de edição.`,
    1200,
  )

  return c.json(result)
})

claudeRouter.post('/roteiro-youtube', async (c) => {
  const { tema, duracao } = await c.req.json().catch(() => ({}))

  const result = await callAI(
    c.env,
    'Você é um roteirista experiente de YouTube. Crie roteiros completos para vídeos de 8-20 minutos com: introdução que prende atenção, estrutura de tópicos com timestamps, dicas de edição e sugestão de thumbnail.',
    `Crie um roteiro de vídeo para YouTube sobre: "${tema || 'estratégia de marketing digital'}"${duracao ? `. Duração alvo: ~${duracao} minutos` : ''}. Estrutura: introdução, desenvolvimento (3-5 seções), conclusão e CTA.`,
    1500,
  )

  return c.json(result)
})
