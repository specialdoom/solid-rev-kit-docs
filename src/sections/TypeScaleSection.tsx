import { Component, For } from 'solid-js';
import { Typography } from '@specialdoom/solid-rev-kit';
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
								<Typography.Heading size={size} type={type}>{`Heading x${size}`}</Typography.Heading>
							)}
						</For>
						<Typography.Paragraph type={type}>Paragraph x1</Typography.Paragraph>
						<Typography.Paragraph size={2} type={type}>Paragraph x2</Typography.Paragraph>
						<Typography.Label type={type}>Label</Typography.Label>
					</div>
				)
			}
		</For>
	</Container>
);