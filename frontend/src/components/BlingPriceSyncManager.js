import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

/**
 * Bling Price Sync Management Component
 * Provides interface for monitoring and controlling price synchronization
 */
const BlingPriceSyncManager = () => {
  // State management
  const [stats, setStats] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Configuration
  const [settings, setSettings] = useState({
    autoSync: true,
    syncInterval: 5,
    priceThreshold: 1.0,
    enableWebhooks: true
  });

  /**
   * Load initial data
   */
  useEffect(() => {
    loadPriceSyncStats();
    const interval = setInterval(loadPriceSyncStats, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  /**
   * Load price sync statistics
   */
  const loadPriceSyncStats = useCallback(async () => {
    try {
      const response = await axios.get('/api/bling/prices/sync/stats');
      setStats(response.data.data);
      setError(null);
    } catch (error) {
      console.error('Failed to load price sync stats:', error);
      setError('Failed to load sync statistics');
    }
  }, []);

  /**
   * Trigger manual price sync for all products
   */
  const handleSyncAllPrices = async () => {
    try {
      setSyncing(true);
      setError(null);
      setSuccess(null);

      const response = await axios.post('/api/bling/prices/sync');
      
      setSuccess('Price sync completed successfully!');
      await loadPriceSyncStats();
    } catch (error) {
      console.error('Price sync failed:', error);
      setError(error.response?.data?.message || 'Price sync failed');
    } finally {
      setSyncing(false);
    }
  };

  /**
   * Trigger manual price sync for current tenant
   */
  const handleSyncTenantPrices = async () => {
    try {
      setSyncing(true);
      setError(null);
      setSuccess(null);

      const response = await axios.post('/api/bling/prices/sync/tenant');
      
      setSuccess('Tenant price sync completed successfully!');
      await loadPriceSyncStats();
    } catch (error) {
      console.error('Tenant price sync failed:', error);
      setError(error.response?.data?.message || 'Tenant price sync failed');
    } finally {
      setSyncing(false);
    }
  };

  /**
   * Load price history for selected product
   */
  const loadPriceHistory = async (productId) => {
    try {
      setLoading(true);
      const response = await axios.get(`/api/bling/prices/history/${productId}?limit=20`);
      setHistory(response.data.data.history);
      setError(null);
    } catch (error) {
      console.error('Failed to load price history:', error);
      setError('Failed to load price history');
      setHistory([]);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Format price change percentage
   */
  const formatPriceChange = (percentage) => {
    if (!percentage) return 'N/A';
    const sign = percentage > 0 ? '+' : '';
    return `${sign}${percentage.toFixed(2)}%`;
  };

  /**
   * Get price change color class
   */
  const getPriceChangeColor = (percentage) => {
    if (!percentage) return 'text-muted';
    return percentage > 0 ? 'text-success' : 'text-danger';
  };

  return (
    <div className="bling-price-sync-manager">
      <div className="row">
        {/* Header */}
        <div className="col-12">
          <div className="d-flex justify-content-between align-items-center mb-4">
            <h4>
              <i className="fas fa-sync-alt me-2"></i>
              Price Synchronization
            </h4>
            <div className="btn-group">
              <button 
                className="btn btn-primary"
                onClick={handleSyncTenantPrices}
                disabled={syncing}
              >
                {syncing ? (
                  <>
                    <i className="fas fa-spinner fa-spin me-2"></i>
                    Syncing...
                  </>
                ) : (
                  <>
                    <i className="fas fa-sync me-2"></i>
                    Sync My Prices
                  </>
                )}
              </button>
              <button 
                className="btn btn-success"
                onClick={handleSyncAllPrices}
                disabled={syncing}
              >
                <i className="fas fa-sync-alt me-2"></i>
                Sync All
              </button>
            </div>
          </div>

          {/* Alerts */}
          {error && (
            <div className="alert alert-danger alert-dismissible fade show">
              <i className="fas fa-exclamation-triangle me-2"></i>
              {error}
              <button 
                type="button" 
                className="btn-close" 
                onClick={() => setError(null)}
              ></button>
            </div>
          )}

          {success && (
            <div className="alert alert-success alert-dismissible fade show">
              <i className="fas fa-check-circle me-2"></i>
              {success}
              <button 
                type="button" 
                className="btn-close" 
                onClick={() => setSuccess(null)}
              ></button>
            </div>
          )}
        </div>

        {/* Statistics Cards */}
        <div className="col-12">
          <div className="row mb-4">
            <div className="col-md-3">
              <div className="card bg-primary text-white">
                <div className="card-body">
                  <div className="d-flex justify-content-between">
                    <div>
                      <h6 className="card-title">Total Syncs</h6>
                      <h4>{stats?.totalSyncs || 0}</h4>
                    </div>
                    <i className="fas fa-sync fa-2x opacity-75"></i>
                  </div>
                </div>
              </div>
            </div>

            <div className="col-md-3">
              <div className="card bg-success text-white">
                <div className="card-body">
                  <div className="d-flex justify-content-between">
                    <div>
                      <h6 className="card-title">Price Updates</h6>
                      <h4>{stats?.totalPriceUpdates || 0}</h4>
                    </div>
                    <i className="fas fa-tag fa-2x opacity-75"></i>
                  </div>
                </div>
              </div>
            </div>

            <div className="col-md-3">
              <div className="card bg-warning text-white">
                <div className="card-body">
                  <div className="d-flex justify-content-between">
                    <div>
                      <h6 className="card-title">Errors</h6>
                      <h4>{stats?.totalErrors || 0}</h4>
                    </div>
                    <i className="fas fa-exclamation-triangle fa-2x opacity-75"></i>
                  </div>
                </div>
              </div>
            </div>

            <div className="col-md-3">
              <div className="card bg-info text-white">
                <div className="card-body">
                  <div className="d-flex justify-content-between">
                    <div>
                      <h6 className="card-title">Avg Sync Time</h6>
                      <h4>{stats?.averageSyncTime ? `${Math.round(stats.averageSyncTime)}ms` : 'N/A'}</h4>
                    </div>
                    <i className="fas fa-clock fa-2x opacity-75"></i>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Current Status */}
        <div className="col-md-6">
          <div className="card">
            <div className="card-header">
              <h5 className="card-title mb-0">
                <i className="fas fa-info-circle me-2"></i>
                Current Status
              </h5>
            </div>
            <div className="card-body">
              {stats && (
                <div>
                  <div className="row mb-3">
                    <div className="col-sm-4">
                      <strong>Sync Status:</strong>
                    </div>
                    <div className="col-sm-8">
                      {stats.current_state?.syncInProgress ? (
                        <span className="badge bg-warning">
                          <i className="fas fa-spinner fa-spin me-1"></i>
                          In Progress
                        </span>
                      ) : (
                        <span className="badge bg-success">
                          <i className="fas fa-check me-1"></i>
                          Ready
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="row mb-3">
                    <div className="col-sm-4">
                      <strong>Last Sync:</strong>
                    </div>
                    <div className="col-sm-8">
                      {stats.lastSync ? 
                        new Date(stats.lastSync).toLocaleString() : 
                        'Never'
                      }
                    </div>
                  </div>

                  <div className="row mb-3">
                    <div className="col-sm-4">
                      <strong>Auto Sync:</strong>
                    </div>
                    <div className="col-sm-8">
                      {stats.config?.real_time_sync_enabled ? (
                        <span className="badge bg-success">Enabled</span>
                      ) : (
                        <span className="badge bg-secondary">Disabled</span>
                      )}
                    </div>
                  </div>

                  <div className="row mb-3">
                    <div className="col-sm-4">
                      <strong>Sync Interval:</strong>
                    </div>
                    <div className="col-sm-8">
                      {stats.config?.sync_interval_ms ? 
                        `${Math.round(stats.config.sync_interval_ms / 60000)} minutes` : 
                        'N/A'
                      }
                    </div>
                  </div>

                  <div className="row">
                    <div className="col-sm-4">
                      <strong>Price Threshold:</strong>
                    </div>
                    <div className="col-sm-8">
                      {stats.config?.price_tolerance_percent || 1}%
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Price History */}
        <div className="col-md-6">
          <div className="card">
            <div className="card-header">
              <h5 className="card-title mb-0">
                <i className="fas fa-history me-2"></i>
                Price History
              </h5>
            </div>
            <div className="card-body">
              <div className="mb-3">
                <input
                  type="text"
                  className="form-control"
                  placeholder="Enter Product ID to view history"
                  value={selectedProduct}
                  onChange={(e) => setSelectedProduct(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && selectedProduct) {
                      loadPriceHistory(selectedProduct);
                    }
                  }}
                />
              </div>

              {loading && (
                <div className="text-center">
                  <i className="fas fa-spinner fa-spin"></i> Loading...
                </div>
              )}

              {history.length > 0 && (
                <div className="table-responsive">
                  <table className="table table-sm">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Old Price</th>
                        <th>New Price</th>
                        <th>Change</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((record, index) => (
                        <tr key={index}>
                          <td>{new Date(record.created_at).toLocaleDateString()}</td>
                          <td>
                            {record.old_price ? `$${record.old_price}` : 'N/A'}
                          </td>
                          <td>${record.new_price}</td>
                          <td className={getPriceChangeColor(record.price_change_percent)}>
                            {formatPriceChange(record.price_change_percent)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {!loading && selectedProduct && history.length === 0 && (
                <div className="text-muted text-center">
                  No price history found for this product
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BlingPriceSyncManager;