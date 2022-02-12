import { Component } from 'solid-js';
import { Avatar } from '@specialdoom/solid-rev-kit';
import { Container } from '../Container';

export const AvatarsSection: Component = () => (
	<Container type='fluid' flex flexWrap='wrap' gap='8px'>
		<Avatar initials='RK' />
		<Avatar initials='RK' round />
		<Avatar.Meg />
		<Avatar.Meg round />
		<Avatar.Jake />
		<Avatar.Jake round />
		<Avatar.Steven />
		<Avatar.Steven round />
		<Avatar.Mili />
		<Avatar.Mili round />
	</Container>
);