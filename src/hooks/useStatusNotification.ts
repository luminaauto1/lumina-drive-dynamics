import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface SendNotificationParams {
  clientEmail: string;
  clientName: string;
  newStatus: string;
  applicationId: string;
  accessToken?: string;
  vehicleName?: string;
}

export const sendStatusNotification = async ({
  clientEmail,
  clientName,
  newStatus,
  applicationId,
  accessToken,
  vehicleName,
}: SendNotificationParams): Promise<boolean> => {
  try {
    const { data, error } = await supabase.functions.invoke('send-status-notification', {
      body: {
        clientEmail,
        clientName,
        newStatus,
        applicationId,
        accessToken,
        vehicleName,
      },
    });

    if (error) {
      console.error('Error sending status notification:', error);
      // Don't show error toast to avoid interrupting workflow
      return false;
    }

    console.log('Status notification sent:', data);
    return true;
  } catch (error) {
    console.error('Failed to send status notification:', error);
    return false;
  }
};

// Hook for convenience in components
export const useStatusNotification = () => {
  const sendNotification = async (params: SendNotificationParams) => {
    const success = await sendStatusNotification(params);
    if (success) {
      toast.success('Client notified via email');
    }
    return success;
  };

  return { sendNotification };
};
