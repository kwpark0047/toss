export function normalizeSalesSeries(response) {
  const payload = response?.data ?? response;
  const rows = Array.isArray(payload) ? payload : payload?.data;
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => ({
    ...row,
    date: row.date ?? row.label,
    sales: Number(row.sales ?? row.amount ?? row.total_sales ?? 0),
  }));
}
