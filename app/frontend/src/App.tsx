import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import AuthCallback from "./pages/AuthCallback";
import Classes from "./pages/Classes";
import Rules from "./pages/Rules";
import Events from "./pages/Events";
import Register from "./pages/Register";
import Media from "./pages/Media";
import Garage from "./pages/Garage";
import About from "./pages/About";
import Contact from "./pages/Contact";
import Admin from "./pages/admin";
import Leaderboard from "./pages/Leaderboard";
import DriverProfile from "./pages/DriverProfile";
import EventResults from "./pages/EventResults";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/classes" element={<Classes />} />
          <Route path="/rules" element={<Rules />} />
          <Route path="/events" element={<Events />} />
          <Route path="/events/:eventId/results" element={<EventResults />} />
          <Route path="/register" element={<Register />} />
          <Route path="/media" element={<Media />} />
          <Route path="/garage" element={<Garage />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/driver" element={<DriverProfile />} />
          <Route path="/driver/:driverName" element={<DriverProfile />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;