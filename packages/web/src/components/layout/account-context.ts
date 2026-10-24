import { createContext, useContext } from 'react'

/** Oturum açmış diyetisyen (yalnızca API modunda); demo modunda `null`. */
export type Account = { name: string; email: string; signOut: () => Promise<void> }

export const AccountContext = createContext<Account | null>(null)

export const useAccount = () => useContext(AccountContext)
