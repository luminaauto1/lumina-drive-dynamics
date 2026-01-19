import GooglePlacesAutocomplete from 'react-google-places-autocomplete';
import { Textarea } from '@/components/ui/textarea';

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onPostalCodeChange?: (postalCode: string) => void;
  placeholder?: string;
  required?: boolean;
}

const AddressAutocomplete = ({ value, onChange, onPostalCodeChange, placeholder, required }: AddressAutocompleteProps) => {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  
  if (!apiKey) return <Textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} required={required} />;
  
  const handlePlaceSelect = (val: any) => {
    if (!val) return;
    
    // Set the address label
    onChange(val.label);
    
    // Extract postal code from place details if available
    if (val.value?.place_id && onPostalCodeChange && window.google?.maps?.places) {
      const service = new window.google.maps.places.PlacesService(
        document.createElement('div')
      );
      
      service.getDetails(
        { placeId: val.value.place_id, fields: ['address_components'] },
        (place, status) => {
          if (status === 'OK' && place?.address_components) {
            const postalComponent = place.address_components.find(
              (comp: any) => comp.types.includes('postal_code')
            );
            if (postalComponent) {
              onPostalCodeChange(postalComponent.long_name);
            }
          }
        }
      );
    }
  };
  
  return (
    <div className="w-full relative z-50">
      <GooglePlacesAutocomplete
        apiKey={apiKey}
        selectProps={{
          defaultInputValue: value,
          onChange: handlePlaceSelect,
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
