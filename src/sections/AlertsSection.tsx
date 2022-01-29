import { Component } from 'solid-js';
import { Alert } from '@specialdoom/solid-rev-kit';
import { Container } from '../Container';

const theme = {
	colors: {
		accent: '#0880AE',
		warning: '#F2AC57',
		success: '#14A38B',
		error: '#FF7171',
		primary: '#2C2738',
		secondary: '#756F86',
		muted: '#7C9CBF',
		bright: '#FFFFFF',
		shade: '#DBE2EA',
		tint: '#EBF4F8'
	}
};

export const AlertsSection: Component = () => (
	<Container type='fluid' flex gap='16px' flexWrap='wrap'>
		<Alert type='bright' textColor='accent' iconColor={theme.colors.accent}>
			A bright alert flash for dark backgrounds, which never lose the contrast.
		</Alert>
		<Alert type='primary'>
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