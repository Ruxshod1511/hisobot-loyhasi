import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { Mail, Lock, User as UserIcon, Loader2, ArrowRight, Eye, EyeOff, CheckCircle2, LayoutDashboard } from 'lucide-react'

const Auth = () => {
    const [isLogin, setIsLogin] = useState(true)
    const [loading, setLoading] = useState(false)
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [fullName, setFullName] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [message, setMessage] = useState<{ type: 'error' | 'success', text: string } | null>(null)
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

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
                setMessage({ type: 'success', text: 'Muvaffaqiyatli! Tizimga kirishingiz mumkin.' })
                setTimeout(() => setIsLogin(true), 1500)
            }
        } catch (error: any) {
            setMessage({ type: 'error', text: error.message === 'Invalid login credentials' ? 'Email yoki parol noto\'g\'ri' : error.message })
        } finally {
            setLoading(false)
        }
    }

    if (!mounted) return null

    return (
        <div className="compact-auth-container">
            <div className="compact-auth-card">
                <div className="compact-header">
                    <div className="compact-logo">
                        <LayoutDashboard size={24} />
                    </div>
                    <div>
                        <h2>{isLogin ? 'Xush Kelibsiz' : 'Yangi Hisob'}</h2>
                        <p>{isLogin ? 'Achot CRM tizimiga kirish' : 'Hoziroq ro\'yxatdan o\'ting'}</p>
                    </div>
                </div>

                <form onSubmit={handleAuth} className="compact-form">
                    {!isLogin && (
                        <div className="compact-input-group">
                            <UserIcon size={16} className="input-icon" />
                            <input
                                type="text"
                                placeholder="Ism Familiya"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                required
                                autoComplete="name"
                                className="compact-input"
                            />
                        </div>
                    )}

                    <div className="compact-input-group">
                        <Mail size={16} className="input-icon" />
                        <input
                            type="email"
                            placeholder="Email manzil"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            autoComplete="username"
                            className="compact-input"
                        />
                    </div>

                    <div className="compact-input-group">
                        <Lock size={16} className="input-icon" />
                        <input
                            type={showPassword ? "text" : "password"}
                            placeholder="Parol"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            autoComplete={isLogin ? "current-password" : "new-password"}
                            minLength={6}
                            className="compact-input"
                        />
                        <button
                            type="button"
                            className="compact-password-toggle"
                            onClick={() => setShowPassword(!showPassword)}
                            tabIndex={-1}
                        >
                            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                    </div>

                    {message && (
                        <div className={`compact-message ${message.type}`}>
                            {message.type === 'success' ? <CheckCircle2 size={14} /> : null}
                            <span>{message.text}</span>
                        </div>
                    )}

                    <button type="submit" disabled={loading} className="compact-submit-btn">
                        {loading ? <Loader2 className="animate-spin" size={18} /> : (
                            <>
                                {isLogin ? 'Kirish' : 'Ro\'yxatdan O\'tish'}
                                <ArrowRight size={18} />
                            </>
                        )}
                    </button>
                </form>

                <div className="compact-footer">
                    <button onClick={() => { setIsLogin(!isLogin); setMessage(null); }} className="compact-switch-btn">
                        {isLogin ? 'Ro\'yxatdan o\'tish' : 'Kirish'}
                    </button>
                </div>
            </div>

            <a href="https://t.me/MrRuxshod" target="_blank" rel="noopener noreferrer" className="compact-dev-link">
                Dasturchi yordami
            </a>
        </div>
    )
}

export default Auth
