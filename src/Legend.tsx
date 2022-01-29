import { Component } from 'solid-js';
import { styled } from 'solid-styled-components';
import { Heading } from '@specialdoom/solid-rev-kit';

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

interface LegendProps {
	title: string;
	rank: number;
}

const StyledLegend = styled('div')`
	margin-left: auto;
  margin-right: auto;
  width: 80%;
  height: 50px;
  border-bottom: 1px solid ${theme.colors.shade};
  margin-top: 20px;
`;

const getRank = (rank: number) => rank < 10 ? `0${rank}` : `${rank}`;

export const Legend: Component<LegendProps> = ({ title, rank }) => (
	<StyledLegend>
		<Heading size={5} weight='bold' type='primary'>
			{getRank(rank)}. {title}
		</Heading>
	</StyledLegend >
);