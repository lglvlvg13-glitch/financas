import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'

interface Undo { message: string; undo: () => Promise<void> }
const UndoCtx = createContext<(u: Undo) => void>(() => {})

/** Mostra "Excluído. Desfazer" por 5 segundos. */
export function useUndo() { return useContext(UndoCtx) }

export function UndoProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<Undo>()
  const show = useCallback((u: Undo) => setCurrent(u), [])
  useEffect(() => {
    if (!current) return
    const t = setTimeout(() => setCurrent(undefined), 5000)
    return () => clearTimeout(t)
  }, [current])
  return (
    <UndoCtx.Provider value={show}>
      {children}
      {current && (
        <div className="toast" role="status">
          <span>{current.message}</span>
          <button onClick={async () => { const u = current; setCurrent(undefined); await u.undo() }}>Desfazer</button>
        </div>
      )}
    </UndoCtx.Provider>
  )
}
