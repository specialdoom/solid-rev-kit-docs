import { Component } from 'solid-js';
import { Alert } from '@specialdoom/solid-rev-kit';
import { Container } from '../Container';

export const AlertsSection: Component = () => (
	<Container type='fluid' flex gap='16px' flexWrap='wrap'>
		<Alert type='bright' color='accent'>
			A bright alert flash for dark backgrounds, which never lose the contrast.
		</Alert>
		<Alert type='dark'>
			A dark (primary type) alert flash for bright backgrounds, which never lose the contrast.
		</Alert>
		<Alert type='success'>
			A success alert flash, which never lose the contrast.
		</Alert>
		<Alert type='warning'>
			A warning alert flash that never sucks.
		</Alert>
		<Alert type='error'>
			An error alert flash that nobody loves.
		</Alert>
		<Alert type='accent'>
			An accent alert flash that looks pretty nice.
		</Alert>
	</Container>
);