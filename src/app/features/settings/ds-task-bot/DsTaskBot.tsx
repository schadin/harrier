import React, { ChangeEventHandler, FormEventHandler, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Button, Icon, IconButton, Icons, Input, Scroll, Switch, Text, config } from 'folds';
import { Page, PageContent, PageHeader } from '../../../components/page';
import { SequenceCard } from '../../../components/sequence-card';
import { SequenceCardStyle } from '../styles.css';
import { SettingTile } from '../../../components/setting-tile';
import { useDsTaskBotSettings, useSetDsTaskBotSettings } from '../../../state/dsTaskBot';

type DsTaskBotProps = {
  requestClose: () => void;
};

export function DsTaskBot({ requestClose }: DsTaskBotProps) {
  const { t } = useTranslation();
  const settings = useDsTaskBotSettings();
  const updateSettings = useSetDsTaskBotSettings();

  const [botMxidInput, setBotMxidInput] = useState(settings.botMxid);
  useEffect(() => {
    setBotMxidInput(settings.botMxid);
  }, [settings.botMxid]);

  const handleMxidSubmit: FormEventHandler<HTMLFormElement> = (evt) => {
    evt.preventDefault();
    const value = (evt.target as HTMLFormElement).elements.namedItem('botMxidInput') as
      | HTMLInputElement
      | undefined;
    const botMxid = value?.value.trim() ?? '';
    updateSettings({ botMxid });
  };

  const handleMxidChange: ChangeEventHandler<HTMLInputElement> = (evt) => {
    setBotMxidInput(evt.currentTarget.value);
  };

  const hasMxidChanges = botMxidInput.trim() !== settings.botMxid;

  const toggle =
    (key: 'helpersEnabled' | 'cardsEnabled' | 'collapseCommandsEnabled') => (value: boolean) =>
      updateSettings({ [key]: value });

  return (
    <Page>
      <PageHeader outlined={false}>
        <Box grow="Yes" gap="200">
          <Box grow="Yes" alignItems="Center" gap="200">
            <Text size="H3" truncate>
              {t('DsTaskBot.SettingsTitle', { defaultValue: 'DsTaskBot' })}
            </Text>
          </Box>
          <Box shrink="No">
            <IconButton onClick={requestClose} variant="Surface">
              <Icon src={Icons.Cross} />
            </IconButton>
          </Box>
        </Box>
      </PageHeader>
      <Box grow="Yes">
        <Scroll hideTrack visibility="Hover">
          <PageContent>
            <Box direction="Column" gap="700">
              <Box direction="Column" gap="100">
                <Text size="L400">
                  {t('DsTaskBot.SettingsTitle', { defaultValue: 'DsTaskBot' })}
                </Text>
                <SequenceCard className={SequenceCardStyle}>
                  <SettingTile
                    title={t('DsTaskBot.BotMxid', { defaultValue: 'Bot MXID' })}
                    description={t('DsTaskBot.BotMxidDescription', {
                      defaultValue:
                        'Matrix ID of the task bot. Its replies are parsed and commands forwarded.',
                    })}
                  >
                    <Box direction="Column" grow="Yes" gap="100">
                      <Box as="form" onSubmit={handleMxidSubmit} gap="200">
                        <Box grow="Yes" direction="Column">
                          <Input
                            name="botMxidInput"
                            value={botMxidInput}
                            onChange={handleMxidChange}
                            autoComplete="off"
                            variant="Secondary"
                            radii="300"
                            style={{ paddingRight: config.space.S200 }}
                          />
                        </Box>
                        <Button
                          size="400"
                          variant={hasMxidChanges ? 'Success' : 'Secondary'}
                          fill={hasMxidChanges ? 'Solid' : 'Soft'}
                          outlined
                          radii="300"
                          disabled={!hasMxidChanges}
                          type="submit"
                        >
                          <Text size="B400">{t('DsTaskBot.Save', { defaultValue: 'Save' })}</Text>
                        </Button>
                      </Box>
                    </Box>
                  </SettingTile>
                </SequenceCard>
              </Box>
              <Box direction="Column" gap="100">
                <Text size="L400">{t('DsTaskBot.Features', { defaultValue: 'Features' })}</Text>
                <SequenceCard className={SequenceCardStyle}>
                  <SettingTile
                    title={t('DsTaskBot.CommandHelpers', { defaultValue: 'Command helpers' })}
                    description={t('DsTaskBot.CommandHelpersDescription', {
                      defaultValue: 'Enable the /dstask command and autocomplete for the bot.',
                    })}
                  >
                    <Switch
                      variant="Primary"
                      value={settings.helpersEnabled}
                      onChange={toggle('helpersEnabled')}
                    />
                  </SettingTile>
                  <SettingTile
                    title={t('DsTaskBot.TaskCards', { defaultValue: 'Task cards' })}
                    description={t('DsTaskBot.TaskCardsDescription', {
                      defaultValue: 'Render bot task lists as cards in the timeline.',
                    })}
                  >
                    <Switch
                      variant="Primary"
                      value={settings.cardsEnabled}
                      onChange={toggle('cardsEnabled')}
                    />
                  </SettingTile>
                  <SettingTile
                    title={t('DsTaskBot.CollapseCommands', {
                      defaultValue: 'Collapse bot commands',
                    })}
                    description={t('DsTaskBot.CollapseCommandsDescription', {
                      defaultValue: 'Collapse list, all and close commands in the room timeline.',
                    })}
                  >
                    <Switch
                      variant="Primary"
                      value={settings.collapseCommandsEnabled}
                      onChange={toggle('collapseCommandsEnabled')}
                    />
                  </SettingTile>
                </SequenceCard>
              </Box>
            </Box>
          </PageContent>
        </Scroll>
      </Box>
    </Page>
  );
}
