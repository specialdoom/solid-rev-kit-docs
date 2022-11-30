import { For, render } from 'solid-js/web';
import { Alert, RevKitTheme } from '@specialdoom/solid-rev-kit';
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
import { TooltipsSection } from './src/sections/TooltipsSection';
import { ChatBubblesSection } from './src/sections/ChatBubblesSection';

const sections = [
  {
    title: 'Typeface',
    component: TypefaceSection
  },
  {
    title: 'Colors',
    component: ColorsSection
  },
  {
    title: 'Icons',
    component: IconsSection
  },
  {
    title: 'Form',
    component: FormSection
  },
  {
    title: 'Tooltip',
    component: TooltipsSection
  },
  {
    title: 'Button',
    component: ButtonsSection
  },
  {
    title: 'Avatars',
    component: AvatarsSection
  },
  {
    title: 'Type Scale',
    component: TypeScaleSection
  },
  {
    title: 'Cards',
    component: CardsSection
  },
  {
    title: 'Alerts',
    component: AlertsSection
  },
  {
    title: 'Chat Bubbles',
    component: ChatBubblesSection
  },
  {
    title: 'Spinner',
    component: SpinnerSection
  },
  {
    title: 'Progress',
    component: ProgressSection
  },
  {
    title: 'Callouts',
    component: CalloutsSection
  },
  {
    title: 'Modals',
    component: ModalsSection
  }
];

const App = () => {
  return (
    <div style={{ height: '80%' }}>
      <Container type='full' padding='0'>
        <img src={branding} alt='RevkitUI' width='100%' />
      </Container>
      <Container type='fluid' flex flexWrap='wrap' flexDirection='row' gap='8px' justifyContent='space-between' alignItems='center'>
        <h3>How to use?</h3>
        <Container type='fluid' flex flexWrap='wrap' flexDirection='column' gap='8px' justifyContent='space-between'>
          <Alert>npm i @specialdoom/solid-rev-kit solid-styled-components</Alert>
          <Alert type="success">Wrap your <code>App</code> component with <code>RevKitTheme</code> component</Alert>
          <Alert type="dark">Enjoy!</Alert>
        </Container>
      </Container>
      <For each={sections}>
        {
          (section, getIndex) =>
            <>
              <Legend title={section.title} rank={getIndex() + 1} />
              {section.component}
            </>
        }
      </For>
    </div>
  );
};

render(() => <RevKitTheme><App /></RevKitTheme>, document.getElementById('root') as HTMLElement);
