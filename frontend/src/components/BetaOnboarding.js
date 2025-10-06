import React, { useState, useEffect } from 'react';
import api from '../services/api';

const BetaOnboarding = () => {
    const [onboardingData, setOnboardingData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeStep, setActiveStep] = useState(null);
    const [stepData, setStepData] = useState({});
    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        loadOnboardingStatus();
    }, []);

    const loadOnboardingStatus = async () => {
        try {
            setLoading(true);
            const response = await api.get('/beta/onboarding/status');
            
            if (response.data.success && response.data.data.exists) {
                setOnboardingData(response.data.data);
            } else {
                // No onboarding exists, might need to create one
                setOnboardingData(null);
            }
        } catch (error) {
            console.error('Error loading onboarding status:', error);
        } finally {
            setLoading(false);
        }
    };

    const startOnboarding = async (userType) => {
        try {
            setProcessing(true);
            const response = await api.post('/beta/onboarding/start', {
                user_type: userType,
                metadata: {}
            });

            if (response.data.success) {
                await loadOnboardingStatus();
            }
        } catch (error) {
            console.error('Error starting onboarding:', error);
        } finally {
            setProcessing(false);
        }
    };

    const completeStep = async (stepId) => {
        try {
            setProcessing(true);
            
            const response = await api.put(
                `/beta/onboarding/${onboardingData.id}/step/${stepId}`,
                stepData[stepId] || {}
            );

            if (response.data.success) {
                await loadOnboardingStatus();
                setActiveStep(null);
                setStepData({});
            }
        } catch (error) {
            console.error('Error completing step:', error);
            alert(`Erro ao completar etapa: ${error.response?.data?.message || error.message}`);
        } finally {
            setProcessing(false);
        }
    };

    const updateStepData = (stepId, data) => {
        setStepData(prev => ({
            ...prev,
            [stepId]: { ...prev[stepId], ...data }
        }));
    };

    const renderStepForm = (step) => {
        const stepId = step.id;
        const currentData = stepData[stepId] || {};

        switch (stepId) {
            case 'domain_setup':
                return (
                    <div className="step-form">
                        <div className="mb-3">
                            <label className="form-label">Domínio Desejado</label>
                            <div className="input-group">
                                <input
                                    type="text"
                                    className="form-control"
                                    placeholder="minhaloja"
                                    value={currentData.domain || ''}
                                    onChange={(e) => updateStepData(stepId, { 
                                        domain: `${e.target.value}.vitrine360.com.br` 
                                    })}
                                />
                                <span className="input-group-text">.vitrine360.com.br</span>
                            </div>
                            <div className="form-text">
                                Escolha um subdomínio único para sua loja
                            </div>
                        </div>
                    </div>
                );

            case 'bling_integration':
                return (
                    <div className="step-form">
                        <div className="alert alert-info">
                            <i className="fas fa-info-circle me-2"></i>
                            Para conectar com o Bling ERP, você precisa autorizar o acesso.
                        </div>
                        <button 
                            type="button" 
                            className="btn btn-primary"
                            onClick={() => window.location.href = '/admin/bling'}
                        >
                            <i className="fas fa-link me-2"></i>
                            Conectar com Bling ERP
                        </button>
                    </div>
                );

            case 'branding_setup':
                return (
                    <div className="step-form">
                        <div className="row">
                            <div className="col-md-6">
                                <div className="mb-3">
                                    <label className="form-label">Nome da Loja</label>
                                    <input
                                        type="text"
                                        className="form-control"
                                        value={currentData.store_name || ''}
                                        onChange={(e) => updateStepData(stepId, { 
                                            store_name: e.target.value 
                                        })}
                                    />
                                </div>
                            </div>
                            <div className="col-md-6">
                                <div className="mb-3">
                                    <label className="form-label">Cor Principal</label>
                                    <input
                                        type="color"
                                        className="form-control form-control-color"
                                        value={currentData.primary_color || '#007bff'}
                                        onChange={(e) => updateStepData(stepId, { 
                                            primary_color: e.target.value 
                                        })}
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="mb-3">
                            <label className="form-label">Logo da Loja</label>
                            <input
                                type="file"
                                className="form-control"
                                accept="image/*"
                                onChange={(e) => updateStepData(stepId, { 
                                    logo_file: e.target.files[0] 
                                })}
                            />
                        </div>
                    </div>
                );

            default:
                return (
                    <div className="step-form">
                        <div className="alert alert-success">
                            <i className="fas fa-check-circle me-2"></i>
                            Clique em "Completar Etapa" quando você tiver realizado: <strong>{step.name}</strong>
                        </div>
                    </div>
                );
        }
    };

    if (loading) {
        return (
            <div className="text-center py-5">
                <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Carregando...</span>
                </div>
                <p className="mt-3">Carregando informações do onboarding...</p>
            </div>
        );
    }

    if (!onboardingData) {
        return (
            <div className="card">
                <div className="card-header">
                    <h5 className="card-title mb-0">
                        <i className="fas fa-rocket me-2"></i>
                        Bem-vindo à Vitrine Digital!
                    </h5>
                </div>
                <div className="card-body">
                    <p className="mb-4">
                        Para começar a usar nossa plataforma, precisamos configurar sua conta. 
                        Selecione o tipo de usuário:
                    </p>
                    
                    <div className="row">
                        <div className="col-md-6">
                            <div className="card h-100">
                                <div className="card-body text-center">
                                    <i className="fas fa-store fa-3x text-primary mb-3"></i>
                                    <h5>Fornecedor</h5>
                                    <p>Tenho produtos para vender e quero conectar lojistas</p>
                                    <button 
                                        className="btn btn-primary"
                                        onClick={() => startOnboarding('supplier')}
                                        disabled={processing}
                                    >
                                        {processing ? 'Iniciando...' : 'Sou Fornecedor'}
                                    </button>
                                </div>
                            </div>
                        </div>
                        
                        <div className="col-md-6">
                            <div className="card h-100">
                                <div className="card-body text-center">
                                    <i className="fas fa-shopping-cart fa-3x text-success mb-3"></i>
                                    <h5>Lojista</h5>
                                    <p>Quero revender produtos de um fornecedor</p>
                                    <button 
                                        className="btn btn-success"
                                        onClick={() => startOnboarding('retailer')}
                                        disabled={processing}
                                    >
                                        {processing ? 'Iniciando...' : 'Sou Lojista'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    const { progress, next_steps = [], user_type, status } = onboardingData;
    const isCompleted = status === 'completed';

    return (
        <div className="container-fluid">
            <div className="row">
                <div className="col-12">
                    <div className="card">
                        <div className="card-header">
                            <div className="d-flex justify-content-between align-items-center">
                                <h5 className="card-title mb-0">
                                    <i className="fas fa-tasks me-2"></i>
                                    Configuração da Conta - {user_type === 'supplier' ? 'Fornecedor' : 'Lojista'}
                                </h5>
                                {isCompleted && (
                                    <span className="badge bg-success fs-6">
                                        <i className="fas fa-check me-1"></i>
                                        Concluído
                                    </span>
                                )}
                            </div>
                        </div>

                        <div className="card-body">
                            {/* Progress Bar */}
                            <div className="mb-4">
                                <div className="d-flex justify-content-between mb-2">
                                    <span>Progresso Geral</span>
                                    <span className="fw-bold">{progress?.percentage || 0}%</span>
                                </div>
                                <div className="progress mb-2">
                                    <div 
                                        className="progress-bar" 
                                        role="progressbar" 
                                        style={{ width: `${progress?.percentage || 0}%` }}
                                    ></div>
                                </div>
                                <div className="row text-center">
                                    <div className="col-md-3">
                                        <small className="text-muted">Total</small>
                                        <div className="fw-bold">{progress?.completed || 0}/{progress?.total || 0}</div>
                                    </div>
                                    <div className="col-md-3">
                                        <small className="text-muted">Obrigatórias</small>
                                        <div className="fw-bold">{progress?.required_completed || 0}/{progress?.required_total || 0}</div>
                                    </div>
                                    <div className="col-md-3">
                                        <small className="text-muted">Opcionais</small>
                                        <div className="fw-bold">{progress?.optional_completed || 0}/{progress?.optional_total || 0}</div>
                                    </div>
                                    <div className="col-md-3">
                                        <small className="text-muted">Obrigatórias</small>
                                        <div className="fw-bold text-success">{progress?.required_percentage || 0}%</div>
                                    </div>
                                </div>
                            </div>

                            {/* Next Steps */}
                            {!isCompleted && next_steps.length > 0 && (
                                <div>
                                    <h6 className="mb-3">Próximas Etapas</h6>
                                    <div className="row">
                                        {next_steps.map((step, index) => (
                                            <div key={step.id} className="col-md-6 mb-3">
                                                <div className={`card h-100 ${activeStep === step.id ? 'border-primary' : ''}`}>
                                                    <div className="card-body">
                                                        <div className="d-flex justify-content-between align-items-start mb-2">
                                                            <h6 className="card-title mb-0">{step.name}</h6>
                                                            {step.required && (
                                                                <span className="badge bg-danger">Obrigatória</span>
                                                            )}
                                                        </div>
                                                        
                                                        {activeStep === step.id ? (
                                                            <div>
                                                                {renderStepForm(step)}
                                                                <div className="mt-3">
                                                                    <button 
                                                                        className="btn btn-success me-2"
                                                                        onClick={() => completeStep(step.id)}
                                                                        disabled={processing}
                                                                    >
                                                                        {processing ? (
                                                                            <>
                                                                                <span className="spinner-border spinner-border-sm me-2"></span>
                                                                                Processando...
                                                                            </>
                                                                        ) : (
                                                                            <>
                                                                                <i className="fas fa-check me-2"></i>
                                                                                Completar Etapa
                                                                            </>
                                                                        )}
                                                                    </button>
                                                                    <button 
                                                                        className="btn btn-secondary"
                                                                        onClick={() => setActiveStep(null)}
                                                                        disabled={processing}
                                                                    >
                                                                        Cancelar
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <button 
                                                                className="btn btn-outline-primary btn-sm"
                                                                onClick={() => setActiveStep(step.id)}
                                                            >
                                                                <i className="fas fa-play me-2"></i>
                                                                Iniciar
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Completion Message */}
                            {isCompleted && (
                                <div className="alert alert-success">
                                    <div className="d-flex align-items-center">
                                        <i className="fas fa-trophy fa-2x text-warning me-3"></i>
                                        <div>
                                            <h5 className="alert-heading">Parabéns! 🎉</h5>
                                            <p className="mb-0">
                                                Você concluiu todas as etapas de configuração. 
                                                Sua conta está pronta para usar todos os recursos da plataforma!
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BetaOnboarding;