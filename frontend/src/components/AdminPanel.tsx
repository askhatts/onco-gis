import { useEffect, useState } from 'react'
import type { ScreenType } from '../types'

interface Props {
  open: boolean
  onClose: () => void
  onRefresh: () => void
}

const SCREEN_TYPES: ScreenType[] = ['РМЖ', 'КРР', 'РШМ']

async function sha256(text: string) {
  const data = new TextEncoder().encode(text)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest))
    .map(value => value.toString(16).padStart(2, '0'))
    .join('')
}

async function parseError(response: Response) {
  const payload = await response.json().catch(() => null)
  if (payload && typeof payload.detail === 'string') {
    return payload.detail
  }
  return `Ошибка ${response.status}`
}

export function AdminPanel({ open, onClose, onRefresh }: Props) {
  const [password, setPassword] = useState('')
  const [adminHash, setAdminHash] = useState('')
  const [authenticated, setAuthenticated] = useState(false)
  const [activeTab, setActiveTab] = useState<'epi' | 'screen'>('epi')
  const [screenType, setScreenType] = useState<ScreenType>('РМЖ')
  const [epiFile, setEpiFile] = useState<File | null>(null)
  const [screenFile, setScreenFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) {
      setBusy(false)
      setStatus('')
      setError('')
      setEpiFile(null)
      setScreenFile(null)
    }
  }, [open])

  if (!open) {
    return null
  }

  async function handleAuth() {
    if (!password.trim()) {
      setError('Введите пароль администратора.')
      return
    }

    setBusy(true)
    setError('')
    setStatus('')

    try {
      const hash = await sha256(password.trim())
      const response = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hash }),
      })

      if (!response.ok) {
        throw new Error(await parseError(response))
      }

      setAdminHash(hash)
      setAuthenticated(true)
      setPassword('')
      setStatus('Доступ подтвержден. Можно загружать файлы.')
    } catch (authError) {
      setAuthenticated(false)
      setAdminHash('')
      setError(authError instanceof Error ? authError.message : 'Не удалось авторизоваться.')
    } finally {
      setBusy(false)
    }
  }

  async function handleUpload(kind: 'epi' | 'screen') {
    const file = kind === 'epi' ? epiFile : screenFile
    if (!file) {
      setError('Сначала выберите файл для загрузки.')
      return
    }

    if (!adminHash) {
      setError('Сначала подтвердите доступ администратора.')
      return
    }

    setBusy(true)
    setError('')
    setStatus('Загрузка файла и обновление данных...')

    try {
      const formData = new FormData()
      formData.append('file', file)

      const endpoint = kind === 'epi' ? '/api/upload/epidemiology' : `/api/upload/screening/${screenType}`
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'x-admin-hash': adminHash },
        body: formData,
      })

      if (!response.ok) {
        throw new Error(await parseError(response))
      }

      if (kind === 'epi') {
        setEpiFile(null)
      } else {
        setScreenFile(null)
      }

      setStatus(kind === 'epi' ? 'Эпидемиология загружена. Данные обновлены.' : `Скрининг ${screenType} загружен. Данные обновлены.`)
      onRefresh()
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Ошибка при загрузке файла.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 500,
        background: 'rgba(4,12,21,0.72)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <section
        onClick={event => event.stopPropagation()}
        style={{
          width: 'min(720px, 100%)',
          maxHeight: 'min(760px, calc(100vh - 48px))',
          overflowY: 'auto',
          background: 'rgba(8,21,37,0.98)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 14,
          boxShadow: '0 24px 60px rgba(0,0,0,0.35)',
          padding: 18,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 'var(--fs-lg)', color: 'var(--t1)', fontWeight: 600 }}>Администрирование</div>
            <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--t3)', marginTop: 4 }}>
              Авторизация и загрузка файлов обновления без ручного refresh.
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 34,
              height: 34,
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--bg3)',
              color: 'var(--t2)',
              fontSize: '18px',
              cursor: 'pointer',
            }}
          >
            ×
          </button>
        </div>

        {!authenticated ? (
          <div
            style={{
              borderRadius: 12,
              border: '1px solid var(--border)',
              background: 'rgba(255,255,255,0.02)',
              padding: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--t2)', fontFamily: 'var(--mono)' }}>Пароль администратора</span>
              <input
                type="password"
                value={password}
                onChange={event => setPassword(event.target.value)}
                onKeyDown={event => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    void handleAuth()
                  }
                }}
                style={{
                  height: 42,
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  background: 'rgba(4,14,27,0.92)',
                  color: 'var(--t1)',
                  padding: '0 12px',
                  fontSize: 'var(--fs-md)',
                  outline: 'none',
                }}
              />
            </label>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => void handleAuth()}
                disabled={busy}
                style={{
                  minWidth: 176,
                  height: 40,
                  borderRadius: 8,
                  border: '1px solid rgba(0,196,206,0.3)',
                  background: 'rgba(0,196,206,0.14)',
                  color: 'var(--cyan)',
                  fontSize: 'var(--fs-md)',
                  fontFamily: 'var(--mono)',
                  cursor: busy ? 'progress' : 'pointer',
                  opacity: busy ? 0.75 : 1,
                }}
              >
                {busy ? 'Проверка...' : 'Подтвердить доступ'}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: 8 }}>
                {[
                  { id: 'epi' as const, label: 'Эпидемиология' },
                  { id: 'screen' as const, label: 'Скрининги' },
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    style={{
                      border: '1px solid var(--border)',
                      background: activeTab === tab.id ? 'rgba(0,196,206,0.12)' : 'var(--bg3)',
                      color: activeTab === tab.id ? 'var(--cyan)' : 'var(--t2)',
                      borderRadius: 8,
                      padding: '7px 12px',
                      fontSize: 'var(--fs-sm)',
                      fontFamily: 'var(--mono)',
                      cursor: 'pointer',
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <a
                href="/api/template/epidemiology"
                target="_blank"
                rel="noreferrer"
                style={{
                  color: 'var(--cyan)',
                  fontSize: 'var(--fs-sm)',
                  textDecoration: 'none',
                  fontFamily: 'var(--mono)',
                }}
              >
                Скачать шаблон эпидемиологии
              </a>
            </div>

            {activeTab === 'epi' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--t2)' }}>
                  Загрузите новый файл эпидемиологии. После импорта дэшборд перечитает `meta.json`, `epidemiology.json` и текущие screening-срезы.
                </div>
                <input
                  key={epiFile?.name ?? 'epi-input'}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={event => setEpiFile(event.target.files?.[0] ?? null)}
                  style={{ color: 'var(--t2)', fontSize: 'var(--fs-sm)' }}
                />
                <button
                  onClick={() => void handleUpload('epi')}
                  disabled={busy || !epiFile}
                  style={{
                    alignSelf: 'flex-start',
                    minWidth: 176,
                    height: 40,
                    borderRadius: 8,
                    border: '1px solid rgba(0,196,206,0.3)',
                    background: 'rgba(0,196,206,0.14)',
                    color: 'var(--cyan)',
                    fontSize: 'var(--fs-md)',
                    fontFamily: 'var(--mono)',
                    cursor: busy ? 'progress' : 'pointer',
                    opacity: busy || !epiFile ? 0.55 : 1,
                  }}
                >
                  {busy ? 'Загрузка...' : 'Загрузить эпид'}
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--t2)', fontFamily: 'var(--mono)' }}>Тип скрининга</span>
                  <select
                    value={screenType}
                    onChange={event => setScreenType(event.target.value as ScreenType)}
                    style={{
                      width: 180,
                      height: 40,
                      borderRadius: 8,
                      border: '1px solid var(--border)',
                      background: 'rgba(4,14,27,0.92)',
                      color: 'var(--t1)',
                      padding: '0 10px',
                      fontSize: 'var(--fs-md)',
                    }}
                  >
                    {SCREEN_TYPES.map(type => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </label>
                <input
                  key={`${screenType}-${screenFile?.name ?? 'screen-input'}`}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={event => setScreenFile(event.target.files?.[0] ?? null)}
                  style={{ color: 'var(--t2)', fontSize: 'var(--fs-sm)' }}
                />
                <button
                  onClick={() => void handleUpload('screen')}
                  disabled={busy || !screenFile}
                  style={{
                    alignSelf: 'flex-start',
                    minWidth: 196,
                    height: 40,
                    borderRadius: 8,
                    border: '1px solid rgba(0,196,206,0.3)',
                    background: 'rgba(0,196,206,0.14)',
                    color: 'var(--cyan)',
                    fontSize: 'var(--fs-md)',
                    fontFamily: 'var(--mono)',
                    cursor: busy ? 'progress' : 'pointer',
                    opacity: busy || !screenFile ? 0.55 : 1,
                  }}
                >
                  {busy ? 'Загрузка...' : `Загрузить ${screenType}`}
                </button>
              </div>
            )}
          </>
        )}

        {status ? (
          <div
            style={{
              borderRadius: 10,
              border: '1px solid rgba(39,201,122,0.24)',
              background: 'rgba(39,201,122,0.1)',
              color: '#9ae4be',
              fontSize: 'var(--fs-sm)',
              padding: '10px 12px',
            }}
          >
            {status}
          </div>
        ) : null}

        {error ? (
          <div
            style={{
              borderRadius: 10,
              border: '1px solid rgba(232,80,80,0.24)',
              background: 'rgba(232,80,80,0.1)',
              color: '#ffb1b1',
              fontSize: 'var(--fs-sm)',
              padding: '10px 12px',
            }}
          >
            {error}
          </div>
        ) : null}
      </section>
    </div>
  )
}
