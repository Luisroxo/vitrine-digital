import { useState, useEffect, useCallback, useRef } from 'react';
import apiClient from '../services/APIClient';

/**
 * Custom hook for API interactions with loading states and error handling
 */
export function useAPI() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const abortControllerRef = useRef(null);

  // Generic API call wrapper
  const execute = useCallback(async (apiCall, options = {}) => {
    try {
      setLoading(true);
      setError(null);

      // Create abort controller for request cancellation
      abortControllerRef.current = new AbortController();

      const result = await apiCall();
      
      if (options.onSuccess) {
        options.onSuccess(result);
      }

      return result;
    } catch (err) {
      const formattedError = {
        message: err.message || 'An error occurred',
        type: err.type || 'UNKNOWN_ERROR',
        status: err.status,
        code: err.code
      };

      setError(formattedError);

      if (options.onError) {
        options.onError(formattedError);
      }

      throw formattedError;
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  }, []);

  // Cancel ongoing requests
  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancel();
    };
  }, [cancel]);

  return {
    loading,
    error,
    execute,
    cancel,
    clearError: () => setError(null)
  };
}

/**
 * Hook for authentication operations
 */
export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(apiClient.isAuthenticated());
  const [user, setUser] = useState(null);
  const [tenantId, setTenantId] = useState(apiClient.getTenantId());
  const { execute, loading, error } = useAPI();

  // Listen for auth events
  useEffect(() => {
    const handleLogin = (event) => {
      setIsAuthenticated(true);
      setUser(event.detail.user);
      setTenantId(event.detail.tenantId);
    };

    const handleLogout = () => {
      setIsAuthenticated(false);
      setUser(null);
      setTenantId(null);
    };

    window.addEventListener('auth:login', handleLogin);
    window.addEventListener('auth:logout', handleLogout);

    return () => {
      window.removeEventListener('auth:login', handleLogin);
      window.removeEventListener('auth:logout', handleLogout);
    };
  }, []);

  const login = useCallback(async (credentials) => {
    return execute(() => apiClient.login(credentials));
  }, [execute]);

  const register = useCallback(async (userData) => {
    return execute(() => apiClient.register(userData));
  }, [execute]);

  const logout = useCallback(async () => {
    return execute(() => apiClient.logout());
  }, [execute]);

  return {
    isAuthenticated,
    user,
    tenantId,
    loading,
    error,
    login,
    register,
    logout
  };
}

/**
 * Hook for product operations
 */
export function useProducts() {
  const [products, setProducts] = useState([]);
  const [totalProducts, setTotalProducts] = useState(0);
  const { execute, loading, error } = useAPI();

  const getProducts = useCallback(async (filters = {}) => {
    return execute(async () => {
      const result = await apiClient.getProducts(filters);
      if (result.success) {
        setProducts(result.products);
        setTotalProducts(result.total);
      }
      return result;
    });
  }, [execute]);

  const getProduct = useCallback(async (productId) => {
    return execute(() => apiClient.getProduct(productId));
  }, [execute]);

  const createProduct = useCallback(async (productData) => {
    return execute(async () => {
      const result = await apiClient.createProduct(productData);
      if (result.success) {
        // Refresh products list
        await getProducts();
      }
      return result;
    });
  }, [execute, getProducts]);

  const updateProduct = useCallback(async (productId, productData) => {
    return execute(async () => {
      const result = await apiClient.updateProduct(productId, productData);
      if (result.success) {
        // Update product in local state
        setProducts(prev => prev.map(p => 
          p.id === productId ? { ...p, ...result.product } : p
        ));
      }
      return result;
    });
  }, [execute]);

  const deleteProduct = useCallback(async (productId) => {
    return execute(async () => {
      const result = await apiClient.deleteProduct(productId);
      if (result.success) {
        // Remove product from local state
        setProducts(prev => prev.filter(p => p.id !== productId));
        setTotalProducts(prev => prev - 1);
      }
      return result;
    });
  }, [execute]);

  const searchProducts = useCallback(async (query, filters = {}) => {
    return execute(async () => {
      const result = await apiClient.searchProducts(query, filters);
      if (result.success) {
        setProducts(result.products);
        setTotalProducts(result.total);
      }
      return result;
    });
  }, [execute]);

  return {
    products,
    totalProducts,
    loading,
    error,
    getProducts,
    getProduct,
    createProduct,
    updateProduct,
    deleteProduct,
    searchProducts
  };
}

