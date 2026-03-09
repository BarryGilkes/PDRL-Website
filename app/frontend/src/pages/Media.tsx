import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Camera, Video } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Media() {
  return (
    <div className="min-h-screen flex flex-col bg-dark-900 text-white">
      <Header />

      <main className="flex-1 py-12">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-12"
          >
            <div className="inline-flex items-center gap-2 bg-neon-cyan/10 border border-neon-cyan/20 rounded-full px-4 py-2 mb-4">
              <Camera size={14} className="text-neon-cyan" />
              <span className="text-sm text-neon-cyan font-semibold">Media</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-heading font-black text-white mb-4 tracking-tight">
              PHOTOS & <span className="text-neon-cyan">VIDEOS</span>
            </h1>
            <p className="text-lg text-gray-400 max-w-2xl">
              Check out highlights, race photos, and videos from PDRL events.
            </p>
          </motion.div>

          <div className="space-y-8">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <Card className="glass-card">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-neon-cyan/10 flex items-center justify-center">
                      <Camera size={20} className="text-neon-cyan" />
                    </div>
                    <CardTitle className="font-heading font-bold text-white tracking-wide">Photo Gallery</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-400 mb-4">
                    Event photos will be posted here after each race. Follow our social media for real-time updates.
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map((n) => (
                      <div key={n} className="aspect-square bg-white/[0.03] border border-white/5 rounded-xl flex items-center justify-center hover:border-neon-cyan/20 transition-all duration-300">
                        <Camera className="text-gray-700" size={40} />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <Card className="glass-card">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-neon-red/10 flex items-center justify-center">
                      <Video size={20} className="text-neon-red" />
                    </div>
                    <CardTitle className="font-heading font-bold text-white tracking-wide">Video Highlights</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-400 mb-4">
                    Race highlights and full runs will be posted here. Subscribe to our YouTube channel for notifications.
                  </p>
                  <div className="grid md:grid-cols-2 gap-4">
                    {[1, 2].map((n) => (
                      <div key={n} className="aspect-video bg-white/[0.03] border border-white/5 rounded-xl flex items-center justify-center hover:border-neon-red/20 transition-all duration-300">
                        <Video className="text-gray-700" size={40} />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="font-heading font-bold text-white tracking-wide">Follow PDRL</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-400 mb-4">
                    Stay connected with PDRL on social media for the latest updates, photos, and videos.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    {['Instagram', 'Facebook', 'YouTube', 'TikTok'].map((platform) => (
                      <a
                        key={platform}
                        href="#"
                        className="px-5 py-2.5 bg-white/[0.03] border border-white/10 rounded-xl text-gray-300 text-sm font-semibold hover:border-neon-cyan/30 hover:text-neon-cyan hover:bg-neon-cyan/5 transition-all duration-300"
                      >
                        {platform}
                      </a>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}