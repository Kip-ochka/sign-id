export interface SettingItemProps {
    message: string;
    textButton?: string;
    description?: string;
}

export interface SettingItemPropsWithStatus extends SettingItemProps {
    status: 'WAIT' | 'SUCCESS' | 'ERROR';
}
