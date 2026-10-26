import { LandingNavbar } from './sections/LandingNavbar';
import { HeroSection } from './sections/HeroSection';
import { FeaturesSection } from './sections/FeaturesSection';
import { HowItWorksSection } from './sections/HowItWorksSection';
import { PlansSection } from './sections/PlansSection';
import { FooterSection } from './sections/FooterSection';

export function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <LandingNavbar />
      <main>
        <HeroSection />
        <FeaturesSection />
        <HowItWorksSection />
        <PlansSection />
      </main>
      <FooterSection />
    </div>
  );
}
