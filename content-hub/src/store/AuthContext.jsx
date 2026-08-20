import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import {
  getLocalSession,
  saveLocalSession,
  getLocalUsers,
  fetchUsersList,
  loginUser,
  registerUser,
  logoutUser,
  adminApproveUser,
  adminRejectUser,
  adminChangeRole,
  adminChangeName,
  adminCreateUser,
  adminDeleteUser,
} from '../lib/authStore'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  // Load session from local storage; if unauthenticated, user is null (triggers LoginPage)
  const [user, setUser] = useState(() => {
    const session = getLocalSession()
    return session && session.status === 'approved' ? session : null
  })

  const [allUsers, setAllUsers] = useState(() => getLocalUsers())
  const [pendingNoticeUser, setPendingNoticeUser] = useState(null)

  // Sync users list from server
  const refreshUsers = useCallback(async () => {
    const list = await fetchUsersList()
    setAllUsers(list)
    
    const currentSession = getLocalSession()
    if (currentSession) {
      const updatedUser = list.find(u => u.id === currentSession.id)
      if (updatedUser) {
        if (updatedUser.status !== 'approved') {
          setUser(null)
          logoutUser()
        } else {
          setUser(updatedUser)
        }
      }
    }
  }, [])

  useEffect(() => {
    refreshUsers()
  }, [refreshUsers])

  const handleLogin = async ({ email, password }) => {
    setPendingNoticeUser(null)
    const result = await loginUser({ email, password })
    if (result.isPending) {
      setPendingNoticeUser(result.user)
      return { isPending: true }
    }
    setUser(result.user)
    await refreshUsers()
    return { isPending: false, user: result.user }
  }

  const handleRegister = async ({ name, email, password }) => {
    setPendingNoticeUser(null)
    const newUser = await registerUser({ name, email, password })
    if (newUser.status === 'pending') {
      setPendingNoticeUser(newUser)
      await refreshUsers()
      return { isPending: true }
    }
    setUser(newUser)
    await refreshUsers()
    return { isPending: false, user: newUser }
  }

  const handleLogout = () => {
    logoutUser()
    setUser(null)
    setPendingNoticeUser(null)
  }

  // Admin Actions
  const handleApprove = async (userId) => {
    const updated = await adminApproveUser(userId)
    setAllUsers(updated)
    await refreshUsers()
  }

  const handleReject = async (userId) => {
    const updated = await adminRejectUser(userId)
    setAllUsers(updated)
    await refreshUsers()
  }

  const handleChangeRole = async (userId, newRole) => {
    const updated = await adminChangeRole(userId, newRole)
    setAllUsers(updated)
    await refreshUsers()
  }

  const handleChangeName = async (userId, newName) => {
    const updated = await adminChangeName(userId, newName)
    setAllUsers(updated)
    await refreshUsers()
  }

  const handleCreateUserByAdmin = async (data) => {
    const newUser = await adminCreateUser(data)
    await refreshUsers()
    return newUser
  }

  const handleDeleteUser = async (userId) => {
    const updated = await adminDeleteUser(userId)
    setAllUsers(updated)
    await refreshUsers()
  }

  const role = user?.role || 'visualizador'
  const isAdmin = role === 'admin'
  const canEdit = role === 'admin' || role === 'editor'
  const isVisualizador = role === 'visualizador'
  const isAuthenticated = !!user && user.status === 'approved'

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        pendingNoticeUser,
        setPendingNoticeUser,
        role,
        isAdmin,
        canEdit,
        isVisualizador,
        allUsers,
        login: handleLogin,
        register: handleRegister,
        logout: handleLogout,
        approveUser: handleApprove,
        rejectUser: handleReject,
        changeRole: handleChangeRole,
        changeName: handleChangeName,
        createUserByAdmin: handleCreateUserByAdmin,
        deleteUser: handleDeleteUser,
        refreshUsers,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return ctx
}
