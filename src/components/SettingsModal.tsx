import React from 'react';
import { SettingsModal as RedesignedSettingsModal, SettingsModalProps } from './settings/SettingsModal';

export const SettingsModal: React.FC<SettingsModalProps> = (props) => {
  return <RedesignedSettingsModal {...props} />;
};

export default SettingsModal;
