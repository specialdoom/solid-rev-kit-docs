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
import { Input } from '@specialdoom/solid-rev-kit';
import { ModalsSection } from './src/sections/ModalsSection';
import { TooltipsSection } from './src/sections/TooltipsSection';
import { FormSection } from './src/sections/FormSection';

const App = () => {
  return (
    <div style={{ height: '80%' }}>
      <Container type='full' padding='0'>
        <img src={branding} alt='RevkitUI' width='100%' />
      </Container>
      <Legend title="Colors" rank={1} />
      <ColorsSection />
      <Legend title="Icons" rank={2} />
      <IconsSection />
      <Legend title="Form" rank={3} />
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
      <Legend title="Callouts" rank={11} />
      <CalloutsSection />
      <Legend title="Modals" rank={12} />
      <ModalsSection />
      <Legend title="Tooltips" rank={13} />
      <TooltipsSection />
      <Input />
    </div>
  );
};

render(() => <RevKitTheme><App /></RevKitTheme>, document.getElementById('root') as HTMLElement);
