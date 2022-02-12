import { Component } from 'solid-js';
import { styled } from 'solid-styled-components';
import { Typography, revConstants } from '@specialdoom/solid-rev-kit';

interface LegendProps {
	title: string;
	rank: number;
}

const StyledLegend = styled('div')`
	margin-left: auto;
  margin-right: auto;
  width: 80%;
  height: 50px;
  border-bottom: 1px solid ${revConstants.theme.colors.shade};
  margin-top: 20px;
`;

const getRank = (rank: number) => rank < 10 ? `0${rank}` : `${rank}`;

export const Legend: Component<LegendProps> = ({ title, rank }) => (
	<StyledLegend>
		<Typography.Heading size={5} weight='bold' type='primary'>
			{getRank(rank)}. {title}
		</Typography.Heading>
	</StyledLegend >
);