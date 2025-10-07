import React, { useEffect, useState } from "react"
import { supabase } from "../supabase"

function PostsList() {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [likes, setLikes] = useState({})
  const [userId, setUserId] = useState(null)

  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api"

  // ✅ Проверяем авторизованного пользователя
  useEffect(() => {
    const getUser = async () => {
      const { data, error } = await supabase.auth.getUser()
      if (data?.user) {
        setUserId(data.user.id)
      } else {
        console.log("Пользователь не авторизован")
      }
    }
    getUser()
  }, [])

  // ✅ Загружаем посты
  useEffect(() => {
    const fetchPosts = async () => {
      try {
        const res = await fetch(`${API_URL}/posts`)
        if (!res.ok) throw new Error("Ошибка загрузки постов")
        const data = await res.json()
        setPosts(data)
        data.forEach((post) => fetchLikes(post.id))
      } catch (err) {
        console.error("Ошибка загрузки постов:", err)
      } finally {
        setLoading(false)
      }
    }

    fetchPosts()
  }, [API_URL])

  // ✅ Получаем количество лайков
  const fetchLikes = async (postId) => {
    try {
      const res = await fetch(`${API_URL}/likes/${postId}`)
      if (!res.ok) throw new Error("Ошибка получения лайков")
      const data = await res.json()
      setLikes((prev) => ({ ...prev, [postId]: data.likes }))
    } catch (err) {
      console.error("Ошибка лайков:", err)
    }
  }

  // ✅ Лайкаем / снимаем лайк
  const handleLike = async (postId) => {
    if (!userId) {
      alert("Сначала войди в аккаунт 😅")
      return
    }

    try {
      const res = await fetch(`${API_URL}/like`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, post_id: postId }),
      })

      if (!res.ok) throw new Error("Ошибка при лайке")
      const result = await res.json()

      if (result.message === "liked") {
        setLikes((prev) => ({ ...prev, [postId]: (prev[postId] || 0) + 1 }))
      } else if (result.message === "unliked") {
        setLikes((prev) => ({
          ...prev,
          [postId]: Math.max((prev[postId] || 1) - 1, 0),
        }))
      }
    } catch (err) {
      console.error("Ошибка при клике лайка:", err)
    }
  }

  if (loading) return <p>Загрузка...</p>

  return (
    <div className="posts" style={{ display: "grid", gap: "20px" }}>
      {posts.map((post) => (
        <div
          key={post.id}
          className="post-card"
          style={{
            border: "1px solid #ccc",
            padding: "20px",
            borderRadius: "10px",
            background: "#fff",
          }}
        >
          <h2>{post.title}</h2>
          <p>{post.body}</p>
          <p>
            <b>Категория:</b> {post.category || "—"}
          </p>
          <p>
            <b>Автор:</b> {post.users?.name || "—"}
          </p>

          {post.image && (
            <img
              src={post.image}
              alt={post.title}
              style={{
                width: "100%",
                borderRadius: "8px",
                marginTop: "10px",
              }}
            />
          )}

          <div style={{ marginTop: "10px" }}>
            <button
              onClick={() => handleLike(post.id)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: "20px",
              }}
            >
              ❤️ {likes[post.id] || 0}
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

export default PostsList
