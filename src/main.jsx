import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { supabase } from './supabase.js'

async function loadPosts() {
  const { data, error } = await supabase
    .from('posts')
    .select(`
      id,
      title,
      content,
      created_at,
      users (username)
    `)

  if (error) {
    console.error('Ошибка:', error)
  } else {
    console.log('Посты из базы:', data)
    renderPosts(data)
  }
}

function renderPosts(posts) {
  const container = document.querySelector('.posts-grid')
  container.innerHTML = ''

  posts.forEach(post => {
    const div = document.createElement('div')
    div.className = 'card post'
    div.innerHTML = `
      <div class="post-content">
        <h3 class="title">${post.title}</h3>
        <p class="excerpt">${post.content}</p>
        <p class="meta">Автор: ${post.users?.username || '—'}</p>
      </div>
    `
    container.appendChild(div)
  })
}

loadPosts()


createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
