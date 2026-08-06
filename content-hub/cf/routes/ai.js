import { Hono } from 'hono'

// Porta de server/routes/ai.js para Hono. Só usa fetch() — roda no Workers.
// process.env.* -> c.env.* (passado como `env`).
export const aiRouter = new Hono()

const OPENAI_API = 'https://api.openai.com/v1/chat/completions'
const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages'

async function callClaude(env, messages, systemPrompt, customApiKey = '') {
  const key = customApiKey || (env && env.ANTHROPIC_API_KEY) || ''
  if (!key) return null

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
        max_tokens: 1500,
        system: systemPrompt,
        messages: messages.map(m => ({
          role: m.role === 'system' ? 'user' : m.role,
          content: m.content,
        })),
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      console.warn('Claude API Error:', errText)
      return null
    }

    const data = await res.json()
    return { text: data.content[0]?.text?.trim() }
  } catch (err) {
    console.error('Claude API call failed:', err)
    return null
  }
}

async function callOpenAI(env, messages, systemPrompt, customApiKey = '') {
  const key = customApiKey || (env && env.OPENAI_API_KEY) || ''
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
        max_tokens: 1200,
      }),
    })

    if (!res.ok) return null
    const data = await res.json()
    return { text: data.choices[0]?.message?.content?.trim() }
  } catch (err) {
    return null
  }
}

aiRouter.post('/generate', async (c) => {
  const { type, context, userPrompt, apiKey, messages } = await c.req.json().catch(() => ({}))

  const systemPrompts = {
    carrossel: 'Você é Claude, o melhor copywriter e estrategista de conteúdo do Brasil. Crie uma estrutura completa de Carrossel para Instagram com 7 a 10 slides. Para cada slide, indique o [TÍTULO/TEXTO DO SLIDE] e o [ELEMENTO VISUAL/DESENHO]. Inclua um Hook poderoso no Slide 1 e um CTA no último slide.',
    roteiro: 'Você é Claude, roteirista sênior de vídeos no YouTube e Reels. Crie um roteiro completo de vídeo dividido em: 1. HOOK DOS PRIMEIROS 3 SEGUNDOS (para prender a atenção), 2. CORPO / DESENVOLVIMENTO (em tópicos diretos), 3. CHAMADA PARA AÇÃO (CTA). Seja direto, dinâmico e persuasivo.',
    legenda: 'Você é Claude, estrategista de Instagram Marketing. Gere legendas altamente persuasivas e autênticas em português brasileiro com emojis e 8 hashtags estratégicas no final.',
    hashtags: 'Você é um estrategista de hashtags. Sugira 15 hashtags de alta performance divididas entre nicho, gerais e engajamento.',
    'titulo-ab': 'Você é especialista em CTR do YouTube. Sugira 5 títulos chamativos para testes A/B usando gatilhos mentais.',
    'melhor-titulo': 'Você é especialista em ganchos e retenção. Sugira 3 títulos irresistíveis para um vídeo/corte.',
    chat: 'Você é Claude, o assistente IA oficial do Content Hub. Ajude o criador de conteúdo digital com ideias de vídeos, roteiros, análises de temas, copies e planejamento de postagens. Seja amigável, direto, altamente prático e em português.',
  }

  const system = systemPrompts[type] || systemPrompts.chat

  let formattedMessages = []
  if (messages && Array.isArray(messages)) {
    formattedMessages = messages
  } else {
    const inputContent = userPrompt || (context ? `Tema/Contexto: ${context.tema || context.titulo || context.frase}` : 'Dê 5 ideias rápidas de vídeos')
    formattedMessages = [{ role: 'user', content: inputContent }]
  }

  // 1. Tenta Claude (Anthropic API)
  let result = await callClaude(c.env, formattedMessages, system, apiKey)

  // 2. Fallback para OpenAI
  if (!result) {
    result = await callOpenAI(c.env, formattedMessages, system, apiKey)
  }

  // 3. Fallback simulado quando não há chaves configuradas
  if (!result) {
    result = { text: getFallbackResponse(type, formattedMessages[formattedMessages.length - 1]?.content || '') }
  }

  return c.json(result)
})

function getFallbackResponse(type, promptText) {
  if (type === 'carrossel') {
    return `📲 **Estrutura de Carrossel (IA Claude)**

**Slide 1 (Capa/Hook):**
📌 "${promptText || '5 Erros que Estão Matando Seu Conteúdo'}"
*Visual: Fundo escuro com texto em destaque verde esmeralda.*

**Slide 2 (O Problema):**
⚠️ "Você posta todo dia mas seu engajamento não sai do lugar?"

**Slide 3 (Ponto 1):**
💡 "1. Falta de Hook nos primeiros 3 segundos."

**Slide 4 (Ponto 2):**
⚙️ "2. Não colocar CTA (Chamada para ação clara)."

**Slide 5 (Ponto 3):**
📈 "3. Não analisar as métricas do perfil."

**Slide 6 (Solução):**
🚀 "Ajuste esses 3 pontos e veja seu alcance dobrar essa semana."

**Slide 7 (CTA Final):**
💬 "Curtiu? Salve este post e comente 'QUERO' para mais dicas!"`
  }

  if (type === 'roteiro') {
    return `🎬 **Roteiro de Vídeo / Reels (IA Claude)**

🎯 **HOOK (0 a 3 segundos):**
"Se você faz isso no seu conteúdo, está perdendo visualizações todo santo dia!"

📖 **CORPO (3s a 45s):**
• **Cena 1:** "A maioria dos criadores comete o erro de demorar 10 segundos para dar a mensagem."
• **Cena 2:** "Vá direto ao ponto. Mostre o resultado logo no primeiro frame."
• **Cena 3:** "Use legendas chamativas e cortes a cada 3 a 5 segundos."

🔥 **CTA (Final):**
"Siga o perfil para não perder nenhuma estratégia de conteúdo!"`
  }

  return `🤖 **Sugestão do Claude:**

Aqui estão 3 ideias rápidas para: "${promptText || 'Criadores de Conteúdo'}":

1. **"Como Organizar 1 Mês de Conteúdo em Apenas 2 Horas"** (Formato: Carrossel / Reels)
2. **"3 Ferramentas de IA que Todo Criador Precisa Conhecer"** (Formato: Shorts)
3. **"O Segredo por Trás dos Perfis que Crescem Rápido"** (Formato: Vídeo Longo)

💡 *Dica:* Para respostas da API em tempo real, insira sua chave da Anthropic ou OpenAI na aba **Configurações**.`
}
