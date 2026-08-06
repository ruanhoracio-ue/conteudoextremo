import { Hono } from 'hono'

// Porta de server/routes/instagram.js para Hono. Só usa fetch().
export const instagramRouter = new Hono()

const IG_GRAPH = 'https://graph.facebook.com/v21.0'

// ATENÇÃO: no Workers isto vive apenas dentro de um isolate e pode ser
// descartado entre requests. Serve como cache best-effort da sessão; a fonte
// confiável são as variáveis de ambiente INSTAGRAM_ACCESS_TOKEN / INSTAGRAM_USER_ID.
const runtimeConfig = {
  accessToken: '',
  userId: '',
}

function getToken(env) {
  return runtimeConfig.accessToken || (env && env.INSTAGRAM_ACCESS_TOKEN) || ''
}

function getIgUserId(env) {
  return runtimeConfig.userId || (env && env.INSTAGRAM_USER_ID) || ''
}

instagramRouter.post('/configure', async (c) => {
  const { accessToken, userId } = await c.req.json().catch(() => ({}))
  if (!accessToken || !userId) {
    return c.json({ error: 'accessToken e userId são obrigatórios' })
  }
  runtimeConfig.accessToken = accessToken
  runtimeConfig.userId = userId
  return c.json({ success: true, message: 'Credenciais salvas (efêmeras no Workers — para persistir, use variáveis de ambiente)' })
})

instagramRouter.get('/auth-url', (c) => {
  const clientId = (c.env && c.env.FACEBOOK_APP_ID) || ''
  const redirectUri = (c.env && c.env.REDIRECT_URI) || 'http://localhost:3001/api/instagram/callback'

  if (!clientId) {
    return c.json({ error: 'FACEBOOK_APP_ID não configurada' })
  }

  const url = `https://www.facebook.com/v21.0/dialog/oauth?client_id=${clientId}&redirect_uri=${redirectUri}&scope=pages_show_list,pages_read_engagement,instagram_basic,instagram_content_publish&response_type=code`
  return c.json({ url })
})

instagramRouter.get('/callback', async (c) => {
  const code = c.req.query('code')
  const error = c.req.query('error')

  if (error) {
    return c.html('<script>window.close()</script><p>Autenticação cancelada. Feche esta aba.</p>')
  }
  if (!code) return c.text('Missing code', 400)

  const clientId = (c.env && c.env.FACEBOOK_APP_ID) || ''
  const clientSecret = (c.env && c.env.FACEBOOK_APP_SECRET) || ''
  const redirectUri = (c.env && c.env.REDIRECT_URI) || 'http://localhost:3001/api/instagram/callback'

  try {
    const tokenRes = await fetch(`https://graph.facebook.com/v21.0/oauth/access_token?client_id=${clientId}&redirect_uri=${redirectUri}&client_secret=${clientSecret}&code=${code}`)
    const tokenData = await tokenRes.json()

    if (tokenData.error) {
      return c.html(`<p>Erro: ${tokenData.error.message}</p>`, 400)
    }

    const longTokenRes = await fetch(`https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${clientId}&client_secret=${clientSecret}&fb_exchange_token=${tokenData.access_token}`)
    const longTokenData = await longTokenRes.json()

    const accessToken = longTokenData.access_token || tokenData.access_token

    // Busca o user ID do Instagram
    const accountsRes = await fetch(`https://graph.facebook.com/v21.0/me/accounts?fields=instagram_business_account{id,username}&access_token=${accessToken}`)
    const accountsData = await accountsRes.json()
    const igAccount = accountsData?.data?.[0]?.instagram_business_account

    return c.html(`<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"><title>Instagram Conectado</title>
<style>
  body { font-family: system-ui, sans-serif; background: #0a0a0a; color: #fafafa; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
  .card { background: #171717; border: 1px solid #262626; border-radius: 16px; padding: 32px; max-width: 560px; width: 90%; }
  h2 { margin-top: 0; font-size: 20px; }
  .field { margin: 16px 0; }
  .field label { display: block; font-size: 12px; color: #a1a1a1; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.05em; }
  .field code { display: block; background: #262626; padding: 12px; border-radius: 8px; font-size: 13px; word-break: break-all; color: #34d399; }
  .btn { display: inline-block; margin-top: 8px; padding: 10px 20px; background: #10b981; color: #fff; border: none; border-radius: 8px; cursor: pointer; font-size: 14px; }
  .btn:hover { background: #059669; }
  .success { color: #34d399; font-weight: 600; margin-bottom: 16px; }
  .note { font-size: 12px; color: #737373; margin-top: 16px; }
</style></head><body>
<div class="card">
  <div class="success">✓ Autenticação realizada com sucesso!</div>
  <h2>Instagram @${igAccount?.username || 'conectado'}</h2>
  <p style="color: #a1a1a1; font-size: 14px;">Copie os valores abaixo para as variáveis de ambiente do Cloudflare Pages (Settings → Environment variables)</p>
  <div class="field">
    <label>INSTAGRAM_ACCESS_TOKEN</label>
    <code id="token">${accessToken}</code>
    <button class="btn" onclick="navigator.clipboard.writeText(document.getElementById('token').textContent).then(() => this.textContent='Copiado!')">Copiar Token</button>
  </div>
  <div class="field">
    <label>INSTAGRAM_USER_ID</label>
    <code id="userId">${igAccount?.id || ''}</code>
    <button class="btn" onclick="navigator.clipboard.writeText(document.getElementById('userId').textContent).then(() => this.textContent='Copiado!')">Copiar User ID</button>
  </div>
  <div class="note">Após configurar as variáveis, faça um novo deploy e recarregue o app.</div>
  <button class="btn" onclick="window.close()" style="background: #525252; margin-left: 8px;">Fechar</button>
</div>
</body></html>`)
  } catch (err) {
    return c.html(`<p>Erro no servidor: ${err.message}</p>`, 500)
  }
})

