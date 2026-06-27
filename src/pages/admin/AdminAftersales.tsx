/**
 * The Deal Ledger has been folded into the Deal Desk (owner's choice). Its value
 * now lives there as the "Ledger / Profit" and "Customer Follow-ups" tabs — see
 * src/components/dealdesk/AftersalesLedger.tsx. This page is kept only so any old
 * /admin/aftersales link, bookmark or saved nav config lands on the merged home.
 */
import { Navigate } from 'react-router-dom';
import { ADMIN_ROUTES } from '@/lib/adminRoutes';

const AdminAftersales = () => <Navigate to={ADMIN_ROUTES.dealDesk} replace />;

export default AdminAftersales;
