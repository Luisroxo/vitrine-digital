import React, { createContext, useContext, useReducer, useCallback } from 'react';

/**
 * Error types and severity levels
 */
export const ERROR_TYPES = {
  API_ERROR: 'API_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR: 'AUTHORIZATION_ERROR',
  CLIENT_ERROR: 'CLIENT_ERROR',
  SERVER_ERROR: 'SERVER_ERROR',
  BUSINESS_LOGIC_ERROR: 'BUSINESS_LOGIC_ERROR'
};

export const ERROR_SEVERITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical'
};

/**
 * Error handler reducer
 */
function errorReducer(state, action) {
  switch (action.type) {
    case 'ADD_ERROR':
      return {
        ...state,
        errors: [
          ...state.errors,
          {
            id: action.payload.id,
            ...action.payload.error,
            timestamp: new Date(),
            dismissed: false
          }
        ]
      };

    case 'DISMISS_ERROR':
      return {
        ...state,
        errors: state.errors.map(error =>
          error.id === action.payload.id
            ? { ...error, dismissed: true }
            : error
        )
      };

    case 'REMOVE_ERROR':
      return {
        ...state,
        errors: state.errors.filter(error => error.id !== action.payload.id)
      };

    case 'CLEAR_ERRORS':
      return {
        ...state,
        errors: []
      };

    case 'CLEAR_DISMISSED':
      return {
        ...state,
        errors: state.errors.filter(error => !error.dismissed)
      };

    default:
      return state;
  }
}

/**
 * Error context
 */
const ErrorContext = createContext();

/**
 * Error provider component
 */
