import { Component, For } from 'solid-js';
import { Heading, Label, Paragraph } from '@specialdoom/solid-rev-kit';
import { Container } from '../Container';

const types: any[] = ['primary', 'accent', 'error', 'success', 'warning', 'secondary', 'muted', 'bright'];
const sizes: (1 | 2 | 3 | 4 | 5 | 6)[] = [1, 2, 3, 4, 5, 6];

export const TypeScaleSection: Component = () => (
	<Container type='fluid' flex gap='16px' flexDirection='row' flexWrap='wrap'>
		<For each={types}>
			{
				type => (
					<div>
						<For each={sizes}>
							{size => (
								<Heading size={size} type={type}>{`Heading x${size}`}</Heading>
							)}
						</For>
						<Paragraph type={type}>Paragraph x1</Paragraph>
						<Paragraph size={2} type={type}>Paragraph x2</Paragraph>
						<Label type={type}>Label</Label>
					</div>
				)
			}
		</For>
	</Container>
);