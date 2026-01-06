import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { Helmet } from 'react-helmet-async';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import VehicleCard from '@/components/VehicleCard';
import SourcingCard from '@/components/SourcingCard';
import CompareTray from '@/components/CompareTray';
import SkeletonCard from '@/components/SkeletonCard';
import KineticText from '@/components/KineticText';
import { useCompare } from '@/hooks/useCompare';
import { useVehicles } from '@/hooks/useVehicles';
import { formatPrice, calculateMonthlyPayment } from '@/lib/formatters';

const BODY_TYPES = ['SUV', 'Hatchback', 'Sedan', 'Bakkie', 'Coupe', 'Convertible', 'Wagon'];

const Inventory = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [priceRange, setPriceRange] = useState([0, 6000000]);
  const [monthlyPaymentMax, setMonthlyPaymentMax] = useState(150000);
  const [selectedMakes, setSelectedMakes] = useState<string[]>([]);
  const [selectedBodyType, setSelectedBodyType] = useState<string>('all');
  const [variantSearch, setVariantSearch] = useState('');
  const [financeFilter, setFinanceFilter] = useState<'all' | 'finance' | 'cash'>('all');

  const { data: vehicles = [], isLoading } = useVehicles();
  const { compareList, toggleCompare, removeFromCompare, clearCompare, isInCompare } = useCompare();

  // Get unique makes from DB
  const allMakes = useMemo(() => {
    return [...new Set(vehicles.map((v) => v.make))].sort();
  }, [vehicles]);

  // Predictive search suggestions
  const searchSuggestions = useMemo(() => {
    if (searchQuery.length < 2) return [];
    const query = searchQuery.toLowerCase();
    const suggestions: string[] = [];

    vehicles.forEach((v) => {
      if (v.make.toLowerCase().includes(query) && !suggestions.includes(v.make)) {
        suggestions.push(v.make);
      }
      if (v.model.toLowerCase().includes(query) && !suggestions.includes(v.model)) {
        suggestions.push(v.model);
      }
    });

    return suggestions.slice(0, 5);
  }, [searchQuery, vehicles]);

  // Filter vehicles
  const filteredVehicles = useMemo(() => {
    return vehicles.filter((vehicle) => {
      // Search filter
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch =
        !searchQuery ||
        vehicle.make.toLowerCase().includes(searchLower) ||
        vehicle.model.toLowerCase().includes(searchLower) ||
        (vehicle.variant?.toLowerCase().includes(searchLower) ?? false);

      // Price filter
      const matchesPrice =
        vehicle.price >= priceRange[0] && vehicle.price <= priceRange[1];

      // Monthly payment filter
      const monthlyPayment = vehicle.finance_available
        ? calculateMonthlyPayment(vehicle.price)
        : 0;
      const matchesMonthly =
        !vehicle.finance_available || monthlyPayment <= monthlyPaymentMax;

      // Make filter
      const matchesMake =
        selectedMakes.length === 0 || selectedMakes.includes(vehicle.make);

      // Body type filter (using body_type column from database)
      const matchesBodyType =
        selectedBodyType === 'all' || 
        ((vehicle as any).body_type?.toLowerCase() === selectedBodyType.toLowerCase());

      // Variant search filter
      const matchesVariant = 
        !variantSearch || 
        (vehicle.variant?.toLowerCase().includes(variantSearch.toLowerCase()) ?? false);

      // Finance availability filter
      const matchesFinance = 
        financeFilter === 'all' ||
        (financeFilter === 'finance' && vehicle.finance_available !== false) ||
        (financeFilter === 'cash' && vehicle.finance_available === false);

      // Exclude generic listings from main inventory
      const isNotGeneric = !(vehicle as any).is_generic_listing;

      return matchesSearch && matchesPrice && matchesMonthly && matchesMake && matchesBodyType && matchesVariant && matchesFinance && isNotGeneric;
    });
  }, [searchQuery, priceRange, monthlyPaymentMax, selectedMakes, selectedBodyType, variantSearch, financeFilter, vehicles]);

  const toggleMake = (make: string) => {
    setSelectedMakes((prev) =>
      prev.includes(make) ? prev.filter((m) => m !== make) : [...prev, make]
    );
  };

  const clearFilters = () => {
    setSearchQuery('');
    setPriceRange([0, 6000000]);
    setMonthlyPaymentMax(150000);
    setSelectedMakes([]);
    setSelectedBodyType('all');
    setVariantSearch('');
    setFinanceFilter('all');
  };

  const hasActiveFilters =
    searchQuery ||
    priceRange[0] > 0 ||
    priceRange[1] < 6000000 ||
    monthlyPaymentMax < 150000 ||
    selectedMakes.length > 0 ||
    selectedBodyType !== 'all' ||
    variantSearch ||
    financeFilter !== 'all';

  return (
    <>
      <Helmet>
        <title>Inventory | Lumina Auto - Premium Pre-Owned Vehicles</title>
        <meta
          name="description"
          content="Browse our curated collection of premium pre-owned luxury vehicles. BMW, Mercedes, Porsche, Ferrari, Lamborghini and more."
        />
      </Helmet>

      <div className="min-h-screen pt-24 pb-32">
        <div className="container mx-auto px-6">
          {/* Header */}
          <div className="mb-12">
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-primary text-sm font-semibold uppercase tracking-widest mb-4 block"
            >
              Our Collection
            </motion.span>
            <h1 className="font-display text-4xl md:text-5xl font-bold mb-4">
              <KineticText>Vehicle Inventory</KineticText>
            </h1>
            <p className="text-muted-foreground max-w-2xl">
              Discover {vehicles.length} exceptional vehicles, each carefully 
              selected and inspected to meet our exacting standards.
            </p>
          </div>

          {/* Search & Filters */}
          <div className="mb-8 space-y-4">
            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search by make, model..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 h-14 bg-card border-border text-lg"
              />

              {/* Search Suggestions */}
              {searchSuggestions.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-lg overflow-hidden z-20"
                >
                  {searchSuggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => {
                        setSearchQuery(suggestion);
                      }}
                      className="w-full px-4 py-3 text-left hover:bg-secondary transition-colors flex items-center gap-3"
                    >
                      <Search className="w-4 h-4 text-muted-foreground" />
                      <span>{suggestion}</span>
                    </button>
                  ))}
                </motion.div>
              )}
            </div>

            {/* Filter Toggle & Active Filters */}
            <div className="flex flex-wrap items-center gap-4">
              <Button
                variant="outline"
                onClick={() => setShowFilters(!showFilters)}
                className="gap-2"
              >
                <SlidersHorizontal className="w-4 h-4" />
                Filters
                {hasActiveFilters && (
                  <span className="w-2 h-2 rounded-full bg-primary" />
                )}
              </Button>

              {/* Body Type Filter */}
              <Select value={selectedBodyType} onValueChange={setSelectedBodyType}>
                <SelectTrigger className="w-40 bg-card border-border">
                  <SelectValue placeholder="Body Type" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  <SelectItem value="all">All Types</SelectItem>
                  {BODY_TYPES.map((type) => (
                    <SelectItem key={type} value={type.toLowerCase()}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Finance Filter */}
              <Select value={financeFilter} onValueChange={(v) => setFinanceFilter(v as 'all' | 'finance' | 'cash')}>
                <SelectTrigger className="w-44 bg-card border-border">
                  <SelectValue placeholder="Finance" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  <SelectItem value="all">All Vehicles</SelectItem>
                  <SelectItem value="finance">Finance Available</SelectItem>
                  <SelectItem value="cash">Cash Only</SelectItem>
                </SelectContent>
              </Select>

              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="text-muted-foreground"
                >
                  <X className="w-4 h-4 mr-1" />
                  Clear All
                </Button>
              )}

              {/* Active Filter Pills */}
              {selectedMakes.map((make) => (
                <motion.button
                  key={make}
                  layout
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  onClick={() => toggleMake(make)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 text-primary rounded-full text-sm"
                >
                  {make}
                  <X className="w-3 h-3" />
                </motion.button>
              ))}
            </div>

            {/* Filter Panel */}
            {showFilters && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-card border border-border rounded-lg p-6 space-y-6"
              >
                {/* Budget Slider (Monthly Payment) */}
                <div>
                  <label className="block text-sm font-medium mb-4">
                    Monthly Payment (up to {formatPrice(monthlyPaymentMax)}/pm)
                  </label>
                  <Slider
                    value={[monthlyPaymentMax]}
                    onValueChange={(value) => setMonthlyPaymentMax(value[0])}
                    min={5000}
                    max={150000}
                    step={1000}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground mt-2">
                    <span>R5,000/pm</span>
                    <span>R150,000/pm</span>
                  </div>
                </div>

                {/* Price Range */}
                <div>
                  <label className="block text-sm font-medium mb-4">
                    Price Range: {formatPrice(priceRange[0])} - {formatPrice(priceRange[1])}
                  </label>
                  <Slider
                    value={priceRange}
                    onValueChange={setPriceRange}
                    min={0}
                    max={6000000}
                    step={50000}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground mt-2">
                    <span>R0</span>
                    <span>R6,000,000</span>
                  </div>
                </div>

                {/* Make Filter */}
                <div>
                  <label className="block text-sm font-medium mb-4">Make</label>
                  <div className="flex flex-wrap gap-2">
                    {allMakes.map((make) => (
                      <button
                        key={make}
                        onClick={() => toggleMake(make)}
                        className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                          selectedMakes.includes(make)
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                        }`}
                      >
                        {make}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Variant Search */}
                <div>
                  <label className="block text-sm font-medium mb-4">Variant Search</label>
                  <Input
                    placeholder="e.g., 320d, GTI, Competition..."
                    value={variantSearch}
                    onChange={(e) => setVariantSearch(e.target.value)}
                    className="max-w-md"
                  />
                </div>
              </motion.div>
            )}
          </div>

          {/* Results Count */}
          <div className="mb-6 flex items-center justify-between">
            <p className="text-muted-foreground">
              Showing <span className="text-foreground font-semibold">{filteredVehicles.length}</span> vehicles
            </p>
          </div>

          {/* Vehicle Grid */}
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <SkeletonCard count={6} />
            </div>
          ) : filteredVehicles.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredVehicles.map((vehicle) => (
                <VehicleCard
                  key={vehicle.id}
                  vehicle={vehicle}
                  onCompare={toggleCompare}
                  isComparing={isInCompare(vehicle.id)}
                />
              ))}
              {/* Always show sourcing card at the end */}
              <SourcingCard />
            </div>
          ) : (
            <div className="text-center py-20">
              <p className="text-muted-foreground text-lg mb-4">
                No vehicles match your criteria.
              </p>
              <Button onClick={clearFilters} variant="outline">
                Clear Filters
              </Button>
            </div>
          )}
        </div>

        {/* Compare Tray */}
        <CompareTray
          compareList={compareList}
          onRemove={removeFromCompare}
          onClear={clearCompare}
        />
      </div>
    </>
  );
};

export default Inventory;
