// App Hono que roda no runtime Cloudflare Workers (Pages Functions).
// Porta do Express (server/ + api/index.js) para o Cloudflare.
//
// Diferenças em relação ao Express:
//   - Roteador Hono no lugar do express.Router
//   - Variáveis de ambiente vêm de `c.env` (não `process.env`)
//   - auth/data persistem em Cloudflare KV (`c.env.CONTENT_HUB_KV`), não em /tmp
import { Hono } from 'hono'
import { cors } from 'hono/cors'

import { authRouter } from './routes/auth.js'
import { dataRouter } from './routes/data.js'
import { aiRouter } from './routes/ai.js'
import { claudeRouter } from './routes/claude.js'
import { instagramRouter } from './routes/instagram.js'
import { youtubeRouter } from './routes/youtube.js'
import { mineracaoRouter } from './routes/mineracao.js'

const app = new Hono().basePath('/api')

app.use('*', cors())

app.route('/auth', authRouter)
app.route('/data', dataRouter)
app.route('/ai', aiRouter)
app.route('/claude', claudeRouter)
app.route('/instagram', instagramRouter)
app.route('/youtube', youtubeRouter)
app.route('/mineracao', mineracaoRouter)

app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }))

export default app
