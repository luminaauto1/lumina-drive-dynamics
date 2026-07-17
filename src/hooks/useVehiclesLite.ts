// Lightweight stock list for prefill dropdowns (Invoice Creator, OTP Generator)
// — only the columns those forms need (useVehicles selects * incl. image
// arrays / cost internals; too heavy for a picker).
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const useVehiclesLite = () =>
  useQuery({
    queryKey: ['invoice-vehicles-lite'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vehicles')
        .select('id, stock_number, year, make, model, variant, color, mileage, vin, engine_code, registration_number, price')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
