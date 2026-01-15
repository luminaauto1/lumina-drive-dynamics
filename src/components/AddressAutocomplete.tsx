import GooglePlacesAutocomplete from 'react-google-places-autocomplete';
import { Textarea } from '@/components/ui/textarea';

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
}

const AddressAutocomplete = ({ value, onChange, placeholder, required }: AddressAutocompleteProps) => {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  
  if (!apiKey) return <Textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} required={required} />;
  return (
    <div className="w-full relative z-50">
      <GooglePlacesAutocomplete
        apiKey={apiKey}
        selectProps={{
          defaultInputValue: value,
          onChange: (val: any) => { if (val) onChange(val.label); },
          placeholder: placeholder || "Start typing address...",
          styles: {
            menu: (provided) => ({ ...provided, zIndex: 9999, color: '#000' }),
            input: (provided) => ({ ...provided, color: 'inherit' }),
            singleValue: (provided) => ({ ...provided, color: 'inherit' }),
            control: (provided) => ({ ...provided, background: 'transparent', borderColor: 'hsl(var(--input))' })
          },
        }}
        autocompletionRequest={{ componentRestrictions: { country: ['za'] } }}
      />
    </div>
  );
};

export default AddressAutocomplete;
