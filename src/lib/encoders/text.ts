export interface TextFields {
	text: string;
}

export const emptyText = (): TextFields => ({ text: '' });

export const encodeText = ({ text }: TextFields) => text;

export const textFilename = () => 'custom-text';
