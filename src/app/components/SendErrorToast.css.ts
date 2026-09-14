import { style } from '@vanilla-extract/css';
import { DefaultReset, config } from 'folds';

export const ToastContainer = style([
  DefaultReset,
  {
    position: 'fixed',
    right: config.space.S400,
    bottom: config.space.S400,
    display: 'flex',
    flexDirection: 'column',
    gap: config.space.S200,
    zIndex: 9999,
    maxWidth: 'min(360px, calc(100vw - 32px))',
  },
]);

export const ToastItem = style([
  DefaultReset,
  {
    display: 'flex',
    alignItems: 'center',
    gap: config.space.S200,
    padding: `${config.space.S100} ${config.space.S200}`,
    background: 'var(--cpd-color-bg-canvas-default, rgba(20, 20, 20, 0.92))',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    borderRadius: config.radii.R300,
    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.35)',
  },
]);
