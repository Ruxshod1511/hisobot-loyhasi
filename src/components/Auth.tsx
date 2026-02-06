import { useState } from 'react'
import { supabase } from '../supabaseClient'
import { Mail, Lock, User as UserIcon, Loader2, ArrowRight } from 'lucide-react'

const Auth = () => {
    const [isLogin, setIsLogin] = useState(true)
    const [loading, setLoading] = useState(false)
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [fullName, setFullName] = useState('')
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
                setMessage({ type: 'success', text: 'Emailingizni tasdiqlash uchun xat yuborildi!' })
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
                    <div className="auth-logo">
                        <div className="logo-box">
                            <Lock size={32} />
                        </div>
                    </div>
                    <h1>{isLogin ? 'Xush Kelibsiz' : 'Hisob Yaratish'}</h1>
                    <p>{isLogin ? 'Platformaga kirish uchun ma\'lumotlaringizni kiriting' : 'Achot tizimida yangi hisob yaratish'}</p>
                </div>

                <form onSubmit={handleAuth} className="auth-form">
                    {!isLogin && (
                        <div className="input-group">
                            <UserIcon size={20} />
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
                        <Mail size={20} />
                        <input
                            type="email"
                            placeholder="Email manzilingiz"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>

                    <div className="input-group">
                        <Lock size={20} />
                        <input
                            type="password"
                            placeholder="Parolingiz"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>

                    {message && (
                        <div className={`message ${message.type}`}>
                            {message.text}
                        </div>
                    )}

                    <button type="submit" disabled={loading} className="auth-button">
                        {loading ? <Loader2 className="animate-spin" /> : (
                            <>
                                {isLogin ? 'Kirish' : 'Ro\'yxatdan o\'tish'}
                                <ArrowRight size={20} />
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
        </div>
    )
}

export default Auth
