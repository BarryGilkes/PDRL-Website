import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { createClient } from '@metagptx/web-sdk';
import { Button } from '@/components/ui/button';
import { Menu, X, User } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const client = createClient();

const navLinks = [
  { to: '/classes', label: 'Classes' },
  { to: '/rules', label: 'Rules' },
  { to: '/events', label: 'Events' },
  { to: '/leaderboard', label: 'Leaderboard' },
  { to: '/driver', label: 'Drivers' },
  { to: '/register', label: 'Register' },
  { to: '/media', label: 'Media' },
  { to: '/garage', label: 'Garage' },
  { to: '/about', label: 'About' },
  { to: '/contact', label: 'Contact' },
];

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await client.auth.me();
        setUser(response.data);
      } catch (error) {
        setUser(null);
      }
    };
    checkAuth();
  }, []);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    setIsMenuOpen(false);
  }, [location.pathname]);

  const handleLogin = () => {
    client.auth.toLogin();
  };

  const handleLogout = async () => {
    await client.auth.logout();
    setUser(null);
    window.location.href = '/';
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-500 ${
        scrolled
          ? 'bg-dark-900/90 backdrop-blur-xl border-b border-neon-cyan/10 shadow-lg shadow-neon-cyan/5'
          : 'bg-dark-900/70 backdrop-blur-md border-b border-white/5'
      }`}
    >
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 group">
            <img
              src="/logo.webp"
              alt="PDRL"
              className="h-14 w-auto transition-transform duration-300 group-hover:scale-105"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
            <div>
              <div className="text-3xl font-heading font-extrabold text-white tracking-wider group-hover:text-neon-cyan transition-colors duration-300">
                PDRL
              </div>
              <div className="text-xs text-neon-cyan/60 font-medium tracking-widest uppercase">
                Pro Drag Racing League
              </div>
            </div>
          </Link>

          {/* Mobile menu toggle */}
          <button
            className="md:hidden text-white p-2 rounded-lg hover:bg-white/5 transition-colors"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label="Toggle menu"
          >
            {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={`relative px-3 py-2 rounded-lg text-sm font-semibold transition-all duration-300 ${
                  isActive(link.to)
                    ? 'text-neon-cyan neon-underline'
                    : 'text-gray-300 hover:text-neon-cyan hover:bg-neon-cyan/5'
                }`}
              >
                {link.label}
              </Link>
            ))}
            {user ? (
              <>
                <Link to="/admin">
                  <Button size="sm" variant="ghost" className="text-gray-300 hover:text-neon-cyan hover:bg-neon-cyan/5 font-semibold">
                    Admin
                  </Button>
                </Link>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleLogout}
                  className="text-gray-300 hover:text-white hover:bg-white/5 font-semibold"
                >
                  <User size={14} className="mr-1" /> Logout
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                onClick={handleLogin}
                className="bg-gradient-to-r from-neon-cyan to-cyan-600 text-dark-900 font-bold hover:shadow-[0_0_20px_rgba(0,212,255,0.4)] transition-all duration-300"
              >
                Login
              </Button>
            )}
          </nav>
        </div>
      </div>

      {/* Mobile Nav */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.nav
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="md:hidden overflow-hidden bg-dark-900/95 backdrop-blur-xl border-b border-neon-cyan/10"
          >
            <div className="container mx-auto px-4 py-4 flex flex-col gap-1">
              {navLinks.map((link, i) => (
                <motion.div
                  key={link.to}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Link
                    to={link.to}
                    className={`block px-4 py-3 rounded-lg text-sm font-semibold transition-all duration-200 ${
                      isActive(link.to)
                        ? 'text-neon-cyan bg-neon-cyan/10 border-l-2 border-neon-cyan'
                        : 'text-gray-300 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {link.label}
                  </Link>
                </motion.div>
              ))}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: navLinks.length * 0.05 }}
                className="pt-2 border-t border-white/5 mt-2 flex flex-col gap-2"
              >
                {user ? (
                  <>
                    <Link to="/admin">
                      <Button variant="ghost" className="w-full text-gray-300 hover:text-neon-cyan font-semibold">Admin</Button>
                    </Link>
                    <Button variant="ghost" onClick={handleLogout} className="w-full text-gray-300 hover:text-white font-semibold">
                      <User size={14} className="mr-2" /> Logout
                    </Button>
                  </>
                ) : (
                  <Button
                    onClick={handleLogin}
                    className="w-full bg-gradient-to-r from-neon-cyan to-cyan-600 text-dark-900 font-bold"
                  >
                    Login
                  </Button>
                )}
              </motion.div>
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}