/*
  BilimShare — Supabase-powered rewrite
  -------------------------------------------------------
  Files included (single-file for easy copy/paste):
  - src/App.jsx            (this file)
  - src/styles.css        (keep your existing styles.css)
  - .env                  (create with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY)

  IMPORTANT setup steps (before running):
  1) Install SDK:
     npm install @supabase/supabase-js

  2) Create .env in the project root (Vite):
     VITE_SUPABASE_URL=https://<your-project>.supabase.co
     VITE_SUPABASE_ANON_KEY=<your-anon-key>

  3) Required tables (example SQL). Run in Supabase SQL editor if you haven't created all fields:

  -- users table (id will be the same as auth.user.id if you use Supabase Auth)
  create table if not exists users (
    id uuid primary key default gen_random_uuid(),
    name text,
    email text unique,
    role text default 'student',
    created_at timestamp with time zone default now()
  );

  -- posts table
  create table if not exists posts (
    id uuid primary key default gen_random_uuid(),
    title text not null,
    body text,
    category text,
    image text,
    author uuid references users(id) on delete cascade,
    created_at timestamp with time zone default now()
  );

  -- comments table
  create table if not exists comments (
    id uuid primary key default gen_random_uuid(),
    text text not null,
    author uuid references users(id) on delete cascade,
    post_id uuid references posts(id) on delete cascade,
    parent_id uuid references comments(id) on delete cascade,
    created_at timestamp with time zone default now()
  );

  -- likes table (one row per (post_id, user_id))
  create table if not exists likes (
    id uuid primary key default gen_random_uuid(),
    post_id uuid references posts(id) on delete cascade,
    user_id uuid references users(id) on delete cascade,
    created_at timestamp with time zone default now(),
    constraint likes_unique unique (post_id, user_id)
  );

  Note: For production use Supabase Auth instead of storing raw passwords in your users table.

  -------------------------------------------------------
  Usage notes:
  - This file exports a default React component `App`.
  - It uses Vite env vars (import.meta.env.VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).
  - Keep your styles.css in src and import it (as in your original project).
*/

import React, { useEffect, useState, useCallback, useMemo } from 'react'
import './styles.css'
import { supabase } from './supabase.js'

/* -----------------------------
   Helpers
   ----------------------------- */
const now = () => Date.now()
function timeAgo(t) {
  if (!t) return ''
  const ms = typeof t === 'number' ? t : new Date(t).getTime()
  const s = Math.floor((Date.now() - ms) / 1000)
  if (s < 60) return 'Жаңа ғана'
  if (s < 3600) return `${Math.floor(s / 60)} мин бұрын`
  if (s < 86400) return `${Math.floor(s / 3600)} сағ бұрын`
  return `${Math.floor(s / 86400)} күн бұрын`
}
function truncate(s, n = 120) { return !s ? '' : (s.length > n ? s.slice(0, n) + '...' : s) }

/* -----------------------------
   App
   ----------------------------- */
export default function App() {
  // Data caches
  const [posts, setPosts] = useState([])
  const [usersMap, setUsersMap] = useState({}) // { id: user }
  const [commentsByPost, setCommentsByPost] = useState({}) // { postId: [comments...] }
  const [likesMap, setLikesMap] = useState({}) // { postId: { count, byUser: Set } }

  // Auth + UI
  const [currentUser, setCurrentUser] = useState(null) // { id, name, role, email }
  const [view, setView] = useState('home') // home, post, auth, profile, admin
  const [selectedPostId, setSelectedPostId] = useState(null)
  const [selectedUserId, setSelectedUserId] = useState(null)
  const [filterCategory, setFilterCategory] = useState(null)
  const [loading, setLoading] = useState(false)

  /* -----------------------------
     Initial load + auth
     ----------------------------- */
  useEffect(() => {
    // Check if a session exists
    ;(async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession()
        const authUser = sessionData?.session?.user || null
        if (authUser) {
          // fetch profile from users table
          const { data: profile } = await supabase.from('users').select('*').eq('id', authUser.id).single()
          setCurrentUser(profile ? ({ id: profile.id, name: profile.name, role: profile.role, email: profile.email }) : null)
        }
      } catch (e) { console.warn('auth check failed', e) }
      // load app data
      await loadAll()
    })()

    // subscribe to auth changes to reflect login/logout
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN') {
        const user = session?.user || (await supabase.auth.getSession()).data?.session?.user
        if (user) {
          const { data: profile } = await supabase.from('users').select('*').eq('id', user.id).single()
          setCurrentUser(profile ? ({ id: profile.id, name: profile.name, role: profile.role, email: profile.email }) : null)
        }
      }
      if (event === 'SIGNED_OUT') {
        setCurrentUser(null)
      }
    })

    return () => subscription.unsubscribe()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* -----------------------------
     Data loader
     ----------------------------- */
  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      // 1) fetch posts directly from Supabase
