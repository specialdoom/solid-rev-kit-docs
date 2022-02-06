import { Tooltip, Tag, Alert } from '@specialdoom/solid-rev-kit';
import { Component } from 'solid-js';
import { Container } from '../Container';

export const TooltipsSection: Component = () => (
	<Container type='fluid' flex gap='16px' flexWrap='wrap'>
		<Alert type='warning'>Only skeleton of component developed! Using <code>tippy.js</code></Alert>
		<Tooltip title='Tooltip title'>
			<Tag>Tooltip auto</Tag>
		</Tooltip>
		<Tooltip title='Tooltip title' type='bright' placement='right'>
			<Tag>Tooltip right</Tag>
		</Tooltip>
		<Tooltip title='Tooltip title' type='primary' placement='left'>
			<Tag>Tooltip left</Tag>
		</Tooltip>
		<Tooltip title='Tooltip title' placement='bottom'>
			<Tag>Tooltip bottom</Tag>
		</Tooltip>
	</Container>
);