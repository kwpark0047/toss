const { createContainer, asClass, asValue } = require('awilix');

const IMonitoringRepository = require('../../domain/interfaces/IMonitoringRepository');
const IOrderRepository = require('../../domain/interfaces/IOrderRepository');
const IPaymentRepository = require('../../domain/interfaces/IPaymentRepository');
const IStoreRepository = require('../../domain/interfaces/IStoreRepository');
const ICustomerRepository = require('../../domain/interfaces/ICustomerRepository');

const MonitoringRepository = require('../prisma/MonitoringRepository');
const OrderRepository = require('../prisma/OrderRepository');
const PaymentRepository = require('../prisma/PaymentRepository');
const StoreRepository = require('../prisma/StoreRepository');
const CustomerRepository = require('../prisma/CustomerRepository');
const Point = require('../../../repositories/Point');
const StoreTier = require('../../../repositories/StoreTier');

const GetSystemStats = require('../../application/monitoring/GetSystemStats');
const GetErrorSummary = require('../../application/monitoring/GetErrorSummary');
const CreateOrder = require('../../application/orders/CreateOrder');
const GetOrder = require('../../application/orders/GetOrder');
const UpdateOrderStatus = require('../../application/orders/UpdateOrderStatus');
const ProcessPayment = require('../../application/payments/ProcessPayment');
const ConfirmPayment = require('../../application/payments/ConfirmPayment');
const CancelPayment = require('../../application/payments/CancelPayment');
const SearchStores = require('../../application/stores/SearchStores');
const GetStore = require('../../application/stores/GetStore');
const CreateStore = require('../../application/stores/CreateStore');
const PhoneJoin = require('../../application/customers/PhoneJoin');
const GetCustomerStats = require('../../application/customers/GetCustomerStats');
const GetCustomerHistory = require('../../application/customers/GetCustomerHistory');
const IssueCoupon = require('../../application/customers/IssueCoupon');

function createDIContainer() {
  const container = createContainer({
    injectionMode: 'PROXY',
  });

  container.register({
    monitoringRepository: asValue(MonitoringRepository),
    orderRepository: asValue(OrderRepository),
    paymentRepository: asValue(PaymentRepository),
    storeRepository: asValue(StoreRepository),
    customerRepository: asValue(CustomerRepository),
    pointService: asValue(Point),
    storeTierService: asValue(StoreTier),
  });

  container.register({
    getSystemStats: asClass(GetSystemStats).singleton(),
    getErrorSummary: asClass(GetErrorSummary).singleton(),
    createOrder: asClass(CreateOrder).singleton(),
    getOrder: asClass(GetOrder).singleton(),
    updateOrderStatus: asClass(UpdateOrderStatus).singleton(),
    processPayment: asClass(ProcessPayment).singleton(),
    confirmPayment: asClass(ConfirmPayment).singleton(),
    cancelPayment: asClass(CancelPayment).singleton(),
    searchStores: asClass(SearchStores).singleton(),
    getStore: asClass(GetStore).singleton(),
    createStore: asClass(CreateStore).singleton(),
    phoneJoin: asClass(PhoneJoin).singleton(),
    getCustomerStats: asClass(GetCustomerStats).singleton(),
    getCustomerHistory: asClass(GetCustomerHistory).singleton(),
    issueCoupon: asClass(IssueCoupon).singleton(),
  });

  container.register({
    IMonitoringRepository: asValue(IMonitoringRepository),
    IOrderRepository: asValue(IOrderRepository),
    IPaymentRepository: asValue(IPaymentRepository),
    IStoreRepository: asValue(IStoreRepository),
    ICustomerRepository: asValue(ICustomerRepository),
  });

  return container;
}

function diMiddleware(container) {
  return (req, res, next) => {
    req.container = container.createScope();
    next();
  };
}

module.exports = {
  createDIContainer,
  diMiddleware,
};
