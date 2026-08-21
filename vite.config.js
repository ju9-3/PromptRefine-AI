import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import https from 'node:https'

// 自定义 plugin：在 dev server 中拦截 /api/llm，由服务端用 .env.local 中的 Key
// 转发到 DashScope OpenAI 兼容模式 API，避免 Key 进入前端 bundle
function dashscopeProxyPlugin({ apiKey, defaultModel }) {
  return {
    name: 'dashscope-proxy',
    configureServer(server) {
      server.middlewares.use('/api/llm', async (req, res) => {
        // 仅处理 POST
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end(JSON.stringify({ error: 'Method Not Allowed' }))
          return
        }
        // 收集 body
        const chunks = []
        for await (const c of req) chunks.push(c)
        const raw = Buffer.concat(chunks).toString('utf-8')
        let payload
        try {
          payload = JSON.parse(raw)
        } catch {
          res.statusCode = 400
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'Invalid JSON' }))
          return
        }
        // 注入默认 model 与 Key
        const upstreamBody = JSON.stringify({
          ...payload,
          model: payload.model || defaultModel
        })
        // 调用 DashScope
        const upstream = await callDashscope(upstreamBody, apiKey)
        res.statusCode = upstream.status
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.end(upstream.body)
      })
    }
  }
}

// 用 node:https 直接调用，不依赖 fetch（兼容更低版本 Node）
function callDashscope(body, apiKey) {
  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'dashscope.aliyuncs.com',
      port: 443,
      path: '/compatible-mode/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'Authorization': `Bearer ${apiKey}`
      }
    }, (r) => {
      const cs = []
      r.on('data', c => cs.push(c))
      r.on('end', () => resolve({
        status: r.statusCode,
        body: Buffer.concat(cs).toString('utf-8')
      }))
    })
    req.on('error', (e) => resolve({
      status: 500,
      body: JSON.stringify({ error: e.message })
    }))
    req.write(body)
    req.end()
  })
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiKey = env.DASHSCOPE_API_KEY
  const defaultModel = env.DASHSCOPE_MODEL || 'qwen-plus'

  if (!apiKey) {
    console.warn('[ContentFlow] 警告：未在 .env.local 中找到 DASHSCOPE_API_KEY，/api/llm 将返回 401')
  }

  return {
    plugins: [
      react(),
      dashscopeProxyPlugin({ apiKey, defaultModel })
    ],
    server: {
      port: 5173,
      open: true
    }
  }
})
