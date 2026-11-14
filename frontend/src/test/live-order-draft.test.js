import { expect, it } from 'vitest';
import { liveDraftToCart } from '../utils/live/liveOrderDraft';
const menu = [
  {
    id: 1,
    name: '커피',
    price: 1000,
    options: [
      { id: 'size', name: '크기', required: true, choices: [{ id: 's', name: '기본', price: 0 }] },
    ],
  },
];
const draft = {
  success: true,
  items: [
    {
      product_id: 1,
      name: '커피',
      quantity: 2,
      base_price: 1000,
      unit_price: 1000,
      line_total: 2000,
      selected_options: [
        { groupId: 'size', choiceId: 's', choiceName: '기본', priceAdjustment: 0 },
      ],
    },
  ],
  total: 2000,
};
it('maps a verified full draft to the existing cart contract', () => {
  expect(liveDraftToCart(draft, menu)[0]).toMatchObject({
    item: menu[0],
    quantity: 2,
    unitPrice: 1000,
  });
});
it.each([
  'price',
  'quantity',
  'option',
  'required',
  'soldOut',
  'total',
  'unknown',
  'clarification',
])('rejects stale/invalid %s atomically', (kind) => {
  const d = structuredClone(draft),
    m = structuredClone(menu);
  if (kind === 'price') m[0].price = 2000;
  if (kind === 'quantity') d.items[0].quantity = 0;
  if (kind === 'option') d.items[0].selected_options[0].choiceId = 'missing';
  if (kind === 'required') d.items[0].selected_options = [];
  if (kind === 'soldOut') m[0].isSoldOut = true;
  if (kind === 'total') d.total = 1;
  if (kind === 'unknown') d.items.push({ ...d.items[0], product_id: 999 });
  if (kind === 'clarification') d.needs_clarification = true;
  expect(() => liveDraftToCart(d, m)).toThrow();
});
