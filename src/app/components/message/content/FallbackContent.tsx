import { Box, Button, Icon, Icons, Text, as, color, config } from 'folds';
import React from 'react';
import { useTranslation } from 'react-i18next';

const warningStyle = { color: color.Warning.Main, opacity: config.opacity.P300 };
const criticalStyle = { color: color.Critical.Main, opacity: config.opacity.P300 };

export const MessageDeletedContent = as<'div', { children?: never; reason?: string }>(
  ({ reason, ...props }, ref) => (
    <Box as="span" alignItems="Center" gap="100" style={warningStyle} {...props} ref={ref}>
      <Icon size="50" src={Icons.Delete} />
      {reason ? (
        <i>This message has been deleted. {reason}</i>
      ) : (
        <i>This message has been deleted</i>
      )}
    </Box>
  )
);

export const MessageUnsupportedContent = as<'div', { children?: never }>(({ ...props }, ref) => (
  <Box as="span" alignItems="Center" gap="100" style={criticalStyle} {...props} ref={ref}>
    <Icon size="50" src={Icons.Warning} />
    <i>Unsupported message</i>
  </Box>
));

export const MessageFailedContent = as<'div', { children?: never }>(({ ...props }, ref) => (
  <Box as="span" alignItems="Center" gap="100" style={criticalStyle} {...props} ref={ref}>
    <Icon size="50" src={Icons.Warning} />
    <i>Failed to load message</i>
  </Box>
));

export const MessageBadEncryptedContent = as<'div', { children?: never }>(({ ...props }, ref) => (
  <Box as="span" alignItems="Center" gap="100" style={warningStyle} {...props} ref={ref}>
    <Icon size="50" src={Icons.Lock} />
    <i>Unable to decrypt message</i>
  </Box>
));

type MessageDecryptionFailedContentProps = {
  reasonKey: string;
  actionLabelKey?: string;
  onAction?: () => void;
};

export const MessageDecryptionFailedContent = as<'div', MessageDecryptionFailedContentProps>(
  ({ reasonKey, actionLabelKey, onAction, ...props }, ref) => {
    const { t } = useTranslation();
    return (
      <Box as="span" alignItems="Center" gap="200" style={warningStyle} {...props} ref={ref}>
        <Icon size="50" src={Icons.Lock} />
        <i>{t(reasonKey)}</i>
        {actionLabelKey &&
          (onAction ? (
            <Button size="300" variant="Primary" fill="Soft" radii="300" onClick={onAction}>
              <Text size="B300">{t(actionLabelKey)}</Text>
            </Button>
          ) : (
            <Text size="B300">{t(actionLabelKey)}</Text>
          ))}
      </Box>
    );
  }
);

export const MessageNotDecryptedContent = as<'div', { children?: never }>(({ ...props }, ref) => (
  <Box as="span" alignItems="Center" gap="100" style={warningStyle} {...props} ref={ref}>
    <Icon size="50" src={Icons.Lock} />
    <i>This message is not decrypted yet</i>
  </Box>
));

export const MessageBrokenContent = as<'div', { children?: never }>(({ ...props }, ref) => (
  <Box as="span" alignItems="Center" gap="100" style={criticalStyle} {...props} ref={ref}>
    <Icon size="50" src={Icons.Warning} />
    <i>Broken message</i>
  </Box>
));

export const MessageEmptyContent = as<'div', { children?: never }>(({ ...props }, ref) => (
  <Box as="span" alignItems="Center" gap="100" style={criticalStyle} {...props} ref={ref}>
    <Icon size="50" src={Icons.Warning} />
    <i>Empty message</i>
  </Box>
));

export const MessageEditedContent = as<'span', { children?: never }>(({ ...props }, ref) => (
  <Text as="span" size="T200" priority="300" {...props} ref={ref}>
    {' (edited)'}
  </Text>
));
