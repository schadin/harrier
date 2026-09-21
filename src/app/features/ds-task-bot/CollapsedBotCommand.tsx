import React, { useState } from 'react';
import { Box, Icon, Icons, Text, config } from 'folds';
import { MessageBase } from '../../components/message/layout/Base';
import { MessageSpacing } from '../../state/settings';

type CollapsedBotCommandProps = {
  body: string;
  senderName: string;
  messageSpacing: MessageSpacing;
};

export function CollapsedBotCommand({
  body,
  senderName,
  messageSpacing,
}: CollapsedBotCommandProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <MessageBase space={messageSpacing}>
      <Box
        gap="200"
        alignItems="Center"
        style={{ padding: `${config.space.S200} ${config.space.S300}` }}
      >
        <Icon size="100" src={Icons.BellPing} />
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          style={{
            all: 'unset',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: config.space.S200,
            flexGrow: 1,
            minWidth: 0,
          }}
        >
          <Text size="T200" priority="300" truncate>
            {senderName}: {body}
          </Text>
          <Icon size="100" src={expanded ? Icons.ChevronTop : Icons.ChevronBottom} />
        </button>
      </Box>
      {expanded && (
        <Box style={{ padding: `0 ${config.space.S300} ${config.space.S200}` }}>
          <Text size="T200" priority="400">
            {body}
          </Text>
        </Box>
      )}
    </MessageBase>
  );
}
