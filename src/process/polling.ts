import type { TaskResponse } from '../shared/api';
import { wait } from './network';
import { requestPoll } from './requests';
import type { RequestOptions } from './requests';

// Сообщает сценарию каждый новый task и возвращает первый ответ без task.
export async function pollUntilProcess(
  task: TaskResponse,
  options: RequestOptions,
  onTask: (task: TaskResponse) => void,
) {
  // Следующая пауза начинается после ответа, поэтому poll-запросы не пересекаются.
  while (true) {
    onTask(task);
    await wait(options.settings.pull_time, options.signal);
    const reply = await requestPoll(task.task, options);
    if (reply.data.kind !== 'task') return reply;
    task = reply.data.response;
  }
}
