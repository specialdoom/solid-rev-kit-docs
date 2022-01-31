import { Component, createSignal } from 'solid-js';
import { Modal, Button } from '@specialdoom/solid-rev-kit';
import { Container } from '../Container';

export const ModalsSection: Component = () => {
	const [getIsModalVisible, setIsModalVisible] = createSignal(false);

	return (
		<Container type='fluid' flex gap='16px' flexWrap='wrap'>
			<Button variant='ghost' small onClick={() => setIsModalVisible(true)}>Open modal</Button>
			<Modal
				title='Modal Title'
				visible={getIsModalVisible}
				onOk={() => setIsModalVisible(false)}
				onCancel={() => setIsModalVisible(false)}
			>
				Left aligned contextual description for modal.
			</Modal>
		</Container >
	);
};