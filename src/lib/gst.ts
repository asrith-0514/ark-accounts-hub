import type { GstType } from "./types";

export const DEFAULT_GST_RATE = 5;

export function deriveGstType(supplierState: string, companyState: string): GstType {
  const a = (supplierState || "").trim().toLowerCase();
  const b = (companyState || "").trim().toLowerCase();
  if (!a) return "cgst_sgst";
  return a === b ? "cgst_sgst" : "igst";
}

export interface GstBreakup {
  gstType: GstType;
  gstRate: number;
  taxable: number;      // = taxableValue (post-discount)
  igst: number;
  cgst: number;
  sgst: number;
  totalTax: number;
  netTotal: number;     // taxableValue + totalTax  (pre-other, pre-roundoff)
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** GST is ALWAYS calculated on the post-discount taxable value. */
export function calcGst(
  taxableValue: number,
  gstType: GstType,
  gstRate: number = DEFAULT_GST_RATE,
): GstBreakup {
  const t = Math.max(0, Number(taxableValue) || 0);
  const rate = Math.max(0, Number(gstRate) || 0);
  if (gstType === "igst") {
    const igst = round2((t * rate) / 100);
    return { gstType, gstRate: rate, taxable: t, igst, cgst: 0, sgst: 0, totalTax: igst, netTotal: round2(t + igst) };
  }
  const half = round2((t * (rate / 2)) / 100);
  return { gstType, gstRate: rate, taxable: t, igst: 0, cgst: half, sgst: half, totalTax: round2(half * 2), netTotal: round2(t + half * 2) };
}

export interface BillCalc extends GstBreakup {
  subtotal: number;      // taxable amount BEFORE discount
  discount: number;
  taxableValue: number;  // subtotal - discount
  otherCharges: number;
  roundOff: number;
  grandTotal: number;    // taxableValue + totalTax + otherCharges + roundOff
}

/**
 * Purchase Bill Calculation Flow:
 * 1. Taxable Amount  2. Discount  3. Taxable Value  4. GST  5. Other Charges  6. Round Off  7. Grand Total
 * GST is computed on Taxable Value (post-discount).
 */
export function calcBill(input: {
  subtotal: number;
  discount?: number;
  otherCharges?: number;
  roundOff?: number;
  gstType: GstType;
  gstRate?: number;
}): BillCalc {
  const subtotal = Math.max(0, Number(input.subtotal) || 0);
  const discount = Math.max(0, Number(input.discount) || 0);
  const other = Math.max(0, Number(input.otherCharges) || 0);
  const roundOff = Number(input.roundOff) || 0;
  const taxableValue = round2(Math.max(0, subtotal - discount));
  const gst = calcGst(taxableValue, input.gstType, input.gstRate ?? DEFAULT_GST_RATE);
  const grandTotal = round2(taxableValue + gst.totalTax + other + roundOff);
  return {
    ...gst,
    subtotal,
    discount,
    taxableValue,
    otherCharges: other,
    roundOff,
    grandTotal,
  };
}
