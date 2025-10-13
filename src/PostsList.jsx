import React, { useEffect, useState } from "react"
import { supabase } from "../supabase"

export default function PostsList() {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [likes, setLikes] = useState({})
  const [userId, setUserId] = useState(null)

  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api"

  // 🔐 Получаем текущего пользователя
  useEffect(() => {
    const getUser = async () => {
      const { data } = await supabase.auth.getUser()
      if (data?.user) setUserId(data.user.id)
    }
    getUser()
  }, [])

  // 📦 Загружаем посты
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
  }, [])

  // ❤️ Загружаем количество лайков
  const fetchLikes = async (postId) => {
    try {
      const res = await fetch(`${API_URL}/likes/${postId}`)
      if (!res.ok) throw new Error("Ошибка лайков")
      const data = await res.json()
      setLikes((prev) => ({ ...prev, [postId]: data.likes }))
    } catch (err) {
      console.error(err)
    }
  }

  // 👍 Лайк / анлайк
  const handleLike = async (postId) => {
    if (!userId) return alert("Сначала войдите в аккаунт 😅")
    try {
      const res = await fetch(`${API_URL}/like`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, post_id: postId }),
      })
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
      console.error("Ошибка при лайке:", err)
    }
  }

  if (loading) return <p className="loading">Жүктелуде...</p>

  return (
    <div className="posts-grid">
      {posts.map((post) => (
        <article key={post.id} className="post-card">
          <div className="post-image-wrapper">
            <img
              src={
                post.image ||
                `https://picsum.photos/seed/${post.id.slice(0, 6)}/800/500`
              }
              alt={post.title}
              className="post-image"
            />
          </div>

          <div className="post-content">
            <div className="post-meta">
              <span className="category">{post.category || "Жалпы"}</span>
              <span className="dot">•</span>
              <span className="author">
                {post.users?.name || "Белгісіз автор"}
              </span>
            </div>

            <h2 className="post-title">{post.title}</h2>
            <p className="post-body">
              {post.body?.length > 140
                ? post.body.slice(0, 140) + "..."
                : post.body}
            </p>

            <div className="post-actions">
              <button
                className="like-btn"
                onClick={() => handleLike(post.id)}
                aria-label="лайк"
              >
                ❤️ {likes[post.id] || 0}
              </button>
              <button className="read-btn" onClick={() => alert("Пост ашылады 😉")}>
                Толығырақ →
              </button>
            </div>
          </div>
        </article>
      ))}
    </div>
  )
}
