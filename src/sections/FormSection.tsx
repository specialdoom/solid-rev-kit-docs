import { Input, Icons, TextArea } from '@specialdoom/solid-rev-kit';
import { Container } from '../Container';

export const FormSection = () => (
	<Container type='fluid' flex gap='16px' flexDirection='row' flexWrap='wrap'>
		<Input />
		<Input value="Value" />
		<Input placeholder="Placeholder" />
		<Input value="Disabled" disabled />
		<Input placeholder="With icon" icon={<Icons.Lens />} />

		<TextArea />
		<TextArea value="Value" />
		<TextArea placeholder="Placeholder" />
		<TextArea placeholder="Disabled" disabled />
	</Container>
);