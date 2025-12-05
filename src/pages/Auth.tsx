import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link, useLocation } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth, UserRole } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { User, Building2, ArrowLeft, Eye, EyeOff, Loader2 } from 'lucide-react';
import logo from '@/assets/logo.png';

type AuthMode = 'login' | 'register';

export default function Auth() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const isRegisterPath = location.pathname === '/registar';
  const initialMode = isRegisterPath || searchParams.get('mode') === 'register' ? 'register' : 'login';
  const initialRole = searchParams.get('role') as UserRole | null;

  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(initialRole);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  const { t } = useLanguage();
  const { login, register, isAuthenticated, profile, triage, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated && profile && !authLoading) {
      // Determine where to redirect based on role and triage status
      if (profile.role === 'migrant') {
        const triageCompleted = triage?.completed ?? false;
        navigate(triageCompleted ? '/dashboard/migrante' : '/triagem');
      } else if (profile.role === 'company') {
        navigate('/dashboard/empresa');
      } else {
        navigate('/dashboard/cpc');
      }
    }
  }, [isAuthenticated, profile, triage, authLoading, navigate]);

  const roles = [
    { id: 'migrant' as UserRole, label: t.auth.roles.migrant, icon: User, description: 'Pessoa em busca de integração' },
    { id: 'company' as UserRole, label: t.auth.roles.company, icon: Building2, description: 'Empresa ou empregador' },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (mode === 'login') {
        await login(formData.email, formData.password);
        toast.success('Bem-vindo(a) de volta!');
      } else {
        if (!selectedRole) {
          toast.error('Por favor selecione o seu perfil');
          setIsLoading(false);
          return;
        }
        if (formData.password !== formData.confirmPassword) {
          toast.error('As palavras-passe não coincidem');
          setIsLoading(false);
          return;
        }
        if (formData.password.length < 6) {
          toast.error('A palavra-passe deve ter pelo menos 6 caracteres');
          setIsLoading(false);
          return;
        }
        await register({
          email: formData.email,
          password: formData.password,
          name: formData.name,
          role: selectedRole,
        });
        toast.success('Conta criada com sucesso!');
      }
    } catch (error: unknown) {
      console.error('Auth error:', error);
      const message = error instanceof Error
        ? (error.message === 'Invalid login credentials' 
            ? 'Email ou palavra-passe incorretos' 
            : error.message)
        : 'Ocorreu um erro';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading) {
    return (
      <Layout hideFooter>
        <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  // Role Selection Screen (for register)
  if (mode === 'register' && !selectedRole) {
    return (
      <Layout hideFooter>
        <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center py-12">
          <div className="w-full max-w-lg px-4">
            <div className="text-center mb-8">
              <img src={logo} alt="CPC" className="h-12 mx-auto mb-6" />
              <h1 className="text-2xl font-bold mb-2">{t.auth.selectRole}</h1>
              <p className="text-muted-foreground">
                Escolha o tipo de conta que melhor se adequa a si
              </p>
            </div>

            <div className="space-y-4 mb-8">
              {roles.map((role) => (
                <button
                  key={role.id}
                  onClick={() => setSelectedRole(role.id)}
                  className="w-full cpc-card p-6 flex items-center gap-4 text-left hover:border-primary transition-colors"
                >
                  <div className="w-14 h-14 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                    <role.icon className="h-7 w-7" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{role.label}</h3>
                    <p className="text-sm text-muted-foreground">{role.description}</p>
                  </div>
                </button>
              ))}
            </div>

            <p className="text-center text-sm text-muted-foreground">
              {t.auth.hasAccount}{' '}
              <button
                onClick={() => setMode('login')}
                className="text-primary hover:underline font-medium"
              >
                {t.auth.login}
              </button>
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout hideFooter>
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center py-12">
        <div className="w-full max-w-md px-4">
          {mode === 'register' && selectedRole && (
            <button
              onClick={() => setSelectedRole(null)}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar à seleção de perfil
            </button>
          )}

          <div className="cpc-card p-8">
            <div className="text-center mb-8">
              <img src={logo} alt="CPC" className="h-10 mx-auto mb-6" />
              <h1 className="text-2xl font-bold">
                {mode === 'login' ? t.auth.login : t.auth.register}
              </h1>
              {mode === 'register' && selectedRole && (
                <p className="text-sm text-muted-foreground mt-2">
                  Registar como: <span className="font-medium text-primary">
                    {roles.find(r => r.id === selectedRole)?.label}
                  </span>
                </p>
              )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'register' && (
                <div className="space-y-2">
                  <Label htmlFor="name">
                    {selectedRole === 'company' ? 'Nome da Empresa' : 'Nome Completo'}
                  </Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    placeholder={selectedRole === 'company' ? 'A sua empresa' : 'O seu nome'}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">{t.auth.email}</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  placeholder="exemplo@email.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">{t.auth.password}</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                    placeholder="••••••••"
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {mode === 'register' && (
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">{t.auth.confirmPassword}</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    required
                    placeholder="••••••••"
                    minLength={6}
                  />
                </div>
              )}

              {mode === 'login' && (
                <div className="text-right">
                  <Link to="/recuperar-senha" className="text-sm text-primary hover:underline">
                    {t.auth.forgotPassword}
                  </Link>
                </div>
              )}

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t.common.loading}
                  </>
                ) : (
                  mode === 'login' ? t.auth.login : t.auth.register
                )}
              </Button>
            </form>

            <div className="mt-6 text-center text-sm text-muted-foreground">
              {mode === 'login' ? (
                <>
                  {t.auth.noAccount}{' '}
                  <button
                    onClick={() => {
                      setMode('register');
                      setSelectedRole(null);
                    }}
                    className="text-primary hover:underline font-medium"
                  >
                    {t.auth.register}
                  </button>
                </>
              ) : (
                <>
                  {t.auth.hasAccount}{' '}
                  <button
                    onClick={() => setMode('login')}
                    className="text-primary hover:underline font-medium"
                  >
                    {t.auth.login}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
