import React, { useEffect, useState } from "react"

function PostsList() {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)

  // Берём URL из .env (VITE_API_URL)
  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api"

  useEffect(() => {
    const fetchPosts = async () => {
      try {
        const res = await fetch(`${API_URL}/posts`) // ✅ используем API_URL
        if (!res.ok) throw new Error("Ошибка загрузки постов")
        const data = await res.json()
        setPosts(data)
      } catch (err) {
        console.error("Ошибка загрузки постов:", err)
      } finally {
        setLoading(false)
      }
    }
    fetchPosts()
  }, [API_URL])

  if (loading) return <p>Загрузка...</p>

  return (
    <div className="posts">
      {posts.map((post) => (
        <div key={post.id} className="post-card">
          <h2>{post.title}</h2>
          <p>{post.body}</p>
          <p>
            <b>Категория:</b> {post.category}
          </p>
          {post.image && (
            <img
              src={post.image}
              alt={post.title}
              style={{ width: "300px", borderRadius: "8px" }}
            />
          )}
        </div>
      ))}
    </div>
  )
}

export default PostsList
