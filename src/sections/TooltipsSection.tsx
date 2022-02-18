import { Component } from 'solid-js';
import { Tooltip } from '@specialdoom/solid-rev-kit';
import { Container } from '../Container';

export const TooltipsSection: Component = () => (
	<Container type='fluid' flex gap='16px' flexWrap='wrap'>
		<Tooltip placement='top' title='Tooltip title' type='bright'>
			<span>bright top tooltip (mouseenter)</span>
		</Tooltip>
		<Tooltip placement='bottom' title='Tooltip title' type='bright' trigger='click'>
			<span>bright bottom tooltip (click)</span>
		</Tooltip>
		<Tooltip placement='left' title='Tooltip title' type='bright' trigger='click'>
			<span>bright left tooltip (click)</span>
		</Tooltip>
		<Tooltip placement='right' title='Tooltip title' type='bright'>
			<span>bright right tooltip (mouseenter)</span>
		</Tooltip>

		<Tooltip placement='top' title='Tooltip title' type='accent'>
			<span>accent top tooltip (mouseenter)</span>
		</Tooltip>
		<Tooltip placement='bottom' title='Tooltip title' type='accent' trigger='click'>
			<span>accent bottom tooltip (click)</span>
		</Tooltip>
		<Tooltip placement='left' title='Tooltip title' type='accent' trigger='click'>
			<span>accent left tooltip (click)</span>
		</Tooltip>
		<Tooltip placement='right' title='Tooltip title' type='accent'>
			<span>accent right tooltip (mouseenter)</span>
		</Tooltip>
		<Tooltip placement='top' title='Tooltip title' type='success'>
			<span>success top tooltip (mouseenter)</span>
		</Tooltip>
		<Tooltip placement='bottom' title='Tooltip title' type='success' trigger='click'>
			<span>success bottom tooltip (click)</span>
		</Tooltip>
		<Tooltip placement='left' title='Tooltip title' type='success' trigger='click'>
			<span>success left tooltip (click)</span>
		</Tooltip>
		<Tooltip placement='right' title='Tooltip title' type='success'>
			<span>success right tooltip (mouseenter)</span>
		</Tooltip>

		<Tooltip placement='top' title='Tooltip title' type='error'>
			<span>error top tooltip (mouseenter)</span>
		</Tooltip>
		<Tooltip placement='bottom' title='Tooltip title' type='error' trigger='click'>
			<span>error bottom tooltip (click)</span>
		</Tooltip>
		<Tooltip placement='left' title='Tooltip title' type='error' trigger='click'>
			<span>error left tooltip (click)</span>
		</Tooltip>
		<Tooltip placement='right' title='Tooltip title' type='error'>
			<span>error right tooltip (mouseenter)</span>
		</Tooltip>

		<Tooltip placement='top' title='Tooltip title' type='warning'>
			<span>warning top tooltip (mouseenter)</span>
		</Tooltip>
		<Tooltip placement='bottom' title='Tooltip title' type='warning' trigger='click'>
			<span>warning bottom tooltip (click)</span>
		</Tooltip>
		<Tooltip placement='left' title='Tooltip title' type='warning' trigger='click'>
			<span>warning left tooltip (focus)</span>
		</Tooltip>
		<Tooltip placement='right' title='Tooltip title' type='warning'>
			<span>warning right tooltip (mouseenter)</span>
		</Tooltip>

		<Tooltip placement='top' title='Tooltip title' type='dark'>
			<span>dark top tooltip (mouseenter)</span>
		</Tooltip>
		<Tooltip placement='bottom' title='Tooltip title' type='dark' trigger='click'>
			<span>dark bottom tooltip (click)</span>
		</Tooltip>
		<Tooltip placement='left' title='Tooltip title' type='dark' trigger='click'>
			<span>dark left tooltip (click)</span>
		</Tooltip>
		<Tooltip placement='right' title='Tooltip title' type='dark'>
			<span>dark right tooltip (mouseenter)</span>
		</Tooltip>
	</Container >
);