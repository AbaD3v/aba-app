import express from "express"
import cors from "cors"
import { createClient } from "@supabase/supabase-js"
import dotenv from "dotenv"
import path from "path"
import { fileURLToPath } from "url"

dotenv.config()

const app = express()

// ✅ Настраиваем CORS (разрешаем Vercel фронту ходить в Render API)
app.use(
  cors({
    origin: ["https://aba-app-gules.vercel.app"], // твой фронт на Vercel
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
)

app.use(express.json())

// Подключение к Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// 📌 Получить посты + имя автора
app.get("/api/posts", async (req, res) => {
  const { data, error } = await supabase
    .from("posts")
    .select(`
      id,
      title,
      body,
      category,
      image,
      created_at,
      users:author ( name )
    `)

  if (error) return res.status(400).json({ error: error.message })
  res.json(data)
})

// 📌 Добавить комментарий
app.post("/api/comments", async (req, res) => {
  const { text, post_id, author } = req.body
  const { data, error } = await supabase
    .from("comments")
    .insert([{ text, post_id, author }])
  if (error) return res.status(400).json({ error: error.message })
  res.json(data)
})

// ==============================
// ⚡ Раздача фронта из dist
// ==============================
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

app.use(express.static(path.join(__dirname, "dist")))

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"))
})

// ==============================
const PORT = process.env.PORT || 5000
app.listen(PORT, () =>
  console.log(`✅ Server running on http://localhost:${PORT}`)
)
