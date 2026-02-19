// index.js (SignIn)
import React, { useEffect, useState } from 'react';
import logo from '../../assets/images/WeBugMate.png';
import { useContext } from 'react';
import { MyContext } from '../../App';
import { MdEmail } from "react-icons/md";
import { RiLockPasswordLine } from "react-icons/ri";
import { useNavigate } from 'react-router-dom';
import { IoMdArrowBack } from 'react-icons/io';
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import './signin.css';
import { databaseService } from '../../services/supabase';

const SignIn = () => {
    const context = useContext(MyContext);
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        context.setIshideSidebar(true);
        return () => {
            context.setIshideSidebar(false);
        };
    }, [context]);

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);
        // Normalize email to lowercase and trim spaces for robust login
        const normalizedEmail = email.trim().toLowerCase();

        try {
            // 1. Check user_perms for email
            const { data: userPerm, error: permError } = await databaseService.getUserByEmail(normalizedEmail);
            if (permError || !userPerm) {
                setError('Email not found or not allowed.');
                return;
            }
            // 2. Check password
            if (userPerm.password !== password) {
                setError('Incorrect password.');
                return;
            }
            // 3. Get user profile to fetch avatar URL and REAL UUID if different
            let avatarUrl = '';
            let validUserId = userPerm.id; // Default to user_perms ID

            try {
                let profileData = null;
                // Try direct fetch first
                try {
                    const { data } = await databaseService.supabase
                        .from('profiles')
                        .select('id, avatar_url')
                        .eq('email', normalizedEmail)
                        .single();
                    profileData = data;
                } catch (e) { console.warn("Direct profile fetch failed", e); }

                // If direct fetch fails or returns no ID, try backend
                if (!profileData || !profileData.id) {
                    try {
                        const res = await fetch('https://zeelsheta-webugmate-backend-pr-2-1.hf.space/api/get_user_uuid', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': 'Bearer webugmate123',
                                'user_email': normalizedEmail
                            },
                            body: JSON.stringify({ email: normalizedEmail })
                        });
                        const resData = await res.json();
                        if (resData.uuid) {
                            if (!profileData) profileData = {};
                            profileData.id = resData.uuid;
                        }
                    } catch (bkErr) {
                        console.warn("Backend UUID fetch failed", bkErr);
                    }
                }

                if (profileData) {
                    if (profileData.avatar_url) avatarUrl = profileData.avatar_url;
                    // If profiles table has an ID, it's likely the FK we want for other tables
                    if (profileData.id) validUserId = profileData.id;
                }

                // If no avatar found in 'profiles', check 'user_profiles'
                if (!avatarUrl) {
                    const { data: userProfileData } = await databaseService.supabase
                        .from('user_profiles')
                        .select('avatar_url')
                        .eq('email', normalizedEmail)
                        .single();

                    if (userProfileData && userProfileData.avatar_url) {
                        avatarUrl = userProfileData.avatar_url;
                    }
                }
            } catch (err) {
                console.error('Error fetching user profile:', err);
            }

            // 4. Proceed with sign in local state/context
            if (context.setIsSignIn) context.setIsSignIn(true);
            if (context.setUsername) context.setUsername(userPerm.name);
            if (context.setUserEmail) context.setUserEmail(normalizedEmail);
            if (context.setUserPhotoURL && avatarUrl) context.setUserPhotoURL(avatarUrl);
            if (context.setUserId) context.setUserId(validUserId);

            // Set role & permissions
            if (context.setUserRole) context.setUserRole(userPerm.role || 'Employee');
            if (context.setUserPermissions) context.setUserPermissions(userPerm.permission_roles || {});

            // Persist this tab's session and cross-tab session
            try {
                const authUser = {
                    name: userPerm.name,
                    email: normalizedEmail,
                    photoURL: avatarUrl,
                    role: userPerm.role || 'Employee',
                    permissions: userPerm.permission_roles || {},
                    id: validUserId
                };
                sessionStorage.setItem('authUser', JSON.stringify(authUser));
                localStorage.setItem('authUser', JSON.stringify(authUser));
            } catch (e) {
                console.error('Failed to persist auth user:', e);
            }

            // 🔗 Migrate guest chat history to logged-in user
            try {
                const guestHistoryRaw = localStorage.getItem('unified_chatHistory_guest');
                if (guestHistoryRaw) {
                    const guestHistory = JSON.parse(guestHistoryRaw);
                    if (Array.isArray(guestHistory) && guestHistory.length > 0) {
                        const userKey = `unified_chatHistory_${normalizedEmail}`;
                        const existingRaw = localStorage.getItem(userKey);
                        const existing = existingRaw ? JSON.parse(existingRaw) : [];
                        const merged = [...existing, ...guestHistory];
                        localStorage.setItem(userKey, JSON.stringify(merged));
                        localStorage.removeItem('unified_chatHistory_guest'); // cleanup
                    }
                }
            } catch (e) {
                console.error("Failed to migrate guest chat history:", e);
            }

            // Log employee login event
            await databaseService.logEmployeeLogin({ email: normalizedEmail, name: userPerm.name, password });

            // 5. Set session on the Python Backend
            try {
                await fetch('https://zeelsheta-webugmate-backend-pr-2-1.hf.space/set_session', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer webugmate123'
                    },
                    body: JSON.stringify({
                        email: normalizedEmail,
                        name: userPerm.name
                    })
                });
            } catch (backendErr) {
                console.warn('Failed to set backend session:', backendErr);
                // We don't block login if this fails, but chatbot might not work
            }

            navigate('/dashboard');
        } catch (err) {
            setError('An error occurred. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="login-section">
            <div className="animated-background">
                <div className="floating-shapes">
                    <div className="shape shape-1"></div>
                    <div className="shape shape-2"></div>
                    <div className="shape shape-3"></div>
                    <div className="shape shape-4"></div>
                </div>
            </div>

            <div className='login-container'>
                <div className='login-box'>

                    <div className='logo-section'>
                        <div className='logo-container'>
                            <img src={logo} alt="logo" className='logo-image' />
                        </div>
                        <h2 className='welcome-text'>Welcome Back</h2>
                    </div>

                    <div className='form-section'>
                        <form onSubmit={handleLogin} className='login-form'>
                            <div className='glassmorphism-input-group'>
                                <div className='glassmorphism-input-container'>
                                    <span className='glassmorphism-icon'><MdEmail /></span>
                                    <input
                                        type='email'
                                        className='glassmorphism-input'
                                        id='email'
                                        placeholder='Username'
                                        autoFocus
                                        value={email}
                                        onChange={e => setEmail(e.target.value)}
                                        required
                                    />
                                </div>
                            </div>

                            <div className='glassmorphism-input-group'>
                                <div className='glassmorphism-input-container'>
                                    <span className='glassmorphism-icon'><RiLockPasswordLine /></span>
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        className='glassmorphism-input'
                                        id='password'
                                        placeholder='Password'
                                        value={password}
                                        onChange={e => setPassword(e.target.value)}
                                        required
                                    />
                                    <button
                                        type='button'
                                        className='glassmorphism-password-toggle'
                                        onClick={() => setShowPassword(!showPassword)}
                                    >
                                        {showPassword ? <FaEyeSlash /> : <FaEye />}
                                    </button>
                                </div>
                            </div>

                            {error && (
                                <div className='error-message'>
                                    <span className='error-icon'>⚠</span>
                                    {error}
                                </div>
                            )}

                            <button
                                className={`login-button ${isLoading ? 'loading' : ''}`}
                                type='submit'
                                disabled={isLoading}
                            >
                                {isLoading ? (
                                    <div className='loading-spinner'>
                                        <div className='spinner'></div>
                                        <span>Signing in...</span>
                                    </div>
                                ) : (
                                    'Sign In'
                                )}
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default SignIn;