import { motion } from 'framer-motion';
import { MessageCircle } from 'lucide-react';

const FloatingWhatsApp = () => {
  return (
    <motion.a
      href="https://wa.me/27686017462"
      target="_blank"
      rel="noopener noreferrer"
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ delay: 1, type: 'spring', stiffness: 200 }}
      className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-[#25D366] flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
      aria-label="Chat on WhatsApp"
    >
      <MessageCircle className="w-7 h-7 text-white" />
    </motion.a>
  );
};

export default FloatingWhatsApp;