/**
 * Hook for Bling integration
 */
export function useBling() {
  const [status, setStatus] = useState(null);
  const [orders, setOrders] = useState([]);
  const { execute, loading, error } = useAPI();

  const getStatus = useCallback(async () => {
    return execute(async () => {
      const result = await apiClient.getBlingStatus();
      if (result.success) {
        setStatus(result.status);
      }
      return result;
    });
  }, [execute]);

  const initiateAuth = useCallback(async () => {
    return execute(() => apiClient.initiateBlingAuth());
  }, [execute]);

  const completeAuth = useCallback(async (code, state) => {
    return execute(async () => {
      const result = await apiClient.completeBlingAuth(code, state);
      if (result.success) {
        setStatus(result.status);
      }
      return result;
    });
  }, [execute]);

  const syncProducts = useCallback(async (options = {}) => {
    return execute(() => apiClient.syncBlingProducts(options));
  }, [execute]);

  const getOrders = useCallback(async (filters = {}) => {
    return execute(async () => {
      const result = await apiClient.getBlingOrders(filters);
      if (result.success) {
        setOrders(result.orders);
      }
      return result;
    });
  }, [execute]);

  const createOrder = useCallback(async (orderData) => {
    return execute(async () => {
      const result = await apiClient.createBlingOrder(orderData);
      if (result.success) {
        // Refresh orders list
        await getOrders();
      }
      return result;
    });
  }, [execute, getOrders]);

  return {
    status,
    orders,
    loading,
    error,
    getStatus,
    initiateAuth,
    completeAuth,
    syncProducts,
    getOrders,
    createOrder
  };
}

/**
 * Hook for billing operations
 */
export function useBilling() {
  const [creditBalance, setCreditBalance] = useState(0);
  const [subscription, setSubscription] = useState(null);
  const [plans, setPlans] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const { execute, loading, error } = useAPI();

  const getCreditBalance = useCallback(async () => {
    return execute(async () => {
      const result = await apiClient.getCreditBalance();
      if (result.success) {
        setCreditBalance(result.balance);
      }
      return result;
    });
  }, [execute]);

  const purchaseCredits = useCallback(async (amount, paymentMethod, paymentData = {}) => {
    return execute(async () => {
      const result = await apiClient.purchaseCredits(amount, paymentMethod, paymentData);
      if (result.success) {
        // Refresh credit balance
        await getCreditBalance();
      }
      return result;
    });
  }, [execute, getCreditBalance]);

  const getCreditTransactions = useCallback(async (limit = 50, offset = 0) => {
    return execute(async () => {
      const result = await apiClient.getCreditTransactions(limit, offset);
      if (result.success) {
        setTransactions(result.transactions);
      }
      return result;
    });
  }, [execute]);

  const getSubscriptionPlans = useCallback(async () => {
    return execute(async () => {
      const result = await apiClient.getSubscriptionPlans();
      if (result.success) {
        setPlans(result.plans);
      }
      return result;
    });
  }, [execute]);

  const getSubscription = useCallback(async () => {
    return execute(async () => {
      const result = await apiClient.getSubscription();
      if (result.success) {
        setSubscription(result.subscription);
      }
      return result;
    });
  }, [execute]);

  const createSubscription = useCallback(async (planId, paymentData = {}) => {
    return execute(async () => {
      const result = await apiClient.createSubscription(planId, paymentData);
      if (result.success) {
        setSubscription(result.subscription);
      }
      return result;
    });
  }, [execute]);

  const changePlan = useCallback(async (subscriptionId, newPlanId, options = {}) => {
    return execute(async () => {
      const result = await apiClient.changePlan(subscriptionId, newPlanId, options);
      if (result.success) {
        // Refresh subscription
        await getSubscription();
      }
      return result;
    });
  }, [execute, getSubscription]);

  const cancelSubscription = useCallback(async (subscriptionId, options = {}) => {
    return execute(async () => {
      const result = await apiClient.cancelSubscription(subscriptionId, options);
      if (result.success) {
        // Refresh subscription
        await getSubscription();
      }
      return result;
    });
  }, [execute, getSubscription]);

  const getRevenueAnalytics = useCallback(async (period = '30d', includeForecasts = true) => {
    return execute(() => apiClient.getRevenueAnalytics(period, includeForecasts));
  }, [execute]);

  const getDashboard = useCallback(async () => {
    return execute(() => apiClient.getDashboard());
  }, [execute]);

  return {
    creditBalance,
    subscription,
    plans,
    transactions,
    loading,
    error,
    getCreditBalance,
    purchaseCredits,
    getCreditTransactions,
    getSubscriptionPlans,
    getSubscription,
    createSubscription,
    changePlan,
    cancelSubscription,
    getRevenueAnalytics,
    getDashboard
  };
}

