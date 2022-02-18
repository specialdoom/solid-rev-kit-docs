import { ChatBubble } from '@specialdoom/solid-rev-kit';
import { Container } from '../Container';

export const ChatBubblesSection = () => (
	<Container type='fluid' flex gap='16px' flexWrap='wrap'>
		<Container type='full' flex gap='16px' flexDirection='row' flexWrap='wrap'>
			<ChatBubble placement='top-left'>Top-left bright chat bubble </ChatBubble>
			<ChatBubble placement='top-right'>Top-right bright chat bubble </ChatBubble>
			<ChatBubble placement='bottom-left'>Bottom-left bright chat bubble </ChatBubble>
			<ChatBubble placement='bottom-right'>Bottom-right bright chat bubble </ChatBubble>
		</Container>
		<Container type='full' flex gap='16px' flexDirection='row' flexWrap='wrap'>
			<ChatBubble placement='top-left' type='dark'>Top-left dark chat bubble </ChatBubble>
			<ChatBubble placement='top-right' type='dark'>Top-right dark chat bubble </ChatBubble>
			<ChatBubble placement='bottom-left' type='dark'>Bottom-left dark chat bubble </ChatBubble>
			<ChatBubble placement='bottom-right' type='dark'>Bottom-right dark chat bubble </ChatBubble>
		</Container>
		<Container type='full' flex gap='16px' flexDirection='row' flexWrap='wrap'>
			<ChatBubble placement='top-left' type='bright'>Top-left blueberry chat bubble </ChatBubble>
			<ChatBubble placement='top-right' type='bright'>Top-right blueberry chat bubble </ChatBubble>
			<ChatBubble placement='bottom-left' type='bright'>Bottom-left blueberry chat bubble </ChatBubble>
			<ChatBubble placement='bottom-right' type='bright'>Bottom-right blueberry chat bubble </ChatBubble>
		</Container>
		<Container type='full' flex gap='16px' flexDirection='row' flexWrap='wrap'>
			<ChatBubble placement='top-left' type='strawberry'>Top-left strawberry chat bubble </ChatBubble>
			<ChatBubble placement='top-right' type='strawberry'>Top-right strawberry chat bubble </ChatBubble>
			<ChatBubble placement='bottom-left' type='strawberry'>Bottom-left strawberry chat bubble </ChatBubble>
			<ChatBubble placement='bottom-right' type='strawberry'>Bottom-right strawberry chat bubble </ChatBubble>
		</Container>
	</Container>
);