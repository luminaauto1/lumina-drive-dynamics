import { motion } from 'framer-motion';

interface SkeletonCardProps {
  count?: number;
}

const SkeletonCard = ({ count = 1 }: SkeletonCardProps) => {
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: index * 0.1 }}
          className="rounded-lg bg-card border border-border overflow-hidden"
        >
          {/* Image Skeleton */}
          <div className="skeleton aspect-[16/10]" />

          {/* Content Skeleton */}
          <div className="p-5 space-y-4">
            <div className="space-y-2">
              <div className="skeleton h-5 w-3/4 rounded" />
              <div className="skeleton h-4 w-1/2 rounded" />
            </div>

            <div className="flex gap-4">
              <div className="skeleton h-3 w-16 rounded" />
              <div className="skeleton h-3 w-20 rounded" />
              <div className="skeleton h-3 w-14 rounded" />
            </div>

            <div className="flex justify-between items-end">
              <div className="space-y-2">
                <div className="skeleton h-7 w-28 rounded" />
                <div className="skeleton h-4 w-24 rounded" />
              </div>
              <div className="skeleton h-5 w-24 rounded" />
            </div>
          </div>
        </motion.div>
      ))}
    </>
  );
};

export default SkeletonCard;
