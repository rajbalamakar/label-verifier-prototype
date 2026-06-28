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

export default api
