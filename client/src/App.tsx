import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import BottomNav from "./components/BottomNav";
import WelcomeTour from "./components/WelcomeTour";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Landing from "./pages/Landing";
import { lazy, Suspense } from "react";
const History = lazy(() => import("./pages/History"));
const ListingGenerator = lazy(() => import("./pages/ListingGenerator"));
const Wardrobe = lazy(() => import("./pages/Wardrobe"));
const Lookbook = lazy(() => import("./pages/Lookbook"));
const Profile = lazy(() => import("./pages/Profile"));
const Calendar = lazy(() => import("./pages/Calendar"));
const Shop = lazy(() => import("./pages/Shop"));
const Knowledge = lazy(() => import("./pages/Knowledge"));

const Spinner = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="w-6 h-6 border-2 border-teal-300 border-t-teal-600 rounded-full animate-spin" />
  </div>
);

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path="/">{() => <Landing />}</Route>
      <Route path="/sell">{() => <Suspense fallback={<Spinner />}><Home /></Suspense>}</Route>
      <Route path="/history">{() => <Suspense fallback={<Spinner />}><History /></Suspense>}</Route>
      <Route path="/listing">{() => <Suspense fallback={<Spinner />}><ListingGenerator /></Suspense>}</Route>
      <Route path="/wardrobe">{() => <Suspense fallback={<Spinner />}><Wardrobe /></Suspense>}</Route>
      <Route path="/lookbook">{() => <Suspense fallback={<Spinner />}><Lookbook /></Suspense>}</Route>
      <Route path="/profile">{() => <Suspense fallback={<Spinner />}><Profile /></Suspense>}</Route>
      <Route path="/calendar">{() => <Suspense fallback={<Spinner />}><Calendar /></Suspense>}</Route>
      <Route path="/shop">{() => <Suspense fallback={<Spinner />}><Shop /></Suspense>}</Route>
      <Route path="/knowledge">{() => <Suspense fallback={<Spinner />}><Knowledge /></Suspense>}</Route>
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="light"
        // switchable
      >
        <TooltipProvider>
          <Toaster />
          <div className="pb-16">
            <Router />
          </div>
          <BottomNav />
          <WelcomeTour />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
