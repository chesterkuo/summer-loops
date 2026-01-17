import { create } from 'zustand'
import { authApi, User, setAuthToken, getAuthToken } from '../services/api'

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null

  // Actions
  initialize: () => Promise<void>
  signup: (email: string, password: string, name: string) => Promise<boolean>
  login: (email: string, password: string) => Promise<boolean>
  demoLogin: () => Promise<boolean>
  updateUser: (data: { name?: string; avatarUrl?: string; bio?: string }) => Promise<boolean>
  logout: () => void
  deleteAccount: () => Promise<boolean>
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

  signup: async (email: string, password: string, name: string) => {
    set({ isLoading: true, error: null })
    const result = await authApi.signup({ email, password, name })

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

  login: async (email: string, password: string) => {
    set({ isLoading: true, error: null })
    const result = await authApi.login({ email, password })

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

  deleteAccount: async () => {
    set({ isLoading: true, error: null })
    const result = await authApi.deleteAccount()

    if (result.data) {
      set({
        user: null,
        isAuthenticated: false,
        isLoading: false,
      })
      return true
    } else {
      set({ error: result.error, isLoading: false })
      return false
    }
  },

  clearError: () => set({ error: null }),
}))
