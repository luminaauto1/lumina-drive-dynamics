import { z } from 'zod';

// South African ID number validation (13 digits)
const saIdNumberSchema = z.string()
  .regex(/^\d{13}$/, 'ID number must be exactly 13 digits')
  .optional()
  .or(z.literal(''));

// South African phone number validation
const phoneSchema = z.string()
  .min(10, 'Phone number must be at least 10 digits')
  .max(15, 'Phone number must be less than 15 characters')
  .regex(/^[\d\s+()-]+$/, 'Invalid phone number format');

// Email validation
const emailSchema = z.string()
  .email('Please enter a valid email address')
  .max(255, 'Email must be less than 255 characters');

// Name validation
const nameSchema = z.string()
  .min(2, 'Name must be at least 2 characters')
  .max(100, 'Name must be less than 100 characters')
  .regex(/^[a-zA-Z\s'-]+$/, 'Name can only contain letters, spaces, hyphens and apostrophes');

// Bank account number validation (numeric only, reasonable length)
const accountNumberSchema = z.string()
  .regex(/^\d*$/, 'Account number must contain only digits')
  .max(20, 'Account number must be less than 20 digits')
  .optional()
  .or(z.literal(''));

// Salary validation (positive number, reasonable range)
const salarySchema = z.string()
  .refine((val) => {
    if (!val) return true;
    const num = parseFloat(val);
    return !isNaN(num) && num >= 0 && num <= 100000000;
  }, 'Please enter a valid salary amount');

// Text field validation with length limits
const shortTextSchema = z.string().max(100, 'Field must be less than 100 characters').optional().or(z.literal(''));
const mediumTextSchema = z.string().max(500, 'Field must be less than 500 characters').optional().or(z.literal(''));
const longTextSchema = z.string().max(1000, 'Field must be less than 1000 characters').optional().or(z.literal(''));

// Finance Application Schema - Step by Step
export const financeApplicationStep1Schema = z.object({
  first_name: nameSchema,
  last_name: nameSchema,
  id_number: saIdNumberSchema,
  marital_status: shortTextSchema,
  gender: shortTextSchema,
  qualification: shortTextSchema,
  email: emailSchema,
  phone: phoneSchema,
});

export const financeApplicationStep2Schema = z.object({
  street_address: z.string().min(5, 'Please enter a valid address').max(500, 'Address is too long'),
  area_code: z.string().max(10, 'Area code must be less than 10 characters').optional().or(z.literal('')),
  employer_name: z.string().min(2, 'Employer name must be at least 2 characters').max(200, 'Employer name is too long'),
  job_title: shortTextSchema,
  employment_period: shortTextSchema,
});

export const financeApplicationStep3Schema = z.object({
  kin_name: z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name is too long'),
  kin_contact: phoneSchema,
});

export const financeApplicationStep4Schema = z.object({
  bank_name: z.string().min(1, 'Please select a bank'),
  account_type: shortTextSchema,
  account_number: accountNumberSchema,
  gross_salary: salarySchema.refine((val) => val && val.trim() !== '', 'Gross salary is required'),
  net_salary: salarySchema.refine((val) => val && val.trim() !== '', 'Net salary is required'),
  expenses_summary: mediumTextSchema,
});

export const financeApplicationStep5Schema = z.object({
  preferred_vehicle_text: longTextSchema,
  popia_consent: z.boolean().refine((val) => val === true, 'You must consent to POPIA to proceed'),
});

// Full schema for final submission validation
export const financeApplicationFullSchema = z.object({
  first_name: nameSchema,
  last_name: nameSchema,
  id_number: saIdNumberSchema,
  marital_status: shortTextSchema,
  gender: shortTextSchema,
  qualification: shortTextSchema,
  email: emailSchema,
  phone: phoneSchema,
  street_address: z.string().min(5, 'Please enter a valid address').max(500, 'Address is too long'),
  area_code: z.string().max(10, 'Area code must be less than 10 characters').optional().or(z.literal('')),
  employer_name: z.string().min(2, 'Employer name must be at least 2 characters').max(200, 'Employer name is too long'),
  job_title: shortTextSchema,
  employment_period: shortTextSchema,
  kin_name: z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name is too long'),
  kin_contact: phoneSchema,
  bank_name: z.string().min(1, 'Please select a bank'),
  account_type: shortTextSchema,
  account_number: accountNumberSchema,
  gross_salary: salarySchema.refine((val) => val && val.trim() !== '', 'Gross salary is required'),
  net_salary: salarySchema.refine((val) => val && val.trim() !== '', 'Net salary is required'),
  expenses_summary: mediumTextSchema,
  preferred_vehicle_text: longTextSchema,
  popia_consent: z.boolean().refine((val) => val === true, 'You must consent to POPIA to proceed'),
});

// Contact form schema
export const contactFormSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name is too long'),
  email: emailSchema,
  phone: phoneSchema,
  message: z.string().min(10, 'Message must be at least 10 characters').max(1000, 'Message is too long'),
});

// Helper function to get first error message from Zod validation
export const getFirstZodError = (error: z.ZodError): string => {
  const firstError = error.errors[0];
  return firstError?.message || 'Validation error';
};
