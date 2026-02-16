import { AuthProvider, useAuth } from './contexts/AuthContext'
import Auth from './components/Auth'
import Dashboard from './components/Dashboard'
import { isConfigured } from './supabaseClient'

function AppContent() {
    const { user, loading } = useAuth()

    if (!isConfigured) {
        return (
            <div className="setup-container">
                <div className="setup-card">
                    <h1>Konfiguratsiya kerak</h1>
                    <p>Iltimos, <code>.env</code> fayliga Supabase URL va Anon Key ma'lumotlarini kiriting.</p>
                    <p>Keyin serverni qayta ishga tushiring.</p>
                </div>
            </div>
        )
    }

    if (loading) {
        return (
            <div className="app-loading">
                <div className="loader-spinner"></div>
                <div className="text-center loading-text">YUKLANMOQDA...</div>
            </div>
        )
    }

    return (
        <>
            {!user ? <Auth /> : <Dashboard />}
        </>
    )
}

function App() {
    return (
        <AuthProvider>
            <AppContent />
        </AuthProvider>
    )
}

export default App
