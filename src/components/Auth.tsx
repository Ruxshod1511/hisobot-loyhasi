import { useState } from 'react'
import { supabase } from '../supabaseClient'
import { Mail, Lock, User as UserIcon, Loader2, ArrowRight, Eye, EyeOff } from 'lucide-react'

const Auth = () => {
    const [isLogin, setIsLogin] = useState(true)
    const [loading, setLoading] = useState(false)
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [fullName, setFullName] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [message, setMessage] = useState<{ type: 'error' | 'success', text: string } | null>(null)

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setMessage(null)

        try {
            if (isLogin) {
                const { error } = await supabase.auth.signInWithPassword({ email, password })
                if (error) throw error
            } else {
                const { error } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        data: { full_name: fullName }
                    }
                })
                if (error) throw error
                setMessage({ type: 'success', text: 'Muvaffaqiyatli ro\'yxatdan o\'tdingiz! Endi tizimga kirishingiz mumkin.' })
            }
        } catch (error: any) {
            setMessage({ type: 'error', text: error.message })
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="auth-container">
            <div className="auth-card">
                <div className="auth-header">
                    <h1>{isLogin ? 'Xush Kelibsiz' : 'Ro\'yxatdan O\'tish'}</h1>
                    <p>{isLogin ? 'Tizimga kirish' : 'Yangi hisob yaratish'}</p>
                </div>

                <form onSubmit={handleAuth} className="auth-form">
                    {!isLogin && (
                        <div className="input-group">
                            <UserIcon />
                            <input
                                type="text"
                                placeholder="To'liq Ismingiz"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                required
                            />
                        </div>
                    )}

                    <div className="input-group">
                        <Mail />
                        <input
                            type="email"
                            placeholder="Email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>

                    <div className="input-group">
                        <Lock />
                        <input
                            type={showPassword ? "text" : "password"}
                            placeholder="Parol"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                        <button
                            type="button"
                            className="password-toggle"
                            onClick={() => setShowPassword(!showPassword)}
                            aria-label={showPassword ? "Parolni yashirish" : "Parolni ko'rsatish"}
                        >
                            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                    </div>

                    {message && (
                        <div className={`message ${message.type}`}>
                            {message.text}
                        </div>
                    )}

                    <button type="submit" disabled={loading} className="auth-button">
                        {loading ? <Loader2 className="animate-spin" size={18} /> : (
                            <>
                                {isLogin ? 'Kirish' : 'Ro\'yxatdan o\'tish'}
                                <ArrowRight size={18} />
                            </>
                        )}
                    </button>
                </form>

                <div className="auth-footer">
                    <button onClick={() => setIsLogin(!isLogin)} className="toggle-auth">
                        {isLogin ? (
                            <>Hisobingiz yo'qmi? <span>Ro'yxatdan o'ting</span></>
                        ) : (
                            <>Hisobingiz bormi? <span>Tizimga kiring</span></>
                        )}
                    </button>
                </div>
            </div>

            <a href="https://t.me/admin_achot" target="_blank" rel="noopener noreferrer" className="contact-dev-card">
                <div className="contact-info">
                    <span className="contact-title">Dasturchiga murojaat qilish</span>
                    <span className="contact-subtitle">Texnik yordam va savollar uchun</span>
                </div>
                <div className="contact-icon">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z" />
                    </svg>
                </div>
            </a>
        </div>
    )
}

export default Auth
