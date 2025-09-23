import React, { useEffect, useState } from "react"

function PostsList() {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchPosts = async () => {
      try {
        const res = await fetch("http://localhost:5000/posts")
        const data = await res.json()
        setPosts(data)
      } catch (err) {
        console.error("Ошибка загрузки постов:", err)
      } finally {
        setLoading(false)
      }
    }
    fetchPosts()
  }, [])

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
          <img
            src={post.image}
            alt={post.title}
            style={{ width: "300px", borderRadius: "8px" }}
          />
        </div>
      ))}
    </div>
  )
}

export default PostsList
