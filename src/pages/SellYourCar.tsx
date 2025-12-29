import { useState } from 'react';
import { motion } from 'framer-motion';
import { Upload, ChevronRight, Check, Camera, Car, ClipboardList } from 'lucide-react';
import { Helmet } from 'react-helmet-async';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import KineticText from '@/components/KineticText';

const steps = [
  { id: 1, title: 'Vehicle Details', icon: Car },
  { id: 2, title: 'Condition', icon: ClipboardList },
  { id: 3, title: 'Photos', icon: Camera },
];

const SellYourCar = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    // Step 1
    make: '',
    model: '',
    year: '',
    mileage: '',
    transmission: '',
    color: '',
    // Step 2
    condition: '',
    accidents: '',
    serviceHistory: '',
    modifications: '',
    description: '',
    // Step 3
    photos: [] as File[],
    // Contact
    name: '',
    email: '',
    phone: '',
  });

  const updateForm = (field: string, value: string | File[]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      updateForm('photos', [...formData.photos, ...Array.from(files)]);
    }
  };

  const removePhoto = (index: number) => {
    updateForm(
      'photos',
      formData.photos.filter((_, i) => i !== index)
    );
  };

  const nextStep = () => {
    if (currentStep < 3) setCurrentStep(currentStep + 1);
  };

  const prevStep = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Handle form submission
    console.log('Form submitted:', formData);
    alert('Thank you! We will be in touch shortly.');
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
        <div className="container mx-auto px-6">
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
                      className="w-12 h-12 rounded-full flex items-center justify-center transition-colors"
                    >
                      {currentStep > step.id ? (
                        <Check className="w-6 h-6 text-primary-foreground" />
                      ) : (
                        <step.icon
                          className={`w-6 h-6 ${
                            currentStep >= step.id
                              ? 'text-primary-foreground'
                              : 'text-muted-foreground'
                          }`}
                        />
                      )}
                    </motion.div>
                    <span
                      className={`mt-2 text-sm font-medium ${
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
                      className={`h-0.5 w-20 md:w-32 mx-4 transition-colors ${
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
            <div className="bg-card border border-border rounded-xl p-8">
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
                      <label className="block text-sm font-medium mb-2">Make</label>
                      <Select
                        value={formData.make}
                        onValueChange={(value) => updateForm('make', value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select make" />
                        </SelectTrigger>
                        <SelectContent>
                          {['BMW', 'Mercedes-Benz', 'Audi', 'Porsche', 'Ferrari', 'Lamborghini'].map(
                            (make) => (
                              <SelectItem key={make} value={make}>
                                {make}
                              </SelectItem>
                            )
                          )}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Model</label>
                      <Input
                        placeholder="e.g., M4, C63, 911"
                        value={formData.model}
                        onChange={(e) => updateForm('model', e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Year</label>
                      <Select
                        value={formData.year}
                        onValueChange={(value) => updateForm('year', value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select year" />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 15 }, (_, i) => 2024 - i).map((year) => (
                            <SelectItem key={year} value={year.toString()}>
                              {year}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Mileage (km)
                      </label>
                      <Input
                        type="number"
                        placeholder="e.g., 45000"
                        value={formData.mileage}
                        onChange={(e) => updateForm('mileage', e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Transmission
                      </label>
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
                          <SelectItem value="dct">DCT / Dual Clutch</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Color</label>
                      <Input
                        placeholder="e.g., Alpine White"
                        value={formData.color}
                        onChange={(e) => updateForm('color', e.target.value)}
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

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Overall Condition
                      </label>
                      <Select
                        value={formData.condition}
                        onValueChange={(value) => updateForm('condition', value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select condition" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="excellent">
                            Excellent - Like new
                          </SelectItem>
                          <SelectItem value="good">Good - Minor wear</SelectItem>
                          <SelectItem value="fair">Fair - Visible wear</SelectItem>
                          <SelectItem value="poor">
                            Poor - Needs attention
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Accident History
                      </label>
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
                      <label className="block text-sm font-medium mb-2">
                        Service History
                      </label>
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

                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Additional Notes (Optional)
                      </label>
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
                    <div className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-primary/50 transition-colors">
                      <input
                        type="file"
                        id="photos"
                        accept="image/*"
                        multiple
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                      <label
                        htmlFor="photos"
                        className="cursor-pointer flex flex-col items-center"
                      >
                        <Upload className="w-12 h-12 text-muted-foreground mb-4" />
                        <p className="text-foreground font-medium mb-1">
                          Click to upload photos
                        </p>
                        <p className="text-sm text-muted-foreground">
                          JPG, PNG up to 10MB each
                        </p>
                      </label>
                    </div>

                    {/* Uploaded Photos Preview */}
                    {formData.photos.length > 0 && (
                      <div className="mt-6 grid grid-cols-3 md:grid-cols-4 gap-4">
                        {formData.photos.map((photo, index) => (
                          <div key={index} className="relative group">
                            <img
                              src={URL.createObjectURL(photo)}
                              alt={`Upload ${index + 1}`}
                              className="w-full aspect-square object-cover rounded-lg"
                            />
                            <button
                              type="button"
                              onClick={() => removePhoto(index)}
                              className="absolute top-2 right-2 w-6 h-6 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              ×
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
                        <label className="block text-sm font-medium mb-2">
                          Full Name
                        </label>
                        <Input
                          placeholder="John Smith"
                          value={formData.name}
                          onChange={(e) => updateForm('name', e.target.value)}
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">
                          Email
                        </label>
                        <Input
                          type="email"
                          placeholder="john@example.com"
                          value={formData.email}
                          onChange={(e) => updateForm('email', e.target.value)}
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">
                          Phone
                        </label>
                        <Input
                          type="tel"
                          placeholder="+27 82 123 4567"
                          value={formData.phone}
                          onChange={(e) => updateForm('phone', e.target.value)}
                          required
                        />
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Navigation Buttons */}
              <div className="flex justify-between mt-8 pt-6 border-t border-border">
                {currentStep > 1 ? (
                  <Button type="button" variant="outline" onClick={prevStep}>
                    Back
                  </Button>
                ) : (
                  <div />
                )}

                {currentStep < 3 ? (
                  <Button type="button" onClick={nextStep} className="gap-2">
                    Next
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    className="bg-gradient-gold text-primary-foreground hover:opacity-90"
                  >
                    Submit for Valuation
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