/**
 * Hook for system monitoring
 */
export function useSystem() {
  const [health, setHealth] = useState(null);
  const [stats, setStats] = useState(null);
  const { execute, loading, error } = useAPI();

  const getHealth = useCallback(async () => {
    return execute(async () => {
      const result = await apiClient.getSystemHealth();
      setHealth(result);
      return result;
    });
  }, [execute]);

  const getStats = useCallback(async () => {
    return execute(async () => {
      const result = await apiClient.getSystemStats();
      if (result.success) {
        setStats(result.stats);
      }
      return result;
    });
  }, [execute]);

  return {
    health,
    stats,
    loading,
    error,
    getHealth,
    getStats
  };
}

/**
 * Hook for real-time connections
 */
export function useRealtime(options = {}) {
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState([]);
  
  useEffect(() => {
    apiClient.connect({
      onConnect: () => {
        setConnected(true);
        options.onConnect?.();
      },
      onDisconnect: () => {
        setConnected(false);
        options.onDisconnect?.();
      },
      onMessage: (message) => {
        setMessages(prev => [...prev, message]);
        options.onMessage?.(message);
      },
      onError: (error) => {
        options.onError?.(error);
      }
    });

    return () => {
      apiClient.disconnect();
    };
  }, []);

  const sendMessage = useCallback((message) => {
    apiClient.send(message);
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return {
    connected,
    messages,
    sendMessage,
    clearMessages
  };
}

/**
 * Hook for file uploads
 */
export function useFileUpload() {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);

  const upload = useCallback(async (file, type = 'product-image', options = {}) => {
    try {
      setUploading(true);
      setError(null);
      setProgress(0);

      const result = await apiClient.uploadFile(file, type, {
        ...options,
        onProgress: (progressEvent) => {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          setProgress(percentCompleted);
          options.onProgress?.(percentCompleted);
        }
      });

      setProgress(100);
      return result;
    } catch (err) {
      const formattedError = {
        message: err.message || 'Upload failed',
        type: err.type || 'UPLOAD_ERROR'
      };
      setError(formattedError);
      throw formattedError;
    } finally {
      setUploading(false);
    }
  }, []);

  return {
    uploading,
    progress,
    error,
    upload,
    clearError: () => setError(null)
  };
}

/**
 * Hook for batch operations
 */
export function useBatch() {
  const { execute, loading, error } = useAPI();

  const executeBatch = useCallback(async (requests) => {
    return execute(() => apiClient.batch(requests));
  }, [execute]);

  return {
    loading,
    error,
    executeBatch
  };
}