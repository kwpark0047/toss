const path = require('path');
const fs = require('fs');

describe('Clean Architecture Modules', () => {
  const projectRoot = path.join(__dirname, '..', '..', '..');

  const interfaces = [
    'app/domain/interfaces/IMonitoringRepository.js',
    'app/domain/interfaces/IOrderRepository.js',
    'app/domain/interfaces/IPaymentRepository.js',
    'app/domain/interfaces/IStoreRepository.js',
    'app/domain/interfaces/ICustomerRepository.js',
  ];

  const models = [
    'app/domain/models/Payment.js',
    'app/domain/models/Customer.js',
  ];

  const useCases = [
    'app/application/monitoring/GetSystemStats.js',
    'app/application/monitoring/GetErrorSummary.js',
    'app/application/orders/CreateOrder.js',
    'app/application/orders/GetOrder.js',
    'app/application/orders/UpdateOrderStatus.js',
    'app/application/payments/ProcessPayment.js',
    'app/application/payments/ConfirmPayment.js',
    'app/application/payments/CancelPayment.js',
    'app/application/stores/SearchStores.js',
    'app/application/stores/GetStore.js',
    'app/application/stores/CreateStore.js',
    'app/application/customers/PhoneJoin.js',
    'app/application/customers/GetCustomerStats.js',
    'app/application/customers/GetCustomerHistory.js',
    'app/application/customers/IssueCoupon.js',
  ];

  const repositories = [
    'app/infrastructure/prisma/MonitoringRepository.js',
    'app/infrastructure/prisma/OrderRepository.js',
    'app/infrastructure/prisma/PaymentRepository.js',
    'app/infrastructure/prisma/StoreRepository.js',
    'app/infrastructure/prisma/CustomerRepository.js',
  ];

  const controllers = [
    'app/interfaces/http/PaymentController.js',
    'app/interfaces/http/OrderController.js',
    'app/interfaces/http/StoreController.js',
    'app/interfaces/http/CustomerController.js',
  ];

  const routers = [
    'app/interfaces/http/paymentRouter.js',
    'app/interfaces/http/orderRouter.js',
    'app/interfaces/http/storeRouter.js',
    'app/interfaces/http/customerRouter.js',
  ];

  const diContainer = 'app/infrastructure/di/container.js';

  it('interfaces exist', () => {
    interfaces.forEach((file) => {
      expect(fs.existsSync(path.join(projectRoot, file))).toBe(true);
    });
  });

  it('domain models exist', () => {
    models.forEach((file) => {
      expect(fs.existsSync(path.join(projectRoot, file))).toBe(true);
    });
  });

  it('use cases exist', () => {
    useCases.forEach((file) => {
      expect(fs.existsSync(path.join(projectRoot, file))).toBe(true);
    });
  });

  it('repositories exist', () => {
    repositories.forEach((file) => {
      expect(fs.existsSync(path.join(projectRoot, file))).toBe(true);
    });
  });

  it('controllers exist', () => {
    controllers.forEach((file) => {
      expect(fs.existsSync(path.join(projectRoot, file))).toBe(true);
    });
  });

  it('routers exist', () => {
    routers.forEach((file) => {
      expect(fs.existsSync(path.join(projectRoot, file))).toBe(true);
    });
  });

  it('DI container exists', () => {
    expect(fs.existsSync(path.join(projectRoot, diContainer))).toBe(true);
  });

  it('DI container resolves all 15 use cases', () => {
    const { createDIContainer } = require(path.join(projectRoot, diContainer));
    const container = createDIContainer();

    const expectedUseCases = [
      'getSystemStats', 'getErrorSummary',
      'createOrder', 'getOrder', 'updateOrderStatus',
      'processPayment', 'confirmPayment', 'cancelPayment',
      'searchStores', 'getStore', 'createStore',
      'phoneJoin', 'getCustomerStats', 'getCustomerHistory', 'issueCoupon',
    ];

    expectedUseCases.forEach((name) => {
      const uc = container.resolve(name);
      expect(uc).toBeDefined();
    });
  });

  it('DI container resolves all 5 repositories', () => {
    const { createDIContainer } = require(path.join(projectRoot, diContainer));
    const container = createDIContainer();

    const expectedRepos = [
      'monitoringRepository', 'orderRepository', 'paymentRepository',
      'storeRepository', 'customerRepository',
    ];

    expectedRepos.forEach((name) => {
      const repo = container.resolve(name);
      expect(repo).toBeDefined();
    });
  });
});
