import React, {
  ChangeEventHandler,
  FormEventHandler,
  KeyboardEventHandler,
  useEffect,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Button,
  Icon,
  IconButton,
  Icons,
  Input,
  Scroll,
  Switch,
  Text,
  config,
  toRem,
} from 'folds';
import { isKeyHotkey } from 'is-hotkey';
import { Page, PageContent, PageHeader } from '../../../components/page';
import { SequenceCard } from '../../../components/sequence-card';
import { SequenceCardStyle } from '../styles.css';
import { SettingTile } from '../../../components/setting-tile';
import { useDsTaskBotSettings, useSetDsTaskBotSettings } from '../../../state/dsTaskBot';
import {
  CARD_FONT_SCALE_MAX,
  CARD_FONT_SCALE_MIN,
  clampCardFontScale,
} from '../../ds-task-bot/cardFont';

type DsTaskBotProps = {
  requestClose: () => void;
};

function CardFontScaleInput() {
  const settings = useDsTaskBotSettings();
  const updateSettings = useSetDsTaskBotSettings();
  const [current, setCurrent] = useState(`${settings.cardFontScale}`);

  useEffect(() => {
    setCurrent(`${settings.cardFontScale}`);
  }, [settings.cardFontScale]);

  const handleChange: ChangeEventHandler<HTMLInputElement> = (evt) => {
    setCurrent(evt.currentTarget.value);
  };

  const handleKeyDown: KeyboardEventHandler<HTMLInputElement> = (evt) => {
    if (isKeyHotkey('escape', evt)) {
      evt.stopPropagation();
      setCurrent(`${settings.cardFontScale}`);
      return;
    }
    if (
      isKeyHotkey('enter', evt) &&
      'value' in evt.target &&
      typeof evt.target.value === 'string'
    ) {
      const clamped = clampCardFontScale(parseInt(evt.target.value, 10));
      updateSettings({ cardFontScale: clamped });
      setCurrent(`${clamped}`);
    }
  };

  return (
    <Input
      style={{ width: toRem(100) }}
      variant={settings.cardFontScale === parseInt(current, 10) ? 'Secondary' : 'Success'}
      size="300"
      radii="300"
      type="number"
      min={CARD_FONT_SCALE_MIN}
      max={CARD_FONT_SCALE_MAX}
      value={current}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      after={<Text size="T300">%</Text>}
      outlined
    />
  );
}

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
                <SequenceCard
                  className={SequenceCardStyle}
                  variant="SurfaceVariant"
                  direction="Column"
                  gap="400"
                >
                  <SettingTile
                    title={t('DsTaskBot.BotMxid', { defaultValue: 'Bot MXID' })}
                    description={t('DsTaskBot.BotMxidDescription', {
                      defaultValue:
                        'Matrix ID of the task bot. Its replies are parsed and commands forwarded.',
                    })}
                    after={
                      <Box as="form" onSubmit={handleMxidSubmit} gap="200" alignItems="Center">
                        <Input
                          name="botMxidInput"
                          value={botMxidInput}
                          onChange={handleMxidChange}
                          autoComplete="off"
                          variant="Secondary"
                          size="300"
                          radii="300"
                          style={{ width: toRem(220), paddingRight: config.space.S200 }}
                        />
                        <Button
                          size="300"
                          variant={hasMxidChanges ? 'Success' : 'Secondary'}
                          fill={hasMxidChanges ? 'Solid' : 'Soft'}
                          outlined
                          radii="300"
                          disabled={!hasMxidChanges}
                          type="submit"
                        >
                          <Text size="B300">{t('DsTaskBot.Save', { defaultValue: 'Save' })}</Text>
                        </Button>
                      </Box>
                    }
                  />
                </SequenceCard>
              </Box>
              <Box direction="Column" gap="100">
                <Text size="L400">{t('DsTaskBot.Features', { defaultValue: 'Features' })}</Text>
                <SequenceCard
                  className={SequenceCardStyle}
                  variant="SurfaceVariant"
                  direction="Column"
                  gap="400"
                >
                  <SettingTile
                    title={t('DsTaskBot.CommandHelpers', { defaultValue: 'Command helpers' })}
                    description={t('DsTaskBot.CommandHelpersDescription', {
                      defaultValue: 'Enable the /dstask command and autocomplete for the bot.',
                    })}
                    after={
                      <Switch
                        variant="Primary"
                        value={settings.helpersEnabled}
                        onChange={toggle('helpersEnabled')}
                      />
                    }
                  />
                </SequenceCard>
                <SequenceCard
                  className={SequenceCardStyle}
                  variant="SurfaceVariant"
                  direction="Column"
                  gap="400"
                >
                  <SettingTile
                    title={t('DsTaskBot.TaskCards', { defaultValue: 'Task cards' })}
                    description={t('DsTaskBot.TaskCardsDescription', {
                      defaultValue: 'Render bot task lists as cards in the timeline.',
                    })}
                    after={
                      <Switch
                        variant="Primary"
                        value={settings.cardsEnabled}
                        onChange={toggle('cardsEnabled')}
                      />
                    }
                  />
                </SequenceCard>
                <SequenceCard
                  className={SequenceCardStyle}
                  variant="SurfaceVariant"
                  direction="Column"
                  gap="400"
                >
                  <SettingTile
                    title={t('DsTaskBot.CardFontScale', { defaultValue: 'Card text size' })}
                    description={t('DsTaskBot.CardFontScaleDescription', {
                      defaultValue:
                        'Scale of text inside DsTaskBot cards, in percent (100% by default).',
                    })}
                    after={<CardFontScaleInput />}
                  />
                </SequenceCard>
                <SequenceCard
                  className={SequenceCardStyle}
                  variant="SurfaceVariant"
                  direction="Column"
                  gap="400"
                >
                  <SettingTile
                    title={t('DsTaskBot.CollapseCommands', {
                      defaultValue: 'Collapse bot commands',
                    })}
                    description={t('DsTaskBot.CollapseCommandsDescription', {
                      defaultValue: 'Collapse list, all and close commands in the room timeline.',
                    })}
                    after={
                      <Switch
                        variant="Primary"
                        value={settings.collapseCommandsEnabled}
                        onChange={toggle('collapseCommandsEnabled')}
                      />
                    }
                  />
                </SequenceCard>
              </Box>
            </Box>
          </PageContent>
        </Scroll>
      </Box>
    </Page>
  );
}