const { data: postsDataRaw, error: postsErr } = await supabase
  .from("posts")
  .select("*")
  .order("created_at", { ascending: false })

if (postsErr) throw postsErr
const postsData = postsDataRaw || []

      // 2) fetch related users (authors)
      const authorIds = Array.from(new Set((postsData || []).map(p => p.author).filter(Boolean)))
      let usersData = []
      if (authorIds.length) {
        const { data: udata, error: uerr } = await supabase.from('users').select('*').in('id', authorIds)
        if (uerr) throw uerr
        usersData = udata || []
      }

      // 3) fetch comments for visible posts
      const postIds = (postsData || []).map(p => p.id)
      let commentsData = []
      if (postIds.length) {
        const { data: cdata, error: cerr } = await supabase.from('comments').select('*').in('post_id', postIds).order('created_at', { ascending: true })
        if (cerr) throw cerr
        commentsData = cdata || []
      }

      // 4) fetch likes
      let likesData = []
      if (postIds.length) {
        const { data: ldata, error: lerr } = await supabase.from('likes').select('*').in('post_id', postIds)
        if (lerr) throw lerr
        likesData = ldata || []
      }

      // build maps
      const uMap = {}
      usersData.forEach(u => { uMap[u.id] = u })

      const cMap = {}
      commentsData.forEach(c => {
        if (!cMap[c.post_id]) cMap[c.post_id] = []
        cMap[c.post_id].push(c)
      })

      const lMap = {}
      likesData.forEach(l => {
        if (!lMap[l.post_id]) lMap[l.post_id] = { count: 0, byUser: new Set() }
        lMap[l.post_id].count += 1
        lMap[l.post_id].byUser.add(l.user_id)
      })

      setPosts(postsData || [])
      setUsersMap(uMap)
      setCommentsByPost(cMap)
      setLikesMap(lMap)
    } catch (err) {
      console.error('loadAll error', err)
    } finally { setLoading(false) }
  }, [])

  /* -----------------------------
     Auth: register / login / logout
     ----------------------------- */
  const register = useCallback(async ({ name, email, password }) => {
    if (!email || !password || !name) return { error: 'Барлық өрістер толтырылуы керек' }
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({ email, password })
      if (signUpError) return { error: signUpError.message || signUpError }
      const user = data?.user || (await supabase.auth.getSession()).data?.session?.user
      if (!user) return { error: 'Пайдаланушыны алу мүмкін болмады' }

      const { data: profile, error: insertError } = await supabase
        .from('users')
        .insert([{ id: user.id, name, email }])
        .select()
        .single()
      if (insertError) return { error: insertError.message || insertError }

      setCurrentUser({ id: profile.id, name: profile.name, role: profile.role || 'student', email: profile.email })
      await loadAll()
      setView('home')
      return { ok: true }
    } catch (err) {
      console.error(err)
      return { error: 'Тіркелу мүмкін болмады' }
    }
  }, [loadAll])

  const login = useCallback(async ({ email, password }) => {
    if (!email || !password) return { error: 'Email және пароль қажет' }
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) return { error: error.message || error }
      const authUser = data?.user || (await supabase.auth.getSession()).data?.session?.user
      if (!authUser) return { error: 'Пайдаланушы сессиясы табылмады' }
      const { data: profile } = await supabase.from('users').select('*').eq('id', authUser.id).single()
      if (!profile) return { error: 'Профиль табылмады' }
      setCurrentUser({ id: profile.id, name: profile.name, role: profile.role, email: profile.email })
      await loadAll()
      setView('home')
      return { ok: true }
    } catch (err) {
      console.error(err)
      return { error: 'Кіру мүмкін болмады' }
    }
  }, [loadAll])

  const logout = useCallback(async () => {
    await supabase.auth.signOut()
    setCurrentUser(null)
    setView('home')
  }, [])

  /* -----------------------------
     Posts
     ----------------------------- */
  const createPost = useCallback(async ({ title, body, category }) => {
    if (!currentUser) return { error: 'Кіру қажет' }
    if (!currentUser.role || currentUser.role === 'student') return { error: 'Тек мұғалімдер мен админ жариялай алады' }
    if (!title || !body) return { error: 'Тақырып пен мәтін қажет' }
    try {
      const image = `https://picsum.photos/seed/${Math.random().toString(36).slice(2, 8)}/1200/800`
      const { data, error } = await supabase.from('posts').insert([{ title, body, category: category || 'Жалпы', image, author: currentUser.id }]).select().single()
      if (error) throw error
      await loadAll()
      return { ok: true, post: data }
    } catch (err) {
      console.error('createPost error', err)
      return { error: 'Орнату мүмкін болмады' }
    }
  }, [currentUser, loadAll])

  const deletePost = useCallback(async (postId) => {
    if (!currentUser || currentUser.role !== 'admin') { alert('Тек админ жоя алады'); return }
    if (!confirm('Постты жоюға сенімдісіз бе?')) return
    try {
      const { error } = await supabase.from('posts').delete().eq('id', postId)
      if (error) throw error
      await loadAll()
    } catch (err) { console.error('deletePost error', err) }
  }, [currentUser, loadAll])

  /* -----------------------------
     Likes (via likes table)
     ----------------------------- */
  const toggleLike = useCallback(async (postId) => {
    if (!currentUser) { alert('Лайк басу үшін кіріңіз'); return }
    try {
      const { data: existingArr, error: existErr } = await supabase.from('likes').select('*').eq('post_id', postId).eq('user_id', currentUser.id).limit(1)
      if (existErr) throw existErr
      const existing = (existingArr && existingArr[0]) || null
      if (existing) {
        const { error } = await supabase.from('likes').delete().eq('id', existing.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('likes').insert([{ post_id: postId, user_id: currentUser.id }])
        if (error) throw error
      }
      await loadAll()
    } catch (err) { console.error('toggleLike error', err); alert('Лайк өзгертілмеді') }
  }, [currentUser, loadAll])

  /* -----------------------------
     Comments
     ----------------------------- */
  const addComment = useCallback(async (postId, text, parentId = null) => {
    if (!currentUser) return { error: 'Кіру қажет' }
    if (!text || !text.trim()) return { error: 'Пікір бос' }
    try {
      const { data, error } = await supabase.from('comments').insert([{ text, post_id: postId, parent_id: parentId, author: currentUser.id }])
      if (error) {
        console.error('Insert comment error:', error, { postId, parentId, author: currentUser.id, text })
        throw error
      }
      await loadAll()
      return { ok: true }
    } catch (err) { console.error(err); return { error: 'Пікір қосылмады' } }
  }, [currentUser, loadAll])

  const deleteComment = useCallback(async (commentId) => {
    if (!currentUser) { alert('Кіру қажет'); return }
    try {
      // fetch comment to check author
      const { data: c } = await supabase.from('comments').select('*').eq('id', commentId).single()
      if (!c) return
      if (!(currentUser.role === 'admin' || currentUser.id === c.author)) { alert('Тек автор немесе админ өшіре алады'); return }
      if (!confirm('Пікірді жоюға сенімдісіз бе?')) return
      const { error } = await supabase.from('comments').delete().eq('id', commentId)
      if (error) throw error
      await loadAll()
    } catch (err) { console.error('deleteComment error', err) }
  }, [currentUser, loadAll])

  /* -----------------------------
     Admin
     ----------------------------- */
  const changeUserRole = useCallback(async (userId, role) => {
    if (!currentUser || currentUser.role !== 'admin') { alert('Тек админ өзгерте алады'); return }
    try {
      const { error } = await supabase.from('users').update({ role }).eq('id', userId)
      if (error) throw error
      await loadAll()
    } catch (err) { console.error(err) }
  }, [currentUser, loadAll])

  const deleteUser = useCallback(async (userId) => {
    if (!currentUser || currentUser.role !== 'admin') { alert('Тек админ жоя алады'); return }
    if (!confirm('Пайдаланушыны жоюға сенімдісіз бе?')) return
    try {
      // rely on DB cascade if configured — delete user row
      const { error } = await supabase.from('users').delete().eq('id', userId)
      if (error) throw error
      await loadAll()
    } catch (err) { console.error(err) }
  }, [currentUser, loadAll])

  const addAnnouncement = useCallback(async (text) => {
    if (!currentUser || currentUser.role !== 'admin') { alert('Тек админ қосады'); return }
    alert('В этой версии объявления можно хранить в posts или отдельной таблице.');
  }, [currentUser])

  /* -----------------------------
     Derived lists
     ----------------------------- */
  const categories = useMemo(() => {
    // учебные темы по умолчанию — будут показаны первыми
    const defaultTopics = [
      'Математика', 'Физика', 'Химия', 'Биология',
      'История', 'География', 'Информатика',
      'Қазақ тілі', 'Ағылшын тілі', 'Әдебиет'
    ]
    const postCats = Array.from(new Set((posts || []).map(p => p.category).filter(Boolean)))
    // объединяем, сохраняем порядок: сначала defaultTopics, затем темы из постов (без дубликатов)
    const merged = Array.from(new Set([...defaultTopics, ...postCats]))
    if (!merged.includes('Жалпы')) merged.push('Жалпы')
    return merged
  }, [posts])

  const visiblePosts = useMemo(() => (posts || []).filter(p => !filterCategory || p.category === filterCategory), [posts, filterCategory])

  const popularPosts = useMemo(() => {
    return [...(posts || [])].sort((a, b) => (likesMap[b.id]?.count || 0) - (likesMap[a.id]?.count || 0)).slice(0, 5)
  }, [posts, likesMap])

  const userStats = useMemo(() => Object.values(usersMap).map(u => {
    const userPosts = (posts || []).filter(p => p.author === u.id)
    const likes = userPosts.reduce((s, p) => s + (likesMap[p.id]?.count || 0), 0)
    return { ...u, postsCount: userPosts.length, likesReceived: likes, score: userPosts.length * 2 + likes }
  }).sort((a, b) => b.score - a.score).slice(0, 8), [usersMap, posts, likesMap])

  const selectedPost = useMemo(() => posts.find(p => p.id === selectedPostId) || null, [posts, selectedPostId])
  const selectedUser = useMemo(() => usersMap[selectedUserId] || null, [usersMap, selectedUserId])

  /* -----------------------------
     UI callbacks
     ----------------------------- */
  const openPost = useCallback((p) => { setSelectedPostId(p.id); setView('post') }, [])
  const openProfile = useCallback((u) => { setSelectedUserId(u.id); setView('profile') }, [])

  /* -----------------------------
     Render
     ----------------------------- */
  return (
    <div className="app-root">
      <header className="header" role="banner">
        <div className="brand" onClick={() => { setView('home'); setSelectedPostId(null); setSelectedUserId(null) }}>BilimShare</div>

        <nav className="nav" role="navigation" aria-label="Main">
          <button className="btn ghost small" onClick={() => { setView('home'); setSelectedPostId(null) }}>Home</button>

          {currentUser ? (
            <>
              <button className="btn ghost small" onClick={() => openProfile(currentUser)}>{currentUser.name} <span className="online-indicator" aria-hidden>●</span></button>
              <button className="btn ghost small" onClick={logout}>Шығу</button>
              {currentUser.role === 'admin' && <button className="btn ghost small" onClick={() => setView('admin')}>Admin</button>}
            </>
          ) : (
            <>
              <button className="btn ghost small" onClick={() => setView('auth')}>Кіру / Тіркелу</button>
            </>
          )}
        </nav>
      </header>

      <main className="container" role="main">
        {/* HOME */}
        {view === 'home' && (
          <>
            <section className="posts-column">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div>
                  <h2 className="title" style={{ margin: 0 }}>Жаңа жарияланымдар</h2>
                  <div className="text-muted small">Өңірдегі соңғы материалдар</div>
                </div>
                <div className="text-muted small">{visiblePosts.length} пост</div>
              </div>

              {(currentUser && currentUser.role !== 'student') && (
                <div style={{ marginBottom: 12 }}>
                  <NewPostForm categories={categories} onCreate={async (t, b, c) => {
                    const r = await createPost({ title: t, body: b, category: c })
                    if (r && r.error) alert(r.error)
                  }} />
                </div>
              )}

              <div className="posts-grid" role="list">
                {visiblePosts.length === 0 && (
                  <div className="card"><div className="title">Посттар табылмады</div><div className="text-muted">Әзірше ештеңе жоқ</div></div>
                )}
                {visiblePosts.map((post, i) => (
                  <article key={post.id} className="post card" role="listitem" style={{ animationDelay: `${i * 40}ms` }}>
                    <div className="post-cover"><img src={post.image || `https://picsum.photos/seed/${post.id}/1200/800`} alt={post.title} /></div>
                    <div className="post-content">
                      <h3 className="title">{post.title}</h3>
                      <div className="meta">{timeAgo(post.created_at)} · Автор: <button className="btn small ghost" onClick={() => openProfile(usersMap[post.author] || { id: post.author, name: 'Белгісіз' })}>{(usersMap[post.author] && usersMap[post.author].name) || 'Белгісіз'}</button> · <span className="text-muted small">{post.category}</span></div>
                      <p className="excerpt">{truncate(post.body, 200)}</p>
                      <div className="post-footer">
                        <button className="btn small ghost" onClick={() => toggleLike(post.id)} aria-pressed={Boolean(currentUser && likesMap[post.id] && likesMap[post.id].byUser && likesMap[post.id].byUser.has(currentUser.id))}>❤ {likesMap[post.id]?.count || 0}</button>
                        <button className="btn small" onClick={() => openPost(post)}>Ашып қарау →</button>
                        {currentUser && currentUser.role === 'admin' && <button className="btn small ghost danger" onClick={() => deletePost(post.id)}>Жою</button>}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <aside className="sidebar" aria-label="Sidebar">
              <div className="sidebar-section" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="small">Фильтр / Категория</div>
                <button className="btn small ghost" onClick={() => setFilterCategory(null)}>Тазалау</button>
              </div>

              <div className="sidebar-section">
                <div className="small">Категориялар</div>
                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <button className="btn small ghost" style={{ justifyContent: 'flex-start' }} onClick={() => setFilterCategory(null)}>Барлығы</button>
                  {categories.map(c => <button key={c} className="btn small ghost" style={{ justifyContent: 'flex-start' }} onClick={() => setFilterCategory(c)}>{c} <span style={{ marginLeft: 8, color: 'var(--muted)' }}>({(posts || []).filter(p => p.category === c).length})</span></button>)}
                </div>
              </div>

              <div className="sidebar-section">
                <div className="small">Топ қолданушылар</div>
                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {userStats.map(u => (
                    <div key={u.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <div className="avatar" style={{ width: 36, height: 36, fontSize: 13 }}>{u.name.split(' ').map(x => x[0]).join('').toUpperCase()}</div>
                        <div>
                          <div style={{ fontWeight: 700 }}>{u.name}</div>
                          <div className="text-muted small">{u.role} · {u.postsCount} пост</div>
                        </div>
                      </div>
                      <button className="btn small ghost" onClick={() => openProfile(u)}>Профиль</button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="sidebar-section">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div className="small">Популярные посты</div>
                </div>
                <ul style={{ marginTop: 8, listStyle: 'none', padding: 0 }}>
                  {popularPosts.map(p => (
                    <li key={p.id} style={{ marginBottom: 8 }}>
                      <button className="btn small ghost" style={{ justifyContent: 'flex-start', width: '100%' }} onClick={() => openPost(p)}>{truncate(p.title, 48)} <span className="text-muted small" style={{ marginLeft: 8 }}>❤{likesMap[p.id]?.count || 0}</span></button>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="sidebar-section">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div className="small">Хабарландырулар</div>
                  {currentUser && currentUser.role === 'admin' && <button className="btn small" onClick={() => {
                    const text = prompt('Хабарландыру мәтінін енгізіңіз:'); if (text) addAnnouncement(text)
                  }}>Жаңа</button>}
                </div>
                <div style={{ marginTop: 8 }}>
                  <div className="text-muted small">(Хабарландырулар этой демо-версии хранятся в таблице posts или можно завести свою таблицу 'announcements')</div>
                </div>
              </div>
            </aside>
          </>
        )}

        {/* POST VIEW */}
        {view === 'post' && selectedPost && (
          <PostView post={selectedPost} usersMap={usersMap} currentUser={currentUser} comments={commentsByPost[selectedPost.id] || []} likes={likesMap[selectedPost.id]} onLike={toggleLike} onBack={() => { setView('home'); setSelectedPostId(null) }} onComment={addComment} onDeleteComment={deleteComment} onDeletePost={deletePost} onOpenProfile={openProfile} />
        )}

        {/* AUTH */}
        {view === 'auth' && <AuthCard onLogin={login} onRegister={register} onBack={() => setView('home')} />}

        {/* PROFILE */}
        {view === 'profile' && selectedUser && <ProfileView user={selectedUser} posts={posts.filter(p => p.author === selectedUser.id)} currentUser={currentUser} onBack={() => { setView('home'); setSelectedUserId(null) }} onOpenPost={(p) => { setSelectedPostId(p.id); setView('post') }} />}

        {/* ADMIN */}
        {view === 'admin' && currentUser && currentUser.role === 'admin' && <AdminPanel users={Object.values(usersMap)} posts={posts} onChangeRole={changeUserRole} onDeleteUser={deleteUser} onBack={() => setView('home')} onDeletePost={deletePost} />}
      </main>

      <div className="footer-wrapper">
        <div className="footer">© 2025 BilimShare. Барлық құқықтар қорғалған.</div>
      </div>
    </div>
  )
}

/* -----------------------------
   Components (kept close to original, but they call server actions)
   ----------------------------- */

function AuthCard({ onLogin, onRegister, onBack }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState('login') // login | register

  return (
    <div className="card auth-card" role="form" aria-label={mode === 'login' ? 'Login form' : 'Register form'}>
      <h3 className="title">{mode === 'login' ? 'Кіру' : 'Тіркелу'}</h3>
      {mode === 'register' && <input className="input" placeholder="Атыңыз" value={name} onChange={(e) => setName(e.target.value)} />}
      <input className="input" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <input className="input" placeholder="Құпиясөз" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />

      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        {mode === 'login' ? (
          <>
            <button className="btn" onClick={async () => { const r = await onLogin({ email, password }); if (r && r.error) alert(r.error) }}>Кіру</button>
            <button className="btn ghost small" onClick={onBack}>Артқа</button>
            <button className="btn small ghost" onClick={() => setMode('register')}>Тіркелу</button>
          </>
        ) : (
          <>
            <button className="btn" onClick={async () => { const r = await onRegister({ name, email, password }); if (r && r.error) alert(r.error) }}>Тіркелу</button>
            <button className="btn ghost small" onClick={onBack}>Артқа</button>
            <button className="btn small ghost" onClick={() => setMode('login')}>Кіру</button>
          </>
        )}
      </div>
    </div>
  )
}

function NewPostForm({ categories = [], onCreate }) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [category, setCategory] = useState(categories[0] || 'Жалпы')
  return (
    <div className="card upload-card" aria-label="New post">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontWeight: 700 }}>Жаңа пост</div>
        <div className="text-muted small">Категория</div>
      </div>
      <input className="input" placeholder="Тақырып" value={title} onChange={(e) => setTitle(e.target.value)} />
      <textarea className="input" placeholder="Мәтін" value={body} onChange={(e) => setBody(e.target.value)} />
      <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
        {categories.map(c => <option key={c} value={c}>{c}</option>)}
      </select>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn" onClick={async () => {
          if (!title || !body) return alert('Тақырып пен мәтін қажет')
          const r = await onCreate(title, body, category)
          if (r && r.error) alert(r.error)
          setTitle(''); setBody('')
        }}>Жариялау</button>
      </div>
    </div>
  )
}

function PostView({ post, usersMap, currentUser, comments = [], likes, onLike, onBack, onComment, onDeleteComment, onDeletePost, onOpenProfile }) {
  const [text, setText] = useState('')
  if (!post) return null
  return (
    <div className="card post-view">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button className="btn ghost small" onClick={onBack}>← Артқа</button>
        {currentUser && currentUser.role === 'admin' && <button className="btn small ghost danger" onClick={() => onDeletePost(post.id)}>Постты жою</button>}
      </div>

      <h2 className="title" style={{ marginTop: 8 }}>{post.title}</h2>
      <div className="meta">{timeAgo(post.created_at)} · Автор: <button className="btn small ghost" onClick={() => onOpenProfile(usersMap[post.author] || { id: post.author, name: 'Белгісіз' })}>{(usersMap[post.author] && usersMap[post.author].name) || 'Белгісіз'}</button> · <span className="text-muted small">{post.category}</span></div>
      <div style={{ marginTop: 12 }}>
        <img style={{ width: '100%', borderRadius: 8, maxHeight: 420, objectFit: 'cover' }} src={post.image || `https://picsum.photos/seed/${post.id}/1200/800`} alt={post.title} />
      </div>
      <p style={{ marginTop: 12 }}>{post.body}</p>

      <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
        <button className="btn small ghost" onClick={() => onLike(post.id)}>❤ {likes?.count || 0}</button>
      </div>

      <section style={{ marginTop: 18 }}>
        <h4>Пікірлер ({comments.length})</h4>
        <div style={{ marginTop: 12 }}>
          {comments.length === 0 && <div className="text-muted small">Пікір жоқ</div>}
          {comments.map(c => <Comment key={c.id} comment={c} usersMap={usersMap} currentUser={currentUser} postId={post.id} onComment={onComment} onDeleteComment={onDeleteComment} onOpenProfile={onOpenProfile} />)}
        </div>

        {(currentUser && ['student', 'teacher', 'admin'].includes(currentUser.role)) && (
          <div className="comment-form" style={{ marginTop: 12 }}>
            <textarea className="input" rows={3} placeholder="Пікір жазыңыз..." value={text} onChange={(e) => setText(e.target.value)} />
            <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
              <button className="btn small" onClick={async () => {
                if (!text.trim()) return alert('Пікір жазу керек')
                const r = await onComment(post.id, text.trim())
                if (r && r.error) alert(r.error); else setText('')
              }}>Жіберу</button>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}

function Comment({ comment, usersMap, currentUser, postId, onComment, onDeleteComment, onOpenProfile, level = 0 }) {
  const [showReply, setShowReply] = useState(false)
  const [reply, setReply] = useState('')
  const author = usersMap[comment.author] || { name: 'Аноним' }
  const canDelete = currentUser && (currentUser.role === 'admin' || currentUser.id === comment.author)
  const canReply = currentUser && ['student', 'teacher', 'admin'].includes(currentUser.role)

  return (
    <div className="comment" style={{ marginLeft: level * 18 }}>
      <div className="meta">
        <button className="btn small ghost" onClick={() => onOpenProfile(author)}>{author.name}</button> · {timeAgo(comment.created_at)}
        {canDelete && <button className="btn small ghost danger" style={{ marginLeft: 8 }} onClick={() => onDeleteComment(comment.id)}>Жою</button>}
      </div>
      <p style={{ marginTop: 6 }}>{comment.text}</p>

      {canReply && <button className="btn small ghost" onClick={() => setShowReply(s => !s)}>{showReply ? 'Болдырмау' : 'Жауап беру'}</button>}

      {showReply && (
        <div className="reply-form">
          <textarea className="input" rows={3} value={reply} onChange={(e) => setReply(e.target.value)} />
          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            <button className="btn small" onClick={async () => {
              if (!reply.trim()) return alert('Пікір жазу керек')
              const r = await onComment(postId, reply.trim(), comment.id)
              if (r && r.error) alert(r.error); else { setReply(''); setShowReply(false) }
            }}>Жіберу</button>
            <button className="btn small ghost" onClick={() => { setReply(''); setShowReply(false) }}>Болдырмау</button>
          </div>
        </div>
      )}

      {/* If there are nested replies they will be shown by parent loader (comments are flat in this demo) */}
    </div>
  )
}

function ProfileView({ user, posts, currentUser, onBack, onOpenPost }) {
  if (!user) return null
  return (
    <div className="card profile-card" style={{ maxWidth: 1200, margin: '0 auto' }}>
      <button className="btn ghost small" onClick={onBack}>← Артқа</button>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 8 }}>
        <div className="avatar" style={{ width: 64, height: 64, fontSize: 18 }}>{user.name.split(' ').map(x => x[0]).join('').toUpperCase()}</div>
        <div>
          <div className="title" style={{ margin: 0 }}>{user.name}</div>
          <div className="meta">Роль: {user.role}</div>
        </div>
      </div>

      <section style={{ marginTop: 12 }}>
        <h4>Жазбалары ({posts.length})</h4>
        <div className="profile-posts">
          {posts.length === 0 && <div className="text-muted">Посттар жоқ</div>}
          {posts.map(p => (
            <article key={p.id} className="post card" style={{ padding: 0 }}>
              <div className="post-cover" style={{ height: 140 }}>
                <img src={p.image || `https://picsum.photos/seed/${p.id}/1200/800`} alt={p.title} />
              </div>
              <div className="post-content">
                <h3 className="title" style={{ fontSize: 16 }}>{p.title}</h3>
                <div className="meta">{timeAgo(p.created_at)}</div>
                <p className="excerpt">{truncate(p.body, 120)}</p>
                <div style={{ marginTop: 8 }}>
                  <button className="btn small" onClick={() => onOpenPost(p)}>Ашып қарау →</button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}

function AdminPanel({ users = [], posts = [], onChangeRole, onDeleteUser, onBack, onDeletePost }) {
  return (
    <div className="card" style={{ maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 className="title">Admin панелі</h3>
        <button className="btn small ghost" onClick={onBack}>Ортаға қайту</button>
      </div>

      <section style={{ marginTop: 12 }}>
        <h4>Қолданушылар</h4>
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {users.map(u => (
            <div key={u.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <div>
                <div style={{ fontWeight: 700 }}>{u.name}</div>
                <div className="text-muted small">role: {u.role}</div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <select value={u.role} onChange={(e) => onChangeRole(u.id, e.target.value)}>
                  <option value="student">student</option>
                  <option value="teacher">teacher</option>
                  <option value="admin">admin</option>
                </select>
                <button className="btn small ghost" onClick={() => onDeleteUser(u.id)}>Жою</button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ marginTop: 16 }}>
        <h4>Барлық жарияланымдар</h4>
        <div style={{ marginTop: 8 }}>
          {posts.map(p => (
            <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 8, borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
              <div>
                <div style={{ fontWeight: 700 }}>{p.title}</div>
                <div className="text-muted small">Автор: {p.author} · {timeAgo(p.created_at)}</div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn small" onClick={() => onDeletePost(p.id)}>Жою</button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
