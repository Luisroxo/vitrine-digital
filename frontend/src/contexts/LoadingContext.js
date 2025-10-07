import React, { createContext, useContext, useReducer, useCallback } from 'react';

/**
 * Loading types and states
 */
export const LOADING_TYPES = {
  PAGE: 'page',
  COMPONENT: 'component',
  BUTTON: 'button',
  FORM: 'form',
  API: 'api',
  UPLOAD: 'upload'
};

/**
 * Loading reducer
 */
function loadingReducer(state, action) {
  switch (action.type) {
    case 'START_LOADING':
      return {
        ...state,
        [action.payload.key]: {
          isLoading: true,
          type: action.payload.loadingType,
          message: action.payload.message,
          progress: action.payload.progress || 0,
          startTime: Date.now(),
          cancelable: action.payload.cancelable || false,
          onCancel: action.payload.onCancel
        }
      };

    case 'UPDATE_PROGRESS':
      return {
        ...state,
        [action.payload.key]: state[action.payload.key] ? {
          ...state[action.payload.key],
          progress: action.payload.progress,
          message: action.payload.message || state[action.payload.key].message
        } : state[action.payload.key]
      };

    case 'STOP_LOADING':
      const newState = { ...state };
      delete newState[action.payload.key];
      return newState;

    case 'CLEAR_ALL':
      return {};

    default:
      return state;
  }
}

/**
 * Loading context
 */
const LoadingContext = createContext();

/**
 * Loading provider component
 */
export function LoadingProvider({ children }) {
  const [state, dispatch] = useReducer(loadingReducer, {});

  // Start loading
  const startLoading = useCallback((key, options = {}) => {
    dispatch({
      type: 'START_LOADING',
      payload: {
        key,
        loadingType: options.type || LOADING_TYPES.API,
        message: options.message || 'Carregando...',
        progress: options.progress || 0,
        cancelable: options.cancelable || false,
        onCancel: options.onCancel
      }
    });
  }, []);

  // Update loading progress
  const updateProgress = useCallback((key, progress, message) => {
    dispatch({
      type: 'UPDATE_PROGRESS',
      payload: { key, progress, message }
    });
  }, []);

  // Stop loading
  const stopLoading = useCallback((key) => {
    dispatch({
      type: 'STOP_LOADING',
      payload: { key }
    });
  }, []);

  // Clear all loading states
  const clearAll = useCallback(() => {
    dispatch({ type: 'CLEAR_ALL' });
  }, []);

  // Check if specific key is loading
  const isLoading = useCallback((key) => {
    return state[key]?.isLoading || false;
  }, [state]);

  // Check if any loading is active
  const isAnyLoading = useCallback(() => {
    return Object.keys(state).length > 0;
  }, [state]);

  // Get loading state for key
  const getLoadingState = useCallback((key) => {
    return state[key] || null;
  }, [state]);

  // Get all loading states
  const getAllLoadingStates = useCallback(() => {
    return state;
  }, [state]);

  // Get loading states by type
  const getLoadingStatesByType = useCallback((type) => {
    return Object.entries(state)
      .filter(([, loadingState]) => loadingState.type === type)
      .reduce((acc, [key, loadingState]) => {
        acc[key] = loadingState;
        return acc;
      }, {});
  }, [state]);

  const value = {
    loadingStates: state,
    startLoading,
    updateProgress,
    stopLoading,
    clearAll,
    isLoading,
    isAnyLoading,
    getLoadingState,
    getAllLoadingStates,
    getLoadingStatesByType
  };

  return (
    <LoadingContext.Provider value={value}>
      {children}
    </LoadingContext.Provider>
  );
}

/**
 * Hook to use loading context
 */
export function useLoading() {
  const context = useContext(LoadingContext);
  
  if (!context) {
    throw new Error('useLoading must be used within a LoadingProvider');
  }
  
  return context;
}

/**
 * Hook for specific loading key
 */
