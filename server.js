import express from "express"
import cors from "cors"
import { createClient } from "@supabase/supabase-js"
import dotenv from "dotenv"
import path from "path"
import { fileURLToPath } from "url"

dotenv.config()

const app = express()

// Разрешённые origin'ы — через env, разделённые запятой.
// Пример: ALLOWED_ORIGINS="https://aba-app-gules.vercel.app,https://my-other.site"
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean)

const corsOptions = {
  origin: function(origin, callback) {
    // allow non-browser requests (curl, Postman) with no origin
    if (!origin) return callback(null, true)
    if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) return callback(null, true)
    return callback(new Error("Not allowed by CORS"))
  },
  methods: ["GET","POST","PUT","DELETE","OPTIONS"],
  allowedHeaders: ["Content-Type","Authorization"],
  optionsSuccessStatus: 200
}

app.use(cors(corsOptions))
app.options("*", cors(corsOptions)) // preflight

app.use(express.json())

// Supabase
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

// Лог helper (включи для дебага)
function logReq(req) {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} origin=${req.headers.origin || "-"}`)
}

// GET /api/posts
app.get("/api/posts", async (req, res) => {
  logReq(req)
  try {
    const { data, error } = await supabase
      .from("posts")
      .select(`
        id,
        title,
        body,
        category,
        image,
        created_at,
        users:author ( name ),
        likes ( user_id )
      `)
      .order('created_at', { ascending: false })

    if (error) {
      console.error("Supabase posts error:", error)
      return res.status(400).json({ error: error.message })
    }

    // Преобразуем likes в количество (если нужно)
    const out = (data || []).map(p => ({
      ...p,
      likesCount: Array.isArray(p.likes) ? p.likes.length : 0
    }))

    return res.json(out)
  } catch (err) {
    console.error("GET /api/posts error", err)
    return res.status(500).json({ error: "server error" })
  }
})

// GET likes count
app.get("/api/likes/:postId", async (req, res) => {
  logReq(req)
  const { postId } = req.params
  const { count, error } = await supabase
    .from("likes")
    .select("*", { head: true, count: "exact" })
    .eq("post_id", postId)

  if (error) return res.status(400).json({ error: error.message })
  return res.json({ likes: count || 0 })
})

// POST like toggle
app.post("/api/like", async (req, res) => {
  logReq(req)
  const { user_id, post_id } = req.body
  if (!user_id || !post_id) return res.status(400).json({ error: "user_id and post_id required" })

  const { data: existing, error: selErr } = await supabase
    .from("likes")
    .select("*")
    .eq("user_id", user_id)
    .eq("post_id", post_id)
    .maybeSingle()

  if (selErr) return res.status(400).json({ error: selErr.message })

  if (existing) {
    const { error } = await supabase.from("likes").delete().eq("id", existing.id)
    if (error) return res.status(400).json({ error: error.message })
    return res.json({ message: "unliked" })
  } else {
    const { error } = await supabase.from("likes").insert([{ user_id, post_id }])
    if (error) return res.status(400).json({ error: error.message })
    return res.json({ message: "liked" })
  }
})

// POST comment
app.post("/api/comments", async (req, res) => {
  logReq(req)
  const { text, post_id, author, parent_id = null } = req.body
  const { data, error } = await supabase.from("comments").insert([{ text, post_id, author, parent_id }])
  if (error) return res.status(400).json({ error: error.message })
  return res.json(data)
})

// Статика (dist) — убедись, что dist существует при деплое
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
app.use(express.static(path.join(__dirname, "dist")))
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"))
})

const PORT = process.env.PORT || 5000
app.listen(PORT, () => console.log(`✅ Server running on http://localhost:${PORT}`))
