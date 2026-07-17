// Canonical "new OTP" builder from Document Settings — shared by the OTP
// Generator page and the Deal Room's Configure-OTP popup so BOTH produce the
// same designed legal document (owner 2026-07-17: the popup's old text-PDF put
// signature blocks wherever the text flow landed).
import type { DocumentSettings } from '@/hooks/useDocumentSettings';
import { fmtOtpDate, addDaysOtpDate } from './format';
import type { OtpData } from './types';

export const blankOtp = (s: DocumentSettings): OtpData => ({
  company: {
    legal_name: s.companyLegalName,
    trading_name: s.companyTradingName,
    address: s.companyAddress,
    email: s.companyEmail,
    phone: s.companyPhone,
    reg_no: s.companyRegNumber,
    vat_no: s.vatRegistered ? s.companyVatNumber || 'N/A' : 'N/A',
  },
  vat_registered: s.vatRegistered,
  offer: { ref: '', date: fmtOtpDate(), valid_until: addDaysOtpDate(s.otpValidityDays) },
  client: { title: '', name: '', id: '', address: '', postal: '', email: '', cell: '' },
  sales: { exec_name: s.otpSalesExecutive, exec_phone: '' },
  vehicle: {
    make: '', model: '', year: '', reg_no: '', colour: '', trim: '',
    vin: '', engine_no: '', mileage: '', stock_no: '', mm_code: '', order_type: 'Used',
  },
  finance: { method: 'Bank Finance', financed_by: '', bank_branch: '', branch_phone: '', branch_contact: '' },
  notes: '',
  financials: {
    base_price: 0, extras: 0, vap: 0,
    admin_fee: s.defaultAdminFee, delivery_fee: s.otpDefaultDeliveryFee, licensing: s.otpDefaultLicensing,
    deposit: 0,
  },
  lines: s.otpLines,
});
