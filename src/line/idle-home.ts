import { getRuntime } from '../services/runtime-settings';
import type { UserProfile } from '../services/firestore';

export const idleHomeSeconds = (): number => {
  const raw = Number(getRuntime('LINE_IDLE_HOME_SECONDS') || process.env.LINE_IDLE_HOME_SECONDS || 3600);
  return Number.isFinite(raw) && raw > 0 ? raw : 3600;
};

export const guidedFormTtlMinutes = (): number => {
  const formMin = Number(process.env.GUIDED_FORM_TTL_MINUTES || 60);
  const fromIdle = Math.ceil(idleHomeSeconds() / 60);
  const minutes = Math.max(formMin > 0 ? formMin : 60, fromIdle);
  return minutes;
};

export const shouldIdleHome = (profile: UserProfile, nowMs = Date.now()): boolean => {
  if (profile.pendingFlow) return false;
  if (profile.relayWaitAt) return false;
  const terminal = profile.lastTerminalAt ? Date.parse(profile.lastTerminalAt) : NaN;
  if (!Number.isFinite(terminal)) return false;
  return nowMs - terminal >= idleHomeSeconds() * 1000;
};