export function useLoadingState(key) {
  const { isLoading, getLoadingState, startLoading, stopLoading, updateProgress } = useLoading();

  const loadingState = getLoadingState(key);
  const loading = isLoading(key);

  const start = useCallback((options = {}) => {
    startLoading(key, options);
  }, [key, startLoading]);

  const stop = useCallback(() => {
    stopLoading(key);
  }, [key, stopLoading]);

  const setProgress = useCallback((progress, message) => {
    updateProgress(key, progress, message);
  }, [key, updateProgress]);

  return {
    loading,
    loadingState,
    start,
    stop,
    setProgress
  };
}

/**
 * HOC for automatic loading states
 */
export function withLoading(WrappedComponent, loadingKey) {
  return function WithLoadingComponent(props) {
    const { start, stop, setProgress, loading, loadingState } = useLoadingState(
      loadingKey || props.loadingKey || 'component'
    );

    const enhancedProps = {
      ...props,
      loading,
      loadingState,
      startLoading: start,
      stopLoading: stop,
      setProgress
    };

    return <WrappedComponent {...enhancedProps} />;
  };
}

/**
 * Loading wrapper component
 */
export function LoadingWrapper({ 
  children, 
  loading, 
  loadingKey,
  fallback = null,
  type = LOADING_TYPES.COMPONENT,
  message = 'Carregando...',
  showProgress = false,
  overlay = false,
  className = ''
}) {
  const { isLoading: contextLoading, getLoadingState } = useLoading();
  
  const isCurrentlyLoading = loadingKey ? contextLoading(loadingKey) : loading;
  const loadingState = loadingKey ? getLoadingState(loadingKey) : null;

  if (!isCurrentlyLoading) {
    return children;
  }

  // Custom fallback component
  if (fallback) {
    return fallback;
  }

  // Default loading UI based on type
  const loadingContent = (
    <div className={`loading-container loading-${type} ${className}`}>
      <LoadingSpinner type={type} />
      {(message || loadingState?.message) && (
        <div className="loading-message">
          {loadingState?.message || message}
        </div>
      )}
      {showProgress && loadingState?.progress !== undefined && (
        <div className="loading-progress">
          <div className="progress">
            <div 
              className="progress-bar" 
              style={{ width: `${loadingState.progress}%` }}
            />
          </div>
          <span className="progress-text">{loadingState.progress}%</span>
        </div>
      )}
      {loadingState?.cancelable && loadingState?.onCancel && (
        <button 
          className="btn btn-outline-secondary btn-sm mt-2"
          onClick={loadingState.onCancel}
        >
          Cancelar
        </button>
      )}
    </div>
  );

  // Overlay mode
  if (overlay) {
    return (
      <div className="position-relative">
        {children}
        <div className="loading-overlay">
          {loadingContent}
        </div>
      </div>
    );
  }

  // Replace mode
  return loadingContent;
}

/**
 * Loading spinner component
 */
export function LoadingSpinner({ type = LOADING_TYPES.COMPONENT, size = 'md' }) {
  const getSizeClass = () => {
    switch (size) {
      case 'sm': return 'spinner-sm';
      case 'lg': return 'spinner-lg';
      default: return '';
    }
  };

  const getSpinnerType = () => {
    switch (type) {
      case LOADING_TYPES.PAGE:
        return 'spinner-border';
      case LOADING_TYPES.BUTTON:
        return 'spinner-border spinner-border-sm';
      case LOADING_TYPES.UPLOAD:
        return 'spinner-grow';
      default:
        return 'spinner-border';
    }
  };

  return (
    <div className={`${getSpinnerType()} ${getSizeClass()}`} role="status">
      <span className="visually-hidden">Carregando...</span>
    </div>
  );
}

/**
 * Loading button component
 */
