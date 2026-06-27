import { Navigate } from 'react-router-dom';

// Email Templates moved INTO the consolidated Settings hub as a tab.
// This route is kept as a permanent redirect so old links / bookmarks still work.
const AdminEmailSettings = () => <Navigate to="/admin/settings?tab=email" replace />;

export default AdminEmailSettings;
