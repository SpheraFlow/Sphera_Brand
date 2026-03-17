import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api from '../services/api'; // Este é o objeto axios exportado no projeto

export interface User {
    id: string;
    nome: string;
    email: string;
    role: 'admin' | 'atendente';
    permissions?: Record<string, boolean>;
}

interface AuthContextType {
    user: User | null;
    token: string | null;
    login: (token: string, user: User) => void;
    logout: () => void;
    isAdmin: () => boolean;
    hasPermission: (permissionKey: string) => boolean;
    loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Verifica se o JWT está expirado sem fazer request ao backend
const isTokenExpired = (token: string): boolean => {
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        return typeof payload.exp === 'number' && payload.exp * 1000 < Date.now();
    } catch {
        return true;
    }
};

const clearAuthStorage = () => {
    localStorage.removeItem('@SpheraAuth:token');
    localStorage.removeItem('@SpheraAuth:user');
    delete api.defaults.headers.common['Authorization'];
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    // Setup inicial: ler token do localStorage e buscar "me"
    useEffect(() => {
        const storedToken = localStorage.getItem('@SpheraAuth:token');
        const storedUser = localStorage.getItem('@SpheraAuth:user');

        if (storedToken && storedUser) {
            // Verificação imediata: se o token já está expirado, logout sem esperar API
            if (isTokenExpired(storedToken)) {
                clearAuthStorage();
                setLoading(false);
                window.location.href = '/login';
                return;
            }

            setToken(storedToken);
            setUser(JSON.parse(storedUser));
            api.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;

            // Valida token em background
            api.get('/auth/me')
                .then(response => {
                    if (response.data.success && response.data.user) {
                        setUser(response.data.user);
                        localStorage.setItem('@SpheraAuth:user', JSON.stringify(response.data.user));
                    }
                })
                .catch(() => {
                    // Token inválido ou expirado
                    logout();
                })
                .finally(() => {
                    setLoading(false);
                });
        } else {
            setLoading(false);
        }
    }, []);

    // Interceptor do Axios: deslogar em caso de 401 ou token expirado antes do request
    useEffect(() => {
        const reqInterceptor = api.interceptors.request.use((config) => {
            const t = localStorage.getItem('@SpheraAuth:token');
            if (t && isTokenExpired(t)) {
                clearAuthStorage();
                window.location.href = '/login';
                return Promise.reject(new Error('Token expirado')) as any;
            }
            return config;
        });

        const resInterceptor = api.interceptors.response.use(
            (response) => response,
            (error) => {
                if (error.response?.status === 401 && error.config?.url !== '/auth/login') {
                    logout();
                }
                return Promise.reject(error);
            }
        );

        return () => {
            api.interceptors.request.eject(reqInterceptor);
            api.interceptors.response.eject(resInterceptor);
        };
    }, []);

    const login = (newToken: string, newUser: User) => {
        setToken(newToken);
        setUser(newUser);
        localStorage.setItem('@SpheraAuth:token', newToken);
        localStorage.setItem('@SpheraAuth:user', JSON.stringify(newUser));
        api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
    };

    const logout = () => {
        setToken(null);
        setUser(null);
        localStorage.removeItem('@SpheraAuth:token');
        localStorage.removeItem('@SpheraAuth:user');
        delete api.defaults.headers.common['Authorization'];
        window.location.href = '/login'; // Força redirect e limpa state
    };

    const isAdmin = () => user?.role === 'admin';

    const hasPermission = (permissionKey: string) => {
        if (!user) return false;
        if (user.role === 'admin') return true; // Admins absolutos sempre podem
        return !!user.permissions?.[permissionKey]; // Retorna true apenas se a chave for explicitamente true
    };

    return (
        <AuthContext.Provider value={{ user, token, login, logout, isAdmin, hasPermission, loading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth deve ser usado dentro de um AuthProvider');
    }
    return context;
};
