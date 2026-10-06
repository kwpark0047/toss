import { expect, it } from 'vitest';
import { readApiList } from '../lib/apiList';

it('reads pricing lists from actual server envelopes and paginated payloads', () => {
  const rows = [{ id: 1 }];
  for (const response of [
    rows,
    { success: true, data: rows },
    { data: { items: rows } },
    { items: rows },
  ]) {
    expect(readApiList(response)).toEqual(rows);
  }
  expect(readApiList(undefined)).toEqual([]);
  expect(readApiList({ success: true, data: [] })).toEqual([]);
});

it('rejects malformed envelopes rather than passing objects to map', () => {
  expect(() => readApiList({ success: true, data: {} })).toThrow('목록 데이터 형식');
});
