import { localFallback } from '../shared/api';
import type {
  ProcessResponse,
  SettingsResponse,
  StatusScreen,
  TaskResponse,
} from '../shared/api';

export const defaultSettings: SettingsResponse = {
  retry_time: 1000,
  retry_addition: 200,
  retry_count: 3,
  pull_time: 10000,
};

type WorkScreen = Exclude<ProcessResponse, StatusScreen>;
type LocalScreen = { process: 'START' } | { process: 'WAITING' };
export type DisplayScreen =
  | LocalScreen
  | WorkScreen
  | (Omit<StatusScreen, 'screen'> & {
      screen: Omit<StatusScreen['screen'], 'buttons'> & {
        buttons?: StatusScreen['screen']['buttons'];
      };
    });

export interface ProcessState {
  inquiryId: string;
  settings: SettingsResponse;
  lastResponse?: ProcessResponse | TaskResponse;
  serverProcess?: ProcessResponse['process'];
  screen: DisplayScreen;
  previousProcess?: DisplayScreen['process'];
  task?: string;
  session?: string;
  token?: string;
  requestId?: string;
  errorKey?: string;
  backScreen?: WorkScreen;
  busy: boolean;
}

export const initialState = (inquiryId: string): ProcessState => ({
  inquiryId,
  settings: defaultSettings,
  screen: inquiryId
    ? { process: 'START' }
    : {
        process: 'STATUS',
        screen: {
          level: 'WARNING',
          title: 'Ссылка недействительна',
          message: 'Откройте ссылку из SMS',
        },
      },
  busy: false,
});

// Запоминает валидный ответ и обновляет session или token для соответствующего шага.
export function saveResponse(
  state: ProcessState,
  response: ProcessResponse | TaskResponse,
): ProcessState {
  if ('task' in response) {
    return { ...state, lastResponse: response, task: response.task };
  }
  return {
    ...state,
    lastResponse: response,
    serverProcess: response.process,
    task: undefined,
    session: response.process === 'SETTING' ? response.session : state.session,
    token: response.process === 'SIGNING' ? response.token : state.token,
  };
}

// Открывает экран и сохраняет рабочий шаг, к которому можно вернуться по BACK.
export function showScreen(
  state: ProcessState,
  screen: DisplayScreen,
  requestId?: string,
  errorKey?: string,
): ProcessState {
  const workScreen =
    screen.process === 'SETTING' ||
    screen.process === 'CHECK' ||
    screen.process === 'SIGNING';
  return {
    ...state,
    screen,
    previousProcess:
      screen.process === state.screen.process
        ? state.previousProcess
        : state.screen.process,
    backScreen: workScreen ? screen : state.backScreen,
    task: screen.process === 'WAITING' ? state.task : undefined,
    requestId,
    errorKey,
  };
}

export function showFallback(state: ProcessState) {
  return showScreen(state, { ...localFallback });
}
