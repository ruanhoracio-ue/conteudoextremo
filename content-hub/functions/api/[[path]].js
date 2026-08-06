// Cloudflare Pages Function — catch-all para /api/*
//
// Todo request para /api/... é resolvido aqui e delegado ao app Hono
// (equivalente ao antigo api/index.js do Express no Vercel).
import { handle } from 'hono/cloudflare-pages'
import app from '../../cf/app.js'

export const onRequest = handle(app)