export function ErrorProvider({ children, onError = null }) {
  const [state, dispatch] = useReducer(errorReducer, {
    errors: []
  });

  // Add error
  const addError = useCallback((error, options = {}) => {
    const errorId = `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const processedError = {
      id: errorId,
      type: error.type || ERROR_TYPES.CLIENT_ERROR,
      severity: determineSeverity(error),
      message: error.message || 'An unknown error occurred',
      code: error.code,
      status: error.status,
      requestId: error.requestId,
      context: options.context || {},
      autoRemove: options.autoRemove !== false,
      persistent: options.persistent === true,
      retryable: isRetryable(error),
      userFriendlyMessage: getUserFriendlyMessage(error)
    };

    dispatch({
      type: 'ADD_ERROR',
      payload: { id: errorId, error: processedError }
    });

    // Call external error handler if provided
    if (onError) {
      onError(processedError);
    }

    // Auto-remove error after timeout (unless persistent)
    if (processedError.autoRemove && !processedError.persistent) {
      const timeout = getSeverityTimeout(processedError.severity);
      setTimeout(() => {
        dispatch({
          type: 'REMOVE_ERROR',
          payload: { id: errorId }
        });
      }, timeout);
    }

    // Log error for debugging
    console.error('🚨 Error added:', processedError);

    return errorId;
  }, [onError]);

  // Dismiss error
  const dismissError = useCallback((errorId) => {
    dispatch({
      type: 'DISMISS_ERROR',
      payload: { id: errorId }
    });
  }, []);

  // Remove error
  const removeError = useCallback((errorId) => {
    dispatch({
      type: 'REMOVE_ERROR',
      payload: { id: errorId }
    });
  }, []);

  // Clear all errors
  const clearErrors = useCallback(() => {
    dispatch({ type: 'CLEAR_ERRORS' });
  }, []);

  // Clear dismissed errors
  const clearDismissed = useCallback(() => {
    dispatch({ type: 'CLEAR_DISMISSED' });
  }, []);

  // Get active errors (not dismissed)
  const getActiveErrors = useCallback(() => {
    return state.errors.filter(error => !error.dismissed);
  }, [state.errors]);

  // Get errors by severity
  const getErrorsBySeverity = useCallback((severity) => {
    return state.errors.filter(error => 
      error.severity === severity && !error.dismissed
    );
  }, [state.errors]);

  // Handle API errors specifically
  const handleApiError = useCallback((error, context = {}) => {
    let errorType = ERROR_TYPES.API_ERROR;
    
    if (error.status === 401) {
      errorType = ERROR_TYPES.AUTHENTICATION_ERROR;
    } else if (error.status === 403) {
      errorType = ERROR_TYPES.AUTHORIZATION_ERROR;
    } else if (error.status >= 400 && error.status < 500) {
      errorType = ERROR_TYPES.CLIENT_ERROR;
    } else if (error.status >= 500) {
      errorType = ERROR_TYPES.SERVER_ERROR;
    } else if (error.type === 'NETWORK_ERROR') {
      errorType = ERROR_TYPES.NETWORK_ERROR;
    }

    return addError({
      ...error,
      type: errorType
    }, { context });
  }, [addError]);

  // Handle validation errors
  const handleValidationError = useCallback((errors, context = {}) => {
    const validationError = {
      type: ERROR_TYPES.VALIDATION_ERROR,
      message: 'Validation failed',
      details: errors,
      userFriendlyMessage: formatValidationErrors(errors)
    };

    return addError(validationError, { context });
  }, [addError]);

  const value = {
    errors: state.errors,
    activeErrors: getActiveErrors(),
    addError,
    dismissError,
    removeError,
    clearErrors,
    clearDismissed,
    getErrorsBySeverity,
    handleApiError,
    handleValidationError
  };

  return (
    <ErrorContext.Provider value={value}>
      {children}
    </ErrorContext.Provider>
  );
}

/**
 * Hook to use error context
 */
export function useError() {
  const context = useContext(ErrorContext);
  
  if (!context) {
    throw new Error('useError must be used within an ErrorProvider');
  }
  
  return context;
}

/**
 * Helper functions
 */

function determineSeverity(error) {
  if (error.severity) {
    return error.severity;
  }

  // Determine severity based on error type and status
  if (error.type === ERROR_TYPES.AUTHENTICATION_ERROR) {
    return ERROR_SEVERITY.HIGH;
  }

  if (error.type === ERROR_TYPES.NETWORK_ERROR) {
    return ERROR_SEVERITY.MEDIUM;
  }

  if (error.status >= 500) {
    return ERROR_SEVERITY.HIGH;
  }

  if (error.status >= 400 && error.status < 500) {
    return ERROR_SEVERITY.MEDIUM;
  }

  return ERROR_SEVERITY.LOW;
}

function getSeverityTimeout(severity) {
  switch (severity) {
    case ERROR_SEVERITY.LOW:
      return 3000; // 3 seconds
    case ERROR_SEVERITY.MEDIUM:
      return 5000; // 5 seconds
    case ERROR_SEVERITY.HIGH:
      return 8000; // 8 seconds
    case ERROR_SEVERITY.CRITICAL:
      return 0; // Don't auto-remove critical errors
    default:
      return 5000;
  }
}

function isRetryable(error) {
  // Network errors are usually retryable
  if (error.type === ERROR_TYPES.NETWORK_ERROR) {
    return true;
  }

  // Server errors (5xx) are retryable
  if (error.status >= 500) {
    return true;
  }

  // Rate limit errors are retryable
  if (error.status === 429) {
    return true;
  }

  // Timeout errors are retryable
  if (error.status === 408 || error.code === 'ECONNABORTED') {
    return true;
  }

  return false;
}

function getUserFriendlyMessage(error) {
  // Map technical errors to user-friendly messages
  const errorMessages = {
    [ERROR_TYPES.NETWORK_ERROR]: 'Problema de conexão. Verifique sua internet e tente novamente.',
    [ERROR_TYPES.AUTHENTICATION_ERROR]: 'Sessão expirada. Faça login novamente.',
    [ERROR_TYPES.AUTHORIZATION_ERROR]: 'Você não tem permissão para realizar esta ação.',
    [ERROR_TYPES.SERVER_ERROR]: 'Erro interno do servidor. Tente novamente em alguns minutos.',
    [ERROR_TYPES.VALIDATION_ERROR]: 'Dados inválidos. Verifique os campos e tente novamente.'
  };

  // Check for specific status codes
  if (error.status) {
    const statusMessages = {
      400: 'Dados inválidos enviados.',
      401: 'Autenticação necessária.',
      403: 'Acesso negado.',
      404: 'Recurso não encontrado.',
      408: 'Tempo limite da requisição esgotado.',
      409: 'Conflito de dados.',
      422: 'Dados não puderam ser processados.',
      429: 'Muitas requisições. Tente novamente em alguns instantes.',
      500: 'Erro interno do servidor.',
      502: 'Serviço temporariamente indisponível.',
      503: 'Serviço em manutenção.',
      504: 'Tempo limite do servidor esgotado.'
    };

    if (statusMessages[error.status]) {
      return statusMessages[error.status];
    }
  }

  return errorMessages[error.type] || error.message || 'Ocorreu um erro inesperado.';
}

function formatValidationErrors(errors) {
  if (Array.isArray(errors)) {
    return errors.map(error => error.message || error).join(', ');
  }

  if (typeof errors === 'object') {
    return Object.entries(errors)
      .map(([field, message]) => `${field}: ${message}`)
      .join(', ');
  }

  return errors.toString();
}

/**
 * Error boundary component for React error handling
 */
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({
      error,
      errorInfo
    });

    // Log error to console
    console.error('🚨 React Error Boundary caught an error:', error, errorInfo);

    // You can also log the error to an error reporting service here
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  render() {
    if (this.state.hasError) {
      // Custom error UI
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.state.errorInfo);
      }

      // Default error UI
      return (
        <div className="error-boundary">
          <h2>Oops! Algo deu errado</h2>
          <details style={{ whiteSpace: 'pre-wrap' }}>
            <summary>Detalhes do erro</summary>
            <p><strong>Erro:</strong> {this.state.error?.toString()}</p>
            <p><strong>Stack trace:</strong></p>
            <pre>{this.state.errorInfo?.componentStack}</pre>
          </details>
          <button 
            onClick={() => window.location.reload()}
            className="btn btn-primary mt-3"
          >
            Recarregar Página
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * HOC for error handling in components
 */
export function withErrorHandling(WrappedComponent) {
  return function WithErrorHandlingComponent(props) {
    const { handleApiError, addError } = useError();

    const enhancedProps = {
      ...props,
      onError: handleApiError,
      addError
    };

    return <WrappedComponent {...enhancedProps} />;
  };
}

/**
 * Utility function to handle promises with error catching
 */
export function handleAsync(asyncFn, errorHandler = null) {
  return async (...args) => {
    try {
      return await asyncFn(...args);
    } catch (error) {
      if (errorHandler) {
        errorHandler(error);
      } else {
        console.error('Async error:', error);
      }
      throw error;
    }
  };
}

/**
 * Toast notification integration
 */
export function useErrorToasts() {
  const { activeErrors, dismissError } = useError();

  React.useEffect(() => {
    // This would integrate with your toast notification system
    // For now, we'll just log to console
    activeErrors.forEach(error => {
      if (!error.toastShown) {
        console.log(`📋 Toast: ${error.userFriendlyMessage}`);
        
        // Mark as shown to avoid duplicate toasts
        error.toastShown = true;
        
        // Auto-dismiss after showing toast for non-critical errors
        if (error.severity !== ERROR_SEVERITY.CRITICAL && error.autoRemove) {
          setTimeout(() => {
            dismissError(error.id);
          }, 5000);
        }
      }
    });
  }, [activeErrors, dismissError]);

  return { activeErrors };
}