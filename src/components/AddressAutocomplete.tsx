import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
}

/**
 * Address Autocomplete Component
 * Falls back to regular input if Google Maps API key is not configured
 */
const AddressAutocomplete = ({ value, onChange, placeholder, required }: AddressAutocompleteProps) => {
  const [inputValue, setInputValue] = useState(value);
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  // If no API key, use fallback textarea
  if (!apiKey) {
    return (
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || "Street address, suburb, city"}
        required={required}
        rows={2}
      />
    );
  }

  // With API key - use Google Places Autocomplete
  // Note: The react-google-places-autocomplete library requires @react-google-maps/api
  // For now, we use a simple implementation with manual input
  // Full Google Places integration can be added when the API key is configured
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    onChange(newValue);
  };

  return (
    <div className="relative">
      <Input
        value={inputValue}
        onChange={handleChange}
        placeholder={placeholder || "Start typing your address..."}
        required={required}
        className="w-full"
      />
      <p className="text-xs text-muted-foreground mt-1">
        Enter your full address including suburb and city
      </p>
    </div>
  );
};

export default AddressAutocomplete;
