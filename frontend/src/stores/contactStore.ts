import { create } from 'zustand'
import { contactsApi, relationshipsApi, Contact, Relationship, GraphData } from '../services/api'

// Path node for introduction requests
interface IntroPathNode {
  contactId: string
  name: string
  company: string | null
}

interface ContactState {
  contacts: Contact[]
  selectedContact: Contact | null
  relationships: Relationship[]
  graphData: GraphData | null
  introPath: IntroPathNode[] | null  // Path from user to target for introduction
  isLoading: boolean
  error: string | null

  // Actions
  fetchContacts: (search?: string) => Promise<void>
  fetchContact: (id: string) => Promise<void>
  createContact: (data: Partial<Contact>) => Promise<Contact | null>
  updateContact: (id: string, data: Partial<Contact>) => Promise<boolean>
  deleteContact: (id: string) => Promise<boolean>
  scanCard: (imageBase64: string) => Promise<Partial<Contact> | null>
  parseText: (text: string) => Promise<Partial<Contact> | null>
  fetchGraph: () => Promise<void>
  fetchRelationships: (contactId?: string) => Promise<void>
  createRelationship: (data: {
    contactAId: string
    contactBId?: string
    isUserRelationship?: boolean
    relationshipType?: string
    strength?: number
    howMet?: string
  }) => Promise<boolean>
  clearError: () => void
  setSelectedContact: (contact: Contact | null) => void
  setIntroPath: (path: IntroPathNode[] | null) => void
}

export const useContactStore = create<ContactState>((set, get) => ({
  contacts: [],
  selectedContact: null,
  relationships: [],
  graphData: null,
  introPath: null,
  isLoading: false,
  error: null,

  fetchContacts: async (search?: string) => {
    set({ isLoading: true, error: null })
    const result = await contactsApi.list({ search })

    if (result.data) {
      set({ contacts: result.data, isLoading: false })
    } else {
      set({ error: result.error, isLoading: false })
    }
  },

  fetchContact: async (id: string) => {
    set({ isLoading: true, error: null })
    const result = await contactsApi.get(id)

    if (result.data) {
      set({ selectedContact: result.data, isLoading: false })
    } else {
      set({ error: result.error, isLoading: false })
    }
  },

  createContact: async (data: Partial<Contact>) => {
    set({ isLoading: true, error: null })
    const result = await contactsApi.create(data)

    if (result.data) {
      set((state) => ({
        contacts: [result.data!, ...state.contacts],
        isLoading: false,
      }))
      return result.data
    } else {
      set({ error: result.error, isLoading: false })
      return null
    }
  },

  updateContact: async (id: string, data: Partial<Contact>) => {
    set({ isLoading: true, error: null })
    const result = await contactsApi.update(id, data)

    if (result.data) {
      set((state) => ({
        contacts: state.contacts.map((c) => (c.id === id ? result.data! : c)),
        selectedContact: state.selectedContact?.id === id ? result.data : state.selectedContact,
        isLoading: false,
      }))
      return true
    } else {
      set({ error: result.error, isLoading: false })
      return false
    }
  },

  deleteContact: async (id: string) => {
    set({ isLoading: true, error: null })
    const result = await contactsApi.delete(id)

    if (!result.error) {
      set((state) => ({
        contacts: state.contacts.filter((c) => c.id !== id),
        selectedContact: state.selectedContact?.id === id ? null : state.selectedContact,
        isLoading: false,
      }))
      return true
    } else {
      set({ error: result.error, isLoading: false })
      return false
    }
  },

  scanCard: async (imageBase64: string) => {
    set({ isLoading: true, error: null })
    const result = await contactsApi.scan(imageBase64)

    set({ isLoading: false })
    if (result.data) {
      return result.data.contact
    } else {
      set({ error: result.error })
      return null
    }
  },

  parseText: async (text: string) => {
    set({ isLoading: true, error: null })
    const result = await contactsApi.parse(text)

    set({ isLoading: false })
    if (result.data) {
      return result.data.contact
    } else {
      set({ error: result.error })
      return null
    }
  },

  fetchGraph: async () => {
    set({ isLoading: true, error: null })
    const result = await relationshipsApi.getGraph()

    if (result.data) {
      set({ graphData: result.data, isLoading: false })
    } else {
      set({ error: result.error, isLoading: false })
    }
  },

  fetchRelationships: async (contactId?: string) => {
    set({ isLoading: true, error: null })
    const result = await relationshipsApi.list(contactId)

    if (result.data) {
      set({ relationships: result.data, isLoading: false })
    } else {
      set({ error: result.error, isLoading: false })
    }
  },

  createRelationship: async (data) => {
    set({ isLoading: true, error: null })
    const result = await relationshipsApi.create(data)

    if (result.data) {
      set((state) => ({
        relationships: [...state.relationships, result.data!],
        isLoading: false,
      }))
      return true
    } else {
      set({ error: result.error, isLoading: false })
      return false
    }
  },

  clearError: () => set({ error: null }),
  setSelectedContact: (contact) => set({ selectedContact: contact }),
  setIntroPath: (path) => set({ introPath: path }),
}))
