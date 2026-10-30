jest.mock('../../../config/prisma', () => ({
  products: { findMany: jest.fn() },
  suppliers: { findFirst: jest.fn(), upsert: jest.fn() },
  purchase_orders: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    updateMany: jest.fn(),
  },
  purchase_order_items: { updateMany: jest.fn(), findMany: jest.fn() },
  purchase_receipts: { findUnique: jest.fn() },
  $transaction: jest.fn(),
}));

const prisma = require('../../../config/prisma');
const purchaseService = require('../../../services/PurchaseService');

describe('PurchaseService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('requires at least one purchase line before writing a draft', async () => {
    await expect(purchaseService.createDraft(3, { items: [] }, 12)).rejects.toMatchObject({
      statusCode: 400,
    });
    expect(prisma.purchase_orders.create).not.toHaveBeenCalled();
  });

  it('rejects a supplier from another store', async () => {
    prisma.products.findMany.mockResolvedValue([]);
    prisma.suppliers.findFirst.mockResolvedValue(null);
    await expect(
      purchaseService.createDraft(
        3,
        {
          supplier_id: 99,
          items: [{ product_name: '원두', ordered_quantity: 2, unit_cost: 12000 }],
        },
        12
      )
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(prisma.purchase_orders.create).not.toHaveBeenCalled();
  });

  it('returns the persisted result for a repeated receipt key without applying stock twice', async () => {
    const receipt = { id: 7, purchase_order_id: 41, items: [{ id: 8, quantity_received: 4 }] };
    prisma.purchase_receipts.findUnique.mockResolvedValue(receipt);
    await expect(
      purchaseService.receive(
        3,
        41,
        { items: [{ purchase_order_item_id: 2, quantity_received: 4 }] },
        12,
        'receipt-retry-0001'
      )
    ).resolves.toBe(receipt);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects an idempotency key already owned by another purchase', async () => {
    prisma.purchase_receipts.findUnique.mockResolvedValue({
      id: 7,
      purchase_order_id: 99,
      items: [],
    });
    await expect(
      purchaseService.receive(
        3,
        41,
        { items: [{ purchase_order_item_id: 2, quantity_received: 4 }] },
        12,
        'receipt-retry-0001'
      )
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
