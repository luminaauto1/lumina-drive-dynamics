import { useState } from 'react';
import { motion } from 'framer-motion';
import { Upload, Check, Camera, Car, ClipboardList, Loader2, X } from 'lucide-react';
import { Helmet } from 'react-helmet-async';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import KineticText from '@/components/KineticText';

const steps = [
  { id: 1, title: 'Vehicle Details', icon: Car },
  { id: 2, title: 'Condition', icon: ClipboardList },
  { id: 3, title: 'Photos & Contact', icon: Camera },
];

// SA-relevant vehicle makes
const VEHICLE_MAKES = [
  "Toyota", "Volkswagen", "Ford", "BMW", "Mercedes-Benz", "Audi", "Hyundai", 
  "Kia", "Nissan", "Renault", "Isuzu", "Suzuki", "Mazda", "Honda", "Jeep", 
  "Land Rover", "Volvo", "Porsche", "Chevrolet", "Lexus", "Mitsubishi", 
  "Chery", "Haval", "Mahindra", "Peugeot", "Opel", "Mini", "Jaguar", 
  "Alfa Romeo", "Fiat", "GWM", "BAIC", "JAC", "Other"
].sort();

const SellYourCar = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [formData, setFormData] = useState({
    // Step 1
    make: '',
    model: '',
    year: '',
    mileage: '',
    transmission: '',
    color: '',
    desiredPrice: '',
    // Step 2
    condition: '',
    accidents: '',
    serviceHistory: '',
    description: '',
    // Step 3
    photos: [] as File[],
    photoUrls: [] as string[],
    // Contact
    name: '',
    email: '',
    phone: '',
  });

  const updateForm = (field: string, value: string | File[] | string[]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingPhotos(true);
    const newPhotos = [...formData.photos];
    const newUrls = [...formData.photoUrls];

    try {
      for (const file of Array.from(files)) {
        // Upload to Supabase Storage
        const timestamp = Date.now();
        const fileName = `sell-requests/${timestamp}_${file.name.replace(/\s/g, '_')}`;
        
        const { data, error } = await supabase.storage
          .from('client-docs')
          .upload(fileName, file);

        if (error) {
          console.error('Upload error:', error);
          toast.error(`Failed to upload ${file.name}`);
          continue;
        }

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('client-docs')
          .getPublicUrl(data.path);

        newPhotos.push(file);
        newUrls.push(publicUrl);
      }

      updateForm('photos', newPhotos);
      updateForm('photoUrls', newUrls);
      toast.success(`${files.length} photo(s) uploaded`);
    } catch (err) {
      console.error(err);
      toast.error('Failed to upload photos');
    } finally {
      setUploadingPhotos(false);
    }
  };

  const removePhoto = (index: number) => {
    updateForm('photos', formData.photos.filter((_, i) => i !== index));
    updateForm('photoUrls', formData.photoUrls.filter((_, i) => i !== index));
  };

  const nextStep = () => {
    if (currentStep < 3) setCurrentStep(currentStep + 1);
  };

  const prevStep = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.phone || !formData.make || !formData.model) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsSubmitting(true);

    try {
      const { data, error } = await supabase.functions.invoke('create-sell-request', {
        body: {
          client_name: formData.name,
          client_contact: formData.phone,
          client_email: formData.email || null,
          vehicle_make: formData.make,
          vehicle_model: formData.model,
          vehicle_year: formData.year ? Number(formData.year) : null,
          vehicle_mileage: formData.mileage ? Number(formData.mileage) : null,
          desired_price: formData.desiredPrice ? Number(formData.desiredPrice) : null,
          condition: formData.condition || null,
          photos_urls: formData.photoUrls,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success('Your vehicle has been submitted! We will contact you shortly.');
      
      // Reset form
      setFormData({
        make: '', model: '', year: '', mileage: '', transmission: '', color: '', desiredPrice: '',
        condition: '', accidents: '', serviceHistory: '', description: '',
        photos: [], photoUrls: [], name: '', email: '', phone: '',
      });
      setCurrentStep(1);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to submit. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>Sell Your Car | Lumina Auto</title>
        <meta
          name="description"
          content="Get the best value for your vehicle. Our expert team will provide a fair market valuation within 24 hours."
        />
      </Helmet>

      <div className="min-h-screen pt-24 pb-20">
        <div className="container mx-auto px-4 md:px-6">
          {/* Header */}
          <div className="text-center max-w-3xl mx-auto mb-12">
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-primary text-sm font-semibold uppercase tracking-widest mb-4 block"
            >
              Trade-In Program
            </motion.span>
            <h1 className="font-display text-4xl md:text-5xl font-bold mb-4">
              <KineticText>Sell Your Car</KineticText>
            </h1>
            <p className="text-muted-foreground text-lg">
              Get a fair market valuation from our experts. We make selling 
              your car simple, fast, and hassle-free.
            </p>
          </div>

          {/* Progress Bar */}
          <div className="max-w-3xl mx-auto mb-12">
            <div className="flex items-center justify-between">
              {steps.map((step, index) => (
                <div key={step.id} className="flex items-center">
                  <div className="flex flex-col items-center">
                    <motion.div
                      initial={false}
                      animate={{
                        backgroundColor:
                          currentStep >= step.id
                            ? 'hsl(var(--primary))'
                            : 'hsl(var(--secondary))',
                      }}
                      className="w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center transition-colors"
                    >
                      {currentStep > step.id ? (
                        <Check className="w-5 h-5 md:w-6 md:h-6 text-primary-foreground" />
                      ) : (
                        <step.icon
                          className={`w-5 h-5 md:w-6 md:h-6 ${
                            currentStep >= step.id
                              ? 'text-primary-foreground'
                              : 'text-muted-foreground'
                          }`}
                        />
                      )}
                    </motion.div>
                    <span
                      className={`mt-2 text-xs md:text-sm font-medium text-center ${
                        currentStep >= step.id
                          ? 'text-foreground'
                          : 'text-muted-foreground'
                      }`}
                    >
                      {step.title}
                    </span>
                  </div>
                  {index < steps.length - 1 && (
                    <div
                      className={`h-0.5 w-12 md:w-32 mx-2 md:mx-4 transition-colors ${
                        currentStep > step.id ? 'bg-primary' : 'bg-border'
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="max-w-3xl mx-auto">
            <div className="bg-card border border-border rounded-xl p-6 md:p-8">
              {/* Step 1: Vehicle Details */}
              {currentStep === 1 && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <h2 className="font-display text-2xl font-semibold mb-6">
                    Vehicle Details
                  </h2>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="mb-2 block">Make *</Label>
                      <Select
                        value={formData.make}
                        onValueChange={(value) => updateForm('make', value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select make" />
                        </SelectTrigger>
                        <SelectContent className="max-h-60">
                          {VEHICLE_MAKES.map((make) => (
                            <SelectItem key={make} value={make}>
                              {make}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label className="mb-2 block">Model *</Label>
                      <Input
                        placeholder="e.g., Corolla, Polo, Ranger"
                        value={formData.model}
                        onChange={(e) => updateForm('model', e.target.value)}
                      />
                    </div>

                    <div>
                      <Label className="mb-2 block">Year</Label>
                      <Select
                        value={formData.year}
                        onValueChange={(value) => updateForm('year', value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select year" />
                        </SelectTrigger>
                        <SelectContent className="max-h-60">
                          {Array.from({ length: 25 }, (_, i) => new Date().getFullYear() - i).map((year) => (
                            <SelectItem key={year} value={year.toString()}>
                              {year}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label className="mb-2 block">Mileage (km)</Label>
                      <Input
                        type="number"
                        placeholder="e.g., 85000"
                        value={formData.mileage}
                        onChange={(e) => updateForm('mileage', e.target.value)}
                      />
                    </div>

                    <div>
                      <Label className="mb-2 block">Transmission</Label>
                      <Select
                        value={formData.transmission}
                        onValueChange={(value) => updateForm('transmission', value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select transmission" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="automatic">Automatic</SelectItem>
                          <SelectItem value="manual">Manual</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label className="mb-2 block">Your Asking Price (R)</Label>
                      <Input
                        type="number"
                        placeholder="e.g., 250000"
                        value={formData.desiredPrice}
                        onChange={(e) => updateForm('desiredPrice', e.target.value)}
                      />
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Step 2: Condition */}
              {currentStep === 2 && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <h2 className="font-display text-2xl font-semibold mb-6">
                    Vehicle Condition
                  </h2>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <Label className="mb-2 block">Overall Condition</Label>
                      <Select
                        value={formData.condition}
                        onValueChange={(value) => updateForm('condition', value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select condition" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Excellent">Excellent - Like new</SelectItem>
                          <SelectItem value="Good">Good - Minor wear</SelectItem>
                          <SelectItem value="Fair">Fair - Visible wear</SelectItem>
                          <SelectItem value="Poor">Poor - Needs attention</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label className="mb-2 block">Accident History</Label>
                      <Select
                        value={formData.accidents}
                        onValueChange={(value) => updateForm('accidents', value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No accidents</SelectItem>
                          <SelectItem value="minor">Minor (cosmetic only)</SelectItem>
                          <SelectItem value="major">Major (structural)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label className="mb-2 block">Service History</Label>
                      <Select
                        value={formData.serviceHistory}
                        onValueChange={(value) => updateForm('serviceHistory', value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="full">Full service history</SelectItem>
                          <SelectItem value="partial">Partial history</SelectItem>
                          <SelectItem value="none">No service history</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="md:col-span-2">
                      <Label className="mb-2 block">Additional Notes (Optional)</Label>
                      <Textarea
                        placeholder="Any modifications, special features, or issues we should know about..."
                        value={formData.description}
                        onChange={(e) => updateForm('description', e.target.value)}
                        rows={4}
                      />
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Step 3: Photos & Contact */}
              {currentStep === 3 && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-8"
                >
                  <div>
                    <h2 className="font-display text-2xl font-semibold mb-6">
                      Upload Photos
                    </h2>

                    {/* Upload Area */}
                    <div className="border-2 border-dashed border-border rounded-xl p-6 md:p-8 text-center hover:border-primary/50 transition-colors">
                      <input
                        type="file"
                        id="photos"
                        accept="image/*"
                        multiple
                        onChange={handleFileUpload}
                        className="hidden"
                        disabled={uploadingPhotos}
                      />
                      <label
                        htmlFor="photos"
                        className="cursor-pointer flex flex-col items-center"
                      >
                        {uploadingPhotos ? (
                          <Loader2 className="w-12 h-12 text-primary mb-4 animate-spin" />
                        ) : (
                          <Upload className="w-12 h-12 text-muted-foreground mb-4" />
                        )}
                        <p className="text-foreground font-medium mb-1">
                          {uploadingPhotos ? 'Uploading...' : 'Tap to upload photos'}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          JPG, PNG up to 10MB each
                        </p>
                      </label>
                    </div>

                    {/* Uploaded Photos Preview */}
                    {formData.photos.length > 0 && (
                      <div className="mt-6 grid grid-cols-3 md:grid-cols-4 gap-3">
                        {formData.photos.map((photo, index) => (
                          <div key={index} className="relative group aspect-square">
                            <img
                              src={URL.createObjectURL(photo)}
                              alt={`Upload ${index + 1}`}
                              className="w-full h-full object-cover rounded-lg"
                            />
                            <button
                              type="button"
                              onClick={() => removePhoto(index)}
                              className="absolute top-1 right-1 w-6 h-6 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Contact Details */}
                  <div>
                    <h3 className="font-display text-xl font-semibold mb-4">
                      Your Contact Details
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="md:col-span-2">
                        <Label className="mb-2 block">Full Name *</Label>
                        <Input
                          placeholder="John Smith"
                          value={formData.name}
                          onChange={(e) => updateForm('name', e.target.value)}
                          required
                        />
                      </div>
                      <div>
                        <Label className="mb-2 block">Phone Number *</Label>
                        <Input
                          type="tel"
                          placeholder="082 123 4567"
                          value={formData.phone}
                          onChange={(e) => updateForm('phone', e.target.value)}
                          required
                        />
                      </div>
                      <div>
                        <Label className="mb-2 block">Email (Optional)</Label>
                        <Input
                          type="email"
                          placeholder="john@example.com"
                          value={formData.email}
                          onChange={(e) => updateForm('email', e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Navigation Buttons */}
              <div className="flex justify-between mt-8">
                {currentStep > 1 ? (
                  <Button type="button" variant="outline" onClick={prevStep}>
                    Back
                  </Button>
                ) : (
                  <div />
                )}

                {currentStep < 3 ? (
                  <Button 
                    type="button" 
                    onClick={nextStep}
                    disabled={currentStep === 1 && (!formData.make || !formData.model)}
                  >
                    Continue
                  </Button>
                ) : (
                  <Button 
                    type="submit" 
                    disabled={isSubmitting || !formData.name || !formData.phone}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      'Submit for Valuation'
                    )}
                  </Button>
                )}
              </div>
            </div>
          </form>
        </div>
      </div>
    </>
  );
};

export default SellYourCar;
