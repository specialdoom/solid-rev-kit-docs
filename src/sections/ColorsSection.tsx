import { Card, revConstants } from '@specialdoom/solid-rev-kit';
import { Container } from '../Container';

export const ColorsSection = () => (
	<Container type='fluid' flex flexWrap='wrap' gap='10px' justifyContent='center' >
		<Card.Fill background={revConstants.theme.colors.accent} label='Accent' title={revConstants.theme.colors.accent} small />
		<Card.Fill background={revConstants.theme.colors.warning} label='Warning' title={revConstants.theme.colors.warning} small />
		<Card.Fill background={revConstants.theme.colors.success} label='Success' title={revConstants.theme.colors.success} small />
		<Card.Fill background={revConstants.theme.colors.error} label='Error' title={revConstants.theme.colors.error} small />
		<Card.Fill background={revConstants.theme.colors.primary} label='Primary or Dark' title={revConstants.theme.colors.primary} small />
		<Card.Fill background={revConstants.theme.colors.secondary} label='Secondary' title={revConstants.theme.colors.secondary} small />
		<Card.Fill background={revConstants.theme.colors.muted} label='Muted' title={revConstants.theme.colors.muted} small />
		<Card.Fill background={revConstants.theme.colors.bright} label='Bright' title={revConstants.theme.colors.bright} small color='#000' />
		<Card.Fill background={revConstants.theme.colors.shade} label='Shade' title={revConstants.theme.colors.shade} small color='#000' />
		<Card.Fill background={revConstants.theme.colors.tint} label='Tint' title={revConstants.theme.colors.tint} small color='#000' />
	</Container>
);