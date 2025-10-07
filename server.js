import express from "express"
import cors from "cors"
import { createClient } from "@supabase/supabase-js"
import dotenv from "dotenv"
import path from "path"
import { fileURLToPath } from "url"

dotenv.config()

const app = express()

app.use(
  cors({
    origin: ["https://aba-app-gules.vercel.app"],
    methods: ["GET", "POST", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
)

app.use(express.json())

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
      users:author ( name ),
      likes ( user_id )
    `)

  if (error) return res.status(400).json({ error: error.message })
  res.json(data)
})

// 📌 Регистрация
app.post("/api/signup", async (req, res) => {
  const { email, password, name } = req.body
  if (!email || !password)
    return res.status(400).json({ error: "Email и пароль обязательны" })

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name: name || "" } },
  })

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
// 📌 Получить количество лайков для поста
app.get("/api/likes/:postId", async (req, res) => {
  const { postId } = req.params

  const { count, error } = await supabase
    .from("likes")
    .select("*", { count: "exact", head: true })
    .eq("post_id", postId)

  if (error) return res.status(400).json({ error: error.message })

  res.json({ likes: count || 0 })
})

// 📌 Поставить / убрать лайк
app.post("/api/like", async (req, res) => {
  const { user_id, post_id } = req.body

  if (!user_id || !post_id)
    return res.status(400).json({ error: "Не хватает user_id или post_id" })

  // Проверяем, есть ли уже лайк
  const { data: existing, error: selectError } = await supabase
    .from("likes")
    .select("*")
    .eq("user_id", user_id)
    .eq("post_id", post_id)
    .maybeSingle()

  if (selectError)
    return res.status(400).json({ error: selectError.message })

  // Если уже лайкнул — удаляем
  if (existing) {
    const { error: deleteError } = await supabase
      .from("likes")
      .delete()
      .eq("id", existing.id)

    if (deleteError)
      return res.status(400).json({ error: deleteError.message })

    return res.json({ message: "unliked" })
  }

  // Если нет — добавляем лайк
  const { error: insertError } = await supabase
    .from("likes")
    .insert([{ user_id, post_id }])

  if (insertError)
    return res.status(400).json({ error: insertError.message })

  res.json({ message: "liked" })
})


// 📌 Получить лайки поста
app.get("/api/likes/:postId", async (req, res) => {
  const { postId } = req.params
  const { data, error } = await supabase
    .from("likes")
    .select("user_id")
    .eq("post_id", postId)

  if (error) return res.status(400).json({ error: error.message })
  res.json({ likes: data.length })
})

// 📌 Поставить/снять лайк
app.post("/api/like", async (req, res) => {
  const { user_id, post_id } = req.body
  if (!user_id || !post_id)
    return res.status(400).json({ error: "user_id и post_id обязательны" })

  // Проверяем, есть ли уже лайк
  const { data: existingLike } = await supabase
    .from("likes")
    .select("*")
    .eq("user_id", user_id)
    .eq("post_id", post_id)
    .single()

  if (existingLike) {
    // Удаляем лайк (unlike)
    const { error } = await supabase
      .from("likes")
      .delete()
      .eq("user_id", user_id)
      .eq("post_id", post_id)
    if (error) return res.status(400).json({ error: error.message })
    return res.json({ message: "unliked" })
  } else {
    // Добавляем лайк
    const { error } = await supabase
      .from("likes")
      .insert([{ user_id, post_id }])
    if (error) return res.status(400).json({ error: error.message })
    return res.json({ message: "liked" })
  }
})

// ⚡ Раздача фронта
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
app.use(express.static(path.join(__dirname, "dist")))
app.get("*", (req, res) =>
  res.sendFile(path.join(__dirname, "dist", "index.html"))
)

const PORT = process.env.PORT || 5000
app.listen(PORT, () =>
  console.log(`✅ Server running on http://localhost:${PORT}`)
)
