import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { supabase, loadCollection, addItem as addToSupabase, updateItem as updateInSupabase, deleteItem as deleteFromSupabase } from '../lib/supabase'

const StoreContext = createContext(null)

const TABLE_MAP = {
  videosLongos: 'videos_longos',
  videosCurtos: 'videos_curtos',
  videosTiago: 'videos_tiago',
  cortes: 'cortes',
  frases: 'frases',
  equipe: 'equipe',
  calendario: 'calendario',
  producao: 'producao',
}

export function StoreProvider({ children }) {
  const [state, setState] = useState({
    videosLongos: [],
    videosCurtos: [],
    videosTiago: [],
    cortes: [],
    frases: [],
    equipe: [],
    calendario: [],
    producao: [],
    loaded: false,
  })

  const loadedRef = useRef(false)

  useEffect(() => {
    if (loadedRef.current) return
    loadedRef.current = true

    async function loadAll() {
      try {
        const collections = Object.keys(TABLE_MAP)
        const results = await Promise.all(collections.map(name => loadCollection(name)))

        const newState = { loaded: true }
        collections.forEach((name, i) => {
          newState[name] = results[i] || []
        })

        setState(prev => ({ ...prev, ...newState }))
      } catch (err) {
        console.error('Error in loadAll store:', err)
        setState(prev => ({ ...prev, loaded: true }))
      }
    }

    loadAll()

    // Polling for real-time synchronization across all devices
    const interval = setInterval(async () => {
      if (!supabase) return
      try {
        const collections = Object.keys(TABLE_MAP)
        const results = await Promise.all(collections.map(name => loadCollection(name)))
        setState(prev => {
          let changed = false
          const updated = { ...prev }
          collections.forEach((name, i) => {
            const cloudItems = results[i] || []
            const localJson = JSON.stringify(prev[name])
            const cloudJson = JSON.stringify(cloudItems)
            if (cloudJson !== localJson) {
              updated[name] = cloudItems
              changed = true
            }
          })
          return changed ? updated : prev
        })
      } catch (e) {}
    }, 4000)

    return () => clearInterval(interval)
  }, [])

  const updateState = useCallback((name, updater) => {
    setState(prev => {
      const newItems = updater(prev[name])
      return {
        ...prev,
        [name]: newItems,
      }
    })
  }, [])

  const addItem = useCallback(async (name, item) => {
    const result = await addToSupabase(name, item)
    if (result) {
      updateState(name, items => [result, ...items])
      return result
    }
    return null
  }, [updateState])

  const updateItem = useCallback(async (name, id, updates) => {
    const result = await updateInSupabase(name, id, updates)
    if (result) {
      updateState(name, items => items.map(i => i.id === id ? result : i))
      return result
    }
    return null
  }, [updateState])

  const deleteItem = useCallback(async (name, id) => {
    const ok = await deleteFromSupabase(name, id)
    if (ok) {
      updateState(name, items => items.filter(i => i.id !== id))
      return true
    }
    return false
  }, [updateState])

  const toggleStage = useCallback(async (name, id, stage, stages) => {
    const theItem = state[name]?.find(i => i.id === id)
    if (!theItem) return

    const currentValue = theItem[stage]
    const newValue = !currentValue
    const updates = {}

    if (newValue) {
      const idx = stages.indexOf(stage)
      for (let i = 0; i <= idx; i++) updates[stages[i]] = true
    } else {
      const idx = stages.indexOf(stage)
      for (let i = idx; i < stages.length; i++) updates[stages[i]] = false
    }

    await updateItem(name, id, updates)
  }, [state, updateItem])

  return (
    <StoreContext.Provider value={{ state, addItem, updateItem, deleteItem, toggleStage }}>
      {children}
    </StoreContext.Provider>
  )
}

export function useStore() {
  const ctx = useContext(StoreContext)
  return ctx?.state
}

export function useCollection(name) {
  const ctx = useContext(StoreContext)

  const items = ctx?.state?.[name] || []

  const add = useCallback((item) => ctx ? ctx.addItem(name, item) : Promise.resolve(null), [ctx, name])
  const update = useCallback((id, updates) => ctx ? ctx.updateItem(name, id, updates) : Promise.resolve(null), [ctx, name])
  const remove = useCallback((id) => ctx ? ctx.deleteItem(name, id) : Promise.resolve(false), [ctx, name])
  const toggle = useCallback((id, stage, stages) => ctx ? ctx.toggleStage(name, id, stage, stages) : Promise.resolve(), [ctx, name])

  return { items, addItem: add, updateItem: update, deleteItem: remove, toggleStage: toggle }
}

export function useApprovedItems() {
  const state = useStore()
  if (!state) return []
  const approved = []

  ;(state.videosLongos || []).forEach(item => {
    if (item.aprovado) approved.push({ type: 'Vídeo Longo', title: item.tema, id: item.id })
  })
  ;(state.videosCurtos || []).forEach(item => {
    if (item.aprovado) approved.push({ type: 'Vídeo Curto', title: item.titulo, id: item.id })
  })
  ;(state.videosTiago || []).forEach(item => {
    if (item.aprovado) approved.push({ type: 'Vídeo Tiago', title: item.titulo, id: item.id })
  })
  ;(state.cortes || []).forEach(item => {
    if (item.aprovado) approved.push({ type: 'Corte', title: item.titulo, id: item.id })
  })
  ;(state.frases || []).forEach(item => {
    approved.push({ type: 'Frase', title: item.frase?.slice(0, 60) + (item.frase?.length > 60 ? '…' : ''), id: item.id })
  })

  return approved
}
