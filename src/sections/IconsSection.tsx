import { Component, For } from 'solid-js';
import { Icons } from '@specialdoom/solid-rev-kit';
import { Container } from '../Container';
import { Dynamic } from 'solid-js/web';

export const IconsSection: Component = () => (
	<Container type='fluid' flex gap='16px' flexDirection='row' flexWrap='wrap'>
		<For each={Object.keys(Icons)}>{
			//@ts-ignore
			(key) => <Dynamic component={Icons[key]} />
		}
		</For>
	</Container>
);
