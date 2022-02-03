import { Component } from 'solid-js';
import { Icons } from '@specialdoom/solid-rev-kit';
import { Container } from '../Container';

const { Cross, More, Plus, Minus, Burger, Lens } = Icons;

export const IconsSection: Component = () => (
	<Container type='fluid' flex gap='16px' flexDirection='row' flexWrap='wrap'>
		<Cross />
		<More />
		<Plus />
		<Minus />
		<Burger />
		<Lens />
	</Container>
);