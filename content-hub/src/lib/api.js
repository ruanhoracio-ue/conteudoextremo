const API_URL = import.meta.env.VITE_API_URL || (typeof window !== 'undefined' ? '/api' : 'http://localhost:3001/api')

export const api = {
  async ai(type, context, userPrompt, messages) {
    const apiKey = localStorage.getItem('claude_api_key') || localStorage.getItem('openai_api_key') || ''
    try {
      const res = await fetch(`${API_URL}/ai/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, context, userPrompt, apiKey, messages }),
      })
      return res.json()
    } catch (e) {
      return { error: 'Não foi possível conectar ao servidor backend' }
    }
  },

  async instagramPublish(imageUrl, caption) {
    try {
      const res = await fetch(`${API_URL}/instagram/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl, caption }),
      })
      return res.json()
    } catch (e) {
      return { error: 'Servidor offline' }
    }
  },

  async instagramInsights() {
    try {
      const res = await fetch(`${API_URL}/instagram/insights`)
      return res.json()
    } catch (e) {
      return { error: 'Servidor offline' }
    }
  },

  async instagramMedia() {
    try {
      const res = await fetch(`${API_URL}/instagram/media`)
      return res.json()
    } catch (e) {
      return { error: 'Servidor offline' }
    }
  },

  async instagramAuthUrl() {
    try {
      const res = await fetch(`${API_URL}/instagram/auth-url`)
      return res.json()
    } catch (e) {
      return { error: 'Servidor offline' }
    }
  },

  async instagramUser() {
    try {
      const res = await fetch(`${API_URL}/instagram/user`)
      return res.json()
    } catch (e) {
      return { error: 'Servidor offline' }
    }
  },

  async youtubeChannelStats() {
    try {
      const res = await fetch(`${API_URL}/youtube/channel-stats`)
      return res.json()
    } catch (e) {
      return { error: 'Servidor offline' }
    }
  },

  async youtubeVideos() {
    try {
      const res = await fetch(`${API_URL}/youtube/videos`)
      return res.json()
    } catch (e) {
      return { error: 'Servidor offline' }
    }
  },

  async claudeChat(message, context) {
    try {
      const res = await fetch(`${API_URL}/claude/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, context }),
      })
      return res.json()
    } catch (e) {
      return { error: 'Servidor offline' }
    }
  },

  async claudeIdeiasCarrossel(tema, nicho) {
    try {
      const res = await fetch(`${API_URL}/claude/ideias-carrossel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tema, nicho }),
      })
      return res.json()
    } catch (e) {
      return { error: 'Servidor offline' }
    }
  },

  async claudeRoteiroReels(tema, duracao) {
    try {
      const res = await fetch(`${API_URL}/claude/roteiro-reels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tema, duracao }),
      })
      return res.json()
    } catch (e) {
      return { error: 'Servidor offline' }
    }
  },

  async claudeRoteiroYoutube(tema, duracao) {
    try {
      const res = await fetch(`${API_URL}/claude/roteiro-youtube`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tema, duracao }),
      })
      return res.json()
    } catch (e) {
      return { error: 'Servidor offline' }
    }
  },

  async post(path, body) {
    try {
      const res = await fetch(`${API_URL}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      return res.json()
    } catch (e) {
      return { error: 'Servidor offline' }
    }
  },

  async mineracaoAnalisar(transcricao) {
    try {
      const res = await fetch(`${API_URL}/mineracao/analisar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcricao }),
      })
      return res.json()
    } catch (e) {
      return { error: 'Não foi possível conectar ao servidor backend' }
    }
  },
}
