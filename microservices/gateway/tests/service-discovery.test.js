const request = require('supertest');
const express = require('express');
const ServiceDiscovery = require('../src/services/ServiceDiscovery');

describe('ServiceDiscovery', () => {
  let serviceDiscovery;

  beforeEach(() => {
    serviceDiscovery = new ServiceDiscovery();
  });

  describe('Service Registration', () => {
    test('should register a service successfully', () => {
      const config = {
        name: 'test-service',
        url: 'http://test-service:3001',
        healthPath: '/health',
        weight: 1,
        timeout: 30000
      };

      serviceDiscovery.registerService(config);
      const service = serviceDiscovery.services.get('test-service');

      expect(service).toBeDefined();
      expect(service.name).toBe('test-service');
      expect(service.url).toBe('http://test-service:3001');
      expect(service.status).toBe('unknown');
    });

    test('should get service URL', () => {
      const config = {
        name: 'test-service',
        url: 'http://test-service:3001',
        healthPath: '/health',
        weight: 1,
        timeout: 30000
      };

      serviceDiscovery.registerService(config);
      const url = serviceDiscovery.getServiceUrl('test-service');

      expect(url).toBe('http://test-service:3001');
    });

    test('should throw error for unknown service', () => {
      expect(() => {
        serviceDiscovery.getServiceUrl('unknown-service');
      }).toThrow('Service unknown-service not found in registry');
    });
  });

  describe('Service Configuration', () => {
    test('should get service configuration', () => {
      const config = {
        name: 'test-service',
        url: 'http://test-service:3001',
        healthPath: '/health',
        weight: 1,
        timeout: 30000
      };

      serviceDiscovery.registerService(config);
      const serviceConfig = serviceDiscovery.getServiceConfig('test-service');

      expect(serviceConfig).toEqual({
        url: 'http://test-service:3001',
        timeout: 30000,
        status: 'unknown',
        responseTime: null
      });
    });

    test('should return default config for unknown service', () => {
      const serviceConfig = serviceDiscovery.getServiceConfig('unknown-service');

      expect(serviceConfig).toEqual({
        url: null,
        timeout: 30000,
        status: 'not_found'
      });
    });
  });

  describe('Service Availability', () => {
    test('should consider unknown service as available', () => {
      const config = {
        name: 'test-service',
        url: 'http://test-service:3001',
        healthPath: '/health',
        weight: 1,
        timeout: 30000
      };

      serviceDiscovery.registerService(config);
      const isAvailable = serviceDiscovery.isServiceAvailable('test-service');

      expect(isAvailable).toBe(true);
    });

    test('should consider healthy service as available', () => {
      const config = {
        name: 'test-service',
        url: 'http://test-service:3001',
        healthPath: '/health',
        weight: 1,
        timeout: 30000
      };

      serviceDiscovery.registerService(config);
      const service = serviceDiscovery.services.get('test-service');
      service.status = 'healthy';

      const isAvailable = serviceDiscovery.isServiceAvailable('test-service');
      expect(isAvailable).toBe(true);
    });

    test('should consider service unavailable after max failures', () => {
      const config = {
        name: 'test-service',
        url: 'http://test-service:3001',
        healthPath: '/health',
        weight: 1,
        timeout: 30000
      };

      serviceDiscovery.registerService(config);
      const service = serviceDiscovery.services.get('test-service');
      service.status = 'unhealthy';
      service.consecutiveFailures = 5; // More than maxRetries (3)

      const isAvailable = serviceDiscovery.isServiceAvailable('test-service');
      expect(isAvailable).toBe(false);
    });
  });

  describe('Service Registry', () => {
    test('should return complete service registry', () => {
      const config = {
        name: 'test-service',
        url: 'http://test-service:3001',
        healthPath: '/health',
        weight: 1,
        timeout: 30000
      };

      serviceDiscovery.registerService(config);
      const registry = serviceDiscovery.getServiceRegistry();

      expect(registry).toHaveProperty('test-service');
      expect(registry['test-service']).toHaveProperty('url');
      expect(registry['test-service']).toHaveProperty('status');
      expect(registry['test-service']).toHaveProperty('lastCheck');
    });
  });
});