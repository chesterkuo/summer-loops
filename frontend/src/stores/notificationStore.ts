import { create } from 'zustand'
import { notificationsApi, Notification } from '../services/api'

interface NotificationState {
  pending: Notification[]
  upcoming: Notification[]
  done: Notification[]
  activeCount: number
  isPanelOpen: boolean
  isCreateModalOpen: boolean
  preselectedContactId: string | null
  isLoading: boolean
  error: string | null

  // Actions
  fetchNotifications: () => Promise<void>
  createNotification: (data: { contactId?: string; note?: string; remindAt: string }) => Promise<boolean>
  markDone: (id: string) => Promise<boolean>
  deleteNotification: (id: string) => Promise<boolean>
  openPanel: () => void
  closePanel: () => void
  openCreateModal: (contactId?: string) => void
  closeCreateModal: () => void
  clearError: () => void
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  pending: [],
  upcoming: [],
  done: [],
  activeCount: 0,
  isPanelOpen: false,
  isCreateModalOpen: false,
  preselectedContactId: null,
  isLoading: false,
  error: null,

  fetchNotifications: async () => {
    set({ isLoading: true, error: null })
    const result = await notificationsApi.list()

    if (result.data) {
      set({
        pending: result.data.pending,
        upcoming: result.data.upcoming,
        done: result.data.done,
        activeCount: result.data.activeCount,
        isLoading: false,
      })
    } else {
      set({ error: result.error, isLoading: false })
    }
  },

  createNotification: async (data) => {
    set({ isLoading: true, error: null })
    const result = await notificationsApi.create(data)

    if (result.data) {
      // Refresh the list to get properly categorized notifications
      await get().fetchNotifications()
      set({ isCreateModalOpen: false, preselectedContactId: null })
      return true
    } else {
      set({ error: result.error, isLoading: false })
      return false
    }
  },

  markDone: async (id: string) => {
    const result = await notificationsApi.markDone(id)

    if (result.data) {
      // Move from pending/upcoming to done
      set((state) => {
        const notification = [...state.pending, ...state.upcoming].find((n) => n.id === id)
        if (!notification) return state

        return {
          pending: state.pending.filter((n) => n.id !== id),
          upcoming: state.upcoming.filter((n) => n.id !== id),
          done: [{ ...notification, status: 'done' as const, completedAt: new Date().toISOString() }, ...state.done],
          activeCount: state.pending.filter((n) => n.id !== id).length,
        }
      })
      return true
    }
    return false
  },

  deleteNotification: async (id: string) => {
    const result = await notificationsApi.delete(id)

    if (!result.error) {
      set((state) => ({
        pending: state.pending.filter((n) => n.id !== id),
        upcoming: state.upcoming.filter((n) => n.id !== id),
        done: state.done.filter((n) => n.id !== id),
        activeCount: state.pending.filter((n) => n.id !== id).length,
      }))
      return true
    }
    return false
  },

  openPanel: () => set({ isPanelOpen: true }),
  closePanel: () => set({ isPanelOpen: false }),
  openCreateModal: (contactId?: string) => set({ isCreateModalOpen: true, preselectedContactId: contactId || null }),
  closeCreateModal: () => set({ isCreateModalOpen: false, preselectedContactId: null }),
  clearError: () => set({ error: null }),
}))
