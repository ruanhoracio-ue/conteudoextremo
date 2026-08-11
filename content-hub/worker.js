// Entrada do Cloudflare Worker (modelo Workers + Static Assets).
// Substitui a Function do Pages (functions/api/[[path]].js).
//
//   - Requests /api/*  -> app Hono (cf/app.js), mesma lógica de antes
//   - Todo o resto     -> assets estáticos (env.ASSETS), com fallback SPA
//     configurado em wrangler.jsonc (not_found_handling: single-page-application)
import app from './cf/app.js'

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)

    if (url.pathname.startsWith('/api/')) {
      return app.fetch(request, env, ctx)
    }

    return env.ASSETS.fetch(request)
  },
}
