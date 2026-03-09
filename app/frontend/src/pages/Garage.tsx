import { useEffect, useState } from 'react';
import { createClient } from '@metagptx/web-sdk';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Car, Zap } from 'lucide-react';
import { motion } from 'framer-motion';

const client = createClient();

export default function Garage() {
  const [user, setUser] = useState<any>(null);
  const [builds, setBuilds] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    car: '',
    drivetrain: '',
    class_name: '',
    mods: '',
    photo_url: '',
  });

  useEffect(() => {
    const init = async () => {
      try {
        const userRes = await client.auth.me();
        setUser(userRes.data);
      } catch (error) {
        setUser(null);
      }
      loadBuilds();
    };
    init();
  }, []);

  const loadBuilds = async () => {
    try {
      const res = await client.entities.garage_builds.queryAll({
        query: { status: 'approved' },
        limit: 50,
      });
      setBuilds(res.data.items);
    } catch (error) {
      console.error('Error loading builds:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error('Please login to submit your build');
      client.auth.toLogin();
      return;
    }
    try {
      await client.entities.garage_builds.create({
        data: { ...formData, status: 'pending' },
      });
      toast.success('Build submitted for approval!');
      setFormData({ name: '', car: '', drivetrain: '', class_name: '', mods: '', photo_url: '' });
    } catch (error: any) {
      toast.error(error?.data?.detail || 'Failed to submit build');
    }
  };

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
              <Car size={14} className="text-neon-cyan" />
              <span className="text-sm text-neon-cyan font-semibold">Members Garage</span>
            </div>
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h1 className="text-4xl md:text-5xl font-heading font-black text-white mb-4 tracking-tight">
                  MEMBERS <span className="text-neon-cyan">GARAGE</span>
                </h1>
                <p className="text-lg text-gray-400">
                  Showcase your build and see what other PDRL members are racing.
                </p>
              </div>
              <Dialog>
                <DialogTrigger asChild>
                  <Button className="bg-gradient-to-r from-neon-cyan to-cyan-600 text-dark-900 font-bold hover:shadow-[0_0_20px_rgba(0,212,255,0.3)] transition-all duration-300">
                    <Zap size={16} className="mr-2" />
                    Submit Your Build
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-dark-500 border-white/10 max-w-2xl">
                  <DialogHeader>
                    <DialogTitle className="font-heading font-bold text-white tracking-wide">Submit Your Build</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <Label className="text-gray-300 font-semibold">Owner Name</Label>
                      <Input required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Your name or team name" className="bg-dark-900/50 border-white/10 text-white focus:ring-neon-cyan/50 focus:border-neon-cyan/30 mt-1" />
                    </div>
                    <div>
                      <Label className="text-gray-300 font-semibold">Car</Label>
                      <Input required value={formData.car} onChange={(e) => setFormData({ ...formData, car: e.target.value })} placeholder="Year / Make / Model" className="bg-dark-900/50 border-white/10 text-white focus:ring-neon-cyan/50 focus:border-neon-cyan/30 mt-1" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-gray-300 font-semibold">Drivetrain</Label>
                        <Select value={formData.drivetrain} onValueChange={(value) => setFormData({ ...formData, drivetrain: value })}>
                          <SelectTrigger className="bg-dark-900/50 border-white/10 text-white mt-1">
                            <SelectValue placeholder="Select..." />
                          </SelectTrigger>
                          <SelectContent className="bg-dark-500 border-white/10">
                            <SelectItem value="FWD">FWD</SelectItem>
                            <SelectItem value="RWD">RWD</SelectItem>
                            <SelectItem value="AWD">AWD</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-gray-300 font-semibold">Class</Label>
                        <Select value={formData.class_name} onValueChange={(value) => setFormData({ ...formData, class_name: value })}>
                          <SelectTrigger className="bg-dark-900/50 border-white/10 text-white mt-1">
                            <SelectValue placeholder="Select..." />
                          </SelectTrigger>
                          <SelectContent className="bg-dark-500 border-white/10">
                            <SelectItem value="True Street">True Street</SelectItem>
                            <SelectItem value="Street Mod">Street Mod</SelectItem>
                            <SelectItem value="Pro Street">Pro Street</SelectItem>
                            <SelectItem value="Pro">Pro</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <Label className="text-gray-300 font-semibold">Modifications</Label>
                      <Textarea required value={formData.mods} onChange={(e) => setFormData({ ...formData, mods: e.target.value })} placeholder="Turbo, fuel system, ECU, transmission, suspension, tires, etc." className="bg-dark-900/50 border-white/10 text-white focus:ring-neon-cyan/50 focus:border-neon-cyan/30 mt-1" rows={6} />
                    </div>
                    <div>
                      <Label className="text-gray-300 font-semibold">Photo URL (optional)</Label>
                      <Input value={formData.photo_url} onChange={(e) => setFormData({ ...formData, photo_url: e.target.value })} placeholder="https://..." className="bg-dark-900/50 border-white/10 text-white focus:ring-neon-cyan/50 focus:border-neon-cyan/30 mt-1" />
                    </div>
                    <Button type="submit" className="w-full bg-gradient-to-r from-neon-cyan to-cyan-600 text-dark-900 font-extrabold py-5 rounded-xl hover:shadow-[0_0_20px_rgba(0,212,255,0.3)] transition-all duration-300">
                      Submit Build
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {builds.map((build, i) => (
              <motion.div
                key={build.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Card className="glass-card-hover h-full">
                  <CardHeader>
                    {build.photo_url ? (
                      <img src={build.photo_url} alt={build.car} className="w-full h-48 object-cover rounded-lg mb-4" />
                    ) : (
                      <div className="w-full h-48 bg-white/[0.03] border border-white/5 rounded-lg flex items-center justify-center mb-4">
                        <Car className="text-gray-700" size={56} />
                      </div>
                    )}
                    <CardTitle className="font-heading font-bold text-white tracking-wide">{build.car}</CardTitle>
                    <p className="text-sm text-gray-400">{build.name}</p>
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-2 mb-4">
                      <span className="px-2.5 py-1 bg-neon-red/10 text-neon-red border border-neon-red/20 rounded-lg text-xs font-bold">{build.drivetrain}</span>
                      <span className="px-2.5 py-1 bg-white/5 text-gray-400 border border-white/10 rounded-lg text-xs font-semibold">{build.class_name}</span>
                    </div>
                    <div className="text-sm text-gray-400 whitespace-pre-line leading-relaxed">
                      {build.mods}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}

            {builds.length === 0 && (
              <Card className="glass-card col-span-full">
                <CardContent className="py-12 text-center">
                  <Car size={48} className="mx-auto mb-4 text-gray-600" />
                  <p className="text-gray-400">No builds yet. Be the first to submit yours!</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}