export function LoadingButton({ 
  children, 
  loading, 
  loadingText = 'Carregando...', 
  disabled = false,
  onClick,
  className = '',
  ...props 
}) {
  const { startLoading, stopLoading, isLoading } = useLoadingState('button');
  const isCurrentlyLoading = loading !== undefined ? loading : isLoading('button');

  const handleClick = async (event) => {
    if (onClick && !isCurrentlyLoading && !disabled) {
      try {
        if (loading === undefined) {
          startLoading({ type: LOADING_TYPES.BUTTON });
        }
        await onClick(event);
      } finally {
        if (loading === undefined) {
          stopLoading();
        }
      }
    }
  };

  return (
    <button
      {...props}
      className={`btn ${className}`}
      onClick={handleClick}
      disabled={disabled || isCurrentlyLoading}
    >
      {isCurrentlyLoading && (
        <LoadingSpinner type={LOADING_TYPES.BUTTON} size="sm" />
      )}
      {isCurrentlyLoading ? (
        <span className="ms-2">{loadingText}</span>
      ) : (
        children
      )}
    </button>
  );
}

/**
 * Page loading component
 */
export function PageLoader({ message = 'Carregando página...', progress }) {
  return (
    <div className="page-loader">
      <div className="d-flex flex-column align-items-center justify-content-center min-vh-100">
        <LoadingSpinner type={LOADING_TYPES.PAGE} size="lg" />
        <div className="mt-3 text-muted">{message}</div>
        {progress !== undefined && (
          <div className="mt-3" style={{ width: '300px' }}>
            <div className="progress">
              <div 
                className="progress-bar" 
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="text-center mt-1 small">{progress}%</div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Skeleton loader component
 */
export function SkeletonLoader({ 
  lines = 3, 
  height = '1rem', 
  className = '',
  animated = true 
}) {
  return (
    <div className={`skeleton-loader ${className}`}>
      {Array.from({ length: lines }).map((_, index) => (
        <div
          key={index}
          className={`skeleton-line ${animated ? 'skeleton-animated' : ''}`}
          style={{ 
            height,
            marginBottom: index < lines - 1 ? '0.5rem' : '0',
            width: index === lines - 1 ? '60%' : '100%'
          }}
        />
      ))}
    </div>
  );
}

/**
 * Card skeleton loader
 */
export function CardSkeleton({ showImage = true, lines = 3 }) {
  return (
    <div className="card">
      <div className="card-body">
        {showImage && (
          <div className="skeleton-line skeleton-animated mb-3" style={{ height: '200px' }} />
        )}
        <SkeletonLoader lines={lines} />
      </div>
    </div>
  );
}

/**
 * Table skeleton loader
 */
export function TableSkeleton({ rows = 5, columns = 4 }) {
  return (
    <div className="table-responsive">
      <table className="table">
        <thead>
          <tr>
            {Array.from({ length: columns }).map((_, index) => (
              <th key={index}>
                <div className="skeleton-line skeleton-animated" style={{ height: '1rem' }} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <tr key={rowIndex}>
              {Array.from({ length: columns }).map((_, colIndex) => (
                <td key={colIndex}>
                  <div className="skeleton-line skeleton-animated" style={{ height: '1rem' }} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Async component wrapper with loading states
 */
export function AsyncComponent({ 
  asyncFunction, 
  loadingKey,
  dependencies = [],
  fallback = null,
  errorFallback = null,
  children 
}) {
  const [data, setData] = React.useState(null);
  const [error, setError] = React.useState(null);
  const { start, stop, loading } = useLoadingState(loadingKey || 'async-component');

  React.useEffect(() => {
    let mounted = true;

    const loadData = async () => {
      try {
        start({ message: 'Carregando dados...' });
        setError(null);
        
        const result = await asyncFunction();
        
        if (mounted) {
          setData(result);
        }
      } catch (err) {
        if (mounted) {
          setError(err);
        }
      } finally {
        if (mounted) {
          stop();
        }
      }
    };

    loadData();

    return () => {
      mounted = false;
    };
  }, dependencies);

  if (loading) {
    return fallback || <LoadingSpinner />;
  }

  if (error) {
    return errorFallback || <div className="alert alert-danger">Erro: {error.message}</div>;
  }

  if (!data) {
    return null;
  }

  return typeof children === 'function' ? children(data) : children;
}