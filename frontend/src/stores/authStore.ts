import { create } from 'zustand'
import { authApi, User, setAuthToken, getAuthToken } from '../services/api'

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null

  // Actions
  initialize: () => Promise<void>
  demoLogin: () => Promise<boolean>
  updateUser: (data: { name?: string; avatarUrl?: string; bio?: string }) => Promise<boolean>
  logout: () => void
  clearError: () => void
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,

  initialize: async () => {
    const token = getAuthToken()
    if (!token) {
      set({ isLoading: false, isAuthenticated: false })
      return
    }

    const result = await authApi.getMe()
    if (result.data) {
      set({ user: result.data, isAuthenticated: true, isLoading: false })
    } else {
      setAuthToken(null)
      set({ isLoading: false, isAuthenticated: false })
    }
  },

  demoLogin: async () => {
    set({ isLoading: true, error: null })
    const result = await authApi.demoLogin()

    if (result.data) {
      set({
        user: result.data.user,
        isAuthenticated: true,
        isLoading: false,
      })
      return true
    } else {
      set({ error: result.error, isLoading: false })
      return false
    }
  },

  updateUser: async (data: { name?: string; avatarUrl?: string; bio?: string }) => {
    set({ isLoading: true, error: null })
    const result = await authApi.updateMe(data)

    if (result.data) {
      set({
        user: result.data,
        isLoading: false,
      })
      return true
    } else {
      set({ error: result.error, isLoading: false })
      return false
    }
  },

  logout: () => {
    authApi.logout()
    set({ user: null, isAuthenticated: false })
  },

  clearError: () => set({ error: null }),
}))