instagramRouter.post('/publish', async (c) => {
  const token = getToken(c.env)
  const userId = getIgUserId(c.env)

  if (!token || !userId) {
    return c.json({ error: 'Instagram não conectado. Configure INSTAGRAM_ACCESS_TOKEN e INSTAGRAM_USER_ID nas variáveis de ambiente' })
  }

  const { imageUrl, caption } = await c.req.json().catch(() => ({}))

  try {
    const mediaRes = await fetch(`${IG_GRAPH}/${userId}/media?image_url=${encodeURIComponent(imageUrl)}&caption=${encodeURIComponent(caption)}&access_token=${token}`, { method: 'POST' })
    const mediaData = await mediaRes.json()

    if (mediaData.error) {
      return c.json({ error: `Erro ao criar media: ${mediaData.error.message}` })
    }

    const publishRes = await fetch(`${IG_GRAPH}/${userId}/media_publish?creation_id=${mediaData.id}&access_token=${token}`, { method: 'POST' })
    const publishData = await publishRes.json()

    if (publishData.error) {
      return c.json({ error: `Erro ao publicar: ${publishData.error.message}` })
    }

    return c.json({ success: true, mediaId: publishData.id })
  } catch (err) {
    return c.json({ error: err.message }, 500)
  }
})

instagramRouter.get('/insights', async (c) => {
  const token = getToken(c.env)
  const userId = getIgUserId(c.env)

  if (!token || !userId) {
    return c.json({ error: 'Instagram não conectado' })
  }

  try {
    const metrics = 'impressions,reach,profile_views,follower_count,email_contacts,phone_call_clicks,text_message_clicks,get_directions_clicks,website_clicks'
    const insightsRes = await fetch(`${IG_GRAPH}/${userId}/insights?metric=${metrics}&period=day&access_token=${token}`)
    const insightsData = await insightsRes.json()

    if (insightsData.error) {
      return c.json({ error: insightsData.error.message })
    }

    return c.json({ data: insightsData.data })
  } catch (err) {
    return c.json({ error: err.message }, 500)
  }
})

instagramRouter.get('/user', async (c) => {
  const token = getToken(c.env)
  const userId = getIgUserId(c.env)

  if (!token || !userId) {
    return c.json({ error: 'Instagram não conectado' })
  }

  try {
    const userRes = await fetch(`${IG_GRAPH}/${userId}?fields=id,username,name,profile_picture_url&access_token=${token}`)
    const userData = await userRes.json()

    if (userData.error) {
      return c.json({ error: userData.error.message })
    }

    return c.json({ data: userData })
  } catch (err) {
    return c.json({ error: err.message }, 500)
  }
})

instagramRouter.get('/media', async (c) => {
  const token = getToken(c.env)
  const userId = getIgUserId(c.env)

  if (!token || !userId) {
    return c.json({ error: 'Instagram não conectado' })
  }

  try {
    const mediaRes = await fetch(`${IG_GRAPH}/${userId}/media?fields=id,caption,media_type,media_url,permalink,timestamp,like_count,comments_count,insights.metric(impressions,reach)&access_token=${token}`)
    const mediaData = await mediaRes.json()

    if (mediaData.error) {
      return c.json({ error: mediaData.error.message })
    }

    return c.json({ data: mediaData.data })
  } catch (err) {
    return c.json({ error: err.message }, 500)
  }
})
