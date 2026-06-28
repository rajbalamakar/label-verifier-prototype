import axios from 'axios'

const api = axios.create({ baseURL: '/api', withCredentials: true })

export const verifyLabel = (pdfFile, imageFile) => {
  const fd = new FormData()
  fd.append('pdf_file', pdfFile)
  fd.append('image_file', imageFile)
  return api.post('/verifications/', fd)
}

export const listVerifications = (limit = 5) => api.get(`/verifications/?limit=${limit}`)

export const deleteVerification = (id) => api.delete(`/verifications/${id}`)

export const submitDecision = (verificationId, decision, notes = '') =>
  api.post(`/decisions/${verificationId}`, { decision, notes })

export const getMe = () => api.get('/auth/me')

export const parsePdfIds = (pdfFiles) => {
  const fd = new FormData()
  pdfFiles.forEach(f => fd.append('pdf_files', f))
  return api.post('/verifications/parse-ids', fd)
}

export const verifyBulk = async (pairs, onEvent) => {
  const fd = new FormData()
  pairs.forEach(p => {
    fd.append('pdf_files', p.pdf)
    fd.append('image_files', p.image)
  })

  const response = await fetch('/api/verifications/bulk', {
    method: 'POST',
    body: fd,
    credentials: 'include',
  })

  if (!response.ok) throw new Error(`Bulk upload failed: ${response.status}`)

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop()
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try { onEvent(JSON.parse(line.slice(6))) } catch {}
      }
    }
  }
}

export default api
