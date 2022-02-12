import { Card, revConstants, Typography } from '@specialdoom/solid-rev-kit';
import { Container } from '../Container';

export const TypefaceSection = () => (
	<Container type='fluid' flex flexWrap='wrap' flexDirection='row' gap='8px' justifyContent='space-evenly'>
		<Card.Fill background={revConstants.theme.colors.dark} color={revConstants.theme.colors.bright} small>
			<span style={{ 'font-size': '180px' }}>Aa</span>
		</Card.Fill>
		<Container type='auto' flex gap='16px' flexDirection='column' justifyContent='flex-start'>
			<Typography.Label type='muted'>Open Source</Typography.Label>
			<Typography.Heading size={3} weight='bold'>IBM Plex Sans</Typography.Heading>
			<Typography.Paragraph>
				Regular
				<br />
				Aa Bb Cc Dd Ee Ff Gg Hh Ii Jj Kk Ll Mm Nn Oo Pp Qq Rr Ss Tt Uu Vv Ww Xx Yy Zz
			</Typography.Paragraph>
			<Typography.Paragraph weight='bold'>
				SemiBold
				<br />
				Aa Bb Cc Dd Ee Ff Gg Hh Ii Jj Kk Ll Mm Nn Oo Pp Qq Rr Ss Tt Uu Vv Ww Xx Yy Zz
			</Typography.Paragraph>
		</Container>
	</Container>
);