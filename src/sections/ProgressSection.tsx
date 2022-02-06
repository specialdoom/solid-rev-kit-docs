import { Component } from 'solid-js';
import { Progress } from '@specialdoom/solid-rev-kit';
import { Container } from '../Container';

export const ProgressSection: Component = () => (
	<Container type='fluid' flex gap='16px' flexWrap='wrap'>
		<Progress type='accent' percent={20} />
		<Progress type='error' percent={80} />
		<Progress type='warning' percent={40} />
		<Progress type='success' percent={100} />
		<Progress loading />
	</Container>
);