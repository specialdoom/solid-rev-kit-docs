import { Component } from 'solid-js';
import { Button, Card, revConstants } from '@specialdoom/solid-rev-kit';
import { Container } from '../Container';

export const CardsSection: Component = () => (
	<Container type='fluid' flex gap='16px' flexWrap='wrap'>
		<Card.Generic
			imageSrc='https://github.com/specialdoom/solid-rev-kit/blob/main/src/assets/images/marble.png?raw=true'
			title="Generic card title"
			actions={[<Button variant='ghost'>Action</Button>]}
		>
			Supporting description for the card goes here like a breeze.
		</Card.Generic>
		<Card.Generic
			title="Generic card title"
			actions={[<Button variant='ghost'>Action</Button>]}
		>
			Supporting description for the card goes here like a breeze.
		</Card.Generic>
		<Card.Fill background={revConstants.theme.colors.accent} color='#fff' title='Fill card title' label='Label'>
			Lorem ipsum dolor sit amet consectetur adipisicing elit. Aut repellat numquam, autem, unde nihil animi ut placeat officiis veritatis quod nobis cum iusto et incidunt nemo officia cumque distinctio ab?
		</Card.Fill>
		<Card.Fill background='https://github.com/specialdoom/solid-rev-kit/blob/main/src/assets/images/marble.png?raw=true' color='#fff' title='Fill card title' label='Label'>
			Lorem ipsum dolor sit amet consectetur adipisicing elit. Qui iste repellendus quibusdam quia iusto magnam totam doloribus deleniti error maxime hic ex voluptatibus commodi repudiandae illum, sit nulla minima sapiente!
		</Card.Fill>
		<Card.Fill background={revConstants.theme.colors.accent} color='#fff' title='Fill card title' label='Label' small>
			Supporting description for the card goes here like a breeze.
		</Card.Fill>
		<Card.Fill background='https://github.com/specialdoom/solid-rev-kit/blob/main/src/assets/images/marble.png?raw=true' color='#fff' title='Fill card title' label='Label' small>
			Supporting description for the card goes here like a breeze.
		</Card.Fill>
	</Container>
);