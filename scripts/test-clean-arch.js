const path = require('path');
const rootDir = path.join(__dirname, '..');

console.log('Clean Architecture 모듈 테스트 시작...\n');

try {
  const PaymentRepository = require(path.join(rootDir, 'app/infrastructure/prisma/PaymentRepository'));
  console.log('✓ PaymentRepository 로드 성공');
} catch (error) {
  console.log('✗ PaymentRepository 로드 실패:', error.message);
}

try {
  const OrderRepository = require(path.join(rootDir, 'app/infrastructure/prisma/OrderRepository'));
  console.log('✓ OrderRepository 로드 성공');
} catch (error) {
  console.log('✗ OrderRepository 로드 실패:', error.message);
}

try {
  const ProcessPayment = require(path.join(rootDir, 'app/application/payments/ProcessPayment'));
  console.log('✓ ProcessPayment use case 로드 성공');
} catch (error) {
  console.log('✗ ProcessPayment use case 로드 실패:', error.message);
}

try {
  const ConfirmPayment = require(path.join(rootDir, 'app/application/payments/ConfirmPayment'));
  console.log('✓ ConfirmPayment use case 로드 성공');
} catch (error) {
  console.log('✗ ConfirmPayment use case 로드 실패:', error.message);
}

try {
  const CancelPayment = require(path.join(rootDir, 'app/application/payments/CancelPayment'));
  console.log('✓ CancelPayment use case 로드 성공');
} catch (error) {
  console.log('✗ CancelPayment use case 로드 실패:', error.message);
}

try {
  const CreateOrder = require(path.join(rootDir, 'app/application/orders/CreateOrder'));
  console.log('✓ CreateOrder use case 로드 성공');
} catch (error) {
  console.log('✗ CreateOrder use case 로드 실패:', error.message);
}

try {
  const GetOrder = require(path.join(rootDir, 'app/application/orders/GetOrder'));
  console.log('✓ GetOrder use case 로드 성공');
} catch (error) {
  console.log('✗ GetOrder use case 로드 실패:', error.message);
}

try {
  const UpdateOrderStatus = require(path.join(rootDir, 'app/application/orders/UpdateOrderStatus'));
  console.log('✓ UpdateOrderStatus use case 로드 성공');
} catch (error) {
  console.log('✗ UpdateOrderStatus use case 로드 실패:', error.message);
}

try {
  const PaymentController = require(path.join(rootDir, 'app/interfaces/http/PaymentController'));
  console.log('✓ PaymentController 로드 성공');
} catch (error) {
  console.log('✗ PaymentController 로드 실패:', error.message);
}

try {
  const OrderController = require(path.join(rootDir, 'app/interfaces/http/OrderController'));
  console.log('✓ OrderController 로드 성공');
} catch (error) {
  console.log('✗ OrderController 로드 실패:', error.message);
}

try {
  const paymentRouter = require(path.join(rootDir, 'app/interfaces/http/paymentRouter'));
  console.log('✓ paymentRouter 로드 성공');
} catch (error) {
  console.log('✗ paymentRouter 로드 실패:', error.message);
}

try {
  const orderRouter = require(path.join(rootDir, 'app/interfaces/http/orderRouter'));
  console.log('✓ orderRouter 로드 성공');
} catch (error) {
  console.log('✗ orderRouter 로드 실패:', error.message);
}

try {
  const CustomerRepository = require(path.join(rootDir, 'app/infrastructure/prisma/CustomerRepository'));
  console.log('✓ CustomerRepository 로드 성공');
} catch (error) {
  console.log('✗ CustomerRepository 로드 실패:', error.message);
}

try {
  const PhoneJoin = require(path.join(rootDir, 'app/application/customers/PhoneJoin'));
  console.log('✓ PhoneJoin use case 로드 성공');
} catch (error) {
  console.log('✗ PhoneJoin use case 로드 실패:', error.message);
}

try {
  const GetCustomerStats = require(path.join(rootDir, 'app/application/customers/GetCustomerStats'));
  console.log('✓ GetCustomerStats use case 로드 성공');
} catch (error) {
  console.log('✗ GetCustomerStats use case 로드 실패:', error.message);
}

try {
  const GetCustomerHistory = require(path.join(rootDir, 'app/application/customers/GetCustomerHistory'));
  console.log('✓ GetCustomerHistory use case 로드 성공');
} catch (error) {
  console.log('✗ GetCustomerHistory use case 로드 실패:', error.message);
}

try {
  const IssueCoupon = require(path.join(rootDir, 'app/application/customers/IssueCoupon'));
  console.log('✓ IssueCoupon use case 로드 성공');
} catch (error) {
  console.log('✗ IssueCoupon use case 로드 실패:', error.message);
}

try {
  const CustomerController = require(path.join(rootDir, 'app/interfaces/http/CustomerController'));
  console.log('✓ CustomerController 로드 성공');
} catch (error) {
  console.log('✗ CustomerController 로드 실패:', error.message);
}

try {
  const customerRouter = require(path.join(rootDir, 'app/interfaces/http/customerRouter'));
  console.log('✓ customerRouter 로드 성공');
} catch (error) {
  console.log('✗ customerRouter 로드 실패:', error.message);
}

try {
  const { createDIContainer } = require(path.join(rootDir, 'app/infrastructure/di/container'));
  const container = createDIContainer();
  console.log('✓ DI Container 생성 성공');
  
  const processPayment = container.resolve('processPayment');
  console.log('✓ ProcessPayment DI 성공');
  
  const confirmPayment = container.resolve('confirmPayment');
  console.log('✓ ConfirmPayment DI 성공');
  
  const cancelPayment = container.resolve('cancelPayment');
  console.log('✓ CancelPayment DI 성공');
  
  const createOrder = container.resolve('createOrder');
  console.log('✓ CreateOrder DI 성공');
  
  const getOrder = container.resolve('getOrder');
  console.log('✓ GetOrder DI 성공');
  
  const updateOrderStatus = container.resolve('updateOrderStatus');
  console.log('✓ UpdateOrderStatus DI 성공');
  
  const phoneJoin = container.resolve('phoneJoin');
  console.log('✓ PhoneJoin DI 성공');
  
  const getCustomerStats = container.resolve('getCustomerStats');
  console.log('✓ GetCustomerStats DI 성공');
  
  const getCustomerHistory = container.resolve('getCustomerHistory');
  console.log('✓ GetCustomerHistory DI 성공');
  
  const issueCoupon = container.resolve('issueCoupon');
  console.log('✓ IssueCoupon DI 성공');
  
} catch (error) {
  console.log('✗ DI Container 테스트 실패:', error.message);
}

console.log('\nClean Architecture 모듈 테스트 완료');
