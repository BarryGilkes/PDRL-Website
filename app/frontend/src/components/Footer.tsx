import { Link } from 'react-router-dom';
import { Zap, ArrowUp } from 'lucide-react';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="relative mt-auto bg-dark-900">
      {/* Gradient accent line at top */}
      <div className="h-px bg-gradient-to-r from-transparent via-neon-cyan/50 to-transparent" />
      <div className="h-px bg-gradient-to-r from-transparent via-neon-red/30 to-transparent mt-px opacity-50" />

      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <img
                src="/images/ProDragRacing.jpg"
                alt="PDRL"
                className="h-10 w-auto rounded"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
              <div>
                <div className="text-lg font-heading font-extrabold text-white tracking-wider">
                  PDRL
                </div>
                <div className="text-[10px] text-neon-cyan/60 font-medium tracking-widest uppercase">
                  Pro Drag Racing League
                </div>
              </div>
            </div>
            <p className="text-gray-400 text-sm leading-relaxed">
              Promote fair, competitive, and professional drag racing.
            </p>
          </div>

          {/* League */}
          <div>
            <h3 className="font-heading font-bold text-white text-sm tracking-wider uppercase mb-4 flex items-center gap-2">
              <Zap size={14} className="text-neon-cyan" />
              League
            </h3>
            <div className="space-y-2.5">
              <Link to="/about" className="block text-gray-400 hover:text-neon-cyan text-sm font-medium transition-colors duration-200">About</Link>
              <Link to="/classes" className="block text-gray-400 hover:text-neon-cyan text-sm font-medium transition-colors duration-200">Classes</Link>
              <Link to="/rules" className="block text-gray-400 hover:text-neon-cyan text-sm font-medium transition-colors duration-200">Rules</Link>
            </div>
          </div>

          {/* Events */}
          <div>
            <h3 className="font-heading font-bold text-white text-sm tracking-wider uppercase mb-4 flex items-center gap-2">
              <Zap size={14} className="text-neon-cyan" />
              Events
            </h3>
            <div className="space-y-2.5">
              <Link to="/events" className="block text-gray-400 hover:text-neon-cyan text-sm font-medium transition-colors duration-200">Upcoming</Link>
              <Link to="/leaderboard" className="block text-gray-400 hover:text-neon-cyan text-sm font-medium transition-colors duration-200">Leaderboard</Link>
              <Link to="/register" className="block text-gray-400 hover:text-neon-cyan text-sm font-medium transition-colors duration-200">Register</Link>
            </div>
          </div>

          {/* Connect */}
          <div>
            <h3 className="font-heading font-bold text-white text-sm tracking-wider uppercase mb-4 flex items-center gap-2">
              <Zap size={14} className="text-neon-cyan" />
              Connect
            </h3>
            <div className="space-y-2.5">
              <Link to="/contact" className="block text-gray-400 hover:text-neon-cyan text-sm font-medium transition-colors duration-200">Contact</Link>
              <Link to="/media" className="block text-gray-400 hover:text-neon-cyan text-sm font-medium transition-colors duration-200">Media</Link>
              <Link to="/garage" className="block text-gray-400 hover:text-neon-cyan text-sm font-medium transition-colors duration-200">Members Garage</Link>
              <button
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="flex items-center gap-1.5 text-gray-400 hover:text-neon-cyan text-sm font-medium transition-colors duration-200"
              >
                <ArrowUp size={13} />
                Back to top
              </button>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-white/5 mt-10 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <span className="text-sm text-gray-500">
            © {currentYear} <span className="text-gray-400 font-semibold">PDRL</span>. All rights reserved.
          </span>
          <span className="text-xs text-gray-600 font-medium">
            Built for speed. Designed for impact.
          </span>
        </div>
      </div>
    </footer>
  );
}