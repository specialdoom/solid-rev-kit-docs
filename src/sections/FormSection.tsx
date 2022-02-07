import { Input, Icons, TextArea, Counter, Switch, Select, Alert } from '@specialdoom/solid-rev-kit';
import { Container } from '../Container';

export const FormSection = () => (
	<Container type='fluid' flex gap='16px' flexDirection='row' flexWrap='wrap'>
		<Container type='full' flex gap='16px' flexDirection='row' flexWrap='wrap'>
			<Input />
			<Input value="Value" />
			<Input placeholder="Placeholder" />
			<Input value="Disabled" disabled />
			<Input placeholder="With icon" icon={<Icons.Lens />} />
		</Container>

		<Container type='full' flex gap='16px' flexDirection='row' flexWrap='wrap'>
			<TextArea />
			<TextArea value="Value" />
			<TextArea placeholder="Placeholder" />
			<TextArea placeholder="Disabled" disabled />
			<TextArea placeholder="Six rows textarea" rows={6} />
		</Container>

		<Container type='full' flex gap='16px' flexDirection='row' flexWrap='wrap'>
			<Counter defaultValue={6} />
			<Counter defaultValue={1} minValue={-2} maxValue={2} />
			<Counter defaultValue={2} disabled />
		</Container>

		<Container type='full' flex gap='16px' flexDirection='row' flexWrap='wrap'>
			<Switch />
			<Switch checked />
			<Switch disabled />
			<Switch checked disabled />
		</Container>

		<Container type='full' flex gap='16px' flexDirection='row' flexWrap='wrap'>
			<Alert type='warning'>[Select]: Skeleton of component only! Not fully functional!</Alert>
			<Select options={['Item 1', 'Item 2', 'Item 3']} />
			<Select options={['Item 1', 'Item 2', 'Item 3']} placeholder='Select placeholder' />
			<Select options={['Item 1', 'Item 2', 'Item 3']} defaultOption='Item 1' />
			<Select options={['Item 1', 'Item 2', 'Item 3']} disabled />
			<Select options={['Item 1', 'Item 2', 'Item 3']} placeholder='Select disabled placeholder' disabled />
			<Select options={['Item 1', 'Item 2', 'Item 3']} defaultOption='Item 1' disabled />
		</Container>
	</Container >
);