import jsPDF from 'jspdf';
import { FinanceApplication } from '@/hooks/useFinanceApplications';
import { formatPrice } from '@/hooks/useVehicles';

export const generateFinancePDF = (application: FinanceApplication, vehicleDetails?: string) => {
  const doc = new jsPDF();
  
  // Colors
  const primaryColor = '#d4af37';
  const textColor = '#1a1a1a';
  const mutedColor = '#666666';
  
  let yPos = 20;
  const leftMargin = 20;
  const lineHeight = 7;
  
  // Header
  doc.setFontSize(24);
  doc.setTextColor(textColor);
  doc.text('LUMINA AUTO', leftMargin, yPos);
  
  yPos += 10;
  doc.setFontSize(12);
  doc.setTextColor(mutedColor);
  doc.text('Finance Application Details', leftMargin, yPos);
  
  // Application ID and Date
  yPos += 8;
  doc.setFontSize(9);
  doc.text(`Application ID: ${application.id.slice(0, 8).toUpperCase()}`, leftMargin, yPos);
  doc.text(`Date: ${new Date(application.created_at).toLocaleDateString()}`, 140, yPos);
  
  // Divider
  yPos += 5;
  doc.setDrawColor(primaryColor);
  doc.setLineWidth(0.5);
  doc.line(leftMargin, yPos, 190, yPos);
  
  // Status Badge
  yPos += 10;
  doc.setFontSize(11);
  doc.setTextColor(primaryColor);
  doc.text(`Status: ${application.status.toUpperCase().replace('_', ' ')}`, leftMargin, yPos);
  
  // Section: Personal Details
  yPos += 12;
  doc.setFontSize(12);
  doc.setTextColor(textColor);
  doc.text('Personal Details', leftMargin, yPos);
  
  yPos += 3;
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.2);
  doc.line(leftMargin, yPos, 190, yPos);
  
  yPos += lineHeight;
  doc.setFontSize(10);
  doc.setTextColor(mutedColor);
  
  const addField = (label: string, value: string | number | null | undefined, x: number = leftMargin) => {
    doc.setTextColor(mutedColor);
    doc.text(`${label}:`, x, yPos);
    doc.setTextColor(textColor);
    doc.text(String(value || 'N/A'), x + 35, yPos);
  };
  
  addField('Full Name', `${application.first_name || ''} ${application.last_name || ''}`);
  yPos += lineHeight;
  addField('ID Number', application.id_number);
  yPos += lineHeight;
  addField('Email', application.email);
  yPos += lineHeight;
  addField('Phone', application.phone);
  yPos += lineHeight;
  addField('Gender', application.gender);
  doc.setTextColor(mutedColor);
  doc.text('Marital Status:', 100, yPos);
  doc.setTextColor(textColor);
  doc.text(String(application.marital_status || 'N/A'), 135, yPos);
  
  // Section: Address
  yPos += 12;
  doc.setFontSize(12);
  doc.setTextColor(textColor);
  doc.text('Address', leftMargin, yPos);
  
  yPos += 3;
  doc.line(leftMargin, yPos, 190, yPos);
  
  yPos += lineHeight;
  doc.setFontSize(10);
  addField('Street Address', application.street_address);
  yPos += lineHeight;
  addField('Area Code', application.area_code);
  
  // Section: Employment
  yPos += 12;
  doc.setFontSize(12);
  doc.setTextColor(textColor);
  doc.text('Employment Details', leftMargin, yPos);
  
  yPos += 3;
  doc.line(leftMargin, yPos, 190, yPos);
  
  yPos += lineHeight;
  doc.setFontSize(10);
  addField('Employer', application.employer_name);
  yPos += lineHeight;
  addField('Job Title', application.job_title);
  yPos += lineHeight;
  addField('Period', application.employment_period);
  
  // Section: Financials
  yPos += 12;
  doc.setFontSize(12);
  doc.setTextColor(textColor);
  doc.text('Financial Information', leftMargin, yPos);
  
  yPos += 3;
  doc.line(leftMargin, yPos, 190, yPos);
  
  yPos += lineHeight;
  doc.setFontSize(10);
  addField('Gross Salary', application.gross_salary ? formatPrice(application.gross_salary) : null);
  yPos += lineHeight;
  addField('Net Salary', application.net_salary ? formatPrice(application.net_salary) : null);
  yPos += lineHeight;
  addField('Bank', application.bank_name);
  yPos += lineHeight;
  addField('Account Type', application.account_type);
  yPos += lineHeight;
  addField('Account No.', application.account_number);
  
  // Section: Next of Kin
  yPos += 12;
  doc.setFontSize(12);
  doc.setTextColor(textColor);
  doc.text('Next of Kin', leftMargin, yPos);
  
  yPos += 3;
  doc.line(leftMargin, yPos, 190, yPos);
  
  yPos += lineHeight;
  doc.setFontSize(10);
  addField('Name', application.kin_name);
  yPos += lineHeight;
  addField('Contact', application.kin_contact);
  
  // Section: Vehicle Preference
  if (vehicleDetails || application.preferred_vehicle_text) {
    yPos += 12;
    doc.setFontSize(12);
    doc.setTextColor(textColor);
    doc.text('Vehicle Details', leftMargin, yPos);
    
    yPos += 3;
    doc.line(leftMargin, yPos, 190, yPos);
    
    yPos += lineHeight;
    doc.setFontSize(10);
    if (vehicleDetails) {
      addField('Selected', vehicleDetails);
    }
    if (application.preferred_vehicle_text) {
      yPos += lineHeight;
      addField('Preference', application.preferred_vehicle_text);
    }
  }

  // Section: Expenses Summary (if available)
  if (application.expenses_summary) {
    yPos += 12;
    doc.setFontSize(12);
    doc.setTextColor(textColor);
    doc.text('Expenses Summary', leftMargin, yPos);
    
    yPos += 3;
    doc.line(leftMargin, yPos, 190, yPos);
    
    yPos += lineHeight;
    doc.setFontSize(10);
    doc.setTextColor(mutedColor);
    
    // Split long text into lines
    const expenseLines = doc.splitTextToSize(application.expenses_summary, 160);
    expenseLines.forEach((line: string) => {
      if (yPos > 260) {
        doc.addPage();
        yPos = 20;
      }
      doc.text(line, leftMargin, yPos);
      yPos += lineHeight - 2;
    });
  }

  // POPIA Consent Declaration
  yPos += 12;
  if (yPos > 220) {
    doc.addPage();
    yPos = 20;
  }
  
  doc.setFontSize(10);
  doc.setTextColor(textColor);
  doc.text('Consent Declaration', leftMargin, yPos);
  
  yPos += 3;
  doc.setDrawColor(primaryColor);
  doc.line(leftMargin, yPos, 190, yPos);
  
  yPos += lineHeight;
  doc.setFontSize(8);
  doc.setTextColor(mutedColor);
  
  const consentText = `I hereby give consent to Lumina Auto to process my personal information in accordance with the Protection of Personal Information Act (POPIA). I understand that my information will be used for the purpose of processing my finance application and may be shared with financial institutions for credit assessment purposes. I confirm that all information provided is true and accurate to the best of my knowledge.`;
  
  const consentLines = doc.splitTextToSize(consentText, 170);
  consentLines.forEach((line: string) => {
    doc.text(line, leftMargin, yPos);
    yPos += 4;
  });
  
  yPos += 6;
  doc.text(`POPIA Consent Given: ${application.popia_consent ? 'Yes' : 'No'}`, leftMargin, yPos);
  
  // Signature Date
  yPos += lineHeight;
  const signedDate = new Date(application.created_at).toLocaleDateString('en-ZA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  doc.text(`Signed and agreed to POPIA consent on: ${signedDate}`, leftMargin, yPos);
  
  // Add signature image if available
  const signatureUrl = (application as any).signature_url;
  if (signatureUrl) {
    yPos += 10;
    if (yPos > 220) {
      doc.addPage();
      yPos = 30;
    }
    
    doc.setFontSize(10);
    doc.setTextColor(textColor);
    doc.text('Client Signature:', leftMargin, yPos);
    
    yPos += 5;
    
    // Handle both base64 data URLs and regular URLs
    if (signatureUrl.startsWith('data:image')) {
      try {
        doc.addImage(signatureUrl, 'PNG', leftMargin, yPos, 60, 25);
        yPos += 30;
        doc.setFontSize(8);
        doc.setTextColor(mutedColor);
        doc.text('Digitally signed by client', leftMargin, yPos);
      } catch (e) {
        console.error('Failed to add signature to PDF:', e);
        doc.setFontSize(8);
        doc.setTextColor(mutedColor);
        doc.text('[Signature available but could not be rendered]', leftMargin, yPos);
        yPos += 10;
      }
    } else {
      // For URL-based signatures, we need to fetch and convert to base64
      // Note: This is async so we show placeholder text
      doc.setFontSize(8);
      doc.setTextColor(mutedColor);
      doc.text(`[Signature stored at: ${signatureUrl.substring(0, 50)}...]`, leftMargin, yPos);
      yPos += 10;
    }
  } else {
    // No signature available
    yPos += 10;
    doc.setFontSize(8);
    doc.setTextColor(mutedColor);
    doc.text('[No digital signature captured]', leftMargin, yPos);
  }
  
  // Footer
  yPos = 280;
  doc.setFontSize(8);
  doc.setTextColor(mutedColor);
  doc.text('This document is confidential and intended for internal use only.', leftMargin, yPos);
  doc.text(`Generated on ${new Date().toLocaleString()}`, leftMargin, yPos + 4);
  
  // Save
  const fileName = `LuminaAuto_Finance_${application.first_name}_${application.last_name}_${application.id.slice(0, 8)}.pdf`;
  doc.save(fileName);
};
