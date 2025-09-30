import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "./index.css"
import App from "./App.jsx"
import { supabase } from "./supabase.js"

// 📌 Загружаем посты из Supabase
async function loadPosts() {
  const { data, error } = await supabase
    .from("posts")
    .select(`
      id,
      title,
      body,
      created_at,
      users ( name )
    `)

  if (error) {
    console.error("Ошибка:", error)
  } else {
    console.log("Посты из базы:", data)
    renderPosts(data)
  }
}

// 📌 Рендер постов на страницу
function renderPosts(posts) {
  const container = document.querySelector(".posts-grid")
  if (!container) return // если контейнера нет, выходим

  container.innerHTML = ""

  posts.forEach((post) => {
    const div = document.createElement("div")
    div.className = "card post"
    div.innerHTML = `
      <div class="post-content">
        <h3 class="title">${post.title}</h3>
        <p class="excerpt">${post.body}</p>
        <p class="meta">Автор: ${post.users?.name || "—"}</p>
      </div>
    `
    container.appendChild(div)
  })
}

// Загружаем посты при старте
loadPosts()

// Рендерим React-приложение
createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
)
