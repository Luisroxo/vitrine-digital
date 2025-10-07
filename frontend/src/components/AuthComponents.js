import React, { useState } from 'react';
import { useAuth } from '../hooks/useAPI';
import { LoadingButton } from '../contexts/LoadingContext';
import { useError } from '../contexts/ErrorContext';

/**
 * Login Form Component
 */
export function LoginForm({ onSuccess, onRegisterClick }) {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    rememberMe: false
  });

  const { login, loading } = useAuth();
  const { showError } = useError();

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.email || !formData.password) {
      showError('Por favor, preencha todos os campos obrigatórios.', 'validation');
      return;
    }

    try {
      const result = await login(formData.email, formData.password, formData.rememberMe);
      
      if (result.success && onSuccess) {
        onSuccess(result.user);
      }
    } catch (error) {
      showError('Falha no login. Verifique suas credenciais.', 'auth');
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  return (
    <div className="card">
      <div className="card-header">
        <h4 className="mb-0">
          <i className="fas fa-sign-in-alt me-2"></i>
          Entrar no Sistema
        </h4>
      </div>
      <div className="card-body">
        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label htmlFor="email" className="form-label">
              Email *
            </label>
            <input
              type="email"
              className="form-control"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="seu@email.com"
              required
            />
          </div>

          <div className="mb-3">
            <label htmlFor="password" className="form-label">
              Senha *
            </label>
            <input
              type="password"
              className="form-control"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Digite sua senha"
              required
            />
          </div>

          <div className="mb-3 form-check">
            <input
              type="checkbox"
              className="form-check-input"
              id="rememberMe"
              name="rememberMe"
              checked={formData.rememberMe}
              onChange={handleChange}
            />
            <label className="form-check-label" htmlFor="rememberMe">
              Lembrar de mim
            </label>
          </div>

          <div className="d-grid gap-2">
            <LoadingButton
              type="submit"
              className="btn btn-primary"
              loading={loading}
              loadingText="Entrando..."
            >
              <i className="fas fa-sign-in-alt me-2"></i>
              Entrar
            </LoadingButton>
          </div>
        </form>

        <hr />

        <div className="text-center">
          <button
            type="button"
            className="btn btn-link"
            onClick={onRegisterClick}
          >
            Não tem conta? Cadastre-se aqui
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Register Form Component
 */
export function RegisterForm({ onSuccess, onLoginClick }) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    acceptTerms: false
  });

  const { register, loading } = useAuth();
  const { showError } = useError();

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validações
    if (!formData.name || !formData.email || !formData.password || !formData.confirmPassword) {
      showError('Por favor, preencha todos os campos obrigatórios.', 'validation');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      showError('As senhas não coincidem.', 'validation');
      return;
    }

    if (formData.password.length < 6) {
      showError('A senha deve ter pelo menos 6 caracteres.', 'validation');
      return;
    }

    if (!formData.acceptTerms) {
      showError('Você deve aceitar os termos de uso.', 'validation');
      return;
    }

    try {
      const result = await register({
        name: formData.name,
        email: formData.email,
        password: formData.password
      });
      
      if (result.success && onSuccess) {
        onSuccess(result.user);
      }
    } catch (error) {
      showError('Falha no cadastro. Tente novamente.', 'auth');
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  return (
    <div className="card">
      <div className="card-header">
        <h4 className="mb-0">
          <i className="fas fa-user-plus me-2"></i>
          Criar Nova Conta
        </h4>
      </div>
      <div className="card-body">
        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label htmlFor="name" className="form-label">
              Nome Completo *
            </label>
            <input
              type="text"
              className="form-control"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Seu nome completo"
              required
            />
          </div>

          <div className="mb-3">
            <label htmlFor="email" className="form-label">
              Email *
            </label>
            <input
              type="email"
              className="form-control"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="seu@email.com"
              required
            />
          </div>

          <div className="mb-3">
            <label htmlFor="password" className="form-label">
              Senha *
            </label>
            <input
              type="password"
              className="form-control"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Mínimo 6 caracteres"
              required
              minLength="6"
            />
          </div>

          <div className="mb-3">
            <label htmlFor="confirmPassword" className="form-label">
              Confirmar Senha *
            </label>
            <input
              type="password"
              className="form-control"
              id="confirmPassword"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              placeholder="Digite a senha novamente"
              required
            />
          </div>

          <div className="mb-3 form-check">
            <input
              type="checkbox"
              className="form-check-input"
              id="acceptTerms"
              name="acceptTerms"
              checked={formData.acceptTerms}
              onChange={handleChange}
              required
            />
            <label className="form-check-label" htmlFor="acceptTerms">
              Aceito os <a href="#" target="_blank">termos de uso</a> e <a href="#" target="_blank">política de privacidade</a> *
            </label>
          </div>

          <div className="d-grid gap-2">
            <LoadingButton
              type="submit"
              className="btn btn-success"
              loading={loading}
              loadingText="Criando conta..."
            >
              <i className="fas fa-user-plus me-2"></i>
              Criar Conta
            </LoadingButton>
          </div>
        </form>

        <hr />

        <div className="text-center">
          <button
            type="button"
            className="btn btn-link"
            onClick={onLoginClick}
          >
            Já tem conta? Faça login aqui
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Password Reset Form Component
 */
export function PasswordResetForm({ onSuccess, onBackToLogin }) {
  const [formData, setFormData] = useState({
    email: ''
  });
  const [step, setStep] = useState('request'); // request | sent

  const { resetPassword, loading } = useAuth();
  const { showError, showSuccess } = useError();

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.email) {
      showError('Por favor, digite seu email.', 'validation');
      return;
    }

    try {
      await resetPassword(formData.email);
      setStep('sent');
      showSuccess('Email de recuperação enviado com sucesso!');
    } catch (error) {
      showError('Erro ao enviar email de recuperação.', 'auth');
    }
  };

  const handleChange = (e) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  if (step === 'sent') {
    return (
      <div className="card">
        <div className="card-body text-center">
          <div className="mb-4">
            <i className="fas fa-envelope-check text-success" style={{ fontSize: '3rem' }}></i>
          </div>
          <h4>Email Enviado!</h4>
          <p className="mb-4">
            Enviamos um link de recuperação para <strong>{formData.email}</strong>.
            Verifique sua caixa de entrada e spam.
          </p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={onBackToLogin}
          >
            Voltar ao Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-header">
        <h4 className="mb-0">
          <i className="fas fa-key me-2"></i>
          Recuperar Senha
        </h4>
      </div>
      <div className="card-body">
        <p className="text-muted mb-4">
          Digite seu email para receber um link de recuperação de senha.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label htmlFor="email" className="form-label">
              Email
            </label>
            <input
              type="email"
              className="form-control"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="seu@email.com"
              required
            />
          </div>

          <div className="d-grid gap-2 mb-3">
            <LoadingButton
              type="submit"
              className="btn btn-primary"
              loading={loading}
              loadingText="Enviando..."
            >
              <i className="fas fa-paper-plane me-2"></i>
              Enviar Link
            </LoadingButton>
          </div>
        </form>

        <div className="text-center">
          <button
            type="button"
            className="btn btn-link"
            onClick={onBackToLogin}
          >
            <i className="fas fa-arrow-left me-2"></i>
            Voltar ao Login
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * User Profile Component
 */
export function UserProfile({ user, onUpdateSuccess }) {
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    currentPassword: '',
    newPassword: '',
    confirmNewPassword: ''
  });
  const [activeTab, setActiveTab] = useState('profile');

  const { updateProfile, changePassword, loading } = useAuth();
  const { showError, showSuccess } = useError();

  const handleProfileSubmit = async (e) => {
    e.preventDefault();

    try {
      const result = await updateProfile({
        name: formData.name,
        email: formData.email
      });
      
      if (result.success) {
        showSuccess('Perfil atualizado com sucesso!');
        if (onUpdateSuccess) {
          onUpdateSuccess(result.user);
        }
      }
    } catch (error) {
      showError('Erro ao atualizar perfil.', 'profile');
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();

    if (!formData.currentPassword || !formData.newPassword || !formData.confirmNewPassword) {
      showError('Preencha todos os campos de senha.', 'validation');
      return;
    }

    if (formData.newPassword !== formData.confirmNewPassword) {
      showError('As novas senhas não coincidem.', 'validation');
      return;
    }

    if (formData.newPassword.length < 6) {
      showError('A nova senha deve ter pelo menos 6 caracteres.', 'validation');
      return;
    }

    try {
      await changePassword(formData.currentPassword, formData.newPassword);
      showSuccess('Senha alterada com sucesso!');
      setFormData(prev => ({
        ...prev,
        currentPassword: '',
        newPassword: '',
        confirmNewPassword: ''
      }));
    } catch (error) {
      showError('Erro ao alterar senha. Verifique sua senha atual.', 'auth');
    }
  };

  const handleChange = (e) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  return (
    <div className="card">
      <div className="card-header">
        <ul className="nav nav-tabs card-header-tabs">
          <li className="nav-item">
            <button
              className={`nav-link ${activeTab === 'profile' ? 'active' : ''}`}
              onClick={() => setActiveTab('profile')}
            >
              <i className="fas fa-user me-2"></i>
              Perfil
            </button>
          </li>
          <li className="nav-item">
            <button
              className={`nav-link ${activeTab === 'password' ? 'active' : ''}`}
              onClick={() => setActiveTab('password')}
            >
              <i className="fas fa-lock me-2"></i>
              Senha
            </button>
          </li>
        </ul>
      </div>
      <div className="card-body">
        {activeTab === 'profile' && (
          <form onSubmit={handleProfileSubmit}>
            <div className="row">
              <div className="col-md-6 mb-3">
                <label htmlFor="name" className="form-label">
                  Nome Completo
                </label>
                <input
                  type="text"
                  className="form-control"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="col-md-6 mb-3">
                <label htmlFor="email" className="form-label">
                  Email
                </label>
                <input
                  type="email"
                  className="form-control"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div className="d-grid gap-2 d-md-flex justify-content-md-end">
              <LoadingButton
                type="submit"
                className="btn btn-primary"
                loading={loading}
                loadingText="Salvando..."
              >
                <i className="fas fa-save me-2"></i>
                Salvar Alterações
              </LoadingButton>
            </div>
          </form>
        )}

        {activeTab === 'password' && (
          <form onSubmit={handlePasswordSubmit}>
            <div className="mb-3">
              <label htmlFor="currentPassword" className="form-label">
                Senha Atual
              </label>
              <input
                type="password"
                className="form-control"
                id="currentPassword"
                name="currentPassword"
                value={formData.currentPassword}
                onChange={handleChange}
                required
              />
            </div>

            <div className="row">
              <div className="col-md-6 mb-3">
                <label htmlFor="newPassword" className="form-label">
                  Nova Senha
                </label>
                <input
                  type="password"
                  className="form-control"
                  id="newPassword"
                  name="newPassword"
                  value={formData.newPassword}
                  onChange={handleChange}
                  minLength="6"
                  required
                />
              </div>
              <div className="col-md-6 mb-3">
                <label htmlFor="confirmNewPassword" className="form-label">
                  Confirmar Nova Senha
                </label>
                <input
                  type="password"
                  className="form-control"
                  id="confirmNewPassword"
                  name="confirmNewPassword"
                  value={formData.confirmNewPassword}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div className="d-grid gap-2 d-md-flex justify-content-md-end">
              <LoadingButton
                type="submit"
                className="btn btn-warning"
                loading={loading}
                loadingText="Alterando..."
              >
                <i className="fas fa-key me-2"></i>
                Alterar Senha
              </LoadingButton>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

/**
 * Auth Status Component (for header/navbar)
 */
export function AuthStatus({ user, onLogout, onProfileClick }) {
  const { logout, loading } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
      if (onLogout) {
        onLogout();
      }
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  if (!user) {
    return null;
  }

  return (
    <div className="dropdown">
      <button
        className="btn btn-outline-primary dropdown-toggle"
        type="button"
        data-bs-toggle="dropdown"
        aria-expanded="false"
      >
        <i className="fas fa-user-circle me-2"></i>
        {user.name}
      </button>
      <ul className="dropdown-menu dropdown-menu-end">
        <li>
          <h6 className="dropdown-header">
            <i className="fas fa-envelope me-2"></i>
            {user.email}
          </h6>
        </li>
        <li><hr className="dropdown-divider" /></li>
        <li>
          <button
            className="dropdown-item"
            onClick={onProfileClick}
          >
            <i className="fas fa-user-edit me-2"></i>
            Meu Perfil
          </button>
        </li>
        <li><hr className="dropdown-divider" /></li>
        <li>
          <LoadingButton
            className="dropdown-item text-danger"
            onClick={handleLogout}
            loading={loading}
            loadingText="Saindo..."
          >
            <i className="fas fa-sign-out-alt me-2"></i>
            Sair
          </LoadingButton>
        </li>
      </ul>
    </div>
  );
}

/**
 * Protected Route Component
 */
export function ProtectedRoute({ children, user, fallback }) {
  if (!user) {
    return fallback || (
      <div className="container-fluid vh-100 d-flex align-items-center justify-content-center">
        <div className="text-center">
          <i className="fas fa-lock text-warning" style={{ fontSize: '4rem' }}></i>
          <h3 className="mt-3">Acesso Restrito</h3>
          <p className="text-muted">Você precisa estar logado para acessar esta página.</p>
        </div>
      </div>
    );
  }

  return children;
}