import { render } from 'solid-js/web';
import { RevKitTheme } from '@specialdoom/solid-rev-kit';
import { Container } from './src/Container';
import branding from './src/assets/branding.svg';
import { Legend } from './src/Legend';
import { ButtonsSection } from './src/sections/ButtonsSection';
import { AlertsSection } from './src/sections/AlertsSection';
import { CalloutsSection } from './src/sections/CalloutsSection';
import { SpinnerSection } from './src/sections/SpinnersSection';
import { CardsSection } from './src/sections/CardsContainer';
import { TypeScaleSection } from './src/sections/TypeScaleSection';
import { AvatarsSection } from './src/sections/AvatarsSection';
import { IconsSection } from './src/sections/IconsSection';
import { ColorsSection } from './src/sections/ColorsSection';
import { ModalsSection } from './src/sections/ModalsSection';
import { FormSection } from './src/sections/FormSection';
import { ProgressSection } from './src/sections/ProgressSection';
import { TypefaceSection } from './src/sections/TypefaceSection';

const App = () => {
  return (
    <div style={{ height: '80%' }}>
      <Container type='full' padding='0'>
        <img src={branding} alt='RevkitUI' width='100%' />
      </Container>
      <Legend title="Typeface" rank={1} />
      <TypefaceSection />
      <Legend title="Colors" rank={2} />
      <ColorsSection />
      <Legend title="Icons" rank={3} />
      <IconsSection />
      <Legend title="Form" rank={4} />
      <FormSection />
      <Legend title="Buttons" rank={5} />
      <ButtonsSection />
      <Legend title="Avatars" rank={6} />
      <AvatarsSection />
      <Legend title="Type Scale" rank={7} />
      <TypeScaleSection />
      <Legend title="Cards" rank={8} />
      <CardsSection />
      <Legend title="Alerts" rank={9} />
      <AlertsSection />
      <Legend title="Spinners" rank={10} />
      <SpinnerSection />
      <Legend title="Progress" rank={11} />
      <ProgressSection />
      <Legend title="Callouts" rank={12} />
      <CalloutsSection />
      <Legend title="Modals" rank={13} />
      <ModalsSection />
    </div>
  );
};

render(() => <RevKitTheme><App /></RevKitTheme>, document.getElementById('root') as HTMLElement);
