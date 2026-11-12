const PRIVATE_FIELDS = [
  'customer_name',
  'customer_phone',
  'customer_fcm_token',
  'toss_user_key',
  'delivery_address',
  'delivery_memo',
  'notes',
];
function cleanOrder(body, fixture) {
  if (!body || PRIVATE_FIELDS.some((key) => body[key])) throw Error('PERSONAL_DATA_NOT_ALLOWED');
  const allowed = ['store_id', 'items', 'total_amount', 'payment_method', 'order_type'];
  if (Object.keys(body).some((key) => !allowed.includes(key)))
    throw Error('UNSUPPORTED_ORDER_FIELD');
  if (Number(body.store_id) !== fixture.storeId || body.payment_method !== 'cash')
    throw Error('CASH_TEST_STORE_ONLY');
  if (!['dine_in', 'takeout'].includes(body.order_type)) throw Error('TEST_ORDER_TYPE_ONLY');
  if (!Array.isArray(body.items) || body.items.length !== 1) throw Error('ONE_TEST_PRODUCT_ONLY');
  const item = body.items[0],
    quantity = Number(item.quantity);
  if (
    Number(item.product_id) !== fixture.productId ||
    !Number.isSafeInteger(quantity) ||
    quantity < 1 ||
    quantity > 2
  )
    throw Error('TEST_PRODUCT_ONLY');
  if (
    Object.keys(item.options || {}).length ||
    (item.product_name && item.product_name !== fixture.productName)
  )
    throw Error('CUSTOM_TEXT_NOT_ALLOWED');
  const total = fixture.price * quantity;
  if (
    Number(item.price) !== fixture.price ||
    Number(item.subtotal) !== total ||
    Number(body.total_amount) !== total
  )
    throw Error('TEST_AMOUNT_MISMATCH');
  return {
    store_id: fixture.storeId,
    order_type: body.order_type,
    payment_method: 'cash',
    total_amount: total,
    items: [
      {
        product_id: fixture.productId,
        product_name: fixture.productName,
        price: fixture.price,
        quantity,
        subtotal: total,
        options: [],
      },
    ],
  };
}
function allowRead(path, fixture) {
  const id = fixture.storeId;
  return (
    [
      '/api/orders/push/config',
      '/api/orders/customer/history',
      '/api/auth/csrf-token',
      '/api/stores/search',
      '/api/stores/highlights',
      '/api/stores/popular',
    ].includes(path) ||
    [
      `/api/stores/${id}`,
      `/api/stores/${id}/order-channels`,
      `/api/stores/${id}/tinkerbell-settings`,
      `/api/stores/public-intro/${id}`,
      `/api/categories/store/${id}`,
      `/api/products/store/${id}`,
      `/api/option-templates/store/${id}`,
      `/api/legal/stores/${id}`,
      `/api/waiting/store/${id}/status`,
      `/api/reviews/store/${id}`,
    ].includes(path)
  );
}
function cleanCashRequest(body, fixture, orders) {
  const allowed = [
    'order_id',
    'store_id',
    'payment_method',
    'total_amount',
    'point_amount',
    'items',
  ];
  if (!body || Object.keys(body).some((k) => !allowed.includes(k)))
    throw Error('UNSUPPORTED_PAYMENT_FIELD');
  const order = orders.find((o) => o.id === Number(body.order_id));
  if (
    !order ||
    Number(body.store_id) !== fixture.storeId ||
    body.payment_method !== 'cash' ||
    Number(body.point_amount) !== 0 ||
    Number(body.total_amount) !== Number(order.amount)
  )
    throw Error('KNOWN_CASH_ORDER_ONLY');
  return {
    order_id: order.id,
    store_id: fixture.storeId,
    payment_method: 'cash',
    total_amount: Number(order.amount),
    point_amount: 0,
  };
}
module.exports = { cleanOrder, cleanCashRequest, allowRead };
