import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Heart, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import VehicleCard from '@/components/VehicleCard';
import { useWishlist } from '@/hooks/useWishlist';
import { useVehicles } from '@/hooks/useVehicles';
import KineticText from '@/components/KineticText';
import SkeletonCard from '@/components/SkeletonCard';

const Wishlist = () => {
  const { wishlist, clearWishlist } = useWishlist();
  const { data: vehicles = [], isLoading } = useVehicles();
  
  const wishlistVehicles = vehicles.filter((v) => wishlist.includes(v.id));

  return (
    <>
      <Helmet>
        <title>My Garage | Lumina Auto</title>
      </Helmet>

      <div className="min-h-screen pt-24 pb-20">
        <div className="container mx-auto px-6">
          <div className="flex items-center justify-between mb-12">
            <div>
              <h1 className="font-display text-4xl font-bold mb-2">
                <KineticText>My Garage</KineticText>
              </h1>
              <p className="text-muted-foreground">
                {wishlist.length} saved vehicle{wishlist.length !== 1 ? 's' : ''}
              </p>
            </div>
            {wishlist.length > 0 && (
              <Button variant="outline" onClick={clearWishlist} className="gap-2">
                <Trash2 className="w-4 h-4" /> Clear All
              </Button>
            )}
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <SkeletonCard count={3} />
            </div>
          ) : wishlistVehicles.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {wishlistVehicles.map((vehicle) => (
                <VehicleCard key={vehicle.id} vehicle={vehicle} />
              ))}
            </div>
          ) : (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-20">
              <Heart className="w-16 h-16 text-muted-foreground mx-auto mb-6" />
              <h2 className="font-display text-2xl font-semibold mb-2">Your garage is empty</h2>
              <p className="text-muted-foreground mb-6">Save vehicles you love to compare them later.</p>
              <Link to="/inventory"><Button>Browse Inventory</Button></Link>
            </motion.div>
          )}
        </div>
      </div>
    </>
  );
};

export default Wishlist;
