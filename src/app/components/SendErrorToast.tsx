import React, { useEffect } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { Box, Icon, Icons, Portal, Text, color } from 'folds';
import { SendErrorToast as SendErrorToastItem, sendErrorListAtom } from '../state/sendError';
import * as css from './SendErrorToast.css';

const TOAST_DURATION_MS = 6000;

function ToastItem({ id, message }: SendErrorToastItem) {
  const setList = useSetAtom(sendErrorListAtom);

  useEffect(() => {
    const timer = setTimeout(() => {
      setList((list) => list.filter((item) => item.id !== id));
    }, TOAST_DURATION_MS);
    return () => clearTimeout(timer);
  }, [id, setList]);

  return (
    <Box className={css.ToastItem} gap="200" alignItems="Center">
      <Icon style={{ color: color.Critical.Main }} size="200" src={Icons.Warning} />
      <Text as="span" size="T300" truncate>
        {message}
      </Text>
      <IconButtonClose id={id} />
    </Box>
  );
}

function IconButtonClose({ id }: { id: number }) {
  const setList = useSetAtom(sendErrorListAtom);
  return (
    <button
      type="button"
      onClick={() => setList((list) => list.filter((item) => item.id !== id))}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 20,
        height: 20,
        borderRadius: 6,
        border: 'none',
        background: 'transparent',
        cursor: 'pointer',
        color: 'inherit',
      }}
      aria-label="Close"
    >
      <Icon size="100" src={Icons.Cross} />
    </button>
  );
}

export function SendErrorToast() {
  const list = useAtomValue(sendErrorListAtom);
  if (list.length === 0) return null;
  return (
    <Portal>
      <Box className={css.ToastContainer} direction="Column" gap="200">
        {list.map((item) => (
          <ToastItem key={item.id} id={item.id} message={item.message} />
        ))}
      </Box>
    </Portal>
  );
}
